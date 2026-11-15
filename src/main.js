// Liga tudo: telas, mapa, Forja, prólogo e as fases.
import * as THREE from '../vendor/three.module.min.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { initAudio, playMusic, setSound, sfx, bindUnlock, stopAmbience, audioState } from './audio.js';
import { loadSave, writeSave, getTestMode, setTestMode } from './save.js';
import { WORLDS, LEVELS, getLevel, TOTAL_PHASES } from './levels.js';
import { applyLevelResult, buyUpgrade, upgradeCost, UPGRADES, isUnlocked } from './progress.js';
import { buildHero } from './models.js';
import { tex } from './textures.js';
import * as Props from './props.js';
import { bake, roundedBox as rb } from './geo.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// se o celular apagar a placa de vídeo (falta de memória), recarrega a página: o progresso fica salvo
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); try { writeSave(save); } catch { /* ok */ } setTimeout(() => location.reload(), 300); });
const ui = new UI();
const input = new Input(document.body);
const game = new Game({ renderer, ui, input });
// ?baixa no endereço força o modo leve (sem sombras), para celulares bem simples
if (/baixa/.test(location.search)) { game.lowQuality = true; renderer.shadowMap.enabled = false; renderer.setPixelRatio(1); }
let save = loadSave();
let testMode = getTestMode();
let mode = 'menu'; // menu | game
setSound(save.sound);

// ---------------- cena dos menus: uma maquetinha flutuante com o herói ----------------
const menu = buildMenuScene();

function buildMenuScene() {
  const scene = new THREE.Scene();
  scene.background = tex('bgMenu');
  const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x3a3020, 1.2));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sun.position.set(-3, 6, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
  scene.add(sun);
  const rim = new THREE.PointLight(0xff5040, 6, 8, 1.4); rim.position.set(1.5, 1.6, -1); scene.add(rim);

  // ilha
  const island = new THREE.Group();
  scene.add(island);
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 2.6), [0, 0, 0, 0, 0, 0].map((_, i) => new THREE.MeshLambertMaterial(i === 2 ? { map: tex('grass') } : { map: tex('stone') })));
  top.position.y = -0.15; top.receiveShadow = true;
  island.add(top);
  const deco = new THREE.Group();
  const r = (() => { let s = 77; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  Props.tree(deco, -1.35, -0.85, r);
  Props.rock(deco, 1.35, -0.8, r);
  Props.bush(deco, 1.5, 0.75, r);
  Props.flowers(deco, -1.2, 0.8, r);
  Props.grassTuft(deco, -0.6, 0.9, r);
  Props.grassTuft(deco, 0.9, -0.2, r);
  Props.mushroom(deco, 1.0, 0.95, r);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const m = new THREE.Mesh(rb(0.7, 0.55, 0.7, 0.12), new THREE.MeshLambertMaterial({ map: tex('stone'), color: 0xb0aab0 }));
    m.position.set(Math.cos(a) * 1.55, -0.5, Math.sin(a) * 1.05);
    m.rotation.y = a;
    island.add(m);
  }
  const under = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.6, 7), new THREE.MeshLambertMaterial({ color: 0x3d3940 }));
  under.rotation.x = Math.PI; under.position.y = -1.3; under.scale.z = 0.7;
  island.add(under);
  bake(deco);
  deco.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  island.add(deco);

  const heroes = { lunerb: buildHero('lunerb'), lucas: buildHero('lucas'), feligon: buildHero('feligon'), dait: buildHero('dait') };
  for (const h of Object.values(heroes)) { h.root.visible = false; island.add(h.root); }
  // casa do Lucas (só aparece no final)
  const home = Props.house();
  home.group.position.set(0.15, 0, -0.6);
  home.group.scale.setScalar(0.95);
  home.group.visible = false;
  home.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  island.add(home.group);
  // vilazinha da capa (casas, cerca e caminho), só na tela inicial
  const village = new THREE.Group();
  const vr = (() => { let q = 91; return () => { q = (q * 16807) % 2147483647; return (q - 1) / 2147483646; }; })();
  for (const [x, z, sc, ry] of [[-0.55, -0.95, 0.55, 0.25], [0.75, -1.0, 0.6, -0.3]]) {
    const h = Props.house();
    h.group.position.set(x, 0, z); h.group.scale.setScalar(sc); h.group.rotation.y = ry;
    village.add(h.group);
  }
  const vdeco = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  for (let i = 0; i < 7; i++) {
    const post = new THREE.Mesh(rb(0.05, 0.22, 0.05, 0.01), wood);
    post.position.set(-1.6 + i * 0.22, 0.11, 0.35);
    vdeco.add(post);
  }
  const rail = new THREE.Mesh(rb(1.4, 0.04, 0.03, 0.01), wood);
  rail.position.set(-0.94, 0.17, 0.35);
  vdeco.add(rail);
  Props.flowers(vdeco, 0.1, -0.45, vr);
  Props.grassTuft(vdeco, -0.2, 0.7, vr);
  vdeco.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  village.add(vdeco);
  village.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  village.visible = false;
  island.add(village);
  const bolts = [];
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x9a4bff : 0x222222 }));
    island.add(b); bolts.push(b);
  }
  return { scene, cam, island, heroes, bolts, pose: 'title', t: 0, rim, home, deco, village, poseT: 0 };
}

