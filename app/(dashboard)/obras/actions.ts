"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createWorkSchema,
  registerInternalTransferSchema,
  registerWorkMovementSchema,
  editWorkMovementSchema,
  deleteWorkMovementSchema,
  saveWorkCategoryBudgetSchema,
  updateWorkSchema,
} from "@/lib/validation";
import {
  createWork,
  deleteWorkFile,
  deleteWork,
  getWorkFileViewUrl,
  registerWorkInternalTransfer,
  registerWorkMovement,
  saveWorkCategoryBudget,
  uploadWorkFile,
  updateWorkMovement,
  deleteWorkMovement,
  updateWork,
} from "@/lib/data/works";
import type { WorkFile } from "@/lib/types";

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
      address: d.address || undefined,
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
      address: d.address || undefined,
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
): Promise<ActionResult<{ movementId: string; receiptCode: string | null; isIncome: boolean }>> {
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
    const created = await registerWorkMovement({
      workId: d.workId,
      receipt: d.receipt,
      movementDate: d.movementDate,
      concept: d.concept,
      supplier: d.movementType === "income" ? "Cliente" : d.supplier,
      category: d.category,
      movementType: d.movementType,
      amount: d.amount,
      paymentMethodId: d.paymentMethodId,
      observations: d.observations || undefined,
      userId: currentUserId(),
    });
    revalidatePath("/obras");
    revalidatePath(`/obras/${d.workId}`);
    return {
      ok: true,
      data: {
        movementId: created.id,
        receiptCode: created.receiptCode,
        isIncome: d.movementType === "income",
      },
    };
  } catch {
    return { ok: false, error: "No se pudo registrar el movimiento." };
  }
}

export async function editWorkMovementAction(raw: unknown): Promise<ActionResult> {
  const parsed = editWorkMovementSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del movimiento.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  try {
    const d = parsed.data;
    await updateWorkMovement(
      d.movementId,
      {
        receipt: d.receipt,
        movementDate: d.movementDate,
        concept: d.concept,
        supplier: d.movementType === "income" ? "Cliente" : d.supplier,
        category: d.category,
        amount: d.amount,
        paymentMethodId: d.paymentMethodId,
        observations: d.observations || undefined,
      },
      d.note,
    );
    revalidatePath("/obras");
    revalidatePath(`/obras/${d.workId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo editar el movimiento." };
  }
}

export async function deleteWorkMovementAction(raw: unknown): Promise<ActionResult> {
  const parsed = deleteWorkMovementSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Escribe el motivo de la eliminación.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  try {
    const d = parsed.data;
    await deleteWorkMovement(d.movementId, d.note);
    revalidatePath("/obras");
    revalidatePath(`/obras/${d.workId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo eliminar el movimiento." };
  }
}

export async function registerWorkInternalTransferAction(
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

  try {
    const d = parsed.data;
    await registerWorkInternalTransfer({
      description: d.description,
      amount: d.amount,
      transferDate: d.transferDate,
      fromPaymentMethodId: d.fromPaymentMethodId,
      toPaymentMethodId: d.toPaymentMethodId,
      userId: currentUserId(),
    });
    revalidatePath("/obras");
    revalidatePath("/obras/reports");
    revalidatePath("/finance/balance-general");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo registrar el traspaso interno." };
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

export async function uploadWorkFileAction(
  workId: string,
  formData: FormData,
): Promise<ActionResult<{ file: WorkFile }>> {
  if (typeof workId !== "string" || workId.length < 10) {
    return { ok: false, error: "Identificador de obra inválido." };
  }

  const rawFile = formData.get("file");
  if (!(rawFile instanceof File)) {
    return { ok: false, error: "Selecciona un archivo válido." };
  }

  try {
    const file = await uploadWorkFile(workId, rawFile);
    revalidatePath("/obras");
    revalidatePath(`/obras/${workId}`);
    return { ok: true, data: { file } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo subir el archivo." };
  }
}

export async function deleteWorkFileAction(
  workId: string,
  fileId: string,
): Promise<ActionResult> {
  if (
    typeof workId !== "string" ||
    workId.length < 10 ||
    typeof fileId !== "string" ||
    fileId.length < 10
  ) {
    return { ok: false, error: "Identificador inválido." };
  }

  try {
    await deleteWorkFile(fileId);
    revalidatePath("/obras");
    revalidatePath(`/obras/${workId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo eliminar el archivo." };
  }
}

export async function getWorkFileViewUrlAction(
  fileId: string,
): Promise<ActionResult<{ url: string }>> {
  if (typeof fileId !== "string" || fileId.length < 10) {
    return { ok: false, error: "Identificador inválido." };
  }

  try {
    const url = await getWorkFileViewUrl(fileId);
    return { ok: true, data: { url } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo abrir el archivo." };
  }
}

export async function saveWorkCategoryBudgetAction(
  raw: unknown,
): Promise<ActionResult<{ rows: import("@/lib/types").WorkCategorySummary[] }>> {
  const parsed = saveWorkCategoryBudgetSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa el presupuesto de la categoría.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    const rows = await saveWorkCategoryBudget(
      d.workId,
      d.category,
      d.budget,
      d.executedAmount,
    );
    revalidatePath("/obras");
    revalidatePath(`/obras/${d.workId}`);
    return { ok: true, data: { rows } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo guardar el presupuesto." };
  }
}
