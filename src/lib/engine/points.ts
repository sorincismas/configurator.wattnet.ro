/**
 * Lucru rapid pe puncte (faza la rosu).
 *
 * Un PUNCT este ce vede electricianul pe perete: o priza, un punct de
 * iluminat, o banda LED, un intrerupator, un consumator dedicat. In model
 * punctul este un aparat (Device); daca tipul lui se monteaza in doza,
 * doza aparat (DA) se creeaza automat. Aparatajul concret (producator,
 * model) se alege in faza la gata si nu influenteaza faza la rosu.
 */
import { defaultBoxTypeId } from "../library/defaults";
import { newBox, newDevice, removeDevices, tracked } from "../model/factory";
import type { Box, Device, DeviceCategory, DeviceType, Library, PointPurpose, Project } from "../model/types";

/** functia punctului, cu litera si culoarea folosite peste tot in aplicatie */
export type PointFunction = "P" | "L" | "I" | "D" | "S" | "C" | "A";

export const FUNCTION_OF: Record<DeviceCategory, PointFunction> = {
  priza: "P",
  iluminat: "L",
  intrerupator: "I",
  consumator_dedicat: "D",
  curenti_slabi: "S",
  comanda: "C",
  altul: "A",
};

export const FUNCTION_LABEL: Record<PointFunction, string> = {
  P: "Priza",
  L: "Iluminat",
  I: "Intrerupator",
  D: "Consumator dedicat",
  S: "Curenti slabi",
  C: "Comanda / senzor",
  A: "Altul",
};

export const pointFunction = (d: Pick<Device, "category">): PointFunction => FUNCTION_OF[d.category] ?? "A";

/** tipul de doza pentru un punct nou: implicitul din biblioteca daca incap modulele */
export function boxTypeFor(lib: Library, modules: number): string | null {
  const da = lib.boxTypes.filter((b) => b.kind === "DA");
  const def = da.find((b) => b.id === defaultBoxTypeId(lib, "DA")) ?? da[0];
  if (!def) return null;
  if (modules <= def.modules) return def.id;
  return da.filter((b) => b.modules >= modules).sort((a, b) => a.modules - b.modules)[0]?.id ?? def.id;
}

/** adauga n puncte de un tip intr-o incapere; fiecare punct cu doza proprie daca tipul o cere */
export function addPoints(p: Project, roomId: string, deviceTypeId: string, n: number): Device[] {
  const dt = p.library.deviceTypes.find((t) => t.id === deviceTypeId);
  if (!dt) return [];
  const out: Device[] = [];
  for (let k = 0; k < Math.max(0, Math.min(50, n)); k++) {
    let boxId: string | null = null;
    if (dt.needsBox) {
      const b = newBox(p, "DA", roomId, boxTypeFor(p.library, dt.modules));
      p.boxes.push(b);
      boxId = b.id;
    }
    const d = newDevice(p, roomId, deviceTypeId, undefined, boxId);
    p.devices.push(d);
    out.push(d);
  }
  return out;
}

/** sterge punctul; doza lui dispare daca ramane goala */
export function removePoint(p: Project, deviceId: string) {
  const d = p.devices.find((x) => x.id === deviceId);
  if (!d) return;
  removeDevices(p, [deviceId]);
  if (d.boxId && !p.devices.some((x) => x.boxId === d.boxId)) p.boxes = p.boxes.filter((b) => b.id !== d.boxId);
}

