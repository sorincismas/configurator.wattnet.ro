"use client";

import { useState, type ReactNode } from "react";
import {
  DEVICE_LABELS,
  POINT_KINDS,
  POINT_LABELS,
  buildSingleLine,
  computeInventory,
  computeQuote,
  deviceRatingText,
  getRules,
  installedPowerKw,
  orderPanels,
  powerKw,
  projectCircuits,
  roomCode,
  roomRoute,
  runChecks,
  supplyPhases,
  type PricingSettings,
  type Project,
} from "@/lib/engine";
import { CHECK_GROUPS, CheckList, sortChecks } from "./ChecksTab";
import { PanelSvg } from "./PanelSvg";
import { PrintHeader } from "./PrintHeader";
import { ExecutionPlanList, QuoteTable } from "./QuoteTab";
import { SingleLineSvg } from "./SingleLineSvg";
import { Button, num } from "./ui";

const SECTIONS = [
  { id: "coperta", label: "Coperta si date generale" },
  { id: "inventar", label: "Inventar pe niveluri" },
  { id: "circuite", label: "Lista circuitelor" },
  { id: "tablouri", label: "Echiparea tablourilor" },
  { id: "schema", label: "Schema monofilara" },
  { id: "verificari", label: "Verificari" },
  { id: "deviz", label: "Deviz de manopera" },
  { id: "plan", label: "Plan de executie" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export function DocumentationTab({ project, pricing }: { project: Project; pricing: PricingSettings }) {
  const [on, setOn] = useState<Record<SectionId, boolean>>(
    () => Object.fromEntries(SECTIONS.map((s) => [s.id, true])) as Record<SectionId, boolean>,
  );
  const rules = getRules(pricing);
  const inv = computeInventory(project, pricing.defaultRouteMPerPoint);
  const circuits = projectCircuits(project, pricing);
  const q = computeQuote(project, pricing);
  const checks = sortChecks(runChecks(project, pricing));
  const sl = buildSingleLine(project, circuits);
  const phases = supplyPhases(project.supply);
  const pMax = project.mainBreakerA && phases ? powerKw(phases, project.mainBreakerA, project.cosPhi ?? 1) : null;
  const pInst = installedPowerKw(circuits);
  const panels = orderPanels(project.panels);

  const active = SECTIONS.filter((s) => on[s.id] && (s.id !== "schema" || sl.length > 0));
  const firstId = active[0]?.id;
  const page = (id: SectionId, title: string, body: ReactNode) => {
    if (!on[id]) return null;
    const cls = id === firstId ? "" : "print-page";
    return (
      <section key={id} className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${cls}`}>
        <PrintHeader project={project} title={title} />
        <h2 className="mb-3 text-lg font-bold text-slate-900 print:hidden">{title}</h2>
        {body}
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3 print:hidden">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {SECTIONS.map((s) => (
            <label key={s.id} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                className="h-4 w-4 accent-amber-500"
                checked={on[s.id]}
                onChange={(e) => setOn((o) => ({ ...o, [s.id]: e.target.checked }))}
              />
              {s.label}
            </label>
          ))}
        </div>
        <Button onClick={() => window.print()} className="print:hidden">
          Tipareste documentatia ({active.length} sectiuni)
        </Button>
      </div>

      {page(
        "coperta",
        "Documentatie tehnica — instalatie electrica",
        <div className="flex flex-col gap-4 text-sm">
          <div className="py-6 text-center">
            <div className="text-3xl font-black tracking-wide">WATTNET</div>
            <div className="mt-2 text-xl font-semibold">Documentatie tehnica — instalatie electrica</div>
            <div className="mt-1 text-slate-600">Faza 1 — lucrari „la rosu”</div>
          </div>
          <Table
            head={["", ""]}
            hideHead
            rows={[
              ["Proiect", `${project.code} · ${project.name}`],
              ["Beneficiar", project.client.name || "—"],
              ["Adresa lucrare", [project.client.address, project.client.locality].filter(Boolean).join(", ") || "—"],
              ["Telefon / e-mail", [project.client.phone, project.client.email].filter(Boolean).join(" · ") || "—"],
              ["Tip cladire", project.buildingType],
              ["Alimentare", phases === 1 ? "Monofazata 230 V" : phases === 3 ? "Trifazata 400 V" : "Necunoscuta"],
              ["Siguranta generala", project.mainBreakerA ? `${project.mainBreakerA} A` : "—"],
              ["Putere maxima absorbita", pMax != null ? `${num(pMax, 2)} kW (cos φ ${num(project.cosPhi ?? 1, 2)})` : "—"],
              ["Putere instalata estimata", `${num(pInst, 2)} kW`],
              ["Niveluri / incaperi", `${project.levels.length} / ${project.levels.reduce((s, l) => s + l.rooms.length, 0)}`],
              ["Doze / trasee", `${inv.pointsTotal} doze · ${num(inv.routeM.total)} m trasee`],
              ["Circuite / tablouri", `${circuits.length} circuite · ${project.panels.length} tablouri`],
              ["Data", new Date().toLocaleDateString("ro-RO")],
            ]}
          />
          {project.notes && <p className="whitespace-pre-wrap text-slate-700">{project.notes}</p>}
          <p className="text-xs text-slate-500">
            Documentatie generata de configuratorul WATTNET. Calculele (Iz, ΔU, selectivitate amperica) folosesc valori de
            reper setabile; nu inlocuiesc proiectul tehnic verificat si semnat conform normativului I7 in vigoare.
          </p>
        </div>,
      )}

      {page(
        "inventar",
        "Inventar pe niveluri si incaperi",
        <div className="flex flex-col gap-4">
          {project.levels.map((lvl) => (
            <div key={lvl.id} className="break-inside-avoid">
              <h3 className="mb-1 font-semibold">{lvl.name}</h3>
              <Table
                head={["Cod", "Incapere", ...POINT_KINDS.map((k) => POINT_LABELS[k].replace("Doze ", "")), "LED (m)", "Traseu (m)"]}
                rows={lvl.rooms.map((r) => [
                  roomCode(r, lvl, project.levels),
                  r.name,
                  ...POINT_KINDS.map((k) => String(r.points[k] || "")),
                  r.ledStripM ? num(r.ledStripM) : "",
                  `${num(roomRoute(r, pricing.defaultRouteMPerPoint).total)}${r.routeM && r.routeM.value > 0 && r.routeM.source === "masurat" ? "" : " *"}`,
                ])}
              />
            </div>
          ))}
          <p className="text-xs text-slate-500">* traseu estimat ({num(pricing.defaultRouteMPerPoint)} m / doza)</p>
        </div>,
      )}

      {page(
        "circuite",
        "Lista circuitelor",
        <div className="flex flex-col gap-4">
          {panels.map((p) => {
            const list = circuits.filter((c) => c.panelId === p.id);
            if (!list.length) return null;
            return (
              <div key={p.id}>
                <h3 className="mb-1 font-semibold">
                  {p.name} · {list.length} circuite · {num(installedPowerKw(list), 2)} kW
                </h3>
                <Table
                  head={["Nr", "Cod", "Denumire", "Puncte", "Protectie", "Cablu", "L (m)", "P (kW)", "ΔU (%)"]}
                  rows={list.map((c) => [
                    String(c.order),
                    c.code,
                    c.name,
                    String(c.points),
                    `${c.curve}${c.ratedA} ${c.poles}P`,
                    c.cable,
                    `${num(c.lengthM)}${c.lengthEstimated ? " *" : ""}`,
                    num(c.powerKw, 2),
                    c.dropPct == null ? "—" : `${num(c.dropPct, 2)}${c.dropPct > c.dropLimitPct ? " !" : ""}`,
                  ])}
                />
              </div>
            );
          })}
          <p className="text-xs text-slate-500">
            * lungime estimata · ! cadere de tensiune peste limita ({num(rules.maxDropLightingPct)} % iluminat,{" "}
            {num(rules.maxDropOtherPct)} % alti consumatori). ΔU calculat la In, cu ρ = {rules.rho}.
          </p>
        </div>,
      )}

      {page(
        "tablouri",
        "Echiparea tablourilor",
        <div className="flex flex-col gap-6">
          {panels.map((p) => (
            <div key={p.id} className="break-inside-avoid">
              <h3 className="mb-1 font-semibold">
                {p.name}
                {p.parentPanelId && (
                  <span className="font-normal text-slate-500"> · alimentat din {project.panels.find((x) => x.id === p.parentPanelId)?.name}</span>
                )}
              </h3>
              <div className="mb-2 rounded bg-slate-50 p-1">
                <PanelSvg panel={p} />
              </div>
              <Table
                head={["#", "Aparat", "Circuit / functie", "Caracteristici", "Poli", "Module", "Sina"]}
                rows={p.devices.map((d, i) => [
                  String(i + 1),
                  DEVICE_LABELS[d.kind] + (d.isMain ? " (general)" : ""),
                  d.label,
                  deviceRatingText(d),
                  `${d.poles}P`,
                  num(d.modules),
                  String(d.row + 1),
                ])}
              />
            </div>
          ))}
        </div>,
      )}

      {on.schema &&
        sl.map((x, i) => {
          const cls = firstId === "schema" && i === 0 ? "" : "print-page";
          return (
            <section
              key={`schema-${x.panel.id}`}
              className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${cls} ${x.leaves > 10 ? "print-landscape" : ""}`}
            >
              <PrintHeader project={project} title={`Schema monofilara · ${x.panel.name}`} />
              <h2 className="mb-3 text-lg font-bold text-slate-900 print:hidden">Schema monofilara · {x.panel.name}</h2>
              <div className="overflow-x-auto">
                <SingleLineSvg sl={x} />
              </div>
            </section>
          );
        })}

      {page(
        "verificari",
        "Verificari",
        <div className="flex flex-col gap-3">
          {CHECK_GROUPS.map((g) => {
            const list = checks.filter((c) => (c.category ?? "date") === g.id);
            if (!list.length) return null;
            return (
              <div key={g.id}>
                <h3 className="font-semibold">{g.label}</h3>
                <CheckList list={list} />
              </div>
            );
          })}
          <p className="text-xs text-slate-500">
            Verificari de consistenta si de proiectare cu limite setabile; nu reprezinta verificarea conformitatii cu I7.
          </p>
        </div>,
      )}

      {page("deviz", "Deviz de manopera — faza „la rosu”", <QuoteTable q={q} />)}
      {page("plan", "Plan de executie", <ExecutionPlanList q={q} />)}
    </div>
  );
}

function Table({ head, rows, hideHead }: { head: string[]; rows: string[][]; hideHead?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm print:text-[9pt]">
        {!hideHead && (
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
              {head.map((h, i) => (
                <th key={i} className="px-1 py-1.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100">
              {r.map((c, j) => (
                <td key={j} className={`px-1 py-1 ${hideHead && j === 0 ? "w-56 font-medium text-slate-600" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
