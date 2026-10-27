// Signed session cookie (HMAC-SHA256). Edge-safe (uses Web Crypto), so it works
// in the proxy and in server actions. The cookie is httpOnly; the signature
// prevents tampering. Payload is small (id, email, role, exp).

function sessionSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret === "dev-insecure-secret-change-me") throw new Error("AUTH_SECRET no está configurado de forma segura.");
  return secret;
}
export const SESSION_COOKIE = "as_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

export interface SessionPayload {
  sub: string; // user id
  email: string;
  role: string | null;
  exp: number; // unix seconds
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytes(input: string): BufferSource {
  return new TextEncoder().encode(input) as unknown as BufferSource;
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    bytes(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const data = b64urlFromBytes(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, bytes(data));
  return `${data}.${b64urlFromBytes(new Uint8Array(sig))}`;
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || token.length > 8192) return null;
  const [data, sig] = parts;
  if (!data || !sig) return null;
  try {
    const key = await hmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlToBytes(sig) as unknown as BufferSource,
      bytes(data),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(data))) as SessionPayload;
    if (typeof payload.sub !== "string" || !payload.sub || typeof payload.email !== "string" || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
