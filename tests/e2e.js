/*
 * Teste ponta a ponta no navegador: joga jornadas completas pela interface (com o bot),
 * confere que não há erros de console, que o salvamento sobrevive a recarregar a página
 * e que a vitória libera conteúdo. Uso: node tests/e2e.js [pasta-de-capturas]
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const URL = 'file://' + path.join(ROOT, 'index.html');

function assert(c, m) {
  if (!c) throw new Error('FALHOU: ' + m);
  console.log('  ok -', m);
}

async function playUntil(page, stopFn, opts) {
  const shots = (opts && opts.shots) || {};
  const taken = new Set();
  for (let i = 0; i < 6000; i++) {
    const st = await page.evaluate(() => {
      const S = FF.test.state();
      return S ? { phase: S.phase, stage: S.stageIdx, turn: S.turn, busy: FF.test.busy(), overlay: FF.test.overlay() } : null;
    });
    if (!st) return null;
    if (await stopFn(st)) return st;
    for (const [name, cond] of Object.entries(shots)) {
      if (!taken.has(name) && cond(st)) {
        taken.add(name);
        await page.waitForTimeout(350);
        await page.screenshot({ path: path.join(OUT, name + '.png') });
      }
    }
    if (st.busy) {
      await page.waitForTimeout(30);
      continue;
    }
    if (st.phase === 'cross' && st.overlay === 'cross') {
      await page.evaluate(() => FF.test.choose(FF.bot.chooseBoon(FF.test.state())));
      await page.waitForTimeout(80);
      continue;
    }
    if (st.phase === 'play' && !st.overlay) {
      await page.evaluate(() => FF.test.act(FF.bot.tacticalAction(FF.test.state(), 2)));
      await page.waitForTimeout(20);
      continue;
    }
    await page.waitForTimeout(60);
  }
  const last = await page.evaluate(() => {
    const S = FF.test.state();
    return S && { phase: S.phase, stage: S.stageIdx, turn: S.turn, units: S.units.map((u) => u.type + '@' + u.x + ',' + u.y), player: [S.player.x, S.player.y, S.player.hp], busy: FF.test.busy(), overlay: FF.test.overlay(), seed: S.seed };
  });
  throw new Error('partida não terminou: ' + JSON.stringify(last));
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  console.log('Título e escolha de herói');
  assert(await page.isHidden('#btn-continue'), 'sem jornada salva, não há botão Continuar');
  await page.screenshot({ path: path.join(OUT, '01-titulo.png') });
  await page.click('#btn-new');
  assert(await page.isVisible('#scr-heroes'), 'tela de heróis aberta');
  await page.click('.hero-opt:nth-child(2)');
  await page.screenshot({ path: path.join(OUT, '02-herois.png') });
  // Semente fixa: a jornada do teste é sempre a mesma (e exercita o campo de semente).
  await page.click('.advanced summary');
  await page.fill('#seed-input', 'axe2');
  await page.click('#btn-start');
  await page.waitForTimeout(400);
  assert(await page.isVisible('#scr-game'), 'jogo começou');

  console.log('Controles pelo teclado');
  const before = await page.evaluate(() => ({ ...FF.test.state().player }));
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({ ...FF.test.state().player, turn: FF.test.state().turn }));
  assert(after.y === before.y - 1 && after.turn === 1, 'seta para cima move o herói e passa a rodada');
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  assert(await page.evaluate(() => !!FF.game.targeting), 'espaço entra no modo de mira');
  await page.keyboard.press('Escape');
  assert(await page.evaluate(() => !FF.game.targeting), 'esc cancela a mira');
  await page.screenshot({ path: path.join(OUT, '03-terreiro1.png') });

  console.log('Salvar e continuar após recarregar');
  const snap = await page.evaluate(() => JSON.stringify(FF.test.state()));
  await page.reload();
  assert(await page.isVisible('#btn-continue'), 'botão Continuar aparece após recarregar');
  await page.click('#btn-continue');
  const restored = await page.evaluate(() => JSON.stringify(FF.test.state()));
  assert(restored === snap, 'estado restaurado é idêntico ao salvo');

  console.log('Recarregar no meio da rodada não desfaz a jogada');
  const t0 = await page.evaluate(() => FF.test.state().turn);
  await page.keyboard.press('KeyE');
  await page.reload();
  await page.click('#btn-continue');
  const t1 = await page.evaluate(() => FF.test.state().turn);
  assert(t1 === t0 + 1, 'a rodada interrompida foi mantida (' + t0 + ' -> ' + t1 + ')');

  console.log('Salvamento corrompido não quebra o jogo');
  const good = await page.evaluate(() => localStorage.getItem('axe.save.v1'));
  await page.evaluate(() => localStorage.setItem('axe.save.v1', '{"v":1,"run":{"v":1,"hero":"ogum","map":"x"},"settings":{"sfx":"alto"}'));
  await page.reload();
  assert(await page.isVisible('#btn-new') && (await page.isHidden('#btn-continue')), 'JSON quebrado: título abre sem jornada');
  await page.evaluate(() => localStorage.setItem('axe.save.v1', JSON.stringify({ v: 99, run: { v: 1, hero: 'ninguem' }, heroes: 'x', marks: [1, 2] })));
  await page.reload();
  assert(await page.isHidden('#btn-continue'), 'dados de outra versão: descartados com segurança');
  await page.evaluate((g) => localStorage.setItem('axe.save.v1', g), good);
  await page.reload();
  await page.click('#btn-continue');

  console.log('Jornada completa com o bot (Ayo, semente axe2)');
  const shots = {
    '04-telegrafia': (s) => s.stage === 0 && s.turn >= 4,
    '05-encruzilhada': (s) => s.phase === 'cross' && s.overlay === 'cross',
    '06-mata2': (s) => s.stage === 1 && s.turn >= 6,
    '07-rio': (s) => s.stage === 2 && s.turn >= 6,
    '08-cachoeira': (s) => s.stage === 3 && s.turn >= 12,
    '09-pedreira': (s) => s.stage === 4 && s.turn >= 8,
    '10-iku': (s) => s.stage === 5 && s.turn >= 3,
  };
  let end = await playUntil(page, (s) => s.overlay === 'end', { shots });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '11-fim.png') });
  const result = await page.evaluate(() => ({ phase: FF.test.state().phase, final: FF.test.state().final, save: JSON.parse(localStorage.getItem('axe.save.v1')) }));
  console.log('  resultado:', result.phase, result.final.total, result.final.rank);
  assert(result.save.run === null, 'jornada encerrada some do salvamento');
  assert(result.save.stats.runs === 1, 'estatística de jornadas registrada');
  assert(result.phase === 'won', 'a jornada termina em vitória sobre Ikú');
  assert(result.save.unlocked.iansa && result.save.unlocked.provas, 'vitória libera Iansã e provações');
  assert(result.save.marks.iku, 'marca de vitória concedida');
  assert(result.save.history[0].mode === 'custom', 'jornada com semente registrada como tal');

  console.log('Menus: Desafio do Dia, opções, ajuda e apagar progresso');
  await page.click('[data-menu]');
  const daily = await page.evaluate(() => FF.save.dailyInfo());
  await page.click('#btn-daily');
  await page.waitForTimeout(300);
  const ds = await page.evaluate(() => ({ seed: FF.test.state().seed, hero: FF.test.state().hero, provas: FF.test.state().provas, mode: FF.test.state().mode }));
  assert(ds.mode === 'daily' && ds.seed === daily.seed && ds.hero === daily.hero && ds.provas.join() === daily.provas.join(), 'Desafio do Dia usa semente, herói e provação do dia');
  await page.keyboard.press('Escape');
  await page.click('#btn-pause-options');
  assert(await page.isVisible('#scr-options'), 'opções abrem a partir da pausa');
  await page.fill('#opt-music', '0.2');
  await page.dispatchEvent('#opt-music', 'input');
  await page.click('#opt-fast');
  await page.click('[data-back]:visible');
  assert(await page.isVisible('#scr-game') && (await page.isVisible('#ov-pause')), 'voltar retorna ao jogo pausado');
  await page.click('#btn-pause-help');
  assert(await page.isVisible('#scr-help'), 'ajuda abre a partir da pausa');
  await page.click('[data-back]:visible');
  await page.click('#btn-pause-menu');
  assert(await page.isVisible('#btn-continue'), 'salvar e sair mostra Continuar no título');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('axe.save.v1')).settings);
  assert(Math.abs(st.music - 0.2) < 1e-9 && st.fast === true, 'configurações salvas');
  await page.click('#btn-options');
  await page.click('#btn-reset');
  await page.click('.overlay [data-y]');
  const wiped = await page.evaluate(() => JSON.parse(localStorage.getItem('axe.save.v1')));
  assert(wiped.stats.runs === 0 && wiped.run === null && !wiped.unlocked.iansa, 'apagar progresso zera tudo');
  await page.click('[data-back]:visible');
  await page.click('#btn-new');
  await page.click('.hero-opt:nth-child(4)');
  assert(await page.evaluate(() => FF.game.heroSel !== 'iansa'), 'heroína bloqueada não pode ser escolhida');

  console.log('Página inicial');
  await page.click('[data-back]:visible');
  await page.waitForTimeout(3200);
  const who = await page.textContent('#stage-who');
  assert(/rodada \d+/.test(who) && !/de ogum|de oxóssi|de xangô|de iansã/.test(who), 'o terreiro ao vivo está jogando (' + who + ')');
  await page.click('#hero-picker .pick:nth-child(3)');
  assert((await page.textContent('#hero-card')).includes('Tunde'), 'escolher um caminho troca o cartão do herói');
  assert(/Desafio do Dia: \S/.test((await page.textContent('#btn-daily')).replace(/ /g, ' ')), 'rótulo do Desafio do Dia com espaço');

  console.log('Celular (retrato): toque, deslizar e segurar');
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const mp = await mob.newPage();
  mp.on('pageerror', (e) => errors.push(String(e)));
  mp.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await mp.goto(URL);
  await mp.waitForTimeout(600);
  await mp.screenshot({ path: path.join(OUT, '12-celular-titulo.png') });
  await mp.tap('#btn-new');
  await mp.tap('.advanced summary');
  await mp.fill('#seed-input', 'toque');
  await mp.tap('#btn-start');
  await mp.waitForTimeout(1600);
  await mp.screenshot({ path: path.join(OUT, '13-celular-jogo.png') });

  // Ponto da tela no centro de uma casa e casa vizinha livre, calculados pela própria página.
  const where = (dx, dy) =>
    mp.evaluate(([dx, dy]) => {
      const S = FF.test.state();
      const R = FF.render;
      const rect = document.querySelector('#board').getBoundingClientRect();
      const x = S.player.x + dx;
      const y = S.player.y + dy;
      return { x: rect.left + (R.ox + x * R.tile + R.tile / 2) / R.dpr, y: rect.top + (R.oy + y * R.tile + R.tile / 2) / R.dpr, tile: R.tile / R.dpr };
    }, [dx, dy]);
  const freeDir = () =>
    mp.evaluate(() => {
      const S = FF.test.state();
      const E = FF.engine;
      const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      for (let d = 0; d < 4; d++) {
        const x = S.player.x + D4[d][0];
        const y = S.player.y + D4[d][1];
        if (x < 0 || y < 0 || x > 8 || y > 8) continue;
        if (S.map[E.idx(x, y)] !== E.FLOOR || S.units.some((u) => u.x === x && u.y === y)) continue;
        if (S.portals.some((q) => q.x === x && q.y === y)) continue;
        return { d, dx: D4[d][0], dy: D4[d][1] };
      }
      return null;
    });
  const gesture = (pts, hold) =>
    mp.evaluate(
      async ([pts, hold]) => {
        const cv = document.querySelector('#board');
        const fire = (type, p) => cv.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: p.x, clientY: p.y, bubbles: true }));
        fire('pointerdown', pts[0]);
        for (const p of pts.slice(1)) fire('pointermove', p);
        await new Promise((r) => setTimeout(r, hold));
        fire('pointerup', pts[pts.length - 1]);
      },
      [pts, hold]
    );
  const idle = async () => {
    for (let i = 0; i < 100 && (await mp.evaluate(() => FF.test.busy())); i++) await mp.waitForTimeout(40);
  };
  const pos = () => mp.evaluate(() => ({ x: FF.test.state().player.x, y: FF.test.state().player.y, turn: FF.test.state().turn }));

  let fd = await freeDir();
  let p0 = await pos();
  let pt = await where(fd.dx, fd.dy);
  await gesture([pt], 60);
  await idle();
  let p1 = await pos();
  assert(p1.x === p0.x + fd.dx && p1.y === p0.y + fd.dy && p1.turn === p0.turn + 1, 'tocar numa casa vizinha anda até ela');

  fd = await freeDir();
  p0 = await pos();
  const c = await where(0, 0);
  const len = Math.max(60, c.tile * 0.9);
  await gesture([c, { x: c.x + fd.dx * len * 0.5, y: c.y + fd.dy * len * 0.5 }, { x: c.x + fd.dx * len, y: c.y + fd.dy * len }], 60);
  await idle();
  p1 = await pos();
  assert(p1.x === p0.x + fd.dx && p1.y === p0.y + fd.dy && p1.turn === p0.turn + 1, 'deslizar o dedo anda na direção do gesto');

  p0 = await pos();
  pt = await where(0, 0);
  await gesture([pt], 600);
  await mp.waitForTimeout(100);
  p1 = await pos();
  const sel = await mp.evaluate(() => FF.game.selected);
  assert(p1.turn === p0.turn && sel && sel.x === p0.x && sel.y === p0.y, 'segurar o dedo mostra a casa sem gastar a rodada');
  assert((await mp.textContent('#inspect')).trim().length > 0, 'o painel mostra o que há na casa segurada');
  const tips = await mp.textContent('#feed');
  assert(!/Espaço|WASD|teclado|mouse/i.test(tips), 'no toque as dicas não falam de teclado nem mouse');

  console.log('Celular deitado');
  const land = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const lp = await land.newPage();
  lp.on('pageerror', (e) => errors.push(String(e)));
  await lp.goto(URL);
  await lp.tap('#btn-new');
  await lp.tap('#btn-start');
  await lp.waitForTimeout(1600);
  await lp.screenshot({ path: path.join(OUT, '14-celular-deitado.png') });
  const box = await lp.evaluate(() => {
    const r = document.querySelector('.board-wrap').getBoundingClientRect();
    const a = document.querySelector('#btn-wait-m').getBoundingClientRect();
    return { h: r.height, w: r.width, wait: a.height > 0 && a.bottom <= innerHeight };
  });
  assert(box.h >= 340 && box.w >= 340, 'deitado, o tabuleiro ocupa a altura da tela (' + Math.round(box.w) + 'x' + Math.round(box.h) + ')');
  assert(box.wait, 'deitado, o botão Esperar fica à vista');

  assert(errors.length === 0, 'nenhum erro no console (' + errors.join(' | ') + ')');
  await browser.close();
  console.log('\ne2e ok, capturas em', OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
