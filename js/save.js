/*
 * Progresso local: configurações, recordes, marcas, bestiário e a jornada em andamento.
 * Tudo passa por sanitize(): dados ausentes, corrompidos ou de versões antigas nunca quebram o jogo.
 */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const D = FF.data;
  const KEY = 'axe.save.v1';
  const VERSION = 1;

  function defaults() {
    const heroes = {};
    for (const id of D.HERO_ORDER) heroes[id] = { runs: 0, wins: 0, best: 0, bestRank: '', fastest: 0 };
    return {
      v: VERSION,
      settings: { sfx: 0.7, music: 0.45, fast: false, shake: true, hints: true, muted: false },
      stats: { runs: 0, wins: 0, kills: 0, turns: 0, bestStage: 0, deathsByStage: {}, deathsByCause: {} },
      heroes,
      unlocked: { iansa: false, provas: false },
      marks: {},
      daily: {},
      seen: { enemies: {}, tips: {} },
      history: [],
      lastHero: 'ogum',
      lastProvas: [],
      run: null,
    };
  }

  const num = (v, d, min, max) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

  function validRun(r) {
    if (!r || typeof r !== 'object' || r.v !== 1) return false;
    if (!D.HEROES[r.hero] || typeof r.seed !== 'string') return false;
    if (!Number.isInteger(r.stageIdx) || r.stageIdx < 0 || r.stageIdx >= D.STAGES.length) return false;
    if (!Array.isArray(r.map) || r.map.length !== D.W * D.H || !Array.isArray(r.fire) || r.fire.length !== D.W * D.H) return false;
    if (!Array.isArray(r.units) || !Array.isArray(r.waves) || !Array.isArray(r.boons)) return false;
    if (!r.player || typeof r.player.hp !== 'number' || r.player.hp <= 0) return false;
    if (!['play', 'cross'].includes(r.phase)) return false;
    if (r.units.some((u) => !u || !D.ENEMIES[u.type] || typeof u.x !== 'number' || typeof u.hp !== 'number')) return false;
    if (r.boons.some((b) => !D.BOONS[b])) return false;
    return true;
  }

  function sanitize(raw) {
    const d = defaults();
    const s = obj(raw);
    if (s.v !== VERSION) {
      // Versões futuras/antigas: aproveita só o que tem formato conhecido abaixo.
    }
    const st = obj(s.settings);
    d.settings.sfx = num(st.sfx, d.settings.sfx, 0, 1);
    d.settings.music = num(st.music, d.settings.music, 0, 1);
    d.settings.fast = bool(st.fast, false);
    d.settings.shake = bool(st.shake, true);
    d.settings.hints = bool(st.hints, true);
    d.settings.muted = bool(st.muted, false);

    const ss = obj(s.stats);
    d.stats.runs = num(ss.runs, 0, 0, 1e9);
    d.stats.wins = num(ss.wins, 0, 0, 1e9);
    d.stats.kills = num(ss.kills, 0, 0, 1e9);
    d.stats.turns = num(ss.turns, 0, 0, 1e12);
    d.stats.bestStage = num(ss.bestStage, 0, 0, D.STAGES.length);
    for (const [k, v] of Object.entries(obj(ss.deathsByStage))) if (/^\d$/.test(k)) d.stats.deathsByStage[k] = num(v, 0, 0, 1e9);
    for (const [k, v] of Object.entries(obj(ss.deathsByCause))) if (typeof k === 'string' && k.length < 20) d.stats.deathsByCause[k] = num(v, 0, 0, 1e9);

    const hs = obj(s.heroes);
    for (const id of D.HERO_ORDER) {
      const h = obj(hs[id]);
      d.heroes[id] = {
        runs: num(h.runs, 0, 0, 1e9),
        wins: num(h.wins, 0, 0, 1e9),
        best: num(h.best, 0, 0, 1e9),
        bestRank: typeof h.bestRank === 'string' && /^[SABCD]?$/.test(h.bestRank) ? h.bestRank : '',
        fastest: num(h.fastest, 0, 0, 1e6),
      };
    }
    const un = obj(s.unlocked);
    d.unlocked.iansa = bool(un.iansa, false);
    d.unlocked.provas = bool(un.provas, false);
    for (const k of Object.keys(obj(s.marks))) if (D.MARKS[k] && s.marks[k]) d.marks[k] = true;
    for (const [k, v] of Object.entries(obj(s.daily))) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
      const e = obj(v);
      d.daily[k] = { best: num(e.best, 0, 0, 1e9), rank: typeof e.rank === 'string' ? e.rank.slice(0, 1) : '', won: bool(e.won, false), tries: num(e.tries, 0, 0, 1e6) };
    }
    const seen = obj(s.seen);
    for (const k of Object.keys(obj(seen.enemies))) if (D.ENEMIES[k]) d.seen.enemies[k] = true;
    for (const k of Object.keys(obj(seen.tips))) if (D.TIPS[k]) d.seen.tips[k] = true;
    if (Array.isArray(s.history))
      d.history = s.history
        .filter((h) => h && D.HEROES[h.hero] && typeof h.score === 'number')
        .slice(0, 12)
        .map((h) => ({ hero: h.hero, score: num(h.score, 0, 0, 1e9), rank: String(h.rank || '').slice(0, 1), won: !!h.won, stage: num(h.stage, 1, 1, 6), date: String(h.date || '').slice(0, 10), mode: h.mode === 'daily' ? 'daily' : h.mode === 'custom' ? 'custom' : 'normal' }));
    d.lastHero = D.HEROES[s.lastHero] ? s.lastHero : 'ogum';
    d.lastProvas = Array.isArray(s.lastProvas) ? s.lastProvas.filter((p) => D.PROVACOES[p]) : [];
    d.run = validRun(s.run) ? s.run : null;
    return d;
  }

  let memory = null;
  let storageOk = true;

  function load() {
    let raw = null;
    let txt = null;
    try {
      txt = root.localStorage.getItem(KEY);
    } catch (e) {
      // Armazenamento bloqueado (modo privado, política do navegador): segue só na memória.
      storageOk = false;
      raw = memory;
    }
    if (txt) {
      try {
        raw = JSON.parse(txt);
      } catch (e) {
        raw = null;
      }
    }
    memory = sanitize(raw);
    return memory;
  }

  function persist() {
    if (!memory) return;
    try {
      root.localStorage.setItem(KEY, JSON.stringify(memory));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
  }

  function reset() {
    memory = defaults();
    try {
      root.localStorage.removeItem(KEY);
    } catch (e) {
      /* sem armazenamento: fica só na memória */
    }
    persist();
    return memory;
  }

  function get() {
    return memory || load();
  }

  /* ------------------------------------------------------------ fim de jornada */

  function evaluateMarks(sv, S, won) {
    const got = [];
    const give = (id) => {
      if (!sv.marks[id]) {
        sv.marks[id] = true;
        got.push(id);
      }
    };
    const ff = S.tot.ff + (S.phase === 'dead' && S.st ? S.st.ff : 0);
    const drowned = S.tot.drowned + (S.phase === 'dead' && S.st ? S.st.drowned : 0);
    if (S.stageScores.length >= 1) give('primeiro');
    if (S.stageScores.some((sc) => sc.stage >= 3 && sc.dmg === 0)) give('corpofechado');
    if (ff >= 3) give('discordia');
    if (drowned >= 3) give('correnteza');
    if (won) {
      give('iku');
      if (S.player.hp === 1) give('porumfio');
      if (S.tot.turns < 110) give('ligeiro');
      if (S.provas.length >= 2) give('provado');
      if (S.mode === 'daily') give('diario');
      if (D.HERO_ORDER.every((h) => sv.heroes[h].wins > 0)) give('todos');
    }
    if (S.final && S.final.rank === 'S') give('lenda');
    return got;
  }

  // Marcas que podem ser conquistadas no meio da jornada (ao fechar um terreiro).
  function stageMarks(S) {
    const sv = get();
    const got = [];
    const give = (id) => {
      if (!sv.marks[id]) {
        sv.marks[id] = true;
        got.push(id);
      }
    };
    if (S.stageScores.length >= 1) give('primeiro');
    if (S.stageScores.some((sc) => sc.stage >= 3 && sc.dmg === 0)) give('corpofechado');
    if (S.tot.ff >= 3) give('discordia');
    if (S.tot.drowned >= 3) give('correnteza');
    if (got.length) persist();
    return got;
  }

  function recordRun(S) {
    const sv = get();
    const won = S.phase === 'won';
    const f = S.final || FF.engine.finalScore(S, won);
    const counts = S.mode !== 'custom';
    const out = { newBest: false, newDaily: false, unlocks: [], marks: [], score: f.total, rank: f.rank };
    sv.stats.runs++;
    sv.stats.kills += S.tot.kills + (S.st && !won ? S.st.kills : 0);
    sv.stats.turns += S.tot.turns;
    const reached = won ? D.STAGES.length : S.stageIdx + 1;
    sv.stats.bestStage = Math.max(sv.stats.bestStage, reached);
    const h = sv.heroes[S.hero];
    h.runs++;
    if (won) {
      sv.stats.wins++;
      h.wins++;
      if (!h.fastest || S.tot.turns < h.fastest) h.fastest = S.tot.turns;
    } else {
      const k = String(S.stageIdx + 1);
      sv.stats.deathsByStage[k] = (sv.stats.deathsByStage[k] || 0) + 1;
      const c = S.cause || 'default';
      sv.stats.deathsByCause[c] = (sv.stats.deathsByCause[c] || 0) + 1;
    }
    if (counts && f.total > h.best) {
      out.newBest = true;
      h.best = f.total;
      h.bestRank = f.rank;
    }
    if (S.mode === 'daily') {
      const key = S.seed.replace('diario-', '');
      const e = sv.daily[key] || { best: 0, rank: '', won: false, tries: 0 };
      e.tries++;
      if (f.total > e.best) {
        e.best = f.total;
        e.rank = f.rank;
        out.newDaily = true;
      }
      e.won = e.won || won;
      sv.daily[key] = e;
    }
    if (won) {
      if (!sv.unlocked.iansa) {
        sv.unlocked.iansa = true;
        out.unlocks.push('iansa');
      }
      if (!sv.unlocked.provas) {
        sv.unlocked.provas = true;
        out.unlocks.push('provas');
      }
    }
    out.marks = evaluateMarks(sv, S, won);
    sv.history.unshift({ hero: S.hero, score: f.total, rank: f.rank, won, stage: reached, date: FF.util.todayKey(), mode: S.mode });
    sv.history = sv.history.slice(0, 12);
    sv.run = null;
    persist();
    return out;
  }

  function dailyInfo(date) {
    const key = FF.util.todayKey(date);
    const h = FF.util.hashStr('diario|' + key);
    const heroes = ['ogum', 'oxossi', 'xango'];
    return {
      key,
      seed: 'diario-' + key,
      hero: heroes[h % heroes.length],
      provas: [D.PROVA_ORDER[(h >>> 4) % D.PROVA_ORDER.length]],
    };
  }

  FF.save = { load, get, persist, reset, sanitize, validRun, recordRun, stageMarks, dailyInfo, defaults, storageOk: () => storageOk };
})(typeof window !== 'undefined' ? window : globalThis);
