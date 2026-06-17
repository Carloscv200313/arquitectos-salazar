-- ============================================================================
-- Firma digital en los documentos (recibos de abono y comprobantes de pago).
-- La firma se dibuja en una pizarra y se guarda como data URL PNG (base64).
-- Un documento sin firma NO se puede imprimir; una vez firmado, queda guardado
-- y futuras impresiones lo muestran sin volver a pedir firma.
-- ============================================================================

-- Abonos de proyecto (project_payments con movement_type = 'income').
alter table public.project_payments add column if not exists signature text;
alter table public.project_payments add column if not exists signed_at timestamptz;

-- Abonos de obra (work_movements con movement_type = 'income').
alter table public.work_movements add column if not exists signature text;
alter table public.work_movements add column if not exists signed_at timestamptz;

-- Comprobantes de pago a empleados.
alter table public.salary_receipts add column if not exists signature text;
alter table public.salary_receipts add column if not exists signed_at timestamptz;
