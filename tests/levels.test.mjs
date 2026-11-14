import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, parseLevel, reachable, TOTAL_PHASES, WORLDS } from '../src/levels.js';

const VALID = new Set('#.,LWTQCEBGSHPzasmK'.split(''));

test('o jogo tem 8 fases planejadas em 4 mundos', () => {
  assert.equal(TOTAL_PHASES, 8);
  assert.equal(WORLDS.length, 4);
});

for (const L of LEVELS) {
  test(`fase ${L.id}: mapa retangular, fechado e só com símbolos conhecidos`, () => {
    const w = L.map[0].length;
    L.map.forEach((row, y) => {
      assert.equal(row.length, w, `linha ${y} tem ${row.length} em vez de ${w}`);
      for (const c of row) assert.ok(VALID.has(c), `símbolo desconhecido "${c}" na linha ${y}`);
    });
    for (let x = 0; x < w; x++) { assert.equal(L.map[0][x], '#'); assert.equal(L.map[L.map.length - 1][x], '#'); }
    for (const row of L.map) { assert.equal(row[0], '#'); assert.equal(row[w - 1], '#'); }
  });

  test(`fase ${L.id}: tem início, saída, fogueira e dá pra chegar no fim`, () => {
    const p = parseLevel(L);
    assert.ok(p.start, 'sem início P');
    assert.ok(p.exit, 'sem saída E');
    assert.equal(L.map.join('').split('P').length - 1, 1, 'precisa de exatamente 1 início');
    assert.equal(L.map.join('').split('E').length - 1, 1, 'precisa de exatamente 1 saída');
    assert.ok(p.checkpoints.length >= 1, 'precisa de pelo menos 1 fogueira azul');
    const r = reachable(p);
    assert.ok(r.has(p.exit.x, p.exit.y), 'a saída não é alcançável');
    for (const c of p.checkpoints) assert.ok(r.has(c.x, c.y), `fogueira em ${c.x},${c.y} não alcançável`);
  });

  test(`fase ${L.id}: baús normais e da arma alcançáveis; secreto só pela parede rachada`, () => {
    const p = parseLevel(L);
    const r = reachable(p);
    const r2 = reachable(p, { openCracks: true });
    const arma = p.chests.filter((c) => c.kind === 'arma');
    assert.equal(arma.length, 1, 'cada fase do mundo 1 tem 1 Booteshiscore');
    for (const c of p.chests.filter((c) => c.kind !== 'secreto')) assert.ok(r.has(c.x, c.y), `baú ${c.kind} em ${c.x},${c.y}`);
    const sec = p.chests.filter((c) => c.kind === 'secreto');
    assert.equal(sec.length, 1, 'precisa de 1 baú secreto (3ª estrela)');
    assert.ok(!r.has(sec[0].x, sec[0].y), 'o secreto não pode ser fácil');
    assert.ok(r2.has(sec[0].x, sec[0].y), 'o secreto precisa ser alcançável quebrando a parede');
  });

  test(`fase ${L.id}: monstros em lugares alcançáveis e longe do início`, () => {
    const p = parseLevel(L);
    const r = reachable(p, { openCracks: true });
    assert.ok(p.enemies.length >= 8, 'poucos monstros');
    for (const e of p.enemies) {
      assert.ok(r.has(e.x, e.y), `${e.type} preso em ${e.x},${e.y}`);
      assert.ok(Math.hypot(e.x - p.start.x, e.y - p.start.y) > 4, `${e.type} muito perto do início`);
    }
  });

  test(`fase ${L.id}: tem título, falas de abertura e recompensa de arma`, () => {
    assert.ok(L.title && L.intro.length > 0);
    assert.ok(L.weaponReward === L.id, 'fase 1 dá a 1ª arma, fase 2 dá a 2ª');
  });
}

test('fase 2 tem o Capitão de Ferro e ele é alcançável', () => {
  const p = parseLevel(LEVELS.find((l) => l.id === 2));
  assert.ok(p.boss);
  assert.ok(reachable(p).has(p.boss.x, p.boss.y));
});
