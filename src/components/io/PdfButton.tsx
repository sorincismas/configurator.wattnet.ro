"use client";
import { useState, type ReactNode } from "react";
import { Button } from "../ui";

/** buton de export direct in PDF: arata progresul si eventuala eroare */
export function PdfButton({ run, children, size, className, disabled }: { run: () => Promise<void>; children: ReactNode; size?: "sm" | "md"; className?: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <>
      <Button
        variant="primary"
        size={size}
        className={className}
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            await run();
          } catch (e) {
            setErr(e instanceof Error ? e.message : "exportul PDF nu a reusit");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Se genereaza PDF..." : children}
      </Button>
      {err && <span className="text-xs text-red-700">{err}</span>}
    </>
  );
}
