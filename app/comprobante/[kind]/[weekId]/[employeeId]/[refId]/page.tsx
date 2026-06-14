import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSalaryReceipt } from "@/lib/data/finance";
import { ReceiptDocument } from "@/components/receipt/receipt-document";

export const metadata: Metadata = {
  title: "Comprobante de pago",
  robots: { index: false, follow: false },
};

export default async function SalaryReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; weekId: string; employeeId: string; refId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { kind, weekId, employeeId, refId } = await params;
  const { preview } = await searchParams;
  if (kind !== "proyecto" && kind !== "obra") notFound();

  const refType = kind === "proyecto" ? "project" : "work";
  const data = await getSalaryReceipt(weekId, employeeId, refType, refId);
  if (!data) notFound();

  return <ReceiptDocument data={data} autoPrint={preview !== "1"} />;
}
