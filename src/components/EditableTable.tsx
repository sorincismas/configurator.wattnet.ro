"use client";
import type { ReactNode } from "react";
import { Button, Checkbox, ConfirmButton, NumberInput, Select, Table, TextInput } from "./ui";

export type Col<T> = {
  key: keyof T & string;
  label: string;
  type: "text" | "number" | "select" | "checkbox" | "readonly" | "custom";
  options?: { value: string; label: string }[];
  width?: string;
  suffix?: string;
  render?: (row: T, set: (patch: Partial<T>) => void) => ReactNode;
  nullable?: boolean;
};

/** latimea minima a coloanei (textul liber fara latime primeste mai mult spatiu) */
const minW = <T,>(c: Col<T>) => c.width ?? (c.type === "text" ? "220px" : c.type === "number" ? "90px" : c.type === "select" ? "140px" : undefined);

/** tabel editabil generic pentru cataloagele bibliotecii */
export function EditableTable<T extends { id: string }>({
  rows,
  cols,
  onChange,
  onAdd,
  onDelete,
  addLabel = "+ Adauga",
  footer,
}: {
  rows: T[];
  cols: Col<T>[];
  onChange: (id: string, patch: Partial<T>) => void;
  onAdd?: () => void;
  onDelete?: (id: string) => void;
  addLabel?: string;
  footer?: ReactNode;
}) {
  return (
    <div>
      <Table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={c.type === "number" ? "num" : ""} style={{ minWidth: minW(c) }}>
                {c.label}
              </th>
            ))}
            {onDelete && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const set = (patch: Partial<T>) => onChange(r.id, patch);
            return (
              <tr key={r.id}>
                {cols.map((c) => {
                  const v = r[c.key] as unknown;
                  return (
                    <td key={c.key} style={{ minWidth: minW(c) }}>
                      {c.type === "text" && <TextInput value={(v as string) ?? ""} onChange={(x) => set({ [c.key]: x } as Partial<T>)} />}
                      {c.type === "number" && (
                        <NumberInput
                          value={(v as number | null) ?? null}
                          suffix={c.suffix}
                          onChange={(x) => set({ [c.key]: c.nullable ? x : (x ?? 0) } as Partial<T>)}
                        />
                      )}
                      {c.type === "select" && (
                        <Select value={(v as string) ?? ""} placeholder={c.nullable ? "—" : undefined} onChange={(x) => set({ [c.key]: x === "" && c.nullable ? null : x } as Partial<T>)} options={c.options ?? []} />
                      )}
                      {c.type === "checkbox" && <Checkbox checked={!!v} onChange={(x) => set({ [c.key]: x } as Partial<T>)} />}
                      {c.type === "readonly" && <span className="text-xs text-ink-2">{String(v ?? "—")}</span>}
                      {c.type === "custom" && c.render?.(r, set)}
                    </td>
                  );
                })}
                {onDelete && (
                  <td className="w-16 text-right">
                    <ConfirmButton onConfirm={() => onDelete(r.id)}>Sterge</ConfirmButton>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </Table>
      <div className="mt-2 flex items-center justify-between">
        {onAdd ? <Button size="sm" onClick={onAdd}>{addLabel}</Button> : <span />}
        {footer}
      </div>
    </div>
  );
}
