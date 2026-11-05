import { describe, expect, it } from "vitest";
import { createDefaultLibrary } from "@/lib/library/default-library";
import { applyTemplate, createEmptyProject, newBox, newDevice, newRoute, tracked } from "@/lib/model/factory";
import { boxLabel, linkBoxToRoute, missingCircuitsOnRoute, routesForBox, unlinkBoxFromRoute } from "@/lib/engine/links";
import { generateCircuits } from "@/lib/engine/circuits";
import { syncCables } from "@/lib/engine/cables";
import type { Project } from "@/lib/model/types";

function setup() {
  const p: Project = createEmptyProject(createDefaultLibrary());
  applyTemplate(p, p.library.templates.find((t) => t.id === "tpl-ap3")!);
  const living = p.rooms.find((r) => r.name === "Living")!;
  const hol = p.rooms.find((r) => r.name === "Hol intrare")!;
  const b = newBox(p, "DA", living.id, "bt-da-mod4");
  b.position = "langa usa";
  p.boxes.push(b);
  const d1 = newDevice(p, living.id, "dt-priza", undefined, b.id);
  const d2 = newDevice(p, living.id, "dt-priza", undefined, b.id);
  d1.powerW = tracked(200);
  d2.powerW = tracked(200);
  p.devices.push(d1, d2);
  generateCircuits(p);
  const r = newRoute(p, "Hol", [hol.id]);
  p.routes.push(r);
  return { p, b, r, living };
}

describe("legatura doza - traseu", () => {
  it("eticheta dozei contine incaperea, aparatele si pozitia", () => {
    const { p, b } = setup();
    expect(boxLabel(p, b)).toBe("DA001 · Living · 2x Priza simpla Schuko · langa usa");
  });
  it("legarea din doza adauga segment, incaperea si circuitele in tub", () => {
    const { p, b, r, living } = setup();
    linkBoxToRoute(p, b.id, r.id, 4);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].to).toMatchObject({ kind: "box", refId: b.id });
    expect(r.segments[0].lengthM.value).toBe(4);
    expect(r.roomIds).toContain(living.id);
    expect(r.conduits).toHaveLength(1);
    expect(missingCircuitsOnRoute(p, b.id, r)).toEqual([]);
    syncCables(p);
    expect(p.cables).toHaveLength(1);
  });
  it("segmentul configurat in traseu se vede la doza (aceeasi sursa)", () => {
    const { p, b, r } = setup();
    expect(routesForBox(p, b.id)).toHaveLength(0);
    r.segments.push({ id: "s1", from: { kind: "free", refId: null, label: "TA" }, to: { kind: "box", refId: b.id, label: b.code }, lengthM: tracked(3), wallTypeId: null, notes: "" });
    expect(routesForBox(p, b.id).map((x) => x.code)).toEqual([r.code]);
  });
  it("legarea repetata nu dubleaza segmentul; urmatoarea doza continua din ultima", () => {
    const { p, b, r, living } = setup();
    linkBoxToRoute(p, b.id, r.id);
    linkBoxToRoute(p, b.id, r.id);
    expect(r.segments).toHaveLength(1);
    const b2 = newBox(p, "DA", living.id, "bt-da-rot");
    p.boxes.push(b2);
    linkBoxToRoute(p, b2.id, r.id);
    expect(r.segments[1].from).toMatchObject({ kind: "box", refId: b.id });
  });
  it("dezlegarea sterge segmentul spre doza si pastreaza lungimile urmatoare", () => {
    const { p, b, r, living } = setup();
    linkBoxToRoute(p, b.id, r.id, 4);
    const b2 = newBox(p, "DA", living.id, "bt-da-rot");
    p.boxes.push(b2);
    linkBoxToRoute(p, b2.id, r.id, 2);
    unlinkBoxFromRoute(p, b.id, r.id);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].from).toMatchObject({ kind: "free", label: "DA001" });
    expect(r.segments[0].lengthM.value).toBe(2);
    expect(routesForBox(p, b.id)).toHaveLength(0);
  });
});
