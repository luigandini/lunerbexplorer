// O jogo em si: Lunerb, monstros, tiros, baús, fogueiras e o Capitão de Ferro.
import * as THREE from '../vendor/three.module.min.js';
import { parseLevel, getLevel, SOLID } from './levels.js';
import { buildWorld } from './world.js';
import { buildLunerb, buildZumbi, buildAranha, buildMorcego, buildCristal, buildCoracao, mat } from './models.js';
import { FX } from './fx.js';
import { sfx, playMusic } from './audio.js';
import { weaponStats } from './progress.js';

const MAX_HP = 5;
const P_SPEED = 4.2;
const P_R = 0.3;
const SQ2 = Math.SQRT1_2;
const BOX = new THREE.BoxGeometry(1, 1, 1);

const EDEF = {
  zumbi: { hp: 3, armor: 0, speed: 1.5, r: 0.32, aggro: 7, drop: 1, build: () => buildZumbi() },
  armadura: { hp: 3, armor: 3, speed: 1.15, r: 0.34, aggro: 7, drop: 3, build: () => buildZumbi({ armor: true }) },
  aranha: { hp: 2, armor: 0, speed: 3.0, r: 0.3, aggro: 6, drop: 1, hop: true, build: buildAranha },
  morcego: { hp: 2, armor: 0, speed: 2.4, r: 0.28, aggro: 7, drop: 1, fly: true, build: buildMorcego },
};

