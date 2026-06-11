-- ============================================================================
-- Limpia duplicados del seed (corrido más de una vez) y previene recurrencia.
-- Seguro de ejecutar: conserva el registro más antiguo de cada nombre.
-- Ejecutar una vez en el SQL Editor de Supabase.
-- ============================================================================

-- 1) Eliminar cuentas duplicadas (mismo nombre), conservando una.
delete from public.payment_accounts a
using public.payment_accounts b
where a.name = b.name
  and a.id > b.id;

-- 2) Eliminar tipos de tarea duplicados.
delete from public.task_types a
using public.task_types b
where a.name = b.name
  and a.id > b.id;

-- 3) Eliminar items de ayuda duplicados (mismo título).
delete from public.help_items a
using public.help_items b
where a.title = b.title
  and a.id > b.id;

-- 4) Índices únicos para que el seed no vuelva a duplicar.
create unique index if not exists payment_accounts_name_uidx
  on public.payment_accounts (lower(name));
create unique index if not exists task_types_name_uidx
  on public.task_types (lower(name));

-- ============================================================================
-- Fin
-- ============================================================================
