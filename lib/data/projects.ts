// Public data-access API for the Projects module.
// Server-only. Backed by Supabase (service-role client). Components and server
// actions import from here; signatures and return shapes are stable.

import "server-only";

import {
  computeBreakdown,
  computeFinance,
  round2,
  weightsFromAmounts,
  type Addon,
  type ProjectDistribution,
} from "@/lib/calculations";
import { MARKUP, PROJECT_SLICE_LABELS, resolveTemplateWeights, type SliceWeights } from "@/lib/constants";
import {
  RECEIPT_PREFIX,
  formatReceiptCode,
  parseReceiptSeq,
  type ReceiptData,
} from "@/lib/receipt";
import { writeAudit } from "./audit";
import type {
  Client,
  InternalArea,
  InternalTransferWithMethods,
  PaymentMethod,
  PaymentMethodReportRow,
  PaymentWithMethod,
  ProjectAddon,
  ProjectPayment,
  ProjectResponsible,
  ProjectTemplate,
  ProjectWithFinance,
  PaymentStatus,
  UtilityReportRow,
} from "@/lib/types";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/features/auth/get-user";

export interface ProjectFilters {
  search?: string;
  client?: string;
  status?: PaymentStatus | "all";
  dateFrom?: string;
  dateTo?: string;
}

function sb() {
  return createAdminClient();
}

/* --------------------------------------------------------------- mappers */

type Row = Record<string, unknown>;

function mapClient(r: Row): Client {
  return {
    id: r.id as string,
    name: r.name as string,
    created_at: r.created_at as string,
    updated_at: (r.updated_at as string) ?? (r.created_at as string),
    created_by: (r.created_by as string) ?? null,
  };
}

function mapPayment(r: Row): ProjectPayment {
  return {
    id: r.id as string,
    project_id: r.project_id as string,
    movement_type: r.movement_type as ProjectPayment["movement_type"],
    concept: r.concept as string,
    amount: Number(r.amount),
    payment_date: r.payment_date as string,
    payment_method_id: (r.payment_method_id as string) ?? "",
    internal_area: (r.internal_area as InternalArea) ?? null,
    receipt_code: (r.receipt_code as string) ?? null,
    created_at: r.created_at as string,
    created_by: (r.created_by as string) ?? null,
  };
}

function mapAddon(r: Row): ProjectAddon {
  return {
    id: r.id as string,
    project_id: r.project_id as string,
    concept: r.concept as string,
    amount: Number(r.amount),
    created_at: r.created_at as string,
  };
}

function mapProjectBase(r: Row) {
  return {
    id: r.id as string,
    client_id: r.client_id as string,
    name: r.name as string,
    address: (r.address as string) ?? null,
    template: (r.template as ProjectTemplate) ?? "diamante",
    project_amount: Number(r.project_amount),
    office_amount: Number(r.office_amount),
    utility_amount: Number(r.utility_amount),
    addons_total: Number(r.addons_total),
    total_amount: Number(r.total_amount),
    proposal_amount: Number(r.proposal_amount),
    modeling_3d_amount: Number(r.modeling_3d_amount),
    plans_amount: Number(r.plans_amount),
    render_amount: Number(r.render_amount),
    proposal_responsible: (r.proposal_responsible as ProjectResponsible) ?? "Alejandra",
    modeling_3d_responsible: (r.modeling_3d_responsible as ProjectResponsible) ?? "Alejandra",
    plans_responsible: (r.plans_responsible as ProjectResponsible) ?? "Alejandra",
    render_responsible: (r.render_responsible as ProjectResponsible) ?? "Alejandra",
    created_at: r.created_at as string,
    updated_at: (r.updated_at as string) ?? (r.created_at as string),
    created_by: (r.created_by as string) ?? null,
  };
}

function enrichRow(r: Row): ProjectWithFinance | null {
  const client = r.client as Row | null;
  if (!client) return null;
  const payments = ((r.payments as Row[]) ?? [])
    .filter((p) => (p.status as number) !== 0)
    .map(mapPayment);
  const addons = ((r.addons as Row[]) ?? [])
    .filter((a) => (a.status as number) !== 0)
    .map(mapAddon);
  return {
    ...mapProjectBase(r),
    client: mapClient(client),
    finance: computeFinance(Number(r.total_amount), payments),
    payments_count: payments.length,
    addons,
  };
}

