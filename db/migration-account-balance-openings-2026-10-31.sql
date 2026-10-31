-- PREPARADA PARA REVISIÓN Y EJECUCIÓN MANUAL. NO EJECUTADA.
-- Guarda un saldo de apertura por cuenta real de Caja y Bancos. No borra ni
-- modifica movimientos anteriores. La aplicación solo necesita SELECT.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.account_balance_openings (
  account_id uuid primary key references public.payment_accounts(id),
  opening_amount numeric(14,2) not null,
  cutoff_at timestamptz not null,
  source_note text not null,
  created_at timestamptz not null default now()
);

alter table public.account_balance_openings enable row level security;
revoke all on public.account_balance_openings from public, anon, authenticated, service_role;
grant select on public.account_balance_openings to service_role;

commit;
notify pgrst, 'reload schema';

-- Reversión solo si la tabla sigue vacía: drop table public.account_balance_openings;
-- Si ya contiene saldos, conservarla y revertir primero el código: no borrar
-- importes de apertura sin respaldo y una decisión contable expresa.
