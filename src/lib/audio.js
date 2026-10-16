import { bus, toast } from './bus';

// ─────────────────────────────────────────────────────────────
//  Sound. Everything you hear is synthesised live with the Web
//  Audio API: no audio files to download.
//
//  music: a deep-sea drone + slow pads in D minor, ocean noise,
//         bioluminescent "sparkles" and the odd whale call. It
//         gets darker the deeper you scroll.
//  sfx:   hovers, clicks, terminal keys, warp, sonar pings…
//         most are triggered by the bus events the site already
//         sends, so components rarely need to know about sound.
//
//  Off by default (browsers block audio until a click anyway).
//  The choice is remembered; press M or use the HUD button.
// ─────────────────────────────────────────────────────────────

const PREF = 'abyss:sound';
const RED = '#ff1e3c';

const midi = m => 440 * 2 ** ((m - 69) / 12);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = list => list[Math.floor(Math.random() * list.length)];

// D minor: the drone sits on D, the pads move around it
const CHORDS = [
  [50, 57, 64, 65], // Dm add9
  [46, 53, 57, 62], // B♭maj7
  [43, 50, 58, 65], // Gm7
  [45, 52, 55, 62] // A7sus
];
const CHORD_LEN = 11; // seconds per chord
const SPARKLE = [74, 77, 79, 81, 84, 86, 89]; // D minor pentatonic, up high

let ctx = null;
let nodes = null; // the permanent graph, built once per context
let on = false;
let volume = 0.8;
let depth = 0;
let deep = false;
let rumble = null;
const timers = new Set();
const subs = new Set();

const readPref = () => {
  try {
    return localStorage.getItem(PREF);
  } catch {
    return null;
  }
};
const writePref = v => {
  try {
    localStorage.setItem(PREF, v);
  } catch {}
};

// music + sfx only make noise while sound is on and the context is running
const live = () => on && ctx?.state === 'running';

// ───────────── graph ─────────────

function impulse(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

function noiseBuffer(seconds, brown = false) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = white;
  }
  return buf;
}

function build() {
  const master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  comp.attack.value = 0.01;
  comp.release.value = 0.3;
  master.connect(comp).connect(ctx.destination);

  // a big dark hall for everything to ring out in
  const verb = ctx.createConvolver();
  verb.buffer = impulse(4.5, 2.6);
  const verbOut = ctx.createGain();
  verbOut.gain.value = 0.55;
  verb.connect(verbOut).connect(master);

  // echo for sparkles and sonar
  const echo = ctx.createDelay(2);
  echo.delayTime.value = 0.42;
  const echoFb = ctx.createGain();
  echoFb.gain.value = 0.38;
  const echoTone = ctx.createBiquadFilter();
  echoTone.type = 'lowpass';
  echoTone.frequency.value = 2400;
  echo.connect(echoTone).connect(echoFb).connect(echo);
  echoTone.connect(master);
  echoTone.connect(verb);

  // music runs through one filter that closes as you go deeper
  const music = ctx.createGain();
  music.gain.value = 0;
  const musicTone = ctx.createBiquadFilter();
  musicTone.type = 'lowpass';
  musicTone.frequency.value = 3000;
  musicTone.Q.value = 0.4;
  music.connect(musicTone).connect(master);

  const sfx = ctx.createGain();
  sfx.gain.value = 0.85;
  sfx.connect(master);

  const white = noiseBuffer(2);
  const brown = noiseBuffer(6, true);

  nodes = { master, verb, echo, music, musicTone, sfx, white, brown };
  buildMusic();
}

// connects a sound to the dry bus plus optional reverb / echo sends
function route(node, { dest = nodes.sfx, dry = 1, verb = 0, echo = 0, pan = 0 } = {}) {
  let src = node;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src = node.connect(p);
  }
  const send = (to, amount) => {
    if (!amount) return;
    const g = ctx.createGain();
    g.gain.value = amount;
    src.connect(g).connect(to);
  };
  send(dest, dry);
  send(nodes.verb, verb);
  send(nodes.echo, echo);
}

