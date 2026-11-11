/**
 * Sincronizarea bibliotecii globale cu proiectele.
 *
 * Doua tipuri de continut, tratate diferit:
 *  - CATALOG TEHNIC (tipuri de doze, aparate, cabluri, tuburi, aparate de tablou,
 *    cutii, metode de pozare, tipuri de incapere / perete / circuit): se
 *    sincronizeaza automat in toate proiectele, ca orice element nou adaugat in
 *    biblioteca sa poata fi folosit imediat;
 *  - TARIFE SI REGULI (operatii, preturi materiale, factori, reguli tehnice):
 *    raman pe proiect si se actualizeaza doar prin actiunea explicita
 *    „Aplica biblioteca globala”, ca un deviz deja facut sa nu se schimbe singur.
 * Materialele noi (id inexistent in proiect) se adauga, fara a modifica preturile
 * materialelor existente in proiect.
 */
import type { Library } from "../model/types";

export const CATALOG_KEYS = ["deviceTypes", "pointPurposes", "boxTypes", "cableTypes", "conduitTypes", "protectionDevices", "enclosureTypes", "installMethods", "roomTypes", "wallTypes", "circuitTypes", "templates"] as const;

type WithId = { id: string };

function mergeById<T extends WithId>(project: T[], global: T[]): T[] {
  const out = project.map((x) => structuredClone(global.find((g) => g.id === x.id) ?? x));
  for (const g of global) if (!out.some((x) => x.id === g.id)) out.push(structuredClone(g));
  return out;
}

/** returneaza biblioteca proiectului cu catalogul tehnic adus la zi */
export function syncCatalogs(projectLib: Library, globalLib: Library): Library {
  const next = { ...projectLib } as Library;
  for (const k of CATALOG_KEYS) (next as unknown as Record<string, unknown>)[k] = mergeById(projectLib[k] as WithId[], globalLib[k] as WithId[]);
  // materiale noi: adaugate; cele existente isi pastreaza pretul din proiect
  next.materials = [...projectLib.materials, ...globalLib.materials.filter((m) => !projectLib.materials.some((x) => x.id === m.id)).map((m) => structuredClone(m))];
  // factori noi (folositi de tipurile de perete noi)
  next.difficultyFactors = [...projectLib.difficultyFactors, ...globalLib.difficultyFactors.filter((f) => !projectLib.difficultyFactors.some((x) => x.id === f.id)).map((f) => structuredClone(f))];
  next.firm = structuredClone(globalLib.firm);
  return next;
}

/** exista diferente de catalog intre proiect si biblioteca globala? */
export function catalogDiffers(projectLib: Library, globalLib: Library): boolean {
  return CATALOG_KEYS.some((k) => JSON.stringify(projectLib[k]) !== JSON.stringify(globalLib[k]));
}
