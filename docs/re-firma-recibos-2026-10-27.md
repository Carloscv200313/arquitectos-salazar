# Corrección de firma de recibos con auditoría

**Estado:** implementado y probado localmente. Sin migraciones ejecutadas y sin despliegue. Aplica a recibos de movimientos de **proyectos** (`/recibo/proyecto/:id`) y **obras** (`/recibo/obra/:id`); los comprobantes salariales tienen otro flujo y quedan fuera de este cambio.

## Comportamiento preparado

- En un recibo firmado, un usuario interno activo con permiso `projects.edit` o `works.edit` ve **Corregir firma**. Debe escribir un motivo de 10 a 500 caracteres y confirmar. Un enlace público de firma no permite retirar la firma.
- La función SQL propuesta [`migration-reset-receipt-signature-2026-10-27.sql`](../db/migration-reset-receipt-signature-2026-10-27.sql) bloquea el movimiento, comprueba que esté activo y firmado, pone `signature` y `signed_at` en `NULL` y añade la entrada de auditoría **en una misma transacción**. Si la auditoría falla, la actualización se revierte. No copia la imagen anterior al log; registra actor, momento, motivo y estado antes/después.
- Después del retiro, el mismo formulario permite firmar de nuevo. El guardado existente solo acepta una firma cuando la columna está vacía. El importe, fecha, concepto, código, saldo y movimiento contable no cambian.

## Verificación local

- 55/55 pruebas aprobadas. Las nuevas pruebas cubren ausencia de sesión, usuario lector, motivo inválido, permiso por módulo, llamada RPC, fallo RPC sin confirmación al usuario y visibilidad de la entrada aunque el actor se llame «Administrador».
- TypeScript y ESLint sin errores; ESLint conserva 3 advertencias de imágenes en recibos. Build de Next.js aprobado en copia aislada con credenciales sintéticas, sin tráfico de producción.
- Se comprobó **solo en lectura** que las columnas requeridas existen en `audit_logs`, `project_payments`, `work_movements` y `users`. No se inspeccionaron ni modificaron firmas reales.
- Se quitó del listado paginado de auditoría el filtro que ocultaba acciones de «Administrador» y «Sistema»; la vista ahora muestra también sus cambios recientes.
- La migración se ejecutó **solo en un PostgreSQL 16 local temporal** con datos sintéticos. Se verificó: retiro en obra y proyecto, dos entradas de auditoría sin imagen, denegación a un lector, rollback de la firma cuando falla el `INSERT` de auditoría, permisos `EXECUTE` limitados a `service_role` y posibilidad de firmar de nuevo. El servidor local se detuvo al terminar. Esto no sustituye la prueba contra el esquema real de staging.

## Activación manual segura

1. Ejecutar manualmente primero el [diagnóstico de solo lectura](../db/audit-readonly-re-signature-2026-10-27.sql), revisar la migración completa y confirmar en un entorno de ensayo la estructura, el FK de `audit_logs.user_id`, permisos `service_role` y consumidores de los recibos. Respaldar esquema, grants y datos antes de aplicar cualquier SQL.
2. Ejecutar la migración **manualmente en staging**. Confirmar que `anon` y `authenticated` no pueden ejecutar `reset_receipt_signature`, que `service_role` sí puede, y que los fallos dejan la firma intacta y sin entrada de auditoría falsa. Probar con recibos sintéticos de obra y proyecto, incluidos dos intentos simultáneos. No usar firmas de personas reales.
3. Desplegar el código en staging. Abrir un recibo firmado como editor y como lector, retirar con motivo, comprobar la entrada en `/auditoria`, firmar de nuevo y verificar el documento. Probar también el enlace público: puede firmar cuando corresponda, pero no retirar.
4. Solo tras aprobar staging, el usuario puede autorizar y ejecutar la migración en producción y después desplegar el código correspondiente. **No desplegar el botón antes de instalar la RPC**: daría error al confirmar. No ejecutar el SQL desde esta sesión.

## Riesgos y reversión

- La función es nueva y tiene `EXECUTE` únicamente para `service_role`; el permiso efectivo también se comprueba en la aplicación y dentro de la función. La migración falla si `audit_logs.user_id` aún apunta a `auth.users`.
- La firma retirada deja de estar en la fila. El log guarda su estado y fecha, **no los bytes de la firma**. Para recuperar la imagen anterior haría falta un respaldo y autorización específica; esta eliminación es la operación solicitada.
- Los enlaces públicos de firma actuales duran hasta siete días y no se revocan al retirar una firma. Si se necesita impedir que quien tenía el enlace anterior vuelva a firmar, hace falta un mecanismo adicional de revocación/versionado de enlaces antes de habilitar el flujo público tras el retiro.
- Para revertir la funcionalidad, volver al artefacto anterior y, tras revisar consumidores, revocar `EXECUTE` a `service_role` y eliminar la función nueva. No restaurar firmas antiguas de forma automática.
