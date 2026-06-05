import Image from "next/image";
import { cn } from "@/lib/utils";

export function AppBrand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand shadow-sm ring-2 ring-brand-foreground/10">
        <Image
          src="/logo-arquitectos-salazar-transparent.png"
          alt="Logo Arquitectos Salazar"
          width={36}
          height={36}
          className="size-8 object-contain"
        />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight text-foreground">Arquitectos</p>
        <p className="-mt-0.5 text-[11px] font-medium text-brand-foreground/80">
          Salazar
        </p>
      </div>
    </div>
  );
}
