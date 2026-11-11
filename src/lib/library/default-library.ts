/**
 * Biblioteca initiala WATTNET.
 *
 * ATENTIE: tarifele, timpii si preturile de mai jos sunt VALORI EXEMPLU
 * (isExample = true). Se actualizeaza din pagina Biblioteca si se exporta
 * ca fisier JSON reutilizabil pentru proiecte noi.
 *
 * Tabelele de curenti admisibili si factorii de corectie sunt preluate
 * dupa Normativul I7-2011 (anexele 5.10, 5.18, 5.19) si sunt marcate
 * "de_validat" pana la verificarea de catre persoana autorizata.
 */
import { normalizeLinks } from "./links";
import type {
  PointPurpose,
  AmpacityTable,
  BoxType,
  CableType,
  CircuitType,
  ConduitType,
  CorrectionTable,
  DeviceType,
  DifficultyFactor,
  EnclosureType,
  FirmSettings,
  InstallMethod,
  Library,
  Material,
  Operation,
  PlanStage,
  ProjectTemplate,
  ProtectionDevice,
  RoomType,
  TechnicalRule,
  WallType,
} from "../model/types";

export const DEFAULT_LIBRARY_VERSION = "2026.11-exemplu";
/** creste cand aplicatia adauga elemente noi in biblioteca implicita */
export const DEFAULTS_REV = 7;

export const firm: FirmSettings = {
  name: "WATTNET",
  legalName: "WATTNET SRL",
  slogan: "Infrastructura completa. De la cablu la cloud.",
  email: "proiectare@wattnet.ro",
  phone: "+40 740 514 117",
  website: "https://wattnet.ro",
  address: "Sibiu",
  cui: "",
  regCom: "",
  iban: "",
  designer: "Ing. Cismas Sorin",
  anreAuthorization: "202311684",
  anreGrade: "Gr. IIA+B",
  logoDataUrl: "",
  vatPayer: false,
  vatRatePct: 21,
  currency: "lei",
  bank: "",
  vatNote: "Furnizor neplatitor de TVA",
  proformaSeries: "WN",
  proformaNext: 1,
  paymentTermsDays: 5,
  offerTerms: "Plata: avans conform facturii proforma, diferenta la finalizarea lucrarii. Lucrarile suplimentare fata de prezenta oferta se ofera separat.",
};

const roomTypes: RoomType[] = [
  { id: "rt-living", name: "Living", defaultHeightM: 2.7, special: false },
  { id: "rt-dormitor", name: "Dormitor", defaultHeightM: 2.7, special: false },
  { id: "rt-bucatarie", name: "Bucatarie", defaultHeightM: 2.7, special: false },
  { id: "rt-baie", name: "Baie", defaultHeightM: 2.6, special: true },
  { id: "rt-hol", name: "Hol", defaultHeightM: 2.7, special: false },
  { id: "rt-birou", name: "Birou", defaultHeightM: 2.7, special: false },
  { id: "rt-dressing", name: "Dressing", defaultHeightM: 2.7, special: false },
  { id: "rt-camara", name: "Camara", defaultHeightM: 2.7, special: false },
  { id: "rt-tehnica", name: "Camera tehnica", defaultHeightM: 2.5, special: false },
  { id: "rt-scara", name: "Casa scarii", defaultHeightM: 2.7, special: false },
  { id: "rt-garaj", name: "Garaj", defaultHeightM: 2.6, special: false },
  { id: "rt-terasa", name: "Terasa / exterior", defaultHeightM: 2.5, special: true },
  { id: "rt-pod", name: "Pod / mansarda", defaultHeightM: 2.4, special: false },
  { id: "rt-altul", name: "Alta incapere", defaultHeightM: 2.7, special: false },
];

const difficultyFactors: DifficultyFactor[] = [
  { id: "df-caramida", name: "Perete caramida", valueFactor: 1, timeFactor: 1, appliesToCategories: ["sant", "doze"], description: "Referinta (factor 1)." },
  { id: "df-beton", name: "Perete beton", valueFactor: 1.6, timeFactor: 1.8, appliesToCategories: ["sant", "doze"], description: "Sant si locasuri in beton armat." },
  { id: "df-bca", name: "Perete BCA", valueFactor: 0.8, timeFactor: 0.75, appliesToCategories: ["sant", "doze"], description: "Material moale." },
  { id: "df-rigips", name: "Perete rigips", valueFactor: 0.7, timeFactor: 0.6, appliesToCategories: ["sant", "doze"], description: "Fara sant; tub prin structura." },
  { id: "df-renovare", name: "Renovare / spatiu locuit", valueFactor: 1.2, timeFactor: 1.25, appliesToCategories: [], description: "Protectii, curatenie, mobilier." },
  { id: "df-acces", name: "Acces dificil", valueFactor: 1.15, timeFactor: 1.2, appliesToCategories: [], description: "Transport, parcare, etaj fara lift." },
  { id: "df-inaltime", name: "Lucru la inaltime > 3 m", valueFactor: 1.25, timeFactor: 1.3, appliesToCategories: [], description: "Schela / platforma." },
];

const wallTypes: WallType[] = [
  { id: "wt-caramida", name: "Caramida", difficultyFactorId: "df-caramida" },
  { id: "wt-beton", name: "Beton", difficultyFactorId: "df-beton" },
  { id: "wt-bca", name: "BCA", difficultyFactorId: "df-bca" },
  { id: "wt-rigips", name: "Rigips", difficultyFactorId: "df-rigips" },
  { id: "wt-mixt", name: "Mixt / necunoscut", difficultyFactorId: null },
];

/* ---------------------------- materiale ---------------------------- */
const M = (
  id: string,
  code: string,
  name: string,
  category: string,
  brand: string,
  unit: string,
  purchasePrice: number,
  markupPct = 20,
): Material => ({ id, code, name, category, brand, unit, purchasePrice, markupPct, supplier: "", validUntil: null, isExample: true });

