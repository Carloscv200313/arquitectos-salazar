import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderKanban,
  Hammer,
  Wallet,
  ClipboardList,
  Landmark,
  ArrowLeftRight,
  BadgeDollarSign,
  TrendingUp,
  Banknote,
  Settings,
  LifeBuoy,
} from "lucide-react";

export interface NavChild {
  label: string;
  href: string;
  icon?: LucideIcon;
  disabled?: boolean;
  permission?: string;
}

export interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  disabled?: boolean;
  badge?: string;
  groupOnly?: boolean;
  permission?: string;
  children?: NavChild[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Menú principal",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
      { label: "Proyectos", href: "/projects", icon: FolderKanban, permission: "projects.view" },
      { label: "Obras", href: "/obras", icon: Hammer, permission: "works.view" },
      { label: "Pedidos", href: "/pedidos", icon: ClipboardList, permission: "orders.view" },
      {
        label: "Finanzas",
        href: "/finance",
        icon: Wallet,
        groupOnly: true,
        children: [
          { label: "Balance general", href: "/finance/balance-general", icon: Landmark, permission: "finance.view" },
          { label: "Deudas", href: "/finance/deudas", icon: BadgeDollarSign, permission: "finance.view" },
          { label: "Utilidades", href: "/finance/utilidades", icon: TrendingUp, permission: "finance.view" },
          { label: "Movimientos internos", href: "/finance/movimientos-internos", icon: ArrowLeftRight, permission: "finance.view" },
          { label: "Salario", href: "/finance/salario", icon: Banknote, permission: "salary.view" },
        ],
      },
    ],
  },
  {
    title: "Preferencias",
    items: [
      { label: "Configuración", href: "/configuracion", icon: Settings, permission: "settings.view" },
      { label: "Ayuda", href: "/help", icon: LifeBuoy },
    ],
  },
];
