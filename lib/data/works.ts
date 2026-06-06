import "server-only";

import { WORK_CATEGORIES } from "@/lib/constants";
import { round2 } from "@/lib/calculations";
import type {
  Client,
  WorkCategorySummary,
  WorkAdministrationUtilityRow,
  WorkMovement,
  WorkMovementType,
  WorkMovementWithBalance,
  WorkStatus,
  WorkWithFinance,
} from "@/lib/types";
import { db, nowISO, uuid } from "./store";

export interface WorkFilters {
  search?: string;
  client?: string;
  status?: WorkStatus | "all";
}

function movementsOf(workId: string): WorkMovement[] {
  return db.workMovements.filter((movement) => movement.work_id === workId);
}

function computeWorkFinance(movements: WorkMovement[]) {
  const income = round2(
    movements
      .filter((movement) => movement.movement_type === "income")
      .reduce((sum, movement) => sum + movement.amount, 0),
  );
  const expense = round2(
    movements
      .filter((movement) => movement.movement_type === "expense")
      .reduce((sum, movement) => sum + movement.amount, 0),
  );
  const lastMovementDate = movements
    .map((movement) => movement.movement_date)
    .sort((a, b) => b.localeCompare(a))[0] ?? null;

  return {
    income,
    expense,
    balance: round2(income - expense),
    movementsCount: movements.length,
    lastMovementDate,
  };
}

function enrich(workId: string): WorkWithFinance | null {
  const work = db.works.find((item) => item.id === workId);
  if (!work) return null;
  const client = db.clients.find((item) => item.id === work.client_id);
  if (!client) return null;
  return {
    ...work,
    client,
    finance: computeWorkFinance(movementsOf(work.id)),
  };
}

async function findOrCreateClient(
  clientId: string | undefined,
  clientName: string | undefined,
  userId: string | null,
): Promise<Client> {
  if (clientId) {
    const existing = db.clients.find((client) => client.id === clientId);
    if (existing) return existing;
  }

  const trimmed = (clientName ?? "").trim();
  const duplicate = db.clients.find(
    (client) => client.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (duplicate) return duplicate;

  const ts = nowISO();
  const client: Client = {
    id: uuid(),
    name: trimmed,
    created_at: ts,
    updated_at: ts,
    created_by: userId,
  };
  db.clients.push(client);
  return client;
}

export async function listWorks(
  filters: WorkFilters = {},
): Promise<WorkWithFinance[]> {
  const search = filters.search?.trim().toLowerCase();
  const client = filters.client?.trim().toLowerCase();

  return db.works
    .map((work) => enrich(work.id))
    .filter((work): work is WorkWithFinance => work !== null)
    .filter((work) => {
      if (search && !work.name.toLowerCase().includes(search)) return false;
      if (client && !work.client.name.toLowerCase().includes(client)) return false;
      if (filters.status && filters.status !== "all" && work.status !== filters.status)
        return false;
      return true;
    })
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}

export async function getWork(id: string): Promise<WorkWithFinance | null> {
  return enrich(id);
}

export async function listWorkMovements(
  workId: string,
): Promise<WorkMovementWithBalance[]> {
  let balance = 0;
  return movementsOf(workId)
    .sort((a, b) => {
      const byDate = a.movement_date.localeCompare(b.movement_date);
      if (byDate !== 0) return byDate;
      return a.created_at.localeCompare(b.created_at);
    })
    .map((movement) => {
      balance = round2(
        balance + (movement.movement_type === "income" ? movement.amount : -movement.amount),
      );
      return {
        ...movement,
        balance,
        method: db.methods.find((method) => method.id === movement.payment_method_id) ?? null,
      };
    })
    .sort((a, b) => {
      const byDate = a.movement_date.localeCompare(b.movement_date);
      if (byDate !== 0) return byDate;
      return a.created_at.localeCompare(b.created_at);
    });
}

export async function getWorkCategorySummary(
  workId: string,
): Promise<WorkCategorySummary[]> {
  const rows = new Map<string, WorkCategorySummary>();
  for (const category of WORK_CATEGORIES) {
    rows.set(category, { category, income: 0, expense: 0, balance: 0 });
  }

  for (const movement of movementsOf(workId)) {
    const row =
      rows.get(movement.category) ??
      { category: movement.category, income: 0, expense: 0, balance: 0 };
    if (movement.movement_type === "income") {
      row.income = round2(row.income + movement.amount);
    } else {
      row.expense = round2(row.expense + movement.amount);
    }
    rows.set(movement.category, row);
  }

  return [...rows.values()]
    .map((row) => ({ ...row, balance: round2(row.income - row.expense) }))
    .filter((row) => row.income > 0 || row.expense > 0)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
}

export async function getWorkAdministrationUtilities(
  workId: string,
): Promise<WorkAdministrationUtilityRow[]> {
  const byMonth = new Map<string, number>();
  for (const movement of movementsOf(workId)) {
    if (movement.category !== "Honorarios") continue;
    const month = movement.movement_date.slice(0, 7);
    byMonth.set(month, round2((byMonth.get(month) ?? 0) + movement.amount));
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount: round2(amount) }));
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
  const client = await findOrCreateClient(data.clientId, data.clientName, data.userId);
  const ts = nowISO();
  const id = uuid();
  db.works.push({
    id,
    client_id: client.id,
    name: data.name.trim(),
    status: data.status,
    description: data.description?.trim() || null,
    created_at: ts,
    updated_at: ts,
    created_by: data.userId,
  });
  return id;
}

export interface UpdateWorkData extends CreateWorkData {
  id: string;
}

export async function updateWork(data: UpdateWorkData): Promise<void> {
  const work = db.works.find((item) => item.id === data.id);
  if (!work) throw new Error("Obra no encontrada");
  const client = await findOrCreateClient(data.clientId, data.clientName, data.userId);
  work.name = data.name.trim();
  work.client_id = client.id;
  work.status = data.status;
  work.description = data.description?.trim() || null;
  work.updated_at = nowISO();
}

export interface RegisterWorkMovementData {
  workId: string;
  receipt: string;
  movementDate: string;
  concept: string;
  supplier: string;
  category: string;
  movementType: WorkMovementType;
  amount: number;
  paymentMethodId: string;
  observations?: string;
  userId: string | null;
}

export async function registerWorkMovement(
  data: RegisterWorkMovementData,
): Promise<void> {
  const work = db.works.find((item) => item.id === data.workId);
  if (!work) throw new Error("Obra no encontrada");
  const method = db.methods.find(
    (item) => item.id === data.paymentMethodId && item.is_active,
  );
  if (!method) throw new Error("Forma de pago inválida");
  db.workMovements.push({
    id: uuid(),
    work_id: data.workId,
    receipt: data.receipt.trim(),
    movement_date: data.movementDate,
    concept: data.concept.trim(),
    supplier: data.supplier.trim(),
    category: data.category,
    movement_type: data.movementType,
    amount: data.amount,
    payment_method_id: data.paymentMethodId,
    observations: data.observations?.trim() || null,
    created_at: nowISO(),
    created_by: data.userId,
  });
}

export async function deleteWork(id: string): Promise<void> {
  const index = db.works.findIndex((work) => work.id === id);
  if (index === -1) throw new Error("Obra no encontrada");
  db.works.splice(index, 1);
  for (let i = db.workMovements.length - 1; i >= 0; i--) {
    if (db.workMovements[i].work_id === id) db.workMovements.splice(i, 1);
  }
}
