-- ============================================================================
-- Arquitectos Salazar — Esquema Supabase (Postgres)
-- Ejecutar completo en el SQL Editor de Supabase.
-- Convenciones:
--   * Soft delete con status smallint (1 = activo, 0 = oculto/eliminado).
--   * created_at / updated_at / created_by en todas las tablas importantes.
--   * RLS habilitado; políticas para usuarios autenticados.
--   * Trigger set_updated_at mantiene updated_at.
-- Idempotente: usa "if not exists" y "create or replace" donde aplica.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Auto-perfil + app_user al registrarse en auth.users (rol Administrador).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  admin_role_id uuid;
begin
  select id into admin_role_id from public.roles where name = 'Administrador' limit 1;

  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;

  insert into public.app_users (auth_user_id, email, full_name, role_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    admin_role_id
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Roles
-- ----------------------------------------------------------------------------
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  status      smallint not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Profiles (datos extra del usuario autenticado)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  full_name  text,
  avatar_url text,
  status     smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- App users (usuarios del sistema). La contraseña vive SOLO en auth.users.
-- ----------------------------------------------------------------------------
create table if not exists public.app_users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text not null unique,
  role_id       uuid references public.roles(id),
  avatar_url    text,
  last_login_at timestamptz,
  status        smallint not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);
create index if not exists app_users_role_idx on public.app_users(role_id);
create index if not exists app_users_status_idx on public.app_users(status);

-- ----------------------------------------------------------------------------
-- Catálogos administrables
-- ----------------------------------------------------------------------------
create table if not exists public.employees (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null,
  default_work_type text not null default 'mixed'
                    check (default_work_type in ('project','work','mixed','week')),
  status            smallint not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)
);

create table if not exists public.payment_accounts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  status      smallint not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create table if not exists public.task_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  module_type text not null default 'general'
              check (module_type in ('project','work','general')),
  status      smallint not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create table if not exists public.providers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  status      smallint not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create table if not exists public.work_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  status      smallint not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create table if not exists public.system_settings (
  id            uuid primary key default gen_random_uuid(),
  setting_key   text not null unique,
  setting_value text,
  description   text,
  status        smallint not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create table if not exists public.help_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  content     text not null,
  section     text not null default 'general',
  order_index int  not null default 0,
  status      smallint not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

-- ----------------------------------------------------------------------------
-- Auditoría
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id),
  action      text not null,
  table_name  text,
  record_id   text,
  description text,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_user_idx on public.audit_logs(user_id);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at);

-- ----------------------------------------------------------------------------
-- Dominio: Clientes y Proyectos
-- ----------------------------------------------------------------------------
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  status     smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.projects (
  id                     uuid primary key default gen_random_uuid(),
  client_id              uuid not null references public.clients(id),
  name                   text not null,
  template               text not null default 'diamante'
                         check (template in ('diamante','oro','especial')),
  project_amount         numeric(14,2) not null default 0,
  office_amount          numeric(14,2) not null default 0,
  utility_amount         numeric(14,2) not null default 0,
  addons_total           numeric(14,2) not null default 0,
  total_amount           numeric(14,2) not null default 0,
  proposal_amount        numeric(14,2) not null default 0,
  modeling_3d_amount     numeric(14,2) not null default 0,
  plans_amount           numeric(14,2) not null default 0,
  render_amount          numeric(14,2) not null default 0,
  proposal_responsible   text,
  modeling_3d_responsible text,
  plans_responsible      text,
  render_responsible     text,
  status                 smallint not null default 1,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid references auth.users(id)
);
create index if not exists projects_client_idx on public.projects(client_id);

create table if not exists public.project_addons (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  concept    text not null,
  amount     numeric(14,2) not null default 0,
  status     smallint not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.project_payments (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  movement_type     text not null check (movement_type in ('income','expense')),
  concept           text not null,
  amount            numeric(14,2) not null default 0,
  payment_date      date not null,
  payment_method_id uuid references public.payment_accounts(id),
  internal_area     text check (internal_area in ('proposal','modeling_3d','plans','render')),
  status            smallint not null default 1,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)
);
create index if not exists project_payments_project_idx on public.project_payments(project_id);

create table if not exists public.internal_transfers (
  id                     uuid primary key default gen_random_uuid(),
  description            text not null,
  amount                 numeric(14,2) not null default 0,
  transfer_date          date not null,
  from_payment_method_id uuid references public.payment_accounts(id),
  to_payment_method_id   uuid references public.payment_accounts(id),
  status                 smallint not null default 1,
  created_at             timestamptz not null default now(),
  created_by             uuid references auth.users(id)
);

