// Personagens em voxel (blocos), montados com caixinhas. Tudo original.
import * as THREE from '../vendor/three.module.min.js';

export const PX = 0.04; // tamanho de 1 "pixel" do personagem em unidades do mundo
const BOX = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map();

export function mat(color, emissive = 0, opts = {}) {
  const key = `${color}|${emissive}|${opts.opacity || 1}|${opts.basic ? 1 : 0}`;
  if (matCache.has(key)) return matCache.get(key);
  let m;
  if (opts.basic) {
    m = new THREE.MeshBasicMaterial({ color, transparent: !!opts.opacity, opacity: opts.opacity || 1 });
  } else {
    m = new THREE.MeshLambertMaterial({
      color,
      emissive: emissive ? color : 0x000000,
      emissiveIntensity: emissive || 0,
      transparent: !!opts.opacity,
      opacity: opts.opacity || 1,
    });
  }
  matCache.set(key, m);
  return m;
}

// Caixa em "pixels": largura, altura, profundidade e centro (x, y, z)
export function vox(parent, color, w, h, d, x, y, z, emissive = 0, opts) {
  const m = new THREE.Mesh(BOX, mat(color, emissive, opts));
  m.scale.set(w * PX, h * PX, d * PX);
  m.position.set(x * PX, y * PX, z * PX);
  parent.add(m);
  return m;
}

// Junta as caixinhas de cada grupo numa malha só (bem menos trabalho para celular simples).
// Partes que brilham viram um material sem sombra; partes transparentes ficam como estão.
const bakedLit = new THREE.MeshLambertMaterial({ vertexColors: true });
const bakedGlow = new THREE.MeshBasicMaterial({ vertexColors: true });
const tmpN = new THREE.Matrix3();
const tmpV = new THREE.Vector3();
export function bake(root) {
  const groups = [];
  root.traverse((o) => { if (o.children.some((c) => c.isMesh && c.geometry === BOX)) groups.push(o); });
  for (const g of groups) {
    const meshes = g.children.filter((c) => c.isMesh && c.geometry === BOX && !c.material.transparent);
    if (meshes.length < 2) continue;
    for (const glow of [false, true]) {
      const list = meshes.filter((m) => (m.material.emissiveIntensity > 0 || m.material.isMeshBasicMaterial) === glow);
      if (!list.length) continue;
      const src = BOX;
      const vpm = src.attributes.position.count;
      const ipm = src.index.count;
      const pos = new Float32Array(vpm * 3 * list.length);
      const nor = new Float32Array(vpm * 3 * list.length);
      const col = new Float32Array(vpm * 3 * list.length);
      const idx = new Uint32Array(ipm * list.length);
      list.forEach((m, k) => {
        m.updateMatrix();
        tmpN.getNormalMatrix(m.matrix);
        const c = m.material.color;
        const boost = glow ? 1.15 : 1;
        for (let i = 0; i < vpm; i++) {
          tmpV.fromBufferAttribute(src.attributes.position, i).applyMatrix4(m.matrix);
          pos.set([tmpV.x, tmpV.y, tmpV.z], (k * vpm + i) * 3);
          tmpV.fromBufferAttribute(src.attributes.normal, i).applyMatrix3(tmpN).normalize();
          nor.set([tmpV.x, tmpV.y, tmpV.z], (k * vpm + i) * 3);
          col.set([c.r * boost, c.g * boost, c.b * boost], (k * vpm + i) * 3);
        }
        for (let i = 0; i < ipm; i++) idx[k * ipm + i] = src.index.array[i] + k * vpm;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
      const merged = new THREE.Mesh(geo, glow ? bakedGlow : bakedLit);
      for (const m of list) g.remove(m);
      g.add(merged);
    }
  }
  return root;
}

function pivot(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x * PX, y * PX, z * PX);
  parent.add(g);
  return g;
}

// ---------- Lunerb ----------
const SKIN = 0xf0b98a;
export function buildLunerb() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // pernas (pivô no quadril)
  const legs = [];
  for (const sx of [-2, 2]) {
    const leg = pivot(body, sx, 12, 0);
    vox(leg, 0xffffff, 4, 1, 4.2, 0, -11.5, 0.1);         // sola
    vox(leg, 0xd42020, 4, 2, 4.2, 0, -10, 0.1);           // tênis vermelho
    vox(leg, 0xffffff, 2, 1, 0.4, 0, -10, 2.2);           // detalhe branco
    vox(leg, SKIN, 4, 3, 4, 0, -7.5, 0);                  // perna
    vox(leg, 0x8e8e8e, 4.2, 6, 4.2, 0, -3, 0);            // bermuda cinza
    vox(leg, 0xd8d8d8, 1, 1, 0.3, sx > 0 ? -0.8 : 0.8, -2, 2.2);
    vox(leg, 0xd8d8d8, 1, 1, 0.3, sx > 0 ? 1 : -1, -4.5, 2.2);
    legs.push(leg);
  }

  // tronco: camiseta vermelha com raio preto
  vox(body, 0xd42020, 8, 12, 4, 0, 18, 0);
  vox(body, 0x111111, 2, 3, 0.4, 1, 21.5, 2.1);
  vox(body, 0x111111, 3, 1.5, 0.4, 0, 19.5, 2.1);
  vox(body, 0x111111, 2, 3, 0.4, -1, 17, 2.1);

  // braços (pivô no ombro) com as Booteshiscore nas mãos
  const arms = [];
  const guns = [];
  for (const sx of [-6, 6]) {
    const arm = pivot(body, sx, 24, 0);
    vox(arm, 0xd42020, 4.2, 4, 4.2, 0, -2, 0);
    vox(arm, SKIN, 4, 8, 4, 0, -8, 0);
    const gun = new THREE.Group();
    gun.position.set(0, -11 * PX, 2.5 * PX);
    arm.add(gun);
    vox(gun, 0x2a1d12, 1.6, 5, 1.6, 0, -1, 0);           // cabo
    vox(gun, 0xb81616, 6, 6, 6, 0, 3.5, 1, 0.7);          // cubo vermelho brilhante
    vox(gun, 0x1a0a0a, 6.3, 1, 6.3, 0, 2.2, 1);
    vox(gun, 0x1a0a0a, 6.3, 1, 6.3, 0, 4.8, 1);
    vox(gun, 0xff5a5a, 1.5, 1.5, 0.5, 0, 3.5, 4.2, 1);    // ponta que brilha
    gun.visible = false;
    arms.push(arm);
    guns.push(gun);
  }

  // cabeça grande (estilo brinquedo)
  const head = pivot(body, 0, 24, 0);
  vox(head, SKIN, 10, 10, 10, 0, 5, 0);
  vox(head, 0x6b4a2b, 10.6, 3, 10.6, 0, 9.2, 0);        // cabelo topo
  vox(head, 0x6b4a2b, 10.6, 8, 2, 0, 5.5, -4.6);        // nuca
  vox(head, 0x6b4a2b, 1, 5, 9, -5.2, 7, -0.5);
  vox(head, 0x6b4a2b, 1, 5, 9, 5.2, 7, -0.5);
  vox(head, 0x5a3c22, 6, 2, 1, -2, 7.6, 5.1);           // franja
  vox(head, 0x5a3c22, 2, 3, 1, 3.5, 7.2, 5.1);
  vox(head, 0xffffff, 2.4, 2.2, 0.4, -2.4, 4.4, 5.1);   // olhos
  vox(head, 0xffffff, 2.4, 2.2, 0.4, 2.4, 4.4, 5.1);
  vox(head, 0x2a1a10, 1.2, 2.2, 0.5, -1.8, 4.4, 5.2);
  vox(head, 0x2a1a10, 1.2, 2.2, 0.5, 1.8, 4.4, 5.2);
  vox(head, 0xc98a62, 2, 0.8, 0.4, 0, 1.6, 5.1);        // sorriso

  bake(root);
  return { root, body, head, legs, arms, guns };
}

