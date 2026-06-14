"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { montoEnPalabras, RECEIPT_BUSINESS, type ReceiptData } from "@/lib/receipt";

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

export function ReceiptDocument({ data, autoPrint = true }: { data: ReceiptData; autoPrint?: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!autoPrint) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [autoPrint]);

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

  return (
    <>
      <style>{`
        /* margin 0 = el navegador no imprime fecha/título/URL en encabezado y pie */
        @page { size: A4 portrait; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          .receipt-sheet { padding: 18mm !important; }
        }
      `}</style>

      <div className="receipt-sheet mx-auto w-full max-w-[820px] px-3 py-6 sm:px-4 sm:py-8">
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

        <div
          ref={cardRef}
          className="rounded-[28px] border-2 border-neutral-300 bg-white p-[clamp(1rem,4vw,2rem)] text-neutral-800"
        >
          {/* Encabezado: código + título + monto, en una sola fila */}
          <div className="flex flex-nowrap items-center gap-[clamp(0.5rem,2vw,1rem)]">
            <span className="shrink-0 whitespace-nowrap rounded-full border-2 border-neutral-300 px-[clamp(0.6rem,2vw,1rem)] py-1 text-[clamp(0.65rem,2.6vw,1.05rem)] font-bold tracking-wider text-red-600">
              {data.code ?? "—"}
            </span>
            <span className="shrink-0 whitespace-nowrap text-[clamp(0.78rem,3.1vw,1.2rem)] font-semibold tracking-tight">
              {title}
            </span>
            <span className="ml-auto shrink-0 whitespace-nowrap rounded-md bg-neutral-100 px-[clamp(0.6rem,2vw,1.25rem)] py-1 text-[clamp(0.95rem,3.4vw,1.5rem)] font-bold tabular-nums">
              {formatCurrency(data.amount)}
            </span>
          </div>

          <div className="mt-[clamp(1.25rem,4vw,2rem)] space-y-[clamp(1rem,3vw,1.5rem)] text-[clamp(0.8rem,2.7vw,1.125rem)]">
            <Field label={recipientLabel} value={data.clientName} />
            <Field
              label="la cantidad de"
              value={`${formatCurrency(data.amount)} (${montoEnPalabras(data.amount)})`}
            />
            <Field label="por concepto de" value={data.concept} />
            {isPago && <Field label={subjectLabel} value={data.subjectName} />}
          </div>

          {/* Fecha */}
          <div className="mt-[clamp(1.25rem,4vw,2rem)] flex items-end gap-[clamp(0.4rem,1.5vw,0.5rem)] text-[clamp(0.8rem,2.7vw,1.125rem)]">
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

          {/* Pie: 3 columnas — logo · datos · firma */}
          <div className="mt-[clamp(1.5rem,5vw,3rem)] grid grid-cols-3 items-end gap-[clamp(0.5rem,2vw,1.5rem)]">
            <img
              src="/logo-negro-trimmed.png"
              alt="Arquitectos Salazar"
              className="h-[clamp(2.5rem,9vw,5rem)] w-auto object-contain"
            />
            <div className="whitespace-nowrap text-center text-[clamp(0.5rem,1.9vw,0.875rem)] leading-relaxed text-neutral-600">
              <p>{RECEIPT_BUSINESS.address}</p>
              <p>{RECEIPT_BUSINESS.phone}</p>
              <p>{RECEIPT_BUSINESS.email}</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="mt-8 w-full border-t border-neutral-500" />
              <span className="mt-1 text-[clamp(0.5rem,1.9vw,0.75rem)] text-neutral-500">Firma</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-end gap-[clamp(0.5rem,2vw,0.75rem)]">
      <span className="shrink-0 text-neutral-700">{label}</span>
      <span className="min-w-0 flex-1 break-words border-b border-neutral-400 px-2 pb-1 font-medium">
        {value}
      </span>
    </div>
  );
}
