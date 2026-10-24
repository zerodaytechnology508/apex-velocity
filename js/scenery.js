// Theme scenery: trees, palms, cacti, rocks, city skyline, street lights, sea, stars, snowfall.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, windowTexture, frondTexture } from './textures.js';

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

function radialTex(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function colorize(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const [r, g, b] = fn(p.getX(i), p.getY(i), p.getZ(i), n.getY(i)); c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
const ni = (g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; };

function pineGeo(snowy) {
  const cones = [[2.7, 5.2, 4.4], [2.15, 4.4, 6.6], [1.45, 3.6, 8.6]].map(([r, h, y]) => new THREE.ConeGeometry(r, h, 9).translate(0, y, 0));
  const g = mergeGeometries(cones.map(ni));
  return colorize(g, (x, y, z, ny) => {
    if (!snowy) return [1, 1, 1];
    const h = Math.sin(x * 3.1 + z * 2.3 + y * 1.7);
    return ny > 0.3 && h > -0.55 ? [0.82, 0.86, 0.92] : [0.035, 0.07, 0.03];
  });
}

function cactusGeo() {
  const parts = [new THREE.CylinderGeometry(0.42, 0.48, 7, 10).translate(0, 3.5, 0), new THREE.SphereGeometry(0.42, 10, 6).translate(0, 7, 0)];
  for (const [s, y, h] of [[1, 2.6, 2.6], [-1, 3.6, 2.0]]) {
    parts.push(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8).rotateZ(Math.PI / 2).translate(s * 0.9, y, 0));
    parts.push(new THREE.CylinderGeometry(0.3, 0.3, h, 8).translate(s * 1.45, y + h / 2, 0));
    parts.push(new THREE.SphereGeometry(0.3, 8, 6).translate(s * 1.45, y + h, 0));
  }
  return mergeGeometries(parts.map(ni));
}

function palmTrunkGeo() {
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector3(Math.sin(t * 1.2) * 1.6 * t, t * 11, 0)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.28, 8, false);
}

