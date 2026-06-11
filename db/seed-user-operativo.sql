-- ============================================================================
-- Usuario operativo: solo Dashboard, Proyectos, Obras, Pedidos y Salario.
-- Los demás módulos (Finanzas: balance/deudas/utilidades/movimientos,
-- Configuración) le aparecen DESHABILITADOS en el menú.
-- Usuario:    operador
-- Contraseña: operador123
-- Ejecutar después de auth-users.sql. Re-ejecutable.
-- ============================================================================

insert into public.roles (name, description) values
  ('Operador', 'Acceso operativo limitado')
on conflict (name) do nothing;

do $$
declare op_role uuid;
begin
  select id into op_role from public.roles where name = 'Operador' limit 1;
  if not exists (select 1 from public.users where lower(email) = 'operador') then
    perform public.admin_create_user(
      'operador',
      'operador123',
      'Operador',
      op_role,
      '["dashboard.view","projects.view","projects.edit","works.view","works.edit","orders.view","orders.edit","salary.view","salary.edit"]'::jsonb,
      null
    );
  end if;
end $$;

-- ============================================================================
-- Fin
-- ============================================================================
