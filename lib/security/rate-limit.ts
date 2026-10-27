import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export class RateLimitError extends Error {
  constructor() { super("Demasiadas solicitudes. Espera un minuto e intenta nuevamente."); }
}

/** Bounded per-process protection. A shared hosting/WAF limit is still required for multi-instance deployments. */
export function consumeLimit(key: string, maximum: number, now = Date.now(), windowMs = 60_000) {
  if (buckets.size >= 5000) {
    for (const [id, bucket] of buckets) if (bucket.reset <= now) buckets.delete(id);
    if (buckets.size >= 5000 && !buckets.has(key)) throw new RateLimitError();
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) { buckets.set(key, { count: 1, reset: now + windowMs }); return; }
  if (bucket.count >= maximum) throw new RateLimitError();
  bucket.count++;
}

export async function limitPublicRequest(operation: string, maximum = 30) {
  // Global cap also applies when forwarding headers are untrusted/missing.
  consumeLimit(`global:${operation}`, maximum * 5);
  const headerName = process.env.TRUSTED_CLIENT_IP_HEADER;
  if (headerName && process.env.AUTH_SECRET) {
    const value = (await headers()).get(headerName);
    if (value) {
      const hash = createHmac("sha256", process.env.AUTH_SECRET).update(value.slice(0, 128)).digest("hex");
      consumeLimit(`${operation}:${hash}`, maximum);
    }
  }
}
