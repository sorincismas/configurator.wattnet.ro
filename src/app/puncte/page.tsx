"use client";
import { useMemo, useState } from "react";
import { RequireProject } from "@/components/shell/AppShell";
import { CATEGORY_LABEL, circuitOptions, levelOptions, roomLabel } from "@/components/install/common";
import { RouteLinks } from "@/components/install/RouteLinks";
import { defaultBoxTypeId, defaultDeviceTypeId } from "@/lib/library/defaults";
import { routesForBox } from "@/lib/engine/links";
import { Badge, Button, Card, Code, ConfirmButton, Empty, NumberInput, PageHeader, Select, TextInput, TrackedNumber, cx } from "@/components/ui";
import { newBox, newDevice, removeBox, removeDevices } from "@/lib/model/factory";
import { moveDevice } from "@/lib/engine/circuits";
import { fmtKW } from "@/lib/format";
import type { Box, Device, DeviceCategory, Project, Room } from "@/lib/model/types";
import { useActiveProject, useUpdateActive } from "@/lib/store/store";

type Up = ReturnType<typeof useUpdateActive>;


function PointsPage() {
  const p = useActiveProject()!;
  const up = useUpdateActive();
  const [level, setLevel] = useState<string>("all");
  const [roomId, setRoomId] = useState<string>("all");
  const [cat, setCat] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rooms = useMemo(() => {
    const order = new Map(levelOptions(p).map((l, i) => [l.value, i] as const));
    return p.rooms
      .filter((r) => (level === "all" || r.levelId === level) && (roomId === "all" || r.id === roomId))
      .sort((a, b) => (order.get(a.levelId) ?? 0) - (order.get(b.levelId) ?? 0));
  }, [p, level, roomId]);

  const toggle = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const visibleDevices = p.devices.filter((d) => rooms.some((r) => r.id === d.roomId) && (cat === "all" || d.category === cat));
  const totals = {
    DA: p.boxes.filter((b) => b.kind === "DA" && rooms.some((r) => r.id === b.roomId)).length,
    DD: p.boxes.filter((b) => b.kind === "DD" && rooms.some((r) => r.id === b.roomId)).length,
    modules: p.boxes.filter((b) => b.kind === "DA" && rooms.some((r) => r.id === b.roomId)).reduce((s, b) => s + b.modules, 0),
    noRoute: p.boxes.filter((b) => rooms.some((r) => r.id === b.roomId) && routesForBox(p, b.id).length === 0).length,
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Doze si aparate"
        subtitle="Doza (DA/DD) este cutia fizica; aparatul este ce se monteaza in ea; puterea apartine aparatului/consumatorului. Mai multe aparate pot sta in aceeasi doza."
      />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-3">
        <Select className="w-44" value={level} onChange={(v) => { setLevel(v); setRoomId("all"); }} options={[{ value: "all", label: "Toate nivelurile" }, ...levelOptions(p)]} />
        <Select
          className="w-52"
          value={roomId}
          onChange={setRoomId}
          options={[{ value: "all", label: "Toate incaperile" }, ...p.rooms.filter((r) => level === "all" || r.levelId === level).map((r) => ({ value: r.id, label: roomLabel(p, r.id) }))]}
        />
        <Select className="w-48" value={cat} onChange={setCat} options={[{ value: "all", label: "Toate categoriile" }, ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))]} />
        <span className="ml-auto flex flex-wrap gap-3 text-xs text-ink-2">
          <span>DA <b>{totals.DA}</b></span>
          <span>DD <b>{totals.DD}</b></span>
          <span>module DA <b>{totals.modules}</b></span>
          <span>aparate <b>{visibleDevices.length}</b></span>
          <span className={totals.noRoute ? "text-warn" : ""}>doze fara traseu <b>{totals.noRoute}</b></span>
        </span>
      </div>

      {selected.size > 0 && <BulkBar p={p} up={up} ids={[...selected]} clear={() => setSelected(new Set())} />}

      {p.rooms.length === 0 ? (
        <Empty title="Nu exista incaperi">Defineste intai incaperile in Cladire si incaperi.</Empty>
      ) : (
        rooms.map((r) => <RoomCard key={r.id} p={p} r={r} up={up} cat={cat} selected={selected} toggle={toggle} />)
      )}
    </div>
  );
}

