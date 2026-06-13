import type { Metadata } from "next";
import { PublicOrderForm } from "@/components/public/public-order-form";
import { listProviderNames } from "@/services/config.service";

export const metadata: Metadata = {
  title: "Registrar pedido",
  robots: { index: false, follow: false },
};

export default async function PublicOrderPage() {
  const providers = await listProviderNames();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-6 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Registrar pedido</h1>
        <p className="text-sm text-muted-foreground">
          Busca la obra y registra el pedido de materiales.
        </p>
      </header>
      <PublicOrderForm providers={providers} />
    </main>
  );
}
