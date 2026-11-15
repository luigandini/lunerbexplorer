// Música 8-bit, efeitos e clima de suspense gerados pelo próprio jogo (Web Audio). Nenhum arquivo de som.

let ctx = null;
let master = null, musicGain = null, sfxGain = null, ambGain = null;
let enabled = true;
let noiseBuf = null;
let wantedMusic = null;   // música pedida antes do som destravar
let wantedAmb = null;

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function create() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return false;
  // iPhone: toca mesmo com a chave do silencioso (Safari 17+)
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* ok */ }
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.8 : 0;
  // compressor: deixa explosões fortes sem estourar
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.3; musicGain.connect(master);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);
  ambGain = ctx.createGain(); ambGain.gain.value = 0.5; ambGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

// Celulares só liberam o som depois de um toque. Tentamos destravar a cada toque até conseguir.
export function initAudio() {
  if (!ctx && !create()) return;
  if (ctx.state !== 'running') {
    ctx.resume().then(afterUnlock).catch(() => {});
    // som mudo de 1 amostra: destrava o iPhone
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    } catch { /* ok */ }
  } else afterUnlock();
}

function afterUnlock() {
  if (wantedMusic && current !== wantedMusic) { const m = wantedMusic; current = null; playMusic(m); }
  if (wantedAmb && ambName !== wantedAmb) { const a = wantedAmb; ambName = null; playAmbience(a); }
}

export function bindUnlock(target = globalThis) {
  const h = () => { if (!ctx || ctx.state !== 'running') initAudio(); };
  for (const ev of ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'click', 'keydown']) target.addEventListener(ev, h, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); });
}

export function audioState() { return ctx ? ctx.state : 'sem-som'; }

export function setSound(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.05);
}

const ready = () => ctx && enabled && ctx.state === 'running';

function tone(freq, t, dur, type = 'square', vol = 0.2, dest = sfxGain, slideTo = null) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}

// ruído filtrado (explosão, fogo, vento, rosnado)
function noise(t, dur, vol = 0.2, dest = sfxGain, freq = 800, type = 'highpass', sweepTo = null, q = 0.7) {
  if (!ctx) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}

// voz de monstro: onda grave com vibrato passando por filtro
function growl(t, dur, base, vol, wobble = 18) {
  const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  const f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 0.75, t + dur);
  lfo.frequency.value = wobble; lg.gain.value = base * 0.18;
  lfo.connect(lg); lg.connect(o.frequency);
  f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(350, t + dur); f.Q.value = 6;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(sfxGain);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  noise(t, dur * 0.8, vol * 0.5, sfxGain, 500, 'bandpass', 250, 3);
}

