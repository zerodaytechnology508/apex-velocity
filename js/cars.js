// Procedural car models built by lofting body cross-sections along the car.
// Local axes: +z forward, +x = driver's left, +y up. Origin = ground, car centre.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// Model catalogue (all names and designs are original / fictional)
// ---------------------------------------------------------------------------
export const MODELS = [
  {
    id: 'vortex', name: 'Vortex GT', tag: 'Front-engine grand tourer',
    length: 4.6, wheelZ: [1.45, -1.32], wheelR: 0.345, archR: 0.40, trackX: 0.835, tireW: 0.255, archInnerX: 0.6,
    stats: { power: 700, traction: 12.8, drag: 0.00090, grip: 17.6, steer: 0.60, top: 86 },
    body: {
      yb: [[-2.3, 0.42], [-2.15, 0.28], [-1.9, 0.24], [1.95, 0.22], [2.2, 0.27], [2.3, 0.36]],
      ys: [[-2.3, 0.70], [-2.0, 0.83], [-1.32, 0.875], [-0.7, 0.82], [0.3, 0.81], [1.45, 0.845], [2.0, 0.74], [2.3, 0.58]],
      yt: [[-2.3, 0.80], [-2.1, 0.93], [-1.7, 0.95], [-1.3, 0.945], [0.6, 0.925], [1.2, 0.895], [1.8, 0.81], [2.15, 0.71], [2.3, 0.62]],
      w: [[-2.3, 0.80], [-2.05, 0.92], [-1.32, 0.985], [-0.6, 0.93], [0.5, 0.93], [1.45, 0.965], [2.0, 0.9], [2.3, 0.72]],
      nt: 3.0, nb: 6, noseR: 0.24, tailR: 0.14,
    },
    cabin: {
      z0: -1.5, z1: 0.72, n: 2.6, sideA: 0.9, wsZ: 0.16, rwZ: -0.78, bZ: null,
      roof: [[-1.5, 0.94], [-1.15, 1.1], [-0.6, 1.24], [-0.1, 1.285], [0.2, 1.265], [0.45, 1.15], [0.72, 0.91]],
      w: [[-1.5, 0.66], [-1.0, 0.74], [-0.2, 0.77], [0.4, 0.75], [0.72, 0.70]],
      aOff: 0.1, aSlope: 1.6, cOff: 0.42, cSlope: 1.4,
    },
    lights: { head: [1.98, 2.24, 0.16, 0.56], tail: [-2.27, -2.08, 0.18, 0.62], tailBar: true },
    trims: { sideVent: [0.95, 1.2, 0.55, 0.70], diffuser: 0.34 }, grille: [0.30, 0.48, 0.66],
    wing: 'lip', rim: 'tenSpoke', exhaust: 4, scoop: false,
  },
  {
    id: 'kestrel', name: 'Kestrel SV', tag: 'Mid-engine supercar',
    length: 4.5, wheelZ: [1.42, -1.22], wheelR: 0.35, archR: 0.405, trackX: 0.86, tireW: 0.275, archInnerX: 0.62,
    stats: { power: 820, traction: 13.6, drag: 0.00088, grip: 19.2, steer: 0.62, top: 92 },
    body: {
      yb: [[-2.25, 0.40], [-2.05, 0.26], [-1.8, 0.20], [1.9, 0.19], [2.15, 0.22], [2.25, 0.30]],
      ys: [[-2.25, 0.66], [-1.9, 0.86], [-1.22, 0.92], [-0.5, 0.81], [0.3, 0.77], [1.42, 0.80], [1.95, 0.62], [2.25, 0.46]],
      yt: [[-2.25, 0.78], [-2.0, 0.95], [-1.4, 0.96], [-0.6, 0.9], [0.6, 0.855], [1.1, 0.845], [1.7, 0.78], [2.1, 0.62], [2.25, 0.52]],
      w: [[-2.25, 0.86], [-1.9, 0.98], [-1.22, 1.02], [-0.4, 0.96], [0.4, 0.94], [1.42, 0.99], [1.9, 0.92], [2.25, 0.70]],
      nt: 2.6, nb: 6, noseR: 0.28, tailR: 0.12,
    },
    cabin: {
      z0: -0.95, z1: 1.05, n: 2.4, sideA: 0.95, wsZ: 0.32, rwZ: -0.72, bZ: null,
      roof: [[-0.95, 0.91], [-0.6, 1.07], [-0.1, 1.165], [0.25, 1.165], [0.6, 1.05], [1.05, 0.845]],
      w: [[-0.95, 0.62], [-0.4, 0.72], [0.3, 0.74], [1.05, 0.66]],
      aOff: 0.16, aSlope: 2.2, cOff: 0.34, cSlope: 0.7,
    },
    lights: { head: [1.86, 2.18, 0.10, 0.46], tail: [-2.24, -2.1, 0.12, 0.66], tailBar: false },
    trims: { sideIntake: [-0.98, -0.62, 0.46, 0.80], diffuser: 0.36 }, grille: [0.24, 0.38, 0.72],
    wing: 'big', rim: 'fiveY', exhaust: 2, scoop: false,
  },
  {
    id: 'ronin', name: 'Ronin 8', tag: 'V8 muscle coupe',
    length: 4.75, wheelZ: [1.5, -1.35], wheelR: 0.355, archR: 0.41, trackX: 0.84, tireW: 0.275, archInnerX: 0.6,
    stats: { power: 760, traction: 11.2, drag: 0.00104, grip: 15.8, steer: 0.56, top: 82 },
    body: {
      yb: [[-2.375, 0.40], [-2.2, 0.27], [-1.9, 0.24], [2.0, 0.24], [2.3, 0.30], [2.375, 0.38]],
      ys: [[-2.375, 0.78], [-2.1, 0.85], [-1.35, 0.875], [0.0, 0.84], [1.5, 0.875], [2.2, 0.83], [2.375, 0.76]],
      yt: [[-2.375, 0.9], [-2.2, 0.955], [-1.6, 0.97], [-1.2, 0.965], [0.7, 0.955], [1.4, 0.945], [2.2, 0.925], [2.375, 0.87]],
      w: [[-2.375, 0.90], [-2.15, 0.96], [-1.35, 0.99], [0, 0.96], [1.5, 0.98], [2.2, 0.96], [2.375, 0.88]],
      nt: 5, nb: 7, noseR: 0.11, tailR: 0.10,
    },
    cabin: {
      z0: -1.35, z1: 0.6, n: 3.2, sideA: 0.85, wsZ: 0.16, rwZ: -0.95, bZ: -0.52,
      roof: [[-1.35, 0.97], [-1.15, 1.19], [-0.9, 1.33], [-0.2, 1.36], [0.15, 1.33], [0.6, 0.95]],
      w: [[-1.35, 0.72], [-0.6, 0.80], [0.3, 0.80], [0.6, 0.76]],
      aOff: 0.1, aSlope: 1.3, cOff: 0.3, cSlope: 0.9,
    },
    lights: { head: [2.2, 2.37, 0.22, 0.62], tail: [-2.375, -2.3, 0.2, 0.7], tailBar: true },
    trims: { diffuser: 0.32 }, grille: [0.44, 0.76, 1.1],
    wing: 'duck', rim: 'sixBlade', exhaust: 2, scoop: true,
  },
  {
    id: 'atom', name: 'Atom RS', tag: 'Turbo hot hatch',
    length: 4.15, wheelZ: [1.35, -1.25], wheelR: 0.33, archR: 0.38, trackX: 0.79, tireW: 0.235, archInnerX: 0.57,
    stats: { power: 540, traction: 12.2, drag: 0.00110, grip: 18.6, steer: 0.66, top: 72 },
    body: {
      yb: [[-2.075, 0.40], [-1.95, 0.26], [-1.7, 0.22], [1.75, 0.22], [2.0, 0.28], [2.075, 0.36]],
      ys: [[-2.075, 0.82], [-1.8, 0.86], [-1.25, 0.86], [0, 0.82], [1.35, 0.82], [1.9, 0.74], [2.075, 0.62]],
      yt: [[-2.075, 0.96], [-1.9, 0.99], [-1.6, 0.995], [0.5, 0.965], [1.1, 0.94], [1.7, 0.86], [2.0, 0.75], [2.075, 0.68]],
      w: [[-2.075, 0.84], [-1.8, 0.91], [-1.25, 0.935], [0, 0.89], [1.35, 0.92], [1.9, 0.86], [2.075, 0.7]],
      nt: 3, nb: 6, noseR: 0.2, tailR: 0.07,
    },
    cabin: {
      z0: -2.0, z1: 0.55, n: 2.8, sideA: 0.88, wsZ: 0.08, rwZ: -1.45, bZ: -0.5,
      roof: [[-2.0, 1.0], [-1.88, 1.2], [-1.55, 1.37], [-1.1, 1.425], [-0.5, 1.44], [0.05, 1.41], [0.55, 0.96]],
      w: [[-2.0, 0.70], [-1.7, 0.76], [-0.5, 0.79], [0.55, 0.72]],
      aOff: 0.12, aSlope: 1.4, cOff: 0.42, cSlope: 1.1,
    },
    lights: { head: [1.84, 2.05, 0.18, 0.6], tail: [-2.07, -1.96, 0.42, 0.78], tailBar: false },
    trims: { diffuser: 0.34 }, grille: [0.3, 0.5, 0.74],
    wing: 'roof', rim: 'mesh', exhaust: 1, scoop: false,
  },
];
export const modelById = (id) => MODELS.find((m) => m.id === id) || MODELS[0];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function mono(keys) { // monotone cubic interpolation (Fritsch–Carlson)
  const n = keys.length, xs = keys.map((k) => k[0]), ys = keys.map((k) => k[1]);
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const spow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);

