import "server-only";

import { WORK_CATEGORIES } from "@/lib/constants";
import { round2 } from "@/lib/calculations";
import type {
  WorkAdministrationUtilityRow,
  WorkCategorySummary,
  PaymentMethodReportRow,
  WorkFilterStatus,
  WorkInternalTransferWithMethods,
  WorkMovement,
  WorkMovementType,
  WorkMovementWithBalance,
  WorkStatus,
  WorkWithFinance,
  Work,
  Client,
  PaymentMethod,
} from "@/lib/types";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/features/auth/get-user";

export interface WorkFilters {
  search?: string;
  client?: string;
  status?: WorkFilterStatus | "all";
}

type Row = Record<string, unknown>;

function sb() {
  return createAdminClient();
}

function mapClient(r: Row): Client {
  return {
    id: r.id as string,
    name: r.name as string,
    created_at: r.created_at as string,
    updated_at: (r.updated_at as string) ?? (r.created_at as string),
    created_by: (r.created_by as string) ?? null,
  };
}

function mapMethod(r: Row): PaymentMethod {
  return {
    id: r.id as string,
    name: r.name as string,
    is_active: true,
    created_at: r.created_at as string,
  };
}

function mapWork(r: Row): Work {
  return {
    id: r.id as string,
    client_id: r.client_id as string,
    name: r.name as string,
    status: (r.work_status as WorkStatus) ?? "active",
    description: (r.description as string) ?? null,
    created_at: r.created_at as string,
    updated_at: (r.updated_at as string) ?? (r.created_at as string),
    created_by: (r.created_by as string) ?? null,
  };
}

function mapMovement(r: Row): WorkMovement {
  return {
    id: r.id as string,
    work_id: r.work_id as string,
    receipt: (r.receipt as string) ?? "",
    movement_date: r.movement_date as string,
    concept: r.concept as string,
    supplier: (r.supplier as string) ?? "Cliente",
    category: (r.category as string) ?? "",
    movement_type: r.movement_type as WorkMovementType,
    amount: Number(r.amount),
    payment_method_id: (r.payment_method_id as string) ?? "",
    observations: (r.observations as string) ?? null,
    created_at: r.created_at as string,
    created_by: (r.created_by as string) ?? null,
  };
}

function computeWorkFinance(movements: WorkMovement[]) {
  const income = round2(
    movements.filter((m) => m.movement_type === "income").reduce((s, m) => s + m.amount, 0),
  );
  const expense = round2(
    movements.filter((m) => m.movement_type === "expense").reduce((s, m) => s + m.amount, 0),
  );
  const lastMovementDate =
    movements.map((m) => m.movement_date).sort((a, b) => b.localeCompare(a))[0] ?? null;
  return {
    income,
    expense,
    balance: round2(income - expense),
    movementsCount: movements.length,
    lastMovementDate,
  };
}

function enrichRow(r: Row): WorkWithFinance | null {
  const client = r.client as Row | null;
  if (!client) return null;
  const movements = ((r.movements as Row[]) ?? [])
    .filter((m) => (m.status as number) !== 0)
    .map(mapMovement);
  return {
    ...mapWork(r),
    client: mapClient(client),
    finance: computeWorkFinance(movements),
  };
}