// ---------- efeitos ----------
const SFX = {
  soco: (t) => { noise(t, 0.09, 0.4, sfxGain, 600, 'lowpass', 150); tone(150, t, 0.09, 'square', 0.18, sfxGain, 55); },
  fogo: (t) => { noise(t, 0.22, 0.25, sfxGain, 3000, 'bandpass', 600, 1.5); tone(520, t, 0.16, 'sawtooth', 0.09, sfxGain, 160); },
  laser: (t) => { tone(1400, t, 0.45, 'square', 0.13, sfxGain, 180); tone(1410, t, 0.45, 'sawtooth', 0.08, sfxGain, 190); noise(t, 0.3, 0.12, sfxGain, 4000); },
  carga: (t) => { tone(250, t, 0.35, 'triangle', 0.1, sfxGain, 1100); },
  acerto: (t) => { tone(240, t, 0.07, 'square', 0.15, sfxGain, 110); noise(t, 0.05, 0.15, sfxGain, 2000); },
  puf: (t) => { noise(t, 0.4, 0.35, sfxGain, 1200, 'lowpass', 200); tone(380, t, 0.25, 'triangle', 0.12, sfxGain, 70); },
  clang: (t) => { tone(880, t, 0.6, 'square', 0.12); tone(1320, t, 0.5, 'triangle', 0.12); tone(1975, t, 0.35, 'sine', 0.08); noise(t, 0.15, 0.25, sfxGain, 4000); },
  cristal: (t) => { tone(1568, t, 0.08, 'square', 0.08); tone(2093, t + 0.06, 0.12, 'square', 0.08); },
  coracao: (t) => { [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.07, 0.14, 'triangle', 0.16)); },
  bau: (t) => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.08, 0.2, 'square', 0.11)); },
  dano: (t) => { tone(320, t, 0.28, 'sawtooth', 0.22, sfxGain, 80); noise(t, 0.12, 0.25, sfxGain, 800, 'lowpass'); },
  fogueira: (t) => { [262, 392, 523, 784].forEach((f, i) => tone(f, t + i * 0.09, 0.35, 'triangle', 0.14)); },
  turbo: (t) => { tone(90, t, 0.35, 'sawtooth', 0.2, sfxGain, 1000); noise(t, 0.3, 0.2, sfxGain, 600, 'bandpass', 5000, 2); },
  tocha: (t) => { noise(t, 0.6, 0.25, sfxGain, 400, 'bandpass', 2500, 1); tone(180, t, 0.3, 'triangle', 0.1, sfxGain, 500); },
  quebra: (t) => { noise(t, 0.6, 0.5, sfxGain, 1500, 'lowpass', 120); tone(85, t, 0.4, 'square', 0.2, sfxGain, 35); for (let i = 0; i < 4; i++) noise(t + 0.08 + i * 0.07, 0.06, 0.2, sfxGain, 2500); },
  pancada: (t) => { noise(t, 0.7, 0.55, sfxGain, 400, 'lowpass', 60); tone(55, t, 0.6, 'sine', 0.4, sfxGain, 28); },
  rugido: (t) => { growl(t, 1.1, 95, 0.32, 14); growl(t + 0.05, 1.0, 140, 0.18, 22); },
  clique: (t) => { tone(880, t, 0.05, 'square', 0.08); },
  porta: (t) => { tone(140, t, 0.7, 'square', 0.12, sfxGain, 280); noise(t, 0.7, 0.15, sfxGain, 300, 'bandpass', 900, 2); },
  boom: (t) => {
    noise(t, 1.6, 0.9, sfxGain, 3000, 'lowpass', 60);
    tone(90, t, 1.2, 'sine', 0.55, sfxGain, 25);
    tone(60, t, 1.4, 'sawtooth', 0.25, sfxGain, 20);
    noise(t + 0.02, 0.25, 0.4, sfxGain, 5000);
    for (let i = 0; i < 5; i++) noise(t + 0.2 + i * 0.13, 0.25, 0.18, sfxGain, 1800, 'bandpass', 700, 2); // estalos de fogo
  },
  superboom: (t) => {
    noise(t, 3, 1, sfxGain, 4000, 'lowpass', 40);
    tone(70, t, 2.6, 'sine', 0.6, sfxGain, 18);
    tone(45, t + 0.1, 2.4, 'sawtooth', 0.3, sfxGain, 15);
    noise(t + 0.4, 1.8, 0.5, sfxGain, 900, 'lowpass', 80);
    for (let i = 0; i < 9; i++) noise(t + 0.3 + i * 0.18, 0.3, 0.2, sfxGain, 2000, 'bandpass', 600, 2);
  },
  lancar: (t) => { noise(t, 0.35, 0.18, sfxGain, 800, 'bandpass', 3000, 2); tone(300, t, 0.25, 'triangle', 0.08, sfxGain, 700); },
  pavio: (t) => { noise(t, 0.12, 0.08, sfxGain, 6000); },
  mira: (t) => { tone(1300, t, 0.03, 'square', 0.05); },
  choque: (t) => { for (let i = 0; i < 6; i++) tone(600 + Math.random() * 2400, t + i * 0.025, 0.05, 'square', 0.07); noise(t, 0.25, 0.22, sfxGain, 3000, 'bandpass', 6000, 3); },
  trovao: (t) => { noise(t, 0.05, 0.6, sfxGain, 6000); noise(t + 0.03, 1.6, 0.7, sfxGain, 1200, 'lowpass', 50); tone(70, t, 1.2, 'sine', 0.35, sfxGain, 30); },
  turbinaOn: (t) => { tone(70, t, 0.6, 'sawtooth', 0.25, sfxGain, 420); noise(t, 0.5, 0.25, sfxGain, 300, 'bandpass', 3000, 2); },
  turbinaOff: (t) => { tone(420, t, 0.5, 'sawtooth', 0.18, sfxGain, 50); },
  mercador: (t) => { [659, 784, 988, 1319, 988].forEach((f, i) => tone(f, t + i * 0.11, 0.45, 'triangle', 0.11)); },
  compra: (t) => { [523, 784, 1047, 1568].forEach((f, i) => tone(f, t + i * 0.06, 0.16, 'square', 0.1)); },
  // vozes dos monstros
  zumbi: (t) => growl(t, 0.7 + Math.random() * 0.4, 70 + Math.random() * 30, 0.2, 9 + Math.random() * 8),
  zumbiBote: (t) => growl(t, 0.45, 120, 0.3, 25),
  aranha: (t) => { noise(t, 0.35, 0.18, sfxGain, 5000, 'highpass'); for (let i = 0; i < 4; i++) noise(t + i * 0.05, 0.03, 0.12, sfxGain, 3500, 'bandpass', 3500, 5); },
  morcego: (t) => { tone(2600, t, 0.12, 'square', 0.06, sfxGain, 1800); tone(3100, t + 0.08, 0.1, 'square', 0.05, sfxGain, 2200); },
  cogumelo: (t) => { noise(t, 0.6, 0.25, sfxGain, 900, 'lowpass', 300); tone(200, t, 0.3, 'sine', 0.1, sfxGain, 90); },
  espinho: (t) => { noise(t, 0.08, 0.2, sfxGain, 4000); tone(900, t, 0.08, 'square', 0.06, sfxGain, 400); },
  arvore: (t) => { growl(t, 1.6, 55, 0.35, 5); noise(t, 1.2, 0.25, sfxGain, 300, 'lowpass', 100); for (let i = 0; i < 6; i++) noise(t + 0.2 + i * 0.15, 0.08, 0.15, sfxGain, 1500, 'bandpass', 800, 3); },
  raizes: (t) => { noise(t, 0.6, 0.3, sfxGain, 300, 'lowpass', 900); for (let i = 0; i < 5; i++) noise(t + i * 0.08, 0.06, 0.15, sfxGain, 1200, 'bandpass', 600, 3); tone(330, t + 0.3, 0.4, 'triangle', 0.1, sfxGain, 660); },
  pulso: (t) => { tone(1300, t, 0.12, 'triangle', 0.1, sfxGain, 600); tone(2600, t, 0.08, 'sine', 0.05, sfxGain, 1300); },
  folha: (t) => { noise(t, 0.12, 0.12, sfxGain, 2500, 'bandpass', 900, 2); tone(700, t, 0.08, 'triangle', 0.06, sfxGain, 1200); },
  amigo: (t) => { [392, 494, 587, 784].forEach((f, i) => tone(f, t + i * 0.08, 0.2, 'triangle', 0.13)); },
  // Mundo 3: pântano e canos
  sapo: (t) => { tone(140, t, 0.18, 'square', 0.16, sfxGain, 90); tone(150, t + 0.22, 0.22, 'square', 0.16, sfxGain, 85); },
  sapoRei: (t) => { growl(t, 0.9, 60, 0.35, 7); tone(90, t, 0.5, 'square', 0.18, sfxGain, 50); tone(95, t + 0.55, 0.6, 'square', 0.18, sfxGain, 45); },
  bolha: (t) => { tone(260 + Math.random() * 120, t, 0.12, 'sine', 0.14, sfxGain, 700); },
  onda: (t) => { noise(t, 1.0, 0.45, sfxGain, 700, 'lowpass', 120); tone(70, t, 0.8, 'sine', 0.3, sfxGain, 35); },
  ponte: (t) => { tone(160, t, 0.35, 'sawtooth', 0.07, sfxGain, 90); noise(t + 0.2, 0.5, 0.25, sfxGain, 900, 'lowpass', 200); },
  gas: (t) => { noise(t, 0.6, 0.12, sfxGain, 3000, 'bandpass', 1500, 2); },
  gelo: (t) => { for (let i = 0; i < 7; i++) tone(1800 + Math.random() * 2200, t + i * 0.03, 0.12, 'sine', 0.07); noise(t, 0.5, 0.2, sfxGain, 5000, 'highpass'); tone(600, t, 0.6, 'triangle', 0.1, sfxGain, 1500); },
  hidra: (t) => { growl(t, 1.2, 80, 0.3, 11); growl(t + 0.15, 1.0, 120, 0.2, 16); noise(t, 0.9, 0.2, sfxGain, 600, 'lowpass', 150); },
  cano: (t) => { tone(400, t, 0.3, 'square', 0.08, sfxGain, 380); noise(t, 0.5, 0.2, sfxGain, 2500, 'bandpass', 1200, 3); },
  // Mundo 4: torre
  robo: (t) => { tone(880, t, 0.06, 'square', 0.06); tone(660, t + 0.08, 0.06, 'square', 0.06); tone(990, t + 0.16, 0.08, 'square', 0.05); },
  desliga: (t) => { tone(700, t, 0.5, 'square', 0.1, sfxGain, 60); noise(t, 0.3, 0.15, sfxGain, 3000, 'bandpass', 800, 3); },
  frasco: (t) => { tone(1200 + Math.random() * 400, t, 0.08, 'sine', 0.07, sfxGain, 1800); },
  vidro: (t) => { for (let i = 0; i < 6; i++) tone(2400 + Math.random() * 2400, t + i * 0.02, 0.1, 'triangle', 0.06); noise(t, 0.3, 0.25, sfxGain, 4000, 'highpass'); },
  golem: (t) => { growl(t, 1.0, 70, 0.3, 30); for (let i = 0; i < 3; i++) noise(t + i * 0.12, 0.08, 0.2, sfxGain, 2000, 'bandpass', 1200, 4); tone(110, t, 0.8, 'square', 0.1, sfxGain, 55); },
  vapor: (t) => { noise(t, 0.9, 0.3, sfxGain, 4000, 'highpass', 1500); },
  morgrave: (t) => { [520, 470, 420, 380, 340].forEach((f, i) => tone(f, t + i * 0.12, 0.11, 'sawtooth', 0.09, sfxGain, f * 0.9)); },
  teleporte: (t) => { tone(300, t, 0.3, 'sine', 0.12, sfxGain, 1600); noise(t, 0.3, 0.12, sfxGain, 2000, 'bandpass', 6000, 2); },
  golpe: (t) => { [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, t + i * 0.05, 1.6, 'triangle', 0.1)); noise(t, 1.5, 0.3, sfxGain, 6000, 'lowpass', 300); tone(65, t, 1.8, 'sine', 0.4, sfxGain, 40); },
  purifica: (t) => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, t + i * 0.1, 0.8, 'sine', 0.09)); },
  susto: (t) => { tone(1800, t, 0.5, 'sine', 0.05, sfxGain, 1700); tone(1907, t, 0.5, 'sine', 0.05, sfxGain, 1800); },
};

