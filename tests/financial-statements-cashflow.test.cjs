const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const createLoader = require('./helpers/load-ts.cjs');
const { fixture, database } = require('./helpers/financial-fixture.cjs');

const root = path.resolve(__dirname, '..');

test('el flujo toma todos los pagos de proyectos y solo los abonos de obra', async () => {
  const data = fixture(0, 1);
  const projectPayment = data.project_payments[0];
  data.project_payments = Array.from({ length: 1001 }, (_, index) => ({
    ...projectPayment, id: `income-${index}`, movement_type: 'income',
    payment_date: '2026-01-15', amount: 1,
  }));
  data.project_payments.push({
    ...projectPayment, id: 'expense', movement_type: 'expense',
    payment_date: '2026-01-15', amount: 999,
  });
  const workMovement = data.work_movements[0];
  data.work_movements = [
    { ...workMovement, id: 'work-income', movement_type: 'income', category: 'Abono de obra', movement_date: '2026-01-16', amount: 80 },
    { ...workMovement, id: 'work-expense', movement_type: 'expense', category: 'Abono de obra', movement_date: '2026-01-16', amount: 40 },
    { ...workMovement, id: 'other-income', movement_type: 'income', category: 'Material', movement_date: '2026-01-16', amount: 20 },
  ];

  const db = database(data);
  const load = createLoader(root, {
    react: { cache: (fn) => fn },
    '@/lib/supabase/admin': { ...db, isAdminConfigured: () => true },
    '@/features/auth/get-user': { getCurrentUserId: async () => null, getCurrentAppUser: async () => null },
  });
  const report = await load('lib/data/finance').getCashFlowMonthlyIncomeReport();
  assert.deepEqual(report, {
    projects: [{ month: '2026-01', amount: 1001 }],
    works: [{ month: '2026-01', amount: 80 }],
  });
});

test('cada saldo inicial arrastra el cierre anterior, incluso fuera del rango visible', () => {
  const { calculateCashFlowBalances } = createLoader(root)('lib/financial-statements');
  const result = calculateCashFlowBalances(
    ['2025-12', '2026-01', '2026-02'],
    { '2025-12': 1000, '2026-01': 500, '2026-02': 200 },
    { '2025-12': 100, '2026-01': 50, '2026-02': 10 },
    { '2025-12': 50, '2026-01': 25 },
    { '2025-12': 20, '2026-01': 10 },
    { '2025-12': 30, '2026-01': 5 },
  );
  assert.deepEqual(result.opening, { '2025-12': 0, '2026-01': 800, '2026-02': 1210 });
  assert.deepEqual(result.closing, { '2025-12': 800, '2026-01': 1210, '2026-02': 1400 });
});
