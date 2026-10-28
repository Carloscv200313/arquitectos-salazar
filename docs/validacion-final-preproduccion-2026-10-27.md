# Validación final de preproducción: Arquitectos Salazar

> **Corrección posterior al despliegue:** el informe había tratado `Honorarios` como regla original del código, pero la regla funcional documentada y los datos reales usan egresos de `Cuenta de oficina` para «Utilidad obras». El 27/10/2026 se comprobó en solo lectura que había 0 movimientos activos `Honorarios` y 386 `Cuenta de oficina`. Se preparó un parche que restaura este criterio en ambos reportes. Las referencias a una decisión pendiente sobre esta categoría en el texto inferior reflejan el estado anterior al parche.

**Estado al 27/10/2026:** preparación local completada. **No se ejecutaron pruebas en staging** porque el repositorio no identifica un entorno de staging ni contiene una configuración separada para él. No se accedió a producción, se desplegó, se ejecutó SQL remoto ni se modificaron datos reales. Este documento continúa [el análisis del CSV](analisis-csv-supabase-2026-10-27.md) y [el cierre técnico previo](cierre-tecnico-preproduccion-2026-10-27.md); no sustituye sus evidencias.

## 1. Estado de cambios y validación ejecutada

- `git status --short` muestra los cambios previos de la auditoría y archivos nuevos aún sin confirmar. Se conservaron todos. En esta etapa solo se añadió una prueba sintética específica para 30 invocaciones/navegaciones y este plan. No se hizo `reset`, `checkout`, `push` ni commit.
- `pnpm test`: **50/50 aprobadas**. `pnpm typecheck`: aprobado. `pnpm lint`: 0 errores y 3 advertencias de `<img>` en recibos. `git diff --check`: aprobado. El build aislado de Next.js con credenciales sintéticas aprobó antes de esta etapa; desde entonces no se modificó código de aplicación.
- La suite compara resultados anteriores y nuevos de deudas, balance, utilidades, estados, salarios, pedidos, detalle de obra, proyectos y dashboard con fixtures sintéticos; incluye permisos, sesión desactivada, documentos/firma, notificaciones, 402 y paginación. **No equivale a pruebas de navegador ni de PostgreSQL real**.

## 2. ¿Pueden repetirse 30 lecturas de `work_movements` en 35 segundos?

La firma específica del CSV era una consulta a `work_movements` con `work_id=in.(...)` para 19 obras. [`listWorkMovementsByWorkIds`](../lib/data/works.ts) ya no envía ese filtro a PostgREST: filtra en memoria los hechos compartidos que trae [`listActiveWorkMovementFacts`](../lib/data/work-movement-facts.ts). El `.in("work_id", ...)` que permanece en `works.ts` corresponde a **`work_files`**, no a `work_movements`. En el código local revisado, **esa URL exacta ya no debería salir de este flujo**.

La prueba nueva en [`financial.test.cjs`](../tests/financial.test.cjs) usa 19 obras y 760 movimientos, sin red. Treinta llamadas concurrentes a `listWorks()` en un mismo render produjeron **2 solicitudes simuladas a `work_movements`** (datos y página vacía); treinta renders independientes produjeron **60**. Por tanto, el cache resuelve duplicación interna al render, pero no treinta navegaciones, recargas, pestañas, procesos o usuarios distintos. La consulta común de 8.170 movimientos necesita varias páginas en cada render nuevo. El CSV no incluye la ruta Next.js ni el tamaño por respuesta para distinguir esos casos históricos.

**Criterio en staging:** para una navegación única al dashboard, comparar `screen_data_metrics.traceId`, `wireRequests`, `duplicateQueries` y `resources.work_movements.requests` con la traza de red; comprobar que la misma huella `queryHash` no se repite de forma innecesaria dentro de ese `traceId`. Repetir con una navegación, cinco recargas deliberadas y dos pestañas; separar las solicitudes esperadas por navegación de duplicados internos. Si se observan 30 solicitudes en 35 s sin 30 navegaciones/eventos equivalentes, detener el despliegue y correlacionar rutas HTTP del hosting, `traceId` y eventuales invocaciones de Server Actions.

## 3. Matriz integral de staging con datos sintéticos o anonimizados

Usar un proyecto Supabase **separado** y credenciales propias de staging. Cargar una copia anonimizada o fixtures con al menos 19 obras, más de 8.000 movimientos, 24 proyectos, varios pedidos por obra, pagos parciales, distintas cuentas, dos usuarios de roles distintos y un usuario desactivado. Conservar un resultado de referencia calculado con el artefacto anterior en el **mismo conjunto de datos**. No cargar firmas, contraseñas, nombres ni documentos reales sin anonimizar.

