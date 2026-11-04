import { StagePlaceholder } from "@/components/stage/StagePlaceholder";

export default function Page() {
  return (
    <StagePlaceholder
      title="Trasee, copex si cabluri"
      stage={2}
      items={[
        "Traseu fizic (sant) separat de tuburi si cabluri",
        "Traseu comun pentru mai multe circuite - santul se numara o singura data",
        "Segmente cu lungime estimata sau masurata, corectabile manual",
        "Ramificatii de trasee si exceptii locale de tip perete",
        "Mai multe tuburi / cabluri pe acelasi traseu",
        "Estimare initiala din dimensiunile incaperilor",
      ]}
    />
  );
}
