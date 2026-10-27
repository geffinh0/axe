/*
 * Som sintetizado com WebAudio (sem arquivos): efeitos curtos e uma trilha generativa
 * de atabaques e agogô sobre o padrão de sino 12/8 da música iorubá.
 */
(function (root) {
  'use strict';
  const FF = (root.FF = root.FF || {});

  const A = {
    ctx: null,
    master: null,
    sfxBus: null,
    musicBus: null,
    sfxVol: 0.7,
    musicVol: 0.45,
    mode: null,
    step: 0,
    nextTime: 0,
    timer: null,
    noiseBuf: null,
    intensity: 0,
  };

  function ensure() {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return true;
    }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    try {
      A.ctx = new AC();
    } catch (e) {
      return false;
    }
    A.master = A.ctx.createGain();
    A.master.gain.value = 0.9;
    const comp = A.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    A.master.connect(comp);
    comp.connect(A.ctx.destination);
    A.sfxBus = A.ctx.createGain();
    A.sfxBus.gain.value = A.sfxVol;
    A.sfxBus.connect(A.master);
    A.musicBus = A.ctx.createGain();
    A.musicBus.gain.value = 0;
    A.musicBus.connect(A.master);
    const len = A.ctx.sampleRate * 1;
    A.noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function setVolumes(sfx, music) {
    A.sfxVol = sfx;
    A.musicVol = music;
    if (!A.ctx) return;
    A.sfxBus.gain.setTargetAtTime(sfx, A.ctx.currentTime, 0.05);
    if (A.mode) A.musicBus.gain.setTargetAtTime(music * 0.5, A.ctx.currentTime, 0.2);
  }

  function tone(o) {
    const c = A.ctx;
    const t = (o.at || c.currentTime) + (o.delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.slide || o.d));
    const v = o.v == null ? 0.2 : o.v;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    let node = osc;
    if (o.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.bus || A.sfxBus);
    osc.start(t);
    osc.stop(t + o.d + 0.05);
  }

  function noise(o) {
    const c = A.ctx;
    const t = (o.at || c.currentTime) + (o.delay || 0);
    const src = c.createBufferSource();
    src.buffer = A.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.ft || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.d);
    f.Q.value = o.q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.v == null ? 0.2 : o.v, t + (o.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    src.connect(f);
    f.connect(g);
    g.connect(o.bus || A.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.d + 0.05);
  }

  const SFX = {
    step: () => tone({ f: 190, to: 120, d: 0.06, type: 'triangle', v: 0.12 }),
    hit: () => {
      noise({ f: 1800, d: 0.08, v: 0.25, q: 0.8 });
      tone({ f: 220, to: 70, d: 0.12, type: 'sine', v: 0.3 });
    },
    crit: () => {
      noise({ f: 2400, d: 0.12, v: 0.3 });
      tone({ f: 330, to: 60, d: 0.2, type: 'square', v: 0.18, lp: 1800 });
    },
    kill: () => {
      tone({ f: 520, d: 0.07, type: 'square', v: 0.1, lp: 3000 });
      tone({ f: 780, d: 0.09, type: 'square', v: 0.1, lp: 3000, delay: 0.05 });
      noise({ f: 600, to: 200, d: 0.25, v: 0.15, ft: 'lowpass' });
    },
    hurt: () => {
      tone({ f: 300, to: 90, d: 0.25, type: 'sawtooth', v: 0.2, lp: 1200 });
      noise({ f: 400, d: 0.2, v: 0.2, ft: 'lowpass' });
    },
    block: () => tone({ f: 880, to: 1320, d: 0.18, type: 'triangle', v: 0.18 }),
    telegraph: () => tone({ f: 1400, d: 0.04, type: 'square', v: 0.035, lp: 4000 }),
    shot: () => noise({ f: 3000, to: 800, d: 0.12, v: 0.12 }),
    arrow: () => {
      noise({ f: 4000, to: 1200, d: 0.15, v: 0.18 });
      tone({ f: 900, to: 600, d: 0.1, type: 'triangle', v: 0.08 });
    },
    dash: () => noise({ f: 300, to: 1600, d: 0.2, v: 0.22, ft: 'bandpass', q: 0.7 }),
    lightning: () => {
      noise({ f: 5000, to: 300, d: 0.5, v: 0.35, ft: 'lowpass' });
      tone({ f: 80, to: 40, d: 0.5, type: 'sawtooth', v: 0.2, lp: 400 });
    },
    wind: () => noise({ f: 400, to: 2400, d: 0.45, v: 0.22, q: 2, a: 0.08 }),
    curse: () => {
      tone({ f: 600, to: 200, d: 0.3, type: 'sine', v: 0.15 });
      tone({ f: 607, to: 203, d: 0.3, type: 'sine', v: 0.1 });
    },
    charge: () => noise({ f: 150, to: 900, d: 0.3, v: 0.3, ft: 'lowpass' }),
    spin: () => noise({ f: 1200, to: 300, d: 0.25, v: 0.15, q: 3 }),
    miss: () => tone({ f: 500, to: 350, d: 0.12, type: 'triangle', v: 0.08 }),
    heal: () => {
      tone({ f: 660, d: 0.12, type: 'triangle', v: 0.12 });
      tone({ f: 990, d: 0.18, type: 'triangle', v: 0.1, delay: 0.08 });
    },
    spawn: () => tone({ f: 200, to: 500, d: 0.3, type: 'sine', v: 0.1 }),
    splash: () => noise({ f: 900, to: 200, d: 0.4, v: 0.3, ft: 'lowpass' }),
    bump: () => tone({ f: 120, to: 60, d: 0.1, type: 'square', v: 0.15, lp: 600 }),
    select: () => tone({ f: 660, d: 0.05, type: 'square', v: 0.06, lp: 3000 }),
    back: () => tone({ f: 440, d: 0.05, type: 'square', v: 0.06, lp: 3000 }),
    boon: () => [523, 659, 784, 1046].forEach((f, i) => tone({ f, d: 0.25, type: 'triangle', v: 0.12, delay: i * 0.07 })),
    clear: () => [392, 523, 659, 784].forEach((f, i) => tone({ f, d: 0.35, type: 'square', v: 0.07, lp: 2500, delay: i * 0.1 })),
    victory: () => [392, 523, 659, 784, 659, 1046].forEach((f, i) => tone({ f, d: 0.5, type: 'triangle', v: 0.14, delay: i * 0.14 })),
    defeat: () => [330, 262, 220, 165].forEach((f, i) => tone({ f, d: 0.6, type: 'sawtooth', v: 0.1, lp: 900, delay: i * 0.22 })),
    boss: () => {
      tone({ f: 55, d: 1.2, type: 'sawtooth', v: 0.25, lp: 300 });
      noise({ f: 200, d: 1, v: 0.2, ft: 'lowpass', a: 0.1 });
    },
    free: () => tone({ f: 880, to: 1760, d: 0.12, type: 'triangle', v: 0.1 }),
    combo: () => [784, 988, 1175, 1568].forEach((f, i) => tone({ f, d: 0.16, type: 'square', v: 0.06, lp: 3500, delay: i * 0.045 })),
    ignite: () => noise({ f: 1500, to: 600, d: 0.2, v: 0.12 }),
    portal: () => tone({ f: 300, to: 150, d: 0.4, type: 'sine', v: 0.1 }),
  };

  function play(name) {
    if (!A.ctx || A.sfxVol <= 0) return;
    const fn = SFX[name];
    if (fn) {
      try {
        fn();
      } catch (e) {
        /* um som falhar nunca deve travar o jogo */
      }
    }
  }

  /* ------------------------------------------------------------------- música */

  // Escalas pentatônicas (em Hz) e andamento por clima.
  const MODES = {
    menu: { bpm: 84, root: 110, scale: [0, 3, 5, 7, 10], density: 0.5, bell: true },
    mata: { bpm: 92, root: 110, scale: [0, 2, 4, 7, 9], density: 0.6, bell: true },
    rio: { bpm: 84, root: 98, scale: [0, 2, 5, 7, 9], density: 0.5, bell: true },
    pedreira: { bpm: 104, root: 104, scale: [0, 3, 5, 7, 10], density: 0.8, bell: true },
    calunga: { bpm: 96, root: 92, scale: [0, 1, 5, 7, 8], density: 0.9, bell: true },
  };
  const BELL = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1];
  const LOW = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
  const MID = [0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1];

  function drum(t, f, v) {
    tone({ at: t, f: f * 1.8, to: f, slide: 0.05, d: 0.28, type: 'sine', v, bus: A.musicBus });
    noise({ at: t, f: 2000, d: 0.03, v: v * 0.25, bus: A.musicBus });
  }

  function bell(t, hi) {
    const f = hi ? 1180 : 880;
    tone({ at: t, f, d: 0.16, type: 'triangle', v: 0.05, bus: A.musicBus });
    tone({ at: t, f: f * 2.76, d: 0.06, type: 'sine', v: 0.02, bus: A.musicBus });
  }

  function schedule() {
    if (!A.ctx || !A.mode) return;
    const m = MODES[A.mode];
    const stepDur = 60 / m.bpm / 3;
    while (A.nextTime < A.ctx.currentTime + 0.25) {
      const s = A.step % 12;
      const bar = Math.floor(A.step / 12);
      const t = A.nextTime;
      if (m.bell && BELL[s]) bell(t, s === 0 || s === 7);
      if (LOW[s]) drum(t, 70, 0.32);
      if (MID[s] && Math.random() < m.density + A.intensity * 0.3) drum(t, 140, 0.13);
      if (A.intensity > 0.5 && s % 2 === 1 && Math.random() < 0.5) drum(t, 210, 0.07);
      // Melodia esparsa: chamada e resposta a cada dois compassos.
      if ((s === 0 || s === 4 || s === 8) && Math.random() < 0.35 * m.density) {
        const deg = m.scale[Math.floor(Math.random() * m.scale.length)];
        const oct = bar % 2 === 0 ? 2 : 4;
        const f = m.root * oct * Math.pow(2, deg / 12);
        tone({ at: t, f, d: 0.7, type: 'triangle', v: 0.045, a: 0.02, bus: A.musicBus, lp: 2200 });
      }
      // Bordão grave no início de cada ciclo.
      if (s === 0 && bar % 2 === 0) {
        tone({ at: t, f: m.root / 2, d: stepDur * 22, type: 'sawtooth', v: 0.035, a: 0.4, bus: A.musicBus, lp: 380 });
        tone({ at: t, f: (m.root / 2) * 1.5, d: stepDur * 22, type: 'sawtooth', v: 0.02, a: 0.4, bus: A.musicBus, lp: 380 });
      }
      A.nextTime += stepDur;
      A.step++;
    }
  }

  function music(mode) {
    if (!A.ctx) return;
    if (mode === A.target) return;
    A.target = mode;
    const c = A.ctx;
    A.musicBus.gain.cancelScheduledValues(c.currentTime);
    A.musicBus.gain.setTargetAtTime(0, c.currentTime, 0.15);
    A.mode = null;
    clearInterval(A.timer);
    if (!mode || !MODES[mode]) return;
    setTimeout(() => {
      if (A.target !== mode) return;
      clearInterval(A.timer);
      A.mode = mode;
      A.step = 0;
      A.nextTime = c.currentTime + 0.05;
      A.musicBus.gain.setTargetAtTime(A.musicVol * 0.5, c.currentTime, 0.4);
      A.timer = setInterval(schedule, 90);
    }, 250);
  }

  function setIntensity(v) {
    A.intensity = v;
  }

  FF.audio = { ensure, play, music, setVolumes, setIntensity, state: A };
})(typeof window !== 'undefined' ? window : globalThis);
