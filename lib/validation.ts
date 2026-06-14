import { z } from "zod";
import { computeBreakdown } from "./calculations";
import {
  EMPLOYEE_DEFAULT_WORK_TYPES,
  PROJECT_DISTRIBUTION,
  RESPONSIBLE_OPTIONS,
  SALARY_ACTIVITY_TYPES,
  SALARY_PAYMENT_STATUSES,
  SALARY_PAYMENT_TYPES,
  SALARY_RECORD_STATUSES,
  SALARY_WEEK_STATUSES,
  SALARY_WEEKDAY_LABELS,
  TASK_MODULE_TYPES,
  WORK_INCOME_CATEGORY,
  WORK_STATUSES,
} from "./constants";

// Reusable money field: positive, finite, max 2 decimals.
const money = z
  .number({ error: "Ingresa un monto válido" })
  .finite("Monto inválido")
  .positive("El monto debe ser mayor a 0")
  .max(1_000_000_000, "Monto demasiado alto")
  .refine((n) => Math.round(n * 100) === n * 100, "Máximo 2 decimales");

const name = z
  .string()
  .trim()
  .min(2, "Mínimo 2 caracteres")
  .max(120, "Máximo 120 caracteres");

const concept = z
  .string()
  .trim()
  .min(2, "Ingresa un concepto")
  .max(160, "Máximo 160 caracteres");

// Domicilio / dirección de la obra (opcional).
const address = z
  .string()
  .trim()
  .max(200, "Máximo 200 caracteres")
  .optional()
  .or(z.literal(""));

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .refine((d) => !Number.isNaN(new Date(d).getTime()), "Fecha inválida");

// Additional line item (levantamiento, etc.)
export const addonSchema = z.object({
  concept,
  amount: money,
});

const addons = z.array(addonSchema).max(20, "Demasiados adicionales").default([]);

// Template weights for the 4 internal areas (fractions summing to 1).
export const sliceWeightsSchema = z.object({
  proposal: z.number().min(0).max(1),
  modeling_3d: z.number().min(0).max(1),
  plans: z.number().min(0).max(1),
  render: z.number().min(0).max(1),
});

export const projectResponsiblesSchema = z.object({
  proposal: z.enum(RESPONSIBLE_OPTIONS),
  modeling_3d: z.enum(RESPONSIBLE_OPTIONS),
  plans: z.enum(RESPONSIBLE_OPTIONS),
  render: z.enum(RESPONSIBLE_OPTIONS),
});

function weightsSumOk(w: { proposal: number; modeling_3d: number; plans: number; render: number }) {
  const sum = w.proposal + w.modeling_3d + w.plans + w.render;
  return Math.abs(sum - 1) < 0.005;
}

