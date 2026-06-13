// In-memory data store (local development backend).
//
// This is a stand-in for Supabase. Every function is async and returns plain
// data so that swapping this file for a Supabase implementation later is a
// drop-in change (see lib/data/projects.ts for the public API + db/schema.sql
// for the matching Postgres schema).
//
// State lives on globalThis so it survives Next.js HMR in development.

import {
  EMPLOYEE_DEFAULT_WORK_TYPES,
  PROJECT_RESPONSIBLES,
  SALARY_PAYMENT_STATUSES,
  SALARY_RECORD_STATUSES,
  SALARY_WEEK_STATUSES,
  SEED_PAYMENT_METHODS,
  TASK_TYPE_SEED,
  WORK_INCOME_CATEGORY,
  WORK_PROVIDERS,
  resolveTemplateWeights,
} from "@/lib/constants";
import { computeBreakdown, round2, type Addon } from "@/lib/calculations";
import type {
  Client,
  Employee,
  EmployeeDefaultWorkType,
  GeneralBalanceAccountMovement,
  GeneralBalanceEntry,
  InternalTransfer,
  ManualDebtor,
  PaymentMethod,
  Project,
  ProjectAddon,
  ProjectPayment,
  ProjectResponsible,
  ProjectTemplate,
  SalaryActivityType,
  SalaryAuditLog,
  SalaryDayRecord,
  SalaryPayment,
  SalaryPaymentStatus,
  SalaryPaymentType,
  SalaryRecordStatus,
  SalaryWeek,
  SalaryWeekStatus,
  SalaryWeekday,
  TaskModuleType,
  TaskType,
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
  employees: Employee[];
  taskTypes: TaskType[];
  salaryWeeks: SalaryWeek[];
  salaryDayRecords: SalaryDayRecord[];
  salaryPayments: SalaryPayment[];
  salaryAuditLogs: SalaryAuditLog[];
  manualDebtors: ManualDebtor[];
  generalBalanceEntries: GeneralBalanceEntry[];
  generalBalanceAccountMovements: GeneralBalanceAccountMovement[];
}

const SYSTEM_USER = "seed";
const SEED_VERSION = 11;

const SEEDED_PROJECT_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
];

const SEEDED_WORK_IDS = [
  "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  "aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  "aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
  "aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
];

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

function responsiblesFor(index: number): Record<
  "proposal" | "modeling_3d" | "plans" | "render",
  ProjectResponsible
> {
  return {
    proposal: PROJECT_RESPONSIBLES[index % PROJECT_RESPONSIBLES.length],
    modeling_3d:
      PROJECT_RESPONSIBLES[(index + 1) % PROJECT_RESPONSIBLES.length],
    plans: PROJECT_RESPONSIBLES[(index + 2) % PROJECT_RESPONSIBLES.length],
    render: PROJECT_RESPONSIBLES[(index + 3) % PROJECT_RESPONSIBLES.length],
  };
}

