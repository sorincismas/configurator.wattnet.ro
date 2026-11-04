/**
 * WATTNET - model de date
 * ------------------------------------------------------------------
 * Modelul este sursa unica de adevar. Tabloul, schema monofilara,
 * devizul, planul de executie si dosarul sunt REPREZENTARI ale
 * acestui model, nu documente independente.
 *
 * Reguli (specificatie v1.0):
 *  - fiecare element tehnic are un identificator intern (id) si un cod
 *    vizibil stabil (ex. DA001) care nu se reutilizeaza dupa stergere;
 *  - valorile relevante au provenienta si stare (estimat / masurat ...);
 *  - entitatile fizice (doza) sunt separate de cele functionale
 *    (aparat / consumator) si de circuite;
 *  - traseul fizic (sant) este separat de copex si de cabluri.
 */

export const SCHEMA_VERSION = 1;

export type ID = string;
export type ISODate = string;

/* ------------------------------------------------------------------ */
/* Provenienta si stare (cap. 14.1)                                     */
/* ------------------------------------------------------------------ */

export type Provenance =
  | "beneficiar" // cerinta beneficiar
  | "proiectant" // specificatie proiectant
  | "masurat" // masuratoare pe santier
  | "estimat" // estimare electrician
  | "regula" // derivat dintr-o regula tehnica
  | "calcul"; // calcul automat

export type DataStatus =
  | "confirmat"
  | "masurat"
  | "estimat"
  | "de_verificat"
  | "validat"
  | "nevalidat";

/** Valoare cu provenienta. `value === null` inseamna "necunoscut" (nu zero). */
export interface Tracked<T = number> {
  value: T | null;
  provenance?: Provenance;
  status?: DataStatus;
  note?: string;
}

/* ------------------------------------------------------------------ */
/* Identificatori vizibili (cap. 5.1)                                   */
/* ------------------------------------------------------------------ */

/** Prefixe confirmate + extensii (CL, NV, IN). Lista poate fi extinsa. */
export type CodePrefix =
  | "DA" // doza aparat
  | "DD" // doza derivatie
  | "CI" // circuit
  | "TA" // tablou
  | "TR" // traseu
  | "CB" // cablu
  | "CP" // copex / tub
  | "AP" // aparat (priza, intrerupator, echipament)
  | "IL" // punct de iluminat
  | "CL" // cladire (extensie)
  | "NV" // nivel (extensie)
  | "IN" // incapere (extensie)
  | "EM"; // element tablou: aparat modular (extensie)

/** Contoare per prefix. Cresc monoton; nu scad la stergere. */
export type CodeCounters = Partial<Record<CodePrefix, number>>;

/* ------------------------------------------------------------------ */
/* Proiect                                                              */
/* ------------------------------------------------------------------ */

export type BuildingKind =
  | "casa"
  | "apartament"
  | "bloc"
  | "spatiu_comun"
  | "anexa"
  | "altul";

export type WorkPhase = "rosu" | "gata";

export type ProjectStatus = "ciorna" | "ofertat" | "in_executie" | "finalizat" | "anulat";

export interface ClientInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export interface ProjectInfo {
  code: string; // ex. WN-2026-001
  name: string;
  kind: BuildingKind;
  customKind: string;
  location: string;
  client: ClientInfo;
  /** proiect partial: doar anumite categorii de lucrari */
  partial: boolean;
  partialScope: string;
  phases: WorkPhase[];
  status: ProjectStatus;
  designerNotes: string;
  /** ipoteze generale ale ofertei */
  assumptionsText: string;
  /** limite / excluderi oferta */
  exclusionsText: string;
}

/* ------------------------------------------------------------------ */
/* Alimentare (cap. 7.1)                                                */
/* ------------------------------------------------------------------ */

export type PhaseSystem = "mono" | "tri";
export type EarthingSystem = "TN-S" | "TN-C-S" | "TT" | "necunoscut";

export interface SupplyInfo {
  system: PhaseSystem;
  /** 230 V mono, 400 V intre faze la tri */
  voltageV: number;
  /** curentul nominal al protectiei generale / BMPT */
  mainBreakerA: Tracked<number>;
  /** puterea aprobata din ATR, daca e cunoscuta */
  approvedPowerKW: Tracked<number>;
  /** factor de putere folosit in calcule orientative */
  cosPhi: number;
  earthing: EarthingSystem;
  /** rezistenta prizei de pamant, daca a fost masurata */
  earthResistanceOhm: Tracked<number>;
  notes: string;
}

