import "server-only";
import { cache } from "react";
import { noteQueryAttempt, noteQueryResult } from "./telemetry";

// React scopes this map to one server render. It is NOT a process/global cache.
const requestReads = cache(() => new Map<string, Promise<Response>>());

export class DatabaseRequestError extends Error {
  constructor(public readonly status: number) {
    super(status === 402 ? "Servicio de datos temporalmente restringido." : "No se pudo completar la operación de datos.");
    this.name = "DatabaseRequestError";
  }
}

/** Logs only a fixed module label, table/function name and transport metrics. */
export function databaseFetch(module: string, transport: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const { fingerprint, traceId } = noteQueryAttempt(method, url, headers.get("accept"), headers.get("range"));
    const reads = requestReads();
    // Include every request header, especially Authorization and Prefer. Module
    // labels are diagnostic only; identical reads from two modules may share work.
    const key = `${url.href}:${JSON.stringify([...headers.entries()].sort(([a], [b]) => a.localeCompare(b)))}`;
    const read = method === "GET" && url.pathname.startsWith("/rest/v1/") && !url.pathname.includes("/rpc/");
    if (!read) reads.clear(); // Never reuse a pre-write result after a mutation.
    if (read && reads.has(key)) return (await reads.get(key)!).clone();

    async function run() {
      const started = performance.now();
      let requests = 0;
      let bytes = 0;
      let status = 0;
      const resource = url.pathname.replace(/^\/rest\/v1\//, "").split("/").filter(Boolean).slice(0, 2).join("/");
      async function send(target: URL) {
        requests++;
        const request = input instanceof Request ? new Request(target, input) : target;
        const response = await transport(request, { ...init, headers, cache: "no-store" });
        status = response.status;
        const body = await response.text();
        bytes += new TextEncoder().encode(body).byteLength;
        // Preserve PostgREST errors for Supabase's normal error parser. In
        // particular, writes must retain the SQLSTATE/constraint information;
        // replacing every 4xx with a generic exception hides the actual cause.
        // A restricted project still gets the dedicated 402 handling.
        if (response.status === 402) throw new DatabaseRequestError(402);
        return { response, body };
      }
      try {
        const paginate = read && !url.searchParams.has("limit") && !url.searchParams.has("offset") &&
          !headers.has("range") && !headers.get("accept")?.includes("object+json");
        if (!paginate) {
          const { response, body } = await send(url);
          const responseHeaders = new Headers(response.headers);
          responseHeaders.delete("content-length");
          responseHeaders.delete("content-encoding");
          return new Response(body || null, { status: response.status, headers: responseHeaders });
        }
        const rows: unknown[] = [];
        let responseHeaders = new Headers();
        // Unbounded business reports must read every row, never silently stop at the API cap.
        // UI/search queries set an explicit limit and bypass this traversal.
        for (let offset = 0; ; ) {
          if (requests >= 10000) throw new DatabaseRequestError(413);
          const pageUrl = new URL(url);
          pageUrl.searchParams.set("limit", "500");
          pageUrl.searchParams.set("offset", String(offset));
          const order = pageUrl.searchParams.get("order");
          if (!order?.split(",").some((value) => /^id\./.test(value))) {
            pageUrl.searchParams.set("order", order ? `${order},id.asc` : "id.asc");
          }
          const { response, body } = await send(pageUrl);
          // A later failed page must never look like a successful partial report.
          if (!response.ok) throw new DatabaseRequestError(response.status);
          const page: unknown = JSON.parse(body);
          if (!Array.isArray(page)) throw new DatabaseRequestError(502);
          responseHeaders = new Headers(response.headers);
          rows.push(...page);
          if (page.length === 0) break;
          offset += page.length;
          const total = response.headers.get("content-range")?.split("/")[1];
          if (total && total !== "*" && offset >= Number(total)) break;
          if (page.length < 500 && (!total || total === "*")) {
            // A smaller server row cap can also cause a short page. Probe once more
            // at the actual offset, rather than silently truncating financial data.
            continue;
          }
        }
        responseHeaders.delete("content-length");
        responseHeaders.delete("content-encoding");
        responseHeaders.set("content-range", `0-${Math.max(0, rows.length - 1)}/${rows.length}`);
        return new Response(JSON.stringify(rows), { status: 200, headers: responseHeaders });
      } finally {
        const elapsed = performance.now() - started;
        noteQueryResult(resource, requests, bytes, status, elapsed);
        if (process.env.DATA_TELEMETRY === "1" || status >= 400) {
          console.info(JSON.stringify({ event: "database_request", module, resource: /^\w+(\/\w+)?$/.test(resource) ? resource : "storage", method, status, requests, responseBytes: bytes, durationMs: Math.round(elapsed), ...(fingerprint ? { queryHash: fingerprint } : {}), ...(traceId ? { traceId } : {}) }));
        }
      }
    }
    const pending = run();
    if (read && reads.size < 200) reads.set(key, pending);
    try { return (await pending).clone(); }
    catch (error) { reads.delete(key); throw error; }
  };
}
