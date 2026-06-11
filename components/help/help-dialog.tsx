"use client";

import { useState } from "react";
import { LifeBuoy, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getHelpItemsAction } from "@/features/settings/actions";
import type { HelpItem } from "@/services/config.service";
import { cn } from "@/lib/utils";

// Fallback content so Ayuda is useful even before Supabase has data.
const FALLBACK: HelpItem[] = [
  {
    id: "f1",
    section: "General",
    order_index: 1,
    title: "¿Qué es Arquitectos Salazar?",
    content:
      "Sistema interno para gestionar proyectos, obras, pedidos, finanzas y salarios del estudio.",
  },
  {
    id: "f2",
    section: "Proyectos",
    order_index: 2,
    title: "Crear un proyecto",
    content:
      "Proyectos → Nuevo proyecto. Elige plantilla (Diamante/Oro/Especial), cliente, monto y adicionales. La distribución interna se calcula sola.",
  },
  {
    id: "f3",
    section: "Finanzas",
    order_index: 3,
    title: "Registrar un abono",
    content:
      "Abre un proyecto u obra y usa Registrar movimiento. Elige la cuenta de pago y el monto; el saldo se actualiza solo.",
  },
  {
    id: "f4",
    section: "Salarios",
    order_index: 4,
    title: "Módulo de salarios",
    content:
      "Crea una semana, asigna actividades por día y registra pagos por empleado. Un pago parcial basta para cerrar; no se permite dejar un trabajo sin reconocer.",
  },
  {
    id: "f5",
    section: "General",
    order_index: 5,
    title: "Estados del sistema",
    content:
      "Eliminación lógica: status = 1 activo, status = 0 oculto. Nada se borra físicamente.",
  },
];

export function HelpNavButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HelpItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen(next: boolean) {
    setOpen(next);
    if (next && items === null) {
      setLoading(true);
      try {
        const data = await getHelpItemsAction();
        setItems(data.length > 0 ? data : FALLBACK);
      } catch {
        setItems(FALLBACK);
      } finally {
        setLoading(false);
      }
    }
  }

  const grouped = (items ?? FALLBACK).reduce<Record<string, HelpItem[]>>((acc, item) => {
    (acc[item.section] ??= []).push(item);
    return acc;
  }, {});

  return (
    <>
      <button type="button" onClick={() => handleOpen(true)} className={className}>
        <LifeBuoy className="size-4.5 shrink-0" />
        Ayuda
      </button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Centro de ayuda</DialogTitle>
            <DialogDescription>Guía rápida y preguntas frecuentes del sistema.</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-5 py-2">
              {Object.entries(grouped).map(([section, sectionItems]) => (
                <div key={section} className="grid gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {section}
                  </p>
                  {sectionItems.map((item) => (
                    <div key={item.id} className="rounded-xl border bg-card p-3">
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.content}</p>
                    </div>
                  ))}
                </div>
              ))}

              <div className="rounded-xl border border-brand/30 bg-brand/5 p-3 text-sm">
                <p className="font-medium text-brand-foreground">Soporte interno</p>
                <p className="mt-1 text-muted-foreground">
                  ¿Dudas o errores? Contacta al administrador del sistema.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export const HELP_NAV_CLASS = cn(
  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
);
