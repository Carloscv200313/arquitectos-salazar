"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createWorkOrder,
  getWorkOrder,
  quoteWorkOrder,
  registerWorkOrderPayment,
  updateWorkOrder,
  updateWorkOrderPayment,
  deleteWorkOrderPayment,
} from "@/lib/data/orders";
import {
  createWorkOrderSchema,
  editWorkOrderSchema,
  quoteWorkOrderSchema,
  registerWorkOrderPaymentSchema,
  editOrderPaymentSchema,
  deleteOrderPaymentSchema,
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

function revalidateOrderSurfaces(workId?: string) {
  revalidatePath("/pedidos");
  if (workId) {
    revalidatePath(`/pedidos/${workId}`);
    revalidatePath(`/obras/${workId}`);
  }
  revalidatePath("/obras");
  revalidatePath("/obras/reports");
  revalidatePath("/finance/deudas");
  revalidatePath("/finance/balance-general");
  revalidatePath("/finance/movimientos-internos");
}

export async function createWorkOrderAction(
  raw: unknown,
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = createWorkOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del pedido.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    const orderId = await createWorkOrder({
      workId: d.workId,
      orderDate: d.orderDate,
      supplier: d.supplier,
      material: d.material,
      description: d.description || undefined,
      userId: currentUserId(),
    });
    revalidateOrderSurfaces(d.workId);
    return { ok: true, data: { orderId } };
  } catch {
    return { ok: false, error: "No se pudo registrar el pedido." };
  }
}

export async function quoteWorkOrderAction(raw: unknown): Promise<ActionResult> {
  const parsed = quoteWorkOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa el monto del pedido.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    await quoteWorkOrder({
      orderId: d.orderId,
      quoteDate: d.quoteDate,
      category: d.category,
      amount: d.amount,
      advanceAmount: d.registerAdvance ? d.advanceAmount : undefined,
      advancePaymentMethodId: d.registerAdvance ? d.advancePaymentMethodId : undefined,
      userId: currentUserId(),
    });
    const order = await getWorkOrder(d.orderId);
    revalidateOrderSurfaces(order?.work_id);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "No se pudo asignar el monto.",
    };
  }
}

export async function editWorkOrderAction(raw: unknown): Promise<ActionResult> {
  const parsed = editWorkOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del pedido.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    await updateWorkOrder(d.orderId, {
      supplier: d.supplier,
      material: d.material,
      amount: d.amount ?? null,
    }, d.note);
    revalidateOrderSurfaces(d.workId);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo editar el pedido.",
    };
  }
}

export async function registerWorkOrderPaymentAction(
  raw: unknown,
): Promise<ActionResult> {
  const parsed = registerWorkOrderPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del abono.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    const d = parsed.data;
    await registerWorkOrderPayment({
      orderId: d.orderId,
      paymentDate: d.paymentDate,
      description: d.description || undefined,
      amount: d.amount,
      paymentMethodId: d.paymentMethodId,
      userId: currentUserId(),
    });
    const order = await getWorkOrder(d.orderId);
    revalidateOrderSurfaces(order?.work_id);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo registrar el abono.",
    };
  }
}

export async function editWorkOrderPaymentAction(raw: unknown): Promise<ActionResult> {
  const parsed = editOrderPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa los datos del abono.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  try {
    const d = parsed.data;
    await updateWorkOrderPayment(
      d.paymentId,
      {
        description: d.description,
        amount: d.amount,
        paymentDate: d.paymentDate,
        paymentMethodId: d.paymentMethodId,
      },
      d.note,
    );
    revalidateOrderSurfaces(d.workId);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo editar el abono.",
    };
  }
}

export async function deleteWorkOrderPaymentAction(raw: unknown): Promise<ActionResult> {
  const parsed = deleteOrderPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Escribe el motivo de la eliminación.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }
  try {
    const d = parsed.data;
    await deleteWorkOrderPayment(d.paymentId, d.note);
    revalidateOrderSurfaces(d.workId);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo eliminar el abono.",
    };
  }
}
