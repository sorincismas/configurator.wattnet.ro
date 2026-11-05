import { computeInventory, type Inventory, type QuantityWithSource } from "./inventory";
import {
  STAGE_ORDER,
  type ExecutionStage,
  type LaborOperation,
  type PricingSettings,
  type Project,
  type QuantitySource,
} from "./types";

export type PriceMethod = "tarif-unitar" | "timp-x-tarif-orar" | "lipsa-tarif";

export type QuoteLine = {
  operationId: string;
  name: string;
  unit: string;
  stage: ExecutionStage;
  quantity: number;
  /** Partea din cantitate care provine din estimari (ex. trasee nemasurate). */
  estimatedQuantity: number;
  unitPrice: number | null;
  minutes: number | null;
  amount: number | null;
  method: PriceMethod;
};

export type Quote = {
  lines: QuoteLine[];
  /** Linii cu cantitate > 0 fara tarif: totalul este incomplet. */
  unpricedLines: QuoteLine[];
  laborSubtotal: number;
  discountPct: number;
  discount: number;
  netTotal: number;
  vatPct: number;
  vat: number;
  grandTotal: number;
  totalMinutes: number;
  complete: boolean;
  inventory: Inventory;
};

export function quantityFor(src: QuantitySource, inv: Inventory): QuantityWithSource {
  const plain = (n: number): QuantityWithSource => ({ total: n, measured: n, estimated: 0 });
  switch (src.kind) {
    case "points":
      return plain(inv.points[src.point] ?? 0);
    case "pointsTotal":
      return plain(inv.pointsTotal);
    case "boxes":
      return plain(
        Object.entries(inv.boxes)
          .filter(([key]) => {
            const [wall, size] = key.split("|");
            return size === src.size && (!src.wall || wall === src.wall);
          })
          .reduce((t, [, n]) => t + n, 0),
      );
    case "routeM":
      return inv.routeM;
    case "ledStripM":
      return plain(inv.ledStripM);
    case "panels":
      return plain(inv.panels);
    case "secondaryPanels":
      return plain(inv.secondaryPanels);
    case "feederM":
      return inv.feederM;
    case "devices":
      return plain(inv.devices);
    case "deviceModules":
      return plain(inv.deviceModules);
    case "trips":
      return plain(0); // completat din proiect in computeQuote
    case "fixed":
      return plain(src.quantity);
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function priceLine(
  op: LaborOperation,
  qty: QuantityWithSource,
  hourlyRate: number | null | undefined,
): QuoteLine {
  const minutes = op.minutesPerUnit != null && op.minutesPerUnit >= 0 ? op.minutesPerUnit : null;
  let unitPrice: number | null = null;
  let method: PriceMethod = "lipsa-tarif";

  if (op.unitPrice != null && op.unitPrice >= 0) {
    unitPrice = op.unitPrice;
    method = "tarif-unitar";
  } else if (minutes != null && hourlyRate != null && hourlyRate > 0) {
    unitPrice = round2((minutes / 60) * hourlyRate);
    method = "timp-x-tarif-orar";
  }

  return {
    operationId: op.id,
    name: op.name,
    unit: op.unit,
    stage: op.stage,
    quantity: round2(qty.total),
    estimatedQuantity: round2(qty.estimated),
    unitPrice,
    minutes,
    amount: unitPrice == null ? null : round2(qty.total * unitPrice),
    method,
  };
}

export function computeQuote(project: Project, settings: PricingSettings): Quote {
  const inventory = computeInventory(project, settings.defaultRouteMPerPoint);

  const lines = settings.operations
    .filter((op) => op.enabled)
    .map((op) => {
      const qty =
        op.quantity.kind === "trips"
          ? { total: Math.max(0, project.trips || 0), measured: 0, estimated: 0 }
          : quantityFor(op.quantity, inventory);
      return priceLine(op, qty, settings.hourlyRate);
    })
    .filter((l) => l.quantity > 0)
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));

  const unpricedLines = lines.filter((l) => l.amount == null);
  const laborSubtotal = round2(lines.reduce((s, l) => s + (l.amount ?? 0), 0));
  const discountPct = clampPct(project.discountPct);
  const discount = round2((laborSubtotal * discountPct) / 100);
  const netTotal = round2(laborSubtotal - discount);
  const vatPct = clampPct(project.vatPct);
  const vat = round2((netTotal * vatPct) / 100);

  return {
    lines,
    unpricedLines,
    laborSubtotal,
    discountPct,
    discount,
    netTotal,
    vatPct,
    vat,
    grandTotal: round2(netTotal + vat),
    totalMinutes: lines.reduce((s, l) => s + (l.minutes ?? 0) * l.quantity, 0),
    complete: unpricedLines.length === 0,
    inventory,
  };
}

export type PlanStage = {
  stage: ExecutionStage;
  lines: QuoteLine[];
  minutes: number;
  /** Linii fara timp standard: durata etapei e incompleta. */
  missingTime: number;
};

export function executionPlan(quote: Quote): PlanStage[] {
  return STAGE_ORDER.map((stage) => {
    const lines = quote.lines.filter((l) => l.stage === stage);
    return {
      stage,
      lines,
      minutes: lines.reduce((s, l) => s + (l.minutes ?? 0) * l.quantity, 0),
      missingTime: lines.filter((l) => l.minutes == null).length,
    };
  }).filter((s) => s.lines.length > 0);
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}
