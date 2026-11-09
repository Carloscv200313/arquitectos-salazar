-- PARA REVISIÓN Y EJECUCIÓN MANUAL DEL USUARIO. NO EJECUTADO.
-- Ticket: incorporar al saldo de Efectivo el egreso de $20,000 por
-- "Abono de herrería" registrado el viernes 30/10/2026 a las 19:16 (México).
--
-- Diagnóstico de solo lectura (03/11/2026):
--   Efectivo: account_id 127daaa8-d808-4ef9-acf3-15425f20cad8
--   Saldo de apertura: $66,000.00; corte 2026-10-31 06:00:00+00
--   Viernes: d72d8cf1-e135-4789-9c00-7edb3bae6e80, egreso $20,000,
--            registrado 2026-10-31 01:16:51.658754+00 (antes del corte)
--   Sábado:  a8dbc281-bd75-4ae4-9b62-04ff3202f0d5, egreso $20,000,
--            registrado 2026-10-31 15:01:49.368361+00 (después del corte)
--
-- Supuesto que debe confirmar el responsable: el saldo de apertura de $66,000
-- NO incluía el egreso del viernes. Si ya lo incluía, NO ejecutar este ajuste.
-- Se modifica solo el saldo de apertura ($66,000 -> $46,000). No se toca
-- ninguno de los dos movimientos ni se altera su historial.

begin;

do $$
declare
  v_account_id constant uuid := '127daaa8-d808-4ef9-acf3-15425f20cad8';
  v_cutoff constant timestamptz := '2026-10-31 06:00:00+00';
  v_changed integer;
begin
  if not exists (
    select 1
    from public.payment_accounts
    where id = v_account_id and name = 'Efectivo' and status = 1
  ) then
    raise exception 'La cuenta Efectivo esperada ya no coincide; revisar antes de ajustar.';
  end if;

  if not exists (
    select 1
    from public.work_movements
    where id = 'd72d8cf1-e135-4789-9c00-7edb3bae6e80'
      and payment_method_id = v_account_id
      and movement_type = 'expense'
      and concept = 'Abono de herrería'
      and amount = 20000
      and status = 1
      and created_at < v_cutoff
  ) then
    raise exception 'El egreso del viernes no coincide; revisar antes de ajustar.';
  end if;

  if not exists (
    select 1
    from public.work_movements
    where id = 'a8dbc281-bd75-4ae4-9b62-04ff3202f0d5'
      and payment_method_id = v_account_id
      and movement_type = 'expense'
      and amount = 20000
      and status = 1
      and created_at > v_cutoff
  ) then
    raise exception 'El egreso del sábado no coincide; revisar antes de ajustar.';
  end if;

  update public.account_balance_openings
  set opening_amount = 46000,
      source_note = source_note || ' | Ajuste 03/11/2026: se incorporó egreso de Efectivo por abono de herrería del 30/10/2026 ($20,000), omitido en el corte original.'
  where account_id = v_account_id
    and opening_amount = 66000
    and cutoff_at = v_cutoff;

  get diagnostics v_changed = row_count;
  if v_changed <> 1 then
    raise exception 'El saldo o corte ya cambió; no se aplicó ningún ajuste.';
  end if;
end $$;

select a.name, o.opening_amount, o.cutoff_at, o.source_note
from public.account_balance_openings o
join public.payment_accounts a on a.id = o.account_id
where o.account_id = '127daaa8-d808-4ef9-acf3-15425f20cad8';

commit;
