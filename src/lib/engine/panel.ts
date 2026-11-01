import { safe } from "./inventory";
import type { Panel, PanelDevice } from "./types";

export type RowLayout = {
  row: number;
  capacity: number;
  used: number;
  free: number;
  overflow: boolean;
  /** Aparatele în ordinea de pe șină, cu poziția de start în module. */
  placed: { device: PanelDevice; start: number }[];
};

export type PanelLayout = {
  panelId: string;
  rows: RowLayout[];
  capacity: number;
  used: number;
  free: number;
  overflow: boolean;
  /** Aparate cu rând inexistent (ex. după micșorarea tabloului). */
  orphanDevices: PanelDevice[];
};

/**
 * Așază aparatele pe șine în ordinea din listă. Nu mută automat aparatele
 * între rânduri: depășirea unui rând este raportată, nu ascunsă.
 */
export function layoutPanel(panel: Panel): PanelLayout {
  const rowsCount = Math.max(0, Math.floor(safe(panel.rows)));
  const perRow = Math.max(0, Math.floor(safe(panel.modulesPerRow)));
  const rows: RowLayout[] = Array.from({ length: rowsCount }, (_, i) => ({
    row: i,
    capacity: perRow,
    used: 0,
    free: perRow,
    overflow: false,
    placed: [],
  }));
  const orphanDevices: PanelDevice[] = [];

  for (const d of panel.devices) {
    const r = rows[d.row];
    if (!r) {
      orphanDevices.push(d);
      continue;
    }
    r.placed.push({ device: d, start: r.used });
    r.used += safe(d.modules);
  }
  for (const r of rows) {
    r.free = r.capacity - r.used;
    r.overflow = r.used > r.capacity;
  }
  const capacity = rowsCount * perRow;
  const used = rows.reduce((s, r) => s + r.used, 0);
  return {
    panelId: panel.id,
    rows,
    capacity,
    used,
    free: capacity - used,
    overflow: rows.some((r) => r.overflow) || orphanDevices.length > 0,
    orphanDevices,
  };
}

/** Returnează lanțul de tablouri implicate într-o buclă de alimentare, dacă există. */
export function findCascadeCycle(panels: Panel[]): string[] | null {
  const byId = new Map(panels.map((p) => [p.id, p]));
  for (const start of panels) {
    const seen: string[] = [];
    let cur: Panel | undefined = start;
    while (cur?.parentPanelId) {
      if (seen.includes(cur.id)) return seen.slice(seen.indexOf(cur.id));
      seen.push(cur.id);
      cur = byId.get(cur.parentPanelId);
    }
  }
  return null;
}

/** Adâncimea în cascadă (0 = principal). Returnează -1 dacă există buclă. */
export function cascadeDepth(panel: Panel, panels: Panel[]): number {
  const byId = new Map(panels.map((p) => [p.id, p]));
  let depth = 0;
  let cur: Panel | undefined = panel;
  const seen = new Set<string>();
  while (cur?.parentPanelId) {
    if (seen.has(cur.id)) return -1;
    seen.add(cur.id);
    cur = byId.get(cur.parentPanelId);
    depth++;
  }
  return depth;
}

/** Ordonează tablourile: principal, apoi copiii lui (parcurgere în adâncime). */
export function orderPanels(panels: Panel[]): Panel[] {
  const ids = new Set(panels.map((p) => p.id));
  const roots = panels.filter((p) => !p.parentPanelId || !ids.has(p.parentPanelId));
  const out: Panel[] = [];
  const visit = (p: Panel) => {
    if (out.includes(p)) return;
    out.push(p);
    panels.filter((c) => c.parentPanelId === p.id).forEach(visit);
  };
  roots.forEach(visit);
  // tablourile rămase sunt într-o buclă; le adăugăm ca să nu dispară din interfață
  panels.forEach((p) => {
    if (!out.includes(p)) out.push(p);
  });
  return out;
}
