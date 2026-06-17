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
  FinanceUtilityReport,
  GeneralBalanceAccountReport,
  GeneralBalanceHistoryRow,
  GeneralBalanceReport,
  GeneralBalanceRow,
  InternalArea,
  PaymentMethod,
  SalaryDayRecordWithRelations,
  SalaryPaymentWithRelations,
  SalaryPaymentType,
  SalaryReport,
  SalaryWeekWithRows,
  SalaryWeekday,
  SalaryWeekStatus,
  TaskType,
} from "@/lib/types";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/features/auth/get-user";
import { getUtilityReport, listProjects } from "./projects";
import { getWorksAdministrationUtilityReport, listWorks } from "./works";
import { listWorkOrders } from "./orders";

type Row = Record<string, unknown>;

function sb() {
  return createAdminClient();
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
  const [pp, wm, it, wt] = await Promise.all([
    client.from("project_payments").select("payment_method_id, movement_type, amount").eq("status", 1),
    client.from("work_movements").select("payment_method_id, movement_type, amount").eq("status", 1),
    client.from("internal_transfers").select("from_payment_method_id, to_payment_method_id, amount").eq("status", 1),
    client.from("work_internal_transfers").select("from_payment_method_id, to_payment_method_id, amount").eq("status", 1),
  ]);

  const balances = new Map<string, number>();
  const add = (id: string | null, delta: number) => {
    if (!id) return;
    balances.set(id, round2((balances.get(id) ?? 0) + delta));
  };
  for (const p of pp.data ?? [])
    add(p.payment_method_id as string, (p.movement_type as string) === "income" ? num(p.amount) : -num(p.amount));
  for (const m of wm.data ?? [])
    add(m.payment_method_id as string, (m.movement_type as string) === "income" ? num(m.amount) : -num(m.amount));
  for (const t of it.data ?? []) {
    add(t.from_payment_method_id as string, -num(t.amount));
    add(t.to_payment_method_id as string, num(t.amount));
  }
  for (const t of wt.data ?? []) {
    add(t.from_payment_method_id as string, -num(t.amount));
    add(t.to_payment_method_id as string, num(t.amount));
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

export async function getDebtReport(): Promise<DebtReportRow[]> {
  if (!isAdminConfigured()) return [];
  const providerBalances = new Map<string, number>();
  const works = await listWorks();
  for (const work of works) {
    for (const order of await listWorkOrders(work.id)) {
      if (order.amount === null || order.pending <= 0.001) continue;
      providerBalances.set(
        order.supplier,
        round2((providerBalances.get(order.supplier) ?? 0) + order.pending),
      );
    }
  }

  const { data: debtorRows } = await sb()
    .from("manual_debtors")
    .select("id, name, amount")
    .eq("status", 1);

  const debtors: DebtReportRow[] = (debtorRows ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    amount: num(d.amount),
    type: "debtor",
    source: "manual",
  }));
  const providers: DebtReportRow[] = [...providerBalances.entries()].map(([provider, amount]) => ({
    id: `provider-${provider}`,
    name: provider,
    amount,
    type: "provider",
    source: "orders",
  }));
  return [...debtors, ...providers];
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
      for (const work of await listWorks()) {
        for (const order of await listWorkOrders(work.id)) {
          if (order.amount === null || order.pending <= 0.001) continue;
          history.push({
            id: `order-payable-${order.id}`,
            date: order.quoted_at ?? order.order_date,
            description: `${order.material} · ${work.name}`,
            expenseAccount: account.label,
            incomeAccount: order.supplier,
            amount: order.pending,
            source: "orders",
          });
        }
      }
    } else {
      const [wmRes, ppRes, projRes] = await Promise.all([
        client.from("work_movements").select("*").eq("status", 1).eq("payment_method_id", method.id),
        client.from("project_payments").select("*").eq("status", 1).eq("payment_method_id", method.id),
        client.from("projects").select("id, name"),
      ]);
      const projectName = new Map((projRes.data ?? []).map((p) => [p.id as string, p.name as string]));
      for (const m of wmRes.data ?? []) {
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
    .sort((a, b) => a.localeCompare(b))
    .map((month) => {
      const projectUtility = round2(projectByMonth.get(month) ?? 0);
      const workUtility = round2(workByMonth.get(month) ?? 0);
      return { month, projectUtility, workUtility, totalUtility: round2(projectUtility + workUtility) };
    });
  const projectTotal = round2(rows.reduce((s, r) => s + r.projectUtility, 0));
  const workTotal = round2(rows.reduce((s, r) => s + r.workUtility, 0));
  return { rows, projectTotal, workTotal, total: round2(projectTotal + workTotal) };
}

export interface SaveManualDebtorData {
  id?: string;
  name: string;
  amount: number;
  userId: string | null;
}

export async function saveManualDebtor(data: SaveManualDebtorData): Promise<string> {
  const client = sb();
  if (data.id) {
    const { error } = await client
      .from("manual_debtors")
      .update({ name: data.name.trim(), amount: round2(data.amount) })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return data.id;
  }
  const { data: created, error } = await client
    .from("manual_debtors")
    .insert({ name: data.name.trim(), amount: round2(data.amount), created_by: await getCurrentUserId() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
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
    const empDays = dayRecords.filter((d) => d.employee_id === employee.id);
    const empPays = payments.filter((p) => p.employee_id === employee.id);
    const cash = round2(empPays.filter((p) => p.method?.name.toLowerCase() === "caja").reduce((s, p) => s + p.amount, 0));
    const account = round2(empPays.filter((p) => p.method?.name.toLowerCase() === "cuenta de rosa").reduce((s, p) => s + p.amount, 0));
    const projectOrWork = round2(empPays.filter((p) => p.payment_type === "project" || p.payment_type === "work").reduce((s, p) => s + p.amount, 0));
    return {
      employee,
      dayRecords: Object.fromEntries(empDays.map((d) => [d.day_name, d])) as Partial<
        Record<SalaryWeekday, SalaryDayRecordWithRelations>
      >,
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
  const { data: weekRow } = await client.from("salary_weeks").select("*").eq("id", weekId).maybeSingle();
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

export interface SaveSalaryDayRecordData {
  id?: string;
  salaryWeekId: string;
  employeeId: string;
  workDate: string;
  dayName: SalaryWeekday;
  activityType: "project" | "work" | "absent" | "pending";
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

  const payload = {
    work_date: data.workDate,
    day_name: data.dayName,
    activity_type: data.activityType,
    project_id: data.projectId,
    work_id: data.workId,
    task_type_id: data.taskTypeId,
    notes: data.notes,
    record_status: data.status,
  };

  let recordId = data.id;
  if (!recordId) {
    const { data: existing } = await client
      .from("salary_day_records")
      .select("id")
      .eq("salary_week_id", data.salaryWeekId)
      .eq("employee_id", data.employeeId)
      .eq("day_name", data.dayName)
      .maybeSingle();
    recordId = existing?.id as string | undefined;
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
    const external = g.type === "project" ? await projectAreaExpensePaid(g.projectId, g.taskTypeId) : 0;
    if (round2(thisWeek + external) <= 0.001) {
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

/** Comprobante de pago a un empleado por todo lo trabajado en un proyecto/obra esa semana. */
export async function getSalaryReceipt(
  weekId: string,
  employeeId: string,
  refType: SalaryRefType,
  refId: string,
): Promise<ReceiptData | null> {
  if (!isAdminConfigured()) return null;
  const client = sb();

  const [{ data: week }, { data: emp }, { data: pays }] = await Promise.all([
    client
      .from("salary_weeks")
      .select("payment_date, week_start_date, week_end_date")
      .eq("id", weekId)
      .maybeSingle(),
    client.from("employees").select("full_name").eq("id", employeeId).maybeSingle(),
    client
      .from("salary_payments")
      .select("amount, project_id, work_id")
      .eq("salary_week_id", weekId)
      .eq("employee_id", employeeId)
      .eq("status", 1),
  ]);
  if (!week || !emp) return null;

  const refCol = refType === "project" ? "project_id" : "work_id";
  const amount = round2(
    (pays ?? [])
      .filter((p) => (p as Row)[refCol] === refId)
      .reduce((s, p) => s + Number((p as Row).amount), 0),
  );
  if (amount <= 0) return null;

  const refTable = refType === "project" ? "projects" : "works";
  const { data: ref } = await client
    .from(refTable)
    .select("name")
    .eq("id", refId)
    .maybeSingle();

  const { code, signature } = await getOrCreateSalaryReceiptCode(weekId, employeeId, refType, refId);

  return {
    docType: "pago",
    kind: refType === "project" ? "proyecto" : "obra",
    code,
    amount,
    concept: `Pago de mano de obra (${shortDate(week.week_start_date as string)} - ${shortDate(
      week.week_end_date as string,
    )})`,
    date: week.payment_date as string,
    clientName: (emp.full_name as string) ?? "",
    subjectName: (ref?.name as string) ?? "",
    signature,
  };
}
