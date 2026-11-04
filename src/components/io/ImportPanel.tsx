"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseImport, type ImportResult } from "@/lib/io/files";
import { useApp } from "@/lib/store/store";
import { Button } from "../ui";

/** import fisier JSON: detecteaza automat proiect sau biblioteca */
export function ImportPanel() {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Extract<ImportResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const importProject = useApp((s) => s.importProject);
  const setLibrary = useApp((s) => s.setLibrary);
  const router = useRouter();

  const onFile = async (f: File | undefined) => {
    setError(null);
    setMsg(null);
    if (!f) return;
    const r = parseImport(await f.text());
    if (!r.ok) setError(r.error);
    else setPending(r);
    if (ref.current) ref.current.value = "";
  };

  return (
    <div>
      <input ref={ref} type="file" accept=".json,application/json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <Button onClick={() => ref.current?.click()}>Importa fisier JSON…</Button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {msg && <p className="mt-2 text-sm text-ok">{msg}</p>}
      {pending && (
        <div className="mt-3 rounded-md border border-line bg-paper p-3 text-sm">
          {pending.kind === "project" ? (
            <>
              <p>
                Proiect <b>{pending.project.info.code}</b> - {pending.project.info.name}
                {pending.project.info.client.name && <> ({pending.project.info.client.name})</>}
              </p>
              {pending.warnings.map((w) => (
                <p key={w} className="text-xs text-warn">{w}</p>
              ))}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="primary" size="sm" onClick={() => { importProject(pending.project, "original"); setPending(null); router.push("/proiect"); }}>
                  Deschide si continua proiectul
                </Button>
                <Button size="sm" onClick={() => { importProject(pending.project, "sablon"); setPending(null); router.push("/proiect"); }}>
                  Foloseste ca sablon (proiect nou)
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPending(null)}>Renunta</Button>
              </div>
              <p className="mt-2 text-xs text-ink-3">Sablon = cod nou, fara date client, versiuni emise si masuratori; pastreaza structura, tarifele si biblioteca.</p>
            </>
          ) : (
            <>
              <p>
                Biblioteca <b>{pending.library.meta.name}</b> - versiunea {pending.library.meta.version} ({pending.library.operations.length} operatii, {pending.library.materials.length} materiale)
              </p>
              <div className="mt-2 flex gap-2">
                <Button variant="primary" size="sm" onClick={() => { setLibrary(pending.library); setPending(null); setMsg("Biblioteca globala a fost inlocuita. Proiectele existente nu se modifica pana nu aplici biblioteca explicit."); }}>
                  Inlocuieste biblioteca globala
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPending(null)}>Renunta</Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
