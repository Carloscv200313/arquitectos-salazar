-- Permite registrar ingresos y gastos en el módulo Finanzas > Movimientos.
-- Los registros existentes se conservan como gastos, que era el comportamiento anterior.

alter table public.finance_movement_captures
  add column if not exists movement_type text not null default 'expense';

alter table public.finance_movement_captures
  drop constraint if exists finance_movement_captures_movement_type_check;

alter table public.finance_movement_captures
  add constraint finance_movement_captures_movement_type_check
  check (movement_type in ('income','expense'));
