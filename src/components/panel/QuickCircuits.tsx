"use client";
/**
 * Circuite declarate rapid, fara modelarea dozelor si aparatelor.
 * Pentru lucrari partiale: inlocuire tablou, circuite existente, schema
 * monofilara pentru o instalatie deja executata.
 */
import { useState } from "react";
import { Button, Checkbox, NumberInput, Select, TextInput } from "../ui";
import { newCircuit, tracked } from "@/lib/model/factory";
import type { Panel, Project } from "@/lib/model/types";
import type { useUpdateActive } from "@/lib/store/store";

type Up = ReturnType<typeof useUpdateActive>;

export function QuickCircuits({ p, panel, up }: { p: Project; panel: Panel; up: Up }) {
  const lib = p.library;
  const [name, setName] = useState("");
  const [type, setType] = useState("ctp-prize");
  const [power, setPower] = useState<number | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [existing, setExisting] = useState(true);
  const [count, setCount] = useState<number | null>(1);

  const add = () => {
    const ct = lib.circuitTypes.find((t) => t.id === type);
    const n = Math.max(1, Math.min(40, count ?? 1));
    up((x) => {
      for (let k = 0; k < n; k++) {
        const c = newCircuit(x, (name || ct?.name || "Circuit") + (n > 1 ? ` ${k + 1}` : ""), ct?.usage ?? "prize", type, false);
        c.panelId = panel.id;
        c.declaredPowerW = tracked(power, "beneficiar");
        c.declaredPoints = points;
        c.existing = existing;
        x.circuits.push(c);
      }
    }, `${n} circuite declarate in ${panel.code}`);
    setName("");
    setPower(null);
    setPoints(null);
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-line bg-paper p-2 text-sm">
      <span className="w-full text-[11px] font-semibold uppercase tracking-wide text-ink-2">
        Adauga circuite rapid (fara doze si aparate) - pentru inlocuire tablou sau circuite existente
      </span>
      <label className="flex flex-col text-xs">
        Nr.
        <NumberInput className="w-14" value={count} min={1} onChange={setCount} />
      </label>
      <label className="flex flex-col text-xs">
        Denumire
        <TextInput className="w-52" value={name} placeholder="ex. Prize dormitor mare" onChange={setName} />
      </label>
      <label className="flex flex-col text-xs">
        Tip
        <Select className="w-44" value={type} onChange={setType} options={lib.circuitTypes.map((t) => ({ value: t.id, label: t.name }))} />
      </label>
      <label className="flex flex-col text-xs">
        Putere declarata
        <NumberInput className="w-28" value={power} suffix="W" onChange={setPower} />
      </label>
      <label className="flex flex-col text-xs">
        Nr. prize / puncte
        <NumberInput className="w-24" value={points} onChange={setPoints} />
      </label>
      <span className="pb-1.5"><Checkbox checked={existing} onChange={setExisting} label="circuit existent (doar reconectare)" /></span>
      <Button variant="primary" onClick={add}>+ Adauga</Button>
    </div>
  );
}
