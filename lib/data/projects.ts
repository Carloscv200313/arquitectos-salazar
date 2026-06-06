// Public data-access API for the Projects module.
//
// Server-only. Components and server actions import from here; they never touch
// the store directly. To migrate to Supabase, reimplement these functions
// against the client — the signatures and return shapes stay the same.

import "server-only";

import {
  computeBreakdown,
  computeFinance,
  round2,
  weightsFromAmounts,
  type Addon,
} from "@/lib/calculations";
import { MARKUP, resolveTemplateWeights, type SliceWeights } from "@/lib/constants";
import type {
  Client,
  InternalArea,
  InternalTransferWithMethods,
  PaymentMethod,
  PaymentMethodReportRow,
  PaymentWithMethod,
  ProjectAddon,
  ProjectPayment,
  ProjectTemplate,
  ProjectWithFinance,
  PaymentStatus,
  UtilityReportRow,
} from "@/lib/types";
import { db, nowISO, uuid } from "./store";

export interface ProjectFilters {
  search?: string; // project name
  client?: string; // client name
  status?: PaymentStatus | "all";
  dateFrom?: string; // yyyy-mm-dd (created_at)
  dateTo?: string; // yyyy-mm-dd (created_at)
}

function paymentsOf(projectId: string): ProjectPayment[] {
  return db.payments.filter((p) => p.project_id === projectId);
}

function addonsOf(projectId: string): ProjectAddon[] {
  return db.addons.filter((a) => a.project_id === projectId);
}

function enrich(projectId: string): ProjectWithFinance | null {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const client = db.clients.find((c) => c.id === project.client_id);
  if (!client) return null;
  const payments = paymentsOf(project.id);
  return {
    ...project,
    client,
    finance: computeFinance(project.total_amount, payments),
    payments_count: payments.length,
    addons: addonsOf(project.id),
  };
}

export async function listClients(): Promise<Client[]> {
  return [...db.clients].sort((a, b) => a.name.localeCompare(b.name));
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  return db.methods.filter((m) => m.is_active);
}

export async function listProjects(
  filters: ProjectFilters = {},
): Promise<ProjectWithFinance[]> {
  const search = filters.search?.trim().toLowerCase();
  const client = filters.client?.trim().toLowerCase();
  const from = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
  const to = filters.dateTo ? new Date(filters.dateTo + "T23:59:59").getTime() : null;

  const rows = db.projects
    .map((p) => enrich(p.id))
    .filter((p): p is ProjectWithFinance => p !== null)
    .filter((p) => {
      if (search && !p.name.toLowerCase().includes(search)) return false;
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
  return enrich(id);
}

export async function listMovements(projectId: string): Promise<PaymentWithMethod[]> {
  return paymentsOf(projectId)
    .map((p) => ({
      ...p,
      method: db.methods.find((m) => m.id === p.payment_method_id) ?? null,
    }))
    .sort(
      (a, b) =>
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
    );
}

export async function listInternalTransfers(): Promise<InternalTransferWithMethods[]> {
  return db.internalTransfers
    .map((t) => ({
      ...t,
      fromMethod: db.methods.find((m) => m.id === t.from_payment_method_id) ?? null,
      toMethod: db.methods.find((m) => m.id === t.to_payment_method_id) ?? null,
    }))
    .sort(
      (a, b) =>
        new Date(b.transfer_date).getTime() - new Date(a.transfer_date).getTime(),
    );
}

export async function getPaymentMethodReport(): Promise<PaymentMethodReportRow[]> {
  const rows = new Map<string, PaymentMethodReportRow>();
  for (const method of db.methods.filter((m) => m.is_active)) {
    rows.set(method.id, {
      methodId: method.id,
      methodName: method.name,
      clientMovements: 0,
      internalMovements: 0,
      finalBalance: 0,
    });
  }

  for (const movement of db.payments) {
    const row = rows.get(movement.payment_method_id);
    if (!row) continue;
    const sign = movement.movement_type === "income" ? 1 : -1;
    row.clientMovements = round2(row.clientMovements + movement.amount * sign);
  }

  for (const transfer of db.internalTransfers) {
    const from = rows.get(transfer.from_payment_method_id);
    const to = rows.get(transfer.to_payment_method_id);
    if (from) from.internalMovements = round2(from.internalMovements - transfer.amount);
    if (to) to.internalMovements = round2(to.internalMovements + transfer.amount);
  }

  return [...rows.values()].map((row) => ({
    ...row,
    finalBalance: round2(row.clientMovements + row.internalMovements),
  }));
}

export async function getUtilityReport(): Promise<UtilityReportRow[]> {
  const byMonth = new Map<string, number>();
  for (const movement of db.payments) {
    if (movement.movement_type !== "income") continue;
    const month = movement.payment_date.slice(0, 7);
    byMonth.set(month, round2((byMonth.get(month) ?? 0) + movement.amount * MARKUP.utility));
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, utilityAmount]) => ({ month, utilityAmount: round2(utilityAmount) }));
}

