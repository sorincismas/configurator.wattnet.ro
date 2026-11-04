import type { ReactNode } from "react";
import { PageHeader } from "../ui";

/** pagina pentru module din etapele urmatoare: arata ce va contine */
export function StagePlaceholder({ title, stage, items, children }: { title: string; stage: number; items: string[]; children?: ReactNode }) {
  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader title={title} subtitle={`Modul planificat in etapa ${stage}. Modelul de date este deja pregatit; datele introduse acum raman compatibile.`} />
      <div className="rounded-lg border border-dashed border-line bg-white p-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Ce va contine</p>
        <ul className="grid gap-1 text-sm text-ink-2 md:grid-cols-2">
          {items.map((i) => (
            <li key={i} className="flex gap-2">
              <span className="text-volt">■</span>
              {i}
            </li>
          ))}
        </ul>
      </div>
      {children}
    </div>
  );
}
