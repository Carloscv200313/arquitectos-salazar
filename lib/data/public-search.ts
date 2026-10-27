import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { round2 } from "@/lib/calculations";

type Hit = { id: string; name: string; address: string | null; total_amount?: number; created_at: string; client: { name: string } };

/** Separate bounded queries preserve name/client/address search without unbounded client ID lists. */
export async function searchPublicEntities(table: "works" | "projects", query: string) {
  if (typeof query !== "string" || query.trim().length < 2 || query.length > 100) return [];
  // Escape LIKE wildcards; use individual filter parameters rather than interpolated .or syntax.
  const pattern = `%${query.trim().replace(/[\\%_]/g, "\\$&")}%`;
  const client = createAdminClient("public-search");
  if (process.env.USE_SEARCH_RPC === "1") {
    const { data, error } = await client.rpc("search_payables_secure", { p_query: query.trim(), p_kind: table });
    if (error) throw new Error("No se pudo realizar la búsqueda.");
    return ((data ?? []) as Array<{ id: string; name: string; client_name: string; address: string | null; pending: number | null }>).map(row => ({ id: row.id, name: row.name, clientName: row.client_name, address: row.address, pending: row.pending == null ? null : Number(row.pending) }));
  }
  const select = `id,name,address,created_at,${table === "projects" ? "total_amount," : ""}client:clients!inner(name)`;
  const results = await Promise.all(["name", "address", "client.name"].map(column =>
    client.from(table).select(select).eq("status", 1).ilike(column, pattern)
      .order("created_at", { ascending: false }).order("id").limit(20),
  ));
  if (results.some(result => result.error)) throw new Error("No se pudo realizar la búsqueda.");
  const unique = new Map<string, Hit>();
  for (const result of results) for (const row of (result.data ?? []) as unknown as Hit[]) unique.set(row.id, row);
  const hits = [...unique.values()].sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)).slice(0, 20);
  const income = new Map<string, number>();
  if (table === "projects" && hits.length) {
    const { data, error } = await client.from("project_payments").select("project_id,amount")
      .eq("status", 1).eq("movement_type", "income").in("project_id", hits.map(hit => hit.id));
    if (error) throw new Error("No se pudo consultar el saldo.");
    for (const row of data ?? []) income.set(row.project_id, (income.get(row.project_id) ?? 0) + Number(row.amount));
  }
  return hits.map(hit => ({ id: hit.id, name: hit.name, clientName: hit.client.name, address: hit.address,
    pending: table === "projects" ? round2(Math.max(Number(hit.total_amount) - round2(income.get(hit.id) ?? 0), 0)) : null,
  }));
}
