
import { requirePermission } from "@/lib/auth/authorize";
import { redirect } from "next/navigation";

export default async function FinancePage() {
  await requirePermission("finance.view");

  redirect("/finance/balance-general");
}