function frondsGeo() {
  const parts = [];
  const top = new THREE.Vector3(Math.sin(1.2) * 1.6, 11, 0);
  for (let k = 0; k < 9; k++) {
    const g = new THREE.PlaneGeometry(1.6, 5.2, 1, 6);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 2.6; p.setY(i, y); p.setZ(i, -Math.pow(y / 5.2, 2) * 2.2); }
    g.rotateX(-Math.PI / 2 + 0.25);
    g.rotateY((k / 9) * Math.PI * 2 + (k % 2) * 0.3);
    g.translate(top.x, top.y, top.z);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

export function addScenery(world, track, T, opts) {
  const th = track.theme, R = rng(track.map.id.length * 101 + 7);
  const hw = track.halfW;
  const s0x = track.px[track.startIdx], s0z = track.pz[track.startIdx];
  const tx0 = track.tx[track.startIdx], tz0 = track.tz[track.startIdx];
  const nearStart = (x, z, r = 90, along = 170) => {
    const dx = x - s0x, dz = z - s0z, a = dx * tx0 + dz * tz0, l = Math.abs(dx * -tz0 + dz * tx0);
    return Math.abs(a) < along && l < r;
  };
  const span = Math.max(track.bounds.maxX - track.bounds.minX, track.bounds.maxZ - track.bounds.minZ);
  const reach = span / 2 + 700;
  const scatter = (count, minD, maxH, density = () => true, maxD = Infinity) => {
    const out = [];
    let tries = 0;
    while (out.length < count && tries < count * 40) {
      tries++;
      const x = track.center.x + (R() - 0.5) * 2 * reach, z = track.center.y + (R() - 0.5) * 2 * reach;
      if (!density(x, z)) continue;
      const [d] = track.distInfo(x, z);
      if (d < minD || d > maxD) continue;
      if (nearStart(x, z)) continue;
      const y = track.heightAt(x, z);
      if (y > maxH || (th.sea && y < 1.5)) continue;
      out.push([x, y, z]);
    }
    return out;
  };
  const instanced = [];
  const fill = (mesh, list, scale, color) => {
    list.forEach(([x, y, z], i) => {
      const sc = scale();
      P.set(x, y - 0.2, z); Q.setFromAxisAngle(UP, R() * 6.283); S.set(sc, sc * (0.9 + R() * 0.3), sc);
      M4.compose(P, Q, S); mesh.setMatrixAt(i, M4);
      if (color) mesh.setColorAt(i, color());
    });
    mesh.count = list.length; mesh.userData.total = list.length;
    instanced.push(mesh); world.add(mesh);
    return mesh;
  };
  const col = new THREE.Color();
  const forest = (x, z) => track.noise.fbm(x / 210, z / 210, 3) > -0.08;
  const updaters = [];

  // ---------------- trees ----------------
  if (th.trees === 'pine' || th.trees === 'snowpine') {
    const list = scatter(th.treeCount, hw + 24, 140, forest);
    const trunkG = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 7).translate(0, 1.6, 0);
    const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 }), list.length);
    const fol = new THREE.InstancedMesh(pineGeo(th.trees === 'snowpine'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), list.length);
    const scales = list.map(() => 0.75 + R() * 0.8), rots = list.map(() => R() * 6.283);
    list.forEach(([x, y, z], i) => {
      P.set(x, y - 0.2, z); Q.setFromAxisAngle(UP, rots[i]); S.setScalar(scales[i]); S.y *= 1.1;
      M4.compose(P, Q, S); trunks.setMatrixAt(i, M4); fol.setMatrixAt(i, M4);
      if (th.trees !== 'snowpine') { col.setRGB(0.16 + R() * 0.06, 0.27 + R() * 0.1, 0.13 + R() * 0.05, THREE.SRGBColorSpace); fol.setColorAt(i, col); }
    });
    trunks.count = fol.count = list.length; trunks.userData.total = fol.userData.total = list.length;
    fol.castShadow = true; world.add(trunks, fol); instanced.push(trunks, fol);
  } else if (th.trees === 'palm') {
    const list = scatter(th.treeCount, hw + 18, 60, (x, z) => track.noise(x / 120, z / 120) > -0.2);
    const trunk = new THREE.InstancedMesh(palmTrunkGeo(), new THREE.MeshStandardMaterial({ color: 0x7a6248, roughness: 1 }), list.length);
    const ft = frondTexture();
    const fronds = new THREE.InstancedMesh(frondsGeo(), new THREE.MeshStandardMaterial({ map: ft, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85 }), list.length);
    list.forEach(([x, y, z], i) => {
      const sc = 0.8 + R() * 0.5; P.set(x, y - 0.2, z); Q.setFromAxisAngle(UP, R() * 6.283); S.setScalar(sc);
      M4.compose(P, Q, S); trunk.setMatrixAt(i, M4); fronds.setMatrixAt(i, M4);
    });
    trunk.count = fronds.count = list.length; trunk.userData.total = fronds.userData.total = list.length;
    fronds.castShadow = trunk.castShadow = true; world.add(trunk, fronds); instanced.push(trunk, fronds);
  } else if (th.trees === 'cactus') {
    const list = scatter(th.treeCount, hw + 16, 200);
    const m = new THREE.InstancedMesh(cactusGeo(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), list.length);
    fill(m, list, () => 0.6 + R() * 0.7, () => col.setRGB(0.18 + R() * 0.05, 0.32 + R() * 0.08, 0.14, THREE.SRGBColorSpace));
    m.castShadow = true;
    // dry shrubs
    const shrubs = scatter(1400, hw + 12, 200);
    const sh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.8, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), shrubs.length);
    fill(sh, shrubs, () => 0.5 + R() * 1.2, () => col.setRGB(0.42 + R() * 0.1, 0.36 + R() * 0.08, 0.2, THREE.SRGBColorSpace));
  }

  // ---------------- rocks ----------------
  if (!th.city) {
    const rocks = scatter(th.mesas ? 500 : 260, hw + 20, 400);
    const rg = new THREE.DodecahedronGeometry(1, 0);
    const rm = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), rocks.length);
    const rc = th.rock;
    rocks.forEach(([x, y, z], i) => {
      const sc = 0.6 + Math.pow(R(), 3) * 5; P.set(x, y + sc * 0.1, z);
      Q.setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)); S.set(sc * (0.8 + R() * 0.6), sc * (0.5 + R() * 0.4), sc * (0.8 + R() * 0.6));
      M4.compose(P, Q, S); rm.setMatrixAt(i, M4);
      const k = 0.8 + R() * 0.4;
      col.setRGB(Math.pow(rc[0], 0.45) * k, Math.pow(rc[1], 0.45) * k, Math.pow(rc[2], 0.45) * k, THREE.SRGBColorSpace);
      if (th.ground === 'snow') col.setRGB(0.55 * k, 0.57 * k, 0.6 * k);
      rm.setColorAt(i, col);
    });
    rm.castShadow = true; world.add(rm);
  }

  // ---------------- sea ----------------
  if (th.sea) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), img = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const a = Math.sin(x / 256 * Math.PI * 8 + Math.sin(y / 256 * Math.PI * 4) * 1.5), b = Math.sin(y / 256 * Math.PI * 6 + Math.cos(x / 256 * Math.PI * 4));
      const i = (y * 256 + x) * 4;
      img.data[i] = 128 + a * 40; img.data[i + 1] = 128 + b * 40; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const nt = new THREE.CanvasTexture(c); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.repeat.set(220, 220);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(span + 3600, span + 3600), new THREE.MeshStandardMaterial({
      color: 0x0f3550, roughness: 0.06, metalness: 0.1, normalMap: nt, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.3,
    }));
    water.rotation.x = -Math.PI / 2; water.position.set(track.center.x, th.sea.level, track.center.y);
    water.receiveShadow = true; world.add(water);
    updaters.push((dt) => { nt.offset.x += dt * 0.004; nt.offset.y += dt * 0.0025; });
  }

  // ---------------- city skyline ----------------
  if (th.city) {
    const wt = windowTexture(5);
    const types = [[34, 46, 30], [26, 90, 26], [44, 140, 36], [60, 34, 50], [30, 190, 30], [50, 70, 40]];
    const geos = types.map(([w, h, d]) => {
      const g = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d) / 22, uv.getY(i) * h / 48);
      return g;
    });
    const mat = new THREE.MeshStandardMaterial({ color: 0x1b1f28, roughness: 0.6, metalness: 0.4, map: wt, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 1.05 });
    const spots = scatter(260, hw + 70, 50, () => true, 760);
    const per = types.map(() => []);
    spots.forEach((p) => per[Math.floor(R() * types.length)].push(p));
    per.forEach((list, k) => {
      const m = new THREE.InstancedMesh(geos[k], mat, list.length);
      list.forEach(([x, y, z], i) => {
        P.set(x, y - 0.5, z); Q.setFromAxisAngle(UP, Math.round(R() * 4) * Math.PI / 2 + (R() - 0.5) * 0.3); S.set(1, 0.7 + R() * 0.6, 1);
        M4.compose(P, Q, S); m.setMatrixAt(i, M4);
      });
      m.castShadow = true; m.receiveShadow = true; world.add(m);
    });
    // red aircraft-warning beacons on tall towers
    const beaconM = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
    const tall = per[4];
    const bc = new THREE.InstancedMesh(new THREE.SphereGeometry(1.2, 8, 6), beaconM, tall.length);
    tall.forEach(([x, y, z], i) => { M4.makeTranslation(x, y + 190 * 1.0, z); bc.setMatrixAt(i, M4); });
    world.add(bc);
  }

  // ---------------- street lights ----------------
  if (th.lamps) {
    const N = track.N, step = Math.round(34 / track.ds);
    const poleG = mergeGeometries([new THREE.CylinderGeometry(0.12, 0.18, 9, 8).translate(0, 4.5, 0), new THREE.BoxGeometry(0.12, 0.12, 2.6).translate(0, 8.9, 1.2)].map(ni));
    const n = Math.floor(N / step);
    const poles = new THREE.InstancedMesh(poleG, new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.6, roughness: 0.5 }), n);
    const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.14, 1.0), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }), n);
    const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(18, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: radialTex('rgba(255,214,150,0.2)', 'rgba(255,214,150,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -10,
    }), n);
    for (let k = 0; k < n; k++) {
      const i = k * step, s = k % 2 ? 1 : -1;
      const off = s * (track.wallOff + 1.2);
      const yaw = Math.atan2(track.tx[i], track.tz[i]) + (s > 0 ? Math.PI / 2 : -Math.PI / 2);
      P.set(track.px[i] + track.rx[i] * off, track.py[i], track.pz[i] + track.rz[i] * off);
      Q.setFromAxisAngle(UP, yaw); S.set(1, 1, 1);
      M4.compose(P, Q, S); poles.setMatrixAt(k, M4);
      const hx = P.x - track.rx[i] * s * 2.4, hz = P.z - track.rz[i] * s * 2.4;
      P.set(hx, track.py[i] + 8.82, hz); M4.compose(P, Q, S); heads.setMatrixAt(k, M4);
      const pxo = track.px[i] + track.rx[i] * s * (hw - 1.5), pzo = track.pz[i] + track.rz[i] * s * (hw - 1.5);
      M4.makeTranslation(pxo, track.py[i] + 0.04, pzo); pool.setMatrixAt(k, M4);
    }
    poles.castShadow = true; pool.renderOrder = 1;
    world.add(poles, heads, pool);
  }

  // ---------------- stars ----------------
  if (th.stars) {
    const n = 2200, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = R() * Math.PI * 2, v = 0.05 + R() * 0.95, r = 6000;
      pos[i * 3] = Math.cos(u) * Math.sqrt(1 - v * v) * r; pos[i * 3 + 1] = v * r; pos[i * 3 + 2] = Math.sin(u) * Math.sqrt(1 - v * v) * r;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    stars.frustumCulled = false; world.add(stars);
    updaters.push((dt, cam) => stars.position.copy(cam));
  }

  // ---------------- snowfall ----------------
  if (th.snowfall) {
    const n = 4000, box = 70, H = 36, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (R() - 0.5) * box * 2; pos[i * 3 + 1] = R() * H; pos[i * 3 + 2] = (R() - 0.5) * box * 2; }
    const g = new THREE.BufferGeometry(); const attr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', attr);
    const flakes = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.85, depthWrite: false }));
    flakes.frustumCulled = false; world.add(flakes);
    const seed = new Float32Array(n); for (let i = 0; i < n; i++) seed[i] = R() * 6.28;
    let t = 0;
    updaters.push((dt, cam) => {
      t += dt;
      for (let i = 0; i < n; i++) {
        let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        y -= dt * (1.6 + (i % 7) * 0.12); x += Math.sin(t * 0.8 + seed[i]) * dt * 0.5;
        const wrap = (v, c) => c + ((((v - c) + box) % (2 * box)) + 2 * box) % (2 * box) - box;
        x = wrap(x, cam.x); z = wrap(z, cam.z);
        if (y < cam.y - 8) y += H; if (y > cam.y + H - 8) y -= H;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      }
      attr.needsUpdate = true;
    });
  }

  return {
    setDensity(f) { for (const m of instanced) m.count = Math.floor((m.userData.total || 0) * f); },
    update(dt, cam) { for (const u of updaters) u(dt, cam); },
  };
}
