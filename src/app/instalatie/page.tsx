"use client";
/**
 * Puncte si circuite - ecranul de lucru rapid (faza la rosu).
 * Navigare pe coloane ca in Finder: nivel > incapere > puncte > detaliu.
 * Pe telefon se vede o singura coloana, cu calea de navigare sus.
 */
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { RequireProject } from "@/components/shell/AppShell";
import { DEVICE_COLOR } from "@/components/shell/theme";
import { Badge, Button, Checkbox, ConfirmButton, Field, NumberInput, Select, Tabs, TextInput, cx } from "@/components/ui";
import { allCircuitLoads, generateCircuits, moveDevice, type CircuitLoad } from "@/lib/engine/circuits";
import { autoCircuitLength, chaseLength, circuitEndPoints, circuitLimitPoints, totalCableLength, totalConduitLength, usesEstimatedRoutes } from "@/lib/engine/measure";
import { newPanel } from "@/lib/engine/panels";
import { applySizing, proposeSizing } from "@/lib/engine/sizing";
import { addPoints, changePointType, FUNCTION_LABEL, levelDevices, parseQuickCode, pointFunction, pointStats, removePoint, roomDevices, shortcutTypes, type PointFunction } from "@/lib/engine/points";
import { fmtNum, NA } from "@/lib/format";
import { newBuilding, newLevel, newRoom, tracked } from "@/lib/model/factory";
import type { Circuit, Device, DeviceCategory, Project } from "@/lib/model/types";
import { useActiveProject, useUpdateActive } from "@/lib/store/store";

type Up = ReturnType<typeof useUpdateActive>;

const FN_CATEGORY: Record<PointFunction, DeviceCategory> = { P: "priza", L: "iluminat", I: "intrerupator", D: "consumator_dedicat", S: "curenti_slabi", C: "comanda", A: "altul" };
const fnColor = (f: PointFunction) => DEVICE_COLOR[FN_CATEGORY[f]];
const usageColor = (u: Circuit["usage"]) => DEVICE_COLOR[u === "prize" ? "priza" : u === "iluminat" ? "iluminat" : u === "dedicat" ? "consumator_dedicat" : u === "curenti_slabi" ? "curenti_slabi" : "altul"];