const PROJECT_SELECT =
  "*, client:clients(*), payments:project_payments(*), addons:project_addons(*)";

/* ----------------------------------------------------------------- reads */

export async function listClients(): Promise<Client[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await sb().from("clients").select("*").eq("status", 1).order("name");
  return (data ?? []).map(mapClient);
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await sb()
    .from("payment_accounts")
    .select("id, name, created_at, status")
    .eq("status", 1)
    .order("name");
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    is_active: true,
    created_at: r.created_at as string,
  }));
}

export async function listProjects(filters: ProjectFilters = {}): Promise<ProjectWithFinance[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await sb().from("projects").select(PROJECT_SELECT).eq("status", 1);

  const search = filters.search?.trim().toLowerCase();
  const client = filters.client?.trim().toLowerCase();
  const from = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
  const to = filters.dateTo ? new Date(filters.dateTo + "T23:59:59").getTime() : null;

  const rows = (data ?? [])
    .map(enrichRow)
    .filter((p): p is ProjectWithFinance => p !== null)
    .filter((p) => {
      if (
        search &&
        !p.name.toLowerCase().includes(search) &&
        !(p.address?.toLowerCase().includes(search) ?? false)
      )
        return false;
      if (client && !p.client.name.toLowerCase().includes(client)) return false;
      if (filters.status && filters.status !== "all" && p.finance.status !== filters.status)
        return false;
      const created = new Date(p.created_at).getTime();
      if (from !== null && created < from) return false;
      if (to !== null && created > to) return false;
      return true;
    });

  return rows.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function getProject(id: string): Promise<ProjectWithFinance | null> {
  if (!isAdminConfigured()) return null;
  const { data } = await sb()
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", id)
    .maybeSingle();
  return data ? enrichRow(data) : null;
}

export async function listMovements(projectId: string): Promise<PaymentWithMethod[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await sb()
    .from("project_payments")
    .select("*, method:payment_accounts(id, name, created_at)")
    .eq("project_id", projectId)
    .eq("status", 1)
    .order("payment_date", { ascending: false });
  return (data ?? []).map((r) => ({
    ...mapPayment(r),
    method: r.method
      ? {
          id: (r.method as Row).id as string,
          name: (r.method as Row).name as string,
          is_active: true,
          created_at: (r.method as Row).created_at as string,
        }
      : null,
  }));
}

export async function listInternalTransfers(): Promise<InternalTransferWithMethods[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await sb()
    .from("internal_transfers")
    .select(
      "*, fromMethod:payment_accounts!internal_transfers_from_payment_method_id_fkey(id,name,created_at), toMethod:payment_accounts!internal_transfers_to_payment_method_id_fkey(id,name,created_at)",
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
    fromMethod: r.fromMethod
      ? { id: (r.fromMethod as Row).id as string, name: (r.fromMethod as Row).name as string, is_active: true, created_at: (r.fromMethod as Row).created_at as string }
      : null,
    toMethod: r.toMethod
      ? { id: (r.toMethod as Row).id as string, name: (r.toMethod as Row).name as string, is_active: true, created_at: (r.toMethod as Row).created_at as string }
      : null,
  }));
}

export async function getPaymentMethodReport(): Promise<PaymentMethodReportRow[]> {
  if (!isAdminConfigured()) return [];
  const client = sb();
  const [methodsRes, paymentsRes, transfersRes] = await Promise.all([
    client.from("payment_accounts").select("id, name").eq("status", 1),
    client.from("project_payments").select("payment_method_id, movement_type, amount").eq("status", 1),
    client
      .from("internal_transfers")
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
      normalBalance: 0,
      officeBalance: 0,
      finalBalance: 0,
    });
  }
  for (const p of paymentsRes.data ?? []) {
    const row = rows.get(p.payment_method_id as string);
    if (!row) continue;
    const sign = (p.movement_type as string) === "income" ? 1 : -1;
    row.clientMovements = round2(row.clientMovements + Number(p.amount) * sign);
  }
  for (const t of transfersRes.data ?? []) {
    const fromRow = rows.get(t.from_payment_method_id as string);
    const toRow = rows.get(t.to_payment_method_id as string);
    if (fromRow) fromRow.internalMovements = round2(fromRow.internalMovements - Number(t.amount));
    if (toRow) toRow.internalMovements = round2(toRow.internalMovements + Number(t.amount));
  }
  return [...rows.values()].map((row) => ({
    ...row,
    normalBalance: round2(row.clientMovements + row.internalMovements),
    officeBalance: 0,
    finalBalance: round2(row.clientMovements + row.internalMovements),
  }));
}

