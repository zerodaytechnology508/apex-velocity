// APEX VELOCITY — main game controller
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { CONFIG } from './config.js';
import { Ads } from './ads.js';
import { AudioFX } from './audio.js';
import { buildTextures, cachedTextures } from './textures.js';
import { Track } from './track.js';
import { MAPS, mapById } from './maps.js';
import { buildCar, disposeCar, MODELS, modelById, setCarEnvironment, setCarTextures } from './cars.js';
import { PlayerCar, AICar, REDLINE } from './vehicle.js';
import { SkidMarks, Smoke } from './fx.js';
import { Input } from './input.js';
import { HUD, fmtTime } from './hud.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const deg = THREE.MathUtils.degToRad;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// ---------------- persistent settings ----------------
const store = {
  get(k, d) { try { const v = localStorage.getItem('apex_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('apex_' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const PAINTS = [
  ['Corsa Red', 0xa3100d], ['Monza Blue', 0x0d3f9e], ['Solar Yellow', 0xe0a90a], ['Glacier White', 0xe6e9ec],
  ['Obsidian', 0x0b0c0e], ['Racing Green', 0x0b5a33], ['Lava Orange', 0xd9520b], ['Titanium', 0x8d949b],
];
const AI_NAMES = ['R. Kovač', 'M. Laurent', 'D. Okafor', 'S. Tanaka', 'L. Vargas', 'J. Lindqvist'];
const DIFF = { easy: 0.86, normal: 0.95, hard: 1.03 };
const DIFF_NAME = { easy: 'Rookie', normal: 'Pro', hard: 'Legend' };
const settings = {
  quality: store.get('quality', isTouch ? 'low' : 'high'),
  difficulty: store.get('difficulty', 'normal'),
  laps: store.get('laps', CONFIG.laps),
  paint: store.get('paint', 0),
  car: store.get('car', 'vortex'),
  map: store.get('map', 'valle'),
  trans: store.get('trans', 'auto'),
  muted: store.get('muted', false),
};
if (!MAPS.some((m) => m.id === settings.map)) settings.map = 'valle';
if (!MODELS.some((m) => m.id === settings.car)) settings.car = 'vortex';
const bestKey = () => 'best_' + settings.map;
let bestLap = store.get(bestKey(), 0);

function qualityPreset(q) {
  const dpr = window.devicePixelRatio || 1;
  if (q === 'low') return { pr: Math.min(dpr, 1), shadow: 1024, bloom: false, msaa: 0, trees: 0.4, range: 55 };
  if (q === 'ultra') return { pr: clamp(3840 / window.innerWidth, Math.min(dpr, 2), 2), shadow: 4096, bloom: true, msaa: 4, trees: 1, range: 90 };
  return { pr: Math.min(dpr, 1.5), shadow: 2048, bloom: true, msaa: 4, trees: 0.75, range: 70 };
}
let Q = qualityPreset(settings.quality);

// ---------------- renderer / scene ----------------
const canvas = $('game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
} catch (e) {
  $('loadText').textContent = 'WebGL is not available. Please enable hardware acceleration or try another browser.';
  throw e;
}
renderer.setPixelRatio(Q.pr);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.54;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 9000);
scene.fog = new THREE.FogExp2(0xa9bccf, 0.00032);
let world = new THREE.Group(); scene.add(world);

const sky = new Sky(); sky.scale.setScalar(8000); scene.add(sky);
const sunDir = new THREE.Vector3(), lightDir = new THREE.Vector3();
const sun = new THREE.DirectionalLight(0xfff0dd, 6.0);
sun.castShadow = true;
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 700;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x5a6a44, 0.3);
scene.add(hemi);
let envTex = null, headLight = null, moon = null;

function applyShadowQuality() {
  const c = sun.shadow.camera;
  c.left = c.bottom = -Q.range; c.right = c.top = Q.range; c.updateProjectionMatrix();
  sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
}
applyShadowQuality();

function setupSky(s, th) {
  const u = s.material.uniforms;
  u.turbidity.value = th.sky.turbidity; u.rayleigh.value = th.sky.rayleigh; u.mieCoefficient.value = th.sky.mie; u.mieDirectionalG.value = th.sky.mieG;
  u.sunPosition.value.copy(sunDir);
}

function applyTheme(th) {
  sunDir.setFromSphericalCoords(1, deg(90 - th.sky.elev), deg(th.sky.azim));
  if (th.sun.moon) lightDir.setFromSphericalCoords(1, deg(90 - 38), deg(th.sky.azim + 50));
  else lightDir.copy(sunDir);
  setupSky(sky, th);
  sun.color.set(th.sun.color); sun.intensity = th.sun.intensity;
  hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]); hemi.intensity = th.hemi[2];
  scene.fog.color.set(th.fog[0]); scene.fog.density = th.fog[1];
  renderer.toneMappingExposure = th.exposure;
  // environment map for reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const s2 = new Sky(); s2.scale.setScalar(80); setupSky(s2, th); env.add(s2);
  const groundCol = { grass: 0x46533a, sand: 0x9a7a55, snow: 0xc8d0da, dirt: 0x202226 }[th.ground] || 0x46533a;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshBasicMaterial({ color: groundCol }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -2; env.add(ground);
  if (th.night) {
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2, warm = k % 3 !== 0;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(4 + (k % 4) * 2, 6 + (k % 5) * 3), new THREE.MeshBasicMaterial({ color: warm ? 0xffb860 : 0x6fa8ff, side: THREE.DoubleSide }));
      p.position.set(Math.cos(a) * 45, 2 + (k % 4) * 2, Math.sin(a) * 45); p.lookAt(0, p.position.y, 0); env.add(p);
    }
  }
  if (envTex) envTex.dispose();
  envTex = pmrem.fromScene(env, 0.02, 0.1, 200).texture;
  scene.environment = envTex; scene.environmentIntensity = th.env;
  pmrem.dispose();
  setCarEnvironment(envTex);
}

