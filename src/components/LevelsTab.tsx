"use client";

import {
  POINT_KINDS,
  POINT_LABELS,
  computeInventory,
  newLevel,
  newRoom,
  pointsTotal,
  roomRoute,
  type Level,
  type LevelKind,
  type PricingSettings,
  type Project,
  type Room,
} from "@/lib/engine";
import { Badge, Button, Card, NumberInput, Select, TextInput, num } from "./ui";

const LEVEL_KINDS: { value: LevelKind; label: string }[] = [
  { value: "subsol", label: "Subsol" },
  { value: "parter", label: "Parter" },
  { value: "etaj", label: "Etaj" },
  { value: "mansarda", label: "Mansarda" },
  { value: "anexa", label: "Anexa (garaj, foisor…)" },
];

const SHORT: Record<string, string> = {
  priza: "Prize",
  intrerupator: "Intrer.",
  iluminat: "Ilum.",
  dedicat: "Dedicat",
  jonctiune: "Legatura",
};

export function LevelsTab({
  project,
  pricing,
  update,
}: {
  project: Project;
  pricing: PricingSettings;
  update: (fn: (p: Project) => Project) => void;
}) {
  const inv = computeInventory(project, pricing.defaultRouteMPerPoint);

  const setLevel = (id: string, fn: (l: Level) => Level) =>
    update((p) => ({ ...p, levels: p.levels.map((l) => (l.id === id ? fn(l) : l)) }));
  const setRoom = (levelId: string, roomId: string, fn: (r: Room) => Room) =>
    setLevel(levelId, (l) => ({ ...l, rooms: l.rooms.map((r) => (r.id === roomId ? fn(r) : r)) }));

  return (
    <div className="flex flex-col gap-4">
      <Card title="Total proiect">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-7">
          {POINT_KINDS.map((k) => (
            <Stat key={k} label={POINT_LABELS[k]} value={num(inv.points[k], 0)} />
          ))}
          <Stat label="Total doze" value={num(inv.pointsTotal, 0)} strong />
          <Stat
            label="Trasee (m)"
            value={num(inv.routeM.total)}
            note={inv.routeM.estimated > 0 ? `${num(inv.routeM.estimated)} m estimati` : "toti masurati"}
          />
        </div>
      </Card>

      {project.levels.map((lvl) => {
        const li = inv.levels.find((x) => x.levelId === lvl.id);
        return (
          <Card
            key={lvl.id}
            title={
              <div className="flex flex-wrap items-center gap-2">
                <TextInput
                  value={lvl.name}
                  onChange={(v) => setLevel(lvl.id, (l) => ({ ...l, name: v }))}
                  className="w-40 font-semibold"
                />
                <Select
                  value={lvl.kind}
                  options={LEVEL_KINDS}
                  onChange={(v) => setLevel(lvl.id, (l) => ({ ...l, kind: v }))}
                  className="w-44"
                />
                <Select
                  value={lvl.panelId ?? ""}
                  options={[
                    { value: "", label: "— tablou —" },
                    ...project.panels.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                  onChange={(v) => setLevel(lvl.id, (l) => ({ ...l, panelId: v || undefined }))}
                  className="w-44"
                />
                {li && (
                  <span className="text-xs font-normal text-slate-500">
                    {li.pointsTotal} doze · {num(li.routeM.total)} m trasee
                  </span>
                )}
              </div>
            }
            actions={
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm(`Stergi nivelul „${lvl.name}" cu toate incaperile?`))
                    update((p) => ({ ...p, levels: p.levels.filter((l) => l.id !== lvl.id) }));
                }}
              >
                Sterge nivel
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2">Incapere</th>
                    {POINT_KINDS.map((k) => (
                      <th key={k} className="w-20 px-1 py-2" title={POINT_LABELS[k]}>
                        {SHORT[k]}
                      </th>
                    ))}
                    <th className="w-20 px-1 py-2">LED (m)</th>
                    <th className="w-24 px-1 py-2">Traseu (m)</th>
                    <th className="w-28 px-1 py-2">Sursa</th>
                    <th className="w-16 px-1 py-2 text-right">Doze</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lvl.rooms.map((room) => {
                    const route = roomRoute(room, pricing.defaultRouteMPerPoint);
                    const measured = !!room.routeM && room.routeM.value > 0;
                    return (
                      <tr key={room.id} className="border-b border-slate-100 align-middle">
                        <td className="py-1.5 pr-2">
                          <TextInput
                            value={room.name}
                            onChange={(v) => setRoom(lvl.id, room.id, (r) => ({ ...r, name: v }))}
                          />
                        </td>
                        {POINT_KINDS.map((k) => (
                          <td key={k} className="px-1 py-1.5">
                            <NumberInput
                              ariaLabel={`${POINT_LABELS[k]} ${room.name}`}
                              value={room.points[k] || null}
                              placeholder="0"
                              onChange={(v) =>
                                setRoom(lvl.id, room.id, (r) => ({
                                  ...r,
                                  points: { ...r.points, [k]: Math.max(0, Math.round(v ?? 0)) },
                                }))
                              }
                            />
                          </td>
                        ))}
                        <td className="px-1 py-1.5">
                          <NumberInput
                            ariaLabel={`Banda LED ${room.name}`}
                            value={room.ledStripM || null}
                            placeholder="0"
                            step={0.5}
                            onChange={(v) => setRoom(lvl.id, room.id, (r) => ({ ...r, ledStripM: Math.max(0, v ?? 0) }))}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <NumberInput
                            ariaLabel={`Traseu ${room.name}`}
                            value={measured ? room.routeM!.value : null}
                            placeholder={`~${num(route.total, 0)}`}
                            step={0.5}
                            onChange={(v) =>
                              setRoom(lvl.id, room.id, (r) => ({
                                ...r,
                                routeM: v && v > 0 ? { value: v, source: r.routeM?.source ?? "masurat" } : undefined,
                              }))
                            }
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          {measured ? (
                            <Select
                              value={room.routeM!.source}
                              options={[
                                { value: "masurat", label: "Masurat" },
                                { value: "estimat", label: "Estimat" },
                              ]}
                              onChange={(v) =>
                                setRoom(lvl.id, room.id, (r) => ({ ...r, routeM: { ...r.routeM!, source: v } }))
                              }
                            />
                          ) : (
                            <Badge tone="warn">auto-estimat</Badge>
                          )}
                        </td>
                        <td className="px-1 py-1.5 text-right font-medium tabular-nums">
                          {pointsTotal(room.points)}
                        </td>
                        <td className="py-1.5 text-right">
                          <Button
                            variant="danger"
                            title="Sterge incaperea"
                            onClick={() =>
                              setLevel(lvl.id, (l) => ({ ...l, rooms: l.rooms.filter((r) => r.id !== room.id) }))
                            }
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
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  setLevel(lvl.id, (l) => ({ ...l, rooms: [...l.rooms, newRoom(`Incapere ${l.rooms.length + 1}`)] }))
                }
              >
                + Incapere
              </Button>
            </div>
          </Card>
        );
      })}

      <div className="flex flex-wrap gap-2">
        {LEVEL_KINDS.map((k) => (
          <Button
            key={k.value}
            variant="secondary"
            onClick={() => update((p) => ({ ...p, levels: [...p.levels, newLevel(k.value)] }))}
          >
            + {k.label.split(" ")[0]}
          </Button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Traseul lasat gol se estimeaza automat: numar de doze × {num(pricing.defaultRouteMPerPoint)} m (setabil in
        Tarife). Valorile estimate sunt marcate ca atare in deviz.
      </p>
    </div>
  );
}

function Stat({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${strong ? "bg-amber-50" : "bg-slate-50"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-slate-900">{value}</div>
      {note && <div className="text-xs text-slate-500">{note}</div>}
    </div>
  );
}
