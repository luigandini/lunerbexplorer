// Monta cada sala como uma MAQUETE FLUTUANTE: chão com textura, bordas de pedra, musgo, objetos.
import * as THREE from '../vendor/three.module.min.js';
import { roundedBox as rb, part, bake, applyRim, groundGlow } from './geo.js';
import { tex } from './textures.js';
import * as P from './props.js';
import { buildCoracao, buildCasulo } from './models.js';

const PX = 32; // pixels por quadradinho na textura do chão

function rand(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// Desenha o chão inteiro da sala numa textura só (trilhas, musgo, grama)
function groundTexture(room, theme, r) {
  const c = document.createElement('canvas');
  c.width = room.w * PX; c.height = room.h * PX;
  const ctx = c.getContext('2d');
  for (let y = 0; y < room.h; y++) {
    for (let x = 0; x < room.w; x++) {
      const t = room.tiles[y][x];
      let name;
      if (theme === 'castle') name = t === ',' ? 'cobbleMoss' : 'cobble';
      else name = (t === '.' || t === 'X' || t === 'E') ? 'dirt' : 'grass';
      const img = tex(name).image;
      ctx.drawImage(img, (x * PX) % 256, (y * PX) % 256, PX, PX, x * PX, y * PX, PX, PX);
    }
  }
  // bordas suaves: manchas de grama sobre a trilha / musgo sobre a pedra
  for (let i = 0; i < room.w * room.h * 0.6; i++) {
    const x = r() * c.width, y = r() * c.height;
    ctx.fillStyle = theme === 'forest' ? `rgba(70,${110 + r() * 40},45,0.35)` : `rgba(60,${80 + r() * 30},50,0.18)`;
    ctx.beginPath(); ctx.ellipse(x, y, 4 + r() * 10, 3 + r() * 7, r() * 3, 0, 7); ctx.fill();
  }
  const g = ctx.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.3, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function instanced(geo, mat, items, { cast = true, receive = true } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  items.forEach((it, i) => {
    e.set(it.rx || 0, it.ry || 0, it.rz || 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.sx || 1, it.sy || 1, it.sz || 1));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(it.color || 0xffffff));
  });
  mesh.count = items.length;
  mesh.castShadow = cast; mesh.receiveShadow = receive;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

// teia de aranha desenhada (fios em vez de um quadrado)
function webTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.strokeStyle = 'rgba(235,235,245,0.9)';
  x.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62); x.stroke(); }
  for (let r = 10; r < 62; r += 9) {
    x.beginPath();
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI * 2; const px = 64 + Math.cos(a) * r, py = 64 + Math.sin(a) * r; i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke();
  }
  return new THREE.CanvasTexture(c);
}

