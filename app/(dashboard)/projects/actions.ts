"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createProjectSchema,
  registerInternalTransferSchema,
  registerMovementSchema,
  updateProjectSchema,
} from "@/lib/validation";
import {
  createProject,
  updateProject,
  registerMovement,
  registerInternalTransfer,
  deleteProject,
  getProject,
  listMovements,
} from "@/lib/data/projects";
import { computeFinance, computeBreakdown } from "@/lib/calculations";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Phase 1: no auth yet. Once auth lands, resolve the current user id here.
function currentUserId(): string | null {
  return null;
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function createProjectAction(
  raw: unknown,
): Promise<ActionResult<{ projectId: string }>> {
  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos del formulario.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  const d = parsed.data;
  try {
    const projectId = await createProject({
      name: d.name,
      clientId: d.clientId || undefined,
      clientName: d.clientName || undefined,
      template: d.template,
      weights: d.weights,
      projectAmount: d.projectAmount,
      addons: d.addons,
      anticipo: d.registerAnticipo
        ? {
            amount: d.anticipoAmount!,
            concept: d.anticipoConcept!,
            methodId: d.anticipoMethodId!,
            date: d.anticipoDate!,
          }
        : undefined,
      userId: currentUserId(),
    });
    revalidatePath("/projects");
    return { ok: true, data: { projectId } };
  } catch {
    return { ok: false, error: "No se pudo crear el proyecto. Intenta nuevamente." };
  }
}

export async function updateProjectAction(
  raw: unknown,
): Promise<ActionResult<{ projectId: string }>> {
  const parsed = updateProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos del formulario.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  const d = parsed.data;
  try {
    const existing = await getProject(d.id);
    if (!existing) return { ok: false, error: "Proyecto no encontrado." };
    // The new total (base + addons) cannot be lower than what's already collected.
    const newTotal = computeBreakdown(d.projectAmount, d.addons).total;
    if (newTotal < existing.finance.income - 0.001) {
      return {
        ok: false,
        error: `El total resultante no puede ser menor a lo ya cobrado (${existing.finance.income.toFixed(2)}).`,
        fieldErrors: { projectAmount: "El total queda menor que lo ya cobrado" },
      };
    }
    await updateProject({
      id: d.id,
      name: d.name,
      clientId: d.clientId || undefined,
      clientName: d.clientName || undefined,
      projectAmount: d.projectAmount,
      addons: d.addons,
      userId: currentUserId(),
    });
    revalidatePath("/projects");
    revalidatePath(`/projects/${d.id}`);
    return { ok: true, data: { projectId: d.id } };
  } catch {
    return { ok: false, error: "No se pudo actualizar el proyecto." };
  }
}

export async function registerMovementAction(
  raw: unknown,
): Promise<ActionResult> {
  const parsed = registerMovementSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del movimiento.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  const d = parsed.data;
  try {
    const project = await getProject(d.projectId);
    if (!project) return { ok: false, error: "Proyecto no encontrado." };
    if (d.movementType === "income" && d.amount > project.finance.pending + 0.001) {
      return {
        ok: false,
        error: `El ingreso supera el saldo pendiente (${project.finance.pending.toFixed(2)}).`,
        fieldErrors: { amount: "Supera el saldo pendiente" },
      };
    }
    await registerMovement({
      projectId: d.projectId,
      movementType: d.movementType,
      concept: d.concept,
      amount: d.amount,
      paymentDate: d.paymentDate,
      paymentMethodId: d.paymentMethodId,
      internalArea: d.internalArea ?? null,
      userId: currentUserId(),
    });
    revalidatePath("/projects");
    revalidatePath(`/projects/${d.projectId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo registrar el movimiento." };
  }
}

export async function registerInternalTransferAction(
  raw: unknown,
): Promise<ActionResult> {
  const parsed = registerInternalTransferSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del traspaso.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  const d = parsed.data;
  try {
    await registerInternalTransfer({
      description: d.description,
      amount: d.amount,
      transferDate: d.transferDate,
      fromPaymentMethodId: d.fromPaymentMethodId,
      toPaymentMethodId: d.toPaymentMethodId,
      userId: currentUserId(),
    });
    revalidatePath("/projects");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo registrar el traspaso interno." };
  }
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  if (typeof id !== "string" || id.length < 10) {
    return { ok: false, error: "Identificador inválido." };
  }
  try {
    await deleteProject(id);
    revalidatePath("/projects");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo eliminar el proyecto." };
  }
}

// Helper consumed by the detail page to recompute after server actions.
export async function projectFinanceSnapshot(id: string) {
  const payments = await listMovements(id);
  const project = await getProject(id);
  if (!project) return null;
  return computeFinance(project.total_amount, payments);
}
