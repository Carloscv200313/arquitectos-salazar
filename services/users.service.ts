import "server-only";

import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/features/auth/get-user";

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role_id: string | null;
  role_name: string | null;
  permissions: string[];
  last_login_at: string | null;
  status: number;
}

export interface Role {
  id: string;
  name: string;
}

export async function listUsers(): Promise<AppUser[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await createAdminClient()
    .from("users")
    .select("id, email, full_name, role_id, permissions, last_login_at, status, roles(name)")
    .eq("status", 1)
    .order("full_name");

  return (
    (data ?? []).map((u) => {
      const role = Array.isArray(u.roles) ? u.roles[0] : u.roles;
      return {
        id: u.id as string,
        email: u.email as string,
        full_name: u.full_name as string,
        role_id: (u.role_id as string) ?? null,
        role_name: (role?.name as string) ?? null,
        permissions: (u.permissions as string[]) ?? [],
        last_login_at: (u.last_login_at as string) ?? null,
        status: u.status as number,
      };
    }) ?? []
  );
}

export async function listRoles(): Promise<Role[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await createAdminClient()
    .from("roles")
    .select("id, name")
    .eq("status", 1)
    .order("name");
  return (data as Role[]) ?? [];
}

export async function createUser(input: {
  email: string;
  password: string;
  fullName: string;
  roleId: string;
  permissions: string[];
}) {
  const { error } = await createAdminClient().rpc("admin_create_user", {
    p_email: input.email.trim(),
    p_password: input.password,
    p_full_name: input.fullName.trim(),
    p_role_id: input.roleId,
    p_permissions: input.permissions,
    p_created_by: await getCurrentUserId(),
  });
  if (error) throw new Error(error.message);
}

export async function updateUser(input: {
  id: string;
  fullName: string;
  roleId: string;
  permissions: string[];
}) {
  const { error } = await createAdminClient()
    .from("users")
    .update({
      full_name: input.fullName.trim(),
      role_id: input.roleId,
      permissions: input.permissions,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function setUserPassword(id: string, password: string) {
  const { error } = await createAdminClient().rpc("admin_set_password", {
    p_user_id: id,
    p_password: password,
  });
  if (error) throw new Error(error.message);
}

export async function deactivateUser(id: string) {
  const currentId = await getCurrentUserId();
  if (currentId === id) throw new Error("No puedes desactivar tu propio usuario.");
  const { error } = await createAdminClient().from("users").update({ status: 0 }).eq("id", id);
  if (error) throw new Error(error.message);
}
