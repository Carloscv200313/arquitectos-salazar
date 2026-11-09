const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const createLoader = require('./helpers/load-ts.cjs');
const { fixture, database } = require('./helpers/financial-fixture.cjs');

function loadData(data) {
  const db = database(data);
  return createLoader(path.resolve(__dirname, '..'), {
    react: { cache: (fn) => fn },
    '@/lib/supabase/admin': { ...db, isAdminConfigured: () => true },
    '@/features/auth/get-user': { getCurrentUserId: async () => null, getCurrentAppUser: async () => null },
  });
}

test('los abonos de un pedido muestran primero la fecha más reciente', async () => {
  const data = fixture(2, 0);
  data.work_order_payments.push({
    ...data.work_order_payments[0], id: 'new-payment',
    payment_date: '2026-11-09', created_at: '2026-11-09T12:00:00Z',
  });
  const orders = await loadData(data)('lib/data/orders').listWorkOrders('w1');
  assert.deepEqual(orders.find((order) => order.id === 'o1').payments.map((payment) => payment.id), [
    'new-payment', 'op0',
  ]);
});

test('las semanas de salario muestran primero la más reciente', async () => {
  const data = fixture(0, 0);
  data.salary_weeks.push({
    ...data.salary_weeks[0], id: 'new-week',
    week_start_date: '2026-10-19', week_end_date: '2026-10-25', payment_date: '2026-10-25',
  });
  const report = await loadData(data)('lib/data/finance').getSalaryReport({ year: 2026, month: 10 });
  assert.deepEqual(report.weeks.map((week) => week.id), ['new-week', 'sw']);
});
