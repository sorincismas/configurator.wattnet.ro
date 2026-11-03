import { addCircuitDevices, deriveCircuits } from "./circuits";
import { defaultRules } from "./electrical";
import { emptyPoints } from "./inventory";
import {
  BOX_SIZES,
  BOX_SIZE_LABELS,
  WALL_LABELS,
  WALL_TYPES,
  type BoxSize,
  type Curve,
  type DedicatedCircuit,
  type Level,
  type LevelKind,
  type Panel,
  type PanelDevice,
  type PricingSettings,
  type Project,
  type RcdType,
  type Room,
} from "./types";

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function newRoom(name = "Incapere noua"): Room {
  return { id: uid(), name, points: emptyPoints(), wall: "zidarie" };
}

export function newDedicated(partial: Partial<DedicatedCircuit> = {}): DedicatedCircuit {
  return { id: uid(), name: "", endpoint: "priza", ...partial };
}

/** Versiunea curenta a catalogului de operatiuni. */
export const CATALOG_VERSION = 2;

/** Operatiuni din catalogul vechi, inlocuite in versiunea 2 (doze pe perete si marime; fara LED). */
export const OBSOLETE_OPERATIONS = ["doza-priza", "doza-intrerupator", "doza-iluminat", "doza-dedicat", "doza-jonctiune", "led"];

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

  const boxOps = WALL_TYPES.flatMap((wall) =>
    BOX_SIZES.filter((s): s is Exclude<BoxSize, "fara"> => s !== "fara").map((size) =>
      op(
        `doza-${wall}-${size}`,
        `Montaj doza ${BOX_SIZE_LABELS[size].toLowerCase()} in ${WALL_LABELS[wall].toLowerCase()}`,
        "buc",
        "doze",
        { kind: "boxes", size, wall },
      ),
    ),
  );

  return {
    hourlyRate: null,
    defaultRouteMPerPoint: 6,
    catalogVersion: CATALOG_VERSION,
    operations: [
      op("trasare", "Trasare puncte electrice", "punct", "trasare", { kind: "pointsTotal" }),
      ...boxOps,
      op("iesire-cablu", "Iesire de cablu fara doza (alte surse)", "buc", "doze", { kind: "boxes", size: "fara" }),
      op("slituire", "Executie traseu (slituire / canal)", "m", "trasee", { kind: "routeM" }),
      op("pozare", "Pozare tub si cablu", "m", "trasee", { kind: "routeM" }),
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
    room("Living", { priza: 8, intrerupator: 3, iluminat: 4, jonctiune: 2, termostat: 1 }, {
      boxSizes: { intrerupator: "dubla" },
    }),
    room("Bucatarie", { priza: 9, intrerupator: 1, iluminat: 2, jonctiune: 1, alteSurse: 1 }, {
      routeM: { value: 42, source: "masurat" },
      dedicated: [
        newDedicated({ name: "Plita", endpoint: "alteSurse", ratedA: 32, curve: "C", sectionMm2: 6, powerKw: 7 }),
        newDedicated({ name: "Cuptor", endpoint: "priza", powerKw: 3 }),
        newDedicated({ name: "Masina de spalat vase", endpoint: "priza", powerKw: 2.2 }),
      ],
    }),
    room("Hol", { priza: 2, intrerupator: 3, iluminat: 2, jonctiune: 1 }),
    room("Baie parter", { priza: 3, intrerupator: 1, iluminat: 2, jonctiune: 1 }, {
      wall: "gips-carton",
      dedicated: [newDedicated({ name: "Boiler", endpoint: "priza", powerKw: 2 })],
    }),
  ];
  const etaj = newLevel("etaj");
  etaj.rooms = [
    room("Dormitor 1", { priza: 5, intrerupator: 2, iluminat: 1, jonctiune: 1, termostat: 1 }, { wall: "gips-carton" }),
    room("Dormitor 2", { priza: 5, intrerupator: 2, iluminat: 1, jonctiune: 1, termostat: 1 }, { wall: "gips-carton" }),
    room("Baie etaj", { priza: 3, intrerupator: 1, iluminat: 2, jonctiune: 1 }, {
      dedicated: [newDedicated({ name: "Masina de spalat", endpoint: "priza", powerKw: 2.2 })],
    }),
  ];
  const garaj = newLevel("anexa", "Garaj");
  garaj.rooms = [
    room("Garaj", { priza: 4, intrerupator: 1, iluminat: 2, alteSurse: 1 }, {
      wall: "beton",
      dedicated: [newDedicated({ name: "Motor usa garaj", endpoint: "alteSurse", powerKw: 0.5 })],
    }),
  ];

  const tp = newPanel("Tablou principal");
  tp.rows = 3;
  const te = newPanel("Tablou etaj", tp.id);
  te.rows = 1;
  te.modulesPerRow = 12;
  te.feederM = { value: 14, source: "estimat" };
  const tg = newPanel("Tablou garaj", tp.id);
  tg.rows = 1;
  tg.modulesPerRow = 8;

  tp.devices = [
    newDevice({ kind: "separator", label: "General", poles: 2, modules: 2, row: 0, ratedA: 40, isMain: true }),
    newDevice({ kind: "SPD", label: "Supratensiuni", poles: 2, modules: 2, row: 0 }),
    newDevice({ kind: "RCD", label: "Diferential prize", poles: 2, modules: 2, row: 0, ratedA: 40, sensitivityMa: 30, rcdType: "A" }),
    newDevice({ kind: "MCB", label: "Alimentare tablou etaj", poles: 2, modules: 2, row: 0, ratedA: 25, curve: "C", feedsPanelId: te.id }),
    newDevice({ kind: "MCB", label: "Alimentare tablou garaj", poles: 2, modules: 2, row: 0, ratedA: 20, curve: "C", feedsPanelId: tg.id }),
  ];
  te.devices = [
    newDevice({ kind: "separator", label: "General etaj", poles: 2, modules: 2, ratedA: 25, isMain: true }),
    newDevice({ kind: "RCD", label: "Diferential etaj", poles: 2, modules: 2, ratedA: 25, sensitivityMa: 30, rcdType: "A" }),
  ];
  tg.devices = [newDevice({ kind: "RCD", label: "Diferential garaj", poles: 2, modules: 2, ratedA: 25, sensitivityMa: 30, rcdType: "A" })];

  parter.panelId = tp.id;
  etaj.panelId = te.id;
  garaj.panelId = tg.id;
  p.levels = [parter, etaj, garaj];
  p.panels = [tp, te, tg];
  p.trips = 4;
  p.mainBreakerA = 40;
  p.cosPhi = 1;

  // aparatele de protectie pentru circuitele generate
  const circuits = deriveCircuits(p, defaultRules(), defaultPricing().defaultRouteMPerPoint);
  p.panels = p.panels.map((panel) =>
    addCircuitDevices(panel, circuits.filter((c) => c.panelId === panel.id)),
  );
  return p;
}