// ── Create project ────────────────────────────────────────────────
export const createProjectSchema = z
  .object({
    name,
    address,
    clientId: z.string().uuid().optional().or(z.literal("")),
    clientName: name.optional().or(z.literal("")),
    template: z.enum(["diamante", "oro", "especial"]).default("diamante"),
    weights: sliceWeightsSchema.optional(),
    responsibles: projectResponsiblesSchema,
    projectAmount: money,
    addons,
    registerAnticipo: z.boolean().default(false),
    anticipoAmount: z.number().positive().optional(),
    anticipoConcept: z.string().trim().max(160).optional(),
    anticipoMethodId: z.string().uuid().optional().or(z.literal("")),
    anticipoDate: isoDate.optional(),
  })
  .superRefine((data, ctx) => {
    const hasId = !!data.clientId && data.clientId !== "";
    const hasName = !!data.clientName && data.clientName !== "";
    if (!hasId && !hasName) {
      ctx.addIssue({
        code: "custom",
        path: ["clientId"],
        message: "Selecciona o crea un cliente",
      });
    }
    if (data.template === "especial") {
      if (!data.weights || !weightsSumOk(data.weights)) {
        ctx.addIssue({
          code: "custom",
          path: ["weights"],
          message: "Los porcentajes deben sumar 100%",
        });
      }
    }
    if (data.registerAnticipo) {
      const total = computeBreakdown(data.projectAmount, data.addons ?? []).total;
      if (!data.anticipoAmount || data.anticipoAmount <= 0) {
        ctx.addIssue({ code: "custom", path: ["anticipoAmount"], message: "Ingresa el monto del anticipo" });
      } else if (data.anticipoAmount > total) {
        ctx.addIssue({ code: "custom", path: ["anticipoAmount"], message: "El anticipo no puede superar el total" });
      }
      if (!data.anticipoConcept || data.anticipoConcept.trim().length < 2) {
        ctx.addIssue({ code: "custom", path: ["anticipoConcept"], message: "Ingresa un concepto" });
      }
      if (!data.anticipoMethodId || data.anticipoMethodId === "") {
        ctx.addIssue({ code: "custom", path: ["anticipoMethodId"], message: "Selecciona forma de pago" });
      }
      if (!data.anticipoDate) {
        ctx.addIssue({ code: "custom", path: ["anticipoDate"], message: "Selecciona una fecha" });
      }
    }
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// ── Update project ────────────────────────────────────────────────
export const updateProjectSchema = z
  .object({
    id: z.string().uuid("Proyecto inválido"),
    name,
    address,
    clientId: z.string().uuid().optional().or(z.literal("")),
    clientName: name.optional().or(z.literal("")),
    responsibles: projectResponsiblesSchema,
    weights: sliceWeightsSchema.optional(),
    projectAmount: money,
    addons,
  })
  .superRefine((data, ctx) => {
    const hasId = !!data.clientId && data.clientId !== "";
    const hasName = !!data.clientName && data.clientName !== "";
    if (!hasId && !hasName) {
      ctx.addIssue({
        code: "custom",
        path: ["clientId"],
        message: "Selecciona o crea un cliente",
      });
    }
    if (data.weights && !weightsSumOk(data.weights)) {
      ctx.addIssue({
        code: "custom",
        path: ["weights"],
        message: "Los porcentajes deben sumar 100%",
      });
    }
  });

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

const internalArea = z.enum(
  Object.keys(PROJECT_DISTRIBUTION) as [
    keyof typeof PROJECT_DISTRIBUTION,
    ...(keyof typeof PROJECT_DISTRIBUTION)[],
  ],
);

// ── Register movement (ingreso / egreso) ──────────────────────────
export const registerMovementSchema = z
  .object({
  projectId: z.string().uuid("Proyecto inválido"),
  movementType: z.enum(["income", "expense"]),
  concept,
  amount: money,
  paymentDate: isoDate,
  paymentMethodId: z.string().uuid("Selecciona forma de pago"),
    internalArea: internalArea.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.movementType === "expense" && !data.internalArea) {
      ctx.addIssue({
        code: "custom",
        path: ["internalArea"],
        message: "Selecciona el área interna del egreso",
      });
    }
  });

export type RegisterMovementInput = z.infer<typeof registerMovementSchema>;

// ── Register internal transfer between payment methods ───────────
export const registerInternalTransferSchema = z
  .object({
    description: concept,
    amount: money,
    transferDate: isoDate,
    fromPaymentMethodId: z.string().uuid("Selecciona la cuenta de origen"),
    toPaymentMethodId: z.string().uuid("Selecciona la cuenta de destino"),
  })
  .superRefine((data, ctx) => {
    if (data.fromPaymentMethodId === data.toPaymentMethodId) {
      ctx.addIssue({
        code: "custom",
        path: ["toPaymentMethodId"],
        message: "El destino debe ser diferente al origen",
      });
    }
  });

export type RegisterInternalTransferInput = z.infer<
  typeof registerInternalTransferSchema
>;

const employeeDefaultWorkType = z.enum(EMPLOYEE_DEFAULT_WORK_TYPES);
const salaryWeekStatus = z.enum(SALARY_WEEK_STATUSES);
const salaryWeekday = z.enum(
  Object.keys(SALARY_WEEKDAY_LABELS) as [
    keyof typeof SALARY_WEEKDAY_LABELS,
    ...(keyof typeof SALARY_WEEKDAY_LABELS)[],
  ],
);
const salaryActivityType = z.enum(SALARY_ACTIVITY_TYPES);
const salaryPaymentType = z.enum(SALARY_PAYMENT_TYPES);
const taskModuleType = z.enum(TASK_MODULE_TYPES);
const salaryRecordStatus = z.enum(SALARY_RECORD_STATUSES);
const salaryPaymentStatus = z.enum(SALARY_PAYMENT_STATUSES);

export const employeeSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  fullName: name,
  isActive: z.boolean().default(true),
  defaultWorkType: employeeDefaultWorkType,
});

export const taskTypeSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name,
  moduleType: taskModuleType,
  isActive: z.boolean().default(true),
});

export const saveSalaryWeekSchema = z
  .object({
    id: z.string().uuid().optional().or(z.literal("")),
    startDate: isoDate,
    paymentDate: isoDate.optional(),
    status: salaryWeekStatus.default("draft"),
  })
  .superRefine((data, ctx) => {
    const start = new Date(`${data.startDate}T00:00:00`);
    if (start.getDay() !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "La semana debe iniciar un lunes",
      });
    }
    if (data.paymentDate && data.paymentDate < data.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentDate"],
        message: "La fecha de pago no puede ser menor al inicio",
      });
    }
  });

