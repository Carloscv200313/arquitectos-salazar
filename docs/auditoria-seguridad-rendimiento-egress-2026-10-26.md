# Auditoría de seguridad, rendimiento y Egress — Arquitectos Salazar

**Fecha:** 26 de octubre de 2026.  
**Estado:** informe pendiente de revisión y aprobación.  
**Alcance:** auditoría estática local del repositorio, SQL, configuración disponible e historial Git.  
**Restricciones:** no se hicieron solicitudes a producción, consultas remotas, migraciones, pruebas de carga, instalaciones ni correcciones. Este documento se guarda por solicitud expresa posterior del usuario.

> Este informe identifica defectos y riesgos presentes en el código. No demuestra que existiera un ataque ni atribuye los 19.85 GB exclusivamente a este proyecto. Las ubicaciones corresponden al árbol de trabajo inspeccionado el 26/10/2026, que tenía cambios locales preexistentes.

## 1. Resumen ejecutivo

El código contiene mecanismos capaces de multiplicar considerablemente el Egress incluso con tres usuarios. Los hallazgos principales son:

1. **Recargas por cada pedido:** al calcular deudas se vuelve a consultar una obra y todos sus movimientos por cada pedido.
2. **Cálculos duplicados:** la pantalla de deudas ejecuta dos veces el recorrido de proveedores y deudores.
3. **Columnas innecesariamente grandes:** numerosos `SELECT *` incluyen firmas base64 que después se descartan.
4. **Búsquedas públicas costosas:** descargan conjuntos completos antes de filtrar y devolver veinte resultados.
5. **Dashboard con recorridos redundantes:** vuelve a solicitar movimientos ya descargados por otros reportes.
6. **Polling constante:** consulta notificaciones cada quince segundos incluso cuando Realtime está activo.
7. **Autorización insuficiente:** acciones administrativas y de negocio no comprueban sistemáticamente los permisos del ejecutor.
8. **Riesgos SQL:** funciones administrativas privilegiadas sin restricciones explícitas de ejecución y tablas sin habilitación de RLS identificada en los scripts.

La hipótesis técnica prioritaria es **amplificación de lecturas por el código, agravada por respuestas innecesariamente grandes**. El tráfico automatizado podría aprovechar estas mismas rutas, pero no se ha demostrado.

### Atribución del consumo pendiente

Los datos comunicados por el usuario son: cuota de 5 GB, consumo mostrado de 19.85 GB, exceso de 14.85 GB y utilización aproximada del 397 %. Se reportaron 6.052 GB de PostgREST Egress el 21 de octubre y aproximadamente 4 GB el día 22, además de restricciones que pueden responder con HTTP 402.

La captura inicial seleccionaba **All projects**. Antes de atribuir ese consumo a Arquitectos Salazar hay que obtener el desglose por proyecto, servicio y período exacto. Los valores anteriores no fueron verificados externamente durante esta auditoría.

## 2. Arquitectura identificada

### Tecnologías declaradas

| Área | Tecnología |
|---|---|
| Framework | Next.js 16.2.7, App Router |
| Interfaz | React 19.2.4, TypeScript, Tailwind CSS |
| Datos | Supabase, PostgreSQL y PostgREST |
| Clientes | `@supabase/supabase-js`, `@supabase/ssr` |
| Validación | Zod |
| Documentos | ExcelJS, jsPDF y capturas |
| Notificaciones | Realtime y polling HTTP |

Las versiones de `package.json` no acreditan las versiones efectivamente desplegadas.

```text
Navegador
 ├─ Componentes React y navegación Next.js
 ├─ Server Actions
 ├─ GET /api/order-notifications cada 15 segundos
 └─ Cliente Supabase público → Realtime

Servidor Next.js
 ├─ Proxy: verifica cookie propia
 ├─ Server Components: páginas y reportes
 ├─ Server Actions: operaciones internas y públicas
 └─ lib/data/* y services/*
      └─ Cliente service_role
           ├─ PostgREST → PostgreSQL
           ├─ RPC
           └─ Storage
```

### Sesiones y permisos

La autenticación efectiva es propia:

- `features/auth/actions.ts` llama a la RPC `verify_login`.
- Las cuentas están en `public.users`.
- La cookie `as_session` está firmada con HMAC y dura ocho horas.
- La cookie se configura como `httpOnly`, `sameSite: lax` y `secure` en producción.
- El cliente administrativo usa `service_role`, que omite RLS.
- Los permisos por módulo existen, pero su aplicación en servidor es incompleta.

Existe un cliente SSR convencional en `lib/supabase/server.ts`, sin consumidores identificados en el código de aplicación examinado. El cliente del navegador se usa en las notificaciones.

### Caché

No se encontró una estrategia explícita de caché compartida para reportes mediante `unstable_cache`, `use cache` o `React.cache`.

