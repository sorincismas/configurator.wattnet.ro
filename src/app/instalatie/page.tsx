"use client";
/**
 * Puncte si circuite - ecranul de lucru rapid (faza la rosu).
 * Navigare pe coloane ca in Finder: nivel > incapere > puncte > detaliu.
 * Pe telefon se vede o singura coloana, cu calea de navigare sus.
 */
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { RequireProject } from "@/components/shell/AppShell";
import { BOX_COLOR, DEVICE_COLOR } from "@/components/shell/theme";
import { Badge, Button, Checkbox, ConfirmButton, Field, NumberInput, Select, Tabs, TextInput, cx } from "@/components/ui";
import { allCircuitLoads, generateCircuits, moveDevice, type CircuitLoad } from "@/lib/engine/circuits";
import { autoCircuitLength, chaseLength, circuitEndPoints, circuitLimitPoints, totalCableLength, totalConduitLength, usesEstimatedRoutes } from "@/lib/engine/measure";
import { newPanel } from "@/lib/engine/panels";
import { applySizing, proposeSizing } from "@/lib/engine/sizing";
import {
  addBoxes,
  addDeviceToBox,
  addJunctionBoxes,
  fillDefaultDevices,
  addPoints,
  applyQuickItems,
  boxCapacity,
  boxCategory,
  boxCircuitId,
  boxDevices,
  changePointType,
  FUNCTION_LABEL,
  FUNCTION_OF,
  moveBox,
  parseQuickCode,
  pointFunction,
  realBoxDevices,
  removeBox,
  removeDeviceFromBox,
  removePoint,
  roomDevices,
  setBoxPurpose,
  type PointFunction,
} from "@/lib/engine/points";
import { circuitsThroughBox, moveInChain, resolveChain, setCircuitThroughBox, setLinkLength } from "@/lib/engine/chain";
import { fmtNum, NA } from "@/lib/format";
import { newBuilding, newLevel, newRoom, tracked } from "@/lib/model/factory";
import type { Circuit, Device, DeviceCategory, Project } from "@/lib/model/types";
import { useActiveProject, useApp, useUpdateActive } from "@/lib/store/store";
import { createDefaultLibrary } from "@/lib/library/default-library";

type Up = ReturnType<typeof useUpdateActive>;

const FN_CATEGORY: Record<Exclude<PointFunction, "J">, DeviceCategory> = { P: "priza", L: "iluminat", I: "intrerupator", D: "consumator_dedicat", S: "curenti_slabi", C: "comanda", A: "altul" };
const fnColor = (f: PointFunction) => (f === "J" ? BOX_COLOR.DD : DEVICE_COLOR[FN_CATEGORY[f]]);
const usageColor = (u: Circuit["usage"]) => DEVICE_COLOR[u === "prize" ? "priza" : u === "iluminat" ? "iluminat" : u === "dedicat" ? "consumator_dedicat" : u === "curenti_slabi" ? "curenti_slabi" : "altul"];

function FnBadge({ f, size = "sm" }: { f: PointFunction; size?: "sm" | "md" }) {
  const c = fnColor(f);
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded font-bold", size === "sm" ? (f === "J" ? "h-5 w-6 text-[9.5px]" : "h-5 w-5 text-[11px]") : "h-7 w-7 text-sm")} style={{ background: c.c, color: "#fff" }} title={FUNCTION_LABEL[f]}>
      {f === "J" ? "DD" : f}
    </span>
  );
}

function CircuitChip({ p, id }: { p: Project; id: string | null }) {
  if (!id) return <span className="rounded border border-dashed border-amber-400 px-1.5 text-[11px] text-amber-700">fara circuit</span>;
  const c = p.circuits.find((x) => x.id === id);
  if (!c) return null;
  const col = usageColor(c.usage);
  return (
    <span className="whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: col.bg, color: col.c }} title={c.name}>
      {c.code}
    </span>
  );
}

function FnCounts({ stats }: { stats: { byFunction: Partial<Record<PointFunction, number>> } }) {
  const order: PointFunction[] = ["P", "L", "I", "D", "S", "C", "A", "J"];
  return (
    <span className="flex flex-wrap gap-1">
      {order
        .filter((f) => stats.byFunction[f])
        .map((f) => {
          const c = fnColor(f);
          return (
            <span key={f} className="rounded px-1 text-[10.5px] font-semibold" style={{ background: c.bg, color: c.c }}>
              {stats.byFunction[f]}
              {f === "J" ? "DD" : f}
            </span>
          );
        })}
    </span>
  );
}

/* ============================== PAGINA ============================== */

