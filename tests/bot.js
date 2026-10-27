/*
 * Bots de teste. Funciona no Node (via tests/load.js) e no navegador (injetado pelo teste e2e).
 * O bot "tatico" simula cada ação possível numa cópia do estado (o motor é determinístico)
 * e escolhe a de melhor avaliação, olhando duas rodadas à frente.
 */
(function (root) {
  'use strict';
  const FF = root.FF;
  const E = FF.engine;
  const clone = (S) => JSON.parse(JSON.stringify(S));

  function simulate(S, a) {
    const C = clone(S);
    const r = E.act(C, a);
    if (!r.ok) return null;
    if (!r.free && C.phase === 'play') E.runEnemyPhase(C);
    return C;
  }

  function enemyHp(S) {
    let n = 0;
    for (const u of S.units) n += u.hp;
    return n;
  }

  function walkDistance(S) {
    const W = FF.data.W;
    const H = FF.data.H;
    const p = S.player;
    const targets = new Set(S.units.map((u) => u.x + ',' + u.y));
    if (!targets.size) return 99;
    const seen = new Set([p.x + ',' + p.y]);
    let frontier = [[p.x, p.y]];
    for (let d = 1; d < 30 && frontier.length; d++) {
      const next = [];
      for (const [x, y] of frontier)
        for (const [dx, dy] of FF.util.DIRS) {
          const nx = x + dx;
          const ny = y + dy;
          const k = nx + ',' + ny;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k)) continue;
          if (targets.has(k)) return d;
          if (!E.isPassable(S, nx, ny)) continue;
          seen.add(k);
          next.push([nx, ny]);
        }
      frontier = next;
    }
    return 99;
  }

  function evaluate(S0, C) {
    if (C.phase === 'dead') return -1e6;
    if (C.phase === 'cross' || C.phase === 'won') return 1e5 + C.player.hp * 100;
    const p = C.player;
    let v = 0;
    v += p.hp * 60;
    v -= enemyHp(C) * 12;
    v -= C.units.length * 10;
    v += C.st.killScore * 0.5;
    // Perigo anunciado: o que pesa é o perigo do qual não dá para fugir no próximo passo.
    const tmap = {};
    for (const t of E.threats(C)) tmap[t.x + ',' + t.y] = (tmap[t.x + ',' + t.y] || 0) + t.dmg;
    const here = tmap[p.x + ',' + p.y] || 0;
    let escape = here;
    for (const [dx, dy] of FF.util.DIRS) {
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (E.isPassable(C, nx, ny) && !E.unitAt(C, nx, ny)) escape = Math.min(escape, tmap[nx + ',' + ny] || 0);
    }
    v -= escape * 45 + here * 6;
    // Mobilidade: casas livres ao redor para escapar.
    let free = 0;
    for (const a of E.legalActions(C)) if (a.k === 'move') free++;
    v += free * 3;
    // Aproximação moderada pelo caminho real: nem colado em todos, nem longe demais.
    const nearest = walkDistance(C);
    if (nearest < 99) v -= Math.max(0, nearest - 1) * (C.turn > 40 ? 12 : 4);
    v -= C.turn * 0.5;
    if (p.cd === 0) v += 6;
    if (C.fire[E.idx(p.x, p.y)] > 0 && !p.fireproof && !p.polvora) v -= 30;
    return v;
  }

  function tacticalAction(S, depth) {
    depth = depth || 2;
    const acts = E.legalActions(S);
    let best = null;
    let bv = -Infinity;
    const scored = [];
    for (const a of acts) {
      const C = simulate(S, a);
      if (!C) continue;
      scored.push({ a, C, v: evaluate(S, C) });
    }
    scored.sort((x, y) => y.v - x.v);
    for (const s of scored.slice(0, depth > 1 ? 5 : scored.length)) {
      let v = s.v;
      if (depth > 1 && s.C.phase === 'play') {
        let b2 = -Infinity;
        for (const a2 of E.legalActions(s.C)) {
          const C2 = simulate(s.C, a2);
          if (!C2) continue;
          b2 = Math.max(b2, evaluate(s.C, C2));
        }
        if (b2 > -Infinity) v = s.v * 0.4 + b2 * 0.6;
      }
      if (v > bv) {
        bv = v;
        best = s.a;
      }
    }
    return best || { k: 'wait' };
  }

  function randomAction(S, rng) {
    const acts = E.legalActions(S);
    return acts[Math.floor(rng() * acts.length)];
  }

  // Preferência de dádivas do bot: simples, para medir equilíbrio.
  const BOON_PRIORITY = ['ferro', 'ori', 'oya', 'oxe', 'guia', 'ponta', 'patua', 'abebe', 'defumacao', 'ponto', 'vento', 'ginga', 'pedreira', 'brasa', 'ancestrais', 'polvora'];

  function chooseBoon(S, rng) {
    const p = S.player;
    if (p.hp <= 2 && p.hp < p.maxHp) return 'rest';
    if (rng) {
      const opts = S.offer.concat(p.hp < p.maxHp - 1 ? ['rest'] : []);
      return opts[Math.floor(rng() * opts.length)];
    }
    let best = S.offer[0];
    for (const id of S.offer) if (BOON_PRIORITY.indexOf(id) < BOON_PRIORITY.indexOf(best)) best = id;
    return best;
  }

  FF.bot = { tacticalAction, randomAction, chooseBoon, simulate, evaluate };
})(typeof window !== 'undefined' ? window : globalThis);
