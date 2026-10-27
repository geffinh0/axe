/*
 * Gera as imagens da página inicial a partir do próprio jogo (motor + renderizador reais).
 * Uso: node tests/capture.js
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());

  async function shot(file, build) {
    const data = await page.evaluate(build);
    fs.writeFileSync(path.join(ROOT, 'assets', file), Buffer.from(data.split(',')[1], 'base64'));
    console.log('assets/' + file);
  }

  // Desenha um estado num tabuleiro fora da tela e devolve o recorte (em casas) como PNG.
  await page.evaluate(() => {
    window.__capture = (S, tile, crop) => {
      const cv = document.createElement('canvas');
      const size = tile * 9 + 8 * (tile / 16) + 8;
      cv.style.cssText = 'position:fixed;left:0;top:0;width:' + size + 'px;height:' + size + 'px;';
      document.body.appendChild(cv);
      const R = FF.createRenderer();
      R.init(cv);
      R.reduceMotion = true;
      for (let i = 0; i < 40; i++) R.draw(S, 1 / 60, null);
      const out = document.createElement('canvas');
      const c = crop || { x: 0, y: 0, w: 9, h: 9 };
      out.width = c.w * R.tile;
      out.height = c.h * R.tile;
      out.getContext('2d').drawImage(cv, R.ox + c.x * R.tile, R.oy + c.y * R.tile, out.width, out.height, 0, 0, out.width, out.height);
      cv.remove();
      return out.toDataURL('image/png');
    };
  });

  await shot('marca-vermelha.png', () => {
    const E = FF.engine;
    const S = E.newRun({ hero: 'ogum', seed: 'captura-marca' });
    S.map = new Array(81).fill(E.FLOOR);
    S.fire = new Array(81).fill(0);
    for (const [x, y] of [[2, 3], [6, 5], [2, 5]]) S.map[E.idx(x, y)] = E.WALL;
    S.player.x = 4;
    S.player.y = 4;
    S.units = [
      { id: 90, type: 'kiumba', x: 5, y: 4, hp: 1, maxHp: 1, intent: { k: 'melee', dir: 3, dmg: 1, aim: true }, stun: 0, burn: 0, cd: 0 },
      { id: 91, type: 'kiumba', x: 6, y: 3, hp: 1, maxHp: 1, intent: null, stun: 0, burn: 0, cd: 0 },
    ];
    S.portals = [];
    return window.__capture(S, 128, { x: 2, y: 3, w: 5, h: 3 });
  });

  await shot('calunga-iku.png', () => {
    const E = FF.engine;
    const S = E.newRun({ hero: 'oxossi', seed: 'captura-iku-3' });
    E.jumpToStage(S, 5);
    // Joga até Ikú anunciar uma travessia.
    for (let i = 0; i < 200; i++) {
      const iku = S.units.find((u) => u.type === 'iku');
      if (iku && iku.intent && iku.intent.k === 'charge' && S.turn > 3) break;
      const r = E.act(S, FF.bot.tacticalAction(S, 1));
      if (!r.free && S.phase === 'play') E.runEnemyPhase(S);
      if (S.phase !== 'play') break;
    }
    return window.__capture(S, 96);
  });

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
