import "server-only";

import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/features/auth/get-user";
import { WORK_PROVIDERS, WORK_EXPENSE_CATEGORIES } from "@/lib/constants";

export interface Employee {
  id: string;
  full_name: string;
  default_work_type: "project" | "work" | "mixed" | "week";
  status: number;
}
export interface PaymentAccount {
  id: string;
  name: string;
  description: string | null;
  status: number;
}
export interface TaskType {
  id: string;
  name: string;
  module_type: "project" | "work" | "general";
  status: number;
}
export interface Provider {
  id: string;
  name: string;
  status: number;
}
export interface WorkCategory {
  id: string;
  name: string;
  status: number;
}
export interface HelpItem {
  id: string;
  title: string;
  content: string;
  section: string;
  order_index: number;
}

type AdminClient = ReturnType<typeof createAdminClient>;
type WorkCategoryBudgetRow = {
  id: string;
  work_id: string;
  amount: number | string | null;
  executed_amount: number | string | null;
};

function money(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

async function updateCategoryText(
  client: AdminClient,
  table: "work_movements" | "work_orders",
  previousName: string,
  nextName: string,
) {
  const { error } = await client
    .from(table)
    .update({ category: nextName })
    .eq("category", previousName);
  if (error) throw new Error(error.message);
}

async function mergeWorkCategoryBudgets(
  client: AdminClient,
  previousName: string,
  nextName: string,
) {
  const { error } = await client
    .from("work_category_budgets")
    .update({ category: nextName })
    .eq("category", previousName);

  if (!error) return;
  if (error.code !== "23505") throw new Error(error.message);

  const { data: previousRows, error: previousError } = await client
    .from("work_category_budgets")
    .select("id, work_id, amount, executed_amount")
    .eq("category", previousName);
  if (previousError) throw new Error(previousError.message);

  const budgets = ((previousRows ?? []) as WorkCategoryBudgetRow[]).filter((row) => row.work_id);
  if (budgets.length === 0) return;

  const { data: nextRows, error: nextError } = await client
    .from("work_category_budgets")
    .select("id, work_id, amount, executed_amount")
    .eq("category", nextName)
    .in(
      "work_id",
      budgets.map((row) => row.work_id),
    );
  if (nextError) throw new Error(nextError.message);

  const nextByWork = new Map(
    ((nextRows ?? []) as WorkCategoryBudgetRow[]).map((row) => [row.work_id, row]),
  );

  for (const previous of budgets) {
    const existing = nextByWork.get(previous.work_id);
    if (!existing || existing.id === previous.id) {
      const { error: renameError } = await client
        .from("work_category_budgets")
        .update({ category: nextName })
        .eq("id", previous.id);
      if (renameError) throw new Error(renameError.message);
      continue;
    }

    const { error: mergeError } = await client
      .from("work_category_budgets")
      .update({
        amount: money(existing.amount) + money(previous.amount),
        executed_amount: money(existing.executed_amount) + money(previous.executed_amount),
      })
      .eq("id", existing.id);
    if (mergeError) throw new Error(mergeError.message);

    const { error: deleteError } = await client
      .from("work_category_budgets")
      .delete()
      .eq("id", previous.id);
    if (deleteError) throw new Error(deleteError.message);
  }
}

async function renameWorkCategoryUsage(
  client: AdminClient,
  previousName: string,
  nextName: string,
) {
  await updateCategoryText(client, "work_movements", previousName, nextName);
  await updateCategoryText(client, "work_orders", previousName, nextName);
  await mergeWorkCategoryBudgets(client, previousName, nextName);
}

/* ------------------------------------------------------------- Employees */

export async function listEmployees(): Promise<Employee[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await createAdminClient()
    .from("employees")
    .select("id, full_name, default_work_type, status")
    .eq("status", 1)
    .order("full_name");
  return (data as Employee[]) ?? [];
}

export async function createEmployee(input: {
  fullName: string;
  defaultWorkType: Employee["default_work_type"];
}) {
  const { error } = await createAdminClient().from("employees").insert({
    full_name: input.fullName.trim(),
    default_work_type: input.defaultWorkType,
    created_by: await getCurrentUserId(),
  });
  if (error) throw new Error(error.message);
}

export async function updateEmployee(input: {
  id: string;
  fullName: string;
  defaultWorkType: Employee["default_work_type"];
}) {
  const { error } = await createAdminClient()
    .from("employees")
    .update({ full_name: input.fullName.trim(), default_work_type: input.defaultWorkType })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function hideEmployee(id: string) {
  const { error } = await createAdminClient().from("employees").update({ status: 0 }).eq("id", id);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------- Payment accounts */

export async function listPaymentAccounts(): Promise<PaymentAccount[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await createAdminClient()
    .from("payment_accounts")
    .select("id, name, description, status")
    .eq("status", 1)
    .order("name");
  return (data as PaymentAccount[]) ?? [];
}

export async function createPaymentAccount(input: { name: string; description?: string }) {
  const { error } = await createAdminClient().from("payment_accounts").insert({
    name: input.name.trim(),
    description: input.description?.trim() || null,
    created_by: await getCurrentUserId(),
  });
  if (error) throw new Error(error.message);
}

export async function updatePaymentAccount(input: {
  id: string;
  name: string;
  description?: string;
}) {
  const { error } = await createAdminClient()
    .from("payment_accounts")
    .update({ name: input.name.trim(), description: input.description?.trim() || null })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function hidePaymentAccount(id: string) {
  const { error } = await createAdminClient()
    .from("payment_accounts")
    .update({ status: 0 })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------ Task types */

export async function listTaskTypes(): Promise<TaskType[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await createAdminClient()
    .from("task_types")
    .select("id, name, module_type, status")
    .eq("status", 1)
    .order("name");
  return (data as TaskType[]) ?? [];
}

export async function createTaskType(input: {
  name: string;
  moduleType: TaskType["module_type"];
}) {
  const { error } = await createAdminClient().from("task_types").insert({
    name: input.name.trim(),
    module_type: input.moduleType,
    created_by: await getCurrentUserId(),
  });
  if (error) throw new Error(error.message);
}

export async function updateTaskType(input: {
  id: string;
  name: string;
  moduleType: TaskType["module_type"];
}) {
  const { error } = await createAdminClient()
    .from("task_types")
    .update({ name: input.name.trim(), module_type: input.moduleType })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function hideTaskType(id: string) {
  const { error } = await createAdminClient().from("task_types").update({ status: 0 }).eq("id", id);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------- Providers */

export async function listProviders(): Promise<Provider[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await createAdminClient()
    .from("providers")
    .select("id, name, status")
    .eq("status", 1)
    .order("name");
  return (data as Provider[]) ?? [];
}

/** Active provider names for form selects. Falls back to the seed list. */
export async function listProviderNames(): Promise<string[]> {
  const rows = await listProviders();
  if (rows.length > 0) return rows.map((p) => p.name);
  return [...WORK_PROVIDERS];
}

export async function createProvider(input: { name: string }) {
  const { error } = await createAdminClient().from("providers").insert({
    name: input.name.trim(),
    created_by: await getCurrentUserId(),
  });
  if (error) throw new Error(error.message);
}

export async function updateProvider(input: { id: string; name: string }) {
  const { error } = await createAdminClient()
    .from("providers")
    .update({ name: input.name.trim() })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
}

export async function hideProvider(id: string) {
  const { error } = await createAdminClient().from("providers").update({ status: 0 }).eq("id", id);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------- Work categories */

export async function listWorkCategories(): Promise<WorkCategory[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await createAdminClient()
    .from("work_categories")
    .select("id, name, status")
    .eq("status", 1)
    .order("name");
  return (data as WorkCategory[]) ?? [];
}

/** Active expense category names for form selects. Falls back to the seed list. */
export async function listWorkCategoryNames(): Promise<string[]> {
  const rows = await listWorkCategories();
  if (rows.length > 0) return rows.map((c) => c.name);
  return [...WORK_EXPENSE_CATEGORIES];
}

export async function createWorkCategory(input: { name: string }) {
  const { error } = await createAdminClient().from("work_categories").insert({
    name: input.name.trim(),
    created_by: await getCurrentUserId(),
  });
  if (error) throw new Error(error.message);
}

export async function updateWorkCategory(input: { id: string; name: string }) {
  const client = createAdminClient();
  const nextName = input.name.trim();

  const { data: current, error: currentError } = await client
    .from("work_categories")
    .select("name")
    .eq("id", input.id)
    .maybeSingle();
  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error("Categoría no encontrada.");

  const previousName = String(current.name ?? "").trim();
  if (previousName === nextName) return;

  const { data: duplicate, error: duplicateError } = await client
    .from("work_categories")
    .select("id")
    .eq("name", nextName)
    .neq("id", input.id)
    .maybeSingle();
  if (duplicateError) throw new Error(duplicateError.message);
  if (duplicate) throw new Error("Ya existe una categoría con ese nombre.");

  const { error } = await client
    .from("work_categories")
    .update({ name: nextName, updated_at: new Date().toISOString() })
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  await renameWorkCategoryUsage(client, previousName, nextName);
}

export async function hideWorkCategory(id: string) {
  const { error } = await createAdminClient()
    .from("work_categories")
    .update({ status: 0 })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------- Help items */

export async function listHelpItems(): Promise<HelpItem[]> {
  if (!isAdminConfigured()) return [];
  const { data } = await createAdminClient()
    .from("help_items")
    .select("id, title, content, section, order_index")
    .eq("status", 1)
    .order("section")
    .order("order_index");
  return (data as HelpItem[]) ?? [];
}

/* --------------------------------------------------------------- Profile */

export async function updateProfileName(fullName: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Sesión no válida");
  const { error } = await createAdminClient()
    .from("users")
    .update({ full_name: fullName.trim() })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function changePassword(newPassword: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Sesión no válida");
  const { error } = await createAdminClient().rpc("admin_set_password", {
    p_user_id: userId,
    p_password: newPassword,
  });
  if (error) throw new Error(error.message);
}
