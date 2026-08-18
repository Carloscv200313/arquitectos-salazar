alter table public.work_movements
  add column if not exists folio text;

update public.work_movements
set folio = receipt
where folio is null
  and receipt is not null
  and (
    receipt like 'OBR-%'
    or receipt like 'PED-%'
  );

update public.work_movements
set receipt = null
where receipt is not null
  and (
    receipt like 'OBR-%'
    or receipt like 'PED-%'
  );

create index if not exists work_movements_folio_idx
  on public.work_movements(folio);
