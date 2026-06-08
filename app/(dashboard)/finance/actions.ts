"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  registerGeneralBalanceAccountMovement,
  registerGeneralBalanceEntry,
  saveManualDebtor,
} from "@/lib/data/finance";
import { registerWorkInternalTransfer } from "@/lib/data/works";
import {
  generalBalanceAccountMovementSchema,
  generalBalanceEntrySchema,
  manualDebtorSchema,
  registerInternalTransferSchema,
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
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
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