/** schimba tipul unui punct (pastreaza puterea daca a fost introdusa manual) */
export function changePointType(p: Project, deviceId: string, deviceTypeId: string) {
  const d = p.devices.find((x) => x.id === deviceId);
  const dt = p.library.deviceTypes.find((t) => t.id === deviceTypeId);
  if (!d || !dt) return;
  const manualPower = d.powerW.provenance && d.powerW.provenance !== "estimat";
  const catChanged = d.category !== dt.category;
  d.deviceTypeId = dt.id;
  d.category = dt.category;
  d.label = dt.name;
  d.modules = dt.modules;
  d.threePhase = dt.threePhase;
  if (!manualPower) d.powerW = { value: dt.category === "curenti_slabi" || dt.category === "intrerupator" ? null : dt.suggestedPowerW, provenance: "estimat" };
  if (catChanged && !d.circuitLocked) d.circuitId = null;
  // doza: se creeaza sau se elimina dupa noul tip
  if (dt.needsBox && !d.boxId) {
    const b = newBox(p, "DA", d.roomId, boxTypeFor(p.library, dt.modules));
    p.boxes.push(b);
    d.boxId = b.id;
  } else if (!dt.needsBox && d.boxId) {
    const old = d.boxId;
    d.boxId = null;
    if (!p.devices.some((x) => x.boxId === old)) p.boxes = p.boxes.filter((b) => b.id !== old);
  }
}

/* ----------------------- doze (faza la rosu) ----------------------- */

const placeholderLabel = (p: Project, category: DeviceCategory) => FUNCTION_LABEL[FUNCTION_OF[category]];

/** rezervarea dintr-o doza fara aparataj: pastreaza destinatia, puterea estimata si circuitul */
function makePlaceholder(p: Project, box: Box, category: DeviceCategory, powerW: number | null): Device {
  const d = newDevice(p, box.roomId, null, category, box.id);
  d.placeholder = true;
  d.modules = 0;
  d.label = placeholderLabel(p, category);
  d.powerW = tracked(category === "intrerupator" || category === "curenti_slabi" ? null : powerW, "estimat");
  return d;
}

/** adauga n doze cu o destinatie (tipul de doza: cel ales sau implicitul destinatiei) */
export function addBoxes(p: Project, roomId: string, purposeId: string, n: number, boxTypeId?: string | null): Box[] {
  const pp = p.library.pointPurposes.find((x) => x.id === purposeId);
  if (!pp) return [];
  const bt = boxTypeId || pp.boxTypeId || boxTypeFor(p.library, 2);
  const out: Box[] = [];
  for (let k = 0; k < Math.max(0, Math.min(50, n)); k++) {
    const b = newBox(p, "DA", roomId, bt);
    p.boxes.push(b);
    p.devices.push(makePlaceholder(p, b, pp.category, pp.powerW));
    out.push(b);
  }
  return out;
}

export const boxDevices = (p: Project, boxId: string) => p.devices.filter((d) => d.boxId === boxId);
export const realBoxDevices = (p: Project, boxId: string) => boxDevices(p, boxId).filter((d) => !d.placeholder);

/** destinatia (categoria) dozei: din aparataj sau din rezervare */
export function boxCategory(p: Project, boxId: string): DeviceCategory | null {
  const ds = boxDevices(p, boxId);
  if (!ds.length) return null;
  const order: DeviceCategory[] = ["consumator_dedicat", "priza", "comanda", "intrerupator", "curenti_slabi", "altul", "iluminat"];
  return [...ds].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))[0].category;
}

/** modulele dozei si cele ocupate de aparataj */
export function boxCapacity(p: Project, boxId: string): { modules: number; used: number; free: number } {
  const b = p.boxes.find((x) => x.id === boxId);
  const modules = b?.modules ?? 0;
  const used = realBoxDevices(p, boxId).reduce((s, d) => s + d.modules, 0);
  return { modules, used, free: modules - used };
}

/** circuitul dozei (al primului element) */
export const boxCircuitId = (p: Project, boxId: string) => boxDevices(p, boxId).find((d) => d.circuitId)?.circuitId ?? null;

/** muta toata doza pe un circuit (sau o scoate de pe circuit) */
export function moveBox(p: Project, boxId: string, circuitId: string | null) {
  for (const d of boxDevices(p, boxId)) {
    if (d.category === "curenti_slabi") continue;
    d.circuitId = circuitId;
    d.circuitLocked = circuitId !== null;
  }
}

