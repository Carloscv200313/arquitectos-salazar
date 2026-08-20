"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { listProjects, getProject, registerMovement } from "@/lib/data/projects";
import { listWorks, getWork, registerWorkMovement } from "@/lib/data/works";
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
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  // Fetch unfiltered, then match across name + client + address so the search
  // also works by the client's name (not just the project/obra name).
  const [projects, works] = await Promise.all([listProjects(), listWorks()]);

  const projectHits: PayableHit[] = projects
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.client.name.toLowerCase().includes(q) ||
        (p.address?.toLowerCase().includes(q) ?? false),
    )
    .map((p) => ({
      kind: "project",
      id: p.id,
      name: p.name,
      clientName: p.client.name,
      address: p.address ?? null,
      pending: p.finance.pending,
    }));

  const workHits: PayableHit[] = works
    .filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.client.name.toLowerCase().includes(q) ||
        (w.address?.toLowerCase().includes(q) ?? false),
    )
    .map((w) => ({
      kind: "work",
      id: w.id,
      name: w.name,
      clientName: w.client.name,
      address: w.address ?? null,
      pending: null,
    }));

  return [...projectHits, ...workHits].slice(0, 20);
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
  | { ok: true; receiptKind: "proyecto" | "obra"; receiptId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function registerPublicAbono(raw: unknown): Promise<PublicAbonoResult> {
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
      const project = await getProject(d.id);
      if (!project) return { ok: false, error: "Proyecto no encontrado." };
      // Income cannot exceed what's left to collect.
      if (d.amount > project.finance.pending + 0.001) {
        return {
          ok: false,
          error: `El abono supera el saldo pendiente (${project.finance.pending.toFixed(2)}).`,
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
      return { ok: true, receiptKind: "proyecto", receiptId: created.id };
    }

    // kind === "work" — ledger, no fixed total to cap against.
    const work = await getWork(d.id);
    if (!work) return { ok: false, error: "Obra no encontrada." };
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
    return { ok: true, receiptKind: "obra", receiptId: created.id };
  } catch {
    return { ok: false, error: "No se pudo registrar el abono. Intenta nuevamente." };
  }
}