// post-processing
let composer, bloom;
function buildComposer() {
  if (composer) { composer.renderTarget1.dispose(); composer.renderTarget2.dispose(); }
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: Q.msaa });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.55, 0.88);
  bloom.enabled = Q.bloom;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(Q.pr);
  composer.setSize(window.innerWidth, window.innerHeight);
}

// ---------------- world state ----------------
const maxAniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());
let TEX, track, lamps, skids, smoke, currentMap = null;
const hud = new HUD();
const audio = new AudioFX();
const input = new Input();
let player, ais = [], cars = [];
let state = 'loading', paused = false, adPause = false, loadingMap = false;
let raceTime = 0, countdown = 0, lightsLit = 0, goDelay = 0;
let camMode = 0, camIdx = 0, camYaw = 0, camShake = 0, camT = 0, menuAngle = 0, lookBackK = 0;
let showFps = false, fpsAcc = 0, fpsN = 0, dashTick = 0;
let resultsTimer = -1, lastWrongWay = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const CAMS = [{ name: 'Chase', dist: 6.6, h: 2.15, look: 1.15 }, { name: 'Far chase', dist: 10.5, h: 3.4, look: 1.3 }, { name: 'Cockpit', cockpit: true }, { name: 'Bumper', hood: true }];

function setProgress(p, text) { $('loadBar').style.width = Math.round(p * 100) + '%'; if (text) $('loadText').textContent = text; }
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function disposeWorld() {
  const keep = new Set([...Object.values(TEX).filter((t) => t && t.isTexture), ...cachedTextures()]);
  world.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap', 'alphaMap']) if (m[k] && !keep.has(m[k])) m[k].dispose();
      m.dispose();
    }
  });
  scene.remove(world);
  world = new THREE.Group(); scene.add(world);
}

async function loadMap(id, withProgress = false) {
  loadingMap = true;
  const map = mapById(id);
  if (withProgress) setProgress(0.35, `Building ${map.name}…`);
  else { $('mapVeil').hidden = false; $('mapVeilText').textContent = `Loading ${map.name}…`; }
  await nextFrame();
  if (track) disposeWorld();
  applyTheme(map.theme);
  track = new Track(map);
  if (withProgress) { setProgress(0.5, 'Shaping terrain and scenery…'); await nextFrame(); }
  ({ lamps } = track.build(world, TEX, { terrainSeg: isTouch ? 200 : 300 }));
  track.setTreeDensity(Q.trees);
  hud.setTrack(track);
  if (moon) { moon.removeFromParent(); moon = null; }
  if (map.theme.night) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 20, 64, 64, 64);
    grd.addColorStop(0, '#f4f6ff'); grd.addColorStop(0.42, '#dfe6ff'); grd.addColorStop(0.5, 'rgba(160,180,255,0.25)'); grd.addColorStop(1, 'rgba(120,140,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, toneMapped: false, depthWrite: false }));
    moon.scale.setScalar(420); world.add(moon);
  }
  currentMap = map;
  createCars();
  if (skids) skids.clear();
  placeGrid();
  bestLap = store.get(bestKey(), 0);
  $('bestMenu').textContent = bestLap ? fmtTime(bestLap) : 'No lap set yet';
  renderer.compile(scene, camera);
  if (!withProgress) $('mapVeil').hidden = true;
  loadingMap = false;
}

async function build() {
  setProgress(0.05, 'Mixing asphalt…');
  await nextFrame();
  TEX = buildTextures(maxAniso);
  setCarTextures({ blob: TEX.blob, plate: TEX.plate });
  skids = new SkidMarks(scene);
  smoke = new Smoke(scene);
  buildComposer();
  await loadMap(settings.map, true);
  setProgress(0.9, 'Compiling shaders…');
  await nextFrame();
  updateMenuCamera(0);
  composer.render();
  setProgress(1, 'Ready');
}

