import { StagePlaceholder } from "@/components/stage/StagePlaceholder";

export default function Page() {
  return (
    <StagePlaceholder
      title="Verificari tehnice"
      stage={3}
      items={[
        "Ic ≤ I'z cu Iz din anexa 5.10 si factorii K1 / K2 (anexele 5.18, 5.19)",
        "Coordonare Ib ≤ In ≤ I'z",
        "Cadere de tensiune 3% iluminat / 5% alte receptoare (art. 5.2.5.1)",
        "Sectiuni minime (anexa 5.32), neutru necomun (art. 5.2.4.6.4)",
        "Rezultate: Conform, Avertizare, Neconform, Date insuficiente, Neverificat",
        "Masuratori reale inregistrate separat (instrument, data, persoana)",
        "Registru de ipoteze si neconformitati",
      ]}
    />
  );
}
