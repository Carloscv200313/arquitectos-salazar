# Cierre técnico local y preparación de preproducción

**Arquitectos Salazar · 27 de octubre de 2026.** Este documento continúa [la auditoría](auditoria-seguridad-rendimiento-egress-2026-10-26.md), [las correcciones iniciales](correcciones-seguridad-rendimiento-2026-10-27.md) y [la verificación de logs](verificacion-posterior-logs-2026-10-27.md). Todos los cambios siguen locales y sin commit. No se accedió a Supabase de producción, no se ejecutó SQL remoto y no se desplegó.

## A. Problemas corregidos y estado

| Problema y causa | Solución y archivos | Prueba y resultado | Estado |
| --- | --- | --- | --- |
| N+1 de pedidos/obras/movimientos en dashboard, deudas y detalle | `lib/data/orders.ts`, `works.ts`, `finance.ts`: lotes, cache por render y reutilización de filas. | 24 obras y 288 pedidos: resultados financieros idénticos; deudas 1.190→16 llamadas, dashboard 1.251→46. | **SOLUCIONADO Y PROBADO** localmente |
| Movimientos de proyectos consultados uno por uno en dashboard | `lib/data/projects.ts`: lectura agrupada; `app/(dashboard)/dashboard/page.tsx` la consume. | 24 proyectos: 24→1 lectura de `project_payments`; mismo orden e importes. | **SOLUCIONADO Y PROBADO** localmente |
| `SELECT *` de pedidos/pagos y consultas amplias en cotización/edición | `lib/data/columns.ts`, `orders.ts`: proyecciones explícitas para filas activas y operaciones. | Regresión de pedidos/deudas/dashboard y TypeScript. Deudas con 24 obras: JSON 529.884→517.476 B frente a la ronda local anterior. | **SOLUCIONADO Y PROBADO** localmente; confirmar columnas en staging |
| Validación de abono público descargaba proyecto y relaciones completos | `lib/data/projects.ts`, `app/abono/actions.ts`: saldo con `total_amount` y pagos de ingreso; misma función de cálculo. | Fixture: pendiente idéntico; consulta válida 3→2 llamadas y 9.739→aprox. 50 B JSON. | **SOLUCIONADO Y PROBADO** localmente; no resuelve autorización del pagador |
| Lecturas duplicadas entre módulos en el mismo render | `lib/supabase/transport.ts`: cache por URL y **todas las cabeceras**; el nombre del módulo queda solo para diagnóstico. | Dos módulos/credenciales iguales: 1 transporte; credenciales distintas: 2. Escritura invalida el cache. | **SOLUCIONADO Y PROBADO** localmente |
| Recargas explícitas después de acciones que invalidan la ruta | `components/finance/debts-view.tsx`, `components/projects/movement-actions.tsx`, `components/settings/{users-section,settings-view}.tsx` y los formularios de pedidos/obras previamente corregidos. | Acciones con `revalidatePath` revisadas; suite, TypeScript y build. Refresco visible tras interacción requiere prueba de navegador en staging. | **CORREGIDO LOCALMENTE, PENDIENTE DE STAGING** |
| Inicio de sesión confiaba solo en estado filtrado por RPC | `features/auth/actions.ts`: exige `status=1` antes de actualizar último acceso/crear cookie. | Fixture de usuario inactivo: 0 actualizaciones y 0 cookies; cierre elimina cookie. | **SOLUCIONADO Y PROBADO** localmente; RPC real pendiente |
| Riesgo de registrar detalles sensibles de un error de auditoría | `lib/data/audit.ts`: mensaje genérico; `SELECT` explícito para lectura heredada. | Suite y revisión estática; no se imprimen objetos de error. | **SOLUCIONADO Y PROBADO** localmente |
| Sin umbrales visibles de consumo por pantalla | `lib/supabase/telemetry.ts`: alertas de volumen, bytes JSON, duplicados, duración y errores, con `DATA_TELEMETRY=1`. | Prueba inyecta métricas sintéticas sin tráfico y verifica alertas. | **SOLUCIONADO Y PROBADO** localmente; integración con alertas de hosting pendiente |
| Privilegios RPC mezclados con migración de ACL que se bloquea por Realtime | [SQL separado para RPC](../db/migration-admin-rpc-grants-2026-10-27.sql), no ejecutado. | Revisión de firmas en script; falta contraste con esquema real y prueba de staging. | **REQUIERE ACCESO O AUTORIZACIÓN** para aplicar |

