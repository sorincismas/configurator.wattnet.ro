/**
 * Cheat sheet: valori uzuale, asa cum au fost date de electrician.
 * Puterile si ΔU sunt verificate in teste fata de formulele din electrical.ts.
 */
export type CheatRow = {
  a: number;
  p1: string;
  p085: string;
  minSection: string;
  rec30: string;
  du30: string;
};

export const CHEAT_MONO: CheatRow[] = [
  { a: 6, p1: "1,4 kW", p085: "1,2 kW", minSection: "3×1,5", rec30: "3×1,5", du30: "2,3 %" },
  { a: 10, p1: "2,3 kW", p085: "2,0 kW", minSection: "3×1,5", rec30: "3×1,5 (sub 20 m) / 3×2,5 (30 m)", du30: "3,9 % / 2,3 %" },
  { a: 13, p1: "3,0 kW", p085: "2,5 kW", minSection: "3×1,5", rec30: "3×2,5", du30: "3,1 %" },
  { a: 16, p1: "3,7 kW", p085: "3,1 kW", minSection: "3×2,5", rec30: "3×2,5", du30: "3,8 %" },
  { a: 20, p1: "4,6 kW", p085: "3,9 kW", minSection: "3×2,5", rec30: "3×4", du30: "2,9 %" },
  { a: 25, p1: "5,8 kW", p085: "4,9 kW", minSection: "3×4", rec30: "3×4", du30: "3,7 %" },
  { a: 32, p1: "7,4 kW", p085: "6,3 kW", minSection: "3×6", rec30: "3×6", du30: "3,1 %" },
  { a: 40, p1: "9,2 kW", p085: "7,8 kW", minSection: "3×10", rec30: "3×10", du30: "2,3 %" },
  { a: 50, p1: "11,5 kW", p085: "9,8 kW", minSection: "3×10", rec30: "3×10 (sau 3×16)", du30: "2,9 %" },
];

export const CHEAT_TRI: CheatRow[] = [
  { a: 6, p1: "4,2 kW", p085: "3,5 kW", minSection: "5×1,5", rec30: "5×1,5", du30: "1,2 %" },
  { a: 10, p1: "6,9 kW", p085: "5,9 kW", minSection: "5×1,5", rec30: "5×1,5", du30: "2,0 %" },
  { a: 13, p1: "9,0 kW", p085: "7,7 kW", minSection: "5×1,5", rec30: "5×2,5", du30: "1,5 %" },
  { a: 16, p1: "11,1 kW", p085: "9,4 kW", minSection: "5×2,5", rec30: "5×2,5", du30: "1,9 %" },
  { a: 20, p1: "13,9 kW", p085: "11,8 kW", minSection: "5×2,5 (la limita)", rec30: "5×4", du30: "1,5 %" },
  { a: 25, p1: "17,3 kW", p085: "14,7 kW", minSection: "5×4", rec30: "5×4", du30: "1,8 %" },
  { a: 32, p1: "22,2 kW", p085: "18,8 kW", minSection: "5×6", rec30: "5×6", du30: "1,9 %" },
  { a: 40, p1: "27,7 kW", p085: "23,6 kW", minSection: "5×10", rec30: "5×10", du30: "1,2 %" },
  { a: 50, p1: "34,6 kW", p085: "29,4 kW", minSection: "5×16", rec30: "5×16", du30: "0,9 %" },
];

