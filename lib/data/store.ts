// In-memory data store (local development backend).
//
// This is a stand-in for Supabase. Every function is async and returns plain
// data so that swapping this file for a Supabase implementation later is a
// drop-in change (see lib/data/projects.ts for the public API + db/schema.sql
// for the matching Postgres schema).
//
// State lives on globalThis so it survives Next.js HMR in development.

import { SEED_PAYMENT_METHODS } from "@/lib/constants";
import { computeBreakdown, type Addon } from "@/lib/calculations";
import type {
  Client,
  PaymentMethod,
  Project,
  ProjectAddon,
  ProjectPayment,
} from "@/lib/types";

interface DB {
  clients: Client[];
  methods: PaymentMethod[];
  projects: Project[];
  addons: ProjectAddon[];
  payments: ProjectPayment[];
}

const SYSTEM_USER = "seed";

function uuid(): string {
  return crypto.randomUUID();
}

function nowISO(): string {
  return new Date().toISOString();
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function dateOnly(days: number): string {
  return daysAgoISO(days).slice(0, 10);
}

interface SeedProject {
  project: Project;
  addons: ProjectAddon[];
}

function buildProject(
  name: string,
  clientId: string,
  base: number,
  createdDaysAgo: number,
  addonLines: Addon[] = [],
): SeedProject {
  const ts = daysAgoISO(createdDaysAgo);
  const id = uuid();
  const addons: ProjectAddon[] = addonLines.map((a) => ({
    id: uuid(),
    project_id: id,
    concept: a.concept,
    amount: a.amount,
    created_at: ts,
  }));
  const b = computeBreakdown(base, addons);
  const project: Project = {
    id,
    client_id: clientId,
    name,
    project_amount: b.base,
    office_amount: b.markup.office,
    utility_amount: b.markup.utility,
    addons_total: b.addonsTotal,
    total_amount: b.total,
    proposal_amount: b.project.proposal,
    modeling_3d_amount: b.project.modeling_3d,
    plans_amount: b.project.plans,
    render_amount: b.project.render,
    created_at: ts,
    updated_at: ts,
    created_by: SYSTEM_USER,
  };
  return { project, addons };
}

function seed(): DB {
  const methods: PaymentMethod[] = SEED_PAYMENT_METHODS.map((name, i) => ({
    id: uuid(),
    name,
    is_active: true,
    created_at: daysAgoISO(120 - i),
  }));

  const clientsData = [
    "Inmobiliaria Andina S.A.C.",
    "Familia Salazar",
    "Constructora del Sur",
    "Estudio Vega Arquitectos",
  ];
  const clients: Client[] = clientsData.map((name, i) => ({
    id: uuid(),
    name,
    created_at: daysAgoISO(90 - i * 5),
    updated_at: daysAgoISO(90 - i * 5),
    created_by: SYSTEM_USER,
  }));

  const seeds: SeedProject[] = [
    // base 12000 -> total 18000 + 800 levantamiento = 18800. Partial.
    buildProject("Casa de Playa Asia", clients[0].id, 12000, 40, [
      { concept: "Levantamiento topográfico", amount: 800 },
    ]),
    // base 4500 -> total 6750. Paid in full.
    buildProject("Remodelación Oficina Centro", clients[1].id, 4500, 25),
    // base 38000 -> total 57000 + 2500 = 59500. Partial.
    buildProject("Edificio Multifamiliar Surco", clients[2].id, 38000, 12, [
      { concept: "Levantamiento arquitectónico", amount: 2500 },
    ]),
    // base 8000 -> total 12000. Pending (no payments).
    buildProject("Vivienda Unifamiliar La Molina", clients[3].id, 8000, 5),
  ];

  const projects = seeds.map((s) => s.project);
  const addons = seeds.flatMap((s) => s.addons);

  const efectivo = methods[1].id;
  const payments: ProjectPayment[] = [
    payment(projects[0].id, "income", "Anticipo inicial", 7000, dateOnly(40), methods[3].id),
    payment(projects[0].id, "income", "Pago parcial", 5000, dateOnly(20), efectivo),
    payment(projects[0].id, "expense", "Pago de propuesta", 2400, dateOnly(18), efectivo, "proposal"),
    payment(projects[0].id, "expense", "Pago de modelado 3D", 3960, dateOnly(14), methods[2].id, "modeling_3d"),
    payment(projects[1].id, "income", "Anticipo inicial", 3000, dateOnly(25), efectivo),
    payment(projects[1].id, "income", "Pago final", 1500, dateOnly(6), methods[0].id),
    payment(projects[1].id, "expense", "Pago de planos", 1485, dateOnly(5), methods[2].id, "plans"),
    payment(projects[2].id, "income", "Anticipo inicial", 12000, dateOnly(12), methods[5].id),
    payment(projects[2].id, "income", "Pago parcial", 6000, dateOnly(3), methods[4].id),
    payment(projects[2].id, "expense", "Pago de render", 5320, dateOnly(2), methods[1].id, "render"),
  ];

  return { clients, methods, projects, addons, payments };
}

function payment(
  projectId: string,
  movementType: "income" | "expense",
  concept: string,
  amount: number,
  date: string,
  methodId: string,
  internalArea: ProjectPayment["internal_area"] = null,
): ProjectPayment {
  return {
    id: uuid(),
    project_id: projectId,
    movement_type: movementType,
    concept,
    amount,
    payment_date: date,
    payment_method_id: methodId,
    internal_area: internalArea,
    created_at: nowISO(),
    created_by: SYSTEM_USER,
  };
}

const globalForDb = globalThis as unknown as { __as_db?: DB };

export const db: DB = globalForDb.__as_db ?? (globalForDb.__as_db = seed());

export { uuid, nowISO };