Correcciones previas conservadas: permisos de servidor por módulo, sesión revalidada contra usuario activo, cookies firmadas, secretos sin valores predeterminados, documentos con token temporal, firmas con restricciones, paginación de informes sin truncar saldos, notificaciones con un canal Realtime y respaldo controlado. Los detalles y archivos están en los informes enlazados arriba.

## B. Rendimiento y límites de medición

Las cifras son **consultas lógicas simuladas** y bytes de JSON calculados en memoria. El transporte puede paginar una consulta lógica en varias solicitudes HTTP; la telemetría opcional registra ambos contadores. No equivalen a Egress facturado. La muestra histórica de 1.000 registros no incluye el volumen por respuesta y no permite atribuir los 19,85 GB a un único origen.

| Flujo sintético | Consultas antes → después | `work_orders` antes → después | `work_movements` antes → después | JSON antes → después |
| --- | ---: | ---: | ---: | ---: |
| Deudas, 24 obras | 1.190 → 16 | 25 → 1 | 291 → 4 | 62.186.030 → 517.476 B |
| Dashboard, 24 obras | 1.251 → 46 | 26 → 1 | 320 → 8 | 79.731.935 → 722.067 B |
| Pedidos, una obra | 49 → 6 | 1 → 1 | 12 → 2 | 2.169.444 → aprox. 21 KB |
| Detalle de una obra | 8 → 6 | 0 → 0 | 4 → 2 | 717.410 → aprox. 15 KB |
| Saldo previo a pago de pedido | 6 → 2 | 1 → 1 | 2 → 0 | aprox. 15 KB → menos de 1 KB |
| Dashboard, tramo de 24 proyectos | 24 → 1 a `project_payments` | — | — | salida de movimientos idéntica |

Las 180 solicitudes idénticas a `work_movements` ya no se originan por pedido **dentro de un render** de las rutas probadas. Muchas navegaciones, pestañas o llamadas externas todavía podrían producir 180 consultas en minutos. El antiguo sondeo de notificaciones es una hipótesis para las 111 consultas idénticas a `work_orders`, no una atribución demostrada. El cache está limitado al render para no mezclar usuarios.

## C. Seguridad, SQL y decisiones pendientes

