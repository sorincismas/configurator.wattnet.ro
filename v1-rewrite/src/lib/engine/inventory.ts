import {
  DEFAULT_BOX_SIZE,
  POINT_KINDS,
  type BoxSize,
  type MeasuredValue,
  type WallType,
  type PointCounts,
  type Project,
  type Room,
} from "./types";

export function emptyPoints(): PointCounts {
  return { priza: 0, intrerupator: 0, iluminat: 0, jonctiune: 0, termostat: 0, alteSurse: 0 };
}

export function sumPoints(list: PointCounts[]): PointCounts {
  const total = emptyPoints();
  for (const p of list) {
    for (const k of POINT_KINDS) total[k] += safe(p[k]);
  }
  return total;
}

export function pointsTotal(p: PointCounts): number {
  return POINT_KINDS.reduce((s, k) => s + safe(p[k]), 0);
}

/** Cantitate cu evidenta partii estimate. */
export type QuantityWithSource = {
  total: number;
  measured: number;
  estimated: number;
};

export function roomRoute(room: Room, defaultMPerPoint: number): QuantityWithSource {
  if (room.routeM && room.routeM.value > 0) {
    const v = safe(room.routeM.value);
    return room.routeM.source === "masurat"
      ? { total: v, measured: v, estimated: 0 }
      : { total: v, measured: 0, estimated: v };
  }
  const est = pointsTotal(room.points) * safe(defaultMPerPoint);
  return { total: est, measured: 0, estimated: est };
}

export function addQ(a: QuantityWithSource, b: QuantityWithSource): QuantityWithSource {
  return {
    total: a.total + b.total,
    measured: a.measured + b.measured,
    estimated: a.estimated + b.estimated,
  };
}

export const ZERO_Q: QuantityWithSource = { total: 0, measured: 0, estimated: 0 };

export function fromMeasured(v?: MeasuredValue): QuantityWithSource {
  if (!v || !(v.value > 0)) return ZERO_Q;
  const x = safe(v.value);
  return v.source === "masurat"
    ? { total: x, measured: x, estimated: 0 }
    : { total: x, measured: 0, estimated: x };
}

export type LevelInventory = {
  levelId: string;
  name: string;
  points: PointCounts;
  pointsTotal: number;
  routeM: QuantityWithSource;
  ledStripM: number;
  rooms: number;
};

export type Inventory = {
  levels: LevelInventory[];
  points: PointCounts;
  pointsTotal: number;
  routeM: QuantityWithSource;
  ledStripM: number;
  panels: number;
  secondaryPanels: number;
  feederM: QuantityWithSource;
  devices: number;
  deviceModules: number;
  /** Tablouri secundare fara lungime de alimentare introdusa. */
  feedersMissing: number;
  /** Doze pe perete si marime, cheie `${perete}|${marime}`. */
  boxes: Record<string, number>;
  /** Circuite dedicate (cabluri separate) din incaperi. */
  dedicatedCircuits: number;
};

export const boxKey = (wall: WallType, size: BoxSize) => `${wall}|${size}`;

/** Dozele unei incaperi pe perete si marime. */
export function roomBoxes(room: Room): Record<string, number> {
  const out: Record<string, number> = {};
  const wall = room.wall ?? "zidarie";
  for (const k of POINT_KINDS) {
    const n = safe(room.points[k]);
    if (!n) continue;
    const key = boxKey(wall, room.boxSizes?.[k] ?? DEFAULT_BOX_SIZE[k]);
    out[key] = (out[key] ?? 0) + n;
  }
  return out;
}

export function computeInventory(project: Project, defaultMPerPoint: number): Inventory {
  const levels: LevelInventory[] = project.levels.map((lvl) => {
    const points = sumPoints(lvl.rooms.map((r) => r.points));
    const routeM = lvl.rooms.reduce(
      (acc, r) => addQ(acc, roomRoute(r, defaultMPerPoint)),
      ZERO_Q,
    );
    return {
      levelId: lvl.id,
      name: lvl.name,
      points,
      pointsTotal: pointsTotal(points),
      routeM,
      ledStripM: lvl.rooms.reduce((s, r) => s + safe(r.ledStripM), 0),
      rooms: lvl.rooms.length,
    };
  });

  const secondary = project.panels.filter((p) => p.parentPanelId);
  const boxes: Record<string, number> = {};
  let dedicatedCircuits = 0;
  for (const lvl of project.levels)
    for (const r of lvl.rooms) {
      for (const [k, n] of Object.entries(roomBoxes(r))) boxes[k] = (boxes[k] ?? 0) + n;
      dedicatedCircuits += r.dedicated?.length ?? 0;
    }
  const points = sumPoints(levels.map((l) => l.points));

  return {
    levels,
    points,
    pointsTotal: pointsTotal(points),
    routeM: levels.reduce((acc, l) => addQ(acc, l.routeM), ZERO_Q),
    ledStripM: levels.reduce((s, l) => s + l.ledStripM, 0),
    panels: project.panels.length,
    secondaryPanels: secondary.length,
    feederM: secondary.reduce((acc, p) => addQ(acc, fromMeasured(p.feederM)), ZERO_Q),
    feedersMissing: secondary.filter((p) => !(p.feederM && p.feederM.value > 0)).length,
    devices: project.panels.reduce((s, p) => s + p.devices.length, 0),
    boxes,
    dedicatedCircuits,
    deviceModules: project.panels.reduce(
      (s, p) => s + p.devices.reduce((m, d) => m + safe(d.modules), 0),
      0,
    ),
  };
}

/** Numerele invalide (NaN, negative, infinit) devin 0. */
export function safe(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
}
