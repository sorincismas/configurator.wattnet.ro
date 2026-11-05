"use client";
import { useMemo, useState } from "react";
import { RequireProject } from "@/components/shell/AppShell";
import { levelOptions, roomLabel } from "@/components/install/common";
import { Badge, Button, Card, Checkbox, Code, ConfirmButton, Empty, NumberInput, PageHeader, Select, Table, TextInput, TrackedNumber, cx } from "@/components/ui";
import { estimateRouteLengthForRoom } from "@/lib/engine/cables";
import { cableLength, chaseLength, routeLength, totalCableLength, totalConduitLength, type Qty } from "@/lib/engine/measure";
import { fmtNum, NA } from "@/lib/format";
import { newConduit, newRoute, newSegment, tracked } from "@/lib/model/factory";
import type { NodeRef, Project, Route, RouteSegment, RouteSurface } from "@/lib/model/types";
import { useActiveProject, useUpdateActive } from "@/lib/store/store";

type Up = ReturnType<typeof useUpdateActive>;

const qcls = (q: Qty) => (q.value === null ? "v-unknown" : q.certainty === "masurat" ? "v-measured" : "v-estimated");
const qtxt = (q: Qty) => (q.value === null ? NA : fmtNum(q.value, 1) + " m") + (q.certainty === "partial" ? " (partial masurat)" : "");

function RoutesPage() {
  const p = useActiveProject()!;
  const up = useUpdateActive();
  const [level, setLevel] = useState("all");
  const [newRoom, setNewRoom] = useState<string>(p.rooms[0]?.id ?? "");
  const routes = p.routes.filter((r) => level === "all" || r.roomIds.some((id) => p.rooms.find((x) => x.id === id)?.levelId === level) || r.roomIds.length === 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trasee, copex si cabluri"
        subtitle="Traseul fizic (santul) se numara o singura data, oricate tuburi si circuite trec prin el. Tuburile si cablurile se numara separat. Lungimile estimate apar cu chenar punctat, cele masurate cu verde."
      />
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Trasee" value={String(p.routes.length)} sub={`${p.routes.filter((r) => r.requiresChase).length} cu sant`} />
        <Stat label="Sant (o data / traseu)" q={chaseLength(p)} />
        <Stat label="Copex" q={totalConduitLength(p)} />
        <Stat label="Cablu (pe circuite)" q={totalCableLength(p)} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-3">
        <Select className="w-44" value={level} onChange={setLevel} options={[{ value: "all", label: "Toate nivelurile" }, ...levelOptions(p)]} />
        <span className="ml-auto text-xs text-ink-2">Traseu nou in:</span>
        <Select className="w-56" value={newRoom} onChange={setNewRoom} options={p.rooms.map((r) => ({ value: r.id, label: roomLabel(p, r.id) }))} />
        <Button
          variant="primary"
          disabled={!newRoom}
          onClick={() =>
            up((x) => {
              const room = x.rooms.find((r) => r.id === newRoom);
              const tr = newRoute(x, `Traseu ${room?.name ?? ""}`.trim(), newRoom ? [newRoom] : []);
              const est = newRoom ? estimateRouteLengthForRoom(x, newRoom) : null;
              tr.segments.push(newSegment(x.panels[0]?.code ?? "TA", room?.name ?? "", est));
              tr.conduits.push(newConduit(x, "cd-20"));
              x.routes.push(tr);
            }, "Traseu adaugat")
          }
        >
          + Traseu
        </Button>
      </div>

      {routes.length === 0 ? (
        <Empty title="Nu exista trasee">
          Adauga un traseu, apoi segmentele (tablou → doza derivatie → doze) si tuburile prin care trec circuitele. Fara trasee, devizul foloseste lungimea estimata introdusa pe circuit.
        </Empty>
      ) : (
        routes.map((r) => <RouteCard key={r.id} p={p} r={r} up={up} />)
      )}

      <CablesCard p={p} up={up} />
    </div>
  );
}