function createCars() {
  for (const c of cars) { scene.remove(c.m.group); disposeCar(c.m); }
  if (headLight) { headLight.removeFromParent(); headLight.target.removeFromParent(); headLight = null; }
  const pIdx = clamp(settings.paint, 0, PAINTS.length - 1);
  const night = currentMap?.theme.night;
  player = new PlayerCar(buildCar(settings.car, PAINTS[pIdx][1], { caliper: 0 }), track, 'You');
  player.setTransmission(settings.trans === 'manual');
  player.onShift = (k) => { audio.shift(k); if (k === 'denied') hud.message('', 'Over-rev: shift refused', 0.8, 'warn'); };
  const others = PAINTS.map((p, i) => i).filter((i) => i !== pIdx);
  ais = [];
  const skills = [1.0, 0.985, 0.97, 0.955, 0.94, 0.925];
  for (let k = 0; k < CONFIG.opponents; k++) {
    const model = MODELS[(k + 1) % MODELS.length].id;
    const m = buildCar(model, PAINTS[others[(k * 3) % others.length]][1], { caliper: k + 1, darkRims: k % 2 === 1 });
    ais.push(new AICar(m, track, AI_NAMES[k % AI_NAMES.length], skills[k % skills.length]));
  }
  cars = [...ais, player];
  for (const c of cars) {
    scene.add(c.m.group);
    c.m.headM.emissiveIntensity = night ? 8 : 3;
  }
  if (night) {
    headLight = new THREE.SpotLight(0xf2f6ff, 900, 140, 0.55, 0.55, 1.3);
    headLight.position.set(0, 0.75, 1.9);
    headLight.target.position.set(0, -1.5, 30);
    player.m.body.add(headLight, headLight.target);
  }
  setCockpit(CAMS[camMode].cockpit === true);
}

function placeGrid() {
  camIdx = track.startIdx;
  const s0 = track.sStart;
  const slots = [];
  for (let r = 0; r < 3; r++) for (const c of [-1, 1]) slots.push([s0 - 10 - r * 9 - (c > 0 ? 4.5 : 0), c * 3.5]);
  ais.forEach((a, i) => { a.initRace(slots[i][0], slots[i][1]); a.syncModel(0); });
  const ps = slots[Math.min(ais.length, slots.length - 1)];
  player.initRace(ps[0], ps[1]);
  player.syncModel(0);
  camYaw = player.yaw;
}

// ---------------- race flow ----------------
function startRace() {
  if (loadingMap) return;
  audio.init(); audio.setMuted(settings.muted);
  Ads.interstitial('start', 'race_start', beginCountdown);
}

function beginCountdown() {
  showScreen(null);
  const diff = DIFF[settings.difficulty] || 1;
  for (const a of ais) a.skillMul = diff;
  skids.clear(); smoke.clear();
  placeGrid();
  raceTime = 0; countdown = 0; lightsLit = 0; goDelay = 0.6 + Math.random() * 0.9; camT = 0;
  for (const l of lamps) l.emissiveIntensity = 0;
  resultsTimer = -1;
  state = 'countdown';
  $('hud').hidden = false;
  $('touch').hidden = !isTouch;
  $('touchShift').hidden = settings.trans !== 'manual';
  hud.resize();
  hud.set('lapOf', hud.el.lapOf, '/' + settings.laps);
  hud.set('posOf', hud.el.posOf, '/' + cars.length);
  hud.set('best', hud.el.best, fmtTime(bestLap));
  hud.clearMessage();
}

function rubber(ai) {
  const gap = player.raceDist - ai.raceDist;
  return (ai.skillMul || 1) * (1 + clamp(gap / 600, -0.05, 0.05));
}

function lapCheck(c) {
  if (c.finished) return;
  const L = track.length;
  const done = c.raceDist >= 0 ? Math.floor(c.raceDist / L) : -1;
  if (done > c.lapsDone && done >= 1) {
    const lt = raceTime - c.lastLapStart;
    c.lapTimes.push(lt); c.lastLapStart = raceTime; c.lapsDone = done;
    if (c.isPlayer) {
      const isBest = !bestLap || lt < bestLap;
      if (isBest) { bestLap = lt; store.set(bestKey(), lt); hud.set('best', hud.el.best, fmtTime(bestLap)); }
      if (done >= settings.laps) return finishCar(c);
      hud.message(done === settings.laps - 1 ? 'FINAL LAP' : `LAP ${done + 1}`, `${fmtTime(lt)}${isBest ? '  ·  BEST LAP' : ''}`, 2.2, isBest ? 'purple' : '');
      audio.beep(988, 0.12, 0.18);
    } else if (done >= settings.laps) finishCar(c);
  } else if (done < c.lapsDone && c.raceDist >= 0) {
    c.lapsDone = done;
  }
}

function finishCar(c) {
  c.finished = true; c.finishTime = raceTime;
  if (c.isPlayer) {
    const pos = standings().indexOf(player) + 1;
    hud.message(pos === 1 ? 'VICTORY' : `P${pos}`, `Race time ${fmtTime(raceTime)}`, 4, pos === 1 ? 'gold' : '');
    audio.beep(660, 0.15, 0.2); setTimeout(() => audio.beep(880, 0.3, 0.2), 160);
    state = 'finished';
    resultsTimer = 3.5;
  }
}

function standings() {
  return [...cars].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.raceDist - a.raceDist;
  });
}

