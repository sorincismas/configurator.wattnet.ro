/**
 * Export / import JSON pentru proiecte si biblioteca.
 * Fisierele poarta format + schemaVersion; la import se valideaza
 * structura si se aplica migrarile necesare.
 */
import { z } from "zod";
import { createDefaultLibrary, DEFAULTS_REV } from "../library/default-library";
import { uid } from "../model/ids";
import { defaultFastSettings, nowISO, projectCode } from "../model/factory";
import { SCHEMA_VERSION, type Library, type LibraryFile, type Project, type ProjectFile } from "../model/types";

export const APP_ID = "configurator.wattnet.ro@0.1";

const arr = z.array(z.any());

const libraryShape = z
  .object({
    meta: z.object({ name: z.string(), version: z.string() }).passthrough(),
    firm: z.object({ name: z.string() }).passthrough(),
    operations: arr,
    materials: arr,
  })
  .passthrough();

const projectShape = z
  .object({
    id: z.string(),
    schemaVersion: z.number(),
    info: z.object({ code: z.string(), name: z.string() }).passthrough(),
    supply: z.object({ system: z.enum(["mono", "tri"]) }).passthrough(),
    counters: z.record(z.string(), z.number()),
    buildings: arr,
    levels: arr,
    rooms: arr,
    boxes: arr,
    devices: arr,
    circuits: arr,
    routes: arr,
    cables: arr,
    panels: arr,
    library: libraryShape,
  })
  .passthrough();

const projectFileShape = z.object({ format: z.literal("wattnet-proiect"), schemaVersion: z.number(), project: projectShape }).passthrough();
const libraryFileShape = z.object({ format: z.literal("wattnet-biblioteca"), schemaVersion: z.number(), library: libraryShape }).passthrough();

/* ------------------------------ migrari ---------------------------- */

/**
 * Completeaza campurile adaugate in versiuni noi cu valori implicite, ca
 * fisierele vechi sa se deschida si dupa actualizarea aplicatiei.
 */
export function migrateLibrary(input: Partial<Library>): Library {
  const def = createDefaultLibrary();
  const out = { ...def, ...input } as Library;
  // elemente noi adaugate de aplicatie: se completeaza o singura data, pe revizie
  // (daca utilizatorul sterge ulterior un element, acesta nu mai revine)
  const rev = input.meta?.defaultsRev ?? 1;
  if (rev < DEFAULTS_REV) {
    const keys = ["rules", "operations", "protectionDevices", "materials", "cableTypes", "conduitTypes", "boxTypes", "deviceTypes", "circuitTypes", "enclosureTypes", "difficultyFactors"] as const;
    for (const k of keys) {
      const cur = (Array.isArray(out[k]) ? out[k] : []) as { id: string }[];
      for (const item of def[k] as { id: string }[]) if (!cur.some((x) => x.id === item.id)) cur.push(structuredClone(item));
      (out as unknown as Record<string, unknown>)[k] = cur;
    }
    if (rev < 5) {
      // faza la rosu: cablu NYY-J ingropat direct ca implicit pe prize / iluminat (doar daca tipul era cel implicit vechi)
      for (const c of out.circuitTypes) {
        const d = def.circuitTypes.find((x) => x.id === c.id);
        if (d && (c.defaultCableTypeId === "ct-fy3x15" || c.defaultCableTypeId === "ct-fy3x25")) {
          c.defaultCableTypeId = d.defaultCableTypeId;
          if (c.defaultInstallMethodId === "im-b1") c.defaultInstallMethodId = d.defaultInstallMethodId;
        }
      }
      for (const t of out.deviceTypes) {
        const d = def.deviceTypes.find((x) => x.id === t.id);
        if (d?.shortcut && !t.shortcut) t.shortcut = d.shortcut;
        if (d && t.suggestedPowerW === null && d.suggestedPowerW !== null) t.suggestedPowerW = d.suggestedPowerW;
      }
    }
    if (rev < 4) for (const o of out.operations) if (o.id === "op-conectare-circuit" && o.driver === "circuits") o.driver = "new_circuits";
    // regulile existente cu referinte provizorii primesc textul nou
    for (const r of out.rules) {
      const d = def.rules.find((x) => x.id === r.id);
      if (d && r.validation === "de_validat" && (r.reference.startsWith("de completat") || r.id === "r-sectiune-min")) Object.assign(r, { title: d.title, reference: d.reference, params: d.params, conditions: d.conditions });
    }
  }
  out.firm = { ...def.firm, ...(input.firm ?? {}) };
  out.meta = { ...def.meta, ...(input.meta ?? {}), defaultsRev: DEFAULTS_REV };
  for (const k of Object.keys(def) as (keyof Library)[]) {
    if (Array.isArray(def[k]) && !Array.isArray(out[k])) (out as unknown as Record<string, unknown>)[k] = def[k];
  }
  return out;
}