/** schimba destinatia unei doze fara aparataj (o doza goala primeste rezervarea acum) */
export function setBoxPurpose(p: Project, boxId: string, purposeId: string) {
  const pp = p.library.pointPurposes.find((x) => x.id === purposeId);
  const box = p.boxes.find((b) => b.id === boxId);
  if (!pp || !box || realBoxDevices(p, boxId).length) return;
  let ph = boxDevices(p, boxId).find((d) => d.placeholder);
  if (!ph) {
    ph = makePlaceholder(p, box, pp.category, pp.powerW);
    p.devices.push(ph);
    return;
  }
  if (ph.category !== pp.category) {
    ph.circuitId = null;
    ph.circuitLocked = false;
  }
  ph.category = pp.category;
  ph.label = placeholderLabel(p, pp.category);
  if (ph.powerW.provenance === "estimat") ph.powerW = tracked(pp.category === "intrerupator" || pp.category === "curenti_slabi" ? null : pp.powerW, "estimat");
}

/** faza la gata: pune un aparat in doza; rezervarea dispare, circuitul se pastreaza */
export function addDeviceToBox(p: Project, boxId: string, deviceTypeId: string): { ok: boolean; message?: string } {
  const b = p.boxes.find((x) => x.id === boxId);
  const dt = p.library.deviceTypes.find((t) => t.id === deviceTypeId);
  if (!b || !dt) return { ok: false, message: "doza sau aparat inexistent" };
  const cap = boxCapacity(p, boxId);
  if (b.modules > 0 && dt.modules > cap.free) return { ok: false, message: `nu incape: ${dt.modules} module, libere ${cap.free} din ${cap.modules}` };
  const ph = boxDevices(p, boxId).find((d) => d.placeholder);
  const circuitId = boxCircuitId(p, boxId);
  const locked = boxDevices(p, boxId).some((d) => d.circuitLocked);
  const d = newDevice(p, b.roomId, dt.id, undefined, b.id);
  if (dt.category !== "curenti_slabi") {
    d.circuitId = circuitId;
    d.circuitLocked = locked;
  }
  // puterea estimata a dozei ramane pe primul aparat de acelasi fel, daca aparatul nu are consum propriu
  if (ph && d.powerW.value === null && ph.powerW.value !== null && dt.category === ph.category) d.powerW = { ...ph.powerW };
  p.devices.push(d);
  if (ph) removeDevices(p, [ph.id]);
  return { ok: true };
}

/** scoate un aparat din doza; doza goala revine la rezervare (destinatie + circuit) */
export function removeDeviceFromBox(p: Project, deviceId: string) {
  const d = p.devices.find((x) => x.id === deviceId);
  if (!d || !d.boxId || d.placeholder) return;
  const box = p.boxes.find((b) => b.id === d.boxId)!;
  removeDevices(p, [deviceId]);
  if (!boxDevices(p, box.id).length) {
    const ph = makePlaceholder(p, box, d.category === "iluminat" ? "intrerupator" : d.category, d.powerW.value);
    ph.circuitId = d.circuitId;
    ph.circuitLocked = d.circuitLocked;
    p.devices.push(ph);
  }
}

/** sterge doza cu tot ce contine */
export function removeBox(p: Project, boxId: string) {
  removeDevices(p, boxDevices(p, boxId).map((d) => d.id));
  p.boxes = p.boxes.filter((b) => b.id !== boxId);
  for (const c of p.circuits) if (c.chain) c.chain = c.chain.filter((l) => l.memberId !== boxId);
}

/* ---------------------------- cod rapid ---------------------------- */

export interface QuickItem {
  /** doza cu destinatie (purposeId) sau punct fara doza (deviceTypeId) */
  kind: "doza" | "punct";
  id: string;
  /** compatibilitate: id-ul tipului de aparat pentru puncte */
  deviceTypeId: string;
  name: string;
  n: number;
}

