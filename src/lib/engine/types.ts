/**
 * Modelul de date al configuratorului WATTNET — faza 1 („la roșu").
 *
 * Regula de bază: o singură configurație de proiect din care derivă
 * inventarul, tabloul, devizul, planul de execuție și verificările.
 * Motorul (src/lib/engine) nu depinde de React și se testează separat.
 */

/** Sursa unei valori: introdusă/măsurată de electrician sau estimată. */
export type ValueSource = "masurat" | "estimat";

export type MeasuredValue = {
  value: number;
  source: ValueSource;
};

export type LevelKind = "subsol" | "parter" | "etaj" | "mansarda" | "anexa";

/** Tipurile de doze/puncte din faza „la roșu". */
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
  intrerupator: "Doze întrerupătoare",
  iluminat: "Doze/puncte iluminat",
  dedicat: "Doze consumatori dedicați",
  jonctiune: "Doze de legătură",
};

export type PointCounts = Record<PointKind, number>;

export type Room = {
  id: string;
  name: string;
  points: PointCounts;
  /** Metri de bandă LED (traseu de alimentare), dacă există. */
  ledStripM: number;
  /**
   * Lungimea traseelor din încăpere (tub/cablu până la doze).
   * Dacă lipsește, motorul folosește o estimare din setări și o marchează ca estimare.
   */
  routeM?: MeasuredValue;
  notes?: string;
};

export type Level = {
  id: string;
  name: string;
  kind: LevelKind;
  rooms: Room[];
  /** Tabloul care alimentează nivelul (opțional în faza 1). */
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
  RCD: "Diferențial (RCD)",
  RCBO: "Disjunctor diferențial (RCBO)",
  SPD: "Desc. supratensiune (SPD)",
  separator: "Separator / întrerupător general",
  releu: "Releu",
  contactor: "Contactor",
  "sonerie-sursa": "Sursă / sonerie",
  altul: "Alt aparat",
};

export type PanelDevice = {
  id: string;
  kind: DeviceKind;
  /** Eticheta circuitului / funcția, ex. „Prize bucătărie". */
  label: string;
  poles: 1 | 2 | 3 | 4;
  /** Lățimea în module DIN (18 mm). */
  modules: number;
  /** Caracteristici nominale, text liber (ex. „C16", „40A 30mA tip A"). Nu se deduc automat. */
  rating?: string;
  /** Rândul (șina DIN) pe care e montat, de la 0. */
  row: number;
};

export type Panel = {
  id: string;
  name: string;
  /** Tabloul din care este alimentat (cascadă). Lipsă = tablou principal. */
  parentPanelId?: string;
  /** Locația, ex. nivelul sau anexa. */
  levelId?: string;
  rows: number;
  modulesPerRow: number;
  /** Lungimea cablului de alimentare din tabloul părinte. */
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
  /** Faza 1 = „la roșu"; faza 2 „la gata" va fi adăugată ulterior. */
  stage: "la-rosu";
  levels: Level[];
  panels: Panel[];
  /** Număr de deplasări estimate. */
  trips: number;
  discountPct: number;
  vatPct: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

/* ------------------------------------------------------------------ */
/* Catalogul de manoperă                                               */
/* ------------------------------------------------------------------ */

/** De unde își ia o operațiune cantitatea. Cantitățile vin din configurație, nu se introduc în deviz. */
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
  trasee: "3. Trasee, tuburi și cabluri",
  tablouri: "4. Montaj tablouri",
  conexiuni: "5. Echipare și conexiuni tablouri",
  verificari: "6. Etichetare și verificări",
  logistica: "Logistică",
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
  /** Tarif unitar (lei/unitate, fără TVA). Are prioritate față de timp × tarif orar. */
  unitPrice?: number | null;
  /** Timp standard (minute/unitate), pentru planificare și pentru calculul cu tarif orar. */
  minutesPerUnit?: number | null;
  enabled: boolean;
};

export type PricingSettings = {
  /** Tarif orar (lei/oră, fără TVA). */
  hourlyRate?: number | null;
  /** Metri de traseu estimați per doză, când traseul nu e măsurat. */
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
  /** Referința normativă, doar când regula a fost verificată pe text. */
  reference?: string;
  target?: string;
};
