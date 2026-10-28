import { authorizeDocument, receiptResource } from "@/lib/security/documents";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectPaymentReceipt } from "@/lib/data/projects";
import { getWorkMovementReceipt } from "@/lib/data/works";
import { ReceiptDocument } from "@/components/receipt/receipt-document";
import { resetReceiptSignatureAction, signAbonoAction } from "@/app/recibo/signature-actions";
import { getCurrentAppUser } from "@/features/auth/get-user";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Recibo de dinero",
  robots: { index: false, follow: false },
};

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { kind, id } = await params;
  if (kind !== "proyecto" && kind !== "obra") notFound();

  const token = await authorizeDocument(receiptResource(kind, id), kind === "proyecto" ? "projects.view" : "works.view", (await searchParams).token);

  const data =
    kind === "proyecto"
      ? await getProjectPaymentReceipt(id)
      : await getWorkMovementReceipt(id);
  if (!data) notFound();
  const user = data.signature ? await getCurrentAppUser() : null;
  const canResetSignature = Boolean(user && hasPermission(user.permissions, kind === "proyecto" ? "projects.edit" : "works.edit"));

  return (
    <ReceiptDocument
      data={data}
      signAction={signAbonoAction}
      signPayload={{ kind, id, token }}
      resetSignatureAction={canResetSignature ? resetReceiptSignatureAction : undefined}
    />
  );
}
