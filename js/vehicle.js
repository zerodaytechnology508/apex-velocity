// Vehicle dynamics (player) and AI drivers.
import * as THREE from 'three';

export const REDLINE = 8000;
const IDLE = 900;
const RATIOS = [0.205, 0.335, 0.475, 0.625, 0.79, 1.0]; // fraction of top speed reached at redline, gears 1..6
const TQ = [[0, 0.5], [0.15, 0.56], [0.3, 0.78], [0.45, 0.93], [0.62, 1.0], [0.8, 0.96], [0.92, 0.88], [1.0, 0.8]];

const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function torque(rpm) {
  const r = rpm / REDLINE;
  if (r >= 1.0) return 0; // rev limiter
  for (let i = 0; i < TQ.length - 1; i++) {
    if (r <= TQ[i + 1][0]) { const t = (r - TQ[i][0]) / (TQ[i + 1][0] - TQ[i][0]); return TQ[i][1] + (TQ[i + 1][1] - TQ[i][1]) * t; }
  }
  return 0.8;
}

class Base {
  constructor(model, track, name) {
    this.m = model; this.track = track; this.name = name;
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.vF = 0; this.steer = 0; this.wheelRot = 0;
    this.raceDist = 0; this.finished = false; this.finishTime = 0;
    this.lapTimes = []; this.lapsDone = 0; this.lastLapStart = 0;
    this.pitch = 0; this.roll = 0; this.bodyPitch = 0; this.lat = 0;
    this.brakeLight = 0; this.reverseLight = 0;
  }
  syncModel(dt) {
    const m = this.m;
    m.group.position.copy(this.pos);
    m.group.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const k = Math.min(1, dt * 6);
    m.body.rotation.z += (this.roll - m.body.rotation.z) * k;
    m.body.rotation.x += (this.bodyPitch - m.body.rotation.x) * k;
    m.body.position.y = 0.012 * Math.sin(this.wheelRot * 0.37) * Math.min(1, Math.abs(this.vF) / 30) * (this.offroad ? 4 : 1);
    this.wheelRot += (this.vF / m.model.wheelR) * dt;
    for (const w of m.wheels) {
      w.spin.rotation.x = this.wheelRot + (w.front ? 0 : this.spinExtra || 0);
      if (w.front) w.pivot.rotation.y = -this.steer * 1.25;
    }
    m.tailM.emissiveIntensity = 1.2 + this.brakeLight * 4.5;
    if (m.steerRot) m.steerRot.rotation.z = this.steerVis || 0;
  }
}

export class PlayerCar extends Base {
  constructor(model, track, name) {
    super(model, track, name);
    const st = model.model.stats;
    this.st = st;
    this.gearTop = RATIOS.map((r) => r * st.top * 1.04);
    this.vx = 0; this.vz = 0; this.vR = 0;
    this.idx = 0; this.kAcc = 0;
    this.rpm = IDLE; this.gear = 1; this.manual = false; this.shiftT = 0;
    this.thr = 0; this.brk = 0; this.steerIn = 0; this.yawRate = 0; this.gripF = 10;
    this.nitro = 1; this.nitroCap = 1; this.nitroOn = false;
    this.offroad = false; this.impact = 0; this.slip = 0; this.accLong = 0; this.latAcc = 0;
    this.wheelspin = 0; this.spinExtra = 0; this.limiter = false;
    this.wrongWay = false; this.isPlayer = true;
    this.onShift = null;
  }

  setTransmission(manual) { this.manual = manual; if (!manual && this.gear === 0) this.gear = 1; }

  place(s, lat) {
    const T = this.track, f = T.frameAt(s);
    this.pos.set(f.x + f.rx * lat, f.y, f.z + f.rz * lat);
    this.yaw = Math.atan2(f.tx, f.tz);
    this.vx = this.vz = this.vF = this.vR = 0; this.steer = 0; this.yawRate = 0; this.steerIn = 0;
    this.idx = T.nearestGlobal(this.pos.x, this.pos.z);
  }

  initRace(s, lat) {
    this.place(s, lat);
    this.kAcc = this.idx;
    this.raceDist = this.kAcc * this.track.ds - this.track.sStart;
    this.finished = false; this.lapTimes = []; this.lapsDone = 0; this.lastLapStart = 0;
    this.nitro = this.nitroCap; this.gear = 1; this.rpm = IDLE; this.shiftT = 0;
  }

  respawn() {
    const T = this.track;
    const lat = clamp(this.lat, -T.halfW + 2, T.halfW - 2);
    const i0 = this.idx;
    this.place(this.idx * T.ds, lat);
    let d = this.idx - i0; if (d > T.N / 2) d -= T.N; else if (d < -T.N / 2) d += T.N;
    this.kAcc += d;
    if (this.gear < 1) this.gear = 1;
  }

