import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isAdminConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

// Service-role client. SERVER ONLY — bypasses RLS. Never import in client code.
// Auth is enforced by our own session (lib/auth/session), not by Supabase Auth.
export function createAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
