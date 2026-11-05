import { describe, expect, it } from "vitest";
import { createDefaultLibrary } from "@/lib/library/default-library";
import { applyTemplate, createEmptyProject, tracked } from "@/lib/model/factory";
import { generateCircuits } from "@/lib/engine/circuits";
import { autoCircuitLength, chaseLength, circuitCableLength, circuitLimitPoints, totalCableLength, totalConduitLength } from "@/lib/engine/measure";
import { addPoints, changePointType, parseQuickCode, removePoint } from "@/lib/engine/points";
import { computeLabor } from "@/lib/engine/pricing";
import { migrateProject } from "@/lib/io/files";
import type { Project } from "@/lib/model/types";

function setup(): Project {
  const p = createEmptyProject(createDefaultLibrary());
  applyTemplate(p, p.library.templates.find((t) => t.id === "tpl-ap3")!);
  return p;
}
const room = (p: Project, n: string) => p.rooms.find((r) => r.name === n)!;

describe("cod rapid", () => {
  const lib = createDefaultLibrary();
  it("4P 2L 1I", () => {
    const r = parseQuickCode(lib, "4P 2L 1I");
    expect(r.errors).toEqual([]);
    expect(r.items.map((i) => [i.deviceTypeId, i.n])).toEqual([
      ["dt-priza", 4],
      ["dt-il-plafon", 2],
      ["dt-intr-simplu", 1],
    ]);
  });
  it("litere lipite si fara numar", () => {
    expect(parseQuickCode(lib, "3p2l").items.map((i) => i.n)).toEqual([3, 2]);
    expect(parseQuickCode(lib, "PPL").items.map((i) => [i.deviceTypeId, i.n])).toEqual([
      ["dt-priza", 2],
      ["dt-il-plafon", 1],
    ]);
  });
  it("litera necunoscuta => eroare, nu se adauga nimic presupus", () => {
    expect(parseQuickCode(lib, "2Q").errors.length).toBeGreaterThan(0);
  });
});

describe("puncte", () => {
  it("priza primeste doza proprie, punctul de iluminat nu", () => {
    const p = setup();
    const r = room(p, "Living");
    addPoints(p, r.id, "dt-priza", 3);
    addPoints(p, r.id, "dt-il-plafon", 1);
    expect(p.boxes.filter((b) => b.roomId === r.id)).toHaveLength(3);
    expect(p.devices.filter((d) => d.roomId === r.id)).toHaveLength(4);
    expect(p.devices[0].powerW.value).toBe(300);
  });
  it("stergerea punctului sterge si doza ramasa goala; schimbarea tipului ajusteaza doza", () => {
    const p = setup();
    const [d] = addPoints(p, room(p, "Living").id, "dt-priza", 1);
    changePointType(p, d.id, "dt-il-plafon");
    expect(p.boxes).toHaveLength(0);
    changePointType(p, d.id, "dt-priza-dubla");
    expect(p.boxes).toHaveLength(1);
    removePoint(p, d.id);
    expect(p.boxes).toHaveLength(0);
    expect(p.devices).toHaveLength(0);
  });
});

