"use client";

import {
  CIRCUIT_KINDS,
  CIRCUIT_KIND_LABELS,
  STAGE_LABELS,
  STANDARD_BREAKERS,
  STANDARD_SECTIONS,
  defaultRules,
  getRules,
  type CircuitDefaults,
  type CircuitKind,
  type Curve,
  type LaborOperation,
  type PricingSettings,
  type RuleSettings,
} from "@/lib/engine";
import { Button, Card, Field, NumberInput, Select } from "./ui";

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
      <RulesCard pricing={pricing} setPricing={setPricing} />
      <Card title="Setari generale">
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Field label="Tarif orar (lei/ora, fara TVA)" hint="Folosit doar unde nu e setat tarif unitar">
            <NumberInput value={pricing.hourlyRate ?? null} placeholder="nesetat" onChange={(v) => setPricing((s) => ({ ...s, hourlyRate: v }))} />
          </Field>
          <Field label="Traseu estimat per doza (m)" hint="Cand traseul incaperii nu e introdus">
            <NumberInput
              value={pricing.defaultRouteMPerPoint}
              step={0.5}
              onChange={(v) => setPricing((s) => ({ ...s, defaultRouteMPerPoint: Math.max(0, v ?? 0) }))}
            />
          </Field>
        </div>
      </Card>

      <Card title="Catalog operatiuni de manopera">
        <p className="mb-3 text-sm text-slate-600">
          Tarifele si timpii sunt ai tai: aplicatia nu propune valori. Tariful unitar are prioritate; daca lipseste, se
          foloseste timp standard × tarif orar. Cantitatile vin automat din proiect. Setarile se salveaza in acest browser
          si se aplica tuturor proiectelor.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="w-10 py-2">Activ</th>
                <th className="py-2">Operatiune</th>
                <th className="py-2">Etapa</th>
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

