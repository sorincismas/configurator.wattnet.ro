"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { EditableTable } from "@/components/EditableTable";
import { ImportPanel } from "@/components/io/ImportPanel";
import { Badge, Button, Card, Checkbox, ConfirmButton, Field, NumberInput, PageHeader, Select, Table, Tabs, TextArea, TextInput } from "@/components/ui";
import { createDefaultLibrary } from "@/lib/library/default-library";
import { downloadJSON, libraryFileName, libraryToFile } from "@/lib/io/files";
import { fmtDate, fmtMoney, timeAgo } from "@/lib/format";
import { uid } from "@/lib/model/ids";
import type { BoxType, CableType, CircuitType, ConduitType, DeviceType, DifficultyFactor, EnclosureType, Library, Material, Operation, ProtectionDevice, TechnicalRule, WallType } from "@/lib/model/types";
import { useActiveProject, useApp } from "@/lib/store/store";

type TabId = "firma" | "operatii" | "materiale" | "protectii" | "tablouri" | "doze" | "cabluri" | "aparate" | "factori" | "circuite" | "reguli" | "tabele" | "sabloane";

const DRIVERS: { value: Operation["driver"]; label: string }[] = [
  { value: "manual", label: "Manual (cantitate introdusa in deviz)" },
  { value: "points_total", label: "Toate punctele (doze + tablouri + puncte fara doza)" },
  { value: "boxes_da_round", label: "Doze aparat rotunde / etanse" },
  { value: "boxes_da_modular", label: "Doze aparat modulare" },
  { value: "boxes_da_all", label: "Toate dozele aparat" },
  { value: "boxes_dd", label: "Doze derivatie" },
  { value: "box_recesses", label: "Locasuri doze (ingropate)" },
  { value: "route_chase_m", label: "Metri sant (o data / traseu)" },
  { value: "conduit_m", label: "Metri copex" },
  { value: "cable_m", label: "Metri cablu (pe circuit)" },
  { value: "feeder_m", label: "Metri alimentare intre tablouri" },
  { value: "panels", label: "Tablouri" },
  { value: "panel_items", label: "Aparate modulare in tablou" },
  { value: "circuits", label: "Circuite (toate)" },
  { value: "new_circuits", label: "Circuite noi" },
  { value: "existing_circuits", label: "Circuite existente (reconectate)" },
  { value: "dd_connections", label: "Conexiuni in doze derivatie" },
  { value: "rooms", label: "Incaperi" },
];
const UNITS = ["buc", "m", "ora", "set", "circuit", "tablou", "proiect"].map((u) => ({ value: u, label: u }));
const CATEGORIES = ["trasare", "sant", "doze", "tuburi", "cablare", "tablou", "verificari", "diverse"].map((u) => ({ value: u, label: u }));

