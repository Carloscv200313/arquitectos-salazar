import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { signPagoAction } from "@/app/recibo/signature-actions";
import { PublicSignatureForm } from "@/components/receipt/public-signature-form";
import { getSalaryReceipt } from "@/lib/data/finance";

export const metadata: Metadata = {
  title: "Firma de comprobante",
  robots: { index: false, follow: false },
};

export default async function PublicSalaryReceiptSignaturePage({
  params,
}: {
  params: Promise<{ kind: string; weekId: string; employeeId: string; refId: string }>;
}) {
  const { kind, weekId, employeeId, refId } = await params;
  if (kind !== "proyecto" && kind !== "obra") notFound();

  const refType = kind === "proyecto" ? "project" : "work";
  const data = await getSalaryReceipt(weekId, employeeId, refType, refId);
  if (!data) notFound();

  return (
    <PublicSignatureForm
      title={`Firma requerida para ${data.clientName || "el empleado"}`}
      subtitle={`${data.code ?? "Comprobante"} · ${data.concept}`}
      alreadySigned={!!data.signature}
      signAction={signPagoAction}
      signPayload={{ kind, weekId, employeeId, refId }}
    />
  );
}
