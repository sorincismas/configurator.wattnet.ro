/**
 * Indicatorii barei permanente de sumar (cap. 13).
 * Toate valorile se calculeaza din model; nimic nu se introduce separat.
 */
import type { Project } from "../model/types";
import { chaseLength, sumQty, roomArea, totalCableLength, totalConduitLength, totalRouteLength, type Qty } from "./measure";
import { appliedPower, availablePower, installedPower, type AppliedPower, type AvailablePower, type PowerSum } from "./power";
import { computeLabor, computeMaterials, computeTotals, type LaborResult, type MaterialsResult, type QuoteTotals } from "./pricing";
import { computeSchedule, type ScheduleResult } from "./schedule";

export interface ProjectSummary {
  counts: {
    buildings: number;
    levels: number;
    rooms: number;
    boxesDA: number;
    boxesDD: number;
    sockets: number;
    switches: number;
    lighting: number;
    otherDevices: number;
    lowVoltage: number;
    circuits: number;
    panels: number;
    routes: number;
  };
  area: Qty;
  lengths: { route: Qty; chase: Qty; conduit: Qty; cable: Qty };
  power: { available: AvailablePower; installed: PowerSum; applied: AppliedPower };
  labor: LaborResult;
  materials: MaterialsResult;
  totals: QuoteTotals;
  schedule: ScheduleResult;
}

export function computeSummary(p: Project): ProjectSummary {
  const dev = (c: string) => p.devices.filter((d) => d.category === c).length;
  const labor = computeLabor(p);
  const materials = computeMaterials(p);
  return {
    counts: {
      buildings: p.buildings.length,
      levels: p.levels.length,
      rooms: p.rooms.length,
      boxesDA: p.boxes.filter((b) => b.kind === "DA").length,
      boxesDD: p.boxes.filter((b) => b.kind === "DD").length,
      sockets: dev("priza"),
      switches: dev("intrerupator"),
      lighting: dev("iluminat"),
      otherDevices: dev("consumator_dedicat") + dev("comanda") + dev("altul"),
      lowVoltage: dev("curenti_slabi"),
      circuits: p.circuits.length,
      panels: p.panels.length,
      routes: p.routes.length,
    },
    area: sumQty(p.rooms.map(roomArea)),
    lengths: { route: totalRouteLength(p), chase: chaseLength(p), conduit: totalConduitLength(p), cable: totalCableLength(p) },
    power: { available: availablePower(p), installed: installedPower(p), applied: appliedPower(p) },
    labor,
    materials,
    totals: computeTotals(p, labor, materials),
    schedule: computeSchedule(p, labor),
  };
}