export async function getUtilityReport(): Promise<UtilityReportRow[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await sb()
    .from("project_payments")
    .select("payment_date, movement_type, amount")
    .eq("status", 1)
    .eq("movement_type", "income");
  const byMonth = new Map<string, number>();
  for (const p of data ?? []) {
    const month = (p.payment_date as string).slice(0, 7);
    byMonth.set(month, round2((byMonth.get(month) ?? 0) + Number(p.amount) * MARKUP.utility));
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, utilityAmount]) => ({ month, utilityAmount: round2(utilityAmount) }));
}

export async function getProjectsInternalAreaPaid(): Promise<
  Record<string, Record<InternalArea, number>>
> {
  if (!isAdminConfigured()) return {};
  const { data } = await sb()
    .from("project_payments")
    .select("project_id, internal_area, movement_type, amount")
    .eq("status", 1)
    .eq("movement_type", "expense");
  const result: Record<string, Record<InternalArea, number>> = {};
  for (const p of data ?? []) {
    const area = p.internal_area as InternalArea | null;
    if (!area) continue;
    const pid = p.project_id as string;
    result[pid] ??= { proposal: 0, modeling_3d: 0, plans: 0, render: 0 };
    result[pid][area] = round2(result[pid][area] + Number(p.amount));
  }
  return result;
}

/* ---------------------------------------------------------------- writes */