Sí existen estado local, `localStorage` para notificaciones, `revalidatePath` y `router.refresh`. No equivalen a una caché de consultas. Tampoco se debe asumir que Next.js deduplica automáticamente todas las llamadas hechas mediante estos clientes Supabase.

## 3. Inventario de consultas a Supabase

Inventario agrupado por función y finalidad; incluye lecturas y operaciones que generan lecturas previas o posteriores.

| Punto de acceso | Consultas y recursos | Ejecución y alcance |
|---|---|---|
| `features/auth/actions.ts:36` | RPC `verify_login`; actualización de último acceso | Inicio de sesión |
| `features/auth/get-user.ts:19` | `users` y `roles`, por ID y estado | Resolución de usuario |
| `services/users.service.ts:22` | Usuarios, roles y RPC administrativas | Administración de cuentas |
| `services/config.service.ts:143` | Empleados, cuentas, tareas, proveedores, categorías y ayuda | Configuración y formularios |
| `services/config.service.ts:78` | Presupuestos por categoría | Renombrado/fusión de categorías |
| `lib/data/projects.ts:142` | Clientes y cuentas de pago | Catálogos sin paginación explícita |
| `lib/data/projects.ts:138` | Proyectos con clientes, pagos y adicionales completos | Listados, detalles, reportes y búsquedas |
| `lib/data/projects.ts:205` | Pagos con cuenta de pago | Historial por proyecto |
| `lib/data/projects.ts:226` | Transferencias internas | Listado de transferencias activas |
| `lib/data/projects.ts:254` | Pagos y transferencias para saldos, utilidades y áreas | Agregación en JavaScript |
| `lib/data/projects.ts:341` en adelante | Lecturas previas, mutaciones, recibos y firmas | Operaciones de proyectos |
| `lib/data/works.ts:186` | Movimientos, normalmente `*`, en bloques de 1.000 | Descarga acumulativa completa |
| `lib/data/works.ts:230` | Movimientos de varias obras, `SELECT *` | Cada `listWorks` |
| `lib/data/works.ts:259` | Metadatos de archivos | Listados y detalles |
| `lib/data/works.ts:315` | Obras, clientes, movimientos y archivos | Listados, reportes y búsquedas |
| `lib/data/works.ts:354` | Una obra, sus movimientos y archivos | Detalles y cada pedido enriquecido |
| `lib/data/works.ts:381` | Conceptos y proveedores del historial | Autocompletado |
| `lib/data/works.ts:398` | Movimientos, categorías y presupuestos | Resumen por categoría |
| `lib/data/works.ts:481` | Movimientos para honorarios | Utilidades de administración |
| `lib/data/works.ts:497` | Movimientos, cuentas y transferencias | Saldos e informes |
| `lib/data/works.ts:901` | Movimiento y firma por ID | Recibo público |
| `lib/data/works.ts:956` | Storage: bucket, carga, eliminación y URL firmada | Archivos; límite declarado de 15 MB |
| `lib/data/orders.ts:86` | Pagos por pedido | Una consulta por pedido enriquecido |
| `lib/data/orders.ts:101` | `getWork` y pagos | Repetido por pedido |
| `lib/data/orders.ts:110` | Obras, pedidos y pagos | Listado de obras con pedidos |
| `lib/data/orders.ts:185` | Pedidos de una obra y enriquecimiento individual | Pedidos y deudas |
| `lib/data/finance.ts:60` | Movimientos paginados internamente | Descarga completa para reportes |
| `lib/data/finance.ts:130` | Diez fuentes de movimientos y saldos | Balance unificado |
| `lib/data/finance.ts:300` | Liquidaciones, deudas y pagos manuales | Reportes y detalles |
| `lib/data/finance.ts:516` | Obras → pedidos → obra/movimientos/pagos | Deudas de proveedores |
| `lib/data/finance.ts:657` | Obras, proyectos, deudas, saldos y ajustes | Balance general |
| `lib/data/finance.ts:738` | Balance e historiales por cuenta | Detalle de cuenta |
| `lib/data/finance.ts:1045` | Utilidades y movimientos para agrupación mensual | Estados financieros |
| `lib/data/finance.ts:1239` | Capturas, conceptos y etiquetas | Movimientos financieros |
| `lib/data/finance.ts:1329` | Capturas, pagos de proyectos, obras, salarios y catálogos | Consolidación |
| `lib/data/finance.ts:2287` | Referencias, semanas, jornadas y pagos | Nómina; jornadas/pagos por semanas seleccionadas |
| `lib/data/finance.ts:2582` en adelante | Validaciones, cambios, sincronización y auditoría | Operaciones de salarios |
| `lib/data/finance.ts:3115` | Lectura y posible creación de comprobante | También al visualizar |
| `lib/data/audit.ts:95` | Auditoría con `snapshot` | Hasta 300 registros por defecto |
| `app/api/order-notifications/route.ts:31` | Hasta 5/10 pedidos y obras relacionadas | Endpoint público, polling y Realtime |
| `app/pedido/actions.ts:18` | `listWorks` y filtrado posterior | Búsqueda pública |
| `app/abono/actions.ts:27` | `listProjects`, `listWorks` y filtrado posterior | Búsqueda pública |

