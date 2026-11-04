"use client";
import { RequireProject } from "@/components/shell/AppShell";
import { useSummary } from "@/components/shell/SummaryBar";
import { Badge, Card, Field, NumberInput, PageHeader, Select, TextArea, TrackedNumber } from "@/components/ui";
import { fmtKW, fmtNum, NA } from "@/lib/format";
import { useActiveProject, useUpdateActive } from "@/lib/store/store";
import type { EarthingSystem, PhaseSystem } from "@/lib/model/types";

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: "warn" | "muted" | "bad" }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">{label}</p>
      <p className={"mt-1 text-2xl font-semibold tabular-nums " + (tone === "warn" ? "text-warn italic" : tone === "muted" ? "text-ink-3" : tone === "bad" ? "text-red-700" : "")}>{value}</p>
      {sub && <div className="mt-1 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

function SupplyPage() {
  const p = useActiveProject()!;
  const up = useUpdateActive();
  const s = useSummary(p)!;
  const sup = p.supply;
  const av = s.power.available;
  const inst = s.power.installed;
  const ap = s.power.applied;
  const usage = ap.value !== null && av.effectiveKW ? (ap.value / 1000 / av.effectiveKW) * 100 : null;

  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader title="Alimentare si puteri" subtitle="Puterea disponibila, instalata si aplicata sunt indicatori distincti si nu se confunda." />

      <div className="grid gap-3 md:grid-cols-3">
        <Stat
          label="Putere disponibila"
          value={av.effectiveKW === null ? "Date insuficiente" : fmtNum(av.effectiveKW) + " kW"}
          tone={av.effectiveKW === null ? "muted" : undefined}
          sub={
            av.basis === "aprobata" ? "din puterea aprobata (ATR)" : av.basis === "protectie" ? <>din protectia generala: {fmtNum(av.fromBreakerKVA)} kVA x cos φ {fmtNum(sup.cosPhi)}</> : "introdu protectia generala sau puterea aprobata"
          }
        />
        <Stat
          label="Putere instalata"
          value={fmtKW(inst.value)}
          tone={inst.unknownCount ? "warn" : undefined}
          sub={inst.unknownCount ? `${inst.unknownCount} consumatori fara putere introdusa (din ${inst.knownCount + inst.unknownCount})` : `suma puterilor introduse (${inst.knownCount} consumatori)`}
        />
        <Stat
          label="Putere aplicata"
          value={ap.value === null ? "Date insuficiente" : fmtKW(ap.value)}
          tone={ap.value === null ? "muted" : ap.insufficient ? "warn" : usage !== null && usage > 100 ? "bad" : undefined}
          sub={
            <>
              {usage !== null && <p>{fmtNum(usage, 0)}% din puterea disponibila {usage > 100 && <Badge tone="bad">depasire</Badge>}</p>}
              {ap.reasons.map((r) => <p key={r} className="text-warn">{r}</p>)}
            </>
          }
        />
      </div>

      <Card title="Date de alimentare">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Sistem">
            <Select<PhaseSystem>
              value={sup.system}
              onChange={(v) => up((x) => { x.supply.system = v; x.supply.voltageV = v === "mono" ? 230 : 400; }, `Alimentare ${v === "mono" ? "monofazata" : "trifazata"}`)}
              options={[{ value: "mono", label: "Monofazat 230 V" }, { value: "tri", label: "Trifazat 400 V" }]}
            />
          </Field>
          <Field label="Tensiune nominala" hint={sup.system === "tri" ? "intre faze" : "faza - neutru"}>
            <NumberInput value={sup.voltageV} suffix="V" onChange={(v) => up((x) => void (x.supply.voltageV = v ?? (x.supply.system === "mono" ? 230 : 400)))} />
          </Field>
          <Field label="Protectie generala / BMPT" hint="E = estimat, M = masurat, B = beneficiar">
            <TrackedNumber value={sup.mainBreakerA} suffix="A" allowedProvenance={["beneficiar", "proiectant", "masurat", "estimat"]} onChange={(v) => up((x) => void (x.supply.mainBreakerA = v))} />
          </Field>
          <Field label="Putere aprobata (ATR)" hint="daca este cunoscuta">
            <TrackedNumber value={sup.approvedPowerKW} suffix="kW" allowedProvenance={["beneficiar", "proiectant", "estimat"]} onChange={(v) => up((x) => void (x.supply.approvedPowerKW = v))} />
          </Field>
          <Field label="cos φ (calcule orientative)">
            <NumberInput value={sup.cosPhi} onChange={(v) => up((x) => void (x.supply.cosPhi = Math.min(1, Math.max(0.5, v ?? 0.95))))} />
          </Field>
          <Field label="Sistem legare la pamant">
            <Select<EarthingSystem>
              value={sup.earthing}
              onChange={(v) => up((x) => void (x.supply.earthing = v))}
              options={[{ value: "necunoscut", label: "De identificat" }, { value: "TN-S", label: "TN-S" }, { value: "TN-C-S", label: "TN-C-S" }, { value: "TT", label: "TT" }]}
            />
          </Field>
          <Field label="Rezistenta priza de pamant" hint="doar valoare masurata efectiv">
            <TrackedNumber value={sup.earthResistanceOhm} suffix="Ω" allowedProvenance={["masurat", "beneficiar"]} onChange={(v) => up((x) => void (x.supply.earthResistanceOhm = v))} />
          </Field>
          <Field label="Simultaneitate globala" hint="0..1, aplicata dupa simultaneitatea circuitelor">
            <TrackedNumber value={p.globalSimultaneity} allowedProvenance={["estimat", "proiectant"]} onChange={(v) => up((x) => void (x.globalSimultaneity = { ...v, value: v.value === null ? null : Math.min(1, Math.max(0, v.value)) }))} />
          </Field>
        </div>
        <Field label="Observatii alimentare" className="mt-3">
          <TextArea value={sup.notes} onChange={(v) => up((x) => void (x.supply.notes = v))} rows={2} />
        </Field>
        <p className="mt-3 text-xs text-ink-3">
          Exemplu orientativ: 230 V x 32 A ≈ 7,36 kVA; puterea activa depinde de factorul de putere. Ipotezele de simultaneitate se stabilesc de electrician si apar in dosar.
          {av.fromBreakerKVA !== null && <> Protectia introdusa corespunde la {fmtNum(av.fromBreakerKVA)} kVA.</>}
          {av.effectiveKW === null && <> Putere disponibila: {NA}.</>}
        </p>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <RequireProject>
      <SupplyPage />
    </RequireProject>
  );
}
