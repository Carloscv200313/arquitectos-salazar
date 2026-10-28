# Correcciones locales — Arquitectos Salazar

Fecha: 27 de octubre de 2026. Estado: código y SQL preparados; **sin despliegue ni cambios en Supabase**.

## 1. Resumen de correcciones implementadas

Se cerraron accesos administrativos que dependían solo de la interfaz, se verifica el estado del usuario en la base de datos en cada petición protegida, se eliminó el secreto de sesión predeterminado y se protegieron las páginas y acciones por módulo. Los documentos y firmas utilizan capacidades temporales limitadas a un documento, y una firma ya guardada no puede sustituirse por la misma acción. Leer un comprobante salarial dejó de crear filas o códigos.

Las consultas de pedidos y deudas comparten datos de obras y movimientos; las lecturas generales omiten firmas base64 y recorren todas las páginas para conservar los resultados financieros. Las búsquedas públicas filtran y limitan en PostgreSQL. La auditoría tiene paginación desde la base de datos. Notificaciones usa Realtime con respaldo controlado, suspende consultas en pestañas ocultas y detiene reintentos ante 402.

El informe de referencia es [la auditoría](auditoria-seguridad-rendimiento-egress-2026-10-26.md); [el análisis de la muestra del 21 de octubre](analisis-traza-21-octubre-2026.md) vincula las rutas de Next.js con los patrones observados. La cifra histórica de 19,85 GB **no se atribuye** a ninguna causa concreta: la captura original mostraba *All projects* y la muestra de 1.000 registros no cubre todo el periodo.

## 2. Vulnerabilidades corregidas en código

| Riesgo anterior | Cambio local | Evidencia |
| --- | --- | --- |
| Server Actions de usuarios invocables sin permiso administrativo efectivo | `requireAdministrator()` comprueba sesión activa, rol Administrador y `users.edit`, también en el servicio | `lib/auth/authorize.ts`, `features/users/actions.ts`, `services/users.service.ts` |
| Cookie de usuario desactivado | La identidad se consulta con `status=1` antes de autorizar; errores de la consulta no se convierten en acceso válido | `features/auth/get-user.ts` |
| Permisos aplicados solo al menú | Páginas, metadatos, acciones y servicios sensibles exigen `*.view`/`*.edit` en el servidor | `app/(dashboard)`, `features/settings/actions.ts`, `services/config.service.ts` |
| Secreto de sesión de desarrollo en producción | Configuración obligatoria y rechazo del valor inseguro conocido; validación estricta del formato y caducidad de cookie | `lib/auth/session.ts`, `lib/supabase/config-validation.ts`, `next.config.ts` |
| Recibos y firmas accesibles por UUID, con posibilidad de sobrescribir firma | Token HMAC con documento y vencimiento; comprobación de permiso para acceso sin token; escritura condicionada a firma nula y registro activo | `lib/security/documents.ts`, `lib/security/document-token.ts`, `app/recibo/signature-actions.ts`, `lib/data/{projects,works,finance}.ts` |
| Solicitudes públicas repetidas | Límite por operación y proceso, límite por IP solo si el hosting proporciona una cabecera confiable; validación de entrada | `lib/security/rate-limit.ts`, `app/{pedido,abono}/actions.ts`, `app/api/order-notifications/route.ts` |

Los controles de documentos permiten compartir una URL temporal legítima. Los enlaces antiguos anónimos basados únicamente en UUID deberán volver a emitirse desde una sesión autorizada; no se alteraron firmas almacenadas.

## 3. Vulnerabilidades pendientes de validación en producción