export function sfx(name) {
  if (!ready() || !SFX[name]) return;
  SFX[name](ctx.currentTime + 0.01);
}

// ---------- clima de suspense (fundo) ----------
let ambName = null, ambNodes = [], ambTimer = null;
const AMBIENCE = {
  castle: { drone: [55, 82.4], wind: 300, events: ['gota', 'rangido', 'sussurro'] },
  forest: { drone: [65.4, 98], wind: 700, events: ['grilo', 'coruja', 'galho'] },
  forestNight: { drone: [49, 73.4], wind: 500, events: ['grilo', 'coruja', 'galho', 'sussurro'] },
  swamp: { drone: [46.2, 69.3], wind: 420, events: ['coaxo', 'borbulha', 'mosquito', 'sussurro'] },
  pipes: { drone: [41.2, 61.7], wind: 260, events: ['gota', 'cano', 'borbulha', 'rangido'] },
  tower: { drone: [43.7, 65.4], wind: 350, events: ['tique', 'borbulha', 'rangido', 'sussurro'] },
};
const AMB_EVENTS = {
  gota: (t) => { tone(1800 + Math.random() * 600, t, 0.15, 'sine', 0.08, ambGain, 900); },
  rangido: (t) => { tone(120 + Math.random() * 60, t, 1.2, 'sawtooth', 0.04, ambGain, 90); },
  sussurro: (t) => { noise(t, 1.5, 0.08, ambGain, 1500, 'bandpass', 2600, 6); },
  grilo: (t) => { for (let i = 0; i < 6; i++) tone(4200, t + i * 0.06, 0.03, 'square', 0.025, ambGain); },
  coruja: (t) => { tone(420, t, 0.35, 'sine', 0.07, ambGain, 380); tone(400, t + 0.45, 0.5, 'sine', 0.07, ambGain, 350); },
  galho: (t) => { noise(t, 0.1, 0.12, ambGain, 1800, 'bandpass', 900, 3); },
  tique: (t) => { for (let i = 0; i < 4; i++) tone(1500, t + i * 0.25, 0.03, 'square', 0.02, ambGain); },
  coaxo: (t) => { tone(120, t, 0.15, 'square', 0.05, ambGain, 90); tone(125, t + 0.2, 0.15, 'square', 0.05, ambGain, 90); },
  borbulha: (t) => { for (let i = 0; i < 4; i++) tone(200 + Math.random() * 200, t + i * 0.09, 0.1, 'sine', 0.06, ambGain, 600); },
  mosquito: (t) => { tone(880, t, 0.8, 'sawtooth', 0.012, ambGain, 920); },
  cano: (t) => { tone(300, t, 1.0, 'triangle', 0.04, ambGain, 290); noise(t, 0.6, 0.05, ambGain, 1500, 'bandpass', 800, 4); },
};