function Stat({ label, value, sub, q }: { label: string; value?: string; sub?: string; q?: Qty }) {
  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">{label}</p>
      {q ? <p className={cx("mt-0.5 text-lg font-semibold tabular-nums", qcls(q))}>{qtxt(q)}</p> : <p className="mt-0.5 text-lg font-semibold">{value}</p>}
      {sub && <p className="text-xs text-ink-2">{sub}</p>}
      {q && q.missing > 0 && <p className="text-xs text-warn">{q.missing} lungimi lipsa</p>}
    </div>
  );
}

/** selectie capat de segment: tablou, doza, aparat sau text liber */
function NodeSelect({ p, r, node, onChange }: { p: Project; r: Route; node: NodeRef; onChange: (n: NodeRef) => void }) {
  const boxes = p.boxes.filter((b) => r.roomIds.includes(b.roomId) || b.kind === "DD");
  const value = node.kind === "free" ? "free:" : `${node.kind}:${node.refId}`;
  const options = [
    { value: "free:", label: "text liber…" },
    ...p.panels.map((t) => ({ value: `panel:${t.id}`, label: `${t.code} ${t.name}` })),
    ...boxes.map((b) => ({ value: `box:${b.id}`, label: `${b.code} (${p.rooms.find((x) => x.id === b.roomId)?.name ?? ""})` })),
  ];
  return (
    <div className="flex gap-1">
      <Select
        className="w-40"
        value={value}
        onChange={(v) => {
          const [kind, id] = v.split(":");
          if (kind === "free") onChange({ kind: "free", refId: null, label: node.label });
          else {
            const label = kind === "panel" ? p.panels.find((t) => t.id === id)?.code ?? "" : p.boxes.find((b) => b.id === id)?.code ?? "";
            onChange({ kind: kind as NodeRef["kind"], refId: id, label });
          }
        }}
        options={options}
      />
      {node.kind === "free" && <TextInput className="w-28" value={node.label} placeholder="ex. TA, DD hol" onChange={(v) => onChange({ ...node, label: v })} />}
    </div>
  );
}