function setPose(pose, hero = 'lunerb') {
  menu.pose = pose;
  menu.poseT = 0;
  const final = pose === 'final', cover = pose === 'title';
  for (const [k, h] of Object.entries(menu.heroes)) h.root.visible = final || cover ? k !== 'lucas' : k === hero;
  menu.home.group.visible = final;
  menu.village.visible = cover;
  menu.home.door.rotation.y = 0;
  menu.scene.background = tex(final ? 'bgSunset' : cover ? 'bgDay' : 'bgMenu');
  menu.rim.color.setHex(final ? 0xffa050 : 0xff5040);
  const L = menu.heroes.lunerb;
  L.guns[1].visible = save.weapons >= 1 || pose === 'title';
  L.guns[0].visible = save.weapons >= 2 || pose === 'title';
}

function updateMenu(dt) {
  const m = menu;
  m.t += dt;
  m.poseT += dt;
  if (m.pose === 'final') return updateFinalPose(m);
  if (m.pose === 'title') return updateCoverPose(m);
  const aspect = innerWidth / innerHeight;
  // a maquete fica à esquerda na tela inicial e no centro nas outras
  const left = m.pose === 'title';
  m.cam.aspect = aspect;
  if (m.pose === 'closeup') { m.cam.position.set(0.5, 1.0, 2.2); m.cam.lookAt(0.05, 0.75, 0); }
  else { m.cam.position.set(left ? 2.2 : 0, 2.6, 6.4); m.cam.lookAt(left ? 2.2 : 0, 0.35, 0); }
  m.cam.updateProjectionMatrix();
  m.island.position.y = Math.sin(m.t * 0.8) * 0.06;
  m.island.rotation.y = -0.5 + Math.sin(m.t * 0.25) * 0.25;
  const H = m.heroes[menu.heroes.lucas.root.visible ? 'lucas' : 'lunerb'];
  H.root.position.set(0, 0, 0.1);
  H.root.rotation.y = 0.35;
  const sw = Math.sin(m.t * 2);
  H.body.position.y = Math.abs(sw) * 0.01;
  H.legs[0].rotation.x = 0; H.legs[1].rotation.x = 0;
  if (m.pose === 'title' || m.pose === 'hero') {
    H.arms[0].rotation.set(-1.35, 0, -0.15); H.arms[1].rotation.set(-1.35, 0, 0.15);
  } else {
    H.arms[0].rotation.set(sw * 0.1, 0, 0); H.arms[1].rotation.set(-sw * 0.1, 0, 0);
  }
  H.head.rotation.y = Math.sin(m.t * 0.7) * 0.25;
  m.bolts.forEach((b, i) => {
    b.visible = m.pose === 'title';
    const a = m.t * 2.5 + i * 0.52;
    b.position.set(Math.cos(a) * 0.55, 0.3 + ((m.t * 0.9 + i * 0.3) % 1.4), 0.1 + Math.sin(a) * 0.55);
  });
}

