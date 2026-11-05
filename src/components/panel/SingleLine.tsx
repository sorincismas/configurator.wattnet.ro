"use client";
/**
 * Schema monofilara a unui tablou, generata din model.
 * Pornita de la modelul WATTNET „Schema_Monofilara_rev01” (A3, Visio) si
 * completata cu: putere aplicata, ks, curent de calcul, lungime, ΔU, faza,
 * diferentialul din amonte si cartusul cu datele firmei.
 */
import { forwardRef } from "react";
import { circuitLoad } from "@/lib/engine/circuits";
import { deviceOf } from "@/lib/engine/panels";
import { analyzeCircuit, panelLoad } from "@/lib/engine/sizing";
import { fmtNum } from "@/lib/format";
import type { Circuit, Panel, PanelItem, Project } from "@/lib/model/types";

const LEFT = 200;
const COL = 100;
const F = "Arial";

type Col = { kind: "circuit"; item: PanelItem; circuit: Circuit | undefined } | { kind: "feeder"; item: PanelItem; child: Panel | undefined } | { kind: "spare"; item: PanelItem };

function devText(p: Project, item: PanelItem | undefined) {
  const d = item ? deviceOf(p, item) : undefined;
  if (!d) return "de stabilit";
  if (d.kind === "RCD") return `${d.ratingA}A IΔ-${d.sensitivityMA}mA`;
  if (d.kind === "RCBO") return `${d.curve}${d.ratingA} ${d.poles} IΔ${d.sensitivityMA}mA`;
  if (d.kind === "MCB") return `${d.ratingA}A ${d.poles.replace("1P+N", "N+1").replace("3P+N", "3P+N")}`;
  return `${d.name}`;
}

/** simbol intrerupator automat (vertical), cu contact si declansator */
function Breaker({ x, y, h = 50, rcd = false }: { x: number; y: number; h?: number; rcd?: boolean }) {
  return (
    <g stroke="#14181f" strokeWidth={1.4} fill="none">
      <line x1={x} y1={y} x2={x} y2={y + h * 0.3} />
      <line x1={x} y1={y + h * 0.3} x2={x + 10} y2={y + h * 0.65} />
      <line x1={x - 4} y1={y + h * 0.26} x2={x + 4} y2={y + h * 0.34} />
      <line x1={x + 4} y1={y + h * 0.26} x2={x - 4} y2={y + h * 0.34} />
      <line x1={x} y1={y + h * 0.68} x2={x} y2={y + h} />
      {rcd && <ellipse cx={x} cy={y + h * 0.84} rx={11} ry={5} />}
      {rcd && <path d={`M ${x - 11} ${y + h * 0.84} h -10 v -${h * 0.5} h 10`} strokeDasharray="3 2" />}
    </g>
  );
}

