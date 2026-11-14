// Armas e mochila do time. Sem Three.js: testado em Node.
//
// Cada herói tem a SUA arma própria, que não fica na mochila (Lunerb: Booteshiscore; Feligon: sementes).
// A mochila é do time: começa com 2 espaços e ganha +1 a cada amigo resgatado. Todos usam tudo.
// sel = -1 quer dizer "arma própria do herói"; 0, 1, 2... são os espaços da mochila.

export const ITEMS = {
  bombas: { name: 'Bombas', icon: '💣', desc: 'Segure para mirar, solte para jogar. Derruba 2 ou 3 monstros e quebra paredes.', ammo: 3, maxAmmo: 6, price: 20, refill: 15 },
  superbomba: { name: 'Super Bomba', icon: '☢️', desc: 'Explode a sala inteira! Só cabe uma.', ammo: 1, maxAmmo: 1, price: 60, refill: 60 },
  choque: { name: 'Arma de Choque', icon: '⚡', desc: 'Raio que persegue o monstro, até fazendo curva. Alcance curto.', price: 40 },
  turbina: { name: 'Turbina de Laser', icon: '🌀', desc: 'Laser gigante: o herói fica parado e o direcional gira o raio. Toque de novo para parar.', price: 70 },
};

export const PERSONAL = {
  lunerb: { name: 'Booteshiscore', icon: '🔥', fist: '👊' },
  feligon: { name: 'Estilingue de Sementes', icon: '🌱' },
  dait: { name: 'Pulso Ciano', icon: '❄️' },
};

export const BASE_SLOTS = 2;
export const capacityFor = (friends = []) => BASE_SLOTS + friends.length;

export function newInventory(cap = BASE_SLOTS) {
  return { slots: Array(cap).fill(null), sel: -1 };
}

function clone(inv) {
  return { slots: inv.slots.map((s) => (s ? { ...s } : null)), sel: inv.sel };
}

// Aceita save velho (com a Booteshiscore no espaço 0) e qualquer coisa estranha.
export function normalizeInventory(raw, cap = BASE_SLOTS) {
  const inv = newInventory(cap);
  if (!raw || !Array.isArray(raw.slots)) return inv;
  const items = raw.slots.filter((s) => s && ITEMS[s.id]);
  items.slice(0, cap).forEach((s, i) => {
    const it = ITEMS[s.id];
    inv.slots[i] = it.ammo ? { id: s.id, ammo: Math.max(1, Math.min(it.maxAmmo, Math.floor(Number(s.ammo) || 1))) } : { id: s.id };
  });
  return inv;
}

export function setCapacity(inv, cap) {
  const out = clone(inv);
  while (out.slots.length < cap) out.slots.push(null);
  return out;
}

export function findSlot(inv, id) {
  return inv.slots.findIndex((s) => s && s.id === id);
}

export function freeSlot(inv) {
  return inv.slots.findIndex((s) => !s);
}

// Guarda uma arma. Se já tem, recarrega. Se não cabe, pede para escolher qual largar (dropIndex).
export function addItem(inv, id, dropIndex = null) {
  const it = ITEMS[id];
  const out = clone(inv);
  const have = findSlot(out, id);
  if (have >= 0) {
    if (!it.ammo) return { ok: false, reason: 'ja-tem', inv: out };
    out.slots[have].ammo = Math.min(it.maxAmmo, out.slots[have].ammo + it.ammo);
    return { ok: true, refilled: true, inv: out };
  }
  let idx = freeSlot(out);
  if (idx < 0) {
    if (dropIndex === null || dropIndex < 0 || dropIndex >= out.slots.length) return { ok: false, reason: 'cheio', inv: out };
    idx = dropIndex;
  }
  out.slots[idx] = it.ammo ? { id, ammo: it.ammo } : { id };
  out.sel = idx;
  return { ok: true, slot: idx, inv: out };
}

export function dropItem(inv, index) {
  if (index < 0 || index >= inv.slots.length) return inv;
  const out = clone(inv);
  out.slots[index] = null;
  if (out.sel === index) out.sel = -1;
  return out;
}

// Gasta 1 de munição. Quando acaba, a arma some e volta para a arma própria.
export function useAmmo(inv, index) {
  const s = inv.slots[index];
  if (!s) return { ok: false, inv };
  if (!ITEMS[s.id].ammo) return { ok: true, inv };
  const out = clone(inv);
  out.slots[index].ammo -= 1;
  if (out.slots[index].ammo <= 0) { out.slots[index] = null; out.sel = -1; }
  return { ok: true, inv: out };
}

export function select(inv, index) {
  if (index === -1) return { ...inv, sel: -1 };
  if (index < 0 || index >= inv.slots.length || !inv.slots[index]) return inv;
  return { ...inv, sel: index };
}

export function shopPrice(inv, id) {
  const it = ITEMS[id];
  const have = findSlot(inv, id);
  if (have >= 0) {
    if (!it.ammo || inv.slots[have].ammo >= it.maxAmmo) return null;
    return it.refill;
  }
  return it.price;
}
