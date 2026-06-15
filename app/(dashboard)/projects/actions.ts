"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PROJECT_SLICE_LABELS } from "@/lib/constants";
import {
  createProjectSchema,
  registerInternalTransferSchema,
  registerMovementSchema,
  editProjectMovementSchema,
  deleteProjectMovementSchema,
  updateProjectSchema,
} from "@/lib/validation";
import {
  createProject,
  updateProject,
  registerMovement,
  registerInternalTransfer,
  updateProjectMovement,
  deleteProjectMovement,
  deleteProject,
  getProject,
  listMovements,
} from "@/lib/data/projects";
import { computeFinance, computeBreakdown, round2, weightsFromAmounts } from "@/lib/calculations";
import type { InternalArea } from "@/lib/types";

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

function areaBudget(project: Awaited<ReturnType<typeof getProject>>, area: InternalArea): number {
  if (!project) return 0;
  switch (area) {
    case "proposal":
      return project.proposal_amount;
    case "modeling_3d":
      return project.modeling_3d_amount;
    case "plans":
      return project.plans_amount;
    case "render":
      return project.render_amount;
  }
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
      address: d.address || undefined,
      clientId: d.clientId || undefined,
      clientName: d.clientName || undefined,
      template: d.template,
      weights: d.weights,
      responsibles: d.responsibles,
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
    const [existing, payments] = await Promise.all([
      getProject(d.id),
      listMovements(d.id),
    ]);
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

    // Each area's new budget cannot drop below what was already paid (spent) in it.
    const weights =
      d.weights ??
      weightsFromAmounts({
        proposal: existing.proposal_amount,
        modeling_3d: existing.modeling_3d_amount,
        plans: existing.plans_amount,
        render: existing.render_amount,
      });
    const newAreaAmounts = computeBreakdown(d.projectAmount, d.addons, weights).project;
    const paidByArea = payments.reduce<Record<InternalArea, number>>(
      (acc, p) => {
        if (p.movement_type !== "expense" || !p.internal_area) return acc;
        acc[p.internal_area] = round2(acc[p.internal_area] + p.amount);
        return acc;
      },
      { proposal: 0, modeling_3d: 0, plans: 0, render: 0 },
    );
    const offending = (Object.keys(newAreaAmounts) as InternalArea[]).find(
      (area) => newAreaAmounts[area] < paidByArea[area] - 0.001,
    );
    if (offending) {
      const label = PROJECT_SLICE_LABELS[offending];
      return {
        ok: false,
        error: `El monto de ${label} (${newAreaAmounts[offending].toFixed(2)}) no puede ser menor a lo ya pagado en esa área (${paidByArea[offending].toFixed(2)}).`,
        fieldErrors: { weights: `${label}: el monto queda menor que lo ya pagado` },
      };
    }

    await updateProject({
      id: d.id,
      name: d.name,
      address: d.address || undefined,
      clientId: d.clientId || undefined,
      clientName: d.clientName || undefined,
      responsibles: d.responsibles,
      weights: d.weights,
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
): Promise<ActionResult<{ paymentId: string; receiptCode: string | null }>> {
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
    const [project, existingPayments] = await Promise.all([
      getProject(d.projectId),
      listMovements(d.projectId),
    ]);
    if (!project) return { ok: false, error: "Proyecto no encontrado." };
    if (d.movementType === "income" && d.amount > project.finance.pending + 0.001) {
      return {
        ok: false,
        error: `El ingreso supera el saldo pendiente (${project.finance.pending.toFixed(2)}).`,
        fieldErrors: { amount: "Supera el saldo pendiente" },
      };
    }
    if (d.movementType === "expense" && d.internalArea) {
      const areaLabel = PROJECT_SLICE_LABELS[d.internalArea];
      const budget = areaBudget(project, d.internalArea);
      const alreadyPaid = round2(
        existingPayments.reduce((sum, payment) => {
          if (payment.movement_type !== "expense") return sum;
          if (payment.internal_area !== d.internalArea) return sum;
          return sum + payment.amount;
        }, 0),
      );
      const remaining = round2(Math.max(budget - alreadyPaid, 0));

      if (d.amount > budget + 0.001) {
        return {
          ok: false,
          error: `El egreso supera el presupuesto de ${areaLabel} (${budget.toFixed(2)}).`,
          fieldErrors: { amount: "Supera el presupuesto del área" },
        };
      }

      if (d.amount > remaining + 0.001) {
        return {
          ok: false,
          error: `Solo quedan ${remaining.toFixed(2)} disponibles en esta área.`,
          fieldErrors: { amount: "Supera el saldo restante del área" },
        };
      }
    }
    const created = await registerMovement({
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
    return { ok: true, data: { paymentId: created.id, receiptCode: created.receiptCode } };
  } catch {
    return { ok: false, error: "No se pudo registrar el movimiento." };
  }
}

export async function editProjectMovementAction(
  raw: unknown,
): Promise<ActionResult<{ paymentId: string }>> {
  const parsed = editProjectMovementSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del movimiento.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  const d = parsed.data;
  try {
    const [project, movements] = await Promise.all([
      getProject(d.projectId),
      listMovements(d.projectId),
    ]);
    if (!project) return { ok: false, error: "Proyecto no encontrado." };
    const current = movements.find((m) => m.id === d.paymentId);
    if (!current) return { ok: false, error: "Movimiento no encontrado." };

    // Ingreso: no puede superar el pendiente (descontando lo que ya aportaba este mismo movimiento).
    if (d.movementType === "income") {
      const wasIncome = current.movement_type === "income" ? current.amount : 0;
      const allowed = round2(project.finance.pending + wasIncome);
      if (d.amount > allowed + 0.001) {
        return {
          ok: false,
          error: `El ingreso supera el saldo pendiente (${allowed.toFixed(2)}).`,
          fieldErrors: { amount: "Supera el saldo pendiente" },
        };
      }
    }

    // Egreso por área: el nuevo monto + lo ya pagado en el área (sin este movimiento) ≤ presupuesto.
    if (d.movementType === "expense" && d.internalArea) {
      const areaLabel = PROJECT_SLICE_LABELS[d.internalArea];
      const budget = areaBudget(project, d.internalArea);
      const alreadyPaid = round2(
        movements.reduce((sum, m) => {
          if (m.id === d.paymentId) return sum;
          if (m.movement_type !== "expense") return sum;
          if (m.internal_area !== d.internalArea) return sum;
          return sum + m.amount;
        }, 0),
      );
      const remaining = round2(Math.max(budget - alreadyPaid, 0));
      if (d.amount > remaining + 0.001) {
        return {
          ok: false,
          error: `Solo quedan ${remaining.toFixed(2)} disponibles en ${areaLabel}.`,
          fieldErrors: { amount: "Supera el saldo restante del área" },
        };
      }
    }

    await updateProjectMovement(
      d.paymentId,
      {
        concept: d.concept,
        amount: d.amount,
        paymentDate: d.paymentDate,
        paymentMethodId: d.paymentMethodId,
        internalArea: d.internalArea ?? null,
      },
      d.note,
    );
    revalidatePath("/projects");
    revalidatePath(`/projects/${d.projectId}`);
    return { ok: true, data: { paymentId: d.paymentId } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo editar el movimiento." };
  }
}

export async function deleteProjectMovementAction(raw: unknown): Promise<ActionResult> {
  const parsed = deleteProjectMovementSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Escribe el motivo de la eliminación.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  try {
    await deleteProjectMovement(parsed.data.paymentId, parsed.data.note);
    revalidatePath("/projects");
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo eliminar el movimiento." };
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
