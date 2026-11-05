/**
 * Dimensionare asistata (cap. 7.3) - calcule verificabile, fara hardcodari:
 *   I'z = Iz(metoda, sectiune) x K1(temperatura) x K2(grupare)   [I7 anexele 5.10, 5.18, 5.19]
 *   coordonare Ic <= In <= I'z                                     [I7 art. 5.2.4.1.2]
 *   ΔU% = k x L x Ic x cos φ / (γ x S) / U x 100, k = 2 (mono), √3 (tri)   [I7 art. 5.2.5.1]
 * Reactanta conductoarelor este neglijata (sectiuni mici, joasa tensiune) - ipoteza afisata.
 */
import type { AmpacityTable, CableType, Circuit, CorrectionTable, Library, Panel, Project } from "../model/types";
import { circuitLoad } from "./circuits";
import { round } from "./measure";

export const STD_RATINGS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
export const STD_SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25];
const GAMMA = { cupru: 56, aluminiu: 34 } as const; // m / (Ω·mm²)

export interface IzResult {
  iz: number | null; // din tabel
  k1: number | null;
  k2: number | null;
  izCorrected: number | null;
  method: string | null;
  table: AmpacityTable | null;
  missing: string[];
}

/** interpolare liniara intre cheile numerice ale unui tabel de corectie */
export function lookupFactor(t: CorrectionTable | undefined, x: number): number | null {
  if (!t) return null;
  const pts = Object.entries(t.values).map(([k, v]) => [Number(k), v] as const).sort((a, b) => a[0] - b[0]);
  if (pts.length === 0) return null;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      // la grupare se ia valoarea mai defavorabila (treapta superioara), la temperatura interpolare
      if (t.id.startsWith("k2")) return y1;
      return round(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0), 3);
    }
  }
  return pts.at(-1)![1];
}

export function ampacity(lib: Library, cable: CableType | undefined, methodRef: string | null, ambientC: number, grouped: number): IzResult {
  const missing: string[] = [];
  if (!cable) missing.push("tip cablu");
  if (!methodRef) missing.push("metoda de pozare");
  if (!cable || !methodRef) return { iz: null, k1: null, k2: null, izCorrected: null, method: methodRef, table: null, missing };
  const table = lib.ampacityTables.find((t) => t.conductorMaterial === cable.conductorMaterial && t.insulation === cable.insulation && t.loadedConductors === cable.loadedConductors) ?? null;
  if (!table) missing.push(`tabel Iz pentru ${cable.conductorMaterial}/${cable.insulation}/${cable.loadedConductors} conductoare`);
  const iz = table?.values[methodRef]?.[String(cable.crossSectionMm2)] ?? null;
  if (table && iz === null) missing.push(`Iz pentru ${cable.crossSectionMm2} mm² metoda ${methodRef}`);
  const k1 = lookupFactor(lib.correctionTables.find((t) => t.id === (cable.insulation === "PVC" ? "k1-pvc" : "k1-xlpe")), ambientC);
  if (k1 === null) missing.push("factor K1");
  const k2t = methodRef === "C" ? "k2-grup-perete" : "k2-grup-incastrat";
  const k2 = grouped <= 1 ? 1 : lookupFactor(lib.correctionTables.find((t) => t.id === k2t), grouped);
  if (k2 === null) missing.push("factor K2");
  const izCorrected = iz !== null && k1 !== null && k2 !== null ? round(iz * k1 * k2, 2) : null;
  return { iz, k1, k2, izCorrected, method: methodRef, table, missing };
}

export function voltageDropPct(system: "mono" | "tri", lengthM: number, currentA: number, cosPhi: number, sectionMm2: number, material: "cupru" | "aluminiu", voltageV: number): number {
  const k = system === "mono" ? 2 : Math.sqrt(3);
  const du = (k * lengthM * currentA * cosPhi) / (GAMMA[material] * sectionMm2);
  return round((du / voltageV) * 100, 2);
}

/* ------------------- ΔU in amonte (alimentari de tablou) ------------ */

