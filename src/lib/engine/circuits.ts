/**
 * Circuite: consum pe circuit si propunerea automata de grupare (cap. 6.1).
 *
 * Principii:
 *  - gruparea se face dupa destinatie, incapere, nivel, un buget de putere
 *    (conventie WATTNET R011) si numarul maxim de puncte pe circuit setat pe
 *    proiect (lucru rapid, implicit 6 doze);
 *  - consumatorii dedicati primesc circuit propriu;
 *  - punctele mutate manual (circuitLocked) nu sunt atinse de generare;
 *  - codurile circuitelor existente raman stabile; circuitele automate golite
 *    se elimina, iar codurile lor nu se reutilizeaza.
 */
import { newCircuit } from "../model/factory";
import type { Circuit, Device, Project, Room } from "../model/types";
import { circuitCableLength, circuitLimitPoints, round, type Qty } from "./measure";
import { circuitInstalledPower, designCurrent, isPowerDevice, type PowerSum } from "./power";

/* --------------------------- consum pe circuit --------------------- */

export interface CircuitLoad {
  circuit: Circuit;
  devices: Device[];
  sockets: number;
  lights: number;
  switches: number;
  others: number;
  installed: PowerSum;
  /** P aplicata = P instalata x ks (W). null daca lipsesc date */
  appliedW: number | null;
  /** curentul de calcul pentru puterea aplicata (A) */
  designCurrentA: number | null;
  /** curentul pentru puterea instalata integral (A) */
  installedCurrentA: number | null;
  length: Qty;
  /** sistemul de alimentare al circuitului */
  system: "mono" | "tri";
  warnings: string[];
}

export function circuitSystem(p: Project, c: Circuit): "mono" | "tri" {
  if (p.supply.system === "mono") return "mono";
  return c.phase === "L123" ? "tri" : "mono";
}

/** tensiunea folosita pentru curentul de calcul: 230 V monofazat, U intre faze la trifazat */
function circuitVoltage(p: Project, sys: "mono" | "tri") {
  if (sys === "tri") return p.supply.voltageV;
  return p.supply.system === "mono" ? p.supply.voltageV : Math.round(p.supply.voltageV / Math.sqrt(3));
}

export function circuitLoad(p: Project, c: Circuit): CircuitLoad {
  const devices = p.devices.filter((d) => d.circuitId === c.id);
  const installed = circuitInstalledPower(p, c);
  const ks = c.simultaneity.value;
  const sys = circuitSystem(p, c);
  const U = circuitVoltage(p, sys);
  const cos = p.supply.cosPhi;
  const warnings: string[] = [];
  if (installed.unknownCount > 0) warnings.push(`${installed.unknownCount} consumatori fara putere`);
  if (ks === null && (installed.value ?? 0) > 0) warnings.push("simultaneitate neintrodusa");
  if (devices.some((d) => d.threePhase) && sys !== "tri") warnings.push("consumator trifazat pe circuit monofazat");
  const appliedW = installed.value !== null && ks !== null ? round(installed.value * ks, 0) : null;
  return {
    circuit: c,
    devices,
    sockets: devices.length === 0 && c.declaredPoints != null && c.usage === "prize" ? c.declaredPoints : devices.filter((d) => d.category === "priza").length,
    lights: devices.length === 0 && c.declaredPoints != null && c.usage === "iluminat" ? c.declaredPoints : devices.filter((d) => d.category === "iluminat").length,
    switches: devices.filter((d) => d.category === "intrerupator").length,
    others: devices.length === 0 && c.declaredPoints != null && !["prize", "iluminat"].includes(c.usage) ? c.declaredPoints : devices.filter((d) => !["priza", "iluminat", "intrerupator"].includes(d.category)).length,
    installed,
    appliedW,
    designCurrentA: appliedW !== null && appliedW > 0 ? designCurrent(appliedW, sys, cos, U) : appliedW === 0 ? 0 : null,
    installedCurrentA: installed.value ? designCurrent(installed.value, sys, cos, U) : installed.value === 0 ? 0 : null,
    length: circuitCableLength(p, c),
    system: sys,
    warnings,
  };
}

export function allCircuitLoads(p: Project): CircuitLoad[] {
  return [...p.circuits].sort((a, b) => a.order - b.order || a.code.localeCompare(b.code)).map((c) => circuitLoad(p, c));
}

/* ------------------------- generare automata ----------------------- */

export interface GenerationReport {
  created: string[]; // coduri circuite noi
  assigned: number; // puncte asociate
  removed: string[]; // coduri circuite automate eliminate (goale)
  skipped: string[]; // motive
}

const KITCHEN = new Set(["rt-bucatarie"]);
const isKitchen = (r?: Room) => !!r && (KITCHEN.has(r.roomTypeId ?? "") || /bucatar/i.test(r.name));
const isBath = (r?: Room) => !!r && (r.roomTypeId === "rt-baie" || /baie/i.test(r.name));
const isOutdoor = (r?: Room) => !!r && (r.roomTypeId === "rt-terasa" || /terasa|exterior|curte|gradina/i.test(r.name));

