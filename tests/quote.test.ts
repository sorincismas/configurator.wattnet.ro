import { describe, expect, it } from "vitest";
import { createDefaultLibrary } from "@/lib/library/default-library";
import { applyTemplate, createEmptyProject, newBox, newDevice, tracked } from "@/lib/model/factory";
import { generateCircuits } from "@/lib/engine/circuits";
import { generatePanelEquipment, newPanel } from "@/lib/engine/panels";
import { computeLabor } from "@/lib/engine/pricing";
import { assignProformaNumber, buildDocument, subtotals, topDrivers } from "@/lib/engine/quote";
import type { Project } from "@/lib/model/types";

function project(): Project {
  const p = createEmptyProject(createDefaultLibrary());
  applyTemplate(p, p.library.templates.find((t) => t.id === "tpl-casa-pe")!);
  p.info.client.name = "Client test";
  const t = newPanel(p, "TG", null, p.rooms[0].id);
  p.panels.push(t);
  for (const name of ["Living", "Bucatarie", "Dormitor 2"]) {
    const r = p.rooms.find((x) => x.name === name)!;
    for (let i = 0; i < 3; i++) {
      const b = newBox(p, "DA", r.id, "bt-da-rot");
      p.boxes.push(b);
      const d = newDevice(p, r.id, "dt-priza", undefined, b.id);
      d.powerW = tracked(200);
      p.devices.push(d);
    }
  }
  generateCircuits(p);
  p.circuits.forEach((c) => {
    c.panelId = t.id;
    c.estimatedLengthM = tracked(15);
  });
  generatePanelEquipment(p, t.id);
  return p;
}

describe("subtotaluri deviz", () => {
  it("suma subtotalurilor = total manopera, pentru orice grupare", () => {
    const p = project();
    p.extraCosts.push({ id: "e1", label: "Deplasare", amount: 100, timeMin: 60 });
    const labor = computeLabor(p);
    for (const by of ["categorie", "faza", "nivel", "incapere", "tablou"] as const) {
      const sum = subtotals(p, labor, by).reduce((s, x) => s + x.value, 0);
      expect(Math.round(sum * 100) / 100).toBeCloseTo(labor.subtotal, 1);
    }
  });
  it("pe nivel: parter si etaj separate; tarif orar pe grup", () => {
    const p = project();
    const st = subtotals(p, computeLabor(p), "nivel");
    const names = st.map((s) => s.label);
    expect(names).toContain("Parter");
    expect(names).toContain("Etaj 1");
    expect(st.find((s) => s.label === "Parter")!.hourlyRate).toBeGreaterThan(0);
  });
  it("cantitate modificata manual pastreaza proportiile pe incaperi", () => {
    const p = project();
    p.operationOverrides.push({ operationId: "op-doza-rot", enabled: true, quantityOverride: 18, rateOverride: null, timeOverrideMin: null, note: "" });
    const labor = computeLabor(p);
    const line = labor.lines.find((l) => l.operation.id === "op-doza-rot")!;
    expect(line.value).toBe(18 * 12);
    const sum = subtotals(p, labor, "incapere").reduce((s, x) => s + x.value, 0);
    expect(sum).toBeCloseTo(labor.subtotal, 1);
  });
  it("operatiile care influenteaza cel mai mult costul", () => {
    const p = project();
    const t = topDrivers(computeLabor(p), 3);
    expect(t.byValue).toHaveLength(3);
    expect(t.byValue[0].line.value).toBeGreaterThanOrEqual(t.byValue[1].line.value);
  });
});

describe("documente: oferta si proforma", () => {
  it("simplificat = aceleasi totaluri ca detaliat, grupat pe categorii", () => {
    const p = project();
    p.quote.includeMaterials = true;
    const d = buildDocument(p, "oferta", "detaliat");
    const s = buildDocument(p, "oferta", "simplificat");
    expect(s.totals.gross).toBe(d.totals.gross);
    expect(s.laborRows.length).toBeLessThan(d.laborRows.length);
    expect(s.laborRows.reduce((a, r) => a + r.value, 0)).toBeCloseTo(d.laborRows.reduce((a, r) => a + r.value, 0), 1);
    expect(s.materialRows.reduce((a, r) => a + r.value, 0)).toBeCloseTo(d.materialRows.reduce((a, r) => a + r.value, 0), 1);
    expect(d.warnings.some((w) => w.includes("exemplu"))).toBe(true);
  });
  it("proforma: numar din serie, scadenta, avans", () => {
    const p = project();
    expect(buildDocument(p, "proforma", "simplificat").warnings.some((w) => w.includes("numar"))).toBe(true);
    assignProformaNumber(p, 7, "WN");
    p.quote.proforma!.issueDate = "2026-11-05";
    p.quote.proforma!.dueDays = 5;
    p.quote.proforma!.advancePct = 50;
    const doc = buildDocument(p, "proforma", "detaliat");
    expect(doc.number).toBe("WN 0007");
    expect(doc.untilDate).toBe("2026-11-10");
    expect(doc.payable).toBeCloseTo(doc.totals.gross / 2, 2);
    expect(doc.title).toBe("FACTURA PROFORMA");
  });
  it("TVA: neplatitor => 0; platitor => cota firmei", () => {
    const p = project();
    expect(buildDocument(p, "oferta", "simplificat").totals.vat).toBe(0);
    p.library.firm.vatPayer = true;
    const d = buildDocument(p, "oferta", "simplificat");
    expect(d.totals.vat).toBeCloseTo(d.totals.net * 0.21, 1);
  });
});
