import { z } from "zod";

export const employeeSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(2, "Nombre muy corto"),
  defaultWorkType: z.enum(["project", "work", "mixed", "week"]).default("mixed"),
});

export const paymentAccountSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Nombre muy corto"),
  description: z.string().trim().max(200).optional().or(z.literal("")),
});

export const taskTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Nombre muy corto"),
  moduleType: z.enum(["project", "work", "general"]).default("general"),
});

export const profileNameSchema = z.object({
  fullName: z.string().trim().min(2, "Nombre muy corto"),
});

export const passwordSchema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden",
  });
