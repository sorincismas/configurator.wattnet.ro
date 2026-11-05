import type { Project } from "@/lib/engine";

/** Antet care apare doar la tiparire (A4). */
export function PrintHeader({ project, title }: { project: Project; title: string }) {
  const c = project.client;
  return (
    <div className="mb-4 hidden border-b-2 border-slate-900 pb-2 print:block">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-lg font-black tracking-wide">WATTNET</div>
          <div className="text-sm font-semibold">{title}</div>
        </div>
        <div className="text-right text-xs leading-tight">
          <div>
            <strong>{project.code}</strong> · {project.name}
          </div>
          <div>
            {c.name || "—"}
            {c.locality ? `, ${c.locality}` : ""}
          </div>
          {c.address && <div>{c.address}</div>}
          <div>Data: {new Date().toLocaleDateString("ro-RO")}</div>
        </div>
      </div>
    </div>
  );
}
