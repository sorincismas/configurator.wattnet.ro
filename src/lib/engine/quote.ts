/**
 * Deviz (cap. 10.4) si documentele pentru beneficiar.
 *
 * Din acelasi calcul (computeLabor / computeMaterials / computeTotals) se obtin:
 *  - subtotaluri pe categorie, faza, nivel, incapere, tablou;
 *  - tariful orar implicit pe fiecare grup;
 *  - oferta / devizul si factura proforma, fiecare in varianta simplificata
 *    (grupat pe categorii) si detaliata (toate operatiile si materialele).
 */
import type { Project } from "../model/types";
import { round } from "./measure";
import { computeLabor, computeMaterials, computeTotals, resolveScope, sourcePanels, type LaborLine, type LaborResult, type MaterialsResult, type QuoteTotals } from "./pricing";

export const CATEGORY_TITLE: Record<string, string> = {
  trasare: "Trasare si pregatire",
  sant: "Santuri si canale",
  doze: "Doze si locasuri",
  tuburi: "Tuburi de protectie (copex)",
  cablare: "Cablare",
  tablou: "Tablou electric",
  aparataj: "Aparataj si corpuri de iluminat (la gata)",
  verificari: "Verificari si masuratori",
  diverse: "Diverse",
};
export const categoryTitle = (c: string) => CATEGORY_TITLE[c] ?? c.charAt(0).toUpperCase() + c.slice(1);

const MATERIAL_TITLE: Record<string, string> = {
  cabluri: "Cabluri si conductoare",
  tuburi: "Tuburi de protectie",
  doze: "Doze",
  aparataj: "Aparataj si corpuri de iluminat",
  tablouri: "Cutii tablou",
  protectii: "Aparataj modular de protectie",
  accesorii: "Accesorii tablou",
  consumabile: "Consumabile",
  curenti_slabi: "Curenti slabi",
};

/* ---------------------------- subtotaluri -------------------------- */

export type GroupBy = "categorie" | "faza" | "nivel" | "incapere" | "tablou";

export interface Subtotal {
  key: string;
  label: string;
  value: number;
  timeMin: number;
  hourlyRate: number | null;
  lines: number;
}

/**
 * Imparte valoarea fiecarei linii pe grupuri. Pentru nivel / incapere / tablou
 * se folosesc alocarile liniei (proportional cu valoarea lor); ce nu poate fi
 * atribuit (cantitati manuale, costuri suplimentare) apare ca "Neatribuit".
 */
export function subtotals(p: Project, labor: LaborResult, by: GroupBy): Subtotal[] {
  const m = new Map<string, Subtotal & { ids: Set<string> }>();
  const add = (key: string, label: string, value: number, timeMin: number, lineId: string) => {
    const s = m.get(key) ?? { key, label, value: 0, timeMin: 0, hourlyRate: null, lines: 0, ids: new Set<string>() };
    s.value += value;
    s.timeMin += timeMin;
    s.ids.add(lineId);
    m.set(key, s);
  };
  const NA = { key: "-", label: "Neatribuit" };
  const roomG = (roomId: string | null) => {
    const r = p.rooms.find((x) => x.id === roomId);
    return r ? { key: r.id, label: r.name } : NA;
  };
  const levelG = (roomId: string | null) => {
    const r = p.rooms.find((x) => x.id === roomId);
    const l = r ? p.levels.find((x) => x.id === r.levelId) : undefined;
    return l ? { key: l.id, label: l.name } : NA;
  };
  const panelG = (sourceIds: string[]) => {
    const ps = [...new Set(sourceIds.flatMap((id) => [...sourcePanels(p, id)]))];
    const t = p.panels.find((x) => x.id === ps[0]);
    return t ? { key: t.id, label: `${t.code} ${t.name}` } : NA;
  };

  for (const l of labor.lines.filter((x) => x.enabled)) {
    const id = l.operation.id;
    if (by === "categorie") {
      add(l.operation.category, categoryTitle(l.operation.category), l.value, l.timeMin, id);
      continue;
    }
    if (by === "faza") {
      add(l.operation.phase, l.operation.phase === "rosu" ? "Faza la rosu" : "Faza la gata", l.value, l.timeMin, id);
      continue;
    }
    const allocValue = l.allocations.reduce((s, a) => s + a.value, 0);
    const allocTime = l.allocations.reduce((s, a) => s + a.timeMin, 0);
    if (l.allocations.length === 0 || allocValue === 0) {
      add(NA.key, NA.label, l.value, l.timeMin, id);
      continue;
    }
    // cantitate / tarif modificate manual: se pastreaza proportiile alocarilor
    const kv = l.value / allocValue;
    const kt = allocTime > 0 ? l.timeMin / allocTime : 0;
    for (const a of l.allocations) {
      const g = by === "incapere" ? roomG(a.roomId) : by === "nivel" ? levelG(a.roomId) : panelG(a.sourceIds);
      add(g.key, g.label, a.value * kv, a.timeMin * kt, id);
    }
  }
  labor.extras.forEach((e, i) => add("extra", "Costuri suplimentare", e.amount, e.timeMin, `extra-${i}`));
  return [...m.values()]
    .map(({ ids, ...s }) => ({ ...s, lines: ids.size, value: round(s.value, 2), timeMin: round(s.timeMin, 1), hourlyRate: s.timeMin > 0 ? round(s.value / (s.timeMin / 60), 2) : null }))
    .sort((a, b) => (a.key === "-" ? 1 : b.key === "-" ? -1 : b.value - a.value));
}

