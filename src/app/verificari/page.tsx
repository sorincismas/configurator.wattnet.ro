"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { RequireProject } from "@/components/shell/AppShell";
import { Badge, Button, Card, ConfirmButton, NumberInput, PageHeader, Select, Table, TextInput, cx } from "@/components/ui";
import { allChecks, checkStats, type CheckItem } from "@/lib/engine/checks";
import { uid } from "@/lib/model/ids";
import type { CheckResult, Measurement } from "@/lib/model/types";
import { useActiveProject, useUpdateActive } from "@/lib/store/store";

const LABEL: Record<CheckResult, string> = {
  conform: "Conform",
  avertizare: "Avertizare",
  neconform: "Neconform",
  date_insuficiente: "Date insuficiente",
  neverificat: "Neverificat",
};

function ResultBadge({ c }: { c: Pick<CheckItem, "result" | "ruleValidated"> }) {
  if (c.result === "conform" && !c.ruleValidated) return <Badge tone="info" title="Criteriul calculat este indeplinit, dar regula nu este inca validata de persoana autorizata">Indeplinit · regula nevalidata</Badge>;
  const tone = c.result === "conform" ? "ok" : c.result === "avertizare" ? "warn" : c.result === "neconform" ? "bad" : "neutral";
  return <Badge tone={tone}>{LABEL[c.result]}</Badge>;
}

const MEAS: { value: Measurement["kind"]; label: string; unit: string; limit: string }[] = [
  { value: "continuitate_pe", label: "Continuitate conductor PE", unit: "Ω", limit: "" },
  { value: "rezistenta_izolatie", label: "Rezistenta de izolatie", unit: "MΩ", limit: "" },
  { value: "impedanta_bucla", label: "Impedanta buclei de defect", unit: "Ω", limit: "" },
  { value: "rcd", label: "Timp / curent declansare RCD", unit: "ms", limit: "" },
  { value: "priza_pamant", label: "Rezistenta priza de pamant", unit: "Ω", limit: "" },
  { value: "altul", label: "Alta masuratoare", unit: "", limit: "" },
];

