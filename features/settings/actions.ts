"use server";

import { revalidatePath } from "next/cache";
import {
  changePassword,
  createEmployee,
  createPaymentAccount,
  createProvider,
  createTaskType,
  createWorkCategory,
  hideEmployee,
  hidePaymentAccount,
  hideProvider,
  hideTaskType,
  hideWorkCategory,
  listHelpItems,
  updateEmployee,
  updatePaymentAccount,
  updateProvider,
  updateProfileName,
  updateTaskType,
  updateWorkCategory,
  type HelpItem,
} from "@/services/config.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  employeeSchema,
  passwordSchema,
  paymentAccountSchema,
  profileNameSchema,
  providerSchema,
  taskTypeSchema,
  workCategorySchema,
} from "./validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function getHelpItemsAction(): Promise<HelpItem[]> {
  return listHelpItems();
}

function guard(): ActionResult | null {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Conecta Supabase (.env.local) para administrar estos datos." };
  }
  return null;
}

function revalidate(paths: string[]) {
  for (const path of paths) revalidatePath(path);
}

async function run(fn: () => Promise<void>, paths = ["/configuracion"]): Promise<ActionResult> {
  try {
    await fn();
    revalidate(paths);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar." };
  }
}

/* Employees */
export async function saveEmployeeAction(raw: unknown): Promise<ActionResult> {
  const g = guard();
  if (g) return g;
  const parsed = employeeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  return run(() =>
    d.id
      ? updateEmployee({ id: d.id, fullName: d.fullName, defaultWorkType: d.defaultWorkType })
      : createEmployee({ fullName: d.fullName, defaultWorkType: d.defaultWorkType }),
  );
}
export async function hideEmployeeAction(id: string): Promise<ActionResult> {
  const g = guard();
  if (g) return g;
  return run(() => hideEmployee(id));
}

/* Payment accounts */
export async function savePaymentAccountAction(raw: unknown): Promise<ActionResult> {
  const g = guard();
  if (g) return g;
  const parsed = paymentAccountSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  return run(() =>
    d.id
      ? updatePaymentAccount({ id: d.id, name: d.name, description: d.description })
      : createPaymentAccount({ name: d.name, description: d.description }),
  );
}
export async function hidePaymentAccountAction(id: string): Promise<ActionResult> {
  const g = guard();
  if (g) return g;
  return run(() => hidePaymentAccount(id));
}

/* Task types */
export async function saveTaskTypeAction(raw: unknown): Promise<ActionResult> {
  const g = guard();
  if (g) return g;
  const parsed = taskTypeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  return run(() =>
    d.id
      ? updateTaskType({ id: d.id, name: d.name, moduleType: d.moduleType })
      : createTaskType({ name: d.name, moduleType: d.moduleType }),
  );
}
export async function hideTaskTypeAction(id: string): Promise<ActionResult> {
  const g = guard();
  if (g) return g;
  return run(() => hideTaskType(id));
}

/* Providers */
export async function saveProviderAction(raw: unknown): Promise<ActionResult> {
  const g = guard();
  if (g) return g;
  const parsed = providerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  return run(() =>
    d.id ? updateProvider({ id: d.id, name: d.name }) : createProvider({ name: d.name }),
  );
}
export async function hideProviderAction(id: string): Promise<ActionResult> {
  const g = guard();
  if (g) return g;
  return run(() => hideProvider(id));
}

/* Work categories */
export async function saveWorkCategoryAction(raw: unknown): Promise<ActionResult> {
  const g = guard();
  if (g) return g;
  const parsed = workCategorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  return run(
    () => (d.id ? updateWorkCategory({ id: d.id, name: d.name }) : createWorkCategory({ name: d.name })),
    [
      "/configuracion",
      "/dashboard",
      "/obras",
      "/obras/reports",
      "/pedidos",
      "/pedidos/reports",
      "/finance/deudas",
      "/finance/balance-general",
    ],
  );
}
export async function hideWorkCategoryAction(id: string): Promise<ActionResult> {
  const g = guard();
  if (g) return g;
  return run(() => hideWorkCategory(id));
}

/* Profile */
export async function updateProfileNameAction(raw: unknown): Promise<ActionResult> {
  const g = guard();
  if (g) return g;
  const parsed = profileNameSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  return run(() => updateProfileName(parsed.data.fullName));
}
export async function changePasswordAction(raw: unknown): Promise<ActionResult> {
  const g = guard();
  if (g) return g;
  const parsed = passwordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  return run(() => changePassword(parsed.data.password));
}
