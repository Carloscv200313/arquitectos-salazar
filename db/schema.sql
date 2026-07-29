-- ============================================================================
-- Arquitectos Salazar — Módulo de Proyectos
-- Supabase / PostgreSQL schema. Apply in the Supabase SQL editor.
--
-- Notes
--  * Money stored as numeric(14,2) — never floats — to avoid rounding drift.
--  * created_by references auth.users so RLS + auditing work once auth is added.
--  * Internal distribution is stored for operational reports and expense tracking.
--  * Financial totals (income / expense / pending / status) are computed on read.
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- updated_at trigger helper -------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── clients ────────────────────────────────────────────────────────────────
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 2 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);

create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ── payment_methods ─────────────────────────────────────────────────────────
create table if not exists public.payment_methods (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(trim(name)) between 2 and 80),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── projects ────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients (id) on delete restrict,
  name               text not null check (char_length(trim(name)) between 2 and 120),
  -- domicilio / dirección de la obra (opcional)
  address            text check (address is null or char_length(trim(address)) between 2 and 200),
  -- distribution template for the internal areas
  template           text not null default 'diamante' check (template in ('diamante', 'oro', 'especial')),
  -- base amount charged to the client
  project_amount     numeric(14,2) not null check (project_amount > 0),
  -- retained for backward compatibility with legacy data; no longer used in UI totals
  office_amount      numeric(14,2) not null default 0 check (office_amount >= 0),
  utility_amount     numeric(14,2) not null default 0 check (utility_amount >= 0),
  -- sum of additional line items (see project_addons)
  addons_total       numeric(14,2) not null default 0 check (addons_total >= 0),
  -- amount the client pays = project_amount + addons_total
  total_amount       numeric(14,2) not null check (total_amount > 0),
  -- internal distribution of project_amount for operational egresos
  proposal_amount    numeric(14,2) not null default 0 check (proposal_amount >= 0),
  modeling_3d_amount numeric(14,2) not null default 0 check (modeling_3d_amount >= 0),
  plans_amount       numeric(14,2) not null default 0 check (plans_amount >= 0),
  render_amount      numeric(14,2) not null default 0 check (render_amount >= 0),
  proposal_responsible text not null check (proposal_responsible in ('Alejandra', 'Juanfer', 'Juan Jose', 'Esmeralda', 'Sin asignar')),
  modeling_3d_responsible text not null check (modeling_3d_responsible in ('Alejandra', 'Juanfer', 'Juan Jose', 'Esmeralda', 'Sin asignar')),
  plans_responsible text not null check (plans_responsible in ('Alejandra', 'Juanfer', 'Juan Jose', 'Esmeralda', 'Sin asignar')),
  render_responsible text not null check (render_responsible in ('Alejandra', 'Juanfer', 'Juan Jose', 'Esmeralda', 'Sin asignar')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id) on delete set null
);

create index if not exists idx_projects_client on public.projects (client_id);
create index if not exists idx_projects_created on public.projects (created_at desc);

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ── project_payments (movimientos: ingresos / egresos) ──────────────────────
create table if not exists public.project_payments (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects (id) on delete cascade,
  movement_type      text not null check (movement_type in ('income', 'expense')),
  concept            text not null check (char_length(trim(concept)) between 2 and 160),
  amount             numeric(14,2) not null check (amount > 0),
  payment_date       date not null,
  payment_method_id  uuid not null references public.payment_methods (id) on delete restrict,
  internal_area      text check (internal_area in ('proposal', 'modeling_3d', 'plans', 'render')),
  receipt_code       text,
  created_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id) on delete set null
);

create index if not exists idx_payments_project on public.project_payments (project_id);
create index if not exists idx_payments_date on public.project_payments (payment_date desc);

-- ── internal_transfers (traspasos entre formas de pago) ─────────────────────
create table if not exists public.internal_transfers (
  id                      uuid primary key default gen_random_uuid(),
  description             text not null check (char_length(trim(description)) between 2 and 160),
  amount                  numeric(14,2) not null check (amount > 0),
  transfer_date           date not null,
  from_payment_method_id  uuid not null references public.payment_methods (id) on delete restrict,
  to_payment_method_id    uuid not null references public.payment_methods (id) on delete restrict,
  created_at              timestamptz not null default now(),
  created_by              uuid references auth.users (id) on delete set null,
  constraint chk_internal_transfers_different_methods
    check (from_payment_method_id <> to_payment_method_id)
);

