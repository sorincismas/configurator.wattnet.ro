"use client";

import { Fragment, useState } from "react";
import {
  BOX_SIZES,
  BOX_SIZE_LABELS,
  DEFAULT_BOX_SIZE,
  POINT_KINDS,
  POINT_LABELS,
  STANDARD_BREAKERS,
  STANDARD_SECTIONS,
  WALL_LABELS,
  WALL_TYPES,
  autoRoomCode,
  cableLabel,
  cableSummary,
  computeInventory,
  getRules,
  newDedicated,
  newLevel,
  newRoom,
  pointsTotal,
  projectCircuits,
  roomCables,
  roomRoute,
  type BoxSize,
  type Circuit,
  type Curve,
  type DedicatedCircuit,
  type DedicatedEndpoint,
  type Level,
  type LevelKind,
  type PointKind,
  type PricingSettings,
  type Project,
  type Room,
  type WallType,
} from "@/lib/engine";
import { Badge, Button, Card, NumberInput, Select, TextInput, num } from "./ui";

const LEVEL_KINDS: { value: LevelKind; label: string }[] = [
  { value: "subsol", label: "Subsol" },
  { value: "demisol", label: "Demisol" },
  { value: "parter", label: "Parter" },
  { value: "etaj", label: "Etaj" },
  { value: "mansarda", label: "Mansarda" },
  { value: "anexa", label: "Anexa (garaj, foisor…)" },
];

const SHORT: Record<PointKind, string> = {
  priza: "Prize",
  intrerupator: "Intrer.",
  iluminat: "Ilum.",
  jonctiune: "Legatura",
  termostat: "Termostat",
  alteSurse: "Alte surse",
};

const ENDPOINTS: { value: DedicatedEndpoint; label: string }[] = [
  { value: "priza", label: "doza de priza" },
  { value: "alteSurse", label: "cablu lasat (alte surse)" },
  { value: "jonctiune", label: "doza de legatura" },
];

