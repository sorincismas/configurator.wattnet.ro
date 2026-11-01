"use client";

import { runChecks, type CheckStatus, type PricingSettings, type Project } from "@/lib/engine";
import { Badge, Card } from "./ui";

const TONE: Record<CheckStatus, "ok" | "bad" | "warn"> = {
  conform: "ok",
  neconform: "bad",
  nedeterminat: "warn",
};
const ORDER: CheckStatus[] = ["neconform", "nedeterminat", "conform"];

export function ChecksTab({ project, pricing }: { project: Project; pricing: PricingSettings }) {
  const checks = runChecks(project, pricing).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const count = (s: CheckStatus) => checks.filter((c) => c.status === s).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
        Acestea sunt verificari de <strong>consistenta a datelor</strong> (capacitate tablou, date lipsa, estimari). Nu
        reprezinta verificarea conformitatii cu normativul I7. Regulile normative se adauga una cate una, cu referinta
        exacta, teste si validare de catre electricianul autorizat.
      </div>
      <div className="flex gap-2">
        <Badge tone="bad">{count("neconform")} neconforme</Badge>
        <Badge tone="warn">{count("nedeterminat")} nedeterminate</Badge>
        <Badge tone="ok">{count("conform")} conforme</Badge>
      </div>
      <Card>
        <ul className="divide-y divide-slate-100">
          {checks.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:gap-3">
              <div className="w-32 shrink-0">
                <Badge tone={TONE[c.status]}>{c.status}</Badge>
              </div>
              <div className="flex-1">
                <div className="font-medium text-slate-900">
                  {c.title} <span className="text-xs font-normal text-slate-400">{c.ruleId}</span>
                </div>
                <div className="text-sm text-slate-600">{c.message}</div>
                {c.reference && <div className="text-xs text-slate-500">Ref.: {c.reference}</div>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
