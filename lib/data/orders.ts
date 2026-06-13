import "server-only";

import { round2 } from "@/lib/calculations";
import type {
  PaymentMethod,
  WorkOrder,
  WorkOrderPaymentWithMethod,
  WorkOrderStatus,
  WorkOrderWithRelations,
  WorkWithFinance,
} from "@/lib/types";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/features/auth/get-user";
import { getWork, listWorks } from "./works";

type Row = Record<string, unknown>;

function sb() {
  return createAdminClient();
}

function mapMethod(r: Row): PaymentMethod {
  return {
    id: r.id as string,
    name: r.name as string,
    is_active: true,
    created_at: r.created_at as string,
  };
}

function mapOrder(r: Row): WorkOrder {
  return {
    id: r.id as string,
    work_id: r.work_id as string,
    order_date: r.order_date as string,
    supplier: r.supplier as string,
    material: r.material as string,
    description: (r.description as string) ?? null,
    category: (r.category as string) ?? null,
    amount: r.amount === null || r.amount === undefined ? null : Number(r.amount),
    quoted_at: (r.quoted_at as string) ?? null,
    payable_movement_id: (r.payable_movement_id as string) ?? null,
    created_at: r.created_at as string,
    updated_at: (r.updated_at as string) ?? (r.created_at as string),
    created_by: (r.created_by as string) ?? null,
  };
}

function mapPayment(r: Row): WorkOrderPaymentWithMethod {
  return {
    id: r.id as string,
    order_id: r.order_id as string,
    payment_date: r.payment_date as string,
    description: r.description as string,
    amount: Number(r.amount),
    payment_method_id: (r.payment_method_id as string) ?? "",
    work_movement_id: (r.work_movement_id as string) ?? null,
    internal_transfer_id: (r.internal_transfer_id as string) ?? null,
    created_at: r.created_at as string,
    created_by: (r.created_by as string) ?? null,
    method: r.method ? mapMethod(r.method as Row) : null,
  };
}

async function accountsPayableMethodId(): Promise<string> {
  const { data } = await sb()
    .from("payment_accounts")
    .select("id")
    .eq("status", 1)
    .ilike("name", "cuentas por pagar")
    .maybeSingle();
  if (!data) throw new Error("No existe la forma de pago Cuentas por pagar");
  return data.id as string;
}

function statusFor(amount: number | null, paid: number, pending: number): WorkOrderStatus {
  if (amount === null) return "pending_quote";
  if (pending <= 0.001) return "paid";
  if (paid > 0.001) return "partial";
  return "quoted";
}

async function paymentsOf(orderId: string): Promise<WorkOrderPaymentWithMethod[]> {
  const { data } = await sb()
    .from("work_order_payments")
    .select("*, method:payment_accounts(id, name, created_at)")
    .eq("order_id", orderId)
    .eq("status", 1);
  return (data ?? [])
    .map(mapPayment)
    .sort((a, b) => {
      const byDate = a.payment_date.localeCompare(b.payment_date);
      if (byDate !== 0) return byDate;
      return a.created_at.localeCompare(b.created_at);
    });
}

async function enrich(order: WorkOrder): Promise<WorkOrderWithRelations | null> {
  const work = await getWork(order.work_id);
  if (!work) return null;
  const payments = await paymentsOf(order.id);
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
  const amount = order.amount ?? 0;
  const pending = order.amount === null ? 0 : round2(Math.max(amount - paid, 0));
  return { ...order, work, payments, paid, pending, status: statusFor(order.amount, paid, pending) };
}

export async function listOrderWorks(): Promise<
  Array<
    WorkWithFinance & {
      ordersCount: number;
      pendingOrdersCount: number;
      ordersAmount: number;
      ordersPaid: number;
      ordersPending: number;
    }
  >
> {
  if (!isAdminConfigured()) return [];
  const client = sb();
  const [works, ordersRes, paymentsRes] = await Promise.all([
    listWorks(),
    client.from("work_orders").select("id, work_id, amount").eq("status", 1),
    client.from("work_order_payments").select("order_id, amount").eq("status", 1),
  ]);

  const orders = ordersRes.data ?? [];
  const paidByOrder = new Map<string, number>();
  for (const p of paymentsRes.data ?? []) {
    const id = p.order_id as string;
    paidByOrder.set(id, round2((paidByOrder.get(id) ?? 0) + Number(p.amount)));
  }

  return works.map((work) => {
    const workOrders = orders.filter((o) => (o.work_id as string) === work.id);
    const ordersAmount = round2(workOrders.reduce((s, o) => s + Number(o.amount ?? 0), 0));
    const ordersPaid = round2(
      workOrders.reduce((s, o) => s + (paidByOrder.get(o.id as string) ?? 0), 0),
    );
    return {
      ...work,
      ordersCount: workOrders.length,
      pendingOrdersCount: workOrders.filter((o) => o.amount === null).length,
      ordersAmount,
      ordersPaid,
      ordersPending: round2(Math.max(ordersAmount - ordersPaid, 0)),
    };
  });
}

