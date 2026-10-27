"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/auth/authorize";
import { listAuditPage } from "@/lib/data/audit";

const filters = z.object({
  page: z.number().int().min(1).max(100000),
  search: z.string().max(100),
  entityType: z.enum(["all", "project_movement", "work_movement", "finance_movement", "work_order", "order_payment", "salary"]),
  operation: z.enum(["all", "create", "update", "delete"]),
});

export async function getAuditPageAction(raw: unknown) {
  await requirePermission("audit.view");
  return listAuditPage(filters.parse(raw));
}