export interface PanelLoad {
  appliedW: number;
  currentA: number | null;
  system: "mono" | "tri";
}

/** sarcina unui tablou (inclusiv tablourile din aval) */
export function panelLoad(p: Project, panelId: string, seen = new Set<string>()): PanelLoad {
  seen.add(panelId);
  let w = 0;
  for (const c of p.circuits.filter((x) => x.panelId === panelId)) w += circuitLoad(p, c).appliedW ?? 0;
  for (const child of p.panels.filter((t) => t.parentPanelId === panelId && !seen.has(t.id))) w += panelLoad(p, child.id, seen).appliedW;
  const panel = p.panels.find((t) => t.id === panelId);
  const ct = p.library.cableTypes.find((c) => c.id === panel?.feeder.cableTypeId);
  const system: "mono" | "tri" = p.supply.system === "tri" && (ct?.loadedConductors === 3 || !ct) ? "tri" : "mono";
  const U = system === "tri" ? p.supply.voltageV : p.supply.system === "mono" ? p.supply.voltageV : Math.round(p.supply.voltageV / Math.sqrt(3));
  const currentA = w > 0 ? round(system === "tri" ? w / (Math.sqrt(3) * U * p.supply.cosPhi) : w / (U * p.supply.cosPhi), 2) : 0;
  return { appliedW: round(w, 0), currentA, system };
}

/** caderea de tensiune pe alimentarea unui tablou (fara amonte) */
export function feederDrop(p: Project, panel: Panel): number | null {
  if (!panel.parentPanelId) return 0;
  const ct = p.library.cableTypes.find((c) => c.id === panel.feeder.cableTypeId);
  const L = panel.feeder.lengthM.value;
  const load = panelLoad(p, panel.id);
  if (!ct || L === null || load.currentA === null) return null;
  const U = load.system === "tri" ? p.supply.voltageV : p.supply.system === "mono" ? p.supply.voltageV : Math.round(p.supply.voltageV / Math.sqrt(3));
  return voltageDropPct(load.system, L, load.currentA, p.supply.cosPhi, ct.crossSectionMm2, ct.conductorMaterial, U);
}

/** ΔU cumulat de la tabloul general pana la bara tabloului dat */
export function upstreamDrop(p: Project, panelId: string | null): number | null {
  let total = 0;
  let cur = p.panels.find((t) => t.id === panelId);
  const seen = new Set<string>();
  while (cur && cur.parentPanelId && !seen.has(cur.id)) {
    seen.add(cur.id);
    const d = feederDrop(p, cur);
    if (d === null) return null;
    total += d;
    cur = p.panels.find((t) => t.id === cur!.parentPanelId);
  }
  return round(total, 2);
}

/* ------------------------- analiza circuit ------------------------- */

export interface CircuitSizing {
  circuit: Circuit;
  cable: CableType | undefined;
  ic: number | null;
  inA: number | null;
  iz: IzResult;
  lengthM: number | null;
  duCircuitPct: number | null;
  duUpstreamPct: number | null;
  duTotalPct: number | null;
  duLimitPct: number;
  minSection: number | null;
  system: "mono" | "tri";
}

export function duLimit(p: Project, c: Circuit): number {
  const r = p.library.rules.find((x) => x.id === "r-du")?.params;
  return c.usage === "iluminat" ? (r?.lightingPct ?? 3) : (r?.otherPct ?? 5);
}

export function minSectionFor(p: Project, c: Circuit): number | null {
  const r = p.library.rules.find((x) => x.id === "r-sectiune-min")?.params;
  if (!r) return null;
  if (c.usage === "iluminat") return r.lighting ?? 1.5;
  if (c.usage === "prize") return r.sockets ?? 2.5;
  if (c.usage === "dedicat") return r.power ?? 1.5;
  if (c.usage === "feeder") return r.feederMono ?? 4;
  return null;
}

