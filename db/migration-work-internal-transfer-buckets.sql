alter table public.work_internal_transfers
  add column if not exists from_account_bucket text not null default 'normal',
  add column if not exists to_account_bucket text not null default 'normal';

update public.work_internal_transfers
set
  from_account_bucket = coalesce(from_account_bucket, 'normal'),
  to_account_bucket = coalesce(to_account_bucket, 'normal');

alter table public.work_internal_transfers
  alter column from_account_bucket set default 'normal',
  alter column from_account_bucket set not null,
  alter column to_account_bucket set default 'normal',
  alter column to_account_bucket set not null;

alter table public.work_internal_transfers
  drop constraint if exists chk_work_internal_transfers_buckets,
  drop constraint if exists chk_work_internal_transfers_different_methods,
  drop constraint if exists chk_work_internal_transfers_different_targets;

alter table public.work_internal_transfers
  add constraint chk_work_internal_transfers_buckets
    check (
      from_account_bucket in ('normal', 'office')
      and to_account_bucket in ('normal', 'office')
    ),
  add constraint chk_work_internal_transfers_different_targets
    check (
      from_payment_method_id <> to_payment_method_id
      or from_account_bucket <> to_account_bucket
    );
