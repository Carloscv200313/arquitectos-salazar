"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/auth/session";
import { loginSchema } from "./validation";

export type AuthResult = { ok: true } | { ok: false; error: string };

// Generic message on purpose: never reveal whether the email exists.
const INVALID = "Credenciales inválidas.";

interface VerifiedUser {
  id: string;
  email: string;
  full_name: string;
  role_name: string | null;
  status: number;
}

export async function signInAction(raw: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  if (!isAdminConfigured()) {
    return { ok: false, error: "Supabase no está configurado todavía." };
  }

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? INVALID };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_login", {
    p_email: parsed.data.email,
    p_password: parsed.data.password,
  });

  const user = (Array.isArray(data) ? data[0] : data) as VerifiedUser | undefined;
  if (error || !user) return { ok: false, error: INVALID };

  await admin
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", user.id);

  const token = await signSession({
    sub: user.id,
    email: user.email,
    role: user.role_name ?? null,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
