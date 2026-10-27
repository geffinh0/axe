/*
 * Pixel art definida em texto. Cada caractere é uma cor da paleta do sprite ('.' = transparente).
 * O contorno escuro é gerado automaticamente; versões "flash" (silhueta branca) servem para impactos.
 */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});

  const SKIN = { s: '#6b3f26', S: '#8f5836', k: '#120c16' };
  const OUTLINE = '#0b0810';

  const DEFS = {
    ogum: {
      pal: Object.assign({ i: '#c9d3df', I: '#7d8898', g: '#c9d66b', G: '#8c9a3a', b: '#2f62b8', B: '#1d3e7c', y: '#e4b54a', w: '#f4efe2' }, SKIN),
      rows: [
        '................',
        '............w...',
        '.....iiiii..i...',
        '....iiiiiii.i...',
        '....IIIIIII.i...',
        '....ggggggg.i...',
        '....gssskSg.i...',
        '....gsssssg.i...',
        '.....gsssg.yyy..',
        '....bbbbbbbbs...',
        '...sbBbbbbBb....',
        '...sbbyyyybb....',
        '....GgGgGgGg....',
        '....gGgGgGgG....',
        '.....ss..ss.....',
        '................',
      ],
    },
    oxossi: {
      pal: Object.assign({ t: '#2bb3a3', T: '#16736b', e: '#4fae52', E: '#2f7a37', y: '#e4b54a', f: '#efe8cf', F: '#c94a3a', b: '#9a6331', w: '#d9d2bd' }, SKIN),
      rows: [
        '................',
        '.........fF.....',
        '.....ttttf......',
        '....tTTTTTt.....',
        '...TTTTTTTTT....',
        '....sssssss.b...',
        '....ssssskSw.b..',
        '....sssssssw.b..',
        '.....sssss.w.b..',
        '....eeeeeeesw.b.',
        '...seeyeeeeew.b.',
        '...seeyeeeee.b..',
        '....EEEEEEE.b...',
        '....TtTtTtT.....',
        '.....ss..ss.....',
        '................',
      ],
    },
    xango: {
      pal: Object.assign({ r: '#c8372d', R: '#87231d', w: '#f1e9d6', y: '#e4b54a', Y: '#9c7225' }, SKIN),
      rows: [
        '................',
        '.....y.y.y.yy.yy',
        '.....yyyyy.yyyyy',
        '....rrrrrrr.yYy.',
        '....rwrwrwr..Y..',
        '....sssssss..Y..',
        '....ssssskS..Y..',
        '....sssssss..Y..',
        '.....sssss...Y..',
        '....rrwrrwrrsY..',
        '...srrwrrwrr....',
        '...srrwrrwrr....',
        '....RRRRRRR.....',
        '....wRwRwRw.....',
        '.....ss..ss.....',
        '................',
      ],
    },
    iansa: {
      pal: Object.assign({ c: '#d65a3a', C: '#94361f', y: '#e8b84a', Y: '#a87a26', w: '#f4eee0', m: '#6b2a2a' }, SKIN),
      rows: [
        '................',
        '.....yyyyy......',
        '....yYyYyYy.....',
        '....ycycycy.w...',
        '....sssssss.ww..',
        '....ssssskS.www.',
        '....sssssss..ww.',
        '.....sssss..ww..',
        '....ccccccc.y...',
        '...scccCcccsy...',
        '...scccCcccc....',
        '....cyccycc.....',
        '...cCcCcCcCc....',
        '..cCcCcCcCcCc...',
        '.....ss..ss.....',
        '................',
      ],
    },
    kiumba: {
      pal: { p: '#77609c', P: '#3f2e5a', r: '#ff5a4f', k: '#140d1a' },
      rows: [
        '................',
        '................',
        '......pppp......',
        '.....pPPPPp.....',
        '....pPPPPPPp....',
        '....PPrPPrPP....',
        '....PPrPPrPP....',
        '....PPPPPPPP....',
        '...pPPkkkkPPp...',
        '...pPPPPPPPPp...',
        '...pPPPPPPPPp...',
        '...pPPPPPPPPp...',
        '....pPPpPPpP....',
        '.....p..p..p....',
        '................',
        '................',
      ],
    },
    ofo: {
      pal: { h: '#58627a', H: '#2c3243', m: '#d8cfbf', r: '#ff5a4f', k: '#140d1a', b: '#8a6a44' },
      rows: [
        '................',
        '......hhh.......',
        '.....hHHHh......',
        '....hHmmmHh.....',
        '....hmrmrmh..b..',
        '....hmmmmmh...b.',
        '....hHmkmHh...b.',
        '.....hHHHh....b.',
        '....hhhhhhhhhhb.',
        '...hHhHHHhH...b.',
        '...hHhHHHhH..b..',
        '...hHHHHHHH.....',
        '....hHHHHHh.....',
        '....hH.H.Hh.....',
        '.....h...h......',
        '................',
      ],
    },
    zombeteiro: {
      pal: { o: '#a3963e', O: '#5d5824', r: '#ff5a4f', w: '#f2ead6', k: '#140d1a' },
      rows: [
        '................',
        '...o........o...',
        '...oo......oo...',
        '....oooooooo....',
        '....oOroOroo....',
        '....oooooooo....',
        '....okwkwkwo....',
        '.....okkkko.....',
        '......oooo......',
        '.....OooooO.....',
        '....O.oooo.O....',
        '......oOOo......',
        '.....O....O.....',
        '....O......O....',
        '................',
        '................',
      ],
    },
    obsessor: {
      pal: { n: '#4a3832', N: '#231916', r: '#ff4d3d', c: '#d6cbb5', k: '#140d1a' },
      rows: [
        '................',
        '................',
        '.........nn.....',
        '........nNNn....',
        '..nn...nNrNrn...',
        '.nNNn..nNNNNn...',
        '.nNNNnnnNNNNNn..',
        '..nNNNNNNNNkkn..',
        '..nNNNNNNNNcck..',
        '..nNNNNNNNNn....',
        '...nNNNNNNNn....',
        '...nN.nN.nNn....',
        '...cN..N..Nc....',
        '...c...c...c....',
        '................',
        '................',
      ],
    },
    oran: {
      pal: { q: '#8a3530', Q: '#521d1b', h: '#e3d7bb', y: '#ffd34a', k: '#140d1a' },
      rows: [
        '................',
        '..h........h....',
        '..hh......hh....',
        '...hhqqqqhh.....',
        '....qqqqqqq.....',
        '...qqyqqqyqq....',
        '...qqqqqqqqq....',
        '...qqQkQkQqq....',
        '..qqqQQQQQqqq...',
        '.qqQqqqqqqqQqq..',
        '.qqQqqqqqqqQqq..',
        '..qqqqqqqqqqq...',
        '...qQq...qQq....',
        '...QQ.....QQ....',
        '................',
        '................',
      ],
    },
    arun: {
      pal: { v: '#86a12f', V: '#4b5e18', u: '#9a4aa0', y: '#eaff7a', k: '#140d1a' },
      rows: [
        '................',
        '................',
        '................',
        '.......u........',
        '......vvv..u....',
        '.....vvuvv.vv...',
        '....vvvvvvvvv...',
        '...vvyVVyvvuv...',
        '...vvVVVVvvvvv..',
        '..vuvvkkkkvvvv..',
        '..vvvvvvvvvuvvv.',
        '.vvVvvvuvvvvVvv.',
        '.VVVVVVVVVVVVVV.',
        '................',
        '................',
        '................',
      ],
    },
    epe: {
      pal: { x: '#6a3399', X: '#3a1a55', g: '#93ff7d', G: '#3ec23b', m: '#d8cfbf' },
      rows: [
        '................',
        '......xxx.......',
        '.....xXXXx......',
        '....xXXXXXx.....',
        '....xXgXgXx.....',
        '....xXXXXXx...g.',
        '...xxXXXXXxx.gGg',
        '..xXxXXXXXxXx.g.',
        '..m..xXXXx..mm..',
        '.....xXXXx......',
        '....xXXXXXx.....',
        '....xXXXXXx.....',
        '...xXXXXXXXx....',
        '...xX.xX.xXx....',
        '....x..x..x.....',
        '................',
      ],
    },
    egba: {
      pal: { z: '#737b88', Z: '#454a55', l: '#98a1ae', c: '#c2ad78', e: '#9ad7ff', k: '#140d1a' },
      rows: [
        '................',
        '.....zzzzzz.....',
        '....zllllllz....',
        '....zlezzelz....',
        '....zzzzzzzz....',
        '..zzzZkkkkZzzz..',
        '.zlllzzzzzzlllz.',
        '.zlzZZZZZZZZzlz.',
        '.zlzZcZZZZcZzlz.',
        '.zzzZZcZZcZZzzz.',
        '.cZ.ZZZccZZZ.Zc.',
        '.c..ZZZZZZZZ..c.',
        '....ZZZ..ZZZ....',
        '...zZZZ..ZZZz...',
        '...zzz....zzz...',
        '................',
      ],
    },
    iku: {
      pal: { a: '#1d1524', A: '#33263f', m: '#ebe3d3', M: '#b5ab9a', v: '#b48cff', V: '#6e46c9', b: '#6e5c49', k: '#0b0810' },
      rows: [
        '....................',
        '........aaaa.....v..',
        '.......aAAAAa...vVv.',
        '......aAAAAAAa...v..',
        '.....aAAmmmmAAa..b..',
        '.....aAmMmmMmAa..b..',
        '.....aAmvmmvmAa..b..',
        '.....aAmmMMmmAa..b..',
        '.....aAAmkkmAAa..b..',
        '....aAAAAmmAAAAa.b..',
        '...aAAaAAAAAAaAAmb..',
        '..aAAa.aAAAAa.aAAb..',
        '..aAa..aAAAAa..a.b..',
        '..mm...aAAAAa....b..',
        '......aAAAAAAa...b..',
        '.....aAAAAAAAAa..b..',
        '....aAAAAAAAAAAa.b..',
        '...aAaAaAaAaAaAab...',
        '...a.a.a.a.a.a.a....',
        '....................',
      ],
    },

    // Obstáculos (um por bioma) e espinhos.
    arvore: {
      pal: { L: '#4a9a58', l: '#2f7040', D: '#1c4a2a', t: '#6a4630', T: '#3e281a' },
      rows: [
        '................',
        '.....llll.......',
        '...lLLLllll.....',
        '..lLLLLlllll....',
        '.lLLLlllllDll...',
        '.lLLllllllDDl...',
        '.llllllllDDDl...',
        '.lllllDllDDDl...',
        '..lllDDDDDDl....',
        '...lDDDDDDl.....',
        '.....DtTD.......',
        '......tT........',
        '......tT........',
        '.....ttTT.......',
        '....tt..TT......',
        '................',
      ],
    },
    pedra: {
      pal: { g: '#87909b', G: '#565e69', h: '#aab3bd', m: '#5f9150', M: '#3d6634' },
      rows: [
        '................',
        '................',
        '................',
        '................',
        '.....mmmm.......',
        '...mMMggmmm.....',
        '..mMgghhggmm....',
        '..Gghhhhggggm...',
        '.GgghhggggggG...',
        '.GggggggggggGG..',
        '.GGgggggggGGGG..',
        '..GGGgggGGGGG...',
        '...GGGGGGGGG....',
        '................',
        '................',
        '................',
      ],
    },
    rocha: {
      pal: { r: '#93604a', R: '#5c3828', h: '#bd8566', o: '#ff8a3a' },
      rows: [
        '................',
        '................',
        '.......h........',
        '......hrh.......',
        '.....hrrRh......',
        '....hrrrRRh.....',
        '...hrrrrRRRh....',
        '...rrrrrRRRR.h..',
        '..hrroorRRRRhrh.',
        '..rrrrorRRRRrrR.',
        '.hrrrrrRRRRrrRR.',
        '.rrrrrRRRRRrRRR.',
        '.RRRRRRRRRRRRRR.',
        '................',
        '................',
        '................',
      ],
    },
    lapide: {
      pal: { g: '#8c8a9a', G: '#55536a', h: '#b4b2c2', v: '#9a74e8', d: '#3a3848' },
      rows: [
        '................',
        '................',
        '......gggg......',
        '.....ghhhgg.....',
        '....ghhggggG....',
        '....ghgggggG....',
        '....gddddgGG....',
        '....ggggggGG....',
        '....gddddgGG....',
        '....ggggggGG....',
        '....gggggGGG....',
        '....ggggGGGG....',
        '...dGGGGGGGGd...',
        '..dddddddddddd..',
        '................',
        '................',
      ],
    },
    espinhos: {
      pal: { n: '#6a4a32', N: '#3c2818', w: '#e8dcc0', g: '#5a7a3a' },
      rows: [
        '................',
        '................',
        '................',
        '................',
        '......w.........',
        '..w...n....w....',
        '...n..n...n.....',
        '...nn.n.wnn.....',
        '.w..nNnNnn..w...',
        '..nn.NNNn..n....',
        '....gNNNNnn.....',
        '..wnNNgNNNw.....',
        '...NNgNNNgN.....',
        '..gNNNNNNNNg....',
        '................',
        '................',
      ],
    },
  };

  // Ícones 9x9 das dádivas e da interface.
  const ICONS = {
    heart: { pal: { r: '#e5484d', R: '#9b2226', w: '#ffd1d1' }, rows: ['.........', '.rr...rr.', 'rwrr.rrrr', 'rwrrrrrrR', 'rrrrrrrrR', '.rrrrrrR.', '..rrrRR..', '...rRR...', '....R....'] },
    heartEmpty: { pal: { r: '#5a3a44', R: '#3a242c' }, rows: ['.........', '.rr...rr.', 'r..r.r..r', 'r...r...R', 'r.......R', '.r.....R.', '..r...R..', '...r.R...', '....R....'] },
    blade: { pal: { i: '#d6dee8', I: '#8a95a5', y: '#e4b54a' }, rows: ['.......ii', '......iiI', '.....iiI.', '....iiI..', '...iiI...', '.yyiI....', '..yy.....', '.y.yy....', 'y........'] },
    spear: { pal: { i: '#d6dee8', b: '#9a6331' }, rows: ['......iii', '.......ii', '......b.i', '.....b...', '....b....', '...b.....', '..b......', '.b.......', 'b........'] },
    axe: { pal: { y: '#e4b54a', Y: '#9c7225', r: '#c8372d' }, rows: ['yy.....yy', 'yyy...yyy', 'yyyyYyyyy', '.yyyYyyy.', '....Y....', '....r....', '....Y....', '....r....', '....Y....'] },
    wind: { pal: { w: '#cfeaff', W: '#7ab8e8' }, rows: ['.........', 'wwwwww...', '......w..', '.WWWW..w.', '.....W...', 'wwwwwww..', '.......w.', '..WWW..w.', '.....WW..'] },
    beads: { pal: { b: '#2f62b8', w: '#f4efe2', r: '#c8372d' }, rows: ['..b.w.b..', '.w.....w.', 'b.......b', 'w.......w', 'b.......b', '.r.....r.', '..w...w..', '...b.b...', '....r....'] },
    mirror: { pal: { y: '#e8c45a', Y: '#a87a26', w: '#fff5c8' }, rows: ['..yyyyy..', '.yYwwwYy.', 'yYwwwwwYy', 'yYwwwwwYy', '.yYwwwYy.', '..yyyyy..', '....Y....', '...YyY...', '....Y....'] },
    flame: { pal: { o: '#ff8a3a', y: '#ffd34a', r: '#d9452b' }, rows: ['....o....', '...oo....', '...ooo.o.', '..ooyoo..', '.oooyyoo.', '.ooyyyyo.', 'roooyyoor', '.rrooooo.', '..rrrrr..'] },
    swirl: { pal: { w: '#cfeaff', W: '#7ab8e8' }, rows: ['...www...', '..w...w..', '.w..W..w.', 'w..W.W..w', 'w..W..W.w', 'w...WW..w', '.w.....w.', '..ww..w..', '....ww...'] },
    star: { pal: { y: '#ffe08a', w: '#fff8dc' }, rows: ['....y....', '....y....', '...yyy...', 'yyyywyyyy', '.yyyyyyy.', '..yyyyy..', '..yy.yy..', '.yy...yy.', 'y.......y'] },
    smoke: { pal: { g: '#b9b3c9', G: '#7d7690', b: '#9a6331' }, rows: ['..g...g..', '.g.g.g.g.', '..g...g..', '.g.g.g...', '..G.G.G..', '...GGG...', '..bbbbb..', '..b...b..', '...bbb...'] },
    trail: { pal: { o: '#ff8a3a', y: '#ffd34a', k: '#6a4a32' }, rows: ['.......o.', '......oyo', '.......o.', '....o....', '...oyo...', '....o....', 'o........', 'yo.......', 'o........'] },
    fist: { pal: { s: '#a06b46', S: '#6b3f26', g: '#8a95a5' }, rows: ['.........', '..ssss...', '.sSsSss..', '.sssssss.', '.sSsSsss.', '..sssss..', '..gggg...', '..gggg...', '.........'] },
    dodge: { pal: { w: '#cfeaff', y: '#ffe08a' }, rows: ['..y......', '.yyy.....', '..y..ww..', '.....w.w.', '....w...w', '...w.....', '..w..ww..', '.w..w....', 'w.ww.....'] },
    armor: { pal: { b: '#7a4a2a', B: '#4a2a16', y: '#e4b54a', r: '#c8372d' }, rows: ['...yyy...', '..y...y..', '..bbbbb..', '.bBbbbBb.', '.bbbrbbb.', '.bbrrrbb.', '.bbbrbbb.', '.BbbbbbB.', '..BBBBB..'] },
    mask: { pal: { m: '#e6dccb', M: '#a89a84', k: '#140d1a', r: '#c8372d' }, rows: ['..mmmmm..', '.mmmmmmm.', 'mmkmmmkmm', 'mmkmmmkmm', 'mmmmMmmmm', '.mmmMmmm.', '.mrrrrrm.', '..mmmmm..', '...MMM...'] },
    rest: { pal: { g: '#6fbf6a', G: '#3e8a42', w: '#cfeaff' }, rows: ['....g....', '...gGg...', '..gGgGg..', '.gGgGgGg.', '..gGgGg..', '...gGg...', '....G....', '.w.wGw.w.', '..w.w.w..'] },
    shield: { pal: { b: '#cfeaff', B: '#7ab8e8' }, rows: ['bbbbbbbbb', 'bBBBBBBBb', 'bBbbbbbBb', 'bBbbbbbBb', 'bBbbbbbBb', '.bBbbbBb.', '.bBbbbBb.', '..bBbBb..', '...bbb...'] },
    skull: { pal: { m: '#e6dccb', k: '#140d1a' }, rows: ['..mmmmm..', '.mmmmmmm.', 'mmkkmkkmm', 'mmkkmkkmm', 'mmmmmmmmm', '.mmmkmmm.', '..mmmmm..', '..m.m.m..', '.........'] },
  };

  const cache = new Map();

  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined' && !root.document) return new OffscreenCanvas(w, h);
    const c = root.document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function defOf(name) {
    return DEFS[name] || ICONS[name];
  }

  // Desenha o sprite com 1 pixel de margem (onde entra o contorno).
  function render(name, scale, variant) {
    const def = defOf(name);
    if (!def) return null;
    const h = def.rows.length;
    const w = def.rows[0].length;
    const c = makeCanvas((w + 2) * scale, (h + 2) * scale);
    const ctx = c.getContext('2d');
    const solid = (x, y) => y >= 0 && y < h && x >= 0 && x < w && def.rows[y][x] !== '.';
    const outline = variant === 'flash' ? '#ffffff' : variant === 'ghost' ? 'rgba(0,0,0,0)' : OUTLINE;
    for (let y = -1; y <= h; y++)
      for (let x = -1; x <= w; x++) {
        if (solid(x, y)) continue;
        if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) {
          ctx.fillStyle = outline;
          ctx.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
        }
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const ch = def.rows[y][x];
        if (ch === '.') continue;
        ctx.fillStyle = variant === 'flash' ? '#ffffff' : variant === 'ghost' ? 'rgba(240,230,255,0.85)' : def.pal[ch] || '#ff00ff';
        ctx.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
      }
    return c;
  }

  function get(name, scale, variant) {
    const key = name + '|' + scale + '|' + (variant || '');
    if (!cache.has(key)) cache.set(key, render(name, scale, variant));
    return cache.get(key);
  }

  function size(name) {
    const def = defOf(name);
    return def ? { w: def.rows[0].length, h: def.rows.length } : { w: 0, h: 0 };
  }

  function dataURL(name, scale) {
    const c = get(name, scale || 4);
    return c && c.toDataURL ? c.toDataURL() : '';
  }

  function clear() {
    cache.clear();
  }

  // Valida que todas as linhas têm a mesma largura (usado nos testes).
  function validate() {
    const errs = [];
    for (const [n, d] of Object.entries(Object.assign({}, DEFS, ICONS))) {
      const w = d.rows[0].length;
      d.rows.forEach((r, i) => {
        if (r.length !== w) errs.push(n + ' linha ' + i + ' tem ' + r.length + ' (esperado ' + w + ')');
        for (const ch of r) if (ch !== '.' && !d.pal[ch]) errs.push(n + ' cor desconhecida ' + ch);
      });
    }
    return errs;
  }

  FF.sprites = { get, size, dataURL, clear, validate, DEFS, ICONS };
})(typeof window !== 'undefined' ? window : globalThis);