function showResults() {
  const list = standings();
  const L = track.length, total = settings.laps * L;
  const rows = list.map((c, i) => {
    let t;
    if (c.finished) t = fmtTime(c.finishTime);
    else {
      const avg = Math.max(10, c.raceDist / Math.max(1, raceTime));
      t = '~' + fmtTime(raceTime + (total - c.raceDist) / avg);
    }
    const best = c.lapTimes.length ? fmtTime(Math.min(...c.lapTimes)) : '—';
    return `<tr class="${c.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td><i style="background:#${c.m.paint.color.getHexString()}"></i>${c.name}<span class="carname">${c.m.model.name}</span></td><td>${t}</td><td>${best}</td></tr>`;
  }).join('');
  $('resRows').innerHTML = rows;
  const pos = list.indexOf(player) + 1;
  $('resTitle').textContent = pos === 1 ? 'Victory' : `You finished P${pos}`;
  $('resSub').textContent = `${currentMap.name} · ${settings.laps} lap${settings.laps > 1 ? 's' : ''} · ${DIFF_NAME[settings.difficulty] || ''} rivals · track record ${fmtTime(bestLap)}`;
  showScreen('results');
  offerReward();
  Ads.display($('adResults'), CONFIG.ads.resultsSlot);
}

function offerReward() {
  const btn = $('btnReward');
  btn.hidden = true;
  Ads.reward('double_nitro', {
    offer: (show) => { btn.hidden = false; btn.onclick = () => { btn.hidden = true; show(); }; },
    onReward: () => { player.nitroCap = 2; $('rewardNote').hidden = false; },
    onDone: (offered) => { if (!offered) btn.hidden = true; },
  });
}

function raceAgain() {
  Ads.interstitial('next', 'race_again', () => { beginCountdown(); if (player.nitroCap > 1) player.nitro = player.nitroCap; });
}

function toMenu() {
  state = 'menu'; paused = false;
  $('hud').hidden = true; $('touch').hidden = true;
  player.nitroCap = 1; $('rewardNote').hidden = true;
  audio.horn(false);
  placeGrid();
  setCockpit(false);
  for (const l of lamps) l.emissiveIntensity = 0;
  audio.idle();
  showScreen('menu');
  Ads.display($('adMenu'), CONFIG.ads.menuSlot);
}

function setPaused(p) {
  if (state !== 'racing' && state !== 'countdown' && state !== 'finished') return;
  if (!$('results').hidden) return;
  paused = p;
  showScreen(p ? 'pause' : null);
  if (p) { audio.horn(false); audio.suspend(); Ads.interstitial('pause', 'pause_menu'); } else audio.resume();
}

// ---------------- per-step simulation ----------------
const STEP = 1 / 120;
function step(h) {
  if (state === 'countdown') {
    countdown += h;
    const want = Math.min(5, Math.floor(countdown / 0.85));
    if (want > lightsLit && countdown > 0.85) {
      lightsLit = want;
      for (let k = 0; k < 5; k++) lamps[k].emissiveIntensity = k < lightsLit ? 6 : 0;
      audio.beep(440, 0.16, 0.22);
    }
    if (lightsLit >= 5 && countdown > 5 * 0.85 + goDelay) {
      for (const l of lamps) l.emissiveIntensity = 0;
      state = 'racing'; raceTime = 0;
      hud.message('GO!', '', 1.0, 'go');
      audio.beep(880, 0.4, 0.28);
      for (const c of cars) c.lastLapStart = 0;
    }
    player.update(h, input, false);
    for (const a of ais) a.update(h, { go: false, cars, rubber });
    return;
  }
  if (state !== 'racing' && state !== 'finished') return;
  raceTime += h;
  player.update(h, input, state === 'racing');
  const ctx = { go: true, cars, rubber };
  for (const a of ais) a.update(h, ctx);
  collide();
  for (const c of cars) lapCheck(c);
}

const _c = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()];
function collide() {
  const p = player, R = 1.02;
  const ps = Math.sin(p.yaw), pc = Math.cos(p.yaw);
  for (const a of ais) {
    const dx0 = p.pos.x - a.pos.x, dz0 = p.pos.z - a.pos.z;
    if (dx0 * dx0 + dz0 * dz0 > 36) continue;
    const as = Math.sin(a.yaw), ac = Math.cos(a.yaw);
    _c[0].set(p.pos.x + ps * 1.15, p.pos.z + pc * 1.15); _c[1].set(p.pos.x - ps * 1.15, p.pos.z - pc * 1.15);
    _c[2].set(a.pos.x + as * 1.15, a.pos.z + ac * 1.15); _c[3].set(a.pos.x - as * 1.15, a.pos.z - ac * 1.15);
    for (let i = 0; i < 2; i++) for (let j = 2; j < 4; j++) {
      let nx = _c[i].x - _c[j].x, nz = _c[i].y - _c[j].y;
      const d = Math.hypot(nx, nz);
      if (d >= R * 2 || d < 1e-4) continue;
      nx /= d; nz /= d;
      const over = R * 2 - d;
      p.pos.x += nx * over * 0.6; p.pos.z += nz * over * 0.6;
      const f = track.frameAt(a.s);
      a.lane -= (nx * f.rx + nz * f.rz) * over * 0.4;
      a.s -= (nx * f.tx + nz * f.tz) * over * 0.4;
      const avx = Math.sin(a.yaw) * a.v, avz = Math.cos(a.yaw) * a.v;
      const rel = (p.vx - avx) * nx + (p.vz - avz) * nz;
      if (rel < 0) {
        p.vx -= nx * rel * 1.25; p.vz -= nz * rel * 1.25;
        a.v = Math.max(0, a.v + rel * 0.25 * (nx * f.tx + nz * f.tz));
        if (-rel > 2) { audio.crash(-rel * 1.4); camShake = Math.min(1, camShake + -rel * 0.05); }
      }
    }
  }
}

