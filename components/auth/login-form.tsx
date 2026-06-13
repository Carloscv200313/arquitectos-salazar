"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { signInAction } from "@/features/auth/actions";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signInAction({ email, password });
      if (result.ok) {
        const redirectTo = params.get("redirect") || "/dashboard";
        router.replace(redirectTo);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-7">
      <div className="grid gap-2">
        <label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Usuario
        </label>
        <input
          id="email"
          type="text"
          autoComplete="username"
          placeholder="Usuario"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border-0 border-b border-border bg-transparent px-0 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-brand"
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Contraseña
          </label>
          <button
            type="button"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => toast.info("Solicita al administrador restablecer tu contraseña.")}
          >
            ¿Olvidó su contraseña?
          </button>
        </div>
        <div className="relative">
          <input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border-0 border-b border-border bg-transparent px-0 py-2 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-brand"
          />
          <button
            type="button"
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setShow((s) => !s)}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-semibold uppercase tracking-[0.15em] text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-60"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Ingresar
      </button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Nuevo en el estudio?{" "}
        <button
          type="button"
          className="font-semibold text-brand-foreground hover:underline"
          onClick={() => toast.info("Contacta al administrador para solicitar acceso.")}
        >
          Solicitar Acceso
        </button>
      </p>
    </form>
  );
}
