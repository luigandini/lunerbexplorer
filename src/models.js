// Personagens no estilo novo: 3D estilizado, cantos arredondados, cores fortes. Tudo original.
// (Os personagens antigos em blocos estão guardados em src/legacy/models-voxel.js)
import * as THREE from '../vendor/three.module.min.js';
import { roundedBox as rb, sphere, cylinder, cone, capsule, ico, part, pivot, bake, material } from './geo.js';

const SKIN = 0xf0b98a;
const HAIR = 0x5e3d22;

// ---------- emblemas da camiseta ----------
function shapeGeo(points, depth = 0.012) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
}
const BOLT = [[-0.02, 0.5], [0.22, 0.5], [0.06, 0.12], [0.2, 0.12], [-0.16, -0.5], [-0.02, -0.06], [-0.17, -0.06]];
let boltGeo = null, boltOutline = null, leafGeo = null;
function boltGeos() {
  if (!boltGeo) {
    boltGeo = shapeGeo(BOLT, 0.014);
    // contorno: o mesmo raio um pouco maior, atrás
    boltOutline = shapeGeo(BOLT.map(([x, y]) => [x * 1.22, y * 1.12]), 0.01);
  }
  return [boltGeo, boltOutline];
}
function leafGeos() {
  if (!leafGeo) {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5);
    s.bezierCurveTo(0.42, -0.25, 0.38, 0.3, 0, 0.5);
    s.bezierCurveTo(-0.38, 0.3, -0.42, -0.25, 0, -0.5);
    leafGeo = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false });
  }
  return leafGeo;
}

// ---------- herói (Lunerb, Lucas de branco, Feligon, Dait) ----------
export const OUTFITS = {
  lunerb: { shirt: 0xd42020, sleeves: 0xd42020, pants: 0x8f8f94, pantsLong: false, shoes: 0xd42020, sole: 0xffffff, emblem: 'bolt' },
  lucas: { shirt: 0xf4f4f4, sleeves: 0xf4f4f4, pants: 0xeeeeee, pantsLong: true, shoes: 0xffffff, sole: 0xcfcfcf, emblem: null },
  feligon: { shirt: 0xf6f2dc, sleeves: 0x4fc31a, sleeveLong: true, pants: 0x18181c, pantsLong: true, ripped: true, shoes: 0x3fbf1a, sole: 0x111111, emblem: 'leaf' },
  dait: { shirt: 0xe9e9ee, sleeves: 0xe9e9ee, sleeveLong: true, pants: 0xdedee4, pantsLong: true, shoes: 0x1a1a1e, sole: 0x2a2a2e, emblem: null, mask: true },
};

