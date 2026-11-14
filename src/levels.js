// Dados das fases. Nada de Three.js aqui: este arquivo também roda nos testes (Node).
//
// Legenda dos mapas
//   #  parede de pedra         .  chão              ,  chão com musgo
//   L  lava (machuca)          W  teia (deixa lento) T  tocha (acende com bola de fogo)
//   Q  parede rachada (quebra com ataque, esconde segredo)
//   C  fogueira azul (checkpoint)   E  saída
//   B  baú de cristais         G  baú da Booteshiscore   S  baú secreto (3ª estrela)
//   H  coração                 P  início do Lunerb
//   z  zumbi mutante           a  zumbi de armadura      s  aranha de teia
//   m  morcego de brasa        K  Capitão de Ferro (mini-mestre)

export const WORLDS = [
  { id: 1, name: 'Fortaleza de Cinzarocha', ready: true },
  { id: 2, name: 'Bosque dos Sussurros', ready: false },
  { id: 3, name: 'Pântano do Lodo Negro', ready: false },
  { id: 4, name: 'Torre do Alquimista', ready: false },
];

export const LEVELS = [
  {
    id: 1,
    world: 1,
    title: 'O Despertar',
    music: 'castle',
    darkness: 0.85,
    weaponReward: 1,
    intro: [
      { who: 'Lunerb', text: 'Ai... minha cabeça... Onde eu estou?' },
      { who: 'Lunerb', text: 'Um castelo?! Eu preciso sair daqui e voltar pra casa!' },
    ],
    map: [
      '##########################################',
      '#P..#,.......T.........#.................#',
      '#...#..........z.......#......s....W.....#',
      '#.G....................#...W......WWW....#',
      '#...#.....z.....,......#..WWW......W.....#',
      '######..........#####..#...W.......s.....#',
      '#....#....T.....#...#..#.................#',
      '#.S..Q..........#.B.#..######.....########',
      '#....#..........#...#.......#.....#......#',
      '######...########...........#..C..#..m...#',
      '#.....................z.....#.....#......#',
      '#..T.........,..............#.....T......#',
      '#.........######.....########.....#......#',
      '#...z.....#LLLL#....................z....#',
      '#.........#LLLL#.............,...........#',
      '#...........................#######......#',
      '####..#####.....LLLLLLLL....#.....#......#',
      '#.......#.......LLLLLLLL....#..E..#..z...#',
      '#...m...#..........C........#.....#......#',
      '#.......#......z............#.....#...T..#',
      '#..B..H....................s.............#',
      '##########################################',
    ],
  },
  {
    id: 2,
    world: 1,
    title: 'Portões de Ferro',
    music: 'castle',
    darkness: 0.9,
    weaponReward: 2,
    boss: 'capitao',
    intro: [
      { who: 'Lunerb', text: 'Esses corredores não acabam nunca...' },
      { who: 'Lunerb', text: 'Dizem que tem uma segunda Booteshiscore escondida aqui!' },
    ],
    map: [
      '##############################################',
      '#..........#........LL..........#............#',
      '#.P........#...a....LL....m.....#............#',
      '#..........#........LL..........#............#',
      '#....G.....T........LL..........#............#',
      '#..........#....,...LL...z......#.....K....E.#',
      '####..######.................................#',
      '#..........#####..######..#######............#',
      '#..z.......#....................T............#',
      '#..........#..s......a..........#............#',
      '#....,.....#.........................,.......#',
      '######..####..########..#########............#',
      '#.................#........#....#............#',
      '#..C......T.......#...m....#..C.#######..#####',
      '#.................#........#....#............#',
      '#...LLLLLLLLLLL...#..z.....#....#..a......z..#',
      '#...LLLLLLLLLLL..............................#',
      '#...LLLLLLLLLLL...#.....a..#....#............#',
      '#.................#........#....#.....B......#',
      '#..m.......z......######..##....#............#',
      '#.......H...............................m....#',
      '###########..########....#######......########',
      '#....#....#..........#.........#.............#',
      '#.S..Q.....z....s....#....H....T.....a.......#',
      '#....#..........B....Q.........#.............#',
      '##############################################',
    ],
  },
];

export const SOLID = new Set(['#', 'T', 'Q']);
export const ENEMY_CHARS = { z: 'zumbi', a: 'armadura', s: 'aranha', m: 'morcego' };

// Transforma o mapa de texto em dados fáceis de usar no jogo e nos testes.
export function parseLevel(level) {
  const rows = level.map;
  const h = rows.length;
  const w = rows[0].length;
  const out = {
    id: level.id, w, h, tiles: [], start: null, exit: null,
    enemies: [], chests: [], checkpoints: [], torches: [], cracks: [], hearts: [], boss: null,
  };
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      let tile = c;
      if (c === 'P') { out.start = { x, y }; tile = '.'; }
      else if (c === 'E') { out.exit = { x, y }; tile = 'E'; }
      else if (ENEMY_CHARS[c]) { out.enemies.push({ type: ENEMY_CHARS[c], x, y }); tile = '.'; }
      else if (c === 'K') { out.boss = { type: 'capitao', x, y }; tile = '.'; }
      else if (c === 'B' || c === 'G' || c === 'S') {
        out.chests.push({ kind: c === 'B' ? 'cristais' : c === 'G' ? 'arma' : 'secreto', x, y });
        tile = '.';
      }
      else if (c === 'H') { out.hearts.push({ x, y }); tile = '.'; }
      else if (c === 'C') { out.checkpoints.push({ x, y }); tile = 'C'; }
      else if (c === 'T') { out.torches.push({ x, y }); }
      else if (c === 'Q') { out.cracks.push({ x, y }); }
      row.push(tile);
    }
    out.tiles.push(row);
  }
  return out;
}

// Busca em largura: quais quadradinhos o Lunerb alcança andando a partir do início.
export function reachable(parsed, { openCracks = false } = {}) {
  const seen = new Set();
  const key = (x, y) => y * parsed.w + x;
  const blocked = (t) => t === '#' || t === 'T' || t === 'L' || (t === 'Q' && !openCracks);
  const q = [[parsed.start.x, parsed.start.y]];
  seen.add(key(parsed.start.x, parsed.start.y));
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= parsed.w || ny >= parsed.h) continue;
      const k = key(nx, ny);
      if (seen.has(k) || blocked(parsed.tiles[ny][nx])) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return { has: (x, y) => seen.has(key(x, y)), size: seen.size };
}

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || null;
}

export const TOTAL_PHASES = 8; // 4 mundos x 2 fases (decidido com o Luis)
