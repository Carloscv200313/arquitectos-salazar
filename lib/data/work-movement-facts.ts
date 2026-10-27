import "server-only";
import { cache } from "react";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import type { WorkMovementType } from "@/lib/types";

export interface WorkMovementFact {
  id: string;
  work_id: string;
  payment_method_id: string | null;
  movement_type: WorkMovementType;
  category: string | null;
  amount: number;
  movement_date: string;
}

/** Reused by utility and account calculations within one server render only. */
export const listActiveWorkMovementFacts = cache(async (): Promise<WorkMovementFact[]> => {
  if (!isAdminConfigured()) return [];
  const rows: WorkMovementFact[] = [];
  const client = createAdminClient("movement-facts");
  for (let offset = 0; ; ) {
    const { data, error } = await client.from("work_movements")
      .select("id,work_id,payment_method_id,movement_type,category,amount,movement_date")
      .eq("status", 1)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw new Error("No se pudieron consultar los movimientos financieros.");
    const page = (data ?? []) as WorkMovementFact[];
    rows.push(...page);
    if (page.length === 0) break;
    offset += page.length;
  }
  return rows;
});