-- ----------------------------------------------------------------------------
-- Dominio: Obras
-- ----------------------------------------------------------------------------
create table if not exists public.works (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id),
  name        text not null,
  work_status text not null default 'active' check (work_status in ('active','finished')),
  description text,
  status      smallint not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create table if not exists public.work_movements (
  id                uuid primary key default gen_random_uuid(),
  work_id           uuid not null references public.works(id) on delete cascade,
  receipt           text,
  movement_date     date not null,
  concept           text not null,
  supplier          text,
  category          text,
  movement_type     text not null check (movement_type in ('income','expense')),
  amount            numeric(14,2) not null default 0,
  payment_method_id uuid references public.payment_accounts(id),
  observations      text,
  status            smallint not null default 1,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)
);
create index if not exists work_movements_work_idx on public.work_movements(work_id);

create table if not exists public.work_internal_transfers (
  id                     uuid primary key default gen_random_uuid(),
  description            text not null,
  amount                 numeric(14,2) not null default 0,
  transfer_date          date not null,
  from_payment_method_id uuid references public.payment_accounts(id),
  to_payment_method_id   uuid references public.payment_accounts(id),
  status                 smallint not null default 1,
  created_at             timestamptz not null default now(),
  created_by             uuid references auth.users(id)
);

-- ----------------------------------------------------------------------------
-- Dominio: Pedidos
-- ----------------------------------------------------------------------------
create table if not exists public.work_orders (
  id                  uuid primary key default gen_random_uuid(),
  work_id             uuid not null references public.works(id) on delete cascade,
  order_date          date not null,
  supplier            text not null,
  material            text not null,
  description         text,
  category            text,
  amount              numeric(14,2),
  quoted_at           timestamptz,
  payable_movement_id uuid references public.work_movements(id),
  status              smallint not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id)
);
create index if not exists work_orders_work_idx on public.work_orders(work_id);

create table if not exists public.work_order_payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.work_orders(id) on delete cascade,
  payment_date        date not null,
  description         text not null,
  amount              numeric(14,2) not null default 0,
  payment_method_id   uuid references public.payment_accounts(id),
  work_movement_id    uuid references public.work_movements(id),
  internal_transfer_id uuid references public.work_internal_transfers(id),
  status              smallint not null default 1,
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id)
);

-- ----------------------------------------------------------------------------
-- Dominio: Salarios
-- ----------------------------------------------------------------------------
create table if not exists public.salary_weeks (
  id              uuid primary key default gen_random_uuid(),
  year            int not null,
  month           int not null,
  week_start_date date not null,
  week_end_date   date not null,
  payment_date    date not null,
  week_status     text not null default 'draft' check (week_status in ('draft','paid')),
  status          smallint not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create table if not exists public.salary_day_records (
  id             uuid primary key default gen_random_uuid(),
  salary_week_id uuid not null references public.salary_weeks(id) on delete cascade,
  employee_id    uuid not null references public.employees(id),
  work_date      date not null,
  day_name       text not null check (day_name in ('monday','tuesday','wednesday','thursday','friday')),
  activity_type  text not null default 'pending' check (activity_type in ('project','work','absent','pending','week')),
  project_id     uuid references public.projects(id),
  work_id        uuid references public.works(id),
  task_type_id   uuid references public.task_types(id),
  notes          text,
  record_status  text not null default 'draft' check (record_status in ('draft','recorded','observed')),
  status         smallint not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id)
);
create index if not exists salary_day_week_idx on public.salary_day_records(salary_week_id);

create table if not exists public.salary_payments (
  id                uuid primary key default gen_random_uuid(),
  salary_week_id    uuid not null references public.salary_weeks(id) on delete cascade,
  employee_id       uuid not null references public.employees(id),
  payment_type      text not null check (payment_type in ('week','project','work','bonus','discount','advance','adjustment')),
  concept           text not null,
  amount            numeric(14,2) not null default 0,
  payment_method_id uuid references public.payment_accounts(id),
  payment_date      date not null,
  project_id        uuid references public.projects(id),
  work_id           uuid references public.works(id),
  task_type_id      uuid references public.task_types(id),
  notes             text,
  payment_status    text not null default 'paid' check (payment_status in ('paid')),
  status            smallint not null default 1,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)
);
create index if not exists salary_payments_week_idx on public.salary_payments(salary_week_id);

