// Regras de progresso, estrelas e Forja. Sem Three.js: testado em Node.
import { newInventory, normalizeInventory, capacityFor } from './inventory.js';

export const SAVE_VERSION = 1;

export const UPGRADES = {
  fogo: { name: 'Fogo Forte', desc: 'Tiros mais fortes para todos os heróis', costs: [15, 30, 50] },
  rapidez: { name: 'Mão Rápida', desc: 'Todos os heróis atiram mais rápido', costs: [15, 30, 50] },
  laser: { name: 'Laser Turbo', desc: 'Tiro carregado mais rápido e mais forte (para todos)', costs: [25, 50] },
};

export function newSave() {
  return {
    v: SAVE_VERSION,
    unlocked: 0,          // maior fase liberada (0 = só o prólogo)
    stars: {},            // { [faseId]: [terminou, semDano, segredo] }
    crystals: 0,
    upgrades: { fogo: 0, rapidez: 0, laser: 0 },
    weapons: 0,           // quantas Booteshiscore o Lunerb já tem (0, 1 ou 2)
    inventory: newInventory(), // armas extras (bombas, choque, turbina...)
    friends: [],          // amigos resgatados (ex.: 'feligon')
    lead: 'lunerb',       // herói principal escolhido pelo jogador
    endings: {},          // finais de mundo já vistos
    storySeen: false,
    endingSeen: false,
    sound: true,
  };
}

// Aceita qualquer coisa (save velho, quebrado, vazio) e devolve um save válido.
export function normalizeSave(raw) {
  const base = newSave();
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, ...raw, upgrades: { ...base.upgrades, ...(raw.upgrades || {}) } };
  s.v = SAVE_VERSION;
  s.unlocked = clampInt(s.unlocked, 0, 99, 0);
  s.crystals = clampInt(s.crystals, 0, 99999, 0);
  s.weapons = clampInt(s.weapons, 0, 2, 0);
  for (const k of Object.keys(UPGRADES)) {
    s.upgrades[k] = clampInt(s.upgrades[k], 0, UPGRADES[k].costs.length, 0);
  }
  const stars = {};
  if (s.stars && typeof s.stars === 'object') {
    for (const [id, arr] of Object.entries(s.stars)) {
      if (Array.isArray(arr)) stars[id] = [0, 1, 2].map((i) => !!arr[i]);
    }
  }
  s.stars = stars;
  s.friends = Array.isArray(raw.friends) ? [...new Set(raw.friends.filter((f) => f === 'feligon' || f === 'dait'))] : [];
  s.inventory = normalizeInventory(raw.inventory, capacityFor(s.friends));
  s.lead = s.friends.includes(raw.lead) ? raw.lead : 'lunerb';
  s.endings = raw.endings && typeof raw.endings === 'object' ? { ...raw.endings } : {};
  if (raw.endingSeen) s.endings[1] = true;
  s.storySeen = !!s.storySeen;
  s.endingSeen = !!s.endingSeen;
  s.sound = s.sound !== false;
  return s;
}

function clampInt(v, min, max, dflt) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

export function isUnlocked(save, levelId, testMode = false) {
  return testMode || levelId <= save.unlocked;
}

// Estrelas: 1) terminou  2) sem perder coração  3) abriu o baú secreto
export function computeStars({ finished, damageTaken, secretFound }) {
  return [!!finished, !!finished && damageTaken === 0, !!finished && !!secretFound];
}

export function countStars(arr) {
  return (arr || []).filter(Boolean).length;
}

// Junta o resultado de uma fase no save. Estrela conquistada nunca é perdida.
export function applyLevelResult(save, levelId, result, { weaponReward = 0, totalLevels = 8 } = {}) {
  const s = normalizeSave(save);
  const got = computeStars(result);
  const old = s.stars[levelId] || [false, false, false];
  s.stars[levelId] = old.map((v, i) => v || got[i]);
  s.crystals += Math.max(0, Math.floor(result.crystals || 0));
  if (got[0]) {
    s.unlocked = Math.max(s.unlocked, Math.min(totalLevels, levelId + 1));
    s.weapons = Math.max(s.weapons, weaponReward);
  }
  return s;
}

export function upgradeCost(save, key) {
  const up = UPGRADES[key];
  const lvl = save.upgrades[key] || 0;
  return lvl < up.costs.length ? up.costs[lvl] : null;
}

export function buyUpgrade(save, key) {
  const s = normalizeSave(save);
  const cost = upgradeCost(s, key);
  if (cost === null || s.crystals < cost) return { ok: false, save: s };
  s.crystals -= cost;
  s.upgrades[key] += 1;
  return { ok: true, save: s };
}

// Números de combate que dependem dos upgrades
export function weaponStats(save) {
  const u = save.upgrades;
  return {
    fireDamage: 1 + u.fogo * 0.5,
    fireCooldown: 0.42 - u.rapidez * 0.08,
    laserCharge: 0.9 - u.laser * 0.2,
    laserDamage: 4 + u.laser * 2,
  };
}

// Diamantes ganhos mesmo quando o Lunerb desmaia (ele não perde o que juntou)
export function keepCrystals(save, n) {
  const s = normalizeSave(save);
  s.crystals += Math.max(0, Math.floor(n || 0));
  return s;
}
