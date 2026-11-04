"use client";
import { RequireProject } from "@/components/shell/AppShell";
import { Badge, Button, Card, Checkbox, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { downloadJSON, projectFileName, projectToFile } from "@/lib/io/files";
import { fmtDate } from "@/lib/format";
import { useActiveProject, useApp, useUpdateActive } from "@/lib/store/store";
import type { BuildingKind, ProjectStatus, WorkPhase } from "@/lib/model/types";

const KINDS: { value: BuildingKind; label: string }[] = [
  { value: "casa", label: "Casa individuala" },
  { value: "apartament", label: "Apartament" },
  { value: "bloc", label: "Cladire cu mai multe apartamente" },
  { value: "spatiu_comun", label: "Spatii comune" },
  { value: "anexa", label: "Anexa (garaj, foisor ...)" },
  { value: "altul", label: "Alta tipologie" },
];
const STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "ciorna", label: "Ciorna" },
  { value: "ofertat", label: "Ofertat" },
  { value: "in_executie", label: "In executie" },
  { value: "finalizat", label: "Finalizat" },
  { value: "anulat", label: "Anulat" },
];

function ProjectInfoPage() {
  const p = useActiveProject()!;
  const up = useUpdateActive();
  const { markExported, applyLibraryToProject, library } = useApp();
  const i = p.info;
  const setInfo = <K extends keyof typeof i>(k: K, v: (typeof i)[K]) => up((x) => void (x.info[k] = v));
  const setClient = (k: keyof typeof i.client, v: string) => up((x) => void (x.info.client[k] = v));
  const togglePhase = (ph: WorkPhase, on: boolean) =>
    up((x) => {
      x.info.phases = on ? [...new Set([...x.info.phases, ph])] : x.info.phases.filter((f) => f !== ph);
    });
  const libDiffers = p.library.meta.version !== library.meta.version || p.library.meta.updatedAt !== library.meta.updatedAt;

  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader
        title="Date proiect"
        subtitle={<>Cod <span className="font-mono font-semibold">{i.code}</span> · creat {fmtDate(p.createdAt)} · modificat {fmtDate(p.updatedAt)}</>}
        actions={
          <Button variant="primary" onClick={() => { downloadJSON(projectToFile(p), projectFileName(p)); markExported(p.id); }}>
            Export proiect JSON
          </Button>
        }
      />

      <Card title="Identificare">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Cod proiect"><TextInput value={i.code} onChange={(v) => setInfo("code", v)} /></Field>
          <Field label="Denumire" className="md:col-span-2"><TextInput value={i.name} onChange={(v) => setInfo("name", v)} /></Field>
          <Field label="Tip cladire"><Select value={i.kind} onChange={(v) => setInfo("kind", v)} options={KINDS} /></Field>
          {i.kind === "altul" && <Field label="Tipologie (text liber)"><TextInput value={i.customKind} onChange={(v) => setInfo("customKind", v)} /></Field>}
          <Field label="Localitate / adresa lucrare"><TextInput value={i.location} onChange={(v) => setInfo("location", v)} /></Field>
          <Field label="Stare"><Select value={i.status} onChange={(v) => setInfo("status", v)} options={STATUSES} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Faze</span>
            <Checkbox checked={i.phases.includes("rosu")} onChange={(v) => togglePhase("rosu", v)} label="Faza la rosu" />
            <Checkbox checked={i.phases.includes("gata")} onChange={(v) => togglePhase("gata", v)} label="Faza la gata" />
            {i.phases.includes("gata") && <Badge tone="info">operatiile la gata se adauga intr-o etapa ulterioara</Badge>}
          </div>
          <Checkbox checked={i.partial} onChange={(v) => setInfo("partial", v)} label="Proiect partial" />
        </div>
        {i.partial && (
          <Field label="Domeniul lucrarii partiale" className="mt-3" hint="Ex. doar executie tablou, doar cablare etaj 1 ...">
            <TextInput value={i.partialScope} onChange={(v) => setInfo("partialScope", v)} />
          </Field>
        )}
      </Card>

      <Card title="Beneficiar">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Nume / firma"><TextInput value={i.client.name} onChange={(v) => setClient("name", v)} /></Field>
          <Field label="Telefon"><TextInput value={i.client.phone} onChange={(v) => setClient("phone", v)} /></Field>
          <Field label="Email"><TextInput value={i.client.email} onChange={(v) => setClient("email", v)} /></Field>
          <Field label="Adresa beneficiar" className="md:col-span-3"><TextInput value={i.client.address} onChange={(v) => setClient("address", v)} /></Field>
          <Field label="Observatii beneficiar / designer" className="md:col-span-3"><TextArea value={i.client.notes} onChange={(v) => setClient("notes", v)} rows={2} /></Field>
        </div>
      </Card>

      <Card title="Ipoteze si limite ale ofertei" subtitle="Apar in oferta si in dosar (capitolele 2 si 14)">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Ipoteze"><TextArea value={i.assumptionsText} onChange={(v) => setInfo("assumptionsText", v)} rows={4} /></Field>
          <Field label="Excluderi / limite"><TextArea value={i.exclusionsText} onChange={(v) => setInfo("exclusionsText", v)} rows={4} /></Field>
          <Field label="Note interne (nu apar in oferta)" className="md:col-span-2"><TextArea value={i.designerNotes} onChange={(v) => setInfo("designerNotes", v)} rows={2} /></Field>
        </div>
      </Card>

      <Card
        title="Biblioteca proiectului"
        subtitle="Proiectul are propria copie a tarifelor, materialelor si regulilor. Modificarile din biblioteca globala se aplica doar prin actiune explicita."
        actions={
          <Button size="sm" disabled={!libDiffers} onClick={() => applyLibraryToProject(p.id)}>
            Aplica biblioteca globala in proiect
          </Button>
        }
      >
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <p>In proiect: <b>{p.library.meta.version}</b> <span className="text-ink-3">(aplicata {fmtDate(p.libraryAppliedAt)})</span></p>
          <p>Globala: <b>{library.meta.version}</b> <span className="text-ink-3">(modificata {fmtDate(library.meta.updatedAt)})</span> {libDiffers ? <Badge tone="warn">difera</Badge> : <Badge tone="ok">identica</Badge>}</p>
        </div>
      </Card>

      <Card title="Jurnal modificari" subtitle="Ultimele 20 de inregistrari">
        <ul className="space-y-1 text-xs">
          {[...p.history].reverse().slice(0, 20).map((h, k) => (
            <li key={k} className="flex gap-3">
              <span className="w-32 shrink-0 text-ink-3">{fmtDate(h.at)}</span>
              <span className="w-20 shrink-0 font-medium">{h.action}</span>
              <span className="text-ink-2">{h.detail}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <RequireProject>
      <ProjectInfoPage />
    </RequireProject>
  );
}
