// O jogo: salas-maquete, herói, monstros, tiros, baús, fogueiras, prólogo da fuga e o Capitão de Ferro.
import * as THREE from '../vendor/three.module.min.js';
import { parseLevel, getLevel, SOLID, ROOM_SPACING } from './levels.js';
import { buildRoom, sharedMaterials } from './world.js';
import { buildHero, buildZumbi, buildAranha, buildMorcego, buildCristal, buildCoracao } from './models.js';
import { material } from './geo.js';
import { tex } from './textures.js';
import { FX } from './fx.js';
import { sfx, playMusic } from './audio.js';
import { weaponStats } from './progress.js';

const MAX_HP = 5;
const P_SPEED = 4.2;
const P_R = 0.3;
const SQ2 = Math.SQRT1_2;
const HERO_SCALE = 1.5;
const EL = THREE.MathUtils.degToRad(31);
const DIR = new THREE.Vector3(Math.sin(Math.PI / 4) * Math.cos(EL), Math.sin(EL), Math.cos(Math.PI / 4) * Math.cos(EL)).normalize();
const CAM_R = new THREE.Vector3().crossVectors(DIR.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize();
const CAM_U = new THREE.Vector3().crossVectors(CAM_R, DIR.clone().negate()).normalize();
const BALL = new THREE.SphereGeometry(1, 10, 8);
const BEAM = new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(Math.PI / 2);

const EDEF = {
  zumbi: { hp: 3, armor: 0, speed: 1.5, r: 0.34, aggro: 6.5, drop: 1, build: () => buildZumbi() },
  armadura: { hp: 3, armor: 3, speed: 1.15, r: 0.36, aggro: 6.5, drop: 3, build: () => buildZumbi({ armor: true }) },
  aranha: { hp: 2, armor: 0, speed: 3.0, r: 0.32, aggro: 6, drop: 1, hop: true, build: buildAranha },
  morcego: { hp: 2, armor: 0, speed: 2.4, r: 0.3, aggro: 6.5, drop: 1, fly: true, build: buildMorcego },
};

const THEMES = {
  forest: { bg: 'bgForest', hemi: [0xbfe3ff, 0x3a4a2a, 1.25], sun: [0xfff0d0, 2.4], player: 0, torch: 0, exposure: 1.1 },
  castle: { bg: 'bgCastle', hemi: [0xa8b4e8, 0x3a3034, 1.25], sun: [0xd0d8ff, 2.1], player: 4, torch: 7, exposure: 1.3 },
};

export class Game {
  constructor({ renderer, ui, input }) {
    this.renderer = renderer;
    this.ui = ui;
    this.input = input;
    this.scene = null;
    this.running = false;
    this.paused = false;
    this.camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 1, 140);
    this.view = { cx: 0, cy: 0, half: 6 };
    this.viewTarget = { cx: 0, cy: 0, half: 6 };
    this.lowQuality = false;
    this.fpsT = 0; this.fpsN = 0; this.fpsChecks = 0;
  }

  resize() {
    if (this.room && !this.cine) this.viewTarget = this.fitRoom(this.room);
  }

  // ---------------- iniciar fase ----------------
  start(levelId, save, { testMode = false, onComplete } = {}) {
    this.dispose();
    const def = getLevel(levelId);
    this.def = def;
    this.isPrologue = def.kind === 'prologo';
    this.save = save;
    this.testMode = testMode;
    this.onComplete = onComplete;
    this.stats = weaponStats(save);
    const theme = THEMES[def.theme];
    this.themeCfg = theme;
    this.chaseStarted = false;

    const scene = new THREE.Scene();
    scene.background = tex(theme.bg);
    this.scene = scene;
    this.renderer.toneMappingExposure = theme.exposure;
    scene.add(new THREE.HemisphereLight(...theme.hemi));
    const sun = new THREE.DirectionalLight(...theme.sun);
    sun.castShadow = !this.lowQuality;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    this.sun = sun;

    this.fx = new FX(scene);
    this.playerLight = new THREE.PointLight(0xffcf9a, theme.player, 6, 1.2);
    scene.add(this.playerLight);
    this.torchLights = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xff8a30, 0, 6.5, 1.3); scene.add(l); this.torchLights.push(l); }
    this.gateLight = new THREE.PointLight(0x7dff9a, 0, 5, 1.3);
    scene.add(this.gateLight);

    // poeirinha / vaga-lumes flutuando
    const n = 70;
    const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pts[i * 3] = Math.random() * 16 - 1.5; pts[i * 3 + 1] = Math.random() * 4 - 1.5; pts[i * 3 + 2] = Math.random() * 12 - 1.5; }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    this.dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: def.theme === 'forest' ? 0xd8ff7a : 0xffb070, size: 0.07, transparent: true, opacity: 0.8 }));
    scene.add(this.dust);

    // salas
    const parsed = parseLevel(def);
    this.rooms = parsed.rooms.map((pr, i) => {
      const off = { x: i * ROOM_SPACING, z: -i * ROOM_SPACING };
      const vis = buildRoom(pr, def.theme, off, def.id * 10 + i + 1);
      vis.group.visible = false;
      scene.add(vis.group);
      const room = {
        i, pr, vis, off, name: def.rooms[i].name, w: pr.w, h: pr.h,
        tiles: pr.tiles.map((r) => r.slice()),
        enemies: [], boss: null, spawnT: 0, enterT: 0, warned: false,
        entry: this.entryPos(pr, off),
      };
      for (const e of pr.enemies) room.enemies.push(this.makeEnemy(e.type, off.x + e.x + 0.5, off.z + e.y + 0.5, false));
      if (pr.boss) room.boss = this.makeBoss(off.x + pr.boss.x + 0.5, off.z + pr.boss.y + 0.5);
      if (vis.exit) this.setGateLocked(vis.exit, !!room.boss);
      return room;
    });

    // herói
    const model = buildHero(def.hero);
    model.root.scale.setScalar(HERO_SCALE);
    scene.add(model.root);
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.visible = this.lowQuality;
    scene.add(blob);
    this.player = {
      x: 0, z: 0, face: Math.PI * 0.75, hp: MAX_HP, inv: 0, kvx: 0, kvz: 0, model, blob,
      weapons: this.isPrologue ? 0 : save.weapons, atkCd: 0, charge: 0, charging: false, aimT: 0, meleeT: 0, meleeSide: 0,
      dash: 0, dashDx: 0, dashDz: 0, dashHit: new Set(), turbo: 1, walkT: 0, moving: false,
      safeX: 0, safeZ: 0, dead: false, sink: 0,
    };
    this.updateGuns();

    this.shots = []; this.pickups = []; this.lasers = [];
    this.result = { finished: false, damageTaken: 0, secretFound: false, crystals: 0 };
    this.time = 0; this.shake = 0;
    this.frozen = true; this.cine = null; this.trans = null; this.ended = false;
    this.tips = { turbo: false };
    this.lightTimer = 0;
    this.enterRoom(0, true);
    this.view = { ...this.viewTarget };
    this.running = true;
    this.paused = false;

    this.ui.setControls({ attack: !this.isPrologue, turbo: !this.isPrologue });
    playMusic(def.music);
    this.ui.titleCard(this.isPrologue ? 'PRÓLOGO' : `MUNDO ${def.world} · FASE ${def.id}`, def.title);
    setTimeout(() => {
      if (!this.running) return;
      this.ui.dialog(def.intro, () => {
        this.frozen = false;
        if (this.isPrologue) this.ui.toast('Arraste no lado esquerdo para andar');
        else if (def.id === 1) this.ui.toast('Arraste no lado esquerdo para andar. Botão vermelho: atacar!');
      });
    }, 1900);
    this.hud(true);
  }

  dispose() {
    this.running = false;
    if (this.scene) {
      this.scene.traverse((o) => {
        if (o.isMesh && Array.isArray(o.material)) o.material.forEach((m) => { if (m.map && m.map.isCanvasTexture && m.map.image.width > 256) m.map.dispose(); });
      });
    }
    this.scene = null;
    this.room = null;
    this.ui.bossBar(null);
  }

  entryPos(pr, off) {
    const e = pr.entry;
    let dx = 0, dz = 0;
    if (e.x === 0) dx = 0.7; else if (e.x === pr.w - 1) dx = -0.7; else if (e.y === 0) dz = 0.7; else if (e.y === pr.h - 1) dz = -0.7;
    return { x: off.x + e.x + 0.5 + dx, z: off.z + e.y + 0.5 + dz };
  }

  enterRoom(i, first = false) {
    const prev = this.room;
    const room = this.rooms[i];
    this.room = room;
    this.tiles = room.tiles;
    room.vis.group.visible = true;
    if (prev && prev !== room) {
      prev.vis.group.visible = false;
      for (const e of prev.enemies) e.m.root.visible = false;
      if (prev.boss) prev.boss.m.root.visible = false;
    }
    for (const e of room.enemies) e.m.root.visible = e.alive;
    if (room.boss) room.boss.m.root.visible = room.boss.alive;
    const p = this.player;
    p.x = room.entry.x; p.z = room.entry.z;
    p.safeX = p.x; p.safeZ = p.z;
    p.face = room.pr.entry.x === 0 ? Math.PI / 2 : 0;
    this.respawn = { x: p.x, z: p.z };
    room.enterT = 0; room.spawnT = 0;
    this.viewTarget = this.fitRoom(room);
    const c = room.vis.center;
    this.sun.position.set(c.x - 6, 14, c.z + 5);
    this.sun.target.position.copy(c);
    const ext = Math.max(room.w, room.h) * 0.8;
    Object.assign(this.sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 40 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.dust.position.set(room.off.x, 0, room.off.z);
    const gate = room.vis.portal || room.vis.exit;
    if (gate) this.gateLight.position.set(room.off.x + gate.lx, 1.2, room.off.z + gate.lz);
    this.gateLight.intensity = gate && !gate.locked ? 4 : 0;
    this.lightTimer = 0;
    if (!first) this.ui.toast(room.name, 1600);
  }

  // Enquadra a sala inteira na tela (câmera fixa e distante)
  fitRoom(room) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const v = new THREE.Vector3();
    for (const x of [room.off.x - 0.1, room.off.x + room.w + 0.1]) for (const z of [room.off.z - 0.1, room.off.z + room.h + 0.1]) for (const y of [-1.3, 1.9]) {
      v.set(x, y, z);
      const px = v.dot(CAM_R), py = v.dot(CAM_U);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
    const aspect = innerWidth / innerHeight;
    const topPad = 0.9; // espaço para os corações
    const half = Math.max((maxY - minY + topPad) / 2, (maxX - minX) / 2 / aspect) * 1.02;
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 + topPad / 2, half };
  }

  focusView(x, z, half) {
    const v = new THREE.Vector3(x, 0.8, z);
    return { cx: v.dot(CAM_R), cy: v.dot(CAM_U), half };
  }

  makeEnemy(type, x, z, chase = false) {
    const d = EDEF[type];
    const m = d.build();
    m.root.scale.setScalar(HERO_SCALE);
    m.root.position.set(x, 0, z);
    m.root.visible = false;
    this.scene.add(m.root);
    return {
      type, x, z, hp: d.hp, armor: d.armor, def: d, m, alive: true, awake: chase, chase,
      t: Math.random() * 3, wx: 0, wz: 0, kvx: 0, kvz: 0, face: Math.random() * 6, hit: 0, r: d.r,
      speed: chase ? 2.55 : d.speed,
    };
  }

  makeBoss(x, z) {
    const m = buildZumbi({ armor: true, boss: true });
    m.root.scale.setScalar(2.8);
    m.root.visible = false;
    this.scene.add(m.root);
    m.root.position.set(x, 0, z);
    return {
      type: 'capitao', x, z, hx: x, hz: z, hp: 22, maxHp: 22, armor: 18, maxArmor: 18, m, alive: true,
      state: 'dormindo', t: 0, cycle: 0, r: 0.8, kvx: 0, kvz: 0, face: -Math.PI / 2, hit: 0, chargeDx: 0, chargeDz: 0,
      spawnT: 0, hordeDone: false, ring: null,
    };
  }

  updateGuns() {
    const p = this.player;
    p.model.guns[1].visible = p.weapons >= 1;
    p.model.guns[0].visible = p.weapons >= 2;
  }

  setGateLocked(gate, locked) {
    gate.locked = locked;
    gate.bars.visible = locked;
    gate.glow.visible = !locked;
  }

  // ---------------- colisão (sempre na sala atual) ----------------
  tileAt(x, z) {
    const r = this.room;
    const tx = Math.floor(x - r.off.x), tz = Math.floor(z - r.off.z);
    if (tx < 0 || tz < 0 || tx >= r.w || tz >= r.h) return '#';
    return this.tiles[tz][tx];
  }

  solidLocal(tx, tz, who) {
    const r = this.room;
    if (tx < 0 || tz < 0 || tx >= r.w || tz >= r.h) return true;
    const t = this.tiles[tz][tx];
    if (SOLID.has(t)) return true;
    if (who === 'enemy' && (t === 'L' || t === 'X' || t === 'E')) return true;
    return false;
  }

  move(ent, dx, dz, rad, who) {
    const ox = this.room.off.x, oz = this.room.off.z;
    let lx = ent.x - ox, lz = ent.z - oz;
    let nx = lx + dx;
    if (dx !== 0) {
      const edge = Math.floor(nx + Math.sign(dx) * rad);
      for (let tz = Math.floor(lz - rad); tz <= Math.floor(lz + rad); tz++) {
        if (this.solidLocal(edge, tz, who)) { nx = dx > 0 ? edge - rad - 0.001 : edge + 1 + rad + 0.001; break; }
      }
    }
    lx = nx;
    let nz = lz + dz;
    if (dz !== 0) {
      const edge = Math.floor(nz + Math.sign(dz) * rad);
      for (let tx = Math.floor(lx - rad); tx <= Math.floor(lx + rad); tx++) {
        if (this.solidLocal(tx, edge, who)) { nz = dz > 0 ? edge - rad - 0.001 : edge + 1 + rad + 0.001; break; }
      }
    }
    lz = nz;
    ent.x = lx + ox; ent.z = lz + oz;
    for (const c of this.room.vis.chests) {
      const cx = ox + c.lx, cz = oz + c.lz;
      const ddx = ent.x - cx, ddz = ent.z - cz, d = Math.hypot(ddx, ddz), min = rad + 0.33;
      if (d < min && d > 0.0001) { ent.x = cx + (ddx / d) * min; ent.z = cz + (ddz / d) * min; }
    }
  }

  // ---------------- laço principal ----------------
  update(dt) {
    if (!this.running || this.paused) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.checkQuality(dt);
    const S = sharedMaterials();
    S.lava.color.setScalar(0.9 + Math.sin(this.time * 3) * 0.12);
    S.lodo.color.setHex(0x1fa82a).multiplyScalar(0.85 + Math.sin(this.time * 2.2) * 0.18);

    if (this.trans) this.updateTransition(dt);
    else if (this.cine) this.updateCine(dt);
    if (!this.frozen && !this.cine && !this.trans) {
      this.room.enterT += dt;
      this.updatePlayer(dt);
      for (const e of this.room.enemies) if (e.alive) this.updateEnemy(e, dt);
      if (this.room.boss && this.room.boss.alive) this.updateBoss(dt);
      if (this.isPrologue) this.updateSpawners(dt);
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

  // Se o celular estiver sofrendo, desliga as sombras e baixa a resolução
  checkQuality(dt) {
    if (this.lowQuality || this.fpsChecks > 3) return;
    this.fpsT += dt; this.fpsN++;
    if (this.fpsT >= 4) {
      const fps = this.fpsN / this.fpsT;
      this.fpsT = 0; this.fpsN = 0; this.fpsChecks++;
      if (fps < 27) this.setLowQuality();
    }
  }

  setLowQuality() {
    this.lowQuality = true;
    this.sun.castShadow = false;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setPixelRatio(1);
    this.player.blob.visible = true;
    this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
  }

  // ---------------- herói ----------------
  updatePlayer(dt) {
    const p = this.player;
    if (p.dead) return;
    const inp = this.input;
    const d = inp.dir();
    const mx = (d.x + d.y) * SQ2;
    const mz = (-d.x + d.y) * SQ2;
    p.moving = mx !== 0 || mz !== 0;

    p.inv = Math.max(0, p.inv - dt);
    p.atkCd = Math.max(0, p.atkCd - dt);
    p.aimT = Math.max(0, p.aimT - dt);
    p.meleeT = Math.max(0, p.meleeT - dt);
    p.turbo = Math.min(3, p.turbo + dt * 0.08);

    if (!this.isPrologue && inp.turboPressed && p.dash <= 0) {
      if (p.turbo >= 1) {
        p.turbo -= 1; p.dash = 0.28;
        const len = Math.hypot(mx, mz);
        if (len > 0) { p.dashDx = mx / len; p.dashDz = mz / len; } else { p.dashDx = Math.sin(p.face); p.dashDz = Math.cos(p.face); }
        p.dashHit.clear();
        sfx('turbo');
        this.shake = Math.max(this.shake, 0.15);
      } else this.ui.toast('Turbo Negro carregando...');
    }

    let speed = this.isPrologue ? 4.5 : P_SPEED;
    if (this.tileAt(p.x, p.z) === 'W' && p.dash <= 0) speed *= 0.45;

    if (p.dash > 0) {
      p.dash -= dt;
      this.move(p, p.dashDx * 16 * dt, p.dashDz * 16 * dt, P_R, 'player');
      p.face = Math.atan2(p.dashDx, p.dashDz);
      for (let i = 0; i < 3; i++) this.fx.lightning(p.x, p.z);
      for (const e of this.targets()) {
        if (!p.dashHit.has(e) && Math.hypot(e.x - p.x, e.z - p.z) < e.r + 0.6) { p.dashHit.add(e); this.damage(e, 3, p.dashDx, p.dashDz); }
      }
    } else {
      this.move(p, (mx * speed + p.kvx) * dt, (mz * speed + p.kvz) * dt, P_R, 'player');
      if (p.moving && p.aimT <= 0) p.face = turnTo(p.face, Math.atan2(mx, mz), dt * 14);
    }
    p.kvx *= Math.pow(0.002, dt); p.kvz *= Math.pow(0.002, dt);

    const t2 = this.tileAt(p.x, p.z);
    if (t2 === 'L' && p.dash <= 0) {
      this.hurtPlayer(1, 0, 0, true);
      p.x = p.safeX; p.z = p.safeZ;
      this.fx.sparks(p.x, 0.3, p.z, 0xff7a1a, 10);
    } else if (t2 !== 'L') {
      const near = this.tileAt(p.x + 0.45, p.z) === 'L' || this.tileAt(p.x - 0.45, p.z) === 'L' || this.tileAt(p.x, p.z + 0.45) === 'L' || this.tileAt(p.x, p.z - 0.45) === 'L';
      if (!near) { p.safeX = p.x; p.safeZ = p.z; }
    }

    if (this.isPrologue) return; // no prólogo o Lucas só pode fugir
    if (p.weapons >= 2) {
      if (inp.attackPressed) { this.attack(); p.charging = true; p.charge = 0; }
      if (inp.attack && p.charging) {
        const before = p.charge;
        p.charge += dt;
        if (before < this.stats.laserCharge && p.charge >= this.stats.laserCharge) sfx('carga');
        if (p.charge > 0.25) { p.aimT = 0.2; if (Math.random() < 0.5) this.fx.sparks(p.x, 0.8, p.z, 0xff3030, 1); }
      }
      if (inp.attackReleased && p.charging) {
        if (p.charge >= this.stats.laserCharge) this.fireLaser();
        p.charging = false; p.charge = 0;
      }
    } else if (inp.attack && p.atkCd <= 0) this.attack();
  }

  targets() {
    const list = this.room.enemies.filter((e) => e.alive);
    const b = this.room.boss;
    if (b && b.alive && b.state !== 'dormindo' && b.state !== 'intro') list.push(b);
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
    if ((e && d < 1.3) || p.weapons === 0) {
      p.meleeT = 0.22; p.meleeSide = 1 - p.meleeSide; p.atkCd = 0.32;
      sfx('soco');
      let hit = false;
      for (const t of this.targets()) {
        const dx = t.x - p.x, dz = t.z - p.z, dist = Math.hypot(dx, dz);
        if (dist < 1.25 + t.r && (dx * fx + dz * fz) / (dist || 1) > 0.2) { this.damage(t, 2, fx, fz); hit = true; }
      }
      this.hitTile(p.x + fx * 0.8, p.z + fz * 0.8, 1, false);
      if (!hit) this.fx.sparks(p.x + fx * 0.6, 0.7, p.z + fz * 0.6, 0xffffff, 2);
      return;
    }
    p.aimT = 0.5;
    p.atkCd = this.stats.fireCooldown;
    sfx('fogo');
    const sideX = fz, sideZ = -fx;
    const offs = p.weapons >= 2 ? [-0.24, 0.24] : [0.24];
    for (const o of offs) this.spawnShot(p.x + fx * 0.5 + sideX * o, p.z + fz * 0.5 + sideZ * o, fx, fz);
  }

  spawnShot(x, z, dx, dz) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(BALL, material(0xffe27a, 'glow')); core.scale.setScalar(0.1); g.add(core);
    const outer = new THREE.Mesh(BALL, material(0xff5a14, 'glow', 0.7)); outer.scale.setScalar(0.17); g.add(outer);
    g.position.set(x, 0.85, z);
    this.scene.add(g);
    this.shots.push({ x, z, dx, dz, speed: 11, life: 1.1, dmg: this.stats.fireDamage, g, outer });
  }

  fireLaser() {
    const p = this.player;
    const { e } = this.nearestTarget(12);
    if (e) p.face = Math.atan2(e.x - p.x, e.z - p.z);
    const fx = Math.sin(p.face), fz = Math.cos(p.face);
    let len = 0;
    while (len < 14) {
      const tx = p.x + fx * (len + 0.1), tz = p.z + fz * (len + 0.1);
      if (SOLID.has(this.tileAt(tx, tz))) { this.hitTile(tx, tz, 3, true); break; }
      len += 0.1;
    }
    for (const t of this.targets()) {
      const dx = t.x - p.x, dz = t.z - p.z;
      const along = dx * fx + dz * fz, perp = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < len + t.r && perp < 0.45 + t.r) this.damage(t, this.stats.laserDamage, fx, fz);
    }
    const g = new THREE.Group();
    const outer = new THREE.Mesh(BEAM, material(0xff2020, 'glow', 0.75)); outer.scale.set(0.16, 0.16, len); g.add(outer);
    const core = new THREE.Mesh(BEAM, material(0xffffff, 'glow')); core.scale.set(0.06, 0.06, len); g.add(core);
    g.position.set(p.x + fx * len / 2, 0.85, p.z + fz * len / 2);
    g.rotation.y = p.face;
    this.scene.add(g);
    this.lasers.push({ g, life: 0.3 });
    p.aimT = 0.5;
    sfx('laser');
    this.shake = Math.max(this.shake, 0.25);
  }

  hitTile(x, z, power, fromFire) {
    const r = this.room;
    const tx = Math.floor(x - r.off.x), tz = Math.floor(z - r.off.z);
    if (tx < 0 || tz < 0 || tx >= r.w || tz >= r.h) return false;
    const t = this.tiles[tz][tx];
    if (t === 'T' && fromFire) {
      const torch = r.vis.torches.find((o) => o.tx === tx && o.ty === tz);
      if (torch && !torch.lit) {
        torch.lit = true; torch.flame.visible = true;
        sfx('tocha');
        this.fx.sparks(r.off.x + torch.lx, 1.2, r.off.z + torch.lz, 0xff9a30, 10);
        this.lightTimer = 0;
      }
      return true;
    }
    if (t === 'Q') {
      const c = r.vis.cracks.find((o) => o.tx === tx && o.ty === tz);
      if (c && !c.broken) {
        c.hp -= power;
        this.fx.sparks(r.off.x + tx + 0.5, 0.7, r.off.z + tz + 0.5, 0xaaaaaa, 5);
        sfx('acerto');
        if (c.hp <= 0) {
          c.broken = true; c.group.visible = false;
          this.tiles[tz][tx] = '.';
          this.fx.smoke(r.off.x + tx + 0.5, r.off.z + tz + 0.5, 1.4);
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
    if (p.dead || p.dash > 0 || this.cine) return;
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
    p.dead = true; p.hp = 0;
    this.fx.smoke(p.x, p.z, 1.5);
    this.ui.bigText(this.isPrologue ? 'Os monstros pegaram o Lucas!' : 'O Lunerb desmaiou...', 1600);
    setTimeout(() => {
      if (!this.running) return;
      p.x = this.respawn.x; p.z = this.respawn.z;
      p.safeX = p.x; p.safeZ = p.z;
      p.hp = MAX_HP; p.inv = 2; p.dead = false; p.kvx = p.kvz = 0;
      for (const e of this.room.enemies) {
        if (e.chase && e.alive) { e.alive = false; e.m.root.visible = false; } // no prólogo os perseguidores somem e voltam a sair
        else e.awake = false;
      }
      this.room.enterT = 0; this.room.spawnT = 0;
      const b = this.room.boss;
      if (b && b.alive && b.state !== 'dormindo') { b.state = 'perseguir'; b.t = 0; b.x = b.hx; b.z = b.hz; }
    }, 1700);
  }

  // ---------------- monstros ----------------
  updateEnemy(e, dt) {
    const p = this.player;
    const d = e.def;
    e.t += dt;
    e.hit = Math.max(0, e.hit - dt);
    const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz);
    if (!e.chase) {
      if (!e.awake && dist < d.aggro && !p.dead) e.awake = true;
      if (e.awake && (dist > d.aggro * 2.2 || p.dead)) e.awake = false;
    }
    let vx = 0, vz = 0;
    if (e.awake && !p.dead) {
      let sp = e.speed;
      if (d.hop) sp = (e.t % 0.9) < 0.5 ? e.speed : 0;
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
    if (!p.dead && dist < e.r + P_R + 0.05) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1));
  }

  // Prólogo: os monstros não param de sair de trás
  updateSpawners(dt) {
    const room = this.room;
    if (!room.pr.spawners.length || this.player.dead) return;
    if (room.enterT < 1.2) return;
    room.spawnT -= dt;
    const alive = room.enemies.filter((e) => e.alive).length;
    if (room.spawnT <= 0 && alive < 4) {
      room.spawnT = 2.6;
      const s = room.pr.spawners[Math.floor(Math.random() * room.pr.spawners.length)];
      const e = this.makeEnemy('zumbi', room.off.x + s.x + 0.5, room.off.z + s.y + 0.5, true);
      e.m.root.visible = true;
      room.enemies.push(e);
      this.fx.smoke(e.x, e.z, 0.8);
      if (!room.warned) { room.warned = true; sfx('rugido'); }
      if (!this.chaseStarted) {
        this.chaseStarted = true;
        playMusic('boss');
        this.frozen = true;
        this.input.reset();
        this.ui.dialog([{ who: 'Lucas', text: 'O que é isso?! MONSTROS!' }, { who: 'Lucas', text: 'Eles estão vindo atrás de mim! Preciso CORRER!' }], () => {
          this.frozen = false;
          this.ui.toast('Fuja pelo portal do outro lado!');
        });
      }
    }
  }

  damage(e, dmg, kx, kz) {
    if (!e.alive) return;
    if (e.type === 'capitao' && (e.state === 'intro' || e.state === 'dormindo')) return;
    e.hit = 0.15;
    const kb = e.type === 'capitao' ? 0.6 : 4;
    e.kvx = (kx || 0) * kb; e.kvz = (kz || 0) * kb;
    if (e.armor > 0) {
      e.armor -= dmg;
      this.fx.sparks(e.x, 0.9, e.z, 0xcfd6dd, 5);
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
    this.fx.sparks(e.x, 0.8, e.z, 0xff9a30, 4);
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
    const b = this.room.boss;
    const p = this.player;
    b.t += dt;
    b.hit = Math.max(0, b.hit - dt);
    const dx = p.x - b.x, dz = p.z - b.z, dist = Math.hypot(dx, dz);
    const broken = b.armor <= 0;
    if (b.state === 'dormindo') {
      if (dist < 6.5 && !p.dead && this.room.enterT > 0.6) this.startBossIntro();
      return;
    }
    if (p.dead) return;
    const speed = broken ? 2.0 : 1.35;
    switch (b.state) {
      case 'perseguir':
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
      case 'erguer':
        if (b.t > 0.75) { b.state = 'pancada'; b.t = 0; sfx('pancada'); this.shake = 0.45; b.ring = this.fx.ring(b.x, b.z, 5, 0.7); }
        break;
      case 'pancada':
        if (b.ring && Math.abs(dist - b.ring.r) < 0.45 && b.ring.t < b.ring.dur) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1));
        if (b.t > 1.1) { b.state = 'perseguir'; b.t = 0; b.ring = null; }
        break;
      case 'mirar':
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 6);
        if (b.t > 0.7) { b.state = 'investida'; b.t = 0; b.chargeDx = dx / (dist || 1); b.chargeDz = dz / (dist || 1); sfx('rugido'); }
        break;
      case 'investida': {
        const ox = b.x, oz = b.z;
        this.move(b, b.chargeDx * 7.5 * dt, b.chargeDz * 7.5 * dt, b.r, 'enemy');
        b.moving = true;
        for (let i = 0; i < 2; i++) this.fx.spawn(b.x, 0.2, b.z, { color: 0x777777, size: 0.25, vy: 1, life: 0.4 });
        if (Math.hypot(b.x - ox, b.z - oz) < 7.5 * dt * 0.4) { b.state = 'tonto'; b.t = 0; this.shake = 0.35; sfx('pancada'); this.ui.toast('Ele bateu na parede! Ataque agora!'); }
        else if (b.t > 0.9) { b.state = 'perseguir'; b.t = 0; }
        break;
      }
      case 'tonto':
        b.moving = false;
        if (Math.random() < 0.3) this.fx.sparks(b.x, 2.6, b.z, 0xffff66, 1);
        if (b.t > 1.6) { b.state = 'perseguir'; b.t = 0; }
        break;
    }
    if (broken) {
      b.spawnT += dt;
      const alive = this.room.enemies.filter((e) => e.alive).length;
      if (b.spawnT > 9 && alive < 4) { b.spawnT = 0; this.spawnHorde(2, false); }
    }
    if (dist < b.r + P_R && b.state !== 'tonto') this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1));
    this.ui.bossBar('CAPITÃO DE FERRO', b.armor / b.maxArmor, b.hp / b.maxHp);
  }

  startBossIntro() {
    this.room.boss.state = 'intro';
    this.cine = { kind: 'boss', t: 0 };
    this.input.reset();
    playMusic('boss');
    sfx('rugido');
  }

  updateCine(dt) {
    const c = this.cine;
    c.t += dt;
    const b = this.room.boss;
    if (c.kind === 'boss') {
      this.viewTarget = this.focusView(b.x, b.z, 3.4);
      if (c.t > 0.6 && !c.shown) { c.shown = true; this.ui.bigText('CAPITÃO DE FERRO', 1800, 'boss'); this.shake = 0.5; }
      b.m.arms.forEach((a) => (a.rotation.x = -2.6 + Math.sin(c.t * 10) * 0.2));
      if (c.t > 2.6) {
        this.cine = null;
        b.state = 'perseguir'; b.t = 0;
        this.viewTarget = this.fitRoom(this.room);
        this.spawnHorde(3, true);
      }
    } else if (c.kind === 'bossDown') {
      this.viewTarget = this.focusView(b.x, b.z, 4);
      if (c.t > 2.2) {
        this.cine = null;
        this.viewTarget = this.fitRoom(this.room);
        this.ui.dialog([{ who: 'Lunerb', text: 'Consegui! O portão da saída abriu!' }], () => {});
      }
    } else if (c.kind === 'lago') {
      // o Lucas é encurralado e cai no lago de lodo
      const p = this.player;
      if (c.t < 1.0) {
        const k = Math.min(1, dt * 3);
        p.x += (c.lx - p.x) * k; p.z += (c.lz - p.z) * k;
        p.face = Math.atan2(c.lx - p.x, c.lz - p.z);
        p.moving = true;
      } else {
        p.moving = false;
        p.sink = Math.min(1.6, p.sink + dt * 1.1);
        if (Math.random() < 0.7) this.fx.spawn(p.x + (Math.random() - 0.5) * 0.6, 0.1, p.z + (Math.random() - 0.5) * 0.6, { color: 0x7dff5a, size: 0.12, vy: 1.2, life: 0.6, emissive: 1 });
        if (!c.splash) { c.splash = true; sfx('puf'); this.ui.flash('green'); this.shake = 0.3; }
      }
      this.viewTarget = this.focusView(p.x, p.z, 3.2);
      if (c.t > 2.3 && !c.faded) { c.faded = true; this.ui.fade(true); }
      if (c.t > 3.4) { this.cine = null; this.finish(true); }
    }
  }

  spawnHorde(n, armored) {
    const b = this.room.boss;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      let x = b.hx + Math.cos(a) * 4, z = b.hz + Math.sin(a) * 4;
      if (this.solidLocal(Math.floor(x - this.room.off.x), Math.floor(z - this.room.off.z), 'enemy')) { x = b.hx; z = b.hz; }
      const e = this.makeEnemy(armored && i === 0 ? 'armadura' : 'zumbi', x, z, false);
      e.awake = true;
      e.m.root.visible = true;
      this.room.enemies.push(e);
      this.fx.smoke(x, z, 1);
    }
  }

  bossArmorBroken() {
    this.ui.toast('A armadura caiu! Agora ele está mais rápido!');
    this.shake = 0.5;
    const b = this.room.boss;
    if (!b.hordeDone) { b.hordeDone = true; this.spawnHorde(3, true); }
  }

  bossDefeated() {
    const b = this.room.boss;
    this.ui.bossBar(null);
    this.fx.armorPieces(b.x, b.z, 2);
    this.cine = { kind: 'bossDown', t: 0 };
    this.ui.bigText('CAPITÃO DE FERRO DERROTADO!', 2000, 'boss');
    sfx('clang');
    for (let i = 0; i < 12; i++) this.dropCrystal(b.x, b.z);
    for (const e of this.room.enemies) if (e.alive) this.kill(e);
    this.setGateLocked(this.room.vis.exit, false);
    this.gateLight.intensity = 4;
    sfx('porta');
    playMusic(this.def.music);
  }

  // ---------------- tiros e coletáveis ----------------
  updateShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      s.x += s.dx * s.speed * dt; s.z += s.dz * s.speed * dt;
      s.g.position.set(s.x, 0.85, s.z);
      s.outer.scale.setScalar(0.17 + Math.sin(this.time * 30) * 0.02);
      if (Math.random() < 0.6) this.fx.spawn(s.x, 0.85, s.z, { color: 0xff7a1a, size: 0.1, life: 0.25, emissive: 1.2, vy: 0.4 });
      let dead = s.life <= 0;
      if (SOLID.has(this.tileAt(s.x, s.z))) { this.hitTile(s.x, s.z, 1, true); dead = true; this.fx.sparks(s.x, 0.85, s.z, 0xff9a30, 4); }
      if (!dead) for (const e of this.targets()) {
        if (Math.hypot(e.x - s.x, e.z - s.z) < e.r + 0.2) { this.damage(e, s.dmg, s.dx, s.dz); dead = true; break; }
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
        if (k.kind === 'cristal') { this.result.crystals++; sfx('cristal'); } else { p.hp = Math.min(MAX_HP, p.hp + 1); sfx('coracao'); }
        this.scene.remove(k.g);
        this.pickups.splice(i, 1);
      }
    }
  }

  checkTriggers() {
    const p = this.player;
    if (p.dead) return;
    const room = this.room, ox = room.off.x, oz = room.off.z;
    for (const c of room.vis.chests) {
      if (c.open || Math.hypot(ox + c.lx - p.x, oz + c.lz - p.z) > 0.95) continue;
      c.open = true;
      sfx('bau');
      this.fx.sparks(ox + c.lx, 0.6, oz + c.lz, 0xffe070, 12);
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
        for (let i = 0; i < 15; i++) this.dropCrystal(ox + c.lx, oz + c.lz);
        this.ui.toast('⭐ Baú secreto encontrado!');
      } else for (let i = 0; i < 8; i++) this.dropCrystal(ox + c.lx, oz + c.lz);
    }
    for (const h of room.vis.hearts) {
      if (h.taken || p.hp >= MAX_HP) continue;
      if (Math.hypot(ox + h.lx - p.x, oz + h.lz - p.z) < 0.6) { h.taken = true; h.mesh.visible = false; p.hp = Math.min(MAX_HP, p.hp + 1); sfx('coracao'); }
    }
    for (const c of room.vis.checkpoints) {
      if (c.active || Math.hypot(ox + c.lx - p.x, oz + c.lz - p.z) > 0.95) continue;
      c.active = true; c.flame.visible = true; c.smoke.visible = false;
      this.respawn = { x: ox + c.lx, z: oz + c.lz + 0.8 };
      p.hp = MAX_HP;
      sfx('fogueira');
      this.ui.toast('🔥 Fogueira acesa! Você volta aqui se desmaiar.');
      this.fx.sparks(ox + c.lx, 0.5, oz + c.lz, 0x6ab8ff, 14);
    }
    const portal = room.vis.portal;
    if (portal && Math.hypot(ox + portal.lx - p.x, oz + portal.lz - p.z) < 0.75) this.startTransition(room.i + 1);
    const ex = room.vis.exit;
    if (ex && Math.hypot(ox + ex.lx - p.x, oz + ex.lz - p.z) < 0.75) {
      if (ex.locked) { if (!this.lockMsg) { this.lockMsg = true; this.ui.toast('O portão está trancado! Derrote o Capitão de Ferro.'); setTimeout(() => (this.lockMsg = false), 3000); } }
      else this.finish(false);
    }
    // prólogo: a beira do lago de lodo
    if (room.pr.lake.length && !this.cine) {
      let best = null, bd = 1.05;
      for (const t of room.pr.lake) {
        const d = Math.hypot(ox + t.x + 0.5 - p.x, oz + t.y + 0.5 - p.z);
        if (d < bd) { bd = d; best = t; }
      }
      if (best) {
        this.cine = { kind: 'lago', t: 0, lx: ox + best.x + 0.5, lz: oz + best.y + 0.5 };
        this.input.reset();
        for (const e of room.enemies) e.speed = 0.6;
        this.ui.toast('Não! Não tem para onde fugir...', 2000);
      }
    }
    if (!this.isPrologue && !this.tips.turbo && p.turbo >= 1.5 && this.time > 25) { this.tips.turbo = true; this.ui.toast('Botão roxo: TURBO NEGRO! ⚡ Atravessa os monstros!'); }
  }

  startTransition(next) {
    if (this.trans || next >= this.rooms.length) return;
    sfx('porta');
    this.input.reset();
    const from = this.room;
    const to = this.rooms[next];
    to.vis.group.visible = true;
    this.trans = { t: 0, from, to, fromView: { ...this.view }, toView: this.fitRoom(to) };
    this.player.model.root.visible = false;
    for (const s of this.shots) this.scene.remove(s.g);
    this.shots = [];
    for (const k of this.pickups) { if (k.kind === 'cristal') this.result.crystals++; this.scene.remove(k.g); }
    this.pickups = [];
  }

  updateTransition(dt) {
    const tr = this.trans;
    tr.t += dt / 0.9;
    const k = tr.t < 1 ? 0.5 - Math.cos(Math.PI * tr.t) / 2 : 1;
    this.view.cx = tr.fromView.cx + (tr.toView.cx - tr.fromView.cx) * k;
    this.view.cy = tr.fromView.cy + (tr.toView.cy - tr.fromView.cy) * k;
    this.view.half = tr.fromView.half + (tr.toView.half - tr.fromView.half) * k;
    if (tr.t >= 1) {
      this.trans = null;
      this.enterRoom(tr.to.i);
      this.view = { ...this.viewTarget };
      this.player.model.root.visible = true;
      this.fx.smoke(this.player.x, this.player.z, 0.6);
    }
  }

  finish(prologue) {
    if (this.ended) return;
    this.ended = true;
    this.frozen = true;
    this.result.finished = true;
    if (!prologue) {
      sfx('porta');
      playMusic('victory');
      this.ui.bigText('FASE COMPLETA!', 1500);
    }
    setTimeout(() => { if (this.running) this.onComplete && this.onComplete(this.result); }, prologue ? 300 : 1600);
  }

  forceComplete() {
    const b = this.rooms[this.rooms.length - 1].boss;
    if (b && b.alive) { b.alive = false; b.m.root.visible = false; this.ui.bossBar(null); }
    if (this.def.weaponReward > this.player.weapons) this.player.weapons = this.def.weaponReward;
    this.finish(this.isPrologue);
  }

  // ---------------- visual ----------------
  animate(dt) {
    const p = this.player;
    const m = p.model;
    m.root.position.set(p.x, -p.sink, p.z);
    m.root.rotation.y = p.face;
    if (!this.trans) m.root.visible = !p.dead && !(p.inv > 0 && Math.floor(this.time * 14) % 2 === 0);
    p.blob.position.set(p.x, 0.02, p.z);
    const walking = p.moving && (!this.frozen || this.cine) && !this.trans;
    if (walking) p.walkT += dt * (this.isPrologue ? 13 : 11);
    const sw = walking ? Math.sin(p.walkT) * 0.8 : 0;
    m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw;
    m.body.position.y = walking ? Math.abs(Math.sin(p.walkT)) * 0.035 : Math.sin(this.time * 2) * 0.008;
    const aiming = p.aimT > 0 || p.charging;
    m.arms[0].rotation.x = aiming && p.weapons >= 2 ? -1.45 : -sw;
    m.arms[1].rotation.x = aiming && p.weapons >= 1 ? -1.45 : sw;
    if (p.meleeT > 0) {
      const k = Math.sin((1 - p.meleeT / 0.22) * Math.PI);
      if (p.meleeSide) m.arms[1].rotation.x = -1.6 * k; else m.legs[1].rotation.x = -1.3 * k;
    }
    m.body.rotation.x = p.dash > 0 ? 0.4 : (this.isPrologue && walking ? 0.15 : 0);

    for (const e of this.room.enemies) {
      if (!e.alive) continue;
      const r = e.m.root;
      r.position.set(e.x, e.def.fly ? 0.95 + Math.sin(this.time * 4 + e.t) * 0.15 : 0, e.z);
      r.rotation.y = e.face;
      r.scale.setScalar(HERO_SCALE * (e.hit > 0 ? 1.15 : 1));
      const w = Math.sin(this.time * (e.chase ? 12 : 8) + e.x) * (e.moving ? 0.6 : 0.1);
      if (e.type === 'zumbi' || e.type === 'armadura') { e.m.legs[0].rotation.x = w; e.m.legs[1].rotation.x = -w; e.m.arms.forEach((a, i) => (a.rotation.x = -1.3 + Math.sin(this.time * 4 + i) * 0.15)); }
      if (e.type === 'aranha') e.m.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.time * 18 + i) * (e.moving ? 0.35 : 0.05)));
      if (e.type === 'morcego') e.m.wings.forEach((wg, i) => (wg.rotation.z = Math.sin(this.time * 16) * 0.7 * (i ? -1 : 1)));
    }
    const b = this.room.boss;
    if (b && b.alive) {
      const r = b.m.root;
      r.position.set(b.x, 0, b.z);
      r.rotation.y = b.face;
      r.scale.setScalar(2.8 * (b.hit > 0 ? 1.06 : 1));
      const w = b.moving ? Math.sin(this.time * 7) * 0.5 : 0;
      b.m.legs[0].rotation.x = w; b.m.legs[1].rotation.x = -w;
      if (b.state === 'erguer') b.m.arms.forEach((a) => (a.rotation.x = -2.9));
      else if (b.state === 'pancada') b.m.arms.forEach((a) => (a.rotation.x = -0.6));
      else if (b.state === 'tonto') { b.m.arms.forEach((a) => (a.rotation.x = -0.2)); r.rotation.z = Math.sin(this.time * 6) * 0.08; }
      else if (b.state !== 'intro') { b.m.arms.forEach((a, i) => (a.rotation.x = -1.3 + Math.sin(this.time * 4 + i) * 0.15)); r.rotation.z = 0; }
    }

    const v = this.room.vis;
    for (const c of v.chests) if (c.open && c.lidT < 1) { c.lidT = Math.min(1, c.lidT + dt * 3); c.lid.rotation.x = -c.lidT * 1.9; }
    for (const t of v.torches) if (t.lit) t.flame.scale.set(1, 1 + Math.sin(this.time * 12 + t.lx) * 0.15, 1);
    for (const c of v.checkpoints) if (c.active) { c.flame.scale.y = 1 + Math.sin(this.time * 10 + c.lx) * 0.2; c.flame.rotation.y += dt * 2; }
    for (const h of v.hearts) if (!h.taken) { h.mesh.rotation.y += dt * 2; h.mesh.position.y = Math.sin(this.time * 3) * 0.08; }
    for (const g of [v.portal, v.exit]) if (g && !g.locked) g.glow.material.opacity = 0.45 + Math.sin(this.time * 3) * 0.15;
    const dp = this.dust.geometry.attributes.position;
    for (let i = 0; i < dp.count; i++) { let y = dp.getY(i) + dt * 0.15; if (y > 2.5) y = -1.5; dp.setY(i, y); }
    dp.needsUpdate = true;
  }

  updateLights(dt) {
    const p = this.player;
    this.playerLight.position.set(p.x - 0.4, 2.6, p.z - 0.4);
    this.playerLight.intensity = p.dash > 0 ? 8 : this.themeCfg.player;
    this.playerLight.color.setHex(p.dash > 0 ? 0xb070ff : 0xffcf9a);
    this.lightTimer -= dt;
    const room = this.room;
    if (this.lightTimer <= 0) {
      this.lightTimer = 0.25;
      const lit = room.vis.torches.filter((t) => t.lit).slice(0, this.torchLights.length);
      this.torchLights.forEach((l, i) => {
        const o = lit[i];
        if (o) { l.position.set(room.off.x + o.lx, 1.45, room.off.z + o.lz); l.userData.on = true; } else l.userData.on = false;
      });
    }
    for (const l of this.torchLights) l.intensity = l.userData.on ? this.themeCfg.torch + Math.sin(this.time * 11 + l.position.x) * 0.6 : 0;
  }

  updateCamera(dt) {
    if (!this.trans) {
      const k = 1 - Math.pow(0.02, dt);
      this.view.cx += (this.viewTarget.cx - this.view.cx) * k;
      this.view.cy += (this.viewTarget.cy - this.view.cy) * k;
      this.view.half += (this.viewTarget.half - this.view.half) * k;
    }
    this.shake = Math.max(0, this.shake - dt);
    const s = this.shake * 0.4;
    const cx = this.view.cx + (Math.random() - 0.5) * s, cy = this.view.cy + (Math.random() - 0.5) * s;
    const center = CAM_R.clone().multiplyScalar(cx).add(CAM_U.clone().multiplyScalar(cy));
    this.camera.position.copy(center).addScaledVector(DIR, 60);
    this.camera.lookAt(center);
    const aspect = innerWidth / innerHeight;
    const h = this.view.half;
    this.camera.left = -h * aspect; this.camera.right = h * aspect; this.camera.top = h; this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }

  hud(force) {
    const p = this.player;
    const st = `${p.hp}|${this.result.crystals}|${Math.floor(p.turbo * 10)}`;
    if (!force && st === this._hud) return;
    this._hud = st;
    this.ui.hud({ hp: p.hp, maxHp: MAX_HP, crystals: this.result.crystals, turbo: p.turbo, showCrystals: !this.isPrologue });
  }
}

function turnTo(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}
