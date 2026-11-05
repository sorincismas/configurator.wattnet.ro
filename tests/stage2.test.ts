import { describe, expect, it } from "vitest";
import { createDefaultLibrary } from "@/lib/library/default-library";
import { applyTemplate, createEmptyProject, newBox, newConduit, newDevice, newRoute, newSegment, tracked } from "@/lib/model/factory";
import { allCircuitLoads, circuitLoad, generateCircuits, moveDevice } from "@/lib/engine/circuits";
import { syncCables } from "@/lib/engine/cables";
import { chaseLength, circuitCableLength } from "@/lib/engine/measure";
import { computeLabor } from "@/lib/engine/pricing";
import { computeSummary } from "@/lib/engine/summary";
import type { Project } from "@/lib/model/types";

function setup(): Project {
  const p = createEmptyProject(createDefaultLibrary());
  applyTemplate(p, p.library.templates.find((t) => t.id === "tpl-ap3")!);
  return p;
}
const room = (p: Project, name: string) => p.rooms.find((r) => r.name === name)!;
function socket(p: Project, roomName: string, w: number | null, dt = "dt-priza") {
  const r = room(p, roomName);
  const b = newBox(p, "DA", r.id, "bt-da-rot");
  p.boxes.push(b);
  const d = newDevice(p, r.id, dt, undefined, b.id);
  d.powerW = tracked(w, "proiectant");
  p.devices.push(d);
  return d;
}

describe("aparate si doze", () => {
  it("mai multe aparate in aceeasi doza: doza numarata o data", () => {
    const p = setup();
    const r = room(p, "Living");
    const b = newBox(p, "DA", r.id, "bt-da-mod4");
    p.boxes.push(b);
    p.devices.push(newDevice(p, r.id, "dt-priza", undefined, b.id), newDevice(p, r.id, "dt-priza", undefined, b.id));
    const s = computeSummary(p);
    expect(s.counts.boxesDA).toBe(1);
    expect(s.counts.sockets).toBe(2);
  });
  it("curentii slabi nu primesc putere si nici circuit", () => {
    const p = setup();
    const d = newDevice(p, room(p, "Living").id, "dt-rj45");
    p.devices.push(d);
    expect(d.powerW.value).toBeNull();
    generateCircuits(p);
    expect(d.circuitId).toBeNull();
  });
  it("puterea din biblioteca este doar un consum mediu estimat, editabil", () => {
    const p = setup();
    const d = newDevice(p, room(p, "Living").id, "dt-plita");
    expect(d.powerW.value).toBe(7000);
    expect(d.powerW.provenance).toBe("estimat");
    p.library.deviceTypes.find((t) => t.id === "dt-plita")!.suggestedPowerW = null;
    expect(newDevice(p, room(p, "Living").id, "dt-plita").powerW.value).toBeNull();
  });
});