/* ------------------------------------------------------------------ */
/* Cladire / nivel / incapere (cap. 4)                                  */
/* ------------------------------------------------------------------ */

export interface Building {
  id: ID;
  code: string; // CL001
  name: string;
  kind: BuildingKind;
  notes: string;
}

export interface Level {
  id: ID;
  code: string; // NV001
  buildingId: ID;
  name: string; // Subsol, Parter, Etaj 1, Mansarda
  /** cota/indice: -1 subsol, 0 parter, 1 etaj ... */
  elevation: number;
  order: number;
  notes: string;
}

export interface MountingHeights {
  socketCm: number | null;
  switchCm: number | null;
  lightingCm: number | null;
}

export interface Room {
  id: ID;
  code: string; // IN001
  levelId: ID;
  name: string;
  roomTypeId: ID | null;
  lengthM: Tracked<number>;
  widthM: Tracked<number>;
  heightM: Tracked<number>;
  /** suprafata introdusa manual (camere neregulate); daca e null se calculeaza L x l */
  areaOverrideM2: number | null;
  /** perimetru introdus manual; daca e null se calculeaza 2(L+l) */
  perimeterOverrideM: number | null;
  wallTypeId: ID | null;
  renovation: boolean;
  /** factori de dificultate suplimentari aplicati incaperii */
  difficultyFactorIds: ID[];
  doors: number;
  windows: number;
  mountingHeights: MountingHeights;
  finishNotes: string;
  notes: string;
}

/* ------------------------------------------------------------------ */
/* Doze, aparate, consumatori (cap. 5.2, 6.4)                           */
/* ------------------------------------------------------------------ */

export type BoxKind = "DA" | "DD";

export interface Box {
  id: ID;
  code: string; // DA001 / DD001
  kind: BoxKind;
  roomId: ID;
  boxTypeId: ID | null;
  /** numar module pentru doze modulare (DA) */
  modules: number;
  /** pozitie descriptiva: perete N, langa usa ... */
  position: string;
  heightCm: number | null;
  status: DataStatus;
  notes: string;
}

export type DeviceCategory =
  | "priza"
  | "intrerupator"
  | "iluminat"
  | "consumator_dedicat"
  | "curenti_slabi" // RJ45, TV, alarma - fara putere 230V
  | "comanda" // senzori, termostate, butoane
  | "altul";

export type LightingTopology = "direct" | "prin_dd";

/**
 * Aparat / punct electric / consumator.
 * Puterea apartine aparatului/consumatorului, NU dozei.
 */
export interface Device {
  id: ID;
  code: string; // AP001 sau IL001
  deviceTypeId: ID | null;
  category: DeviceCategory;
  roomId: ID;
  /** doza in care este montat (DA); null pentru consumatori fara doza (ex. plita racordata direct) */
  boxId: ID | null;
  label: string;
  /** numar de module ocupate in doza */
  modules: number;
  /** putere nominala introdusa manual (W). null = necunoscut */
  powerW: Tracked<number>;
  /** consumatorul este trifazat */
  threePhase: boolean;
  circuitId: ID | null;
  /** pentru iluminat: varianta de topologie */
  lightingTopology: LightingTopology;
  /** intrerupatoarele (Device id) care comanda acest punct de iluminat */
  controlledByIds: ID[];
  status: DataStatus;
  notes: string;
}

/* ------------------------------------------------------------------ */
/* Circuite (cap. 6.1, 7.3)                                             */
/* ------------------------------------------------------------------ */

export type CircuitUsage = "iluminat" | "prize" | "dedicat" | "curenti_slabi" | "feeder" | "altul";
export type PhaseAssign = "L1" | "L2" | "L3" | "L123";

export interface CircuitProtection {
  /** aparatul din catalogul de protectii */
  protectionDeviceId: ID | null;
  ratingA: number | null;
  curve: "B" | "C" | "D" | null;
  poles: string | null; // "1P+N", "3P+N" ...
  /** RCD/RCBO amonte (element tablou id) */
  rcdItemId: ID | null;
}

