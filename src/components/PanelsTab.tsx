"use client";

import {
  DEVICE_LABELS,
  STANDARD_BREAKERS,
  addCircuitDevices,
  cascadeDepth,
  deviceForCircuit,
  layoutPanel,
  newDevice,
  newPanel,
  orderPanels,
  projectCircuits,
  suggestBreakers,
  type Circuit,
  type Curve,
  type DeviceKind,
  type Panel,
  type PanelDevice,
  type PricingSettings,
  type Project,
  type RcdType,
} from "@/lib/engine";
import { PanelSvg } from "./PanelSvg";
import { Badge, Button, Card, Field, NumberInput, Select, TextInput, num } from "./ui";

const KINDS = Object.entries(DEVICE_LABELS).map(([value, label]) => ({ value: value as DeviceKind, label }));
const HAS_CURVE = new Set<DeviceKind>(["MCB", "RCBO"]);
const HAS_RCD = new Set<DeviceKind>(["RCD", "RCBO"]);
const CAN_BE_UNDER_RCD = new Set<DeviceKind>(["MCB", "releu", "contactor", "sonerie-sursa", "altul"]);

export function PanelsTab({
  project,
  pricing,
  update,
}: {
  project: Project;
  pricing: PricingSettings;
  update: (fn: (p: Project) => Project) => void;
}) {
  const circuits = projectCircuits(project, pricing);
  const setPanel = (id: string, fn: (p: Panel) => Panel) =>
    update((p) => ({ ...p, panels: p.panels.map((x) => (x.id === id ? fn(x) : x)) }));
  const setDevice = (panelId: string, devId: string, fn: (d: PanelDevice) => PanelDevice) =>
    setPanel(panelId, (p) => ({ ...p, devices: p.devices.map((d) => (d.id === devId ? fn(d) : d)) }));
  const moveDevice = (panelId: string, idx: number, dir: -1 | 1) =>
    setPanel(panelId, (p) => {
      const devices = [...p.devices];
      const j = idx + dir;
      if (j < 0 || j >= devices.length) return p;
      [devices[idx], devices[j]] = [devices[j], devices[idx]];
      return { ...p, devices };
    });
  const setMain = (panelId: string, devId: string, on: boolean) =>
    setPanel(panelId, (p) => ({
      ...p,
      devices: p.devices.map((d) => (d.id === devId ? { ...d, isMain: on } : on ? { ...d, isMain: false } : d)),
    }));

  const ordered = orderPanels(project.panels);

  return (
    <div className="flex flex-col gap-4">
      {ordered.map((panel) => {
        const lay = layoutPanel(panel);
        const depth = cascadeDepth(panel, project.panels);
        const own = circuits.filter((c) => c.panelId === panel.id);
        const rcds = panel.devices.filter((d) => d.kind === "RCD");
        const children = project.panels.filter((p) => p.parentPanelId === panel.id);
        const parentOptions = [
          { value: "", label: "— principal (alimentat din retea) —" },
          ...project.panels
            .filter((p) => p.id !== panel.id)
            .map((p) => ({ value: p.id, label: `din ${p.name}` })),
        ];
        return (
          <Card
            key={panel.id}
            className={depth > 0 ? "border-l-4 border-l-amber-400" : ""}
            title={
              <span className="flex items-center gap-2">
                {depth > 0 && <span className="text-slate-400">{"↳".repeat(depth)}</span>}
                {panel.name}
                <Badge tone={lay.overflow ? "bad" : lay.capacity ? "ok" : "warn"}>
                  {lay.used}/{lay.capacity} module
                </Badge>
              </span>
            }
            actions={
              <Button
                variant="danger"
                onClick={() => {
                  if (!confirm(`Stergi „${panel.name}"? Tablourile alimentate din el devin principale.`)) return;
                  update((p) => ({
                    ...p,
                    panels: p.panels
                      .filter((x) => x.id !== panel.id)
                      .map((x) => ({
                        ...(x.parentPanelId === panel.id ? { ...x, parentPanelId: undefined } : x),
                        devices: x.devices.map((d) => (d.feedsPanelId === panel.id ? { ...d, feedsPanelId: undefined } : d)),
                      })),
                    levels: p.levels.map((l) => (l.panelId === panel.id ? { ...l, panelId: undefined } : l)),
                  }));
                }}
              >
                Sterge tablou
              </Button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Denumire">
                <TextInput value={panel.name} onChange={(v) => setPanel(panel.id, (p) => ({ ...p, name: v }))} />
              </Field>
              <Field label="Alimentare">
                <Select
                  value={panel.parentPanelId ?? ""}
                  options={parentOptions}
                  onChange={(v) => setPanel(panel.id, (p) => ({ ...p, parentPanelId: v || undefined }))}
                />
              </Field>
              <Field label="Randuri (sine DIN)">
                <NumberInput
                  value={panel.rows}
                  min={1}
                  onChange={(v) => setPanel(panel.id, (p) => ({ ...p, rows: Math.max(1, Math.round(v ?? 1)) }))}
                />
              </Field>
              <Field label="Module / rand">
                <NumberInput
                  value={panel.modulesPerRow}
                  min={1}
                  onChange={(v) =>
                    setPanel(panel.id, (p) => ({ ...p, modulesPerRow: Math.max(1, Math.round(v ?? 1)) }))
                  }
                />
              </Field>
              {panel.parentPanelId && (
                <Field label="Cablu alimentare (m)" hint="Din tabloul parinte">
                  <div className="flex gap-1">
                    <NumberInput
                      value={panel.feederM?.value ?? null}
                      step={0.5}
                      placeholder="lipsa"
                      onChange={(v) =>
                        setPanel(panel.id, (p) => ({
                          ...p,
                          feederM: v && v > 0 ? { value: v, source: p.feederM?.source ?? "estimat" } : undefined,
                        }))
                      }
                    />
                    {panel.feederM && (
                      <Select
                        value={panel.feederM.source}
                        className="w-28"
                        options={[
                          { value: "estimat", label: "Estimat" },
                          { value: "masurat", label: "Masurat" },
                        ]}
                        onChange={(v) =>
                          setPanel(panel.id, (p) => ({ ...p, feederM: { ...p.feederM!, source: v } }))
                        }
                      />
                    )}
                  </div>
                </Field>
              )}
            </div>

            <Suggestions
              panel={panel}
              circuits={circuits}
              onAdd={(list) => setPanel(panel.id, (p) => addCircuitDevices(p, list))}
              onSync={(dev, c) =>
                setDevice(panel.id, dev.id, (d) => ({ ...d, ratedA: c.ratedA, curve: c.curve, poles: c.poles, modules: Math.max(d.modules, c.poles) }))
              }
              onRemove={(dev) => setPanel(panel.id, (p) => ({ ...p, devices: p.devices.filter((x) => x.id !== dev.id) }))}
            />

            <div className="my-4 overflow-x-auto rounded-lg bg-slate-50 p-2">
              <PanelSvg panel={panel} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="w-8 py-2">#</th>
                    <th className="w-52 px-1 py-2">Aparat</th>
                    <th className="px-1 py-2">Circuit / functie</th>
                    <th className="w-24 px-1 py-2">In (A)</th>
                    <th className="w-40 px-1 py-2">Curba / IΔn / tip</th>
                    <th className="w-44 px-1 py-2">Circuit / alimenteaza</th>
                    <th className="w-36 px-1 py-2">Sub RCD</th>
                    <th className="w-16 px-1 py-2">Poli</th>
                    <th className="w-16 px-1 py-2">Module</th>
                    <th className="w-16 px-1 py-2">Sina</th>
                    <th className="w-32 px-1 py-2">Observatii</th>
                    <th className="w-28" />
                  </tr>
                </thead>
                <tbody>
                  {panel.devices.map((d, idx) => {
                    const link = d.feedsPanelId ? `p:${d.feedsPanelId}` : d.circuitId ? `c:${d.circuitId}` : "";
                    const linkOptions = [
                      { value: "", label: "—" },
                      ...own.map((c) => ({ value: `c:${c.id}`, label: `${c.code} · ${c.name}` })),
                      ...children.map((p) => ({ value: `p:${p.id}`, label: `→ ${p.name}` })),
                    ];
                    if (link && !linkOptions.some((o) => o.value === link))
                      linkOptions.push({ value: link, label: "(circuit inexistent)" });
                    return (
                      <tr key={d.id} className="border-b border-slate-100 align-top">
                        <td className="py-1.5 text-slate-400 tabular-nums">{idx + 1}</td>
                        <td className="px-1 py-1.5">
                          <Select value={d.kind} options={KINDS} onChange={(v) => setDevice(panel.id, d.id, (x) => ({ ...x, kind: v }))} />
                          {(d.kind === "separator" || d.kind === "MCB" || d.kind === "RCD") && (
                            <label className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-amber-500"
                                checked={!!d.isMain}
                                onChange={(e) => setMain(panel.id, d.id, e.target.checked)}
                              />
                              aparat general al tabloului
                            </label>
                          )}
                        </td>
                        <td className="px-1 py-1.5">
                          <TextInput
                            value={d.label}
                            placeholder="ex. Prize bucatarie"
                            onChange={(v) => setDevice(panel.id, d.id, (x) => ({ ...x, label: v }))}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <NumberInput
                            ariaLabel={`In ${d.label}`}
                            value={d.ratedA ?? null}
                            placeholder="A"
                            min={0.5}
                            step={1}
                            onChange={(v) => setDevice(panel.id, d.id, (x) => ({ ...x, ratedA: v && v > 0 ? v : undefined }))}
                          />
                          <QuickAmps
                            value={d.ratedA}
                            onPick={(a) => setDevice(panel.id, d.id, (x) => ({ ...x, ratedA: a }))}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <div className="flex gap-1">
                            {HAS_CURVE.has(d.kind) && (
                              <Select<Curve | "">
                                value={d.curve ?? ""}
                                className="w-16"
                                options={[
                                  { value: "", label: "—" },
                                  { value: "B", label: "B" },
                                  { value: "C", label: "C" },
                                  { value: "D", label: "D" },
                                ]}
                                onChange={(v) => setDevice(panel.id, d.id, (x) => ({ ...x, curve: v || undefined }))}
                              />
                            )}
                            {HAS_RCD.has(d.kind) && (
                              <>
                                <Select
                                  value={String(d.sensitivityMa ?? "")}
                                  className="w-20"
                                  options={[
                                    { value: "", label: "mA" },
                                    ...["10", "30", "100", "300"].map((v) => ({ value: v, label: `${v}mA` })),
                                  ]}
                                  onChange={(v) => setDevice(panel.id, d.id, (x) => ({ ...x, sensitivityMa: v ? Number(v) : undefined }))}
                                />
                                <Select<RcdType | "">
                                  value={d.rcdType ?? ""}
                                  className="w-16"
                                  options={[
                                    { value: "", label: "tip" },
                                    { value: "AC", label: "AC" },
                                    { value: "A", label: "A" },
                                    { value: "F", label: "F" },
                                    { value: "B", label: "B" },
                                  ]}
                                  onChange={(v) => setDevice(panel.id, d.id, (x) => ({ ...x, rcdType: v || undefined }))}
                                />
                              </>
                            )}
                            {!HAS_CURVE.has(d.kind) && !HAS_RCD.has(d.kind) && <span className="py-1.5 text-xs text-slate-400">—</span>}
                          </div>
                        </td>
                        <td className="px-1 py-1.5">
                          {d.kind !== "RCD" && d.kind !== "SPD" && !d.isMain ? (
                            <Select
                              value={link}
                              options={linkOptions}
                              onChange={(v) =>
                                setDevice(panel.id, d.id, (x) => ({
                                  ...x,
                                  circuitId: v.startsWith("c:") ? v.slice(2) : undefined,
                                  feedsPanelId: v.startsWith("p:") ? v.slice(2) : undefined,
                                }))
                              }
                            />
                          ) : (
                            <span className="py-1.5 text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-1 py-1.5">
                          {CAN_BE_UNDER_RCD.has(d.kind) && !d.isMain ? (
                            <Select
                              value={d.upstreamRcdId && rcds.some((r) => r.id === d.upstreamRcdId) ? d.upstreamRcdId : ""}
                              options={[
                                { value: "", label: rcds.length ? "— direct —" : "— (fara RCD)" },
                                ...rcds.map((r) => ({ value: r.id, label: r.label || `RCD ${r.ratedA ?? ""}A` })),
                              ]}
                              onChange={(v) => setDevice(panel.id, d.id, (x) => ({ ...x, upstreamRcdId: v || undefined }))}
                            />
                          ) : (
                            <span className="py-1.5 text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-1 py-1.5">
                          <Select
                            value={String(d.poles) as "1" | "2" | "3" | "4"}
                            options={["1", "2", "3", "4"].map((v) => ({ value: v as "1", label: `${v}P` }))}
                            onChange={(v) => setDevice(panel.id, d.id, (x) => ({ ...x, poles: Number(v) as 1 | 2 | 3 | 4 }))}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <NumberInput
                            value={d.modules}
                            min={1}
                            step={0.5}
                            onChange={(v) => setDevice(panel.id, d.id, (x) => ({ ...x, modules: Math.max(0.5, v ?? 1) }))}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <Select
                            value={String(d.row)}
                            options={Array.from({ length: Math.max(panel.rows, d.row + 1) }, (_, i) => ({
                              value: String(i),
                              label: `${i + 1}`,
                            }))}
                            onChange={(v) => setDevice(panel.id, d.id, (x) => ({ ...x, row: Number(v) }))}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <TextInput
                            value={d.rating ?? ""}
                            placeholder="producator, cod…"
                            onChange={(v) => setDevice(panel.id, d.id, (x) => ({ ...x, rating: v }))}
                          />
                        </td>
                        <td className="py-1.5 text-right whitespace-nowrap">
                          <Button variant="ghost" title="Muta stanga" onClick={() => moveDevice(panel.id, idx, -1)}>
                            ↑
                          </Button>
                          <Button variant="ghost" title="Muta dreapta" onClick={() => moveDevice(panel.id, idx, 1)}>
                            ↓
                          </Button>
                          <Button
                            variant="danger"
                            title="Sterge aparatul"
                            onClick={() => setPanel(panel.id, (p) => ({ ...p, devices: p.devices.filter((x) => x.id !== d.id) }))}
                          >
                            ✕
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ["MCB", "+ Disjunctor 1P", { kind: "MCB", poles: 1, modules: 1 }],
                  ["MCB2", "+ Disjunctor 2P", { kind: "MCB", poles: 2, modules: 2 }],
                  ["MCB3", "+ Disjunctor 3P", { kind: "MCB", poles: 3, modules: 3 }],
                  ["RCD", "+ Diferential", { kind: "RCD", poles: 2, modules: 2, sensitivityMa: 30 }],
                  ["RCBO", "+ RCBO", { kind: "RCBO", poles: 2, modules: 2, sensitivityMa: 30 }],
                  ["SPD", "+ SPD", { kind: "SPD", poles: 2, modules: 2 }],
                  ["SEP", "+ Separator", { kind: "separator", poles: 2, modules: 2 }],
                ] as const
              ).map(([key, label, preset]) => (
                <Button
                  key={key}
                  variant="secondary"
                  onClick={() =>
                    setPanel(panel.id, (p) => {
                      const lastRow = layoutPanel(p).rows.find((r) => r.free >= preset.modules)?.row ?? p.rows - 1;
                      return { ...p, devices: [...p.devices, newDevice({ ...preset, row: lastRow })] };
                    })
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Latimea in module se introduce dupa fisa tehnica a produsului ales. „Aparat general” = aparatul de intrare al
              tabloului (folosit la selectivitate). Pe tabloul parinte, la „Circuit / alimenteaza”, alegi aparatul care
              alimenteaza fiecare tablou secundar.
            </p>
          </Card>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() =>
            update((p) => ({
              ...p,
              panels: [
                ...p.panels,
                newPanel(p.panels.length ? `Tablou secundar ${p.panels.length}` : "Tablou principal", p.panels[0]?.id),
              ],
            }))
          }
        >
          + Tablou {project.panels.length ? "secundar (cascada)" : "principal"}
        </Button>
      </div>
    </div>
  );
}

function QuickAmps({ value, onPick }: { value?: number; onPick: (a: number) => void }) {
  return (
    <select
      aria-label="Valori standard"
      className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-xs text-slate-600"
      value={value != null && STANDARD_BREAKERS.includes(value) ? String(value) : ""}
      onChange={(e) => e.target.value && onPick(Number(e.target.value))}
    >
      <option value="">standard…</option>
      {STANDARD_BREAKERS.map((a) => (
        <option key={a} value={a}>
          {a} A
        </option>
      ))}
    </select>
  );
}

function Suggestions({
  panel,
  circuits,
  onAdd,
  onSync,
  onRemove,
}: {
  panel: Panel;
  circuits: Circuit[];
  onAdd: (list: Circuit[]) => void;
  onSync: (d: PanelDevice, c: Circuit) => void;
  onRemove: (d: PanelDevice) => void;
}) {
  const s = suggestBreakers(panel, circuits);
  const own = circuits.filter((c) => c.panelId === panel.id);
  if (!own.length && !s.stale.length) return null;

  // rezumat pe tipuri: 6× C16 1P, 3× B10 1P ...
  const summary = new Map<string, number>();
  for (const c of own) {
    const k = `${c.curve}${c.ratedA} ${c.poles}P`;
    summary.set(k, (summary.get(k) ?? 0) + 1);
  }
  const modulesNeeded = s.missing.reduce((m, c) => m + deviceForCircuit(c, panel).modules, 0);
  const lay = layoutPanel(panel);

  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900">Sigurante necesare · {own.length} circuite</div>
          <div className="text-sm text-slate-600">
            {[...summary.entries()].map(([k, n]) => `${n}× ${k}`).join(" · ")}
            {s.missing.length > 0 && (
              <span className={modulesNeeded > lay.free ? "ml-2 font-medium text-red-700" : "ml-2 text-slate-500"}>
                · lipsesc {s.missing.length} ({modulesNeeded} module, {lay.free} libere)
              </span>
            )}
          </div>
        </div>
        {s.missing.length > 0 && <Button onClick={() => onAdd(s.missing)}>Adauga toate lipsa ({s.missing.length})</Button>}
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-amber-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="w-8 py-1">Nr</th>
              <th className="w-28 py-1">Cod</th>
              <th className="py-1">Denumire</th>
              <th className="w-16 py-1 text-right">Puncte</th>
              <th className="w-20 py-1 pl-3">Cablu</th>
              <th className="w-24 py-1">Siguranta</th>
              <th className="w-20 py-1 text-right">P (kW)</th>
              <th className="w-44 py-1 pl-3">Stare</th>
            </tr>
          </thead>
          <tbody>
            {own.map((c) => {
              const inst = s.installed.find((x) => x.circuit.id === c.id);
              return (
                <tr key={c.id} className="border-b border-amber-100">
                  <td className="py-1 tabular-nums text-slate-400">{c.order}</td>
                  <td className="py-1 font-mono text-xs font-semibold">{c.code}</td>
                  <td className="py-1">{c.name}</td>
                  <td className="py-1 text-right tabular-nums">{c.points}</td>
                  <td className="py-1 pl-3">{c.cable}</td>
                  <td className="py-1 font-medium">
                    {c.curve}
                    {c.ratedA} {c.poles}P
                  </td>
                  <td className="py-1 text-right tabular-nums">{num(c.powerKw, 2)}</td>
                  <td className="py-1 pl-3">
                    {!inst ? (
                      <Button variant="secondary" className="px-2! py-0.5! text-xs" onClick={() => onAdd([c])}>
                        + Adauga
                      </Button>
                    ) : inst.mismatch ? (
                      <span className="flex items-center gap-1">
                        <Badge tone="warn">montat {inst.device.curve ?? ""}{inst.device.ratedA ?? "?"} {inst.device.poles}P</Badge>
                        <Button variant="ghost" className="px-1! py-0! text-xs" onClick={() => onSync(inst.device, c)} title="Preia valorile circuitului">
                          actualizeaza
                        </Button>
                      </span>
                    ) : (
                      <Badge tone="ok">montat</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {s.stale.map((d) => (
              <tr key={d.id} className="border-b border-amber-100 text-slate-500">
                <td />
                <td className="py-1 text-xs">—</td>
                <td className="py-1">{d.label || d.kind}</td>
                <td colSpan={4} className="py-1 text-xs">circuitul nu mai exista (doze sterse sau comasate)</td>
                <td className="py-1 pl-3">
                  <Button variant="danger" className="px-2! py-0.5! text-xs" onClick={() => onRemove(d)}>
                    Sterge aparatul
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
