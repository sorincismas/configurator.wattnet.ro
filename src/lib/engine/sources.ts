/**
 * De unde isi ia cantitatea o operatie: fie dintr-un calcul general pe proiect
 * (metri de sant, numar de circuite ...), fie de la elementele din catalog care
 * au aceasta operatie ca pret de executie (tipuri de doze, aparataj, cabluri ...).
 */
import type { Library, Operation, QuantityDriver } from "../model/types";

export type SourceTab = "doze" | "aparate" | "cabluri" | "tablouri" | "protectii";

export const TAB_LABEL: Record<SourceTab, string> = { doze: "Doze", aparate: "Aparate si consumatori", cabluri: "Cabluri si copex", tablouri: "Cutii tablou", protectii: "Aparate tablou" };

/** sursele generale (calculate din proiect), alese explicit pe operatie */
export const GENERAL_SOURCES: { value: QuantityDriver; label: string }[] = [
  { value: "manual", label: "Cantitate introdusa manual in deviz" },
  { value: "points_total", label: "Toate punctele (doze + tablouri)" },
  { value: "box_recesses", label: "Locasuri doze (ingropate)" },
  { value: "boxes_da_all", label: "Doze aparat (toate)" },
  { value: "boxes_da_round", label: "Doze aparat rotunde" },
  { value: "boxes_da_modular", label: "Doze aparat modulare" },
  { value: "boxes_dd", label: "Doze derivatie" },
  { value: "dd_connections", label: "Conexiuni in doze derivatie" },
  { value: "end_points", label: "Capete de legat (doze + puncte fara doza)" },
  { value: "route_chase_m", label: "Metri sant" },
  { value: "conduit_m", label: "Metri tub (tipuri fara pret propriu)" },
  { value: "cable_m", label: "Metri cablu (tipuri fara pret propriu)" },
  { value: "feeder_m", label: "Metri alimentare intre tablouri" },
  { value: "panels", label: "Tablouri (cutii fara pret propriu)" },
  { value: "panel_items", label: "Aparate modulare (fara pret propriu)" },
  { value: "circuits", label: "Circuite (toate)" },
  { value: "new_circuits", label: "Circuite noi" },
  { value: "existing_circuits", label: "Circuite existente (reconectate)" },
  { value: "rooms", label: "Incaperi" },
];

const LINKED: Partial<Record<QuantityDriver, { tab: SourceTab; what: string; items: (l: Library, opId: string) => string[] }>> = {
  box_type_op: { tab: "doze", what: "tipuri de doza", items: (l, id) => l.boxTypes.filter((t) => t.operationId === id).map((t) => t.name) },
  device_type_op: { tab: "aparate", what: "puncte fara doza (la rosu)", items: (l, id) => l.deviceTypes.filter((t) => t.operationId === id).map((t) => t.name) },
  device_install_op: { tab: "aparate", what: "aparataj / corpuri (la gata)", items: (l, id) => l.deviceTypes.filter((t) => t.installOperationId === id).map((t) => t.name) },
  cable_type_op: { tab: "cabluri", what: "tipuri de cablu", items: (l, id) => l.cableTypes.filter((t) => t.operationId === id).map((t) => t.name) },
  conduit_type_op: { tab: "cabluri", what: "tipuri de tub", items: (l, id) => l.conduitTypes.filter((t) => t.operationId === id).map((t) => t.name) },
  enclosure_type_op: { tab: "tablouri", what: "cutii de tablou", items: (l, id) => l.enclosureTypes.filter((t) => t.operationId === id).map((t) => t.name) },
  protection_type_op: { tab: "protectii", what: "aparate de tablou", items: (l, id) => l.protectionDevices.filter((t) => t.operationId === id).map((t) => t.name) },
};

export const isLinkedDriver = (d: QuantityDriver) => d in LINKED;

export interface OperationSource {
  linked: boolean;
  tab: SourceTab | null;
  /** ex. „Doze” sau „Calcul din proiect” */
  origin: string;
  /** ex. „Doza aparat rotunda D68, Doza IP55” sau „Metri sant” */
  detail: string;
  items: string[];
}

export function operationSource(lib: Library, op: Pick<Operation, "id" | "driver">): OperationSource {
  const k = LINKED[op.driver];
  if (k) {
    const items = k.items(lib, op.id);
    return { linked: true, tab: k.tab, origin: TAB_LABEL[k.tab], detail: items.length ? items.join(", ") : `niciun element legat (${k.what})`, items };
  }
  const g = GENERAL_SOURCES.find((x) => x.value === op.driver);
  return { linked: false, tab: null, origin: op.driver === "manual" ? "Manual" : "Calcul din proiect", detail: g?.label ?? op.driver, items: [] };
}

/** textul scurt afisat in deviz sub operatie */
export function sourceText(lib: Library, op: Pick<Operation, "id" | "driver">): string {
  const s = operationSource(lib, op);
  if (!s.linked) return s.detail;
  const short = s.items.length > 3 ? `${s.items.slice(0, 3).join(", ")} +${s.items.length - 3}` : s.detail;
  return `din ${s.origin}: ${short}`;
}
