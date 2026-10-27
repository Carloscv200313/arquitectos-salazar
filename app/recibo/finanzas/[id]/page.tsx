import { requirePermission } from "@/lib/auth/authorize";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReceiptDocument } from "@/components/receipt/receipt-document";
import { getFinanceCaptureReceipt } from "@/lib/data/finance";

export const metadata: Metadata = {
  title: "Comprobante de movimiento",
  robots: { index: false, follow: false },
};

export default async function FinanceReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("finance.view");
  const { id } = await params;
  const data = await getFinanceCaptureReceipt(id);
  if (!data) notFound();

  return <ReceiptDocument data={data} autoPrint={false} />;
}
