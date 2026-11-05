"use client";
import type { Project } from "@/lib/model/types";
import { Badge } from "../ui";

export const CATEGORY_LABEL: Record<string, string> = {
  priza: "Priza",
  intrerupator: "Intrerupator",
  iluminat: "Iluminat",
  consumator_dedicat: "Consumator dedicat",
  curenti_slabi: "Curenti slabi",
  comanda: "Comanda / senzor",
  altul: "Altul",
};

export function levelOptions(p: Project) {
  return [...p.levels]
    .sort((a, b) => a.elevation - b.elevation || a.order - b.order)
    .map((l) => {
      const b = p.buildings.find((x) => x.id === l.buildingId);
      return { value: l.id, label: p.buildings.length > 1 && b ? `${b.name} / ${l.name}` : l.name };
    });
}

export function roomLabel(p: Project, roomId: string | null) {
  if (!roomId) return "—";
  const r = p.rooms.find((x) => x.id === roomId);
  if (!r) return "?";
  const l = p.levels.find((x) => x.id === r.levelId);
  return p.levels.length > 1 && l ? `${r.name} (${l.name})` : r.name;
}

export function circuitOptions(p: Project) {
  return [...p.circuits].sort((a, b) => a.order - b.order).map((c) => ({ value: c.id, label: `${c.code} ${c.name}` }));
}

export function CircuitTag({ p, id, locked }: { p: Project; id: string | null; locked?: boolean }) {
  if (!id) return <Badge tone="warn">neasociat</Badge>;
  const c = p.circuits.find((x) => x.id === id);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono text-[12px] font-semibold">{c?.code ?? "?"}</span>
      {locked && <Badge tone="info" title="Asociere manuala - generarea automata nu o modifica">manual</Badge>}
    </span>
  );
}
