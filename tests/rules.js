/*
 * Testes de regras do motor: cada mecânica em uma situação montada à mão.
 *   node tests/rules.js
 */
const { loadGame } = require('./load');
const FF = loadGame(['save.js']);
const E = FF.engine;
const D = FF.data;

let passed = 0;
const fails = [];
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    fails.push(name + ': ' + e.message);
  }
}
function eq(a, b, m) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' esperado ' + JSON.stringify(b) + ', veio ' + JSON.stringify(a));
}
function ok(c, m) {
  if (!c) throw new Error(m || 'condição falsa');
}

// Terreiro vazio e controlado: chão livre, sem ondas pendentes.
function arena(hero, opts) {
  const S = E.newRun({ hero: hero || 'ogum', seed: 'teste', provas: (opts && opts.provas) || [] });
  S.map = new Array(81).fill(E.FLOOR);
  S.fire = new Array(81).fill(0);
  S.units = [];
  S.portals = [];
  S.waves = [['kiumba'], ['kiumba']];
  S.waveIdx = 2;
  S.player.x = 4;
  S.player.y = 4;
  return S;
}
function unit(S, type, x, y, extra) {
  const E0 = D.ENEMIES[type];
  const u = Object.assign({ id: S.nextId++, type, x, y, hp: E0.hp, maxHp: E0.hp, intent: null, stun: 0, burn: 0, cd: 0 }, extra || {});
  S.units.push(u);
  return u;
}
const alive = (S, u) => S.units.includes(u);
const UP = 0;
const RIGHT = 1;
const DOWN = 2;
const LEFT = 3;

test('andar contra inimigo golpeia sem sair do lugar', () => {
  const S = arena('oxossi');
  const k = unit(S, 'kiumba', 4, 3);
  unit(S, 'kiumba', 0, 0);
  E.act(S, { k: 'move', dir: UP });
  ok(!alive(S, k), 'kiumba morre');
  eq([S.player.x, S.player.y], [4, 4]);
});

test('passiva de Oxóssi atravessa o alvo', () => {
  const S = arena('oxossi');
  const a = unit(S, 'zombeteiro', 4, 3);
  const b = unit(S, 'zombeteiro', 4, 2);
  E.act(S, { k: 'move', dir: UP });
  eq([a.hp, b.hp], [1, 1]);
});

test('empurrão de Ogum no rio afoga', () => {
  const S = arena('ogum');
  S.map[E.idx(4, 2)] = E.WATER;
  const z = unit(S, 'zombeteiro', 4, 3);
  E.act(S, { k: 'move', dir: UP });
  ok(!alive(S, z), 'levado pela correnteza');
  eq(S.st.drowned, 1);
});

test('empurrão contra pedra causa batida', () => {
  const S = arena('ogum');
  S.map[E.idx(4, 2)] = E.WALL;
  const o = unit(S, 'oran', 4, 3);
  E.act(S, { k: 'move', dir: UP });
  eq(o.hp, 1, 'golpe 1 + batida 1');
});

test('empurrão contra outra criatura fere as duas', () => {
  const S = arena('ogum');
  const a = unit(S, 'oran', 4, 3);
  const b = unit(S, 'oran', 4, 2);
  E.act(S, { k: 'move', dir: UP });
  eq([a.hp, b.hp], [1, 2]);
});

test('Ègbà não pode ser empurrado', () => {
  const S = arena('ogum');
  const g = unit(S, 'egba', 4, 3);
  E.act(S, { k: 'move', dir: UP });
  eq([g.x, g.y, g.hp], [4, 3, 5]);
});

test('inimigo prepara golpe e erra se o jogador sai da casa', () => {
  const S = arena('oxossi');
  const k = unit(S, 'kiumba', 4, 2);
  E.act(S, { k: 'wait' });
  E.runEnemyPhase(S);
  ok(k.intent && k.intent.k === 'melee', 'preparou golpe');
  E.act(S, { k: 'move', dir: LEFT });
  const ev = E.runEnemyPhase(S);
  ok(ev.some((e) => e.t === 'miss'), 'errou');
  eq(S.player.hp, S.player.maxHp);
});

