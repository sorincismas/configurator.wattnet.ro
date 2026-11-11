/**
 * Traseul unui circuit ca lant (faza la rosu): tablou > doza > doza > ...
 *
 * Membrii lantului sunt capetele circuitului: dozele (Box) si punctele fara
 * doza (Device, ex. puncte de iluminat). Fiecare legatura are o lungime:
 * masurata (introdusa) sau estimata din setarile proiectului - prima legatura
 * cu distanta pana la tablou, urmatoarele cu metrii pe punct.
 * Ordinea salvata pe circuit se pastreaza; membrii noi se adauga la final,
 * cei scosi din circuit dispar din lant.
 */
import type { ChainLink, Circuit, Project, Tracked } from "../model/types";

const isMeasured = (t: Tracked<number>) => t.value !== null && (t.provenance === "masurat" || t.status === "masurat" || t.status === "confirmat" || t.status === "validat");

export interface ChainMember {
  memberId: string;
  kind: "doza" | "punct";
  code: string;
  roomId: string;
}

export interface ResolvedLink extends ChainMember {
  lengthM: Tracked<number>;
  /** lungimea folosita in calcul (masurata sau estimata) */
  effectiveM: number;
  estimated: boolean;
}

/** capetele circuitului, in ordinea implicita (incapere, cod) */
export function chainMembers(p: Project, c: Circuit): ChainMember[] {
  const roomIdx = new Map(p.rooms.map((r, i) => [r.id, i] as const));
  const out = new Map<string, ChainMember>();
  for (const d of p.devices) {
    if (d.circuitId !== c.id) continue;
    if (d.boxId) {
      const b = p.boxes.find((x) => x.id === d.boxId);
      if (b && !out.has(b.id)) out.set(b.id, { memberId: b.id, kind: "doza", code: b.code, roomId: b.roomId });
    } else if (!out.has(d.id)) out.set(d.id, { memberId: d.id, kind: "punct", code: d.code, roomId: d.roomId });
  }
  return [...out.values()].sort((a, b) => (roomIdx.get(a.roomId) ?? 0) - (roomIdx.get(b.roomId) ?? 0) || a.code.localeCompare(b.code));
}

/** lantul circuitului: ordinea salvata + membrii noi, cu lungimile efective */
export function resolveChain(p: Project, c: Circuit): ResolvedLink[] {
  const members = chainMembers(p, c);
  const byId = new Map(members.map((m) => [m.memberId, m] as const));
  const saved = (c.chain ?? []).filter((l) => byId.has(l.memberId));
  const savedIds = new Set(saved.map((l) => l.memberId));
  const links: ChainLink[] = [...saved, ...members.filter((m) => !savedIds.has(m.memberId)).map((m) => ({ memberId: m.memberId, lengthM: { value: null, provenance: "estimat" } as Tracked<number> }))];
  const first = p.fast?.panelDistanceM ?? 0;
  const per = p.fast?.metersPerPoint ?? 0;
  return links.map((l, i) => {
    const est = l.lengthM.value === null;
    return { ...byId.get(l.memberId)!, lengthM: l.lengthM, effectiveM: est ? (i === 0 ? first : per) : l.lengthM.value!, estimated: est };
  });
}

/** lungimea circuitului din lant; null cand circuitul nu are capete */
export function chainLength(p: Project, c: Circuit): { value: number; measured: boolean } | null {
  const links = resolveChain(p, c);
  if (!links.length) return null;
  const value = Math.round(links.reduce((s, l) => s + l.effectiveM, 0) * 10) / 10;
  return { value, measured: links.every((l) => !l.estimated && isMeasured(l.lengthM)) };
}

const persist = (p: Project, c: Circuit) => resolveChain(p, c).map((l) => ({ memberId: l.memberId, lengthM: l.lengthM }));

/** muta un membru in lant (sus / jos) */
export function moveInChain(p: Project, circuitId: string, memberId: string, dir: -1 | 1) {
  const c = p.circuits.find((x) => x.id === circuitId);
  if (!c) return;
  const links = persist(p, c);
  const i = links.findIndex((l) => l.memberId === memberId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= links.length) return;
  [links[i], links[j]] = [links[j], links[i]];
  c.chain = links;
}

/** seteaza lungimea legaturii catre un membru (null = revine la estimare) */
export function setLinkLength(p: Project, circuitId: string, memberId: string, value: number | null) {
  const c = p.circuits.find((x) => x.id === circuitId);
  if (!c) return;
  const links = persist(p, c);
  const l = links.find((x) => x.memberId === memberId);
  if (!l) return;
  l.lengthM = value === null ? { value: null, provenance: "estimat" } : { value, provenance: "masurat" };
  c.chain = links;
}
