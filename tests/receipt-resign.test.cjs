const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const createLoader = require('./helpers/load-ts.cjs');
const root = path.resolve(__dirname, '..');
const id = '11111111-1111-4111-8111-111111111111';

function actions({ user, rpc }) {
  const paths = [];
  const permissions = [];
  let calls = 0;
  const load = createLoader(root, {
    '@/lib/security/documents': {},
    '@/lib/data/projects': {},
    '@/lib/data/works': {},
    '@/lib/data/finance': {},
    '@/lib/auth/authorize': { requirePermission: async (permission) => {
      permissions.push(permission);
      if (!user) throw new Error('Sin sesión');
      if (!user.permissions.includes(permission)) throw new Error('Sin permiso');
      return user;
    } },
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async (name, args) => {
      calls++;
      return rpc(name, args);
    } }) },
    'next/cache': { revalidatePath: (value) => paths.push(value) },
  });
  return { action: load('app/recibo/signature-actions').resetReceiptSignatureAction, paths, permissions, getCalls: () => calls };
}

test('enlace público y usuario lector no pueden retirar una firma', async () => {
  for (const user of [null, { id: 'reader', permissions: ['works.view'] }]) {
    const flow = actions({ user, rpc: async () => { throw Error('No debe consultar la base'); } });
    const result = await flow.action({ kind: 'obra', id, reason: 'Se firmó el recibo equivocado', token: 'enlace-publico' });
    assert.equal(result.ok, false);
    assert.equal(flow.getCalls(), 0);
    assert.deepEqual(flow.paths, []);
  }
});

test('motivo inválido se rechaza antes de consultar o modificar', async () => {
  const flow = actions({ user: { id: 'editor', permissions: ['works.edit'] }, rpc: async () => ({ data: true, error: null }) });
  assert.equal((await flow.action({ kind: 'obra', id, reason: 'error' })).ok, false);
  assert.equal(flow.getCalls(), 0);
  assert.deepEqual(flow.paths, []);
});

test('editor de obra retira firma mediante RPC atómica y actualiza ambos enlaces', async () => {
  const calls = [];
  const flow = actions({ user: { id: 'editor', permissions: ['works.edit'] }, rpc: async (name, args) => {
    calls.push({ name, args });
    return { data: true, error: null };
  } });
  const result = await flow.action({ kind: 'obra', id, reason: '  Firma del cliente equivocada  ', token: 'no-autoriza' });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(flow.permissions, ['works.edit']);
  assert.deepEqual(calls, [{ name: 'reset_receipt_signature', args: {
    p_kind: 'obra', p_id: id, p_actor_id: 'editor', p_note: 'Firma del cliente equivocada',
  } }]);
  assert.deepEqual(flow.paths, [`/recibo/obra/${id}`, `/firma/recibo/obra/${id}`]);
});

test('editor de proyectos requiere su propio permiso; un fallo RPC no confirma el retiro', async () => {
  const denied = actions({ user: { id: 'editor', permissions: ['works.edit'] }, rpc: async () => ({ data: true, error: null }) });
  assert.equal((await denied.action({ kind: 'proyecto', id, reason: 'Firma incorrecta en recibo' })).ok, false);
  assert.equal(denied.getCalls(), 0);

  const failed = actions({ user: { id: 'editor', permissions: ['projects.edit'] }, rpc: async () => ({ data: null, error: { code: '23503' } }) });
  assert.equal((await failed.action({ kind: 'proyecto', id, reason: 'Firma incorrecta en recibo' })).ok, false);
  assert.equal(failed.getCalls(), 1);
  assert.deepEqual(failed.paths, []);
});

test('la auditoría muestra el retiro aunque el actor se llame Administrador', async () => {
  const row = {
    id, created_at: '2026-10-27T12:00:00Z', user_name: 'Administrador',
    entity_type: 'work_movement', entity_id: id, record_id: id,
    operation: 'update', description: 'Retiró la firma del recibo para volver a firmar',
    note: 'Firma registrada por error', amount: 25,
    snapshot: { before: { signed: true }, after: { signed: false } },
  };
  const query = {
    select() { return this; },
    not(field) { assert.notEqual(field, 'user_name'); return this; },
    order() { return this; },
    range() { return this; },
    then(ok, bad) { return Promise.resolve({ data: [row], count: 1, error: null }).then(ok, bad); },
  };
  const load = createLoader(root, {
    '@/lib/supabase/admin': { isAdminConfigured: () => true, createAdminClient: () => ({ from: () => query }) },
    '@/features/auth/get-user': { getCurrentAppUser: async () => null },
  });
  const page = await load('lib/data/audit').listAuditPage();
  assert.equal(page.total, 1);
  assert.equal(page.rows[0].userName, 'Administrador');
  assert.equal(page.rows[0].note, 'Firma registrada por error');
});
