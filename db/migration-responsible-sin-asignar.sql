-- Permite "Sin asignar" como responsable interno en cada área del proyecto.
-- Aplicar solo si la base usa los CHECK de db/schema.sql.

alter table projects drop constraint if exists projects_proposal_responsible_check;
alter table projects drop constraint if exists projects_modeling_3d_responsible_check;
alter table projects drop constraint if exists projects_plans_responsible_check;
alter table projects drop constraint if exists projects_render_responsible_check;

alter table projects
  add constraint projects_proposal_responsible_check
    check (proposal_responsible in ('Alejandra', 'Juanfer', 'Juan Jose', 'Esmeralda', 'Sin asignar')),
  add constraint projects_modeling_3d_responsible_check
    check (modeling_3d_responsible in ('Alejandra', 'Juanfer', 'Juan Jose', 'Esmeralda', 'Sin asignar')),
  add constraint projects_plans_responsible_check
    check (plans_responsible in ('Alejandra', 'Juanfer', 'Juan Jose', 'Esmeralda', 'Sin asignar')),
  add constraint projects_render_responsible_check
    check (render_responsible in ('Alejandra', 'Juanfer', 'Juan Jose', 'Esmeralda', 'Sin asignar'));
