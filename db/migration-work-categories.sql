-- Catálogo de categorías de gasto de obra (CRUD desde Configuración).
-- Antes era una lista fija en código (WORK_CATEGORIES); ahora vive en DB.
-- "Abono de obra" NO se incluye: es la categoría de ingreso del sistema.

create table if not exists public.work_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  status      smallint not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

insert into public.work_categories (name) values
  ('Carpintería'),
  ('Material de construcción'),
  ('Material de obras'),
  ('Instalaciones'),
  ('Maquinaria'),
  ('Equipo y herramientas'),
  ('Herrería Arquitectónica'),
  ('Aluminio'),
  ('Tabla roca'),
  ('Honorarios'),
  ('Servicio'),
  ('Pintura'),
  ('Cantera'),
  ('Granito'),
  ('Yeso')
on conflict (name) do nothing;