- **ALTO:** las ACL y RLS reales, propietarios, firmas de funciones y grants por defecto no se consultaron en esta etapa. Hasta que se revise y aplique la migración, las funciones administrativas y tablas podrían seguir expuestas según el estado real de Supabase.
- **ALTO:** el formulario público de abonos registra un ingreso contable definitivo sin identidad verificada. El límite local reduce abuso, pero no demuestra que quien registra el abono haya pagado. Cambiar esa regla requiere decidir entre enlace autorizado, revisión/aprobación del ingreso o mantener el flujo público. No se cambió unilateralmente la regla financiera.
- **MEDIO:** el límite de solicitudes por proceso no es compartido entre instancias ni sustituye un WAF. Configurar `TRUSTED_CLIENT_IP_HEADER` solo con una cabecera saneada por el hosting; definir allí límites distribuidos.
- **MEDIO:** el canal actual de Realtime usa el cliente publishable. Las ACL propuestas pueden impedir la suscripción de PostgreSQL Changes a usuarios con autenticación propia. El respaldo de 60 segundos conserva avisos, pero el tiempo real estricto debe probarse en un entorno de ensayo con las políticas definitivas antes de aplicar la migración.
- **MEDIO:** la emisión de códigos salariales existente no se volvió una secuencia transaccional; dos emisiones concurrentes requieren validar restricciones únicas y una estrategia atómica en PostgreSQL.

## 4. Consultas optimizadas

- `lib/data/orders.ts`: los pedidos de una obra reutilizan una lectura de la obra y agrupan pagos; no descargan obra y todos sus movimientos por cada pedido. Los cálculos globales comparten una lectura de `work_orders` dentro del render.
- `lib/data/finance.ts`: los detalles de proveedores comparten el conjunto de pedidos; reportes de deuda, saldos y utilidades se reutilizan dentro del mismo render.
- `lib/data/works.ts`, `lib/data/projects.ts`: proyecciones para listados excluyen firmas; las relaciones de proyectos se obtienen por lotes y no dependen del límite oculto de filas embebidas. Los movimientos se reutilizan en el detalle y el dashboard comparte los ya descargados para calcular saldos de obras.
- `lib/supabase/transport.ts`: lecturas completas atraviesan páginas, incluso con un límite del servidor menor al solicitado; errores de página intermedia y HTTP 402 fallan explícitamente. Las peticiones idénticas de lectura se comparten solo dentro de un render de React y se invalidan tras una escritura.
- `lib/data/public-search.ts`: búsquedas por nombre, dirección y cliente limitadas a 20 candidatos por filtro, con cálculo de saldo solo para los proyectos seleccionados. La función RPC opcional preparada aún no se activa.
- `app/pedido/actions.ts` y `app/abono/actions.ts`: la comprobación de una obra pública lee únicamente su identificador activo; antes `getWork` descargaba también su historial de movimientos.
- `lib/data/audit.ts` y `components/audit/audit-view.tsx`: páginas de 50 filas con filtros en PostgreSQL. Los cálculos financieros completos no se limitan a 50.

## 5. Solicitudes duplicadas eliminadas y comparación local

Se usó el mismo conjunto **sintético** antes y después, incluyendo firmas artificiales grandes; la base de referencia incluye las modificaciones que ya tenía el usuario antes de este trabajo. Los valores siguientes son invocaciones lógicas del cliente simulado y bytes JSON calculados en memoria; **no son medidas de red, egress real ni tiempos de producción**.

| Escenario sintético | Consultas antes → después | Bytes JSON antes → después | Resultado financiero |
| --- | ---: | ---: | --- |
| Pedidos de una obra | 49 → 6 | 2.169.444 → 21.120 | idéntico |
| Deudas de proveedores/clientes | 63 → 14 | 2.589.749 → 22.929 | idéntico |
| Pantalla de deudas | 126 → 14 | 5.179.498 → 22.929 | idéntico |
| Balance general | 80 → 31 | 2.783.780 → 37.115 | idéntico |
| Detalle de obra | 8 → 6 | 717.410 → 14.819 | idéntico |
| Grafo de consultas del dashboard | 101 → 44 | 3.348.167 → 43.187 | importes, saldos y movimientos equivalentes |
| Lista de proyectos | 1 → 3 | 9.332 → 9.741 | idéntico; consultas separadas evitan truncar relaciones |
| Utilidades | 2 → 3 | 3.943 → 3.945 | idéntico; página vacía de comprobación |

