import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next 16 renamed `middleware` to `proxy`. Runs before routes render: refreshes
// the Supabase session and redirects unauthenticated users to /login.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except static assets, images and the service worker.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
