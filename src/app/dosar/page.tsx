import { StagePlaceholder } from "@/components/stage/StagePlaceholder";

export default function Page() {
  return (
    <StagePlaceholder
      title="Dosar si versiuni"
      stage={5}
      items={[
        "Dosar PDF cu cele 14 capitole, export si pe capitole",
        "Coperta cu sigla, beneficiar, numar proiect, versiune",
        "Emitere versiune: instantaneu inghetat al proiectului si bibliotecii",
        "Versiunile emise nu se modifica retroactiv; Rev.01, Rev.02 ...",
        "Registru ipoteze, date neconfirmate, semnaturi si istoric revizii",
      ]}
    />
  );
}