const materials: Material[] = [
  // conductoare / cabluri
  M("mat-fy15", "", "Conductor FY 1,5 mm2", "cabluri", "", "m", 1.1),
  M("mat-fy25", "", "Conductor FY 2,5 mm2", "cabluri", "", "m", 1.7),
  M("mat-fy4", "", "Conductor FY 4 mm2", "cabluri", "", "m", 2.7),
  M("mat-fy6", "", "Conductor FY 6 mm2", "cabluri", "", "m", 4.0),
  M("mat-cyyf3x15", "", "Cablu CYY-F 3x1,5", "cabluri", "", "m", 4.2),
  M("mat-cyyf3x25", "", "Cablu CYY-F 3x2,5", "cabluri", "", "m", 6.4),
  M("mat-cyyf3x4", "", "Cablu CYY-F 3x4", "cabluri", "", "m", 9.8),
  M("mat-cyyf3x6", "", "Cablu CYY-F 3x6", "cabluri", "", "m", 14.5),
  M("mat-cyyf5x25", "", "Cablu CYY-F 5x2,5", "cabluri", "", "m", 10.5),
  M("mat-cyyf5x6", "", "Cablu CYY-F 5x6", "cabluri", "", "m", 24.0),
  M("mat-cyyf5x10", "", "Cablu CYY-F 5x10", "cabluri", "", "m", 39.0),
  M("mat-nyyj3x15", "", "Cablu NYY-J 3x1,5", "cabluri", "", "m", 4.0),
  M("mat-nyyj3x25", "", "Cablu NYY-J 3x2,5", "cabluri", "", "m", 6.0),
  M("mat-nyyj3x4", "", "Cablu NYY-J 3x4", "cabluri", "", "m", 9.5),
  M("mat-nyyj3x6", "", "Cablu NYY-J 3x6", "cabluri", "", "m", 14.0),
  M("mat-nyyj3x10", "", "Cablu NYY-J 3x10", "cabluri", "", "m", 22.0),
  M("mat-nyyj5x15", "", "Cablu NYY-J 5x1,5", "cabluri", "", "m", 7.0),
  M("mat-nyyj5x25", "", "Cablu NYY-J 5x2,5", "cabluri", "", "m", 10.0),
  M("mat-nyyj5x4", "", "Cablu NYY-J 5x4", "cabluri", "", "m", 15.0),
  M("mat-nyyj5x6", "", "Cablu NYY-J 5x6", "cabluri", "", "m", 23.0),
  M("mat-nyyj5x10", "", "Cablu NYY-J 5x10", "cabluri", "", "m", 37.0),
  M("mat-ap-priza", "", "Priza simpla Schuko cu rama", "aparataj", "Schneider", "buc", 22),
  M("mat-ap-priza-dubla", "", "Priza dubla Schuko cu rama", "aparataj", "Schneider", "buc", 38),
  M("mat-ap-intr", "", "Intrerupator simplu cu rama", "aparataj", "Schneider", "buc", 18),
  M("mat-ap-intr-dublu", "", "Intrerupator dublu cu rama", "aparataj", "Schneider", "buc", 24),
  M("mat-ap-cap", "", "Comutator cap-scara cu rama", "aparataj", "Schneider", "buc", 22),
  M("mat-utp6", "", "Cablu UTP Cat6", "curenti_slabi", "", "m", 2.2),
  // tuburi
  M("mat-copex16", "", "Tub copex 16 mm", "tuburi", "", "m", 0.9),
  M("mat-copex20", "", "Tub copex 20 mm", "tuburi", "", "m", 1.1),
  M("mat-copex25", "", "Tub copex 25 mm", "tuburi", "", "m", 1.5),
  M("mat-copex32", "", "Tub copex 32 mm", "tuburi", "", "m", 2.3),
  // doze
  M("mat-da-rot", "", "Doza aparat rotunda D68", "doze", "Gewiss", "buc", 1.2),
  M("mat-da-mod3", "", "Doza aparat modulara 3 module", "doze", "Gewiss", "buc", 3.5),
  M("mat-da-mod4", "", "Doza aparat modulara 4 module", "doze", "Gewiss", "buc", 4.5),
  M("mat-da-mod7", "", "Doza aparat modulara 7 module", "doze", "Gewiss", "buc", 8.0),
  M("mat-dd-100", "", "Doza derivatie 100x100", "doze", "Gewiss", "buc", 6.5),
  M("mat-dd-rot", "", "Doza derivatie rotunda D80", "doze", "Gewiss", "buc", 2.5),
  M("mat-doza-ip", "", "Doza aparenta IP55", "doze", "Gewiss", "buc", 9.0),
  // tablouri
  M("mat-tab12", "", "Tablou ingropat 12 module", "tablouri", "Schneider", "buc", 85),
  M("mat-tab24", "", "Tablou ingropat 24 module", "tablouri", "Schneider", "buc", 160),
  M("mat-tab36", "", "Tablou ingropat 36 module", "tablouri", "Schneider", "buc", 240),
  M("mat-tab48", "", "Tablou ingropat 48 module", "tablouri", "Schneider", "buc", 330),
  M("mat-tab54-schrack", "", "Tablou ingropat 3x18 module", "tablouri", "Schrack", "buc", 290),
  // protectii
  M("mat-mcb-sch-b10", "", "Intrerupator automat 1P+N B10", "protectii", "Schrack", "buc", 32),
  M("mat-mcb-sch-c16", "", "Intrerupator automat 1P+N C16", "protectii", "Schrack", "buc", 32),
  M("mat-mcb-sch-c20", "", "Intrerupator automat 1P+N C20", "protectii", "Schrack", "buc", 34),
  M("mat-mcb-sch-c25", "", "Intrerupator automat 1P+N C25", "protectii", "Schrack", "buc", 36),
  M("mat-mcb-sch-c32", "", "Intrerupator automat 1P+N C32", "protectii", "Schrack", "buc", 38),
  M("mat-mcb-sch-3c16", "", "Intrerupator automat 3P+N C16", "protectii", "Schrack", "buc", 120),
  M("mat-mcb-sch-3c32", "", "Intrerupator automat 3P+N C32", "protectii", "Schrack", "buc", 135),
  M("mat-rcd-sch-2p40", "", "Intrerupator diferential 2P 40A 30mA tip A", "protectii", "Schrack", "buc", 145),
  M("mat-rcd-sch-4p40", "", "Intrerupator diferential 4P 40A 30mA tip A", "protectii", "Schrack", "buc", 230),
  M("mat-rcbo-sch-c16", "", "Intrerupator diferential cu protectie 1P+N C16 30mA", "protectii", "Schrack", "buc", 155),
  M("mat-mcb-sne-c10", "", "Intrerupator automat 1P+N C10", "protectii", "Schneider", "buc", 34),
  M("mat-mcb-sne-c16", "", "Intrerupator automat 1P+N C16", "protectii", "Schneider", "buc", 34),
  M("mat-mcb-sne-c20", "", "Intrerupator automat 1P+N C20", "protectii", "Schneider", "buc", 36),
  M("mat-rcd-sne-2p40", "", "Intrerupator diferential 2P 40A 30mA tip A", "protectii", "Schneider", "buc", 160),
  M("mat-rcd-sne-4p40", "", "Intrerupator diferential 4P 40A 30mA tip A", "protectii", "Schneider", "buc", 260),
  M("mat-spd-2p", "", "Descarcator supratensiuni 1P+N T2", "protectii", "Schneider", "buc", 210),
  M("mat-spd-4p", "", "Descarcator supratensiuni 3P+N T2", "protectii", "Schneider", "buc", 420),
  M("mat-sep-4p63", "", "Separator 4P 63A", "protectii", "Schneider", "buc", 110),
  M("mat-rcd-sch-2p63", "", "Intrerupator diferential 2P 63A 30mA tip A", "protectii", "Schrack", "buc", 190),
  M("mat-rcd-sch-4p63", "", "Intrerupator diferential 4P 63A 30mA tip A", "protectii", "Schrack", "buc", 290),
  M("mat-cyyf3x10", "", "Cablu CYY-F 3x10", "cabluri", "", "m", 23.0),
  M("mat-cyyf5x4", "", "Cablu CYY-F 5x4", "cabluri", "", "m", 15.5),
  M("mat-fy10", "", "Conductor FY 10 mm2", "cabluri", "", "m", 6.5),
  M("mat-sep-2p63", "", "Separator 2P 63A", "protectii", "Schneider", "buc", 60),
  // accesorii tablou
  M("mat-pieptene", "", "Bara pieptene 1P+N (12 module)", "accesorii", "", "buc", 25),
  M("mat-cleme", "", "Set cleme / bornier N + PE", "accesorii", "", "set", 30),
  M("mat-etichete", "", "Etichete circuite", "accesorii", "", "set", 10),
  // consumabile
  M("mat-ipsos", "", "Ipsos / prenadez fixare doze si tuburi", "consumabile", "", "kg", 2.5),
  M("mat-wago", "", "Conectori Wago (set 10 buc)", "consumabile", "", "set", 18),
];

/* --------------------------- tipuri doze --------------------------- */
const boxTypes: BoxType[] = [
  { id: "bt-da-rot", name: "Doza aparat rotunda D68", kind: "DA", shape: "rotunda", modules: 2, brand: "Gewiss", materialId: "mat-da-rot", operationId: "op-doza-rot" },
  { id: "bt-da-mod3", name: "Doza aparat modulara 3 module", kind: "DA", shape: "modulara", modules: 3, brand: "Gewiss", materialId: "mat-da-mod3", operationId: "op-doza-mod" },
  { id: "bt-da-mod4", name: "Doza aparat modulara 4 module", kind: "DA", shape: "modulara", modules: 4, brand: "Gewiss", materialId: "mat-da-mod4", operationId: "op-doza-mod4" },
  { id: "bt-da-mod7", name: "Doza aparat modulara 7 module", kind: "DA", shape: "modulara", modules: 7, brand: "Gewiss", materialId: "mat-da-mod7", operationId: "op-doza-mod7" },
  { id: "bt-da-ip", name: "Doza aparenta IP55", kind: "DA", shape: "etansa", modules: 2, brand: "Gewiss", materialId: "mat-doza-ip", operationId: "op-doza-ip" },
  { id: "bt-dd-100", name: "Doza derivatie 100x100", kind: "DD", shape: "aparenta", modules: 0, brand: "Gewiss", materialId: "mat-dd-100", operationId: "op-doza-dd" },
  { id: "bt-dd-rot", name: "Doza derivatie rotunda D80", kind: "DD", shape: "rotunda", modules: 0, brand: "Gewiss", materialId: "mat-dd-rot", operationId: "op-doza-dd" },
];

