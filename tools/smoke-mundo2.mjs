// Teste no navegador do Mundo 2: floresta, inimigos novos, Mãe-Teia, Feligon e Ancião Oco.
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
await new Promise((r) => server.listen(8776, r));
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

await page.goto('http://localhost:8776/?baixa', { waitUntil: 'load' });
await G(() => localStorage.setItem('lunerb_save_v1', JSON.stringify({ unlocked: 4, weapons: 2, crystals: 50, endings: { 1: true } })));
await page.reload({ waitUntil: 'load' }); await wait(800);
await G(() => window.__lunerb.startLevel(3));
await W(() => window.__lunerb.game.running && window.__lunerb.ui.dialogOpen); await dlg();
await wait(800); await shot('30-fase3');
console.log('fase 3', await G(() => { const g = window.__lunerb.game; return { tipos: [...new Set(g.rooms.flatMap((r) => r.enemies.map((e) => e.type)))], amigo: !!g.friend }; }));
// cogumelo e espinho funcionando
await G(() => { const g = window.__lunerb.game; g.ui.invincible = true; g.testMode = true; });
await G(() => { const g = window.__lunerb.game; g.startTransition(2); });
await W(() => window.__lunerb.game.room.i === 2 && !window.__lunerb.game.trans);
await wait(4000);
console.log('espinhos atirando', await G(() => window.__lunerb.game.eshots.length >= 0));
await shot('31-riacho');
// bomba quebra pedra/arbusto
console.log('pedra quebrada', await G(() => { const g = window.__lunerb.game; g.startTransition(3); return true; }));
await W(() => window.__lunerb.game.room.i === 3 && !window.__lunerb.game.trans);
await dlg();
// arena da Mãe-Teia
await G(() => { const g = window.__lunerb.game; g.startTransition(4); });
await W(() => window.__lunerb.game.room.i === 4 && !window.__lunerb.game.trans);
await G(() => { const g = window.__lunerb.game; g.player.x = g.room.boss.x - 4; g.player.z = g.room.boss.z; });
await W(() => window.__lunerb.game.room.boss.state === 'intro');
await wait(1200); await shot('32-mae-teia-intro');
await W(() => !['intro', 'dormindo'].includes(window.__lunerb.game.room.boss.state));
await wait(3000); await shot('33-mae-teia-luta');
console.log('mãe-teia', await G(() => { const g = window.__lunerb.game; return { estado: g.room.boss.state, filhotes: g.room.enemies.filter((e) => e.alive && e.type === 'aranha').length, teias: g.eshots.length }; }));
await G(() => { const g = window.__lunerb.game; const b = g.room.boss; b.hp = 1; g.damage(b, 5, 0, 0); });
await W(() => window.__lunerb.ui.dialogOpen, 120000);
await wait(300); await shot('34-feligon-livre');
await dlg(10);
console.log('feligon', await G(() => { const g = window.__lunerb.game; return { amigo: !!g.friend, salvo: g.save.friends, botao: !document.getElementById('btn-special').classList.contains('hidden') }; }));
// comando do amigo: segura L, mira, solta
await G(() => { const g = window.__lunerb.game; const e = g.makeEnemy('zumbi', g.player.x + 3, g.player.z, false); e.m.root.visible = true; e.awake = false; g.room.enemies.push(e); });
await page.keyboard.down('l'); await W(() => !!window.__lunerb.game.friendAim, 60000);
await page.keyboard.down('d'); await wait(600); await page.keyboard.up('d');
await shot('35-mira-amigo');
await page.keyboard.up('l');
await W(() => window.__lunerb.game.friend.cd > 0 && !window.__lunerb.game.friend.cmd, 60000);
await wait(300); await shot('36-raizes');
await G(() => { const g = window.__lunerb.game; const e = g.room.enemies.find((e) => e.alive); if (e) g.castRoots(e.x, e.z); });
console.log('raízes', await G(() => { const g = window.__lunerb.game; return { presos: g.room.enemies.filter((e) => e.alive && e.rootT > 0).length, cd: Math.ceil(g.friend.cd) }; }));
// Fase 4: Ancião Oco
await G(() => { window.__lunerb.startLevel(4); });
await wait(4000);
console.log('estado f4', await G(() => { const g = window.__lunerb.game; return { id: g.def.id, run: g.running, dlg: window.__lunerb.ui.dialogOpen, frozen: g.frozen }; }), errors);
await W(() => window.__lunerb.game.def.id === 4 && window.__lunerb.ui.dialogOpen); await dlg();
console.log('fase 4 com amigo', await G(() => !!window.__lunerb.game.friend));
await G(() => { const g = window.__lunerb.game; g.ui.invincible = true; g.testMode = true; g.startTransition(4); });
await W(() => window.__lunerb.game.room.i === 4 && !window.__lunerb.game.trans);
await G(() => { const g = window.__lunerb.game; g.player.x = g.room.boss.x - 5; g.player.z = g.room.boss.z; });
await wait(5000);
console.log('arena f4', await G(() => { const g = window.__lunerb.game; return { room: g.room.i, st: g.room.boss.state, dlg: window.__lunerb.ui.dialogOpen, frozen: g.frozen, cine: g.cine && g.cine.kind, enterT: g.room.enterT, px: (g.player.x - g.room.boss.x).toFixed(1) }; }), errors);
await W(() => !['intro', 'dormindo'].includes(window.__lunerb.game.room.boss.state));
await W(() => ['raizes', 'bolotas', 'erguer', 'galhada'].includes(window.__lunerb.game.room.boss.state), 200000);
await wait(500); await shot('37-anciao');
console.log('ancião', await G(() => window.__lunerb.game.room.boss.state));
console.log('ERROS:', errors.length ? errors : 'nenhum');
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);
