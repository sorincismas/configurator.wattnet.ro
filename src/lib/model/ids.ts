import type { CodeCounters, CodePrefix } from "./types";

/** id intern unic (nu se afiseaza) */
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** formatul vizibil: doua litere + trei cifre (peste 999 se extinde: DA1000) */
export function formatCode(prefix: CodePrefix, n: number): string {
  return prefix + String(n).padStart(3, "0");
}

/**
 * Aloca urmatorul cod pentru un prefix. Contorul creste monoton si NU se
 * decrementeaza la stergere, deci codurile nu se reutilizeaza.
 * Returneaza codul si contoarele noi (functie pura).
 */
export function allocateCode(counters: CodeCounters, prefix: CodePrefix): { code: string; counters: CodeCounters } {
  const next = (counters[prefix] ?? 0) + 1;
  return { code: formatCode(prefix, next), counters: { ...counters, [prefix]: next } };
}

/** varianta mutabila, comoda in reduceri imutabile tip immer/zustand */
export function takeCode(counters: CodeCounters, prefix: CodePrefix): string {
  const next = (counters[prefix] ?? 0) + 1;
  counters[prefix] = next;
  return formatCode(prefix, next);
}