test('fogo amigo: tiro de Òfò acerta o kiumba no caminho', () => {
  const S = arena('oxossi');
  const o = unit(S, 'ofo', 4, 0, { intent: { k: 'line', dir: DOWN, dmg: 1, range: 6, aim: true } });
  const k = unit(S, 'kiumba', 4, 2);
  // O kiumba está entre os dois: o tiro para nele.
  E.act(S, { k: 'wait' });
  const ev = E.runEnemyPhase(S);
  ok(!alive(S, k), 'kiumba atingido');
  eq(S.player.hp, S.player.maxHp, 'jogador protegido');
  ok(ev.some((e) => e.t === 'die' && e.cause === 'enemy'), 'conta como fogo amigo');
  ok(alive(S, o));
});

test('golpe preparado segue a direção depois de um empurrão', () => {
  const S = arena('ogum');
  const z = unit(S, 'oran', 4, 3, { intent: { k: 'melee', dir: LEFT, dmg: 1, aim: true } });
  const k = unit(S, 'kiumba', 3, 2);
  E.act(S, { k: 'move', dir: UP }); // Òràn vai para (4,2) e continua mirando a esquerda: (3,2)
  eq([z.x, z.y], [4, 2]);
  E.runEnemyPhase(S);
  ok(!alive(S, k), 'o golpe deslocado acertou o kiumba');
});

test('Guia de Proteção bloqueia o primeiro dano do terreiro', () => {
  const S = arena('oxossi');
  E.applyBoon(S, 'guia');
  unit(S, 'kiumba', 4, 3, { intent: { k: 'melee', dir: DOWN, dmg: 1, aim: true } });
  unit(S, 'kiumba', 5, 4, { intent: { k: 'melee', dir: LEFT, dmg: 1, aim: true } });
  E.act(S, { k: 'wait' });
  E.runEnemyPhase(S);
  eq(S.player.hp, S.player.maxHp - 1, 'um bloqueado, outro passou');
});

test('Abebé devolve 1 de dano a quem fere', () => {
  const S = arena('oxossi');
  E.applyBoon(S, 'abebe');
  const z = unit(S, 'zombeteiro', 4, 3, { intent: { k: 'melee', dir: DOWN, dmg: 1, aim: true } });
  E.act(S, { k: 'wait' });
  E.runEnemyPhase(S);
  eq(z.hp, 1);
});

test('Ginga deixa tonto quem erra', () => {
  const S = arena('oxossi');
  E.applyBoon(S, 'ginga');
  const k = unit(S, 'zombeteiro', 4, 3, { intent: { k: 'melee', dir: DOWN, dmg: 1, aim: true } });
  E.act(S, { k: 'move', dir: RIGHT });
  E.runEnemyPhase(S);
  eq(k.stun, 1);
});

test('Ligeireza de Oyá devolve a ação uma vez por rodada', () => {
  const S = arena('oxossi');
  E.applyBoon(S, 'oya');
  unit(S, 'kiumba', 4, 3);
  unit(S, 'kiumba', 3, 4);
  unit(S, 'kiumba', 0, 0);
  const r1 = E.act(S, { k: 'move', dir: UP });
  ok(r1.free, 'primeira morte é grátis');
  const r2 = E.act(S, { k: 'move', dir: LEFT });
  ok(!r2.free, 'segunda na mesma rodada não');
});

test('fogo fere quem termina o turno nele; Xangô é imune', () => {
  const S = arena('oxossi');
  S.fire[E.idx(4, 4)] = 2;
  unit(S, 'kiumba', 0, 0);
  E.act(S, { k: 'wait' });
  E.runEnemyPhase(S);
  eq(S.player.hp, S.player.maxHp - 1);
  const X = arena('xango');
  X.fire[E.idx(4, 4)] = 2;
  unit(X, 'kiumba', 0, 0);
  E.act(X, { k: 'wait' });
  E.runEnemyPhase(X);
  eq(X.player.hp, X.player.maxHp);
});

