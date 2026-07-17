"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, PenLine, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { montoEnPalabras, RECEIPT_BUSINESS, type ReceiptData } from "@/lib/receipt";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";

type SignResult = { ok: true } | { ok: false; error: string };

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function parseDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return {
    day: d || "",
    month: m ? MESES[m - 1] : "",
    yearShort: y ? String(y).slice(-2) : "",
  };
}

export function ReceiptDocument({
  data,
  autoPrint = true,
  signAction,
  signPayload,
}: {
  data: ReceiptData;
  autoPrint?: boolean;
  // Acción que persiste la firma + identificadores del documento (sin la firma).
  signAction?: (raw: unknown) => Promise<SignResult>;
  signPayload?: Record<string, unknown>;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<SignaturePadHandle>(null);
  const [downloading, setDownloading] = useState(false);
  const [signature, setSignature] = useState<string | null>(data.signature);
  const [saving, setSaving] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const signed = !!signature;
  // Documento visible: ya firmado, o el usuario eligió omitir la firma.
  const visible = signed || skipped;

  useEffect(() => {
    // Solo auto-imprime si ya está firmado.
    if (!autoPrint || !signed) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [autoPrint, signed]);

  async function saveSignature() {
    if (!padRef.current || !signAction) return;
    if (padRef.current.isEmpty()) {
      toast.error("Dibuja la firma antes de guardar.");
      return;
    }
    const dataUrl = padRef.current.toDataURL();
    setSaving(true);
    try {
      const res = await signAction({ ...(signPayload ?? {}), signature: dataUrl });
      if (res.ok) {
        setSignature(dataUrl);
        toast.success("Firma guardada. Ya puedes imprimir el documento.");
      } else {
        toast.error(res.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const [{ domToCanvas }, { default: jsPDF }] = await Promise.all([
        import("modern-screenshot"),
        import("jspdf"),
      ]);
      const canvas = await domToCanvas(cardRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 12;
      const availW = pageW - margin * 2;
      const imgH = (canvas.height / canvas.width) * availW;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, availW, imgH);
      pdf.save(`recibo-${data.code ?? "documento"}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  const { day, month, yearShort } = parseDate(data.date);

  const isPago = data.docType === "pago";
  const title = isPago ? "COMPROBANTE DE PAGO POR" : "RECIBO DE DINERO POR";
  const recipientLabel = isPago ? "Recibió el Sr (a)" : "Recibí del Sr (a)";
  const subjectLabel = data.kind === "obra" ? "de la obra" : "del proyecto";
  const showSubject = !isPago || !!data.subjectName?.trim();

  return (
    <>
      <style>{`
        /* margin 0 = el navegador no imprime fecha/título/URL en encabezado y pie */
        @page { size: A4 portrait; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          .receipt-sheet { padding: 8mm !important; }
          .receipt-card {
            min-height: calc(297mm - 16mm) !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="receipt-sheet mx-auto w-full max-w-[820px] px-3 py-6 sm:px-4 sm:py-8">
        {/* Sin firma: SOLO la pizarra. El documento aparece al guardar u omitir. */}
        {!visible ? (
          <div className="no-print mx-auto max-w-md rounded-xl border border-amber-300 bg-amber-50 p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
              <PenLine className="size-4" />
              Firma requerida para {data.clientName || "el titular"}
            </div>
            <p className="mb-4 text-xs text-amber-800">
              {isPago
                ? "Si el empleado no está presente, deja el comprobante pendiente: se podrá firmar e imprimir después."
                : "Dibuja la firma para guardarla. El documento se mostrará al terminar."}
            </p>
            <SignaturePad ref={padRef} />
            <button
              type="button"
              onClick={saveSignature}
              disabled={saving || !signAction}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
              Guardar firma e imprimir
            </button>
            <button
              type="button"
              onClick={() => setSkipped(true)}
              disabled={saving}
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-amber-900 underline-offset-2 hover:underline disabled:opacity-60"
            >
              Omitir e imprimir sin firma
            </button>
          </div>
        ) : (
          <>
            <div className="no-print mb-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={downloadPdf}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
              >
                {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Descargar PDF
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                <Printer className="size-4" /> Imprimir
              </button>
            </div>

            {/* Hoja A4: proporción carta vertical, contenido distribuido arriba/abajo */}
            <div
              ref={cardRef}
              className="receipt-card relative flex aspect-210/297 w-full flex-col overflow-hidden rounded-[28px] border border-neutral-200 bg-white p-[clamp(1.25rem,5vw,3rem)] text-neutral-800 shadow-[0_12px_45px_rgba(0,0,0,0.14)]"
            >
          {/* Marca de agua centrada */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <img
              src="/logo-negro-trimmed.png"
              alt=""
              aria-hidden="true"
              className="w-[68%] max-w-115 object-contain opacity-[0.05]"
            />
          </div>

          {/* Contenido (sobre la marca de agua) */}
          <div className="relative z-10 flex h-full flex-col">
            {/* Encabezado: código + título + monto, en una sola fila */}
            <div className="flex flex-nowrap items-center gap-[clamp(0.5rem,2vw,1rem)]">
              <span className="shrink-0 whitespace-nowrap rounded-full border-2 border-red-300 px-[clamp(0.6rem,2vw,1rem)] py-1 text-[clamp(0.65rem,2.6vw,1.05rem)] font-bold tracking-wider text-red-600">
                {data.code ?? "—"}
              </span>
              <span className="shrink-0 whitespace-nowrap text-[clamp(0.78rem,3.1vw,1.2rem)] font-bold tracking-tight">
                {title}
              </span>
              <span className="ml-auto shrink-0 whitespace-nowrap rounded-md bg-neutral-100 px-[clamp(0.6rem,2vw,1.25rem)] py-1 text-[clamp(0.95rem,3.4vw,1.5rem)] font-bold tabular-nums">
                {formatCurrency(data.amount)}
              </span>
            </div>

            <div className="mt-[clamp(1.5rem,5vw,2.75rem)] space-y-[clamp(1.1rem,3.4vw,1.75rem)] text-[clamp(0.8rem,2.7vw,1.125rem)]">
              <Field label={recipientLabel} value={data.clientName} />
              <Field
                label="la cantidad de"
                value={`${formatCurrency(data.amount)} (${montoEnPalabras(data.amount)})`}
              />
              <Field label="por concepto de" value={data.concept} />
              {showSubject ? <Field label={subjectLabel} value={data.subjectName ?? ""} /> : null}

              {/* Fecha */}
              <div className="flex items-end gap-[clamp(0.4rem,1.5vw,0.5rem)] pt-[clamp(0.25rem,1vw,0.5rem)]">
                <span>a</span>
                <span className="min-w-[clamp(2.5rem,8vw,3rem)] border-b border-neutral-400 px-2 text-center font-medium">
                  {day}
                </span>
                <span>de</span>
                <span className="min-w-[clamp(5rem,18vw,8rem)] border-b border-neutral-400 px-2 text-center font-medium capitalize">
                  {month}
                </span>
                <span>20</span>
                <span className="min-w-[clamp(2rem,7vw,2.5rem)] border-b border-neutral-400 px-2 text-center font-medium">
                  {yearShort}
                </span>
                <span>.</span>
              </div>
            </div>

            {/* Firma centrada en el espacio en blanco entre datos y pie */}
            <div className="flex flex-1 items-center justify-center">
              <div className="flex w-[clamp(14rem,60%,22rem)] flex-col items-center">
                {signature ? (
                  <img
                    src={signature}
                    alt="Firma"
                    className="mb-[-0.6rem] h-[clamp(5rem,20vw,9rem)] w-auto max-w-full bg-white object-contain"
                  />
                ) : null}
                <div className="w-full border-t border-neutral-500" />
                <span className="mt-1 text-[clamp(0.5rem,1.9vw,0.8rem)] text-neutral-500">Firma</span>
              </div>
            </div>

            {/* Pie: logo izquierda · datos derecha */}
            <div className="flex items-end justify-between gap-[clamp(0.75rem,3vw,2rem)] pt-[clamp(1.5rem,5vw,3rem)]">
              <img
                src="/logo-negro-trimmed.png"
                alt="Arquitectos Salazar"
                className="h-[clamp(2.25rem,8vw,4.25rem)] w-auto shrink-0 object-contain"
              />
              <div className="whitespace-nowrap text-right text-[clamp(0.5rem,1.9vw,0.875rem)] leading-relaxed text-neutral-600">
                <p>{RECEIPT_BUSINESS.address}</p>
                <p>{RECEIPT_BUSINESS.phone}</p>
                <p>{RECEIPT_BUSINESS.email}</p>
              </div>
            </div>
          </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-end gap-[clamp(0.5rem,2vw,0.75rem)]">
      <span className="shrink-0 text-neutral-700">{label}</span>
      <span className="min-w-0 flex-1 wrap-break-word border-b border-neutral-400 px-2 pb-1 font-medium">
        {value}
      </span>
    </div>
  );
}
