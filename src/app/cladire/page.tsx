"use client";
import { useMemo, useState } from "react";
import { RequireProject } from "@/components/shell/AppShell";
import { Badge, Button, Card, Checkbox, Code, ConfirmButton, Empty, Field, NumberInput, PageHeader, Select, Table, TextInput, TrackedNumber, cx } from "@/components/ui";
import { roomArea, roomPerimeter } from "@/lib/engine/measure";
import { fmtNum, NA } from "@/lib/format";
import { newBuilding, newLevel, newRoom, tracked } from "@/lib/model/factory";
import type { BuildingKind, Project, Room } from "@/lib/model/types";
import { useActiveProject, useUpdateActive } from "@/lib/store/store";

const KINDS: { value: BuildingKind; label: string }[] = [
  { value: "casa", label: "Casa" },
  { value: "apartament", label: "Apartament" },
  { value: "bloc", label: "Bloc" },
  { value: "spatiu_comun", label: "Spatiu comun" },
  { value: "anexa", label: "Anexa" },
  { value: "altul", label: "Altul" },
];

const LEVEL_PRESETS = [
  { name: "Subsol", elevation: -1 },
  { name: "Demisol", elevation: -1 },
  { name: "Parter", elevation: 0 },
  { name: "Etaj 1", elevation: 1 },
  { name: "Etaj 2", elevation: 2 },
  { name: "Mansarda", elevation: 3 },
  { name: "Pod", elevation: 4 },
];

/** o incapere are elemente electrice asociate? (protectie la stergere) */
const roomUsed = (p: Project, roomId: string) =>
  p.boxes.some((b) => b.roomId === roomId) || p.devices.some((d) => d.roomId === roomId) || p.routes.some((r) => r.roomIds.includes(roomId)) || p.panels.some((t) => t.roomId === roomId);

function QtyCell({ q }: { q: ReturnType<typeof roomArea> }) {
  return <span className={q.value === null ? "v-unknown" : q.certainty === "masurat" ? "v-measured" : "v-estimated"}>{q.value === null ? NA : fmtNum(q.value, 2)}</span>;
}

