// Guarda o progresso no próprio aparelho. Nada sai do celular.
import { normalizeSave } from './progress.js';

export const SAVE_KEY = 'lunerb_save_v1';
export const TEST_KEY = 'lunerb_modo_teste';

function safeStorage(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function loadSave(storage) {
  const st = safeStorage(storage);
  try {
    const raw = st && st.getItem(SAVE_KEY);
    return normalizeSave(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeSave(null);
  }
}

export function writeSave(save, storage) {
  const st = safeStorage(storage);
  try { st && st.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { return false; }
}

export function resetSave(storage) {
  const st = safeStorage(storage);
  try { st && st.removeItem(SAVE_KEY); } catch { /* sem armazenamento */ }
  return normalizeSave(null);
}

export function getTestMode(storage) {
  const st = safeStorage(storage);
  try { return !!st && st.getItem(TEST_KEY) === '1'; } catch { return false; }
}

export function setTestMode(on, storage) {
  const st = safeStorage(storage);
  try { st && (on ? st.setItem(TEST_KEY, '1') : st.removeItem(TEST_KEY)); } catch { /* ok */ }
}
