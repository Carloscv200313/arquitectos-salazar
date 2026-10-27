"use server";
import { issueDocumentToken } from "@/lib/security/document-token";
import { receiptResource } from "@/lib/security/documents";
import { searchPublicEntities } from "@/lib/data/public-search";
import { limitPublicRequest } from "@/lib/security/rate-limit";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPublicProjectPending, registerMovement } from "@/lib/data/projects";
import { activeWorkExists, registerWorkMovement } from "@/lib/data/works";
import { WORK_INCOME_CATEGORY } from "@/lib/constants";
import { hasMaxTwoDecimals, round2 } from "@/lib/calculations";

// Public, unauthenticated endpoint. Intentionally narrow:
//  - read: only minimal fields needed to pick a project/obra.
//  - write: income ("abono") ONLY, never expense / edit / delete.
//  - projects: amount capped to the outstanding balance.

export type PayableKind = "project" | "work";

export interface PayableHit {
  kind: PayableKind;
  id: string;
  name: string;
  clientName: string;
  address: string | null;
  // Outstanding balance to collect. null = ledger (obras) with no fixed total.
  pending: number | null;
}

export async function searchPayables(query: string): Promise<PayableHit[]> {
  await limitPublicRequest("search-payables");
  const [projects, works] = await Promise.all([searchPublicEntities("projects", query), searchPublicEntities("works", query)]);
  return [...projects.map(p => ({ ...p, kind: "project" as const })), ...works.map(w => ({ ...w, kind: "work" as const }))].slice(0, 20);

}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .refine((d) => !Number.isNaN(new Date(d).getTime()), "Fecha inválida");

const publicAbonoSchema = z.object({
  kind: z.enum(["project", "work"]),
  id: z.string().uuid("Identificador inválido"),
  amount: z
    .number()
    .positive("Ingresa un monto válido")
    .max(1_000_000_000, "Monto demasiado alto")
    .refine(hasMaxTwoDecimals, "Máximo 2 decimales"),
  concept: z.string().trim().min(2, "Ingresa un concepto").max(160, "Máximo 160 caracteres"),
  paymentMethodId: z.string().uuid("Selecciona forma de pago"),
  paymentDate: isoDate,
});

export type PublicAbonoResult =
  | { ok: true; receiptKind: "proyecto" | "obra"; receiptId: string; receiptToken: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function registerPublicAbono(raw: unknown): Promise<PublicAbonoResult> {
  await limitPublicRequest("create-abono", 10);
  const parsed = publicAbonoSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Revisa los datos del abono.", fieldErrors };
  }
  const d = parsed.data;

  try {
    if (d.kind === "project") {
      const pending = await getPublicProjectPending(d.id);
      if (pending === null) return { ok: false, error: "Proyecto no encontrado." };
      // Income cannot exceed what's left to collect.
      if (d.amount > pending + 0.001) {
        return {
          ok: false,
          error: `El abono supera el saldo pendiente (${pending.toFixed(2)}).`,
          fieldErrors: { amount: "Supera el saldo pendiente" },
        };
      }
      const created = await registerMovement({
        projectId: d.id,
        movementType: "income",
        concept: d.concept,
        amount: d.amount,
        paymentDate: d.paymentDate,
        paymentMethodId: d.paymentMethodId,
        internalArea: null,
        userId: null,
      });
      revalidatePath("/projects");
      revalidatePath(`/projects/${d.id}`);
      return { ok: true, receiptKind: "proyecto", receiptId: created.id, receiptToken: issueDocumentToken(receiptResource("proyecto", created.id)) };
    }

    // kind === "work" — ledger, no fixed total to cap against.
    if (!(await activeWorkExists(d.id))) return { ok: false, error: "Obra no encontrada." };
    const created = await registerWorkMovement({
      workId: d.id,
      receipt: "", // income auto-genera código OBR
      movementDate: d.paymentDate,
      concept: d.concept,
      supplier: "Cliente",
      category: WORK_INCOME_CATEGORY,
      movementType: "income",
      amount: round2(d.amount),
      paymentMethodId: d.paymentMethodId,
      observations: "Registrado desde enlace público de abonos",
      userId: null,
    });
    revalidatePath("/obras");
    revalidatePath(`/obras/${d.id}`);
    return { ok: true, receiptKind: "obra", receiptId: created.id, receiptToken: issueDocumentToken(receiptResource("obra", created.id)) };
  } catch {
    return { ok: false, error: "No se pudo registrar el abono. Intenta nuevamente." };
  }
}