export function buildHero(outfitName = 'lunerb') {
  const o = OUTFITS[outfitName];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // pernas
  const legs = [];
  for (const sx of [-0.085, 0.085]) {
    const leg = pivot(body, sx, 0.36, 0);
    if (o.pantsLong) {
      part(leg, rb(0.13, 0.31, 0.14, 0.05), o.pants, 'lit', 0, -0.16, 0);
      if (o.ripped) part(leg, rb(0.07, 0.04, 0.02, 0.01), SKIN, 'lit', 0, -0.17, 0.071);
    } else {
      part(leg, rb(0.145, 0.15, 0.155, 0.05), o.pants, 'lit', 0, -0.06, 0);
      part(leg, capsule(0.048, 0.12), SKIN, 'lit', 0, -0.21, 0);
    }
    part(leg, rb(0.14, 0.085, 0.2, 0.04), o.shoes, 'lit', 0, -0.32, 0.025);
    part(leg, rb(0.146, 0.03, 0.206, 0.012), o.sole, 'lit', 0, -0.36, 0.025);
    legs.push(leg);
  }

  // tronco
  part(body, rb(0.34, 0.37, 0.21, 0.07), o.shirt, 'lit', 0, 0.55, 0);
  part(body, rb(0.16, 0.05, 0.05, 0.02), SKIN, 'lit', 0, 0.735, 0.02); // pescoço
  if (o.emblem === 'bolt') {
    const [g, out] = boltGeos();
    part(body, out, 0xffe9a8, 'lit', 0.005, 0.55, 0.103, 0, 0, 0, 0.42, 0.5, 1);
    part(body, g, 0x0d0d0d, 'lit', 0, 0.55, 0.108, 0, 0, 0, 0.42, 0.5, 1);
  } else if (o.emblem === 'leaf') {
    part(body, leafGeos(), 0x3fae16, 'lit', 0, 0.56, 0.105, 0, 0, 0.5, 0.26, 0.3, 1);
    part(body, rb(0.01, 0.13, 0.016, 0.004), 0x1f6a0a, 'lit', 0, 0.56, 0.118, 0, 0, 0.5);
  }
  if (o.mask) { // cordões do moletom
    part(body, rb(0.012, 0.09, 0.012, 0.004), 0x9a9aa4, 'lit', -0.04, 0.66, 0.11);
    part(body, rb(0.012, 0.09, 0.012, 0.004), 0x9a9aa4, 'lit', 0.04, 0.66, 0.11);
  }

  // braços com as Booteshiscore
  const arms = [], guns = [];
  for (const sx of [-0.215, 0.215]) {
    const arm = pivot(body, sx, 0.69, 0);
    part(arm, rb(0.12, 0.13, 0.13, 0.045), o.sleeves, 'lit', 0, -0.045, 0);
    if (o.sleeveLong) {
      part(arm, rb(0.1, 0.24, 0.11, 0.045), o.sleeves, 'lit', 0, -0.17, 0);
      if (outfitName === 'feligon') part(arm, rb(0.104, 0.035, 0.114, 0.015), 0x2f9a10, 'lit', 0, -0.27, 0);
    } else {
      part(arm, capsule(0.044, 0.14), SKIN, 'lit', 0, -0.19, 0);
    }
    part(arm, sphere(0.055), SKIN, 'lit', 0, -0.3, 0);
    const gun = pivot(arm, 0, -0.3, 0.06);
    part(gun, cylinder(0.022, 0.022, 0.13, 8), 0x2a1d12, 'lit', 0, -0.01, 0);
    part(gun, rb(0.2, 0.2, 0.2, 0.035), 0xb51414, 'lit', 0, 0.13, 0.05);
    part(gun, rb(0.212, 0.03, 0.212, 0.012), 0x1a0a0a, 'lit', 0, 0.08, 0.05);
    part(gun, rb(0.212, 0.03, 0.212, 0.012), 0x1a0a0a, 'lit', 0, 0.18, 0.05);
    part(gun, rb(0.07, 0.07, 0.03, 0.012), 0xff4a4a, 'glow', 0, 0.13, 0.155);
    part(gun, rb(0.03, 0.13, 0.03, 0.01), 0xff2a2a, 'glow', 0.103, 0.13, 0.05);
    part(gun, rb(0.03, 0.13, 0.03, 0.01), 0xff2a2a, 'glow', -0.103, 0.13, 0.05);
    gun.visible = false;
    arms.push(arm); guns.push(gun);
  }

  // cabeça grande (estilo desenho)
  const head = pivot(body, 0, 0.74, 0);
  part(head, rb(0.46, 0.42, 0.42, 0.13), SKIN, 'lit', 0, 0.21, 0);
  if (o.mask) {
    // capuz branco + máscara preta com chifres e olhos ciano
    part(head, rb(0.53, 0.5, 0.42, 0.17), 0xe9e9ee, 'lit', 0, 0.23, -0.04);
    part(head, rb(0.44, 0.38, 0.12, 0.1), 0x1f1f24, 'lit', 0, 0.2, 0.17);
    part(head, rb(0.09, 0.06, 0.03, 0.02), 0x2ee6ff, 'glow', -0.09, 0.23, 0.232);
    part(head, rb(0.09, 0.06, 0.03, 0.02), 0x2ee6ff, 'glow', 0.09, 0.23, 0.232);
    part(head, rb(0.08, 0.02, 0.02, 0.008), 0x0a0a0d, 'lit', -0.09, 0.285, 0.232, 0, 0, -0.25);
    part(head, rb(0.08, 0.02, 0.02, 0.008), 0x0a0a0d, 'lit', 0.09, 0.285, 0.232, 0, 0, 0.25);
    part(head, cone(0.045, 0.16, 6), 0x1f1f24, 'lit', -0.17, 0.5, 0.05, 0, 0, 0.35);
    part(head, cone(0.045, 0.16, 6), 0x1f1f24, 'lit', 0.17, 0.5, 0.05, 0, 0, -0.35);
    part(head, rb(0.03, 0.14, 0.03, 0.01), 0x2a2a30, 'lit', -0.05, 0.03, 0.2);
  } else {
    part(head, rb(0.49, 0.17, 0.46, 0.08), HAIR, 'lit', 0, 0.38, -0.005);
    part(head, rb(0.48, 0.3, 0.12, 0.06), HAIR, 'lit', 0, 0.25, -0.17);
    part(head, rb(0.05, 0.2, 0.36, 0.03), HAIR, 'lit', -0.235, 0.28, -0.03);
    part(head, rb(0.05, 0.2, 0.36, 0.03), HAIR, 'lit', 0.235, 0.28, -0.03);
    part(head, rb(0.2, 0.09, 0.06, 0.03), 0x6b4628, 'lit', -0.09, 0.33, 0.2, 0, 0, 0.18);
    part(head, rb(0.14, 0.08, 0.06, 0.03), 0x6b4628, 'lit', 0.1, 0.34, 0.2, 0, 0, -0.25);
    part(head, rb(0.09, 0.1, 0.02, 0.025), 0xffffff, 'lit', -0.095, 0.21, 0.212);
    part(head, rb(0.09, 0.1, 0.02, 0.025), 0xffffff, 'lit', 0.095, 0.21, 0.212);
    part(head, rb(0.05, 0.075, 0.02, 0.02), 0x2a1a10, 'lit', -0.08, 0.205, 0.222);
    part(head, rb(0.05, 0.075, 0.02, 0.02), 0x2a1a10, 'lit', 0.08, 0.205, 0.222);
    part(head, rb(0.016, 0.016, 0.01, 0.006), 0xffffff, 'lit', -0.07, 0.225, 0.233);
    part(head, rb(0.016, 0.016, 0.01, 0.006), 0xffffff, 'lit', 0.09, 0.225, 0.233);
    part(head, rb(0.085, 0.018, 0.02, 0.008), 0x4a2e18, 'lit', -0.095, 0.285, 0.212);
    part(head, rb(0.085, 0.018, 0.02, 0.008), 0x4a2e18, 'lit', 0.095, 0.285, 0.212);
    part(head, rb(0.07, 0.016, 0.02, 0.008), 0xb5755a, 'lit', 0, 0.11, 0.212);
  }

  bake(root);
  return { root, body, head, legs, arms, guns };
}