## 4. Problemas de rendimiento detectados

### P1. Recarga completa por cada pedido

- **Criticidad:** ALTO.
- **Confianza:** alta.
- **Evidencia:** `orders.ts:101` llama a `getWork` en `enrich`; `orders.ts:185` enriquece cada pedido; `works.ts:354` descarga movimientos y archivos; `finance.ts:527` recorre pedidos por obra.
- **Activación:** pedidos, deudas de proveedores y sus consumidores en balance/dashboard.
- **Frecuencia:** lectura de obra, páginas de movimientos, archivos y pagos por cada pedido.
- **Impacto:** patrón N+1 que puede repetir decenas de veces el mismo historial por navegación.
- **Solución propuesta:** lecturas por lotes, reutilización y consultas de deuda que no necesiten descargar toda la obra.

### P2. Cálculo duplicado en deudas

- **Criticidad:** ALTO.
- **Confianza:** alta.
- **Evidencia:** `app/(dashboard)/finance/[module]/page.tsx:79` solicita `getDebtReport`, `getProviderDebtDetails` y `getManualDebtorDetails`; `finance.ts:476` ya llama a las dos últimas desde `getDebtReport`.
- **Activación/frecuencia:** dos cálculos de cada detalle por carga de la pantalla.
- **Impacto:** duplica también el recorrido costoso de P1.
- **Solución propuesta:** obtener detalles una vez y derivar el resumen del mismo resultado.

### P3. Firmas base64 descargadas sin necesidad

- **Criticidad:** ALTO.
- **Confianza:** alta sobre el mecanismo; tamaños reales desconocidos.
- **Evidencia:** `db/migration-signature.sql` añade `signature text`; `projects.ts:138,210`, `works.ts:203,238` y la selección predeterminada de `finance.ts:62` incluyen todas las columnas. Los mapeadores descartan la firma.
- **Activación:** listados, detalles y reportes que reutilizan estas funciones.
- **Impacto:** transferencia Supabase → servidor de imágenes que la pantalla no necesita. La validación admite hasta 600.000 caracteres por firma; no se midió su tamaño real.
- **Solución propuesta:** proyección explícita de columnas; consultar firmas solo al abrir el documento. Evaluar almacenamiento separado privado.

### P4. Dashboard con recorridos redundantes

- **Criticidad:** ALTO.
- **Confianza:** alta.
- **Evidencia:** `app/(dashboard)/dashboard/page.tsx:18` combina proyectos, obras, pedidos, utilidades, salarios y balance; después consulta pagos por proyecto y movimientos por obra. El balance incorpora deudas y nuevos recorridos.
- **Activación/frecuencia:** cada renderizado servidor que ejecute estas funciones.
- **Impacto:** decenas o cientos de solicitudes según volumen, sin un presupuesto explícito de consultas.
- **Solución propuesta:** agregados específicos de dashboard, resultados compartidos por solicitud y consulta acotada de movimientos recientes.

### P5. Búsquedas públicas con descarga completa

- **Criticidad:** ALTO.
- **Confianza:** alta.
- **Evidencia:** `app/pedido/actions.ts:18` y `app/abono/actions.ts:27` filtran después de `listWorks`/`listProjects`; `.slice(0,20)` limita la respuesta al navegador, no la descarga desde Supabase. Formularios con debounce de 300 ms.
- **Activación/frecuencia:** varias veces durante una búsqueda escrita con pausas; potencialmente automatizable.
- **Impacto:** respuestas pequeñas al navegador pueden ocasionar grandes transferencias desde la base.
- **Solución propuesta:** búsqueda SQL filtrada y limitada, columnas mínimas y protección contra abuso.

### P6. Descargas repetidas en detalles

- **Criticidad:** ALTO.
- **Confianza:** alta; ejecución adicional de metadata pendiente de medición.
- **Evidencia:** `app/(dashboard)/obras/[id]/page.tsx:46` llama a `getWork`, `listWorkMovements`, `getWorkCategorySummary` y `getWorkAdministrationUtilities`; todas leen movimientos. `generateMetadata` también llama a `getWork`. Proyectos combina `getProject`, que incluye pagos, con `listMovements`.
- **Activación:** apertura y actualización de detalles.
- **Impacto:** varias descargas del mismo historial. La duplicación adicional por metadata depende de la deduplicación efectiva del entorno.
- **Solución propuesta:** separar cabecera, historial y agregados; reutilizar datos; metadata mínima.

### P7. Paginación visual y descarga acumulativa

