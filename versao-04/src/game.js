// O jogo: salas-maquete, herói, monstros, tiros, baús, fogueiras, prólogo da fuga e o Capitão de Ferro.
import * as THREE from '../vendor/three.module.min.js';
import { parseLevel, getLevel, SOLID, ROOM_SPACING } from './levels.js';
import { buildRoom, sharedMaterials } from './world.js';
import { buildHero, buildZumbi, buildAranha, buildMorcego, buildCristal, buildCoracao, buildCogumelo, buildEspinho, buildMaeTeia, buildAnciao } from './models.js';
import { material, applyRim, groundGlow } from './geo.js';
import { tex } from './textures.js';
import { FX } from './fx.js';
import { sfx, playMusic, humStart, humStop, playAmbience, stopAmbience } from './audio.js';
import { ITEMS, normalizeInventory, addItem, useAmmo, select, shopPrice, findSlot } from './inventory.js';
import * as Props from './props.js';
import { weaponStats, UPGRADES, upgradeCost, buyUpgrade } from './progress.js';

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
  cogumelo: { hp: 3, armor: 0, speed: 1.05, r: 0.32, aggro: 6, drop: 2, build: buildCogumelo },
  espinho: { hp: 4, armor: 0, speed: 0, r: 0.36, aggro: 7.5, drop: 2, still: true, build: buildEspinho },
};

// cores do contorno de cada personagem (decididas com o Luis)
const RIM = { hero: 0xffd8b0, inimigo: 0x6dff3a, chefe: 0x7dff4a, mercador: 0xc58cff, feligon: 0x7dff6a, dait: 0x2ee6ff };

const BOSS = {
  capitao: { name: 'CAPITÃO DE FERRO', scale: 2.8, hp: 32, armor: 26, r: 0.8 },
  maeteia: { name: 'MÃE-TEIA', scale: 2.7, hp: 42, armor: 0, r: 0.85 },
  anciao: { name: 'ANCIÃO OCO', scale: 2.1, hp: 30, armor: 30, r: 1.0 },
};

