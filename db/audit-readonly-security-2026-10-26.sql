-- SOLO LECTURA. Ejecutar manualmente en una sesión administrativa autorizada.
-- No devuelve contraseñas, firmas, registros financieros ni claves.
begin read only;
select n.nspname as schema, c.relname, c.relrowsecurity, c.relforcerowsecurity,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
       has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_update
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p','v') order by c.relname;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;

select p.oid::regprocedure as function, pg_get_userbyid(p.proowner) as owner,
       p.prosecdef as security_definer, p.proconfig,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' order by p.proname;

select defaclrole::regrole, defaclnamespace::regnamespace, defaclobjtype, defaclacl
from pg_default_acl;
select n.nspname as schema,
       has_schema_privilege('anon', n.oid, 'USAGE') as anon_usage,
       has_schema_privilege('anon', n.oid, 'CREATE') as anon_create,
       has_schema_privilege('authenticated', n.oid, 'USAGE') as authenticated_usage,
       has_schema_privilege('authenticated', n.oid, 'CREATE') as authenticated_create
from pg_namespace n where n.nspname in ('public', 'extensions');
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
select n.nspname as function_schema, p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('crypt', 'gen_salt') order by p.proname, n.nspname;
select current_setting('pgrst.db_schemas', true) as exposed_schemas;
-- NULL no acredita ausencia de exposición: revisar también configuración del servicio.
select relname, n_live_tup, pg_total_relation_size(relid) as total_bytes
from pg_stat_user_tables where schemaname='public' order by total_bytes desc;
-- Columnas que el código de pedidos y notificaciones necesita antes del despliegue.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and (
  (table_name = 'work_orders' and column_name in ('id','work_id','source','status','is_requested','created_at','payable_movement_id')) or
  (table_name = 'work_order_payments' and column_name in ('order_id','amount','status')) or
  (table_name = 'work_movements' and column_name in ('work_id','status','signature'))
)
order by table_name, column_name;
rollback;
