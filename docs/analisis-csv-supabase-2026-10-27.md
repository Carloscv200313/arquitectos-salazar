# Análisis del CSV de Supabase y cierre local de consultas

> **Corrección posterior:** la conclusión sobre `Honorarios` como regla de «Utilidad obras» quedó desmentida por la documentación funcional y una comprobación de solo lectura: 0 movimientos activos `Honorarios`, 386 `Cuenta de oficina`. El parche posterior usa egresos de `Cuenta de oficina` en ambos reportes de utilidad. Los párrafos inferiores describen el estado anterior a ese parche.

**Proyecto:** Arquitectos Salazar · **Fecha:** 27 de octubre de 2026 · **Estado:** correcciones locales verificadas; sin despliegue ni SQL remoto.

## 1. Alcance de la evidencia

Se analizó el archivo local `supabase_logs.csv` sin modificarlo ni publicar URLs, filtros, identificadores o credenciales. Tiene **295 filas físicas**, no 1.000. Sus marcas de tiempo van del **27 de octubre de 2026, 07:42:57.810 a 08:03:40.189 UTC** (20 min 42 s). Contiene 286 eventos `edge` y 9 `postgres`; 284 respuestas HTTP 200, una 204 y una 101. El campo `log_count` no aporta un factor de expansión utilizable. **Este CSV no es la muestra anterior de 1.000 peticiones del 21 de octubre**; sus conteos no deben sumarse ni confundirse.

| Recurso PostgREST del CSV | Solicitudes observadas |
| --- | ---: |
| `work_movements` | 95 |
| `project_payments` | 22 |
| `users` | 15 |
| `works`, `salary_payments`, `payment_accounts`, `provider_debt_settlements` | 12 cada uno |
| `projects` | 10 |
| `work_orders` | 8 |

El pico del CSV contiene **207 eventos edge en el minuto 07:57 UTC**. Los mensajes muestran principalmente agente `node`, coherente con solicitudes realizadas por el servidor Next.js; el agente no demuestra quién inició la navegación ni descarta acceso automatizado. No hay bytes de respuesta, ruta de Next.js, identidad del usuario ni cabeceras para atribución exacta. La vista inicial de Supabase estaba en `All projects`; todavía falta verificar el Egress del proyecto y ciclo correctos. No hay evidencia suficiente para afirmar ataque ni para explicar los 19,85 GB completos.

## 2. Qué patrones aparecen en las 95 lecturas de movimientos

Se agruparon las solicitudes por **ruta, nombres de parámetros y proyección**, evitando exponer valores de filtros.

| Patrón | Observación en el CSV | Función que puede producirlo | Estado local |
| --- | --- | --- | --- |
| Obras por lote | 30 URL iguales con `work_id=in.(...)`, 19 IDs, sin `order`, `limit` ni `offset` visibles, en unos 35 s | Lectura por lote de `listWorks` / `listWorkMovementsByWorkIds`; también recargas independientes de páginas que la invocan | La lectura de hechos se comparte dentro de un render y usa 7 columnas; el código local actual pagina y ordena. La URL exportada no coincide exactamente con esa implementación, por lo que puede corresponder a otra versión o a solicitudes con cabeceras diferentes. |
| Reporte mensual de administración | 30 solicitudes en 3 recorridos de páginas de hasta 1.000 filas, proyección `category,movement_type,movement_date,amount` | `getWorksAdministrationUtilityReport` → `getFinanceUtilityReport` | Reutiliza `listActiveWorkMovementFacts` dentro del render; mantiene el filtro original `category = Honorarios` y los importes. |
| Saldos por método | 20 solicitudes en 2 recorridos, proyección `payment_method_id,movement_type,category,amount` | `getWorksPaymentMethodReport` y `getUnifiedMethodBalances` | Ambas consumen los mismos hechos de movimientos dentro del render. |
| Estado financiero mensual | 9 solicitudes, proyección de fecha/categoría/importe con filtro de egresos | `getWorkFinancialMonthlyReport` | Todavía necesita un recorrido completo para producir un reporte completo; no se impuso un límite que truncaría el resultado. |
| Deuda por pagar | 6 solicitudes con cuenta y tipo filtrados | `getAccountsPayableWorkMovementDebts` | La lectura sigue siendo filtrada y paginada; debe observarse en staging. |

