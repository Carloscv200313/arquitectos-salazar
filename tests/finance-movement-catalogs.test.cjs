const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const createLoader = require('./helpers/load-ts.cjs');
const { fixture, database } = require('./helpers/financial-fixture.cjs');

const root = path.resolve(__dirname, '..');

test('los filtros de movimientos exponen solo etiquetas y conceptos del catálogo', async () => {
  const data = fixture(0, 1);
  data.finance_movement_tags = [{
    id: 'tag-office', name: 'Gastos de oficina', status: 1,
    created_at: '2026-11-01T12:00:00Z', created_by: null,
  }];
  data.finance_movement_concepts = [{
    id: 'concept-paper', name: 'Papelería', tag_id: 'tag-office',
    tag: data.finance_movement_tags[0], status: 1,
    created_at: '2026-11-01T12:00:00Z', created_by: null,
  }];
  data.work_movements[0].concept = 'Instalación de ventanas';
  data.work_movements[0].category = 'Herrería';

  const db = database(data);
  const load = createLoader(root, {
    react: { cache: (fn) => fn },
    '@/lib/supabase/admin': { ...db, isAdminConfigured: () => true },
    '@/features/auth/get-user': { getCurrentUserId: async () => null, getCurrentAppUser: async () => null },
  });
  const report = await load('lib/data/finance').getConsolidatedFinanceMovementReport();

  assert.deepEqual(report.tags.map((row) => row.name), ['Gastos de oficina']);
  assert.deepEqual(report.concepts.map((row) => row.name), ['Papelería']);
  assert.ok(report.rows.some((row) => row.concept?.name === 'Instalación de ventanas'));
});
