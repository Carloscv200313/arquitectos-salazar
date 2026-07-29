-- Limpieza lógica de datos anteriores al 27 de julio de 2026.
--
-- Criterio:
--   - "Anterior" significa fecha < 2026-07-27.
--   - No borra físicamente: marca status = 0 para que el sistema deje de mostrarlo.
--   - Si un proyecto/obra/pedido es anterior al corte, también se ocultan sus movimientos.
--   - Si un movimiento/abono/traspaso es anterior al corte, se oculta aunque su padre siga activo.
--   - No toca tablas auxiliares que pueden no tener status en algunas bases
--     (project_addons, work_files, work_category_budgets).
--   - También oculta deudores manuales anteriores al corte y el registro puntual
--     llamado "Deudor de prueba".
--
-- Uso recomendado:
--   1. Ejecuta primero el bloque de VISTA PREVIA.
--   2. Si los conteos son correctos, ejecuta el bloque de LIMPIEZA.

-- ============================================================================
-- VISTA PREVIA
-- ============================================================================
with params as (
  select date '2026-07-27' as cutoff
),
old_projects as (
  select id from public.projects, params
  where status = 1 and created_at::date < params.cutoff
),
old_works as (
  select id from public.works, params
  where status = 1 and created_at::date < params.cutoff
),
old_orders as (
  select id from public.work_orders, params
  where status = 1
    and (order_date < params.cutoff or work_id in (select id from old_works))
)
select 'projects' as table_name, count(*) as rows_to_hide
from public.projects, params
where status = 1 and created_at::date < params.cutoff
union all
select 'project_payments', count(*)
from public.project_payments, params
where status = 1
  and (payment_date < params.cutoff or project_id in (select id from old_projects))
union all
select 'internal_transfers', count(*)
from public.internal_transfers, params
where status = 1 and transfer_date < params.cutoff
union all
select 'works', count(*)
from public.works, params
where status = 1 and created_at::date < params.cutoff
union all
select 'work_movements', count(*)
from public.work_movements, params
where status = 1
  and (movement_date < params.cutoff or work_id in (select id from old_works))
union all
select 'work_internal_transfers', count(*)
from public.work_internal_transfers, params
where status = 1 and transfer_date < params.cutoff
union all
select 'work_orders', count(*)
from public.work_orders
where status = 1 and id in (select id from old_orders)
union all
select 'work_order_payments', count(*)
from public.work_order_payments, params
where status = 1
  and (payment_date < params.cutoff or order_id in (select id from old_orders))
union all
select 'general_balance_entries', count(*)
from public.general_balance_entries, params
where status = 1 and entry_date < params.cutoff
union all
select 'general_balance_account_movements', count(*)
from public.general_balance_account_movements, params
where status = 1 and movement_date < params.cutoff
union all
select 'manual_debtors', count(*)
from public.manual_debtors, params
where status = 1
  and (created_at::date < params.cutoff or lower(trim(name)) = 'deudor de prueba');

-- ============================================================================
-- LIMPIEZA
-- ============================================================================
begin;

with params as (
  select date '2026-07-27' as cutoff
),
old_projects as (
  select id from public.projects, params
  where status = 1 and created_at::date < params.cutoff
),
old_works as (
  select id from public.works, params
  where status = 1 and created_at::date < params.cutoff
),
old_orders as (
  select id from public.work_orders, params
  where status = 1
    and (order_date < params.cutoff or work_id in (select id from old_works))
),
u_order_payments as (
  update public.work_order_payments p
  set status = 0
  from params
  where p.status = 1
    and (p.payment_date < params.cutoff or p.order_id in (select id from old_orders))
  returning p.id, p.work_movement_id, p.internal_transfer_id
),
u_order_payment_movements as (
  update public.work_movements m
  set status = 0
  where m.status = 1
    and m.id in (
      select work_movement_id
      from u_order_payments
      where work_movement_id is not null
    )
  returning m.id
),
u_order_payment_transfers as (
  update public.work_internal_transfers t
  set status = 0
  where t.status = 1
    and t.id in (
      select internal_transfer_id
      from u_order_payments
      where internal_transfer_id is not null
    )
  returning t.id
),
u_work_orders as (
  update public.work_orders o
  set status = 0
  where o.status = 1 and o.id in (select id from old_orders)
  returning o.id
),
u_work_movements as (
  update public.work_movements m
  set status = 0
  from params
  where m.status = 1
    and (m.movement_date < params.cutoff or m.work_id in (select id from old_works))
  returning m.id
),
u_work_transfers as (
  update public.work_internal_transfers t
  set status = 0
  from params
  where t.status = 1 and t.transfer_date < params.cutoff
  returning t.id
),
u_works as (
  update public.works w
  set status = 0
  where w.status = 1 and w.id in (select id from old_works)
  returning w.id
),
u_project_payments as (
  update public.project_payments p
  set status = 0
  from params
  where p.status = 1
    and (p.payment_date < params.cutoff or p.project_id in (select id from old_projects))
  returning p.id
),
u_project_transfers as (
  update public.internal_transfers t
  set status = 0
  from params
  where t.status = 1 and t.transfer_date < params.cutoff
  returning t.id
),
u_projects as (
  update public.projects p
  set status = 0
  where p.status = 1 and p.id in (select id from old_projects)
  returning p.id
),
u_balance_entries as (
  update public.general_balance_entries e
  set status = 0
  from params
  where e.status = 1 and e.entry_date < params.cutoff
  returning e.id
),
u_balance_movements as (
  update public.general_balance_account_movements m
  set status = 0
  from params
  where m.status = 1 and m.movement_date < params.cutoff
  returning m.id
),
u_manual_debtors as (
  update public.manual_debtors d
  set status = 0
  from params
  where d.status = 1
    and (d.created_at::date < params.cutoff or lower(trim(d.name)) = 'deudor de prueba')
  returning d.id
)
select 'work_order_payments' as table_name, count(*) as rows_hidden from u_order_payments
union all select 'work_order_payment_linked_movements', count(*) from u_order_payment_movements
union all select 'work_order_payment_linked_transfers', count(*) from u_order_payment_transfers
union all select 'work_orders', count(*) from u_work_orders
union all select 'work_movements', count(*) from u_work_movements
union all select 'work_internal_transfers', count(*) from u_work_transfers
union all select 'works', count(*) from u_works
union all select 'project_payments', count(*) from u_project_payments
union all select 'internal_transfers', count(*) from u_project_transfers
union all select 'projects', count(*) from u_projects
union all select 'general_balance_entries', count(*) from u_balance_entries
union all select 'general_balance_account_movements', count(*) from u_balance_movements
union all select 'manual_debtors', count(*) from u_manual_debtors;

commit;
