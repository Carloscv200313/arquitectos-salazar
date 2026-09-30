import "server-only";

import { SALARY_PAYMENT_METHOD_NAMES, SEED_PAYMENT_METHODS } from "@/lib/constants";
import { round2 } from "@/lib/calculations";
import {
  SALARY_RECEIPT_PREFIX,
  formatCodeWithPrefix,
  parseSeqWithPrefix,
  type ReceiptData,
} from "@/lib/receipt";
import type {
  DebtReportRow,
  Employee,
  FinanceCapturePaymentForm,
  FinanceCaptureReport,
  FinanceCaptureRow,
  FinanceMovementConcept,
  FinanceMovementTag,
  FinanceUtilityReport,
  GeneralBalanceAccountReport,
  GeneralBalanceHistoryRow,
  GeneralBalanceReport,
  GeneralBalanceRow,
  InternalArea,
  ManualDebtor,
  ManualDebtorDetail,
  ManualDebtorPayment,
  ManualProviderDebt,
  ManualProviderDebtDetail,
  ManualProviderDebtPayment,
  MovementType,
  PaymentMethod,
  ProviderDebtDetail,
  SalaryDayRecordWithRelations,
  SalaryPaymentWithRelations,
  SalaryPaymentType,
  SalaryReport,
  SalaryWeekWithRows,
  SalaryWeekday,
  SalaryWeekStatus,
  TaskType,
  WorkMovementProviderDebt,
} from "@/lib/types";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/features/auth/get-user";
import { deleteProjectMovement, getUtilityReport, listProjects } from "./projects";
import { getWorksAdministrationUtilityReport, listWorks } from "./works";
import { listWorkOrders } from "./orders";
import { writeAudit } from "./audit";

type Row = Record<string, unknown>;
const SUPABASE_PAGE_SIZE = 1000;

function sb() {
  return createAdminClient();
}

async function listWorkMovementRows({
  select = "*",
  paymentMethodId,
  movementType,
}: {
  select?: string;
  paymentMethodId?: string;
  movementType?: "income" | "expense";
} = {}): Promise<Row[]> {
  const rows: Row[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    let query = sb()
      .from("work_movements")
      .select(select)
      .eq("status", 1);

    if (paymentMethodId) query = query.eq("payment_method_id", paymentMethodId);
    if (movementType) query = query.eq("movement_type", movementType);
    query = query
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    const { data, error } = await query.range(from, to);
    if (error) throw new Error(error.message);

    const page = (data ?? []) as unknown as Row[];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }

  return rows;
}

function accountIdFromMethodName(name: string) {
  return name.toLowerCase().replaceAll(" ", "-");
}

const salaryPaymentMethodNames = new Set(
  SALARY_PAYMENT_METHOD_NAMES.map((name) => name.toLowerCase()),
);
function isSalaryPaymentMethodName(name: string) {
  return salaryPaymentMethodNames.has(name.toLowerCase());
}

function num(v: unknown) {
  return Number(v ?? 0);
}

function normalizedFinanceCategory(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const WORK_SALARY_CATEGORIES = new Set(["honorario", "honorarios", "mano de obra"]);

function isWorkSalaryCategory(value: unknown) {
  return WORK_SALARY_CATEGORIES.has(normalizedFinanceCategory(value));
}

async function audit(action: string, recordId: string, description: string) {
  await sb().from("audit_logs").insert({
    user_id: await getCurrentUserId(),
    action,
    table_name: "salary",
    record_id: recordId,
    description,
  });
}

/* ====================================================== GENERAL BALANCE ==== */

async function getUnifiedMethodBalances(): Promise<Map<string, number>> {
  const client = sb();
  const [pp, wm, it, wt, debtorRows, debtorPayments] = await Promise.all([
    client.from("project_payments").select("payment_method_id, movement_type, amount").eq("status", 1),
    listWorkMovementRows({ select: "payment_method_id, movement_type, amount" }),
    client.from("internal_transfers").select("from_payment_method_id, to_payment_method_id, amount").eq("status", 1),
    client.from("work_internal_transfers").select("from_payment_method_id, to_payment_method_id, amount").eq("status", 1),
    client.from("manual_debtors").select("source_account_id, amount").eq("status", 1),
    client.from("manual_debtor_payments").select("to_account_id, amount").eq("status", 1),
  ]);

  const balances = new Map<string, number>();
  const add = (id: string | null, delta: number) => {
    if (!id) return;
    balances.set(id, round2((balances.get(id) ?? 0) + delta));
  };
  for (const p of pp.data ?? [])
    add(p.payment_method_id as string, (p.movement_type as string) === "income" ? num(p.amount) : -num(p.amount));
  for (const m of wm)
    add(m.payment_method_id as string, (m.movement_type as string) === "income" ? num(m.amount) : -num(m.amount));
  for (const t of it.data ?? []) {
    add(t.from_payment_method_id as string, -num(t.amount));
    add(t.to_payment_method_id as string, num(t.amount));
  }
  for (const t of wt.data ?? []) {
    add(t.from_payment_method_id as string, -num(t.amount));
    add(t.to_payment_method_id as string, num(t.amount));
  }
  for (const debtor of debtorRows.data ?? []) {
    add((debtor.source_account_id as string) ?? null, -num(debtor.amount));
  }
  for (const payment of debtorPayments.data ?? []) {
    add((payment.to_account_id as string) ?? null, num(payment.amount));
  }
  return balances;
}

async function loadMethods(): Promise<PaymentMethod[]> {
  const { data } = await sb()
    .from("payment_accounts")
    .select("id, name, created_at")
    .eq("status", 1);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    is_active: true,
    created_at: r.created_at as string,
  }));
}

function mapPaymentAccount(row: Row | null | undefined): PaymentMethod | null {
  if (!row) return null;
  return {
    id: row.id as string,
    name: row.name as string,
    is_active: true,
    created_at: (row.created_at as string) ?? "",
  };
}

function mapManualDebtor(row: Row): ManualDebtor & { account: PaymentMethod | null } {
  return {
    id: row.id as string,
    name: row.name as string,
    amount: num(row.amount),
    source_account_id: (row.source_account_id as string) ?? null,
    project_id: (row.project_id as string) ?? null,
    loan_date: (row.loan_date as string) ?? (row.created_at as string)?.slice(0, 10) ?? "",
    note: (row.note as string) ?? null,
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string) ?? (row.created_at as string),
    created_by: (row.created_by as string) ?? null,
    account: mapPaymentAccount(row.account as Row | null),
  };
}

function mapManualDebtorPayment(row: Row): ManualDebtorPayment {
  return {
    id: row.id as string,
    debtor_id: row.debtor_id as string,
    project_payment_id: (row.project_payment_id as string) ?? null,
    payment_date: row.payment_date as string,
    amount: num(row.amount),
    to_account_id: row.to_account_id as string,
    note: (row.note as string) ?? null,
    created_at: row.created_at as string,
    created_by: (row.created_by as string) ?? null,
    account: mapPaymentAccount(row.account as Row | null),
  };
}

function mapManualProviderDebt(row: Row): ManualProviderDebt {
  return {
    id: row.id as string,
    provider: row.provider as string,
    amount: num(row.amount),
    debt_date: (row.debt_date as string) ?? (row.created_at as string)?.slice(0, 10) ?? "",
    note: (row.note as string) ?? null,
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string) ?? (row.created_at as string),
    created_by: (row.created_by as string) ?? null,
  };
}

function mapManualProviderDebtPayment(row: Row): ManualProviderDebtPayment {
  return {
    id: row.id as string,
    debt_id: row.debt_id as string,
    payment_date: row.payment_date as string,
    amount: num(row.amount),
    note: (row.note as string) ?? null,
    created_at: row.created_at as string,
    created_by: (row.created_by as string) ?? null,
  };
}

async function accountsPayableMethodId(): Promise<string | null> {
  const { data } = await sb()
    .from("payment_accounts")
    .select("id")
    .eq("status", 1)
    .ilike("name", "cuentas por pagar")
    .maybeSingle();
  return data ? (data.id as string) : null;
}

function providerDebtKey(sourceType: "work_order" | "work_movement", sourceId: string) {
  return `${sourceType}:${sourceId}`;
}

async function getProviderDebtSettlements(): Promise<Map<string, number>> {
  const { data } = await sb()
    .from("provider_debt_settlements")
    .select("source_type, source_id, amount")
    .eq("status", 1);
  const settled = new Map<string, number>();
  for (const row of data ?? []) {
    const key = providerDebtKey(row.source_type as "work_order" | "work_movement", row.source_id as string);
    settled.set(key, round2((settled.get(key) ?? 0) + num(row.amount)));
  }
  return settled;
}

async function getAccountsPayableWorkMovementDebts(
  settledBySource: Map<string, number>,
): Promise<WorkMovementProviderDebt[]> {
  const payableMethodId = await accountsPayableMethodId();
  if (!payableMethodId) return [];

  const [works, movementsRes, orderLinksRes] = await Promise.all([
    listWorks(),
    listWorkMovementRows({ paymentMethodId: payableMethodId, movementType: "expense" }),
    sb()
      .from("work_orders")
      .select("payable_movement_id")
      .eq("status", 1)
      .not("payable_movement_id", "is", null),
  ]);

  const workById = new Map(works.map((work) => [work.id, work]));
  const orderPayableMovementIds = new Set(
    (orderLinksRes.data ?? []).map((row) => row.payable_movement_id as string).filter(Boolean),
  );

  return movementsRes
    .filter((movement) => !orderPayableMovementIds.has(movement.id as string))
    .map((movement) => {
      const amount = num(movement.amount);
      const settled = Math.min(amount, settledBySource.get(providerDebtKey("work_movement", movement.id as string)) ?? 0);
      const pending = round2(Math.max(amount - settled, 0));
      const work = workById.get(movement.work_id as string);
      return {
        id: movement.id as string,
        workId: movement.work_id as string,
        workName: work?.name ?? "Obra",
        clientName: work?.client.name ?? "Sin cliente",
        movementDate: movement.movement_date as string,
        concept: movement.concept as string,
        provider: (movement.supplier as string) ?? "",
        category: (movement.category as string) ?? "",
        amount,
        settled,
        pending,
        sourceType: "work_movement" as const,
      };
    })
    .filter((movement) => movement.pending > 0.001);
}

export async function getManualDebtorDetails(): Promise<ManualDebtorDetail[]> {
  if (!isAdminConfigured()) return [];
  const client = sb();
  const [debtorRes, paymentRes] = await Promise.all([
    client
      .from("manual_debtors")
      .select("*, account:payment_accounts(id,name,created_at)")
      .eq("status", 1)
      .order("name", { ascending: true }),
    client
      .from("manual_debtor_payments")
      .select("*, account:payment_accounts(id,name,created_at)")
      .eq("status", 1)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (debtorRes.error) throw new Error(debtorRes.error.message);
  if (paymentRes.error) throw new Error(paymentRes.error.message);

  const paymentsByDebtor = new Map<string, ManualDebtorPayment[]>();
  for (const payment of ((paymentRes.data ?? []) as unknown as Row[]).map(mapManualDebtorPayment)) {
    const list = paymentsByDebtor.get(payment.debtor_id) ?? [];
    list.push(payment);
    paymentsByDebtor.set(payment.debtor_id, list);
  }

  return ((debtorRes.data ?? []) as unknown as Row[])
    .map(mapManualDebtor)
    .map((debtor) => {
      const payments = paymentsByDebtor.get(debtor.id) ?? [];
      const totalPaid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0));
      const totalAmount = round2(debtor.amount);
      return {
        debtor,
        totalAmount,
        totalPaid,
        totalPending: round2(Math.max(totalAmount - totalPaid, 0)),
        payments,
      };
    })
    .sort((a, b) => b.totalPending - a.totalPending || a.debtor.name.localeCompare(b.debtor.name, "es"));
}