// Body surface: angle t from -PI/2 (bottom) → 0 (right side) → PI/2 (top) → PI (left side)
function makeBodySurface(m) {
  const B = m.body, zr = -m.length / 2, zf = m.length / 2;
  const f = { yb: mono(B.yb), ys: mono(B.ys), yt: mono(B.yt), w: mono(B.w) };
  function at(z, t, out) {
    let k = 1;
    if (z > zf - B.noseR) { const u = (z - (zf - B.noseR)) / B.noseR; k = Math.sqrt(Math.max(0.0004, 1 - u * u)); }
    else if (z < zr + B.tailR) { const u = ((zr + B.tailR) - z) / B.tailR; k = Math.sqrt(Math.max(0.0004, 1 - u * u)); }
    const yb = f.yb(z), ys = f.ys(z), yt = f.yt(z), w = f.w(z);
    const c = Math.cos(t), s = Math.sin(t);
    const n = s >= 0 ? B.nt : B.nb;
    let x = -w * spow(c, 2 / n);
    let y = s >= 0 ? ys + (yt - ys) * Math.pow(Math.abs(s), 2 / B.nt) : ys - (ys - yb) * Math.pow(Math.abs(s), 2 / B.nb);
    x *= Math.pow(k, 0.7);
    y = ys + (y - ys) * (0.45 + 0.55 * k);
    out.x = x; out.y = y; out.z = z;
    return out;
  }
  return { at, f, zr, zf };
}

