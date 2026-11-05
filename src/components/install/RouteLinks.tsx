"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, ConfirmButton, Select, TrackedNumber } from "../ui";
import { addBoxCircuitsToRoute, linkBoxToRoute, missingCircuitsOnRoute, routesForBox, unlinkBoxFromRoute } from "@/lib/engine/links";
import { routeLength } from "@/lib/engine/measure";
import { fmtNum } from "@/lib/format";
import { newRoute } from "@/lib/model/factory";
import type { Box, Project } from "@/lib/model/types";
import type { useUpdateActive } from "@/lib/store/store";

type Up = ReturnType<typeof useUpdateActive>;

/**
 * Traseele unei doze, in pagina Doze si aparate.
 * Legatura este derivata din segmentele traseelor, deci orice modificare
 * facuta in pagina Trasee apare aici si invers.
 */
export function RouteLinks({ p, b, up }: { p: Project; b: Box; up: Up }) {
  const [pick, setPick] = useState("");
  const linked = routesForBox(p, b.id);
  const available = p.routes.filter((r) => !linked.some((l) => l.id === r.id));
  const circuitCode = (id: string) => p.circuits.find((c) => c.id === id)?.code ?? "?";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {linked.map((r) => {
        const seg = r.segments.find((s) => s.to.kind === "box" && s.to.refId === b.id);
        const missing = missingCircuitsOnRoute(p, b.id, r);
        const len = routeLength(r).value;
        return (
          <span key={r.id} className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-1.5 py-0.5 text-xs">
            <Link href={`/trasee/#${r.code}`} className="font-mono font-semibold hover:underline" title={`Deschide ${r.code} ${r.name} · traseu ${len === null ? "—" : fmtNum(len, 1) + " m"}`}>
              {r.code}
            </Link>
            {seg && (
              <TrackedNumber
                className="w-24"
                value={seg.lengthM}
                suffix="m"
                allowedProvenance={["estimat", "masurat"]}
                onChange={(v) => up((x) => { const sg = x.routes.find((z) => z.id === r.id)?.segments.find((k) => k.id === seg.id); if (sg) sg.lengthM = v; })}
              />
            )}
            {missing.length > 0 && (
              <button
                className="rounded bg-warn/10 px-1 text-warn hover:bg-warn/20"
                title="Circuitele aparatelor din doza nu trec prin tuburile traseului - click pentru a le adauga"
                onClick={() => up((x) => { const rr = x.routes.find((z) => z.id === r.id); if (rr) addBoxCircuitsToRoute(x, b.id, rr); }, `${b.code}: circuite adaugate in tubul ${r.code}`)}
              >
                + {missing.map(circuitCode).join(", ")} in tub
              </button>
            )}
            <ConfirmButton label="Scoate" onConfirm={() => up((x) => unlinkBoxFromRoute(x, b.id, r.id), `${b.code} scoasa de pe ${r.code}`)}>×</ConfirmButton>
          </span>
        );
      })}
      {linked.length === 0 && <Badge tone="warn">fara traseu</Badge>}
      <Select
        className="w-44"
        value={pick}
        placeholder="+ pe traseu…"
        onChange={(v) => {
          setPick("");
          if (!v) return;
          if (v === "__new") {
            up((x) => {
              const room = x.rooms.find((rr) => rr.id === b.roomId);
              const tr = newRoute(x, `Traseu ${room?.name ?? b.code}`, [b.roomId]);
              x.routes.push(tr);
              linkBoxToRoute(x, b.id, tr.id);
            }, `Traseu nou pentru ${b.code}`);
          } else up((x) => linkBoxToRoute(x, b.id, v), `${b.code} legata de traseu`);
        }}
        options={[...available.map((r) => ({ value: r.id, label: `${r.code} ${r.name}` })), { value: "__new", label: "Traseu nou (tablou → doza)" }]}
      />
    </div>
  );
}
