// Armas e inventário do Lunerb (3 espaços: a Booteshiscore sempre fica + 2 para armas novas).
// Sem Three.js: testado em Node.

export const ITEMS = {
  boot: { name: 'Booteshiscore', icon: '🔥', desc: 'Bolas de fogo. Com as duas: segure e solte para o laser.', fixed: true },
  bombas: { name: 'Bombas', icon: '💣', desc: 'Segure para mirar, solte para jogar. Derruba 2 ou 3 monstros.', ammo: 3, maxAmmo: 6, price: 20, refill: 15 },
  superbomba: { name: 'Super Bomba', icon: '☢️', desc: 'Explode a sala inteira! Só cabe uma.', ammo: 1, maxAmmo: 1, price: 60, refill: 60 },
  choque: { name: 'Arma de Choque', icon: '⚡', desc: 'Raio que persegue o monstro, até fazendo curva. Alcance curto.', price: 40 },
  turbina: { name: 'Turbina de Laser', icon: '🌀', desc: 'Laser gigante e reto. Trava o Lunerb. Toque de novo para parar.', price: 70 },
};

export const SLOTS = 3;

export function newInventory() {
  return { slots: [{ id: 'boot' }, null, null], sel: 0 };
}

export function normalizeInventory(raw) {
  const inv = newInventory();
  if (!raw || !Array.isArray(raw.slots)) return inv;
  for (let i = 1; i < SLOTS; i++) {
    const s = raw.slots[i];
    if (s && ITEMS[s.id] && !ITEMS[s.id].fixed) {
      const it = ITEMS[s.id];
      inv.slots[i] = it.ammo ? { id: s.id, ammo: Math.max(0, Math.min(it.maxAmmo, Math.floor(Number(s.ammo) || 0))) } : { id: s.id };
    }
  }
  inv.sel = Number.isInteger(raw.sel) && raw.sel >= 0 && raw.sel < SLOTS && inv.slots[raw.sel] ? raw.sel : 0;
  return inv;
}

export function findSlot(inv, id) {
  return inv.slots.findIndex((s) => s && s.id === id);
}

export function freeSlot(inv) {
  return inv.slots.findIndex((s, i) => i > 0 && !s);
}

// Tenta guardar uma arma. Se já tem, recarrega a munição. Se não cabe, pede para escolher qual largar.
export function addItem(inv, id, dropIndex = null) {
  const it = ITEMS[id];
  const out = { slots: inv.slots.map((s) => (s ? { ...s } : null)), sel: inv.sel };
  const have = findSlot(out, id);
  if (have >= 0) {
    if (!it.ammo) return { ok: false, reason: 'ja-tem', inv: out };
    out.slots[have].ammo = Math.min(it.maxAmmo, out.slots[have].ammo + it.ammo);
    return { ok: true, refilled: true, inv: out };
  }
  let idx = freeSlot(out);
  if (idx < 0) {
    if (dropIndex === null || dropIndex < 1 || dropIndex >= SLOTS) return { ok: false, reason: 'cheio', inv: out };
    idx = dropIndex;
  }
  out.slots[idx] = it.ammo ? { id, ammo: it.ammo } : { id };
  out.sel = idx;
  return { ok: true, slot: idx, inv: out };
}

export function dropItem(inv, index) {
  if (index < 1 || index >= SLOTS) return inv;
  const out = { slots: inv.slots.map((s) => (s ? { ...s } : null)), sel: inv.sel };
  out.slots[index] = null;
  if (out.sel === index) out.sel = 0;
  return out;
}

// Gasta 1 de munição. Quando acaba, a arma some do espaço.
export function useAmmo(inv, index) {
  const s = inv.slots[index];
  if (!s || !ITEMS[s.id].ammo) return { ok: true, inv };
  if (s.ammo <= 0) return { ok: false, inv };
  const out = { slots: inv.slots.map((x) => (x ? { ...x } : null)), sel: inv.sel };
  out.slots[index].ammo -= 1;
  if (out.slots[index].ammo <= 0) { out.slots[index] = null; out.sel = 0; }
  return { ok: true, inv: out };
}

export function select(inv, index) {
  if (index < 0 || index >= SLOTS || !inv.slots[index]) return inv;
  return { ...inv, sel: index };
}

// Preço na loja: arma nova, ou recarga se já tem (armas sem munição não podem ser compradas de novo)
export function shopPrice(inv, id) {
  const it = ITEMS[id];
  const have = findSlot(inv, id);
  if (have >= 0) {
    if (!it.ammo) return null;
    if (inv.slots[have].ammo >= it.maxAmmo) return null;
    return it.refill;
  }
  return it.price;
}
