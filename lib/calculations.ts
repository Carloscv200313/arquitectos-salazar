// Pure financial helpers. No I/O, no framework — easy to unit test and reuse.

import {
  MARKUP,
  PROJECT_DISTRIBUTION,
  type MarkupKey,
  type ProjectSliceKey,
} from "./constants";
import type {
  MovementType,
  ProjectFinance,
  ProjectPayment,
  PaymentStatus,
} from "./types";

/** Round to 2 decimals avoiding binary float drift (e.g. 1.005). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Split `total` across the given weights (which must sum to 1).
 * The last bucket absorbs any rounding remainder so the parts always re-sum to `total`.
 */
function splitAmount<K extends string>(
  total: number,
  weights: Record<K, number>,
): Record<K, number> {
  const keys = Object.keys(weights) as K[];
  const result = {} as Record<K, number>;
  let allocated = 0;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      result[key] = round2(total - allocated);
    } else {
      const part = round2(total * weights[key]);
      result[key] = part;
      allocated = round2(allocated + part);
    }
  });
  return result;
}

export type MarkupAmounts = Record<MarkupKey, number>;
export type ProjectDistribution = Record<ProjectSliceKey, number>;

export interface Addon {
  concept: string;
  amount: number;
}

/** Markup amounts (office / utility) computed as percentages OF the base. */
export function computeMarkup(base: number): MarkupAmounts {
  const result = {} as MarkupAmounts;
  (Object.keys(MARKUP) as MarkupKey[]).forEach((k) => {
    result[k] = round2(base * MARKUP[k]);
  });
  return result;
}

/** Internal split of the project base: proposal / modeling / plans / render. */
export function distributeProject(base: number): ProjectDistribution {
  return splitAmount(base, PROJECT_DISTRIBUTION);
}

export function sumAddons(addons: Pick<Addon, "amount">[]): number {
  return round2(addons.reduce((s, a) => s + (a.amount || 0), 0));
}

export interface ProjectBreakdown {
  base: number; // project base amount (input)
  markup: MarkupAmounts; // deprecated in UI, kept for storage compatibility
  markupTotal: number; // deprecated in UI, kept for storage compatibility
  subtotal: number; // base amount before addons
  addonsTotal: number; // sum of additional line items
  total: number; // subtotal + addonsTotal  (amount the client pays)
  project: ProjectDistribution; // internal split of the base
}

/** Full breakdown from a project base amount + additional line items. */
export function computeBreakdown(
  base: number,
  addons: Pick<Addon, "amount">[] = [],
): ProjectBreakdown {
  const safeBase = Number.isFinite(base) && base > 0 ? round2(base) : 0;
  const markup = computeMarkup(safeBase);
  const markupTotal = round2(
    (Object.values(markup) as number[]).reduce((a, b) => a + b, 0),
  );
  const subtotal = round2(safeBase);
  const addonsTotal = sumAddons(addons);
  const total = round2(subtotal + addonsTotal);
  return {
    base: safeBase,
    markup,
    markupTotal,
    subtotal,
    addonsTotal,
    total,
    project: distributeProject(safeBase),
  };
}

/** Sum of all registered payments for a project. */
export function totalByType(
  payments: Pick<ProjectPayment, "amount" | "movement_type">[],
  type: MovementType,
): number {
  return round2(
    payments.reduce(
      (sum, p) => sum + ((p.movement_type ?? "income") === type ? p.amount || 0 : 0),
      0,
    ),
  );
}

export function paymentStatus(total: number, income: number): PaymentStatus {
  if (income <= 0) return "pending";
  if (income >= total) return "paid";
  return "partial";
}

/** Computed finance snapshot for a project given its total + payments. */
export function computeFinance(
  total: number,
  payments: Pick<ProjectPayment, "amount" | "movement_type">[],
): ProjectFinance {
  const income = totalByType(payments, "income");
  const expense = totalByType(payments, "expense");
  const paid = income;
  const pending = round2(Math.max(total - income, 0));
  const collectionPercentage =
    total > 0 ? Math.min(round2((income / total) * 100), 100) : 0;
  const net = round2(income - expense);
  return {
    total: round2(total),
    income,
    expense,
    paid,
    pending,
    net,
    collectionPercentage,
    paidPercentage: collectionPercentage,
    status: paymentStatus(total, income),
  };
}