-- ----------------------------------------------------------------------------
-- Finanzas: deudores y balance manual
-- ----------------------------------------------------------------------------
create table if not exists public.manual_debtors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  amount     numeric(14,2) not null default 0,
  status     smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.general_balance_entries (
  id              uuid primary key default gen_random_uuid(),
  description     text not null,
  amount          numeric(14,2) not null default 0,
  entry_date      date not null,
  from_account_id text not null,
  to_account_id   text not null,
  status          smallint not null default 1,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create table if not exists public.general_balance_account_movements (
  id            uuid primary key default gen_random_uuid(),
  account_id    text not null,
  movement_type text not null check (movement_type in ('income','expense')),
  description   text not null,
  amount        numeric(14,2) not null default 0,
  movement_date date not null,
  status        smallint not null default 1,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

-- ============================================================================
-- Triggers updated_at
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'roles','profiles','app_users','employees','payment_accounts','task_types',
    'system_settings','help_items','clients','projects','works','work_orders',
    'salary_weeks','salary_day_records','manual_debtors'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- Trigger de creación de usuario (auth.users -> profiles + app_users)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- RLS: habilitar + políticas para usuarios autenticados
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'roles','profiles','app_users','employees','payment_accounts','task_types',
    'system_settings','help_items','audit_logs','clients','projects','project_addons',
    'project_payments','internal_transfers','works','work_movements',
    'work_internal_transfers','work_orders','work_order_payments','salary_weeks',
    'salary_day_records','salary_payments','manual_debtors','general_balance_entries',
    'general_balance_account_movements'
  ] loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "auth_select" on public.%I;', t);
    execute format(
      'create policy "auth_select" on public.%I for select to authenticated using (true);', t);

    execute format('drop policy if exists "auth_insert" on public.%I;', t);
    execute format(
      'create policy "auth_insert" on public.%I for insert to authenticated with check (true);', t);

    execute format('drop policy if exists "auth_update" on public.%I;', t);
    execute format(
      'create policy "auth_update" on public.%I for update to authenticated using (true) with check (true);', t);
    -- Nota: sin política de DELETE a propósito (soft delete vía update status=0).
  end loop;
end $$;

-- ============================================================================
-- Seeds iniciales
-- ============================================================================
insert into public.roles (name, description) values
  ('Administrador', 'Acceso total al sistema')
on conflict (name) do nothing;

create unique index if not exists payment_accounts_name_uidx
  on public.payment_accounts (name);
create unique index if not exists task_types_name_uidx
  on public.task_types (name);

insert into public.payment_accounts (name, description) values
  ('Caja', 'Efectivo en caja'),
  ('Cuenta de Rosa', 'Cuenta bancaria de Rosa'),
  ('Cuenta de Silvia', 'Cuenta bancaria de Silvia'),
  ('Cuenta fiscal', 'Cuenta para movimientos fiscales'),
  ('BBVA', 'Cuenta BBVA'),
  ('Efectivo', 'Efectivo general'),
  ('Cuentas por pagar', 'Saldo pendiente a proveedores')
on conflict (name) do nothing;

insert into public.task_types (name, module_type) values
  ('Propuesta', 'project'),
  ('Modelado 3D', 'project'),
  ('Planos', 'project'),
  ('Render', 'project'),
  ('Costos', 'general'),
  ('Supervisión', 'work'),
  ('Obra', 'work'),
  ('Otro', 'general')
on conflict (name) do nothing;

insert into public.providers (name) values
  ('Estribadora'),
  ('Concretos LOPAR'),
  ('Materiales Aguilar'),
  ('Mat. Gonzalez'),
  ('Mat. Quezada'),
  ('Caracol Betania'),
  ('Caracol Ayotlán'),
  ('Alfarería León'),
  ('Logonza'),
  ('Maderería Paisa'),
  ('Master Block')
on conflict (name) do nothing;

insert into public.work_categories (name) values
  ('Carpintería'),
  ('Material de construcción'),
  ('Material de obras'),
  ('Instalaciones'),
  ('Maquinaria'),
  ('Equipo y herramientas'),
  ('Herrería'),
  ('Aluminio'),
  ('Tabla roca'),
  ('Honorarios'),
  ('Servicio'),
  ('Pintura'),
  ('Cantera'),
  ('Granito'),
  ('Yeso')
on conflict (name) do nothing;

insert into public.help_items (title, content, section, order_index) values
  ('¿Qué es Arquitectos Salazar?', 'Sistema interno para gestionar proyectos, obras, pedidos, finanzas y salarios del estudio.', 'general', 1),
  ('Crear un proyecto', 'Ve a Proyectos > Nuevo proyecto. Elige plantilla (Diamante/Oro/Especial), cliente, monto y adicionales. La distribución interna se calcula sola.', 'proyectos', 2),
  ('Registrar un abono', 'Abre un proyecto u obra y usa Registrar movimiento. Selecciona la cuenta de pago y el monto; el saldo se actualiza automáticamente.', 'finanzas', 3),
  ('Módulo de salarios', 'Crea una semana, asigna actividades por día y registra pagos por empleado. Un pago parcial basta para cerrar; no se permite dejar un trabajo sin reconocer.', 'salarios', 4),
  ('Estados del sistema', 'Los registros usan eliminación lógica: status=1 activo, status=0 oculto. Nada se borra físicamente.', 'general', 5)
on conflict do nothing;

insert into public.system_settings (setting_key, setting_value, description) values
  ('company_name', 'Arquitectos Salazar', 'Nombre de la empresa'),
  ('currency', 'MXN', 'Moneda del sistema'),
  ('locale', 'es-MX', 'Locale de formato')
on conflict (setting_key) do nothing;

-- ============================================================================
-- Fin del script
-- ============================================================================