/** Circuite dedicate uzuale, adaugate cu un clic (valorile se pot schimba). */
const PRESETS: { label: string; d: Partial<DedicatedCircuit> }[] = [
  { label: "Priza frigider", d: { name: "Priza frigider", endpoint: "priza", powerKw: 0.3 } },
  { label: "Plita", d: { name: "Plita", endpoint: "alteSurse", ratedA: 32, curve: "C", sectionMm2: 6, powerKw: 7 } },
  { label: "Cuptor", d: { name: "Cuptor", endpoint: "priza", powerKw: 3 } },
  { label: "Masina vase", d: { name: "Masina de spalat vase", endpoint: "priza", powerKw: 2.2 } },
  { label: "Masina spalat", d: { name: "Masina de spalat", endpoint: "priza", powerKw: 2.2 } },
  { label: "Boiler", d: { name: "Boiler", endpoint: "priza", powerKw: 2 } },
  { label: "Centrala", d: { name: "Centrala termica", endpoint: "priza", powerKw: 0.2 } },
  { label: "AC", d: { name: "Aer conditionat", endpoint: "alteSurse", powerKw: 1.5 } },
];

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
  const circuits = projectCircuits(project, pricing);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const setLevel = (id: string, fn: (l: Level) => Level) =>
    update((p) => ({ ...p, levels: p.levels.map((l) => (l.id === id ? fn(l) : l)) }));
  const setRoom = (levelId: string, roomId: string, fn: (r: Room) => Room) =>
    setLevel(levelId, (l) => ({ ...l, rooms: l.rooms.map((r) => (r.id === roomId ? fn(r) : r)) }));

  const COLS = 2 + 1 + POINT_KINDS.length + 5;

  return (
    <div className="flex flex-col gap-4">
      <Card title="Total proiect">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
          {POINT_KINDS.map((k) => (
            <Stat key={k} label={POINT_LABELS[k]} value={num(inv.points[k], 0)} />
          ))}
          <Stat label="Total doze" value={num(inv.pointsTotal, 0)} strong />
          <Stat label="Circuite dedicate" value={num(inv.dedicatedCircuits, 0)} note="nu se numara ca doze" />
          <Stat
            label="Trasee (m)"
            value={num(inv.routeM.total)}
            note={inv.routeM.estimated > 0 ? `${num(inv.routeM.estimated)} m estimati` : "toti masurati"}
          />
        </div>
      </Card>

      {project.levels.map((lvl) => {
        const li = inv.levels.find((x) => x.levelId === lvl.id);
        const lc = circuits.filter((c) => c.levelId === lvl.id);
        const cnt = (k: string) => lc.filter((c) => c.kind === k).length;
        const panelName = project.panels.find((p) => p.id === lvl.panelId)?.name;
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
              <table className="w-full min-w-[1320px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="w-20 py-2 pr-2">Cod</th>
                    <th className="min-w-40 py-2 pr-2">Incapere</th>
                    <th className="w-32 px-1 py-2">Perete</th>
                    {POINT_KINDS.map((k) => (
                      <th key={k} className="w-24 px-1 py-2" title={POINT_LABELS[k]}>
                        {SHORT[k]}
                      </th>
                    ))}
                    <th className="w-24 px-1 py-2">Traseu (m)</th>
                    <th className="w-28 px-1 py-2">Sursa</th>
                    <th className="w-14 px-1 py-2 text-right">Doze</th>
                    <th className="w-56 px-2 py-2">Circuite / cabluri</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lvl.rooms.map((room) => {
                    const route = roomRoute(room, pricing.defaultRouteMPerPoint);
                    const measured = !!room.routeM && room.routeM.value > 0;
                    const cables = roomCables(room.id, circuits);
                    const isOpen = open.has(room.id);
                    const nDed = room.dedicated?.length ?? 0;
                    return (
                      <Fragment key={room.id}>
                        <tr className={`border-b border-slate-100 align-top ${isOpen ? "bg-amber-50/40" : ""}`}>
                          <td className="py-1.5 pr-2">
                            <TextInput
                              value={room.code ?? ""}
                              placeholder={autoRoomCode(room, lvl, project.levels)}
                              onChange={(v) => setRoom(lvl.id, room.id, (r) => ({ ...r, code: v.trim() ? v : undefined }))}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <TextInput
                              value={room.name}
                              onChange={(v) => setRoom(lvl.id, room.id, (r) => ({ ...r, name: v }))}
                            />
                          </td>
                          <td className="px-1 py-1.5">
                            <Select<WallType>
                              value={room.wall ?? "zidarie"}
                              options={WALL_TYPES.map((w) => ({ value: w, label: WALL_LABELS[w] }))}
                              onChange={(v) => setRoom(lvl.id, room.id, (r) => ({ ...r, wall: v }))}
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
                              <SizeSelect
                                value={room.boxSizes?.[k] ?? DEFAULT_BOX_SIZE[k]}
                                isDefault={!room.boxSizes?.[k]}
                                onChange={(v) =>
                                  setRoom(lvl.id, room.id, (r) => ({ ...r, boxSizes: { ...r.boxSizes, [k]: v } }))
                                }
                              />
                            </td>
                          ))}
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
                          <td className="px-1 py-2 text-right font-medium tabular-nums">{pointsTotal(room.points)}</td>
                          <td className="px-2 py-1.5">
                            <button
                              type="button"
                              onClick={() => toggle(room.id)}
                              className="w-full rounded-md border border-slate-200 px-2 py-1 text-left text-xs hover:border-amber-400 hover:bg-amber-50"
                              title="Circuitele si cablurile care ajung in incapere; aici marchezi circuitele dedicate"
                            >
                              <span className="font-semibold text-slate-800">{cableSummary(cables)}</span>
                              <span className="mt-0.5 block text-slate-500">
                                {nDed ? `${nDed} dedicat${nDed === 1 ? "" : "e"}` : "fara dedicate"} · {isOpen ? "inchide ▴" : "editeaza ▾"}
                              </span>
                            </button>
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
                        {isOpen && (
                          <tr className="border-b border-slate-200 bg-amber-50/40">
                            <td colSpan={COLS} className="px-2 pb-3 pt-1">
                              <RoomCircuits
                                room={room}
                                cables={cables}
                                pricing={pricing}
                                onChange={(fn) => setRoom(lvl.id, room.id, fn)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {lc.length > 0 && (
              <p className="mt-3 text-sm text-slate-600">
                →{" "}
                <strong className="text-slate-800">{lc.length} circuite</strong>:{" "}
                {[
                  cnt("iluminat") && `${cnt("iluminat")} iluminat`,
                  cnt("prize") && `${cnt("prize")} prize`,
                  cnt("dedicat") && `${cnt("dedicat")} dedicate`,
                ]
                  .filter(Boolean)
                  .join(" · ")}{" "}
                {panelName ? (
                  <span className="text-slate-500">({panelName})</span>
                ) : (
                  <Badge tone="warn">fara tablou — circuitele merg provizoriu in tabloul principal</Badge>
                )}
              </p>
            )}
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
        Sub fiecare numar de doze alegi marimea dozei; peretele se alege pe incapere. Devizul numara dozele pe perete si
        marime. „Alte surse” = cablu lasat pentru conectare directa (ex. plita), fara doza. Circuitele dedicate (ex. priza
        frigider) nu se numara ca doze: se marcheaza la „Circuite / cabluri”, iar doza de capat ramane numarata la tipul
        ei. Traseul lasat gol se estimeaza automat: numar de doze × {num(pricing.defaultRouteMPerPoint)} m (setabil in
        Tarife & setari).
      </p>
    </div>
  );
}

function SizeSelect({ value, isDefault, onChange }: { value: BoxSize; isDefault: boolean; onChange: (v: BoxSize) => void }) {
  return (
    <select
      aria-label="Marimea dozei"
      title="Marimea dozei"
      className={`mt-1 w-full rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[11px] ${isDefault ? "text-slate-500" : "font-semibold text-slate-800"}`}
      value={value}
      onChange={(e) => onChange(e.target.value as BoxSize)}
    >
      {BOX_SIZES.map((s) => (
        <option key={s} value={s}>
          {BOX_SIZE_LABELS[s].toLowerCase()}
        </option>
      ))}
    </select>
  );
}

function RoomCircuits({
  room,
  cables,
  pricing,
  onChange,
}: {
  room: Room;
  cables: Circuit[];
  pricing: PricingSettings;
  onChange: (fn: (r: Room) => Room) => void;
}) {
  const def = getRules(pricing).defaults.dedicat;
  const list = room.dedicated ?? [];
  const setDed = (id: string, patch: Partial<DedicatedCircuit>) =>
    onChange((r) => ({ ...r, dedicated: (r.dedicated ?? []).map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  const add = (d: Partial<DedicatedCircuit>) => onChange((r) => ({ ...r, dedicated: [...(r.dedicated ?? []), newDedicated(d)] }));
  const remove = (id: string) => onChange((r) => ({ ...r, dedicated: (r.dedicated ?? []).filter((d) => d.id !== id) }));
  const endpointUse = (ep: DedicatedEndpoint) => list.filter((d) => d.endpoint === ep).length;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cabluri care ajung in {room.name || "incapere"}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cables.length === 0 && <span className="text-sm text-slate-500">niciun circuit</span>}
          {cables.map((c) => (
            <span
              key={c.id}
              className={`rounded-md px-2 py-1 text-xs ring-1 ring-inset ${
                c.kind === "dedicat" ? "bg-amber-100 ring-amber-300" : c.kind === "prize" ? "bg-sky-50 ring-sky-200" : "bg-slate-50 ring-slate-200"
              }`}
              title={`${c.name} · ${c.curve}${c.ratedA} · ${c.points} ${c.kind === "dedicat" ? "consumator" : "puncte"}`}
            >
              <strong className="font-mono">{c.code}</strong> · {c.cable} · {c.curve}
              {c.ratedA}
              <span className="text-slate-500"> · {c.name}</span>
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Circuite dedicate</div>
        {list.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1 pr-2">Consumator</th>
                  <th className="w-52 px-1 py-1">Capat (doza din incapere)</th>
                  <th className="w-24 px-1 py-1">In (A)</th>
                  <th className="w-20 px-1 py-1">Curba</th>
                  <th className="w-20 px-1 py-1">Poli</th>
                  <th className="w-28 px-1 py-1">Cablu</th>
                  <th className="w-24 px-1 py-1">P (kW)</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {list.map((d) => {
                  const poles = d.poles ?? 1;
                  const s = d.sectionMm2 ?? def.sectionMm2;
                  return (
                    <tr key={d.id} className="border-t border-amber-100">
                      <td className="py-1 pr-2">
                        <TextInput value={d.name} placeholder="ex. Priza frigider" onChange={(v) => setDed(d.id, { name: v })} />
                      </td>
                      <td className="px-1 py-1">
                        <Select<DedicatedEndpoint>
                          value={d.endpoint}
                          options={ENDPOINTS}
                          onChange={(v) => setDed(d.id, { endpoint: v })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Select
                          value={String(d.ratedA ?? def.ratedA)}
                          options={STANDARD_BREAKERS.map((a) => ({ value: String(a), label: `${a} A` }))}
                          onChange={(v) => setDed(d.id, { ratedA: Number(v) })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Select<Curve>
                          value={d.curve ?? def.curve}
                          options={(["B", "C", "D"] as const).map((c) => ({ value: c, label: c }))}
                          onChange={(v) => setDed(d.id, { curve: v })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Select
                          value={String(poles)}
                          options={["1", "2", "3", "4"].map((x) => ({ value: x, label: `${x}P` }))}
                          onChange={(v) => setDed(d.id, { poles: Number(v) as 1 | 2 | 3 | 4 })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Select
                          value={String(s)}
                          options={STANDARD_SECTIONS.map((x) => ({ value: String(x), label: cableLabel(poles >= 3 ? 3 : 1, x) }))}
                          onChange={(v) => setDed(d.id, { sectionMm2: Number(v) })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <NumberInput
                          ariaLabel={`Putere ${d.name}`}
                          value={d.powerKw ?? null}
                          placeholder={num(def.powerPerUnitKw, 2)}
                          step={0.1}
                          onChange={(v) => setDed(d.id, { powerKw: v ?? undefined })}
                        />
                      </td>
                      <td className="py-1 text-right">
                        <Button variant="danger" title="Sterge circuitul dedicat" onClick={() => remove(d.id)}>
                          ✕
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Button variant="secondary" className="px-2! py-1! text-xs" onClick={() => add({ name: "" })}>
            + Circuit dedicat
          </Button>
          {PRESETS.map((p) => (
            <Button key={p.label} variant="ghost" className="px-2! py-1! text-xs" onClick={() => add(p.d)}>
              + {p.label}
            </Button>
          ))}
        </div>
        {(["priza", "alteSurse", "jonctiune"] as const).some((ep) => endpointUse(ep) > (room.points[ep] || 0)) && (
          <p className="mt-2 text-xs text-amber-800">
            Atentie: unele circuite dedicate se termina intr-o doza care nu e numarata in incapere (ex. un circuit „doza de
            priza” fara doza de priza). Mareste numarul de doze sau schimba capatul.
          </p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Doza de capat se numara o singura data, la tipul ei (ex. priza frigider la „Prize”); circuitul dedicat scoate
          doza din circuitul general de prize si aduce un cablu separat in incapere.
        </p>
      </div>
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
