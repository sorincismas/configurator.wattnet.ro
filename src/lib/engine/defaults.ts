import { emptyPoints } from "./inventory";
import type {
  Level,
  LevelKind,
  Panel,
  PanelDevice,
  PricingSettings,
  Project,
  Room,
} from "./types";

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function newRoom(name = "Incapere noua"): Room {
  return { id: uid(), name, points: emptyPoints(), ledStripM: 0 };
}

export function newLevel(kind: LevelKind = "parter", name?: string): Level {
  const names: Record<LevelKind, string> = {
    subsol: "Subsol",
    demisol: "Demisol",
    parter: "Parter",
    etaj: "Etaj",
    mansarda: "Mansarda",
    anexa: "Anexa",
  };
  return { id: uid(), name: name ?? names[kind], kind, rooms: [] };
}

export function newPanel(name = "Tablou principal", parentPanelId?: string): Panel {
  return {
    id: uid(),
    name,
    parentPanelId,
    rows: 2,
    modulesPerRow: 18,
    devices: [],
  };
}

export function newDevice(partial: Partial<PanelDevice> = {}): PanelDevice {
  return {
    id: uid(),
    kind: "MCB",
    label: "",
    poles: 1,
    modules: 1,
    row: 0,
    ...partial,
  };
}

export function newProject(seq = 1): Project {
  const now = new Date().toISOString();
  const year = new Date().getFullYear();
  return {
    schemaVersion: 1,
    id: uid(),
    code: `WN-${year}-${String(seq).padStart(3, "0")}`,
    name: "Proiect nou",
    client: { name: "" },
    buildingType: "casa",
    supply: "necunoscut",
    stage: "la-rosu",
    levels: [newLevel("parter")],
    panels: [newPanel()],
    trips: 1,
    discountPct: 0,
    vatPct: 21,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Catalogul implicit de operatiuni pentru faza „la rosu".
 * Tarifele si timpii sunt LASATI GOI intentionat: se completeaza de electrician
 * din experienta proprie si se calibreaza pe lucrarile reale.
 */
export function defaultPricing(): PricingSettings {
  const op = (
    id: string,
    name: string,
    unit: string,
    stage: PricingSettings["operations"][number]["stage"],
    quantity: PricingSettings["operations"][number]["quantity"],
  ) => ({ id, name, unit, stage, quantity, unitPrice: null, minutesPerUnit: null, enabled: true });

  return {
    hourlyRate: null,
    defaultRouteMPerPoint: 6,
    operations: [
      op("trasare", "Trasare puncte electrice", "punct", "trasare", { kind: "pointsTotal" }),
      op("doza-priza", "Montaj doza priza", "buc", "doze", { kind: "points", point: "priza" }),
      op("doza-intrerupator", "Montaj doza intrerupator", "buc", "doze", { kind: "points", point: "intrerupator" }),
      op("doza-iluminat", "Montaj doza / punct iluminat", "buc", "doze", { kind: "points", point: "iluminat" }),
      op("doza-dedicat", "Montaj doza consumator dedicat", "buc", "doze", { kind: "points", point: "dedicat" }),
      op("doza-jonctiune", "Montaj doza de legatura", "buc", "doze", { kind: "points", point: "jonctiune" }),
      op("slituire", "Executie traseu (slituire / canal)", "m", "trasee", { kind: "routeM" }),
      op("pozare", "Pozare tub si cablu", "m", "trasee", { kind: "routeM" }),
      op("led", "Traseu alimentare banda LED", "m", "trasee", { kind: "ledStripM" }),
      op("alimentare-secundar", "Cablu alimentare tablou secundar", "m", "trasee", { kind: "feederM" }),
      op("montaj-tablou", "Montaj cutie tablou", "buc", "tablouri", { kind: "panels" }),
      op("aparat-modular", "Montaj aparat modular", "buc", "conexiuni", { kind: "devices" }),
      op("conexiuni-tablou", "Conexiuni in tablou", "modul", "conexiuni", { kind: "deviceModules" }),
      op("etichetare", "Etichetare tablou si circuite", "tablou", "verificari", { kind: "panels" }),
      op("verificari", "Verificari si masuratori", "tablou", "verificari", { kind: "panels" }),
      op("deplasare", "Deplasare", "deplasare", "logistica", { kind: "trips" }),
    ],
  };
}

/** Proiect demonstrativ — doar cantitati, fara preturi. */
export function demoProject(): Project {
  const p = newProject(1);
  p.name = "Casa P+E — exemplu";
  p.client = { name: "Client demonstrativ", locality: "Sibiu" };
  p.supply = "monofazat";

  const room = (name: string, pts: Partial<Room["points"]>, extra: Partial<Room> = {}): Room => ({
    ...newRoom(name),
    points: { ...emptyPoints(), ...pts },
    ...extra,
  });

  const parter = newLevel("parter");
  parter.rooms = [
    room("Living", { priza: 8, intrerupator: 3, iluminat: 4, jonctiune: 2 }, { ledStripM: 6 }),
    room("Bucatarie", { priza: 7, intrerupator: 1, iluminat: 2, dedicat: 3, jonctiune: 1 }, {
      routeM: { value: 42, source: "masurat" },
    }),
    room("Hol", { priza: 2, intrerupator: 3, iluminat: 2, jonctiune: 1 }),
    room("Baie parter", { priza: 2, intrerupator: 1, iluminat: 2, dedicat: 1, jonctiune: 1 }),
  ];
  const etaj = newLevel("etaj");
  etaj.rooms = [
    room("Dormitor 1", { priza: 5, intrerupator: 2, iluminat: 1, jonctiune: 1 }),
    room("Dormitor 2", { priza: 5, intrerupator: 2, iluminat: 1, jonctiune: 1 }),
    room("Baie etaj", { priza: 2, intrerupator: 1, iluminat: 2, dedicat: 1, jonctiune: 1 }),
  ];
  const garaj = newLevel("anexa", "Garaj");
  garaj.rooms = [room("Garaj", { priza: 4, intrerupator: 1, iluminat: 2, dedicat: 1 })];

  const tp = newPanel("Tablou principal");
  tp.rows = 3;
  tp.devices = [
    newDevice({ kind: "separator", label: "General", poles: 2, modules: 2, row: 0 }),
    newDevice({ kind: "SPD", label: "Supratensiuni", poles: 2, modules: 2, row: 0 }),
    newDevice({ kind: "RCD", label: "Diferential prize", poles: 2, modules: 2, row: 0 }),
    newDevice({ kind: "MCB", label: "Prize living", row: 0 }),
    newDevice({ kind: "MCB", label: "Prize bucatarie", row: 0 }),
    newDevice({ kind: "MCB", label: "Plita", poles: 2, modules: 2, row: 1 }),
    newDevice({ kind: "MCB", label: "Cuptor", row: 1 }),
    newDevice({ kind: "MCB", label: "Iluminat parter", row: 1 }),
    newDevice({ kind: "MCB", label: "Alimentare TE etaj", poles: 2, modules: 2, row: 2 }),
    newDevice({ kind: "MCB", label: "Alimentare TG garaj", poles: 2, modules: 2, row: 2 }),
  ];
  const te = newPanel("Tablou etaj", tp.id);
  te.rows = 1;
  te.modulesPerRow = 12;
  te.feederM = { value: 14, source: "estimat" };
  te.devices = [
    newDevice({ kind: "RCD", label: "Diferential etaj", poles: 2, modules: 2 }),
    newDevice({ kind: "MCB", label: "Prize dormitoare" }),
    newDevice({ kind: "MCB", label: "Iluminat etaj" }),
    newDevice({ kind: "MCB", label: "Baie etaj" }),
  ];
  const tg = newPanel("Tablou garaj", tp.id);
  tg.rows = 1;
  tg.modulesPerRow = 8;
  tg.devices = [
    newDevice({ kind: "RCBO", label: "Prize garaj", poles: 2, modules: 2 }),
    newDevice({ kind: "MCB", label: "Iluminat garaj" }),
  ];

  parter.panelId = tp.id;
  etaj.panelId = te.id;
  garaj.panelId = tg.id;
  p.levels = [parter, etaj, garaj];
  p.panels = [tp, te, tg];
  p.trips = 4;
  return p;
}
