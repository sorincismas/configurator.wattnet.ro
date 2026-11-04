"use client";
import { RequireProject } from "@/components/shell/AppShell";
import { useSummary } from "@/components/shell/SummaryBar";
import { StagePlaceholder } from "@/components/stage/StagePlaceholder";
import { Badge, Card, Checkbox, Table } from "@/components/ui";
import { fmtHours, fmtMoney, fmtNum } from "@/lib/format";
import { useActiveProject, useUpdateActive } from "@/lib/store/store";

function Preview() {
  const p = useActiveProject()!;
  const s = useSummary(p)!;
  const up = useUpdateActive();
  const cur = p.library.firm.currency;
  return (
    <Card
      title="Previzualizare manopera (calculata din modelul actual)"
      subtitle="Cantitatile cresc pe masura ce adaugi doze, trasee, circuite si tablouri. Valoarea si timpul se calculeaza in paralel."
      actions={<Checkbox checked={p.quote.includeMaterials} onChange={(v) => up((x) => void (x.quote.includeMaterials = v))} label="Include materiale" />}
    >
      {s.labor.lines.length === 0 ? (
        <p className="text-sm text-ink-3">Nu exista inca operatii cu cantitati. Adauga elemente electrice in etapa 2.</p>
      ) : (
        <Table>
          <thead>
            <tr><th>Cod</th><th>Operatie</th><th className="num">Cant.</th><th>UM</th><th className="num">Tarif</th><th className="num">Valoare</th><th className="num">Timp</th><th>Factori</th></tr>
          </thead>
          <tbody>
            {s.labor.lines.map((l) => (
              <tr key={l.operation.id}>
                <td className="font-mono text-xs">{l.operation.code}</td>
                <td>{l.operation.name} {l.operation.isExample && <Badge tone="warn">exemplu</Badge>}</td>
                <td className="num">{fmtNum(l.quantity)}</td>
                <td>{l.operation.unit}</td>
                <td className="num">{fmtMoney(l.rate, cur)}</td>
                <td className="num">{fmtMoney(l.value, cur)}</td>
                <td className="num">{fmtNum(l.timeMin, 0)} min</td>
                <td className="text-xs">{[...new Set(l.allocations.flatMap((a) => a.factors.map((f) => f.name)))].join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="mt-3 flex flex-wrap gap-6 text-sm">
        <span>Manopera: <b>{fmtMoney(s.labor.total, cur)}</b></span>
        {p.quote.includeMaterials && <span>Materiale: <b>{fmtMoney(s.materials.total, cur)}</b></span>}
        <span>Timp: <b>{s.labor.hours ? fmtHours(s.labor.hours) : "—"}</b></span>
        <span>Tarif orar implicit: <b>{s.labor.impliedHourlyRate === null ? "—" : fmtMoney(s.labor.impliedHourlyRate, cur + "/h")}</b></span>
        <span>Total: <b>{fmtMoney(s.totals.gross, cur)}</b> {!s.totals.vatPayer && <span className="text-ink-3">(neplatitor TVA)</span>}</span>
      </div>
    </Card>
  );
}

export default function Page() {
  return (
    <StagePlaceholder
      title="Deviz"
      stage={4}
      items={[
        "Deviz doar manopera si varianta manopera + materiale",
        "Subtotaluri pe nivel, incapere, categorie, faza si tablou",
        "Cantitati, tarife si timpi modificabili pe proiect (cu urma calculului initial)",
        "Factori de dificultate vizibili pe fiecare linie",
        "Costuri suplimentare (deplasare, organizare), discount",
        "Tarif orar implicit pe proiect, faza, categorie, operatie; comparatie intre proiecte",
        "TVA dupa setarea firmei (implicit neplatitor)",
      ]}
    >
      <RequireProject>
        <Preview />
      </RequireProject>
    </StagePlaceholder>
  );
}
