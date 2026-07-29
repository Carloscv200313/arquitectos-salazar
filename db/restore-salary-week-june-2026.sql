-- Recuperación de semana de salario de junio 2026.
--
-- El borrado anterior fue lógico: status = 0.
-- Este SQL permite revisar las semanas ocultas y reactivar la semana que sirve
-- como prueba, junto con sus actividades y pagos.

-- ============================================================================
-- 1) REVISA qué semanas de junio quedaron ocultas
-- ============================================================================
select
  id,
  week_start_date,
  week_end_date,
  payment_date,
  week_status,
  status,
  created_at
from public.salary_weeks
where status = 0
  and (
    week_start_date between date '2026-06-01' and date '2026-06-30'
    or week_end_date between date '2026-06-01' and date '2026-06-30'
    or payment_date between date '2026-06-01' and date '2026-06-30'
  )
order by week_start_date;

-- ============================================================================
-- 2) REACTIVA la semana de prueba
-- ============================================================================
-- Criterio amplio:
--   - Busca la semana que empieza entre 14 y 18 de junio de 2026,
--   - o la semana cuyo pago previsto fue el 20 de junio de 2026.
--
-- Si en la vista previa de arriba ves otro ID exacto, puedes reemplazar el CTE
-- target_week por:
--
-- target_week as (
--   select id from public.salary_weeks where id = 'AQUI_EL_ID'
-- )

begin;

with target_week as (
  select id
  from public.salary_weeks
  where status = 0
    and (
      week_start_date between date '2026-06-14' and date '2026-06-18'
      or payment_date = date '2026-06-20'
    )
),
u_weeks as (
  update public.salary_weeks w
  set status = 1
  where w.id in (select id from target_week)
  returning w.id
),
u_day_records as (
  update public.salary_day_records r
  set status = 1
  where r.salary_week_id in (select id from target_week)
  returning r.id
),
u_payments as (
  update public.salary_payments p
  set status = 1
  where p.salary_week_id in (select id from target_week)
  returning p.id
)
select 'salary_weeks_restored' as table_name, count(*) as rows_restored from u_weeks
union all
select 'salary_day_records_restored', count(*) from u_day_records
union all
select 'salary_payments_restored', count(*) from u_payments;

commit;