function RulesCard({
  pricing,
  setPricing,
}: {
  pricing: PricingSettings;
  setPricing: (fn: (s: PricingSettings) => PricingSettings) => void;
}) {
  const r = getRules(pricing);
  const set = (patch: Partial<RuleSettings>) => setPricing((s) => ({ ...s, rules: { ...getRules(s), ...patch } }));
  const setDef = (k: CircuitKind, patch: Partial<CircuitDefaults>) =>
    set({ defaults: { ...r.defaults, [k]: { ...r.defaults[k], ...patch } } });
  const n = (v: number | null, fallback: number) => (v != null && v > 0 ? v : fallback);

  return (
    <Card
      title="Setari de proiectare (limite si constante)"
      actions={
        <Button
          variant="ghost"
          onClick={() => {
            if (confirm("Revii la valorile de start pentru limite si constante?"))
              setPricing((s) => ({ ...s, rules: defaultRules() }));
          }}
        >
          Valori de start
        </Button>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        Valori de reper folosite la generarea circuitelor, la verificari si in cheat sheet. Nu sunt preluate din normativ:
        verifica valorile exacte in editia de I7 dupa care faci proiectul.
      </p>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Field label="Max prize / circuit">
          <NumberInput
            value={r.maxSocketsPerCircuit}
            min={1}
            onChange={(v) => set({ maxSocketsPerCircuit: Math.round(n(v, 1)) })}
          />
        </Field>
        <Field label="Max puncte iluminat / circuit">
          <NumberInput
            value={r.maxLightPointsPerCircuit}
            min={1}
            onChange={(v) => set({ maxLightPointsPerCircuit: Math.round(n(v, 1)) })}
          />
        </Field>
        <Field label="Circuite iluminat">
          <Select
            value={r.lightingGrouping}
            options={[
              { value: "incapere", label: "pe incapere" },
              { value: "nivel", label: "pe nivel" },
            ]}
            onChange={(v) => set({ lightingGrouping: v })}
          />
        </Field>
        <Field label="ρ (Ω·mm²/m)" hint="conductor cald">
          <NumberInput value={r.rho} step={0.0001} onChange={(v) => set({ rho: n(v, 0.0225) })} />
        </Field>
        <Field label="ΔU max iluminat (%)">
          <NumberInput value={r.maxDropLightingPct} step={0.5} onChange={(v) => set({ maxDropLightingPct: n(v, 3) })} />
        </Field>
        <Field label="ΔU max alti consumatori (%)">
          <NumberInput value={r.maxDropOtherPct} step={0.5} onChange={(v) => set({ maxDropOtherPct: n(v, 5) })} />
        </Field>
        <Field label="Raport selectivitate" hint="In amonte / In aval">
          <NumberInput value={r.selectivityRatio} step={0.1} onChange={(v) => set({ selectivityRatio: n(v, 1.6) })} />
        </Field>
        <Field label="Simultaneitate minima" hint="Pmax / Pinstalat">
          <NumberInput value={r.minSimultaneity} step={0.05} onChange={(v) => set({ minSimultaneity: n(v, 0.4) })} />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto">
          <div className="mb-1 text-sm font-medium text-slate-700">Valori implicite pe tip de circuit</div>
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Tip</th>
                <th className="w-24 px-1 py-2">In (A)</th>
                <th className="w-20 px-1 py-2">Curba</th>
                <th className="w-24 px-1 py-2">mm²</th>
                <th className="w-28 px-1 py-2">kW / punct</th>
              </tr>
            </thead>
            <tbody>
              {CIRCUIT_KINDS.map((k) => (
                <tr key={k} className="border-b border-slate-100">
                  <td className="py-1.5">{CIRCUIT_KIND_LABELS[k]}</td>
                  <td className="px-1 py-1.5">
                    <Select
                      value={String(r.defaults[k].ratedA)}
                      options={STANDARD_BREAKERS.map((a) => ({ value: String(a), label: `${a} A` }))}
                      onChange={(v) => setDef(k, { ratedA: Number(v) })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Select<Curve>
                      value={r.defaults[k].curve}
                      options={(["B", "C", "D"] as const).map((c) => ({ value: c, label: c }))}
                      onChange={(v) => setDef(k, { curve: v })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <Select
                      value={String(r.defaults[k].sectionMm2)}
                      options={STANDARD_SECTIONS.map((x) => ({ value: String(x), label: String(x).replace(".", ",") }))}
                      onChange={(v) => setDef(k, { sectionMm2: Number(v) })}
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <NumberInput
                      ariaLabel={`Putere ${k}`}
                      value={r.defaults[k].powerPerUnitKw}
                      step={0.01}
                      onChange={(v) => setDef(k, { powerPerUnitKw: v != null && v >= 0 ? v : 0 })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-500">La circuitul dedicat puterea este pe circuit (o poti schimba pe fiecare circuit).</p>
        </div>

        <div className="overflow-x-auto">
          <div className="mb-1 text-sm font-medium text-slate-700">Curenti admisibili Iz (Cu/PVC in tub)</div>
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Sectiune</th>
                <th className="w-28 px-1 py-2">Mono (A)</th>
                <th className="w-28 px-1 py-2">Tri (A)</th>
              </tr>
            </thead>
            <tbody>
              {r.iz.map((row, i) => (
                <tr key={row.sectionMm2} className="border-b border-slate-100">
                  <td className="py-1.5">{String(row.sectionMm2).replace(".", ",")} mm²</td>
                  {(["mono", "tri"] as const).map((col) => (
                    <td key={col} className="px-1 py-1.5">
                      <NumberInput
                        ariaLabel={`Iz ${col} ${row.sectionMm2}`}
                        value={row[col]}
                        step={0.5}
                        onChange={(v) =>
                          set({ iz: r.iz.map((x, j) => (j === i ? { ...x, [col]: v != null && v > 0 ? v : x[col] } : x)) })
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-500">2 conductoare incarcate la mono, 3 la tri.</p>
        </div>
      </div>
    </Card>
  );
}
