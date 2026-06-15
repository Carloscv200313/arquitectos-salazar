-- ============================================================================
-- Módulo de Auditoría
-- Log central de TODO el sistema: creación / edición / eliminación de
-- movimientos en proyectos, obras y pedidos (y lo que ya registraba salario).
--
-- Balances NO se almacenan: se calculan en vivo sumando movimientos con
-- status = 1. Por eso editar o "eliminar" (status = 0) recalcula solo el saldo.
-- ============================================================================

-- 1) La tabla audit_logs ya existe. Le quitamos el FK a auth.users:
--    el sistema usa sesión propia (tabla public.users), no auth.users, así que
--    el insert fallaba en silencio (user_id no existía en auth.users).
alter table public.audit_logs
  drop constraint if exists audit_logs_user_id_fkey;

-- 2) Columnas nuevas para auditoría rica.
--    entity_type : 'project_movement' | 'work_movement' | 'order_payment' | 'salary'
--    operation   : 'create' | 'update' | 'delete'
--    note        : observación OBLIGATORIA que el usuario escribe al editar/eliminar
--    snapshot    : { before: {...}, after: {...} } para ver el cambio exacto
--    amount      : monto del movimiento (para listar/filtrar rápido)
--    user_name   : nombre del usuario al momento del registro (histórico, no se rompe si lo borran)
alter table public.audit_logs add column if not exists entity_type text;
alter table public.audit_logs add column if not exists entity_id   text;
alter table public.audit_logs add column if not exists operation   text;
alter table public.audit_logs add column if not exists note        text;
alter table public.audit_logs add column if not exists snapshot    jsonb;
alter table public.audit_logs add column if not exists amount      numeric(14,2);
alter table public.audit_logs add column if not exists user_name   text;

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx     on public.audit_logs (entity_type, entity_id);