function InstallPage() {
  const p = useActiveProject()!;
  const [tab, setTab] = useState<"puncte" | "circuite" | "aparataj" | "estimare">("puncte");
  const stats = useMemo(() => {
    const all = p.rooms.map((r) => roomItemStats(p, r.id));
    const byFunction: Partial<Record<PointFunction, number>> = {};
    for (const st of all) for (const [k, v] of Object.entries(st.byFunction)) byFunction[k as PointFunction] = (byFunction[k as PointFunction] ?? 0) + (v ?? 0);
    return { total: all.reduce((a, b) => a + b.total, 0), unassigned: all.reduce((a, b) => a + b.unassigned, 0), byFunction };
  }, [p]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--accent)" }}>Puncte si circuite</h1>
          <p className="text-sm text-ink-2">Faza la rosu: pui dozele si punctele de iluminat pe camere, ordonezi traseul fiecarui circuit, apoi aparatajul in faza la gata.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{stats.total} doze si puncte</span>
          <FnCounts stats={stats} />
          <span>· {p.circuits.length} circuite</span>
          {stats.unassigned > 0 && <Badge tone="warn">{stats.unassigned} fara circuit</Badge>}
        </div>
      </div>
      <Tabs
        tabs={[
          { id: "puncte", label: "Doze si puncte", count: stats.total },
          { id: "circuite", label: "Circuite", count: p.circuits.length },
          { id: "aparataj", label: "Aparataj (la gata)", count: p.devices.filter((d) => !d.placeholder && (d.boxId || d.category !== "iluminat")).length },
          { id: "estimare", label: "Estimare si optiuni" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "puncte" && <PointsBrowser p={p} />}
      {tab === "circuite" && <CircuitsTab p={p} />}
      {tab === "aparataj" && <FinishTab p={p} />}
      {tab === "estimare" && <EstimateTab p={p} />}
    </div>
  );
}

/* ============================ NAVIGATOR ============================= */

function Column({ title, children, className, action }: { title: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div className={cx("min-w-0 border-line lg:border-r", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line bg-paper/60 px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">{title}</span>
        {action}
      </div>
      <div className="p-1.5">{children}</div>
    </div>
  );
}

function Row({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm lg:min-h-9", active ? "text-white" : "hover:bg-paper")}
      style={active ? { background: "var(--accent)" } : undefined}
    >
      {children}
    </button>
  );
}

function InlineAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [v, setV] = useState("");
  const go = () => {
    if (!v.trim()) return;
    onAdd(v.trim());
    setV("");
  };
  return (
    <form
      className="mt-1 flex gap-1 px-1"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <TextInput value={v} onChange={setV} placeholder={placeholder} className="min-w-0 flex-1" />
      <Button type="submit" size="sm" className="h-8">
        +
      </Button>
    </form>
  );
}

function PointsBrowser({ p }: { p: Project }) {
  const up = useUpdateActive();
  const levels = useMemo(() => [...p.levels].sort((a, b) => a.elevation - b.elevation || a.order - b.order), [p.levels]);
  const [levelId, setLevelId] = useState<string | null>(levels[0]?.id ?? null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [pointId, setPointId] = useState<string | null>(null);

  const level = p.levels.find((l) => l.id === levelId) ?? null;
  const rooms = p.rooms.filter((r) => r.levelId === level?.id);
  const room = p.rooms.find((r) => r.id === roomId && r.levelId === level?.id) ?? null;
  const selBox = p.boxes.find((b) => b.id === pointId && b.roomId === room?.id) ?? null;
  const selDev = selBox ? null : (p.devices.find((d) => d.id === pointId && d.roomId === room?.id) ?? null);
  const point = selBox ?? selDev;
  const selCat = selBox ? boxCategory(p, selBox.id) : selDev?.category ?? null;
  const selCircuit = selBox ? boxCircuitId(p, selBox.id) : selDev?.circuitId ?? null;
  // pe telefon se vede coloana cea mai adanca selectata
  const depth = point ? 3 : room ? 2 : level ? 1 : 0;
  const show = (col: number) => (col === depth ? "block" : "hidden lg:block");
  const bName = (id: string) => (p.buildings.length > 1 ? p.buildings.find((b) => b.id === id)?.name + " / " : "");

  const addLevel = (name: string) =>
    up((x) => {
      let b = x.buildings[0];
      if (!b) {
        b = newBuilding(x, "Cladire principala", x.info.kind);
        x.buildings.push(b);
      }
      const lv = newLevel(x, b.id, name, x.levels.filter((l) => l.buildingId === b.id).length);
      x.levels.push(lv);
      setLevelId(lv.id);
      setRoomId(null);
    }, `Nivel ${name}`);
  const addRoom = (name: string) =>
    level &&
    up((x) => {
      const r = newRoom(x, level.id, name, null, null, null, null);
      x.rooms.push(r);
      setRoomId(r.id);
      setPointId(null);
    }, `Incapere ${name}`);

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      {/* calea de navigare */}
      <div className="flex min-h-11 flex-wrap items-center gap-1 border-b border-line px-2 py-1 text-sm">
        {depth > 0 && (
          <button
            className="mr-1 rounded-md border border-line px-2.5 py-1 lg:hidden"
            onClick={() => (point ? setPointId(null) : room ? setRoomId(null) : setLevelId(null))}
            aria-label="Inapoi"
          >
            ‹ Inapoi
          </button>
        )}
        <button className="rounded px-1.5 py-1 hover:bg-paper" onClick={() => { setLevelId(null); setRoomId(null); setPointId(null); }}>
          {p.info.name}
        </button>
        {level && (
          <>
            <span className="text-ink-3">›</span>
            <button className="rounded px-1.5 py-1 hover:bg-paper" onClick={() => { setRoomId(null); setPointId(null); }}>
              {bName(level.buildingId)}{level.name}
            </button>
          </>
        )}
        {room && (
          <>
            <span className="text-ink-3">›</span>
            <button className="rounded px-1.5 py-1 hover:bg-paper" onClick={() => setPointId(null)}>
              {room.name}
            </button>
          </>
        )}
        {point && (
          <>
            <span className="text-ink-3">›</span>
            <span className="flex items-center gap-1.5 px-1.5 font-semibold">
              <FnBadge f={selCat ? FUNCTION_OF[selCat] : selBox?.kind === "DD" ? "J" : "A"} />
              {selBox ? `${selBox.code} · ${p.library.boxTypes.find((t) => t.id === selBox.boxTypeId)?.name ?? "doza"}` : `${selDev!.code} · ${selDev!.label}`}
            </span>
            <span className="ml-auto">
              {!(selBox?.kind === "DD" && !selCat) && <CircuitChip p={p} id={selCircuit} />}
            </span>
          </>
        )}
      </div>

      <div className="lg:grid lg:min-h-[480px] lg:grid-cols-[170px_220px_minmax(0,1fr)_320px]">
        {/* niveluri */}
        <Column title="Nivel" className={show(0)}>
          {levels.map((l) => (
            <Row key={l.id} active={l.id === level?.id} onClick={() => { setLevelId(l.id); setRoomId(null); setPointId(null); }}>
              <span className="min-w-0 flex-1 truncate">{bName(l.buildingId)}{l.name}</span>
              <span className="text-[11px] opacity-70">{levelItems(p, l.id)}</span>
              <span className="opacity-60">›</span>
            </Row>
          ))}
          {levels.length === 0 && <p className="px-2 py-3 text-xs text-ink-3">Niciun nivel. Adauga unul (ex. Parter) sau foloseste un sablon din Cladire si incaperi.</p>}
          <InlineAdd placeholder="Nivel nou" onAdd={addLevel} />
        </Column>

        {/* incaperi */}
        <Column title="Incapere" className={show(1)}>
          {!level ? (
            <p className="px-2 py-3 text-xs text-ink-3">Alege un nivel.</p>
          ) : (
            <>
              {rooms.map((r) => {
                const st = roomItemStats(p, r.id);
                const active = r.id === room?.id;
                return (
                  <Row key={r.id} active={active} onClick={() => { setRoomId(r.id); setPointId(null); }}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{r.name}</span>
                      {st.total > 0 && !active && <FnCounts stats={st} />}
                    </span>
                    <span className="text-[11px] opacity-70">{st.total}</span>
                    <span className="opacity-60">›</span>
                  </Row>
                );
              })}
              {rooms.length === 0 && <p className="px-2 py-3 text-xs text-ink-3">Nicio incapere pe acest nivel.</p>}
              <InlineAdd placeholder="Incapere noua" onAdd={addRoom} />
            </>
          )}
        </Column>

        {/* puncte */}
        <Column title={room ? `Doze si puncte ${room.name}` : "Doze si puncte"} className={show(2)}>
          {!room ? <p className="px-2 py-3 text-xs text-ink-3">Alege o incapere.</p> : <RoomItems p={p} up={up} roomId={room.id} selected={point?.id ?? null} onSelect={setPointId} />}
        </Column>

        {/* detaliu */}
        <Column title="Detaliu" className={cx(show(3), "lg:border-r-0")}>
          {selBox ? (
            <BoxDetail key={selBox.id} p={p} up={up} boxId={selBox.id} onDeleted={() => setPointId(null)} />
          ) : selDev ? (
            <PointDetail key={selDev.id} p={p} up={up} d={selDev} onDeleted={() => setPointId(null)} />
          ) : room ? (
            <RoomSummary p={p} roomId={room.id} />
          ) : (
            <p className="px-2 py-3 text-xs text-ink-3">Alege o doza sau un punct pentru detalii.</p>
          )}
        </Column>
      </div>
    </div>
  );
}

/* -------------------------- doze si puncte ------------------------- */

interface ItemStats {
  total: number;
  byFunction: Partial<Record<PointFunction, number>>;
  unassigned: number;
}

/** statistici pe incapere: doze (dupa destinatie) + puncte fara doza */
function roomItemStats(p: Project, roomId: string): ItemStats {
  const byFunction: Partial<Record<PointFunction, number>> = {};
  let unassigned = 0;
  const inc = (f: PointFunction) => (byFunction[f] = (byFunction[f] ?? 0) + 1);
  for (const b of p.boxes.filter((x) => x.roomId === roomId)) {
    const cat = boxCategory(p, b.id);
    if (b.kind === "DD" && !cat) {
      inc("J");
      continue;
    }
    inc(cat ? FUNCTION_OF[cat] : "A");
    if (cat && cat !== "curenti_slabi" && !boxCircuitId(p, b.id)) unassigned++;
  }
  for (const d of p.devices.filter((x) => x.roomId === roomId && !x.boxId)) {
    inc(pointFunction(d));
    if (!d.circuitId && d.category !== "curenti_slabi") unassigned++;
  }
  const total = Object.values(byFunction).reduce((a, b) => a + (b ?? 0), 0);
  return { total, byFunction, unassigned };
}

const levelItems = (p: Project, levelId: string) =>
  p.rooms.filter((r) => r.levelId === levelId).reduce((s, r) => s + roomItemStats(p, r.id).total, 0);

function QuickButton({ letter, label, sub, color, onClick, title }: { letter: string; label: string; sub?: string; color: { c: string; bg: string }; onClick: () => void; title: string }) {
  return (
    <button type="button" onClick={onClick} title={title} className="flex min-h-11 items-center gap-1.5 rounded-md border bg-white px-2 text-left text-[12.5px] active:scale-[0.98] lg:min-h-9" style={{ borderColor: color.c + "66" }}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white" style={{ background: color.c }}>
        {letter}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate">{label}</span>
        {sub && <span className="block truncate text-[10.5px] text-ink-3">{sub}</span>}
      </span>
      <span className="text-ink-3">+</span>
    </button>
  );
}

function RoomItems({ p, up, roomId, selected, onSelect }: { p: Project; up: Up; roomId: string; selected: string | null; onSelect: (id: string) => void }) {
  const lib = p.library;
  const purposes = lib.pointPurposes;
  const lights = lib.deviceTypes.filter((t) => t.category === "iluminat");
  const ddTypes = lib.boxTypes.filter((t) => t.kind === "DD");
  const updateLibrary = useApp((a) => a.updateLibrary);
  const restorePurposes = () => updateLibrary((l) => void (l.pointPurposes = structuredClone(createDefaultLibrary().pointPurposes)));
  const [code, setCode] = useState("");
  const [boxType, setBoxType] = useState("");
  const parsed = code.trim() ? parseQuickCode(lib, code) : null;
  const roomName = p.rooms.find((r) => r.id === roomId)?.name ?? "";
  const btName = (id: string | null) => lib.boxTypes.find((t) => t.id === id)?.name.replace(/^Doza aparat /, "") ?? "doza";

  const addBox = (ppId: string) => up((x) => void addBoxes(x, roomId, ppId, 1, boxType || null), `Doza ${purposes.find((x) => x.id === ppId)?.name} in ${roomName}`);
  const addLight = (typeId: string) => up((x) => void addPoints(x, roomId, typeId, 1), `${lights.find((t) => t.id === typeId)?.name} in ${roomName}`);
  const addCode = () => {
    if (!parsed || parsed.items.length === 0 || parsed.errors.length) return;
    up((x) => applyQuickItems(x, roomId, parsed.items), `Cod rapid ${code} in ${roomName}`);
    setCode("");
  };

  const boxes = p.boxes.filter((b) => b.roomId === roomId);
  const points = p.devices.filter((d) => d.roomId === roomId && !d.boxId);
  const order = "PDICERSLAJ";
  const rows = [
    ...boxes.map((b) => {
      const cat = boxCategory(p, b.id);
      const real = realBoxDevices(p, b.id);
      const cap = boxCapacity(p, b.id);
      return {
        id: b.id,
        f: (b.kind === "DD" && !cat ? "J" : cat ? FUNCTION_OF[cat] : "A") as PointFunction,
        code: b.code,
        title: btName(b.boxTypeId),
        sub: b.kind === "DD" && !cat ? `doza derivatie · ${circuitsThroughBox(p, b.id).map((c) => c.code).join(", ") || "niciun circuit"}` : real.length ? `${real.map((d) => d.label).join(" + ")} · ${cap.used}/${cap.modules} mod.` : cat ? FUNCTION_LABEL[FUNCTION_OF[cat]] + " · fara aparataj" : "goala",
        power: boxDevices(p, b.id).reduce((s, d) => s + (d.powerW.value ?? 0), 0),
        circuitId: boxCircuitId(p, b.id),
        slabi: cat === "curenti_slabi" || (b.kind === "DD" && !cat),
      };
    }),
    ...points.map((d) => ({ id: d.id, f: pointFunction(d), code: d.code, title: d.label, sub: "punct fara doza", power: d.powerW.value ?? 0, circuitId: d.circuitId, slabi: d.category === "curenti_slabi" })),
  ].sort((a, b) => order.indexOf(a.f) - order.indexOf(b.f) || a.code.localeCompare(b.code));

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-paper/70 p-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Doze</span>
          <Select className="w-auto min-w-0 max-w-[60%] text-[12px]" value={boxType} placeholder="tipul implicit al destinatiei" onChange={setBoxType} options={lib.boxTypes.filter((t) => t.kind === "DA").map((t) => ({ value: t.id, label: t.name }))} />
        </div>
        {purposes.length === 0 && (
          <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-[12px] text-amber-900">
            Biblioteca nu are destinatii de doza (priza, intrerupator, termostat...).{" "}
            <Button size="sm" onClick={restorePurposes}>
              Adauga destinatiile implicite
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {purposes.map((x) => (
            <QuickButton key={x.id} letter={x.shortcut || "·"} label={x.name.replace(/^Doza /, "")} sub={btName(boxType || x.boxTypeId)} color={DEVICE_COLOR[x.category]} onClick={() => addBox(x.id)} title={`Adauga ${x.name} (litera ${x.shortcut})`} />
          ))}
        </div>
        {ddTypes.length > 0 && (
          <>
            <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Doze de derivatie (DD)</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {ddTypes.map((t) => (
                <QuickButton key={t.id} letter="DD" label={t.name.replace(/^Doza derivatie /, "")} color={BOX_COLOR.DD} onClick={() => up((x) => void addJunctionBoxes(x, roomId, t.id, 1), `${t.name} in ${roomName}`)} title={`Adauga ${t.name}`} />
              ))}
            </div>
          </>
        )}
        <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Puncte de iluminat</p>
        {lights.length === 0 && <p className="text-[12px] text-amber-800">Biblioteca nu are tipuri de iluminat (Biblioteca → Aparate, categoria iluminat).</p>}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {lights.map((t) => (
            <QuickButton key={t.id} letter={t.shortcut || "·"} label={t.name.replace(/ \(alimentator\)/, "")} sub={[t.needsBox ? "cu doza" : "", t.suggestedPowerW ? `${t.suggestedPowerW} W` : ""].filter(Boolean).join(" · ") || undefined} color={DEVICE_COLOR.iluminat} onClick={() => addLight(t.id)} title={`Adauga ${t.name}`} />
          ))}
        </div>
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            addCode();
          }}
        >
          <TextInput value={code} onChange={setCode} placeholder="Cod rapid: 4P 1D 2L 2I" className="min-w-0 flex-1" />
          <Button type="submit" variant="primary" disabled={!parsed || !parsed.items.length || parsed.errors.length > 0}>
            Adauga
          </Button>
        </form>
        {parsed && (
          <p className={cx("mt-1 text-[11.5px]", parsed.errors.length ? "text-red-700" : "text-ink-2")}>
            {parsed.errors.length ? parsed.errors.join("; ") : parsed.items.map((i) => `${i.n} x ${i.name}`).join(", ")}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="px-2 py-2 text-xs text-ink-3">Nicio doza in aceasta incapere.</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onSelect(r.id)} className={cx("flex min-h-11 w-full items-center gap-2 px-2 py-1.5 text-left text-sm lg:min-h-9", selected === r.id ? "bg-[var(--accent-bg)]" : "hover:bg-paper")}>
                <FnBadge f={r.f} />
                <span className="w-12 shrink-0 font-mono text-[11.5px] text-ink-2">{r.code}</span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate">{r.title}</span>
                  <span className="block truncate text-[11px] text-ink-3">{r.sub}</span>
                </span>
                <span className="hidden w-14 text-right text-[12px] tabular-nums text-ink-2 sm:block">{r.power ? `${fmtNum(r.power, 0)} W` : ""}</span>
                {r.slabi ? <span className="text-[11px] text-ink-3">{r.f === "J" ? "" : "curenti slabi"}</span> : <CircuitChip p={p} id={r.circuitId} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CircuitSelect({ p, category, value, onChange, hint }: { p: Project; category: DeviceCategory; value: string | null; onChange: (id: string | null) => void; hint: string }) {
  const loads = allCircuitLoads(p);
  const compatible = p.circuits.filter((c) => (category === "consumator_dedicat" ? true : category === "iluminat" || category === "intrerupator" || category === "comanda" ? c.usage === "iluminat" : category === "priza" ? c.usage === "prize" : true));
  const others = p.circuits.filter((c) => !compatible.includes(c));
  return (
    <Field label="Circuit" hint={hint}>
      <Select
        value={value ?? ""}
        placeholder="fara circuit (se imparte automat)"
        onChange={(v) => onChange(v || null)}
        options={[...compatible, ...others].map((c) => {
          const l = loads.find((x) => x.circuit.id === c.id);
          return { value: c.id, label: `${c.code} ${c.name} · ${circuitLimitPoints(p, c)} puncte${l?.installed.value ? ` · ${fmtNum(l.installed.value, 0)} W` : ""}${others.includes(c) ? " (alt tip)" : ""}` };
        })}
      />
    </Field>
  );
}

function BoxDetail({ p, up, boxId, onDeleted }: { p: Project; up: Up; boxId: string; onDeleted: () => void }) {
  const lib = p.library;
  const box = p.boxes.find((b) => b.id === boxId)!;
  const devs = boxDevices(p, boxId);
  const real = devs.filter((d) => !d.placeholder);
  const ph = devs.find((d) => d.placeholder);
  const cat = boxCategory(p, boxId);
  const cap = boxCapacity(p, boxId);
  const circuitId = boxCircuitId(p, boxId);
  const locked = devs.some((d) => d.circuitLocked);
  const [aparat, setAparat] = useState("");
  const [err, setErr] = useState("");
  const purposeNow = lib.pointPurposes.find((x) => x.id === box.purposeId) ?? lib.pointPurposes.find((x) => ph && x.category === ph.category);
  // aparatajul care se poate pune in doza: tot ce nu este punct de iluminat fara doza
  const candidates = lib.deviceTypes.filter((t) => t.needsBox || t.category !== "iluminat");
  const fitsType = (t: (typeof candidates)[number]) => box.modules === 0 || t.modules <= cap.free;
  const setDev = (id: string, fn: (x: Device) => void) => up((x) => { const t = x.devices.find((y) => y.id === id); if (t) fn(t); });

  if (box.kind === "DD" && devs.length === 0) {
    const through = circuitsThroughBox(p, boxId);
    return (
      <div className="space-y-3 px-1 py-1">
        <Field label="Tip doza derivatie">
          <Select
            value={box.boxTypeId ?? ""}
            onChange={(v) => up((x) => void (x.boxes.find((y) => y.id === boxId)!.boxTypeId = v), `Tip doza ${box.code}`)}
            options={lib.boxTypes.filter((t) => t.kind === "DD").map((t) => ({ value: t.id, label: t.name }))}
          />
        </Field>
        <div className="rounded-md border border-line p-2">
          <p className="mb-1 text-[12px] font-semibold">Circuite care trec prin doza</p>
          {p.circuits.length === 0 ? (
            <p className="text-[12px] text-ink-3">Niciun circuit inca. Imparte dozele pe circuite, apoi bifeaza aici.</p>
          ) : (
            <div className="space-y-1">
              {p.circuits.map((c) => (
                <Checkbox key={c.id} checked={through.includes(c)} onChange={(v) => up((x) => setCircuitThroughBox(x, c.id, boxId, v), `${box.code} pe ${c.code}`)} label={`${c.code} ${c.name}`} />
              ))}
            </div>
          )}
          <p className="mt-1 text-[11px] text-ink-3">Doza intra in traseul circuitului (fila Circuite), unde ii stabilesti pozitia in lant si metrii.</p>
        </div>
        <Field label="Pozitie / observatii">
          <TextInput value={box.position} onChange={(v) => up((x) => void (x.boxes.find((y) => y.id === boxId)!.position = v))} placeholder="perete, inaltime, deasupra usii" />
        </Field>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={() => box.boxTypeId && up((x) => void addJunctionBoxes(x, box.roomId, box.boxTypeId!, 1), "Doza derivatie duplicata")}>+ Inca una la fel</Button>
          <ConfirmButton size="md" onConfirm={() => { up((x) => removeBox(x, boxId), `Doza ${box.code} stearsa`); onDeleted(); }}>
            Sterge doza
          </ConfirmButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-1 py-1">
      <Field label="Tip doza" hint={`${box.modules} module`}>
        <Select
          value={box.boxTypeId ?? ""}
          onChange={(v) => up((x) => { const b = x.boxes.find((y) => y.id === boxId); if (b) { b.boxTypeId = v; b.modules = lib.boxTypes.find((t) => t.id === v)?.modules ?? b.modules; } }, `Tip doza ${box.code}`)}
          options={lib.boxTypes.filter((t) => t.kind === "DA").map((t) => ({ value: t.id, label: `${t.name} (${t.modules} mod.)` }))}
        />
      </Field>
      {real.length === 0 && (
        <Field label="Destinatie" hint={ph ? "se poate schimba cat timp doza nu are aparataj" : "doza goala: alege ce va fi in ea"}>
          <Select value={purposeNow?.id ?? ""} placeholder={cat ? FUNCTION_LABEL[FUNCTION_OF[cat]] : "—"} onChange={(v) => up((x) => setBoxPurpose(x, boxId, v), `Destinatie ${box.code}`)} options={lib.pointPurposes.map((x) => ({ value: x.id, label: x.name }))} />
        </Field>
      )}
      {ph && ph.category !== "intrerupator" && ph.category !== "curenti_slabi" && (
        <Field label="Consum estimat" hint={ph.powerW.provenance === "estimat" ? "consum mediu al destinatiei (Biblioteca)" : "introdus pe doza"}>
          <NumberInput value={ph.powerW.value} suffix="W" onChange={(v) => setDev(ph.id, (x) => void (x.powerW = tracked(v, "proiectant")))} />
        </Field>
      )}
      {cat && cat !== "curenti_slabi" && (
        <CircuitSelect p={p} category={cat} value={circuitId} onChange={(v) => up((x) => moveBox(x, boxId, v), `Doza ${box.code} mutata`)} hint={locked ? "ales manual: impartirea automata nu o muta" : "automat: se poate schimba manual"} />
      )}

      <div className="rounded-md border border-line p-2">
        <div className="mb-1 flex items-center justify-between text-[12px]">
          <span className="font-semibold">Aparataj (faza la gata)</span>
          <span className={cx("tabular-nums", cap.free < 0 ? "text-red-700" : "text-ink-2")}>
            {cap.used}/{cap.modules} module
          </span>
        </div>
        {real.length === 0 ? (
          <p className="text-[12px] text-ink-3">Fara aparataj. La faza la rosu doza se oferteaza doar ca doza, cablu si legare.</p>
        ) : (
          <ul className="space-y-1">
            {real.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-[12.5px]">
                <FnBadge f={pointFunction(d)} />
                <span className="min-w-0 flex-1 truncate">{d.label}</span>
                <span className="text-[11px] text-ink-3">{d.modules} mod.</span>
                <button className="rounded px-1.5 text-ink-3 hover:bg-paper hover:text-red-700" title="Scoate din doza" onClick={() => up((x) => removeDeviceFromBox(x, d.id), `${d.label} scos din ${box.code}`)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex gap-1.5">
          <Select
            className="min-w-0 flex-1"
            value={aparat}
            placeholder={!candidates.length ? "nu exista aparate in Biblioteca" : cap.free <= 0 && box.modules > 0 ? "doza este plina" : "Alege aparatul"}
            onChange={(v) => { setAparat(v); setErr(""); }}
            options={[...candidates].sort((a, b) => Number(!fitsType(a)) - Number(!fitsType(b))).map((t) => ({ value: t.id, label: `${t.name} (${t.modules} mod.)${fitsType(t) ? "" : " - nu incape"}` }))}
          />
          <Button
            disabled={!aparat}
            onClick={() => {
              let res: { ok: boolean; message?: string } = { ok: true };
              up((x) => void (res = addDeviceToBox(x, boxId, aparat)), `Aparat pus in ${box.code}`);
              if (!res.ok) setErr(res.message ?? "");
              else setAparat("");
            }}
          >
            Pune
          </Button>
        </div>
        {err && <p className="mt-1 text-[11.5px] text-red-700">{err}</p>}
        {real.length > 0 && (
          <div className="mt-2 space-y-1">
            {real.filter((d) => d.category !== "intrerupator" && d.category !== "curenti_slabi").map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate text-ink-2">Putere {d.label}</span>
                <div className="w-28">
                  <NumberInput value={d.powerW.value} suffix="W" onChange={(v) => setDev(d.id, (x) => void (x.powerW = tracked(v, "proiectant")))} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Field label="Pozitie / observatii">
        <TextInput value={box.position} onChange={(v) => up((x) => void (x.boxes.find((y) => y.id === boxId)!.position = v))} placeholder="perete, inaltime, langa usa" />
      </Field>
      <div className="flex flex-wrap gap-2 pt-1">
        {purposeNow && (
          <Button onClick={() => up((x) => void addBoxes(x, box.roomId, purposeNow.id, 1, box.boxTypeId), "Doza duplicata")}>+ Inca una la fel</Button>
        )}
        <ConfirmButton size="md" onConfirm={() => { up((x) => removeBox(x, boxId), `Doza ${box.code} stearsa`); onDeleted(); }}>
          Sterge doza
        </ConfirmButton>
      </div>
    </div>
  );
}

function PointDetail({ p, up, d, onDeleted }: { p: Project; up: Up; d: Device; onDeleted: () => void }) {
  const lib = p.library;
  const set = (fn: (x: Device) => void, h?: string) => up((x) => { const t = x.devices.find((y) => y.id === d.id); if (t) fn(t); }, h);
  return (
    <div className="space-y-3 px-1 py-1">
      <Field label="Tip punct">
        <Select value={d.deviceTypeId ?? ""} onChange={(v) => up((x) => changePointType(x, d.id, v), "Tip punct schimbat")} options={lib.deviceTypes.filter((t) => !t.needsBox).map((t) => ({ value: t.id, label: `${FUNCTION_LABEL[pointFunction(t)]}: ${t.name}` }))} />
      </Field>
      <Field label="Denumire">
        <TextInput value={d.label} onChange={(v) => set((x) => void (x.label = v))} />
      </Field>
      {d.category !== "curenti_slabi" && (
        <Field label="Putere" hint={d.powerW.provenance === "estimat" ? "consum mediu din biblioteca (estimat)" : "introdusa pe punct"}>
          <NumberInput value={d.powerW.value} suffix="W" onChange={(v) => set((x) => void (x.powerW = tracked(v, "proiectant")))} />
        </Field>
      )}
      {d.category !== "curenti_slabi" && <CircuitSelect p={p} category={d.category} value={d.circuitId} onChange={(v) => up((x) => moveDevice(x, d.id, v), "Punct mutat pe alt circuit")} hint={d.circuitLocked ? "ales manual: impartirea automata nu il muta" : "automat: se poate schimba manual"} />}
      <Field label="Observatii">
        <TextInput value={d.notes} onChange={(v) => set((x) => void (x.notes = v))} placeholder="pozitie, inaltime, detalii" />
      </Field>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button onClick={() => d.deviceTypeId && up((x) => void addPoints(x, d.roomId, d.deviceTypeId!, 1), "Punct duplicat")}>+ Inca unul la fel</Button>
        <ConfirmButton size="md" onConfirm={() => { up((x) => removePoint(x, d.id), `Punct ${d.code} sters`); onDeleted(); }}>
          Sterge punctul
        </ConfirmButton>
      </div>
    </div>
  );
}

function RoomSummary({ p, roomId }: { p: Project; roomId: string }) {
  const st = roomItemStats(p, roomId);
  const devs = roomDevices(p, roomId);
  const circuits = [...new Set(devs.map((d) => d.circuitId).filter(Boolean))].map((id) => p.circuits.find((c) => c.id === id)!).filter(Boolean);
  const power = devs.reduce((s, d) => s + (d.powerW.value ?? 0), 0);
  const boxesN = p.boxes.filter((b) => b.roomId === roomId).length;
  return (
    <div className="space-y-2 px-1 py-1 text-sm">
      <p>
        <b>{boxesN}</b> doze, <b>{st.total - boxesN}</b> puncte fara doza, putere estimata <b>{fmtNum(power, 0)} W</b>
      </p>
      <FnCounts stats={st} />
      {st.unassigned > 0 && <p className="text-amber-700">{st.unassigned} fara circuit - foloseste „Imparte automat” din fila Circuite.</p>}
      {circuits.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Circuite in incapere</p>
          <div className="flex flex-wrap gap-1">
            {circuits.map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <CircuitChip p={p} id={c.id} />
                <span className="text-[12px] text-ink-2">{c.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="pt-2 text-[11px] text-ink-3">Dimensiunile si tipul de perete se completeaza in Cladire si incaperi.</p>
    </div>
  );
}

/* ============================= CIRCUITE ============================= */

function CircuitsTab({ p }: { p: Project }) {
  const up = useUpdateActive();
  const [msg, setMsg] = useState("");
  const loads = allCircuitLoads(p);
  const unassigned = p.devices.filter((d) => !d.circuitId && d.category !== "curenti_slabi").length;
  const orphan = p.circuits.filter((c) => !c.panelId).length;

  const run = (mode: "completeaza" | "reorganizeaza") =>
    up((x) => {
      const r = generateCircuits(x, mode);
      // consumatori dedicati noi: propunere de cablu si protectie (reguli de validat, se verifica in Tablouri)
      let sized = 0;
      for (const code of r.created) {
        const c = x.circuits.find((y) => y.code === code);
        if (!c || c.usage !== "dedicat") continue;
        const prop = proposeSizing(x, c);
        if (prop.ok) {
          applySizing(x, c.id, prop);
          sized++;
        }
      }
      setMsg(`${r.assigned} puncte asociate${sized ? `, ${sized} consumatori dedicati dimensionati automat` : ""}${r.created.length ? `, circuite noi: ${r.created.join(", ")}` : ""}${r.removed.length ? `, eliminate: ${r.removed.join(", ")}` : ""}.`);
    }, mode === "completeaza" ? "Impartire automata pe circuite" : "Reorganizare circuite");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-3">
        <Button variant="primary" onClick={() => run("completeaza")}>
          Imparte automat pe circuite{unassigned ? ` (${unassigned})` : ""}
        </Button>
        <ConfirmButton size="md" label="Da, reorganizeaza" onConfirm={() => run("reorganizeaza")}>
          Reorganizeaza tot
        </ConfirmButton>
        <span className="text-xs text-ink-2">
          Maxim {p.fast.maxPointsPerCircuit} puncte pe circuit de prize / iluminat (intrerupatoarele nu se numara), o incapere ramane pe acelasi circuit cand incape; consumatorii dedicati pe circuit propriu, cu cablu si protectie propuse din putere. Punctele mutate manual raman pe loc.
        </span>
        {msg && <p className="w-full text-sm text-ok">{msg}</p>}
      </div>
      {p.panels.length === 0 && p.circuits.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Circuitele nu au tablou.
          <Button
            size="sm"
            onClick={() =>
              up((x) => {
                const t = newPanel(x, "Tablou general", null, null);
                x.panels.push(t);
                for (const c of x.circuits) c.panelId ??= t.id;
              }, "Tablou general creat")
            }
          >
            Creeaza tabloul general
          </Button>
        </div>
      )}
      {orphan > 0 && p.panels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {orphan} circuite fara tablou.
          <Button size="sm" onClick={() => up((x) => { for (const c of x.circuits) c.panelId ??= x.panels[0].id; })}>
            Leaga-le de {p.panels[0].code}
          </Button>
        </div>
      )}
      {loads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm text-ink-3">Niciun circuit. Adauga puncte in camere, apoi „Imparte automat pe circuite”.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {loads.map((l) => (
            <CircuitCard key={l.circuit.id} p={p} up={up} l={l} />
          ))}
        </div>
      )}
      <p className="text-xs text-ink-3">
        Dimensionarea detaliata (protectie, ΔU, I&apos;z) si echiparea tabloului se fac in <Link className="underline" href="/tablouri">Tablouri si scheme</Link>. Pentru circuite fara puncte (inlocuire tablou) foloseste <Link className="underline" href="/circuite">Circuite (detaliat)</Link>.
      </p>
    </div>
  );
}

function ChainEditor({ p, up, c }: { p: Project; up: Up; c: Circuit }) {
  const links = resolveChain(p, c);
  const panel = p.panels.find((t) => t.id === c.panelId);
  const roomName = (id: string) => p.rooms.find((r) => r.id === id)?.name ?? "";
  const fnOf = (l: (typeof links)[number]) => {
    if (l.kind === "doza") {
      const cat = boxCategory(p, l.memberId);
      if (!cat && p.boxes.find((b) => b.id === l.memberId)?.kind === "DD") return "J" as PointFunction;
      return (cat ? FUNCTION_OF[cat] : "A") as PointFunction;
    }
    const d = p.devices.find((x) => x.id === l.memberId);
    return d ? pointFunction(d) : "A";
  };
  if (!links.length) return <p className="text-[12px] text-ink-3">Circuit fara doze sau puncte.</p>;
  return (
    <div className="rounded-md border border-line">
      <div className="flex items-center justify-between border-b border-line bg-paper/60 px-2 py-1 text-[11px] text-ink-2">
        <span>Traseu: {panel?.code ?? "tablou"} → ...</span>
        <span>metri pe legatura</span>
      </div>
      <ol>
        {links.map((l, i) => (
          <li key={l.memberId} className="flex items-center gap-1.5 border-b border-line px-2 py-1 last:border-b-0">
            <span className="w-5 text-right text-[10.5px] text-ink-3">{i + 1}</span>
            <FnBadge f={fnOf(l)} />
            <span className="min-w-0 flex-1 truncate text-[12px]">
              <span className="font-mono">{l.code}</span> <span className="text-ink-3">{roomName(l.roomId)}</span>
            </span>
            <div className="w-24 shrink-0">
              <NumberInput
                value={l.estimated ? null : l.lengthM.value}
                placeholder={`≈ ${fmtNum(l.effectiveM, 1)}`}
                suffix="m"
                onChange={(v) => up((x) => setLinkLength(x, c.id, l.memberId, v), `Legatura ${l.code}`)}
              />
            </div>
            <button className="h-8 w-7 rounded border border-line text-[12px] disabled:opacity-30" disabled={i === 0} aria-label="Muta sus" onClick={() => up((x) => moveInChain(x, c.id, l.memberId, -1))}>
              ▲
            </button>
            <button className="h-8 w-7 rounded border border-line text-[12px] disabled:opacity-30" disabled={i === links.length - 1} aria-label="Muta jos" onClick={() => up((x) => moveInChain(x, c.id, l.memberId, 1))}>
              ▼
            </button>
          </li>
        ))}
      </ol>
      <p className="px-2 py-1 text-[10.5px] text-ink-3">Prima legatura porneste din tablou. Gol = estimat din setarile proiectului.</p>
    </div>
  );
}

function CircuitCard({ p, up, l }: { p: Project; up: Up; l: CircuitLoad }) {
  const c = l.circuit;
  const col = usageColor(c.usage);
  const lib = p.library;
  const set = (fn: (x: Circuit) => void, h?: string) => up((x) => { const t = x.circuits.find((y) => y.id === c.id); if (t) fn(t); }, h);
  const pts = circuitEndPoints(p, c);
  const limitPts = circuitLimitPoints(p, c);
  const over = (c.usage === "prize" || c.usage === "iluminat") && p.fast.maxPointsPerCircuit > 0 && limitPts > p.fast.maxPointsPerCircuit;
  const auto = autoCircuitLength(p, c);
  const measured = c.estimatedLengthM.value !== null;
  const fam = p.fast.cableFamily.toUpperCase();
  const cables = [...lib.cableTypes].sort((a, b) => (a.name.toUpperCase().startsWith(fam + " ") ? 0 : 1) - (b.name.toUpperCase().startsWith(fam + " ") ? 0 : 1) || a.crossSectionMm2 - b.crossSectionMm2);
  const rooms = [...new Set(l.devices.map((d) => p.rooms.find((r) => r.id === d.roomId)?.name).filter(Boolean))];

  return (
    <div className="overflow-hidden rounded-lg border bg-white" style={{ borderColor: col.c + "55" }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: col.bg }}>
        <span className="font-mono text-sm font-bold" style={{ color: col.c }}>{c.code}</span>
        <TextInput value={c.name} onChange={(v) => set((x) => void (x.name = v))} className="flex-1 bg-white/80" />
      </div>
      <div className="space-y-2 p-3 text-sm">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
          <span className={cx(over && "font-semibold text-red-700")} title="doze / puncte de legat; intrerupatoarele nu se numara la limita">
            {limitPts}
            {pts !== limitPts ? ` + ${pts - limitPts} intr.` : ""} puncte{over ? ` (max ${p.fast.maxPointsPerCircuit})` : ""}
          </span>
          <span>Pi {l.installed.value === null ? NA : fmtNum(l.installed.value, 0) + " W"}</span>
          <span>Pa {l.appliedW === null ? NA : fmtNum(l.appliedW, 0) + " W"}</span>
          <span>Ic {l.designCurrentA === null ? NA : fmtNum(l.designCurrentA, 1) + " A"}</span>
          {c.protection.ratingA && <span>{c.protection.curve ?? ""}{c.protection.ratingA} A</span>}
        </div>
        {rooms.length > 0 && <p className="text-[12px] text-ink-2">{rooms.join(", ")}</p>}
        <ChainEditor p={p} up={up} c={c} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Cablu">
            <Select value={c.cableTypeId ?? ""} placeholder="de stabilit" onChange={(v) => set((x) => { x.cableTypeId = v || null; if (!x.lockedFields.includes("cableTypeId")) x.lockedFields.push("cableTypeId"); }, `Cablu ${c.code}`)} options={cables.map((t) => ({ value: t.id, label: t.name }))} />
          </Field>
          <Field label={measured ? "Lungime totala masurata" : "Lungime totala"} hint={measured ? "introdusa pe circuit, inlocuieste lantul" : auto !== null ? `din lant ${fmtNum(auto, 1)} m` : undefined}>
            <div className="flex gap-1">
              <NumberInput value={c.estimatedLengthM.value} placeholder={auto !== null ? `≈ ${fmtNum(auto, 1)}` : "—"} suffix="m" onChange={(v) => set((x) => void (x.estimatedLengthM = tracked(v, "masurat")), `Lungime ${c.code}`)} />
              {measured && (
                <Button size="sm" className="h-8" title="Revino la estimare" onClick={() => set((x) => void (x.estimatedLengthM = tracked<number>(null, "estimat")))}>
                  ↺
                </Button>
              )}
            </div>
          </Field>
        </div>
        {p.panels.length > 1 && (
          <Field label="Tablou">
            <Select value={c.panelId ?? ""} placeholder="fara tablou" onChange={(v) => set((x) => void (x.panelId = v || null))} options={p.panels.map((t) => ({ value: t.id, label: `${t.code} ${t.name}` }))} />
          </Field>
        )}
        {l.warnings.length > 0 && <p className="text-[11.5px] text-amber-700">{l.warnings.join("; ")}</p>}
      </div>
    </div>
  );
}

/* ====================== APARATAJ - FAZA LA GATA ===================== */

function FinishTab({ p }: { p: Project }) {
  const up = useUpdateActive();
  const lib = p.library;
  const [msg, setMsg] = useState("");
  const da = p.boxes.filter((b) => b.kind === "DA");
  const rows = da.map((b) => {
    const real = realBoxDevices(p, b.id);
    const pp = lib.pointPurposes.find((x) => x.id === b.purposeId);
    const defaults = (pp?.deviceTypeIds ?? []).map((id) => lib.deviceTypes.find((t) => t.id === id)?.name).filter(Boolean) as string[];
    return { b, real, pp, defaults, cat: boxCategory(p, b.id), cap: boxCapacity(p, b.id) };
  });
  const empty = rows.filter((r) => r.real.length === 0);
  const fillable = empty.filter((r) => r.defaults.length > 0);
  const lights = p.devices.filter((d) => !d.boxId && d.category === "iluminat");
  const gataOn = p.info.phases.includes("gata");
  const roomName = (id: string) => p.rooms.find((r) => r.id === id)?.name ?? "";
  const byRoom = p.rooms.map((r) => ({ r, rows: rows.filter((x) => x.b.roomId === r.id) })).filter((g) => g.rows.length);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={!fillable.length}
            onClick={() =>
              up((x) => {
                const r = fillDefaultDevices(x);
                setMsg(`Aparataj pus in ${r.filled} doze${r.skipped ? `; ${r.skipped} doze fara aparataj implicit raman de completat manual` : ""}.`);
              }, "Aparataj implicit pus in doze")
            }
          >
            Pune aparatajul implicit in dozele goale{fillable.length ? ` (${fillable.length})` : ""}
          </Button>
          <span className="text-sm">
            <b>{da.length - empty.length}</b> din <b>{da.length}</b> doze au aparataj · <b>{lights.length}</b> corpuri de iluminat
          </span>
        </div>
        <p className="mt-2 text-xs text-ink-2">Aparatajul implicit al fiecarei destinatii se seteaza in Biblioteca → Aparate → Doze pentru faza la rosu. Pe o doza anume il schimbi din fila Doze si puncte (Detaliu). Corpurile de iluminat intra la faza la gata cu operatia de montaj a tipului lor.</p>
        {msg && <p className="mt-1 text-sm text-ok">{msg}</p>}
        {!gataOn && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Devizul este acum doar pentru faza la rosu; montajul aparatajului nu apare in el.
            <Button size="sm" onClick={() => up((x) => void (x.info.phases = ["rosu", "gata"]), "Faza la gata inclusa in deviz")}>
              Include si faza la gata
            </Button>
          </div>
        )}
      </div>
      {byRoom.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm text-ink-3">Nicio doza. Adauga dozele in fila Doze si puncte.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {byRoom.map(({ r, rows: rs }) => (
            <div key={r.id} className="overflow-hidden rounded-lg border border-line bg-white">
              <div className="flex items-center justify-between border-b border-line bg-paper/60 px-3 py-1.5 text-sm font-semibold">
                <span>{roomName(r.id)}</span>
                <span className="text-[11px] font-normal text-ink-2">
                  {rs.filter((x) => x.real.length).length}/{rs.length} cu aparataj
                </span>
              </div>
              <ul className="divide-y divide-line">
                {rs.map(({ b, real, defaults, cat, cap }) => (
                  <li key={b.id} className="flex items-center gap-2 px-2 py-1.5 text-[12.5px]">
                    <FnBadge f={cat ? FUNCTION_OF[cat] : "A"} />
                    <span className="w-12 shrink-0 font-mono text-[11.5px] text-ink-2">{b.code}</span>
                    <span className="min-w-0 flex-1 leading-tight">
                      {real.length ? (
                        <span className="block truncate">{real.map((d) => d.label).join(" + ")}</span>
                      ) : (
                        <span className="block truncate text-ink-3">{defaults.length ? `de pus: ${defaults.join(" + ")}` : "fara aparataj implicit"}</span>
                      )}
                    </span>
                    <span className="text-[11px] tabular-nums text-ink-3">
                      {cap.used}/{cap.modules}
                    </span>
                    {real.length === 0 && defaults.length > 0 && (
                      <button className="rounded border border-line px-1.5 py-0.5 text-[11px] hover:bg-paper" onClick={() => up((x) => void fillDefaultDevices(x, [b.id]), `Aparataj pus in ${b.code}`)}>
                        Pune
                      </button>
                    )}
                    {real.length > 0 && (
                      <button className="rounded px-1.5 text-ink-3 hover:bg-paper hover:text-red-700" title="Scoate aparatajul" onClick={() => up((x) => real.forEach((d) => removeDeviceFromBox(x, d.id)), `Aparataj scos din ${b.code}`)}>
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================= ESTIMARE ============================= */

function EstimateTab({ p }: { p: Project }) {
  const up = useUpdateActive();
  const f = p.fast;
  const set = (patch: Partial<typeof f>) => up((x) => void (x.fast = { ...x.fast, ...patch }), "Setari estimare modificate");
  const families = [...new Set(p.library.cableTypes.map((t) => t.name.split(" ")[0]))];
  const cable = totalCableLength(p);
  const chase = chaseLength(p);
  const conduit = totalConduitLength(p);
  const routes = !usesEstimatedRoutes(p);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="space-y-3 rounded-lg border border-line bg-white p-4">
        <p className="font-semibold">Estimarea lungimilor (pe acest proiect)</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Distanta tablou - prima doza" hint="medie pe circuit">
            <NumberInput value={f.panelDistanceM} suffix="m" min={0} onChange={(v) => set({ panelDistanceM: v ?? 0 })} />
          </Field>
          <Field label="Legatura intre doze" hint="estimare pe fiecare legatura din lant">
            <NumberInput value={f.metersPerPoint} suffix="m" min={0} onChange={(v) => set({ metersPerPoint: v ?? 0 })} />
          </Field>
          <Field label="Sant din lungimea cablului" hint="unde mai multe cabluri merg pe acelasi sant, procentul scade">
            <NumberInput value={f.chasePct} suffix="%" min={0} onChange={(v) => set({ chasePct: Math.min(200, v ?? 0) })} />
          </Field>
          <Field label="Puncte maxime pe circuit" hint="prize / iluminat, la impartirea automata">
            <NumberInput value={f.maxPointsPerCircuit} min={1} onChange={(v) => set({ maxPointsPerCircuit: Math.max(1, Math.round(v ?? 6)) })} />
          </Field>
        </div>
        <p className="text-xs text-ink-2">Fiecare circuit are un lant: tablou → prima doza (distanta pana la tablou) → doza urmatoare (legatura intre doze) ... Metrii masurati pe o legatura inlocuiesc estimarea doar pentru acea legatura.</p>
        {routes && <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">Proiectul are trasee modelate pe segmente: santul si tubul se iau din trasee, nu din estimare.</p>}
      </div>

      <div className="space-y-3 rounded-lg border border-line bg-white p-4">
        <p className="font-semibold">Optiuni lucrare</p>
        <Checkbox checked={f.noConduit} onChange={(v) => set({ noConduit: v })} label="Cablu ingropat direct, fara tub copex" />
        <Field label="Familie cablu preferata">
          <Select value={f.cableFamily} onChange={(v) => set({ cableFamily: v })} options={families.map((x) => ({ value: x, label: x }))} />
        </Field>
        <Field label="Tablou">
          <div className="flex gap-2">
            {(["nou", "existent"] as const).map((m) => (
              <button key={m} type="button" onClick={() => set({ panelMode: m })} className={cx("min-h-10 flex-1 rounded-md border px-3 text-sm", f.panelMode === m ? "border-ink bg-ink text-white" : "border-line bg-white")}>
                {m === "nou" ? "Tablou nou (se monteaza cutia)" : "Tablou existent"}
              </button>
            ))}
          </div>
        </Field>
        <p className="text-xs text-ink-2">Tablou existent: nu se mai socotesc montarea cutiei si cutia ca material; conectarea circuitelor ramane in deviz.</p>
      </div>

      <div className="rounded-lg border border-line bg-white p-4 lg:col-span-2">
        <p className="mb-2 font-semibold">Rezultat</p>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["Doze aparat", String(p.boxes.filter((b) => b.kind === "DA").length)],
            ["Cablu", cable.value === null ? NA : `${fmtNum(cable.value, 1)} m`],
            ["Sant", chase.value === null ? NA : `${fmtNum(chase.value, 1)} m`],
            ["Tub copex", f.noConduit && !routes ? "fara" : conduit.value === null ? NA : `${fmtNum(conduit.value, 1)} m`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md bg-paper px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-ink-2">{k}</p>
              <p className="text-lg font-semibold">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">Valorile sunt estimate (afisate cu galben in bara de sus) pana la masurare. Tarifele pe spart doza, montat doza, tras cablu si legat se seteaza in Biblioteca → Operatii.</p>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireProject>
      <InstallPage />
    </RequireProject>
  );
}