const THEMES = {
  forest: { bg: 'bgForest', hemi: [0xbfe3ff, 0x3a4a2a, 1.45], sun: [0xfff0d0, 2.6], player: 0, torch: 0, exposure: 1.2 },
  forestNight: { bg: 'bgForest', hemi: [0x9ab8e8, 0x2a3a24, 1.35], sun: [0xbcd0ff, 2.0], player: 4, torch: 7, exposure: 1.35 },
  castle: { bg: 'bgCastle', hemi: [0xb4c0f0, 0x40363a, 1.6], sun: [0xdde4ff, 2.4], player: 4, torch: 7, exposure: 1.45 },
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
  start(levelId, save, { testMode = false, onComplete, onDeath, onPersist } = {}) {
    this.dispose();
    const def = getLevel(levelId);
    this.def = def;
    this.isPrologue = def.kind === 'prologo';
    this.save = save;
    this.testMode = testMode;
    this.onComplete = onComplete;
    this.onDeath = onDeath;
    this.onPersist = onPersist;
    this.stats = weaponStats(save);
    this.inv = normalizeInventory(save.inventory);
    this.difficulty = def.difficulty || 1;
    const theme = THEMES[def.light || def.theme];
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
      if (pr.boss) room.boss = this.makeBoss(off.x + pr.boss.x + 0.5, off.z + pr.boss.y + 0.5, pr.boss.type);
      if (vis.exit) this.setGateLocked(vis.exit, !!room.boss);
      if (vis.merchant) { vis.merchant.here = testMode || Math.random() < 0.55; vis.merchant.group.visible = vis.merchant.here; }
      return room;
    });

    // herói
    const model = buildHero(def.hero);
    model.root.scale.setScalar(HERO_SCALE);
    applyRim(model.root, RIM.hero, 0.55);
    scene.add(model.root);
    this.heroGlow = groundGlow(0xffc890, 0.55, 0.35);
    scene.add(this.heroGlow);
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
    this.pendingFriend = !this.isPrologue && def.world >= 2 && save.friends.includes('feligon');

    this.shots = []; this.pickups = []; this.lasers = []; this.bombs = []; this.bolts = []; this.scorches = [];
    this.aim = null; this.beam = null; this.weaponCd = 0; this.arenaItem = null; this.eshots = []; this.friend = null; this.friendAim = null;
    const fret = Props.reticle(0x7dff6a); fret.group.visible = false; scene.add(fret.group); this.friendReticle = fret;
    const ret = Props.reticle(); ret.group.visible = false; scene.add(ret.group); this.reticle = ret;
    this.boomLight = new THREE.PointLight(0xffa040, 0, 14, 1.2); scene.add(this.boomLight);
    this.result = { finished: false, damageTaken: 0, secretFound: false, crystals: 0 };
    this.time = 0; this.shake = 0;
    this.frozen = true; this.cine = null; this.trans = null; this.ended = false;
    this.tips = { turbo: false };
    this.lightTimer = 0;
    if (this.pendingFriend) this.spawnFriend(this.player.x - 0.8, this.player.z);
    this.enterRoom(0, true);
    this.view = { ...this.viewTarget };
    this.running = true;
    this.paused = false;

    this.ui.setControls({ attack: !this.isPrologue, turbo: !this.isPrologue, friend: !!this.friend });
    this.refreshSlots();
    playMusic(def.music);
    playAmbience(def.ambience || def.theme);
    this.ui.titleCard(this.isPrologue ? 'PRÓLOGO' : `MUNDO ${def.world} · FASE ${def.id}`, def.title);
    const token = this.startToken = (this.startToken || 0) + 1;
    setTimeout(() => {
      if (!this.running || token !== this.startToken) return;
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
    humStop();
    stopAmbience();
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

  enterRoom(i, first = false, fromBack = false) {
    const prev = this.room;
    const room = this.rooms[i];
    this.room = room;
    this.tiles = room.tiles;
    room.vis.group.visible = true;
    if (prev && prev !== room) {
      prev.vis.group.visible = false;
      for (const e of prev.enemies) { e.m.root.visible = false; if (e.m.glow) e.m.glow.visible = false; }
      if (prev.boss) { prev.boss.m.root.visible = false; if (prev.boss.m.glow) prev.boss.m.glow.visible = false; }
    }
    for (const e of room.enemies) e.m.root.visible = e.alive;
    if (room.boss) room.boss.m.root.visible = room.boss.alive;
    const p = this.player;
    p.x = room.entry.x; p.z = room.entry.z;
    p.safeX = p.x; p.safeZ = p.z;
    p.face = room.pr.entry.x === 0 ? Math.PI / 2 : 0;
    if (fromBack && room.pr.portal) {
      const pt = room.pr.portal;
      let dx = 0, dz = 0;
      if (pt.x === room.w - 1) dx = -0.75; else if (pt.x === 0) dx = 0.75; else if (pt.y === 0) dz = 0.75; else dz = -0.75;
      p.x = room.off.x + pt.x + 0.5 + dx; p.z = room.off.z + pt.y + 0.5 + dz;
      p.safeX = p.x; p.safeZ = p.z;
      p.face = Math.atan2(dx, dz);
    }
    this.gateArmed = false;
    this.respawn = { x: p.x, z: p.z };
    if (this.friend) { this.friend.cmd = null; this.friend.restT = 0; this.placeFriendNear(p.x, p.z); }
    room.enterT = 0; room.spawnT = 0;
    if (room.boss && room.boss.alive && !first) { p.turbo = 3; p.hp = Math.max(p.hp, 3); this.ui.toast('⚡ Turbo Negro carregado! Corra!', 1800); }
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
    if (!first && Math.random() < 0.4) setTimeout(() => this.running && sfx('susto'), 600);
    this.ui.roomCounter(i + 1, this.rooms.length, room.name);
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
    applyRim(m.root, RIM.inimigo, 0.65);
    m.root.position.set(x, 0, z);
    m.root.visible = false;
    this.scene.add(m.root);
    m.glow = groundGlow(0x5cff3a, 0.5, 0.3);
    m.glow.visible = false;
    this.scene.add(m.glow);
    return {
      type, x, z, hp: d.hp, armor: d.armor, def: d, m, alive: true, awake: chase, chase,
      t: Math.random() * 3, wx: 0, wz: 0, kvx: 0, kvz: 0, face: Math.random() * 6, hit: 0, r: d.r,
      speed: chase ? 2.55 : d.speed,
    };
  }

  makeBoss(x, z, type = 'capitao') {
    const B = BOSS[type];
    const m = type === 'maeteia' ? buildMaeTeia() : type === 'anciao' ? buildAnciao() : buildZumbi({ armor: true, boss: true });
    m.root.scale.setScalar(B.scale);
    applyRim(m.root, RIM.chefe, 0.95);
    m.glow = groundGlow(0x5cff3a, 1.3, 0.45);
    this.scene.add(m.glow);
    m.root.visible = false;
    this.scene.add(m.root);
    m.root.position.set(x, 0, z);
    return {
      type, name: B.name, scale: B.scale, x, z, hx: x, hz: z, hp: B.hp, maxHp: B.hp, armor: B.armor, maxArmor: Math.max(1, B.armor), m, alive: true,
      state: 'dormindo', t: 0, cycle: 0, r: B.r, kvx: 0, kvz: 0, face: -Math.PI / 2, hit: 0, chargeDx: 0, chargeDz: 0,
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
      this.updateBombs(dt);
      this.updateEShots(dt);
      if (this.friend) this.updateFriend(dt);
      this.updateBolts(dt);
      this.updateBeam(dt);
      this.updatePickups(dt);
      this.checkTriggers();
    }
    this.updateScorches(dt);
    this.animate(dt);
    this.animateFriend(dt);
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

    this.weaponCd = Math.max(0, this.weaponCd - dt);
    const locked = !!this.beam || !!this.aim || !!this.friendAim;
    p.slowT = Math.max(0, (p.slowT || 0) - dt);
    let speed = this.isPrologue ? 4.5 : P_SPEED;
    if (this.room.boss && this.room.boss.alive) speed *= 1.2; // na arena o Lunerb corre mais para fugir
    if (p.slowT > 0) speed *= 0.5; // preso na teia
    if (this.tileAt(p.x, p.z) === 'W' && p.dash <= 0) speed *= 0.45;

    if (p.dash > 0) {
      p.dash -= dt;
      this.move(p, p.dashDx * 16 * dt, p.dashDz * 16 * dt, P_R, 'player');
      p.face = Math.atan2(p.dashDx, p.dashDz);
      for (let i = 0; i < 3; i++) this.fx.lightning(p.x, p.z);
      for (const e of this.targets()) {
        if (!p.dashHit.has(e) && Math.hypot(e.x - p.x, e.z - p.z) < e.r + 0.6) { p.dashHit.add(e); this.damage(e, 3, p.dashDx, p.dashDz); }
      }
    } else if (locked) {
      // mirando a bomba ou com a Turbina ligada: o Lunerb fica parado
      this.move(p, p.kvx * dt, p.kvz * dt, P_R, 'player');
      p.moving = false;
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
    if (this.friend) this.handleFriendInput(dt);
    if (this.friendAim) return;
    const slot = this.inv.slots[this.inv.sel];
    const item = slot ? slot.id : 'boot';
    if (item === 'bombas' || item === 'superbomba') { this.handleBombInput(dt, item); return; }
    if (item === 'choque') { if (inp.attackPressed || (inp.attack && this.weaponCd <= 0)) this.fireChoque(); return; }
    if (item === 'turbina') { if (inp.attackPressed) this.toggleBeam(); return; }
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
        torch.lit = true; torch.flame.visible = true; if (torch.ember) torch.ember.visible = false;
        sfx('tocha');
        this.fx.sparks(r.off.x + torch.lx, 1.2, r.off.z + torch.lz, 0xff9a30, 10);
        this.lightTimer = 0;
        // acendeu todas as tochas da sala: chuva de diamantes
        if (!r.torchReward && r.vis.torches.length >= 2 && r.vis.torches.every((o) => o.lit)) {
          r.torchReward = true;
          for (let i = 0; i < 6; i++) this.dropCrystal(r.off.x + torch.lx, r.off.z + torch.lz);
          this.ui.toast('✨ Sala toda iluminada! Ganhou diamantes!');
        }
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

  hurtPlayer(n, kx, kz, ignoreInv = false, launch = 7) {
    const p = this.player;
    if (p.dead || p.dash > 0 || this.cine) return;
    if (p.inv > 0 && !ignoreInv) return;
    if (this.testMode && this.ui.invincible) { p.inv = 0.5; return; }
    p.hp -= n;
    p.inv = 1.1;
    p.kvx = kx * launch; p.kvz = kz * launch;
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
    this.stopBeam();
    this.cancelAim();
    if (!this.isPrologue) {
      this.ui.bigText('O Lunerb desmaiou... a fase recomeça!', 2200);
      this.frozen = true;
      setTimeout(() => { if (this.running && this.onDeath) this.onDeath(this.result, this.inv); }, 2300);
      return;
    }
    this.ui.bigText('Os monstros pegaram o Lucas!', 1600);
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
    // vozes: rosnados, chiados e guinchos de vez em quando
    e.voice = (e.voice ?? 1 + Math.random() * 4) - dt;
    if (e.voice <= 0) {
      e.voice = (e.awake ? 2.5 : 5) + Math.random() * 4;
      if (e.awake || dist < 7) sfx({ zumbi: 'zumbi', armadura: 'zumbi', aranha: 'aranha', morcego: 'morcego', cogumelo: 'cogumelo', espinho: 'espinho' }[e.type] || 'zumbi');
    }
    if (!e.chase) {
      if (!e.awake && dist < d.aggro && !p.dead) e.awake = true;
      if (e.awake && (dist > d.aggro * 2.2 || p.dead)) e.awake = false;
    }
    let vx = 0, vz = 0;
    e.rootT = Math.max(0, (e.rootT || 0) - dt);
    if (e.rootT > 0) { e.moving = false; return; } // preso pelas raízes do Feligon
    if (e.type === 'espinho') return this.updateEspinho(e, dt, dx, dz, dist);
    if (e.type === 'cogumelo' && this.updateCogumelo(e, dt, dx, dz, dist)) return;
    // bote: o zumbi para, levanta os braços e pula em cima do Lunerb
    if ((e.type === 'zumbi' || e.type === 'armadura') && !e.chase) {
      e.lungeCd = Math.max(0, (e.lungeCd || 0) - dt);
      if (e.lunge) {
        e.lunge.t += dt;
        if (e.lunge.t < 0.38) { e.moving = false; e.windup = true; return this.touchCheck(e, dx, dz, dist); }
        e.windup = false;
        if (e.lunge.t < 0.62) {
          this.move(e, e.lunge.dx * 6.5 * dt, e.lunge.dz * 6.5 * dt, e.r, 'enemy');
          e.moving = true;
          return this.touchCheck(e, dx, dz, dist);
        }
        e.lunge = null;
        e.lungeCd = 1.8 / this.difficulty;
      } else if (e.awake && !p.dead && dist < 2.2 && e.lungeCd <= 0) {
        e.lunge = { t: 0, dx: dx / (dist || 1), dz: dz / (dist || 1) };
        sfx('zumbiBote');
        e.face = Math.atan2(dx, dz);
        return;
      }
    }
    if (e.awake && !p.dead) {
      let sp = e.speed * (e.chase ? 1 : this.difficulty);
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
    this.touchCheck(e, dx, dz, dist);
  }

  touchCheck(e, dx, dz, dist) {
    if (!this.player.dead && dist < e.r + P_R + 0.05) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1));
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
        playMusic('chase');
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
    const isBoss = !!e.name;
    if (isBoss && (e.state === 'intro' || e.state === 'dormindo')) return;
    e.hit = 0.15;
    const kb = isBoss ? (e.type === 'anciao' ? 0 : 0.6) : 4;
    e.kvx = (kx || 0) * kb; e.kvz = (kz || 0) * kb;
    if (e.armor > 0) {
      e.armor -= dmg;
      this.fx.sparks(e.x, 0.9, e.z, 0xcfd6dd, 5);
      sfx('acerto');
      if (e.armor <= 0) {
        e.armor = 0;
        if (e.m.armorGroup) e.m.armorGroup.visible = false;
        this.fx.armorPieces(e.x, e.z, isBoss ? 2 : 1);
        sfx(e.type === 'anciao' ? 'quebra' : 'clang');
        if (isBoss) this.bossArmorBroken();
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
    this.fx.smoke(e.x, e.z, e.name ? 3 : 1);
    sfx('puf');
    this.player.turbo = Math.min(3, this.player.turbo + 0.45);
    if (e.name) { this.bossDefeated(); return; }
    if (e.type === 'cogumelo') this.spores(e.x, e.z);
    if (e.rootMesh) e.rootMesh.visible = false;
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
    b.rootT = Math.max(0, (b.rootT || 0) - dt);
    if (b.rootT > 0) { b.moving = false; if (Math.random() < 0.2) this.fx.sparks(b.x, 0.5, b.z, 0x7dff6a, 1); this.ui.bossBar(b.name, b.armor / b.maxArmor, b.hp / b.maxHp); return; }
    if (b.type === 'maeteia') return this.updateMaeTeia(b, dt, dx, dz, dist);
    if (b.type === 'anciao') return this.updateAnciao(b, dt, dx, dz, dist);
    const speed = (broken ? 2.75 : 1.9) * this.difficulty;
    switch (b.state) {
      case 'perseguir':
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 5);
        this.move(b, (dx / (dist || 1)) * speed * dt, (dz / (dist || 1)) * speed * dt, b.r, 'enemy');
        b.moving = true;
        if (b.t > (broken ? 1.1 : 1.7)) {
          b.t = 0; b.cycle++;
          const k = b.cycle % 3;
          b.state = k === 0 ? 'mirar' : k === 1 ? 'agachar' : 'erguer';
          if (broken && k === 2 && Math.random() < 0.5) b.state = 'agachar';
          b.moving = false;
          if (b.state !== 'mirar') sfx('rugido');
        }
        break;
      case 'agachar': // prepara o BOTE
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 10);
        if (b.t > (broken ? 0.32 : 0.45)) {
          b.state = 'bote'; b.t = 0;
          const lead = 0.25; // pula para onde o Lunerb vai estar
          const tx = p.x + (p.moving ? Math.sin(p.face) * P_SPEED * lead : 0), tz = p.z + (p.moving ? Math.cos(p.face) * P_SPEED * lead : 0);
          const ld = Math.hypot(tx - b.x, tz - b.z) || 1;
          b.chargeDx = (tx - b.x) / ld; b.chargeDz = (tz - b.z) / ld;
          this.shake = Math.max(this.shake, 0.25);
        }
        break;
      case 'bote': {
        this.move(b, b.chargeDx * 10 * dt, b.chargeDz * 10 * dt, b.r, 'enemy');
        b.moving = true;
        if (b.t > 0.38) {
          b.state = 'perseguir'; b.t = 0;
          sfx('pancada'); this.shake = Math.max(this.shake, 0.4);
          this.fx.ring(b.x, b.z, 2.2, 0.35, 0xcfd6dd);
          if (dist < 2.4) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1), false, 12);
        }
        break;
      }
      case 'erguer':
        if (b.t > (broken ? 0.5 : 0.65)) { b.state = 'pancada'; b.t = 0; sfx('pancada'); this.shake = 0.5; b.ring = this.fx.ring(b.x, b.z, 6, 0.75); }
        break;
      case 'pancada':
        if (b.ring && Math.abs(dist - b.ring.r) < 0.45 && b.ring.t < b.ring.dur) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1));
        if (b.t > 0.85) { b.state = 'perseguir'; b.t = 0; b.ring = null; }
        break;
      case 'mirar':
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 6);
        if (b.t > 0.5) { b.state = 'investida'; b.t = 0; b.chargeDx = dx / (dist || 1); b.chargeDz = dz / (dist || 1); sfx('rugido'); }
        break;
      case 'investida': {
        const ox = b.x, oz = b.z;
        this.move(b, b.chargeDx * 9 * dt, b.chargeDz * 9 * dt, b.r, 'enemy');
        b.moving = true;
        for (let i = 0; i < 2; i++) this.fx.spawn(b.x, 0.2, b.z, { color: 0x777777, size: 0.25, vy: 1, life: 0.4 });
        if (Math.hypot(b.x - ox, b.z - oz) < 9 * dt * 0.4) { b.state = 'tonto'; b.t = 0; this.shake = 0.35; sfx('pancada'); this.ui.toast('Ele bateu na parede! Ataque agora!'); }
        else if (b.t > 0.9) { b.state = 'perseguir'; b.t = 0; }
        break;
      }
      case 'tonto':
        b.moving = false;
        if (Math.random() < 0.3) this.fx.sparks(b.x, 2.6, b.z, 0xffff66, 1);
        if (b.t > 1.4) { b.state = 'perseguir'; b.t = 0; }
        break;
    }
    this.updateArenaItem(dt);
    if (broken && b.type === 'capitao') {
      b.spawnT += dt;
      const alive = this.room.enemies.filter((e) => e.alive).length;
      if (b.spawnT > 9 && alive < 4) { b.spawnT = 0; this.spawnHorde(2, false); }
    }
    if (dist < b.r + P_R && b.state !== 'tonto') this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1), false, 11);
    this.ui.bossBar(b.name, b.armor / b.maxArmor, b.hp / b.maxHp);
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
      if (c.t > 0.6 && !c.shown) { c.shown = true; this.ui.bigText(b.name, 1800, 'boss'); this.shake = 0.5; sfx(b.type === 'anciao' ? 'arvore' : b.type === 'maeteia' ? 'aranha' : 'rugido'); }
      if (b.type === 'capitao') b.m.arms.forEach((a) => (a.rotation.x = -2.6 + Math.sin(c.t * 10) * 0.2));
      if (c.t > 2.6) {
        this.cine = null;
        b.state = 'perseguir'; b.t = 0;
        this.viewTarget = this.fitRoom(this.room);
        if (b.type === 'capitao') this.spawnHorde(3, true);
        if (b.type === 'maeteia') this.spawnBabies(2);
        this.spawnArenaItem();
      }
    } else if (c.kind === 'bossDown') {
      this.viewTarget = this.focusView(b.x, b.z, 4);
      if (c.t > 2.2) {
        this.cine = null;
        this.viewTarget = this.fitRoom(this.room);
        if (c.type === 'maeteia') this.freeFeligon();
        else if (c.type === 'anciao') this.ui.dialog([{ who: 'Ancião Oco', text: 'Ahh... obrigado, crianças. O lodo saiu de mim.' }, { who: 'Ancião Oco', text: 'Ele vem do pântano. Alguém está despejando lodo nos rios...' }, { who: 'Lunerb', text: 'Então o caminho de casa passa pelo pântano. Vamos!' }], () => {});
        else this.ui.dialog([{ who: 'Lunerb', text: 'Consegui! O portão da saída abriu!' }], () => {});
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
    const b = this.room.boss;
    this.shake = 0.5;
    if (b.type === 'anciao') { this.ui.toast('A casca caiu! Acerte o coração verde!'); return; }
    this.ui.toast('A armadura caiu! Agora ele está mais rápido!');
    if (!b.hordeDone) { b.hordeDone = true; this.spawnHorde(3, true); }
  }

  bossDefeated() {
    const b = this.room.boss;
    this.ui.bossBar(null);
    this.fx.armorPieces(b.x, b.z, 2);
    this.cine = { kind: 'bossDown', t: 0, type: b.type };
    this.ui.bigText(`${b.name} DERROTAD${b.type === 'maeteia' ? 'A' : 'O'}!`, 2000, 'boss');
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
        if (k.kind === 'cristal') { this.addDiamond(); sfx('cristal'); } else { p.hp = Math.min(MAX_HP, p.hp + 1); sfx('coracao'); }
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
      const dch = Math.hypot(ox + c.lx - p.x, oz + c.lz - p.z);
      if (c.waitLeave) { if (dch > 1.4) c.waitLeave = false; continue; }
      if (c.open || dch > 0.95) continue;
      c.open = true;
      sfx('bau');
      this.fx.sparks(ox + c.lx, 0.6, oz + c.lz, 0xffe070, 12);
      if (c.kind === 'arma' && p.weapons < this.def.weaponReward) {
        p.weapons = this.def.weaponReward;
        this.updateGuns();
        this.frozen = true;
        this.input.reset();
        const lines = p.weapons === 1
          ? [{ who: 'Lunerb', text: 'Uma BOOTESHISCORE!' }, { who: 'Dica', text: 'Agora o botão vermelho solta BOLAS DE FOGO! Segure para atirar sem parar.' }, { who: 'Dica', text: 'Lá em cima ficam suas armas. Toque num quadradinho para trocar de arma.' }, { who: 'Dica', text: 'Atire nas tochas apagadas para iluminar o castelo!' }]
          : [{ who: 'Lunerb', text: 'A SEGUNDA BOOTESHISCORE! Agora tenho uma em cada mão!' }, { who: 'Dica', text: 'Toque para atirar com as duas. SEGURE e solte para o LASER POTENTE!' }];
        this.ui.dialog(lines, () => { this.frozen = false; });
      } else if (c.kind === 'arma-nova') {
        this.giveItem(c.loot, c);
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
      const dc = Math.hypot(ox + c.lx - p.x, oz + c.lz - p.z);
      if (dc > 1.5) c.ready = true;
      if (dc > 0.95 || c.ready === false) continue;
      c.ready = false;
      const first = !c.active;
      c.active = true; c.flame.visible = true; c.smoke.visible = false;
      if (p.hp < MAX_HP || first) {
        p.hp = MAX_HP;
        sfx('fogueira');
        this.ui.toast(first ? '🔥 Fogueira azul: sempre que encostar, recupera toda a vida!' : '🔥 Vida cheia!');
        this.fx.sparks(ox + c.lx, 0.5, oz + c.lz, 0x6ab8ff, 14);
      }
    }
    const portal = room.vis.portal, backG = room.vis.back;
    const dPortal = portal ? Math.hypot(ox + portal.lx - p.x, oz + portal.lz - p.z) : 99;
    const dBack = backG ? Math.hypot(ox + backG.lx - p.x, oz + backG.lz - p.z) : 99;
    if (!this.gateArmed && dPortal > 1.15 && dBack > 1.15) this.gateArmed = true;
    if (this.gateArmed && dPortal < 0.75) this.startTransition(room.i + 1);
    else if (this.gateArmed && dBack < 0.6) this.startTransition(room.i - 1, true);
    const mer = room.vis.merchant;
    if (mer && mer.here) {
      const dm = Math.hypot(ox + mer.lx - p.x, oz + mer.lz - p.z);
      if (dm > 1.6) mer.armed = true;
      if (dm < 1.0 && mer.armed !== false) { mer.armed = false; this.openShop(true); }
    }
    const ex = room.vis.exit;
    if (ex && Math.hypot(ox + ex.lx - p.x, oz + ex.lz - p.z) < 0.75) {
      if (ex.locked) { if (!this.lockMsg) { this.lockMsg = true; this.ui.toast('O portão está trancado! Derrote o Capitão de Ferro.'); setTimeout(() => (this.lockMsg = false), 3000); } }
      else this.finish(false);
    }
    // prólogo: a beira do lago de lodo
    if (this.isPrologue && room.pr.lake.length && !this.cine) {
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

  startTransition(next, back = false) {
    if (this.trans || next < 0 || next >= this.rooms.length) return;
    sfx('porta');
    this.input.reset();
    const from = this.room;
    const to = this.rooms[next];
    to.vis.group.visible = true;
    this.trans = { t: 0, from, to, back, fromView: { ...this.view }, toView: this.fitRoom(to) };
    this.player.model.root.visible = false;
    for (const s of this.shots) this.scene.remove(s.g);
    this.shots = [];
    for (const k of this.pickups) { if (k.kind === 'cristal') this.addDiamond(); this.scene.remove(k.g); }
    this.stopBeam();
    this.cancelAim();
    if (this.onPersist) this.onPersist();
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
      this.enterRoom(tr.to.i, false, tr.back);
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
    if (this.def.boss === 'maeteia' && !this.save.friends.includes('feligon')) this.save.friends.push('feligon');
    this.finish(this.isPrologue);
  }

  // ---------------- Mundo 2: inimigos novos ----------------
  updateEspinho(e, dt, dx, dz, dist) {
    e.face = turnTo(e.face, Math.atan2(dx, dz), dt * 5);
    e.moving = false;
    e.shootCd = (e.shootCd ?? 1 + Math.random() * 2) - dt;
    e.aimT = Math.max(0, (e.aimT || 0) - dt);
    if (dist < 7.5 && !this.player.dead) {
      if (e.shootCd <= 0.3 && !e.aimed) { e.aimed = true; e.aimT = 0.3; }
      if (e.shootCd <= 0) {
        e.shootCd = 2.4 / this.difficulty;
        e.aimed = false;
        this.spawnEShot(e.x, e.z, dx / (dist || 1), dz / (dist || 1), 'espinho');
        sfx('espinho');
      }
    }
    this.touchCheck(e, dx, dz, dist);
  }

  updateCogumelo(e, dt, dx, dz, dist) {
    e.puffCd = Math.max(0, (e.puffCd || 0) - dt);
    if (e.puff) {
      e.puff.t += dt;
      e.moving = false;
      if (e.puff.t > 0.6) {
        e.puff = null;
        e.puffCd = 3 / this.difficulty;
        this.spores(e.x, e.z);
        if (dist < 1.75) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1));
      }
      return true;
    }
    if (e.awake && dist < 1.5 && e.puffCd <= 0) { e.puff = { t: 0 }; sfx('cogumelo'); return true; }
    return false;
  }

  spores(x, z) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.6;
      this.fx.spawn(x, 0.4 + Math.random() * 0.4, z, { color: Math.random() < 0.5 ? 0xb8ff6a : 0x7adf3a, size: 0.12 + Math.random() * 0.15, vx: Math.cos(a) * sp, vy: 0.4 + Math.random() * 0.6, vz: Math.sin(a) * sp, life: 0.9 + Math.random() * 0.5, emissive: 1 });
    }
    this.fx.ring(x, z, 1.7, 0.4, 0x9dff5a);
  }

  spawnEShot(x, z, dx, dz, kind, speed = 6) {
    let g;
    if (kind === 'espinho') {
      g = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 5).rotateX(Math.PI / 2), material(0xe8d8a0, 'glow'));
    } else if (kind === 'teia') {
      g = new THREE.Mesh(BALL, material(0xf2f2ff, 'glow', 0.85)); g.scale.setScalar(0.17);
    } else {
      g = new THREE.Mesh(BALL, material(0x7a4a22, 'lit')); g.scale.set(0.14, 0.18, 0.14);
    }
    g.position.set(x, 0.8, z);
    g.rotation.y = Math.atan2(dx, dz);
    this.scene.add(g);
    this.eshots.push({ x, z, dx, dz, speed, life: 2.2, kind, g });
  }

  updateEShots(dt) {
    const p = this.player;
    for (let i = this.eshots.length - 1; i >= 0; i--) {
      const s = this.eshots[i];
      s.life -= dt;
      s.x += s.dx * s.speed * dt; s.z += s.dz * s.speed * dt;
      s.g.position.set(s.x, 0.8, s.z);
      if (s.kind !== 'espinho') s.g.rotation.x += dt * 8;
      let dead = s.life <= 0 || SOLID.has(this.tileAt(s.x, s.z));
      if (!dead && !p.dead && Math.hypot(p.x - s.x, p.z - s.z) < P_R + 0.18) {
        dead = true;
        if (p.dash <= 0) {
          this.hurtPlayer(1, s.dx, s.dz);
          if (s.kind === 'teia') { p.slowT = 2; this.ui.toast('Preso na teia! Mais devagar...', 1200); }
        }
      }
      if (dead) {
        this.fx.sparks(s.x, 0.8, s.z, s.kind === 'teia' ? 0xffffff : 0xc8a060, 4);
        this.scene.remove(s.g);
        this.eshots.splice(i, 1);
      }
    }
  }

  rootVisual(e) {
    if (!e.rootMesh) {
      const g = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 5), material(0x4a7a28, 'lit'));
        c.position.set(Math.cos(a) * 0.32, 0.22, Math.sin(a) * 0.32);
        c.rotation.set(Math.sin(a) * -0.4, 0, Math.cos(a) * 0.4);
        g.add(c);
      }
      this.scene.add(g);
      e.rootMesh = g;
    }
    e.rootMesh.visible = e.alive;
    e.rootMesh.position.set(e.x, 0, e.z);
  }

  // ---------------- Mãe-Teia ----------------
  spawnBabies(n) {
    const b = this.room.boss;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      let x = b.x + Math.cos(a) * 1.6, z = b.z + Math.sin(a) * 1.6;
      if (this.solidLocal(Math.floor(x - this.room.off.x), Math.floor(z - this.room.off.z), 'enemy')) { x = b.x; z = b.z; }
      const e = this.makeEnemy('aranha', x, z, false);
      e.awake = true; e.m.root.visible = true;
      this.room.enemies.push(e);
      this.fx.smoke(x, z, 0.7);
    }
  }

  updateMaeTeia(b, dt, dx, dz, dist) {
    const sp = 3.1 * this.difficulty * (b.hp < b.maxHp / 2 ? 1.2 : 1);
    switch (b.state) {
      case 'perseguir': {
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 7);
        const hop = (b.t % 0.8) < 0.5;
        if (hop) this.move(b, (dx / (dist || 1)) * sp * dt, (dz / (dist || 1)) * sp * dt, b.r, 'enemy');
        b.moving = hop;
        if (b.t > 1.8) {
          b.t = 0; b.cycle++;
          const babies = this.room.enemies.filter((e) => e.alive).length;
          b.state = b.cycle % 4 === 3 && babies < 4 ? 'filhotes' : b.cycle % 2 ? 'cuspir' : 'agachar';
          b.moving = false;
          sfx('aranha');
        }
        break;
      }
      case 'cuspir':
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 10);
        if (b.t > 0.4) {
          const base = Math.atan2(dx, dz);
          for (const off of [-0.3, 0, 0.3]) this.spawnEShot(b.x, b.z, Math.sin(base + off), Math.cos(base + off), 'teia', 6.5);
          sfx('lancar');
          b.state = 'perseguir'; b.t = 0;
        }
        break;
      case 'filhotes':
        if (b.t > 0.5) { this.spawnBabies(2); b.state = 'perseguir'; b.t = 0; }
        break;
      case 'agachar':
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 10);
        if (b.t > 0.35) { b.state = 'bote'; b.t = 0; b.chargeDx = dx / (dist || 1); b.chargeDz = dz / (dist || 1); sfx('aranha'); }
        break;
      case 'bote':
        this.move(b, b.chargeDx * 10 * dt, b.chargeDz * 10 * dt, b.r, 'enemy');
        b.moving = true;
        if (b.t > 0.38) { b.state = 'perseguir'; b.t = 0; this.shake = Math.max(this.shake, 0.3); sfx('pancada'); }
        break;
      default: b.state = 'perseguir';
    }
    if (dist < b.r + P_R) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1), false, 11);
    this.updateArenaItem(dt);
    this.ui.bossBar(b.name, 0, b.hp / b.maxHp);
  }

  // ---------------- Ancião Oco ----------------
  updateAnciao(b, dt, dx, dz, dist) {
    const broken = b.armor <= 0;
    switch (b.state) {
      case 'perseguir':
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 3);
        this.move(b, (dx / (dist || 1)) * 0.6 * this.difficulty * dt, (dz / (dist || 1)) * 0.6 * this.difficulty * dt, b.r, 'enemy');
        b.moving = true;
        if (b.t > (broken ? 1.3 : 1.9)) {
          b.t = 0; b.cycle++;
          b.state = dist < 3.4 ? 'erguer' : b.cycle % 2 ? 'raizes' : 'bolotas';
          b.moving = false;
          sfx('arvore');
          if (b.state === 'raizes') {
            b.spots = [[0, 0], [1.4, 0.6], [-1.2, 1.1], ...(broken ? [[0.6, -1.4]] : [])].map(([ox, oz]) => {
              const x = this.player.x + ox, z = this.player.z + oz;
              const ring = this.fx.ring(x, z, 0.85, 0.9, 0x7dff6a);
              return { x, z, ring };
            });
          }
        }
        break;
      case 'raizes':
        if (b.t > 0.9) {
          for (const s of b.spots) {
            this.rootBurst(s.x, s.z);
            if (Math.hypot(this.player.x - s.x, this.player.z - s.z) < 0.85) this.hurtPlayer(1, 0, 1, false, 9);
          }
          this.shake = Math.max(this.shake, 0.35);
          sfx('raizes');
          b.state = 'perseguir'; b.t = 0;
        }
        break;
      case 'erguer':
        if (b.t > 0.55) { b.state = 'galhada'; b.t = 0; this.fx.ring(b.x, b.z, 3.6, 0.35, 0xb8ff6a); sfx('pancada'); this.shake = 0.45; if (dist < 3.6) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1), false, 14); }
        break;
      case 'galhada':
        if (b.t > 0.6) { b.state = 'perseguir'; b.t = 0; }
        break;
      case 'bolotas':
        if (b.t > 0.45) {
          const base = Math.atan2(dx, dz);
          for (const off of broken ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.35, 0, 0.35]) this.spawnEShot(b.x, b.z, Math.sin(base + off), Math.cos(base + off), 'bolota', 6.5);
          sfx('lancar');
          b.state = 'perseguir'; b.t = 0;
        }
        break;
      default: b.state = 'perseguir';
    }
    if (dist < b.r + P_R) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1), false, 12);
    this.updateArenaItem(dt);
    this.ui.bossBar(b.name, b.armor / b.maxArmor, b.hp / b.maxHp);
  }

  rootBurst(x, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8, 5), material(0x5a3d22, 'lit'));
      c.position.set(Math.cos(a) * 0.35, 0.35, Math.sin(a) * 0.35);
      c.rotation.set(Math.sin(a) * -0.5, 0, Math.cos(a) * 0.5);
      g.add(c);
    }
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.lasers.push({ g, life: 0.6 });
    for (let i = 0; i < 6; i++) this.fx.spawn(x, 0.3, z, { color: 0x6a4a2c, size: 0.12, vx: (Math.random() - 0.5) * 3, vy: 3, vz: (Math.random() - 0.5) * 3, life: 0.8, gravity: 10, shrink: false });
  }

  // ---------------- Feligon: o amigo ----------------
  spawnFriend(x, z) {
    const model = buildHero('feligon');
    model.root.scale.setScalar(HERO_SCALE * 0.95);
    applyRim(model.root, RIM.feligon, 0.6);
    this.scene.add(model.root);
    const glow = groundGlow(0x6aff5a, 0.5, 0.35);
    this.scene.add(glow);
    this.friend = { x, z, face: 0, model, glow, cmd: null, cd: 0, atkCd: 0, restT: 0, walkT: 0, moving: false, hitCheck: 0 };
    this.ui.setControls({ attack: true, turbo: true, friend: true });
  }

  freeFeligon() {
    const room = this.room;
    const co = room.vis.cocoon;
    const already = this.save.friends.includes('feligon');
    if (co) {
      co.g.visible = false;
      const x = room.off.x + co.lx, z = room.off.z + co.lz;
      this.fx.smoke(x, z, 1.5);
      for (let i = 0; i < 20; i++) this.fx.spawn(x, 0.8, z, { color: 0xf2f2ff, size: 0.12, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 4, life: 1, gravity: 6 });
      if (!this.friend) { this.spawnFriend(x, z); this.placeFriendNear(x, z, false); }
    }
    if (already) { this.ui.dialog([{ who: 'Feligon', text: 'Esse casulo de novo? Ainda bem que eu já estava com você!' }], () => {}); return; }
    this.save.friends.push('feligon');
    this.persistInv();
    sfx('amigo');
    this.ui.dialog([
      { who: '???', text: 'Ufa! Alguém me tira daqui... AH, valeu!' },
      { who: 'Feligon', text: 'Eu sou o FELIGON! A aranhona me prendeu nessa teia.' },
      { who: 'Feligon', text: 'Conheço essa floresta inteira. Vou com você até a sua casa!' },
      { who: 'Dica', text: 'O Feligon luta junto. SEGURE o botão verde 🌿 AMIGO, mire com o direcional e solte: ele lança RAÍZES que prendem os monstros e te dão 1 coração!' },
    ], () => {});
  }

  handleFriendInput(dt) {
    const inp = this.input, f = this.friend, p = this.player;
    f.cd = Math.max(0, f.cd - dt);
    if (inp.specialPressed && !this.friendAim && !this.aim && !this.beam) {
      if (f.cd > 0) { this.ui.toast('O Feligon está recuperando o fôlego...', 1000); }
      else {
        this.friendAim = { tx: p.x + Math.sin(p.face) * 2.5, tz: p.z + Math.cos(p.face) * 2.5 };
        this.friendReticle.group.visible = true;
        sfx('mira');
      }
    }
    const a = this.friendAim;
    if (!a) return;
    const d = inp.dir();
    const mx = (d.x + d.y) * SQ2, mz = (-d.x + d.y) * SQ2;
    a.tx += mx * 6 * dt; a.tz += mz * 6 * dt;
    const ddx = a.tx - p.x, ddz = a.tz - p.z, dd = Math.hypot(ddx, ddz);
    if (dd > 7) { a.tx = p.x + ddx / dd * 7; a.tz = p.z + ddz / dd * 7; }
    const room = this.room;
    a.tx = THREE.MathUtils.clamp(a.tx, room.off.x + 0.5, room.off.x + room.w - 0.5);
    a.tz = THREE.MathUtils.clamp(a.tz, room.off.z + 0.5, room.off.z + room.h - 0.5);
    p.face = turnTo(p.face, Math.atan2(a.tx - p.x, a.tz - p.z), dt * 12);
    this.friendReticle.group.position.set(a.tx, 0.04, a.tz);
    this.friendReticle.group.scale.setScalar(2.4 * (1 + Math.sin(this.time * 10) * 0.06));
    this.friendReticle.group.rotation.y -= dt * 2;
    if (!inp.special) {
      f.cmd = { tx: a.tx, tz: a.tz, t: 0 };
      f.cd = 9;
      this.friendAim = null;
      this.friendReticle.group.visible = false;
      p.meleeT = 0.22; p.meleeSide = 1;
      this.ui.toast('🌿 Feligon, AGORA!', 900);
    }
  }

  updateFriend(dt) {
    const f = this.friend, p = this.player;
    this.ui.friendCooldown(f.cd);
    f.atkCd = Math.max(0, f.atkCd - dt);
    if (f.restT > 0) { f.restT -= dt; f.moving = false; return; }
    let tx = null, tz = null, speed = 4.8, target = null;
    // ponto de retaguarda: um pouco atrás do Lunerb
    const bx = p.x - Math.sin(p.face) * 1.5, bz = p.z - Math.cos(p.face) * 1.5;
    if (f.cmd) {
      f.cmd.t += dt;
      tx = f.cmd.tx; tz = f.cmd.tz; speed = 9;
      if (Math.hypot(tx - f.x, tz - f.z) < 0.5 || f.cmd.t > 2.2) { this.castRoots(f.cmd.tx, f.cmd.tz); f.cmd = null; }
    } else {
      // atira de longe no monstro mais perto (tiro fraco: metade da bola de fogo do Lunerb)
      let best = null, bd = 6.5;
      for (const e of this.targets()) { const d = Math.hypot(e.x - f.x, e.z - f.z); if (d < bd) { bd = d; best = e; } }
      target = best;
      if (best) {
        f.face = turnTo(f.face, Math.atan2(best.x - f.x, best.z - f.z), dt * 14);
        if (f.atkCd <= 0) {
          f.atkCd = 0.85;
          f.punch = 0.2;
          const dx = best.x - f.x, dz = best.z - f.z, d = Math.hypot(dx, dz) || 1;
          this.spawnFriendShot(f.x + dx / d * 0.4, f.z + dz / d * 0.4, dx / d, dz / d);
        }
      }
      if (Math.hypot(bx - f.x, bz - f.z) > 0.8) { tx = bx; tz = bz; }
    }
    f.moving = tx !== null;
    if (f.moving) {
      // contorna árvores e paredes procurando o caminho no mapa da sala
      const wp = this.pathStep(f, tx, tz);
      const ddx = wp.x - f.x, ddz = wp.z - f.z, d = Math.hypot(ddx, ddz) || 1;
      const ox = f.x, oz = f.z;
      this.move(f, ddx / d * speed * dt, ddz / d * speed * dt, 0.26, 'player');
      if (!target || f.cmd) f.face = turnTo(f.face, Math.atan2(ddx, ddz), dt * 12);
      // ficou preso mesmo assim? aparece de novo atrás do Lunerb
      f.stuckT = Math.hypot(f.x - ox, f.z - oz) < speed * dt * 0.25 ? (f.stuckT || 0) + dt : 0;
      if (f.stuckT > 1 || Math.hypot(f.x - p.x, f.z - p.z) > 10) this.placeFriendNear(p.x, p.z, true);
    } else f.stuckT = 0;
    // monstro deu bote no Feligon: ele cai e descansa um pouquinho (não se machuca de verdade)
    f.hitCheck -= dt;
    if (f.hitCheck <= 0) {
      f.hitCheck = 0.3;
      for (const e of this.targets()) {
        if ((e.lunge && e.lunge.t > 0.38) || e.state === 'bote' || e.state === 'investida') {
          if (Math.hypot(e.x - f.x, e.z - f.z) < e.r + 0.35) { f.restT = 1.6; this.fx.sparks(f.x, 0.8, f.z, 0xffffff, 6); break; }
        }
      }
    }
  }

  spawnFriendShot(x, z, dx, dz) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(BALL, material(0xd8ffb0, 'glow')); core.scale.setScalar(0.07); g.add(core);
    const outer = new THREE.Mesh(BALL, material(0x5cdf3a, 'glow', 0.75)); outer.scale.setScalar(0.12); g.add(outer);
    g.position.set(x, 0.75, z);
    this.scene.add(g);
    this.shots.push({ x, z, dx, dz, speed: 10, life: 0.9, dmg: this.stats.fireDamage * 0.5, g, outer, friend: true });
    sfx('folha');
  }

  // caminho mais curto (quadradinho por quadradinho) até o alvo, desviando do que é sólido
  pathStep(ent, tx, tz) {
    const room = this.room;
    const sx = Math.floor(ent.x - room.off.x), sz = Math.floor(ent.z - room.off.z);
    let gx = Math.floor(tx - room.off.x), gz = Math.floor(tz - room.off.z);
    const blocked = (x, z) => this.solidLocal(x, z, 'player') || this.tiles[z][x] === 'L';
    if (sx === gx && sz === gz) return { x: tx, z: tz };
    const key = `${sx},${sz}>${gx},${gz}`;
    ent.pathT = (ent.pathT || 0) - 1;
    if (ent.pathKey === key && ent.pathT > 0 && ent.pathNext) return ent.pathNext;
    ent.pathKey = key; ent.pathT = 8;
    if (gx < 0 || gz < 0 || gx >= room.w || gz >= room.h || blocked(gx, gz)) {
      // alvo dentro de algo sólido: procura o quadradinho livre mais perto
      let bestD = 99;
      for (let z = 0; z < room.h; z++) for (let x = 0; x < room.w; x++) {
        if (blocked(x, z)) continue;
        const d = Math.hypot(x - gx, z - gz);
        if (d < bestD) { bestD = d; tx = room.off.x + x + 0.5; tz = room.off.z + z + 0.5; }
      }
      gx = Math.floor(tx - room.off.x); gz = Math.floor(tz - room.off.z);
    }
    const W = room.w, prev = new Int32Array(W * room.h).fill(-1);
    const start = sz * W + sx, goal = gz * W + gx;
    if (sx < 0 || sz < 0 || sx >= W || sz >= room.h) return { x: tx, z: tz };
    prev[start] = start;
    const q = [start];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (q.length) {
      const c = q.shift();
      if (c === goal) break;
      const cx = c % W, cz = (c / W) | 0;
      for (const [dx, dz] of dirs) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= room.h || blocked(nx, nz)) continue;
        if (dx && dz && (blocked(cx + dx, cz) || blocked(cx, cz + dz))) continue; // não corta canto
        const n = nz * W + nx;
        if (prev[n] !== -1) continue;
        prev[n] = c;
        q.push(n);
      }
    }
    if (prev[goal] === -1) { ent.pathNext = { x: tx, z: tz }; return ent.pathNext; }
    let c = goal;
    while (prev[c] !== start && prev[c] !== c) c = prev[c];
    if (c === goal) { ent.pathNext = { x: tx, z: tz }; return ent.pathNext; }
    ent.pathNext = { x: room.off.x + (c % W) + 0.5, z: room.off.z + ((c / W) | 0) + 0.5 };
    return ent.pathNext;
  }

  // coloca o Feligon num lugar livre perto de um ponto (nunca dentro de árvore ou parede)
  placeFriendNear(x, z, poof = false) {
    const f = this.friend, room = this.room;
    if (!f || !room) return;
    let best = null, bd = 99;
    const cx = Math.floor(x - room.off.x), cz = Math.floor(z - room.off.z);
    for (let tz = Math.max(0, cz - 3); tz <= Math.min(room.h - 1, cz + 3); tz++) for (let tx = Math.max(0, cx - 3); tx <= Math.min(room.w - 1, cx + 3); tx++) {
      if (this.solidLocal(tx, tz, 'player') || this.tiles[tz][tx] === 'L' || (tx === cx && tz === cz)) continue;
      const t = this.tiles[tz][tx];
      if (t === 'X' || t === 'E') continue;
      const d = Math.hypot(tx - cx, tz - cz);
      if (d < bd) { bd = d; best = [tx, tz]; }
    }
    if (!best) return;
    f.x = room.off.x + best[0] + 0.5; f.z = room.off.z + best[1] + 0.5;
    f.stuckT = 0; f.pathKey = null;
    if (poof) this.fx.smoke(f.x, f.z, 0.6);
  }

  castRoots(x, z) {
    const p = this.player;
    this.rootBurst(x, z);
    for (let i = 0; i < 3; i++) this.rootBurst(x + Math.cos(i * 2.1) * 0.9, z + Math.sin(i * 2.1) * 0.9);
    this.fx.ring(x, z, 2, 0.5, 0x7dff6a);
    sfx('raizes');
    this.shake = Math.max(this.shake, 0.2);
    let n = 0;
    for (const t of this.targets()) {
      if (Math.hypot(t.x - x, t.z - z) > 2 + t.r) continue;
      t.rootT = t.type === 'capitao' || t.type === 'maeteia' || t.type === 'anciao' ? 1.6 : 3;
      this.damage(t, t.rootT > 2 ? 2 : 3, 0, 0);
      n++;
    }
    if (p.hp < MAX_HP) { p.hp++; sfx('coracao'); this.ui.toast(`🌿 Raízes! ${n ? `${n} monstro${n > 1 ? 's' : ''} preso${n > 1 ? 's' : ''}` : ''} +1 ❤️`, 1400); }
    else if (n) this.ui.toast(`🌿 ${n} monstro${n > 1 ? 's' : ''} preso${n > 1 ? 's' : ''}!`, 1200);
  }

  animateFriend(dt) {
    const f = this.friend;
    if (!f) return;
    const m = f.model;
    m.root.position.set(f.x, 0, f.z);
    m.root.rotation.y = f.face;
    m.root.visible = !this.trans;
    f.glow.position.set(f.x, 0.03, f.z);
    f.glow.visible = m.root.visible;
    if (f.moving) f.walkT += dt * 12;
    const sw = f.moving ? Math.sin(f.walkT) * 0.8 : 0;
    m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw;
    m.arms[0].rotation.x = -sw; m.arms[1].rotation.x = sw;
    f.punch = Math.max(0, (f.punch || 0) - dt);
    if (f.punch > 0) m.arms[1].rotation.x = -1.6 * Math.sin((1 - f.punch / 0.22) * Math.PI);
    if (f.cmd) { m.arms[0].rotation.x = -2.6; m.arms[1].rotation.x = -2.6; }
    m.body.rotation.x = f.restT > 0 ? -0.9 : 0;
    m.body.position.y = f.restT > 0 ? -0.15 : (f.moving ? Math.abs(Math.sin(f.walkT)) * 0.035 : 0);
  }

  // ---------------- bomba escondida num canto da arena ----------------
  spawnArenaItem(avoid = -1) {
    const room = this.room;
    const corners = [[1, 1], [room.w - 2, 1], [1, room.h - 2], [room.w - 2, room.h - 2]].map(([x, y], i) => ({ x, y, i })).filter((c) => c.i !== avoid && !SOLID.has(this.tiles[c.y][c.x]));
    const c = corners[Math.floor(Math.random() * corners.length)];
    if (!c) return;
    const g = new THREE.Group();
    const b = Props.bomb(false);
    b.group.position.y = 0.3;
    g.add(b.group);
    const ring = Props.reticle(0x2ec8ff);
    ring.group.scale.setScalar(0.6);
    g.add(ring.group);
    g.position.set(room.off.x + c.x + 0.5, 0, room.off.z + c.y + 0.5);
    this.scene.add(g);
    this.arenaItem = { g, x: g.position.x, z: g.position.z, corner: c.i, respawn: 0, waitLeave: false, bomb: b };
    this.fx.sparks(g.position.x, 0.5, g.position.z, 0x2ec8ff, 10);
  }

  updateArenaItem(dt) {
    const it = this.arenaItem;
    if (!it) return;
    if (!it.g) {
      it.respawn -= dt;
      if (it.respawn <= 0 && this.room.boss && this.room.boss.alive) this.spawnArenaItem(it.corner);
      return;
    }
    it.bomb.group.rotation.y += dt * 2;
    it.bomb.group.position.y = 0.3 + Math.sin(this.time * 4) * 0.08;
    const p = this.player;
    const d = Math.hypot(it.x - p.x, it.z - p.z);
    if (it.waitLeave) { if (d > 1.4) it.waitLeave = false; return; }
    if (d > 0.7 || p.dead) return;
    const take = (inv) => {
      this.inv = inv;
      this.refreshSlots();
      this.persistInv();
      this.scene.remove(it.g);
      it.g = null;
      it.respawn = 20;
      sfx('bau');
      this.ui.toast('💣 Bombas! Segure ATACAR para mirar.', 1800);
    };
    const r = addItem(this.inv, 'bombas');
    if (r.ok) { take(r.inv); return; }
    if (r.reason === 'ja-tem') return;
    this.paused = true;
    this.input.reset();
    const names = [1, 2].map((i) => `Largar ${ITEMS[this.inv.slots[i].id].icon} ${ITEMS[this.inv.slots[i].id].name}`);
    this.ui.choice('Mochila cheia!', 'Achou 💣 Bombas. Para levar, precisa largar uma arma:', [...names, 'Deixar aqui'], (k) => {
      this.paused = false;
      if (k < 2) take(addItem(this.inv, 'bombas', k + 1).inv); else it.waitLeave = true;
    });
  }

  // ---------------- diamantes, inventário e loja ----------------
  addDiamond() { this.save.crystals++; this.result.crystals++; }

  persistInv() {
    this.save.inventory = this.inv;
    if (this.onPersist) this.onPersist();
  }

  refreshSlots() {
    this.ui.slots(this.isPrologue ? null : { inv: this.inv, weapons: this.player.weapons }, (i) => this.selectSlot(i));
  }

  selectSlot(i) {
    if (!this.running || this.isPrologue || this.inv.sel === i) return;
    this.stopBeam();
    this.cancelAim();
    this.inv = select(this.inv, i);
    sfx('clique');
    this.refreshSlots();
    this.persistInv();
    const s = this.inv.slots[this.inv.sel];
    if (s) this.ui.toast(`${ITEMS[s.id].icon} ${s.id === 'boot' && this.player.weapons === 0 ? 'Soco e chute' : ITEMS[s.id].name}`, 1200);
  }

  // achou uma arma num baú
  giveItem(id, chest) {
    const it = ITEMS[id];
    if (!it) return;
    const r = addItem(this.inv, id);
    if (r.ok) {
      this.inv = r.inv;
      this.refreshSlots();
      this.persistInv();
      if (r.refilled) { this.ui.toast(`${it.icon} Mais ${it.name}!`); return; }
      this.frozen = true;
      this.input.reset();
      this.ui.dialog([{ who: 'Lunerb', text: `Uma arma nova: ${it.icon} ${it.name.toUpperCase()}!` }, { who: 'Dica', text: `${it.desc} Toque no quadradinho dela lá em cima para escolher.` }], () => { this.frozen = false; });
      return;
    }
    if (r.reason === 'ja-tem') {
      for (let i = 0; i < 10; i++) this.dropCrystal(this.room.off.x + chest.lx, this.room.off.z + chest.lz);
      this.ui.toast(`Você já tem ${it.name}. Ganhou diamantes!`);
      return;
    }
    // mochila cheia: escolher o que largar
    this.paused = true;
    this.input.reset();
    const names = [1, 2].map((i) => `Largar ${ITEMS[this.inv.slots[i].id].icon} ${ITEMS[this.inv.slots[i].id].name}`);
    this.ui.choice('Mochila cheia!', `Você achou ${it.icon} ${it.name}. Para levar, precisa largar uma arma:`, [...names, 'Deixar no baú'], (k) => {
      this.paused = false;
      if (k < 2) {
        this.inv = addItem(this.inv, id, k + 1).inv;
        this.refreshSlots();
        this.persistInv();
        this.ui.toast(`${it.icon} ${it.name} na mochila!`);
      } else {
        chest.open = false; chest.lidT = 0; chest.lid.rotation.x = 0; chest.waitLeave = true;
      }
    });
  }

  openShop() {
    this.paused = true;
    this.input.reset();
    this.stopBeam();
    this.cancelAim();
    sfx('mercador');
    const render = () => {
      const items = Object.keys(ITEMS).filter((id) => !ITEMS[id].fixed).map((id) => {
        const slot = findSlot(this.inv, id);
        return { id, ...ITEMS[id], cost: shopPrice(this.inv, id), have: slot >= 0, ammo: slot >= 0 ? this.inv.slots[slot].ammo : null };
      });
      const ups = Object.entries(UPGRADES).map(([key, u]) => ({ key, name: u.name, desc: u.desc, level: this.save.upgrades[key], max: u.costs.length, cost: upgradeCost(this.save, key) }));
      this.ui.shop({ diamonds: this.save.crystals, items, ups, hasBoot: this.player.weapons > 0 }, {
        buy: (id) => this.buyItem(id, render),
        upgrade: (key) => {
          const cost = upgradeCost(this.save, key);
          if (cost === null || this.save.crystals < cost) { this.ui.toast('Diamantes insuficientes'); return; }
          this.save.crystals -= cost;
          this.save.upgrades[key] += 1;
          this.stats = weaponStats(this.save);
          sfx('compra');
          this.persistInv();
          render();
        },
        close: () => { this.paused = false; this.ui.shop(null); this.hud(true); },
      });
    };
    render();
  }

  buyItem(id, render) {
    const price = shopPrice(this.inv, id);
    if (price === null) return;
    if (this.save.crystals < price) { this.ui.toast('Diamantes insuficientes'); return; }
    const done = (inv) => {
      this.save.crystals -= price;
      this.inv = inv;
      sfx('compra');
      this.refreshSlots();
      this.persistInv();
      render();
    };
    const r = addItem(this.inv, id);
    if (r.ok) { done(r.inv); return; }
    const it = ITEMS[id];
    const names = [1, 2].map((i) => `Largar ${ITEMS[this.inv.slots[i].id].icon} ${ITEMS[this.inv.slots[i].id].name}`);
    this.ui.choice('Mochila cheia!', `Para levar ${it.icon} ${it.name}, precisa largar uma arma:`, [...names, 'Cancelar'], (k) => {
      if (k < 2) done(addItem(this.inv, id, k + 1).inv);
    });
  }

  // ---------------- bombas: segura para mirar, solta para jogar ----------------
  handleBombInput(dt, item) {
    const inp = this.input;
    const p = this.player;
    const room = this.room;
    if (inp.attackPressed && !this.aim && this.weaponCd <= 0) {
      // o Lunerb para e o direcional passa a mexer a mira
      this.aim = { item, tx: p.x + Math.sin(p.face) * 2.2, tz: p.z + Math.cos(p.face) * 2.2, beep: 0 };
      this.reticle.group.visible = true;
      sfx('mira');
    }
    const a = this.aim;
    if (!a) return;
    const d = inp.dir();
    const mx = (d.x + d.y) * SQ2, mz = (-d.x + d.y) * SQ2;
    a.tx += mx * 5.5 * dt; a.tz += mz * 5.5 * dt;
    const ddx = a.tx - p.x, ddz = a.tz - p.z, dd = Math.hypot(ddx, ddz);
    if (dd > 6.5) { a.tx = p.x + ddx / dd * 6.5; a.tz = p.z + ddz / dd * 6.5; }
    a.tx = THREE.MathUtils.clamp(a.tx, room.off.x + 0.5, room.off.x + room.w - 0.5);
    a.tz = THREE.MathUtils.clamp(a.tz, room.off.z + 0.5, room.off.z + room.h - 0.5);
    a.dir = Math.atan2(a.tx - p.x, a.tz - p.z);
    p.face = turnTo(p.face, a.dir, dt * 12);
    if (mx || mz) { a.beep += dt; if (a.beep > 0.25) { a.beep = 0; sfx('mira'); } }
    const near = Math.hypot(a.tx - p.x, a.tz - p.z) < (item === 'superbomba' ? 2.6 : 1.7);
    this.reticle.group.position.set(a.tx, 0.04, a.tz);
    const s = (item === 'superbomba' ? 1.6 : 1) * (1 + Math.sin(this.time * 12) * 0.08);
    this.reticle.group.scale.setScalar(s);
    this.reticle.material.color.setHex(near ? 0xffd23a : 0xff3a2a);
    this.reticle.group.rotation.y += dt * 2;
    if (!inp.attack) this.throwBomb();
  }

  cancelAim() {
    this.aim = null;
    if (this.reticle && !this.bombs.length) this.reticle.group.visible = false;
  }

  throwBomb() {
    const a = this.aim;
    this.aim = null;
    if (!a) return;
    const u = useAmmo(this.inv, this.inv.sel);
    if (!u.ok) { this.reticle.group.visible = false; return; }
    this.inv = u.inv;
    this.refreshSlots();
    this.persistInv();
    const p = this.player;
    const sup = a.item === 'superbomba';
    const b = Props.bomb(sup);
    const sx = p.x + Math.sin(a.dir) * 0.35, sz = p.z + Math.cos(a.dir) * 0.35;
    b.group.position.set(sx, 1.1, sz);
    this.scene.add(b.group);
    const dist = Math.hypot(a.tx - sx, a.tz - sz);
    this.bombs.push({ ...b, sx, sz, tx: a.tx, tz: a.tz, t: 0, dur: 0.5 + dist * 0.05, sup, h: 1.2 + dist * 0.25 });
    p.face = a.dir;
    p.meleeT = 0.22; p.meleeSide = 1;
    this.weaponCd = 0.5;
    sfx('lancar');
  }

  updateBombs(dt) {
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.t += dt / b.dur;
      const k = Math.min(1, b.t);
      const x = b.sx + (b.tx - b.sx) * k, z = b.sz + (b.tz - b.sz) * k;
      const y = 1.1 * (1 - k) + 0.18 + Math.sin(Math.PI * k) * b.h;
      b.group.position.set(x, y, z);
      b.group.rotation.x += dt * 9; b.group.rotation.z += dt * 5;
      b.spark.visible = Math.random() < 0.7;
      if (Math.random() < 0.8) this.fx.spawn(x, y + 0.2, z, { color: 0xffd23a, size: 0.06, life: 0.25, emissive: 1.5, vy: 0.5 });
      if (Math.random() < 0.15) sfx('pavio');
      if (k >= 1) {
        this.scene.remove(b.group);
        this.bombs.splice(i, 1);
        this.explode(b.sup, b.tx, b.tz);
        if (!this.bombs.length && !this.aim) this.reticle.group.visible = false;
      }
    }
  }

  explode(sup, x, z) {
    const p = this.player;
    const radius = sup ? 99 : 2.3;
    for (const t of this.targets()) {
      const dx = t.x - x, dz = t.z - z, d = Math.hypot(dx, dz);
      if (d > radius + t.r) continue;
      if (t.name) this.damage(t, sup ? 14 : 6, dx / (d || 1), dz / (d || 1));
      else if (sup) { t.armor = 0; this.damage(t, 99, dx / (d || 1), dz / (d || 1)); }
      else { if (t.armor) t.armor = 0; this.damage(t, 7, dx / (d || 1), dz / (d || 1)); }
    }
    // explosão quebra paredes de dentro (abre caminhos novos!), parede rachada e acende tocha
    const room = this.room;
    const wr = sup ? 2.7 : 1.35;
    let broke = 0;
    for (let ty = 1; ty < room.h - 1; ty++) for (let tx = 1; tx < room.w - 1; tx++) {
      if (this.tiles[ty][tx] !== '#') continue;
      if (Math.hypot(room.off.x + tx + 0.5 - x, room.off.z + ty + 0.5 - z) > wr) continue;
      if (room.vis.breakWall(tx, ty)) {
        this.tiles[ty][tx] = '.';
        broke++;
        const cx = room.off.x + tx + 0.5, cz = room.off.z + ty + 0.5;
        for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28; this.fx.spawn(cx, 0.6, cz, { color: 0x8c8690, size: 0.18 + Math.random() * 0.15, vx: Math.cos(a) * 3, vy: 3 + Math.random() * 3, vz: Math.sin(a) * 3, life: 1.2, gravity: 12, shrink: false, spin: 8 }); }
        this.fx.smoke(cx, cz, 1.2);
      }
    }
    for (let ty = 1; ty < room.h - 1; ty++) for (let tx = 1; tx < room.w - 1; tx++) {
      const tt = this.tiles[ty][tx];
      if (tt !== 'R' && tt !== 'U') continue;
      if (Math.hypot(room.off.x + tx + 0.5 - x, room.off.z + ty + 0.5 - z) > wr) continue;
      const kind = room.vis.breakProp(tx, ty);
      if (!kind) continue;
      this.tiles[ty][tx] = ',';
      broke++;
      const cx = room.off.x + tx + 0.5, cz = room.off.z + ty + 0.5;
      for (let i = 0; i < 8; i++) { const a = Math.random() * 6.28; this.fx.spawn(cx, 0.4, cz, { color: kind === 'U' ? 0x4f8a2e : 0x7c7a80, size: 0.12 + Math.random() * 0.12, vx: Math.cos(a) * 3, vy: 3 + Math.random() * 3, vz: Math.sin(a) * 3, life: 1.1, gravity: 12, shrink: false, spin: 8 }); }
    }
    if (broke) { sfx('quebra'); this.ui.toast(broke > 1 ? 'A bomba abriu um caminho novo!' : 'A bomba quebrou a parede!', 1600); }
    for (const c of room.vis.cracks) if (!c.broken && Math.hypot(room.off.x + c.tx + 0.5 - x, room.off.z + c.ty + 0.5 - z) < (sup ? 6 : 2.4)) this.hitTile(room.off.x + c.tx + 0.5, room.off.z + c.ty + 0.5, 9, false);
    for (const t of room.vis.torches) if (!t.lit && Math.hypot(room.off.x + t.lx - x, room.off.z + t.lz - z) < (sup ? 8 : 2.6)) this.hitTile(room.off.x + t.lx, room.off.z + t.lz, 0, true);
    // perto demais: o Lunerb também se machuca e sai voando
    const dp = Math.hypot(p.x - x, p.z - z);
    if (dp < (sup ? 2.6 : 1.7) && !p.dead) {
      const nx = (p.x - x) / (dp || 1), nz = (p.z - z) / (dp || 1);
      p.inv = 0;
      this.hurtPlayer(2, nx || 1, nz, true, 15);
      p.airT = 0.6;
    }
    // efeitos: clarão, terremoto, fogo, fumaça, onda de choque
    this.boomLight.position.set(x, 1.6, z);
    this.boomLight.intensity = sup ? 160 : 70;
    this.boomLight.distance = sup ? 30 : 12;
    this.ui.flash(sup ? 'white' : 'orange');
    this.shake = Math.max(this.shake, sup ? 1.5 : 0.85);
    const n = sup ? 120 : 50;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = Math.random() * (sup ? 7 : 3.5);
      const col = [0xffe27a, 0xffa020, 0xff5a10, 0xff2a00][Math.floor(Math.random() * 4)];
      this.fx.spawn(x + Math.cos(a) * 0.2, 0.3 + Math.random() * 0.4, z + Math.sin(a) * 0.2, {
        color: col, size: 0.14 + Math.random() * (sup ? 0.35 : 0.22), vx: Math.cos(a) * sp, vy: 2 + Math.random() * (sup ? 6 : 4), vz: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.6, gravity: -1.5, emissive: 1.5,
      });
    }
    for (let i = 0; i < (sup ? 14 : 8); i++) {
      const a = Math.random() * Math.PI * 2;
      this.fx.spawn(x, 0.4, z, { color: 0x3a3438, size: 0.1 + Math.random() * 0.12, vx: Math.cos(a) * 4, vy: 4 + Math.random() * 3, vz: Math.sin(a) * 4, life: 1.1, gravity: 12, shrink: false, spin: 10 });
    }
    this.fx.smoke(x, z, sup ? 3 : 1.6);
    this.fx.ring(x, z, sup ? 16 : 2.9, sup ? 0.9 : 0.45, 0xffa040);
    if (sup) {
      setTimeout(() => this.fx && this.running && this.fx.ring(x, z, 12, 0.8, 0xffffff), 150);
      setTimeout(() => this.fx && this.running && this.fx.ring(x, z, 8, 0.7, 0xff5a10), 320);
    }
    // marca de queimado no chão
    const sc = new THREE.Mesh(new THREE.CircleGeometry(sup ? 3.5 : 1.3, 24), new THREE.MeshBasicMaterial({ color: 0x120c08, transparent: true, opacity: 0.7, depthWrite: false }));
    sc.rotation.x = -Math.PI / 2;
    sc.position.set(x, 0.03, z);
    this.scene.add(sc);
    this.scorches.push({ m: sc, life: 8 });
    sfx(sup ? 'superboom' : 'boom');
    if (sup) this.ui.bigText('SUPER BOMBA!', 1400, 'boss');
  }

  updateScorches(dt) {
    if (this.boomLight.intensity > 0.1) this.boomLight.intensity *= Math.pow(0.004, dt); else this.boomLight.intensity = 0;
    for (let i = this.scorches.length - 1; i >= 0; i--) {
      const s = this.scorches[i];
      s.life -= dt;
      s.m.material.opacity = Math.min(0.7, s.life / 4);
      if (s.life <= 0) { this.scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); this.scorches.splice(i, 1); }
    }
  }

  // ---------------- Arma de Choque: raio que persegue o monstro ----------------
  fireChoque() {
    if (this.weaponCd > 0) return;
    this.weaponCd = 0.8;
    const p = this.player;
    const { e } = this.nearestTarget(7.5);
    if (e) p.face = Math.atan2(e.x - p.x, e.z - p.z);
    const head = new THREE.Mesh(BALL, material(0xd8f8ff, 'glow'));
    head.scale.setScalar(0.12);
    this.scene.add(head);
    const n = 12;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x7ae8ff }));
    line.frustumCulled = false;
    this.scene.add(line);
    const x = p.x + Math.sin(p.face) * 0.5, z = p.z + Math.cos(p.face) * 0.5;
    this.bolts.push({ x, z, dir: p.face, target: e, travelled: 0, head, line, trail: Array.from({ length: n }, () => [x, 0.9, z]) });
    p.aimT = 0.35;
    sfx('choque');
  }

  updateBolts(dt) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      if (!b.target || !b.target.alive) {
        let best = null, bd = 4.5;
        for (const t of this.targets()) { const d = Math.hypot(t.x - b.x, t.z - b.z); if (d < bd) { bd = d; best = t; } }
        b.target = best;
      }
      if (b.target) b.dir = turnTo(b.dir, Math.atan2(b.target.x - b.x, b.target.z - b.z), dt * 7);
      const sp = 9;
      b.x += Math.sin(b.dir) * sp * dt; b.z += Math.cos(b.dir) * sp * dt;
      b.travelled += sp * dt;
      b.head.position.set(b.x, 0.9, b.z);
      b.trail.pop();
      b.trail.unshift([b.x + (Math.random() - 0.5) * 0.18, 0.9 + (Math.random() - 0.5) * 0.18, b.z + (Math.random() - 0.5) * 0.18]);
      const pos = b.line.geometry.attributes.position;
      b.trail.forEach((q, k) => pos.setXYZ(k, q[0], q[1], q[2]));
      pos.needsUpdate = true;
      let dead = false;
      if (SOLID.has(this.tileAt(b.x, b.z)) || b.travelled > 7.5) { dead = true; this.fx.sparks(b.x, 0.9, b.z, 0x7ae8ff, 6); }
      else for (const t of this.targets()) {
        if (Math.hypot(t.x - b.x, t.z - b.z) < t.r + 0.2) {
          this.damage(t, 4, Math.sin(b.dir), Math.cos(b.dir));
          dead = true;
          if (!t.alive || t.name) this.thunder(t.x, t.z, !t.alive);
          else this.fx.sparks(t.x, 0.9, t.z, 0x7ae8ff, 8);
          break;
        }
      }
      if (dead) { this.scene.remove(b.head); this.scene.remove(b.line); b.line.geometry.dispose(); this.bolts.splice(i, 1); }
    }
  }

  thunder(x, z, big) {
    const g = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 6, 6), material(0xbff4ff, 'glow', 0.8));
    col.position.y = 3;
    g.add(col);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.lasers.push({ g, life: 0.3 });
    for (let i = 0; i < 12; i++) this.fx.lightning(x, z);
    this.fx.sparks(x, 0.8, z, 0x7ae8ff, 14);
    if (big) { sfx('trovao'); this.ui.flash('blue'); this.shake = Math.max(this.shake, 0.3); }
    this.boomLight.position.set(x, 2, z); this.boomLight.intensity = 40; this.boomLight.color.setHex(0x9fe8ff);
    setTimeout(() => this.boomLight && this.boomLight.color.setHex(0xffa040), 300);
  }

  // ---------------- Turbina de Laser: raio gigante e reto ----------------
  toggleBeam() {
    if (this.beam) { this.stopBeam(); return; }
    if (this.weaponCd > 0) { this.ui.toast('Turbina esfriando...', 900); return; }
    const p = this.player;
    const face = Math.round(p.face / (Math.PI / 2)) * (Math.PI / 2); // só nas direções retas da sala
    p.face = face;
    const fx = Math.round(Math.sin(face)), fz = Math.round(Math.cos(face));
    const g = new THREE.Group();
    const outer = new THREE.Mesh(BEAM, material(0xff4a1a, 'glow', 0.75)); g.add(outer);
    const mid = new THREE.Mesh(BEAM, material(0xffb040, 'glow', 0.85)); g.add(mid);
    const core = new THREE.Mesh(BEAM, material(0xffffff, 'glow')); g.add(core);
    g.rotation.y = face;
    this.scene.add(g);
    this.beam = { t: 0, fx, fz, tick: 0, g, outer, mid, core };
    sfx('turbinaOn');
    humStart();
  }

  stopBeam() {
    if (!this.beam) return;
    this.scene.remove(this.beam.g);
    this.beam = null;
    this.weaponCd = 2.0;
    humStop();
    sfx('turbinaOff');
  }

  updateBeam(dt) {
    const B = this.beam;
    if (!B) return;
    const p = this.player;
    B.t += dt;
    if (B.t > 5) { this.stopBeam(); this.ui.toast('A Turbina esquentou! Espere um pouquinho.', 1400); return; }
    let len = 0;
    const sx = p.x + B.fx * 0.45, sz = p.z + B.fz * 0.45;
    while (len < 16) {
      if (SOLID.has(this.tileAt(sx + B.fx * (len + 0.1), sz + B.fz * (len + 0.1)))) break;
      len += 0.1;
    }
    const ex = sx + B.fx * len, ez = sz + B.fz * len;
    B.g.position.set(sx + B.fx * len / 2, 0.9, sz + B.fz * len / 2);
    const fl = 1 + Math.sin(this.time * 40) * 0.08;
    B.outer.scale.set(0.24 * fl, 0.24 * fl, len);
    B.mid.scale.set(0.15 * fl, 0.15 * fl, len);
    B.core.scale.set(0.07, 0.07, len);
    B.tick -= dt;
    if (B.tick <= 0) {
      B.tick = 0.12;
      this.hitTile(ex + B.fx * 0.15, ez + B.fz * 0.15, 1, true);
      for (const t of this.targets()) {
        const dx = t.x - sx, dz = t.z - sz;
        const along = dx * B.fx + dz * B.fz, perp = Math.abs(dx * B.fz - dz * B.fx);
        if (along > -0.2 && along < len + t.r && perp < 0.32 + t.r) this.damage(t, 1.6, B.fx, B.fz);
      }
    }
    if (Math.random() < 0.8) this.fx.sparks(ex, 0.9, ez, 0xffb040, 2);
    this.shake = Math.max(this.shake, 0.1);
    this.boomLight.position.set(sx + B.fx * 1.5, 1.4, sz + B.fz * 1.5);
    this.boomLight.intensity = Math.max(this.boomLight.intensity, 12);
  }

  // ---------------- visual ----------------
  animate(dt) {
    const p = this.player;
    const m = p.model;
    p.airT = Math.max(0, (p.airT || 0) - dt);
    const hop = p.airT > 0 ? Math.sin(Math.PI * (1 - p.airT / 0.6)) * 0.9 : 0;
    m.root.position.set(p.x, hop - p.sink, p.z);
    if (p.airT > 0) m.root.rotation.x = -(1 - p.airT / 0.6) * 6.28; else m.root.rotation.x = 0;
    m.root.rotation.y = p.face;
    if (!this.trans) m.root.visible = !p.dead && !(p.inv > 0 && Math.floor(this.time * 14) % 2 === 0);
    p.blob.position.set(p.x, 0.02, p.z);
    this.heroGlow.position.set(p.x, 0.03, p.z);
    this.heroGlow.visible = m.root.visible;
    const walking = p.moving && (!this.frozen || this.cine) && !this.trans;
    if (walking) p.walkT += dt * (this.isPrologue ? 13 : 11);
    const sw = walking ? Math.sin(p.walkT) * 0.8 : 0;
    m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw;
    m.body.position.y = walking ? Math.abs(Math.sin(p.walkT)) * 0.035 : Math.sin(this.time * 2) * 0.008;
    if (this.beam) p.aimT = 0.2;
    const aiming = p.aimT > 0 || p.charging || !!this.aim;
    m.arms[0].rotation.x = aiming && p.weapons >= 2 ? -1.45 : -sw;
    m.arms[1].rotation.x = aiming && p.weapons >= 1 ? -1.45 : sw;
    if (p.meleeT > 0) {
      const k = Math.sin((1 - p.meleeT / 0.22) * Math.PI);
      if (p.meleeSide) m.arms[1].rotation.x = -1.6 * k; else m.legs[1].rotation.x = -1.3 * k;
    }
    m.body.rotation.x = p.dash > 0 ? 0.4 : (this.isPrologue && walking ? 0.15 : 0);

    for (const e of this.room.enemies) {
      if (e.m.glow) { e.m.glow.visible = e.alive; e.m.glow.position.set(e.x, 0.03, e.z); }
      if (!e.alive) continue;
      const r = e.m.root;
      r.position.set(e.x, e.def.fly ? 0.95 + Math.sin(this.time * 4 + e.t) * 0.15 : 0, e.z);
      r.rotation.y = e.face;
      r.scale.setScalar(HERO_SCALE * (e.hit > 0 ? 1.15 : 1));
      const w = Math.sin(this.time * (e.chase ? 12 : 8) + e.x) * (e.moving ? 0.6 : 0.1);
      if (e.type === 'zumbi' || e.type === 'armadura') { e.m.legs[0].rotation.x = w; e.m.legs[1].rotation.x = -w; e.m.arms.forEach((a, i) => (a.rotation.x = e.windup ? -2.7 : -1.3 + Math.sin(this.time * 4 + i) * 0.15)); }
      if (e.type === 'aranha') e.m.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.time * 18 + i) * (e.moving ? 0.35 : 0.05)));
      if (e.type === 'morcego') e.m.wings.forEach((wg, i) => (wg.rotation.z = Math.sin(this.time * 16) * 0.7 * (i ? -1 : 1)));
      if (e.type === 'cogumelo') { e.m.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.time * 9 + i * 3) * (e.moving ? 0.5 : 0))); const sw = e.puff ? 1 + e.puff.t * 0.7 : 1; e.m.cap.scale.set(sw, sw * 0.9, sw); }
      if (e.type === 'espinho') { const k = e.aimT > 0 ? 1.25 : 1 + Math.sin(this.time * 3) * 0.04; e.m.head.scale.setScalar(k); }
      if (e.rootT > 0) this.rootVisual(e); else if (e.rootMesh) e.rootMesh.visible = false;
    }
    const b = this.room.boss;
    if (b && b.m.glow) { b.m.glow.visible = b.alive && b.state !== 'dormindo'; b.m.glow.position.set(b.x, 0.03, b.z); }
    if (b && b.alive) {
      const r = b.m.root;
      r.position.set(b.x, 0, b.z);
      r.rotation.y = b.face;
      r.scale.setScalar(b.scale * (b.hit > 0 ? 1.06 : 1));
      const w = b.moving ? Math.sin(this.time * 7) * 0.5 : 0;
      if (b.type === 'capitao') { b.m.legs[0].rotation.x = w; b.m.legs[1].rotation.x = -w; }
      if (b.type === 'maeteia') { b.m.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.time * 14 + i) * (b.moving ? 0.35 : 0.06))); r.position.y = b.state === 'bote' ? Math.sin(Math.min(1, b.t / 0.38) * Math.PI) * 0.9 : 0; }
      else if (b.type === 'anciao') { const sw = b.state === 'erguer' ? -1.4 : b.state === 'galhada' ? 1.2 : Math.sin(this.time * 1.5) * 0.15; b.m.arms.forEach((a, i) => (a.rotation.x = sw * (i ? 1 : -1) * 0.6)); b.m.core.visible = true; b.m.core.scale.setScalar(b.armor <= 0 ? 1.3 + Math.sin(this.time * 8) * 0.15 : 0.8); r.rotation.z = b.rootT > 0 ? Math.sin(this.time * 9) * 0.04 : 0; }
      else if (b.state === 'agachar') { b.m.arms.forEach((a) => (a.rotation.x = -0.4)); r.position.y = -0.15; r.rotation.x = 0.25; }
      else if (b.state === 'bote') { b.m.arms.forEach((a) => (a.rotation.x = -2.2)); r.position.y = Math.sin(Math.min(1, b.t / 0.38) * Math.PI) * 1.1; r.rotation.x = -0.2; }
      else r.rotation.x = 0;
      if (b.type !== 'capitao') { /* animado acima */ } else if (b.state === 'erguer') b.m.arms.forEach((a) => (a.rotation.x = -2.9));
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
    const st = `${p.hp}|${this.save.crystals}|${Math.floor(p.turbo * 10)}`;
    if (!force && st === this._hud) return;
    this._hud = st;
    this.ui.hud({ hp: p.hp, maxHp: MAX_HP, crystals: this.save.crystals, turbo: p.turbo, showCrystals: !this.isPrologue });
  }
}

function turnTo(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}