- **Criticidad:** ALTO.
- **Confianza:** alta.
- **Evidencia:** `components/ui/table.tsx:130` pagina filas ya recibidas; bucles de `works.ts` y `finance.ts` descargan bloques de 1.000 hasta completar el conjunto.
- **Activación:** listados/reportes y tablas que consumen estos resultados.
- **Impacto:** paginar visualmente no reduce el Egress. Las consultas sin paginación explícita también pueden truncarse al máximo configurado de PostgREST, produciendo saldos incompletos.
- **Solución propuesta:** paginación real para detalles y agregados completos para totales; no introducir límites que alteren cifras.

### P8. Polling simultáneo con Realtime

- **Criticidad:** MEDIO.
- **Confianza:** alta.
- **Evidencia:** `components/layout/order-notifications.tsx:171` consulta cada quince segundos; Realtime también llama a `pollNewOrders`.
- **Activación/frecuencia:** mientras está montado el encabezado, por pestaña; eventos pueden añadir consultas.
- **Impacto:** tráfico de fondo, sin suspensión explícita por pestaña oculta, retroceso tras errores ni exclusión de solicitudes simultáneas.
- **Solución propuesta:** Realtime principal, polling de respaldo, control de concurrencia y tratamiento específico de 402.
- **Control positivo:** hay `clearInterval`, `removeChannel`, dependencia estable y protección de desmontaje. No se encontró suscripción nueva por cada render.

### P9. Agregaciones históricas y caché insuficiente

- **Criticidad:** MEDIO.
- **Confianza:** alta.
- **Evidencia:** balances, utilidades y conceptos descargan registros para sumar, agrupar o deduplicar en JavaScript; no se encontró caché explícita de reportes. Varias interacciones combinan `revalidatePath` con `router.refresh`.
- **Activación:** navegación, filtros y actualizaciones.
- **Impacto:** repetición de trabajo e historiales; no se afirma duplicación exacta en todas las interacciones sin medir.
- **Solución propuesta:** agregaciones SQL, rangos temporales, caché e invalidación definidas; índices después de revisar planes.

Un índice puede reducir el costo de ejecución, pero no reduce los bytes de una respuesta que devuelve las mismas filas y columnas.

### Revisión de hooks y automatismos

- No se identificó un bucle infinito de consultas durante renderizado cliente.
- Las búsquedas tienen debounce y limpieza de temporizadores.
- Los filtros omiten algunas dependencias deliberadamente: **BAJO**, confianza media, riesgo de estado desactualizado; no prueba de tráfico masivo. Propuesta: revisar sincronización y dependencias con pruebas locales.
- No se encontró React Query/SWR ni refetch propio por foco/reconexión.
- No se encontró cron de aplicación.
- Los reintentos explícitos localizados son acotados; el polling sí continúa periódicamente tras fallos.
- El service worker existente se desregistra; no se encontró código actual que lo registre repetidamente.

## 5. Vulnerabilidades y configuraciones inseguras

### S1. Administración de usuarios sin autorización del ejecutor

- **Criticidad:** CRÍTICO.
- **Confianza:** alta en código.
- **Evidencia:** `features/users/actions.ts:16` comprueba configuración, no identidad/permiso administrativo. `services/users.service.ts` tampoco impone esa autorización.
- **Impacto:** un usuario con sesión válida podría invocar creación de cuentas, cambios de roles/permisos o contraseñas si obtiene acceso a la acción. Ocultar menús no autoriza operaciones.
- **Límite:** no se probó explotación ni se afirma que todas las acciones sean anónimamente invocables en el despliegue.
- **Solución propuesta:** sesión activa y permiso administrativo obligatorio en acciones y frontera de datos.

### S2. RPC administrativas privilegiadas sin restricciones explícitas

- **Criticidad:** CRÍTICO, condicionado a permisos efectivos.
- **Confianza:** alta en SQL; exposición remota pendiente.
- **Evidencia:** `db/auth-users.sql:64,85` define `admin_create_user` y `admin_set_password` como `SECURITY DEFINER`, sin comprobación de privilegios del llamador ni `REVOKE EXECUTE` identificado.
- **Impacto potencial:** creación de cuentas privilegiadas o cambio de contraseñas mediante RPC si las ACL reales permiten llamadas. PostgreSQL normalmente concede ejecución de funciones nuevas a `PUBLIC`, salvo configuración distinta. RLS en `users` no cierra por sí sola esta vía.
- **Solución propuesta:** verificar ACL, propietarios, privilegios predeterminados y esquemas expuestos; preparar SQL restrictivo para revisión y ejecución del usuario.

### S3. Permisos principalmente en navegación

- **Criticidad:** ALTO.
- **Confianza:** alta.
- **Evidencia:** navegación filtrada por permisos, sin controles equivalentes sistemáticos en páginas/acciones de proyectos, obras, pedidos y finanzas. El proxy valida cookie, no permisos por operación.
- **Impacto:** acceso a módulos y modificaciones fuera del rol previsto.
- **Solución propuesta:** autorización central obligatoria en lecturas y mutaciones, además del filtrado visual.