test('maldição de Èpè em X: passo reto escapa', () => {
  const S = arena('oxossi');
  const u = unit(S, 'epe', 4, 0, { intent: { k: 'aoe', x: 4, y: 4, dmg: 1, aim: true } });
  const tiles = E.intentTiles(S, u).map((t) => t.join(','));
  ok(tiles.includes('4,4') && tiles.includes('3,3') && tiles.includes('5,5'), 'centro e diagonais');
  for (const t of ['4,3', '5,4', '4,5', '3,4']) ok(!tiles.includes(t), 'casa vizinha ' + t + ' é segura');
});

test('golpe de Ègbà varre 3 casas e só recuar escapa', () => {
  const S = arena('oxossi');
  const g = unit(S, 'egba', 4, 3, { intent: { k: 'sweep', dir: DOWN, dmg: 2, aim: true } });
  eq(E.intentTiles(S, g).map((t) => t.join(',')).sort(), ['3,4', '4,4', '5,4']);
  E.act(S, { k: 'move', dir: DOWN });
  E.runEnemyPhase(S);
  eq(S.player.hp, S.player.maxHp, 'recuou e escapou');
  eq(g.stun, 2, 'ficou preso');
});

test('Àrùn não faz nascer kiumba se o jogador ocupa a casa', () => {
  const S = arena('oxossi');
  S.player.x = 4;
  S.player.y = 3;
  const a = unit(S, 'arun', 4, 2, { intent: { k: 'summon', dir: DOWN, dmg: 0 } });
  E.act(S, { k: 'wait' });
  E.runEnemyPhase(S);
  eq(S.units.length, 1);
  ok(alive(S, a));
});

test('ondas: portais aparecem ao limpar e viram criaturas na rodada seguinte', () => {
  const S = arena('oxossi');
  S.waveIdx = 1;
  E.act(S, { k: 'wait' });
  E.runEnemyPhase(S);
  eq(S.portals.length, 1, 'portal anunciado');
  eq(S.units.length, 0);
  E.act(S, { k: 'wait' });
  E.runEnemyPhase(S);
  eq(S.portals.length, 0);
  eq(S.units.length, 1, 'criatura surgiu');
});

test('limpar a última onda fecha o terreiro e abre a encruzilhada', () => {
  const S = arena('oxossi');
  unit(S, 'kiumba', 4, 3);
  const r = E.act(S, { k: 'move', dir: UP });
  eq(S.phase, 'cross');
  eq(S.offer.length, 3);
  ok(r.events.some((e) => e.t === 'clear'));
  ok(E.choose(S, 'rest'));
  eq(S.stageIdx, 1);
  eq(S.phase, 'play');
});

test('habilidades: Flecha Certeira acerta o primeiro da linha', () => {
  const S = arena('oxossi');
  const a = unit(S, 'oran', 4, 1);
  const b = unit(S, 'oran', 4, 0);
  E.act(S, { k: 'ability', dir: UP });
  eq([a.hp, b.hp], [1, 3]);
  ok(S.player.cd > 0, 'recarga iniciada');
  ok(!E.act(S, { k: 'ability', dir: UP }).ok, 'não usa em recarga');
});

test('habilidades: Abre-Caminho avança e arremessa', () => {
  const S = arena('ogum');
  const o = unit(S, 'oran', 4, 1);
  E.act(S, { k: 'ability', dir: UP });
  eq([S.player.x, S.player.y], [4, 2]);
  eq([o.x, o.y, o.hp], [4, 0, 1], '1 de dano + batida na borda');
});

