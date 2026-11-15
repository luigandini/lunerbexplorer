// Mundo 3 — Pântano do Lodo Negro: pontes que afundam, névoa, gás tóxico,
// Sapo-Lodo Rei, Hidra de Lodo e o resgate do Dait.
// Estes métodos entram na classe Game (veja o fim de game.js).
import * as THREE from '../vendor/three.module.min.js';
import { buildSapoRei, buildHidraHead, buildHidraBody } from './models.js';
import { material, groundGlow } from './geo.js';
import { sfx } from './audio.js';
import { setCapacity, capacityFor } from './inventory.js';

const P_R = 0.3;
const HEAD_HP = 18;
const CHAIN_TIME = 10; // segundos para derrubar a próxima cabeça da Hidra
const HEAD_SPOTS = [[-1.9, 0], [0.95, -1.65], [0.95, 1.65]];

function turnTo(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}

const tmpV = new THREE.Vector3();

export const Mundo3 = {
  // ---------------- todo quadro, nas fases do Mundo 3 ----------------
  updateMundo3(dt) {
    this.updateBridges(dt);
    this.updateGas(dt);
    this.updateCage();
  },

  // névoa verde: só dá para ver perto do herói
  setFog(on) {
    const el = document.getElementById('fog');
    if (!el) return;
    this.fogOn = on;
    el.classList.toggle('hidden', !on);
  },

  updateFog() {
    if (!this.fogOn) return;
    const el = document.getElementById('fog');
    const p = this.player;
    tmpV.set(p.x, 0.8, p.z).project(this.camera);
    const x = (tmpV.x * 0.5 + 0.5) * innerWidth, y = (-tmpV.y * 0.5 + 0.5) * innerHeight;
    const r = Math.min(innerWidth, innerHeight) * 0.24;
    el.style.background = `radial-gradient(circle at ${x.toFixed(0)}px ${y.toFixed(0)}px, rgba(20,40,18,0) ${r.toFixed(0)}px, rgba(22,44,20,0.82) ${(r * 1.9).toFixed(0)}px, rgba(12,26,12,0.94) ${(r * 3).toFixed(0)}px)`;
  },

  // ---------------- pontes que afundam ----------------
  updateBridges(dt) {
    const room = this.room, br = room.vis.bridges;
    if (!br || !br.size) return;
    room.bstate = room.bstate || new Map();
    const p = this.player;
    const tx = Math.floor(p.x - room.off.x), tz = Math.floor(p.z - room.off.z);
    const key = `${tx},${tz}`;
    if (!p.dead && this.tiles[tz] && this.tiles[tz][tx] === 'b' && !room.bstate.has(key)) {
      room.bstate.set(key, { t: 0, sunk: 0 });
      if (Math.random() < 0.5) sfx('ponte');
    }
    for (const [k, st] of room.bstate) {
      const g = br.get(k);
      const [x, y] = k.split(',').map(Number);
      if (st.sunk > 0) {
        st.sunk -= dt;
        g.position.y = Math.max(-0.45, g.position.y - dt * 1.4);
        if (st.sunk <= 0) {
          this.tiles[y][x] = 'b';
          g.position.y = 0; g.rotation.set(0, 0, 0);
          room.bstate.delete(k);
          this.fx.spawn(room.off.x + x + 0.5, 0.1, room.off.z + y + 0.5, { color: 0x9dff4a, size: 0.12, vy: 1, life: 0.5, emissive: 1 });
        }
      } else {
        st.t += dt;
        g.rotation.z = Math.sin(this.time * 40) * 0.04 * st.t;
        g.position.y = -st.t * 0.07;
        if (st.t > 0.85) {
          st.sunk = 3.5;
          this.tiles[y][x] = 'L';
          sfx('bolha');
          for (let i = 0; i < 8; i++) this.fx.spawn(room.off.x + x + 0.5, 0.1, room.off.z + y + 0.5, { color: 0x7dff3a, size: 0.13, vx: (Math.random() - 0.5) * 2, vy: 2, vz: (Math.random() - 0.5) * 2, life: 0.6, gravity: 8, emissive: 1 });
          if (!this.tips.bridge) { this.tips.bridge = true; this.ui.toast('As pontes afundam! Passe correndo!', 1800); }
        }
      }
    }
  },

  // ---------------- gás tóxico: só o Dait respira ----------------
  updateGas(dt) {
    const p = this.player;
    if (p.dead) return;
    const t = this.tileAt(p.x, p.z);
    if (t !== 'q') { p.gasT = 0; return; }
    if (Math.random() < 0.25) this.fx.spawn(p.x, 0.6, p.z, { color: 0x9dff4a, size: 0.14, vy: 0.6, life: 0.6, emissive: 1 });
    if (p.id === 'dait') {
      if (!this.tips.gasDait) { this.tips.gasDait = true; this.ui.toast('😷 A máscara do Dait filtra o gás!', 1600); }
      return;
    }
    p.gasT = (p.gasT || 0) + dt;
    if (p.gasT > 0.7) {
      p.gasT = 0;
      sfx('gas');
      this.hurtPlayer(1, 0, 0);
      if (!this.tips.gas) {
        this.tips.gas = true;
        this.ui.toast(this.heroes.some((h) => h.id === 'dait') ? 'Gás tóxico! Troque para o DAIT, só ele respira aqui.' : 'Gás tóxico! Saia daí!', 2200);
      }
    }
  },

  // ---------------- jaula do Dait ----------------
  updateCage() {
    const room = this.room, c = room.vis.cage;
    if (!c || c.open) return;
    if (this.heroes.some((h) => h.id === 'dait')) { this.openCage(c); return; }
    const p = this.player;
    const d = Math.hypot(room.off.x + c.lx - p.x, room.off.z + c.lz - p.z);
    if (d < 2.4 && !this.tips.cage) {
      this.tips.cage = true;
      sfx('cano');
      this.ui.toast('Alguém está preso na jaula! Derrote todos os monstros da sala para abrir.', 2600);
    }
    if (room.enterT > 1 && room.enemies.every((e) => !e.alive)) this.freeDait();
  },

  openCage(c) {
    c.open = true;
    c.bars.visible = false;
    c.dait.root.visible = false;
    if (this.room.vis.portal) this.setGateLocked(this.room.vis.portal, false);
    this.gateLight.intensity = 4;
  },

  freeDait() {
    const room = this.room, c = room.vis.cage;
    this.openCage(c);
    const x = room.off.x + c.lx, z = room.off.z + c.lz;
    this.fx.smoke(x, z, 1.5);
    this.fx.sparks(x, 1, z, 0x2ee6ff, 20);
    sfx('cano');
    const d = this.spawnFriend(x, z, 'dait');
    d.face = Math.atan2(this.player.x - x, this.player.z - z);
    this.placeFriendNear(x, z, false, d);
    const first = !this.save.friends.includes('dait');
    if (first) this.save.friends.push('dait');
    this.inv = setCapacity(this.inv, capacityFor(this.save.friends));
    this.refreshSlots();
    this.persistInv();
    sfx('amigo');
    this.frozen = true;
    this.input.reset();
    this.ui.dialog(first ? [
      { who: '???', text: 'Finalmente! Achei que ninguém ia passar por aqui.' },
      { who: 'Dait', text: 'Eu sou o DAIT. Essa máscara me deixa respirar o gás do pântano.' },
      { who: 'Dait', text: 'Vou contar um segredo: eu era aprendiz do MORGRAVE, o alquimista que joga o lodo nos rios.' },
      { who: 'Dait', text: 'Fugi quando vi o que ele fazia. Desde então eu estrago os canos dele!' },
      { who: 'Lunerb', text: 'Então vem com a gente! Vamos parar esse lodo, e eu volto pra casa.' },
      { who: 'Dica', text: 'SEGURE o botão verde, mire e solte: todos os amigos prontos atacam juntos! O Dait solta o PULSO CIANO, que CONGELA os monstros.' },
      { who: 'Dica', text: 'Toque no rostinho do Dait para jogar com ele. Ele tem a mesma força dos outros, e só ele atravessa o GÁS verde! A mochila ganhou mais um espaço.' },
    ] : [{ who: 'Dait', text: 'Valeu de novo! Bora estragar esses canos!' }], () => { this.frozen = false; });
  },

  // ---------------- poder do Dait: Pulso Ciano (congela) ----------------
  castFreeze(x, z) {
    this.fx.ring(x, z, 2.4, 0.5, 0x2ee6ff);
    this.fx.ring(x, z, 1.4, 0.35, 0xbff8ff);
    for (let i = 0; i < 24; i++) this.fx.spawn(x + (Math.random() - 0.5) * 2.6, 0.2, z + (Math.random() - 0.5) * 2.6, { color: Math.random() < 0.5 ? 0xbff8ff : 0x2ee6ff, size: 0.12, vy: 1.6, life: 0.9, emissive: 1 });
    this.ui.flash('blue');
    this.shake = Math.max(this.shake, 0.3);
    sfx('gelo');
    let n = 0;
    for (const t of this.targets()) {
      if (Math.hypot(t.x - x, t.z - z) > 2.4 + t.r) continue;
      t.rootT = t.name ? 2 : 3.2;
      t.iceT = t.rootT;
      this.damage(t, 3, 0, 0);
      n++;
    }
    if (n) this.ui.toast(`❄️ Pulso Ciano! ${n} congelado${n > 1 ? 's' : ''}!`, 1200);
  },

  iceVisual(e) {
    if (!e.iceMesh) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), material(0x9ff4ff, 'lit', 0.45));
      m.scale.set(1, 1.3, 1);
      this.scene.add(m);
      e.iceMesh = m;
    }
    e.iceMesh.visible = e.alive && e.iceT > 0;
    e.iceMesh.position.set(e.x, 0.55 + (e.def && e.def.fly ? 0.6 : 0), e.z);
  },

  // ---------------- bolha de lodo: se divide em duas ----------------
  splitBolha(e) {
    for (const s of [-1, 1]) {
      let x = e.x + s * 0.35, z = e.z + s * 0.2;
      if (this.solidLocal(Math.floor(x - this.room.off.x), Math.floor(z - this.room.off.z), 'enemy')) { x = e.x; z = e.z; }
      const b = this.makeEnemy('bolhinha', x, z, false);
      b.awake = true; b.m.root.visible = true;
      b.kvx = s * 3; b.kvz = s * 1.5;
      this.room.enemies.push(b);
    }
    sfx('bolha');
    this.fx.sparks(e.x, 0.4, e.z, 0x7dff3a, 8);
  },

  animateMundo3Enemy(e) {
    const r = e.m.root;
    if (e.type === 'sapinho') {
      r.position.y = e.moving ? Math.abs(Math.sin(this.time * 7 + e.x)) * 0.3 : 0;
      e.m.legs.forEach((l) => (l.rotation.x = e.moving ? -0.7 : 0));
    } else if (e.type === 'bolha' || e.type === 'bolhinha') {
      const k = Math.sin(this.time * 5 + e.x) * 0.12;
      e.m.body.scale.set(1 + k, 1 - k, 1 + k);
    }
  },

  // ---------------- chefes do Mundo 3 ----------------
  makeBossM3(type) {
    if (type === 'saporei') return buildSapoRei();
    const root = new THREE.Group();
    const body = buildHidraBody();
    root.add(body);
    const heads = HEAD_SPOTS.map(([ox, oz], i) => {
      const h = buildHidraHead(i);
      h.root.position.set(ox, -2, oz);
      h.root.scale.setScalar(1.9);
      root.add(h.root);
      return h;
    });
    return { root, body, heads, legs: [], arms: [] };
  },

  initBossM3(b) {
    if (b.type !== 'hidra') return;
    b.heads = HEAD_SPOTS.map(([ox, oz], i) => ({ i, ox, oz, hp: HEAD_HP, down: false, cd: 1 + i * 0.7, rise: 0, bite: null }));
    b.active = 0;
    b.chainT = 0;
    b.hp = HEAD_HP * 3; b.maxHp = HEAD_HP * 3;
    b.r = 0.85;
    this.placeHidraTarget(b);
  },

  placeHidraTarget(b) {
    const h = b.heads[b.active];
    b.x = b.hx + h.ox; b.z = b.hz + h.oz;
  },

  updateBossM3(b, dt, dx, dz, dist) {
    if (b.type === 'saporei') return this.updateSapoRei(b, dt, dx, dz, dist);
    return this.updateHidra(b, dt);
  },

  // Sapo-Lodo Rei: pula alto, cai fazendo onda de lodo, cospe lodo e chama sapinhos
  updateSapoRei(b, dt, dx, dz, dist) {
    const p = this.player;
    const angry = b.hp < b.maxHp / 2;
    b.air = b.air || 0;
    switch (b.state) {
      case 'perseguir': {
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 6);
        const hop = (b.t % 0.9) < 0.5;
        const sp = 2.2 * this.difficulty * (angry ? 1.2 : 1);
        if (hop) this.move(b, (dx / (dist || 1)) * sp * dt, (dz / (dist || 1)) * sp * dt, b.r, 'enemy');
        b.moving = hop;
        b.air = hop ? Math.sin(((b.t % 0.9) / 0.5) * Math.PI) * 0.25 : 0;
        if (b.t > (angry ? 1.2 : 1.6)) {
          b.t = 0; b.cycle++; b.moving = false; b.air = 0;
          const k = b.cycle % 3;
          const babies = this.room.enemies.filter((e) => e.alive).length;
          b.state = k === 1 ? 'cuspir' : k === 2 && angry && babies < 3 ? 'chamar' : 'agachar';
          if (b.state === 'agachar') {
            b.jx = p.x; b.jz = p.z;
            b.warn = this.fx.ring(b.jx, b.jz, 1.7, 0.75, 0x9dff3a);
          }
          sfx('sapoRei');
        }
        break;
      }
      case 'agachar':
        b.face = turnTo(b.face, Math.atan2(b.jx - b.x, b.jz - b.z), dt * 10);
        if (b.t > 0.55) { b.state = 'pulo'; b.t = 0; b.sx = b.x; b.sz = b.z; sfx('lancar'); }
        break;
      case 'pulo': {
        const k = Math.min(1, b.t / 0.75);
        b.x = b.sx + (b.jx - b.sx) * k; b.z = b.sz + (b.jz - b.sz) * k;
        b.air = Math.sin(k * Math.PI) * 2.4;
        b.moving = true;
        if (k >= 1) {
          b.air = 0; b.state = 'onda'; b.t = 0; b.moving = false;
          this.shake = 0.6;
          sfx('onda');
          this.fx.ring(b.x, b.z, 1.7, 0.3, 0xd8ff9a);
          for (let i = 0; i < 16; i++) this.fx.spawn(b.x, 0.2, b.z, { color: 0x5cdf3a, size: 0.15, vx: (Math.random() - 0.5) * 6, vy: 3, vz: (Math.random() - 0.5) * 6, life: 0.7, gravity: 10 });
          const d2 = Math.hypot(p.x - b.x, p.z - b.z);
          if (d2 < 1.7) this.hurtPlayer(1, (p.x - b.x) / (d2 || 1), (p.z - b.z) / (d2 || 1), false, 13);
          b.wave = this.fx.ring(b.x, b.z, 6, 1.1, 0x7dff3a);
          if (!this.tips.wave) { this.tips.wave = true; this.ui.toast('Fuja da onda de lodo, ou passe por ela com o TURBO!', 2200); }
        }
        break;
      }
      case 'onda':
        if (b.wave && b.wave.t < b.wave.dur && Math.abs(dist - b.wave.r) < 0.45 && p.dash <= 0) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1));
        if (b.t > 1.0) {
          b.state = 'cansado'; b.t = 0; b.wave = null;
          if (!this.tips.tired) { this.tips.tired = true; this.ui.toast('Ele cansou! Ataque agora!', 1600); }
        }
        break;
      case 'cansado':
        b.moving = false;
        if (Math.random() < 0.25) this.fx.spawn(b.x, 1.8, b.z, { color: 0xffffff, size: 0.1, vy: 0.8, life: 0.5, emissive: 1 });
        if (b.t > (angry ? 1.0 : 1.4)) { b.state = 'perseguir'; b.t = 0; }
        break;
      case 'cuspir':
        b.face = turnTo(b.face, Math.atan2(dx, dz), dt * 10);
        if (b.t > 0.4) {
          const base = Math.atan2(dx, dz);
          for (const off of angry ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.3, 0, 0.3]) this.spawnEShot(b.x, b.z, Math.sin(base + off), Math.cos(base + off), 'lodo', 6.2);
          sfx('lancar');
          b.state = 'perseguir'; b.t = 0;
        }
        break;
      case 'chamar':
        if (b.t > 0.5) {
          for (let i = 0; i < 2; i++) {
            const a = Math.random() * Math.PI * 2;
            let x = b.x + Math.cos(a) * 1.6, z = b.z + Math.sin(a) * 1.6;
            if (this.solidLocal(Math.floor(x - this.room.off.x), Math.floor(z - this.room.off.z), 'enemy')) { x = b.x; z = b.z; }
            const e = this.makeEnemy('sapinho', x, z, false);
            e.awake = true; e.m.root.visible = true;
            this.room.enemies.push(e);
            this.fx.smoke(x, z, 0.7);
          }
          sfx('sapo');
          b.state = 'perseguir'; b.t = 0;
        }
        break;
      default: b.state = 'perseguir';
    }
    if (dist < b.r + P_R && b.air < 0.4) this.hurtPlayer(1, dx / (dist || 1), dz / (dist || 1), false, 11);
    this.updateArenaItem(dt);
    this.ui.bossBar(b.name, 0, b.hp / b.maxHp);
  },

  // Hidra de Lodo: só a cabeça que brilha pode ser atingida; as três têm que cair em sequência
  updateHidra(b, dt) {
    const p = this.player;
    const alive = b.heads.filter((h) => !h.down);
    if (b.chainT > 0) {
      b.chainT -= dt;
      if (b.chainT <= 3 && !b.warned) { b.warned = true; this.ui.toast('Rápido! As cabeças vão voltar!', 1400); }
      if (b.chainT <= 0) {
        // demorou: as cabeças derrubadas voltam
        for (const h of b.heads) if (h.down) { h.down = false; h.hp = HEAD_HP; h.rise = 0; }
        b.active = b.heads.findIndex((h) => !h.down);
        b.chainT = 0;
        sfx('hidra');
        this.shake = 0.5;
        this.ui.bigText('As cabeças voltaram!', 1600);
        this.ui.toast('Derrube as três em sequência, sem demorar!', 2200);
      }
    }
    const angry = alive.length < 3;
    for (const h of b.heads) {
      h.rise = Math.min(1, h.rise + dt * 1.2);
      if (h.down) continue;
      const hx = b.hx + h.ox, hz = b.hz + h.oz;
      const ddx = p.x - hx, ddz = p.z - hz, d = Math.hypot(ddx, ddz);
      h.face = Math.atan2(ddx, ddz);
      if (h.bite) {
        h.bite.t += dt;
        if (h.bite.t > 0.7 && !h.bite.done) {
          h.bite.done = true;
          sfx('pancada');
          this.shake = Math.max(this.shake, 0.35);
          this.fx.ring(h.bite.x, h.bite.z, 0.95, 0.3, 0x9dff3a);
          if (Math.hypot(p.x - h.bite.x, p.z - h.bite.z) < 0.95) this.hurtPlayer(1, ddx / (d || 1), ddz / (d || 1), false, 10);
        }
        if (h.bite.t > 1.1) h.bite = null;
        continue;
      }
      h.cd -= dt * (h.i === b.active ? 1.5 : 1) * (angry ? 1.25 : 1) * this.difficulty;
      if (h.cd > 0) continue;
      h.cd = 2.6 + Math.random();
      if (d < 3.8) {
        // mordida: aparece um círculo onde a cabeça vai bater
        const bx = hx + (ddx / (d || 1)) * Math.min(d, 3), bz = hz + (ddz / (d || 1)) * Math.min(d, 3);
        h.bite = { t: 0, x: bx, z: bz };
        this.fx.ring(bx, bz, 0.95, 0.7, 0xff5a3a);
        sfx('hidra');
      } else {
        this.spawnEShot(hx, hz, ddx / (d || 1), ddz / (d || 1), 'lodo', 6);
        sfx('lancar');
      }
    }
    this.placeHidraTarget(b);
    b.hp = b.heads.reduce((s, h) => s + (h.down ? 0 : h.hp), 0);
    this.ui.bossBar(b.name, b.chainT > 0 ? b.chainT / CHAIN_TIME : 0, b.hp / b.maxHp);
    this.updateArenaItem(dt);
  },

  hidraDamage(b, dmg) {
    const h = b.heads[b.active];
    if (!h || h.down) return;
    b.hit = 0.15;
    h.hp -= dmg;
    this.fx.sparks(b.x, 1.6, b.z, 0x9dff3a, 5);
    sfx('acerto');
    if (h.hp > 0) return;
    h.down = true; h.bite = null;
    this.fx.smoke(b.x, b.z, 1.6);
    sfx('puf');
    this.shake = 0.4;
    const next = b.heads.findIndex((k) => !k.down);
    if (next < 0) { b.hp = 0; this.kill(b); return; }
    b.active = next;
    b.chainT = CHAIN_TIME; b.warned = false;
    this.placeHidraTarget(b);
    this.ui.toast(b.heads.filter((k) => k.down).length === 1 ? 'Uma já foi! Agora a cabeça que brilha, rápido!' : 'Falta só uma! Rápido!', 1600);
  },

  animateBossM3(b, dt) {
    const r = b.m.root;
    if (b.type === 'saporei') {
      r.position.set(b.x, b.air || 0, b.z);
      r.rotation.y = b.face;
      const squash = b.state === 'agachar' ? 0.8 : b.state === 'cansado' ? 0.9 + Math.sin(this.time * 4) * 0.03 : 1;
      r.scale.set(b.scale * (b.hit > 0 ? 1.06 : 1), b.scale * squash, b.scale * (b.hit > 0 ? 1.06 : 1));
      b.m.legs.forEach((l) => (l.rotation.x = b.air > 0.3 ? -0.9 : 0));
      r.rotation.z = (b.iceT || 0) > 0 ? Math.sin(this.time * 9) * 0.03 : 0;
      return;
    }
    // Hidra
    r.position.set(b.hx, 0, b.hz);
    r.rotation.set(0, 0, 0);
    r.scale.setScalar(1);
    b.m.body.position.y = Math.sin(this.time * 1.5) * 0.06;
    b.heads.forEach((h, i) => {
      const m = b.m.heads[i];
      const target = h.down ? -2.6 : (b.state === 'dormindo' ? -2.2 : -2.2 + 2.2 * h.rise);
      m.root.position.y += (target - m.root.position.y) * Math.min(1, dt * 4);
      m.root.rotation.y = turnTo(m.root.rotation.y, h.face ?? Math.PI, dt * 4);
      const biting = h.bite && h.bite.t > 0.45 && h.bite.t < 0.95;
      m.neck.rotation.x = biting ? 0.9 : Math.sin(this.time * 2 + i * 2) * 0.12;
      const act = i === b.active && !h.down;
      m.root.scale.setScalar(1.9 * (act ? 1.12 + Math.sin(this.time * 8) * 0.04 : 1) * (act && b.hit > 0 ? 1.08 : 1));
    });
  },
};

export function hidraGlow() { return groundGlow(0xfff27a, 0.9, 0.55); }
