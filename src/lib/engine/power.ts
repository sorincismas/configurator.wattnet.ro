/**
 * Puteri (cap. 7.2): disponibila, instalata, aplicata.
 * Cele trei NU se confunda. Lipsa datelor => null, nu 0.
 */
import type { Circuit, Device, Project } from "../model/types";
import { round } from "./measure";

export interface AvailablePower {
  /** putere aparenta din protectia generala (kVA) */
  fromBreakerKVA: number | null;
  /** putere activa estimata din protectie x cos phi (kW) */
  fromBreakerKW: number | null;
  /** putere aprobata (ATR) daca e introdusa */
  approvedKW: number | null;
  /** valoarea folosita in comparatii: aprobata, altfel din protectie */
  effectiveKW: number | null;
  basis: "aprobata" | "protectie" | "necunoscut";
}

export function availablePower(p: Project): AvailablePower {
  const s = p.supply;
  const I = s.mainBreakerA.value;
  let kva: number | null = null;
  if (I !== null && I > 0) {
    kva = s.system === "mono" ? (s.voltageV * I) / 1000 : (Math.sqrt(3) * s.voltageV * I) / 1000;
    kva = round(kva, 2);
  }
  const kw = kva !== null ? round(kva * s.cosPhi, 2) : null;
  const approved = s.approvedPowerKW.value;
  const effective = approved ?? kw;
  return {
    fromBreakerKVA: kva,
    fromBreakerKW: kw,
    approvedKW: approved,
    effectiveKW: effective,
    basis: approved !== null ? "aprobata" : kw !== null ? "protectie" : "necunoscut",
  };
}

/** dispozitive care consuma energie la 230/400 V */
export const isPowerDevice = (d: Device) => d.category !== "curenti_slabi" && d.category !== "intrerupator";

export interface PowerSum {
  /** W */
  value: number | null;
  /** consumatori fara putere introdusa */
  unknownCount: number;
  knownCount: number;
}

export function installedPowerOf(devices: Device[]): PowerSum {
  const relevant = devices.filter(isPowerDevice);
  let total = 0;
  let known = 0;
  let unknown = 0;
  for (const d of relevant) {
    if (d.powerW.value === null) unknown++;
    else {
      total += d.powerW.value;
      known++;
    }
  }
  return { value: known > 0 ? round(total, 0) : relevant.length === 0 ? 0 : null, unknownCount: unknown, knownCount: known };
}

export function installedPower(p: Project): PowerSum {
  return installedPowerOf(p.devices);
}

export function circuitInstalledPower(p: Project, c: Circuit): PowerSum {
  return installedPowerOf(p.devices.filter((d) => d.circuitId === c.id));
}

export interface AppliedPower {
  value: number | null; // W
  /** "Date insuficiente" daca lipseste simultaneitatea sau puterile */
  insufficient: boolean;
  reasons: string[];
}

/**
 * Puterea aplicata = Σ (P instalata circuit x ks circuit) x ks global.
 * Fara circuite: P instalata x ks global (daca este introdus).
 * Ipotezele de simultaneitate se introduc de electrician (cap. 20.1 - de clarificat).
 */
export function appliedPower(p: Project): AppliedPower {
  const reasons: string[] = [];
  const ksGlobal = p.globalSimultaneity.value;
  const inst = installedPower(p);
  if (inst.unknownCount > 0) reasons.push(`${inst.unknownCount} consumatori fara putere introdusa`);

  if (p.circuits.length === 0) {
    if (ksGlobal === null) {
      reasons.push("coeficientul de simultaneitate global nu este introdus");
      return { value: null, insufficient: true, reasons };
    }
    if (inst.value === null) return { value: null, insufficient: true, reasons };
    return { value: round(inst.value * ksGlobal, 0), insufficient: reasons.length > 0, reasons };
  }

  let total = 0;
  let any = false;
  // dispozitive neasociate circuitelor
  const unassigned = p.devices.filter((d) => isPowerDevice(d) && !d.circuitId);
  if (unassigned.length > 0) reasons.push(`${unassigned.length} consumatori neasociati unui circuit`);
  for (const c of p.circuits) {
    const pc = circuitInstalledPower(p, c);
    if (pc.value === null || pc.value === 0) continue;
    const ks = c.simultaneity.value;
    if (ks === null) {
      reasons.push(`${c.code}: simultaneitate neintrodusa`);
      continue;
    }
    total += pc.value * ks;
    any = true;
  }
  if (!any) return { value: null, insufficient: true, reasons };
  const value = round(total * (ksGlobal ?? 1), 0);
  return { value, insufficient: reasons.length > 0, reasons };
}

/** curentul de calcul pentru o putere data (A) */
export function designCurrent(powerW: number, system: "mono" | "tri", cosPhi: number, voltageV: number): number {
  if (system === "mono") return round(powerW / (voltageV * cosPhi), 2);
  return round(powerW / (Math.sqrt(3) * voltageV * cosPhi), 2);
}
