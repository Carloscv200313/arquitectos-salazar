-- ============================================================================
-- Empleados iniciales (los que existían como datos de prueba).
-- Ejecutar una vez. Re-ejecutable: no duplica (índice único en full_name).
-- ============================================================================

create unique index if not exists employees_full_name_uidx
  on public.employees (full_name);

insert into public.employees (full_name, default_work_type) values
  ('Alejandra', 'project'),
  ('Juanfer',   'work'),
  ('Juan Jose', 'work'),
  ('Esmeralda', 'project')
on conflict (full_name) do nothing;

-- ============================================================================
-- Fin
-- ============================================================================
