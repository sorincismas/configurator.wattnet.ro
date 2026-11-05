/**
 * Registrul de ipoteze si neconformitati (cap. 14.2): intrarile introduse de
 * electrician plus intrarile generate automat din starea datelor (valori
 * estimate, date lipsa, reguli nevalidate, verificari neconforme).
 * Intrarile automate nu se salveaza: se recalculeaza la fiecare afisare.
 */
import type { Project, RegisterEntry } from "../model/types";
import { allChecks } from "./checks";
import { routeLength } from "./measure";

export interface AutoEntry {
  category: RegisterEntry["category"];
  text: string;
  recommendation: string;
}

export function autoRegister(p: Project): AutoEntry[] {
  const out: AutoEntry[] = [];
  // date furnizate de beneficiar
  const fromClient = [
    p.supply.mainBreakerA.provenance === "beneficiar" && p.supply.mainBreakerA.value !== null && `protectia generala ${p.supply.mainBreakerA.value} A`,
    p.supply.approvedPowerKW.provenance === "beneficiar" && p.supply.approvedPowerKW.value !== null && `puterea aprobata ${p.supply.approvedPowerKW.value} kW`,
    ...p.circuits.filter((c) => c.declaredPowerW?.provenance === "beneficiar" && c.declaredPowerW.value !== null).map((c) => `puterea circuitului ${c.code} (${c.declaredPowerW!.value} W)`),
  ].filter(Boolean) as string[];
  if (fromClient.length) out.push({ category: "date_beneficiar", text: `Date furnizate de beneficiar: ${fromClient.join("; ")}.`, recommendation: "Se confirma la fata locului." });

  // valori estimate
  const estRooms = p.rooms.filter((r) => r.lengthM.provenance !== "masurat" && r.lengthM.value !== null).length;
  if (estRooms) out.push({ category: "estimat", text: `Dimensiunile a ${estRooms} incaperi sunt estimate.`, recommendation: "Masurare pe santier inainte de executie." });
  const segs = p.routes.flatMap((r) => r.segments);
  const estSeg = segs.filter((s) => s.lengthM.value !== null && s.lengthM.provenance !== "masurat").length;
  if (estSeg) out.push({ category: "estimat", text: `${estSeg} din ${segs.length} segmente de traseu au lungimi estimate.`, recommendation: "Lungimile se masoara si se actualizeaza; devizul se recalculeaza." });
  const estCirc = p.circuits.filter((c) => !p.cables.some((cb) => cb.circuitId === c.id) && c.estimatedLengthM.value !== null).length;
  if (estCirc) out.push({ category: "estimat", text: `${estCirc} circuite au doar lungime totala estimata (fara trasee modelate).`, recommendation: "Modelarea traseelor sau masurarea lungimilor." });
  const noPower = p.devices.filter((d) => d.category !== "curenti_slabi" && d.category !== "intrerupator" && d.powerW.value === null).length;
  if (noPower) out.push({ category: "de_confirmat", text: `${noPower} consumatori / puncte fara putere introdusa.`, recommendation: "Puterile se confirma din fisele echipamentelor sau de proiectant." });
  const noLen = p.routes.filter((r) => routeLength(r).value === null).length;
  if (noLen) out.push({ category: "de_confirmat", text: `${noLen} trasee fara lungime.`, recommendation: "Completarea lungimilor segmentelor." });
  if (p.supply.earthing === "necunoscut") out.push({ category: "de_confirmat", text: "Sistemul de legare la pamant nu este identificat.", recommendation: "Identificare si verificare la fata locului." });
  if (p.supply.earthResistanceOhm.value === null) out.push({ category: "de_confirmat", text: "Rezistenta prizei de pamant nu este masurata.", recommendation: "Masurare cu aparat de testare; rezultatul se inregistreaza in Verificari." });
  if (p.globalSimultaneity.value === null) out.push({ category: "de_confirmat", text: "Coeficientul de simultaneitate global nu este stabilit.", recommendation: "Ipoteza se stabileste de electrician / proiectant." });

  // reguli nevalidate
  const unval = p.library.rules.filter((r) => r.validation !== "validat");
  if (unval.length) out.push({ category: "de_confirmat", text: `${unval.length} reguli tehnice din biblioteca nu sunt validate (${unval.map((r) => r.code).join(", ")}).`, recommendation: "Validare de catre persoana autorizata, fata de reglementarile in vigoare." });

  // tarife exemplu
  if (p.library.operations.some((o) => o.active && o.isExample)) out.push({ category: "de_confirmat", text: "Devizul foloseste tarife marcate „exemplu”.", recommendation: "Actualizarea tarifelor si timpilor in biblioteca." });

  // verificari
  const checks = allChecks(p);
  for (const c of checks.filter((x) => x.result === "neconform")) out.push({ category: "neconformitate", text: `${c.targetCode} - ${c.title}: ${c.message}`, recommendation: `Corectare conform ${c.ruleCode} (${c.reference}).` });
  for (const c of checks.filter((x) => x.result === "avertizare")) out.push({ category: "avertizare", text: `${c.targetCode} - ${c.title}: ${c.message}`, recommendation: "Analiza si decizie a electricianului." });
  const di = checks.filter((x) => x.result === "date_insuficiente").length;
  if (di) out.push({ category: "de_confirmat", text: `${di} verificari tehnice au date insuficiente.`, recommendation: "Completarea datelor lipsa (vezi Verificari tehnice)." });
  return out;
}

export const REGISTER_CATEGORY_LABEL: Record<RegisterEntry["category"], string> = {
  date_beneficiar: "Date beneficiar",
  masurat: "Masurat",
  estimat: "Estimat",
  de_confirmat: "De confirmat",
  avertizare: "Avertizare",
  neconformitate: "Neconformitate",
};
