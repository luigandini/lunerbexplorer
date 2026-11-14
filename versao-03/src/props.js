// Peças do cenário no estilo maquete: árvores, pedras, arbustos, tochas, fogueira, baús, portais.
import * as THREE from '../vendor/three.module.min.js';
import { roundedBox as rb, sphere, cylinder, cone, ico, part, pivot, bake, material } from './geo.js';

// Copia as peças de um grupo temporário para dentro do grupo do cenário (para juntar tudo numa malha só)
const tmpM = new THREE.Matrix4();
export function flattenInto(target, temp) {
  temp.updateMatrixWorld(true);
  temp.traverse((o) => {
    if (!o.isMesh) return;
    const m = new THREE.Mesh(o.geometry, o.material);
    tmpM.copy(o.matrixWorld);
    tmpM.decompose(m.position, m.quaternion, m.scale);
    target.add(m);
  });
}

function place(target, build, x, z, rot = 0, s = 1) {
  const t = new THREE.Group();
  build(t);
  t.position.set(x, 0, z);
  t.rotation.y = rot;
  t.scale.setScalar(s);
  flattenInto(target, t);
}

const LEAF = [0x3f7d2a, 0x4a8f30, 0x386f25, 0x55a034];

export function tree(target, x, z, r) {
  const kind = r() < 0.35 ? 'pine' : 'round';
  place(target, (g) => {
    part(g, cylinder(0.09, 0.15, 0.9, 8), 0x6a4a2c, 'lit', 0, 0.45, 0);
    part(g, cylinder(0.05, 0.08, 0.3, 6), 0x5a3d22, 'lit', 0.12, 0.08, 0.02, 0, 0, -1.1);
    part(g, cylinder(0.05, 0.08, 0.3, 6), 0x5a3d22, 'lit', -0.1, 0.08, -0.06, 0, 0, 1.0);
    if (kind === 'pine') {
      part(g, cone(0.55, 0.8, 8), 0x2f6a2c, 'lit', 0, 1.0, 0);
      part(g, cone(0.44, 0.7, 8), 0x37772f, 'lit', 0, 1.4, 0);
      part(g, cone(0.3, 0.55, 8), 0x3f8434, 'lit', 0, 1.78, 0);
    } else {
      const c = () => LEAF[Math.floor(r() * LEAF.length)];
      part(g, ico(0.5, 1), c(), 'lit', 0, 1.2, 0);
      part(g, ico(0.36, 1), c(), 'lit', 0.3, 1.0, 0.12);
      part(g, ico(0.34, 1), c(), 'lit', -0.26, 1.05, -0.1);
      part(g, ico(0.3, 1), c(), 'lit', 0.05, 1.55, 0.05);
    }
  }, x, z, r() * 6, 0.85 + r() * 0.3);
}

export function rock(target, x, z, r, mossy = true) {
  place(target, (g) => {
    part(g, new THREE.DodecahedronGeometry(0.36, 0), 0x7c7a80, 'lit', 0, 0.22, 0, r(), r(), 0, 1.15, 0.75, 1);
    part(g, new THREE.DodecahedronGeometry(0.2, 0), 0x6a686e, 'lit', 0.26, 0.12, 0.12, r(), r(), 0);
    if (mossy) part(g, sphere(0.28, 8, 6), 0x4f8a2e, 'lit', -0.02, 0.43, 0, 0, 0, 0, 1.2, 0.3, 1);
  }, x, z, r() * 6, 0.9 + r() * 0.3);
}

export function bush(target, x, z, r) {
  place(target, (g) => {
    const c = () => LEAF[Math.floor(r() * LEAF.length)];
    part(g, sphere(0.32, 10, 8), c(), 'lit', 0, 0.28, 0);
    part(g, sphere(0.24, 10, 8), c(), 'lit', 0.25, 0.2, 0.08);
    part(g, sphere(0.22, 10, 8), c(), 'lit', -0.22, 0.2, -0.05);
    if (r() < 0.5) for (let i = 0; i < 3; i++) part(g, sphere(0.035, 6, 4), [0xe85a5a, 0xf2d24a, 0xffffff][i], 'lit', (r() - 0.5) * 0.4, 0.4 + r() * 0.15, 0.2 + r() * 0.1);
  }, x, z, r() * 6, 0.9 + r() * 0.3);
}

