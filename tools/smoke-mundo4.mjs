// Teste no navegador do Mundo 4: torre, engrenagens, robôs, frascos, Golem, Morgrave, golpe final e cena final.
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = new URL('../', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  try { const data = await readFile(join(root, p === '/' ? 'index.html' : p)); res.writeHead(200, { 'content-type': types[extname(p)] || 'text/html' }); res.end(data); } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8780, r));
const out = join(root, '.smoke'); await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: join(out, n + '.png') });
const G = (fn, arg) => page.evaluate(fn, arg);
const dlg = async (n = 8) => { for (let i = 0; i < n; i++) { if (!(await G(() => window.__lunerb.ui.dialogOpen))) break; await G(() => document.getElementById('dialog').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await wait(150); } };
const W = (fn, t = 120000, arg) => page.waitForFunction(fn, { timeout: t }, arg);

await page.goto('http://localhost:8780/?baixa', { waitUntil: 'load' });
await G(() => localStorage.setItem('lunerb_save_v1', JSON.stringify({ unlocked: 8, weapons: 2, crystals: 80, friends: ['feligon', 'dait'], endings: { 1: true, 2: true, 3: true } })));
await page.reload({ waitUntil: 'load' }); await wait(800);
// ---------- Fase 7 ----------
await G(() => window.__lunerb.startLevel(7));
await W(() => window.__lunerb.game.running && window.__lunerb.ui.dialogOpen); await dlg();
await wait(1200); await shot('80-fase7');
console.log('fase 7', await G(() => { const g = window.__lunerb.game; return { tipos: [...new Set(g.rooms.flatMap((r) => r.enemies.map((e) => e.type)))], time: g.heroes.map((h) => h.id), engrenagens: g.room.vis.gears.length }; }));
await G(() => { const g = window.__lunerb.game; g.ui.invincible = true; g.testMode = true; });
// engrenagem empurra
const pos = await G(() => { const g = window.__lunerb.game; const q = g.room.pr.gears[0]; g.player.x = g.room.off.x + q.x + 0.7; g.player.z = g.room.off.z + q.y + 0.5; return [g.player.x, g.player.z]; });
await wait(1500);
console.log('engrenagem empurrou', await G((p0) => { const g = window.__lunerb.game; return Math.hypot(g.player.x - p0[0], g.player.z - p0[1]) > 0.2; }, pos));
// frasco estoura perto
await G(() => { const g = window.__lunerb.game; g.ui.invincible = false; g.player.hp = 5; g.player.inv = 0; const e = g.makeEnemy('frasco', g.player.x + 0.8, g.player.z, false); e.m.root.visible = true; e.awake = true; g.room.enemies.push(e); window.__fr = e; });
await W(() => !window.__fr.alive, 60000);
console.log('frasco estourou', await G(() => ({ hp: window.__lunerb.game.player.hp })));
await G(() => { const g = window.__lunerb.game; g.ui.invincible = true; g.player.hp = 5; });
// robô desliga
await G(() => { const g = window.__lunerb.game; const e = g.makeEnemy('robo', g.player.x + 2, g.player.z, false); e.m.root.visible = true; g.room.enemies.push(e); g.damage(e, 9, 0, 0); g.damage(e, 9, 0, 0); window.__rb = e; });
console.log('robô desligou', await G(() => !window.__rb.alive));
await shot('81-torre');
// Golem
await G(() => window.__lunerb.game.startTransition(4));
await W(() => window.__lunerb.game.room.i === 4 && !window.__lunerb.game.trans);
await G(() => { const g = window.__lunerb.game; g.player.x = g.room.boss.x - 4; g.player.z = g.room.boss.z; });
await W(() => window.__lunerb.game.room.boss.state === 'intro');
await wait(1200); await shot('82-golem-intro');
await W(() => !['intro', 'dormindo'].includes(window.__lunerb.game.room.boss.state));
const est = new Set();
for (let i = 0; i < 40 && est.size < 4; i++) { est.add(await G(() => window.__lunerb.game.room.boss.state)); await wait(400); if (est.has('giro') && !est.shot) { est.shot = 1; await shot('83-golem-giro'); } }
console.log('golem estados', [...est]);
await G(() => { const g = window.__lunerb.game; const b = g.room.boss; g.damage(b, 99, 0, 0); });
await wait(500);
console.log('placas caíram', await G(() => { const b = window.__lunerb.game.room.boss; return { armor: b.armor, robos: window.__lunerb.game.room.enemies.filter((e) => e.alive && e.type === 'robo').length }; }));
await G(() => { const g = window.__lunerb.game; const b = g.room.boss; b.hp = 1; g.damage(b, 5, 0, 0); });
await W(() => window.__lunerb.ui.dialogOpen, 120000); await dlg(6);
console.log('golem derrotado', await G(() => !window.__lunerb.game.room.boss.alive));
// ---------- Fase 8 ----------
await G(() => window.__lunerb.startLevel(8));
await W(() => window.__lunerb.game.def.id === 8 && window.__lunerb.game.running && window.__lunerb.ui.dialogOpen); await dlg();
await wait(1000); await shot('84-fase8');
await G(() => { const g = window.__lunerb.game; g.ui.invincible = true; g.testMode = true; g.startTransition(4); });
await W(() => window.__lunerb.game.room.i === 4 && !window.__lunerb.game.trans);
await G(() => { const g = window.__lunerb.game; g.player.x = g.room.boss.hx - 4; g.player.z = g.room.boss.hz; });
await W(() => window.__lunerb.ui.dialogOpen, 120000); await dlg(6);
await W(() => !['intro', 'dormindo'].includes(window.__lunerb.game.room.boss.state));
await wait(3000); await shot('85-morgrave-pocoes');
console.log('etapa 1', await G(() => { const g = window.__lunerb.game, b = g.room.boss; return { etapa: b.stage, pocoes: g.lobs.length, x: b.x.toFixed(1) }; }));
await G(() => { const g = window.__lunerb.game; g.damage(g.room.boss, 31, 0, 0); });
await wait(1500); await shot('86-morgrave-clones');
console.log('etapa 2', await G(() => { const g = window.__lunerb.game, b = g.room.boss; return { etapa: b.stage, clones: g.room.enemies.filter((e) => e.alive && e.type === 'clone').length }; }));
await G(() => { const g = window.__lunerb.game; const c = g.room.enemies.find((e) => e.alive && e.type === 'clone'); g.damage(c, 3, 0, 0); });
await G(() => { const g = window.__lunerb.game; g.damage(g.room.boss, 30, 0, 0); });
await wait(4000); await shot('87-morgrave-gigante');
console.log('etapa 3', await G(() => { const g = window.__lunerb.game, b = g.room.boss; return { etapa: b.stage, nome: b.name, escala: b.scale.toFixed(2), clones: g.room.enemies.filter((e) => e.alive && e.type === 'clone').length }; }));
// golpe final
await G(() => { const g = window.__lunerb.game; g.damage(g.room.boss, 99, 0, 0); });
await W(() => window.__lunerb.game.cine && window.__lunerb.game.cine.kind === 'golpe');
await wait(2500);
await page.keyboard.down('l'); await wait(200); await page.keyboard.up('l');
await W(() => window.__lunerb.game.cine && window.__lunerb.game.cine.phase === 'raios', 60000);
await wait(1200); await shot('88-golpe-final');
await W(() => window.__lunerb.ui.dialogOpen, 120000);
await wait(300); await shot('89-morgrave-bonzinho');
console.log('purificado', await G(() => ({ puro: window.__lunerb.game.purified, bom: !!window.__lunerb.game.goodMorgrave })));
await dlg(10);
await wait(500);
console.log('saída aberta', await G(() => !window.__lunerb.game.room.vis.exit.locked));
// vai até a saída: final da história
await G(() => { const g = window.__lunerb.game; const ex = g.room.vis.exit; g.player.x = g.room.off.x + ex.lx; g.player.z = g.room.off.z + ex.lz; });
await W(() => !document.getElementById('scr-result').classList.contains('hidden'), 60000);
await shot('90-resultado');
await G(() => document.getElementById('btn-res-ok').click());
await W(() => !document.getElementById('scr-story').classList.contains('hidden'), 30000);
await wait(4500); await shot('91-final-casa');
for (let i = 0; i < 6; i++) { await G(() => document.getElementById('scr-story').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await wait(300); }
await W(() => !document.getElementById('scr-credits').classList.contains('hidden'), 30000);
await wait(1500); await shot('92-creditos-fim');
console.log('créditos', await G(() => ({ texto: document.querySelector('#scr-credits .soon').textContent, botao: document.getElementById('btn-credits-ok').textContent, salvo: window.__lunerb.save.endings })));
console.log('ERROS:', errors.length ? errors : 'nenhum');
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);