async function findOrCreateClientId(
  clientId: string | undefined,
  clientName: string | undefined,
): Promise<string> {
  const client = sb();
  if (clientId) {
    const { data } = await client.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (data) return data.id as string;
  }
  const trimmed = (clientName ?? "").trim();
  const { data: dup } = await client
    .from("clients")
    .select("id")
    .eq("status", 1)
    .ilike("name", trimmed)
    .maybeSingle();
  if (dup) return dup.id as string;
  const { data: created, error } = await client
    .from("clients")
    .insert({ name: trimmed, created_by: await getCurrentUserId() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

const WORK_SELECT = "*, client:clients(*), movements:work_movements(*)";

/* ----------------------------------------------------------------- reads */

export async function listWorks(filters: WorkFilters = {}): Promise<WorkWithFinance[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await sb().from("works").select(WORK_SELECT).eq("status", 1);

  const search = filters.search?.trim().toLowerCase();
  const client = filters.client?.trim().toLowerCase();

  return (data ?? [])
    .map(enrichRow)
    .filter((w): w is WorkWithFinance => w !== null)
    .filter((w) => {
      if (search && !w.name.toLowerCase().includes(search)) return false;
      if (client && !w.client.name.toLowerCase().includes(client)) return false;
      if (filters.status && filters.status !== "all") {
        if (filters.status === "debtor") return w.finance.balance < -0.001;
        if (filters.status === "active")
          return w.status === "active" && w.finance.balance >= -0.001;
        if (filters.status === "finished") return w.status === "finished";
      }
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function getWork(id: string): Promise<WorkWithFinance | null> {
  if (!isAdminConfigured()) return null;
  const { data } = await sb().from("works").select(WORK_SELECT).eq("id", id).maybeSingle();
  return data ? enrichRow(data) : null;
}

async function movementsOf(workId: string): Promise<WorkMovement[]> {
  const { data } = await sb()
    .from("work_movements")
    .select("*")
    .eq("work_id", workId)
    .eq("status", 1);
  return (data ?? []).map(mapMovement);
}

export async function listWorkMovements(workId: string): Promise<WorkMovementWithBalance[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await sb()
    .from("work_movements")
    .select("*, method:payment_accounts(id, name, created_at)")
    .eq("work_id", workId)
    .eq("status", 1);
  const sorted = (data ?? []).sort((a, b) => {
    const byDate = (a.movement_date as string).localeCompare(b.movement_date as string);
    if (byDate !== 0) return byDate;
    return (a.created_at as string).localeCompare(b.created_at as string);
  });
  let balance = 0;
  return sorted.map((r) => {
    const m = mapMovement(r);
    balance = round2(balance + (m.movement_type === "income" ? m.amount : -m.amount));
    return { ...m, balance, method: r.method ? mapMethod(r.method as Row) : null };
  });
}

export async function getWorkCategorySummary(workId: string): Promise<WorkCategorySummary[]> {
  if (!isAdminConfigured()) return [];
  const movements = await movementsOf(workId);
  const rows = new Map<string, WorkCategorySummary>();
  for (const category of WORK_CATEGORIES) {
    rows.set(category, { category, income: 0, expense: 0, balance: 0 });
  }
  for (const m of movements) {
    const row = rows.get(m.category) ?? { category: m.category, income: 0, expense: 0, balance: 0 };
    if (m.movement_type === "income") row.income = round2(row.income + m.amount);
    else row.expense = round2(row.expense + m.amount);
    rows.set(m.category, row);
  }
  return [...rows.values()]
    .map((row) => ({ ...row, balance: round2(row.income - row.expense) }))
    .filter((row) => row.income > 0 || row.expense > 0)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
}

export async function getWorkAdministrationUtilities(
  workId: string,
): Promise<WorkAdministrationUtilityRow[]> {
  if (!isAdminConfigured()) return [];
  const movements = await movementsOf(workId);
  const byMonth = new Map<string, number>();
  for (const m of movements) {
    if (m.category !== "Honorarios") continue;
    const month = m.movement_date.slice(0, 7);
    byMonth.set(month, round2((byMonth.get(month) ?? 0) + m.amount));
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount: round2(amount) }));
}

export async function getWorksPaymentMethodReport(): Promise<PaymentMethodReportRow[]> {
  if (!isAdminConfigured()) return [];
  const client = sb();
  const [methodsRes, movementsRes, transfersRes] = await Promise.all([
    client.from("payment_accounts").select("id, name").eq("status", 1),
    client.from("work_movements").select("payment_method_id, movement_type, amount").eq("status", 1),
    client
      .from("work_internal_transfers")
      .select("from_payment_method_id, to_payment_method_id, amount")
      .eq("status", 1),
  ]);

  const rows = new Map<string, PaymentMethodReportRow>();
  for (const m of methodsRes.data ?? []) {
    rows.set(m.id as string, {
      methodId: m.id as string,
      methodName: m.name as string,
      clientMovements: 0,
      internalMovements: 0,
      finalBalance: 0,
    });
  }
  for (const mv of movementsRes.data ?? []) {
    const row = rows.get(mv.payment_method_id as string);
    if (!row) continue;
    const sign = (mv.movement_type as string) === "income" ? 1 : -1;
    row.clientMovements = round2(row.clientMovements + Number(mv.amount) * sign);
  }
  for (const t of transfersRes.data ?? []) {
    const from = rows.get(t.from_payment_method_id as string);
    const to = rows.get(t.to_payment_method_id as string);
    if (from) from.internalMovements = round2(from.internalMovements - Number(t.amount));
    if (to) to.internalMovements = round2(to.internalMovements + Number(t.amount));
  }
  return [...rows.values()].map((row) => ({
    ...row,
    finalBalance: round2(row.clientMovements + row.internalMovements),
  }));
}

export async function listWorkInternalTransfers(): Promise<WorkInternalTransferWithMethods[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await sb()
    .from("work_internal_transfers")
    .select(
      "*, fromMethod:payment_accounts!work_internal_transfers_from_payment_method_id_fkey(id,name,created_at), toMethod:payment_accounts!work_internal_transfers_to_payment_method_id_fkey(id,name,created_at)",
    )
    .eq("status", 1)
    .order("transfer_date", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    description: r.description as string,
    amount: Number(r.amount),
    transfer_date: r.transfer_date as string,
    from_payment_method_id: (r.from_payment_method_id as string) ?? "",
    to_payment_method_id: (r.to_payment_method_id as string) ?? "",
    created_at: r.created_at as string,
    created_by: (r.created_by as string) ?? null,
    fromMethod: r.fromMethod ? mapMethod(r.fromMethod as Row) : null,
    toMethod: r.toMethod ? mapMethod(r.toMethod as Row) : null,
  }));
}

export async function getWorksAdministrationUtilityReport(): Promise<
  WorkAdministrationUtilityRow[]
> {
  if (!isAdminConfigured()) return [];
  const { data } = await sb()
    .from("work_movements")
    .select("category, movement_date, amount")
    .eq("status", 1)
    .eq("category", "Honorarios");
  const byMonth = new Map<string, number>();
  for (const m of data ?? []) {
    const month = (m.movement_date as string).slice(0, 7);
    byMonth.set(month, round2((byMonth.get(month) ?? 0) + Number(m.amount)));
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount: round2(amount) }));
}

