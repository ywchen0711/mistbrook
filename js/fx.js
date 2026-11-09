// Particles, projectiles, shockwaves and spell lights.
import * as THREE from 'three';
import { softDot } from './tex.js';

const V = THREE.Vector3;
class Pool {
  constructor(scene, max, blending, tex) {
    this.max = max; this.n = 0;
    this.p = []; // particle objects
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uScale: { value: 600 } },
      vertexShader: `attribute vec4 aCol; attribute float aSize; varying vec4 vC; uniform float uScale;
        void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a); }`,
      transparent: true, depthWrite: false, blending,
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 5;
    scene.add(this.pts); this.g = g;
  }
  add(o) { if (this.p.length >= this.max) this.p.shift(); o.age = 0; this.p.push(o); }
  update(dt) {
    let k = 0;
    const live = [];
    for (const o of this.p) {
      o.age += dt; if (o.age >= o.life) continue;
      o.vy += (o.g || 0) * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
      if (o.drag) { const f = Math.exp(-o.drag * dt); o.vx *= f; o.vy *= f; o.vz *= f; }
      const t = o.age / o.life;
      this.pos[k * 3] = o.x; this.pos[k * 3 + 1] = o.y; this.pos[k * 3 + 2] = o.z;
      const c0 = o.c0, c1 = o.c1 || o.c0;
      this.col[k * 4] = c0.r + (c1.r - c0.r) * t; this.col[k * 4 + 1] = c0.g + (c1.g - c0.g) * t; this.col[k * 4 + 2] = c0.b + (c1.b - c0.b) * t;
      const fade = o.fadeIn ? Math.min(1, t / o.fadeIn) : 1;
      this.col[k * 4 + 3] = o.a * fade * (1 - t) ** (o.fadePow || 1);
      this.size[k] = o.s0 + (o.s1 - o.s0) * t;
      live.push(o); k++;
    }
    this.p = live; this.n = k;
    this.g.setDrawRange(0, k);
    this.g.attributes.position.needsUpdate = true; this.g.attributes.aCol.needsUpdate = true; this.g.attributes.aSize.needsUpdate = true;
  }
}

const C = (h) => new THREE.Color(h);
const rnd = (a, b) => a + Math.random() * (b - a);

