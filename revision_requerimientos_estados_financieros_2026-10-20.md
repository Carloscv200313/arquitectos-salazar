# Revisión de requerimientos — Obras y Estados Financieros

**Fecha de referencia:** 20 de octubre de 2026  
**Origen:** Video de WhatsApp de aproximadamente 1 minuto y 19 segundos.  
**Sistema observado:** Arquitectos Salazar.  
**Estado:** Documento preliminar de análisis; necesita validación de la explicación verbal del video.

> **Alcance y límite de la evidencia:** Este documento se basa en lo que puede comprobarse visualmente en la grabación. No se cuenta con una transcripción verificable de la narración de tu jefe; por ello, las tareas propuestas a continuación **no deben interpretarse como órdenes textuales ni cambios definitivamente aprobados**. Se distingue entre las observaciones y las validaciones pendientes.

## 1. Qué se muestra en el video

El video alterna entre las siguientes secciones del sistema:

1. **Detalle de una obra:** se visualiza la obra **Alejandro López Casa**, con tarjetas de saldo, entradas y salidas, un resumen por categoría y un historial de movimientos.
2. **Estados Financieros → Flujo de caja:** se revisan ingresos y gastos mensuales, especialmente la fila **Ingresos de obras**.
3. **Estados Financieros → Estado de resultados:** se revisan las filas **Ingresos totales**, **Otros ingresos** y **Total de ingresos**, además de los costos y utilidades.

El recorrido y la selección de cifras sugieren que se quiere **revisar la correspondencia entre los movimientos registrados en las obras y los importes de los reportes financieros**, pero el cambio concreto debe confirmarse con la explicación hablada.

## 2. Datos visibles que sirven para la validación

### 2.1. Detalle de la obra «Alejandro López Casa»

| Indicador | Monto visualizado |
|---|---:|
| Entradas registradas | $5,294,497.97 |
| Salidas registradas | $4,693,209.69 |
| Saldo actual | $601,288.28 |
| Categoría de ingreso «Abono de obra» — presupuesto | $7,193,596.15 |
| Categoría «Abono de obra» — monto registrado | $5,294,497.97 |

**Comprobación aritmética:** $5,294,497.97 − $4,693,209.69 = **$601,288.28**. La operación de las tarjetas coincide con el saldo mostrado.

En el resumen por categoría también se observan **Aluminio**, **Cantera** y **Cuenta de oficina**, junto con valores de presupuesto, tipo, monto registrado y porcentaje sobre presupuesto.

### 2.2. Estados Financieros — Flujo de caja

Se observan columnas mensuales para 2026 y categorías como:

- Ingresos.
- Ingresos por proyectos.
- **Ingresos de obras.**
- Otros ingresos.
- Gastos.
- Costos directos del servicio.
- Gastos en obras.
- Comisión a Arquitectos por Proyecto.
- Gastos administrativos.
- Gastos de oficina.

En enero de 2026 se alcanzan a leer, entre otros, estos importes:

| Concepto | Enero de 2026 |
|---|---:|
| Ingresos de obras | $2,054,913.46 |
| Otros ingresos | $2,500.00 |
| Ingresos | $2,057,413.46 |

### 2.3. Estados Financieros — Estado de resultados

En enero se muestran:

| Concepto | Enero de 2026 |
|---|---:|
| Ingresos totales | $2,054,913.46 |
| Otros ingresos | $2,500.00 |
| Total de ingresos | $2,057,413.46 |

**Observación:** La fila denominada **«Ingresos totales»** en el Estado de resultados coincide, para el mes visible, con **«Ingresos de obras»** del Flujo de caja. Luego aparece una fila distinta de **«Total de ingresos»**, que sí suma los otros ingresos. Conviene **validar si la nomenclatura es la esperada**, porque ambos nombres pueden confundirse.

**Precaución:** Las cifras mensuales del reporte financiero pueden abarcar **todas las obras**, mientras que los $5,294,497.97 corresponden a **una obra específica**. No sería correcto exigir igualdad directa entre esos valores sin revisar filtros, períodos y alcance.

## 3. Requerimiento principal por confirmar

**Revisar la trazabilidad y consistencia de los importes de ingresos y gastos desde los movimientos de obra hacia los reportes de Estados Financieros.**

Esto significa determinar si los abonos de obra, los egresos y las demás categorías están alimentando correctamente los totales por mes y los resultados financieros, sin registros omitidos o contados dos veces.

> Este enunciado es una **interpretación de la comparación visual**, no una transcripción literal de la solicitud de tu jefe.

## 4. Puntos a revisar antes de modificar código

### REV-01. Origen de los ingresos de obras

- Identificar de qué registros se calcula el indicador **Entradas** de cada obra.
- Identificar qué categorías de movimientos forman **Ingresos de obras** en el Flujo de caja.
- Verificar cómo se relaciona **Abono de obra** con **Ingresos de obras**.
- Confirmar si existen otros movimientos de ingreso que deban incluirse o excluirse.
- Verificar que un movimiento no sea contado más de una vez.

**Por confirmar:** Si la solicitud busca corregir datos, corregir el mapeo de categorías o únicamente aclarar su visualización.

### REV-02. Fechas y agrupación mensual

- Identificar qué fecha utiliza el reporte: fecha del movimiento, fecha de pago, fecha de registro u otra.
- Comprobar que la misma operación se asigne al mes correcto en los reportes donde corresponda.
- Revisar el comportamiento de filtros **Desde / Hasta**.
- Aclarar la diferencia entre un acumulado histórico de obra y un importe de un mes.