export async function getManualDebtorDetail(id: string): Promise<ManualDebtorDetail | null> {
  const details = await getManualDebtorDetails();
  return details.find((detail) => detail.debtor.id === id) ?? null;
}

export async function getManualProviderDebtDetails(): Promise<ManualProviderDebtDetail[]> {
  if (!isAdminConfigured()) return [];
  const client = sb();
  const [debtRes, paymentRes] = await Promise.all([
    client
      .from("manual_provider_debts")
      .select("*")
      .eq("status", 1)
      .order("provider", { ascending: true }),
    client
      .from("manual_provider_debt_payments")
      .select("*")
      .eq("status", 1)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (debtRes.error) throw new Error(debtRes.error.message);
  if (paymentRes.error) throw new Error(paymentRes.error.message);

  const paymentsByDebt = new Map<string, ManualProviderDebtPayment[]>();
  for (const payment of ((paymentRes.data ?? []) as unknown as Row[]).map(mapManualProviderDebtPayment)) {
    const list = paymentsByDebt.get(payment.debt_id) ?? [];
    list.push(payment);
    paymentsByDebt.set(payment.debt_id, list);
  }

  return ((debtRes.data ?? []) as unknown as Row[])
    .map(mapManualProviderDebt)
    .map((debt) => {
      const payments = paymentsByDebt.get(debt.id) ?? [];
      const totalPaid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0));
      const totalAmount = round2(debt.amount);
      return {
        debt,
        totalAmount,
        totalPaid,
        totalPending: round2(Math.max(totalAmount - totalPaid, 0)),
        payments,
      };
    })
    .sort((a, b) => b.totalPending - a.totalPending || a.debt.provider.localeCompare(b.debt.provider, "es"));
}

export async function getManualProviderDebtDetail(id: string): Promise<ManualProviderDebtDetail | null> {
  const details = await getManualProviderDebtDetails();
  return details.find((detail) => detail.debt.id === id) ?? null;
}

export async function getDebtReport(): Promise<DebtReportRow[]> {
  if (!isAdminConfigured()) return [];
  const [providerDetails, debtorDetails] = await Promise.all([
    getProviderDebtDetails(),
    getManualDebtorDetails(),
  ]);

  const debtors: DebtReportRow[] = debtorDetails.map((detail) => ({
    id: detail.debtor.id,
    name: detail.debtor.name,
    amount: detail.totalPending,
    type: "debtor",
    source: "manual",
    totalAmount: detail.totalAmount,
    totalPaid: detail.totalPaid,
    sourceAccountName: detail.debtor.project_id ? "Proyecto a crédito" : (detail.debtor.account?.name ?? null),
    loanDate: detail.debtor.loan_date,
  }));
  const providers: DebtReportRow[] = providerDetails.map((detail) => ({
    id: `provider-${detail.provider}`,
    name: detail.provider,
    amount: detail.totalPending,
    type: "provider",
    source:
      Number(detail.orders.length > 0) +
        Number(detail.workMovements.length > 0) +
        Number(detail.manualDebts.length > 0) >
      1
      ? "mixed"
      : detail.manualDebts.length > 0
        ? "manual"
        : detail.workMovements.length > 0
          ? "works"
          : "orders",
    totalAmount: detail.totalAmount,
    totalPaid: detail.totalPaid,
  }));
  return [...debtors, ...providers];
}

export async function getProviderDebtDetails(): Promise<ProviderDebtDetail[]> {
  if (!isAdminConfigured()) return [];
  const groups = new Map<string, ProviderDebtDetail>();
  const [works, settledBySource, manualDebts] = await Promise.all([
    listWorks(),
    getProviderDebtSettlements(),
    getManualProviderDebtDetails(),
  ]);

  for (const work of works) {
    const orders = await listWorkOrders(work.id);
    for (const order of orders) {
      if (order.amount === null) continue;
      const settled = settledBySource.get(providerDebtKey("work_order", order.id)) ?? 0;
      const pending = round2(Math.max(order.pending - settled, 0));
      if (pending <= 0.001) continue;
      const current = groups.get(order.supplier) ?? {
        provider: order.supplier,
        totalAmount: 0,
        totalPaid: 0,
        totalPending: 0,
        orders: [],
        workMovements: [],
        manualDebts: [],
      };
      current.totalAmount = round2(current.totalAmount + (order.amount ?? 0));
      current.totalPaid = round2(current.totalPaid + order.paid + settled);
      current.totalPending = round2(current.totalPending + pending);
      current.orders.push({ ...order, paid: round2(order.paid + settled), pending });
      groups.set(order.supplier, current);
    }
  }

  for (const movement of await getAccountsPayableWorkMovementDebts(settledBySource)) {
    const provider = movement.provider.trim();
    const supplier = provider.length > 0 ? provider : movement.concept.trim() || "Proveedor";
    const current = groups.get(supplier) ?? {
      provider: supplier,
      totalAmount: 0,
      totalPaid: 0,
      totalPending: 0,
      orders: [],
      workMovements: [],
      manualDebts: [],
    };
    current.totalAmount = round2(current.totalAmount + movement.amount);
    current.totalPaid = round2(current.totalPaid + movement.settled);
    current.totalPending = round2(current.totalPending + movement.pending);
    current.workMovements.push(movement);
    groups.set(supplier, current);
  }

  for (const manualDebt of manualDebts) {
    if (manualDebt.totalPending <= 0.001) continue;
    const provider = manualDebt.debt.provider.trim() || "Proveedor";
    const current = groups.get(provider) ?? {
      provider,
      totalAmount: 0,
      totalPaid: 0,
      totalPending: 0,
      orders: [],
      workMovements: [],
      manualDebts: [],
    };
    current.totalAmount = round2(current.totalAmount + manualDebt.totalAmount);
    current.totalPaid = round2(current.totalPaid + manualDebt.totalPaid);
    current.totalPending = round2(current.totalPending + manualDebt.totalPending);
    current.manualDebts.push(manualDebt);
    groups.set(provider, current);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      orders: group.orders.sort((a, b) => {
        const byPending = b.pending - a.pending;
        if (Math.abs(byPending) > 0.001) return byPending;
        return b.order_date.localeCompare(a.order_date);
      }),
      workMovements: group.workMovements.sort((a, b) => {
        const byPending = b.pending - a.pending;
        if (Math.abs(byPending) > 0.001) return byPending;
        return b.movementDate.localeCompare(a.movementDate);
      }),
      manualDebts: group.manualDebts.sort((a, b) => {
        const byPending = b.totalPending - a.totalPending;
        if (Math.abs(byPending) > 0.001) return byPending;
        return b.debt.debt_date.localeCompare(a.debt.debt_date);
      }),
    }))
    .sort((a, b) => b.totalPending - a.totalPending);
}

export async function getProviderDebtDetail(providerName: string): Promise<ProviderDebtDetail | null> {
  const decoded = (() => {
    try {
      return decodeURIComponent(providerName);
    } catch {
      return providerName;
    }
  })();
  const normalized = decoded.trim().toLowerCase();
  const details = await getProviderDebtDetails();
  return details.find((detail) => detail.provider.trim().toLowerCase() === normalized) ?? null;
}

export async function getGeneralBalanceReport(): Promise<GeneralBalanceReport> {
  if (!isAdminConfigured()) {
    return { rows: [], total: 0, totalWithoutDebtors: 0, debtorsTotal: 0, providersTotal: 0, worksReceivableTotal: 0 };
  }
  const client = sb();
  const [works, projects, debts, unifiedBalances, methods, entriesRes, accMovRes] = await Promise.all([
    listWorks(),
    listProjects(),
    getDebtReport(),
    getUnifiedMethodBalances(),
    loadMethods(),
    client.from("general_balance_entries").select("*").eq("status", 1),
    client.from("general_balance_account_movements").select("*").eq("status", 1),
  ]);

  const methodByName = new Map(methods.map((m) => [m.name.toLowerCase(), m]));
  const debtorsTotal = round2(debts.filter((r) => r.type === "debtor").reduce((s, r) => s + r.amount, 0));
  const providersTotal = round2(debts.filter((r) => r.type === "provider").reduce((s, r) => s + r.amount, 0));
  const accountsPayableTotal = providersTotal;
  const worksReceivableTotal = round2(
    works.filter((w) => w.finance.balance < -0.001).reduce((s, w) => s + Math.abs(w.finance.balance), 0),
  );
  const projectsReceivableTotal = round2(
    projects.reduce((s, p) => s + Math.max(p.finance.pending, 0), 0),
  );
  const accountsReceivable = round2(debtorsTotal + worksReceivableTotal + projectsReceivableTotal);

  const rows: GeneralBalanceRow[] = SEED_PAYMENT_METHODS.map((methodName) => {
    const normalized = methodName.toLowerCase();
    if (normalized === "cuentas por pagar") {
      return {
        id: "accounts-payable",
        label: "Cuentas por pagar",
        amount: accountsPayableTotal,
        source: "providers",
        description: "Saldo pendiente de pedidos a proveedores.",
      };
    }
    const method = methodByName.get(normalized);
    return {
      id: accountIdFromMethodName(methodName),
      label: methodName,
      amount: method ? unifiedBalances.get(method.id) ?? 0 : 0,
      source: "works-payment-method",
      description: "Movimientos de proyectos, obras, pedidos y salarios por esta cuenta.",
    };
  });

  rows.push({
    id: "accounts-receivable",
    label: "Cuentas por cobrar",
    amount: accountsReceivable,
    source: "receivable",
    description: "Deudores, obras por cobrar y proyectos pendientes de cobro.",
  });

  const byAccountId = new Map(rows.map((row) => [row.id, row]));
  for (const e of entriesRes.data ?? []) {
    const from = byAccountId.get(e.from_account_id as string);
    const to = byAccountId.get(e.to_account_id as string);
    if (from) from.amount = round2(from.amount - num(e.amount));
    if (to) to.amount = round2(to.amount + num(e.amount));
  }
  for (const m of accMovRes.data ?? []) {
    const row = byAccountId.get(m.account_id as string);
    if (!row) continue;
    const sign = (m.movement_type as string) === "income" ? 1 : -1;
    row.amount = round2(row.amount + num(m.amount) * sign);
  }

  const total = round2(rows.reduce((s, r) => s + r.amount, 0));
  return {
    rows,
    total,
    totalWithoutDebtors: round2(total - debtorsTotal),
    debtorsTotal,
    providersTotal: accountsPayableTotal,
    worksReceivableTotal,
  };
}