export const saveSalaryDayRecordSchema = z
  .object({
    id: z.string().uuid().optional().or(z.literal("")),
    salaryWeekId: z.string().uuid("Semana inválida"),
    employeeId: z.string().uuid("Empleado inválido"),
    workDate: isoDate,
    dayName: salaryWeekday,
    activityType: salaryActivityType,
    projectId: z.string().uuid().nullable().optional(),
    workId: z.string().uuid().nullable().optional(),
    taskTypeId: z.string().uuid().nullable().optional(),
    notes: z.string().trim().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
    status: salaryRecordStatus.default("recorded"),
  })
  .superRefine((data, ctx) => {
    if (data.activityType === "project" && !data.projectId) {
      ctx.addIssue({
        code: "custom",
        path: ["projectId"],
        message: "Selecciona proyecto",
      });
    }
    if (data.activityType === "work" && !data.workId) {
      ctx.addIssue({
        code: "custom",
        path: ["workId"],
        message: "Selecciona obra",
      });
    }
    if (data.activityType === "project" && !data.taskTypeId) {
      ctx.addIssue({
        code: "custom",
        path: ["taskTypeId"],
        message: "Selecciona tarea",
      });
    }
  });

export const saveSalaryPaymentSchema = z
  .object({
    id: z.string().uuid().optional().or(z.literal("")),
    salaryWeekId: z.string().uuid("Semana inválida"),
    employeeId: z.string().uuid("Empleado inválido"),
    paymentType: salaryPaymentType,
    concept,
    amount: money,
    paymentMethodId: z.string().uuid("Selecciona forma de pago"),
    paymentDate: isoDate,
    projectId: z.string().uuid().nullable().optional(),
    workId: z.string().uuid().nullable().optional(),
    taskTypeId: z.string().uuid().nullable().optional(),
    notes: z.string().trim().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
    status: salaryPaymentStatus.default("paid"),
  })
  .superRefine((data, ctx) => {
    if (data.paymentType === "project" && !data.projectId) {
      ctx.addIssue({
        code: "custom",
        path: ["projectId"],
        message: "Selecciona proyecto",
      });
    }
    if (data.paymentType === "work" && !data.workId) {
      ctx.addIssue({
        code: "custom",
        path: ["workId"],
        message: "Selecciona obra",
      });
    }
    if (data.paymentType === "project" && !data.taskTypeId) {
      ctx.addIssue({
        code: "custom",
        path: ["taskTypeId"],
        message: "Selecciona tarea",
      });
    }
  });

export const updateSalaryWeekStatusSchema = z.object({
  salaryWeekId: z.string().uuid("Semana inválida"),
  status: salaryWeekStatus,
});

export type SaveSalaryWeekInput = z.infer<typeof saveSalaryWeekSchema>;
export type SaveSalaryDayRecordInput = z.infer<typeof saveSalaryDayRecordSchema>;
export type SaveSalaryPaymentInput = z.infer<typeof saveSalaryPaymentSchema>;
export type UpdateSalaryWeekStatusInput = z.infer<typeof updateSalaryWeekStatusSchema>;

const workStatus = z.enum(WORK_STATUSES);
const workCategory = z.string().trim().min(2, "Selecciona una categoría").max(80, "Máximo 80 caracteres");

// ── Works ────────────────────────────────────────────────────────
export const createWorkSchema = z
  .object({
    name,
    address,
    clientId: z.string().uuid().optional().or(z.literal("")),
    clientName: name.optional().or(z.literal("")),
    status: workStatus.default("active"),
    description: z.string().trim().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const hasId = !!data.clientId && data.clientId !== "";
    const hasName = !!data.clientName && data.clientName !== "";
    if (!hasId && !hasName) {
      ctx.addIssue({
        code: "custom",
        path: ["clientId"],
        message: "Selecciona o crea un cliente",
      });
    }
  });

export const updateWorkSchema = createWorkSchema.extend({
  id: z.string().uuid("Obra inválida"),
});