test('habilidades: Pedra de Raio fere em cruz e deixa fogo', () => {
  const S = arena('xango');
  const a = unit(S, 'zombeteiro', 4, 2);
  const b = unit(S, 'zombeteiro', 5, 2);
  E.act(S, { k: 'ability', x: 4, y: 2 });
  eq([a.hp, b.hp], [1, 1]);
  ok(S.fire[E.idx(4, 2)] > 0 && S.fire[E.idx(3, 2)] > 0);
  ok(!E.act(S, { k: 'ability', x: 0, y: 0 }).ok, 'fora do alcance');
});

test('habilidades: Ventania empurra as 8 vizinhas', () => {
  const S = arena('iansa');
  const a = unit(S, 'oran', 3, 3);
  const b = unit(S, 'oran', 5, 4);
  E.act(S, { k: 'ability' });
  eq([a.x, a.y], [1, 1]);
  eq([b.x, b.y], [7, 4]);
});

test('Ikú: travessia, atordoamento e dano dobrado uma vez', () => {
  const S = arena('oxossi');
  S.waves = [['iku']];
  S.waveIdx = 1;
  const iku = unit(S, 'iku', 4, 0, { pat: 0, bphase: 1, exposed: false });
  E.act(S, { k: 'wait' });
  E.runEnemyPhase(S);
  ok(iku.intent && iku.intent.k === 'charge', 'preparou a travessia');
  // Sai da faixa.
  const vertical = iku.x === S.player.x;
  E.act(S, { k: 'move', dir: vertical ? RIGHT : DOWN });
  E.runEnemyPhase(S);
  ok(iku.exposed && iku.stun > 0, 'atordoada');
  const hp = iku.hp;
  // Garante um golpe: coloca Ikú ao lado.
  iku.x = S.player.x;
  iku.y = S.player.y - 1;
  E.act(S, { k: 'move', dir: UP });
  eq(iku.hp, hp - 2, 'dobrou');
  ok(!iku.exposed, 'só o primeiro golpe dobra');
});

test('derrotar Ikú dispersa os kiumbas e vence a jornada', () => {
  const S = arena('oxossi');
  S.stageIdx = 5;
  S.waves = [['iku']];
  S.waveIdx = 1;
  unit(S, 'iku', 4, 3, { hp: 1, pat: 0, bphase: 3 });
  unit(S, 'kiumba', 0, 0);
  E.act(S, { k: 'move', dir: UP });
  eq(S.phase, 'won');
  ok(S.final && S.final.total > 0);
});

test('sentença de Ikú sempre deixa uma saída', () => {
  let checked = 0;
  for (let i = 0; i < 200; i++) {
    const S = arena('oxossi');
    S.rng = i * 7919;
    S.player.x = 1 + (i % 7);
    S.player.y = 1 + ((i * 3) % 7);
    const iku = unit(S, 'iku', 8, 8, { hp: 5, maxHp: 20, pat: 1, bphase: 3 });
    E.act(S, { k: 'wait' });
    E.runEnemyPhase(S);
    if (!iku.intent || iku.intent.k !== 'multi') continue;
    const hit = new Set(E.intentTiles(S, iku).map((t) => t.join(',')));
    const p = S.player;
    const exits = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [p.x + dx, p.y + dy]).filter(([x, y]) => E.isPassable(S, x, y) && !E.unitAt(S, x, y));
    ok(exits.some(([x, y]) => !hit.has(x + ',' + y)), 'sem saída na tentativa ' + i);
    checked++;
  }
  ok(checked > 50, 'poucas sentenças testadas: ' + checked);
});

test('último atirador do terreiro não foge', () => {
  const S = arena('oxossi');
  const e = unit(S, 'epe', 4, 2);
  E.act(S, { k: 'wait' });
  E.runEnemyPhase(S);
  ok(Math.abs(e.x - 4) + Math.abs(e.y - 4) <= 2, 'Èpè sozinha se aproxima ou fica');
  const T = arena('oxossi');
  const f = unit(T, 'epe', 4, 2);
  unit(T, 'kiumba', 0, 0);
  E.act(T, { k: 'wait' });
  E.runEnemyPhase(T);
  ok(Math.abs(f.x - 4) + Math.abs(f.y - 4) >= 2, 'com aliados ela mantém distância');
});

