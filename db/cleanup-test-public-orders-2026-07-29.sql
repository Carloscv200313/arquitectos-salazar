-- Limpieza de pedidos públicos de prueba creados el 29 de julio de 2026.
--
-- Criterio:
--   - work_orders.status = 1
--   - source = 'public' o created_by is null
--   - creados el 2026-07-29
--   - material o descripción contiene "prueba"
--
-- No borra físicamente los pedidos: los oculta con status = 0.
-- Si algún pedido tuviera abonos relacionados, también oculta esos abonos y
-- sus movimientos/traspasos enlazados.

-- ============================================================================
-- VISTA PREVIA
-- ============================================================================
with test_orders as (
  select id, work_id, created_at, supplier, material, description
  from public.work_orders
  where status = 1
    and created_at::date = date '2026-07-29'
    and (source = 'public' or created_by is null)
    and (
      material ilike '%prueba%'
      or coalesce(description, '') ilike '%prueba%'
    )
)
select
  'work_orders' as table_name,
  count(*) as rows_to_hide
from test_orders
union all
select
  'work_order_payments',
  count(*)
from public.work_order_payments
where status = 1
  and order_id in (select id from test_orders);

-- Detalle de pedidos que serán ocultados.
select
  created_at,
  supplier,
  material,
  description
from public.work_orders
where status = 1
  and created_at::date = date '2026-07-29'
  and (source = 'public' or created_by is null)
  and (
    material ilike '%prueba%'
    or coalesce(description, '') ilike '%prueba%'
  )
order by created_at desc;

-- ============================================================================
-- LIMPIEZA
-- ============================================================================
begin;

with test_orders as (
  select id
  from public.work_orders
  where status = 1
    and created_at::date = date '2026-07-29'
    and (source = 'public' or created_by is null)
    and (
      material ilike '%prueba%'
      or coalesce(description, '') ilike '%prueba%'
    )
),
u_payments as (
  update public.work_order_payments p
  set status = 0
  where p.status = 1
    and p.order_id in (select id from test_orders)
  returning p.id, p.work_movement_id, p.internal_transfer_id
),
u_linked_movements as (
  update public.work_movements m
  set status = 0
  where m.status = 1
    and m.id in (
      select work_movement_id
      from u_payments
      where work_movement_id is not null
    )
  returning m.id
),
u_linked_transfers as (
  update public.work_internal_transfers t
  set status = 0
  where t.status = 1
    and t.id in (
      select internal_transfer_id
      from u_payments
      where internal_transfer_id is not null
    )
  returning t.id
),
u_orders as (
  update public.work_orders o
  set status = 0
  where o.status = 1
    and o.id in (select id from test_orders)
  returning o.id
)
select 'work_orders_hidden' as table_name, count(*) as rows_changed from u_orders
union all
select 'work_order_payments_hidden', count(*) from u_payments
union all
select 'linked_work_movements_hidden', count(*) from u_linked_movements
union all
select 'linked_work_internal_transfers_hidden', count(*) from u_linked_transfers;

commit;
