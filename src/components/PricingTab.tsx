"use client";

import { STAGE_LABELS, type LaborOperation, type PricingSettings } from "@/lib/engine";
import { Card, Field, NumberInput } from "./ui";

export function PricingTab({
  pricing,
  setPricing,
}: {
  pricing: PricingSettings;
  setPricing: (fn: (s: PricingSettings) => PricingSettings) => void;
}) {
  const setOp = (id: string, patch: Partial<LaborOperation>) =>
    setPricing((s) => ({ ...s, operations: s.operations.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));

  return (
    <div className="flex flex-col gap-4">
      <Card title="Setări generale">
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Field label="Tarif orar (lei/oră, fără TVA)" hint="Folosit doar unde nu e setat tarif unitar">
            <NumberInput value={pricing.hourlyRate ?? null} placeholder="nesetat" onChange={(v) => setPricing((s) => ({ ...s, hourlyRate: v }))} />
          </Field>
          <Field label="Traseu estimat per doză (m)" hint="Când traseul încăperii nu e introdus">
            <NumberInput
              value={pricing.defaultRouteMPerPoint}
              step={0.5}
              onChange={(v) => setPricing((s) => ({ ...s, defaultRouteMPerPoint: Math.max(0, v ?? 0) }))}
            />
          </Field>
        </div>
      </Card>

      <Card title="Catalog operațiuni de manoperă">
        <p className="mb-3 text-sm text-slate-600">
          Tarifele și timpii sunt ai tăi: aplicația nu propune valori. Tariful unitar are prioritate; dacă lipsește, se
          folosește timp standard × tarif orar. Cantitățile vin automat din proiect. Setările se salvează în acest browser
          și se aplică tuturor proiectelor.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="w-10 py-2">Activ</th>
                <th className="py-2">Operațiune</th>
                <th className="py-2">Etapă</th>
                <th className="w-16 py-2">UM</th>
                <th className="w-32 px-1 py-2">Tarif (lei/UM)</th>
                <th className="w-32 px-1 py-2">Timp (min/UM)</th>
              </tr>
            </thead>
            <tbody>
              {pricing.operations.map((o) => (
                <tr key={o.id} className={`border-b border-slate-100 ${o.enabled ? "" : "opacity-50"}`}>
                  <td className="py-1.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-amber-500"
                      checked={o.enabled}
                      aria-label={`Activ: ${o.name}`}
                      onChange={(e) => setOp(o.id, { enabled: e.target.checked })}
                    />
                  </td>
                  <td className="py-1.5">{o.name}</td>
                  <td className="py-1.5 text-slate-500">{STAGE_LABELS[o.stage]}</td>
                  <td className="py-1.5 text-slate-500">{o.unit}</td>
                  <td className="px-1 py-1.5">
                    <NumberInput
                      ariaLabel={`Tarif ${o.name}`}
                      value={o.unitPrice ?? null}
                      step={0.5}
                      placeholder="—"
                      onChange={(v) => setOp(o.id, { unitPrice: v })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <NumberInput
                      ariaLabel={`Timp ${o.name}`}
                      value={o.minutesPerUnit ?? null}
                      placeholder="—"
                      onChange={(v) => setOp(o.id, { minutesPerUnit: v })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