export interface Circuit {
  id: ID;
  code: string; // CI001
  name: string;
  circuitTypeId: ID | null;
  usage: CircuitUsage;
  panelId: ID | null;
  phase: PhaseAssign | null;
  cableTypeId: ID | null;
  installMethodId: ID | null;
  protection: CircuitProtection;
  /** coeficient de simultaneitate al circuitului (0..1), editabil */
  simultaneity: Tracked<number>;
  /** lungimea totala estimata pe circuit (cand nu exista segmente masurate) */
  estimatedLengthM: Tracked<number>;
  /** temperatura ambianta pentru factorul K1 */
  ambientTempC: number;
  /** numar de circuite grupate pentru factorul K2 */
  groupedCircuits: number;
  autoGenerated: boolean;
  /** campuri pe care electricianul le-a fixat manual (nu se suprascriu la regenerare) */
  lockedFields: string[];
  order: number;
  status: DataStatus;
  notes: string;
}

/* ------------------------------------------------------------------ */
/* Trasee, segmente, copex, cabluri (cap. 6.2)                          */
/* ------------------------------------------------------------------ */

export type RouteSurface = "perete" | "tavan" | "pardoseala" | "aparent" | "pamant";

/** capat de segment: doza, tablou, aparat sau punct liber */
export interface NodeRef {
  kind: "box" | "panel" | "device" | "free";
  refId: ID | null;
  label: string;
}

export interface RouteSegment {
  id: ID;
  from: NodeRef;
  to: NodeRef;
  lengthM: Tracked<number>;
  /** exceptie locala tip perete (cap. 4.2) */
  wallTypeId: ID | null;
  notes: string;
}

export interface Conduit {
  id: ID;
  code: string; // CP001
  conduitTypeId: ID | null;
  /** null = lungimea traseului */
  lengthOverrideM: Tracked<number> | null;
  /** circuitele care trec prin acest tub */
  circuitIds: ID[];
}

/**
 * Traseu fizic. Santul se contabilizeaza O SINGURA DATA indiferent de
 * cate circuite / tuburi / cabluri il folosesc.
 */
export interface Route {
  id: ID;
  code: string; // TR001
  name: string;
  roomIds: ID[];
  surface: RouteSurface;
  /** necesita sant/canal (false = aparent, prin plafon fals etc.) */
  requiresChase: boolean;
  wallTypeId: ID | null;
  segments: RouteSegment[];
  conduits: Conduit[];
  /** traseu parinte pentru ramificatii */
  parentRouteId: ID | null;
  status: DataStatus;
  notes: string;
}

export interface Cable {
  id: ID;
  code: string; // CB001
  circuitId: ID;
  cableTypeId: ID | null;
  /** traseele pe care merge cablul, in ordine */
  routeIds: ID[];
  /** rezerva la capete (doze, tablou), metri */
  reserveM: number;
  /** lungime fixata manual; daca e null = suma traseelor + rezerva */
  lengthOverrideM: Tracked<number> | null;
  notes: string;
}

/* ------------------------------------------------------------------ */
/* Tablouri (cap. 8)                                                    */
/* ------------------------------------------------------------------ */

export interface PanelFeeder {
  cableTypeId: ID | null;
  lengthM: Tracked<number>;
  protectionDeviceId: ID | null;
  ratingA: number | null;
  installMethodId: ID | null;
}

export interface PanelItem {
  id: ID;
  code: string; // EM001
  protectionDeviceId: ID | null;
  label: string;
  /** circuitele protejate direct (MCB/RCBO) */
  circuitIds: ID[];
  /** elemente din aval (pentru RCD: MCB-urile protejate) */
  downstreamItemIds: ID[];
  row: number;
  /** pozitie in modul pe sina (0-based); null = auto */
  position: number | null;
  isSpare: boolean;
}

export interface Panel {
  id: ID;
  code: string; // TA001
  name: string;
  roomId: ID | null;
  location: string;
  parentPanelId: ID | null;
  feeder: PanelFeeder;
  enclosureTypeId: ID | null;
  /** procent rezerva dorita din module */
  reservePct: number;
  items: PanelItem[];
  status: DataStatus;
  notes: string;
}

/* ------------------------------------------------------------------ */
/* Deviz: ajustari pe proiect                                           */
/* ------------------------------------------------------------------ */

