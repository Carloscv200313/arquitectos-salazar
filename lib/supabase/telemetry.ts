import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomBytes, randomUUID } from "node:crypto";

type ResourceMetrics = { requests: number; bytes: number; errors: number; durationMs: number };
type ScreenMetrics = {
  screen: string;
  traceId: string;
  userBucket?: string;
  started: number;
  logicalQueries: number;
  duplicateQueries: number;
  wireRequests: number;
  responseBytes: number;
  queryDurationMs: number;
  fingerprints: Map<string, number>;
  resources: Map<string, ResourceMetrics>;
};

const contexts = new AsyncLocalStorage<ScreenMetrics>();
const processSalt = randomBytes(32);
const enabled = () => process.env.DATA_TELEMETRY === "1";
const safeLabel = (value: string) => /^[a-z0-9/_-]{1,48}$/.test(value) ? value : "other";
const telemetryKey = () => process.env.AUTH_SECRET || processSalt;

/** A navigation label and rotating pseudonym; never logs a user ID or request data. */
export async function traceScreen<T>(screen: string, userId: string | undefined, work: () => Promise<T>): Promise<T> {
  if (!enabled()) return work();
  const day = new Date().toISOString().slice(0, 10);
  const context: ScreenMetrics = {
    screen: safeLabel(screen),
    traceId: randomUUID(),
    userBucket: userId ? createHmac("sha256", telemetryKey()).update(`${day}:${userId}`).digest("hex").slice(0, 16) : undefined,
    started: performance.now(), logicalQueries: 0, duplicateQueries: 0, wireRequests: 0,
    responseBytes: 0, queryDurationMs: 0, fingerprints: new Map(), resources: new Map(),
  };
  return contexts.run(context, async () => {
    let success = false;
    try { const result = await work(); success = true; return result; }
    finally {
      const alerts = [
        ...(context.wireRequests >= 100 ? ["request_volume"] : []),
        ...(context.responseBytes >= 5_000_000 ? ["response_size"] : []),
        ...(context.duplicateQueries >= 10 ? ["duplicate_queries"] : []),
        ...(context.queryDurationMs >= 30_000 ? ["query_duration"] : []),
        ...([...context.resources.values()].some(resource => resource.errors >= 5) ? ["repeated_errors"] : []),
      ];
      console.info(JSON.stringify({
        event: "screen_data_metrics", screen: context.screen, traceId: context.traceId,
        ...(context.userBucket ? { userBucket: context.userBucket } : {}), success,
        logicalQueries: context.logicalQueries, duplicateQueries: context.duplicateQueries,
        wireRequests: context.wireRequests, responseBytes: context.responseBytes,
        queryDurationMs: Math.round(context.queryDurationMs),
        durationMs: Math.round(performance.now() - context.started),
        alerts,
        resources: Object.fromEntries(context.resources),
      }));
    }
  });
}

/** HMAC fingerprint lets operators compare identical queries without seeing filters. */
export function noteQueryAttempt(method: string, url: URL, accept: string | null, range: string | null) {
  if (!enabled()) return { fingerprint: undefined, traceId: undefined };
  const fingerprint = createHmac("sha256", telemetryKey())
    .update(`${method}:${url.href}:${accept ?? ""}:${range ?? ""}`).digest("hex").slice(0, 20);
  const context = contexts.getStore();
  if (context) {
    context.logicalQueries++;
    const previous = context.fingerprints.get(fingerprint) ?? 0;
    if (previous > 0) context.duplicateQueries++;
    if (previous || context.fingerprints.size < 500) context.fingerprints.set(fingerprint, previous + 1);
  }
  return { fingerprint, traceId: context?.traceId };
}

export function noteQueryResult(resource: string, requests: number, bytes: number, status: number, durationMs: number) {
  const context = contexts.getStore();
  if (!context) return;
  const name = safeLabel(resource);
  const entry = context.resources.get(name) ?? { requests: 0, bytes: 0, errors: 0, durationMs: 0 };
  entry.requests += requests;
  entry.bytes += bytes;
  entry.errors += status >= 400 || status === 0 ? 1 : 0;
  entry.durationMs += Math.round(durationMs);
  context.resources.set(name, entry);
  context.wireRequests += requests;
  context.responseBytes += bytes;
  context.queryDurationMs += durationMs;
}