export async function getGeneralBalanceAccountReport(
  accountId: string,
): Promise<GeneralBalanceAccountReport | null> {
  if (!isAdminConfigured()) return null;
  const report = await getGeneralBalanceReport();
  const account = report.rows.find((r) => r.id === accountId);
  if (!account) return null;

  const client = sb();
  const methods = await loadMethods();
  const method =
    account.id === "accounts-payable"
      ? methods.find((m) => m.name.toLowerCase() === "cuentas por pagar")
      : methods.find((m) => accountIdFromMethodName(m.name) === account.id);

  const history: GeneralBalanceHistoryRow[] = [];

  if (method) {
    if (account.id === "accounts-payable") {
      for (const detail of await getProviderDebtDetails()) {
        for (const order of detail.orders) {
          history.push({
            id: `order-payable-${order.id}`,
            date: order.quoted_at ?? order.order_date,
            description: `${order.material} · ${order.work.name}`,
            expenseAccount: account.label,
            incomeAccount: order.supplier,
            amount: order.pending,
            source: "orders",
          });
        }
        for (const movement of detail.workMovements) {
          history.push({
            id: `work-payable-${movement.id}`,
            date: movement.movementDate,
            description: `${movement.concept} · ${movement.workName}`,
            expenseAccount: account.label,
            incomeAccount: detail.provider,
            amount: movement.pending,
            source: "works",
          });
        }
      }
    } else {
      const [wmRes, ppRes, projRes, debtorLoanRes, debtorPaymentRes] = await Promise.all([
        listWorkMovementRows({ paymentMethodId: method.id }),
        client.from("project_payments").select("*").eq("status", 1).eq("payment_method_id", method.id),
        client.from("projects").select("id, name"),
        client
          .from("manual_debtors")
          .select("id, name, amount, loan_date")
          .eq("status", 1)
          .eq("source_account_id", method.id),
        client
          .from("manual_debtor_payments")
          .select("id, debtor_id, amount, payment_date, debtor:manual_debtors(name)")
          .eq("status", 1)
          .eq("to_account_id", method.id),
      ]);
      const projectName = new Map((projRes.data ?? []).map((p) => [p.id as string, p.name as string]));
      for (const m of wmRes) {
        const expense = (m.movement_type as string) === "expense";
        history.push({
          id: `work-${m.id}`,
          date: m.movement_date as string,
          description: m.concept as string,
          expenseAccount: expense ? method.name : (m.supplier as string),
          incomeAccount: expense ? (m.supplier as string) : method.name,
          amount: num(m.amount),
          source: "works",
        });
      }
      for (const p of ppRes.data ?? []) {
        const expense = (p.movement_type as string) === "expense";
        const counterparty = projectName.get(p.project_id as string) ?? "Proyecto";
        history.push({
          id: `project-${p.id}`,
          date: p.payment_date as string,
          description: `${p.concept} · ${counterparty}`,
          expenseAccount: expense ? method.name : counterparty,
          incomeAccount: expense ? counterparty : method.name,
          amount: num(p.amount),
          source: "projects",
        });
      }
      for (const debtor of debtorLoanRes.data ?? []) {
        history.push({
          id: `debtor-loan-${debtor.id}`,
          date: debtor.loan_date as string,
          description: `Préstamo a ${debtor.name}`,
          expenseAccount: method.name,
          incomeAccount: debtor.name as string,
          amount: num(debtor.amount),
          source: "manual",
        });
      }
      for (const payment of debtorPaymentRes.data ?? []) {
        const debtor = payment.debtor as { name?: string } | null;
        history.push({
          id: `debtor-payment-${payment.id}`,
          date: payment.payment_date as string,
          description: `Abono de ${debtor?.name ?? "deudor"}`,
          expenseAccount: debtor?.name ?? "Deudor",
          incomeAccount: method.name,
          amount: num(payment.amount),
          source: "manual",
        });
      }
    }

    if (account.id !== "accounts-payable") {
      const methodName = new Map(methods.map((m) => [m.id, m.name]));
      const [wtRes, itRes] = await Promise.all([
        client.from("work_internal_transfers").select("*").eq("status", 1),
        client.from("internal_transfers").select("*").eq("status", 1),
      ]);
      for (const t of wtRes.data ?? []) {
        if (t.from_payment_method_id !== method.id && t.to_payment_method_id !== method.id) continue;
        history.push({
          id: `work-transfer-${t.id}`,
          date: t.transfer_date as string,
          description: t.description as string,
          expenseAccount: methodName.get(t.from_payment_method_id as string) ?? "Sin cuenta",
          incomeAccount: methodName.get(t.to_payment_method_id as string) ?? "Sin cuenta",
          amount: num(t.amount),
          source: "internal-transfer",
        });
      }
      for (const t of itRes.data ?? []) {
        if (t.from_payment_method_id !== method.id && t.to_payment_method_id !== method.id) continue;
        history.push({
          id: `project-transfer-${t.id}`,
          date: t.transfer_date as string,
          description: t.description as string,
          expenseAccount: methodName.get(t.from_payment_method_id as string) ?? "Sin cuenta",
          incomeAccount: methodName.get(t.to_payment_method_id as string) ?? "Sin cuenta",
          amount: num(t.amount),
          source: "internal-transfer",
        });
      }
    }
  }

  if (account.id === "accounts-receivable") {
    const { data: debtorRows } = await client.from("manual_debtors").select("*").eq("status", 1);
    for (const d of debtorRows ?? []) {
      if (num(d.amount) <= 0) continue;
      history.push({
        id: `debtor-${d.id}`,
        date: (d.updated_at as string).slice(0, 10),
        description: d.name as string,
        expenseAccount: "Deudor manual",
        incomeAccount: account.label,
        amount: num(d.amount),
        source: "manual",
      });
    }
    for (const work of await listWorks()) {
      if (work.finance.balance >= -0.001) continue;
      history.push({
        id: `work-receivable-${work.id}`,
        date: work.finance.lastMovementDate ?? work.created_at.slice(0, 10),
        description: work.name,
        expenseAccount: work.client.name,
        incomeAccount: account.label,
        amount: Math.abs(work.finance.balance),
        source: "works",
      });
    }
    for (const project of await listProjects()) {
      if (project.finance.pending <= 0.001) continue;
      history.push({
        id: `project-receivable-${project.id}`,
        date: project.created_at.slice(0, 10),
        description: project.name,
        expenseAccount: project.client.name,
        incomeAccount: account.label,
        amount: round2(project.finance.pending),
        source: "projects",
      });
    }
  }

  const [entriesRes, accMovRes] = await Promise.all([
    client.from("general_balance_entries").select("*").eq("status", 1),
    client.from("general_balance_account_movements").select("*").eq("status", 1),
  ]);
  for (const e of entriesRes.data ?? []) {
    if (e.from_account_id !== account.id && e.to_account_id !== account.id) continue;
    history.push({
      id: `manual-${e.id}`,
      date: e.entry_date as string,
      description: e.description as string,
      expenseAccount: report.rows.find((r) => r.id === e.from_account_id)?.label ?? "Sin cuenta",
      incomeAccount: report.rows.find((r) => r.id === e.to_account_id)?.label ?? "Sin cuenta",
      amount: num(e.amount),
      source: "manual",
    });
  }
  for (const m of accMovRes.data ?? []) {
    if (m.account_id !== account.id) continue;
    const expense = (m.movement_type as string) === "expense";
    history.push({
      id: `account-movement-${m.id}`,
      date: m.movement_date as string,
      description: m.description as string,
      expenseAccount: expense ? account.label : "Registro externo",
      incomeAccount: expense ? "Registro externo" : account.label,
      amount: num(m.amount),
      source: "manual",
    });
  }

  return {
    account,
    accounts: report.rows,
    history: history.sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.description.localeCompare(b.description);
    }),
  };
}

export interface RegisterGeneralBalanceEntryData {
  description: string;
  amount: number;
  entryDate: string;
  fromAccountId: string;
  toAccountId: string;
  userId: string | null;
}

export async function registerGeneralBalanceEntry(data: RegisterGeneralBalanceEntryData): Promise<void> {
  const report = await getGeneralBalanceReport();
  const valid = new Set(report.rows.map((r) => r.id));
  if (!valid.has(data.fromAccountId) || !valid.has(data.toAccountId)) throw new Error("Cuenta inválida");
  if (data.fromAccountId === data.toAccountId) throw new Error("Las cuentas deben ser diferentes");
  const { error } = await sb().from("general_balance_entries").insert({
    description: data.description.trim(),
    amount: round2(data.amount),
    entry_date: data.entryDate,
    from_account_id: data.fromAccountId,
    to_account_id: data.toAccountId,
    created_by: await getCurrentUserId(),
  });
  if (error) throw new Error(error.message);
}

export interface RegisterGeneralBalanceAccountMovementData {
  accountId: string;
  movementType: "income" | "expense";
  description: string;
  amount: number;
  movementDate: string;
  userId: string | null;
}

export async function registerGeneralBalanceAccountMovement(
  data: RegisterGeneralBalanceAccountMovementData,
): Promise<void> {
  const report = await getGeneralBalanceReport();
  if (!report.rows.some((r) => r.id === data.accountId)) throw new Error("Cuenta inválida");
  const { error } = await sb().from("general_balance_account_movements").insert({
    account_id: data.accountId,
    movement_type: data.movementType,
    description: data.description.trim(),
    amount: round2(data.amount),
    movement_date: data.movementDate,
    created_by: await getCurrentUserId(),
  });
  if (error) throw new Error(error.message);
}

export async function getFinanceUtilityReport(): Promise<FinanceUtilityReport> {
  const [projectRows, workRows] = await Promise.all([
    getUtilityReport(),
    getWorksAdministrationUtilityReport(),
  ]);
  const months = new Set<string>();
  for (const r of projectRows) months.add(r.month);
  for (const r of workRows) months.add(r.month);
  const projectByMonth = new Map(projectRows.map((r) => [r.month, r.utilityAmount]));
  const workByMonth = new Map(workRows.map((r) => [r.month, r.amount]));
  const rows = [...months]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => {
      const projectUtility = round2(projectByMonth.get(month) ?? 0);
      const workUtility = round2(workByMonth.get(month) ?? 0);
      return { month, projectUtility, workUtility, totalUtility: round2(projectUtility + workUtility) };
    });
  const projectTotal = round2(rows.reduce((s, r) => s + r.projectUtility, 0));
  const workTotal = round2(rows.reduce((s, r) => s + r.workUtility, 0));
  return { rows, projectTotal, workTotal, total: round2(projectTotal + workTotal) };
}

export async function getWorkExpenseMonthlyReport(): Promise<Array<{ month: string; amount: number }>> {
  if (!isAdminConfigured()) return [];
  const rows = await listWorkMovementRows({
    select: "movement_date, category, amount",
    movementType: "expense",
  });
  const byMonth = new Map<string, number>();
  for (const row of rows) {
    const category = normalizedFinanceCategory(row.category);
    if (category === "cuenta de oficina" || isWorkSalaryCategory(row.category)) continue;
    const date = String(row.movement_date ?? "");
    const month = date.slice(0, 7);
    if (!month) continue;
    byMonth.set(month, round2((byMonth.get(month) ?? 0) + Math.abs(num(row.amount))));
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount: round2(amount) }));
}

