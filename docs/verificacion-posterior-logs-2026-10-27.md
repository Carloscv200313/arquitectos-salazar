# Verificación local de consultas y seguridad tras la muestra de Supabase

Continuación con cambios y pruebas adicionales: [cierre técnico local y preparación de preproducción](cierre-tecnico-preproduccion-2026-10-27.md).

**Proyecto:** Arquitectos Salazar · **Fecha:** 27 de octubre de 2026 · **Estado:** cambios locales; sin despliegue, acceso a producción ni ejecución de SQL remoto.

## 1. Alcance y evidencia disponible

Se continuaron las correcciones existentes descritas en [el informe de implementación](correcciones-seguridad-rendimiento-2026-10-27.md), [la auditoría](auditoria-seguridad-rendimiento-egress-2026-10-26.md) y [la trazabilidad de la muestra](analisis-traza-21-octubre-2026.md). No se reinició el trabajo ni se modificaron datos reales.

El usuario aportó un resumen de **1.000 registros en unos 22 minutos** del 21 de octubre: 420 solicitudes a `work_orders`, 338 a `work_movements`, 180 repeticiones idénticas de movimientos en unos 14 minutos y 111 repeticiones idénticas de pedidos. 998 presentan agente `node`; la mayoría obtuvo HTTP 200. **No disponemos del archivo de logs original, URL exacta, ruta Next.js iniciadora ni tamaño por respuesta.** Por tanto, el código permite identificar cadenas causales posibles y probar su eliminación en un render, pero no asignar cada registro histórico a una pantalla ni explicar todos los 19,85 GB.

## 2. Rutas que podían generar las repeticiones

| Flujo Next.js | Cadena de consultas previa | Verificación local |
| --- | --- | --- |
| `/dashboard` | `DashboardPage` → `listOrderWorks`, balance → deudas → pedidos por obra → `getWork` por pedido → `work_movements`; también `listWorkMovements` por obra | Pedidos, pagos y movimientos se agrupan; el dashboard reutiliza el lote de obras. Movimientos de proyectos ahora se consultan en lotes. |
| `/finance/deudas` | `FinanceModulePage` → reporte y detalle de proveedores simultáneos → mismo cálculo y enriquecimiento de pedidos repetidos | Cache limitado al render; prueba de pantalla sintética: 126 → 14 llamadas. |
| `/pedidos/[workId]` | `WorkOrdersPage` → obra y lista de pedidos → `getWork` por pedido de la misma obra | `listWorkOrders` carga la obra una vez y los pedidos/pagos en lotes; 49 → 6 llamadas para 12 pedidos. |
| `/obras/[id]` | `generateMetadata`, detalle, historial, resumen y utilidades podían leer los mismos movimientos | Metadata obtiene solo el nombre; `getWork` y las otras lecturas comparten movimientos en el render. |
| Cotización y abono de pedido | Server Action escribía y volvía a ejecutar `getWorkOrder` para obtener `work_id`; validar saldo de abono cargaba toda la obra | La función de escritura devuelve `work_id`; el saldo usa `work_orders` acotado más pagos. Prueba: 6 → 2 lecturas antes de escribir, con el mismo pendiente. |
| Notificaciones | Cliente consultaba cada 15 s además de Realtime | Un canal por componente con limpieza; respaldo a 60 s si no hay Realtime y comprobación a 300 s si lo hay; pausa oculta, solicitud única y parada ante 401/402/403. El endpoint lee pedidos una vez y obras una vez cuando hay resultados. |

Las 180 consultas idénticas a movimientos **ya no surgen del N+1 dentro de una sola ejecución** de los flujos probados. Aún podrían aparecer con 180 navegaciones, recargas, acciones o clientes independientes: el cache es por render, deliberadamente, para evitar compartir datos privados entre usuarios. Las 111 lecturas de pedidos podrían coincidir con el sondeo antiguo, pero se necesita la URL/proyección filtrada para comprobarlo. El agente `node` es compatible con llamadas desde Next.js y no identifica quién inició el tráfico.

## 3. Correcciones nuevas de esta verificación

