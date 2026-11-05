/**
 * Tablouri (cap. 8): echipare propusa automat, asezare pe sina DIN,
 * ocupare / rezerva, repartizare pe faze.
 * Echiparea este o propunere; electricianul poate muta / inlocui orice aparat.
 */
import { takeCode, uid } from "../model/ids";
import { tracked } from "../model/factory";
import type { Panel, PanelItem, PanelOptions, Project, ProtectionDevice } from "../model/types";
import { circuitLoad } from "./circuits";
import { panelLoad } from "./sizing";

export const DEFAULT_PANEL_OPTIONS: PanelOptions = { mainDevice: "separator", includeSPD: false, useRcd: true };

export function newPanel(p: Project, name: string, parentPanelId: string | null, roomId: string | null): Panel {
  return {
    id: uid(),
    code: takeCode(p.counters, "TA"),
    name,
    roomId,
    location: "",
    parentPanelId,
    feeder: { cableTypeId: parentPanelId ? (p.supply.system === "tri" ? "ct-cyyf5x6" : "ct-cyyf3x6") : null, lengthM: tracked<number>(null), protectionDeviceId: null, ratingA: null, installMethodId: "im-b2" },
    enclosureTypeId: null,
    reservePct: p.library.rules.find((r) => r.id === "r-rezerva-tablou")?.params.minReservePct ?? 20,
    options: { ...DEFAULT_PANEL_OPTIONS },
    items: [],
    status: "estimat",
    notes: "",
  };
}

export function deviceOf(p: Project, item: PanelItem): ProtectionDevice | undefined {
  return p.library.protectionDevices.find((d) => d.id === item.protectionDeviceId);
}

export const itemModules = (p: Project, item: PanelItem) => deviceOf(p, item)?.modules ?? 2;

/* ---------------------------- asezare DIN -------------------------- */

export interface PlacedItem {
  item: PanelItem;
  row: number;
  start: number; // modul de start (0-based)
  modules: number;
}

export interface PanelLayout {
  rows: number;
  modulesPerRow: number;
  placed: PlacedItem[];
  usedModules: number;
  capacity: number;
  /** aparate care nu au mai incaput */
  overflow: PlacedItem[];
  reserveModules: number;
  reservePct: number | null;
}

/**
 * Aseaza aparatele in ordinea din lista, rand cu rand. Pozitia fixata manual
 * (row/position) se respecta; restul curg dupa ea.
 */
export function layoutPanel(p: Project, panel: Panel): PanelLayout {
  const enc = p.library.enclosureTypes.find((e) => e.id === panel.enclosureTypeId);
  const rows = enc?.rows ?? Math.max(1, Math.ceil(panel.items.reduce((s, i) => s + itemModules(p, i), 0) / 12));
  const per = enc?.modulesPerRow ?? 12;
  const placed: PlacedItem[] = [];
  const overflow: PlacedItem[] = [];
  const cursor = Array.from({ length: rows }, () => 0);
  let row = 0;
  for (const item of panel.items) {
    const m = itemModules(p, item);
    // rand fixat manual: se incearca acolo; altfel se continua de unde a ramas asezarea
    let r = item.row !== null && item.row !== undefined ? Math.min(Math.max(0, item.row), rows - 1) : row;
    while (r < rows && cursor[r] + m > per) r++;
    if (r >= rows) {
      overflow.push({ item, row: rows, start: 0, modules: m });
      continue;
    }
    placed.push({ item, row: r, start: cursor[r], modules: m });
    cursor[r] += m;
    if (item.row === null || item.row === undefined) row = r;
  }
  const used = placed.reduce((s, x) => s + x.modules, 0) + overflow.reduce((s, x) => s + x.modules, 0);
  const capacity = enc ? rows * per : 0;
  return {
    rows,
    modulesPerRow: per,
    placed,
    usedModules: used,
    capacity,
    overflow,
    reserveModules: capacity - used,
    reservePct: capacity > 0 ? Math.round(((capacity - used) / capacity) * 100) : null,
  };
}

/** cea mai mica cutie care incape aparatele + rezerva dorita */
export function chooseEnclosure(p: Project, modules: number, reservePct: number): string | null {
  const need = Math.ceil(modules * (1 + reservePct / 100));
  const list = [...p.library.enclosureTypes].sort((a, b) => a.rows * a.modulesPerRow - b.rows * b.modulesPerRow);
  return (list.find((e) => e.rows * e.modulesPerRow >= need) ?? list.at(-1))?.id ?? null;
}

/* ------------------------- echipare automata ----------------------- */

function pick(p: Project, kind: ProtectionDevice["kind"], poles: string[], minRating: number | null, prefBrand?: string): ProtectionDevice | undefined {
  const list = p.library.protectionDevices
    .filter((d) => d.kind === kind && poles.includes(d.poles) && (minRating === null || (d.ratingA ?? 0) >= minRating))
    .sort((a, b) => (a.ratingA ?? 0) - (b.ratingA ?? 0) || (a.brand === prefBrand ? -1 : b.brand === prefBrand ? 1 : 0));
  return list[0];
}

