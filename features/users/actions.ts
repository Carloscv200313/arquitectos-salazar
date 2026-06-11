"use server";

import { revalidatePath } from "next/cache";
import {
  createUser,
  deactivateUser,
  setUserPassword,
  updateUser,
} from "@/services/users.service";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { createUserSchema, setPasswordSchema, updateUserSchema } from "./validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

function guard(): ActionResult | null {
  if (!isAdminConfigured()) {
    return { ok: false, error: "Conecta Supabase (service_role) para administrar usuarios." };
  }
  return null;
}

async function run(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar." };
  }
}

export async function saveUserAction(raw: unknown): Promise<ActionResult> {
  const g = guard();
  if (g) return g;

  const asUpdate = updateUserSchema.safeParse(raw);
  if (asUpdate.success && (raw as { id?: string }).id) {
    const d = asUpdate.data;
    return run(() =>
      updateUser({ id: d.id, fullName: d.fullName, roleId: d.roleId, permissions: d.permissions }),
    );
  }

  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  return run(() =>
    createUser({
      email: d.email,
      password: d.password,
      fullName: d.fullName,
      roleId: d.roleId,
      permissions: d.permissions,
    }),
  );
}

export async function setUserPasswordAction(raw: unknown): Promise<ActionResult> {
  const g = guard();
  if (g) return g;
  const parsed = setPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  return run(() => setUserPassword(parsed.data.id, parsed.data.password));
}

export async function deactivateUserAction(id: string): Promise<ActionResult> {
  const g = guard();
  if (g) return g;
  return run(() => deactivateUser(id));
}
