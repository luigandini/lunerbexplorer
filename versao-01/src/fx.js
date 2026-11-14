// Efeitos visuais leves: fumacinha, faíscas, rastro do Turbo Negro, onda de choque.
import * as THREE from '../vendor/three.module.min.js';
import { mat } from './models.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const MAX = 220;

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.free = [];
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 40);
    this.ringGeo.rotateX(-Math.PI / 2);
  }

  spawn(x, y, z, { color = 0x888888, size = 0.2, vx = 0, vy = 0, vz = 0, life = 0.6, gravity = 0, emissive = 0, shrink = true, spin = 0 } = {}) {
    if (this.list.length >= MAX) return;
    let m = this.free.pop();
    if (!m) { m = new THREE.Mesh(BOX); this.scene.add(m); }
    m.material = mat(color, emissive);
    m.visible = true;
    m.position.set(x, y, z);
    m.scale.setScalar(size);
    m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    this.list.push({ m, vx, vy, vz, life, max: life, size, gravity, shrink, spin });
  }

  smoke(x, z, big = 1) {
    for (let i = 0; i < 10 * big; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 1.2 * big;
      this.spawn(x + Math.cos(a) * 0.2, 0.4 + Math.random() * 0.5, z + Math.sin(a) * 0.2, {
        color: Math.random() < 0.5 ? 0x9a9aa4 : 0xc8c8d0, size: (0.18 + Math.random() * 0.2) * big,
        vx: Math.cos(a) * s, vy: 1 + Math.random() * 1.2, vz: Math.sin(a) * s, life: 0.6 + Math.random() * 0.4,
      });
    }
  }

  sparks(x, y, z, color = 0xffd23a, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn(x, y, z, { color, size: 0.08, vx: Math.cos(a) * 3, vy: 1.5 + Math.random() * 2, vz: Math.sin(a) * 3, life: 0.35, gravity: 9, emissive: 1.2 });
    }
  }

  lightning(x, z) {
    this.spawn(x + (Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 0.9, z + (Math.random() - 0.5) * 0.5, {
      color: Math.random() < 0.5 ? 0x8a2be2 : 0x111111, size: 0.1 + Math.random() * 0.12, life: 0.35, emissive: 1.2, vy: 0.5,
    });
  }

  armorPieces(x, z, scale = 1) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn(x, 0.8 * scale, z, { color: 0x9aa3ad, size: 0.22 * scale, vx: Math.cos(a) * 2.5, vy: 3, vz: Math.sin(a) * 2.5, life: 1.1, gravity: 12, shrink: false, spin: 8 });
    }
  }

  ring(x, z, maxR, dur, color = 0xff7a1a) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    m.position.set(x, 0.06, z);
    this.scene.add(m);
    const r = { m, t: 0, dur, maxR, x, z, r: 0 };
    this.rings.push(r);
    return r;
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; this.free.push(p.m); this.list.splice(i, 1); continue; }
      p.vy -= p.gravity * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      if (p.m.position.y < 0.05 && p.gravity) { p.m.position.y = 0.05; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      if (p.spin) p.m.rotation.x += p.spin * dt;
      if (p.shrink) p.m.scale.setScalar(p.size * (p.life / p.max));
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      r.r = Math.max(0.01, k * r.maxR);
      r.m.scale.set(r.r, 1, r.r);
      r.m.material.opacity = 0.85 * (1 - k * 0.6);
      if (k >= 1) { this.scene.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); }
    }
  }

  clear() {
    for (const p of this.list) { p.m.visible = false; this.free.push(p.m); }
    this.list = [];
    for (const r of this.rings) { this.scene.remove(r.m); r.m.material.dispose(); }
    this.rings = [];
  }
}
