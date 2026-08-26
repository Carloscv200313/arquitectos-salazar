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

export const PROJECT_RESPONSIBLES = [
  "Alejandra",
  "Juanfer",
  "Juan Jose",
  "Esmeralda",
] as const;

// Valor para áreas sin responsable asignado.
export const UNASSIGNED_RESPONSIBLE = "Sin asignar";

// Opciones de los selectores: personas + "Sin asignar".
export const RESPONSIBLE_OPTIONS = [
  ...PROJECT_RESPONSIBLES,
  UNASSIGNED_RESPONSIBLE,
] as const;

export const SALARY_ASSIGNMENT_LABELS = {
  project: "PROYECTO",
  work: "OBRA",
  week: "SEMANA",
  hour: "HORA",
  absent: "NO ASISTIÓ",
  pending: "PENDIENTE",
} as const;

export const SALARY_WEEKDAY_LABELS = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
} as const;

export const SALARY_WEEK_STATUSES = ["draft", "paid"] as const;

export const SALARY_WEEK_STATUS_LABELS = {
  draft: "Pendiente",
  paid: "Pagada",
} as const;

export const SALARY_ACTIVITY_TYPES = [
  "project",
  "work",
  "week",
  "hour",
  "absent",
  "pending",
] as const;

export const SALARY_ACTIVITY_FORM_TYPES = [
  "project",
  "week",
  "hour",
] as const;

export const SALARY_PAYMENT_TYPES = [
  "week",
  "project",
  "work",
  "bonus",
  "discount",
  "advance",
  "adjustment",
] as const;

export const SALARY_PAYMENT_TYPE_LABELS = {
  week: "Pago semana",
  project: "Pago proyecto",
  work: "Pago obra",
  bonus: "Bono",
  discount: "Descuento",
  advance: "Adelanto",
  adjustment: "Ajuste manual",
} as const;

export const EMPLOYEE_DEFAULT_WORK_TYPES = [
  "project",
  "work",
  "mixed",
  "week",
] as const;

export const EMPLOYEE_DEFAULT_WORK_TYPE_LABELS = {
  project: "Proyecto",
  work: "Obra",
  mixed: "Mixto",
  week: "Semana",
} as const;

export const TASK_MODULE_TYPES = ["project", "work", "general"] as const;

export const TASK_TYPE_SEED = [
  { name: "Propuesta", moduleType: "project" },
  { name: "Modelado 3D", moduleType: "project" },
  { name: "Planos", moduleType: "project" },
  { name: "Render", moduleType: "project" },
  { name: "Costos", moduleType: "project" },
  { name: "Supervisión", moduleType: "work" },
  { name: "Obra", moduleType: "work" },
  { name: "Otro", moduleType: "general" },
] as const;

export const SALARY_RECORD_STATUSES = ["draft", "recorded", "observed"] as const;

export const SALARY_RECORD_STATUS_LABELS = {
  draft: "Borrador",
  recorded: "Registrado",
  observed: "Observado",
} as const;

export const SALARY_PAYMENT_STATUSES = ["paid"] as const;

export const SALARY_PAYMENT_STATUS_LABELS = {
  paid: "Pagado",
} as const;

export const SALARY_PAYMENT_METHOD_NAMES = ["Caja", "Cuenta de Rosa"] as const;

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

export const WORK_STATUSES = ["active", "finished"] as const;

export const WORK_FILTER_STATUSES = ["active", "debtor", "finished"] as const;

export const WORK_STATUS_LABELS = {
  active: "Activa",
  debtor: "Por cobrar",
  finished: "Finalizada",
} as const;

export const WORK_CATEGORIES = [
  "Carpintería",
  "Material de construcción",
  "Material de obras",
  "Instalaciones",
  "Maquinaria",
  "Equipo y herramientas",
  "Herrería Arquitectónica",
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

export const WORK_INCOME_CATEGORY = "Abono de obra" as const;

export const WORK_EXPENSE_CATEGORIES = WORK_CATEGORIES.filter(
  (category) => category !== WORK_INCOME_CATEGORY,
);

export const WORK_PROVIDERS = [
  "Estribadora",
  "Concretos LOPAR",
  "Materiales Aguilar",
  "Mat. Gonzalez",
  "Mat. Quezada",
  "Caracol Betania",
  "Caracol Ayotlán",
  "Alfarería León",
  "Logonza",
  "Maderería Paisa",
  "Master Block",
] as const;

export const WORK_FILES_BUCKET = "work-files" as const;
export const WORK_FILE_MAX_BYTES = 15 * 1024 * 1024;

export const CURRENCY = "MXN";
export const LOCALE = "es-MX";