export class Game {
  constructor({ renderer, ui, input }) {
    this.renderer = renderer;
    this.ui = ui;
    this.input = input;
    this.scene = null;
    this.running = false;
    this.paused = false;
    this.viewH = 10;
    this.camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 200);
    this.camOffset = new THREE.Vector3(1, 1.3, 1).normalize().multiplyScalar(40);
    this.camTarget = new THREE.Vector3();
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const a = w / h;
    const vh = this.viewH * (a < 1.4 ? 1.15 : 1);
    this.camera.left = (-vh * a) / 2; this.camera.right = (vh * a) / 2;
    this.camera.top = vh / 2; this.camera.bottom = -vh / 2;
    this.camera.updateProjectionMatrix();
  }

  // ---------------- iniciar fase ----------------
  start(levelId, save, { testMode = false, onComplete, onQuit } = {}) {
    this.dispose();
    const def = getLevel(levelId);
    this.def = def;
    this.save = save;
    this.testMode = testMode;
    this.onComplete = onComplete;
    this.onQuit = onQuit;
    this.stats = weaponStats(save);
    const parsed = parseLevel(def);
    this.map = parsed;
    this.tiles = parsed.tiles.map((r) => r.slice());

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07060b);
    this.scene = scene;
    const dark = def.darkness;
    scene.add(new THREE.AmbientLight(0x9a8fbf, 2.3 - dark * 1.5));
    scene.add(new THREE.HemisphereLight(0x7080b0, 0x302018, 0.9));
    const moon = new THREE.DirectionalLight(0xa0b0ff, 0.5);
    moon.position.set(-3, 8, 2);
    scene.add(moon);

    this.world = buildWorld(parsed, scene, levelId);
    this.fx = new FX(scene);

    this.playerLight = new THREE.PointLight(0xffcf9a, 8, 12, 1.2);
    scene.add(this.playerLight);
    this.torchLights = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xff8a30, 0, 8, 1.4);
      scene.add(l);
      this.torchLights.push(l);
    }
    this.exitLight = new THREE.PointLight(0x7dff9a, 0, 7, 1.4);
    if (this.world.exit) this.exitLight.position.set(this.world.exit.x, 1.5, this.world.exit.z);
    scene.add(this.exitLight);

    // Lunerb
    const model = buildLunerb();
    model.root.scale.setScalar(1.2);
    scene.add(model.root);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02;
    scene.add(shadow);
    this.player = {
      x: parsed.start.x + 0.5, z: parsed.start.y + 0.5, face: Math.PI * 0.75,
      hp: MAX_HP, inv: 0, kvx: 0, kvz: 0, model, shadow,
      weapons: save.weapons, atkCd: 0, charge: 0, charging: false, aimT: 0, meleeT: 0, meleeSide: 0,
      dash: 0, dashDx: 0, dashDz: 0, dashHit: new Set(), turbo: 1, walkT: 0, moving: false,
      safeX: 0, safeZ: 0, dead: false,
    };
    this.player.safeX = this.player.x; this.player.safeZ = this.player.z;
    this.respawn = { x: this.player.x, z: this.player.z };
    this.updateGuns();

    // monstros
    this.enemies = parsed.enemies.map((e) => this.makeEnemy(e.type, e.x + 0.5, e.y + 0.5));
    this.boss = parsed.boss ? this.makeBoss(parsed.boss.x + 0.5, parsed.boss.y + 0.5) : null;
    if (this.world.exit) this.setExitLocked(!!this.boss);

    this.shots = [];
    this.pickups = [];
    this.lasers = [];
    this.result = { finished: false, damageTaken: 0, secretFound: false, crystals: 0 };
    this.time = 0;
    this.shake = 0;
    this.frozen = false;
    this.cine = null;
    this.ended = false;
    this.tips = { move: false, attack: false, turbo: false, gun: false };
    this.lightTimer = 0;
    this.camTarget.set(this.player.x, 0, this.player.z);
    this.viewH = 10; this.resize();
    this.running = true;
    this.paused = false;

    playMusic(def.music);
    this.ui.titleCard(`MUNDO ${def.world} · FASE ${def.id}`, def.title);
    this.frozen = true;
    setTimeout(() => {
      if (!this.running) return;
      this.ui.dialog(def.intro, () => {
        this.frozen = false;
        this.ui.toast('Arraste no lado esquerdo para andar');
      });
    }, 1900);
    this.hud(true);
  }

  dispose() {
    this.running = false;
    if (this.scene) {
      this.scene.traverse((o) => { if (o.geometry && o.geometry !== BOX && o.geometry.dispose) o.geometry.dispose(); });
    }
    this.scene = null;
    this.ui.bossBar(null);
  }

  makeEnemy(type, x, z) {
    const d = EDEF[type];
    const m = d.build();
    this.scene.add(m.root);
    m.root.position.set(x, 0, z);
    return {
      type, x, z, hp: d.hp, armor: d.armor, def: d, m, alive: true, awake: false,
      t: Math.random() * 3, wx: 0, wz: 0, kvx: 0, kvz: 0, face: Math.random() * 6, hit: 0, r: d.r,
    };
  }

  makeBoss(x, z) {
    const m = buildZumbi({ armor: true, scale: 2.1, boss: true });
    this.scene.add(m.root);
    m.root.position.set(x, 0, z);
    return {
      type: 'capitao', x, z, hx: x, hz: z, hp: 22, maxHp: 22, armor: 18, maxArmor: 18, m, alive: true,
      state: 'dormindo', t: 0, cycle: 0, r: 0.75, kvx: 0, kvz: 0, face: Math.PI, hit: 0, chargeDx: 0, chargeDz: 0,
      spawnT: 0, hordeDone: false, ring: null,
    };
  }

  updateGuns() {
    const p = this.player;
    p.model.guns[1].visible = p.weapons >= 1; // mão direita
    p.model.guns[0].visible = p.weapons >= 2; // mão esquerda
  }

  setExitLocked(locked) {
    const ex = this.world.exit;
    ex.locked = locked;
    ex.bars.visible = locked;
    ex.glow.visible = !locked;
    this.exitLight.intensity = locked ? 0 : 6;
  }

  // ---------------- colisão ----------------
  tileAt(x, z) {
    const tx = Math.floor(x), tz = Math.floor(z);
    if (tx < 0 || tz < 0 || tx >= this.map.w || tz >= this.map.h) return '#';
    return this.tiles[tz][tx];
  }

  solid(tx, tz, who) {
    if (tx < 0 || tz < 0 || tx >= this.map.w || tz >= this.map.h) return true;
    const t = this.tiles[tz][tx];
    if (SOLID.has(t)) return true;
    if (who === 'enemy' && t === 'L') return true;
    return false;
  }

  move(ent, dx, dz, r, who) {
    // eixo X
    let nx = ent.x + dx;
    const minZ = Math.floor(ent.z - r), maxZ = Math.floor(ent.z + r);
    if (dx !== 0) {
      const edge = Math.floor(nx + Math.sign(dx) * r);
      for (let tz = minZ; tz <= maxZ; tz++) {
        if (this.solid(edge, tz, who)) { nx = dx > 0 ? edge - r - 0.001 : edge + 1 + r + 0.001; break; }
      }
    }
    ent.x = nx;
    let nz = ent.z + dz;
    const minX = Math.floor(ent.x - r), maxX = Math.floor(ent.x + r);
    if (dz !== 0) {
      const edge = Math.floor(nz + Math.sign(dz) * r);
      for (let tx = minX; tx <= maxX; tx++) {
        if (this.solid(tx, edge, who)) { nz = dz > 0 ? edge - r - 0.001 : edge + 1 + r + 0.001; break; }
      }
    }
    ent.z = nz;
    // baús também empurram
    for (const c of this.world.chests) {
      const ddx = ent.x - c.wx, ddz = ent.z - c.wz, d = Math.hypot(ddx, ddz), min = r + 0.35;
      if (d < min && d > 0.0001) { ent.x = c.wx + (ddx / d) * min; ent.z = c.wz + (ddz / d) * min; }
    }
  }

  // ---------------- laço principal ----------------
  update(dt) {
    if (!this.running || this.paused) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const lava = 0.9 + Math.sin(this.time * 3) * 0.12;
    this.world.lavaMat.color.setScalar(lava);

    if (this.cine) this.updateCine(dt);
    if (!this.frozen && !this.cine) {
      this.updatePlayer(dt);
      for (const e of this.enemies) if (e.alive) this.updateEnemy(e, dt);
      if (this.boss && this.boss.alive) this.updateBoss(dt);
      this.updateShots(dt);
      this.updatePickups(dt);
      this.checkTriggers();
    }
    this.animate(dt);
    this.fx.update(dt);
    this.updateLights(dt);
    this.updateCamera(dt);
    this.input.consume();
    this.hud();
  }

  render() {
    if (this.scene) this.renderer.render(this.scene, this.camera);
  }

  // ---------------- Lunerb ----------------
  updatePlayer(dt) {
    const p = this.player;
    if (p.dead) return;
    const inp = this.input;
    const d = inp.dir();
    // tela → mundo (câmera isométrica a 45°)
    let mx = (d.x + d.y) * SQ2;
    let mz = (-d.x + d.y) * SQ2;
    p.moving = mx !== 0 || mz !== 0;
    if (p.moving && !this.tips.move) this.tips.move = true;

    p.inv = Math.max(0, p.inv - dt);
    p.atkCd = Math.max(0, p.atkCd - dt);
    p.aimT = Math.max(0, p.aimT - dt);
    p.meleeT = Math.max(0, p.meleeT - dt);
    p.turbo = Math.min(3, p.turbo + dt * 0.08);

    // Turbo Negro
    if (inp.turboPressed && p.dash <= 0) {
      if (p.turbo >= 1) {
        p.turbo -= 1;
        p.dash = 0.28;
        const len = Math.hypot(mx, mz);
        if (len > 0) { p.dashDx = mx / len; p.dashDz = mz / len; }
        else { p.dashDx = Math.sin(p.face); p.dashDz = Math.cos(p.face); }
        p.dashHit.clear();
        sfx('turbo');
        this.shake = Math.max(this.shake, 0.15);
      } else {
        this.ui.toast('Turbo Negro carregando...');
      }
    }

    let speed = P_SPEED;
    const tile = this.tileAt(p.x, p.z);
    if (tile === 'W' && p.dash <= 0) speed *= 0.45;

    if (p.dash > 0) {
      p.dash -= dt;
      this.move(p, p.dashDx * 16 * dt, p.dashDz * 16 * dt, P_R, 'player');
      p.face = Math.atan2(p.dashDx, p.dashDz);
      for (let i = 0; i < 3; i++) this.fx.lightning(p.x, p.z);
      for (const e of this.targets()) {
        if (!p.dashHit.has(e) && Math.hypot(e.x - p.x, e.z - p.z) < e.r + 0.6) {
          p.dashHit.add(e);
          this.damage(e, 3, p.dashDx, p.dashDz);
        }
      }
    } else {
      this.move(p, (mx * speed + p.kvx) * dt, (mz * speed + p.kvz) * dt, P_R, 'player');
      if (p.moving && p.aimT <= 0) p.face = turnTo(p.face, Math.atan2(mx, mz), dt * 14);
    }
    p.kvx *= Math.pow(0.002, dt); p.kvz *= Math.pow(0.002, dt);

    // lava!
    const t2 = this.tileAt(p.x, p.z);
    if (t2 === 'L' && p.dash <= 0) {
      this.hurtPlayer(1, 0, 0, true);
      p.x = p.safeX; p.z = p.safeZ;
      this.fx.sparks(p.x, 0.3, p.z, 0xff7a1a, 10);
    } else if (t2 !== 'L') {
      // guarda a última posição segura um pouco longe da lava
      const near = ['L'].includes(this.tileAt(p.x + 0.45, p.z)) || this.tileAt(p.x - 0.45, p.z) === 'L'
        || this.tileAt(p.x, p.z + 0.45) === 'L' || this.tileAt(p.x, p.z - 0.45) === 'L';
      if (!near) { p.safeX = p.x; p.safeZ = p.z; }
    }

    // ataque
    if (p.weapons >= 2) {
      if (inp.attackPressed) { this.attack(); p.charging = true; p.charge = 0; }
      if (inp.attack && p.charging) {
        const before = p.charge;
        p.charge += dt;
        if (before < this.stats.laserCharge && p.charge >= this.stats.laserCharge) sfx('carga');
        if (p.charge > 0.25) { p.aimT = 0.2; if (Math.random() < 0.5) this.fx.sparks(p.x, 0.7, p.z, 0xff3030, 1); }
      }
      if (inp.attackReleased && p.charging) {
        if (p.charge >= this.stats.laserCharge) this.fireLaser();
        p.charging = false; p.charge = 0;
      }
    } else if (inp.attack && p.atkCd <= 0) {
      this.attack();
    }
  }

  targets() {
    const list = this.enemies.filter((e) => e.alive);
    if (this.boss && this.boss.alive && this.boss.state !== 'dormindo') list.push(this.boss);
    return list;
  }

  nearestTarget(maxD) {
    const p = this.player;
    let best = null, bd = maxD;
    for (const e of this.targets()) {
      const d = Math.hypot(e.x - p.x, e.z - p.z) - (e.r - 0.3);
      if (d < bd) { bd = d; best = e; }
    }
    return { e: best, d: bd };
  }

  attack() {
    const p = this.player;
    const { e, d } = this.nearestTarget(9);
    if (e) p.face = Math.atan2(e.x - p.x, e.z - p.z);
    const fx = Math.sin(p.face), fz = Math.cos(p.face);
    if (!this.tips.attack) this.tips.attack = true;

    if ((e && d < 1.3) || p.weapons === 0) {
      // soco e chute
      p.meleeT = 0.22; p.meleeSide = 1 - p.meleeSide;
      p.atkCd = 0.32;
      sfx('soco');
      let hit = false;
      for (const t of this.targets()) {
        const dx = t.x - p.x, dz = t.z - p.z, dist = Math.hypot(dx, dz);
        if (dist < 1.25 + t.r && (dx * fx + dz * fz) / (dist || 1) > 0.2) { this.damage(t, 2, fx, fz); hit = true; }
      }
      // quebra parede rachada / acende tocha encostada
      this.hitTile(p.x + fx * 0.8, p.z + fz * 0.8, 1, false);
      if (!hit) this.fx.sparks(p.x + fx * 0.6, 0.6, p.z + fz * 0.6, 0xffffff, 2);
      return;
    }
    // bolas de fogo das Booteshiscore
    p.aimT = 0.5;
    p.atkCd = this.stats.fireCooldown;
    sfx('fogo');
    const sideX = fz, sideZ = -fx;
    const offs = p.weapons >= 2 ? [-0.22, 0.22] : [0.2];
    for (const o of offs) {
      this.spawnShot(p.x + fx * 0.5 + sideX * o, p.z + fz * 0.5 + sideZ * o, fx, fz);
    }
  }

  spawnShot(x, z, dx, dz) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(BOX, mat(0xffd23a, 1.6)); core.scale.setScalar(0.16); g.add(core);
    const outer = new THREE.Mesh(BOX, mat(0xff4a10, 1.2)); outer.scale.setScalar(0.26); g.add(outer);
    g.position.set(x, 0.75, z);
    this.scene.add(g);
    this.shots.push({ x, z, dx, dz, speed: 11, life: 1.1, dmg: this.stats.fireDamage, g, outer });
  }

  fireLaser() {
    const p = this.player;
    const { e } = this.nearestTarget(12);
    if (e) p.face = Math.atan2(e.x - p.x, e.z - p.z);
    const fx = Math.sin(p.face), fz = Math.cos(p.face);
    // vai até bater numa parede
    let len = 0;
    while (len < 13) {
      const tx = p.x + fx * (len + 0.1), tz = p.z + fz * (len + 0.1);
      const t = this.tileAt(tx, tz);
      if (SOLID.has(t)) { this.hitTile(tx, tz, 3, true); break; }
      len += 0.1;
    }
    for (const t of this.targets()) {
      const dx = t.x - p.x, dz = t.z - p.z;
      const along = dx * fx + dz * fz;
      const perp = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < len + t.r && perp < 0.45 + t.r) this.damage(t, this.stats.laserDamage, fx, fz);
    }
    const g = new THREE.Group();
    const outer = new THREE.Mesh(BOX, mat(0xff2020, 1.5)); outer.scale.set(0.32, 0.32, len); g.add(outer);
    const core = new THREE.Mesh(BOX, mat(0xffffff, 1.5)); core.scale.set(0.12, 0.12, len); g.add(core);
    g.position.set(p.x + fx * len / 2, 0.75, p.z + fz * len / 2);
    g.rotation.y = p.face;
    this.scene.add(g);
    this.lasers.push({ g, life: 0.3 });
    p.aimT = 0.5;
    sfx('laser');
    this.shake = Math.max(this.shake, 0.25);
  }

  // ataque acertou um bloco: tocha acende, parede rachada quebra
  hitTile(x, z, power, fromFire) {
    const tx = Math.floor(x), tz = Math.floor(z);
    if (tx < 0 || tz < 0 || tx >= this.map.w || tz >= this.map.h) return false;
    const t = this.tiles[tz][tx];
    if (t === 'T' && fromFire) {
      const torch = this.world.torches.find((o) => o.tx === tx && o.ty === tz);
      if (torch && !torch.lit) {
        torch.lit = true; torch.flame.visible = true;
        sfx('tocha');
        this.fx.sparks(torch.x, 1.1, torch.z, 0xff9a30, 10);
        this.lightTimer = 0;
      }
      return true;
    }
    if (t === 'Q') {
      const c = this.world.cracks.find((o) => o.tx === tx && o.ty === tz);
      if (c && !c.broken) {
        c.hp -= power;
        this.fx.sparks(tx + 0.5, 0.7, tz + 0.5, 0xaaaaaa, 5);
        sfx('acerto');
        if (c.hp <= 0) {
          c.broken = true;
          c.group.visible = false;
          this.tiles[tz][tx] = '.';
          this.fx.smoke(tx + 0.5, tz + 0.5, 1.4);
          sfx('quebra');
          this.ui.toast('Uma passagem secreta!');
        }
      }
      return true;
    }
    return SOLID.has(t);
  }

  hurtPlayer(n, kx, kz, ignoreInv = false) {
    const p = this.player;
    if (p.dead || p.dash > 0) return;
    if (p.inv > 0 && !ignoreInv) return;
    if (this.testMode && this.ui.invincible) { p.inv = 0.5; return; }
    p.hp -= n;
    p.inv = 1.1;
    p.kvx = kx * 7; p.kvz = kz * 7;
    this.result.damageTaken += n;
    this.shake = Math.max(this.shake, 0.3);
    sfx('dano');
    this.ui.flash();
    if (p.hp <= 0) this.playerDown();
  }

  playerDown() {
    const p = this.player;
    p.dead = true;
    p.hp = 0;
    this.fx.smoke(p.x, p.z, 1.5);
    this.ui.bigText('O Lunerb desmaiou...', 1600);
    setTimeout(() => {
      if (!this.running) return;
      p.x = this.respawn.x; p.z = this.respawn.z;
      p.safeX = p.x; p.safeZ = p.z;
      p.hp = MAX_HP; p.inv = 2; p.dead = false; p.kvx = p.kvz = 0;
      // monstros acordados voltam a dormir para dar uma chance
      for (const e of this.enemies) e.awake = false;
      if (this.boss && this.boss.alive && this.boss.state !== 'dormindo') {
        this.boss.state = 'perseguir'; this.boss.t = 0;
        this.boss.x = this.boss.hx; this.boss.z = this.boss.hz;
      }
    }, 1700);
  }

  // ---------------- monstros ----------------
  updateEnemy(e, dt) {
    const p = this.player;
    const d = e.def;
    e.t += dt;
    e.hit = Math.max(0, e.hit - dt);
    const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz);
    if (!e.awake && dist < d.aggro && !p.dead) e.awake = true;
    if (e.awake && (dist > d.aggro * 2.2 || p.dead)) e.awake = false;
    let vx = 0, vz = 0;
    if (e.awake) {
      let sp = d.speed;
      if (d.hop) sp = (e.t % 0.9) < 0.5 ? d.speed : 0;
      vx = (dx / (dist || 1)) * sp; vz = (dz / (dist || 1)) * sp;
      if (d.fly) { const s = Math.sin(e.t * 3) * 1.5; vx += (-dz / (dist || 1)) * s; vz += (dx / (dist || 1)) * s; }
      e.face = turnTo(e.face, Math.atan2(dx, dz), dt * 8);
    } else {
      if (e.t > 2) { e.t = 0; const a = Math.random() * Math.PI * 2; e.wx = Math.cos(a) * 0.5; e.wz = Math.sin(a) * 0.5; if (Math.random() < 0.4) { e.wx = 0; e.wz = 0; } }
      vx = e.wx; vz = e.wz;
      if (vx || vz) e.face = turnTo(e.face, Math.atan2(vx, vz), dt * 4);
    }
    if (!d.fly && this.tileAt(e.x, e.z) === 'W' && e.type !== 'aranha') { vx *= 0.5; vz *= 0.5; }
    this.move(e, (vx + e.kvx) * dt, (vz + e.kvz) * dt, e.r, d.fly ? 'fly' : 'enemy');
    e.kvx *= Math.pow(0.003, dt); e.kvz *= Math.pow(0.003, dt);
    e.moving = Math.hypot(vx, vz) > 0.1;
    // encostou no Lunerb
    if (!p.dead && dist < e.r + P_R + 0.05) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1));
  }

  damage(e, dmg, kx, kz) {
    if (!e.alive) return;
    if (e.type === 'capitao' && (e.state === 'intro' || e.state === 'dormindo')) return;
    e.hit = 0.15;
    const kb = e.type === 'capitao' ? 0.6 : 4;
    e.kvx = (kx || 0) * kb; e.kvz = (kz || 0) * kb;
    if (e.armor > 0) {
      e.armor -= dmg;
      this.fx.sparks(e.x, 0.8, e.z, 0xcfd6dd, 5);
      sfx('acerto');
      if (e.armor <= 0) {
        e.armor = 0;
        if (e.m.armorGroup) e.m.armorGroup.visible = false;
        this.fx.armorPieces(e.x, e.z, e.type === 'capitao' ? 2 : 1);
        sfx('clang');
        if (e.type === 'capitao') this.bossArmorBroken();
      }
      return;
    }
    e.hp -= dmg;
    this.fx.sparks(e.x, 0.7, e.z, 0xff9a30, 4);
    sfx('acerto');
    if (e.hp <= 0) this.kill(e);
  }

  kill(e) {
    e.alive = false;
    e.m.root.visible = false;
    this.fx.smoke(e.x, e.z, e.type === 'capitao' ? 3 : 1);
    sfx('puf');
    this.player.turbo = Math.min(3, this.player.turbo + 0.45);
    if (e.type === 'capitao') { this.bossDefeated(); return; }
    const n = e.def.drop + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) this.dropCrystal(e.x, e.z);
    if (this.player.hp < MAX_HP && Math.random() < 0.15) this.dropHeart(e.x, e.z);
  }

  dropCrystal(x, z) {
    const g = buildCristal();
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 1.5;
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.pickups.push({ kind: 'cristal', x, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, g, t: 0 });
  }

  dropHeart(x, z) {
    const g = buildCoracao();
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.pickups.push({ kind: 'coracao', x, z, vx: 0, vz: 0, g, t: 0 });
  }

  // ---------------- Capitão de Ferro ----------------
  updateBoss(dt) {
    const b = this.boss;
    const p = this.player;
    b.t += dt;
    b.hit = Math.max(0, b.hit - dt);
    const dx = p.x - b.x, dz = p.z - b.z, dist = Math.hypot(dx, dz);
    const broken = b.armor <= 0;
    if (b.state === 'dormindo') {
      if (dist < 7.5 && !p.dead) this.startBossIntro();
      return;
    }
    if (p.dead) return;
    const speed = broken ? 2.0 : 1.35;
    switch (b.state) {
      case 'perseguir': {
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 5);
        this.move(b, (dx / (dist || 1)) * speed * dt, (dz / (dist || 1)) * speed * dt, b.r, 'enemy');
        b.moving = true;
        if (b.t > (broken ? 2.2 : 3)) {
          b.t = 0; b.cycle++;
          b.state = b.cycle % 3 === 0 ? 'mirar' : 'erguer';
          b.moving = false;
          if (b.state === 'erguer') sfx('rugido');
        }
        break;
      }
      case 'erguer': // levanta os braços para a pancada
        if (b.t > 0.75) { b.state = 'pancada'; b.t = 0; sfx('pancada'); this.shake = 0.45; b.ring = this.fx.ring(b.x, b.z, 5, 0.7); }
        break;
      case 'pancada':
        if (b.ring) {
          const r = b.ring.r;
          if (Math.abs(dist - r) < 0.45 && b.ring.t < b.ring.dur) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1));
        }
        if (b.t > 1.1) { b.state = 'perseguir'; b.t = 0; b.ring = null; }
        break;
      case 'mirar': // vai dar uma investida
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 6);
        if (b.t > 0.7) { b.state = 'investida'; b.t = 0; b.chargeDx = dx / (dist || 1); b.chargeDz = dz / (dist || 1); sfx('rugido'); }
        break;
      case 'investida': {
        const ox = b.x, oz = b.z;
        this.move(b, b.chargeDx * 7.5 * dt, b.chargeDz * 7.5 * dt, b.r, 'enemy');
        b.moving = true;
        for (let i = 0; i < 2; i++) this.fx.spawn(b.x, 0.2, b.z, { color: 0x666666, size: 0.25, vy: 1, life: 0.4 });
        const stuck = Math.hypot(b.x - ox, b.z - oz) < 7.5 * dt * 0.4;
        if (stuck) { b.state = 'tonto'; b.t = 0; this.shake = 0.35; sfx('pancada'); this.ui.toast('Ele bateu na parede! Ataque agora!'); }
        else if (b.t > 0.9) { b.state = 'perseguir'; b.t = 0; }
        break;
      }
      case 'tonto':
        b.moving = false;
        if (Math.random() < 0.3) this.fx.sparks(b.x, 2.3, b.z, 0xffff66, 1);
        if (b.t > 1.6) { b.state = 'perseguir'; b.t = 0; }
        break;
    }
    if (broken) {
      b.spawnT += dt;
      const alive = this.enemies.filter((e) => e.alive).length;
      if (b.spawnT > 9 && alive < 4) { b.spawnT = 0; this.spawnHorde(2, false); }
    }
    if (dist < b.r + P_R && b.state !== 'tonto') this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1));
    this.ui.bossBar('CAPITÃO DE FERRO', b.armor / b.maxArmor, b.hp / b.maxHp);
  }

  startBossIntro() {
    const b = this.boss;
    b.state = 'intro';
    this.cine = { kind: 'boss', t: 0 };
    this.input.reset();
    playMusic('boss');
    sfx('rugido');
  }

  updateCine(dt) {
    const c = this.cine;
    c.t += dt;
    const b = this.boss;
    if (c.kind === 'boss') {
      // câmera dramática: aproxima no chefão
      this.camTarget.lerp(new THREE.Vector3(b.x, 0, b.z), 1 - Math.pow(0.02, dt));
      this.viewH += (6 - this.viewH) * (1 - Math.pow(0.05, dt));
      this.resize();
      if (c.t > 0.6 && !c.shown) { c.shown = true; this.ui.bigText('CAPITÃO DE FERRO', 1800, 'boss'); this.shake = 0.5; }
      b.m.arms.forEach((a) => (a.rotation.x = -2.6 + Math.sin(c.t * 10) * 0.2));
      if (c.t > 2.6) {
        this.cine = null;
        b.state = 'perseguir'; b.t = 0;
        this.zoomBack = true;
        this.spawnHorde(3, true);
      }
    } else if (c.kind === 'bossDown') {
      this.camTarget.lerp(new THREE.Vector3(b.x, 0, b.z), 1 - Math.pow(0.02, dt));
      if (c.t > 2.2) {
        this.cine = null;
        this.zoomBack = true;
        this.ui.dialog([{ who: 'Lunerb', text: 'Consegui! O portão da saída abriu!' }], () => {});
      }
    }
  }

  spawnHorde(n, armored) {
    const b = this.boss;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      let x = b.hx + Math.cos(a) * 4, z = b.hz + Math.sin(a) * 4;
      if (this.solid(Math.floor(x), Math.floor(z), 'enemy')) { x = b.hx; z = b.hz; }
      const e = this.makeEnemy(armored && i === 0 ? 'armadura' : 'zumbi', x, z);
      e.awake = true;
      this.enemies.push(e);
      this.fx.smoke(x, z, 1);
    }
  }

  bossArmorBroken() {
    this.ui.toast('A armadura caiu! Agora ele está mais rápido!');
    this.shake = 0.5;
    if (!this.boss.hordeDone) { this.boss.hordeDone = true; this.spawnHorde(3, true); }
  }

  bossDefeated() {
    const b = this.boss;
    this.ui.bossBar(null);
    this.fx.armorPieces(b.x, b.z, 2);
    this.cine = { kind: 'bossDown', t: 0 };
    this.ui.bigText('CAPITÃO DE FERRO DERROTADO!', 2000, 'boss');
    sfx('clang');
    for (let i = 0; i < 12; i++) this.dropCrystal(b.x, b.z);
    for (const e of this.enemies) if (e.alive) this.kill(e);
    this.setExitLocked(false);
    sfx('porta');
    playMusic(this.def.music);
  }

  // ---------------- tiros e coletáveis ----------------
  updateShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      s.x += s.dx * s.speed * dt; s.z += s.dz * s.speed * dt;
      s.g.position.set(s.x, 0.75, s.z);
      s.outer.rotation.x += dt * 12; s.outer.rotation.y += dt * 9;
      if (Math.random() < 0.6) this.fx.spawn(s.x, 0.75, s.z, { color: 0xff7a1a, size: 0.12, life: 0.25, emissive: 1.2, vy: 0.4 });
      let dead = s.life <= 0;
      const t = this.tileAt(s.x, s.z);
      if (SOLID.has(t)) { this.hitTile(s.x, s.z, 1, true); dead = true; this.fx.sparks(s.x, 0.75, s.z, 0xff9a30, 4); }
      if (!dead) {
        for (const e of this.targets()) {
          if (Math.hypot(e.x - s.x, e.z - s.z) < e.r + 0.2) { this.damage(e, s.dmg, s.dx, s.dz); dead = true; break; }
        }
      }
      if (dead) { this.scene.remove(s.g); this.shots.splice(i, 1); }
    }
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.life -= dt;
      l.g.scale.set(l.life / 0.3, l.life / 0.3, 1);
      if (l.life <= 0) { this.scene.remove(l.g); this.lasers.splice(i, 1); }
    }
  }

  updatePickups(dt) {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.t += dt;
      const dx = p.x - k.x, dz = p.z - k.z, d = Math.hypot(dx, dz);
      if (k.t > 0.4 && d < 2.6 && !p.dead) { k.vx = (dx / d) * 9; k.vz = (dz / d) * 9; }
      else { k.vx *= Math.pow(0.05, dt); k.vz *= Math.pow(0.05, dt); }
      this.move(k, k.vx * dt, k.vz * dt, 0.1, 'enemy');
      k.g.position.set(k.x, Math.sin(k.t * 4) * 0.08, k.z);
      k.g.rotation.y += dt * 3;
      if (k.t > 0.4 && d < 0.5) {
        if (k.kind === 'cristal') { this.result.crystals++; sfx('cristal'); }
        else if (k.kind === 'coracao') { p.hp = Math.min(MAX_HP, p.hp + 1); sfx('coracao'); }
        this.scene.remove(k.g);
        this.pickups.splice(i, 1);
      }
    }
  }

  checkTriggers() {
    const p = this.player;
    if (p.dead) return;
    // baús abrem quando o Lunerb chega perto
    for (const c of this.world.chests) {
      if (c.open || Math.hypot(c.wx - p.x, c.wz - p.z) > 0.95) continue;
      c.open = true;
      sfx('bau');
      this.fx.sparks(c.wx, 0.6, c.wz, 0xffe070, 12);
      if (c.kind === 'arma' && p.weapons < this.def.weaponReward) {
        p.weapons = this.def.weaponReward;
        this.updateGuns();
        this.frozen = true;
        this.input.reset();
        const lines = p.weapons === 1
          ? [{ who: 'Lunerb', text: 'Uma BOOTESHISCORE!' }, { who: 'Dica', text: 'Agora o botão vermelho solta BOLAS DE FOGO! Segure para atirar sem parar.' }, { who: 'Dica', text: 'Atire nas tochas apagadas para iluminar o castelo!' }]
          : [{ who: 'Lunerb', text: 'A SEGUNDA BOOTESHISCORE! Agora tenho uma em cada mão!' }, { who: 'Dica', text: 'Toque para atirar com as duas. SEGURE e solte para o LASER POTENTE!' }];
        this.ui.dialog(lines, () => { this.frozen = false; });
      } else if (c.kind === 'secreto') {
        this.result.secretFound = true;
        for (let i = 0; i < 15; i++) this.dropCrystal(c.wx, c.wz);
        this.ui.toast('⭐ Baú secreto encontrado!');
      } else {
        for (let i = 0; i < 8; i++) this.dropCrystal(c.wx, c.wz);
      }
    }
    // corações no chão
    for (const h of this.world.hearts) {
      if (h.taken || p.hp >= MAX_HP) continue;
      if (Math.hypot(h.x - p.x, h.z - p.z) < 0.6) { h.taken = true; h.mesh.visible = false; p.hp = Math.min(MAX_HP, p.hp + 1); sfx('coracao'); }
    }
    // fogueiras azuis
    for (const c of this.world.checkpoints) {
      if (c.active || Math.hypot(c.x - p.x, c.z - p.z) > 0.9) continue;
      for (const o of this.world.checkpoints) o.current = false;
      c.active = true; c.flame.visible = true; c.smoke.visible = false;
      this.respawn = { x: c.x, z: c.z + 0.8 };
      p.hp = MAX_HP;
      sfx('fogueira');
      this.ui.toast('🔥 Fogueira acesa! Você volta aqui se desmaiar.');
      this.fx.sparks(c.x, 0.5, c.z, 0x6ab8ff, 14);
    }
    // saída
    const ex = this.world.exit;
    if (ex && Math.hypot(ex.x - p.x, ex.z - p.z) < 0.8) {
      if (ex.locked) { if (!this.lockMsg) { this.lockMsg = true; this.ui.toast('O portão está trancado! Derrote o Capitão de Ferro.'); setTimeout(() => (this.lockMsg = false), 3000); } }
      else this.finish();
    }
    // dicas
    if (!this.tips.turbo && p.turbo >= 1.5 && this.time > 25) { this.tips.turbo = true; this.ui.toast('Botão roxo: TURBO NEGRO! ⚡ Atravessa os monstros!'); }
  }

  finish() {
    if (this.ended) return;
    this.ended = true;
    this.frozen = true;
    this.result.finished = true;
    sfx('porta');
    playMusic('victory');
    this.ui.bigText('FASE COMPLETA!', 1500);
    setTimeout(() => { if (this.running) this.onComplete && this.onComplete(this.result); }, 1600);
  }

  forceComplete() {
    if (this.boss && this.boss.alive) { this.boss.alive = false; this.boss.m.root.visible = false; this.setExitLocked(false); this.ui.bossBar(null); }
    if (this.def.weaponReward > this.player.weapons) { this.player.weapons = this.def.weaponReward; }
    this.finish();
  }

  // ---------------- visual ----------------
  animate(dt) {
    const p = this.player;
    const m = p.model;
    m.root.position.set(p.x, 0, p.z);
    m.root.rotation.y = p.face;
    m.root.visible = !p.dead && !(p.inv > 0 && Math.floor(this.time * 14) % 2 === 0);
    p.shadow.position.set(p.x, 0.02, p.z);
    p.shadow.visible = !p.dead;
    const walking = p.moving && !this.frozen && !this.cine;
    if (walking) p.walkT += dt * 11;
    const sw = walking ? Math.sin(p.walkT) * 0.8 : 0;
    m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw;
    m.body.position.y = walking ? Math.abs(Math.sin(p.walkT)) * 0.04 : Math.sin(this.time * 2) * 0.01;
    const aiming = p.aimT > 0 || p.charging;
    m.arms[0].rotation.x = aiming && p.weapons >= 2 ? -1.45 : -sw;
    m.arms[1].rotation.x = aiming && p.weapons >= 1 ? -1.45 : sw;
    if (p.meleeT > 0) {
      const k = Math.sin((1 - p.meleeT / 0.22) * Math.PI);
      if (p.meleeSide) m.arms[1].rotation.x = -1.6 * k;
      else m.legs[1].rotation.x = -1.3 * k;
    }
    if (p.dash > 0) m.body.rotation.x = 0.4; else m.body.rotation.x = 0;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const r = e.m.root;
      r.position.set(e.x, e.def.fly ? 0.9 + Math.sin(this.time * 4 + e.t) * 0.15 : 0, e.z);
      r.rotation.y = e.face;
      r.scale.setScalar(1.2 * (e.hit > 0 ? 1.15 : 1));
      const w = Math.sin(this.time * 8 + e.x) * (e.moving ? 0.6 : 0.1);
      if (e.m.legs && e.type !== 'aranha') { e.m.legs[0].rotation.x = w; e.m.legs[1].rotation.x = -w; }
      if (e.type === 'aranha') e.m.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.time * 18 + i) * (e.moving ? 0.4 : 0.05)));
      if (e.type === 'morcego') e.m.wings.forEach((wg, i) => (wg.rotation.z = Math.sin(this.time * 16) * 0.7 * (i ? -1 : 1)));
      if (e.m.arms && e.type !== 'morcego') e.m.arms.forEach((a, i) => (a.rotation.x = -1.3 + Math.sin(this.time * 4 + i) * 0.15));
    }
    const b = this.boss;
    if (b && b.alive) {
      const r = b.m.root;
      r.position.set(b.x, 0, b.z);
      r.rotation.y = b.face;
      r.scale.setScalar(2.1 * (b.hit > 0 ? 1.06 : 1));
      const w = b.moving ? Math.sin(this.time * 7) * 0.5 : 0;
      b.m.legs[0].rotation.x = w; b.m.legs[1].rotation.x = -w;
      if (b.state === 'erguer') b.m.arms.forEach((a) => (a.rotation.x = -2.9));
      else if (b.state === 'pancada') b.m.arms.forEach((a) => (a.rotation.x = -0.6));
      else if (b.state === 'tonto') { b.m.arms.forEach((a) => (a.rotation.x = -0.2)); r.rotation.z = Math.sin(this.time * 6) * 0.08; }
      else if (b.state !== 'intro') { b.m.arms.forEach((a, i) => (a.rotation.x = -1.3 + Math.sin(this.time * 4 + i) * 0.15)); r.rotation.z = 0; }
    }

    // baús abrindo, chamas
    for (const c of this.world.chests) if (c.open && c.lidT < 1) { c.lidT = Math.min(1, c.lidT + dt * 3); c.lid.rotation.x = -c.lidT * 1.9; }
    for (const t of this.world.torches) if (t.lit) t.flame.scale.y = 1 + Math.sin(this.time * 12 + t.x) * 0.15;
    for (const c of this.world.checkpoints) if (c.active) { c.flame.scale.y = 1 + Math.sin(this.time * 10 + c.x) * 0.2; c.flame.rotation.y += dt * 2; }
    for (const h of this.world.hearts) if (!h.taken) { h.mesh.rotation.y += dt * 2; h.mesh.position.y = Math.sin(this.time * 3) * 0.1; }
    if (this.world.exit && !this.world.exit.locked) this.world.exit.glow.material.opacity = 0.45 + Math.sin(this.time * 3) * 0.15;
  }

  updateLights(dt) {
    const p = this.player;
    this.playerLight.position.set(p.x - 0.6, 3, p.z - 0.6);
    this.playerLight.intensity = p.dash > 0 ? 13 : 8 + Math.sin(this.time * 9) * 0.3;
    this.playerLight.color.setHex(p.dash > 0 ? 0xb070ff : 0xffcf9a);
    this.lightTimer -= dt;
    if (this.lightTimer <= 0) {
      this.lightTimer = 0.25;
      const lit = this.world.torches.filter((t) => t.lit)
        .map((t) => ({ t, d: Math.hypot(t.x - p.x, t.z - p.z) }))
        .sort((a, b) => a.d - b.d).slice(0, this.torchLights.length);
      this.torchLights.forEach((l, i) => {
        const o = lit[i];
        if (o && o.d < 16) { l.position.set(o.t.x, 1.4, o.t.z); l.userData.on = true; } else l.userData.on = false;
      });
    }
    for (const l of this.torchLights) l.intensity = l.userData.on ? 7 + Math.sin(this.time * 11 + l.position.x) * 0.8 : 0;
  }

  updateCamera(dt) {
    const p = this.player;
    if (!this.cine) {
      this.camTarget.x += (p.x - this.camTarget.x) * (1 - Math.pow(0.004, dt));
      this.camTarget.z += (p.z - this.camTarget.z) * (1 - Math.pow(0.004, dt));
      if (this.zoomBack) {
        this.viewH += (10 - this.viewH) * (1 - Math.pow(0.05, dt));
        if (Math.abs(this.viewH - 10) < 0.05) { this.viewH = 10; this.zoomBack = false; }
        this.resize();
      }
    }
    this.shake = Math.max(0, this.shake - dt);
    const s = this.shake * 0.5;
    const ox = (Math.random() - 0.5) * s, oz = (Math.random() - 0.5) * s;
    this.camera.position.set(this.camTarget.x + this.camOffset.x + ox, this.camOffset.y, this.camTarget.z + this.camOffset.z + oz);
    this.camera.lookAt(this.camTarget.x + ox, 0, this.camTarget.z + oz);
  }

  hud(force) {
    const p = this.player;
    const st = `${p.hp}|${this.result.crystals}|${Math.floor(p.turbo * 10)}`;
    if (!force && st === this._hud) return;
    this._hud = st;
    this.ui.hud({ hp: p.hp, maxHp: MAX_HP, crystals: this.result.crystals, turbo: p.turbo });
  }
}

function turnTo(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}