// ---------- Zumbi mutante (com ou sem armadura) ----------
export function buildZumbi({ armor = false, scale = 1, boss = false } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = boss ? 0x6d6380 : 0x7f7392;
  const glow = boss ? 0xff3b2f : 0x9dff3a;

  const legs = [];
  for (const sx of [-2, 2]) {
    const leg = pivot(body, sx, 11, 0);
    vox(leg, 0x2c2a33, 4, 11, 4, 0, -5.5, 0);
    vox(leg, 0x1a1a1f, 4.4, 2, 4.4, 0, -10, 0.3);
    legs.push(leg);
  }
  const torso = pivot(body, 0, 11, 0);
  torso.rotation.x = 0.28; // corcunda
  vox(torso, 0x5a3b22, 8, 11, 4.2, 0, 5.5, 0);          // colete rasgado
  vox(torso, skin, 4, 6, 0.4, 0, 5, 2.2);
  vox(torso, glow, 1, 1, 0.5, 1, 6, 2.4, 1.2);          // mancha tóxica
  const arms = [];
  for (const sx of [-5.5, 5.5]) {
    const arm = pivot(torso, sx, 10, 0);
    arm.rotation.x = -1.3; // braços pra frente
    vox(arm, skin, 3.5, 11, 3.5, 0, -5.5, 0);
    vox(arm, glow, 1, 1, 0.5, 0, -7, 1.9, 1.2);
    arms.push(arm);
  }
  const head = pivot(torso, 0, 11, 0.5);
  vox(head, skin, 9, 9, 9, 0, 4.5, 0);
  vox(head, 0x4b4258, 9.4, 1, 9.4, 0, 8.8, 0);
  vox(head, glow, 2.2, 1.6, 0.5, -2.2, 4.8, 4.6, 1.5);  // olhos brilhando
  vox(head, glow, 2.2, 1.6, 0.5, 2.2, 4.8, 4.6, 1.5);
  vox(head, 0x2a2233, 4, 1, 0.5, 0, 1.8, 4.6);

  let armorGroup = null;
  if (armor) {
    armorGroup = new THREE.Group();
    torso.add(armorGroup);
    const iron = boss ? 0x7a828c : 0x9aa3ad;
    vox(armorGroup, iron, 9, 7, 5.4, 0, 7.5, 0);           // peitoral
    vox(armorGroup, iron, 4, 2.5, 6, -6, 10.5, 0);        // ombreiras
    vox(armorGroup, iron, 4, 2.5, 6, 6, 10.5, 0);
    const helm = pivot(armorGroup, 0, 11, 0.5);
    vox(helm, iron, 10, 7, 10, 0, 6.5, 0);
    vox(helm, 0x111111, 7, 1.2, 0.5, 0, 5, 5.1);          // fresta do visor
    vox(helm, glow, 1.5, 0.8, 0.6, -2, 5, 5.2, 1.5);
    vox(helm, glow, 1.5, 0.8, 0.6, 2, 5, 5.2, 1.5);
    if (boss) {
      vox(helm, 0xd9d2c0, 2, 5, 2, -5.5, 11, 0);          // chifres
      vox(helm, 0xd9d2c0, 2, 5, 2, 5.5, 11, 0);
      vox(helm, 0xd9d2c0, 2, 2, 2, -6.5, 14, 0);
      vox(helm, 0xd9d2c0, 2, 2, 2, 6.5, 14, 0);
      for (const a of arms) vox(a, iron, 5, 5, 5, 0, -10, 0); // manoplas
    }
  }
  root.scale.setScalar(scale);
  bake(root);
  return { root, body, torso, head, legs, arms, armorGroup };
}

