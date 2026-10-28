-- SOLO LECTURA. Verificaciones previas a migration-reset-receipt-signature-2026-10-27.sql.
-- No lee firmas, recibos, personas ni importes.
begin read only;

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public' and (
  (table_name in ('project_payments', 'work_movements') and column_name in ('id', 'status', 'amount', 'signature', 'signed_at'))
  or (table_name = 'audit_logs' and column_name in ('user_id','user_name','action','operation','entity_type','entity_id','table_name','record_id','description','note','amount','snapshot'))
  or (table_name = 'users' and column_name in ('id','full_name','status','permissions','role_id'))
)
order by table_name, column_name;

select c.conname, c.conrelid::regclass as source_table, c.confrelid::regclass as referenced_table
from pg_constraint c
where c.conrelid = 'public.audit_logs'::regclass and c.contype = 'f';

select
  has_table_privilege('service_role', 'public.project_payments', 'UPDATE') as can_update_project_payment,
  has_table_privilege('service_role', 'public.work_movements', 'UPDATE') as can_update_work_movement,
  has_table_privilege('service_role', 'public.audit_logs', 'INSERT') as can_insert_audit,
  to_regprocedure('public.reset_receipt_signature(text,uuid,uuid,text)') as existing_function;

rollback;
