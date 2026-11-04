"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store/store";
import { downloadJSON, projectFileName, projectToFile } from "@/lib/io/files";
import { fmtDate, timeAgo } from "@/lib/format";
import { Badge, Button, Card, ConfirmButton, Empty, PageHeader, Select, Table } from "@/components/ui";
import { ImportPanel } from "@/components/io/ImportPanel";

const STATUS: Record<string, string> = { ciorna: "Ciorna", ofertat: "Ofertat", in_executie: "In executie", finalizat: "Finalizat", anulat: "Anulat" };

export default function ProjectsPage() {
  const { projects, order, activeId, library, createProject, setActive, deleteProject, duplicateProject, markExported } = useApp();
  const [tpl, setTpl] = useState<string>("tpl-ap3");
  const router = useRouter();
  const list = order.map((id) => projects[id]).filter(Boolean);

  const exportProject = (id: string) => {
    const p = projects[id];
    downloadJSON(projectToFile(p), projectFileName(p));
    markExported(id);
  };

  return (
    <div className="max-w-6xl">
      <PageHeader title="Proiecte" subtitle="Proiectele sunt salvate automat in acest browser. Exporta in fisier JSON ca sa continui pe alt calculator sau ca backup." />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card title="Proiect nou">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <Select value={tpl} onChange={setTpl} options={library.templates.map((t) => ({ value: t.id, label: t.name }))} />
            </div>
            <Button variant="primary" onClick={() => { createProject(tpl); router.push("/proiect"); }}>
              Creeaza proiect
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-3">Sablonul creeaza nivelurile si incaperile tipice; totul se poate modifica. Proiectul primeste o copie a bibliotecii curente ({library.meta.version}).</p>
        </Card>
        <Card title="Import">
          <ImportPanel />
          <p className="mt-2 text-xs text-ink-3">Accepta fisiere de proiect (.wattnet.json) si de biblioteca (.wattnet-lib.json).</p>
        </Card>
      </div>

      {list.length === 0 ? (
        <Empty title="Nu exista proiecte in acest browser">Creeaza un proiect nou sau importa un fisier JSON.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Cod</th>
              <th>Denumire</th>
              <th>Beneficiar</th>
              <th>Stare</th>
              <th>Modificat</th>
              <th>Fisier JSON</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const unsaved = !p.lastExportedAt || p.updatedAt > p.lastExportedAt;
              return (
                <tr key={p.id} className={p.id === activeId ? "bg-volt/10" : ""}>
                  <td className="font-mono text-xs font-semibold">{p.info.code}</td>
                  <td>
                    <button className="text-left font-medium hover:underline" onClick={() => { setActive(p.id); router.push("/proiect"); }}>
                      {p.info.name}
                    </button>
                    <div className="text-xs text-ink-3">{p.rooms.length} incaperi · {p.circuits.length} circuite</div>
                  </td>
                  <td className="text-sm">{p.info.client.name || <span className="text-ink-3">—</span>}</td>
                  <td><Badge>{STATUS[p.info.status] ?? p.info.status}</Badge></td>
                  <td className="text-xs text-ink-2" title={fmtDate(p.updatedAt)}>{timeAgo(p.updatedAt)}</td>
                  <td>{unsaved ? <Badge tone="warn">neexportat</Badge> : <Badge tone="ok">exportat {timeAgo(p.lastExportedAt)}</Badge>}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" onClick={() => { setActive(p.id); router.push("/proiect"); }}>Deschide</Button>
                      <Button size="sm" onClick={() => exportProject(p.id)}>Export JSON</Button>
                      <Button size="sm" variant="ghost" onClick={() => duplicateProject(p.id)} title="Copie ca proiect nou, fara date client">Duplica</Button>
                      <ConfirmButton onConfirm={() => deleteProject(p.id)} label="Sterge definitiv">Sterge</ConfirmButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