export class FX {
  constructor(scene) {
    this.scene = scene;
    const dot = softDot();
    this.add = new Pool(scene, 4000, THREE.AdditiveBlending, dot);
    this.norm = new Pool(scene, 1800, THREE.NormalBlending, dot);
    this.proj = []; this.rings = []; this.timers = [];
    this.lights = [0, 1, 2].map(() => { const L = new THREE.PointLight('#ff8a3a', 0, 10, 1.5); scene.add(L); return { L, busy: false }; });
    this.emitters = [];
  }
  setScale(h, fov) { const s = h / (2 * Math.tan((fov * Math.PI) / 360)); this.add.mat.uniforms.uScale.value = s; this.norm.mat.uniforms.uScale.value = s; }
  light(col, intensity, pos, dur = 0.4) {
    const l = this.lights.find((x) => !x.busy) || this.lights[0];
    l.busy = true; l.L.color.set(col); l.L.position.copy(pos); l.L.intensity = intensity;
    const t0 = performance.now();
    this.timers.push((now) => { const t = (now - t0) / 1000 / dur; l.L.intensity = intensity * Math.max(0, 1 - t); if (t >= 1) { l.busy = false; l.L.intensity = 0; return true; } });
    return l;
  }
  emit(e, dt) {
    e.acc = (e.acc || 0) + e.rate * dt;
    while (e.acc >= 1) {
      e.acc--;
      if (e.kind === 'fire') {
        const s = e.size || 1, col = C(e.color || '#ff8a2a');
        this.add.add({ x: e.x + rnd(-0.18, 0.18) * s, y: e.y + rnd(0, 0.1), z: e.z + rnd(-0.18, 0.18) * s, vx: rnd(-0.1, 0.1), vy: rnd(1.0, 1.9) * s, vz: rnd(-0.1, 0.1), life: rnd(0.45, 0.85), a: 0.9, s0: 0.55 * s, s1: 0.08, c0: C('#fff0c0').lerp(col, 0.3), c1: col.clone().multiplyScalar(0.6), fadePow: 1.2 });
        if (Math.random() < 0.15) this.add.add({ x: e.x, y: e.y + 0.3, z: e.z, vx: rnd(-0.4, 0.4), vy: rnd(1.5, 3), vz: rnd(-0.4, 0.4), life: rnd(0.8, 1.6), a: 1, s0: 0.06, s1: 0.02, c0: C('#ffd080'), c1: col, g: -0.3 });
      } else if (e.kind === 'smoke') {
        this.norm.add({ x: e.x + rnd(-0.1, 0.1), y: e.y, z: e.z + rnd(-0.1, 0.1), vx: rnd(0.1, 0.35), vy: rnd(0.35, 0.7), vz: rnd(-0.1, 0.1), life: rnd(3, 5), a: 0.22, s0: 0.5, s1: 2.2, c0: C('#5a5450'), c1: C('#3a3a40'), fadeIn: 0.15 });
      } else if (e.kind === 'mist') {
        this.norm.add({ x: e.x + rnd(-2, 2), y: e.y + rnd(0, 0.3), z: e.z + rnd(-0.6, 0.6), vx: rnd(0.05, 0.25), vy: rnd(0, 0.05), vz: rnd(-0.05, 0.05), life: rnd(6, 9), a: 0.12, s0: 2.5, s1: 4.5, c0: C(e.color || '#c8d8e0'), fadeIn: 0.3 });
      } else if (e.kind === 'sparkle') {
        this.add.add({ x: e.x + rnd(-0.25, 0.25), y: e.y + rnd(-0.2, 0.2), z: e.z + rnd(-0.25, 0.25), vx: 0, vy: rnd(0.2, 0.5), vz: 0, life: rnd(0.6, 1.2), a: 0.9, s0: 0.12, s1: 0.02, c0: C(e.color || '#ffe8a0') });
      }
    }
  }
  burst(pos, col, n = 24, speed = 3, size = 0.25, life = 0.6, up = 0) {
    const c = C(col);
    for (let i = 0; i < n; i++) {
      const v = new V(rnd(-1, 1), rnd(-0.3, 1) + up, rnd(-1, 1)).normalize().multiplyScalar(rnd(0.3, 1) * speed);
      this.add.add({ x: pos.x, y: pos.y, z: pos.z, vx: v.x, vy: v.y, vz: v.z, life: rnd(life * 0.6, life), a: 1, s0: size, s1: 0.02, c0: C('#ffffff').lerp(c, 0.4), c1: c, drag: 2.5, g: -2 });
    }
  }
  dust(pos, n = 10) {
    for (let i = 0; i < n; i++) this.norm.add({ x: pos.x + rnd(-0.3, 0.3), y: 0.1, z: pos.z + rnd(-0.3, 0.3), vx: rnd(-0.8, 0.8), vy: rnd(0.2, 0.6), vz: rnd(-0.8, 0.8), life: rnd(0.8, 1.4), a: 0.35, s0: 0.4, s1: 1.2, c0: C('#8a7a5a'), drag: 2 });
  }
  heal(pos) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.28, r = rnd(0.2, 0.6);
      this.add.add({ x: pos.x + Math.cos(a) * r, y: pos.y + rnd(0, 0.4), z: pos.z + Math.sin(a) * r, vx: 0, vy: rnd(0.8, 1.8), vz: 0, life: rnd(0.8, 1.4), a: 1, s0: 0.18, s1: 0.03, c0: C('#c8ffb0'), c1: C('#3aff6a') });
    }
    this.light('#6aff8a', 12, pos.clone().setY(1.5), 0.8);
  }
  holy(pos) {
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * 6.28, r = rnd(0, 0.5);
      this.add.add({ x: pos.x + Math.cos(a) * r, y: rnd(0, 0.5), z: pos.z + Math.sin(a) * r, vx: 0, vy: rnd(3, 6), vz: 0, life: rnd(0.5, 0.9), a: 1, s0: 0.3, s1: 0.05, c0: C('#fffbe0'), c1: C('#ffc040') });
    }
    this.light('#ffd870', 40, pos.clone().setY(2), 0.7);
    this.ring(pos, '#ffd870', 1.4, 0.5);
  }
  ring(pos, col, r = 3, dur = 0.5) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.15, pos.z); this.scene.add(m);
    this.rings.push({ m, t: 0, dur, r });
  }
  // projectile: kind arrow|fire|missile|ash; returns promise that resolves on arrival
  shoot(kind, from, to, o = {}) {
    return new Promise((res) => {
      let mesh;
      if (kind === 'arrow') {
        mesh = new THREE.Group();
        const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), new THREE.MeshStandardMaterial({ color: '#8a6a40' })); sh.rotation.x = Math.PI / 2; mesh.add(sh);
        const hd = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 4), new THREE.MeshStandardMaterial({ color: '#aaa', metalness: 0.8 })); hd.rotation.x = Math.PI / 2; hd.position.z = 0.38; mesh.add(hd);
      } else {
        const col = { fire: '#ff7a2a', missile: '#c07aff', ash: '#ff5a1a' }[kind];
        mesh = new THREE.Mesh(new THREE.SphereGeometry(kind === 'missile' ? 0.09 : 0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff4e0', toneMapped: false }));
        mesh.userData.col = col;
      }
      this.scene.add(mesh);
      const dist = from.distanceTo(to);
      const p = { kind, mesh, from: from.clone(), to: to.clone(), t: 0, dur: o.dur || Math.max(0.25, dist / (kind === 'arrow' ? 28 : kind === 'missile' ? 16 : 14)), arc: o.arc ?? (kind === 'arrow' ? dist * 0.06 : kind === 'missile' ? 1.2 : 0.3), side: o.side || 0, res, light: kind !== 'arrow' ? this.light(mesh.userData.col, 14, from, 99) : null };
      this.proj.push(p);
    });
  }
  update(dt, cam) {
    const now = performance.now();
    for (const e of this.emitters) {
      if (e.off) continue;
      if (cam && (Math.abs(e.x - cam.x) > 45 || Math.abs(e.z - cam.z) > 45)) continue;
      this.emit(e, dt);
    }
    this.proj = this.proj.filter((p) => {
      p.t += dt;
      const u = Math.min(1, p.t / p.dur);
      const pos = p.from.clone().lerp(p.to, u);
      pos.y += Math.sin(u * Math.PI) * p.arc;
      if (p.side) { const d = p.to.clone().sub(p.from); const perp = new V(-d.z, 0, d.x).normalize(); pos.addScaledVector(perp, Math.sin(u * Math.PI) * p.side); }
      const prev = p.mesh.position.clone();
      p.mesh.position.copy(pos);
      if (p.kind === 'arrow') p.mesh.lookAt(pos.clone().add(pos.clone().sub(prev)));
      else {
        const c = C(p.mesh.userData.col);
        for (let i = 0; i < 3; i++) this.add.add({ x: pos.x + rnd(-0.05, 0.05), y: pos.y + rnd(-0.05, 0.05), z: pos.z + rnd(-0.05, 0.05), vx: rnd(-0.3, 0.3), vy: rnd(-0.1, 0.4), vz: rnd(-0.3, 0.3), life: rnd(0.25, 0.5), a: 1, s0: p.kind === 'missile' ? 0.25 : 0.45, s1: 0.03, c0: C('#ffffff').lerp(c, 0.5), c1: c });
        if (p.light) p.light.L.position.copy(pos);
      }
      if (u >= 1) {
        this.scene.remove(p.mesh);
        if (p.light) { p.light.busy = false; p.light.L.intensity = 0; }
        if (p.kind !== 'arrow') { this.burst(pos, p.mesh.userData.col, 30, 4, 0.3, 0.6); this.light(p.mesh.userData.col, 30, pos, 0.4); }
        p.res(); return false;
      }
      return true;
    });
    this.rings = this.rings.filter((r) => {
      r.t += dt; const u = r.t / r.dur;
      r.m.scale.setScalar(0.2 + r.r * u); r.m.material.opacity = 0.9 * (1 - u);
      if (u >= 1) { this.scene.remove(r.m); r.m.geometry.dispose(); return false; }
      return true;
    });
    this.timers = this.timers.filter((f) => !f(now));
    this.add.update(dt); this.norm.update(dt);
  }
}
