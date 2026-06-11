import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  fullName: z.string().trim().min(2, "Nombre muy corto"),
  roleId: z.string().min(1, "Selecciona un rol"),
  permissions: z.array(z.string()).default([]),
});

export const updateUserSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().trim().min(2, "Nombre muy corto"),
  roleId: z.string().min(1, "Selecciona un rol"),
  permissions: z.array(z.string()).default([]),
});

export const setPasswordSchema = z.object({
  id: z.string().min(1),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});
