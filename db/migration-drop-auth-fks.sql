-- ============================================================================
-- Arregla el bug global de created_by / user_id.
--
-- Todas las tablas tienen FK created_by (o user_id) -> auth.users, pero el
-- sistema usa sesión propia (tabla public.users), no Supabase Auth. Al insertar
-- con created_by = users.id, Postgres rechaza:
--   "violates foreign key constraint ..._created_by_fkey"
--
-- Solución: quitar TODOS los FK que apuntan a auth.users. Las columnas
-- created_by/user_id quedan como uuid simples (mismo patrón que salary_receipts
-- y audit_logs, que ya funcionan).
-- ============================================================================

do $$
declare
  r record;
begin
  for r in
    select conrelid::regclass as tbl, conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and n.nspname = 'public'   -- solo nuestras tablas, no las de auth.*
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    raise notice 'Quitado FK % en %', r.conname, r.tbl;
  end loop;
end $$;
