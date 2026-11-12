"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { RequireProject } from "@/components/shell/AppShell";
import { useSummary } from "@/components/shell/SummaryBar";
import { levelOptions } from "@/components/install/common";
import { QuoteDoc } from "@/components/quote/QuoteDoc";
import { Badge, Button, Card, Checkbox, ConfirmButton, Field, NumberInput, PageHeader, Select, Table, Tabs, TextArea, TextInput, cx } from "@/components/ui";
import { computeLabor, resolveScope, SCOPE_PRESET_CATEGORIES, type LaborLine } from "@/lib/engine/pricing";
import { assignProformaNumber, buildDocument, categoryTitle, defaultProforma, subtotals, topDrivers, type DocDetail, type DocKind, type GroupBy } from "@/lib/engine/quote";
import { sourceText } from "@/lib/engine/sources";
import { fmtHours, fmtMoney, fmtNum, NA } from "@/lib/format";
import { PdfButton } from "@/components/io/PdfButton";
import { exportPdf } from "@/lib/io/pdf";
import { uid } from "@/lib/model/ids";
import type { OperationLineOverride, Project, QuoteScope } from "@/lib/model/types";
import { useActiveProject, useApp, useUpdateActive } from "@/lib/store/store";

type Up = ReturnType<typeof useUpdateActive>;
const EMPTY_SCOPE: QuoteScope = { preset: "tot", categories: [], panelIds: [], levelIds: [] };

function QuotePage() {
  const p = useActiveProject()!;
  const [tab, setTab] = useState<"calcul" | "documente">("calcul");
  const s = useSummary(p)!;
  const cur = p.library.firm.currency;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Deviz"
        subtitle="Manopera, materialele, costurile si timpul se calculeaza separat, dar din acelasi model. Orice valoare poate fi ajustata pe proiect; calculul initial ramane vizibil."
        actions={
          <span className="flex flex-wrap gap-4 text-sm">
            <span>Manopera <b>{fmtMoney(s.labor.total, cur)}</b></span>
            {p.quote.includeMaterials && <span>Materiale <b>{fmtMoney(s.materials.total, cur)}</b></span>}
            <span>Total <b>{fmtMoney(s.totals.gross, cur)}</b></span>
            <span>Timp <b>{s.labor.hours ? fmtHours(s.labor.hours) : NA}</b></span>
            <span>Tarif orar <b>{s.labor.impliedHourlyRate === null ? NA : fmtNum(s.labor.impliedHourlyRate, 0) + " lei/h"}</b></span>
          </span>
        }
      />
      <Tabs tabs={[{ id: "calcul", label: "Calcul deviz" }, { id: "documente", label: "Documente pentru beneficiar" }]} value={tab} onChange={setTab} />
      {tab === "calcul" ? <Calculation p={p} /> : <Documents p={p} />}
    </div>
  );
}

/* =============================== CALCUL ============================== */

function Calculation({ p }: { p: Project }) {
  const up = useUpdateActive();
  const s = useSummary(p)!;
  return (
    <>
      <ScopeCard p={p} up={up} />
      <SettingsCard p={p} up={up} />
      <LinesCard p={p} up={up} lines={s.labor.lines} />
      <ExtrasCard p={p} up={up} />
      <div className="grid gap-4 xl:grid-cols-2">
        <SubtotalsCard p={p} />
        <DriversCard p={p} />
      </div>
      {p.quote.includeMaterials && <MaterialsCard p={p} />}
      <TotalsCard p={p} />
    </>
  );
}