// ---------------- camera ----------------
function setCockpit(on) {
  player?.m.setInterior(on);
  camera.near = on ? 0.03 : 0.1; camera.updateProjectionMatrix();
  $('hud').classList.toggle('cockpit', on);
  hud.resize?.();
}

function cycleCamera(to) {
  camMode = to ?? (camMode + 1) % CAMS.length;
  camPos.set(0, 0, 0);
  setCockpit(CAMS[camMode].cockpit === true);
  if (state === 'racing' || state === 'countdown') hud.message('', CAMS[camMode].name + ' camera', 0.9);
}

const _eye = new THREE.Vector3(), _fwd = new THREE.Vector3(), _q = new THREE.Quaternion();
function updateCamera(dt) {
  const p = player;
  const speed = Math.abs(p.vF);
  const k = 1 - Math.exp(-dt * (state === 'countdown' ? 3 : 6));
  let dy = p.yaw - camYaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
  camYaw += dy * (1 - Math.exp(-dt * 5.5));
  lookBackK += ((input.lookBack ? 1 : 0) - lookBackK) * Math.min(1, dt * 12);
  const back = lookBackK > 0.5;
  const mode = CAMS[camMode];
  let fovT = 58 + speed * 0.16 + (p.nitroOn ? 7 : 0);
  if (mode.cockpit) {
    p.m.body.updateWorldMatrix(true, false);
    _eye.copy(p.m.eye); p.m.body.localToWorld(_eye);
    p.m.body.getWorldQuaternion(_q);
    const lookYaw = back ? Math.PI : -p.yawRate * 0.12 - p.steerIn * 0.05;
    _fwd.set(Math.sin(lookYaw), -0.06, Math.cos(lookYaw)).applyQuaternion(_q);
    camera.position.copy(_eye);
    if (camShake > 0.01) camera.position.y += (Math.random() - 0.5) * camShake * 0.03;
    camLook.copy(_eye).addScaledVector(_fwd, 10);
    fovT = 64 + speed * 0.12 + (p.nitroOn ? 5 : 0);
  } else if (mode.hood) {
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), b = back ? -1 : 1;
    camera.position.set(p.pos.x + fx * (back ? -2.6 : 2.0), p.pos.y + 0.62, p.pos.z + fz * (back ? -2.6 : 2.0));
    camLook.set(p.pos.x + fx * 30 * b, p.pos.y + 0.55 + Math.sin(p.pitch) * -30, p.pos.z + fz * 30 * b);
    fovT += 6;
  } else {
    let dist = mode.dist + speed * 0.02, hgt = mode.h;
    let yaw = camYaw + (back ? Math.PI : 0);
    if (state === 'countdown') {
      camT = Math.min(1, camT + dt / 3.2);
      const e = 1 - Math.pow(1 - camT, 3);
      yaw = p.yaw + (1 - e) * 2.6;
      dist = mode.dist + (1 - e) * 2.5; hgt = mode.h - (1 - e) * 0.9;
    }
    let tx = p.pos.x - Math.sin(yaw) * dist, tz = p.pos.z - Math.cos(yaw) * dist;
    camIdx = track.nearest(tx, tz, p.idx);
    const cl = (tx - track.px[camIdx]) * track.rx[camIdx] + (tz - track.pz[camIdx]) * track.rz[camIdx];
    const lim = track.wallOff - 0.6;
    if (Math.abs(cl) > lim) { const e = cl - Math.sign(cl) * lim; tx -= track.rx[camIdx] * e; tz -= track.rz[camIdx] * e; }
    const ty = p.pos.y + hgt;
    const far = (camPos.x - tx) ** 2 + (camPos.z - tz) ** 2 > 900;
    if (camPos.lengthSq() === 0 || far || state === 'countdown' || Math.abs(lookBackK - 0.5) < 0.2) camPos.set(tx, ty, tz);
    camPos.x += (tx - camPos.x) * Math.min(1, k * 2.2); camPos.z += (tz - camPos.z) * Math.min(1, k * 2.2);
    camPos.y += (ty - camPos.y) * k;
    camPos.y = Math.max(camPos.y, track.py[camIdx] + 0.9);
    camera.position.copy(camPos);
    const ly = yaw - (back ? 0 : 0);
    camLook.set(p.pos.x + Math.sin(back ? ly : p.yaw) * 2, p.pos.y + mode.look, p.pos.z + Math.cos(back ? ly : p.yaw) * 2);
  }
  if (p.offroad && speed > 5) camShake = Math.max(camShake, Math.min(0.35, speed / 120));
  if (p.impact > 2) camShake = Math.min(1, camShake + p.impact * 0.05);
  if (camShake > 0.01 && !mode.cockpit) {
    const s = camShake * 0.12;
    camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s;
  }
  camShake *= Math.exp(-dt * 6);
  camera.lookAt(camLook);
  camera.fov += (fovT - camera.fov) * (1 - Math.exp(-dt * 3));
  camera.updateProjectionMatrix();
}

