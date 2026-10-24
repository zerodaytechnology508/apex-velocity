// Circuit geometry, track queries, scenery and terrain.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeNoise, rng } from './textures.js';

// Circuit control points [x, y(elevation), z] — ~2.7 km closed loop
const CTRL = [
  [0, 0, -350], [0, 1.5, 0], [0, 3, 300], [60, 5, 420], [200, 9, 455], [320, 13, 385],
  [365, 12, 250], [300, 8, 150], [360, 6, 40], [480, 10, -40], [525, 16, -200],
  [440, 20, -330], [300, 14, -365], [220, 8, -260], [140, 4, -385], [60, 1, -470],
];

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Track {
  constructor() {
    const pts = CTRL.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const N = (this.N = 2400);
    const sp = curve.getSpacedPoints(N);
    this.length = curve.getLength();
    this.ds = this.length / N;
    this.halfW = 8;
    this.wallOff = this.halfW + 7.6;

    const px = (this.px = new Float32Array(N)), py = (this.py = new Float32Array(N)), pz = (this.pz = new Float32Array(N));
    for (let i = 0; i < N; i++) { px[i] = sp[i].x; py[i] = sp[i].y; pz[i] = sp[i].z; }
    // smooth elevation so the road has no kinks
    for (let pass = 0; pass < 3; pass++) {
      const c = py.slice();
      for (let i = 0; i < N; i++) { let s = 0; for (let k = -12; k <= 12; k++) s += c[(i + k + N) % N]; py[i] = s / 25; }
    }
    const tx = (this.tx = new Float32Array(N)), tz = (this.tz = new Float32Array(N));
    const rx = (this.rx = new Float32Array(N)), rz = (this.rz = new Float32Array(N));
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N, b = (i + 1) % N;
      let x = px[b] - px[a], z = pz[b] - pz[a]; const l = Math.hypot(x, z); x /= l; z /= l;
      tx[i] = x; tz[i] = z; rx[i] = -z; rz[i] = x; // right = tangent × up
    }
    // signed curvature (positive = turning right)
    const ks = new Float32Array(N), w = 3;
    for (let i = 0; i < N; i++) {
      const a = (i - w + N) % N, b = (i + w) % N;
      ks[i] = ((tx[b] - tx[a]) * rx[i] + (tz[b] - tz[a]) * rz[i]) / (2 * w * this.ds);
    }
    this.ks = new Float32Array(N);
    for (let i = 0; i < N; i++) { let s = 0; for (let k = -10; k <= 10; k++) s += ks[(i + k + N) % N]; this.ks[i] = s / 21; }

    // AI reference speed profile (lateral grip + braking look-ahead)
    const vlim = (this.vlim = new Float32Array(N));
    const aLat = 15.5, vMax = 82, brake = 12;
    for (let i = 0; i < N; i++) vlim[i] = Math.min(vMax, Math.sqrt(aLat / Math.max(Math.abs(this.ks[i]), 1e-5)));
    for (let pass = 0; pass < 2; pass++)
      for (let i = N - 1; i >= 0; i--) { const n = vlim[(i + 1) % N]; vlim[i] = Math.min(vlim[i], Math.sqrt(n * n + 2 * brake * this.ds)); }

    this.startIdx = this.nearestGlobal(0, -120);
    this.sStart = this.startIdx * this.ds;

    // spatial grid for fast distance-to-track queries (terrain, trees)
    this.cell = 60;
    this.grid = new Map();
    for (let i = 0; i < N; i += 2) {
      const k = this._key(Math.floor(px[i] / this.cell), Math.floor(pz[i] / this.cell));
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(i);
    }
    this.noise = makeNoise(11);
    this._f = { x: 0, y: 0, z: 0, tx: 0, tz: 0, rx: 0, rz: 0, i: 0 };
  }

  _key(a, b) { return a * 10007 + b; }

  idxAt(s) { const N = this.N; let i = Math.floor(s / this.ds) % N; if (i < 0) i += N; return i; }

  frameAt(s) {
    const N = this.N, L = this.length;
    let ss = s % L; if (ss < 0) ss += L;
    const fi = ss / this.ds, i = Math.floor(fi) % N, j = (i + 1) % N, f = fi - Math.floor(fi);
    const o = this._f;
    o.x = this.px[i] + (this.px[j] - this.px[i]) * f;
    o.y = this.py[i] + (this.py[j] - this.py[i]) * f;
    o.z = this.pz[i] + (this.pz[j] - this.pz[i]) * f;
    let tx = this.tx[i] + (this.tx[j] - this.tx[i]) * f, tz = this.tz[i] + (this.tz[j] - this.tz[i]) * f;
    const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    o.tx = tx; o.tz = tz; o.rx = -tz; o.rz = tx; o.i = i;
    return o;
  }

  nearest(x, z, hint) {
    const N = this.N; let best = Infinity, bi = hint;
    for (let k = -45; k <= 45; k++) {
      const i = (hint + k + N) % N;
      const dx = x - this.px[i], dz = z - this.pz[i], d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = i; }
    }
    return bi;
  }

  nearestGlobal(x, z) {
    let best = Infinity, bi = 0;
    for (let i = 0; i < this.N; i++) {
      const dx = x - this.px[i], dz = z - this.pz[i], d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = i; }
    }
    return bi;
  }

  // distance to centerline (≤ ~120 m accurate; Infinity beyond)
  distInfo(x, z) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    let best = Infinity, bi = -1;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const list = this.grid.get(this._key(cx + a, cz + b));
      if (!list) continue;
      for (const i of list) {
        const dx = x - this.px[i], dz = z - this.pz[i], d = dx * dx + dz * dz;
        if (d < best) { best = d; bi = i; }
      }
    }
    return [Math.sqrt(best), bi];
  }

  heightAt(x, z) {
    const n = this.noise;
    let nat = n.fbm(x / 420, z / 420, 5) * 30 + n.fbm(x / 95 + 5, z / 95, 3) * 4 + 4;
    const rc = Math.hypot(x - 260, z);
    nat += smooth(1150, 2100, rc) * (170 + 190 * (n.fbm(x / 520 + 20, z / 520, 4) + 0.5));
    const [d, i] = this.distInfo(x, z);
    if (i < 0) return nat;
    const roadY = this.py[i] - 0.35, inner = this.halfW + 22;
    if (d < inner) return roadY;
    return roadY + (nat - roadY) * smooth(inner, inner + 80, d);
  }

  // ------------------------------------------------------------------
  build(scene, T, opts) {
    const N = this.N, hw = this.halfW, ds = this.ds;
    const self = this;
    const vRepeat = (len) => this.length / Math.max(1, Math.round(this.length / len));

    function ribbon(i0, count, offA, offB, yA, yB, uA, uB, vLen, wall = false) {
      const n = count + 1;
      const pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx = [];
      for (let k = 0; k < n; k++) {
        const i = (i0 + k) % N, p = k * 6, q = k * 4;
        const x = self.px[i], y = self.py[i], z = self.pz[i], rx = self.rx[i], rz = self.rz[i];
        pos[p] = x + rx * offA; pos[p + 1] = y + yA; pos[p + 2] = z + rz * offA;
        pos[p + 3] = x + rx * offB; pos[p + 4] = y + yB; pos[p + 5] = z + rz * offB;
        const v = ((i0 + k) * ds) / vLen;
        if (wall) { uv[q] = v; uv[q + 1] = 0; uv[q + 2] = v; uv[q + 3] = 1; }
        else { uv[q] = uA; uv[q + 1] = v; uv[q + 2] = uB; uv[q + 3] = v; }
        if (k < n - 1) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    }

    // ---------- road ----------
    const roadMat = new THREE.MeshStandardMaterial({
      map: T.asphalt, normalMap: T.asphaltNormal, roughnessMap: T.asphaltRough,
      roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 0.6,
    });
    const road = new THREE.Mesh(ribbon(0, N, -hw, hw, 0, 0, 0, 1, vRepeat(T.asphaltLen)), roadMat);
    road.receiveShadow = true;
    scene.add(road);

    // ---------- verges ----------
    const vergeTex = T.grass.clone(); vergeTex.needsUpdate = true;
    const vergeMat = new THREE.MeshStandardMaterial({ map: vergeTex, normalMap: T.grassNormal, color: 0xd8e2c8, roughness: 1 });
    for (const s of [-1, 1]) {
      const a = s < 0 ? -this.wallOff : hw, b = s < 0 ? -hw : this.wallOff;
      const m = new THREE.Mesh(ribbon(0, N, a, b, -0.03, -0.03, 0, (b - a) / 4, 4), vergeMat);
      m.receiveShadow = true; scene.add(m);
    }

    // ---------- curbs (corners only) ----------
    const curbMat = new THREE.MeshStandardMaterial({ map: T.curb, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    const isCorner = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (Math.abs(this.ks[i]) > 1 / 240) for (let k = -14; k <= 14; k++) isCorner[(i + k + N) % N] = 1;
    let startAt = 0; while (startAt < N && isCorner[startAt]) startAt++;
    const curbGeos = [];
    if (startAt < N) {
      for (let k = 0; k < N; k++) {
        const i = (startAt + k) % N;
        if (isCorner[i] && !isCorner[(i - 1 + N) % N]) {
          let len = 0; while (len < N && isCorner[(i + len) % N]) len++;
          curbGeos.push(ribbon(i, len, -hw - 1.15, -hw + 0.2, 0.035, 0.035, 0, 1, 2));
          curbGeos.push(ribbon(i, len, hw - 0.2, hw + 1.15, 0.035, 0.035, 0, 1, 2));
        }
      }
    }
    if (curbGeos.length) {
      const curbs = new THREE.Mesh(mergeGeometries(curbGeos), curbMat);
      curbs.receiveShadow = true; scene.add(curbs);
    }

    // ---------- armco barriers + posts ----------
    const armMat = new THREE.MeshStandardMaterial({ map: T.armco, metalness: 0.75, roughness: 0.38, alphaTest: 0.5, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(ribbon(0, N, s * this.wallOff, s * this.wallOff, -0.03, 1.07, 0, 1, 4, true), armMat);
      m.castShadow = true; m.receiveShadow = true; scene.add(m);
    }
    const postStep = 3, postCount = Math.floor(N / postStep) * 2;
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), new THREE.MeshStandardMaterial({ color: 0x8d9298, metalness: 0.7, roughness: 0.45 }), postCount);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    let pc = 0;
    for (let i = 0; i < N; i += postStep) for (const s of [-1, 1]) {
      const off = s * (this.wallOff + 0.14);
      P.set(this.px[i] + this.rx[i] * off, this.py[i] + 0.4, this.pz[i] + this.rz[i] * off);
      Q.setFromAxisAngle(UP, Math.atan2(this.tx[i], this.tz[i]));
      M.compose(P, Q, S); posts.setMatrixAt(pc++, M);
    }
    posts.castShadow = true; scene.add(posts);

    // ---------- start / finish gantry with race lights ----------
    const at = (i) => {
      const g = new THREE.Group();
      g.position.set(this.px[i], this.py[i], this.pz[i]);
      g.rotation.y = Math.atan2(this.tx[i], this.tz[i]); // local +z = forward, +x = left
      scene.add(g); return g;
    };
    const steel = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.45 });
    const gan = at(this.startIdx);
    for (const s of [-1, 1]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.9, 8.6, 0.9), steel);
      pil.position.set(s * (hw + 2.2), 4.3, 0); pil.castShadow = true; gan.add(pil);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2 * hw + 5.4, 1.8, 0.8), steel);
    beam.position.set(0, 7.9, 0); beam.castShadow = true; gan.add(beam);
    const bannerMat = new THREE.MeshStandardMaterial({ map: T.banner, roughness: 0.6, emissive: 0xffffff, emissiveMap: T.banner, emissiveIntensity: 0.15 });
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(2 * hw + 4, 1.5), bannerMat);
      b.position.set(0, 7.9, s * 0.42); b.rotation.y = s < 0 ? Math.PI : 0; gan.add(b);
    }
    const lamps = [];
    const lampHouse = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.5 });
    for (let k = 0; k < 5; k++) {
      const x = (k - 2) * 1.3;
      const h = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.5), lampHouse);
      h.position.set(x, 9.4, -0.1); gan.add(h);
      const mat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1508, emissiveIntensity: 0, roughness: 0.3 });
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), mat);
      l.position.set(x, 9.4, -0.36); l.rotation.y = Math.PI; gan.add(l);
      lamps.push(mat);
    }
    const line = new THREE.Mesh(new THREE.PlaneGeometry(2 * hw, 1.6), new THREE.MeshStandardMaterial({ map: T.checker, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    line.rotation.x = -Math.PI / 2; line.position.y = 0.01; line.receiveShadow = true; gan.add(line);
    // grid boxes painted on track
    const gridMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    for (let r = 0; r < 3; r++) for (const c of [-1, 1]) {
      const z = -10 - r * 9 - (c > 0 ? 4.5 : 0);
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.25), gridMat);
      bar.rotation.x = -Math.PI / 2; bar.position.set(-c * 3.5, 0.012, z + 2.6); gan.add(bar);
    }

    // ---------- grandstand (left of main straight) ----------
    const gs = at((this.startIdx - 40 + N) % N);
    const concrete = new THREE.MeshStandardMaterial({ color: 0x9a9c9e, roughness: 0.92 });
    const x0 = this.wallOff + 4;
    for (let k = 0; k < 8; k++) {
      const hgt = (k + 1) * 0.6;
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.8, hgt, 80), concrete);
      st.position.set(x0 + k * 1.8 + 0.9, hgt / 2, 0); st.castShadow = true; st.receiveShadow = true; gs.add(st);
      const pg = new THREE.PlaneGeometry(80, 1.05);
      const uvA = pg.attributes.uv; const off = Math.random();
      for (let q = 0; q < uvA.count; q++) uvA.setX(q, uvA.getX(q) * 14 + off);
      const crowd = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: T.crowd, roughness: 0.9 }));
      crowd.rotation.y = -Math.PI / 2;
      crowd.position.set(x0 + k * 1.8 - 0.45, k * 0.6 + 0.52, 0);
      gs.add(crowd);
    }
    T.crowd.wrapS = THREE.RepeatWrapping;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 11, 80), concrete);
    back.position.set(x0 + 14.6, 5.5, 0); back.castShadow = true; gs.add(back);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(18, 0.35, 82), new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.5, roughness: 0.4 }));
    roof.position.set(x0 + 6.5, 11, 0); roof.rotation.z = -0.06; roof.castShadow = true; gs.add(roof);

    // ---------- pit building (right of main straight) ----------
    const pit = at((this.startIdx + 30) % N);
    const pitW = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 150), new THREE.MeshStandardMaterial({ color: 0xe9ebee, roughness: 0.7 }));
    pitW.position.set(-(this.wallOff + 14), 3.5, 0); pitW.castShadow = true; pitW.receiveShadow = true; pit.add(pitW);
    const glassBand = new THREE.Mesh(new THREE.BoxGeometry(12.2, 1.8, 148), new THREE.MeshPhysicalMaterial({ color: 0x1a2a3a, metalness: 0.3, roughness: 0.08, clearcoat: 1 }));
    glassBand.position.set(-(this.wallOff + 14), 5, 0); pit.add(glassBand);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x30353d, roughness: 0.6, metalness: 0.4 });
    for (let k = -6; k <= 6; k++) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.2), doorMat);
      d.position.set(-(this.wallOff + 7.95), 1.6, k * 11); d.rotation.y = Math.PI / 2; pit.add(d);
    }

    // ---------- terrain ----------
    const SIZE = 4600, SEG = opts.terrainSeg || 300;
    const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    tg.rotateX(-Math.PI / 2);
    tg.translate(260, 0, 0);
    const tp = tg.attributes.position;
    const cols = new Float32Array(tp.count * 3);
    const nz = this.noise;
    const gLin = [0.054, 0.117, 0.019]; // grass texture average (linear)
    const rock = [0.20, 0.18, 0.15], snow = [0.85, 0.87, 0.9];
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), z = tp.getZ(i);
      const y = this.heightAt(x, z);
      tp.setY(i, y);
      const v = 0.82 + nz.fbm(x / 160 + 3, z / 160, 3) * 0.5;
      let r = v, g = v, b = v * 0.95;
      const rk = smooth(40, 150, y), sn = smooth(260, 360, y + nz(x / 60, z / 60) * 30);
      r = r * (1 - rk) + (rock[0] / gLin[0]) * rk; g = g * (1 - rk) + (rock[1] / gLin[1]) * rk; b = b * (1 - rk) + (rock[2] / gLin[2]) * rk;
      r = r * (1 - sn) + (snow[0] / gLin[0]) * sn; g = g * (1 - sn) + (snow[1] / gLin[1]) * sn; b = b * (1 - sn) + (snow[2] / gLin[2]) * sn;
      cols[i * 3] = r; cols[i * 3 + 1] = g; cols[i * 3 + 2] = b;
    }
    tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    tg.computeVertexNormals();
    const terrTex = T.grass.clone(); terrTex.needsUpdate = true; terrTex.repeat.set(SIZE / 7, SIZE / 7);
    const terrNrm = T.grassNormal.clone(); terrNrm.needsUpdate = true; terrNrm.repeat.set(SIZE / 7, SIZE / 7);
    const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: terrTex, normalMap: terrNrm, vertexColors: true, roughness: 1 }));
    terrain.receiveShadow = true;
    scene.add(terrain);

    // ---------- trees (instanced) ----------
    const R = rng(99);
    const trunkG = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 7); trunkG.translate(0, 1.6, 0);
    const cones = [[2.7, 5.2, 4.4], [2.15, 4.4, 6.6], [1.45, 3.6, 8.6]].map(([r, h, y]) => { const c = new THREE.ConeGeometry(r, h, 9); c.translate(0, y, 0); return c; });
    const folG = mergeGeometries(cones);
    const maxTrees = 2400;
    const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 }), maxTrees);
    const fol = new THREE.InstancedMesh(folG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), maxTrees);
    const col = new THREE.Color();
    let tc = 0, tries = 0;
    const s0x = this.px[this.startIdx], s0z = this.pz[this.startIdx];
    while (tc < maxTrees && tries < 60000) {
      tries++;
      const x = 260 + (R() - 0.5) * 2600, z = (R() - 0.5) * 2600;
      if (nz.fbm(x / 210, z / 210, 3) < -0.08) continue;
      const [d] = this.distInfo(x, z);
      if (d < hw + 24) continue;
      if (Math.abs(x - s0x) < 70 && z > s0z - 160 && z < s0z + 140) continue;
      const y = this.heightAt(x, z);
      if (y > 120) continue;
      const sc = 0.75 + R() * 0.8;
      P.set(x, y - 0.2, z); Q.setFromAxisAngle(UP, R() * 6.283); S.set(sc, sc * (0.9 + R() * 0.35), sc);
      M.compose(P, Q, S);
      trunks.setMatrixAt(tc, M); fol.setMatrixAt(tc, M);
      col.setRGB(0.16 + R() * 0.06, 0.27 + R() * 0.1, 0.13 + R() * 0.05, THREE.SRGBColorSpace);
      fol.setColorAt(tc, col);
      tc++;
    }
    S.set(1, 1, 1);
    trunks.count = fol.count = tc;
    fol.castShadow = true;
    scene.add(trunks, fol);
    this.trees = { trunks, fol, total: tc };

    return { lamps };
  }

  setTreeDensity(f) {
    if (!this.trees) return;
    const n = Math.floor(this.trees.total * f);
    this.trees.trunks.count = this.trees.fol.count = n;
  }
}
