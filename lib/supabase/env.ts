// Single source of truth for Supabase environment configuration.
// While the keys are absent the app keeps running on the in-memory store and
// auth gating stays disabled, so nothing breaks before you paste credentials.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