/** materialul implicit al aparatajului uzual (preturi exemplu); corpurile de iluminat le aduce de regula beneficiarul */
export const DEVICE_MATERIAL: Record<string, string> = { "dt-priza": "mat-ap-priza", "dt-priza-tv": "mat-ap-priza", "dt-priza-dubla": "mat-ap-priza-dubla", "dt-intr-simplu": "mat-ap-intr", "dt-intr-dublu": "mat-ap-intr-dublu", "dt-intr-cap": "mat-ap-cap" };

/** operatia de montaj la gata, implicita dupa tip / categorie */
export function defaultInstallOp(id: string, category: string): string | null {
  const byId: Record<string, string> = { "dt-il-plafon": "op-g-corp", "dt-il-aplica": "op-g-aplica", "dt-il-ext": "op-g-aplica", "dt-il-spot": "op-g-spot", "dt-il-led": "op-g-led" };
  if (byId[id]) return byId[id];
  const byCat: Record<string, string> = { priza: "op-g-priza", curenti_slabi: "op-g-priza", intrerupator: "op-g-intr", comanda: "op-g-comanda", iluminat: "op-g-corp", consumator_dedicat: "op-g-dedicat" };
  return byCat[category] ?? null;
}

/* ------------------- destinatii doze (faza la rosu) ----------------- */
/* consumurile sunt valori medii EXEMPLU, de actualizat in Biblioteca */
const pointPurposes: PointPurpose[] = [
  { id: "pp-priza", name: "Doza priza", category: "priza", shortcut: "P", boxTypeId: "bt-da-rot", powerW: 300, deviceTypeIds: ["dt-priza"] },
  { id: "pp-priza-mod4", name: "Doza prize modulara 4M (2 prize)", category: "priza", shortcut: "D", boxTypeId: "bt-da-mod4", powerW: 600, deviceTypeIds: ["dt-priza", "dt-priza"] },
  { id: "pp-priza-tv", name: "Doza priza TV", category: "priza", shortcut: "T", boxTypeId: "bt-da-rot", powerW: 200, deviceTypeIds: ["dt-priza-tv"] },
  { id: "pp-intr", name: "Doza intrerupator / comutator", category: "intrerupator", shortcut: "I", boxTypeId: "bt-da-rot", powerW: null, deviceTypeIds: ["dt-intr-simplu"] },
  { id: "pp-comanda", name: "Doza termostat / senzor", category: "comanda", shortcut: "C", boxTypeId: "bt-da-rot", powerW: 5, deviceTypeIds: ["dt-termostat"] },
  { id: "pp-dedicat", name: "Doza consumator dedicat", category: "consumator_dedicat", shortcut: "E", boxTypeId: "bt-da-rot", powerW: null },
  { id: "pp-slabi", name: "Doza curenti slabi (date, TV coaxial)", category: "curenti_slabi", shortcut: "R", boxTypeId: "bt-da-rot", powerW: null, deviceTypeIds: ["dt-rj45"] },
  { id: "pp-plita", name: "Doza plita electrica", category: "consumator_dedicat", shortcut: "", boxTypeId: "bt-da-rot", powerW: 7000, deviceTypeIds: ["dt-plita"] },
  { id: "pp-cuptor", name: "Doza cuptor electric", category: "consumator_dedicat", shortcut: "", boxTypeId: "bt-da-rot", powerW: 3500, deviceTypeIds: ["dt-cuptor"] },
  { id: "pp-masina-spalat", name: "Doza masina de spalat", category: "consumator_dedicat", shortcut: "", boxTypeId: "bt-da-rot", powerW: 2200, deviceTypeIds: ["dt-masina-spalat"] },
  { id: "pp-ac", name: "Doza aer conditionat", category: "consumator_dedicat", shortcut: "", boxTypeId: "bt-da-rot", powerW: 1500, deviceTypeIds: ["dt-ac"] },
];

/* ------------------------ aparate / consumatori -------------------- */
const D = (
  id: string,
  name: string,
  category: DeviceType["category"],
  modules: number,
  needsBox: boolean,
  suggestedPowerW: number | null = null,
  threePhase = false,
  shortcut?: string,
): DeviceType => ({ id, name, category, modules, needsBox, suggestedPowerW, threePhase, brand: "", materialId: DEVICE_MATERIAL[id] ?? null, ...(shortcut ? { shortcut } : {}), ...(category === "iluminat" && !needsBox ? { operationId: "op-punct-il" } : {}), installOperationId: defaultInstallOp(id, category) });

/*
 * Puterile sunt CONSUMURI MEDII EXEMPLU pentru estimare (faza la rosu);
 * se actualizeaza in Biblioteca si se corecteaza pe aparat unde se cunoaste puterea reala.
 */
const deviceTypes: DeviceType[] = [
  D("dt-priza", "Priza simpla Schuko", "priza", 2, true, 300, false),
  D("dt-priza-dubla", "Priza dubla Schuko", "priza", 4, true, 300, false),
  D("dt-priza-ip", "Priza IP44 (baie / exterior)", "priza", 2, true, 300, false),
  D("dt-priza-tv", "Priza alimentare TV", "priza", 2, true, 200, false),
  D("dt-priza-usb", "Priza cu USB", "priza", 2, true, 100, false),
  D("dt-intr-simplu", "Intrerupator simplu", "intrerupator", 1, true, null, false),
  D("dt-intr-dublu", "Intrerupator dublu", "intrerupator", 1, true),
  D("dt-intr-cap", "Comutator cap-scara", "intrerupator", 1, true, null, false),
  D("dt-intr-cruce", "Comutator cruce", "intrerupator", 1, true),
  D("dt-buton", "Buton / sonerie", "comanda", 1, true),
  D("dt-il-plafon", "Punct iluminat plafon", "iluminat", 0, false, 60, false, "L"),
  D("dt-il-aplica", "Aplica perete", "iluminat", 0, false, 40, false, "A"),
  D("dt-il-spot", "Spot incastrat", "iluminat", 0, false, 10, false, "S"),
  D("dt-il-led", "Banda LED (alimentator)", "iluminat", 0, false, 50, false, "B"),
  D("dt-il-ext", "Iluminat exterior", "iluminat", 0, false, 60, false),
  D("dt-senzor", "Senzor miscare / prezenta", "comanda", 1, true, 5, false),
  D("dt-termostat", "Termostat", "comanda", 2, true, 5, false),
  D("dt-plita", "Plita electrica", "consumator_dedicat", 0, false, 7000, false),
  D("dt-cuptor", "Cuptor electric", "consumator_dedicat", 0, false, 3500, false),
  D("dt-masina-spalat", "Masina de spalat rufe", "consumator_dedicat", 0, false, 2200, false),
  D("dt-uscator", "Uscator rufe", "consumator_dedicat", 0, false, 2500, false),
  D("dt-masina-vase", "Masina de spalat vase", "consumator_dedicat", 0, false, 2000, false),
  D("dt-ac", "Aer conditionat", "consumator_dedicat", 0, false, 1500, false),
  D("dt-boiler", "Boiler electric", "consumator_dedicat", 0, false, 2000, false),
  D("dt-centrala", "Centrala termica", "consumator_dedicat", 0, false, 150, false),
  D("dt-pompa-caldura", "Pompa de caldura", "consumator_dedicat", 0, false, 6000, true),
  D("dt-statie-ev", "Statie incarcare auto", "consumator_dedicat", 0, false, 7400, false),
  D("dt-hota", "Hota", "consumator_dedicat", 0, false, 250, false),
  D("dt-rj45", "Priza date RJ45", "curenti_slabi", 2, true),
  D("dt-tv", "Priza TV coaxial", "curenti_slabi", 1, true),
  D("dt-alarma", "Punct alarma / interfon", "curenti_slabi", 0, false),
];

/* ------------------------- cabluri si tuburi ----------------------- */
const C = (
  id: string,
  name: string,
  construction: CableType["construction"],
  cores: number,
  loaded: 2 | 3,
  section: number,
  materialId: string,
  qtyPerM: number,
): CableType => ({
  id,
  name,
  construction,
  conductorMaterial: "cupru",
  insulation: "PVC",
  cores,
  loadedConductors: loaded,
  crossSectionMm2: section,
  materialId,
  materialQtyPerM: qtyPerM,
});

