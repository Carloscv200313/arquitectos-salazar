-- PROPUESTA PARA REVISIÓN Y EJECUCIÓN MANUAL. NO EJECUTADA.
-- Permite retirar una firma de recibo de proyecto u obra y registrar el cambio
-- en audit_logs dentro de la MISMA transacción. No guarda la imagen de la firma
-- en el log ni modifica importes, saldos, códigos o el movimiento contable.
-- Precondiciones: migration-audit.sql aplicada, columnas signature/signed_at,
-- service_role con UPDATE en ambos movimientos e INSERT en audit_logs.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if to_regclass('public.audit_logs') is null
     or to_regclass('public.project_payments') is null
     or to_regclass('public.work_movements') is null
     or to_regclass('public.users') is null
     or to_regclass('public.roles') is null then
    raise exception 'Falta una tabla requerida para restablecer firmas';
  end if;
  if exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.audit_logs'::regclass
      and c.contype = 'f' and c.confrelid = 'auth.users'::regclass
      and a.attname = 'user_id'
  ) then
    raise exception 'audit_logs.user_id aún referencia auth.users; revisar migration-audit.sql';
  end if;
end $$;

create or replace function public.reset_receipt_signature(
  p_kind text, p_id uuid, p_actor_id uuid, p_note text
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_permission text;
  v_actor_name text;
  v_allowed boolean;
  v_signed boolean;
  v_signed_at timestamptz;
  v_amount numeric(14,2);
  v_entity text;
begin
  if p_kind not in ('proyecto', 'obra') or p_kind is null then
    raise exception 'Tipo de recibo inválido';
  end if;
  if p_note is null or length(btrim(p_note)) < 10 or length(btrim(p_note)) > 500 then
    raise exception 'La justificación debe tener entre 10 y 500 caracteres';
  end if;

  v_permission := case p_kind when 'proyecto' then 'projects.edit' else 'works.edit' end;
  select u.full_name,
         (r.name = 'Administrador' or coalesce(u.permissions, '[]'::jsonb) ? v_permission)
    into v_actor_name, v_allowed
  from public.users u
  left join public.roles r on r.id = u.role_id
  where u.id = p_actor_id and u.status = 1;
  if v_actor_name is null or not coalesce(v_allowed, false) then
    raise exception 'Usuario sin permiso para corregir la firma';
  end if;

  if p_kind = 'proyecto' then
    select pp.signature is not null, pp.signed_at, pp.amount
      into v_signed, v_signed_at, v_amount
    from public.project_payments pp
    where pp.id = p_id and pp.status = 1
    for update;
    if not found or not coalesce(v_signed, false) then
      raise exception 'El recibo no tiene una firma activa';
    end if;
    update public.project_payments
       set signature = null, signed_at = null
     where id = p_id;
    v_entity := 'project_movement';
  else
    select wm.signature is not null, wm.signed_at, wm.amount
      into v_signed, v_signed_at, v_amount
    from public.work_movements wm
    where wm.id = p_id and wm.status = 1
    for update;
    if not found or not coalesce(v_signed, false) then
      raise exception 'El recibo no tiene una firma activa';
    end if;
    update public.work_movements
       set signature = null, signed_at = null
     where id = p_id;
    v_entity := 'work_movement';
  end if;

  insert into public.audit_logs (
    user_id, user_name, action, operation, entity_type, entity_id,
    table_name, record_id, description, note, amount, snapshot
  ) values (
    p_actor_id, v_actor_name, v_entity || '.update', 'update', v_entity,
    p_id::text, v_entity, p_id::text,
    'Retiró la firma del recibo para volver a firmar', btrim(p_note), v_amount,
    jsonb_build_object(
      'before', jsonb_build_object('signed', true, 'signed_at', v_signed_at),
      'after', jsonb_build_object('signed', false, 'signed_at', null)
    )
  );
  return true;
end;
$$;

revoke all on function public.reset_receipt_signature(text,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.reset_receipt_signature(text,uuid,uuid,text)
  to service_role;
commit;

-- Reversión manual tras revisar consumidores: revoke execute ... from service_role;
-- drop function public.reset_receipt_signature(text,uuid,uuid,text);
-- No restaurar automáticamente una firma antigua: pudo ser errónea y no se
-- almacena en audit_logs. Restaurar solo desde un respaldo y con autorización.
