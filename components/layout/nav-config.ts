import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderKanban,
  Hammer,
  Users,
  Wallet,
  ClipboardList,
  Landmark,
  ArrowLeftRight,
  BadgeDollarSign,
  TrendingUp,
  Banknote,
  BarChart3,
  Settings,
  LifeBuoy,
} from "lucide-react";

export interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  disabled?: boolean;
  badge?: string;
  groupOnly?: boolean;
  children?: Array<{
    label: string;
    href: string;
    icon?: LucideIcon;
    disabled?: boolean;
  }>;
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
      { label: "Obras", href: "/obras", icon: Hammer },
      { label: "Pedidos", href: "/pedidos", icon: ClipboardList },
      { label: "Clientes", href: "/clients", icon: Users, disabled: true },
      {
        label: "Finanzas",
        href: "/finance",
        icon: Wallet,
        groupOnly: true,
        children: [
          { label: "Balance general", href: "/finance/balance-general", icon: Landmark },
          { label: "Deudas", href: "/finance/deudas", icon: BadgeDollarSign },
          { label: "Utilidades", href: "/finance/utilidades", icon: TrendingUp },
          { label: "Movimientos internos", href: "/finance/movimientos-internos", icon: ArrowLeftRight },
          { label: "Salario", href: "/finance/salario", icon: Banknote },
        ],
      },
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
