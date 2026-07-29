-- Limpieza lógica del módulo Salario.
--
-- Objetivo:
--   Ocultar todos los registros de salario excepto la semana:
--     14 jun 2026 - 18 jun 2026
--
-- Criterio:
--   - Se conserva salary_weeks.week_start_date = 2026-06-14
--     y salary_weeks.week_end_date = 2026-06-18.
--   - Las demás semanas quedan con status = 0.
--   - Sus actividades y pagos quedan con status = 0.
--   - Los comprobantes de esas semanas se eliminan físicamente porque
--     salary_receipts no tiene columna status.
--
-- Uso recomendado:
--   1. Ejecuta primero VISTA PREVIA.
--   2. Si los conteos cuadran, ejecuta LIMPIEZA.

-- ============================================================================
-- VISTA PREVIA
-- ============================================================================
with keep_week as (
  select id
  from public.salary_weeks
  where status = 1
    and week_start_date = date '2026-06-14'
    and week_end_date = date '2026-06-18'
),
weeks_to_hide as (
  select id
  from public.salary_weeks
  where status = 1
    and id not in (select id from keep_week)
)
select 'salary_weeks_to_keep' as table_name, count(*) as rows_count
from keep_week
union all
select 'salary_weeks_to_hide', count(*)
from weeks_to_hide
union all
select 'salary_day_records_to_hide', count(*)
from public.salary_day_records
where status = 1 and salary_week_id in (select id from weeks_to_hide)
union all
select 'salary_payments_to_hide', count(*)
from public.salary_payments
where status = 1 and salary_week_id in (select id from weeks_to_hide)
union all
select 'salary_receipts_to_delete', count(*)
from public.salary_receipts
where salary_week_id in (select id from weeks_to_hide);

-- ============================================================================
-- LIMPIEZA
-- ============================================================================
begin;

with keep_week as (
  select id
  from public.salary_weeks
  where status = 1
    and week_start_date = date '2026-06-14'
    and week_end_date = date '2026-06-18'
),
weeks_to_hide as (
  select id
  from public.salary_weeks
  where status = 1
    and id not in (select id from keep_week)
),
d_receipts as (
  delete from public.salary_receipts r
  where r.salary_week_id in (select id from weeks_to_hide)
  returning r.id
),
u_day_records as (
  update public.salary_day_records r
  set status = 0
  where r.status = 1
    and r.salary_week_id in (select id from weeks_to_hide)
  returning r.id
),
u_payments as (
  update public.salary_payments p
  set status = 0
  where p.status = 1
    and p.salary_week_id in (select id from weeks_to_hide)
  returning p.id
),
u_weeks as (
  update public.salary_weeks w
  set status = 0
  where w.status = 1
    and w.id in (select id from weeks_to_hide)
  returning w.id
)
select 'salary_receipts_deleted' as table_name, count(*) as rows_changed from d_receipts
union all
select 'salary_day_records_hidden', count(*) from u_day_records
union all
select 'salary_payments_hidden', count(*) from u_payments
union all
select 'salary_weeks_hidden', count(*) from u_weeks;

commit;
