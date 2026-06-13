import type { Metadata } from "next";
import { listPaymentMethods } from "@/lib/data/projects";
import { PublicAbonoForm } from "@/components/public/public-abono-form";

export const metadata: Metadata = {
  title: "Registrar abono",
  robots: { index: false, follow: false },
};

export default async function PublicAbonoPage() {
  const methods = await listPaymentMethods();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-6 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Registrar abono</h1>
        <p className="text-sm text-muted-foreground">
          Busca la obra o el proyecto y registra el abono. Solo se registran ingresos.
        </p>
      </header>
      <PublicAbonoForm methods={methods} />
    </main>
  );
}