// capa: os três amigos juntos, o Dait no meio abraçando os dois (pedido do Lucas)
function updateCoverPose(m) {
  m.cam.aspect = innerWidth / innerHeight;
  const wide = m.cam.aspect > 1.9;
  m.cam.position.set(wide ? 1.35 : 1.15, 1.75, wide ? 5.3 : 5.8); m.cam.lookAt(wide ? 1.35 : 1.15, 0.58, 0);
  m.cam.updateProjectionMatrix();
  m.island.position.y = Math.sin(m.t * 0.8) * 0.04;
  m.island.rotation.y = Math.sin(m.t * 0.25) * 0.12;
  if (window.__icone) { // usado só para gerar o ícone do app (tools/icone.mjs)
    m.island.position.y = 0; m.island.rotation.y = 0;
    m.cam.position.set(0, 1.2, 4.3); m.cam.lookAt(0, 0.8, 0);
    m.cam.updateProjectionMatrix();
  }
  const L = m.heroes.lunerb, F = m.heroes.feligon, D = m.heroes.dait;
  const breathe = Math.sin(m.t * 2) * 0.008;
  // da esquerda para a direita, como na imagem: Feligon, Dait, Lunerb
  F.root.position.set(-0.53, 0, 0.1); F.root.rotation.y = 0.1;
  D.root.position.set(0, 0, 0.02); D.root.rotation.y = 0;
  L.root.position.set(0.53, 0, 0.1); L.root.rotation.y = -0.1;
  for (const h of [F, D, L]) {
    h.legs[0].rotation.x = 0; h.legs[1].rotation.x = 0;
    h.body.position.y = breathe;
    h.guns.forEach((g) => (g.visible = false));
  }
  // Dait: um braço em cima do ombro de cada amigo
  D.arms[0].rotation.set(0, 0, -1.32);
  D.arms[1].rotation.set(0, 0, 1.32);
  // os amigos: braço de dentro nas costas do Dait, braço de fora solto
  F.arms[0].rotation.set(Math.sin(m.t * 1.3) * 0.05, 0, 0.12);
  F.arms[1].rotation.set(0.25, 0, 0.55);
  L.arms[0].rotation.set(0.25, 0, -0.55);
  L.arms[1].rotation.set(Math.sin(m.t * 1.3 + 1) * 0.05, 0, -0.12);
  F.head.rotation.y = 0.15 + Math.sin(m.t * 0.7) * 0.08;
  L.head.rotation.y = -0.15 + Math.sin(m.t * 0.7 + 1) * 0.08;
  D.head.rotation.y = Math.sin(m.t * 0.5) * 0.06;
  m.bolts.forEach((b) => (b.visible = false));
}

