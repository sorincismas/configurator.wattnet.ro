import { describe, expect, it } from "vitest";
import { createDefaultLibrary } from "@/lib/library/default-library";
import { catalogDiffers, syncCatalogs } from "@/lib/library/sync";

describe("sincronizare biblioteca globala -> proiect", () => {
  it("tipurile noi de aparate si doze apar in proiect; tarifele si preturile existente nu se schimba", () => {
    const project = createDefaultLibrary();
    const global = createDefaultLibrary();
    global.deviceTypes.push({ id: "x-priza-legrand", name: "Priza Legrand Valena", category: "priza", modules: 2, needsBox: true, suggestedPowerW: null, threePhase: false, brand: "Legrand", materialId: "x-mat" });
    global.boxTypes.push({ id: "x-doza", name: "Doza Gewiss GW24 3M", kind: "DA", shape: "modulara", modules: 3, brand: "Gewiss", materialId: "x-mat", operationId: "op-doza-mod" });
    global.materials.push({ id: "x-mat", code: "", name: "Material nou", category: "doze", brand: "", unit: "buc", purchasePrice: 5, markupPct: 20, supplier: "", validUntil: null, isExample: false });
    global.operations[0].rate = 999; // tarif schimbat global
    global.materials[0].purchasePrice = 999; // pret schimbat global
    global.deviceTypes[0].name = "Priza simpla (redenumita)";
    expect(catalogDiffers(project, global)).toBe(true);
    const next = syncCatalogs(project, global);
    expect(next.deviceTypes.some((d) => d.id === "x-priza-legrand")).toBe(true);
    expect(next.boxTypes.some((b) => b.id === "x-doza")).toBe(true);
    expect(next.materials.some((m) => m.id === "x-mat")).toBe(true);
    expect(next.deviceTypes[0].name).toBe("Priza simpla (redenumita)");
    expect(next.operations[0].rate).toBe(project.operations[0].rate);
    expect(next.materials[0].purchasePrice).toBe(project.materials[0].purchasePrice);
    expect(catalogDiffers(next, global)).toBe(false);
  });
  it("elementele doar din proiect se pastreaza", () => {
    const project = createDefaultLibrary();
    project.boxTypes.push({ id: "local", name: "Doza locala", kind: "DD", shape: "aparenta", modules: 0, brand: "", materialId: null, operationId: null });
    const next = syncCatalogs(project, createDefaultLibrary());
    expect(next.boxTypes.some((b) => b.id === "local")).toBe(true);
  });
});