/** operatiile care influenteaza cel mai mult valoarea / timpul (cap. 10.2) */
export function topDrivers(labor: LaborResult, n = 5) {
  const active = labor.lines.filter((l) => l.enabled);
  const tv = active.reduce((s, l) => s + l.value, 0) || 1;
  const tt = active.reduce((s, l) => s + l.timeMin, 0) || 1;
  return {
    byValue: [...active].sort((a, b) => b.value - a.value).slice(0, n).map((l) => ({ line: l, pct: round((l.value / tv) * 100, 1) })),
    byTime: [...active].sort((a, b) => b.timeMin - a.timeMin).slice(0, n).map((l) => ({ line: l, pct: round((l.timeMin / tt) * 100, 1) })),
  };
}

/* ----------------------------- documente --------------------------- */

export type DocKind = "oferta" | "proforma";
export type DocDetail = "simplificat" | "detaliat";

export interface DocRow {
  code: string;
  name: string;
  unit: string;
  quantity: number | null;
  unitPrice: number | null;
  value: number;
}

export interface QuoteDocument {
  kind: DocKind;
  detail: DocDetail;
  title: string;
  number: string;
  date: string; // ISO yyyy-mm-dd
  /** oferta: valabila pana la; proforma: scadenta */
  untilDate: string;
  scopeLabel: string;
  laborRows: DocRow[];
  materialRows: DocRow[];
  extras: DocRow[];
  totals: QuoteTotals & {
    laborSubtotal: number;
    laborDiscount: number;
    materialsSubtotal: number | null;
    materialsDiscount: number | null;
  };
  /** proforma: procent si suma de plata */
  advancePct: number;
  payable: number;
  hours: number;
  warnings: string[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (isoDate: string, days: number) => {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + days);
  return iso(d);
};

function detailedLaborRows(lines: LaborLine[]): DocRow[] {
  return lines
    .filter((l) => l.enabled)
    .map((l) => ({
      code: l.operation.code,
      name: l.operation.name,
      unit: l.operation.unit,
      quantity: l.quantity,
      // pretul unitar include factorii de dificultate (valoare / cantitate)
      unitPrice: l.quantity > 0 ? round(l.value / l.quantity, 2) : l.rate,
      value: l.value,
    }));
}

function simplifiedLaborRows(lines: LaborLine[]): DocRow[] {
  const m = new Map<string, DocRow>();
  for (const l of lines.filter((x) => x.enabled)) {
    const k = l.operation.category;
    const r = m.get(k) ?? { code: "", name: categoryTitle(k), unit: "", quantity: null, unitPrice: null, value: 0 };
    r.value = round(r.value + l.value, 2);
    m.set(k, r);
  }
  const order = Object.keys(CATEGORY_TITLE);
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : 99);
  return [...m.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([, r], i) => ({ ...r, code: String(i + 1) }));
}

