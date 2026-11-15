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
await new Promise((r) => server.listen(8778, r));
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

// Desmaio em todas as situações: sozinho (mundo 1), com 1 amigo, com 2 amigos, por lava/ponte, durante o chefão.
await page.goto('http://localhost:8778/?baixa', { waitUntil: 'load' });
await G(() => localStorage.setItem('lunerb_save_v1', JSON.stringify({ unlocked: 6, weapons: 2, crystals: 20, friends: [], endings: { 1: true } })));
await page.reload({ waitUntil: 'load' }); await wait(800);
const estado = () => G(() => { const g = window.__lunerb.game; return { fase: g.def.id, sala: g.room && g.room.i, run: g.running, frozen: g.frozen, dead: g.player.dead, hp: g.player.hp, quem: g.player.id, dlg: window.__lunerb.ui.dialogOpen, time: g.heroes.map((h) => h.id + (h.fainted ? '*' : '')) }; });
async function morre(label) {
  await G(() => { const g = window.__lunerb.game; g.ui.invincible = false; g.player.inv = 0; g.player.hp = 1; g.hurtPlayer(1, 1, 0); });
  await wait(4500);
  console.log(label, await estado());
}
// mapa: o botão da próxima fase fica dentro do cartão do mundo
await G(() => { window.__lunerb.save.unlocked = 1; window.__lunerb.showMap(); });
await wait(800); await shot('70-mapa');
console.log('mapa fase 1 no lugar', await G(() => { const b = document.querySelector('.phase.next'); const w = b.closest('.world').getBoundingClientRect(), r = b.getBoundingClientRect(); return b.textContent.includes('Fase 1') && r.top >= w.top && r.bottom <= w.bottom && r.left >= w.left && r.right <= w.right; }));
// 1) sozinho no mundo 1
await G(() => window.__lunerb.startLevel(1));
await W(() => window.__lunerb.game.running && window.__lunerb.ui.dialogOpen); await dlg();
// duas conversas ao mesmo tempo não podem travar o jogo
await G(() => { const g = window.__lunerb.game, ui = window.__lunerb.ui; g.frozen = true; ui.dialog([{ who: 'A', text: '1' }], () => { g.frozen = false; }); ui.dialog([{ who: 'B', text: '2' }], () => {}); });
await dlg(); await wait(300);
console.log('duas conversas destravam', await G(() => !window.__lunerb.game.frozen));
// vigia: congelado sem motivo destrava sozinho
await G(() => { window.__lunerb.game.frozen = true; });
await wait(6000);
console.log('vigia destravou', await G(() => !window.__lunerb.game.frozen));
await G(() => window.__lunerb.game.startTransition(2)); await W(() => window.__lunerb.game.room.i === 2 && !window.__lunerb.game.trans);
await morre('sozinho');
await W(() => window.__lunerb.game.running && window.__lunerb.game.room.i === 0, 60000);
await dlg();
await wait(1500);
console.log('recomeçou e anda?', await G(async () => { const g = window.__lunerb.game; const x = g.player.x; return { x0: x.toFixed(2), frozen: g.frozen, dead: g.player.dead, hp: g.player.hp }; }));
await page.keyboard.down('d'); await wait(900); await page.keyboard.up('d');
console.log('moveu', await G(() => window.__lunerb.game.player.x.toFixed(2)));
// 2) lava no mundo 1, com 1 de vida
await G(() => { const g = window.__lunerb.game; g.startTransition(2); }); await W(() => window.__lunerb.game.room.i === 2 && !window.__lunerb.game.trans);
await G(() => { const g = window.__lunerb.game; g.player.hp = 1; g.player.inv = 0; const r = g.room; for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (g.tiles[y][x] === 'L') { g.player.x = r.off.x + x + 0.5; g.player.z = r.off.z + y + 0.5; return; } });
await wait(4500);
console.log('lava', await estado());
await W(() => window.__lunerb.game.running && window.__lunerb.game.room.i === 0, 60000); await dlg();
// 3) com Feligon (fase 3 depois de resgatar)
await G(() => { const s = JSON.parse(localStorage.getItem('lunerb_save_v1')); s.friends = ['feligon']; localStorage.setItem('lunerb_save_v1', JSON.stringify(s)); window.__lunerb.save.friends = ['feligon']; });
await G(() => { const s = JSON.parse(localStorage.getItem('lunerb_save_v1')); window.__lunerb.startLevel(4); });
await W(() => window.__lunerb.game.def.id === 4 && window.__lunerb.game.running && window.__lunerb.ui.dialogOpen); await dlg();
console.log('time f4', await estado());
await morre('1º desmaio com amigo');
await morre('2º desmaio (todos)');
await W(() => window.__lunerb.game.running && window.__lunerb.game.room.i === 0 && window.__lunerb.game.heroes.every((h) => !h.fainted), 60000); await dlg();
console.log('recomeçou f4', await estado());
// 4) no chefão do mundo 1, sozinho
await G(() => { window.__lunerb.save.friends = []; window.__lunerb.startLevel(2); });
await W(() => window.__lunerb.game.def.id === 2 && window.__lunerb.game.running && window.__lunerb.ui.dialogOpen); await dlg();
await G(() => { const g = window.__lunerb.game; g.ui.invincible = true; g.startTransition(4); }); await W(() => window.__lunerb.game.room.i === 4 && !window.__lunerb.game.trans);
await G(() => { const g = window.__lunerb.game; g.player.x = g.room.boss.x - 4; g.player.z = g.room.boss.z; });
await W(() => !['intro', 'dormindo'].includes(window.__lunerb.game.room.boss.state));
await morre('desmaio no chefão');
await W(() => window.__lunerb.game.running && window.__lunerb.game.room.i === 0, 60000); await dlg();
console.log('depois do chefão', await estado());
console.log('ERROS:', errors.length ? errors : 'nenhum');
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);
