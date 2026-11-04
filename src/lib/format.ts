export const NA = "—";

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return NA;
  return v.toLocaleString("ro-RO", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtMoney(v: number | null | undefined, currency = "lei"): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return NA;
  return v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + currency;
}

export function fmtHours(h: number | null | undefined): string {
  if (h === null || h === undefined || !Number.isFinite(h)) return NA;
  return fmtNum(h, 1) + " h";
}

export function fmtKW(w: number | null | undefined): string {
  if (w === null || w === undefined) return NA;
  return fmtNum(w / 1000, 2) + " kW";
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return NA;
  const d = new Date(iso);
  return d.toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "niciodata";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "acum";
  if (s < 3600) return `acum ${Math.floor(s / 60)} min`;
  if (s < 86400) return `acum ${Math.floor(s / 3600)} h`;
  return `acum ${Math.floor(s / 86400)} zile`;
}

/** parseaza numere cu virgula sau punct; gol => null */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
