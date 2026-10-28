-- PROPUESTA REVISABLE. NO EJECUTADA.
-- Separada de las ACL de tablas para no bloquear el cierre de RPC por Realtime.
-- PRECONDICIONES: ejecutar audit-readonly-security-2026-10-26.sql; confirmar
-- firmas, propietario, consumidores legítimos y que la app usa service_role.
-- No altera funciones, search_path, políticas RLS, datos ni publicación.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$ begin
  if to_regprocedure('public.verify_login(text,text)') is null
     or to_regprocedure('public.admin_create_user(text,text,text,uuid,jsonb,uuid)') is null
     or to_regprocedure('public.admin_set_password(uuid,text)') is null then
    raise exception 'La firma de una RPC administrativa difiere del esquema revisado';
  end if;
end $$;
revoke execute on function public.verify_login(text,text) from public, anon, authenticated;
revoke execute on function public.admin_create_user(text,text,text,uuid,jsonb,uuid) from public, anon, authenticated;
revoke execute on function public.admin_set_password(uuid,text) from public, anon, authenticated;
grant execute on function public.verify_login(text,text) to service_role;
grant execute on function public.admin_create_user(text,text,text,uuid,jsonb,uuid) to service_role;
grant execute on function public.admin_set_password(uuid,text) to service_role;
commit;

-- Reversión: restaurar exclusivamente los grants capturados en la auditoría
-- previa. No conceder EXECUTE a PUBLIC por defecto ni aplicar un rollback
-- genérico. Probar login y administración en staging antes de producción.