export default function LibraryPage() {
  const app = useApp();
  const project = useActiveProject();
  const [target, setTarget] = useState<"global" | "project">("global");
  const [tab, setTab] = useState<TabId>("operatii");
  const editingProject = target === "project" && project;
  const lib: Library = editingProject ? project.library : app.library;
  const updateLib = (recipe: (l: Library) => void) => {
    if (editingProject) app.update(project.id, (p) => { recipe(p.library); p.library.meta.updatedAt = new Date().toISOString(); });
    else app.updateLibrary(recipe);
  };
  /** helper pentru liste */
  function listOps<K extends keyof Library>(key: K) {
    type Row = Library[K] extends (infer R)[] ? R : never;
    return {
      onChange: (id: string, patch: Partial<Row>) =>
        updateLib((l) => {
          const arr = l[key] as unknown as (Row & { id: string })[];
          const i = arr.findIndex((x) => x.id === id);
          if (i >= 0) arr[i] = { ...arr[i], ...patch };
        }),
      onDelete: (id: string) => updateLib((l) => void ((l[key] as unknown as { id: string }[]).splice((l[key] as unknown as { id: string }[]).findIndex((x) => x.id === id), 1))),
      add: (row: Row) => updateLib((l) => void (l[key] as unknown as Row[]).push(row)),
    };
  }

  const matOpts = lib.materials.map((m) => ({ value: m.id, label: `${m.name}${m.brand ? " - " + m.brand : ""}` }));
  const exportLib = () => {
    downloadJSON(libraryToFile(lib), libraryFileName(lib));
    if (!editingProject) app.markLibraryExported();
  };
  const exampleCount = lib.operations.filter((o) => o.isExample).length + lib.materials.filter((m) => m.isExample).length;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "firma", label: "Firma" },
    { id: "operatii", label: "Operatii si tarife", count: lib.operations.length },
    { id: "materiale", label: "Materiale", count: lib.materials.length },
    { id: "protectii", label: "Aparate tablou", count: lib.protectionDevices.length },
    { id: "tablouri", label: "Cutii tablou", count: lib.enclosureTypes.length },
    { id: "doze", label: "Doze", count: lib.boxTypes.length },
    { id: "cabluri", label: "Cabluri si copex", count: lib.cableTypes.length + lib.conduitTypes.length },
    { id: "aparate", label: "Aparate si consumatori", count: lib.deviceTypes.length },
    { id: "factori", label: "Factori si pereti", count: lib.difficultyFactors.length },
    { id: "circuite", label: "Tipuri circuit", count: lib.circuitTypes.length },
    { id: "reguli", label: "Reguli tehnice", count: lib.rules.length },
    { id: "tabele", label: "Tabele I7" },
    { id: "sabloane", label: "Incaperi si sabloane" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Biblioteca tehnica"
        subtitle={
          <>
            {lib.meta.name} · versiunea <b>{lib.meta.version}</b> · modificata {fmtDate(lib.meta.updatedAt)}
            {!editingProject && <> · export: {timeAgo(app.libraryLastExportedAt)}</>}
          </>
        }
        actions={
          <>
            <Select
              className="w-64"
              value={target}
              onChange={(v) => setTarget(v)}
              options={[{ value: "global", label: "Editez: biblioteca globala" }, ...(project ? [{ value: "project" as const, label: `Editez: biblioteca proiectului ${project.info.code}` }] : [])]}
            />
            <Button variant="primary" onClick={exportLib}>Export biblioteca JSON</Button>
          </>
        }
      />

      {exampleCount > 0 && (
        <div className="rounded-md border border-warn/40 bg-warn/5 px-4 py-2 text-sm text-ink">
          <b>{exampleCount}</b> pozitii au valori <Badge tone="warn">exemplu</Badge>. Actualizeaza tarifele, timpii si preturile reale; marcajul dispare cand debifezi „exemplu”. Apoi exporta biblioteca si foloseste fisierul ca baza pentru proiecte noi.
        </div>
      )}
      {editingProject && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm">
          Editezi doar copia din proiectul <b>{project.info.code}</b>. Biblioteca globala si celelalte proiecte nu se modifica.
        </div>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "firma" && <FirmTab lib={lib} updateLib={updateLib} />}

      {tab === "operatii" && (
        <Card title="Catalog operatii de manopera" subtitle="Fiecare operatie produce simultan valoare (tarif x cantitate) si timp (timp unitar x cantitate). Sursa cantitatii leaga operatia de model.">
          <EditableTable<Operation>
            rows={lib.operations}
            {...listOps("operations")}
            onAdd={() =>
              listOps("operations").add({
                id: uid(), code: `OP${String(lib.operations.length + 1).padStart(3, "0")}`, name: "Operatie noua", category: "diverse", phase: "rosu", unit: "buc", rate: 0, timeMin: 0,
                driver: "manual", wallSensitive: false, subactions: [], planStageId: lib.planStages[0]?.id ?? null, dependsOn: [], parallelizable: true, active: true, validFrom: null, validTo: null, isExample: false,
              })
            }
            cols={[
              { key: "code", label: "Cod", type: "text", width: "80px" },
              { key: "name", label: "Denumire", type: "text" },
              { key: "category", label: "Categorie", type: "select", options: CATEGORIES, width: "130px" },
              { key: "phase", label: "Faza", type: "select", options: [{ value: "rosu", label: "la rosu" }, { value: "gata", label: "la gata" }], width: "120px" },
              { key: "unit", label: "UM", type: "select", options: UNITS, width: "105px" },
              { key: "rate", label: "Tarif", type: "number", suffix: "lei", width: "100px" },
              { key: "timeMin", label: "Timp", type: "number", suffix: "min", width: "95px" },
              { key: "driver", label: "Sursa cantitate", type: "select", options: DRIVERS, width: "220px" },
              { key: "planStageId", label: "Etapa plan", type: "select", options: lib.planStages.map((s) => ({ value: s.id, label: s.name })), nullable: true, width: "150px" },
              { key: "wallSensitive", label: "Factor perete", type: "checkbox", width: "60px" },
              { key: "parallelizable", label: "Paralel", type: "checkbox", width: "55px" },
              { key: "active", label: "Activ", type: "checkbox", width: "50px" },
              { key: "isExample", label: "Exemplu", type: "custom", width: "70px", render: (r, set) => <Checkbox checked={r.isExample} onChange={(v) => set({ isExample: v })} label={r.isExample ? "da" : ""} /> },
            ]}
          />
          <OperationDetails lib={lib} updateLib={updateLib} />
        </Card>
      )}

      {tab === "materiale" && (
        <Card title="Catalog materiale" subtitle="Pret ofertat = pret achizitie x (1 + adaos). Materialele pot fi incluse sau excluse din oferta fara a afecta manopera.">
          <EditableTable<Material>
            rows={lib.materials}
            {...listOps("materials")}
            onAdd={() => listOps("materials").add({ id: uid(), code: "", name: "Material nou", category: "diverse", brand: "", unit: "buc", purchasePrice: 0, markupPct: 20, supplier: "", validUntil: null, isExample: false })}
            cols={[
              { key: "code", label: "Cod produs", type: "text", width: "110px" },
              { key: "name", label: "Denumire", type: "text" },
              { key: "category", label: "Categorie", type: "text", width: "110px" },
              { key: "brand", label: "Producator", type: "text", width: "110px" },
              { key: "unit", label: "UM", type: "text", width: "60px" },
              { key: "purchasePrice", label: "Pret achizitie", type: "number", suffix: "lei", width: "110px" },
              { key: "markupPct", label: "Adaos", type: "number", suffix: "%", width: "85px" },
              { key: "id", label: "Pret ofertat", type: "custom", width: "100px", render: (r) => <span className="tabular-nums">{fmtMoney(r.purchasePrice * (1 + r.markupPct / 100))}</span> },
              { key: "supplier", label: "Furnizor", type: "text", width: "110px" },
              { key: "isExample", label: "Exemplu", type: "checkbox", width: "60px" },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-2">Adaos pentru toate:</span>
            <NumberInput className="w-24" value={null} suffix="%" onChange={(v) => v !== null && updateLib((l) => l.materials.forEach((m) => (m.markupPct = v)))} />
          </div>
        </Card>
      )}

      {tab === "protectii" && (
        <Card title="Aparate modulare pentru tablou" subtitle="MCB, RCD, RCBO, SPD, separatoare. Latimea in module DIN determina ocuparea tabloului - verifica fisa producatorului.">
          <EditableTable<ProtectionDevice>
            rows={lib.protectionDevices}
            {...listOps("protectionDevices")}
            onAdd={() => listOps("protectionDevices").add({ id: uid(), kind: "MCB", brand: "Schrack", series: "", name: "MCB nou", poles: "1P+N", ratingA: 16, curve: "C", sensitivityMA: null, rcdType: null, breakingCapacityKA: 6, modules: 2, materialId: null })}
            cols={[
              { key: "kind", label: "Tip", type: "select", options: ["MCB", "RCD", "RCBO", "SPD", "separator", "releu", "contactor", "contor", "altul"].map((v) => ({ value: v, label: v })), width: "100px" },
              { key: "brand", label: "Producator", type: "text", width: "110px" },
              { key: "series", label: "Serie / cod", type: "text", width: "120px" },
              { key: "name", label: "Denumire", type: "text" },
              { key: "poles", label: "Poli", type: "select", options: ["1P", "1P+N", "2P", "3P", "3P+N", "4P"].map((v) => ({ value: v, label: v })), width: "85px" },
              { key: "ratingA", label: "In", type: "number", suffix: "A", width: "80px", nullable: true },
              { key: "curve", label: "Curba", type: "select", options: ["B", "C", "D"].map((v) => ({ value: v, label: v })), nullable: true, width: "70px" },
              { key: "sensitivityMA", label: "IΔn", type: "number", suffix: "mA", width: "85px", nullable: true },
              { key: "rcdType", label: "Tip RCD", type: "select", options: ["AC", "A", "F", "B"].map((v) => ({ value: v, label: v })), nullable: true, width: "75px" },
              { key: "breakingCapacityKA", label: "Icn", type: "number", suffix: "kA", width: "80px", nullable: true },
              { key: "modules", label: "Module", type: "number", width: "70px" },
              { key: "materialId", label: "Material (pret)", type: "select", options: matOpts, nullable: true, width: "200px" },
            ]}
          />
        </Card>
      )}

      {tab === "tablouri" && (
        <Card title="Cutii de tablou">
          <EditableTable<EnclosureType>
            rows={lib.enclosureTypes}
            {...listOps("enclosureTypes")}
            onAdd={() => listOps("enclosureTypes").add({ id: uid(), name: "Tablou nou", brand: "", mounting: "ingropat", rows: 2, modulesPerRow: 12, materialId: null })}
            cols={[
              { key: "name", label: "Denumire", type: "text" },
              { key: "brand", label: "Producator", type: "text", width: "120px" },
              { key: "mounting", label: "Montaj", type: "select", options: [{ value: "ingropat", label: "ingropat" }, { value: "aparent", label: "aparent" }], width: "110px" },
              { key: "rows", label: "Randuri", type: "number", width: "80px" },
              { key: "modulesPerRow", label: "Module / rand", type: "number", width: "100px" },
              { key: "id", label: "Total", type: "custom", width: "70px", render: (r) => <span className="tabular-nums">{r.rows * r.modulesPerRow}</span> },
              { key: "materialId", label: "Material (pret)", type: "select", options: matOpts, nullable: true, width: "220px" },
            ]}
          />
        </Card>
      )}

      {tab === "doze" && (
        <Card title="Tipuri de doze" subtitle="Doza rotunda simpla este selectia implicita; dozele modulare au numar de module. Tariful de manopera se aplica per cutie.">
          <EditableTable<BoxType>
            rows={lib.boxTypes}
            {...listOps("boxTypes")}
            onAdd={() => listOps("boxTypes").add({ id: uid(), name: "Doza noua", kind: "DA", shape: "rotunda", modules: 2, brand: "Gewiss", materialId: null, operationId: "op-doza-rot" })}
            cols={[
              { key: "kind", label: "Tip", type: "select", options: [{ value: "DA", label: "DA - aparat" }, { value: "DD", label: "DD - derivatie" }], width: "130px" },
              { key: "name", label: "Denumire", type: "text" },
              { key: "shape", label: "Forma", type: "select", options: ["rotunda", "modulara", "aparenta", "etansa"].map((v) => ({ value: v, label: v })), width: "110px" },
              { key: "modules", label: "Module", type: "number", width: "75px" },
              { key: "brand", label: "Producator", type: "text", width: "110px" },
              { key: "materialId", label: "Material (pret)", type: "select", options: matOpts, nullable: true, width: "220px" },
            ]}
          />
        </Card>
      )}

      {tab === "cabluri" && (
        <div className="space-y-4">
          <Card title="Tipuri de cablu / conductoare" subtitle="Material / m = cati metri de material se consuma pe metru de circuit (ex. FY 3x2,5 = 3 m conductor FY 2,5).">
            <EditableTable<CableType>
              rows={lib.cableTypes}
              {...listOps("cableTypes")}
              onAdd={() => listOps("cableTypes").add({ id: uid(), name: "Cablu nou", construction: "cablu", conductorMaterial: "cupru", insulation: "PVC", cores: 3, loadedConductors: 2, crossSectionMm2: 2.5, materialId: null, materialQtyPerM: 1 })}
              cols={[
                { key: "name", label: "Denumire", type: "text" },
                { key: "construction", label: "Constructie", type: "select", options: [{ value: "fire_in_tub", label: "fire in tub" }, { value: "cablu", label: "cablu" }], width: "120px" },
                { key: "conductorMaterial", label: "Material", type: "select", options: [{ value: "cupru", label: "Cu" }, { value: "aluminiu", label: "Al" }], width: "75px" },
                { key: "insulation", label: "Izolatie", type: "select", options: [{ value: "PVC", label: "PVC" }, { value: "XLPE", label: "XLPE" }], width: "85px" },
                { key: "cores", label: "Conductoare", type: "number", width: "90px" },
                { key: "loadedConductors", label: "Incarcate", type: "custom", width: "80px", render: (r, set) => <Select value={String(r.loadedConductors) as "2" | "3"} onChange={(v) => set({ loadedConductors: v === "3" ? 3 : 2 })} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }]} /> },
                { key: "crossSectionMm2", label: "Sectiune", type: "number", suffix: "mm²", width: "100px" },
                { key: "materialId", label: "Material (pret)", type: "select", options: matOpts, nullable: true, width: "200px" },
                { key: "materialQtyPerM", label: "Material / m", type: "number", width: "90px" },
              ]}
            />
          </Card>
          <Card title="Tuburi / copex">
            <EditableTable<ConduitType>
              rows={lib.conduitTypes}
              {...listOps("conduitTypes")}
              onAdd={() => listOps("conduitTypes").add({ id: uid(), name: "Copex nou", diameterMm: 20, materialId: null })}
              cols={[
                { key: "name", label: "Denumire", type: "text" },
                { key: "diameterMm", label: "Diametru", type: "number", suffix: "mm", width: "100px" },
                { key: "materialId", label: "Material (pret)", type: "select", options: matOpts, nullable: true, width: "240px" },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === "aparate" && (
        <Card title="Aparate, puncte si consumatori" subtitle="Puterea sugerata este optionala si editabila pe fiecare punct - aplicatia nu impune o putere standard. Curentii slabi nu primesc putere.">
          <EditableTable<DeviceType>
            rows={lib.deviceTypes}
            {...listOps("deviceTypes")}
            onAdd={() => listOps("deviceTypes").add({ id: uid(), name: "Aparat nou", category: "priza", modules: 2, needsBox: true, suggestedPowerW: null, threePhase: false, brand: "", materialId: null })}
            cols={[
              { key: "name", label: "Denumire", type: "text" },
              { key: "category", label: "Categorie", type: "select", options: ["priza", "intrerupator", "iluminat", "consumator_dedicat", "curenti_slabi", "comanda", "altul"].map((v) => ({ value: v, label: v.replace("_", " ") })), width: "160px" },
              { key: "modules", label: "Module doza", type: "number", width: "90px" },
              { key: "needsBox", label: "In doza", type: "checkbox", width: "65px" },
              { key: "suggestedPowerW", label: "Putere sugerata", type: "number", suffix: "W", width: "120px", nullable: true },
              { key: "threePhase", label: "Trifazat", type: "checkbox", width: "65px" },
              { key: "brand", label: "Producator", type: "text", width: "110px" },
            ]}
          />
        </Card>
      )}

      {tab === "factori" && (
        <div className="space-y-4">
          <Card title="Factori de dificultate" subtitle="Multiplicatori expliciti pentru tarif si timp. Categoriile goale = se aplica la toate operatiile.">
            <EditableTable<DifficultyFactor>
              rows={lib.difficultyFactors}
              {...listOps("difficultyFactors")}
              onAdd={() => listOps("difficultyFactors").add({ id: uid(), name: "Factor nou", valueFactor: 1, timeFactor: 1, appliesToCategories: [], description: "" })}
              cols={[
                { key: "name", label: "Denumire", type: "text" },
                { key: "valueFactor", label: "x Tarif", type: "number", width: "90px" },
                { key: "timeFactor", label: "x Timp", type: "number", width: "90px" },
                { key: "appliesToCategories", label: "Categorii operatii", type: "custom", width: "220px", render: (r, set) => <TextInput value={r.appliesToCategories.join(", ")} placeholder="toate" onChange={(v) => set({ appliesToCategories: v.split(",").map((s) => s.trim()).filter(Boolean) })} /> },
                { key: "description", label: "Descriere", type: "text" },
              ]}
            />
          </Card>
          <Card title="Tipuri de perete">
            <EditableTable<WallType>
              rows={lib.wallTypes}
              {...listOps("wallTypes")}
              onAdd={() => listOps("wallTypes").add({ id: uid(), name: "Perete nou", difficultyFactorId: null })}
              cols={[
                { key: "name", label: "Denumire", type: "text" },
                { key: "difficultyFactorId", label: "Factor asociat", type: "select", options: lib.difficultyFactors.map((f) => ({ value: f.id, label: `${f.name} (x${f.valueFactor} / x${f.timeFactor})` })), nullable: true, width: "320px" },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === "circuite" && (
        <Card title="Tipuri de circuit" subtitle="Setari initiale editabile pentru generarea circuitelor (etapa 2). Nu sunt reguli universale - fiecare circuit se verifica.">
          <EditableTable<CircuitType>
            rows={lib.circuitTypes}
            {...listOps("circuitTypes")}
            onAdd={() => listOps("circuitTypes").add({ id: uid(), name: "Tip nou", usage: "prize", defaultCableTypeId: null, defaultRatingA: null, defaultCurve: "C", defaultSimultaneity: 1, defaultInstallMethodId: null, note: "" })}
            cols={[
              { key: "name", label: "Denumire", type: "text" },
              { key: "usage", label: "Utilizare", type: "select", options: ["iluminat", "prize", "dedicat", "curenti_slabi", "altul"].map((v) => ({ value: v, label: v })), width: "120px" },
              { key: "defaultCableTypeId", label: "Cablu initial", type: "select", options: lib.cableTypes.map((c) => ({ value: c.id, label: c.name })), nullable: true, width: "140px" },
              { key: "defaultRatingA", label: "In initial", type: "number", suffix: "A", nullable: true, width: "90px" },
              { key: "defaultCurve", label: "Curba", type: "select", options: ["B", "C", "D"].map((v) => ({ value: v, label: v })), nullable: true, width: "70px" },
              { key: "defaultSimultaneity", label: "ks", type: "number", width: "70px" },
              { key: "defaultInstallMethodId", label: "Pozare", type: "select", options: lib.installMethods.map((m) => ({ value: m.id, label: m.ref })), nullable: true, width: "80px" },
              { key: "note", label: "Nota", type: "text" },
            ]}
          />
        </Card>
      )}

      {tab === "reguli" && (
        <Card title="Registru reguli tehnice" subtitle="Fiecare regula are sursa, referinta si versiune. Regulile marcate „de validat” nu produc rezultat „Conform” pana la validarea de catre persoana autorizata.">
          <EditableTable<TechnicalRule>
            rows={lib.rules}
            {...listOps("rules")}
            onAdd={() => listOps("rules").add({ id: uid(), code: `R${String(lib.rules.length + 1).padStart(3, "0")}`, title: "Regula noua", classification: "conventie_wattnet", source: "WATTNET", reference: "", version: "1", scope: "", conditions: "", params: {}, validation: "de_validat", validatedBy: "", validatedAt: null, notes: "" })}
            cols={[
              { key: "code", label: "Cod", type: "text", width: "70px" },
              { key: "title", label: "Regula", type: "text" },
              { key: "classification", label: "Clasificare", type: "select", options: [{ value: "cerinta_normativa", label: "Cerinta normativa" }, { value: "standard_tehnic", label: "Standard tehnic" }, { value: "recomandare", label: "Recomandare" }, { value: "conventie_wattnet", label: "Conventie WATTNET" }], width: "160px" },
              { key: "reference", label: "Referinta", type: "text", width: "150px" },
              { key: "params", label: "Parametri", type: "custom", width: "170px", render: (r) => <span className="font-mono text-[11px]">{Object.entries(r.params).map(([k, v]) => `${k}=${v}`).join(" ") || "—"}</span> },
              {
                key: "validation",
                label: "Validare",
                type: "custom",
                width: "220px",
                render: (r, set) => (
                  <div className="flex items-center gap-1">
                    <Select value={r.validation} onChange={(v) => set({ validation: v, validatedAt: v === "validat" ? new Date().toISOString() : null })} options={[{ value: "de_validat", label: "De validat" }, { value: "validat", label: "Validat" }]} />
                    {r.validation === "validat" && <TextInput className="w-24" placeholder="de catre" value={r.validatedBy} onChange={(v) => set({ validatedBy: v })} />}
                  </div>
                ),
              },
            ]}
          />
          <p className="mt-3 text-xs text-ink-3">Sursa: {lib.rules[0]?.source}. Verifica modificarile ulterioare ale normativului (ex. Ordinul 959/2023) si standardele de referinta inainte de validare.</p>
        </Card>
      )}

      {tab === "tabele" && <TablesTab lib={lib} />}

      {tab === "sabloane" && (
        <div className="space-y-4">
          <Card title="Tipuri de incapere">
            <EditableTable
              rows={lib.roomTypes}
              {...listOps("roomTypes")}
              onAdd={() => listOps("roomTypes").add({ id: uid(), name: "Tip nou", defaultHeightM: 2.7, special: false })}
              cols={[
                { key: "name", label: "Denumire", type: "text" },
                { key: "defaultHeightM", label: "Inaltime implicita", type: "number", suffix: "m", width: "140px" },
                { key: "special", label: "Conditii speciale", type: "checkbox", width: "120px" },
              ]}
            />
          </Card>
          <Card title="Sabloane de proiect" subtitle="Folosite la crearea unui proiect nou. Pentru sabloane complete (cu circuite si tarife) exporta un proiect si importa-l „ca sablon”.">
            <Table>
              <thead><tr><th>Sablon</th><th>Tip</th><th>Niveluri si incaperi</th></tr></thead>
              <tbody>
                {lib.templates.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.name}</td>
                    <td>{t.kind}</td>
                    <td className="text-xs text-ink-2">{t.levels.map((l) => `${l.name}: ${l.rooms.map((r) => r.name).join(", ") || "—"}`).join(" | ")}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Import biblioteca">
          <ImportPanel />
        </Card>
        <Card title="Resetare">
          <p className="mb-2 text-sm text-ink-2">Inlocuieste biblioteca {editingProject ? "proiectului" : "globala"} cu valorile exemplu initiale. Exporta inainte daca vrei sa pastrezi modificarile.</p>
          <ConfirmButton size="md" label="Reseteaza la valorile exemplu" onConfirm={() => updateLib((l) => Object.assign(l, createDefaultLibrary()))}>
            Reseteaza biblioteca…
          </ConfirmButton>
        </Card>
      </div>
    </div>
  );
}

function OperationDetails({ lib, updateLib }: { lib: Library; updateLib: (r: (l: Library) => void) => void }) {
  const [id, setId] = useState<string>(lib.operations[0]?.id ?? "");
  const op = lib.operations.find((o) => o.id === id);
  if (!op) return null;
  const set = (patch: Partial<Operation>) => updateLib((l) => { const o = l.operations.find((x) => x.id === id); if (o) Object.assign(o, patch); });
  return (
    <div className="mt-4 rounded-md border border-line bg-paper p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold">Subactiuni si dependente pentru</span>
        <Select className="w-80" value={id} onChange={setId} options={lib.operations.map((o) => ({ value: o.id, label: `${o.code} ${o.name}` }))} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Subactiuni (una pe rand)">
          <TextArea rows={4} value={op.subactions.join("\n")} onChange={(v) => set({ subactions: v.split("\n") })} />
        </Field>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Depinde de (trebuie terminate inainte)</p>
          <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-line bg-white p-2 md:grid-cols-2">
            {lib.operations.filter((o) => o.id !== op.id).map((o) => (
              <Checkbox key={o.id} checked={op.dependsOn.includes(o.id)} label={`${o.code} ${o.name}`} onChange={(on) => set({ dependsOn: on ? [...op.dependsOn, o.id] : op.dependsOn.filter((d) => d !== o.id) })} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FirmTab({ lib, updateLib }: { lib: Library; updateLib: (r: (l: Library) => void) => void }) {
  const f = lib.firm;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => updateLib((l) => void (l.firm[k] = v));
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Card title="Date firma" subtitle="Apar pe coperta dosarului, in oferta si in cartusul schemelor. Preluate initial de pe wattnet.ro - completeaza CUI, Reg. Com. si adresa.">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Nume comercial"><TextInput value={f.name} onChange={(v) => set("name", v)} /></Field>
        <Field label="Denumire legala"><TextInput value={f.legalName} onChange={(v) => set("legalName", v)} /></Field>
        <Field label="Slogan"><TextInput value={f.slogan} onChange={(v) => set("slogan", v)} /></Field>
        <Field label="CUI"><TextInput value={f.cui} onChange={(v) => set("cui", v)} /></Field>
        <Field label="Nr. Reg. Com."><TextInput value={f.regCom} onChange={(v) => set("regCom", v)} /></Field>
        <Field label="IBAN"><TextInput value={f.iban} onChange={(v) => set("iban", v)} /></Field>
        <Field label="Adresa" className="md:col-span-3"><TextInput value={f.address} onChange={(v) => set("address", v)} /></Field>
        <Field label="Email"><TextInput value={f.email} onChange={(v) => set("email", v)} /></Field>
        <Field label="Telefon"><TextInput value={f.phone} onChange={(v) => set("phone", v)} /></Field>
        <Field label="Website"><TextInput value={f.website} onChange={(v) => set("website", v)} /></Field>
        <Field label="Proiectant / electrician"><TextInput value={f.designer} onChange={(v) => set("designer", v)} /></Field>
        <Field label="Autorizatie ANRE nr."><TextInput value={f.anreAuthorization} onChange={(v) => set("anreAuthorization", v)} /></Field>
        <Field label="Grad ANRE"><TextInput value={f.anreGrade} onChange={(v) => set("anreGrade", v)} /></Field>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-line p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-2">TVA si moneda</p>
          <div className="flex flex-wrap items-center gap-4">
            <Checkbox checked={f.vatPayer} onChange={(v) => set("vatPayer", v)} label="Platitor de TVA" />
            {f.vatPayer && <NumberInput className="w-24" value={f.vatRatePct} suffix="%" onChange={(v) => set("vatRatePct", v ?? 0)} />}
            <TextInput className="w-20" value={f.currency} onChange={(v) => set("currency", v)} />
          </div>
          {!f.vatPayer && <p className="mt-2 text-xs text-ink-3">Ofertele vor mentiona „Firma neplatitoare de TVA”.</p>}
        </div>
        <div className="rounded-md border border-line p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Sigla</p>
          <div className="flex items-center gap-3">
            {f.logoDataUrl ? <img src={f.logoDataUrl} alt="logo" className="h-10" /> : <span className="text-xs text-ink-3">Sigla text implicita</span>}
            <input
              ref={ref}
              type="file"
              accept="image/png,image/svg+xml,image/jpeg"
              className="hidden"
              onChange={async (e) => {
                setErr(null);
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 400_000) return setErr("Imaginea depaseste 400 KB.");
                const r = new FileReader();
                r.onload = () => set("logoDataUrl", String(r.result));
                r.readAsDataURL(file);
              }}
            />
            <Button size="sm" onClick={() => ref.current?.click()}>Incarca sigla…</Button>
            {f.logoDataUrl && <Button size="sm" variant="ghost" onClick={() => set("logoDataUrl", "")}>Elimina</Button>}
          </div>
          {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
          <p className="mt-2 text-xs text-ink-3">Pe wattnet.ro sigla nu este publicata ca imagine; incarca fisierul PNG/SVG. Sigla se salveaza in biblioteca si in exportul JSON.</p>
        </div>
      </div>
      <Field label="Note biblioteca" className="mt-4">
        <TextArea rows={2} value={lib.meta.notes} onChange={(v) => updateLib((l) => void (l.meta.notes = v))} />
      </Field>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Field label="Denumire biblioteca"><TextInput value={lib.meta.name} onChange={(v) => updateLib((l) => void (l.meta.name = v))} /></Field>
        <Field label="Versiune biblioteca" hint="ex. 2026.11 - tarife actualizate"><TextInput value={lib.meta.version} onChange={(v) => updateLib((l) => void (l.meta.version = v))} /></Field>
      </div>
    </Card>
  );
}

function TablesTab({ lib }: { lib: Library }) {
  return (
    <div className="space-y-4">
      {lib.ampacityTables.map((t) => {
        const methods = Object.keys(t.values);
        const sections = [...new Set(methods.flatMap((m) => Object.keys(t.values[m])))].sort((a, b) => Number(a) - Number(b));
        return (
          <Card key={t.id} title={`Curenti admisibili Iz (A) - ${t.name}`} subtitle={`${t.source}, ${t.reference}`} actions={<Badge tone={t.validation === "validat" ? "ok" : "warn"}>{t.validation === "validat" ? "validat" : "de validat"}</Badge>}>
            <Table>
              <thead><tr><th>Sectiune (mm²)</th>{methods.map((m) => <th key={m} className="num">{m}</th>)}</tr></thead>
              <tbody>
                {sections.map((s) => (
                  <tr key={s}><td className="font-medium">{s.replace(".", ",")}</td>{methods.map((m) => <td key={m} className="num">{t.values[m][s] ?? "—"}</td>)}</tr>
                ))}
              </tbody>
            </Table>
          </Card>
        );
      })}
      <div className="grid gap-4 md:grid-cols-3">
        {lib.correctionTables.map((t) => (
          <Card key={t.id} title={t.name} subtitle={`${t.source}, ${t.reference}`} actions={<Badge tone="warn">de validat</Badge>}>
            <Table>
              <tbody>
                {Object.entries(t.values).map(([k, v]) => (
                  <tr key={k}><td>{k}</td><td className="num">{String(v).replace(".", ",")}</td></tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))}
      </div>
      <p className="text-xs text-ink-3">Tabelele vor fi folosite de motorul de dimensionare in etapa 3 (Ic ≤ I&apos;z = Iz x K1 x K2). Verifica valorile cu anexele din normativ inainte de a le marca validate.</p>
    </div>
  );
}
