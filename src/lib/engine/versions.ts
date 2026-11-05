/**
 * Versionare si trasabilitate (cap. 15).
 *  - emiterea unei versiuni salveaza un instantaneu complet al proiectului
 *    (inclusiv biblioteca: tarife, materiale, reguli) ca text JSON inghetat;
 *  - versiunile emise nu se modifica retroactiv;
 *  - modificarile ulterioare se compara cu ultima versiune emisa.
 */
import { uid } from "../model/ids";
import { nowISO } from "../model/factory";
import type { IssuedDocKind, IssuedVersion, Project } from "../model/types";
import { round } from "./measure";
import { computeLabor, computeMaterials, computeTotals } from "./pricing";

export const DOC_KIND_LABEL: Record<IssuedDocKind, string> = {
  oferta_manopera: "Oferta manopera",
  oferta_completa: "Oferta manopera + materiale",
  dosar_tehnic: "Dosar tehnic",
  plan_executie: "Plan de executie",
};

export const revLabel = (n: number) => `Rev.${String(n).padStart(2, "0")}`;

/** instantaneul: proiectul fara istoricul versiunilor (evita imbricarea) */
export function snapshotOf(p: Project): string {
  const { issued: _issued, ...rest } = p;
  void _issued;
  return JSON.stringify({ ...rest, issued: [] });
}

export function parseSnapshot(v: IssuedVersion): Project {
  return JSON.parse(v.snapshot) as Project;
}

/** emite o versiune noua (modifica proiectul primit) */
export function issueVersion(p: Project, docKind: IssuedDocKind, reason: string): IssuedVersion {
  const number = (p.issued.at(-1)?.number ?? 0) + 1;
  const copy = structuredClone(p);
  copy.quote.includeMaterials = docKind === "oferta_completa" ? true : docKind === "oferta_manopera" ? false : copy.quote.includeMaterials;
  const labor = computeLabor(copy);
  const mat = computeMaterials(copy);
  const totals = computeTotals(copy, labor, mat);
  const v: IssuedVersion = {
    id: uid(),
    number,
    docKind,
    issuedAt: nowISO(),
    reason,
    snapshot: snapshotOf(copy),
    totals: { laborValue: totals.labor, materialsValue: totals.materials, laborHours: labor.hours },
  };
  p.issued.push(v);
  if (p.info.status === "ciorna" && docKind !== "plan_executie") p.info.status = "ofertat";
  p.history.push({ at: v.issuedAt, action: "emitere", detail: `${revLabel(number)} ${DOC_KIND_LABEL[docKind]}${reason ? " - " + reason : ""}` });
  return v;
}

/* ---------------------------- comparatie --------------------------- */

export interface DiffRow {
  label: string;
  before: number | null;
  after: number | null;
  delta: number | null;
  money?: boolean;
}

function counts(p: Project) {
  const lab = computeLabor(p);
  const mat = computeMaterials(p);
  return {
    rooms: p.rooms.length,
    boxes: p.boxes.length,
    devices: p.devices.length,
    circuits: p.circuits.length,
    panels: p.panels.length,
    routes: p.routes.length,
    labor: lab.total,
    hours: lab.hours,
    materials: mat.total,
  };
}

/** diferentele principale intre o versiune emisa si starea curenta (cap. 9 din analiza: versionarea proiectelor) */
export function diffWithCurrent(v: IssuedVersion, current: Project): { rows: DiffRow[]; changedCircuits: string[]; addedCircuits: string[]; removedCircuits: string[] } {
  const before = parseSnapshot(v);
  const a = counts(before);
  const b = counts(current);
  const row = (label: string, x: number, y: number, money = false): DiffRow => ({ label, before: x, after: y, delta: round(y - x, 2), money });
  const bc = new Map(before.circuits.map((c) => [c.id, c] as const));
  const cc = new Map(current.circuits.map((c) => [c.id, c] as const));
  const added = current.circuits.filter((c) => !bc.has(c.id)).map((c) => `${c.code} ${c.name}`);
  const removed = before.circuits.filter((c) => !cc.has(c.id)).map((c) => `${c.code} ${c.name}`);
  const changed = current.circuits
    .filter((c) => bc.has(c.id))
    .filter((c) => {
      const o = bc.get(c.id)!;
      const devO = before.devices.filter((d) => d.circuitId === c.id).map((d) => d.id + (d.powerW.value ?? "")).sort().join();
      const devN = current.devices.filter((d) => d.circuitId === c.id).map((d) => d.id + (d.powerW.value ?? "")).sort().join();
      return devO !== devN || o.cableTypeId !== c.cableTypeId || o.protection.protectionDeviceId !== c.protection.protectionDeviceId || o.panelId !== c.panelId;
    })
    .map((c) => `${c.code} ${c.name}`);
  return {
    rows: [
      row("Manopera", a.labor, b.labor, true),
      row("Materiale", a.materials, b.materials, true),
      row("Timp manopera (ore)", a.hours, b.hours),
      row("Incaperi", a.rooms, b.rooms),
      row("Doze", a.boxes, b.boxes),
      row("Aparate / puncte", a.devices, b.devices),
      row("Circuite", a.circuits, b.circuits),
      row("Tablouri", a.panels, b.panels),
      row("Trasee", a.routes, b.routes),
    ],
    changedCircuits: changed,
    addedCircuits: added,
    removedCircuits: removed,
  };
}

/** continutul relevant al proiectului, fara campurile care se schimba la emitere/export */
function fingerprint(p: Project): string {
  const c = structuredClone(p) as Partial<Project> & Project;
  delete (c as Partial<Project>).updatedAt;
  delete (c as Partial<Project>).lastExportedAt;
  delete (c as Partial<Project>).history;
  delete (c as Partial<Project>).issued;
  c.info = { ...c.info, status: "ciorna" };
  c.quote = { ...c.quote, includeMaterials: false, proforma: undefined };
  c.library = { ...c.library, firm: undefined as never };
  return JSON.stringify(c);
}

/** proiectul a fost modificat dupa ultima emitere? (comparatie de continut, nu de data) */
export function modifiedSinceIssue(p: Project): boolean {
  const last = p.issued.at(-1);
  if (!last) return false;
  return fingerprint(parseSnapshot(last)) !== fingerprint(p);
}
