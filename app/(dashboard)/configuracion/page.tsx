import { Settings } from "lucide-react";
import { SettingsView } from "@/components/settings/settings-view";
import {
  listEmployees,
  listPaymentAccounts,
  listTaskTypes,
} from "@/services/config.service";
import { listRoles, listUsers } from "@/services/users.service";
import { getCurrentAppUser } from "@/features/auth/get-user";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const profile = await getCurrentAppUser();
  const canManageUsers = profile ? hasPermission(profile.permissions, "users.view") : false;

  const [employees, accounts, taskTypes, users, roles] = await Promise.all([
    listEmployees(),
    listPaymentAccounts(),
    listTaskTypes(),
    canManageUsers ? listUsers() : Promise.resolve([]),
    canManageUsers ? listRoles() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-brand-muted text-brand-foreground">
          <Settings className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
          <p className="text-sm text-muted-foreground">
            Administra empleados, cuentas, tipos de tarea, usuarios y tu perfil.
          </p>
        </div>
      </div>

      <SettingsView
        configured={isSupabaseConfigured()}
        employees={employees}
        accounts={accounts}
        taskTypes={taskTypes}
        users={users}
        roles={roles}
        canManageUsers={canManageUsers}
        profile={profile}
      />
    </div>
  );
}
