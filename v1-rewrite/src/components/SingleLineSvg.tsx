import { forwardRef, type ReactNode } from "react";
import type { SlNode, SlPanel } from "@/lib/engine";

/**
 * Schema monofilara a unui tablou, generata din aparatele tabloului.
 * Simboluri simplificate; desen orientativ, nu inlocuieste proiectul semnat.
 */
const COL = 66;
const X0 = 170;
const BUS = 120;
const SUB = 200;
const SYM = 222; // varful simbolului aparatului final
const LBL = 290;
const H = 520;
const STROKE = "#0f172a";

export const SingleLineSvg = forwardRef<SVGSVGElement, { sl: SlPanel }>(function SingleLineSvg({ sl }, ref) {
  const cols = Math.max(1, sl.leaves + sl.spd.length);
  const width = X0 + cols * COL + 20;
  let x = X0;

  const leaves: ReactNode[] = [];

  // SPD-uri: coloane la inceputul barei
  for (const n of sl.spd) {
    const cx = x + COL / 2;
    leaves.push(
      <g key={n.device.id}>
        <line x1={cx} y1={BUS} x2={cx} y2={SYM} stroke={STROKE} />
        <Spd cx={cx} y={SYM} />
        <text x={cx} y={LBL} textAnchor="middle" fontSize={10} fontWeight={700}>
          SPD
        </text>
        <text x={cx} y={LBL + 13} textAnchor="middle" fontSize={9}>
          {n.rating}
        </text>
      </g>,
    );
    x += COL;
  }

  for (const n of sl.nodes) {
    if (n.device.kind === "RCD" && n.children.length) {
      const span = n.children.length;
      const gx = x;
      const cx = gx + (span * COL) / 2;
      const first = gx + COL / 2;
      const last = gx + (span - 1) * COL + COL / 2;
      leaves.push(
        <g key={n.device.id}>
          <line x1={cx} y1={BUS} x2={cx} y2={136} stroke={STROKE} />
          <Rcd cx={cx} y={136} />
          <line x1={cx} y1={180} x2={cx} y2={SUB} stroke={STROKE} />
          <text x={cx + 20} y={152} fontSize={9} fontWeight={700}>
            {n.device.label || "RCD"}
          </text>
          <text x={cx + 20} y={164} fontSize={9}>
            {n.rating}
          </text>
          <line x1={first} y1={SUB} x2={last} y2={SUB} stroke={STROKE} strokeWidth={2} />
        </g>,
      );
      n.children.forEach((c, i) => {
        leaves.push(<Leaf key={c.device.id} n={c} cx={gx + i * COL + COL / 2} top={SUB} />);
      });
      x += span * COL;
    } else {
      leaves.push(<Leaf key={n.device.id} n={n} cx={x + COL / 2} top={BUS} />);
      x += COL;
    }
  }

  const busEnd = Math.max(X0 + 20, x - COL / 2);

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${H}`}
      className="h-auto w-full"
      style={{ maxWidth: width, fontFamily: "Arial, sans-serif" }}
      role="img"
      aria-label={`Schema monofilara ${sl.panel.name}`}
    >
      <rect x={0} y={0} width={width} height={H} fill="#fff" />
      {/* Alimentare */}
      <text x={16} y={22} fontSize={12} fontWeight={700}>
        {sl.panel.name}
      </text>
      <text x={16} y={38} fontSize={10} fill="#334155">
        {sl.source.from === "Retea" ? "Alimentare din retea" : `Alimentat din ${sl.source.from}`} · {sl.source.rating}
      </text>
      <line x1={80} y1={48} x2={80} y2={64} stroke={STROKE} />
      {sl.main ? (
        <>
          {sl.main.device.kind === "separator" ? (
            <Switch cx={80} y={64} />
          ) : sl.main.device.kind === "RCD" ? (
            <Rcd cx={80} y={64} />
          ) : (
            <Breaker cx={80} y={64} />
          )}
          <text x={98} y={84} fontSize={9} fontWeight={700}>
            {sl.main.device.label || "General"}
          </text>
          <text x={98} y={96} fontSize={9}>
            {sl.main.rating}
          </text>
          <line x1={80} y1={108} x2={80} y2={BUS} stroke={STROKE} />
        </>
      ) : (
        <line x1={80} y1={64} x2={80} y2={BUS} stroke={STROKE} />
      )}
      {/* Bara principala */}
      <line x1={80} y1={BUS} x2={busEnd} y2={BUS} stroke={STROKE} strokeWidth={3} />
      <text x={86} y={BUS - 6} fontSize={9} fill="#475569">
        L, N, PE
      </text>
      {leaves}
      {sl.nodes.length === 0 && sl.spd.length === 0 && (
        <text x={X0} y={BUS + 30} fontSize={11} fill="#64748b">
          Tabloul nu are aparate de plecare.
        </text>
      )}
    </svg>
  );
});

function Leaf({ n, cx, top }: { n: SlNode; cx: number; top: number }) {
  const c = n.circuit;
  const k = n.device.kind;
  const title = n.feeds ? `→ ${n.feeds.name}` : c ? c.name : n.device.label || k;
  return (
    <g>
      <line x1={cx} y1={top} x2={cx} y2={SYM} stroke={STROKE} />
      {k === "RCD" || k === "RCBO" ? <Rcd cx={cx} y={SYM} /> : k === "separator" ? <Switch cx={cx} y={SYM} /> : <Breaker cx={cx} y={SYM} />}
      <line x1={cx} y1={SYM + 44} x2={cx} y2={LBL - 14} stroke={STROKE} />
      <path d={`M ${cx - 4} ${LBL - 20} L ${cx} ${LBL - 12} L ${cx + 4} ${LBL - 20}`} fill="none" stroke={STROKE} />
      <text x={cx} y={LBL} textAnchor="middle" fontSize={9} fontWeight={700}>
        {c?.code ?? (n.feeds ? "PLECARE" : "")}
      </text>
      <text x={cx} y={LBL + 12} textAnchor="middle" fontSize={9}>
        {n.rating || "?"} {n.device.poles}P
      </text>
      {c && (
        <>
          <text x={cx} y={LBL + 24} textAnchor="middle" fontSize={9}>
            {c.cable}
          </text>
          <text x={cx} y={LBL + 36} textAnchor="middle" fontSize={9}>
            {fmt(c.powerKw)} kW
          </text>
        </>
      )}
      <text x={cx + 3} y={LBL + 48} fontSize={10} transform={`rotate(90 ${cx + 3} ${LBL + 48})`}>
        {title.slice(0, 26)}
      </text>
    </g>
  );
}

/** Disjunctor: contact cu cutit si „x" pe contactul fix. */
function Breaker({ cx, y }: { cx: number; y: number }) {
  return (
    <g stroke={STROKE} fill="none">
      <line x1={cx - 4} y1={y - 4} x2={cx + 4} y2={y + 4} />
      <line x1={cx - 4} y1={y + 4} x2={cx + 4} y2={y - 4} />
      <line x1={cx} y1={y + 44} x2={cx - 13} y2={y + 8} strokeWidth={1.6} />
    </g>
  );
}

/** Separator: contact cu cutit, fara declansator. */
function Switch({ cx, y }: { cx: number; y: number }) {
  return (
    <g stroke={STROKE} fill="none">
      <line x1={cx - 5} y1={y} x2={cx + 5} y2={y} />
      <line x1={cx} y1={y + 44} x2={cx - 13} y2={y + 6} strokeWidth={1.6} />
    </g>
  );
}

/** Diferential: disjunctor + toroid ΔI. */
function Rcd({ cx, y }: { cx: number; y: number }) {
  return (
    <g>
      <Breaker cx={cx} y={y} />
      <ellipse cx={cx} cy={y + 34} rx={9} ry={4} fill="none" stroke={STROKE} />
      <text x={cx + 11} y={y + 24} fontSize={8} fill={STROKE}>
        ΔI
      </text>
    </g>
  );
}

/** Descarcator: dreptunghi cu sageata, legat la PE. */
function Spd({ cx, y }: { cx: number; y: number }) {
  return (
    <g stroke={STROKE} fill="none">
      <rect x={cx - 7} y={y} width={14} height={26} />
      <path d={`M ${cx} ${y + 4} L ${cx} ${y + 20} M ${cx - 3} ${y + 16} L ${cx} ${y + 21} L ${cx + 3} ${y + 16}`} />
      <line x1={cx} y1={y + 26} x2={cx} y2={y + 40} />
      <line x1={cx - 9} y1={y + 40} x2={cx + 9} y2={y + 40} />
      <line x1={cx - 6} y1={y + 44} x2={cx + 6} y2={y + 44} />
      <line x1={cx - 3} y1={y + 48} x2={cx + 3} y2={y + 48} />
    </g>
  );
}

const fmt = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 2 });
