-- ============================================================================
-- Usuario operativo: solo Dashboard, Proyectos y Obras.
-- Los demás módulos (Pedidos, Salario, Finanzas: balance/deudas/utilidades/
-- movimientos, Configuración) le aparecen DESHABILITADOS en el menú.
-- Usuario:    operador
-- Contraseña: operador123
-- Ejecutar después de auth-users.sql. Re-ejecutable (sincroniza permisos
-- aunque el usuario ya exista).
-- ============================================================================

insert into public.roles (name, description) values
  ('Operador', 'Acceso operativo limitado')
on conflict (name) do nothing;

do $$
declare
  op_role uuid;
  op_perms jsonb := '["dashboard.view","projects.view","projects.edit","works.view","works.edit"]'::jsonb;
begin
  select id into op_role from public.roles where name = 'Operador' limit 1;
  if not exists (select 1 from public.users where lower(email) = 'operador') then
    perform public.admin_create_user(
      'operador',
      'operador123',
      'Operador',
      op_role,
      op_perms,
      null
    );
  else
    -- Usuario ya existe: re-sincroniza permisos (quita orders.* y salary.*).
    update public.users
       set permissions = op_perms
     where lower(email) = 'operador';
  end if;
end $$;

-- ============================================================================
-- Fin
-- ============================================================================
