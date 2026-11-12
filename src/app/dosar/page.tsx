"use client";
import { useMemo, useRef, useState } from "react";
import { RequireProject } from "@/components/shell/AppShell";
import { CHAPTERS, Dossier } from "@/components/dossier/Dossier";
import { QuoteDoc } from "@/components/quote/QuoteDoc";
import { Badge, Button, Card, Checkbox, ConfirmButton, Field, PageHeader, Select, Table, Tabs, TextArea, TextInput, cx } from "@/components/ui";
import { buildDocument } from "@/lib/engine/quote";
import { autoRegister, REGISTER_CATEGORY_LABEL } from "@/lib/engine/register";
import { DOC_KIND_LABEL, diffWithCurrent, issueVersion, modifiedSinceIssue, parseSnapshot, revLabel } from "@/lib/engine/versions";
import { fmtDate, fmtHours, fmtMoney, fmtNum, NA } from "@/lib/format";
import { downloadJSON } from "@/lib/io/files";
import { PdfButton } from "@/components/io/PdfButton";
import { exportPdf } from "@/lib/io/pdf";
import { uid } from "@/lib/model/ids";
import { nowISO } from "@/lib/model/factory";
import type { IssuedDocKind, IssuedVersion, Project, RegisterEntry } from "@/lib/model/types";
import { useActiveProject, useUpdateActive } from "@/lib/store/store";

const ALL = CHAPTERS.map((c) => c.id) as number[];
const PRESETS: { id: string; label: string; ch: number[] }[] = [
  { id: "complet", label: "Dosar complet", ch: ALL },
  { id: "tehnic", label: "Doar tehnic", ch: [1, 2, 6, 7, 8, 9, 10, 14] },
  { id: "tablouri", label: "Tablouri si scheme", ch: [1, 7, 8, 9] },
  { id: "comercial", label: "Comercial", ch: [1, 2, 4, 12, 14] },
];

function DossierPage() {
  const p = useActiveProject()!;
  const [tab, setTab] = useState<"dosar" | "versiuni" | "registru">("dosar");
  const modified = modifiedSinceIssue(p);
  const last = p.issued.at(-1);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Dosar si versiuni"
        subtitle="Dosarul tehnic se genereaza din acelasi model ca devizul si schemele. O versiune emisa este un instantaneu inghetat (proiect + tarife + reguli) si nu se mai modifica."
        actions={
          <span className="flex flex-wrap items-center gap-2 text-sm">
            {last ? (
              <>
                <span>Ultima emitere <b>{revLabel(last.number)}</b> · {fmtDate(last.issuedAt)}</span>
                {modified ? <Badge tone="warn">modificat dupa emitere</Badge> : <Badge tone="ok">identic cu versiunea emisa</Badge>}
              </>
            ) : (
              <Badge>nicio versiune emisa</Badge>
            )}
          </span>
        }
      />
      {modified && last && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Proiectul a fost modificat dupa {revLabel(last.number)}. Documentele emise raman neschimbate; pentru a transmite modificarile emite {revLabel(last.number + 1)}. Diferentele sunt in fila <b>Versiuni emise</b>.
        </div>
      )}
      <Tabs
        tabs={[
          { id: "dosar", label: "Dosar tehnic" },
          { id: "versiuni", label: "Versiuni emise", count: p.issued.length },
          { id: "registru", label: "Registru observatii", count: p.register.filter((e) => !e.resolved).length },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "dosar" && <DossierTab p={p} />}
      {tab === "versiuni" && <VersionsTab p={p} />}
      {tab === "registru" && <RegisterTab p={p} />}
    </div>
  );
}

/* ============================== DOSAR =============================== */

