"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { setProjectPaymentSignature } from "@/lib/data/projects";
import { setWorkMovementSignature } from "@/lib/data/works";
import { setSalaryReceiptSignature } from "@/lib/data/finance";

export type SignResult = { ok: true } | { ok: false; error: string };

// Una firma es un data URL PNG. Limitamos tamaño para evitar payloads enormes.
const signature = z
  .string()
  .min(100, "Firma inválida")
  .max(600_000, "Firma demasiado grande")
  .refine((s) => s.startsWith("data:image/"), "Firma inválida");

const abonoSchema = z.object({
  kind: z.enum(["proyecto", "obra"]),
  id: z.string().uuid("Documento inválido"),
  signature,
});

/** Firma un recibo de abono (proyecto u obra). */
export async function signAbonoAction(raw: unknown): Promise<SignResult> {
  const parsed = abonoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { kind, id, signature: sig } = parsed.data;
  try {
    if (kind === "proyecto") await setProjectPaymentSignature(id, sig);
    else await setWorkMovementSignature(id, sig);
    revalidatePath(`/recibo/${kind}/${id}`);
    revalidatePath(`/firma/recibo/${kind}/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo guardar la firma." };
  }
}

const pagoSchema = z.object({
  kind: z.enum(["proyecto", "obra"]),
  weekId: z.string().uuid("Semana inválida"),
  employeeId: z.string().uuid("Empleado inválido"),
  refId: z.string().uuid("Referencia inválida"),
  signature,
});

/** Firma un comprobante de pago a empleado. */
export async function signPagoAction(raw: unknown): Promise<SignResult> {
  const parsed = pagoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { kind, weekId, employeeId, refId, signature: sig } = parsed.data;
  const refType = kind === "proyecto" ? "project" : "work";
  try {
    await setSalaryReceiptSignature(weekId, employeeId, refType, refId, sig);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo guardar la firma." };
  }
}
