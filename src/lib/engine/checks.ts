import { computeInventory } from "./inventory";
import { findCascadeCycle, layoutPanel } from "./panel";
import type { CheckResult, PricingSettings, Project } from "./types";

/**
 * Verificari de consistenta pentru faza 1.
 *
 * IMPORTANT: acestea NU sunt verificari de conformitate cu normativul I7.
 * Regulile normative se adauga doar cu referinta exacta (articol/tabel),
 * teste si validare de catre electricianul autorizat. O lista fara
 * neconformitati nu inseamna ca instalatia este conforma.
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
          title: "Tipul alimentarii",
          message: "Tipul alimentarii (monofazat/trifazat) nu este cunoscut. Se stabileste inainte de echiparea tablourilor.",
        }
      : {
          id: "supply",
          ruleId: "DATE-001",
          status: "conform",
          title: "Tipul alimentarii",
          message: `Alimentare declarata: ${project.supply}.`,
        },
  );

  // Inventar
  if (inv.pointsTotal === 0) {
    out.push({
      id: "points",
      ruleId: "DATE-002",
      status: "nedeterminat",
      title: "Inventar puncte",
      message: "Nu exista doze introduse. Adauga nivelurile, incaperile si dozele din planuri.",
    });
  }

  // Trasee estimate
  if (inv.routeM.estimated > 0) {
    out.push({
      id: "routes",
      ruleId: "DEVIZ-001",
      status: "nedeterminat",
      title: "Lungimi trasee",
      message: `${fmt(inv.routeM.estimated)} m din ${fmt(inv.routeM.total)} m de traseu sunt estimati, nu masurati. Devizul foloseste estimarea.`,
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
      title: "Alimentare in cascada",
      message: `Bucla de alimentare intre tablourile: ${names.join(" → ")}. Un tablou nu poate fi alimentat (indirect) din el insusi.`,
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
        message: "Numarul de randuri sau de module pe rand nu este definit.",
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
              over.length ? `Randuri depasite: ${over.map((r) => `sina ${r.row + 1} (${r.used}/${r.capacity} module)`).join(", ")}.` : "",
              lay.orphanDevices.length ? `${lay.orphanDevices.length} aparat(e) pe randuri inexistente.` : "",
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
        message: "Lungimea cablului de alimentare din tabloul parinte nu este introdusa; nu intra in deviz.",
      });
    }

    if (p.devices.length > 0 && !p.devices.some((d) => d.kind === "RCD" || d.kind === "RCBO")) {
      out.push({
        id: `rcd-${p.id}`,
        ruleId: "TAB-004",
        status: "nedeterminat",
        title: `Protectie diferentiala ${p.name}`,
        target: p.id,
        message: "Tabloul nu contine niciun aparat diferential (RCD/RCBO). Verifica cerintele de protectie diferentiala aplicabile circuitelor.",
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
        message: `${unrated.length} aparat(e) de protectie fara caracteristici nominale: ${unrated.map((d) => d.label || d.kind).join(", ")}.`,
      });
    }
  }

  return out;
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("ro-RO");