create index if not exists idx_internal_transfers_date
  on public.internal_transfers (transfer_date desc);
create index if not exists idx_internal_transfers_from_method
  on public.internal_transfers (from_payment_method_id);
create index if not exists idx_internal_transfers_to_method
  on public.internal_transfers (to_payment_method_id);

-- ── project_addons (adicionales: levantamiento, etc.) ────────────────────────
create table if not exists public.project_addons (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  concept     text not null check (char_length(trim(concept)) between 2 and 160),
  amount      numeric(14,2) not null check (amount > 0),
  created_at  timestamptz not null default now()
);

create index if not exists idx_addons_project on public.project_addons (project_id);

-- ── works (obras) ───────────────────────────────────────────────────────────
create table if not exists public.works (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete restrict,
  name         text not null check (char_length(trim(name)) between 2 and 120),
  -- domicilio / dirección de la obra (opcional)
  address      text check (address is null or char_length(trim(address)) between 2 and 200),
  status       text not null default 'active' check (status in ('active', 'finished')),
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id) on delete set null
);

create index if not exists idx_works_client on public.works (client_id);
create index if not exists idx_works_created on public.works (created_at desc);

create trigger trg_works_updated_at
  before update on public.works
  for each row execute function public.set_updated_at();

-- ── work_movements (entradas / salidas de obra) ─────────────────────────────
create table if not exists public.work_movements (
  id             uuid primary key default gen_random_uuid(),
  work_id        uuid not null references public.works (id) on delete cascade,
  receipt        text not null check (char_length(trim(receipt)) between 1 and 80),
  movement_date  date not null,
  concept        text not null check (char_length(trim(concept)) between 2 and 160),
  supplier       text not null check (char_length(trim(supplier)) between 2 and 160),
  category       text not null,
  movement_type  text not null check (movement_type in ('income', 'expense')),
  amount         numeric(14,2) not null check (amount > 0),
  payment_method_id uuid not null references public.payment_methods (id) on delete restrict,
  observations   text,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id) on delete set null
);

create index if not exists idx_work_movements_work on public.work_movements (work_id);
create index if not exists idx_work_movements_date on public.work_movements (movement_date desc);

create table if not exists public.work_files (
  id            uuid primary key default gen_random_uuid(),
  work_id       uuid not null references public.works (id) on delete cascade,
  file_name     text not null check (char_length(trim(file_name)) between 1 and 255),
  storage_path  text not null unique,
  mime_type     text,
  size_bytes    bigint not null default 0 check (size_bytes >= 0),
  created_at    timestamptz not null default now(),
  created_by    uuid
);

create index if not exists idx_work_files_work on public.work_files (work_id);
create index if not exists idx_work_files_created on public.work_files (created_at desc);

