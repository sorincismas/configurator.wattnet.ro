"use client";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { DataStatus, Provenance, Tracked } from "@/lib/model/types";
import { parseNum } from "@/lib/format";

/** true doar in browser, dupa hidratare (fara setState in efect) */
export function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ------------------------------ butoane ---------------------------- */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap",
        size === "sm" ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm",
        variant === "primary" && "bg-ink text-paper hover:bg-ink/85",
        variant === "secondary" && "border border-line bg-white text-ink hover:bg-paper-2",
        variant === "ghost" && "text-ink-2 hover:bg-paper-2",
        variant === "danger" && "border border-red-200 bg-white text-red-700 hover:bg-red-50",
        className,
      )}
    />
  );
}

/** buton de stergere cu confirmare in doi pasi (fara dialoguri de browser) */
export function ConfirmButton({ onConfirm, children, label = "Confirma", size = "sm" }: { onConfirm: () => void; children: ReactNode; label?: string; size?: "sm" | "md" }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <Button variant="danger" size={size} onClick={() => { setArmed(false); onConfirm(); }}>
      {label}?
    </Button>
  ) : (
    <Button variant="ghost" size={size} onClick={() => setArmed(true)}>
      {children}
    </Button>
  );
}

/* ------------------------------ campuri ---------------------------- */

/** latime implicita w-full doar daca nu s-a cerut alta latime */
const withWidth = (className?: string) => (className && /(^|\s)(w-|min-w-|flex-1)/.test(className) ? className : cx("w-full", className));

const inputCls =
  "h-8 rounded-md border border-line bg-white px-2 text-sm text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none focus:ring-2 focus:ring-volt/40";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-ink-3">{hint}</span>}
    </label>
  );
}

