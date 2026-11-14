// Teste no navegador das armas novas, loja, voltar de sala e morte.
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
await new Promise((r) => server.listen(8775, r));
const out = join(root, '.smoke'); await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: join(out, n + '.png') });
const dlg = async (n = 6) => { for (let i = 0; i < n; i++) { if (!(await page.evaluate(() => window.__lunerb.ui.dialogOpen))) break; await page.evaluate(() => document.getElementById('dialog').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await wait(150); } };
const G = (fn, arg) => page.evaluate(fn, arg);

await page.goto('http://localhost:8775/?baixa', { waitUntil: 'load' });
await wait(800);
await G(() => { localStorage.setItem('lunerb_save_v1', JSON.stringify({ unlocked: 2, weapons: 1, crystals: 200 })); });
await page.reload({ waitUntil: 'load' }); await wait(800);
await G(() => window.__lunerb.startLevel(1));
await page.waitForFunction(() => window.__lunerb.game.running && window.__lunerb.ui.dialogOpen, { timeout: 60000 });
await dlg();
// bombas: segura e solta
await G(() => { const g = window.__lunerb.game; g.ui.invincible = true; g.testMode = true; g.inv.slots[1] = { id: 'bombas', ammo: 3 }; g.inv.sel = 1; g.refreshSlots();
  g.player.x = g.room.off.x + 6.5; g.player.z = g.room.off.z + 6.5; g.player.face = Math.PI / 2;
  const e = g.room.enemies.find((e) => e.alive); e.x = g.room.off.x + 10.5; e.z = g.room.off.z + 6.5; e.awake = false; });
await page.keyboard.down('j'); await page.waitForFunction(() => !!window.__lunerb.game.aim, { timeout: 60000 });
// o direcional mexe a mira (Lunerb fica parado)
const before = await G(() => ({ x: window.__lunerb.game.player.x }));
await page.keyboard.down('d'); await page.waitForFunction(() => { const g = window.__lunerb.game; return g.aim && Math.hypot(g.aim.tx - g.player.x, g.aim.tz - g.player.z) > 3.6; }, { timeout: 60000 }); await page.keyboard.up('d');
console.log('mira no direcional', await G((b) => { const g = window.__lunerb.game; return { lunerbParado: Math.abs(g.player.x - b.x) < 0.05, distMira: Math.hypot(g.aim.tx - g.player.x, g.aim.tz - g.player.z).toFixed(1) }; }, before));
await shot('20-mira-bomba');
await page.keyboard.up('j');
await page.waitForFunction(() => window.__lunerb.game.scorches.length > 0, { timeout: 60000 });
await shot('21-explosao');
console.log('bomba', await G(() => { const g = window.__lunerb.game; return { ammo: g.inv.slots[1] && g.inv.slots[1].ammo, mortos: g.room.enemies.filter((e) => !e.alive).length, hp: g.player.hp }; }));
// bomba quebra parede de dentro
console.log('parede quebrada', await G(() => { const g = window.__lunerb.game; const r = g.room; const before = r.tiles[2][4]; g.explode(false, r.off.x + 4.5, r.off.z + 2.5); return { antes: before, depois: r.tiles[2][4], borda: r.tiles[0][4] }; }));
await wait(600); await shot('20b-parede');
// arma de choque
await G(() => { const g = window.__lunerb.game; g.inv.slots[2] = { id: 'choque' }; g.inv.sel = 2; g.refreshSlots(); g.weaponCd = 0;
  const e = g.room.enemies.find((e) => e.alive); if (e) { e.x = g.player.x + 2; e.z = g.player.z + 2; } });
await page.keyboard.down('j'); await wait(200); await page.keyboard.up('j');
await page.waitForFunction(() => window.__lunerb.game.bolts.length > 0, { timeout: 30000 }).catch(() => {});
await shot('22-choque');
// turbina
await G(() => { const g = window.__lunerb.game; g.inv.slots[2] = { id: 'turbina' }; g.inv.sel = 2; g.refreshSlots(); g.weaponCd = 0; g.player.face = Math.PI / 2 + 0.3; });
await page.keyboard.down('j'); await wait(150); await page.keyboard.up('j');
await page.waitForFunction(() => window.__lunerb.game.beam && window.__lunerb.game.beam.t > 0.2, { timeout: 30000 });
await shot('23-turbina');
console.log('turbina', await G(() => { const g = window.__lunerb.game; return { ligada: !!g.beam, face: g.player.face.toFixed(2) }; }));
await page.keyboard.down('j'); await wait(150); await page.keyboard.up('j');
await page.waitForFunction(() => !window.__lunerb.game.beam, { timeout: 30000 });
// loja
await G(() => window.__lunerb.game.openShop());
await wait(500); await shot('24-loja');
await G(() => document.querySelector('#shop-items .shop-item:nth-child(2) button').click());
await wait(400); await shot('25-mochila-cheia');
console.log('escolha aberta', await G(() => !document.getElementById('choice').classList.contains('hidden')));
await G(() => document.querySelector('#choice-opts button').click());
await G(() => document.getElementById('btn-shop-close').click());
console.log('depois da compra', await G(() => { const g = window.__lunerb.game; return { slots: g.inv.slots.map((s) => s && s.id), diamantes: g.save.crystals }; }));
// voltar de sala
await G(() => { const g = window.__lunerb.game; const pt = g.room.vis.portal; g.player.x = g.room.off.x + pt.lx - 1.6; g.player.z = g.room.off.z + pt.lz; });
await wait(300);
await G(() => { const g = window.__lunerb.game; const pt = g.room.vis.portal; g.player.x = g.room.off.x + pt.lx - 0.3; });
await page.waitForFunction(() => window.__lunerb.game.room.i === 1 && !window.__lunerb.game.trans, { timeout: 90000 });
await G(() => { const g = window.__lunerb.game; const b = g.room.vis.back; g.player.x = g.room.off.x + b.lx + 1.6; g.player.z = g.room.off.z + b.lz; });
await wait(300);
await G(() => { const g = window.__lunerb.game; const b = g.room.vis.back; g.player.x = g.room.off.x + b.lx + 0.2; });
await page.waitForFunction(() => window.__lunerb.game.room.i === 0 && !window.__lunerb.game.trans, { timeout: 90000 });
await shot('26-voltou');
console.log('voltou para a sala', await G(() => window.__lunerb.game.room.i));
// morte: recomeça a fase
await G(() => { const g = window.__lunerb.game; g.ui.invincible = false; g.player.hp = 1; g.player.inv = 0; g.hurtPlayer(1, 1, 0); });
await page.waitForFunction(() => { const g = window.__lunerb.game; return g.running && g.player.hp === 5 && g.room.i === 0 && g.time < 3; }, { timeout: 90000 });
console.log('morreu e recomeçou', await G(() => { const g = window.__lunerb.game; return { fase: g.def.id, sala: g.room.i, diamantes: g.save.crystals, armas: g.inv.slots.map((s) => s && s.id) }; }));
// Capitão de Ferro: bote
await G(() => { window.__lunerb.ui.invincible = true; window.__lunerb.startLevel(2); });
await page.waitForFunction(() => window.__lunerb.game.def.id === 2 && window.__lunerb.ui.dialogOpen, { timeout: 60000 }); await dlg();
await wait(500);
console.log('antes da arena', await G(() => { const g = window.__lunerb.game; return { lvl: g.def.id, room: g.room.i, frozen: g.frozen, dlg: window.__lunerb.ui.dialogOpen, paused: g.paused, run: g.running }; }));
await G(() => { const g = window.__lunerb.game; g.testMode = true; g.startTransition(4); });
await page.waitForFunction(() => { const g = window.__lunerb.game; return g.room.i === 4 && !g.trans; }, { timeout: 90000 });
console.log('entrou na arena', await G(() => ({ turbo: window.__lunerb.game.player.turbo })));
await G(() => { const g = window.__lunerb.game; g.player.x = g.room.boss.x - 4; g.player.z = g.room.boss.z; });
await page.waitForFunction(() => { const g = window.__lunerb.game; return g.room.boss.state === 'perseguir'; }, { timeout: 90000 });
console.log('bomba na arena', await G(() => !!(window.__lunerb.game.arenaItem && window.__lunerb.game.arenaItem.g)));
await page.waitForFunction(() => ['agachar', 'bote'].includes(window.__lunerb.game.room.boss.state), { timeout: 120000 });
await shot('27-capitao-bote');
console.log('capitão deu bote: sim');
console.log('ERROS:', errors.length ? errors : 'nenhum');
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);
