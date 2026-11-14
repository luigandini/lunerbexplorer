import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSave, normalizeSave, computeStars, applyLevelResult, buyUpgrade, upgradeCost, isUnlocked, weaponStats } from '../src/progress.js';

test('save novo começa só com a fase 1 liberada', () => {
  const s = newSave();
  assert.equal(s.unlocked, 1);
  assert.ok(isUnlocked(s, 1));
  assert.ok(!isUnlocked(s, 2));
  assert.ok(isUnlocked(s, 2, true), 'modo teste libera tudo');
});

test('save quebrado ou estranho vira um save válido', () => {
  for (const bad of [null, 'oi', 42, { unlocked: 'x', crystals: -5, weapons: 9, upgrades: { fogo: 99 } }]) {
    const s = normalizeSave(bad);
    assert.ok(s.unlocked >= 1);
    assert.ok(s.crystals >= 0);
    assert.ok(s.weapons >= 0 && s.weapons <= 2);
    assert.ok(s.upgrades.fogo <= 3);
  }
});

test('estrelas: terminar, sem dano e segredo', () => {
  assert.deepEqual(computeStars({ finished: true, damageTaken: 0, secretFound: true }), [true, true, true]);
  assert.deepEqual(computeStars({ finished: true, damageTaken: 2, secretFound: false }), [true, false, false]);
  assert.deepEqual(computeStars({ finished: false, damageTaken: 0, secretFound: true }), [false, false, false]);
});

test('terminar fase libera a próxima, dá a arma e soma cristais', () => {
  let s = newSave();
  s = applyLevelResult(s, 1, { finished: true, damageTaken: 3, secretFound: false, crystals: 20 }, { weaponReward: 1 });
  assert.equal(s.unlocked, 2);
  assert.equal(s.weapons, 1);
  assert.equal(s.crystals, 20);
});

test('estrela conquistada nunca se perde', () => {
  let s = newSave();
  s = applyLevelResult(s, 1, { finished: true, damageTaken: 0, secretFound: true, crystals: 0 });
  s = applyLevelResult(s, 1, { finished: true, damageTaken: 5, secretFound: false, crystals: 0 });
  assert.deepEqual(s.stars[1], [true, true, true]);
});

test('não passa da última fase', () => {
  let s = newSave(); s.unlocked = 8;
  s = applyLevelResult(s, 8, { finished: true, damageTaken: 0, crystals: 0 }, { totalLevels: 8 });
  assert.equal(s.unlocked, 8);
});

test('Forja: compra com cristais e para no máximo', () => {
  let s = newSave(); s.crystals = 200;
  for (let i = 0; i < 3; i++) { const r = buyUpgrade(s, 'fogo'); assert.ok(r.ok); s = r.save; }
  assert.equal(s.upgrades.fogo, 3);
  assert.equal(upgradeCost(s, 'fogo'), null);
  assert.ok(!buyUpgrade(s, 'fogo').ok);
  assert.equal(s.crystals, 200 - 15 - 30 - 50);
});

test('Forja: sem cristais não compra', () => {
  const s = newSave();
  assert.ok(!buyUpgrade(s, 'rapidez').ok);
});

test('upgrades deixam a arma mais forte e rápida', () => {
  const a = weaponStats(newSave());
  const s = newSave(); s.upgrades = { fogo: 3, rapidez: 3, laser: 2 };
  const b = weaponStats(s);
  assert.ok(b.fireDamage > a.fireDamage);
  assert.ok(b.fireCooldown < a.fireCooldown && b.fireCooldown > 0.1);
  assert.ok(b.laserCharge < a.laserCharge && b.laserCharge > 0.2);
});