1. **RPC, RLS y ACL reales — REQUIERE ACCESO O AUTORIZACIÓN.** Ejecutar el [preflight de solo lectura](../db/audit-readonly-security-2026-10-26.sql) en el proyecto correcto y guardar propietarios, firmas, grants, políticas, esquemas expuestos, `search_path`, funciones `SECURITY DEFINER`, consumidores legítimos y publicación Realtime. El [script de RPC](../db/migration-admin-rpc-grants-2026-10-27.sql) puede probarse por separado en staging. La [migración general](../db/migration-security-2026-10-26.sql) se bloquea si `work_orders` está publicado; no revocar lectura anónima hasta definir un Realtime seguro con la autenticación propia.
2. **Abonos públicos — REQUIERE DECISIÓN DEL NEGOCIO.** Hoy un visitante puede crear un ingreso definitivo si conoce un proyecto u obra. La comprobación de saldo y el límite local no prueban que pagó. Recomendación: recibir una **solicitud pendiente** con identificador único, verificación administrativa y aprobación atómica que genere el movimiento financiero una sola vez. La alternativa de enlace temporal firmado limita quién puede enviar la solicitud, pero su posesión no verifica recepción de dinero; si se mantiene ingreso definitivo, el negocio acepta ese riesgo y debe definir emisor, caducidad, revocación y un solo uso. La migración para estado/idempotencia y la interfaz administrativa dependen de esta elección. No se cambió la contabilidad.
3. **Concurrencia e idempotencia — PENDIENTE de la decisión anterior.** Dos solicitudes simultáneas de abono podrían leer el mismo saldo y registrar importes que juntos lo superen. Un bloqueo transaccional y una clave única de solicitud deben implementarse en una RPC o procedimiento de PostgreSQL; un candado solo en React o memoria no basta en varios servidores. No se introdujo una protección incompleta que pudiera aparentar seguridad.
4. **Otras rutas públicas — CORREGIDO LOCALMENTE, PENDIENTE DE STAGING.** Rate limiting local, comprobaciones de documentos, tokens de recibo/firma y validación de permisos existen. Se requieren límites distribuidos en hosting/WAF, pruebas de URL con token, múltiples instancias y acceso a Storage. No se verificaron ACL reales.
5. **Índices — PENDIENTE de evidencia del plan real.** El repositorio ya define índices para `work_orders(work_id)`, `work_movements(work_id)`, `project_payments(project_id)` y algunos ordenamientos. [El diagnóstico de solo lectura](../db/audit-readonly-performance-2026-10-27.sql) inventaría índices, estadísticas y cardinalidad. Solo si `EXPLAIN` real muestra coste material, evaluar índices parciales `(work_id, order_date DESC, id) WHERE status=1`, `(work_id, movement_date DESC, id) WHERE status=1` o `(project_id, payment_date DESC, id) WHERE status=1`; comparar espacio y coste de escritura. No se preparó un `CREATE INDEX` automático sin esa prueba. Reversión: retirar solo el índice aprobado tras confirmar que nadie depende de él.

## D. Funcionalidades y pruebas

La suite local usa fixtures sintéticos y comprueba saldos, balances, deudas, pagos, pedidos, detalle de obras, reportes, salarios, utilidades, proyectos, búsqueda, paginación, errores 402, autorización de acciones, sesiones, recibos, tokens y política de notificaciones. **47/47 pruebas pasaron** en la corrida posterior a las correcciones de datos. TypeScript y el build de producción aislado pasaron; este último usó claves sintéticas, sin `.env` ni llamadas a producción. La clave sintética de `service_role` no apareció en el directorio de archivos estáticos compilados. ESLint mostró cero errores y tres advertencias antiguas sobre `<img>` en recibos.

Quedan para staging con navegador y Supabase aislado: alta/edición y navegación de cada módulo, refresh visual después de acciones, firmas y documentos reales con Storage, reconexión Realtime, varias pestañas, permisos de PostgreSQL/RPC, sesión desactivada durante una navegación, idempotencia y concurrencia del abono según decisión, y comparación financiera con una copia anonimizada de datos representativos. No se declaró ninguna de esas pruebas como aprobada en producción.

## E. Orden exacto para despliegue posterior

