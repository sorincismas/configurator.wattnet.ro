import { describe, expect, it } from "vitest";
import {
  computeInventory,
  computeQuote,
  defaultPricing,
  demoProject,
  emptyPoints,
  executionPlan,
  findCascadeCycle,
  layoutPanel,
  newDevice,
  newLevel,
  newPanel,
  newProject,
  newRoom,
  runChecks,
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
      o.id === "doza-priza" ? { ...o, minutesPerUnit: 15 } : { ...o, enabled: false },
    );
    const q = computeQuote(p, s);
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0].unitPrice).toBe(30);
    expect(q.lines[0].amount).toBe(120);
    expect(q.lines[0].method).toBe("timp-x-tarif-orar");
    expect(q.totalMinutes).toBe(60);
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
