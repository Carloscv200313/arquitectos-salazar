// Domain types for the Projects module.
// Kept framework-agnostic so the data layer (local or Supabase) can implement them.

export type PaymentStatus = "pending" | "partial" | "paid";
export type MovementType = "income" | "expense";
export type InternalArea = "proposal" | "modeling_3d" | "plans" | "render";
export type ProjectResponsible =
  | "Alejandra"
  | "Juanfer"
  | "Juan Jose"
  | "Esmeralda"
  | "Sin asignar";

export interface Client {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface PaymentMethod {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface ProjectAddon {
  id: string;
  project_id: string;
  concept: string;
  amount: number;
  created_at: string;
}

export type ProjectTemplate = "diamante" | "oro" | "especial";

export interface Project {
  id: string;
  client_id: string;
  name: string;
  // Domicilio / dirección de la obra
  address: string | null;
  // Distribution template that defines the internal area weights
  template: ProjectTemplate;
  // Base amount of the project (the input). Markup is computed on top of this.
  project_amount: number;
  // Markup amounts, computed as % of project_amount
  office_amount: number;
  utility_amount: number;
  // Sum of additional line items (levantamiento, etc.)
  addons_total: number;
  // Amount the client pays = project_amount + office + utility + addons_total
  total_amount: number;
  // Internal distribution (of project_amount)
  proposal_amount: number;
  modeling_3d_amount: number;
  plans_amount: number;
  render_amount: number;
  proposal_responsible: ProjectResponsible;
  modeling_3d_responsible: ProjectResponsible;
  plans_responsible: ProjectResponsible;
  render_responsible: ProjectResponsible;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ProjectPayment {
  id: string;
  project_id: string;
  movement_type: MovementType;
  concept: string;
  amount: number;
  payment_date: string;
  payment_method_id: string;
  internal_area: InternalArea | null;
  receipt_code: string | null;
  created_at: string;
  created_by: string | null;
}

export interface InternalTransfer {
  id: string;
  description: string;
  amount: number;
  transfer_date: string;
  from_payment_method_id: string;
  to_payment_method_id: string;
  created_at: string;
  created_by: string | null;
}

// Derived financial snapshot of a project (computed, never stored).
export interface ProjectFinance {
  total: number;
  income: number;
  expense: number;
  paid: number;
  pending: number;
  net: number;
  collectionPercentage: number;
  paidPercentage: number;
  status: PaymentStatus;
}

// Project enriched with relations + computed finance, ready for the UI.
export interface ProjectWithFinance extends Project {
  client: Client;
  finance: ProjectFinance;
  payments_count: number;
  addons: ProjectAddon[];
}

export interface PaymentWithMethod extends ProjectPayment {
  method: PaymentMethod | null;
}

export interface InternalTransferWithMethods extends InternalTransfer {
  fromMethod: PaymentMethod | null;
  toMethod: PaymentMethod | null;
}

export interface WorkInternalTransferWithMethods extends InternalTransfer {
  fromMethod: PaymentMethod | null;
  toMethod: PaymentMethod | null;
}

export interface PaymentMethodReportRow {
  methodId: string;
  methodName: string;
  clientMovements: number;
  internalMovements: number;
  finalBalance: number;
}

export interface UtilityReportRow {
  month: string;
  utilityAmount: number;
}

export type WorkStatus = "active" | "finished";
export type WorkFilterStatus = WorkStatus | "debtor";
export type WorkMovementType = "income" | "expense";

export interface Work {
  id: string;
  client_id: string;
  name: string;
  // Domicilio / dirección de la obra
  address: string | null;
  status: WorkStatus;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface WorkMovement {
  id: string;
  work_id: string;
  receipt: string;
  movement_date: string;
  concept: string;
  supplier: string;
  category: string;
  movement_type: WorkMovementType;
  amount: number;
  payment_method_id: string;
  observations: string | null;
  created_at: string;
  created_by: string | null;
}

export interface WorkFinance {
  income: number;
  expense: number;
  balance: number;
  movementsCount: number;
  lastMovementDate: string | null;
}

export interface WorkFile {
  id: string;
  work_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
  created_by: string | null;
}

export interface WorkWithFinance extends Work {
  client: Client;
  finance: WorkFinance;
  files: WorkFile[];
}

export interface WorkMovementWithBalance extends WorkMovement {
  balance: number;
  method: PaymentMethod | null;
}

export type WorkOrderStatus = "pending_quote" | "quoted" | "partial" | "paid";

export interface WorkOrder {
  id: string;
  work_id: string;
  source: "internal" | "public";
  order_date: string;
  supplier: string;
  material: string;
  description: string | null;
  category: string | null;
  amount: number | null;
  quoted_at: string | null;
  payable_movement_id: string | null;
  is_requested: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface WorkOrderPayment {
  id: string;
  order_id: string;
  payment_date: string;
  description: string;
  amount: number;
  payment_method_id: string;
  work_movement_id: string | null;
  internal_transfer_id: string | null;
  created_at: string;
  created_by: string | null;
}

export interface WorkOrderPaymentWithMethod extends WorkOrderPayment {
  method: PaymentMethod | null;
}

export interface WorkOrderWithRelations extends WorkOrder {
  work: WorkWithFinance;
  payments: WorkOrderPaymentWithMethod[];
  paid: number;
  pending: number;
  status: WorkOrderStatus;
}

export interface WorkCategorySummary {
  category: string;
  budget: number | null;
  income: number;
  expense: number;
  balance: number;
  executedAmount: number | null;
  incomePercent: number | null;
  expensePercent: number | null;
  executedPercent: number | null;
}

export interface WorkAdministrationUtilityRow {
  month: string;
  amount: number;
}

export type DebtPartyType = "debtor" | "provider";

export interface ManualDebtor {
  id: string;
  name: string;
  amount: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface DebtReportRow {
  id: string;
  name: string;
  amount: number;
  type: DebtPartyType;
  source: "manual" | "works" | "orders";
}

export interface ProviderDebtDetail {
  provider: string;
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
  orders: WorkOrderWithRelations[];
}

export interface GeneralBalanceEntry {
  id: string;
  description: string;
  amount: number;
  entry_date: string;
  from_account_id: string;
  to_account_id: string;
  created_at: string;
  created_by: string | null;
}

export type GeneralBalanceMovementType = "income" | "expense";

export interface GeneralBalanceAccountMovement {
  id: string;
  account_id: string;
  movement_type: GeneralBalanceMovementType;
  description: string;
  amount: number;
  movement_date: string;
  created_at: string;
  created_by: string | null;
}

export interface GeneralBalanceRow {
  id: string;
  label: string;
  amount: number;
  source: "works-payment-method" | "providers" | "receivable";
  description: string;
}

export interface GeneralBalanceReport {
  rows: GeneralBalanceRow[];
  total: number;
  totalWithoutDebtors: number;
  debtorsTotal: number;
  providersTotal: number;
  worksReceivableTotal: number;
}

export interface GeneralBalanceHistoryRow {
  id: string;
  date: string;
  description: string;
  expenseAccount: string;
  incomeAccount: string;
  amount: number;
  source: "works" | "projects" | "orders" | "internal-transfer" | "manual";
}

export interface GeneralBalanceAccountReport {
  account: GeneralBalanceRow;
  accounts: GeneralBalanceRow[];
  history: GeneralBalanceHistoryRow[];
}

export interface FinanceUtilityRow {
  month: string;
  projectUtility: number;
  workUtility: number;
  totalUtility: number;
}

export interface FinanceUtilityReport {
  rows: FinanceUtilityRow[];
  projectTotal: number;
  workTotal: number;
  total: number;
}

export type SalaryWeekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday";
export type EmployeeDefaultWorkType = "project" | "work" | "mixed" | "week";
export type SalaryWeekStatus = "draft" | "paid";
export type SalaryActivityType =
  | "project"
  | "work"
  | "week"
  | "hour"
  | "absent"
  | "pending";
export type SalaryPaymentType =
  | "week"
  | "project"
  | "work"
  | "bonus"
  | "discount"
  | "advance"
  | "adjustment";
export type SalaryReferenceType = "project" | "work";
export type TaskModuleType = "project" | "work" | "general";
export type SalaryRecordStatus = "draft" | "recorded" | "observed";
export type SalaryPaymentStatus = "paid";
export type SalaryAuditAction =
  | "week_created"
  | "week_updated"
  | "week_status_changed"
  | "day_record_saved"
  | "payment_saved";

export interface Employee {
  id: string;
  full_name: string;
  is_active: boolean;
  default_work_type: EmployeeDefaultWorkType;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface TaskType {
  id: string;
  name: string;
  module_type: TaskModuleType;
  is_active: boolean;
  created_at: string;
}

export interface SalaryWeek {
  id: string;
  year: number;
  month: number;
  week_start_date: string;
  week_end_date: string;
  payment_date: string;
  status: SalaryWeekStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface SalaryDayRecord {
  id: string;
  salary_week_id: string;
  employee_id: string;
  work_date: string;
  day_name: SalaryWeekday;
  activity_type: SalaryActivityType;
  project_id: string | null;
  work_id: string | null;
  task_type_id: string | null;
  notes: string | null;
  status: SalaryRecordStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface SalaryPayment {
  id: string;
  salary_week_id: string;
  employee_id: string;
  payment_type: SalaryPaymentType;
  concept: string;
  amount: number;
  payment_method_id: string;
  payment_date: string;
  project_id: string | null;
  work_id: string | null;
  task_type_id: string | null;
  notes: string | null;
  status: SalaryPaymentStatus;
  created_at: string;
  created_by: string | null;
}

export interface SalaryAuditLog {
  id: string;
  salary_week_id: string | null;
  action: SalaryAuditAction;
  description: string;
  metadata_json: string | null;
  created_at: string;
  created_by: string | null;
}

export interface SalaryDayRecordWithRelations extends SalaryDayRecord {
  employee: Employee | null;
  project: Project | null;
  work: Work | null;
  taskType: TaskType | null;
}

export interface SalaryPaymentWithRelations extends SalaryPayment {
  employee: Employee | null;
  method: PaymentMethod | null;
  project: Project | null;
  work: Work | null;
  taskType: TaskType | null;
}

export interface SalaryEmployeeWeekSummary {
  employee: Employee;
  dayRecords: Partial<Record<SalaryWeekday, SalaryDayRecordWithRelations[]>>;
  payments: SalaryPaymentWithRelations[];
  totals: {
    cash: number;
    account: number;
    projectOrWork: number;
    total: number;
  };
}

export interface SalaryWeekWithRows extends SalaryWeek {
  employees: SalaryEmployeeWeekSummary[];
  totals: {
    total: number;
    byMethod: Array<{
      methodId: string;
      methodName: string;
      total: number;
    }>;
    byPaymentType: Array<{
      paymentType: SalaryPaymentType;
      total: number;
    }>;
    pendingPayments: number;
  };
}

export interface SalaryMonthOption {
  year: number;
  month: number;
  label: string;
}

export interface SalaryReport {
  months: SalaryMonthOption[];
  selected: {
    year: number;
    month: number;
  };
  employees: Employee[];
  taskTypes: TaskType[];
  taskRates: Array<{
    taskTypeId: string;
    taskTypeName: string;
    employeeId: string | null;
    amount: number;
  }>;
  weeks: SalaryWeekWithRows[];
  paymentMethods: PaymentMethod[];
  totals: {
    totalPaid: number;
    totalPending: number;
    totalCash: number;
    totalAccount: number;
    totalProject: number;
    totalWork: number;
  };
  recentPayments: SalaryPaymentWithRelations[];
}

/* ============================================================ AUDIT ======= */

export type AuditOperation = "create" | "update" | "delete";
export type AuditEntityType =
  | "project_movement"
  | "work_movement"
  | "work_order"
  | "order_payment"
  | "salary";

export interface AuditLogRow {
  id: string;
  createdAt: string;
  userName: string;
  entityType: AuditEntityType;
  entityLabel: string;
  entityId: string;
  operation: AuditOperation;
  operationLabel: string;
  description: string | null;
  note: string | null;
  amount: number | null;
  snapshot: { before?: unknown; after?: unknown } | null;
}
