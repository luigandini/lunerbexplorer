// Dados das fases, divididas em SALAS-MAQUETE (cada sala aparece inteira na tela).
// Nada de Three.js aqui: este arquivo também roda nos testes (Node).
//
// Legenda
//   Castelo:  #  parede      .  chão de pedra     ,  chão com musgo
//   Floresta: Y  árvore      R  pedra             U  arbusto        ,  grama   .  trilha
//             f  flores      g  tufo de grama     ~  lago de lodo radioativo
//             O  de onde saem os monstros que perseguem
//   Comum:    L  lava   W  teia   T  tocha   Q  parede rachada (segredo)   C  fogueira azul
//             B  baú de cristais   G  baú da Booteshiscore   S  baú secreto   H  coração
//             J  baú com arma nova (bombas, choque...)   V  lugar onde o mercador misterioso pode aparecer
//             P  início da fase    N  entrada da sala   X  portal para a próxima sala   E  saída da fase
//             z  zumbi mutante   a  zumbi de armadura   s  aranha   m  morcego de brasa   K  Capitão de Ferro

export const WORLDS = [
  { id: 1, name: 'Fortaleza de Cinzarocha', ready: true },
  { id: 2, name: 'Bosque dos Sussurros', ready: false },
  { id: 3, name: 'Pântano do Lodo Negro', ready: false },
  { id: 4, name: 'Torre do Alquimista', ready: false },
];

export const LEVELS = [
  {
    id: 0,
    kind: 'prologo',
    world: 0,
    title: 'A Floresta',
    theme: 'forest',
    hero: 'lucas',
    music: 'title',
    weaponReward: 0,
    intro: [
      { who: 'Lucas', text: 'Que floresta bonita... vou explorar um pouco.' },
    ],
    rooms: [
      { name: 'Clareira', map: [
        'YYYgYYYYgYYYY',
        'Y,,f,,,,,,g,Y',
        'Y,,,R,,,,U,,Y',
        'P,.........,X',
        'Y,g,,,.,,,,,Y',
        'Y,U,,,,,,R,fY',
        'Yf,,,,g,,,,,Y',
        'YO,,,U,,,f,,Y',
        'YYYYYgYYYYYYY',
      ] },
      { name: 'Floresta fechada', map: [
        'YYYYYYYYYYYYY',
        'Y,,,Y,,,U,,,Y',
        'Y,R,Y,Y,,,Y,Y',
        'N,,,,,Y,R,Y,X',
        'Y,Y,U,Y,,,Y,Y',
        'Y,Y,,,,,Y,,,Y',
        'Y,,,R,Y,,,U,Y',
        'YO,,,,Y,,R,,Y',
        'YYYYYYYYYYYYY',
      ] },
      { name: 'Trilha das pedras', map: [
        'YYRYYYYYYRYYY',
        'Y,,,,,,z,,,,Y',
        'Y,UU,,,RR,,,Y',
        'N,,,,,,,,,z,X',
        'Y,RR,,UU,,,,Y',
        'Y,,,,,,,,z,,Y',
        'Y,,U,,R,,,,,Y',
        'YO,,,,,,,U,,Y',
        'YYYYYRYYYYYYY',
      ] },
      { name: 'Lago de lodo', map: [
        'YYYYYYYYYYYYY',
        'Y,,,,,~~~~~~Y',
        'Y,f,,,~~~~~~Y',
        'N,,,,,,~~~~~Y',
        'Y,,R,,,~~~~~Y',
        'Y,,,,,~~~~~~Y',
        'YO,,U,,~~~~~Y',
        'Y,,,,,,,~~~,Y',
        'YYYYYYYYYYYYY',
      ] },
    ],
  },
  {
    id: 1,
    kind: 'fase',
    difficulty: 1,
    world: 1,
    title: 'O Despertar',
    theme: 'castle',
    hero: 'lunerb',
    music: 'castle',
    weaponReward: 1,
    intro: [
      { who: 'Lunerb', text: 'Ai... minha cabeça... Onde eu estou?' },
      { who: 'Lunerb', text: 'Um castelo?! Eu preciso sair daqui e voltar pra casa!' },
    ],
    rooms: [
      { name: 'A Cela', map: [
        '#############',
        '#P..#,......#',
        '#...#..T....#',
        '#.G.......z.#',
        '#...#.......X',
        '#####...,...#',
        '#.....z.....#',
        '#..T......B.#',
        '#############',
      ] },
      { name: 'Sala das Teias', map: [
        '#############',
        '#S.#.W..s...#',
        '#..Q..WWW...#',
        '####...W....#',
        'N...........#',
        '#.....###.s.#',
        '#..T..#B..W.X',
        '#.V.....z...#',
        '#############',
      ] },
      { name: 'Ponte de Lava', loot: 'bombas', map: [
        '#############',
        '#...LLL....J#',
        '#...LLL..m..#',
        'N...........#',
        '#...LLL..C..#',
        '#.H.LLL.....#',
        '#.m.LLL..z..X',
        '#..T.LLL..T.#',
        '#############',
      ] },
      { name: 'Salão Esquecido', map: [
        '#############',
        '#V.,....T...#',
        '#.....##..z.#',
        'N.....##....#',
        '#.....s...,.#',
        '#..z........#',
        '#.##....##..#',
        '#.##.B..##.zX',
        '#############',
      ] },
      { name: 'Porta Velha', map: [
        '#############',
        '#.....z.....#',
        '#.T......T..#',
        'N.....,.....#',
        '#.......z...E',
        '#...........#',
        '#..s.H...s..#',
        '#.....,.....#',
        '#############',
      ] },
    ],
  },
  {
    id: 2,
    kind: 'fase',
    difficulty: 1.15,
    world: 1,
    title: 'Portões de Ferro',
    theme: 'castle',
    hero: 'lunerb',
    music: 'castle',
    weaponReward: 2,
    boss: 'capitao',
    intro: [
      { who: 'Lunerb', text: 'Esses corredores não acabam nunca...' },
      { who: 'Lunerb', text: 'Dizem que tem uma segunda Booteshiscore escondida aqui!' },
    ],
    rooms: [
      { name: 'Corredor de Ferro', map: [
        '#############',
        '#P....#.....#',
        '#.....#..a..#',
        '#..G..T.....X',
        '#.....#.....#',
        '##.####..z..#',
        '#.......,...#',
        '#..T.....B..#',
        '#############',
      ] },
      { name: 'Rio de Lava', map: [
        '#############',
        '#..LLLLLLL..#',
        '#..LLLLLLL.m#',
        'N...........#',
        '#..LL...LL..#',
        '#..LL.C.LL.aX',
        '#.m......V..#',
        '#..T....H...#',
        '#############',
      ] },
      { name: 'Ninho das Aranhas', loot: 'choque', map: [
        '#############',
        '#S.#..s....J#',
        '#..Q.....W..#',
        '####..WWW...#',
        'N.....W..s..#',
        '#.........z.#',
        '#..z..##....X',
        '#..T..##..B.#',
        '#############',
      ] },
      { name: 'Quartel', map: [
        '#############',
        '#.......T.a.#',
        '#...##......#',
        'N...##...a..#',
        '#.......z...#',
        '#..m....##..#',
        '#.C.....##.zX',
        '#...,.V.....#',
        '#############',
      ] },
      { name: 'Arena do Capitão', map: [
        '###############',
        '#......T......#',
        '#.............#',
        '#....,....,...#',
        '#.............#',
        'N......K......E',
        '#.............#',
        '#...,.....,...#',
        '#.............#',
        '#......T......#',
        '###############',
      ] },
    ],
  },
];

