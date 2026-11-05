# WATTNET · Configurator instalatii electrice

Aplicatie Next.js + TypeScript pentru ofertarea si planificarea lucrarilor electrice WATTNET.
Repo separat de site-ul static `wattnet.ro`, publicat ca proiect Vercel separat.

## Faza 1 — lucrari „la rosu” (ce face acum).

- **Proiect si beneficiar**: cod, tip cladire, alimentare, date client, siguranta generala (A) →
  putere maxima absorbita (mono 230·I·cosφ, tri √3·400·I·cosφ) si putere instalata estimata.
- **Niveluri si doze**: subsol / demisol / parter / etaj / mansarda / anexe (garaj, foisor) → incaperi →
  doze de prize, intrerupatoare, iluminat, legatura, termostat si alte surse (cablu lasat, fara doza),
  cu tipul peretelui pe incapere si marimea dozei pe tip; circuitele dedicate pe incapere (nu se numara
  ca doze) si cablurile care ajung in fiecare incapere; lungimea traseelor. Traseul nemasurat se
  estimeaza automat si e marcat ca **estimare**.
- **Tablouri in cascada**: tablou principal plus tablouri secundare alimentate din alt tablou,
  aparate pe sine DIN, ocuparea in module, desen SVG orientativ si lungimea cablului de alimentare.
- **Deviz de manopera**: cantitatile vin din configuratie, iar tarifele din catalogul tau
  (tarif unitar sau timp standard × tarif orar). Discount, TVA, tiparire/PDF din browser.
- **Plan de executie**: etapele in ordinea lucrului, cu durate estimate din timpii standard.
- **Circuite**: generate automat din doze, denumite si numerotate (CI_P01, CP_P01, CP_P03_02, LED_P01),
  cu siguranta, cablu, lungime, putere si ΔU. Orice valoare se poate modifica (se pastreaza peste
  regenerare); circuitele se pot comasa pe acelasi aparat.
- **Sigurante necesare** pe fiecare tablou: lista de disjunctoare cu valorile lor, buton „Adauga”.
  Aparatele au In (A), curba, IΔn/tip, circuitul protejat, RCD-ul amonte si plecarea spre tablourile secundare.
- **Schema monofilara** generata din tablouri (export SVG, tiparire).
- **Verificari** pe categorii: date, circuite (prize/puncte pe circuit, In ≤ Iz, ΔU, RCD), tablouri,
  selectivitate amperica intre tablouri si fata de siguranta generala.
- **Documentatie** completa pe A4: coperta, inventar, circuite, tablouri, schema, verificari, deviz, plan.
- **Cheat sheet**: tabele mono/tri (putere, sectiune, ΔU la 30 m) si calculator rapid.
- **Setari de proiectare** (Tarife & setari): limite si constante (Iz, ρ, ΔU, raport selectivitate),
  cu valori de start — nu sunt reguli din normativ.

### Ce NU face (intentionat)

- Nu propune tarife sau timpi: catalogul porneste gol si il completezi tu.
- Propune protectii si sectiuni doar din valorile tale implicite si nu declara conformitatea cu **I7-2011**.
  Regulile normative se adauga una cate una in `src/lib/engine/checks.ts`, fiecare cu referinta
  exacta (articol/tabel), teste si validare de catre electricianul autorizat.
- Datele stau in **browserul curent** (localStorage). Foloseste *Export JSON* pentru copii de siguranta.
  Baza de date (Supabase) si autentificarea vin intr-o etapa ulterioara.

## Structura

```
src/
  lib/engine/      ← motorul de calcul, fara React (testat separat)
    types.ts       ← modelul de date
    electrical.ts  ← formule: putere, ΔU, Iz, sectiuni; reguli implicite
    circuits.ts    ← generarea circuitelor, sugestii de sigurante
    singleLine.ts  ← modelul schemei monofilare
    cheatsheet.ts  ← tabelele de referinta
    inventory.ts   ← inventar doze / trasee (masurat vs. estimat)
    panel.ts       ← ocupare DIN, cascada tablouri
    pricing.ts     ← deviz + plan de executie
    checks.ts      ← verificari (conform / neconform / nedeterminat)
    defaults.ts    ← proiect nou, catalog operatiuni, proiect exemplu
  lib/store.ts     ← salvare locala
  components/      ← interfata (tab-uri)
tests/             ← teste Vitest pentru motor
```

## Lucru local (Windows / PowerShell)

```powershell
npm install
npm run dev      # http://localhost:3000
npm test         # testele motorului
npm run build    # verificare inainte de push
```

## Publicare pe Vercel

1. Vercel → **Add New… → Project** → importa repo-ul `configurator.wattnet.ro`.
2. Framework: Next.js (detectat automat), fara variabile de mediu.
3. Optional: domeniu `configurator.wattnet.ro` (Settings → Domains).

Nota: planul Vercel Hobby este destinat utilizarii necomerciale. Verifica termenii inainte de
folosirea in activitatea firmei.

## Pasii urmatori

1. Faza 2 „la gata”: aparataj, corpuri de iluminat, echipamente.
2. Materiale (lista de achizitii) separat de manopera.
3. Supabase: proiecte salvate, autentificare, versiuni ale ofertelor.
4. Configuratorul public pentru clienti pe wattnet.ro.