  shift(dir) {
    if (this.shiftT > 0) return false;
    const speed = Math.abs(this.vF);
    let g = this.gear + dir;
    if (g > 6 || g < -1) return false;
    if (g === -1 && speed > 2) return false;
    if (g >= 1 && dir < 0) { // money-shift protection
      const rpm = (speed / this.gearTop[g - 1]) * REDLINE;
      if (rpm > REDLINE + 400) { this.onShift?.('denied'); return false; }
    }
    if (this.gear === -1 && g === 0 && this.vF < -2) return false;
    this.gear = g; this.shiftT = 0.15;
    this.onShift?.(dir > 0 ? 'up' : 'down');
    return true;
  }

  _autoShift(thr, speed) {
    if (this.shiftT > 0 || this.gear < 1) return;
    const g = this.gear;
    const rpm = (speed / this.gearTop[g - 1]) * REDLINE;
    if (g < 6 && rpm > 7550 && thr > 0.05) { this.gear++; this.shiftT = 0.16; this.onShift?.('up'); return; }
    if (g > 1) {
      const down = (speed / this.gearTop[g - 2]) * REDLINE;
      const wantDown = (rpm < 3300 && down < 7000) || (thr < 0.1 && rpm < 2600 && down < 6500) || (thr > 0.9 && rpm < 4800 && down < 7200);
      if (wantDown) { this.gear--; this.shiftT = 0.12; this.onShift?.('down'); }
    }
  }

