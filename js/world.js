// The map: Mistbrook village (south), the misty stream, the forest, the goblin camp and the shrine ruins (north).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAP, WALK, Nav } from './nav.js';
import * as T from './tex.js';
import { R, rr, pick } from './tex.js';

export const PATHS = [
  [[0, 44], [0, 33], [0.6, 26], [0, 19], [1, 10], [0, 5], [0, -1], [-1.5, -7], [-5, -12], [-9, -17], [-13, -21]],
  [[-13, -21], [-11.5, -27], [-7, -32], [-1, -36], [4, -38.5], [8, -41]],
  [[-1.5, -7], [3, -10], [7.5, -12]],
];
export const PLAZAS = [
  { x: 0, z: 19, r: 7.5, kind: 'cobble' },
  { x: 8, z: -43, r: 9, kind: 'ruin' },
  { x: -14, z: -22, r: 6.5, kind: 'dirt' },
  { x: 8.5, z: -12.5, r: 4.5, kind: 'moss' },
];
export const STREAM = { z: 2, half: 1.9 };
export const BRIDGE = { x: 0, half: 1.7, z0: -0.9, z1: 4.9 };
export const SPOTS = {
  start: [0.4, 28.6], elder: [-2, 14.2], merchant: [6.6, 23.6], hunter: [3.2, -3.6], fire: [-3.8, 21.5], well: [4.2, 16.4],
  camp: [-14, -22], ruin: [8, -43], altar: [8, -48.3], wolves: [8.5, -12.5],
};

