import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, parseLevel, reachable, TOTAL_PHASES, WORLDS, SOLID } from '../src/levels.js';

const VALID = new Set('#.,LWTQCEBGSHPNXzasmKYRUfg~OJV'.split(''));

test('o jogo tem 8 fases planejadas em 4 mundos, mais o prólogo', () => {
  assert.equal(TOTAL_PHASES, 8);
  assert.equal(WORLDS.length, 4);
  assert.equal(LEVELS[0].kind, 'prologo');
  assert.equal(LEVELS[0].hero, 'lucas');
});

for (const L of LEVELS) {
  const P = parseLevel(L);

  test(`${L.title}: salas retangulares e só com símbolos conhecidos`, () => {
    assert.ok(L.rooms.length >= 3, 'poucas salas');
    L.rooms.forEach((room, ri) => {
      const w = room.map[0].length;
      room.map.forEach((row, y) => {
        assert.equal(row.length, w, `sala ${ri + 1}, linha ${y}: ${row.length} em vez de ${w}`);
        for (const c of row) assert.ok(VALID.has(c), `símbolo "${c}" desconhecido na sala ${ri + 1}`);
      });
      assert.ok(w <= 15 && room.map.length <= 11, `sala ${ri + 1} grande demais para caber inteira na tela`);
    });
  });

  test(`${L.title}: início, entradas, portais e saída no lugar certo`, () => {
    P.rooms.forEach((r, i) => {
      assert.ok(r.entry, `sala ${i + 1} sem entrada`);
      assert.equal(r.isStart, i === 0, `sala ${i + 1}: só a primeira tem P`);
      const last = i === P.rooms.length - 1;
      if (!last) assert.ok(r.portal, `sala ${i + 1} sem portal X`);
      if (last && L.kind === 'fase') assert.ok(r.exit, 'última sala precisa da saída E');
      if (last && L.kind === 'prologo') assert.ok(r.lake.length > 5, 'o prólogo termina no lago de lodo');
    });
  });

  test(`${L.title}: dá para atravessar todas as salas`, () => {
    P.rooms.forEach((r, i) => {
      const reach = reachable(r);
      const goal = r.portal || r.exit;
      if (goal) assert.ok(reach.has(goal.x, goal.y), `sala ${i + 1}: não chega no ${r.portal ? 'portal' : 'saída'}`);
      if (r.lake.length) {
        const near = r.lake.some((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach.has(t.x + dx, t.y + dy)));
        assert.ok(near, 'precisa conseguir chegar na beira do lago');
      }
      for (const c of r.checkpoints) assert.ok(reach.has(c.x, c.y), `fogueira inalcançável na sala ${i + 1}`);
      for (const c of r.chests.filter((c) => c.kind !== 'secreto')) assert.ok(reach.has(c.x, c.y), `baú ${c.kind} inalcançável na sala ${i + 1}`);
      for (const s of r.spawners) assert.ok(reach.has(s.x, s.y), `saída de monstros presa na sala ${i + 1}`);
    });
  });

  test(`${L.title}: monstros alcançáveis e longe da entrada`, () => {
    let total = 0;
    P.rooms.forEach((r, i) => {
      const reach = reachable(r, { openCracks: true });
      for (const e of r.enemies) {
        total++;
        assert.ok(reach.has(e.x, e.y), `${e.type} preso na sala ${i + 1}`);
        assert.ok(Math.hypot(e.x - r.entry.x, e.y - r.entry.y) > 3.5, `${e.type} muito perto da entrada da sala ${i + 1}`);
      }
      for (const s of r.spawners) assert.ok(Math.hypot(s.x - r.entry.x, s.y - r.entry.y) > 2.5, `monstros nascem em cima do Lucas na sala ${i + 1}`);
    });
    if (L.kind === 'fase') assert.ok(total >= 10, `poucos monstros: ${total}`);
    else assert.ok(P.rooms.every((r) => r.spawners.length > 0), 'no prólogo os monstros perseguem em todas as salas');
  });

  if (L.kind === 'fase') {
    test(`${L.title}: 1 Booteshiscore, fogueira e 1 baú secreto escondido`, () => {
      const chests = P.rooms.flatMap((r) => r.chests.map((c) => ({ ...c, r })));
      assert.equal(chests.filter((c) => c.kind === 'arma').length, 1);
      assert.ok(P.rooms.some((r) => r.checkpoints.length), 'precisa de fogueira azul');
      const sec = chests.filter((c) => c.kind === 'secreto');
      assert.equal(sec.length, 1);
      assert.ok(!reachable(sec[0].r).has(sec[0].x, sec[0].y), 'o secreto não pode ser fácil');
      assert.ok(reachable(sec[0].r, { openCracks: true }).has(sec[0].x, sec[0].y), 'o secreto abre quebrando a parede');
      assert.equal(L.weaponReward, L.id);
      assert.ok(L.intro.length);
      const loot = chests.filter((c) => c.kind === 'arma-nova');
      assert.ok(loot.length >= 1, 'cada fase tem pelo menos 1 arma nova para achar');
      for (const c of loot) assert.ok(c.loot, 'o baú de arma nova precisa dizer qual arma');
      const spots = P.rooms.filter((r) => r.merchant);
      assert.ok(spots.length >= 1, 'precisa de lugar para o mercador');
      for (const r of spots) assert.ok(reachable(r).has(r.merchant.x, r.merchant.y), 'mercador inalcançável');
      assert.ok(L.difficulty >= 1);
    });
  }
}

test('a Fase 2 termina na arena do Capitão de Ferro', () => {
  const P = parseLevel(LEVELS.find((l) => l.id === 2));
  const last = P.rooms[P.rooms.length - 1];
  assert.ok(last.boss);
  assert.ok(reachable(last).has(last.boss.x, last.boss.y));
});

test('a dificuldade aumenta de fase em fase', () => {
  const f = LEVELS.filter((l) => l.kind === 'fase');
  for (let i = 1; i < f.length; i++) assert.ok(f[i].difficulty > f[i - 1].difficulty);
});

test('a lava e o lago contam como obstáculo', () => {
  assert.ok(SOLID.has('~'));
});
