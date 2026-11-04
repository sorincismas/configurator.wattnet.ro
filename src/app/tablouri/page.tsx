import { StagePlaceholder } from "@/components/stage/StagePlaceholder";

export default function Page() {
  return (
    <StagePlaceholder
      title="Tablouri si scheme"
      stage={3}
      items={[
        "Tablou principal si tablouri secundare (cascada pe etaje, anexe)",
        "Feeder intre tablouri: cablu, lungime, protectie, verificari",
        "Vedere fizica pe sina DIN, module ocupate, rezerva, avertizari",
        "Repartizare pe faze L1/L2/L3 si echilibrare",
        "Schema monofilara pe modelul tau (Schema_Monofilara_rev01), completata cu: curent de calcul, consum total pe circuit, lungime, ΔU, faza, protectia diferentiala amonte",
        "Cartus cu datele firmei, proiectant, autorizatie ANRE, beneficiar, revizie",
        "Export SVG / PDF",
      ]}
    />
  );
}