// see-through dithering for anything between the camera and the party
export const OCC = { uOccC: { value: new THREE.Vector3() }, uOccT: { value: new THREE.Vector3() } };
export function occlude(mat) {
  if (mat.userData.occ) return mat;
  mat.userData.occ = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uOccC = OCC.uOccC; sh.uniforms.uOccT = OCC.uOccT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOccW;').replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
      vOccW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
      vOccW = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOccW; uniform vec3 uOccC; uniform vec3 uOccT;').replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      { vec3 ab = uOccT - uOccC; float L = length(ab); vec3 dr = ab / L; float tt = dot(vOccW - uOccC, dr);
        if (tt > 0.0 && tt < L - 0.8) { float dd = length(vOccW - (uOccC + dr * tt)); float rr = mix(0.6, 3.4, tt / L);
          float k = dd < rr ? smoothstep(rr, rr * 0.55, dd) : 0.0;
          if (vOccW.y > 1.3) k = max(k, smoothstep(L * 0.62, L * 0.4, tt));
          if (k > 0.0) { vec2 bq = mod(floor(gl_FragCoord.xy), 4.0); float n = (mod(bq.x + bq.y * 2.0, 4.0) * 4.0 + mod(bq.x * 2.0 + bq.y * 3.0, 4.0) + 0.5) / 16.0; if (n < k * 0.97) discard; } } }`);
  };
  mat.customProgramCacheKey = () => 'occ' + (mat.userData.occKey || '');
  return mat;
}

export function groundY(x, z) {
  if (Math.abs(x - BRIDGE.x) < BRIDGE.half + 0.3 && z > BRIDGE.z0 && z < BRIDGE.z1) return 0.1 + 0.32 * Math.sin(Math.PI * (z - BRIDGE.z0) / (BRIDGE.z1 - BRIDGE.z0));
  return 0;
}
function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, L = vx * vx + vz * vz;
  let t = L ? ((px - ax) * vx + (pz - az) * vz) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - vx * t, pz - az - vz * t);
}
export function pathDist(x, z) {
  let m = 1e9;
  for (const P of PATHS) for (let i = 0; i < P.length - 1; i++) m = Math.min(m, segDist(x, z, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]));
  return m;
}
const inStream = (z, pad = 0) => Math.abs(z - STREAM.z) < STREAM.half + pad;
const plazaDist = (x, z) => Math.min(...PLAZAS.map((p) => Math.hypot(x - p.x, z - p.z) - p.r));

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; return m; }
function colorize(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(col, p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
function prep(geo) { geo = geo.index ? geo.toNonIndexed() : geo; for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(k)) geo.deleteAttribute(k); return geo; }
function blob(r, detail, cx, cy, cz, amp = 0.2, sx = 1, sy = 1, sz = 1) {
  let g = new THREE.IcosahedronGeometry(r, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position, ph = R() * 10;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = 1 + amp * Math.sin(x * 3.1 + y * 1.7 + ph) * Math.sin(z * 2.7 + y * 2.3 + ph * 0.7) + amp * 0.5 * Math.sin(x * 7 + z * 6 + ph);
    p.setXYZ(i, x * f * sx + cx, y * f * sy + cy, z * f * sz + cz);
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
export function buildWorld(scene, Q) {
  const nav = new Nav();
  const W = { nav, Q, lights: [], emitters: [], anim: [], inter: {}, mats: {} };
  s0(); sky(scene, W); ground(scene, W, Q); stream(scene, W); village(scene, W); camp(scene, W); ruins(scene, W); clearing(scene, W);
  forest(scene, W, Q); grass(scene, W, Q); fireflies(scene, W);
  const skip = new Set([W.ground.material, W.streamMat]);
  scene.traverse((m) => { if (m.isMesh && !m.isInstancedMesh && m.material) for (const mt of [].concat(m.material)) if (mt.isMeshStandardMaterial && !skip.has(mt)) occlude(mt); });
  return W;
}
function s0() { /* reseed */ for (let i = 0; i < 3; i++) R(); }

function sky(scene, W) {
  const geo = new THREE.SphereGeometry(400, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: new THREE.Vector3(-0.75, 0.2, 0.62).normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vD; uniform vec3 sun;
      void main(){ float h = vD.y; vec3 zen = vec3(0.13,0.14,0.32); vec3 mid = vec3(0.55,0.36,0.45); vec3 hor = vec3(1.0,0.62,0.36); vec3 low = vec3(0.30,0.22,0.24);
        vec3 c = h > 0.0 ? mix(hor, mix(mid, zen, smoothstep(0.12,0.6,h)), smoothstep(0.0,0.14,h)) : mix(hor*0.8, low, smoothstep(0.0,-0.15,h));
        float s = max(dot(normalize(vD), sun), 0.0); c += vec3(1.0,0.55,0.25) * pow(s, 8.0) * 0.6 + vec3(1.0,0.85,0.6) * pow(s, 300.0) * 3.0;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = -1; scene.add(m); W.sky = m;
}

function ground(scene, W, Q) {
  const PX = Q === 'low' ? 1024 : 2048, PH = Math.round(PX * MAP.h / MAP.w);
  const [c, g] = T.canvas(PX, PH);
  const sx = PX / MAP.w, sz = PH / MAP.h;
  const X = (x) => (x - MAP.x0) * sx, Z = (z) => (z - MAP.z0) * sz;
  g.fillStyle = '#4c682f'; g.fillRect(0, 0, PX, PH);
  for (let i = 0; i < 9000; i++) {
    const x = rr(MAP.x0, MAP.x0 + MAP.w), z = rr(MAP.z0, MAP.z0 + MAP.h);
    const forest = z < -3 && plazaDist(x, z) > 1;
    g.globalAlpha = 0.16 + R() * 0.14;
    g.fillStyle = forest ? pick(['#4b4a2c', '#3e4426', '#55502f', '#3a4222', '#5a4a2c', '#45502a']) : pick(['#56763a', '#42602a', '#5f7d3c', '#6b7f3a', '#3c5726', '#74843f', '#4f6c30']);
    g.beginPath(); g.ellipse(X(x), Z(z), rr(0.3, 2.2) * sx, rr(0.3, 2.2) * sz, R() * 3, 0, 7); g.fill();
  }
  // stream bed
  g.globalAlpha = 1;
  const grd = g.createLinearGradient(0, Z(STREAM.z - STREAM.half - 0.8), 0, Z(STREAM.z + STREAM.half + 0.8));
  grd.addColorStop(0, 'rgba(110,98,70,0)'); grd.addColorStop(0.12, '#776a4b'); grd.addColorStop(0.22, '#3d3a2c'); grd.addColorStop(0.5, '#23271f'); grd.addColorStop(0.78, '#3d3a2c'); grd.addColorStop(0.88, '#776a4b'); grd.addColorStop(1, 'rgba(110,98,70,0)');
  g.fillStyle = grd; g.fillRect(0, Z(STREAM.z - STREAM.half - 0.8), PX, (2 * STREAM.half + 1.6) * sz);
  // paths
  const strokePath = (P, w, col, a) => { g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w * sx; g.lineCap = g.lineJoin = 'round'; g.beginPath(); P.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.stroke(); };
  PATHS.forEach((P, k) => { const f = k === 2 ? 0.6 : 1; strokePath(P, 3.6 * f, '#6d5a3c', 0.45); strokePath(P, 2.6 * f, '#7f6a48', 0.6); strokePath(P, 1.7 * f, '#8d7853', 0.55); });
  g.globalAlpha = 1;
  for (let i = 0; i < 5000; i++) {
    const x = rr(MAP.x0, MAP.x0 + MAP.w), z = rr(MAP.z0, MAP.z0 + MAP.h);
    if (pathDist(x, z) > 1.3) continue;
    g.fillStyle = pick(['#5c4b33', '#9a8661', '#6e5d40', '#a39070']); g.globalAlpha = 0.6;
    g.beginPath(); g.arc(X(x), Z(z), rr(0.04, 0.12) * sx, 0, 7); g.fill();
  }
  // plazas
  for (const p of PLAZAS) {
    g.save(); g.globalAlpha = 1;
    g.beginPath(); g.ellipse(X(p.x), Z(p.z), p.r * sx, p.r * sz, 0, 0, 7); g.clip();
    if (p.kind === 'cobble') {
      g.fillStyle = '#4e4a40'; g.fillRect(X(p.x - p.r), Z(p.z - p.r), 2 * p.r * sx, 2 * p.r * sz);
      for (let z = p.z - p.r; z < p.z + p.r; z += 0.42) for (let x = p.x - p.r + (Math.round(z / 0.42) % 2) * 0.2; x < p.x + p.r; x += 0.45) {
        g.fillStyle = T.shade(pick(['#8a8273', '#7a7264', '#958c7c', '#6f6a5c']), 0.85 + R() * 0.3);
        g.beginPath(); g.roundRect(X(x + 0.03), Z(z + 0.03), 0.38 * sx, 0.35 * sz, 3); g.fill();
      }
    } else if (p.kind === 'ruin') {
      g.fillStyle = '#3d3c36'; g.fillRect(X(p.x - p.r), Z(p.z - p.r), 2 * p.r * sx, 2 * p.r * sz);
      for (let z = p.z - p.r; z < p.z + p.r; z += 1.25) for (let x = p.x - p.r; x < p.x + p.r; x += 1.25) {
        if (R() < 0.12) continue;
        g.fillStyle = T.shade(pick(['#77756b', '#6a685f', '#827f73', '#5f5e56']), 0.8 + R() * 0.3);
        g.fillRect(X(x + 0.05), Z(z + 0.05), 1.15 * sx, 1.15 * sz);
        if (R() < 0.4) { g.strokeStyle = '#2a2925'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(x + R()), Z(z)); g.lineTo(X(x + R()), Z(z + 0.6)); g.lineTo(X(x + R() * 1.2), Z(z + 1.2)); g.stroke(); }
      }
      for (let i = 0; i < 70; i++) { g.globalAlpha = 0.35; g.fillStyle = pick(['#3f5a2a', '#55702f', '#2f4420']); g.beginPath(); g.arc(X(p.x + rr(-p.r, p.r)), Z(p.z + rr(-p.r, p.r)), rr(0.2, 1) * sx, 0, 7); g.fill(); }
    } else {
      g.fillStyle = p.kind === 'dirt' ? '#5f5036' : '#45512a'; g.globalAlpha = 0.85; g.fillRect(X(p.x - p.r), Z(p.z - p.r), 2 * p.r * sx, 2 * p.r * sz);
      for (let i = 0; i < 300; i++) { g.globalAlpha = 0.3; g.fillStyle = pick(p.kind === 'dirt' ? ['#6e5c3e', '#4f4230', '#7a6a4a'] : ['#3f5a2a', '#55702f', '#5a5636']); g.beginPath(); g.arc(X(p.x + rr(-p.r, p.r)), Z(p.z + rr(-p.r, p.r)), rr(0.1, 0.6) * sx, 0, 7); g.fill(); }
    }
    g.restore();
    // soft rim
    g.globalAlpha = 0.25; g.strokeStyle = '#3a3324'; g.lineWidth = 0.6 * sx; g.beginPath(); g.ellipse(X(p.x), Z(p.z), p.r * sx, p.r * sz, 0, 0, 7); g.stroke();
  }
  // camp ash
  g.globalAlpha = 0.8; const ag = g.createRadialGradient(X(-14), Z(-22), 0, X(-14), Z(-22), 2.2 * sx); ag.addColorStop(0, '#1b1612'); ag.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = ag; g.fillRect(X(-17), Z(-25), 6 * sx, 6 * sz);
  g.globalAlpha = 1;
  const tex = T.toTex(c); tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = std({ map: tex, roughness: 0.95 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      float nn = vn(vWP.xz*4.0)*0.45 + vn(vWP.xz*13.0)*0.3 + vn(vWP.xz*0.5)*0.5;
      diffuseColor.rgb *= 0.78 + nn*0.42;`);
  };
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(MAP.w, MAP.h), mat);
  gm.rotation.x = -Math.PI / 2; gm.position.set(MAP.x0 + MAP.w / 2, 0, MAP.z0 + MAP.h / 2); gm.receiveShadow = true; gm.name = 'ground';
  scene.add(gm); W.ground = gm;
  const outer = new THREE.Mesh(new THREE.RingGeometry(40, 300, 32, 1), std({ color: '#2e3f20' }));
  outer.rotation.x = -Math.PI / 2; outer.position.set(0, -0.03, -8); scene.add(outer);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(MAP.w + 2, MAP.h + 2), std({ color: '#2e3f20' }));
  under.rotation.x = -Math.PI / 2; under.position.set(MAP.x0 + MAP.w / 2, -0.05, MAP.z0 + MAP.h / 2); scene.add(under);
}

