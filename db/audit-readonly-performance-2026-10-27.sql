-- Diagnóstico de índices y cardinalidad. SOLO LECTURA. No hace EXPLAIN ANALYZE
-- ni llama funciones que escriban; ejecutar manualmente en el proyecto correcto.
begin read only;
select datname, stats_reset from pg_stat_database where datname = current_database();
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('work_orders','work_order_payments','work_movements',
                    'works','project_payments','projects','audit_logs')
order by tablename, indexname;

select relname as table_name, n_live_tup, seq_scan, idx_scan,
       pg_total_relation_size(relid) as total_bytes
from pg_stat_user_tables
where schemaname = 'public'
  and relname in ('work_orders','work_order_payments','work_movements',
                  'works','project_payments','projects','audit_logs')
order by relname;

select relname as table_name, indexrelname as index_name, idx_scan,
       idx_tup_read, idx_tup_fetch
from pg_stat_user_indexes
where schemaname = 'public'
  and relname in ('work_orders','work_order_payments','work_movements',
                  'works','project_payments','projects','audit_logs')
order by relname, indexrelname;
rollback;

-- Después de comprobar esquema e índices, obtener EXPLAIN (sin ANALYZE) de
-- consultas representativas con los predicados reales, usando identificadores
-- sintéticos y parámetros. Comparar con planes y tiempos existentes de logs.
-- No crear índices solo porque exista una exploración secuencial: para tablas
-- pequeñas puede ser el mejor plan. Considerar carga de escritura y espacio.