**Por confirmar:** Qué regla de fecha espera el negocio.

### REV-03. Relación entre Flujo de caja y Estado de resultados

- Revisar las fórmulas que generan **Ingresos de obras**, **Ingresos totales**, **Otros ingresos** y **Total de ingresos**.
- Validar si la equivalencia observada es intencional y se mantiene en otros meses.
- Revisar si el rótulo **Ingresos totales** debería diferenciarse de **Total de ingresos**.
- Mantener separados los conceptos de flujo de efectivo y resultado contable cuando su lógica de reconocimiento sea diferente.

**Por confirmar:** Si tu jefe está pidiendo un cambio de nomenclatura, de cálculo o ambos.

### REV-04. Salidas y gastos vinculados con obras

- Identificar qué movimientos construyen las **Salidas** de una obra.
- Comparar con las categorías financieras **Gastos en obras**, **Costos directos del servicio** y los gastos administrativos.
- Revisar si un egreso pertenece a una obra, a oficina o a otro tipo de gasto.
- Evitar mezclas y duplicidades entre categorías.

**Por confirmar:** Si los egresos están dentro del alcance concreto solicitado en el audio.

### REV-05. Presentación de indicadores y porcentajes

- Revisar la interpretación de **Presupuesto**, **Monto registrado** y **% sobre presupuesto** en el detalle de la obra.
- Comprobar cómo se calculan y etiquetan los porcentajes del Estado de resultados.
- No confundir presupuesto proyectado con dinero efectivamente ingresado o gastado.

**Por confirmar:** Si se necesita modificar algún indicador visual o únicamente comprobar su lógica.

## 5. Pruebas sugeridas

| Caso | Verificación | Resultado esperado |
|---|---|---|
| P-01 | Saldo de «Alejandro López Casa» | Entradas − salidas = $601,288.28 para los datos mostrados. |
| P-02 | Abonos de una obra | La suma de movimientos válidos de la categoría coincide con el total de la obra, bajo los mismos filtros. |
| P-03 | Agrupación por mes | Cada movimiento aparece en el mes que corresponde según la regla de fecha validada. |
| P-04 | Flujo de caja | El total de ingresos del mes suma correctamente sus categorías, sin duplicados. |
| P-05 | Estado de resultados | Los ingresos, costos y utilidades respetan las fórmulas contables definidas para este reporte. |
| P-06 | Comparación entre vistas | Solo se comparan importes con el mismo alcance: proyecto, conjunto de obras, fechas y estado. |
| P-07 | Egresos y categorías | Los gastos de obra y los gastos de oficina se clasifican en sus rubros correspondientes. |
| P-08 | Regresión | Las correcciones, si se aprueban, no alteran otras obras ni los movimientos históricos. |

## 6. Instrucción preliminar para Codex

```text
Necesito que analices el módulo de Obras y el módulo de Estados Financieros
(Flujo de caja y Estado de resultados) del proyecto actual.

CONTEXTO:
En una revisión de pantalla se comparan las entradas, salidas y el resumen
por categoría de una obra con las cifras de ingresos de obras e ingresos
totales de los reportes financieros de 2026.

PRIMERA FASE — SOLO DIAGNÓSTICO:
1. Identifica las páginas, componentes, servicios, endpoints y consultas
   que generan los importes de cada una de las tres vistas.
2. Documenta las fórmulas de Entradas, Salidas, Saldo actual, Abono de obra,
   Ingresos de obras, Otros ingresos, Ingresos totales y Total de ingresos.
3. Describe los filtros, las fechas utilizadas y el alcance de cada total.
4. Busca inconsistencias de clasificación, agregación, duplicación, exclusión
   y nomenclatura.
5. Entrega evidencias concretas: rutas de archivo, funciones involucradas,
   consultas pertinentes y ejemplos reproducibles.
6. Propón las correcciones mínimas y las pruebas que deberían acompañarlas.

RESTRICCIONES:
- No modifiques código, base de datos ni registros en esta fase.
- No asumas que el total de una obra debe ser igual al total mensual global.
- No cambies reglas de negocio sin aprobación.
- No elimines funcionalidades ni alteres movimientos históricos.
- Distingue hallazgos comprobados de hipótesis y dudas funcionales.

Al finalizar, presenta el diagnóstico y espera aprobación antes de implementar.
```

## 7. Preguntas puntuales para confirmar con tu jefe

1. ¿Lo que necesitas es **corregir una diferencia de importes**, **cambiar cómo se agrupan las categorías** o **cambiar los nombres de las filas**?
2. ¿Los **Abonos de obra** deben reflejarse en **Ingresos de obras** según la fecha del movimiento y sumados para todas las obras?
3. ¿En el Estado de resultados, la fila **Ingresos totales** debería llamarse **Ingresos de obras**, dejando **Total de ingresos** como la suma final?
4. ¿También debemos revisar **Salidas / Gastos en obras** o únicamente los ingresos?

## 8. Entregable y siguiente paso

El primer entregable recomendable es un **diagnóstico de trazabilidad y conciliación de cifras** con las fórmulas y fuentes de datos existentes. Después de confirmar la indicación verbal, se puede convertir este borrador en una **especificación de implementación definitiva** con cambios y criterios de aceptación aprobados.
