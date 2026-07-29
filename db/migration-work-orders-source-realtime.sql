-- Origen de pedidos y preparación para notificaciones en tiempo real.
--
-- Ejecutar en Supabase antes de desplegar el código que inserta work_orders.source.

alter table public.work_orders
  add column if not exists source text not null default 'internal'
  check (source in ('internal', 'public'));

create index if not exists work_orders_source_created_idx
  on public.work_orders (source, created_at desc)
  where status = 1;

-- Supabase Realtime debe estar habilitado para escuchar INSERT en work_orders.
do $$
begin
  alter publication supabase_realtime add table public.work_orders;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
