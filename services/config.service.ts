import "server-only";

import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/features/auth/get-user";

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
export interface HelpItem {
  id: string;
  title: string;
  content: string;
  section: string;
  order_index: number;
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