// one enveloped oscillator: tone({ freq, to, type, a, d, gain, at, ...route })
function tone({ freq, to, type = 'sine', a = 0.005, d = 0.2, gain = 0.1, at = 0, glide, ...r }) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + (glide ?? a + d));
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  o.connect(g);
  route(g, r);
  o.start(t);
  o.stop(t + a + d + 0.05);
  return o;
}

// one enveloped burst of filtered noise
function noise({ filter = 'bandpass', f = 1000, fTo, q = 1, a = 0.005, d = 0.2, gain = 0.1, at = 0, brown, ...r }) {
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource();
  s.buffer = brown ? nodes.brown : nodes.white;
  s.loop = true;
  const bq = ctx.createBiquadFilter();
  bq.type = filter;
  bq.frequency.setValueAtTime(f, t);
  if (fTo) bq.frequency.exponentialRampToValueAtTime(fTo, t + a + d);
  bq.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  s.connect(bq).connect(g);
  route(g, r);
  s.start(t, Math.random() * 1.5);
  s.stop(t + a + d + 0.05);
}

// ───────────── music ─────────────

function lfo(rate, amount, target) {
  const o = ctx.createOscillator();
  o.frequency.value = rate;
  const g = ctx.createGain();
  g.gain.value = amount;
  o.connect(g).connect(target);
  o.start();
}

function buildMusic() {
  const { music, verb } = nodes;

  // the drone: two detuned voices on D, breathing through a slow filter
  const drone = ctx.createGain();
  drone.gain.value = 0.16;
  const droneTone = ctx.createBiquadFilter();
  droneTone.type = 'lowpass';
  droneTone.frequency.value = 220;
  droneTone.Q.value = 3;
  lfo(0.045, 110, droneTone.frequency);
  [
    ['triangle', midi(38), 0.9],
    ['sawtooth', midi(38) * 1.004, 0.35],
    ['sawtooth', midi(45) * 0.997, 0.18]
  ].forEach(([type, f, level]) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(droneTone);
    o.start();
  });
  droneTone.connect(drone).connect(music);

  // sub: only felt down deep
  const sub = ctx.createOscillator();
  sub.frequency.value = midi(26);
  const subGain = ctx.createGain();
  subGain.gain.value = 0;
  sub.connect(subGain).connect(music);
  sub.start();

  // the ocean: brown noise swelling like a slow current
  const sea = ctx.createBufferSource();
  sea.buffer = nodes.brown;
  sea.loop = true;
  const seaTone = ctx.createBiquadFilter();
  seaTone.type = 'lowpass';
  seaTone.frequency.value = 420;
  lfo(0.06, 160, seaTone.frequency);
  const sea1 = ctx.createGain();
  sea1.gain.value = 0.22;
  lfo(0.083, 0.1, sea1.gain);
  sea.connect(seaTone).connect(sea1);
  sea1.connect(music);
  const seaVerb = ctx.createGain();
  seaVerb.gain.value = 0.3;
  sea1.connect(seaVerb).connect(verb);
  sea.start();

  // pads: chords fade in and out on top of each other
  const pads = ctx.createGain();
  pads.gain.value = 0.055;
  pads.connect(music);
  const padVerb = ctx.createGain();
  padVerb.gain.value = 0.9;
  pads.connect(padVerb).connect(verb);

  Object.assign(nodes, { drone, subGain, pads, sea: sea1 });
}

function padChord(notes) {
  const t = ctx.currentTime;
  const hold = CHORD_LEN + 1;
  notes.forEach((m, i) => {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = rand(600, 1100);
    f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(i === 0 ? 0.8 : 0.55, t + 4 + i * 0.4);
    g.gain.setValueAtTime(i === 0 ? 0.8 : 0.55, t + hold);
    g.gain.setTargetAtTime(0, t + hold, 1.6);
    f.connect(g);
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = (i / (notes.length - 1) - 0.5) * 0.8;
      g.connect(p).connect(nodes.pads);
    } else g.connect(nodes.pads);
    [-7, 7].forEach(cents => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(m);
      o.detune.value = cents + rand(-2, 2);
      o.connect(f);
      o.start(t);
      o.stop(t + hold + 9);
    });
  });
}

