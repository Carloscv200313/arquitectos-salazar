import { z } from "zod";

export const loginSchema = z.object({
  // Acepta usuario o correo (ej. "admin" o "admin@empresa.com").
  email: z.string().trim().min(1, "Ingresa tu usuario"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export type LoginInput = z.infer<typeof loginSchema>;
