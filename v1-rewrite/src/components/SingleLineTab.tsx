"use client";

import { useRef } from "react";
import { buildSingleLine, projectCircuits, type PricingSettings, type Project, type SlPanel } from "@/lib/engine";
import { SingleLineSvg } from "./SingleLineSvg";
import { Button, Card } from "./ui";

export function SingleLineTab({ project, pricing }: { project: Project; pricing: PricingSettings }) {
  const model = buildSingleLine(project, projectCircuits(project, pricing));
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 print:hidden">
        Schema se genereaza din aparatele din tab-ul Tablouri: aparatul general, SPD, diferentialele cu circuitele de sub
        ele („Sub RCD”) si plecarile spre tablourile secundare. Este un desen orientativ, cu simboluri simplificate; nu
        inlocuieste proiectul semnat de proiectantul autorizat.
      </div>
      {model.map((sl) => (
        <SingleLineCard key={sl.panel.id} sl={sl} code={project.code} />
      ))}
      {model.length === 0 && (
        <Card>
          <p className="text-sm text-slate-600">Nu exista tablouri.</p>
        </Card>
      )}
    </div>
  );
}

export function SingleLineCard({ sl, code }: { sl: SlPanel; code: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const exportSvg = () => {
    if (!ref.current) return;
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${ref.current.outerHTML}`], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${code || "proiect"}-schema-${sl.panel.name.replace(/\s+/g, "-")}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Card
      className="print-page"
      title={`Schema monofilara · ${sl.panel.name}`}
      actions={
        <Button variant="secondary" className="print:hidden" onClick={exportSvg}>
          Export SVG
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <SingleLineSvg ref={ref} sl={sl} />
      </div>
    </Card>
  );
}