function ChapterPicker({ chapters, setChapters }: { chapters: number[]; setChapters: (c: number[]) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((pr) => (
          <Button key={pr.id} size="sm" variant={pr.ch.join() === chapters.join() ? "primary" : "secondary"} onClick={() => setChapters(pr.ch)}>
            {pr.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-1">
        {CHAPTERS.map((c) => (
          <Checkbox
            key={c.id}
            checked={chapters.includes(c.id)}
            onChange={(v) => setChapters(v ? [...chapters, c.id].sort((a, b) => a - b) : chapters.filter((x) => x !== c.id))}
            label={`${c.id}. ${c.title}`}
          />
        ))}
      </div>
    </div>
  );
}

function DossierTab({ p }: { p: Project }) {
  const up = useUpdateActive();
  const [chapters, setChapters] = useState<number[]>(ALL);
  const [kind, setKind] = useState<IssuedDocKind>("dosar_tehnic");
  const [reason, setReason] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const last = p.issued.at(-1);
  const next = (last?.number ?? 0) + 1;
  const stats = useMemo(() => {
    const a = autoRegister(p);
    return { nonconf: a.filter((e) => e.category === "neconformitate").length, open: p.register.filter((e) => !e.resolved).length };
  }, [p]);

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card title="Capitole" subtitle="Bifeaza capitolele de inclus; poti exporta si un singur capitol.">
          <ChapterPicker chapters={chapters} setChapters={setChapters} />
          <div className="mt-4 flex flex-wrap gap-2">
            <PdfButton disabled={!chapters.length} run={() => exportPdf(box.current, `${p.info.code} dosar ${last ? revLabel(last.number) : "ciorna"}`)}>
              Descarca PDF (A4)
            </PdfButton>
          </div>
          <p className="mt-2 text-xs text-ink-3">PDF-ul se salveaza direct in Descarcari. Paginile sunt A4; schemele monofilare sunt pe A4 peisaj.</p>
        </Card>

        <Card title={`Emite ${revLabel(next)}`} subtitle="Ingheata starea curenta a proiectului si a bibliotecii lui (tarife, materiale, reguli).">
          <div className="space-y-3">
            <Field label="Document emis">
              <Select<IssuedDocKind> value={kind} onChange={setKind} options={(Object.keys(DOC_KIND_LABEL) as IssuedDocKind[]).map((k) => ({ value: k, label: DOC_KIND_LABEL[k] }))} />
            </Field>
            <Field label="Motiv / descriere" hint={last ? "ex.: adaugare plita si circuit aer conditionat" : "ex.: oferta initiala"}>
              <TextInput value={reason} onChange={setReason} />
            </Field>
            {stats.nonconf > 0 && <p className="text-xs text-red-700">Atentie: {stats.nonconf} neconformitati in verificari. Emiterea este permisa, dar ele apar in capitolul 14.</p>}
            <Button
              variant="primary"
              onClick={() => {
                up((x) => void issueVersion(x, kind, reason.trim()));
                setReason("");
              }}
            >
              Emite {revLabel(next)}
            </Button>
            <p className="text-xs text-ink-3">Versiunile emise nu se modifica. Modificarile ulterioare se compara cu ultima versiune emisa.</p>
          </div>
        </Card>
      </div>

      <div className="min-w-0 overflow-x-auto rounded-md border border-line">
        {chapters.length ? (
          <Dossier ref={box} p={p} chapters={chapters} versionLabel={modifiedSinceIssue(p) || !last ? `${revLabel(next)} (ciorna)` : revLabel(last.number)} issuedAt={!modifiedSinceIssue(p) && last ? last.issuedAt : undefined} />
        ) : (
          <p className="p-8 text-center text-sm text-ink-3">Niciun capitol selectat.</p>
        )}
      </div>
    </div>
  );
}

/* ============================= VERSIUNI ============================= */

function VersionsTab({ p }: { p: Project }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const cur = p.library.firm.currency;
  const open = p.issued.find((v) => v.id === openId) ?? null;

  if (!p.issued.length)
    return (
      <Card>
        <p className="py-6 text-center text-sm text-ink-3">Nicio versiune emisa. Emite prima versiune din fila Dosar tehnic.</p>
      </Card>
    );

  return (
    <div className="space-y-4">
      <Card title="Istoric versiuni">
        <Table>
          <thead>
            <tr>
              <th>Revizie</th>
              <th>Document</th>
              <th>Emis</th>
              <th>Motiv</th>
              <th className="text-right">Manopera</th>
              <th className="text-right">Materiale</th>
              <th className="text-right">Timp</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...p.issued].reverse().map((v) => (
              <tr key={v.id} className={cx(openId === v.id && "bg-[var(--accent-bg)]")}>
                <td className="font-bold">{revLabel(v.number)}</td>
                <td>{DOC_KIND_LABEL[v.docKind]}</td>
                <td>{fmtDate(v.issuedAt)} {new Date(v.issuedAt).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}</td>
                <td>{v.reason || "—"}</td>
                <td className="text-right tabular-nums">{fmtMoney(v.totals.laborValue, cur)}</td>
                <td className="text-right tabular-nums">{v.totals.materialsValue === null ? "—" : fmtMoney(v.totals.materialsValue, cur)}</td>
                <td className="text-right tabular-nums">{v.totals.laborHours ? fmtHours(v.totals.laborHours) : NA}</td>
                <td className="whitespace-nowrap text-right">
                  <Button size="sm" variant={openId === v.id ? "primary" : "secondary"} onClick={() => setOpenId(openId === v.id ? null : v.id)}>
                    {openId === v.id ? "Inchide" : "Deschide"}
                  </Button>{" "}
                  <Button size="sm" onClick={() => downloadJSON(parseSnapshot(v), `${p.info.code}_${revLabel(v.number)}.json`)}>
                    JSON
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="mt-2 text-xs text-ink-3">JSON-ul unei versiuni este proiectul exact din momentul emiterii; poate fi importat ca proiect separat pentru consultare.</p>
      </Card>
      {open && <VersionView p={p} v={open} />}
    </div>
  );
}

function VersionView({ p, v }: { p: Project; v: IssuedVersion }) {
  const snap = useMemo(() => parseSnapshot(v), [v]);
  const diff = useMemo(() => diffWithCurrent(v, p), [v, p]);
  const [view, setView] = useState<"diferente" | "document" | "dosar">("diferente");
  const box = useRef<HTMLDivElement>(null);
  const cur = p.library.firm.currency;
  const doc = useMemo(() => buildDocument(snap, "oferta", "detaliat"), [snap]);
  const anyChange = diff.rows.some((r) => r.delta) || diff.addedCircuits.length || diff.removedCircuits.length || diff.changedCircuits.length;

  return (
    <Card
      title={`${revLabel(v.number)} · ${DOC_KIND_LABEL[v.docKind]} (doar citire)`}
      actions={
        view !== "diferente" && (
          <PdfButton size="sm" run={() => exportPdf(box.current, `${p.info.code} ${revLabel(v.number)} ${view === "dosar" ? "dosar" : "oferta"}`)}>
            Descarca PDF (A4)
          </PdfButton>
        )
      }
    >
      <Tabs
        tabs={[
          { id: "diferente", label: "Diferente fata de proiectul curent" },
          { id: "document", label: "Oferta emisa" },
          { id: "dosar", label: "Dosar emis" },
        ]}
        value={view}
        onChange={setView}
      />
      <div className="mt-3">
        {view === "diferente" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Table>
              <thead>
                <tr>
                  <th>Indicator</th>
                  <th className="text-right">{revLabel(v.number)}</th>
                  <th className="text-right">Curent</th>
                  <th className="text-right">Diferenta</th>
                </tr>
              </thead>
              <tbody>
                {diff.rows.map((r) => {
                  const f = (x: number | null) => (x === null ? NA : r.money ? fmtMoney(x, cur) : fmtNum(x, r.label.startsWith("Timp") ? 1 : 0));
                  return (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className="text-right tabular-nums">{f(r.before)}</td>
                      <td className="text-right tabular-nums">{f(r.after)}</td>
                      <td className={cx("text-right font-semibold tabular-nums", (r.delta ?? 0) > 0 && "text-amber-700", (r.delta ?? 0) < 0 && "text-sky-700")}>
                        {r.delta ? (r.delta > 0 ? "+" : "") + f(r.delta) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="space-y-3 text-sm">
              {!anyChange && <p className="text-ink-3">Proiectul curent nu difera de versiunea emisa la indicatorii urmariti.</p>}
              {diff.addedCircuits.length > 0 && (
                <div>
                  <p className="font-semibold">Circuite adaugate</p>
                  <p>{diff.addedCircuits.join(", ")}</p>
                </div>
              )}
              {diff.removedCircuits.length > 0 && (
                <div>
                  <p className="font-semibold">Circuite eliminate</p>
                  <p>{diff.removedCircuits.join(", ")}</p>
                </div>
              )}
              {diff.changedCircuits.length > 0 && (
                <div>
                  <p className="font-semibold">Circuite modificate (aparate, putere, cablu, protectie sau tablou)</p>
                  <p>{diff.changedCircuits.join(", ")}</p>
                </div>
              )}
              <p className="text-xs text-ink-3">Versiunea emisa foloseste tarifele, preturile si regulile din momentul emiterii, chiar daca biblioteca s-a schimbat intre timp.</p>
            </div>
          </div>
        )}
        {view === "document" && (
          <div className="overflow-x-auto rounded-md border border-line bg-[#e9e7e1] p-4">
            <QuoteDoc ref={box} p={snap} doc={doc} />
          </div>
        )}
        {view === "dosar" && (
          <div className="overflow-x-auto rounded-md border border-line">
            <Dossier ref={box} p={{ ...snap, issued: p.issued.filter((x) => x.number <= v.number) }} chapters={ALL} versionLabel={revLabel(v.number)} issuedAt={v.issuedAt} />
          </div>
        )}
      </div>
    </Card>
  );
}

/* ============================= REGISTRU ============================= */

const CATS = Object.keys(REGISTER_CATEGORY_LABEL) as RegisterEntry["category"][];

function RegisterTab({ p }: { p: Project }) {
  const up = useUpdateActive();
  const auto = useMemo(() => autoRegister(p), [p]);
  const set = (id: string, patch: Partial<RegisterEntry>) => up((x) => void Object.assign(x.register.find((e) => e.id === id)!, patch));

  return (
    <div className="space-y-4">
      <Card
        title="Observatii introduse"
        subtitle="Ipoteze, date de confirmat, neconformitati constatate pe santier. Apar in capitolul 14 al dosarului."
        actions={
          <Button
            size="sm"
            variant="primary"
            onClick={() =>
              up(
                (x) =>
                  void x.register.push({ id: uid(), category: "de_confirmat", text: "", recommendation: "", responsible: x.library.firm.designer, resolved: false, createdAt: nowISO() }),
                "Observatie adaugata in registru",
              )
            }
          >
            + Observatie
          </Button>
        }
      >
        {p.register.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-3">Nicio observatie introdusa.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="w-44">Categorie</th>
                <th>Descriere</th>
                <th>Recomandare</th>
                <th className="w-40">Responsabil</th>
                <th className="w-24">Rezolvat</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {p.register.map((e) => (
                <tr key={e.id} className={cx(e.resolved && "opacity-60")}>
                  <td>
                    <Select value={e.category} onChange={(v) => set(e.id, { category: v })} options={CATS.map((c) => ({ value: c, label: REGISTER_CATEGORY_LABEL[c] }))} />
                  </td>
                  <td><TextArea rows={2} value={e.text} onChange={(v) => set(e.id, { text: v })} /></td>
                  <td><TextArea rows={2} value={e.recommendation} onChange={(v) => set(e.id, { recommendation: v })} /></td>
                  <td><TextInput value={e.responsible} onChange={(v) => set(e.id, { responsible: v })} /></td>
                  <td><Checkbox checked={e.resolved} onChange={(v) => set(e.id, { resolved: v })} /></td>
                  <td>
                    <ConfirmButton onConfirm={() => up((x) => void (x.register = x.register.filter((r) => r.id !== e.id)))}>Sterge</ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card title={`Generate automat (${auto.length})`} subtitle="Rezulta din starea datelor: valori estimate, date lipsa, reguli nevalidate, rezultate ale verificarilor. Dispar singure cand datele se completeaza.">
        <Table>
          <thead>
            <tr>
              <th className="w-44">Categorie</th>
              <th>Descriere</th>
              <th>Recomandare</th>
            </tr>
          </thead>
          <tbody>
            {auto.map((e, i) => (
              <tr key={i}>
                <td>
                  <Badge tone={e.category === "neconformitate" ? "bad" : e.category === "avertizare" ? "warn" : e.category === "masurat" ? "ok" : "neutral"}>{REGISTER_CATEGORY_LABEL[e.category]}</Badge>
                </td>
                <td>{e.text}</td>
                <td className="text-ink-2">{e.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <RequireProject>
      <DossierPage />
    </RequireProject>
  );
}
