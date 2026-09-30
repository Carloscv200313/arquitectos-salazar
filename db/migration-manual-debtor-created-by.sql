-- Los UUID de created_by pertenecen a public.users, no a auth.users.
alter table public.manual_debtors
  drop constraint if exists manual_debtors_created_by_fkey;

alter table public.manual_debtor_payments
  drop constraint if exists manual_debtor_payments_created_by_fkey;