function stream(scene, W) {
  const nt = T.toTex(T.waterNormal(), [14, 1], false);
  const mat = std({ color: '#355a63', roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.8, normalMap: nt, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 1.4 });
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(MAP.w, STREAM.half * 2 + 0.3, 1, 1), mat);
  wm.rotation.x = -Math.PI / 2; wm.position.set(MAP.x0 + MAP.w / 2, 0.06, STREAM.z); wm.receiveShadow = true; scene.add(wm);
  W.anim.push((t) => { nt.offset.x = t * 0.05; nt.offset.y = Math.sin(t * 0.3) * 0.05; });
  W.nav.blockRect(0, STREAM.z, 200, STREAM.half * 2 + 0.2, 0, 0);
  // unblock the bridge
  for (let z = BRIDGE.z0 - 0.5; z < BRIDGE.z1 + 0.5; z += 0.25) for (let x = -BRIDGE.half + 0.45; x <= BRIDGE.half - 0.45; x += 0.25) { const [i, j] = W.nav.ci(x, z); if (W.nav.inb(i, j) && Math.abs(x) < WALK.x1) W.nav.block[j * W.nav.W + i] = 0; }
  // bank stones
  const rockGeo = prep(colorize(blob(0.35, 1, 0, 0, 0, 0.25, 1, 0.6, 1), (c) => c.setHSL(0.1, 0.06, rr(0.28, 0.42))));
  const n = 140, im = new THREE.InstancedMesh(rockGeo, std({ vertexColors: true }), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let k = 0; k < n; k++) {
    let x; do { x = rr(-38, 38); } while (Math.abs(x) < BRIDGE.half + 0.6);
    const z = STREAM.z + (R() < 0.5 ? -1 : 1) * (STREAM.half + rr(-0.2, 0.4));
    const s = rr(0.5, 1.5); q.setFromEuler(e.set(0, R() * 6, 0));
    m4.compose(new THREE.Vector3(x, 0.05, z), q, new THREE.Vector3(s, s * rr(0.6, 1), s)); im.setMatrixAt(k, m4);
  }
  im.castShadow = true; im.receiveShadow = true; scene.add(im);
  // bridge
  const wood = std({ map: T.toTex(T.planks('#6b4b2e')), roughness: 0.9 }), dark = std({ color: '#3d2a1a' });
  const B = new THREE.Group();
  const len = BRIDGE.z1 - BRIDGE.z0, N = 16;
  for (let k = 0; k < N; k++) {
    const z = BRIDGE.z0 + (k + 0.5) * len / N, y = groundY(0, z) - 0.06;
    const p = mesh(new THREE.BoxGeometry(BRIDGE.half * 2, 0.1, len / N - 0.04), wood, 0, y, z);
    p.rotation.x = -Math.cos(Math.PI * (z - BRIDGE.z0) / len) * 0.2; p.rotation.z = rr(-0.02, 0.02); B.add(p);
  }
  for (const sx of [-1, 1]) {
    for (let k = 0; k <= 4; k++) {
      const z = BRIDGE.z0 + k * len / 4, y = groundY(0, z);
      B.add(mesh(new THREE.BoxGeometry(0.14, 1.0, 0.14), dark, sx * BRIDGE.half, y + 0.4, z));
    }
    const pts = []; for (let k = 0; k <= 12; k++) { const z = BRIDGE.z0 + k * len / 12; pts.push(new THREE.Vector3(sx * BRIDGE.half, groundY(0, z) + 0.82, z)); }
    B.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.05, 6), dark));
  }
  scene.add(B);
  W.streamMat = mat;
}

// ---------------------------------------------------------------------------
function house(scene, W, o) {
  const G = new THREE.Group(); G.position.set(o.x, 0, o.z); G.rotation.y = o.rot;
  const stoneM = W.mats.stone || (W.mats.stone = std({ map: T.toTex(T.stone(), [2, 0.5]) }));
  const pl = T.toTex(T.plaster(o.beam || '#4a3222', o.wall || '#d6c8a6'), [o.w / 2.6, 1]);
  const pl2 = pl.clone(); pl2.repeat.set(o.d / 2.6, 1); pl2.needsUpdate = true;
  const wallM = std({ map: pl }), wallM2 = std({ map: pl2 });
  G.add(mesh(new THREE.BoxGeometry(o.w + 0.25, 0.6, o.d + 0.25), stoneM, 0, 0.3, 0));
  G.add(mesh(new THREE.BoxGeometry(o.w, o.h, o.d), [wallM2, wallM2, wallM, wallM, wallM, wallM], 0, 0.6 + o.h / 2, 0));
  const top = 0.6 + o.h, rh = o.roofH || o.w * 0.42, ov = 0.45;
  const roofTex = o.roof === 'thatch' ? T.thatch() : T.shingles(o.roof || ['#5a3a2e', '#6b4434', '#4b3026', '#734b38']);
  const half = o.w / 2 + ov, slope = Math.hypot(half, rh), ang = Math.atan2(rh, half);
  const rt = T.toTex(roofTex, [slope / 3.6, (o.d + ov * 2) / 3.6]); rt.rotation = Math.PI / 2;
  const roofM = std({ map: rt, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const r = mesh(new THREE.BoxGeometry(slope, 0.14, o.d + ov * 2), roofM, s * half / 2, top + rh / 2, 0);
    r.rotation.z = -s * ang; G.add(r);
  }
  const tri = new THREE.Shape(); tri.moveTo(-o.w / 2, 0); tri.lineTo(o.w / 2, 0); tri.lineTo(0, rh - 0.05); tri.closePath();
  const gab = new THREE.ShapeGeometry(tri);
  const gm = std({ map: pl });
  for (const s of [-1, 1]) { const m = mesh(gab, gm, 0, top, s * (o.d / 2)); m.rotation.y = s < 0 ? Math.PI : 0; G.add(m); }
  // ridge beam
  G.add(mesh(new THREE.BoxGeometry(0.18, 0.18, o.d + ov * 2 + 0.1), std({ color: '#3a281a' }), 0, top + rh + 0.03, 0));
  // door & windows (front = +z)
  const doorM = std({ map: T.toTex(T.planks('#4a3020'), [1, 1]) });
  G.add(mesh(new THREE.BoxGeometry(0.95, 1.8, 0.1), doorM, o.door || 0, 0.6 + 0.9, o.d / 2 + 0.03));
  G.add(mesh(new THREE.BoxGeometry(1.4, 0.18, 0.7), stoneM, o.door || 0, 0.09, o.d / 2 + 0.45));
  const glow = W.mats.glow || (W.mats.glow = new THREE.MeshStandardMaterial({ color: '#2a1806', emissive: '#ffae4a', emissiveIntensity: 2.6 }));
  const frame = W.mats.frame || (W.mats.frame = std({ color: '#2e1f14' }));
  const win = (x, y, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    g.add(mesh(new THREE.PlaneGeometry(0.62, 0.72), glow, 0, 0, 0.02, false));
    g.add(mesh(new THREE.BoxGeometry(0.74, 0.08, 0.08), frame, 0, 0.38, 0.04)); g.add(mesh(new THREE.BoxGeometry(0.74, 0.08, 0.08), frame, 0, -0.38, 0.04));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.72, 0.06), frame, 0, 0, 0.05)); g.add(mesh(new THREE.BoxGeometry(0.62, 0.05, 0.06), frame, 0, 0, 0.05));
    g.add(mesh(new THREE.BoxGeometry(0.8, 0.07, 0.2), frame, 0, -0.42, 0.08));
    G.add(g);
  };
  const wy = 0.6 + o.h * 0.55;
  for (const s of [-1, 1]) if (o.w > 3.6) win(s * o.w * 0.3 + (o.door || 0) * 0.3, wy, o.d / 2 + 0.01, 0);
  win(o.w / 2 + 0.01, wy, 0, Math.PI / 2); win(-o.w / 2 - 0.01, wy, R() < 0.5 ? 0.6 : -0.6, -Math.PI / 2);
  if (o.h > 3) for (const s of [-1, 1]) win(s * o.w * 0.28, 0.6 + o.h * 0.85, o.d / 2 + 0.01, 0);
  // chimney
  const cx = (R() < 0.5 ? -1 : 1) * o.w * 0.25, ch = mesh(new THREE.BoxGeometry(0.6, rh + 1.2, 0.6), stoneM, cx, top + (rh + 1.2) / 2 - 0.3, -o.d * 0.2);
  G.add(ch);
  scene.add(G);
  G.updateMatrixWorld(true);
  const cp = new THREE.Vector3(cx, top + rh + 0.4, -o.d * 0.2).applyMatrix4(G.matrixWorld);
  W.emitters.push({ kind: 'smoke', x: cp.x, y: cp.y, z: cp.z, rate: 5 });
  W.nav.blockRect(o.x, o.z, o.w + 0.3, o.d + 0.3, o.rot, 0.2);
  o.G = G; (W.houses || (W.houses = [])).push(o);
  return G;
}

