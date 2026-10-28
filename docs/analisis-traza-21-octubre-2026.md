# Trazabilidad de la muestra del 21 de octubre de 2026

Fecha del análisis: 27 de octubre de 2026. Fuentes: resumen del usuario de una exportación de 1.000 registros de Supabase; código anterior a las correcciones preservado para pruebas sintéticas; código local actual. No se consultó Supabase de producción.

## Qué prueba la muestra

En unos 22 minutos, la exportación muestra 420 consultas a `work_orders`, 338 a `work_movements`, 180 repeticiones de una petición idéntica a `work_movements` en unos 14 minutos, 111 repeticiones de una consulta de `work_orders`, y 24 obras consultadas 11–13 veces cada una. 998 peticiones presentan agente `node` y la mayoría terminaron con HTTP 200. La tasa de la muestra es de unos 45 registros por minuto, sin extrapolarla a un día completo. Las 180 repeticiones corresponden al mismo filtro `work_id`, según el resumen facilitado; no se dispone aquí de la URL completa ni del tamaño de respuesta.

El agente `node` es **compatible con solicitudes realizadas por Next.js en el servidor**. No identifica al usuario o al proceso que inició cada render, ni descarta que un tercero haya provocado peticiones al sitio. Los HTTP 200 muestran respuestas satisfactorias de la API, no que el acceso a la aplicación estuviera autorizado. Los totales por tabla no permiten repartir las 420 consultas de `work_orders` entre páginas sin ruta, hora y parámetros por petición. La muestra es una evidencia fuerte de repetición; no atribuye por sí sola los 19,85 GB de Egress ni demuestra ataque.

Las 111 consultas idénticas a `work_orders` podrían corresponder al antiguo sondeo de notificaciones: dos pestañas con un intervalo de 15 segundos producen aproximadamente 112 comprobaciones en 14 minutos. Es **una hipótesis aritmética, no una atribución**; el filtro y la proyección exactos permitirían distinguir ese endpoint de un listado de pedidos o de un cálculo de deudas. El informe de verificación posterior está en [verificacion-posterior-logs-2026-10-27.md](verificacion-posterior-logs-2026-10-27.md).

## Rastro de funciones de Next.js

| Página o endpoint | Cadena de llamadas anterior a la corrección | Relación con la muestra | Estado local actual |
| --- | --- | --- | --- |
| `app/(dashboard)/dashboard/page.tsx` | `DashboardPage` → `listOrderWorks`, `getGeneralBalanceReport` → `getDebtReport` → `getProviderDebtDetails` → por cada obra `listWorkOrders` → por cada pedido `enrich` → `getWork` → `work_movements`; además `works.map(listWorkMovements)` | Multiplicaba consultas de `work_orders`, pagos y movimientos; hacía otra lectura de movimientos por obra | Agrupación de pedidos/pagos; lectura compartida de `work_orders`; el dashboard reutiliza el lote de movimientos ya obtenido para `listWorks` |
| `app/(dashboard)/finance/[module]/page.tsx`, módulo `deudas` | `FinanceModulePage` → `getDebtReport` y `getProviderDebtDetails` en paralelo; la primera volvía a calcular la segunda | Duplicaba el árbol de deudas; el árbol contenía el mismo N+1 de obra/pedido | `React.cache` de reportes dentro del render; pedidos de todas las obras agrupados; enlaces a movimientos de pedidos derivados de la lectura compartida |
| `app/(dashboard)/pedidos/[workId]/page.tsx` | `WorkOrdersPage` → `getWork(workId)` y `listWorkOrders(workId)`; esta última enriquecía cada pedido con `getWork(workId)` y `paymentsOf(orderId)` | Explica de manera directa cómo se generaban peticiones idénticas a movimientos del mismo `work_id` | Una obra, una consulta de pedidos de esa obra y pagos por lotes; las lecturas concurrentes de obra se comparten en el render |
| `app/(dashboard)/obras/[id]/page.tsx` | `generateMetadata` y `WorkDetailPage` consultaban `getWork`; la página pedía además `listWorkMovements`, `getWorkCategorySummary` y `getWorkAdministrationUtilities` | Podía volver a descargar movimientos de la misma obra varias veces | Resumen, historial y utilidades reutilizan la consulta de movimientos del render |
| `app/(dashboard)/pedidos/page.tsx` y reportes | `listOrderWorks` → obras, todos los pedidos y pagos | Una fuente adicional de `work_orders` al abrir listados | Lectura global de pedidos compartida cuando otro cálculo la necesita en el mismo render |
| `app/api/order-notifications/route.ts` | Lectura acotada de `work_orders` por polling del cliente y eventos Realtime | Puede contribuir al conteo de `work_orders`, pero no explica las peticiones idénticas a `work_movements` | Respaldo espaciado, pausa en pestañas ocultas, una petición simultánea y parada ante 402 |
| `app/pedido/actions.ts` y `app/abono/actions.ts` | Al enviar un formulario público se llamaba a `getWork` solo para comprobar la obra, descargando también sus movimientos | Otra fuente posible de solicitudes al mismo `work_id`; la muestra agregada no permite cuantificarla | Validación acotada a `works.id`, sin consultar movimientos |