export async function getProjectArchitectCommissionMonthlyReport(): Promise<Array<{ month: string; amount: number }>> {
  if (!isAdminConfigured()) return [];
  const client = sb();
  const [salaryRes, projectPaymentRes, workMovementRows] = await Promise.all([
    client
      .from("salary_payments")
      .select("payment_date, amount")
      .eq("status", 1)
      .eq("payment_type", "project"),
    client
      .from("project_payments")
      .select("payment_date, amount, concept, internal_area")
      .eq("status", 1)
      .eq("movement_type", "expense")
      .not("internal_area", "is", null),
    listWorkMovementRows({
      select: "movement_date, amount, category",
      movementType: "expense",
    }),
  ]);
  if (salaryRes.error) throw new Error(salaryRes.error.message);
  if (projectPaymentRes.error) throw new Error(projectPaymentRes.error.message);

  const byMonth = new Map<string, number>();
  for (const row of salaryRes.data ?? []) {
    const month = String(row.payment_date ?? "").slice(0, 7);
    if (!month) continue;
    byMonth.set(month, round2((byMonth.get(month) ?? 0) + Math.abs(num(row.amount))));
  }
  for (const row of projectPaymentRes.data ?? []) {
    const concept = String(row.concept ?? "").trim().toLowerCase();
    if (!concept.startsWith("pago de ")) continue;
    const month = String(row.payment_date ?? "").slice(0, 7);
    if (!month) continue;
    byMonth.set(month, round2((byMonth.get(month) ?? 0) + Math.abs(num(row.amount))));
  }
  for (const row of workMovementRows) {
    if (!isWorkSalaryCategory(row.category)) continue;
    const month = String(row.movement_date ?? "").slice(0, 7);
    if (!month) continue;
    byMonth.set(month, round2((byMonth.get(month) ?? 0) + Math.abs(num(row.amount))));
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount: round2(amount) }));
}

function mapFinanceMovementTag(r: Row): FinanceMovementTag {
  return {
    id: r.id as string,
    name: r.name as string,
    created_at: (r.created_at as string) ?? "",
    created_by: (r.created_by as string) ?? null,
  };
}

function mapFinanceMovementConcept(r: Row): FinanceMovementConcept {
  const tag = r.tag as Row | null;
  return {
    id: r.id as string,
    name: r.name as string,
    tag_id: (r.tag_id as string) ?? null,
    created_at: (r.created_at as string) ?? "",
    created_by: (r.created_by as string) ?? null,
    tag: tag ? mapFinanceMovementTag(tag) : null,
  };
}

function mapFinanceCapture(r: Row, balanceAfter: number): FinanceCaptureRow {
  const concept = r.concept as Row | null;
  const account = r.account as Row | null;
  return {
    id: r.id as string,
    concept_id: r.concept_id as string,
    capture_date: r.capture_date as string,
    movement_type: (r.movement_type as MovementType) ?? "expense",
    amount: num(r.amount),
    source_account_id: r.source_account_id as string,
    payment_form: r.payment_form as FinanceCapturePaymentForm,
    description: (r.description as string) ?? null,
    balance_after: balanceAfter,
    created_at: (r.created_at as string) ?? "",
    created_by: (r.created_by as string) ?? null,
    concept: concept ? mapFinanceMovementConcept(concept) : null,
    account: account
      ? {
          id: account.id as string,
          name: account.name as string,
          is_active: true,
          created_at: (account.created_at as string) ?? "",
        }
      : null,
  };
}

export async function getFinanceCaptureReport(): Promise<FinanceCaptureReport> {
  if (!isAdminConfigured()) {
    return {
      rows: [],
      concepts: [],
      tags: [],
      accounts: [],
      totals: {
        amount: 0,
        incomeAmount: 0,
        expenseAmount: 0,
        count: 0,
        currentBalance: 0,
        currentMonthAmount: 0,
        currentMonthIncome: 0,
        currentMonthExpense: 0,
      },
    };
  }

  const client = sb();
  const [captureRes, conceptRes, tagRes, accounts] = await Promise.all([
    client
      .from("finance_movement_captures")
      .select(
        "*, concept:finance_movement_concepts(id,name,tag_id,created_at,created_by, tag:finance_movement_tags(id,name,created_at,created_by)), account:payment_accounts(id,name,created_at)",
      )
      .eq("status", 1)
      .order("capture_date", { ascending: true })
      .order("created_at", { ascending: true }),
    client
      .from("finance_movement_concepts")
      .select("id,name,tag_id,created_at,created_by, tag:finance_movement_tags(id,name,created_at,created_by)")
      .eq("status", 1)
      .order("name", { ascending: true }),
    client
      .from("finance_movement_tags")
      .select("id,name,created_at,created_by")
      .eq("status", 1)
      .order("name", { ascending: true }),
    loadMethods(),
  ]);

  let runningBalance = 0;
  const chronological = ((captureRes.data ?? []) as Row[]).map((row) => {
    const signedAmount = (row.movement_type as string) === "income" ? num(row.amount) : -num(row.amount);
    runningBalance = round2(runningBalance + signedAmount);
    return mapFinanceCapture(row, runningBalance);
  });
  const rows = chronological.sort((a, b) => {
    const byDate = b.capture_date.localeCompare(a.capture_date);
    if (byDate !== 0) return byDate;
    return b.created_at.localeCompare(a.created_at);
  });
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthRows = rows.filter((row) => row.capture_date.startsWith(currentMonth));
  const incomeAmount = round2(rows.filter((row) => row.movement_type === "income").reduce((sum, row) => sum + row.amount, 0));
  const expenseAmount = round2(rows.filter((row) => row.movement_type === "expense").reduce((sum, row) => sum + row.amount, 0));
  const currentMonthIncome = round2(currentMonthRows.filter((row) => row.movement_type === "income").reduce((sum, row) => sum + row.amount, 0));
  const currentMonthExpense = round2(currentMonthRows.filter((row) => row.movement_type === "expense").reduce((sum, row) => sum + row.amount, 0));

  return {
    rows,
    concepts: ((conceptRes.data ?? []) as Row[]).map(mapFinanceMovementConcept),
    tags: ((tagRes.data ?? []) as Row[]).map(mapFinanceMovementTag),
    accounts,
    totals: {
      amount: round2(rows.reduce((sum, row) => sum + row.amount, 0)),
      incomeAmount,
      expenseAmount,
      count: rows.length,
      currentBalance: runningBalance,
      currentMonthAmount: round2(currentMonthRows.reduce((sum, row) => sum + row.amount, 0)),
      currentMonthIncome,
      currentMonthExpense,
    },
  };
}

