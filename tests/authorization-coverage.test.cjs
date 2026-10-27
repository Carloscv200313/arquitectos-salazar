const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const actions = [
  'app/(dashboard)/projects/actions.ts',
  'app/(dashboard)/obras/actions.ts',
  'app/(dashboard)/pedidos/actions.ts',
  'app/(dashboard)/finance/actions.ts',
  'app/(dashboard)/auditoria/actions.ts',
  'features/users/actions.ts',
  'features/settings/actions.ts',
];

test('todas las Server Actions privadas comprueban permisos antes de validar o escribir', () => {
  let checked = 0;
  for (const file of actions) {
    const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isFunctionDeclaration(statement) || !statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
      const first = statement.body?.statements[0]?.getText(source) ?? '';
      assert.match(first, /^(?:await )?(?:requirePermission|requireAdministrator|requireUser)\(/, `${file}:${statement.name?.text}`);
      checked++;
    }
  }
  assert.ok(checked >= 40);
});