function sparkle() {
  const m = pick(SPARKLE);
  tone({ freq: midi(m), type: 'sine', a: 0.004, d: rand(1.6, 3), gain: rand(0.02, 0.04), dest: nodes.music, dry: 0.6, verb: 0.7, echo: 0.5, pan: rand(-0.8, 0.8) });
  // a faint octave shimmer on some of them
  if (Math.random() < 0.3) tone({ freq: midi(m + 12), a: 0.004, d: 1.2, gain: 0.008, dest: nodes.music, verb: 0.8, at: 0.02 });
}

function whale() {
  const t = ctx.currentTime;
  const f0 = rand(170, 260);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.linearRampToValueAtTime(f0 * rand(1.3, 1.6), t + 1.6);
  o.frequency.linearRampToValueAtTime(f0 * rand(0.7, 0.85), t + 4.2);
  lfo(4.6, 5, o.frequency);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.04, t + 0.9);
  g.gain.setValueAtTime(0.04, t + 3);
  g.gain.linearRampToValueAtTime(0, t + 4.4);
  o.connect(f).connect(g);
  route(g, { dest: nodes.music, dry: 0.4, verb: 1, pan: rand(-0.6, 0.6) });
  o.start(t);
  o.stop(t + 4.6);
}

function heartbeat() {
  tone({ freq: 62, to: 38, a: 0.01, d: 0.22, gain: 0.5, dest: nodes.music, verb: 0.2 });
  tone({ freq: 58, to: 36, a: 0.01, d: 0.26, gain: 0.34, dest: nodes.music, verb: 0.2, at: 0.27 });
}

// self-rescheduling loops; they skip their turn while sound is off
function loop(fn, delay) {
  const run = () => {
    timers.delete(id);
    if (live()) fn();
    id = setTimeout(run, delay() * 1000);
    timers.add(id);
  };
  let id = setTimeout(run, delay() * 1000);
  timers.add(id);
}

let chord = 0;
function startLoops() {
  loop(() => padChord(CHORDS[chord++ % CHORDS.length]), () => CHORD_LEN);
  loop(() => !deep && Math.random() < 1 - depth * 0.6 && sparkle(), () => rand(2.2, 6.5));
  loop(() => Math.random() < 0.4 + depth * 0.5 && whale(), () => rand(28, 55));
  loop(() => deep && heartbeat(), () => 1.35);
}

// darker + heavier the deeper you scroll; the secret room is darkest
function applyDepth(ramp = 0.6) {
  if (!nodes) return;
  const t = ctx.currentTime;
  const d = deep ? 1 : depth;
  nodes.musicTone.frequency.setTargetAtTime(deep ? 380 : 3000 * 0.22 ** d, t, ramp);
  nodes.drone.gain.setTargetAtTime(0.14 + d * 0.05, t, ramp);
  nodes.subGain.gain.setTargetAtTime(d * d * 0.08, t, ramp);
  nodes.pads.gain.setTargetAtTime(deep ? 0.03 : 0.055, t, ramp);
}

// ───────────── sound effects ─────────────

let lastHover = 0;
let lastType = 0;
let lastWarp = -10;
let lastCreak = 0;