describe("generare circuite", () => {
  it("bucataria si baia au circuite separate, dedicatii circuit propriu", () => {
    const p = setup();
    socket(p, "Living", 200);
    socket(p, "Dormitor mare", 200);
    socket(p, "Bucatarie", 1000);
    socket(p, "Baie mare", 2000);
    const plita = newDevice(p, room(p, "Bucatarie").id, "dt-plita");
    plita.powerW = tracked(5000, "proiectant");
    p.devices.push(plita);
    const rep = generateCircuits(p);
    expect(rep.assigned).toBe(5);
    const names = p.circuits.map((c) => c.name).sort();
    expect(names).toEqual(["Plita electrica - Bucatarie", "Prize Apartament", "Prize Baie mare", "Prize Bucatarie"].sort());
    const ded = p.circuits.find((c) => c.usage === "dedicat")!;
    // dedicat: protectia si cablul nu sunt hardcodate
    expect(ded.protection.ratingA).toBeNull();
    expect(ded.cableTypeId).toBeNull();
    expect(p.circuits[0].code).toBe("CI001");
  });
  it("bugetul de putere imparte prizele in mai multe circuite", () => {
    const p = setup();
    // 16 A x 230 x 0,95 x 80% = 2797 W aplicati; ks prize = 0,5 => ~5594 W instalati per circuit
    for (let i = 0; i < 6; i++) socket(p, "Living", 1500);
    generateCircuits(p);
    const pr = p.circuits.filter((c) => c.usage === "prize");
    expect(pr.length).toBe(2);
    expect(pr[1].name).toBe("Prize Apartament (2)");
  });
  it("puncte mutate manual raman pe loc la reorganizare; codurile nu se reutilizeaza", () => {
    const p = setup();
    const a = socket(p, "Living", 100);
    const b = socket(p, "Bucatarie", 100);
    generateCircuits(p);
    const kitchen = p.circuits.find((c) => c.name === "Prize Bucatarie")!;
    moveDevice(p, a.id, kitchen.id);
    const rep = generateCircuits(p, "reorganizeaza");
    expect(a.circuitId).toBe(kitchen.id);
    expect(b.circuitId).toBe(kitchen.id);
    expect(rep.removed).toContain("CI001"); // circuitul Living golit
    socket(p, "Living", 100);
    generateCircuits(p);
    expect(p.circuits.map((c) => c.code)).not.toContain("CI001");
    expect(p.circuits.some((c) => c.code === "CI003")).toBe(true);
  });
  it("intrerupatorul urmeaza circuitul lampii comandate", () => {
    const p = setup();
    const r = room(p, "Hol intrare");
    const bx = newBox(p, "DA", r.id, "bt-da-rot");
    p.boxes.push(bx);
    const sw = newDevice(p, r.id, "dt-intr-simplu", undefined, bx.id);
    const il = newDevice(p, r.id, "dt-il-plafon");
    il.powerW = tracked(20);
    il.controlledByIds = [sw.id];
    p.devices.push(sw, il);
    generateCircuits(p);
    expect(il.circuitId).not.toBeNull();
    expect(sw.circuitId).toBe(il.circuitId);
  });
});

describe("consum total pe circuit", () => {
  it("putere instalata, aplicata si curent de calcul", () => {
    const p = setup();
    socket(p, "Bucatarie", 2000);
    socket(p, "Bucatarie", 1500);
    generateCircuits(p);
    const l = circuitLoad(p, p.circuits[0]);
    expect(l.installed.value).toBe(3500);
    expect(l.appliedW).toBe(2100); // ks 0,6
    expect(l.designCurrentA).toBe(9.61); // 2100 / (230 x 0,95)
    expect(l.installedCurrentA).toBe(16.02);
    expect(l.sockets).toBe(2);
  });
  it("puteri lipsa raportate", () => {
    const p = setup();
    socket(p, "Living", null);
    generateCircuits(p);
    expect(allCircuitLoads(p)[0].warnings[0]).toContain("fara putere");
  });
});

describe("trasee, tuburi si cabluri", () => {
  it("traseu comun: sant o data, cabluri pe fiecare circuit cu rezerva", () => {
    const p = setup();
    socket(p, "Living", 500);
    socket(p, "Bucatarie", 500);
    generateCircuits(p);
    const [c1, c2] = p.circuits;
    const tr = newRoute(p, "Hol - tablou", [room(p, "Hol intrare").id]);
    tr.segments.push(newSegment("TA", "DD", 4), newSegment("DD", "Living", 3));
    tr.conduits.push(newConduit(p, "cd-20", [c1.id]), newConduit(p, "cd-20", [c2.id]));
    p.routes.push(tr);
    const r = syncCables(p);
    expect(r.created.length).toBe(2);
    expect(chaseLength(p).value).toBe(7);
    expect(circuitCableLength(p, c1).value).toBe(8); // 7 m + 1 m rezerva
    expect(computeLabor(p).lines.find((l) => l.operation.id === "op-sant")!.quantity).toBe(7);
    expect(computeLabor(p).lines.find((l) => l.operation.id === "op-copex")!.quantity).toBe(14);
    // scoatem circuitul din tub => cablul dispare
    tr.conduits[1].circuitIds = [];
    expect(syncCables(p).removed.length).toBe(1);
  });
  it("lungimea estimata a circuitului se foloseste cand nu exista trasee", () => {
    const p = setup();
    socket(p, "Living", 500);
    generateCircuits(p);
    p.circuits[0].estimatedLengthM = tracked(18);
    expect(circuitCableLength(p, p.circuits[0]).value).toBe(18);
    expect(circuitCableLength(p, p.circuits[0]).certainty).toBe("estimat");
  });
});
