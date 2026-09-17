create table if not exists public.finance_movement_tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  status     smallint not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create unique index if not exists finance_movement_tags_name_uidx
  on public.finance_movement_tags (lower(name))
  where status = 1;

create table if not exists public.finance_movement_concepts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  tag_id     uuid references public.finance_movement_tags(id) on delete set null,
  status     smallint not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.finance_movement_concepts
  drop column if exists place,
  drop column if exists type,
  drop column if exists method;

create unique index if not exists finance_movement_concepts_name_uidx
  on public.finance_movement_concepts (lower(name))
  where status = 1;

create index if not exists finance_movement_concepts_tag_idx
  on public.finance_movement_concepts(tag_id)
  where status = 1;

create table if not exists public.finance_movement_captures (
  id                uuid primary key default gen_random_uuid(),
  concept_id        uuid not null references public.finance_movement_concepts(id),
  capture_date      date not null,
  amount            numeric(14,2) not null default 0,
  source_account_id uuid not null references public.payment_accounts(id),
  payment_form      text not null check (payment_form in ('transfer','cash','check','deposit')),
  description       text,
  status            smallint not null default 1,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id)
);

create index if not exists finance_movement_captures_date_idx
  on public.finance_movement_captures(capture_date desc, created_at desc)
  where status = 1;

create index if not exists finance_movement_captures_concept_idx
  on public.finance_movement_captures(concept_id)
  where status = 1;

create index if not exists finance_movement_captures_account_idx
  on public.finance_movement_captures(source_account_id)
  where status = 1;

alter table public.finance_movement_tags enable row level security;
alter table public.finance_movement_concepts enable row level security;
alter table public.finance_movement_captures enable row level security;

drop policy if exists "auth_select" on public.finance_movement_tags;
create policy "auth_select" on public.finance_movement_tags
  for select to authenticated using (true);
drop policy if exists "auth_insert" on public.finance_movement_tags;
create policy "auth_insert" on public.finance_movement_tags
  for insert to authenticated with check (true);
drop policy if exists "auth_update" on public.finance_movement_tags;
create policy "auth_update" on public.finance_movement_tags
  for update to authenticated using (true) with check (true);

drop policy if exists "auth_select" on public.finance_movement_concepts;
create policy "auth_select" on public.finance_movement_concepts
  for select to authenticated using (true);
drop policy if exists "auth_insert" on public.finance_movement_concepts;
create policy "auth_insert" on public.finance_movement_concepts
  for insert to authenticated with check (true);
drop policy if exists "auth_update" on public.finance_movement_concepts;
create policy "auth_update" on public.finance_movement_concepts
  for update to authenticated using (true) with check (true);

drop policy if exists "auth_select" on public.finance_movement_captures;
create policy "auth_select" on public.finance_movement_captures
  for select to authenticated using (true);
drop policy if exists "auth_insert" on public.finance_movement_captures;
create policy "auth_insert" on public.finance_movement_captures
  for insert to authenticated with check (true);
drop policy if exists "auth_update" on public.finance_movement_captures;
create policy "auth_update" on public.finance_movement_captures
  for update to authenticated using (true) with check (true);
