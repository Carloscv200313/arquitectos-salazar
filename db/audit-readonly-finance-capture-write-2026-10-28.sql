-- SOLO LECTURA. Ejecutar en SQL Editor y compartir el resultado, sin IDs de usuarios.
-- Permite comprobar si la captura apunta por error a auth.users y si el tipo
-- de movimiento admite 'expense'/'income'. No prueba ni crea movimientos.
-- La consulta de restricciones va al final porque SQL Editor suele mostrar
-- solamente el resultado de la última sentencia.

select a.attname as column_name,
       format_type(a.atttypid, a.atttypmod) as data_type,
       a.attnotnull as required
from pg_attribute a
where a.attrelid = 'public.finance_movement_captures'::regclass
  and a.attname in ('created_by', 'movement_type', 'concept_id', 'source_account_id', 'payment_form')
  and not a.attisdropped
order by a.attname;

select c.conname as constraint_name,
       c.contype as constraint_type,
       case when c.contype = 'f' then c.confrelid::regclass::text end as references_table,
       pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid = 'public.finance_movement_captures'::regclass
  and (c.contype in ('f', 'c'))
order by c.conname;
