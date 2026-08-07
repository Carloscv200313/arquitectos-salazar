create table if not exists public.provider_debt_settlements (
  id              uuid primary key default gen_random_uuid(),
  provider        text not null,
  source_type     text not null check (source_type in ('work_order','work_movement')),
  source_id       uuid not null,
  amount          numeric(14,2) not null default 0,
  settlement_date date not null default current_date,
  note            text,
  status          smallint not null default 1,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create index if not exists provider_debt_settlements_source_idx
  on public.provider_debt_settlements(source_type, source_id)
  where status = 1;

create index if not exists provider_debt_settlements_provider_idx
  on public.provider_debt_settlements(lower(provider))
  where status = 1;

alter table public.provider_debt_settlements enable row level security;

drop policy if exists "auth_select" on public.provider_debt_settlements;
create policy "auth_select" on public.provider_debt_settlements
  for select to authenticated using (true);

drop policy if exists "auth_insert" on public.provider_debt_settlements;
create policy "auth_insert" on public.provider_debt_settlements
  for insert to authenticated with check (true);

drop policy if exists "auth_update" on public.provider_debt_settlements;
create policy "auth_update" on public.provider_debt_settlements
  for update to authenticated using (true) with check (true);
