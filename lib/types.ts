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
