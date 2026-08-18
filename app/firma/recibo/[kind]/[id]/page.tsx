import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectPaymentReceipt } from "@/lib/data/projects";
import { getWorkMovementReceipt } from "@/lib/data/works";
import { PublicSignatureForm } from "@/components/receipt/public-signature-form";
import { signAbonoAction } from "@/app/recibo/signature-actions";

export const metadata: Metadata = {
  title: "Firma de recibo",
  robots: { index: false, follow: false },
};

export default async function PublicReceiptSignaturePage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (kind !== "proyecto" && kind !== "obra") notFound();

  const data =
    kind === "proyecto"
      ? await getProjectPaymentReceipt(id)
      : await getWorkMovementReceipt(id);
  if (!data) notFound();

  return (
    <PublicSignatureForm
      title={`Firma requerida para ${data.clientName || "el titular"}`}
      subtitle={`${data.code ?? "Recibo"} · ${data.subjectName ?? data.concept}`}
      alreadySigned={!!data.signature}
      signAction={signAbonoAction}
      signPayload={{ kind, id }}
    />
  );
}