describe("impartire pe circuite", () => {
  it("maxim 6 puncte pe circuit, incaperea ramane impreuna cand incape", () => {
    const p = setup();
    addPoints(p, room(p, "Living").id, "dt-priza", 4);
    addPoints(p, room(p, "Dormitor mare").id, "dt-priza", 4);
    addPoints(p, room(p, "Dormitor mic").id, "dt-priza", 2);
    generateCircuits(p);
    const prize = p.circuits.filter((c) => c.usage === "prize");
    for (const c of prize) expect(circuitLimitPoints(p, c)).toBeLessThanOrEqual(6);
    // living (4) + dormitor mic (2) incap impreuna; dormitorul mare (4) nu mai incape langa living
    const roomsOf = (c: { id: string }) => [...new Set(p.devices.filter((d) => d.circuitId === c.id).map((d) => p.rooms.find((r) => r.id === d.roomId)!.name))];
    for (const c of prize) {
      const names = roomsOf(c);
      expect(names.includes("Living") && names.includes("Dormitor mare")).toBe(false);
    }
    expect(prize).toHaveLength(2);
  });
  it("intrerupatoarele nu se numara la limita", () => {
    const p = setup();
    const r = room(p, "Living");
    addPoints(p, r.id, "dt-il-plafon", 6);
    addPoints(p, r.id, "dt-intr-simplu", 3);
    generateCircuits(p);
    const il = p.circuits.filter((c) => c.usage === "iluminat");
    expect(il).toHaveLength(1);
    expect(circuitLimitPoints(p, il[0])).toBe(6);
  });
  it("cablul implicit este NYY-J", () => {
    const p = setup();
    addPoints(p, room(p, "Living").id, "dt-priza", 1);
    addPoints(p, room(p, "Living").id, "dt-il-plafon", 1);
    generateCircuits(p);
    expect(p.circuits.find((c) => c.usage === "prize")!.cableTypeId).toBe("ct-nyyj3x25");
    expect(p.circuits.find((c) => c.usage === "iluminat")!.cableTypeId).toBe("ct-nyyj3x15");
  });
});

describe("estimare lungimi", () => {
  it("lungime = distanta pana la tablou + puncte x metri pe punct; masuratoarea are prioritate", () => {
    const p = setup();
    p.fast.panelDistanceM = 10;
    p.fast.metersPerPoint = 4;
    addPoints(p, room(p, "Living").id, "dt-priza", 3);
    generateCircuits(p);
    const c = p.circuits[0];
    expect(autoCircuitLength(p, c)).toBe(22);
    expect(circuitCableLength(p, c)).toMatchObject({ value: 22, certainty: "estimat" });
    c.estimatedLengthM = tracked(17, "masurat");
    expect(circuitCableLength(p, c)).toMatchObject({ value: 17, certainty: "masurat" });
  });
  it("sant = procent din cablu; fara copex => tub 0; tablou existent => fara montare cutie", () => {
    const p = setup();
    addPoints(p, room(p, "Living").id, "dt-priza", 3);
    generateCircuits(p);
    p.fast.chasePct = 50;
    expect(chaseLength(p).value).toBe((totalCableLength(p).value ?? 0) / 2);
    p.fast.noConduit = true;
    expect(totalConduitLength(p).value).toBe(0);
    p.fast.noConduit = false;
    expect(totalConduitLength(p).value).toBe(totalCableLength(p).value);
    p.panels.push({ ...structuredClone(p.panels[0] ?? ({} as never)), id: "t1", code: "TA001", name: "T", roomId: null, location: "", parentPanelId: null, feeder: { cableTypeId: null, lengthM: tracked<number>(null), protectionDeviceId: null, ratingA: null, installMethodId: null }, enclosureTypeId: null, reservePct: 20, items: [], status: "estimat", notes: "" });
    const has = () => computeLabor(p).lines.some((l) => l.operation.id === "op-tablou");
    expect(has()).toBe(true);
    p.fast.panelMode = "existent";
    expect(has()).toBe(false);
    expect(computeLabor(p).lines.find((l) => l.operation.id === "op-legare-capete")?.quantity).toBe(3);
  });
});

describe("migrare", () => {
  it("proiect vechi: setari rapide implicite cu copex, tipurile de circuit trec pe NYY-J", () => {
    const p = setup();
    const old = structuredClone(p);
    delete (old as { fast?: unknown }).fast;
    old.library.meta.defaultsRev = 4;
    old.library.circuitTypes.find((c) => c.id === "ctp-prize")!.defaultCableTypeId = "ct-fy3x25";
    old.library.cableTypes = old.library.cableTypes.filter((c) => !c.id.startsWith("ct-nyyj"));
    const m = migrateProject(old as Project);
    expect(m.fast.noConduit).toBe(false);
    expect(m.fast.maxPointsPerCircuit).toBe(6);
    expect(m.library.circuitTypes.find((c) => c.id === "ctp-prize")!.defaultCableTypeId).toBe("ct-nyyj3x25");
    expect(m.library.cableTypes.some((c) => c.id === "ct-nyyj3x25")).toBe(true);
  });
});
