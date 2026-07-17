create table if not exists public.work_category_budgets (
  id         uuid primary key default gen_random_uuid(),
  work_id    uuid not null references public.works(id) on delete cascade,
  category   text not null check (char_length(trim(category)) between 2 and 120),
  amount     numeric(14,2) not null default 0 check (amount >= 0),
  executed_amount numeric(14,2) not null default 0 check (executed_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  unique (work_id, category)
);

alter table public.work_category_budgets
  add column if not exists executed_amount numeric(14,2) not null default 0;

create index if not exists idx_work_category_budgets_work
  on public.work_category_budgets (work_id);

drop trigger if exists trg_work_category_budgets_updated_at on public.work_category_budgets;
create trigger trg_work_category_budgets_updated_at
  before update on public.work_category_budgets
  for each row execute function public.set_updated_at();

alter table public.work_category_budgets enable row level security;

drop policy if exists "work_category_budgets_select" on public.work_category_budgets;
create policy "work_category_budgets_select" on public.work_category_budgets
  for select to authenticated using (true);

drop policy if exists "work_category_budgets_insert" on public.work_category_budgets;
create policy "work_category_budgets_insert" on public.work_category_budgets
  for insert to authenticated with check (true);

drop policy if exists "work_category_budgets_update" on public.work_category_budgets;
create policy "work_category_budgets_update" on public.work_category_budgets
  for update to authenticated using (true) with check (true);

drop policy if exists "work_category_budgets_delete" on public.work_category_budgets;
create policy "work_category_budgets_delete" on public.work_category_budgets
  for delete to authenticated using (true);
