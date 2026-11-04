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
