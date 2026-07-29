import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

interface OrderNotificationRow {
  id: string;
  work_id: string;
  supplier: string;
  material: string;
  created_at: string;
}

interface WorkRow {
  id: string;
  name: string;
  client?: { name?: string } | null;
}

function mapOrder(row: OrderNotificationRow, works: Map<string, WorkRow>) {
  const work = works.get(row.work_id);
  return {
    id: row.id,
    workId: row.work_id,
    workName: work?.name ?? "Obra",
    clientName: work?.client?.name ?? "Cliente",
    supplier: row.supplier,
    material: row.material,
    createdAt: row.created_at,
  };
}

async function queryPublicOrders(since: string | null, includeSource: boolean) {
  const client = createAdminClient();
  let query = client
    .from("work_orders")
    .select("id, work_id, supplier, material, created_at")
    .eq("status", 1)
    .order("created_at", { ascending: Boolean(since) })
    .limit(since ? 10 : 5);

  query = includeSource
    ? query.or("source.eq.public,created_by.is.null")
    : query.is("created_by", null);

  if (since) query = query.gt("created_at", since);
  return query;
}

export async function GET(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ orders: [] });
  }

  const since = request.nextUrl.searchParams.get("since");
  const first = await queryPublicOrders(since, true);
  const result = first.error ? await queryPublicOrders(since, false) : first;

  if (result.error) {
    return NextResponse.json({ orders: [], error: result.error.message }, { status: 500 });
  }

  const rows = (result.data ?? []) as OrderNotificationRow[];
  const workIds = Array.from(new Set(rows.map((row) => row.work_id)));
  const works = new Map<string, WorkRow>();
  if (workIds.length) {
    const { data: workRows } = await createAdminClient()
      .from("works")
      .select("id, name, client:clients(name)")
      .in("id", workIds);
    for (const row of (workRows ?? []) as WorkRow[]) {
      works.set(row.id, row);
    }
  }

  return NextResponse.json({
    orders: rows.map((row) => mapOrder(row, works)),
  });
}