export function analyzeCircuit(p: Project, c: Circuit): CircuitSizing {
  const lib = p.library;
  const load = circuitLoad(p, c);
  const cable = lib.cableTypes.find((t) => t.id === c.cableTypeId);
  const method = lib.installMethods.find((m) => m.id === c.installMethodId)?.ref ?? null;
  const iz = ampacity(lib, cable, method, c.ambientTempC, c.groupedCircuits);
  const L = load.length.value;
  const U = load.system === "tri" ? p.supply.voltageV : p.supply.system === "mono" ? p.supply.voltageV : Math.round(p.supply.voltageV / Math.sqrt(3));
  const ic = load.designCurrentA;
  const du = cable && L !== null && ic !== null ? voltageDropPct(load.system, L, ic, p.supply.cosPhi, cable.crossSectionMm2, cable.conductorMaterial, U) : null;
  const up = upstreamDrop(p, c.panelId);
  return {
    circuit: c,
    cable,
    ic,
    inA: c.protection.ratingA,
    iz,
    lengthM: L,
    duCircuitPct: du,
    duUpstreamPct: up,
    duTotalPct: du !== null && up !== null ? round(du + up, 2) : null,
    duLimitPct: duLimit(p, c),
    minSection: minSectionFor(p, c),
    system: load.system,
  };
}

/* ------------------------ propunere dimensionare ------------------- */

export interface SizingProposal {
  ok: boolean;
  reason: string;
  ratingA: number | null;
  cableTypeId: string | null;
  protectionDeviceId: string | null;
  steps: string[];
}

/**
 * Propune In si cablul pentru un circuit:
 *  1. In = cea mai mica valoare standard >= Ic
 *  2. cea mai mica sectiune >= sectiunea minima, cu I'z >= In si ΔU total <= limita
 *  3. tipul de cablu cu aceeasi constructie ca cel ales (sau fire in tub la metode A1/B1)
 * Propunerea se aplica doar la confirmarea electricianului.
 */
