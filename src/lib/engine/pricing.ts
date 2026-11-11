/**
 * Cantitati, manopera (valoare + timp), materiale.
 * Fiecare operatie produce doua rezultate paralele: valoare si timp (cap. 10.2).
 * Factorii de dificultate sunt expliciti in fiecare alocare (cap. 10.3).
 */
import type { DifficultyFactor, Library, Operation, Project, QuantityDriver, Room } from "../model/types";
import {
  cableLength,
  circuitCableLength,
  conduitLength,
  round,
  routeLength,
  estimatedChaseForCircuit,
  usesEstimatedRoutes,
} from "./measure";

/* ---------------------------- alocari ------------------------------ */

/** o parte din cantitatea unei operatii, legata de o incapere (pentru subtotaluri si factori) */
export interface Allocation {
  roomId: string | null;
  panelId?: string | null;
  quantity: number;
  /** id-ul tipului de perete folosit pentru factorul de perete */
  wallTypeId: string | null;
  sourceIds: string[];
}

const roomById = (p: Project) => new Map(p.rooms.map((r) => [r.id, r] as const));

function boxShape(p: Project, boxTypeId: string | null) {
  return p.library.boxTypes.find((b) => b.id === boxTypeId)?.shape ?? "rotunda";
}

/* --------------------- domeniul devizului (lucrari partiale) -------- */

export const SCOPE_PRESET_CATEGORIES: Record<string, string[]> = {
  tot: [],
  tablou: ["tablou", "verificari", "diverse"],
};

export interface ResolvedScope {
  categories: Set<string> | null;
  panels: Set<string> | null;
  levels: Set<string> | null;
  label: string;
}

export function resolveScope(p: Project): ResolvedScope {
  const sc = p.quote.scope;
  if (!sc || sc.preset === "tot") return { categories: null, panels: sc?.panelIds.length ? new Set(sc.panelIds) : null, levels: sc?.levelIds.length ? new Set(sc.levelIds) : null, label: "Toata lucrarea" };
  const cats = sc.preset === "tablou" ? SCOPE_PRESET_CATEGORIES.tablou : sc.categories;
  return {
    categories: cats.length ? new Set(cats) : null,
    panels: sc.panelIds.length ? new Set(sc.panelIds) : null,
    levels: sc.levelIds.length ? new Set(sc.levelIds) : null,
    label: sc.preset === "tablou" ? "Doar tablou electric" : "Lucrare partiala",
  };
}

/** tablourile de care tine un element (circuit, doza, aparat, traseu, tub, tablou, element de tablou) */
export function sourcePanels(p: Project, id: string): Set<string> {
  const out = new Set<string>();
  const addCircuit = (cid: string | null | undefined) => {
    const c = p.circuits.find((x) => x.id === cid);
    if (c?.panelId) out.add(c.panelId);
  };
  const c = p.circuits.find((x) => x.id === id);
  if (c) {
    if (c.panelId) out.add(c.panelId);
    return out;
  }
  if (p.panels.some((t) => t.id === id)) return out.add(id);
  const owner = p.panels.find((t) => t.items.some((i) => i.id === id));
  if (owner) return out.add(owner.id);
  if (p.boxes.some((b) => b.id === id)) {
    for (const d of p.devices) if (d.boxId === id) addCircuit(d.circuitId);
    // doza de derivatie: tablourile circuitelor traseelor pe care se afla
    for (const r of p.routes)
      if (r.segments.some((sg) => sg.to.refId === id || sg.from.refId === id)) for (const cd of r.conduits) cd.circuitIds.forEach(addCircuit);
    return out;
  }
  const d = p.devices.find((x) => x.id === id);
  if (d) {
    addCircuit(d.circuitId);
    return out;
  }
  const r = p.routes.find((x) => x.id === id);
  if (r) {
    for (const cd of r.conduits) cd.circuitIds.forEach(addCircuit);
    for (const sg of r.segments) for (const n of [sg.from, sg.to]) if (n.kind === "panel" && n.refId) out.add(n.refId);
    return out;
  }
  for (const rr of p.routes) {
    const cd = rr.conduits.find((x) => x.id === id);
    if (cd) {
      cd.circuitIds.forEach(addCircuit);
      return out;
    }
  }
  return out;
}

