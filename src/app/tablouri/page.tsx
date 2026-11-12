"use client";
import { useMemo, useRef, useState } from "react";
import { RequireProject } from "@/components/shell/AppShell";
import { roomLabel } from "@/components/install/common";
import { DinView } from "@/components/panel/DinView";
import { QuickCircuits } from "@/components/panel/QuickCircuits";
import { SingleLine } from "@/components/panel/SingleLine";
import { Badge, Button, Card, Checkbox, Code, ConfirmButton, Empty, Field, NumberInput, PageHeader, Select, Table, TextInput, TrackedNumber, cx } from "@/components/ui";
import { circuitLoad } from "@/lib/engine/circuits";
import { balancePhases, DEFAULT_PANEL_OPTIONS, deviceOf, generatePanelEquipment, layoutPanel, moveItem, newPanel, phaseLoads, removePanel, type PanelGenReport } from "@/lib/engine/panels";
import { applySizing, panelLoad, proposeSizing, type SizingProposal } from "@/lib/engine/sizing";
import { usesDeclaredPower } from "@/lib/engine/power";
import { removeCircuit } from "@/lib/model/factory";
import { downloadSVG } from "@/lib/io/svg";
import { PdfButton } from "@/components/io/PdfButton";
import { exportSvgPdf } from "@/lib/io/pdf";
import { safeFileName } from "@/lib/io/files";
import { fmtNum, NA } from "@/lib/format";
import { takeCode, uid } from "@/lib/model/ids";
import type { Panel, PanelItem, PanelOptions, Project } from "@/lib/model/types";
import { useActiveProject, useUpdateActive } from "@/lib/store/store";

type Up = ReturnType<typeof useUpdateActive>;