create table if not exists public.work_category_budgets (
  id            uuid primary key default gen_random_uuid(),
  work_id       uuid not null references public.works (id) on delete cascade,
  category      text not null check (char_length(trim(category)) between 2 and 120),
  amount        numeric(14,2) not null default 0 check (amount >= 0),
  executed_amount numeric(14,2) not null default 0 check (executed_amount >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  unique (work_id, category)
);

create index if not exists idx_work_category_budgets_work
  on public.work_category_budgets (work_id);

create trigger trg_work_category_budgets_updated_at
  before update on public.work_category_budgets
  for each row execute function public.set_updated_at();

-- ── work_internal_transfers (traspasos propios de Obras) ────────────────────
create table if not exists public.work_internal_transfers (
  id                      uuid primary key default gen_random_uuid(),
  description             text not null check (char_length(trim(description)) between 2 and 160),
  amount                  numeric(14,2) not null check (amount > 0),
  transfer_date           date not null,
  from_payment_method_id  uuid not null references public.payment_methods (id) on delete restrict,
  to_payment_method_id    uuid not null references public.payment_methods (id) on delete restrict,
  created_at              timestamptz not null default now(),
  created_by              uuid references auth.users (id) on delete set null,
  constraint chk_work_internal_transfers_different_methods
    check (from_payment_method_id <> to_payment_method_id)
);

create index if not exists idx_work_internal_transfers_date
  on public.work_internal_transfers (transfer_date desc);
create index if not exists idx_work_internal_transfers_from_method
  on public.work_internal_transfers (from_payment_method_id);
create index if not exists idx_work_internal_transfers_to_method
  on public.work_internal_transfers (to_payment_method_id);

-- ── work_orders (pedidos por obra) ──────────────────────────────────────────
create table if not exists public.work_orders (
  id                   uuid primary key default gen_random_uuid(),
  work_id              uuid not null references public.works (id) on delete cascade,
  source               text not null default 'internal' check (source in ('internal', 'public')),
  order_date           date not null,
  supplier             text not null check (char_length(trim(supplier)) between 2 and 160),
  material             text not null check (char_length(trim(material)) between 2 and 1000),
  description          text,
  category             text,
  amount               numeric(14,2) check (amount > 0),
  quoted_at            date,
  payable_movement_id  uuid references public.work_movements (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references auth.users (id) on delete set null
);

create index if not exists idx_work_orders_work on public.work_orders (work_id);
create index if not exists idx_work_orders_date on public.work_orders (order_date desc);

create trigger trg_work_orders_updated_at
  before update on public.work_orders
  for each row execute function public.set_updated_at();

-- ── work_order_payments (abonos de pedidos) ─────────────────────────────────
create table if not exists public.work_order_payments (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.work_orders (id) on delete cascade,
  payment_date          date not null,
  description           text not null check (char_length(trim(description)) between 2 and 160),
  amount                numeric(14,2) not null check (amount > 0),
  payment_method_id     uuid not null references public.payment_methods (id) on delete restrict,
  work_movement_id      uuid references public.work_movements (id) on delete set null,
  internal_transfer_id  uuid references public.work_internal_transfers (id) on delete set null,
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id) on delete set null
);

create index if not exists idx_work_order_payments_order
  on public.work_order_payments (order_id);
create index if not exists idx_work_order_payments_date
  on public.work_order_payments (payment_date desc);

-- ── finance_manual_debtors (deudores manuales de Finanzas) ──────────────────
create table if not exists public.finance_manual_debtors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 2 and 120),
  amount      numeric(14,2) not null check (amount >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);

create trigger trg_finance_manual_debtors_updated_at
  before update on public.finance_manual_debtors
  for each row execute function public.set_updated_at();

-- ── general_balance_entries (registros manuales del Caja y Bancos) ─────────
create table if not exists public.general_balance_entries (
  id               uuid primary key default gen_random_uuid(),
  description      text not null check (char_length(trim(description)) between 2 and 160),
  amount           numeric(14,2) not null check (amount > 0),
  entry_date       date not null,
  from_account_id  text not null check (char_length(trim(from_account_id)) between 2 and 80),
  to_account_id    text not null check (char_length(trim(to_account_id)) between 2 and 80),
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  constraint chk_general_balance_entries_different_accounts
    check (from_account_id <> to_account_id)
);

create index if not exists idx_general_balance_entries_date
  on public.general_balance_entries (entry_date desc);
create index if not exists idx_general_balance_entries_from_account
  on public.general_balance_entries (from_account_id);
create index if not exists idx_general_balance_entries_to_account
  on public.general_balance_entries (to_account_id);

-- ── general_balance_account_movements (ingresos/egresos directos por cuenta)
create table if not exists public.general_balance_account_movements (
  id             uuid primary key default gen_random_uuid(),
  account_id     text not null check (char_length(trim(account_id)) between 2 and 80),
  movement_type  text not null check (movement_type in ('income', 'expense')),
  description    text not null check (char_length(trim(description)) between 2 and 160),
  amount         numeric(14,2) not null check (amount > 0),
  movement_date  date not null,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id) on delete set null
);

create index if not exists idx_general_balance_account_movements_account
  on public.general_balance_account_movements (account_id);
create index if not exists idx_general_balance_account_movements_date
  on public.general_balance_account_movements (movement_date desc);