function lampPost(scene, W, x, z, intensity = 14) {
  const dark = W.mats.iron || (W.mats.iron = std({ color: '#26221e', metalness: 0.6, roughness: 0.5 }));
  scene.add(mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.6, 6), dark, x, 1.3, z));
  scene.add(mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), dark, x + 0.25, 2.55, z));
  const lamp = mesh(new THREE.BoxGeometry(0.26, 0.34, 0.26), new THREE.MeshStandardMaterial({ color: '#331d06', emissive: '#ffb14a', emissiveIntensity: 3 }), x + 0.5, 2.3, z, false);
  scene.add(lamp);
  if (W.Q !== 'low') { const L = new THREE.PointLight('#ffb35c', intensity, 11, 1.6); L.position.set(x + 0.5, 2.2, z); scene.add(L); W.lights.push({ L, base: intensity, flick: 0.08 }); }
  W.nav.blockCircle(x, z, 0.3);
}

function campfire(scene, W, x, z, big = 1, color = '#ff8a2a') {
  const stoneGeo = new THREE.DodecahedronGeometry(0.16 * big, 0), sm = std({ color: '#55524b' });
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; const m = mesh(stoneGeo, sm, x + Math.cos(a) * 0.55 * big, 0.08, z + Math.sin(a) * 0.55 * big); m.rotation.set(R() * 3, R() * 3, 0); scene.add(m); }
  const logM = W.mats.log || (W.mats.log = std({ map: T.toTex(T.bark(), [1, 1]) }));
  for (let k = 0; k < 3; k++) { const m = mesh(new THREE.CylinderGeometry(0.07 * big, 0.08 * big, 0.9 * big, 6), logM, x, 0.15, z); m.rotation.set(Math.PI / 2 - 0.35, (k / 3) * Math.PI * 2, 0, 'YXZ'); scene.add(m); }
  const ember = mesh(new THREE.SphereGeometry(0.22 * big, 8, 6), new THREE.MeshStandardMaterial({ color: '#200a00', emissive: color, emissiveIntensity: 2.5 }), x, 0.08, z, false); ember.scale.y = 0.4; scene.add(ember);
  const L = new THREE.PointLight(color, 26 * big, 14 * big, 1.5); L.position.set(x, 0.9, z); scene.add(L);
  W.lights.push({ L, base: 26 * big, flick: 0.25 });
  W.emitters.push({ kind: 'fire', x, y: 0.15, z, rate: 26 * big, size: big, color });
  W.emitters.push({ kind: 'smoke', x, y: 1.4, z, rate: 3 });
  W.nav.blockCircle(x, z, 0.8 * big);
}

function addRot(scene, m, rx = 0, ry = 0, rz = 0) { m.rotation.set(rx, ry, rz); scene.add(m); return m; }
function barrel(scene, x, z, W) {
  const m = mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.85, 12), W.mats.barrel || (W.mats.barrel = std({ map: T.toTex(T.planks('#7a5534'), [2, 0.5]) })), x, 0.43, z);
  scene.add(m);
  for (const y of [0.15, 0.7]) addRot(scene, mesh(new THREE.TorusGeometry(0.31, 0.025, 4, 16), W.mats.iron || (W.mats.iron = std({ color: '#26221e', metalness: 0.6, roughness: 0.5 })), x, y, z), Math.PI / 2);
  W.nav.blockCircle(x, z, 0.4);
}
function crate(scene, x, z, W, s = 0.7, ry = 0) {
  const m = mesh(new THREE.BoxGeometry(s, s, s), W.mats.crate || (W.mats.crate = std({ map: T.toTex(T.planks('#80603c'), [1, 1]) })), x, s / 2, z); m.rotation.y = ry; scene.add(m);
  W.nav.blockRect(x, z, s, s, ry, 0.15);
  return m;
}
function fence(scene, W, pts) {
  const wood = W.mats.fence || (W.mats.fence = std({ color: '#5a4430' }));
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.6));
    for (let k = 0; k <= n; k++) { const t = k / n; scene.add(mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), wood, ax + (bx - ax) * t, 0.45, az + (bz - az) * t)); }
    for (const y of [0.35, 0.72]) { const r = mesh(new THREE.BoxGeometry(L, 0.07, 0.05), wood, (ax + bx) / 2, y, (az + bz) / 2); r.rotation.y = -Math.atan2(bz - az, bx - ax); scene.add(r); }
    for (let k = 0; k <= Math.ceil(L / 0.4); k++) { const t = k / Math.ceil(L / 0.4); W.nav.blockCircle(ax + (bx - ax) * t, az + (bz - az) * t, 0.2); }
  }
}