function buildProject(
  name: string,
  clientId: string,
  base: number,
  createdDaysAgo: number,
  addonLines: Addon[] = [],
  template: ProjectTemplate = "diamante",
  id: string = uuid(),
  responsibles = responsiblesFor(0),
): SeedProject {
  const ts = daysAgoISO(createdDaysAgo);
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
    address: null,
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
    proposal_responsible: responsibles.proposal,
    modeling_3d_responsible: responsibles.modeling_3d,
    plans_responsible: responsibles.plans,
    render_responsible: responsibles.render,
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
    buildProject(
      "Edificio Multifamiliar Surco",
      clients[2].id,
      40500,
      12,
      [],
      "oro",
      SEEDED_PROJECT_IDS[0],
      responsiblesFor(0),
    ),
    buildProject("Casa de Playa Asia", clients[0].id, 12800, 43, [
      { concept: "Levantamiento topográfico", amount: 800 },
    ], "diamante", SEEDED_PROJECT_IDS[1], responsiblesFor(1)),
    buildProject(
      "Remodelación Oficina Centro",
      clients[1].id,
      4500,
      28,
      [],
      "diamante",
      SEEDED_PROJECT_IDS[2],
      responsiblesFor(2),
    ),
    buildProject(
      "Vivienda Unifamiliar La Molina",
      clients[3].id,
      8000,
      8,
      [],
      "diamante",
      SEEDED_PROJECT_IDS[3],
      responsiblesFor(3),
    ),
    buildProject(
      "Proyecto Ejecutivo San Isidro",
      clients[4].id,
      24000,
      4,
      [
      { concept: "Visita técnica", amount: 1500 },
      ],
      "diamante",
      SEEDED_PROJECT_IDS[4],
      responsiblesFor(4),
    ),
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
    work(
      "Casa de Alejandro López Atilano",
      clients[1].id,
      "active",
      37,
      "Control integral de obra residencial.",
      SEEDED_WORK_IDS[0],
    ),
    work(
      "Remodelación Local Miraflores",
      clients[0].id,
      "active",
      18,
      "Adecuación interior, instalaciones y acabados.",
      SEEDED_WORK_IDS[1],
    ),
    work(
      "Ampliación Terraza Surco",
      clients[2].id,
      "finished",
      55,
      "Cierre de ampliación exterior.",
      SEEDED_WORK_IDS[2],
    ),
    work(
      "Obra General Salvador Alatorre",
      clients[4].id,
      "active",
      9,
      "Obra con saldos por cobrar y proveedores activos.",
      SEEDED_WORK_IDS[3],
    ),
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

  const employees: Employee[] = [
    employee("Alejandra", EMPLOYEE_DEFAULT_WORK_TYPES[0]),
    employee("Juanfer", EMPLOYEE_DEFAULT_WORK_TYPES[1]),
    employee("Juan Jose", EMPLOYEE_DEFAULT_WORK_TYPES[1]),
    employee("Esmeralda", EMPLOYEE_DEFAULT_WORK_TYPES[0]),
    employee("Diana Rodríguez", EMPLOYEE_DEFAULT_WORK_TYPES[2], false),
    employee("Patricia Aguirre", EMPLOYEE_DEFAULT_WORK_TYPES[0], false),
  ];

  const taskTypes: TaskType[] = TASK_TYPE_SEED.map((item) =>
    taskType(item.name, item.moduleType),
  );

  const taskId = (name: string) => taskTypes.find((item) => item.name === name)?.id ?? null;
  const employeeId = (name: string) =>
    employees.find((item) => item.full_name === name)?.id ?? null;

  const salaryWeeks: SalaryWeek[] = [
    salaryWeek("2026-01-05", SALARY_WEEK_STATUSES[0]),
    salaryWeek("2026-01-12", SALARY_WEEK_STATUSES[0]),
    salaryWeek("2026-01-19", SALARY_WEEK_STATUSES[0]),
    salaryWeek("2026-01-26", SALARY_WEEK_STATUSES[0]),
    salaryWeek("2026-05-25", SALARY_WEEK_STATUSES[0]),
    salaryWeek("2026-06-01", SALARY_WEEK_STATUSES[0]),
    salaryWeek("2026-06-08", SALARY_WEEK_STATUSES[0]),
  ];

  const salaryDayRecords: SalaryDayRecord[] = [
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Alejandra")!,
      workDate: "2026-01-05",
      dayName: "monday",
      activityType: "week",
      notes: "Trabajo semanal general",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Alejandra")!,
      workDate: "2026-01-06",
      dayName: "tuesday",
      activityType: "week",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Alejandra")!,
      workDate: "2026-01-07",
      dayName: "wednesday",
      activityType: "project",
      projectId: projects[4].id,
      taskTypeId: taskId("Propuesta"),
      notes: "Preparación de propuesta",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Alejandra")!,
      workDate: "2026-01-08",
      dayName: "thursday",
      activityType: "week",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Alejandra")!,
      workDate: "2026-01-09",
      dayName: "friday",
      activityType: "pending",
      status: SALARY_RECORD_STATUSES[2],
      notes: "Pendiente de confirmación",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Juanfer")!,
      workDate: "2026-01-05",
      dayName: "monday",
      activityType: "week",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Juanfer")!,
      workDate: "2026-01-06",
      dayName: "tuesday",
      activityType: "week",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Juanfer")!,
      workDate: "2026-01-07",
      dayName: "wednesday",
      activityType: "work",
      workId: works[1].id,
      taskTypeId: taskId("Supervisión"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Juanfer")!,
      workDate: "2026-01-08",
      dayName: "thursday",
      activityType: "week",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Juanfer")!,
      workDate: "2026-01-09",
      dayName: "friday",
      activityType: "week",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Juan Jose")!,
      workDate: "2026-01-05",
      dayName: "monday",
      activityType: "week",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Juan Jose")!,
      workDate: "2026-01-06",
      dayName: "tuesday",
      activityType: "week",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Juan Jose")!,
      workDate: "2026-01-07",
      dayName: "wednesday",
      activityType: "week",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Juan Jose")!,
      workDate: "2026-01-08",
      dayName: "thursday",
      activityType: "week",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Esmeralda")!,
      workDate: "2026-01-05",
      dayName: "monday",
      activityType: "project",
      projectId: projects[0].id,
      taskTypeId: taskId("Planos"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Esmeralda")!,
      workDate: "2026-01-06",
      dayName: "tuesday",
      activityType: "project",
      projectId: projects[0].id,
      taskTypeId: taskId("Planos"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Esmeralda")!,
      workDate: "2026-01-07",
      dayName: "wednesday",
      activityType: "week",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Esmeralda")!,
      workDate: "2026-01-08",
      dayName: "thursday",
      activityType: "week",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[1].id,
      employeeId: employeeId("Alejandra")!,
      workDate: "2026-01-12",
      dayName: "monday",
      activityType: "project",
      projectId: projects[0].id,
      taskTypeId: taskId("Modelado 3D"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[1].id,
      employeeId: employeeId("Alejandra")!,
      workDate: "2026-01-13",
      dayName: "tuesday",
      activityType: "project",
      projectId: projects[0].id,
      taskTypeId: taskId("Modelado 3D"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[1].id,
      employeeId: employeeId("Juanfer")!,
      workDate: "2026-01-12",
      dayName: "monday",
      activityType: "work",
      workId: works[0].id,
      taskTypeId: taskId("Obra"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[1].id,
      employeeId: employeeId("Juan Jose")!,
      workDate: "2026-01-14",
      dayName: "wednesday",
      activityType: "absent",
      notes: "No asistió",
      status: SALARY_RECORD_STATUSES[2],
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[1].id,
      employeeId: employeeId("Esmeralda")!,
      workDate: "2026-01-16",
      dayName: "friday",
      activityType: "project",
      projectId: projects[1].id,
      taskTypeId: taskId("Render"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[2].id,
      employeeId: employeeId("Alejandra")!,
      workDate: "2026-01-21",
      dayName: "wednesday",
      activityType: "project",
      projectId: projects[4].id,
      taskTypeId: taskId("Modelado 3D"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[2].id,
      employeeId: employeeId("Esmeralda")!,
      workDate: "2026-01-22",
      dayName: "thursday",
      activityType: "project",
      projectId: projects[1].id,
      taskTypeId: taskId("Render"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[3].id,
      employeeId: employeeId("Alejandra")!,
      workDate: "2026-01-26",
      dayName: "monday",
      activityType: "work",
      workId: works[1].id,
      taskTypeId: taskId("Supervisión"),
      status: SALARY_RECORD_STATUSES[2],
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[3].id,
      employeeId: employeeId("Esmeralda")!,
      workDate: "2026-01-30",
      dayName: "friday",
      activityType: "work",
      workId: works[0].id,
      taskTypeId: taskId("Obra"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[4].id,
      employeeId: employeeId("Diana Rodríguez")!,
      workDate: "2026-05-25",
      dayName: "monday",
      activityType: "project",
      projectId: projects[3].id,
      taskTypeId: taskId("Propuesta"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[4].id,
      employeeId: employeeId("Patricia Aguirre")!,
      workDate: "2026-05-27",
      dayName: "wednesday",
      activityType: "project",
      projectId: projects[0].id,
      taskTypeId: taskId("Render"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[5].id,
      employeeId: employeeId("Alejandra")!,
      workDate: "2026-06-01",
      dayName: "monday",
      activityType: "project",
      projectId: projects[4].id,
      taskTypeId: taskId("Propuesta"),
      notes: "Inicio de propuesta ejecutiva",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[5].id,
      employeeId: employeeId("Alejandra")!,
      workDate: "2026-06-03",
      dayName: "wednesday",
      activityType: "week",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[5].id,
      employeeId: employeeId("Juanfer")!,
      workDate: "2026-06-02",
      dayName: "tuesday",
      activityType: "work",
      workId: works[1].id,
      taskTypeId: taskId("Supervisión"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[5].id,
      employeeId: employeeId("Juan Jose")!,
      workDate: "2026-06-04",
      dayName: "thursday",
      activityType: "work",
      workId: works[0].id,
      taskTypeId: taskId("Obra"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[5].id,
      employeeId: employeeId("Esmeralda")!,
      workDate: "2026-06-05",
      dayName: "friday",
      activityType: "project",
      projectId: projects[0].id,
      taskTypeId: taskId("Planos"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[5].id,
      employeeId: employeeId("Diana Rodríguez")!,
      workDate: "2026-06-01",
      dayName: "monday",
      activityType: "project",
      projectId: projects[3].id,
      taskTypeId: taskId("Costos"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[5].id,
      employeeId: employeeId("Patricia Aguirre")!,
      workDate: "2026-06-03",
      dayName: "wednesday",
      activityType: "project",
      projectId: projects[1].id,
      taskTypeId: taskId("Render"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[6].id,
      employeeId: employeeId("Alejandra")!,
      workDate: "2026-06-08",
      dayName: "monday",
      activityType: "week",
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[6].id,
      employeeId: employeeId("Juanfer")!,
      workDate: "2026-06-09",
      dayName: "tuesday",
      activityType: "work",
      workId: works[3].id,
      taskTypeId: taskId("Supervisión"),
      status: SALARY_RECORD_STATUSES[2],
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[6].id,
      employeeId: employeeId("Juan Jose")!,
      workDate: "2026-06-10",
      dayName: "wednesday",
      activityType: "absent",
      notes: "Falta por justificar",
      status: SALARY_RECORD_STATUSES[2],
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[6].id,
      employeeId: employeeId("Esmeralda")!,
      workDate: "2026-06-11",
      dayName: "thursday",
      activityType: "project",
      projectId: projects[4].id,
      taskTypeId: taskId("Planos"),
    }),
    salaryDayRecord({
      salaryWeekId: salaryWeeks[6].id,
      employeeId: employeeId("Diana Rodríguez")!,
      workDate: "2026-06-12",
      dayName: "friday",
      activityType: "pending",
      notes: "Pendiente de asignación",
      status: SALARY_RECORD_STATUSES[2],
    }),
  ];

  const salaryPayments: SalaryPayment[] = [
    salaryPayment({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Alejandra")!,
      paymentType: "week",
      concept: "Pago semanal",
      amount: 2000,
      paymentMethodId: caja,
      paymentDate: salaryWeeks[0].payment_date,
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Alejandra")!,
      paymentType: "project",
      concept: "Propuesta",
      amount: 1000,
      paymentMethodId: cuentaRosa,
      paymentDate: salaryWeeks[0].payment_date,
      projectId: projects[4].id,
      taskTypeId: taskId("Propuesta"),
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Juanfer")!,
      paymentType: "week",
      concept: "Pago semanal",
      amount: 1410,
      paymentMethodId: caja,
      paymentDate: salaryWeeks[0].payment_date,
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Juan Jose")!,
      paymentType: "week",
      concept: "Pago semanal",
      amount: 2560,
      paymentMethodId: caja,
      paymentDate: salaryWeeks[0].payment_date,
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Esmeralda")!,
      paymentType: "week",
      concept: "Pago semanal",
      amount: 1000,
      paymentMethodId: caja,
      paymentDate: salaryWeeks[0].payment_date,
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[0].id,
      employeeId: employeeId("Esmeralda")!,
      paymentType: "project",
      concept: "Planos",
      amount: 2970,
      paymentMethodId: cuentaRosa,
      paymentDate: salaryWeeks[0].payment_date,
      projectId: projects[0].id,
      taskTypeId: taskId("Planos"),
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[1].id,
      employeeId: employeeId("Alejandra")!,
      paymentType: "project",
      concept: "Modelado 3D",
      amount: 2770,
      paymentMethodId: caja,
      paymentDate: salaryWeeks[1].payment_date,
      projectId: projects[0].id,
      taskTypeId: taskId("Modelado 3D"),
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[1].id,
      employeeId: employeeId("Esmeralda")!,
      paymentType: "project",
      concept: "Planos",
      amount: 1500,
      paymentMethodId: cuentaRosa,
      paymentDate: salaryWeeks[1].payment_date,
      projectId: projects[1].id,
      taskTypeId: taskId("Planos"),
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[2].id,
      employeeId: employeeId("Alejandra")!,
      paymentType: "project",
      concept: "Modelado 3D",
      amount: 3760,
      paymentMethodId: cuentaRosa,
      paymentDate: salaryWeeks[2].payment_date,
      projectId: projects[4].id,
      taskTypeId: taskId("Modelado 3D"),
      status: SALARY_PAYMENT_STATUSES[0],
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[2].id,
      employeeId: employeeId("Juanfer")!,
      paymentType: "week",
      concept: "Pago semanal",
      amount: 2400,
      paymentMethodId: caja,
      paymentDate: salaryWeeks[2].payment_date,
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[2].id,
      employeeId: employeeId("Esmeralda")!,
      paymentType: "project",
      concept: "Render",
      amount: 3000,
      paymentMethodId: cuentaRosa,
      paymentDate: salaryWeeks[2].payment_date,
      projectId: projects[1].id,
      taskTypeId: taskId("Render"),
      status: SALARY_PAYMENT_STATUSES[0],
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[3].id,
      employeeId: employeeId("Alejandra")!,
      paymentType: "work",
      concept: "Supervisión de obra",
      amount: 3200,
      paymentMethodId: caja,
      paymentDate: salaryWeeks[3].payment_date,
      workId: works[1].id,
      taskTypeId: taskId("Supervisión"),
      status: SALARY_PAYMENT_STATUSES[0],
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[3].id,
      employeeId: employeeId("Juanfer")!,
      paymentType: "week",
      concept: "Pago semanal",
      amount: 2400,
      paymentMethodId: caja,
      paymentDate: salaryWeeks[3].payment_date,
      status: SALARY_PAYMENT_STATUSES[0],
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[3].id,
      employeeId: employeeId("Esmeralda")!,
      paymentType: "work",
      concept: "Planos de obra",
      amount: 2800,
      paymentMethodId: cuentaRosa,
      paymentDate: salaryWeeks[3].payment_date,
      workId: works[0].id,
      taskTypeId: taskId("Obra"),
      status: SALARY_PAYMENT_STATUSES[0],
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[4].id,
      employeeId: employeeId("Diana Rodríguez")!,
      paymentType: "project",
      concept: "Costos y presupuesto",
      amount: 1850,
      paymentMethodId: cuentaRosa,
      paymentDate: salaryWeeks[4].payment_date,
      projectId: projects[3].id,
      taskTypeId: taskId("Costos"),
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[4].id,
      employeeId: employeeId("Patricia Aguirre")!,
      paymentType: "project",
      concept: "Render de entrega",
      amount: 2200,
      paymentMethodId: cuentaRosa,
      paymentDate: salaryWeeks[4].payment_date,
      projectId: projects[0].id,
      taskTypeId: taskId("Render"),
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[5].id,
      employeeId: employeeId("Alejandra")!,
      paymentType: "project",
      concept: "Propuesta ejecutiva",
      amount: 1600,
      paymentMethodId: cuentaRosa,
      paymentDate: salaryWeeks[5].payment_date,
      projectId: projects[4].id,
      taskTypeId: taskId("Propuesta"),
      status: SALARY_PAYMENT_STATUSES[0],
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[5].id,
      employeeId: employeeId("Juanfer")!,
      paymentType: "work",
      concept: "Supervisión de obra",
      amount: 2450,
      paymentMethodId: caja,
      paymentDate: salaryWeeks[5].payment_date,
      workId: works[1].id,
      taskTypeId: taskId("Supervisión"),
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[5].id,
      employeeId: employeeId("Juan Jose")!,
      paymentType: "work",
      concept: "Trabajo de obra semanal",
      amount: 2300,
      paymentMethodId: caja,
      paymentDate: salaryWeeks[5].payment_date,
      workId: works[0].id,
      taskTypeId: taskId("Obra"),
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[5].id,
      employeeId: employeeId("Esmeralda")!,
      paymentType: "project",
      concept: "Planos de coordinación",
      amount: 2100,
      paymentMethodId: cuentaRosa,
      paymentDate: salaryWeeks[5].payment_date,
      projectId: projects[0].id,
      taskTypeId: taskId("Planos"),
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[5].id,
      employeeId: employeeId("Diana Rodríguez")!,
      paymentType: "project",
      concept: "Costos preliminares",
      amount: 1250,
      paymentMethodId: cuentaRosa,
      paymentDate: salaryWeeks[5].payment_date,
      projectId: projects[3].id,
      taskTypeId: taskId("Costos"),
      status: SALARY_PAYMENT_STATUSES[0],
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[5].id,
      employeeId: employeeId("Patricia Aguirre")!,
      paymentType: "bonus",
      concept: "Bono de cierre visual",
      amount: 600,
      paymentMethodId: caja,
      paymentDate: salaryWeeks[5].payment_date,
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[6].id,
      employeeId: employeeId("Alejandra")!,
      paymentType: "week",
      concept: "Pago semanal",
      amount: 1800,
      paymentMethodId: caja,
      paymentDate: salaryWeeks[6].payment_date,
      status: SALARY_PAYMENT_STATUSES[0],
    }),
    salaryPayment({
      salaryWeekId: salaryWeeks[6].id,
      employeeId: employeeId("Esmeralda")!,
      paymentType: "project",
      concept: "Planos complementarios",
      amount: 1750,
      paymentMethodId: cuentaRosa,
      paymentDate: salaryWeeks[6].payment_date,
      projectId: projects[4].id,
      taskTypeId: taskId("Planos"),
      status: SALARY_PAYMENT_STATUSES[0],
    }),
  ];

  const salaryAuditLogs: SalaryAuditLog[] = salaryWeeks.map((week) =>
    salaryAuditLog(
      "week_created",
      `Semana salarial creada ${week.week_start_date}`,
      week.id,
      { status: week.status },
    ),
  );

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
    employees,
    taskTypes,
    salaryWeeks,
    salaryDayRecords,
    salaryPayments,
    salaryAuditLogs,
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
  id: string = uuid(),
): Work {
  const ts = daysAgoISO(createdDaysAgo);
  return {
    id,
    client_id: clientId,
    name,
    address: null,
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

function employee(
  fullName: string,
  defaultWorkType: EmployeeDefaultWorkType,
  isActive = true,
): Employee {
  const ts = nowISO();
  return {
    id: uuid(),
    full_name: fullName,
    is_active: isActive,
    default_work_type: defaultWorkType,
    created_at: ts,
    updated_at: ts,
    created_by: SYSTEM_USER,
  };
}

function taskType(name: string, moduleType: TaskModuleType, isActive = true): TaskType {
  const ts = nowISO();
  return {
    id: uuid(),
    name,
    module_type: moduleType,
    is_active: isActive,
    created_at: ts,
  };
}

function addDays(date: string, days: number) {
  const current = new Date(`${date}T00:00:00`);
  current.setDate(current.getDate() + days);
  return current.toISOString().slice(0, 10);
}

function salaryWeek(
  startDate: string,
  status: SalaryWeekStatus = SALARY_WEEK_STATUSES[0],
  id: string = uuid(),
): SalaryWeek {
  const ts = nowISO();
  return {
    id,
    year: Number(startDate.slice(0, 4)),
    month: Number(startDate.slice(5, 7)),
    week_start_date: startDate,
    week_end_date: addDays(startDate, 4),
    payment_date: addDays(startDate, 4),
    status,
    created_at: ts,
    updated_at: ts,
    created_by: SYSTEM_USER,
  };
}

function salaryDayRecord(data: {
  salaryWeekId: string;
  employeeId: string;
  workDate: string;
  dayName: SalaryWeekday;
  activityType: SalaryActivityType | "week" | "free";
  projectId?: string | null;
  workId?: string | null;
  taskTypeId?: string | null;
  notes?: string | null;
  status?: SalaryRecordStatus;
}): SalaryDayRecord {
  const ts = nowISO();
  const activityType: SalaryActivityType =
    data.activityType === "week" || data.activityType === "free"
      ? data.workId
        ? "work"
        : data.projectId
          ? "project"
          : "pending"
      : data.activityType;
  return {
    id: uuid(),
    salary_week_id: data.salaryWeekId,
    employee_id: data.employeeId,
    work_date: data.workDate,
    day_name: data.dayName,
    activity_type: activityType,
    project_id: data.projectId ?? null,
    work_id: data.workId ?? null,
    task_type_id: data.taskTypeId ?? null,
    notes: data.notes ?? null,
    status: data.status ?? SALARY_RECORD_STATUSES[1],
    created_at: ts,
    updated_at: ts,
    created_by: SYSTEM_USER,
  };
}

function salaryPayment(data: {
  salaryWeekId: string;
  employeeId: string;
  paymentType: SalaryPaymentType;
  concept: string;
  amount: number;
  paymentMethodId: string;
  paymentDate: string;
  projectId?: string | null;
  workId?: string | null;
  taskTypeId?: string | null;
  notes?: string | null;
  status?: SalaryPaymentStatus;
}): SalaryPayment {
  return {
    id: uuid(),
    salary_week_id: data.salaryWeekId,
    employee_id: data.employeeId,
    payment_type: data.paymentType,
    concept: data.concept,
    amount: round2(data.amount),
    payment_method_id: data.paymentMethodId,
    payment_date: data.paymentDate,
    project_id: data.projectId ?? null,
    work_id: data.workId ?? null,
    task_type_id: data.taskTypeId ?? null,
    notes: data.notes ?? null,
    status: data.status ?? SALARY_PAYMENT_STATUSES[0],
    created_at: nowISO(),
    created_by: SYSTEM_USER,
  };
}

function salaryAuditLog(
  action: SalaryAuditLog["action"],
  description: string,
  salaryWeekId: string | null,
  metadata: Record<string, unknown> | null = null,
): SalaryAuditLog {
  return {
    id: uuid(),
    salary_week_id: salaryWeekId,
    action,
    description,
    metadata_json: metadata ? JSON.stringify(metadata) : null,
    created_at: nowISO(),
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
if (!db.salaryWeeks) db.salaryWeeks = [];
if (!db.salaryDayRecords) db.salaryDayRecords = [];
if (!db.salaryPayments) db.salaryPayments = [];
if (!db.salaryAuditLogs) db.salaryAuditLogs = [];
if (!db.employees) db.employees = [];
if (!db.taskTypes) db.taskTypes = [];
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
        work(
          "Casa de Alejandro López Atilano",
          client(1),
          "active",
          35,
          "Control de obra residencial.",
          SEEDED_WORK_IDS[0],
        ),
        work(
          "Remodelación Local Miraflores",
          client(0),
          "active",
          18,
          "Adecuación interior y acabados.",
          SEEDED_WORK_IDS[1],
        ),
        work(
          "Ampliación Terraza Surco",
          client(2),
          "finished",
          55,
          null,
          SEEDED_WORK_IDS[2],
        ),
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