function PanelsPage() {
  const p = useActiveProject()!;
  const up = useUpdateActive();
  const [sel, setSel] = useState<string | null>(null);
  const panel = p.panels.find((t) => t.id === sel) ?? p.panels[0] ?? null;

  const addPanel = (parent: string | null) => {
    let id = "";
    up((x) => {
      const isMain = !parent;
      const t = newPanel(x, isMain ? "Tablou general" : `Tablou secundar ${x.panels.length}`, parent, null);
      x.panels.push(t);
      id = t.id;
      // primul tablou preia toate circuitele fara tablou
      if (isMain) for (const c of x.circuits) if (!c.panelId) c.panelId = t.id;
    }, parent ? "Tablou secundar adaugat" : "Tablou principal adaugat");
    setSel(id);
  };

  // ordinea arborelui: principal, apoi secundarele lui
  const tree = useMemo(() => {
    const out: { t: Panel; depth: number }[] = [];
    const walk = (parent: string | null, depth: number) => {
      for (const t of p.panels.filter((x) => x.parentPanelId === parent)) {
        out.push({ t, depth });
        walk(t.id, depth + 1);
      }
    };
    walk(null, 0);
    for (const t of p.panels) if (!out.some((o) => o.t.id === t.id)) out.push({ t, depth: 0 });
    return out;
  }, [p.panels]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tablouri si scheme"
        subtitle="Tablou principal si tablouri secundare (pe etaje, anexe), legate prin alimentare. Echiparea propusa automat se poate modifica: ordinea, aparatele, randurile si rezervele."
        actions={
          <>
            {p.panels.length === 0 && <Button variant="primary" onClick={() => addPanel(null)}>+ Tablou principal</Button>}
            {p.panels.length > 0 && <Button onClick={() => addPanel(panel?.id ?? p.panels[0].id)}>+ Tablou secundar din {panel?.code}</Button>}
          </>
        }
      />
      {p.panels.length === 0 ? (
        <Empty title="Nu exista tablouri">Adauga tabloul principal; circuitele existente vor fi asociate lui.</Empty>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {tree.map(({ t, depth }) => {
              const lay = layoutPanel(p, t);
              const n = p.circuits.filter((c) => c.panelId === t.id).length;
              return (
                <button
                  key={t.id}
                  onClick={() => setSel(t.id)}
                  className={cx("rounded-lg border px-3 py-2 text-left text-sm", panel?.id === t.id ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-paper")}
                  style={{ marginLeft: depth * 16 }}
                >
                  <span className="font-mono text-xs font-bold">{depth > 0 ? "└ " : ""}{t.code}</span> {t.name}
                  <span className={cx("block text-[11px]", panel?.id === t.id ? "text-white/70" : "text-ink-3")}>
                    {n} circuite · {lay.capacity ? `${lay.usedModules}/${lay.capacity} mod.` : "fara cutie"}
                  </span>
                </button>
              );
            })}
          </div>
          {panel && <PanelEditor key={panel.id} p={p} panel={panel} up={up} onDeleted={() => setSel(null)} />}
        </>
      )}
    </div>
  );
}

function PanelEditor({ p, panel, up, onDeleted }: { p: Project; panel: Panel; up: Up; onDeleted: () => void }) {
  const lib = p.library;
  const setP = (recipe: (t: Panel) => void, h?: string) => up((x) => { const t = x.panels.find((z) => z.id === panel.id); if (t) recipe(t); }, h);
  const opt: PanelOptions = panel.options ?? DEFAULT_PANEL_OPTIONS;
  const [report, setReport] = useState<PanelGenReport | null>(null);
  const [selItem, setSelItem] = useState<string | null>(null);
  const dinRef = useRef<SVGSVGElement>(null);
  const sldRef = useRef<SVGSVGElement>(null);
  const sldBox = useRef<HTMLDivElement>(null);
  const lay = layoutPanel(p, panel);
  const load = panelLoad(p, panel.id);
  const circuits = p.circuits.filter((c) => c.panelId === panel.id).sort((a, b) => a.order - b.order);
  const ph = phaseLoads(p, panel.id);
  const parentPanels = p.panels.filter((t) => t.id !== panel.id);

  const generate = () => {
    let rep: PanelGenReport | null = null;
    up((x) => void (rep = generatePanelEquipment(x, panel.id)), `Echipare generata ${panel.code}`);
    setReport(rep);
  };

  return (
    <div className="space-y-4">
      <Card
        title={<span className="flex items-center gap-2"><Code>{panel.code}</Code><TextInput className="w-44 sm:w-64" value={panel.name} onChange={(v) => setP((t) => void (t.name = v))} /></span>}
        actions={
          <>
            <span className="text-sm text-ink-2">P aplicata <b>{fmtNum(load.appliedW / 1000, 2)} kW</b> · Ic <b>{load.currentA === null ? NA : fmtNum(load.currentA, 1)} A</b></span>
            <ConfirmButton label={`Sterge ${panel.code}`} onConfirm={() => { up((x) => removePanel(x, panel.id), `Tablou sters ${panel.code}`); onDeleted(); }}>Sterge tablou</ConfirmButton>
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Incapere / amplasare">
            <Select value={panel.roomId} placeholder="—" onChange={(v) => setP((t) => void (t.roomId = v || null))} options={p.rooms.map((r) => ({ value: r.id, label: roomLabel(p, r.id) }))} />
          </Field>
          <Field label="Detalii amplasare"><TextInput value={panel.location} placeholder="ex. hol, langa usa" onChange={(v) => setP((t) => void (t.location = v))} /></Field>
          <Field label="Cutie tablou">
            <Select value={panel.enclosureTypeId} placeholder="—" onChange={(v) => setP((t) => void (t.enclosureTypeId = v || null))} options={lib.enclosureTypes.map((e) => ({ value: e.id, label: `${e.name} (${e.rows * e.modulesPerRow})` }))} />
          </Field>
          <Field label="Rezerva dorita"><NumberInput value={panel.reservePct} suffix="%" onChange={(v) => setP((t) => void (t.reservePct = v ?? 0))} /></Field>
        </div>

        {panel.parentPanelId && (
          <div className="mt-4 rounded-md border border-line bg-paper p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Alimentare (feeder) din tabloul parinte</p>
            <div className="grid gap-3 md:grid-cols-5">
              <Field label="Tablou parinte">
                <Select value={panel.parentPanelId} onChange={(v) => setP((t) => void (t.parentPanelId = v))} options={parentPanels.map((t) => ({ value: t.id, label: `${t.code} ${t.name}` }))} />
              </Field>
              <Field label="Cablu"><Select value={panel.feeder.cableTypeId} placeholder="—" onChange={(v) => setP((t) => void (t.feeder.cableTypeId = v || null))} options={lib.cableTypes.map((c) => ({ value: c.id, label: c.name }))} /></Field>
              <Field label="Lungime"><TrackedNumber value={panel.feeder.lengthM} suffix="m" allowedProvenance={["estimat", "masurat"]} onChange={(v) => setP((t) => void (t.feeder.lengthM = v))} /></Field>
              <Field label="Pozare"><Select value={panel.feeder.installMethodId} placeholder="—" onChange={(v) => setP((t) => void (t.feeder.installMethodId = v || null))} options={lib.installMethods.map((m) => ({ value: m.id, label: m.name }))} /></Field>
              <Field label="Protectie in parinte">
                <Select
                  value={panel.feeder.protectionDeviceId}
                  placeholder="—"
                  onChange={(v) =>
                    up((x) => {
                      const t = x.panels.find((z) => z.id === panel.id)!;
                      const d = lib.protectionDevices.find((k) => k.id === v);
                      t.feeder.protectionDeviceId = v || null;
                      t.feeder.ratingA = d?.ratingA ?? null;
                      // aparatul din tabloul parinte urmeaza alegerea
                      const it = x.panels.find((z) => z.id === t.parentPanelId)?.items.find((i) => i.feedsPanelId === t.id);
                      if (it) it.protectionDeviceId = v || null;
                    })
                  }
                  options={lib.protectionDevices.filter((d) => d.kind === "MCB").map((d) => ({ value: d.id, label: `${d.name} - ${d.brand}` }))}
                />
              </Field>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-md border border-line p-3 text-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Echipare automata</span>
          <span className="flex items-center gap-1">
            Aparat general:
            <Select<PanelOptions["mainDevice"]>
              className="w-48"
              value={opt.mainDevice}
              onChange={(v) => setP((t) => void (t.options = { ...opt, mainDevice: v }))}
              options={[{ value: "separator", label: "Separator" }, { value: "mcb", label: "Intrerupator automat" }, { value: "rcd", label: "Diferential general" }, { value: "niciunul", label: "Fara" }]}
            />
          </span>
          <Checkbox checked={opt.useRcd} onChange={(v) => setP((t) => void (t.options = { ...opt, useRcd: v }))} label="Diferentiale pe grupuri de circuite" />
          <Checkbox checked={opt.includeSPD} onChange={(v) => setP((t) => void (t.options = { ...opt, includeSPD: v }))} label="Descarcator (SPD)" />
          <span className="ml-auto flex gap-2">
            {p.supply.system === "tri" && <Button onClick={() => up((x) => balancePhases(x, panel.id), `Echilibrare faze ${panel.code}`)}>Echilibreaza fazele</Button>}
            {panel.items.length > 0 ? (
              <ConfirmButton size="md" label="Regenereaza (inlocuieste echiparea)" onConfirm={generate}>Regenereaza echiparea…</ConfirmButton>
            ) : (
              <Button variant="primary" onClick={generate} disabled={circuits.length === 0}>Genereaza echiparea</Button>
            )}
          </span>
        </div>
        {report && (
          <p className="mt-2 text-sm">
            Echipare: <b>{report.items}</b> aparate, <b>{report.rcds}</b> diferentiale, cutie <b>{lib.enclosureTypes.find((e) => e.id === report.enclosure)?.name ?? "—"}</b>.
            {report.warnings.map((w) => <Badge key={w} tone="warn">{w}</Badge>)}
          </p>
        )}
        {p.supply.system === "tri" && (
          <p className="mt-2 text-xs text-ink-2">
            Faze (P aplicata): L1 {fmtNum(ph.L1 / 1000, 2)} · L2 {fmtNum(ph.L2 / 1000, 2)} · L3 {fmtNum(ph.L3 / 1000, 2)} kW · dezechilibru <span className={ph.imbalancePct > 20 ? "text-warn" : ""}>{ph.imbalancePct}%</span>
          </p>
        )}
      </Card>

      <CircuitSizingCard p={p} panel={panel} up={up} />

      <Card
        title="Vedere fizica - aparate pe sina DIN"
        subtitle={lay.capacity ? `${lay.usedModules} din ${lay.capacity} module ocupate · rezerva ${lay.reserveModules} module (${lay.reservePct}%)` : "Alege cutia tabloului"}
        actions={
          <>
            {lay.overflow.length > 0 && <Badge tone="bad">{lay.overflow.length} aparate nu incap</Badge>}
            <Button size="sm" onClick={() => downloadSVG(dinRef.current, `${safeFileName(p.info.code)}_${panel.code}_tablou.svg`)}>Descarca SVG</Button>
            <PdfButton size="sm" run={() => exportSvgPdf(dinRef.current, `${safeFileName(p.info.code)}_${panel.code}_tablou`)}>Descarca PDF (A4)</PdfButton>
          </>
        }
      >
        {panel.items.length === 0 ? (
          <Empty title="Tabloul nu este echipat">Apasa „Genereaza echiparea” sau adauga aparate manual.</Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_500px]">
            <div className="overflow-x-auto rounded-md border border-line bg-white p-2">
              <DinView ref={dinRef} p={p} panel={panel} selectedId={selItem} onSelect={setSelItem} />
            </div>
            <ItemsEditor p={p} panel={panel} up={up} selected={selItem} onSelect={setSelItem} />
          </div>
        )}
        {panel.items.length === 0 && <div className="mt-3"><ItemsEditor p={p} panel={panel} up={up} selected={selItem} onSelect={setSelItem} /></div>}
      </Card>

      <Card
        title="Schema monofilara"
        subtitle="Generata din tablou si circuite: alimentare, protectii, cabluri, consum pe fiecare circuit, ΔU si cartusul firmei."
        actions={
          <>
            <Button size="sm" onClick={() => downloadSVG(sldRef.current, `${safeFileName(p.info.code)}_${panel.code}_schema_monofilara.svg`)}>Descarca SVG</Button>
            <PdfButton size="sm" run={() => exportSvgPdf(sldRef.current, `${safeFileName(p.info.code)}_${panel.code}_schema_monofilara`)}>Descarca PDF (A4)</PdfButton>
          </>
        }
      >
        <div ref={sldBox} className="overflow-x-auto rounded-md border border-line bg-white">
          <div style={{ minWidth: 1100 }}>
            <SingleLine ref={sldRef} p={p} panel={panel} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function ItemsEditor({ p, panel, up, selected, onSelect }: { p: Project; panel: Panel; up: Up; selected: string | null; onSelect: (id: string | null) => void }) {
  const lib = p.library;
  const lay = layoutPanel(p, panel);
  const setItem = (id: string, recipe: (i: PanelItem) => void) => up((x) => { const t = x.panels.find((z) => z.id === panel.id); const i = t?.items.find((k) => k.id === id); if (i) recipe(i); });
  const addItem = (spare: boolean) =>
    up((x) => {
      const t = x.panels.find((z) => z.id === panel.id)!;
      t.items.push({ id: uid(), code: takeCode(x.counters, "EM"), protectionDeviceId: spare ? null : lib.protectionDevices.find((d) => d.kind === "MCB")?.id ?? null, label: spare ? "Rezerva" : "Aparat nou", circuitIds: [], downstreamItemIds: [], row: null, position: null, isSpare: spare, role: spare ? "rezerva" : "altul", feedsPanelId: null });
    }, spare ? "Rezerva adaugata" : "Aparat adaugat");
  const rowOf = (id: string) => lay.placed.find((x) => x.item.id === id)?.row;
  return (
    <div className="max-h-[560px] overflow-y-auto">
      <table className="dense w-full border-collapse text-sm">
        <thead><tr><th>Element</th><th>Aparat</th><th>Rand</th><th /></tr></thead>
        <tbody>
          {panel.items.map((it, k) => {
            const d = deviceOf(p, it);
            const c = p.circuits.find((x) => x.id === it.circuitIds[0]);
            const rcd = panel.items.find((r) => r.downstreamItemIds.includes(it.id));
            return (
              <tr key={it.id} className={cx(selected === it.id && "bg-volt/15")} onClick={() => onSelect(it.id)}>
                <td className="min-w-32">
                  <span className="font-mono text-[11px] text-ink-3">{it.code}</span>{" "}
                  <span className="font-medium">{c ? c.code : it.role === "general" ? "General" : it.role === "rcd" ? it.label : it.role === "feeder" ? it.label.replace("Alimentare ", "→ ") : it.label}</span>
                  {rcd && <div className="text-[10px] text-ink-3">sub {rcd.label}</div>}
                  {rowOf(it.id) === undefined && <Badge tone="bad">nu incape</Badge>}
                </td>
                <td className="min-w-40">
                  <Select
                    value={it.protectionDeviceId}
                    placeholder={it.isSpare ? "rezerva" : "de stabilit"}
                    onChange={(v) =>
                      up((x) => {
                        const t = x.panels.find((z) => z.id === panel.id)!;
                        const i = t.items.find((z) => z.id === it.id)!;
                        i.protectionDeviceId = v || null;
                        // aparatul circuitului actualizeaza si protectia circuitului
                        const nd = lib.protectionDevices.find((z) => z.id === v);
                        for (const cid of i.circuitIds) {
                          const cc = x.circuits.find((z) => z.id === cid);
                          if (cc && nd) cc.protection = { ...cc.protection, protectionDeviceId: nd.id, ratingA: nd.ratingA, curve: nd.curve, poles: nd.poles };
                        }
                      })
                    }
                    options={lib.protectionDevices.map((z) => ({ value: z.id, label: `${z.name} · ${z.modules}M · ${z.brand}` }))}
                  />
                  {d && <div className="text-[10px] text-ink-3">{d.modules} module</div>}
                </td>
                <td className="min-w-28">
                  <Select
                    value={it.row === null ? "" : String(it.row)}
                    onChange={(v) => setItem(it.id, (i) => void (i.row = v === "" ? null : Number(v)))}
                    options={[{ value: "", label: `auto (${(rowOf(it.id) ?? -1) + 1 || "—"})` }, ...Array.from({ length: lay.rows }).map((_, r) => ({ value: String(r), label: `rand ${r + 1}` }))]}
                  />
                </td>
                <td className="whitespace-nowrap text-right">
                  <Button size="sm" variant="ghost" disabled={k === 0} onClick={(e) => { e.stopPropagation(); up((x) => moveItem(x.panels.find((z) => z.id === panel.id)!, it.id, -1)); }}>↑</Button>
                  <Button size="sm" variant="ghost" disabled={k === panel.items.length - 1} onClick={(e) => { e.stopPropagation(); up((x) => moveItem(x.panels.find((z) => z.id === panel.id)!, it.id, 1)); }}>↓</Button>
                  <ConfirmButton onConfirm={() => up((x) => { const t = x.panels.find((z) => z.id === panel.id)!; t.items = t.items.filter((z) => z.id !== it.id); t.items.forEach((z) => (z.downstreamItemIds = z.downstreamItemIds.filter((q) => q !== it.id))); for (const cc of x.circuits) if (cc.protection.rcdItemId === it.id) cc.protection.rcdItemId = null; }, `Element sters ${it.code}`)}>✕</ConfirmButton>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={() => addItem(false)}>+ Aparat</Button>
        <Button size="sm" onClick={() => addItem(true)}>+ Rezerva</Button>
      </div>
    </div>
  );
}

function CircuitSizingCard({ p, panel, up }: { p: Project; panel: Panel; up: Up }) {
  const lib = p.library;
  const [props, setProps] = useState<Record<string, SizingProposal>>({});
  const circuits = p.circuits.filter((c) => c.panelId === panel.id && c.usage !== "curenti_slabi").sort((a, b) => a.order - b.order);
  const others = p.circuits.filter((c) => c.panelId !== panel.id && c.usage !== "curenti_slabi");
  const proposeAll = () => {
    const out: Record<string, SizingProposal> = {};
    for (const c of circuits) out[c.id] = proposeSizing(p, c);
    setProps(out);
  };
  return (
    <Card
      title={`Circuite in ${panel.code} (${circuits.length})`}
      subtitle="Propunerea calculeaza In din Ic, apoi cea mai mica sectiune cu I'z ≥ In si ΔU in limita. Se aplica doar daca o accepti; dupa aplicare regenereaza echiparea."
      actions={
        <>
          {others.length > 0 && (
            <Select className="w-64" value={null} placeholder="+ muta circuit in acest tablou…" onChange={(v) => v && up((x) => void (x.circuits.find((c) => c.id === v)!.panelId = panel.id), "Circuit mutat in tablou")} options={others.map((c) => ({ value: c.id, label: `${c.code} ${c.name} (${p.panels.find((t) => t.id === c.panelId)?.code ?? "fara tablou"})` }))} />
          )}
          <Button size="sm" onClick={proposeAll} disabled={circuits.length === 0}>Propune dimensionare pentru toate</Button>
        </>
      }
    >
      <div className="mb-3"><QuickCircuits p={p} panel={panel} up={up} /></div>
      {circuits.length === 0 ? (
        <p className="text-sm text-ink-3">Niciun circuit in acest tablou.</p>
      ) : (
        <Table>
          <thead><tr><th>Circuit</th><th>Putere / puncte declarate</th><th>Existent</th><th className="num">P apl.</th><th className="num">Ic</th><th>Cablu actual</th><th>Protectie actuala</th><th>Pozare</th><th>Propunere</th><th>Tablou</th></tr></thead>
          <tbody>
            {circuits.map((c) => {
              const l = circuitLoad(p, c);
              const pr = props[c.id];
              const cable = lib.cableTypes.find((t) => t.id === c.cableTypeId);
              const pd = lib.protectionDevices.find((d) => d.id === c.protection.protectionDeviceId);
              const same = pr?.ok && pr.cableTypeId === c.cableTypeId && pr.protectionDeviceId === c.protection.protectionDeviceId;
              return (
                <tr key={c.id}>
                  <td className="min-w-52">
                    <div className="flex items-center gap-1"><Code>{c.code}</Code><TextInput value={c.name} onChange={(v) => up((x) => void (x.circuits.find((z) => z.id === c.id)!.name = v))} /></div>
                  </td>
                  <td className="min-w-52">
                    {l.devices.length > 0 ? (
                      <span className="text-xs text-ink-3">din {l.devices.length} puncte modelate</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <TrackedNumber className="w-32" value={c.declaredPowerW ?? { value: null, provenance: "beneficiar" }} suffix="W" allowedProvenance={["beneficiar", "estimat", "proiectant", "masurat"]} onChange={(v) => up((x) => void (x.circuits.find((z) => z.id === c.id)!.declaredPowerW = v))} />
                        <NumberInput className="w-16" value={c.declaredPoints ?? null} placeholder="puncte" onChange={(v) => up((x) => void (x.circuits.find((z) => z.id === c.id)!.declaredPoints = v))} />
                      </div>
                    )}
                    {!usesDeclaredPower(p, c) && l.devices.length === 0 && <span className="text-[10px] text-warn">putere necunoscuta</span>}
                  </td>
                  <td className="text-center"><Checkbox checked={!!c.existing} onChange={(v) => up((x) => void (x.circuits.find((z) => z.id === c.id)!.existing = v), `${c.code} ${v ? "existent" : "nou"}`)} /></td>
                  <td className="num whitespace-nowrap">{l.appliedW === null ? NA : fmtNum(l.appliedW, 0) + " W"}</td>
                  <td className="num whitespace-nowrap">{l.designCurrentA === null ? NA : fmtNum(l.designCurrentA, 1) + " A"}</td>
                  <td>{cable?.name ?? <Badge tone="warn">de stabilit</Badge>}</td>
                  <td>{pd ? `${pd.curve ?? ""}${pd.ratingA} ${pd.poles}` : <Badge tone="warn">de stabilit</Badge>}</td>
                  <td className="w-24"><Select value={c.installMethodId} placeholder="—" onChange={(v) => up((x) => void (x.circuits.find((z) => z.id === c.id)!.installMethodId = v || null))} options={lib.installMethods.map((m) => ({ value: m.id, label: m.ref }))} /></td>
                  <td className="min-w-72">
                    {!pr ? (
                      <Button size="sm" variant="ghost" onClick={() => setProps((s) => ({ ...s, [c.id]: proposeSizing(p, c) }))}>Propune</Button>
                    ) : !pr.ok ? (
                      <span className="text-xs text-warn" title={pr.steps.join("\n")}>{pr.reason}</span>
                    ) : same ? (
                      <Badge tone="ok">identic cu propunerea</Badge>
                    ) : (
                      <span className="flex flex-wrap items-center gap-2 text-xs">
                        <b>{lib.cableTypes.find((t) => t.id === pr.cableTypeId)?.name} · {lib.protectionDevices.find((d) => d.id === pr.protectionDeviceId)?.name ?? `In ${pr.ratingA} A`}</b>
                        <Button size="sm" variant="primary" onClick={() => { up((x) => applySizing(x, c.id, pr), `Dimensionare aplicata ${c.code}`); setProps((s) => { const n = { ...s }; delete n[c.id]; return n; }); }}>Aplica</Button>
                        <details className="w-full">
                          <summary className="cursor-pointer text-ink-3">calcul</summary>
                          <ul className="mt-1 list-disc pl-4 text-ink-2">{pr.steps.map((s) => <li key={s}>{s}</li>)}</ul>
                          <p className="text-ink-3">{pr.reason}</p>
                        </details>
                      </span>
                    )}
                  </td>
                  <td className="w-40">
                    <div className="flex items-center gap-1">
                      <Select value={c.panelId} onChange={(v) => up((x) => void (x.circuits.find((z) => z.id === c.id)!.panelId = v), `${c.code} mutat in alt tablou`)} options={p.panels.map((t) => ({ value: t.id, label: t.code }))} />
                      {l.devices.length === 0 && <ConfirmButton onConfirm={() => up((x) => removeCircuit(x, c.id), `Circuit sters ${c.code}`)}>✕</ConfirmButton>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

export default function Page() {
  return (
    <RequireProject>
      <PanelsPage />
    </RequireProject>
  );
}
