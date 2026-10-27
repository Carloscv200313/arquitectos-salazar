import { requirePermission, AccessDeniedError } from "@/lib/auth/authorize";
import { limitPublicRequest, RateLimitError } from "@/lib/security/rate-limit";
import { DatabaseRequestError } from "@/lib/supabase/transport";
import { traceScreen } from "@/lib/supabase/telemetry";
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
  const client = createAdminClient("notifications");
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
  const started = performance.now();
  try {
    const user = await requirePermission("orders.view");
    await limitPublicRequest("notifications", 30);
    return await traceScreen("order-notifications", user.id, () => getNotifications(request));
  } catch (error) {
    const status = error instanceof AccessDeniedError ? error.status : error instanceof RateLimitError ? 429 : error instanceof DatabaseRequestError && error.status === 402 ? 402 : 503;
    return NextResponse.json({ orders: [], error: "Notificaciones no disponibles." }, { status, headers: { "Cache-Control": "private, no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) } });
  } finally {
    if (process.env.DATA_TELEMETRY === "1") console.info(JSON.stringify({ event: "endpoint", endpoint: "order-notifications", durationMs: Math.round(performance.now() - started) }));
  }
}

async function getNotifications(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ orders: [] });
  }

  const since = request.nextUrl.searchParams.get("since");
  if (since && (since.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(since) || !Number.isFinite(Date.parse(since)))) return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
  const first = await queryPublicOrders(since, true);
  const result = first.error && ["42703", "PGRST204"].includes(first.error.code) ? await queryPublicOrders(since, false) : first;

  if (result.error) {
    return NextResponse.json({ orders: [], error: "No se pudieron consultar las notificaciones." }, { status: 500 });
  }

  const rows = (result.data ?? []) as OrderNotificationRow[];
  const workIds = Array.from(new Set(rows.map((row) => row.work_id)));
  const works = new Map<string, WorkRow>();
  if (workIds.length) {
    const { data: workRows, error: workError } = await createAdminClient("notifications")
      .from("works")
      .select("id, name, client:clients(name)")
      .in("id", workIds);
    if (workError) throw new Error("No se pudieron consultar las obras de las notificaciones.");
    for (const row of (workRows ?? []) as WorkRow[]) {
      works.set(row.id, row);
    }
  }

  return NextResponse.json({
    orders: rows.map((row) => mapOrder(row, works)),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
