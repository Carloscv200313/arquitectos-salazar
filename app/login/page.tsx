import { Suspense } from "react";
import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Iniciar sesión · Arquitectos Salazar" };

export default function LoginPage() {
  const year = new Date().getFullYear();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left — image */}
      <div className="relative hidden lg:block">
        <Image
          src="/fondo-logo.jpg"
          alt="Arquitectura Salazar"
          fill
          priority
          className="object-cover"
          sizes="50vw"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-black/20" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-white/80">
            Arquitectos Salazar
          </p>
          <h2 className="mt-4 font-serif text-4xl leading-[1.1] xl:text-5xl">
            Proyectando
            <br />
            el futuro.
          </h2>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex min-h-screen flex-col bg-background px-6 py-10 sm:px-12 lg:px-16 xl:px-24">
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="font-serif text-4xl tracking-tight">Bienvenido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Inicie sesión para acceder al portal de gestión.
            </p>

            <div className="mt-10">
              <Suspense fallback={<div className="h-72" />}>
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </div>

        <footer className="mx-auto flex w-full max-w-sm items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>© {year} Arquitectos Salazar</span>
          <span className="flex gap-5">
            <span className="cursor-default transition-colors hover:text-foreground">Términos</span>
            <span className="cursor-default transition-colors hover:text-foreground">Privacidad</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
