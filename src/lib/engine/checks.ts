import { computeInventory } from "./inventory";
import { findCascadeCycle, layoutPanel } from "./panel";
import type { CheckResult, PricingSettings, Project } from "./types";

/**
 * Verificări de consistență pentru faza 1.
 *
 * IMPORTANT: acestea NU sunt verificări de conformitate cu normativul I7.
 * Regulile normative se adaugă doar cu referință exactă (articol/tabel),
 * teste și validare de către electricianul autorizat. O listă fără
 * neconformități nu înseamnă că instalația este conformă.
 */
export function runChecks(project: Project, settings: PricingSettings): CheckResult[] {
  const out: CheckResult[] = [];
  const inv = computeInventory(project, settings.defaultRouteMPerPoint);

  // Alimentare
  out.push(
    project.supply === "necunoscut"
      ? {
          id: "supply",
          ruleId: "DATE-001",
          status: "nedeterminat",
          title: "Tipul alimentării",
          message: "Tipul alimentării (monofazat/trifazat) nu este cunoscut. Se stabilește înainte de echiparea tablourilor.",
        }
      : {
          id: "supply",
          ruleId: "DATE-001",
          status: "conform",
          title: "Tipul alimentării",
          message: `Alimentare declarată: ${project.supply}.`,
        },
  );

  // Inventar
  if (inv.pointsTotal === 0) {
    out.push({
      id: "points",
      ruleId: "DATE-002",
      status: "nedeterminat",
      title: "Inventar puncte",
      message: "Nu există doze introduse. Adaugă nivelurile, încăperile și dozele din planuri.",
    });
  }

  // Trasee estimate
  if (inv.routeM.estimated > 0) {
    out.push({
      id: "routes",
      ruleId: "DEVIZ-001",
      status: "nedeterminat",
      title: "Lungimi trasee",
      message: `${fmt(inv.routeM.estimated)} m din ${fmt(inv.routeM.total)} m de traseu sunt estimați, nu măsurați. Devizul folosește estimarea.`,
    });
  }

  // Tablouri
  if (project.panels.length === 0) {
    out.push({
      id: "panels",
      ruleId: "TAB-000",
      status: "nedeterminat",
      title: "Tablouri",
      message: "Nu este definit niciun tablou.",
    });
  }

  const cycle = findCascadeCycle(project.panels);
  if (cycle) {
    const names = cycle.map((id) => project.panels.find((p) => p.id === id)?.name ?? id);
    out.push({
      id: "cascade-cycle",
      ruleId: "TAB-001",
      status: "neconform",
      title: "Alimentare în cascadă",
      message: `Buclă de alimentare între tablourile: ${names.join(" → ")}. Un tablou nu poate fi alimentat (indirect) din el însuși.`,
    });
  }

  for (const p of project.panels) {
    const lay = layoutPanel(p);
    if (lay.capacity === 0) {
      out.push({
        id: `cap-${p.id}`,
        ruleId: "TAB-002",
        status: "nedeterminat",
        title: `Capacitate ${p.name}`,
        target: p.id,
        message: "Numărul de rânduri sau de module pe rând nu este definit.",
      });
    } else {
      const over = lay.rows.filter((r) => r.overflow);
      out.push({
        id: `cap-${p.id}`,
        ruleId: "TAB-002",
        status: lay.overflow ? "neconform" : "conform",
        title: `Capacitate ${p.name}`,
        target: p.id,
        message: lay.overflow
          ? [
              over.length ? `Rânduri depășite: ${over.map((r) => `șina ${r.row + 1} (${r.used}/${r.capacity} module)`).join(", ")}.` : "",
              lay.orphanDevices.length ? `${lay.orphanDevices.length} aparat(e) pe rânduri inexistente.` : "",
            ].filter(Boolean).join(" ")
          : `${lay.used}/${lay.capacity} module ocupate, ${lay.free} libere.`,
      });
    }

    if (p.parentPanelId && !(p.feederM && p.feederM.value > 0)) {
      out.push({
        id: `feeder-${p.id}`,
        ruleId: "TAB-003",
        status: "nedeterminat",
        title: `Alimentare ${p.name}`,
        target: p.id,
        message: "Lungimea cablului de alimentare din tabloul părinte nu este introdusă; nu intră în deviz.",
      });
    }

    if (p.devices.length > 0 && !p.devices.some((d) => d.kind === "RCD" || d.kind === "RCBO")) {
      out.push({
        id: `rcd-${p.id}`,
        ruleId: "TAB-004",
        status: "nedeterminat",
        title: `Protecție diferențială ${p.name}`,
        target: p.id,
        message: "Tabloul nu conține niciun aparat diferențial (RCD/RCBO). Verifică cerințele de protecție diferențială aplicabile circuitelor.",
      });
    }

    const unrated = p.devices.filter(
      (d) => ["MCB", "RCD", "RCBO"].includes(d.kind) && !d.rating?.trim(),
    );
    if (unrated.length) {
      out.push({
        id: `rating-${p.id}`,
        ruleId: "TAB-005",
        status: "nedeterminat",
        title: `Caracteristici aparate ${p.name}`,
        target: p.id,
        message: `${unrated.length} aparat(e) de protecție fără caracteristici nominale: ${unrated.map((d) => d.label || d.kind).join(", ")}.`,
      });
    }
  }

  return out;
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("ro-RO");
