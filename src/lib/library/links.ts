/**
 * Legatura operatie -> elemente din catalog (sursa cantitatii „din fila ...”).
 * Operatia tine lista elementelor la care se aplica (itemIds); un element poate
 * aparea la mai multe operatii (ex. executare locas + montare doza).
 */
import type { Library, Operation, QuantityDriver } from "../model/types";

export type LinkList = "boxTypes" | "deviceTypes" | "cableTypes" | "conduitTypes" | "enclosureTypes" | "protectionDevices";

export const LINK_LIST: Partial<Record<QuantityDriver, LinkList>> = {
  box_type_op: "boxTypes",
  device_type_op: "deviceTypes",
  device_install_op: "deviceTypes",
  cable_type_op: "cableTypes",
  conduit_type_op: "conduitTypes",
  enclosure_type_op: "enclosureTypes",
  protection_type_op: "protectionDevices",
};

/** campul vechi (legatura tinuta pe element) din care se construieste lista la migrare */
const OLD_FIELD: Partial<Record<QuantityDriver, "operationId" | "installOperationId">> = {
  box_type_op: "operationId",
  device_type_op: "operationId",
  device_install_op: "installOperationId",
  cable_type_op: "operationId",
  conduit_type_op: "operationId",
  enclosure_type_op: "operationId",
  protection_type_op: "operationId",
};

export const linkItems = (lib: Library, op: Pick<Operation, "driver">): { id: string; name: string }[] => {
  const list = LINK_LIST[op.driver];
  return list ? (lib[list] as unknown as { id: string; name: string }[]) : [];
};

/** operatiile active de un anumit fel care se aplica unui element */
export const opsForItem = (lib: Library, driver: QuantityDriver, itemId: string | null | undefined): Operation[] =>
  itemId ? lib.operations.filter((o) => o.active && o.driver === driver && (o.itemIds ?? []).includes(itemId)) : [];

/** aduce biblioteca la modelul cu lista pe operatie (o singura data pentru fiecare operatie) */
export function normalizeLinks(lib: Library): Library {
  for (const op of lib.operations) {
    // locasul de doza devine operatie legata de tipurile de doza ingropate, ca sa poata fi diferentiat pe module
    if (op.driver === "box_recesses") {
      op.driver = "box_type_op";
      op.itemIds = lib.boxTypes.filter((t) => t.shape !== "aparenta" && t.shape !== "etansa").map((t) => t.id);
      continue;
    }
    const list = LINK_LIST[op.driver];
    const field = OLD_FIELD[op.driver];
    if (!list || !field || op.itemIds !== undefined) continue;
    op.itemIds = (lib[list] as unknown as Record<string, unknown>[]).filter((x) => x[field] === op.id).map((x) => x.id as string);
  }
  return lib;
}
