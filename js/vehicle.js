// Vehicle dynamics (player) and AI drivers.
import * as THREE from 'three';

const WHEELBASE = 2.8;
const GEAR_TOP = [0, 17, 28, 40, 53, 67, 95]; // m/s at redline per gear
export const REDLINE = 8000;

const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

class Base {
  constructor(model, track, name) {
    this.m = model; this.track = track; this.name = name;
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.vF = 0; this.steer = 0; this.wheelRot = 0;
    this.raceDist = 0; this.finished = false; this.finishTime = 0;
    this.lapTimes = []; this.lapsDone = 0; this.lastLapStart = 0;
    this.pitch = 0; this.roll = 0; this.bodyPitch = 0; this.lat = 0;
    this.brakeLight = 0;
  }
  // sync 3D model with physics state
  syncModel(dt) {
    const m = this.m;
    m.group.position.copy(this.pos);
    m.group.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    m.body.rotation.z += (this.roll - m.body.rotation.z) * Math.min(1, dt * 6);
    m.body.rotation.x += (this.bodyPitch - m.body.rotation.x) * Math.min(1, dt * 6);
    m.body.position.y = 0.02 * Math.sin(this.wheelRot * 0.37) * Math.min(1, Math.abs(this.vF) / 30) * (this.offroad ? 4 : 1);
    this.wheelRot += (this.vF / 0.345) * dt;
    for (const w of m.wheels) {
      w.spin.rotation.x = this.wheelRot;
      if (w.front) w.pivot.rotation.y = -this.steer * 1.4;
    }
    m.tailM.emissiveIntensity = 1.0 + this.brakeLight * 4;
  }
}

export class PlayerCar extends Base {
  constructor(model, track, name) {
    super(model, track, name);
    this.vx = 0; this.vz = 0; this.vR = 0;
    this.idx = 0; this.kAcc = 0;
    this.rpm = 900; this.gear = 1; this.throttle = 0;
    this.nitro = 1; this.nitroCap = 1; this.nitroOn = false;
    this.offroad = false; this.impact = 0; this.slip = 0; this.accLong = 0; this.latAcc = 0;
    this.wrongWay = false; this.isPlayer = true;
  }

  place(s, lat) {
    const T = this.track, f = T.frameAt(s);
    this.pos.set(f.x + f.rx * lat, f.y, f.z + f.rz * lat);
    this.yaw = Math.atan2(f.tx, f.tz);
    this.vx = this.vz = this.vF = this.vR = 0; this.steer = 0;
    this.idx = T.nearestGlobal(this.pos.x, this.pos.z);
  }

  initRace(s, lat) {
    this.place(s, lat);
    this.kAcc = this.idx;
    this.raceDist = this.kAcc * this.track.ds - this.track.sStart;
    this.finished = false; this.lapTimes = []; this.lapsDone = 0; this.lastLapStart = 0;
    this.nitro = this.nitroCap;
  }

  respawn() {
    const T = this.track;
    const s = this.idx * T.ds;
    const lat = clamp(this.lat, -T.halfW + 2, T.halfW - 2);
    const i0 = this.idx;
    this.place(s, lat);
    let d = this.idx - i0; if (d > T.N / 2) d -= T.N; else if (d < -T.N / 2) d += T.N;
    this.kAcc += d;
  }

