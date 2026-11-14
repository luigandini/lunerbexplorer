// Teste no navegador de verdade (Chrome sem tela): abre o jogo, joga um pouco e tira fotos.
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = new URL('../', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  try {
    const data = await readFile(join(root, p === '/' ? 'index.html' : p));
    res.writeHead(200, { 'content-type': types[extname(p)] || 'text/html' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8765, r));
const out = join(root, '.smoke');
await mkdir(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true, isLandscape: true });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: join(out, n + '.png') });

await page.goto('http://localhost:8765/' + (process.env.HQ ? '' : '?baixa'), { waitUntil: 'load' });
await wait(800); await shot('01-titulo');
await page.evaluate(() => { const m = window.__lunerb.menu; m.pose = 'closeup'; });
await wait(400); await shot('00-closeup');
await page.evaluate(() => { window.__lunerb.menu.pose = 'title'; });
await page.click('#btn-play'); await wait(2700); await shot('02-prologo-inicio');
const dlg = async (n = 4) => { for (let i = 0; i < n; i++) { await page.evaluate(() => document.getElementById('dialog').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await wait(150); } };
await dlg();
const perf = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r({ fps: n / 2, drawCalls: window.__lunerb.renderer.info.render.calls, tris: window.__lunerb.renderer.info.render.triangles }); } requestAnimationFrame(f); }));
console.log('desempenho no prólogo (Chrome sem placa de vídeo):', perf);
await page.keyboard.down('d'); await wait(1500); await page.keyboard.up('d');
await wait(1500); await dlg(); await wait(1200); await shot('03-perseguicao');
console.log('prólogo', await page.evaluate(() => { const g = window.__lunerb.game; return { room: g.room.i, enemies: g.room.enemies.filter((e) => e.alive).length, hp: g.player.hp }; }));
// atravessa as salas pelo portal (teste)
await dlg();
for (let k = 0; k < 3; k++) {
  await dlg(2);
  await page.evaluate(() => { const g = window.__lunerb.game; const pt = g.room.vis.portal; g.player.x = g.room.off.x + pt.lx - 0.3; g.player.z = g.room.off.z + pt.lz; });
  await page.waitForFunction((n) => { const g = window.__lunerb.game; return g.room.i === n && !g.trans; }, { timeout: 90000 }, k + 1);
  await wait(400);
  await shot('04-sala-' + (k + 2));
}
// vai até o lago
await page.evaluate(() => { const g = window.__lunerb.game; const t = g.room.pr.lake[0]; g.player.x = g.room.off.x + t.x - 0.25; g.player.z = g.room.off.z + t.y + 0.5; });
await wait(1500); await shot('05-lago');
console.log('lago', await page.evaluate(() => { const g = window.__lunerb.game; return { room: g.room.i, cine: g.cine && g.cine.kind, frozen: g.frozen, dlg: window.__lunerb.ui.dialogOpen }; }));
await page.waitForFunction(() => window.__lunerb.game.def.id === 1, { timeout: 120000 }); await wait(2600); await dlg(); await wait(300);
await shot('06-fase1-cela');
console.log('depois do lago', await page.evaluate(() => { const g = window.__lunerb.game; return { level: g.def.id, hero: g.def.hero, room: g.room.i, unlocked: window.__lunerb.save.unlocked }; }));
// pega a arma e atira
await page.evaluate(() => { const g = window.__lunerb.game; const c = g.room.vis.chests.find((c) => c.kind === 'arma'); g.player.x = g.room.off.x + c.lx + 0.7; g.player.z = g.room.off.z + c.lz; });
await wait(600); await dlg();
await page.evaluate(() => { const g = window.__lunerb.game; g.player.x = g.room.off.x + 7.5; g.player.z = g.room.off.z + 3.5; });
for (let i = 0; i < 8; i++) { await page.keyboard.down('j'); await wait(120); await page.keyboard.up('j'); await wait(300); }
await shot('07-atirando');
console.log('fase 1', await page.evaluate(() => { const g = window.__lunerb.game; return { weapons: g.player.weapons, dead: g.room.enemies.filter((e) => !e.alive).length, crystals: g.result.crystals }; }));
// fase 2 no modo teste: arena
await page.evaluate(() => { localStorage.setItem('lunerb_modo_teste', '1'); window.__lunerb.ui.invincible = true; window.__lunerb.game.testMode = true; window.__lunerb.startLevel(2); });
await wait(2700); await dlg();
await shot('08-fase2');
await page.evaluate(() => { const g = window.__lunerb.game; g.player.weapons = 2; g.updateGuns(); g.startTransition(4); });
await page.waitForFunction(() => { const g = window.__lunerb.game; return g.room.i === 4 && !g.trans; }, { timeout: 90000 }); await wait(300); await shot('09-arena');
await page.evaluate(() => { const g = window.__lunerb.game; g.player.x = g.room.boss.x - 5; g.player.z = g.room.boss.z; });
await wait(1500); await shot('10-chefao-intro');
await wait(2500); await page.keyboard.down('j'); await wait(1200); await page.keyboard.up('j'); await wait(80); await shot('11-laser');
console.log('chefão', await page.evaluate(() => { const b = window.__lunerb.game.room.boss; return { state: b.state, armor: b.armor }; }));
await page.evaluate(() => window.__lunerb.game.forceComplete());
await wait(2200); await shot('12-resultado');
const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); } requestAnimationFrame(f); }));
console.log('quadros/s no Chrome sem placa de vídeo:', fps);
console.log('ERROS:', errors.length ? errors : 'nenhum');
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