/** devizul se face pe faza: la rosu, la gata sau ambele */
function PhasePicker({ p, up }: { p: Project; up: Up }) {
  const ph = p.info.phases;
  const cur = ph.includes("rosu") && ph.includes("gata") ? "ambele" : ph.includes("gata") ? "gata" : "rosu";
  const labor = useMemo(() => {
    const all = computeLabor({ ...p, info: { ...p.info, phases: ["rosu", "gata"] } });
    const sum = (f: "rosu" | "gata") => all.lines.filter((l) => l.enabled && l.operation.phase === f).reduce((s, l) => s + l.value, 0);
    return { rosu: sum("rosu"), gata: sum("gata") };
  }, [p]);
  const cur$ = p.library.firm.currency;
  const empty = p.boxes.filter((b) => b.kind === "DA" && !p.devices.some((d) => d.boxId === b.id && !d.placeholder)).length;
  const opts = [
    { id: "rosu", label: "Faza la rosu", sub: `doze, trasee, cabluri, tablou · ${fmtMoney(labor.rosu, cur$)}`, v: ["rosu"] },
    { id: "gata", label: "Faza la gata", sub: `aparataj, corpuri de iluminat · ${fmtMoney(labor.gata, cur$)}`, v: ["gata"] },
    { id: "ambele", label: "Ambele faze", sub: fmtMoney(labor.rosu + labor.gata, cur$), v: ["rosu", "gata"] },
  ] as const;
  return (
    <div className="mb-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {opts.map((o) => (
          <button key={o.id} onClick={() => up((x) => void (x.info.phases = [...o.v]), `Deviz pentru: ${o.label}`)} className={cx("rounded-md border px-3 py-2 text-left", cur === o.id ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-paper")}>
            <span className="block text-sm font-semibold">{o.label}</span>
            <span className={cx("block text-[11.5px]", cur === o.id ? "text-white/80" : "text-ink-2")}>{o.sub}</span>
          </button>
        ))}
      </div>
      {cur !== "rosu" && empty > 0 && (
        <p className="mt-2 text-xs text-amber-800">
          {empty} doze nu au inca aparataj, deci nu intra in faza la gata. Pune aparatajul in <Link className="underline" href="/instalatie">Puncte si circuite → Aparataj (la gata)</Link>.
        </p>
      )}
    </div>
  );
}