// cena final: os três amigos chegam e o Lunerb abre a porta de casa
function updateFinalPose(m) {
  m.cam.aspect = innerWidth / innerHeight;
  m.cam.position.set(0.2, 2.2, 6.0); m.cam.lookAt(0.1, 0.45, -0.2);
  m.cam.updateProjectionMatrix();
  m.island.position.y = Math.sin(m.t * 0.8) * 0.05;
  m.island.rotation.y = -0.25 + Math.sin(m.t * 0.2) * 0.08;
  const t = m.poseT;
  const L = m.heroes.lunerb, F = m.heroes.feligon, D = m.heroes.dait;
  const walk = Math.min(1, t / 2.5);
  L.root.position.set(-0.9 + 1.1 * walk, 0, 0.55 - 0.45 * walk);
  L.root.rotation.y = walk < 1 ? 0.9 : Math.PI + 0.1;
  const sw = walk < 1 ? Math.sin(t * 10) * 0.7 : 0;
  L.legs[0].rotation.x = sw; L.legs[1].rotation.x = -sw;
  L.arms[0].rotation.set(-sw, 0, 0);
  L.arms[1].rotation.set(walk >= 1 && t > 3 ? -1.4 : sw, 0, 0);
  m.home.door.rotation.y = -Math.min(1.7, Math.max(0, t - 3.2) * 1.4);
  F.root.position.set(-0.75, 0, 0.75); F.root.rotation.y = 0.5;
  D.root.position.set(-1.3, 0, 0.35); D.root.rotation.y = 0.6;
  for (const [h, ph] of [[F, 0], [D, 1.5]]) {
    h.legs[0].rotation.x = 0; h.legs[1].rotation.x = 0;
    h.arms[0].rotation.set(0, 0, 0);
    h.arms[1].rotation.set(-2.6 + Math.sin(m.t * 6 + ph) * 0.35, 0, 0); // dando tchau
    h.body.position.y = Math.abs(Math.sin(m.t * 3 + ph)) * 0.02;
  }
  for (const h of [L, F, D]) { h.guns.forEach((g) => (g.visible = h === L)); }
  m.bolts.forEach((b) => (b.visible = false));
}

// ---------------- telas ----------------
function showTitle() {
  mode = 'menu';
  stopAmbience();
  ui.gameMode(false);
  ui.show('scr-title');
  setPose('title');
  $('test-badge').classList.toggle('hidden', !testMode);
  $('btn-sound-title').textContent = save.sound ? '🔊' : '🔇';
  playMusic('title');
}

function showMap() {
  mode = 'menu';
  stopAmbience();
  ui.gameMode(false);
  ui.fade(false);
  ui.show('scr-map');
  setPose('idle', save.unlocked >= 1 ? 'lunerb' : 'lucas');
  $('map-crystals').textContent = save.crystals;
  const box = $('worlds');
  box.innerHTML = '';
  // prólogo
  const pro = document.createElement('div');
  pro.className = 'world prologue';
  pro.innerHTML = '<h3>Prólogo<br>A Floresta</h3>';
  const pb = document.createElement('button');
  pb.className = `phase${save.unlocked < 1 ? ' next' : ''}`;
  pb.innerHTML = `Jogar${save.unlocked >= 1 ? '<span class="st">✔</span>' : '<span class="st">▶</span>'}`;
  pb.onclick = () => { sfx('clique'); startLevel(0); };
  pro.appendChild(pb);
  box.appendChild(pro);
  for (const w of WORLDS) {
    const div = document.createElement('div');
    div.className = `world${w.ready ? '' : ' locked'}`;
    div.innerHTML = `<h3>Mundo ${w.id}<br>${w.name}</h3>`;
    for (let k = 1; k <= 2; k++) {
      const id = (w.id - 1) * 2 + k;
      const lvl = getLevel(id);
      const open = lvl && isUnlocked(save, id, testMode);
      const b = document.createElement('button');
      const isNext = open && lvl && id === nextPhase();
      b.className = `phase${open ? '' : ' locked'}${isNext ? ' next' : ''}${open && !isNext && (save.stars[id] || [])[0] ? ' done' : ''}`;
      const st = save.stars[id] || [];
      const stars = [0, 1, 2].map((i) => (st[i] ? '★' : '<i>★</i>')).join('');
      b.innerHTML = lvl
        ? `${isNext ? '▶ ' : ''}Fase ${id}${open ? '' : ' 🔒'}<span class="st">${stars}</span>`
        : `Fase ${id}<span class="st" style="font-size:11px;color:#888">em breve</span>`;
      if (open) b.onclick = () => { sfx('clique'); startLevel(id); };
      div.appendChild(b);
    }
    box.appendChild(div);
  }
  playMusic('title');
}

// a fase que o jogador deve jogar agora (a primeira liberada que ainda não terminou)
function nextPhase() {
  const ids = LEVELS.filter((l) => l.kind === 'fase').map((l) => l.id);
  for (const id of ids) if (isUnlocked(save, id, false) && !(save.stars[id] || [])[0]) return id;
  return null;
}

