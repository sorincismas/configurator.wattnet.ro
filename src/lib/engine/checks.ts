/**
 * Verificari tehnice (cap. 14). Fiecare verificare are regula, referinta si
 * unul din rezultatele: conform, avertizare, neconform, date_insuficiente,
 * neverificat. Nu exista un rezultat global "conform I7": o verificare
 * reusita nu demonstreaza conformitatea intregului proiect.
 *
 * Regulile marcate "de_validat" pot fi calculate, dar rezultatul se afiseaza
 * ca "indeplinit - regula nevalidata", nu ca "conform".
 */
import type { CheckResult, Circuit, Panel, Project, TechnicalRule } from "../model/types";
import { circuitLoad } from "./circuits";
import { availablePower, appliedPower } from "./power";
import { ampacity, analyzeCircuit, feederDrop, panelLoad, upstreamDrop } from "./sizing";
import { layoutPanel, phaseLoads } from "./panels";
import { round } from "./measure";

export interface CheckItem {
  key: string;
  scope: "circuit" | "panel" | "project";
  targetId: string | null;
  targetCode: string;
  ruleId: string;
  ruleCode: string;
  reference: string;
  title: string;
  result: CheckResult;
  ruleValidated: boolean;
  message: string;
}

const DWELLING = new Set(["casa", "apartament", "bloc"]);

function rule(p: Project, id: string): TechnicalRule | undefined {
  return p.library.rules.find((r) => r.id === id);
}

function mk(p: Project, ruleId: string, scope: CheckItem["scope"], targetId: string | null, targetCode: string, title: string, result: CheckResult, message: string): CheckItem {
  const r = rule(p, ruleId);
  return {
    key: `${ruleId}|${targetId ?? "p"}|${title}`,
    scope,
    targetId,
    targetCode,
    ruleId,
    ruleCode: r?.code ?? "—",
    reference: r ? `${r.source.split(" (")[0]}, ${r.reference}` : "regula lipsa din biblioteca",
    title,
    // fara regula in biblioteca nu se poate concluziona
    result: r ? result : "neverificat",
    ruleValidated: r?.validation === "validat",
    message: r ? message : "Regula nu exista in biblioteca proiectului.",
  };
}

