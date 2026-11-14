// Tudo que é texto e tela por cima do jogo.
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.invincible = false;
    this.dialogQueue = null;
    this.toastT = null;
    $('dialog').addEventListener('pointerdown', (e) => { e.preventDefault(); this.nextDialog(); });
  }

  show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
    if (id) $(id).classList.remove('hidden');
  }

  overlay(id, on) { $(id).classList.toggle('hidden', !on); }

  gameMode(on) {
    $('hud').classList.toggle('hidden', !on);
    $('controls').classList.toggle('hidden', !on);
    $('vignette').classList.toggle('hidden', !on);
  }

  hud({ hp, maxHp, crystals, turbo }) {
    const h = $('hearts');
    if (h.childElementCount !== maxHp) { h.innerHTML = ''; for (let i = 0; i < maxHp; i++) { const d = document.createElement('div'); d.className = 'heart'; h.appendChild(d); } }
    [...h.children].forEach((d, i) => d.classList.toggle('off', i >= hp));
    $('crystal-n').textContent = crystals;
    const pips = $('turbo-pips');
    if (pips.childElementCount !== 3) pips.innerHTML = '<b></b><b></b><b></b>';
    [...pips.children].forEach((b, i) => b.classList.toggle('on', turbo >= i + 1));
    $('btn-turbo').classList.toggle('empty', turbo < 1);
  }

  bossBar(name, armor = 0, hp = 0) {
    const bar = $('bossbar');
    if (!name) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    $('boss-name').textContent = name;
    $('boss-armor').style.width = `${Math.max(0, armor) * 45}%`;
    $('boss-hp').style.width = `${Math.max(0, hp) * 55}%`;
  }

  toast(text, ms = 2600) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => t.classList.remove('on'), ms);
  }

  titleCard(sub, title) {
    $('tc-sub').textContent = sub;
    $('tc-title').textContent = title;
    const c = $('titlecard');
    c.classList.add('on');
    setTimeout(() => c.classList.remove('on'), 1800);
  }

  bigText(text, ms = 1500, cls = '') {
    const b = $('bigtext');
    b.textContent = text;
    b.className = `on ${cls}`;
    clearTimeout(this.bigT);
    this.bigT = setTimeout(() => (b.className = cls), ms);
  }

  flash() {
    const f = $('flash');
    f.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
  }

  fade(on) { $('fade').classList.toggle('on', on); }

  dialog(lines, done) {
    if (!lines || !lines.length) { done && done(); return; }
    this.dialogQueue = { lines: lines.slice(), done };
    this.overlay('dialog', true);
    this.renderDialog();
  }

  renderDialog() {
    const l = this.dialogQueue.lines[0];
    $('dlg-who').textContent = l.who;
    $('dlg-text').textContent = l.text;
  }

  nextDialog() {
    if (!this.dialogQueue) return;
    sfx('clique');
    this.dialogQueue.lines.shift();
    if (this.dialogQueue.lines.length) { this.renderDialog(); return; }
    const done = this.dialogQueue.done;
    this.dialogQueue = null;
    this.overlay('dialog', false);
    done && done();
  }

  get dialogOpen() { return !!this.dialogQueue; }
}
