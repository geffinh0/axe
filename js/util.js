/* Utilitários compartilhados: RNG determinístico, hash de sementes e helpers de grade. */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});

  // Hash de string para inteiro de 32 bits (FNV-1a).
  function hashStr(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // Mulberry32: o estado é um único inteiro, o que mantém o estado do jogo serializável.
  function rngNext(holder) {
    let t = (holder.rng = (holder.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function makeRng(seed) {
    const holder = { rng: typeof seed === 'number' ? seed >>> 0 : hashStr(String(seed)) };
    return {
      holder,
      next: () => rngNext(holder),
      int: (n) => Math.floor(rngNext(holder) * n),
      range: (a, b) => a + Math.floor(rngNext(holder) * (b - a + 1)),
      pick: (arr) => arr[Math.floor(rngNext(holder) * arr.length)],
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(rngNext(holder) * (i + 1));
          const tmp = arr[i];
          arr[i] = arr[j];
          arr[j] = tmp;
        }
        return arr;
      },
    };
  }

  const DIRS = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  function dirIndex(dx, dy) {
    for (let i = 0; i < 4; i++) if (DIRS[i][0] === dx && DIRS[i][1] === dy) return i;
    return -1;
  }

  function manhattan(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function todayKey(d) {
    d = d || new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  FF.util = { hashStr, rngNext, makeRng, DIRS, dirIndex, manhattan, clamp, deepClone, todayKey };
})(typeof window !== 'undefined' ? window : globalThis);
