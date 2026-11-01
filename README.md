# WATTNET · Configurator instalații electrice

Aplicație Next.js + TypeScript pentru ofertarea și planificarea lucrărilor electrice WATTNET.
Repo separat de site-ul static `wattnet.ro`, publicat ca proiect Vercel separat.

## Faza 1 — lucrări „la roșu” (ce face acum)

- **Proiect și beneficiar**: cod, tip clădire, alimentare, date client.
- **Niveluri și doze**: subsol / parter / etaj / mansardă / anexe (garaj, foișor) → încăperi →
  doze de prize, întrerupătoare, iluminat, consumatori dedicați și doze de legătură, bandă LED și
  lungimea traseelor. Traseul nemăsurat se estimează automat și e marcat ca **estimare**.
- **Tablouri în cascadă**: tablou principal plus tablouri secundare alimentate din alt tablou,
  aparate pe șine DIN, ocuparea în module, desen SVG orientativ și lungimea cablului de alimentare.
- **Deviz de manoperă**: cantitățile vin din configurație, iar tarifele din catalogul tău
  (tarif unitar sau timp standard × tarif orar). Discount, TVA, tipărire/PDF din browser.
- **Plan de execuție**: etapele în ordinea lucrului, cu durate estimate din timpii standard.
- **Verificări**: rezultat conform / neconform / nedeterminat pentru consistența datelor.

### Ce NU face (intenționat)

- Nu propune tarife sau timpi: catalogul pornește gol și îl completezi tu.
- Nu dimensionează protecții sau secțiuni și nu declară conformitatea cu **I7-2011**.
  Regulile normative se adaugă una câte una în `src/lib/engine/checks.ts`, fiecare cu referință
  exactă (articol/tabel), teste și validare de către electricianul autorizat.
- Datele stau în **browserul curent** (localStorage). Folosește *Export JSON* pentru copii de siguranță.
  Baza de date (Supabase) și autentificarea vin într-o etapă ulterioară.

## Structură

```
src/
  lib/engine/      ← motorul de calcul, fără React (testat separat)
    types.ts       ← modelul de date
    inventory.ts   ← inventar doze / trasee (măsurat vs. estimat)
    panel.ts       ← ocupare DIN, cascadă tablouri
    pricing.ts     ← deviz + plan de execuție
    checks.ts      ← verificări (conform / neconform / nedeterminat)
    defaults.ts    ← proiect nou, catalog operațiuni, proiect exemplu
  lib/store.ts     ← salvare locală
  components/      ← interfața (tab-uri)
tests/             ← teste Vitest pentru motor
```

## Lucru local (Windows / PowerShell)

```powershell
npm install
npm run dev      # http://localhost:3000
npm test         # testele motorului
npm run build    # verificare înainte de push
```

## Publicare pe Vercel

1. Vercel → **Add New… → Project** → importă repo-ul `wattnet-configurator`.
2. Framework: Next.js (detectat automat), fără variabile de mediu.
3. Opțional: domeniu `configurator.wattnet.ro` (Settings → Domains).

Notă: planul Vercel Hobby este destinat utilizării necomerciale. Verifică termenii înainte de
folosirea în activitatea firmei.

## Pașii următori

1. Faza 2 „la gata”: aparataj, corpuri de iluminat, echipamente.
2. Circuite: asocierea dozelor cu circuitele și cu aparatele din tablou.
3. Schema monofilară generată din aceeași configurație.
4. Materiale (listă de achiziții) separat de manoperă.
5. Supabase: proiecte salvate, autentificare, versiuni ale ofertelor.
6. Configuratorul public pentru clienți pe wattnet.ro.