const cableTypes: CableType[] = [
  C("ct-nyyj3x15", "NYY-J 3x1,5", "cablu", 3, 2, 1.5, "mat-nyyj3x15", 1),
  C("ct-nyyj3x25", "NYY-J 3x2,5", "cablu", 3, 2, 2.5, "mat-nyyj3x25", 1),
  C("ct-nyyj3x4", "NYY-J 3x4", "cablu", 3, 2, 4, "mat-nyyj3x4", 1),
  C("ct-nyyj3x6", "NYY-J 3x6", "cablu", 3, 2, 6, "mat-nyyj3x6", 1),
  C("ct-nyyj3x10", "NYY-J 3x10", "cablu", 3, 2, 10, "mat-nyyj3x10", 1),
  C("ct-nyyj5x15", "NYY-J 5x1,5", "cablu", 5, 3, 1.5, "mat-nyyj5x15", 1),
  C("ct-nyyj5x25", "NYY-J 5x2,5", "cablu", 5, 3, 2.5, "mat-nyyj5x25", 1),
  C("ct-nyyj5x4", "NYY-J 5x4", "cablu", 5, 3, 4, "mat-nyyj5x4", 1),
  C("ct-nyyj5x6", "NYY-J 5x6", "cablu", 5, 3, 6, "mat-nyyj5x6", 1),
  C("ct-nyyj5x10", "NYY-J 5x10", "cablu", 5, 3, 10, "mat-nyyj5x10", 1),
  C("ct-fy3x15", "FY 3x1,5", "fire_in_tub", 3, 2, 1.5, "mat-fy15", 3),
  C("ct-fy3x25", "FY 3x2,5", "fire_in_tub", 3, 2, 2.5, "mat-fy25", 3),
  C("ct-fy3x4", "FY 3x4", "fire_in_tub", 3, 2, 4, "mat-fy4", 3),
  C("ct-fy3x6", "FY 3x6", "fire_in_tub", 3, 2, 6, "mat-fy6", 3),
  C("ct-cyyf3x15", "CYY-F 3x1,5", "cablu", 3, 2, 1.5, "mat-cyyf3x15", 1),
  C("ct-cyyf3x25", "CYY-F 3x2,5", "cablu", 3, 2, 2.5, "mat-cyyf3x25", 1),
  C("ct-cyyf3x4", "CYY-F 3x4", "cablu", 3, 2, 4, "mat-cyyf3x4", 1),
  C("ct-cyyf3x6", "CYY-F 3x6", "cablu", 3, 2, 6, "mat-cyyf3x6", 1),
  C("ct-fy3x10", "FY 3x10", "fire_in_tub", 3, 2, 10, "mat-fy10", 3),
  C("ct-cyyf3x10", "CYY-F 3x10", "cablu", 3, 2, 10, "mat-cyyf3x10", 1),
  C("ct-cyyf5x25", "CYY-F 5x2,5", "cablu", 5, 3, 2.5, "mat-cyyf5x25", 1),
  C("ct-cyyf5x4", "CYY-F 5x4", "cablu", 5, 3, 4, "mat-cyyf5x4", 1),
  C("ct-cyyf5x6", "CYY-F 5x6", "cablu", 5, 3, 6, "mat-cyyf5x6", 1),
  C("ct-cyyf5x10", "CYY-F 5x10", "cablu", 5, 3, 10, "mat-cyyf5x10", 1),
];

const conduitTypes: ConduitType[] = [
  { id: "cd-16", name: "Copex 16 mm", diameterMm: 16, materialId: "mat-copex16" },
  { id: "cd-20", name: "Copex 20 mm", diameterMm: 20, materialId: "mat-copex20" },
  { id: "cd-25", name: "Copex 25 mm", diameterMm: 25, materialId: "mat-copex25" },
  { id: "cd-32", name: "Copex 32 mm", diameterMm: 32, materialId: "mat-copex32" },
];

/* --------------------------- protectii DIN ------------------------- */
const P = (p: Partial<ProtectionDevice> & Pick<ProtectionDevice, "id" | "kind" | "brand" | "name" | "poles" | "modules">): ProtectionDevice => ({
  series: "",
  ratingA: null,
  curve: null,
  sensitivityMA: null,
  rcdType: null,
  breakingCapacityKA: 6,
  materialId: null,
  ...p,
});

/*
 * Latimile in module sunt valori uzuale; verifica fisa producatorului
 * pentru seria exacta folosita (unele 1P+N compacte au 1 modul).
 */
const protectionDevices: ProtectionDevice[] = [
  P({ id: "pd-sch-b10", kind: "MCB", brand: "Schrack", name: "MCB 1P+N B10", poles: "1P+N", ratingA: 10, curve: "B", modules: 2, materialId: "mat-mcb-sch-b10" }),
  P({ id: "pd-sch-c10", kind: "MCB", brand: "Schrack", name: "MCB 1P+N C10", poles: "1P+N", ratingA: 10, curve: "C", modules: 2, materialId: "mat-mcb-sch-b10" }),
  P({ id: "pd-sch-c16", kind: "MCB", brand: "Schrack", name: "MCB 1P+N C16", poles: "1P+N", ratingA: 16, curve: "C", modules: 2, materialId: "mat-mcb-sch-c16" }),
  P({ id: "pd-sch-c20", kind: "MCB", brand: "Schrack", name: "MCB 1P+N C20", poles: "1P+N", ratingA: 20, curve: "C", modules: 2, materialId: "mat-mcb-sch-c20" }),
  P({ id: "pd-sch-c25", kind: "MCB", brand: "Schrack", name: "MCB 1P+N C25", poles: "1P+N", ratingA: 25, curve: "C", modules: 2, materialId: "mat-mcb-sch-c25" }),
  P({ id: "pd-sch-c32", kind: "MCB", brand: "Schrack", name: "MCB 1P+N C32", poles: "1P+N", ratingA: 32, curve: "C", modules: 2, materialId: "mat-mcb-sch-c32" }),
  P({ id: "pd-sch-3c16", kind: "MCB", brand: "Schrack", name: "MCB 3P+N C16", poles: "3P+N", ratingA: 16, curve: "C", modules: 4, materialId: "mat-mcb-sch-3c16" }),
  P({ id: "pd-sch-3c32", kind: "MCB", brand: "Schrack", name: "MCB 3P+N C32", poles: "3P+N", ratingA: 32, curve: "C", modules: 4, materialId: "mat-mcb-sch-3c32" }),
  P({ id: "pd-sch-rcd2p40", kind: "RCD", brand: "Schrack", name: "RCD 2P 40A 30mA tip A", poles: "2P", ratingA: 40, sensitivityMA: 30, rcdType: "A", modules: 2, materialId: "mat-rcd-sch-2p40" }),
  P({ id: "pd-sch-rcd4p40", kind: "RCD", brand: "Schrack", name: "RCD 4P 40A 30mA tip A", poles: "4P", ratingA: 40, sensitivityMA: 30, rcdType: "A", modules: 4, materialId: "mat-rcd-sch-4p40" }),
  P({ id: "pd-sch-rcbo-c16", kind: "RCBO", brand: "Schrack", name: "RCBO 1P+N C16 30mA", poles: "1P+N", ratingA: 16, curve: "C", sensitivityMA: 30, rcdType: "A", modules: 2, materialId: "mat-rcbo-sch-c16" }),
  P({ id: "pd-sne-c10", kind: "MCB", brand: "Schneider", name: "MCB 1P+N C10", poles: "1P+N", ratingA: 10, curve: "C", modules: 2, materialId: "mat-mcb-sne-c10" }),
  P({ id: "pd-sne-c16", kind: "MCB", brand: "Schneider", name: "MCB 1P+N C16", poles: "1P+N", ratingA: 16, curve: "C", modules: 2, materialId: "mat-mcb-sne-c16" }),
  P({ id: "pd-sne-c20", kind: "MCB", brand: "Schneider", name: "MCB 1P+N C20", poles: "1P+N", ratingA: 20, curve: "C", modules: 2, materialId: "mat-mcb-sne-c20" }),
  P({ id: "pd-sne-rcd2p40", kind: "RCD", brand: "Schneider", name: "RCD 2P 40A 30mA tip A", poles: "2P", ratingA: 40, sensitivityMA: 30, rcdType: "A", modules: 2, materialId: "mat-rcd-sne-2p40" }),
  P({ id: "pd-sne-rcd4p40", kind: "RCD", brand: "Schneider", name: "RCD 4P 40A 30mA tip A", poles: "4P", ratingA: 40, sensitivityMA: 30, rcdType: "A", modules: 4, materialId: "mat-rcd-sne-4p40" }),
  P({ id: "pd-sch-c40", kind: "MCB", brand: "Schrack", name: "MCB 1P+N C40", poles: "1P+N", ratingA: 40, curve: "C", modules: 2, materialId: "mat-mcb-sch-c32" }),
  P({ id: "pd-sch-b16", kind: "MCB", brand: "Schrack", name: "MCB 1P+N B16", poles: "1P+N", ratingA: 16, curve: "B", modules: 2, materialId: "mat-mcb-sch-c16" }),
  P({ id: "pd-sch-3c20", kind: "MCB", brand: "Schrack", name: "MCB 3P+N C20", poles: "3P+N", ratingA: 20, curve: "C", modules: 4, materialId: "mat-mcb-sch-3c16" }),
  P({ id: "pd-sch-3c25", kind: "MCB", brand: "Schrack", name: "MCB 3P+N C25", poles: "3P+N", ratingA: 25, curve: "C", modules: 4, materialId: "mat-mcb-sch-3c16" }),
  P({ id: "pd-sch-3c40", kind: "MCB", brand: "Schrack", name: "MCB 3P+N C40", poles: "3P+N", ratingA: 40, curve: "C", modules: 4, materialId: "mat-mcb-sch-3c32" }),
  P({ id: "pd-sch-rcd2p25", kind: "RCD", brand: "Schrack", name: "RCD 2P 25A 30mA tip A", poles: "2P", ratingA: 25, sensitivityMA: 30, rcdType: "A", modules: 2, materialId: "mat-rcd-sch-2p40" }),
  P({ id: "pd-sch-rcd2p63", kind: "RCD", brand: "Schrack", name: "RCD 2P 63A 30mA tip A", poles: "2P", ratingA: 63, sensitivityMA: 30, rcdType: "A", modules: 2, materialId: "mat-rcd-sch-2p63" }),
  P({ id: "pd-sch-rcd4p25", kind: "RCD", brand: "Schrack", name: "RCD 4P 25A 30mA tip A", poles: "4P", ratingA: 25, sensitivityMA: 30, rcdType: "A", modules: 4, materialId: "mat-rcd-sch-4p40" }),
  P({ id: "pd-sch-rcd4p63", kind: "RCD", brand: "Schrack", name: "RCD 4P 63A 30mA tip A", poles: "4P", ratingA: 63, sensitivityMA: 30, rcdType: "A", modules: 4, materialId: "mat-rcd-sch-4p63" }),
  P({ id: "pd-sne-sep4p63", kind: "separator", brand: "Schneider", name: "Separator 4P 63A", poles: "4P", ratingA: 63, modules: 4, breakingCapacityKA: null, materialId: "mat-sep-4p63" }),
  P({ id: "pd-sne-spd4p", kind: "SPD", brand: "Schneider", name: "SPD 3P+N tip 2", poles: "3P+N", modules: 4, breakingCapacityKA: null, materialId: "mat-spd-4p" }),
  P({ id: "pd-sne-spd", kind: "SPD", brand: "Schneider", name: "SPD 1P+N tip 2", poles: "1P+N", modules: 2, breakingCapacityKA: null, materialId: "mat-spd-2p" }),
  P({ id: "pd-sne-sep2p63", kind: "separator", brand: "Schneider", name: "Separator 2P 63A", poles: "2P", ratingA: 63, modules: 2, breakingCapacityKA: null, materialId: "mat-sep-2p63" }),
];

