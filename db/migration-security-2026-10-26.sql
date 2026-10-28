-- PROPUESTA PARA REVISIÓN. NO EJECUTADA POR EL AGENTE.
-- Requiere revisar audit-readonly-security-2026-10-26.sql y conservar ACL/policies
-- actuales para reversión. Compatible con sesión propia + service_role servidor.
-- No usar si otros clientes legítimos dependen de authenticated sobre estas tablas.
-- BLOQUEADA mientras work_orders participe en postgres_changes: quitar SELECT
-- a anon desactivaría los avisos Realtime con la autenticación propia actual.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$ begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'work_orders'
  ) then
    raise exception 'Revisar reemplazo seguro de Realtime para work_orders antes de aplicar esta migración';
  end if;
end $$;

-- Restringir únicamente funciones conocidas. No alterar propietarios sin conocer
-- el despliegue: verificar que pertenecen a un rol administrativo de confianza.
revoke all on function public.verify_login(text,text) from public, anon, authenticated;
grant execute on function public.verify_login(text,text) to service_role;
revoke all on function public.admin_create_user(text,text,text,uuid,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.admin_create_user(text,text,text,uuid,jsonb,uuid) to service_role;
revoke all on function public.admin_set_password(uuid,text) from public, anon, authenticated;
grant execute on function public.admin_set_password(uuid,text) to service_role;
alter function public.verify_login(text,text) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.admin_create_user(text,text,text,uuid,jsonb,uuid) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.admin_set_password(uuid,text) set search_path = pg_catalog, public, extensions, pg_temp;

-- La app no utiliza sesiones Supabase Auth para sus lecturas. El servidor sigue
-- accediendo con service_role. Evitar conceder lectura anónima para arreglar Realtime.
do $$
declare t text;
begin
  foreach t in array array[
    'users','roles','profiles','app_users','employees','payment_accounts','task_types',
    'providers','work_categories','salary_receipts','system_settings','help_items',
    'audit_logs','clients','projects','project_addons','project_payments','internal_transfers',
    'works','work_movements','work_files','work_category_budgets','work_internal_transfers',
    'work_orders','work_order_payments','salary_weeks','salary_day_records','salary_payments',
    'manual_debtors','manual_debtor_payments','manual_provider_debts','manual_provider_debt_payments',
    'provider_debt_settlements','general_balance_entries','general_balance_account_movements',
    'finance_movement_tags','finance_movement_concepts','finance_movement_captures'
  ] loop
    if to_regclass(format('public.%I',t)) is not null then
      execute format('alter table public.%I enable row level security',t);
      execute format('revoke all on table public.%I from anon, authenticated, public',t);
      execute format('grant select, insert, update, delete on table public.%I to service_role',t);
    end if;
  end loop;
end $$;

-- No modificar políticas de storage ni auth.users sin verificar consumidores.
-- Eliminar privilegios EXECUTE del trigger conocido no impide ejecución por trigger.
do $$ begin
  if to_regprocedure('public.handle_new_user()') is not null then
    revoke execute on function public.handle_new_user() from public, anon, authenticated;
  end if;
end $$;
commit;

-- ACL por defecto depende del rol que crea objetos. Revisar primero y ejecutar
-- explícitamente para ese propietario; no adivinar ni modificar todos los roles.
-- ALTER DEFAULT PRIVILEGES FOR ROLE <propietario_validado>
-- REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- ALTER DEFAULT PRIVILEGES FOR ROLE <propietario_validado> IN SCHEMA public
-- REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
