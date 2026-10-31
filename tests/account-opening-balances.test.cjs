const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const createLoader = require('./helpers/load-ts.cjs');
const { fixture, database } = require('./helpers/financial-fixture.cjs');

const root = path.resolve(__dirname, '..');
const cutoff = '2026-10-31T08:00:00Z';
const before = '2026-10-30T12:00:00Z';
const after = '2026-10-31T09:00:00Z';

function loadFinance(data, { openingTableMissing = false } = {}) {
  const db = database(data);
  const originalClient = db.createAdminClient;
  const admin = openingTableMissing
    ? { ...db, createAdminClient: () => ({
        from(table) {
          if (table === 'account_balance_openings') return {
            select() { return this; },
            limit() { return Promise.resolve({ data: null, error: { code: 'PGRST205' } }); },
          };
          return originalClient().from(table);
        },
      }), isAdminConfigured: () => true }
    : { ...db, isAdminConfigured: () => true };
  const memo = (fn) => {
    const values = new Map();
    return (...args) => {
      const key = JSON.stringify(args);
      if (!values.has(key)) values.set(key, fn(...args));
      return values.get(key);
    };
  };
  const load = createLoader(root, {
    react: { cache: memo },
    '@/lib/supabase/admin': admin,
    '@/features/auth/get-user': { getCurrentUserId: async () => null, getCurrentAppUser: async () => null },
  });
  return { finance: load('lib/data/finance'), metrics: db.metrics };
}

test('desplegar el código antes de crear la tabla conserva los saldos existentes', async () => {
  const data = fixture(2, 3);
  const withoutOpening = await loadFinance(data).finance.getGeneralBalanceReport();
  const missingTable = await loadFinance(data, { openingTableMissing: true }).finance.getGeneralBalanceReport();
  assert.deepEqual(missingTable, withoutOpening);
});

test('cinco saldos de apertura ignoran registros previos y suman solo los posteriores', async () => {
  const data = fixture(0, 1);
  const base = { status: 1, created_at: before };
  data.payment_accounts.push(
    { ...base, id: 'a3', name: 'Efectivo' },
    { ...base, id: 'a4', name: 'Cuenta de Silvia' },
    { ...base, id: 'a5', name: 'Cuenta fiscal' },
  );
  data.account_balance_openings = [
    ['a0', 100], ['a1', 0], ['a3', 200], ['a4', 30.25], ['a5', 400.50],
  ].map(([account_id, opening_amount]) => ({ account_id, opening_amount, cutoff_at: cutoff }));
  data.project_payments.push({ ...data.project_payments[0], id: 'new-project-income', amount: 12.50, created_at: after });
  data.work_movements.push({ ...data.work_movements[0], id: 'new-work-income', amount: 3.25, category: 'Material', created_at: after });
  data.finance_movement_captures.push({ ...data.finance_movement_captures[0], id: 'new-capture', amount: 4.25, movement_type: 'expense', created_at: after });
  data.internal_transfers.push({ ...data.internal_transfers[0], id: 'new-transfer', amount: 6, created_at: after });
  data.general_balance_account_movements.push(
    { ...base, id: 'old-manual', account_id: 'caja', movement_type: 'expense', movement_date: '2026-10-30', description: 'Registro anterior', amount: 1000 },
    { ...base, id: 'new-manual', account_id: 'caja', movement_type: 'income', movement_date: '2026-10-31', description: 'Registro posterior', amount: 5.75, created_at: after },
  );

  const unchangedData = { ...data, account_balance_openings: [] };
  const old = loadFinance(unchangedData);
  const current = loadFinance(data);
  const [oldUtilities, oldDebts, currentUtilities, currentDebts, report] = await Promise.all([
    old.finance.getFinanceUtilityReport(), old.finance.getDebtReport(),
    current.finance.getFinanceUtilityReport(), current.finance.getDebtReport(),
    current.finance.getGeneralBalanceReport(),
  ]);
  const byName = new Map(report.rows.map((row) => [row.label, row.amount]));
  assert.equal(byName.get('Caja'), 111.25);
  assert.equal(byName.get('Cuenta de Rosa'), 6);
  assert.equal(byName.get('Efectivo'), 200);
  assert.equal(byName.get('Cuenta de Silvia'), 30.25);
  assert.equal(byName.get('Cuenta fiscal'), 400.50);
  const { cashAndBankTotal } = createLoader(root)('lib/overview');
  assert.equal(cashAndBankTotal(report.rows), 748);
  assert.notEqual(report.total, cashAndBankTotal(report.rows));
  assert.deepEqual(currentUtilities, oldUtilities);
  assert.deepEqual(currentDebts, oldDebts);

  const detailData = { ...data,
    work_movements: [], project_payments: [], internal_transfers: [],
    manual_debtors: [], manual_debtor_payments: [],
    provider_debt_settlements: [], manual_provider_debt_payments: [],
  };
  const detail = await loadFinance(detailData).finance.getGeneralBalanceAccountReport('caja');
  assert.equal(detail.opening.amount, 100);
  assert.equal(detail.opening.cutoffAt, cutoff);
  assert.ok(detail.history.some((row) => row.id === 'account-movement-old-manual'));
  assert.ok(detail.history.some((row) => row.id === 'account-movement-new-manual'));
  assert.equal(current.metrics.tables.account_balance_openings, 1);
});