| Flujo | Acción de navegador/staging | Comparación y aceptación |
| --- | --- | --- |
| Dashboard | Abrir una vez, navegar a otra pantalla y volver, recargar cinco veces | Tarjetas, fechas, totales y movimientos iguales a la referencia; por navegación, medir solicitudes/bytes por tabla y ausencia de duplicados internos. |
| Pedidos | Listar, abrir una obra con varios pedidos, crear/cotizar/modificar un pedido sintético, registrar pago | Pendientes, pagos y lista reflejan el cambio una vez; sin llamadas por cada pedido a la obra completa ni refrescos múltiples tras una acción. |
| Obras y movimientos | Listar, abrir obra con historial >1.000, filtrar, crear/editar un movimiento sintético | Historial completo y paginación correcta; saldos y categorías iguales a referencia; firma no descargada en listados generales. |
| Abonos | Consultar pendiente, intentar duplicado y registrar abono sintético solo en staging | Saldo exacto, rechazo de excedente y comportamiento contable documentado. No validar como seguro el flujo público sin decisión de autorización del pagador. |
| Deudas y balances | Abrir deudas de proveedores/clientes, detalle, balance general y por cuenta | Totales, pagos, saldos y orden coinciden con referencia; ninguna consulta N+1 por pedido/obra. |
| Utilidades y estados | Abrir reportes mensual y financiero con meses y categorías distintas | Comparar cada mes y total; confirmar explícitamente regla `Honorarios` antes de aceptar. No truncar datos financieros al paginar. |
| Salarios | Abrir semana, pago, recibo y reporte | Importes, estados y recibos idénticos; acceso solo con permiso. |
| Documentos y firmas | Abrir recibo autorizado, probar URL ajena/caducada, firmar documento sintético y repetir firma | Acceso ajeno denegado, firma visible en documento correcto y sobrescritura rechazada. |
| Notificaciones/Reatime | Una pestaña, dos pestañas, oculta/visible, reconexión, error 402 simulado en staging | Un canal por pestaña y limpieza al desmontar; aviso visible; respaldo a 60 s sin Realtime o 300 s con Realtime; pestaña oculta sin polling; 401/402/403 detienen solicitudes, 429 retrocede. |
| Roles/sesiones | Login/logout, expiración, desactivar usuario de prueba, invocar Server Action directamente sin permiso | Sin operaciones protegidas tras desactivación; 403/denegación apropiada; administrador legítimo conserva acceso. |

**Datos de comparación:** guardar para cada caso el resultado financiero serializado sin datos personales, conteo de solicitudes HTTP reales, tabla, bytes JSON aproximados, duración, errores y versión del artefacto. Las cifras locales previas (por ejemplo dashboard grande 72→52 solicitudes simuladas y `work_movements` 34→14) son una referencia de tendencia, **no umbrales fijos de producción**.

## 4. Protocolo de navegación real para staging

1. Desplegar en staging el commit/artefacto identificado, con `DATA_TELEMETRY=1` y **sin** usar credenciales de producción. Verificar que el navegador carga únicamente la clave publishable; la `service_role` debe estar solo en variables del servidor. No imprimir valores.
2. Abrir DevTools → Network, conservar el registro, desactivar cache solo durante la medición comparativa y registrar hora de inicio/fin. Filtrar `/dashboard`, `/pedidos`, `/obras`, `/finance`, `/api/order-notifications` y solicitudes WebSocket. No exportar un HAR sin sanitizar: puede contener cookies, filtros, tokens y datos personales.
3. Hacer cada secuencia **una vez** con una sola pestaña y sin interacciones extra. Contar solicitudes de documento/RSC, Server Actions, notificaciones y WebSocket; correlacionar con `screen_data_metrics.traceId` y `database_request.queryHash` del hosting. La primera carga y una navegación interna deben registrarse por separado.
4. Repetir con dos pestañas del mismo usuario: una visible y una oculta durante al menos 6 minutos. Esperar una lectura inicial por pestaña; no exigir cero conexiones Realtime en pestaña oculta, pues el componente mantiene el canal. El polling de la pestaña oculta debe cesar. Con Realtime activo se espera una comprobación de respaldo alrededor de 5 minutos por pestaña visible; con fallo de canal, alrededor de 1 minuto, sujeto a temporizadores del navegador.
5. Ejecutar una acción de escritura **solo con datos sintéticos de staging** y comprobar que tabla, saldo y notificación se actualizan sin dos recargas de la misma pantalla. Probar 402/429 mediante simulación o proxy de staging, nunca forzando cuota de producción.
6. Comparar artefacto anterior y nuevo con el mismo fixture, navegador, número de pestañas y secuencia. Reportar diferencias y el motivo; detener promoción si cualquier importe cambia o si aparece un ciclo de peticiones sin interacción.

