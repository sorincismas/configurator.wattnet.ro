# Configurator WATTNET v2 - decizii (04.11.2026)

Rescriere completa dupa `WATTNET_Specificatie_Aplicatie_Instalatii_Electrice_v1.0`. Inlocuieste configuratorul anterior.

## Decizii confirmate de Sorin
1. Rescriere de la zero in repo-ul `configurator.wattnet.ro`, ramura `v2-rewrite`, prin PR.
2. Configuratorul public pentru clienti se amana; v1 este aplicatia de lucru a electricianului.
3. Tarife si timpi: valori exemplu marcate „exemplu”; Sorin le actualizeaza, exporta biblioteca JSON si o foloseste ca sablon.
4. WATTNET nu este platitor de TVA (setare in biblioteca, cota editabila).
5. Branduri uzuale: Schrack, Schneider (aparataj tablou), Gewiss (doze rotunde); pot fi schimbate pe proiect.
6. Schema monofilara pornind de la `Schema_Monofilara_rev01` (Visio, A3), completata cu informatii relevante, in special consumul total pe circuit.
7. Datele firmei sunt preluate de pe wattnet.ro (email proiectare@wattnet.ro, tel +40 740 514 117, Sibiu); autorizatie ANRE Gr. IIA+B nr. 202311684, proiectant Ing. Cismas Sorin.
8. Fiecare etapa se livreaza ca PR separat.

## Arhitectura
- Next.js 16 + React 19 + TypeScript, export static (fara server, fara baza de date), Vercel.
- Salvare automata in browser (IndexedDB) + export/import `.wattnet.json` (proiect) si `.wattnet-lib.json` (biblioteca), cu schemaVersion si migrari.
- Motor de calcul pur in `src/lib/engine`, testat cu Vitest; UI fara reguli electrice duplicate.
- Fiecare proiect are copia proprie a bibliotecii; actualizarea din biblioteca globala se face doar prin actiune explicita.
- Tabelele I7 (anexele 5.10, 5.18, 5.19) si regulile (art. 5.2.4.1.2, 5.2.5.1 3%/5%, 5.2.4.6.4, 5.2.6.4) sunt marcate „de validat”.

## Etape
1. Fundatie - livrata (proiecte, alimentare, cladire/niveluri/incaperi, biblioteca, bara sumar, JSON).
2. Doze DA/DD, aparate, consumatori, circuite, trasee, copex, cabluri.
3. Tablouri, dimensionare asistata I7, vedere DIN, schema monofilara.
4. Deviz complet (motorul de calcul este deja gata).
5. Dosar PDF in 14 capitole, versiuni emise.
6. Plan de executie (motorul initial este deja gata).
