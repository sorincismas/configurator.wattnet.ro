import type { BoxKind, Library } from "../model/types";

/** tipul de aparat preselectat: marcat "implicit" in biblioteca, altfel priza simpla */
export function defaultDeviceTypeId(lib: Library): string {
  return (lib.deviceTypes.find((d) => d.isDefault) ?? lib.deviceTypes.find((d) => d.id === "dt-priza") ?? lib.deviceTypes[0])?.id ?? "";
}

/** tipul de doza preselectat pentru DA / DD */
export function defaultBoxTypeId(lib: Library, kind: BoxKind): string {
  const list = lib.boxTypes.filter((b) => b.kind === kind);
  const fallback = kind === "DA" ? "bt-da-rot" : "bt-dd-100";
  return (list.find((b) => b.isDefault) ?? list.find((b) => b.id === fallback) ?? list[0])?.id ?? "";
}