function makeCabinSurface(m, body) {
  const C = m.cabin, roof = mono(C.roof), wg = mono(C.w);
  const base = (z) => body.f.yt(z) - 0.018;
  function at(z, t, out) { // t in [0, PI]: right bottom → top → left bottom
    const yb = base(z), yt = Math.max(yb + 0.002, roof(z)), w = wg(z);
    const c = Math.cos(t), s = Math.max(0, Math.sin(t));
    out.x = -w * spow(c, 2 / C.n);
    out.y = yb + (yt - yb) * Math.pow(s, 2 / C.n);
    out.z = z;
    return out;
  }
  return { at, base, roof, wg };
}

// generic surface patch (lights, trims) following a surface function
function patchGeo(at, z0, z1, t0, t1, off, nz = 10, nt = 12) {
  const pos = [], idx = [], P = { x: 0, y: 0, z: 0 }, A = { x: 0, y: 0, z: 0 }, Bq = { x: 0, y: 0, z: 0 };
  const e = 1e-3;
  for (let i = 0; i <= nz; i++) for (let j = 0; j <= nt; j++) {
    const z = z0 + (z1 - z0) * i / nz, t = t0 + (t1 - t0) * j / nt;
    at(z, t, P);
    at(z + e, t, A); const dzx = A.x - P.x, dzy = A.y - P.y, dzz = A.z - P.z;
    at(z, t + e, Bq); const dtx = Bq.x - P.x, dty = Bq.y - P.y, dtz = Bq.z - P.z;
    let nx = dzy * dtz - dzz * dty, ny = dzz * dtx - dzx * dtz, nz2 = dzx * dty - dzy * dtx;
    const l = Math.hypot(nx, ny, nz2) || 1; nx /= l; ny /= l; nz2 /= l;
    // orient outward (away from car centre line)
    if (nx * P.x + ny * (P.y - 0.6) + nz2 * P.z * 0.2 < 0) { nx = -nx; ny = -ny; nz2 = -nz2; }
    pos.push(P.x + nx * off, P.y + ny * off, P.z + nz2 * off);
  }
  for (let i = 0; i < nz; i++) for (let j = 0; j < nt; j++) {
    const a = i * (nt + 1) + j, b = a + 1, c = a + nt + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// geometry builders (cached per model)
// ---------------------------------------------------------------------------
const CACHE = new Map();
const SHARED_GEO = new WeakSet();

function buildBodyGeo(m, surf) {
  const NZ = 190, NR = 88;
  const pos = new Float32Array((NZ + 1) * NR * 3 + 6), col = new Float32Array((NZ + 1) * NR * 3 + 6);
  const P = { x: 0, y: 0, z: 0 };
  const T = m.trims, B = m.body;
  const wy = m.wheelR, Ra = m.archR;
  let p = 0;
  for (let i = 0; i <= NZ; i++) {
    const z = surf.zr + (surf.zf - surf.zr) * i / NZ;
    const ys = surf.f.ys(z);
    for (let j = 0; j < NR; j++) {
      const t = -Math.PI / 2 + (2 * Math.PI * j) / NR;
      surf.at(z, t, P);
      let { x, y } = P, shade = 1;
      // wheel arches: lift the lower skin around each wheel → wheel wells
      if (Math.sin(t) < 0.05) {
        for (const zw of m.wheelZ) {
          const dz = z - zw;
          if (Math.abs(dz) < Ra && Math.abs(x) > m.archInnerX) {
            const ya = Math.min(ys - 0.015, wy + Math.sqrt(Ra * Ra - dz * dz));
            if (y < ya) { y = ya; shade = 0.035; }
          }
        }
      }
      // dark trims (sills, grille, diffuser, vents)
      if (shade === 1) {
        const ax = Math.abs(x), half = surf.f.w(z);
        if (y < 0.31 && ax > half * 0.72) shade = 0.05; // side sills
        if (T.diffuser && z < surf.zr + 0.32 && y < T.diffuser) shade = 0.05;
        if (T.grille && z > surf.zf - 0.05 && y > T.grille[0] && y < T.grille[1] && ax < T.grille[2]) shade = 0.04;
        if (T.grilleFace && z > surf.zf - 0.07 && y > T.grilleFace[0] && y < T.grilleFace[1] && ax < T.grilleFace[2]) shade = 0.04;
        if (z > surf.zf - 0.16 && y < 0.31) shade = 0.05; // front splitter area
        if (T.sideIntake && z > T.sideIntake[0] && z < T.sideIntake[1] && y > T.sideIntake[2] && y < T.sideIntake[3] && ax > half * 0.86) {
          const u = (z - T.sideIntake[0]) / (T.sideIntake[1] - T.sideIntake[0]);
          if (y < T.sideIntake[3] - (1 - u) * 0.16) shade = 0.03;
        }
        if (T.sideVent && z > T.sideVent[0] && z < T.sideVent[1] && y > T.sideVent[2] && y < T.sideVent[3] && ax > half * 0.93) shade = 0.05;
      }
      pos[p] = x; pos[p + 1] = y; pos[p + 2] = z;
      col[p] = col[p + 1] = col[p + 2] = shade;
      p += 3;
    }
  }
  // end-cap centres
  const capR = p / 3; surf.at(surf.zr + 0.0005, 0, P); pos[p] = 0; pos[p + 1] = surf.f.ys(surf.zr); pos[p + 2] = surf.zr; col[p] = col[p + 1] = col[p + 2] = 0.05; p += 3;
  const capF = p / 3; pos[p] = 0; pos[p + 1] = surf.f.ys(surf.zf); pos[p + 2] = surf.zf; col[p] = col[p + 1] = col[p + 2] = 0.05;
  const idx = [];
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NR; j++) {
    const a = i * NR + j, b = i * NR + ((j + 1) % NR), c = a + NR, d = b + NR;
    idx.push(a, c, b, b, c, d);
  }
  for (let j = 0; j < NR; j++) {
    idx.push(capR, j, (j + 1) % NR);
    const o = NZ * NR; idx.push(capF, o + ((j + 1) % NR), o + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildCabinGeo(m, cab) {
  const C = m.cabin, NZ = 150, NR = 84;
  const pos = [], P = { x: 0, y: 0, z: 0 };
  const zs = [];
  for (let i = 0; i <= NZ; i++) {
    const z = C.z0 + (C.z1 - C.z0) * i / NZ; zs.push(z);
    for (let j = 0; j <= NR; j++) { cab.at(z, (Math.PI * j) / NR, P); pos.push(P.x, P.y, P.z); }
  }
  const glass = [], paint = [];
  const isGlass = (z, t) => {
    const base = cab.base(z);
    cab.at(z, t, P); const y = P.y;
    const side = t < C.sideA || t > Math.PI - C.sideA;
    if (side) {
      if (t < 0.07 || t > Math.PI - 0.07) return false;
      const front = C.z1 - C.aOff - (y - base) * C.aSlope;
      const rear = C.z0 + C.cOff + (y - base) * C.cSlope;
      if (z > front || z < rear) return false;
      if (C.bZ !== null && Math.abs(z - C.bZ) < 0.04) return false;
      return true;
    }
    const m2 = 0.08;
    if (t < C.sideA + m2 || t > Math.PI - C.sideA - m2) return false;
    return z > C.wsZ || z < C.rwZ;
  };
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NR; j++) {
    const a = i * (NR + 1) + j, b = a + 1, c = a + NR + 1, d = c + 1;
    const zc = (zs[i] + zs[i + 1]) / 2, tc = (Math.PI * (j + 0.5)) / NR;
    (isGlass(zc, tc) ? glass : paint).push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex([...glass, ...paint]);
  g.addGroup(0, glass.length, 0);
  g.addGroup(glass.length, paint.length, 1);
  g.computeVertexNormals();
  return g;
}

function buildWheelGeos(m) {
  const R = m.wheelR, W = m.tireW, rimR = R * 0.69;
  const G = {};
  const prof = [[rimR, -W * 0.48], [R * 0.87, -W * 0.52], [R * 0.95, -W * 0.48], [R * 0.995, -W * 0.33], [R, 0], [R * 0.995, W * 0.33], [R * 0.95, W * 0.48], [R * 0.87, W * 0.52], [rimR, W * 0.48]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  G.tire = new THREE.LatheGeometry(prof, 48).rotateZ(Math.PI / 2);
  G.barrel = new THREE.CylinderGeometry(rimR, rimR, W * 0.92, 36, 1, true).rotateZ(Math.PI / 2);
  const parts = [];
  const face = W * 0.42;
  const lip = new THREE.TorusGeometry(rimR - 0.01, 0.012, 8, 48).rotateY(Math.PI / 2).translate(face, 0, 0); parts.push(lip);
  const hub = new THREE.CylinderGeometry(0.055, 0.065, 0.05, 20).rotateZ(Math.PI / 2).translate(face - 0.01, 0, 0); parts.push(hub);
  const spoke = (len, wid, dep, ang, tilt = 0, r0 = 0.05) => {
    const b = new THREE.BoxGeometry(dep, len, wid); b.translate(face - 0.015 - Math.abs(tilt), r0 + len / 2, 0);
    if (tilt) b.rotateZ(0);
    b.rotateX(ang); parts.push(b);
  };
  const L = rimR - 0.06;
  if (m.rim === 'tenSpoke') for (let k = 0; k < 10; k++) spoke(L, 0.028, 0.03, (k / 10) * Math.PI * 2 + (k % 2) * 0.13);
  else if (m.rim === 'fiveY') for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; spoke(L * 0.55, 0.05, 0.035, a); spoke(L * 0.52, 0.026, 0.03, a + 0.2, 0, 0.05 + L * 0.48); spoke(L * 0.52, 0.026, 0.03, a - 0.2, 0, 0.05 + L * 0.48); }
  else if (m.rim === 'sixBlade') for (let k = 0; k < 6; k++) { spoke(L, 0.07, 0.025, (k / 6) * Math.PI * 2); }
  else { // mesh
    for (let k = 0; k < 14; k++) spoke(L, 0.016, 0.025, (k / 14) * Math.PI * 2);
    const ring = new THREE.TorusGeometry(rimR * 0.62, 0.01, 6, 40).rotateY(Math.PI / 2).translate(face - 0.015, 0, 0); parts.push(ring);
  }
  parts.forEach((g) => { g.deleteAttribute('uv'); });
  G.rim = mergeGeometries(parts.map((g) => g.index ? g.toNonIndexed() : g));
  G.disc = new THREE.CylinderGeometry(rimR * 0.82, rimR * 0.82, 0.028, 32).rotateZ(Math.PI / 2).translate(W * 0.05, 0, 0);
  G.caliper = new THREE.BoxGeometry(0.075, rimR * 0.62, 0.12).translate(W * 0.14, rimR * 0.52, -0.08);
  return G;
}

function getGeos(m) {
  if (CACHE.has(m.id)) return CACHE.get(m.id);
  const body = makeBodySurface(m);
  const cab = makeCabinSurface(m, body);
  const L = m.lights;
  const G = {
    surf: body, cab,
    body: buildBodyGeo(m, body),
    cabin: buildCabinGeo(m, cab),
    wheel: buildWheelGeos(m),
  };
  // headlights: dark glossy housing + LED signature + projector
  const head = [], led = [], tail = [];
  for (const side of [1, -1]) {
    const tt = (a) => (side > 0 ? a : Math.PI - a);
    const [z0, z1, a0, a1] = L.head;
    head.push(patchGeo(body.at, z0, z1, Math.min(tt(a0), tt(a1)), Math.max(tt(a0), tt(a1)), 0.006, 14, 10));
    const am = (a0 + a1) / 2;
    led.push(patchGeo(body.at, z0 + (z1 - z0) * 0.15, z1 - (z1 - z0) * 0.05, Math.min(tt(a1 - 0.03), tt(a1 - 0.07)), Math.max(tt(a1 - 0.03), tt(a1 - 0.07)), 0.009, 10, 2));
    led.push(patchGeo(body.at, z0 + (z1 - z0) * 0.55, z1 - (z1 - z0) * 0.15, Math.min(tt(am - 0.06), tt(am + 0.04)), Math.max(tt(am - 0.06), tt(am + 0.04)), 0.010, 6, 4));
    const [r0, r1, b0, b1] = L.tail;
    tail.push(patchGeo(body.at, r0, r1, Math.min(tt(b0), tt(b1)), Math.max(tt(b0), tt(b1)), 0.006, 8, 10));
  }
  if (L.tailBar) { const zr0 = -m.length / 2; tail.push(patchGeo(body.at, zr0 + 0.035, zr0 + 0.07, L.tail[3] - 0.05, Math.PI - L.tail[3] + 0.05, 0.006, 3, 18)); }
  G.head = mergeGeometries(head); G.led = mergeGeometries(led); G.tail = mergeGeometries(tail);
  // door shut-lines and handles
  const lines = [], handles = [];
  const C = m.cabin;
  const doorF = C.z1 - 0.05, doorR = C.bZ !== null ? C.bZ - 0.05 : C.z0 + C.cOff + 0.15;
  for (const side of [1, -1]) {
    const ta = side > 0 ? -0.55 : Math.PI - 0.5, tb = side > 0 ? 0.5 : Math.PI + 0.55;
    lines.push(patchGeo(body.at, doorF, doorF + 0.007, ta, tb, 0.002, 1, 10));
    lines.push(patchGeo(body.at, doorR, doorR + 0.007, ta, tb, 0.002, 1, 10));
    const th = side > 0 ? 0.32 : Math.PI - 0.38;
    handles.push(patchGeo(body.at, doorR + 0.12, doorR + 0.3, th, th + 0.06, 0.006, 3, 2));
  }
  G.lines = mergeGeometries(lines); G.handles = mergeGeometries(handles);
  // window seals along the slanted A/C-pillar edges (hide the stair-step of the window mask)
  const seals = [], Q = { x: 0, y: 0, z: 0 };
  for (const side of [1, -1]) for (const edge of ['front', 'rear']) {
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const t0 = 0.07 + (C.sideA - 0.07) * k / 24, t = side > 0 ? t0 : Math.PI - t0;
      let z = edge === 'front' ? C.z1 - C.aOff : C.z0 + C.cOff;
      for (let it = 0; it < 6; it++) {
        cab.at(z, t, Q); const yb = cab.base(z);
        z = edge === 'front' ? C.z1 - C.aOff - (Q.y - yb) * C.aSlope : C.z0 + C.cOff + (Q.y - yb) * C.cSlope;
      }
      cab.at(z, t, Q); pts.push(new THREE.Vector3(Q.x, Q.y + 0.002, Q.z));
    }
    seals.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.026, 8, false));
  }
  G.seals = mergeGeometries(seals);
  for (const v of Object.values(G)) if (v && v.isBufferGeometry) SHARED_GEO.add(v);
  for (const v of Object.values(G.wheel)) SHARED_GEO.add(v);
  CACHE.set(m.id, G);
  return G;
}

// ---------------------------------------------------------------------------
// shared materials (paint is per car)
// ---------------------------------------------------------------------------
let ENV = null;
export function setCarEnvironment(tex) { ENV = tex; MAT = null; }
let MAT = null;
function sharedMats() {
  if (MAT) return MAT;
  const e = (o) => Object.assign(o, ENV ? { envMap: ENV } : {});
  MAT = {
    glass: new THREE.MeshPhysicalMaterial(e({ color: 0x0a0e14, metalness: 0.1, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 1.6 })),
    glassIn: new THREE.MeshBasicMaterial({ color: 0x9ab0c8, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }),
    interior: new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.85, side: THREE.DoubleSide }),
    leather: new THREE.MeshStandardMaterial({ color: 0x24201d, roughness: 0.7 }),
    alcantara: new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 1 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.5, metalness: 0.3 }),
    carbon: new THREE.MeshPhysicalMaterial(e({ color: 0x16181c, roughness: 0.4, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 })),
    chrome: new THREE.MeshStandardMaterial(e({ color: 0xdfe3e8, metalness: 1, roughness: 0.12, envMapIntensity: 1.4 })),
    lampHouse: new THREE.MeshPhysicalMaterial(e({ color: 0x07080a, metalness: 0.6, roughness: 0.15, clearcoat: 1, envMapIntensity: 1.5 })),
    tire: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial(e({ color: 0xa9afb7, metalness: 1, roughness: 0.2, envMapIntensity: 1.3 })),
    rimDark: new THREE.MeshStandardMaterial(e({ color: 0x2a2d33, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.2 })),
    barrel: new THREE.MeshStandardMaterial({ color: 0x24272c, metalness: 0.8, roughness: 0.45 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x6e7176, metalness: 0.9, roughness: 0.38 }),
    shut: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    grille: new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.45, metalness: 0.5 }),
  };
  return MAT;
}