  update(h, inp, control, raceLaps) {
    const T = this.track, N = T.N;
    let thr = control ? inp.throttle : 0, brk = control ? inp.brake : 0, st = control ? inp.steer : 0;
    let hb = control && inp.handbrake, nit = control && inp.nitro;
    if (this.finished || this.auto) {
      // autopilot (cool-down lap after the flag; also used by automated tests): ease off and follow the road
      const i = this.idx, ty = Math.atan2(T.tx[i], T.tz[i]);
      st = clamp(-angDiff(ty, this.yaw) * 2.2 - this.lat * 0.06, -1, 1);
      const vT = this.finished ? 22 : T.vlim[(i + 25) % N] * 0.9;
      thr = this.vF < vT ? 1 : 0; brk = this.vF > vT + 3 ? 0.6 : 0; hb = false; nit = false;
    }
    this.throttle = thr;
    let sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let vF = this.vx * sy + this.vz * cy;
    let vR = -this.vx * cy + this.vz * sy;
    const speed = Math.abs(vF);

    // steering (speed-sensitive)
    const maxSteer = 0.6 / (1 + Math.pow(speed / 14, 1.3));
    const target = st * maxSteer;
    this.steer += (target - this.steer) * Math.min(1, h * (Math.abs(st) > 0.05 ? 7 : 10));

    // nitro
    this.nitroOn = nit && this.nitro > 0.005 && thr > 0.1 && vF > 2 && !this.offroad;
    if (this.nitroOn) this.nitro = Math.max(0, this.nitro - h * 0.17);
    else this.nitro = Math.min(this.nitroCap, this.nitro + h * 0.022);

    // longitudinal
    const top = (this.nitroOn ? 93 : 80) * (this.offroad ? 0.5 : 1);
    let acc = 0;
    if (thr > 0) {
      if (vF < -0.5) acc += 24 * thr;
      else {
        const x = Math.max(0, vF) / top;
        acc += x < 1 ? thr * (13.5 * (1 - Math.pow(x, 1.7)) + (this.nitroOn ? 9 : 0)) : 0;
      }
    }
    if (brk > 0) {
      if (vF > 0.8) acc -= 33 * brk * (this.offroad ? 0.55 : 1);
      else if (vF > -15) acc -= 10 * brk;
    }
    acc -= 0.00095 * vF * Math.abs(vF) + (this.offroad ? 0.16 : 0.03) * vF;
    if (thr < 0.05 && brk < 0.05) acc -= Math.sign(vF) * Math.min(Math.abs(vF) / h, 1.4);
    if (hb) acc -= Math.sign(vF) * Math.min(Math.abs(vF) / h, 4.5);
    const prev = vF;
    vF += acc * h;
    if (brk > 0 && prev > 0 && vF < 0 && thr < 0.05) vF = 0;
    this.accLong = acc;
    this.brakeLight = brk > 0.05 && vF > 0.5 ? 1 : 0;

    // yaw with grip limit (understeer) and handbrake rotation
    let yawRate = (vF / WHEELBASE) * Math.tan(this.steer);
    const aMax = (this.offroad ? 9 : 17.5);
    const maxRate = aMax / Math.max(speed, 1);
    if (Math.abs(yawRate) > maxRate) yawRate = Math.sign(yawRate) * maxRate;
    if (hb && speed > 6) yawRate *= 1.8;
    this.yaw -= yawRate * h;
    this.latAcc = vF * yawRate;

    // re-project world velocity onto new heading, tyres bleed off lateral slide
    const wx = sy * vF - cy * vR, wz = cy * vF + sy * vR;
    sy = Math.sin(this.yaw); cy = Math.cos(this.yaw);
    vF = wx * sy + wz * cy; vR = -wx * cy + wz * sy;
    const grip = this.offroad ? 4 : hb ? 0.9 : 10;
    const before = vR;
    vR *= Math.exp(-grip * h);
    const loss = Math.abs(before - vR) * 0.15;
    vF -= Math.sign(vF) * Math.min(Math.abs(vF), loss);
    this.vx = sy * vF - cy * vR; this.vz = cy * vF + sy * vR;
    this.vF = vF; this.vR = vR; this.slip = Math.abs(vR);

    this.pos.x += this.vx * h; this.pos.z += this.vz * h;

    // track constraints
    const i = T.nearest(this.pos.x, this.pos.z, this.idx);
    let d = i - this.idx; if (d > N / 2) d -= N; else if (d < -N / 2) d += N;
    this.kAcc += d; this.idx = i;
    const dx = this.pos.x - T.px[i], dz = this.pos.z - T.pz[i];
    const along = dx * T.tx[i] + dz * T.tz[i];
    let lat = dx * T.rx[i] + dz * T.rz[i];
    const j = along >= 0 ? (i + 1) % N : (i - 1 + N) % N;
    const roadY = T.py[i] + (T.py[j] - T.py[i]) * Math.min(1, Math.abs(along) / T.ds);
    this.offroad = Math.abs(lat) > T.halfW + 1.0;
    this.pos.y = this.offroad ? roadY - 0.03 : roadY;

    this.impact = 0;
    const wall = T.wallOff - 1.0;
    if (Math.abs(lat) > wall) {
      const sg = Math.sign(lat), over = Math.abs(lat) - wall;
      const nx = T.rx[i] * sg, nz = T.rz[i] * sg;
      this.pos.x -= nx * over; this.pos.z -= nz * over;
      const vn = this.vx * nx + this.vz * nz;
      if (vn > 0) {
        this.vx -= nx * vn * 1.3; this.vz -= nz * vn * 1.3;
        const k = clamp(1 - vn * 0.022, 0.6, 0.985);
        this.vx *= k; this.vz *= k;
        this.impact = vn;
        let ty = Math.atan2(T.tx[i], T.tz[i]);
        if (Math.cos(this.yaw - ty) < 0) ty += Math.PI;
        this.yaw += angDiff(ty, this.yaw) * Math.min(0.5, vn * 0.03);
      }
      lat = sg * wall;
    }
    this.lat = lat;
    this.raceDist = this.kAcc * T.ds + along - T.sStart;

    // attitude
    const slope = (T.py[(i + 3) % N] - T.py[(i - 3 + N) % N]) / (6 * T.ds);
    const fwd = Math.sin(this.yaw) * T.tx[i] + Math.cos(this.yaw) * T.tz[i];
    this.pitch = -Math.atan(slope * fwd);
    this.roll = clamp(-this.latAcc * 0.0042, -0.075, 0.075);
    this.bodyPitch = clamp(-this.accLong * 0.0035, -0.045, 0.06);
    this.wrongWay = fwd < -0.35 && this.vF > 4;

    // gearbox & rpm
    if (vF < -0.5) { this.gear = -1; }
    else {
      let g = 1; while (g < 6 && speed > GEAR_TOP[g] * 0.96) g++;
      this.gear = g;
    }
    const gt = GEAR_TOP[Math.max(1, this.gear)];
    let rpmT = 900 + (speed / gt) * (REDLINE - 900);
    if (this.gear === 1 && thr > 0.1) rpmT = Math.max(rpmT, 1800 + thr * 2600);
    if (!control && !this.finished) rpmT = 900 + inp.throttle * 6500; // revving on the grid
    this.rpm += (Math.min(REDLINE + 150, rpmT) - this.rpm) * Math.min(1, h * 14);
  }
}