test('mapas: todo o chão é alcançável sem atravessar espinhos ou rio', () => {
  for (let i = 0; i < 150; i++) {
    const S = E.newRun({ hero: 'ogum', seed: 'mapa' + i });
    E.jumpToStage(S, i % 6);
    const seen = new Set(['4,7']);
    const q = [[4, 7]];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;
        const k = nx + ',' + ny;
        if (!E.inb(nx, ny) || seen.has(k) || E.tileAt(S, nx, ny) !== E.FLOOR) continue;
        seen.add(k);
        q.push([nx, ny]);
      }
    }
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (E.tileAt(S, x, y) === E.FLOOR) ok(seen.has(x + ',' + y), 'casa isolada ' + x + ',' + y + ' na semente mapa' + i);
    for (const u of S.units) ok(seen.has(u.x + ',' + u.y), 'inimigo inalcançável');
  }
});

test('mesma semente gera o mesmo terreiro', () => {
  const a = E.newRun({ hero: 'ogum', seed: 'igual' });
  const b = E.newRun({ hero: 'xango', seed: 'igual' });
  eq(a.map, b.map);
  eq(a.units.map((u) => [u.type, u.x, u.y]), b.units.map((u) => [u.type, u.x, u.y]));
});

test('estado salvo no meio do terreiro continua idêntico', () => {
  const S = E.newRun({ hero: 'ogum', seed: 'meio' });
  for (let i = 0; i < 5; i++) {
    E.act(S, { k: 'wait' });
    E.runEnemyPhase(S);
  }
  const C = JSON.parse(JSON.stringify(S));
  for (const X of [S, C]) {
    E.act(X, { k: 'move', dir: UP });
    E.runEnemyPhase(X);
  }
  eq(C, S);
});

test('salvamento: dados corrompidos ou antigos viram padrões seguros', () => {
  const SV = FF.save;
  const d = SV.sanitize({ v: 0, settings: { sfx: 'alto', music: 9 }, heroes: { ogum: { best: -5, bestRank: 'Z' } }, marks: { inexistente: true, iku: true }, run: { v: 1, hero: 'ogum' } });
  eq(d.settings.sfx, 0.7);
  eq(d.settings.music, 1);
  eq(d.heroes.ogum.best, 0);
  eq(d.heroes.ogum.bestRank, '');
  eq(Object.keys(d.marks), ['iku']);
  eq(d.run, null, 'jornada inválida descartada');
  eq(SV.sanitize(null).v, 1);
  eq(SV.sanitize('lixo').stats.runs, 0);
  const S = E.newRun({ hero: 'oxossi', seed: 'v' });
  ok(SV.validRun(JSON.parse(JSON.stringify(S))), 'jornada real é válida');
});

test('provações mudam as regras', () => {
  const frag = E.newRun({ hero: 'ogum', seed: 'p', provas: ['fragil'] });
  eq(frag.player.maxHp, D.HEROES.ogum.hp - 1);
  const horda = E.newRun({ hero: 'ogum', seed: 'p', provas: ['horda'] });
  const normal = E.newRun({ hero: 'ogum', seed: 'p' });
  eq(horda.units.length, normal.units.length + 1);
  const couro = E.newRun({ hero: 'ogum', seed: 'p', provas: ['couro'] });
  eq(couro.units[0].maxHp, normal.units[0].maxHp + 1);
  ok(E.provaMult(couro) > 1);
});

console.log(passed + ' testes de regras passaram');
if (fails.length) {
  console.error('\nFALHAS:\n- ' + fails.join('\n- '));
  process.exit(1);
}
