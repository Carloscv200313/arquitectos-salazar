# Verificacion de ingresos de obras

Fecha: 20/10/2026.
Fuente: WhatsApp Video 2026-10-20 at 4.25.13 PM.mp4.
Alcance: explicacion verbal del video, codigo actual y consultas de solo lectura a la base configurada para el proyecto. No se modificaron registros ni el esquema.

## Lo que pregunta el jefe

Se obtuvo una transcripcion automatica local con Faster Whisper medium en espanol. Los fragmentos relevantes son:

- 00:07-00:28: "Segun yo si se esta llenando bien, que basicamente es la informacion de los gastos de las obras mas la utilidad, que la utilidad aqui se llama cuenta de oficina".
- 00:28-00:44: "No estas tomando en cuenta los abonos, porque esos abonos pues es como saldo de la obra [...] no es directamente este ingreso a los estados financieros".
- 01:04-01:17: pide explicar como se llenan los ingresos de obra y si esa misma informacion alimenta el total mostrado en Estado de resultados.

Esto confirma que la pregunta busca validar la regla existente; no solicita sustituirla por la suma de los abonos de clientes. El documento revision_requerimientos_estados_financieros_2026-10-20.md era un analisis visual preliminar sin esta narracion.

## Resultado

La regla descrita en el audio SI corresponde al calculo implementado:

Ingresos de obras = gastos de obras distintos de Cuenta de oficina + movimientos de gasto de Cuenta de oficina.

La funcion getWorkFinancialMonthlyReport, en lib/data/finance.ts, consulta movimientos activos de tipo expense y los agrupa por movement_date. Cada gasto se cuenta una vez en ingresos de obras. Para la fila Gastos en Obras se excluye Cuenta de oficina. Los movimientos de tipo income, incluidos los abonos de clientes, quedan fuera de esta formula.

## Conciliacion con datos reales

Se leyeron 8,004 movimientos activos de obras, 31 ingresos activos de proyectos y 468 capturas activas de Movimientos, con paginacion para no limitar la comprobacion a los primeros 1,000 registros.

### Enero de 2026, todas las obras

| Concepto | Importe |
|---|---:|
| Gastos en obras, excluyendo Cuenta de oficina | $1,967,802.59 |
| Cuenta de oficina | $87,110.87 |
| Ingresos de obras calculados | $2,054,913.46 |
| Ingresos por proyectos del mes | $0.00 |
| Otros ingresos | $2,500.00 |
| Total de ingresos | $2,057,413.46 |
| Abonos/entradas de clientes en obras, excluidos de la formula anterior | $2,325,527.00 |

Los importes calculados de ingresos de obras y total de ingresos coinciden con los del video.

### Obra Alejandro Lopez Casa, acumulado historico

| Concepto | Importe |
|---|---:|
| Entradas | $5,294,497.97 |
| Salidas | $4,693,209.69 |
| Saldo | $601,288.28 |

Los tres importes coinciden con la pantalla del video. Las entradas corresponden a Abono de obra. Esta vista usa movimientos de una sola obra y no equivale al total mensual de todas las obras.

## Relacion entre ambos reportes

En components/finance/financial-statements-view.tsx:

- Flujo de caja, Ingresos de obras: recibe el calculo anterior.
- Estado de resultados, Ingresos totales: suma ingresos de obras e ingresos por proyectos.
- Estado de resultados, Total de ingresos: suma lo anterior y Otros ingresos.

Por tanto, la misma informacion de obras alimenta ambos reportes, pero Ingresos totales solo coincide exactamente con Ingresos de obras cuando los ingresos por proyectos son cero, como en enero de 2026.

Esta comprobacion valida la formula concreta consultada en el video. No se cambiaron calculos de la aplicacion.
