"use client";

import type { BuildingType, Project, SupplyType } from "@/lib/engine";
import { Card, Field, Select, TextInput } from "./ui";

export function ProjectTab({ project, update }: { project: Project; update: (fn: (p: Project) => Project) => void }) {
  const setClient = (patch: Partial<Project["client"]>) =>
    update((p) => ({ ...p, client: { ...p.client, ...patch } }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Proiect">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cod proiect">
            <TextInput value={project.code} onChange={(v) => update((p) => ({ ...p, code: v }))} />
          </Field>
          <Field label="Denumire">
            <TextInput value={project.name} onChange={(v) => update((p) => ({ ...p, name: v }))} />
          </Field>
          <Field label="Tip clădire">
            <Select<BuildingType>
              value={project.buildingType}
              options={[
                { value: "casa", label: "Casă" },
                { value: "apartament", label: "Apartament" },
                { value: "comercial", label: "Spațiu comercial" },
              ]}
              onChange={(v) => update((p) => ({ ...p, buildingType: v }))}
            />
          </Field>
          <Field label="Alimentare">
            <Select<SupplyType>
              value={project.supply}
              options={[
                { value: "necunoscut", label: "Necunoscută" },
                { value: "monofazat", label: "Monofazată" },
                { value: "trifazat", label: "Trifazată" },
              ]}
              onChange={(v) => update((p) => ({ ...p, supply: v }))}
            />
          </Field>
          <Field label="Fază ofertare">
            <Select value="la-rosu" options={[{ value: "la-rosu", label: "Faza 1 — la roșu" }]} onChange={() => {}} />
          </Field>
        </div>
        <Field label="Observații">
          <textarea
            className="mt-1 min-h-24 w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            value={project.notes ?? ""}
            onChange={(e) => update((p) => ({ ...p, notes: e.target.value }))}
          />
        </Field>
      </Card>
      <Card title="Beneficiar">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nume / firmă">
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
            <Field label="Adresă lucrare">
              <TextInput value={project.client.address ?? ""} onChange={(v) => setClient({ address: v })} />
            </Field>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Datele se păstrează doar în acest browser. Folosește „Export JSON” pentru copii de siguranță.
        </p>
      </Card>
    </div>
  );
}
