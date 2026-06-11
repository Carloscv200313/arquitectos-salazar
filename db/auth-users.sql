-- ============================================================================
-- Arquitectos Salazar — Usuarios gestionados desde tabla propia
-- Login con sesión propia (cookie firmada). Contraseña hasheada con bcrypt
-- (pgcrypto). NUNCA en texto plano. Ejecutar DESPUÉS de supabase-schema.sql.
-- En Supabase, pgcrypto vive en el schema `extensions`, por eso el search_path
-- de las funciones incluye `extensions` (ahí están crypt() y gen_salt()).
-- Re-ejecutable: usa create or replace.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Aseguramos el rol Administrador.
insert into public.roles (name, description) values
  ('Administrador', 'Acceso total al sistema')
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- Tabla de usuarios del sistema (independiente de auth.users)
-- permissions: arreglo JSON de claves "modulo.accion" (ej. "projects.edit").
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  full_name     text not null,
  role_id       uuid references public.roles(id),
  permissions   jsonb not null default '[]'::jsonb,
  avatar_url    text,
  last_login_at timestamptz,
  status        smallint not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid
);
create index if not exists users_email_idx on public.users(lower(email));
create index if not exists users_status_idx on public.users(status);

drop trigger if exists set_updated_at on public.users;
create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;
-- Sin políticas públicas: solo el servidor (service_role) accede a esta tabla.

-- ----------------------------------------------------------------------------
-- Funciones (SECURITY DEFINER). search_path incluye `extensions` para crypt().
-- ----------------------------------------------------------------------------

create or replace function public.verify_login(p_email text, p_password text)
returns table (
  id uuid, email text, full_name text, role_id uuid, role_name text,
  permissions jsonb, status smallint
)
language sql security definer set search_path = public, extensions as $$
  select u.id, u.email, u.full_name, u.role_id, r.name, u.permissions, u.status
  from public.users u
  left join public.roles r on r.id = u.role_id
  where lower(u.email) = lower(p_email)
    and u.status = 1
    and u.password_hash = crypt(p_password, u.password_hash)
  limit 1;
$$;

create or replace function public.admin_create_user(
  p_email text, p_password text, p_full_name text,
  p_role_id uuid, p_permissions jsonb, p_created_by uuid default null
)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare new_id uuid;
begin
  insert into public.users (email, password_hash, full_name, role_id, permissions, created_by)
  values (
    lower(p_email),
    crypt(p_password, gen_salt('bf')),
    p_full_name,
    p_role_id,
    coalesce(p_permissions, '[]'::jsonb),
    p_created_by
  )
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.admin_set_password(p_user_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.users
  set password_hash = crypt(p_password, gen_salt('bf')), updated_at = now()
  where id = p_user_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Usuario administrador inicial.
-- Usuario:    admin
-- Contraseña: admin123
-- ----------------------------------------------------------------------------
do $$
declare admin_role uuid;
begin
  select id into admin_role from public.roles where name = 'Administrador' limit 1;
  if not exists (select 1 from public.users where lower(email) = 'admin') then
    perform public.admin_create_user(
      'admin',
      'admin123',
      'Administrador',
      admin_role,
      '["dashboard.view","projects.view","projects.edit","works.view","works.edit","orders.view","orders.edit","finance.view","finance.edit","salary.view","salary.edit","settings.view","settings.edit","users.view","users.edit"]'::jsonb,
      null
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Quitar FKs hacia auth.users. Ahora los usuarios viven en public.users, así
-- que created_by / audit_logs.user_id NO deben referenciar auth.users (de lo
-- contrario cada insert con un id de public.users falla la FK).
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select conname, conrelid::regclass as tbl
    from pg_constraint
    where contype = 'f'
      and conname like '%\_created\_by\_fkey'
  loop
    execute format('alter table %s drop constraint if exists %I', r.tbl, r.conname);
  end loop;

  alter table public.audit_logs drop constraint if exists audit_logs_user_id_fkey;
end $$;

-- ============================================================================
-- Fin
-- ============================================================================