export function grassTuft(target, x, z, r) {
  place(target, (g) => {
    for (let i = 0; i < 4; i++) part(g, cone(0.03, 0.22 + r() * 0.12, 4), 0x5c9a36, 'lit', (r() - 0.5) * 0.18, 0.1, (r() - 0.5) * 0.18, (r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4);
  }, x, z, r() * 6);
}

export function flowers(target, x, z, r) {
  place(target, (g) => {
    for (let i = 0; i < 4; i++) {
      const fx = (r() - 0.5) * 0.5, fz = (r() - 0.5) * 0.5;
      part(g, cylinder(0.008, 0.008, 0.14, 4), 0x3f7d2a, 'lit', fx, 0.07, fz);
      part(g, sphere(0.04, 6, 4), [0xe85a5a, 0xf2d24a, 0xffffff, 0xb98cff, 0xff8a3a][Math.floor(r() * 5)], 'lit', fx, 0.15, fz);
    }
  }, x, z, 0);
}

export function pebbles(target, x, z, r) {
  place(target, (g) => {
    for (let i = 0; i < 3; i++) part(g, new THREE.DodecahedronGeometry(0.06 + r() * 0.05, 0), 0x86848a, 'lit', (r() - 0.5) * 0.6, 0.03, (r() - 0.5) * 0.6, r(), r(), 0);
  }, x, z, 0);
}

export function mushroom(target, x, z, r) {
  place(target, (g) => {
    part(g, cylinder(0.03, 0.04, 0.18, 6), 0xe8dcc0, 'lit', 0, 0.09, 0);
    part(g, sphere(0.09, 10, 6), 0xff7a3a, 'glow', 0, 0.19, 0, 0, 0, 0, 1, 0.55, 1);
  }, x, z, 0, 0.8 + r() * 0.6);
}

export function bones(target, x, z, r) {
  place(target, (g) => {
    part(g, cylinder(0.02, 0.02, 0.3, 5), 0xd9d2c0, 'lit', 0, 0.03, 0, 0, 0, Math.PI / 2);
    part(g, sphere(0.035, 6, 4), 0xd9d2c0, 'lit', 0.15, 0.03, 0);
    part(g, sphere(0.035, 6, 4), 0xd9d2c0, 'lit', -0.15, 0.03, 0);
    part(g, sphere(0.08, 8, 6), 0xd9d2c0, 'lit', 0.12, 0.07, 0.15);
  }, x, z, r() * 6);
}

export function barrel(target, x, z, r) {
  place(target, (g) => {
    part(g, cylinder(0.2, 0.2, 0.45, 10), 0x7a5230, 'lit', 0, 0.23, 0);
    part(g, cylinder(0.205, 0.205, 0.04, 10), 0x55585e, 'metal', 0, 0.1, 0);
    part(g, cylinder(0.205, 0.205, 0.04, 10), 0x55585e, 'metal', 0, 0.36, 0);
  }, x, z, r() * 6);
}

// ---------- peças com partes que mudam (não são juntadas com o cenário) ----------
export function torch() {
  const g = new THREE.Group();
  part(g, cylinder(0.06, 0.08, 1.0, 8), 0x4a3424, 'lit', 0, 0.5, 0);
  part(g, cylinder(0.16, 0.1, 0.12, 8), 0x55585e, 'metal', 0, 1.04, 0);
  const flame = new THREE.Group();
  part(flame, cone(0.12, 0.3, 7), 0xff7a1a, 'glow', 0, 1.24, 0);
  part(flame, cone(0.07, 0.22, 7), 0xffd23a, 'glow', 0, 1.24, 0);
  g.add(flame);
  part(g, cylinder(0.11, 0.11, 0.03, 8), 0x5a2a10, 'lit', 0, 1.1, 0);
  // tocha apagada: carvão com brasinha (mostra que dá para acender)
  const ember = new THREE.Group();
  for (let i = 0; i < 4; i++) part(ember, new THREE.DodecahedronGeometry(0.045, 0), 0x2a2220, 'lit', Math.cos(i * 1.6) * 0.06, 1.13, Math.sin(i * 1.6) * 0.06, i, i, 0);
  part(ember, sphere(0.03, 6, 4), 0xff5a10, 'glow', 0, 1.14, 0);
  g.add(ember);
  bake(g);
  return { group: g, flame, ember };
}

export function campfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    part(g, new THREE.DodecahedronGeometry(0.1, 0), 0x77757c, 'lit', Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3, i, i * 2, 0);
  }
  part(g, cylinder(0.04, 0.04, 0.45, 6), 0x5a3d22, 'lit', 0, 0.08, 0, 0, 0.5, Math.PI / 2);
  part(g, cylinder(0.04, 0.04, 0.45, 6), 0x5a3d22, 'lit', 0, 0.1, 0, 0, -0.7, Math.PI / 2);
  const flame = new THREE.Group();
  part(flame, cone(0.17, 0.42, 7), 0x2a8cff, 'glow', 0, 0.32, 0);
  part(flame, cone(0.1, 0.32, 7), 0xbfeaff, 'glow', 0, 0.3, 0);
  g.add(flame);
  flame.visible = false;
  const smoke = new THREE.Group();
  part(smoke, sphere(0.08, 6, 4), 0x777777, 'lit', 0, 0.3, 0);
  g.add(smoke);
  bake(g);
  return { group: g, flame, smoke };
}

