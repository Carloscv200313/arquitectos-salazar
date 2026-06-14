-- Comprobantes de pago a empleados.
-- Uno por (semana de salario · empleado · proyecto/obra). Código serie CMP-000123.
-- created_by SIN FK: el sistema usa sesión propia (tabla users), no auth.users.

create table if not exists public.salary_receipts (
  id              uuid primary key default gen_random_uuid(),
  salary_week_id  uuid not null references public.salary_weeks(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  ref_type        text not null check (ref_type in ('project','work')),
  ref_id          uuid not null,
  code            text not null,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  unique (salary_week_id, employee_id, ref_type, ref_id)
);

-- Si la tabla ya se creó con el FK a auth.users, quítalo:
alter table public.salary_receipts
  drop constraint if exists salary_receipts_created_by_fkey;
