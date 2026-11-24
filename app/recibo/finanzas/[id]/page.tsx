import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReceiptDocument } from "@/components/receipt/receipt-document";
import { getFinanceCaptureReceipt } from "@/lib/data/finance";
import { authorizeDocument, receiptResource } from "@/lib/security/documents";

export const metadata: Metadata = {
  title: "Comprobante de movimiento",
  robots: { index: false, follow: false },
};

export default async function FinanceReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const token = await authorizeDocument(
    receiptResource("finanzas", id),
    "finance.view",
    (await searchParams).token,
  );
  const data = await getFinanceCaptureReceipt(id);
  if (!data) notFound();

  return (
    <ReceiptDocument
      data={data}
      autoPrint={false}
      sharePath={token
        ? `/recibo/finanzas/${id}?token=${encodeURIComponent(token)}`
        : null}
    />
  );
}
