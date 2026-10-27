/*
 * Simulação em massa: joga jornadas completas com bots, verifica invariantes do motor
 * e imprime estatísticas de equilíbrio.
 *   node tests/sim.js            -> bot tático, 40 jornadas por herói
 *   node tests/sim.js random 300 -> bot aleatório (fuzz), 300 jornadas por herói
 */
const path = require('path');
const { loadGame } = require('./load');
const FF = loadGame([path.join(__dirname, '..', 'js', 'bot.js')]);
const E = FF.engine;
const D = FF.data;

const mode = process.argv[2] || 'tactical';
const N = Number(process.argv[3] || (mode === 'random' ? 200 : 40));
const heroes = process.argv[4] ? process.argv[4].split(',') : D.HERO_ORDER;
const provas = process.argv[5] ? process.argv[5].split(',') : [];

function rngFrom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function checkInvariants(S, where) {
  const seen = new Set();
  const p = S.player;
  const fail = (m) => {
    throw new Error(where + ': ' + m + ' seed=' + S.seed + ' stage=' + S.stageIdx + ' turn=' + S.turn);
  };
  if (!E.inb(p.x, p.y)) fail('jogador fora do mapa');
  if (S.phase === 'play' && !E.isPassable(S, p.x, p.y)) fail('jogador em casa intransitável');
  seen.add(p.x + ',' + p.y);
  for (const u of S.units) {
    const k = u.x + ',' + u.y;
    if (seen.has(k)) fail('duas criaturas na mesma casa ' + k);
    seen.add(k);
    if (!E.isPassable(S, u.x, u.y)) fail('criatura ' + u.type + ' em casa intransitável');
    if (u.hp <= 0) fail('criatura morta no mapa');
    if (!D.ENEMIES[u.type]) fail('tipo desconhecido');
  }
  if (p.hp < 0 || p.hp > p.maxHp) fail('vida inválida ' + p.hp + '/' + p.maxHp);
  if (S.phase === 'play' && p.hp <= 0) fail('jogando com vida zero');
  const json = JSON.stringify(S);
  if (JSON.stringify(JSON.parse(json)) !== json) fail('estado não serializável');
}

function playRun(hero, seed, rng) {
  const S = E.newRun({ hero, seed: 'sim-' + seed, provas });
  const log = [];
  let guard = 0;
  let stageTurns = 0;
  while (S.phase !== 'dead' && S.phase !== 'won') {
    if (guard++ > 4000) throw new Error('jornada travada seed=' + S.seed);
    if (S.phase === 'cross') {
      const id = FF.bot.chooseBoon(S, mode === 'random' ? rng : null);
      log.push({ c: id });
      if (!E.choose(S, id)) throw new Error('escolha inválida ' + id);
      checkInvariants(S, 'escolha');
      stageTurns = 0;
      continue;
    }
    const a =
      mode === 'random'
        ? FF.bot.randomAction(S, rng)
        : mode === 'casual'
          ? rng() < 0.1
            ? FF.bot.randomAction(S, rng)
            : FF.bot.tacticalAction(S, 1)
          : FF.bot.tacticalAction(S, 2);
    const r = E.act(S, a);
    if (!r.ok) throw new Error('ação legal recusada ' + JSON.stringify(a) + ' seed=' + S.seed);
    log.push({ a });
    checkInvariants(S, 'ação');
    if (!r.free && S.phase === 'play') {
      E.runEnemyPhase(S);
      checkInvariants(S, 'inimigos');
    }
    if (++stageTurns > 250) {
      S.stalled = true;
      S.phase = 'dead';
      S.cause = 'empate';
      S.final = E.finalScore(S, false);
    }
  }
  return { S, log };
}

// Reproduz o log e confere que o resultado é idêntico (determinismo).
function replay(hero, seed, log) {
  const S = E.newRun({ hero, seed: 'sim-' + seed, provas });
  for (const step of log) {
    if (step.c) E.choose(S, step.c);
    else {
      const r = E.act(S, step.a);
      if (!r.free && S.phase === 'play') E.runEnemyPhase(S);
    }
  }
  return S;
}

const t0 = Date.now();
for (const hero of heroes) {
  const stats = { wins: 0, deaths: {}, causes: {}, scores: [], turns: [], ranks: {}, stageTurns: {}, hpLeft: [] };
  for (let i = 0; i < N; i++) {
    const rng = rngFrom(i * 7919 + 13);
    const { S, log } = playRun(hero, i, rng);
    if (i < 3 && !S.stalled) {
      const R = replay(hero, i, log);
      if (JSON.stringify(R) !== JSON.stringify(S)) throw new Error('replay divergente seed=' + i);
    }
    const f = S.final;
    stats.scores.push(f.total);
    stats.ranks[f.rank] = (stats.ranks[f.rank] || 0) + 1;
    if (S.stalled) stats.stalls = (stats.stalls || 0) + 1;
    if (S.phase === 'won') {
      stats.wins++;
      stats.turns.push(S.tot.turns);
      stats.hpLeft.push(S.player.hp);
    } else {
      const st = S.stageIdx + 1;
      stats.deaths[st] = (stats.deaths[st] || 0) + 1;
      stats.causes[S.cause] = (stats.causes[S.cause] || 0) + 1;
    }
    for (const sc of S.stageScores) (stats.stageTurns[sc.stage] = stats.stageTurns[sc.stage] || []).push(sc.turns);
  }
  const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-');
  console.log(
    `\n[${hero}] vitórias ${stats.wins}/${N} (${((stats.wins / N) * 100).toFixed(0)}%)  pontos médios ${avg(stats.scores)}  rodadas (vitória) ${avg(stats.turns)}  vida final ${avg(stats.hpLeft)}`
  );
  console.log('  mortes por terreiro', JSON.stringify(stats.deaths), ' causas', JSON.stringify(stats.causes), ' empates', stats.stalls || 0);
  console.log('  notas', JSON.stringify(stats.ranks));
  console.log(
    '  rodadas por terreiro',
    Object.keys(stats.stageTurns)
      .map((k) => k + ':' + avg(stats.stageTurns[k]))
      .join('  ')
  );
}
console.log(`\nok (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