export const buildLunerb = () => buildHero('lunerb');

// ---------- zumbi mutante ----------
export function buildZumbi({ armor = false, boss = false } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = boss ? 0x6a5f7c : 0x857898;
  const glow = boss ? 0xff3b2f : 0x9dff3a;

  const legs = [];
  for (const sx of [-0.09, 0.09]) {
    const leg = pivot(body, sx, 0.34, 0);
    part(leg, rb(0.13, 0.32, 0.14, 0.05), 0x2e2b36, 'lit', 0, -0.15, 0);
    part(leg, rb(0.15, 0.07, 0.19, 0.03), 0x1b1a20, 'lit', 0, -0.31, 0.02);
    legs.push(leg);
  }
  const torso = pivot(body, 0, 0.34, 0);
  torso.rotation.x = 0.3;
  part(torso, rb(0.36, 0.36, 0.22, 0.07), 0x5a3b22, 'lit', 0, 0.18, 0);
  part(torso, rb(0.16, 0.24, 0.02, 0.02), skin, 'lit', 0, 0.18, 0.11);
  part(torso, rb(0.12, 0.03, 0.03, 0.01), 0x3d2614, 'lit', 0.08, 0.06, 0.11, 0, 0, 0.3);
  part(torso, sphere(0.03, 8, 6), glow, 'glow', 0.04, 0.22, 0.12);
  part(torso, sphere(0.022, 8, 6), glow, 'glow', -0.05, 0.12, 0.12);
  const arms = [];
  for (const sx of [-0.225, 0.225]) {
    const arm = pivot(torso, sx, 0.33, 0);
    arm.rotation.x = -1.3;
    part(arm, rb(0.1, 0.3, 0.1, 0.04), skin, 'lit', 0, -0.14, 0);
    part(arm, rb(0.108, 0.08, 0.108, 0.03), 0x4a3020, 'lit', 0, -0.03, 0);
    part(arm, sphere(0.06, 8, 6), skin, 'lit', 0, -0.3, 0);
    part(arm, sphere(0.022, 6, 4), glow, 'glow', 0.05, -0.16, 0.02);
    arms.push(arm);
  }
  const head = pivot(torso, 0, 0.36, 0.03);
  part(head, rb(0.4, 0.38, 0.38, 0.11), skin, 'lit', 0, 0.18, 0);
  part(head, rb(0.42, 0.06, 0.4, 0.03), 0x4b4258, 'lit', 0, 0.36, 0);
  part(head, rb(0.3, 0.04, 0.05, 0.02), 0x5a4f6a, 'lit', 0, 0.255, 0.18);
  part(head, sphere(0.045, 10, 8), glow, 'glow', -0.085, 0.2, 0.18);
  part(head, sphere(0.045, 10, 8), glow, 'glow', 0.085, 0.2, 0.18);
  part(head, rb(0.14, 0.03, 0.03, 0.01), 0x2a2233, 'lit', 0, 0.085, 0.19, 0, 0, 0.12);
  part(head, rb(0.02, 0.1, 0.02, 0.008), 0x2a2233, 'lit', -0.13, 0.3, 0.19, 0, 0, 0.4);

  let armorGroup = null;
  if (armor) {
    armorGroup = new THREE.Group();
    torso.add(armorGroup);
    const iron = boss ? 0x6f7782 : 0x9aa3ad;
    part(armorGroup, rb(0.4, 0.3, 0.27, 0.08), iron, 'metal', 0, 0.2, 0);
    part(armorGroup, rb(0.06, 0.24, 0.02, 0.02), 0x5a6068, 'metal', 0, 0.2, 0.14);
    part(armorGroup, sphere(0.1, 10, 8), iron, 'metal', -0.23, 0.32, 0, 0, 0, 0, 1.2, 0.8, 1.2);
    part(armorGroup, sphere(0.1, 10, 8), iron, 'metal', 0.23, 0.32, 0, 0, 0, 0, 1.2, 0.8, 1.2);
    const helm = pivot(armorGroup, 0, 0.36, 0.03);
    part(helm, rb(0.45, 0.34, 0.43, 0.12), iron, 'metal', 0, 0.24, 0);
    part(helm, rb(0.3, 0.05, 0.03, 0.015), 0x0d0d10, 'lit', 0, 0.2, 0.215);
    part(helm, rb(0.06, 0.03, 0.03, 0.01), glow, 'glow', -0.08, 0.2, 0.225);
    part(helm, rb(0.06, 0.03, 0.03, 0.01), glow, 'glow', 0.08, 0.2, 0.225);
    part(helm, rb(0.04, 0.12, 0.38, 0.02), 0x80878f, 'metal', 0, 0.42, 0);
    if (boss) {
      part(helm, cone(0.06, 0.26, 7), 0xe2d8c0, 'lit', -0.25, 0.46, 0, 0, 0, 0.7);
      part(helm, cone(0.06, 0.26, 7), 0xe2d8c0, 'lit', 0.25, 0.46, 0, 0, 0, -0.7);
      for (const a of arms) part(a, rb(0.17, 0.17, 0.17, 0.05), iron, 'metal', 0, -0.3, 0);
    }
  }
  bake(root);
  return { root, body, torso, head, legs, arms, armorGroup };
}

