import { takeCode, uid } from "./ids";
import {
  SCHEMA_VERSION,
  type Building,
  type BuildingKind,
  type Level,
  type Library,
  type Project,
  type ProjectTemplate,
  type Room,
  type Tracked,
  type Box,
  type BoxKind,
  type Cable,
  type Circuit,
  type CircuitUsage,
  type Conduit,
  type Device,
  type DeviceCategory,
  type Route,
  type RouteSegment,
} from "./types";

export const nowISO = () => new Date().toISOString();

export function tracked<T = number>(value: T | null, provenance: Tracked<T>["provenance"] = "estimat"): Tracked<T> {
  return { value, provenance, status: provenance === "masurat" ? "masurat" : value === null ? undefined : "estimat" };
}

export function projectCode(seq: number, date = new Date()): string {
  return `WN-${date.getFullYear()}-${String(seq).padStart(3, "0")}`;
}

export function createEmptyProject(library: Library, seq = 1): Project {
  const now = nowISO();
  return {
    id: uid(),
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    lastExportedAt: null,
    info: {
      code: projectCode(seq),
      name: "Proiect nou",
      kind: "apartament",
      customKind: "",
      location: "",
      client: { name: "", phone: "", email: "", address: "", notes: "" },
      partial: false,
      partialScope: "",
      phases: ["rosu"],
      status: "ciorna",
      designerNotes: "",
      assumptionsText:
        "Oferta este estimativa si se bazeaza pe datele furnizate de beneficiar. Lungimile traseelor sunt estimate pana la masurarea pe santier.",
      exclusionsText:
        "Nu sunt incluse: inchiderea santurilor cu tencuiala/glet, finisaje, bransamentul la retea, lucrarile la gata (montaj aparataj, corpuri de iluminat).",
    },
    supply: {
      system: "mono",
      voltageV: 230,
      mainBreakerA: tracked<number>(null, "beneficiar"),
      approvedPowerKW: tracked<number>(null, "beneficiar"),
      cosPhi: 0.95,
      earthing: "necunoscut",
      earthResistanceOhm: tracked<number>(null, "masurat"),
      notes: "",
    },
    counters: {},
    buildings: [],
    levels: [],
    rooms: [],
    boxes: [],
    devices: [],
    circuits: [],
    routes: [],
    cables: [],
    panels: [],
    globalSimultaneity: tracked<number>(null, "estimat"),
    quote: { includeMaterials: false, laborDiscountPct: 0, materialsDiscountPct: 0, validityDays: 30, projectFactorIds: [] },
    operationOverrides: [],
    extraCosts: [],
    team: { electricians: 1, helpers: 0, helperEfficiency: 0.5, hoursPerDay: 8, workDaysPerWeek: 5, startDate: null },
    planOverrides: [],
    measurements: [],
    register: [],
    library: structuredClone(library),
    libraryAppliedAt: now,
    issued: [],
    history: [{ at: now, action: "creare", detail: "Proiect creat" }],
  };
}

export function newBuilding(p: Project, name: string, kind: BuildingKind): Building {
  return { id: uid(), code: takeCode(p.counters, "CL"), name, kind, notes: "" };
}

export function newLevel(p: Project, buildingId: string, name: string, elevation: number): Level {
  const order = p.levels.filter((l) => l.buildingId === buildingId).length;
  return { id: uid(), code: takeCode(p.counters, "NV"), buildingId, name, elevation, order, notes: "" };
}

export function newRoom(p: Project, levelId: string, name: string, roomTypeId: string | null, l: number | null, w: number | null, h: number | null): Room {
  const rt = roomTypeId ? p.library.roomTypes.find((r) => r.id === roomTypeId) : undefined;
  return {
    id: uid(),
    code: takeCode(p.counters, "IN"),
    levelId,
    name,
    roomTypeId,
    lengthM: tracked(l),
    widthM: tracked(w),
    heightM: tracked(h ?? rt?.defaultHeightM ?? null),
    areaOverrideM2: null,
    perimeterOverrideM: null,
    wallTypeId: p.library.wallTypes[0]?.id ?? null,
    renovation: false,
    difficultyFactorIds: [],
    doors: 1,
    windows: 0,
    mountingHeights: { socketCm: 30, switchCm: 110, lightingCm: null },
    finishNotes: "",
    notes: "",
  };
}

/** aplica un sablon de cladire pe un proiect gol (mutabil) */
export function applyTemplate(p: Project, tpl: ProjectTemplate): Project {
  p.info.kind = tpl.kind;
  const b = newBuilding(p, tpl.kind === "apartament" ? "Apartament" : "Cladire principala", tpl.kind);
  p.buildings.push(b);
  for (const lv of tpl.levels) {
    const level = newLevel(p, b.id, lv.name, lv.elevation);
    p.levels.push(level);
    for (const r of lv.rooms) p.rooms.push(newRoom(p, level.id, r.name, r.roomTypeId, r.l, r.w, r.h));
  }
  p.history.push({ at: nowISO(), action: "sablon", detail: `Aplicat sablon: ${tpl.name}` });
  return p;
}

/* ---------------------- etapa 2: instalatie ------------------------ */


export function newBox(p: Project, kind: BoxKind, roomId: string, boxTypeId: string | null): Box {
  const bt = boxTypeId ? p.library.boxTypes.find((b) => b.id === boxTypeId) : undefined;
  return {
    id: uid(),
    code: takeCode(p.counters, kind),
    kind,
    roomId,
    boxTypeId,
    modules: bt?.modules ?? (kind === "DA" ? 2 : 0),
    position: "",
    heightCm: null,
    status: "estimat",
    notes: "",
  };
}