export function proposeSizing(p: Project, c: Circuit): SizingProposal {
  const lib = p.library;
  const a = analyzeCircuit(p, c);
  const steps: string[] = [];
  if (a.ic === null) return { ok: false, reason: "Date insuficiente: puterea sau simultaneitatea circuitului lipsesc.", ratingA: null, cableTypeId: null, protectionDeviceId: null, steps };
  const method = lib.installMethods.find((m) => m.id === c.installMethodId)?.ref;
  if (!method) return { ok: false, reason: "Date insuficiente: metoda de pozare nu este aleasa.", ratingA: null, cableTypeId: null, protectionDeviceId: null, steps };
  // In minim: Ic si setarea tipului de circuit (ex. prize 16 A: protectia acopera priza, nu doar sarcina)
  const ct0 = lib.circuitTypes.find((t) => t.id === c.circuitTypeId);
  const floor = Math.max(a.ic, ct0?.defaultRatingA ?? 0);
  const poles = a.system === "tri" ? "3P+N" : "1P+N";
  const curve = c.protection.curve ?? ct0?.defaultCurve ?? "C";
  // doar valori care exista in catalog (aceeasi curba si poli, altfel orice curba)
  const catalog = lib.protectionDevices.filter((d) => d.kind === "MCB" && d.poles === poles && d.ratingA !== null && d.ratingA >= floor).sort((x, y) => (x.ratingA ?? 0) - (y.ratingA ?? 0) || (x.curve === curve ? -1 : 1));
  const pd = catalog.find((d) => d.curve === curve && d.ratingA === catalog[0]?.ratingA) ?? catalog[0];
  const inA = pd?.ratingA ?? STD_RATINGS.find((r) => r >= floor) ?? null;
  steps.push(`Ic = ${a.ic} A${ct0?.defaultRatingA ? `, minim pentru ${ct0.name}: ${ct0.defaultRatingA} A` : ""} → In = ${inA ?? "peste 125"} A${pd ? ` (${pd.name}, ${pd.brand})` : " - lipseste din catalog"}`);
  if (inA === null) return { ok: false, reason: "Curent prea mare pentru propunerea automata.", ratingA: null, cableTypeId: null, protectionDeviceId: null, steps };
  if (!pd) return { ok: false, reason: `Nu exista in catalog un MCB ${poles} de minim ${floor} A. Adauga-l in Biblioteca → Aparate tablou.`, ratingA: inA, cableTypeId: null, protectionDeviceId: null, steps };

  const loaded = a.system === "tri" ? 3 : 2;
  // familia preferata: cea a cablului actual, altfel cea setata pe proiect (ex. NYY-J)
  const fam = (a.cable?.name ?? p.fast?.cableFamily ?? "").split(" ")[0].toUpperCase();
  const famRank = (t: { name: string }) => (fam && t.name.toUpperCase().startsWith(fam + " ") ? 0 : 1);
  const prefConstruction = a.cable?.construction ?? (method === "A1" || method === "B1" ? "fire_in_tub" : "cablu");
  const candidates = lib.cableTypes
    .filter((t) => t.loadedConductors === loaded && t.conductorMaterial === "cupru")
    .sort((x, y) => x.crossSectionMm2 - y.crossSectionMm2 || (x.construction === prefConstruction ? -1 : 1) - (y.construction === prefConstruction ? -1 : 1) || famRank(x) - famRank(y));
  const minS = a.minSection ?? 1.5;
  const up = a.duUpstreamPct ?? 0;
  for (const ct of candidates) {
    if (ct.crossSectionMm2 < minS) continue;
    if (ct.construction !== prefConstruction && candidates.some((o) => o.crossSectionMm2 === ct.crossSectionMm2 && o.construction === prefConstruction)) continue;
    if (famRank(ct) === 1 && candidates.some((o) => o.crossSectionMm2 === ct.crossSectionMm2 && o.construction === ct.construction && famRank(o) === 0)) continue;
    const iz = ampacity(lib, ct, method, c.ambientTempC, c.groupedCircuits);
    if (iz.izCorrected === null) continue;
    if (iz.izCorrected < inA) {
      steps.push(`${ct.name}: I'z = ${iz.izCorrected} A < In ${inA} A - respins`);
      continue;
    }
    if (a.lengthM !== null) {
      const U = a.system === "tri" ? p.supply.voltageV : p.supply.system === "mono" ? p.supply.voltageV : Math.round(p.supply.voltageV / Math.sqrt(3));
      const du = voltageDropPct(a.system, a.lengthM, a.ic, p.supply.cosPhi, ct.crossSectionMm2, ct.conductorMaterial, U);
      if (du + up > a.duLimitPct) {
        steps.push(`${ct.name}: ΔU = ${round(du + up, 2)}% > ${a.duLimitPct}% - respins`);
        continue;
      }
      steps.push(`${ct.name}: I'z = ${iz.izCorrected} A ≥ ${inA} A, ΔU = ${round(du + up, 2)}% ≤ ${a.duLimitPct}% - acceptat`);
    } else steps.push(`${ct.name}: I'z = ${iz.izCorrected} A ≥ ${inA} A - acceptat (ΔU neverificat: lungime necunoscuta)`);
    return { ok: true, reason: a.lengthM === null ? "Propunere fara verificarea ΔU (lungime necunoscuta)." : "Propunere calculata.", ratingA: inA, cableTypeId: ct.id, protectionDeviceId: pd.id, steps };
  }
  return { ok: false, reason: "Nicio sectiune din catalog nu indeplineste conditiile.", ratingA: inA, cableTypeId: null, protectionDeviceId: null, steps };
}

/** aplica propunerea (modifica proiectul primit) */
export function applySizing(p: Project, circuitId: string, prop: SizingProposal) {
  const c = p.circuits.find((x) => x.id === circuitId);
  if (!c || !prop.ok || !prop.protectionDeviceId || !prop.cableTypeId) return;
  const pd = p.library.protectionDevices.find((d) => d.id === prop.protectionDeviceId);
  c.cableTypeId = prop.cableTypeId;
  c.protection = { ...c.protection, ratingA: prop.ratingA, protectionDeviceId: prop.protectionDeviceId, curve: pd?.curve ?? c.protection.curve, poles: pd?.poles ?? c.protection.poles };
}
