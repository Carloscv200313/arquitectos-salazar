const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const createLoader = require('./helpers/load-ts.cjs');
const { fixture, database } = require('./helpers/financial-fixture.cjs');

test('el historial de Efectivo identifica la obra y el proyecto de cada movimiento', async () => {
  const data = fixture(0, 1);
  data.payment_accounts.push({ ...data.payment_accounts[0], id: 'cash', name: 'Efectivo' });
  data.works[0].name = 'Casa de Fulanito';
  data.work_movements[0].payment_method_id = 'cash';
  data.work_movements[0].concept = 'Instalaciones';
  data.work_movements.push({
    ...data.work_movements[0], id: 'latest-work-movement',
    movement_date: '2026-11-09', concept: 'Movimiento reciente',
  });
  data.project_payments[0].payment_method_id = 'cash';
  data.project_payments[0].concept = 'Anticipo';

  const db = database(data);
  const load = createLoader(path.resolve(__dirname, '..'), {
    react: { cache: (fn) => fn },
    '@/lib/supabase/admin': { ...db, isAdminConfigured: () => true },
    '@/features/auth/get-user': { getCurrentUserId: async () => null, getCurrentAppUser: async () => null },
  });
  const report = await load('lib/data/finance').getGeneralBalanceAccountReport('efectivo');

  assert.equal(report.history.find((row) => row.id === 'work-m00000').description, 'Instalaciones');
  assert.equal(report.history.find((row) => row.id === 'work-m00000').origin, 'Casa de Fulanito');
  assert.equal(report.history.find((row) => row.id === 'project-pp1').origin, 'Proyecto sintético');
  assert.equal(report.history[0].id, 'work-latest-work-movement');
});
