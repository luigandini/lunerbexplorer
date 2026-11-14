import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, PERSONAL, newInventory, normalizeInventory, addItem, dropItem, useAmmo, select, shopPrice, capacityFor, setCapacity } from '../src/inventory.js';
import { newSave, normalizeSave, keepCrystals } from '../src/progress.js';

test('a arma própria de cada herói não fica na mochila', () => {
  const inv = newInventory();
  assert.equal(inv.sel, -1);
  assert.ok(inv.slots.every((s) => s === null));
  assert.ok(PERSONAL.lunerb && PERSONAL.feligon);
  assert.ok(!ITEMS.boot);
});

test('a mochila começa com 2 espaços e cresce +1 a cada amigo', () => {
  assert.equal(capacityFor([]), 2);
  assert.equal(capacityFor(['feligon']), 3);
  assert.equal(capacityFor(['feligon', 'dait']), 4);
  assert.equal(normalizeSave({ friends: ['feligon'] }).inventory.slots.length, 3);
  assert.equal(setCapacity(newInventory(2), 3).slots.length, 3);
});

test('mochila cheia pede para largar uma arma', () => {
  let r = addItem(newInventory(2), 'bombas'); assert.ok(r.ok);
  r = addItem(r.inv, 'choque'); assert.ok(r.ok);
  const full = addItem(r.inv, 'turbina');
  assert.equal(full.reason, 'cheio');
  const swap = addItem(r.inv, 'turbina', 0);
  assert.deepEqual(swap.inv.slots.map((s) => s && s.id), ['turbina', 'choque']);
});

test('pegar bombas de novo só recarrega, até o máximo', () => {
  let r = addItem(newInventory(), 'bombas');
  r = addItem(r.inv, 'bombas');
  assert.ok(r.refilled);
  assert.equal(r.inv.slots[0].ammo, ITEMS.bombas.maxAmmo);
});

test('munição acaba e volta para a arma própria', () => {
  let { inv } = addItem(newInventory(), 'superbomba');
  inv = select(inv, 0);
  const u = useAmmo(inv, 0);
  assert.ok(u.ok);
  assert.equal(u.inv.slots[0], null);
  assert.equal(u.inv.sel, -1);
});

test('choque e turbina não gastam', () => {
  const { inv } = addItem(newInventory(), 'choque');
  assert.equal(useAmmo(inv, 0).inv.slots[0].id, 'choque');
});

test('preços da loja: compra, recarga e esgotado', () => {
  const inv = newInventory();
  assert.equal(shopPrice(inv, 'turbina'), ITEMS.turbina.price);
  assert.equal(shopPrice(addItem(inv, 'turbina').inv, 'turbina'), null);
  assert.equal(shopPrice(addItem(inv, 'bombas').inv, 'bombas'), ITEMS.bombas.refill);
});

test('save velho (Booteshiscore no espaço 0) vira mochila nova sem perder armas', () => {
  const inv = normalizeInventory({ slots: [{ id: 'boot' }, { id: 'bombas', ammo: 99 }, { id: 'turbina' }], sel: 2 }, 2);
  assert.deepEqual(inv.slots.map((s) => s && s.id), ['bombas', 'turbina']);
  assert.equal(inv.slots[0].ammo, ITEMS.bombas.maxAmmo);
  assert.equal(inv.sel, -1);
  assert.equal(dropItem(inv, 0).slots[0], null);
});

test('desmaiar não faz perder os diamantes juntados', () => {
  assert.equal(keepCrystals(newSave(), 12).crystals, 12);
});