function updateMenuCamera(dt) {
  menuAngle += dt * 0.07;
  const p = player.pos;
  const r = 9.5 + Math.sin(menuAngle * 0.7) * 1.5;
  camera.position.set(p.x + Math.cos(menuAngle) * r, p.y + 1.6 + Math.sin(menuAngle * 0.5) * 0.5, p.z + Math.sin(menuAngle) * r);
  camera.lookAt(p.x, p.y + 0.7, p.z + 3);
  camera.fov = 45; camera.updateProjectionMatrix();
}

// ---------------- visual FX per frame ----------------
const _a0 = new THREE.Vector3(), _b0 = new THREE.Vector3(), _a1 = new THREE.Vector3(), _b1 = new THREE.Vector3();
const skidPrev = [null, null];
function updateFx(dt) {
  const p = player, mdl = p.m.model;
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw), rx = -cy, rz = sy;
  const sliding = p.slip > 4.5 && Math.abs(p.vF) > 6;
  const heavyBrake = input.brake > 0.5 && p.vF > 25 && state === 'racing';
  const snowy = currentMap.theme.ground === 'snow';
  [-1, 1].forEach((side, w) => {
    const ox = side * mdl.trackX, oz = mdl.wheelZ[1];
    const wx = p.pos.x - rx * ox + sy * oz, wz = p.pos.z - rz * ox + cy * oz;
    const y = p.pos.y + 0.025;
    const spin = p.wheelspin > 0.25;
    if ((sliding || spin || heavyBrake && p.slip > 1.5) && !p.offroad) {
      _a1.set(wx + rx * 0.13, y, wz + rz * 0.13); _b1.set(wx - rx * 0.13, y, wz - rz * 0.13);
      const prev = skidPrev[w];
      if (prev) {
        _a0.copy(prev.a); _b0.copy(prev.b);
        if (_a0.distanceToSquared(_a1) > 0.04) { skids.add(_a0, _b0, _a1, _b1); prev.a.copy(_a1); prev.b.copy(_b1); }
      } else skidPrev[w] = { a: _a1.clone(), b: _b1.clone() };
      if (Math.random() < Math.min(1, p.slip / 10 + p.wheelspin) * dt * 40)
        smoke.spawn(wx, y + 0.2, wz, (Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2, 0.42, 0.42, 0.44, 0.9, 0.22, 1.6);
    } else skidPrev[w] = null;
    if (p.offroad && Math.abs(p.vF) > 8 && Math.random() < dt * 30) {
      const c = snowy ? [0.9, 0.92, 0.95] : currentMap.theme.ground === 'sand' ? [0.55, 0.42, 0.28] : [0.3, 0.25, 0.18];
      smoke.spawn(wx, y + 0.3, wz, -p.vx * 0.1, 0.8, -p.vz * 0.1, c[0], c[1], c[2], 1.1, 0.3, 1.2);
    }
  });
  smoke.update(dt);
  const fl = p.nitroOn;
  for (const f of p.m.flames) { f.visible = fl; if (fl) f.scale.set(1, 1, 0.7 + Math.random() * 0.6); }
}

// ---------------- HUD per frame ----------------
function updateHud(dt) {
  const p = player;
  const list = standings();
  const pos = list.indexOf(p) + 1;
  hud.set('pos', hud.el.pos, String(pos));
  const lap = clamp(p.raceDist >= 0 ? Math.floor(p.raceDist / track.length) + 1 : 1, 1, settings.laps);
  hud.set('lap', hud.el.lap, String(lap));
  const cur = state === 'racing' ? raceTime - p.lastLapStart : 0;
  hud.set('cur', hud.el.cur, fmtTime(cur));
  hud.set('total', hud.el.total, fmtTime(raceTime));
  hud.el.nitro.style.transform = `scaleX(${(p.nitro / Math.max(1, p.nitroCap)).toFixed(3)})`;
  hud.el.nitro.classList.toggle('on', p.nitroOn);
  hud.el.nitro.parentElement.classList.toggle('x2', p.nitroCap > 1);
  const kmh = Math.abs(p.vF) * 3.6;
  if (CAMS[camMode].cockpit && (dashTick = (dashTick + 1) % 2) === 0) {
    hud.drawDash(p.m.dashCanvas, kmh, p.rpm, REDLINE, p.gearLabel(), p.nitroOn, p.nitro / Math.max(1, p.nitroCap));
    p.m.dashTex.needsUpdate = true;
  }
  hud.drawSpeedo(kmh, p.rpm, REDLINE, p.gearLabel(), p.nitroOn, p.manual);
  hud.drawMap(cars, p);
  hud.board(list, pos);
  if (p.wrongWay && state === 'racing') { lastWrongWay += dt; if (lastWrongWay > 1) { hud.message('WRONG WAY', 'Turn around or press R', 0.6, 'warn'); } }
  else lastWrongWay = 0;
  hud.tick(dt);
  if (showFps) {
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { hud.el.fps.textContent = Math.round(fpsN / fpsAcc) + ' FPS · ' + renderer.info.render.calls + ' draws'; fpsAcc = 0; fpsN = 0; }
  }
}

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let acc = 0;
function frame() {
  requestAnimationFrame(frame);
  let dt = Math.min(clock.getDelta(), 0.1);
  if (document.hidden) return;
  input.poll();
  if (paused || adPause) dt = 0;

  if (state === 'menu' || state === 'loading') {
    updateMenuCamera(dt);
    for (const c of cars) c.syncModel(0);
  } else if (dt > 0) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 14) { step(STEP); acc -= STEP; n++; }
    if (n === 14) acc = 0;
    for (const c of cars) c.syncModel(dt);
    updateCamera(dt);
    updateFx(dt);
    updateHud(dt);
    audio.update(player.rpm, player.thr, Math.abs(player.vF), player.slip + player.wheelspin * 8, player.offroad, player.nitroOn, player.limiter);
    audio.horn(input.horn && (state === 'racing' || state === 'countdown' || state === 'finished'));
    if (player.impact > 2) audio.crash(player.impact);
    if (resultsTimer > 0) { resultsTimer -= dt; if (resultsTimer <= 0) showResults(); }
  }
  if (track) track.update(dt, camera.position);

  const f = player ? player.pos : camera.position;
  sun.target.position.set(Math.round(f.x), f.y, Math.round(f.z));
  sun.position.copy(sun.target.position).addScaledVector(lightDir, 300);
  if (moon) moon.position.copy(camera.position).addScaledVector(lightDir, 5000);
  if (smoke) smoke.mat.uniforms.uScale.value = (renderer.domElement.height) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));

  composer.render();
}