// ---------- aranha de teia ----------
export function buildAranha() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  part(body, sphere(0.16, 12, 10), 0x22271e, 'lit', 0, 0.22, 0.02, 0, 0, 0, 1.2, 0.85, 1.2);
  part(body, sphere(0.2, 12, 10), 0x1e2219, 'lit', 0, 0.27, -0.27);
  part(body, sphere(0.15, 10, 8), 0x3f6b2a, 'lit', 0, 0.36, -0.29, 0, 0, 0, 1.1, 0.5, 1.1);
  part(body, sphere(0.11, 10, 8), 0x1a1d16, 'lit', 0, 0.21, 0.2);
  for (const [x, y] of [[-0.05, 0.25], [0.05, 0.25], [-0.025, 0.28], [0.025, 0.28]]) part(body, sphere(0.022, 6, 4), 0xff2a2a, 'glow', x, y, 0.3);
  part(body, cone(0.02, 0.07, 5), 0x0d0d0d, 'lit', -0.035, 0.15, 0.29, 2.6, 0, 0);
  part(body, cone(0.02, 0.07, 5), 0x0d0d0d, 'lit', 0.035, 0.15, 0.29, 2.6, 0, 0);
  const legs = [];
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const leg = pivot(body, s * 0.13, 0.22, 0.13 - i * 0.09);
      leg.rotation.y = s * (0.5 - i * 0.33);
      const upper = pivot(leg, 0, 0, 0);
      upper.rotation.z = s * -0.6;
      part(upper, cylinder(0.018, 0.022, 0.24, 6), 0x15180f, 'lit', s * 0.12, 0, 0, 0, 0, Math.PI / 2);
      part(upper, cylinder(0.012, 0.018, 0.26, 6), 0x15180f, 'lit', s * 0.27, -0.11, 0, 0, 0, s * 0.6);
      legs.push(leg);
    }
  }
  bake(root);
  return { root, body, legs };
}

