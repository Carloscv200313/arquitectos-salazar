// In-memory data store (local development backend).
//
// This is a stand-in for Supabase. Every function is async and returns plain
// data so that swapping this file for a Supabase implementation later is a
// drop-in change (see lib/data/projects.ts for the public API + db/schema.sql
// for the matching Postgres schema).
//
// State lives on globalThis so it survives Next.js HMR in development.

import {
  SEED_PAYMENT_METHODS,
  WORK_INCOME_CATEGORY,
  WORK_PROVIDERS,
  resolveTemplateWeights,
} from "@/lib/constants";
import { computeBreakdown, type Addon } from "@/lib/calculations";
import type {
  Client,
  GeneralBalanceAccountMovement,
  GeneralBalanceEntry,
  InternalTransfer,
  ManualDebtor,
  PaymentMethod,
  Project,
  ProjectAddon,
  ProjectPayment,
  ProjectTemplate,
  Work,
  WorkMovement,
} from "@/lib/types";

interface DB {
  clients: Client[];
  methods: PaymentMethod[];
  projects: Project[];
  addons: ProjectAddon[];
  payments: ProjectPayment[];
  internalTransfers: InternalTransfer[];
  workInternalTransfers: InternalTransfer[];
  works: Work[];
  workMovements: WorkMovement[];
  manualDebtors: ManualDebtor[];
  generalBalanceEntries: GeneralBalanceEntry[];
  generalBalanceAccountMovements: GeneralBalanceAccountMovement[];
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
  template: ProjectTemplate = "diamante",
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
  const b = computeBreakdown(base, addons, resolveTemplateWeights(template));
  const project: Project = {
    id,
    client_id: clientId,
    name,
    template,
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
    // base 38000 + 2500 levantamiento. Partial. Plantilla Oro.
    buildProject("Edificio Multifamiliar Surco", clients[2].id, 38000, 12, [
      { concept: "Levantamiento arquitectónico", amount: 2500 },
    ], "oro"),
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

  const internalTransfers: InternalTransfer[] = [
    transfer(
      "Cierre de proyectos varios",
      34520,
      "2026-03-20",
      methods[2].id,
      methods[0].id,
    ),
    transfer(
      "Reserva operativa",
      74060.22,
      "2026-03-20",
      methods[2].id,
      methods[3].id,
    ),
  ];

  const works: Work[] = [
    work("Casa de Alejandro López Atilano", clients[1].id, "active", 35, "Control de obra residencial."),
    work("Remodelación Local Miraflores", clients[0].id, "active", 18, "Adecuación interior y acabados."),
    work("Ampliación Terraza Surco", clients[2].id, "finished", 55, null),
  ];

  const workMovements: WorkMovement[] = [
    workMovement(works[0].id, "939", dateOnly(35), "Abono de obra", "Cliente", WORK_INCOME_CATEGORY, "income", 300000, methods[3].id),
    workMovement(works[0].id, "629018", dateOnly(34), "Abono de obra, BBVA", "Cliente", WORK_INCOME_CATEGORY, "income", 188871.75, methods[5].id),
    workMovement(works[0].id, "0006614", dateOnly(30), "Aceros, varillas y anillos", "Mat. Gonzalez", "Material de construcción", "expense", 234358.04, methods[0].id),
    workMovement(works[0].id, "0072", dateOnly(28), "700 blocks", "Master Block", "Material de construcción", "expense", 11900, methods[2].id),
    workMovement(works[0].id, "6043", dateOnly(27), "Mano de obra", "Maderería Paisa", "Honorarios", "expense", 16000, methods[2].id),
    workMovement(works[1].id, "A-001", dateOnly(18), "Anticipo inicial", "Cliente", WORK_INCOME_CATEGORY, "income", 12000, methods[3].id),
    workMovement(works[1].id, "M-118", dateOnly(16), "Pintura interior", "Alfarería León", "Pintura", "expense", 2400, methods[2].id),
    workMovement(works[1].id, "S-021", dateOnly(15), "Servicio eléctrico", "Concretos LOPAR", "Servicio", "expense", 900, methods[1].id),
    workMovement(works[2].id, "T-001", dateOnly(55), "Abono inicial", "Cliente", WORK_INCOME_CATEGORY, "income", 15000, methods[3].id),
    workMovement(works[2].id, "G-040", dateOnly(50), "Granito de barra", "Mat. Quezada", "Granito", "expense", 6200, methods[2].id),
  ];

  const manualDebtors: ManualDebtor[] = [
    manualDebtor("Juan Humberto", 6000),
    manualDebtor("Donato", 2690),
    manualDebtor("Diana", 750),
    manualDebtor("Antonio Ayala", 0),
    manualDebtor("Alejandro, pintor", 0),
    manualDebtor("Beto Flores (Mont)", 5410.04),
    manualDebtor("Juan José", 3200),
    manualDebtor("Vicente", 3000),
    manualDebtor("Jorge Herrera", 0),
    manualDebtor("Enrique", 9155),
    manualDebtor("Luis Flores", 2660),
    manualDebtor("Don Jaime", 0),
    manualDebtor("César Iván", 610),
    manualDebtor("Uriel", 5578),
    manualDebtor("Daniel Herrera Rodríguez", 3000),
    manualDebtor("Osvaldo", 1500),
  ];

  return {
    clients,
    methods,
    projects,
    addons,
    payments,
    internalTransfers,
    workInternalTransfers: [],
    works,
    workMovements,
    manualDebtors,
    generalBalanceEntries: [],
    generalBalanceAccountMovements: [],
  };
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

function transfer(
  description: string,
  amount: number,
  date: string,
  fromMethodId: string,
  toMethodId: string,
): InternalTransfer {
  return {
    id: uuid(),
    description,
    amount,
    transfer_date: date,
    from_payment_method_id: fromMethodId,
    to_payment_method_id: toMethodId,
    created_at: nowISO(),
    created_by: SYSTEM_USER,
  };
}

function work(
  name: string,
  clientId: string,
  status: Work["status"],
  createdDaysAgo: number,
  description: string | null,
): Work {
  const ts = daysAgoISO(createdDaysAgo);
  return {
    id: uuid(),
    client_id: clientId,
    name,
    status,
    description,
    created_at: ts,
    updated_at: ts,
    created_by: SYSTEM_USER,
  };
}

function workMovement(
  workId: string,
  receipt: string,
  date: string,
  concept: string,
  supplier: string,
  category: string,
  movementType: WorkMovement["movement_type"],
  amount: number,
  paymentMethodId: string,
  observations: string | null = null,
): WorkMovement {
  return {
    id: uuid(),
    work_id: workId,
    receipt,
    movement_date: date,
    concept,
    supplier,
    category,
    movement_type: movementType,
    amount,
    payment_method_id: paymentMethodId,
    observations,
    created_at: nowISO(),
    created_by: SYSTEM_USER,
  };
}

function manualDebtor(name: string, amount: number): ManualDebtor {
  const ts = nowISO();
  return {
    id: uuid(),
    name,
    amount,
    created_at: ts,
    updated_at: ts,
    created_by: SYSTEM_USER,
  };
}

const globalForDb = globalThis as unknown as { __as_db?: DB };

export const db: DB = globalForDb.__as_db ?? (globalForDb.__as_db = seed());

// HMR keeps the old global store alive in development. When the schema evolves,
// make sure newly added collections exist without requiring a server restart.
if (!db.internalTransfers) db.internalTransfers = [];
if (!db.workInternalTransfers) db.workInternalTransfers = [];
if (!db.generalBalanceEntries) db.generalBalanceEntries = [];
if (!db.generalBalanceAccountMovements) db.generalBalanceAccountMovements = [];
if (!db.manualDebtors) {
  db.manualDebtors = [
    manualDebtor("Juan Humberto", 6000),
    manualDebtor("Donato", 2690),
    manualDebtor("Diana", 750),
    manualDebtor("Antonio Ayala", 0),
    manualDebtor("Alejandro, pintor", 0),
    manualDebtor("Beto Flores (Mont)", 5410.04),
    manualDebtor("Juan José", 3200),
    manualDebtor("Vicente", 3000),
    manualDebtor("Jorge Herrera", 0),
    manualDebtor("Enrique", 9155),
    manualDebtor("Luis Flores", 2660),
    manualDebtor("Don Jaime", 0),
    manualDebtor("César Iván", 610),
    manualDebtor("Uriel", 5578),
    manualDebtor("Daniel Herrera Rodríguez", 3000),
    manualDebtor("Osvaldo", 1500),
  ];
}
if (!db.works) {
  const client = (index: number) => db.clients[index % Math.max(db.clients.length, 1)]?.id;
  db.works = db.clients.length
    ? [
        work("Casa de Alejandro López Atilano", client(1), "active", 35, "Control de obra residencial."),
        work("Remodelación Local Miraflores", client(0), "active", 18, "Adecuación interior y acabados."),
        work("Ampliación Terraza Surco", client(2), "finished", 55, null),
      ]
    : [];
}
if (!db.workMovements) {
  const [first, second, third] = db.works;
  db.workMovements = [
    ...(first
      ? [
          workMovement(first.id, "939", dateOnly(35), "Abono de obra", "Cliente", WORK_INCOME_CATEGORY, "income", 300000, db.methods[3]?.id ?? db.methods[0]?.id),
          workMovement(first.id, "629018", dateOnly(34), "Abono de obra, BBVA", "Cliente", WORK_INCOME_CATEGORY, "income", 188871.75, db.methods[5]?.id ?? db.methods[0]?.id),
          workMovement(first.id, "0006614", dateOnly(30), "Aceros, varillas y anillos", "Mat. Gonzalez", "Material de construcción", "expense", 234358.04, db.methods[0]?.id),
          workMovement(first.id, "0072", dateOnly(28), "700 blocks", "Master Block", "Material de construcción", "expense", 11900, db.methods[2]?.id ?? db.methods[0]?.id),
          workMovement(first.id, "6043", dateOnly(27), "Mano de obra", "Maderería Paisa", "Honorarios", "expense", 16000, db.methods[2]?.id ?? db.methods[0]?.id),
        ]
      : []),
    ...(second
      ? [
          workMovement(second.id, "A-001", dateOnly(18), "Anticipo inicial", "Cliente", WORK_INCOME_CATEGORY, "income", 12000, db.methods[3]?.id ?? db.methods[0]?.id),
          workMovement(second.id, "M-118", dateOnly(16), "Pintura interior", "Alfarería León", "Pintura", "expense", 2400, db.methods[2]?.id ?? db.methods[0]?.id),
          workMovement(second.id, "S-021", dateOnly(15), "Servicio eléctrico", "Concretos LOPAR", "Servicio", "expense", 900, db.methods[1]?.id ?? db.methods[0]?.id),
        ]
      : []),
    ...(third
      ? [
          workMovement(third.id, "T-001", dateOnly(55), "Abono inicial", "Cliente", WORK_INCOME_CATEGORY, "income", 15000, db.methods[3]?.id ?? db.methods[0]?.id),
          workMovement(third.id, "G-040", dateOnly(50), "Granito de barra", "Mat. Quezada", "Granito", "expense", 6200, db.methods[2]?.id ?? db.methods[0]?.id),
        ]
      : []),
  ];
}
const providerCorrections: Record<string, string> = {
  "Alejandro López Atilano": "Cliente",
  "Inmobiliaria Andina S.A.C.": "Cliente",
  "Constructora del Sur": "Cliente",
  "Aceros Ayotlán": "Mat. Gonzalez",
  "Luis Flores": "Maderería Paisa",
  "Pinturas Andina": "Alfarería León",
  "Técnicos del Sur": "Concretos LOPAR",
  "Granitos Lima": "Mat. Quezada",
};
for (const movement of db.workMovements) {
  if (!movement.payment_method_id) {
    movement.payment_method_id = db.methods[0]?.id ?? "";
  }
  if (movement.movement_type === "income") {
    movement.supplier = "Cliente";
    movement.category = WORK_INCOME_CATEGORY;
  } else if (!WORK_PROVIDERS.includes(movement.supplier as (typeof WORK_PROVIDERS)[number])) {
    movement.supplier = providerCorrections[movement.supplier] ?? WORK_PROVIDERS[0];
  }
}

export { uuid, nowISO };