export interface OperationLineOverride {
  operationId: ID;
  enabled: boolean;
  /** cantitate fixata manual (null = calculata din model) */
  quantityOverride: number | null;
  /** tarif fixat manual pentru acest proiect */
  rateOverride: number | null;
  timeOverrideMin: number | null;
  note: string;
}

export interface ExtraCost {
  id: ID;
  label: string;
  amount: number;
  timeMin: number;
}

export interface QuoteSettings {
  includeMaterials: boolean;
  /** discount procentual pe manopera */
  laborDiscountPct: number;
  materialsDiscountPct: number;
  validityDays: number;
  /** factori de dificultate aplicati intregului proiect */
  projectFactorIds: ID[];
}

/* ------------------------------------------------------------------ */
/* Plan de executie (cap. 12)                                           */
/* ------------------------------------------------------------------ */

export interface TeamSettings {
  electricians: number;
  helpers: number;
  /** productivitatea unui ajutor raportata la un electrician (0..1) */
  helperEfficiency: number;
  hoursPerDay: number;
  workDaysPerWeek: number;
  startDate: ISODate | null;
}

export interface PlanOverride {
  operationId: ID;
  /** durata ajustata manual (ore). Timpul standard ramane vizibil separat. */
  manualHours: number | null;
  note: string;
}

/* ------------------------------------------------------------------ */
/* Verificari, masuratori, registru (cap. 14)                           */
/* ------------------------------------------------------------------ */

export type CheckResult = "conform" | "avertizare" | "neconform" | "date_insuficiente" | "neverificat";

export interface Measurement {
  id: ID;
  kind: "continuitate_pe" | "rezistenta_izolatie" | "impedanta_bucla" | "rcd" | "priza_pamant" | "altul";
  targetKind: "circuit" | "panel" | "project";
  targetId: ID | null;
  value: number | null;
  unit: string;
  limit: string;
  result: CheckResult;
  instrument: string;
  date: ISODate | null;
  person: string;
  notes: string;
}

export interface RegisterEntry {
  id: ID;
  category: "date_beneficiar" | "masurat" | "estimat" | "de_confirmat" | "avertizare" | "neconformitate";
  text: string;
  recommendation: string;
  responsible: string;
  resolved: boolean;
  createdAt: ISODate;
}

/* ------------------------------------------------------------------ */
/* Versionare si jurnal (cap. 15)                                       */
/* ------------------------------------------------------------------ */

export interface HistoryEntry {
  at: ISODate;
  action: string;
  detail: string;
}

export type IssuedDocKind = "oferta_manopera" | "oferta_completa" | "dosar_tehnic" | "plan_executie";

export interface IssuedVersion {
  id: ID;
  number: number; // Rev.01, Rev.02 ...
  docKind: IssuedDocKind;
  issuedAt: ISODate;
  reason: string;
  /** instantaneu complet: proiect + biblioteca folosita, inghetat */
  snapshot: string; // JSON serializat, ca sa nu poata fi modificat accidental
  totals: {
    laborValue: number | null;
    materialsValue: number | null;
    laborHours: number | null;
  };
}

/* ------------------------------------------------------------------ */
/* Proiect complet                                                      */
/* ------------------------------------------------------------------ */

export interface Project {
  id: ID;
  schemaVersion: number;
  createdAt: ISODate;
  updatedAt: ISODate;
  lastExportedAt: ISODate | null;
  info: ProjectInfo;
  supply: SupplyInfo;
  counters: CodeCounters;

  buildings: Building[];
  levels: Level[];
  rooms: Room[];

  boxes: Box[];
  devices: Device[];
  circuits: Circuit[];
  routes: Route[];
  cables: Cable[];
  panels: Panel[];

  /** simultaneitate globala pentru puterea aplicata (0..1) */
  globalSimultaneity: Tracked<number>;

  quote: QuoteSettings;
  operationOverrides: OperationLineOverride[];
  extraCosts: ExtraCost[];

  team: TeamSettings;
  planOverrides: PlanOverride[];

  measurements: Measurement[];
  register: RegisterEntry[];

  /** biblioteca proprie a proiectului (copie). Actualizare din biblioteca globala doar prin actiune explicita. */
  library: Library;
  libraryAppliedAt: ISODate;

  issued: IssuedVersion[];
  history: HistoryEntry[];
}

/* ================================================================== */
/* BIBLIOTECA (cap. 9)                                                  */
/* ================================================================== */