export const SOLID = new Set(['#', 'T', 'Q', 'Y', 'R', 'U', '~']);
export const ENEMY_CHARS = { z: 'zumbi', a: 'armadura', s: 'aranha', m: 'morcego' };
export const ROOM_SPACING = 22; // distância entre as maquetes no "espaço"

export function parseRoom(rows, index = 0, loot = null) {
  const h = rows.length;
  const w = rows[0].length;
  const out = {
    index, w, h, tiles: [], entry: null, isStart: false, portal: null, exit: null,
    enemies: [], chests: [], checkpoints: [], torches: [], cracks: [], hearts: [], boss: null, spawners: [], lake: [], merchant: null,
  };
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      let tile = c;
      if (c === 'P' || c === 'N') { out.entry = { x, y }; out.isStart = c === 'P'; tile = '.'; }
      else if (c === 'X') { out.portal = { x, y }; tile = 'X'; }
      else if (c === 'E') { out.exit = { x, y }; tile = 'E'; }
      else if (ENEMY_CHARS[c]) { out.enemies.push({ type: ENEMY_CHARS[c], x, y }); tile = '.'; }
      else if (c === 'K') { out.boss = { type: 'capitao', x, y }; tile = '.'; }
      else if (c === 'B' || c === 'G' || c === 'S') {
        out.chests.push({ kind: c === 'B' ? 'cristais' : c === 'G' ? 'arma' : 'secreto', x, y });
        tile = '.';
      }
      else if (c === 'H') { out.hearts.push({ x, y }); tile = '.'; }
      else if (c === 'J') { out.chests.push({ kind: 'arma-nova', x, y }); tile = '.'; }
      else if (c === 'V') { out.merchant = { x, y }; tile = '.'; }
      else if (c === 'C') { out.checkpoints.push({ x, y }); }
      else if (c === 'T') { out.torches.push({ x, y }); }
      else if (c === 'Q') { out.cracks.push({ x, y }); }
      else if (c === 'O') { out.spawners.push({ x, y }); tile = ','; }
      else if (c === '~') { out.lake.push({ x, y }); }
      row.push(tile);
    }
    out.tiles.push(row);
  }
  for (const c of out.chests) if (c.kind === 'arma-nova') c.loot = loot;
  return out;
}

export function parseLevel(level) {
  return { id: level.id, rooms: level.rooms.map((r, i) => parseRoom(r.map, i, r.loot || null)) };
}

// Busca em largura: até onde o personagem chega andando a partir da entrada da sala.
export function reachable(room, { openCracks = false } = {}) {
  const seen = new Set();
  const key = (x, y) => y * room.w + x;
  const blocked = (t) => (SOLID.has(t) && !(t === 'Q' && openCracks)) || t === 'L';
  const q = [[room.entry.x, room.entry.y]];
  seen.add(key(room.entry.x, room.entry.y));
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= room.w || ny >= room.h) continue;
      const k = key(nx, ny);
      if (seen.has(k) || blocked(room.tiles[ny][nx])) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return { has: (x, y) => seen.has(key(x, y)), size: seen.size };
}

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || null;
}

export const TOTAL_PHASES = 8; // 4 mundos x 2 fases (o prólogo não conta)
