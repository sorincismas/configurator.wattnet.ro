import { StagePlaceholder } from "@/components/stage/StagePlaceholder";

export default function Page() {
  return (
    <StagePlaceholder
      title="Doze si aparate"
      stage={2}
      items={[
        "Doze aparat (DA) rotunde sau modulare, cu numar de module",
        "Doze derivatie (DD) cu ramificatii si mai multe circuite",
        "Mai multe aparate in aceeasi doza; numarare separata doze / aparate / module",
        "Putere introdusa manual pe aparat / consumator (nu pe doza)",
        "Curenti slabi (RJ45, TV) separat, fara putere",
        "Iluminat: tablou → intrerupator → punct sau prin doza derivatie",
        "Adaugare rapida pe incapere si editare in masa",
        "Filtrare dupa nivel, incapere, tip si stare",
      ]}
    />
  );
}
