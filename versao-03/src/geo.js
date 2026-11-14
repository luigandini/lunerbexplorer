// Peças básicas do estilo novo (3D estilizado, cantos arredondados) e junção de malhas para ficar leve no celular.
import * as THREE from '../vendor/three.module.min.js';

const geoCache = new Map();

// Caixa com cantos arredondados (sem depender de extras do Three.js)
export function roundedBox(w, h, d, r = 0.05, seg = 2) {
  const key = `rb|${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}|${seg}`;
  if (geoCache.has(key)) return geoCache.get(key);
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position, n = g.attributes.normal;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  const v = new THREE.Vector3(), inner = new THREE.Vector3(), dir = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    inner.set(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz));
    dir.subVectors(v, inner);
    if (dir.lengthSq() > 1e-10) {
      dir.normalize();
      v.copy(inner).addScaledVector(dir, r);
      p.setXYZ(i, v.x, v.y, v.z);
      n.setXYZ(i, dir.x, dir.y, dir.z);
    }
  }
  geoCache.set(key, g);
  return g;
}

export function sphere(r, ws = 12, hs = 8) {
  const key = `sp|${r}|${ws}|${hs}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.SphereGeometry(r, ws, hs));
  return geoCache.get(key);
}
export function cylinder(rt, rb, h, s = 10) {
  const key = `cy|${rt}|${rb}|${h}|${s}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.CylinderGeometry(rt, rb, h, s));
  return geoCache.get(key);
}
export function capsule(r, len, s = 8) {
  const key = `ca|${r}|${len}|${s}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.CapsuleGeometry(r, len, 3, s));
  return geoCache.get(key);
}
export function cone(r, h, s = 8) {
  const key = `co|${r}|${h}|${s}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.ConeGeometry(r, h, s));
  return geoCache.get(key);
}
export function ico(r, detail = 1) {
  const key = `ic|${r}|${detail}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.IcosahedronGeometry(r, detail));
  return geoCache.get(key);
}

// Materiais por "tipo": lit (fosco), metal, glow (brilha sozinho)
const matCache = new Map();
export function material(color, kind = 'lit', opacity = 1) {
  const key = `${color}|${kind}|${opacity}`;
  if (matCache.has(key)) return matCache.get(key);
  let m;
  if (kind === 'glow') m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
  else if (kind === 'metal') m = new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.38 });
  else m = new THREE.MeshLambertMaterial({ color, transparent: opacity < 1, opacity });
  m.userData.kind = kind;
  matCache.set(key, m);
  return m;
}

// Coloca uma peça no grupo
export function part(parent, geo, color, kind, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, material(color, kind));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}

export function pivot(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// Junta as peças de cada grupo em 1 malha por tipo de material (muito menos trabalho para o celular)
const bakedMats = {
  lit: new THREE.MeshLambertMaterial({ vertexColors: true }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.65 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
};
const tmpN = new THREE.Matrix3();
const tv = new THREE.Vector3();

export function bake(root, { shadows = true } = {}) {
  const groups = [];
  root.traverse((o) => { if (o.children.some((c) => c.isMesh && c.material.userData.kind && !c.material.transparent)) groups.push(o); });
  for (const g of groups) {
    const meshes = g.children.filter((c) => c.isMesh && c.material.userData.kind && !c.material.transparent);
    for (const kind of ['lit', 'metal', 'glow']) {
      const list = meshes.filter((m) => m.material.userData.kind === kind);
      if (!list.length) continue;
      let total = 0;
      const geos = list.map((m) => { const ng = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry; total += ng.attributes.position.count; return ng; });
      const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
      let o = 0;
      list.forEach((m, k) => {
        m.updateMatrix();
        tmpN.getNormalMatrix(m.matrix);
        const c = m.material.color;
        const gp = geos[k].attributes.position, gn = geos[k].attributes.normal;
        for (let i = 0; i < gp.count; i++, o++) {
          tv.fromBufferAttribute(gp, i).applyMatrix4(m.matrix);
          pos[o * 3] = tv.x; pos[o * 3 + 1] = tv.y; pos[o * 3 + 2] = tv.z;
          tv.fromBufferAttribute(gn, i).applyMatrix3(tmpN).normalize();
          nor[o * 3] = tv.x; nor[o * 3 + 1] = tv.y; nor[o * 3 + 2] = tv.z;
          col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b;
        }
        if (geos[k] !== m.geometry) geos[k].dispose();
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.computeBoundingSphere();
      const merged = new THREE.Mesh(geo, bakedMats[kind]);
      merged.castShadow = shadows && kind !== 'glow';
      merged.receiveShadow = false;
      for (const m of list) g.remove(m);
      g.add(merged);
    }
  }
  return root;
}
