// Fully synthesized audio (no sound files): engine, tyres, wind, impacts, beeps.

export class AudioFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.7;
  }

  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = (this.ctx = new C());

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(this.master);
    this.master.connect(ctx.destination);
    this.bus = comp;

    // shared noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const noise = () => { const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true; n.start(); return n; };

    // ---- engine ----
    this.eOut = ctx.createGain(); this.eOut.gain.value = 0;
    this.eFilter = ctx.createBiquadFilter(); this.eFilter.type = 'lowpass'; this.eFilter.Q.value = 3; this.eFilter.frequency.value = 900;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.4); }
    shaper.curve = curve;
    const mix = ctx.createGain(); mix.gain.value = 0.5;
    this.oscs = [];
    const mk = (type, mult, g) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = 40 * mult;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og); og.connect(mix); o.start();
      this.oscs.push({ o, mult });
    };
    mk('sawtooth', 1, 0.55); mk('square', 0.5, 0.35); mk('sawtooth', 2.01, 0.18); mk('triangle', 4, 0.08);
    const intake = noise();
    const ibp = ctx.createBiquadFilter(); ibp.type = 'bandpass'; ibp.frequency.value = 520; ibp.Q.value = 1.2;
    this.intakeGain = ctx.createGain(); this.intakeGain.gain.value = 0;
    intake.connect(ibp); ibp.connect(this.intakeGain); this.intakeGain.connect(mix);
    mix.connect(shaper); shaper.connect(this.eFilter); this.eFilter.connect(this.eOut); this.eOut.connect(this.bus);

    // ---- tyre screech ----
    const sk = noise();
    const sbp = ctx.createBiquadFilter(); sbp.type = 'bandpass'; sbp.frequency.value = 1900; sbp.Q.value = 7;
    const sbp2 = ctx.createBiquadFilter(); sbp2.type = 'bandpass'; sbp2.frequency.value = 2600; sbp2.Q.value = 9;
    this.skidGain = ctx.createGain(); this.skidGain.gain.value = 0;
    sk.connect(sbp); sk.connect(sbp2); sbp.connect(this.skidGain); sbp2.connect(this.skidGain); this.skidGain.connect(this.bus);
    this.skidLfo = ctx.createOscillator(); this.skidLfo.frequency.value = 9;
    const lfoG = ctx.createGain(); lfoG.gain.value = 300; this.skidLfo.connect(lfoG); lfoG.connect(sbp.frequency); this.skidLfo.start();

    // ---- wind / road rumble ----
    const w = noise();
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 300;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    w.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.bus);

    // ---- gravel / off-road ----
    const gr = noise();
    const gf = ctx.createBiquadFilter(); gf.type = 'highpass'; gf.frequency.value = 900;
    this.gravelGain = ctx.createGain(); this.gravelGain.gain.value = 0;
    gr.connect(gf); gf.connect(this.gravelGain); this.gravelGain.connect(this.bus);
  }

  horn(on) {
    if (!this.ctx) return;
    if (!this.hornGain) {
      const ctx = this.ctx;
      this.hornGain = ctx.createGain(); this.hornGain.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; f.Q.value = 1;
      const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 900; pk.gain.value = 8;
      for (const fr of [415, 522]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr; const g = ctx.createGain(); g.gain.value = 0.5; o.connect(g); g.connect(f); o.start(); }
      f.connect(pk); pk.connect(this.hornGain); this.hornGain.connect(this.bus);
    }
    this.hornGain.gain.setTargetAtTime(on ? 0.28 : 0, this.ctx.currentTime, on ? 0.012 : 0.03);
  }

  shift(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // brief torque cut: dip the engine and add a mechanical clunk
    this.eOut.gain.cancelScheduledValues(t);
    this.eOut.gain.setValueAtTime(this.eOut.gain.value, t);
    this.eOut.gain.linearRampToValueAtTime(this.eOut.gain.value * (kind === 'down' ? 0.7 : 0.35), t + 0.05);
    const n = this.ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = kind === 'denied' ? 300 : 1400; f.Q.value = 2;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(kind === 'denied' ? 0.25 : 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    n.connect(f); f.connect(g); g.connect(this.bus); n.start(t, Math.random()); n.stop(t + 0.1);
  }

  update(rpm, throttle, speed, slip, offroad, nitro, limiter = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, k = 0.05;
    const f = (rpm / 60) * 2; // 4-stroke firing frequency
    for (const { o, mult } of this.oscs) o.frequency.setTargetAtTime(f * mult, t, 0.03);
    this.eFilter.frequency.setTargetAtTime(500 + throttle * 2600 + rpm * 0.25 + (nitro ? 1200 : 0), t, k);
    const lim = limiter && throttle > 0.5 ? (Math.sin(t * 90) > 0 ? 0.35 : 1) : 1;
    this.eOut.gain.setTargetAtTime((0.16 + throttle * 0.22 + (rpm / 8000) * 0.12) * lim, t, k);
    this.intakeGain.gain.setTargetAtTime(throttle * 0.35 + (nitro ? 0.4 : 0), t, k);
    const s = Math.min(1, Math.max(0, (slip - 3.5) / 9)) * Math.min(1, speed / 8);
    this.skidGain.gain.setTargetAtTime(s * 0.32, t, 0.04);
    this.windGain.gain.setTargetAtTime(Math.min(0.35, speed / 240), t, k);
    this.windFilter.frequency.setTargetAtTime(200 + speed * 12, t, k);
    this.gravelGain.gain.setTargetAtTime(offroad ? Math.min(0.25, speed / 120) : 0, t, k);
  }

  idle() { this.update(900, 0, 0, 0, false, false); }

  beep(freq = 440, dur = 0.18, vol = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.02);
  }

  crash(intensity) {
    if (!this.ctx || intensity < 1.5) return;
    const t = this.ctx.currentTime;
    const n = this.ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700 + intensity * 60;
    const g = this.ctx.createGain();
    const v = Math.min(0.9, intensity / 18);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    n.connect(f); f.connect(g); g.connect(this.bus);
    n.start(t, Math.random()); n.stop(t + 0.5);
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.3);
    const og = this.ctx.createGain(); og.gain.setValueAtTime(v * 0.8, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(og); og.connect(this.bus); o.start(t); o.stop(t + 0.4);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }

  suspend() { this.ctx?.suspend?.(); }
  resume() { this.ctx?.resume?.(); }
}
