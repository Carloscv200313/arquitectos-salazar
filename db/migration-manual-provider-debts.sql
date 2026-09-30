create table if not exists public.manual_provider_debts (
  id         uuid primary key default gen_random_uuid(),
  provider   text not null,
  amount     numeric(14,2) not null default 0,
  debt_date  date not null default current_date,
  note       text,
  status     smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.manual_provider_debt_payments (
  id           uuid primary key default gen_random_uuid(),
  debt_id      uuid not null references public.manual_provider_debts(id),
  payment_date date not null default current_date,
  amount       numeric(14,2) not null default 0,
  note         text,
  status       smallint not null default 1,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id)
);

create index if not exists manual_provider_debts_provider_idx
  on public.manual_provider_debts(lower(provider))
  where status = 1;

create index if not exists manual_provider_debt_payments_debt_idx
  on public.manual_provider_debt_payments(debt_id)
  where status = 1;

drop trigger if exists set_updated_at on public.manual_provider_debts;
create trigger set_updated_at
  before update on public.manual_provider_debts
  for each row execute function public.set_updated_at();

alter table public.manual_provider_debts enable row level security;
alter table public.manual_provider_debt_payments enable row level security;

drop policy if exists "auth_select" on public.manual_provider_debts;
create policy "auth_select" on public.manual_provider_debts
  for select to authenticated using (true);
drop policy if exists "auth_insert" on public.manual_provider_debts;
create policy "auth_insert" on public.manual_provider_debts
  for insert to authenticated with check (true);
drop policy if exists "auth_update" on public.manual_provider_debts;
create policy "auth_update" on public.manual_provider_debts
  for update to authenticated using (true) with check (true);

drop policy if exists "auth_select" on public.manual_provider_debt_payments;
create policy "auth_select" on public.manual_provider_debt_payments
  for select to authenticated using (true);
drop policy if exists "auth_insert" on public.manual_provider_debt_payments;
create policy "auth_insert" on public.manual_provider_debt_payments
  for insert to authenticated with check (true);
drop policy if exists "auth_update" on public.manual_provider_debt_payments;
create policy "auth_update" on public.manual_provider_debt_payments
  for update to authenticated using (true) with check (true);
