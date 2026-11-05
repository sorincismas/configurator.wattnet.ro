"use client";
import Link from "next/link";
import { useMemo } from "react";
import { computeSummary, type ProjectSummary } from "@/lib/engine/summary";
import type { Qty } from "@/lib/engine/measure";
import type { Project } from "@/lib/model/types";
import { fmtHours, fmtKW, fmtMoney, fmtNum, NA, timeAgo } from "@/lib/format";
import { cx } from "../ui";

export function useSummary(p: Project | null): ProjectSummary | null {
  return useMemo(() => (p ? computeSummary(p) : null), [p]);
}

function Chip({ label, value, href, title, tone, sub }: { label: string; value: string; href?: string; title?: string; tone?: "warn" | "ok" | "muted" | "volt"; sub?: string }) {
  const inner = (
    <span
      title={title}
      className={cx(
        "flex h-full shrink-0 items-center gap-1 whitespace-nowrap px-2 text-[12px] leading-none",
        href && "hover:bg-white/10",
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
      <span
        className={cx(
          "font-semibold tabular-nums",
          tone === "warn" && "text-amber-300 italic",
          tone === "ok" && "text-emerald-300",
          tone === "muted" && "text-white/40",
          tone === "volt" && "text-volt",
          !tone && "text-white",
        )}
      >
        {value}
      </span>
      {sub && <span className="text-[10px] text-white/45">{sub}</span>}
    </span>
  );
  return href ? (
    <Link href={href} className="h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

const Sep = () => <span className="mx-0.5 h-4 w-px shrink-0 bg-white/15" />;

function lenTone(q: Qty): "warn" | "ok" | "muted" | undefined {
  if (q.value === null || q.value === 0) return "muted";
  if (q.certainty === "masurat") return "ok";
  if (q.certainty === "estimat" || q.certainty === "partial") return "warn";
  return undefined;
}
const lenTitle = (q: Qty) =>
  q.value === 0 && q.certainty === "necunoscut" ? "Nu exista elemente" : q.value === null ? "Date insuficiente" : q.certainty === "masurat" ? "Masurat" : q.certainty === "partial" ? "Partial masurat" : "Estimat" + (q.missing ? ` (${q.missing} valori lipsa)` : "");

export function SummaryBar({ project, onToggle, open }: { project: Project | null; onToggle: () => void; open: boolean }) {
  const s = useSummary(project);
  const cur = project?.library.firm.currency ?? "lei";

  if (!project || !s) {
    return (
      <div className="flex h-9 items-center px-3 text-[12px] text-white/50">
        Niciun proiect deschis - alege sau creeaza un proiect din <Link href="/" className="ml-1 underline">Proiecte</Link>.
      </div>
    );
  }

  const c = s.counts;
  const pw = s.power;
  const unsaved = !project.lastExportedAt || project.updatedAt > project.lastExportedAt;

  return (
    <div className="flex h-9 items-stretch">
      <div className="summary-scroll flex min-w-0 flex-1 items-center overflow-x-auto">
        <Chip label="" value={project.info.code} href="/proiect" tone="volt" title={project.info.name} />
        <Sep />
        <Chip label="DA" value={String(c.boxesDA)} href="/instalatie" title="Doze aparat" />
        <Chip label="DD" value={String(c.boxesDD)} href="/instalatie" title="Doze derivatie" />
        <Chip label="Prize" value={String(c.sockets)} href="/instalatie" />
        <Chip label="Intr" value={String(c.switches)} href="/instalatie" title="Intrerupatoare" />
        <Chip label="Ilum" value={String(c.lighting)} href="/instalatie" title="Puncte de iluminat" />
        <Chip label="Alte" value={String(c.otherDevices)} href="/instalatie" title="Consumatori dedicati, comenzi, alte aparate" />
        <Sep />
        <Chip label="CI" value={String(c.circuits)} href="/instalatie" title="Circuite" />
        <Chip label="TA" value={String(c.panels)} href="/tablouri" title="Tablouri" />
        <Chip label="TR" value={String(c.routes)} href="/trasee" title="Trasee" />
        <Sep />
        <Chip label="Traseu" value={s.lengths.route.value === null ? NA : fmtNum(s.lengths.route.value, 1) + " m"} tone={lenTone(s.lengths.route)} title={lenTitle(s.lengths.route)} href="/trasee" />
        <Chip label="Copex" value={s.lengths.conduit.value === null ? NA : fmtNum(s.lengths.conduit.value, 1) + " m"} tone={lenTone(s.lengths.conduit)} title={lenTitle(s.lengths.conduit)} href="/trasee" />
        <Chip label="Cablu" value={s.lengths.cable.value === null ? NA : fmtNum(s.lengths.cable.value, 1) + " m"} tone={lenTone(s.lengths.cable)} title={lenTitle(s.lengths.cable)} href="/trasee" />
        <Sep />
        <Chip label={project.supply.system === "mono" ? "1F" : "3F"} value={pw.available.effectiveKW === null ? NA : fmtNum(pw.available.effectiveKW, 2) + " kW"} tone={pw.available.effectiveKW === null ? "muted" : undefined} title={pw.available.effectiveKW === null ? "Putere disponibila: date insuficiente" : `Putere disponibila (${pw.available.basis})`} href="/alimentare" />
        <Chip label="Pi" value={fmtKW(pw.installed.value)} tone={pw.installed.unknownCount ? "warn" : pw.installed.knownCount === 0 ? "muted" : undefined} title={pw.installed.unknownCount ? `Putere instalata - ${pw.installed.unknownCount} consumatori fara putere` : "Putere instalata"} href="/alimentare" />
        <Chip label="Pa" value={fmtKW(pw.applied.value)} tone={pw.applied.insufficient ? (pw.applied.value === null ? "muted" : "warn") : undefined} title={pw.applied.insufficient ? "Putere aplicata - date insuficiente: " + pw.applied.reasons.join("; ") : "Putere aplicata"} href="/alimentare" />
        <Sep />
        <Chip label="Manopera" value={fmtMoney(s.labor.total, cur)} tone={s.labor.total === 0 ? "muted" : undefined} href="/deviz" />
        {project.quote.includeMaterials && <Chip label="Mat" value={fmtMoney(s.materials.total, cur)} href="/deviz" />}
        <Chip label="Timp" value={s.labor.hours > 0 ? fmtHours(s.labor.hours) : NA} tone={s.labor.hours > 0 ? undefined : "muted"} href="/plan" />
        <Chip label="Durata" value={s.schedule.workDays === null || s.labor.hours === 0 ? NA : fmtNum(s.schedule.workDays, 1) + " zile"} tone={s.labor.hours > 0 ? undefined : "muted"} href="/plan" title="Durata estimata in zile lucratoare, dupa echipa" />
        <Chip label="lei/h" value={s.labor.impliedHourlyRate === null ? NA : fmtNum(s.labor.impliedHourlyRate, 0)} tone={s.labor.impliedHourlyRate === null ? "muted" : undefined} title="Tarif orar implicit = valoare manopera / timp total" href="/deviz" />
      </div>
      <div className="flex shrink-0 items-center border-l border-white/10">
        <span className={cx("px-2.5 text-[11px]", unsaved ? "text-amber-300" : "text-emerald-300")} title={unsaved ? "Modificari neexportate in fisier JSON" : "Exportat in fisier"}>
          ●<span className="hidden sm:inline">{unsaved ? ` Neexportat (${timeAgo(project.lastExportedAt)})` : " Exportat"}</span>
        </span>
        <button onClick={onToggle} className="h-full px-3 text-[12px] text-white/70 hover:bg-white/10" title="Detalii sumar">
          {open ? "▲" : "▼"}
        </button>
      </div>
    </div>
  );
}

export function SummaryDetails({ project }: { project: Project }) {
  const s = useSummary(project)!;
  const cur = project.library.firm.currency;
  const row = (k: string, v: string, cls?: string) => (
    <div className="flex justify-between gap-4 py-0.5">
      <span className="text-ink-2">{k}</span>
      <span className={cx("font-medium tabular-nums", cls)}>{v}</span>
    </div>
  );
  const q = (x: Qty) => (x.value === null ? NA : fmtNum(x.value, 1) + " m");
  const qc = (x: Qty) => (x.value === null || (x.value === 0 && x.certainty === "necunoscut") ? "v-unknown" : x.certainty === "masurat" ? "v-measured" : "v-estimated");
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-3 border-b border-line bg-white px-4 py-3 text-[12px] md:grid-cols-5">
      <div>
        <p className="mb-1 font-semibold">Cladire</p>
        {row("Cladiri / niveluri", `${s.counts.buildings} / ${s.counts.levels}`)}
        {row("Incaperi", String(s.counts.rooms))}
        {row("Suprafata", s.area.value === null ? NA : fmtNum(s.area.value, 1) + " m²", qc(s.area))}
      </div>
      <div>
        <p className="mb-1 font-semibold">Elemente</p>
        {row("Doze aparat / derivatie", `${s.counts.boxesDA} / ${s.counts.boxesDD}`)}
        {row("Prize / intrerupatoare", `${s.counts.sockets} / ${s.counts.switches}`)}
        {row("Iluminat / alte", `${s.counts.lighting} / ${s.counts.otherDevices}`)}
        {row("Curenti slabi", String(s.counts.lowVoltage))}
      </div>
      <div>
        <p className="mb-1 font-semibold">Lungimi</p>
        {row("Traseu fizic", q(s.lengths.route), qc(s.lengths.route))}
        {row("Sant (o data / traseu)", q(s.lengths.chase), qc(s.lengths.chase))}
        {row("Copex", q(s.lengths.conduit), qc(s.lengths.conduit))}
        {row("Cablu", q(s.lengths.cable), qc(s.lengths.cable))}
      </div>
      <div>
        <p className="mb-1 font-semibold">Puteri</p>
        {row("Disponibila", s.power.available.effectiveKW === null ? "Date insuficiente" : fmtNum(s.power.available.effectiveKW) + " kW", s.power.available.effectiveKW === null ? "v-unknown" : "")}
        {row("Instalata", fmtKW(s.power.installed.value), s.power.installed.unknownCount ? "v-estimated" : "")}
        {row("Aplicata", s.power.applied.value === null ? "Date insuficiente" : fmtKW(s.power.applied.value), s.power.applied.insufficient ? "v-estimated" : "")}
      </div>
      <div>
        <p className="mb-1 font-semibold">Comercial si timp</p>
        {row("Manopera", fmtMoney(s.labor.total, cur))}
        {row("Materiale", project.quote.includeMaterials ? fmtMoney(s.materials.total, cur) : "neincluse")}
        {row("Timp manopera", s.labor.hours ? fmtHours(s.labor.hours) : NA)}
        {row("Tarif orar implicit", s.labor.impliedHourlyRate === null ? NA : fmtMoney(s.labor.impliedHourlyRate, cur + "/h"))}
      </div>
    </div>
  );
}
