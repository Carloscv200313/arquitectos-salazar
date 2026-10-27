const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const createLoader = require('./helpers/load-ts.cjs');
const root = path.resolve(__dirname, '..');

test('Realtime conserva respaldo espaciado y suspende reintentos terminales', () => {
  const {notificationRefreshDelayMs,notificationRequestIsTerminal}=createLoader(root)('components/layout/notification-timing');
  assert.equal(notificationRefreshDelayMs(false,0),60_000);
  assert.equal(notificationRefreshDelayMs(true,0),300_000);
  assert.equal(notificationRefreshDelayMs(false,1),60_000);
  assert.equal(notificationRefreshDelayMs(false,6),300_000);
  for(const status of [401,402,403])assert.equal(notificationRequestIsTerminal(status),true);
  for(const status of [429,500,undefined])assert.equal(notificationRequestIsTerminal(status),false);
});

test('componente mantiene un canal con limpieza, pausa oculta y una solicitud simultánea', () => {
  const source=fs.readFileSync(path.join(root,'components/layout/order-notifications.tsx'),'utf8');
  assert.equal((source.match(/\.channel\(/g)??[]).length,1);
  assert.match(source,/removeChannel\(channel\)/);
  assert.match(source,/controller\?\.abort\(\)/);
  assert.match(source,/inFlight \|\| document\.hidden/);
  assert.doesNotMatch(source,/setInterval\(/);
});
