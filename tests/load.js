// Carrega os scripts do jogo (que são scripts clássicos de navegador) dentro de um contexto Node.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGame(extra) {
  const ctx = { console, Math, Date, JSON, Set, Map, Uint8Array, Array, Object, String, Number };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const files = ['util.js', 'data.js', 'engine.js'].concat(extra || []);
  for (const f of files) {
    const p = f.includes('/') ? f : path.join(__dirname, '..', 'js', f);
    vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });
  }
  return ctx.FF;
}

module.exports = { loadGame };
