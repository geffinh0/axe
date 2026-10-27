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
  await page.addScriptTag({ path: path.join(__dirname, 'bot.js') });

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
  await page.addScriptTag({ path: path.join(__dirname, 'bot.js') });
  assert(await page.isVisible('#btn-continue'), 'botão Continuar aparece após recarregar');
  await page.click('#btn-continue');
  const restored = await page.evaluate(() => JSON.stringify(FF.test.state()));
  assert(restored === snap, 'estado restaurado é idêntico ao salvo');

  console.log('Recarregar no meio da rodada não desfaz a jogada');
  const t0 = await page.evaluate(() => FF.test.state().turn);
  await page.keyboard.press('KeyE');
  await page.reload();
  await page.addScriptTag({ path: path.join(__dirname, 'bot.js') });
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
  await page.addScriptTag({ path: path.join(__dirname, 'bot.js') });
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

  console.log('Celular (retrato)');
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const mp = await mob.newPage();
  mp.on('pageerror', (e) => errors.push(String(e)));
  await mp.goto(URL);
  await mp.screenshot({ path: path.join(OUT, '12-celular-titulo.png') });
  await mp.tap('#btn-new');
  await mp.tap('#btn-start');
  await mp.waitForTimeout(2200);
  await mp.screenshot({ path: path.join(OUT, '13-celular-jogo.png') });

  assert(errors.length === 0, 'nenhum erro no console (' + errors.join(' | ') + ')');
  await browser.close();
  console.log('\ne2e ok — capturas em', OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