Las 8 solicitudes a `work_orders` de este CSV incluyen páginas de listado y lecturas acotadas del endpoint de notificaciones. **No reproduce** las 420 lecturas de `work_orders`, 338 de `work_movements` ni las 180/111 repeticiones comunicadas para el 21 de octubre. La misma URL repetida tampoco prueba que los cuerpos de respuesta fueran idénticos, porque faltan las cabeceras y el tamaño.

## 3. Cadena de llamadas y corrección

- [`/dashboard`](../app/(dashboard)/dashboard/page.tsx) ejecuta en paralelo obras, pedidos, utilidades y balance. Los tres cálculos de movimientos antes podían recorrer la tabla por separado. [`lib/data/work-movement-facts.ts`](../lib/data/work-movement-facts.ts) obtiene en páginas los campos `id,work_id,payment_method_id,movement_type,category,amount,movement_date` y React `cache` comparte la promesa **solo dentro del render**. [`works.ts`](../lib/data/works.ts) usa esos hechos para obras, utilidades y saldos; [`finance.ts`](../lib/data/finance.ts) los usa para saldos por método. Las firmas base64 y el resto de columnas quedan fuera de esa lectura agregada.
- [`/finance/deudas`](../app/(dashboard)/finance/[module]/page.tsx) utiliza resultados de deudas compartidos por render y pedidos/pagos agrupados. Las consultas por pedido del N+1 anterior fueron eliminadas en [`orders.ts`](../lib/data/orders.ts) y `finance.ts`.
- [`/pedidos/[workId]`](../app/(dashboard)/pedidos/[workId]/page.tsx) obtiene la obra una vez y carga pedidos y pagos por lote. Una interacción no descarga el historial completo de la obra para validar el saldo de un abono.
- [`/obras/[id]`](../app/(dashboard)/obras/[id]/page.tsx) conserva la consulta detallada del historial, necesaria para visualizarlo; metadata consulta solo el nombre. Las lecturas iguales del mismo render se comparten.
- Las notificaciones usan Realtime con respaldo espaciado, pausa cuando la pestaña está oculta, una solicitud simultánea y detención ante 401/402/403. El endpoint consulta pedidos de forma acotada.

La consulta `listActiveWorkMovementFacts` **no reduce el número de páginas exigidas por un reporte completo de 8.000 movimientos**. Reduce los recorridos redundantes del mismo render y la anchura de cada fila. Distintas navegaciones o recargas siguen haciendo lecturas nuevas: el cache privado es por render para evitar compartir datos entre usuarios y para preservar frescura. Dos accesos separados que invoquen el mismo reporte pueden producir URL iguales. La telemetría opcional en [`telemetry.ts`](../lib/supabase/telemetry.ts) y [`transport.ts`](../lib/supabase/transport.ts) debe diferenciar ese caso de duplicados internos.

## 4. Regresión financiera detectada durante esta revisión

Una corrección local anterior había cambiado el reporte mensual de utilidades de obras a `Cuenta de oficina` y había filtrado egresos. La versión original del repositorio consultaba **`category = Honorarios`** y sumaba el importe tal cual. Se restauró esta regla en `getWorksAdministrationUtilityReport` y se añadió una prueba explícita por mes. Las referencias sintéticas de utilidades y dashboard se ajustaron a **la regla original comprobada en Git**, no a una regla nueva. Este hallazgo debe revisarse especialmente en staging porque la versión local anterior podía mostrar una utilidad distinta.

## 5. Medición local reproducible

Las cifras son del **simulador con datos sintéticos**, no peticiones ni bytes medidos en Supabase. `queries` cuenta solicitudes simuladas del cliente; `bytes` es JSON del simulador, no Egress facturado. El escenario grande usa 19 obras y 8.170 movimientos.

| Flujo | Antes | Después local | Condición verificada |
| --- | ---: | ---: | --- |
| Dashboard grande, consultas totales | 72 | 52 | Resultado financiero normalizado idéntico bajo la regla original `Honorarios` |
| Dashboard grande, `work_movements` | 34 | 14 | Lectura compartida y proyección reducida |
| Dashboard grande, bytes JSON | 4.799.941 | 2.181.491 | No equivale a transferencia facturada |
| Deudas, 24 obras y 288 pedidos, consultas totales | 1.190 | 16 | Huella de deudas conservada |
| Deudas, mismo escenario, `work_movements` | 291 | 4 | Pedidos agrupados |
| Dashboard, 24 obras, consultas totales | 1.251 | 42 | Importes y fechas comparados |
| Dashboard, 24 obras, `work_movements` | 320 | 4 | Una lectura compartida en el fixture de 960 movimientos |
| Pedidos de una obra, 12 pedidos | 49 | 6 | Saldos conservados |

