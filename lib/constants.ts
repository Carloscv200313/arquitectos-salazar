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

// ── Plantillas (templates) ───────────────────────────────────────────────────
// Las 4 áreas internas reparten la porción "Proyecto" = 50% del monto base.
// Los pesos de cada plantilla suman 1 (100% de esa porción).
export const PROYECTO_RATE = 0.5;

export type ProjectTemplate = "diamante" | "oro" | "especial";

export type SliceWeights = Record<ProjectSliceKey, number>;

export const TEMPLATE_WEIGHTS: Record<"diamante" | "oro", SliceWeights> = {
  diamante: { proposal: 0.2, modeling_3d: 0.33, plans: 0.33, render: 0.14 },
  oro: { proposal: 0.2, modeling_3d: 0.3, plans: 0.35, render: 0.15 },
};

export const TEMPLATE_LABELS: Record<ProjectTemplate, string> = {
  diamante: "Diamante",
  oro: "Oro",
  especial: "Especial",
};

export const PROJECT_TEMPLATES: {
  id: ProjectTemplate;
  label: string;
  description: string;
  weights: SliceWeights | null; // null = el usuario define (especial)
}[] = [
  {
    id: "diamante",
    label: "Diamante",
    description: "Distribución estándar de la empresa.",
    weights: TEMPLATE_WEIGHTS.diamante,
  },
  {
    id: "oro",
    label: "Oro",
    description: "Mayor peso en planos y render.",
    weights: TEMPLATE_WEIGHTS.oro,
  },
  {
    id: "especial",
    label: "Especial",
    description: "Define tú mismo el peso de cada área (debe sumar 100%).",
    weights: null,
  },
];

/** Devuelve los pesos de una plantilla. Para especial usa los provistos. */
export function resolveTemplateWeights(
  template: ProjectTemplate,
  custom?: SliceWeights,
): SliceWeights {
  if (template === "especial") {
    return custom ?? TEMPLATE_WEIGHTS.diamante;
  }
  return TEMPLATE_WEIGHTS[template];
}

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

export const WORK_STATUSES = ["active", "paused", "finished"] as const;

export const WORK_STATUS_LABELS = {
  active: "Activa",
  paused: "Pausada",
  finished: "Finalizada",
} as const;

export const WORK_CATEGORIES = [
  "Carpintería",
  "Material de construcción",
  "Material de obras",
  "Instalaciones",
  "Maquinaria",
  "Equipo y herramientas",
  "Herrería",
  "Aluminio",
  "Tabla roca",
  "Abono de obra",
  "Honorarios",
  "Servicio",
  "Pintura",
  "Cantera",
  "Granito",
  "Yeso",
] as const;

export const CURRENCY = "MXN";
export const LOCALE = "es-MX";
