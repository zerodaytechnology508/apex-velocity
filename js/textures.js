// Procedural textures (generated at load — no image downloads needed).
import * as THREE from 'three';

export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D value noise + fBm
export function makeNoise(seed = 1) {
  const r = rng(seed);
  const perm = new Uint16Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256);
  for (let i = 0; i < 256; i++) val[i] = r() * 2 - 1;
  const h = (x, y) => val[perm[(perm[x & 255] + y) & 511] & 255];
  const s = (t) => t * t * (3 - 2 * t);
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi, u = s(xf), v = s(yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  n2.fbm = (x, y, oct = 4) => {
    let a = 0.5, f = 1, sum = 0;
    for (let i = 0; i < oct; i++) { sum += a * n2(x * f, y * f); f *= 2.03; a *= 0.5; }
    return sum;
  };
  return n2;
}

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}

function normalFromHeight(hgt, w, h, strength) {
  const [c, g] = canvas(w, h);
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = hgt[y * w + ((x - 1 + w) % w)], r = hgt[y * w + ((x + 1) % w)];
    const u = hgt[((y - 1 + h) % h) * w + x], d = hgt[((y + 1) % h) * w + x];
    let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * w + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return toTex(c, { srgb: false });
}

export function buildTextures(maxAniso = 8) {
  const T = {};
  const N = makeNoise(7);
  const R = rng(42);

  // ---------- Asphalt (u across 16 m road, v along 24 m) ----------
  {
    const w = 512, h = 768;
    const [c, g] = canvas(w, h);
    const [rc, rg] = canvas(w, h);
    const img = g.createImageData(w, h), rimg = rg.createImageData(w, h);
    const hgt = new Float32Array(w * h);
    const patches = [];
    for (let i = 0; i < 5; i++) patches.push({ x: R() * w * 0.8, y: R() * h, w: 40 + R() * 120, h: 30 + R() * 90, d: -6 - R() * 6 });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w;
      const grain = (R() - 0.5);
      const mid = N.fbm(x / 60, y / 60, 4);
      const big = N(x / 220 + 10, y / 220);
      let v = 62 + grain * 26 + mid * 14 + big * 6;
      // rubbered racing line / wheel tracks
      const wear = Math.exp(-Math.pow((u - 0.33) / 0.07, 2)) + Math.exp(-Math.pow((u - 0.67) / 0.07, 2));
      v -= wear * 9;
      for (const p of patches) if (x > p.x && x < p.x + p.w && ((y - p.y + h) % h) < p.h) v += p.d;
      // stone chips
      if (R() < 0.012) v += 30 * R();
      let rough = 225 - wear * 30 + grain * 20;
      // white edge lines (worn)
      const inLine = (u > 0.022 && u < 0.043) || (u > 0.957 && u < 0.978);
      if (inLine && N(x / 6, y / 6) > -0.55) { v = 205 + grain * 30 + mid * 10; rough = 170; }
      v = Math.max(0, Math.min(255, v));
      const i = (y * w + x) * 4;
      img.data[i] = v; img.data[i + 1] = v * 1.01; img.data[i + 2] = v * 1.05; img.data[i + 3] = 255;
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = Math.max(0, Math.min(255, rough)); rimg.data[i + 3] = 255;
      hgt[y * w + x] = grain * 0.8 + mid * 0.6;
    }
    g.putImageData(img, 0, 0); rg.putImageData(rimg, 0, 0);
    T.asphalt = toTex(c);
    T.asphaltRough = toTex(rc, { srgb: false });
    T.asphaltNormal = normalFromHeight(hgt, w, h, 2.2);
    T.asphaltLen = 24;
  }

  // ---------- Grass ----------
  {
    const w = 512, h = 512;
    const [c, g] = canvas(w, h);
    const img = g.createImageData(w, h);
    const hgt = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = N.fbm(x / 40, y / 40, 4), f = R() - 0.5;
      const k = 0.78 + n * 0.35 + f * 0.28;
      const i = (y * w + x) * 4;
      img.data[i] = 66 * k + (n > 0.2 ? 10 : 0); img.data[i + 1] = 96 * k; img.data[i + 2] = 38 * k; img.data[i + 3] = 255;
      hgt[y * w + x] = f + n;
    }
    g.putImageData(img, 0, 0);
    // blades
    for (let i = 0; i < 6000; i++) {
      const x = R() * w, y = R() * h, l = 3 + R() * 5;
      g.strokeStyle = `rgba(${90 + R() * 50},${120 + R() * 50},${40 + R() * 30},0.35)`;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 2, y - l); g.stroke();
    }
    T.grass = toTex(c);
    T.grassNormal = normalFromHeight(hgt, w, h, 1.2);
  }

  // ---------- Curb (red / white, v along: 1 tile = 2 m) ----------
  {
    const [c, g] = canvas(128, 256);
    g.fillStyle = '#c8211b'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#ececec'; g.fillRect(0, 128, 128, 128);
    const grd = g.createLinearGradient(0, 0, 128, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0.25)'); grd.addColorStop(0.15, 'rgba(0,0,0,0)'); grd.addColorStop(0.85, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.12})`; g.fillRect(R() * 128, R() * 256, 2, 2); }
    T.curb = toTex(c);
  }

  // ---------- Armco barrier (u along 4 m, v up 0..1.1 m) ----------
  {
    const [c, g] = canvas(256, 128);
    g.clearRect(0, 0, 256, 128);
    // band occupies 0.45..0.85 m of 1.1 m → rows from top
    const top = Math.round(128 * (1 - 0.85 / 1.1)), bot = Math.round(128 * (1 - 0.45 / 1.1));
    for (let y = top; y < bot; y++) {
      const t = (y - top) / (bot - top);
      const ridge = Math.sin(t * Math.PI * 3);
      const v = 150 + ridge * 45;
      g.fillStyle = `rgb(${v},${v + 4},${v + 8})`; g.fillRect(0, y, 256, 1);
    }
    for (let x = 16; x < 256; x += 64) { g.fillStyle = '#555a60'; g.beginPath(); g.arc(x, (top + bot) / 2, 3, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(80,60,40,${R() * 0.15})`; g.fillRect(R() * 256, top + R() * (bot - top), 3, 2); }
    T.armco = toTex(c);
  }

  // ---------- Crowd ----------
  {
    const [c, g] = canvas(512, 128);
    g.fillStyle = '#3a3f47'; g.fillRect(0, 0, 512, 128);
    const shirts = ['#d33', '#e7e7e7', '#246', '#fc0', '#2a5', '#f60', '#111', '#36c', '#a2c', '#fff'];
    const skins = ['#f1c7a3', '#d9a07a', '#a86b48', '#6b4329', '#e8b98f'];
    for (let x = 4; x < 512; x += 9 + R() * 4) {
      if (R() < 0.12) continue;
      const y = 70 + R() * 10;
      g.fillStyle = shirts[(R() * shirts.length) | 0]; g.fillRect(x - 4, y, 9, 40);
      g.fillStyle = skins[(R() * skins.length) | 0]; g.beginPath(); g.arc(x + 0.5, y - 6, 5, 0, Math.PI * 2); g.fill();
      if (R() < 0.25) { g.fillStyle = shirts[(R() * shirts.length) | 0]; g.fillRect(x - 5, y - 14, 11, 4); }
      if (R() < 0.08) { g.fillStyle = shirts[(R() * shirts.length) | 0]; g.fillRect(x - 2, y - 40, 14, 10); }
    }
    T.crowd = toTex(c);
  }

  // ---------- Start / finish banner ----------
  {
    const [c, g] = canvas(1024, 128);
    const grd = g.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, '#1b1f27'); grd.addColorStop(1, '#0c0e12');
    g.fillStyle = grd; g.fillRect(0, 0, 1024, 128);
    g.fillStyle = '#e8371f'; g.fillRect(0, 0, 1024, 10); g.fillRect(0, 118, 1024, 10);
    g.font = '900 64px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffffff'; g.fillText('START  ·  FINISH', 512, 66);
    T.banner = toTex(c, { repeat: false });
  }

  // ---------- Checkered line ----------
  {
    const [c, g] = canvas(256, 32);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#eee'; g.fillRect(x * 16, y * 16, 16, 16); }
    T.checker = toTex(c, { repeat: false });
  }

  // ---------- Soft contact shadow ----------
  {
    const [c, g] = canvas(128, 256);
    const grd = g.createRadialGradient(64, 128, 10, 64, 128, 128);
    grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 256);
    T.blob = toTex(c, { repeat: false });
  }

  for (const k of Object.keys(T)) if (T[k] && T[k].isTexture) T[k].anisotropy = maxAniso;
  return T;
}
