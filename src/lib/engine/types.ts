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
  "jonctiune",
  "termostat",
  "alteSurse",
] as const;
export type PointKind = (typeof POINT_KINDS)[number];

export const POINT_LABELS: Record<PointKind, string> = {
  priza: "Doze prize",
  intrerupator: "Doze intrerupatoare",
  iluminat: "Doze/puncte iluminat",
  jonctiune: "Doze de legatura",
  termostat: "Doze termostat",
  alteSurse: "Alte surse (cablu lasat)",
};

export type PointCounts = Record<PointKind, number>;

/** Tipul peretelui in care se monteaza dozele (influenteaza manopera). */
export const WALL_TYPES = ["zidarie", "gips-carton", "beton"] as const;
export type WallType = (typeof WALL_TYPES)[number];
export const WALL_LABELS: Record<WallType, string> = {
  zidarie: "Zidarie",
  "gips-carton": "Gips-carton",
  beton: "Beton",
};

/** Marimea dozei. „fara" = iesire de cablu fara doza (ex. plita). */
export const BOX_SIZES = ["simpla", "dubla", "tripla", "mare", "fara"] as const;
export type BoxSize = (typeof BOX_SIZES)[number];
export const BOX_SIZE_LABELS: Record<BoxSize, string> = {
  simpla: "Simpla",
  dubla: "Dubla",
  tripla: "Tripla",
  mare: "Mare / ramificatie",
  fara: "Fara doza",
};
export const DEFAULT_BOX_SIZE: Record<PointKind, BoxSize> = {
  priza: "simpla",
  intrerupator: "simpla",
  iluminat: "simpla",
  jonctiune: "mare",
  termostat: "simpla",
  alteSurse: "fara",
};

/** Unde se termina un circuit dedicat (ce doza din incapere alimenteaza). */
export type DedicatedEndpoint = "priza" | "alteSurse" | "jonctiune";

/** Circuit dedicat dintr-o incapere (ex. priza frigider, plita). Nu se numara ca doza. */
export type DedicatedCircuit = {
  id: string;
  name: string;
  endpoint: DedicatedEndpoint;
  ratedA?: number;
  curve?: Curve;
  poles?: 1 | 2 | 3 | 4;
  sectionMm2?: number;
  powerKw?: number;
};

export type Room = {
  id: string;
  name: string;
  /** Numarul de doze, pe tipuri. */
  points: PointCounts;
  /** Tipul peretelui (implicit zidarie). */
  wall?: WallType;
  /** Marimea dozei pe tip de doza (implicit DEFAULT_BOX_SIZE). */
  boxSizes?: Partial<Record<PointKind, BoxSize>>;
  /** Circuitele dedicate care ajung in incapere. */
  dedicated?: DedicatedCircuit[];
  /** @deprecated banda LED nu se mai foloseste; pastrat pentru proiectele vechi. */
  ledStripM?: number;
  /**
   * Lungimea traseelor din incapere (tub/cablu pana la doze).
   * Daca lipseste, motorul foloseste o estimare din setari si o marcheaza ca estimare.
   */
  routeM?: MeasuredValue;
  notes?: string;
  /** Cod scurt al incaperii (ex. „P01"), folosit in codurile de circuit. Gol = generat automat. */
  code?: string;
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
  /** Curent nominal In, in amperi. */
  ratedA?: number;
  /** Curba de declansare (MCB/RCBO). */
  curve?: Curve;
  /** Curent diferential IΔn, in mA (RCD/RCBO). */
  sensitivityMa?: number;
  /** Tipul diferentialului (RCD/RCBO). */
  rcdType?: RcdType;
  /** Circuitul generat pe care il protejeaza aparatul. */
  circuitId?: string;
  /** Diferentialul sub care este montat aparatul (pentru schema monofilara). */
  upstreamRcdId?: string;
  /** Tabloul secundar alimentat din acest aparat. */
  feedsPanelId?: string;
  /** Aparatul general (de intrare) al tabloului. */
  isMain?: boolean;
};

export type Curve = "B" | "C" | "D";
export type RcdType = "AC" | "A" | "F" | "B";

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
  /** Siguranta generala a bransamentului, in amperi. */
  mainBreakerA?: number;
  /** Factorul de putere folosit la calculul puterii maxime absorbite (implicit 1). */
  cosPhi?: number;
  /** Modificarile facute de electrician peste circuitele generate, dupa id-ul circuitului. */
  circuitOverrides?: Record<string, CircuitOverride>;
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
  /** Doze dupa marime (si optional dupa tipul peretelui). */
  | { kind: "boxes"; size: BoxSize; wall?: WallType }
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
  /** Versiunea catalogului de operatiuni (pentru migrarea setarilor salvate). */
  catalogVersion?: number;
  /** Limite si constante de proiectare (setabile). Lipsa = valorile implicite. */
  rules?: Partial<RuleSettings>;
};

/* ------------------------------------------------------------------ */
/* Circuite si reguli de proiectare                                    */
/* ------------------------------------------------------------------ */

export const CIRCUIT_KINDS = ["iluminat", "prize", "dedicat"] as const;
export type CircuitKind = (typeof CIRCUIT_KINDS)[number];

export const CIRCUIT_KIND_LABELS: Record<CircuitKind, string> = {
  iluminat: "Iluminat",
  prize: "Prize",
  dedicat: "Circuit dedicat",
};

export type CircuitDefaults = {
  ratedA: number;
  curve: Curve;
  sectionMm2: number;
  /** Putere instalata estimata: kW per punct (la dedicat: kW per circuit). */
  powerPerUnitKw: number;
};

export type IzRow = { sectionMm2: number; mono: number; tri: number };

export type RuleSettings = {
  maxSocketsPerCircuit: number;
  maxLightPointsPerCircuit: number;
  lightingGrouping: "incapere" | "nivel";
  defaults: Record<CircuitKind, CircuitDefaults>;
  /** Curenti admisibili Iz (Cu/PVC in tub): 2 conductoare incarcate la mono, 3 la tri. */
  iz: IzRow[];
  /** Rezistivitatea conductorului cald, Ω·mm²/m. */
  rho: number;
  maxDropLightingPct: number;
  maxDropOtherPct: number;
  /** Raport minim In amonte / In aval pentru selectivitate amperica orientativa. */
  selectivityRatio: number;
  /** Sub acest raport Pmax / Pinstalat se semnaleaza simultaneitatea. */
  minSimultaneity: number;
};

/** Modificari manuale peste un circuit generat. */
export type CircuitOverride = {
  name?: string;
  ratedA?: number;
  curve?: Curve;
  poles?: 1 | 2 | 3 | 4;
  sectionMm2?: number;
  lengthM?: number;
  powerKw?: number;
  panelId?: string;
  /** Comaseaza circuitul in alt circuit (acelasi aparat de protectie). */
  mergeInto?: string;
};

/* ------------------------------------------------------------------ */
/* Rezultate                                                           */
/* ------------------------------------------------------------------ */

export type CheckStatus = "conform" | "neconform" | "nedeterminat";

export type CheckCategory = "date" | "circuite" | "tablouri" | "selectivitate";

export type CheckResult = {
  id: string;
  category?: CheckCategory;
  ruleId: string;
  status: CheckStatus;
  title: string;
  message: string;
  /** Referinta normativa, doar cand regula a fost verificata pe text. */
  reference?: string;
  target?: string;
};
