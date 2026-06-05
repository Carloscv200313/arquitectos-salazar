// Public data-access API for the Projects module.
//
// Server-only. Components and server actions import from here; they never touch
// the store directly. To migrate to Supabase, reimplement these functions
// against the client — the signatures and return shapes stay the same.

import "server-only";

import { computeBreakdown, computeFinance, type Addon } from "@/lib/calculations";
import type {
  Client,
  InternalArea,
  PaymentMethod,
  PaymentWithMethod,
  ProjectAddon,
  ProjectPayment,
  ProjectWithFinance,
  PaymentStatus,
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
  const b = computeBreakdown(data.projectAmount, data.addons);
  const ts = nowISO();
  const id = uuid();
  db.projects.push({
    id,
    client_id: client.id,
    name: data.name.trim(),
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
  const b = computeBreakdown(data.projectAmount, data.addons);
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