export function newDevice(p: Project, roomId: string, deviceTypeId: string | null, category?: DeviceCategory, boxId: string | null = null): Device {
  const dt = deviceTypeId ? p.library.deviceTypes.find((d) => d.id === deviceTypeId) : undefined;
  const cat = category ?? dt?.category ?? "altul";
  return {
    id: uid(),
    code: takeCode(p.counters, cat === "iluminat" ? "IL" : "AP"),
    deviceTypeId,
    category: cat,
    roomId,
    boxId,
    label: dt?.name ?? "",
    modules: dt?.modules ?? 1,
    // puterea sugerata se preia doar daca exista in biblioteca; altfel ramane necunoscuta
    powerW: tracked(cat === "curenti_slabi" || cat === "intrerupator" ? null : (dt?.suggestedPowerW ?? null), "estimat"),
    threePhase: dt?.threePhase ?? false,
    circuitId: null,
    circuitLocked: false,
    lightingTopology: "direct",
    controlledByIds: [],
    junctionBoxId: null,
    status: "estimat",
    notes: "",
  };
}

export function newCircuit(p: Project, name: string, usage: CircuitUsage, circuitTypeId: string | null, autoGenerated = false): Circuit {
  const ct = circuitTypeId ? p.library.circuitTypes.find((c) => c.id === circuitTypeId) : undefined;
  const cable = ct?.defaultCableTypeId ?? null;
  const pd = ct?.defaultRatingA
    ? p.library.protectionDevices.find((d) => d.kind === "MCB" && d.ratingA === ct.defaultRatingA && d.curve === (ct.defaultCurve ?? "C") && d.poles === "1P+N")
    : undefined;
  return {
    id: uid(),
    code: takeCode(p.counters, "CI"),
    name,
    circuitTypeId,
    usage,
    panelId: p.panels[0]?.id ?? null,
    phase: p.supply.system === "mono" ? "L1" : null,
    cableTypeId: cable,
    installMethodId: ct?.defaultInstallMethodId ?? null,
    protection: { protectionDeviceId: pd?.id ?? null, ratingA: ct?.defaultRatingA ?? null, curve: ct?.defaultCurve ?? null, poles: "1P+N", rcdItemId: null },
    simultaneity: tracked(ct?.defaultSimultaneity ?? null, "estimat"),
    estimatedLengthM: tracked<number>(null, "estimat"),
    ambientTempC: 30,
    groupedCircuits: 1,
    autoGenerated,
    lockedFields: [],
    order: p.circuits.length,
    status: "estimat",
    notes: "",
  };
}

export function newSegment(fromLabel = "", toLabel = "", lengthM: number | null = null): RouteSegment {
  return {
    id: uid(),
    from: { kind: "free", refId: null, label: fromLabel },
    to: { kind: "free", refId: null, label: toLabel },
    lengthM: tracked(lengthM, "estimat"),
    wallTypeId: null,
    notes: "",
  };
}

export function newConduit(p: Project, conduitTypeId: string | null, circuitIds: string[] = []): Conduit {
  return { id: uid(), code: takeCode(p.counters, "CP"), conduitTypeId, lengthOverrideM: null, circuitIds };
}

export function newRoute(p: Project, name: string, roomIds: string[]): Route {
  return {
    id: uid(),
    code: takeCode(p.counters, "TR"),
    name,
    roomIds,
    surface: "perete",
    requiresChase: true,
    wallTypeId: null,
    segments: [],
    conduits: [],
    parentRouteId: null,
    status: "estimat",
    notes: "",
  };
}

export function newCable(p: Project, circuitId: string, cableTypeId: string | null, routeIds: string[], reserveM: number): Cable {
  return { id: uid(), code: takeCode(p.counters, "CB"), circuitId, cableTypeId, routeIds, reserveM, lengthOverrideM: null, notes: "" };
}

/* ---------------------- stergeri cu curatarea referintelor ---------- */

export function removeDevices(p: Project, ids: string[]) {
  const set = new Set(ids);
  p.devices = p.devices.filter((d) => !set.has(d.id));
  for (const d of p.devices) d.controlledByIds = d.controlledByIds.filter((x) => !set.has(x));
}

/** sterge doza; aparatele din doza se sterg impreuna cu ea */
export function removeBox(p: Project, boxId: string) {
  removeDevices(p, p.devices.filter((d) => d.boxId === boxId).map((d) => d.id));
  p.boxes = p.boxes.filter((b) => b.id !== boxId);
  for (const d of p.devices) if (d.junctionBoxId === boxId) d.junctionBoxId = null;
  for (const r of p.routes)
    for (const s of r.segments) {
      if (s.from.kind === "box" && s.from.refId === boxId) s.from = { kind: "free", refId: null, label: s.from.label };
      if (s.to.kind === "box" && s.to.refId === boxId) s.to = { kind: "free", refId: null, label: s.to.label };
    }
}

/** sterge circuitul; punctele raman neasociate */
export function removeCircuit(p: Project, circuitId: string) {
  p.circuits = p.circuits.filter((c) => c.id !== circuitId);
  for (const d of p.devices)
    if (d.circuitId === circuitId) {
      d.circuitId = null;
      d.circuitLocked = false;
    }
  for (const r of p.routes) for (const cd of r.conduits) cd.circuitIds = cd.circuitIds.filter((x) => x !== circuitId);
  p.cables = p.cables.filter((c) => c.circuitId !== circuitId);
}