// ---------- morcego de brasa ----------
let wingGeo = null;
export function buildMorcego() {
  if (!wingGeo) {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0.42, 0.12); s.lineTo(0.38, -0.02); s.lineTo(0.3, -0.12); s.lineTo(0.22, -0.04); s.lineTo(0.14, -0.13); s.lineTo(0.07, -0.05); s.lineTo(0, -0.1);
    wingGeo = new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: false });
    wingGeo.rotateX(Math.PI / 2);
  }
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  part(body, sphere(0.13, 12, 10), 0x2a1c1c, 'lit', 0, 0, 0);
  part(body, cone(0.04, 0.1, 5), 0x2a1c1c, 'lit', -0.06, 0.13, 0, 0, 0, 0.3);
  part(body, cone(0.04, 0.1, 5), 0x2a1c1c, 'lit', 0.06, 0.13, 0, 0, 0, -0.3);
  part(body, sphere(0.025, 6, 4), 0xffd23a, 'glow', -0.045, 0.03, 0.115);
  part(body, sphere(0.025, 6, 4), 0xffd23a, 'glow', 0.045, 0.03, 0.115);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(body, s * 0.1, 0.02, 0);
    const m = new THREE.Mesh(wingGeo, material(0xff6a1a, 'glow'));
    m.scale.set(s, 1, 1);
    m.position.z = 0.08;
    w.add(m);
    wings.push(w);
  }
  bake(root, { shadows: true });
  return { root, body, wings };
}

// ---------- coletáveis ----------
export function buildCoracao() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, -0.12);
  s.bezierCurveTo(0.18, 0.02, 0.14, 0.16, 0, 0.08);
  s.bezierCurveTo(-0.14, 0.16, -0.18, 0.02, 0, -0.12);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  geo.center();
  const m = new THREE.Mesh(geo, material(0xff3355, 'glow'));
  m.position.y = 0.45;
  m.scale.setScalar(1.3);
  g.add(m);
  return g;
}

export function buildCristal() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), material(0x46e6ff, 'glow'));
  m.position.y = 0.3;
  m.scale.y = 1.5;
  g.add(m);
  return g;
}

// ---------- Mundo 2: Bosque dos Sussurros ----------

// Cogumelo-espora: anda devagar e solta uma nuvem de esporos
export function buildCogumelo() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  part(body, cylinder(0.12, 0.16, 0.34, 10), 0xe8dcc0, 'lit', 0, 0.2, 0);
  part(body, sphere(0.04, 6, 4), 0x9dff3a, 'glow', -0.05, 0.25, 0.13);
  part(body, sphere(0.04, 6, 4), 0x9dff3a, 'glow', 0.05, 0.25, 0.13);
  part(body, rb(0.08, 0.02, 0.02, 0.008), 0x3a2a20, 'lit', 0, 0.17, 0.145);
  const cap = pivot(body, 0, 0.38, 0);
  part(cap, sphere(0.3, 14, 10), 0x8a2a8a, 'lit', 0, 0.02, 0, 0, 0, 0, 1, 0.55, 1);
  for (const [x, z] of [[0.15, 0.1], [-0.12, 0.14], [0.02, -0.18], [-0.18, -0.06], [0.2, -0.08]]) part(cap, sphere(0.045, 6, 4), 0xf2e8ff, 'lit', x, 0.12, z);
  const legs = [];
  for (const sx of [-0.07, 0.07]) {
    const leg = pivot(body, sx, 0.06, 0);
    part(leg, rb(0.07, 0.08, 0.1, 0.03), 0xd8ccb0, 'lit', 0, -0.02, 0.02);
    legs.push(leg);
  }
  bake(root);
  return { root, body, cap, legs };
}

// Planta-espinho: fica parada e atira espinhos
export function buildEspinho() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    part(body, cone(0.12, 0.42, 5), 0x2f7a2a, 'lit', Math.cos(a) * 0.18, 0.12, Math.sin(a) * 0.18, Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
  }
  part(body, cylinder(0.06, 0.09, 0.4, 7), 0x3f6b2a, 'lit', 0, 0.2, 0);
  const head = pivot(body, 0, 0.45, 0);
  part(head, sphere(0.22, 12, 10), 0x6a1a3a, 'lit', 0, 0, 0);
  part(head, sphere(0.12, 10, 8), 0xff3a6a, 'glow', 0, 0, 0.14, 0, 0, 0, 1, 0.8, 0.6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    part(head, cone(0.03, 0.16, 4), 0xe8d8a0, 'lit', Math.cos(a) * 0.2, Math.sin(a) * 0.2, -0.02, 0, 0, a - Math.PI / 2);
  }
  bake(root);
  return { root, body, head, legs: [] };
}

