import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "./env";

const PUBLIC_PREFIXES = ["/login", "/auth", "/forgot-password", "/reset-password"];

// Rutas abiertas a cualquiera, con o sin sesión. No se redirigen en ningún sentido:
// el público registra abonos/pedidos sin login, y los usuarios logiados también
// pueden abrir el recibo sin que se les rebote al dashboard.
const OPEN_PREFIXES = ["/abono", "/pedido", "/recibo", "/firma", "/api/order-notifications"];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublicPath(pathname: string) {
  return matchesPrefix(pathname, PUBLIC_PREFIXES);
}

function isOpenPath(pathname: string) {
  return matchesPrefix(pathname, OPEN_PREFIXES);
}

// Verifies the signed session cookie and gates protected routes.
// No-op while Supabase is not configured, so the app keeps working in-memory.
export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Open routes: always allowed, no redirects, regardless of session.
  if (isOpenPath(pathname)) return NextResponse.next();

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const publicPath = isPublicPath(pathname);

  if (!session && !publicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (session && publicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