async function findOrCreateClient(
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

export interface CreateProjectData {
  name: string;
  address?: string;
  clientId?: string;
  clientName?: string;
  template: ProjectTemplate;
  weights?: SliceWeights;
  distributionAmounts?: ProjectDistribution;
  responsibles: Record<InternalArea, ProjectResponsible>;
  projectAmount: number;
  addons: Addon[];
  anticipo?: { amount: number; concept: string; methodId: string; date: string };
  userId: string | null;
}

export async function createProject(data: CreateProjectData): Promise<string> {
  const client = sb();
  const userId = await getCurrentUserId();
  const clientId = await findOrCreateClient(data.clientId, data.clientName);
  const weights = resolveTemplateWeights(data.template, data.weights);
  const projectAmount = data.template === "credito" ? 0 : data.projectAmount;
  const b = computeBreakdown(projectAmount, data.addons, weights);
  const projectDistribution =
    data.template === "especial" && data.distributionAmounts
      ? data.distributionAmounts
      : b.project;

  const { data: project, error } = await client
    .from("projects")
    .insert({
      client_id: clientId,
      name: data.name.trim(),
      address: data.address?.trim() || null,
      template: data.template,
      project_amount: b.base,
      office_amount: b.markup.office,
      utility_amount: b.markup.utility,
      addons_total: b.addonsTotal,
      total_amount: b.total,
      proposal_amount: projectDistribution.proposal,
      modeling_3d_amount: projectDistribution.modeling_3d,
      plans_amount: projectDistribution.plans,
      render_amount: projectDistribution.render,
      proposal_responsible: data.responsibles.proposal,
      modeling_3d_responsible: data.responsibles.modeling_3d,
      plans_responsible: data.responsibles.plans,
      render_responsible: data.responsibles.render,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const projectId = project.id as string;

  if (data.addons.length > 0) {
    await client.from("project_addons").insert(
      data.addons.map((a) => ({
        project_id: projectId,
        concept: a.concept.trim(),
        amount: a.amount,
      })),
    );
  }

  if (data.template === "credito") {
    await ensureCreditProjectDebtor(projectId, data.anticipo?.date);
  }

  if (data.anticipo) {
    const receiptCode = await nextProjectReceiptCode();
    const concept = data.anticipo.concept.trim();
    const { data: payment, error: paymentError } = await client
      .from("project_payments")
      .insert({
        project_id: projectId,
        movement_type: "income",
        concept,
        amount: data.anticipo.amount,
        payment_date: data.anticipo.date,
        payment_method_id: data.anticipo.methodId,
        internal_area: null,
        receipt_code: receiptCode,
        created_by: userId,
      })
      .select("id")
      .single();
    if (paymentError) throw new Error(paymentError.message);
    await syncCreditProjectDebtFromMovement({
      after: {
        id: payment.id as string,
        project_id: projectId,
        movement_type: "income",
        amount: data.anticipo.amount,
        payment_date: data.anticipo.date,
        payment_method_id: data.anticipo.methodId,
        internal_area: null,
        status: 1,
        concept,
      },
    });
  }

  return projectId;
}

export interface UpdateProjectData {
  id: string;
  name: string;
  address?: string;
  clientId?: string;
  clientName?: string;
  responsibles: Record<InternalArea, ProjectResponsible>;
  weights?: SliceWeights;
  distributionAmounts?: ProjectDistribution;
  projectAmount: number;
  addons: Addon[];
  userId: string | null;
}

export async function updateProject(data: UpdateProjectData): Promise<void> {
  const client = sb();
  const { data: existing } = await client
    .from("projects")
    .select("template, proposal_amount, modeling_3d_amount, plans_amount, render_amount")
    .eq("id", data.id)
    .maybeSingle();
  if (!existing) throw new Error("Proyecto no encontrado");

  const clientId = await findOrCreateClient(data.clientId, data.clientName);
  const weights =
    data.weights ??
    weightsFromAmounts({
      proposal: Number(existing.proposal_amount),
      modeling_3d: Number(existing.modeling_3d_amount),
      plans: Number(existing.plans_amount),
      render: Number(existing.render_amount),
    });
  const projectAmount = existing.template === "credito" ? 0 : data.projectAmount;
  const b = computeBreakdown(projectAmount, data.addons, weights);
  const projectDistribution =
    existing.template === "especial" && data.distributionAmounts
      ? data.distributionAmounts
      : b.project;

  const { error } = await client
    .from("projects")
    .update({
      name: data.name.trim(),
      address: data.address?.trim() || null,
      client_id: clientId,
      project_amount: b.base,
      office_amount: b.markup.office,
      utility_amount: b.markup.utility,
      addons_total: b.addonsTotal,
      total_amount: b.total,
      proposal_amount: projectDistribution.proposal,
      modeling_3d_amount: projectDistribution.modeling_3d,
      plans_amount: projectDistribution.plans,
      render_amount: projectDistribution.render,
      proposal_responsible: data.responsibles.proposal,
      modeling_3d_responsible: data.responsibles.modeling_3d,
      plans_responsible: data.responsibles.plans,
      render_responsible: data.responsibles.render,
    })
    .eq("id", data.id);
  if (error) throw new Error(error.message);

  await client.from("project_addons").delete().eq("project_id", data.id);
  if (data.addons.length > 0) {
    await client.from("project_addons").insert(
      data.addons.map((a) => ({
        project_id: data.id,
        concept: a.concept.trim(),
        amount: a.amount,
      })),
    );
  }

  if (existing.template === "credito") {
    await ensureCreditProjectDebtor(data.id);
  }
}

export interface RegisterPaymentData {
  projectId: string;
  movementType: "income" | "expense";
  concept: string;
  amount: number;
  paymentDate: string;
  paymentMethodId: string;
  internalArea?: InternalArea | null;
  userId: string | null;
}

async function nextProjectReceiptCode(): Promise<string> {
  const { data } = await sb()
    .from("project_payments")
    .select("receipt_code")
    .like("receipt_code", `${RECEIPT_PREFIX.proyecto}-%`)
    .order("receipt_code", { ascending: false })
    .limit(1);
  const seq = parseReceiptSeq("proyecto", data?.[0]?.receipt_code as string | undefined) + 1;
  return formatReceiptCode("proyecto", seq);
}

type ProjectMovementDebtSnapshot = {
  id: string;
  project_id: string;
  movement_type: "income" | "expense";
  amount: number;
  payment_date: string;
  payment_method_id: string | null;
  internal_area: InternalArea | null;
  status: number;
  concept: string;
};

type CreditProjectDebtor = {
  id: string;
  amount: number;
};

function toDebtSnapshot(row: Row | null | undefined): ProjectMovementDebtSnapshot | null {
  if (!row) return null;
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    movement_type: row.movement_type as "income" | "expense",
    amount: Number(row.amount),
    payment_date: row.payment_date as string,
    payment_method_id: (row.payment_method_id as string) ?? null,
    internal_area: (row.internal_area as InternalArea) ?? null,
    status: Number((row.status as number | undefined) ?? 1),
    concept: (row.concept as string) ?? "",
  };
}

function activeCreditExpenseAmount(row: ProjectMovementDebtSnapshot | null): number {
  if (!row || row.status === 0 || row.movement_type !== "expense" || !row.internal_area) return 0;
  return Number.isFinite(row.amount) ? row.amount : 0;
}

function activeCreditIncome(row: ProjectMovementDebtSnapshot | null) {
  if (!row || row.status === 0 || row.movement_type !== "income") return null;
  return row;
}

async function creditProjectInfo(projectId: string): Promise<{
  projectName: string;
  clientName: string;
} | null> {
  const { data, error } = await sb()
    .from("projects")
    .select("name, template, client:clients(name)")
    .eq("id", projectId)
    .eq("status", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.template !== "credito") return null;

  const rawClient = data.client as Row | Row[] | null;
  const clientRow = Array.isArray(rawClient) ? rawClient[0] : rawClient;
  return {
    projectName: (data.name as string) || "Proyecto",
    clientName: (clientRow?.name as string) || "Cliente",
  };
}

async function ensureCreditProjectDebtor(
  projectId: string,
  loanDate?: string | null,
): Promise<CreditProjectDebtor | null> {
  const info = await creditProjectInfo(projectId);
  if (!info) return null;

  const client = sb();
  const note = `Proyecto a crédito: ${info.projectName}`;
  const { data: existing, error: existingError } = await client
    .from("manual_debtors")
    .select("id, amount")
    .eq("project_id", projectId)
    .eq("status", 1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { error } = await client
      .from("manual_debtors")
      .update({ name: info.clientName, note })
      .eq("id", existing.id as string);
    if (error) throw new Error(error.message);
    return { id: existing.id as string, amount: Number(existing.amount) };
  }

  const { data: created, error } = await client
    .from("manual_debtors")
    .insert({
      name: info.clientName,
      amount: 0,
      source_account_id: null,
      project_id: projectId,
      loan_date: loanDate || new Date().toISOString().slice(0, 10),
      note,
      created_by: await getCurrentUserId(),
    })
    .select("id, amount")
    .single();
  if (error) throw new Error(error.message);
  return { id: created.id as string, amount: Number(created.amount) };
}

async function adjustCreditProjectPrincipal(
  projectId: string,
  delta: number,
  loanDate?: string | null,
) {
  if (Math.abs(delta) < 0.001) return;
  const debtor = await ensureCreditProjectDebtor(projectId, loanDate);
  if (!debtor) return;

  const nextAmount = round2(Math.max(debtor.amount + delta, 0));
  const { error } = await sb()
    .from("manual_debtors")
    .update({ amount: nextAmount })
    .eq("id", debtor.id);
  if (error) throw new Error(error.message);
}

async function syncCreditProjectDebtorPayment(
  before: ProjectMovementDebtSnapshot | null,
  after: ProjectMovementDebtSnapshot | null,
) {
  const oldIncome = activeCreditIncome(before);
  const newIncome = activeCreditIncome(after);
  if (!oldIncome && !newIncome) return;

  const debtor = await ensureCreditProjectDebtor(
    (newIncome ?? oldIncome)!.project_id,
    newIncome?.payment_date ?? oldIncome?.payment_date,
  );
  if (!debtor) return;

  const client = sb();
  if (!newIncome) {
    const { error } = await client
      .from("manual_debtor_payments")
      .update({ status: 0 })
      .eq("project_payment_id", oldIncome!.id);
    if (error) throw new Error(error.message);
    return;
  }

  if (!newIncome.payment_method_id) return;
  const payload = {
    debtor_id: debtor.id,
    payment_date: newIncome.payment_date,
    amount: round2(newIncome.amount),
    to_account_id: newIncome.payment_method_id,
    note: `Abono registrado en proyecto a crédito: ${newIncome.concept.trim() || "Ingreso"}`,
    status: 1,
  };
  const { data: existing, error: existingError } = await client
    .from("manual_debtor_payments")
    .select("id")
    .eq("project_payment_id", newIncome.id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { error } = await client
      .from("manual_debtor_payments")
      .update(payload)
      .eq("id", existing.id as string);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client.from("manual_debtor_payments").insert({
    ...payload,
    project_payment_id: newIncome.id,
    created_by: await getCurrentUserId(),
  });
  if (error) throw new Error(error.message);
}

async function syncCreditProjectDebtFromMovement({
  before,
  after,
}: {
  before?: ProjectMovementDebtSnapshot | null;
  after?: ProjectMovementDebtSnapshot | null;
}) {
  const projectId = after?.project_id ?? before?.project_id;
  if (!projectId) return;

  const principalDelta = round2(
    activeCreditExpenseAmount(after ?? null) - activeCreditExpenseAmount(before ?? null),
  );
  await adjustCreditProjectPrincipal(projectId, principalDelta, after?.payment_date ?? before?.payment_date);
  await syncCreditProjectDebtorPayment(before ?? null, after ?? null);
}

export async function registerMovement(
  data: RegisterPaymentData,
): Promise<{ id: string; receiptCode: string | null }> {
  const receiptCode = await nextProjectReceiptCode();
  const { data: row, error } = await sb()
    .from("project_payments")
    .insert({
      project_id: data.projectId,
      movement_type: data.movementType,
      concept: data.concept.trim(),
      amount: data.amount,
      payment_date: data.paymentDate,
      payment_method_id: data.paymentMethodId,
      internal_area: data.internalArea ?? null,
      receipt_code: receiptCode,
      created_by: await getCurrentUserId(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await syncCreditProjectDebtFromMovement({
    after: {
      id: row.id as string,
      project_id: data.projectId,
      movement_type: data.movementType,
      amount: data.amount,
      payment_date: data.paymentDate,
      payment_method_id: data.paymentMethodId,
      internal_area: data.internalArea ?? null,
      status: 1,
      concept: data.concept.trim(),
    },
  });
  await writeAudit({
    entityType: "project_movement",
    entityId: row.id as string,
    operation: "create",
    amount: data.amount,
    description: `${data.movementType === "income" ? "Ingreso" : "Egreso"} · ${data.concept.trim()}`,
  });
  return { id: row.id as string, receiptCode };
}

export interface ProjectMovementEditData {
  concept: string;
  amount: number;
  paymentDate: string;
  paymentMethodId: string;
  internalArea?: InternalArea | null;
}

async function projectMovementSnapshot(id: string) {
  const { data } = await sb()
    .from("project_payments")
    .select(
      "id, project_id, movement_type, concept, amount, payment_date, payment_method_id, internal_area, receipt_code, status, project:projects(name)",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Edita un movimiento de proyecto. El saldo se recalcula solo (suma de status=1). */
export async function updateProjectMovement(
  id: string,
  patch: ProjectMovementEditData,
  note: string,
): Promise<void> {
  const before = await projectMovementSnapshot(id);
  if (!before || (before.status as number) === 0) {
    throw new Error("Movimiento no encontrado.");
  }
  const update = {
    concept: patch.concept.trim(),
    amount: patch.amount,
    payment_date: patch.paymentDate,
    payment_method_id: patch.paymentMethodId,
    internal_area: patch.internalArea ?? null,
  };
  const { error } = await sb().from("project_payments").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  const after = await projectMovementSnapshot(id);
  await syncCreditProjectDebtFromMovement({
    before: toDebtSnapshot(before as Row),
    after: toDebtSnapshot(after as Row),
  });

  const projectName = (before.project as { name?: string } | null)?.name ?? "";
  await writeAudit({
    entityType: "project_movement",
    entityId: id,
    operation: "update",
    note,
    amount: patch.amount,
    description: `${before.movement_type === "income" ? "Ingreso" : "Egreso"} · ${projectName}`,
    snapshot: {
      before: {
        concept: before.concept,
        amount: Number(before.amount),
        payment_date: before.payment_date,
        payment_method_id: before.payment_method_id,
        internal_area: before.internal_area,
      },
      after: update,
    },
  });
}

/** Elimina (soft, status=0) un movimiento de proyecto. El saldo se recalcula solo. */
export async function deleteProjectMovement(id: string, note: string): Promise<void> {
  const before = await projectMovementSnapshot(id);
  if (!before || (before.status as number) === 0) {
    throw new Error("Movimiento no encontrado.");
  }
  const { error } = await sb().from("project_payments").update({ status: 0 }).eq("id", id);
  if (error) throw new Error(error.message);
  await syncCreditProjectDebtFromMovement({
    before: toDebtSnapshot(before as Row),
    after: null,
  });

  const projectName = (before.project as { name?: string } | null)?.name ?? "";
  await writeAudit({
    entityType: "project_movement",
    entityId: id,
    operation: "delete",
    note,
    amount: Number(before.amount),
    description: `${before.movement_type === "income" ? "Ingreso" : "Egreso"} · ${projectName}`,
    snapshot: {
      before: {
        concept: before.concept,
        amount: Number(before.amount),
        payment_date: before.payment_date,
        payment_method_id: before.payment_method_id,
        internal_area: before.internal_area,
        movement_type: before.movement_type,
      },
    },
  });
}

export async function getProjectPaymentReceipt(id: string): Promise<ReceiptData | null> {
  if (!isAdminConfigured()) return null;
  const { data } = await sb()
    .from("project_payments")
    .select(
      "amount, concept, payment_date, receipt_code, movement_type, internal_area, signature, project:projects(name, proposal_responsible, modeling_3d_responsible, plans_responsible, render_responsible, client:clients(name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const project = data.project as {
    name?: string;
    proposal_responsible?: string;
    modeling_3d_responsible?: string;
    plans_responsible?: string;
    render_responsible?: string;
    client?: { name?: string };
  } | null;
  const isIncome = data.movement_type === "income";
  const internalArea = (data.internal_area as InternalArea | null) ?? null;
  const responsibleByArea: Partial<Record<InternalArea, string | undefined>> = {
    proposal: project?.proposal_responsible,
    modeling_3d: project?.modeling_3d_responsible,
    plans: project?.plans_responsible,
    render: project?.render_responsible,
  };
  const expenseRecipient = internalArea
    ? responsibleByArea[internalArea] || PROJECT_SLICE_LABELS[internalArea]
    : "Responsable";
  return {
    docType: isIncome ? "abono" : "egreso",
    kind: "proyecto",
    code: (data.receipt_code as string) ?? null,
    amount: Number(data.amount),
    concept: data.concept as string,
    date: data.payment_date as string,
    clientName: isIncome ? (project?.client?.name ?? "") : expenseRecipient,
    subjectName: project?.name ?? "",
    signature: (data.signature as string) ?? null,
  };
}

/** Guarda la firma dibujada del movimiento de proyecto. */
export async function setProjectPaymentSignature(id: string, signature: string): Promise<void> {
  const { error } = await sb()
    .from("project_payments")
    .update({ signature, signed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export interface RegisterInternalTransferData {
  description: string;
  amount: number;
  transferDate: string;
  fromPaymentMethodId: string;
  toPaymentMethodId: string;
  userId: string | null;
}

export async function registerInternalTransfer(
  data: RegisterInternalTransferData,
): Promise<void> {
  if (data.fromPaymentMethodId === data.toPaymentMethodId) {
    throw new Error("Las cuentas deben ser diferentes");
  }
  const { error } = await sb().from("internal_transfers").insert({
    description: data.description.trim(),
    amount: data.amount,
    transfer_date: data.transferDate,
    from_payment_method_id: data.fromPaymentMethodId,
    to_payment_method_id: data.toPaymentMethodId,
    created_by: await getCurrentUserId(),
  });
  if (error) throw new Error(error.message);
}

export async function deleteProject(id: string): Promise<void> {
  // Soft delete (status = 0).
  const { error } = await sb().from("projects").update({ status: 0 }).eq("id", id);
  if (error) throw new Error(error.message);
  const { error: debtorError } = await sb()
    .from("manual_debtors")
    .update({ status: 0 })
    .eq("project_id", id);
  if (debtorError) throw new Error(debtorError.message);
}
