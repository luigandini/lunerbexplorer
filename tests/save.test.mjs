import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSave, writeSave, resetSave, getTestMode, setTestMode, SAVE_KEY } from '../src/save.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

test('salva e carrega no aparelho', () => {
  const st = memStorage();
  const s = loadSave(st);
  s.crystals = 77; s.unlocked = 2;
  assert.ok(writeSave(s, st));
  const back = loadSave(st);
  assert.equal(back.crystals, 77);
  assert.equal(back.unlocked, 2);
});

test('JSON corrompido não quebra o jogo', () => {
  const st = memStorage();
  st.setItem(SAVE_KEY, '{quebrado');
  assert.equal(loadSave(st).unlocked, 0);
});

test('armazenamento bloqueado não quebra o jogo', () => {
  const boom = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.equal(loadSave(boom).unlocked, 0);
  assert.equal(writeSave({}, boom), false);
  assert.equal(getTestMode(boom), false);
});

test('reset e modo teste', () => {
  const st = memStorage();
  writeSave({ crystals: 5 }, st);
  assert.equal(resetSave(st).crystals, 0);
  setTestMode(true, st); assert.ok(getTestMode(st));
  setTestMode(false, st); assert.ok(!getTestMode(st));
});
