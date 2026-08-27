import "server-only";

import { randomUUID } from "crypto";
import { WORK_CATEGORIES } from "@/lib/constants";
import {
  RECEIPT_PREFIX,
  formatReceiptCode,
  parseReceiptSeq,
  type ReceiptData,
} from "@/lib/receipt";
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
  WorkFile,
  Client,
  PaymentMethod,
} from "@/lib/types";
import { WORK_FILE_MAX_BYTES, WORK_FILES_BUCKET } from "@/lib/constants";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/features/auth/get-user";
import { writeAudit } from "./audit";

export interface WorkFilters {
  search?: string;
  client?: string;
  status?: WorkFilterStatus | "all";
}

type Row = Record<string, unknown>;
const SUPABASE_PAGE_SIZE = 1000;

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
    address: (r.address as string) ?? null,
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
    folio: (r.folio as string) ?? null,
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

function mapWorkFile(r: Row): WorkFile {
  return {
    id: r.id as string,
    work_id: r.work_id as string,
    file_name: r.file_name as string,
    storage_path: r.storage_path as string,
    mime_type: (r.mime_type as string) ?? null,
    size_bytes: Number(r.size_bytes ?? 0),
    created_at: r.created_at as string,
    created_by: (r.created_by as string) ?? null,
  };
}

