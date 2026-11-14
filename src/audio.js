// Música 8-bit e efeitos sonoros gerados pelo próprio jogo (Web Audio). Nenhum arquivo de som.

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let enabled = true;
let noiseBuf = null;

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.6 : 0;
  master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.7; sfxGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setSound(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? 0.6 : 0, ctx.currentTime, 0.05);
}

function tone(freq, t, dur, type = 'square', vol = 0.2, dest = sfxGain, slideTo = null) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(t, dur, vol = 0.2, dest = sfxGain, hp = 800) {
  if (!ctx) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t); s.stop(t + dur + 0.02);
}

// ---------- efeitos ----------
const SFX = {
  soco: (t) => { noise(t, 0.08, 0.35, sfxGain, 300); tone(140, t, 0.08, 'square', 0.15, sfxGain, 60); },
  fogo: (t) => { tone(600, t, 0.15, 'sawtooth', 0.1, sfxGain, 180); noise(t, 0.12, 0.1, sfxGain, 2000); },
  laser: (t) => { tone(1200, t, 0.4, 'square', 0.12, sfxGain, 200); tone(1210, t, 0.4, 'sawtooth', 0.06, sfxGain, 210); },
  carga: (t) => { tone(300, t, 0.3, 'triangle', 0.08, sfxGain, 900); },
  acerto: (t) => { tone(220, t, 0.06, 'square', 0.12, sfxGain, 110); },
  puf: (t) => { noise(t, 0.3, 0.25, sfxGain, 500); tone(400, t, 0.2, 'triangle', 0.1, sfxGain, 80); },
  clang: (t) => { tone(880, t, 0.5, 'square', 0.1); tone(1320, t, 0.4, 'triangle', 0.1); noise(t, 0.15, 0.2, sfxGain, 3000); },
  cristal: (t) => { tone(1568, t, 0.08, 'square', 0.08); tone(2093, t + 0.06, 0.12, 'square', 0.08); },
  coracao: (t) => { [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.07, 0.12, 'triangle', 0.15)); },
  bau: (t) => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.08, 0.18, 'square', 0.1)); },
  dano: (t) => { tone(300, t, 0.25, 'sawtooth', 0.18, sfxGain, 80); },
  fogueira: (t) => { [262, 392, 523, 784].forEach((f, i) => tone(f, t + i * 0.09, 0.3, 'triangle', 0.13)); },
  turbo: (t) => { tone(100, t, 0.3, 'sawtooth', 0.15, sfxGain, 900); noise(t, 0.25, 0.15, sfxGain, 1500); },
  tocha: (t) => { noise(t, 0.4, 0.15, sfxGain, 600); tone(200, t, 0.3, 'triangle', 0.08, sfxGain, 500); },
  quebra: (t) => { noise(t, 0.4, 0.35, sfxGain, 200); tone(90, t, 0.3, 'square', 0.15, sfxGain, 40); },
  pancada: (t) => { noise(t, 0.5, 0.4, sfxGain, 100); tone(60, t, 0.5, 'square', 0.2, sfxGain, 30); },
  rugido: (t) => { tone(110, t, 0.8, 'sawtooth', 0.18, sfxGain, 70); tone(116, t, 0.8, 'square', 0.1, sfxGain, 72); },
  clique: (t) => { tone(880, t, 0.05, 'square', 0.08); },
  boom: (t) => { noise(t, 1.0, 0.6, sfxGain, 60); tone(70, t, 0.9, 'sawtooth', 0.3, sfxGain, 25); tone(140, t, 0.4, 'square', 0.15, sfxGain, 40); },
  superboom: (t) => { noise(t, 2.0, 0.7, sfxGain, 40); tone(50, t, 1.8, 'sawtooth', 0.35, sfxGain, 18); tone(100, t + 0.15, 1.4, 'square', 0.2, sfxGain, 25); noise(t + 0.3, 1.2, 0.4, sfxGain, 200); },
  lancar: (t) => { tone(300, t, 0.25, 'triangle', 0.1, sfxGain, 700); noise(t, 0.2, 0.08, sfxGain, 2500); },
  mira: (t) => { tone(1200, t, 0.03, 'square', 0.04); },
  choque: (t) => { for (let i = 0; i < 5; i++) tone(800 + Math.random() * 1600, t + i * 0.03, 0.05, 'square', 0.06); noise(t, 0.2, 0.15, sfxGain, 3000); },
  trovao: (t) => { noise(t, 0.9, 0.5, sfxGain, 80); tone(90, t, 0.8, 'sawtooth', 0.2, sfxGain, 35); noise(t + 0.05, 0.15, 0.4, sfxGain, 4000); },
  turbinaOn: (t) => { tone(80, t, 0.5, 'sawtooth', 0.2, sfxGain, 400); noise(t, 0.4, 0.2, sfxGain, 1500); },
  turbinaOff: (t) => { tone(400, t, 0.4, 'sawtooth', 0.15, sfxGain, 60); },
  mercador: (t) => { [659, 784, 988, 1319].forEach((f, i) => tone(f, t + i * 0.1, 0.4, 'triangle', 0.1)); },
  compra: (t) => { [523, 784, 1047, 1568].forEach((f, i) => tone(f, t + i * 0.06, 0.15, 'square', 0.09)); },
  porta: (t) => { tone(150, t, 0.6, 'square', 0.12, sfxGain, 300); noise(t, 0.6, 0.12, sfxGain, 400); },
};