function village(scene, W) {
  const P = PLAZAS[0];
  const H = [
    { x: -11, z: 13, w: 6, d: 5, h: 2.7, roof: ['#5a3a2e', '#6b4434', '#4b3026', '#734b38'] },
    { x: -12, z: 23.5, w: 5, d: 4.6, h: 2.4, roof: 'thatch' },
    { x: 11.5, z: 12.5, w: 5.4, d: 4.6, h: 2.6, roof: ['#3e4752', '#4a5360', '#363e48', '#545e6b'] },
    { x: 13, z: 24, w: 6, d: 5, h: 2.8, roof: 'thatch', wall: '#cfc0a0' },
    { x: -8.5, z: 31, w: 8.5, d: 5.6, h: 3.3, roof: ['#5a3a2e', '#6b4434', '#4b3026', '#734b38'], inn: true },
    { x: 9, z: 32, w: 5, d: 4.4, h: 2.5, roof: ['#3e4752', '#4a5360', '#363e48'] },
    { x: -6.5, z: 6.5, w: 4.4, d: 4, h: 2.3, roof: 'thatch', wall: '#d2c29c' },
    { x: 18, z: 18, w: 4.6, d: 4.2, h: 2.4, roof: ['#5a3a2e', '#6b4434', '#4b3026'] },
  ];
  for (const o of H) {
    o.rot = Math.atan2(P.x - o.x, P.z - o.z) + rr(-0.12, 0.12);
    if (o.inn) o.rot = Math.atan2(2 - o.x, 26 - o.z);
    const G = house(scene, W, o);
    if (o.inn) {
      const sign = new THREE.Group(); sign.position.set(o.w / 2 - 0.4, 2.7, o.d / 2 + 0.6); G.add(sign);
      sign.add(mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), std({ color: '#2a1d12' }), 0, 0.5, -0.3));
      const pl = new THREE.Group(); pl.position.set(0, 0.1, 0.25); pl.rotation.y = Math.PI / 2; sign.add(pl);
      pl.add(mesh(new THREE.BoxGeometry(1.3, 0.62, 0.05), std({ color: '#3a2616' })));
      const tt = T.textTex('醉鹿亭');
      for (const sd of [1, -1]) { const f = mesh(new THREE.PlaneGeometry(1.24, 0.56), std({ map: tt }), 0, 0, sd * 0.03, false); if (sd < 0) f.rotation.y = Math.PI; pl.add(f); }
    }
  }
  // well
  const [wx, wz] = SPOTS.well, stoneM = W.mats.stone;
  const ring = mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.85, 16, 1, true), stoneM, wx, 0.42, wz); ring.material = std({ map: T.toTex(T.stone('#857e70'), [3, 0.5]), side: THREE.DoubleSide }); scene.add(ring);
  addRot(scene, mesh(new THREE.TorusGeometry(0.86, 0.1, 6, 18), std({ color: '#6c665a' }), wx, 0.85, wz), Math.PI / 2);
  addRot(scene, mesh(new THREE.CircleGeometry(0.8, 16), std({ color: '#0c1416', roughness: 0.1 }), wx, 0.5, wz, false), -Math.PI / 2);
  const wood = std({ color: '#4a3424' });
  for (const s of [-1, 1]) scene.add(mesh(new THREE.BoxGeometry(0.12, 2, 0.12), wood, wx + s * 0.85, 1, wz));
  addRot(scene, mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), wood, wx, 1.6, wz), 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) { const r = mesh(new THREE.BoxGeometry(1.4, 0.08, 1.9), std({ map: T.toTex(T.shingles(['#5a3a2e', '#6b4434']), [1, 1]) }), wx, 2.15, wz + s * 0.45); r.rotation.x = s * 0.6; scene.add(r); }
  scene.add(mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.25, 8), std({ color: '#6b4b2e' }), wx, 1.2, wz));
  W.nav.blockCircle(wx, wz, 1.05);
  // campfire with log seats
  const [fx, fz] = SPOTS.fire;
  campfire(scene, W, fx, fz, 1);
  const logM = W.mats.log;
  for (const [dx, dz, ry] of [[-1.6, 0.2, 0.2], [0.4, 1.6, 1.5], [1.4, -1.0, -0.8]]) { const m = mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.5, 8), logM, fx + dx, 0.2, fz + dz); m.rotation.set(0, ry, Math.PI / 2, 'YXZ'); scene.add(m); W.nav.blockCircle(fx + dx, fz + dz, 0.4); }
  W.inter.fire = { pos: new THREE.Vector3(fx, 0, fz), r: 2.2, name: '營火', hint: '在營火旁休息（回復全隊）' };
  // market stall
  const [mx, mz] = SPOTS.merchant;
  const dl = Math.hypot(P.x - mx, P.z - mz), dx = (P.x - mx) / dl, dz = (P.z - mz) / dl;
  const st = new THREE.Group(); st.position.set(mx + dx * 0.9, 0, mz + dz * 0.9); st.rotation.y = Math.atan2(dx, dz); scene.add(st);
  const post = std({ color: '#4a3424' });
  for (const [px, pz] of [[-1.3, -0.7], [1.3, -0.7], [-1.3, 0.7], [1.3, 0.7]]) st.add(mesh(new THREE.BoxGeometry(0.1, 2.3, 0.1), post, px, 1.15, pz));
  const canopy = mesh(new THREE.BoxGeometry(3, 0.05, 1.9), std({ map: T.toTex(T.cloth('#8b2c2c', '#e2d3a6'), [3, 1]) }), 0, 2.35, 0); canopy.rotation.x = 0.18; st.add(canopy);
  st.add(mesh(new THREE.BoxGeometry(2.6, 0.9, 0.7), std({ map: T.toTex(T.planks('#7a5534'), [2, 1]) }), 0, 0.45, 0.6 - 0.3));
  const fruitC = ['#c0392b', '#e67e22', '#d4ac0d', '#7d9c2c'];
  for (let k = 0; k < 26; k++) st.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), std({ color: pick(fruitC), roughness: 0.5 }), rr(-1.1, 1.1), 0.97, rr(0.05, 0.5), false));
  for (let k = 0; k < 4; k++) { const b = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 8), new THREE.MeshStandardMaterial({ color: pick(['#c0392b', '#2e86c1', '#28b463']), roughness: 0.15, transparent: true, opacity: 0.85, emissive: '#330000', emissiveIntensity: 0.4 }), -0.9 + k * 0.3, 1.03, 0.55, false); st.add(b); }
  W.nav.blockRect(st.position.x, st.position.z, 3, 1.9, st.rotation.y, 0.2);
  // props
  for (const [x, z] of [[-7.6, 11.2], [-7.2, 12.2], [8.2, 10.8], [9.6, 27.5], [-9.5, 27.8], [-4.2, 28], [15.6, 21]]) barrel(scene, x, z, W);
  for (const [x, z, s] of [[8.6, 21.2, 0.7], [9.3, 22.0, 0.55], [-13.6, 18, 0.7], [-4.5, 27.3, 0.6], [14.5, 15.8, 0.7]]) crate(scene, x, z, W, s, R());
  fence(scene, W, [[-16, 16.5], [-16, 20], [-13.5, 20.5]]);
  fence(scene, W, [[15.5, 28], [19, 26.5], [21, 22]]);
  fence(scene, W, [[-3, 36], [-1.6, 34.5]]);
  // hay bales
  const hay = std({ map: T.toTex(T.thatch(), [1, 1]) });
  for (const [x, z] of [[-14.5, 21.5], [16.5, 29]]) { const m = mesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 12), hay, x, 0.6, z); m.rotation.z = Math.PI / 2; scene.add(m); W.nav.blockCircle(x, z, 0.7); }
  // lamp posts
  lampPost(scene, W, 1.8, 27); lampPost(scene, W, -1.9, 9); lampPost(scene, W, -2.6, -2.2, 10); lampPost(scene, W, 6.5, 15);
  // notice board
  const nb = new THREE.Group(); nb.position.set(-5.5, 0, 15.8); nb.rotation.y = 0.8; scene.add(nb);
  for (const s of [-1, 1]) nb.add(mesh(new THREE.BoxGeometry(0.1, 2, 0.1), post, s * 0.7, 1, 0));
  nb.add(mesh(new THREE.BoxGeometry(1.6, 1, 0.08), std({ map: T.toTex(T.planks('#6b4b2e')) }), 0, 1.35, 0));
  for (let k = 0; k < 4; k++) { const p = mesh(new THREE.PlaneGeometry(rr(0.25, 0.4), rr(0.3, 0.45)), std({ color: '#e8dcc0' }), rr(-0.5, 0.5), rr(1.15, 1.6), 0.05, false); p.rotation.z = rr(-0.15, 0.15); nb.add(p); }
  W.nav.blockRect(-5.5, 15.8, 1.6, 0.4, 0.8);
}

function camp(scene, W) {
  const [cx, cz] = SPOTS.camp;
  campfire(scene, W, cx, cz, 1.25, '#ff7a22');
  const hide = std({ map: T.toTex(T.cloth('#6e5636', '#5d482c'), [2, 1]), side: THREE.DoubleSide });
  for (const [x, z, s] of [[-18.5, -18.5, 1.3], [-9.5, -25.5, 1.1], [-17.5, -26.3, 1.2], [-11, -17.6, 1]]) {
    const t = mesh(new THREE.ConeGeometry(1.5 * s, 2.4 * s, 6, 1, true), hide, x, 1.2 * s, z); t.rotation.y = R(); scene.add(t);
    scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.9 * s, 5), std({ color: '#3a2a1a' }), x, 1.45 * s, z));
    const door = mesh(new THREE.PlaneGeometry(0.7 * s, 1.1 * s), std({ color: '#140e08' }), x, 0.55 * s, z, false);
    door.lookAt(cx, 0.55 * s, cz); door.position.x += (cx - x) / Math.hypot(cx - x, cz - z) * 0.75 * s; door.position.z += (cz - z) / Math.hypot(cx - x, cz - z) * 0.75 * s; scene.add(door);
    W.nav.blockCircle(x, z, 1.4 * s);
  }
  // palisade arc to the north-west
  const logM = W.mats.log;
  for (let a = 2.0; a < 4.6; a += 0.13) {
    const x = cx + Math.cos(a) * 8.5, z = cz + Math.sin(a) * 8.5, h = rr(1.6, 2.3);
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.set(rr(-0.08, 0.08), 0, rr(-0.08, 0.08)); scene.add(g);
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.18, h, 7), logM, 0, h / 2, 0));
    g.add(mesh(new THREE.ConeGeometry(0.16, 0.4, 7), logM, 0, h + 0.2, 0));
    W.nav.blockCircle(x, z, 0.35);
  }
  // totem with skull
  const [tx, tz] = [-17.8, -21.6];
  scene.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.6, 6), logM, tx, 1.3, tz));
  scene.add(mesh(new THREE.SphereGeometry(0.22, 10, 8), std({ color: '#d8d0b8' }), tx, 2.75, tz));
  const banner = mesh(new THREE.PlaneGeometry(0.6, 1.0), std({ color: '#7a1f18', side: THREE.DoubleSide }), tx + 0.32, 2.1, tz, false); scene.add(banner);
  W.anim.push((t) => { banner.rotation.y = Math.sin(t * 1.3) * 0.25; });
  W.nav.blockCircle(tx, tz, 0.35);
  for (const [x, z] of [[-11.2, -21.0], [-12.2, -24.6]]) crate(scene, x, z, W, 0.6, R());
  const bone = std({ color: '#d9d1bb' });
  for (let k = 0; k < 8; k++) { const m = mesh(new THREE.CapsuleGeometry(0.03, 0.3, 2, 5), bone, cx + rr(-3, 3), 0.04, cz + rr(-3, 3), false); m.rotation.set(Math.PI / 2, 0, R() * 3); scene.add(m); }
  // hidden chest
  W.inter.campChest = chest(scene, W, -20.6, -24.2, 0.6, { name: '半埋的箱子', hidden: true });
}

