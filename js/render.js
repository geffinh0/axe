/*
 * Renderização do terreiro em canvas: chão por bioma, marcas de ataque, criaturas animadas,
 * efeitos, partículas e luz. Lê o estado do motor, mas nunca o altera.
 */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});
  const E = FF.engine;
  const D = FF.data;
  const SP = FF.sprites;
  const W = D.W;
  const H = D.H;
  const DIRS = FF.util.DIRS;

  const BIOME_LOOK = {
    mata: { bg: '#0b1510', floor: ['#22402b', '#26472f', '#1f3b28'], grid: 'rgba(0,0,0,0.22)', detail: '#3f7a4a', flower: ['#e8d36a', '#e98aa8', '#cfe8ff'], dark: 0.42, fire: 'warm', ambient: 'firefly' },
    rio: { bg: '#081418', floor: ['#2a3c3d', '#2e4343', '#273838'], grid: 'rgba(0,0,0,0.22)', detail: '#56706c', flower: ['#9fd3c9', '#e8d36a'], dark: 0.38, fire: 'warm', ambient: 'mist' },
    pedreira: { bg: '#140b09', floor: ['#3a2a25', '#42302a', '#352520'], grid: 'rgba(0,0,0,0.28)', detail: '#5a3e33', flower: ['#ff8a3a'], dark: 0.34, fire: 'warm', ambient: 'ember' },
    calunga: { bg: '#0c0910', floor: ['#262131', '#2b2537', '#221d2c'], grid: 'rgba(0,0,0,0.3)', detail: '#463d58', flower: ['#d9d2e6', '#b48cff'], dark: 0.55, fire: 'cold', ambient: 'wisp' },
  };

  const FIRE = {
    warm: ['#c2381c', '#ff7a2a', '#ffd34a'],
    cold: ['#4b2aa8', '#8a5cff', '#e2d4ff'],
  };

  // Cada tabuleiro na tela tem o seu renderizador: o do jogo e o palco ao vivo da página inicial.
  function createRenderer() {
    const R = {
      canvas: null,
      ctx: null,
      dpr: 1,
      px: 4, // tamanho de um "pixel" de arte em pixels físicos
      tile: 64,
      ox: 0,
      oy: 0,
      staticLayer: null,
      staticKey: '',
      light: null,
      disp: {}, // posições exibidas das criaturas
      flash: {},
      facing: {},
      fx: [],
      particles: [],
      texts: [],
      shake: 0,
      hover: null,
      targeting: null,
      showHints: true,
      reduceMotion: false,
      playerDisp: null,
      playerFlash: 0,
      hurtFlash: 0,
      time: 0,
    };

    function hash(x, y, s) {
      let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

    function init(canvas) {
      R.canvas = canvas;
      R.ctx = canvas.getContext('2d');
      resize();
    }

    function resize() {
      const c = R.canvas;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      R.dpr = Math.min(3, root.devicePixelRatio || 1);
      const pw = Math.max(1, Math.round(rect.width * R.dpr));
      const ph = Math.max(1, Math.round(rect.height * R.dpr));
      c.width = pw;
      c.height = ph;
      const px = Math.max(1, Math.floor(Math.min(pw / (W * 16 + 8), ph / (H * 16 + 8))));
      R.px = px;
      R.tile = px * 16;
      R.ox = Math.floor((pw - R.tile * W) / 2);
      R.oy = Math.floor((ph - R.tile * H) / 2);
      R.staticKey = '';
      R.light = null;
    }

    function tileCenter(x, y) {
      return [R.ox + x * R.tile + R.tile / 2, R.oy + y * R.tile + R.tile / 2];
    }

    function pick(clientX, clientY) {
      const rect = R.canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * R.dpr - R.ox;
      const y = (clientY - rect.top) * R.dpr - R.oy;
      const tx = Math.floor(x / R.tile);
      const ty = Math.floor(y / R.tile);
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return null;
      return { x: tx, y: ty };
    }

    /* ------------------------------------------------------------- camada estática */

    function buildStatic(S) {
      const key = S.seed + '|' + S.stageIdx + '|' + R.px + '|' + S.map.join('');
      if (key === R.staticKey && R.staticLayer) return;
      R.staticKey = key;
      const T = R.tile;
      const p = R.px;
      const c = document.createElement('canvas');
      c.width = T * W;
      c.height = T * H;
      const g = c.getContext('2d');
      const look = BIOME_LOOK[S.biome];
      const seedN = FF.util.hashStr(S.seed + S.stageIdx) % 10000;
      const wallSprite = D.BIOMES[S.biome].wall;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const t = S.map[E.idx(x, y)];
          const h0 = hash(x, y, seedN);
          g.fillStyle = look.floor[Math.floor(h0 * look.floor.length)];
          g.fillRect(x * T, y * T, T, T);
          // Detalhes do chão em "pixels" de arte.
          const n = 3 + Math.floor(hash(x, y, seedN + 7) * 4);
          for (let i = 0; i < n; i++) {
            const dx = Math.floor(hash(x, y, seedN + 11 + i) * 14) + 1;
            const dy = Math.floor(hash(x, y, seedN + 31 + i) * 14) + 1;
            g.fillStyle = look.detail;
            g.fillRect(x * T + dx * p, y * T + dy * p, p, p);
            if (S.biome === 'mata' && i % 2 === 0) g.fillRect(x * T + dx * p, y * T + (dy - 1) * p, p, p);
          }
          if (hash(x, y, seedN + 97) < 0.18) {
            const dx = Math.floor(hash(x, y, seedN + 5) * 12) + 2;
            const dy = Math.floor(hash(x, y, seedN + 6) * 12) + 2;
            g.fillStyle = look.flower[Math.floor(hash(x, y, seedN + 8) * look.flower.length)];
            g.fillRect(x * T + dx * p, y * T + dy * p, p, p);
            if (S.biome === 'pedreira') {
              g.globalAlpha = 0.5;
              g.fillRect(x * T + (dx + 1) * p, y * T + dy * p, p, p);
              g.fillRect(x * T + (dx + 2) * p, y * T + (dy + 1) * p, p, p);
              g.globalAlpha = 1;
            }
          }
          if (t === E.WATER) {
            g.fillStyle = '#123547';
            g.fillRect(x * T, y * T, T, T);
          }
        }
      // Margens da água e sombras das paredes.
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const t = S.map[E.idx(x, y)];
          if (t === E.WATER) {
            g.fillStyle = 'rgba(180,230,255,0.25)';
            if (y > 0 && S.map[E.idx(x, y - 1)] !== E.WATER) g.fillRect(x * T, y * T, T, p);
          }
        }
      // Grade suave.
      g.fillStyle = look.grid;
      for (let i = 1; i < W; i++) g.fillRect(i * T, 0, Math.max(1, Math.floor(p / 2)), T * H);
      for (let i = 1; i < H; i++) g.fillRect(0, i * T, T * W, Math.max(1, Math.floor(p / 2)));
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const t = S.map[E.idx(x, y)];
          if (t === E.WALL) {
            g.fillStyle = 'rgba(0,0,0,0.35)';
            g.beginPath();
            g.ellipse(x * T + T / 2, y * T + T * 0.82, T * 0.38, T * 0.13, 0, 0, Math.PI * 2);
            g.fill();
            g.drawImage(SP.get(wallSprite, p), x * T - p, y * T - p);
          } else if (t === E.THORN) {
            g.drawImage(SP.get('espinhos', p), x * T - p, y * T - p);
          }
        }
      R.staticLayer = c;
    }

    /* --------------------------------------------------------------------- efeitos */

    function addText(x, y, text, color, big) {
      const [cx, cy] = tileCenter(x, y);
      // Textos na mesma casa ao mesmo tempo sobem em pilha, sem se sobrepor.
      const stack = R.texts.filter((t) => Math.abs(t.x - cx) < R.tile * 0.5 && Math.abs(t.y0 - (cy - R.tile * 0.4)) < R.tile * 0.6 && t.t < 0.5).length;
      const y0 = cy - R.tile * 0.4;
      R.texts.push({ x: cx, y0, y: y0 - stack * R.tile * 0.32, text, color, t: 0, life: big ? 1.4 : 0.9, big: !!big });
    }

    function burst(x, y, color, n, speed, life) {
      if (R.reduceMotion) n = Math.ceil(n / 3);
      const [cx, cy] = tileCenter(x, y);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (0.3 + Math.random()) * (speed || 1) * R.tile * 2.2;
        R.particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - R.tile, g: R.tile * 4, life: (life || 0.5) * (0.6 + Math.random() * 0.6), t: 0, color, size: R.px * (Math.random() < 0.3 ? 2 : 1) });
      }
    }

    function addFx(f) {
      f.t = 0;
      R.fx.push(f);
    }

    function shake(n) {
      if (!R.reduceMotion) R.shake = Math.max(R.shake, n * R.px);
    }

    function unitColor(type) {
      const def = SP.DEFS[type];
      if (!def) return '#ffffff';
      const keys = Object.keys(def.pal);
      return def.pal[keys[0]];
    }

    function handle(ev, S) {
      const p = S.player;
      switch (ev.t) {
        case 'step':
          R.playerMove = { from: ev.from, to: ev.to, t: 0, dur: 0.11 };
          if (ev.to[0] !== ev.from[0]) R.facing.player = ev.to[0] > ev.from[0] ? 1 : -1;
          break;
        case 'strike':
          R.lunge = { dir: ev.dir, t: 0 };
          if (DIRS[ev.dir][0]) R.facing.player = DIRS[ev.dir][0];
          addFx({ kind: 'slash', tiles: ev.tiles, dir: ev.dir, life: 0.22 });
          break;
        case 'hit':
          R.flash[ev.id] = 0.14;
          addText(ev.x, ev.y, '-' + ev.n, ev.crit ? '#ffe08a' : '#ffffff', ev.crit);
          burst(ev.x, ev.y, '#ffffff', 6, 0.7, 0.35);
          shake(ev.crit ? 3 : 1.5);
          break;
        case 'hurt':
          R.playerFlash = 0.2;
          R.hurtFlash = 0.35;
          addText(ev.x, ev.y, '-' + ev.n, '#ff6b6b', true);
          burst(ev.x, ev.y, '#ff6b6b', 10, 0.9, 0.45);
          shake(4);
          break;
        case 'die': {
          const d = R.disp[ev.id] || { x: ev.x, y: ev.y };
          addFx({ kind: 'ghost', type: ev.type, x: d.x, y: d.y, life: 0.6, flip: R.facing[ev.id] || 1 });
          burst(ev.x, ev.y, unitColor(ev.type), 14, 1.1, 0.6);
          delete R.disp[ev.id];
          break;
        }
        case 'push':
          R.disp[ev.id] = R.disp[ev.id] || { x: ev.from[0], y: ev.from[1] };
          R.tweens = R.tweens || {};
          R.tweens[ev.id] = { from: ev.from, to: ev.to, t: 0, dur: 0.12 };
          break;
        case 'bump':
          burst(ev.x + ev.dx * 0.5, ev.y + ev.dy * 0.5, '#d8cfbf', 8, 0.6, 0.3);
          shake(2);
          break;
        case 'move':
          R.tweens = R.tweens || {};
          R.tweens[ev.id] = { from: ev.from, to: ev.to, t: 0, dur: ev.hop ? 0.2 : 0.13, hop: ev.hop };
          if (ev.to[0] !== ev.from[0]) R.facing[ev.id] = ev.to[0] > ev.from[0] ? 1 : -1;
          break;
        case 'dash':
          if (ev.id != null) {
            R.tweens = R.tweens || {};
            R.tweens[ev.id] = { from: ev.from, to: ev.to, t: 0, dur: 0.16 };
          } else {
            R.playerMove = { from: ev.from, to: ev.to, t: 0, dur: 0.16 };
          }
          addFx({ kind: 'trail', from: ev.from, to: ev.to, life: 0.35, color: ev.id != null ? '#ff9a5a' : '#cfe2ff' });
          shake(2);
          break;
        case 'attack':
          if (ev.k === 'spin') addFx({ kind: 'ring', x: S.units.find((u) => u.id === ev.id)?.x, y: S.units.find((u) => u.id === ev.id)?.y, life: 0.3, color: '#f2ead6' });
          addFx({ kind: 'slash', tiles: ev.tiles, life: 0.22, color: '#ff8a8a' });
          R.flashTiles = { tiles: ev.tiles, t: 0.2 };
          break;
        case 'shot':
          addFx({ kind: 'bolt', from: ev.from, to: ev.to, life: 0.18, color: '#c9b8ff', straight: true });
          break;
        case 'arrow':
          addFx({ kind: 'arrow', from: ev.from, to: ev.to, life: 0.16 });
          break;
        case 'curse':
          addFx({ kind: 'orb', from: ev.from, tiles: ev.tiles, life: 0.32, color: S.biome === 'calunga' ? '#b48cff' : '#93ff7d' });
          for (const [x, y] of ev.tiles) burst(x, y, S.biome === 'calunga' ? '#b48cff' : '#93ff7d', 4, 0.5, 0.4);
          shake(2);
          break;
        case 'lightning':
          addFx({ kind: 'lightning', x: ev.x, y: ev.y, tiles: ev.tiles, life: 0.35 });
          shake(4);
          break;
        case 'wind':
          addFx({ kind: 'ring', x: ev.x, y: ev.y, life: 0.4, color: '#cfeaff', big: true });
          break;
        case 'bolt':
          addFx({ kind: 'bolt', from: ev.from, to: ev.to, life: 0.25, color: '#fff3a8' });
          break;
        case 'reflect':
          addFx({ kind: 'bolt', from: ev.from, to: ev.to, life: 0.2, color: '#ffe08a', straight: true });
          break;
        case 'block':
          addFx({ kind: 'ring', x: ev.x, y: ev.y, life: 0.4, color: '#9ad7ff' });
          addText(ev.x, ev.y, 'bloqueado', '#9ad7ff');
          break;
        case 'heal':
          addText(ev.x, ev.y, '+' + ev.n, '#7dff9a', true);
          burst(ev.x, ev.y, '#7dff9a', 8, 0.5, 0.6);
          break;
        case 'miss':
          addText(ev.x, ev.y, 'errou', '#cfd6e6');
          break;
        case 'dizzy':
          addText(ev.x, ev.y, 'tonto!', '#ffe08a');
          break;
        case 'stuck':
          addText(ev.x, ev.y, 'preso!', '#9ad7ff');
          break;
        case 'exposed':
          addText(ev.x, ev.y, 'ATORDOADA', '#ffe08a', true);
          shake(5);
          break;
        case 'resist':
          addText(ev.x, ev.y, 'firme', '#cfd6e6');
          break;
        case 'ignite':
          burst(ev.x, ev.y, '#ff8a3a', 5, 0.5, 0.4);
          break;
        case 'burn':
          burst(ev.x, ev.y, '#ff8a3a', 4, 0.4, 0.4);
          break;
        case 'splash':
          burst(ev.x, ev.y, '#9fd8ff', 16, 1, 0.6);
          addText(ev.x, ev.y, 'correnteza!', '#9fd8ff');
          break;
        case 'thorn':
          burst(ev.x, ev.y, '#e8dcc0', 5, 0.5, 0.3);
          break;
        case 'spawn':
          R.disp[ev.id] = { x: ev.x, y: ev.y };
          R.spawnT = R.spawnT || {};
          R.spawnT[ev.id] = 0.35;
          burst(ev.x, ev.y, '#b48cff', 12, 0.8, 0.5);
          break;
        case 'vanish':
          burst(ev.x, ev.y, '#6e46c9', 18, 1, 0.6);
          break;
        case 'appear':
          R.disp[ev.id] = { x: ev.x, y: ev.y };
          burst(ev.x, ev.y, '#b48cff', 18, 1, 0.6);
          shake(3);
          break;
        case 'ember':
          burst(ev.x, ev.y, '#ffb347', 8, 0.6, 0.5);
          break;
        case 'free':
          addText(ev.x, ev.y, '+ação', '#7dffde');
          break;
        case 'bossPhase':
          shake(6);
          R.hurtFlash = 0.25;
          break;
        case 'stunned':
          break;
        case 'death':
          shake(8);
          break;
        case 'fizzle':
          burst(ev.x, ev.y, '#86a12f', 6, 0.5, 0.4);
          break;
      }
    }

    /* -------------------------------------------------------------------- desenho */

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }
    function ease(t) {
      return t < 0 ? 0 : t > 1 ? 1 : 1 - (1 - t) * (1 - t);
    }

    function unitDisplay(u) {
      let d = R.disp[u.id];
      if (!d) d = R.disp[u.id] = { x: u.x, y: u.y };
      const tw = R.tweens && R.tweens[u.id];
      if (tw) {
        const k = ease(tw.t / tw.dur);
        d.x = lerp(tw.from[0], tw.to[0], k);
        d.y = lerp(tw.from[1], tw.to[1], k);
        d.lift = tw.hop ? Math.sin(Math.PI * Math.min(1, tw.t / tw.dur)) * 0.5 : 0;
        if (tw.t >= tw.dur) {
          delete R.tweens[u.id];
          d.x = u.x;
          d.y = u.y;
          d.lift = 0;
        }
      } else {
        d.x = u.x;
        d.y = u.y;
        d.lift = 0;
      }
      return d;
    }

    function drawTileRect(ctx, x, y, fill, inset) {
      const T = R.tile;
      const i = inset || 0;
      ctx.fillStyle = fill;
      ctx.fillRect(R.ox + x * T + i, R.oy + y * T + i, T - i * 2, T - i * 2);
    }

    function drawThreat(ctx, x, y, strong, color) {
      const T = R.tile;
      const p = R.px;
      const bx = R.ox + x * T;
      const by = R.oy + y * T;
      const pulse = 0.5 + 0.5 * Math.sin(R.time * 6);
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, T, T);
      ctx.clip();
      ctx.fillStyle = color || 'rgba(255,60,60,' + (strong ? 0.3 + pulse * 0.12 : 0.22) + ')';
      ctx.fillRect(bx, by, T, T);
      ctx.strokeStyle = 'rgba(255,120,120,' + (strong ? 0.55 : 0.35) + ')';
      ctx.lineWidth = p;
      const off = (R.time * 18 * p) % (p * 6);
      for (let k = -T; k < T * 2; k += p * 6) {
        ctx.beginPath();
        ctx.moveTo(bx + k + off, by);
        ctx.lineTo(bx + k + off - T, by + T);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,90,90,0.9)';
      ctx.lineWidth = p;
      ctx.strokeRect(bx + p / 2, by + p / 2, T - p, T - p);
    }

    function drawFire(ctx, S, x, y, turns) {
      const T = R.tile;
      const p = R.px;
      const cols = FIRE[BIOME_LOOK[S.biome].fire];
      const bx = R.ox + x * T;
      const by = R.oy + y * T;
      ctx.fillStyle = S.biome === 'calunga' ? 'rgba(110,70,200,0.22)' : 'rgba(255,90,30,0.2)';
      ctx.fillRect(bx, by, T, T);
      const tongues = turns > 1 ? 4 : 3;
      for (let i = 0; i < tongues; i++) {
        const hx = 2 + i * 3 + Math.floor(hash(x, y, i) * 2);
        const h = 4 + Math.floor((Math.sin(R.time * 9 + i * 2 + x * 3 + y) * 0.5 + 0.5) * 5) + (turns > 1 ? 2 : 0);
        for (let k = 0; k < h; k++) {
          const c = k < h * 0.4 ? cols[0] : k < h * 0.8 ? cols[1] : cols[2];
          const wob = Math.round(Math.sin(R.time * 7 + k + i) * 0.6);
          ctx.fillStyle = c;
          ctx.fillRect(bx + (hx + wob) * p, by + (15 - k) * p, p * (k < h - 1 ? 2 : 1), p);
        }
      }
    }

    function drawWater(ctx, S, x, y) {
      const T = R.tile;
      const p = R.px;
      const bx = R.ox + x * T;
      const by = R.oy + y * T;
      const g = ctx.createLinearGradient(bx, by, bx, by + T);
      g.addColorStop(0, '#1b4f6e');
      g.addColorStop(1, '#123a52');
      ctx.fillStyle = g;
      ctx.fillRect(bx, by, T, T);
      // Correnteza: traços que descem o rio.
      for (let r = 0; r < 4; r++) {
        const yy = (Math.floor(R.time * 4 + r * 4 + x * 3) % 16 + 16) % 16;
        const xx = (r * 5 + x * 7 + y * 3) % 13;
        ctx.fillStyle = r % 2 ? 'rgba(140,210,245,0.5)' : 'rgba(90,170,220,0.4)';
        ctx.fillRect(bx + xx * p, by + yy * p, p * 3, p);
      }
      const sp = Math.sin(R.time * 3 + x * 2.3 + y * 1.1);
      if (sp > 0.85) {
        ctx.fillStyle = 'rgba(230,250,255,0.8)';
        ctx.fillRect(bx + ((x * 5 + y * 3) % 12 + 2) * p, by + ((x + y * 7) % 12 + 2) * p, p, p);
      }
      // Espuma nas margens.
      ctx.fillStyle = 'rgba(200,240,255,0.35)';
      const land = (dx, dy) => E.inb(x + dx, y + dy) && S.map[E.idx(x + dx, y + dy)] !== E.WATER;
      if (land(0, -1)) ctx.fillRect(bx, by, T, p);
      if (land(0, 1)) ctx.fillRect(bx, by + T - p, T, p);
      if (land(-1, 0)) ctx.fillRect(bx, by, p, T);
      if (land(1, 0)) ctx.fillRect(bx + T - p, by, p, T);
    }

    function drawSprite(ctx, name, cx, by, flip, variant, alpha) {
      const p = R.px;
      const img = SP.get(name, p, variant);
      if (!img) return;
      const sz = SP.size(name);
      const w = (sz.w + 2) * p;
      const h = (sz.h + 2) * p;
      const x = Math.round(cx - w / 2);
      const y = Math.round(by - h + p);
      ctx.save();
      if (alpha != null) ctx.globalAlpha = alpha;
      if (flip < 0) {
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
      } else {
        ctx.drawImage(img, x, y);
      }
      ctx.restore();
    }

    function drawShadow(ctx, cx, cy, wide) {
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, R.tile * (wide ? 0.42 : 0.3), R.tile * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawPips(ctx, cx, top, hp, max) {
      const p = R.px;
      if (max > 8) {
        // Vida longa (Ikú): barra proporcional.
        const w = R.tile * 1.1;
        ctx.fillStyle = '#0b0810';
        ctx.fillRect(cx - w / 2 - p, top - p, w + p * 2, p * 3);
        ctx.fillStyle = '#3a2a30';
        ctx.fillRect(cx - w / 2, top, w, p);
        ctx.fillStyle = '#b48cff';
        ctx.fillRect(cx - w / 2, top, (w * Math.max(0, hp)) / max, p);
        return;
      }
      const n = Math.min(max, 10);
      const w = n * p * 2 + (n - 1) * p * 0.5;
      let x = cx - w / 2;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = '#0b0810';
        ctx.fillRect(x - p * 0.5, top - p * 0.5, p * 3, p * 2);
        ctx.fillStyle = i < hp ? '#ff5a4f' : '#3a2a30';
        ctx.fillRect(x, top, p * 2, p);
        x += p * 2.5;
      }
    }

    function drawBadge(ctx, cx, cy, text, bg, fg) {
      const p = R.px;
      ctx.font = '600 ' + Math.round(R.tile * 0.26) + 'px "Pixelify Sans", Jost, system-ui, sans-serif';
      const w = ctx.measureText(text).width + p * 3;
      const h = R.tile * 0.3;
      ctx.fillStyle = bg;
      ctx.fillRect(Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, cy + p * 0.3);
    }

    function intentLabel(u) {
      const it = u.intent;
      if (!it) return null;
      if (it.k === 'summon') return { text: '+', bg: '#6e46c9' };
      return { text: '!' + it.dmg, bg: '#d33a3a' };
    }

    function draw(S, dt, ui) {
      const ctx = R.ctx;
      if (!ctx || !S) return;
      R.time += dt;
      const T = R.tile;
      const p = R.px;
      const look = BIOME_LOOK[S.biome];
      buildStatic(S);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = look.bg;
      ctx.fillRect(0, 0, R.canvas.width, R.canvas.height);

      // Tremor de tela.
      R.shake = Math.max(0, R.shake - dt * 60 * R.px);
      const sx = R.shake ? (Math.random() - 0.5) * R.shake : 0;
      const sy = R.shake ? (Math.random() - 0.5) * R.shake : 0;
      ctx.setTransform(1, 0, 0, 1, Math.round(sx), Math.round(sy));

      // Moldura.
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(R.ox - p * 2, R.oy - p * 2, T * W + p * 4, T * H + p * 4);
      ctx.drawImage(R.staticLayer, R.ox, R.oy);

      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const t = S.map[E.idx(x, y)];
          if (t === E.WATER) drawWater(ctx, S, x, y);
          const f = S.fire[E.idx(x, y)];
          if (f > 0) drawFire(ctx, S, x, y, f);
        }

      // Portais da próxima onda e brasas que vão cair.
      for (const q of S.portals || []) {
        const [cx, cy] = tileCenter(q.x, q.y);
        ctx.strokeStyle = 'rgba(180,140,255,0.85)';
        ctx.lineWidth = p;
        ctx.beginPath();
        const r = T * (0.3 + 0.05 * Math.sin(R.time * 5));
        ctx.ellipse(cx, cy + T * 0.2, r, r * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
        drawSprite(ctx, q.type, cx, R.oy + q.y * T + T, 1, 'ghost', 0.25 + 0.1 * Math.sin(R.time * 4));
      }
      for (const m of S.rainMarks || []) {
        const [cx, cy] = tileCenter(m.x, m.y);
        ctx.strokeStyle = 'rgba(255,170,60,0.9)';
        ctx.lineWidth = p;
        ctx.beginPath();
        ctx.arc(cx, cy, T * 0.32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - T * 0.15, cy);
        ctx.lineTo(cx + T * 0.15, cy);
        ctx.moveTo(cx, cy - T * 0.15);
        ctx.lineTo(cx, cy + T * 0.15);
        ctx.stroke();
      }

      // Marcas de ataque preparado.
      const hoverUnit = R.hover ? E.unitAt(S, R.hover.x, R.hover.y) : null;
      const threatened = new Set();
      for (const u of S.units) {
        if (!u.intent) continue;
        const tiles = E.intentTiles(S, u);
        if (u.intent.k === 'summon') {
          for (const [x, y] of tiles) {
            ctx.strokeStyle = 'rgba(180,140,255,0.9)';
            ctx.setLineDash([p * 2, p * 2]);
            ctx.lineWidth = p;
            ctx.strokeRect(R.ox + x * T + p, R.oy + y * T + p, T - p * 2, T - p * 2);
            ctx.setLineDash([]);
          }
          continue;
        }
        for (const [x, y] of tiles) {
          const k = x + ',' + y;
          const strong = hoverUnit === u || (S.player.x === x && S.player.y === y);
          if (!threatened.has(k) || strong) drawThreat(ctx, x, y, strong);
          threatened.add(k);
        }
      }

      // Prévia das ações do jogador.
      if (ui && ui.preview) {
        for (const t of ui.preview.tiles) {
          drawTileRect(ctx, t[0], t[1], ui.preview.color || 'rgba(111,232,255,0.22)');
          ctx.strokeStyle = 'rgba(111,232,255,0.8)';
          ctx.lineWidth = p;
          ctx.strokeRect(R.ox + t[0] * T + p / 2, R.oy + t[1] * T + p / 2, T - p, T - p);
        }
      }
      if (ui && ui.targets) {
        for (const t of ui.targets) {
          const [cx, cy] = tileCenter(t[0], t[1]);
          ctx.fillStyle = 'rgba(111,232,255,' + (0.35 + 0.2 * Math.sin(R.time * 6)) + ')';
          ctx.fillRect(cx - p * 1.5, cy - p * 1.5, p * 3, p * 3);
        }
      }
      if (ui && ui.hints && S.phase === 'play') {
        for (const h of ui.hints) {
          const [cx, cy] = tileCenter(h.x, h.y);
          if (h.attack) {
            // Cantos ao redor do inimigo que dá para golpear.
            const a = T * 0.36;
            const l = T * 0.14;
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = p;
            ctx.beginPath();
            for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
              ctx.moveTo(cx + sx * a, cy + sy * a - sy * l);
              ctx.lineTo(cx + sx * a, cy + sy * a);
              ctx.lineTo(cx + sx * a - sx * l, cy + sy * a);
            }
            ctx.stroke();
          } else {
            // Seta apontando para onde o passo leva; vermelha se o passo leva ao perigo.
            const [dx, dy] = DIRS[h.dir];
            const sz = T * 0.11;
            const bx = cx - dx * sz * 0.4;
            const by = cy - dy * sz * 0.4;
            ctx.strokeStyle = h.danger ? 'rgba(255,96,84,0.95)' : 'rgba(255,255,255,0.42)';
            ctx.lineWidth = p * 1.5;
            ctx.lineCap = 'square';
            ctx.beginPath();
            ctx.moveTo(bx - dx * sz - dy * sz, by - dy * sz - dx * sz);
            ctx.lineTo(bx + dx * sz * 0.6, by + dy * sz * 0.6);
            ctx.lineTo(bx - dx * sz + dy * sz, by - dy * sz + dx * sz);
            ctx.stroke();
            ctx.lineCap = 'butt';
          }
        }
      }
      if (R.hover && S.phase === 'play') {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = p;
        ctx.strokeRect(R.ox + R.hover.x * T + p / 2, R.oy + R.hover.y * T + p / 2, T - p, T - p);
      }

      // Criaturas e jogador, de cima para baixo.
      const drawables = [];
      for (const u of S.units) drawables.push({ u, d: unitDisplay(u) });
      let pd = { x: S.player.x, y: S.player.y };
      if (R.playerMove) {
        const m = R.playerMove;
        m.t += dt;
        const k = ease(m.t / m.dur);
        pd = { x: lerp(m.from[0], m.to[0], k), y: lerp(m.from[1], m.to[1], k) };
        if (m.t >= m.dur) R.playerMove = null;
      }
      if (R.lunge) {
        R.lunge.t += dt;
        const k = Math.sin(Math.PI * Math.min(1, R.lunge.t / 0.16)) * 0.25;
        pd = { x: pd.x + DIRS[R.lunge.dir][0] * k, y: pd.y + DIRS[R.lunge.dir][1] * k };
        if (R.lunge.t > 0.16) R.lunge = null;
      }
      R.playerDisp = pd;
      drawables.push({ player: true, d: pd });
      drawables.sort((a, b) => a.d.y - b.d.y);

      for (const it of drawables) {
        const d = it.d;
        const cx = R.ox + d.x * T + T / 2;
        const by = R.oy + d.y * T + T;
        if (it.player) {
          if (S.phase === 'dead') continue;
          drawShadow(ctx, cx, by - p * 2);
          const bob = Math.round(Math.sin(R.time * 3) * 0.6) * p;
          drawSprite(ctx, S.hero, cx, by - p + bob, R.facing.player || 1, R.playerFlash > 0 ? 'flash' : null);
          if (threatened.has(S.player.x + ',' + S.player.y) && S.phase === 'play') {
            drawBadge(ctx, cx, R.oy + d.y * T - p * 2, '!', '#d33a3a', '#ffffff');
          }
          continue;
        }
        const u = it.u;
        const spec = D.ENEMIES[u.type];
        const big = !!spec.boss;
        drawShadow(ctx, cx, by - p * 2, big || spec.elite);
        const bob = Math.round(Math.sin(R.time * 3.2 + u.id * 1.7) * 0.6) * p;
        const lift = (d.lift || 0) * T;
        let alpha = null;
        if (R.spawnT && R.spawnT[u.id] > 0) {
          R.spawnT[u.id] -= dt;
          alpha = 1 - Math.max(0, R.spawnT[u.id]) / 0.35;
        }
        const flip = R.facing[u.id] || (S.player.x < u.x ? -1 : 1);
        const fl = R.flash[u.id] > 0;
        if (fl) R.flash[u.id] -= dt;
        drawSprite(ctx, u.type, cx, by - p + bob - lift, flip, fl ? 'flash' : null, alpha);
        const sz = SP.size(u.type);
        const top = by - (sz.h + 1) * p + bob - lift;
        if (u.maxHp > 1) drawPips(ctx, cx, top - p * 2, u.hp, u.maxHp);
        const lab = intentLabel(u);
        if (lab) drawBadge(ctx, cx, top - p * 5.5, lab.text, lab.bg, '#ffffff');
        if (u.stun > 0) {
          for (let k = 0; k < 3; k++) {
            const a = R.time * 4 + (k * Math.PI * 2) / 3;
            ctx.fillStyle = '#ffe08a';
            ctx.fillRect(cx + Math.cos(a) * T * 0.28 - p / 2, top + p * 2 + Math.sin(a) * T * 0.08, p, p);
          }
        }
        if (u.exposed) drawBadge(ctx, cx, top - p * 9, '×2', '#ffe08a', '#1a1020');
        if (u.burn > 0) {
          ctx.fillStyle = '#ff8a3a';
          ctx.fillRect(cx + T * 0.28, by - T * 0.8 + Math.sin(R.time * 10) * p, p * 2, p * 2);
        }
      }

      // Fantasmas de quem foi derrotado e outros efeitos.
      drawFx(ctx, dt, S);

      // Luz: escuridão com a lamparina do axé ao redor do jogador e do fogo.
      drawLight(ctx, S, pd, look);

      drawParticles(ctx, dt, S, look);
      drawTexts(ctx, dt);

      if (R.hurtFlash > 0) {
        R.hurtFlash -= dt;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'rgba(200,30,30,' + Math.max(0, R.hurtFlash) * 0.6 + ')';
        ctx.fillRect(0, 0, R.canvas.width, R.canvas.height);
      }
      if (R.playerFlash > 0) R.playerFlash -= dt;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawLight(ctx, S, pd, look) {
      const T = R.tile;
      const w = T * W;
      const h = T * H;
      if (!R.light || R.light.width !== w) {
        R.light = document.createElement('canvas');
        R.light.width = w;
        R.light.height = h;
      }
      const g = R.light.getContext('2d');
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgba(4,2,10,' + look.dark + ')';
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-out';
      const flick = 1 + Math.sin(R.time * 7) * 0.02 + Math.sin(R.time * 13) * 0.015;
      const light = (x, y, r, a) => {
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(0,0,0,' + a + ')');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      };
      light(pd.x * T + T / 2, pd.y * T + T / 2, T * 3.6 * flick, 1);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) if (S.fire[E.idx(x, y)] > 0) light(x * T + T / 2, y * T + T / 2, T * 1.6 * flick, 0.7);
      for (const u of S.units) if (u.intent) light(u.x * T + T / 2, u.y * T + T / 2, T * 1.1, 0.5);
      ctx.drawImage(R.light, R.ox, R.oy);
      // Vinheta.
      const cx = R.ox + w / 2;
      const cy = R.oy + h / 2;
      const vg = ctx.createRadialGradient(cx, cy, w * 0.35, cx, cy, w * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = vg;
      ctx.fillRect(R.ox, R.oy, w, h);
      // Brilho quente ao redor do jogador.
      const pg = ctx.createRadialGradient(R.ox + pd.x * T + T / 2, R.oy + pd.y * T + T / 2, 0, R.ox + pd.x * T + T / 2, R.oy + pd.y * T + T / 2, T * 2.2);
      pg.addColorStop(0, 'rgba(255,200,120,0.08)');
      pg.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = pg;
      ctx.fillRect(R.ox, R.oy, w, h);
    }

    function centerOf(t) {
      return tileCenter(t[0], t[1]);
    }

    function jagged(ctx, x1, y1, x2, y2, segs, amp) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      for (let i = 1; i < segs; i++) {
        const k = i / segs;
        ctx.lineTo(lerp(x1, x2, k) + (Math.random() - 0.5) * amp, lerp(y1, y2, k) + (Math.random() - 0.5) * amp);
      }
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    function drawFx(ctx, dt, S) {
      const T = R.tile;
      const p = R.px;
      for (const f of R.fx) {
        f.t += dt;
        const k = Math.min(1, f.t / f.life);
        ctx.save();
        switch (f.kind) {
          case 'ghost': {
            const cx = R.ox + f.x * T + T / 2;
            const by = R.oy + f.y * T + T - k * T * 0.5;
            drawSprite(ctx, f.type, cx, by, f.flip, 'ghost', (1 - k) * 0.8);
            break;
          }
          case 'slash': {
            ctx.globalAlpha = 1 - k;
            for (const t of f.tiles) {
              const [cx, cy] = centerOf(t);
              ctx.strokeStyle = f.color || '#ffffff';
              ctx.lineWidth = p * 2;
              ctx.beginPath();
              ctx.arc(cx, cy, T * (0.25 + k * 0.2), -Math.PI * 0.8 + k, Math.PI * 0.1 + k);
              ctx.stroke();
            }
            break;
          }
          case 'trail': {
            const [x1, y1] = centerOf(f.from);
            const [x2, y2] = centerOf(f.to);
            ctx.globalAlpha = (1 - k) * 0.8;
            ctx.strokeStyle = f.color;
            ctx.lineWidth = T * 0.3 * (1 - k);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            break;
          }
          case 'ring': {
            if (f.x == null) break;
            const [cx, cy] = centerOf([f.x, f.y]);
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = f.color;
            ctx.lineWidth = p * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, T * (f.big ? 0.4 + k * 1.2 : 0.3 + k * 0.5), 0, Math.PI * 2);
            ctx.stroke();
            break;
          }
          case 'bolt': {
            const [x1, y1] = centerOf(f.from);
            const [x2, y2] = centerOf(f.to);
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = f.color;
            ctx.lineWidth = p * 1.5;
            if (f.straight) {
              const hk = Math.min(1, k * 2.5);
              ctx.beginPath();
              ctx.moveTo(lerp(x1, x2, Math.max(0, hk - 0.4)), lerp(y1, y2, Math.max(0, hk - 0.4)));
              ctx.lineTo(lerp(x1, x2, hk), lerp(y1, y2, hk));
              ctx.stroke();
            } else jagged(ctx, x1, y1, x2, y2, 6, T * 0.3);
            break;
          }
          case 'arrow': {
            const [x1, y1] = centerOf(f.from);
            const [x2, y2] = centerOf(f.to);
            const hk = Math.min(1, k * 1.6);
            const hx = lerp(x1, x2, hk);
            const hy = lerp(y1, y2, hk);
            const ang = Math.atan2(y2 - y1, x2 - x1);
            ctx.strokeStyle = '#efe8cf';
            ctx.lineWidth = p;
            ctx.beginPath();
            ctx.moveTo(hx - Math.cos(ang) * T * 0.5, hy - Math.sin(ang) * T * 0.5);
            ctx.lineTo(hx, hy);
            ctx.stroke();
            ctx.fillStyle = '#e4b54a';
            ctx.fillRect(hx - p, hy - p, p * 2, p * 2);
            ctx.globalAlpha = 0.4 * (1 - k);
            ctx.strokeStyle = '#7fd1b9';
            ctx.lineWidth = p * 2;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(hx, hy);
            ctx.stroke();
            break;
          }
          case 'orb': {
            const [x1, y1] = centerOf(f.from);
            const [x2, y2] = centerOf(f.tiles[0] || f.from);
            const hk = Math.min(1, k * 1.8);
            const hx = lerp(x1, x2, hk);
            const hy = lerp(y1, y2, hk) - Math.sin(Math.PI * hk) * T * 1.2;
            ctx.fillStyle = f.color;
            ctx.globalAlpha = 1 - Math.max(0, k - 0.6) * 2.5;
            ctx.fillRect(hx - p * 2, hy - p * 2, p * 4, p * 4);
            if (hk >= 1) {
              ctx.globalAlpha = (1 - k) * 0.7;
              for (const t of f.tiles) drawTileRect(ctx, t[0], t[1], f.color);
            }
            break;
          }
          case 'lightning': {
            const [cx, cy] = centerOf([f.x, f.y]);
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = '#fff6b0';
            ctx.lineWidth = p * 2;
            jagged(ctx, cx + (Math.random() - 0.5) * T, R.oy - T, cx, cy, 8, T * 0.6);
            ctx.fillStyle = 'rgba(255,240,170,' + (1 - k) * 0.5 + ')';
            for (const t of f.tiles) drawTileRect(ctx, t[0], t[1], 'rgba(255,240,170,' + (1 - k) * 0.45 + ')');
            break;
          }
        }
        ctx.restore();
      }
      R.fx = R.fx.filter((f) => f.t < f.life);
      if (R.flashTiles) {
        R.flashTiles.t -= dt;
        if (R.flashTiles.t <= 0) R.flashTiles = null;
      }
    }

    function spawnAmbient(S, look) {
      if (R.reduceMotion) return;
      const T = R.tile;
      const max = 26;
      if (R.particles.filter((q) => q.amb).length >= max) return;
      if (Math.random() > 0.25) return;
      const x = R.ox + Math.random() * T * W;
      const y = R.oy + Math.random() * T * H;
      const base = { amb: true, t: 0, g: 0, size: R.px };
      if (look.ambient === 'firefly') Object.assign(base, { x, y, vx: (Math.random() - 0.5) * T * 0.3, vy: (Math.random() - 0.5) * T * 0.3, life: 3 + Math.random() * 3, color: '#d9f27a', glow: true });
      else if (look.ambient === 'ember') Object.assign(base, { x, y: R.oy + T * H, vx: (Math.random() - 0.5) * T * 0.3, vy: -T * (0.5 + Math.random()), life: 3 + Math.random() * 2, color: '#ff9a3a', glow: true });
      else if (look.ambient === 'wisp') Object.assign(base, { x, y, vx: (Math.random() - 0.5) * T * 0.2, vy: -T * 0.15, life: 3 + Math.random() * 3, color: '#b48cff', glow: true });
      else Object.assign(base, { x, y, vx: T * 0.2, vy: -T * 0.05, life: 3 + Math.random() * 3, color: 'rgba(200,230,255,0.5)', size: R.px * 2 });
      R.particles.push(base);
    }

    function drawParticles(ctx, dt, S, look) {
      spawnAmbient(S, look);
      for (const q of R.particles) {
        q.t += dt;
        q.vy += (q.g || 0) * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        const k = q.t / q.life;
        let a = 1 - k;
        if (q.amb) a = Math.sin(Math.PI * k) * (q.glow ? 0.5 + 0.5 * Math.sin(R.time * 5 + q.x) : 1);
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = q.color;
        ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size);
      }
      ctx.globalAlpha = 1;
      R.particles = R.particles.filter((q) => q.t < q.life);
    }

    function drawTexts(ctx, dt) {
      for (const t of R.texts) {
        t.t += dt;
        const k = t.t / t.life;
        const y = t.y - ease(k) * R.tile * 0.5;
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        ctx.font = '600 ' + Math.round(R.tile * (t.big ? 0.38 : 0.28)) + 'px "Pixelify Sans", Jost, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = R.px * 1.5;
        ctx.strokeStyle = '#0b0810';
        ctx.strokeText(t.text, t.x, y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, y);
      }
      ctx.globalAlpha = 1;
      R.texts = R.texts.filter((t) => t.t < t.life);
    }

    function resetStage() {
      R.disp = {};
      R.tweens = {};
      R.flash = {};
      R.facing = {};
      R.fx = [];
      R.texts = [];
      R.particles = R.particles.filter((q) => q.amb);
      R.playerMove = null;
      R.lunge = null;
      R.staticKey = '';
    }

    return Object.assign(R, { init, resize, draw, handle, pick, resetStage, tileCenter, text: addText });
  }

  FF.createRenderer = createRenderer;
  FF.render = createRenderer();
})(typeof window !== 'undefined' ? window : globalThis);
