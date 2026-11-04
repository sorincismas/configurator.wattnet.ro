import type { IzRow, PricingSettings, RuleSettings, SupplyType } from "./types";

/**
 * Formule electrice de baza — o singura sursa pentru Circuite, Verificari,
 * Schema monofilara si Cheat sheet.
 *
 * Valorile implicite (Iz, ρ, limite ΔU) sunt valori de reper setabile de
 * electrician. Verifica valorile exacte in editia de I7 dupa care faci proiectul.
 */

export const U_MONO = 230;
export const U_TRI = 400;

export type Phases = 1 | 3;

export const STANDARD_BREAKERS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
export const STANDARD_SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25];

export function supplyPhases(s: SupplyType): Phases | null {
  return s === "monofazat" ? 1 : s === "trifazat" ? 3 : null;
}

export function phasesFromPoles(poles: number): Phases {
  return poles >= 3 ? 3 : 1;
}

/** Puterea (kW) la curentul I: mono 230·I·cosφ, tri √3·400·I·cosφ. */
export function powerKw(phases: Phases, currentA: number, cosPhi = 1): number {
  const u = phases === 3 ? Math.sqrt(3) * U_TRI : U_MONO;
  return (u * currentA * cosPhi) / 1000;
}

/** Curentul (A) absorbit la puterea P (kW). */
export function currentForPower(phases: Phases, kw: number, cosPhi = 1): number {
  const u = phases === 3 ? Math.sqrt(3) * U_TRI : U_MONO;
  return cosPhi > 0 ? (kw * 1000) / (u * cosPhi) : 0;
}

/**
 * Caderea de tensiune in procente.
 * Mono: ΔU = 2·L·I·ρ/S, raportat la 230 V. Tri: ΔU = √3·L·I·ρ/S, raportat la 400 V.
 */
export function voltageDropPct(
  phases: Phases,
  currentA: number,
  lengthM: number,
  sectionMm2: number,
  rho: number,
): number | null {
  if (!(sectionMm2 > 0) || !(lengthM >= 0) || !(currentA >= 0)) return null;
  const du = ((phases === 3 ? Math.sqrt(3) : 2) * lengthM * currentA * rho) / sectionMm2;
  return (du / (phases === 3 ? U_TRI : U_MONO)) * 100;
}

/** Curentul admisibil Iz pentru sectiune, din tabelul setat. */
export function izFor(sectionMm2: number, phases: Phases, table: IzRow[]): number | null {
  const row = table.find((r) => Math.abs(r.sectionMm2 - sectionMm2) < 1e-9);
  if (!row) return null;
  return phases === 3 ? row.tri : row.mono;
}

/** Cea mai mica sectiune din tabel care respecta In ≤ Iz. */
export function minSectionFor(ratedA: number, phases: Phases, table: IzRow[]): number | null {
  const sorted = [...table].sort((a, b) => a.sectionMm2 - b.sectionMm2);
  return sorted.find((r) => (phases === 3 ? r.tri : r.mono) >= ratedA)?.sectionMm2 ?? null;
}

/** Cea mai mica sectiune care respecta In ≤ Iz si limita de cadere de tensiune la lungimea data. */
export function recommendSection(
  ratedA: number,
  lengthM: number,
  phases: Phases,
  table: IzRow[],
  rho: number,
  maxDropPct: number,
): number | null {
  const sorted = [...table].sort((a, b) => a.sectionMm2 - b.sectionMm2);
  return (
    sorted.find((r) => {
      const iz = phases === 3 ? r.tri : r.mono;
      const du = voltageDropPct(phases, ratedA, lengthM, r.sectionMm2, rho);
      return iz >= ratedA && du != null && du <= maxDropPct;
    })?.sectionMm2 ?? null
  );
}

/** Denumirea cablului: 3×2,5 la mono, 5×2,5 la tri. */
export function cableLabel(phases: Phases, sectionMm2: number): string {
  return `${phases === 3 ? 5 : 3}×${String(sectionMm2).replace(".", ",")}`;
}

export function defaultRules(): RuleSettings {
  return {
    maxSocketsPerCircuit: 8,
    maxLightPointsPerCircuit: 10,
    lightingGrouping: "incapere",
    defaults: {
      iluminat: { ratedA: 10, curve: "B", sectionMm2: 1.5, powerPerUnitKw: 0.06 },
      prize: { ratedA: 16, curve: "C", sectionMm2: 2.5, powerPerUnitKw: 0.2 },
      dedicat: { ratedA: 16, curve: "C", sectionMm2: 2.5, powerPerUnitKw: 2 },
    },
    iz: [
      { sectionMm2: 1.5, mono: 16.5, tri: 15 },
      { sectionMm2: 2.5, mono: 23, tri: 20 },
      { sectionMm2: 4, mono: 30, tri: 27 },
      { sectionMm2: 6, mono: 38, tri: 34 },
      { sectionMm2: 10, mono: 52, tri: 46 },
      { sectionMm2: 16, mono: 69, tri: 62 },
    ],
    rho: 0.0225,
    maxDropLightingPct: 3,
    maxDropOtherPct: 5,
    selectivityRatio: 1.6,
    minSimultaneity: 0.4,
  };
}

/** Regulile efective: cele salvate peste cele implicite (camp cu camp). */
export function getRules(settings: Pick<PricingSettings, "rules"> | undefined): RuleSettings {
  const def = defaultRules();
  const saved = settings?.rules ?? {};
  return {
    ...def,
    ...saved,
    defaults: {
      iluminat: { ...def.defaults.iluminat, ...saved.defaults?.iluminat },
      prize: { ...def.defaults.prize, ...saved.defaults?.prize },
      dedicat: { ...def.defaults.dedicat, ...saved.defaults?.dedicat },
    },
    iz: saved.iz?.length ? saved.iz : def.iz,
  };
}