function showForge() {
  ui.show('scr-forge');
  $('forge-crystals').textContent = save.crystals;
  const list = $('forge-list');
  list.innerHTML = '';
  for (const [key, up] of Object.entries(UPGRADES)) {
    const lvl = save.upgrades[key];
    const cost = upgradeCost(save, key);
    const d = document.createElement('div');
    d.className = 'up';
    const pips = up.costs.map((_, i) => `<b class="${i < lvl ? 'on' : ''}"></b>`).join('');
    d.innerHTML = `<h3>${up.name}</h3><p>${up.desc}</p><div class="pips">${pips}</div>`;
    const btn = document.createElement('button');
    if (cost === null) { btn.textContent = 'MÁXIMO'; btn.disabled = true; }
    else { btn.innerHTML = `Melhorar · ${cost} <span class="gem"></span>`; btn.disabled = save.crystals < cost; }
    btn.onclick = () => {
      const r = buyUpgrade(save, key);
      if (r.ok) { save = r.save; writeSave(save); sfx('bau'); showForge(); }
    };
    d.appendChild(btn);
    list.appendChild(d);
  }
  $('forge-hint').textContent = save.weapons < 1 ? 'Primeiro encontre uma Booteshiscore na Fase 1!' : 'Derrote monstros e abra baús para juntar diamantes. O Mercador Misterioso vende armas novas!';
  $('btn-test-gems').classList.toggle('hidden', !testMode);
}

// ---------------- final do Mundo 1 ----------------
const ENDING_W1 = [
  { text: 'O Capitão de Ferro virou fumacinha e o portão se abriu!' },
  { text: 'Pela primeira vez, o Lunerb viu o céu da noite lá fora.' },
  { text: 'Mas a casa dele ainda está longe... e a floresta à frente sussurra coisas estranhas.' },
];
const ENDING_W2 = [
  { text: 'O Ancião Oco voltou a ser a árvore mais sábia do bosque.' },
  { text: 'Agora o Lunerb tem um amigo de verdade: o Feligon!' },
  { text: 'O lodo vem do pântano... alguém está despejando lodo nos rios. O caminho de casa passa por lá.' },
];
const ENDING_W3 = [
  { text: 'A Hidra de Lodo virou uma poça inofensiva, e os canos ficaram em silêncio.' },
  { text: 'Agora são três: Lunerb, Feligon e Dait, que conhece todos os segredos do Morgrave.' },
  { text: 'Lá longe, no alto de uma torre torta, uma luz verde pisca. É lá que o lodo nasce.' },
];
const ENDING_FINAL = [
  { text: 'Os três amigos juntaram seus poderes, e o Lodo Negro virou água limpa.' },
  { text: 'O Morgrave voltou a ser um velhinho gentil e prometeu limpar todos os rios.' },
  { text: 'Feligon e Dait acompanharam o Lunerb pela floresta, até o pôr do sol.' },
  { text: 'E lá estava ela: a casa do Lucas, com a luz acesa, esperando por ele.' },
  { text: 'O Lunerb abriu a porta... e finalmente estava em casa.' },
];
const ENDINGS = {
  2: { world: 1, slides: ENDING_W1, next: 'Continua no Mundo 2: Bosque dos Sussurros...' },
  4: { world: 2, slides: ENDING_W2, next: 'Continua no Mundo 3: Pântano do Lodo Negro...' },
  6: { world: 3, slides: ENDING_W3, next: 'Continua no Mundo 4: Torre do Alquimista...' },
  8: { world: 4, slides: ENDING_FINAL, next: '🏠 FIM — Obrigado por jogar!', final: true },
};
let story = null;
function playStory(slides, done, pose = 'hero') {
  mode = 'menu';
  ui.gameMode(false);
  ui.show('scr-story');
  setPose(pose);
  story = { slides, i: 0, done };
  $('story-text').textContent = slides[0].text;
}
$('scr-story').addEventListener('pointerdown', (e) => {
  if (e.target.id === 'btn-skip' || !story) return;
  sfx('clique');
  story.i++;
  if (story.i >= story.slides.length) { const d = story.done; story = null; d(); } else $('story-text').textContent = story.slides[story.i].text;
});
$('btn-skip').onclick = (e) => { e.stopPropagation(); if (!story) return; const d = story.done; story = null; d(); };

