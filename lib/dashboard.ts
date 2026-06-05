import { LOCALE, PAYMENT_STATUS_LABELS, PROJECT_SLICE_LABELS } from "./constants";
import { round2 } from "./calculations";
import type { PaymentStatus, PaymentWithMethod, ProjectWithFinance } from "./types";

export interface DashboardMovement extends PaymentWithMethod {
  projectName: string;
  clientName: string;
}

export interface DashboardMonthPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
}

export interface DashboardStatusPoint {
  status: PaymentStatus;
  label: string;
  count: number;
}

export interface DashboardPendingProject {
  id: string;
  name: string;
  clientName: string;
  pending: number;
  income: number;
  total: number;
}

export interface DashboardExpenseArea {
  key: keyof typeof PROJECT_SLICE_LABELS;
  label: string;
  amount: number;
}

export interface DashboardInsight {
  title: string;
  detail: string;
  href: string;
}

export interface DashboardSnapshot {
  totals: {
    portfolio: number;
    income: number;
    expense: number;
    pending: number;
    net: number;
    avgCollection: number;
    projectCount: number;
    activeClients: number;
  };
  score: {
    label: string;
    percent: number;
  };
  cashflow: DashboardMonthPoint[];
  status: DashboardStatusPoint[];
  pendingProjects: DashboardPendingProject[];
  recentMovements: DashboardMovement[];
  expenseAreas: DashboardExpenseArea[];
  insights: DashboardInsight[];
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString(LOCALE, { month: "short" });
}

function scoreLabel(percent: number): string {
  if (percent >= 85) return "Excelente";
  if (percent >= 65) return "Saludable";
  if (percent >= 40) return "Atención";
  return "Crítico";
}

function lastMonths(count: number): DashboardMonthPoint[] {
  const points: DashboardMonthPoint[] = [];
  const now = new Date();
  for (let offset = count - 1; offset >= 0; offset--) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    points.push({
      key: monthKey(date),
      label: monthLabel(date),
      income: 0,
      expense: 0,
    });
  }
  return points;
}

export function buildDashboardSnapshot(
  projects: ProjectWithFinance[],
  movements: DashboardMovement[],
): DashboardSnapshot {
  const portfolio = round2(projects.reduce((sum, project) => sum + project.total_amount, 0));
  const income = round2(projects.reduce((sum, project) => sum + project.finance.income, 0));
  const expense = round2(projects.reduce((sum, project) => sum + project.finance.expense, 0));
  const pending = round2(projects.reduce((sum, project) => sum + project.finance.pending, 0));
  const net = round2(income - expense);
  const avgCollection = portfolio > 0 ? round2((income / portfolio) * 100) : 0;
  const activeClients = new Set(projects.map((project) => project.client_id)).size;

  const status: DashboardStatusPoint[] = [
    { status: "paid", label: PAYMENT_STATUS_LABELS.paid, count: 0 },
    { status: "partial", label: PAYMENT_STATUS_LABELS.partial, count: 0 },
    { status: "pending", label: PAYMENT_STATUS_LABELS.pending, count: 0 },
  ];
  for (const project of projects) {
    const bucket = status.find((item) => item.status === project.finance.status);
    if (bucket) bucket.count += 1;
  }

  const cashflow = lastMonths(6);
  const cashflowMap = new Map(cashflow.map((point) => [point.key, point]));
  for (const movement of movements) {
    const date = new Date(movement.payment_date);
    if (Number.isNaN(date.getTime())) continue;
    const point = cashflowMap.get(monthKey(date));
    if (!point) continue;
    if (movement.movement_type === "income") point.income = round2(point.income + movement.amount);
    else point.expense = round2(point.expense + movement.amount);
  }

  const pendingProjects = [...projects]
    .filter((project) => project.finance.pending > 0)
    .sort((a, b) => b.finance.pending - a.finance.pending)
    .slice(0, 4)
    .map((project) => ({
      id: project.id,
      name: project.name,
      clientName: project.client.name,
      pending: project.finance.pending,
      income: project.finance.income,
      total: project.total_amount,
    }));

  const areaTotals = Object.fromEntries(
    Object.entries(PROJECT_SLICE_LABELS).map(([key]) => [key, 0]),
  ) as Record<keyof typeof PROJECT_SLICE_LABELS, number>;

  for (const movement of movements) {
    if (movement.movement_type === "expense" && movement.internal_area) {
      areaTotals[movement.internal_area] = round2(
        areaTotals[movement.internal_area] + movement.amount,
      );
    }
  }

  const expenseAreas = (Object.keys(PROJECT_SLICE_LABELS) as Array<keyof typeof PROJECT_SLICE_LABELS>)
    .map((key) => ({
      key,
      label: PROJECT_SLICE_LABELS[key],
      amount: areaTotals[key],
    }))
    .sort((a, b) => b.amount - a.amount);

  const topPending = pendingProjects[0];
  const withoutIncome = status.find((item) => item.status === "pending")?.count ?? 0;
  const highestExpenseArea = expenseAreas[0];
  const insights: DashboardInsight[] = [
    topPending
      ? {
          title: "Mayor monto por cobrar",
          detail: `${topPending.name} mantiene ${topPending.pending.toFixed(2)} pendientes.`,
          href: `/projects/${topPending.id}`,
        }
      : {
          title: "Cobranza al día",
          detail: "No hay proyectos con saldo pendiente relevante.",
          href: "/projects",
        },
    {
      title: "Seguimiento inmediato",
      detail:
        withoutIncome > 0
          ? `${withoutIncome} proyecto${withoutIncome === 1 ? "" : "s"} sigue${withoutIncome === 1 ? "" : "n"} sin ingresos.`
          : "Todos los proyectos ya registran al menos un ingreso.",
      href: withoutIncome > 0 ? "/projects?status=pending" : "/projects",
    },
    {
      title: "Área con más egresos",
      detail:
        highestExpenseArea && highestExpenseArea.amount > 0
          ? `${highestExpenseArea.label} concentra ${highestExpenseArea.amount.toFixed(2)} en pagos internos.`
          : "Aún no hay egresos internos suficientes para comparar áreas.",
      href: "/projects",
    },
  ];

  const recentMovements = [...movements]
    .sort(
      (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
    )
    .slice(0, 6);

  return {
    totals: {
      portfolio,
      income,
      expense,
      pending,
      net,
      avgCollection,
      projectCount: projects.length,
      activeClients,
    },
    score: {
      label: scoreLabel(avgCollection),
      percent: avgCollection,
    },
    cashflow,
    status,
    pendingProjects,
    recentMovements,
    expenseAreas,
    insights,
  };
}