La página adicional evita truncar informes cuando el servidor impone un límite de filas inferior al solicitado. Los tiempos de ejecución del simulador no representan latencia de Supabase y no se usan para afirmar una mejora porcentual.

## 6. Archivos modificados

Grupos principales: `lib/auth/*`, `features/auth/*`, `features/users/*`, `services/users.service.ts`, `features/settings/actions.ts`, `services/config.service.ts`, páginas y acciones de `app/(dashboard)`, rutas de recibos y firmas en `app/recibo`, `app/firma` y `app/comprobante`; `lib/data/{orders,works,projects,finance,audit,public-search,columns}.ts`; `lib/supabase/{admin,proxy,transport,config-validation}.ts`; `components/{audit,layout,public,receipt,settings}`; `next.config.ts`, `eslint.config.mjs`, `package.json`, `db/*` y `tests/*`.

Se preservaron las modificaciones previas del usuario. La copia de resguardo y el diff inicial están en `/tmp/arquitectos-salazar-pre-correcciones-20261026/` y `/tmp/as-baseline-source/`. Son archivos temporales locales, no un respaldo permanente para producción.

## 7. Migraciones SQL preparadas

1. [Auditoría de catálogo de solo lectura](../db/audit-readonly-security-2026-10-26.sql): revisar funciones, propietarios, ACL, políticas y tamaños sin leer datos privados.
2. [Migración de seguridad propuesta](../db/migration-security-2026-10-26.sql): revoca ejecución anónima/autenticada de RPC administrativas conocidas; fija `search_path`; restringe tablas conocidas a `service_role` servidor y habilita RLS. **Revisar consumidores, Realtime, propietarios y ACL actuales antes de ejecutar.**
3. [RPC de búsqueda opcional](../db/migration-public-search-2026-10-26.sql): limita candidatos en PostgreSQL; solo service_role puede ejecutarla. `USE_SEARCH_RPC=1` debe activarse solo tras comparar resultados en ensayo.
4. `db/auth-users.sql` y `db/seed-user-operativo.sql`: eliminaron ejemplos de contraseñas predeterminadas y restringen los grants del esquema de referencia. No se aplicaron remotamente.

## 8. Pruebas ejecutadas y resultados

- `pnpm test`: **33/33 aprobadas**. Incluyen autorización de acciones administrativas y cobertura estática de acciones privadas, cookie de usuario desactivado, tokens de documento, denegación de notificaciones, recibo salarial sin escritura, límite de solicitudes, comprobación pública sin descargar movimientos, paginación >1000 filas, error 402 y fallo de página intermedia.
- Regresión financiera: comparación profunda con referencia previa para deudas, balances, utilidades, estados, salarios, pedidos, obras y proyectos; además, escenario de 24 obras y 288 pedidos con huella exacta de deudas y equivalencia de importes/fechas del dashboard. También se probaron 250 pedidos asociados a una obra con 1205 movimientos.
- `pnpm typecheck`: aprobado.
- `pnpm lint`: aprobado con **0 errores y 3 avisos** de `<img>` en el componente de comprobantes (sin cambio de diseño).
- `git diff --check`: aprobado.
- Compilación de producción local aislada: `next build --webpack` **aprobada** en una copia sin `.env`, con URL y claves sintéticas y una respuesta local de prueba para `next/font/google`. La compilación normal con acceso a Google Fonts falló por la conexión de este entorno; no se validó la descarga real de fuentes.

No se ejecutaron pruebas de carga ni pruebas contra producción. El simulador financiero no sustituye una conciliación con datos reales anonimizados en un entorno de ensayo.

## 9. Errores o limitaciones encontrados