// ---------------- jogar ----------------
function startLevel(id) {
  ui.fade(true);
  setTimeout(() => {
    ui.show(null);
    ui.gameMode(true);
    mode = 'game';
    input.reset();
    game.start(id, save, {
      testMode,
      onComplete: (res) => levelDone(id, res),
      onPersist: () => { save = game.save; writeSave(save); },
      // o Lunerb desmaiou: a fase recomeça da primeira sala (diamantes e armas ficam)
      onDeath: () => { save = game.save; writeSave(save); game.running = false; startLevel(id); },
    });
    ui.fade(false);
  }, 380);
}

function levelDone(id, res) {
  const def = getLevel(id);
  const endInfo = ENDINGS[id] && !(game.save.endings || {})[ENDINGS[id].world] ? ENDINGS[id] : null;
  // os diamantes já foram guardados um a um durante a fase
  save = applyLevelResult(game.save, id, { ...res, crystals: 0 }, { weaponReward: def.weaponReward, totalLevels: TOTAL_PHASES });
  save.unlocked = Math.min(save.unlocked, Math.max(...LEVELS.map((l) => l.id)));
  writeSave(save);
  game.running = false;
  // prólogo: caiu no lago... e acorda no castelo
  if (def.kind === 'prologo') {
    setTimeout(() => startLevel(1), 900);
    return;
  }
  ui.gameMode(false);
  const got = [res.finished, res.finished && res.damageTaken === 0, res.finished && res.secretFound];
  $('res-title').textContent = `${def.title} — completa!`;
  $('res-stars').innerHTML = got.map((g) => (g ? '★' : '<i>★</i>')).join('');
  $('res-list').innerHTML = [
    `<li>${got[0] ? '✅' : '⬜'} Terminou a fase</li>`,
    `<li>${got[1] ? '✅' : '⬜'} Sem perder nenhum coração</li>`,
    `<li>${got[2] ? '✅' : '⬜'} Achou o baú secreto</li>`,
  ].join('');
  $('res-crystals').textContent = res.crystals;
  ui.show('scr-result');
  setPose('hero');
  const nextId = getLevel(id + 1) && isUnlocked(save, id + 1, testMode) ? id + 1 : null;
  $('btn-res-ok').textContent = endInfo ? 'Continuar ▶' : nextId ? 'Próxima fase ▶' : 'Continuar ▶';
  $('btn-res-ok').onclick = () => {
    sfx('clique');
    if (endInfo) {
      playMusic('ending');
      playStory(endInfo.slides, () => { save.endings = { ...save.endings, [endInfo.world]: true }; save.endingSeen = true; writeSave(save); showCredits(endInfo.next, nextId, !!endInfo.final); }, endInfo.final ? 'final' : 'hero');
    } else if (nextId) startLevel(nextId);
    else showMap();
  };
  $('btn-res-map').onclick = () => { sfx('clique'); showMap(); };
}

function showCredits(next, nextId = null, final = false) {
  if (next) document.querySelector('#scr-credits .soon').textContent = next;
  $('scr-credits').classList.toggle('final', final);
  $('btn-credits-ok').textContent = nextId ? 'Continuar a aventura ▶' : 'Voltar ao mapa';
  $('btn-credits-ok').onclick = () => { sfx('clique'); if (nextId) startLevel(nextId); else showMap(); };
  ui.show('scr-credits');
  setPose(final ? 'final' : 'hero');
  playMusic('ending');
}

// ---------------- botões ----------------
let logoTaps = 0, logoT = 0;
$('logo').addEventListener('pointerdown', () => {
  const now = performance.now();
  if (now - logoT > 2500) logoTaps = 0;
  logoT = now;
  logoTaps++;
  if (logoTaps >= 7) {
    logoTaps = 0;
    testMode = !testMode;
    setTestMode(testMode);
    $('test-badge').classList.toggle('hidden', !testMode);
    ui.toast(testMode ? 'Modo teste LIGADO' : 'Modo teste desligado');
  }
});

