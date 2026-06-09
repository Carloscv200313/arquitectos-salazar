import "server-only";

import { WORK_PROVIDERS } from "@/lib/constants";
import { round2 } from "@/lib/calculations";
import type {
  PaymentMethod,
  WorkOrder,
  WorkOrderStatus,
  WorkOrderWithRelations,
  WorkWithFinance,
} from "@/lib/types";
import { db, nowISO, uuid } from "./store";
import { getWork, listWorks } from "./works";

function accountsPayableMethod(): PaymentMethod {
  const method = db.methods.find(
    (item) => item.name.toLowerCase() === "cuentas por pagar" && item.is_active,
  );
  if (!method) throw new Error("No existe la forma de pago Cuentas por pagar");
  return method;
}

function orderPayments(orderId: string) {
  return db.workOrderPayments
    .filter((payment) => payment.order_id === orderId)
    .map((payment) => ({
      ...payment,
      method:
        db.methods.find((method) => method.id === payment.payment_method_id) ?? null,
    }))
    .sort((a, b) => {
      const byDate = a.payment_date.localeCompare(b.payment_date);
      if (byDate !== 0) return byDate;
      return a.created_at.localeCompare(b.created_at);
    });
}

function statusFor(order: WorkOrder, paid: number, pending: number): WorkOrderStatus {
  if (order.amount === null) return "pending_quote";
  if (pending <= 0.001) return "paid";
  if (paid > 0.001) return "partial";
  return "quoted";
}

async function enrich(order: WorkOrder): Promise<WorkOrderWithRelations | null> {
  const work = await getWork(order.work_id);
  if (!work) return null;
  const payments = orderPayments(order.id);
  const paid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0));
  const amount = order.amount ?? 0;
  const pending = order.amount === null ? 0 : round2(Math.max(amount - paid, 0));

  return {
    ...order,
    work,
    payments,
    paid,
    pending,
    status: statusFor(order, paid, pending),
  };
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
  const works = await listWorks();
  return works.map((work) => {
    const orders = db.workOrders.filter((order) => order.work_id === work.id);
    const ordersAmount = round2(
      orders.reduce((sum, order) => sum + (order.amount ?? 0), 0),
    );
    const ordersPaid = round2(
      orders.reduce(
        (sum, order) =>
          sum +
          db.workOrderPayments
            .filter((payment) => payment.order_id === order.id)
            .reduce((paymentSum, payment) => paymentSum + payment.amount, 0),
        0,
      ),
    );
    return {
      ...work,
      ordersCount: orders.length,
      pendingOrdersCount: orders.filter((order) => order.amount === null).length,
      ordersAmount,
      ordersPaid,
      ordersPending: round2(Math.max(ordersAmount - ordersPaid, 0)),
    };
  });
}

export async function listWorkOrders(workId: string): Promise<WorkOrderWithRelations[]> {
  const rows = await Promise.all(
    db.workOrders
      .filter((order) => order.work_id === workId)
      .sort((a, b) => b.order_date.localeCompare(a.order_date))
      .map((order) => enrich(order)),
  );
  return rows.filter((row): row is WorkOrderWithRelations => row !== null);
}