export const sfx = {
  hover() {
    if (!live() || ctx.currentTime - lastHover < 0.05) return;
    lastHover = ctx.currentTime;
    tone({ freq: rand(2300, 2600), a: 0.002, d: 0.05, gain: 0.025, verb: 0.15 });
  },

  select() {
    if (!live()) return;
    tone({ freq: 660, a: 0.003, d: 0.09, gain: 0.06, verb: 0.25 });
    tone({ freq: 990, a: 0.003, d: 0.16, gain: 0.05, verb: 0.35, at: 0.055 });
  },

  // clicking empty space: a few bubbles rising
  bubble() {
    if (!live()) return;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = rand(260, 520);
      tone({ freq: f, to: f * rand(2.2, 3), a: 0.004, d: rand(0.06, 0.12), gain: 0.07, verb: 0.3, at: i * rand(0.04, 0.09), pan: rand(-0.4, 0.4) });
    }
  },

  type() {
    if (!live() || ctx.currentTime - lastType < 0.03) return;
    lastType = ctx.currentTime;
    noise({ filter: 'highpass', f: rand(2500, 4500), a: 0.001, d: 0.025, gain: 0.08 });
    tone({ freq: rand(180, 240), a: 0.001, d: 0.03, gain: 0.04 });
  },

  enter() {
    if (!live()) return;
    tone({ freq: 520, to: 780, a: 0.004, d: 0.14, gain: 0.06, verb: 0.3 });
  },

  error() {
    if (!live()) return;
    tone({ freq: 110, type: 'square', a: 0.004, d: 0.2, gain: 0.025 });
    tone({ freq: 104, type: 'square', a: 0.004, d: 0.2, gain: 0.02, at: 0.01 });
  },

  termOpen() {
    if (!live()) return;
    [62, 69, 74].forEach((m, i) => tone({ freq: midi(m), type: 'triangle', a: 0.003, d: 0.18, gain: 0.05, verb: 0.3, at: i * 0.045 }));
    noise({ filter: 'highpass', f: 3000, a: 0.002, d: 0.08, gain: 0.03 });
  },

  termClose() {
    if (!live()) return;
    [74, 62].forEach((m, i) => tone({ freq: midi(m), type: 'triangle', a: 0.003, d: 0.15, gain: 0.04, verb: 0.3, at: i * 0.06 }));
  },

  toast() {
    if (!live()) return;
    tone({ freq: midi(79), type: 'triangle', a: 0.004, d: 0.18, gain: 0.035, verb: 0.4 });
    tone({ freq: midi(86), type: 'triangle', a: 0.004, d: 0.3, gain: 0.03, verb: 0.5, at: 0.09 });
  },

  // sonar: a clean ping that rings away, and a thump you feel
  ping(strength = 1) {
    if (!live()) return;
    const s = Math.min(2, strength);
    tone({ freq: 1180, a: 0.003, d: 1.6, gain: 0.05 * s, dry: 0.7, verb: 0.9, echo: 0.6 });
    tone({ freq: 90, to: 40, a: 0.005, d: 0.5, gain: 0.25 * s, verb: 0.3 });
  },

  // section headings arriving on screen: a soft distant ping
  reveal() {
    if (!live()) return;
    tone({ freq: pick([880, 988, 1175]), a: 0.004, d: 1.4, gain: 0.018, dry: 0.4, verb: 1, echo: 0.4, pan: rand(-0.5, 0.5) });
  },

  knock() {
    if (!live()) return;
    tone({ freq: rand(150, 190), to: 90, a: 0.002, d: 0.12, gain: 0.3, verb: 0.35 });
    noise({ filter: 'bandpass', f: 900, q: 2, a: 0.001, d: 0.05, gain: 0.12, verb: 0.2 });
  },

  // hyperdrive: 1s spin-up, boom, 2.7s wind-down (matches GalaxyScene.warp)
  warp() {
    if (!live() || ctx.currentTime - lastWarp < 3.6) return;
    lastWarp = ctx.currentTime;
    noise({ f: 180, fTo: 4200, q: 2, a: 0.95, d: 0.08, gain: 0.22, verb: 0.4 });
    tone({ freq: 70, to: 620, type: 'sawtooth', a: 0.95, d: 0.06, gain: 0.04, glide: 1, verb: 0.3 });
    tone({ freq: 110, to: 28, a: 0.01, d: 1.6, gain: 0.55, at: 1, verb: 0.5 });
    noise({ filter: 'lowpass', f: 2600, fTo: 200, a: 0.01, d: 2.4, gain: 0.3, at: 1, verb: 0.8 });
    noise({ f: 3200, fTo: 150, q: 1.5, a: 0.3, d: 2.4, gain: 0.12, at: 1.2, verb: 0.6 });
  },

  // galaxy collapses into a point, then a big bang + shimmer
  rebuild() {
    if (!live()) return;
    tone({ freq: 900, to: 70, a: 0.05, d: 0.55, gain: 0.08, verb: 0.4 });
    noise({ f: 3000, fTo: 200, q: 2, a: 0.4, d: 0.2, gain: 0.12 });
    tone({ freq: 95, to: 30, a: 0.008, d: 1.4, gain: 0.45, at: 0.6, verb: 0.5 });
    noise({ filter: 'lowpass', f: 3000, fTo: 300, a: 0.01, d: 1.6, gain: 0.18, at: 0.6, verb: 0.8 });
    SPARKLE.slice(1).forEach((m, i) =>
      tone({ freq: midi(m), a: 0.003, d: 1.4, gain: 0.025, at: 0.65 + i * 0.07, verb: 0.8, echo: 0.3, pan: rand(-0.7, 0.7) })
    );
  },

  // the abyss stares back: a low dissonant swell
  dread() {
    if (!live()) return;
    [26, 27, 33, 38].forEach((m, i) =>
      tone({ freq: midi(m), type: 'sawtooth', a: 1.1, d: 2.8, gain: 0.05, verb: 0.8, pan: (i - 1.5) * 0.3 })
    );
    noise({ filter: 'lowpass', f: 160, fTo: 600, a: 1.2, d: 2, gain: 0.2, verb: 0.6, brown: true });
  },

  // the floor gives way
  shatter() {
    if (!live()) return;
    tone({ freq: 120, to: 25, a: 0.005, d: 2, gain: 0.6, verb: 0.6 });
    noise({ filter: 'highpass', f: 1400, a: 0.002, d: 0.9, gain: 0.22, verb: 0.7 });
    for (let i = 0; i < 16; i++)
      tone({ freq: rand(2400, 6500), a: 0.001, d: rand(0.15, 0.5), gain: rand(0.01, 0.03), at: rand(0, 0.6), verb: 0.6, pan: rand(-1, 1) });
  },

  // the loader's "entering the abyss": the surface closes over you
  descend() {
    if (!live()) return;
    noise({ filter: 'lowpass', f: 4000, fTo: 120, a: 0.05, d: 1.8, gain: 0.2, verb: 0.7 });
    tone({ freq: 220, to: 55, a: 0.1, d: 1.6, gain: 0.12, verb: 0.6 });
  }
};

