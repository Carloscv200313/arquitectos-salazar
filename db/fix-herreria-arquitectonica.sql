-- Reparación puntual para el renombre:
--   Herrería -> Herrería Arquitectónica
--
-- Ejecutar una sola vez en el SQL Editor de Supabase si el catálogo ya fue
-- renombrado pero las obras anteriores siguen mostrando "Herrería".

begin;

update public.work_movements
  set category = 'Herrería Arquitectónica'
  where category = 'Herrería';

update public.work_orders
  set category = 'Herrería Arquitectónica'
  where category = 'Herrería';

insert into public.work_category_budgets (
  work_id,
  category,
  amount,
  executed_amount
)
select
  work_id,
  'Herrería Arquitectónica',
  sum(coalesce(amount, 0)),
  sum(coalesce(executed_amount, 0))
from public.work_category_budgets
where category = 'Herrería'
group by work_id
on conflict (work_id, category) do update
  set amount = public.work_category_budgets.amount + excluded.amount,
      executed_amount = public.work_category_budgets.executed_amount + excluded.executed_amount,
      updated_at = now();

delete from public.work_category_budgets
  where category = 'Herrería';

update public.work_categories
  set name = 'Herrería Arquitectónica',
      updated_at = now()
  where name = 'Herrería'
    and not exists (
      select 1
      from public.work_categories
      where name = 'Herrería Arquitectónica'
    );

update public.work_categories
  set status = 0,
      updated_at = now()
  where name = 'Herrería'
    and exists (
      select 1
      from public.work_categories
      where name = 'Herrería Arquitectónica'
    );

commit;