export function chest(kind) {
  const g = new THREE.Group();
  const wood = kind === 'secreto' ? 0x4b2a6b : 0x8a5428;
  const trim = kind === 'arma' ? 0xd62a2a : kind === 'secreto' ? 0xc58cff : kind === 'arma-nova' ? 0x2ec8ff : 0xd8a838;
  part(g, rb(0.62, 0.36, 0.42, 0.05), wood, 'lit', 0, 0.18, 0);
  part(g, rb(0.64, 0.05, 0.44, 0.02), trim, 'metal', 0, 0.32, 0);
  part(g, rb(0.05, 0.37, 0.44, 0.02), trim, 'metal', -0.24, 0.185, 0);
  part(g, rb(0.05, 0.37, 0.44, 0.02), trim, 'metal', 0.24, 0.185, 0);
  const lid = pivot(g, 0, 0.36, -0.21);
  part(lid, rb(0.62, 0.16, 0.42, 0.07), wood, 'lit', 0, 0.06, 0.21);
  part(lid, rb(0.05, 0.17, 0.44, 0.02), trim, 'metal', -0.24, 0.06, 0.21);
  part(lid, rb(0.05, 0.17, 0.44, 0.02), trim, 'metal', 0.24, 0.06, 0.21);
  part(lid, rb(0.1, 0.1, 0.04, 0.02), kind === 'cristais' ? 0xd8a838 : trim, kind === 'cristais' ? 'metal' : 'glow', 0, 0.02, 0.44);
  bake(g);
  return { group: g, lid };
}

// Portal entre salas (X) e saída da fase (E)
export function portal(final = false, back = false) {
  const g = new THREE.Group();
  const stone = 0x77737c;
  part(g, rb(0.26, 1.5, 0.3, 0.06), stone, 'lit', -0.5, 0.75, 0);
  part(g, rb(0.26, 1.5, 0.3, 0.06), stone, 'lit', 0.5, 0.75, 0);
  part(g, rb(1.3, 0.28, 0.34, 0.08), stone, 'lit', 0, 1.6, 0);
  part(g, rb(0.3, 0.3, 0.36, 0.08), 0x8a868f, 'lit', 0, 1.82, 0);
  part(g, sphere(0.12, 8, 6), 0x4f8a2e, 'lit', -0.5, 1.5, 0.05, 0, 0, 0, 1.6, 0.5, 1.6);
  const glowMat = new THREE.MeshBasicMaterial({ color: back ? 0xffb347 : final ? 0x7dff9a : 0x5ad8ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 1.42), glowMat);
  glow.position.set(0, 0.73, 0);
  g.add(glow);
  const bars = new THREE.Group();
  for (let i = -2; i <= 2; i++) part(bars, rb(0.05, 1.42, 0.05, 0.02), 0x3a3f46, 'metal', i * 0.16, 0.73, 0.04);
  part(bars, rb(0.8, 0.06, 0.06, 0.02), 0x3a3f46, 'metal', 0, 1.0, 0.04);
  g.add(bars);
  bars.visible = false;
  bake(g);
  return { group: g, glow, bars };
}

