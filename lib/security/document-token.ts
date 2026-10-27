import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value === "dev-insecure-secret-change-me") throw new Error("Configuración de documentos no disponible.");
  return value;
}

export function issueDocumentToken(resource: string, lifetimeSeconds = 7 * 86400, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ resource, exp: Math.floor(now / 1000) + lifetimeSeconds })).toString("base64url");
  const mac = createHmac("sha256", secret()).update(`document-v1:${body}`).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyDocumentToken(token: unknown, resource: string, now = Date.now()): boolean {
  if (typeof token !== "string" || token.length > 2048) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  try {
    const expected = createHmac("sha256", secret()).update(`document-v1:${parts[0]}`).digest();
    const actual = Buffer.from(parts[1], "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    return payload.resource === resource && Number.isFinite(payload.exp) && payload.exp > Math.floor(now / 1000);
  } catch { return false; }
}
