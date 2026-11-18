-- PROPUESTA PARA EJECUCION MANUAL; NO EJECUTADA.
-- La aplicacion autentica contra public.users y envia ese UUID en created_by.
-- Estas dos tablas todavia apuntan por error a auth.users.
-- No modifica conceptos, etiquetas, movimientos ni importes existentes.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.finance_movement_concepts'::regclass
      and conname = 'finance_movement_concepts_created_by_fkey'
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ) then
    raise exception 'El FK de conceptos ya no coincide con el diagnostico; no se aplico ningun cambio';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.finance_movement_tags'::regclass
      and conname = 'finance_movement_tags_created_by_fkey'
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ) then
    raise exception 'El FK de etiquetas ya no coincide con el diagnostico; no se aplico ningun cambio';
  end if;
end $$;

alter table public.finance_movement_concepts
  drop constraint finance_movement_concepts_created_by_fkey;

alter table public.finance_movement_concepts
  add constraint finance_movement_concepts_created_by_fkey
  foreign key (created_by) references public.users(id) not valid;

alter table public.finance_movement_tags
  drop constraint finance_movement_tags_created_by_fkey;

alter table public.finance_movement_tags
  add constraint finance_movement_tags_created_by_fkey
  foreign key (created_by) references public.users(id) not valid;

commit;

-- Validacion posterior de solo lectura:
-- select 'concepts' as source, count(*) as orphaned
-- from public.finance_movement_concepts c
-- left join public.users u on u.id = c.created_by
-- where c.created_by is not null and u.id is null
-- union all
-- select 'tags', count(*)
-- from public.finance_movement_tags t
-- left join public.users u on u.id = t.created_by
-- where t.created_by is not null and u.id is null;
--
-- Si ambos conteos son 0:
-- alter table public.finance_movement_concepts
--   validate constraint finance_movement_concepts_created_by_fkey;
-- alter table public.finance_movement_tags
--   validate constraint finance_movement_tags_created_by_fkey;
