# Informe de Actividades

**Fecha:** 03/11/2026  
**Proyecto:** Arquitectos Salazar  
**Periodo de trabajos pendientes de reporte:** posteriores al informe del 16/10/2026  
**Responsable:** Carlos Calderón

| N° | CODE | Tarea | Horas estimadas |
|---:|:---:|---|---:|
| 1 | B-01 | Permitir elegir la cuenta de salida al saldar deudas de proveedores. | 1.50 |
| 2 | B-02 | Añadir selección de fechas en Flujo de caja y Estado de resultados. | 1.00 |
| 3 | B-03 | Ajustar la tabla de saldos por cuenta. | 1.00 |
| 4 | B-04 | Corregir la visualización de pagos de proyectos en Salarios. | 1.00 |
| 5 | B-05 | Corregir el empalme de columnas y contenido en las tablas de estados financieros tras el reporte anterior. | 1.00 |
| 6 | B-06 | Permitir corregir y volver a registrar firmas de recibos, dejando registro en auditoría. | 2.50 |
| 7 | B-07 | Ajustar la tabla de deudas de proveedores: filtros por fecha y obra, orden cronológico y vista continua. | 1.50 |
| 8 | B-08 | Restaurar el importe de Cuenta de oficina en la utilidad de cada obra. | 1.00 |
| 9 | B-09 | Eliminar la paginación duplicada de la tabla de Cuenta de oficina. | 0.50 |
| 10 | B-10 | Habilitar la generación de recibos para los movimientos registrados en Finanzas. | 2.00 |
| 11 | B-11 | Implementar la regla de saldos de apertura y fecha de corte para Caja y Bancos; calcular el saldo actual con movimientos posteriores sin alterar el historial. | 3.00 |
| 12 | B-12 | Conciliar el saldo de Efectivo: incorporar el egreso de $20,000 por abono de herrería del 30/10/2026, sin duplicar el movimiento del 31/10/2026. | 1.00 |
| | | **Total estimado** | **17.00** |

**Criterio de inclusión.** Las ocho tarjetas B-01, B-02, B-03, B-04, B-05, B-07, B-09 y B-10 fueron movidas por el cliente de **Subido** a **Entregadas** el 27/10/2026. Las tarjetas B-06 y B-08 siguen en **Subido**. Se comparó el alcance con las once líneas del informe del 16/10/2026 (10.50 horas) para no volver a contar ese trabajo. B-05 corresponde a una corrección posterior de una incidencia nueva, aunque el informe anterior incluyó un ajuste de alineación de Estados financieros.

**Horas.** Estas son estimaciones propuestas a partir del alcance de Trello y los cambios de código; Git y Trello no registran el tiempo real dedicado. Revisar las cifras antes de enviar o facturar. El alcance de B-03 es menos preciso porque la tarjeta no tiene descripción escrita; solo título y capturas.

**Alcance de B-11.** Es un requerimiento adicional indicado por el cliente fuera de las diez tarjetas anteriores. El código quedó preparado en el commit `2b94e42` del 31/10/2026, junto con pruebas y un script SQL de migración. Una consulta de solo lectura del 03/11/2026 confirmó que la tabla de saldos de apertura existe y que Efectivo tiene un corte registrado. La configuración y conciliación de otras cuentas no forma parte de esta verificación.

**Alcance de B-12.** Es una conciliación puntual posterior a B-11, solicitada por el cliente. Una consulta de solo lectura confirmó que el egreso de herrería del viernes estaba asociado a Efectivo y tenía fecha de registro anterior al corte; el egreso del sábado estaba después del corte. Se preparó `db/ajuste-efectivo-abono-herreria-2026-10-30.sql` para revisión y ejecución manual. El usuario ejecutó el script y una verificación posterior de solo lectura confirmó que el saldo de apertura pasó de $66,000 a $46,000 y que ambos movimientos siguieron activos. No se modificó el código de cálculo porque la regla de fecha de corte ya funcionaba como estaba diseñada.

**Evidencia de Trello:**

- [B-01](https://trello.com/c/NwCIxLHU/16-no-deja-saldar-deudas-de-los-proveedores)
- [B-02](https://trello.com/c/El52WjPT/17-seleccionar-fechas-en-los-estados)
- [B-03](https://trello.com/c/jZOkJ6Mx/18-tabla-de-saldos-por-cuenta)
- [B-04](https://trello.com/c/ErGb5s9I/19-no-se-ven-reflejados-los-pagos)
- [B-05](https://trello.com/c/AJgHyqjx/21-se-estan-empalmando-las-tablas)
- [B-06](https://trello.com/c/K9SDJZx7/22-poder-editar-la-firma-en-los-recibos)
- [B-07](https://trello.com/c/2N3DI4HQ/23-corregir-tabla-de-provedores)
- [B-08](https://trello.com/c/3jIA1osK/24-no-sale-la-cantidad-en-la-tabla-de-utilidades)
- [B-09](https://trello.com/c/QlQJmGRT/25-cuenta-de-oficina-tabla)
- [B-10](https://trello.com/c/NHnHxyKc/26-generacion-de-recibo-en-movimientos)

**Referencias técnicas:** `bd8a59c` (fechas y cuenta de salida), `c7d9327` (tablas, proveedores, Cuenta de oficina y recibos), `934ec38` (utilidad de obras), `a952645` (corrección de firmas y auditoría), `2b94e42` (saldos de apertura de Caja y Bancos), `db/ajuste-efectivo-abono-herreria-2026-10-30.sql` (conciliación puntual de Efectivo). Una correspondencia de commit con tarjeta no constituye un registro de horas.