const enclosureTypes: EnclosureType[] = [
  { id: "en-12", name: "Tablou ingropat 1x12 module", brand: "Schneider", mounting: "ingropat", rows: 1, modulesPerRow: 12, materialId: "mat-tab12" },
  { id: "en-24", name: "Tablou ingropat 2x12 module", brand: "Schneider", mounting: "ingropat", rows: 2, modulesPerRow: 12, materialId: "mat-tab24" },
  { id: "en-36", name: "Tablou ingropat 3x12 module", brand: "Schneider", mounting: "ingropat", rows: 3, modulesPerRow: 12, materialId: "mat-tab36" },
  { id: "en-48", name: "Tablou ingropat 4x12 module", brand: "Schneider", mounting: "ingropat", rows: 4, modulesPerRow: 12, materialId: "mat-tab48" },
  { id: "en-sch-54", name: "Tablou ingropat 3x18 module", brand: "Schrack", mounting: "ingropat", rows: 3, modulesPerRow: 18, materialId: "mat-tab54-schrack" },
];

/*
 * Metode de pozare de referinta (I7-2011, anexa 5.5). Descrieri scurte,
 * orientative; electricianul alege metoda reala pentru fiecare circuit.
 */
const installMethods: InstallMethod[] = [
  { id: "im-a1", ref: "A1", name: "A1 - conductoare in tub in perete izolat termic", description: "Conductoare izolate in tub incastrat intr-un perete izolat termic." },
  { id: "im-a2", ref: "A2", name: "A2 - cablu multiconductor in tub in perete izolat termic", description: "Cablu multiconductor in tub incastrat intr-un perete izolat termic." },
  { id: "im-b1", ref: "B1", name: "B1 - conductoare in tub pe/in perete (zidarie)", description: "Conductoare izolate in tub montat pe perete sau incastrat in zidarie." },
  { id: "im-b2", ref: "B2", name: "B2 - cablu multiconductor in tub pe/in perete", description: "Cablu multiconductor in tub pe perete sau incastrat in zidarie." },
  { id: "im-c", ref: "C", name: "C - cablu fixat direct pe perete / ingropat direct", description: "Cablu mono- sau multiconductor fixat pe perete sau ingropat direct in zidarie." },
];

const circuitTypes: CircuitType[] = [
  { id: "ctp-iluminat", name: "Iluminat", usage: "iluminat", defaultCableTypeId: "ct-nyyj3x15", defaultRatingA: 10, defaultCurve: "C", defaultSimultaneity: 0.8, defaultInstallMethodId: "im-c", note: "Setare initiala editabila (10 A / NYY-J 3x1,5); se verifica pe circuit." },
  { id: "ctp-prize", name: "Prize generale", usage: "prize", defaultCableTypeId: "ct-nyyj3x25", defaultRatingA: 16, defaultCurve: "C", defaultSimultaneity: 0.5, defaultInstallMethodId: "im-c", note: "Setare initiala editabila (16 A / NYY-J 3x2,5); se verifica pe circuit." },
  { id: "ctp-prize-bucatarie", name: "Prize bucatarie", usage: "prize", defaultCableTypeId: "ct-nyyj3x25", defaultRatingA: 16, defaultCurve: "C", defaultSimultaneity: 0.6, defaultInstallMethodId: "im-c", note: "Setare initiala editabila." },
  { id: "ctp-prize-baie", name: "Prize baie", usage: "prize", defaultCableTypeId: "ct-nyyj3x25", defaultRatingA: 16, defaultCurve: "C", defaultSimultaneity: 0.5, defaultInstallMethodId: "im-c", note: "Incapere cu conditii speciale - se verifica cerintele aplicabile." },
  { id: "ctp-dedicat", name: "Consumator dedicat", usage: "dedicat", defaultCableTypeId: null, defaultRatingA: null, defaultCurve: "C", defaultSimultaneity: 1, defaultInstallMethodId: "im-c", note: "Sectiunea si protectia se calculeaza din puterea consumatorului si conditiile reale." },
  { id: "ctp-curenti-slabi", name: "Curenti slabi", usage: "curenti_slabi", defaultCableTypeId: null, defaultRatingA: null, defaultCurve: null, defaultSimultaneity: 0, defaultInstallMethodId: null, note: "Fara putere 230 V." },
];

