"use client";

import {
  DEVICE_LABELS,
  cascadeDepth,
  layoutPanel,
  newDevice,
  newPanel,
  orderPanels,
  type DeviceKind,
  type Panel,
  type PanelDevice,
  type Project,
} from "@/lib/engine";
import { PanelSvg } from "./PanelSvg";
import { Badge, Button, Card, Field, NumberInput, Select, TextInput } from "./ui";

const KINDS = Object.entries(DEVICE_LABELS).map(([value, label]) => ({ value: value as DeviceKind, label }));

export function PanelsTab({ project, update }: { project: Project; update: (fn: (p: Project) => Project) => void }) {
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

  const ordered = orderPanels(project.panels);

  return (
    <div className="flex flex-col gap-4">
      {ordered.map((panel) => {
        const lay = layoutPanel(panel);
        const depth = cascadeDepth(panel, project.panels);
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
                      .map((x) => (x.parentPanelId === panel.id ? { ...x, parentPanelId: undefined } : x)),
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

            <div className="my-4 overflow-x-auto rounded-lg bg-slate-50 p-2">
              <PanelSvg panel={panel} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="w-8 py-2">#</th>
                    <th className="w-56 px-1 py-2">Aparat</th>
                    <th className="px-1 py-2">Circuit / functie</th>
                    <th className="w-36 px-1 py-2">Caracteristici</th>
                    <th className="w-16 px-1 py-2">Poli</th>
                    <th className="w-16 px-1 py-2">Module</th>
                    <th className="w-16 px-1 py-2">Sina</th>
                    <th className="w-28" />
                  </tr>
                </thead>
                <tbody>
                  {panel.devices.map((d, idx) => (
                    <tr key={d.id} className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-400 tabular-nums">{idx + 1}</td>
                      <td className="px-1 py-1.5">
                        <Select value={d.kind} options={KINDS} onChange={(v) => setDevice(panel.id, d.id, (x) => ({ ...x, kind: v }))} />
                      </td>
                      <td className="px-1 py-1.5">
                        <TextInput
                          value={d.label}
                          placeholder="ex. Prize bucatarie"
                          onChange={(v) => setDevice(panel.id, d.id, (x) => ({ ...x, label: v }))}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <TextInput
                          value={d.rating ?? ""}
                          placeholder="ex. C16 / 40A 30mA"
                          onChange={(v) => setDevice(panel.id, d.id, (x) => ({ ...x, rating: v }))}
                        />
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
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ["MCB", "+ Disjunctor 1P", { kind: "MCB", poles: 1, modules: 1 }],
                  ["MCB2", "+ Disjunctor 2P", { kind: "MCB", poles: 2, modules: 2 }],
                  ["RCD", "+ Diferential", { kind: "RCD", poles: 2, modules: 2 }],
                  ["RCBO", "+ RCBO", { kind: "RCBO", poles: 2, modules: 2 }],
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
              Latimea in module si caracteristicile nominale se introduc dupa fisa tehnica a produsului ales. Aplicatia
              nu le deduce automat.
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