/* ------------------------------------------------------------------ */
/* Compatibilitate cu proiectele salvate                               */
/* ------------------------------------------------------------------ */

/**
 * Citeste valorile numerice din textul vechi de caracteristici:
 * „C16" → curba C, 16 A; „40A 30mA tip A" → 40 A, 30 mA, tip A.
 */
export function parseRating(text: string): Pick<PanelDevice, "ratedA" | "curve" | "sensitivityMa" | "rcdType"> {
  const t = text.trim();
  const out: Pick<PanelDevice, "ratedA" | "curve" | "sensitivityMa" | "rcdType"> = {};
  const curve = /\b([BCD])\s*(\d+(?:[.,]\d+)?)\b/i.exec(t);
  if (curve) {
    out.curve = curve[1].toUpperCase() as Curve;
    out.ratedA = Number(curve[2].replace(",", "."));
  } else {
    const a = /(\d+(?:[.,]\d+)?)\s*A(?!C)\b/i.exec(t.replace(/\d+\s*mA/gi, ""));
    if (a) out.ratedA = Number(a[1].replace(",", "."));
  }
  const ma = /(\d+)\s*mA/i.exec(t);
  if (ma) out.sensitivityMa = Number(ma[1]);
  const type = /tip\s*(AC|A|F|B)\b/i.exec(t);
  if (type) out.rcdType = type[1].toUpperCase() as RcdType;
  return out;
}

/** Completeaza campurile noi (optionale) pentru proiectele salvate cu versiunea anterioara. */
export function normalizeProject(p: Project): Project {
  return {
    ...p,
    levels: (p.levels ?? []).map((lvl) => ({ ...lvl, rooms: (lvl.rooms ?? []).map(normalizeRoom) })),
    panels: (p.panels ?? []).map((panel) => ({
      ...panel,
      devices: (panel.devices ?? []).map((d) =>
        d.ratedA == null && d.rating?.trim() ? { ...d, ...parseRating(d.rating) } : d,
      ),
    })),
  };
}

/**
 * Proiectele vechi aveau „dedicat" ca numar de doze. Acum este o lista de
 * circuite: fiecare doza dedicata devine un circuit dedicat care se termina
 * la o doza de priza (numarul de doze ramane acelasi). Id-urile 0, 1, ...
 * pastreaza modificarile facute deja pe circuitele generate.
 */
function normalizeRoom(r: Room): Room {
  const legacy = (r.points as Record<string, number | undefined>).dedicat;
  if (!legacy) return r;
  const n = Math.max(0, Math.floor(legacy));
  const { dedicat: _drop, ...rest } = r.points as Record<string, number>;
  void _drop;
  const points = { ...emptyPoints(), ...rest } as Room["points"];
  points.priza = (points.priza || 0) + n;
  const dedicated = r.dedicated?.length
    ? r.dedicated
    : Array.from({ length: n }, (_, i) => newDedicated({ id: String(i), name: `Circuit dedicat ${i + 1}`, endpoint: "priza" }));
  return { ...r, points, dedicated };
}
