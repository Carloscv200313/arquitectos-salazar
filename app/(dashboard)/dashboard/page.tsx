import { listMovements, listProjects } from "@/lib/data/projects";
import { listWorkMovements, listWorks } from "@/lib/data/works";
import { listOrderWorks } from "@/lib/data/orders";
import {
  getFinanceUtilityReport,
  getGeneralBalanceReport,
  getSalaryReport,
} from "@/lib/data/finance";
import { buildDashboardSnapshot, type DashboardMovement } from "@/lib/dashboard";
import { buildOverviewSnapshot, type MovementLite } from "@/lib/overview";
import { round2 } from "@/lib/calculations";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/fade-in";
import { OverviewView } from "@/components/dashboard/overview-view";
import { DashboardRecentMovementsCard } from "@/components/dashboard/recent-movements-card";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [projects, works, orderWorks, utilityReport, salaryReport, balance] =
    await Promise.all([
      listProjects(),
      listWorks(),
      listOrderWorks(),
      getFinanceUtilityReport(),
      getSalaryReport(),
      getGeneralBalanceReport(),
    ]);

  // Project movements (also feeds the recent-movements card).
  const projectMovementGroups = await Promise.all(
    projects.map(async (project) => {
      const movements = await listMovements(project.id);
      return movements.map<DashboardMovement>((movement) => ({
        ...movement,
        projectName: project.name,
        clientName: project.client.name,
      }));
    }),
  );
  const projectMovements = projectMovementGroups.flat();

  const workMovementGroups = await Promise.all(
    works.map((work) => listWorkMovements(work.id)),
  );
  const workMovements = workMovementGroups.flat();

  const movements: MovementLite[] = [
    ...projectMovements.map((m) => ({
      date: m.payment_date,
      type: m.movement_type,
      amount: m.amount,
    })),
    ...workMovements.map((m) => ({
      date: m.movement_date,
      type: m.movement_type,
      amount: m.amount,
    })),
  ];

  const orders = orderWorks.reduce(
    (acc, work) => ({
      ordersAmount: round2(acc.ordersAmount + work.ordersAmount),
      ordersPaid: round2(acc.ordersPaid + work.ordersPaid),
      ordersPending: round2(acc.ordersPending + work.ordersPending),
      pendingOrdersCount: acc.pendingOrdersCount + work.pendingOrdersCount,
    }),
    { ordersAmount: 0, ordersPaid: 0, ordersPending: 0, pendingOrdersCount: 0 },
  );

  const overview = buildOverviewSnapshot({
    projects,
    works,
    movements,
    utilityReport,
    orders,
    salaryPaid: salaryReport.totals.totalPaid,
    generalBalance: balance.total,
  });

  const legacy = buildDashboardSnapshot(projects, projectMovements);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visión general de proyectos, obras, pedidos, salarios y finanzas.
        </p>
      </div>

      <Stagger>
        <StaggerItem>
          <OverviewView snapshot={overview} />
        </StaggerItem>
      </Stagger>

      <FadeIn delay={0.16}>
        <DashboardRecentMovementsCard movements={legacy.recentMovements} />
      </FadeIn>
    </div>
  );
}
