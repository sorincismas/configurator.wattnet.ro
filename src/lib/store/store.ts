"use client";
/**
 * Starea aplicatiei: proiecte + biblioteca globala.
 * Persistenta automata in IndexedDB (browserul curent). Pentru siguranta si
 * transfer intre calculatoare se foloseste exportul JSON.
 */
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { del, get, set } from "idb-keyval";
import { createDefaultLibrary } from "../library/default-library";
import { applyTemplate, createEmptyProject, nowISO } from "../model/factory";
import { migrateLibrary, migrateProject, projectAsTemplate } from "../io/files";
import { syncCables } from "../engine/cables";
import { absorbMissing } from "../library/sync";
import type { Library, Project } from "../model/types";

const hasIDB = () => typeof indexedDB !== "undefined";
const idbStorage: StateStorage = {
  getItem: async (name) => (hasIDB() ? ((await get(name)) ?? null) : null),
  setItem: async (name, value) => {
    if (hasIDB()) await set(name, value);
  },
  removeItem: async (name) => {
    if (hasIDB()) await del(name);
  },
};

export interface AppState {
  hydrated: boolean;
  projects: Record<string, Project>;
  order: string[];
  activeId: string | null;
  library: Library;
  projectSeq: number;
  libraryLastExportedAt: string | null;
  libraryUpdatedAt: string;

  setHydrated: () => void;
  createProject: (templateId: string | null) => string;
  importProject: (p: Project, mode: "original" | "sablon") => string;
  duplicateProject: (id: string) => string;
  deleteProject: (id: string) => void;
  setActive: (id: string | null) => void;
  /** modificare imutabila prin "recipe" pe o copie; actualizeaza updatedAt */
  update: (id: string, recipe: (p: Project) => void, historyAction?: string) => void;
  markExported: (id: string) => void;

  setLibrary: (lib: Library) => void;
  updateLibrary: (recipe: (l: Library) => void) => void;
  markLibraryExported: () => void;
}

/** toate proiectele folosesc aceeasi biblioteca (o copie, ca motorul de calcul sa ramana pur) */
const withLibrary = (projects: Record<string, Project>, lib: Library) =>
  Object.fromEntries(Object.entries(projects).map(([id, p]) => [id, { ...p, library: structuredClone(lib), libraryAppliedAt: lib.meta.updatedAt }]));

export const useApp = create<AppState>()(
  persist(
    (setState, getState) => ({
      hydrated: false,
      projects: {},
      order: [],
      activeId: null,
      library: createDefaultLibrary(),
      projectSeq: 0,
      libraryLastExportedAt: null,
      libraryUpdatedAt: nowISO(),

      setHydrated: () => setState({ hydrated: true }),

      createProject: (templateId) => {
        const s = getState();
        const seq = s.projectSeq + 1;
        const p = createEmptyProject(s.library, seq);
        const tpl = templateId ? s.library.templates.find((t) => t.id === templateId) : undefined;
        if (tpl) applyTemplate(p, tpl);
        setState({ projects: { ...s.projects, [p.id]: p }, order: [p.id, ...s.order], activeId: p.id, projectSeq: seq });
        return p.id;
      },

      importProject: (src, mode) => {
        const s = getState();
        let p = migrateProject(src);
        // biblioteca unica: elementele din fisier care lipsesc din biblioteca se adauga, restul ramane neschimbat
        const lib = absorbMissing(s.library, p.library);
        p.library = structuredClone(lib);
        let seq = s.projectSeq;
        if (mode === "sablon" || s.projects[p.id]) {
          seq += 1;
          p = projectAsTemplate(p, seq);
          if (mode === "original") p.info.name = src.info.name + " (importat)";
        }
        p.history.push({ at: nowISO(), action: "import", detail: mode === "sablon" ? "Importat ca sablon" : "Importat din fisier" });
        p.lastExportedAt = mode === "original" ? nowISO() : null;
        setState({ library: lib, projects: withLibrary({ ...s.projects, [p.id]: p }, lib), order: [p.id, ...s.order.filter((x) => x !== p.id)], activeId: p.id, projectSeq: seq });
        return p.id;
      },

      duplicateProject: (id) => {
        const s = getState();
        const src = s.projects[id];
        if (!src) return id;
        const seq = s.projectSeq + 1;
        const p = projectAsTemplate(src, seq);
        setState({ projects: { ...s.projects, [p.id]: p }, order: [p.id, ...s.order], activeId: p.id, projectSeq: seq });
        return p.id;
      },

      deleteProject: (id) => {
        const s = getState();
        const rest = { ...s.projects };
        delete rest[id];
        setState({ projects: rest, order: s.order.filter((x) => x !== id), activeId: s.activeId === id ? null : s.activeId });
      },

      setActive: (id) => setState({ activeId: id }),

      update: (id, recipe, historyAction) => {
        const s = getState();
        const cur = s.projects[id];
        if (!cur) return;
        const next = structuredClone(cur);
        recipe(next);
        // cablurile (CB) se tin sincronizate cu traseele si circuitele
        syncCables(next);
        next.updatedAt = nowISO();
        if (historyAction) {
          next.history.push({ at: next.updatedAt, action: "modificare", detail: historyAction });
          if (next.history.length > 500) next.history = next.history.slice(-500);
        }
        setState({ projects: { ...s.projects, [id]: next } });
      },

      markExported: (id) => {
        const s = getState();
        const p = s.projects[id];
        if (!p) return;
        setState({ projects: { ...s.projects, [id]: { ...p, lastExportedAt: nowISO() } } });
      },

      setLibrary: (lib) => {
        const next = migrateLibrary(lib);
        const s = getState();
        setState({ library: next, libraryUpdatedAt: nowISO(), projects: withLibrary(s.projects, next) });
      },

      updateLibrary: (recipe) => {
        const s = getState();
        const next = structuredClone(s.library);
        recipe(next);
        next.meta.updatedAt = nowISO();
        // o singura biblioteca: orice modificare se vede imediat in toate proiectele
        setState({ library: next, libraryUpdatedAt: next.meta.updatedAt, projects: withLibrary(s.projects, next) });
      },

      markLibraryExported: () => setState({ libraryLastExportedAt: nowISO() }),

    }),
    {
      name: "configurator.wattnet.ro",
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        projects: s.projects,
        order: s.order,
        activeId: s.activeId,
        library: s.library,
        projectSeq: s.projectSeq,
        libraryLastExportedAt: s.libraryLastExportedAt,
        libraryUpdatedAt: s.libraryUpdatedAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          let lib = migrateLibrary(state.library);
          const migrated: Record<string, Project> = {};
          for (const k of Object.keys(state.projects)) {
            const p = migrateProject(state.projects[k]);
            // trecerea la biblioteca unica: ce exista doar in copia unui proiect se pastreaza
            lib = absorbMissing(lib, p.library);
            migrated[k] = p;
          }
          state.library = lib;
          state.projects = withLibrary(migrated, lib);
        }
        useApp.getState().setHydrated();
      },
    },
  ),
);

/** proiectul activ */
export function useActiveProject(): Project | null {
  return useApp((s) => (s.activeId ? s.projects[s.activeId] ?? null : null));
}

/** functie de actualizare legata de proiectul activ */
export function useUpdateActive() {
  const id = useApp((s) => s.activeId);
  const update = useApp((s) => s.update);
  return (recipe: (p: Project) => void, history?: string) => {
    if (id) update(id, recipe, history);
  };
}