// Mercador misterioso: capa escura, lanterna e olhos que brilham
export function merchant() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  part(body, cone(0.42, 1.0, 8), 0x3a2350, 'lit', 0, 0.5, 0);
  part(body, cone(0.44, 0.12, 8), 0x2a1838, 'lit', 0, 0.06, 0);
  part(body, sphere(0.24, 12, 10), 0x2e1c40, 'lit', 0, 1.08, 0);
  part(body, sphere(0.19, 12, 10), 0x0d0a12, 'lit', 0, 1.06, 0.07);
  part(body, sphere(0.035, 6, 4), 0xffd23a, 'glow', -0.07, 1.08, 0.24);
  part(body, sphere(0.035, 6, 4), 0xffd23a, 'glow', 0.07, 1.08, 0.24);
  part(body, cone(0.12, 0.28, 6), 0x2e1c40, 'lit', 0, 1.32, -0.05, -0.4, 0, 0);
  part(body, rb(0.6, 0.05, 0.05, 0.02), 0xd8a838, 'metal', 0, 0.75, 0.2);
  // mochila de armas
  part(body, rb(0.4, 0.5, 0.25, 0.06), 0x6a4a2c, 'lit', 0, 0.72, -0.3);
  part(body, cylinder(0.03, 0.03, 0.6, 6), 0x55585e, 'metal', 0.15, 0.95, -0.35, 0.3, 0, 0.2);
  // lanterna
  const lamp = pivot(body, 0.36, 0.7, 0.15);
  part(lamp, cylinder(0.01, 0.01, 0.25, 4), 0x222222, 'lit', 0, 0.1, 0);
  part(lamp, rb(0.12, 0.16, 0.12, 0.03), 0x55585e, 'metal', 0, -0.06, 0);
  part(lamp, sphere(0.05, 8, 6), 0x9dff6a, 'glow', 0, -0.06, 0);
  bake(g);
  return { group: g, body };
}

// Bomba (com pavio aceso)
export function bomb(superBomb = false) {
  const g = new THREE.Group();
  part(g, sphere(superBomb ? 0.24 : 0.17, 14, 10), superBomb ? 0x2a3a1a : 0x1a1a1e, 'metal', 0, 0, 0);
  if (superBomb) for (let i = 0; i < 3; i++) part(g, rb(0.1, 0.02, 0.02, 0.008), 0xfff23a, 'glow', 0, 0.12 - i * 0.12, 0.235);
  part(g, cylinder(0.05, 0.05, 0.06, 8), 0x55585e, 'metal', 0, superBomb ? 0.25 : 0.18, 0);
  part(g, cylinder(0.012, 0.012, 0.12, 4), 0x8a6a3a, 'lit', 0.02, superBomb ? 0.32 : 0.25, 0, 0, 0, -0.4);
  const spark = new THREE.Group();
  part(spark, sphere(0.04, 6, 4), 0xffe27a, 'glow', 0.05, superBomb ? 0.38 : 0.31, 0);
  g.add(spark);
  bake(g);
  return { group: g, spark };
}

// Mira em forma de alvo no chão
export function reticle(color = 0xff3a2a) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  for (const [r1, r2] of [[0.62, 0.72], [0.3, 0.38]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r1, r2, 32), m);
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
  }
  for (const rot of [0, Math.PI / 2]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.06), m);
    bar.rotation.set(-Math.PI / 2, 0, rot);
    g.add(bar);
  }
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), m);
  dot.rotation.x = -Math.PI / 2;
  g.add(dot);
  g.position.y = 0.04;
  return { group: g, material: m };
}
