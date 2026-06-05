"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AppBrand } from "./app-brand";
import { SidebarNav } from "./sidebar-nav";
import { UserChip } from "./user-chip";

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md lg:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={<Button variant="outline" size="icon" className="lg:hidden" />}
        >
          <Menu className="size-5" />
          <span className="sr-only">Abrir menú</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="h-16 justify-center border-b px-5">
            <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
            <AppBrand />
          </SheetHeader>
          <SidebarNav onNavigate={() => setOpen(false)} />
          <div className="border-t p-3">
            <UserChip />
          </div>
        </SheetContent>
      </Sheet>

      <AppBrand className="lg:hidden" />

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">Arquitectos Salazar</p>
          <p className="text-xs text-muted-foreground">Gestión de proyectos</p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-full bg-brand-muted text-sm font-semibold text-brand-foreground">
          AS
        </div>
      </div>
    </header>
  );
}
