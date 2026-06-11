import "server-only";

import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  roleName: string | null;
  permissions: string[];
  avatarUrl: string | null;
}

// Resolves the current user from the signed session cookie. Null when not
// logged in or while Supabase is not configured.
export async function getCurrentAppUser(): Promise<CurrentUser | null> {
  if (!isAdminConfigured()) return null;

  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("id, email, full_name, permissions, avatar_url, status, roles(name)")
    .eq("id", session.sub)
    .eq("status", 1)
    .maybeSingle();

  if (!data) return null;

  const role = Array.isArray(data.roles) ? data.roles[0] : data.roles;

  return {
    id: data.id as string,
    email: data.email as string,
    fullName: data.full_name as string,
    roleName: (role?.name as string) ?? null,
    permissions: (data.permissions as string[]) ?? [],
    avatarUrl: (data.avatar_url as string) ?? null,
  };
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!isAdminConfigured()) return null;
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  return session?.sub ?? null;
}
