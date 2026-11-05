"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useActiveProject, useApp } from "@/lib/store/store";
import { CURRENT_STAGE, NAV } from "./nav";
import { accentFor } from "./theme";
import { Logo } from "./Logo";
import { SummaryBar, SummaryDetails } from "./SummaryBar";
import { cx, useIsClient } from "../ui";

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useApp((s) => s.hydrated);
  const project = useActiveProject();
  const firm = useApp((s) => s.library.firm);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const mounted = useIsClient();

  const norm = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);
  const path = norm(pathname ?? "/");
  const accent = accentFor(path);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="no-print sticky top-0 z-40 bg-ink text-white shadow-sm">
        {mounted && hydrated ? <SummaryBar project={project} open={open} onToggle={() => setOpen((v) => !v)} /> : <div className="h-9" />}
        {open && project && mounted && <div className="text-ink"><SummaryDetails project={project} /></div>}
      </div>
      <div className="flex flex-1">
        <aside className="no-print sticky top-9 hidden h-[calc(100vh-2.25rem)] w-56 shrink-0 flex-col border-r border-line bg-white md:flex">
          <div className="px-4 py-4">
            <Link href="/">
              <Logo firm={mounted ? firm : undefined} />
            </Link>
            <p className="mt-1 text-[11px] text-ink-3">Configurator instalatii electrice</p>
          </div>
          {mounted && project && (
            <div className="mx-3 mb-2 rounded-md bg-paper px-3 py-2">
              <p className="font-mono text-[11px] text-ink-2">{project.info.code}</p>
              <p className="truncate text-sm font-medium" title={project.info.name}>{project.info.name}</p>
            </div>
          )}
          <nav className="flex-1 overflow-y-auto px-2 pb-4">
            <NavList path={path} hasProject={!!project} />
          </nav>
          <div className="border-t border-line px-4 py-2 text-[10px] text-ink-3">Date stocate local in browser. Exporta periodic in JSON.</div>
        </aside>
        <main className="min-w-0 flex-1 px-3 pb-24 pt-4 md:px-8 md:py-6" style={{ ["--accent" as string]: accent.c, ["--accent-bg" as string]: accent.bg }}>
          {!mounted || !hydrated ? <p className="text-sm text-ink-3">Se incarca datele locale…</p> : children}
        </main>
      </div>

      {/* telefon: bara de jos si meniul complet */}
      {mounted && hydrated && (
        <>
          <nav className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
            {NAV.filter((n) => n.short).map((n) => {
              const active = path === n.href;
              const disabled = n.needsProject && !project;
              const a = accentFor(n.href);
              return (
                <Link key={n.href} href={disabled ? "#" : n.href} onClick={() => setMenu(false)} className={cx("flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px]", disabled && "pointer-events-none opacity-40", active ? "font-semibold" : "text-ink-2")} style={active ? { color: a.c } : undefined}>
                  <span className="h-1.5 w-6 rounded-full" style={{ background: active ? a.c : "transparent" }} />
                  {n.short}
                </Link>
              );
            })}
            <button onClick={() => setMenu((v) => !v)} className={cx("flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px]", menu ? "font-semibold text-ink" : "text-ink-2")}>
              <span className="h-1.5 w-6 rounded-full" style={{ background: menu ? "#14181f" : "transparent" }} />
              Meniu
            </button>
          </nav>
          {menu && (
            <div className="no-print fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setMenu(false)}>
              <div className="absolute inset-x-0 bottom-14 max-h-[75vh] overflow-y-auto rounded-t-xl bg-white px-2 pb-4 pt-2 shadow-lg" onClick={(e) => e.stopPropagation()}>
                {project && (
                  <div className="mx-2 mb-1 rounded-md bg-paper px-3 py-2">
                    <p className="font-mono text-[11px] text-ink-2">{project.info.code}</p>
                    <p className="truncate text-sm font-medium">{project.info.name}</p>
                  </div>
                )}
                <NavList path={path} hasProject={!!project} onNavigate={() => setMenu(false)} large />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NavList({ path, hasProject, onNavigate, large }: { path: string; hasProject: boolean; onNavigate?: () => void; large?: boolean }) {
  const groups = [...new Set(NAV.map((n) => n.group))];
  return (
    <>
            {groups.map((g) => (
              <div key={g} className="mt-3">
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3">{g}</p>
                {NAV.filter((n) => n.group === g).map((n) => {
                  const active = path === n.href;
                  const disabled = n.needsProject && !hasProject;
                  const future = n.stage > CURRENT_STAGE;
                  const a = accentFor(n.href);
                  return (
                    <Link
                      key={n.href}
                      href={disabled ? "#" : n.href}
                      aria-disabled={disabled}
                      onClick={onNavigate}
                      className={cx(
                        "flex items-center justify-between rounded-md px-2 text-sm",
                        large ? "min-h-11 py-2" : "py-1.5",
                        active ? "font-semibold text-white shadow-sm" : "text-ink hover:bg-paper",
                        disabled && "pointer-events-none opacity-40",
                      )}
                      style={active ? { background: a.c } : undefined}
                    >
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: active ? "#fff" : a.c }} />
                        {n.label}
                      </span>
                      {future && <span className={cx("rounded px-1 text-[10px]", active ? "bg-white/20" : "bg-paper-2 text-ink-3")}>E{n.stage}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
    </>
  );
}

/** pagina care necesita proiect activ */
export function RequireProject({ children }: { children: ReactNode }) {
  const p = useActiveProject();
  if (!p)
    return (
      <div className="rounded-lg border border-dashed border-line bg-white p-10 text-center">
        <p className="font-medium">Niciun proiect deschis</p>
        <p className="mt-1 text-sm text-ink-2">
          Deschide sau creeaza un proiect din{" "}
          <Link className="underline" href="/">
            Proiecte
          </Link>
          .
        </p>
      </div>
    );
  return <>{children}</>;
}
