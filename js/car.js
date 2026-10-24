// Procedural GT sports car model (PBR clear-coat paint, glass, alloy wheels).
// Local axes: +z forward, +x left, +y up. Origin = ground level, car centre.
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

let GEO = null;

function taper(geo, fn) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setZ(i, z * fn(x, y));
  }
}

function finish(geo) {
  // profile x → car z (length), extrusion z → car x (width)
  geo.rotateY(-Math.PI / 2);
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  return toCreasedNormals(geo, Math.PI / 5);
}

function buildGeometries() {
  const G = {};

  // ----- lower body -----
  const s = new THREE.Shape();
  s.moveTo(-2.22, 0.30);
  s.lineTo(-2.30, 0.50);
  s.quadraticCurveTo(-2.34, 0.80, -2.16, 0.86);
  s.lineTo(-1.55, 0.92);
  s.lineTo(1.05, 0.91);
  s.quadraticCurveTo(1.65, 0.87, 2.06, 0.71);
  s.quadraticCurveTo(2.36, 0.61, 2.34, 0.45);
  s.lineTo(2.25, 0.27);
  s.lineTo(1.84, 0.27);
  s.absarc(1.40, 0.27, 0.44, 0, Math.PI, false);
  s.lineTo(-0.96, 0.27);
  s.absarc(-1.40, 0.27, 0.44, 0, Math.PI, false);
  s.lineTo(-2.22, 0.30);
  let body = new THREE.ExtrudeGeometry(s, { depth: 1.70, bevelEnabled: true, bevelThickness: 0.13, bevelSize: 0.06, bevelSegments: 6, curveSegments: 24 });
  body.translate(0, 0, -0.85);
  taper(body, (x, y) => {
    let k = 1;
    if (y > 0.55) k *= 1 - (y - 0.55) * 0.3;
    if (x > 1.5) k *= 1 - Math.pow((x - 1.5) / 0.86, 2) * 0.17;
    if (x < -1.75) k *= 1 - Math.pow((-1.75 - x) / 0.6, 2) * 0.07;
    return k;
  });
  G.body = finish(body);

  // ----- greenhouse (glass) -----
  const gsh = new THREE.Shape();
  gsh.moveTo(-1.52, 0.88);
  gsh.lineTo(1.04, 0.88);
  gsh.quadraticCurveTo(0.56, 1.11, 0.18, 1.245);
  gsh.quadraticCurveTo(-0.35, 1.315, -0.82, 1.245);
  gsh.quadraticCurveTo(-1.26, 1.11, -1.52, 0.88);
  let glass = new THREE.ExtrudeGeometry(gsh, { depth: 1.30, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.04, bevelSegments: 4, curveSegments: 20 });
  glass.translate(0, 0, -0.65);
  taper(glass, (x, y) => 1 - Math.max(0, y - 0.88) * 0.55);
  G.glass = finish(glass);

  // ----- painted roof panel following the glass roof curve -----
  const roofPts = [];
  const qb = (t, a, b, c) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
  for (let i = 0; i <= 16; i++) { const t = 0.08 + (i / 16) * 0.84; roofPts.push([qb(t, 0.18, -0.35, -0.82), qb(t, 1.245, 1.315, 1.245)]); }
  const rs = new THREE.Shape();
  rs.moveTo(roofPts[0][0], roofPts[0][1] - 0.005);
  for (const [x, y] of roofPts) rs.lineTo(x, y + 0.045);
  for (let i = roofPts.length - 1; i >= 0; i--) rs.lineTo(roofPts[i][0], roofPts[i][1] - 0.005);
  let roof = new THREE.ExtrudeGeometry(rs, { depth: 0.98, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.015, bevelSegments: 3, curveSegments: 8 });
  roof.translate(0, 0, -0.49);
  G.roof = finish(roof);

  // ----- wheel parts -----
  const prof = [[0.235, -0.13], [0.30, -0.138], [0.328, -0.125], [0.342, -0.08], [0.345, 0], [0.342, 0.08], [0.328, 0.125], [0.30, 0.138], [0.235, 0.13]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const tire = new THREE.LatheGeometry(prof, 40); tire.rotateZ(Math.PI / 2);
  G.tire = tire;
  const barrel = new THREE.CylinderGeometry(0.236, 0.236, 0.24, 32, 1, true); barrel.rotateZ(Math.PI / 2);
  G.barrel = barrel;
  const spokes = [];
  const lip = new THREE.TorusGeometry(0.228, 0.014, 8, 40); lip.rotateY(Math.PI / 2); lip.translate(0.12, 0, 0); spokes.push(lip);
  for (let k = 0; k < 10; k++) {
    const b = new THREE.BoxGeometry(0.03, 0.2, 0.034); b.translate(0.11, 0.115, 0); b.rotateX((k / 10) * Math.PI * 2 + (k % 2) * 0.12); spokes.push(b);
  }
  const hub = new THREE.CylinderGeometry(0.06, 0.07, 0.05, 16); hub.rotateZ(Math.PI / 2); hub.translate(0.11, 0, 0); spokes.push(hub);
  G.rim = mergeGeometries(spokes.map((g) => { g.deleteAttribute('uv'); return g; }));
  const disc = new THREE.CylinderGeometry(0.19, 0.19, 0.03, 28); disc.rotateZ(Math.PI / 2); disc.translate(0.02, 0, 0);
  G.disc = disc;
  const cal = new THREE.BoxGeometry(0.07, 0.15, 0.11); cal.translate(0.06, 0.13, -0.08);
  G.caliper = cal;
  return G;
}

export function buildCar(paintHex) {
  if (!GEO) GEO = buildGeometries();
  const car = new THREE.Group();
  const body = new THREE.Group();
  car.add(body);

  const paint = new THREE.MeshPhysicalMaterial({ color: paintHex, metalness: 0.5, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.2 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.55, metalness: 0.25 });
  const carbon = new THREE.MeshPhysicalMaterial({ color: 0x15171b, roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0x05070a, metalness: 0.2, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 1.8 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd0d4da, metalness: 1, roughness: 0.16 });
  const headM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf2ff, emissiveIntensity: 2.4, roughness: 0.2 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff1810, emissiveIntensity: 1.0, roughness: 0.25 });

  const add = (geo, mat, x = 0, y = 0, z = 0, parent = body, shadow = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = shadow; parent.add(m); return m;
  };

  add(GEO.body, paint);
  add(GEO.glass, glassM);
  add(GEO.roof, paint);
  add(new THREE.BoxGeometry(1.45, 0.34, 3.7), black, 0, 0.42, 0); // chassis tub

  // front
  for (const s of [-1, 1]) {
    const h = add(new THREE.BoxGeometry(0.42, 0.06, 0.26), headM, s * 0.57, 0.685, 2.215, body, false);
    h.rotation.set(0.52, s * 0.2, 0);
    const intake = add(new THREE.BoxGeometry(0.34, 0.14, 0.08), black, s * 0.6, 0.4, 2.37, body, false);
    intake.rotation.y = s * 0.25;
  }
  add(new THREE.BoxGeometry(0.9, 0.15, 0.08), black, 0, 0.4, 2.4, body, false);
  add(new THREE.BoxGeometry(1.9, 0.04, 0.35), carbon, 0, 0.26, 2.12, body, false); // splitter

  // rear
  add(new THREE.BoxGeometry(1.45, 0.045, 0.05), tailM, 0, 0.74, -2.405, body, false);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.4, 0.12, 0.06), tailM, s * 0.6, 0.72, -2.4, body, false);
  add(new THREE.BoxGeometry(1.5, 0.14, 0.4), carbon, 0, 0.32, -2.2, body, false); // diffuser
  for (const s of [-1, 1]) {
    const ex = add(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 16), chrome, s * 0.36, 0.34, -2.42, body, false);
    ex.rotation.x = Math.PI / 2;
  }
  // wing
  add(new THREE.BoxGeometry(1.74, 0.035, 0.32), carbon, 0, 1.1, -2.0);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.04, 0.2, 0.12), carbon, s * 0.55, 0.99, -2.0);
    add(new THREE.BoxGeometry(0.02, 0.12, 0.34), carbon, s * 0.87, 1.12, -2.0);
  }
  // mirrors & skirts
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.17, 0.09, 0.13), paint, s * 0.98, 1.0, 0.74);
    add(new THREE.BoxGeometry(0.1, 0.03, 0.05), black, s * 0.88, 0.97, 0.74, body, false);
    add(new THREE.BoxGeometry(0.05, 0.08, 1.9), carbon, s * 0.98, 0.31, 0, body, false);
  }

  // nitro flames
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const flameGeo = new THREE.ConeGeometry(0.07, 0.7, 12); flameGeo.rotateX(-Math.PI / 2); flameGeo.translate(0, 0, -0.35);
  const flames = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(flameGeo, flameMat); f.position.set(s * 0.36, 0.34, -2.5); f.visible = false;
    body.add(f); flames.push(f);
  }

  // contact shadow
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 5.3), new THREE.MeshBasicMaterial({ map: CAR_BLOB, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; blob.renderOrder = 2;
  car.add(blob);

  // wheels
  const tireM = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.88, metalness: 0 });
  const rimM = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 1, roughness: 0.22 });
  const barrelM = new THREE.MeshStandardMaterial({ color: 0x2a2d32, metalness: 0.8, roughness: 0.4 });
  const discM = new THREE.MeshStandardMaterial({ color: 0x6b6e73, metalness: 0.9, roughness: 0.35 });
  const calM = new THREE.MeshStandardMaterial({ color: 0xd4141a, roughness: 0.4, metalness: 0.2 });
  const wheels = [];
  for (const [x, z, front] of [[0.86, 1.4, true], [-0.86, 1.4, true], [0.86, -1.4, false], [-0.86, -1.4, false]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.345, z); car.add(pivot);
    const side = new THREE.Group(); side.scale.x = Math.sign(x); pivot.add(side); // mirror so the face points outward
    const spin = new THREE.Group(); side.add(spin);
    add(GEO.tire, tireM, 0, 0, 0, spin);
    add(GEO.barrel, barrelM, 0, 0, 0, spin, false);
    add(GEO.rim, rimM, 0, 0, 0, spin);
    add(GEO.disc, discM, 0, 0, 0, spin, false);
    add(GEO.caliper, calM, 0, 0, 0, side, false);
    wheels.push({ pivot, spin, front });
  }

  return { group: car, body, wheels, tailM, flames, paint };
}

let CAR_BLOB = null;
export function setCarBlobTexture(t) { CAR_BLOB = t; }
