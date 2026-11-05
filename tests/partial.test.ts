import { describe, expect, it } from "vitest";
import { createDefaultLibrary } from "@/lib/library/default-library";
import { applyTemplate, createEmptyProject, newBox, newCircuit, newDevice, tracked } from "@/lib/model/factory";
import { circuitLoad, generateCircuits } from "@/lib/engine/circuits";
import { installedPower } from "@/lib/engine/power";
import { computeLabor, computeMaterials } from "@/lib/engine/pricing";
import { generatePanelEquipment, newPanel } from "@/lib/engine/panels";
import { proposeSizing } from "@/lib/engine/sizing";
import type { Project } from "@/lib/model/types";

function setup(): Project {
  const p = createEmptyProject(createDefaultLibrary());
  applyTemplate(p, p.library.templates.find((t) => t.id === "tpl-ap3")!);
  return p;
}

describe("lucrari partiale: inlocuire tablou fara modelarea punctelor", () => {
  function tablouNou() {
    const p = setup();
    const t = newPanel(p, "Tablou apartament", null, null);
    p.panels.push(t);
    const defs: [string, string, number, number][] = [
      ["Prize dormitor", "ctp-prize", 1800, 6],
      ["Prize bucatarie", "ctp-prize-bucatarie", 2100, 7],
      ["Plita", "ctp-dedicat", 3500, 1],
      ["Iluminat", "ctp-iluminat", 800, 8],
    ];
    for (const [name, type, w, pts] of defs) {
      const c = newCircuit(p, name, p.library.circuitTypes.find((x) => x.id === type)!.usage, type);
      c.panelId = t.id;
      c.declaredPowerW = tracked(w, "beneficiar");
      c.declaredPoints = pts;
      c.existing = true;
      p.circuits.push(c);
    }
    return { p, t };
  }
  it("puterea declarata pe circuit intra in consum, fara aparate", () => {
    const { p } = tablouNou();
    expect(installedPower(p).value).toBe(8200);
    const l = circuitLoad(p, p.circuits[0]);
    expect(l.installed.value).toBe(1800);
    expect(l.sockets).toBe(6);
  });
  it("tabloul se echipeaza si circuitele se pot dimensiona din puterea declarata", () => {
    const { p, t } = tablouNou();
    const plita = p.circuits.find((c) => c.name === "Plita")!;
    plita.estimatedLengthM = tracked(10);
    expect(proposeSizing(p, plita).ratingA).toBe(20); // Ic = 3500 / (230 x 0,95) = 16,02 A
    generatePanelEquipment(p, t.id);
    expect(t.items.filter((i) => i.role === "circuit")).toHaveLength(4);
  });
  it("devizul 'doar tablou': fara cablare/doze; reconectare pe circuite existente; demontare manuala", () => {
    const { p, t } = tablouNou();
    generatePanelEquipment(p, t.id);
    p.quote.scope = { preset: "tablou", categories: [], panelIds: [], levelIds: [] };
    p.operationOverrides.push({ operationId: "op-demontare-tablou", enabled: true, quantityOverride: 1, rateOverride: null, timeOverrideMin: null, note: "" });
    const lines = computeLabor(p).lines;
    const ids = lines.map((l) => l.operation.id);
    expect(ids).toContain("op-tablou");
    expect(ids).toContain("op-aparat-modular");
    expect(ids).toContain("op-reconectare-existent");
    expect(ids).toContain("op-demontare-tablou");
    expect(ids).not.toContain("op-conectare-circuit"); // circuitele sunt existente
    expect(ids).not.toContain("op-cablu");
    expect(lines.find((l) => l.operation.id === "op-reconectare-existent")!.quantity).toBe(4);
    p.quote.includeMaterials = true;
    const m = computeMaterials(p);
    expect(m.lines.some((x) => x.name.includes("Tablou"))).toBe(true);
    expect(m.lines.some((x) => x.name.includes("FY"))).toBe(false);
  });
  it("domeniu pe tablou: doar elementele tabloului selectat", () => {
    const p = setup();
    const t1 = newPanel(p, "Parter", null, null);
    const t2 = newPanel(p, "Etaj", t1.id, null);
    p.panels.push(t1, t2);
    const living = p.rooms.find((r) => r.name === "Living")!;
    const dorm = p.rooms.find((r) => r.name === "Dormitor mare")!;
    for (const r of [living, dorm]) {
      const b = newBox(p, "DA", r.id, "bt-da-rot");
      p.boxes.push(b);
      const d = newDevice(p, r.id, "dt-priza", undefined, b.id);
      d.powerW = tracked(300);
      p.devices.push(d);
    }
    generateCircuits(p);
    // un singur circuit de prize pe nivel; il mutam pe t2 si adaugam unul manual pe t1
    p.circuits[0].panelId = t2.id;
    const all = computeLabor(p).lines.find((l) => l.operation.id === "op-doza-rot")!.quantity;
    expect(all).toBe(2);
    p.quote.scope = { preset: "tot", categories: [], panelIds: [t1.id], levelIds: [] };
    expect(computeLabor(p).lines.find((l) => l.operation.id === "op-doza-rot")).toBeUndefined();
    p.quote.scope = { preset: "tot", categories: [], panelIds: [t2.id], levelIds: [] };
    expect(computeLabor(p).lines.find((l) => l.operation.id === "op-doza-rot")!.quantity).toBe(2);
  });
});
