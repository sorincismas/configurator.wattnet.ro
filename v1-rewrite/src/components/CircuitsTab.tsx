"use client";

import {
  CIRCUIT_KINDS,
  CIRCUIT_KIND_LABELS,
  STANDARD_BREAKERS,
  STANDARD_SECTIONS,
  getRules,
  installedPowerKw,
  orderPanels,
  projectCircuits,
  type Circuit,
  type CircuitOverride,
  type Curve,
  type PricingSettings,
  type Project,
} from "@/lib/engine";
import { Badge, Button, Card, NumberInput, Select, TextInput, num } from "./ui";

export function CircuitsTab({
  project,
  pricing,
  update,
}: {
  project: Project;
  pricing: PricingSettings;
  update: (fn: (p: Project) => Project) => void;
}) {
  const rules = getRules(pricing);
  const circuits = projectCircuits(project, pricing);
  const mounted = new Set(project.panels.flatMap((p) => p.devices.map((d) => d.circuitId).filter(Boolean)));

  const setOv = (id: string, patch: Partial<CircuitOverride>) =>
    update((p) => {
      const all = { ...(p.circuitOverrides ?? {}) };
      const next: CircuitOverride = { ...all[id], ...patch };
      for (const k of Object.keys(next) as (keyof CircuitOverride)[]) {
        if (next[k] === undefined || next[k] === "") delete next[k];
      }
      if (Object.keys(next).length) all[id] = next;
      else delete all[id];
      return { ...p, circuitOverrides: all };
    });
  const reset = (c: Circuit) =>
    update((p) => {
      const all = { ...(p.circuitOverrides ?? {}) };
      const keepMerge = all[c.id]?.mergeInto;
      delete all[c.id];
      if (keepMerge) all[c.id] = { mergeInto: keepMerge };
      return { ...p, circuitOverrides: all };
    });
  const unmerge = (c: Circuit) =>
    update((p) => {
      const all = { ...(p.circuitOverrides ?? {}) };
      for (const id of c.merged) {
        if (!all[id]) continue;
        const { mergeInto: _drop, ...rest } = all[id];
        void _drop;
        if (Object.keys(rest).length) all[id] = rest;
        else delete all[id];
      }
      return { ...p, circuitOverrides: all };
    });

  const groups = [
    ...orderPanels(project.panels).map((p) => ({ id: p.id as string | undefined, name: p.name })),
    { id: undefined, name: "Fara tablou" },
  ]
    .map((g) => ({ ...g, list: circuits.filter((c) => c.panelId === g.id) }))
    .filter((g) => g.list.length);

  const total = installedPowerKw(circuits);

  return (
    <div className="flex flex-col gap-4">
      <Card title="Circuite generate">
        <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Total circuite" value={String(circuits.length)} strong />
          {CIRCUIT_KINDS.map((k) => (
            <Stat key={k} label={CIRCUIT_KIND_LABELS[k]} value={String(circuits.filter((c) => c.kind === k).length)} />
          ))}
          <Stat label="Putere instalata" value={`${num(total, 2)} kW`} />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Circuitele se genereaza din dozele introduse: iluminat {rules.lightingGrouping === "nivel" ? "pe nivel" : "pe incapere"} (max{" "}
          {rules.maxLightPointsPerCircuit} puncte), prize pe incapere (max {rules.maxSocketsPerCircuit} prize), un circuit pentru
          fiecare circuit dedicat marcat in incapere (tab-ul Niveluri &amp; doze). Orice valoare modificata aici se pastreaza (marcata cu •); „↺”
          revine la valoarea generata. „Comaseaza in” pune circuitul pe acelasi aparat cu altul. Limitele se schimba in Tarife &
          setari.
        </p>
      </Card>

      {groups.map((g) => (
        <Card key={g.id ?? "none"} title={`${g.name} · ${g.list.length} circuite · ${num(installedPowerKw(g.list), 2)} kW`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="w-8 py-2">Nr</th>
                  <th className="w-28 py-2">Cod</th>
                  <th className="py-2 pr-2">Denumire</th>
                  <th className="w-16 py-2">Puncte</th>
                  <th className="w-24 px-1 py-2">In (A)</th>
                  <th className="w-16 px-1 py-2">Curba</th>
                  <th className="w-16 px-1 py-2">Poli</th>
                  <th className="w-24 px-1 py-2">Cablu</th>
                  <th className="w-20 px-1 py-2">L (m)</th>
                  <th className="w-20 px-1 py-2">P (kW)</th>
                  <th className="w-20 py-2 text-right">ΔU</th>
                  <th className="w-36 px-1 py-2">Tablou</th>
                  <th className="w-40 px-1 py-2">Comaseaza in</th>
                  <th className="w-36 py-2">Stare</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {g.list.map((c) => {
                  const o = project.circuitOverrides?.[c.id] ?? {};
                  const mark = (k: keyof CircuitOverride) => (c.overridden.includes(k) ? "•" : "");
                  const limit =
                    c.kind === "prize" ? rules.maxSocketsPerCircuit : c.kind === "iluminat" ? rules.maxLightPointsPerCircuit : null;
                  const overPts = limit != null && c.points > limit;
                  const overIz = c.iz != null && c.ratedA > c.iz;
                  const overDu = c.dropPct != null && c.dropPct > c.dropLimitPct;
                  const targets = circuits.filter((x) => x.id !== c.id && x.panelId === c.panelId && x.kind === c.kind);
                  return (
                    <tr key={c.id} className="border-b border-slate-100 align-middle">
                      <td className="py-1.5 tabular-nums text-slate-400">{c.order}</td>
                      <td className="py-1.5 font-mono text-xs font-semibold text-slate-800">
                        {c.code}
                        <div className="font-sans text-[10px] font-normal text-slate-400">{CIRCUIT_KIND_LABELS[c.kind]}</div>
                      </td>
                      <td className="py-1.5 pr-2">
                        <TextInput value={o.name ?? c.name} onChange={(v) => setOv(c.id, { name: v })} />
                      </td>
                      <td className={`py-1.5 tabular-nums ${overPts ? "font-bold text-red-700" : ""}`}>
                        {c.points}
                        {c.merged.length > 0 && (
                          <button className="ml-1 text-xs text-amber-700 underline" onClick={() => unmerge(c)} title="Separa circuitele comasate">
                            +{c.merged.length} separa
                          </button>
                        )}
                      </td>
                      <td className="px-1 py-1.5">
                        <Select
                          value={String(c.ratedA)}
                          options={withValue(STANDARD_BREAKERS, c.ratedA).map((a) => ({ value: String(a), label: `${a}${mark("ratedA")}` }))}
                          onChange={(v) => setOv(c.id, { ratedA: Number(v) })}
                          className={overIz ? "border-red-400 text-red-700" : ""}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Select<Curve>
                          value={c.curve}
                          options={(["B", "C", "D"] as const).map((x) => ({ value: x, label: `${x}${mark("curve")}` }))}
                          onChange={(v) => setOv(c.id, { curve: v })}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Select
                          value={String(c.poles)}
                          options={["1", "2", "3", "4"].map((x) => ({ value: x, label: `${x}P${mark("poles")}` }))}
                          onChange={(v) => setOv(c.id, { poles: Number(v) as 1 | 2 | 3 | 4 })}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Select
                          value={String(c.sectionMm2)}
                          options={withValue(STANDARD_SECTIONS, c.sectionMm2).map((x) => ({
                            value: String(x),
                            label: `${c.phases === 3 ? 5 : 3}×${String(x).replace(".", ",")}${mark("sectionMm2")}`,
                          }))}
                          onChange={(v) => setOv(c.id, { sectionMm2: Number(v) })}
                          className={overIz ? "border-red-400 text-red-700" : ""}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <NumberInput
                          ariaLabel={`Lungime ${c.code}`}
                          value={o.lengthM ?? null}
                          placeholder={`~${num(c.lengthM, 0)}`}
                          step={0.5}
                          onChange={(v) => setOv(c.id, { lengthM: v ?? undefined })}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <NumberInput
                          ariaLabel={`Putere ${c.code}`}
                          value={o.powerKw ?? null}
                          placeholder={num(c.powerKw, 2)}
                          step={0.1}
                          onChange={(v) => setOv(c.id, { powerKw: v ?? undefined })}
                        />
                      </td>
                      <td className={`py-1.5 text-right tabular-nums ${overDu ? "font-bold text-red-700" : "text-slate-700"}`}>
                        {c.dropPct == null ? "—" : `${num(c.dropPct, 2)} %`}
                        {c.lengthEstimated && <div className="text-[10px] font-normal text-amber-700">L estimat</div>}
                      </td>
                      <td className="px-1 py-1.5">
                        <Select
                          value={c.panelId ?? ""}
                          options={[
                            ...(c.panelId ? [] : [{ value: "", label: "—" }]),
                            ...project.panels.map((p) => ({ value: p.id, label: `${p.name}${mark("panelId")}` })),
                          ]}
                          onChange={(v) => setOv(c.id, { panelId: v || undefined })}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Select
                          value=""
                          options={[
                            { value: "", label: targets.length ? "—" : "— (niciun circuit similar)" },
                            ...targets.map((t) => ({ value: t.id, label: t.code })),
                          ]}
                          onChange={(v) => v && setOv(c.id, { mergeInto: v })}
                        />
                      </td>
                      <td className="py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {overPts && <Badge tone="bad">{c.points}/{limit} pct.</Badge>}
                          {overIz && <Badge tone="bad">In &gt; Iz {num(c.iz ?? 0)}</Badge>}
                          {overDu && <Badge tone="bad">ΔU &gt; {num(c.dropLimitPct)}%</Badge>}
                          {!c.panelAssigned && <Badge tone="warn">tablou provizoriu</Badge>}
                          {mounted.has(c.id) ? <Badge tone="ok">montat</Badge> : <Badge tone="warn">nemontat</Badge>}
                        </div>
                      </td>
                      <td className="py-1.5 text-right">
                        {c.overridden.some((k) => k !== "mergeInto") && (
                          <Button variant="ghost" title="Revino la valorile generate" onClick={() => reset(c)}>
                            ↺
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {circuits.length === 0 && (
        <Card>
          <p className="text-sm text-slate-600">Nu exista circuite: adauga doze in tab-ul Niveluri &amp; doze.</p>
        </Card>
      )}
    </div>
  );
}

function withValue(list: number[], v: number) {
  return list.includes(v) ? list : [...list, v].sort((a, b) => a - b);
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${strong ? "bg-amber-50" : "bg-slate-50"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}