### S4. Revocación insuficiente de usuarios desactivados

- **Criticidad:** ALTO.
- **Confianza:** alta en código.
- **Evidencia:** proxy valida firma/vencimiento; `getCurrentAppUser` comprueba estado, pero el layout no rechaza si devuelve `null`. `getCurrentUserId` acepta el ID firmado sin comprobar estado actual.
- **Impacto:** desactivar una cuenta no garantiza bloquear todas sus operaciones antes de vencer la cookie.
- **Solución propuesta:** comprobar usuario activo obligatoriamente y establecer revocación de sesiones.

### S5. Tablas sin habilitación de RLS identificada

- **Criticidad:** ALTO.
- **Confianza:** alta en scripts; despliegue desconocido.
- **Evidencia:** `providers`, `work_categories` y `salary_receipts` se crean en scripts pero no aparecen en el conjunto de habilitación de RLS de `db/supabase-schema.sql:696`; no se encontró otra activación para ellas.
- **Impacto potencial:** acceso directo según ACL efectivas de `anon`/`authenticated`; especial atención a comprobantes y firmas.
- **Solución propuesta:** verificar RLS, grants y exposición API; preparar políticas mínimas.

### S6. Políticas globales amplias

- **Criticidad:** ALTO.
- **Confianza:** alta en SQL.
- **Evidencia:** `db/supabase-schema.sql:708` permite a `authenticated` seleccionar, insertar y actualizar cualquier fila en el conjunto de tablas, sin reflejar permisos por módulo.
- **Impacto:** acceso amplio para identidades de Supabase Auth que puedan existir o crearse.
- **Matiz:** la cookie propia no convierte al navegador en `authenticated` de Supabase.
- **Solución propuesta:** revisar ambos modelos de identidad, registro de Auth y políticas efectivas.

### S7. Rutas públicas sin protección de abuso identificada

- **Criticidad:** ALTO.
- **Confianza:** alta en aplicación; controles externos desconocidos.
- **Evidencia:** abonos, pedidos, recibos, firmas y notificaciones están abiertos. Notificaciones devuelve datos de pedidos, obras y nombres de clientes. No se encontró rate limiting, CAPTCHA o tokens de alcance específico en esos flujos.
- **Impacto:** enumeración, consumo automatizado y contaminación de registros administrativos.
- **Solución propuesta:** mantener funcionalidades mediante enlaces acotados, límites, validación contextual y revisión del flujo de aprobación de abonos.

### S8. Firma basada únicamente en identificadores

- **Criticidad:** ALTO.
- **Confianza:** alta.
- **Evidencia:** `app/recibo/signature-actions.ts:25` valida datos e IDs, sin sesión/token temporal. Persistencia por ID sin impedir sobrescritura de firma existente.
- **Impacto:** quien obtenga un identificador válido podría modificar la firma. UUID no acredita autorización.
- **Solución propuesta:** tokens firmados con alcance y caducidad, control de reutilización, auditoría y validación real de imagen.

### S9. Secreto predeterminado y credenciales iniciales versionadas

- **Criticidad:** ALTO.
- **Confianza:** alta; uso en producción no demostrado.
- **Evidencia:** `lib/auth/session.ts:5` utiliza un secreto predeterminado si falta `AUTH_SECRET`; `db/auth-users.sql:97` contiene credenciales iniciales legibles. No se incluyen sus valores en este documento.
- **Impacto:** sesiones falsificables si se usa el valor predeterminado o acceso con credenciales iniciales no cambiadas.
- **Comprobación local:** ambos archivos de entorno tenían secreto definido y distinto del predeterminado; no acredita el despliegue.
- **Solución propuesta:** impedir arranque productivo sin configuración segura y eliminar credenciales predecibles del aprovisionamiento. No rotar sin aprobación específica.

### S10. Visualización de comprobante con escritura

- **Criticidad:** MEDIO.
- **Confianza:** alta.
- **Evidencia:** `finance.ts:3115` implementa `getOrCreateSalaryReceiptCode`; `getSalaryReceipt` lo llama y puede insertar. La ruta pública de firma de comprobantes utiliza esa lectura.
- **Impacto:** navegación o previsualización puede generar escrituras.
- **Solución propuesta:** separar emisión y visualización; lectura sin efectos secundarios.

### S11. Trazabilidad insuficiente

- **Criticidad:** MEDIO.
- **Confianza:** alta.
- **Evidencia:** varias acciones implementan `currentUserId()` devolviendo `null`; auditoría de mejor esfuerzo, sin registro de todas las lecturas o bytes.
- **Impacto:** difícil reconstrucción de accesos y consumo. Auditoría de cambios no prueba quién descargó datos.
- **Solución propuesta:** identidad validada, identificador de solicitud y telemetría sin cuerpos sensibles.

