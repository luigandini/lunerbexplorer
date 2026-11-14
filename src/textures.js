// Texturas desenhadas pelo próprio jogo (sem arquivos de imagem): pedra, grama, terra, madeira, fundo.
import * as THREE from '../vendor/three.module.min.js';

const cache = new Map();

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function toTex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

function noise(ctx, size, r, amount, alpha = 0.08) {
  for (let i = 0; i < amount; i++) {
    const v = r() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    const s = 1 + r() * 3;
    ctx.fillRect(r() * size, r() * size, s, s);
  }
}

function rr(ctx, x, y, w, h, rad) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// Chão de pedras arredondadas (calçamento do castelo)
function cobble(base = [118, 112, 118], gap = '#16131a', seed = 3) {
  const S = 256, [c, ctx] = canvas(S), r = rng(seed);
  ctx.fillStyle = gap; ctx.fillRect(0, 0, S, S);
  const cell = 32;
  for (let y = 0; y < S / cell; y++) {
    for (let x = 0; x < S / cell; x++) {
      const off = (y % 2) * cell / 2;
      const w = cell - 4 - r() * 4, h = cell - 4 - r() * 4;
      const k = 0.8 + r() * 0.35;
      const col = base.map((v) => Math.floor(v * k));
      for (const dx of [-S, 0, S]) {
        ctx.fillStyle = `rgb(${col.join(',')})`;
        rr(ctx, x * cell + off + 2 + dx, y * cell + 2, w, h, 9);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        rr(ctx, x * cell + off + 5 + dx, y * cell + 4, w * 0.6, h * 0.35, 6);
        ctx.fill();
      }
    }
  }
  noise(ctx, S, r, 2500);
  return toTex(c);
}

// Grama com folhinhas e florzinhas
function grass(seed = 5, base = '#4f7d33') {
  const S = 256, [c, ctx] = canvas(S), r = rng(seed);
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    const g = 90 + Math.floor(r() * 80);
    ctx.strokeStyle = `rgba(${40 + r() * 40},${g + 40},${30 + r() * 30},0.7)`;
    ctx.lineWidth = 1 + r() * 1.5;
    const x = r() * S, y = r() * S;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 6, y - 4 - r() * 6); ctx.stroke();
  }
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = ['#e85a5a', '#f2d24a', '#ffffff', '#b98cff'][Math.floor(r() * 4)];
    ctx.beginPath(); ctx.arc(r() * S, r() * S, 2 + r() * 1.5, 0, 7); ctx.fill();
  }
  noise(ctx, S, r, 1500, 0.06);
  return toTex(c);
}

// Terra / trilha
function dirt(seed = 9) {
  const S = 256, [c, ctx] = canvas(S), r = rng(seed);
  ctx.fillStyle = '#6b5236'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(${60 + r() * 50},${45 + r() * 35},${30 + r() * 20},0.6)`;
    ctx.beginPath(); ctx.ellipse(r() * S, r() * S, 3 + r() * 9, 2 + r() * 6, r() * 3, 0, 7); ctx.fill();
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(150,140,130,${0.4 + r() * 0.4})`;
    ctx.beginPath(); ctx.arc(r() * S, r() * S, 1.5 + r() * 3, 0, 7); ctx.fill();
  }
  noise(ctx, S, r, 2000);
  return toTex(c);
}

// Blocos de pedra das paredes e das bordas da ilha
function stoneBlocks(seed = 11, base = [128, 122, 128]) {
  const S = 256, [c, ctx] = canvas(S), r = rng(seed);
  ctx.fillStyle = '#1a171c'; ctx.fillRect(0, 0, S, S);
  const rows = 4;
  const rh = S / rows;
  for (let y = 0; y < rows; y++) {
    let x = -(y % 2) * 40;
    while (x < S) {
      const w = 50 + r() * 40;
      const k = 0.75 + r() * 0.4;
      const col = base.map((v) => Math.floor(v * k));
      ctx.fillStyle = `rgb(${col.join(',')})`;
      rr(ctx, x + 3, y * rh + 3, w - 6, rh - 6, 12);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      rr(ctx, x + 7, y * rh + 6, (w - 6) * 0.7, (rh - 6) * 0.3, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      rr(ctx, x + 6, y * rh + rh * 0.65, w - 12, rh * 0.25, 8);
      ctx.fill();
      x += w;
    }
  }
  noise(ctx, S, r, 3000);
  return toTex(c);
}

// Tábuas de madeira
function wood(seed = 13) {
  const S = 128, [c, ctx] = canvas(S), r = rng(seed);
  for (let i = 0; i < 4; i++) {
    const k = 0.85 + r() * 0.3;
    ctx.fillStyle = `rgb(${Math.floor(122 * k)},${Math.floor(80 * k)},${Math.floor(44 * k)})`;
    ctx.fillRect(0, i * 32, S, 31);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, i * 32 + 30, S, 2);
    for (let j = 0; j < 8; j++) {
      ctx.strokeStyle = 'rgba(60,35,15,0.35)';
      ctx.beginPath(); const y = i * 32 + 4 + r() * 24; ctx.moveTo(0, y); ctx.bezierCurveTo(40, y + 3, 80, y - 3, S, y + 1); ctx.stroke();
    }
  }
  return toTex(c);
}

// Fundo infinito escuro (degradê com estrelinhas)
function background(top = '#1d2a36', bottom = '#06080d') {
  const [c, ctx] = canvas(512);
  const g = ctx.createRadialGradient(256, 200, 40, 256, 256, 380);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
  const r = rng(21);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.5})`;
    ctx.fillRect(r() * 512, r() * 512, 1.5, 1.5);
  }
  return toTex(c, false);
}

const MAKERS = {
  cobble: () => cobble(),
  cobbleMoss: () => cobble([92, 116, 80], '#141c10', 4),
  grass: () => grass(),
  grassDark: () => grass(7, '#3d6428'),
  dirt: () => dirt(),
  stone: () => stoneBlocks(),
  stoneDark: () => stoneBlocks(12, [84, 80, 86]),
  wood: () => wood(),
  bgForest: () => background('#1f3a3a', '#05090b'),
  bgCastle: () => background('#2a2238', '#060509'),
  bgMenu: () => background('#2a2f45', '#07060b'),
};

export function tex(name) {
  if (!cache.has(name)) cache.set(name, MAKERS[name]());
  return cache.get(name);
}
