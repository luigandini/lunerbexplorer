// Teste no navegador do Mundo 3: pântano, pontes, névoa, Sapo-Lodo Rei, Dait e Hidra.
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
await new Promise((r) => server.listen(8777, r));
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


await page.goto('http://localhost:8777/?baixa', { waitUntil: 'load' });
await G(() => localStorage.setItem('lunerb_save_v1', JSON.stringify({ unlocked: 6, weapons: 2, crystals: 80, friends: ['feligon'], endings: { 1: true, 2: true } })));
await page.reload({ waitUntil: 'load' }); await wait(800);
// ---------- Fase 5 ----------
await G(() => window.__lunerb.startLevel(5));
await W(() => window.__lunerb.game.running && window.__lunerb.ui.dialogOpen); await dlg();
await wait(1200); await shot('50-fase5');
console.log('fase 5', await G(() => { const g = window.__lunerb.game; return { tipos: [...new Set(g.rooms.flatMap((r) => r.enemies.map((e) => e.type)))], time: g.heroes.map((h) => h.id), pontes: g.room.vis.bridges.size }; }));
await G(() => { const g = window.__lunerb.game; g.ui.invincible = true; g.testMode = true; });
// ponte afunda depois de pisar
await G(() => { const g = window.__lunerb.game; const b = g.room.pr.bridges[0]; g.player.x = g.room.off.x + b.x + 0.5; g.player.z = g.room.off.z + b.y + 0.5; });
await W(() => { const g = window.__lunerb.game; const b = g.room.pr.bridges[0]; return g.tiles[b.y][b.x] === 'L'; }, 60000);
console.log('ponte afundou', true);
await shot('51-ponte');
await W(() => { const g = window.__lunerb.game; const b = g.room.pr.bridges[0]; return g.tiles[b.y][b.x] === 'b'; }, 90000);
console.log('ponte voltou', true);
// bolha se divide
await G(() => { const g = window.__lunerb.game; const e = g.makeEnemy('bolha', g.player.x + 2, g.player.z, false); e.m.root.visible = true; g.room.enemies.push(e); g.kill(e); });
console.log('bolha dividiu', await G(() => window.__lunerb.game.room.enemies.filter((e) => e.alive && e.type === 'bolhinha').length));
// névoa na sala 3
await G(() => window.__lunerb.game.startTransition(2));
await W(() => window.__lunerb.game.room.i === 2 && !window.__lunerb.game.trans);
await wait(800);
console.log('névoa', await G(() => !document.getElementById('fog').classList.contains('hidden')));
await shot('52-nevoa');
// arena do Sapo-Lodo Rei
await G(() => window.__lunerb.game.startTransition(4));
await W(() => window.__lunerb.game.room.i === 4 && !window.__lunerb.game.trans);
await G(() => { const g = window.__lunerb.game; g.player.x = g.room.boss.x - 4; g.player.z = g.room.boss.z; });
await W(() => window.__lunerb.game.room.boss.state === 'intro');
await wait(1200); await shot('53-sapo-intro');
await W(() => !['intro', 'dormindo'].includes(window.__lunerb.game.room.boss.state));
const estados = new Set();
for (let i = 0; i < 40 && estados.size < 4; i++) { estados.add(await G(() => window.__lunerb.game.room.boss.state)); await wait(400); if (estados.has('pulo')) await shot('54-sapo-pulo'); }
console.log('sapo estados', [...estados]);
await G(() => { const g = window.__lunerb.game; const b = g.room.boss; b.hp = 1; b.state = 'perseguir'; g.damage(b, 5, 0, 0); });
await W(() => window.__lunerb.ui.dialogOpen, 120000); await dlg(6);
console.log('sapo derrotado', await G(() => !window.__lunerb.game.room.boss.alive));
// ---------- Fase 6 ----------
await G(() => window.__lunerb.startLevel(6));
await W(() => window.__lunerb.game.def.id === 6 && window.__lunerb.game.running && window.__lunerb.ui.dialogOpen); await dlg();
await wait(1000); await shot('60-fase6');
await G(() => { const g = window.__lunerb.game; g.ui.invincible = true; g.testMode = true; g.startTransition(2); });
await W(() => window.__lunerb.game.room.i === 2 && !window.__lunerb.game.trans);
await wait(600); await shot('61-jaula');
console.log('portal trancado', await G(() => window.__lunerb.game.room.vis.portal.locked));
await G(() => { const g = window.__lunerb.game; for (const e of g.room.enemies) if (e.alive) g.kill(e); });
await W(() => window.__lunerb.ui.dialogOpen, 60000);
await wait(300); await shot('62-dait-livre');
await dlg(10);
console.log('dait', await G(() => { const g = window.__lunerb.game; return { time: g.heroes.map((h) => h.id), salvo: g.save.friends, mochila: g.inv.slots.length, portal: g.room.vis.portal.locked, ajudantes: g.helpers().length }; }));
// comando: todos os amigos prontos
await G(() => { const g = window.__lunerb.game; const e = g.makeEnemy('zumbi', g.player.x + 3, g.player.z, false); e.m.root.visible = true; e.speed = 0; g.room.enemies.push(e); window.__alvo = e; });
await page.keyboard.down('l'); await W(() => !!window.__lunerb.game.friendAim, 60000);
await page.keyboard.up('l');
await W(() => window.__lunerb.game.helpers().every((h) => h.cd > 0 && !h.cmd), 60000);
console.log('pulso ciano', await G(() => ({ congelado: window.__alvo.iceT > 0 || !window.__alvo.alive, cds: window.__lunerb.game.helpers().map((h) => h.id + ':' + Math.ceil(h.cd)) })));
await shot('63-pulso');
// troca pelo rostinho para o Dait e gás
await G(() => { const g = window.__lunerb.game; const d = g.heroes.find((h) => h.id === 'dait'); g.switchHero(false, d); });
console.log('jogando com', await G(() => window.__lunerb.game.player.id));
await G(() => window.__lunerb.game.startTransition(3));
await W(() => window.__lunerb.game.room.i === 3 && !window.__lunerb.game.trans);
const hp0 = await G(() => { const g = window.__lunerb.game; g.ui.invincible = false; const q = g.room.pr.gas[0]; g.player.x = g.room.off.x + q.x + 0.5; g.player.z = g.room.off.z + q.y + 0.5; return g.player.hp; });
await wait(2500);
console.log('dait no gás', await G((h) => ({ antes: h, depois: window.__lunerb.game.player.hp }), hp0));
await G(() => { const g = window.__lunerb.game; g.switchHero(false, g.heroes.find((h) => h.id === 'lunerb')); g.player.inv = 0; const q = g.room.pr.gas[0]; g.player.x = g.room.off.x + q.x + 0.5; g.player.z = g.room.off.z + q.y + 0.5; });
await wait(3000);
console.log('lunerb no gás perde vida', await G(() => window.__lunerb.game.player.hp < 5 || window.__lunerb.game.player.fainted));
await shot('64-gas');
// Hidra
await G(() => { const g = window.__lunerb.game; g.ui.invincible = true; for (const h of g.heroes) { h.fainted = false; h.hp = 5; } g.startTransition(4); });
await W(() => window.__lunerb.game.room.i === 4 && !window.__lunerb.game.trans);
await G(() => { const g = window.__lunerb.game; g.player.x = g.room.boss.hx - 4.5; g.player.z = g.room.boss.hz; });
await W(() => window.__lunerb.game.room.boss.state === 'intro');
await wait(1500); await shot('65-hidra-intro');
await W(() => !['intro', 'dormindo'].includes(window.__lunerb.game.room.boss.state));
await wait(2500); await shot('66-hidra-luta');
// derruba uma cabeça e espera o tempo acabar: ela volta
await G(() => { const g = window.__lunerb.game; const b = g.room.boss; g.damage(b, 99, 0, 0); });
console.log('uma cabeça', await G(() => { const b = window.__lunerb.game.room.boss; return { ativa: b.active, caidas: b.heads.filter((h) => h.down).length, tempo: Math.round(b.chainT) }; }));
await G(() => { window.__lunerb.game.room.boss.chainT = 0.05; });
await wait(1500);
console.log('cabeças voltaram', await G(() => window.__lunerb.game.room.boss.heads.filter((h) => h.down).length === 0));
// as três em sequência
for (let i = 0; i < 3; i++) { await G(() => { const g = window.__lunerb.game; const b = g.room.boss; if (b.alive) g.damage(b, 99, 0, 0); }); await wait(300); }
await W(() => window.__lunerb.ui.dialogOpen, 120000);
await wait(300); await shot('67-hidra-derrotada');
console.log('hidra derrotada', await G(() => !window.__lunerb.game.room.boss.alive));
await dlg(6);
console.log('ERROS:', errors.length ? errors : 'nenhum');
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);