1. **Telemetría opcional:** `lib/supabase/telemetry.ts` agrupa por pantalla, recurso y navegación las consultas lógicas, duplicados, peticiones HTTP reales, bytes aproximados de respuesta y duración. `lib/supabase/transport.ts` emite huella HMAC de consulta y un `traceId` cuando `DATA_TELEMETRY=1`. No registra URL, filtros, cookies, tokens, cuerpos ni identificador real del usuario; usa un seudónimo diario. Está desactivada por defecto. Los bytes cuentan JSON decodificado, **no Egress facturado**; cada página de PostgREST cuenta como una petición real aunque sea una sola consulta lógica.
2. **Cobertura de pantallas:** trazas en dashboard, deudas y otros módulos financieros, pedidos, detalle de obra, reportes de pedidos y endpoint de notificaciones. Consultas de autorización previas a la traza y Server Actions independientes deben seguirse con `database_request`/`queryHash`; la métrica `screen_data_metrics` no es un contador absoluto de todo el ciclo HTTP.
3. **Obras y pedidos:** metadata de obra consulta solo `name`; formularios de pedidos y movimientos ya no fuerzan `router.refresh()` después de acciones que invalidan la página con `revalidatePath`; cotización y abono ya no releen el pedido completo tras escribir; validación del saldo de un abono ya no descarga `work_movements`.
4. **Dashboard:** una lectura por lote de `project_payments` sustituye una lectura por proyecto, sin cambiar los movimientos presentados. Los filtros de proyectos y obras combinan cambios simultáneos de búsqueda/cliente en una navegación diferida.
5. **Notificaciones y SQL:** el endpoint propaga fallos de la lectura de obras; la política de intervalos y errores tiene pruebas. La migración SQL pendiente ahora se bloquea si `work_orders` participa en la publicación `supabase_realtime`, porque revocar `SELECT` anónimo podría cortar Realtime con la autenticación propia. No se ejecutó.

## 4. Mediciones sintéticas y regresión

Las cifras siguientes proceden de un cliente Supabase simulado en memoria. **Son consultas lógicas y bytes JSON del simulador, no Egress ni latencia de Supabase.** Para la prueba grande se usaron 24 obras, 288 pedidos, 960 movimientos y firmas ficticias de 4.000 caracteres. El resultado financiero se compara con una referencia calculada del código anterior mediante igualdad de valores o huellas SHA-256.

| Flujo | Consultas antes → después | `work_orders` | `work_movements` | JSON antes → después |
| --- | ---: | ---: | ---: | ---: |
| Deudas, 24 obras | 1.190 → 16 | 25 → 1 | 291 → 4 | 62.186.030 → 529.884 B |
| Dashboard, 24 obras | 1.251 → 46 | 26 → 1 | 320 → 8 | 79.731.935 → 734.475 B |
| Pedidos, una obra y 12 pedidos | 49 → 6 | 1 → 1 | 12 → 2 | 2.169.444 → 21.120 B |
| Detalle de obra | 8 → 6 | 0 → 0 | 4 → 2 | 717.410 → 14.819 B |
| Listado, 24 obras | 5 → 6 | 1 → 1 | 1 → 2 | 4.414.594 → 367.716 B |
| Estado previo a abonar | 6 → 2 | 1 → 1 | 2 → 0 | 15.293 → 375 B |

El listado de 24 obras hace una comprobación de fin de páginas adicional para no truncar saldos si el servidor limita las filas. En otra prueba con **24 proyectos**, el tramo de movimientos del dashboard pasó de **24 a 1 consulta** a `project_payments`, con los mismos registros y orden. El endpoint de notificaciones ejecutó en prueba **1 lectura a `work_orders` y 1 a `works`**; si no hay pedidos nuevos no necesita consultar obras. Los intervalos de respaldo se verificaron como política, no con un navegador ejecutándose durante horas.

## 5. Pruebas realizadas y cobertura pendiente

- `pnpm test`: 42/42 pruebas aprobadas. Cubren importes de deudas, balance, estados, salarios, utilidades, pedidos, detalle de obra, proyectos, dashboard, paginación, 402, sesión desactivada, permisos de acciones, recibos, tokens de firma, notificaciones y telemetría sin datos sensibles.
- `pnpm typecheck`: aprobado.
- `pnpm lint`: cero errores; tres advertencias existentes de `<img>` en el documento de recibo.
- Build de producción aislado con variables **sintéticas**, fuentes simuladas locales y sin `.env`: aprobado (`next build --webpack`). No hizo solicitudes a Supabase de producción.

Las pruebas de `useEffect`, Realtime y navegación incluyen comprobaciones estructurales y de la política de temporización. Falta una prueba de navegador de extremo a extremo con Supabase de staging y datos sintéticos para confirmar reconexión, múltiples pestañas, documentos/firma y permisos efectivos de PostgreSQL. Los cálculos de datos reales no se compararon porque se evitó consultar producción.

## 6. Procesos y riesgos que permanecen

- **Navegaciones repetidas:** dashboard, deudas y reportes todavía leen historiales completos para cálculos exactos. Una persona que recarga o navega continuamente, o un automatismo que solicite páginas, puede generar respuestas grandes. La telemetría permitirá distinguir un N+1 dentro de un render de muchas navegaciones independientes.
- **Recargas residuales:** otros formularios de finanzas, proyectos y configuración conservan `router.refresh()`. Algunas rutas invalidan con `revalidatePath`, pero no se retiraron indiscriminadamente sin pruebas de interfaz para cada flujo. Pueden causar lecturas adicionales después de escribir; son un objetivo de revisión en staging si las métricas muestran repetición.
- **Notificaciones por pestaña:** el respaldo sigue ejecutándose por pestaña visible; Realtime puede no funcionar si los permisos reales no permiten la suscripción. El control de frecuencia del endpoint es local al proceso y no distribuido.
- **Paginación de informes:** la paginación garantiza resultados completos, por lo que un historial grande aumenta peticiones y bytes; no se fijó un límite arbitrario que altere saldos.
- **Seguridad pendiente:** ACL/RLS/propietarios/privilegios efectivos de funciones, grants sobre `public`, publicación Realtime y roles reales no se han contrastado con Supabase. El abono público aún registra ingreso definitivo sin verificar al pagador: requiere decisión de negocio sobre enlace firmado o aprobación. No hay evidencia de explotación ni de ataque.
- **Muestra incompleta:** falta el tamaño de respuesta, ruta de hosting y parámetros exactos de las solicitudes reales. La pantalla inicial de Usage tenía **All projects**: hay que seleccionar el proyecto Arquitectos Salazar y el ciclo de facturación correcto antes de atribuir consumo.

