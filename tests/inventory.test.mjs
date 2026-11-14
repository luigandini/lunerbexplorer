import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, newInventory, normalizeInventory, addItem, dropItem, useAmmo, select, shopPrice } from '../src/inventory.js';
import { newSave, normalizeSave, keepCrystals } from '../src/progress.js';

test('começa só com a Booteshiscore, que não pode sair', () => {
  const inv = newInventory();
  assert.equal(inv.slots[0].id, 'boot');
  assert.equal(inv.slots.length, 3);
  assert.equal(dropItem(inv, 0).slots[0].id, 'boot');
});

test('guarda até 2 armas novas; a terceira pede para largar uma', () => {
  let r = addItem(newInventory(), 'bombas'); assert.ok(r.ok);
  r = addItem(r.inv, 'choque'); assert.ok(r.ok);
  const full = addItem(r.inv, 'turbina');
  assert.equal(full.ok, false); assert.equal(full.reason, 'cheio');
  const swap = addItem(r.inv, 'turbina', 1);
  assert.ok(swap.ok);
  assert.deepEqual(swap.inv.slots.map((s) => s && s.id), ['boot', 'turbina', 'choque']);
});

test('pegar bombas de novo só recarrega, até o máximo', () => {
  let r = addItem(newInventory(), 'bombas');
  r = addItem(r.inv, 'bombas');
  assert.ok(r.refilled);
  assert.equal(r.inv.slots[1].ammo, ITEMS.bombas.maxAmmo);
});

test('a Super Bomba é uma só', () => {
  let r = addItem(newInventory(), 'superbomba');
  r = addItem(r.inv, 'superbomba');
  assert.equal(r.inv.slots[1].ammo, 1);
});

test('munição acaba e a arma some do espaço', () => {
  let { inv } = addItem(newInventory(), 'superbomba');
  inv = select(inv, 1);
  const u = useAmmo(inv, 1);
  assert.ok(u.ok);
  assert.equal(u.inv.slots[1], null);
  assert.equal(u.inv.sel, 0);
});

test('armas sem munição (choque, turbina) não gastam', () => {
  const { inv } = addItem(newInventory(), 'choque');
  assert.ok(useAmmo(inv, 1).ok);
  assert.equal(useAmmo(inv, 1).inv.slots[1].id, 'choque');
});

test('preços da loja: compra, recarga e esgotado', () => {
  const inv = newInventory();
  assert.equal(shopPrice(inv, 'turbina'), ITEMS.turbina.price);
  const { inv: i2 } = addItem(inv, 'turbina');
  assert.equal(shopPrice(i2, 'turbina'), null);
  const { inv: i3 } = addItem(inv, 'bombas');
  assert.equal(shopPrice(i3, 'bombas'), ITEMS.bombas.refill);
});

test('inventário quebrado vira válido e o save guarda o inventário', () => {
  const inv = normalizeInventory({ slots: [{ id: 'hack' }, { id: 'bombas', ammo: 99 }, { id: 'boot' }], sel: 7 });
  assert.equal(inv.slots[0].id, 'boot');
  assert.equal(inv.slots[1].ammo, ITEMS.bombas.maxAmmo);
  assert.equal(inv.slots[2], null);
  assert.equal(inv.sel, 0);
  assert.equal(normalizeSave({}).inventory.slots[0].id, 'boot');
});

test('desmaiar não faz perder os diamantes juntados', () => {
  assert.equal(keepCrystals(newSave(), 12).crystals, 12);
});
