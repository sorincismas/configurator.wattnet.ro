"use client";

import { useRef, useState } from "react";
import { computeQuote, demoProject, newProject, runChecks, uid, type Project } from "@/lib/engine";
import { useWorkspace } from "@/lib/store";
import { ChecksTab } from "./ChecksTab";
import { LevelsTab } from "./LevelsTab";
import { PanelsTab } from "./PanelsTab";
import { PricingTab } from "./PricingTab";
import { ProjectTab } from "./ProjectTab";
import { QuoteTab } from "./QuoteTab";
import { Button, lei } from "./ui";

type Tab = "proiect" | "niveluri" | "tablouri" | "deviz" | "verificari" | "tarife";

const TABS: { id: Tab; label: string }[] = [
  { id: "proiect", label: "Proiect" },
  { id: "niveluri", label: "Niveluri & doze" },
  { id: "tablouri", label: "Tablouri" },
  { id: "deviz", label: "Deviz & plan" },
  { id: "verificari", label: "Verificari" },
  { id: "tarife", label: "Tarife" },
];

export function Configurator() {
  const ws = useWorkspace();
  const [tab, setTab] = useState<Tab>("niveluri");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ws.loaded) {
    return <div className="p-8 text-slate-500">Se incarca…</div>;
  }

  const project = ws.projects.find((p) => p.id === ws.currentId) ?? ws.projects[0];

  const add = (p: Project) => {
    ws.setProjects((list) => [...list, p]);
    ws.setCurrentId(p.id);
  };

  const exportJson = () => {
    if (!project) return;
    const blob = new Blob([JSON.stringify({ project, pricing: ws.pricing }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.code || "proiect"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const p: Project | undefined = data?.project ?? (data?.schemaVersion ? data : undefined);
      if (!p || p.schemaVersion !== 1 || !Array.isArray(p.levels)) throw new Error("format");
      add({ ...p, id: uid(), updatedAt: new Date().toISOString() });
    } catch {
      alert("Fisierul nu este un proiect WATTNET valid.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-800 bg-slate-900 text-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400 text-lg font-black text-slate-900">
              W
            </div>
            <div>
              <div className="font-bold tracking-wide">WATTNET · Configurator</div>
              <div className="text-xs text-slate-400">Faza 1 — lucrari „la rosu”</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ws.projects.length > 0 && (
              <select
                className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm"
                value={project?.id}
                onChange={(e) => ws.setCurrentId(e.target.value)}
                aria-label="Proiect curent"
              >
                {ws.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            )}
            <HeaderBtn onClick={() => add(newProject(ws.projects.length + 1))}>+ Proiect nou</HeaderBtn>
            {project && (
              <>
                <HeaderBtn
                  onClick={() =>
                    add({
                      ...structuredClone(project),
                      id: uid(),
                      name: `${project.name} (copie)`,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    })
                  }
                >
                  Duplica
                </HeaderBtn>
                <HeaderBtn onClick={exportJson}>Export JSON</HeaderBtn>
              </>
            )}
            <HeaderBtn onClick={() => fileRef.current?.click()}>Import</HeaderBtn>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.target.value = "";
              }}
            />
            {project && (
              <HeaderBtn
                danger
                onClick={() => {
                  if (!confirm(`Stergi proiectul „${project.name}"? Actiunea nu poate fi anulata.`)) return;
                  ws.setProjects((list) => list.filter((p) => p.id !== project.id));
                  ws.setCurrentId(null);
                }}
              >
                Sterge
              </HeaderBtn>
            )}
          </div>
        </div>
      </header>

      {!project ? (
        <Empty onNew={() => add(newProject(1))} onDemo={() => add(demoProject())} />
      ) : (
        <>
          <Summary project={project} ws={ws} />
          <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
            <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
                    tab === t.id
                      ? "border-amber-500 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </nav>
          <main className="mx-auto max-w-7xl px-4 py-5">
            {tab === "proiect" && <ProjectTab project={project} update={(fn) => ws.updateProject(project.id, fn)} />}
            {tab === "niveluri" && (
              <LevelsTab project={project} pricing={ws.pricing} update={(fn) => ws.updateProject(project.id, fn)} />
            )}
            {tab === "tablouri" && <PanelsTab project={project} update={(fn) => ws.updateProject(project.id, fn)} />}
            {tab === "deviz" && (
              <QuoteTab
                project={project}
                pricing={ws.pricing}
                update={(fn) => ws.updateProject(project.id, fn)}
                goToPricing={() => setTab("tarife")}
              />
            )}
            {tab === "verificari" && <ChecksTab project={project} pricing={ws.pricing} />}
            {tab === "tarife" && <PricingTab pricing={ws.pricing} setPricing={ws.setPricing} />}
          </main>
        </>
      )}
    </div>
  );
}

function Summary({ project, ws }: { project: Project; ws: ReturnType<typeof useWorkspace> }) {
  const q = computeQuote(project, ws.pricing);
  const checks = runChecks(project, ws.pricing);
  const bad = checks.filter((c) => c.status === "neconform").length;
  const open = checks.filter((c) => c.status === "nedeterminat").length;
  return (
    <div className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-3 text-sm sm:grid-cols-5">
        <Kpi label="Doze" value={String(q.inventory.pointsTotal)} />
        <Kpi label="Trasee" value={`${Math.round(q.inventory.routeM.total)} m`} />
        <Kpi label="Tablouri" value={`${q.inventory.panels} (${q.inventory.deviceModules} mod.)`} />
        <Kpi label="Manopera fara TVA" value={q.complete ? lei(q.netTotal) : `${lei(q.netTotal)} *`} />
        <Kpi
          label="Verificari"
          value={bad ? `${bad} neconforme` : open ? `${open} deschise` : "fara probleme"}
          tone={bad ? "bad" : open ? "warn" : "ok"}
        />
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" | "warn" }) {
  const color = tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-slate-900";
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function HeaderBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-sm font-medium ${
        danger ? "text-red-300 hover:bg-red-900/40" : "bg-slate-800 hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function Empty({ onNew, onDemo }: { onNew: () => void; onDemo: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Configurator instalatii — faza „la rosu”</h1>
      <p className="mt-3 text-slate-600">
        Introduci nivelurile, incaperile si dozele din planuri, configurezi tablourile (inclusiv in cascada) si obtii
        devizul de manopera si planul de executie din aceeasi configuratie.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={onNew}>Proiect nou</Button>
        <Button variant="secondary" onClick={onDemo}>
          Deschide un exemplu
        </Button>
      </div>
    </div>
  );
}