/** elementul intra in domeniul devizului? */
export function inScope(p: Project, scope: ResolvedScope, id: string, roomId: string | null): boolean {
  if (scope.levels && roomId) {
    const lv = p.rooms.find((r) => r.id === roomId)?.levelId;
    if (lv && !scope.levels.has(lv)) return false;
  }
  if (scope.panels) {
    const ps = sourcePanels(p, id);
    if (ps.size === 0) return false;
    if (![...ps].some((x) => scope.panels!.has(x))) return false;
  }
  return true;
}

/** cantitatile brute pe incaperi, pentru un driver */
export function allocationsFor(p: Project, driver: QuantityDriver, scope: ResolvedScope | null = null, operationId: string | null = null): Allocation[] {
  const rooms = roomById(p);
  const wallOf = (roomId: string | null) => (roomId ? rooms.get(roomId)?.wallTypeId ?? null : null);
  const groupByRoom = (items: { roomId: string | null; id: string; qty?: number; wallTypeId?: string | null }[]): Allocation[] => {
    const m = new Map<string, Allocation>();
    for (const it of items) {
      if (scope && !inScope(p, scope, it.id, it.roomId)) continue;
      const wall = it.wallTypeId !== undefined ? it.wallTypeId : wallOf(it.roomId);
      const key = `${it.roomId ?? "-"}|${wall ?? "-"}`;
      const a = m.get(key) ?? { roomId: it.roomId, quantity: 0, wallTypeId: wall, sourceIds: [] };
      a.quantity = round(a.quantity + (it.qty ?? 1), 3);
      a.sourceIds.push(it.id);
      m.set(key, a);
    }
    return [...m.values()];
  };

  switch (driver) {
    case "manual":
      return [];
    case "rooms":
      return groupByRoom(p.rooms.map((r) => ({ roomId: r.id, id: r.id })));
    case "boxes_da_round":
      return groupByRoom(p.boxes.filter((b) => b.kind === "DA" && boxShape(p, b.boxTypeId) !== "modulara").map((b) => ({ roomId: b.roomId, id: b.id })));
    case "boxes_da_modular":
      return groupByRoom(p.boxes.filter((b) => b.kind === "DA" && boxShape(p, b.boxTypeId) === "modulara").map((b) => ({ roomId: b.roomId, id: b.id })));
    case "boxes_da_all":
      return groupByRoom(p.boxes.filter((b) => b.kind === "DA").map((b) => ({ roomId: b.roomId, id: b.id })));
    case "box_type_op": {
      const types = new Set(p.library.boxTypes.filter((t) => t.operationId === operationId).map((t) => t.id));
      // doze fara tip ales: montajul implicit dupa fel (DA / DD)
      const fallback = (b: { kind: string }) => (b.kind === "DD" ? "op-doza-dd" : "op-doza-rot");
      return groupByRoom(p.boxes.filter((b) => (b.boxTypeId && p.library.boxTypes.some((t) => t.id === b.boxTypeId) ? types.has(b.boxTypeId) : fallback(b) === operationId)).map((b) => ({ roomId: b.roomId, id: b.id })));
    }
    case "device_type_op": {
      const types = new Set(p.library.deviceTypes.filter((t) => t.operationId === operationId).map((t) => t.id));
      return groupByRoom(p.devices.filter((d) => !d.boxId && d.deviceTypeId && types.has(d.deviceTypeId)).map((d) => ({ roomId: d.roomId, id: d.id })));
    }
    case "device_install_op": {
      // faza la gata: aparatele puse efectiv (nu rezervarile dozelor fara aparataj)
      const types = new Set(p.library.deviceTypes.filter((t) => t.installOperationId === operationId).map((t) => t.id));
      return groupByRoom(p.devices.filter((d) => !d.placeholder && d.deviceTypeId && types.has(d.deviceTypeId)).map((d) => ({ roomId: d.roomId, id: d.id })));
    }
    case "boxes_dd":
    case "dd_connections":
      return groupByRoom(p.boxes.filter((b) => b.kind === "DD").map((b) => ({ roomId: b.roomId, id: b.id })));
    case "box_recesses":
      return groupByRoom(
        p.boxes.filter((b) => boxShape(p, b.boxTypeId) !== "aparenta" && boxShape(p, b.boxTypeId) !== "etansa").map((b) => ({ roomId: b.roomId, id: b.id })),
      );
    case "points_total":
      return groupByRoom([
        ...p.boxes.map((b) => ({ roomId: b.roomId, id: b.id })),
        ...p.devices.filter((d) => !d.boxId).map((d) => ({ roomId: d.roomId, id: d.id })),
        ...p.panels.map((t) => ({ roomId: t.roomId, id: t.id })),
      ]);
    case "route_chase_m":
      if (usesEstimatedRoutes(p))
        return groupByRoom(
          p.circuits
            .filter((c) => !c.existing)
            .map((c) => ({ roomId: p.devices.find((d) => d.circuitId === c.id)?.roomId ?? null, id: c.id, qty: estimatedChaseForCircuit(p, c) }))
            .filter((x) => x.qty > 0),
        );
      return groupByRoom(
        p.routes
          .filter((r) => r.requiresChase)
          .map((r) => ({
            roomId: r.roomIds[0] ?? null,
            id: r.id,
            qty: routeLength(r).value ?? 0,
            wallTypeId: r.wallTypeId ?? wallOf(r.roomIds[0] ?? null),
          })),
      );
    case "conduit_m":
      if (usesEstimatedRoutes(p)) {
        if (p.fast?.noConduit) return [];
        return groupByRoom(
          p.circuits
            .filter((c) => !c.existing)
            .map((c) => ({ roomId: p.devices.find((d) => d.circuitId === c.id)?.roomId ?? null, id: c.id, qty: circuitCableLength(p, c).value ?? 0 }))
            .filter((x) => x.qty > 0),
        );
      }
      return groupByRoom(p.routes.flatMap((r) => r.conduits.map((c) => ({ roomId: r.roomIds[0] ?? null, id: c.id, qty: conduitLength(r, c).value ?? 0 }))));
    case "end_points":
      return groupByRoom([
        ...p.boxes.filter((b) => b.kind === "DA" && p.devices.some((d) => d.boxId === b.id && d.category !== "curenti_slabi")).map((b) => ({ roomId: b.roomId, id: b.id })),
        ...p.devices.filter((d) => !d.boxId && d.circuitId && d.category !== "curenti_slabi").map((d) => ({ roomId: d.roomId, id: d.id })),
      ]);
    case "new_circuits":
      return groupByRoom(
        p.circuits.filter((c) => c.usage !== "curenti_slabi" && !c.existing).map((c) => ({ roomId: p.panels.find((t) => t.id === c.panelId)?.roomId ?? null, id: c.id })),
      );
    case "existing_circuits":
      return groupByRoom(p.circuits.filter((c) => c.existing).map((c) => ({ roomId: p.panels.find((t) => t.id === c.panelId)?.roomId ?? null, id: c.id })));
    case "cable_m":
      return groupByRoom(
        p.circuits.filter((c) => !c.existing).map((c) => {
          const firstDevice = p.devices.find((d) => d.circuitId === c.id);
          return { roomId: firstDevice?.roomId ?? null, id: c.id, qty: circuitCableLength(p, c).value ?? 0 };
        }),
      );
    case "panels":
      // tablou existent: nu se monteaza cutie noua
      if (p.fast?.panelMode === "existent") return [];
      return groupByRoom(p.panels.map((t) => ({ roomId: t.roomId, id: t.id })));
    case "panel_items":
      return groupByRoom(p.panels.flatMap((t) => t.items.filter((i) => !i.isSpare).map((i) => ({ roomId: t.roomId, id: i.id }))));
    case "circuits":
      return groupByRoom(
        p.circuits
          .filter((c) => c.usage !== "curenti_slabi")
          .map((c) => ({ roomId: p.panels.find((t) => t.id === c.panelId)?.roomId ?? null, id: c.id })),
      );
    case "feeder_m":
      return groupByRoom(p.panels.filter((t) => t.parentPanelId).map((t) => ({ roomId: t.roomId, id: t.id, qty: t.feeder.lengthM.value ?? 0 })));
  }
}

