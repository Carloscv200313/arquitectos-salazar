const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const createLoader = require('./helpers/load-ts.cjs');

const root = path.resolve(__dirname, '..');

function loadDebtPage(providerDetail) {
  const permissions = [];
  const load = createLoader(root, {
    '@/lib/auth/authorize': { requirePermission: async (permission) => permissions.push(permission) },
    '@/lib/data/finance': {
      getGeneralBalanceAccountReport: async () => null,
      getManualDebtorDetail: async () => null,
      getProviderDebtDetail: async () => providerDetail,
    },
    '@/lib/data/projects': { listPaymentMethods: async () => [] },
    '@/components/finance/balance-account-detail': { BalanceAccountDetail: () => null },
    '@/components/finance/debtor-debt-detail': { DebtorDebtDetail: () => null },
    '@/components/finance/provider-debt-detail': { ProviderDebtDetail: () => null },
    'next/link': () => null,
    'lucide-react': { ArrowLeft: () => null },
    'next/navigation': {
      redirect: (destination) => { throw Object.assign(new Error('redirect'), { destination }); },
      notFound: () => { throw new Error('not-found'); },
    },
  });
  return { page: load('app/(dashboard)/finance/[module]/[account]/page.tsx').default, permissions };
}

test('la ficha del proveedor saldado regresa a deudas sin mostrar 404', async () => {
  const { page, permissions } = loadDebtPage(null);
  await assert.rejects(
    page({ params: Promise.resolve({ module: 'deudas', account: 'Materiales' }) }),
    (error) => error.destination === '/finance/deudas',
  );
  assert.deepEqual(permissions, ['finance.view']);
});

test('la ficha de un proveedor con deuda pendiente sigue visible', async () => {
  const { page } = loadDebtPage({ provider: 'Materiales' });
  const view = await page({ params: Promise.resolve({ module: 'deudas', account: 'Materiales' }) });
  assert.equal(view.type, 'div');
});