/* --------------------------- plan executie ------------------------- */
const planStages: PlanStage[] = [
  { id: "ps-pregatire", name: "Pregatire si trasare", order: 1 },
  { id: "ps-trasee", name: "Trasee si locasuri", order: 2 },
  { id: "ps-doze", name: "Montaj doze si tuburi", order: 3 },
  { id: "ps-cablare", name: "Cablare", order: 4 },
  { id: "ps-tablouri", name: "Tablouri", order: 5 },
  { id: "ps-verificari", name: "Verificari la rosu", order: 6 },
  { id: "ps-aparataj", name: "Montaj aparataj si corpuri de iluminat (la gata)", order: 7 },
  { id: "ps-final", name: "Verificari finale si predare", order: 8 },
];

/* ---------------------------- operatii ----------------------------- */
const O = (o: Partial<Operation> & Pick<Operation, "id" | "code" | "name" | "category" | "unit" | "rate" | "timeMin" | "driver" | "planStageId">): Operation => ({
  phase: "rosu",
  wallSensitive: false,
  subactions: [],
  dependsOn: [],
  parallelizable: true,
  active: true,
  validFrom: null,
  validTo: null,
  isExample: true,
  ...o,
});

const operations: Operation[] = [
  O({ id: "op-trasare", code: "OP001", name: "Trasare puncte, doze si trasee", category: "trasare", unit: "buc", rate: 3, timeMin: 2, driver: "points_total", planStageId: "ps-pregatire", subactions: ["Verificare planuri si masuratori", "Confirmare pozitionari cu beneficiarul", "Marcare puncte si trasee"] }),
  O({ id: "op-sant", code: "OP002", name: "Executare sant / canal in perete", category: "sant", unit: "m", rate: 15, timeMin: 6, driver: "route_chase_m", wallSensitive: true, planStageId: "ps-trasee", dependsOn: ["op-trasare"], subactions: ["Taiere cu freza", "Spart si curatat", "Evacuare moloz"] }),
  O({ id: "op-locas", code: "OP003", name: "Executare locas doza", category: "doze", unit: "buc", rate: 10, timeMin: 8, driver: "box_recesses", wallSensitive: true, planStageId: "ps-trasee", dependsOn: ["op-trasare"] }),
  O({ id: "op-doza-rot", code: "OP004", name: "Montare doza aparat rotunda D68", category: "doze", unit: "buc", rate: 12, timeMin: 8, driver: "box_type_op", planStageId: "ps-doze", dependsOn: ["op-locas"], subactions: ["Fixare doza", "Aliniere si nivelare"] }),
  O({ id: "op-doza-mod", code: "OP005", name: "Montare doza aparat modulara 3 module", category: "doze", unit: "buc", rate: 18, timeMin: 12, driver: "box_type_op", planStageId: "ps-doze", dependsOn: ["op-locas"] }),
  O({ id: "op-doza-mod4", code: "OP021", name: "Montare doza aparat modulara 4 module", category: "doze", unit: "buc", rate: 20, timeMin: 13, driver: "box_type_op", planStageId: "ps-doze", dependsOn: ["op-locas"] }),
  O({ id: "op-doza-mod7", code: "OP022", name: "Montare doza aparat modulara 7 module", category: "doze", unit: "buc", rate: 25, timeMin: 16, driver: "box_type_op", planStageId: "ps-doze", dependsOn: ["op-locas"] }),
  O({ id: "op-doza-ip", code: "OP023", name: "Montare doza aparenta IP55", category: "doze", unit: "buc", rate: 15, timeMin: 10, driver: "box_type_op", planStageId: "ps-doze" }),
  O({ id: "op-doza-dd", code: "OP006", name: "Montare doza derivatie", category: "doze", unit: "buc", rate: 15, timeMin: 10, driver: "box_type_op", planStageId: "ps-doze", dependsOn: ["op-locas"] }),
  O({ id: "op-punct-il", code: "OP020", name: "Executare punct de iluminat (capat cablu, fixare)", category: "doze", unit: "buc", rate: 10, timeMin: 8, driver: "device_type_op", planStageId: "ps-doze", dependsOn: ["op-trasare"], subactions: ["Locas / gaura in plafon sau perete", "Lasare capat de cablu marcat"] }),
  O({ id: "op-copex", code: "OP007", name: "Montare tub copex", category: "tuburi", unit: "m", rate: 3, timeMin: 1.2, driver: "conduit_m", planStageId: "ps-doze", dependsOn: ["op-sant"], subactions: ["Pozare tub in sant", "Fixare cu ipsos / bride"] }),
  O({ id: "op-cablu", code: "OP008", name: "Tragere cablu / conductoare", category: "cablare", unit: "m", rate: 2.5, timeMin: 1, driver: "cable_m", planStageId: "ps-cablare", dependsOn: ["op-copex"], subactions: ["Masurare segmente", "Pregatire cabluri", "Tragere", "Identificare si etichetare capete"] }),
  O({ id: "op-conex-dd", code: "OP009", name: "Conexiuni in doza de derivatie", category: "cablare", unit: "buc", rate: 10, timeMin: 8, driver: "dd_connections", planStageId: "ps-cablare", dependsOn: ["op-cablu"] }),
  O({ id: "op-tablou", code: "OP010", name: "Montare cutie tablou", category: "tablou", unit: "tablou", rate: 250, timeMin: 120, driver: "panels", wallSensitive: true, planStageId: "ps-tablouri", dependsOn: ["op-trasare"], parallelizable: false }),
  O({ id: "op-aparat-modular", code: "OP011", name: "Montare aparat modular pe sina DIN", category: "tablou", unit: "buc", rate: 15, timeMin: 8, driver: "panel_items", planStageId: "ps-tablouri", dependsOn: ["op-tablou"], parallelizable: false }),
  O({ id: "op-conectare-circuit", code: "OP012", name: "Conectare circuit nou in tablou", category: "tablou", unit: "circuit", rate: 15, timeMin: 10, driver: "new_circuits", planStageId: "ps-tablouri", dependsOn: ["op-aparat-modular", "op-cablu"], parallelizable: false }),
  O({ id: "op-feeder", code: "OP013", name: "Pozare alimentare intre tablouri", category: "cablare", unit: "m", rate: 4, timeMin: 2, driver: "feeder_m", planStageId: "ps-cablare", dependsOn: ["op-copex"] }),
  O({ id: "op-etichetare", code: "OP014", name: "Etichetare circuite si tablou", category: "tablou", unit: "circuit", rate: 3, timeMin: 2, driver: "circuits", planStageId: "ps-tablouri", dependsOn: ["op-conectare-circuit"] }),
  O({ id: "op-verificari", code: "OP015", name: "Verificari aferente fazei la rosu", category: "verificari", unit: "circuit", rate: 20, timeMin: 15, driver: "circuits", planStageId: "ps-verificari", dependsOn: ["op-etichetare", "op-conex-dd"], parallelizable: false, subactions: ["Continuitate conductoare si PE", "Rezistenta de izolatie", "Inregistrare rezultate"] }),
  O({ id: "op-demontare-tablou", code: "OP017", name: "Demontare tablou existent", category: "tablou", unit: "tablou", rate: 150, timeMin: 60, driver: "manual", planStageId: "ps-tablouri", parallelizable: false, subactions: ["Scoatere de sub tensiune si verificare lipsa tensiune", "Identificare si marcare circuite existente", "Demontare aparataj si cutie"] }),
  O({ id: "op-reconectare-existent", code: "OP018", name: "Identificare si reconectare circuit existent", category: "tablou", unit: "circuit", rate: 20, timeMin: 15, driver: "existing_circuits", planStageId: "ps-tablouri", dependsOn: ["op-aparat-modular"], parallelizable: false, subactions: ["Identificare circuit", "Verificare stare conductoare", "Conectare in tabloul nou"] }),
  O({ id: "op-legare-capete", code: "OP019", name: "Pregatire si legare capete cablu in doza / punct", category: "cablare", unit: "buc", rate: 6, timeMin: 5, driver: "end_points", planStageId: "ps-cablare", dependsOn: ["op-cablu"], subactions: ["Dezizolare si fasonare capete", "Legare / izolare provizorie", "Marcare circuit"] }),
  /* ------------------------- faza la gata ------------------------- */
  O({ id: "op-g-priza", code: "OP030", name: "Montare priza in doza", category: "aparataj", phase: "gata", unit: "buc", rate: 12, timeMin: 8, driver: "device_install_op", planStageId: "ps-aparataj", subactions: ["Conectare conductoare", "Fixare aparat si rama", "Proba"] }),
  O({ id: "op-g-intr", code: "OP031", name: "Montare intrerupator / comutator", category: "aparataj", phase: "gata", unit: "buc", rate: 12, timeMin: 8, driver: "device_install_op", planStageId: "ps-aparataj" }),
  O({ id: "op-g-comanda", code: "OP032", name: "Montare termostat / senzor / buton", category: "aparataj", phase: "gata", unit: "buc", rate: 20, timeMin: 15, driver: "device_install_op", planStageId: "ps-aparataj" }),
  O({ id: "op-g-corp", code: "OP033", name: "Montare corp de iluminat plafon (lustra / plafoniera)", category: "aparataj", phase: "gata", unit: "buc", rate: 35, timeMin: 25, driver: "device_install_op", planStageId: "ps-aparataj", subactions: ["Fixare suport", "Conectare", "Proba"] }),
  O({ id: "op-g-aplica", code: "OP034", name: "Montare aplica", category: "aparataj", phase: "gata", unit: "buc", rate: 25, timeMin: 20, driver: "device_install_op", planStageId: "ps-aparataj" }),
  O({ id: "op-g-spot", code: "OP035", name: "Montare spot incastrat", category: "aparataj", phase: "gata", unit: "buc", rate: 12, timeMin: 8, driver: "device_install_op", planStageId: "ps-aparataj" }),
  O({ id: "op-g-led", code: "OP036", name: "Montare banda LED cu alimentator", category: "aparataj", phase: "gata", unit: "buc", rate: 40, timeMin: 30, driver: "device_install_op", planStageId: "ps-aparataj" }),
  O({ id: "op-g-dedicat", code: "OP037", name: "Racordare consumator dedicat", category: "aparataj", phase: "gata", unit: "buc", rate: 40, timeMin: 30, driver: "device_install_op", planStageId: "ps-aparataj" }),
  O({ id: "op-g-verificari", code: "OP039", name: "Verificari finale, probe si predare", category: "verificari", phase: "gata", unit: "circuit", rate: 15, timeMin: 10, driver: "circuits", planStageId: "ps-final", dependsOn: ["op-g-priza"] }),
  O({ id: "op-deplasare", code: "OP016", name: "Deplasare / organizare santier", category: "diverse", unit: "proiect", rate: 0, timeMin: 0, driver: "manual", planStageId: "ps-pregatire", active: true }),
];

