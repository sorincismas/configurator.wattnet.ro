/**
 * Culori de orientare: fiecare pagina are culoarea ei (meniu, titlu, carduri),
 * iar dozele si aparatele sunt colorate pe tip.
 */

export interface Accent {
  /** culoarea principala (text pe fundal alb, bara laterala) */
  c: string;
  /** fundal deschis */
  bg: string;
}

const A = (c: string, bg: string): Accent => ({ c, bg });

export const PAGE_ACCENT: Record<string, Accent> = {
  "/": A("#14181f", "#eceae4"),
  "/proiect": A("#1e4fa3", "#e3ecfa"),
  "/alimentare": A("#b45309", "#fdf0dc"),
  "/cladire": A("#4b5563", "#eceef1"),
  "/instalatie": A("#0f766e", "#dcf3ef"),
  "/puncte": A("#0d9488", "#dcf3ef"),
  "/circuite": A("#4338ca", "#e6e6fb"),
  "/trasee": A("#c2410c", "#fde7da"),
  "/tablouri": A("#7e22ce", "#f1e5fb"),
  "/verificari": A("#be123c", "#fce4ea"),
  "/deviz": A("#15803d", "#ddf3e3"),
  "/plan": A("#a16207", "#fbf1d3"),
  "/dosar": A("#334155", "#e5e9ef"),
  "/biblioteca": A("#6b4f2a", "#f1e9de"),
};

export function accentFor(path: string): Accent {
  const p = path.length > 1 ? path.replace(/\/$/, "") : path;
  return PAGE_ACCENT[p] ?? PAGE_ACCENT["/"];
}

/** culori pe categorie de aparat */
export const DEVICE_COLOR: Record<string, Accent & { label: string }> = {
  priza: { c: "#1d4ed8", bg: "#e8effd", label: "Priza" },
  intrerupator: { c: "#7c3aed", bg: "#f0e9fe", label: "Intrerupator" },
  iluminat: { c: "#b45309", bg: "#fef3d6", label: "Iluminat" },
  consumator_dedicat: { c: "#dc2626", bg: "#fde8e8", label: "Consumator dedicat" },
  curenti_slabi: { c: "#047857", bg: "#def5ec", label: "Curenti slabi" },
  comanda: { c: "#0e7490", bg: "#dff4f8", label: "Comanda / senzor" },
  altul: { c: "#4b5563", bg: "#eef0f3", label: "Altul" },
};

export const BOX_COLOR: Record<"DA" | "DD", Accent & { label: string }> = {
  DA: { c: "#0f766e", bg: "#d5efe9", label: "Doza aparat (DA)" },
  DD: { c: "#c2410c", bg: "#fbe3d3", label: "Doza derivatie (DD)" },
};
