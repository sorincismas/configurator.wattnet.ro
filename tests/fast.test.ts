import { describe, expect, it } from "vitest";
import { createDefaultLibrary } from "@/lib/library/default-library";
import { applyTemplate, createEmptyProject, tracked } from "@/lib/model/factory";
import { generateCircuits } from "@/lib/engine/circuits";
import { autoCircuitLength, chaseLength, circuitCableLength, circuitLimitPoints, totalCableLength, totalConduitLength } from "@/lib/engine/measure";
import { addBoxes, addDeviceToBox, addPoints, applyQuickItems, boxCapacity, boxDevices, changePointType, parseQuickCode, removeBox, removeDeviceFromBox, removePoint } from "@/lib/engine/points";
import { chainLength, moveInChain, resolveChain, setLinkLength } from "@/lib/engine/chain";
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
  it("4P 2L 1I: doze cu destinatie + puncte de iluminat", () => {
    const r = parseQuickCode(lib, "4P 2L 1I");
    expect(r.errors).toEqual([]);
    expect(r.items.map((i) => [i.kind, i.id, i.n])).toEqual([
      ["doza", "pp-priza", 4],
      ["punct", "dt-il-plafon", 2],
      ["doza", "pp-intr", 1],
    ]);
  });
  it("litere lipite si fara numar", () => {
    expect(parseQuickCode(lib, "3p2l").items.map((i) => i.n)).toEqual([3, 2]);
    expect(parseQuickCode(lib, "PPL").items.map((i) => [i.id, i.n])).toEqual([
      ["pp-priza", 2],
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
  it("lungime = distanta pana la tablou + legaturile dintre doze; masuratoarea are prioritate", () => {
    const p = setup();
    p.fast.panelDistanceM = 10;
    p.fast.metersPerPoint = 4;
    addPoints(p, room(p, "Living").id, "dt-priza", 3);
    generateCircuits(p);
    const c = p.circuits[0];
    expect(autoCircuitLength(p, c)).toBe(18);
    expect(circuitCableLength(p, c)).toMatchObject({ value: 18, certainty: "estimat" });
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

describe("doze in faza la rosu", () => {
  it("doza cu destinatie: tipul implicit al destinatiei, consum estimat, intra in circuit", () => {
    const p = setup();
    const r = room(p, "Living").id;
    const [b] = addBoxes(p, r, "pp-priza-mod4", 1);
    expect(b.boxTypeId).toBe("bt-da-mod4");
    expect(b.modules).toBe(4);
    const ph = boxDevices(p, b.id);
    expect(ph).toHaveLength(1);
    expect(ph[0]).toMatchObject({ placeholder: true, category: "priza" });
    expect(ph[0].powerW.value).toBe(600);
    generateCircuits(p);
    expect(ph[0].circuitId).not.toBeNull();
  });
  it("faza la gata: aparatajul intra in doza dupa module; rezervarea dispare, circuitul ramane", () => {
    const p = setup();
    const r = room(p, "Living").id;
    const [b] = addBoxes(p, r, "pp-priza-mod4", 1);
    generateCircuits(p);
    const cid = boxDevices(p, b.id)[0].circuitId;
    expect(addDeviceToBox(p, b.id, "dt-priza").ok).toBe(true);
    expect(addDeviceToBox(p, b.id, "dt-priza").ok).toBe(true);
    expect(boxCapacity(p, b.id)).toEqual({ modules: 4, used: 4, free: 0 });
    expect(addDeviceToBox(p, b.id, "dt-priza").ok).toBe(false);
    const ds = boxDevices(p, b.id);
    expect(ds.every((d) => !d.placeholder && d.circuitId === cid)).toBe(true);
    removeDeviceFromBox(p, ds[0].id);
    removeDeviceFromBox(p, ds[1].id);
    const back = boxDevices(p, b.id);
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ placeholder: true, circuitId: cid });
    removeBox(p, b.id);
    expect(p.boxes).toHaveLength(0);
    expect(p.devices).toHaveLength(0);
  });
  it("cod rapid cu doze si puncte de iluminat; deviz pe tipuri de doze si puncte de iluminat", () => {
    const p = setup();
    const r = room(p, "Living").id;
    applyQuickItems(p, r, parseQuickCode(p.library, "3P 1D 2L 1I").items);
    expect(p.boxes).toHaveLength(5);
    expect(p.devices.filter((d) => d.category === "iluminat" && !d.boxId)).toHaveLength(2);
    const lines = computeLabor(p).lines;
    expect(lines.find((l) => l.operation.id === "op-doza-rot")?.quantity).toBe(4);
    expect(lines.find((l) => l.operation.id === "op-doza-mod4")?.quantity).toBe(1);
    expect(lines.find((l) => l.operation.id === "op-punct-il")?.quantity).toBe(2);
  });
});

describe("lant pe circuit", () => {
  it("ordinea si lungimile legaturilor; prima legatura = distanta pana la tablou", () => {
    const p = setup();
    p.fast.panelDistanceM = 12;
    p.fast.metersPerPoint = 3;
    const r = room(p, "Living").id;
    const bs = addBoxes(p, r, "pp-priza", 3);
    generateCircuits(p);
    const c = p.circuits.find((x) => x.usage === "prize")!;
    expect(resolveChain(p, c).map((l) => l.memberId)).toEqual(bs.map((b) => b.id));
    expect(chainLength(p, c)).toEqual({ value: 18, measured: false });
    moveInChain(p, c.id, bs[2].id, -1);
    expect(resolveChain(p, c).map((l) => l.memberId)).toEqual([bs[0].id, bs[2].id, bs[1].id]);
    setLinkLength(p, c.id, bs[0].id, 8);
    expect(chainLength(p, c)!.value).toBe(14);
    expect(circuitCableLength(p, c).value).toBe(14);
    for (const b of bs) setLinkLength(p, c.id, b.id, 2);
    expect(circuitCableLength(p, c)).toMatchObject({ value: 6, certainty: "masurat" });
  });
});

describe("doze goale si biblioteci vechi", () => {
  it("doza goala (fara aparataj, fara rezervare) primeste destinatie si poate intra pe circuit", async () => {
    const { setBoxPurpose } = await import("@/lib/engine/points");
    const { newBox } = await import("@/lib/model/factory");
    const p = setup();
    const b = newBox(p, "DA", room(p, "Living").id, "bt-da-mod3");
    p.boxes.push(b);
    expect(boxDevices(p, b.id)).toHaveLength(0);
    setBoxPurpose(p, b.id, "pp-priza");
    expect(boxDevices(p, b.id)[0]).toMatchObject({ placeholder: true, category: "priza" });
    generateCircuits(p);
    expect(boxDevices(p, b.id)[0].circuitId).not.toBeNull();
    expect(addDeviceToBox(p, b.id, "dt-priza").ok).toBe(true);
  });
  it("o biblioteca fara destinatii de doza le primeste pe cele implicite", () => {
    const p = setup();
    p.library.pointPurposes = [];
    expect(migrateProject(p).library.pointPurposes.length).toBeGreaterThan(0);
  });
});

describe("destinatie doza si biblioteca unica", () => {
  it("schimbarea destinatiei pastreaza destinatia aleasa si ia tipul ei de doza", async () => {
    const { setBoxPurpose } = await import("@/lib/engine/points");
    const p = setup();
    const [b] = addBoxes(p, room(p, "Living").id, "pp-priza", 1);
    expect(b.purposeId).toBe("pp-priza");
    setBoxPurpose(p, b.id, "pp-priza-mod4");
    expect(b).toMatchObject({ purposeId: "pp-priza-mod4", boxTypeId: "bt-da-mod4", modules: 4 });
    expect(boxDevices(p, b.id)[0].powerW.value).toBe(600);
    setBoxPurpose(p, b.id, "pp-priza-tv");
    expect(b.purposeId).toBe("pp-priza-tv");
    expect(boxDevices(p, b.id)[0].powerW.value).toBe(200);
  });
  it("absorbMissing adauga doar elementele lipsa, fara sa schimbe tarifele existente", async () => {
    const { absorbMissing } = await import("@/lib/library/sync");
    const a = createDefaultLibrary();
    const b = createDefaultLibrary();
    b.operations[0].rate = 999;
    b.boxTypes.push({ ...b.boxTypes[0], id: "bt-custom", name: "Doza proiect" });
    const out = absorbMissing(a, b);
    expect(out.operations[0].rate).toBe(a.operations[0].rate);
    expect(out.boxTypes.some((t) => t.id === "bt-custom")).toBe(true);
    expect(absorbMissing(a, createDefaultLibrary())).toBe(a);
  });
});