export class AICar extends Base {
  constructor(model, track, name, skill) {
    super(model, track, name);
    this.skill = skill; this.s = 0; this.v = 0;
    this.lane = 0; this.laneVel = 0; this.bias = (Math.random() - 0.5) * 2.5;
    this.offroad = false; this.isPlayer = false;
  }
  initRace(s, lat) {
    this.s = s; this.v = 0; this.lane = lat; this.laneVel = 0;
    this.raceDist = s - this.track.sStart; this.finished = false; this.lapTimes = []; this.lapsDone = 0; this.lastLapStart = 0;
    this.placeModel(0);
  }
  update(h, ctx) {
    const T = this.track, N = T.N, L = T.length;
    const i = T.idxAt(this.s);
    let vT = Math.min(T.vlim[i], T.vlim[(i + 6) % N]) * this.skill * ctx.rubber(this);
    if (this.finished) vT = Math.min(vT, 30);
    if (!ctx.go) vT = 0;

    // traffic awareness (including player)
    let blocked = null, bestGap = 1e9;
    for (const o of ctx.cars) {
      if (o === this) continue;
      let gap = (((o.raceDist - this.raceDist) % L) + L) % L; if (gap > L / 2) gap -= L;
      if (gap <= 0 || gap > 30) continue;
      if (Math.abs(o.lat - this.lane) < 2.4 && gap < bestGap) { bestGap = gap; blocked = o; }
    }
    const look = Math.floor(Math.max(14, this.v * 1.1) / T.ds);
    const ks = T.ks[(i + look) % N];
    let line = clamp(ks * 380, -1, 1) * (T.halfW - 2.4) + this.bias;
    if (blocked) {
      const ov = blocked.isPlayer ? blocked.vF : blocked.v;
      const side = blocked.lat > 0 ? -1 : 1;
      line = blocked.lat + side * 3.3;
      if (bestGap < 12 && Math.abs(blocked.lat - this.lane) < 2.0) vT = Math.min(vT, ov + (bestGap - 6) * 0.6);
    }
    const lim = T.halfW - 1.6;
    line = clamp(line, -lim, lim);

    const a = vT > this.v ? 11.5 * (1 - Math.pow(this.v / 90, 2)) : -15;
    this.v += clamp(vT - this.v, -Math.abs(a) * h * 2, Math.max(0, a) * h);
    this.v = Math.max(0, this.v);
    this.brakeLight = vT < this.v - 2 ? 1 : 0;

    const la = (line - this.lane) * 2.6 - this.laneVel * 2.4;
    this.laneVel = clamp(this.laneVel + la * h, -4, 4);
    this.lane = clamp(this.lane + this.laneVel * h, -lim, lim);
    this.s += this.v * h;
    this.raceDist = this.s - T.sStart;
    this.vF = this.v;
    this.lat = this.lane;
    this.placeModel(h);
  }
  placeModel() {
    const T = this.track, N = T.N;
    const f = T.frameAt(this.s);
    this.pos.set(f.x + f.rx * this.lane, f.y, f.z + f.rz * this.lane);
    const ty = Math.atan2(f.tx, f.tz);
    this.yaw = ty - Math.atan2(this.laneVel, Math.max(4, this.v));
    const i = f.i;
    const slope = (T.py[(i + 3) % N] - T.py[(i - 3 + N) % N]) / (6 * T.ds);
    this.pitch = -Math.atan(slope);
    const latAcc = this.v * this.v * T.ks[i];
    this.roll = clamp(-latAcc * 0.0042, -0.07, 0.07);
    this.steer = clamp(Math.atan(T.ks[i] * 2.8) + this.laneVel * 0.02, -0.3, 0.3);
    this.bodyPitch = this.brakeLight ? 0.03 : -0.01;
  }
}