function ScopeCard({ p, up }: { p: Project; up: Up }) {
  const sc = p.quote.scope ?? EMPTY_SCOPE;
  const set = (patch: Partial<QuoteScope>) => up((x) => void (x.quote.scope = { ...(x.quote.scope ?? EMPTY_SCOPE), ...patch }), "Domeniul devizului modificat");
  const cats = [...new Set(p.library.operations.filter((o) => o.active).map((o) => o.category))];
  const toggle = (list: string[], v: string, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));
  const resolved = resolveScope(p);
  const manualOps = p.library.operations.filter((o) => o.active && o.driver === "manual" && (!resolved.categories || resolved.categories.has(o.category)));

  return (
    <Card title="Ce intra in deviz" subtitle="Faza lucrarii, apoi toata lucrarea sau doar o parte: un tablou, anumite niveluri, anumite categorii de lucrari.">
      <PhasePicker p={p} up={up} />
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "tot", label: "Toata lucrarea" },
            { id: "tablou", label: "Doar tablou electric (inlocuire / echipare)" },
            { id: "personalizat", label: "Personalizat" },
          ] as const
        ).map((o) => (
          <button
            key={o.id}
            onClick={() => set({ preset: o.id, categories: o.id === "personalizat" && sc.categories.length === 0 ? cats : sc.categories })}
            className={cx("rounded-md border px-3 py-1.5 text-sm", sc.preset === o.id ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-paper")}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Categorii de lucrari</p>
          {sc.preset === "tot" && <p className="text-sm text-ink-3">toate</p>}
          {sc.preset === "tablou" && <p className="text-sm">{SCOPE_PRESET_CATEGORIES.tablou.map(categoryTitle).join(", ")}</p>}
          {sc.preset === "personalizat" && (
            <div className="grid grid-cols-2 gap-1">
              {cats.map((c) => <Checkbox key={c} checked={sc.categories.includes(c)} label={categoryTitle(c)} onChange={(on) => set({ categories: toggle(sc.categories, c, on) })} />)}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Tablouri (gol = toate)</p>
          {p.panels.length === 0 ? <p className="text-sm text-ink-3">nu exista tablouri</p> : <div className="grid gap-1">{p.panels.map((t) => <Checkbox key={t.id} checked={sc.panelIds.includes(t.id)} label={`${t.code} ${t.name}`} onChange={(on) => set({ panelIds: toggle(sc.panelIds, t.id, on) })} />)}</div>}
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Niveluri (gol = toate)</p>
          <div className="grid gap-1">{levelOptions(p).map((l) => <Checkbox key={l.value} checked={sc.levelIds.includes(l.value)} label={l.label} onChange={(on) => set({ levelIds: toggle(sc.levelIds, l.value, on) })} />)}</div>
        </div>
      </div>
      {manualOps.length > 0 && (
        <div className="mt-4 rounded-md border border-line bg-paper p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Operatii cu cantitate introdusa manual</p>
          <div className="flex flex-wrap gap-4">
            {manualOps.map((o) => {
              const ov = p.operationOverrides.find((x) => x.operationId === o.id);
              return (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  {o.name}
                  <NumberInput className="w-32" value={ov?.quantityOverride ?? null} suffix={o.unit} onChange={(v) => up((x) => setOverride(x, o.id, { quantityOverride: v }))} />
                </label>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

function setOverride(x: Project, operationId: string, patch: Partial<OperationLineOverride>) {
  const cur = x.operationOverrides.find((k) => k.operationId === operationId);
  if (cur) Object.assign(cur, patch);
  else x.operationOverrides.push({ operationId, enabled: true, quantityOverride: null, rateOverride: null, timeOverrideMin: null, note: "", ...patch });
  // curata ajustarile goale
  x.operationOverrides = x.operationOverrides.filter((o) => !(o.enabled && o.quantityOverride === null && o.rateOverride === null && o.timeOverrideMin === null && !o.note));
}

function SettingsCard({ p, up }: { p: Project; up: Up }) {
  const q = p.quote;
  const factors = p.library.difficultyFactors.filter((f) => !p.library.wallTypes.some((w) => w.difficultyFactorId === f.id));
  return (
    <Card title="Setari deviz">
      <div className="grid gap-3 md:grid-cols-5">
        <Field label="Materiale">
          <span className="pt-1.5"><Checkbox checked={q.includeMaterials} onChange={(v) => up((x) => void (x.quote.includeMaterials = v))} label="Include materiale in oferta" /></span>
        </Field>
        <Field label="Discount manopera"><NumberInput value={q.laborDiscountPct} suffix="%" onChange={(v) => up((x) => void (x.quote.laborDiscountPct = Math.min(100, Math.max(0, v ?? 0))))} /></Field>
        <Field label="Discount materiale"><NumberInput value={q.materialsDiscountPct} suffix="%" onChange={(v) => up((x) => void (x.quote.materialsDiscountPct = Math.min(100, Math.max(0, v ?? 0))))} /></Field>
        <Field label="Valabilitate oferta"><NumberInput value={q.validityDays} suffix="zile" onChange={(v) => up((x) => void (x.quote.validityDays = Math.max(1, v ?? 30)))} /></Field>
        <Field label="Data ofertei"><TextInput type="date" value={q.offerDate ?? ""} onChange={(v) => up((x) => void (x.quote.offerDate = v || null))} /></Field>
      </div>
      <div className="mt-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Factori de dificultate pe tot proiectul</p>
        <div className="flex flex-wrap gap-4">
          {factors.map((f) => (
            <Checkbox
              key={f.id}
              checked={q.projectFactorIds.includes(f.id)}
              label={`${f.name} (tarif x${f.valueFactor}, timp x${f.timeFactor})`}
              onChange={(on) => up((x) => void (x.quote.projectFactorIds = on ? [...x.quote.projectFactorIds, f.id] : x.quote.projectFactorIds.filter((k) => k !== f.id)), `Factor ${f.name} ${on ? "aplicat" : "scos"}`)}
            />
          ))}
        </div>
        <p className="mt-1 text-xs text-ink-3">Factorii de perete si de incapere se aplica automat din Cladire si incaperi; toti apar explicit pe fiecare linie.</p>
      </div>
    </Card>
  );
}

function LinesCard({ p, up, lines }: { p: Project; up: Up; lines: LaborLine[] }) {
  const cur = p.library.firm.currency;
  const ov = (id: string) => p.operationOverrides.find((o) => o.operationId === id);
  const disabledOps = p.library.operations.filter((o) => ov(o.id)?.enabled === false && !lines.some((l) => l.operation.id === o.id));
  return (
    <Card title={`Operatii de manopera (${lines.length})`} subtitle="Cantitatea, tariful si timpul calculate apar sub campuri; campurile completate le suprascriu doar pe acest proiect.">
      {lines.length === 0 ? (
        <p className="text-sm text-ink-3">Nu exista operatii cu cantitati in domeniul ales.</p>
      ) : (
        <Table>
          <thead>
            <tr><th className="w-6" /><th>Cod</th><th>Operatie</th><th className="num">Cantitate</th><th>UM</th><th className="num">Tarif</th><th className="num">Timp / UM</th><th>Factori</th><th className="num">Valoare</th><th className="num">Timp</th><th /></tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const o = ov(l.operation.id);
              const calcQty = l.allocations.reduce((s, a) => s + a.quantity, 0);
              const factors = [...new Set(l.allocations.flatMap((a) => a.factors.map((f) => `${f.name} x${f.valueFactor}`)))];
              const changed = !!o && (o.quantityOverride !== null || o.rateOverride !== null || o.timeOverrideMin !== null);
              return (
                <tr key={l.operation.id} className={cx(!l.enabled && "opacity-45")}>
                  <td><input type="checkbox" className="accent-ink" checked={l.enabled} title="include in deviz" onChange={(e) => up((x) => setOverride(x, l.operation.id, { enabled: e.target.checked }))} /></td>
                  <td className="font-mono text-xs">{l.operation.code}</td>
                  <td className="min-w-56">
                    {l.operation.name} {l.operation.isExample && <Badge tone="warn">exemplu</Badge>}
                    <div className="text-[10px] text-ink-3">
                      {categoryTitle(l.operation.category)} · <span title="de unde se preia cantitatea">{sourceText(p.library, l.operation)}</span>
                    </div>
                  </td>
                  <td className="w-28">
                    <NumberInput value={o?.quantityOverride ?? null} placeholder={fmtNum(calcQty, 2)} onChange={(v) => up((x) => setOverride(x, l.operation.id, { quantityOverride: v }))} />
                    {o?.quantityOverride != null && <div className="text-right text-[10px] text-ink-3">calculat {fmtNum(calcQty, 2)}</div>}
                  </td>
                  <td className="text-xs">{l.operation.unit}</td>
                  <td className="w-28">
                    <NumberInput value={o?.rateOverride ?? null} placeholder={fmtNum(l.operation.rate, 2)} suffix="lei" onChange={(v) => up((x) => setOverride(x, l.operation.id, { rateOverride: v }))} />
                  </td>
                  <td className="w-24">
                    <NumberInput value={o?.timeOverrideMin ?? null} placeholder={fmtNum(l.operation.timeMin, 1)} suffix="min" onChange={(v) => up((x) => setOverride(x, l.operation.id, { timeOverrideMin: v }))} />
                  </td>
                  <td className="max-w-48 text-[11px] text-ink-2">{factors.join(", ") || "—"}</td>
                  <td className="num whitespace-nowrap font-semibold">
                    {fmtMoney(l.value, cur)}
                    {l.value !== l.baseValue && <div className="text-[10px] font-normal text-ink-3">fara factori {fmtMoney(l.baseValue, "")}</div>}
                  </td>
                  <td className="num whitespace-nowrap">{fmtNum(l.timeMin / 60, 2)} h</td>
                  <td>{changed && <Button size="sm" variant="ghost" title="revino la valorile calculate" onClick={() => up((x) => setOverride(x, l.operation.id, { quantityOverride: null, rateOverride: null, timeOverrideMin: null }))}>↺</Button>}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {disabledOps.length > 0 && <p className="mt-2 text-xs text-ink-3">Excluse din deviz: {disabledOps.map((o) => o.name).join(", ")}.</p>}
      <p className="mt-2 text-xs text-ink-3">
        Tarifele si timpii standard se modifica pentru toate proiectele in <Link className="underline" href="/biblioteca">Biblioteca → Operatii si tarife</Link>.
      </p>
    </Card>
  );
}

function ExtrasCard({ p, up }: { p: Project; up: Up }) {
  return (
    <Card
      title="Costuri suplimentare"
      subtitle="Deplasare, organizare de santier, lucrari in conditii speciale - pozitii stabilite comercial, cu timp optional."
      actions={<Button size="sm" onClick={() => up((x) => void x.extraCosts.push({ id: uid(), label: "Deplasare", amount: 0, timeMin: 0 }), "Cost suplimentar adaugat")}>+ Cost</Button>}
    >
      {p.extraCosts.length === 0 ? (
        <p className="text-sm text-ink-3">Niciun cost suplimentar.</p>
      ) : (
        <div className="space-y-2">
          {p.extraCosts.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-2">
              <TextInput className="w-72" value={e.label} onChange={(v) => up((x) => void (x.extraCosts.find((k) => k.id === e.id)!.label = v))} />
              <NumberInput className="w-32" value={e.amount} suffix="lei" onChange={(v) => up((x) => void (x.extraCosts.find((k) => k.id === e.id)!.amount = v ?? 0))} />
              <NumberInput className="w-28" value={e.timeMin} suffix="min" onChange={(v) => up((x) => void (x.extraCosts.find((k) => k.id === e.id)!.timeMin = v ?? 0))} />
              <ConfirmButton onConfirm={() => up((x) => void (x.extraCosts = x.extraCosts.filter((k) => k.id !== e.id)))}>Sterge</ConfirmButton>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SubtotalsCard({ p }: { p: Project }) {
  const s = useSummary(p)!;
  const [by, setBy] = useState<GroupBy>("categorie");
  const rows = useMemo(() => subtotals(p, s.labor, by), [p, s.labor, by]);
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  const cur = p.library.firm.currency;
  return (
    <Card
      title="Subtotaluri manopera"
      actions={<Select<GroupBy> className="w-40" value={by} onChange={setBy} options={[{ value: "categorie", label: "pe categorie" }, { value: "nivel", label: "pe nivel" }, { value: "incapere", label: "pe incapere" }, { value: "tablou", label: "pe tablou" }, { value: "faza", label: "pe faza" }]} />}
    >
      <Table>
        <thead><tr><th>{by}</th><th className="num">Valoare</th><th className="num">%</th><th className="num">Timp</th><th className="num">lei/h</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className="num">{fmtMoney(r.value, cur)}</td>
              <td className="num text-ink-2">{fmtNum((r.value / total) * 100, 0)}%</td>
              <td className="num">{fmtNum(r.timeMin / 60, 1)} h</td>
              <td className="num">{r.hourlyRate === null ? NA : fmtNum(r.hourlyRate, 0)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-2 text-xs text-ink-3">Pe nivel / incapere / tablou, valoarea fiecarei operatii se imparte dupa elementele care au generat-o; cantitatile introduse manual si costurile suplimentare apar separat.</p>
    </Card>
  );
}

function DriversCard({ p }: { p: Project }) {
  const s = useSummary(p)!;
  const d = topDrivers(s.labor, 5);
  const cur = p.library.firm.currency;
  const app = useApp();
  // comparatie tarif orar implicit intre proiecte
  const others = app.order.map((id) => app.projects[id]).filter((x) => x && x.id !== p.id).slice(0, 6);
  return (
    <Card title="Ce influenteaza costul si timpul">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Dupa valoare</p>
          {d.byValue.map(({ line, pct }) => (
            <div key={line.operation.id} className="mb-1">
              <div className="flex justify-between text-xs"><span>{line.operation.name}</span><span className="tabular-nums">{fmtMoney(line.value, cur)}</span></div>
              <div className="h-1.5 rounded bg-paper-2"><div className="h-1.5 rounded bg-ink" style={{ width: `${pct}%` }} /></div>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Dupa timp</p>
          {d.byTime.map(({ line, pct }) => (
            <div key={line.operation.id} className="mb-1">
              <div className="flex justify-between text-xs"><span>{line.operation.name}</span><span className="tabular-nums">{fmtNum(line.timeMin / 60, 1)} h</span></div>
              <div className="h-1.5 rounded bg-paper-2"><div className="h-1.5 rounded bg-volt" style={{ width: `${pct}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
      {others.length > 0 && <OtherProjectsRates p={p} others={others} />}
    </Card>
  );
}

function OtherProjectsRates({ p, others }: { p: Project; others: Project[] }) {
  const s = useSummary(p)!;
  const rows = others.map((o) => {
    // calcul usor: doar manopera
    const sum = buildDocument(o, "oferta", "simplificat");
    return { o, rate: sum.hours > 0 ? sum.totals.labor / sum.hours : null, value: sum.totals.labor };
  });
  return (
    <div className="mt-4">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Tarif orar implicit - comparatie cu alte proiecte</p>
      <Table>
        <tbody>
          <tr className="font-semibold"><td>{p.info.code} {p.info.name} (curent)</td><td className="num">{s.labor.impliedHourlyRate === null ? NA : fmtNum(s.labor.impliedHourlyRate, 0) + " lei/h"}</td></tr>
          {rows.map((r) => <tr key={r.o.id}><td>{r.o.info.code} {r.o.info.name}</td><td className="num">{r.rate === null ? NA : fmtNum(r.rate, 0) + " lei/h"}</td></tr>)}
        </tbody>
      </Table>
    </div>
  );
}

function MaterialsCard({ p }: { p: Project }) {
  const s = useSummary(p)!;
  const cur = p.library.firm.currency;
  const m = s.materials;
  return (
    <Card title={`Materiale (${m.lines.length})`} subtitle="Cantitati din model; preturile si adaosul se modifica in Biblioteca.">
      {m.lines.length === 0 ? (
        <p className="text-sm text-ink-3">Nicio pozitie de material in domeniul ales.</p>
      ) : (
        <Table>
          <thead><tr><th>Material</th><th>Producator</th><th className="num">Cantitate</th><th>UM</th><th className="num">Pret achizitie</th><th className="num">Adaos</th><th className="num">Pret ofertat</th><th className="num">Valoare</th></tr></thead>
          <tbody>
            {m.lines.map((l) => (
              <tr key={l.materialId}>
                <td>{l.name} {p.library.materials.find((x) => x.id === l.materialId)?.isExample && <Badge tone="warn">exemplu</Badge>}</td>
                <td className="text-xs">{l.brand}</td>
                <td className="num">{fmtNum(l.quantity, 2)}</td>
                <td>{l.unit}</td>
                <td className="num">{fmtMoney(l.purchasePrice, "")}</td>
                <td className="num">{l.markupPct}%</td>
                <td className="num">{fmtMoney(l.offerPrice, "")}</td>
                <td className="num font-semibold">{fmtMoney(l.value, cur)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {m.unmapped.length > 0 && <p className="mt-2 text-xs text-warn">Fara material asociat in catalog: {m.unmapped.slice(0, 12).join(", ")}{m.unmapped.length > 12 ? "…" : ""}</p>}
    </Card>
  );
}

function TotalsCard({ p }: { p: Project }) {
  const s = useSummary(p)!;
  const cur = p.library.firm.currency;
  const t = s.totals;
  const row = (k: string, v: string, strong = false) => (
    <div className={cx("flex justify-between py-1", strong && "border-t border-line font-semibold")}>
      <span>{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
  return (
    <Card title="Totaluri">
      <div className="max-w-md text-sm">
        {row("Manopera (operatii + costuri suplimentare)", fmtMoney(s.labor.subtotal, cur))}
        {s.labor.discount > 0 && row(`Discount manopera ${p.quote.laborDiscountPct}%`, "-" + fmtMoney(s.labor.discount, cur))}
        {p.quote.includeMaterials && row("Materiale", fmtMoney(s.materials.subtotal, cur))}
        {p.quote.includeMaterials && s.materials.discount > 0 && row(`Discount materiale ${p.quote.materialsDiscountPct}%`, "-" + fmtMoney(s.materials.discount, cur))}
        {row("Total fara TVA", fmtMoney(t.net, cur), true)}
        {row(t.vatPayer ? `TVA ${t.vatRatePct}%` : p.library.firm.vatNote || "Neplatitor de TVA", t.vatPayer ? fmtMoney(t.vat, cur) : "—")}
        {row("TOTAL", fmtMoney(t.gross, cur), true)}
        {row("Timp de manopera", s.labor.hours ? fmtHours(s.labor.hours) : NA)}
        {row("Tarif orar implicit (manopera / ore)", s.labor.impliedHourlyRate === null ? NA : fmtMoney(s.labor.impliedHourlyRate, cur + "/h"))}
      </div>
    </Card>
  );
}

/* ============================== DOCUMENTE ============================ */

function Documents({ p }: { p: Project }) {
  const up = useUpdateActive();
  const app = useApp();
  const [kind, setKind] = useState<DocKind>("oferta");
  const [detail, setDetail] = useState<DocDetail>("simplificat");
  const box = useRef<HTMLDivElement>(null);
  const doc = useMemo(() => buildDocument(p, kind, detail), [p, kind, detail]);
  const pf = p.quote.proforma ?? defaultProforma(p);
  const setPf = (patch: Partial<typeof pf>) => up((x) => void (x.quote.proforma = { ...(x.quote.proforma ?? defaultProforma(x)), ...patch }));
  const firm = app.library.firm;

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card title="Document">
          <div className="space-y-3">
            <Field label="Tip">
              <Select<DocKind> value={kind} onChange={setKind} options={[{ value: "oferta", label: "Oferta / deviz" }, { value: "proforma", label: "Factura proforma" }]} />
            </Field>
            <Field label="Varianta">
              <div className="flex gap-2">
                {(["simplificat", "detaliat"] as const).map((d) => (
                  <button key={d} onClick={() => setDetail(d)} className={cx("flex-1 rounded-md border px-3 py-1.5 text-sm", detail === d ? "border-ink bg-ink text-white" : "border-line bg-white")}>
                    {d === "simplificat" ? "Simplificata" : "Detaliata"}
                  </button>
                ))}
              </div>
            </Field>
            <p className="text-xs text-ink-3">
              {detail === "simplificat" ? "Manopera grupata pe categorii de lucrari si materialele pe grupe, cu valori totale." : "Fiecare operatie cu UM, cantitate si pret unitar (incluzand factorii de dificultate) si fiecare material."}
            </p>
            <Checkbox checked={p.quote.includeMaterials} onChange={(v) => up((x) => void (x.quote.includeMaterials = v))} label="Include materiale" />
          </div>
        </Card>

        {kind === "proforma" && (
          <Card title="Proforma">
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <Field label="Numar" className="flex-1"><TextInput value={pf.number ?? ""} placeholder="neatribuit" onChange={(v) => setPf({ number: v || null })} /></Field>
                {!pf.number && (
                  <Button
                    onClick={() => {
                      const next = firm.proformaNext;
                      up((x) => void assignProformaNumber(x, next, firm.proformaSeries), `Proforma ${firm.proformaSeries} ${next}`);
                      app.updateLibrary((l) => void (l.firm.proformaNext = next + 1));
                    }}
                  >
                    Atribuie {firm.proformaSeries} {String(firm.proformaNext).padStart(4, "0")}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Data emiterii"><TextInput type="date" value={pf.issueDate ?? ""} onChange={(v) => setPf({ issueDate: v || null })} /></Field>
                <Field label="Termen plata"><NumberInput value={pf.dueDays} suffix="zile" onChange={(v) => setPf({ dueDays: Math.max(0, v ?? 5) })} /></Field>
              </div>
              <Field label="Procent de plata (avans)" hint="100% = intreaga valoare ofertata">
                <NumberInput value={pf.advancePct} suffix="%" onChange={(v) => setPf({ advancePct: Math.min(100, Math.max(1, v ?? 100)) })} />
              </Field>
              <Field label="Mentiuni proforma"><TextArea rows={2} value={pf.notes} onChange={(v) => setPf({ notes: v })} /></Field>
              <p className="text-xs text-ink-3">Seria si urmatorul numar se seteaza in Biblioteca → Firma. IBAN-ul si banca apar pe proforma.</p>
            </div>
          </Card>
        )}

        <Card title="Observatii pentru beneficiar">
          <TextArea rows={3} value={p.quote.clientNotes ?? ""} onChange={(v) => up((x) => void (x.quote.clientNotes = v))} />
          <p className="mt-1 text-xs text-ink-3">Ipotezele si excluderile se editeaza in Date proiect; conditiile comerciale implicite in Biblioteca → Firma.</p>
        </Card>

        {doc.warnings.length > 0 && (
          <div className="space-y-1 rounded-md border border-warn/40 bg-warn/5 p-3 text-xs">
            {doc.warnings.map((w) => <p key={w}>⚠ {w}</p>)}
          </div>
        )}
        <PdfButton className="w-full justify-center" run={() => exportPdf(box.current, `${p.info.code} ${doc.title} ${doc.number ?? ""}`.trim())}>Descarca PDF (A4)</PdfButton>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-[#e9e7e1] p-4">
        <div ref={box}>
          <QuoteDoc p={p} doc={doc} />
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RequireProject>
      <QuotePage />
    </RequireProject>
  );
}