function FnBadge({ f, size = "sm" }: { f: PointFunction; size?: "sm" | "md" }) {
  const c = fnColor(f);
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center rounded font-bold", size === "sm" ? "h-5 w-5 text-[11px]" : "h-7 w-7 text-sm")} style={{ background: c.c, color: "#fff" }} title={FUNCTION_LABEL[f]}>
      {f}
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

function FnCounts({ stats }: { stats: ReturnType<typeof pointStats> }) {
  const order: PointFunction[] = ["P", "L", "I", "D", "S", "C", "A"];
  return (
    <span className="flex flex-wrap gap-1">
      {order
        .filter((f) => stats.byFunction[f])
        .map((f) => {
          const c = fnColor(f);
          return (
            <span key={f} className="rounded px-1 text-[10.5px] font-semibold" style={{ background: c.bg, color: c.c }}>
              {stats.byFunction[f]}
              {f}
            </span>
          );
        })}
    </span>
  );
}

/* ============================== PAGINA ============================== */

function InstallPage() {
  const p = useActiveProject()!;
  const [tab, setTab] = useState<"puncte" | "circuite" | "estimare">("puncte");
  const stats = pointStats(p, p.devices);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--accent)" }}>Puncte si circuite</h1>
          <p className="text-sm text-ink-2">Introduci punctele pe camere; aplicatia le imparte pe circuite si estimeaza cablul, santul si dozele.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{stats.total} puncte</span>
          <FnCounts stats={stats} />
          <span>· {p.circuits.length} circuite</span>
          {stats.unassigned > 0 && <Badge tone="warn">{stats.unassigned} fara circuit</Badge>}
        </div>
      </div>
      <Tabs
        tabs={[
          { id: "puncte", label: "Puncte", count: stats.total },
          { id: "circuite", label: "Circuite", count: p.circuits.length },
          { id: "estimare", label: "Estimare si optiuni" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "puncte" && <PointsBrowser p={p} />}
      {tab === "circuite" && <CircuitsTab p={p} />}
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
  const point = p.devices.find((d) => d.id === pointId && d.roomId === room?.id) ?? null;
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
              <FnBadge f={pointFunction(point)} />
              {p.boxes.find((b) => b.id === point.boxId)?.code ?? point.code} · {point.label}
            </span>
            <span className="ml-auto">
              <CircuitChip p={p} id={point.circuitId} />
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
              <span className="text-[11px] opacity-70">{levelDevices(p, l.id).length}</span>
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
                const st = pointStats(p, roomDevices(p, r.id));
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
        <Column title={room ? `Puncte ${room.name}` : "Puncte"} className={show(2)}>
          {!room ? <p className="px-2 py-3 text-xs text-ink-3">Alege o incapere.</p> : <RoomPoints p={p} up={up} roomId={room.id} selected={point?.id ?? null} onSelect={setPointId} />}
        </Column>

        {/* detaliu */}
        <Column title="Detaliu" className={cx(show(3), "lg:border-r-0")}>
          {point ? <PointDetail key={point.id} p={p} up={up} d={point} onDeleted={() => setPointId(null)} /> : room ? <RoomSummary p={p} roomId={room.id} /> : <p className="px-2 py-3 text-xs text-ink-3">Alege un punct pentru detalii.</p>}
        </Column>
      </div>
    </div>
  );
}

/* ----------------------------- puncte ------------------------------ */

function RoomPoints({ p, up, roomId, selected, onSelect }: { p: Project; up: Up; roomId: string; selected: string | null; onSelect: (id: string) => void }) {
  const lib = p.library;
  const quick = shortcutTypes(lib);
  const [code, setCode] = useState("");
  const [other, setOther] = useState("");
  const parsed = code.trim() ? parseQuickCode(lib, code) : null;
  const list = roomDevices(p, roomId).sort((a, b) => "PLIDSCA".indexOf(pointFunction(a)) - "PLIDSCA".indexOf(pointFunction(b)) || a.code.localeCompare(b.code));
  const roomName = p.rooms.find((r) => r.id === roomId)?.name ?? "";

  const add = (typeId: string, n = 1) => up((x) => void addPoints(x, roomId, typeId, n), `${n} x ${lib.deviceTypes.find((t) => t.id === typeId)?.name} in ${roomName}`);
  const addCode = () => {
    if (!parsed || parsed.items.length === 0 || parsed.errors.length) return;
    up((x) => parsed.items.forEach((it) => addPoints(x, roomId, it.deviceTypeId, it.n)), `Cod rapid ${code} in ${roomName}`);
    setCode("");
  };
  const groups: { cat: DeviceCategory; label: string }[] = [
    { cat: "priza", label: "Prize" },
    { cat: "iluminat", label: "Iluminat" },
    { cat: "intrerupator", label: "Intrerupatoare" },
    { cat: "consumator_dedicat", label: "Consumatori dedicati" },
    { cat: "comanda", label: "Comenzi / senzori" },
    { cat: "curenti_slabi", label: "Curenti slabi" },
    { cat: "altul", label: "Altele" },
  ];

  return (
    <div className="space-y-3">
      {/* adaugare rapida */}
      <div className="rounded-md bg-paper/70 p-2">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {quick.map((t) => {
            const f = pointFunction(t);
            const c = fnColor(f);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => add(t.id)}
                className="flex min-h-11 items-center gap-1.5 rounded-md border bg-white px-2 text-left text-[12.5px] active:scale-[0.98] lg:min-h-9"
                style={{ borderColor: c.c + "66" }}
                title={`Adauga ${t.name} (litera ${t.shortcut})`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white" style={{ background: c.c }}>
                  {t.shortcut}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.name.replace(/ Schuko| \(alimentator\)/, "")}</span>
                <span className="text-ink-3">+</span>
              </button>
            );
          })}
        </div>
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            addCode();
          }}
        >
          <TextInput value={code} onChange={setCode} placeholder="Cod rapid: 4P 2L 1I" className="flex-1" />
          <Button type="submit" variant="primary" disabled={!parsed || !parsed.items.length || parsed.errors.length > 0}>
            Adauga
          </Button>
        </form>
        {parsed && (
          <p className={cx("mt-1 text-[11.5px]", parsed.errors.length ? "text-red-700" : "text-ink-2")}>
            {parsed.errors.length ? parsed.errors.join("; ") : parsed.items.map((i) => `${i.n} x ${i.name}`).join(", ")}
          </p>
        )}
        <div className="mt-2 flex gap-1.5">
          <Select
            className="flex-1"
            value={other}
            placeholder="Alt tip de punct (consumator dedicat, comanda...)"
            onChange={setOther}
            options={groups.flatMap((g) => lib.deviceTypes.filter((t) => t.category === g.cat).map((t) => ({ value: t.id, label: `${g.label}: ${t.name}${t.suggestedPowerW ? ` (${t.suggestedPowerW} W)` : ""}` })))}
          />
          <Button disabled={!other} onClick={() => { add(other); setOther(""); }}>
            Adauga
          </Button>
        </div>
      </div>

      {/* lista */}
      {list.length === 0 ? (
        <p className="px-2 py-2 text-xs text-ink-3">Niciun punct in aceasta incapere.</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {list.map((d) => {
            const box = p.boxes.find((b) => b.id === d.boxId);
            const shared = box ? p.devices.filter((x) => x.boxId === box.id).length : 0;
            return (
              <li key={d.id}>
                <button type="button" onClick={() => onSelect(d.id)} className={cx("flex min-h-11 w-full items-center gap-2 px-2 py-1.5 text-left text-sm lg:min-h-9", selected === d.id ? "bg-[var(--accent-bg)]" : "hover:bg-paper")}>
                  <FnBadge f={pointFunction(d)} />
                  <span className="w-12 shrink-0 font-mono text-[11.5px] text-ink-2">{box?.code ?? d.code}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {d.label}
                    {shared > 1 && <span className="text-ink-3"> · {shared} in doza</span>}
                  </span>
                  <span className="hidden w-14 text-right text-[12px] tabular-nums text-ink-2 sm:block">{d.powerW.value === null ? "" : `${fmtNum(d.powerW.value, 0)} W`}</span>
                  <CircuitChip p={p} id={d.circuitId} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PointDetail({ p, up, d, onDeleted }: { p: Project; up: Up; d: Device; onDeleted: () => void }) {
  const lib = p.library;
  const box = p.boxes.find((b) => b.id === d.boxId);
  const set = (fn: (x: Device) => void, h?: string) => up((x) => { const t = x.devices.find((y) => y.id === d.id); if (t) fn(t); }, h);
  const compatible = p.circuits.filter((c) => (d.category === "consumator_dedicat" ? true : d.category === "iluminat" || d.category === "intrerupator" || d.category === "comanda" ? c.usage === "iluminat" : d.category === "priza" ? c.usage === "prize" : true));
  const others = p.circuits.filter((c) => !compatible.includes(c));
  const loads = allCircuitLoads(p);

  return (
    <div className="space-y-3 px-1 py-1">
      <Field label="Tip punct">
        <Select value={d.deviceTypeId ?? ""} onChange={(v) => up((x) => changePointType(x, d.id, v), "Tip punct schimbat")} options={lib.deviceTypes.map((t) => ({ value: t.id, label: `${FUNCTION_LABEL[pointFunction(t)]}: ${t.name}` }))} />
      </Field>
      <Field label="Denumire">
        <TextInput value={d.label} onChange={(v) => set((x) => void (x.label = v))} />
      </Field>
      {d.category !== "curenti_slabi" && d.category !== "intrerupator" && (
        <Field label="Putere" hint={d.powerW.provenance === "estimat" ? "consum mediu din biblioteca (estimat)" : "introdusa pe punct"}>
          <NumberInput value={d.powerW.value} suffix="W" onChange={(v) => set((x) => void (x.powerW = tracked(v, "proiectant")))} />
        </Field>
      )}
      {d.category !== "curenti_slabi" && (
        <Field label="Circuit" hint={d.circuitLocked ? "ales manual: impartirea automata nu il muta" : "automat: se poate schimba manual"}>
          <Select
            value={d.circuitId ?? ""}
            placeholder="fara circuit (se imparte automat)"
            onChange={(v) => up((x) => moveDevice(x, d.id, v || null), "Punct mutat pe alt circuit")}
            options={[...compatible, ...others].map((c) => {
              const l = loads.find((x) => x.circuit.id === c.id);
              return { value: c.id, label: `${c.code} ${c.name} · ${circuitEndPoints(p, c)} puncte${l?.installed.value ? ` · ${fmtNum(l.installed.value, 0)} W` : ""}${others.includes(c) ? " (alt tip)" : ""}` };
            })}
          />
        </Field>
      )}
      {box && (
        <Field label={`Doza ${box.code}`}>
          <Select
            value={box.boxTypeId ?? ""}
            onChange={(v) => up((x) => { const b = x.boxes.find((y) => y.id === box.id); if (b) { b.boxTypeId = v; b.modules = lib.boxTypes.find((t) => t.id === v)?.modules ?? b.modules; } })}
            options={lib.boxTypes.filter((t) => t.kind === "DA").map((t) => ({ value: t.id, label: t.name }))}
          />
        </Field>
      )}
      <Field label="Observatii">
        <TextInput value={d.notes} onChange={(v) => set((x) => void (x.notes = v))} placeholder="pozitie, inaltime, detalii" />
      </Field>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button onClick={() => d.deviceTypeId && up((x) => void addPoints(x, d.roomId, d.deviceTypeId!, 1), "Punct duplicat")}>+ Inca unul la fel</Button>
        <ConfirmButton size="md" onConfirm={() => { up((x) => removePoint(x, d.id), `Punct ${d.code} sters`); onDeleted(); }}>
          Sterge punctul
        </ConfirmButton>
      </div>
      <p className="text-[11px] text-ink-3">
        Cod punct {d.code}
        {box ? `, doza ${box.code}` : ", fara doza"}. Aparatajul (producator, model) se alege la faza la gata.
      </p>
    </div>
  );
}

function RoomSummary({ p, roomId }: { p: Project; roomId: string }) {
  const devs = roomDevices(p, roomId);
  const st = pointStats(p, devs);
  const circuits = [...new Set(devs.map((d) => d.circuitId).filter(Boolean))].map((id) => p.circuits.find((c) => c.id === id)!).filter(Boolean);
  const power = devs.reduce((s, d) => s + (d.powerW.value ?? 0), 0);
  return (
    <div className="space-y-2 px-1 py-1 text-sm">
      <p>
        <b>{st.total}</b> puncte, <b>{st.boxes}</b> doze, putere instalata <b>{fmtNum(power, 0)} W</b>
      </p>
      <FnCounts stats={st} />
      {st.unassigned > 0 && <p className="text-amber-700">{st.unassigned} puncte fara circuit - foloseste „Imparte automat” din fila Circuite.</p>}
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
        <div className="flex flex-wrap gap-1">
          {l.devices.map((d) => (
            <span key={d.id} className="flex items-center gap-1 rounded border border-line px-1 py-0.5 text-[11px]" title={d.label}>
              <FnBadge f={pointFunction(d)} />
              {p.boxes.find((b) => b.id === d.boxId)?.code ?? d.code}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Cablu">
            <Select value={c.cableTypeId ?? ""} placeholder="de stabilit" onChange={(v) => set((x) => { x.cableTypeId = v || null; if (!x.lockedFields.includes("cableTypeId")) x.lockedFields.push("cableTypeId"); }, `Cablu ${c.code}`)} options={cables.map((t) => ({ value: t.id, label: t.name }))} />
          </Field>
          <Field label={measured ? "Lungime masurata" : "Lungime"} hint={measured ? "introdusa pe circuit" : auto !== null ? `estimat ${fmtNum(auto, 1)} m` : undefined}>
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
          <Field label="Cablu pe punct" hint="intre doze consecutive">
            <NumberInput value={f.metersPerPoint} suffix="m" min={0} onChange={(v) => set({ metersPerPoint: v ?? 0 })} />
          </Field>
          <Field label="Sant din lungimea cablului" hint="unde mai multe cabluri merg pe acelasi sant, procentul scade">
            <NumberInput value={f.chasePct} suffix="%" min={0} onChange={(v) => set({ chasePct: Math.min(200, v ?? 0) })} />
          </Field>
          <Field label="Puncte maxime pe circuit" hint="prize / iluminat, la impartirea automata">
            <NumberInput value={f.maxPointsPerCircuit} min={1} onChange={(v) => set({ maxPointsPerCircuit: Math.max(1, Math.round(v ?? 6)) })} />
          </Field>
        </div>
        <p className="text-xs text-ink-2">Lungime circuit = distanta pana la tablou + numar puncte x cablu pe punct. Lungimea masurata scrisa pe circuit inlocuieste estimarea.</p>
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
