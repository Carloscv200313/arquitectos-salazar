-- Marca operativa para saber si un pedido ya fue solicitado al proveedor.
-- false = pendiente de solicitar; true = solicitado.

alter table public.work_orders
  add column if not exists is_requested boolean not null default false;

create index if not exists work_orders_requested_idx
  on public.work_orders (is_requested, work_id)
  where status = 1;
