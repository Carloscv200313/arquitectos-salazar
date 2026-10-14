# Recording 34: transcripción y requerimientos

**Fuente:** `Recording #34.mp4`  
**Duración:** 7:05  
**Fecha de análisis:** 14 de octubre de 2026

## Transcripción depurada

### 00:00 - 01:30 · Cuenta de oficina y movimientos de obra

En una obra se registró un movimiento de salida por honorarios dentro de la categoría **Cuenta de oficina**. Aunque el movimiento pertenece a la obra, el importe debe trasladarse al apartado Cuenta de oficina de la misma cuenta bancaria y mostrarse también dentro de **Movimientos internos**.

El dinero no sale de la cuenta bancaria; cambia del saldo normal al saldo de Cuenta de oficina. En Estados financieros, **Ingresos de obras** debe considerar todos los gastos registrados en las obras, incluida Cuenta de oficina. En cambio, **Gastos en Obras** debe sumar los gastos de obra excepto Cuenta de oficina.

### 01:30 - 02:24 · Presentación de Estados financieros

La tabla no debe paginar por separado la columna Concepto y las columnas mensuales, porque esto provoca que los nombres de las filas queden frente a importes que no les corresponden. El reporte debe mostrarse completo y alineado.

También se solicita diferenciar visualmente los bloques de ingresos, costos directos, gastos administrativos y gastos financieros, manteniendo visible el nombre de cada sección.

### 02:24 - 04:24 · Etiquetas dinámicas de Movimientos

Los renglones de gastos administrativos no deben depender de una lista fija de nombres. Las etiquetas configuradas en el módulo de Movimientos deben convertirse dinámicamente en renglones de Estados financieros y acumular los movimientos relacionados.

Los registros de tipo ingreso capturados manualmente deben acumularse en **Otros ingresos**. Las etiquetas de egreso, por ejemplo Gastos de oficina, Proyectos, Servicios y Sueldos, deben aparecer dentro de Gastos administrativos. Los conceptos financieros deben permanecer dentro del bloque de Gastos financieros.

La comisión pagada a arquitectos por proyecto continúa como costo directo y no debe duplicarse dentro de Sueldos.

### 04:24 - 05:24 · Exportación y tamaño del reporte

Se requiere descargar un archivo de Excel que contenga las dos tablas: **Flujo de caja** y **Estado de resultados**. El archivo debe conservar títulos, meses, importes, porcentajes y colores de sección, y estar configurado para impresión horizontal.

En pantalla debe verse el reporte completo, sin una paginación de diez registros que corte la relación entre conceptos e importes.

### 05:24 - 07:05 · Porcentajes e ingresos totales

El Estado de resultados debe mostrar el porcentaje de cada renglón respecto al total de ingresos de su mes. Los porcentajes deben estar disponibles para todos los meses, no únicamente como un dato general al final de la tabla.

**Ingresos totales** debe sumar los ingresos por proyectos y los ingresos de obras. Los ingresos de obras se calculan con todos los egresos registrados dentro de las obras durante el mes. **Costos directos** debe excluir los movimientos de Cuenta de oficina para evitar que ese importe se trate simultáneamente como costo y traslado interno.

## Criterios implementados

1. Los movimientos activos de obra con categoría Cuenta de oficina se interpretan como traslado interno de saldo normal a saldo de oficina dentro de la misma cuenta.
2. El traslado se deriva de los movimientos existentes; no necesita duplicar información ni migrar registros.
3. Ingresos de obras suma todos los egresos activos de obra por mes.
4. Gastos en Obras suma los egresos activos de obra por mes excepto Cuenta de oficina.
5. Las etiquetas activas de Movimientos generan dinámicamente los renglones administrativos y financieros.
6. Sueldos cruza los pagos administrativos del módulo Salario con las capturas manuales que tengan esa etiqueta.
7. Flujo de caja y Estado de resultados se muestran sin paginación interna y con una única correspondencia de filas.
8. Estado de resultados muestra importe y porcentaje para cada mes.
9. La exportación genera un libro `.xlsx` desde los datos del reporte, con una hoja por tabla y configuración de impresión.

## Base de datos

Esta implementación no requiere cambios de esquema ni migración. No se ejecutó ninguna consulta manual ni script contra la base de datos durante el análisis o la implementación.
