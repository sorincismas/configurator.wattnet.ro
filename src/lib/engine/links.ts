/**
 * Legaturi doza <-> traseu.
 *
 * Sursa de adevar este segmentul de traseu: o doza este "pe traseul TRxxx"
 * daca apare ca capat (de la / pana la) intr-un segment al acelui traseu.
 * Legarea din pagina Doze si aparate adauga un segment; legarea din pagina
 * Trasee se vede automat la doza. Nu exista o a doua lista de sincronizat.
 */
import { newConduit, newSegment } from "../model/factory";
import type { Box, NodeRef, Project, Route } from "../model/types";

/** aparatele din doza, ca text scurt */
export function boxContents(p: Project, boxId: string): string {
  const devs = p.devices.filter((d) => d.boxId === boxId);
  if (devs.length === 0) return "";
  const counts = new Map<string, number>();
  for (const d of devs) {
    const name = d.label || p.library.deviceTypes.find((t) => t.id === d.deviceTypeId)?.name || d.code;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([n, c]) => (c > 1 ? `${c}x ${n}` : n)).join(" + ");
}

/** eticheta completa a unei doze: cod · incapere · continut / pozitie */
export function boxLabel(p: Project, b: Box): string {
  const room = p.rooms.find((r) => r.id === b.roomId)?.name ?? "";
  const what = b.kind === "DD" ? "derivatie" : boxContents(p, b.id) || "goala";
  return [b.code, room, what, b.position].filter(Boolean).join(" · ");
}

export function nodeLabel(p: Project, n: NodeRef): string {
  if (n.kind === "box") {
    const b = p.boxes.find((x) => x.id === n.refId);
    return b ? boxLabel(p, b) : n.label;
  }
  if (n.kind === "panel") {
    const t = p.panels.find((x) => x.id === n.refId);
    return t ? `${t.code} ${t.name}` : n.label;
  }
  return n.label;
}

const isBoxNode = (n: NodeRef, boxId: string) => n.kind === "box" && n.refId === boxId;

/** traseele pe care se afla doza (derivat din segmente) */
export function routesForBox(p: Project, boxId: string): Route[] {
  return p.routes.filter((r) => r.segments.some((s) => isBoxNode(s.from, boxId) || isBoxNode(s.to, boxId)));
}

/** circuitele aparatelor din doza care NU trec prin tuburile traseului */
export function missingCircuitsOnRoute(p: Project, boxId: string, route: Route): string[] {
  const inRoute = new Set(route.conduits.flatMap((c) => c.circuitIds));
  const ids = new Set(p.devices.filter((d) => d.boxId === boxId && d.circuitId).map((d) => d.circuitId!));
  return [...ids].filter((id) => !inRoute.has(id));
}

/** ultimul capat al traseului, de unde continua un segment nou */
function lastNode(route: Route, p: Project): NodeRef {
  const last = route.segments.at(-1);
  if (last) return structuredClone(last.to);
  const panel = p.panels[0];
  return panel ? { kind: "panel", refId: panel.id, label: panel.code } : { kind: "free", refId: null, label: "TA" };
}

/** pune circuitele dozei in primul tub al traseului (creeaza tub daca lipseste) */
export function addBoxCircuitsToRoute(p: Project, boxId: string, route: Route) {
  const missing = missingCircuitsOnRoute(p, boxId, route);
  if (missing.length === 0) return;
  if (route.conduits.length === 0) route.conduits.push(newConduit(p, "cd-20"));
  const cd = route.conduits[0];
  cd.circuitIds = [...new Set([...cd.circuitIds, ...missing])];
}

/**
 * Leaga doza de un traseu: segment nou de la ultimul capat pana la doza,
 * incaperea dozei se adauga traseului, iar circuitele aparatelor din doza
 * intra in tubul traseului.
 */
export function linkBoxToRoute(p: Project, boxId: string, routeId: string, lengthM: number | null = null) {
  const route = p.routes.find((r) => r.id === routeId);
  const box = p.boxes.find((b) => b.id === boxId);
  if (!route || !box) return;
  if (!routesForBox(p, boxId).some((r) => r.id === routeId)) {
    const seg = newSegment("", "", lengthM);
    seg.from = lastNode(route, p);
    seg.to = { kind: "box", refId: box.id, label: box.code };
    route.segments.push(seg);
  }
  if (!route.roomIds.includes(box.roomId)) route.roomIds.push(box.roomId);
  addBoxCircuitsToRoute(p, boxId, route);
}

/**
 * Dezleaga doza de traseu: segmentele care se termina in doza se sterg;
 * cele care pornesc din doza raman, cu capat liber (pentru a nu pierde lungimi).
 */
export function unlinkBoxFromRoute(p: Project, boxId: string, routeId: string) {
  const route = p.routes.find((r) => r.id === routeId);
  const box = p.boxes.find((b) => b.id === boxId);
  if (!route) return;
  route.segments = route.segments.filter((s) => !isBoxNode(s.to, boxId));
  for (const s of route.segments) if (isBoxNode(s.from, boxId)) s.from = { kind: "free", refId: null, label: box?.code ?? s.from.label };
}

/** la alegerea unei doze ca capat de segment, incaperea ei intra in traseu */
export function ensureRouteRoomForNode(p: Project, route: Route, n: NodeRef) {
  if (n.kind !== "box") return;
  const b = p.boxes.find((x) => x.id === n.refId);
  if (b && !route.roomIds.includes(b.roomId)) route.roomIds.push(b.roomId);
}