export function circuitChecks(p: Project, c: Circuit): CheckItem[] {
  const out: CheckItem[] = [];
  const a = analyzeCircuit(p, c);
  const load = circuitLoad(p, c);
  const code = c.code;
  const izTxt = a.iz.izCorrected !== null ? `I'z = ${a.iz.iz} x ${a.iz.k1} x ${a.iz.k2} = ${a.iz.izCorrected} A` : "";

  // R001 Ic <= I'z
  if (a.ic === null || a.iz.izCorrected === null) {
    const miss = [...(a.ic === null ? ["curent de calcul (putere / ks)"] : []), ...a.iz.missing];
    out.push(mk(p, "r-ib-iz", "circuit", c.id, code, "Ic ≤ I'z", "date_insuficiente", `Lipsesc: ${miss.join(", ")}.`));
  } else {
    const ok = a.ic <= a.iz.izCorrected;
    out.push(mk(p, "r-ib-iz", "circuit", c.id, code, "Ic ≤ I'z", ok ? "conform" : "neconform", `Ic = ${a.ic} A; ${izTxt} (metoda ${a.iz.method}, ${c.ambientTempC} °C, ${c.groupedCircuits} circ. grupate).`));
  }

  // R005 Ic <= In <= I'z
  if (a.ic === null || a.inA === null || a.iz.izCorrected === null) {
    out.push(mk(p, "r-coord-prot", "circuit", c.id, code, "Ic ≤ In ≤ I'z", "date_insuficiente", a.inA === null ? "Protectia circuitului nu este aleasa." : "Lipsesc Ic sau I'z."));
  } else {
    const ok1 = a.ic <= a.inA;
    const ok2 = a.inA <= a.iz.izCorrected;
    out.push(
      mk(p, "r-coord-prot", "circuit", c.id, code, "Ic ≤ In ≤ I'z", ok1 && ok2 ? "conform" : "neconform", `Ic = ${a.ic} A, In = ${a.inA} A, I'z = ${a.iz.izCorrected} A${!ok1 ? " - protectia este sub curentul de calcul" : ""}${!ok2 ? " - protectia depaseste curentul admisibil al cablului" : ""}.`),
    );
  }

  // R004 ΔU
  if (a.duTotalPct === null) {
    const miss = [a.lengthM === null && "lungime", !a.cable && "cablu", a.ic === null && "curent", a.duUpstreamPct === null && "alimentarea tabloului (lungime / cablu)"].filter(Boolean);
    out.push(mk(p, "r-du", "circuit", c.id, code, "Cadere de tensiune", "date_insuficiente", `Lipsesc: ${miss.join(", ")}.`));
  } else {
    const ok = a.duTotalPct <= a.duLimitPct;
    const near = !ok ? false : a.duTotalPct > a.duLimitPct * 0.9;
    out.push(
      mk(p, "r-du", "circuit", c.id, code, "Cadere de tensiune", ok ? (near ? "avertizare" : "conform") : "neconform", `ΔU = ${a.duCircuitPct}% circuit + ${a.duUpstreamPct}% amonte = ${a.duTotalPct}% (limita ${a.duLimitPct}%, L = ${a.lengthM} m, reactanta neglijata).`),
    );
  }

  // R003 sectiune minima
  if (!a.cable || a.minSection === null) out.push(mk(p, "r-sectiune-min", "circuit", c.id, code, "Sectiune minima", "date_insuficiente", !a.cable ? "Cablul nu este ales." : "Tip de circuit fara sectiune minima definita."));
  else out.push(mk(p, "r-sectiune-min", "circuit", c.id, code, "Sectiune minima", a.cable.crossSectionMm2 >= a.minSection ? "conform" : "neconform", `${a.cable.crossSectionMm2} mm² fata de minim ${a.minSection} mm² (${c.usage}).`));

  // R006 diferential in locuinte
  if (DWELLING.has(p.info.kind)) {
    const pd = p.library.protectionDevices.find((d) => d.id === c.protection.protectionDeviceId);
    const panel = p.panels.find((t) => t.id === c.panelId);
    const rcdItem = panel?.items.find((i) => i.id === c.protection.rcdItemId);
    const rcdDev = rcdItem ? p.library.protectionDevices.find((d) => d.id === rcdItem.protectionDeviceId) : undefined;
    const maxMA = rule(p, "r-rcd-prize")?.params.maxSensitivityMA ?? 30;
    if (pd?.kind === "RCBO") out.push(mk(p, "r-rcd-prize", "circuit", c.id, code, "Protectie diferentiala", (pd.sensitivityMA ?? 999) <= maxMA ? "conform" : "avertizare", `RCBO ${pd.sensitivityMA} mA.`));
    else if (!panel || panel.items.length === 0) out.push(mk(p, "r-rcd-prize", "circuit", c.id, code, "Protectie diferentiala", "date_insuficiente", "Tabloul nu este echipat."));
    else if (!rcdDev) out.push(mk(p, "r-rcd-prize", "circuit", c.id, code, "Protectie diferentiala", "neconform", "Circuitul nu este protejat de un dispozitiv diferential."));
    else out.push(mk(p, "r-rcd-prize", "circuit", c.id, code, "Protectie diferentiala", (rcdDev.sensitivityMA ?? 999) <= maxMA ? "conform" : c.usage === "prize" ? "neconform" : "avertizare", `${rcdItem!.code} ${rcdDev.name}.`));
  }

  // R014 iluminat distinct de prize
  if (c.usage === "iluminat" && load.sockets > 0) out.push(mk(p, "r-iluminat-distinct", "circuit", c.id, code, "Iluminat distinct de prize", "neconform", `${load.sockets} prize pe circuit de iluminat.`));
  if (c.usage === "prize" && load.lights > 0) out.push(mk(p, "r-iluminat-distinct", "circuit", c.id, code, "Iluminat distinct de prize", "neconform", `${load.lights} puncte de iluminat pe circuit de prize.`));

  // R015 putere iluminat
  if (c.usage === "iluminat" && load.installed.value !== null) {
    const lim = (load.system === "tri" ? rule(p, "r-iluminat-putere")?.params.triKW : rule(p, "r-iluminat-putere")?.params.monoKW) ?? 3;
    const kw = load.installed.value / 1000;
    out.push(mk(p, "r-iluminat-putere", "circuit", c.id, code, "Putere pe circuit de iluminat", kw <= lim ? "conform" : "avertizare", `${round(kw, 2)} kW instalati (recomandat max ${lim} kW).`));
  }

  // R016 receptor > 2 kW pe circuit de prize comun
  if (c.usage === "prize" && DWELLING.has(p.info.kind)) {
    const lim = (rule(p, "r-receptor-2kw")?.params.maxKW ?? 2) * 1000;
    const big = load.devices.filter((d) => (d.powerW.value ?? 0) > lim);
    if (big.length > 0 && load.devices.length > 1) out.push(mk(p, "r-receptor-2kw", "circuit", c.id, code, "Receptor > 2 kW pe circuit separat", "neconform", `${big.map((d) => `${d.code} ${d.powerW.value} W`).join(", ")} pe circuit comun cu alte prize.`));
  }
  return out;
}