function BuildingPage() {
  const p = useActiveProject()!;
  const up = useUpdateActive();
  const lib = p.library;
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCount, setBulkCount] = useState<number | null>(1);
  const [bulkType, setBulkType] = useState<string>("rt-dormitor");
  const [targetLevel, setTargetLevel] = useState<string>("");

  const levels = useMemo(
    () => [...p.levels].sort((a, b) => (a.buildingId === b.buildingId ? a.elevation - b.elevation || a.order - b.order : p.buildings.findIndex((x) => x.id === a.buildingId) - p.buildings.findIndex((x) => x.id === b.buildingId))),
    [p.levels, p.buildings],
  );
  const levelName = (id: string) => {
    const l = p.levels.find((x) => x.id === id);
    const b = l && p.buildings.find((x) => x.id === l.buildingId);
    return l ? (p.buildings.length > 1 && b ? `${b.name} / ${l.name}` : l.name) : "?";
  };
  const rooms = p.rooms.filter((r) => levelFilter === "all" || r.levelId === levelFilter);
  const addLevelId = targetLevel || (levelFilter !== "all" ? levelFilter : levels[0]?.id ?? "");

  const setRoom = (id: string, recipe: (r: Room) => void) => up((x) => { const r = x.rooms.find((y) => y.id === id); if (r) recipe(r); });
  const toggleSel = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const bulk = (recipe: (r: Room) => void, label: string) => {
    up((x) => x.rooms.filter((r) => selected.has(r.id)).forEach(recipe), `Editare in masa (${selected.size} incaperi): ${label}`);
  };

  const totals = useMemo(() => {
    let a = 0;
    let unknown = 0;
    for (const r of rooms) {
      const q = roomArea(r);
      if (q.value === null) unknown++;
      else a += q.value;
    }
    return { a, unknown };
  }, [rooms]);

  return (
    <div className="space-y-4">
      <PageHeader title="Cladire, niveluri si incaperi" subtitle="Ierarhie: Proiect → Cladire → Nivel → Incapere. Dimensiunile estimate apar cu chenar punctat; cele masurate cu verde (click pe E/M pentru a schimba)." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Cladiri"
          actions={<Button size="sm" onClick={() => up((x) => void x.buildings.push(newBuilding(x, `Cladire ${x.buildings.length + 1}`, "anexa")), "Cladire adaugata")}>+ Cladire</Button>}
        >
          {p.buildings.length === 0 ? (
            <Empty title="Nicio cladire">Adauga o cladire pentru a defini niveluri.</Empty>
          ) : (
            <div className="space-y-2">
              {p.buildings.map((b) => {
                const used = p.levels.some((l) => l.buildingId === b.id);
                return (
                  <div key={b.id} className="flex items-center gap-2">
                    <Code>{b.code}</Code>
                    <TextInput className="flex-1" value={b.name} onChange={(v) => up((x) => void (x.buildings.find((y) => y.id === b.id)!.name = v))} />
                    <Select className="w-36" value={b.kind} onChange={(v) => up((x) => void (x.buildings.find((y) => y.id === b.id)!.kind = v))} options={KINDS} />
                    {used ? (
                      <span className="w-14 text-[11px] text-ink-3" title="Sterge intai nivelurile">are niveluri</span>
                    ) : (
                      <ConfirmButton onConfirm={() => up((x) => void (x.buildings = x.buildings.filter((y) => y.id !== b.id)), `Cladire stearsa ${b.code}`)}>Sterge</ConfirmButton>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Niveluri" subtitle="Cote: subsol -1, parter 0, etaj 1 ...">
          <div className="space-y-2">
            {levels.map((l) => {
              const count = p.rooms.filter((r) => r.levelId === l.id).length;
              const blocked = p.rooms.some((r) => r.levelId === l.id && roomUsed(p, r.id));
              return (
                <div key={l.id} className="flex items-center gap-2">
                  <Code>{l.code}</Code>
                  {p.buildings.length > 1 && (
                    <Select className="w-36" value={l.buildingId} onChange={(v) => up((x) => void (x.levels.find((y) => y.id === l.id)!.buildingId = v))} options={p.buildings.map((b) => ({ value: b.id, label: b.name }))} />
                  )}
                  <TextInput className="flex-1" value={l.name} onChange={(v) => up((x) => void (x.levels.find((y) => y.id === l.id)!.name = v))} />
                  <NumberInput className="w-16" value={l.elevation} onChange={(v) => up((x) => void (x.levels.find((y) => y.id === l.id)!.elevation = v ?? 0))} />
                  <span className="w-16 text-right text-xs text-ink-2">{count} incap.</span>
                  {blocked ? (
                    <span className="w-14 text-[11px] text-ink-3">in uz</span>
                  ) : (
                    <ConfirmButton
                      label={count ? `Sterge cu ${count} incaperi` : "Sterge"}
                      onConfirm={() => up((x) => { x.rooms = x.rooms.filter((r) => r.levelId !== l.id); x.levels = x.levels.filter((y) => y.id !== l.id); }, `Nivel sters ${l.code} ${l.name}`)}
                    >
                      Sterge
                    </ConfirmButton>
                  )}
                </div>
              );
            })}
            {p.buildings.length > 0 && (
              <div className="flex flex-wrap gap-1 border-t border-line pt-2">
                {LEVEL_PRESETS.map((pr) => (
                  <Button
                    key={pr.name}
                    size="sm"
                    variant="ghost"
                    onClick={() => up((x) => void x.levels.push(newLevel(x, x.buildings[0].id, pr.name, pr.elevation)), `Nivel adaugat ${pr.name}`)}
                  >
                    + {pr.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card
        title={<>Incaperi <span className="font-normal text-ink-3">· {rooms.length} · {fmtNum(totals.a, 1)} m²{totals.unknown ? ` (+${totals.unknown} fara dimensiuni)` : ""}</span></>}
        actions={
          <>
            <Select className="w-44" value={levelFilter} onChange={(v) => { setLevelFilter(v); setSelected(new Set()); }} options={[{ value: "all", label: "Toate nivelurile" }, ...levels.map((l) => ({ value: l.id, label: levelName(l.id) }))]} />
          </>
        }
      >
        {levels.length === 0 ? (
          <Empty title="Adauga intai un nivel" />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-end gap-2 rounded-md bg-paper p-2">
              <Field label="Adauga">
                <NumberInput className="w-16" value={bulkCount} min={1} onChange={setBulkCount} />
              </Field>
              <Field label="Tip incapere">
                <Select className="w-44" value={bulkType} onChange={setBulkType} options={lib.roomTypes.map((t) => ({ value: t.id, label: t.name }))} />
              </Field>
              <Field label="Pe nivelul">
                <Select className="w-44" value={addLevelId} onChange={setTargetLevel} options={levels.map((l) => ({ value: l.id, label: levelName(l.id) }))} />
              </Field>
              <Button
                variant="primary"
                onClick={() => {
                  const n = Math.max(1, Math.min(50, bulkCount ?? 1));
                  const rt = lib.roomTypes.find((t) => t.id === bulkType);
                  up((x) => {
                    const existing = x.rooms.filter((r) => r.roomTypeId === bulkType).length;
                    for (let k = 0; k < n; k++) x.rooms.push(newRoom(x, addLevelId, `${rt?.name ?? "Incapere"}${existing + k > 0 ? " " + (existing + k + 1) : ""}`, bulkType, null, null, null));
                  }, `${n} incaperi adaugate`);
                }}
              >
                + Adauga
              </Button>
            </div>

            {selected.size > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-volt bg-volt/10 p-2 text-sm">
                <b>{selected.size} selectate</b>
                <span className="text-ink-2">Perete:</span>
                {lib.wallTypes.map((w) => (
                  <Button key={w.id} size="sm" onClick={() => bulk((r) => void (r.wallTypeId = w.id), `perete ${w.name}`)}>{w.name}</Button>
                ))}
                <span className="ml-2 text-ink-2">Inaltime:</span>
                <NumberInput className="w-20" value={null} suffix="m" onChange={(v) => v !== null && bulk((r) => void (r.heightM = tracked(v)), `inaltime ${v} m`)} />
                <Button size="sm" onClick={() => bulk((r) => { r.renovation = true; if (!r.difficultyFactorIds.includes("df-renovare")) r.difficultyFactorIds.push("df-renovare"); }, "renovare")}>Marcheaza renovare</Button>
                <Button size="sm" onClick={() => bulk((r) => void (r.levelId = addLevelId), `mutate pe ${levelName(addLevelId)}`)}>Muta pe nivelul selectat</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Deselecteaza</Button>
              </div>
            )}

            {rooms.length === 0 ? (
              <Empty title="Nicio incapere pe acest nivel" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className="w-6">
                      <input type="checkbox" className="accent-ink" checked={rooms.length > 0 && rooms.every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(rooms.map((r) => r.id)) : new Set())} />
                    </th>
                    <th>Cod</th>
                    <th>Denumire</th>
                    <th>Tip</th>
                    {levelFilter === "all" && <th>Nivel</th>}
                    <th className="num">L (m)</th>
                    <th className="num">l (m)</th>
                    <th className="num">H (m)</th>
                    <th className="num">S (m²)</th>
                    <th className="num">P (m)</th>
                    <th>Perete</th>
                    <th>Conditii</th>
                    <th className="num">H priza / intr (cm)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <RoomRow
                      key={r.id}
                      p={p}
                      r={r}
                      showLevel={levelFilter === "all"}
                      levelName={levelName(r.levelId)}
                      selected={selected.has(r.id)}
                      onSelect={(on) => toggleSel(r.id, on)}
                      set={(recipe) => setRoom(r.id, recipe)}
                      onDuplicate={() =>
                        up((x) => {
                          const src = x.rooms.find((y) => y.id === r.id)!;
                          const copy = newRoom(x, src.levelId, src.name + " (copie)", src.roomTypeId, null, null, null);
                          const keep = { id: copy.id, code: copy.code, name: copy.name };
                          Object.assign(copy, structuredClone(src), keep);
                          x.rooms.splice(x.rooms.indexOf(src) + 1, 0, copy);
                        }, `Incapere duplicata ${r.code}`)
                      }
                      onDelete={() => up((x) => void (x.rooms = x.rooms.filter((y) => y.id !== r.id)), `Incapere stearsa ${r.code} ${r.name}`)}
                    />
                  ))}
                </tbody>
              </Table>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function RoomRow({
  p,
  r,
  showLevel,
  levelName,
  selected,
  onSelect,
  set,
  onDuplicate,
  onDelete,
}: {
  p: Project;
  r: Room;
  showLevel: boolean;
  levelName: string;
  selected: boolean;
  onSelect: (on: boolean) => void;
  set: (recipe: (r: Room) => void) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [more, setMore] = useState(false);
  const lib = p.library;
  const used = roomUsed(p, r.id);
  const extraFactors = lib.difficultyFactors.filter((f) => !lib.wallTypes.some((w) => w.difficultyFactorId === f.id));
  return (
    <>
      <tr className={cx(selected && "bg-volt/10")}>
        <td><input type="checkbox" className="accent-ink" checked={selected} onChange={(e) => onSelect(e.target.checked)} /></td>
        <td><Code>{r.code}</Code></td>
        <td className="min-w-44"><TextInput value={r.name} onChange={(v) => set((x) => void (x.name = v))} /></td>
        <td className="min-w-36">
          <Select value={r.roomTypeId} onChange={(v) => set((x) => void (x.roomTypeId = v || null))} placeholder="—" options={lib.roomTypes.map((t) => ({ value: t.id, label: t.name }))} />
        </td>
        {showLevel && <td className="whitespace-nowrap text-xs text-ink-2">{levelName}</td>}
        <td className="min-w-28"><TrackedNumber value={r.lengthM} allowedProvenance={["estimat", "masurat", "proiectant"]} onChange={(v) => set((x) => void (x.lengthM = v))} /></td>
        <td className="min-w-28"><TrackedNumber value={r.widthM} allowedProvenance={["estimat", "masurat", "proiectant"]} onChange={(v) => set((x) => void (x.widthM = v))} /></td>
        <td className="min-w-28"><TrackedNumber value={r.heightM} allowedProvenance={["estimat", "masurat", "proiectant"]} onChange={(v) => set((x) => void (x.heightM = v))} /></td>
        <td className="num">{r.areaOverrideM2 !== null ? <span title="suprafata introdusa manual">{fmtNum(r.areaOverrideM2)}*</span> : <QtyCell q={roomArea(r)} />}</td>
        <td className="num">{r.perimeterOverrideM !== null ? <span title="perimetru introdus manual">{fmtNum(r.perimeterOverrideM)}*</span> : <QtyCell q={roomPerimeter(r)} />}</td>
        <td className="min-w-28">
          <Select value={r.wallTypeId} onChange={(v) => set((x) => void (x.wallTypeId = v || null))} placeholder="—" options={lib.wallTypes.map((w) => ({ value: w.id, label: w.name }))} />
        </td>
        <td>
          <div className="flex flex-wrap gap-1">
            {r.difficultyFactorIds.map((id) => {
              const f = lib.difficultyFactors.find((x) => x.id === id);
              return f ? <Badge key={id} tone="warn" title={`tarif x${f.valueFactor}, timp x${f.timeFactor}`}>{f.name}</Badge> : null;
            })}
            {r.difficultyFactorIds.length === 0 && <span className="text-xs text-ink-3">normale</span>}
          </div>
        </td>
        <td className="num whitespace-nowrap text-xs">{r.mountingHeights.socketCm ?? NA} / {r.mountingHeights.switchCm ?? NA}</td>
        <td>
          <div className="flex justify-end gap-0.5">
            <Button size="sm" variant="ghost" onClick={() => setMore((v) => !v)}>{more ? "Inchide" : "Detalii"}</Button>
            <Button size="sm" variant="ghost" onClick={onDuplicate}>Duplica</Button>
            {used ? <span className="px-2 text-[11px] text-ink-3" title="Incaperea are elemente asociate">in uz</span> : <ConfirmButton onConfirm={onDelete}>Sterge</ConfirmButton>}
          </div>
        </td>
      </tr>
      {more && (
        <tr className="bg-paper">
          <td></td>
          <td colSpan={showLevel ? 13 : 12} className="py-3">
            <div className="grid gap-3 md:grid-cols-6">
              <Field label="Suprafata manuala" hint="pentru incaperi neregulate"><NumberInput value={r.areaOverrideM2} suffix="m²" onChange={(v) => set((x) => void (x.areaOverrideM2 = v))} /></Field>
              <Field label="Perimetru manual"><NumberInput value={r.perimeterOverrideM} suffix="m" onChange={(v) => set((x) => void (x.perimeterOverrideM = v))} /></Field>
              <Field label="Usi"><NumberInput value={r.doors} onChange={(v) => set((x) => void (x.doors = v ?? 0))} /></Field>
              <Field label="Ferestre"><NumberInput value={r.windows} onChange={(v) => set((x) => void (x.windows = v ?? 0))} /></Field>
              <Field label="H montaj priza"><NumberInput value={r.mountingHeights.socketCm} suffix="cm" onChange={(v) => set((x) => void (x.mountingHeights.socketCm = v))} /></Field>
              <Field label="H montaj intrerupator"><NumberInput value={r.mountingHeights.switchCm} suffix="cm" onChange={(v) => set((x) => void (x.mountingHeights.switchCm = v))} /></Field>
              <div className="md:col-span-6">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Factori de dificultate pentru incapere</p>
                <div className="flex flex-wrap gap-4">
                  {extraFactors.map((f) => (
                    <Checkbox
                      key={f.id}
                      checked={r.difficultyFactorIds.includes(f.id)}
                      label={`${f.name} (tarif x${f.valueFactor}, timp x${f.timeFactor})`}
                      onChange={(on) =>
                        set((x) => {
                          x.difficultyFactorIds = on ? [...x.difficultyFactorIds, f.id] : x.difficultyFactorIds.filter((id) => id !== f.id);
                          if (f.id === "df-renovare") x.renovation = on;
                        })
                      }
                    />
                  ))}
                </div>
              </div>
              <Field label="Finisaje / acces / dificultate" className="md:col-span-3"><TextInput value={r.finishNotes} onChange={(v) => set((x) => void (x.finishNotes = v))} /></Field>
              <Field label="Observatii" className="md:col-span-3"><TextInput value={r.notes} onChange={(v) => set((x) => void (x.notes = v))} /></Field>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Page() {
  return (
    <RequireProject>
      <BuildingPage />
    </RequireProject>
  );
}

