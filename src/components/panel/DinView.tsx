"use client";
import { forwardRef } from "react";
import { deviceOf, layoutPanel, type PlacedItem } from "@/lib/engine/panels";
import type { Panel, Project } from "@/lib/model/types";

const MOD = 36; // px pe modul DIN (18 mm)
const ROW_H = 150;
const PAD = 28;

const FILL: Record<string, string> = {
  general: "#e3ebf7",
  rcd: "#e2f2e6",
  circuit: "#ffffff",
  feeder: "#fff1cc",
  spd: "#efe5fb",
  rezerva: "#f4f3ef",
  altul: "#ffffff",
};

function shortDevice(p: Project, pi: PlacedItem): string {
  const d = deviceOf(p, pi.item);
  if (!d) return "?";
  if (d.kind === "MCB" || d.kind === "RCBO") return `${d.curve ?? ""}${d.ratingA ?? ""}`;
  if (d.kind === "RCD") return `${d.ratingA}A ${d.sensitivityMA}mA`;
  if (d.kind === "separator") return `${d.ratingA}A`;
  return d.kind;
}

/** vederea fizica a tabloului: aparatele pe sina DIN, cu etichete */
export const DinView = forwardRef<SVGSVGElement, { p: Project; panel: Panel; selectedId?: string | null; onSelect?: (id: string) => void }>(function DinView({ p, panel, selectedId, onSelect }, ref) {
  const lay = layoutPanel(p, panel);
  const per = lay.modulesPerRow;
  const W = per * MOD + PAD * 2;
  const overflowRows = lay.overflow.length ? 1 : 0;
  const H = (lay.rows + overflowRows) * ROW_H + PAD * 2 + 30;
  const enc = p.library.enclosureTypes.find((e) => e.id === panel.enclosureTypeId);
  const circuit = (id?: string) => p.circuits.find((c) => c.id === id);

  const drawItem = (pi: PlacedItem, y: number, overflow = false) => {
    const x = PAD + pi.start * MOD;
    const w = pi.modules * MOD;
    const it = pi.item;
    const c = circuit(it.circuitIds[0]);
    const role = it.isSpare ? "rezerva" : (it.role ?? "altul");
    const sel = selectedId === it.id;
    const top = shortDevice(p, pi);
    const mid = c?.code ?? (role === "general" ? "Q general" : role === "feeder" ? p.panels.find((t) => t.id === it.feedsPanelId)?.code ?? "TA" : role === "rcd" ? it.label.replace("Diferential", "DIF") : role === "spd" ? "SPD" : it.code);
    const name = c?.name ?? (role === "feeder" ? "alimentare" : role === "rezerva" ? "rezerva" : "");
    return (
      <g key={it.id} onClick={() => onSelect?.(it.id)} style={{ cursor: onSelect ? "pointer" : "default" }}>
        <rect x={x + 1} y={y + 16} width={w - 2} height={ROW_H - 42} rx={3} fill={overflow ? "#fde8e8" : FILL[role]} stroke={sel ? "#f2c200" : overflow ? "#b91c1c" : "#14181f"} strokeWidth={sel ? 3 : 1} />
        {/* maneta */}
        <rect x={x + w / 2 - 7} y={y + 50} width={14} height={26} rx={2} fill={role === "rezerva" ? "#d8d6cf" : "#2d333d"} />
        <text x={x + w / 2} y={y + 32} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily="Arial">{top}</text>
        <text x={x + w / 2} y={y + 94} textAnchor="middle" fontSize={10} fontWeight={700} fontFamily="monospace">{mid}</text>
        <text x={x + w / 2} y={y + 108} textAnchor="middle" fontSize={8.5} fontFamily="Arial" fill="#4a5260">
          {name.length > pi.modules * 6 ? name.slice(0, pi.modules * 6 - 1) + "…" : name}
        </text>
        <text x={x + w / 2} y={y + 120} textAnchor="middle" fontSize={8} fontFamily="Arial" fill="#8a919c">{c?.phase && p.supply.system === "tri" ? c.phase : it.code}</text>
      </g>
    );
  };

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.4 }} xmlns="http://www.w3.org/2000/svg" fontFamily="Arial">
      <rect x={4} y={4} width={W - 8} height={H - 8} rx={10} fill="#f6f5f1" stroke="#8a919c" strokeWidth={2} />
      <text x={PAD} y={22} fontSize={12} fontWeight={700}>
        {panel.code} {panel.name}
      </text>
      <text x={W - PAD} y={22} fontSize={10} textAnchor="end" fill="#4a5260">
        {enc ? `${enc.name} · ${lay.usedModules}/${lay.capacity} module · rezerva ${lay.reserveModules}` : "cutie nealeasa"}
      </text>
      {Array.from({ length: lay.rows }).map((_, r) => {
        const y = PAD + r * ROW_H;
        return (
          <g key={r}>
            {/* sina DIN */}
            <rect x={PAD - 8} y={y + 58} width={per * MOD + 16} height={12} fill="#c9ccd2" />
            {Array.from({ length: per }).map((__, m) => (
              <rect key={m} x={PAD + m * MOD + 1} y={y + 16} width={MOD - 2} height={ROW_H - 42} fill="none" stroke="#dcd9d1" strokeDasharray="3 3" />
            ))}
            {lay.placed.filter((pi) => pi.row === r).map((pi) => drawItem(pi, y))}
          </g>
        );
      })}
      {lay.overflow.length > 0 && (
        <g>
          <text x={PAD} y={PAD + lay.rows * ROW_H + 12} fontSize={11} fill="#b91c1c" fontWeight={700}>
            Nu incap in tablou ({lay.overflow.reduce((s, x) => s + x.modules, 0)} module):
          </text>
          {(() => {
            let cur = 0;
            return lay.overflow.map((pi) => {
              const placed = { ...pi, start: cur };
              cur += pi.modules;
              return drawItem(placed, PAD + lay.rows * ROW_H + 8, true);
            });
          })()}
        </g>
      )}
    </svg>
  );
});