interface GroupSpec {
  key: string;
  name: string;
  usage: Circuit["usage"];
  circuitTypeId: string;
  dedicated: boolean;
}

function groupFor(p: Project, d: Device): GroupSpec | null {
  const room = p.rooms.find((r) => r.id === d.roomId);
  const level = room ? p.levels.find((l) => l.id === room.levelId) : undefined;
  const levelName = level?.name ?? "";
  if (d.category === "curenti_slabi") return null;
  if (d.category === "consumator_dedicat") {
    return { key: `ded|${d.id}`, name: `${d.label || "Consumator"}${room ? " - " + room.name : ""}`, usage: "dedicat", circuitTypeId: "ctp-dedicat", dedicated: true };
  }
  if (d.category === "iluminat") {
    if (isOutdoor(room)) return { key: `il|ext`, name: "Iluminat exterior", usage: "iluminat", circuitTypeId: "ctp-iluminat", dedicated: false };
    return { key: `il|${level?.id ?? "-"}`, name: `Iluminat ${levelName}`.trim(), usage: "iluminat", circuitTypeId: "ctp-iluminat", dedicated: false };
  }
  if (d.category === "priza" || d.category === "altul") {
    if (isKitchen(room)) return { key: `pr|${room!.id}`, name: `Prize ${room!.name}`, usage: "prize", circuitTypeId: "ctp-prize-bucatarie", dedicated: false };
    if (isBath(room)) return { key: `pr|${room!.id}`, name: `Prize ${room!.name}`, usage: "prize", circuitTypeId: "ctp-prize-baie", dedicated: false };
    if (isOutdoor(room)) return { key: `pr|ext`, name: "Prize exterior", usage: "prize", circuitTypeId: "ctp-prize", dedicated: false };
    return { key: `pr|${level?.id ?? "-"}`, name: `Prize ${levelName}`.trim(), usage: "prize", circuitTypeId: "ctp-prize", dedicated: false };
  }
  if (d.category === "comanda") {
    // senzori / termostate: pe circuitul de iluminat al nivelului
    return { key: `il|${level?.id ?? "-"}`, name: `Iluminat ${levelName}`.trim(), usage: "iluminat", circuitTypeId: "ctp-iluminat", dedicated: false };
  }
  return null;
}

/** bugetul de putere aplicata pentru un circuit (W), dupa conventia R011 */
function budgetW(p: Project, c: Circuit): number | null {
  const In = c.protection.ratingA;
  if (!In) return null;
  const pct = p.library.rules.find((r) => r.id === "r-incarcare-grupare")?.params.maxLoadPct ?? 80;
  const U = p.supply.system === "mono" ? p.supply.voltageV : Math.round(p.supply.voltageV / Math.sqrt(3));
  return In * U * p.supply.cosPhi * (pct / 100);
}

const appliedOf = (p: Project, c: Circuit) => {
  const pi = circuitInstalledPower(p, c).value ?? 0;
  return pi * (c.simultaneity.value ?? 1);
};

/**
 * Asociaza punctele neasociate (si neblocate) la circuite.
 * mode "completeaza": pastreaza toate asocierile existente.
 * mode "reorganizeaza": elibereaza punctele din circuitele automate (neblocate) si le regrupeaza.
 * Modifica proiectul primit (se apeleaza pe o copie din store).
 */
