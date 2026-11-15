import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, parseLevel, reachable, TOTAL_PHASES, WORLDS, SOLID } from '../src/levels.js';

const VALID = new Set('#.,LWTQCEBGSHPNXzasmKYRUfg~OJVceFDbqpoZyri'.split(''));

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
      const reachV = reachable(r, { openVines: true });
      const goal = r.portal || r.exit;
      if (goal) assert.ok(reach.has(goal.x, goal.y), `sala ${i + 1}: não chega no ${r.portal ? 'portal' : 'saída'}`);
      if (r.lake.length) {
        const near = r.lake.some((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach.has(t.x + dx, t.y + dy)));
        assert.ok(near, 'precisa conseguir chegar na beira do lago');
      }
      for (const c of r.checkpoints) assert.ok(reach.has(c.x, c.y), `fogueira inalcançável na sala ${i + 1}`);
      for (const c of r.chests.filter((c) => c.kind !== 'secreto')) assert.ok(reachV.has(c.x, c.y), `baú ${c.kind} inalcançável na sala ${i + 1}`);
      for (const v of r.vines) assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach.has(v.x + dx, v.y + dy)), `portão de raízes sem acesso na sala ${i + 1}`);
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
      assert.equal(chests.filter((c) => c.kind === 'arma').length, L.id <= 2 ? 1 : 0, 'Booteshiscore só nas fases 1 e 2');
      assert.ok(P.rooms.some((r) => r.checkpoints.length), 'precisa de fogueira azul');
      const sec = chests.filter((c) => c.kind === 'secreto');
      assert.equal(sec.length, 1);
      assert.ok(!reachable(sec[0].r).has(sec[0].x, sec[0].y), 'o secreto não pode ser fácil');
      assert.ok(reachable(sec[0].r, { openCracks: true }).has(sec[0].x, sec[0].y), 'o secreto abre quebrando a parede');
      assert.equal(L.weaponReward, Math.min(L.id, 2));
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

test('nenhuma tocha ou obstáculo tapando passagem, porta ou portal', () => {
  for (const L of LEVELS) {
    parseLevel(L).rooms.forEach((r, i) => {
      const t = (x, y) => (r.tiles[y] || [])[x];
      for (const o of r.torches) {
        const horiz = t(o.x - 1, o.y) === '#' && t(o.x + 1, o.y) === '#';
        const vert = t(o.x, o.y - 1) === '#' && t(o.x, o.y + 1) === '#';
        assert.ok(!horiz && !vert, `${L.title}, sala ${i + 1}: tocha tapando passagem em ${o.x},${o.y}`);
      }
      for (const g of [r.entry, r.portal, r.exit].filter(Boolean)) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = t(g.x + dx, g.y + dy);
          assert.ok(n !== 'T', `${L.title}, sala ${i + 1}: tocha colada na porta ${g.x},${g.y}`);
        }
      }
    });
  }
});

test('toda sala de fase tem alguma recompensa', () => {
  for (const L of LEVELS.filter((l) => l.kind === 'fase')) {
    parseLevel(L).rooms.forEach((r, i) => {
      const ok = r.chests.length || r.hearts.length || r.cracks.length || r.merchant || r.torches.length >= 2 || r.boss || r.checkpoints.length;
      assert.ok(ok, `${L.title}, sala ${i + 1} não tem recompensa`);
    });
  }
});

test('Mundo 2: Mãe-Teia guarda o casulo do Feligon e o Ancião Oco fecha o mundo', () => {
  const f3 = parseLevel(LEVELS.find((l) => l.id === 3));
  const a3 = f3.rooms[f3.rooms.length - 1];
  assert.equal(a3.boss.type, 'maeteia');
  assert.ok(a3.cocoon, 'falta o casulo do Feligon');
  const f4 = parseLevel(LEVELS.find((l) => l.id === 4));
  assert.equal(f4.rooms[f4.rooms.length - 1].boss.type, 'anciao');
});

test('a Fase 2 termina na arena do Capitão de Ferro', () => {
  const P = parseLevel(LEVELS.find((l) => l.id === 2));
  const last = P.rooms[P.rooms.length - 1];
  assert.ok(last.boss);
  assert.ok(reachable(last).has(last.boss.x, last.boss.y));
});

test('portões de raízes guardam prêmios no Mundo 2 (só depois do Feligon)', () => {
  const f4 = parseLevel(LEVELS.find((l) => l.id === 4));
  assert.ok(f4.rooms.some((r) => r.vines.length), 'a Fase 4 precisa de portão de raízes');
  for (const L of LEVELS.filter((l) => l.world < 2 || l.id === 3)) assert.ok(parseLevel(L).rooms.every((r) => !r.vines.length), `${L.title} não pode ter portão de raízes (Feligon ainda não chegou)`);
});

test('a dificuldade aumenta de fase em fase', () => {
  const f = LEVELS.filter((l) => l.kind === 'fase');
  for (let i = 1; i < f.length; i++) assert.ok(f[i].difficulty > f[i - 1].difficulty);
});

test('a lava e o lago contam como obstáculo', () => {
  assert.ok(SOLID.has('~'));
});

test('Mundo 3: pontes, névoa, jaula do Dait e gás só depois do resgate', () => {
  assert.ok(WORLDS[2].ready);
  const f5 = LEVELS.find((l) => l.id === 5), f6 = LEVELS.find((l) => l.id === 6);
  assert.equal(f5.boss, 'saporei');
  assert.equal(f6.boss, 'hidra');
  const p5 = parseLevel(f5), p6 = parseLevel(f6);
  assert.ok(p5.rooms.some((r) => r.bridges.length), 'fase 5 tem pontes que afundam');
  assert.ok(f5.rooms.some((r) => r.fog), 'fase 5 tem névoa');
  const cageRoom = p6.rooms.findIndex((r) => r.cage);
  assert.ok(cageRoom >= 0 && cageRoom < p6.rooms.length - 1, 'o Dait é resgatado antes da Hidra');
  p6.rooms.forEach((r, i) => { if (r.gas.length) assert.ok(i > cageRoom, 'gás só depois do Dait'); });
  const reach = reachable(p6.rooms[cageRoom]);
  const c = p6.rooms[cageRoom].cage;
  assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach.has(c.x + dx, c.y + dy)), 'dá para chegar na jaula');
});

test('jogo completo: 8 fases prontas, Mundo 4 com Golem e Morgrave', () => {
  assert.ok(WORLDS.every((w) => w.ready), 'todos os mundos prontos');
  const fases = LEVELS.filter((l) => l.kind === 'fase');
  assert.equal(fases.length, TOTAL_PHASES);
  assert.deepEqual(fases.map((l) => l.id), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(LEVELS.find((l) => l.id === 7).boss, 'golem');
  assert.equal(LEVELS.find((l) => l.id === 8).boss, 'morgrave');
  assert.ok(parseLevel(LEVELS.find((l) => l.id === 7)).rooms.some((r) => r.gears.length), 'fase 7 tem engrenagens');
  for (const f of fases.filter((f) => f.id > 1)) assert.ok(f.boss, `fase ${f.id} termina com chefe`);
});
