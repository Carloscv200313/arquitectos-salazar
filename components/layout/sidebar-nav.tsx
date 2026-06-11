"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpNavButton, HELP_NAV_CLASS } from "@/components/help/help-dialog";
import { NAV_SECTIONS } from "./nav-config";

export function SidebarNav({
  onNavigate,
  permissions = null,
}: {
  onNavigate?: () => void;
  permissions?: string[] | null;
}) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // null permissions = no restriction (admin / Supabase off).
  const allowed = (permission?: string) =>
    !permission || permissions === null || permissions.includes(permission);

  return (
    <nav className="flex flex-1 flex-col gap-6 px-3 py-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {section.title}
          </p>
          {section.items.map((item) => {
            const Icon = item.icon;
            if (item.label === "Ayuda") {
              return <HelpNavButton key={item.label} className={HELP_NAV_CLASS} />;
            }

            const hasActiveChild = item.children?.some(
              (child) => pathname === child.href || pathname.startsWith(child.href + "/"),
            );
            const active =
              !item.disabled &&
              ((item.href && (pathname === item.href || pathname.startsWith(item.href + "/"))) ||
                hasActiveChild);

            // Group with children (Finanzas) — parent always shown, children gated.
            if (item.groupOnly && item.children) {
              const open = openGroups[item.label] ?? !!hasActiveChild;
              return (
                <div key={item.label} className="mt-1 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((current) => ({
                        ...current,
                        [item.label]: !(current[item.label] ?? !!hasActiveChild),
                      }))
                    }
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                  >
                    <Icon className="size-4.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                  </button>
                  {open && (
                    <div className="ml-4 flex flex-col gap-1 border-l border-sidebar-border/80 pl-2">
                      {item.children.map((child) => {
                        const childAllowed = allowed(child.permission);
                        const ChildIcon = child.icon;
                        if (!childAllowed) {
                          return (
                            <span
                              key={child.href}
                              title="No tienes acceso a este módulo"
                              className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/40"
                            >
                              {ChildIcon && <ChildIcon className="size-4 shrink-0" />}
                              <span className="flex-1">{child.label}</span>
                              <Lock className="size-3.5" />
                            </span>
                          );
                        }
                        const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onNavigate}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                              childActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                            )}
                          >
                            {ChildIcon && <ChildIcon className="size-4 shrink-0" />}
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const itemAllowed = !item.disabled && allowed(item.permission);
            if (!itemAllowed) {
              return (
                <span
                  key={item.label}
                  title="No tienes acceso a este módulo"
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/40"
                >
                  <Icon className="size-4.5 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <Lock className="size-3.5" />
                </span>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href ?? "#"}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <Icon className="size-4.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