  update(h, inp, control) {
    const T = this.track, N = T.N, st = this.st;
    let thrRaw = control ? inp.throttle : 0, brkRaw = control ? inp.brake : 0, stRaw = control ? inp.steer : 0;
    let hb = control && inp.handbrake, nit = control && inp.nitro;
    if (this.finished || this.auto) {
      const i = this.idx, ty = Math.atan2(T.tx[i], T.tz[i]);
      stRaw = clamp(-angDiff(ty, this.yaw) * 2.4 - this.lat * 0.07, -1, 1);
      const vT = this.finished ? 22 : T.vlim[(i + 25) % N] * 0.9;
      thrRaw = this.vF < vT ? 1 : 0; brkRaw = this.vF > vT + 3 ? 0.6 : 0; hb = false; nit = false;
      if (this.gear < 1) this.gear = 1;
    }
    // pedal and steering smoothing (keyboard → progressive inputs)
    this.thr += (thrRaw - this.thr) * Math.min(1, h * (thrRaw > this.thr ? 11 : 16));
    this.brk += (brkRaw - this.brk) * Math.min(1, h * (brkRaw > this.brk ? 14 : 18));
    let sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let vF = this.vx * sy + this.vz * cy;
    let vR = -this.vx * cy + this.vz * sy;
    const speed = Math.abs(vF);
    const analog = inp.analog && control;
    const sRate = analog ? 14 : (stRaw === 0 ? 7.5 : (Math.sign(stRaw) !== Math.sign(this.steerIn) ? 9 : 4.2 - Math.min(1.8, speed / 40)));
    this.steerIn += clamp(stRaw - this.steerIn, -sRate * h, sRate * h);
    let thr = this.thr, brk = this.brk;
    if (!this.manual && this.gear === -1) { const t = thr; thr = brk; brk = t; } // auto box: S drives in reverse, W brakes

    const maxSteer = st.steer / (1 + Math.pow(speed / 14, 1.3));
    this.steer = this.steerIn * maxSteer;
    this.steerVis = this.steerIn * 2.4;

    // nitro
    this.nitroOn = nit && this.nitro > 0.005 && thr > 0.1 && vF > 2 && !this.offroad && this.gear >= 1;
    if (this.nitroOn) this.nitro = Math.max(0, this.nitro - h * 0.17);
    else this.nitro = Math.min(this.nitroCap, this.nitro + h * 0.022);

    // ---------- gearbox & engine ----------
    if (this.shiftT > 0) this.shiftT -= h;
    if (!this.manual && control) {
      // automatic: reverse when holding brake at standstill
      if (this.gear >= 1 && brkRaw > 0.5 && thrRaw < 0.1 && speed < 0.6) this.gear = -1;
      else if (this.gear === -1 && thrRaw > 0.1 && vF > -0.6) this.gear = 1;
      this._autoShift(thr, speed);
    }
    const surf = (this.offroad ? 0.55 : 1) * T.grip;
    const traction = st.traction * surf;
    let drive = 0;
    const gearIdx = this.gear >= 1 ? this.gear - 1 : 0;
    const gTop = this.gear === -1 ? st.top * 0.21 : this.gearTop[gearIdx];
    let rpmT;
    if (this.gear === 0 || !control && !this.finished && !this.auto) {
      rpmT = IDLE + (control ? thr : inp.throttle) * (REDLINE - IDLE) * 0.98; // neutral / grid revving
    } else {
      rpmT = Math.max(IDLE, (speed / gTop) * REDLINE);
      if (this.gear === 1 || this.gear === -1) {
        const slipRpm = 1500 + thr * 3200;
        if (rpmT < slipRpm && thr > 0.05) rpmT = slipRpm; // clutch slip on launch
      }
      if (this.shiftT <= 0) {
        const tq = torque(Math.min(rpmT, this.rpm + 600));
        drive = thr * st.power * tq / gTop;
        this.limiter = this.rpm >= REDLINE - 30;
      }
    }
    this.rpm += (Math.min(REDLINE + 80, rpmT) - this.rpm) * Math.min(1, h * (this.shiftT > 0 ? 22 : 16));
    if (this.nitroOn) drive += 7;
    this.wheelspin = 0;
    const cap = traction + (this.nitroOn ? 4 : 0);
    if (drive > cap) { this.wheelspin = Math.min(1, (drive - cap) / cap) * (speed < 30 ? 1 : 0.3); drive = cap; }
    this.spinExtra = (this.spinExtra || 0) + this.wheelspin * h * 25;

    let acc = 0;
    if (this.gear === -1) acc -= drive; else if (this.gear >= 1) acc += drive;
    // brakes
    if (brk > 0) {
      const bk = 31 * brk * surf;
      if (vF > 0.3) acc -= bk; else if (vF < -0.3) acc += bk;
      else if (this.gear !== -1 || thr < 0.1) vF *= 0.5;
    }
    // drag, rolling and engine braking
    acc -= st.drag * vF * Math.abs(vF) + (this.offroad ? 0.16 : 0.03) * vF;
    if (thr < 0.05 && brk < 0.05 && this.gear !== 0) acc -= Math.sign(vF) * Math.min(Math.abs(vF) / h, 0.9 + (this.rpm / REDLINE) * 1.6);
    if (hb) acc -= Math.sign(vF) * Math.min(Math.abs(vF) / h, 4.5);
    const prev = vF;
    vF += acc * h;
    if (brk > 0 && Math.sign(prev) !== Math.sign(vF) && prev !== 0) vF = 0;
    this.accLong = acc;
    this.brakeLight = brk > 0.05 ? 1 : 0;
    this.reverseLight = this.gear === -1 ? 1 : 0;

    // ---------- lateral dynamics ----------
    const down = 1 + Math.min(0.35, speed / 150 * 0.3); // aero downforce
    let yawT = (vF / 2.75) * Math.tan(this.steer);
    const aMax = st.grip * surf * down * (hb ? 1.2 : 1);
    const maxRate = aMax / Math.max(speed, 1);
    if (Math.abs(yawT) > maxRate) yawT = Math.sign(yawT) * maxRate; // understeer at the limit
    if (hb && speed > 6) yawT *= 1.8;
    if (this.wheelspin > 0.3 && speed > 4) yawT += (Math.random() - 0.5) * this.wheelspin * 0.4;
    this.yawRate += (yawT - this.yawRate) * (1 - Math.exp(-h * 11)); // rotational inertia
    this.yaw -= this.yawRate * h;
    this.latAcc = vF * this.yawRate;

    const wx = sy * vF - cy * vR, wz = cy * vF + sy * vR;
    sy = Math.sin(this.yaw); cy = Math.cos(this.yaw);
    vF = wx * sy + wz * cy; vR = -wx * cy + wz * sy;
    const gripT = (this.offroad ? 4 : hb ? 0.9 : 10) * (T.grip < 1 ? 0.7 + 0.3 * T.grip : 1) * (1 - this.wheelspin * 0.35);
    this.gripF += (gripT - this.gripF) * Math.min(1, h * (gripT > this.gripF ? 3.5 : 20));
    const before = vR;
    vR *= Math.exp(-this.gripF * h);
    const loss = Math.abs(before - vR) * 0.15;
    vF -= Math.sign(vF) * Math.min(Math.abs(vF), loss);
    this.vx = sy * vF - cy * vR; this.vz = cy * vF + sy * vR;
    this.vF = vF; this.vR = vR; this.slip = Math.abs(vR);

    this.pos.x += this.vx * h; this.pos.z += this.vz * h;

    // ---------- track constraints ----------
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
        this.yawRate *= 0.5;
      }
      lat = sg * wall;
    }
    this.lat = lat;
    this.raceDist = this.kAcc * T.ds + along - T.sStart;

    const slope = (T.py[(i + 3) % N] - T.py[(i - 3 + N) % N]) / (6 * T.ds);
    const fwd = Math.sin(this.yaw) * T.tx[i] + Math.cos(this.yaw) * T.tz[i];
    this.pitch = -Math.atan(slope * fwd);
    this.roll = clamp(-this.latAcc * 0.0042, -0.075, 0.075);
    this.bodyPitch = clamp(-this.accLong * 0.0035, -0.045, 0.06);
    this.wrongWay = fwd < -0.35 && this.vF > 4;
  }

  gearLabel() { return this.gear === -1 ? 'R' : this.gear === 0 ? 'N' : String(this.gear); }
}

export class AICar extends Base {
  constructor(model, track, name, skill) {
    super(model, track, name);
    this.skill = skill * Math.pow(model.model.stats.top / 86, 0.25) * Math.pow(model.model.stats.grip / 17.6, 0.2);
    this.s = 0; this.v = 0;
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
    const a = vT > this.v ? 11.5 * T.grip * (1 - Math.pow(this.v / 92, 2)) : -15 * T.grip;
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