La telemetría actual es por render/solicitud, no un contador agregado entre pestañas. El hosting debe proporcionar el recuento de rutas y frecuencia por sesión seudónima para detectar recargas repetidas. No almacenar URL completa, cuerpo, cookies ni tokens en la observabilidad.

## 5. Regla de utilidades que necesita confirmación

La versión original de [`works.ts`](../lib/data/works.ts) seleccionaba `category = 'Honorarios'` y sumaba el importe por `movement_date`, sin filtrar por tipo de movimiento. Durante correcciones locales anteriores se había cambiado a `Cuenta de oficina` y solo egresos; se restauró **la regla original** y una prueba la fija. En el fixture de 40 movimientos, la regla original suma **803,60** en septiembre, mientras la regla local intermedia daba **200,80**. Es una diferencia de criterio, no de redondeo. **Negocio/contabilidad debe confirmar** cuál categoría representa utilidad administrativa antes de aprobar cifras de staging. No cambiarla de nuevo por criterio técnico sin autorización; si se acuerda otra regla, crear cambio separado con su comparación financiera.

## 6. SQL de diagnóstico: instrucciones manuales y seguridad

En la consola de **Supabase del proyecto correcto**, SQL Editor → nueva consulta, abrir/copiar el contenido completo de cada archivo y ejecutar **uno a la vez**:

1. [`db/audit-readonly-security-2026-10-26.sql`](../db/audit-readonly-security-2026-10-26.sql): catálogo de RLS/ACL, políticas, propietarios y `EXECUTE` de funciones, esquemas, publicación Realtime, extensiones y columnas requeridas. Contiene `BEGIN READ ONLY` y `ROLLBACK`, únicamente `SELECT`/funciones de catálogo. **Seguro respecto a datos y esquema**; puede devolver definiciones de políticas/configuración que deben tratarse como información interna. No ejecuta RPC de negocio ni cambia permisos. Validar que la consulta terminó sin errores y conservar resultados privados.
2. [`db/audit-readonly-performance-2026-10-27.sql`](../db/audit-readonly-performance-2026-10-27.sql): índices, tamaños estimados y contadores acumulados. También `BEGIN READ ONLY` y `ROLLBACK`; no ejecuta `EXPLAIN ANALYZE`, escribe ni hace carga. **Seguro respecto a datos y esquema**. Los contadores no corresponden necesariamente al incidente y las consultas al catálogo pueden consumir una cantidad pequeña de recursos normales.

No ejecutar desde SQL Editor como parte de esta validación: [`db/migration-admin-rpc-grants-2026-10-27.sql`](../db/migration-admin-rpc-grants-2026-10-27.sql), [`db/migration-security-2026-10-26.sql`](../db/migration-security-2026-10-26.sql), [`db/migration-public-search-2026-10-26.sql`](../db/migration-public-search-2026-10-26.sql), ni scripts de `seed`, `cleanup`, `fix` o migraciones históricas. **Son escrituras de esquema/permisos** y requieren revisión y autorización específica.

| Migración propuesta | Efecto | Riesgo y condición previa |
| --- | --- | --- |
| RPC administrativas | Revoca `EXECUTE` a `PUBLIC`/`anon`/`authenticated` y lo concede a `service_role` para 3 firmas exactas | Puede romper login o administración si el consumidor real no es `service_role`; verificar firmas, propietarios y llamadas en staging. |
| Seguridad general | Activa RLS/revoca ACL de muchas tablas, cambia `search_path` de 3 RPC | Riesgo alto de cortar Realtime y otros consumidores; el propio script se bloquea si `work_orders` está en `supabase_realtime`. **No está listo para ejecución directa**. |
| Búsqueda pública opcional | Crea/reemplaza RPC limitada y restringe `EXECUTE` | Verificar compatibilidad del esquema, resultados y plan; activar `USE_SEARCH_RPC=1` solo tras aplicar/probar en staging. No es requisito para desplegar las mejoras del dashboard. |

Si alguno de los dos diagnósticos falla, no modificar SQL a ciegas: guardar el error **sin datos sensibles** y revisar compatibilidad de roles/catálogo antes de reintentar.

## 7. Clasificación al cierre

| Estado solicitado | Elementos |
| --- | --- |
| **Listas para producción** | Los dos scripts de **diagnóstico manual de solo lectura** y la documentación de validación. Ninguna migración ni el despliegue completo están autorizados o validados en staging. |
| **Pendientes de staging** | Código local de seguridad/rendimiento, navegación real, comparación del artefacto anterior/nuevo, Realtime con dos pestañas, permisos, recibos/firmas, 402/429, build en el entorno de hosting y verificación de variables. |
| **Pendientes de validación con datos reales** | Totales financieros contra copia anonimizada, egress por proyecto/servicio y ciclo, tamaño de respuestas, ACL/RLS/RPC/publicación reales, límite de filas, frecuencia de rutas del hosting e impacto de las navegaciones. |
| **Pendientes de decisión del negocio** | Regla de utilidad `Honorarios` frente a `Cuenta de oficina`; autorización/estado contable/idempotencia del abono público. |

