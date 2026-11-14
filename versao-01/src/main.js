// Liga tudo: telas, história, mapa, Forja e o jogo.
import * as THREE from '../vendor/three.module.min.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { initAudio, playMusic, setSound, sfx } from './audio.js';
import { loadSave, writeSave, getTestMode, setTestMode } from './save.js';
import { WORLDS, LEVELS, getLevel, TOTAL_PHASES } from './levels.js';
import { applyLevelResult, buyUpgrade, upgradeCost, UPGRADES, isUnlocked, countStars } from './progress.js';
import { buildLunerb, vox } from './models.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);

const ui = new UI();
const input = new Input(document.body);
const game = new Game({ renderer, ui, input });
let save = loadSave();
let testMode = getTestMode();
let mode = 'menu'; // menu | game
setSound(save.sound);

// ---------------- cena dos menus e da história ----------------
const menu = buildMenuScene();

function buildMenuScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0812);
  const cam = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
  cam.position.set(0, 2.2, 6.2);
  cam.lookAt(0, 0.8, 0);
  scene.add(new THREE.AmbientLight(0x9a8fbf, 0.9));
  const key = new THREE.PointLight(0xffb070, 9, 20, 1.2); key.position.set(-2.5, 5, 4); scene.add(key);
  const rim = new THREE.PointLight(0xb070ff, 9, 20, 1.2); rim.position.set(3, 4, -2); scene.add(rim);
  const floor = new THREE.Group();
  const cols = [0x3a3638, 0x403b3d, 0x353133];
  for (let x = -3; x <= 3; x++) for (let z = -2; z <= 2; z++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 1), new THREE.MeshLambertMaterial({ color: cols[(x * 7 + z * 3 + 9) % 3] }));
    m.position.set(x, -0.15, z); floor.add(m);
  }
  scene.add(floor);
  const water = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 5), new THREE.MeshBasicMaterial({ color: 0x3aff6a, transparent: true, opacity: 0.55 }));
  water.position.y = 0.25; water.visible = false; scene.add(water);
  const lun = buildLunerb();
  lun.root.scale.setScalar(1.6);
  scene.add(lun.root);
  const bolts = [];
  for (let i = 0; i < 14; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshLambertMaterial({ color: i % 2 ? 0x8a2be2 : 0x111111, emissive: i % 2 ? 0x8a2be2 : 0x000000, emissiveIntensity: 1.5 }));
    b.visible = false; scene.add(b); bolts.push(b);
  }
  return { scene, cam, lun, water, floor, bolts, pose: 'idle', key, rim, t: 0 };
}

function setPose(pose, bg) {
  menu.pose = pose;
  menu.scene.background.setHex(bg ?? 0x0b0812);
  menu.water.visible = pose === 'fall';
  menu.lun.guns[1].visible = save.weapons >= 1 || pose === 'title';
  menu.lun.guns[0].visible = save.weapons >= 2 || pose === 'title';
}

function updateMenu(dt) {
  const m = menu;
  m.t += dt;
  const L = m.lun;
  L.root.rotation.set(0, 0, 0);
  L.root.position.set(0, 0, 0);
  L.body.rotation.set(0, 0, 0);
  const sw = Math.sin(m.t * 7) * 0.7;
  L.legs[0].rotation.x = 0; L.legs[1].rotation.x = 0;
  L.arms[0].rotation.set(0, 0, 0); L.arms[1].rotation.set(0, 0, 0);
  switch (m.pose) {
    case 'title':
      L.root.position.x = -2.2;
      L.root.rotation.y = 0.5 + Math.sin(m.t * 0.6) * 0.25;
      L.arms[0].rotation.x = -1.4; L.arms[1].rotation.x = -1.4;
      L.arms[0].rotation.z = -0.25; L.arms[1].rotation.z = 0.25;
      break;
    case 'walk':
      L.root.rotation.y = Math.PI / 2;
      L.legs[0].rotation.x = sw; L.legs[1].rotation.x = -sw;
      L.arms[0].rotation.x = -sw; L.arms[1].rotation.x = sw;
      L.body.position.y = Math.abs(Math.sin(m.t * 7)) * 0.04;
      break;
    case 'fall':
      L.root.position.y = -0.4 + Math.sin(m.t * 2) * 0.1;
      L.root.rotation.z = 0.3;
      L.arms[0].rotation.z = -2.4; L.arms[1].rotation.z = 2.4;
      break;
    case 'lying':
      L.root.rotation.z = Math.PI / 2; L.root.position.set(0.9, 0.25, 0);
      break;
    case 'power':
      L.root.rotation.y = m.t * 1.5;
      L.arms[0].rotation.z = -0.6; L.arms[1].rotation.z = 0.6;
      break;
    case 'look':
      L.root.rotation.y = Math.sin(m.t * 1.5) * 0.9;
      break;
    case 'hero':
      L.root.rotation.y = 0.3;
      L.arms[0].rotation.x = -1.4; L.arms[1].rotation.x = -1.4;
      break;
    default:
      L.root.rotation.y = Math.sin(m.t * 0.5) * 0.4;
  }
  const showBolts = m.pose === 'power' || m.pose === 'title';
  m.bolts.forEach((b, i) => {
    b.visible = showBolts;
    if (!showBolts) return;
    const a = m.t * 3 + i * 0.9;
    const cx = m.pose === 'title' ? -2.2 : 0;
    b.position.set(cx + Math.cos(a) * 1.1, 0.4 + ((m.t * 1.5 + i * 0.37) % 2), Math.sin(a) * 1.1);
  });
  m.key.intensity = m.pose === 'lying' ? 2 : 9;
}

