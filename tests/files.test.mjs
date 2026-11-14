import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

test('todos os arquivos do modo offline existem', () => {
  const sw = read('sw.js');
  const files = [...sw.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f.includes('.') && f !== './');
  assert.ok(files.length > 10);
  for (const f of files.filter((f) => !f.startsWith('lunerb'))) assert.ok(existsSync(new URL(f, root)), `falta ${f}`);
});

test('créditos dos meninos na tela inicial e no final', () => {
  const html = read('index.html');
  const n = html.split('Felipe Gandini').length - 1;
  assert.ok(n >= 2, 'créditos precisam aparecer no início e no fim');
  assert.ok(html.includes('Lucas Gandini'));
});

test('no máximo 4 botões de jogo na tela', () => {
  const html = read('index.html');
  const controls = html.split('id="controls"')[1].split('</div>\n\n')[0];
  const n = (controls.match(/<button/g) || []).length;
  assert.ok(n <= 3, `botões: ${n} (+ joystick = ${n + 1})`);
});

test('manifest para instalar no celular', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.orientation, 'landscape');
  assert.ok(m.icons.some((i) => i.sizes === '512x512'));
});

test('sem anúncios, sem rastreamento, sem login', () => {
  const all = ['index.html', 'src/main.js', 'src/game.js', 'src/ui.js', 'sw.js'].map(read).join('\n');
  for (const bad of ['googletagmanager', 'analytics', 'adsbygoogle', 'firebase', 'login(', 'fetch(\'http']) {
    assert.ok(!all.includes(bad), `encontrado: ${bad}`);
  }
});
