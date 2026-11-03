"use client";

import { runChecks, type CheckCategory, type CheckResult, type CheckStatus, type PricingSettings, type Project } from "@/lib/engine";
import { Badge, Card } from "./ui";

const TONE: Record<CheckStatus, "ok" | "bad" | "warn"> = {
  conform: "ok",
  neconform: "bad",
  nedeterminat: "warn",
};
const ORDER: CheckStatus[] = ["neconform", "nedeterminat", "conform"];

export const CHECK_GROUPS: { id: CheckCategory; label: string }[] = [
  { id: "date", label: "Date proiect si alimentare" },
  { id: "circuite", label: "Circuite" },
  { id: "tablouri", label: "Tablouri" },
  { id: "selectivitate", label: "Selectivitate" },
];

/** Tab-ul unde se rezolva o verificare. */
export function checkTargetTab(c: CheckResult): string {
  if (c.ruleId.startsWith("CIRC-005") || c.ruleId === "DATE-002" || c.ruleId === "DEVIZ-001") return "niveluri";
  if (c.ruleId.startsWith("CIRC-004") || c.ruleId.startsWith("CIRC-006")) return "tablouri";
  if (c.ruleId.startsWith("CIRC")) return "circuite";
  if (c.ruleId.startsWith("TAB") || c.ruleId.startsWith("SEL")) return "tablouri";
  return "proiect";
}

export function sortChecks(list: CheckResult[]) {
  return [...list].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
}

export function ChecksTab({
  project,
  pricing,
  goTo,
}: {
  project: Project;
  pricing: PricingSettings;
  goTo?: (tab: string) => void;
}) {
  const checks = sortChecks(runChecks(project, pricing));
  const count = (s: CheckStatus, list = checks) => list.filter((c) => c.status === s).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
        Acestea sunt verificari de <strong>consistenta si de proiectare</strong>, cu limitele setate de tine in Tarife &amp;
        setari (prize pe circuit, Iz, ΔU, raport de selectivitate). Nu reprezinta verificarea conformitatii cu normativul
        I7. Regulile normative se adauga una cate una, cu referinta exacta, teste si validare de catre electricianul
        autorizat.
      </div>
      <div className="flex gap-2">
        <Badge tone="bad">{count("neconform")} neconforme</Badge>
        <Badge tone="warn">{count("nedeterminat")} nedeterminate</Badge>
        <Badge tone="ok">{count("conform")} conforme</Badge>
      </div>
      {CHECK_GROUPS.map((g) => {
        const list = checks.filter((c) => (c.category ?? "date") === g.id);
        if (!list.length) return null;
        return (
          <Card
            key={g.id}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {g.label}
                {count("neconform", list) > 0 && <Badge tone="bad">{count("neconform", list)}</Badge>}
                {count("nedeterminat", list) > 0 && <Badge tone="warn">{count("nedeterminat", list)}</Badge>}
                {count("conform", list) > 0 && <Badge tone="ok">{count("conform", list)}</Badge>}
              </span>
            }
          >
            <CheckList list={list} goTo={goTo} />
          </Card>
        );
      })}
    </div>
  );
}

export function CheckList({ list, goTo }: { list: CheckResult[]; goTo?: (tab: string) => void }) {
  return (
    <ul className="divide-y divide-slate-100">
      {list.map((c) => (
        <li key={c.id} className="flex flex-col gap-1 py-2 break-inside-avoid sm:flex-row sm:items-start sm:gap-3">
          <div className="w-32 shrink-0">
            <Badge tone={TONE[c.status]}>{c.status}</Badge>
          </div>
          <div className="flex-1">
            <div className="font-medium text-slate-900">
              {c.title} <span className="text-xs font-normal text-slate-400">{c.ruleId}</span>
            </div>
            <div className="text-sm text-slate-600">{c.message}</div>
            {c.reference && <div className="text-xs text-slate-500">{c.reference}</div>}
          </div>
          {goTo && c.status !== "conform" && (
            <button className="shrink-0 text-xs text-amber-700 underline print:hidden" onClick={() => goTo(checkTargetTab(c))}>
              rezolva →
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