export async function saveFinanceMovementTag(data: {
  id?: string;
  name: string;
  userId: string | null;
}): Promise<string> {
  const client = sb();
  const name = data.name.trim();
  if (data.id) {
    const { error } = await client
      .from("finance_movement_tags")
      .update({ name })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return data.id;
  }
  const { data: created, error } = await client
    .from("finance_movement_tags")
    .insert({ name, created_by: data.userId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

export async function deleteFinanceMovementTag(id: string): Promise<void> {
  const client = sb();
  const { error: conceptsError } = await client
    .from("finance_movement_concepts")
    .update({ tag_id: null })
    .eq("tag_id", id);
  if (conceptsError) throw new Error(conceptsError.message);

  const { error } = await client
    .from("finance_movement_tags")
    .update({ status: 0 })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function saveFinanceMovementConcept(data: {
  id?: string;
  name: string;
  tagId: string | null;
  userId: string | null;
}): Promise<string> {
  const client = sb();
  const payload = {
    name: data.name.trim(),
    tag_id: data.tagId || null,
  };
  if (data.id) {
    const { error } = await client
      .from("finance_movement_concepts")
      .update(payload)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return data.id;
  }
  const { data: created, error } = await client
    .from("finance_movement_concepts")
    .insert({ ...payload, created_by: data.userId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

export async function deleteFinanceMovementConcept(id: string): Promise<void> {
  const { error } = await sb()
    .from("finance_movement_concepts")
    .update({ status: 0 })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

async function financeCaptureSnapshot(id: string): Promise<Row | null> {
  const { data, error } = await sb()
    .from("finance_movement_captures")
    .select(
      "id, concept_id, capture_date, movement_type, amount, source_account_id, payment_form, description, status, concept:finance_movement_concepts(name), account:payment_accounts(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Row | null) ?? null;
}

function financeCaptureAuditSnapshot(row: Row) {
  const concept = row.concept as { name?: string } | null;
  return {
    concept: concept?.name ?? row.concept_id,
    capture_date: row.capture_date,
    movement_type: row.movement_type ?? "expense",
    amount: num(row.amount),
    source_account_id: row.source_account_id,
    payment_form: row.payment_form,
    description: row.description,
  };
}

export async function saveFinanceCapture(data: {
  id?: string;
  conceptId: string;
  captureDate: string;
  movementType: MovementType;
  amount: number;
  sourceAccountId: string;
  paymentForm: FinanceCapturePaymentForm;
  description: string | null;
  note?: string | null;
  userId: string | null;
}): Promise<string> {
  const payload = {
    concept_id: data.conceptId,
    capture_date: data.captureDate,
    movement_type: data.movementType,
    amount: round2(data.amount),
    source_account_id: data.sourceAccountId,
    payment_form: data.paymentForm,
    description: data.description?.trim() || null,
  };

  if (data.id) {
    const before = await financeCaptureSnapshot(data.id);
    if (!before || (before.status as number) === 0) {
      throw new Error("Captura no encontrada.");
    }
    const { error } = await sb()
      .from("finance_movement_captures")
      .update(payload)
      .eq("id", data.id)
      .eq("status", 1);
    if (error) throw new Error(error.message);

    const after = await financeCaptureSnapshot(data.id);
    const concept = (after?.concept ?? before.concept) as { name?: string } | null;
    await writeAudit({
      entityType: "finance_movement",
      entityId: data.id,
      operation: "update",
      note: data.note,
      amount: data.amount,
      description: `Captura · ${concept?.name ?? "Movimiento"}`,
      snapshot: {
        before: financeCaptureAuditSnapshot(before),
        after: after ? financeCaptureAuditSnapshot(after) : payload,
      },
    });
    return data.id;
  }

  const { data: created, error } = await sb()
    .from("finance_movement_captures")
    .insert({
      ...payload,
      created_by: data.userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

export async function deleteFinanceCapture(id: string, note: string): Promise<void> {
  const before = await financeCaptureSnapshot(id);
  if (!before || (before.status as number) === 0) {
    throw new Error("Captura no encontrada.");
  }
  const { error } = await sb()
    .from("finance_movement_captures")
    .update({ status: 0 })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const concept = before.concept as { name?: string } | null;
  await writeAudit({
    entityType: "finance_movement",
    entityId: id,
    operation: "delete",
    note,
    amount: num(before.amount),
    description: `Captura · ${concept?.name ?? "Movimiento"}`,
    snapshot: {
      before: financeCaptureAuditSnapshot(before),
    },
  });
}

export interface SaveManualDebtorData {
  id?: string;
  name: string;
  amount: number;
  sourceAccountId: string;
  loanDate: string;
  note?: string | null;
  userId: string | null;
}

export async function saveManualDebtor(data: SaveManualDebtorData): Promise<string> {
  const client = sb();
  const payload = {
    name: data.name.trim(),
    amount: round2(data.amount),
    source_account_id: data.sourceAccountId,
    loan_date: data.loanDate,
    note: data.note?.trim() || null,
  };
  if (data.id) {
    const detail = await getManualDebtorDetail(data.id);
    if (detail && payload.amount < detail.totalPaid - 0.001) {
      throw new Error("El monto prestado no puede ser menor a los abonos registrados.");
    }
    const { error } = await client
      .from("manual_debtors")
      .update(payload)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return data.id;
  }
  const { data: created, error } = await client
    .from("manual_debtors")
    .insert({ ...payload, created_by: await getCurrentUserId() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

export interface RegisterManualDebtorPaymentData {
  debtorId: string;
  amount: number;
  paymentDate: string;
  toAccountId: string;
  note?: string | null;
  userId: string | null;
}

export async function registerManualDebtorPayment(
  data: RegisterManualDebtorPaymentData,
): Promise<string> {
  const detail = await getManualDebtorDetail(data.debtorId);
  if (!detail) throw new Error("No se encontró el deudor.");
  const amount = round2(data.amount);
  if (amount > detail.totalPending + 0.001) {
    throw new Error("El abono supera el saldo pendiente.");
  }

  const { data: created, error } = await sb()
    .from("manual_debtor_payments")
    .insert({
      debtor_id: data.debtorId,
      amount,
      payment_date: data.paymentDate,
      to_account_id: data.toAccountId,
      note: data.note?.trim() || null,
      created_by: await getCurrentUserId(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await audit(
    "debtor_payment",
    (created?.id as string) ?? data.debtorId,
    `Abono de deudor · ${detail.debtor.name} · ${amount.toFixed(2)}`,
  );
  return created.id as string;
}

export async function deleteManualDebtorPayment(data: {
  paymentId: string;
  note: string;
}): Promise<{ debtorId: string; projectId: string | null }> {
  const client = sb();
  const { data: payment, error } = await client
    .from("manual_debtor_payments")
    .select("id, debtor_id, project_payment_id, payment_date, amount, to_account_id, note, status")
    .eq("id", data.paymentId)
    .eq("status", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!payment) throw new Error("No se encontró el abono activo.");

  const { data: debtor, error: debtorError } = await client
    .from("manual_debtors")
    .select("name, project_id")
    .eq("id", payment.debtor_id as string)
    .maybeSingle();
  if (debtorError) throw new Error(debtorError.message);

  if (payment.project_payment_id) {
    await deleteProjectMovement(payment.project_payment_id as string, data.note);
  } else {
    const { error: updateError } = await client
      .from("manual_debtor_payments")
      .update({ status: 0 })
      .eq("id", data.paymentId)
      .eq("status", 1);
    if (updateError) throw new Error(updateError.message);

    await writeAudit({
      entityType: "finance_movement",
      entityId: data.paymentId,
      operation: "delete",
      note: data.note,
      amount: num(payment.amount),
      description: `Abono de deudor · ${debtor?.name ?? "Deudor"}`,
      snapshot: {
        before: {
          debtor_id: payment.debtor_id,
          payment_date: payment.payment_date,
          amount: num(payment.amount),
          to_account_id: payment.to_account_id,
          note: payment.note,
        },
      },
    });
  }

  return {
    debtorId: payment.debtor_id as string,
    projectId: (debtor?.project_id as string | null) ?? null,
  };
}

export interface SaveManualProviderDebtData {
  id?: string;
  provider: string;
  amount: number;
  debtDate: string;
  note?: string | null;
  userId: string | null;
}

export async function saveManualProviderDebt(data: SaveManualProviderDebtData): Promise<string> {
  const client = sb();
  const payload = {
    provider: data.provider.trim(),
    amount: round2(data.amount),
    debt_date: data.debtDate,
    note: data.note?.trim() || null,
  };
  if (data.id) {
    const detail = await getManualProviderDebtDetail(data.id);
    if (detail && payload.amount < detail.totalPaid - 0.001) {
      throw new Error("El monto de la deuda no puede ser menor a los abonos registrados.");
    }
    const { error } = await client
      .from("manual_provider_debts")
      .update(payload)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return data.id;
  }

  const { data: created, error } = await client
    .from("manual_provider_debts")
    .insert({ ...payload, created_by: await getCurrentUserId() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

export interface RegisterManualProviderDebtPaymentData {
  debtId: string;
  amount: number;
  paymentDate: string;
  note?: string | null;
  userId: string | null;
}

export async function registerManualProviderDebtPayment(
  data: RegisterManualProviderDebtPaymentData,
): Promise<{ paymentId: string; provider: string }> {
  const detail = await getManualProviderDebtDetail(data.debtId);
  if (!detail) throw new Error("No se encontró la deuda del proveedor.");
  const amount = round2(data.amount);
  if (amount > detail.totalPending + 0.001) {
    throw new Error("El abono supera el saldo pendiente.");
  }

  const { data: created, error } = await sb()
    .from("manual_provider_debt_payments")
    .insert({
      debt_id: data.debtId,
      amount,
      payment_date: data.paymentDate,
      note: data.note?.trim() || null,
      created_by: await getCurrentUserId(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await audit(
    "provider_payment",
    (created?.id as string) ?? data.debtId,
    `Abono de proveedor · ${detail.debt.provider} · ${amount.toFixed(2)}`,
  );
  return { paymentId: created.id as string, provider: detail.debt.provider };
}

export interface SettleProviderDebtData {
  provider: string;
  sourceType: "work_order" | "work_movement";
  sourceId: string;
  amount: number;
  settlementDate: string;
  note?: string;
  userId: string | null;
}

export async function settleProviderDebt(data: SettleProviderDebtData): Promise<void> {
  const details = await getProviderDebtDetail(data.provider);
  if (!details) throw new Error("No se encontró deuda pendiente para este proveedor.");

  const pending =
    data.sourceType === "work_order"
      ? details.orders.find((order) => order.id === data.sourceId)?.pending
      : details.workMovements.find((movement) => movement.id === data.sourceId)?.pending;

  if (pending === undefined) throw new Error("La deuda seleccionada ya no está pendiente.");
  const amount = round2(data.amount);
  if (amount > pending + 0.001) throw new Error("El monto supera el saldo pendiente.");

  const { data: row, error } = await sb()
    .from("provider_debt_settlements")
    .insert({
      provider: data.provider.trim(),
      source_type: data.sourceType,
      source_id: data.sourceId,
      amount,
      settlement_date: data.settlementDate,
      note: data.note?.trim() || null,
      created_by: await getCurrentUserId(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await audit(
    "settle",
    (row?.id as string) ?? data.sourceId,
    `Deuda saldada · ${data.provider} · ${amount.toFixed(2)}`,
  );
}

/* ============================================================== SALARY ===== */

function weekdayKey(date: string): SalaryWeekday {
  const day = new Date(`${date}T00:00:00`).getDay();
  const map: Record<number, SalaryWeekday> = { 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday" };
  return map[day] ?? "monday";
}
function addDays(date: string, days: number) {
  const c = new Date(`${date}T00:00:00`);
  c.setDate(c.getDate() + days);
  return c.toISOString().slice(0, 10);
}
function startOfWeekFrom(date: string) {
  const c = new Date(`${date}T00:00:00`);
  const wd = c.getDay();
  c.setDate(c.getDate() + (wd === 0 ? -6 : 1 - wd));
  return c.toISOString().slice(0, 10);
}
function monthLabel(year: number, month: number) {
  return new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00`).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });
}
function internalAreaFromTaskName(taskName: string | undefined): InternalArea | null {
  if (taskName === "Propuesta") return "proposal";
  if (taskName === "Modelado 3D") return "modeling_3d";
  if (taskName === "Planos") return "plans";
  if (taskName === "Render") return "render";
  return null;
}

interface SalaryContext {
  employees: Employee[];
  taskTypes: TaskType[];
  methods: PaymentMethod[];
  projects: Map<string, { id: string; name: string }>;
  works: Map<string, { id: string; name: string }>;
}

async function loadSalaryRefs(): Promise<SalaryContext> {
  const client = sb();
  const [emp, tasks, methods, projects, works] = await Promise.all([
    client.from("employees").select("id, full_name, default_work_type, status").eq("status", 1),
    client.from("task_types").select("id, name, module_type, status").eq("status", 1),
    loadMethods(),
    client.from("projects").select("id, name").eq("status", 1),
    client.from("works").select("id, name").eq("status", 1),
  ]);
  return {
    employees: (emp.data ?? [])
      .map((e) => ({
        id: e.id as string,
        full_name: e.full_name as string,
        is_active: true,
        default_work_type: e.default_work_type as Employee["default_work_type"],
        created_at: "",
        updated_at: "",
        created_by: null,
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    taskTypes: (tasks.data ?? []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
      module_type: t.module_type as TaskType["module_type"],
      is_active: true,
      created_at: "",
    })),
    methods,
    projects: new Map((projects.data ?? []).map((p) => [p.id as string, { id: p.id as string, name: p.name as string }])),
    works: new Map((works.data ?? []).map((w) => [w.id as string, { id: w.id as string, name: w.name as string }])),
  };
}

function mapWeek(r: Row) {
  return {
    id: r.id as string,
    year: r.year as number,
    month: r.month as number,
    week_start_date: r.week_start_date as string,
    week_end_date: r.week_end_date as string,
    payment_date: r.payment_date as string,
    status: (r.week_status as SalaryWeekStatus) ?? "draft",
    created_at: (r.created_at as string) ?? "",
    updated_at: (r.updated_at as string) ?? "",
    created_by: (r.created_by as string) ?? null,
  };
}
function mapDayRecord(r: Row, ctx: SalaryContext): SalaryDayRecordWithRelations {
  const base = {
    id: r.id as string,
    salary_week_id: r.salary_week_id as string,
    employee_id: r.employee_id as string,
    work_date: r.work_date as string,
    day_name: r.day_name as SalaryWeekday,
    activity_type: r.activity_type as SalaryDayRecordWithRelations["activity_type"],
    project_id: (r.project_id as string) ?? null,
    work_id: (r.work_id as string) ?? null,
    task_type_id: (r.task_type_id as string) ?? null,
    notes: (r.notes as string) ?? null,
    status: (r.record_status as SalaryDayRecordWithRelations["status"]) ?? "draft",
    created_at: (r.created_at as string) ?? "",
    updated_at: (r.updated_at as string) ?? "",
    created_by: (r.created_by as string) ?? null,
  };
  return {
    ...base,
    employee: ctx.employees.find((e) => e.id === base.employee_id) ?? null,
    project: base.project_id ? (ctx.projects.get(base.project_id) as never) ?? null : null,
    work: base.work_id ? (ctx.works.get(base.work_id) as never) ?? null : null,
    taskType: ctx.taskTypes.find((t) => t.id === base.task_type_id) ?? null,
  };
}
function mapSalaryPayment(r: Row, ctx: SalaryContext): SalaryPaymentWithRelations {
  const base = {
    id: r.id as string,
    salary_week_id: r.salary_week_id as string,
    employee_id: r.employee_id as string,
    payment_type: r.payment_type as SalaryPaymentType,
    concept: r.concept as string,
    amount: num(r.amount),
    payment_method_id: (r.payment_method_id as string) ?? "",
    payment_date: r.payment_date as string,
    project_id: (r.project_id as string) ?? null,
    work_id: (r.work_id as string) ?? null,
    task_type_id: (r.task_type_id as string) ?? null,
    notes: (r.notes as string) ?? null,
    status: (r.payment_status as "paid") ?? "paid",
    created_at: (r.created_at as string) ?? "",
    created_by: (r.created_by as string) ?? null,
  };
  return {
    ...base,
    employee: ctx.employees.find((e) => e.id === base.employee_id) ?? null,
    method: ctx.methods.find((m) => m.id === base.payment_method_id) ?? null,
    project: base.project_id ? (ctx.projects.get(base.project_id) as never) ?? null : null,
    work: base.work_id ? (ctx.works.get(base.work_id) as never) ?? null : null,
    taskType: ctx.taskTypes.find((t) => t.id === base.task_type_id) ?? null,
  };
}

function buildWeek(
  week: ReturnType<typeof mapWeek>,
  dayRecords: SalaryDayRecordWithRelations[],
  payments: SalaryPaymentWithRelations[],
  ctx: SalaryContext,
): SalaryWeekWithRows {
  const employeeRows = ctx.employees.map((employee) => {
    const empDays = dayRecords
      .filter((d) => d.employee_id === employee.id)
      .sort((a, b) => {
        const byDate = a.work_date.localeCompare(b.work_date);
        if (byDate !== 0) return byDate;
        return a.created_at.localeCompare(b.created_at);
      });
    const empPays = payments.filter((p) => p.employee_id === employee.id);
    const cash = round2(empPays.filter((p) => p.method?.name.toLowerCase() === "caja").reduce((s, p) => s + p.amount, 0));
    const account = round2(empPays.filter((p) => p.method?.name.toLowerCase() === "cuenta de rosa").reduce((s, p) => s + p.amount, 0));
    const projectOrWork = round2(empPays.filter((p) => p.payment_type === "project" || p.payment_type === "work").reduce((s, p) => s + p.amount, 0));
    const groupedDays = empDays.reduce<Partial<Record<SalaryWeekday, SalaryDayRecordWithRelations[]>>>((acc, record) => {
      const current = acc[record.day_name] ?? [];
      current.push(record);
      acc[record.day_name] = current;
      return acc;
    }, {});
    return {
      employee,
      dayRecords: groupedDays,
      payments: empPays,
      totals: { cash, account, projectOrWork, total: round2(empPays.reduce((s, p) => s + p.amount, 0)) },
    };
  });

  const methodTotals = new Map<string, { methodId: string; methodName: string; total: number }>();
  for (const p of payments) {
    const cur = methodTotals.get(p.payment_method_id) ?? { methodId: p.payment_method_id, methodName: p.method?.name ?? "Sin cuenta", total: 0 };
    cur.total = round2(cur.total + p.amount);
    methodTotals.set(p.payment_method_id, cur);
  }
  const paymentTypeTotals = new Map<SalaryPaymentType, number>();
  for (const p of payments) paymentTypeTotals.set(p.payment_type, round2((paymentTypeTotals.get(p.payment_type) ?? 0) + p.amount));

  return {
    ...week,
    employees: employeeRows,
    totals: {
      total: round2(payments.reduce((s, p) => s + p.amount, 0)),
      byMethod: [...methodTotals.values()].sort((a, b) => b.total - a.total),
      byPaymentType: [...paymentTypeTotals.entries()].map(([paymentType, total]) => ({ paymentType, total })),
      pendingPayments: 0,
    },
  };
}

function computeTaskRates(payments: SalaryPaymentWithRelations[]) {
  const rates = new Map<string, { taskTypeId: string; taskTypeName: string; employeeId: string | null; amount: number; count: number }>();
  for (const p of payments) {
    if (p.status !== "paid" || !p.task_type_id || !p.taskType) continue;
    for (const [key, employeeId] of [
      [`global:${p.task_type_id}`, null],
      [`employee:${p.employee_id}:${p.task_type_id}`, p.employee_id],
    ] as const) {
      const cur = rates.get(key) ?? { taskTypeId: p.task_type_id, taskTypeName: p.taskType.name, employeeId, amount: 0, count: 0 };
      cur.amount = round2(cur.amount + p.amount);
      cur.count += 1;
      rates.set(key, cur);
    }
  }
  return [...rates.values()]
    .map((i) => ({ taskTypeId: i.taskTypeId, taskTypeName: i.taskTypeName, employeeId: i.employeeId, amount: round2(i.amount / i.count) }))
    .sort((a, b) => a.taskTypeName.localeCompare(b.taskTypeName));
}

export async function getSalaryReport(filters?: { year?: number; month?: number }): Promise<SalaryReport> {
  if (!isAdminConfigured()) {
    const now = new Date();
    return {
      months: [],
      selected: { year: now.getFullYear(), month: now.getMonth() + 1 },
      employees: [],
      taskTypes: [],
      weeks: [],
      paymentMethods: [],
      totals: { totalPaid: 0, totalPending: 0, totalCash: 0, totalAccount: 0, totalProject: 0, totalWork: 0 },
      taskRates: [],
      recentPayments: [],
    };
  }
  const client = sb();
  const ctx = await loadSalaryRefs();
  const { data: weekRows } = await client.from("salary_weeks").select("*").eq("status", 1);
  const weeks = (weekRows ?? []).map(mapWeek);

  const monthsMap = new Map<string, { year: number; month: number; label: string }>();
  for (const w of weeks) monthsMap.set(`${w.year}-${w.month}`, { year: w.year, month: w.month, label: monthLabel(w.year, w.month) });
  const months = [...monthsMap.values()].sort((a, b) =>
    `${b.year}-${String(b.month).padStart(2, "0")}`.localeCompare(`${a.year}-${String(a.month).padStart(2, "0")}`),
  );
  const now = new Date();
  const fallback = months[0] ?? { year: now.getFullYear(), month: now.getMonth() + 1, label: "" };
  const selectedYear = filters?.year ?? fallback.year;
  const selectedMonth = filters?.month ?? fallback.month;

  const selectedWeeks = weeks.filter((w) => w.year === selectedYear && w.month === selectedMonth);
  const weekIds = selectedWeeks.map((w) => w.id);

  const [dayRes, payRes] = await Promise.all([
    weekIds.length ? client.from("salary_day_records").select("*").eq("status", 1).in("salary_week_id", weekIds) : Promise.resolve({ data: [] as Row[] }),
    weekIds.length ? client.from("salary_payments").select("*").eq("status", 1).in("salary_week_id", weekIds) : Promise.resolve({ data: [] as Row[] }),
  ]);
  const days = (dayRes.data ?? []).map((r) => mapDayRecord(r, ctx));
  const payments = (payRes.data ?? []).map((r) => mapSalaryPayment(r, ctx));

  const builtWeeks = selectedWeeks
    .sort((a, b) => a.week_start_date.localeCompare(b.week_start_date))
    .map((w) =>
      buildWeek(
        w,
        days.filter((d) => d.salary_week_id === w.id),
        payments.filter((p) => p.salary_week_id === w.id),
        ctx,
      ),
    );

  const monthPayments = [...payments].sort((a, b) => b.payment_date.localeCompare(a.payment_date));

  return {
    months,
    selected: { year: selectedYear, month: selectedMonth },
    employees: ctx.employees,
    taskTypes: ctx.taskTypes,
    weeks: builtWeeks,
    paymentMethods: ctx.methods.filter((m) => isSalaryPaymentMethodName(m.name)),
    totals: {
      totalPaid: round2(monthPayments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0)),
      totalPending: 0,
      totalCash: round2(monthPayments.filter((p) => p.method?.name.toLowerCase() === "caja").reduce((s, p) => s + p.amount, 0)),
      totalAccount: round2(monthPayments.filter((p) => p.method?.name.toLowerCase() === "cuenta de rosa").reduce((s, p) => s + p.amount, 0)),
      totalProject: round2(monthPayments.filter((p) => p.payment_type === "project").reduce((s, p) => s + p.amount, 0)),
      totalWork: round2(monthPayments.filter((p) => p.payment_type === "work").reduce((s, p) => s + p.amount, 0)),
    },
    taskRates: computeTaskRates(payments),
    recentPayments: monthPayments.slice(0, 20),
  };
}

export async function getSalaryWeekDetailReport(weekId: string) {
  if (!isAdminConfigured()) return null;
  const client = sb();
  const ctx = await loadSalaryRefs();
  const { data: weekRow } = await client.from("salary_weeks").select("*").eq("id", weekId).eq("status", 1).maybeSingle();
  if (!weekRow) return null;
  const week = mapWeek(weekRow);
  const [dayRes, payRes] = await Promise.all([
    client.from("salary_day_records").select("*").eq("status", 1).eq("salary_week_id", weekId),
    client.from("salary_payments").select("*").eq("status", 1).eq("salary_week_id", weekId),
  ]);
  const days = (dayRes.data ?? []).map((r) => mapDayRecord(r, ctx));
  const payments = (payRes.data ?? []).map((r) => mapSalaryPayment(r, ctx));

  return {
    week: buildWeek(week, days, payments, ctx),
    taskTypes: ctx.taskTypes,
    taskRates: computeTaskRates(payments),
    paymentMethods: ctx.methods.filter((m) => isSalaryPaymentMethodName(m.name)),
  };
}

export async function listEmployees(): Promise<Employee[]> {
  const ctx = await loadSalaryRefs();
  return ctx.employees;
}

export async function listTaskTypes(): Promise<TaskType[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await sb().from("task_types").select("id, name, module_type, status").eq("status", 1).order("name");
  return (data ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    module_type: t.module_type as TaskType["module_type"],
    is_active: true,
    created_at: "",
  }));
}

/* ----------------------------------------------------------- salary writes */

export interface SaveSalaryWeekData {
  id?: string;
  startDate: string;
  paymentDate: string;
  status: SalaryWeekStatus;
  userId: string | null;
}

export async function saveSalaryWeek(data: SaveSalaryWeekData): Promise<string> {
  const client = sb();
  const userId = await getCurrentUserId();
  const monday = startOfWeekFrom(data.startDate);
  const friday = addDays(monday, 4);
  const year = Number(monday.slice(0, 4));
  const month = Number(monday.slice(5, 7));

  let weekId = data.id;
  if (weekId) {
    const { data: existing } = await client.from("salary_weeks").select("week_status").eq("id", weekId).maybeSingle();
    if (!existing) throw new Error("Semana inválida");
    if ((existing.week_status as string) === "paid") throw new Error("La semana ya está pagada y no admite cambios");
    await client
      .from("salary_weeks")
      .update({ year, month, week_start_date: monday, week_end_date: friday, payment_date: data.paymentDate, week_status: data.status })
      .eq("id", weekId);
  } else {
    const { data: created, error } = await client
      .from("salary_weeks")
      .insert({ year, month, week_start_date: monday, week_end_date: friday, payment_date: data.paymentDate, week_status: data.status, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    weekId = created.id as string;
  }

  // Seed day records (mon-fri) for active employees that don't have them yet.
  const { data: empRows } = await client.from("employees").select("id").eq("status", 1);
  const { data: existingDays } = await client
    .from("salary_day_records")
    .select("employee_id, day_name")
    .eq("salary_week_id", weekId);
  const existingSet = new Set((existingDays ?? []).map((d) => `${d.employee_id}:${d.day_name}`));
  const toInsert: Row[] = [];
  for (const e of empRows ?? []) {
    for (let i = 0; i < 5; i++) {
      const workDate = addDays(monday, i);
      const dayName = weekdayKey(workDate);
      if (existingSet.has(`${e.id}:${dayName}`)) continue;
      toInsert.push({
        salary_week_id: weekId,
        employee_id: e.id,
        work_date: workDate,
        day_name: dayName,
        activity_type: "pending",
        record_status: "draft",
        created_by: userId,
      });
    }
  }
  if (toInsert.length) await client.from("salary_day_records").insert(toInsert);

  await audit("week_saved", weekId, data.id ? "Semana actualizada" : "Semana creada");
  return weekId;
}

export async function deleteSalaryWeek(data: { salaryWeekId: string; note: string; userId: string | null }): Promise<void> {
  const client = sb();
  const { data: week, error: weekLoadError } = await client
    .from("salary_weeks")
    .select("id, week_start_date, week_end_date, week_status, status")
    .eq("id", data.salaryWeekId)
    .maybeSingle();

  if (weekLoadError) throw new Error(weekLoadError.message);
  if (!week || Number(week.status ?? 0) !== 1) throw new Error("Semana no encontrada");
  if ((week.week_status as string) === "paid") {
    throw new Error("La semana ya está pagada y no admite eliminación desde esta tabla.");
  }

  const [dayResult, paymentResult, receiptResult] = await Promise.all([
    client.from("salary_day_records").update({ status: 0 }).eq("salary_week_id", data.salaryWeekId).eq("status", 1),
    client.from("salary_payments").update({ status: 0 }).eq("salary_week_id", data.salaryWeekId).eq("status", 1),
    client.from("salary_receipts").delete().eq("salary_week_id", data.salaryWeekId),
  ]);

  if (dayResult.error) throw new Error(dayResult.error.message);
  if (paymentResult.error) throw new Error(paymentResult.error.message);
  if (receiptResult.error) throw new Error(receiptResult.error.message);

  const { error } = await client.from("salary_weeks").update({ status: 0 }).eq("id", data.salaryWeekId);
  if (error) throw new Error(error.message);

  await audit(
    "week_deleted",
    data.salaryWeekId,
    `Semana eliminada: ${week.week_start_date as string} - ${week.week_end_date as string}. Observación: ${data.note.trim()}`,
  );
}

export interface SaveSalaryDayRecordData {
  id?: string;
  salaryWeekId: string;
  employeeId: string;
  workDate: string;
  dayName: SalaryWeekday;
  activityType: "project" | "work" | "week" | "hour" | "absent" | "pending";
  projectId: string | null;
  workId: string | null;
  taskTypeId: string | null;
  notes: string | null;
  status: "draft" | "recorded" | "observed";
  userId: string | null;
}

export async function saveSalaryDayRecord(data: SaveSalaryDayRecordData): Promise<string> {
  const client = sb();
  const { data: week } = await client.from("salary_weeks").select("week_status").eq("id", data.salaryWeekId).maybeSingle();
  if (!week) throw new Error("Semana inválida");
  if ((week.week_status as string) === "paid") throw new Error("La semana ya está cerrada y no admite cambios");

  const normalizedNotes = data.notes?.trim() || null;
  const sameDayRecord = (row: {
    activity_type: string;
    project_id: string | null;
    work_id: string | null;
    task_type_id: string | null;
    notes: string | null;
  }) =>
    row.activity_type === data.activityType &&
    row.project_id === data.projectId &&
    row.work_id === data.workId &&
    row.task_type_id === data.taskTypeId &&
    (row.notes ?? null) === normalizedNotes;

  const payload = {
    work_date: data.workDate,
    day_name: data.dayName,
    activity_type: data.activityType,
    project_id: data.projectId,
    work_id: data.workId,
    task_type_id: data.taskTypeId,
    notes: normalizedNotes,
    record_status: data.status,
  };

  let recordId = data.id;
  if (!recordId) {
    const { data: existingRows } = await client
      .from("salary_day_records")
      .select("id, activity_type, project_id, work_id, task_type_id, notes")
      .eq("salary_week_id", data.salaryWeekId)
      .eq("employee_id", data.employeeId)
      .eq("day_name", data.dayName)
      .eq("status", 1);
    const existing = (existingRows ?? []) as Array<{
      id: string;
      activity_type: string;
      project_id: string | null;
      work_id: string | null;
      task_type_id: string | null;
      notes: string | null;
    }>;
    if (existing.some(sameDayRecord)) {
      throw new Error("Ya existe una actividad igual para este día");
    }
    const placeholder = existing.find(
      (row) =>
        row.activity_type === "pending" &&
        !row.project_id &&
        !row.work_id &&
        !row.task_type_id &&
        !(row.notes ?? "").trim(),
    );
    if (existing.length === 1 && placeholder) {
      recordId = placeholder.id;
    }
  }

  if (recordId) {
    const { error } = await client.from("salary_day_records").update(payload).eq("id", recordId);
    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await client
      .from("salary_day_records")
      .insert({ ...payload, salary_week_id: data.salaryWeekId, employee_id: data.employeeId, created_by: await getCurrentUserId() })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    recordId = created.id as string;
  }
  return recordId;
}

export async function deleteSalaryDayRecord(data: { recordId: string; userId: string | null }): Promise<void> {
  const client = sb();
  const { data: record } = await client
    .from("salary_day_records")
    .select("id, salary_week_id, employee_id, work_date, day_name")
    .eq("id", data.recordId)
    .maybeSingle();
  if (!record) throw new Error("Actividad no encontrada");

  const { data: week } = await client
    .from("salary_weeks")
    .select("week_status")
    .eq("id", record.salary_week_id)
    .maybeSingle();
  if ((week?.week_status as string) === "paid") {
    throw new Error("La semana ya está pagada y no admite cambios");
  }

  const { error } = await client.from("salary_day_records").update({ status: 0 }).eq("id", data.recordId);
  if (error) throw new Error(error.message);

  const { data: remainingRows, error: remainingError } = await client
    .from("salary_day_records")
    .select("id, activity_type, project_id, work_id, task_type_id, notes")
    .eq("salary_week_id", record.salary_week_id)
    .eq("employee_id", record.employee_id)
    .eq("day_name", record.day_name)
    .eq("status", 1);
  if (remainingError) throw new Error(remainingError.message);

  const remaining = (remainingRows ?? []) as Array<{
    id: string;
    activity_type: string;
    project_id: string | null;
    work_id: string | null;
    task_type_id: string | null;
    notes: string | null;
  }>;
  const hasVisibleRecord = remaining.some(
    (row) =>
      !(
        row.activity_type === "pending" &&
        !row.project_id &&
        !row.work_id &&
        !row.task_type_id &&
        !(row.notes ?? "").trim()
      ),
  );

  if (remaining.length === 0 || !hasVisibleRecord) {
    const hasPlaceholder = remaining.some(
      (row) =>
        row.activity_type === "pending" &&
        !row.project_id &&
        !row.work_id &&
        !row.task_type_id &&
        !(row.notes ?? "").trim(),
    );
    if (!hasPlaceholder) {
      const { error: insertError } = await client.from("salary_day_records").insert({
        salary_week_id: record.salary_week_id,
        employee_id: record.employee_id,
        work_date: record.work_date,
        day_name: record.day_name,
        activity_type: "pending",
        record_status: "draft",
        created_by: await getCurrentUserId(),
      });
      if (insertError) throw new Error(insertError.message);
    }
  }

  await audit("day_record_deleted", data.recordId, "Actividad diaria eliminada");
}

export interface SaveSalaryPaymentData {
  id?: string;
  salaryWeekId: string;
  employeeId: string;
  paymentType: SalaryPaymentType;
  concept: string;
  amount: number;
  paymentMethodId: string;
  paymentDate: string;
  projectId: string | null;
  workId: string | null;
  taskTypeId: string | null;
  notes: string | null;
  status: "paid";
  userId: string | null;
}

async function projectTaskBudget(projectId: string | null, taskTypeId: string | null): Promise<number | null> {
  if (!projectId || !taskTypeId) return null;
  const client = sb();
  const [{ data: project }, { data: task }] = await Promise.all([
    client.from("projects").select("proposal_amount, modeling_3d_amount, plans_amount, render_amount").eq("id", projectId).maybeSingle(),
    client.from("task_types").select("name").eq("id", taskTypeId).maybeSingle(),
  ]);
  if (!project || !task) return null;
  const budgets: Record<string, number> = {
    Propuesta: num(project.proposal_amount),
    "Modelado 3D": num(project.modeling_3d_amount),
    Planos: num(project.plans_amount),
    Render: num(project.render_amount),
  };
  return budgets[task.name as string] ?? null;
}

async function projectAreaExpensePaid(projectId: string | null, taskTypeId: string | null): Promise<number> {
  if (!projectId || !taskTypeId) return 0;
  const client = sb();
  const { data: task } = await client.from("task_types").select("name").eq("id", taskTypeId).maybeSingle();
  const area = internalAreaFromTaskName(task?.name as string | undefined);
  if (!area) return 0;
  const { data } = await client
    .from("project_payments")
    .select("amount")
    .eq("status", 1)
    .eq("project_id", projectId)
    .eq("movement_type", "expense")
    .eq("internal_area", area);
  return round2((data ?? []).reduce((s, p) => s + num(p.amount), 0));
}

async function validateSalaryPaymentBudget(data: SaveSalaryPaymentData) {
  const budget = data.paymentType === "project" ? await projectTaskBudget(data.projectId, data.taskTypeId) : null;
  if (budget === null) return;
  const client = sb();
  let q = client
    .from("salary_payments")
    .select("id, amount")
    .eq("status", 1)
    .eq("salary_week_id", data.salaryWeekId)
    .eq("employee_id", data.employeeId)
    .eq("payment_type", data.paymentType)
    .eq("project_id", data.projectId as string);
  if (data.taskTypeId) q = q.eq("task_type_id", data.taskTypeId);
  const { data: prev } = await q;
  const previousPaid = (prev ?? [])
    .filter((p) => !(data.id && p.id === data.id))
    .reduce((s, p) => s + num(p.amount), 0);
  const externalPaid = await projectAreaExpensePaid(data.projectId, data.taskTypeId);
  const totalPaid = round2(previousPaid + externalPaid);
  const remaining = round2(budget - totalPaid);
  if (data.amount > remaining + 0.001) {
    throw new Error(
      `El pago excede el saldo disponible. Presupuesto: ${round2(budget)}, pagado: ${totalPaid}, disponible: ${remaining}.`,
    );
  }
}

export async function saveSalaryPayment(data: SaveSalaryPaymentData): Promise<string> {
  const client = sb();
  const { data: week } = await client.from("salary_weeks").select("week_status").eq("id", data.salaryWeekId).maybeSingle();
  if (!week) throw new Error("Semana inválida");
  if ((week.week_status as string) === "paid") throw new Error("La semana ya está pagada");

  const { data: method } = await client.from("payment_accounts").select("name").eq("id", data.paymentMethodId).eq("status", 1).maybeSingle();
  if (!method || !isSalaryPaymentMethodName(method.name as string)) {
    throw new Error("En salarios solo se puede pagar con Caja o Cuenta de Rosa");
  }

  data.projectId = data.paymentType === "project" ? data.projectId : null;
  data.workId = data.paymentType === "work" ? data.workId : null;
  if (data.paymentType !== "project" && data.paymentType !== "work") data.taskTypeId = null;

  await validateSalaryPaymentBudget(data);

  const payload = {
    salary_week_id: data.salaryWeekId,
    employee_id: data.employeeId,
    payment_type: data.paymentType,
    concept: data.concept.trim(),
    amount: round2(data.amount),
    payment_method_id: data.paymentMethodId,
    payment_date: data.paymentDate,
    project_id: data.projectId,
    work_id: data.workId,
    task_type_id: data.taskTypeId,
    notes: data.notes,
    payment_status: "paid",
  };

  let paymentId = data.id;
  if (paymentId) {
    const { error } = await client.from("salary_payments").update(payload).eq("id", paymentId);
    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await client
      .from("salary_payments")
      .insert({ ...payload, created_by: await getCurrentUserId() })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    paymentId = created.id as string;
  }
  await audit("payment_saved", paymentId, "Pago salarial registrado");
  return paymentId;
}

export async function deleteSalaryPayment(data: { paymentId: string; userId: string | null }): Promise<void> {
  const client = sb();
  const { data: payment } = await client.from("salary_payments").select("salary_week_id").eq("id", data.paymentId).maybeSingle();
  if (!payment) throw new Error("Pago no encontrado");
  const { data: week } = await client.from("salary_weeks").select("week_status").eq("id", payment.salary_week_id).maybeSingle();
  if ((week?.week_status as string) === "paid") throw new Error("La semana ya está pagada y no admite cambios");
  const { error } = await client.from("salary_payments").update({ status: 0 }).eq("id", data.paymentId);
  if (error) throw new Error(error.message);
  await audit("payment_deleted", data.paymentId, "Pago salarial eliminado");
}

async function validateSalaryWeekCanBePaid(weekId: string) {
  const client = sb();
  const ctx = await loadSalaryRefs();
  const { data: dayRows } = await client
    .from("salary_day_records")
    .select("*")
    .eq("status", 1)
    .eq("salary_week_id", weekId)
    .in("activity_type", ["project", "work"]);
  const { data: payRows } = await client.from("salary_payments").select("*").eq("status", 1).eq("salary_week_id", weekId);
  const payments = (payRows ?? []).map((r) => mapSalaryPayment(r, ctx));

  const groups = new Map<string, { employeeId: string; type: "project" | "work"; projectId: string | null; workId: string | null; taskTypeId: string | null; employeeName: string; referenceName: string; taskName: string }>();
  for (const r of dayRows ?? []) {
    const d = mapDayRecord(r, ctx);
    const reference = d.activity_type === "project" ? d.project : d.work;
    const key = [d.employee_id, d.activity_type, d.project_id ?? "", d.work_id ?? "", d.task_type_id ?? ""].join(":");
    groups.set(key, {
      employeeId: d.employee_id,
      type: d.activity_type === "project" ? "project" : "work",
      projectId: d.project_id,
      workId: d.work_id,
      taskTypeId: d.task_type_id,
      employeeName: d.employee?.full_name ?? "Empleado",
      referenceName: reference?.name ?? "Sin referencia",
      taskName: d.taskType?.name ?? "Sin tarea",
    });
  }

  const incomplete: string[] = [];
  for (const g of groups.values()) {
    const thisWeek = payments
      .filter(
        (p) =>
          p.employee_id === g.employeeId &&
          p.payment_type === g.type &&
          (g.type === "project" ? p.project_id === g.projectId : p.work_id === g.workId) &&
          p.task_type_id === g.taskTypeId,
      )
      .reduce((s, p) => s + p.amount, 0);
    if (round2(thisWeek) <= 0.001) {
      incomplete.push(`${g.employeeName}: ${g.referenceName} · ${g.taskName}`);
    }
  }
  if (incomplete.length > 0) {
    throw new Error(`Cada proyecto u obra trabajada necesita al menos un pago reconocido. Sin pago: ${incomplete.slice(0, 3).join("; ")}`);
  }
}

async function syncSalaryWeekMovements(weekId: string, userId: string | null) {
  const client = sb();
  const ctx = await loadSalaryRefs();
  const { data: payRows } = await client
    .from("salary_payments")
    .select("*")
    .eq("status", 1)
    .eq("salary_week_id", weekId)
    .in("payment_type", ["project", "work"]);
  const payments = (payRows ?? []).map((r) => mapSalaryPayment(r, ctx));

  const { data: synced } = await client.from("audit_logs").select("record_id").eq("action", "salary_synced");
  const syncedSet = new Set((synced ?? []).map((s) => s.record_id as string));

  for (const p of payments) {
    if (syncedSet.has(p.id)) continue;
    const concept = `Pago salarial: ${p.employee?.full_name ?? "Empleado"} · ${p.taskType?.name ?? p.concept}`;

    if (p.payment_type === "project" && p.project_id) {
      await client.from("project_payments").insert({
        project_id: p.project_id,
        movement_type: "expense",
        concept,
        amount: round2(p.amount),
        payment_date: p.payment_date,
        payment_method_id: p.payment_method_id,
        internal_area: internalAreaFromTaskName(p.taskType?.name),
        created_by: userId,
      });
    }
    if (p.payment_type === "work" && p.work_id) {
      await client.from("work_movements").insert({
        work_id: p.work_id,
        receipt: `SAL-${p.payment_date}`,
        movement_date: p.payment_date,
        concept,
        supplier: p.employee?.full_name ?? "Empleado",
        category: "Honorarios",
        movement_type: "expense",
        amount: round2(p.amount),
        payment_method_id: p.payment_method_id,
        observations: `Generado desde salarios. Pago ${p.id}.`,
        created_by: userId,
      });
    }
    await audit("salary_synced", p.id, "Pago salarial sincronizado");
  }
}

export async function updateSalaryWeekStatus(data: {
  salaryWeekId: string;
  status: SalaryWeekStatus;
  userId: string | null;
}): Promise<void> {
  const client = sb();
  const { data: week } = await client.from("salary_weeks").select("id").eq("id", data.salaryWeekId).maybeSingle();
  if (!week) throw new Error("Semana inválida");

  if (data.status === "paid") {
    const { data: emps } = await client.from("employees").select("id, full_name").eq("status", 1);
    const { data: dayRows } = await client
      .from("salary_day_records")
      .select("employee_id")
      .eq("status", 1)
      .eq("salary_week_id", data.salaryWeekId);
    for (const e of emps ?? []) {
      const count = (dayRows ?? []).filter((d) => d.employee_id === e.id).length;
      if (count < 5) throw new Error(`Faltan actividades por registrar para ${e.full_name}`);
    }
    await validateSalaryWeekCanBePaid(data.salaryWeekId);
    await syncSalaryWeekMovements(data.salaryWeekId, await getCurrentUserId());
  }

  await client.from("salary_weeks").update({ week_status: data.status }).eq("id", data.salaryWeekId);
  await audit("week_status_changed", data.salaryWeekId, `Semana marcada como ${data.status}`);
}

/* ───────────────────────── Comprobantes de pago a empleados ──────────────── */

type SalaryRefType = "project" | "work";

/** ISO yyyy-mm-dd → "dd/mm/yy". */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(-2)}`;
}

async function getOrCreateSalaryReceiptCode(
  weekId: string,
  employeeId: string,
  refType: SalaryRefType,
  refId: string,
): Promise<{ code: string; signature: string | null }> {
  const client = sb();

  const { data: existing } = await client
    .from("salary_receipts")
    .select("code, signature")
    .eq("salary_week_id", weekId)
    .eq("employee_id", employeeId)
    .eq("ref_type", refType)
    .eq("ref_id", refId)
    .maybeSingle();
  if (existing?.code)
    return { code: existing.code as string, signature: (existing.signature as string) ?? null };

  const { data: top } = await client
    .from("salary_receipts")
    .select("code")
    .like("code", `${SALARY_RECEIPT_PREFIX}-%`)
    .order("code", { ascending: false })
    .limit(1);
  const seq = parseSeqWithPrefix(SALARY_RECEIPT_PREFIX, top?.[0]?.code as string | undefined) + 1;
  const code = formatCodeWithPrefix(SALARY_RECEIPT_PREFIX, seq);

  const { error } = await client.from("salary_receipts").insert({
    salary_week_id: weekId,
    employee_id: employeeId,
    ref_type: refType,
    ref_id: refId,
    code,
  });
  if (error) {
    // Carrera con otra inserción: relee el código ya existente.
    const { data: again } = await client
      .from("salary_receipts")
      .select("code, signature")
      .eq("salary_week_id", weekId)
      .eq("employee_id", employeeId)
      .eq("ref_type", refType)
      .eq("ref_id", refId)
      .maybeSingle();
    if (again?.code)
      return { code: again.code as string, signature: (again.signature as string) ?? null };
    throw new Error(error.message);
  }
  return { code, signature: null };
}

/** Guarda la firma del comprobante de pago a empleado (crea la fila si no existe). */
export async function setSalaryReceiptSignature(
  weekId: string,
  employeeId: string,
  refType: SalaryRefType,
  refId: string,
  signature: string,
): Promise<void> {
  // Garantiza que exista la fila con su código antes de firmar.
  await getOrCreateSalaryReceiptCode(weekId, employeeId, refType, refId);
  const { error } = await sb()
    .from("salary_receipts")
    .update({ signature, signed_at: new Date().toISOString() })
    .eq("salary_week_id", weekId)
    .eq("employee_id", employeeId)
    .eq("ref_type", refType)
    .eq("ref_id", refId);
  if (error) throw new Error(error.message);
}

/** Comprobante de pago semanal a un empleado por el total pagado en la semana. */
export async function getSalaryReceipt(
  weekId: string,
  employeeId: string,
  refType: SalaryRefType,
  refId: string,
): Promise<ReceiptData | null> {
  if (!isAdminConfigured()) return null;
  const client = sb();
  void refType;
  void refId;

  const [{ data: week }, { data: emp }, { data: pays }] = await Promise.all([
    client
      .from("salary_weeks")
      .select("payment_date, week_start_date, week_end_date")
      .eq("id", weekId)
      .maybeSingle(),
    client.from("employees").select("full_name").eq("id", employeeId).maybeSingle(),
    client
      .from("salary_payments")
      .select("amount")
      .eq("salary_week_id", weekId)
      .eq("employee_id", employeeId)
      .eq("status", 1),
  ]);
  if (!week || !emp) return null;

  const amount = round2(
    (pays ?? [])
      .reduce((s, p) => s + Number((p as Row).amount), 0),
  );
  if (amount <= 0) return null;
  const stableRefType: SalaryRefType = "project";
  const stableRefId = weekId;
  const { code, signature } = await getOrCreateSalaryReceiptCode(
    weekId,
    employeeId,
    stableRefType,
    stableRefId,
  );

  return {
    docType: "pago",
    kind: "proyecto",
    code,
    amount,
    concept: `Pago de mano de obra (${shortDate(week.week_start_date as string)} - ${shortDate(
      week.week_end_date as string,
    )})`,
    date: week.payment_date as string,
    clientName: (emp.full_name as string) ?? "",
    subjectName: null,
    signature,
  };
}