function percentOf(value: number, total: number | null): number | null {
  if (total === null || total <= 0.001) return null;
  return round2((value / total) * 100);
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

function enrichRow(r: Row, movements: WorkMovement[] = []): WorkWithFinance | null {
  const client = r.client as Row | null;
  if (!client) return null;
  return {
    ...mapWork(r),
    client: mapClient(client),
    finance: computeWorkFinance(movements),
    files: [],
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

const WORK_SELECT = "*, client:clients(*)";

async function listWorkMovementRows({
  select = "*",
  workId,
  category,
  includeMethod = false,
}: {
  select?: string;
  workId?: string;
  category?: string;
  includeMethod?: boolean;
} = {}): Promise<Row[]> {
  const rows: Row[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    let query = sb()
      .from("work_movements")
      .select(includeMethod ? "*, method:payment_accounts(id, name, created_at)" : select)
      .eq("status", 1);

    if (workId) {
      query = query
        .eq("work_id", workId)
        .order("movement_date", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
    } else {
      query = query
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
    }
    if (category) query = query.eq("category", category);

    const { data, error } = await query.range(from, to);
    if (error) throw new Error(error.message);

    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }

  return rows;
}

async function listWorkMovementsByWorkIds(workIds: string[]): Promise<Map<string, WorkMovement[]>> {
  const movementsByWork = new Map<string, WorkMovement[]>();
  if (workIds.length === 0) return movementsByWork;

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await sb()
      .from("work_movements")
      .select("*")
      .eq("status", 1)
      .in("work_id", workIds)
      .order("work_id", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);

    const page = ((data ?? []) as unknown as Row[]).map(mapMovement);
    for (const movement of page) {
      const bucket = movementsByWork.get(movement.work_id) ?? [];
      bucket.push(movement);
      movementsByWork.set(movement.work_id, bucket);
    }
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }

  return movementsByWork;
}

async function listWorkFilesByWorkIds(workIds: string[]): Promise<Map<string, WorkFile[]>> {
  const filesByWork = new Map<string, WorkFile[]>();
  if (!workIds.length) return filesByWork;

  const { data, error } = await sb()
    .from("work_files")
    .select("*")
    .in("work_id", workIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  for (const file of (data ?? []).map(mapWorkFile)) {
    const bucket = filesByWork.get(file.work_id) ?? [];
    bucket.push(file);
    filesByWork.set(file.work_id, bucket);
  }

  return filesByWork;
}

async function listConfiguredWorkCategories(): Promise<string[]> {
  const { data, error } = await sb()
    .from("work_categories")
    .select("name")
    .eq("status", 1)
    .order("name", { ascending: true });

  if (error) {
    return ["Abono de obra", ...WORK_CATEGORIES.filter((item) => item !== "Abono de obra")];
  }

  const categories = (data ?? [])
    .map((row) => String(row.name ?? "").trim())
    .filter(Boolean);

  return ["Abono de obra", ...categories.filter((item) => item !== "Abono de obra")];
}

/* ----------------------------------------------------------------- reads */

export async function listWorks(filters: WorkFilters = {}): Promise<WorkWithFinance[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await sb().from("works").select(WORK_SELECT).eq("status", 1);
  const workRows = (data ?? []) as Row[];
  const movementsByWork = await listWorkMovementsByWorkIds(
    workRows.map((work) => work.id as string).filter(Boolean),
  );

  const search = filters.search?.trim().toLowerCase();
  const client = filters.client?.trim().toLowerCase();

  const works = workRows
    .map((row) => enrichRow(row, movementsByWork.get(row.id as string) ?? []))
    .filter((w): w is WorkWithFinance => w !== null)
    .filter((w) => {
      if (
        search &&
        !w.name.toLowerCase().includes(search) &&
        !(w.address?.toLowerCase().includes(search) ?? false)
      )
        return false;
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

  const filesByWork = await listWorkFilesByWorkIds(works.map((work) => work.id));
  return works.map((work) => ({
    ...work,
    files: filesByWork.get(work.id) ?? [],
  }));
}

export async function getWork(id: string): Promise<WorkWithFinance | null> {
  if (!isAdminConfigured()) return null;
  const [workRes, movements] = await Promise.all([
    sb().from("works").select(WORK_SELECT).eq("id", id).maybeSingle(),
    movementsOf(id),
  ]);
  const work = workRes.data ? enrichRow(workRes.data as Row, movements) : null;
  if (!work) return null;
  const filesByWork = await listWorkFilesByWorkIds([id]);
  return { ...work, files: filesByWork.get(id) ?? [] };
}

async function movementsOf(workId: string): Promise<WorkMovement[]> {
  return (await listWorkMovementRows({ workId })).map(mapMovement);
}

export async function listWorkMovements(workId: string): Promise<WorkMovementWithBalance[]> {
  if (!isAdminConfigured()) return [];
  const sorted = await listWorkMovementRows({ workId, includeMethod: true });
  let balance = 0;
  return sorted.map((r) => {
    const m = mapMovement(r);
    balance = round2(balance + (m.movement_type === "income" ? m.amount : -m.amount));
    return { ...m, balance, method: r.method ? mapMethod(r.method as Row) : null };
  });
}

export async function getWorkCategorySummary(workId: string): Promise<WorkCategorySummary[]> {
  if (!isAdminConfigured()) return [];
  const [movements, configuredCategories, budgetRes] = await Promise.all([
    movementsOf(workId),
    listConfiguredWorkCategories(),
    sb()
      .from("work_category_budgets")
      .select("category, amount, executed_amount")
      .eq("work_id", workId),
  ]);

  if (budgetRes.error) throw new Error(budgetRes.error.message);

  const budgets = new Map<string, number>();
  const executedAmounts = new Map<string, number>();
  for (const row of budgetRes.data ?? []) {
    budgets.set(String(row.category), Number(row.amount));
    executedAmounts.set(String(row.category), Number(row.executed_amount ?? 0));
  }

  const rows = new Map<string, WorkCategorySummary>();
  const allCategories = new Set<string>([
    ...configuredCategories,
    ...movements.map((movement) => movement.category),
    ...budgets.keys(),
  ]);

  for (const category of allCategories) {
    const budget = budgets.get(category) ?? null;
    rows.set(category, {
      category,
      budget,
      income: 0,
      expense: 0,
      balance: 0,
      executedAmount: executedAmounts.get(category) ?? null,
      incomePercent: percentOf(0, budget),
      expensePercent: percentOf(0, budget),
      executedPercent: percentOf(executedAmounts.get(category) ?? 0, budget),
    });
  }

  for (const m of movements) {
    const current =
      rows.get(m.category) ??
      {
        category: m.category,
        budget: budgets.get(m.category) ?? null,
        income: 0,
        expense: 0,
        balance: 0,
        executedAmount: executedAmounts.get(m.category) ?? null,
        incomePercent: null,
        expensePercent: null,
        executedPercent: null,
      };
    const row = { ...current };
    if (m.movement_type === "income") row.income = round2(row.income + m.amount);
    else row.expense = round2(row.expense + m.amount);
    rows.set(m.category, row);
  }
  return [...rows.values()]
    .map((row) => {
      const balance = round2(row.income - row.expense);
      return {
        ...row,
        balance,
        executedAmount: row.executedAmount,
        incomePercent: percentOf(row.income, row.budget),
        expensePercent: percentOf(row.expense, row.budget),
        executedPercent: percentOf(row.executedAmount ?? 0, row.budget),
      };
    })
    .filter((row) => row.income > 0 || row.expense > 0 || (row.budget ?? 0) > 0)
    .sort((a, b) => {
      if (a.category === "Abono de obra") return -1;
      if (b.category === "Abono de obra") return 1;
      const budgetDiff = (b.budget ?? 0) - (a.budget ?? 0);
      if (Math.abs(budgetDiff) > 0.001) return budgetDiff;
      return a.category.localeCompare(b.category, "es");
    });
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
  const [methodsRes, movementRows, transfersRes] = await Promise.all([
    client.from("payment_accounts").select("id, name").eq("status", 1),
    listWorkMovementRows({ select: "payment_method_id, movement_type, amount" }),
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
  for (const mv of movementRows) {
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
  const data = await listWorkMovementRows({
    select: "category, movement_date, amount",
    category: "Honorarios",
  });
  const byMonth = new Map<string, number>();
  for (const m of data) {
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
  address?: string;
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
      address: data.address?.trim() || null,
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
      address: data.address?.trim() || null,
      client_id: clientId,
      work_status: data.status,
      description: data.description?.trim() || null,
    })
    .eq("id", data.id);
  if (error) throw new Error(error.message);
}

export interface RegisterWorkMovementData {
  workId: string;
  receipt?: string;
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

export async function nextWorkFolioCode(): Promise<string> {
  const { data } = await sb()
    .from("work_movements")
    .select("folio, receipt")
    .or(`folio.like.${RECEIPT_PREFIX.obra}-%,receipt.like.${RECEIPT_PREFIX.obra}-%`)
    .order("folio", { ascending: false, nullsFirst: false })
    .limit(1);
  const latest = (data?.[0]?.folio as string | undefined) ?? (data?.[0]?.receipt as string | undefined);
  const seq = parseReceiptSeq("obra", latest) + 1;
  return formatReceiptCode("obra", seq);
}

export async function registerWorkMovement(
  data: RegisterWorkMovementData,
): Promise<{ id: string; receiptCode: string | null }> {
  const folio = await nextWorkFolioCode();
  const { data: row, error } = await sb()
    .from("work_movements")
    .insert({
      work_id: data.workId,
      folio,
      receipt: data.receipt?.trim() || null,
      movement_date: data.movementDate,
      concept: data.concept.trim(),
      supplier: data.supplier?.trim() || "Cliente",
      category: data.category,
      movement_type: data.movementType,
      amount: data.amount,
      payment_method_id: data.paymentMethodId,
      observations: data.observations?.trim() || null,
      created_by: await getCurrentUserId(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await writeAudit({
    entityType: "work_movement",
    entityId: row.id as string,
    operation: "create",
    amount: data.amount,
    description: `${data.movementType === "income" ? "Ingreso" : "Egreso"} · ${data.concept.trim()}`,
  });
  return { id: row.id as string, receiptCode: folio };
}

export interface WorkMovementEditData {
  receipt?: string;
  movementDate: string;
  concept: string;
  supplier?: string;
  category: string;
  amount: number;
  paymentMethodId: string;
  observations?: string;
}

async function workMovementSnapshot(id: string) {
  const { data } = await sb()
    .from("work_movements")
    .select(
      "id, work_id, folio, receipt, movement_date, concept, supplier, category, movement_type, amount, payment_method_id, observations, status, work:works(name)",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Edita un movimiento de obra. El saldo se recalcula solo (suma de status=1). */
export async function updateWorkMovement(
  id: string,
  patch: WorkMovementEditData,
  note: string,
): Promise<void> {
  const before = await workMovementSnapshot(id);
  if (!before || (before.status as number) === 0) {
    throw new Error("Movimiento no encontrado.");
  }
  const update = {
    receipt: (patch.receipt ?? (before.receipt as string) ?? "").trim() || null,
    movement_date: patch.movementDate,
    concept: patch.concept.trim(),
    supplier: patch.supplier?.trim() || "Cliente",
    category: patch.category,
    amount: patch.amount,
    payment_method_id: patch.paymentMethodId,
    observations: patch.observations?.trim() || null,
  };
  const { error } = await sb().from("work_movements").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  const workName = (before.work as { name?: string } | null)?.name ?? "";
  await writeAudit({
    entityType: "work_movement",
    entityId: id,
    operation: "update",
    note,
    amount: patch.amount,
    description: `${before.movement_type === "income" ? "Ingreso" : "Egreso"} · ${workName}`,
    snapshot: {
      before: {
        concept: before.concept,
        folio: before.folio,
        receipt: before.receipt,
        amount: Number(before.amount),
        movement_date: before.movement_date,
        supplier: before.supplier,
        category: before.category,
        payment_method_id: before.payment_method_id,
        observations: before.observations,
      },
      after: update,
    },
  });
}

/** Elimina (soft, status=0) un movimiento de obra. El saldo se recalcula solo. */
export async function deleteWorkMovement(id: string, note: string): Promise<void> {
  const before = await workMovementSnapshot(id);
  if (!before || (before.status as number) === 0) {
    throw new Error("Movimiento no encontrado.");
  }
  const { error } = await sb().from("work_movements").update({ status: 0 }).eq("id", id);
  if (error) throw new Error(error.message);

  const workName = (before.work as { name?: string } | null)?.name ?? "";
  await writeAudit({
    entityType: "work_movement",
    entityId: id,
    operation: "delete",
    note,
    amount: Number(before.amount),
    description: `${before.movement_type === "income" ? "Ingreso" : "Egreso"} · ${workName}`,
    snapshot: {
      before: {
        concept: before.concept,
        folio: before.folio,
        receipt: before.receipt,
        amount: Number(before.amount),
        movement_date: before.movement_date,
        supplier: before.supplier,
        category: before.category,
        payment_method_id: before.payment_method_id,
        movement_type: before.movement_type,
      },
    },
  });
}

export async function getWorkMovementReceipt(id: string): Promise<ReceiptData | null> {
  if (!isAdminConfigured()) return null;
  const { data } = await sb()
    .from("work_movements")
    .select(
      "amount, concept, movement_date, folio, receipt, movement_type, supplier, signature, work:works(name, client:clients(name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const work = data.work as { name?: string; client?: { name?: string } } | null;
  const isIncome = data.movement_type === "income";
  return {
    docType: isIncome ? "abono" : "egreso",
    kind: "obra",
    code: ((data.folio as string) ?? (data.receipt as string)) ?? null,
    amount: Number(data.amount),
    concept: data.concept as string,
    date: data.movement_date as string,
    clientName: isIncome ? (work?.client?.name ?? "") : ((data.supplier as string | null) ?? ""),
    subjectName: work?.name ?? "",
    signature: (data.signature as string) ?? null,
  };
}

/** Guarda la firma dibujada del recibo de abono de obra. */
export async function setWorkMovementSignature(id: string, signature: string): Promise<void> {
  const { error } = await sb()
    .from("work_movements")
    .update({ signature, signed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("movement_type", "income");
  if (error) throw new Error(error.message);
}

export async function deleteWork(id: string): Promise<void> {
  const { error } = await sb().from("works").update({ status: 0 }).eq("id", id);
  if (error) throw new Error(error.message);
}

function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf(".");
  const baseName = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const extension = lastDot > 0 ? trimmed.slice(lastDot) : "";
  const safeBase = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();
  return `${safeBase || "archivo"}${safeExtension}`;
}

async function ensureWorkFilesBucket(): Promise<void> {
  const admin = sb();
  const { data, error } = await admin.storage.getBucket(WORK_FILES_BUCKET);
  if (!error && data) return;

  const { error: createError } = await admin.storage.createBucket(WORK_FILES_BUCKET, {
    public: false,
    fileSizeLimit: `${WORK_FILE_MAX_BYTES}`,
  });
  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(createError.message);
  }
}

export async function uploadWorkFile(workId: string, file: File): Promise<WorkFile> {
  if (!isAdminConfigured()) throw new Error("Supabase no está configurado.");
  if (!file.size) throw new Error("Selecciona un archivo válido.");
  if (file.size > WORK_FILE_MAX_BYTES) {
    throw new Error("El archivo supera el límite de 15 MB.");
  }

  await ensureWorkFilesBucket();

  const safeName = sanitizeFileName(file.name);
  const storagePath = `${workId}/${Date.now()}-${randomUUID()}-${safeName}`;
  const bucket = sb().storage.from(WORK_FILES_BUCKET);
  const { error: uploadError } = await bucket.upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await sb()
    .from("work_files")
    .insert({
      work_id: workId,
      file_name: file.name.trim(),
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
      created_by: null,
    })
    .select("*")
    .single();

  if (error) {
    await bucket.remove([storagePath]);
    throw new Error(error.message);
  }

  return mapWorkFile(data as Row);
}

export async function deleteWorkFile(fileId: string): Promise<void> {
  const { data, error } = await sb()
    .from("work_files")
    .select("id, storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Archivo no encontrado.");

  const { error: storageError } = await sb()
    .storage
    .from(WORK_FILES_BUCKET)
    .remove([data.storage_path as string]);
  if (storageError) throw new Error(storageError.message);

  const { error: deleteError } = await sb().from("work_files").delete().eq("id", fileId);
  if (deleteError) throw new Error(deleteError.message);
}

export async function getWorkFileViewUrl(fileId: string): Promise<string> {
  const { data, error } = await sb()
    .from("work_files")
    .select("storage_path")
    .eq("id", fileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Archivo no encontrado.");

  const { data: signed, error: signedError } = await sb()
    .storage
    .from(WORK_FILES_BUCKET)
    .createSignedUrl(data.storage_path as string, 60 * 15);
  if (signedError || !signed?.signedUrl) {
    throw new Error(signedError?.message ?? "No se pudo generar el enlace del archivo.");
  }

  return signed.signedUrl;
}

export async function saveWorkCategoryBudget(
  workId: string,
  category: string,
  budget: number,
  executedAmount: number,
): Promise<WorkCategorySummary[]> {
  const trimmedCategory = category.trim();
  const admin = sb();

  const payload = {
    work_id: workId,
    category: trimmedCategory,
    amount: round2(budget),
    executed_amount: round2(executedAmount),
    created_by: null,
  };

  const { error } = await admin
    .from("work_category_budgets")
    .upsert(payload, { onConflict: "work_id,category" });
  if (error) throw new Error(error.message);

  return getWorkCategorySummary(workId);
}