/* ----------------------------- factori ----------------------------- */

export interface AppliedFactor {
  factorId: string;
  name: string;
  valueFactor: number;
  timeFactor: number;
  origin: "perete" | "incapere" | "proiect";
}

const factorApplies = (f: DifficultyFactor, op: Operation) => f.appliesToCategories.length === 0 || f.appliesToCategories.includes(op.category);

export function factorsFor(lib: Library, op: Operation, room: Room | undefined, wallTypeId: string | null, projectFactorIds: string[]): AppliedFactor[] {
  const out: AppliedFactor[] = [];
  const byId = new Map(lib.difficultyFactors.map((f) => [f.id, f] as const));
  const push = (id: string | null | undefined, origin: AppliedFactor["origin"]) => {
    if (!id) return;
    const f = byId.get(id);
    if (!f || !factorApplies(f, op)) return;
    if (out.some((o) => o.factorId === f.id)) return;
    if (f.valueFactor === 1 && f.timeFactor === 1) return;
    out.push({ factorId: f.id, name: f.name, valueFactor: f.valueFactor, timeFactor: f.timeFactor, origin });
  };
  if (op.wallSensitive && wallTypeId) push(lib.wallTypes.find((w) => w.id === wallTypeId)?.difficultyFactorId, "perete");
  room?.difficultyFactorIds.forEach((id) => push(id, "incapere"));
  projectFactorIds.forEach((id) => push(id, "proiect"));
  return out;
}

