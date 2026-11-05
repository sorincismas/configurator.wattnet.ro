export interface NavItem {
  href: string;
  label: string;
  /** etapa de dezvoltare in care devine functional */
  stage: number;
  needsProject: boolean;
  group: string;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Proiecte", stage: 1, needsProject: false, group: "General" },
  { href: "/proiect", label: "Date proiect", stage: 1, needsProject: true, group: "Proiect" },
  { href: "/alimentare", label: "Alimentare si puteri", stage: 1, needsProject: true, group: "Proiect" },
  { href: "/cladire", label: "Cladire si incaperi", stage: 1, needsProject: true, group: "Proiect" },
  { href: "/puncte", label: "Doze si aparate", stage: 2, needsProject: true, group: "Instalatie" },
  { href: "/circuite", label: "Circuite", stage: 2, needsProject: true, group: "Instalatie" },
  { href: "/trasee", label: "Trasee si cabluri", stage: 2, needsProject: true, group: "Instalatie" },
  { href: "/tablouri", label: "Tablouri si scheme", stage: 3, needsProject: true, group: "Instalatie" },
  { href: "/verificari", label: "Verificari tehnice", stage: 3, needsProject: true, group: "Instalatie" },
  { href: "/deviz", label: "Deviz", stage: 4, needsProject: true, group: "Comercial" },
  { href: "/plan", label: "Plan de executie", stage: 6, needsProject: true, group: "Comercial" },
  { href: "/dosar", label: "Dosar si versiuni", stage: 5, needsProject: true, group: "Comercial" },
  { href: "/biblioteca", label: "Biblioteca", stage: 1, needsProject: false, group: "Setari" },
];

export const CURRENT_STAGE = 3;