-- ── salary_weeks (cabecera semanal de salarios) ─────────────────────────────
create table if not exists public.salary_weeks (
  id               uuid primary key default gen_random_uuid(),
  year             integer not null check (year between 2000 and 2100),
  month            integer not null check (month between 1 and 12),
  week_start_date  date not null,
  week_end_date    date not null,
  payment_date     date not null,
  status           text not null default 'draft' check (status in ('draft', 'paid')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  constraint chk_salary_weeks_range
    check (week_end_date >= week_start_date),
  constraint chk_salary_weeks_payment_date
    check (payment_date >= week_start_date)
);

create index if not exists idx_salary_weeks_end_date
  on public.salary_weeks (week_end_date desc);
create index if not exists idx_salary_weeks_month
  on public.salary_weeks (year desc, month desc, week_start_date desc);

create trigger trg_salary_weeks_updated_at
  before update on public.salary_weeks
  for each row execute function public.set_updated_at();

-- ── employees (catálogo dinámico para Salario) ──────────────────────────────
create table if not exists public.employees (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text not null check (char_length(trim(full_name)) between 2 and 120),
  is_active          boolean not null default true,
  default_work_type  text not null check (default_work_type in ('project', 'work', 'mixed', 'week')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id) on delete set null
);

create trigger trg_employees_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

-- ── task_types (catálogo de tareas) ─────────────────────────────────────────
create table if not exists public.task_types (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(trim(name)) between 2 and 120),
  module_type  text not null check (module_type in ('project', 'work', 'general')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists idx_task_types_name
  on public.task_types (name);

-- ── salary_day_records (actividad diaria por empleado) ──────────────────────
create table if not exists public.salary_day_records (
  id             uuid primary key default gen_random_uuid(),
  salary_week_id uuid not null references public.salary_weeks (id) on delete cascade,
  employee_id    uuid not null references public.employees (id) on delete restrict,
  work_date      date not null,
  day_name       text not null check (day_name in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday')),
  activity_type  text not null check (activity_type in ('project', 'work', 'week', 'hour', 'absent', 'pending')),
  project_id     uuid references public.projects (id) on delete set null,
  work_id        uuid references public.works (id) on delete set null,
  task_type_id   uuid references public.task_types (id) on delete set null,
  notes          text,
  status         text not null default 'recorded' check (status in ('draft', 'recorded', 'observed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id) on delete set null
);

create index if not exists idx_salary_day_records_week
  on public.salary_day_records (salary_week_id);
create index if not exists idx_salary_day_records_employee
  on public.salary_day_records (employee_id, work_date);

create trigger trg_salary_day_records_updated_at
  before update on public.salary_day_records
  for each row execute function public.set_updated_at();

-- ── salary_payments (pagos salariales) ──────────────────────────────────────
create table if not exists public.salary_payments (
  id                uuid primary key default gen_random_uuid(),
  salary_week_id    uuid not null references public.salary_weeks (id) on delete cascade,
  employee_id       uuid not null references public.employees (id) on delete restrict,
  payment_type      text not null check (payment_type in ('week', 'project', 'work', 'bonus', 'discount', 'advance', 'adjustment')),
  concept           text not null check (char_length(trim(concept)) between 2 and 160),
  amount            numeric(14,2) not null check (amount > 0),
  payment_method_id uuid not null references public.payment_methods (id) on delete restrict,
  payment_date      date not null,
  project_id        uuid references public.projects (id) on delete set null,
  work_id           uuid references public.works (id) on delete set null,
  task_type_id      uuid references public.task_types (id) on delete set null,
  notes             text,
  status            text not null default 'paid' check (status in ('paid')),
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null
);

create index if not exists idx_salary_payments_week
  on public.salary_payments (salary_week_id);
create index if not exists idx_salary_payments_employee
  on public.salary_payments (employee_id, payment_date desc);

-- ── salary_audit_logs (auditoría) ───────────────────────────────────────────
create table if not exists public.salary_audit_logs (
  id             uuid primary key default gen_random_uuid(),
  salary_week_id uuid references public.salary_weeks (id) on delete set null,
  action         text not null check (action in ('week_created', 'week_updated', 'week_status_changed', 'day_record_saved', 'payment_saved')),
  description    text not null check (char_length(trim(description)) between 2 and 200),
  metadata_json  text,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id) on delete set null
);

-- ── seed payment methods ─────────────────────────────────────────────────────
insert into public.payment_methods (name)
values
  ('Cuentas por pagar'),
  ('Efectivo'),
  ('Caja'),
  ('Cuenta de Rosa'),
  ('Cuenta de Silvia'),
  ('Cuenta fiscal')
on conflict (name) do nothing;

-- ============================================================================
-- Row Level Security
-- Phase 1 has no auth yet. These policies allow any authenticated user full
-- access and lock out anonymous clients. Tighten per-role in a later phase.
-- ============================================================================
alter table public.clients          enable row level security;
alter table public.payment_methods  enable row level security;
alter table public.projects         enable row level security;
alter table public.project_payments enable row level security;
alter table public.project_addons   enable row level security;
alter table public.internal_transfers enable row level security;
alter table public.works            enable row level security;
alter table public.work_movements   enable row level security;
alter table public.work_files       enable row level security;
alter table public.work_category_budgets enable row level security;
alter table public.work_internal_transfers enable row level security;
alter table public.work_orders      enable row level security;
alter table public.work_order_payments enable row level security;
alter table public.finance_manual_debtors enable row level security;
alter table public.general_balance_entries enable row level security;
alter table public.general_balance_account_movements enable row level security;
alter table public.employees enable row level security;
alter table public.task_types enable row level security;
alter table public.salary_weeks enable row level security;
alter table public.salary_day_records enable row level security;
alter table public.salary_payments enable row level security;
alter table public.salary_audit_logs enable row level security;

-- clients
create policy "clients_select" on public.clients
  for select to authenticated using (true);
create policy "clients_insert" on public.clients
  for insert to authenticated with check (true);
create policy "clients_update" on public.clients
  for update to authenticated using (true) with check (true);

-- payment_methods (read-only for app users)
create policy "methods_select" on public.payment_methods
  for select to authenticated using (true);

-- projects
create policy "projects_select" on public.projects
  for select to authenticated using (true);
create policy "projects_insert" on public.projects
  for insert to authenticated with check (true);
create policy "projects_update" on public.projects
  for update to authenticated using (true) with check (true);
create policy "projects_delete" on public.projects
  for delete to authenticated using (true);

-- project_payments
create policy "payments_select" on public.project_payments
  for select to authenticated using (true);
create policy "payments_insert" on public.project_payments
  for insert to authenticated with check (true);
create policy "payments_delete" on public.project_payments
  for delete to authenticated using (true);

-- internal_transfers
create policy "internal_transfers_select" on public.internal_transfers
  for select to authenticated using (true);
create policy "internal_transfers_insert" on public.internal_transfers
  for insert to authenticated with check (true);
create policy "internal_transfers_delete" on public.internal_transfers
  for delete to authenticated using (true);

-- project_addons
create policy "addons_select" on public.project_addons
  for select to authenticated using (true);
create policy "addons_insert" on public.project_addons
  for insert to authenticated with check (true);
create policy "addons_delete" on public.project_addons
  for delete to authenticated using (true);

-- works
create policy "works_select" on public.works
  for select to authenticated using (true);
create policy "works_insert" on public.works
  for insert to authenticated with check (true);
create policy "works_update" on public.works
  for update to authenticated using (true) with check (true);
create policy "works_delete" on public.works
  for delete to authenticated using (true);

-- work_movements
create policy "work_movements_select" on public.work_movements
  for select to authenticated using (true);
create policy "work_movements_insert" on public.work_movements
  for insert to authenticated with check (true);
create policy "work_movements_delete" on public.work_movements
  for delete to authenticated using (true);

-- work_internal_transfers
create policy "work_internal_transfers_select" on public.work_internal_transfers
  for select to authenticated using (true);
create policy "work_internal_transfers_insert" on public.work_internal_transfers
  for insert to authenticated with check (true);
create policy "work_internal_transfers_delete" on public.work_internal_transfers
  for delete to authenticated using (true);

-- work_files
create policy "work_files_select" on public.work_files
  for select to authenticated using (true);
create policy "work_files_insert" on public.work_files
  for insert to authenticated with check (true);
create policy "work_files_delete" on public.work_files
  for delete to authenticated using (true);

-- work_category_budgets
create policy "work_category_budgets_select" on public.work_category_budgets
  for select to authenticated using (true);
create policy "work_category_budgets_insert" on public.work_category_budgets
  for insert to authenticated with check (true);
create policy "work_category_budgets_update" on public.work_category_budgets
  for update to authenticated using (true) with check (true);
create policy "work_category_budgets_delete" on public.work_category_budgets
  for delete to authenticated using (true);

-- work_orders
create policy "work_orders_select" on public.work_orders
  for select to authenticated using (true);
create policy "work_orders_insert" on public.work_orders
  for insert to authenticated with check (true);
create policy "work_orders_update" on public.work_orders
  for update to authenticated using (true) with check (true);
create policy "work_orders_delete" on public.work_orders
  for delete to authenticated using (true);

-- work_order_payments
create policy "work_order_payments_select" on public.work_order_payments
  for select to authenticated using (true);
create policy "work_order_payments_insert" on public.work_order_payments
  for insert to authenticated with check (true);
create policy "work_order_payments_delete" on public.work_order_payments
  for delete to authenticated using (true);

-- finance_manual_debtors
create policy "finance_manual_debtors_select" on public.finance_manual_debtors
  for select to authenticated using (true);
create policy "finance_manual_debtors_insert" on public.finance_manual_debtors
  for insert to authenticated with check (true);
create policy "finance_manual_debtors_update" on public.finance_manual_debtors
  for update to authenticated using (true) with check (true);
create policy "finance_manual_debtors_delete" on public.finance_manual_debtors
  for delete to authenticated using (true);

-- general_balance_entries
create policy "general_balance_entries_select" on public.general_balance_entries
  for select to authenticated using (true);
create policy "general_balance_entries_insert" on public.general_balance_entries
  for insert to authenticated with check (true);
create policy "general_balance_entries_delete" on public.general_balance_entries
  for delete to authenticated using (true);

-- general_balance_account_movements
create policy "general_balance_account_movements_select" on public.general_balance_account_movements
  for select to authenticated using (true);
create policy "general_balance_account_movements_insert" on public.general_balance_account_movements
  for insert to authenticated with check (true);
create policy "general_balance_account_movements_delete" on public.general_balance_account_movements
  for delete to authenticated using (true);

-- salary_weeks
create policy "salary_weeks_select" on public.salary_weeks
  for select to authenticated using (true);
create policy "salary_weeks_insert" on public.salary_weeks
  for insert to authenticated with check (true);
create policy "salary_weeks_update" on public.salary_weeks
  for update to authenticated using (true) with check (true);
create policy "salary_weeks_delete" on public.salary_weeks
  for delete to authenticated using (true);

-- employees
create policy "employees_select" on public.employees
  for select to authenticated using (true);
create policy "employees_insert" on public.employees
  for insert to authenticated with check (true);
create policy "employees_update" on public.employees
  for update to authenticated using (true) with check (true);
create policy "employees_delete" on public.employees
  for delete to authenticated using (true);

-- task_types
create policy "task_types_select" on public.task_types
  for select to authenticated using (true);
create policy "task_types_insert" on public.task_types
  for insert to authenticated with check (true);
create policy "task_types_update" on public.task_types
  for update to authenticated using (true) with check (true);
create policy "task_types_delete" on public.task_types
  for delete to authenticated using (true);

-- salary_day_records
create policy "salary_day_records_select" on public.salary_day_records
  for select to authenticated using (true);
create policy "salary_day_records_insert" on public.salary_day_records
  for insert to authenticated with check (true);
create policy "salary_day_records_update" on public.salary_day_records
  for update to authenticated using (true) with check (true);
create policy "salary_day_records_delete" on public.salary_day_records
  for delete to authenticated using (true);

-- salary_payments
create policy "salary_payments_select" on public.salary_payments
  for select to authenticated using (true);
create policy "salary_payments_insert" on public.salary_payments
  for insert to authenticated with check (true);
create policy "salary_payments_update" on public.salary_payments
  for update to authenticated using (true) with check (true);
create policy "salary_payments_delete" on public.salary_payments
  for delete to authenticated using (true);

-- salary_audit_logs
create policy "salary_audit_logs_select" on public.salary_audit_logs
  for select to authenticated using (true);
create policy "salary_audit_logs_insert" on public.salary_audit_logs
  for insert to authenticated with check (true);
create policy "salary_audit_logs_delete" on public.salary_audit_logs
  for delete to authenticated using (true);