/** tipurile de puncte fara doza (iluminat) cu litera de adaugare rapida */
export function shortcutTypes(lib: Library): DeviceType[] {
  return lib.deviceTypes.filter((t) => t.shortcut && t.shortcut.trim());
}

/** destinatiile de doza cu litera */
export const shortcutPurposes = (lib: Library): PointPurpose[] => lib.pointPurposes.filter((x) => x.shortcut && x.shortcut.trim());

/**
 * Interpreteaza un cod rapid: "4P 2L 1I", "3p2l", "P P L" sau "4 P".
 * Literele vin din biblioteca (campul „litera” al tipului de aparat).
 */
export function parseQuickCode(lib: Library, code: string): { items: QuickItem[]; errors: string[] } {
  type Entry = { kind: "doza" | "punct"; id: string; name: string };
  const map = new Map<string, Entry>();
  for (const t of shortcutTypes(lib)) map.set(t.shortcut!.trim().toUpperCase(), { kind: "punct", id: t.id, name: t.name });
  // destinatiile de doza au prioritate la aceeasi litera
  for (const x of shortcutPurposes(lib)) map.set(x.shortcut.trim().toUpperCase(), { kind: "doza", id: x.id, name: x.name });
  const items = new Map<string, QuickItem>();
  const errors: string[] = [];
  const re = /(\d*)\s*([A-Za-z]+)/g;
  const clean = code.trim();
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = re.exec(clean))) {
    consumed += m[0].replace(/\s/g, "").length;
    const n = m[1] ? parseInt(m[1], 10) : 1;
    const letters = m[2].toUpperCase();
    // literele lipite fara numar ("PPL") se citesc pe rand; o litera precedata de numar se aplica intreg
    const keys = map.has(letters) ? [letters] : letters.split("");
    keys.forEach((k, i) => {
      const t = map.get(k);
      if (!t) {
        errors.push(`litera „${k}” nu este definita`);
        return;
      }
      const qty = i === 0 ? n : 1;
      const cur = items.get(t.id) ?? { kind: t.kind, id: t.id, deviceTypeId: t.kind === "punct" ? t.id : "", name: t.name, n: 0 };
      cur.n += qty;
      items.set(t.id, cur);
    });
  }
  if (consumed < clean.replace(/[\s,;+]/g, "").length) errors.push("caractere neinterpretate");
  return { items: [...items.values()].filter((x) => x.n > 0), errors };
}

/* --------------------------- statistici ---------------------------- */

/** aplica un cod rapid intr-o incapere */
export function applyQuickItems(p: Project, roomId: string, items: QuickItem[]) {
  for (const it of items) {
    if (it.kind === "doza") addBoxes(p, roomId, it.id, it.n);
    else addPoints(p, roomId, it.id, it.n);
  }
}

export interface PointStats {
  total: number;
  byFunction: Partial<Record<PointFunction, number>>;
  unassigned: number;
  boxes: number;
}

export function pointStats(p: Project, devices: Device[]): PointStats {
  const byFunction: Partial<Record<PointFunction, number>> = {};
  for (const d of devices) {
    const f = pointFunction(d);
    byFunction[f] = (byFunction[f] ?? 0) + 1;
  }
  const ids = new Set(devices.map((d) => d.boxId).filter(Boolean));
  return {
    total: devices.length,
    byFunction,
    unassigned: devices.filter((d) => !d.circuitId && d.category !== "curenti_slabi").length,
    boxes: ids.size,
  };
}

export const roomDevices = (p: Project, roomId: string) => p.devices.filter((d) => d.roomId === roomId);
export const levelDevices = (p: Project, levelId: string) => {
  const rooms = new Set(p.rooms.filter((r) => r.levelId === levelId).map((r) => r.id));
  return p.devices.filter((d) => rooms.has(d.roomId));
};
