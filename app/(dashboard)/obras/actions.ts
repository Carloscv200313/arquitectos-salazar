"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createWorkSchema,
  registerWorkMovementSchema,
  updateWorkSchema,
} from "@/lib/validation";
import {
  createWork,
  deleteWork,
  registerWorkMovement,
  updateWork,
} from "@/lib/data/works";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

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

export async function createWorkAction(
  raw: unknown,
): Promise<ActionResult<{ workId: string }>> {
  const parsed = createWorkSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos del formulario.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    const workId = await createWork({
      name: d.name,
      clientId: d.clientId || undefined,
      clientName: d.clientName || undefined,
      status: d.status,
      description: d.description || undefined,
      userId: currentUserId(),
    });
    revalidatePath("/obras");
    return { ok: true, data: { workId } };
  } catch {
    return { ok: false, error: "No se pudo crear la obra." };
  }
}

export async function updateWorkAction(
  raw: unknown,
): Promise<ActionResult<{ workId: string }>> {
  const parsed = updateWorkSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos del formulario.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    await updateWork({
      id: d.id,
      name: d.name,
      clientId: d.clientId || undefined,
      clientName: d.clientName || undefined,
      status: d.status,
      description: d.description || undefined,
      userId: currentUserId(),
    });
    revalidatePath("/obras");
    revalidatePath(`/obras/${d.id}`);
    return { ok: true, data: { workId: d.id } };
  } catch {
    return { ok: false, error: "No se pudo actualizar la obra." };
  }
}

export async function registerWorkMovementAction(
  raw: unknown,
): Promise<ActionResult> {
  const parsed = registerWorkMovementSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del movimiento.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    await registerWorkMovement({
      workId: d.workId,
      receipt: d.receipt,
      movementDate: d.movementDate,
      concept: d.concept,
      supplier: d.supplier,
      category: d.category,
      movementType: d.movementType,
      amount: d.amount,
      paymentMethodId: d.paymentMethodId,
      observations: d.observations || undefined,
      userId: currentUserId(),
    });
    revalidatePath("/obras");
    revalidatePath(`/obras/${d.workId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo registrar el movimiento." };
  }
}

export async function deleteWorkAction(id: string): Promise<ActionResult> {
  if (typeof id !== "string" || id.length < 10) {
    return { ok: false, error: "Identificador inválido." };
  }
  try {
    await deleteWork(id);
    revalidatePath("/obras");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo eliminar la obra." };
  }
}
