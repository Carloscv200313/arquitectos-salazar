"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { listWorks, getWork } from "@/lib/data/works";
import { createWorkOrder } from "@/lib/data/orders";

// Public, unauthenticated endpoint. Narrow on purpose:
//  - read: only minimal obra fields needed to pick one.
//  - write: create a "pedido" (work order) ONLY. No quotes, payments, edits or deletes.

export interface WorkHit {
  id: string;
  name: string;
  clientName: string;
}

export async function searchWorks(query: string): Promise<WorkHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const works = await listWorks();
  return works
    .filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.client.name.toLowerCase().includes(q) ||
        (w.address?.toLowerCase().includes(q) ?? false),
    )
    .slice(0, 20)
    .map((w) => ({ id: w.id, name: w.name, clientName: w.client.name }));
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .refine((d) => !Number.isNaN(new Date(d).getTime()), "Fecha inválida");

const publicOrderSchema = z.object({
  workId: z.string().uuid("Obra inválida"),
  orderDate: isoDate,
  supplier: z.string().trim().min(2, "Selecciona proveedor").max(80, "Máximo 80 caracteres"),
  material: z.string().trim().min(2, "Ingresa el material").max(1000, "Máximo 1000 caracteres"),
  description: z.string().trim().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
});

export type PublicOrderResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function registerPublicOrder(raw: unknown): Promise<PublicOrderResult> {
  const parsed = publicOrderSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Revisa los datos del pedido.", fieldErrors };
  }
  const d = parsed.data;

  try {
    const work = await getWork(d.workId);
    if (!work) return { ok: false, error: "Obra no encontrada." };

    await createWorkOrder({
      workId: d.workId,
      orderDate: d.orderDate,
      supplier: d.supplier,
      material: d.material,
      description: d.description || undefined,
      userId: null,
    });
    revalidatePath("/pedidos");
    revalidatePath(`/pedidos/${d.workId}`);
    revalidatePath(`/obras/${d.workId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo registrar el pedido. Intenta nuevamente." };
  }
}
