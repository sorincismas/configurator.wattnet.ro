"use client";

import { useState } from "react";
import {
  STANDARD_BREAKERS,
  installedPowerKw,
  powerKw,
  projectCircuits,
  supplyPhases,
  type BuildingType,
  type PricingSettings,
  type Project,
  type SupplyType,
} from "@/lib/engine";
import { Card, Field, NumberInput, Select, TextInput, num } from "./ui";

export function ProjectTab({
  project,
  pricing,
  update,
}: {
  project: Project;
  pricing: PricingSettings;
  update: (fn: (p: Project) => Project) => void;
}) {
  const setClient = (patch: Partial<Project["client"]>) =>
    update((p) => ({ ...p, client: { ...p.client, ...patch } }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PowerCard project={project} pricing={pricing} update={update} />
      <Card title="Proiect">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cod proiect">
            <TextInput value={project.code} onChange={(v) => update((p) => ({ ...p, code: v }))} />
          </Field>
          <Field label="Denumire">
            <TextInput value={project.name} onChange={(v) => update((p) => ({ ...p, name: v }))} />
          </Field>
          <Field label="Tip cladire">
            <Select<BuildingType>
              value={project.buildingType}
              options={[
                { value: "casa", label: "Casa" },
                { value: "apartament", label: "Apartament" },
                { value: "comercial", label: "Spatiu comercial" },
              ]}
              onChange={(v) => update((p) => ({ ...p, buildingType: v }))}
            />
          </Field>
          <Field label="Alimentare">
            <Select<SupplyType>
              value={project.supply}
              options={[
                { value: "necunoscut", label: "Necunoscuta" },
                { value: "monofazat", label: "Monofazata" },
                { value: "trifazat", label: "Trifazata" },
              ]}
              onChange={(v) => update((p) => ({ ...p, supply: v }))}
            />
          </Field>
          <Field label="Faza ofertare">
            <Select value="la-rosu" options={[{ value: "la-rosu", label: "Faza 1 — la rosu" }]} onChange={() => {}} />
          </Field>
        </div>
        <Field label="Observatii">
          <textarea
            className="mt-1 min-h-24 w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            value={project.notes ?? ""}
            onChange={(e) => update((p) => ({ ...p, notes: e.target.value }))}
          />
        </Field>
      </Card>
      <Card title="Beneficiar">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nume / firma">
            <TextInput value={project.client.name} onChange={(v) => setClient({ name: v })} />
          </Field>
          <Field label="Telefon">
            <TextInput value={project.client.phone ?? ""} onChange={(v) => setClient({ phone: v })} />
          </Field>
          <Field label="E-mail">
            <TextInput value={project.client.email ?? ""} onChange={(v) => setClient({ email: v })} />
          </Field>
          <Field label="Localitate">
            <TextInput value={project.client.locality ?? ""} onChange={(v) => setClient({ locality: v })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Adresa lucrare">
              <TextInput value={project.client.address ?? ""} onChange={(v) => setClient({ address: v })} />
            </Field>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Datele se pastreaza doar in acest browser. Foloseste „Export JSON” pentru copii de siguranta.
        </p>
      </Card>
    </div>
  );
}

function PowerCard({
  project,
  pricing,
  update,
}: {
  project: Project;
  pricing: PricingSettings;
  update: (fn: (p: Project) => Project) => void;
}) {
  const In = project.mainBreakerA;
  const isStandard = In != null && STANDARD_BREAKERS.includes(In);
  const [custom, setCustom] = useState(In != null && !isStandard);
  const phases = supplyPhases(project.supply);
  const cos = project.cosPhi ?? 1;
  const pMax = In && phases ? powerKw(phases, In, cos) : null;
  const pMotor = In && phases ? powerKw(phases, In, 0.85) : null;
  const pInst = installedPowerKw(projectCircuits(project, pricing));
  const ks = pMax && pInst > 0 ? pMax / pInst : null;

  return (
    <Card title="Alimentare si putere" className="lg:col-span-2">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Siguranta generala (A)" hint="Siguranta bransamentului / contorului">
            <Select
              value={custom ? "alta" : In != null ? String(In) : ""}
              options={[
                { value: "", label: "— nesetata —" },
                ...STANDARD_BREAKERS.map((a) => ({ value: String(a), label: `${a} A` })),
                { value: "alta", label: "Alta valoare…" },
              ]}
              onChange={(v) => {
                if (v === "alta") return setCustom(true);
                setCustom(false);
                update((p) => ({ ...p, mainBreakerA: v ? Number(v) : undefined }));
              }}
            />
          </Field>
          {custom ? (
            <Field label="Valoare (A)">
              <NumberInput
                value={In ?? null}
                min={1}
                placeholder="ex. 35"
                onChange={(v) => update((p) => ({ ...p, mainBreakerA: v && v > 0 ? v : undefined }))}
              />
            </Field>
          ) : (
            <div />
          )}
          <Field label="cos φ" hint="1 pentru calculul puterii maxime absorbite (uzual)">
            <NumberInput
              value={cos}
              step={0.01}
              min={0.5}
              onChange={(v) => update((p) => ({ ...p, cosPhi: v && v > 0 && v <= 1 ? v : 1 }))}
            />
          </Field>
          <Field label="Alimentare">
            <div className="py-1.5 text-sm text-slate-700">
              {phases === 1 ? "Monofazata · 230 V" : phases === 3 ? "Trifazata · 400 V" : "Necunoscuta — seteaza mai sus"}
            </div>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Big
            label="Putere maxima absorbita"
            value={pMax != null ? `${num(pMax, 2)} kW` : "—"}
            note={
              pMax != null
                ? phases === 3
                  ? `√3 × 400 V × ${In} A × ${num(cos, 2)}`
                  : `230 V × ${In} A × ${num(cos, 2)}`
                : "necesita siguranta generala si tipul alimentarii"
            }
            strong
          />
          <Big label="La motoare (cos φ 0,85)" value={pMotor != null ? `${num(pMotor, 2)} kW` : "—"} />
          <Big
            label="Putere instalata (estimata)"
            value={`${num(pInst, 2)} kW`}
            note={ks != null ? `simultaneitate necesara ks = ${num(ks, 2)}` : "din circuitele generate"}
          />
        </div>
      </div>
    </Card>
  );
}

function Big({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${strong ? "bg-amber-50 ring-1 ring-amber-200" : "bg-slate-50"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}
    </div>
  );
}
