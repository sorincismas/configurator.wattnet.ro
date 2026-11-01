"use client";

import { useCallback, useEffect, useState } from "react";
import { defaultPricing, type PricingSettings, type Project } from "@/lib/engine";

/**
 * Persistenta locala (browser) pentru faza 1. Datele stau doar pe dispozitivul
 * curent; exportul JSON e copia de siguranta pana la baza de date (Supabase).
 */
const KEY_PROJECTS = "wattnet.projects.v1";
const KEY_PRICING = "wattnet.pricing.v1";
const KEY_CURRENT = "wattnet.current.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stocare indisponibila sau plina — datele raman in memorie */
  }
}

/** Completeaza operatiunile noi din catalogul implicit, pastrand tarifele salvate. */
function mergePricing(saved: PricingSettings | null): PricingSettings {
  const def = defaultPricing();
  if (!saved) return def;
  const known = new Set(saved.operations.map((o) => o.id));
  return {
    ...def,
    ...saved,
    operations: [...saved.operations, ...def.operations.filter((o) => !known.has(o.id))],
  };
}

export function useWorkspace() {
  const [loaded, setLoaded] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pricing, setPricing] = useState<PricingSettings>(defaultPricing);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    // citirea din localStorage se face doar in browser, dupa hidratare
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjects(read<Project[]>(KEY_PROJECTS, []));
    setPricing(mergePricing(read<PricingSettings | null>(KEY_PRICING, null)));
    setCurrentId(read<string | null>(KEY_CURRENT, null));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) write(KEY_PROJECTS, projects);
  }, [loaded, projects]);
  useEffect(() => {
    if (loaded) write(KEY_PRICING, pricing);
  }, [loaded, pricing]);
  useEffect(() => {
    if (loaded) write(KEY_CURRENT, currentId);
  }, [loaded, currentId]);

  const updateProject = useCallback((id: string, fn: (p: Project) => Project) => {
    setProjects((list) =>
      list.map((p) => (p.id === id ? { ...fn(p), updatedAt: new Date().toISOString() } : p)),
    );
  }, []);

  return {
    loaded,
    projects,
    setProjects,
    pricing,
    setPricing,
    currentId,
    setCurrentId,
    updateProject,
  };
}
