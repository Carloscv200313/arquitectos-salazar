"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Banknote,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  UserCog,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  changePasswordAction,
  hideEmployeeAction,
  hidePaymentAccountAction,
  hideTaskTypeAction,
  saveEmployeeAction,
  savePaymentAccountAction,
  saveTaskTypeAction,
  updateProfileNameAction,
  type ActionResult,
} from "@/features/settings/actions";
import { signOutAction } from "@/features/auth/actions";
import { UsersSection } from "@/components/settings/users-section";
import type { CurrentUser } from "@/features/auth/get-user";
import type { Employee, PaymentAccount, TaskType } from "@/services/config.service";
import type { AppUser, Role } from "@/services/users.service";

const WORK_TYPE_LABELS: Record<string, string> = {
  project: "Proyecto",
  work: "Obra",
  mixed: "Mixto",
  week: "Semana",
};
const MODULE_LABELS: Record<string, string> = {
  project: "Proyecto",
  work: "Obra",
  general: "General",
};

type Field = {
  name: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: { label: string; value: string }[];
  placeholder?: string;
};

type Row = Record<string, string>;

function EditorDialog({
  open,
  onOpenChange,
  title,
  fields,
  initial,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: Field[];
  initial: Row;
  pending: boolean;
  onSave: (values: Row) => void;
}) {
  const [values, setValues] = useState<Row>(initial);
  useEffect(() => {
    if (open) setValues(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Completa los datos y guarda los cambios.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {fields.map((field) => (
            <div key={field.name} className="grid gap-2">
              <Label>{field.label}</Label>
              {field.type === "select" ? (
                <Select
                  value={values[field.name] ?? ""}
                  onValueChange={(v) => setValues((s) => ({ ...s, [field.name]: v ?? "" }))}
                  items={field.options ?? []}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : field.type === "textarea" ? (
                <Textarea
                  value={values[field.name] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(e) => setValues((s) => ({ ...s, [field.name]: e.target.value }))}
                  rows={3}
                />
              ) : (
                <Input
                  value={values[field.name] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(e) => setValues((s) => ({ ...s, [field.name]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(values)} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmHide({
  open,
  onOpenChange,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Ocultar este registro?</DialogTitle>
          <DialogDescription>
            No se elimina de la base de datos; solo deja de aparecer en el sistema (status = 0). Podrás reactivarlo desde Supabase.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Ocultar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CrudSection<T extends { id: string }>({
  title,
  description,
  addLabel,
  items,
  columns,
  fields,
  buildRaw,
  defaults,
  toRow,
  saveAction,
  hideAction,
}: {
  title: string;
  description: string;
  addLabel: string;
  items: T[];
  columns: { label: string; render: (item: T) => ReactNode }[];
  fields: Field[];
  defaults: Row;
  toRow: (item: T) => Row;
  buildRaw: (values: Row, id?: string) => unknown;
  saveAction: (raw: unknown) => Promise<ActionResult>;
  hideAction: (id: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id?: string; initial: Row } | null>(null);
  const [hideId, setHideId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(values: Row) {
    start(async () => {
      const result = await saveAction(buildRaw(values, editing?.id));
      if (result.ok) {
        toast.success("Guardado");
        setEditing(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function hide() {
    if (!hideId) return;
    start(async () => {
      const result = await hideAction(hideId);
      if (result.ok) {
        toast.success("Registro ocultado");
        setHideId(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" onClick={() => setEditing({ initial: defaults })}>
          <Plus className="size-4" />
          {addLabel}
        </Button>
      </div>
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.label} className="px-5">
                {c.label}
              </TableHead>
            ))}
            <TableHead className="px-5 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              {columns.map((c, i) => (
                <TableCell key={i} className="px-5">
                  {c.render(item)}
                </TableCell>
              ))}
              <TableCell className="px-5 text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Editar"
                    onClick={() => setEditing({ id: item.id, initial: toRow(item) })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Ocultar"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setHideId(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="h-20 text-center text-muted-foreground">
                Sin registros activos.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <EditorDialog
        key={editing?.id ?? (editing ? "new" : "closed")}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing?.id ? "Editar" : addLabel}
        fields={fields}
        initial={editing?.initial ?? defaults}
        pending={pending}
        onSave={save}
      />
      <ConfirmHide
        open={hideId !== null}
        onOpenChange={(o) => !o && setHideId(null)}
        pending={pending}
        onConfirm={hide}
      />
    </Card>
  );
}

function ProfileSection({ profile }: { profile: CurrentUser | null }) {
  const router = useRouter();
  const [name, setName] = useState(profile?.fullName ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pendingName, startName] = useTransition();
  const [pendingPwd, startPwd] = useTransition();

  function saveName() {
    startName(async () => {
      const r = await updateProfileNameAction({ fullName: name });
      if (r.ok) {
        toast.success("Nombre actualizado");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function changePwd() {
    startPwd(async () => {
      const r = await changePasswordAction({ password, confirm });
      if (r.ok) {
        toast.success("Contraseña actualizada");
        setPassword("");
        setConfirm("");
      } else toast.error(r.error);
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="gap-0 p-5">
        <h3 className="font-semibold">Datos del perfil</h3>
        <p className="mb-4 text-sm text-muted-foreground">Tu información dentro del sistema.</p>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Correo</Label>
            <Input value={profile?.email ?? "—"} disabled />
          </div>
          <div className="grid gap-2">
            <Label>Rol</Label>
            <Input value={profile?.roleName ?? "—"} disabled />
          </div>
          <div className="grid gap-2">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button onClick={saveName} disabled={pendingName || !profile} className="w-fit">
            {pendingName ? <Loader2 className="size-4 animate-spin" /> : <UserRound className="size-4" />}
            Guardar nombre
          </Button>
        </div>
      </Card>

      <Card className="gap-0 p-5">
        <h3 className="font-semibold">Seguridad</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Cambia tu contraseña (gestionada por Supabase Auth).
        </p>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Nueva contraseña</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div className="grid gap-2">
            <Label>Confirmar contraseña</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button onClick={changePwd} disabled={pendingPwd || !profile} className="w-fit">
            {pendingPwd ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            Cambiar contraseña
          </Button>
        </div>

        <div className="mt-6 border-t pt-4">
          <form action={signOutAction}>
            <Button type="submit" variant="outline" className="text-destructive">
              <LogOut className="size-4" />
              Cerrar sesión
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

export function SettingsView({
  configured,
  employees,
  accounts,
  taskTypes,
  users,
  roles,
  canManageUsers,
  profile,
}: {
  configured: boolean;
  employees: Employee[];
  accounts: PaymentAccount[];
  taskTypes: TaskType[];
  users: AppUser[];
  roles: Role[];
  canManageUsers: boolean;
  profile: CurrentUser | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {!configured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Supabase aún no está conectado. Copia <code>.env.local.example</code> a{" "}
          <code>.env.local</code>, pega tus claves y ejecuta <code>db/supabase-schema.sql</code>.
          Mientras tanto, los catálogos se muestran vacíos.
        </div>
      ) : null}

      <Tabs defaultValue="empleados">
        <TabsList>
          <TabsTrigger value="empleados">
            <Users className="size-4" /> Empleados
          </TabsTrigger>
          <TabsTrigger value="cuentas">
            <Banknote className="size-4" /> Cuentas
          </TabsTrigger>
          <TabsTrigger value="tareas">
            <Wrench className="size-4" /> Tipos de tarea
          </TabsTrigger>
          {canManageUsers ? (
            <TabsTrigger value="usuarios">
              <UserCog className="size-4" /> Usuarios
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="perfil">
            <UserRound className="size-4" /> Perfil
          </TabsTrigger>
        </TabsList>

        <TabsContent value="empleados">
          <CrudSection
            title="Empleados"
            description="Personal activo del sistema."
            addLabel="Nuevo empleado"
            items={employees}
            columns={[
              { label: "Nombre", render: (i) => <span className="font-medium">{i.full_name as string}</span> },
              { label: "Tipo base", render: (i) => WORK_TYPE_LABELS[i.default_work_type as string] ?? "—" },
            ]}
            fields={[
              { name: "fullName", label: "Nombre completo", type: "text" },
              {
                name: "defaultWorkType",
                label: "Tipo base",
                type: "select",
                options: Object.entries(WORK_TYPE_LABELS).map(([value, label]) => ({ value, label })),
              },
            ]}
            defaults={{ fullName: "", defaultWorkType: "mixed" }}
            toRow={(i) => ({ fullName: i.full_name as string, defaultWorkType: i.default_work_type as string })}
            buildRaw={(v, id) => ({ id, fullName: v.fullName, defaultWorkType: v.defaultWorkType })}
            saveAction={saveEmployeeAction}
            hideAction={hideEmployeeAction}
          />
        </TabsContent>

        <TabsContent value="cuentas">
          <CrudSection
            title="Cuentas y métodos de pago"
            description="Cuentas usadas en proyectos, obras, pedidos y salarios."
            addLabel="Nueva cuenta"
            items={accounts}
            columns={[
              { label: "Nombre", render: (i) => <span className="font-medium">{i.name as string}</span> },
              { label: "Descripción", render: (i) => (i.description as string) || "—" },
            ]}
            fields={[
              { name: "name", label: "Nombre", type: "text" },
              { name: "description", label: "Descripción", type: "textarea" },
            ]}
            defaults={{ name: "", description: "" }}
            toRow={(i) => ({ name: i.name as string, description: (i.description as string) ?? "" })}
            buildRaw={(v, id) => ({ id, name: v.name, description: v.description })}
            saveAction={savePaymentAccountAction}
            hideAction={hidePaymentAccountAction}
          />
        </TabsContent>

        <TabsContent value="tareas">
          <CrudSection
            title="Tipos de tarea"
            description="Tareas asociadas a proyectos, obras o generales."
            addLabel="Nuevo tipo"
            items={taskTypes}
            columns={[
              { label: "Nombre", render: (i) => <span className="font-medium">{i.name as string}</span> },
              { label: "Módulo", render: (i) => MODULE_LABELS[i.module_type as string] ?? "—" },
            ]}
            fields={[
              { name: "name", label: "Nombre", type: "text" },
              {
                name: "moduleType",
                label: "Módulo",
                type: "select",
                options: Object.entries(MODULE_LABELS).map(([value, label]) => ({ value, label })),
              },
            ]}
            defaults={{ name: "", moduleType: "general" }}
            toRow={(i) => ({ name: i.name as string, moduleType: i.module_type as string })}
            buildRaw={(v, id) => ({ id, name: v.name, moduleType: v.moduleType })}
            saveAction={saveTaskTypeAction}
            hideAction={hideTaskTypeAction}
          />
        </TabsContent>

        {canManageUsers ? (
          <TabsContent value="usuarios">
            <UsersSection users={users} roles={roles} />
          </TabsContent>
        ) : null}

        <TabsContent value="perfil">
          <ProfileSection profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