Al abrir **solo** el reporte de utilidades o estados financieros, la nueva lectura común puede transferir más columnas que la consulta especializada anterior y hace una página vacía final en el simulador. Esta es una compensación real: el beneficio aparece cuando dashboard o finanzas necesitan varios cálculos a la vez. La prueba de 8.170 movimientos demuestra la mejora en el flujo crítico; **no se promete reducción para todas las pantallas aisladas**. Una optimización posterior con RPC de agregación exigiría esquema revisado y pruebas de exactitud, y no se ejecutó.

## 6. Verificaciones ejecutadas y pendientes

- `pnpm test`: **49/49 aprobadas**, incluidas deudas, dashboard, reportes, firmas, permisos, notificaciones, error 402, paginación y regla original de utilidades.
- `pnpm typecheck`: aprobado.
- `pnpm lint`: sin errores; 3 advertencias existentes por `<img>` en recibos.
- Build de Next.js **aprobado en copia aislada** con URL y claves sintéticas, sin `.env`, sin consultas a producción.
- El CSV se excluyó de Git mediante `.gitignore` para evitar publicar identificadores y filtros por accidente; el archivo original permanece intacto.

Quedan pendientes pruebas de navegador y staging con datos representativos, comparación de totales contra una copia anonimizada de producción, bytes reales por respuesta, correlación con logs del hosting y confirmación de que el código que generó el CSV corresponde al despliegue observado. No se ejecutó carga ni tráfico de prueba sobre Supabase de producción.

## 7. Seguridad y SQL pendientes

Los scripts [`audit-readonly-security-2026-10-26.sql`](../db/audit-readonly-security-2026-10-26.sql) y [`audit-readonly-performance-2026-10-27.sql`](../db/audit-readonly-performance-2026-10-27.sql) son de diagnóstico y lectura. Las migraciones [`migration-admin-rpc-grants-2026-10-27.sql`](../db/migration-admin-rpc-grants-2026-10-27.sql), [`migration-security-2026-10-26.sql`](../db/migration-security-2026-10-26.sql) y [`migration-public-search-2026-10-26.sql`](../db/migration-public-search-2026-10-26.sql) **no se aplicaron**. Antes de aplicarlas hacen falta propietario, firmas y `EXECUTE` reales de RPC, ACL/RLS de tablas, consumidores efectivos y publicación Realtime. La migración general tiene una guarda por `work_orders` en `supabase_realtime`; no forzarla si falla. El abono público todavía requiere una decisión del negocio sobre autorización del pagador y estado contable. Véanse los riesgos y el orden de despliegue en [`cierre-tecnico-preproduccion-2026-10-27.md`](cierre-tecnico-preproduccion-2026-10-27.md).

## 8. Secuencia segura para producción posterior

1. Seleccionar solo Arquitectos Salazar y el ciclo correcto en Usage; obtener Egress y, si existe, bytes por consulta. Correlacionar horario con rutas de hosting.
2. Respaldar base, esquema, ACL/RLS, funciones, publicación Realtime y artefacto desplegado; comprobar que el respaldo sea restaurable.
3. Ejecutar los dos diagnósticos de **solo lectura**; revisar resultados de seguridad antes de autorizar cualquier migración.
4. Probar código y SQL por separado en staging con datos sintéticos/anonimizados. Validar login, desactivación, permisos, obras, pedidos, abonos, utilidades, estados, salarios, firmas, recibos, Realtime, múltiples pestañas y errores 401/402/403/429. Comparar saldos antes/después.
5. Tras autorización explícita, desplegar el mismo artefacto probado y solo las migraciones aprobadas. Si cambian cifras financieras, fallan permisos o notificaciones, revertir el artefacto; restaurar ACL únicamente desde el respaldo revisado.
6. Monitorear por proyecto y día PostgREST Egress, peticiones por tabla, bytes por respuesta, duplicados por navegación, errores 402/429/5xx y cuota proyectada al cierre del ciclo. Un período representativo posterior al despliegue determinará si el plan gratuito alcanza.
