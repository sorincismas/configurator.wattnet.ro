import { describe, expect, it } from "vitest";
import { createDefaultLibrary } from "@/lib/library/default-library";
import { applyTemplate, createEmptyProject, newBox, newDevice, tracked } from "@/lib/model/factory";
import { generateCircuits } from "@/lib/engine/circuits";
import { ampacity, analyzeCircuit, applySizing, lookupFactor, proposeSizing, upstreamDrop, voltageDropPct } from "@/lib/engine/sizing";
import { balancePhases, generatePanelEquipment, layoutPanel, newPanel, phaseLoads, removePanel } from "@/lib/engine/panels";
import { allChecks, checkStats, circuitChecks } from "@/lib/engine/checks";
import type { Project } from "@/lib/model/types";

function setup(): Project {
  const p = createEmptyProject(createDefaultLibrary());
  applyTemplate(p, p.library.templates.find((t) => t.id === "tpl-ap3")!);
  p.supply.mainBreakerA = tracked(32);
  return p;
}
const room = (p: Project, n: string) => p.rooms.find((r) => r.name === n)!;
function add(p: Project, roomName: string, dt: string, w: number) {
  const r = room(p, roomName);
  const b = newBox(p, "DA", r.id, "bt-da-rot");
  p.boxes.push(b);
  const d = newDevice(p, r.id, dt, undefined, ["dt-plita", "dt-il-plafon"].includes(dt) ? null : b.id);
  d.powerW = tracked(w, "proiectant");
  p.devices.push(d);
  return d;
}

describe("curenti admisibili - exemplele din I7 anexa 5.30", () => {
  it("exemplul 1: 3x2,5 Cu PVC, metoda C, 35 °C, 2 cabluri pe perete => 21,57 A", () => {
    const lib = createDefaultLibrary();
    const cable = lib.cableTypes.find((c) => c.id === "ct-cyyf3x25");
    const r = ampacity(lib, cable, "C", 35, 2);
    expect(r.iz).toBe(27);
    expect(r.k1).toBe(0.94);
    expect(r.k2).toBe(0.85);
    expect(r.izCorrected).toBe(21.57);
  });
  it("exemplul 3: aceeasi configuratie fara grupare => 25,38 A (27 x 0,94)", () => {
    const lib = createDefaultLibrary();
    const r = ampacity(lib, lib.cableTypes.find((c) => c.id === "ct-cyyf3x25"), "C", 35, 1);
    expect(r.izCorrected).toBe(25.38);
  });
  it("K1 se interpoleaza intre trepte, K2 ia treapta defavorabila", () => {
    const lib = createDefaultLibrary();
    expect(lookupFactor(lib.correctionTables.find((t) => t.id === "k1-pvc"), 32.5)).toBe(0.97);
    expect(lookupFactor(lib.correctionTables.find((t) => t.id === "k2-grup-incastrat"), 10)).toBe(0.45);
  });
  it("date lipsa => fara rezultat", () => {
    const lib = createDefaultLibrary();
    expect(ampacity(lib, undefined, "B1", 30, 1).missing).toContain("tip cablu");
  });
});

describe("cadere de tensiune", () => {
  it("monofazat: 2 L I cos / (γ S) / U", () => {
    // 2 x 20 x 10 x 1 / (56 x 2,5) = 2,857 V => 1,24 %
    expect(voltageDropPct("mono", 20, 10, 1, 2.5, "cupru", 230)).toBe(1.24);
  });
  it("trifazat: √3 L I cos / (γ S) / U", () => {
    expect(voltageDropPct("tri", 30, 20, 0.9, 6, "cupru", 400)).toBe(0.7);
  });
});

