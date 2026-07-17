"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  deleteSalaryDayRecord,
  deleteSalaryPayment,
  registerGeneralBalanceAccountMovement,
  registerGeneralBalanceEntry,
  saveSalaryDayRecord,
  saveSalaryPayment,
  saveSalaryWeek,
  saveManualDebtor,
  updateSalaryWeekStatus,
} from "@/lib/data/finance";
import { registerWorkInternalTransfer } from "@/lib/data/works";
import {
  generalBalanceAccountMovementSchema,
  generalBalanceEntrySchema,
  manualDebtorSchema,
  registerInternalTransferSchema,
  saveSalaryDayRecordSchema,
  saveSalaryPaymentSchema,
  saveSalaryWeekSchema,
  updateSalaryWeekStatusSchema,
} from "@/lib/validation";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function currentUserId(): string | null {
  return null;
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function revalidateSalaryPaths(weekId?: string | null) {
  revalidatePath("/finance/salario");
  if (weekId) revalidatePath(`/finance/salario/${weekId}`);
}

export async function saveManualDebtorAction(
  raw: unknown,
): Promise<ActionResult<{ debtorId: string }>> {
  const parsed = manualDebtorSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los campos del deudor.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    const debtorId = await saveManualDebtor({
      id: d.id || undefined,
      name: d.name,
      amount: d.amount,
      userId: currentUserId(),
    });
    revalidatePath("/finance/deudas");
    return { ok: true, data: { debtorId } };
  } catch {
    return { ok: false, error: "No se pudo guardar el deudor." };
  }
}

export async function registerGeneralBalanceEntryAction(
  raw: unknown,
): Promise<ActionResult> {
  const parsed = generalBalanceEntrySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del registro.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    await registerGeneralBalanceEntry({
      description: d.description,
      amount: d.amount,
      entryDate: d.entryDate,
      fromAccountId: d.fromAccountId,
      toAccountId: d.toAccountId,
      userId: currentUserId(),
    });
    revalidatePath("/finance/balance-general");
    revalidatePath(`/finance/balance-general/${d.fromAccountId}`);
    revalidatePath(`/finance/balance-general/${d.toAccountId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo registrar el movimiento." };
  }
}

export async function registerGeneralBalanceAccountMovementAction(
  raw: unknown,
): Promise<ActionResult> {
  const parsed = generalBalanceAccountMovementSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del registro.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    await registerGeneralBalanceAccountMovement({
      accountId: d.accountId,
      movementType: d.movementType,
      description: d.description,
      amount: d.amount,
      movementDate: d.movementDate,
      userId: currentUserId(),
    });
    revalidatePath("/finance/balance-general");
    revalidatePath(`/finance/balance-general/${d.accountId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo registrar el movimiento." };
  }
}

export async function registerFinanceInternalTransferAction(
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
    revalidatePath("/finance/movimientos-internos");
    revalidatePath("/finance/balance-general");
    revalidatePath("/obras/reports");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo registrar el traspaso interno." };
  }
}

export async function saveSalaryWeekAction(
  raw: unknown,
): Promise<ActionResult<{ weekId: string }>> {
  const parsed = saveSalaryWeekSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos de la semana salarial.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    const weekId = await saveSalaryWeek({
      id: d.id || undefined,
      startDate: d.startDate,
      paymentDate: d.paymentDate || d.startDate,
      status: d.status,
      userId: currentUserId(),
    });
    revalidateSalaryPaths(weekId);
    return { ok: true, data: { weekId } };
  } catch {
    return { ok: false, error: "No se pudo guardar la semana salarial." };
  }
}

export async function saveSalaryDayRecordAction(
  raw: unknown,
): Promise<ActionResult<{ recordId: string }>> {
  const parsed = saveSalaryDayRecordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos de la actividad diaria.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    const recordId = await saveSalaryDayRecord({
      id: d.id || undefined,
      salaryWeekId: d.salaryWeekId,
      employeeId: d.employeeId,
      workDate: d.workDate,
      dayName: d.dayName,
      activityType: d.activityType,
      projectId: d.projectId ?? null,
      workId: d.workId ?? null,
      taskTypeId: d.taskTypeId ?? null,
      notes: d.notes?.trim() || null,
      status: d.status,
      userId: currentUserId(),
    });
    revalidateSalaryPaths(d.salaryWeekId);
    return { ok: true, data: { recordId } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar la actividad.",
    };
  }
}

export async function deleteSalaryDayRecordAction(
  raw: unknown,
): Promise<ActionResult> {
  const parsed = z.object({
    recordId: z.string().min(1),
    salaryWeekId: z.string().uuid("Semana inválida"),
  }).safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Actividad inválida." };
  }

  try {
    await deleteSalaryDayRecord({
      recordId: parsed.data.recordId,
      userId: currentUserId(),
    });
    revalidateSalaryPaths(parsed.data.salaryWeekId);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo eliminar la actividad.",
    };
  }
}

export async function saveSalaryPaymentAction(
  raw: unknown,
): Promise<ActionResult<{ paymentId: string }>> {
  const parsed = saveSalaryPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del pago.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    const paymentId = await saveSalaryPayment({
      id: d.id || undefined,
      salaryWeekId: d.salaryWeekId,
      employeeId: d.employeeId,
      paymentType: d.paymentType,
      concept: d.concept,
      amount: d.amount,
      paymentMethodId: d.paymentMethodId,
      paymentDate: d.paymentDate,
      projectId: d.projectId ?? null,
      workId: d.workId ?? null,
      taskTypeId: d.taskTypeId ?? null,
      notes: d.notes?.trim() || null,
      status: d.status,
      userId: currentUserId(),
    });
    revalidateSalaryPaths(d.salaryWeekId);
    return { ok: true, data: { paymentId } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar el pago.",
    };
  }
}

export async function deleteSalaryPaymentAction(
  raw: unknown,
): Promise<ActionResult> {
  const parsed = z.object({
    paymentId: z.string().min(1),
    salaryWeekId: z.string().uuid("Semana inválida"),
  }).safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Pago inválido." };
  }

  try {
    await deleteSalaryPayment({
      paymentId: parsed.data.paymentId,
      userId: currentUserId(),
    });
    revalidateSalaryPaths(parsed.data.salaryWeekId);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo eliminar el pago.",
    };
  }
}

export async function updateSalaryWeekStatusAction(
  raw: unknown,
): Promise<ActionResult> {
  const parsed = updateSalaryWeekStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa el estado solicitado.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    await updateSalaryWeekStatus({
      salaryWeekId: d.salaryWeekId,
      status: d.status,
      userId: currentUserId(),
    });
    revalidateSalaryPaths(d.salaryWeekId);
    if (d.status === "paid") {
      revalidatePath("/projects");
      revalidatePath("/obras");
    }
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo cambiar el estado.",
    };
  }
}
