import "server-only";

import { getCurrentAppUser } from "@/features/auth/get-user";
import { ALL_ACCESS_ROLES, hasPermission } from "./permissions";

export class AccessDeniedError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? "Sesión no válida. Inicia sesión nuevamente." : "No tienes permiso para esta operación.");
    this.name = "AccessDeniedError";
  }
}

/** Always resolves an active database user. Never trusts the role in the cookie. */
export async function requireUser() {
  const user = await getCurrentAppUser();
  if (!user) throw new AccessDeniedError(401);
  return user;
}

export async function requirePermission(permission: string) {
  const user = await requireUser();
  if (!hasPermission(user.permissions, permission)) throw new AccessDeniedError(403);
  return user;
}

export async function requireAdministrator() {
  const user = await requirePermission("users.edit");
  if (!(ALL_ACCESS_ROLES as readonly string[]).includes(user.roleName ?? "")) {
    throw new AccessDeniedError(403);
  }
  return user;
}
