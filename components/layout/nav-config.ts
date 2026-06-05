import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Wallet,
  BarChart3,
  Settings,
  LifeBuoy,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Menú principal",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Proyectos", href: "/projects", icon: FolderKanban },
      { label: "Clientes", href: "/clients", icon: Users, disabled: true },
      { label: "Finanzas", href: "/finance", icon: Wallet, disabled: true },
      { label: "Reportes", href: "/reports", icon: BarChart3, disabled: true },
    ],
  },
  {
    title: "Preferencias",
    items: [
      { label: "Configuración", href: "/settings", icon: Settings, disabled: true },
      { label: "Ayuda", href: "/help", icon: LifeBuoy, disabled: true },
    ],
  },
];
