import {
  cableLabel,
  getRules,
  izFor,
  phasesFromPoles,
  voltageDropPct,
  type Phases,
} from "./electrical";
import { roomRoute, safe } from "./inventory";
import { layoutPanel } from "./panel";
import { newDevice } from "./defaults";
import type {
  CircuitKind,
  CircuitOverride,
  Curve,
  Level,
  LevelKind,
  Panel,
  PanelDevice,
  PricingSettings,
  Project,
  Room,
  RuleSettings,
} from "./types";

/**
 * Generarea circuitelor din inventarul de doze.
 *
 * Circuitele sunt DERIVATE (nu se salveaza): se regenereaza la fiecare
 * modificare a dozelor. Ce schimba electricianul se pastreaza separat in
 * `project.circuitOverrides`, dupa id-ul stabil al circuitului.
 */
export type Circuit = {
  /** Id stabil (nu depinde de ordine sau de cod). */
  id: string;
  /** Cod de circuit, ex. CI_P01, CP_P01, CP_P03_02, LED_P01. */
  code: string;
  name: string;
  kind: CircuitKind;
  levelId: string;
  roomIds: string[];
  /** Numarul de prize / puncte de iluminat / consumatori. */
  points: number;
  /** Tabloul din care pleaca circuitul. */
  panelId?: string;
  /** false = nivelul nu are tablou atribuit si circuitul a fost pus in tabloul principal. */
  panelAssigned: boolean;
  ratedA: number;
  curve: Curve;
  poles: 1 | 2 | 3 | 4;
  phases: Phases;
  sectionMm2: number;
  cable: string;
  lengthM: number;
  lengthEstimated: boolean;
  powerKw: number;
  iz: number | null;
  dropPct: number | null;
  dropLimitPct: number;
  /** Numarul de ordine al circuitului in tabloul lui (1, 2, ...). */
  order: number;
  /** Campurile modificate manual. */
  overridden: (keyof CircuitOverride)[];
  /** Id-urile circuitelor comasate in acesta. */
  merged: string[];
};

const LEVEL_PREFIX: Record<LevelKind, string> = {
  subsol: "S",
  demisol: "D",
  parter: "P",
  etaj: "E",
  mansarda: "M",
  anexa: "A",
};

/** Prefixul nivelului (P, E, E2, ...). */
export function levelPrefix(level: Level, levels: Level[]): string {
  const same = levels.filter((l) => l.kind === level.kind);
  const base = LEVEL_PREFIX[level.kind] ?? "N";
  return same.length > 1 ? `${base}${same.findIndex((l) => l.id === level.id) + 1}` : base;
}

/** Codul incaperii: cel introdus sau generat (P01, P02, E01 ...). */
export function roomCode(room: Room, level: Level, levels: Level[]): string {
  const c = room.code?.trim();
  return c || autoRoomCode(room, level, levels);
}

/** Codul generat automat, din nivel si ordinea incaperii. */
export function autoRoomCode(room: Room, level: Level, levels: Level[]): string {
  const i = level.rooms.findIndex((r) => r.id === room.id);
  return `${levelPrefix(level, levels)}${String(i + 1).padStart(2, "0")}`;
}