El aislamiento necesario para no contactar producción impidió comprobar permisos reales, Realtime, índices, planes SQL, transferencia efectiva y flujos de navegador con la cuenta correcta. La optimización del dashboard conserva algunas lecturas históricas completas para no alterar resultados. La paginación visible desde la base se incorporó a auditoría; otros listados financieros siguen requiriendo reportes completos y deben revisarse individualmente con métricas reales antes de separar páginas y agregaciones.

## 10. Riesgos pendientes

El despliegue solo del código deja ACL antiguas potencialmente abiertas; aplicar SQL sin verificar consumidores puede interrumpir Realtime u otros clientes. Los enlaces antiguos de firma necesitan reemisión. Un usuario que posea un enlace temporal puede leer y firmar ese documento durante su vigencia. Los límites locales no controlan tráfico distribuido. El formulario público de abonos sigue siendo la principal decisión pendiente de autorización de negocio.

## 11. Configuraciones que revisar en Supabase

Comprobar consumo filtrando **únicamente Arquitectos Salazar** y mismo periodo de facturación; separar PostgREST, Storage y Realtime. Revisar en la base real salida del script de catálogo, funciones `SECURITY DEFINER`, propietarios y grants, tablas expuestas, índice y selectividad de búsquedas, límites de filas, políticas Realtime y permisos de Storage. Verificar que la clave `service_role` existe solo en el servidor y que la publishable no obtiene datos administrativos. Recuperar logs disponibles del 21–22 de octubre desde Supabase, hosting o WAF si existen; sin ellos no se puede distinguir abuso externo de uso legítimo amplificado.

## 12. Instrucciones para un despliegue seguro posterior

1. Crear respaldo verificable de base, código desplegado y ACL/políticas actuales. Preparar ensayo con copia anonimizada y credenciales propias.
2. Ejecutar la auditoría SQL de solo lectura y ajustar la migración a propietarios, firmas y consumidores reales. Conciliar los resultados de funciones y permisos con el equipo antes de aplicar.
3. Probar en ensayo sesión activa/desactivada, permisos de cada módulo, RPC con anon/authenticated/service_role, flujos de pedido/abono/documentos/firma, Storage y Realtime; comparar balances y totales con la versión anterior.
4. Configurar un `AUTH_SECRET` robusto y las variables obligatorias en el hosting; no usar el valor de desarrollo. Comprobar límites en WAF y cabecera confiable antes de configurar `TRUSTED_CLIENT_IP_HEADER`.
5. Coordinar la migración SQL revisada y el despliegue del código en una ventana controlada; monitorizar errores 401/403/402/429/5xx y Egress por proyecto desde el primer minuto. **Nada de esto fue ejecutado por el agente.**

## 13. Procedimiento de reversión

Antes de desplegar, guardar el artefacto anterior y un volcado del esquema, ACL y políticas. Si falla el código, volver al artefacto anterior; la copia temporal del workspace no sustituye un mecanismo de despliegue. Si falla la migración, restaurar grants, funciones y políticas **desde el estado capturado de esa base**, mediante SQL revisado; no desactivar RLS de forma global ni revocar service_role a ciegas. Reconciliar documentos emitidos durante la ventana y evitar borrar registros. Validar resultados financieros y enlaces de firma tras la reversión.

## 14. Monitoreo de Egress

Activar `DATA_TELEMETRY=1` en ensayo y verificar que los eventos `database_request` contienen solo módulo, tabla, método, estado, número de páginas, bytes aproximados y duración. La ruta de notificaciones emite métricas de duración. Agregar por módulo/endpoint y comparar contra el Egress por proyecto en Supabase. Crear alertas posteriores con el hosting o servicios existentes cuando la tasa de bytes, páginas, 402 o 5xx supere una línea de base observada; definir umbrales después de obtener al menos varios días de uso normal. No registrar consultas completas, tokens, cookies, contraseñas ni cuerpos de respuesta.