// ---------------- UI ----------------
const screens = ['menu', 'pause', 'results', 'howto'];
function showScreen(name) { for (const s of screens) $(s).hidden = s !== name; }

function bindSeg(id, key, cast = (v) => v, onChange) {
  const root = $(id);
  const btns = [...root.querySelectorAll('button')];
  const refresh = () => btns.forEach((b) => b.setAttribute('aria-pressed', String(String(settings[key]) === b.dataset.v)));
  btns.forEach((b) => b.addEventListener('click', () => {
    settings[key] = cast(b.dataset.v); store.set(key, settings[key]); refresh(); onChange?.(settings[key]);
  }));
  refresh();
  return refresh;
}

function applyQuality() {
  Q = qualityPreset(settings.quality);
  renderer.setPixelRatio(Q.pr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyShadowQuality();
  track?.setTreeDensity(Q.trees);
  if (composer) buildComposer();
  const px = Math.round(window.innerWidth * Q.pr) + '×' + Math.round(window.innerHeight * Q.pr);
  $('qNote').textContent = `Rendering at ${px}`;
}

function drawTrackPreview(cv, map) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  const curve = new THREE.CatmullRomCurve3(map.ctrl.map((p) => new THREE.Vector3(p[0], p[1], p[2])), true, 'centripetal');
  const pts = curve.getSpacedPoints(160);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const pad = 10, sc = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
  const ox = (W - (maxX - minX) * sc) / 2, oy = (H - (maxZ - minZ) * sc) / 2;
  const xy = (p) => [W - (ox + (p.x - minX) * sc), H - (oy + (p.z - minZ) * sc)];
  c.clearRect(0, 0, W, H);
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = 'rgba(238,242,246,0.9)'; c.lineWidth = 4;
  c.beginPath(); pts.forEach((p, i) => { const [x, y] = xy(p); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
  const s = new THREE.Vector3(map.start[0], 0, map.start[1]);
  let best = pts[0]; for (const p of pts) if (p.distanceToSquared(s) < best.distanceToSquared(s)) best = p;
  const [sx, sy] = xy(best); c.fillStyle = '#ffc81f'; c.beginPath(); c.arc(sx, sy, 5, 0, Math.PI * 2); c.fill();
  return curve.getLength();
}

function setupUI() {
  // tracks
  const mg = $('mapGrid');
  MAPS.forEach((m) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'card map'; b.dataset.id = m.id;
    b.innerHTML = `<canvas width="160" height="96" aria-hidden="true"></canvas><span class="nm">${m.name}</span><span class="meta">${m.time} · <i></i></span>`;
    const len = drawTrackPreview(b.querySelector('canvas'), m);
    b.querySelector('i').textContent = (len / 1000).toFixed(1) + ' km';
    b.setAttribute('aria-pressed', String(m.id === settings.map));
    b.addEventListener('click', async () => {
      if (loadingMap || settings.map === m.id) return;
      mg.querySelectorAll('.card').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      settings.map = m.id; store.set('map', m.id);
      await loadMap(m.id);
    });
    mg.appendChild(b);
  });
  // cars
  const cg = $('carGrid');
  const bar = (v) => `<b style="--v:${Math.round(v * 100)}%"></b>`;
  MODELS.forEach((m) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'card car'; b.dataset.id = m.id;
    const s = m.stats;
    b.innerHTML = `<span class="nm">${m.name}</span><span class="meta">${m.tag}</span>
      <span class="stat"><em>Power</em>${bar((s.power - 450) / 400)}</span>
      <span class="stat"><em>Grip</em>${bar((s.grip - 14) / 6)}</span>
      <span class="stat"><em>Top</em>${bar((s.top - 65) / 30)}</span>
      <span class="top">${Math.round(s.top * 3.6)} km/h</span>`;
    b.setAttribute('aria-pressed', String(m.id === settings.car));
    b.addEventListener('click', () => {
      if (loadingMap) return;
      cg.querySelectorAll('.card').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      settings.car = m.id; store.set('car', m.id);
      createCars(); placeGrid();
    });
    cg.appendChild(b);
  });
  // paint
  const sw = $('swatches');
  PAINTS.forEach(([name, hex], i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sw'; b.title = name; b.setAttribute('aria-label', name);
    b.style.setProperty('--c', '#' + hex.toString(16).padStart(6, '0'));
    b.setAttribute('aria-pressed', String(i === settings.paint));
    b.addEventListener('click', () => {
      sw.querySelectorAll('.sw').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true'); $('paintName').textContent = name;
      settings.paint = i; store.set('paint', i);
      if (track && !loadingMap) { createCars(); placeGrid(); }
    });
    sw.appendChild(b);
  });
  $('paintName').textContent = PAINTS[settings.paint]?.[0] || '';
  bindSeg('segLaps', 'laps', Number);
  bindSeg('segDiff', 'difficulty');
  const refreshTrans = bindSeg('segTrans', 'trans', String, (v) => player?.setTransmission(v === 'manual'));
  bindSeg('segQual', 'quality', String, applyQuality);
  applyQuality();

  $('btnStart').addEventListener('click', startRace);
  $('btnHow').addEventListener('click', () => showScreen('howto'));
  $('btnHowBack').addEventListener('click', () => showScreen('menu'));
  $('btnFull').addEventListener('click', toggleFullscreen);
  $('btnResume').addEventListener('click', () => setPaused(false));
  $('btnRestart').addEventListener('click', () => { paused = false; audio.resume(); raceAgain(); });
  $('btnQuit').addEventListener('click', () => { audio.resume(); toMenu(); });
  $('btnAgain').addEventListener('click', raceAgain);
  $('btnMenu').addEventListener('click', toMenu);
  $('btnPauseTouch').addEventListener('click', () => setPaused(true));

  const racing = () => (state === 'racing' || state === 'countdown' || state === 'finished') && !paused;
  input.on('pause', () => { if ($('howto').hidden === false) return showScreen('menu'); setPaused(!paused); });
  input.on('camera', () => { if (racing()) cycleCamera(); });
  input.on('cockpit', () => { if (racing()) cycleCamera(CAMS[camMode].cockpit ? 0 : 2); });
  input.on('reset', () => { if (state === 'racing' && !paused) { player.respawn(); camYaw = player.yaw; camIdx = player.idx; camPos.set(0, 0, 0); } });
  input.on('shiftUp', () => { if (racing() && player.manual) player.shift(1); });
  input.on('shiftDown', () => { if (racing() && player.manual) player.shift(-1); });
  input.on('transmission', () => {
    if (!racing()) return;
    settings.trans = player.manual ? 'auto' : 'manual'; store.set('trans', settings.trans);
    player.setTransmission(settings.trans === 'manual'); refreshTrans();
    $('touchShift').hidden = settings.trans !== 'manual';
    hud.message('', settings.trans === 'manual' ? 'Manual gearbox · Q / E to shift' : 'Automatic gearbox', 1.4);
  });
  input.on('mute', () => { settings.muted = !settings.muted; store.set('muted', settings.muted); audio.setMuted(settings.muted); Ads.setSound(!settings.muted); });
  input.on('fps', () => { showFps = !showFps; hud.el.fps.hidden = !showFps; });
  input.bindTouch($('touch'));
  $('touchCam').addEventListener('click', () => { if (racing()) cycleCamera(); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'racing' && !paused) setPaused(true);
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    if (settings.quality === 'ultra') Q = qualityPreset('ultra');
    renderer.setPixelRatio(Q.pr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer?.setPixelRatio(Q.pr);
    composer?.setSize(window.innerWidth, window.innerHeight);
    hud.resize();
  });
}

