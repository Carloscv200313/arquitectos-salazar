import "server-only";

import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/features/auth/get-user";
import type { AuditLogRow, AuditOperation, AuditEntityType } from "@/lib/types";

type Row = Record<string, unknown>;

function sb() {
  return createAdminClient("audit");
}

const ENTITY_LABELS: Record<AuditEntityType, string> = {
  project_movement: "Movimiento de proyecto",
  work_movement: "Movimiento de obra",
  finance_movement: "Movimiento financiero",
  work_order: "Pedido de obra",
  order_payment: "Pago de pedido",
  salary: "Salario",
};

const OPERATION_LABELS: Record<AuditOperation, string> = {
  create: "Creó",
  update: "Editó",
  delete: "Eliminó",
};

export interface WriteAuditInput {
  entityType: AuditEntityType;
  entityId: string;
  operation: AuditOperation;
  /** Observación obligatoria que el usuario escribe al editar/eliminar. */
  note?: string | null;
  /** { before, after } para ver el cambio exacto. */
  snapshot?: { before?: unknown; after?: unknown } | null;
  amount?: number | null;
  /** Descripción legible corta (ej. "Abono CASA LOPEZ"). */
  description?: string | null;
}

/**
 * Escribe una entrada en el log central de auditoría. Nunca tira: si el log
 * falla no debe abortar la operación de negocio (best-effort).
 */
export async function writeAudit(input: WriteAuditInput): Promise<void> {
  if (!isAdminConfigured()) return;
  try {
    const user = await getCurrentAppUser();
    await sb()
      .from("audit_logs")
      .insert({
        user_id: user?.id ?? null,
        user_name: user?.fullName ?? "Sistema",
        action: `${input.entityType}.${input.operation}`,
        operation: input.operation,
        entity_type: input.entityType,
        entity_id: input.entityId,
        table_name: input.entityType,
        record_id: input.entityId,
        description: input.description ?? null,
        note: input.note?.trim() || null,
        amount: input.amount ?? null,
        snapshot: input.snapshot ?? null,
      });
  } catch {
    // Database errors can contain query details; never emit them into application logs.
    console.error("[audit] no se pudo registrar el log");
  }
}

export interface AuditFilters {
  entityType?: AuditEntityType | "all";
  operation?: AuditOperation | "all";
  search?: string;
  limit?: number;
}

function mapLog(r: Row): AuditLogRow {
  const entityType = (r.entity_type as AuditEntityType) ?? "project_movement";
  const operation = (r.operation as AuditOperation) ?? "update";
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    userName: (r.user_name as string) ?? "Sistema",
    entityType,
    entityLabel: ENTITY_LABELS[entityType] ?? entityType,
    entityId: (r.entity_id as string) ?? (r.record_id as string) ?? "",
    operation,
    operationLabel: OPERATION_LABELS[operation] ?? operation,
    description: (r.description as string) ?? null,
    note: (r.note as string) ?? null,
    amount: r.amount != null ? Number(r.amount) : null,
    snapshot: (r.snapshot as { before?: unknown; after?: unknown } | null) ?? null,
  };
}

export async function listAuditLogs(filters: AuditFilters = {}): Promise<AuditLogRow[]> {
  if (!isAdminConfigured()) return [];
  let query = sb()
    .from("audit_logs")
    .select("id,created_at,user_name,entity_type,entity_id,record_id,operation,description,note,amount,snapshot")
    .not("entity_type", "is", null)
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 300);

  if (filters.entityType && filters.entityType !== "all") {
    query = query.eq("entity_type", filters.entityType);
  }
  if (filters.operation && filters.operation !== "all") {
    query = query.eq("operation", filters.operation);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data ?? []).map(mapLog);
  const term = filters.search?.trim().toLowerCase();
  if (term) {
    rows = rows.filter(
      (r) =>
        r.userName.toLowerCase().includes(term) ||
        (r.description ?? "").toLowerCase().includes(term) ||
        (r.note ?? "").toLowerCase().includes(term),
    );
  }
  return rows;
}

export async function listAuditPage(filters: AuditFilters & { page?: number } = {}) {
  const page = Math.max(1, Math.min(100000, Math.floor(filters.page ?? 1)));
  const pageSize = 50;
  let query = sb().from("audit_logs")
    .select("id,created_at,user_name,entity_type,entity_id,record_id,operation,description,note,amount,snapshot", { count: "exact" })
    .not("entity_type", "is", null)
    .not("user_name", "ilike", "administrador").not("user_name", "ilike", "sistema")
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (filters.entityType && filters.entityType !== "all") query = query.eq("entity_type", filters.entityType);
  if (filters.operation && filters.operation !== "all") query = query.eq("operation", filters.operation);
  const term = filters.search?.trim().slice(0, 100);
  if (term) {
    const pattern = `"%${term.replace(/[\\%_]/g, "\\$&").replace(/"/g, '\\"')}%"`;
    query = query.or(`user_name.ilike.${pattern},description.ilike.${pattern},note.ilike.${pattern}`);
  }
  const { data, error, count } = await query;
  if (error) throw new Error("No se pudo consultar la auditoría.");
  return { rows: (data ?? []).map(mapLog), total: count ?? 0, page, pageSize };
}
