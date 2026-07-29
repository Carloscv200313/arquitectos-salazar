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
} from "@/lib/calculations";
import { MARKUP, resolveTemplateWeights, type SliceWeights } from "@/lib/constants";
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
  const b = computeBreakdown(data.projectAmount, data.addons, weights);

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
      proposal_amount: b.project.proposal,
      modeling_3d_amount: b.project.modeling_3d,
      plans_amount: b.project.plans,
      render_amount: b.project.render,
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

  if (data.anticipo) {
    await client.from("project_payments").insert({
      project_id: projectId,
      movement_type: "income",
      concept: data.anticipo.concept.trim(),
      amount: data.anticipo.amount,
      payment_date: data.anticipo.date,
      payment_method_id: data.anticipo.methodId,
      internal_area: null,
      receipt_code: await nextProjectReceiptCode(),
      created_by: userId,
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
  projectAmount: number;
  addons: Addon[];
  userId: string | null;
}

export async function updateProject(data: UpdateProjectData): Promise<void> {
  const client = sb();
  const { data: existing } = await client
    .from("projects")
    .select("proposal_amount, modeling_3d_amount, plans_amount, render_amount")
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
  const b = computeBreakdown(data.projectAmount, data.addons, weights);

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
      proposal_amount: b.project.proposal,
      modeling_3d_amount: b.project.modeling_3d,
      plans_amount: b.project.plans,
      render_amount: b.project.render,
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
      "amount, concept, payment_date, receipt_code, movement_type, signature, project:projects(name, client:clients(name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data || data.movement_type !== "income") return null;
  const project = data.project as { name?: string; client?: { name?: string } } | null;
  return {
    docType: "abono",
    kind: "proyecto",
    code: (data.receipt_code as string) ?? null,
    amount: Number(data.amount),
    concept: data.concept as string,
    date: data.payment_date as string,
    clientName: project?.client?.name ?? "",
    subjectName: project?.name ?? "",
    signature: (data.signature as string) ?? null,
  };
}

/** Guarda la firma dibujada del recibo de abono de proyecto. */
export async function setProjectPaymentSignature(id: string, signature: string): Promise<void> {
  const { error } = await sb()
    .from("project_payments")
    .update({ signature, signed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("movement_type", "income");
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
}