async function findOrCreateClient(
  clientId: string | undefined,
  clientName: string | undefined,
  userId: string | null,
): Promise<Client> {
  if (clientId) {
    const existing = db.clients.find((c) => c.id === clientId);
    if (existing) return existing;
  }
  const trimmed = (clientName ?? "").trim();
  // Reuse a client with the same name (case-insensitive) to avoid duplicates.
  const dup = db.clients.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (dup) return dup;
  const client: Client = {
    id: uuid(),
    name: trimmed,
    created_at: nowISO(),
    updated_at: nowISO(),
    created_by: userId,
  };
  db.clients.push(client);
  return client;
}

export interface CreateProjectData {
  name: string;
  clientId?: string;
  clientName?: string;
  template: ProjectTemplate;
  weights?: SliceWeights;
  projectAmount: number;
  addons: Addon[];
  anticipo?: {
    amount: number;
    concept: string;
    methodId: string;
    date: string;
  };
  userId: string | null;
}

export async function createProject(data: CreateProjectData): Promise<string> {
  const client = await findOrCreateClient(data.clientId, data.clientName, data.userId);
  const weights = resolveTemplateWeights(data.template, data.weights);
  const b = computeBreakdown(data.projectAmount, data.addons, weights);
  const ts = nowISO();
  const id = uuid();
  db.projects.push({
    id,
    client_id: client.id,
    name: data.name.trim(),
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
    created_at: ts,
    updated_at: ts,
    created_by: data.userId,
  });

  for (const a of data.addons) {
    db.addons.push({
      id: uuid(),
      project_id: id,
      concept: a.concept.trim(),
      amount: a.amount,
      created_at: ts,
    });
  }

  if (data.anticipo) {
    db.payments.push({
      id: uuid(),
      project_id: id,
      movement_type: "income",
      concept: data.anticipo.concept.trim(),
      amount: data.anticipo.amount,
      payment_date: data.anticipo.date,
      payment_method_id: data.anticipo.methodId,
      internal_area: null,
      created_at: ts,
      created_by: data.userId,
    });
  }

  return id;
}

export interface UpdateProjectData {
  id: string;
  name: string;
  clientId?: string;
  clientName?: string;
  projectAmount: number;
  addons: Addon[];
  userId: string | null;
}

export async function updateProject(data: UpdateProjectData): Promise<void> {
  const project = db.projects.find((p) => p.id === data.id);
  if (!project) throw new Error("Proyecto no encontrado");
  const client = await findOrCreateClient(data.clientId, data.clientName, data.userId);
  // Preserve the project's distribution: recover weights from current amounts.
  const weights = weightsFromAmounts({
    proposal: project.proposal_amount,
    modeling_3d: project.modeling_3d_amount,
    plans: project.plans_amount,
    render: project.render_amount,
  });
  const b = computeBreakdown(data.projectAmount, data.addons, weights);
  project.name = data.name.trim();
  project.client_id = client.id;
  project.project_amount = b.base;
  project.office_amount = b.markup.office;
  project.utility_amount = b.markup.utility;
  project.addons_total = b.addonsTotal;
  project.total_amount = b.total;
  project.proposal_amount = b.project.proposal;
  project.modeling_3d_amount = b.project.modeling_3d;
  project.plans_amount = b.project.plans;
  project.render_amount = b.project.render;
  project.updated_at = nowISO();

  // Replace addon line items.
  for (let i = db.addons.length - 1; i >= 0; i--) {
    if (db.addons[i].project_id === project.id) db.addons.splice(i, 1);
  }
  const ts = nowISO();
  for (const a of data.addons) {
    db.addons.push({
      id: uuid(),
      project_id: project.id,
      concept: a.concept.trim(),
      amount: a.amount,
      created_at: ts,
    });
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

export async function registerMovement(data: RegisterPaymentData): Promise<void> {
  const project = db.projects.find((p) => p.id === data.projectId);
  if (!project) throw new Error("Proyecto no encontrado");
  db.payments.push({
    id: uuid(),
    project_id: data.projectId,
    movement_type: data.movementType,
    concept: data.concept.trim(),
    amount: data.amount,
    payment_date: data.paymentDate,
    payment_method_id: data.paymentMethodId,
    internal_area: data.internalArea ?? null,
    created_at: nowISO(),
    created_by: data.userId,
  });
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
  const from = db.methods.find((m) => m.id === data.fromPaymentMethodId && m.is_active);
  const to = db.methods.find((m) => m.id === data.toPaymentMethodId && m.is_active);
  if (!from || !to) throw new Error("Forma de pago inválida");
  if (from.id === to.id) throw new Error("Las cuentas deben ser diferentes");

  db.internalTransfers.push({
    id: uuid(),
    description: data.description.trim(),
    amount: data.amount,
    transfer_date: data.transferDate,
    from_payment_method_id: data.fromPaymentMethodId,
    to_payment_method_id: data.toPaymentMethodId,
    created_at: nowISO(),
    created_by: data.userId,
  });
}

export async function deleteProject(id: string): Promise<void> {
  const idx = db.projects.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Proyecto no encontrado");
  db.projects.splice(idx, 1);
  // Cascade: remove its payments + addons.
  for (let i = db.payments.length - 1; i >= 0; i--) {
    if (db.payments[i].project_id === id) db.payments.splice(i, 1);
  }
  for (let i = db.addons.length - 1; i >= 0; i--) {
    if (db.addons[i].project_id === id) db.addons.splice(i, 1);
  }
}
