/**
 * Geometrie si lungimi. Functii pure, fara dependente de UI.
 * Fiecare rezultat spune si CAT de sigur este (masurat / estimat / incomplet).
 */
import type { Cable, Circuit, Conduit, Project, Room, Route, Tracked } from "../model/types";

export type Certainty = "masurat" | "partial" | "estimat" | "necunoscut";

export interface Qty {
  value: number | null;
  certainty: Certainty;
  /** cate valori lipsesc din calcul */
  missing: number;
}

const isMeasured = (t?: Tracked<number> | null) => !!t && t.value !== null && (t.provenance === "masurat" || t.status === "masurat" || t.status === "confirmat" || t.status === "validat");

export function combineCertainty(list: Certainty[]): Certainty {
  const known = list.filter((c) => c !== "necunoscut");
  if (known.length === 0) return "necunoscut";
  if (known.length === list.length && known.every((c) => c === "masurat")) return "masurat";
  if (known.some((c) => c === "masurat" || c === "partial")) return "partial";
  return "estimat";
}

/** suma: o lista goala inseamna 0, fara grad de certitudine (nu exista elemente) */
export function sumQty(items: Qty[]): Qty {
  if (items.length === 0) return { value: 0, certainty: "necunoscut", missing: 0 };
  let total = 0;
  let any = false;
  let missing = 0;
  for (const q of items) {
    if (q.value !== null) {
      total += q.value;
      any = true;
      missing += q.missing;
    } else missing += Math.max(1, q.missing);
  }
  return { value: any ? round(total, 2) : null, certainty: combineCertainty(items.map((q) => q.certainty)), missing };
}

export const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/* ----------------------------- incaperi ---------------------------- */

export function roomArea(r: Room): Qty {
  if (r.areaOverrideM2 !== null) return { value: r.areaOverrideM2, certainty: "masurat", missing: 0 };
  const l = r.lengthM.value;
  const w = r.widthM.value;
  if (l === null || w === null) return { value: null, certainty: "necunoscut", missing: 1 };
  return {
    value: round(l * w, 2),
    certainty: isMeasured(r.lengthM) && isMeasured(r.widthM) ? "masurat" : "estimat",
    missing: 0,
  };
}

export function roomPerimeter(r: Room): Qty {
  if (r.perimeterOverrideM !== null) return { value: r.perimeterOverrideM, certainty: "masurat", missing: 0 };
  const l = r.lengthM.value;
  const w = r.widthM.value;
  if (l === null || w === null) return { value: null, certainty: "necunoscut", missing: 1 };
  return {
    value: round(2 * (l + w), 2),
    certainty: isMeasured(r.lengthM) && isMeasured(r.widthM) ? "masurat" : "estimat",
    missing: 0,
  };
}

export function roomVolume(r: Room): number | null {
  const a = roomArea(r).value;
  const h = r.heightM.value;
  return a !== null && h !== null ? round(a * h, 2) : null;
}

/* ------------------------------ trasee ----------------------------- */

export function routeLength(route: Route): Qty {
  if (route.segments.length === 0) return { value: null, certainty: "necunoscut", missing: 1 };
  return sumQty(
    route.segments.map((s) => ({
      value: s.lengthM.value,
      certainty: s.lengthM.value === null ? "necunoscut" : isMeasured(s.lengthM) ? "masurat" : "estimat",
      missing: 0,
    })),
  );
}

export function conduitLength(route: Route, c: Conduit): Qty {
  if (c.lengthOverrideM && c.lengthOverrideM.value !== null) {
    return { value: c.lengthOverrideM.value, certainty: isMeasured(c.lengthOverrideM) ? "masurat" : "estimat", missing: 0 };
  }
  return routeLength(route);
}

export function cableLength(p: Project, cable: Cable): Qty {
  if (cable.lengthOverrideM && cable.lengthOverrideM.value !== null) {
    return { value: cable.lengthOverrideM.value, certainty: isMeasured(cable.lengthOverrideM) ? "masurat" : "estimat", missing: 0 };
  }
  const routes = cable.routeIds.map((id) => p.routes.find((r) => r.id === id)).filter(Boolean) as Route[];
  if (routes.length === 0) return { value: null, certainty: "necunoscut", missing: 1 };
  const q = sumQty(routes.map(routeLength));
  return { ...q, value: q.value === null ? null : round(q.value + cable.reserveM, 2) };
}

/**
 * Lungimea de cablu a unui circuit: suma cablurilor modelate; daca circuitul
 * nu are cabluri modelate, se foloseste lungimea estimata a circuitului.
 */
export function circuitCableLength(p: Project, circuit: Circuit): Qty {
  const cables = p.cables.filter((c) => c.circuitId === circuit.id);
  if (cables.length > 0) return sumQty(cables.map((c) => cableLength(p, c)));
  const e = circuit.estimatedLengthM;
  if (e.value === null) return { value: null, certainty: "necunoscut", missing: 1 };
  return { value: e.value, certainty: isMeasured(e) ? "masurat" : "estimat", missing: 0 };
}

/** metri de sant: fiecare traseu care necesita sant se numara O SINGURA DATA */
export function chaseLength(p: Project): Qty {
  return sumQty(p.routes.filter((r) => r.requiresChase).map(routeLength));
}

export function totalRouteLength(p: Project): Qty {
  return sumQty(p.routes.map(routeLength));
}

export function totalConduitLength(p: Project): Qty {
  return sumQty(p.routes.flatMap((r) => r.conduits.map((c) => conduitLength(r, c))));
}

export function totalCableLength(p: Project): Qty {
  return sumQty(p.circuits.map((c) => circuitCableLength(p, c)));
}

export function feederLength(p: Project): Qty {
  return sumQty(
    p.panels
      .filter((t) => t.parentPanelId)
      .map((t) => ({
        value: t.feeder.lengthM.value,
        certainty: t.feeder.lengthM.value === null ? "necunoscut" : isMeasured(t.feeder.lengthM) ? "masurat" : "estimat",
        missing: 0,
      })),
  );
}
