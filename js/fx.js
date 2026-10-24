// Tyre skid marks and tyre smoke / dust particles.
import * as THREE from 'three';

export class SkidMarks {
  constructor(scene, max = 5000) {
    this.max = max; this.n = 0; this.head = 0;
    const pos = new Float32Array(max * 12);
    const idx = new Uint32Array(max * 6);
    for (let i = 0; i < max; i++) { const a = i * 4; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6); }
    const g = (this.geo = new THREE.BufferGeometry());
    this.attr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attr);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: 0x0a0a0a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }
  // a0,b0 = previous edge points; a1,b1 = current edge points (Vector3)
  add(a0, b0, a1, b1) {
    const p = this.attr.array, o = this.head * 12;
    p[o] = a0.x; p[o + 1] = a0.y; p[o + 2] = a0.z;
    p[o + 3] = b0.x; p[o + 4] = b0.y; p[o + 5] = b0.z;
    p[o + 6] = a1.x; p[o + 7] = a1.y; p[o + 8] = a1.z;
    p[o + 9] = b1.x; p[o + 10] = b1.y; p[o + 11] = b1.z;
    this.head = (this.head + 1) % this.max;
    this.n = Math.min(this.n + 1, this.max);
    this.geo.setDrawRange(0, this.n * 6);
    this.attr.needsUpdate = true;
  }
  clear() { this.n = 0; this.head = 0; this.geo.setDrawRange(0, 0); }
}

export class Smoke {
  constructor(scene, max = 500) {
    this.max = max; this.head = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.color = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.a0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aSize', this.aSize);
    g.setAttribute('aAlpha', this.aAlpha); g.setAttribute('aColor', this.aColor);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 } },
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        uniform float uScale; varying float vA; varying vec3 vC;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(0.1, -mv.z); vA = aAlpha; vC = aColor; }`,
      fragmentShader: `varying float vA; varying vec3 vC;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c);
          float a = smoothstep(0.5, 0.05, d) * vA; if (a < 0.004) discard; gl_FragColor = vec4(vC, a); }`,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, r, g, b, size, alpha, life) {
    const i = this.head; this.head = (this.head + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.color[i * 3] = r; this.color[i * 3 + 1] = g; this.color[i * 3 + 2] = b;
    this.size[i] = size; this.a0[i] = alpha; this.alpha[i] = alpha; this.life[i] = life; this.maxLife[i] = life;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const damp = Math.exp(-dt * 1.8);
      this.vel[i * 3] *= damp; this.vel[i * 3 + 2] *= damp; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * damp + 0.6 * dt;
      this.size[i] += dt * 2.2;
      this.alpha[i] = this.a0[i] * k * k;
    }
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = this.aColor.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.alpha.fill(0); this.aAlpha.needsUpdate = true; }
}
