import { LOCALE } from "./constants";
import { round2 } from "./calculations";
import type {
  FinanceUtilityReport,
  ProjectWithFinance,
  WorkWithFinance,
} from "./types";

export interface MovementLite {
  date: string;
  type: "income" | "expense";
  amount: number;
}

export interface TrendPoint {
  label: string;
  values: Record<string, number>;
}

export interface OverviewKpis {
  portfolio: number;
  projectsPending: number;
  worksBalance: number;
  ordersPending: number;
  salaryPaid: number;
  utilityTotal: number;
  generalBalance: number;
  // simple month-over-month deltas (percentage)
  cashflowDelta: number;
  utilityDelta: number;
}

export interface OverviewModuleHealth {
  key: string;
  label: string;
  href: string;
  primaryLabel: string;
  primaryValue: number;
  secondaryLabel: string;
  secondaryValue: number;
  format: "currency" | "number";
}

export interface OverviewSnapshot {
  kpis: OverviewKpis;
  cashflow: TrendPoint[]; // {ingresos, egresos}
  utilities: TrendPoint[]; // {proyectos, obras}
  portfolioStatus: { label: string; value: number; key: string }[];
  ordersBreakdown: { label: string; value: number; key: string }[];
  cashflowSpark: number[]; // net per month
  modules: OverviewModuleHealth[];
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthShort(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(LOCALE, { month: "short" });
}

function lastMonthKeys(count: number) {
  const keys: string[] = [];
  const now = new Date();
  for (let offset = count - 1; offset >= 0; offset--) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - offset, 1)));
  }
  return keys;
}

function pctDelta(curr: number, prev: number) {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return round2(((curr - prev) / Math.abs(prev)) * 100);
}

export function buildOverviewSnapshot(input: {
  projects: ProjectWithFinance[];
  works: WorkWithFinance[];
  movements: MovementLite[]; // project + work movements combined
  utilityReport: FinanceUtilityReport;
  orders: { ordersAmount: number; ordersPaid: number; ordersPending: number; pendingOrdersCount: number };
  salaryPaid: number;
  generalBalance: number;
}): OverviewSnapshot {
  const {
    projects,
    works,
    movements,
    utilityReport,
    orders,
    salaryPaid,
    generalBalance,
  } = input;

  const portfolio = round2(projects.reduce((s, p) => s + p.total_amount, 0));
  const projectsPending = round2(projects.reduce((s, p) => s + Math.max(p.finance.pending, 0), 0));
  const worksBalance = round2(works.reduce((s, w) => s + w.finance.balance, 0));

  // Cashflow (income/expense) last 6 months across projects + works.
  const monthKeys = lastMonthKeys(6);
  const cashIndex = new Map(monthKeys.map((k) => [k, { ingresos: 0, egresos: 0 }]));
  for (const m of movements) {
    const date = new Date(`${m.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    const bucket = cashIndex.get(monthKey(date));
    if (!bucket) continue;
    if (m.type === "income") bucket.ingresos = round2(bucket.ingresos + m.amount);
    else bucket.egresos = round2(bucket.egresos + m.amount);
  }
  const cashflow: TrendPoint[] = monthKeys.map((k) => {
    const b = cashIndex.get(k)!;
    return { label: monthShort(k), values: { ingresos: b.ingresos, egresos: b.egresos } };
  });
  const cashflowSpark = monthKeys.map((k) => {
    const b = cashIndex.get(k)!;
    return round2(b.ingresos - b.egresos);
  });

  // Utilities (proyectos vs obras) last 6 months.
  const utilByMonth = new Map(utilityReport.rows.map((r) => [r.month, r]));
  const utilities: TrendPoint[] = monthKeys.map((k) => {
    const r = utilByMonth.get(k);
    return {
      label: monthShort(k),
      values: { proyectos: round2(r?.projectUtility ?? 0), obras: round2(r?.workUtility ?? 0) },
    };
  });

  const portfolioStatus = [
    { key: "paid", label: "Cobrado", value: projects.filter((p) => p.finance.status === "paid").length },
    { key: "partial", label: "Cobro parcial", value: projects.filter((p) => p.finance.status === "partial").length },
    { key: "pending", label: "Sin ingresos", value: projects.filter((p) => p.finance.status === "pending").length },
  ];

  const ordersBreakdown = [
    { key: "paid", label: "Pagado", value: round2(orders.ordersPaid) },
    { key: "pending", label: "Pendiente", value: round2(orders.ordersPending) },
  ];

  // Deltas: last month vs previous.
  const lastNet = cashflowSpark.at(-1) ?? 0;
  const prevNet = cashflowSpark.at(-2) ?? 0;
  const lastUtil = utilities.at(-1)?.values.proyectos ?? 0;
  const prevUtil = utilities.at(-2)?.values.proyectos ?? 0;

  const modules: OverviewModuleHealth[] = [
    {
      key: "projects",
      label: "Proyectos",
      href: "/projects",
      primaryLabel: "Cartera",
      primaryValue: portfolio,
      secondaryLabel: "Por cobrar",
      secondaryValue: projectsPending,
      format: "currency",
    },
    {
      key: "works",
      label: "Obras",
      href: "/obras",
      primaryLabel: "Balance",
      primaryValue: worksBalance,
      secondaryLabel: "Obras activas",
      secondaryValue: works.filter((w) => w.status === "active").length,
      format: "currency",
    },
    {
      key: "orders",
      label: "Pedidos",
      href: "/pedidos",
      primaryLabel: "Por pagar",
      primaryValue: round2(orders.ordersPending),
      secondaryLabel: "Sin cotizar",
      secondaryValue: orders.pendingOrdersCount,
      format: "currency",
    },
    {
      key: "salary",
      label: "Salarios",
      href: "/finance/salario",
      primaryLabel: "Pagado del mes",
      primaryValue: round2(salaryPaid),
      secondaryLabel: "Utilidad total",
      secondaryValue: round2(utilityReport.total),
      format: "currency",
    },
  ];

  return {
    kpis: {
      portfolio,
      projectsPending,
      worksBalance,
      ordersPending: round2(orders.ordersPending),
      salaryPaid: round2(salaryPaid),
      utilityTotal: round2(utilityReport.total),
      generalBalance: round2(generalBalance),
      cashflowDelta: pctDelta(lastNet, prevNet),
      utilityDelta: pctDelta(lastUtil, prevUtil),
    },
    cashflow,
    utilities,
    portfolioStatus,
    ordersBreakdown,
    cashflowSpark,
    modules,
  };
}
