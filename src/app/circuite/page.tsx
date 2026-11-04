import { StagePlaceholder } from "@/components/stage/StagePlaceholder";

export default function Page() {
  return (
    <StagePlaceholder
      title="Circuite"
      stage={2}
      items={[
        "Generare automata pe destinatie, putere, consumator si alimentare",
        "Mutare manuala a punctelor intre circuite",
        "Consum total pe fiecare circuit (putere instalata si aplicata)",
        "Coeficient de simultaneitate pe circuit",
        "Cablu, metoda de pozare, protectie propusa - editabile",
        "Campuri blocate manual, care nu se suprascriu la regenerare",
        "Fisa circuitului pentru dosar",
      ]}
    />
  );
}
