import { describe, expect, it } from "vitest";
import { createDefaultLibrary } from "@/lib/library/default-library";
import { applyTemplate, createEmptyProject, newBox, newDevice, tracked } from "@/lib/model/factory";
import { generateCircuits } from "@/lib/engine/circuits";
import { computeLabor } from "@/lib/engine/pricing";
import { diffWithCurrent, issueVersion, modifiedSinceIssue, parseSnapshot, revLabel } from "@/lib/engine/versions";
import { autoRegister } from "@/lib/engine/register";
import type { Project } from "@/lib/model/types";

function project(): Project {
  const p = createEmptyProject(createDefaultLibrary());
  applyTemplate(p, p.library.templates.find((t) => t.id === "tpl-ap2")!);
  const r = p.rooms.find((x) => x.name === "Living")!;
  for (let i = 0; i < 3; i++) {
    const b = newBox(p, "DA", r.id, "bt-da-rot");
    p.boxes.push(b);
    const d = newDevice(p, r.id, "dt-priza", undefined, b.id);
    d.powerW = tracked(300);
    p.devices.push(d);
  }
  generateCircuits(p);
  return p;
}

describe("versiuni emise", () => {
  it("numerotare Rev.01, Rev.02 si stare ofertat", () => {
    const p = project();
    const v1 = issueVersion(p, "oferta_manopera", "prima oferta");
    const v2 = issueVersion(p, "oferta_completa", "cu materiale");
    expect(revLabel(v1.number)).toBe("Rev.01");
    expect(v2.number).toBe(2);
    expect(p.info.status).toBe("ofertat");
    expect(v2.totals.materialsValue).not.toBeNull();
    expect(v1.totals.materialsValue).toBeNull();
  });
  it("instantaneul nu se modifica cand proiectul se schimba (inclusiv tarifele)", () => {
    const p = project();
    const v = issueVersion(p, "oferta_manopera", "");
    expect(modifiedSinceIssue(p)).toBe(false);
    const before = v.totals.laborValue;
    p.library.operations.forEach((o) => (o.rate *= 2));
    p.devices.push(newDevice(p, p.rooms[0].id, "dt-priza"));
    p.updatedAt = new Date(Date.now() + 1000).toISOString();
    const snap = parseSnapshot(v);
    expect(computeLabor(snap).total).toBe(before);
    expect(snap.devices.length).toBe(3);
    expect(snap.issued).toHaveLength(0);
    expect(modifiedSinceIssue(p)).toBe(true);
  });
  it("comparatia arata diferentele de manopera si circuitele adaugate", () => {
    const p = project();
    const v = issueVersion(p, "oferta_manopera", "");
    const k = p.rooms.find((x) => x.name === "Bucatarie")!;
    const d = newDevice(p, k.id, "dt-plita");
    d.powerW = tracked(5000);
    p.devices.push(d);
    generateCircuits(p);
    const diff = diffWithCurrent(v, p);
    expect(diff.addedCircuits.length).toBe(1);
    expect(diff.rows.find((r) => r.label === "Circuite")!.delta).toBe(1);
    expect(diff.rows.find((r) => r.label === "Manopera")!.delta).toBeGreaterThan(0);
  });
});

describe("registru automat", () => {
  it("contine estimari, date de confirmat si reguli nevalidate", () => {
    const p = project();
    const reg = autoRegister(p);
    expect(reg.some((e) => e.category === "estimat")).toBe(true);
    expect(reg.some((e) => e.text.includes("reguli tehnice"))).toBe(true);
    expect(reg.some((e) => e.text.includes("legare la pamant"))).toBe(true);
  });
});
