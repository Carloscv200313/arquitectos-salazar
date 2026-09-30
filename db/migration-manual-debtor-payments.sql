alter table public.manual_debtors
  add column if not exists source_account_id uuid references public.payment_accounts(id),
  add column if not exists loan_date date not null default current_date,
  add column if not exists note text;

create table if not exists public.manual_debtor_payments (
  id            uuid primary key default gen_random_uuid(),
  debtor_id     uuid not null references public.manual_debtors(id),
  payment_date  date not null default current_date,
  amount        numeric(14,2) not null default 0,
  to_account_id uuid not null references public.payment_accounts(id),
  note          text,
  status        smallint not null default 1,
  created_at    timestamptz not null default now(),
  created_by    uuid
);

-- El sistema usa usuarios propios en public.users, no auth.users.
alter table public.manual_debtors
  drop constraint if exists manual_debtors_created_by_fkey;
alter table public.manual_debtor_payments
  drop constraint if exists manual_debtor_payments_created_by_fkey;

create index if not exists manual_debtor_payments_debtor_idx
  on public.manual_debtor_payments(debtor_id)
  where status = 1;

create index if not exists manual_debtor_payments_account_idx
  on public.manual_debtor_payments(to_account_id)
  where status = 1;

alter table public.manual_debtor_payments enable row level security;

drop policy if exists "auth_select" on public.manual_debtor_payments;
create policy "auth_select" on public.manual_debtor_payments
  for select to authenticated using (true);

drop policy if exists "auth_insert" on public.manual_debtor_payments;
create policy "auth_insert" on public.manual_debtor_payments
  for insert to authenticated with check (true);

drop policy if exists "auth_update" on public.manual_debtor_payments;
create policy "auth_update" on public.manual_debtor_payments
  for update to authenticated using (true) with check (true);
