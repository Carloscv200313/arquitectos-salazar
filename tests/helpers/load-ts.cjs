const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
/** Isolated CommonJS loader: no app startup, environment files or network. */
module.exports = function createLoader(root, mocks = {}) {
  const loaded = new Map();
  function load(file) {
    if (Object.hasOwn(mocks, file)) return mocks[file];
    let full = path.isAbsolute(file) ? file : path.join(root, file);
    if (!fs.existsSync(full)) full += '.ts';
    if (loaded.has(full)) return loaded.get(full).exports;
    const module = { exports: {} }; loaded.set(full, module);
    const source = fs.readFileSync(full, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    function requireModule(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === 'server-only') return {};
      if (id.startsWith('@/')) return load(id.slice(2));
      if (id.startsWith('.')) return load(path.resolve(path.dirname(full), id));
      return require(id);
    }
    new Function('require', 'module', 'exports', compiled)(requireModule, module, module.exports);
    return module.exports;
  }
  return load;
};