function materialRows(p: Project, mat: MaterialsResult, detail: DocDetail): DocRow[] {
  if (detail === "detaliat")
    return mat.lines.map((m) => ({ code: m.code, name: [m.name, m.brand].filter(Boolean).join(" - "), unit: m.unit, quantity: m.quantity, unitPrice: m.offerPrice, value: m.value }));
  const cat = new Map<string, DocRow>();
  for (const m of mat.lines) {
    const c = p.library.materials.find((x) => x.id === m.materialId)?.category ?? "diverse";
    const r = cat.get(c) ?? { code: "", name: MATERIAL_TITLE[c] ?? c, unit: "", quantity: null, unitPrice: null, value: 0 };
    r.value = round(r.value + m.value, 2);
    cat.set(c, r);
  }
  return [...cat.values()].map((r, i) => ({ ...r, code: String(i + 1) }));
}

export const phaseLabel = (p: Project) => (p.info.phases.includes("rosu") && p.info.phases.includes("gata") ? "faza la rosu + faza la gata" : p.info.phases.includes("gata") ? "faza la gata" : "faza la rosu");

export function buildDocument(p: Project, kind: DocKind, detail: DocDetail): QuoteDocument {
  const labor = computeLabor(p);
  const mat = computeMaterials(p);
  const totals = computeTotals(p, labor, mat);
  const scope = resolveScope(p);
  const firm = p.library.firm;
  const warnings: string[] = [];
  if (labor.lines.some((l) => l.enabled && l.operation.isExample)) warnings.push("Devizul contine tarife exemplu din biblioteca - actualizeaza-le inainte de a trimite documentul.");
  if (p.quote.includeMaterials && mat.lines.length && p.library.materials.some((m) => m.isExample && mat.lines.some((x) => x.materialId === m.id))) warnings.push("Materialele au preturi exemplu.");
  if (mat.unmapped.length && p.quote.includeMaterials) warnings.push(`${mat.unmapped.length} elemente fara material asociat in catalog (nu apar in lista de materiale).`);
  if (!p.info.client.name) warnings.push("Beneficiarul nu este completat.");

  const today = iso(new Date());
  const pf = p.quote.proforma;
  const date = kind === "proforma" ? pf?.issueDate ?? today : p.quote.offerDate ?? today;
  const number = kind === "proforma" ? pf?.number ?? "neatribuit" : `OF-${p.info.code}${p.issued.length ? `-R${String(p.issued.length + 1).padStart(2, "0")}` : ""}`;
  const untilDate = kind === "proforma" ? addDays(date, pf?.dueDays ?? firm.paymentTermsDays) : addDays(date, p.quote.validityDays);
  if (kind === "proforma" && !pf?.number) warnings.push("Proforma nu are numar atribuit.");
  const advancePct = kind === "proforma" ? Math.min(100, Math.max(1, pf?.advancePct ?? 100)) : 100;

  return {
    kind,
    detail,
    title: kind === "proforma" ? "FACTURA PROFORMA" : detail === "detaliat" ? "OFERTA - DEVIZ DETALIAT" : "OFERTA DE PRET",
    number,
    date,
    untilDate,
    scopeLabel: `${scope.label} · ${phaseLabel(p)}`,
    laborRows: detail === "detaliat" ? detailedLaborRows(labor.lines) : simplifiedLaborRows(labor.lines),
    materialRows: p.quote.includeMaterials ? materialRows(p, mat, detail) : [],
    extras: labor.extras.map((e, i) => ({ code: `S${i + 1}`, name: e.label, unit: "", quantity: null, unitPrice: null, value: e.amount })),
    totals: {
      ...totals,
      laborSubtotal: labor.subtotal,
      laborDiscount: labor.discount,
      materialsSubtotal: p.quote.includeMaterials ? mat.subtotal : null,
      materialsDiscount: p.quote.includeMaterials ? mat.discount : null,
    },
    advancePct,
    payable: round((totals.gross * advancePct) / 100, 2),
    hours: labor.hours,
    warnings,
  };
}

/** atribuie urmatorul numar de proforma din seria firmei (modifica proiectul primit) */
export function assignProformaNumber(p: Project, seriesNext: number, series: string): string {
  const number = `${series} ${String(seriesNext).padStart(4, "0")}`;
  p.quote.proforma = { ...(p.quote.proforma ?? defaultProforma(p)), number, issueDate: p.quote.proforma?.issueDate ?? iso(new Date()) };
  return number;
}

export function defaultProforma(p: Project) {
  return { number: null, issueDate: null, dueDays: p.library.firm.paymentTermsDays, advancePct: 100, notes: "" };
}
