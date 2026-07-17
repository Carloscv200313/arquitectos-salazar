-- Extiende los tipos permitidos para actividades diarias del módulo salario.
-- Permite registrar actividades de semana y hora sin romper los datos existentes.

alter table public.salary_day_records
  drop constraint if exists salary_day_records_activity_type_check;

alter table public.salary_day_records
  add constraint salary_day_records_activity_type_check
  check (activity_type in ('project', 'work', 'week', 'hour', 'absent', 'pending'));