$('btn-play').onclick = () => {
  initAudio();
  sfx('clique');
  try { document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => {}); } catch { /* ok */ }
  if (save.unlocked === 0 && !testMode) startLevel(0); else showMap();
};
$('btn-sound-title').onclick = () => { initAudio(); toggleSound(); $('btn-sound-title').textContent = save.sound ? '🔊' : '🔇'; };
$('btn-map-back').onclick = () => { sfx('clique'); showTitle(); };
$('btn-forge').onclick = () => { sfx('clique'); showForge(); };
$('btn-forge-back').onclick = () => { sfx('clique'); showMap(); };
$('btn-test-gems').onclick = () => { save.crystals += 100; writeSave(save); showForge(); };

$('btn-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); pause(true); });
$('btn-resume').onclick = () => pause(false);
$('btn-quit').onclick = () => { pause(false); game.running = false; game.dispose(); showMap(); };
$('btn-sound').onclick = () => { toggleSound(); };
$('btn-invincible').onclick = () => { ui.invincible = !ui.invincible; refreshPause(); };
$('btn-skip-level').onclick = () => { pause(false); game.forceComplete(); };

function toggleSound() {
  save.sound = !save.sound;
  setSound(save.sound);
  writeSave(save);
  refreshPause();
}
function refreshPause() {
  $('btn-sound').textContent = save.sound ? '🔊 Som: ligado' : '🔇 Som: desligado';
  $('btn-invincible').textContent = `Invencível: ${ui.invincible ? 'sim' : 'não'}`;
  $('test-tools').classList.toggle('hidden', !testMode);
}
function pause(on) {
  if (mode !== 'game' || !game.running) return;
  game.paused = on;
  input.reset();
  refreshPause();
  $('scr-pause').classList.toggle('hidden', !on);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
bindUnlock(); // destrava o som no primeiro toque (celular) e tenta de novo se precisar

// ---------------- laço ----------------
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  game.resize();
});

let last = performance.now();
let crashes = 0, lastError = null, stuckT = 0;
// vigia: se o jogo ficar parado sem motivo (sem conversa, cena, loja ou troca de sala), destrava
function watchdog(dt) {
  const busy = ui.dialogOpen || game.cine || game.trans || game.paused || game.ended || !$('scr-shop').classList.contains('hidden');
  if (game.frozen && !busy) stuckT += dt; else stuckT = 0;
  if (stuckT > 4) {
    stuckT = 0;
    if (game.dying) game.restartAfterDeath();
    else { game.frozen = false; input.reset(); console.warn('[lunerb] destravado pelo vigia'); }
  }
}
function frame(now) {
  const realDt = Math.min(0.5, (now - last) / 1000);
  const dt = Math.min(0.05, realDt);
  last = now;
  if (mode === 'game' && game.running) {
    try {
      if (!ui.dialogOpen) game.update(dt); else { game.animate(0); game.updateCamera(dt); }
      game.render();
      watchdog(realDt);
      crashes = 0;
    } catch (err) {
      // um erro não pode parar o jogo: registra e tenta seguir; se repetir muito, recomeça a fase
      console.error('[lunerb]', err);
      lastError = String(err && err.stack || err);
      crashes++;
      if (crashes > 30 && game.def) { crashes = 0; ui.toast('Ops! Algo deu errado. Recomeçando a fase...'); const id = game.def.id; game.running = false; startLevel(id); }
    }
  } else {
    renderer.toneMappingExposure = 1.1;
    updateMenu(dt);
    renderer.render(menu.scene, menu.cam);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

showTitle();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// usado pelo teste automático no navegador
window.__lunerb = { audioState, game, ui, renderer, menu, get save() { return save; }, startLevel, showMap, get lastError() { return lastError; } };