export async function getWorkOrder(id: string): Promise<WorkOrderWithRelations | null> {
  const order = db.workOrders.find((item) => item.id === id);
  return order ? enrich(order) : null;
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
  const work = db.works.find((item) => item.id === data.workId);
  if (!work) throw new Error("Obra no encontrada");
  if (!WORK_PROVIDERS.includes(data.supplier as (typeof WORK_PROVIDERS)[number])) {
    throw new Error("Proveedor inválido");
  }

  const ts = nowISO();
  const id = uuid();
  db.workOrders.push({
    id,
    work_id: data.workId,
    order_date: data.orderDate,
    supplier: data.supplier.trim(),
    material: data.material.trim(),
    description: data.description?.trim() || null,
    category: null,
    amount: null,
    quoted_at: null,
    payable_movement_id: null,
    created_at: ts,
    updated_at: ts,
    created_by: data.userId,
  });
  return id;
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
  const order = db.workOrders.find((item) => item.id === data.orderId);
  if (!order) throw new Error("Pedido no encontrado");
  if (order.amount !== null) throw new Error("El pedido ya tiene monto");

  const work = db.works.find((item) => item.id === order.work_id);
  if (!work) throw new Error("Obra no encontrada");

  const amount = round2(data.amount);
  const advance = round2(data.advanceAmount ?? 0);
  if (advance > amount) throw new Error("El adelanto no puede superar el total");

  const payableMethod = accountsPayableMethod();
  const advanceMethod = data.advancePaymentMethodId
    ? db.methods.find(
        (method) => method.id === data.advancePaymentMethodId && method.is_active,
      )
    : null;
  if (advance > 0 && !advanceMethod) throw new Error("Forma de pago inválida");

  const ts = nowISO();
  order.amount = amount;
  order.category = data.category;
  order.quoted_at = data.quoteDate;
  order.updated_at = ts;

  if (advance > 0 && advanceMethod) {
    const movementId = uuid();
    db.workMovements.push({
      id: movementId,
      work_id: order.work_id,
      receipt: `PED-${order.id.slice(0, 8)}-A`,
      movement_date: data.quoteDate,
      concept: `Adelanto pedido: ${order.material}`,
      supplier: order.supplier,
      category: data.category,
      movement_type: "expense",
      amount: advance,
      payment_method_id: advanceMethod.id,
      observations: order.description,
      created_at: ts,
      created_by: data.userId,
    });
    db.workOrderPayments.push({
      id: uuid(),
      order_id: order.id,
      payment_date: data.quoteDate,
      description: "Adelanto del pedido",
      amount: advance,
      payment_method_id: advanceMethod.id,
      work_movement_id: movementId,
      internal_transfer_id: null,
      created_at: ts,
      created_by: data.userId,
    });
  }

  const payableAmount = round2(amount - advance);
  if (payableAmount > 0) {
    const movementId = uuid();
    db.workMovements.push({
      id: movementId,
      work_id: order.work_id,
      receipt: `PED-${order.id.slice(0, 8)}-P`,
      movement_date: data.quoteDate,
      concept: `Pedido por pagar: ${order.material}`,
      supplier: order.supplier,
      category: data.category,
      movement_type: "expense",
      amount: payableAmount,
      payment_method_id: payableMethod.id,
      observations: order.description,
      created_at: ts,
      created_by: data.userId,
    });
    order.payable_movement_id = movementId;
  }
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
  const order = await getWorkOrder(data.orderId);
  if (!order) throw new Error("Pedido no encontrado");
  if (order.amount === null) throw new Error("Primero registra el monto del pedido");

  const amount = round2(data.amount);
  if (amount > order.pending + 0.001) {
    throw new Error("El abono supera el saldo pendiente");
  }

  const method = db.methods.find(
    (item) => item.id === data.paymentMethodId && item.is_active,
  );
  if (!method) throw new Error("Forma de pago inválida");
  const payableMethod = accountsPayableMethod();
  if (method.id === payableMethod.id) {
    throw new Error("El abono debe salir de una cuenta real");
  }

  const ts = nowISO();
  const transferId = uuid();
  db.workInternalTransfers.push({
    id: transferId,
    description:
      data.description?.trim() || `Abono pedido: ${order.material}`,
    amount,
    transfer_date: data.paymentDate,
    from_payment_method_id: method.id,
    to_payment_method_id: payableMethod.id,
    created_at: ts,
    created_by: data.userId,
  });
  db.workOrderPayments.push({
    id: uuid(),
    order_id: order.id,
    payment_date: data.paymentDate,
    description: data.description?.trim() || "Abono del pedido",
    amount,
    payment_method_id: method.id,
    work_movement_id: null,
    internal_transfer_id: transferId,
    created_at: ts,
    created_by: data.userId,
  });
}
