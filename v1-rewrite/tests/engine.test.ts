import { describe, expect, it } from "vitest";
import {
  CHEAT_MONO,
  CHEAT_TRI,
  addCircuitDevices,
  cableSummary,
  roomCables,
  buildSingleLine,
  computeInventory,
  computeQuote,
  defaultPricing,
  defaultRules,
  demoProject,
  deriveCircuits,
  emptyPoints,
  executionPlan,
  findCascadeCycle,
  layoutPanel,
  minSectionFor,
  newDedicated,
  newDevice,
  newLevel,
  newPanel,
  newProject,
  newRoom,
  normalizeProject,
  parseRating,
  powerKw,
  recommendSection,
  runChecks,
  suggestBreakers,
  voltageDropPct,
  type PricingSettings,
  type Project,
} from "@/lib/engine";

function simpleProject(): Project {
  const p = newProject();
  const lvl = newLevel("parter");
  const r = newRoom("Living");
  r.points = { ...emptyPoints(), priza: 4, intrerupator: 2, iluminat: 2 };
  lvl.rooms = [r];
  p.levels = [lvl];
  return p;
}

describe("inventar", () => {
  it("insumeaza dozele si estimeaza traseele nemasurate", () => {
    const p = simpleProject();
    const inv = computeInventory(p, 5);
    expect(inv.pointsTotal).toBe(8);
    expect(inv.routeM).toEqual({ total: 40, measured: 0, estimated: 40 });
  });

  it("foloseste traseul masurat cand exista", () => {
    const p = simpleProject();
    p.levels[0].rooms[0].routeM = { value: 33, source: "masurat" };
    const inv = computeInventory(p, 5);
    expect(inv.routeM).toEqual({ total: 33, measured: 33, estimated: 0 });
  });

  it("ignora valorile invalide", () => {
    const p = simpleProject();
    p.levels[0].rooms[0].points.priza = -3;
    p.levels[0].rooms[0].points.iluminat = Number.NaN;
    expect(computeInventory(p, 0).pointsTotal).toBe(2);
  });
});

describe("tablou", () => {
  it("calculeaza ocuparea pe sine si semnaleaza depasirea", () => {
    const panel = newPanel();
    panel.rows = 1;
    panel.modulesPerRow = 4;
    panel.devices = [newDevice({ modules: 2 }), newDevice({ modules: 2 }), newDevice({ modules: 1 })];
    const lay = layoutPanel(panel);
    expect(lay.used).toBe(5);
    expect(lay.rows[0].overflow).toBe(true);
    expect(lay.rows[0].placed.map((x) => x.start)).toEqual([0, 2, 4]);
  });

  it("raporteaza aparatele de pe randuri inexistente", () => {
    const panel = newPanel();
    panel.rows = 1;
    panel.devices = [newDevice({ row: 3 })];
    const lay = layoutPanel(panel);
    expect(lay.orphanDevices).toHaveLength(1);
    expect(lay.overflow).toBe(true);
  });

  it("detecteaza buclele de alimentare in cascada", () => {
    const a = newPanel("A");
    const b = newPanel("B", a.id);
    expect(findCascadeCycle([a, b])).toBeNull();
    a.parentPanelId = b.id;
    expect(findCascadeCycle([a, b])).not.toBeNull();
  });
});

