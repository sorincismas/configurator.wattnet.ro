# configurator.wattnet.ro - Configurator instalatii electrice WATTNET

Aplicatie pentru configurarea instalatiilor electrice rezidentiale, calculul manoperei (valoare + timp),
materiale, tablouri, scheme monofilare, plan de executie si documentatie - conform specificatiei
`WATTNET_Specificatie_Aplicatie_Instalatii_Electrice_v1.0`.

> Instrument de asistenta. Nu inlocuieste proiectarea / verificarea de specialitate, masuratorile
> efective sau responsabilitatea persoanei autorizate ANRE. Regulile tehnice sunt marcate
> „de validat” pana la verificare.

## Tehnologii

- Next.js 16 (App Router, export static) + React 19 + TypeScript
- Tailwind CSS 4, Zustand (stare), IndexedDB (salvare automata locala)
- Vitest pentru motorul de calcul
- Fara server si fara baza de date: merge pe Vercel (inclusiv Hobby), Cloudflare Pages, Netlify sau orice hosting static

## Date si salvare

- Proiectele si biblioteca se salveaza automat in **browserul curent** (IndexedDB).
- **Export proiect** → fisier `*.wattnet.json` (proiectul complet, inclusiv copia bibliotecii).
- **Import** → „Deschide si continua” sau „Foloseste ca sablon” (cod nou, fara date client).
- **Export biblioteca** → `*.wattnet-lib.json` (tarife, timpi, materiale, aparate, reguli). Importul
  inlocuieste biblioteca globala; proiectele existente se actualizeaza doar prin actiune explicita.
- Fisierele au `schemaVersion`; fisierele vechi se migreaza automat la deschidere.
- Bara de sus arata „Neexportat” cand exista modificari care nu sunt inca intr-un fisier.

## Structura

```
src/lib/model/      model de date (types.ts), identificatori, fabrici
src/lib/library/    biblioteca initiala (valori EXEMPLU)
src/lib/engine/     motor de calcul pur, fara UI: masuratori, puteri, manopera, materiale, durata, sumar
src/lib/io/         export / import JSON, validare, migrari
src/lib/store/      stare + persistenta IndexedDB
src/components/     UI comun, bara de sumar, shell
src/app/            pagini (proiecte, proiect, alimentare, cladire, biblioteca, ... )
tests/              teste motor (vitest)
```

## Dezvoltare (Windows / PowerShell)

```powershell
npm install
npm run dev        # http://localhost:3000
npm test           # teste motor
npm run build      # export static in .\out
```

Pe Vercel: framework Next.js, comanda `npm run build`, director de iesire `out` (detectat automat la `output: "export"`).

## Etape

| Etapa | Continut | Stare |
|---|---|---|
| 1 Fundatie | proiecte, alimentare, cladiri/niveluri/incaperi, identificatori, biblioteca, bara sumar, JSON | **gata** |
| 2 Model instalatie | doze DA/DD, aparate, consumatori, circuite, trasee, copex, cabluri | **gata** |
| 3 Tablouri si calcule | dimensionare asistata I7, tablouri, vedere DIN, schema monofilara, verificari | **gata** |
| 4 Deviz si timp | deviz manopera / + materiale, subtotaluri, tarif orar implicit, oferta si proforma (simplificat / detaliat) | **gata** |
| 5 Dosar si versiuni | dosar PDF 14 capitole (complet sau pe capitole), emitere Rev.NN cu instantaneu inghetat, comparatie cu proiectul curent, registru observatii | **gata** |
| 6 Lucru rapid + telefon | ecran Puncte si circuite (coloane nivel > incapere > puncte > detaliu), cod rapid „4P 2L 1I”, impartire automata pe circuite (max 6 puncte, incaperea impreuna), NYY-J implicit, lungimi / sant / tub estimate pe proiect, tablou nou / existent, interfata pentru telefon | **gata** |
| 6b Faza la rosu pe doze | doze cu destinatie (Biblioteca → Doze pentru faza la rosu), puncte de iluminat pe tipuri, traseu ca lant pe circuit (tablou → doza → doza, metri pe legatura), deviz pe tipuri de doze, aparataj pus in doze dupa module (faza la gata) | **gata** |
| 6c Faza la gata | operatii de montaj aparataj si corpuri de iluminat, aparataj implicit pe destinatia dozei, materiale aparataj, deviz pe faza (la rosu / la gata / ambele) | **gata** |
| 7 Plan executie | operatii, dependente, echipa, durata | motor initial |
