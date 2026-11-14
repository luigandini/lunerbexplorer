// Monta o cenário 3D (blocos) a partir do mapa da fase.
import * as THREE from '../vendor/three.module.min.js';
import { mat, vox, bake, buildBau, buildCoracao } from './models.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const WALL_H = 1.25;

function rand(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function instanced(list, material, sy, y) {
  const mesh = new THREE.InstancedMesh(BOX, material, Math.max(1, list.length));
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  list.forEach((it, i) => {
    m.makeScale(it.sx || 1, it.sy || sy, it.sz || 1);
    m.setPosition(it.x, it.y ?? y, it.z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(it.color));
  });
  mesh.count = list.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export function buildWorld(parsed, scene, levelId) {
  const r = rand(levelId * 9973 + 7);
  const group = new THREE.Group();
  scene.add(group);
  const floors = [], walls = [], lavas = [], mossy = [], webs = [], details = [];
  const stone = [0x3a3638, 0x403b3d, 0x353133, 0x3d3739];
  const wallC = [0x5b5658, 0x645e60, 0x544f51, 0x5f5a5c];

  for (let y = 0; y < parsed.h; y++) {
    for (let x = 0; x < parsed.w; x++) {
      const t = parsed.tiles[y][x];
      const cx = x + 0.5, cz = y + 0.5;
      if (t === '#') {
        const moss = r() < 0.14;
        walls.push({ x: cx, z: cz, color: moss ? 0x4f5e3e : wallC[Math.floor(r() * 4)] });
        // borda de cima um pouco mais clara (dá leitura do 3D)
        details.push({ x: cx, z: cz, y: WALL_H + 0.04, sy: 0.08, sx: 1.0, sz: 1.0, color: moss ? 0x5f7a43 : 0x6e6769 });
      } else if (t === 'L') {
        lavas.push({ x: cx, z: cz, color: r() < 0.25 ? 0xffb030 : 0xff5a10 });
      } else {
        const isMoss = t === ',';
        floors.push({ x: cx, z: cz, color: isMoss ? 0x3b4a2c : stone[Math.floor(r() * 4)] });
        if (isMoss || r() < 0.06) mossy.push({ x: cx + (r() - 0.5) * 0.5, z: cz + (r() - 0.5) * 0.5, y: 0.03, sx: 0.3, sy: 0.06, sz: 0.3, color: 0x4e7a2e });
        if (r() < 0.04) details.push({ x: cx + (r() - 0.5) * 0.6, z: cz + (r() - 0.5) * 0.6, y: 0.06, sx: 0.12, sy: 0.12, sz: 0.12, color: 0x5a5254 });
        if (t === 'W') webs.push({ x: cx, z: cz });
      }
    }
  }

  group.add(instanced(floors, mat(0xffffff), 0.2, -0.1));
  group.add(instanced(walls, mat(0xffffff), WALL_H, WALL_H / 2));
  group.add(instanced(details, mat(0xffffff), 0.1, 0));
  group.add(instanced(mossy, mat(0xffffff), 0.06, 0.03));
  const lavaMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  group.add(instanced(lavas, lavaMat, 0.12, -0.08));

  // teias
  const webMat = mat(0xe8e8f0, 0.2, { opacity: 0.45 });
  for (const w of webs) {
    for (const rot of [Math.PI / 4, -Math.PI / 4]) {
      const m = new THREE.Mesh(BOX, webMat);
      m.scale.set(1.0, 0.75, 0.03);
      m.position.set(w.x, 0.38, w.z);
      m.rotation.y = rot;
      group.add(m);
    }
  }

  // tochas
  const torches = parsed.torches.map((t, i) => {
    const g = new THREE.Group();
    g.position.set(t.x + 0.5, 0, t.y + 0.5);
    vox(g, 0x3a2a1c, 7, 22, 7, 0, 11, 0);
    vox(g, 0x5c5c66, 12, 3, 12, 0, 23, 0);
    const flame = new THREE.Group();
    vox(flame, 0xff7a1a, 6, 6, 6, 0, 27, 0, 1.5);
    vox(flame, 0xffd23a, 3.5, 4, 3.5, 0, 31, 0, 1.6);
    g.add(flame);
    const ember = vox(g, 0x6a2a10, 6, 1.5, 6, 0, 25, 0, 0.5);
    bake(g);
    group.add(g);
    const lit = i % 2 === 0; // metade já começa acesa
    flame.visible = lit;
    return { x: t.x + 0.5, z: t.y + 0.5, tx: t.x, ty: t.y, lit, flame, ember, group: g };
  });

  // paredes rachadas (segredo)
  const cracks = parsed.cracks.map((c) => {
    const g = new THREE.Group();
    g.position.set(c.x + 0.5, 0, c.y + 0.5);
    const base = new THREE.Mesh(BOX, mat(0x585254));
    base.scale.set(1, WALL_H, 1);
    base.position.y = WALL_H / 2;
    g.add(base);
    for (const [a, b] of [[-6, 20], [-2, 16], [2, 12], [5, 8], [1, 24]]) {
      vox(g, 0x1c1a1b, 2, 3, 25.4, a, b, 0);
      vox(g, 0x1c1a1b, 25.4, 3, 2, 0, b, a);
    }
    bake(g);
    group.add(g);
    return { tx: c.x, ty: c.y, hp: 3, broken: false, group: g };
  });

  // fogueiras azuis (checkpoint)
  const checkpoints = parsed.checkpoints.map((c) => {
    const g = new THREE.Group();
    g.position.set(c.x + 0.5, 0, c.y + 0.5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      vox(g, 0x6a6a74, 5, 4, 5, Math.cos(a) * 8, 2, Math.sin(a) * 8);
    }
    vox(g, 0x3a2a1c, 10, 2, 3, 0, 3, 0);
    vox(g, 0x3a2a1c, 3, 2, 10, 0, 3.5, 0);
    const flame = new THREE.Group();
    vox(flame, 0x2a8cff, 7, 8, 7, 0, 9, 0, 1.5);
    vox(flame, 0x9fe0ff, 4, 6, 4, 0, 14, 0, 1.6);
    g.add(flame);
    flame.visible = false;
    const smoke = new THREE.Group();
    vox(smoke, 0x777777, 4, 4, 4, 0, 8, 0, 0.1);
    g.add(smoke);
    bake(g);
    group.add(g);
    return { x: c.x + 0.5, z: c.y + 0.5, active: false, flame, smoke, group: g };
  });

  // baús
  const chests = parsed.chests.map((c) => {
    const b = buildBau(c.kind);
    b.root.position.set(c.x + 0.5, 0, c.y + 0.5);
    group.add(b.root);
    return { ...c, wx: c.x + 0.5, wz: c.y + 0.5, open: false, lidT: 0, ...b };
  });

  // corações no chão
  const hearts = parsed.hearts.map((h) => {
    const g = buildCoracao();
    g.position.set(h.x + 0.5, 0, h.y + 0.5);
    group.add(g);
    return { x: h.x + 0.5, z: h.y + 0.5, taken: false, mesh: g };
  });

  // saída: portal de pedra com portas
  let exit = null;
  if (parsed.exit) {
    const g = new THREE.Group();
    g.position.set(parsed.exit.x + 0.5, 0, parsed.exit.y + 0.5);
    vox(g, 0x2a2628, 25, 2, 25, 0, 1, 0);
    vox(g, 0x77707a, 5, 40, 5, -11, 20, 0);
    vox(g, 0x77707a, 5, 40, 5, 11, 20, 0);
    vox(g, 0x77707a, 27, 5, 6, 0, 42, 0);
    const glow = vox(g, 0x7dff9a, 17, 34, 1, 0, 18, 0, 1.2, { opacity: 0.55 });
    const bars = new THREE.Group();
    for (let i = -2; i <= 2; i++) vox(bars, 0x3a3f46, 2, 38, 2, i * 4, 19, 0);
    vox(bars, 0x3a3f46, 20, 2, 2, 0, 30, 0);
    g.add(bars);
    bake(g);
    group.add(g);
    exit = { x: parsed.exit.x + 0.5, z: parsed.exit.y + 0.5, group: g, glow, bars, locked: false };
  }

  return { group, lavaMat, torches, cracks, checkpoints, chests, hearts, exit, WALL_H };
}
