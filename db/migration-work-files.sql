create table if not exists public.work_files (
  id           uuid primary key default gen_random_uuid(),
  work_id      uuid not null references public.works(id) on delete cascade,
  file_name    text not null check (char_length(trim(file_name)) between 1 and 255),
  storage_path text not null unique,
  mime_type    text,
  size_bytes   bigint not null default 0 check (size_bytes >= 0),
  created_at   timestamptz not null default now(),
  created_by   uuid
);

create index if not exists idx_work_files_work on public.work_files (work_id);
create index if not exists idx_work_files_created on public.work_files (created_at desc);

alter table public.work_files enable row level security;

drop policy if exists "work_files_select" on public.work_files;
create policy "work_files_select" on public.work_files
  for select to authenticated using (true);

drop policy if exists "work_files_insert" on public.work_files;
create policy "work_files_insert" on public.work_files
  for insert to authenticated with check (true);

drop policy if exists "work_files_delete" on public.work_files;
create policy "work_files_delete" on public.work_files
  for delete to authenticated using (true);

alter table public.work_files
  drop constraint if exists work_files_created_by_fkey;

insert into storage.buckets (id, name, public)
values ('work-files', 'work-files', false)
on conflict (id) do nothing;
