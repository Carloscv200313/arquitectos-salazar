alter table public.provider_debt_settlements
  add column if not exists from_account_id uuid;

alter table public.manual_provider_debt_payments
  add column if not exists from_account_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_debt_settlements_from_account_id_fkey'
      and conrelid = 'public.provider_debt_settlements'::regclass
  ) then
    alter table public.provider_debt_settlements
      add constraint provider_debt_settlements_from_account_id_fkey
      foreign key (from_account_id) references public.payment_accounts(id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'manual_provider_debt_payments_from_account_id_fkey'
      and conrelid = 'public.manual_provider_debt_payments'::regclass
  ) then
    alter table public.manual_provider_debt_payments
      add constraint manual_provider_debt_payments_from_account_id_fkey
      foreign key (from_account_id) references public.payment_accounts(id);
  end if;
end;
$$;

create index if not exists provider_debt_settlements_from_account_idx
  on public.provider_debt_settlements(from_account_id)
  where status = 1;

create index if not exists manual_provider_debt_payments_from_account_idx
  on public.manual_provider_debt_payments(from_account_id)
  where status = 1;