function toggleFullscreen() {
  const d = document;
  try {
    if (!d.fullscreenElement) d.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.catch(() => {});
    else d.exitFullscreen?.()?.catch(() => {});
  } catch { /* not supported */ }
}

// ---------------- boot ----------------
(async function boot() {
  setupUI();
  try {
    await build();
  } catch (e) {
    console.error(e);
    $('loadText').textContent = 'Something went wrong while building the world: ' + e.message;
    return;
  }
  frame();
  Ads.init(() => {
    $('loading').classList.add('done');
    setTimeout(() => ($('loading').hidden = true), 600);
    state = 'menu';
    showScreen('menu');
    Ads.display($('adMenu'), CONFIG.ads.menuSlot);
  }, {
    pause: () => { adPause = true; audio.suspend(); },
    resume: () => { adPause = false; if (!paused) audio.resume(); },
  });
})();

// debug / automated-test handle
window.__apex = {
  sim(sec) { player.auto = true; for (let t = 0; t < sec; t += STEP) step(STEP); player.auto = false; for (const c of cars) c.syncModel(0); },
  showResults, scene, loadMap, cycleCamera,
  get state() { return state; }, get player() { return player; }, get cars() { return cars; }, get raceTime() { return raceTime; }, get track() { return track; }, renderer,
};