// floor pressure (DeepEgg): a hull-groaning rumble that rises with p
function pressure(p) {
  if (!nodes) return;
  if (!rumble && p > 0) {
    const s = ctx.createBufferSource();
    s.buffer = nodes.brown;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    const g = ctx.createGain();
    g.gain.value = 0;
    s.connect(f).connect(g);
    route(g, { verb: 0.4 });
    s.start();
    rumble = { s, f, g };
  }
  if (!rumble) return;
  const t = ctx.currentTime;
  rumble.g.gain.setTargetAtTime(live() ? p * p * 0.9 : 0, t, 0.08);
  rumble.f.frequency.setTargetAtTime(70 + p * 520, t, 0.08);
  if (live() && p > 0.25 && t - lastCreak > 0.18 && Math.random() < p * 0.5) {
    lastCreak = t;
    noise({ f: rand(250, 900), q: 9, a: 0.02, d: rand(0.12, 0.3), gain: 0.12 * p, verb: 0.5 });
  }
}

// ───────────── on / off ─────────────

const notify = () => subs.forEach(fn => fn(on));

function ensure() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC({ latencyHint: 'playback' });
  build();
  startLoops();
}

async function wake() {
  if (!on || document.hidden) return;
  ensure();
  if (!ctx) return;
  // iPhone: play even with the ring/silent switch on (they asked for sound)
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {}
  if (ctx.state !== 'running') {
    try {
      await ctx.resume();
    } catch {}
  }
  if (ctx.state !== 'running' || !on) return;
  const t = ctx.currentTime;
  applyDepth(0.01);
  nodes.master.gain.cancelScheduledValues(t);
  nodes.master.gain.setTargetAtTime(volume, t, 0.15);
  nodes.music.gain.cancelScheduledValues(t);
  nodes.music.gain.setValueAtTime(nodes.music.gain.value, t);
  nodes.music.gain.linearRampToValueAtTime(0.6, t + 3);
  if (nodes.pads && chord === 0) padChord(CHORDS[chord++]);
  notify();
}

