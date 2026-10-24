// Keyboard, gamepad and touch input.
export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { left: false, right: false, gas: false, brake: false, nitro: false, hb: false };
    this.throttle = 0; this.brake = 0; this.steer = 0; this.handbrake = false; this.nitro = false;
    this.actions = {};
    this._padPrev = [];
    const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (block.has(e.code)) e.preventDefault();
      if (!e.repeat) {
        const map = { KeyC: 'camera', KeyR: 'reset', KeyP: 'pause', Escape: 'pause', KeyM: 'mute', KeyF: 'fps' };
        if (map[e.code]) this._fire(map[e.code]);
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }
  on(name, fn) { this.actions[name] = fn; }
  _fire(name) { this.actions[name]?.(); }

  bindTouch(root) {
    root.querySelectorAll('[data-touch]').forEach((el) => {
      const k = el.dataset.touch;
      const set = (v) => (e) => { e.preventDefault(); this.touch[k] = v; el.classList.toggle('on', v); };
      el.addEventListener('pointerdown', set(true));
      el.addEventListener('pointerup', set(false));
      el.addEventListener('pointercancel', set(false));
      el.addEventListener('pointerleave', set(false));
    });
  }

  poll() {
    const k = this.keys, t = this.touch;
    let thr = (k.has('KeyW') || k.has('ArrowUp') || t.gas) ? 1 : 0;
    let brk = (k.has('KeyS') || k.has('ArrowDown') || t.brake) ? 1 : 0;
    let st = ((k.has('KeyD') || k.has('ArrowRight') || t.right) ? 1 : 0) - ((k.has('KeyA') || k.has('ArrowLeft') || t.left) ? 1 : 0);
    let hb = k.has('Space') || t.hb;
    let nit = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyN') || t.nitro;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] || 0;
      if (Math.abs(ax) > 0.12) st = Math.sign(ax) * (Math.abs(ax) - 0.12) / 0.88;
      const b = (n) => p.buttons[n] ? p.buttons[n].value || (p.buttons[n].pressed ? 1 : 0) : 0;
      thr = Math.max(thr, b(7)); brk = Math.max(brk, b(6));
      hb = hb || b(0) > 0.5; nit = nit || b(1) > 0.5 || b(5) > 0.5;
      const edge = (n, name) => { const v = b(n) > 0.5; if (v && !this._padPrev[n]) this._fire(name); this._padPrev[n] = v; };
      edge(3, 'camera'); edge(9, 'pause'); edge(2, 'reset');
      break;
    }
    this.throttle = thr; this.brake = brk; this.steer = Math.max(-1, Math.min(1, st));
    this.handbrake = hb; this.nitro = nit;
  }
}