export function sfx(name) {
  if (!ctx || !enabled || !SFX[name]) return;
  SFX[name](ctx.currentTime + 0.01);
}

// ---------- música ----------
// Cada tema: bpm, passos de 1/16. lead/bass: número MIDI ou 0 (pausa). drums: k=bumbo s=caixa h=chimbal
const R = 0;
const THEMES = {
  title: {
    bpm: 92,
    lead: [69, R, 72, R, 76, R, 74, 72, 71, R, 72, R, 69, R, R, R, 69, R, 72, R, 77, R, 76, 74, 72, R, 71, R, 69, R, R, R],
    bass: [45, R, R, R, 45, R, R, R, 41, R, R, R, 41, R, R, R, 43, R, R, R, 43, R, R, R, 40, R, R, R, 40, R, R, R],
    drums: 'k...h...s...h...k...h...s...h.h.',
    leadType: 'square',
  },
  castle: {
    bpm: 112,
    lead: [62, R, 65, R, 69, R, 68, R, 69, R, 65, R, 62, R, R, R, 60, R, 64, R, 67, R, 65, 64, 62, R, 61, R, 62, R, R, R,
      62, R, 65, R, 70, R, 69, R, 67, R, 65, R, 64, R, R, R, 62, R, 61, R, 62, R, 64, R, 65, R, 64, R, 61, R, R, R],
    bass: [38, R, 50, R, 38, R, 50, R, 38, R, 50, R, 38, R, 50, R, 36, R, 48, R, 36, R, 48, R, 33, R, 45, R, 33, R, 45, R,
      34, R, 46, R, 34, R, 46, R, 31, R, 43, R, 31, R, 43, R, 33, R, 45, R, 33, R, 45, R, 33, R, 45, R, 33, R, 45, R],
    drums: 'k.h.s.h.k.h.s.hh',
    leadType: 'square',
  },
  boss: {
    bpm: 150,
    lead: [64, 64, R, 67, R, 64, 71, R, 70, R, 67, R, 64, R, 62, R, 64, 64, R, 67, R, 64, 72, R, 71, R, 67, R, 66, R, 63, R],
    bass: [40, R, 40, R, 52, R, 40, R, 40, R, 52, R, 38, R, 50, R, 36, R, 36, R, 48, R, 36, R, 35, R, 47, R, 35, R, 47, R],
    drums: 'k.hsk.hsk.hsk.ss',
    leadType: 'sawtooth',
  },
  victory: {
    bpm: 140, once: true,
    lead: [72, R, 72, R, 72, R, 72, R, 68, R, R, R, 70, R, R, R, 72, R, R, 70, 72, R, R, R, R, R, R, R, R, R, R, R],
    bass: [48, R, R, R, R, R, R, R, 44, R, R, R, 46, R, R, R, 48, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
    drums: 'k...k...k...k...k.......k.......',
    leadType: 'square',
  },
  ending: {
    bpm: 96,
    lead: [72, R, 76, R, 79, R, 76, R, 77, R, 74, R, 72, R, R, R, 69, R, 72, R, 77, R, 76, R, 74, R, 71, R, 72, R, R, R],
    bass: [48, R, 55, R, 48, R, 55, R, 41, R, 48, R, 41, R, 48, R, 45, R, 52, R, 41, R, 48, R, 43, R, 50, R, 48, R, 55, R],
    drums: 'k...h...s...h...',
    leadType: 'triangle',
  },
};

let current = null;
let step = 0;
let nextTime = 0;
let timer = null;

export function playMusic(name) {
  if (!ctx) return;
  if (current === name) return;
  stopMusic();
  const th = THEMES[name];
  if (!th) return;
  current = name;
  step = 0;
  nextTime = ctx.currentTime + 0.05;
  timer = setInterval(() => schedule(th), 25);
}

export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null;
  current = null;
}

function schedule(th) {
  const stepDur = 60 / th.bpm / 4;
  while (nextTime < ctx.currentTime + 0.15) {
    const len = th.lead.length;
    if (th.once && step >= len) { stopMusic(); return; }
    const i = step % len;
    const l = th.lead[i];
    if (l) tone(midi(l), nextTime, stepDur * 1.8, th.leadType, 0.11, musicGain);
    const b = th.bass[i % th.bass.length];
    if (b) tone(midi(b), nextTime, stepDur * 1.6, 'triangle', 0.22, musicGain);
    const d = th.drums[i % th.drums.length];
    if (d === 'k') tone(120, nextTime, 0.12, 'sine', 0.35, musicGain, 40);
    else if (d === 's') noise(nextTime, 0.1, 0.14, musicGain, 1200);
    else if (d === 'h') noise(nextTime, 0.03, 0.05, musicGain, 6000);
    nextTime += stepDur;
    step++;
  }
}

// zumbido contínuo da Turbina de Laser
let hum = null;
export function humStart() {
  if (!ctx || !enabled || hum) return;
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
  o1.type = 'sawtooth'; o1.frequency.value = 110;
  o2.type = 'square'; o2.frequency.value = 113;
  g.gain.value = 0.07;
  o1.connect(g); o2.connect(g); g.connect(sfxGain);
  o1.start(); o2.start();
  hum = { o1, o2, g };
}
export function humStop() {
  if (!hum) return;
  const h = hum; hum = null;
  try { h.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); h.o1.stop(ctx.currentTime + 0.3); h.o2.stop(ctx.currentTime + 0.3); } catch { /* ok */ }
}
