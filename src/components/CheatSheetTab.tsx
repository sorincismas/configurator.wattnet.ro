"use client";

import { useState } from "react";
import {
  CHEAT_MONO,
  CHEAT_TRI,
  STANDARD_SECTIONS,
  cableLabel,
  getRules,
  izFor,
  minSectionFor,
  powerKw,
  recommendSection,
  voltageDropPct,
  type CheatRow,
  type Phases,
  type PricingSettings,
} from "@/lib/engine";
import { Badge, Button, Card, Field, NumberInput, Select, num } from "./ui";

export function CheatSheetTab({ pricing }: { pricing: PricingSettings }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end print:hidden">
        <Button variant="secondary" onClick={() => window.print()}>
          Tipareste / PDF
        </Button>
      </div>
      <CheatTable title="Monofazat: 230 V, cablu 3× (L + N + PE)" rows={CHEAT_MONO} />
      <CheatTable title="Trifazat: 400 V, cablu 5× (3L + N + PE)" rows={CHEAT_TRI} />
      <HowCalculated />
      <Calculator pricing={pricing} />
    </div>
  );
}

function CheatTable({ title, rows }: { title: string; rows: CheatRow[] }) {
  return (
    <Card title={title} className="break-inside-avoid">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm print:min-w-0">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2">Disjunctor</th>
              <th className="py-2">Putere maxima (cos φ=1)</th>
              <th className="py-2">Putere la motoare (cos φ≈0,85)</th>
              <th className="py-2">Sectiune minima dupa incalzire</th>
              <th className="py-2">Recomandat pentru 30 m</th>
              <th className="py-2">ΔU la 30 m</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.a} className="border-b border-slate-100">
                <td className="py-1.5 font-semibold">{r.a} A</td>
                <td className="py-1.5 tabular-nums">{r.p1}</td>
                <td className="py-1.5 tabular-nums">{r.p085}</td>
                <td className="py-1.5">{r.minSection}</td>
                <td className="py-1.5">{r.rec30}</td>
                <td className="py-1.5 tabular-nums">{r.du30}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function HowCalculated() {
  return (
    <Card title="Cum am calculat" className="break-inside-avoid">
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>Puterea: la monofazat P = 230 × I. La trifazat P = √3 × 400 × I ≈ 693 × I.</li>
        <li>
          Cablul se alege dupa regula <strong>Ib ≤ In ≤ Iz</strong>: curentul consumatorului ≤ curentul disjunctorului ≤
          curentul admisibil al cablului.
        </li>
        <li>
          Curenti admisibili folositi pentru Cu/PVC in tub (2 conductoare incarcate la mono / 3 la tri): 1,5 mm² → 16,5/15 A
          · 2,5 → 23/20 A · 4 → 30/27 A · 6 → 38/34 A · 10 → 52/46 A · 16 → 69/62 A.
        </li>
        <li>
          Caderea de tensiune e calculata cu conductorul cald (ρ = 0,0225 Ω·mm²/m). Limitele de reper sunt 3 % pentru
          iluminat si 5 % pentru alti consumatori.
        </li>
      </ul>
      <p className="mt-3 rounded-md bg-amber-50 p-2 text-sm text-amber-900">
        Verifica valorile exacte in editia de I7 dupa care faci proiectul.
      </p>
    </Card>
  );
}

function Calculator({ pricing }: { pricing: PricingSettings }) {
  const rules = getRules(pricing);
  const [phases, setPhases] = useState<Phases>(1);
  const [ia, setIa] = useState<number | null>(16);
  const [ib, setIb] = useState<number | null>(null);
  const [len, setLen] = useState<number | null>(30);
  const [s, setS] = useState(2.5);
  const [cos, setCos] = useState<number | null>(1);
  const [lighting, setLighting] = useState(false);

  const In = ia ?? 0;
  const L = len ?? 0;
  const limit = lighting ? rules.maxDropLightingPct : rules.maxDropOtherPct;
  const iz = izFor(s, phases, rules.iz);
  const du = voltageDropPct(phases, ib ?? In, L, s, rules.rho);
  const p = powerKw(phases, In, cos ?? 1);
  const minS = minSectionFor(In, phases, rules.iz);
  const recS = recommendSection(In, L, phases, rules.iz, rules.rho, limit);
  const ibOk = ib == null || ib <= In;
  const izOk = iz != null && In <= iz;
  const duOk = du != null && du <= limit;

  return (
    <Card title="Calculator rapid" className="print:hidden">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <Field label="Alimentare">
          <Select
            value={String(phases) as "1" | "3"}
            options={[
              { value: "1", label: "Mono 230 V" },
              { value: "3", label: "Tri 400 V" },
            ]}
            onChange={(v) => setPhases(Number(v) as Phases)}
          />
        </Field>
        <Field label="In disjunctor (A)">
          <NumberInput value={ia} onChange={setIa} />
        </Field>
        <Field label="Ib consumator (A)" hint="optional; gol = In">
          <NumberInput value={ib} onChange={setIb} step={0.1} />
        </Field>
        <Field label="Lungime (m)">
          <NumberInput value={len} onChange={setLen} step={0.5} />
        </Field>
        <Field label="Sectiune (mm²)">
          <Select
            value={String(s)}
            options={STANDARD_SECTIONS.map((x) => ({ value: String(x), label: cableLabel(phases, x) }))}
            onChange={(v) => setS(Number(v))}
          />
        </Field>
        <Field label="cos φ">
          <NumberInput value={cos} onChange={setCos} step={0.01} />
        </Field>
        <Field label="Tip circuit">
          <Select
            value={lighting ? "il" : "alt"}
            options={[
              { value: "alt", label: `Alti consumatori (${num(rules.maxDropOtherPct)} %)` },
              { value: "il", label: `Iluminat (${num(rules.maxDropLightingPct)} %)` },
            ]}
            onChange={(v) => setLighting(v === "il")}
          />
        </Field>
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <Out label="Putere la In" value={`${num(p, 2)} kW`} />
        <Out label={`Iz pentru ${cableLabel(phases, s)}`} value={iz == null ? "—" : `${num(iz)} A`} />
        <Out
          label={`ΔU la ${num(L)} m (cu ${ib != null ? "Ib" : "In"})`}
          value={du == null ? "—" : `${num(du, 2)} %`}
          tone={duOk ? "ok" : "bad"}
        />
        <Out label="Sectiune minima (Iz)" value={minS == null ? "—" : cableLabel(phases, minS)} />
        <Out label={`Recomandat (Iz + ΔU ≤ ${num(limit)} %)`} value={recS == null ? "peste tabel" : cableLabel(phases, recS)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={ibOk ? "ok" : "bad"}>Ib ≤ In: {ibOk ? "da" : "nu"}</Badge>
        <Badge tone={izOk ? "ok" : "bad"}>In ≤ Iz: {izOk ? "da" : "nu"}</Badge>
        <Badge tone={duOk ? "ok" : "bad"}>
          ΔU ≤ {num(limit)} %: {duOk ? "da" : "nu"}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Calculul foloseste tabelul Iz, ρ si limitele din Tarife &amp; setari, aceleasi ca la verificarile circuitelor.
      </p>
    </Card>
  );
}

function Out({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className={`rounded-lg p-2 ${tone === "bad" ? "bg-red-50" : tone === "ok" ? "bg-emerald-50" : "bg-slate-50"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
