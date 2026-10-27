/*
 * Terreiro ao vivo da página inicial: o jogador automático joga de verdade, com as mesmas
 * regras, marcas e animações do jogo. Não toca no salvamento nem no som.
 */
(function (root) {
  'use strict';
  const FF = root.FF;
  const E = FF.engine;
  const D = FF.data;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function stepDelay(evs) {
    let ms = 90;
    for (const ev of evs) {
      if (['attack', 'shot', 'curse', 'dash', 'hurt', 'die', 'appear', 'spawn'].includes(ev.t)) ms = Math.max(ms, 220);
      else if (ev.t === 'move' || ev.t === 'intent') ms = Math.max(ms, 140);
    }
    return ms;
  }

  // opts: { hero, stage, onInfo(info) }
  function createDemo(canvas, opts) {
    const R = FF.createRenderer();
    R.init(canvas);
    R.reduceMotion = reduced();
    const demo = { R, S: null, hero: opts.hero || 'ogum', stage: opts.stage || 0, visible: false, alive: true, token: 0 };
    let last = 0;
    let frame = 0;

    function info() {
      const S = demo.S;
      if (!S || !opts.onInfo) return;
      opts.onInfo({
        place: D.STAGES[S.stageIdx].name,
        biome: D.BIOMES[S.biome].name,
        hero: D.HEROES[S.hero],
        turn: S.turn,
        hp: S.player.hp,
        maxHp: S.player.maxHp,
      });
    }

    function restart() {
      demo.token++;
      const S = E.newRun({ hero: demo.hero, seed: 'palco-' + demo.hero + '-' + demo.stage + '-' + Date.now().toString(36) });
      if (demo.stage) E.jumpToStage(S, demo.stage);
      demo.S = S;
      R.resetStage();
      info();
      run(demo.token);
    }

    async function waitVisible(token) {
      while (demo.alive && token === demo.token && (!demo.visible || document.hidden)) await sleep(250);
    }

    async function run(token) {
      await sleep(700);
      while (demo.alive && token === demo.token) {
        await waitVisible(token);
        if (token !== demo.token) return;
        const S = demo.S;
        if (S.phase === 'cross') {
          // O palco mostra sempre o mesmo terreiro: ao fechar, recomeça nele.
          await sleep(1200);
          if (token === demo.token) restart();
          return;
        }
        if (S.phase !== 'play' || S.turn > 70) {
          await sleep(1600);
          if (token === demo.token) restart();
          return;
        }
        const a = FF.bot.tacticalAction(S, 1);
        const r = E.act(S, a);
        if (!r.ok) {
          await sleep(300);
          continue;
        }
        for (const ev of r.events) R.handle(ev, S);
        info();
        await sleep(240);
        if (!r.free && S.phase === 'play') {
          for (const evs of E.enemyPhase(S)) {
            if (token !== demo.token) return;
            for (const ev of evs) R.handle(ev, S);
            info();
            await sleep(stepDelay(evs));
          }
        }
        await sleep(520);
      }
    }

    function loop(t) {
      if (!demo.alive) return;
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      if (demo.visible && demo.S && !document.hidden) R.draw(demo.S, dt, null);
      frame = requestAnimationFrame(loop);
    }

    demo.setVisible = (v) => {
      demo.visible = v;
      if (v) R.resize();
    };
    demo.setHero = (hero) => {
      if (hero === demo.hero) return;
      demo.hero = hero;
      restart();
    };
    demo.setStage = (stage) => {
      if (stage === demo.stage) return;
      demo.stage = stage;
      restart();
    };
    demo.resize = () => R.resize();
    demo.stop = () => {
      demo.alive = false;
      cancelAnimationFrame(frame);
    };

    restart();
    frame = requestAnimationFrame(loop);
    return demo;
  }

  FF.createDemo = createDemo;
})(typeof window !== 'undefined' ? window : globalThis);