export interface PanelGenReport {
  items: number;
  rcds: number;
  enclosure: string | null;
  warnings: string[];
}

/**
 * Genereaza echiparea tabloului din circuitele lui:
 *  [SPD] → aparat general → (RCD + MCB-urile grupului)... → alimentari tablouri secundare.
 * Circuitele fara protectie aleasa primesc un loc marcat "de stabilit".
 */
export function generatePanelEquipment(p: Project, panelId: string): PanelGenReport {
  const panel = p.panels.find((t) => t.id === panelId);
  const warnings: string[] = [];
  if (!panel) return { items: 0, rcds: 0, enclosure: null, warnings: ["tablou inexistent"] };
  const opt = panel.options ?? DEFAULT_PANEL_OPTIONS;
  const tri = p.supply.system === "tri";
  const brand = p.library.protectionDevices.find((d) => d.id === p.circuits.find((c) => c.panelId === panelId)?.protection.protectionDeviceId)?.brand;
  const items: PanelItem[] = [];
  const mk = (pd: ProtectionDevice | undefined, label: string, role: PanelItem["role"], circuitIds: string[] = []): PanelItem => ({
    id: uid(),
    code: takeCode(p.counters, "EM"),
    protectionDeviceId: pd?.id ?? null,
    label,
    circuitIds,
    downstreamItemIds: [],
    row: null,
    position: null,
    isSpare: false,
    role,
    feedsPanelId: null,
  });

  const load = panelLoad(p, panelId);
  const mainBreaker = panel.parentPanelId ? panel.feeder.ratingA : p.supply.mainBreakerA.value;
  const needA = mainBreaker ?? (load.currentA ? Math.ceil(load.currentA) : null);

  if (opt.includeSPD) {
    const spd = pick(p, "SPD", tri ? ["3P+N", "4P"] : ["1P+N", "2P"], null, brand);
    items.push(mk(spd, "Descarcator supratensiuni", "spd"));
    if (!spd) warnings.push("Nu exista SPD potrivit in catalog");
  }
  if (opt.mainDevice !== "niciunul") {
    const kind = opt.mainDevice === "separator" ? "separator" : opt.mainDevice === "rcd" ? "RCD" : "MCB";
    const poles = kind === "MCB" ? (tri ? ["3P+N"] : ["1P+N"]) : tri ? ["4P"] : ["2P"];
    const dev = pick(p, kind, poles, needA, brand) ?? pick(p, kind, poles, null, brand);
    items.push(mk(dev, opt.mainDevice === "rcd" ? "Diferential general" : "Intrerupator general", "general"));
    if (!dev) warnings.push(`Nu exista ${kind} general potrivit in catalog`);
  }

  // circuitele tabloului, in ordinea din lista de circuite
  const circuits = p.circuits.filter((c) => c.panelId === panelId && c.usage !== "curenti_slabi").sort((a, b) => a.order - b.order);
  const mcbFor = (cid: string) => {
    const c = p.circuits.find((x) => x.id === cid)!;
    const pd = p.library.protectionDevices.find((d) => d.id === c.protection.protectionDeviceId);
    const it = mk(pd, `${c.code} ${c.name}`, "circuit", [c.id]);
    if (!pd) it.label = `${c.code} ${c.name} (protectie de stabilit)`;
    return it;
  };

  let rcdCount = 0;
  const maxPerRcd = p.library.rules.find((r) => r.id === "r-rcd-grupare")?.params.maxCircuits ?? 6;
  const mainIsRcd = opt.mainDevice === "rcd";
  if (opt.useRcd && !mainIsRcd) {
    // circuitele cu RCBO nu mai trec prin RCD
    const viaRcd = circuits.filter((c) => p.library.protectionDevices.find((d) => d.id === c.protection.protectionDeviceId)?.kind !== "RCBO");
    const direct = circuits.filter((c) => !viaRcd.includes(c));
    for (let i = 0; i < viaRcd.length; i += maxPerRcd) {
      const group = viaRcd.slice(i, i + maxPerRcd);
      const sumIn = group.reduce((s, c) => s + (c.protection.ratingA ?? 16), 0);
      const anyTri = group.some((c) => c.phase === "L123");
      const poles = tri && anyTri ? ["4P"] : tri ? ["4P", "2P"] : ["2P"];
      // RCD-ul trebuie sa suporte cel putin protectia din amonte sau suma estimata a grupului (limitata)
      const rcdMin = Math.min(needA ?? 40, Math.max(25, Math.min(sumIn, 63)));
      const rcd = pick(p, "RCD", poles, rcdMin, brand) ?? pick(p, "RCD", poles, null, brand);
      rcdCount++;
      const rcdItem = mk(rcd, `Diferential ${rcdCount}`, "rcd");
      const mcbs = group.map((c) => mcbFor(c.id));
      rcdItem.downstreamItemIds = mcbs.map((m) => m.id);
      items.push(rcdItem, ...mcbs);
      if (!rcd) warnings.push("Nu exista RCD potrivit in catalog");
    }
    for (const c of direct) items.push(mcbFor(c.id));
  } else {
    for (const c of circuits) items.push(mcbFor(c.id));
    if (mainIsRcd) {
      const g = items.find((i) => i.role === "general");
      if (g) g.downstreamItemIds = items.filter((i) => i.role === "circuit").map((i) => i.id);
    }
  }

  // alimentari spre tablouri secundare
  for (const child of p.panels.filter((t) => t.parentPanelId === panelId)) {
    const pd = p.library.protectionDevices.find((d) => d.id === child.feeder.protectionDeviceId) ?? pick(p, "MCB", tri ? ["3P+N"] : ["1P+N"], child.feeder.ratingA ?? Math.ceil(panelLoad(p, child.id).currentA ?? 0), brand);
    const it = mk(pd, `Alimentare ${child.code} ${child.name}`, "feeder");
    it.feedsPanelId = child.id;
    items.push(it);
    if (pd && !child.feeder.protectionDeviceId) {
      child.feeder.protectionDeviceId = pd.id;
      child.feeder.ratingA = pd.ratingA;
    }
  }

  panel.items = items;
  // legatura circuit -> RCD amonte
  for (const c of circuits) {
    const mcb = panel.items.find((i) => i.circuitIds.includes(c.id));
    const rcd = panel.items.find((i) => (i.role === "rcd" || (i.role === "general" && mainIsRcd)) && mcb && i.downstreamItemIds.includes(mcb.id));
    c.protection.rcdItemId = rcd?.id ?? null;
  }
  const modules = panel.items.reduce((s, i) => s + itemModules(p, i), 0);
  panel.enclosureTypeId = chooseEnclosure(p, modules, panel.reservePct);
  return { items: panel.items.length, rcds: rcdCount, enclosure: panel.enclosureTypeId, warnings };
}

