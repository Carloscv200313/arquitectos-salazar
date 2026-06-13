-- Catálogo de proveedores (CRUD desde Configuración).
-- Antes era una lista fija en código (WORK_PROVIDERS); ahora vive en DB.

create table if not exists public.providers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  status      smallint not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

-- Semilla con los proveedores históricos.
insert into public.providers (name) values
  ('Estribadora'),
  ('Concretos LOPAR'),
  ('Materiales Aguilar'),
  ('Mat. Gonzalez'),
  ('Mat. Quezada'),
  ('Caracol Betania'),
  ('Caracol Ayotlán'),
  ('Alfarería León'),
  ('Logonza'),
  ('Maderería Paisa'),
  ('Master Block')
on conflict (name) do nothing;