/** Tabloul principal: primul fara parinte (sau primul, daca toate au parinte). */
export function mainPanel(panels: Panel[]): Panel | undefined {
  const ids = new Set(panels.map((p) => p.id));
  return panels.find((p) => !p.parentPanelId || !ids.has(p.parentPanelId)) ?? panels[0];
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const chunkSuffix = (i: number) => (i === 0 ? "" : `_${LETTERS[i] ?? i + 1}`);

/** Imparte n puncte in grupuri de cel mult max. */
function chunks(n: number, max: number): number[] {
  if (n <= 0) return [];
  const m = Math.max(1, Math.floor(max) || 1);
  const out: number[] = [];
  for (let left = n; left > 0; left -= m) out.push(Math.min(m, left));
  return out;
}

type Draft = Omit<
  Circuit,
  "order" | "overridden" | "merged" | "cable" | "iz" | "dropPct" | "dropLimitPct" | "phases" | "lengthEstimated"
> & { lengthEstimated: boolean };

export function deriveCircuits(project: Project, rules: RuleSettings, defaultRouteMPerPoint: number): Circuit[] {
  const main = mainPanel(project.panels);
  const panelIds = new Set(project.panels.map((p) => p.id));
  const drafts: Draft[] = [];

  for (const level of project.levels) {
    const assigned = !!level.panelId && panelIds.has(level.panelId);
    const panelId = assigned ? level.panelId : main?.id;

    const base = (kind: CircuitKind) => {
      const d = rules.defaults[kind];
      return {
        kind,
        levelId: level.id,
        panelId,
        panelAssigned: assigned,
        ratedA: d.ratedA,
        curve: d.curve,
        poles: 1 as const,
        sectionMm2: d.sectionMm2,
      };
    };

    // Lungimea traseului din incapere se imparte pe circuite proportional cu punctele.
    const roomShare = (room: Room) => {
      const p = room.points;
      const weights = {
        iluminat: safe(p.iluminat) + safe(p.intrerupator),
        prize: safe(p.priza),
        dedicat: safe(p.dedicat),
        led: safe(room.ledStripM) > 0 ? 1 : 0,
      };
      const total = weights.iluminat + weights.prize + weights.dedicat + weights.led;
      const route = roomRoute(room, defaultRouteMPerPoint);
      return {
        estimated: route.estimated > 0,
        /** Metri de traseu pe unitate de pondere. */
        unit: total > 0 ? route.total / total : 0,
        weights,
      };
    };

    // Iluminat
    if (rules.lightingGrouping === "nivel") {
      const prefix = levelPrefix(level, project.levels);
      let group: { rooms: Room[]; points: number; length: number; est: boolean } = { rooms: [], points: 0, length: 0, est: false };
      const groups: (typeof group)[] = [];
      for (const room of level.rooms) {
        const n = safe(room.points.iluminat);
        if (n <= 0) continue;
        const share = roomShare(room);
        const len = share.unit * share.weights.iluminat;
        if (group.points > 0 && group.points + n > rules.maxLightPointsPerCircuit) {
          groups.push(group);
          group = { rooms: [], points: 0, length: 0, est: false };
        }
        group.rooms.push(room);
        group.points += n;
        group.length += len;
        group.est ||= share.estimated;
      }
      if (group.points > 0) groups.push(group);
      groups.forEach((g, i) => {
        drafts.push({
          ...base("iluminat"),
          id: `ci:lvl:${level.id}:${i}`,
          code: `CI_${prefix}${chunkSuffix(i)}`,
          name: `Iluminat ${level.name}${groups.length > 1 ? ` ${i + 1}` : ""}`,
          roomIds: g.rooms.map((r) => r.id),
          points: g.points,
          lengthM: g.length,
          lengthEstimated: g.est,
          powerKw: g.points * rules.defaults.iluminat.powerPerUnitKw,
        });
      });
    }

    for (const room of level.rooms) {
      const code = roomCode(room, level, project.levels);
      const share = roomShare(room);
      const unit = share.unit;

      if (rules.lightingGrouping !== "nivel") {
        const parts = chunks(safe(room.points.iluminat), rules.maxLightPointsPerCircuit);
        const lenAll = unit * share.weights.iluminat;
        parts.forEach((n, i) => {
          drafts.push({
            ...base("iluminat"),
            id: `ci:${room.id}:${i}`,
            code: `CI_${code}${chunkSuffix(i)}`,
            name: `Iluminat ${room.name}${parts.length > 1 ? ` ${i + 1}` : ""}`,
            roomIds: [room.id],
            points: n,
            lengthM: lenAll / parts.length,
            lengthEstimated: share.estimated,
            powerKw: n * rules.defaults.iluminat.powerPerUnitKw,
          });
        });
      }

      const sockets = chunks(safe(room.points.priza), rules.maxSocketsPerCircuit);
      sockets.forEach((n, i) => {
        drafts.push({
          ...base("prize"),
          id: `cp:${room.id}:${i}`,
          code: `CP_${code}${chunkSuffix(i)}`,
          name: `Prize ${room.name}${sockets.length > 1 ? ` ${i + 1}` : ""}`,
          roomIds: [room.id],
          points: n,
          lengthM: unit * n,
          lengthEstimated: share.estimated,
          powerKw: n * rules.defaults.prize.powerPerUnitKw,
        });
      });

      const ded = Math.floor(safe(room.points.dedicat));
      for (let i = 0; i < ded; i++) {
        drafts.push({
          ...base("dedicat"),
          id: `cd:${room.id}:${i}`,
          code: `CP_${code}_${String(i + 1).padStart(2, "0")}`,
          name: `Dedicat ${room.name} ${i + 1}`,
          roomIds: [room.id],
          points: 1,
          lengthM: unit,
          lengthEstimated: share.estimated,
          powerKw: rules.defaults.dedicat.powerPerUnitKw,
        });
      }

      if (safe(room.ledStripM) > 0) {
        drafts.push({
          ...base("led"),
          id: `led:${room.id}`,
          code: `LED_${code}`,
          name: `Banda LED ${room.name}`,
          roomIds: [room.id],
          points: 1,
          lengthM: unit,
          lengthEstimated: share.estimated,
          powerKw: safe(room.ledStripM) * rules.defaults.led.powerPerUnitKw,
        });
      }
    }
  }

  // Modificarile manuale
  const ov = project.circuitOverrides ?? {};
  const withOverrides = drafts.map((d) => {
    const o = ov[d.id] ?? {};
    const overridden = (Object.keys(o) as (keyof CircuitOverride)[]).filter((k) => o[k] !== undefined && o[k] !== "");
    const c = { ...d, overridden, merged: [] as string[] };
    if (o.name?.trim()) c.name = o.name.trim();
    if (o.ratedA && o.ratedA > 0) c.ratedA = o.ratedA;
    if (o.curve) c.curve = o.curve;
    if (o.poles) c.poles = o.poles;
    if (o.sectionMm2 && o.sectionMm2 > 0) c.sectionMm2 = o.sectionMm2;
    if (o.lengthM != null && o.lengthM >= 0) {
      c.lengthM = o.lengthM;
      c.lengthEstimated = false;
    }
    if (o.powerKw != null && o.powerKw >= 0) c.powerKw = o.powerKw;
    if (o.panelId && panelIds.has(o.panelId)) {
      c.panelId = o.panelId;
      c.panelAssigned = true;
    }
    return c;
  });

  // Comasari: circuitul sursa se adauga la circuitul tinta (acelasi aparat).
  const byId = new Map(withOverrides.map((c) => [c.id, c]));
  const removed = new Set<string>();
  for (const c of withOverrides) {
    const target = resolveMergeTarget(c.id, ov, byId);
    // bucla (A→B, B→A): tinta e la randul ei comasata — nu se comaseaza nimic
    if (!target || target === c.id || removed.has(target) || resolveMergeTarget(target, ov, byId)) continue;
    const t = byId.get(target)!;
    t.points += c.points;
    t.roomIds = [...new Set([...t.roomIds, ...c.roomIds])];
    t.lengthM += c.lengthM;
    t.lengthEstimated ||= c.lengthEstimated;
    t.powerKw += c.powerKw;
    t.merged.push(c.id);
    removed.add(c.id);
  }

  const order = new Map<string, number>();
  return withOverrides
    .filter((c) => !removed.has(c.id))
    .map((c) => {
      const phases = phasesFromPoles(c.poles);
      const key = c.panelId ?? "";
      const n = (order.get(key) ?? 0) + 1;
      order.set(key, n);
      const dropLimitPct =
        c.kind === "iluminat" || c.kind === "led" ? rules.maxDropLightingPct : rules.maxDropOtherPct;
      return {
        ...c,
        phases,
        order: n,
        cable: cableLabel(phases, c.sectionMm2),
        iz: izFor(c.sectionMm2, phases, rules.iz),
        dropPct: voltageDropPct(phases, c.ratedA, c.lengthM, c.sectionMm2, rules.rho),
        dropLimitPct,
      };
    });
}

/** Circuitele proiectului, cu regulile din setari. */
export function projectCircuits(project: Project, settings: PricingSettings): Circuit[] {
  return deriveCircuits(project, getRules(settings), settings.defaultRouteMPerPoint);
}

/** Urmareste lantul de comasari; ignora buclele si tintele inexistente. */
function resolveMergeTarget(
  id: string,
  ov: Record<string, CircuitOverride>,
  byId: Map<string, unknown>,
): string | null {
  const seen = new Set<string>([id]);
  let cur = ov[id]?.mergeInto;
  let last: string | null = null;
  while (cur && byId.has(cur) && !seen.has(cur)) {
    last = cur;
    seen.add(cur);
    cur = ov[cur]?.mergeInto;
  }
  return last;
}

/* ------------------------------------------------------------------ */
/* Aparate si sugestii                                                 */
/* ------------------------------------------------------------------ */

const PROTECTIVE = new Set(["MCB", "RCBO"]);

/** Textul caracteristicilor unui aparat: C16, 40 A 30 mA A, sau textul liber. */
export function deviceRatingText(d: PanelDevice): string {
  if (d.ratedA && d.ratedA > 0) {
    if (d.kind === "RCD") {
      return [`${d.ratedA}A`, d.sensitivityMa ? `${d.sensitivityMa}mA` : "", d.rcdType ?? ""].filter(Boolean).join(" ");
    }
    if (d.kind === "RCBO") {
      return [`${d.curve ?? ""}${d.ratedA}`, d.sensitivityMa ? `${d.sensitivityMa}mA` : ""].filter(Boolean).join(" ");
    }
    if (PROTECTIVE.has(d.kind)) return `${d.curve ?? ""}${d.ratedA}`;
    return `${d.ratedA}A`;
  }
  return d.rating?.trim() ?? "";
}

export function deviceForCircuit(c: Circuit, panel: Panel): PanelDevice {
  const rcd = panel.devices.find((d) => d.kind === "RCD");
  const lay = layoutPanel(panel);
  const modules = c.poles;
  const row = lay.rows.find((r) => r.free >= modules)?.row ?? Math.max(0, panel.rows - 1);
  return newDevice({
    kind: "MCB",
    label: `${c.code} ${c.name}`,
    poles: c.poles,
    modules,
    row,
    ratedA: c.ratedA,
    curve: c.curve,
    circuitId: c.id,
    upstreamRcdId: rcd && (c.kind === "prize" || c.kind === "dedicat") ? rcd.id : undefined,
  });
}

export type BreakerSuggestion = {
  missing: Circuit[];
  installed: { circuit: Circuit; device: PanelDevice; mismatch: boolean }[];
  /** Aparate legate de circuite care nu mai exista (ex. doze sterse). */
  stale: PanelDevice[];
};

export function suggestBreakers(panel: Panel, circuits: Circuit[]): BreakerSuggestion {
  const own = circuits.filter((c) => c.panelId === panel.id);
  const allIds = new Set(circuits.map((c) => c.id));
  const byCircuit = new Map(panel.devices.filter((d) => d.circuitId).map((d) => [d.circuitId!, d]));
  const missing: Circuit[] = [];
  const installed: BreakerSuggestion["installed"] = [];
  for (const c of own) {
    const d = byCircuit.get(c.id);
    if (!d) missing.push(c);
    else
      installed.push({
        circuit: c,
        device: d,
        mismatch: (d.ratedA ?? 0) !== c.ratedA || (d.curve ?? c.curve) !== c.curve || d.poles !== c.poles,
      });
  }
  const stale = panel.devices.filter((d) => d.circuitId && !allIds.has(d.circuitId));
  return { missing, installed, stale };
}

/** Adauga in tablou aparatele pentru circuitele date (in ordine). */
export function addCircuitDevices(panel: Panel, list: Circuit[]): Panel {
  let p = panel;
  for (const c of list) {
    if (p.devices.some((d) => d.circuitId === c.id)) continue;
    p = { ...p, devices: [...p.devices, deviceForCircuit(c, p)] };
  }
  return p;
}

/** Aparatul general al tabloului: marcat ca general, altfel primul separator. */
export function panelMainDevice(panel: Panel): PanelDevice | undefined {
  return panel.devices.find((d) => d.isMain) ?? panel.devices.find((d) => d.kind === "separator");
}

/** Aparatul din tabloul parinte care alimenteaza tabloul dat. */
export function feederDevice(panel: Panel, panels: Panel[]): PanelDevice | undefined {
  const parent = panels.find((p) => p.id === panel.parentPanelId);
  return parent?.devices.find((d) => d.feedsPanelId === panel.id);
}

/** Aparatele de plecare (MCB/RCBO) dintr-un tablou, fara aparatul general. */
export function outgoingProtective(panel: Panel): PanelDevice[] {
  const main = panelMainDevice(panel);
  return panel.devices.filter((d) => PROTECTIVE.has(d.kind) && d !== main && !d.isMain);
}

/** Puterea instalata totala (kW) din circuite. */
export function installedPowerKw(circuits: Circuit[]): number {
  return circuits.reduce((s, c) => s + safe(c.powerKw), 0);
}
