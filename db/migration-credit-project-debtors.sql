alter table public.projects
  drop constraint if exists projects_template_check;

alter table public.projects
  add constraint projects_template_check
  check (template in ('diamante', 'oro', 'especial', 'credito'));

alter table public.projects
  drop constraint if exists projects_project_amount_check;

alter table public.projects
  add constraint projects_project_amount_check
  check (project_amount >= 0);

alter table public.projects
  drop constraint if exists projects_total_amount_check;

alter table public.projects
  add constraint projects_total_amount_check
  check (total_amount >= 0);

alter table public.manual_debtors
  add column if not exists project_id uuid references public.projects(id);

create index if not exists manual_debtors_project_idx
  on public.manual_debtors(project_id)
  where status = 1;

alter table public.manual_debtor_payments
  add column if not exists project_payment_id uuid references public.project_payments(id);

create unique index if not exists manual_debtor_payments_project_payment_idx
  on public.manual_debtor_payments(project_payment_id)
  where project_payment_id is not null;