export interface FirmSettings {
  name: string;
  legalName: string;
  slogan: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  cui: string;
  regCom: string;
  iban: string;
  designer: string;
  anreAuthorization: string;
  anreGrade: string;
  /** imagine logo ca data URL (png/svg). Gol = sigla text implicita */
  logoDataUrl: string;
  vatPayer: boolean;
  vatRatePct: number;
  currency: string;
}

export interface RoomType {
  id: ID;
  name: string;
  defaultHeightM: number;
  /** incapere cu conditii speciale (baie, exterior) - pentru reguli ulterioare */
  special: boolean;
}

export interface WallType {
  id: ID;
  name: string;
  /** factorul de dificultate asociat (sant / locas) */
  difficultyFactorId: ID | null;
}

export interface DifficultyFactor {
  id: ID;
  name: string;
  /** multiplicator tarif */
  valueFactor: number;
  /** multiplicator timp */
  timeFactor: number;
  /** categoriile de operatii la care se aplica (gol = toate) */
  appliesToCategories: string[];
  description: string;
}

export interface DeviceType {
  id: ID;
  name: string;
  category: DeviceCategory;
  /** module ocupate in doza */
  modules: number;
  /** putere implicita SUGERATA (editabila, nu impusa). null = nu se propune */
  suggestedPowerW: number | null;
  threePhase: boolean;
  /** se monteaza in doza aparat */
  needsBox: boolean;
  brand: string;
  materialId: ID | null;
}

export interface BoxType {
  id: ID;
  name: string;
  kind: BoxKind;
  shape: "rotunda" | "modulara" | "aparenta" | "etansa";
  modules: number;
  brand: string;
  materialId: ID | null;
  /** operatia de manopera pentru montaj */
  operationId: ID | null;
}

export interface CableType {
  id: ID;
  name: string; // "FY 3x2,5" / "CYY-F 3x2,5"
  /** fire unifilare in tub sau cablu multifilar */
  construction: "fire_in_tub" | "cablu";
  conductorMaterial: "cupru" | "aluminiu";
  insulation: "PVC" | "XLPE";
  /** numar conductoare (inclusiv PE) */
  cores: number;
  /** conductoare active incarcate (2 mono, 3 tri) */
  loadedConductors: 2 | 3;
  crossSectionMm2: number;
  /** material din catalog si cantitatea de material per metru de circuit */
  materialId: ID | null;
  materialQtyPerM: number;
}

export interface ConduitType {
  id: ID;
  name: string;
  diameterMm: number;
  materialId: ID | null;
}

export type ProtectionKind = "MCB" | "RCD" | "RCBO" | "SPD" | "separator" | "releu" | "contactor" | "contor" | "altul";

export interface ProtectionDevice {
  id: ID;
  kind: ProtectionKind;
  brand: string;
  series: string;
  name: string;
  poles: string; // "1P+N", "2P", "3P+N", "4P"
  ratingA: number | null;
  curve: "B" | "C" | "D" | null;
  sensitivityMA: number | null;
  rcdType: "AC" | "A" | "F" | "B" | null;
  breakingCapacityKA: number | null;
  /** latime in module DIN (18 mm) */
  modules: number;
  materialId: ID | null;
}

export interface EnclosureType {
  id: ID;
  name: string;
  brand: string;
  mounting: "ingropat" | "aparent";
  rows: number;
  modulesPerRow: number;
  materialId: ID | null;
}

export interface InstallMethod {
  id: ID;
  /** metoda de referinta (A1, A2, B1, B2, C ...) */
  ref: string;
  name: string;
  description: string;
}

export interface CircuitType {
  id: ID;
  name: string;
  usage: CircuitUsage;
  /** setari INITIALE editabile - nu reguli universale */
  defaultCableTypeId: ID | null;
  defaultRatingA: number | null;
  defaultCurve: "B" | "C" | "D" | null;
  defaultSimultaneity: number;
  defaultInstallMethodId: ID | null;
  note: string;
}

