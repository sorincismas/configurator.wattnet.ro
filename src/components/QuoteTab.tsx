"use client";

import {
  STAGE_LABELS,
  computeQuote,
  executionPlan,
  runChecks,
  type PricingSettings,
  type Project,
} from "@/lib/engine";
import { Badge, Button, Card, Field, NumberInput, hours, lei, num } from "./ui";

const METHOD: Record<string, string> = {
  "tarif-unitar": "tarif unitar",
  "timp-x-tarif-orar": "timp × tarif orar",
  "lipsa-tarif": "fără tarif",
};

export function QuoteTab({
  project,
  pricing,
  update,
  goToPricing,
}: {
  project: Project;
  pricing: PricingSettings;
  update: (fn: (p: Project) => Project) => void;
  goToPricing: () => void;
}) {
  const q = computeQuote(project, pricing);
  const plan = executionPlan(q);
  const open = runChecks(project, pricing).filter((c) => c.status !== "conform");
  const hasEstimates = q.lines.some((l) => l.estimatedQuantity > 0);

  return (
    <div className="flex flex-col gap-4">
      {!q.complete && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 print:hidden">
          <strong>Deviz incomplet:</strong> {q.unpricedLines.length} operațiuni nu au tarif (
          {q.unpricedLines.map((l) => l.name).join(", ")}).{" "}
          <button className="underline" onClick={goToPricing}>
            Setează tarifele
          </button>
          .
        </div>
      )}

      <Card
        title="Deviz de manoperă — faza „la roșu”"
        actions={
          <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
            Tipărește / PDF
          </Button>
        }
      >
        <div className="mb-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
          <div>
            <strong className="text-slate-900">{project.code}</strong> · {project.name}
          </div>
          <div className="sm:text-right">
            Client: {project.client.name || "—"}
            {project.client.locality ? `, ${project.client.locality}` : ""}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Operațiune</th>
                <th className="py-2 text-right">Cantitate</th>
                <th className="py-2 pl-2">UM</th>
                <th className="py-2 text-right">Preț unitar</th>
                <th className="py-2 text-right">Valoare</th>
                <th className="py-2 pl-3 print:hidden">Calcul</th>
              </tr>
            </thead>
            <tbody>
              {q.lines.map((l) => (
                <tr key={l.operationId} className="border-b border-slate-100">
                  <td className="py-1.5">
                    {l.name}
                    {l.estimatedQuantity > 0 && <span className="ml-1 text-amber-700">*</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{num(l.quantity)}</td>
                  <td className="py-1.5 pl-2 text-slate-500">{l.unit}</td>
                  <td className="py-1.5 text-right tabular-nums">{l.unitPrice == null ? "—" : lei(l.unitPrice)}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums">{l.amount == null ? "—" : lei(l.amount)}</td>
                  <td className="py-1.5 pl-3 print:hidden">
                    <Badge tone={l.method === "lipsa-tarif" ? "warn" : "info"}>{METHOD[l.method]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <Row label="Subtotal manoperă" value={lei(q.laborSubtotal)} />
              {q.discount > 0 && <Row label={`Discount ${num(q.discountPct)}%`} value={`− ${lei(q.discount)}`} />}
              <Row label="Total fără TVA" value={lei(q.netTotal)} />
              <Row label={`TVA ${num(q.vatPct)}%`} value={lei(q.vat)} />
              <Row label="Total de plată" value={lei(q.grandTotal)} strong />
            </tfoot>
          </table>
        </div>
        {hasEstimates && (
          <p className="mt-2 text-xs text-amber-800">
            * Cantitate care include lungimi estimate. Se recalculează după măsurarea traseelor.
          </p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Devizul cuprinde doar manopera pentru faza „la roșu” (doze, trasee, cabluri, montaj și echipare tablouri).
          Materialele și faza „la gata” (aparataj, corpuri de iluminat, echipamente) se ofertează separat.
        </p>

        <div className="mt-4 grid max-w-md grid-cols-3 gap-3 print:hidden">
          <Field label="Deplasări">
            <NumberInput value={project.trips} onChange={(v) => update((p) => ({ ...p, trips: Math.max(0, Math.round(v ?? 0)) }))} />
          </Field>
          <Field label="Discount %">
            <NumberInput value={project.discountPct} step={0.5} onChange={(v) => update((p) => ({ ...p, discountPct: v ?? 0 }))} />
          </Field>
          <Field label="TVA %">
            <NumberInput value={project.vatPct} onChange={(v) => update((p) => ({ ...p, vatPct: v ?? 0 }))} />
          </Field>
        </div>
      </Card>

      <Card title="Plan de execuție">
        <ol className="flex flex-col gap-3">
          {plan.map((s) => (
            <li key={s.stage} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{STAGE_LABELS[s.stage]}</strong>
                <span className="text-sm text-slate-600">
                  {s.minutes > 0 ? `~${hours(s.minutes)}` : ""}
                  {s.missingTime > 0 && (
                    <span className="ml-2 text-amber-700">{s.missingTime} op. fără timp standard</span>
                  )}
                </span>
              </div>
              <ul className="mt-1 text-sm text-slate-700">
                {s.lines.map((l) => (
                  <li key={l.operationId}>
                    ☐ {l.name}: {num(l.quantity)} {l.unit}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-slate-700">
          Durată estimată totală: <strong>{q.totalMinutes > 0 ? hours(q.totalMinutes) : "—"}</strong>{" "}
          <span className="text-xs text-slate-500">(din timpii standard setați; de calibrat pe lucrările reale)</span>
        </p>
        {open.length > 0 && (
          <p className="mt-2 text-sm text-amber-800 print:hidden">
            {open.length} verificări deschise înainte de execuție — vezi tab-ul Verificări.
          </p>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className={strong ? "border-t-2 border-slate-900 text-base font-bold" : ""}>
      <td colSpan={4} className="py-1.5 text-right">
        {label}
      </td>
      <td className="py-1.5 text-right tabular-nums">{value}</td>
      <td className="print:hidden" />
    </tr>
  );
}