export async function listWorkOrders(workId: string): Promise<WorkOrderWithRelations[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await sb()
    .from("work_orders")
    .select("*")
    .eq("work_id", workId)
    .eq("status", 1)
    .order("order_date", { ascending: false });
  const rows = await Promise.all((data ?? []).map((r) => enrich(mapOrder(r))));
  return rows.filter((row): row is WorkOrderWithRelations => row !== null);
}

export async function getWorkOrder(id: string): Promise<WorkOrderWithRelations | null> {
  if (!isAdminConfigured()) return null;
  const { data } = await sb().from("work_orders").select("*").eq("id", id).maybeSingle();
  return data ? enrich(mapOrder(data)) : null;
}

export interface CreateWorkOrderData {
  workId: string;
  orderDate: string;
  supplier: string;
  material: string;
  description?: string;
  userId: string | null;
}

export async function createWorkOrder(data: CreateWorkOrderData): Promise<string> {
  if (!data.supplier || data.supplier.trim().length < 2) {
    throw new Error("Proveedor inválido");
  }
  const { data: order, error } = await sb()
    .from("work_orders")
    .insert({
      work_id: data.workId,
      order_date: data.orderDate,
      supplier: data.supplier.trim(),
      material: data.material.trim(),
      description: data.description?.trim() || null,
      created_by: await getCurrentUserId(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return order.id as string;
}

export interface QuoteWorkOrderData {
  orderId: string;
  quoteDate: string;
  category: string;
  amount: number;
  advanceAmount?: number;
  advancePaymentMethodId?: string;
  userId: string | null;
}

export async function quoteWorkOrder(data: QuoteWorkOrderData): Promise<void> {
  const client = sb();
  const userId = await getCurrentUserId();
  const { data: orderRow } = await client
    .from("work_orders")
    .select("*")
    .eq("id", data.orderId)
    .maybeSingle();
  if (!orderRow) throw new Error("Pedido no encontrado");
  const order = mapOrder(orderRow);
  if (order.amount !== null) throw new Error("El pedido ya tiene monto");

  const amount = round2(data.amount);
  const advance = round2(data.advanceAmount ?? 0);
  if (advance > amount) throw new Error("El adelanto no puede superar el total");

  const payableMethodId = await accountsPayableMethodId();
  if (advance > 0 && !data.advancePaymentMethodId) {
    throw new Error("Forma de pago inválida");
  }

  const updates: Record<string, unknown> = {
    amount,
    category: data.category,
    quoted_at: data.quoteDate,
  };

  if (advance > 0 && data.advancePaymentMethodId) {
    const { data: mv, error } = await client
      .from("work_movements")
      .insert({
        work_id: order.work_id,
        receipt: `PED-${order.id.slice(0, 8)}-A`,
        movement_date: data.quoteDate,
        concept: `Adelanto pedido: ${order.material}`,
        supplier: order.supplier,
        category: data.category,
        movement_type: "expense",
        amount: advance,
        payment_method_id: data.advancePaymentMethodId,
        observations: order.description,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await client.from("work_order_payments").insert({
      order_id: order.id,
      payment_date: data.quoteDate,
      description: "Adelanto del pedido",
      amount: advance,
      payment_method_id: data.advancePaymentMethodId,
      work_movement_id: mv.id,
      created_by: userId,
    });
  }

  const payableAmount = round2(amount - advance);
  if (payableAmount > 0) {
    const { data: mv, error } = await client
      .from("work_movements")
      .insert({
        work_id: order.work_id,
        receipt: `PED-${order.id.slice(0, 8)}-P`,
        movement_date: data.quoteDate,
        concept: `Pedido por pagar: ${order.material}`,
        supplier: order.supplier,
        category: data.category,
        movement_type: "expense",
        amount: payableAmount,
        payment_method_id: payableMethodId,
        observations: order.description,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    updates.payable_movement_id = mv.id;
  }

  await client.from("work_orders").update(updates).eq("id", order.id);
}

export interface RegisterWorkOrderPaymentData {
  orderId: string;
  paymentDate: string;
  description?: string;
  amount: number;
  paymentMethodId: string;
  userId: string | null;
}

export async function registerWorkOrderPayment(
  data: RegisterWorkOrderPaymentData,
): Promise<void> {
  const client = sb();
  const userId = await getCurrentUserId();
  const order = await getWorkOrder(data.orderId);
  if (!order) throw new Error("Pedido no encontrado");
  if (order.amount === null) throw new Error("Primero registra el monto del pedido");

  const amount = round2(data.amount);
  if (amount > order.pending + 0.001) throw new Error("El abono supera el saldo pendiente");

  const payableMethodId = await accountsPayableMethodId();
  if (data.paymentMethodId === payableMethodId) {
    throw new Error("El abono debe salir de una cuenta real");
  }

  const { data: transfer, error } = await client
    .from("work_internal_transfers")
    .insert({
      description: data.description?.trim() || `Abono pedido: ${order.material}`,
      amount,
      transfer_date: data.paymentDate,
      from_payment_method_id: data.paymentMethodId,
      to_payment_method_id: payableMethodId,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await client.from("work_order_payments").insert({
    order_id: order.id,
    payment_date: data.paymentDate,
    description: data.description?.trim() || "Abono del pedido",
    amount,
    payment_method_id: data.paymentMethodId,
    internal_transfer_id: transfer.id,
    created_by: userId,
  });
}