Los nombres de las funciones del código anterior se conservaron en el archivo temporal de referencia que se generó antes de editar el proyecto. La prueba permanente [trace-24-baseline.json](../tests/fixtures/trace-24-baseline.json) registra métricas y huellas SHA-256 de resultados sintéticos de esa versión.

## Correcciones verificadas para estas rutas

- `lib/data/orders.ts`: `listOrdersForWorks` consulta pedidos y pagos por lotes; `listWorkOrders` ya no llama a `getWork` por pedido. `listOrderWorks`, deudas y enlaces a movimientos comparten las filas activas de pedidos dentro del render.
- `lib/data/works.ts`: `listWorks` obtiene los movimientos necesarios para el saldo de todas las obras en lotes y expone ese resultado al dashboard; el detalle de una obra reutiliza `listWorkMovements`. Las proyecciones omiten `signature` base64.
- `lib/data/finance.ts`: `getProviderDebtDetails` recibe pedidos agrupados y comparte su cálculo con `getDebtReport` y el balance. No cambia las reglas de redondeo ni de saldo.
- `app/pedido/actions.ts` y `app/abono/actions.ts`: la comprobación de existencia de la obra selecciona únicamente `id`, sin descargar el historial financiero.
- `lib/supabase/transport.ts`: lecturas completas recorren páginas; una respuesta 402 o un fallo en una página impide presentar importes parciales como válidos. El cache se limita al render para que otro usuario no reciba datos privados de uno anterior.

## Mediciones con datos sintéticos

Se prepararon **24 obras, 12 pedidos por obra (288 en total), 40 movimientos por obra (960 en total)** y firmas ficticias de 4.000 caracteres para poner a prueba descargas innecesarias. La referencia anterior se calculó antes de las correcciones; el resultado de deudas y la salida financiera del dashboard coinciden con esa referencia. Los números son llamadas lógicas del cliente simulado y tamaño JSON en memoria, **no solicitudes ni bytes medidos en Supabase**.

| Escenario sintético | Llamadas antes → después | `work_orders` antes → después | `work_movements` antes → después | Bytes JSON antes → después |
| --- | ---: | ---: | ---: | ---: |
| Deudas, 24 obras | 1.190 → 16 | 25 → 1 | 291 → 4 | 62.186.030 → 529.884 |
| Dashboard, 24 obras | 1.251 → 46 | 26 → 1 | 320 → 8 | 79.731.935 → 734.475 |
| Pedidos, 1 obra y 12 pedidos | 49 → 6 | 1 → 1 | 12 → 2 | 2.169.444 → 21.120 |
| Detalle de 1 obra | 8 → 6 | 0 → 0 | 4 → 2 | 717.410 → 14.819 |

Las dos lecturas de movimientos del caso de una obra incluyen una página de datos y una comprobación de fin de páginas; así el sistema no corta un informe si Supabase impone un límite menor. El dashboard todavía necesita algunas consultas distintas para informes financieros que no son equivalentes a la lectura de movimientos por obra. La duración del simulador no permite concluir una mejora real de tiempo de respuesta.

## Pruebas y límites

`tests/financial.test.cjs` compara resultados completos con la referencia sintética de una obra, verifica la huella exacta de deudas para 24 obras y compara saldos, fechas, tipos, importes y el resumen calculado del dashboard con y sin reutilización del lote. También prueba 250 pedidos asociados a una obra con 1.205 movimientos y que comprobar una obra pública no lea su historial. `tests/transport.test.cjs` verifica paginación superior a 1.000 filas, cache por render y fallo seguro ante 402. No se generó tráfico hacia producción.

Para atribuir las 420 y 338 consultas reales a rutas concretas harían falta, si existen, registros del hosting con ruta, hora, duración y estado; identificador correlativo entre petición Next.js y llamada PostgREST; volumen de respuesta por solicitud; distribución temporal y origen de las peticiones; y el desglose de Egress por proyecto. No guardar cookies, tokens, parámetros sensibles ni cuerpos en esa correlación.

## Hallazgos de seguridad aún pendientes

La aplicación usa autenticación propia y `service_role` en el servidor. Las ACL, RLS, propietarios y privilegios efectivos de la base real no se han verificado. Las migraciones de seguridad están preparadas, **sin ejecutar**. El formulario público de abonos aún registra ingresos definitivos sin verificar al pagador; decidir un enlace autorizado o un paso de aprobación cambia el flujo de negocio. Los límites locales de peticiones no sustituyen un límite distribuido del hosting. Realtime debe probarse con las ACL definitivas antes de aplicar SQL. Estos riesgos y el procedimiento de despliegue están detallados en [el informe de correcciones](correcciones-seguridad-rendimiento-2026-10-27.md).
