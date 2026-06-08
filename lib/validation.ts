import { z } from "zod";
import { computeBreakdown } from "./calculations";
import {
  PROJECT_DISTRIBUTION,
  WORK_CATEGORIES,
  WORK_INCOME_CATEGORY,
  WORK_PROVIDERS,
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

function weightsSumOk(w: { proposal: number; modeling_3d: number; plans: number; render: number }) {
  const sum = w.proposal + w.modeling_3d + w.plans + w.render;
  return Math.abs(sum - 1) < 0.005;
}

// ── Create project ────────────────────────────────────────────────
export const createProjectSchema = z
  .object({
    name,
    clientId: z.string().uuid().optional().or(z.literal("")),
    clientName: name.optional().or(z.literal("")),
    template: z.enum(["diamante", "oro", "especial"]).default("diamante"),
    weights: sliceWeightsSchema.optional(),
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
    clientId: z.string().uuid().optional().or(z.literal("")),
    clientName: name.optional().or(z.literal("")),
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

const workStatus = z.enum(WORK_STATUSES);
const workCategory = z.enum(WORK_CATEGORIES);

// ── Works ────────────────────────────────────────────────────────
export const createWorkSchema = z
  .object({
    name,
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
    receipt: z.string().trim().min(1, "Ingresa el recibo").max(80, "Máximo 80 caracteres"),
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
    if (data.movementType === "expense" && (!data.supplier || data.supplier.trim().length < 2)) {
      ctx.addIssue({
        code: "custom",
        path: ["supplier"],
        message: "Selecciona proveedor",
      });
    } else if (
      data.movementType === "expense" &&
      !WORK_PROVIDERS.includes(data.supplier as (typeof WORK_PROVIDERS)[number])
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["supplier"],
        message: "Selecciona un proveedor autorizado",
      });
    }
  });

export type CreateWorkInput = z.infer<typeof createWorkSchema>;
export type UpdateWorkInput = z.infer<typeof updateWorkSchema>;
export type RegisterWorkMovementInput = z.infer<typeof registerWorkMovementSchema>;

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
