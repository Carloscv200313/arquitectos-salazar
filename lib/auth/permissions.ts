// Per-user permission catalog. A permission key is `${module}.${action}`.
export const PERMISSION_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "projects", label: "Proyectos" },
  { key: "works", label: "Obras" },
  { key: "orders", label: "Pedidos" },
  { key: "finance", label: "Finanzas" },
  { key: "salary", label: "Salarios" },
  { key: "settings", label: "Configuración" },
  { key: "users", label: "Usuarios" },
] as const;

export const PERMISSION_ACTIONS = [
  { key: "view", label: "Ver" },
  { key: "edit", label: "Editar" },
] as const;

export function permissionKey(module: string, action: string) {
  return `${module}.${action}`;
}

export function allPermissions(): string[] {
  return PERMISSION_MODULES.flatMap((m) =>
    PERMISSION_ACTIONS.map((a) => permissionKey(m.key, a.key)),
  );
}

export function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}
