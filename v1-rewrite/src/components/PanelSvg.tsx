import { deviceRatingText, layoutPanel, type DeviceKind, type Panel } from "@/lib/engine";

const COLORS: Record<DeviceKind, { fill: string; stroke: string }> = {
  MCB: { fill: "#f8fafc", stroke: "#334155" },
  RCD: { fill: "#e0f2fe", stroke: "#0369a1" },
  RCBO: { fill: "#ede9fe", stroke: "#6d28d9" },
  SPD: { fill: "#fef3c7", stroke: "#b45309" },
  separator: { fill: "#fee2e2", stroke: "#b91c1c" },
  releu: { fill: "#ecfccb", stroke: "#4d7c0f" },
  contactor: { fill: "#dcfce7", stroke: "#15803d" },
  "sonerie-sursa": { fill: "#f1f5f9", stroke: "#475569" },
  altul: { fill: "#f1f5f9", stroke: "#64748b" },
};

const KIND_SHORT: Record<DeviceKind, string> = {
  MCB: "MCB",
  RCD: "RCD",
  RCBO: "RCBO",
  SPD: "SPD",
  separator: "SEP",
  releu: "REL",
  contactor: "K",
  "sonerie-sursa": "SRS",
  altul: "—",
};

const MOD = 34; // px per modul DIN
const ROW_H = 150;
const PAD = 18;

/** Reprezentare vizuala orientativa a tabloului (nu e desen de executie). */
export function PanelSvg({ panel }: { panel: Panel }) {
  const lay = layoutPanel(panel);
  const maxUsed = Math.max(panel.modulesPerRow, ...lay.rows.map((r) => r.used));
  const width = PAD * 2 + maxUsed * MOD;
  const height = PAD * 2 + Math.max(1, lay.rows.length) * ROW_H;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      style={{ maxWidth: width }}
      role="img"
      aria-label={`Tablou ${panel.name}: ${lay.used} din ${lay.capacity} module ocupate`}
    >
      <rect x={1} y={1} width={width - 2} height={height - 2} rx={10} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={2} />
      {lay.rows.map((r, i) => {
        const y0 = PAD + i * ROW_H;
        const capW = r.capacity * MOD;
        return (
          <g key={r.row}>
            {/* zona utila a sinei */}
            <rect x={PAD} y={y0 + 6} width={capW} height={ROW_H - 12} fill="#ffffff" stroke="#cbd5e1" rx={4} />
            {/* sina DIN */}
            <rect x={PAD - 6} y={y0 + ROW_H / 2 - 8} width={Math.max(capW, r.used * MOD) + 12} height={16} fill="#94a3b8" />
            {/* grila module */}
            {Array.from({ length: r.capacity + 1 }, (_, m) => (
              <line key={m} x1={PAD + m * MOD} x2={PAD + m * MOD} y1={y0 + ROW_H - 10} y2={y0 + ROW_H - 4} stroke="#94a3b8" />
            ))}
            {r.overflow && (
              <rect
                x={PAD + capW}
                y={y0 + 6}
                width={(r.used - r.capacity) * MOD}
                height={ROW_H - 12}
                fill="#fee2e2"
                stroke="#dc2626"
                strokeDasharray="4 3"
              />
            )}
            {r.placed.map(({ device, start }) => {
              const c = COLORS[device.kind];
              const x = PAD + start * MOD + 2;
              const w = device.modules * MOD - 4;
              const yTop = y0 + 16;
              const h = ROW_H - 32;
              const rating = deviceRatingText(device);
              return (
                <g key={device.id}>
                  <title>{`${device.label || device.kind} · ${device.kind} ${device.poles}P · ${device.modules} mod.${rating ? " · " + rating : ""}`}</title>
                  <rect x={x} y={yTop} width={w} height={h} rx={3} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                  <rect x={x + w / 2 - 5} y={yTop + 12} width={10} height={18} rx={2} fill={c.stroke} />
                  <text x={x + w / 2} y={yTop + 46} textAnchor="middle" fontSize={10} fontWeight={700} fill={c.stroke}>
                    {KIND_SHORT[device.kind]}
                  </text>
                  {rating && (
                    <text x={x + w / 2} y={yTop + 59} textAnchor="middle" fontSize={9} fill="#0f172a">
                      {rating.slice(0, Math.max(4, device.modules * 5))}
                    </text>
                  )}
                  <text
                    x={x + w / 2}
                    y={yTop + h - 6}
                    textAnchor="start"
                    fontSize={9}
                    fill="#334155"
                    transform={`rotate(-90 ${x + w / 2 + 3} ${yTop + h - 6})`}
                  >
                    {(device.label || "").slice(0, 14)}
                  </text>
                </g>
              );
            })}
            <text x={PAD + 4} y={y0 + ROW_H - 1} fontSize={10} fill={r.overflow ? "#b91c1c" : "#475569"}>
              {`Sina ${r.row + 1}: ${r.used}/${r.capacity} mod.`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
