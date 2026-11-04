import { deviceRatingText, feederDevice, panelMainDevice, type Circuit } from "./circuits";
import { cascadeDepth, orderPanels } from "./panel";
import type { Panel, PanelDevice, Project } from "./types";

/** Un aparat din schema monofilara, cu circuitul sau tabloul alimentat. */
export type SlNode = {
  device: PanelDevice;
  rating: string;
  circuit?: Circuit;
  feeds?: Panel;
  /** Aparatele montate sub un diferential. */
  children: SlNode[];
};

export type SlPanel = {
  panel: Panel;
  depth: number;
  /** De unde vine alimentarea: retea (siguranta generala) sau aparatul din tabloul parinte. */
  source: { from: string; rating: string };
  main?: SlNode;
  spd: SlNode[];
  nodes: SlNode[];
  /** Numarul de coloane (circuite finale) — pentru latimea desenului. */
  leaves: number;
};

/** Modelul schemei monofilare, pe tablouri (principal, apoi secundarele in cascada). */
export function buildSingleLine(project: Project, circuits: Circuit[]): SlPanel[] {
  const byCircuit = new Map(circuits.map((c) => [c.id, c]));
  const byPanel = new Map(project.panels.map((p) => [p.id, p]));
  // circuitele comasate: aparatul legat de sursa arata circuitul tinta
  for (const c of circuits) for (const m of c.merged) byCircuit.set(m, c);

  const node = (d: PanelDevice): SlNode => ({
    device: d,
    rating: deviceRatingText(d),
    circuit: d.circuitId ? byCircuit.get(d.circuitId) : undefined,
    feeds: d.feedsPanelId ? byPanel.get(d.feedsPanelId) : undefined,
    children: [],
  });

  return orderPanels(project.panels).map((panel) => {
    const mainDev = panelMainDevice(panel);
    const rcdIds = new Set(panel.devices.filter((d) => d.kind === "RCD").map((d) => d.id));
    const spd = panel.devices.filter((d) => d.kind === "SPD").map(node);
    const nodes: SlNode[] = [];
    const rcdNodes = new Map<string, SlNode>();

    for (const d of panel.devices) {
      if (d === mainDev || d.kind === "SPD") continue;
      if (d.kind === "RCD") {
        const n = node(d);
        rcdNodes.set(d.id, n);
        nodes.push(n);
      }
    }
    for (const d of panel.devices) {
      if (d === mainDev || d.kind === "SPD" || d.kind === "RCD") continue;
      const n = node(d);
      const parent = d.upstreamRcdId && rcdIds.has(d.upstreamRcdId) ? rcdNodes.get(d.upstreamRcdId) : undefined;
      if (parent) parent.children.push(n);
      else nodes.push(n);
    }
    // pastreaza ordinea din tablou pentru nodurile de pe bara principala
    const idx = new Map(panel.devices.map((d, i) => [d.id, i]));
    nodes.sort((a, b) => (idx.get(a.device.id) ?? 0) - (idx.get(b.device.id) ?? 0));

    const feeder = feederDevice(panel, project.panels);
    const parent = panel.parentPanelId ? byPanel.get(panel.parentPanelId) : undefined;
    const source = parent
      ? { from: parent.name, rating: feeder ? deviceRatingText(feeder) : "?" }
      : { from: "Retea", rating: project.mainBreakerA ? `${project.mainBreakerA}A` : "?" };

    return {
      panel,
      depth: Math.max(0, cascadeDepth(panel, project.panels)),
      source,
      main: mainDev ? node(mainDev) : undefined,
      spd,
      nodes,
      leaves: nodes.reduce((s, n) => s + Math.max(1, n.children.length), 0),
    };
  });
}