export function generateCircuits(p: Project, mode: "completeaza" | "reorganizeaza" = "completeaza"): GenerationReport {
  const report: GenerationReport = { created: [], assigned: 0, removed: [], skipped: [] };
  const groupKey = new Map<string, string>(); // circuitId -> group key

  if (mode === "reorganizeaza") {
    const autoIds = new Set(p.circuits.filter((c) => c.autoGenerated).map((c) => c.id));
    for (const d of p.devices) if (d.circuitId && autoIds.has(d.circuitId) && !d.circuitLocked) d.circuitId = null;
  }

  // circuitele automate existente isi pastreaza cheia de grup (dupa punctele ramase sau dupa nume)
  for (const c of p.circuits) {
    if (!c.autoGenerated) continue;
    if (c.groupKey) {
      groupKey.set(c.id, c.groupKey);
      continue;
    }
    const any = p.devices.find((d) => d.circuitId === c.id && d.category !== "intrerupator" && !d.circuitLocked);
    const g = any ? groupFor(p, any) : null;
    if (g) groupKey.set(c.id, g.key);
  }

  // ordinea: dedicati, prize, iluminat, comanda - deterministic dupa cod
  const order: Record<string, number> = { consumator_dedicat: 0, priza: 1, altul: 2, iluminat: 3, comanda: 4 };
  const roomIdx = new Map(p.rooms.map((r, i) => [r.id, i] as const));
  const pending = p.devices
    .filter((d) => !d.circuitId && !d.circuitLocked && d.category !== "intrerupator" && d.category !== "curenti_slabi")
    .sort((a, b) => (order[a.category] ?? 9) - (order[b.category] ?? 9) || (roomIdx.get(a.roomId) ?? 0) - (roomIdx.get(b.roomId) ?? 0) || a.code.localeCompare(b.code));
  // puncte ramase de asociat pe grup + incapere: o incapere se pastreaza pe acelasi circuit cand incape
  const remaining = new Map<string, number>();
  const remKey = (g: GroupSpec, d: Device) => `${g.key}|${d.roomId}`;
  for (const d of pending) {
    const g = groupFor(p, d);
    if (g && !g.dedicated) remaining.set(remKey(g, d), (remaining.get(remKey(g, d)) ?? 0) + 1);
  }

  for (const d of pending) {
    const g = groupFor(p, d);
    if (!g) {
      report.skipped.push(`${d.code}: categorie fara circuit`);
      continue;
    }
    let target: Circuit | undefined;
    if (!g.dedicated) {
      const hasRoom = (c: Circuit) => p.devices.some((x) => x.circuitId === c.id && x.roomId === d.roomId);
      // intai circuitele pe care incaperea a fost deja pusa
      const candidates = p.circuits.filter((c) => c.autoGenerated && groupKey.get(c.id) === g.key).sort((a, b) => Number(hasRoom(b)) - Number(hasRoom(a)));
      const maxPts = p.fast?.maxPointsPerCircuit ?? 0;
      for (const c of candidates) {
        if (maxPts > 0) {
          const sharesBox = !!d.boxId && p.devices.some((x) => x.circuitId === c.id && x.boxId === d.boxId);
          const left = maxPts - circuitLimitPoints(p, c);
          if (!sharesBox && left <= 0) continue;
          // incapere noua pe circuit: doar daca incape cu toate punctele ei (altfel circuit nou pentru incapere)
          const sameRoom = p.devices.some((x) => x.circuitId === c.id && x.roomId === d.roomId);
          const need = Math.min(remaining.get(remKey(g, d)) ?? 1, maxPts);
          if (!sharesBox && !sameRoom && left < need) continue;
        }
        const budget = budgetW(p, c);
        const add = (d.powerW.value ?? 0) * (c.simultaneity.value ?? 1);
        if (budget === null || appliedOf(p, c) + add <= budget || circuitInstalledPower(p, c).knownCount === 0) {
          target = c;
          break;
        }
      }
    }
    if (!target) {
      const sameGroup = [...groupKey.values()].filter((k) => k === g.key).length;
      const name = sameGroup > 0 ? `${g.name} (${sameGroup + 1})` : g.name;
      target = newCircuit(p, name, g.usage, g.circuitTypeId, true);
      target.groupKey = g.key;
      if (g.dedicated) {
        // dedicat: cablu si protectie raman de stabilit din puterea consumatorului
        target.cableTypeId = null;
        target.protection = { ...target.protection, protectionDeviceId: null, ratingA: null };
        if (d.threePhase && p.supply.system === "tri") {
          target.phase = "L123";
          target.protection.poles = "3P+N";
        }
      }
      p.circuits.push(target);
      groupKey.set(target.id, g.key);
      report.created.push(target.code);
    }
    d.circuitId = target.id;
    if (!g.dedicated) remaining.set(remKey(g, d), (remaining.get(remKey(g, d)) ?? 1) - 1);
    report.assigned++;
  }

  // intrerupatoarele urmeaza punctele de iluminat comandate; altfel iluminatul nivelului
  for (const sw of p.devices.filter((x) => x.category === "intrerupator" && !x.circuitLocked)) {
    if (sw.circuitId && mode === "completeaza") continue;
    const lamp = p.devices.find((l) => l.category === "iluminat" && l.controlledByIds.includes(sw.id) && l.circuitId);
    if (lamp) {
      sw.circuitId = lamp.circuitId;
      continue;
    }
    const room = p.rooms.find((r) => r.id === sw.roomId);
    const key = `il|${room?.levelId ?? "-"}`;
    const c = p.circuits.find((x) => groupKey.get(x.id) === key);
    if (c) sw.circuitId = c.id;
  }

  // circuite automate ramase goale: eliminate (codul nu se reutilizeaza)
  const used = new Set(p.devices.map((d) => d.circuitId).filter(Boolean));
  const keep: Circuit[] = [];
  for (const c of p.circuits) {
    if (c.autoGenerated && !used.has(c.id) && c.lockedFields.length === 0) report.removed.push(c.code);
    else keep.push(c);
  }
  p.circuits = keep;
  p.circuits.forEach((c, i) => (c.order = i));
  return report;
}

/** muta un punct pe alt circuit (manual => blocat) */
export function moveDevice(p: Project, deviceId: string, circuitId: string | null) {
  const d = p.devices.find((x) => x.id === deviceId);
  if (!d) return;
  d.circuitId = circuitId;
  d.circuitLocked = circuitId !== null;
}

export { isPowerDevice };