export function chest(scene, W, x, z, ry, o = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const wood = std({ map: T.toTex(T.planks('#6a4426'), [1, 1]) }), iron = std({ color: '#3b3530', metalness: 0.7, roughness: 0.4 });
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), wood, 0, 0.25, 0));
  const lid = new THREE.Group(); lid.position.set(0, 0.5, -0.3); g.add(lid);
  const top = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10, 1, false, 0, Math.PI), wood, 0, 0, 0.3); top.rotation.z = Math.PI / 2; lid.add(top);
  lid.add(mesh(new THREE.BoxGeometry(0.94, 0.06, 0.05), iron, 0, 0.0, 0.6));
  for (const s of [-0.3, 0.3]) g.add(mesh(new THREE.BoxGeometry(0.06, 0.52, 0.62), iron, s, 0.26, 0));
  g.add(mesh(new THREE.BoxGeometry(0.14, 0.16, 0.04), std({ color: '#c9a540', metalness: 0.8, roughness: 0.3 }), 0, 0.42, 0.31));
  if (o.hidden) g.visible = false;
  W.nav.blockRect(x, z, 0.9, 0.6, ry, 0.15);
  return { pos: new THREE.Vector3(x, 0, z), r: 1.8, name: o.name || '箱子', hint: '打開', obj: g, lid, hidden: !!o.hidden, chest: true };
}

function ruins(scene, W) {
  const [rx, rz] = SPOTS.ruin;
  const sm = std({ map: T.toTex(T.stone('#8a877c', '#4a4842', true), [1, 2]) });
  const moss = std({ color: '#4c5f33' });
  const pillar = (x, z, h, broken) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    g.add(mesh(new THREE.BoxGeometry(1.2, 0.35, 1.2), sm, 0, 0.17, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.42, 0.48, h, 12), sm, 0, 0.35 + h / 2, 0));
    if (!broken) g.add(mesh(new THREE.BoxGeometry(1.1, 0.3, 1.1), sm, 0, 0.35 + h + 0.15, 0));
    else { const cap = mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.4, 6), sm, 0.1, 0.35 + h + 0.1, 0); cap.rotation.set(0.4, 0, 0.3); g.add(cap); }
    if (R() < 0.6) { const m = mesh(new THREE.SphereGeometry(0.5, 7, 5), moss, rr(-0.2, 0.2), 0.3, rr(-0.2, 0.2), false); m.scale.set(1.1, 0.35, 1.1); g.add(m); }
    W.nav.blockCircle(x, z, 0.75);
  };
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.1;
    if (k === 3 || k === 4) continue; // entrance gap toward the path (south-west)
    if (k === 8) continue;
    const broken = R() < 0.45;
    pillar(rx + Math.cos(a) * 7.6, rz + Math.sin(a) * 7.6, broken ? rr(1.2, 2.6) : 4.2, broken);
  }
  // lintel across two intact pillars at the back
  const a1 = (10 / 12) * Math.PI * 2 + 0.1, a2 = (11 / 12) * Math.PI * 2 + 0.1;
  const l = mesh(new THREE.BoxGeometry(4.2, 0.55, 1.0), sm, rx + (Math.cos(a1) + Math.cos(a2)) * 3.75, 5.15, rz + (Math.sin(a1) + Math.sin(a2)) * 3.75);
  l.rotation.y = -Math.atan2(Math.sin(a2) - Math.sin(a1), Math.cos(a2) - Math.cos(a1)); scene.add(l);
  // fallen pillar
  const fp = mesh(new THREE.CylinderGeometry(0.42, 0.46, 4, 12), sm, rx + 4.5, 0.42, rz + 3.8); fp.rotation.set(0, 0.6, Math.PI / 2); scene.add(fp);
  for (let k = 0; k < 9; k++) { const s = (k / 8 - 0.5) * 4; W.nav.blockCircle(rx + 4.5 + Math.cos(0.6) * s, rz + 3.8 - Math.sin(0.6) * s, 0.55); }
  // altar dais
  const [ax, az] = SPOTS.altar;
  scene.add(mesh(new THREE.BoxGeometry(6, 0.3, 3.6), sm, ax, 0.15, az));
  scene.add(mesh(new THREE.BoxGeometry(4.2, 0.3, 2.4), sm, ax, 0.45, az - 0.3));
  scene.add(mesh(new THREE.BoxGeometry(1.7, 0.95, 0.9), sm, ax, 1.07, az - 0.5));
  scene.add(mesh(new THREE.BoxGeometry(1.8, 0.04, 1.0), std({ color: '#5c1e1e' }), ax, 1.56, az - 0.5));
  W.nav.blockRect(ax, az - 0.3, 4.4, 2.6, 0, 0.1);
  // lantern
  const lan = new THREE.Group(); lan.position.set(ax, 1.58, az - 0.5); scene.add(lan);
  const brass = std({ color: '#b08a3a', metalness: 0.85, roughness: 0.3 });
  lan.add(mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.06, 10), brass, 0, 0.03, 0));
  lan.add(mesh(new THREE.ConeGeometry(0.22, 0.2, 10), brass, 0, 0.62, 0));
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; lan.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 4), brass, Math.cos(a) * 0.18, 0.3, Math.sin(a) * 0.18)); }
  lan.add(mesh(new THREE.TorusGeometry(0.07, 0.015, 5, 10), brass, 0, 0.78, 0));
  const core = mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffd27a', emissiveIntensity: 6 }), 0, 0.3, 0, false); lan.add(core);
  const LL = new THREE.PointLight('#ffd58a', 22, 12, 1.4); LL.position.set(ax, 2.2, az - 0.5); scene.add(LL);
  W.lights.push({ L: LL, base: 22, flick: 0.05 });
  W.lantern = { g: lan, light: LL };
  W.inter.lantern = { pos: new THREE.Vector3(ax, 0, az + 1.3), r: 2.4, name: '晨星燈', hint: '拿起晨星燈' };
  // blue braziers
  W.braziers = [];
  for (const [bx, bz] of [[rx - 3.6, rz - 3.4], [rx + 3.6, rz - 3.4]]) {
    const g = new THREE.Group(); g.position.set(bx, 0, bz); scene.add(g);
    const iron = W.mats.iron || (W.mats.iron = std({ color: '#26221e', metalness: 0.6, roughness: 0.5 }));
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; const leg = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 4), iron, Math.cos(a) * 0.22, 0.5, Math.sin(a) * 0.22); leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); g.add(leg); }
    g.add(mesh(new THREE.CylinderGeometry(0.42, 0.22, 0.3, 10), iron, 0, 1.05, 0));
    const coal = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 10), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#3ad7ff', emissiveIntensity: 2 }), 0, 1.18, 0, false); g.add(coal);
    const L = new THREE.PointLight('#4fd8ff', 16, 10, 1.4); L.position.set(bx, 1.8, bz); scene.add(L);
    const lt = { L, base: 16, flick: 0.2 }; W.lights.push(lt);
    const em = { kind: 'fire', x: bx, y: 1.2, z: bz, rate: 22, size: 0.7, color: '#3ad7ff' }; W.emitters.push(em);
    const br = { pos: new THREE.Vector3(bx, 0, bz), r: 2.2, name: '藍火火盆', hint: '踢翻火盆', g, coal, light: lt, em, lit: true, brazier: true };
    W.braziers.push(br);
    W.nav.blockCircle(bx, bz, 0.5);
  }
  W.inter.brazierA = W.braziers[0]; W.inter.brazierB = W.braziers[1];
  // graves around
  const gs = std({ color: '#6f6d66' });
  for (let k = 0; k < 16; k++) {
    const a = rr(0, Math.PI * 2), r = rr(10.5, 13.5), x = rx + Math.cos(a) * r, z = rz + Math.sin(a) * r;
    if (pathDist(x, z) < 2.2 || z < WALK.z0 + 0.5) continue;
    const g = mesh(new THREE.BoxGeometry(0.6, 0.9, 0.16), gs, x, 0.4, z); g.rotation.set(rr(-0.2, 0.2), Math.atan2(rx - x, rz - z), rr(-0.15, 0.15)); scene.add(g);
    const tg = new THREE.CylinderGeometry(0.3, 0.3, 0.16, 10, 1, false, 0, Math.PI); tg.rotateZ(Math.PI / 2); tg.rotateY(Math.PI / 2);
    g.add(mesh(tg, gs, 0, 0.45, 0));
    W.nav.blockCircle(x, z, 0.4);
  }
  W.inter.ruinChest = chest(scene, W, rx + 6.2, rz - 5.2, -0.8, { name: '祭品箱' });
  // ghostly mist emitters
  for (let k = 0; k < 4; k++) W.emitters.push({ kind: 'mist', x: rx + rr(-6, 6), y: 0.3, z: rz + rr(-6, 6), rate: 1.2, color: '#9fc7d8' });
}