/* ------------------------------ manopera --------------------------- */

export interface LaborAllocation extends Allocation {
  factors: AppliedFactor[];
  valueFactor: number;
  timeFactor: number;
  value: number;
  timeMin: number;
}

export interface LaborLine {
  operation: Operation;
  enabled: boolean;
  quantity: number;
  quantitySource: "calcul" | "manual";
  rate: number;
  timeMinUnit: number;
  /** valoare fara factori */
  baseValue: number;
  baseTimeMin: number;
  /** valoare si timp cu factori */
  value: number;
  timeMin: number;
  allocations: LaborAllocation[];
  note: string;
}

export interface LaborResult {
  lines: LaborLine[];
  extras: { label: string; amount: number; timeMin: number }[];
  subtotal: number;
  discount: number;
  total: number;
  timeMin: number;
  hours: number;
  /** tarif orar implicit = valoare / ore. null daca timpul este 0 */
  impliedHourlyRate: number | null;
}

export function computeLabor(p: Project): LaborResult {
  const lib = p.library;
  const rooms = roomById(p);
  const overrides = new Map(p.operationOverrides.map((o) => [o.operationId, o] as const));
  const lines: LaborLine[] = [];

  const scope = resolveScope(p);
  for (const op of lib.operations) {
    if (!op.active) continue;
    if (!p.info.phases.includes(op.phase)) continue;
    if (scope.categories && !scope.categories.has(op.category)) continue;
    const ov = overrides.get(op.id);
    const rate = ov?.rateOverride ?? op.rate;
    const tUnit = ov?.timeOverrideMin ?? op.timeMin;

    const raw = allocationsFor(p, op.driver, scope, op.id);
    const allocs: LaborAllocation[] = raw
      .filter((a) => a.quantity > 0)
      .map((a) => {
        const factors = factorsFor(lib, op, a.roomId ? rooms.get(a.roomId) : undefined, a.wallTypeId, p.quote.projectFactorIds);
        const vf = factors.reduce((x, f) => x * f.valueFactor, 1);
        const tf = factors.reduce((x, f) => x * f.timeFactor, 1);
        return { ...a, factors, valueFactor: vf, timeFactor: tf, value: round(a.quantity * rate * vf, 2), timeMin: round(a.quantity * tUnit * tf, 2) };
      });

    const computedQty = round(allocs.reduce((s, a) => s + a.quantity, 0), 3);
    let quantity = computedQty;
    let value = allocs.reduce((s, a) => s + a.value, 0);
    let timeMin = allocs.reduce((s, a) => s + a.timeMin, 0);
    let source: LaborLine["quantitySource"] = "calcul";

    if (ov && ov.quantityOverride !== null) {
      // cantitate manuala: se pastreaza factorul mediu ponderat al alocarilor calculate
      const vf = computedQty > 0 ? value / (computedQty * rate || 1) : 1;
      const tf = computedQty > 0 ? timeMin / (computedQty * tUnit || 1) : 1;
      quantity = ov.quantityOverride;
      value = quantity * rate * (Number.isFinite(vf) && vf > 0 ? vf : 1);
      timeMin = quantity * tUnit * (Number.isFinite(tf) && tf > 0 ? tf : 1);
      source = "manual";
    }

    const enabled = ov?.enabled ?? true;
    if (quantity === 0 && source === "calcul" && op.driver !== "manual") {
      // operatie fara cantitate in proiect: nu apare in deviz
      continue;
    }
    if (op.driver === "manual" && quantity === 0) continue;

    lines.push({
      operation: op,
      enabled,
      quantity: round(quantity, 3),
      quantitySource: source,
      rate,
      timeMinUnit: tUnit,
      baseValue: round(quantity * rate, 2),
      baseTimeMin: round(quantity * tUnit, 2),
      value: round(value, 2),
      timeMin: round(timeMin, 2),
      allocations: allocs,
      note: ov?.note ?? "",
    });
  }

  const extras = p.extraCosts.map((e) => ({ label: e.label, amount: e.amount, timeMin: e.timeMin }));
  const active = lines.filter((l) => l.enabled);
  const subtotal = round(active.reduce((s, l) => s + l.value, 0) + extras.reduce((s, e) => s + e.amount, 0), 2);
  const discount = round((subtotal * p.quote.laborDiscountPct) / 100, 2);
  const total = round(subtotal - discount, 2);
  const timeMin = round(active.reduce((s, l) => s + l.timeMin, 0) + extras.reduce((s, e) => s + e.timeMin, 0), 2);
  const hours = round(timeMin / 60, 2);
  return {
    lines,
    extras,
    subtotal,
    discount,
    total,
    timeMin,
    hours,
    impliedHourlyRate: hours > 0 ? round(total / hours, 2) : null,
  };
}