### Comprobación de claves y secretos

No se encontraron archivos `.env` versionados en el historial accesible, tokens literales con los patrones examinados de JWT/claves secretas Supabase/claves privadas ni valores de los secretos locales en los archivos públicos existentes de `.next/static`. El cliente administrativo está marcado `server-only`.

Esto no certifica ausencia de filtraciones: no se inspeccionaron despliegue, logs externos, copias fuera del repositorio ni todas las codificaciones posibles. La clave `anon` pública no es por sí sola una vulnerabilidad.

## 6. Análisis de posible acceso no autorizado

| Categoría | Resultado |
|---|---|
| Fallos de rendimiento | Confirmados en código |
| Configuraciones inseguras en SQL | Confirmadas en scripts |
| Vulnerabilidades potencialmente explotables | Identificadas |
| Exposición efectiva de RPC/tablas | No verificada |
| Uso indebido de credenciales | Sin evidencia |
| Ataque o extracción de datos | Sin evidencia verificable |
| Origen de los picos | Desconocido |

Vías potenciales: abuso de rutas Next.js públicas o insuficientemente autorizadas, y acceso directo a Supabase si lo permiten las ACL reales. Un WAF del hosting no corrige los permisos de acceso directo a Supabase.

Evidencias adicionales necesarias:

- Solicitudes por ruta, método, hora, estado y volumen.
- Invocaciones de funciones del hosting.
- Registros PostgREST/RPC conservados o exportados.
- Eventos de autenticación y administración.
- Eventos y reglas WAF.
- Despliegues, entornos locales y previsualizaciones conectados al mismo proyecto.

Sin logs históricos no puede reconstruirse con certeza quién realizó las consultas del 21/22 ni distinguir tráfico legítimo de automatizado. No se deben compartir cookies, autorizaciones o cuerpos privados.

## 7. Cambios del 18 al 24 de octubre

Referencias Git locales accesibles; fechas UTC−05:00.

| Fecha | Commit | Cambio | Relación posible |
|---|---|---|---|
| 20/10 11:49 | `bd8a59c` | Cuentas de pagos a proveedores y estados financieros | Dos lecturas adicionales en balance unificado, otras en detalle de cuenta y relaciones adicionales |
| 20/10 12:27 | `042c15c` | Transferencias internas y nombre de obra; video temporal | Incremento pequeño en datos; video sin vínculo demostrado con Supabase |
| 20/10 12:29 | `edfb23d` | Elimina video | Sin relación demostrada con PostgREST |
| 21/10 00:12 | `63785da` | Dos documentos de revisión | No modifica código ejecutable |

Conclusiones:

- El commit del 21 no introduce un bucle.
- Los cambios del 20 añaden lecturas, pero no explican cuantitativamente seis GB diarios.
- La paginación acumulativa aparece en agosto y las notificaciones en julio: los mecanismos principales son anteriores.
- Un video de unos 24.6 MB en Git no demuestra transferencia desde Supabase.
- No aparecen commits adicionales del 22 al 24 en las referencias disponibles.
- `docs/verificacion-ingresos-obras-2026-10-20.md:25` documenta una revisión previa de 8.004 movimientos activos de obras. Es evidencia documental, no medición actual ni registro de Egress.
- Al iniciar había diez archivos modificados y una ruta sin seguimiento. No se alteraron durante la auditoría ni puede suponerse que estaban desplegados durante los picos.

Se necesita correlacionar commit desplegado, hora de despliegue y tráfico en una misma zona horaria. Coincidencia temporal no establece causalidad.

## 8. Hallazgos ordenados por criticidad

| Nivel | Hallazgos | Confianza |
|---|---|---|
| CRÍTICO | S1: administración de cuentas sin autorización | Alta en código |
| CRÍTICO condicionado | S2: RPC administrativas sin restricciones explícitas | Alta en SQL; ACL pendientes |
| ALTO | P1–P2: multiplicación y duplicación | Alta |
| ALTO | P3–P7: firmas, dashboard, búsquedas, detalles y paginación | Alta; bytes pendientes |
| ALTO | S3–S4: autorización y revocación | Alta |
| ALTO | S5–S6: RLS y políticas | Alta en scripts |
| ALTO | S7–S9: flujos públicos, firmas y credenciales iniciales | Alta en código; despliegue pendiente |
| MEDIO | P8–P9: polling, agregaciones y caché | Alta |
| MEDIO | S10–S11: efectos secundarios y trazabilidad | Alta |
| BAJO | Dependencias omitidas en filtros | Media; sin bucle demostrado |

La criticidad expresa impacto potencial, no explotación confirmada.

## 9. Evidencias con rutas y ubicaciones