describe("propunere dimensionare", () => {
  it("plita 5 kW, 10 m, B1: In 25 A, 2,5 mm² respins, 4 mm² acceptat", () => {
    const p = setup();
    add(p, "Bucatarie", "dt-plita", 5000);
    generateCircuits(p);
    p.fast.cableFamily = "FY";
    const c = p.circuits.find((x) => x.usage === "dedicat")!;
    c.installMethodId = "im-b1";
    c.estimatedLengthM = tracked(10);
    const prop = proposeSizing(p, c);
    expect(prop.ok).toBe(true);
    expect(prop.ratingA).toBe(25);
    expect(prop.cableTypeId).toBe("ct-fy3x4");
    expect(prop.steps.some((s) => s.includes("FY 3x2,5") && s.includes("respins"))).toBe(true);
    applySizing(p, c.id, prop);
    expect(c.protection.ratingA).toBe(25);
    expect(c.protection.protectionDeviceId).toBe("pd-sch-c25");
  });
  it("lungime mare => sectiune crescuta pentru ΔU", () => {
    const p = setup();
    add(p, "Bucatarie", "dt-plita", 5000);
    generateCircuits(p);
    p.fast.cableFamily = "FY";
    const c = p.circuits.find((x) => x.usage === "dedicat")!;
    c.installMethodId = "im-b1";
    c.estimatedLengthM = tracked(60);
    expect(proposeSizing(p, c).cableTypeId).toBe("ct-fy3x6"); // 4 mm2: ΔU 5,06% > 5% respins
  });
  it("circuit de prize cu sarcina mica: In ramane minim 16 A (setarea tipului), doar din catalog", () => {
    const p = setup();
    add(p, "Living", "dt-priza", 300);
    generateCircuits(p);
    const c = p.circuits[0];
    c.estimatedLengthM = tracked(15);
    const prop = proposeSizing(p, c);
    expect(prop.ratingA).toBe(16);
    expect(prop.protectionDeviceId).not.toBeNull();
    expect(prop.cableTypeId).toBe("ct-nyyj3x25"); // sectiune minima prize 2,5 mm2, familia NYY-J a circuitului
  });
  it("fara putere => date insuficiente, nu se inventeaza", () => {
    const p = setup();
    add(p, "Bucatarie", "dt-plita", 0).powerW = tracked<number>(null);
    generateCircuits(p);
    expect(proposeSizing(p, p.circuits[0]).ok).toBe(false);
  });
});

describe("tablouri", () => {
  it("echipare: separator + RCD-uri grupate + MCB pe circuit + alimentare tablou secundar", () => {
    const p = setup();
    for (const r of ["Living", "Dormitor mare", "Dormitor mic", "Bucatarie", "Baie mare", "Baie mica"]) add(p, r, "dt-priza", 300);
    add(p, "Living", "dt-il-plafon", 50);
    const main = newPanel(p, "Tablou general", null, room(p, "Hol intrare").id);
    p.panels.push(main);
    generateCircuits(p);
    p.circuits.forEach((c) => (c.panelId = main.id));
    const sec = newPanel(p, "Tablou etaj", main.id, room(p, "Living").id);
    sec.feeder.lengthM = tracked(12);
    p.panels.push(sec);
    const rep = generatePanelEquipment(p, main.id);
    // circuite: prize apartament, bucatarie, baie mare, baie mica, iluminat => 5 circuite, 1 RCD (max 6)
    expect(rep.rcds).toBe(1);
    const roles = main.items.map((i) => i.role);
    expect(roles[0]).toBe("general");
    expect(roles.filter((r) => r === "circuit").length).toBe(p.circuits.length);
    expect(roles.at(-1)).toBe("feeder");
    expect(main.enclosureTypeId).not.toBeNull();
    // fiecare circuit stie RCD-ul din amonte
    expect(p.circuits.every((c) => c.protection.rcdItemId)).toBe(true);
    const lay = layoutPanel(p, main);
    expect(lay.overflow).toHaveLength(0);
    expect(lay.usedModules).toBe(main.items.reduce((s, i) => s + (p.library.protectionDevices.find((d) => d.id === i.protectionDeviceId)?.modules ?? 2), 0));
  });
  it("tablou prea mic => aparate in afara", () => {
    const p = setup();
    for (let i = 0; i < 20; i++) add(p, "Living", "dt-priza-dubla", 1800);
    const main = newPanel(p, "TG", null, null);
    p.panels.push(main);
    generateCircuits(p);
    p.circuits.forEach((c) => (c.panelId = main.id));
    generatePanelEquipment(p, main.id);
    main.enclosureTypeId = "en-12";
    expect(layoutPanel(p, main).overflow.length).toBeGreaterThan(0);
  });
  it("ΔU cumulat: alimentarea tabloului secundar se adauga circuitelor lui", () => {
    const p = setup();
    const main = newPanel(p, "TG", null, null);
    const sec = newPanel(p, "TE", main.id, null);
    sec.feeder.lengthM = tracked(20);
    p.panels.push(main, sec);
    add(p, "Living", "dt-priza", 2000);
    generateCircuits(p);
    p.circuits[0].panelId = sec.id;
    p.circuits[0].estimatedLengthM = tracked(10);
    const up = upstreamDrop(p, sec.id)!;
    expect(up).toBeGreaterThan(0);
    const a = analyzeCircuit(p, p.circuits[0]);
    expect(a.duTotalPct).toBeCloseTo(a.duCircuitPct! + up, 2);
  });
  it("stergerea tabloului muta circuitele pe parinte", () => {
    const p = setup();
    const main = newPanel(p, "TG", null, null);
    const sec = newPanel(p, "TE", main.id, null);
    p.panels.push(main, sec);
    add(p, "Living", "dt-priza", 200);
    generateCircuits(p);
    p.circuits[0].panelId = sec.id;
    removePanel(p, sec.id);
    expect(p.circuits[0].panelId).toBe(main.id);
  });
  it("echilibrare faze trifazat", () => {
    const p = setup();
    p.supply.system = "tri";
    p.supply.voltageV = 400;
    add(p, "Bucatarie", "dt-plita", 3000);
    add(p, "Living", "dt-cuptor", 2500);
    add(p, "Baie mare", "dt-boiler", 2000);
    generateCircuits(p);
    p.circuits.forEach((c) => (c.phase = "L1"));
    expect(phaseLoads(p).imbalancePct).toBe(100);
    balancePhases(p);
    expect(new Set(p.circuits.map((c) => c.phase)).size).toBe(3);
  });
});