let BLOB = null, PLATE = null;
export function setCarTextures({ blob, plate }) { BLOB = blob; PLATE = plate; }

const CALIPER = [0xd4141a, 0xf2b705, 0x1d6fd8, 0x111111];

// ---------------------------------------------------------------------------
export function buildCar(modelId, paintHex, opts = {}) {
  const m = modelById(modelId);
  const G = getGeos(m), M = sharedMats();
  const car = new THREE.Group(), body = new THREE.Group();
  car.add(body);
  const paint = new THREE.MeshPhysicalMaterial({
    color: paintHex, vertexColors: true, metalness: 0.45, roughness: 0.28,
    clearcoat: 1, clearcoatRoughness: 0.025, envMapIntensity: 1.5, ...(ENV ? { envMap: ENV } : {}),
  });
  const paintPlain = paint.clone(); paintPlain.vertexColors = false;
  const headM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeef4ff, emissiveIntensity: 3, roughness: 0.2 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a10, emissiveIntensity: 1.2, roughness: 0.25 });
  const exterior = [];
  const add = (geo, mat, parent = body, shadow = true, ext = true) => {
    const o = new THREE.Mesh(geo, mat); o.castShadow = shadow; o.receiveShadow = shadow; parent.add(o);
    if (ext) exterior.push(o); return o;
  };

  add(G.body, paint);
  const cabin = add(G.cabin, [M.glass, paintPlain]);
  add(G.head, M.lampHouse, body, false);
  add(G.led, headM, body, false);
  add(G.tail, tailM, body, false);
  add(G.lines, M.shut, body, false);
  add(G.handles, M.chrome, body, false);
  add(G.seals, M.black, body, false);

  // chassis tub (fills the space between the wheel wells)
  const zr = -m.length / 2, zf = m.length / 2;
  add(new THREE.BoxGeometry(m.archInnerX * 2, 0.36, m.length - 0.8).translate(0, 0.42, 0), M.black, body, false);

  // front grille / intake
  if (m.grille) {
    const [g0, g1, gw] = m.grille, gm = new THREE.Mesh(new THREE.BoxGeometry(gw, g1 - g0, 0.3).translate(0, 0, -0.15), M.grille);
    gm.position.set(0, (g0 + g1) / 2, zf + 0.004); body.add(gm); exterior.push(gm);
    const lipC = add(new THREE.BoxGeometry(gw + 0.04, 0.018, 0.04), M.chrome, body, false); lipC.position.set(0, g1 + 0.004, zf - 0.03);
  }
  // mirrors
  const C = m.cabin, P = { x: 0, y: 0, z: 0 };
  for (const s of [1, -1]) {
    const zm = C.z1 - 0.18;
    G.cab.at(zm, s > 0 ? Math.PI - 0.05 : 0.05, P);
    const housing = add(new THREE.SphereGeometry(0.075, 16, 10).scale(1.0, 0.62, 1.25), paintPlain);
    housing.position.set(P.x + s * 0.14, P.y + 0.05, zm); housing.rotation.y = s * 0.12;
    const stalk = add(new THREE.BoxGeometry(0.12, 0.02, 0.05), M.black, body, false);
    stalk.position.set(P.x + s * 0.07, P.y + 0.035, zm);
    const glassM = add(new THREE.PlaneGeometry(0.11, 0.065), M.chrome, body, false);
    glassM.position.set(P.x + s * 0.14, P.y + 0.05, zm - 0.085); glassM.rotation.y = Math.PI;
  }

  // license plates (fictional)
  if (PLATE) {
    const plateM = new THREE.MeshStandardMaterial({ map: PLATE, roughness: 0.5 });
    const pr = add(new THREE.PlaneGeometry(0.52, 0.115), plateM, body, false);
    G.surf.at(zr + 0.01, -0.25, P);
    pr.position.set(0, Math.max(0.42, P.y + 0.06), zr - 0.02); pr.rotation.y = Math.PI;
  }

  // exhausts
  const exN = m.exhaust, exGeo = new THREE.CylinderGeometry(0.048, 0.044, 0.14, 20, 1, true).rotateX(Math.PI / 2);
  const exPos = exN === 4 ? [-0.52, -0.38, 0.38, 0.52] : exN === 2 ? (m.id === 'kestrel' ? [-0.09, 0.09] : [-0.5, 0.5]) : [0.0];
  const exY = m.id === 'kestrel' ? 0.52 : 0.31;
  const flames = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flameGeo = new THREE.ConeGeometry(0.06, 0.7, 12).rotateX(-Math.PI / 2).translate(0, 0, -0.35);
  for (const x of exPos) {
    const e = add(exGeo, M.chrome, body, false); e.position.set(x, exY, zr + 0.02);
    const inner = add(new THREE.CircleGeometry(0.04, 16), M.shut, body, false); inner.position.set(x, exY, zr - 0.045); inner.rotation.y = Math.PI;
    const f = new THREE.Mesh(flameGeo, flameMat); f.position.set(x, exY, zr - 0.06); f.visible = false; body.add(f); flames.push(f);
  }

  // wings / spoilers
  const deckY = G.surf.f.yt(zr + 0.3);
  if (m.wing === 'big') {
    add(new THREE.BoxGeometry(1.86, 0.035, 0.36), M.carbon).position.set(0, deckY + 0.34, zr + 0.28);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.035, 0.34, 0.14), M.carbon).position.set(s * 0.55, deckY + 0.17, zr + 0.3);
      add(new THREE.BoxGeometry(0.015, 0.16, 0.4), M.carbon).position.set(s * 0.93, deckY + 0.36, zr + 0.28);
    }
  } else if (m.wing === 'lip') {
    add(new THREE.BoxGeometry(1.3, 0.025, 0.12), M.carbon).position.set(0, G.surf.f.yt(zr + 0.15) + 0.02, zr + 0.12);
  } else if (m.wing === 'duck') {
    const d = add(new THREE.BoxGeometry(1.55, 0.05, 0.16), paintPlain); d.position.set(0, G.surf.f.yt(zr + 0.1) + 0.03, zr + 0.1); d.rotation.x = 0.25;
  } else if (m.wing === 'roof') {
    const ry = G.cab.roof(C.z0 + 0.16);
    const r = add(new THREE.BoxGeometry(1.25, 0.04, 0.3), M.carbon); r.position.set(0, ry + 0.01, C.z0 + 0.05); r.rotation.x = -0.12;
  }
  if (m.scoop) {
    const sc = add(new THREE.BoxGeometry(0.6, 0.07, 0.75), paintPlain); sc.position.set(0, G.surf.f.yt(1.1) + 0.02, 1.1);
    add(new THREE.BoxGeometry(0.5, 0.05, 0.02), M.shut, body, false).position.set(0, G.surf.f.yt(1.1) + 0.03, 1.47);
  }

  // contact shadow
  if (BLOB) {
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(m.archInnerX * 2 + 1.4, m.length + 0.6), new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; blob.renderOrder = 2; car.add(blob);
  }

  // wheels
  const rimMat = opts.darkRims ? M.rimDark : M.rim;
  const calM = new THREE.MeshStandardMaterial({ color: CALIPER[(opts.caliper ?? 0) % CALIPER.length], roughness: 0.4, metalness: 0.2 });
  const wheels = [];
  for (const [x, z, front] of [[m.trackX, m.wheelZ[0], true], [-m.trackX, m.wheelZ[0], true], [m.trackX, m.wheelZ[1], false], [-m.trackX, m.wheelZ[1], false]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, m.wheelR, z); car.add(pivot);
    const side = new THREE.Group(); side.scale.x = Math.sign(x); pivot.add(side);
    const spin = new THREE.Group(); side.add(spin);
    add(G.wheel.tire, M.tire, spin);
    add(G.wheel.barrel, M.barrel, spin, false);
    add(G.wheel.rim, rimMat, spin);
    add(G.wheel.disc, M.disc, spin, false);
    add(G.wheel.caliper, calM, side, false);
    wheels.push({ pivot, spin, front });
  }

  // ---------------- cockpit (only visible in interior view) ----------------
  const cockpit = new THREE.Group(); cockpit.visible = false; body.add(cockpit);
  const zEye = C.z1 - 1.0, belt = G.cab.base(zEye);
  const eye = new THREE.Vector3(0.37, Math.min(G.cab.roof(zEye) - 0.13, belt + 0.24), zEye);
  const halfIn = G.cab.wg(C.z1 - 0.3) - 0.04;
  const wheelZ = eye.z + 0.5, gaugeZ = wheelZ + 0.12;
  const dashZ = gaugeZ + 0.3, dashY = G.cab.base(C.z1 - 0.1) + 0.035;
  const dash = new THREE.Mesh(new THREE.BoxGeometry(halfIn * 2, 0.16, 0.6).translate(0, -0.06, 0), M.alcantara);
  dash.position.set(0, dashY, dashZ); cockpit.add(dash);
  const binn = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.16), M.alcantara);
  binn.position.set(eye.x, dashY + 0.03, gaugeZ + 0.081); cockpit.add(binn);
  const dashCanvas = document.createElement('canvas'); dashCanvas.width = 512; dashCanvas.height = 192;
  const dashTex = new THREE.CanvasTexture(dashCanvas); dashTex.colorSpace = THREE.SRGBColorSpace;
  const gauge = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.135), new THREE.MeshBasicMaterial({ map: dashTex, toneMapped: false }));
  gauge.position.set(eye.x, dashY + 0.035, gaugeZ); gauge.rotation.set(-0.2, Math.PI, 0); gauge.scale.setScalar(0.85); cockpit.add(gauge);
  for (const s of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, C.z1 - C.z0 - 0.4), M.leather);
    door.position.set(s * (halfIn + 0.02), belt - 0.16, (C.z0 + C.z1) / 2); cockpit.add(door);
  }
  let floorY = 0; for (let k = 0; k <= 10; k++) floorY = Math.max(floorY, G.cab.base(zEye + (dashZ - zEye) * k / 10));
  const fz0 = zEye - 0.6, fz1 = dashZ;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(G.surf.f.w(zEye) * 1.9, fz1 - fz0).rotateX(-Math.PI / 2), M.leather);
  floor.position.set(0, floorY + 0.03, (fz0 + fz1) / 2); cockpit.add(floor);
  const consoleB = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.9), M.carbon);
  consoleB.position.set(0, belt - 0.22, dashZ - 0.6); cockpit.add(consoleB);
  // rear-view mirror
  const rv = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.05, 0.02), M.black);
  rv.position.set(0, G.cab.roof(C.z1 - 0.42) - 0.04, C.z1 - 0.42); cockpit.add(rv);
  const rvg = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.038), M.chrome);
  rvg.position.set(0, rv.position.y, rv.position.z - 0.011); rvg.rotation.y = Math.PI; cockpit.add(rvg);
  // steering wheel
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(eye.x, eye.y - 0.215, wheelZ);
  wheelGroup.rotation.x = -0.45; // tilt toward the driver
  const steerRot = new THREE.Group(); wheelGroup.add(steerRot);
  const rimW = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.021, 12, 48), M.alcantara); steerRot.add(rimW);
  const flat = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.05), M.alcantara); flat.position.y = -0.165; steerRot.add(flat);
  const hubS = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.04, 24).rotateX(Math.PI / 2), M.carbon); steerRot.add(hubS);
  for (const a of [0, Math.PI, -Math.PI / 2]) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.02), M.carbon);
    sp.position.set(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0); sp.rotation.z = a; steerRot.add(sp);
  }
  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.045), new THREE.MeshBasicMaterial({ color: 0xffc81f }));
  marker.position.set(0, 0.176, 0); steerRot.add(marker);
  const glove = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.8 });
  for (const s of [-1, 1]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12).scale(1, 1.3, 1), glove);
    hand.position.set(s * 0.175, 0.015, 0.02); steerRot.add(hand);
  }
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.16, 12).rotateX(Math.PI / 2), M.black);
  col.position.set(0, 0, 0.1); wheelGroup.add(col);
  cockpit.add(wheelGroup);

  return {
    model: m, group: car, body, wheels, tailM, headM, flames, paint, paintPlain, cabin, exterior, cockpit,
    eye, steerRot, dashCanvas, dashTex, M,
    setInterior(on) {
      cockpit.visible = on;
      cabin.material = on ? [M.glassIn, M.interior] : [M.glass, paintPlain];
      for (const w of wheels) w.pivot.visible = !on;
    },
  };
}

export function disposeCar(c) {
  c.group.traverse((o) => { if (o.geometry && !SHARED_GEO.has(o.geometry)) o.geometry.dispose(); });
  c.paint.dispose(); c.paintPlain.dispose(); c.tailM.dispose(); c.headM.dispose(); c.dashTex.dispose();
}