function RouteCard({ p, r, up }: { p: Project; r: Route; up: Up }) {
  const lib = p.library;
  const set = (recipe: (x: Route) => void, h?: string) => up((x) => { const y = x.routes.find((z) => z.id === r.id); if (y) recipe(y); }, h);
  const setSeg = (id: string, recipe: (s: RouteSegment) => void) => set((x) => { const s = x.segments.find((k) => k.id === id); if (s) recipe(s); });
  const len = routeLength(r);
  const circuitsInRoute = new Set(r.conduits.flatMap((c) => c.circuitIds));
  const [roomToAdd, setRoomToAdd] = useState<string>("");
  const sortedCircuits = useMemo(() => [...p.circuits].sort((a, b) => a.order - b.order), [p.circuits]);

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <Code>{r.code}</Code>
          <TextInput className="w-56" value={r.name} onChange={(v) => set((x) => void (x.name = v))} />
          <span className={cx("text-sm font-normal", qcls(len))}>{qtxt(len)}</span>
          {r.requiresChase ? <Badge tone="volt">sant</Badge> : <Badge>fara sant</Badge>}
          <span className="text-xs font-normal text-ink-3">{circuitsInRoute.size} circuite · {r.conduits.length} tuburi</span>
        </span>
      }
      actions={<ConfirmButton label="Sterge traseul" onConfirm={() => up((x) => void (x.routes = x.routes.filter((z) => z.id !== r.id)), `Traseu sters ${r.code}`)}>Sterge</ConfirmButton>}
    >
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <Select<RouteSurface>
          className="w-40"
          value={r.surface}
          onChange={(v) => set((x) => { x.surface = v; if (v === "aparent") x.requiresChase = false; })}
          options={[{ value: "perete", label: "Perete" }, { value: "tavan", label: "Tavan" }, { value: "pardoseala", label: "Pardoseala" }, { value: "aparent", label: "Aparent / canal" }, { value: "pamant", label: "In pamant" }]}
        />
        <Checkbox checked={r.requiresChase} onChange={(v) => set((x) => void (x.requiresChase = v))} label="Necesita sant / canal" />
        <span className="text-xs text-ink-2">Perete:</span>
        <Select className="w-44" value={r.wallTypeId} placeholder="ca incaperea" onChange={(v) => set((x) => void (x.wallTypeId = v || null))} options={lib.wallTypes.map((w) => ({ value: w.id, label: w.name }))} />
        <span className="text-xs text-ink-2">Ramificatie din:</span>
        <Select className="w-44" value={r.parentRouteId} placeholder="—" onChange={(v) => set((x) => void (x.parentRouteId = v || null))} options={p.routes.filter((x) => x.id !== r.id).map((x) => ({ value: x.id, label: `${x.code} ${x.name}` }))} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1 text-xs">
        <span className="text-ink-2">Incaperi:</span>
        {r.roomIds.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded bg-paper-2 px-1.5 py-0.5">
            {roomLabel(p, id)}
            <button className="text-ink-3 hover:text-red-700" onClick={() => set((x) => void (x.roomIds = x.roomIds.filter((k) => k !== id)))}>×</button>
          </span>
        ))}
        <Select className="w-48" value={roomToAdd} placeholder="+ incapere…" onChange={(v) => { if (v) set((x) => void (x.roomIds = [...new Set([...x.roomIds, v])])); setRoomToAdd(""); }} options={p.rooms.filter((x) => !r.roomIds.includes(x.id)).map((x) => ({ value: x.id, label: roomLabel(p, x.id) }))} />
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Segmente</p>
          <Table>
            <thead><tr><th>De la</th><th>Pana la</th><th className="num">Lungime</th><th>Perete</th><th /></tr></thead>
            <tbody>
              {r.segments.map((s) => (
                <tr key={s.id}>
                  <td><NodeSelect p={p} r={r} node={s.from} onChange={(n) => setSeg(s.id, (x) => void (x.from = n))} /></td>
                  <td><NodeSelect p={p} r={r} node={s.to} onChange={(n) => setSeg(s.id, (x) => void (x.to = n))} /></td>
                  <td className="w-32"><TrackedNumber value={s.lengthM} suffix="m" allowedProvenance={["estimat", "masurat"]} onChange={(v) => setSeg(s.id, (x) => void (x.lengthM = v))} /></td>
                  <td className="w-32"><Select value={s.wallTypeId} placeholder="—" onChange={(v) => setSeg(s.id, (x) => void (x.wallTypeId = v || null))} options={lib.wallTypes.map((w) => ({ value: w.id, label: w.name }))} /></td>
                  <td className="text-right"><ConfirmButton onConfirm={() => set((x) => void (x.segments = x.segments.filter((k) => k.id !== s.id)))}>✕</ConfirmButton></td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => set((x) => void x.segments.push(newSegment(x.segments.at(-1)?.to.label ?? "", "")))}>+ Segment</Button>
            {r.roomIds[0] && (
              <Button size="sm" variant="ghost" onClick={() => { const est = estimateRouteLengthForRoom(p, r.roomIds[0]); set((x) => void x.segments.push(newSegment(x.segments.at(-1)?.to.label ?? "", "", est))); }} title="semiperimetrul incaperii + coborare de la tavan la priza">
                + Segment estimat din incapere
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => set((x) => x.segments.forEach((s) => s.lengthM.value !== null && (s.lengthM = { ...s.lengthM, provenance: "masurat", status: "masurat" })), `${r.code}: segmente marcate masurate`)}>
              Marcheaza toate masurate
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Tuburi / copex si circuitele din ele</p>
          {r.conduits.map((cd) => (
            <div key={cd.id} className="mb-2 rounded-md border border-line p-2">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Code>{cd.code}</Code>
                <Select className="w-40" value={cd.conduitTypeId} placeholder="—" onChange={(v) => set((x) => void (x.conduits.find((k) => k.id === cd.id)!.conduitTypeId = v || null))} options={lib.conduitTypes.map((t) => ({ value: t.id, label: t.name }))} />
                <span className="text-xs text-ink-2">lungime:</span>
                <NumberInput
                  className="w-24"
                  value={cd.lengthOverrideM?.value ?? null}
                  placeholder={len.value === null ? "—" : `${fmtNum(len.value, 1)} (traseu)`}
                  suffix="m"
                  onChange={(v) => set((x) => void (x.conduits.find((k) => k.id === cd.id)!.lengthOverrideM = v === null ? null : tracked(v)))}
                />
                <span className="ml-auto"><ConfirmButton onConfirm={() => set((x) => void (x.conduits = x.conduits.filter((k) => k.id !== cd.id)))}>Sterge tub</ConfirmButton></span>
              </div>
              {sortedCircuits.length === 0 ? (
                <p className="text-xs text-ink-3">Nu exista circuite inca.</p>
              ) : (
                <div className="grid max-h-36 grid-cols-1 gap-x-3 overflow-y-auto md:grid-cols-2">
                  {sortedCircuits.map((c) => (
                    <Checkbox
                      key={c.id}
                      checked={cd.circuitIds.includes(c.id)}
                      label={`${c.code} ${c.name}`}
                      onChange={(on) =>
                        set((x) => {
                          const k = x.conduits.find((z) => z.id === cd.id)!;
                          k.circuitIds = on ? [...k.circuitIds, c.id] : k.circuitIds.filter((id) => id !== c.id);
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          <Button size="sm" onClick={() => up((x) => void x.routes.find((z) => z.id === r.id)?.conduits.push(newConduit(x, "cd-20")), "Tub adaugat")}>+ Tub</Button>
        </div>
      </div>
    </Card>
  );
}

function CablesCard({ p, up }: { p: Project; up: Up }) {
  const lib = p.library;
  if (p.cables.length === 0) return null;
  return (
    <Card title={`Cabluri (${p.cables.length})`} subtitle="Generate automat pentru fiecare circuit care trece prin tuburi. Lungime = suma traseelor + rezerva la capete (conventia R012). Poti fixa manual lungimea masurata.">
      <Table>
        <thead><tr><th>Cod</th><th>Circuit</th><th>Tip cablu</th><th>Trasee</th><th className="num">Rezerva</th><th className="num">Lungime calculata</th><th>Lungime fixata</th></tr></thead>
        <tbody>
          {p.cables.map((cb) => {
            const c = p.circuits.find((x) => x.id === cb.circuitId);
            const setCb = (recipe: (x: typeof cb) => void) => up((x) => { const y = x.cables.find((k) => k.id === cb.id); if (y) recipe(y); });
            const calc = cableLength(p, { ...cb, lengthOverrideM: null });
            return (
              <tr key={cb.id}>
                <td><Code>{cb.code}</Code></td>
                <td>{c ? <><Code>{c.code}</Code> {c.name}</> : "?"}</td>
                <td className="w-40">
                  <Select value={cb.cableTypeId} placeholder={lib.cableTypes.find((t) => t.id === c?.cableTypeId)?.name ?? "ca circuitul"} onChange={(v) => setCb((x) => void (x.cableTypeId = v || null))} options={lib.cableTypes.map((t) => ({ value: t.id, label: t.name }))} />
                </td>
                <td className="font-mono text-xs">{cb.routeIds.map((id) => p.routes.find((r) => r.id === id)?.code).filter(Boolean).join(", ")}</td>
                <td className="w-24"><NumberInput value={cb.reserveM} suffix="m" onChange={(v) => setCb((x) => void (x.reserveM = v ?? 0))} /></td>
                <td className={cx("num", qcls(calc))}>{qtxt(calc)}</td>
                <td className="w-36">
                  <TrackedNumber
                    value={cb.lengthOverrideM ?? { value: null, provenance: "masurat" }}
                    suffix="m"
                    allowedProvenance={["masurat", "estimat"]}
                    onChange={(v) => setCb((x) => void (x.lengthOverrideM = v.value === null ? null : v))}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

export default function Page() {
  return (
    <RequireProject>
      <RoutesPage />
    </RequireProject>
  );
}
