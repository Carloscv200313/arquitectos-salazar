-- Código de boleta para abonos (ingresos).
-- Proyectos: nueva columna receipt_code (ej. PRY-000123).
-- Obras: se reutiliza la columna existente work_movements.receipt (ej. OBR-000123).

alter table project_payments
  add column if not exists receipt_code text;
