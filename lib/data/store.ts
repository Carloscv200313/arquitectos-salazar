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
import { computeBreakdown, round2, type Addon } from "@/lib/calculations";
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
  WorkOrder,
  WorkOrderPayment,
} from "@/lib/types";

interface DB {
  seedVersion: number;
  clients: Client[];
  methods: PaymentMethod[];
  projects: Project[];
  addons: ProjectAddon[];
  payments: ProjectPayment[];
  internalTransfers: InternalTransfer[];
  workInternalTransfers: InternalTransfer[];
  works: Work[];
  workMovements: WorkMovement[];
  workOrders: WorkOrder[];
  workOrderPayments: WorkOrderPayment[];
  manualDebtors: ManualDebtor[];
  generalBalanceEntries: GeneralBalanceEntry[];
  generalBalanceAccountMovements: GeneralBalanceAccountMovement[];
}

const SYSTEM_USER = "seed";
const SEED_VERSION = 3;

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
    "Claudia Garcia",
  ];
  const clients: Client[] = clientsData.map((name, i) => ({
    id: uuid(),
    name,
    created_at: daysAgoISO(90 - i * 5),
    updated_at: daysAgoISO(90 - i * 5),
    created_by: SYSTEM_USER,
  }));

  const seeds: SeedProject[] = [
    buildProject("Edificio Multifamiliar Surco", clients[2].id, 40500, 12, [], "oro"),
    buildProject("Casa de Playa Asia", clients[0].id, 12800, 43, [
      { concept: "Levantamiento topográfico", amount: 800 },
    ]),
    buildProject("Remodelación Oficina Centro", clients[1].id, 4500, 28),
    buildProject("Vivienda Unifamiliar La Molina", clients[3].id, 8000, 8),
    buildProject("Proyecto Ejecutivo San Isidro", clients[4].id, 24000, 4, [
      { concept: "Visita técnica", amount: 1500 },
    ]),
  ];

  const projects = seeds.map((s) => s.project);
  const addons = seeds.flatMap((s) => s.addons);

  const methodId = (name: (typeof SEED_PAYMENT_METHODS)[number]) => {
    const method = methods.find((item) => item.name === name);
    if (!method) throw new Error(`Missing payment method: ${name}`);
    return method.id;
  };
  const cuentasPorPagar = methodId("Cuentas por pagar");
  const efectivo = methodId("Efectivo");
  const caja = methodId("Caja");
  const cuentaRosa = methodId("Cuenta de Rosa");
  const cuentaSilvia = methodId("Cuenta de Silvia");
  const cuentaFiscal = methodId("Cuenta fiscal");

  const payments: ProjectPayment[] = [
    payment(projects[0].id, "income", "Anticipo inicial", 12000, dateOnly(12), cuentaFiscal),
    payment(projects[0].id, "income", "Pago parcial", 6000, dateOnly(3), cuentaRosa),
    payment(projects[0].id, "expense", "Pago de render", 5320, dateOnly(2), efectivo, "render"),
    payment(projects[1].id, "income", "Anticipo inicial", 7000, dateOnly(42), cuentaRosa),
    payment(projects[1].id, "income", "Pago parcial", 5000, dateOnly(20), efectivo),
    payment(projects[1].id, "expense", "Pago de propuesta", 2400, dateOnly(18), efectivo, "proposal"),
    payment(projects[1].id, "expense", "Pago de modelado 3D", 3960, dateOnly(14), caja, "modeling_3d"),
    payment(projects[2].id, "income", "Anticipo inicial", 3000, dateOnly(25), efectivo),
    payment(projects[2].id, "income", "Pago final", 1500, dateOnly(6), caja),
    payment(projects[2].id, "expense", "Pago de planos", 1485, dateOnly(5), caja, "plans"),
    payment(projects[4].id, "income", "Separación de proyecto", 8500, dateOnly(4), cuentaSilvia),
  ];

  const internalTransfers: InternalTransfer[] = [
    transfer(
      "Cierre de proyectos varios",
      34520,
      "2026-03-20",
      caja,
      cuentasPorPagar,
    ),
    transfer(
      "Reserva operativa",
      74060.22,
      "2026-03-20",
      caja,
      cuentaRosa,
    ),
  ];

  const works: Work[] = [
    work("Casa de Alejandro López Atilano", clients[1].id, "active", 37, "Control integral de obra residencial."),
    work("Remodelación Local Miraflores", clients[0].id, "active", 18, "Adecuación interior, instalaciones y acabados."),
    work("Ampliación Terraza Surco", clients[2].id, "finished", 55, "Cierre de ampliación exterior."),
    work("Obra General Salvador Alatorre", clients[4].id, "active", 9, "Obra con saldos por cobrar y proveedores activos."),
  ];

  const workMovements: WorkMovement[] = [
    workMovement(works[0].id, "939", dateOnly(36), "Abono de obra", "Cliente", WORK_INCOME_CATEGORY, "income", 300000, cuentaRosa),
    workMovement(works[0].id, "629018", dateOnly(35), "Abono de obra, BBVA", "Cliente", WORK_INCOME_CATEGORY, "income", 188871.75, cuentaFiscal),
    workMovement(works[0].id, "6043", dateOnly(27), "Mano de obra inicial", "Maderería Paisa", "Honorarios", "expense", 16000, caja),
    workMovement(works[0].id, "6063", dateOnly(24), "Supervisión y replanteo", "Master Block", "Servicio", "expense", 7800, efectivo),
    workMovement(works[1].id, "A-001", dateOnly(18), "Anticipo inicial", "Cliente", WORK_INCOME_CATEGORY, "income", 18000, cuentaRosa),
    workMovement(works[1].id, "A-002", dateOnly(7), "Segundo abono", "Cliente", WORK_INCOME_CATEGORY, "income", 10000, caja),
    workMovement(works[1].id, "M-118", dateOnly(16), "Pintura interior", "Alfarería León", "Pintura", "expense", 2400, caja),
    workMovement(works[1].id, "S-021", dateOnly(15), "Servicio eléctrico", "Concretos LOPAR", "Servicio", "expense", 900, efectivo),
    workMovement(works[2].id, "T-001", dateOnly(55), "Abono inicial", "Cliente", WORK_INCOME_CATEGORY, "income", 15000, cuentaRosa),
    workMovement(works[2].id, "G-040", dateOnly(50), "Granito de barra", "Mat. Quezada", "Granito", "expense", 6200, caja),
    workMovement(works[3].id, "SA-001", dateOnly(9), "Abono de obra", "Cliente", WORK_INCOME_CATEGORY, "income", 8000, cuentaSilvia),
    workMovement(works[3].id, "SA-114", dateOnly(6), "Cuadrilla de instalación", "Materiales Aguilar", "Instalaciones", "expense", 11300, efectivo),
  ];

  const workInternalTransfers: InternalTransfer[] = [
    transfer("Fondo operativo para caja de obra", 6500, dateOnly(8), cuentaRosa, caja),
    transfer("Reembolso de efectivo a caja", 1200, dateOnly(5), caja, efectivo),
  ];

  const workOrders: WorkOrder[] = [];
  const workOrderPayments: WorkOrderPayment[] = [];

  function addWorkOrder(data: {
    work: Work;
    orderDate: string;
    supplier: (typeof WORK_PROVIDERS)[number];
    material: string;
    description?: string;
    category?: string;
    amount?: number;
    advanceAmount?: number;
    advanceMethodId?: string;
    laterPayments?: Array<{
      date: string;
      description: string;
      amount: number;
      methodId: string;
    }>;
  }) {
    const ts = daysAgoISO(1);
    const orderId = uuid();
    let payableMovementId: string | null = null;

    if (data.amount) {
      const advance = round2(data.advanceAmount ?? 0);
      if (advance > 0 && data.advanceMethodId) {
        const advanceMovement = workMovement(
          data.work.id,
          `PED-${orderId.slice(0, 8)}-A`,
          data.orderDate,
          `Adelanto pedido: ${data.material}`,
          data.supplier,
          data.category ?? "Material de construcción",
          "expense",
          advance,
          data.advanceMethodId,
          data.description ?? null,
        );
        workMovements.push(advanceMovement);
        workOrderPayments.push({
          id: uuid(),
          order_id: orderId,
          payment_date: data.orderDate,
          description: "Adelanto del pedido",
          amount: advance,
          payment_method_id: data.advanceMethodId,
          work_movement_id: advanceMovement.id,
          internal_transfer_id: null,
          created_at: ts,
          created_by: SYSTEM_USER,
        });
      }

      const payableAmount = round2(data.amount - advance);
      if (payableAmount > 0) {
        const payableMovement = workMovement(
          data.work.id,
          `PED-${orderId.slice(0, 8)}-P`,
          data.orderDate,
          `Pedido por pagar: ${data.material}`,
          data.supplier,
          data.category ?? "Material de construcción",
          "expense",
          payableAmount,
          cuentasPorPagar,
          data.description ?? null,
        );
        workMovements.push(payableMovement);
        payableMovementId = payableMovement.id;
      }

      for (const paymentData of data.laterPayments ?? []) {
        const transferRow = transfer(
          paymentData.description,
          paymentData.amount,
          paymentData.date,
          paymentData.methodId,
          cuentasPorPagar,
        );
        workInternalTransfers.push(transferRow);
        workOrderPayments.push({
          id: uuid(),
          order_id: orderId,
          payment_date: paymentData.date,
          description: paymentData.description,
          amount: paymentData.amount,
          payment_method_id: paymentData.methodId,
          work_movement_id: null,
          internal_transfer_id: transferRow.id,
          created_at: ts,
          created_by: SYSTEM_USER,
        });
      }
    }

    workOrders.push({
      id: orderId,
      work_id: data.work.id,
      order_date: data.orderDate,
      supplier: data.supplier,
      material: data.material,
      description: data.description ?? null,
      category: data.category ?? null,
      amount: data.amount ?? null,
      quoted_at: data.amount ? data.orderDate : null,
      payable_movement_id: payableMovementId,
      created_at: ts,
      updated_at: ts,
      created_by: SYSTEM_USER,
    });
  }

  addWorkOrder({
    work: works[1],
    orderDate: dateOnly(6),
    supplier: "Concretos LOPAR",
    material: "15 varillas con 1 clavo",
    description: "Pedido para refuerzo de estructura local.",
    category: "Material de construcción",
    amount: 1000,
  });
  addWorkOrder({
    work: works[1],
    orderDate: dateOnly(6),
    supplier: "Mat. Quezada",
    material: "Tablas, tornillería y perfiles para remates interiores",
    description: "Compra acordada con adelanto desde Cuenta de Silvia.",
    category: "Material de construcción",
    amount: 5000,
    advanceAmount: 2000,
    advanceMethodId: cuentaSilvia,
  });
  addWorkOrder({
    work: works[1],
    orderDate: dateOnly(5),
    supplier: "Caracol Betania",
    material: "Lote de loseta cerámica para baños y barra",
    description: "Pendiente de cotización final del proveedor.",
  });
  addWorkOrder({
    work: works[1],
    orderDate: dateOnly(4),
    supplier: "Master Block",
    material: "Block ligero y flete para cierre de muro",
    description: "Pedido liquidado después de la entrega.",
    category: "Material de obras",
    amount: 8500,
    advanceAmount: 2500,
    advanceMethodId: caja,
    laterPayments: [
      {
        date: dateOnly(2),
        description: "Liquidación pedido Master Block",
        amount: 6000,
        methodId: cuentaRosa,
      },
    ],
  });
  addWorkOrder({
    work: works[0],
    orderDate: dateOnly(31),
    supplier: "Materiales Aguilar",
    material: "Aceros, varillas y anillos para cimentación",
    description: "Pedido cubierto en dos pagos contra avance.",
    category: "Material de construcción",
    amount: 24000,
    advanceAmount: 8000,
    advanceMethodId: cuentaFiscal,
    laterPayments: [
      {
        date: dateOnly(26),
        description: "Pago parcial Materiales Aguilar",
        amount: 10000,
        methodId: cuentaRosa,
      },
      {
        date: dateOnly(22),
        description: "Liquidación Materiales Aguilar",
        amount: 6000,
        methodId: caja,
      },
    ],
  });
  addWorkOrder({
    work: works[2],
    orderDate: dateOnly(49),
    supplier: "Alfarería León",
    material: "Pintura sellador y brochas para terraza",
    description: "Saldo pendiente de cierre con proveedor.",
    category: "Pintura",
    amount: 3600,
  });

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
    seedVersion: SEED_VERSION,
    clients,
    methods,
    projects,
    addons,
    payments,
    internalTransfers,
    workInternalTransfers,
    works,
    workMovements,
    workOrders,
    workOrderPayments,
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

if (db.seedVersion !== SEED_VERSION) {
  Object.assign(db, seed());
  globalForDb.__as_db = db;
}

// HMR keeps the old global store alive in development. When the schema evolves,
// make sure newly added collections exist without requiring a server restart.
if (!db.seedVersion) db.seedVersion = SEED_VERSION;
if (!db.internalTransfers) db.internalTransfers = [];
if (!db.workInternalTransfers) db.workInternalTransfers = [];
if (!db.workOrders) db.workOrders = [];
if (!db.workOrderPayments) db.workOrderPayments = [];
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