function clearing(scene, W) {
  const [x, z] = SPOTS.wolves;
  const rockGeo = prep(colorize(blob(0.9, 1, 0, 0, 0, 0.25, 1.2, 0.7, 1), (c) => c.setHSL(0.1, 0.05, rr(0.3, 0.42))));
  for (const [dx, dz, s] of [[3.2, -2.5, 1.2], [-3.5, -1.5, 0.9], [2.8, 2.6, 0.8]]) { const m = mesh(rockGeo, std({ vertexColors: true }), x + dx, 0.2, z + dz); m.scale.setScalar(s); m.rotation.y = R() * 6; scene.add(m); W.nav.blockCircle(x + dx, z + dz, 1.0 * s); }
  const bone = std({ color: '#d9d1bb' });
  for (let k = 0; k < 6; k++) { const m = mesh(new THREE.CapsuleGeometry(0.035, 0.35, 2, 5), bone, x + rr(-1.5, 1.5), 0.05, z + rr(-1.5, 1.5), false); m.rotation.set(Math.PI / 2, 0, R() * 3); scene.add(m); }
  W.inter.wolfChest = chest(scene, W, x + 2.4, z - 1.2, -0.4, { name: '獵人的背包' });
  W.inter.wolfChest.bag = true;
}

// ---------------------------------------------------------------------------
function treeGeos() {
  const out = [];
  for (let v = 0; v < 3; v++) {
    const parts = [];
    const th = rr(2.2, 3);
    parts.push(colorize(prep(new THREE.CylinderGeometry(0.16, 0.3, th, 7).translate(0, th / 2, 0)), (c, x, y) => c.setRGB(0.24 + y * 0.01, 0.17, 0.11)));
    for (let k = 0; k < 2; k++) { const bg = new THREE.CylinderGeometry(0.05, 0.1, 1.3, 5).translate(0, 0.65, 0); bg.rotateZ(rr(0.6, 1.0) * (k ? 1 : -1)); bg.translate(0, th * 0.7, 0); parts.push(colorize(prep(bg), (c) => c.setRGB(0.24, 0.17, 0.11))); }
    const n = 4 + v;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + R(), rad = k === 0 ? 0 : rr(0.6, 1.1);
      const r = k === 0 ? rr(1.3, 1.6) : rr(0.9, 1.25);
      const g = blob(r, 2, Math.cos(a) * rad, th + (k === 0 ? 0.9 : rr(0, 0.8)), Math.sin(a) * rad, 0.16, 1, 0.85, 1);
      const hue = rr(0.23, 0.28);
      parts.push(colorize(prep(g), (c, x, y, z) => { const t = Math.min(1, Math.max(0, (y - th + 0.9) / 3)); c.setHSL(hue + rr(-0.01, 0.01), 0.45, 0.13 + t * 0.2 + (x + z) * 0.01); }));
    }
    out.push(mergeGeometries(parts));
  }
  for (let v = 0; v < 2; v++) {
    const parts = [];
    const th = rr(1.0, 1.4);
    parts.push(colorize(prep(new THREE.CylinderGeometry(0.12, 0.22, th + 2, 6).translate(0, (th + 2) / 2, 0)), (c) => c.setRGB(0.22, 0.15, 0.1)));
    const L = 4 + v;
    for (let k = 0; k < L; k++) {
      const t = k / L, r = (1.6 - t * 1.2) * rr(0.9, 1.1), h = 1.5 - t * 0.4, y = th + k * 0.95;
      const g = new THREE.ConeGeometry(r, h, 9, 2).translate(0, y + h / 2, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), yy = p.getY(i); const f = 1 + 0.12 * Math.sin(x * 5 + z * 7 + k); p.setXYZ(i, x * f, yy - (Math.hypot(x, z) > r * 0.8 ? 0.15 : 0), z * f); }
      parts.push(colorize(prep(g), (c, x, yy) => c.setHSL(0.36 + rr(-0.01, 0.01), 0.35, 0.1 + ((yy - y) / h) * 0.1 + t * 0.06)));
    }
    out.push(mergeGeometries(parts));
  }
  // dead tree
  {
    const parts = [];
    parts.push(colorize(prep(new THREE.CylinderGeometry(0.14, 0.28, 3.4, 6).translate(0, 1.7, 0)), (c) => c.setRGB(0.27, 0.24, 0.21)));
    for (let k = 0; k < 5; k++) { const bg = new THREE.CylinderGeometry(0.03, 0.08, rr(1, 1.8), 4).translate(0, 0.7, 0); bg.rotateZ(rr(0.5, 1.1)); bg.rotateY(R() * 6); bg.translate(0, rr(1.8, 3.2), 0); parts.push(colorize(prep(bg), (c) => c.setRGB(0.27, 0.24, 0.21))); }
    out.push(mergeGeometries(parts));
  }
  return out;
}