export function migrateProject(input: Project): Project {
  const p = structuredClone(input);
  p.library = migrateLibrary(p.library);
  for (const d of p.devices ?? []) {
    d.circuitLocked ??= false;
    d.junctionBoxId ??= null;
  }
  p.issued ??= [];
  p.history ??= [];
  p.measurements ??= [];
  p.register ??= [];
  p.operationOverrides ??= [];
  p.extraCosts ??= [];
  p.planOverrides ??= [];
  p.lastExportedAt ??= null;
  // proiectele vechi foloseau copex: estimarea rapida se activeaza fara a schimba traseele existente
  p.fast = { ...defaultFastSettings(false), ...(p.fast ?? {}) };
  p.schemaVersion = SCHEMA_VERSION;
  return p;
}

/* ------------------------------ export ----------------------------- */

export function projectToFile(p: Project): ProjectFile {
  return { format: "wattnet-proiect", schemaVersion: SCHEMA_VERSION, exportedAt: nowISO(), app: APP_ID, project: p };
}

export function libraryToFile(lib: Library): LibraryFile {
  return { format: "wattnet-biblioteca", schemaVersion: SCHEMA_VERSION, exportedAt: nowISO(), app: APP_ID, library: lib };
}

export const safeFileName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80) || "fisier";

export function projectFileName(p: Project): string {
  const d = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return `${safeFileName(p.info.code)}_${safeFileName(p.info.name)}_${d}.wattnet.json`;
}

export function libraryFileName(lib: Library): string {
  const d = new Date().toISOString().slice(0, 10);
  return `biblioteca_${safeFileName(lib.meta.version)}_${d}.wattnet-lib.json`;
}

/* ------------------------------ import ----------------------------- */

export type ImportResult =
  | { ok: true; kind: "project"; project: Project; warnings: string[] }
  | { ok: true; kind: "library"; library: Library; warnings: string[] }
  | { ok: false; error: string };

export function parseImport(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "Fisierul nu este JSON valid." };
  }
  const fmt = (data as { format?: string })?.format;
  const warnings: string[] = [];
  if (fmt === "wattnet-proiect") {
    const r = projectFileShape.safeParse(data);
    if (!r.success) return { ok: false, error: "Structura proiectului este invalida: " + r.error.issues.slice(0, 3).map((i) => i.path.join(".") + " " + i.message).join("; ") };
    if (r.data.schemaVersion > SCHEMA_VERSION) return { ok: false, error: `Fisierul a fost creat cu o versiune mai noua a aplicatiei (format ${r.data.schemaVersion}). Actualizeaza aplicatia.` };
    if (r.data.schemaVersion < SCHEMA_VERSION) warnings.push(`Fisier format ${r.data.schemaVersion}, migrat la ${SCHEMA_VERSION}.`);
    return { ok: true, kind: "project", project: migrateProject(r.data.project as unknown as Project), warnings };
  }
  if (fmt === "wattnet-biblioteca") {
    const r = libraryFileShape.safeParse(data);
    if (!r.success) return { ok: false, error: "Structura bibliotecii este invalida." };
    if (r.data.schemaVersion > SCHEMA_VERSION) return { ok: false, error: "Biblioteca a fost creata cu o versiune mai noua a aplicatiei." };
    return { ok: true, kind: "library", library: migrateLibrary(r.data.library as unknown as Library), warnings };
  }
  return { ok: false, error: "Fisierul nu este un proiect sau o biblioteca WATTNET." };
}

/**
 * Proiect importat folosit ca SABLON: id nou, cod nou, fara date de client,
 * fara versiuni emise, masuratori sau istoric. Structura, tarifele si
 * biblioteca raman.
 */
export function projectAsTemplate(src: Project, seq: number): Project {
  const p = structuredClone(src);
  const now = nowISO();
  p.id = uid();
  p.info.code = projectCode(seq);
  p.info.name = `${src.info.name} (copie)`;
  p.info.client = { name: "", phone: "", email: "", address: "", notes: "" };
  p.info.location = "";
  p.info.status = "ciorna";
  p.issued = [];
  p.measurements = [];
  p.register = [];
  p.createdAt = now;
  p.updatedAt = now;
  p.lastExportedAt = null;
  p.history = [{ at: now, action: "creare", detail: `Creat din sablonul ${src.info.code} - ${src.info.name}` }];
  return p;
}

/** descarcare in browser */
export function downloadJSON(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileText(file: File): Promise<string> {
  return file.text();
}
