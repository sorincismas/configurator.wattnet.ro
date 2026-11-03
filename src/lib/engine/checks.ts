import {
  deriveCircuits,
  deviceRatingText,
  feederDevice,
  installedPowerKw,
  mainPanel,
  outgoingProtective,
  panelMainDevice,
  type Circuit,
} from "./circuits";
import { getRules, powerKw, supplyPhases } from "./electrical";
import { computeInventory } from "./inventory";
import { findCascadeCycle, layoutPanel } from "./panel";
import type { CheckResult, PanelDevice, PricingSettings, Project } from "./types";

/**
 * Verificari de consistenta si de proiectare.
 *
 * IMPORTANT: acestea NU sunt verificari de conformitate cu normativul I7.
 * Limitele (prize pe circuit, Iz, ΔU, raport de selectivitate) sunt setari
 * ale electricianului, cu valori de start. Regulile normative se adauga doar
 * cu referinta exacta (articol/tabel), teste si validare de catre electricianul
 * autorizat. O lista fara neconformitati nu inseamna ca instalatia este conforma.
 */
export function runChecks(project: Project, settings: PricingSettings): CheckResult[] {
  const out: CheckResult[] = [];
  const rules = getRules(settings);
  const inv = computeInventory(project, settings.defaultRouteMPerPoint);
  const circuits = deriveCircuits(project, rules, settings.defaultRouteMPerPoint);
  const phases = supplyPhases(project.supply);

  /* ---------------- Date proiect / alimentare ---------------- */

  out.push(
    project.supply === "necunoscut"
      ? {
          id: "supply",
          ruleId: "DATE-001",
          category: "date",
          status: "nedeterminat",
          title: "Tipul alimentarii",
          message: "Tipul alimentarii (monofazat/trifazat) nu este cunoscut. Se stabileste inainte de echiparea tablourilor.",
        }
      : {
          id: "supply",
          ruleId: "DATE-001",
          category: "date",
          status: "conform",
          title: "Tipul alimentarii",
          message: `Alimentare declarata: ${project.supply}.`,
        },
  );

  if (inv.pointsTotal === 0) {
    out.push({
      id: "points",
      ruleId: "DATE-002",
      category: "date",
      status: "nedeterminat",
      title: "Inventar puncte",
      message: "Nu exista doze introduse. Adauga nivelurile, incaperile si dozele din planuri.",
    });
  }

  // Circuitele dedicate trebuie sa se termine intr-o doza numarata in incapere.
  const ENDPOINT_LABEL = { priza: "doze de priza", alteSurse: "iesiri de cablu (alte surse)", jonctiune: "doze de legatura" } as const;
  for (const lvl of project.levels) {
    for (const r of lvl.rooms) {
      for (const ep of ["priza", "alteSurse", "jonctiune"] as const) {
        const need = (r.dedicated ?? []).filter((d) => d.endpoint === ep).length;
        const have = r.points[ep] || 0;
        if (need > have) {
          out.push({
            id: `ded-end-${r.id}-${ep}`,
            ruleId: "DATE-003",
            category: "date",
            status: "nedeterminat",
            title: `${r.name} — capete circuite dedicate`,
            target: r.id,
            message: `${need} circuite dedicate se termina in ${ENDPOINT_LABEL[ep]}, dar incaperea are doar ${have}. Mareste numarul de doze sau schimba capatul circuitului.`,
          });
        }
      }
    }
  }

  if (inv.routeM.estimated > 0) {
    out.push({
      id: "routes",
      ruleId: "DEVIZ-001",
      category: "date",
      status: "nedeterminat",
      title: "Lungimi trasee",
      message: `${fmt(inv.routeM.estimated)} m din ${fmt(inv.routeM.total)} m de traseu sunt estimati, nu masurati. Devizul si caderile de tensiune folosesc estimarea.`,
    });
  }

  const maxKw =
    project.mainBreakerA && phases ? powerKw(phases, project.mainBreakerA, project.cosPhi ?? 1) : null;
  if (!project.mainBreakerA) {
    out.push({
      id: "main-breaker",
      ruleId: "ALIM-001",
      category: "date",
      status: "nedeterminat",
      title: "Siguranta generala",
      message: "Siguranta generala (A) nu este introdusa in tab-ul Proiect. Fara ea nu se calculeaza puterea maxima absorbita si selectivitatea fata de retea.",
    });
  } else {
    out.push({
      id: "main-breaker",
      ruleId: "ALIM-001",
      category: "date",
      status: maxKw == null ? "nedeterminat" : "conform",
      title: "Siguranta generala",
      message:
        maxKw == null
          ? `Siguranta generala ${project.mainBreakerA} A; puterea nu se poate calcula fara tipul alimentarii.`
          : `Siguranta generala ${project.mainBreakerA} A → putere maxima absorbita ${fmt(maxKw, 2)} kW.`,
    });
  }

  if (project.supply === "monofazat") {
    const tri = project.panels.flatMap((p) =>
      p.devices.filter((d) => d.poles >= 3).map((d) => `${p.name}: ${d.label || d.kind}`),
    );
    const triCircuits = circuits.filter((c) => c.poles >= 3);
    if (tri.length || triCircuits.length) {
      out.push({
        id: "tri-on-mono",
        ruleId: "ALIM-002",
        category: "date",
        status: "neconform",
        title: "Aparate trifazate pe alimentare monofazata",
        message: `Alimentarea este monofazata, dar exista aparate/circuite 3P/4P: ${[...tri, ...triCircuits.map((c) => c.code)].join(", ")}.`,
      });
    }
  }

  const pInst = installedPowerKw(circuits);
  if (maxKw && pInst > 0) {
    const ks = maxKw / pInst;
    out.push({
      id: "simultaneity",
      ruleId: "ALIM-003",
      category: "date",
      status: ks < rules.minSimultaneity ? "nedeterminat" : "conform",
      title: "Putere instalata / putere maxima absorbita",
      message: `Putere instalata estimata ${fmt(pInst, 2)} kW, putere maxima absorbita ${fmt(maxKw, 2)} kW → coeficient de simultaneitate necesar ${fmt(ks, 2)}${
        ks < rules.minSimultaneity
          ? ` (sub limita setata ${fmt(rules.minSimultaneity, 2)}). Verifica siguranta generala sau puterile estimate.`
          : "."
      }`,
    });
  }

  /* ---------------- Circuite ---------------- */

  for (const c of circuits) {
    const limit =
      c.kind === "prize" ? rules.maxSocketsPerCircuit : c.kind === "iluminat" ? rules.maxLightPointsPerCircuit : null;
    if (limit != null && c.points > limit) {
      out.push({
        id: `pts-${c.id}`,
        ruleId: "CIRC-001",
        category: "circuite",
        status: "neconform",
        title: `${c.code} — ${c.kind === "prize" ? "prize" : "puncte de iluminat"} pe circuit`,
        target: c.id,
        message: `${c.points} ${c.kind === "prize" ? "prize" : "puncte"} pe un circuit; limita setata este ${limit}.`,
      });
    }

    if (c.iz == null) {
      out.push({
        id: `iz-${c.id}`,
        ruleId: "CIRC-002",
        category: "circuite",
        status: "nedeterminat",
        title: `${c.code} — cablu / siguranta`,
        target: c.id,
        message: `Sectiunea ${c.sectionMm2} mm² nu exista in tabelul de curenti admisibili (Tarife & setari).`,
      });
    } else if (c.ratedA > c.iz) {
      out.push({
        id: `iz-${c.id}`,
        ruleId: "CIRC-002",
        category: "circuite",
        status: "neconform",
        title: `${c.code} — cablu / siguranta`,
        target: c.id,
        message: `In = ${c.ratedA} A > Iz = ${fmt(c.iz)} A pentru ${c.cable}. Regula Ib ≤ In ≤ Iz nu este respectata: mareste sectiunea sau micsoreaza siguranta.`,
      });
    }

    if (c.dropPct != null && c.dropPct > c.dropLimitPct) {
      out.push({
        id: `du-${c.id}`,
        ruleId: "CIRC-003",
        category: "circuite",
        status: "neconform",
        title: `${c.code} — cadere de tensiune`,
        target: c.id,
        message: `ΔU = ${fmt(c.dropPct, 2)} % la ${fmt(c.lengthM)} m${c.lengthEstimated ? " (lungime estimata)" : ""} si ${c.ratedA} A, peste limita de ${fmt(c.dropLimitPct)} %.`,
      });
    }
  }

  const linked = new Map<string, { device: PanelDevice; panelId: string }>();
  for (const p of project.panels) for (const d of p.devices) if (d.circuitId) linked.set(d.circuitId, { device: d, panelId: p.id });

  const unmounted = circuits.filter((c) => !linked.has(c.id));
  if (circuits.length) {
    out.push({
      id: "unmounted",
      ruleId: "CIRC-004",
      category: "circuite",
      status: unmounted.length ? "nedeterminat" : "conform",
      title: "Circuite montate in tablouri",
      message: unmounted.length
        ? `${unmounted.length} din ${circuits.length} circuite nu au aparat de protectie in tablou: ${list(unmounted.map((c) => c.code))}. Foloseste „Sigurante necesare” din tab-ul Tablouri.`
        : `Toate cele ${circuits.length} circuite au aparat de protectie.`,
    });
  }

  for (const c of circuits) {
    const l = linked.get(c.id);
    if (l && l.panelId !== c.panelId) {
      out.push({
        id: `wrong-panel-${c.id}`,
        ruleId: "CIRC-004",
        category: "circuite",
        status: "nedeterminat",
        title: `${c.code} — tablou`,
        target: c.id,
        message: `Aparatul circuitului este montat in alt tablou decat cel atribuit circuitului.`,
      });
    }
  }

  const noPanel = project.levels.filter((l) => l.rooms.length && !project.panels.some((p) => p.id === l.panelId));
  for (const l of noPanel) {
    out.push({
      id: `lvl-panel-${l.id}`,
      ruleId: "CIRC-005",
      category: "circuite",
      status: "nedeterminat",
      title: `Tablou pentru ${l.name}`,
      target: l.id,
      message: project.panels.length
        ? `Nivelul nu are tablou atribuit; circuitele lui sunt puse provizoriu in ${mainPanel(project.panels)?.name}.`
        : "Nivelul nu are tablou atribuit si nu exista niciun tablou.",
    });
  }

  const noRcd: Circuit[] = [];
  for (const c of circuits) {
    if (c.kind !== "prize" && c.kind !== "dedicat") continue;
    const l = linked.get(c.id);
    if (!l) continue;
    const panel = project.panels.find((p) => p.id === l.panelId);
    const rcdOk =
      l.device.kind === "RCBO" ||
      (!!l.device.upstreamRcdId && !!panel?.devices.some((d) => d.id === l.device.upstreamRcdId && d.kind === "RCD"));
    if (!rcdOk) noRcd.push(c);
  }
  if (noRcd.length) {
    out.push({
      id: "rcd-circuits",
      ruleId: "CIRC-006",
      category: "circuite",
      status: "nedeterminat",
      title: "Circuite de prize fara protectie diferentiala",
      message: `${noRcd.length} circuite de prize/dedicate nu sunt atribuite unui RCD si nu sunt pe RCBO: ${list(noRcd.map((c) => c.code))}. Seteaza „Sub RCD” in tab-ul Tablouri.`,
    });
  }

  /* ---------------- Tablouri ---------------- */

  if (project.panels.length === 0) {
    out.push({
      id: "panels",
      ruleId: "TAB-000",
      category: "tablouri",
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
      category: "tablouri",
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
        category: "tablouri",
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
        category: "tablouri",
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
        category: "tablouri",
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
        category: "tablouri",
        status: "nedeterminat",
        title: `Protectie diferentiala ${p.name}`,
        target: p.id,
        message: "Tabloul nu contine niciun aparat diferential (RCD/RCBO). Verifica cerintele de protectie diferentiala aplicabile circuitelor.",
      });
    }

    const unrated = p.devices.filter(
      (d) => ["MCB", "RCD", "RCBO"].includes(d.kind) && !(d.ratedA && d.ratedA > 0) && !d.rating?.trim(),
    );
    if (unrated.length) {
      out.push({
        id: `rating-${p.id}`,
        ruleId: "TAB-005",
        category: "tablouri",
        status: "nedeterminat",
        title: `Caracteristici aparate ${p.name}`,
        target: p.id,
        message: `${unrated.length} aparat(e) de protectie fara curent nominal (A): ${list(unrated.map((d) => d.label || d.kind))}.`,
      });
    }
  }

  /* ---------------- Selectivitate ---------------- */

  const ratio = rules.selectivityRatio;
  const note = "Selectivitate amperica orientativa; se confirma cu tabelele de selectivitate ale producatorului.";
  const largest = (devs: { ratedA?: number }[]) => Math.max(0, ...devs.map((d) => d.ratedA ?? 0));

  for (const p of project.panels) {
    if (!p.parentPanelId) continue;
    const parent = project.panels.find((x) => x.id === p.parentPanelId);
    if (!parent) continue;
    const feeder = feederDevice(p, project.panels);
    if (!feeder) {
      out.push({
        id: `sel-feeder-${p.id}`,
        ruleId: "SEL-004",
        category: "selectivitate",
        status: "nedeterminat",
        title: `Plecare spre ${p.name}`,
        target: p.id,
        message: `In ${parent.name} nu este marcat aparatul care alimenteaza ${p.name} (coloana „Alimenteaza” din tab-ul Tablouri).`,
      });
      continue;
    }
    const up = feeder.ratedA ?? 0;
    const down = largest(outgoingProtective(p));
    if (!up || !down) {
      out.push({
        id: `sel-${p.id}`,
        ruleId: "SEL-001",
        category: "selectivitate",
        status: "nedeterminat",
        title: `Selectivitate ${parent.name} → ${p.name}`,
        target: p.id,
        message: `Lipsesc curentii nominali (A) pentru plecarea din ${parent.name} sau pentru circuitele din ${p.name}.`,
      });
    } else {
      const ok = up >= ratio * down;
      out.push({
        id: `sel-${p.id}`,
        ruleId: "SEL-001",
        category: "selectivitate",
        status: ok ? "conform" : "neconform",
        title: `Selectivitate ${parent.name} → ${p.name}`,
        target: p.id,
        reference: note,
        message: `Plecare ${deviceRatingText(feeder)} (${up} A) fata de cel mai mare circuit din ${p.name} (${down} A): raport ${fmt(up / down, 2)}, minim setat ${fmt(ratio, 2)}.`,
      });
    }
  }

  const main = mainPanel(project.panels);
  if (main && project.mainBreakerA) {
    const mainDev = panelMainDevice(main);
    if (mainDev?.ratedA && mainDev.ratedA > project.mainBreakerA) {
      out.push({
        id: "sel-main-device",
        ruleId: "SEL-002",
        category: "selectivitate",
        status: "neconform",
        title: `Aparat general ${main.name}`,
        target: main.id,
        message: `Aparatul general al tabloului (${mainDev.ratedA} A) este mai mare decat siguranta generala a bransamentului (${project.mainBreakerA} A).`,
      });
    }
    const down = largest(outgoingProtective(main));
    if (down > 0) {
      const ok = project.mainBreakerA >= ratio * down;
      out.push({
        id: "sel-main",
        ruleId: "SEL-002",
        category: "selectivitate",
        status: ok ? "conform" : "neconform",
        title: `Selectivitate retea → ${main.name}`,
        target: main.id,
        reference: note,
        message: `Siguranta generala ${project.mainBreakerA} A fata de cea mai mare plecare din ${main.name} (${down} A): raport ${fmt(project.mainBreakerA / down, 2)}, minim setat ${fmt(ratio, 2)}.`,
      });
    }
  }

  for (const p of project.panels) {
    const mainDev = panelMainDevice(p);
    if (!mainDev?.ratedA) continue;
    const over = outgoingProtective(p).filter((d) => (d.ratedA ?? 0) >= mainDev.ratedA!);
    if (over.length) {
      out.push({
        id: `sel-in-${p.id}`,
        ruleId: "SEL-003",
        category: "selectivitate",
        status: "neconform",
        title: `Plecari ≥ aparatul general in ${p.name}`,
        target: p.id,
        message: `Aparatul general are ${mainDev.ratedA} A, dar plecarile ${list(over.map((d) => `${d.label || d.kind} (${d.ratedA} A)`))} au curent egal sau mai mare.`,
      });
    }
  }

  return out;
}

const fmt = (n: number, d = 1) => n.toLocaleString("ro-RO", { maximumFractionDigits: d });
const list = (xs: string[], max = 12) => (xs.length > max ? `${xs.slice(0, max).join(", ")} … (+${xs.length - max})` : xs.join(", "));