// ---------- Aranha de teia ----------
export function buildAranha() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  vox(body, 0x23281f, 10, 6, 12, 0, 6, -1);
  vox(body, 0x3f6b2a, 8, 1.5, 9, 0, 9.5, -2);           // musgo nas costas
  vox(body, 0x1b1f18, 7, 5, 6, 0, 5.5, 7);              // cabeça
  vox(body, 0xff2a2a, 1.4, 1.4, 0.5, -1.8, 6.5, 10.2, 1.5);
  vox(body, 0xff2a2a, 1.4, 1.4, 0.5, 1.8, 6.5, 10.2, 1.5);
  vox(body, 0xff2a2a, 1, 1, 0.5, -0.8, 7.8, 10.2, 1.5);
  vox(body, 0xff2a2a, 1, 1, 0.5, 0.8, 7.8, 10.2, 1.5);
  const legs = [];
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const leg = pivot(body, s * 5, 6, 4 - i * 3.5);
      leg.rotation.z = s * 0.7;
      vox(leg, 0x161a13, 9, 1.6, 1.6, s * 4, -1, 0);
      legs.push(leg);
    }
  }
  bake(root);
  return { root, body, legs };
}

// ---------- Morcego de brasa ----------
export function buildMorcego() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  vox(body, 0x2a1c1c, 6, 6, 6, 0, 0, 0);
  vox(body, 0xffd23a, 1.2, 1.2, 0.5, -1.3, 1, 3.1, 1.5);
  vox(body, 0xffd23a, 1.2, 1.2, 0.5, 1.3, 1, 3.1, 1.5);
  vox(body, 0x2a1c1c, 1.5, 2, 1.5, -2, 3.5, 0);
  vox(body, 0x2a1c1c, 1.5, 2, 1.5, 2, 3.5, 0);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = pivot(body, s * 3, 0.5, 0);
    vox(w, 0xff6a1a, 10, 1, 6, s * 5, 0, 0, 0.9);
    vox(w, 0xffb347, 4, 1.2, 2, s * 8, 0, 2, 1.2);
    wings.push(w);
  }
  bake(root);
  return { root, body, wings };
}

// ---------- objetos ----------
export function buildBau(kind) {
  const root = new THREE.Group();
  const wood = kind === 'secreto' ? 0x4b2a6b : 0x7a4a22;
  const trim = kind === 'arma' ? 0xff3030 : kind === 'secreto' ? 0xc58cff : 0xe0b040;
  const glow = kind === 'cristais' ? 0 : 0.8;
  vox(root, wood, 16, 9, 11, 0, 4.5, 0);
  vox(root, trim, 16.4, 1.2, 11.4, 0, 7, 0, glow);
  const lid = pivot(root, 0, 9, -5.5);
  vox(lid, wood, 16, 4, 11, 0, 2, 5.5);
  vox(lid, trim, 3, 3, 1, 0, 0, 11.2, glow);
  bake(root);
  return { root, lid };
}

export function buildCoracao() {
  const g = new THREE.Group();
  const c = 0xff3355;
  const pts = [[-2, 2], [-1, 3], [1, 3], [2, 2], [-3, 1], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1],
    [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, -1], [0, -1], [1, -1], [0, -2]];
  for (const [x, y] of pts) vox(g, c, 2, 2, 2, x * 2, y * 2 + 14, 0, 0.6);
  bake(g);
  return g;
}

export function buildCristal() {
  const g = new THREE.Group();
  const m = vox(g, 0x46e6ff, 4, 4, 4, 0, 8, 0, 1.2);
  m.rotation.set(Math.PI / 4, 0, Math.PI / 4);
  return g;
}