## 7. Validaciones de Supabase antes del SQL pendiente

Ejecutar **solo en lectura**, por una persona autorizada, [el script de auditoría SQL](../db/audit-readonly-security-2026-10-26.sql) en el proyecto correcto. Guardar resultados sin secretos. Verificar: propietarios de `verify_login`, `admin_create_user`, `admin_set_password` y otras `SECURITY DEFINER`; firmas exactas; `search_path`; `EXECUTE` de `PUBLIC`, `anon`, `authenticated` y `service_role`; permisos de esquema `public` y `extensions`; RLS y políticas por tabla; consumidores legítimos `authenticated`; acceso de Storage y vistas/RPC; `pgcrypto`; y membresía de `work_orders` en `supabase_realtime`.

[La migración de seguridad propuesta](../db/migration-security-2026-10-26.sql) **no debe aplicarse tal como está** si `work_orders` sigue publicado y el cliente Realtime usa la clave anónima. Hay que definir y probar en staging cómo conservar avisos en tiempo real con permisos mínimos. [La migración opcional de búsqueda pública](../db/migration-public-search-2026-10-26.sql) requiere revisar propietarios, grants y plan de consulta antes de activarse. Ninguna migración se ejecutó aquí.

## 8. Plan de despliegue y reversión, sujeto a autorización posterior

1. Confirmar proyecto/ciclo de Usage y obtener una exportación sanitizada de las consultas repetidas (ruta PostgREST, proyección, filtros con valores ocultos, hora, estado y bytes, si existen). Relacionar con logs de hosting por hora/ruta y con `traceId` una vez instrumentado staging.
2. Preparar respaldo verificable de base de datos, esquema, ACL/RLS, funciones, publicación Realtime, Storage y artefacto actual de la app. Guardar configuración de despliegue sin volcar credenciales en el informe.
3. Desplegar **primero en staging** con datos sintéticos/anonimizados. Probar inicio/cierre, usuario desactivado, permisos, pedidos, abonos, obras, finanzas, salarios, documentos/firma, notificaciones, reconexión, múltiples pestañas, 402 y volúmenes representativos. Comparar resultados financieros con referencia antes/después.
4. Revisar SQL con el preflight real y resolver explícitamente la dependencia Realtime/`anon SELECT`; ejecutar migraciones únicamente mediante aprobación y procedimiento humano separado. No combinar cambios de permisos con el primer despliegue de código sin pruebas de staging.
5. Con autorización para producción, desplegar el artefacto probado, habilitar `DATA_TELEMETRY=1` temporalmente, comprobar funciones principales y observar las métricas. Si suben errores, difieren saldos, fallan firmas o se interrumpe Realtime, revertir al artefacto anterior. Revertir ACL/RLS solo desde el estado respaldado y tras revisar el impacto; no usar una revocación inversa genérica.

## 9. Métricas para decidir sobre el plan gratuito

En el panel Supabase, seleccionar **Arquitectos Salazar** y el ciclo de facturación, no `All projects`. Registrar cada día: Egress facturado por proyecto y por servicio, saldo de cuota, solicitudes y bytes de PostgREST por tabla/consulta, errores 402/429/5xx, y pendiente de consumo diario proyectada al cierre del ciclo. En la app observar por `screen_data_metrics`: pantalla, peticiones HTTP reales, duplicados lógicos, bytes JSON aproximados, duración y recurso; por endpoint, frecuencia y errores; por navegación seudónima, cantidad de pantallas repetidas. Revisar con especial atención `work_orders`, `work_movements`, dashboard, deudas, notificaciones y múltiples pestañas.

La reducción sintética demuestra que se eliminó el N+1 probado; **no demuestra todavía que el consumo real quedará bajo la cuota gratuita**. Esa decisión requiere un ciclo representativo posterior al despliegue, con margen para días de mayor uso y con el Egress de otros proyectos excluido o contabilizado por separado.

## 10. Solicitud opcional de evidencia adicional

Si se comparte una fila **sanitizada** de cada consulta repetida (`work_movements` y `work_orders`) con método, ruta, nombres de filtros/proyección, hora, estado y tamaño de respuesta, se podrá distinguir si `work_orders` provenía de notificaciones, un listado o un informe. Ocultar valores de identificadores, tokens, encabezados de autorización y datos personales.
