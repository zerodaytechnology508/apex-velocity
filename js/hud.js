// Heads-up display: speedometer, minimap, race info, messages.
const $ = (id) => document.getElementById(id);

export function fmtTime(t) {
  if (!isFinite(t) || t <= 0) return '--:--.---';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export class HUD {
  constructor() {
    this.el = {
      root: $('hud'), pos: $('hPos'), posOf: $('hPosOf'), lap: $('hLap'), lapOf: $('hLapOf'),
      cur: $('hCur'), best: $('hBest'), total: $('hTotal'), nitro: $('hNitro'), msg: $('hMsg'),
      sub: $('hSub'), board: $('hBoard'), fps: $('hFps'),
    };
    this.speedo = $('speedo'); this.sctx = this.speedo.getContext('2d');
    this.map = $('minimap'); this.mctx = this.map.getContext('2d');
    this.cache = {};
    this.msgT = 0;
  }

  set(key, el, val) { if (this.cache[key] !== val) { this.cache[key] = val; el.textContent = val; } }

  setTrack(track) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < track.N; i++) {
      minX = Math.min(minX, track.px[i]); maxX = Math.max(maxX, track.px[i]);
      minZ = Math.min(minZ, track.pz[i]); maxZ = Math.max(maxZ, track.pz[i]);
    }
    this.bounds = { minX, maxX, minZ, maxZ };
    this.track = track;
  }

  _mapXY(x, z, W, H) {
    const b = this.bounds, pad = 14;
    const sc = Math.min((W - pad * 2) / (b.maxX - b.minX), (H - pad * 2) / (b.maxZ - b.minZ));
    const ox = (W - (b.maxX - b.minX) * sc) / 2, oy = (H - (b.maxZ - b.minZ) * sc) / 2;
    // mirror x so the map matches the driver's left/right
    return [W - (ox + (x - b.minX) * sc), H - (oy + (z - b.minZ) * sc)];
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [this.speedo, this.map]) {
      const r = c.getBoundingClientRect();
      c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr));
    }
    this.mapBg = null;
  }

  drawMap(cars, player) {
    const c = this.mctx, W = this.map.width, H = this.map.height, T = this.track;
    if (!this.mapBg) {
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      const g = off.getContext('2d');
      g.lineJoin = 'round';
      const path = () => { g.beginPath(); for (let i = 0; i <= T.N; i += 6) { const k = i % T.N; const [x, y] = this._mapXY(T.px[k], T.pz[k], W, H); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = W * 0.07; path(); g.stroke();
      g.strokeStyle = 'rgba(232,236,240,0.9)'; g.lineWidth = W * 0.03; path(); g.stroke();
      const [sx, sy] = this._mapXY(T.px[T.startIdx], T.pz[T.startIdx], W, H);
      g.fillStyle = '#ff4d2e'; g.fillRect(sx - W * 0.03, sy - 2, W * 0.06, 4);
      this.mapBg = off;
    }
    c.clearRect(0, 0, W, H);
    c.drawImage(this.mapBg, 0, 0);
    for (const car of cars) {
      if (car === player) continue;
      const [x, y] = this._mapXY(car.pos.x, car.pos.z, W, H);
      c.fillStyle = '#' + car.m.paint.color.getHexString(); c.strokeStyle = '#000'; c.lineWidth = W * 0.01;
      c.beginPath(); c.arc(x, y, W * 0.028, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    const [x, y] = this._mapXY(player.pos.x, player.pos.z, W, H);
    c.fillStyle = '#ffd400'; c.strokeStyle = '#000'; c.lineWidth = W * 0.012;
    c.beginPath(); c.arc(x, y, W * 0.04, 0, Math.PI * 2); c.fill(); c.stroke();
  }

  drawSpeedo(kmh, rpm, redline, gear, nitroOn) {
    const c = this.sctx, W = this.speedo.width, H = this.speedo.height;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.46;
    c.clearRect(0, 0, W, H);
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    // dial background
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fillStyle = 'rgba(8,10,14,0.62)'; c.fill();
    // rpm arc
    const rf = Math.min(1, rpm / redline);
    c.lineCap = 'butt';
    c.lineWidth = R * 0.09;
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.arc(cx, cy, R * 0.86, a0, a1); c.stroke();
    const redA = a0 + (a1 - a0) * 0.85;
    c.strokeStyle = 'rgba(255,60,40,0.35)'; c.beginPath(); c.arc(cx, cy, R * 0.86, redA, a1); c.stroke();
    c.strokeStyle = rf > 0.85 ? '#ff3b2a' : nitroOn ? '#57b7ff' : '#f2f4f7';
    c.beginPath(); c.arc(cx, cy, R * 0.86, a0, a0 + (a1 - a0) * rf); c.stroke();
    // ticks (×1000 rpm)
    c.fillStyle = 'rgba(255,255,255,0.75)'; c.font = `600 ${R * 0.12}px 'Barlow Semi Condensed', system-ui, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let k = 0; k <= 8; k++) {
      const a = a0 + (a1 - a0) * (k / 8);
      c.fillText(String(k), cx + Math.cos(a) * R * 0.66, cy + Math.sin(a) * R * 0.66);
    }
    // speed
    c.fillStyle = '#fff'; c.font = `700 ${R * 0.5}px 'Chakra Petch', system-ui, sans-serif`;
    c.fillText(String(Math.round(kmh)), cx, cy + R * 0.02);
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.font = `600 ${R * 0.13}px 'Barlow Semi Condensed', system-ui, sans-serif`;
    c.fillText('KM/H', cx, cy + R * 0.34);
    // gear
    c.fillStyle = rf > 0.93 ? '#ff3b2a' : '#ffd400'; c.font = `700 ${R * 0.24}px 'Chakra Petch', sans-serif`;
    c.fillText(gear, cx, cy + R * 0.66);
  }

  message(text, sub = '', dur = 1.5, cls = '') {
    this.el.msg.textContent = text; this.el.sub.textContent = sub;
    this.el.msg.className = 'hmsg show ' + cls; this.el.sub.className = 'hsub show';
    this.msgT = dur;
  }

  clearMessage() { this.msgT = 0; this.el.msg.className = 'hmsg'; this.el.sub.className = 'hsub'; }

  tick(dt) {
    if (this.msgT > 0) {
      this.msgT -= dt;
      if (this.msgT <= 0) { this.el.msg.className = 'hmsg'; this.el.sub.className = 'hsub'; }
    }
  }

  board(list, playerIdx) {
    const key = list.map((c) => c.name).join('|') + playerIdx;
    if (this.cache.board === key) return;
    this.cache.board = key;
    this.el.board.innerHTML = list.slice(0, 6).map((c, i) =>
      `<li class="${c.isPlayer ? 'me' : ''}"><b>${i + 1}</b><i style="background:#${c.m.paint.color.getHexString()}"></i>${c.name}</li>`).join('');
  }
}