function BulkBar({ p, up, ids, clear }: { p: Project; up: Up; ids: string[]; clear: () => void }) {
  return (
    <div className="sticky top-11 z-30 flex flex-wrap items-center gap-2 rounded-md border border-volt bg-[#fff8db] p-2 text-sm shadow-sm">
      <b>{ids.length} aparate selectate</b>
      <span className="text-ink-2">Putere:</span>
      <NumberInput className="w-24" value={null} suffix="W" onChange={(v) => v !== null && up((x) => x.devices.filter((d) => ids.includes(d.id)).forEach((d) => (d.powerW = { value: v, provenance: "proiectant", status: "confirmat" })), `Putere ${v} W pe ${ids.length} aparate`)} />
      <span className="text-ink-2">Circuit:</span>
      <Select className="w-56" value={null} placeholder="alege…" onChange={(v) => up((x) => ids.forEach((id) => moveDevice(x, id, v || null)), `Mutare ${ids.length} puncte pe circuit`)} options={circuitOptions(p)} />
      <Button size="sm" onClick={() => up((x) => x.devices.filter((d) => ids.includes(d.id)).forEach((d) => { d.circuitId = null; d.circuitLocked = false; }), "Puncte eliberate din circuit")}>Elibereaza din circuit</Button>
      <ConfirmButton label={`Sterge ${ids.length} aparate`} onConfirm={() => { up((x) => removeDevices(x, ids), `${ids.length} aparate sterse`); clear(); }}>Sterge</ConfirmButton>
      <Button size="sm" variant="ghost" onClick={clear}>Deselecteaza</Button>
    </div>
  );
}