function forest(scene, W, Q) {
  const geos = treeGeos(), mat = std({ vertexColors: true, roughness: 0.9 }); mat.userData.occKey = 'tree';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = W.uT || (W.uT = { value: 0 });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      float sw = max(0.0, position.y - 1.8) * 0.025; vec3 ip = instanceMatrix[3].xyz;
      transformed.x += sin(uT * 1.1 + ip.x * 0.3 + ip.z * 0.2) * sw; transformed.z += cos(uT * 0.9 + ip.z * 0.3) * sw * 0.6;
      #endif`);
  };
  occlude(mat);
  const lists = geos.map(() => []);
  const taken = [];
  const ok = (x, z, sp) => { for (const [a, b] of taken) if ((a - x) ** 2 + (b - z) ** 2 < sp * sp) return false; return true; };
  const place = (x, z, type, sp = 2.2) => {
    if (!ok(x, z, sp)) return false;
    taken.push([x, z]); lists[type].push([x, z, rr(0.8, 1.25), R() * 6]);
    if (W.nav.staticFreeAt(x, z)) W.nav.blockCircle(x, z, 0.45);
    return true;
  };
  // the hunter's tree
  place(SPOTS.hunter[0] + 0.3, SPOTS.hunter[1] - 1.0, 0, 1);
  const outside = (x, z) => x < WALK.x0 + 1 || x > WALK.x1 - 1 || z < WALK.z0 + 1 || z > WALK.z1 - 1;
  const N = Q === 'low' ? 3000 : 6000;
  for (let i = 0; i < N; i++) {
    const x = rr(MAP.x0 + 1, MAP.x0 + MAP.w - 1), z = rr(MAP.z0 + 1, MAP.z0 + MAP.h - 1);
    if (inStream(z, 0.5)) continue;
    const pd = pathDist(x, z), plz = plazaDist(x, z);
    const out = outside(x, z);
    if (!out && (pd < 2.6 || plz < 2.4 || !W.nav.staticFreeAt(x, z))) continue;
    if (z > 29 && Math.abs(x) < 21 && !(z > 44)) continue;
    let type;
    if (!out && Math.hypot(x - SPOTS.ruin[0], z - SPOTS.ruin[1]) < 15) { if (R() < 0.75) continue; type = R() < 0.6 ? 5 : 3; }
    else if (z > 5 && !out) {
      if (R() < 0.9 || plz < 4.5) continue;
      if ((W.houses || []).some((h) => Math.hypot(x - h.x, z - h.z) < Math.max(h.w, h.d) * 0.75 + 1.6)) continue;
      type = Math.floor(R() * 3);
    } else { const pine = z < -14 || out ? R() < 0.55 : R() < 0.2; type = pine ? 3 + (R() < 0.5 ? 1 : 0) : Math.floor(R() * 3); }
    place(x, z, type, out ? 1.8 : 2.4);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  W.trees = [];
  lists.forEach((L, k) => {
    if (!L.length) return;
    const im = new THREE.InstancedMesh(geos[k], mat, L.length);
    L.forEach(([x, z, s, r], i) => { q.setFromAxisAngle(up, r); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s * rr(0.9, 1.15), s)); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.receiveShadow = true; scene.add(im); W.trees.push(im);
  });
  // rocks & bushes
  const rockGeo = prep(colorize(blob(0.5, 1, 0, 0, 0, 0.3, 1.2, 0.7, 1), (c) => c.setHSL(0.1, 0.05, rr(0.27, 0.4))));
  const bushGeo = mergeGeometries([0, 1, 2].map((k) => prep(colorize(blob(rr(0.45, 0.6), 1, (k - 1) * 0.45, 0.35, rr(-0.2, 0.2), 0.2), (c, x, y) => c.setHSL(0.26, 0.42, 0.12 + y * 0.12)))));
  const sc = (geo, n, filt, sMin, sMax, block) => {
    const im = new THREE.InstancedMesh(geo, occlude(std({ vertexColors: true })), n); let k = 0;
    for (let t = 0; t < n * 8 && k < n; t++) {
      const x = rr(-34, 34), z = rr(-52, 38);
      if (!filt(x, z)) continue;
      const s = rr(sMin, sMax); q.setFromAxisAngle(up, R() * 6); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(k++, m4);
      if (block) W.nav.blockCircle(x, z, 0.45 * s);
    }
    im.count = k; im.castShadow = true; im.receiveShadow = true; scene.add(im);
  };
  sc(rockGeo, 70, (x, z) => !inStream(z, 0.5) && pathDist(x, z) > 2.6 && plazaDist(x, z) > 1.5 && W.nav.staticFreeAt(x, z), 0.5, 1.4, true);
  sc(bushGeo, Q === 'low' ? 120 : 260, (x, z) => !inStream(z, 0.3) && pathDist(x, z) > 2 && plazaDist(x, z) > 1 && W.nav.staticFreeAt(x, z) && (z < 6 || R() < 0.3), 0.6, 1.3, false);
}

function grass(scene, W, Q) {
  const n = Q === 'low' ? 0 : Q === 'med' ? 9000 : 22000;
  if (!n) return;
  const blades = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI + R() * 0.4, h = rr(0.28, 0.5), w = 0.05, lean = rr(-0.1, 0.1);
    const g = new THREE.BufferGeometry();
    const ca = Math.cos(a), sa = Math.sin(a), ox = rr(-0.1, 0.1), oz = rr(-0.1, 0.1);
    const v = [-w, 0, 0, w, 0, 0, lean, h, 0].map((val, i) => val);
    const pts = []; for (let i = 0; i < 9; i += 3) { const x = v[i], y = v[i + 1], z = v[i + 2] + (i === 6 ? lean : 0); pts.push(x * ca - z * sa + ox, y, x * sa + z * ca + oz); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute([0.18, 0.26, 0.09, 0.18, 0.26, 0.09, 0.62, 0.7, 0.32], 3));
    blades.push(g);
  }
  const geo = mergeGeometries(blades);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = W.uT || (W.uT = { value: 0 });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = instanceMatrix[3].xyz; float k = position.y * 0.5;
      transformed.x += (sin(uT * 1.9 + ip.x * 0.5 + ip.z * 0.35) * 0.6 + sin(uT * 3.7 + ip.z) * 0.25) * k * 0.5;
      transformed.z += cos(uT * 1.5 + ip.x * 0.3) * k * 0.2;`);
  };
  const im = new THREE.InstancedMesh(geo, mat, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  let k = 0;
  for (let t = 0; t < n * 4 && k < n; t++) {
    const x = rr(-33, 33), z = rr(-51, 38);
    if (inStream(z, 0.15)) continue;
    const pd = pathDist(x, z), pz = plazaDist(x, z);
    if (pd < 1.1 || pz < 0.2) continue;
    if (pd < 1.8 && R() < 0.6) continue;
    if (!W.nav.staticFreeAt(x, z) && !(x < WALK.x0 || x > WALK.x1 || z < WALK.z0 || z > WALK.z1)) continue;
    const forest = z < -3;
    if (forest && R() < 0.45) continue;
    const s = rr(0.7, 1.5) * (Math.abs(z - STREAM.z) < 3.2 ? 1.6 : 1);
    q.setFromAxisAngle(up, R() * 6); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s * rr(0.8, 1.3), s)); im.setMatrixAt(k, m4);
    col.setHSL(forest ? rr(0.17, 0.24) : rr(0.2, 0.27), rr(0.35, 0.6), rr(0.75, 1.1)); im.setColorAt(k, col);
    k++;
  }
  im.count = k; im.receiveShadow = true; scene.add(im);
  // flowers
  const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.06, 0), std({ roughness: 0.6 }), 600);
  let f = 0;
  for (let t = 0; t < 4000 && f < 600; t++) {
    const x = rr(-28, 28), z = rr(-48, 35);
    if (inStream(z, 0.3) || pathDist(x, z) < 1.6 || plazaDist(x, z) < 0.5 || !W.nav.staticFreeAt(x, z)) continue;
    m4.makeTranslation(x, rr(0.15, 0.3), z); fl.setMatrixAt(f, m4); fl.setColorAt(f, col.set(pick(['#f4f1e6', '#f1d24a', '#b98bd8', '#e8857a', '#9cc8f0']))); f++;
  }
  fl.count = f; scene.add(fl);
}

function fireflies(scene, W) {
  const n = 260, pos = new Float32Array(n * 3), base = [];
  for (let i = 0; i < n; i++) {
    let x, z; do { x = rr(-28, 28); z = rr(-46, 30); } while (pathDist(x, z) < 1 && R() < 0.7);
    base.push([x, rr(0.4, 2.2), z, R() * 10]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: '#d8ff7a', size: 0.12, map: T.softDot(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const P = new THREE.Points(g, m); P.frustumCulled = false; scene.add(P);
  W.anim.push((t) => {
    for (let i = 0; i < n; i++) { const [x, y, z, p] = base[i]; pos[i * 3] = x + Math.sin(t * 0.3 + p) * 1.2; pos[i * 3 + 1] = y + Math.sin(t * 0.7 + p * 2) * 0.3; pos[i * 3 + 2] = z + Math.cos(t * 0.25 + p) * 1.2; }
    g.attributes.position.needsUpdate = true;
    m.opacity = 0.55 + 0.45 * Math.sin(t * 2.3);
  });
}
