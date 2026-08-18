"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";

type SignResult = { ok: true } | { ok: false; error: string };

export function PublicSignatureForm({
  title,
  subtitle,
  alreadySigned,
  signAction,
  signPayload,
}: {
  title: string;
  subtitle: string;
  alreadySigned: boolean;
  signAction: (raw: unknown) => Promise<SignResult>;
  signPayload: Record<string, unknown>;
}) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [saved, setSaved] = useState(alreadySigned);
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!padRef.current) return;
    if (padRef.current.isEmpty()) {
      toast.error("Dibuja la firma antes de confirmar.");
      return;
    }
    const signature = padRef.current.toDataURL();
    startTransition(async () => {
      const result = await signAction({ ...signPayload, signature });
      if (result.ok) {
        setSaved(true);
        toast.success("Firma confirmada");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-8">
      <section className="w-full max-w-xl rounded-2xl border bg-background p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand-foreground">
            {saved ? <CheckCircle2 className="size-5" /> : <PenLine className="size-5" />}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        {saved ? (
          <div className="rounded-xl border border-brand/30 bg-brand-muted/60 p-5 text-sm text-brand-foreground">
            <p className="font-semibold">Firma guardada correctamente.</p>
            <p className="mt-1 text-brand-foreground/80">
              Ya puedes cerrar esta ventana. El comprobante interno mostrará la firma al refrescar.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <SignaturePad ref={padRef} />
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-60"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Confirmar firma
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
