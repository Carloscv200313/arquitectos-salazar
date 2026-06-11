"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Loader2, Pencil, Plus, ShieldCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  permissionKey,
} from "@/lib/auth/permissions";
import {
  deactivateUserAction,
  saveUserAction,
  setUserPasswordAction,
} from "@/features/users/actions";
import type { AppUser, Role } from "@/services/users.service";
import { cn } from "@/lib/utils";

type EditState = { user: AppUser | null } | null;

function PermissionGrid({
  value,
  onChange,
}: {
  value: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  function toggle(key: string) {
    const next = new Set(value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }
  function toggleModule(moduleKey: string, on: boolean) {
    const next = new Set(value);
    for (const a of PERMISSION_ACTIONS) {
      const key = permissionKey(moduleKey, a.key);
      if (on) next.add(key);
      else next.delete(key);
    }
    onChange(next);
  }

  return (
    <div className="rounded-xl border">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Módulo</span>
        {PERMISSION_ACTIONS.map((a) => (
          <span key={a.key} className="w-12 text-center">
            {a.label}
          </span>
        ))}
      </div>
      <div className="divide-y">
        {PERMISSION_MODULES.map((m) => {
          const allOn = PERMISSION_ACTIONS.every((a) => value.has(permissionKey(m.key, a.key)));
          return (
            <div key={m.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => toggleModule(m.key, !allOn)}
                className="text-left text-sm font-medium hover:text-brand-foreground"
              >
                {m.label}
              </button>
              {PERMISSION_ACTIONS.map((a) => {
                const key = permissionKey(m.key, a.key);
                const on = value.has(key);
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => toggle(key)}
                    className={cn(
                      "mx-auto flex size-6 items-center justify-center rounded-md border transition-colors",
                      on
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-border bg-background text-transparent hover:bg-muted",
                    )}
                    aria-pressed={on}
                    aria-label={`${m.label} ${a.label}`}
                  >
                    <ShieldCheck className="size-3.5" />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function UsersSection({ users, roles }: { users: AppUser[]; roles: Role[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<EditState>(null);
  const [pwdUser, setPwdUser] = useState<AppUser | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const roleItems = roles.map((r) => ({ label: r.name, value: r.id }));

  // form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [newPwd, setNewPwd] = useState("");

  function openNew() {
    setFullName("");
    setEmail("");
    setPassword("");
    setRoleId(roles[0]?.id ?? "");
    setPerms(new Set());
    setEdit({ user: null });
  }
  function openEdit(user: AppUser) {
    setFullName(user.full_name);
    setEmail(user.email);
    setRoleId(user.role_id ?? roles[0]?.id ?? "");
    setPerms(new Set(user.permissions));
    setEdit({ user });
  }

  function save() {
    start(async () => {
      const editing = edit?.user;
      const raw = editing
        ? { id: editing.id, fullName, roleId, permissions: [...perms] }
        : { email, password, fullName, roleId, permissions: [...perms] };
      const result = await saveUserAction(raw);
      if (result.ok) {
        toast.success(editing ? "Usuario actualizado" : "Usuario creado");
        setEdit(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function savePassword() {
    if (!pwdUser) return;
    start(async () => {
      const result = await setUserPasswordAction({ id: pwdUser.id, password: newPwd });
      if (result.ok) {
        toast.success("Contraseña actualizada");
        setPwdUser(null);
        setNewPwd("");
      } else {
        toast.error(result.error);
      }
    });
  }

  function deactivate() {
    if (!deactivateId) return;
    start(async () => {
      const result = await deactivateUserAction(deactivateId);
      if (result.ok) {
        toast.success("Usuario desactivado");
        setDeactivateId(null);
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
          <h3 className="font-semibold">Usuarios del sistema</h3>
          <p className="text-sm text-muted-foreground">
            Crea usuarios con rol y permisos. La contraseña se guarda cifrada (bcrypt).
          </p>
        </div>
        <Button size="sm" onClick={openNew} disabled={roles.length === 0}>
          <Plus className="size-4" /> Nuevo usuario
        </Button>
      </div>

      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="px-5">Usuario</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Permisos</TableHead>
            <TableHead className="px-5 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="px-5">
                <div className="font-medium">{u.full_name}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </TableCell>
              <TableCell>{u.role_name ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {u.permissions.length} permiso{u.permissions.length === 1 ? "" : "s"}
              </TableCell>
              <TableCell className="px-5 text-right">
                <div className="flex justify-end gap-1">
                  <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => openEdit(u)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Contraseña"
                    onClick={() => setPwdUser(u)}
                  >
                    <KeyRound className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Desactivar"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeactivateId(u.id)}
                  >
                    <UserX className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                Sin usuarios activos.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      {/* Create / edit dialog */}
      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit?.user ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
            <DialogDescription>Define datos, rol y permisos del usuario.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            {!edit?.user ? (
              <>
                <div className="grid gap-2">
                  <Label>Correo</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Contraseña temporal</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
              </>
            ) : (
              <div className="grid gap-2">
                <Label>Correo</Label>
                <Input value={email} disabled />
              </div>
            )}
            <div className="grid gap-2">
              <Label>Rol</Label>
              <Select value={roleId} onValueChange={(v) => setRoleId(v ?? "")} items={roleItems}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Permisos</Label>
              <PermissionGrid value={perms} onChange={setPerms} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password dialog */}
      <Dialog open={pwdUser !== null} onOpenChange={(o) => !o && setPwdUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>{pwdUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Nueva contraseña</Label>
            <Input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdUser(null)}>
              Cancelar
            </Button>
            <Button onClick={savePassword} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirm */}
      <Dialog open={deactivateId !== null} onOpenChange={(o) => !o && setDeactivateId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Desactivar usuario?</DialogTitle>
            <DialogDescription>
              No se elimina; queda con status = 0 y no podrá iniciar sesión.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateId(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={deactivate}
              disabled={pending}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <UserX className="size-4" />}
              Desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