1. Confirmar **proyecto** y ciclo en Usage de Supabase; separar consumo de `All projects`. Obtener muestra sanitizada de URL/proyección/tamaño de las consultas repetidas y correlacionarla con rutas de hosting.
2. Respaldar datos, esquema, funciones, grants, RLS, publicación Realtime y Storage. Verificar que el respaldo se pueda restaurar. Guardar el artefacto de aplicación actual y configuración del hosting sin registrar secretos.
3. Ejecutar preflights SQL **solo de lectura**; revisar índices y planes; decidir regla de abono público. Revisar variables obligatorias (`AUTH_SECRET`, URL y claves Supabase, encabezado IP confiable si se usa, `DATA_TELEMETRY`, `USE_SEARCH_RPC`) sin imprimir valores.
4. Desplegar código y SQL **primero en staging**, por separado. Probar RPC grant antes que ACL general; validar login/admin y Realtime tras cada cambio. Activar la búsqueda RPC solo si su migración opcional fue ejecutada y probada. No ejecutar la migración de ACL general si la guarda de Realtime falla.
5. Hacer pruebas de flujos, documentos, permisos, 401/402/403/429, datos financieros antes/después y concurrencia. Observar métricas por pantalla, tabla, endpoint y errores. Corregir cualquier diferencia antes de seguir.
6. Solicitar autorización explícita para producción. En una ventana controlada, desplegar el mismo artefacto, aplicar únicamente migraciones revisadas y necesarias, hacer pruebas de humo y observar Egress por proyecto, consultas repetidas y saldos.
7. **Reversión:** volver al artefacto previo si falla una función o cambia un saldo; restaurar ACL/RLS/publicación desde el respaldo exacto bajo revisión humana. No ejecutar un rollback genérico que reabra RPC a `PUBLIC`. Restaurar datos solo según un plan específico que preserve operaciones legítimas posteriores al corte.

## F. Métricas y criterio de salida

Con `DATA_TELEMETRY=1` temporalmente, observar `screen_data_metrics` y `database_request`: solicitudes HTTP reales, consultas lógicas, duplicados, bytes JSON aproximados, duración, errores y alertas por pantalla/recurso. No almacenar URL, parámetros, respuesta, token ni usuario identificable. Correlacionar por `traceId` y revisar la frecuencia de rutas del hosting. Los bytes JSON **no sustituyen** la métrica facturada de Egress.

Medir diariamente Egress de PostgREST, Realtime y Storage **del proyecto Arquitectos Salazar**, cuota restante y proyección al final del ciclo; comparar días normales y picos. Para considerar el regreso al plan gratuito, exigir un periodo representativo posterior al despliegue, con margen para crecimiento y otros proyectos claramente separados. No se puede prometer ese resultado con solo el simulador local.

**Estado global:** código local más seguro y eficiente, con pruebas automatizadas; **pendiente de staging, decisión de abonos y validación/aplicación autorizada de SQL antes de producción**. Ningún cambio está validado en producción.

## G. Estadísticas reales recibidas tras la auditoría de lectura

El usuario compartió una salida parcial de `pg_stat_user_tables` y `pg_stat_user_indexes` del proyecto. `work_movements` tiene aproximadamente 8.196 filas vivas y ocupa 8.429.568 B **en disco, incluidos índices y TOAST**. `work_orders` tiene aproximadamente 15 filas y ocupa 81.920 B. `audit_logs` tiene aproximadamente 10.519 filas y ocupa 5.726.208 B. Estos tamaños **no son** bytes de respuesta ni Egress facturado. `n_live_tup` es una estimación; los contadores de índices son acumulados desde el último reinicio de estadísticas, no una medición del 21 de octubre. Véanse [estadísticas de PostgreSQL](https://www.postgresql.org/docs/current/monitoring-stats.html) y [tamaño de relaciones](https://www.postgresql.org/docs/current/functions-admin.html).

El índice `work_movements_work_idx` acumula 145.351 exploraciones, 260.655.315 entradas de índice leídas y 242.295.847 filas vivas recuperadas. La relación aproximada es 1.793 entradas leídas por exploración. `project_payments_project_idx` acumula 34.520 exploraciones aunque la tabla tiene unas 144 filas. Estos datos **son consistentes con lecturas repetidas** y apoyan la prioridad de agrupar consultas por obra/proyecto. No identifican página, usuario, fecha ni cantidad enviada por HTTP. Los índices existentes sí se usan; por tanto no se propone crear nuevos índices solo para reducir Egress.

La salida compartida no incluyó todavía las partes decisivas de seguridad: ACL/RLS por tabla, privilegios `EXECUTE` y propietarios de las tres RPC administrativas, pertenencia de `work_orders` a `supabase_realtime`, ni columnas presentes. No ejecutar migraciones de permisos basándose únicamente en las estadísticas de tablas/índices.