| Evidencia | Archivo y línea |
|---|---|
| Cliente privilegiado | `lib/supabase/admin.ts:12` |
| Rutas abiertas y proxy | `lib/supabase/proxy.ts:8` |
| Secreto de sesión | `lib/auth/session.ts:5` |
| Usuario activo | `features/auth/get-user.ts:19` |
| Acciones de usuarios | `features/users/actions.ts:16` |
| RPC privilegiadas | `db/auth-users.sql:64` y `85` |
| Conjunto de RLS | `db/supabase-schema.sql:696` |
| Tablas sin RLS localizado | `db/migration-providers.sql:4`, `db/migration-work-categories.sql:5`, `db/migration-salary-receipts.sql:5` |
| Descarga acumulativa | `lib/data/works.ts:186`, `lib/data/finance.ts:60` |
| Relaciones completas | `lib/data/projects.ts:138` |
| Enriquecimiento por pedido | `lib/data/orders.ts:101` |
| Recorrido de deudas | `lib/data/finance.ts:516` |
| Duplicación de deudas | `app/(dashboard)/finance/[module]/page.tsx:79` |
| Dashboard | `app/(dashboard)/dashboard/page.tsx:18` |
| Detalle de obra | `app/(dashboard)/obras/[id]/page.tsx:46` |
| Búsquedas públicas | `app/abono/actions.ts:27`, `app/pedido/actions.ts:18` |
| Polling | `components/layout/order-notifications.tsx:171` |
| Notificaciones públicas | `app/api/order-notifications/route.ts:48` |
| Firma pública | `app/recibo/signature-actions.ts:25` |
| Escritura durante lectura | `lib/data/finance.ts:3115` |
| Volumen previamente documentado | `docs/verificacion-ingresos-obras-2026-10-20.md:25` |

## 10. Causas confirmadas, probables y no verificables

### Confirmado

Lecturas redundantes, multiplicación por pedido, selección de firmas innecesarias, filtros posteriores a la descarga, polling y carencias de autorización. Son mecanismos confirmados, **no una atribución confirmada de los 19.85 GB**.

### Hipótesis priorizadas

1. Código + tamaño de respuestas + navegación habitual.
2. Búsquedas públicas o tráfico automatizado amplificando esas lecturas.
3. Otros proyectos o entornos locales/previsualizaciones usando la misma base.
4. Acceso directo abusivo a Supabase si los permisos efectivos lo permiten.

### Estimación ilustrativa: pedidos

Supuestos, no mediciones:

- Una obra con 500 movimientos.
- 1 KB medio por movimiento.
- 50 pedidos.

Cada lectura del historial sería aproximadamente 0.5 MB. Repetirlo por cincuenta pedidos serían 25 MB; dos recorridos serían **50 MB por visita**, sin otras consultas. Con esas hipótesis, **120 visitas producirían unos 6 GB**.

El ejemplo explica cómo pocos usuarios pueden generar mucho tráfico; no demuestra tamaños o comportamiento reales.

### Estimación ilustrativa: polling

Tres pestañas durante ocho horas:

```text
3 × 8 × 3.600 / 15 = 5.760 solicitudes al endpoint
```

Con 2 KB de salida de Supabase por ciclo serían unos 11.5 MB. Para alcanzar seis GB con esos ciclos haría falta aproximadamente 1 MB por ciclo. Dado el límite de 5/10 pedidos por respuesta, el polling normal parece una explicación menos fuerte que los reportes repetidos.

Las estimaciones no incorporan compresión, cabeceras o detalles de contabilización del proveedor.

### No verificable localmente

- Proyecto y servicio responsables de cada GB.
- Versión desplegada, tamaños reales de filas/firmas y número de solicitudes.
- RLS, grants, RPC y registro de Auth efectivos.
- Accesos externos, filtración de credenciales o explotación.
- Contribución de desarrollo, previsualizaciones y consultas administrativas.

La comparación con Degoyado Lopar exige igualar período, proyectos, categorías de Egress y patrones de acceso. Tres frente a quince usuarios no es una base suficiente de comparación.

## 11. Plan de optimización

Propuesta pendiente de aprobación; no implementada.

| Prioridad | Acción | Impacto esperado | Complejidad/riesgo |
|---|---|---|---|
| P0 | Atribuir consumo por proyecto y servicio | Evita diagnóstico sobre consumo ajeno | Baja |
| P1 | Excluir firmas/columnas innecesarias | Potencialmente grande por respuesta | Baja–media |
| P1 | Eliminar `getWork` por pedido | Muy alta reducción de solicitudes | Media |
| P1 | Compartir detalles de deudas | Elimina recorrido duplicado | Baja–media |
| P1 | Búsqueda SQL filtrada/limitada | Gran reducción por búsqueda | Media |
| P2 | Agregados específicos de dashboard/balance | Reduce historial transferido | Media–alta; conciliación |
| P2 | Paginación real | Acota transferencia por navegación | Media |
| P2 | Reutilización y caché controlada | Reduce repetición | Media; datos obsoletos |
| P2 | Polling de respaldo y concurrencia | Reduce tráfico de fondo | Baja–media |
| P3 | Índices según planes | Latencia y carga SQL | Media; revisión SQL |
| P3 | Telemetría de solicitudes y bytes | Detecta regresiones | Media |

