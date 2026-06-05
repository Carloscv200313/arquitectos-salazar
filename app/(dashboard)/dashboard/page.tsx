import { listMovements, listProjects } from "@/lib/data/projects";
import { buildDashboardSnapshot, type DashboardMovement } from "@/lib/dashboard";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/fade-in";
import { DashboardOverviewCards } from "@/components/dashboard/overview-cards";
import { DashboardCashflowCard } from "@/components/dashboard/cashflow-card";
import { DashboardOperationsPanel } from "@/components/dashboard/operations-panel";
import { DashboardRecentMovementsCard } from "@/components/dashboard/recent-movements-card";
import { DashboardPortfolioHealthCard } from "@/components/dashboard/portfolio-health-card";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const projects = await listProjects();

  const movementGroups = await Promise.all(
    projects.map(async (project) => {
      const movements = await listMovements(project.id);
      return movements.map<DashboardMovement>((movement) => ({
        ...movement,
        projectName: project.name,
        clientName: project.client.name,
      }));
    }),
  );

  const snapshot = buildDashboardSnapshot(projects, movementGroups.flat());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Seguimiento financiero y operativo del portafolio de proyectos.
        </p>
      </div>

      <Stagger>
        <StaggerItem>
          <DashboardOverviewCards snapshot={snapshot} />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <FadeIn delay={0.06}>
          <DashboardCashflowCard points={snapshot.cashflow} />
        </FadeIn>
        <FadeIn delay={0.1}>
          <DashboardOperationsPanel insights={snapshot.insights} />
        </FadeIn>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <FadeIn delay={0.14}>
          <DashboardRecentMovementsCard movements={snapshot.recentMovements} />
        </FadeIn>
        <FadeIn delay={0.18}>
          <DashboardPortfolioHealthCard
            status={snapshot.status}
            pendingProjects={snapshot.pendingProjects}
            expenseAreas={snapshot.expenseAreas}
          />
        </FadeIn>
      </div>
    </div>
  );
}
