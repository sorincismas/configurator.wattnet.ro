"use client";
import { RequireProject } from "@/components/shell/AppShell";
import { useSummary } from "@/components/shell/SummaryBar";
import { levelOptions } from "@/components/install/common";
import { StagePlaceholder } from "@/components/stage/StagePlaceholder";
import { Badge, Card, Checkbox, NumberInput, Table, cx } from "@/components/ui";
import { resolveScope, SCOPE_PRESET_CATEGORIES } from "@/lib/engine/pricing";
import { fmtHours, fmtMoney, fmtNum } from "@/lib/format";
import type { Project, QuoteScope } from "@/lib/model/types";
import { useActiveProject, useUpdateActive } from "@/lib/store/store";

type Up = ReturnType<typeof useUpdateActive>;
const EMPTY_SCOPE: QuoteScope = { preset: "tot", categories: [], panelIds: [], levelIds: [] };

function ScopeCard({ p, up }: { p: Project; up: Up }) {
  const sc = p.quote.scope ?? EMPTY_SCOPE;
  const set = (patch: Partial<QuoteScope>) => up((x) => void (x.quote.scope = { ...(x.quote.scope ?? EMPTY_SCOPE), ...patch }), "Domeniul devizului modificat");
  const cats = [...new Set(p.library.operations.filter((o) => o.active).map((o) => o.category))];
  const toggle = (list: string[], v: string, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));
  const resolved = resolveScope(p);
  const manualOps = p.library.operations.filter((o) => o.active && o.driver === "manual" && (!resolved.categories || resolved.categories.has(o.category)));

  return (
    <Card title="Ce intra in deviz" subtitle="Poti oferta toata lucrarea sau doar o parte: un tablou, anumite niveluri, anumite categorii de lucrari. Restul proiectului ramane in model, dar nu se pune in deviz.">
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
          {sc.preset === "tablou" && <p className="text-sm">{SCOPE_PRESET_CATEGORIES.tablou.join(", ")}</p>}
          {sc.preset === "personalizat" && (
            <div className="grid grid-cols-2 gap-1">
              {cats.map((c) => <Checkbox key={c} checked={sc.categories.includes(c)} label={c} onChange={(on) => set({ categories: toggle(sc.categories, c, on) })} />)}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Tablouri (gol = toate)</p>
          {p.panels.length === 0 ? (
            <p className="text-sm text-ink-3">nu exista tablouri</p>
          ) : (
            <div className="grid gap-1">
              {p.panels.map((t) => <Checkbox key={t.id} checked={sc.panelIds.includes(t.id)} label={`${t.code} ${t.name}`} onChange={(on) => set({ panelIds: toggle(sc.panelIds, t.id, on) })} />)}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Niveluri (gol = toate)</p>
          <div className="grid gap-1">
            {levelOptions(p).map((l) => <Checkbox key={l.value} checked={sc.levelIds.includes(l.value)} label={l.label} onChange={(on) => set({ levelIds: toggle(sc.levelIds, l.value, on) })} />)}
          </div>
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
                  <NumberInput
                    className="w-32"
                    value={ov?.quantityOverride ?? null}
                    suffix={o.unit}
                    onChange={(v) =>
                      up((x) => {
                        const cur = x.operationOverrides.find((k) => k.operationId === o.id);
                        if (cur) cur.quantityOverride = v;
                        else x.operationOverrides.push({ operationId: o.id, enabled: true, quantityOverride: v, rateOverride: null, timeOverrideMin: null, note: "" });
                      })
                    }
                  />
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-3">Ex. „Demontare tablou existent” = 1 pentru o inlocuire de tablou. Circuitele marcate „existent” se ofera ca reconectare, fara cablu nou.</p>
        </div>
      )}
    </Card>
  );
}

function Preview() {
  const p = useActiveProject()!;
  const s = useSummary(p)!;
  const up = useUpdateActive();
  const cur = p.library.firm.currency;
  const scope = resolveScope(p);
  return (
    <>
      <ScopeCard p={p} up={up} />
      <Card
        title={<>Previzualizare deviz <Badge tone="volt">{scope.label}</Badge></>}
        subtitle="Cantitatile se calculeaza din model, in domeniul ales. Valoarea si timpul se calculeaza in paralel."
        actions={<Checkbox checked={p.quote.includeMaterials} onChange={(v) => up((x) => void (x.quote.includeMaterials = v))} label="Include materiale" />}
      >
        {s.labor.lines.length === 0 ? (
          <p className="text-sm text-ink-3">Nu exista operatii cu cantitati in domeniul ales.</p>
        ) : (
          <Table>
            <thead>
              <tr><th>Cod</th><th>Operatie</th><th>Categorie</th><th className="num">Cant.</th><th>UM</th><th className="num">Tarif</th><th className="num">Valoare</th><th className="num">Timp</th><th>Factori</th></tr>
            </thead>
            <tbody>
              {s.labor.lines.map((l) => (
                <tr key={l.operation.id}>
                  <td className="font-mono text-xs">{l.operation.code}</td>
                  <td>{l.operation.name} {l.operation.isExample && <Badge tone="warn">exemplu</Badge>} {l.quantitySource === "manual" && <Badge tone="info">manual</Badge>}</td>
                  <td className="text-xs">{l.operation.category}</td>
                  <td className="num">{fmtNum(l.quantity)}</td>
                  <td>{l.operation.unit}</td>
                  <td className="num">{fmtMoney(l.rate, cur)}</td>
                  <td className="num">{fmtMoney(l.value, cur)}</td>
                  <td className="num">{fmtNum(l.timeMin, 0)} min</td>
                  <td className="text-xs">{[...new Set(l.allocations.flatMap((a) => a.factors.map((f) => f.name)))].join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {p.quote.includeMaterials && s.materials.lines.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium">Materiale ({s.materials.lines.length} pozitii)</summary>
            <Table className="mt-2">
              <thead><tr><th>Material</th><th>Producator</th><th className="num">Cant.</th><th>UM</th><th className="num">Pret ofertat</th><th className="num">Valoare</th></tr></thead>
              <tbody>
                {s.materials.lines.map((m) => (
                  <tr key={m.materialId}><td>{m.name}</td><td className="text-xs">{m.brand}</td><td className="num">{fmtNum(m.quantity)}</td><td>{m.unit}</td><td className="num">{fmtMoney(m.offerPrice, cur)}</td><td className="num">{fmtMoney(m.value, cur)}</td></tr>
                ))}
              </tbody>
            </Table>
          </details>
        )}
        <div className="mt-3 flex flex-wrap gap-6 text-sm">
          <span>Manopera: <b>{fmtMoney(s.labor.total, cur)}</b></span>
          {p.quote.includeMaterials && <span>Materiale: <b>{fmtMoney(s.materials.total, cur)}</b></span>}
          <span>Timp: <b>{s.labor.hours ? fmtHours(s.labor.hours) : "—"}</b></span>
          <span>Tarif orar implicit: <b>{s.labor.impliedHourlyRate === null ? "—" : fmtMoney(s.labor.impliedHourlyRate, cur + "/h")}</b></span>
          <span>Total: <b>{fmtMoney(s.totals.gross, cur)}</b> {!s.totals.vatPayer && <span className="text-ink-3">(neplatitor TVA)</span>}</span>
        </div>
      </Card>
    </>
  );
}

export default function Page() {
  return (
    <StagePlaceholder
      title="Deviz"
      stage={4}
      items={[
        "Deviz doar manopera si varianta manopera + materiale, document pentru client",
        "Subtotaluri pe nivel, incapere, categorie, faza si tablou",
        "Cantitati, tarife si timpi modificabili pe proiect (cu urma calculului initial)",
        "Costuri suplimentare (deplasare, organizare), discount",
        "Tarif orar implicit pe proiect, faza, categorie, operatie; comparatie intre proiecte",
      ]}
    >
      <RequireProject>
        <Preview />
      </RequireProject>
    </StagePlaceholder>
  );
}