let SHARED = null;
function shared() {
  if (!SHARED) {
    SHARED = {
      stone: new THREE.MeshLambertMaterial({ map: tex('stone') }),
      wall: new THREE.MeshLambertMaterial({ map: tex('stone') }),
      moss: new THREE.MeshLambertMaterial({ color: 0x4f8a2e }),
      lava: new THREE.MeshBasicMaterial({ color: 0xff6a18 }),
      lodo: new THREE.MeshBasicMaterial({ color: 0x1fa82a }),
      bubble: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      web: new THREE.MeshBasicMaterial({ map: webTexture(), color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
      under: new THREE.MeshLambertMaterial({ color: 0x3d3940 }),
      blockGeo: rb(1, 1, 1, 0.14, 2),
      wallGeo: rb(0.98, 1.1, 0.98, 0.09, 2),
      lowWallGeo: rb(0.98, 0.42, 0.98, 0.09, 2),
      capGeo: rb(1.02, 0.12, 1.02, 0.05, 2),
      tileGeo: new THREE.BoxGeometry(1, 0.06, 1),
      webGeo: new THREE.PlaneGeometry(1, 0.8),
    };
  }
  return SHARED;
}

const MOSS = [0x4f8a2e, 0x5c9a36, 0x447a28];

export function buildRoom(room, theme, offset, seed) {
  const r = rand(seed * 7919 + 13);
  const S = shared();
  const group = new THREE.Group();
  group.position.set(offset.x, 0, offset.z);
  const W = room.w, H = room.h;

  // chão
  const topMat = new THREE.MeshLambertMaterial({ map: groundTexture(room, theme, r) });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, H), [S.stone, S.stone, topMat, S.stone, S.stone, S.stone]);
  floor.position.set(W / 2, -0.15, H / 2);
  floor.receiveShadow = true;
  group.add(floor);

  // bordas da ilha: blocos de pedra empilhados + musgo pendurado
  const cliff = [], drips = [];
  const base = theme === 'forest' ? 0x9a948f : 0x8c8690;
  const shade = (k) => new THREE.Color(base).multiplyScalar(k).getHex();
  const edge = (x, z, nx, nz) => {
    const k = 0.8 + r() * 0.25;
    cliff.push({ x: x + nx * 0.06, y: -0.42, z: z + nz * 0.06, sx: 1.04, sy: 0.55 + r() * 0.15, sz: 1.04, color: shade(k), ry: (r() - 0.5) * 0.1 });
    cliff.push({ x: x - nx * 0.08, y: -0.95, z: z - nz * 0.08, sx: 0.92, sy: 0.55, sz: 0.92, color: shade(k * 0.82) });
    if (r() < 0.55) cliff.push({ x: x - nx * 0.3, y: -1.45 - r() * 0.2, z: z - nz * 0.3, sx: 0.7, sy: 0.6, sz: 0.7, color: shade(0.6), ry: r() * 2 });
    if (r() < 0.5) drips.push({ x: x + nx * 0.52, y: -0.25 - r() * 0.2, z: z + nz * 0.52, sx: nx ? 0.08 : 0.4 + r() * 0.4, sy: 0.35 + r() * 0.4, sz: nz ? 0.08 : 0.4 + r() * 0.4, color: MOSS[Math.floor(r() * 3)] });
  };
  for (let x = 0; x < W; x++) { edge(x + 0.5, 0.5, 0, -1); edge(x + 0.5, H - 0.5, 0, 1); }
  for (let z = 0; z < H; z++) { edge(0.5, z + 0.5, -1, 0); edge(W - 0.5, z + 0.5, 1, 0); }
  group.add(instanced(S.blockGeo, S.stone, cliff, { receive: false }));
  group.add(instanced(S.blockGeo, S.moss, drips, { cast: false, receive: false }));
  const m = Math.min(W, H);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(m * 0.42, m * 0.12, 2.2, 7), S.under);
  under.position.set(W / 2, -2.1, H / 2);
  under.scale.set(W / m, 1, H / m);
  group.add(under);

  // paredes (as da frente ficam baixas para não esconder o herói)
  const walls = [], lows = [], caps = [];
  const statics = new THREE.Group();
  const lavaTiles = [], lodoTiles = [], webs = [], bubbles = [];
  const breakables = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = room.tiles[y][x];
      const cx = x + 0.5, cz = y + 0.5;
      if (t === '#') {
        const front = y === H - 1 || x === W - 1;
        const col = new THREE.Color(0xc2bcc6).multiplyScalar(0.8 + r() * 0.28).getHex();
        if (front) lows.push({ x: cx, y: 0.21, z: cz, color: col, tx: x, ty: y });
        else walls.push({ x: cx, y: 0.55, z: cz, color: col, tx: x, ty: y });
        if (r() < 0.45) caps.push({ x: cx, y: front ? 0.45 : 1.13, z: cz, sx: 0.9 + r() * 0.15, sz: 0.9 + r() * 0.15, color: MOSS[Math.floor(r() * 3)], tx: x, ty: y });
      } else if (t === 'L') lavaTiles.push({ x: cx, y: 0.01, z: cz, color: r() < 0.3 ? 0xffb030 : 0xff5a10 });
      else if (t === '~') { lodoTiles.push({ x: cx, y: 0.02, z: cz, color: 0xffffff }); if (r() < 0.45) bubbles.push({ x: cx + (r() - 0.5) * 0.6, y: 0.07, z: cz + (r() - 0.5) * 0.6, sx: 0.08 + r() * 0.1, sy: 0.05, sz: 0.08 + r() * 0.1, color: 0x8dff6a }); }
      else if (t === 'Y') P.tree(statics, cx, cz, r);
      else if (t === 'R' || t === 'U') {
        // pedras e arbustos ficam separados: a bomba pode destruir
        const bk = new THREE.Group();
        if (t === 'R') P.rock(bk, cx, cz, r); else P.bush(bk, cx, cz, r);
        bake(bk);
        bk.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        group.add(bk);
        breakables.set(`${x},${y}`, { g: bk, kind: t });
      }
      else if (t === 'g') P.grassTuft(statics, cx, cz, r);
      else if (t === 'f') P.flowers(statics, cx, cz, r);
      else if (t === 'W') webs.push({ x: cx, z: cz });
      else if (t === '.' || t === ',') {
        const v = r();
        if (theme === 'forest') {
          if (t === ',' && v < 0.22) P.grassTuft(statics, cx + (r() - 0.5) * 0.6, cz + (r() - 0.5) * 0.6, r);
          else if (v < 0.27) P.flowers(statics, cx, cz, r);
          else if (v < 0.31) P.mushroom(statics, cx + (r() - 0.5) * 0.6, cz + (r() - 0.5) * 0.6, r);
          else if (t === '.' && v < 0.4) P.pebbles(statics, cx, cz, r);
        } else {
          const nearWall = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (room.tiles[y + dy] || [])[x + dx] === '#');
          if (v < 0.05) P.bones(statics, cx, cz, r);
          else if (nearWall && v < 0.1) P.barrel(statics, cx + (r() - 0.5) * 0.3, cz + (r() - 0.5) * 0.3, r);
          else if (t === ',' && v < 0.35) P.grassTuft(statics, cx, cz, r);
          else if (v < 0.14) P.pebbles(statics, cx, cz, r);
        }
      }
    }
  }
  // guarda onde está cada bloco de parede, para a bomba poder quebrar
  const wallIndex = new Map();
  const addWalls = (geo, mat, list, opts) => {
    if (!list.length) return;
    const mesh = instanced(geo, mat, list, opts);
    list.forEach((it, i) => { const k = `${it.tx},${it.ty}`; if (!wallIndex.has(k)) wallIndex.set(k, []); wallIndex.get(k).push({ mesh, i }); });
    group.add(mesh);
  };
  addWalls(S.wallGeo, S.wall, walls);
  addWalls(S.lowWallGeo, S.wall, lows);
  addWalls(S.capGeo, S.moss, caps, { receive: false });
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const breakWall = (x, y) => {
    const list = wallIndex.get(`${x},${y}`);
    if (!list) return false;
    for (const { mesh, i } of list) { mesh.setMatrixAt(i, zero); mesh.instanceMatrix.needsUpdate = true; }
    wallIndex.delete(`${x},${y}`);
    return true;
  };
  if (lavaTiles.length) group.add(instanced(S.tileGeo, S.lava, lavaTiles, { cast: false, receive: false }));
  if (lodoTiles.length) {
    group.add(instanced(S.tileGeo, S.lodo, lodoTiles, { cast: false, receive: false }));
    group.add(instanced(new THREE.SphereGeometry(1, 8, 6), S.bubble, bubbles, { cast: false, receive: false }));
    for (const t of room.lake) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = (room.tiles[t.y + dy] || [])[t.x + dx];
      if (n && n !== '~' && r() < 0.5) P.pebbles(statics, t.x + 0.5 + dx * 0.45, t.y + 0.5 + dy * 0.45, r);
    }
  }
  for (const w of webs) {
    for (const rot of [Math.PI / 4, -Math.PI / 4]) {
      const mw = new THREE.Mesh(S.webGeo, S.web);
      mw.position.set(w.x, 0.4, w.z); mw.rotation.y = rot;
      group.add(mw);
    }
  }
  bake(statics);
  statics.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  group.add(statics);

  // tochas (metade começa acesa)
  const torches = room.torches.map((t, i) => {
    const o = P.torch();
    o.group.position.set(t.x + 0.5, 0, t.y + 0.5);
    group.add(o.group);
    const lit = i % 2 === 0;
    o.flame.visible = lit;
    o.ember.visible = !lit;
    return { lx: t.x + 0.5, lz: t.y + 0.5, tx: t.x, ty: t.y, lit, flame: o.flame, ember: o.ember, group: o.group };
  });

  // paredes rachadas
  const cracks = room.cracks.map((c) => {
    const g = new THREE.Group();
    g.position.set(c.x + 0.5, 0, c.y + 0.5);
    part(g, rb(0.98, 1.1, 0.98, 0.09, 2), 0x7d7880, 'lit', 0, 0.55, 0);
    for (const [a, b, rz] of [[-0.2, 0.75, 0.7], [0.05, 0.55, -0.5], [0.15, 0.32, 0.8], [-0.08, 0.95, -0.3]]) {
      part(g, rb(0.32, 0.04, 0.03, 0.01), 0x151315, 'lit', a, b, 0.5, 0, 0, rz);
      part(g, rb(0.03, 0.04, 0.32, 0.01), 0x151315, 'lit', 0.5, b, a, rz, 0, 0);
    }
    bake(g);
    group.add(g);
    return { tx: c.x, ty: c.y, hp: 3, broken: false, group: g };
  });

  const checkpoints = room.checkpoints.map((c) => {
    const o = P.campfire();
    o.group.position.set(c.x + 0.5, 0, c.y + 0.5);
    group.add(o.group);
    return { lx: c.x + 0.5, lz: c.y + 0.5, active: false, flame: o.flame, smoke: o.smoke, group: o.group };
  });

  const chests = room.chests.map((c) => {
    const o = P.chest(c.kind);
    o.group.position.set(c.x + 0.5, 0, c.y + 0.5);
    o.group.rotation.y = (r() - 0.5) * 0.4;
    group.add(o.group);
    return { ...c, lx: c.x + 0.5, lz: c.y + 0.5, open: false, lidT: 0, lid: o.lid, group: o.group };
  });

  const hearts = room.hearts.map((h) => {
    const g = buildCoracao();
    g.position.set(h.x + 0.5, 0, h.y + 0.5);
    group.add(g);
    return { lx: h.x + 0.5, lz: h.y + 0.5, taken: false, mesh: g };
  });

  const makeGate = (pt, final, back = false) => {
    if (!pt) return null;
    const o = P.portal(final, back);
    o.group.position.set(pt.x + 0.5, 0, pt.y + 0.5);
    if (pt.x === 0 || pt.x === W - 1) o.group.rotation.y = Math.PI / 2;
    group.add(o.group);
    return { lx: pt.x + 0.5, lz: pt.y + 0.5, ...o, locked: false };
  };
  let cocoon = null;
  if (room.cocoon) {
    const g = buildCasulo();
    g.position.set(room.cocoon.x + 0.5, 0, room.cocoon.y + 0.5);
    group.add(g);
    cocoon = { lx: room.cocoon.x + 0.5, lz: room.cocoon.y + 0.5, g };
  }
  // portões de raízes (só o Feligon abre)
  const vines = new Map();
  for (const v of room.vines) {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const vx = -0.36 + i * 0.18;
      part(g, rb(0.09, 1.2, 0.09, 0.04), 0x3f6b2a, 'lit', vx, 0.6, (i % 2) * 0.1 - 0.05, 0, 0, (i - 2) * 0.06);
      part(g, rb(0.18, 0.05, 0.1, 0.02), 0x5c9a36, 'lit', vx + 0.06, 0.35 + i * 0.15, 0.06, 0, 0, 0.5);
      part(g, rb(0.16, 0.05, 0.1, 0.02), 0x5c9a36, 'lit', vx - 0.05, 0.8 - i * 0.08, -0.06, 0, 0, -0.5);
    }
    part(g, rb(0.95, 0.1, 0.14, 0.04), 0x2f5a20, 'lit', 0, 0.25, 0, 0, 0, 0.05);
    part(g, rb(0.95, 0.1, 0.14, 0.04), 0x2f5a20, 'lit', 0, 0.9, 0, 0, 0, -0.06);
    for (const [y, c] of [[0.5, 0xff5a8a], [1.05, 0xffd23a]]) part(g, rb(0.08, 0.08, 0.04, 0.02), c, 'glow', 0.1, y, 0.12);
    bake(g);
    // duas camadas cruzadas: fecha o quadradinho de todos os lados
    const both = new THREE.Group();
    both.add(g);
    const g2 = g.clone(); g2.rotation.y = Math.PI / 2; both.add(g2);
    both.position.set(v.x + 0.5, 0, v.y + 0.5);
    group.add(both);
    vines.set(`${v.x},${v.y}`, both);
  }
  const openVine = (x, y) => { const g = vines.get(`${x},${y}`); if (!g) return false; g.visible = false; vines.delete(`${x},${y}`); return true; };
  const breakProp = (x, y) => {
    const b = breakables.get(`${x},${y}`);
    if (!b) return null;
    b.g.visible = false;
    breakables.delete(`${x},${y}`);
    return b.kind;
  };
  const portal = makeGate(room.portal, false);
  const exit = makeGate(room.exit, true);
  // portal de volta para a sala anterior (laranja)
  const back = room.isStart ? null : makeGate(room.entry, false, true);

  // lugar do mercador (ele só aparece às vezes)
  let merchant = null;
  if (room.merchant) {
    const o = P.merchant();
    o.group.position.set(room.merchant.x + 0.5, 0, room.merchant.y + 0.5);
    applyRim(o.group, 0xc58cff, 1.2);
    const mg = groundGlow(0xb070ff, 0.7, 0.5);
    o.group.add(mg);
    o.group.visible = false;
    group.add(o.group);
    merchant = { lx: room.merchant.x + 0.5, lz: room.merchant.y + 0.5, ...o, here: false };
  }

  return {
    group, torches, cracks, checkpoints, chests, hearts, portal, exit, back, merchant, breakWall, breakProp, cocoon, openVine,
    center: new THREE.Vector3(offset.x + W / 2, 0, offset.z + H / 2),
  };
}

export function sharedMaterials() { return shared(); }