// Mãe-Teia: aranha gigante coberta de musgo
export function buildMaeTeia() {
  const a = buildAranha();
  part(a.body, rb(0.08, 0.14, 0.02, 0.01), 0xff2a2a, 'glow', 0, 0.38, -0.12);
  for (let i = 0; i < 6; i++) part(a.body, cone(0.03, 0.12, 4), 0x3f6b2a, 'lit', (i - 2.5) * 0.06, 0.45, -0.3 + (i % 2) * 0.05, -0.3, 0, 0);
  bake(a.root);
  return a;
}

// Ancião Oco: árvore antiga que o lodo deixou brava
export function buildAnciao() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  part(body, cylinder(0.32, 0.45, 1.3, 10), 0x5a3d22, 'lit', 0, 0.65, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    part(body, cylinder(0.06, 0.13, 0.55, 6), 0x4a3018, 'lit', Math.cos(a) * 0.42, 0.1, Math.sin(a) * 0.42, Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
  }
  // rosto oco
  part(body, sphere(0.09, 8, 6), 0x0d0a06, 'lit', -0.13, 0.95, 0.3);
  part(body, sphere(0.09, 8, 6), 0x0d0a06, 'lit', 0.13, 0.95, 0.3);
  part(body, sphere(0.05, 8, 6), 0x9dff3a, 'glow', -0.13, 0.95, 0.35);
  part(body, sphere(0.05, 8, 6), 0x9dff3a, 'glow', 0.13, 0.95, 0.35);
  part(body, sphere(0.12, 8, 6), 0x0d0a06, 'lit', 0, 0.68, 0.32, 0, 0, 0, 1.4, 0.6, 0.6);
  part(body, rb(0.3, 0.05, 0.05, 0.02), 0x3a2410, 'lit', 0, 1.1, 0.33, 0, 0, 0.15);
  // casca (armadura) que cai
  const armorGroup = new THREE.Group();
  body.add(armorGroup);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    part(armorGroup, rb(0.2, 0.5, 0.08, 0.03), 0x3a2814, 'lit', Math.cos(a) * 0.4, 0.45 + (i % 2) * 0.35, Math.sin(a) * 0.4, 0, -a + Math.PI / 2, 0);
  }
  const core = new THREE.Group();
  part(core, sphere(0.16, 10, 8), 0x9dff3a, 'glow', 0, 0.55, 0.28);
  body.add(core);
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = pivot(body, sx * 0.32, 1.05, 0);
    arm.rotation.z = sx * 0.6;
    part(arm, cylinder(0.06, 0.1, 0.8, 6), 0x5a3d22, 'lit', sx * 0.35, 0.1, 0, 0, 0, sx * -1.2);
    part(arm, cylinder(0.03, 0.05, 0.35, 5), 0x5a3d22, 'lit', sx * 0.7, 0.32, 0.05, 0, 0, sx * -0.4);
    part(arm, ico(0.22, 1), 0x2f5a24, 'lit', sx * 0.75, 0.45, 0);
    arms.push(arm);
  }
  for (const [x, y, z, r] of [[0, 1.55, 0, 0.6], [0.4, 1.4, 0.1, 0.42], [-0.4, 1.42, -0.1, 0.45], [0.05, 1.85, -0.05, 0.4]]) part(body, ico(r, 1), 0x2a4a20, 'lit', x, y, z);
  const legs = [];
  bake(root);
  return { root, body, arms, legs, armorGroup, core };
}

// casulo de teia (o Feligon fica preso aqui)
export function buildCasulo() {
  const g = new THREE.Group();
  part(g, sphere(0.35, 12, 10), 0xe8e8f0, 'lit', 0, 0.55, 0, 0, 0, 0, 0.9, 1.5, 0.9);
  for (let i = 0; i < 6; i++) part(g, rb(0.72, 0.03, 0.03, 0.01), 0xc8c8d4, 'lit', 0, 0.2 + i * 0.13, 0, 0, i * 0.5, 0.3);
  part(g, cylinder(0.01, 0.01, 1.2, 4), 0xe8e8f0, 'lit', 0, 1.4, 0);
  bake(g);
  return g;
}
