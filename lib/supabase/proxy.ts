import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "./env";

const PUBLIC_PREFIXES = ["/login", "/auth", "/forgot-password", "/reset-password"];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Verifies the signed session cookie and gates protected routes.
// No-op while Supabase is not configured, so the app keeps working in-memory.
export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next();

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;
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