export function TextInput({ value, onChange, className, ...rest }: { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return <input {...rest} className={cx(inputCls, withWidth(className))} value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function TextArea({ value, onChange, rows = 3, className }: { value: string; onChange: (v: string) => void; rows?: number; className?: string }) {
  return <textarea rows={rows} className={cx(inputCls, "h-auto py-1.5", withWidth(className))} value={value} onChange={(e) => onChange(e.target.value)} />;
}

/**
 * Camp numeric care pastreaza textul in timpul editarii (permite "2," etc.)
 * si emite null pentru gol. Gol inseamna necunoscut, nu zero.
 */
export function NumberInput({
  value,
  onChange,
  className,
  placeholder,
  step,
  min,
  suffix,
  align = "right",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  className?: string;
  placeholder?: string;
  step?: number;
  min?: number;
  suffix?: string;
  align?: "left" | "right";
}) {
  const shown = value === null ? "" : String(value).replace(".", ",");
  const [text, setText] = useState(shown);
  const [focus, setFocus] = useState(false);
  return (
    <div className={cx("relative", withWidth(className))}>
      <input
        inputMode="decimal"
        className={cx(inputCls, "w-full min-w-14", align === "right" && "text-right tabular-nums")}
        style={suffix ? { paddingRight: 12 + suffix.length * 6.5 } : undefined}
        value={focus ? text : shown}
        placeholder={placeholder ?? "—"}
        step={step}
        onFocus={() => {
          setText(shown);
          setFocus(true);
        }}
        onBlur={() => {
          setFocus(false);
          let n = parseNum(text);
          if (n !== null && min !== undefined && n < min) n = min;
          onChange(n);
        }}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseNum(e.target.value);
          if (n !== null || e.target.value.trim() === "") onChange(n);
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-3">{suffix}</span>}
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
  placeholder,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  placeholder?: string;
}) {
  return (
    <select className={cx(inputCls, "pr-6", withWidth(className))} value={value ?? ""} onChange={(e) => onChange(e.target.value as T)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input type="checkbox" className="h-4 w-4 accent-ink" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/* ------------------------- valori urmarite ------------------------- */

const PROV_LABEL: Record<Provenance, string> = {
  beneficiar: "Cerinta beneficiar",
  proiectant: "Specificatie proiectant",
  masurat: "Masurat pe santier",
  estimat: "Estimare electrician",
  regula: "Regula tehnica",
  calcul: "Calcul automat",
};

export const STATUS_LABEL: Record<DataStatus, string> = {
  confirmat: "Confirmat",
  masurat: "Masurat",
  estimat: "Estimat",
  de_verificat: "De verificat",
  validat: "Validat tehnic",
  nevalidat: "Nevalidat",
};

/** clasa vizuala pentru estimat / masurat (cap. 2.3, 17) */
export function certaintyClass(t: Tracked<number> | null | undefined): string {
  if (!t || t.value === null) return "val-unknown";
  if (t.provenance === "masurat" || t.status === "masurat") return "val-measured";
  if (t.status === "confirmat" || t.status === "validat") return "val-confirmed";
  return "val-estimated";
}

/**
 * Camp numeric cu provenienta. Click pe marcaj comuta estimat <-> masurat.
 */
export function TrackedNumber({
  value,
  onChange,
  suffix,
  className,
  allowedProvenance = ["estimat", "masurat", "beneficiar", "proiectant"],
}: {
  value: Tracked<number>;
  onChange: (v: Tracked<number>) => void;
  suffix?: string;
  className?: string;
  allowedProvenance?: Provenance[];
}) {
  const prov = value.provenance ?? "estimat";
  const cls = certaintyClass(value);
  const next = () => {
    const i = allowedProvenance.indexOf(prov);
    const np = allowedProvenance[(i + 1) % allowedProvenance.length];
    onChange({ ...value, provenance: np, status: np === "masurat" ? "masurat" : np === "estimat" ? "estimat" : "confirmat" });
  };
  return (
    <div className={cx("flex items-stretch", className)}>
      <NumberInput
        className={cx("flex-1 tracked", cls)}
        value={value.value}
        suffix={suffix}
        onChange={(v) => onChange({ ...value, value: v, status: value.status ?? (prov === "masurat" ? "masurat" : "estimat") })}
      />
      <button
        type="button"
        onClick={next}
        title={`${PROV_LABEL[prov]} - click pentru a schimba`}
        className={cx("ml-1 w-6 shrink-0 rounded border text-[10px] font-bold", cls === "val-measured" ? "border-ok/40 bg-ok/10 text-ok" : cls === "val-confirmed" ? "border-ink/30 bg-paper-2 text-ink" : "border-warn/40 bg-warn/10 text-warn")}
      >
        {prov === "masurat" ? "M" : prov === "estimat" ? "E" : prov === "beneficiar" ? "B" : prov === "proiectant" ? "P" : "C"}
      </button>
    </div>
  );
}

/* ----------------------------- layout ------------------------------ */

export function Card({ title, actions, children, className, subtitle }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("min-w-0 rounded-lg border border-line bg-white shadow-[0_1px_2px_rgba(20,24,31,0.06)]", className)} style={{ borderTop: "3px solid var(--accent, #14181f)" }}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-3 py-2.5 md:px-4" style={{ background: "color-mix(in srgb, var(--accent-bg, #eceae4) 45%, white)" }}>
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="min-w-0 overflow-x-auto p-3 md:p-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 rounded-lg px-4 py-3" style={{ background: "var(--accent-bg, #eceae4)", borderLeft: "6px solid var(--accent, #14181f)" }}>
      <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--accent, #14181f)" }}>{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral", title }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "bad" | "info" | "volt"; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
        tone === "neutral" && "bg-paper-2 text-ink-2",
        tone === "ok" && "bg-ok/10 text-ok",
        tone === "warn" && "bg-warn/10 text-warn",
        tone === "bad" && "bg-red-50 text-red-700",
        tone === "info" && "bg-blue-50 text-blue-700",
        tone === "volt" && "bg-volt/25 text-ink",
      )}
    >
      {children}
    </span>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[12px] font-semibold text-ink">{children}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-paper px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-2">{children}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "-mb-px border-b-2 px-3 py-2 text-sm",
            value === t.id ? "font-semibold" : "border-transparent text-ink-2 hover:text-ink",
          )}
          style={value === t.id ? { borderColor: "var(--accent, #14181f)", color: "var(--accent, #14181f)" } : undefined}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-xs text-ink-3">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** tabel compact */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto rounded-lg border border-line bg-white", className)}>
      <table className="dense w-full border-collapse text-sm">{children}</table>
    </div>
  );
}