describe("verificari", () => {
  it("rezultate: conform calculat dar regula nevalidata; neconform; date insuficiente", () => {
    const p = setup();
    const d = add(p, "Living", "dt-priza", 2000);
    generateCircuits(p);
    const c = p.circuits[0];
    c.estimatedLengthM = tracked(15);
    const list = circuitChecks(p, c);
    const ib = list.find((x) => x.ruleId === "r-ib-iz")!;
    expect(ib.result).toBe("conform");
    expect(ib.ruleValidated).toBe(false);
    // fara tablou echipat => diferential: date insuficiente
    expect(list.find((x) => x.ruleId === "r-rcd-prize")!.result).toBe("date_insuficiente");
    // protectie supradimensionata fata de cablu
    c.protection.ratingA = 32;
    expect(circuitChecks(p, c).find((x) => x.ruleId === "r-coord-prot")!.result).toBe("neconform");
    void d;
  });
  it("lipsa lungimii => ΔU date insuficiente (nu conform)", () => {
    const p = setup();
    add(p, "Living", "dt-priza", 500);
    generateCircuits(p);
    // fara estimarea rapida pe proiect lungimea ramane necunoscuta
    (p as { fast?: unknown }).fast = undefined;
    expect(circuitChecks(p, p.circuits[0]).find((x) => x.ruleId === "r-du")!.result).toBe("date_insuficiente");
  });
  it("receptor > 2 kW pe circuit comun de prize => neconform (art. 5.4.7)", () => {
    const p = setup();
    add(p, "Living", "dt-priza", 2500);
    add(p, "Living", "dt-priza", 200);
    generateCircuits(p);
    expect(circuitChecks(p, p.circuits[0]).find((x) => x.ruleId === "r-receptor-2kw")!.result).toBe("neconform");
  });
  it("regula validata => conform; statistici", () => {
    const p = setup();
    add(p, "Living", "dt-priza", 500);
    generateCircuits(p);
    p.library.rules.find((r) => r.id === "r-ib-iz")!.validation = "validat";
    const s = checkStats(allChecks(p));
    expect(s.conform).toBeGreaterThanOrEqual(1);
    expect(s.date_insuficiente).toBeGreaterThan(0);
  });
});
