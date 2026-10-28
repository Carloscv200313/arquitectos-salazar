-- PROPUESTA PARA EJECUCIÓN MANUAL; NO EJECUTADA.
-- Diagnóstico confirmado el 28/10/2026: created_by referencia auth.users,
-- pero la aplicación guarda el UUID de public.users. Corrige solo ese FK.
-- NOT VALID evita revisar o modificar las capturas históricas; PostgreSQL sí
-- comprueba las nuevas inserciones/actualizaciones contra public.users.
-- No modifica importes, registros, balances ni cálculos.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.finance_movement_captures'::regclass
      and conname = 'finance_movement_captures_created_by_fkey'
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ) then
    raise exception 'La restricción real ya no coincide con el diagnóstico; no se aplicó ningún cambio';
  end if;
end $$;

alter table public.finance_movement_captures
  drop constraint finance_movement_captures_created_by_fkey;

alter table public.finance_movement_captures
  add constraint finance_movement_captures_created_by_fkey
  foreign key (created_by) references public.users(id) not valid;

commit;

-- Validación posterior (solo lectura):
-- select count(*) as capturas_sin_usuario_propio
-- from public.finance_movement_captures c
-- left join public.users u on u.id = c.created_by
-- where c.created_by is not null and u.id is null;
-- Si el conteo es 0, se puede programar VALIDATE CONSTRAINT en otra ventana.
-- Reversión: restaurar el FK anterior solo si los valores de created_by
-- corresponden a auth.users. No restaurarlo a ciegas: repetiría el incidente.