// ---------------- telas ----------------
function showTitle() {
  mode = 'menu';
  ui.gameMode(false);
  ui.show('scr-title');
  setPose('title');
  $('test-badge').classList.toggle('hidden', !testMode);
  $('btn-sound-title').textContent = save.sound ? '🔊' : '🔇';
  playMusic('title');
}

function showMap() {
  mode = 'menu';
  ui.gameMode(false);
  ui.show('scr-map');
  setPose('idle');
  $('map-crystals').textContent = save.crystals;
  const box = $('worlds');
  box.innerHTML = '';
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
      if (open) b.onclick = () => { sfx('clique'); beginLevel(id); };
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
  $('forge-hint').textContent = save.weapons < 1
    ? 'Primeiro encontre uma Booteshiscore na Fase 1!'
    : 'Derrote monstros e abra baús para juntar cristais.';
  $('btn-test-gems').classList.toggle('hidden', !testMode);
}

// ---------------- história ----------------
const INTRO = [
  { text: 'Num dia comum, o Lunerb caminhava tranquilo pela floresta...', pose: 'walk', bg: 0x10241a },
  { text: 'De repente... SPLASH! Ele escorregou e caiu numa água tóxica que brilhava no escuro!', pose: 'fall', bg: 0x0a2a10 },
  { text: 'Tudo ficou escuro... e o Lunerb desmaiou.', pose: 'lying', bg: 0x030303 },
  { text: 'Mas a água deu a ele um poder misterioso: o RAIO NEGRO! ⚡', pose: 'power', bg: 0x18062c },
  { text: 'Quando acordou, ele estava PRESO num castelo abandonado, cheio de monstros...', pose: 'look', bg: 0x1a0d0a },
  { text: 'Agora ele só tem um objetivo: VOLTAR PRA CASA!', pose: 'hero', bg: 0x2a0a0a },
];
const ENDING_W1 = [
  { text: 'O Capitão de Ferro virou fumacinha e o portão se abriu!', pose: 'hero', bg: 0x2a0a0a },
  { text: 'Pela primeira vez, o Lunerb viu o céu da noite lá fora.', pose: 'look', bg: 0x0a1030 },
  { text: 'Mas a casa dele ainda está longe... e a floresta à frente sussurra coisas estranhas.', pose: 'walk', bg: 0x0c1a10 },
];

let story = null;
function playStory(slides, done) {
  mode = 'menu';
  ui.gameMode(false);
  ui.show('scr-story');
  story = { slides, i: 0, done };
  showSlide();
}
function showSlide() {
  const s = story.slides[story.i];
  $('story-text').textContent = s.text;
  setPose(s.pose, s.bg);
}
$('scr-story').addEventListener('pointerdown', (e) => {
  if (e.target.id === 'btn-skip' || !story) return;
  sfx('clique');
  story.i++;
  if (story.i >= story.slides.length) { const d = story.done; story = null; d(); } else showSlide();
});
$('btn-skip').onclick = (e) => { e.stopPropagation(); if (!story) return; const d = story.done; story = null; d(); };

// ---------------- jogar ----------------
function beginLevel(id) {
  if (id === 1 && !save.storySeen) {
    playMusic('title');
    playStory(INTRO, () => { save.storySeen = true; writeSave(save); startLevel(id); });
    return;
  }
  startLevel(id);
}

function startLevel(id) {
  ui.fade(true);
  setTimeout(() => {
    ui.show(null);
    ui.gameMode(true);
    mode = 'game';
    input.reset();
    game.start(id, save, { testMode, onComplete: (res) => levelDone(id, res) });
    ui.fade(false);
  }, 350);
}

function levelDone(id, res) {
  const def = getLevel(id);
  const firstClearW1 = id === 2 && !save.endingSeen;
  save = applyLevelResult(save, id, res, { weaponReward: def.weaponReward, totalLevels: TOTAL_PHASES });
  // fases que ainda não existem não liberam
  save.unlocked = Math.min(save.unlocked, Math.max(...LEVELS.map((l) => l.id)));
  writeSave(save);
  game.running = false;
  ui.gameMode(false);
  const st = save.stars[id];
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
    if (firstClearW1) {
      playMusic('ending');
      playStory(ENDING_W1, () => { save.endingSeen = true; writeSave(save); showCredits(); });
    } else showMap();
  };
  void st;
}

function showCredits() {
  ui.show('scr-credits');
  setPose('hero', 0x120a1e);
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
  showMap();
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
addEventListener('pointerdown', () => initAudio(), { once: true });

// ---------------- laço ----------------
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  menu.cam.aspect = innerWidth / innerHeight;
  menu.cam.updateProjectionMatrix();
  game.resize();
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === 'game' && game.running) {
    if (!ui.dialogOpen) game.update(dt); else game.animate(0);
    game.render();
  } else {
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
window.__lunerb = { game, ui, renderer, get save() { return save; }, startLevel, showMap, beginLevel };
void vox;
