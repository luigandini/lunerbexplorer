// Mundo 4 — Torre do Alquimista: engrenagens que giram, frascos que estouram, robôs-ferrugem,
// Golem de Engrenagens, Morgrave em 3 etapas e o GOLPE FINAL dos três amigos.
// Estes métodos entram na classe Game (veja o fim de game.js).
import * as THREE from '../vendor/three.module.min.js';
import { buildGolem, buildMorgrave } from './models.js';
import { material, applyRim } from './geo.js';
import { sfx, playMusic } from './audio.js';

const P_R = 0.3;
const BEAMGEO = new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(Math.PI / 2);
const POTION = new THREE.SphereGeometry(0.13, 10, 8);
const HERO_BEAM = { lunerb: 0x9a4bff, feligon: 0x7dff6a, dait: 0x2ee6ff, lucas: 0xffffff };

function turnTo(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}

export const Mundo4 = {
  // ---------------- todo quadro, nas fases do Mundo 4 ----------------
  updateMundo4(dt) {
    this.updateGears(dt);
    this.updateFrascos(dt);
  },

  // engrenagens do chão: giram e empurram quem está em cima
  updateGears(dt) {
    const room = this.room, gears = room.vis.gears;
    if (!gears || !gears.length) return;
    gears.forEach((q, i) => { q.g.rotation.y += dt * (i % 2 ? -1.6 : 1.6); });
    const p = this.player;
    if (p.dead || p.dash > 0) return;
    if (this.tileAt(p.x, p.z) !== 'y') return;
    const tx = Math.floor(p.x - room.off.x), tz = Math.floor(p.z - room.off.z);
    const i = gears.findIndex((q) => q.tx === tx && q.ty === tz);
    const dir = i % 2 ? -1 : 1;
    const cx = room.off.x + tx + 0.5, cz = room.off.z + tz + 0.5;
    // empurra girando em volta do centro da engrenagem (e um pouco para fora)
    let ox = p.x - cx, oz = p.z - cz;
    const d = Math.hypot(ox, oz) || 0.01;
    ox /= d; oz /= d;
    const sp = 2.8;
    this.move(p, (-oz * dir + ox * 0.35) * sp * dt, (ox * dir + oz * 0.35) * sp * dt, P_R, 'player');
    if (!this.tips.gear) { this.tips.gear = true; this.ui.toast('As engrenagens giram e empurram! Use o Turbo para atravessar.', 2200); }
  },

  // frasco saltitante: chega perto, acende o pavio e estoura
  updateFrascos(dt) {
    const p = this.player;
    for (const e of this.room.enemies) {
      if (!e.alive || e.type !== 'frasco') continue;
      if (e.fuse == null) {
        if (!p.dead && Math.hypot(p.x - e.x, p.z - e.z) < 1.15) { e.fuse = 0.6; e.rootT = Math.max(e.rootT || 0, 0.6); sfx('pavio'); }
      } else {
        e.fuse -= dt;
        if (Math.random() < 0.5) this.fx.sparks(e.x, 0.8, e.z, 0xff9ad0, 1);
        if (e.fuse <= 0) this.popFrasco(e, 1.45);
      }
    }
  },

  popFrasco(e, radius = 1.0) {
    if (e.popped) return;
    e.popped = true;
    this.fx.ring(e.x, e.z, radius, 0.3, 0xd06aff);
    for (let i = 0; i < 14; i++) this.fx.spawn(e.x, 0.4, e.z, { color: Math.random() < 0.5 ? 0xd06aff : 0xffffff, size: 0.12, vx: (Math.random() - 0.5) * 5, vy: 2.5, vz: (Math.random() - 0.5) * 5, life: 0.6, gravity: 9, emissive: 1 });
    sfx('vidro');
    const p = this.player, d = Math.hypot(p.x - e.x, p.z - e.z);
    if (d < radius && !p.dead) this.hurtPlayer(1, (p.x - e.x) / (d || 1), (p.z - e.z) / (d || 1), false, 9);
    for (const o of this.room.enemies) if (o !== e && o.alive && Math.hypot(o.x - e.x, o.z - e.z) < radius) this.damage(o, 2, 0, 0);
    if (e.alive) this.kill(e);
  },

  animateMundo4Enemy(e) {
    const r = e.m.root;
    if (e.type === 'frasco') {
      r.position.y = e.moving ? Math.abs(Math.sin(this.time * 9 + e.x)) * 0.25 : 0;
      const k = e.fuse != null ? 1 + Math.sin(this.time * 40) * 0.12 : 1;
      e.m.body.scale.set(k, k, k);
    } else if (e.type === 'clone') {
      r.position.y = 0.15 + Math.sin(this.time * 2 + e.x) * 0.08;
      const p = this.player;
      e.face = Math.atan2(p.x - e.x, p.z - e.z);
      r.rotation.y = e.face;
    }
  },

  // ---------------- poções e chuva de lodo (caem num círculo de aviso) ----------------
  lob(fx, fz, tx, tz, dur = 0.9, sky = false, color = 0xd06aff) {
    const g = new THREE.Mesh(POTION, material(color, 'glow'));
    this.scene.add(g);
    const ring = this.fx.ring(tx, tz, 0.95, dur, sky ? 0x7dff3a : 0xff5aa0);
    this.lobs.push({ fx, fz, tx, tz, t: 0, dur, sky, g, ring, color });
  },

  updateLobs(dt) {
    if (!this.lobs) return;
    const p = this.player;
    for (let i = this.lobs.length - 1; i >= 0; i--) {
      const l = this.lobs[i];
      l.t += dt;
      const k = Math.min(1, l.t / l.dur);
      if (l.sky) l.g.position.set(l.tx, 7 * (1 - k) + 0.2, l.tz);
      else l.g.position.set(l.fx + (l.tx - l.fx) * k, 1.2 + Math.sin(k * Math.PI) * 2.4 - k, l.fz + (l.tz - l.fz) * k);
      l.g.rotation.x += dt * 9;
      if (k < 1) continue;
      this.scene.remove(l.g);
      this.lobs.splice(i, 1);
      for (let j = 0; j < 10; j++) this.fx.spawn(l.tx, 0.2, l.tz, { color: l.color, size: 0.13, vx: (Math.random() - 0.5) * 4, vy: 2.5, vz: (Math.random() - 0.5) * 4, life: 0.6, gravity: 9, emissive: 1 });
      sfx(l.sky ? 'bolha' : 'vidro');
      const d = Math.hypot(p.x - l.tx, p.z - l.tz);
      if (d < 0.95 && p.dash <= 0) this.hurtPlayer(1, (p.x - l.tx) / (d || 1), (p.z - l.tz) / (d || 1), false, 8);
    }
  },

  clearLobs() {
    for (const l of this.lobs || []) this.scene && this.scene.remove(l.g);
    this.lobs = [];
  },

  // ---------------- chefes ----------------
  makeBossM4(type) {
    if (type === 'golem') return buildGolem();
    return buildMorgrave();
  },

  initBossM4(b) {
    if (b.type === 'morgrave') { b.stage = 1; b.tp = 3.5; b.atk = 1.6; b.cloneT = 0; b.giantK = 0; b.baseScale = b.scale; }
    if (b.type === 'golem') { b.spin = 0; }
  },

  updateBossM4(b, dt, dx, dz, dist) {
    if (b.type === 'golem') return this.updateGolem(b, dt, dx, dz, dist);
    return this.updateMorgrave(b, dt, dx, dz, dist);
  },

  spawnRobos(n) {
    const b = this.room.boss;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      let x = b.x + Math.cos(a) * 3, z = b.z + Math.sin(a) * 3;
      if (this.solidLocal(Math.floor(x - this.room.off.x), Math.floor(z - this.room.off.z), 'enemy')) { x = b.hx; z = b.hz; }
      const e = this.makeEnemy('robo', x, z, false);
      e.awake = true; e.m.root.visible = true;
      this.room.enemies.push(e);
      this.fx.smoke(x, z, 0.8);
    }
  },

  // Golem de Engrenagens: pisão com onda, giro com os braços, joga engrenagens; sem as placas, superaquece
  updateGolem(b, dt, dx, dz, dist) {
    const broken = b.armor <= 0;
    const after = () => {
      b.t = 0;
      if (broken) {
        b.state = 'quente';
        sfx('vapor');
        if (!this.tips.hot) { this.tips.hot = true; this.ui.toast('Ele superaqueceu! Ataque agora!', 1500); }
      } else b.state = 'perseguir';
    };
    switch (b.state) {
      case 'perseguir':
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 4);
        this.move(b, (dx / (dist || 1)) * (broken ? 1.6 : 1.2) * this.difficulty * dt, (dz / (dist || 1)) * (broken ? 1.6 : 1.2) * this.difficulty * dt, b.r, 'enemy');
        b.moving = true;
        if (b.t > (broken ? 1.4 : 1.9)) {
          b.t = 0; b.cycle++; b.moving = false;
          const k = b.cycle % 3;
          b.state = k === 0 ? 'jogar' : k === 1 ? 'erguer' : 'giro';
          sfx('golem');
          if (b.state === 'giro') sfx('vapor');
        }
        break;
      case 'erguer':
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 6);
        if (b.t > 0.6) { b.state = 'pisao'; b.t = 0; sfx('pancada'); this.shake = 0.55; b.ring = this.fx.ring(b.x, b.z, 5.5, 0.8, 0xffb03a); }
        break;
      case 'pisao':
        if (b.ring && Math.abs(dist - b.ring.r) < 0.45 && b.ring.t < b.ring.dur) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1));
        if (b.t > 0.85) { b.ring = null; after(); }
        break;
      case 'giro':
        b.spin += dt * 14;
        this.move(b, (dx / (dist || 1)) * 2.1 * this.difficulty * dt, (dz / (dist || 1)) * 2.1 * this.difficulty * dt, b.r, 'enemy');
        b.moving = true;
        if (Math.random() < 0.3) this.fx.spawn(b.x, 1, b.z, { color: 0xdddddd, size: 0.2, vy: 1, life: 0.5 });
        if (dist < 1.9) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1), false, 11);
        if (b.t > 2.2) { b.moving = false; after(); }
        break;
      case 'jogar':
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 10);
        if (b.t > 0.45) {
          const base = Math.atan2(dx, dz);
          for (const off of broken ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.3, 0, 0.3]) this.spawnEShot(b.x, b.z, Math.sin(base + off), Math.cos(base + off), 'engrenagem', 7);
          sfx('lancar');
          after();
        }
        break;
      case 'quente':
        b.moving = false;
        if (Math.random() < 0.5) this.fx.spawn(b.x + (Math.random() - 0.5), 2.4, b.z + (Math.random() - 0.5), { color: 0xffffff, size: 0.25, vy: 1.6, life: 0.7 });
        if (b.t > 1.6) { b.state = 'perseguir'; b.t = 0; }
        break;
      default: b.state = 'perseguir';
    }
    if (dist < b.r + P_R && b.state !== 'quente') this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1), false, 11);
    this.updateArenaItem(dt);
    this.ui.bossBar(b.name, b.armor / b.maxArmor, b.hp / b.maxHp);
  },

  // ---------------- Morgrave: poções → clones → gigante ----------------
  morgraveDamage(b, dmg) {
    if (b.state === 'final') return;
    b.hit = 0.15;
    b.hp -= dmg;
    this.fx.sparks(b.x, 1.2, b.z, 0x9dff3a, 5);
    sfx('acerto');
    if (b.hp <= 0) { b.hp = 0; this.startGolpeFinal(b); }
  },

  freeSpotAway(minD = 3.5) {
    const room = this.room, p = this.player;
    for (let k = 0; k < 40; k++) {
      const tx = 1 + Math.floor(Math.random() * (room.w - 2)), tz = 1 + Math.floor(Math.random() * (room.h - 2));
      if (this.solidLocal(tx, tz, 'enemy') || this.tiles[tz][tx] === 'L') continue;
      const x = room.off.x + tx + 0.5, z = room.off.z + tz + 0.5;
      if (Math.hypot(x - p.x, z - p.z) < minD) continue;
      return { x, z };
    }
    return { x: this.room.boss.hx, z: this.room.boss.hz };
  },

  teleportMorgrave(b) {
    this.fx.smoke(b.x, b.z, 1.2);
    const clones = this.room.enemies.filter((e) => e.alive && e.type === 'clone');
    if (clones.length && Math.random() < 0.6) {
      // troca de lugar com um clone para confundir
      const c = clones[Math.floor(Math.random() * clones.length)];
      const ox = b.x, oz = b.z;
      b.x = c.x; b.z = c.z; c.x = ox; c.z = oz;
      this.fx.smoke(c.x, c.z, 0.8);
    } else {
      const s = this.freeSpotAway();
      b.x = s.x; b.z = s.z;
    }
    this.fx.smoke(b.x, b.z, 1.2);
    sfx('teleporte');
  },

  spawnClones(n) {
    for (let i = 0; i < n; i++) {
      const s = this.freeSpotAway(3);
      const e = this.makeEnemy('clone', s.x, s.z, false);
      e.awake = true; e.m.root.visible = true; e.cd = 1.5 + Math.random() * 1.5;
      this.room.enemies.push(e);
      this.fx.smoke(s.x, s.z, 1);
    }
  },

  updateMorgrave(b, dt, dx, dz, dist) {
    const p = this.player;
    if (b.stage === 1 && b.hp <= 60) {
      b.stage = 2; b.t = 0;
      this.shake = 0.5;
      sfx('morgrave');
      this.ui.bigText('Morgrave se dividiu!', 1600);
      this.ui.toast('Ache o verdadeiro: só o cajado dele BRILHA!', 2600);
      this.spawnClones(3);
      this.teleportMorgrave(b);
      b.cloneT = 7;
    } else if (b.stage === 2 && b.hp <= 30) {
      b.stage = 3; b.t = 0; b.state = 'perseguir';
      for (const e of this.room.enemies) if (e.alive && e.type === 'clone') { e.alive = false; e.m.root.visible = false; this.fx.smoke(e.x, e.z, 1); }
      this.shake = 0.8;
      sfx('golem');
      this.ui.flash('green');
      this.name0 = b.name;
      b.name = 'MORGRAVE GIGANTE';
      this.ui.bigText('MORGRAVE GIGANTE!', 1800, 'boss');
      this.ui.toast('Ele bebeu a última poção! Cuidado com a chuva de lodo!', 2600);
    }
    if (b.stage < 3) {
      // fica longe e joga poções; some e aparece em outro lugar
      b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 6);
      const want = dist < 3.2 ? -1 : dist > 6 ? 1 : 0;
      if (want) this.move(b, (dx / (dist || 1)) * want * 1.4 * dt, (dz / (dist || 1)) * want * 1.4 * dt, b.r, 'enemy');
      b.tp -= dt;
      if (b.tp <= 0) { this.teleportMorgrave(b); b.tp = b.stage === 1 ? 4.2 : 3.2; }
      b.atk -= dt * this.difficulty;
      if (b.atk <= 0) {
        b.atk = b.stage === 1 ? 2.5 : 3.0;
        b.armT = 0.5;
        const offs = b.stage === 1 ? [[0, 0], [1.3, 0.6], [-1.1, -0.9]] : [[0, 0], [1.2, -0.8]];
        for (const [ox, oz] of offs) this.lob(b.x, b.z, p.x + ox + (p.moving ? Math.sin(p.face) * 0.8 : 0), p.z + oz + (p.moving ? Math.cos(p.face) * 0.8 : 0), 0.95);
        sfx('lancar');
        if (Math.random() < 0.35) sfx('morgrave');
      }
      if (b.stage === 2) {
        for (const e of this.room.enemies) {
          if (!e.alive || e.type !== 'clone') continue;
          e.cd -= dt;
          if (e.cd <= 0) {
            e.cd = 2.6 + Math.random() * 1.4;
            const ddx = p.x - e.x, ddz = p.z - e.z, d = Math.hypot(ddx, ddz) || 1;
            this.spawnEShot(e.x, e.z, ddx / d, ddz / d, 'lodo', 5.5);
          }
        }
        b.cloneT -= dt;
        if (b.cloneT <= 0 && this.room.enemies.filter((e) => e.alive && e.type === 'clone').length < 2) { this.spawnClones(2); b.cloneT = 7; sfx('teleporte'); }
      }
    } else {
      // gigante: anda devagar, chuva de lodo, pancada e bolhas
      b.giantK = Math.min(1, b.giantK + dt * 0.7);
      b.scale = b.baseScale * (1 + 0.9 * b.giantK);
      b.r = 0.6 + 0.55 * b.giantK;
      switch (b.state) {
        case 'perseguir':
          b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 4);
          this.move(b, (dx / (dist || 1)) * 1.1 * this.difficulty * dt, (dz / (dist || 1)) * 1.1 * this.difficulty * dt, b.r, 'enemy');
          b.moving = true;
          if (b.t > 1.7) {
            b.t = 0; b.cycle++; b.moving = false;
            const k = b.cycle % 3;
            const enemies = this.room.enemies.filter((e) => e.alive).length;
            b.state = k === 0 ? 'chuva' : k === 1 ? 'erguer' : enemies < 3 ? 'bolhas' : 'chuva';
            sfx('morgrave');
          }
          break;
        case 'chuva':
          if (b.t > 0.3 && !b.rained) {
            b.rained = true;
            b.armT = 0.6;
            for (let i = 0; i < 6; i++) {
              const a = Math.random() * Math.PI * 2, rr = i === 0 ? 0 : 1 + Math.random() * 2.2;
              this.lob(0, 0, p.x + Math.cos(a) * rr, p.z + Math.sin(a) * rr, 1.0 + i * 0.12, true, 0x5cdf3a);
            }
          }
          if (b.t > 1.4) { b.rained = false; b.state = 'perseguir'; b.t = 0; }
          break;
        case 'erguer':
          b.armT = 0.6;
          if (b.t > 0.6) { b.state = 'pancada'; b.t = 0; sfx('pancada'); this.shake = 0.6; b.ring = this.fx.ring(b.x, b.z, 6, 0.85, 0x7dff3a); }
          break;
        case 'pancada':
          if (b.ring && Math.abs(dist - b.ring.r) < 0.45 && b.ring.t < b.ring.dur) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1));
          if (b.t > 0.9) { b.ring = null; b.state = 'perseguir'; b.t = 0; }
          break;
        case 'bolhas':
          if (b.t > 0.5) {
            for (let i = 0; i < 2; i++) {
              const s = this.freeSpotAway(2.5);
              const e = this.makeEnemy('bolha', s.x, s.z, false);
              e.awake = true; e.m.root.visible = true;
              this.room.enemies.push(e);
              this.fx.smoke(s.x, s.z, 0.8);
            }
            b.state = 'perseguir'; b.t = 0;
          }
          break;
        default: b.state = 'perseguir';
      }
      if (Math.random() < 0.2) this.fx.spawn(b.x + (Math.random() - 0.5) * 1.5, 0.3, b.z + (Math.random() - 0.5) * 1.5, { color: 0x7dff3a, size: 0.14, vy: 1.2, life: 0.6, emissive: 1 });
    }
    b.armT = Math.max(0, (b.armT || 0) - dt);
    if (dist < b.r + P_R) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1), false, 11);
    this.updateArenaItem(dt);
    this.ui.bossBar(b.name, 0, b.hp / b.maxHp);
  },

  animateBossM4(b) {
    const r = b.m.root;
    if (b.type === 'golem') {
      r.position.set(b.x, 0, b.z);
      r.rotation.y = b.state === 'giro' ? b.spin : b.face;
      r.scale.setScalar(b.scale * (b.hit > 0 ? 1.05 : 1));
      const w = b.moving && b.state !== 'giro' ? Math.sin(this.time * 6) * 0.45 : 0;
      b.m.legs[0].rotation.x = w; b.m.legs[1].rotation.x = -w;
      const arms = b.m.arms;
      if (b.state === 'giro') { arms[0].rotation.set(0, 0, -1.45); arms[1].rotation.set(0, 0, 1.45); }
      else if (b.state === 'erguer') { arms[0].rotation.set(-2.8, 0, 0); arms[1].rotation.set(-2.8, 0, 0); }
      else if (b.state === 'pisao') { arms[0].rotation.set(-0.5, 0, 0); arms[1].rotation.set(-0.5, 0, 0); }
      else if (b.state === 'jogar') { arms[0].rotation.set(-1.6, 0, 0); arms[1].rotation.set(0.2, 0, 0); }
      else { arms[0].rotation.set(-w * 0.6, 0, 0); arms[1].rotation.set(w * 0.6, 0, 0); }
      b.m.core.rotation.z += 0.08 * (b.state === 'quente' ? 3 : 1);
      b.m.core.scale.setScalar(b.state === 'quente' ? 1.3 + Math.sin(this.time * 20) * 0.15 : 1);
      r.rotation.z = b.state === 'quente' ? Math.sin(this.time * 25) * 0.02 : 0;
      return;
    }
    // Morgrave
    const giant = b.stage === 3;
    r.position.set(b.x, giant ? 0 : 0.2 + Math.sin(this.time * 2) * 0.1, b.z);
    r.rotation.y = b.face;
    r.scale.setScalar(b.scale * (b.hit > 0 ? 1.06 : 1));
    const up = (b.armT || 0) > 0 || b.state === 'erguer';
    b.m.arms[0].rotation.x = up ? -2.6 : Math.sin(this.time * 2) * 0.15;
    b.m.arms[1].rotation.x = up ? -2.2 : -0.4;
    if (b.state === 'final') r.rotation.z = Math.sin(this.time * 30) * 0.05;
  },

  // ---------------- GOLPE FINAL: os três amigos juntos ----------------
  startGolpeFinal(b) {
    b.state = 'final';
    this.ui.bossBar(null);
    for (const e of this.room.enemies) if (e.alive) { e.alive = false; e.m.root.visible = false; if (e.m.glow) e.m.glow.visible = false; this.fx.smoke(e.x, e.z, 0.8); }
    this.clearLobs();
    for (const s of this.eshots) this.scene.remove(s.g);
    this.eshots = [];
    this.stopBeam();
    this.cancelAim();
    for (const h of this.heroes) { if (h.fainted) { h.fainted = false; h.hp = Math.max(h.hp, 3); } h.dead = false; h.cmd = null; }
    this.cine = { kind: 'golpe', t: 0, phase: 'espera' };
    this.input.reset();
    playMusic('final');
    sfx('morgrave');
    this.shake = 0.6;
    this.ui.bigText('GOLPE FINAL!', 2200, 'boss');
    setTimeout(() => this.running && this.cine && this.cine.kind === 'golpe' && this.cine.phase === 'espera' && this.ui.toast(this.heroes.length > 1 ? 'Toque no botão verde 🌿 (ou ATACAR): os três juntos!' : 'Toque em ATACAR para o golpe final!', 4000), 900);
  },

  updateGolpe(dt) {
    const c = this.cine, b = this.room.boss, p = this.player;
    this.viewTarget = this.focusView(b.x, b.z, 4.6);
    b.face = turnTo(b.face, Math.atan2(p.x - b.x, p.z - b.z), dt * 3);
    const n = this.heroes.length;
    const spots = this.heroes.map((h, i) => {
      const a = Math.atan2(p.x - b.x, p.z - b.z) + (i === this.heroes.indexOf(p) ? 0 : (i % 2 ? 0.9 : -0.9) * Math.ceil(i / 2));
      return { x: b.x + Math.sin(a) * 2.7, z: b.z + Math.cos(a) * 2.7 };
    });
    if (c.phase === 'espera' || c.phase === 'raios') {
      this.heroes.forEach((h, i) => {
        const s = spots[i];
        const k = Math.min(1, dt * 3);
        const ox = h.x, oz = h.z;
        h.x += (s.x - h.x) * k; h.z += (s.z - h.z) * k;
        h.moving = Math.hypot(h.x - ox, h.z - oz) > dt * 0.3;
        h.face = Math.atan2(b.x - h.x, b.z - h.z);
        if (h === p) { p.aimT = 0.3; }
      });
    }
    if (c.phase === 'espera') {
      if (c.t > 1.3 && (this.input.specialPressed || this.input.attackPressed || this.input.special || this.input.attack || c.t > 8)) {
        c.phase = 'raios'; c.t2 = 0;
        sfx('golpe');
        c.beams = this.heroes.map((h) => {
          const col = HERO_BEAM[h.id] || 0xffffff;
          const g = new THREE.Group();
          const outer = new THREE.Mesh(BEAMGEO, material(col, 'glow', 0.75));
          const core = new THREE.Mesh(BEAMGEO, material(0xffffff, 'glow'));
          g.add(outer); g.add(core);
          this.scene.add(g);
          return { h, g, outer, core };
        });
        this.ui.toast(this.heroes.map((h) => ({ lunerb: '⚡ Raio Negro', feligon: '🌿 Raízes', dait: '❄️ Pulso Ciano' }[h.id] || '')).filter(Boolean).join(' + ') + '!', 2000);
      }
    } else if (c.phase === 'raios') {
      c.t2 += dt;
      const grow = Math.min(1, c.t2 / 0.6);
      for (const bm of c.beams) {
        const h = bm.h;
        const dx = b.x - h.x, dz = b.z - h.z, len = Math.hypot(dx, dz) * grow;
        bm.g.position.set(h.x + dx * grow / 2, 1, h.z + dz * grow / 2);
        bm.g.rotation.y = Math.atan2(dx, dz);
        const th = 0.12 + c.t2 * 0.06 + Math.sin(this.time * 30) * 0.02;
        bm.outer.scale.set(th, th, len); bm.core.scale.set(th * 0.4, th * 0.4, len);
      }
      this.shake = Math.max(this.shake, 0.35);
      if (Math.random() < 0.8) this.fx.sparks(b.x, 1.2, b.z, [0x9a4bff, 0x7dff6a, 0x2ee6ff][Math.floor(Math.random() * 3)], 3);
      if (c.t2 > 2.4) {
        c.phase = 'puro'; c.t3 = 0;
        for (const bm of c.beams) this.scene.remove(bm.g);
        c.beams = [];
        this.ui.flash('white');
        sfx('superboom');
        setTimeout(() => sfx('purifica'), 500);
        this.shake = 1;
        this.fx.ring(b.x, b.z, 8, 1.2, 0xffffff);
        for (let i = 0; i < 40; i++) this.fx.spawn(b.x, 1, b.z, { color: Math.random() < 0.5 ? 0xffffff : 0x7ac8ff, size: 0.16, vx: (Math.random() - 0.5) * 8, vy: 3 + Math.random() * 3, vz: (Math.random() - 0.5) * 8, life: 1.2, gravity: 4, emissive: 1 });
        // o lodo vira água limpa e o Morgrave volta a ser um velhinho
        this.purified = true;
        b.m.root.visible = false;
        if (b.m.glow) b.m.glow.visible = false;
        const good = buildMorgrave({ good: true });
        good.root.scale.setScalar(1.6);
        good.root.position.set(b.x, 0, b.z);
        good.root.rotation.y = b.face;
        applyRim(good.root, 0xbfe8ff, 0.8);
        this.scene.add(good.root);
        this.goodMorgrave = good;
      }
    } else if (c.phase === 'puro') {
      c.t3 += dt;
      if (this.goodMorgrave) this.goodMorgrave.root.rotation.z = c.t3 < 1 ? Math.sin(this.time * 12) * 0.05 * (1 - c.t3) : 0;
      if (c.t3 > 1.6 && !c.talked) {
        c.talked = true;
        this.ui.dialog([
          { who: 'Morgrave', text: 'Onde... onde eu estou? Que dor de cabeça...' },
          { who: 'Dait', text: 'Mestre Morgrave? Você voltou ao normal!' },
          { who: 'Morgrave', text: 'O lodo... ele tomou conta de mim. Eu só queria fazer remédios, e virei um monstro.' },
          { who: 'Morgrave', text: 'Me desculpem, crianças. Vou limpar cada rio, eu prometo.' },
          { who: 'Feligon', text: 'O bosque vai ficar verde de novo!' },
          { who: 'Lunerb', text: 'E eu... finalmente posso voltar pra casa!' },
        ], () => this.finishMorgrave());
      }
    }
  },

  finishMorgrave() {
    const b = this.room.boss;
    this.cine = null;
    b.alive = false;
    this.ui.bossBar(null);
    this.setGateLocked(this.room.vis.exit, false);
    this.gateLight.intensity = 5;
    sfx('porta');
    playMusic('ending');
    this.viewTarget = this.fitRoom(this.room);
    this.ui.toast('O caminho de casa está aberto! Vá até o portal.', 3000);
  },
};