export function panelChecks(p: Project, t: Panel): CheckItem[] {
  const out: CheckItem[] = [];
  const lay = layoutPanel(p, t);
  if (!t.enclosureTypeId) out.push(mk(p, "r-rezerva-tablou", "panel", t.id, t.code, "Cutie tablou", "date_insuficiente", "Cutia tabloului nu este aleasa."));
  else if (lay.overflow.length > 0) out.push(mk(p, "r-rezerva-tablou", "panel", t.id, t.code, "Capacitate tablou", "neconform", `${lay.overflow.length} aparate nu incap (${lay.usedModules} module din ${lay.capacity}).`));
  else {
    const min = rule(p, "r-rezerva-tablou")?.params.minReservePct ?? 20;
    out.push(mk(p, "r-rezerva-tablou", "panel", t.id, t.code, "Rezerva module", (lay.reservePct ?? 0) >= min ? "conform" : "avertizare", `${lay.reserveModules} module libere (${lay.reservePct}%, dorit ≥ ${min}%).`));
  }
  if (t.parentPanelId) {
    const ct = p.library.cableTypes.find((c) => c.id === t.feeder.cableTypeId);
    const method = p.library.installMethods.find((m) => m.id === t.feeder.installMethodId)?.ref ?? null;
    const iz = ampacity(p.library, ct, method, 30, 1);
    const load = panelLoad(p, t.id);
    const In = t.feeder.ratingA;
    if (iz.izCorrected === null || In === null) out.push(mk(p, "r-coord-prot", "panel", t.id, t.code, "Alimentare: Ic ≤ In ≤ I'z", "date_insuficiente", [In === null && "protectia alimentarii", ...iz.missing].filter(Boolean).join(", ") + " lipsa."));
    else out.push(mk(p, "r-coord-prot", "panel", t.id, t.code, "Alimentare: Ic ≤ In ≤ I'z", (load.currentA ?? 0) <= In && In <= iz.izCorrected ? "conform" : "neconform", `Ic = ${load.currentA} A, In = ${In} A, I'z = ${iz.izCorrected} A (${ct?.name}, ${method}).`));
    const d = feederDrop(p, t);
    const up = upstreamDrop(p, t.id);
    out.push(d === null ? mk(p, "r-du", "panel", t.id, t.code, "Alimentare: cadere de tensiune", "date_insuficiente", "Lungimea sau cablul alimentarii lipsesc.") : mk(p, "r-du", "panel", t.id, t.code, "Alimentare: cadere de tensiune", "conform", `ΔU alimentare ${d}%, cumulat pana la bara ${up}% (se adauga la fiecare circuit).`));
    const sec = rule(p, "r-sectiune-min")?.params.feederMono ?? 4;
    if (ct && p.supply.system === "mono") out.push(mk(p, "r-sectiune-min", "panel", t.id, t.code, "Alimentare: sectiune minima", ct.crossSectionMm2 >= sec ? "conform" : "neconform", `${ct.crossSectionMm2} mm² fata de ${sec} mm² (coloana monofazata).`));
  }
  return out;
}

export function projectChecks(p: Project): CheckItem[] {
  const out: CheckItem[] = [];
  const av = availablePower(p);
  const ap = appliedPower(p);
  if (av.effectiveKW === null || ap.value === null)
    out.push(mk(p, "r-putere-disponibila", "project", null, p.info.code, "Putere aplicata ≤ putere disponibila", "date_insuficiente", av.effectiveKW === null ? "Puterea disponibila nu este cunoscuta." : "Puterea aplicata nu poate fi calculata: " + ap.reasons.join("; ")));
  else {
    const ok = ap.value / 1000 <= av.effectiveKW;
    out.push(mk(p, "r-putere-disponibila", "project", null, p.info.code, "Putere aplicata ≤ putere disponibila", ok ? (ap.insufficient ? "avertizare" : "conform") : "neconform", `${round(ap.value / 1000, 2)} kW aplicati / ${av.effectiveKW} kW disponibili${ap.insufficient ? " (date incomplete)" : ""}.`));
  }
  if (p.supply.system === "tri") {
    const ph = phaseLoads(p);
    const max = rule(p, "r-echilibrare")?.params.maxImbalancePct ?? 20;
    out.push(mk(p, "r-echilibrare", "project", null, p.info.code, "Echilibrarea fazelor", ph.imbalancePct <= max ? "conform" : "avertizare", `L1 ${round(ph.L1 / 1000, 2)} / L2 ${round(ph.L2 / 1000, 2)} / L3 ${round(ph.L3 / 1000, 2)} kW, dezechilibru ${ph.imbalancePct}% (max ${max}%).`));
  }
  const noPanel = p.circuits.filter((c) => !c.panelId && c.usage !== "curenti_slabi");
  if (noPanel.length) out.push(mk(p, "r-circuit-tablou", "project", null, p.info.code, "Circuite fara tablou", "neconform", noPanel.map((c) => c.code).join(", ") + " nu sunt asociate unui tablou."));
  return out;
}

export function allChecks(p: Project): CheckItem[] {
  return [
    ...projectChecks(p),
    ...p.panels.flatMap((t) => panelChecks(p, t)),
    ...[...p.circuits].filter((c) => c.usage !== "curenti_slabi").sort((a, b) => a.order - b.order).flatMap((c) => circuitChecks(p, c)),
  ];
}

export function checkStats(list: CheckItem[]) {
  const s = { conform: 0, conformNevalidat: 0, avertizare: 0, neconform: 0, date_insuficiente: 0, neverificat: 0 };
  for (const c of list) {
    if (c.result === "conform") {
      if (c.ruleValidated) s.conform++;
      else s.conformNevalidat++;
    } else s[c.result]++;
  }
  return s;
}