/* ------------------------------ materiale -------------------------- */

export interface MaterialLine {
  materialId: string;
  code: string;
  name: string;
  brand: string;
  unit: string;
  quantity: number;
  purchasePrice: number;
  markupPct: number;
  offerPrice: number;
  value: number;
  sources: string[];
}

export interface MaterialsResult {
  lines: MaterialLine[];
  subtotal: number;
  discount: number;
  total: number;
  /** elemente fara material asociat in catalog */
  unmapped: string[];
}

export function computeMaterials(p: Project): MaterialsResult {
  const lib = p.library;
  const qty = new Map<string, { q: number; src: string[] }>();
  const unmapped: string[] = [];
  const add = (materialId: string | null | undefined, q: number, src: string) => {
    if (!materialId) {
      unmapped.push(src);
      return;
    }
    if (q <= 0) return;
    const cur = qty.get(materialId) ?? { q: 0, src: [] };
    cur.q += q;
    cur.src.push(src);
    qty.set(materialId, cur);
  };

  const scope = resolveScope(p);
  const rosu = p.info.phases.includes("rosu");
  const gata = p.info.phases.includes("gata");
  const cat = (k: string) => (k === "aparataj" ? gata : rosu) && (!scope.categories || scope.categories.has(k));
  const ok = (id: string, roomId: string | null) => inScope(p, scope, id, roomId);

  if (cat("doze")) for (const b of p.boxes) if (ok(b.id, b.roomId)) add(lib.boxTypes.find((t) => t.id === b.boxTypeId)?.materialId, 1, b.code);

  for (const c of p.circuits) {
    if (c.existing || !cat("cablare") || !ok(c.id, null)) continue;
    const cables = p.cables.filter((x) => x.circuitId === c.id);
    if (cables.length > 0) {
      for (const cb of cables) {
        const ct = lib.cableTypes.find((t) => t.id === (cb.cableTypeId ?? c.cableTypeId));
        add(ct?.materialId, (cableLength(p, cb).value ?? 0) * (ct?.materialQtyPerM ?? 1), cb.code);
      }
    } else {
      const ct = lib.cableTypes.find((t) => t.id === c.cableTypeId);
      const len = circuitCableLength(p, c).value ?? 0;
      if (len > 0) add(ct?.materialId, len * (ct?.materialQtyPerM ?? 1), c.code);
    }
  }

  if (cat("tuburi") && usesEstimatedRoutes(p) && !p.fast?.noConduit) {
    const cd = lib.conduitTypes.find((t) => t.id === "cd-20") ?? lib.conduitTypes[0];
    for (const c of p.circuits) if (!c.existing && ok(c.id, null)) add(cd?.materialId, circuitCableLength(p, c).value ?? 0, `${c.code} tub estimat`);
  }
  if (cat("tuburi"))
    for (const r of p.routes)
      for (const cd of r.conduits) if (ok(cd.id, r.roomIds[0] ?? null)) add(lib.conduitTypes.find((t) => t.id === cd.conduitTypeId)?.materialId, conduitLength(r, cd).value ?? 0, cd.code);

  // faza la gata: aparatajul si corpurile care au material in biblioteca
  if (cat("aparataj"))
    for (const d of p.devices) {
      if (d.placeholder || !d.deviceTypeId || !ok(d.id, d.roomId)) continue;
      const m = lib.deviceTypes.find((t) => t.id === d.deviceTypeId)?.materialId;
      if (m) add(m, 1, d.code);
    }

  for (const t of p.panels) {
    if (!cat("tablou") || (scope.panels && !scope.panels.has(t.id))) continue;
    if (p.fast?.panelMode !== "existent") add(lib.enclosureTypes.find((e) => e.id === t.enclosureTypeId)?.materialId, 1, t.code);
    for (const it of t.items) if (!it.isSpare) add(lib.protectionDevices.find((d) => d.id === it.protectionDeviceId)?.materialId, 1, it.code);
    if (t.parentPanelId) {
      const ct = lib.cableTypes.find((c) => c.id === t.feeder.cableTypeId);
      add(ct?.materialId, (t.feeder.lengthM.value ?? 0) * (ct?.materialQtyPerM ?? 1), `${t.code} alimentare`);
    }
  }

  const lines: MaterialLine[] = [];
  for (const [id, { q, src }] of qty) {
    const m = lib.materials.find((x) => x.id === id);
    if (!m) {
      unmapped.push(...src);
      continue;
    }
    const offer = round(m.purchasePrice * (1 + m.markupPct / 100), 2);
    const quantity = round(q, 2);
    lines.push({
      materialId: id,
      code: m.code,
      name: m.name,
      brand: m.brand,
      unit: m.unit,
      quantity,
      purchasePrice: m.purchasePrice,
      markupPct: m.markupPct,
      offerPrice: offer,
      value: round(quantity * offer, 2),
      sources: src,
    });
  }
  lines.sort((a, b) => a.name.localeCompare(b.name));
  const subtotal = round(lines.reduce((s, l) => s + l.value, 0), 2);
  const discount = round((subtotal * p.quote.materialsDiscountPct) / 100, 2);
  return { lines, subtotal, discount, total: round(subtotal - discount, 2), unmapped };
}

/* ------------------------------- total ----------------------------- */

export interface QuoteTotals {
  labor: number;
  materials: number | null;
  net: number;
  vat: number;
  gross: number;
  vatPayer: boolean;
  vatRatePct: number;
}

export function computeTotals(p: Project, labor = computeLabor(p), materials = computeMaterials(p)): QuoteTotals {
  const f = p.library.firm;
  const mat = p.quote.includeMaterials ? materials.total : null;
  const net = round(labor.total + (mat ?? 0), 2);
  const vat = f.vatPayer ? round((net * f.vatRatePct) / 100, 2) : 0;
  return { labor: labor.total, materials: mat, net, vat, gross: round(net + vat, 2), vatPayer: f.vatPayer, vatRatePct: f.vatRatePct };
}