/** ce cantitate din model alimenteaza o operatie */
export type QuantityDriver =
  | "manual"
  | "points_total" // toate punctele (doze DA + DD + tablouri) - trasare
  | "boxes_da_round"
  | "boxes_da_modular"
  | "boxes_da_all"
  | "boxes_dd"
  | "box_recesses" // locasuri doze (DA + DD)
  | "route_chase_m" // metri sant (o singura data per traseu)
  | "conduit_m"
  | "cable_m"
  | "panels"
  | "panel_items" // aparate modulare
  | "circuits"
  | "dd_connections" // conexiuni in doze de derivatie
  | "feeder_m"
  | "rooms";

export interface Operation {
  id: ID;
  code: string;
  name: string;
  category: string; // trasare, sant, doze, tuburi, cablare, tablou, verificari, diverse
  phase: WorkPhase;
  unit: "buc" | "m" | "ora" | "set" | "circuit" | "tablou" | "proiect";
  rate: number; // lei / unitate
  timeMin: number; // minute / unitate
  driver: QuantityDriver;
  /** factorii de dificultate care pot afecta operatia (prin tipul de perete / incapere) */
  wallSensitive: boolean;
  subactions: string[];
  /** etapa planului de executie */
  planStageId: ID | null;
  /** operatii care trebuie terminate inainte */
  dependsOn: ID[];
  /** se poate executa in paralel de mai multe persoane */
  parallelizable: boolean;
  active: boolean;
  validFrom: ISODate | null;
  validTo: ISODate | null;
  isExample: boolean;
}

export interface Material {
  id: ID;
  code: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  purchasePrice: number;
  markupPct: number;
  supplier: string;
  validUntil: ISODate | null;
  isExample: boolean;
}

export interface PlanStage {
  id: ID;
  name: string;
  order: number;
}

export type RuleClass = "cerinta_normativa" | "standard_tehnic" | "recomandare" | "conventie_wattnet";

export interface TechnicalRule {
  id: ID;
  code: string;
  title: string;
  classification: RuleClass;
  source: string; // ex. Normativ I7-2011
  reference: string; // ex. art. 5.2.4.1.2
  version: string;
  scope: string;
  conditions: string;
  /** parametri numerici folositi de motor */
  params: Record<string, number>;
  validation: "de_validat" | "validat";
  validatedBy: string;
  validatedAt: ISODate | null;
  notes: string;
}

/** tabel curenti admisibili: metoda -> sectiune -> A */
export interface AmpacityTable {
  id: ID;
  name: string;
  source: string;
  reference: string;
  conductorMaterial: "cupru" | "aluminiu";
  insulation: "PVC" | "XLPE";
  loadedConductors: 2 | 3;
  /** values[metodaRef][sectiune] = Iz */
  values: Record<string, Record<string, number>>;
  validation: "de_validat" | "validat";
}

export interface CorrectionTable {
  id: ID;
  name: string;
  source: string;
  reference: string;
  /** cheie (temperatura / nr circuite) -> factor */
  values: Record<string, number>;
  validation: "de_validat" | "validat";
}

export interface ProjectTemplate {
  id: ID;
  name: string;
  kind: BuildingKind;
  levels: { name: string; elevation: number; rooms: { name: string; roomTypeId: ID | null; l: number; w: number; h: number }[] }[];
}

export interface Library {
  meta: {
    name: string;
    version: string;
    updatedAt: ISODate;
    notes: string;
  };
  firm: FirmSettings;
  roomTypes: RoomType[];
  wallTypes: WallType[];
  difficultyFactors: DifficultyFactor[];
  deviceTypes: DeviceType[];
  boxTypes: BoxType[];
  cableTypes: CableType[];
  conduitTypes: ConduitType[];
  protectionDevices: ProtectionDevice[];
  enclosureTypes: EnclosureType[];
  installMethods: InstallMethod[];
  circuitTypes: CircuitType[];
  operations: Operation[];
  materials: Material[];
  planStages: PlanStage[];
  rules: TechnicalRule[];
  ampacityTables: AmpacityTable[];
  correctionTables: CorrectionTable[];
  templates: ProjectTemplate[];
}

/* ------------------------------------------------------------------ */
/* Formate de fisier                                                    */
/* ------------------------------------------------------------------ */

export interface ProjectFile {
  format: "wattnet-proiect";
  schemaVersion: number;
  exportedAt: ISODate;
  app: string;
  project: Project;
}

export interface LibraryFile {
  format: "wattnet-biblioteca";
  schemaVersion: number;
  exportedAt: ISODate;
  app: string;
  library: Library;
}