No eliminar funcionalidades ni limitar arbitrariamente resultados que alimentan balances. No se verificaron planes SQL: los índices deben justificarse mediante evidencia del entorno autorizado.

## 12. Plan de fortalecimiento de seguridad

1. Exigir sesión activa y permiso específico en cada lectura/acción sensible.
2. Revisar ACL, propietarios y exposición de RPC administrativas.
3. Verificar RLS de todas las tablas, especialmente las tres omisiones.
4. Alinear sesión propia, Supabase Auth y políticas.
5. Proteger flujos públicos con alcance limitado, límites y validación contextual.
6. Proteger firmas contra modificación/reutilización no autorizada.
7. Rechazar configuración incompleta y gestionar revocación.
8. Separar emisión de comprobantes de su lectura.
9. Añadir trazabilidad sin secretos ni cuerpos privados.
10. Revisar avisos de seguridad de dependencias en una etapa autorizada con acceso externo.

Los cambios de esquema, políticas, grants o funciones se prepararán como SQL para revisión y ejecución por el usuario. No se ejecutarán remotamente por cuenta propia.

## 13. Pruebas necesarias para validar correcciones

Primero en entorno aislado con datos sintéticos:

| Prueba | Criterio |
|---|---|
| Muchos pedidos de una obra | Sin recargar la obra por cada pedido |
| Pantalla de deudas | Un cálculo compartido por solicitud |
| Firmas grandes | Ausentes en listados y búsquedas |
| Más de 1.000 registros | Totales completos y paginación correcta |
| Dashboard/detalle | Presupuesto explícito de consultas y bytes |
| Búsqueda pública | Límite y filtro antes de transferir |
| Realtime/polling | Sin superposición, limpieza y respaldo controlados |
| Errores 402/500 | Sin tormenta de reintentos ni balances falsos |
| Usuario sin permisos | Rechazo de URL y acción directa |
| Usuario desactivado | Rechazo aun con cookie no vencida |
| RPC/tablas | Pruebas negativas de `anon` y `authenticated` |
| Firma | Token, alcance, caducidad y no reutilización |
| Comprobante | Visualizar no escribe |
| Conciliación | Conservación de balances, deudas, salarios y reportes |

Después, y solo con autorización, observación limitada de producción. No es necesaria una prueba de carga para validar estos defectos.

## 14. Riesgos y precauciones antes de restablecer el servicio

- Restablecer cuota sin corregir amplificación puede repetir el problema.
- Ampliar el plan no corrige autorización ni permisos.
- Preservar registros y fechas de despliegue antes de cambios.
- No cerrar políticas indiscriminadamente: puede romper funcionalidades públicas legítimas.
- No transformar errores de base en listas vacías o balances cero.
- Revisar conexiones de desarrollo y previsualización al proyecto productivo.
- No abrir páginas que podrían escribir como forma de prueba de solo lectura.
- No revocar claves ni cambiar secretos sin procedimiento aprobado.
- Establecer alertas y seguimiento antes de retomar operación normal.

## 15. Recomendación final

Priorizar autorización administrativa y reducción de descargas repetidas en deudas, dashboard, detalles y búsquedas públicas.

El repositorio ofrece una explicación técnica plausible para un consumo elevado con pocos usuarios. La causa histórica sigue sin demostrarse hasta atribuir el consumo y correlacionarlo con tráfico/despliegues.

La próxima etapa propuesta es verificación externa acotada y de solo lectura: métricas por proyecto, configuración efectiva de permisos/RLS/RPC y registros existentes. No incluye invocar endpoints funcionales, pruebas de explotación ni correcciones.

### Seguimiento pendiente

- [ ] Revisar y aprobar este informe.
- [ ] Autorizar expresamente la verificación externa de solo lectura, conforme a la regla 3 de la solicitud de auditoría.
- [ ] Confirmar si 19.85 GB corresponde a Arquitectos Salazar o a varios proyectos.
- [ ] Identificar versión y horarios de despliegue del 18 al 24 de octubre.
- [ ] Verificar ACL de RPC administrativas y RLS de tablas señaladas.
- [ ] Recopilar métricas y registros existentes sin secretos ni información privada innecesaria.
- [ ] Medir consultas y bytes con datos sintéticos en entorno aislado.
- [ ] Aprobar alcance de correcciones antes de implementarlas.
- [ ] Preparar SQL revisable cuando corresponda; ejecución a cargo del usuario.
- [ ] Validar conciliación funcional y financiera antes de desplegar.

**La solicitud de guardar este Markdown no autoriza acceso externo ni implementación de correcciones.**
