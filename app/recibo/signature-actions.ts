"use server";
import { authorizeDocument, receiptResource, salaryResource, validPngSignature } from "@/lib/security/documents";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { setProjectPaymentSignature } from "@/lib/data/projects";
import { setWorkMovementSignature } from "@/lib/data/works";
import { setSalaryReceiptSignature, issueSalaryReceipt } from "@/lib/data/finance";

export type SignResult = { ok: true } | { ok: false; error: string };

// Una firma es un data URL PNG. Limitamos tamaño para evitar payloads enormes.
const signature = z
  .string()
  .min(100, "Firma inválida")
  .max(600_000, "Firma demasiado grande")
  .refine(validPngSignature, "Firma PNG inválida");

const abonoSchema = z.object({
  kind: z.enum(["proyecto", "obra"]),
  id: z.string().uuid("Documento inválido"),
  signature,
  token: z.string().max(2048).optional(),
});

/** Firma un recibo o comprobante de movimiento (proyecto u obra). */
export async function signAbonoAction(raw: unknown): Promise<SignResult> {
  const parsed = abonoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { kind, id, signature: sig } = parsed.data;
  try {
    await authorizeDocument(receiptResource(kind, id), kind === "proyecto" ? "projects.edit" : "works.edit", parsed.data.token);
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
  token: z.string().max(2048).optional(),
});

/** Firma un comprobante de pago a empleado. */
export async function signPagoAction(raw: unknown): Promise<SignResult> {
  const parsed = pagoSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { kind, weekId, employeeId, refId, signature: sig } = parsed.data;

  try {
    await authorizeDocument(salaryResource(weekId, employeeId), "salary.edit", parsed.data.token);
    await setSalaryReceiptSignature(weekId, employeeId, "project", weekId, sig);
    revalidatePath(`/comprobante/${kind}/${weekId}/${employeeId}/${refId}`);
    revalidatePath(`/firma/comprobante/${kind}/${weekId}/${employeeId}/${refId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo guardar la firma." };
  }
}

const issueSchema = z.object({ weekId: z.string().uuid(), employeeId: z.string().uuid(), token: z.string().max(2048).optional() });

/** Explicit user operation; rendering a document never creates database rows. */
export async function issueSalaryReceiptAction(raw: unknown): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const parsed = issueSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Comprobante inválido." };
  try {
    const { weekId, employeeId, token } = parsed.data;
    await authorizeDocument(salaryResource(weekId, employeeId), "salary.view", token);
    const receipt = await issueSalaryReceipt(weekId, employeeId);
    return { ok: true, code: receipt.code };
  } catch { return { ok: false, error: "No se pudo emitir el comprobante." }; }
}