export const SingleLine = forwardRef<SVGSVGElement, { p: Project; panel: Panel }>(function SingleLine({ p, panel }, ref) {
  const lib = p.library;
  const firm = lib.firm;
  const items = panel.items;
  const general = items.find((i) => i.role === "general");
  const spd = items.find((i) => i.role === "spd");
  const rcds = items.filter((i) => i.role === "rcd");
  const generalIsRcd = general && deviceOf(p, general)?.kind === "RCD";

  // coloanele: circuite, alimentari, rezerve, in ordinea din tablou
  const cols: Col[] = items
    .filter((i) => i.role === "circuit" || i.role === "feeder" || i.isSpare)
    .map((i) =>
      i.role === "feeder"
        ? { kind: "feeder" as const, item: i, child: p.panels.find((t) => t.id === i.feedsPanelId) }
        : i.isSpare
          ? { kind: "spare" as const, item: i }
          : { kind: "circuit" as const, item: i, circuit: p.circuits.find((c) => c.id === i.circuitIds[0]) },
    );
  // circuite din tablou fara aparat in echipare (inca negenerat) - afisate la final
  for (const c of p.circuits.filter((x) => x.panelId === panel.id && x.usage !== "curenti_slabi").sort((a, b) => a.order - b.order))
    if (!items.some((i) => i.circuitIds.includes(c.id))) cols.push({ kind: "circuit", item: { id: "v-" + c.id, code: "", protectionDeviceId: c.protection.protectionDeviceId, label: c.name, circuitIds: [c.id], downstreamItemIds: [], row: null, position: null, isSpare: false, role: "circuit" }, circuit: c });

  const n = Math.max(cols.length, 1);
  const W = LEFT + n * COL + COL + 20; // + coloana total
  const Y = { title: 34, feed: 70, gen: 150, bus: 250, rcd: 268, sub: 340, mcb: 356, cab: 420, arrow: 580, table: 600 };
  const ROWS = ["Nr.", "Putere instalata [W]", "ks / Putere aplicata [W]", "Curent de calcul Ic [A]", "Lungime [m]", "ΔU total [%]", "Faza", "Nr. prize / puncte", "Circuit", "Descriere"];
  const RH = 26;
  const descH = 54;
  const tableH = (ROWS.length - 1) * RH + descH;
  const cartH = 120;
  const H = Y.table + tableH + cartH + 30;
  const colX = (i: number) => LEFT + i * COL + COL / 2;

  const load = panelLoad(p, panel.id);
  const parent = p.panels.find((t) => t.id === panel.parentPanelId);
  const feederCable = lib.cableTypes.find((c) => c.id === panel.feeder.cableTypeId);
  const feedText = parent
    ? `${feederCable?.name ?? "cablu de stabilit"}${panel.feeder.lengthM.value !== null ? `, ${fmtNum(panel.feeder.lengthM.value, 1)} m` : ""} de la ${parent.code} ${parent.name}`
    : `Alimentare ${p.supply.system === "mono" ? "230 V" : "3x400/230 V"} de la BMPT${p.supply.mainBreakerA.value ? ` (${p.supply.mainBreakerA.value} A)` : ""}`;

  // pentru fiecare coloana: RCD-ul din amonte
  const rcdOf = (it: PanelItem) => rcds.find((r) => r.downstreamItemIds.includes(it.id));
  const groups: { rcd: PanelItem | null; from: number; to: number }[] = [];
  cols.forEach((c, i) => {
    const r = rcdOf(c.item) ?? null;
    const last = groups.at(-1);
    if (last && last.rcd?.id === r?.id) last.to = i;
    else groups.push({ rcd: r, from: i, to: i });
  });

  let totalPi = 0;
  let totalPa = 0;

  const cellsFor = (c: Col, i: number): string[] => {
    if (c.kind === "spare") return [String(i + 1), "—", "—", "—", "—", "—", "—", "—", "rezerva", "Rezerva"];
    if (c.kind === "feeder") {
      const l = c.child ? panelLoad(p, c.child.id) : null;
      totalPa += l?.appliedW ?? 0;
      return [String(i + 1), "—", l ? fmtNum(l.appliedW, 0) : "—", l?.currentA != null ? fmtNum(l.currentA, 1) : "—", c.child?.feeder.lengthM.value != null ? fmtNum(c.child.feeder.lengthM.value, 1) : "—", "—", p.supply.system === "tri" ? "L123" : "L1", "—", c.child?.code ?? "TA", `Alimentare ${c.child?.name ?? ""}`];
    }
    const circ = c.circuit;
    if (!circ) return [String(i + 1), "—", "—", "—", "—", "—", "—", "—", "?", c.item.label];
    const l = circuitLoad(p, circ);
    const a = analyzeCircuit(p, circ);
    totalPi += l.installed.value ?? 0;
    totalPa += l.appliedW ?? 0;
    const rooms = [...new Set(l.devices.map((d) => p.rooms.find((r) => r.id === d.roomId)?.name).filter(Boolean))].join(", ");
    return [
      String(i + 1),
      l.installed.value === null ? "—" : fmtNum(l.installed.value, 0) + (l.installed.unknownCount ? "*" : ""),
      `${circ.simultaneity.value ?? "—"} / ${l.appliedW === null ? "—" : fmtNum(l.appliedW, 0)}`,
      l.designCurrentA === null ? "—" : fmtNum(l.designCurrentA, 1),
      l.length.value === null ? "—" : fmtNum(l.length.value, 1) + (l.length.certainty === "masurat" ? "" : " e"),
      a.duTotalPct === null ? "—" : fmtNum(a.duTotalPct, 2),
      p.supply.system === "mono" ? "L1" : circ.phase === "L123" ? "L123" : (circ.phase ?? "—"),
      l.sockets ? String(l.sockets) : String(l.devices.filter((d) => d.category !== "intrerupator").length),
      circ.code,
      `${circ.name}${rooms && !circ.name.includes(rooms) ? " - " + rooms : ""}`,
    ];
  };
  const cells = cols.map(cellsFor);

  // text pe mai multe randuri (descriere)
  const wrap = (s: string, max = 17) => {
    const words = s.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > max) {
        if (cur) lines.push(cur);
        cur = w;
      } else cur = (cur + " " + w).trim();
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 4);
  };

  const today = new Date();
  const rev = `Rev.${String(p.issued.length + 1).padStart(2, "0")}`;

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" xmlns="http://www.w3.org/2000/svg" fontFamily={F} style={{ background: "#fff" }}>
      <rect x={1} y={1} width={W - 2} height={H - 2} fill="#fff" stroke="#14181f" strokeWidth={1.5} />
      <text x={W / 2} y={Y.title} textAnchor="middle" fontSize={20}>
        Schema monofilara {panel.name} - {p.info.name}
      </text>
      <line x1={1} y1={50} x2={W - 1} y2={50} stroke="#14181f" />

      {/* coloana stanga: etichete zone */}
      <line x1={LEFT - 10} y1={50} x2={LEFT - 10} y2={Y.table + tableH} stroke="#14181f" />
      {[
        { y1: 50, y2: Y.gen - 10, t: [parent ? "Alimentare tablou" : "Alimentare tablou", parent ? `din ${parent.code}` : `general ${p.supply.system === "mono" ? "230V" : "400V"}`] },
        { y1: Y.gen - 10, y2: Y.bus, t: [generalIsRcd ? "Intrerupator automat" : "Aparat general", generalIsRcd ? "diferential general" : "de intrare"] },
        { y1: Y.bus, y2: Y.cab, t: ["Intrerupatoare", rcds.length ? "diferentiale si automate" : "automate", "pentru liniile de iesire"] },
        { y1: Y.cab, y2: Y.table, t: ["Tip conductor, numar", "fire si sectiunea"] },
      ].map((z, k) => (
        <g key={k}>
          <line x1={1} y1={z.y2} x2={LEFT - 10} y2={z.y2} stroke="#14181f" />
          {z.t.map((line, j) => (
            <text key={j} x={(LEFT - 10) / 2} y={(z.y1 + z.y2) / 2 - ((z.t.length - 1) * 14) / 2 + j * 14 + 4} textAnchor="middle" fontSize={12} fontWeight={700}>
              {line}
            </text>
          ))}
        </g>
      ))}

      {/* alimentare */}
      {(() => {
        const x0 = LEFT + 60;
        return (
          <g>
            <text x={x0 + 30} y={Y.feed + 6} fontSize={12}>{feedText}</text>
            <line x1={x0} y1={Y.feed + 20} x2={x0} y2={Y.gen} stroke="#14181f" strokeWidth={1.6} />
            <text x={x0 - 8} y={Y.feed + 40} fontSize={11} textAnchor="end">L{p.supply.system === "tri" ? "1-3" : ""}</text>
            <line x1={x0 + 40} y1={Y.feed + 20} x2={x0 + 40} y2={Y.bus - 10} stroke="#14181f" strokeDasharray="6 3" />
            <text x={x0 + 46} y={Y.feed + 40} fontSize={11}>PE</text>
            <line x1={x0 + 80} y1={Y.feed + 20} x2={x0 + 80} y2={Y.bus - 18} stroke="#14181f" />
            <text x={x0 + 86} y={Y.feed + 40} fontSize={11}>N</text>
            {spd && (
              <g>
                <line x1={x0} y1={Y.feed + 52} x2={x0 - 40} y2={Y.feed + 52} stroke="#14181f" />
                <rect x={x0 - 58} y={Y.feed + 44} width={18} height={30} fill="none" stroke="#14181f" />
                <text x={x0 - 49} y={Y.feed + 88} fontSize={10} textAnchor="middle">SPD</text>
              </g>
            )}
            {general ? <Breaker x={x0} y={Y.gen} h={70} rcd={!!generalIsRcd} /> : <line x1={x0} y1={Y.gen} x2={x0} y2={Y.gen + 70} stroke="#14181f" strokeWidth={1.6} />}
            {general && (
              <g>
                <text x={x0 + 18} y={Y.gen + 22} fontSize={12}>Q1</text>
                <text x={x0 + 18} y={Y.gen + 38} fontSize={11} fontWeight={700}>{devText(p, general)}</text>
              </g>
            )}
            <line x1={x0} y1={Y.gen + 70} x2={x0} y2={Y.bus} stroke="#14181f" strokeWidth={1.6} />
            <text x={x0 + 18} y={Y.gen + 58} fontSize={10} fill="#4a5260">
              P aplicata tablou: {fmtNum(load.appliedW, 0)} W · Ic: {load.currentA === null ? "—" : fmtNum(load.currentA, 1)} A
            </text>
          </g>
        );
      })()}

      {/* bara principala, PE si N */}
      <line x1={LEFT} y1={Y.bus} x2={LEFT + n * COL - 10} y2={Y.bus} stroke="#14181f" strokeWidth={2.2} />
      <line x1={LEFT} y1={Y.bus - 10} x2={LEFT + n * COL - 10} y2={Y.bus - 10} stroke="#14181f" strokeDasharray="6 3" />
      <line x1={LEFT} y1={Y.bus - 18} x2={LEFT + n * COL - 10} y2={Y.bus - 18} stroke="#14181f" />

      {/* grupuri RCD */}
      {groups.map((g, k) => {
        const xa = colX(g.from);
        const xb = colX(g.to);
        const xm = (xa + xb) / 2;
        if (!g.rcd)
          return (
            <g key={k}>
              {Array.from({ length: g.to - g.from + 1 }).map((_, j) => (
                <line key={j} x1={colX(g.from + j)} y1={Y.bus} x2={colX(g.from + j)} y2={Y.mcb} stroke="#14181f" strokeWidth={1.4} />
              ))}
            </g>
          );
        return (
          <g key={k}>
            <line x1={xm} y1={Y.bus} x2={xm} y2={Y.rcd} stroke="#14181f" strokeWidth={1.4} />
            <Breaker x={xm} y={Y.rcd} h={60} rcd />
            <text x={xm + 16} y={Y.rcd + 18} fontSize={11}>Q{(general ? 2 : 1) + rcds.indexOf(g.rcd)}</text>
            <text x={xm + 16} y={Y.rcd + 32} fontSize={11} fontWeight={700}>{devText(p, g.rcd)}</text>
            <line x1={xm} y1={Y.rcd + 60} x2={xm} y2={Y.sub} stroke="#14181f" strokeWidth={1.4} />
            <line x1={Math.min(xa, xm)} y1={Y.sub} x2={Math.max(xb, xm)} y2={Y.sub} stroke="#14181f" strokeWidth={1.8} />
            {Array.from({ length: g.to - g.from + 1 }).map((_, j) => (
              <line key={j} x1={colX(g.from + j)} y1={Y.sub} x2={colX(g.from + j)} y2={Y.mcb} stroke="#14181f" strokeWidth={1.4} />
            ))}
          </g>
        );
      })}

      {/* circuite */}
      {cols.map((c, i) => {
        const x = colX(i);
        const circ = c.kind === "circuit" ? c.circuit : undefined;
        const cable = c.kind === "feeder" ? lib.cableTypes.find((t) => t.id === c.child?.feeder.cableTypeId) : lib.cableTypes.find((t) => t.id === circ?.cableTypeId);
        const label = c.kind === "feeder" ? c.child?.code ?? "TA" : circ?.code ?? "";
        return (
          <g key={c.item.id}>
            <text x={x - 34} y={Y.mcb + 2} fontSize={11} fontWeight={700}>{label}</text>
            {c.kind === "spare" ? <line x1={x} y1={Y.mcb} x2={x} y2={Y.mcb + 50} stroke="#8a919c" strokeDasharray="4 3" /> : <Breaker x={x} y={Y.mcb} h={56} rcd={deviceOf(p, c.item)?.kind === "RCBO"} />}
            <text x={x - 8} y={Y.mcb + 78} fontSize={10.5} fontWeight={700} textAnchor="end">{c.kind === "spare" ? "rezerva" : devText(p, c.item)}</text>
            <line x1={x} y1={Y.mcb + 56} x2={x} y2={Y.arrow} stroke={c.kind === "spare" ? "#8a919c" : "#d11"} strokeWidth={1.6} />
            {c.kind !== "spare" && <path d={`M ${x - 5} ${Y.arrow - 10} L ${x} ${Y.arrow} L ${x + 5} ${Y.arrow - 10} Z`} fill="#d11" />}
            <line x1={x + 26} y1={Y.mcb + 56} x2={x + 26} y2={Y.cab + 30} stroke="#14181f" strokeDasharray="5 3" />
            <text transform={`translate(${x + 5} ${Y.cab + 20}) rotate(90)`} fontSize={10.5} fontWeight={700}>
              {cable ? `${cable.name} mmp` : "cablu de stabilit"}
            </text>
          </g>
        );
      })}

      {/* tabel */}
      {(() => {
        let y = Y.table;
        const rowsY = ROWS.map((_, k) => {
          const h = k === ROWS.length - 1 ? descH : RH;
          const r = { y, h };
          y += h;
          return r;
        });
        return (
          <g fontSize={11}>
            <line x1={1} y1={Y.table} x2={W - 1} y2={Y.table} stroke="#14181f" />
            {ROWS.map((label, k) => (
              <g key={label}>
                <rect x={1} y={rowsY[k].y} width={LEFT - 11} height={rowsY[k].h} fill="none" stroke="#14181f" />
                <text x={(LEFT - 10) / 2} y={rowsY[k].y + rowsY[k].h / 2 + 4} textAnchor="middle" fontWeight={700}>{label}</text>
                {cells.map((cl, i) => {
                  const x = LEFT - 10 + i * COL;
                  const lines = k === ROWS.length - 1 ? wrap(cl[k]) : [cl[k]];
                  return (
                    <g key={i}>
                      <rect x={x} y={rowsY[k].y} width={COL} height={rowsY[k].h} fill="none" stroke="#14181f" strokeWidth={0.8} />
                      {lines.map((ln, j) => (
                        <text key={j} x={x + COL / 2} y={rowsY[k].y + rowsY[k].h / 2 + 4 - ((lines.length - 1) * 12) / 2 + j * 12} textAnchor="middle" fontWeight={k === 2 ? 700 : 400} fontSize={k === ROWS.length - 1 ? 10 : 11}>
                          {ln}
                        </text>
                      ))}
                    </g>
                  );
                })}
                {/* total */}
                <rect x={LEFT - 10 + n * COL} y={rowsY[k].y} width={COL + 10} height={rowsY[k].h} fill="#f6f5f1" stroke="#14181f" strokeWidth={0.8} />
                <text x={LEFT - 10 + n * COL + (COL + 10) / 2} y={rowsY[k].y + rowsY[k].h / 2 + 4} textAnchor="middle" fontWeight={700}>
                  {k === 0 ? "Total" : k === 1 ? fmtNum(totalPi, 0) : k === 2 ? fmtNum(totalPa, 0) : k === 3 ? (load.currentA === null ? "—" : fmtNum(load.currentA, 1)) : k === 8 ? panel.code : ""}
                </text>
              </g>
            ))}
          </g>
        );
      })()}

      {/* note */}
      <text x={12} y={Y.table + tableH + 18} fontSize={9.5} fill="#4a5260">
        Note: * putere incompleta; „e” lungime estimata; Ic pentru puterea aplicata (P x ks), cos φ {fmtNum(p.supply.cosPhi)}; ΔU include alimentarea tabloului, reactanta neglijata. Valorile calculate se verifica de persoana autorizata.
      </text>

      {/* cartus */}
      {(() => {
        const cw = 560;
        const cx = W - cw - 10;
        const cy = H - cartH - 10;
        const r = 20;
        const cell = (x: number, y: number, w: number, h: number, t: string, bold = false, size = 10) => (
          <g>
            <rect x={x} y={y} width={w} height={h} fill="none" stroke="#14181f" strokeWidth={0.8} />
            <text x={x + w / 2} y={y + h / 2 + 3.5} textAnchor="middle" fontSize={size} fontWeight={bold ? 700 : 400}>{t}</text>
          </g>
        );
        return (
          <g>
            {cell(cx, cy, 120, r, "VERIFICATOR / EXPERT")}
            {cell(cx + 120, cy, 110, r, "Nume")}
            {cell(cx + 230, cy, 70, r, "Semnatura")}
            {cell(cx + 300, cy, 260, r, "Referat / expertiza nr. / data")}
            {cell(cx, cy + r, 300, r, firm.legalName || firm.name, true, 11)}
            {cell(cx + 300, cy + r, 200, r, `Beneficiar: ${p.info.client.name || "—"}`)}
            {cell(cx + 500, cy + r, 60, r, `Nr. ${p.info.code.split("-").at(-1)}`)}
            {cell(cx, cy + r * 2, 300, r, `Proiectant: ${firm.designer} · ANRE ${firm.anreGrade} nr. ${firm.anreAuthorization}`, false, 9.5)}
            {cell(cx + 300, cy + r * 2, 200, r, `Titlu proiect: ${p.info.name}`, false, 9.5)}
            {cell(cx + 500, cy + r * 2, 60, r, rev)}
            {cell(cx, cy + r * 3, 120, r, "Proiectant")}
            {cell(cx + 120, cy + r * 3, 180, r, firm.designer)}
            {cell(cx + 300, cy + r * 3, 200, r, "Titlu plansa: SCHEMA ELECTRICA", false, 9.5)}
            {cell(cx + 500, cy + r * 3, 60, r, "Plansa nr.")}
            {cell(cx, cy + r * 4, 120, r, "Desenat")}
            {cell(cx + 120, cy + r * 4, 180, r, `${firm.designer} · ${today.getFullYear()}`)}
            {cell(cx + 300, cy + r * 4, 200, r, `MONOFILARA ${panel.code} ${panel.name}`.slice(0, 38), false, 9.5)}
            {cell(cx + 500, cy + r * 4, 60, r, panel.code)}
            <text x={cx} y={cy + r * 5 + 14} fontSize={9} fill="#4a5260">
              {firm.website} · {firm.email} · {firm.phone} · data {today.toLocaleDateString("ro-RO")}
            </text>
          </g>
        );
      })()}
    </svg>
  );
});
