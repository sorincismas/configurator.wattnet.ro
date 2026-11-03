/**
 * Modelul de date al configuratorului WATTNET — faza 1 („la rosu").
 *
 * Regula de baza: o singura configuratie de proiect din care deriva
 * inventarul, tabloul, devizul, planul de executie si verificarile.
 * Motorul (src/lib/engine) nu depinde de React si se testeaza separat.
 */

/** Sursa unei valori: introdusa/masurata de electrician sau estimata. */
export type ValueSource = "masurat" | "estimat";

export type MeasuredValue = {
  value: number;
  source: ValueSource;
};

export type LevelKind = "subsol" | "demisol" | "parter" | "etaj" | "mansarda" | "anexa";

/** Tipurile de doze/puncte din faza „la rosu". */
export const POINT_KINDS = [
  "priza",
  "intrerupator",
  "iluminat",
  "dedicat",
  "jonctiune",
] as const;
export type PointKind = (typeof POINT_KINDS)[number];

export const POINT_LABELS: Record<PointKind, string> = {
  priza: "Doze prize",
  intrerupator: "Doze intrerupatoare",
  iluminat: "Doze/puncte iluminat",
  dedicat: "Doze consumatori dedicati",
  jonctiune: "Doze de legatura",
};

export type PointCounts = Record<PointKind, number>;

export type Room = {
  id: string;
  name: string;
  points: PointCounts;
  /** Metri de banda LED (traseu de alimentare), daca exista. */
  ledStripM: number;
  /**
   * Lungimea traseelor din incapere (tub/cablu pana la doze).
   * Daca lipseste, motorul foloseste o estimare din setari si o marcheaza ca estimare.
   */
  routeM?: MeasuredValue;
  notes?: string;
};

export type Level = {
  id: string;
  name: string;
  kind: LevelKind;
  rooms: Room[];
  /** Tabloul care alimenteaza nivelul (optional in faza 1). */
  panelId?: string;
};

export type DeviceKind =
  | "MCB"
  | "RCD"
  | "RCBO"
  | "SPD"
  | "separator"
  | "releu"
  | "contactor"
  | "sonerie-sursa"
  | "altul";

export const DEVICE_LABELS: Record<DeviceKind, string> = {
  MCB: "Disjunctor (MCB)",
  RCD: "Diferential (RCD)",
  RCBO: "Disjunctor diferential (RCBO)",
  SPD: "Desc. supratensiune (SPD)",
  separator: "Separator / intrerupator general",
  releu: "Releu",
  contactor: "Contactor",
  "sonerie-sursa": "Sursa / sonerie",
  altul: "Alt aparat",
};

export type PanelDevice = {
  id: string;
  kind: DeviceKind;
  /** Eticheta circuitului / functia, ex. „Prize bucatarie". */
  label: string;
  poles: 1 | 2 | 3 | 4;
  /** Latimea in module DIN (18 mm). */
  modules: number;
  /** Caracteristici nominale, text liber (ex. „C16", „40A 30mA tip A"). Nu se deduc automat. */
  rating?: string;
  /** Randul (sina DIN) pe care e montat, de la 0. */
  row: number;
};

export type Panel = {
  id: string;
  name: string;
  /** Tabloul din care este alimentat (cascada). Lipsa = tablou principal. */
  parentPanelId?: string;
  /** Locatia, ex. nivelul sau anexa. */
  levelId?: string;
  rows: number;
  modulesPerRow: number;
  /** Lungimea cablului de alimentare din tabloul parinte. */
  feederM?: MeasuredValue;
  devices: PanelDevice[];
};

export type SupplyType = "monofazat" | "trifazat" | "necunoscut";
export type BuildingType = "casa" | "apartament" | "comercial";

export type Client = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  locality?: string;
};

export type Project = {
  schemaVersion: 1;
  id: string;
  code: string;
  name: string;
  client: Client;
  buildingType: BuildingType;
  supply: SupplyType;
  /** Faza 1 = „la rosu"; faza 2 „la gata" va fi adaugata ulterior. */
  stage: "la-rosu";
  levels: Level[];
  panels: Panel[];
  /** Numar de deplasari estimate. */
  trips: number;
  discountPct: number;
  vatPct: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

/* ------------------------------------------------------------------ */
/* Catalogul de manopera                                               */
/* ------------------------------------------------------------------ */

/** De unde isi ia o operatiune cantitatea. Cantitatile vin din configuratie, nu se introduc in deviz. */
export type QuantitySource =
  | { kind: "points"; point: PointKind }
  | { kind: "pointsTotal" }
  | { kind: "routeM" }
  | { kind: "ledStripM" }
  | { kind: "panels" }
  | { kind: "secondaryPanels" }
  | { kind: "feederM" }
  | { kind: "devices" }
  | { kind: "deviceModules" }
  | { kind: "trips" }
  | { kind: "fixed"; quantity: number };

export type ExecutionStage =
  | "trasare"
  | "doze"
  | "trasee"
  | "tablouri"
  | "conexiuni"
  | "verificari"
  | "logistica";

export const STAGE_LABELS: Record<ExecutionStage, string> = {
  trasare: "1. Trasare",
  doze: "2. Montaj doze",
  trasee: "3. Trasee, tuburi si cabluri",
  tablouri: "4. Montaj tablouri",
  conexiuni: "5. Echipare si conexiuni tablouri",
  verificari: "6. Etichetare si verificari",
  logistica: "Logistica",
};

export const STAGE_ORDER: ExecutionStage[] = [
  "trasare",
  "doze",
  "trasee",
  "tablouri",
  "conexiuni",
  "verificari",
  "logistica",
];

export type LaborOperation = {
  id: string;
  name: string;
  unit: string;
  stage: ExecutionStage;
  quantity: QuantitySource;
  /** Tarif unitar (lei/unitate, fara TVA). Are prioritate fata de timp × tarif orar. */
  unitPrice?: number | null;
  /** Timp standard (minute/unitate), pentru planificare si pentru calculul cu tarif orar. */
  minutesPerUnit?: number | null;
  enabled: boolean;
};

export type PricingSettings = {
  /** Tarif orar (lei/ora, fara TVA). */
  hourlyRate?: number | null;
  /** Metri de traseu estimati per doza, cand traseul nu e masurat. */
  defaultRouteMPerPoint: number;
  operations: LaborOperation[];
};

/* ------------------------------------------------------------------ */
/* Rezultate                                                           */
/* ------------------------------------------------------------------ */

export type CheckStatus = "conform" | "neconform" | "nedeterminat";

export type CheckResult = {
  id: string;
  ruleId: string;
  status: CheckStatus;
  title: string;
  message: string;
  /** Referinta normativa, doar cand regula a fost verificata pe text. */
  reference?: string;
  target?: string;
};