## 8. Acciones exactas para el usuario en Supabase y hosting

### Supabase, ahora y sin escrituras

1. En **Organization → Usage**, seleccionar solo Arquitectos Salazar y anotar ciclo, PostgREST Egress, Realtime y Storage; no usar `All projects` para atribuir consumo.
2. En **SQL Editor** del mismo proyecto, ejecutar manualmente **solo** los dos scripts de lectura de la sección 6 y guardar los resultados en un lugar privado. Compartir un resumen sanitizado de ACL/RLS/RPC, publicación Realtime y columnas si se requiere revisión.
3. En **Database → Replication/Publications** o salida del script, confirmar si `public.work_orders` pertenece a `supabase_realtime` y qué rol puede recibir eventos. No cambiarlo todavía.
4. Preparar un respaldo verificable de datos y esquema, funciones, grants/RLS, Storage y configuración de Realtime antes de cualquier futuro SQL. No restaurar ni sobrescribir datos en producción durante esta fase.
5. En staging separado, aplicar migraciones **solo tras revisión y autorización para ese entorno**; probar cada una por separado. No ejecutar la migración general de ACL si bloquea Realtime.

### Hosting, ahora y en staging

1. Identificar proveedor, proyecto, URL y artefacto/commit actualmente desplegado; conservarlo para reversión. El repositorio no identifica el proveedor ni una URL de staging, así que no se puede dar un botón concreto del panel.
2. Crear/usar una aplicación **staging aislada** apuntando a Supabase staging, con variables propias: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`. Verificar presencia y alcance de servidor; no copiar valores al informe. `USE_SEARCH_RPC` queda desactivada salvo RPC probada. Configurar `DATA_TELEMETRY=1` temporalmente en staging.
3. Configurar `TRUSTED_CLIENT_IP_HEADER` solo si el proxy del hosting sobrescribe esa cabecera y no permite que el cliente la suplante. Añadir límites distribuidos/WAF en rutas públicas si el proveedor los ofrece; el límite de aplicación es por proceso.
4. Desplegar **en staging**, ejecutar la matriz de las secciones 3–4 y conservar logs de aplicación y acceso de hosting durante la ventana. Correlacionar `traceId`, conteos por ruta y `queryHash`, sin registrar secretos.
5. Crear una comparación por día y hora de solicitudes/bytes por tabla y pantalla y Egress real en Supabase staging. No basarse solo en bytes JSON de la app: no son el Egress facturado.

## 9. Checklist de promoción, observación y reversión

**Antes de pedir autorización para producción:** respaldo probado, artefacto anterior identificado, cambios revisados sin incluir `supabase_logs.csv` ni `.env`, staging aprobado en todos los flujos, totales financieros idénticos según regla confirmada, permisos/RPC/Realtime probados, no duplicados internos inexplicados, variables verificadas por presencia y límites del hosting configurados. Si cualquier condición falla, corregir y repetir staging.

**Con autorización posterior:** desplegar el mismo artefacto probado en una ventana controlada; aplicar únicamente SQL separado y aprobado, nunca la migración general por inercia. Hacer pruebas de humo de login, dashboard, obras, pedidos, finanzas, documentos, firmas y notificaciones. Activar telemetría temporalmente y observar errores 401/402/403/429/5xx, `wireRequests`, `duplicateQueries`, `responseBytes` y Egress **del proyecto** al menos durante varios días representativos. Definir alertas con la línea base real; el código ya marca 100 solicitudes/5 MB/10 duplicados/30 s por render, pero esos umbrales son diagnósticos, no garantía de cuota.

**Reversión:** si cambia un saldo, falla autenticación/autorización, deja de funcionar Realtime o aparece un bucle, volver al artefacto anterior. Si se aplicó SQL, restaurar permisos/publicación **solo según el inventario previo** y una reversión aprobada; no conceder `EXECUTE` a `PUBLIC` de forma genérica. No restaurar un respaldo de datos sobre operaciones legítimas posteriores sin un plan de reconciliación. Conservar logs y métricas del incidente para investigar antes de reintentar.

**Criterio para el plan gratuito:** medir un ciclo o período representativo posterior al despliegue, seleccionar solo este proyecto, proyectar consumo de PostgREST + Realtime + Storage con margen para días pico y comparar contra la cuota disponible. Las pruebas locales no permiten garantizarlo.
