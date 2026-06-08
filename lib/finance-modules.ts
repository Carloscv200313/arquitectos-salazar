import {
  ArrowLeftRight,
  BadgeDollarSign,
  Banknote,
  Landmark,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface FinanceModule {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const FINANCE_MODULES: FinanceModule[] = [
  {
    slug: "balance-general",
    title: "Balance general",
    description: "Vista consolidada de saldos, entradas, salidas y cuentas.",
    icon: Landmark,
  },
  {
    slug: "deudas",
    title: "Deudas",
    description: "Seguimiento de obligaciones y saldos pendientes por cubrir.",
    icon: BadgeDollarSign,
  },
  {
    slug: "utilidades",
    title: "Utilidades",
    description: "Control de ganancias registradas por proyectos y obras.",
    icon: TrendingUp,
  },
  {
    slug: "movimientos-internos",
    title: "Movimientos internos",
    description: "Traspasos entre caja, efectivo y cuentas internas.",
    icon: ArrowLeftRight,
  },
  {
    slug: "salario",
    title: "Salario",
    description: "Registro y revisión de pagos salariales.",
    icon: Banknote,
  },
];
