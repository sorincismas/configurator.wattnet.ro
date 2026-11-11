"use client";
import { RequireProject } from "@/components/shell/AppShell";
import { useSummary } from "@/components/shell/SummaryBar";
import { StagePlaceholder } from "@/components/stage/StagePlaceholder";
import { Card, Field, NumberInput, TextInput } from "@/components/ui";
import { fmtHours, fmtNum } from "@/lib/format";
import { useActiveProject, useUpdateActive } from "@/lib/store/store";

function Team() {
  const p = useActiveProject()!;
  const s = useSummary(p)!;
  const up = useUpdateActive();
  const t = p.team;
  return (
    <Card title="Echipa si program" subtitle="Folosite deja in bara de sumar pentru durata estimata.">
      <div className="grid gap-3 md:grid-cols-6">
        <Field label="Electricieni"><NumberInput value={t.electricians} min={0} onChange={(v) => up((x) => void (x.team.electricians = v ?? 0))} /></Field>
        <Field label="Ajutoare"><NumberInput value={t.helpers} min={0} onChange={(v) => up((x) => void (x.team.helpers = v ?? 0))} /></Field>
        <Field label="Randament ajutor" hint="0..1 fata de electrician"><NumberInput value={t.helperEfficiency} onChange={(v) => up((x) => void (x.team.helperEfficiency = Math.min(1, Math.max(0, v ?? 0.5))))} /></Field>
        <Field label="Ore / zi"><NumberInput value={t.hoursPerDay} onChange={(v) => up((x) => void (x.team.hoursPerDay = v ?? 8))} /></Field>
        <Field label="Zile / saptamana"><NumberInput value={t.workDaysPerWeek} onChange={(v) => up((x) => void (x.team.workDaysPerWeek = Math.min(7, Math.max(1, v ?? 5))))} /></Field>
        <Field label="Data start"><TextInput type="date" value={t.startDate ?? ""} onChange={(v) => up((x) => void (x.team.startDate = v || null))} /></Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-6 text-sm">
        <span>Ore-om: <b>{fmtHours(s.schedule.personHours)}</b></span>
        <span>Drum critic: <b>{fmtHours(s.schedule.criticalPathH)}</b></span>
        <span>Zile lucratoare: <b>{s.schedule.workDays === null ? "—" : fmtNum(s.schedule.workDays, 1)}</b></span>
        <span>Zile calendaristice: <b>{s.schedule.calendarDays ?? "—"}</b></span>
        {s.schedule.endDate && <span>Finalizare estimata: <b>{s.schedule.endDate}</b></span>}
      </div>
    </Card>
  );
}

export default function Page() {
  return (
    <StagePlaceholder
      title="Plan de executie"
      stage={7}
      items={[
        "Etape la rosu (pregatire, trasee, doze, cablare, tablouri, verificari) si la gata (aparataj, corpuri de iluminat, predare)",
        "Operatii cu subactiuni, legate de cantitati si incaperi",
        "Dependente intre operatii (ex. tragere cablu dupa copex)",
        "Durata calendaristica dupa echipa, program si operatii paralele",
        "Ajustare manuala a duratei, cu pastrarea timpului standard",
        "Checklist de santier",
      ]}
    >
      <RequireProject>
        <Team />
      </RequireProject>
    </StagePlaceholder>
  );
}
