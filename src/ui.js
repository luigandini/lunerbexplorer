// Tudo que é texto e tela por cima do jogo.
import { sfx } from './audio.js';
import { ITEMS } from './inventory.js';

const ITEM_ICONS = Object.fromEntries(Object.entries(ITEMS).map(([k, v]) => [k, v.icon]));

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

  setControls({ attack = true, turbo = true, friend = false } = {}) {
    $('btn-attack').classList.toggle('hidden', !attack);
    $('btn-turbo').classList.toggle('hidden', !turbo);
    $('btn-special').classList.toggle('hidden', !friend);
  }

  friendCooldown(sec) {
    $('btn-special').classList.toggle('cooling', sec > 0);
    $('special-cd').textContent = sec > 0 ? Math.ceil(sec) : '';
  }

  hud({ hp, maxHp, crystals, turbo, showCrystals = true }) {
    $('crystals').classList.toggle('hidden', !showCrystals);
    const h = $('hearts');
    if (h.childElementCount !== maxHp) { h.innerHTML = ''; for (let i = 0; i < maxHp; i++) { const d = document.createElement('div'); d.className = 'heart'; h.appendChild(d); } }
    [...h.children].forEach((d, i) => d.classList.toggle('off', i >= hp));
    $('crystal-n').textContent = crystals;
    const pips = $('turbo-pips');
    if (pips.childElementCount !== 3) pips.innerHTML = '<b></b><b></b><b></b>';
    [...pips.children].forEach((b, i) => b.classList.toggle('on', turbo >= i + 1));
    $('btn-turbo').classList.toggle('empty', turbo < 1);
  }

  roomCounter(n, total, name) {
    $('roomcount').innerHTML = n ? `Sala ${n}/${total}<small>${name}</small>` : '';
    $('roomcount').classList.toggle('hidden', !n);
  }

  bossBar(name, armor = 0, hp = 0) {
    const bar = $('bossbar');
    $('roomcount').style.visibility = name ? 'hidden' : '';
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

  flash(color) {
    const f = $('flash');
    f.style.background = { green: '#5cff4a', orange: '#ff8a20', white: '#ffffff', blue: '#8fe8ff' }[color] || '#ff0000';
    f.dataset.strong = color === 'white' || color === 'orange' ? '1' : '';
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

  get dialogOpen() { return !!this.dialogQueue || !!this.choiceOpen; }

  // quadradinhos das armas (toque para escolher)
  slots(state, onSelect) {
    const box = $('slots');
    if (!state) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    box.innerHTML = '';
    state.inv.slots.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = `slot${i === state.inv.sel ? ' sel' : ''}${s ? '' : ' empty'}`;
      if (s) {
        const icon = s.id === 'boot' ? (state.weapons >= 1 ? '🔥' : '👊') : ITEM_ICONS[s.id];
        b.innerHTML = `<span>${icon}</span>${s.ammo != null ? `<i>${s.ammo}</i>` : ''}`;
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onSelect(i); });
      } else b.innerHTML = '<span>·</span>';
      box.appendChild(b);
    });
  }

  // pergunta com botões (ex.: mochila cheia)
  choice(title, text, options, cb) {
    this.choiceOpen = true;
    $('choice-title').textContent = title;
    $('choice-text').textContent = text;
    const box = $('choice-opts');
    box.innerHTML = '';
    options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'small';
      b.textContent = o;
      b.onclick = () => { sfx('clique'); this.choiceOpen = false; this.overlay('choice', false); cb(i); };
      box.appendChild(b);
    });
    this.overlay('choice', true);
  }

  // loja do mercador misterioso
  shop(model, h) {
    if (!model) { this.overlay('scr-shop', false); return; }
    this.overlay('scr-shop', true);
    $('shop-diamonds').textContent = model.diamonds;
    const list = $('shop-items');
    list.innerHTML = '';
    for (const it of model.items) {
      const d = document.createElement('div');
      d.className = 'shop-item';
      const label = it.cost === null ? (it.have ? 'Já tem' : '—') : (it.have ? `Recarregar · ${it.cost}` : `Comprar · ${it.cost}`);
      d.innerHTML = `<b class="ic">${it.icon}</b><div><h4>${it.name}${it.have && it.ammo != null ? ` <small>(${it.ammo})</small>` : ''}</h4><p>${it.desc}</p></div>`;
      const btn = document.createElement('button');
      btn.innerHTML = it.cost === null ? label : `${label} <span class="gem"></span>`;
      btn.disabled = it.cost === null || model.diamonds < it.cost;
      btn.onclick = () => h.buy(it.id);
      d.appendChild(btn);
      list.appendChild(d);
    }
    const ups = $('shop-ups');
    ups.innerHTML = model.hasBoot ? '<h4 class="sec">Melhorar a Booteshiscore</h4>' : '';
    if (model.hasBoot) for (const u of model.ups) {
      const d = document.createElement('div');
      d.className = 'shop-item';
      const pips = Array.from({ length: u.max }, (_, i) => `<b class="${i < u.level ? 'on' : ''}"></b>`).join('');
      d.innerHTML = `<b class="ic">🔥</b><div><h4>${u.name}</h4><p>${u.desc}</p><div class="pips l">${pips}</div></div>`;
      const btn = document.createElement('button');
      btn.innerHTML = u.cost === null ? 'MÁXIMO' : `Melhorar · ${u.cost} <span class="gem"></span>`;
      btn.disabled = u.cost === null || model.diamonds < u.cost;
      btn.onclick = () => h.upgrade(u.key);
      d.appendChild(btn);
      ups.appendChild(d);
    }
    $('btn-shop-close').onclick = () => { sfx('clique'); h.close(); };
  }
}
