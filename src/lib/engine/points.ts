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
import { newBox, newDevice, removeDevices } from "../model/factory";
import type { Device, DeviceCategory, DeviceType, Library, Project } from "../model/types";

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

/* ---------------------------- cod rapid ---------------------------- */

export interface QuickItem {
  deviceTypeId: string;
  name: string;
  n: number;
}

/** tipurile cu litera de adaugare rapida, in ordinea din biblioteca */
export function shortcutTypes(lib: Library): DeviceType[] {
  return lib.deviceTypes.filter((t) => t.shortcut && t.shortcut.trim());
}

/**
 * Interpreteaza un cod rapid: "4P 2L 1I", "3p2l", "P P L" sau "4 P".
 * Literele vin din biblioteca (campul „litera” al tipului de aparat).
 */
export function parseQuickCode(lib: Library, code: string): { items: QuickItem[]; errors: string[] } {
  const map = new Map(shortcutTypes(lib).map((t) => [t.shortcut!.trim().toUpperCase(), t] as const));
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
      const cur = items.get(t.id) ?? { deviceTypeId: t.id, name: t.name, n: 0 };
      cur.n += qty;
      items.set(t.id, cur);
    });
  }
  if (consumed < clean.replace(/[\s,;+]/g, "").length) errors.push("caractere neinterpretate");
  return { items: [...items.values()].filter((x) => x.n > 0), errors };
}

/* --------------------------- statistici ---------------------------- */

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
