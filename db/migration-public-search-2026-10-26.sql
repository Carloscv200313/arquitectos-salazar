-- OPCIONAL, REVISABLE, NO EJECUTADA. Solo service_role puede invocar.
-- Búsqueda y agregación con resultado acotado; no expone datos a anon.
begin;
create or replace function public.search_payables_secure(p_query text, p_kind text)
returns table(id uuid, name text, client_name text, address text, pending numeric)
language sql stable security invoker
set search_path = pg_catalog, public, pg_temp
as $$
  with term as (
    select '%' || replace(replace(replace(trim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' as value
    where length(trim(p_query)) between 2 and 100
  ), candidates as (
    select p.id, p.name, c.name as client_name, p.address, p.total_amount, p.created_at
    from public.projects p join public.clients c on c.id=p.client_id cross join term
    where p_kind='projects' and p.status=1 and
      (p.name ilike term.value or c.name ilike term.value or p.address ilike term.value)
    union all
    select w.id, w.name, c.name, w.address, null::numeric, w.created_at
    from public.works w join public.clients c on c.id=w.client_id cross join term
    where p_kind='works' and w.status=1 and
      (w.name ilike term.value or c.name ilike term.value or w.address ilike term.value)
  ), selected as (
    select * from candidates order by created_at desc, id limit 20
  )
  select s.id,s.name,s.client_name,s.address,
    case when p_kind='projects' then round(greatest(s.total_amount - coalesce((
      select sum(pp.amount) from public.project_payments pp
      where pp.project_id=s.id and pp.status=1 and pp.movement_type='income'
    ),0),0),2) else null::numeric end
  from selected s order by s.created_at desc, s.id;
$$;
revoke all on function public.search_payables_secure(text,text) from public, anon, authenticated;
grant execute on function public.search_payables_secure(text,text) to service_role;
commit;
-- Activar USE_SEARCH_RPC=1 únicamente después de revisar/ejecutar y conciliar.
