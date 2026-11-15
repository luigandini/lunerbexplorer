// Robô de estresse: joga todas as fases apertando botões ao acaso, apanha, desmaia, troca de herói. Acusa erro ou jogo travado.
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
await new Promise((r) => server.listen(8779, r));
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

await page.goto('http://localhost:8779/?baixa', { waitUntil: 'load' });
await G(() => localStorage.setItem('lunerb_save_v1', JSON.stringify({ unlocked: 8, weapons: 2, crystals: 300, friends: [], endings: { 1: true, 2: true } })));
await page.reload({ waitUntil: 'load' }); await wait(800);
const problems = [];
const keys = ['w', 'a', 's', 'd', 'j', 'k', 'l'];
const secs = Number(process.argv[2] || 40);
for (const lvl of [1, 2, 3, 4, 5, 6, 7, 8]) {
  // fases 3+ com amigos que já teriam sido resgatados
  await G((l) => { const s = window.__lunerb.save; s.friends = l >= 7 ? ['feligon', 'dait'] : l >= 5 ? ['feligon'] : []; }, lvl);
  await G((l) => window.__lunerb.startLevel(l), lvl);
  await W((l) => window.__lunerb.game.def && window.__lunerb.game.def.id === l && window.__lunerb.game.running, 60000, lvl);
  let stuck = 0, t0 = Date.now(), deaths = 0, lastRoom = -1, roomT = Date.now();
  while (Date.now() - t0 < secs * 1000) {
    await dlg(3);
    const k = keys[Math.floor(Math.random() * keys.length)];
    await page.keyboard.down(k); await wait(150 + Math.random() * 500); await page.keyboard.up(k);
    // às vezes: troca de herói, abre/fecha loja, compra itens, seleciona item da mochila
    await G(() => {
      const g = window.__lunerb.game;
      if (!g.running) return;
      if (Math.random() < 0.08) g.switchHero();
      if (Math.random() < 0.06 && g.inv) { const i = Math.floor(Math.random() * (g.inv.slots.length + 1)) - 1; g.selectSlot(i); }
      if (Math.random() < 0.05) { { const c = { lx: g.player.x - g.room.off.x, lz: g.player.z - g.room.off.z }; for (const id of ['bombas', 'choque', 'turbina', 'superbomba']) g.giveItem(id, c); } }
      if (Math.random() < 0.15) g.player.inv = 0; // apanha mais
    }).catch((e) => problems.push(`L${lvl} eval: ${e.message}`));
    const st = await G(() => { const g = window.__lunerb.game; return { run: g.running, frozen: g.frozen, cine: !!g.cine, trans: !!g.trans, dlg: window.__lunerb.ui.dialogOpen, shop: !document.getElementById('scr-shop').classList.contains('hidden'), choice: !document.getElementById('choice').classList.contains('hidden'), room: g.room ? g.room.i : -1, dead: g.player.dead, id: g.def.id, hp: g.player.hp, faint: g.heroes.filter((h) => h.fainted).length, pause: g.paused }; });
    if (st.shop) await G(() => document.getElementById('btn-shop-close') && document.getElementById('btn-shop-close').click());
    if (st.choice) await G(() => { const b = document.querySelector('#choice button'); if (b) b.click(); });
    if (st.run && st.frozen && !st.dlg && !st.cine && !st.trans && !st.shop && !st.choice) stuck++; else stuck = 0;
    if (stuck > 12) { problems.push(`L${lvl}: TRAVADO ${JSON.stringify(st)}`); await shot(`robo-travado-${lvl}`); break; }
    if (!st.run) { const back = await G(() => window.__lunerb.game.running); if (!back) { await wait(3000); const r2 = await G(() => ({ run: window.__lunerb.game.running, screen: [...document.querySelectorAll('.screen')].filter((s) => !s.classList.contains('hidden')).map((s) => s.id) })); if (!r2.run) { problems.push(`L${lvl}: parou de rodar ${JSON.stringify(r2)}`); break; } } }
    if (st.room !== lastRoom) { lastRoom = st.room; roomT = Date.now(); }
    // anda pelas salas sozinho de vez em quando (como se tivesse chegado no portal)
    if (Date.now() - roomT > 7000 && !st.trans && !st.cine && st.run) {
      await G(() => { const g = window.__lunerb.game; if (g.room.i < g.rooms.length - 1 && !g.frozen && !(g.room.vis.portal && g.room.vis.portal.locked)) g.startTransition(g.room.i + 1); else if (g.room.vis.cage && !g.room.vis.cage.open) for (const e of g.room.enemies) if (e.alive) g.kill(e); });
      roomT = Date.now();
    }
    if (st.dead || st.faint) deaths++;
  }
  console.log(`fase ${lvl}: ok (${secs}s)`);
}
console.log('PROBLEMAS:', problems.length ? problems : 'nenhum');
console.log('ERROS:', errors.length ? errors : 'nenhum');
await browser.close(); server.close();
process.exit(errors.length || problems.length ? 1 : 0);
