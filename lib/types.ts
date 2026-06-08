// Domain types for the Projects module.
// Kept framework-agnostic so the data layer (local or Supabase) can implement them.

export type PaymentStatus = "pending" | "partial" | "paid";
export type MovementType = "income" | "expense";
export type InternalArea = "proposal" | "modeling_3d" | "plans" | "render";

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

export interface WorkWithFinance extends Work {
  client: Client;
  finance: WorkFinance;
}

export interface WorkMovementWithBalance extends WorkMovement {
  balance: number;
  method: PaymentMethod | null;
}

export interface WorkCategorySummary {
  category: string;
  income: number;
  expense: number;
  balance: number;
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
  source: "manual" | "works";
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
  source: "works" | "internal-transfer" | "manual";
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
