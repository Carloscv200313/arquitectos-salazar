-- Permite responsables del catalogo dinamico de empleados y "Sin asignar".
-- Conservado como migracion idempotente para instalaciones que aun tienen
-- las listas heredadas de nombres fijos.

alter table projects drop constraint if exists projects_proposal_responsible_check;
alter table projects drop constraint if exists projects_modeling_3d_responsible_check;
alter table projects drop constraint if exists projects_plans_responsible_check;
alter table projects drop constraint if exists projects_render_responsible_check;

alter table projects
  add constraint projects_proposal_responsible_check
    check (char_length(trim(proposal_responsible)) between 2 and 120),
  add constraint projects_modeling_3d_responsible_check
    check (char_length(trim(modeling_3d_responsible)) between 2 and 120),
  add constraint projects_plans_responsible_check
    check (char_length(trim(plans_responsible)) between 2 and 120),
  add constraint projects_render_responsible_check
    check (char_length(trim(render_responsible)) between 2 and 120);