/* ------------------------- reguli tehnice -------------------------- */
const R = (r: Partial<TechnicalRule> & Pick<TechnicalRule, "id" | "code" | "title" | "classification" | "reference">): TechnicalRule => ({
  source: "Normativ I7-2011 (cu modificarile ulterioare)",
  version: "I7-2011 / Ord. 959/2023",
  scope: "Instalatii electrice in cladiri, < 1 kV",
  conditions: "",
  params: {},
  validation: "de_validat",
  validatedBy: "",
  validatedAt: null,
  notes: "",
  ...r,
});

const rules: TechnicalRule[] = [
  R({ id: "r-ib-iz", code: "R001", title: "Curentul de calcul nu depaseste curentul admisibil corectat (Ic <= I'z)", classification: "cerinta_normativa", reference: "art. 5.2.4.1.2", conditions: "Pentru toate circuitele cu putere cunoscuta." }),
  R({ id: "r-iz-corectat", code: "R002", title: "Curent admisibil corectat I'z = Iz x K1 x K2", classification: "cerinta_normativa", reference: "anexele 5.10, 5.18, 5.19, 5.30", conditions: "Metoda de pozare, temperatura ambianta si gruparea trebuie cunoscute." }),
  R({ id: "r-sectiune-min", code: "R003", title: "Sectiuni minime conductoare de faza (cupru): iluminat 1,5; prize monofazate 2,5; putere 1,5; coloane monofazate locuinte 4 mm2", classification: "cerinta_normativa", reference: "anexa 5.32 poz. 1.1-1.4", params: { lighting: 1.5, sockets: 2.5, power: 1.5, feederMono: 4 } }),
  R({ id: "r-du", code: "R004", title: "Caderea de tensiune admisibila (alimentare din bransament JT)", classification: "cerinta_normativa", reference: "art. 5.2.5.1", params: { lightingPct: 3, otherPct: 5 }, conditions: "Alimentare din cofret de bransament JT; pe traseul cel mai lung si mai incarcat. Pentru PT/centrala proprie: 6% / 8% (art. 5.2.5.2)." }),
  R({ id: "r-n-comun", code: "R009", title: "Conductorul neutru nu poate fi comun pentru mai multe circuite", classification: "cerinta_normativa", reference: "art. 5.2.4.6.4" }),
  R({ id: "r-conexiuni-doze", code: "R010", title: "Legaturile intre conductoare se fac numai in accesorii prevazute (doze, cutii)", classification: "cerinta_normativa", reference: "art. 5.2.6.4" }),
  R({ id: "r-coord-prot", code: "R005", title: "Coordonare protectie - conductor: Ib <= In <= I'z", classification: "standard_tehnic", reference: "SR HD 60364-4-43 / I7-2011 cap. 5", conditions: "Pentru protectia la suprasarcina." }),
  R({ id: "r-rcd-prize", code: "R006", title: "In locuinte, protectia prin dispozitive diferentiale (DDR) este masura tehnica principala", classification: "cerinta_normativa", reference: "art. 5.3.4.1.2.3 (HG 1146/2006)", params: { maxSensitivityMA: 30 }, conditions: "Toate circuitele finale din locuinte; 30 mA pentru prize si circuite cu risc marit." }),
  R({ id: "r-iluminat-distinct", code: "R014", title: "Circuitele iluminatului normal sunt distincte de circuitele de prize", classification: "cerinta_normativa", reference: "art. 5.4.1" }),
  R({ id: "r-iluminat-putere", code: "R015", title: "Putere instalata recomandata pe circuit de iluminat: max 3 kW monofazat / 8 kW trifazat", classification: "recomandare", reference: "art. 5.4.5", params: { monoKW: 3, triKW: 8 } }),
  R({ id: "r-receptor-2kw", code: "R016", title: "In locuinte, receptoarele peste 2 kW au circuit de priza separat", classification: "cerinta_normativa", reference: "art. 5.4.7", params: { maxKW: 2 } }),
  R({ id: "r-putere-disponibila", code: "R017", title: "Puterea aplicata a instalatiei nu depaseste puterea disponibila (aprobata / protectia generala)", classification: "standard_tehnic", reference: "conditie de alimentare (ATR / BMPT)", source: "WATTNET", version: "1", conditions: "Puterea aplicata include simultaneitatea pe circuite si cea globala." }),
  R({ id: "r-circuit-tablou", code: "R018", title: "Fiecare circuit final este alimentat dintr-un tablou si are protectie proprie", classification: "conventie_wattnet", reference: "conventie interna", source: "WATTNET", version: "1" }),
  R({ id: "r-rcd-grupare", code: "R013", title: "Numar maxim de circuite pe un intrerupator diferential (la echiparea automata)", classification: "conventie_wattnet", reference: "conventie interna", source: "WATTNET", version: "1", params: { maxCircuits: 6 } }),
  R({ id: "r-echilibrare", code: "R007", title: "Echilibrarea sarcinilor pe faze (abatere maxima recomandata)", classification: "conventie_wattnet", reference: "conventie interna", source: "WATTNET", version: "1", params: { maxImbalancePct: 20 } }),
  R({ id: "r-incarcare-grupare", code: "R011", title: "Incarcare maxima la gruparea automata a punctelor pe circuit", classification: "conventie_wattnet", reference: "conventie interna", source: "WATTNET", version: "1", params: { maxLoadPct: 80 }, notes: "Puterea aplicata a circuitului (P instalata x ks) nu depaseste acest procent din In x U x cos φ. Nu inlocuieste verificarea circuitului." }),
  R({ id: "r-rezerva-cablu", code: "R012", title: "Rezerva de cablu la capete (doze, tablou)", classification: "conventie_wattnet", reference: "conventie interna", source: "WATTNET", version: "1", params: { reserveM: 1 } }),
  R({ id: "r-rezerva-tablou", code: "R008", title: "Rezerva de module in tablou", classification: "conventie_wattnet", reference: "conventie interna", source: "WATTNET", version: "1", params: { minReservePct: 20 } }),
];

