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

  const heroes = { lunerb: buildHero('lunerb'), lucas: buildHero('lucas') };
  for (const h of Object.values(heroes)) { h.root.visible = false; island.add(h.root); }
  const bolts = [];
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x9a4bff : 0x222222 }));
    island.add(b); bolts.push(b);
  }
  return { scene, cam, island, heroes, bolts, pose: 'title', t: 0, rim };
}

function setPose(pose, hero = 'lunerb') {
  menu.pose = pose;
  for (const [k, h] of Object.entries(menu.heroes)) h.root.visible = k === hero;
  const L = menu.heroes.lunerb;
  L.guns[1].visible = save.weapons >= 1 || pose === 'title';
  L.guns[0].visible = save.weapons >= 2 || pose === 'title';
}

function updateMenu(dt) {
  const m = menu;
  m.t += dt;
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
  pb.className = 'phase';
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
      b.className = `phase${open ? '' : ' locked'}`;
      const st = save.stars[id] || [];
      const stars = [0, 1, 2].map((i) => (st[i] ? '★' : '<i>★</i>')).join('');
      b.innerHTML = lvl
        ? `Fase ${id}${open ? '' : ' 🔒'}<span class="st">${stars}</span>`
        : `Fase ${id}<span class="st" style="font-size:11px;color:#888">em breve</span>`;
      if (open) b.onclick = () => { sfx('clique'); startLevel(id); };
      div.appendChild(b);
    }
    box.appendChild(div);
  }
  playMusic('title');
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
const ENDINGS = {
  2: { world: 1, slides: ENDING_W1, next: 'Continua no Mundo 2: Bosque dos Sussurros...' },
  4: { world: 2, slides: ENDING_W2, next: 'Continua no Mundo 3: Pântano do Lodo Negro...' },
};
let story = null;
function playStory(slides, done) {
  mode = 'menu';
  ui.gameMode(false);
  ui.show('scr-story');
  setPose('hero');
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
  $('btn-res-ok').onclick = () => {
    sfx('clique');
    if (endInfo) {
      playMusic('ending');
      playStory(endInfo.slides, () => { save.endings = { ...save.endings, [endInfo.world]: true }; save.endingSeen = true; writeSave(save); showCredits(endInfo.next); });
    } else showMap();
  };
}

function showCredits(next) {
  if (next) document.querySelector('#scr-credits .soon').textContent = next;
  ui.show('scr-credits');
  setPose('hero');
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
$('btn-credits-ok').onclick = () => { sfx('clique'); showMap(); };

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
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === 'game' && game.running) {
    if (!ui.dialogOpen) game.update(dt); else { game.animate(0); game.updateCamera(dt); }
    game.render();
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
window.__lunerb = { audioState, game, ui, renderer, menu, get save() { return save; }, startLevel, showMap };