function sleep(fade = 0.4) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  nodes.master.gain.cancelScheduledValues(t);
  nodes.master.gain.setTargetAtTime(0, t, fade / 4);
  nodes.music.gain.setTargetAtTime(0, t, fade / 4);
  setTimeout(() => {
    if ((!on || document.hidden) && ctx.state === 'running') ctx.suspend();
  }, fade * 1000 + 50);
}

export function setSound(next) {
  on = Boolean(next);
  writePref(on ? '1' : '0');
  if (on) wake();
  else sleep();
  notify();
}

export const toggleSound = () => setSound(!on);
export const isSoundOn = () => on;
export const hasSoundPref = () => readPref() !== null;

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (live()) nodes.master.gain.setTargetAtTime(volume, ctx.currentTime, 0.1);
}
export const getVolume = () => volume;

export function onSoundChange(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

// ───────────── wiring ─────────────

let teardown = null;

export function initAudio() {
  if (teardown) return teardown;
  on = readPref() === '1';

  const typing = () => /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);

  // browsers only start audio inside a user gesture: retry on each one
  const gesture = () => {
    if (on && ctx?.state !== 'running') wake();
  };

  const onKey = e => {
    gesture();
    if (e.key.toLowerCase() === 'm' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing()) {
      setSound(!on);
      toast(on ? '♪ sound on. press M to mute' : '♪ sound off');
    }
  };

  const fine = window.matchMedia('(pointer: fine)').matches;
  let hot = null;
  const onOver = e => {
    const target = e.target.closest?.('a, button, [role="button"], input, [data-cursor]') ?? null;
    if (target && target !== hot) sfx.hover();
    hot = target;
  };

  const onDown = e => {
    if (e.button > 0) return;
    const el = e.target;
    // these make their own sound (crew → sonar, title → knock, terminal → keys)
    if (el.closest?.('.crew__member, .hero__title, .snd, .term__input')) return;
    if (el.closest?.('a, button, [role="button"], input, label')) sfx.select();
    else if (!el.closest?.('[data-no-pulse], .loader')) sfx.bubble();
  };

  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    depth = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    if (live()) applyDepth();
  };

  const onVisibility = () => (document.hidden ? sleep(0.6) : wake());

  const offs = [
    bus.on('galaxy:warp', () => sfx.warp()),
    bus.on('galaxy:pulse', s => sfx.ping(s)),
    bus.on('galaxy:rebuild', () => sfx.rebuild()),
    bus.on('galaxy:tint', c => c === RED && sfx.dread()),
    bus.on('toast', () => sfx.toast()),
    bus.on('deep:pressure', pressure),
    bus.on('deep:enter', () => {
      deep = true;
      if (live()) applyDepth(1.5);
    }),
    bus.on('deep:exit', () => {
      deep = false;
      if (live()) applyDepth(2);
    })
  ];

  window.addEventListener('keydown', onKey);
  ['pointerdown', 'pointerup', 'touchend', 'click'].forEach(ev => window.addEventListener(ev, gesture, { passive: true }));
  window.addEventListener('pointerdown', onDown, { passive: true });
  if (fine) window.addEventListener('pointerover', onOver, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  onScroll();
  // returning visitors who left sound on: some browsers allow it straight away
  if (on) wake();

  teardown = () => {
    offs.forEach(off => off());
    window.removeEventListener('keydown', onKey);
    ['pointerdown', 'pointerup', 'touchend', 'click'].forEach(ev => window.removeEventListener(ev, gesture));
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerover', onOver);
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibility);
    timers.forEach(clearTimeout);
    timers.clear();
    ctx?.close();
    ctx = nodes = rumble = null;
    chord = 0;
    teardown = null;
  };
  return teardown;
}

// editing this file while the dev server runs must not leave a second
// copy of the music playing underneath the new one
if (import.meta.hot) import.meta.hot.dispose(() => teardown?.());