/* ---- tabele de curenti admisibili (I7-2011 anexa 5.10, PVC, Cu) ---- */
const ampacityTables: AmpacityTable[] = [
  {
    id: "amp-pvc-cu-2",
    name: "PVC, cupru, 2 conductoare incarcate",
    source: "Normativ I7-2011",
    reference: "anexa 5.10",
    conductorMaterial: "cupru",
    insulation: "PVC",
    loadedConductors: 2,
    values: {
      A1: { "1.5": 14.5, "2.5": 19.5, "4": 26, "6": 34, "10": 46, "16": 61, "25": 80 },
      A2: { "1.5": 14, "2.5": 18.5, "4": 25, "6": 32, "10": 43, "16": 57, "25": 75 },
      B1: { "1.5": 17.5, "2.5": 24, "4": 32, "6": 41, "10": 57, "16": 76, "25": 101 },
      B2: { "1.5": 16.5, "2.5": 23, "4": 30, "6": 38, "10": 52, "16": 69, "25": 90 },
      C: { "1.5": 19.5, "2.5": 27, "4": 36, "6": 46, "10": 63, "16": 85, "25": 112 },
    },
    validation: "de_validat",
  },
  {
    id: "amp-pvc-cu-3",
    name: "PVC, cupru, 3 conductoare incarcate",
    source: "Normativ I7-2011",
    reference: "anexa 5.10",
    conductorMaterial: "cupru",
    insulation: "PVC",
    loadedConductors: 3,
    values: {
      A1: { "1.5": 13.5, "2.5": 18, "4": 24, "6": 31, "10": 42, "16": 56, "25": 73 },
      A2: { "1.5": 13, "2.5": 17.5, "4": 23, "6": 29, "10": 39, "16": 52, "25": 68 },
      B1: { "1.5": 15.5, "2.5": 21, "4": 28, "6": 36, "10": 50, "16": 68, "25": 89 },
      B2: { "1.5": 15, "2.5": 20, "4": 27, "6": 34, "10": 46, "16": 62, "25": 80 },
      C: { "1.5": 17.5, "2.5": 24, "4": 32, "6": 41, "10": 57, "16": 76, "25": 96 },
    },
    validation: "de_validat",
  },
];

const correctionTables: CorrectionTable[] = [
  {
    id: "k1-pvc",
    name: "K1 - temperatura ambianta, izolatie PVC (aer)",
    source: "Normativ I7-2011",
    reference: "anexa 5.18",
    values: { "10": 1.22, "15": 1.17, "20": 1.12, "25": 1.06, "30": 1.0, "35": 0.94, "40": 0.87, "45": 0.79, "50": 0.71 },
    validation: "de_validat",
  },
  {
    id: "k2-grup-incastrat",
    name: "K2 - grupare, cabluri grupate in aer / incastrate / in tub (poz. 1)",
    source: "Normativ I7-2011",
    reference: "anexa 5.19 poz. 1",
    values: { "1": 1.0, "2": 0.8, "3": 0.7, "4": 0.65, "5": 0.6, "6": 0.57, "7": 0.54, "8": 0.52, "9": 0.5, "12": 0.45 },
    validation: "de_validat",
  },
  {
    id: "k2-grup-perete",
    name: "K2 - grupare, un singur strat pe perete (poz. 2)",
    source: "Normativ I7-2011",
    reference: "anexa 5.19 poz. 2",
    values: { "1": 1.0, "2": 0.85, "3": 0.79, "4": 0.75, "5": 0.73, "6": 0.72, "7": 0.72, "8": 0.71, "9": 0.7 },
    validation: "de_validat",
  },
];

/* ------------------------------ sabloane --------------------------- */
const templates: ProjectTemplate[] = [
  {
    id: "tpl-ap2",
    name: "Apartament 2 camere",
    kind: "apartament",
    levels: [
      {
        name: "Apartament",
        elevation: 0,
        rooms: [
          { name: "Hol", roomTypeId: "rt-hol", l: 4, w: 1.4, h: 2.7 },
          { name: "Living", roomTypeId: "rt-living", l: 5, w: 4, h: 2.7 },
          { name: "Bucatarie", roomTypeId: "rt-bucatarie", l: 3.5, w: 3, h: 2.7 },
          { name: "Dormitor", roomTypeId: "rt-dormitor", l: 4, w: 3.5, h: 2.7 },
          { name: "Baie", roomTypeId: "rt-baie", l: 2.5, w: 2, h: 2.6 },
        ],
      },
    ],
  },
  {
    id: "tpl-ap3",
    name: "Apartament 3 camere",
    kind: "apartament",
    levels: [
      {
        name: "Apartament",
        elevation: 0,
        rooms: [
          { name: "Hol intrare", roomTypeId: "rt-hol", l: 5, w: 1.5, h: 2.7 },
          { name: "Living", roomTypeId: "rt-living", l: 5.5, w: 4.2, h: 2.7 },
          { name: "Bucatarie", roomTypeId: "rt-bucatarie", l: 3.5, w: 3, h: 2.7 },
          { name: "Dormitor mare", roomTypeId: "rt-dormitor", l: 4.2, w: 3.6, h: 2.7 },
          { name: "Dormitor mic", roomTypeId: "rt-dormitor", l: 3.5, w: 3, h: 2.7 },
          { name: "Baie mare", roomTypeId: "rt-baie", l: 2.6, w: 2.1, h: 2.6 },
          { name: "Baie mica", roomTypeId: "rt-baie", l: 2, w: 1.6, h: 2.6 },
        ],
      },
    ],
  },
  {
    id: "tpl-casa-pe",
    name: "Casa P+E",
    kind: "casa",
    levels: [
      {
        name: "Parter",
        elevation: 0,
        rooms: [
          { name: "Hol", roomTypeId: "rt-hol", l: 4, w: 2, h: 2.8 },
          { name: "Living", roomTypeId: "rt-living", l: 7, w: 5, h: 2.8 },
          { name: "Bucatarie", roomTypeId: "rt-bucatarie", l: 4, w: 3.5, h: 2.8 },
          { name: "Baie parter", roomTypeId: "rt-baie", l: 2.2, w: 1.8, h: 2.6 },
          { name: "Camera tehnica", roomTypeId: "rt-tehnica", l: 2.5, w: 2, h: 2.6 },
          { name: "Casa scarii", roomTypeId: "rt-scara", l: 3, w: 2, h: 2.8 },
        ],
      },
      {
        name: "Etaj 1",
        elevation: 1,
        rooms: [
          { name: "Hol etaj", roomTypeId: "rt-hol", l: 4, w: 1.6, h: 2.7 },
          { name: "Dormitor matrimonial", roomTypeId: "rt-dormitor", l: 4.5, w: 4, h: 2.7 },
          { name: "Dormitor 2", roomTypeId: "rt-dormitor", l: 4, w: 3.5, h: 2.7 },
          { name: "Dormitor 3", roomTypeId: "rt-dormitor", l: 3.8, w: 3.2, h: 2.7 },
          { name: "Baie etaj", roomTypeId: "rt-baie", l: 2.8, w: 2.2, h: 2.6 },
        ],
      },
    ],
  },
  { id: "tpl-gol", name: "Proiect personalizat (gol)", kind: "altul", levels: [{ name: "Parter", elevation: 0, rooms: [] }] },
];

export function createDefaultLibrary(): Library {
  // clonare profunda ca biblioteca sa poata fi modificata fara efecte globale
  return normalizeLinks(structuredClone({
    meta: {
      name: "Biblioteca WATTNET",
      version: DEFAULT_LIBRARY_VERSION,
      updatedAt: new Date().toISOString(),
      notes: "Valori exemplu. Actualizeaza tarifele, timpii si preturile, apoi exporta biblioteca.",
      defaultsRev: DEFAULTS_REV,
    },
    firm,
    roomTypes,
    wallTypes,
    difficultyFactors,
    deviceTypes,
    pointPurposes,
    boxTypes,
    cableTypes,
    conduitTypes,
    protectionDevices,
    enclosureTypes,
    installMethods,
    circuitTypes,
    operations,
    materials,
    planStages,
    rules,
    ampacityTables,
    correctionTables,
    templates,
  } satisfies Library));
}
