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

await page.goto('http://localhost:8765/', { waitUntil: 'load' });
await wait(800); await shot('01-titulo');
await page.click('#btn-play'); await wait(600); await shot('02-mapa');
await page.evaluate(() => window.__lunerb.beginLevel(1)); await wait(500); await shot('03-historia');
await page.click('#btn-skip'); await wait(2600);
for (let i = 0; i < 4; i++) { await page.evaluate(() => document.getElementById('dialog').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await wait(150); }
await wait(300); await shot('04-fase1');
// anda e ataca
await page.keyboard.down('d'); await wait(700); await page.keyboard.up('d');
await page.keyboard.down('s'); await wait(900); await page.keyboard.up('s');
await page.keyboard.down('j'); await wait(400); await page.keyboard.up('j');
await wait(300); await shot('05-andando');
const st1 = await page.evaluate(() => { const g = window.__lunerb.game; return { x: g.player.x, z: g.player.z, hp: g.player.hp, enemies: g.enemies.length, running: g.running }; });
console.log('fase1', st1);
const perf = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r({ fps: n / 2, drawCalls: window.__lunerb.renderer.info.render.calls, tris: window.__lunerb.renderer.info.render.triangles }); } requestAnimationFrame(f); }));
console.log('desempenho na fase 1 (Chrome sem placa de vídeo):', perf);
// vai até o baú da arma
await page.evaluate(() => { const g = window.__lunerb.game; const c = g.world.chests.find((c) => c.kind === 'arma'); g.player.x = c.wx + 0.7; g.player.z = c.wz; });
await wait(500);
for (let i = 0; i < 4; i++) { await page.evaluate(() => document.getElementById('dialog').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await wait(150); }
const w = await page.evaluate(() => window.__lunerb.game.player.weapons);
console.log('armas depois do baú', w);
// perto de um zumbi, atira
await page.evaluate(() => { const g = window.__lunerb.game; const e = g.enemies.find((e) => e.alive); g.player.x = e.x - 3; g.player.z = e.z; });
for (let i = 0; i < 6; i++) { await page.keyboard.down('j'); await wait(120); await page.keyboard.up('j'); await wait(330); }
await shot('06-atirando');
const st2 = await page.evaluate(() => ({ dead: window.__lunerb.game.enemies.filter((e) => !e.alive).length, crystals: window.__lunerb.game.result.crystals }));
console.log('fase1 combate', st2);
// fase 2: chefão
await page.evaluate(() => { localStorage.setItem('lunerb_modo_teste', '1'); });
await page.evaluate(() => { window.__lunerb.ui.invincible = true; window.__lunerb.startLevel(2); });
await wait(2700);
for (let i = 0; i < 4; i++) { await page.evaluate(() => document.getElementById('dialog').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await wait(150); }
await shot('07-fase2');
await page.evaluate(() => { const g = window.__lunerb.game; g.player.weapons = 2; g.updateGuns(); g.player.x = g.boss.x - 6; g.player.z = g.boss.z; });
await wait(1400); await shot('08-chefao-intro');
await wait(2200); await shot('09-chefao-luta');
// laser
await page.keyboard.down('j'); await wait(1100); await page.keyboard.up('j'); await wait(80); await shot('10-laser');
const b = await page.evaluate(() => { const g = window.__lunerb.game; return { state: g.boss.state, armor: g.boss.armor, hp: g.boss.hp, enemies: g.enemies.filter((e) => e.alive).length }; });
console.log('chefão', b);
await page.evaluate(() => window.__lunerb.game.forceComplete());
await wait(2000); await shot('11-resultado');
const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); } requestAnimationFrame(f); }));
console.log('quadros/s no Chrome sem placa de vídeo:', fps);
console.log('ERROS:', errors.length ? errors : 'nenhum');
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
