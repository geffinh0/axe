/*
 * Motor de regras. Não toca em DOM: recebe ações, altera o estado e devolve eventos
 * que a interface anima. O estado é JSON puro (inclusive o RNG), então pode ser salvo
 * a qualquer momento e simulado em massa pelos testes.
 */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const U = FF.util;
  const D = FF.data;
  const W = D.W;
  const H = D.H;
  const DIRS = U.DIRS;

  const FLOOR = 0;
  const WALL = 1;
  const WATER = 2;
  const THORN = 3;
  const START = { x: 4, y: 7 };

  const idx = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const rnd = (S) => U.rngNext(S);
  const rint = (S, n) => Math.floor(U.rngNext(S) * n);

  function tileAt(S, x, y) {
    return inb(x, y) ? S.map[idx(x, y)] : WALL;
  }
  function isPassable(S, x, y) {
    const t = tileAt(S, x, y);
    return t === FLOOR || t === THORN;
  }
  function unitAt(S, x, y) {
    for (const u of S.units) if (u.x === x && u.y === y) return u;
    return null;
  }
  function occupant(S, x, y) {
    if (S.player.x === x && S.player.y === y) return S.player;
    return unitAt(S, x, y);
  }
  function isFree(S, x, y) {
    return isPassable(S, x, y) && !occupant(S, x, y);
  }
  function getUnit(S, id) {
    for (const u of S.units) if (u.id === id) return u;
    return null;
  }
  function hazard(S, x, y) {
    return (tileAt(S, x, y) === THORN ? 1 : 0) + (S.fire[idx(x, y)] > 0 ? 1 : 0);
  }
  function spec(u) {
    return D.ENEMIES[u.type];
  }

  /* ---------------------------------------------------------------- jornada */

  function newRun(opts) {
    const hero = D.HEROES[opts.hero] || D.HEROES.ogum;
    const provas = (opts.provas || []).filter((p) => D.PROVACOES[p]);
    const seed = String(opts.seed || Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36));
    const maxHp = Math.max(2, hero.hp - (provas.includes('fragil') ? 1 : 0));
    const S = {
      v: 1,
      seed,
      mode: opts.mode || 'normal',
      hero: hero.id,
      provas,
      stageIdx: 0,
      biome: 'mata',
      map: [],
      fire: [],
      player: Object.assign(
        {
          x: START.x,
          y: START.y,
          hp: maxHp,
          maxHp,
          atk: 1,
          cd: 0,
          power: 0,
          cdReduce: 0,
          freeUsed: false,
          guiaUsed: false,
          healCounter: 0,
          pierce: false,
          cleave: false,
          knock: false,
          burnHit: false,
          fireproof: false,
          refund: false,
          guia: false,
          abebe: false,
          ginga: false,
          patua: false,
          ancestrais: false,
          polvora: false,
          defumacao: false,
          chain: false,
        },
        hero.flags
      ),
      units: [],
      nextId: 1,
      waves: [],
      waveIdx: 0,
      waveTimer: 0,
      portals: [],
      rainMarks: [],
      turn: 0,
      rng: U.hashStr(seed + '|play'),
      st: null,
      tot: { kills: 0, ff: 0, env: 0, drowned: 0, dmg: 0, turns: 0, flawless: 0, rests: 0 },
      score: 0,
      stageScores: [],
      boons: [],
      phase: 'play',
      offer: [],
      cause: null,
      final: null,
    };
    genStage(S);
    return S;
  }

  function cdMax(S) {
    return Math.max(1, D.HEROES[S.hero].ability.cd - S.player.cdReduce);
  }

  /* ---------------------------------------------------------- geração de fases */

  function growBlob(map, g, size, type, blocked) {
    const free = [];
    for (let i = 0; i < W * H; i++) if (map[i] === FLOOR && !blocked[i]) free.push(i);
    if (!free.length) return;
    const cells = [g.pick(free)];
    map[cells[0]] = type;
    let guard = 0;
    while (cells.length < size && guard++ < 60) {
      const c = g.pick(cells);
      const d = DIRS[g.int(4)];
      const x = (c % W) + d[0];
      const y = Math.floor(c / W) + d[1];
      if (!inb(x, y)) continue;
      const i = idx(x, y);
      if (map[i] !== FLOOR || blocked[i]) continue;
      map[i] = type;
      cells.push(i);
    }
  }

  // Conta as casas de chão alcançáveis a partir do início andando só por chão livre.
  function floodCount(map, sx, sy) {
    const seen = new Uint8Array(W * H);
    const q = [idx(sx, sy)];
    seen[q[0]] = 1;
    let n = 0;
    while (q.length) {
      const c = q.pop();
      n++;
      const cx = c % W;
      const cy = Math.floor(c / W);
      for (const d of DIRS) {
        const x = cx + d[0];
        const y = cy + d[1];
        if (!inb(x, y)) continue;
        const i = idx(x, y);
        if (seen[i] || map[i] !== FLOOR) continue;
        seen[i] = 1;
        q.push(i);
      }
    }
    return n;
  }

  function genMap(S, g, biome, isBoss) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const map = new Array(W * H).fill(FLOOR);
      const blocked = new Array(W * H).fill(false);
      for (let y = START.y - 1; y <= START.y + 1; y++)
        for (let x = START.x - 1; x <= START.x + 1; x++) if (inb(x, y)) blocked[idx(x, y)] = true;
      if (isBoss) {
        // Arena do chefe: centro aberto para as travessias de Ikú.
        for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) blocked[idx(x, y)] = true;
        blocked[idx(4, 1)] = true;
      }
      const range = (r) => (Array.isArray(r) ? g.range(r[0], r[1]) : r);
      let water = range(biome.water);
      while (water > 0) {
        const size = Math.min(water, g.range(3, 6));
        growBlob(map, g, size, WATER, blocked);
        water -= size;
      }
      let walls = range(biome.walls);
      while (walls > 0) {
        const size = Math.min(walls, g.range(1, 3));
        growBlob(map, g, size, WALL, blocked);
        walls -= size;
      }
      let thorns = range(biome.thorns);
      while (thorns-- > 0) growBlob(map, g, 1, THORN, blocked);

      let passable = 0;
      let floor = 0;
      for (let i = 0; i < W * H; i++) {
        if (map[i] === FLOOR || map[i] === THORN) passable++;
        if (map[i] === FLOOR) floor++;
      }
      if (passable < W * H * 0.66) continue;
      // Espinhos nunca isolam uma área: todo o chão se alcança sem pisar neles.
      if (floodCount(map, START.x, START.y) !== floor) continue;
      return map;
    }
    return new Array(W * H).fill(FLOOR);
  }

  function genStage(S) {
    const def = D.STAGES[S.stageIdx];
    const biome = D.BIOMES[def.biome];
    const g = U.makeRng(S.seed + '|stage|' + S.stageIdx);
    const waves = U.deepClone(def.templates[g.int(def.templates.length)]);
    if (S.provas.includes('horda') && !def.boss) waves.forEach((w) => w.push(S.stageIdx >= 2 ? 'obsessor' : 'kiumba'));

    S.biome = def.biome;
    S.map = genMap(S, g, biome, !!def.boss);
    S.fire = new Array(W * H).fill(0);
    if (biome.fires) {
      // Fogo inicial na pedreira: duradouro, longe do ponto de partida.
      let n = biome.fires;
      let guard = 0;
      while (n > 0 && guard++ < 100) {
        const x = g.int(W);
        const y = g.int(H - 4);
        if (S.map[idx(x, y)] === FLOOR && !S.fire[idx(x, y)]) {
          S.fire[idx(x, y)] = 6;
          n--;
        }
      }
    }
    S.units = [];
    S.portals = [];
    S.rainMarks = [];
    S.waves = waves;
    S.waveIdx = 0;
    S.waveTimer = 0;
    S.turn = 0;
    S.player.x = START.x;
    S.player.y = START.y;
    S.player.cd = 0;
    S.player.freeUsed = false;
    S.player.guiaUsed = false;
    S.st = { kills: 0, ff: 0, env: 0, drowned: 0, dmg: 0, killScore: 0, enemies: 0 };
    S.st.enemies = waves.reduce((a, w) => a + w.length, 0);
    S.phase = 'play';
    S.offer = [];

    const first = S.waves[S.waveIdx++];
    if (def.boss) {
      makeUnit(S, first[0], 4, 1);
    } else {
      const spots = spawnSpots(S, first.length, 5, g);
      first.forEach((type, i) => spots[i] && makeUnit(S, type, spots[i].x, spots[i].y));
    }
  }

  function spawnSpots(S, n, minDist, g) {
    const pick = g ? () => g.next() : () => rnd(S);
    const p = S.player;
    const taken = new Set(S.portals.map((q) => idx(q.x, q.y)));
    for (const m of S.rainMarks) taken.add(idx(m.x, m.y));
    const out = [];
    for (let md = minDist; md >= 2 && out.length < n; md--) {
      const cands = [];
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (S.map[idx(x, y)] !== FLOOR || occupant(S, x, y) || taken.has(idx(x, y))) continue;
          if (S.fire[idx(x, y)] > 0) continue;
          if (U.manhattan(x, y, p.x, p.y) < md) continue;
          cands.push({ x, y, k: pick() });
        }
      cands.sort((a, b) => a.k - b.k);
      for (const c of cands) {
        if (out.length >= n) break;
        out.push({ x: c.x, y: c.y });
        taken.add(idx(c.x, c.y));
      }
    }
    return out;
  }

  function makeUnit(S, type, x, y) {
    const E = D.ENEMIES[type];
    const hp = E.hp + (S.provas.includes('couro') && !E.boss && !E.elite ? 1 : 0);
    const u = { id: S.nextId++, type, x, y, hp, maxHp: hp, intent: null, stun: 0, burn: 0, cd: 0 };
    if (E.ai === 'summon') u.cd = 2;
    if (E.boss) {
      u.pat = 0;
      u.bphase = 1;
      u.exposed = false;
    }
    S.units.push(u);
    return u;
  }

  /* ------------------------------------------------------------ dano e efeitos */

  function killUnit(S, u, cause, ev) {
    const i = S.units.indexOf(u);
    if (i < 0) return;
    S.units.splice(i, 1);
    const E = spec(u);
    ev.push({ t: 'die', id: u.id, type: u.type, x: u.x, y: u.y, cause: cause.kind });
    if (cause.kind === 'banish') return;
    S.st.killScore += E.score;
    if (cause.kind === 'player' || cause.kind === 'burn') S.st.kills++;
    else if (cause.kind === 'enemy') S.st.ff++;
    else S.st.env++;
    if (cause.kind === 'water') S.st.drowned++;
    const p = S.player;
    if (p.defumacao) {
      p.healCounter++;
      if (p.healCounter % 4 === 0 && p.hp < p.maxHp) {
        p.hp++;
        ev.push({ t: 'heal', n: 1, x: p.x, y: p.y });
      }
    }
    if (E.boss) {
      // Com Ikú vencida, os kiumbas chamados por ela se dispersam.
      for (const o of S.units.slice()) killUnit(S, o, { kind: 'banish' }, ev);
      S.portals = [];
      S.waveIdx = S.waves.length;
    }
  }

  function damageUnit(S, u, n, cause, ev) {
    if (n <= 0 || !S.units.includes(u)) return false;
    const crit = !!u.exposed;
    if (crit) {
      n *= 2;
      u.exposed = false;
    }
    u.hp -= n;
    ev.push({ t: 'hit', id: u.id, n, x: u.x, y: u.y, crit });
    if (u.hp <= 0) {
      killUnit(S, u, cause, ev);
      return true;
    }
    return false;
  }

  function hurtPlayer(S, n, cause, ev) {
    const p = S.player;
    if (n <= 0 || S.phase === 'dead') return 0;
    if (p.patua && n >= 2) n -= 1;
    if (p.guia && !p.guiaUsed) {
      p.guiaUsed = true;
      ev.push({ t: 'block', x: p.x, y: p.y });
      return 0;
    }
    p.hp -= n;
    S.st.dmg += n;
    ev.push({ t: 'hurt', n, x: p.x, y: p.y, cause: cause.type || cause.kind });
    if (p.abebe && cause.uid) {
      const src = getUnit(S, cause.uid);
      if (src) {
        ev.push({ t: 'reflect', from: [p.x, p.y], to: [src.x, src.y] });
        damageUnit(S, src, 1, { kind: 'player' }, ev);
      }
    }
    if (p.hp <= 0) {
      p.hp = 0;
      S.phase = 'dead';
      S.cause = cause.type || cause.kind;
      S.final = finalScore(S, false);
      ev.push({ t: 'death' });
    }
    return n;
  }

  // Aplica dano a quem estiver na casa (jogador ou criatura).
  function hitTile(S, x, y, n, cause, ev) {
    const o = occupant(S, x, y);
    if (!o) return null;
    if (o === S.player) hurtPlayer(S, n, cause, ev);
    else damageUnit(S, o, n, cause, ev);
    return o;
  }

  function setFire(S, x, y, turns) {
    if (!inb(x, y)) return;
    const t = S.map[idx(x, y)];
    if (t === WALL || t === WATER) return;
    S.fire[idx(x, y)] = Math.max(S.fire[idx(x, y)], turns);
  }

  function enterTile(S, o, ev) {
    if (tileAt(S, o.x, o.y) !== THORN) return;
    ev.push({ t: 'thorn', x: o.x, y: o.y });
    if (o === S.player) hurtPlayer(S, 1, { kind: 'espinhos' }, ev);
    else damageUnit(S, o, 1, { kind: 'espinhos' }, ev);
  }

  // Empurra uma criatura. Paredes e outras criaturas causam 1 de dano de batida; o rio afoga.
  function push(S, u, dx, dy, dist, ev) {
    if (u === S.player || spec(u).heavy) {
      if (u !== S.player) ev.push({ t: 'resist', id: u.id, x: u.x, y: u.y });
      return;
    }
    for (let i = 0; i < dist; i++) {
      if (!S.units.includes(u)) return;
      const nx = u.x + dx;
      const ny = u.y + dy;
      if (!inb(nx, ny) || S.map[idx(nx, ny)] === WALL) {
        ev.push({ t: 'bump', id: u.id, x: u.x, y: u.y, dx, dy });
        damageUnit(S, u, 1, { kind: 'colisao' }, ev);
        return;
      }
      const o = occupant(S, nx, ny);
      if (o) {
        ev.push({ t: 'bump', id: u.id, x: u.x, y: u.y, dx, dy });
        damageUnit(S, u, 1, { kind: 'colisao' }, ev);
        if (o === S.player) hurtPlayer(S, 1, { kind: 'colisao' }, ev);
        else damageUnit(S, o, 1, { kind: 'colisao' }, ev);
        return;
      }
      const from = [u.x, u.y];
      u.x = nx;
      u.y = ny;
      ev.push({ t: 'push', id: u.id, from, to: [nx, ny] });
      if (S.map[idx(nx, ny)] === WATER) {
        ev.push({ t: 'splash', x: nx, y: ny });
        killUnit(S, u, { kind: 'water' }, ev);
        return;
      }
      enterTile(S, u, ev);
    }
  }

  /* -------------------------------------------------------------- ações do jogador */

  function strikeTiles(S, dir) {
    const p = S.player;
    const [dx, dy] = DIRS[dir];
    const tx = p.x + dx;
    const ty = p.y + dy;
    const tiles = [[tx, ty]];
    if (p.pierce) tiles.push([tx + dx, ty + dy]);
    if (p.cleave) tiles.push([tx + dy, ty + dx], [tx - dy, ty - dx]);
    return tiles.filter(([x, y]) => inb(x, y));
  }

  function strikeDamage(S) {
    const p = S.player;
    return p.atk + (p.ancestrais && p.hp <= 2 ? 1 : 0);
  }

  function chainBolt(S, x, y, ev) {
    let best = null;
    let bd = 99;
    for (const u of S.units) {
      const d = U.manhattan(x, y, u.x, u.y);
      if (d <= 3 && (d < bd || (d === bd && u.id < best.id))) {
        best = u;
        bd = d;
      }
    }
    if (!best) return;
    ev.push({ t: 'bolt', from: [x, y], to: [best.x, best.y] });
    damageUnit(S, best, 1, { kind: 'player' }, ev);
  }

  function playerStrike(S, dir, ev) {
    const p = S.player;
    const [dx, dy] = DIRS[dir];
    const tiles = strikeTiles(S, dir);
    const dmg = strikeDamage(S);
    ev.push({ t: 'strike', from: [p.x, p.y], dir, tiles });
    const victims = [];
    for (const [x, y] of tiles) {
      const u = unitAt(S, x, y);
      if (u) victims.push(u);
    }
    const deaths = [];
    for (const u of victims) {
      const died = damageUnit(S, u, dmg, { kind: 'player' }, ev);
      if (died) {
        deaths.push([u.x, u.y]);
        continue;
      }
      if (p.burnHit) {
        u.burn = Math.max(u.burn, 1);
        ev.push({ t: 'ignite', id: u.id, x: u.x, y: u.y });
      }
      if (p.knock) push(S, u, dx, dy, 1, ev);
    }
    if (p.chain) for (const [x, y] of deaths) chainBolt(S, x, y, ev);
    return deaths.length;
  }

  function abilityInfo(S) {
    const h = D.HEROES[S.hero];
    return Object.assign({}, h.ability, { ready: S.player.cd === 0, cd: S.player.cd, cdMax: cdMax(S) });
  }

  function abilityRange(S) {
    const p = S.player;
    switch (D.HEROES[S.hero].ability.id) {
      case 'flecha':
        return 7;
      case 'abrecaminho':
        return 3 + p.power;
      case 'pedraderaio':
        return 3;
      default:
        return 1;
    }
  }

  // Alvos válidos para a habilidade (para a interface e para os bots).
  function abilityTargets(S) {
    const p = S.player;
    const ab = D.HEROES[S.hero].ability;
    const out = [];
    if (ab.target === 'none') return [{}];
    if (ab.target === 'dir') {
      for (let d = 0; d < 4; d++) {
        const x = p.x + DIRS[d][0];
        const y = p.y + DIRS[d][1];
        if (!inb(x, y)) continue;
        const t = tileAt(S, x, y);
        if (ab.id === 'abrecaminho' && (t === WALL || t === WATER) && !unitAt(S, x, y)) continue;
        if (ab.id === 'flecha' && t === WALL) continue;
        out.push({ dir: d });
      }
      return out;
    }
    const r = abilityRange(S);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (U.manhattan(x, y, p.x, p.y) > r) continue;
        if (tileAt(S, x, y) === WALL) continue;
        out.push({ x, y });
      }
    return out;
  }

  // Casas afetadas pela habilidade com um alvo (prévia na interface).
  function abilityPreview(S, tgt) {
    const p = S.player;
    const id = D.HEROES[S.hero].ability.id;
    const tiles = [];
    if (id === 'flecha' || id === 'abrecaminho') {
      const [dx, dy] = DIRS[tgt.dir];
      const r = abilityRange(S);
      for (let i = 1; i <= r; i++) {
        const x = p.x + dx * i;
        const y = p.y + dy * i;
        if (!inb(x, y) || S.map[idx(x, y)] === WALL) break;
        if (id === 'abrecaminho' && S.map[idx(x, y)] === WATER) break;
        tiles.push([x, y]);
        if (unitAt(S, x, y)) break;
      }
    } else if (id === 'pedraderaio') {
      tiles.push([tgt.x, tgt.y]);
      for (const d of DIRS) {
        const x = tgt.x + d[0];
        const y = tgt.y + d[1];
        if (inb(x, y) && S.map[idx(x, y)] !== WALL) tiles.push([x, y]);
      }
    } else if (id === 'ventania') {
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && inb(p.x + dx, p.y + dy)) tiles.push([p.x + dx, p.y + dy]);
    }
    return tiles;
  }

  function useAbility(S, tgt, ev) {
    const p = S.player;
    const ab = D.HEROES[S.hero].ability;
    const valid = abilityTargets(S).some((t) => (ab.target === 'dir' ? t.dir === tgt.dir : ab.target === 'tile' ? t.x === tgt.x && t.y === tgt.y : true));
    if (!valid) return false;
    ev.push({ t: 'ability', id: ab.id, x: p.x, y: p.y });
    if (ab.id === 'flecha') {
      const [dx, dy] = DIRS[tgt.dir];
      let end = [p.x, p.y];
      let target = null;
      for (let i = 1; i <= 7; i++) {
        const x = p.x + dx * i;
        const y = p.y + dy * i;
        if (!inb(x, y) || S.map[idx(x, y)] === WALL) break;
        end = [x, y];
        target = unitAt(S, x, y);
        if (target) break;
      }
      ev.push({ t: 'arrow', from: [p.x, p.y], to: end });
      if (target) damageUnit(S, target, 2 + p.power, { kind: 'player' }, ev);
    } else if (ab.id === 'abrecaminho') {
      const [dx, dy] = DIRS[tgt.dir];
      const r = abilityRange(S);
      const from = [p.x, p.y];
      for (let i = 0; i < r; i++) {
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (!inb(nx, ny)) break;
        const u = unitAt(S, nx, ny);
        if (u) {
          ev.push({ t: 'dash', from: from.slice(), to: [p.x, p.y] });
          const died = damageUnit(S, u, 1, { kind: 'player' }, ev);
          if (!died) push(S, u, dx, dy, 2, ev);
          return true;
        }
        if (!isPassable(S, nx, ny)) break;
        if (p.polvora) setFire(S, p.x, p.y, 2);
        p.x = nx;
        p.y = ny;
        enterTile(S, p, ev);
        if (S.phase === 'dead') break;
      }
      ev.push({ t: 'dash', from, to: [p.x, p.y] });
    } else if (ab.id === 'pedraderaio') {
      const tiles = abilityPreview(S, tgt);
      ev.push({ t: 'lightning', x: tgt.x, y: tgt.y, tiles });
      for (const [x, y] of tiles) {
        const u = unitAt(S, x, y);
        if (u) damageUnit(S, u, 1 + p.power, { kind: 'player' }, ev);
        setFire(S, x, y, 2 + p.power);
      }
    } else if (ab.id === 'ventania') {
      ev.push({ t: 'wind', x: p.x, y: p.y });
      const around = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const u = (dx || dy) && unitAt(S, p.x + dx, p.y + dy);
          if (u) around.push({ u, dx, dy });
        }
      for (const a of around) push(S, a.u, a.dx, a.dy, 2 + p.power, ev);
    }
    return true;
  }

  function stageCleared(S) {
    return S.units.length === 0 && S.portals.length === 0 && S.waveIdx >= S.waves.length;
  }

  // Ação do jogador. Devolve { ok, events, free } — free = ação devolvida (sem rodada inimiga).
  function act(S, a) {
    const ev = [];
    if (S.phase !== 'play') return { ok: false, events: ev };
    const p = S.player;
    let usedAbility = false;
    let kills = 0;
    let moved = false;
    if (a.k === 'move') {
      const [dx, dy] = DIRS[a.dir];
      const tx = p.x + dx;
      const ty = p.y + dy;
      if (!inb(tx, ty)) return { ok: false, events: ev };
      if (unitAt(S, tx, ty)) {
        kills = playerStrike(S, a.dir, ev);
      } else if (isPassable(S, tx, ty)) {
        const from = [p.x, p.y];
        if (p.polvora) setFire(S, p.x, p.y, 2);
        p.x = tx;
        p.y = ty;
        moved = true;
        ev.push({ t: 'step', from, to: [tx, ty] });
        enterTile(S, p, ev);
      } else {
        return { ok: false, events: ev };
      }
    } else if (a.k === 'wait') {
      ev.push({ t: 'wait', x: p.x, y: p.y });
    } else if (a.k === 'ability') {
      if (p.cd > 0) return { ok: false, events: ev };
      if (!useAbility(S, a, ev)) return { ok: false, events: ev };
      usedAbility = true;
      p.cd = cdMax(S);
    } else {
      return { ok: false, events: ev };
    }

    let free = false;
    if (a.k === 'move' && !moved && kills > 0 && p.refund && !p.freeUsed && S.phase === 'play') {
      p.freeUsed = true;
      free = true;
      ev.push({ t: 'free', x: p.x, y: p.y });
    }
    if (!free && !usedAbility && p.cd > 0) p.cd--;
    if (S.phase === 'play' && stageCleared(S)) finishStage(S, ev);
    return { ok: true, events: ev, free };
  }

  function legalActions(S) {
    const out = [];
    const p = S.player;
    for (let d = 0; d < 4; d++) {
      const x = p.x + DIRS[d][0];
      const y = p.y + DIRS[d][1];
      if (!inb(x, y)) continue;
      if (unitAt(S, x, y) || isPassable(S, x, y)) out.push({ k: 'move', dir: d });
    }
    out.push({ k: 'wait' });
    if (p.cd === 0) for (const t of abilityTargets(S)) out.push(Object.assign({ k: 'ability' }, t));
    return out;
  }

  /* ---------------------------------------------------------- inteligência inimiga */

  // Custo de caminhada até o jogador (ignora criaturas, evita perigos).
  // Criaturas frágeis (1 de vida) tratam espinhos como parede.
  function distanceMap(S, fragile) {
    const INF = 1e9;
    const dist = new Array(W * H).fill(INF);
    const done = new Uint8Array(W * H);
    const p = S.player;
    dist[idx(p.x, p.y)] = 0;
    for (;;) {
      let best = -1;
      let bd = INF;
      for (let i = 0; i < W * H; i++)
        if (!done[i] && dist[i] < bd) {
          bd = dist[i];
          best = i;
        }
      if (best < 0) break;
      done[best] = 1;
      const bx = best % W;
      const by = Math.floor(best / W);
      for (const d of DIRS) {
        const x = bx + d[0];
        const y = by + d[1];
        if (!isPassable(S, x, y)) continue;
        const thorn = tileAt(S, x, y) === THORN;
        if (thorn && fragile) continue;
        const i = idx(x, y);
        const c = bd + 1 + (thorn ? 3 : 0) + (S.fire[i] > 0 ? 0.5 : 0);
        if (c < dist[i]) dist[i] = c;
      }
    }
    return dist;
  }

  function reachable(S, u, steps, hop) {
    const out = [{ x: u.x, y: u.y, path: [] }];
    if (steps <= 0) return out;
    const fragile = u.hp <= 1;
    const ok = (x, y) => isFree(S, x, y) && !(fragile && tileAt(S, x, y) === THORN);
    if (hop) {
      for (const d of DIRS)
        for (let k = 1; k <= steps; k++) {
          const x = u.x + d[0] * k;
          const y = u.y + d[1] * k;
          if (ok(x, y)) out.push({ x, y, path: [[x, y]], hop: k > 1 });
        }
      return out;
    }
    const seen = new Set([idx(u.x, u.y)]);
    let frontier = [out[0]];
    for (let s = 0; s < steps; s++) {
      const next = [];
      for (const c of frontier)
        for (const d of DIRS) {
          const x = c.x + d[0];
          const y = c.y + d[1];
          if (!ok(x, y) || seen.has(idx(x, y))) continue;
          seen.add(idx(x, y));
          const n = { x, y, path: c.path.concat([[x, y]]) };
          out.push(n);
          next.push(n);
        }
      frontier = next;
    }
    return out;
  }

  // Primeira criatura (ou parede) numa linha a partir de (x,y).
  function traceLine(S, x, y, dx, dy, range, stopWater) {
    const tiles = [];
    for (let i = 1; i <= range; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (!inb(nx, ny)) break;
      const t = S.map[idx(nx, ny)];
      if (t === WALL || (stopWater && t === WATER)) break;
      tiles.push([nx, ny]);
      const o = occupant(S, nx, ny);
      if (o) return { tiles, hit: o };
    }
    return { tiles, hit: null };
  }

  function alignedDir(ax, ay, bx, by) {
    if (ax === bx && ay === by) return -1;
    if (ax === bx) return by < ay ? 0 : 2;
    if (ay === by) return bx > ax ? 1 : 3;
    return -1;
  }

  function canShoot(S, x, y, range, stopWater) {
    const p = S.player;
    const d = alignedDir(x, y, p.x, p.y);
    if (d < 0) return -1;
    const r = traceLine(S, x, y, DIRS[d][0], DIRS[d][1], range, stopWater);
    return r.hit === p ? d : -1;
  }

  function scoreTile(S, u, E, c, dmaps) {
    const p = S.player;
    const d = U.manhattan(c.x, c.y, p.x, p.y);
    const dmap = u.hp <= 1 ? dmaps.fragile : dmaps.normal;
    // O último inimigo do terreiro não foge: parte para o confronto (evita perseguições sem fim).
    const lonely = S.units.length === 1 && S.portals.length === 0 && S.waveIdx >= S.waves.length;
    const usesMap = E.ai === 'melee' || E.ai === 'spin' || E.ai === 'boss';
    // O custo de caminho já inclui espinhos; aqui pesa só terminar em cima de fogo ou espinho.
    const hz = (S.fire[idx(c.x, c.y)] > 0 && !E.fireproof ? 4 : 0) + (!usesMap && tileAt(S, c.x, c.y) === THORN ? 4 : 0);
    const moveCost = c.path.length ? 0.01 : 0;
    const save = { x: u.x, y: u.y };
    let s;
    switch (E.ai) {
      case 'line': {
        u.x = c.x;
        u.y = c.y;
        const ok = canShoot(S, c.x, c.y, E.range, false) >= 0 && d >= 2;
        u.x = save.x;
        u.y = save.y;
        s = ok ? 1 - Math.min(d, 4) * 0.1 : 3 + Math.min(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) * 0.4 + dmap[idx(c.x, c.y)];
        if (d <= 1 && !lonely) s += 6;
        if (lonely) s = (ok ? 0 : 3) + dmap[idx(c.x, c.y)] * 0.5;
        break;
      }
      case 'charge': {
        u.x = c.x;
        u.y = c.y;
        const ok = canShoot(S, c.x, c.y, E.range, true) >= 0;
        u.x = save.x;
        u.y = save.y;
        s = ok ? (d < 2 ? 1 : 0) : 3 + Math.min(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) * 0.4 + dmap[idx(c.x, c.y)];
        break;
      }
      case 'aoe':
        s = lonely ? dmap[idx(c.x, c.y)] : (d < 3 ? (3 - d) * 2 : 0) + (d > E.range ? (d - E.range) * 0.5 + dmap[idx(c.x, c.y)] * 0.5 : 0);
        break;
      case 'spin':
        s = dmap[idx(c.x, c.y)];
        break;
      default:
        s = dmap[idx(c.x, c.y)];
    }
    return s + hz + moveCost;
  }

  function moveEnemy(S, u, E, ev, dmap, steps) {
    const cands = reachable(S, u, steps, E.ai === 'spin');
    let best = [];
    let bs = Infinity;
    for (const c of cands) {
      const s = scoreTile(S, u, E, c, dmap);
      if (s < bs - 1e-9) {
        bs = s;
        best = [c];
      } else if (Math.abs(s - bs) < 1e-9) best.push(c);
    }
    const c = best.length > 1 ? best[rint(S, best.length)] : best[0];
    if (!c || !c.path.length) return;
    const from = [u.x, u.y];
    for (const [x, y] of c.path) {
      u.x = x;
      u.y = y;
      if (tileAt(S, x, y) === THORN) {
        ev.push({ t: 'move', id: u.id, from: from.slice(), to: [x, y], hop: !!c.hop });
        enterTile(S, u, ev);
        return;
      }
    }
    ev.push({ t: 'move', id: u.id, from, to: [u.x, u.y], hop: !!c.hop });
  }

  function orthAdjacentDir(u, p) {
    for (let d = 0; d < 4; d++) if (u.x + DIRS[d][0] === p.x && u.y + DIRS[d][1] === p.y) return d;
    return -1;
  }

  function tryIntent(S, u, E, ev) {
    const p = S.player;
    let intent = null;
    switch (E.ai) {
      case 'melee':
      case 'boss': {
        const d = orthAdjacentDir(u, p);
        if (d >= 0) intent = { k: E.sweep ? 'sweep' : 'melee', dir: d, dmg: E.dmg, aim: true };
        break;
      }
      case 'line': {
        const d = canShoot(S, u.x, u.y, E.range, false);
        if (d >= 0) intent = { k: 'line', dir: d, dmg: E.dmg, range: E.range, aim: true };
        break;
      }
      case 'charge': {
        const d = canShoot(S, u.x, u.y, E.range, true);
        if (d >= 0) intent = { k: 'charge', dir: d, dmg: E.dmg, range: E.range, trail: !!E.trail, aim: true };
        break;
      }
      case 'aoe':
        if (U.manhattan(u.x, u.y, p.x, p.y) <= E.range) intent = { k: 'aoe', x: p.x, y: p.y, dmg: E.dmg, aim: true };
        break;
      case 'spin':
        if (orthAdjacentDir(u, p) >= 0) intent = { k: 'spin', dmg: E.dmg, aim: true };
        break;
    }
    if (intent) {
      u.intent = intent;
      ev.push({ t: 'intent', id: u.id, k: intent.k, onPlayer: intentTiles(S, u).some(([x, y]) => x === p.x && y === p.y) });
    }
  }

  // Maldição em X: o centro e as 4 diagonais. Um passo reto sempre escapa.
  function xTiles(S, x, y) {
    const out = [];
    for (const [dx, dy] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (inb(nx, ny) && S.map[idx(nx, ny)] !== WALL) out.push([nx, ny]);
    }
    return out;
  }

  function plusTiles(S, x, y) {
    const out = [];
    if (inb(x, y) && S.map[idx(x, y)] !== WALL) out.push([x, y]);
    for (const d of DIRS) {
      const nx = x + d[0];
      const ny = y + d[1];
      if (inb(nx, ny) && S.map[idx(nx, ny)] !== WALL) out.push([nx, ny]);
    }
    return out;
  }

  // Casas que o ataque preparado vai atingir, calculadas a partir da posição atual.
  function intentTiles(S, u) {
    const it = u.intent;
    if (!it) return [];
    switch (it.k) {
      case 'melee':
      case 'summon': {
        const x = u.x + DIRS[it.dir][0];
        const y = u.y + DIRS[it.dir][1];
        return inb(x, y) ? [[x, y]] : [];
      }
      case 'sweep': {
        const [dx, dy] = DIRS[it.dir];
        const fx = u.x + dx;
        const fy = u.y + dy;
        return [
          [fx, fy],
          [fx + dy, fy + dx],
          [fx - dy, fy - dx],
        ].filter(([x, y]) => inb(x, y) && S.map[idx(x, y)] !== WALL);
      }
      case 'line':
        return traceLine(S, u.x, u.y, DIRS[it.dir][0], DIRS[it.dir][1], it.range, false).tiles;
      case 'charge': {
        const r = traceLine(S, u.x, u.y, DIRS[it.dir][0], DIRS[it.dir][1], it.range, true);
        if (it.stop == null) return r.tiles;
        return r.tiles.slice(0, it.stop);
      }
      case 'aoe':
        return xTiles(S, it.x, it.y);
      case 'multi': {
        const seen = new Set();
        const out = [];
        for (const [cx, cy] of it.centers)
          for (const t of xTiles(S, cx, cy))
            if (!seen.has(idx(t[0], t[1]))) {
              seen.add(idx(t[0], t[1]));
              out.push(t);
            }
        return out;
      }
      case 'spin':
        return plusTiles(S, u.x, u.y).slice(1);
    }
    return [];
  }

  function threats(S) {
    const out = [];
    for (const u of S.units) {
      if (!u.intent || u.intent.k === 'summon') continue;
      for (const [x, y] of intentTiles(S, u)) out.push({ x, y, dmg: u.intent.dmg, id: u.id });
    }
    return out;
  }

  function execIntent(S, u, ev) {
    const it = u.intent;
    const p = S.player;
    const cause = { kind: 'enemy', type: u.type, uid: u.id };
    const hpBefore = p.hp;
    const blockedBefore = p.guiaUsed;
    let hitPlayer = false;
    const tiles = intentTiles(S, u);
    switch (it.k) {
      case 'melee':
      case 'sweep': {
        ev.push({ t: 'attack', id: u.id, k: it.k, tiles });
        for (const [x, y] of tiles) if (hitTile(S, x, y, it.dmg, cause, ev) === p) hitPlayer = true;
        break;
      }
      case 'spin': {
        ev.push({ t: 'attack', id: u.id, k: 'spin', tiles });
        for (const [x, y] of tiles) if (hitTile(S, x, y, it.dmg, cause, ev) === p) hitPlayer = true;
        break;
      }
      case 'line': {
        const end = tiles.length ? tiles[tiles.length - 1] : [u.x, u.y];
        ev.push({ t: 'shot', id: u.id, from: [u.x, u.y], to: end });
        if (tiles.length && hitTile(S, end[0], end[1], it.dmg, cause, ev) === p) hitPlayer = true;
        break;
      }
      case 'charge': {
        const [dx, dy] = DIRS[it.dir];
        const from = [u.x, u.y];
        const limit = it.stop == null ? it.range : it.stop;
        for (let i = 0; i < limit; i++) {
          const nx = u.x + dx;
          const ny = u.y + dy;
          if (!inb(nx, ny) || S.map[idx(nx, ny)] === WALL || S.map[idx(nx, ny)] === WATER) break;
          const o = occupant(S, nx, ny);
          if (o) {
            ev.push({ t: 'dash', id: u.id, from: from.slice(), to: [u.x, u.y] });
            if (hitTile(S, nx, ny, it.dmg, cause, ev) === p) hitPlayer = true;
            from[0] = u.x;
            from[1] = u.y;
            break;
          }
          if (it.trail) setFire(S, u.x, u.y, 3);
          u.x = nx;
          u.y = ny;
        }
        if (from[0] !== u.x || from[1] !== u.y) ev.push({ t: 'dash', id: u.id, from, to: [u.x, u.y] });
        if (spec(u).boss && S.units.includes(u)) {
          u.stun = 2;
          u.exposed = true;
          ev.push({ t: 'exposed', id: u.id, x: u.x, y: u.y });
        }
        break;
      }
      case 'aoe':
      case 'multi': {
        ev.push({ t: 'curse', id: u.id, from: [u.x, u.y], tiles });
        for (const [x, y] of tiles) {
          if (hitTile(S, x, y, it.dmg, cause, ev) === p) hitPlayer = true;
          setFire(S, x, y, 2);
        }
        break;
      }
      case 'summon': {
        const [x, y] = tiles[0] || [-1, -1];
        if (isFree(S, x, y)) {
          const k = makeUnit(S, 'kiumba', x, y);
          ev.push({ t: 'spawn', id: k.id, x, y });
        } else {
          ev.push({ t: 'fizzle', x, y });
        }
        break;
      }
    }
    if (spec(u).stuck && S.units.includes(u)) {
      u.stun = spec(u).stuck;
      ev.push({ t: 'stuck', id: u.id, x: u.x, y: u.y });
    }
    if (it.aim && !hitPlayer && S.phase !== 'dead' && hpBefore === p.hp && blockedBefore === p.guiaUsed) {
      ev.push({ t: 'miss', id: u.id, x: u.x, y: u.y });
      if (p.ginga && S.units.includes(u) && !u.stun) {
        u.stun = 1;
        ev.push({ t: 'dizzy', id: u.id, x: u.x, y: u.y });
      }
    }
  }

  /* ----------------------------------------------------------------- Ikú (chefe) */

  const BOSS_PATTERNS = {
    1: ['lane', 'sentence', 'rest', 'summon', 'rest'],
    2: ['lane', 'sentence', 'summon', 'lane', 'rest'],
    3: ['lane', 'sentence', 'lane', 'summon', 'sentence', 'rest'],
  };
  const BOSS_LINES = {
    2: 'Ikú: "Ninguém atravessa o Orun antes da hora."',
    3: 'Ikú: "Então venha. Eu sempre chego no fim."',
  };

  function bossLane(S, u, ev) {
    const p = S.player;
    const opts = [];
    // Ikú reaparece numa borda alinhada com o jogador e atravessa o terreiro.
    const cands = [
      { x: 0, y: p.y, dir: 1 },
      { x: W - 1, y: p.y, dir: 3 },
      { x: p.x, y: 0, dir: 2 },
      { x: p.x, y: H - 1, dir: 0 },
    ];
    for (const c of cands) {
      const [dx, dy] = DIRS[c.dir];
      let x = c.x;
      let y = c.y;
      // Avança da borda para dentro até achar uma casa livre (ou a própria Ikú).
      while (inb(x, y) && !(x === p.x && y === p.y) && !(isFree(S, x, y) || (x === u.x && y === u.y))) {
        x += dx;
        y += dy;
      }
      if (!inb(x, y) || (x === p.x && y === p.y)) continue;
      const dist = U.manhattan(x, y, p.x, p.y);
      if (dist < 3) continue;
      let clear = true;
      for (let i = 1; i < dist; i++) {
        const t = tileAt(S, x + dx * i, y + dy * i);
        if (t === WALL || t === WATER) clear = false;
      }
      if (clear) opts.push({ x, y, dir: c.dir, dist });
    }
    if (!opts.length) return false;
    const o = opts[rint(S, opts.length)];
    ev.push({ t: 'vanish', id: u.id, x: u.x, y: u.y });
    u.x = o.x;
    u.y = o.y;
    ev.push({ t: 'appear', id: u.id, x: u.x, y: u.y });
    u.intent = { k: 'charge', dir: o.dir, dmg: 2, range: W, stop: o.dist + 1, trail: true, aim: true };
    ev.push({ t: 'intent', id: u.id, k: 'charge', onPlayer: true });
    return true;
  }

  function bossSentence(S, u, ev, n) {
    const p = S.player;
    const centers = [[p.x, p.y]];
    const cands = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const d = U.manhattan(x, y, p.x, p.y);
        if (d >= 2 && d <= 3 && S.map[idx(x, y)] !== WALL) cands.push([x, y]);
      }
    // Sempre sobra ao menos uma casa vizinha livre fora das marcas.
    const exits = DIRS.map((d) => [p.x + d[0], p.y + d[1]]).filter(([x, y]) => isFree(S, x, y));
    const covered = new Set();
    const cover = (c) => xTiles(S, c[0], c[1]).forEach(([x, y]) => covered.add(idx(x, y)));
    cover(centers[0]);
    while (centers.length < n && cands.length) {
      const c = cands.splice(rint(S, cands.length), 1)[0];
      const after = new Set(covered);
      xTiles(S, c[0], c[1]).forEach(([x, y]) => after.add(idx(x, y)));
      if (exits.length && !exits.some(([x, y]) => !after.has(idx(x, y)))) continue;
      centers.push(c);
      cover(c);
    }
    u.intent = { k: 'multi', centers, dmg: 1, aim: true };
    ev.push({ t: 'intent', id: u.id, k: 'multi', onPlayer: true });
  }

  function bossSummon(S, u, ev) {
    const others = S.units.filter((o) => o !== u).length + S.portals.length;
    if (others >= 4) return false;
    const types = u.bphase >= 3 ? ['kiumba', 'obsessor'] : u.bphase === 2 ? ['kiumba', 'ofo'] : ['kiumba', 'kiumba'];
    const spots = spawnSpots(S, types.length, 3);
    spots.forEach((s, i) => S.portals.push({ x: s.x, y: s.y, type: types[i] }));
    ev.push({ t: 'summon', id: u.id, x: u.x, y: u.y, spots });
    return true;
  }

  function bossAct(S, u, E, ev, dmap) {
    const ratio = u.hp / u.maxHp;
    const ph = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (ph !== u.bphase) {
      u.bphase = ph;
      u.pat = 0;
      ev.push({ t: 'bossPhase', id: u.id, phase: ph, line: BOSS_LINES[ph] });
    }
    const pattern = BOSS_PATTERNS[u.bphase];
    const step = pattern[u.pat % pattern.length];
    u.pat++;
    const sentenceN = 2 + u.bphase;
    if (step === 'lane' && bossLane(S, u, ev)) return;
    if (step === 'summon' && bossSummon(S, u, ev)) return;
    if (step === 'sentence' || step === 'lane' || step === 'summon') {
      bossSentence(S, u, ev, sentenceN);
      return;
    }
    if (orthAdjacentDir(u, S.player) < 0) moveEnemy(S, u, E, ev, dmap, u.bphase >= 3 ? 2 : 1);
    tryIntent(S, u, E, ev);
  }

  /* --------------------------------------------------------------- rodada inimiga */

  function enemyAct(S, u, ev, dmap) {
    const E = spec(u);
    if (u.stun > 0) {
      u.stun--;
      u.intent = null;
      if (u.stun === 0) u.exposed = false;
      ev.push({ t: 'stunned', id: u.id, x: u.x, y: u.y });
      return;
    }
    if (u.intent) {
      execIntent(S, u, ev);
      if (S.units.includes(u)) u.intent = null;
      return;
    }
    if (E.ai === 'boss') return bossAct(S, u, E, ev, dmap);
    if (E.ai === 'summon') {
      u.cd--;
      if (u.cd <= 0) {
        const dirs = [0, 1, 2, 3].filter((d) => isFree(S, u.x + DIRS[d][0], u.y + DIRS[d][1]));
        if (dirs.length) {
          u.intent = { k: 'summon', dir: dirs[rint(S, dirs.length)], dmg: 0 };
          ev.push({ t: 'intent', id: u.id, k: 'summon', onPlayer: false });
        }
        u.cd = 3;
      }
      return;
    }
    const steps = E.move;
    const alreadyAdjacent = (E.ai === 'melee' || E.ai === 'spin') && orthAdjacentDir(u, S.player) >= 0;
    if (steps > 0 && !alreadyAdjacent) moveEnemy(S, u, E, ev, dmap, steps);
    if (S.units.includes(u)) tryIntent(S, u, E, ev);
  }

  // Quem terminou o turno em cima do fogo se queima antes de os inimigos agirem.
  function fireTick(S, ev) {
    const p = S.player;
    for (const u of S.units.slice()) {
      if (S.fire[idx(u.x, u.y)] > 0 && !spec(u).fireproof) {
        ev.push({ t: 'burn', id: u.id, x: u.x, y: u.y });
        damageUnit(S, u, 1, { kind: 'fogo' }, ev);
      }
    }
    if (S.fire[idx(p.x, p.y)] > 0 && !p.fireproof && !p.polvora) hurtPlayer(S, 1, { kind: 'fogo' }, ev);
  }

  function* enemyPhase(S) {
    if (S.phase !== 'play') return;
    const p = S.player;
    const pre = [];
    fireTick(S, pre);
    if (pre.length) yield pre;
    if (S.phase !== 'play') return;
    const dmap = { normal: distanceMap(S, false), fragile: distanceMap(S, true) };
    const order = S.units
      .slice()
      .sort((a, b) => U.manhattan(a.x, a.y, p.x, p.y) - U.manhattan(b.x, b.y, p.x, p.y) || a.id - b.id)
      .map((u) => u.id);
    for (const id of order) {
      const u = getUnit(S, id);
      if (!u) continue;
      const ev = [];
      enemyAct(S, u, ev, dmap);
      if (ev.length) yield ev;
      if (S.phase !== 'play') return;
    }
    const ev = [];
    endRound(S, ev);
    yield ev;
  }

  function runEnemyPhase(S) {
    const all = [];
    for (const ev of enemyPhase(S)) all.push(...ev);
    return all;
  }

  function waveTimer(S) {
    const base = D.STAGES[S.stageIdx].timer || D.WAVE_TIMER;
    return Math.max(4, base - (S.provas.includes('horda') ? 3 : 0));
  }

  function scheduleWave(S, ev) {
    const wave = S.waves[S.waveIdx++];
    const spots = spawnSpots(S, wave.length, 4);
    wave.forEach((type, i) => spots[i] && S.portals.push({ x: spots[i].x, y: spots[i].y, type }));
    S.waveTimer = 0;
    ev.push({ t: 'portal', n: spots.length });
  }

  function endRound(S, ev) {
    const p = S.player;
    // 1. Queimaduras e o fogo que se apaga.
    for (const u of S.units.slice()) {
      if (u.burn > 0) {
        u.burn--;
        ev.push({ t: 'burn', id: u.id, x: u.x, y: u.y });
        damageUnit(S, u, 1, { kind: 'burn' }, ev);
      }
    }
    for (let i = 0; i < W * H; i++) if (S.fire[i] > 0) S.fire[i]--;

    // 2. Provação: chuva de brasa.
    if (S.provas.includes('chuva')) {
      for (const m of S.rainMarks) {
        ev.push({ t: 'ember', x: m.x, y: m.y });
        hitTile(S, m.x, m.y, 1, { kind: 'fogo' }, ev);
        setFire(S, m.x, m.y, 2);
      }
      S.rainMarks = [];
      if (S.turn % 3 === 2) {
        const cands = [];
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++)
            if (isPassable(S, x, y) && U.manhattan(x, y, p.x, p.y) <= 3) cands.push({ x, y });
        for (let k = 0; k < 4 && cands.length; k++) S.rainMarks.push(cands.splice(rint(S, cands.length), 1)[0]);
      }
    }

    // 3. Ondas: portais viram criaturas; novas ondas são anunciadas.
    for (const q of S.portals) {
      let spot = isFree(S, q.x, q.y) ? { x: q.x, y: q.y } : null;
      if (!spot) {
        let bd = 99;
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const d = U.manhattan(x, y, q.x, q.y);
            if (d < bd && isFree(S, x, y) && S.map[idx(x, y)] === FLOOR) {
              bd = d;
              spot = { x, y };
            }
          }
      }
      if (spot) {
        const u = makeUnit(S, q.type, spot.x, spot.y);
        ev.push({ t: 'spawn', id: u.id, x: spot.x, y: spot.y });
      }
    }
    S.portals = [];
    if (S.waveIdx < S.waves.length) {
      S.waveTimer++;
      const timer = waveTimer(S);
      if (S.units.length === 0 || S.waveTimer >= timer) scheduleWave(S, ev);
    }

    p.freeUsed = false;
    S.turn++;
    S.tot.turns++;
    if (S.phase === 'play' && stageCleared(S)) finishStage(S, ev);
  }

  /* ----------------------------------------------------- fim de terreiro e pontos */

  function finishStage(S, ev) {
    const st = S.st;
    const n = S.stageIdx + 1;
    const par = 6 + st.enemies * 3;
    const parts = {
      clear: 100 * n,
      kills: st.killScore,
      speed: Math.max(0, par - S.turn) * 10,
      flawless: st.dmg === 0 ? 150 : 0,
      tricks: (st.ff + st.env) * 25,
    };
    const total = parts.clear + parts.kills + parts.speed + parts.flawless + parts.tricks;
    S.stageScores.push({ stage: n, turns: S.turn, par, parts, total, dmg: st.dmg });
    S.score += total;
    const T = S.tot;
    T.kills += st.kills;
    T.ff += st.ff;
    T.env += st.env;
    T.drowned += st.drowned;
    T.dmg += st.dmg;
    if (st.dmg === 0) T.flawless++;
    S.units = [];
    S.portals = [];
    S.rainMarks = [];
    for (let i = 0; i < W * H; i++) S.fire[i] = 0;
    if (S.stageIdx >= D.STAGES.length - 1) {
      S.phase = 'won';
      S.final = finalScore(S, true);
      ev.push({ t: 'victory' });
      return;
    }
    const p = S.player;
    if (!S.provas.includes('fragil') && p.hp < p.maxHp) p.hp++;
    S.phase = 'cross';
    S.offer = offerBoons(S);
    ev.push({ t: 'clear' });
  }

  function boonEligible(S, id) {
    const b = D.BOONS[id];
    if (!b) return false;
    if (b.excl && b.excl.includes(S.hero)) return false;
    if (S.boons.filter((x) => x === id).length >= b.stack) return false;
    if (id === 'vento' && cdMax(S) <= 1) return false;
    return true;
  }

  function offerBoons(S) {
    const g = U.makeRng(S.seed + '|boon|' + S.stageIdx);
    const pool = Object.keys(D.BOONS).filter((id) => boonEligible(S, id));
    g.shuffle(pool);
    return pool.slice(0, 3);
  }

  function applyBoon(S, id) {
    const p = S.player;
    switch (id) {
      case 'ori':
        p.maxHp++;
        p.hp = Math.min(p.maxHp, p.hp + 2);
        break;
      case 'ferro':
        p.atk++;
        break;
      case 'ponta':
        p.pierce = true;
        break;
      case 'oxe':
        p.cleave = true;
        break;
      case 'oya':
        p.refund = true;
        break;
      case 'guia':
        p.guia = true;
        break;
      case 'abebe':
        p.abebe = true;
        break;
      case 'brasa':
        p.burnHit = true;
        break;
      case 'vento':
        p.cdReduce++;
        break;
      case 'ponto':
        p.power++;
        break;
      case 'defumacao':
        p.defumacao = true;
        break;
      case 'polvora':
        p.polvora = true;
        p.fireproof = true;
        break;
      case 'pedreira':
        p.knock = true;
        break;
      case 'ginga':
        p.ginga = true;
        break;
      case 'patua':
        p.patua = true;
        break;
      case 'ancestrais':
        p.ancestrais = true;
        break;
    }
  }

  // Escolha na encruzilhada: uma dádiva oferecida ou 'rest' (Banho de Ervas).
  function choose(S, id) {
    if (S.phase !== 'cross') return false;
    if (id === 'rest') {
      const p = S.player;
      p.hp = Math.min(p.maxHp, p.hp + 2);
      S.tot.rests++;
    } else {
      if (!S.offer.includes(id)) return false;
      applyBoon(S, id);
      S.boons.push(id);
    }
    S.stageIdx++;
    genStage(S);
    return true;
  }

  function provaMult(S) {
    return 1 + S.provas.reduce((a, id) => a + D.PROVACOES[id].mult, 0);
  }

  function rankFor(score) {
    for (const r of D.RANKS) if (score >= r.min) return r.r;
    return 'D';
  }

  function finalScore(S, won) {
    const base = S.score;
    const victory = won ? 1000 : 0;
    const life = won ? S.player.hp * 100 : 0;
    const mult = provaMult(S);
    const total = Math.round((base + victory + life) * mult);
    return { base, victory, life, mult, total, rank: rankFor(total), won };
  }

  function giveUp(S) {
    S.phase = 'dead';
    S.cause = S.cause || 'desistencia';
    S.final = finalScore(S, false);
  }

  // Usado só por testes e capturas de tela.
  function jumpToStage(S, i) {
    S.stageIdx = Math.max(0, Math.min(D.STAGES.length - 1, i));
    genStage(S);
  }

  FF.engine = {
    jumpToStage,
    waveTimer,
    FLOOR,
    WALL,
    WATER,
    THORN,
    idx,
    inb,
    newRun,
    act,
    legalActions,
    enemyPhase,
    runEnemyPhase,
    choose,
    finalScore,
    giveUp,
    rankFor,
    provaMult,
    threats,
    intentTiles,
    strikeTiles,
    strikeDamage,
    abilityInfo,
    abilityTargets,
    abilityPreview,
    unitAt,
    getUnit,
    tileAt,
    isPassable,
    cdMax,
    boonEligible,
    applyBoon,
    stageCleared,
  };
})(typeof window !== 'undefined' ? window : globalThis);