export function playAmbience(name) {
  wantedAmb = name;
  if (!ctx || ctx.state !== 'running') return;
  if (ambName === name) return;
  stopAmbience(true);
  const a = AMBIENCE[name];
  if (!a) return;
  ambName = name;
  const t = ctx.currentTime;
  for (const f of a.drone) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 2);
    o.connect(g); g.connect(ambGain); o.start();
    ambNodes.push(o, g);
  }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = a.wind;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 2);
  s.connect(f); f.connect(g); g.connect(ambGain); s.start();
  ambNodes.push(s, f, g);
  ambTimer = setInterval(() => {
    if (!ready()) return;
    if (Math.random() < 0.35) AMB_EVENTS[a.events[Math.floor(Math.random() * a.events.length)]](ctx.currentTime + 0.05);
  }, 1500);
}

export function stopAmbience(keepWanted = false) {
  if (!keepWanted) wantedAmb = null;
  if (ambTimer) clearInterval(ambTimer);
  ambTimer = null;
  for (const n of ambNodes) { try { if (n.stop) n.stop(); n.disconnect(); } catch { /* ok */ } }
  ambNodes = [];
  ambName = null;
}

// ---------- música ----------
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
  forest: {
    bpm: 100,
    lead: [64, R, R, 67, R, 69, R, R, 71, R, 69, R, 67, R, 64, R, 62, R, R, 64, R, 67, R, R, 66, R, 64, R, 62, R, R, R,
      64, R, R, 67, R, 72, R, R, 71, R, 69, R, 71, R, 67, R, 66, R, 64, R, 62, R, 59, R, 64, R, R, R, R, R, R, R],
    bass: [40, R, R, R, 47, R, R, R, 36, R, R, R, 43, R, R, R, 38, R, R, R, 45, R, R, R, 35, R, R, R, 42, R, R, R],
    drums: 'k...h.h.s...h...',
    leadType: 'triangle',
  },
  swamp: {
    bpm: 96,
    lead: [62, R, R, 65, R, 63, R, 62, R, R, 60, R, 58, R, R, R, 62, R, R, 65, R, 67, R, 68, R, 67, R, 65, R, R, R, R,
      70, R, R, 68, R, 67, R, 65, R, 63, R, 62, R, R, R, R, 60, R, 62, R, 63, R, 62, R, 58, R, 57, R, 62, R, R, R],
    bass: [38, R, R, 38, R, R, 45, R, 36, R, R, 36, R, R, 43, R, 34, R, R, 34, R, R, 41, R, 33, R, R, 33, R, 45, R, R],
    drums: 'k..h..s.k.hh..s.',
    leadType: 'triangle',
  },
  pipes: {
    bpm: 118,
    lead: [57, R, 60, 57, R, 63, R, 62, 60, R, 57, R, 55, R, 57, R, 57, R, 60, 57, R, 64, R, 63, 62, R, 60, R, 62, R, R, R,
      69, R, 67, R, 65, R, 63, R, 62, R, 63, R, 65, R, 62, R, 57, R, 60, R, 63, R, 62, R, 60, R, 58, R, 57, R, R, R],
    bass: [33, R, 45, R, 33, R, 45, R, 31, R, 43, R, 31, R, 43, R, 29, R, 41, R, 29, R, 41, R, 28, R, 40, R, 32, R, 44, R],
    drums: 'k.hsk.h.k.hsk.hs',
    leadType: 'square',
  },
  tower: {
    bpm: 108,
    lead: [64, R, 67, R, 71, R, 70, R, 67, R, 64, R, 63, R, R, R, 64, R, 67, R, 72, R, 71, R, 69, R, 67, R, 66, R, R, R,
      76, R, 74, R, 72, R, 71, R, 69, R, 71, R, 72, R, R, R, 71, R, 69, R, 67, R, 66, R, 64, R, 63, R, 64, R, R, R],
    bass: [40, R, 47, R, 40, R, 47, R, 36, R, 43, R, 36, R, 43, R, 38, R, 45, R, 38, R, 45, R, 35, R, 42, R, 35, R, 39, R],
    drums: 'k.h.s.hhk.h.s.h.',
    leadType: 'square',
  },
  final: {
    bpm: 160,
    lead: [64, 67, 71, R, 76, R, 75, 71, 72, R, 71, 69, 67, R, 64, R, 64, 67, 71, R, 79, R, 78, 76, 74, R, 72, 71, 69, R, 67, R],
    bass: [40, R, 52, R, 40, R, 52, R, 36, R, 48, R, 36, R, 48, R, 38, R, 50, R, 38, R, 50, R, 35, R, 47, R, 35, R, 47, R],
    drums: 'k.hsk.hsk.hsk.ss',
    leadType: 'sawtooth',
  },
  chase: {
    bpm: 160,
    lead: [69, 72, 69, R, 76, R, 74, 72, 71, 72, 71, R, 67, R, 69, R, 69, 72, 69, R, 77, R, 76, 74, 72, 74, 72, R, 71, R, 68, R],
    bass: [45, R, 45, R, 45, R, 45, R, 43, R, 43, R, 43, R, 43, R, 41, R, 41, R, 41, R, 41, R, 40, R, 40, R, 40, R, 44, R],
    drums: 'k.hsk.hskkhsk.ss',
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
  wantedMusic = name;
  if (!ctx || ctx.state !== 'running') return; // toca assim que o som destravar
  if (current === name) return;
  stopMusic(true);
  const th = THEMES[name];
  if (!th) return;
  current = name;
  step = 0;
  nextTime = ctx.currentTime + 0.05;
  timer = setInterval(() => schedule(th), 25);
}

export function stopMusic(keepWanted = false) {
  if (!keepWanted) wantedMusic = null;
  if (timer) clearInterval(timer);
  timer = null;
  current = null;
}

function schedule(th) {
  if (!ctx || ctx.state !== 'running') return;
  const stepDur = 60 / th.bpm / 4;
  if (nextTime < ctx.currentTime - 0.5) nextTime = ctx.currentTime + 0.02; // voltou da pausa
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
  if (!ready() || hum) return;
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
  o1.type = 'sawtooth'; o1.frequency.value = 110;
  o2.type = 'square'; o2.frequency.value = 113;
  g.gain.value = 0.08;
  o1.connect(g); o2.connect(g); g.connect(sfxGain);
  o1.start(); o2.start();
  hum = { o1, o2, g };
}
export function humStop() {
  if (!hum) return;
  const h = hum; hum = null;
  try { h.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); h.o1.stop(ctx.currentTime + 0.3); h.o2.stop(ctx.currentTime + 0.3); } catch { /* ok */ }
}