function ChecksPage() {
  const p = useActiveProject()!;
  const up = useUpdateActive();
  const checks = useMemo(() => allChecks(p), [p]);
  const stats = checkStats(checks);
  const [filter, setFilter] = useState<string>("probleme");
  const [scope, setScope] = useState<string>("all");
  const shown = checks.filter(
    (c) =>
      (scope === "all" || c.scope === scope) &&
      (filter === "all" || (filter === "probleme" ? c.result === "neconform" || c.result === "avertizare" || c.result === "date_insuficiente" : filter === "nevalidat" ? c.result === "conform" && !c.ruleValidated : c.result === filter)),
  );
  const unvalidatedRules = p.library.rules.filter((r) => r.validation !== "validat").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Verificari tehnice"
        subtitle="Verificari de calcul pe baza datelor introduse. Fiecare rezultat are regula si referinta. Aplicatia nu declara instalatia „conforma I7”: o verificare reusita nu demonstreaza conformitatea intregului proiect."
      />

      <div className="grid gap-3 md:grid-cols-6">
        {[
          { k: "neconform", label: "Neconforme", v: stats.neconform, cls: "text-red-700" },
          { k: "avertizare", label: "Avertizari", v: stats.avertizare, cls: "text-warn" },
          { k: "date_insuficiente", label: "Date insuficiente", v: stats.date_insuficiente, cls: "text-ink-2" },
          { k: "nevalidat", label: "Indeplinite · regula nevalidata", v: stats.conformNevalidat, cls: "text-blue-700" },
          { k: "conform", label: "Conforme (regula validata)", v: stats.conform, cls: "text-ok" },
          { k: "neverificat", label: "Neverificate", v: stats.neverificat, cls: "text-ink-3" },
        ].map((s) => (
          <button key={s.k} onClick={() => setFilter(s.k)} className={cx("rounded-lg border bg-white p-3 text-left", filter === s.k ? "border-ink" : "border-line")}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">{s.label}</p>
            <p className={cx("text-2xl font-semibold tabular-nums", s.cls)}>{s.v}</p>
          </button>
        ))}
      </div>

      {unvalidatedRules > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm">
          {unvalidatedRules} reguli din biblioteca sunt „de validat”. Rezultatele lor apar ca „Indeplinit · regula nevalidata” pana le validezi in{" "}
          <Link className="underline" href="/biblioteca">Biblioteca → Reguli tehnice</Link>.
        </div>
      )}

      <Card
        title={`Rezultate (${shown.length})`}
        actions={
          <>
            <Select className="w-44" value={scope} onChange={setScope} options={[{ value: "all", label: "Proiect, tablouri, circuite" }, { value: "project", label: "Proiect" }, { value: "panel", label: "Tablouri" }, { value: "circuit", label: "Circuite" }]} />
            <Select
              className="w-52"
              value={filter}
              onChange={setFilter}
              options={[{ value: "probleme", label: "De rezolvat (N + A + DI)" }, { value: "all", label: "Toate" }, ...Object.entries(LABEL).map(([value, label]) => ({ value, label })), { value: "nevalidat", label: "Indeplinite, regula nevalidata" }]}
            />
          </>
        }
      >
        {shown.length === 0 ? (
          <p className="text-sm text-ink-3">Nicio verificare in aceasta selectie.</p>
        ) : (
          <Table>
            <thead><tr><th>Element</th><th>Verificare</th><th>Rezultat</th><th>Detalii</th><th>Regula</th></tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.key}>
                  <td className="whitespace-nowrap">
                    <Link className="font-mono text-xs font-semibold hover:underline" href={c.scope === "circuit" ? "/circuite/" : c.scope === "panel" ? "/tablouri/" : "/alimentare/"}>{c.targetCode}</Link>
                  </td>
                  <td className="whitespace-nowrap font-medium">{c.title}</td>
                  <td className="whitespace-nowrap"><ResultBadge c={c} /></td>
                  <td className="text-xs text-ink-2">{c.message}</td>
                  <td className="whitespace-nowrap text-xs text-ink-3" title={c.reference}>{c.ruleCode} · {c.reference.split(", ").at(-1)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card
        title={`Masuratori efectuate (${p.measurements.length})`}
        subtitle="Doar valori masurate efectiv cu aparate de testare. Aplicatia nu genereaza si nu presupune rezultate de masuratori."
        actions={
          <Button
            size="sm"
            onClick={() =>
              up((x) => void x.measurements.push({ id: uid(), kind: "rezistenta_izolatie", targetKind: "circuit", targetId: x.circuits[0]?.id ?? null, value: null, unit: "MΩ", limit: "", result: "neverificat", instrument: "", date: new Date().toISOString().slice(0, 10), person: x.library.firm.designer, notes: "" }), "Masuratoare adaugata")
            }
          >
            + Masuratoare
          </Button>
        }
      >
        {p.measurements.length === 0 ? (
          <p className="text-sm text-ink-3">Nicio masuratoare inregistrata.</p>
        ) : (
          <Table>
            <thead><tr><th>Tip</th><th>Element</th><th className="num">Valoare</th><th>UM</th><th>Limita / criteriu</th><th>Rezultat</th><th>Aparat</th><th>Data</th><th>Persoana</th><th /></tr></thead>
            <tbody>
              {p.measurements.map((m) => {
                const set = (recipe: (x: Measurement) => void) => up((x) => { const y = x.measurements.find((z) => z.id === m.id); if (y) recipe(y); });
                return (
                  <tr key={m.id}>
                    <td className="min-w-48"><Select value={m.kind} onChange={(v) => set((x) => { x.kind = v; x.unit = MEAS.find((k) => k.value === v)?.unit ?? x.unit; })} options={MEAS.map((k) => ({ value: k.value, label: k.label }))} /></td>
                    <td className="min-w-40">
                      <Select
                        value={m.targetId ? `${m.targetKind}:${m.targetId}` : "project:"}
                        onChange={(v) => set((x) => { const [k, id] = v.split(":"); x.targetKind = k as Measurement["targetKind"]; x.targetId = id || null; })}
                        options={[{ value: "project:", label: "Proiect" }, ...p.panels.map((t) => ({ value: `panel:${t.id}`, label: t.code })), ...p.circuits.map((c) => ({ value: `circuit:${c.id}`, label: `${c.code} ${c.name}` }))]}
                      />
                    </td>
                    <td className="w-24"><NumberInput value={m.value} onChange={(v) => set((x) => void (x.value = v))} /></td>
                    <td className="w-16"><TextInput value={m.unit} onChange={(v) => set((x) => void (x.unit = v))} /></td>
                    <td className="min-w-32"><TextInput value={m.limit} placeholder="ex. ≥ 1 MΩ" onChange={(v) => set((x) => void (x.limit = v))} /></td>
                    <td className="w-40"><Select value={m.result} onChange={(v) => set((x) => void (x.result = v))} options={Object.entries(LABEL).map(([value, label]) => ({ value: value as CheckResult, label }))} /></td>
                    <td className="min-w-32"><TextInput value={m.instrument} placeholder="aparat / serie" onChange={(v) => set((x) => void (x.instrument = v))} /></td>
                    <td className="w-36"><TextInput type="date" value={m.date ?? ""} onChange={(v) => set((x) => void (x.date = v || null))} /></td>
                    <td className="min-w-32"><TextInput value={m.person} onChange={(v) => set((x) => void (x.person = v))} /></td>
                    <td><ConfirmButton onConfirm={() => up((x) => void (x.measurements = x.measurements.filter((z) => z.id !== m.id)))}>✕</ConfirmButton></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <RequireProject>
      <ChecksPage />
    </RequireProject>
  );
}
