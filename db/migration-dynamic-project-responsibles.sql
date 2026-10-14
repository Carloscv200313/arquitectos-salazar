-- Los responsables de proyecto se administran desde el catalogo de empleados.
-- Elimina las listas heredadas de nombres fijos para permitir nombres completos.

alter table public.projects
  drop constraint if exists projects_proposal_responsible_check,
  drop constraint if exists projects_modeling_3d_responsible_check,
  drop constraint if exists projects_plans_responsible_check,
  drop constraint if exists projects_render_responsible_check;

alter table public.projects
  add constraint projects_proposal_responsible_check
    check (char_length(trim(proposal_responsible)) between 2 and 120),
  add constraint projects_modeling_3d_responsible_check
    check (char_length(trim(modeling_3d_responsible)) between 2 and 120),
  add constraint projects_plans_responsible_check
    check (char_length(trim(plans_responsible)) between 2 and 120),
  add constraint projects_render_responsible_check
    check (char_length(trim(render_responsible)) between 2 and 120);
