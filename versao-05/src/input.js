// Controles de toque: joystick à esquerda + botões grandes à direita. Teclado para testar no computador.

export class Input {
  constructor(root) {
    this.root = root;
    this.jx = 0; this.jy = 0;
    this.attack = false; this.attackPressed = false; this.attackReleased = false;
    this.turboPressed = false; this.specialPressed = false;
    this.enabled = false;
    this.keys = new Set();
    this.stickId = null;
    this.stickBase = document.getElementById('stick');
    this.stickKnob = document.getElementById('stick-knob');
    this.zone = document.getElementById('stick-zone');
    this.btnAttack = document.getElementById('btn-attack');
    this.btnTurbo = document.getElementById('btn-turbo');
    this.btnSpecial = document.getElementById('btn-special');
    this.bind();
  }

  bind() {
    const z = this.zone;
    z.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      this.stickId = e.pointerId;
      z.setPointerCapture?.(e.pointerId);
      this.ox = e.clientX; this.oy = e.clientY;
      this.stickBase.style.left = `${e.clientX}px`;
      this.stickBase.style.top = `${e.clientY}px`;
      this.stickBase.classList.add('on');
      this.moveStick(e);
      e.preventDefault();
    });
    z.addEventListener('pointermove', (e) => { if (e.pointerId === this.stickId) this.moveStick(e); });
    const end = (e) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null; this.jx = 0; this.jy = 0;
      this.stickBase.classList.remove('on');
      this.stickKnob.style.transform = 'translate(-50%, -50%)';
    };
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);

    const hold = (el, down, up) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('pressed'); down(); });
      const off = (e) => { e.preventDefault?.(); if (!el.classList.contains('pressed')) return; el.classList.remove('pressed'); up && up(); };
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };
    hold(this.btnAttack, () => { this.attack = true; this.attackPressed = true; }, () => { this.attack = false; this.attackReleased = true; });
    hold(this.btnTurbo, () => { this.turboPressed = true; });
    hold(this.btnSpecial, () => { this.special = true; this.specialPressed = true; }, () => { this.special = false; this.specialReleased = true; });

    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (this.keys.has(k)) return;
      this.keys.add(k);
      if (k === 'j' || k === ' ') { this.attack = true; this.attackPressed = true; }
      if (k === 'k' || k === 'shift') this.turboPressed = true;
      if (k === 'l') { this.special = true; this.specialPressed = true; }
    });
    addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === 'j' || k === ' ') { this.attack = false; this.attackReleased = true; }
      if (k === 'l') { this.special = false; this.specialReleased = true; }
    });
  }

  moveStick(e) {
    const max = 55;
    let dx = e.clientX - this.ox, dy = e.clientY - this.oy;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    this.jx = dx / max; this.jy = dy / max;
    this.stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  // Direção na tela (x para direita, y para baixo), juntando joystick e teclado
  dir() {
    let x = this.jx, y = this.jy;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y -= 1;
    if (k.has('s') || k.has('arrowdown')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    if (len < 0.15) return { x: 0, y: 0 };
    return { x, y };
  }

  consume() {
    this.attackPressed = false; this.attackReleased = false;
    this.turboPressed = false; this.specialPressed = false; this.specialReleased = false;
  }

  reset() {
    this.attack = false; this.special = false; this.jx = 0; this.jy = 0; this.stickId = null;
    this.btnAttack.classList.remove('pressed'); this.btnSpecial.classList.remove('pressed');
    this.stickBase.classList.remove('on');
    this.consume();
  }
}