/* ---------------------------------------------------------------- writes */

export interface RegisterWorkInternalTransferData {
  description: string;
  amount: number;
  transferDate: string;
  fromPaymentMethodId: string;
  toPaymentMethodId: string;
  userId: string | null;
}

export async function registerWorkInternalTransfer(
  data: RegisterWorkInternalTransferData,
): Promise<void> {
  if (data.fromPaymentMethodId === data.toPaymentMethodId) {
    throw new Error("Las cuentas deben ser diferentes");
  }
  const { error } = await sb().from("work_internal_transfers").insert({
    description: data.description.trim(),
    amount: data.amount,
    transfer_date: data.transferDate,
    from_payment_method_id: data.fromPaymentMethodId,
    to_payment_method_id: data.toPaymentMethodId,
    created_by: await getCurrentUserId(),
  });
  if (error) throw new Error(error.message);
}

export interface CreateWorkData {
  name: string;
  clientId?: string;
  clientName?: string;
  status: WorkStatus;
  description?: string;
  userId: string | null;
}

export async function createWork(data: CreateWorkData): Promise<string> {
  const clientId = await findOrCreateClientId(data.clientId, data.clientName);
  const { data: work, error } = await sb()
    .from("works")
    .insert({
      client_id: clientId,
      name: data.name.trim(),
      work_status: data.status,
      description: data.description?.trim() || null,
      created_by: await getCurrentUserId(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return work.id as string;
}

export interface UpdateWorkData extends CreateWorkData {
  id: string;
}

export async function updateWork(data: UpdateWorkData): Promise<void> {
  const clientId = await findOrCreateClientId(data.clientId, data.clientName);
  const { error } = await sb()
    .from("works")
    .update({
      name: data.name.trim(),
      client_id: clientId,
      work_status: data.status,
      description: data.description?.trim() || null,
    })
    .eq("id", data.id);
  if (error) throw new Error(error.message);
}

export interface RegisterWorkMovementData {
  workId: string;
  receipt: string;
  movementDate: string;
  concept: string;
  supplier?: string;
  category: string;
  movementType: WorkMovementType;
  amount: number;
  paymentMethodId: string;
  observations?: string;
  userId: string | null;
}

export async function registerWorkMovement(data: RegisterWorkMovementData): Promise<void> {
  const { error } = await sb().from("work_movements").insert({
    work_id: data.workId,
    receipt: data.receipt.trim(),
    movement_date: data.movementDate,
    concept: data.concept.trim(),
    supplier: data.supplier?.trim() || "Cliente",
    category: data.category,
    movement_type: data.movementType,
    amount: data.amount,
    payment_method_id: data.paymentMethodId,
    observations: data.observations?.trim() || null,
    created_by: await getCurrentUserId(),
  });
  if (error) throw new Error(error.message);
}

export async function deleteWork(id: string): Promise<void> {
  const { error } = await sb().from("works").update({ status: 0 }).eq("id", id);
  if (error) throw new Error(error.message);
}