function RoomCard({ p, r, up, cat, selected, toggle }: { p: Project; r: Room; up: Up; cat: string; selected: Set<string>; toggle: (id: string, on: boolean) => void }) {
  const lib = p.library;
  const [qty, setQty] = useState<number | null>(1);
  const [boxQty, setBoxQty] = useState<number | null>(1);
  const [boxType, setBoxType] = useState<string>(defaultBoxTypeId(lib, "DA"));
  const [deviceType, setDeviceType] = useState<string>(defaultDeviceTypeId(lib));
  /**
   * unde intra aparatele noi:
   *  "auto"            - dupa tipul aparatului: in doza noua (automat dupa module) sau fara doza
   *  "direct"          - fara doza, racord direct (ex. termostat, consumator)
   *  "each:<tip|auto>" - fiecare aparat in doza lui noua
   *  "shared:<tip|auto>" - toate aparatele adaugate acum intr-o singura doza noua
   *  "box:<id>"        - intr-o doza existenta
   */
  const [boxChoice, setBoxChoice] = useState<string>("auto");
  const [ddType, setDdType] = useState<string>(defaultBoxTypeId(lib, "DD"));
  const boxes = p.boxes.filter((b) => b.roomId === r.id);
  const devices = p.devices.filter((d) => d.roomId === r.id);
  const show = (d: Device) => cat === "all" || d.category === cat;
  const da = boxes.filter((b) => b.kind === "DA");
  const dd = boxes.filter((b) => b.kind === "DD");
  const loose = devices.filter((d) => !d.boxId && show(d));
  const power = devices.reduce((s, d) => s + (d.powerW.value ?? 0), 0);
  const daTypes = lib.boxTypes.filter((b) => b.kind === "DA");
  const ddTypes = lib.boxTypes.filter((b) => b.kind === "DD");

  /** tipul de doza pentru o doza noua: ales explicit sau automat dupa module */
  const pickBoxType = (choice: string, modules: number) => {
    if (choice && choice !== "auto") return choice;
    // automat: doza implicita din biblioteca daca incap modulele, altfel cea mai mica modulara potrivita
    const round = daTypes.find((b) => b.id === defaultBoxTypeId(lib, "DA")) ?? daTypes[0];
    if (modules <= (round?.modules ?? 2)) return round?.id ?? null;
    return daTypes.filter((b) => b.modules >= modules).sort((a, b) => a.modules - b.modules)[0]?.id ?? round?.id ?? null;
  };

  const add = (deviceTypeId: string) => {
    const dt = lib.deviceTypes.find((t) => t.id === deviceTypeId);
    if (!dt) return;
    const n = Math.max(1, Math.min(30, qty ?? 1));
    up((x) => {
      let shared: string | null = null;
      for (let k = 0; k < n; k++) {
        let boxId: string | null = null;
        if (boxChoice.startsWith("box:")) {
          const id = boxChoice.slice(4);
          boxId = x.boxes.some((b) => b.id === id) ? id : null;
        } else if (boxChoice.startsWith("shared:")) {
          if (!shared) {
            const b = newBox(x, "DA", r.id, pickBoxType(boxChoice.slice(7), dt.modules * n));
            x.boxes.push(b);
            shared = b.id;
          }
          boxId = shared;
        } else if (boxChoice.startsWith("each:") || (boxChoice === "auto" && dt.needsBox)) {
          const b = newBox(x, "DA", r.id, pickBoxType(boxChoice.startsWith("each:") ? boxChoice.slice(5) : "auto", dt.modules));
          x.boxes.push(b);
          boxId = b.id;
        }
        x.devices.push(newDevice(x, r.id, deviceTypeId, undefined, boxId));
      }
    }, `${n} x ${dt.name} in ${r.name}`);
  };

  const addEmptyBox = () => {
    const n = Math.max(1, Math.min(30, boxQty ?? 1));
    up((x) => {
      for (let k = 0; k < n; k++) x.boxes.push(newBox(x, "DA", r.id, pickBoxType(boxType, 0)));
    }, `${n} doze aparat in ${r.name}`);
  };
  const usedModules = (boxId: string) => p.devices.filter((d) => d.boxId === boxId).reduce((s2, d) => s2 + d.modules, 0);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Code>{r.code}</Code> {roomLabel(p, r.id)}
          <span className="font-normal text-ink-3">· {da.length} DA · {dd.length} DD · {devices.length} aparate · {fmtKW(power)}</span>
        </span>
      }
    >
      <div className="mb-3 space-y-2 rounded-md bg-paper p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Doze</span>
          <NumberInput className="w-14" value={boxQty} min={1} onChange={setBoxQty} />
          <span className="text-xs text-ink-3">x</span>
          <Select className="w-64" value={boxType} onChange={setBoxType} options={daTypes.map((b) => ({ value: b.id, label: b.name + (b.isDefault ? " (implicit)" : "") }))} />
          <Button size="sm" onClick={addEmptyBox}>+ Doza aparat</Button>
          <span className="ml-3 text-xs text-ink-2">derivatie:</span>
          <Select className="w-56" value={ddType} onChange={setDdType} options={ddTypes.map((b) => ({ value: b.id, label: b.name + (b.isDefault ? " (implicit)" : "") }))} />
          <Button size="sm" onClick={() => up((x) => { for (let k = 0; k < Math.max(1, Math.min(30, boxQty ?? 1)); k++) x.boxes.push(newBox(x, "DD", r.id, ddType || null)); }, `Doza derivatie in ${r.name}`)}>+ Doza derivatie</Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
          <span className="w-16 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Aparate</span>
          <NumberInput className="w-14" value={qty} min={1} onChange={setQty} />
          <span className="text-xs text-ink-3">x</span>
          <Select
            className="w-72"
            value={deviceType}
            onChange={setDeviceType}
            options={lib.deviceTypes.map((d) => ({ value: d.id, label: `${CATEGORY_LABEL[d.category] ?? d.category}: ${d.name}${d.isDefault ? " (implicit)" : ""}` }))}
          />
          <span className="text-xs text-ink-2">montate:</span>
          <Select
            className="w-72"
            value={boxChoice}
            onChange={setBoxChoice}
            options={[
              { value: "auto", label: "dupa tipul aparatului (doza noua sau fara)" },
              { value: "direct", label: "fara doza - racord direct" },
              { value: "shared:auto", label: "toate intr-o doza noua comuna (dupa module)" },
              ...daTypes.map((b) => ({ value: `shared:${b.id}`, label: `toate intr-o doza noua: ${b.name}` })),
              ...daTypes.map((b) => ({ value: `each:${b.id}`, label: `fiecare in doza noua: ${b.name}` })),
              ...da.map((b) => ({ value: `box:${b.id}`, label: `in doza existenta ${b.code} (${usedModules(b.id)}/${b.modules} mod.)` })),
            ]}
          />
          <Button size="sm" variant="primary" onClick={() => add(deviceType)} disabled={!deviceType}>+ Adauga aparat</Button>
        </div>
      </div>

      {boxes.length === 0 && loose.length === 0 ? (
        <p className="text-sm text-ink-3">Niciun element in aceasta incapere.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="dense w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-6" />
                <th>Cod</th>
                <th>Tip</th>
                <th>Eticheta / pozitie</th>
                <th className="num">Putere</th>
                <th>Circuit / Trasee (doze)</th>
                <th>Iluminat / doza</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {da.map((b) => {
                const inside = devices.filter((d) => d.boxId === b.id);
                if (cat !== "all" && !inside.some(show)) return null;
                return <BoxRows key={b.id} p={p} b={b} inside={inside.filter(show)} up={up} selected={selected} toggle={toggle} />;
              })}
              {loose.map((d) => (
                <DeviceRow key={d.id} p={p} d={d} up={up} selected={selected.has(d.id)} toggle={toggle} />
              ))}
              {(cat === "all") && dd.map((b) => <BoxRows key={b.id} p={p} b={b} inside={[]} up={up} selected={selected} toggle={toggle} />)}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function BoxRows({ p, b, inside, up, selected, toggle }: { p: Project; b: Box; inside: Device[]; up: Up; selected: Set<string>; toggle: (id: string, on: boolean) => void }) {
  const lib = p.library;
  const used = p.devices.filter((d) => d.boxId === b.id).reduce((s, d) => s + d.modules, 0);
  const over = b.kind === "DA" && used > b.modules;
  const setBox = (recipe: (x: Box) => void, h?: string) => up((x) => { const y = x.boxes.find((z) => z.id === b.id); if (y) recipe(y); }, h);
  const count = p.devices.filter((d) => d.boxId === b.id).length;
  return (
    <>
      <tr className="bg-paper/60">
        <td />
        <td><Code>{b.code}</Code></td>
        <td className="min-w-56">
          <Select
            value={b.boxTypeId}
            onChange={(v) => setBox((x) => { x.boxTypeId = v; x.modules = lib.boxTypes.find((t) => t.id === v)?.modules ?? x.modules; })}
            options={lib.boxTypes.filter((t) => t.kind === b.kind).map((t) => ({ value: t.id, label: t.name }))}
          />
        </td>
        <td className="min-w-44"><TextInput value={b.position} placeholder="pozitie (perete, langa usa…)" onChange={(v) => setBox((x) => void (x.position = v))} /></td>
        <td className="num text-xs">
          {b.kind === "DA" ? (
            <span className={cx(over && "font-semibold text-red-700")} title="module ocupate / disponibile">{used} / {b.modules} mod.</span>
          ) : (
            <span className="text-ink-3">derivatie</span>
          )}
        </td>
        <td colSpan={2} className="text-xs text-ink-3">
          <div className="flex flex-wrap items-center gap-2">
            <RouteLinks p={p} b={b} up={up} />
            {b.kind === "DD" && <span>{p.devices.filter((d) => d.junctionBoxId === b.id).length} puncte ramificate</span>}
            {over && <Badge tone="bad">module depasite</Badge>}
          </div>
        </td>
        <td className="text-right">
          <ConfirmButton label={count ? `Sterge doza + ${count} aparate` : "Sterge doza"} onConfirm={() => up((x) => removeBox(x, b.id), `Doza stearsa ${b.code}`)}>Sterge</ConfirmButton>
        </td>
      </tr>
      {inside.map((d) => <DeviceRow key={d.id} p={p} d={d} up={up} selected={selected.has(d.id)} toggle={toggle} nested />)}
    </>
  );
}

const NO_POWER: DeviceCategory[] = ["curenti_slabi", "intrerupator"];

function DeviceRow({ p, d, up, selected, toggle, nested }: { p: Project; d: Device; up: Up; selected: boolean; toggle: (id: string, on: boolean) => void; nested?: boolean }) {
  const lib = p.library;
  const set = (recipe: (x: Device) => void, h?: string) => up((x) => { const y = x.devices.find((z) => z.id === d.id); if (y) recipe(y); }, h);
  const switches = p.devices.filter((x) => x.roomId === d.roomId && x.category === "intrerupator");
  const dds = p.boxes.filter((b) => b.kind === "DD" && (b.roomId === d.roomId || p.rooms.find((r) => r.id === b.roomId)?.levelId === p.rooms.find((r) => r.id === d.roomId)?.levelId));
  const roomBoxes = p.boxes.filter((b) => b.kind === "DA" && b.roomId === d.roomId);
  return (
    <tr className={cx(selected && "bg-volt/10")}>
      <td><input type="checkbox" className="accent-ink" checked={selected} onChange={(e) => toggle(d.id, e.target.checked)} /></td>
      <td className={cx(nested && "pl-6")}><Code>{d.code}</Code></td>
      <td className="min-w-56">
        <Select
          value={d.deviceTypeId}
          onChange={(v) =>
            set((x) => {
              const t = lib.deviceTypes.find((k) => k.id === v);
              x.deviceTypeId = v;
              if (t) {
                x.category = t.category;
                x.modules = t.modules;
                x.threePhase = t.threePhase;
                if (!x.label || lib.deviceTypes.some((k) => k.name === x.label)) x.label = t.name;
                if (NO_POWER.includes(t.category)) x.powerW = { value: null, provenance: "estimat" };
              }
            })
          }
          options={lib.deviceTypes.filter((t) => t.category === d.category || (d.category === "consumator_dedicat" && t.category === "altul")).map((t) => ({ value: t.id, label: t.name }))}
        />
      </td>
      <td className="min-w-44"><TextInput value={d.label} onChange={(v) => set((x) => void (x.label = v))} /></td>
      <td className="w-32">
        {NO_POWER.includes(d.category) ? (
          <span className="block text-right text-xs text-ink-3">fara putere</span>
        ) : (
          <TrackedNumber value={d.powerW} suffix="W" allowedProvenance={["estimat", "proiectant", "beneficiar"]} onChange={(v) => set((x) => void (x.powerW = v))} />
        )}
      </td>
      <td className="min-w-48">
        {d.category === "curenti_slabi" ? (
          <span className="text-xs text-ink-3">—</span>
        ) : (
          <div className="flex items-center gap-1">
            <Select className="w-40" value={d.circuitId} placeholder="neasociat" onChange={(v) => up((x) => moveDevice(x, d.id, v || null), `${d.code} mutat pe circuit`)} options={circuitOptions(p)} />
            {d.circuitLocked && <Badge tone="info" title="Asociere manuala - generarea automata nu o modifica">manual</Badge>}
          </div>
        )}
      </td>
      <td className="min-w-60">
        {d.category === "iluminat" ? (
          <div className="flex flex-wrap items-center gap-1">
            <Select className="w-32" value={d.lightingTopology} onChange={(v) => set((x) => { x.lightingTopology = v; if (v === "direct") x.junctionBoxId = null; })} options={[{ value: "direct", label: "intr. → punct" }, { value: "prin_dd", label: "prin doza DD" }]} />
            <Select className="w-36" value={d.controlledByIds[0] ?? null} placeholder="comandat de…" onChange={(v) => set((x) => void (x.controlledByIds = v ? [v] : []))} options={switches.map((s) => ({ value: s.id, label: `${s.code} ${s.label}` }))} />
            {d.lightingTopology === "prin_dd" && (
              <Select className="w-28" value={d.junctionBoxId ?? null} placeholder="DD…" onChange={(v) => set((x) => void (x.junctionBoxId = v || null))} options={dds.map((b) => ({ value: b.id, label: b.code }))} />
            )}
          </div>
        ) : (
          <Select className="w-48" value={d.boxId} placeholder="fara doza (racord direct)" onChange={(v) => set((x) => void (x.boxId = v || null), v ? `${d.code} mutat in doza` : `${d.code} fara doza`)} options={roomBoxes.map((b) => ({ value: b.id, label: `in ${b.code} (${lib.boxTypes.find((t) => t.id === b.boxTypeId)?.name ?? "doza"})` }))} />
        )}
      </td>
      <td className="text-right">
        <ConfirmButton onConfirm={() => up((x) => removeDevices(x, [d.id]), `Aparat sters ${d.code}`)}>Sterge</ConfirmButton>
      </td>
    </tr>
  );
}

export default function Page() {
  return (
    <RequireProject>
      <PointsPage />
    </RequireProject>
  );
}