/** muta un element in lista (ordinea = ordinea pe sina) */
export function moveItem(panel: Panel, itemId: string, dir: -1 | 1) {
  const i = panel.items.findIndex((x) => x.id === itemId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= panel.items.length) return;
  [panel.items[i], panel.items[j]] = [panel.items[j], panel.items[i]];
}

/* ------------------------ repartizare pe faze ---------------------- */

/** echilibrare simpla: circuitele monofazate, descrescator dupa P aplicata, pe faza cea mai putin incarcata */
export function balancePhases(p: Project, panelId: string | null = null) {
  if (p.supply.system !== "tri") return;
  const load: Record<"L1" | "L2" | "L3", number> = { L1: 0, L2: 0, L3: 0 };
  const list = p.circuits.filter((c) => (panelId === null || c.panelId === panelId) && !c.lockedFields.includes("phase"));
  for (const c of p.circuits.filter((x) => x.phase === "L123")) {
    const w = (circuitLoad(p, c).appliedW ?? 0) / 3;
    load.L1 += w;
    load.L2 += w;
    load.L3 += w;
  }
  const mono = list.filter((c) => c.phase !== "L123").sort((a, b) => (circuitLoad(p, b).appliedW ?? 0) - (circuitLoad(p, a).appliedW ?? 0));
  for (const c of mono) {
    const ph = (Object.keys(load) as ("L1" | "L2" | "L3")[]).sort((a, b) => load[a] - load[b])[0];
    c.phase = ph;
    load[ph] += circuitLoad(p, c).appliedW ?? 0;
  }
}

export function phaseLoads(p: Project, panelId: string | null = null) {
  const m = { L1: 0, L2: 0, L3: 0 };
  for (const c of p.circuits.filter((x) => panelId === null || x.panelId === panelId)) {
    const w = circuitLoad(p, c).appliedW ?? 0;
    if (c.phase === "L123") {
      m.L1 += w / 3;
      m.L2 += w / 3;
      m.L3 += w / 3;
    } else if (c.phase) m[c.phase] += w;
  }
  const max = Math.max(m.L1, m.L2, m.L3);
  const min = Math.min(m.L1, m.L2, m.L3);
  return { ...m, imbalancePct: max > 0 ? Math.round(((max - min) / max) * 100) : 0 };
}

/** sterge un tablou: circuitele si tablourile din aval trec pe tabloul parinte */
export function removePanel(p: Project, panelId: string) {
  const panel = p.panels.find((t) => t.id === panelId);
  if (!panel) return;
  const parent = panel.parentPanelId;
  for (const c of p.circuits) if (c.panelId === panelId) c.panelId = parent;
  for (const t of p.panels) if (t.parentPanelId === panelId) t.parentPanelId = parent;
  for (const t of p.panels) t.items = t.items.filter((i) => i.feedsPanelId !== panelId);
  p.panels = p.panels.filter((t) => t.id !== panelId);
}
