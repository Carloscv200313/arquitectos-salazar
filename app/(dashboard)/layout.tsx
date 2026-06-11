import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { getCurrentAppUser } from "@/features/auth/get-user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentAppUser();
  const permissions = user ? user.permissions : null;
  const name = user?.fullName ?? "Administrador";
  const subtitle = user?.roleName ?? "Cuenta interna";

  return (
    <div className="min-h-screen">
      <Sidebar permissions={permissions} name={name} subtitle={subtitle} />
      <div className="lg:pl-64">
        <Header permissions={permissions} name={name} subtitle={subtitle} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
