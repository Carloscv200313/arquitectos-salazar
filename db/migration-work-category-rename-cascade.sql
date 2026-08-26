-- Mantiene sincronizados los nombres de categorías de obra guardados como texto
-- en movimientos, pedidos y presupuestos cuando se renombra el catálogo.

create or replace function public.cascade_work_category_name()
returns trigger language plpgsql as $$
begin
  if old.name is distinct from new.name then
    update public.work_movements
      set category = new.name
      where category = old.name;

    update public.work_orders
      set category = new.name
      where category = old.name;

    insert into public.work_category_budgets (
      work_id,
      category,
      amount,
      executed_amount
    )
    select
      work_id,
      new.name,
      sum(coalesce(amount, 0)),
      sum(coalesce(executed_amount, 0))
    from public.work_category_budgets
    where category = old.name
    group by work_id
    on conflict (work_id, category) do update
      set amount = public.work_category_budgets.amount + excluded.amount,
          executed_amount = public.work_category_budgets.executed_amount + excluded.executed_amount,
          updated_at = now();

    delete from public.work_category_budgets
      where category = old.name;
  end if;

  return new;
end;
$$;

drop trigger if exists cascade_work_category_name on public.work_categories;
create trigger cascade_work_category_name
  after update of name on public.work_categories
  for each row execute function public.cascade_work_category_name();

drop trigger if exists set_updated_at on public.work_categories;
create trigger set_updated_at
  before update on public.work_categories
  for each row execute function public.set_updated_at();