export const registerWorkMovementSchema = z
  .object({
    workId: z.string().uuid("Obra inválida"),
    receipt: z.string().trim().max(80, "Máximo 80 caracteres").optional().or(z.literal("")),
    movementDate: isoDate,
    concept,
    supplier: z.string().trim().max(160, "Máximo 160 caracteres").optional().or(z.literal("")),
    category: workCategory,
    movementType: z.enum(["income", "expense"]),
    amount: money,
    paymentMethodId: z.string().uuid("Selecciona forma de pago"),
    observations: z.string().trim().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.movementType === "income" && data.category !== WORK_INCOME_CATEGORY) {
      ctx.addIssue({
        code: "custom",
        path: ["category"],
        message: "Las entradas solo pueden usar Abono de obra",
      });
    }
    // El recibo de las entradas se genera automático; en salidas es obligatorio.
    if (data.movementType === "expense" && (!data.receipt || data.receipt.trim().length < 1)) {
      ctx.addIssue({
        code: "custom",
        path: ["receipt"],
        message: "Ingresa el recibo",
      });
    }
    if (data.movementType === "expense" && (!data.supplier || data.supplier.trim().length < 2)) {
      ctx.addIssue({
        code: "custom",
        path: ["supplier"],
        message: "Selecciona proveedor",
      });
    }
  });

export type CreateWorkInput = z.infer<typeof createWorkSchema>;
export type UpdateWorkInput = z.infer<typeof updateWorkSchema>;
export type RegisterWorkMovementInput = z.infer<typeof registerWorkMovementSchema>;

// ── Work orders / pedidos ───────────────────────────────────────
export const createWorkOrderSchema = z.object({
  workId: z.string().uuid("Obra inválida"),
  orderDate: isoDate,
  supplier: z.string().trim().min(2, "Selecciona proveedor").max(80, "Máximo 80 caracteres"),
  material: z
    .string()
    .trim()
    .min(2, "Ingresa el material")
    .max(1000, "Máximo 1000 caracteres"),
  description: z.string().trim().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
});

export const quoteWorkOrderSchema = z
  .object({
    orderId: z.string().uuid("Pedido inválido"),
    quoteDate: isoDate,
    category: workCategory.refine((category) => category !== WORK_INCOME_CATEGORY, {
      message: "Selecciona una categoría de salida",
    }),
    amount: money,
    registerAdvance: z.boolean().default(false),
    advanceAmount: z.number().positive().optional(),
    advancePaymentMethodId: z.string().uuid("Selecciona forma de pago").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (!data.registerAdvance) return;
    if (!data.advanceAmount || data.advanceAmount <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["advanceAmount"],
        message: "Ingresa el adelanto",
      });
    } else if (data.advanceAmount > data.amount) {
      ctx.addIssue({
        code: "custom",
        path: ["advanceAmount"],
        message: "El adelanto no puede superar el total",
      });
    }
    if (!data.advancePaymentMethodId) {
      ctx.addIssue({
        code: "custom",
        path: ["advancePaymentMethodId"],
        message: "Selecciona forma de pago",
      });
    }
  });

export const registerWorkOrderPaymentSchema = z.object({
  orderId: z.string().uuid("Pedido inválido"),
  paymentDate: isoDate,
  description: z.string().trim().max(160, "Máximo 160 caracteres").optional().or(z.literal("")),
  amount: money,
  paymentMethodId: z.string().uuid("Selecciona forma de pago"),
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type QuoteWorkOrderInput = z.infer<typeof quoteWorkOrderSchema>;
export type RegisterWorkOrderPaymentInput = z.infer<
  typeof registerWorkOrderPaymentSchema
>;

export const manualDebtorSchema = z.object({
  id: z.string().uuid("Deudor inválido").optional().or(z.literal("")),
  name,
  amount: z
    .number({ error: "Ingresa un monto válido" })
    .finite("Monto inválido")
    .min(0, "El monto no puede ser negativo")
    .max(1_000_000_000, "Monto demasiado alto")
    .refine((n) => Math.round(n * 100) === n * 100, "Máximo 2 decimales"),
});

export type ManualDebtorInput = z.infer<typeof manualDebtorSchema>;

export const generalBalanceEntrySchema = z
  .object({
    description: concept,
    amount: money,
    entryDate: isoDate,
    fromAccountId: z.string().min(1, "Selecciona la cuenta de egreso"),
    toAccountId: z.string().min(1, "Selecciona la cuenta de ingreso"),
  })
  .superRefine((data, ctx) => {
    if (data.fromAccountId === data.toAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["toAccountId"],
        message: "El ingreso debe ser diferente al egreso",
      });
    }
  });

export type GeneralBalanceEntryInput = z.infer<typeof generalBalanceEntrySchema>;

export const generalBalanceAccountMovementSchema = z.object({
  accountId: z.string().min(1, "Cuenta inválida"),
  movementType: z.enum(["income", "expense"]),
  description: concept,
  amount: money,
  movementDate: isoDate,
});

export type GeneralBalanceAccountMovementInput = z.infer<
  typeof generalBalanceAccountMovementSchema
>;
