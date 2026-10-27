/*
 * Cola entre motor, renderização, áudio e interface: telas, entrada, ritmo das rodadas,
 * dicas contextuais, encruzilhada, fim de jornada e salvamento.
 */
(function (root) {
  'use strict';
  const FF = root.FF;
  const E = FF.engine;
  const D = FF.data;
  const R = FF.render;
  const A = FF.audio;
  const SV = FF.save;
  const SP = FF.sprites;
  const U = FF.util;
  const DIRS = U.DIRS;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const G = {
    S: null,
    screen: 'title',
    stack: [],
    busy: false,
    queued: null,
    targeting: null,
    hover: null,
    selected: null,
    heroSel: 'ogum',
    provasSel: [],
    toastQ: [],
    toastBusy: false,
    soundAt: {},
    lastTime: 0,
    overlay: null,
    touch: !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches),
    press: null,
  };

  const icons = {};
  function icon(name, scale) {
    const k = name + '|' + (scale || 4);
    if (!icons[k]) icons[k] = SP.dataURL(name, scale || 4);
    return icons[k];
  }
  function img(name, cls, alt) {
    return '<img class="px ' + (cls || '') + '" src="' + icon(name) + '" alt="' + esc(alt || '') + '" />';
  }

  /* ---------------------------------------------------------------- telas */

  function show(id, push) {
    if (push !== false && G.screen && G.screen !== id) G.stack.push(G.screen);
    const from = G.screen;
    G.screen = id;
    if (id !== 'title') {
      if (from === 'title') front.scroll = root.scrollY;
      setFrontActive(false);
    }
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + id));
    // Cada tela começa do topo; a página inicial volta para onde a leitura parou.
    root.scrollTo({ top: id === 'title' ? front.scroll || 0 : 0, behavior: 'instant' });
    if (id === 'title') renderTitle();
    if (id === 'heroes') renderHeroes();
    if (id === 'journal') renderJournal('records');
    if (id === 'options') renderOptions();
    if (id === 'game') {
      requestAnimationFrame(() => R.resize());
    } else {
      A.music('menu');
    }
  }

  function back() {
    sfx('back');
    const prev = G.stack.pop() || 'title';
    show(prev, false);
    if (prev === 'game' && G.S) setMusicForStage();
  }

  function settings() {
    return SV.get().settings;
  }

  function applyAudioSettings() {
    const st = settings();
    A.setVolumes(st.muted ? 0 : st.sfx, st.muted ? 0 : st.music);
    const b = $('#btn-sound');
    b.classList.toggle('off', st.muted);
    b.setAttribute('aria-label', st.muted ? 'Som desligado' : 'Som ligado');
    b.querySelector('use').setAttribute('href', st.muted ? '#i-mute' : '#i-sound');
  }

  function sfx(name) {
    const now = performance.now();
    if (G.soundAt[name] && now - G.soundAt[name] < 45) return;
    G.soundAt[name] = now;
    A.play(name);
  }

  /* ---------------------------------------------------------------- página inicial */

  function renderTitle() {
    const sv = SV.get();
    const run = sv.run;
    const cont = $('#btn-continue');
    const nova = $('#btn-new');
    cont.hidden = !run;
    // Com jornada salva, continuar é a ação principal e começar outra vira um link.
    nova.className = run ? 'link' : 'btn primary';
    nova.textContent = run ? 'Começar outra jornada' : 'Jogar';
    $('#continue-info').textContent = run
      ? D.HEROES[run.hero].name + ', terreiro ' + (run.stageIdx + 1) + ' de ' + D.STAGES.length + (run.mode === 'daily' ? ', Desafio do Dia' : '')
      : '';
    const di = SV.dailyInfo();
    const dr = sv.daily[di.key];
    $('#daily-info').textContent =
      D.HEROES[di.hero].name + ' com ' + D.PROVACOES[di.provas[0]].name + (dr ? (dr.won ? ', vencido' : ', seu melhor ' + fmt(dr.best)) : '');
    const best = Math.max(0, ...D.HERO_ORDER.map((h) => sv.heroes[h].best));
    $('#best-line').textContent = sv.stats.runs
      ? 'Sua melhor jornada: ' + fmt(best) + ' de axé. ' + sv.stats.wins + (sv.stats.wins === 1 ? ' vitória' : ' vitórias') + ' em ' + sv.stats.runs + (sv.stats.runs === 1 ? ' jornada.' : ' jornadas.')
      : '';
    buildFront();
    pickPath(front.pathHero, true);
    setFrontActive(true);
  }

  // Palco ao vivo, escolha de caminho e lista de criaturas.
  const front = { built: false, active: false, stage: null, paths: null, inView: {}, pathHero: 'ogum', stageKey: '' };

  const STAGE_SCENES = {
    intro: { hero: 'ogum', stage: 1 },
    regras: { hero: 'oxossi', stage: 2 },
    jornada: { hero: 'xango', stage: 4 },
  };

  function buildFront() {
    if (front.built) return;
    front.built = true;

    let h = '';
    for (const [title, ids] of [
      ['Kiumbas', ['kiumba', 'zombeteiro', 'obsessor']],
      ['Ajogun', ['ofo', 'oran', 'arun', 'epe', 'egba', 'iku']],
    ]) {
      h += '<div class="cgroup"><p>' + title + '</p>';
      for (const id of ids) {
        const e = D.ENEMIES[id];
        h += '<div class="crow">' + img(id, '', '') + '<p><b>' + esc(e.name) + '</b><span class="what">' + esc(e.short) + '</span></p><span class="val">vida ' + e.hp + '</span></div>';
      }
      h += '</div>';
    }
    $('#creature-rows').innerHTML = h;

    const picker = $('#hero-picker');
    for (const id of D.HERO_ORDER) {
      const hh = D.HEROES[id];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.setAttribute('role', 'radio');
      b.dataset.hero = id;
      b.innerHTML = img(id, '', '') + '<span>' + esc(hh.name) + '<small>' + esc(hh.title) + '</small></span>';
      b.addEventListener('click', () => pickPath(id));
      picker.appendChild(b);
    }
    picker.addEventListener('keydown', (e) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const i = (D.HERO_ORDER.indexOf(front.pathHero) + step + D.HERO_ORDER.length) % D.HERO_ORDER.length;
      pickPath(D.HERO_ORDER[i]);
      picker.querySelector('[data-hero="' + D.HERO_ORDER[i] + '"]').focus();
    });
    $('#hero-card').addEventListener('click', (e) => {
      const b = e.target.closest('[data-play]');
      if (!b) return;
      sfx('select');
      G.heroSel = b.dataset.play;
      G.provasSel = SV.get().lastProvas.slice();
      show('heroes');
    });

    if (FF.createDemo) {
      front.stage = FF.createDemo($('#stage-board'), {
        hero: STAGE_SCENES.intro.hero,
        stage: STAGE_SCENES.intro.stage,
        onInfo: (i) => {
          $('#stage-place').textContent = i.place;
          $('#stage-who').textContent = i.hero.name + ', ' + lowerFirst(i.hero.title) + ', rodada ' + i.turn;
        },
      });
      front.paths = FF.createDemo($('#paths-board'), { hero: front.pathHero, stage: 0 });
    }

    if ('IntersectionObserver' in root) {
      // Os demos só jogam quando estão à vista.
      const seen = new IntersectionObserver((entries) => {
        for (const en of entries) front.inView[en.target.id] = en.isIntersecting;
        syncDemos();
      });
      seen.observe($('#stage-board'));
      seen.observe($('#paths-board'));
      // O palco muda de terreiro conforme a leitura avança.
      const chapters = new IntersectionObserver(
        (entries) => {
          for (const en of entries) if (en.isIntersecting) stageScene(en.target.dataset.scene);
        },
        { rootMargin: '-45% 0px -45% 0px' }
      );
      $('.intro').dataset.scene = 'intro';
      $('#regras').dataset.scene = 'regras';
      $('#jornada').dataset.scene = 'jornada';
      for (const el of $$('[data-scene]')) chapters.observe(el);
    } else {
      front.inView['stage-board'] = front.inView['paths-board'] = true;
    }
    setupReveal();
  }

  function stageScene(key) {
    const sc = STAGE_SCENES[key];
    if (!sc || !front.stage || front.stageKey === key) return;
    front.stageKey = key;
    const cv = $('#stage-board');
    const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Troca lenta: o terreiro escurece, muda e volta.
    cv.classList.add('swap');
    setTimeout(
      () => {
        front.stage.hero = sc.hero;
        front.stage.setStage(sc.stage);
        cv.classList.remove('swap');
      },
      reduce ? 0 : 700
    );
  }

  function syncDemos() {
    if (!front.stage) return;
    front.stage.setVisible(front.active && !!front.inView['stage-board']);
    front.paths.setVisible(front.active && !!front.inView['paths-board']);
  }

  function setFrontActive(on) {
    front.active = on;
    syncDemos();
  }

  function pickPath(id, quiet) {
    front.pathHero = id;
    for (const b of $$('#hero-picker .pick')) b.setAttribute('aria-checked', String(b.dataset.hero === id));
    const h = D.HEROES[id];
    const locked = id === 'iansa' && !SV.get().unlocked.iansa;
    $('#hero-card').innerHTML =
      '<h3>' + esc(h.name) + ', ' + esc(lowerFirst(h.title)) + '</h3>' +
      '<p class="sauda">' + esc(h.saudacao) + ' ' + h.hp + ' de vida.</p>' +
      '<p>' + esc(h.passive) + '</p>' +
      '<p><b>' + esc(h.ability.name) + '.</b> ' + esc(h.ability.desc) + '</p>' +
      (locked ? '<p class="sauda">' + esc(h.requirement) + '</p>' : '<button class="btn primary" type="button" data-play="' + id + '">Jogar com ' + esc(h.name) + '</button>');
    if (front.paths) front.paths.setHero(id);
    if (!quiet) sfx('select');
  }

  function setupReveal() {
    const els = $$('[data-reveal], .crow');
    if (!('IntersectionObserver' in root)) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    // Partes de uma mesma seção chegam em sequência curta, na ordem de leitura.
    const order = new Map();
    for (const el of els) {
      const k = el.parentElement;
      const n = order.get(k) || 0;
      order.set(k, n + 1);
      el.style.transitionDelay = Math.min(n, 3) * 80 + 'ms';
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries)
          if (en.isIntersecting) {
            en.target.classList.add('is-in');
            io.unobserve(en.target);
          }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    );
    els.forEach((el) => io.observe(el));
  }

  /* ---------------------------------------------------------- escolha de herói */

  const DIFFICULTY = { 1: 'Fácil de começar', 2: 'Pede atenção', 3: 'Difícil' };

  function renderHeroes(focusSel) {
    const sv = SV.get();
    if (!D.HEROES[G.heroSel]) G.heroSel = sv.lastHero;
    if (G.heroSel === 'iansa' && !sv.unlocked.iansa) G.heroSel = 'ogum';
    if (!sv.unlocked.provas) G.provasSel = [];
    const grid = $('#hero-grid');
    grid.innerHTML = '';
    for (const id of D.HERO_ORDER) {
      const h = D.HEROES[id];
      const locked = id === 'iansa' && !sv.unlocked.iansa;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hero-opt' + (locked ? ' locked' : '');
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(G.heroSel === id));
      const rec = sv.heroes[id];
      b.innerHTML =
        img(id, '', '') +
        '<span class="hname">' + (locked ? 'Bloqueada' : esc(h.name)) + '</span>' +
        '<span class="horixa">' + esc(h.title) + '</span>' +
        '<span class="hdiff">' + DIFFICULTY[h.difficulty] + '</span>' +
        '<span class="hbest">' + (rec.best ? 'Recorde ' + fmt(rec.best) + (rec.bestRank ? ', nota ' + rec.bestRank : '') : rec.runs ? rec.runs + (rec.runs === 1 ? ' jornada' : ' jornadas') : 'Nunca jogado') + '</span>';
      b.addEventListener('click', () => {
        if (locked) {
          toast(esc(h.requirement));
          sfx('back');
          return;
        }
        G.heroSel = id;
        sfx('select');
        renderHeroes('#hero-grid [aria-checked="true"]');
      });
      grid.appendChild(b);
    }
    if (focusSel) setTimeout(() => $(focusSel)?.focus(), 0);
    const h = D.HEROES[G.heroSel];
    $('#hero-detail').innerHTML =
      '<div><h3>' + esc(h.name) + '</h3><p class="sauda">' + esc(h.title) + '. ' + esc(h.saudacao) + '</p><p>' + esc(h.blurb) + '</p><p>' + h.hp + ' de vida.</p></div>' +
      '<div><p class="lbl">Passiva</p><p>' + esc(h.passive) + '</p></div>' +
      '<div><p class="lbl">' + esc(h.ability.name) + ', recarga de ' + h.ability.cd + ' rodadas</p><p>' + esc(h.ability.desc) + '</p></div>';

    const pv = $('#provas');
    if (!sv.unlocked.provas) {
      pv.innerHTML = '<h3>Provações</h3><p class="locked-note">Vença a jornada uma vez para liberar desafios que mudam as regras e multiplicam o axé.</p>';
    } else {
      const mult = 1 + G.provasSel.reduce((a, q) => a + D.PROVACOES[q].mult, 0);
      pv.innerHTML = '<h3>Provações <span class="mult">multiplicador ×' + mult.toFixed(2).replace('.', ',') + '</span></h3><div class="prova-list"></div>';
      const list = pv.querySelector('.prova-list');
      for (const id of D.PROVA_ORDER) {
        const q = D.PROVACOES[id];
        const b = document.createElement('button');
        b.type = 'button';
        const on = G.provasSel.includes(id);
        b.className = 'prova';
        b.setAttribute('aria-pressed', String(on));
        b.innerHTML = '<b>' + esc(q.name) + ' <span class="pm">+' + Math.round(q.mult * 100) + '%</span></b>' + esc(q.desc);
        b.addEventListener('click', () => {
          G.provasSel = on ? G.provasSel.filter((x) => x !== id) : G.provasSel.concat([id]);
          sfx('select');
          renderHeroes('.prova-list .prova:nth-child(' + (D.PROVA_ORDER.indexOf(id) + 1) + ')');
        });
        list.appendChild(b);
      }
    }
  }

  /* -------------------------------------------------------------- jornada */

  function persistRun() {
    const sv = SV.get();
    sv.run = G.S && (G.S.phase === 'play' || G.S.phase === 'cross') ? G.S : null;
    SV.persist();
  }

  function startRun(opts) {
    const sv = SV.get();
    G.S = E.newRun(opts);
    if (opts.mode !== 'daily') {
      sv.lastHero = opts.hero;
      sv.lastProvas = (opts.provas || []).slice();
    }
    G.stack = ['title'];
    hideOverlays();
    show('game', false);
    persistRun();
    enterStage(true);
  }

  function confirmNewRun(fn) {
    if (SV.get().run) ask('Você tem uma jornada em andamento. Começar outra vai encerrá-la.', 'Começar outra', fn);
    else fn();
  }

  function continueRun() {
    const run = SV.get().run;
    if (!run) return;
    G.S = U.deepClone(run);
    G.stack = ['title'];
    hideOverlays();
    show('game', false);
    R.resetStage();
    updateHud();
    setMusicForStage();
    if (G.S.phase === 'cross') openCross();
    else discoverUnits();
  }

  function setMusicForStage() {
    if (!G.S) return;
    A.music(G.S.biome);
    A.setIntensity(G.S.biome === 'calunga' ? 0.6 : 0);
  }

  function enterStage(first) {
    const S = G.S;
    const def = D.STAGES[S.stageIdx];
    R.resetStage();
    G.targeting = null;
    G.selected = null;
    $('#feed').innerHTML = '';
    updateHud();
    setMusicForStage();
    if (def.boss) {
      banner('Terreiro ' + (S.stageIdx + 1) + ', ' + D.BIOMES[def.biome].name, 'Ikú, a Morte', 'Ikú: “Vim buscar o que é meu antes da hora.”', 2600);
      sfx('boss');
    } else {
      banner('Terreiro ' + (S.stageIdx + 1) + ' de ' + D.STAGES.length + ', ' + D.BIOMES[def.biome].name, def.name, first ? D.HEROES[S.hero].saudacao : '', 1800);
    }
    discoverUnits();
    if (S.stageIdx === 0) tip('start');
    if (S.stageIdx === 1) tip('wait');
  }

  function discoverUnits() {
    for (const u of G.S.units) discover(u.type);
  }

  function discover(type) {
    const sv = SV.get();
    if (sv.seen.enemies[type]) return;
    sv.seen.enemies[type] = true;
    SV.persist();
    const e = D.ENEMIES[type];
    say('<b>Nova criatura: ' + esc(e.name) + '.</b> ' + esc(e.kind) + '. ' + esc(e.tip), 'new-enemy', type);
  }

  /* ------------------------------------------------------------------- HUD */

  function updateHud() {
    const S = G.S;
    if (!S) return;
    const p = S.player;
    const def = D.STAGES[S.stageIdx];
    $('#hud-stage').textContent = 'Terreiro ' + (S.stageIdx + 1) + ' de ' + D.STAGES.length;
    $('#hud-stage-name').textContent = def.name;
    let waves = '';
    for (let i = 0; i < S.waves.length; i++) {
      const cls = i < S.waveIdx - 1 || (i === S.waveIdx - 1 && S.portals.length === 0 && S.units.length === 0) ? 'done' : i === S.waveIdx - 1 ? 'now' : '';
      waves += '<i class="dot ' + cls + '"></i>';
    }
    let wtxt = 'Última onda';
    if (S.portals.length) wtxt = 'Onda chegando';
    else if (S.waveIdx < S.waves.length) wtxt = 'Próxima onda em ' + Math.max(1, E.waveTimer(S) - S.waveTimer);
    if (def.boss) {
      const iku = S.units.find((u) => u.type === 'iku');
      waves = '';
      wtxt = iku ? 'Ikú com ' + iku.hp + ' de ' + iku.maxHp : '';
    }
    $('#hud-waves').innerHTML = waves + '<span class="wtxt">' + wtxt + '</span>';
    $('#hud-waves').setAttribute('aria-label', 'Onda ' + Math.min(S.waveIdx, S.waves.length) + ' de ' + S.waves.length);
    const par = 6 + S.st.enemies * 3;
    $('#hud-turn').textContent = def.boss ? S.turn : S.turn + ' (meta ' + par + ')';
    $('#hud-score').textContent = fmt(S.score);

    const h = D.HEROES[S.hero];
    $('#hud-hero').innerHTML = img(S.hero, '', '') + '<div><div class="hn">' + esc(h.name) + '</div><div class="ho">' + esc(h.title) + '</div></div>';
    let hearts = '';
    for (let i = 0; i < p.maxHp; i++) hearts += '<img class="px' + (i < p.hp ? '' : ' lost') + '" src="' + icon(i < p.hp ? 'heart' : 'heartEmpty', 3) + '" alt="" />';
    if (p.guia && !p.guiaUsed) hearts += '<img class="px" title="Guia de Proteção ativa" src="' + icon('shield', 3) + '" alt="escudo" />';
    const hz = $('#hud-hearts');
    hz.innerHTML = hearts;
    hz.setAttribute('aria-label', 'Vida ' + p.hp + ' de ' + p.maxHp);

    const info = E.abilityInfo(S);
    const ready = info.ready;
    const how = G.touch
      ? info.target === 'none'
        ? 'Toque para usar.'
        : 'Toque para mirar, depois na direção, e confirme.'
      : '<kbd>Espaço</kbd> ' + (info.target === 'none' ? 'para usar.' : 'para mirar, de novo para usar.');
    const abHtml =
      '<span class="an">' + esc(info.name) + ' <span class="acd">' + (G.targeting ? 'mirando' : ready ? 'pronta' : 'pronta em ' + info.cd) + '</span></span>' +
      '<span class="ad">' + esc(info.desc) + '</span>' +
      '<span class="ad">' + how + '</span>';
    for (const id of ['#btn-ability', '#btn-ability-m']) {
      const b = $(id);
      b.innerHTML = abHtml;
      b.classList.toggle('ready', ready && !G.targeting);
      b.classList.toggle('targeting', !!G.targeting);
    }
    let bl = '';
    if (S.boons.length) {
      bl += '<div class="bl-title">Dádivas</div>';
      for (const id of S.boons) {
        const b = D.BOONS[id];
        bl += '<div class="boon-chip" tabindex="0">' + '<img class="px" src="' + icon(b.icon, 3) + '" alt="" /><span>' + esc(b.name) + '</span><div class="bd"><b>' + esc(b.name) + '</b><br>' + esc(b.desc) + '</div></div>';
      }
    }
    $('#hud-boons').innerHTML = bl;
    updateInspect();
  }

  function intentText(u) {
    const it = u.intent;
    if (!it) return null;
    switch (it.k) {
      case 'melee':
        return 'Vai golpear a casa marcada: ' + it.dmg + ' de dano.';
      case 'sweep':
        return 'Golpe pesado nas 3 casas marcadas: ' + it.dmg + ' de dano. Só recuar escapa.';
      case 'line':
        return 'Vai atirar em linha reta: acerta a primeira criatura no caminho (' + it.dmg + ' de dano).';
      case 'charge':
        return 'Vai disparar pela faixa marcada e atropelar quem estiver nela (' + it.dmg + ' de dano).';
      case 'aoe':
        return 'Maldição em X sobre as casas marcadas: ' + it.dmg + ' de dano e fogo.';
      case 'multi':
        return 'Sentença: maldições em X sobre todas as casas marcadas.';
      case 'spin':
        return 'Vai rodopiar e acertar as 4 casas ao redor (' + it.dmg + ' de dano).';
      case 'summon':
        return 'Vai fazer brotar um Kiumba na casa tracejada. Fique em cima dela para impedir.';
    }
    return null;
  }

  function updateInspect() {
    const S = G.S;
    const box = $('#inspect');
    if (!S || !box) return;
    const t = G.hover || G.selected;
    let html = '';
    if (t) {
      const u = E.unitAt(S, t.x, t.y);
      const portal = S.portals.find((q) => q.x === t.x && q.y === t.y);
      if (u) {
        const e = D.ENEMIES[u.type];
        const it = intentText(u);
        html =
          '<div class="ih">' + img(u.type, '', '') + '<div><div class="iname">' + esc(e.name) + '</div><div class="ikind">' + esc(e.kind) + ', ' + u.hp + ' de ' + u.maxHp + ' de vida</div></div></div>' +
          '<div>' + esc(e.desc) + '</div>' +
          (it ? '<div class="iint">' + esc(it) + '</div>' : '<div class="iint calm">Sem ataque preparado.</div>') +
          (u.stun > 0 ? '<div class="iint calm">' + (u.exposed ? 'Atordoada: o próximo golpe causa dano dobrado.' : 'Tonto: perde a próxima rodada.') + '</div>' : '') +
          (u.burn > 0 ? '<div class="iint calm">Queimando: perde 1 de vida no fim da rodada.</div>' : '');
      } else if (S.player.x === t.x && S.player.y === t.y) {
        const h = D.HEROES[S.hero];
        html = '<div class="ih">' + img(S.hero, '', '') + '<div><div class="iname">' + esc(h.name) + '</div><div class="ikind">' + S.player.hp + ' de ' + S.player.maxHp + ' de vida, golpe de ' + E.strikeDamage(S) + '</div></div></div><div>' + esc(h.passive) + '</div>';
      } else if (portal) {
        html = '<div class="ih">' + img(portal.type, '', '') + '<div><div class="iname">Chegada</div><div class="ikind">' + esc(D.ENEMIES[portal.type].name) + ' surge aqui no fim da rodada.</div></div></div>';
      } else {
        const tt = E.tileAt(S, t.x, t.y);
        const fire = S.fire[E.idx(t.x, t.y)];
        const names = { [E.FLOOR]: 'Chão', [E.WALL]: wallName(S), [E.WATER]: 'Rio', [E.THORN]: 'Espinhos' };
        const desc = {
          [E.FLOOR]: 'Livre para andar.',
          [E.WALL]: 'Bloqueia passagem e tiros. Empurrar uma criatura contra isto causa 1 de dano.',
          [E.WATER]: 'Ninguém atravessa. Criatura empurrada para o rio é levada pela correnteza.',
          [E.THORN]: 'Quem pisa aqui sofre 1 de dano.',
        };
        html = '<div class="iname">' + names[tt] + '</div><div>' + desc[tt] + '</div>' + (fire ? '<div class="iint">Em chamas por mais ' + fire + (fire === 1 ? ' rodada' : ' rodadas') + '. Quem terminar o turno aqui sofre 1 de dano.</div>' : '');
        if (S.rainMarks.some((m) => m.x === t.x && m.y === t.y)) html += '<div class="iint">Brasas vão cair aqui no fim da rodada.</div>';
      }
    } else {
      html = G.touch
        ? '<div class="muted">Segure o dedo numa casa para ver o que há nela e o que cada inimigo vai fazer.</div>'
        : '<div class="muted">Passe o mouse numa casa para ver o que há nela e o que cada inimigo vai fazer.</div>';
    }
    box.innerHTML = html;
  }

  function wallName(S) {
    return { mata: 'Árvore', rio: 'Pedra', pedreira: 'Rocha', calunga: 'Lápide' }[S.biome];
  }

  /* ---------------------------------------------------------- banner e avisos */

  let bannerTimer = null;
  function banner(a, b, c, ms) {
    const el = $('#banner');
    el.innerHTML = '<div class="b1">' + esc(a) + '</div><div class="b2">' + esc(b) + '</div>' + (c ? '<div class="b3">' + esc(c) + '</div>' : '');
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), ms || 1800);
  }

  function toast(html, cls, ms) {
    G.toastQ.push({ html, cls, ms: ms || 3600 });
    pumpToast();
  }
  function pumpToast() {
    if (G.toastBusy || !G.toastQ.length) return;
    const t = G.toastQ.shift();
    const el = $('#toast');
    if (G.screen !== 'game') {
      // Fora do jogo, avisos aparecem no topo da página atual.
      const tmp = document.createElement('div');
      tmp.className = 'toast show ' + (t.cls || '');
      tmp.style.position = 'fixed';
      tmp.innerHTML = t.html;
      document.body.appendChild(tmp);
      setTimeout(() => tmp.remove(), t.ms);
      return pumpToast();
    }
    G.toastBusy = true;
    el.className = 'toast show ' + (t.cls || '');
    el.innerHTML = t.html;
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => {
        G.toastBusy = false;
        pumpToast();
      }, 260);
    }, t.ms);
  }

  // Painel de mensagens ao lado do tabuleiro: nunca cobre a ação.
  function say(html, kind, sprite) {
    const feed = $('#feed');
    if (!feed) return;
    const m = document.createElement('div');
    m.className = 'msg fresh ' + (kind || '');
    m.innerHTML = (sprite ? img(sprite, '', '') : '') + '<div>' + html + '</div>';
    feed.prepend(m);
    while (feed.children.length > 3) feed.lastChild.remove();
    setTimeout(() => m.classList.remove('fresh'), 1600);
  }

  function tip(id) {
    const sv = SV.get();
    if (!sv.settings.hints || sv.seen.tips[id]) return;
    sv.seen.tips[id] = true;
    SV.persist();
    const t = D.TIPS[id];
    say('<b>Dica.</b> ' + esc(G.touch && t.touch ? t.touch : t.key), 'tip');
  }

  /* -------------------------------------------------------------- confirmação */

  function ask(text, yesLabel, onYes) {
    const ov = document.createElement('div');
    ov.className = 'overlay fixed';
    ov.innerHTML = '<div class="dialog small" role="alertdialog"><p>' + esc(text) + '</p><div class="menu"><button class="btn danger" type="button" data-y>' + esc(yesLabel) + '</button><button class="btn" type="button" data-n>Cancelar</button></div></div>';
    document.body.appendChild(ov);
    const close = () => {
      ov.remove();
      G.ask = null;
    };
    ov.querySelector('[data-y]').addEventListener('click', () => {
      close();
      onYes();
    });
    ov.querySelector('[data-n]').addEventListener('click', () => {
      sfx('back');
      close();
    });
    G.ask = close;
    ov.querySelector('[data-n]').focus();
  }

  /* --------------------------------------------------------------- ações */

  // Destaca o que mais importa no jogo: inimigos derrotados por outros e golpes múltiplos.
  function celebrate(evs, byPlayer) {
    const deaths = evs.filter((e) => e.t === 'die' && e.cause !== 'banish');
    let combo = false;
    for (const d of deaths) {
      if (d.cause === 'enemy') {
        R.text(d.x, d.y, 'fogo amigo!', '#ffe08a', true);
        combo = true;
      } else if (d.cause === 'colisao' || d.cause === 'espinhos') {
        R.text(d.x, d.y, 'esmagado!', '#ffe08a', true);
        combo = true;
      }
    }
    if (byPlayer && deaths.length >= 2) {
      const p = G.S.player;
      R.text(p.x, p.y, deaths.length >= 3 ? 'TRIPLO!' : 'DUPLO!', '#7dffde', true);
      combo = true;
    }
    if (combo) sfx('combo');
  }

  function playEvents(evs, byPlayer) {
    const S = G.S;
    celebrate(evs, byPlayer);
    for (const ev of evs) {
      R.handle(ev, S);
      switch (ev.t) {
        case 'step':
          sfx('step');
          break;
        case 'hit':
          sfx(ev.crit ? 'crit' : 'hit');
          break;
        case 'die':
          sfx('kill');
          if (ev.cause === 'enemy') tip('friendly');
          break;
        case 'hurt':
          sfx('hurt');
          buzz(45);
          $('#hud-hearts').classList.remove('hit');
          void $('#hud-hearts').offsetWidth;
          $('#hud-hearts').classList.add('hit');
          break;
        case 'intent':
          if (ev.onPlayer) {
            sfx('telegraph');
            tip('telegraph');
          }
          break;
        case 'portal':
          sfx('portal');
          tip('wave');
          break;
        case 'spawn': {
          sfx('spawn');
          const u = E.getUnit(S, ev.id);
          if (u) discover(u.type);
          break;
        }
        case 'bossPhase':
          sfx('boss');
          A.setIntensity(0.6 + ev.phase * 0.15);
          if (ev.line) banner('Ikú desperta', 'Fase ' + ev.phase, ev.line, 2400);
          break;
        case 'exposed':
          say('Ikú está <b>atordoada</b>: o próximo golpe que ela sofrer causa dano dobrado!', 'alert');
          break;
        default:
          if (['block', 'shot', 'arrow', 'dash', 'lightning', 'wind', 'curse', 'miss', 'heal', 'splash', 'bump', 'free', 'ignite'].includes(ev.t)) sfx(ev.t);
          if (ev.t === 'attack' && ev.k === 'spin') sfx('spin');
          if (ev.t === 'dash' && ev.id != null) sfx('charge');
      }
    }
  }

  function stepDelay(evs) {
    const fast = settings().fast;
    let ms = 70;
    for (const ev of evs) {
      if (['attack', 'shot', 'curse', 'dash', 'hurt', 'die', 'appear', 'spawn', 'bossPhase'].includes(ev.t)) ms = Math.max(ms, 170);
      else if (ev.t === 'move' || ev.t === 'intent') ms = Math.max(ms, 110);
    }
    return fast ? ms * 0.5 : ms;
  }

  function tryAction(a) {
    const S = G.S;
    if (!S || S.phase !== 'play' || G.overlay) return;
    if (G.busy) {
      if (a.k !== 'ability') G.queued = a;
      return;
    }
    const r = E.act(S, a);
    if (!r.ok) {
      sfx('back');
      return;
    }
    G.targeting = null;
    playEvents(r.events, true);
    updateHud();
    if (r.free) {
      persistRun();
      afterTurn();
      return;
    }
    commitFuture(S);
    runEnemies();
  }

  // Salva o desfecho da rodada antes de animá-la: recarregar a página no meio não desfaz nada.
  function commitFuture(S) {
    const fut = U.deepClone(S);
    E.runEnemyPhase(fut);
    if (fut.phase === 'dead' || fut.phase === 'won') {
      S.recorded = finishRun(fut);
    } else {
      SV.get().run = fut;
      SV.persist();
    }
  }

  async function runEnemies() {
    const S = G.S;
    G.busy = true;
    await sleep(settings().fast ? 40 : 90);
    if (S.phase === 'play') {
      for (const ev of E.enemyPhase(S)) {
        if (G.S !== S) return;
        playEvents(ev);
        updateHud();
        await sleep(stepDelay(ev));
        if (S.phase !== 'play') break;
      }
    }
    G.busy = false;
    updateHud();
    afterTurn();
  }

  function afterTurn() {
    const S = G.S;
    if (!S) return;
    if (S.phase === 'play') {
      persistRun();
      const p = S.player;
      if (p.hp <= 2 && p.hp < p.maxHp) tip('lowhp');
      if (p.cd === 0 && S.turn >= 2) tip('ability');
      if (S.turn >= 1 && moveHints(S).some((h) => h.danger)) tip('danger');
      if (G.queued) {
        const a = G.queued;
        G.queued = null;
        tryAction(a);
      }
      return;
    }
    G.queued = null;
    if (S.phase === 'cross') {
      persistRun();
      const marks = SV.stageMarks(S);
      for (const m of marks) say('Marca conquistada: <b>' + esc(D.MARKS[m].name) + '.</b> ' + esc(D.MARKS[m].desc), 'mark');
      sfx('clear');
      banner('Terreiro fechado', D.STAGES[S.stageIdx].name, '+' + fmt(S.stageScores[S.stageScores.length - 1].total) + ' de axé', 1500);
      setTimeout(() => G.S === S && openCross(), 1100);
    } else if (S.phase === 'won' || S.phase === 'dead') {
      // Registra na hora: recarregar a página agora não pode desfazer o resultado.
      finishRun(S);
      const won = S.phase === 'won';
      sfx(won ? 'victory' : 'defeat');
      if (won) banner('Vitória', 'Ikú recua para o Orun', D.HEROES[S.hero].saudacao, 1900);
      else banner('Fim da jornada', S.cause === 'iku' ? 'Ikú levou você' : 'Os Ajogun venceram', '', 1600);
      setTimeout(() => G.S === S && openEnd(), won ? 2000 : 1500);
    }
  }

  /* ---------------------------------------------------------------- mira */

  function beginAbility() {
    const S = G.S;
    if (!S || S.phase !== 'play' || G.busy || G.overlay) return;
    if (G.targeting) {
      cancelTargeting();
      return;
    }
    const info = E.abilityInfo(S);
    if (!info.ready) {
      toast(esc(info.name) + ' recarrega em ' + info.cd + ' rodada(s).', '', 1600);
      sfx('back');
      return;
    }
    if (info.target === 'none') {
      tryAction({ k: 'ability' });
      return;
    }
    const targets = E.abilityTargets(S);
    G.targeting = { kind: info.target, sel: null, targets };
    if (info.target === 'tile') {
      // Começa mirando o inimigo mais próximo ao alcance.
      let best = null;
      let bd = 99;
      for (const t of targets) {
        if (!E.unitAt(S, t.x, t.y)) continue;
        const d = U.manhattan(t.x, t.y, S.player.x, S.player.y);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      G.targeting.sel = best || { x: S.player.x, y: S.player.y };
      say('Mirando: mova a mira com as setas ou o mouse. <kbd>Espaço</kbd> confirma, <kbd>Esc</kbd> cancela.', 'aim');
    } else {
      say('Mirando: escolha a direção (setas ou clique) e aperte de novo para confirmar. <kbd>Esc</kbd> cancela.', 'aim');
    }
    sfx('select');
    updateHud();
  }

  function cancelTargeting() {
    G.targeting = null;
    sfx('back');
    updateHud();
  }

  function confirmTargeting() {
    const t = G.targeting;
    if (!t || t.sel == null) return;
    if (t.kind === 'dir') tryAction({ k: 'ability', dir: t.sel });
    else tryAction({ k: 'ability', x: t.sel.x, y: t.sel.y });
  }

  function targetingKey(dir) {
    const t = G.targeting;
    if (t.kind === 'dir') {
      if (!t.targets.some((x) => x.dir === dir)) {
        sfx('back');
        return;
      }
      if (t.sel === dir) confirmTargeting();
      else {
        t.sel = dir;
        sfx('select');
      }
      return;
    }
    const nx = t.sel.x + DIRS[dir][0];
    const ny = t.sel.y + DIRS[dir][1];
    if (t.targets.some((q) => q.x === nx && q.y === ny)) t.sel = { x: nx, y: ny };
  }

  function dirToward(S, x, y) {
    const p = S.player;
    if (x === p.x && y !== p.y) return y < p.y ? 0 : 2;
    if (y === p.y && x !== p.x) return x > p.x ? 1 : 3;
    return -1;
  }

  // Casas vizinhas: onde dá para andar, onde há um golpe possível e quais passos levam ao perigo.
  function moveHints(S) {
    const p = S.player;
    const danger = new Set(E.threats(S).map((t) => t.x + ',' + t.y));
    const hints = [];
    for (let d = 0; d < 4; d++) {
      const x = p.x + DIRS[d][0];
      const y = p.y + DIRS[d][1];
      if (!E.inb(x, y)) continue;
      if (E.unitAt(S, x, y)) {
        hints.push({ x, y, dir: d, attack: true });
      } else if (E.isPassable(S, x, y)) {
        const burns = S.fire[E.idx(x, y)] > 1 && !p.fireproof && !p.polvora;
        hints.push({ x, y, dir: d, danger: danger.has(x + ',' + y) || burns || E.tileAt(S, x, y) === E.THORN });
      }
    }
    return hints;
  }

  function uiState() {
    const S = G.S;
    const st = settings();
    const out = { preview: null, targets: null, hints: null };
    if (!S || S.phase !== 'play') return out;
    const t = G.targeting;
    if (t) {
      if (t.kind === 'dir') {
        out.targets = t.targets.map((q) => [S.player.x + DIRS[q.dir][0], S.player.y + DIRS[q.dir][1]]);
        if (t.sel != null) out.preview = { tiles: E.abilityPreview(S, { dir: t.sel }) };
      } else {
        out.targets = t.targets.map((q) => [q.x, q.y]);
        if (t.sel) out.preview = { tiles: E.abilityPreview(S, t.sel) };
      }
      return out;
    }
    if (!st.hints || G.busy) return out;
    out.hints = moveHints(S);
    if (G.hover) {
      const d = dirToward(S, G.hover.x, G.hover.y);
      if (d >= 0 && U.manhattan(G.hover.x, G.hover.y, S.player.x, S.player.y) === 1 && E.unitAt(S, G.hover.x, G.hover.y)) {
        out.preview = { tiles: E.strikeTiles(S, d), color: 'rgba(255,255,255,0.14)' };
      }
    }
    return out;
  }

  /* --------------------------------------------------------------- entrada */

  const KEYDIR = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };

  function onKey(e) {
    A.ensure();
    applyAudioSettings();
    if (G.ask) {
      if (e.code === 'Escape') G.ask();
      return;
    }
    if (e.code === 'KeyM' && !(e.target && e.target.tagName === 'INPUT')) {
      toggleMute();
      return;
    }
    if (G.screen !== 'game') {
      if (e.code === 'Escape' && G.screen !== 'title') back();
      return;
    }
    if (G.overlay === 'cross') {
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code];
      if (n != null) {
        const opts = G.S.offer.concat(['rest']);
        if (opts[n]) chooseBoon(opts[n]);
      }
      return;
    }
    if (G.overlay === 'pause') {
      if (e.code === 'Escape') closePause();
      return;
    }
    if (G.overlay === 'end') {
      if (e.code === 'Enter' && e.target === document.body) $('#end-sheet [data-again]')?.click();
      return;
    }
    if (e.target && e.target.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) {
      // Botões focados respondem por conta própria.
      if (e.code === 'Space') e.preventDefault();
      e.target.blur();
    }
    const dir = KEYDIR[e.code];
    if (dir != null) {
      e.preventDefault();
      if (G.targeting) targetingKey(dir);
      else tryAction({ k: 'move', dir });
      return;
    }
    switch (e.code) {
      case 'Space':
      case 'KeyQ':
        e.preventDefault();
        if (G.targeting && G.targeting.sel != null) confirmTargeting();
        else beginAbility();
        break;
      case 'Enter':
      case 'NumpadEnter':
        if (G.targeting) confirmTargeting();
        break;
      case 'KeyE':
      case 'Period':
        if (!G.targeting) tryAction({ k: 'wait' });
        break;
      case 'Escape':
        if (G.targeting) cancelTargeting();
        else openPause();
        break;
    }
  }

  // Tabuleiro: o mouse passa por cima e clica; no toque, tocar anda, deslizar anda na direção
  // do gesto e segurar o dedo mostra o que há na casa sem agir.
  function setTouch(v) {
    if (G.touch === v) return;
    G.touch = v;
    if (G.S) updateHud();
  }

  function boardHover(e) {
    const S = G.S;
    if (!S || G.screen !== 'game') return;
    const t = R.pick(e.clientX, e.clientY);
    G.hover = t;
    R.hover = t;
    if (G.targeting && t) {
      if (G.targeting.kind === 'dir') {
        const d = dirToward(S, t.x, t.y);
        if (d >= 0 && G.targeting.targets.some((q) => q.dir === d)) G.targeting.sel = d;
      } else if (G.targeting.targets.some((q) => q.x === t.x && q.y === t.y)) G.targeting.sel = { x: t.x, y: t.y };
    }
    updateInspect();
  }

  function boardDown(e) {
    G.lastPointer = e.pointerType;
    setTouch(e.pointerType !== 'mouse');
    A.ensure();
    applyAudioSettings();
    const press = { x: e.clientX, y: e.clientY, long: false };
    if (e.pointerType !== 'mouse') {
      press.timer = setTimeout(() => {
        press.long = true;
        longPress(press.x, press.y);
      }, 420);
    }
    G.press = press;
  }

  function boardMove(e) {
    const p = G.press;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12) clearTimeout(p.timer);
    if (e.pointerType === 'mouse') boardHover(e);
  }

  function boardUp(e) {
    const p = G.press;
    G.press = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.long) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const tileCss = R.tile / R.dpr;
    if (Math.hypot(dx, dy) > Math.max(24, tileCss * 0.45)) swipe(dx, dy);
    else boardTap(e);
  }

  function swipe(dx, dy) {
    if (!G.S || G.overlay || G.screen !== 'game') return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
    if (G.targeting) targetingKey(dir);
    else tryAction({ k: 'move', dir });
  }

  function longPress(cx, cy) {
    const t = R.pick(cx, cy);
    if (!t || !G.S) return;
    G.selected = t;
    R.hover = t;
    updateInspect();
    buzz(12);
  }

  function boardTap(e) {
    const S = G.S;
    if (!S || G.screen !== 'game') return;
    const t = R.pick(e.clientX, e.clientY);
    if (!t || G.overlay) return;
    if (G.targeting) {
      // No toque não há "passar por cima": o primeiro toque mostra a prévia, o segundo confirma.
      const touch = (e.pointerType || G.lastPointer) !== 'mouse';
      if (G.targeting.kind === 'dir') {
        const d = dirToward(S, t.x, t.y);
        if (d >= 0 && G.targeting.targets.some((q) => q.dir === d)) {
          if (touch && G.targeting.sel !== d) {
            G.targeting.sel = d;
            sfx('select');
          } else {
            G.targeting.sel = d;
            confirmTargeting();
          }
        } else cancelTargeting();
      } else if (G.targeting.targets.some((q) => q.x === t.x && q.y === t.y)) {
        const same = G.targeting.sel && G.targeting.sel.x === t.x && G.targeting.sel.y === t.y;
        G.targeting.sel = { x: t.x, y: t.y };
        if (touch && !same) sfx('select');
        else confirmTargeting();
      } else cancelTargeting();
      return;
    }
    const d = dirToward(S, t.x, t.y);
    if (d >= 0 && U.manhattan(t.x, t.y, S.player.x, S.player.y) === 1) {
      tryAction({ k: 'move', dir: d });
      return;
    }
    G.selected = t;
    if (e.pointerType !== 'mouse') R.hover = t;
    updateInspect();
  }

  function buzz(ms) {
    if (!G.touch || !settings().shake || !navigator.vibrate) return;
    try {
      navigator.vibrate(ms);
    } catch (err) {
      /* vibração é só um enfeite */
    }
  }

  function toggleMute() {
    const st = settings();
    st.muted = !st.muted;
    SV.persist();
    applyAudioSettings();
    toast(st.muted ? 'Som desligado' : 'Som ligado', '', 1200);
  }

  /* ------------------------------------------------------------ encruzilhada */

  function hideOverlays() {
    for (const id of ['#ov-cross', '#ov-pause', '#ov-end']) $(id).hidden = true;
    G.overlay = null;
  }

  function scoreRows(parts) {
    const names = { clear: 'Terreiro fechado', kills: 'Inimigos derrotados', speed: 'Rapidez', flawless: 'Corpo fechado, sem dano', tricks: 'Fogo amigo, rio e batidas' };
    let h = '';
    for (const k of Object.keys(names)) if (parts[k]) h += '<div class="row"><span>' + names[k] + '</span><span class="v">+' + fmt(parts[k]) + '</span></div>';
    return h;
  }

  function openCross() {
    const S = G.S;
    G.overlay = 'cross';
    const sc = S.stageScores[S.stageScores.length - 1];
    $('#stage-result').innerHTML = sc
      ? '<h3>Terreiro ' + sc.stage + ', ' + esc(D.STAGES[sc.stage - 1].name) + '</h3>' + scoreRows(sc.parts) + '<div class="row total"><span>Total do terreiro</span><span class="v">+' + fmt(sc.total) + '</span></div><div class="row"><span>Axé acumulado</span><span class="v">' + fmt(S.score) + '</span></div><div class="row"><span>Rodadas, meta de ' + sc.par + '</span><span class="v">' + sc.turns + '</span></div><div class="row"><span>Vida</span><span class="v">' + S.player.hp + ' de ' + S.player.maxHp + '</span></div>'
      : '';
    const box = $('#boon-choices');
    box.innerHTML = '';
    const opts = S.offer.concat(['rest']);
    opts.forEach((id, i) => {
      const b = document.createElement('button');
      const rest = id === 'rest';
      const def = rest ? { name: 'Banho de Ervas', icon: 'rest', desc: 'Cura 2 de vida. Agora você tem ' + S.player.hp + ' de ' + S.player.maxHp + '.' } : D.BOONS[id];
      b.type = 'button';
      b.className = 'boon-card' + (rest ? ' rest' : '');
      b.innerHTML = '<img class="px" src="' + icon(def.icon, 4) + '" alt="" /><div><b>' + esc(def.name) + '</b><div class="bdesc">' + esc(def.desc) + '</div></div><kbd class="bkey">' + (i + 1) + '</kbd>';
      b.addEventListener('click', () => chooseBoon(id));
      box.appendChild(b);
    });
    $('#ov-cross').hidden = false;
    setTimeout(() => box.querySelector('button')?.focus(), 30);
  }

  function chooseBoon(id) {
    const S = G.S;
    if (!S || S.phase !== 'cross') return;
    if (!E.choose(S, id)) return;
    sfx(id === 'rest' ? 'heal' : 'boon');
    hideOverlays();
    persistRun();
    enterStage(false);
  }

  /* ------------------------------------------------------------------ pausa */

  function openPause() {
    if (G.overlay) return;
    G.overlay = 'pause';
    $('#ov-pause').hidden = false;
    $('#btn-resume').focus();
  }
  function closePause() {
    $('#ov-pause').hidden = true;
    G.overlay = null;
  }

  /* ------------------------------------------------------------ fim de jornada */

  const EPILOGUE = {
    ogum: 'Kayode abriu de novo o caminho entre os mundos. Ogunhê!',
    oxossi: 'Ayo acertou a única flecha que importava. Okê Arô!',
    xango: 'Tunde fez justiça com o fogo do trovão. Kaô Kabecilê!',
    iansa: 'Folake soprou Ikú de volta ao Orun. Eparrei, Oyá!',
  };

  function finishRun(S) {
    if (!S.final) S.final = E.finalScore(S, S.phase === 'won');
    if (!S.recorded) S.recorded = SV.recordRun(S);
    return S.recorded;
  }

  function openEnd() {
    const S = G.S;
    const won = S.phase === 'won';
    const rec = finishRun(S);
    G.overlay = 'end';
    const f = S.final;
    const h = D.HEROES[S.hero];
    const cause = S.cause;
    const enemy = D.ENEMIES[cause];
    const parts = { clear: 0, kills: 0, speed: 0, flawless: 0, tricks: 0 };
    for (const sc of S.stageScores) for (const k in parts) parts[k] += sc.parts[k];
    let head;
    if (won) {
      head = img(S.hero, '', '') + '<div><h2>Ikú recua para o Orun</h2><p>' + esc(EPILOGUE[S.hero]) + ' A aldeia amanhece em paz.</p></div>';
    } else {
      const title = cause === 'iku' ? 'Ikú levou você' : cause === 'desistencia' ? 'Jornada interrompida' : 'Os Ajogun venceram desta vez';
      head = (enemy ? img(cause, '', '') : img('skull', '', '')) + '<div><h2>' + title + '</h2><p>' + esc(h.name) + ' caiu no terreiro ' + (S.stageIdx + 1) + ', ' + esc(D.STAGES[S.stageIdx].name) + (enemy ? ', derrotado por ' + esc(enemy.name) : '') + '.</p></div>';
    }
    const lesson = won ? '' : cause === 'desistencia' ? 'Toda jornada ensina. Experimente outro filho de santo ou outras dádivas.' : D.DEATH_LESSONS[cause] || D.DEATH_LESSONS.default;
    let flags = '';
    if (rec.newBest) flags += '<span class="flag">Novo recorde de ' + esc(h.name) + '</span>';
    if (rec.newDaily) flags += '<span class="flag">Seu melhor no Desafio do Dia</span>';
    if (S.mode === 'custom') flags += '<span class="flag">Semente escolhida, não conta para recordes</span>';
    for (const u of rec.unlocks) flags += '<span class="flag">' + (u === 'iansa' ? 'Iansã respondeu ao seu chamado: Folake está liberada' : 'Provações liberadas na escolha de caminho') + '</span>';
    for (const m of rec.marks) flags += '<span class="flag">Marca conquistada: ' + esc(D.MARKS[m].name) + '</span>';
    const boons = S.boons.length ? S.boons.map((b) => esc(D.BOONS[b].name)).join(', ') : 'nenhuma';
    // Um motivo concreto para a próxima jornada.
    const sv = SV.get();
    const goals = [];
    const best = sv.heroes[S.hero].best;
    if (!rec.newBest && best > f.total && S.mode !== 'custom') goals.push('Faltaram <b>' + fmt(best - f.total) + '</b> de axé para o seu recorde com ' + esc(h.name) + ', que é de ' + fmt(best) + '.');
    const order = ['primeiro', 'iku', 'corpofechado', 'discordia', 'correnteza', 'ligeiro', 'porumfio', 'provado', 'lenda', 'todos', 'diario'];
    const next = order.find((m) => !sv.marks[m]);
    if (next) goals.push('Próxima marca, <b>' + esc(D.MARKS[next].name) + '</b>: ' + esc(lowerFirst(D.MARKS[next].desc)));
    if (!sv.unlocked.iansa) goals.push('Vença uma vez para liberar <b>Folake, filha de Iansã</b>, e as provações.');
    const noWin = D.HERO_ORDER.filter((id) => sv.heroes[id].wins === 0 && (id !== 'iansa' || sv.unlocked.iansa));
    if (won && noWin.length) goals.push('Ainda sem vitória com ' + noWin.map((id) => esc(D.HEROES[id].name)).join(', ') + '.');
    const st = S.st || {};
    const row = (k, v) => '<div class="row"><span>' + k + '</span><span class="v">' + v + '</span></div>';
    $('#end-sheet').innerHTML =
      '<div class="end-head">' + head + '<div class="rank" aria-label="Nota ' + f.rank + '">' + f.rank + '</div></div>' +
      (lesson ? '<p class="lesson"><b>Lição.</b> ' + esc(lesson) + '</p>' : '') +
      (flags ? '<div class="flags">' + flags + '</div>' : '') +
      (goals.length ? '<div class="goals">' + goals.map((g) => '<p>' + g + '</p>').join('') + '</div>' : '') +
      '<div class="end-grid"><div class="box"><h3>Axé</h3>' + scoreRows(parts) +
      (f.victory ? row('Vitória sobre Ikú', '+' + fmt(f.victory)) : '') +
      (f.life ? row('Vida restante', '+' + fmt(f.life)) : '') +
      (f.mult > 1 ? row('Provações', '×' + f.mult.toFixed(2).replace('.', ',')) : '') +
      '<div class="row total"><span>Total</span><span class="v">' + fmt(f.total) + '</span></div></div>' +
      '<div class="box"><h3>Jornada</h3>' +
      row('Terreiros fechados', S.stageScores.length + ' de ' + D.STAGES.length) +
      row('Rodadas', S.tot.turns) +
      row('Inimigos derrotados', S.tot.kills + S.tot.ff + S.tot.env + (won ? 0 : (st.kills || 0) + (st.ff || 0) + (st.env || 0))) +
      row('Dano sofrido', S.tot.dmg + (won ? 0 : st.dmg || 0)) +
      row('Dádivas', boons) +
      (S.provas.length ? row('Provações', S.provas.map((q) => esc(D.PROVACOES[q].name)).join(', ')) : '') +
      '</div></div>' +
      '<div class="end-actions"><button class="btn primary" type="button" data-again>' + (won ? 'Jogar de novo' : 'Tentar de novo') + ' <small>' + esc(h.name) + (S.mode === 'daily' ? ', mesmo desafio' : ', caminho novo') + '</small></button><button class="btn" type="button" data-heroes>Trocar de herói</button><button class="link" type="button" data-menu>Voltar ao início</button></div>';
    $('#ov-end').hidden = false;
    const again = $('#end-sheet [data-again]');
    again.addEventListener('click', () => {
      if (S.mode === 'daily') startRun({ hero: S.hero, provas: S.provas, seed: S.seed, mode: 'daily' });
      else startRun({ hero: S.hero, provas: S.provas, mode: 'normal' });
    });
    $('#end-sheet [data-heroes]').addEventListener('click', () => {
      hideOverlays();
      G.S = null;
      G.stack = ['title'];
      show('heroes', false);
    });
    $('#end-sheet [data-menu]').addEventListener('click', () => {
      hideOverlays();
      G.S = null;
      G.stack = [];
      show('title', false);
    });
    setTimeout(() => again.focus(), 50);
  }

  /* ------------------------------------------------------------------ diário */

  function renderJournal(tab) {
    const sv = SV.get();
    $$('#journal-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    const body = $('#journal-body');
    if (tab === 'records') {
      let h = '<div class="rec-grid">';
      for (const id of D.HERO_ORDER) {
        const r = sv.heroes[id];
        const hero = D.HEROES[id];
        const locked = id === 'iansa' && !sv.unlocked.iansa;
        h +=
          '<div class="rec">' + img(id, locked ? 'locked' : '', '') +
          '<p class="rname">' + (locked ? 'Bloqueada' : esc(hero.name)) + '</p><p class="muted">' + esc(hero.title) + '</p>' +
          '<p class="big">' + (r.best ? fmt(r.best) : '0') + '</p>' +
          '<p>' + (r.bestRank ? 'Nota ' + r.bestRank + '. ' : '') + r.wins + (r.wins === 1 ? ' vitória' : ' vitórias') + ' em ' + r.runs + (r.runs === 1 ? ' jornada' : ' jornadas') + '</p>' +
          (r.fastest ? '<p class="muted">Vitória mais rápida em ' + r.fastest + ' rodadas</p>' : '') +
          '</div>';
      }
      h += '</div>';
      const di = SV.dailyInfo();
      const dr = sv.daily[di.key];
      const deaths = Object.entries(sv.stats.deathsByStage).sort((a, b) => b[1] - a[1])[0];
      h +=
        '<div class="stats-line">' +
        '<p>' + sv.stats.runs + (sv.stats.runs === 1 ? ' jornada' : ' jornadas') + ', ' + sv.stats.wins + (sv.stats.wins === 1 ? ' vitória' : ' vitórias') + ', ' + fmt(sv.stats.kills) + ' inimigos derrotados em ' + fmt(sv.stats.turns) + ' rodadas.</p>' +
        (sv.stats.bestStage ? '<p>Terreiro mais distante: ' + sv.stats.bestStage + '.' + (deaths ? ' Onde você mais cai: terreiro ' + deaths[0] + '.' : '') + '</p>' : '') +
        '<p>Desafio do Dia de ' + di.key.split('-').reverse().join('/') + ': ' + (dr ? fmt(dr.best) + ' de axé, nota ' + dr.rank + (dr.won ? ', vencido' : '') + ', em ' + dr.tries + (dr.tries === 1 ? ' tentativa.' : ' tentativas.') : 'ainda não jogado.') + '</p>' +
        '</div>';
      body.innerHTML = h;
    } else if (tab === 'marks') {
      const n = Object.keys(sv.marks).length;
      let h = '<p class="muted">' + n + ' de ' + Object.keys(D.MARKS).length + ' marcas conquistadas.</p><div class="marks">';
      for (const [id, m] of Object.entries(D.MARKS)) h += '<div class="mark' + (sv.marks[id] ? ' done' : '') + '"><b>' + esc(m.name) + '</b>' + esc(m.desc) + (sv.marks[id] ? ' Conquistada.' : '') + '</div>';
      body.innerHTML = h + '</div>';
    } else if (tab === 'bestiary') {
      let h = '<div class="bestiary">';
      for (const [id, e] of Object.entries(D.ENEMIES)) {
        const seen = sv.seen.enemies[id];
        h += '<div class="beast' + (seen ? '' : ' unknown') + '">' + img(id, '', '') + '<div>' + (seen ? '<b>' + esc(e.name) + '</b><p class="muted">' + esc(e.kind) + ', ' + e.hp + ' de vida</p><p>' + esc(e.desc) + '</p><p class="tip">' + esc(e.tip) + '</p>' : '<b>Desconhecida</b><p class="muted">Ainda não encontrada.</p>') + '</div></div>';
      }
      body.innerHTML = h + '</div>';
    } else {
      if (!sv.history.length) {
        body.innerHTML = '<p class="muted">Nenhuma jornada terminada ainda.</p>';
        return;
      }
      let h = '<table class="history"><tr><th>Data</th><th>Herói</th><th>Modo</th><th>Chegou a</th><th class="num">Axé</th><th>Nota</th></tr>';
      for (const r of sv.history) h += '<tr><td>' + esc(r.date.split('-').reverse().join('/')) + '</td><td>' + esc(D.HEROES[r.hero].name) + '</td><td>' + (r.mode === 'daily' ? 'Desafio do Dia' : r.mode === 'custom' ? 'Semente' : 'Normal') + '</td><td>' + (r.won ? 'Vitória' : 'Terreiro ' + r.stage) + '</td><td class="num">' + fmt(r.score) + '</td><td>' + esc(r.rank) + '</td></tr>';
      body.innerHTML = h + '</table>';
    }
  }

  /* ------------------------------------------------------------------ opções */

  function renderOptions() {
    const st = settings();
    $('#opt-sfx').value = st.sfx;
    $('#opt-music').value = st.music;
    $('#opt-fast').checked = st.fast;
    $('#opt-shake').checked = st.shake;
    $('#opt-hints').checked = st.hints;
    $('#storage-note').textContent = SV.storageOk() ? 'O progresso fica salvo neste navegador.' : 'Este navegador não permite salvar: o progresso dura só até fechar a página.';
  }

  function bindOptions() {
    const st = () => settings();
    $('#opt-sfx').addEventListener('input', (e) => {
      st().sfx = Number(e.target.value);
      st().muted = false;
      applyAudioSettings();
      SV.persist();
      sfx('select');
    });
    $('#opt-music').addEventListener('input', (e) => {
      st().music = Number(e.target.value);
      st().muted = false;
      applyAudioSettings();
      SV.persist();
    });
    $('#opt-fast').addEventListener('change', (e) => {
      st().fast = e.target.checked;
      SV.persist();
    });
    $('#opt-shake').addEventListener('change', (e) => {
      st().shake = e.target.checked;
      R.reduceMotion = !e.target.checked;
      SV.persist();
    });
    $('#opt-hints').addEventListener('change', (e) => {
      st().hints = e.target.checked;
      SV.persist();
    });
    $('#btn-reset').addEventListener('click', () =>
      ask('Apagar recordes, marcas, desbloqueios e a jornada em andamento? Isso não pode ser desfeito.', 'Apagar tudo', () => {
        SV.reset();
        G.S = null;
        applyAudioSettings();
        renderOptions();
        toast('Progresso apagado.', '', 1800);
      })
    );
  }

  /* ------------------------------------------------------------------ início */

  function bind() {
    const play = () => {
      sfx('select');
      G.provasSel = SV.get().lastProvas.slice();
      G.heroSel = SV.get().lastHero;
      show('heroes');
    };
    $('#btn-new').addEventListener('click', play);
    $('#btn-foot-play').addEventListener('click', () => (SV.get().run ? continueRun() : play()));
    $('#btn-continue').addEventListener('click', () => {
      sfx('select');
      continueRun();
    });
    $('#btn-daily').addEventListener('click', () => {
      sfx('select');
      const di = SV.dailyInfo();
      confirmNewRun(() => startRun({ hero: di.hero, provas: di.provas, seed: di.seed, mode: 'daily' }));
    });
    for (const id of ['#btn-journal', '#btn-foot-journal'])
      $(id).addEventListener('click', () => {
        sfx('select');
        show('journal');
      });
    $('#btn-options').addEventListener('click', () => {
      sfx('select');
      show('options');
    });
    $$('[data-back]').forEach((b) => b.addEventListener('click', back));
    $('#btn-start').addEventListener('click', () => {
      sfx('select');
      const seed = $('#seed-input').value.trim();
      const opts = { hero: G.heroSel, provas: G.provasSel.slice(), mode: seed ? 'custom' : 'normal' };
      if (seed) opts.seed = 'semente-' + seed;
      confirmNewRun(() => startRun(opts));
    });
    $$('#journal-tabs button').forEach((b) =>
      b.addEventListener('click', () => {
        sfx('select');
        renderJournal(b.dataset.tab);
      })
    );

    $('#btn-ability').addEventListener('click', () => beginAbility());
    $('#btn-ability-m').addEventListener('click', () => beginAbility());
    $('#btn-wait').addEventListener('click', () => tryAction({ k: 'wait' }));
    $('#btn-wait-m').addEventListener('click', () => tryAction({ k: 'wait' }));
    $('#btn-pause').addEventListener('click', openPause);
    $('#btn-sound').addEventListener('click', toggleMute);
    $('#btn-resume').addEventListener('click', closePause);
    $('#btn-pause-help').addEventListener('click', () => show('help'));
    $('#btn-pause-options').addEventListener('click', () => show('options'));
    $('#btn-pause-menu').addEventListener('click', () => {
      persistRun();
      hideOverlays();
      G.S = null;
      G.stack = [];
      show('title', false);
    });
    $('#btn-abandon').addEventListener('click', () =>
      ask('Abandonar a jornada? Ela conta como derrota.', 'Abandonar', () => {
        closePause();
        E.giveUp(G.S);
        openEnd();
      })
    );

    const cv = $('#board');
    cv.addEventListener('pointermove', boardMove);
    cv.addEventListener('pointerleave', () => {
      G.hover = null;
      R.hover = null;
      updateInspect();
    });
    cv.addEventListener('pointerdown', boardDown);
    cv.addEventListener('pointerup', boardUp);
    cv.addEventListener('pointercancel', () => {
      if (G.press) clearTimeout(G.press.timer);
      G.press = null;
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('keydown', onKey);
    document.addEventListener(
      'pointerdown',
      () => {
        if (A.ensure()) {
          applyAudioSettings();
          if (G.screen === 'game' && G.S) setMusicForStage();
          else A.music('menu');
        }
      },
      { once: false }
    );
    root.addEventListener('resize', () => R.resize());
    if (root.ResizeObserver) new ResizeObserver(() => R.resize()).observe($('#board-wrap'));
    bindOptions();
  }

  function loop(t) {
    const dt = Math.min(0.05, (t - (G.lastTime || t)) / 1000);
    G.lastTime = t;
    if (G.screen === 'game' && G.S) R.draw(G.S, dt, uiState());
    requestAnimationFrame(loop);
  }

  function boot() {
    SV.load();
    const st = settings();
    R.reduceMotion = !st.shake;
    R.init($('#board'));
    bind();
    show('title', false);
    requestAnimationFrame(loop);
  }

  // Ganchos para os testes automatizados (não afetam o jogo).
  FF.game = G;
  FF.test = {
    state: () => G.S,
    act: (a) => tryAction(a),
    choose: (id) => chooseBoon(id),
    busy: () => G.busy,
    overlay: () => G.overlay,
    screen: () => G.screen,
    start: (o) => startRun(o),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
