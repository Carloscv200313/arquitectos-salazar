"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "./nav-config";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  return (
    <nav className="flex flex-1 flex-col gap-6 px-3 py-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {section.title}
          </p>
          {section.items.map((item) => {
            const Icon = item.icon;
            const hasActiveChild = item.children?.some(
              (child) => pathname === child.href || pathname.startsWith(child.href + "/"),
            );
            const active =
              !item.disabled &&
              ((item.href && (pathname === item.href || pathname.startsWith(item.href + "/"))) ||
                hasActiveChild);
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
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                      hasActiveChild
                        ? "text-sidebar-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent",
                    )}
                  >
                    <Icon className="size-4.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  </button>
                  {open && (
                  <div className="ml-4 flex flex-col gap-1 border-l border-sidebar-border/80 pl-2">
                    {item.children.map((child) => {
                      const childActive =
                        pathname === child.href || pathname.startsWith(child.href + "/");
                      const ChildIcon = child.icon;
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
            if (item.disabled) {
              return (
                <span
                  key={item.label}
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/50"
                  title="Disponible próximamente"
                >
                  <Icon className="size-4.5 shrink-0" />
                  {item.label}
                  <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70">
                    Pronto
                  </span>
                </span>
              );
            }
            return (
              <div key={item.label} className="flex flex-col gap-1">
                <Link
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
                {item.children && active && (
                  <div className="ml-5 border-l border-sidebar-border/70 pl-3">
                    {item.children.map((child) => {
                      const childActive =
                        pathname === child.href || pathname.startsWith(child.href + "/");
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center rounded-md px-3 py-1.5 text-sm transition-colors",
                            childActive
                              ? "font-medium text-sidebar-foreground"
                              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                          )}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