describe("deviz", () => {
  const priced = (): PricingSettings => {
    const s = defaultPricing();
    s.operations = s.operations.map((o) => ({ ...o, unitPrice: 10 }));
    return s;
  };

  it("nu inventeaza preturi: fara tarife devizul este incomplet", () => {
    const q = computeQuote(simpleProject(), defaultPricing());
    expect(q.complete).toBe(false);
    expect(q.laborSubtotal).toBe(0);
    expect(q.unpricedLines.length).toBeGreaterThan(0);
  });

  it("calculeaza cantitate × tarif, discount si TVA", () => {
    const p = simpleProject();
    p.trips = 0;
    p.panels = [];
    p.discountPct = 10;
    p.vatPct = 21;
    const s = priced();
    s.defaultRouteMPerPoint = 1; // 8 m
    const q = computeQuote(p, s);
    // trasare 8 + doze 4+2+2 + slituire 8 + pozare 8 = 32 unitati × 10 lei
    expect(q.laborSubtotal).toBe(320);
    expect(q.discount).toBe(32);
    expect(q.netTotal).toBe(288);
    expect(q.vat).toBe(60.48);
    expect(q.grandTotal).toBe(348.48);
    expect(q.complete).toBe(true);
  });

  it("foloseste timp standard × tarif orar cand nu exista tarif unitar", () => {
    const p = simpleProject();
    p.trips = 0;
    p.panels = [];
    const s = defaultPricing();
    s.hourlyRate = 120;
    s.operations = s.operations.map((o) =>
      o.id === "doza-zidarie-simpla" ? { ...o, minutesPerUnit: 15 } : { ...o, enabled: false },
    );
    const q = computeQuote(p, s);
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0].unitPrice).toBe(30);
    // 4 prize + 2 intrerupatoare + 2 iluminat, toate doze simple in zidarie
    expect(q.lines[0].quantity).toBe(8);
    expect(q.lines[0].amount).toBe(240);
    expect(q.lines[0].method).toBe("timp-x-tarif-orar");
    expect(q.totalMinutes).toBe(120);
  });

  it("marcheaza cantitatile estimate", () => {
    const q = computeQuote(simpleProject(), priced());
    const pozare = q.lines.find((l) => l.operationId === "pozare")!;
    expect(pozare.estimatedQuantity).toBe(pozare.quantity);
  });

  it("planul de executie respecta ordinea etapelor", () => {
    const q = computeQuote(demoProject(), priced());
    const stages = executionPlan(q).map((s) => s.stage);
    expect(stages[0]).toBe("trasare");
    expect(stages.indexOf("doze")).toBeLessThan(stages.indexOf("trasee"));
    expect(stages.indexOf("tablouri")).toBeLessThan(stages.indexOf("conexiuni"));
  });
});

