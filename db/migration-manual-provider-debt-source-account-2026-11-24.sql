-- PROPUESTA PARA EJECUCION MANUAL; NO EJECUTADA.
-- Agrega la cuenta asociada a las deudas manuales de proveedor y corrige
-- created_by para usar los usuarios internos de public.users.
-- No modifica montos, saldos ni registros existentes.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.manual_provider_debts
  add column if not exists source_account_id uuid;

alter table public.manual_provider_debts
  drop constraint if exists manual_provider_debts_source_account_id_fkey;
alter table public.manual_provider_debts
  add constraint manual_provider_debts_source_account_id_fkey
  foreign key (source_account_id) references public.payment_accounts(id) not valid;

create index if not exists manual_provider_debts_source_account_idx
  on public.manual_provider_debts(source_account_id)
  where status = 1;

alter table public.manual_provider_debts
  drop constraint if exists manual_provider_debts_created_by_fkey;
alter table public.manual_provider_debts
  add constraint manual_provider_debts_created_by_fkey
  foreign key (created_by) references public.users(id) not valid;

alter table public.manual_provider_debt_payments
  drop constraint if exists manual_provider_debt_payments_created_by_fkey;
alter table public.manual_provider_debt_payments
  add constraint manual_provider_debt_payments_created_by_fkey
  foreign key (created_by) references public.users(id) not valid;

commit;

-- Validacion posterior de solo lectura:
-- select count(*) as cuentas_inexistentes
-- from public.manual_provider_debts d
-- left join public.payment_accounts a on a.id = d.source_account_id
-- where d.source_account_id is not null and a.id is null;
--
-- select count(*) as usuarios_inexistentes
-- from (
--   select created_by from public.manual_provider_debts
--   union all
--   select created_by from public.manual_provider_debt_payments
-- ) x
-- left join public.users u on u.id = x.created_by
-- where x.created_by is not null and u.id is null;
--
-- Si ambos conteos son 0:
-- alter table public.manual_provider_debts
--   validate constraint manual_provider_debts_source_account_id_fkey;
-- alter table public.manual_provider_debts
--   validate constraint manual_provider_debts_created_by_fkey;
-- alter table public.manual_provider_debt_payments
--   validate constraint manual_provider_debt_payments_created_by_fkey;
