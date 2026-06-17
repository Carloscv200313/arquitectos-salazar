import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectPaymentReceipt } from "@/lib/data/projects";
import { getWorkMovementReceipt } from "@/lib/data/works";
import { ReceiptDocument } from "@/components/receipt/receipt-document";
import { signAbonoAction } from "@/app/recibo/signature-actions";

export const metadata: Metadata = {
  title: "Recibo de dinero",
  robots: { index: false, follow: false },
};

export default async function ReceiptPage({
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
    <ReceiptDocument
      data={data}
      signAction={signAbonoAction}
      signPayload={{ kind, id }}
    />
  );
}
