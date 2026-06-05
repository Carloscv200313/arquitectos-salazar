// Centralized business configuration.
// Change percentages here and the whole system follows — never hardcode these elsewhere.

export const MARKUP = {
  office: 0.2,
  utility: 0.3,
} as const;

/**
 * Internal distribution of the project BASE amount.
 * Must sum to 1.
 */
export const PROJECT_DISTRIBUTION = {
  proposal: 0.2,
  modeling_3d: 0.33,
  plans: 0.33,
  render: 0.14,
} as const;

export type MarkupKey = keyof typeof MARKUP;
export type ProjectSliceKey = keyof typeof PROJECT_DISTRIBUTION;

export const MARKUP_TOTAL_RATE = Object.values(MARKUP).reduce((a, b) => a + b, 0);

export const PROJECT_BASE_LABEL = "Monto del proyecto";
export const PROJECT_MARKUP_LABEL = "Proyecto";

export const MARKUP_LABELS: Record<MarkupKey, string> = {
  office: "Oficina",
  utility: "Utilidad",
};

export const PROJECT_SLICE_LABELS: Record<ProjectSliceKey, string> = {
  proposal: "Propuesta",
  modeling_3d: "Modelado 3D",
  plans: "Planos",
  render: "Render",
};

// Seed payment methods (mirror of the `payment_methods` table defaults).
export const SEED_PAYMENT_METHODS = [
  "Cuentas por pagar",
  "Efectivo",
  "Caja",
  "Cuenta de Rosa",
  "Cuenta de Silvia",
  "Cuenta fiscal",
] as const;

export const PAYMENT_STATUS_LABELS = {
  pending: "Sin ingresos",
  partial: "Cobro parcial",
  paid: "Cobrado",
} as const;

export const MOVEMENT_TYPE_LABELS = {
  income: "Ingreso",
  expense: "Egreso",
} as const;

export const CURRENCY = "USD";
export const LOCALE = "es-PE";
