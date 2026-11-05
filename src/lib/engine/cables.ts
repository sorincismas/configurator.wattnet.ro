/**
 * Cabluri derivate din trasee: fiecare circuit care trece printr-un tub al
 * unui traseu primeste un cablu (CB) cu lista traseelor parcurse.
 * Cablurile cu lungime fixata manual se pastreaza.
 */
import { newCable } from "../model/factory";
import type { Project } from "../model/types";

export function cableReserveM(p: Project): number {
  return p.library.rules.find((r) => r.id === "r-rezerva-cablu")?.params.reserveM ?? 1;
}

/** sincronizeaza cablurile cu traseele (modifica proiectul primit) */
export function syncCables(p: Project): { created: string[]; removed: string[] } {
  const created: string[] = [];
  const removed: string[] = [];
  const routesByCircuit = new Map<string, string[]>();
  for (const r of p.routes)
    for (const cd of r.conduits)
      for (const cid of cd.circuitIds) {
        const list = routesByCircuit.get(cid) ?? [];
        if (!list.includes(r.id)) list.push(r.id);
        routesByCircuit.set(cid, list);
      }

  const keep = [];
  for (const cb of p.cables) {
    const circuitExists = p.circuits.some((c) => c.id === cb.circuitId);
    const routes = routesByCircuit.get(cb.circuitId);
    const manual = cb.lengthOverrideM && cb.lengthOverrideM.value !== null;
    if (!circuitExists || (!routes && !manual)) {
      removed.push(cb.code);
      continue;
    }
    if (routes) cb.routeIds = routes;
    keep.push(cb);
  }
  p.cables = keep;

  for (const [cid, routeIds] of routesByCircuit) {
    const c = p.circuits.find((x) => x.id === cid);
    if (!c) continue;
    if (p.cables.some((cb) => cb.circuitId === cid)) continue;
    const cb = newCable(p, cid, null, routeIds, cableReserveM(p));
    p.cables.push(cb);
    created.push(cb.code);
  }
  // curata referintele la circuite sterse din tuburi
  const ids = new Set(p.circuits.map((c) => c.id));
  for (const r of p.routes) for (const cd of r.conduits) cd.circuitIds = cd.circuitIds.filter((id) => ids.has(id));
  return { created, removed };
}

/** estimare initiala a lungimii unui traseu dintr-o incapere: semiperimetru + coborare */
export function estimateRouteLengthForRoom(p: Project, roomId: string): number | null {
  const r = p.rooms.find((x) => x.id === roomId);
  if (!r || r.lengthM.value === null || r.widthM.value === null) return null;
  const h = r.heightM.value ?? 2.7;
  const drop = Math.max(0, h - (r.mountingHeights.socketCm ?? 30) / 100);
  return Math.round(((r.lengthM.value + r.widthM.value) / 2 + drop) * 10) / 10;
}