describe("verificari", () => {
  it("nu declara nimic conform fara date", () => {
    const res = runChecks(newProject(), defaultPricing());
    expect(res.find((r) => r.ruleId === "DATE-001")?.status).toBe("nedeterminat");
    expect(res.find((r) => r.ruleId === "DATE-002")?.status).toBe("nedeterminat");
  });

  it("semnaleaza tabloul secundar fara lungime de alimentare", () => {
    const res = runChecks(demoProject(), defaultPricing());
    const feeder = res.filter((r) => r.ruleId === "TAB-003");
    expect(feeder).toHaveLength(1); // tabloul garaj
  });

  it("proiectul demonstrativ nu depaseste capacitatea tablourilor", () => {
    const res = runChecks(demoProject(), defaultPricing());
    expect(res.filter((r) => r.ruleId === "TAB-002").every((r) => r.status === "conform")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Faza de proiectare: formule, circuite, tablouri, verificari         */
/* ------------------------------------------------------------------ */

describe("formule electrice", () => {
  it("calculeaza puterea maxima absorbita", () => {
    expect(powerKw(1, 32)).toBeCloseTo(7.36, 2);
    expect(powerKw(3, 25)).toBeCloseTo(17.32, 2);
    expect(powerKw(1, 16, 0.85)).toBeCloseTo(3.128, 3);
  });

  it("calculeaza caderea de tensiune", () => {
    expect(voltageDropPct(1, 10, 30, 2.5, 0.0225)!).toBeCloseTo(2.35, 2);
    expect(voltageDropPct(3, 16, 30, 2.5, 0.0225)!).toBeCloseTo(1.87, 2);
    expect(voltageDropPct(1, 10, 30, 0, 0.0225)).toBeNull();
  });

  it("alege sectiunea dupa Ib ≤ In ≤ Iz si ΔU", () => {
    const iz = defaultRules().iz;
    expect(minSectionFor(25, 1, iz)).toBe(4);
    expect(minSectionFor(50, 3, iz)).toBe(16);
    expect(recommendSection(20, 30, 1, iz, 0.0225, 3)).toBe(4);
  });

  const n = (s: string) => Number(s.replace(",", ".").replace(/[^\d.]/g, ""));
  const firstSection = (s: string) => Number(/×(\d+(?:,\d+)?)/.exec(s)![1].replace(",", "."));
  const tables = [
    [CHEAT_MONO, 1],
    [CHEAT_TRI, 3],
  ] as const;

  it("cheat sheet: puterile corespund formulelor", () => {
    for (const [rows, ph] of tables) {
      for (const r of rows) {
        expect(Math.abs(powerKw(ph, r.a) - n(r.p1.split(" ")[0]))).toBeLessThan(0.06);
        expect(Math.abs(powerKw(ph, r.a, 0.85) - n(r.p085.split(" ")[0]))).toBeLessThan(0.06);
      }
    }
  });

  it("cheat sheet: ΔU la 30 m corespunde formulei (cu exceptia valorilor semnalate)", () => {
    const mismatches: string[] = [];
    for (const [rows, ph] of tables) {
      for (const r of rows) {
        const du = voltageDropPct(ph, r.a, 30, firstSection(r.rec30), 0.0225)!;
        if (Math.abs(du - n(r.du30.split("%")[0])) > 0.06) mismatches.push(`${ph === 1 ? "mono" : "tri"} ${r.a}A`);
      }
    }
    // in tabelul primit: 1,9 %; calculul da 1,56 % — semnalat electricianului
    expect(mismatches).toEqual(["tri 32A"]);
  });
});

function roomsProject(): Project {
  const p = newProject();
  p.supply = "monofazat";
  const lvl = newLevel("parter");
  const r = newRoom("Bucatarie");
  // 14 doze de priza: 2 sunt capete de circuite dedicate → 12 pe circuitele generale
  r.points = { ...emptyPoints(), priza: 14, iluminat: 3, intrerupator: 1, alteSurse: 1 };
  r.dedicated = [
    newDedicated({ name: "Priza frigider", endpoint: "priza" }),
    newDedicated({ name: "Cuptor", endpoint: "priza" }),
    newDedicated({ name: "Plita", endpoint: "alteSurse", ratedA: 32, sectionMm2: 6 }),
  ];
  lvl.rooms = [r];
  lvl.panelId = p.panels[0].id;
  p.levels = [lvl];
  return p;
}

describe("circuite", () => {
  const rules = defaultRules();

  it("genereaza, denumeste si numeroteaza circuitele", () => {
    const c = deriveCircuits(roomsProject(), rules, 6);
    expect(c.map((x) => x.code)).toEqual([
      "CI_P01",
      "CP_P01",
      "CP_P01_b",
      "CP_P01_01",
      "CP_P01_02",
      "CP_P01_03",
    ]);
    expect(c.find((x) => x.code === "CP_P01")!.points).toBe(8);
    expect(c.find((x) => x.code === "CP_P01_b")!.points).toBe(4);
    expect(c.map((x) => x.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(c.find((x) => x.kind === "prize")!.cable).toBe("3×2,5");
    const plita = c.find((x) => x.name === "Plita")!;
    expect(plita.code).toBe("CP_P01_03");
    expect(plita.cable).toBe("3×6");
    expect(plita.ratedA).toBe(32);
  });

  it("marcheaza cablurile care ajung in incapere", () => {
    const p = roomsProject();
    const c = deriveCircuits(p, rules, 6);
    const cables = roomCables(p.levels[0].rooms[0].id, c);
    expect(cables).toHaveLength(6);
    expect(cableSummary(cables)).toBe("6 cabluri: 1× 3×1,5 · 4× 3×2,5 · 1× 3×6");
  });

  it("circuitele dedicate nu se numara ca doze", () => {
    const p = roomsProject();
    expect(computeInventory(p, 6).pointsTotal).toBe(14 + 3 + 1 + 1);
    expect(computeInventory(p, 6).dedicatedCircuits).toBe(3);
  });

  it("foloseste codul de incapere introdus", () => {
    const p = roomsProject();
    p.levels[0].rooms[0].code = "P03";
    expect(deriveCircuits(p, rules, 6)[0].code).toBe("CI_P03");
  });

  it("grupeaza iluminatul pe nivel", () => {
    const p = roomsProject();
    const r2 = newRoom("Hol");
    r2.points = { ...emptyPoints(), iluminat: 2 };
    p.levels[0].rooms.push(r2);
    const c = deriveCircuits(p, { ...rules, lightingGrouping: "nivel" }, 6).filter((x) => x.kind === "iluminat");
    expect(c).toHaveLength(1);
    expect(c[0].code).toBe("CI_P");
    expect(c[0].points).toBe(5);
  });

  it("pastreaza modificarile manuale si comasarile", () => {
    const p = roomsProject();
    const base = deriveCircuits(p, rules, 6);
    const cp = base.find((x) => x.code === "CP_P01")!;
    const cpb = base.find((x) => x.code === "CP_P01_b")!;
    p.circuitOverrides = { [cp.id]: { ratedA: 20, lengthM: 12 }, [cpb.id]: { mergeInto: cp.id } };
    const c = deriveCircuits(p, rules, 6);
    const merged = c.find((x) => x.id === cp.id)!;
    expect(merged.ratedA).toBe(20);
    expect(merged.overridden).toContain("ratedA");
    expect(merged.points).toBe(12);
    expect(merged.merged).toEqual([cpb.id]);
    expect(c.some((x) => x.id === cpb.id)).toBe(false);
  });

  it("ignora comasarile in bucla", () => {
    const p = roomsProject();
    const base = deriveCircuits(p, rules, 6);
    const [a, b] = base.filter((x) => x.kind === "prize");
    p.circuitOverrides = { [a.id]: { mergeInto: b.id }, [b.id]: { mergeInto: a.id } };
    expect(deriveCircuits(p, rules, 6)).toHaveLength(base.length);
  });

  it("sugereaza sigurantele lipsa si le adauga in tablou", () => {
    const p = roomsProject();
    const c = deriveCircuits(p, rules, 6);
    const panel = p.panels[0];
    expect(suggestBreakers(panel, c).missing).toHaveLength(c.length);
    const filled = addCircuitDevices(panel, c);
    const s = suggestBreakers(filled, c);
    expect(s.missing).toHaveLength(0);
    expect(s.installed.every((x) => !x.mismatch)).toBe(true);
    expect(filled.devices.find((d) => d.circuitId === c[1].id)).toMatchObject({ kind: "MCB", ratedA: 16, curve: "C" });
  });
});

describe("verificari de proiectare", () => {
  it("semnaleaza siguranta prea mare pentru cablu si ΔU prea mare", () => {
    const p = roomsProject();
    const cp = deriveCircuits(p, defaultRules(), 6).find((x) => x.code === "CP_P01")!;
    p.circuitOverrides = { [cp.id]: { ratedA: 20, sectionMm2: 1.5, lengthM: 100 } };
    const res = runChecks(p, defaultPricing());
    expect(res.find((r) => r.ruleId === "CIRC-002" && r.target === cp.id)?.status).toBe("neconform");
    expect(res.find((r) => r.ruleId === "CIRC-003" && r.target === cp.id)?.status).toBe("neconform");
  });

  it("numara prizele pe circuitele comasate", () => {
    const p = roomsProject();
    const [a, b] = deriveCircuits(p, defaultRules(), 6).filter((x) => x.kind === "prize");
    p.circuitOverrides = { [b.id]: { mergeInto: a.id } };
    const res = runChecks(p, defaultPricing());
    expect(res.find((r) => r.ruleId === "CIRC-001")?.status).toBe("neconform");
  });

  it("verifica selectivitatea intre tablouri cu raportul setat", () => {
    const demo = demoProject();
    const te = demo.panels.find((x) => x.name === "Tablou etaj")!;
    // plecare C25 spre etaj, cel mai mare circuit din etaj 16 A → 1,56 < 1,6
    const sel = (s: PricingSettings) => runChecks(demo, s).find((r) => r.ruleId === "SEL-001" && r.target === te.id);
    expect(sel(defaultPricing())?.status).toBe("neconform");
    expect(sel({ ...defaultPricing(), rules: { selectivityRatio: 1.5 } })?.status).toBe("conform");
  });

  it("proiectul demonstrativ are toate circuitele montate", () => {
    const res = runChecks(demoProject(), defaultPricing());
    expect(res.find((r) => r.ruleId === "CIRC-004")?.status).toBe("conform");
    expect(res.find((r) => r.ruleId === "ALIM-001")?.status).toBe("conform");
  });

  it("schema monofilara pune circuitele de prize sub diferential", () => {
    const demo = demoProject();
    const sl = buildSingleLine(demo, deriveCircuits(demo, defaultRules(), 6));
    const tp = sl[0];
    expect(tp.main?.device.kind).toBe("separator");
    const rcd = tp.nodes.find((x) => x.device.kind === "RCD")!;
    expect(rcd.children.length).toBeGreaterThan(0);
    expect(rcd.children.every((c) => c.circuit?.kind === "prize" || c.circuit?.kind === "dedicat")).toBe(true);
    expect(tp.nodes.filter((x) => x.feeds).map((x) => x.feeds!.name)).toEqual(["Tablou etaj", "Tablou garaj"]);
  });
});

describe("doze pe perete si marime", () => {
  it("numara dozele dupa perete si marime in deviz", () => {
    const p = simpleProject();
    const r = p.levels[0].rooms[0];
    r.wall = "gips-carton";
    r.boxSizes = { intrerupator: "dubla" };
    const s = defaultPricing();
    s.operations = s.operations.map((o) => ({ ...o, unitPrice: 1 }));
    const q = computeQuote(p, s);
    const qty = (id: string) => q.lines.find((l) => l.operationId === id)?.quantity ?? 0;
    expect(qty("doza-gips-carton-simpla")).toBe(6);
    expect(qty("doza-gips-carton-dubla")).toBe(2);
    expect(qty("doza-zidarie-simpla")).toBe(0);
  });

  it("alte surse fara doza intra la iesire de cablu", () => {
    const p = roomsProject();
    const s = defaultPricing();
    s.operations = s.operations.map((o) => ({ ...o, unitPrice: 1 }));
    expect(computeQuote(p, s).lines.find((l) => l.operationId === "iesire-cablu")?.quantity).toBe(1);
  });

  it("semnaleaza circuitele dedicate fara doza de capat", () => {
    const p = roomsProject();
    p.levels[0].rooms[0].points.alteSurse = 0;
    const res = runChecks(p, defaultPricing());
    expect(res.find((r) => r.ruleId === "DATE-003")?.status).toBe("nedeterminat");
  });
});

describe("compatibilitate", () => {
  it("transforma dozele dedicate vechi in circuite dedicate", () => {
    const p = newProject();
    const r = newRoom("Bucatarie");
    (r.points as Record<string, number>).dedicat = 2;
    r.points.priza = 5;
    p.levels[0].rooms = [r];
    const n = normalizeProject(p).levels[0].rooms[0];
    expect(n.points.priza).toBe(7);
    expect("dedicat" in n.points).toBe(false);
    expect(n.dedicated?.map((d) => d.id)).toEqual(["0", "1"]);
    // id-ul circuitului ramane cel vechi (cd:<incapere>:<i>), deci modificarile salvate se pastreaza
    expect(deriveCircuits(normalizeProject(p), defaultRules(), 6).filter((c) => c.kind === "dedicat").map((c) => c.id)).toEqual([
      `cd:${r.id}:0`,
      `cd:${r.id}:1`,
    ]);
  });

  it("citeste valorile din textul vechi de caracteristici", () => {
    expect(parseRating("C16")).toEqual({ curve: "C", ratedA: 16 });
    expect(parseRating("40A 30mA tip A")).toEqual({ ratedA: 40, sensitivityMa: 30, rcdType: "A" });
    const p = newProject();
    p.panels[0].devices = [newDevice({ rating: "B10" })];
    expect(normalizeProject(p).panels[0].devices[0]).toMatchObject({ ratedA: 10, curve: "B", rating: "B10" });
  });
});
