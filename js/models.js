// Character and creature models, built from shaped geometry and painted textures.
// Every rig keeps the same joints (hips, torso, head, arms, legs, hands) so actors.js can animate any of them.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V2 = THREE.Vector2, V3 = THREE.Vector3, TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const G1 = (d, s) => Math.exp(-(d * d) / (2 * s * s));
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------
// painted detail textures (greyscale; used as colour detail and as bump)
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function cv(w = 256, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function vnoise(n) {
  const a = Float32Array.from({ length: n * n }, rnd);
  const at = (i, j) => a[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v); };
}
function fbm(oct = [4, 8, 16, 32]) {
  const ns = oct.map(vnoise);
  return (x, y) => { let s = 0, a = 0.5, t = 0; ns.forEach((f, i) => { s += f(x / 256 * oct[i], y / 256 * oct[i]) * a; t += a; a *= 0.5; }); return s / t; };
}
function pixels(f, w = 256, h = w) {
  const [c, g] = cv(w, h); const im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = Math.max(0, Math.min(255, f(x, y))), i = (y * w + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); return [c, g];
}
const MAKE = {
  skin() { const n = fbm([8, 16, 64]); return pixels((x, y) => 200 + n(x, y) * 40 + (rnd() - 0.5) * 14)[0]; },
  rough() { const n = fbm([4, 16, 32, 64]); return pixels((x, y) => 150 + n(x, y) * 90 + (rnd() - 0.5) * 30)[0]; },
  weave() {
    const n = fbm([4, 8]);
    return pixels((x, y) => {
      const over = ((x >> 2) + (y >> 2)) & 1, tx = (x % 4 + 0.5) / 4, ty = (y % 4 + 0.5) / 4;
      return 120 + 80 * Math.sin((over ? ty : tx) * Math.PI) + n(x, y) * 50 + (rnd() - 0.5) * 16;
    })[0];
  },
  leather() {
    const n = fbm([4, 8, 32, 64]);
    const [c, g] = pixels((x, y) => 150 + n(x, y) * 80 + (rnd() - 0.5) * 24);
    g.lineCap = 'round';
    for (let i = 0; i < 160; i++) { const x = rnd() * 256, y = rnd() * 256, a = rnd() * TAU, l = 6 + rnd() * 18; g.strokeStyle = `rgba(40,40,40,${0.2 + rnd() * 0.3})`; g.lineWidth = 1 + rnd(); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rnd() * 4, y + Math.sin(a) * l * 0.5 + rnd() * 4, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    g.setLineDash([4, 3]); g.strokeStyle = 'rgba(235,235,235,0.7)'; g.lineWidth = 1.6;
    for (const y of [10, 246]) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    return c;
  },
  chain() {
    const [c, g] = cv(); g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 34; j++) for (let i = -1; i < 33; i++) {
      const x = i * 8 + (j & 1) * 4, y = j * 8 - 4;
      const gr = g.createRadialGradient(x - 1, y - 1, 0, x, y, 5.5); gr.addColorStop(0, '#f0f0f0'); gr.addColorStop(1, '#707070');
      g.strokeStyle = gr; g.lineWidth = 2.4; g.beginPath(); g.arc(x, y, 4.2, 0, TAU); g.stroke();
    }
    return c;
  },
  metal() {
    const n = fbm([4, 8, 16]); const row = Float32Array.from({ length: 256 }, () => (rnd() - 0.5) * 18);
    const [c, g] = pixels((x, y) => 205 + n(x, y) * 40 + row[y] + (rnd() - 0.5) * 6);
    for (let i = 0; i < 70; i++) { const x = rnd() * 256, y = rnd() * 256, a = rnd() * TAU, l = 4 + rnd() * 30; g.strokeStyle = `rgba(${rnd() < 0.5 ? '60,60,60' : '255,255,255'},${0.15 + rnd() * 0.35})`; g.lineWidth = 0.6 + rnd() * 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    return c;
  },
  rust() { const n = fbm([4, 8, 32, 64]), m = fbm([8, 16]); return pixels((x, y) => 120 + n(x, y) * 110 - (m(x, y) > 0.55 ? 60 : 0) + (rnd() - 0.5) * 40)[0]; },
  fur() {
    const [c, g] = cv(); g.fillStyle = '#707070'; g.fillRect(0, 0, 256, 256); g.lineCap = 'round';
    for (let i = 0; i < 9000; i++) {
      const x = rnd() * 256, y = rnd() * 256, l = 5 + rnd() * 12, a = Math.PI / 2 + (rnd() - 0.5) * 0.5, v = Math.floor(50 + rnd() * 190);
      g.strokeStyle = `rgba(${v},${v},${v},0.7)`; g.lineWidth = 0.8 + rnd() * 1.4;
      for (const dx of [0, 256, -256]) for (const dy of [0, 256, -256]) { if (dx || dy) { if (x + dx > 280 || x + dx < -30 || y + dy > 280 || y + dy < -30) continue; } g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); g.stroke(); }
    }
    return c;
  },
  hair() {
    const n = vnoise(64), m = fbm([4, 8]);
    return pixels((x, y) => { const w = x + Math.sin(y * 0.03) * 3 + m(x, y) * 10; return 90 + n(w / 4, y / 64) * 140 + n(w / 1.5, y / 16) * 40 + (rnd() - 0.5) * 12; })[0];
  },
  wood() {
    const n = fbm([4, 8, 16]);
    return pixels((x, y) => { const w = x + n(x, y) * 60; return 140 + 55 * Math.sin(w * 0.35) * Math.sin(w * 0.07 + 1) + n(x * 2, y) * 50 + (rnd() - 0.5) * 16; })[0];
  },
  bone() {
    const n = fbm([4, 8, 32, 64]);
    const [c, g] = pixels((x, y) => 190 + n(x, y) * 60 + (rnd() - 0.5) * 18);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(30,30,30,${0.2 + rnd() * 0.4})`; g.beginPath(); g.arc(rnd() * 256, rnd() * 256, 0.6 + rnd() * 1.6, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(40,40,40,0.5)'; g.lineWidth = 1;
    for (let i = 0; i < 14; i++) { let x = rnd() * 256, y = rnd() * 256; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 16; y += (rnd() - 0.5) * 16; g.lineTo(x, y); } g.stroke(); }
    return c;
  },
  wrinkle() {
    const n = fbm([8, 16, 32]);
    const [c, g] = pixels((x, y) => 170 + n(x, y) * 70 + (rnd() - 0.5) * 30);
    g.lineCap = 'round';
    for (let i = 0; i < 260; i++) { const x = rnd() * 256, y = rnd() * 256, l = 4 + rnd() * 14; g.strokeStyle = `rgba(30,30,30,${0.25 + rnd() * 0.3})`; g.lineWidth = 0.8 + rnd() * 1.2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * 0.5, y + (rnd() - 0.5) * 6, x + l, y + (rnd() - 0.5) * 3); g.stroke(); }
    return c;
  },
};
const CAN = {}, TEX = {};
function canOf(name) { return CAN[name] || (CAN[name] = MAKE[name]()); }
// colour version: same pattern, pulled towards white so base colours stay true
function colorCanvas(name) {
  const key = name + ':c'; if (CAN[key]) return CAN[key];
  const src = canOf(name), [c, g] = cv(src.width, src.height); g.drawImage(src, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
  const k = name === 'chain' ? 0.75 : name === 'fur' || name === 'hair' ? 0.55 : 0.35;
  for (let i = 0; i < d.length; i += 4) { const v = 255 - (255 - d[i]) * k; d[i] = d[i + 1] = d[i + 2] = v; }
  g.putImageData(im, 0, 0); return (CAN[key] = c);
}
function texOf(name, rep, color) {
  const key = name + (color ? ':c' : ':b') + rep;
  if (TEX[key]) return TEX[key];
  const t = new THREE.CanvasTexture(color ? colorCanvas(name) : canOf(name));
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 4;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return (TEX[key] = t);
}
const KIND = {
  skin:    { tex: 'skin', rep: [3, 3], r: 0.55, bump: 0.35 },
  gob:     { tex: 'wrinkle', rep: [3, 3], r: 0.6, bump: 1.1 },
  cloth:   { tex: 'weave', rep: [10, 10], r: 0.92, bump: 0.7 },
  rough:   { tex: 'rough', rep: [3, 3], r: 0.95, bump: 0.9 },
  leather: { tex: 'leather', rep: [2, 2], r: 0.58, bump: 0.9 },
  metal:   { tex: 'metal', rep: [2, 2], r: 0.3, m: 0.9, bump: 0.25 },
  dark:    { tex: 'metal', rep: [2, 2], r: 0.42, m: 0.85, bump: 0.3 },
  gold:    { tex: 'metal', rep: [3, 3], r: 0.28, m: 1.0, bump: 0.2 },
  chain:   { tex: 'chain', rep: [9, 9], r: 0.42, m: 0.85, bump: 1.6 },
  rust:    { tex: 'rust', rep: [2, 2], r: 0.8, m: 0.55, bump: 1.2 },
  fur:     { tex: 'fur', rep: [3, 3], r: 0.95, bump: 1.8 },
  hair:    { tex: 'hair', rep: [5, 1], r: 0.5, bump: 1.2 },
  wood:    { tex: 'wood', rep: [1, 2], r: 0.7, bump: 0.9 },
  bone:    { tex: 'bone', rep: [2, 2], r: 0.7, bump: 0.9 },
};
// metals and wet surfaces need something to reflect; main.js supplies a dusk sky
const SHINY = []; let ENV = null;
function mat(color, kind, extra = {}) {
  const k = KIND[kind] || {};
  const o = { color, roughness: k.r ?? 0.75, metalness: k.m ?? 0 };
  if (k.tex) { o.map = texOf(k.tex, k.rep, true); o.bumpMap = texOf(k.tex, k.rep, false); o.bumpScale = k.bump; }
  const m = new THREE.MeshStandardMaterial({ ...o, ...extra });
  if (m.metalness > 0.4 || m.roughness < 0.3) { SHINY.push(m); if (ENV) m.envMap = ENV; }
  return m;
}
export function setActorEnv(tex) { ENV = tex; for (const m of SHINY) { m.envMap = tex; m.needsUpdate = true; } }
// a small gradient sky (deep blue above, warm horizon, dark ground) prefiltered for reflections
export function duskEnv(renderer) {
  const sc = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: {},
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 top = vec3(0.16, 0.2, 0.42), hor = vec3(1.0, 0.62, 0.36), gnd = vec3(0.12, 0.1, 0.08); vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.5)) : mix(hor * 0.5, gnd, pow(-h, 0.4)); float sun = pow(max(0.0, dot(normalize(vP), normalize(vec3(0.6, 0.25, 0.75)))), 64.0); gl_FragColor = vec4(c * 1.2 + vec3(2.0, 1.4, 0.8) * sun, 1.0); }' }));
  sc.add(sky);
  const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(sc, 0.02).texture; pm.dispose();
  return t;
}
function glow(c, i = 2) { return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 }); }

// painted emblems (shields, tabards)
function emblemTex(kind, w, h) {
  const key = 'emb:' + kind; if (TEX[key]) return TEX[key];
  const [c, g] = cv(256, Math.round(256 * h / w));
  const W = c.width, H = c.height;
  const n = fbm([8, 16, 32]);
  if (kind === 'tower' || kind === 'sun') {
    g.fillStyle = kind === 'tower' ? '#8e2620' : '#ece4d0'; g.fillRect(0, 0, W, H);
    // a darker band along the edge, as if the rim shades it
    g.strokeStyle = kind === 'tower' ? '#5a1612' : '#bfb398'; g.lineWidth = 18; g.strokeRect(0, 0, W, H);
    if (kind === 'tower') {
      g.fillStyle = '#d8dce0'; g.strokeStyle = '#3a1210'; g.lineWidth = 3;
      const cx = W / 2, cy = H * 0.42;
      g.beginPath(); g.moveTo(cx - 38, cy + 60); g.lineTo(cx - 30, cy - 30); g.lineTo(cx - 40, cy - 30); g.lineTo(cx - 40, cy - 56); g.lineTo(cx - 24, cy - 56); g.lineTo(cx - 24, cy - 44);
      g.lineTo(cx - 8, cy - 44); g.lineTo(cx - 8, cy - 56); g.lineTo(cx + 8, cy - 56); g.lineTo(cx + 8, cy - 44); g.lineTo(cx + 24, cy - 44); g.lineTo(cx + 24, cy - 56); g.lineTo(cx + 40, cy - 56); g.lineTo(cx + 40, cy - 30); g.lineTo(cx + 30, cy - 30); g.lineTo(cx + 38, cy + 60); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#3a1210'; g.beginPath(); g.moveTo(cx - 10, cy + 60); g.lineTo(cx - 10, cy + 30); g.arc(cx, cy + 30, 10, Math.PI, 0); g.lineTo(cx + 10, cy + 60); g.fill();
      g.fillRect(cx - 4, cy - 14, 8, 18);
      g.fillStyle = '#e8c35a'; for (const [x, y] of [[cx - 60, cy + 92], [cx, cy + 102], [cx + 60, cy + 92]]) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k & 1 ? 5 : 12; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); }
    } else {
      const cx = W / 2, cy = H * 0.4;
      g.fillStyle = '#d9a93a'; g.strokeStyle = '#8a6420'; g.lineWidth = 3;
      g.beginPath(); for (let k = 0; k < 32; k++) { const a = k * Math.PI / 16, r = k & 1 ? 44 : 74; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#f2d67a'; g.beginPath(); g.arc(cx, cy, 34, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#c58d2a'; g.beginPath(); g.arc(cx, cy, 16, 0, TAU); g.fill();
    }
    // wear and grime
    const im = g.getImageData(0, 0, W, H), d = im.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, k = 0.82 + n(x, y) * 0.3 + (rnd() - 0.5) * 0.06; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
    g.putImageData(im, 0, 0);
  }
  if (kind === 'planks') {
    g.fillStyle = '#4a3a28'; g.fillRect(0, 0, W, H); const wn = fbm([4, 16]);
    const im = g.getImageData(0, 0, W, H), d = im.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, p = x % 52, gap = p < 3 ? 0.35 : 1, gr = 0.75 + 0.25 * Math.sin((y + wn(x, y) * 80) * 0.3 + Math.floor(x / 52) * 2) + wn(x * 3, y) * 0.2; const k = gap * gr; d[i] = 92 * k; d[i + 1] = 72 * k; d[i + 2] = 50 * k; }
    g.putImageData(im, 0, 0);
  }
  if (kind === 'surplice') {
    g.fillStyle = '#4e4945'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#7a2a14'; g.fillRect(0, 0, 22, H); g.fillRect(W - 22, 0, 22, H); g.fillRect(0, H - 26, W, 26);
    g.strokeStyle = '#c0752a'; g.lineWidth = 3; g.strokeRect(26, -4, W - 52, H - 26);
    g.fillStyle = '#c0752a'; const cx = W / 2, cy = H * 0.3;
    g.beginPath(); g.moveTo(cx, cy - 40); g.bezierCurveTo(cx + 30, cy - 10, cx + 22, cy + 30, cx, cy + 40); g.bezierCurveTo(cx - 22, cy + 30, cx - 30, cy - 10, cx, cy - 40); g.fill();
    g.fillStyle = '#2a1a12'; g.beginPath(); g.arc(cx, cy + 12, 10, 0, TAU); g.fill();
    const im = g.getImageData(0, 0, W, H), d = im.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, k = 0.8 + n(x, y) * 0.35; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
    g.putImageData(im, 0, 0);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (TEX[key] = t);
}
// alpha mask with a torn hem and a few holes
function ragTex() {
  if (TEX.rag) return TEX.rag;
  const n = vnoise(24), m = fbm([8, 16]);
  const [c] = pixels((x, y) => { const edge = 0.72 + n(x / 10.7, 0) * 0.2 + n(x / 3, 1) * 0.08; const v = y / 256 < edge ? 255 : 0; return m(x, y) > 0.7 ? 0 : v; });
  const t = new THREE.CanvasTexture(c); return (TEX.rag = t);
}

// ---------------------------------------------------------------------------
// geometry helpers; DET scales tessellation (lower on the low quality setting)
let DET = 1;
export function setDetail(q) { DET = q === 'low' ? 0.55 : q === 'med' ? 0.75 : 1; }
const seg = (n, min = 6) => Math.max(min, Math.round(n * DET));
function mk(geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; }
function add(parent, m) { parent.add(m); return m; }
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
// surface of revolution around Y; pts are [radius, y] from bottom to top; the seam sits at the back
function lathe(pts, o = {}) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new V2(Math.max(r, 0.0004), y)), seg(o.seg || 24), Math.PI, TAU);
  if (o.fn || o.sx || o.sz) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (o.fn) { const r = Math.hypot(x, z); if (r > 1e-6) { const r2 = o.fn(Math.atan2(x, z), y, r); x *= r2 / r; z *= r2 / r; } }
      p.setXYZ(i, x * (o.sx || 1), y, z * (o.sz || 1));
    }
    g.computeVertexNormals();
  }
  return g;
}
// tapered limb hanging from y=0 to y=-len, rounded at both ends
function limb(r0, r1, len, o = {}) {
  const rf = o.rf || ((t) => lerp(r0, r1, t) * (1 + (o.bulge || 0) * G1(t - (o.at ?? 0.35), 0.22)));
  const pts = [], n = 12, cb = o.capB ?? 0.7, ct = o.capT ?? 0.7;
  const R1 = rf(1), R0 = rf(0);
  for (let k = 0; k <= 3; k++) { const a = (k / 3) * Math.PI / 2; pts.push([R1 * Math.sin(a) + 0.0004, -len - R1 * cb * Math.cos(a)]); }
  for (let k = 1; k < n; k++) { const t = 1 - k / n; pts.push([rf(t), -t * len]); }
  for (let k = 0; k <= 3; k++) { const a = (k / 3) * Math.PI / 2; pts.push([R0 * Math.cos(a) + 0.0004, R0 * ct * Math.sin(a)]); }
  return lathe(pts, { seg: o.seg || 16, sx: o.sx, sz: o.sz, fn: o.fn });
}
// a sleeve / plate around part of a limb: same radius function, grown outward between t0 and t1
function limbPart(rf, len, t0, t1, grow, o = {}) {
  const pts = [], n = 10, lip = o.lip ?? 0.004;
  pts.push([Math.max(0.001, rf(t1) + grow - lip), -t1 * len - lip]);
  for (let k = 0; k <= n; k++) { const t = lerp(t1, t0, k / n); pts.push([rf(t) + grow * (o.flare ? 1 + o.flare * (t - t0) / (t1 - t0) : 1), -t * len]); }
  pts.push([Math.max(0.001, rf(t0) + grow - lip), -t0 * len + lip]);
  return lathe(pts, { seg: o.seg || 16, sx: o.sx, sz: o.sz, fn: o.fn });
}
// tube along a curve with a radius function; flat squashes the cross-section [normal, binormal]
function tube(pts, r, o = {}) {
  const curve = pts.isCurve ? pts : new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : new V3(p[0], p[1], p[2]))));
  const N = seg(o.n || 14, 4), R = seg(o.radial || 8, 4), [fn, fb] = o.flat || [1, 1];
  const fr = curve.computeFrenetFrames(N, false);
  const pos = [], uv = [], idx = [], rf = typeof r === 'function' ? r : () => r;
  const P = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, c = curve.getPointAt(t), rr = rf(t), Nn = fr.normals[i], B = fr.binormals[i]; P.push(c);
    for (let j = 0; j <= R; j++) {
      const a = (j / R) * TAU, cx = Math.cos(a) * rr * fn, cy = Math.sin(a) * rr * fb;
      pos.push(c.x + Nn.x * cx + B.x * cy, c.y + Nn.y * cx + B.y * cy, c.z + Nn.z * cx + B.z * cy); uv.push(j / R, t);
    }
  }
  const vp = (i) => new V3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  // orientation test on the first quad so faces always point outward
  const a0 = vp(0), b0 = vp(R + 1), c0 = vp(1), nrm = new V3().subVectors(b0, a0).cross(new V3().subVectors(c0, a0)), flip = nrm.dot(new V3().subVectors(a0, P[0])) < 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) {
    const a = i * (R + 1) + j, b = a + R + 1;
    if (!flip) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  // caps
  for (const [ring, c, dir] of [[0, P[0], -1], [N, P[N], 1]]) {
    const ci = pos.length / 3; pos.push(c.x, c.y, c.z); uv.push(0.5, ring / N);
    const T = curve.getTangentAt(ring / N).multiplyScalar(dir);
    for (let j = 0; j < R; j++) {
      const a = ring * (R + 1) + j, b = a + 1;
      const n2 = new V3().subVectors(vp(a), c).cross(new V3().subVectors(vp(b), c));
      if (n2.dot(T) >= 0) idx.push(ci, a, b); else idx.push(ci, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// average normals of vertices that share a position, so sphere seams don't show
function weld(g) {
  g.computeVertexNormals();
  const p = g.attributes.position, nm = g.attributes.normal, map = new Map();
  for (let i = 0; i < p.count; i++) { const k = Math.round(p.getX(i) * 1e5) + ',' + Math.round(p.getY(i) * 1e5) + ',' + Math.round(p.getZ(i) * 1e5); if (!map.has(k)) map.set(k, []); map.get(k).push(i); }
  for (const ids of map.values()) {
    if (ids.length < 2) continue;
    const v = new V3(); for (const i of ids) v.x += nm.getX(i), v.y += nm.getY(i), v.z += nm.getZ(i);
    v.normalize(); for (const i of ids) nm.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}
// a sphere whose every direction is mapped through f(x,y,z) -> [X,Y,Z] (and optional colour)
function warpSphere(f, ws = 48, hs = 32, colorFn) {
  const g = new THREE.SphereGeometry(1, seg(ws), seg(hs)), p = g.attributes.position, col = colorFn ? new Float32Array(p.count * 3) : null;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), q = f(x, y, z); p.setXYZ(i, q[0], q[1], q[2]);
    if (col) { const c = colorFn(x, y, z); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  }
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return weld(g);
}
// same, but the pole faces forward and the rings crowd around it, so the face gets the detail
function faceSphere(f, ws = 72, hs = 60, colorFn) {
  const g = new THREE.SphereGeometry(1, seg(ws), seg(hs)); g.rotateX(Math.PI / 2);
  const p = g.attributes.position, col = colorFn ? new Float32Array(p.count * 3) : null;
  for (let i = 0; i < p.count; i++) {
    const x0 = p.getX(i), y0 = p.getY(i), z0 = p.getZ(i), th = Math.acos(Math.max(-1, Math.min(1, z0))), ph = Math.atan2(y0, x0);
    const t2 = Math.PI * Math.pow(th / Math.PI, 1.4), r = Math.sin(t2), x = r * Math.cos(ph), y = r * Math.sin(ph), z = Math.cos(t2);
    const q = f(x, y, z); p.setXYZ(i, q[0], q[1], q[2]);
    if (col) { const c = colorFn(x, y, z); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  }
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return weld(g);
}
// ellipsoid with an optional flattened underside (feet, paws)
function blob(rx, ry, rz, flat = -1, ws = 14, hs = 10) {
  return warpSphere((x, y, z) => [x * rx, Math.max(y, flat) * ry, z * rz], ws, hs);
}
// merge each group's plain meshes by material, to keep draw calls low
function bake(root) {
  root.traverse((gp) => {
    if (!gp.isGroup && gp !== root) return;
    const buckets = new Map();
    for (const m of gp.children) {
      if (!m.isMesh || m.userData.keep || m.children.length) continue;
      const g = m.geometry, key = m.material.uuid + '|' + (g.index ? 'i' : 'n') + '|' + Object.keys(g.attributes).sort().join(',');
      if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(m);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const geos = list.map((m) => { m.updateMatrix(); const g = m.geometry.clone().applyMatrix4(m.matrix); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k); return g; });
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      for (const m of list) gp.remove(m);
      gp.add(mk(merged, list[0].material));
    }
  });
}

// ---------------------------------------------------------------------------
// heads
const HEAD = {
  man:    { w: 0.079, h: 0.114, d: 0.098, jaw: 0.1, jawAngle: 0.006, chin: 0.009, brow: 0.0055, socket: 0.007, cheek: 0.005, lips: 0.0038, back: 0.14, muzzle: 0, nose: 1 },
  woman:  { w: 0.075, h: 0.108, d: 0.095, jaw: 0.2, jawAngle: 0.002, chin: 0.006, brow: 0.003, socket: 0.006, cheek: 0.006, lips: 0.005, back: 0.14, muzzle: 0, nose: 0.82 },
  old:    { w: 0.079, h: 0.114, d: 0.097, jaw: 0.14, jawAngle: 0.004, chin: 0.006, brow: 0.0075, socket: 0.009, cheek: 0.0075, lips: 0.002, back: 0.12, muzzle: 0, nose: 1.1 },
  kid:    { w: 0.078, h: 0.108, d: 0.094, jaw: 0.4, chin: 0.003, brow: 0.002, socket: 0.006, cheek: 0.004, lips: 0.003, back: 0.16, muzzle: 0, nose: 0.65, eyeR: 1.12 },
  goblin: { w: 0.088, h: 0.1, d: 0.1, jaw: 0.14, chin: 0.004, brow: 0.014, socket: 0.006, cheek: 0.009, lips: 0.004, back: 0.2, muzzle: 0.016, nose: 1.9, mouthW: 1.5, eyeR: 1.25 },
  skull:  { w: 0.071, h: 0.104, d: 0.094, jaw: 0.5, chin: 0, brow: 0.008, socket: 0.02, cheek: 0.011, lips: 0, back: 0.12, muzzle: 0.004, nose: 0 },
};
function headShape(P) {
  const mw = P.mouthW || 1, n = P.nose || 0;
  return (x, y, z) => {
    let X = x * P.w, Y = y * P.h, Z = z * P.d;
    const f = sm(0.1, 0.7, z), ax = Math.abs(x);
    // jaw narrows towards the chin, the skull is fuller at the back
    if (y < 0) { const k = sm(0, 1, -y); X *= 1 - P.jaw * k * k * (0.5 + 0.5 * f); Z *= 1 - 0.2 * k * k * (1 - f); }
    if (z < 0) Z *= 1 + P.back * -z * sm(-0.6, 0.4, y);
    if (y > 0.5) Y *= 1 - 0.06 * sm(0.5, 1, y);
    // flatter sides and a flatter face plane, so it reads as a head rather than a ball
    X *= 1 - 0.07 * sm(0.3, 0.9, z) * sm(-0.3, 0.3, y);
    Z -= P.d * 0.07 * sm(0.55, 1, z) * sm(-0.7, -0.2, y) * (1 - sm(0.3, 0.6, y));
    let dz = 0, dx = 0;
    // eye sockets under a brow ridge, a dip at the bridge of the nose
    dz -= P.socket * G1(ax - 0.34, 0.12) * G1(y - 0.05, 0.085) * f;
    dz += P.brow * G1(ax - 0.3, 0.2) * G1(y - 0.2, 0.065) * f + P.brow * 0.5 * G1(x, 0.1) * G1(y - 0.2, 0.07) * f;
    dz -= 0.0018 * G1(x, 0.08) * G1(y - 0.12, 0.05) * f;
    // cheekbones
    const cb = P.cheek * G1(ax - 0.55, 0.15) * G1(y + 0.1, 0.12) * f; dz += cb * 0.6; dx += cb * Math.sign(x);
    // nose: a ridge that grows from the bridge to a rounded tip, with wings at the base
    if (n) {
      const up = sm(0.2, -0.27, y), down = 1 - sm(-0.25, -0.43, y);
      dz += 0.023 * n * Math.pow(up, 1.45) * down * G1(x, (0.06 + 0.075 * up) * (0.85 + 0.15 * n)) * f;
      dz += 0.004 * n * G1(x, 0.09) * G1(y + 0.26, 0.045) * f;
      dz += 0.0055 * n * G1(ax - 0.13 * (0.8 + 0.2 * n), 0.05) * G1(y + 0.31, 0.045) * f;
      dz -= 0.001 * G1(ax - 0.22, 0.05) * G1(y + 0.28, 0.08) * f;
    }
    // lips with a philtrum and a mouth line
    dz += P.lips * (G1(x, 0.15 * mw) * G1(y + 0.48, 0.04) + 1.1 * G1(x, 0.13 * mw) * G1(y + 0.59, 0.045)) * f;
    dz -= P.lips * 0.7 * G1(x, 0.16 * mw) * G1(y + 0.535, 0.022) * f;
    dz -= 0.0012 * G1(x, 0.03) * G1(y + 0.41, 0.04) * f;
    dz -= 0.0015 * G1(ax - 0.17 * mw, 0.04) * G1(y + 0.53, 0.06) * f;
    if (P.jawAngle) dx += P.jawAngle * G1(ax - 0.7, 0.18) * G1(y + 0.55, 0.15) * Math.sign(x);
    // chin and, for goblins, a pushed-out muzzle
    dz += P.chin * G1(x, 0.22) * G1(y + 0.84, 0.12);
    dz += P.muzzle * G1(x, 0.34 * mw) * G1(y + 0.42, 0.24) * f;
    return [X + dx, Y, Z + dz];
  };
}
function headColor(P, o) {
  const lip = o.lipCol || [0.78, 0.5, 0.48], paint = o.paint;
  return (x, y, z) => {
    const f = sm(0.15, 0.75, z), ax = Math.abs(x), mw = P.mouthW || 1;
    let c = [1, 1, 1];
    const mix = (t, to) => { c = c.map((v, i) => lerp(v, to[i], t)); };
    if (P.socket > 0.015) { // skull: dark eye holes and nose hole
      mix(sm(0.15, 0.5, G1(ax - 0.34, 0.15) * G1(y - 0.03, 0.14)) * f, [0.03, 0.025, 0.02]);
      mix(sm(0.3, 0.7, G1(x, 0.08) * G1(y + 0.25, 0.1)) * f, [0.04, 0.03, 0.03]);
      mix(0.35 * (1 - f), [0.75, 0.7, 0.6]);
      return c;
    }
    mix(0.18 * G1(ax - 0.36, 0.15) * G1(y - 0.04, 0.12) * f, [0.62, 0.5, 0.5]);
    mix(0.3 * G1(ax - 0.5, 0.14) * G1(y + 0.2, 0.14) * f, [1.0, 0.78, 0.74]);
    mix(sm(0.2, 0.75, G1(x, 0.15 * mw) * G1(y + 0.535, 0.06)) * f, lip);
    mix(0.6 * G1(x, 0.15 * mw) * G1(y + 0.535, 0.015) * f, [0.45, 0.28, 0.26]);
    mix(0.25 * G1(ax - 0.34, 0.12) * G1(y - 0.15, 0.03) * f, [0.6, 0.45, 0.42]);
    if (o.stubble) mix(0.4 * sm(-0.1, -0.45, y) * sm(-0.3, 0.2, z) * (1 - G1(x, 0.2) * G1(y + 0.53, 0.07)), o.stubble);
    if (paint) mix(paint(x, y, z), o.paintCol);
    return c;
  };
}
function buildHead(K, head, o) {
  const P = { ...HEAD[o.face || 'man'], ...(o.faceTweak || {}) };
  const S = headShape(P);
  K.shape = S; K.HP = P;
  const at = (ux, uy) => { const z = Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy)); return new V3(...S(ux, uy, z)); };
  K.at = at;
  const face = K.mat('face', o.skin, o.skeleton ? 'bone' : o.goblin ? 'gob' : 'skin', { vertexColors: true });
  if (o.shadowFace) {
    head.add(mk(warpSphere(S, 32, 24), K.mat('void', '#0a0806', null, { roughness: 1 })));
    for (const sd of [-1, 1]) head.add(mk(new THREE.SphereGeometry(0.011, 8, 6), K.mat('eyeglow', o.eyes, null, { emissive: o.eyes, emissiveIntensity: 3 }), sd * 0.03, 0.006, 0.083));
    return;
  }
  head.add(mk(faceSphere(S, 72, 60, headColor(P, o)), face));
  const skin = K.mat('skin');
  if (o.skeleton) {
    // jaw and teeth
    const jaw = K.mat('bone');
    head.add(mk(tube([[-0.048, -0.02, -0.012], [-0.044, -0.066, 0.01], [-0.028, -0.084, 0.042], [0, -0.09, 0.056], [0.028, -0.084, 0.042], [0.044, -0.066, 0.01], [0.048, -0.02, -0.012]], (t) => 0.009 - 0.003 * Math.abs(t - 0.5), { n: 24, radial: 7, flat: [1.3, 0.6] }), jaw));
    const tm = K.mat('teeth', '#e4dcc6', null, { roughness: 0.4 });
    for (let k = -4; k <= 4; k++) { const a = k * 0.2; const t1 = mk(new THREE.BoxGeometry(0.007, 0.012, 0.006), tm, Math.sin(a) * 0.032, -0.058, 0.035 + Math.cos(a) * 0.03); t1.rotation.y = a; head.add(t1); const t2 = mk(new THREE.BoxGeometry(0.007, 0.011, 0.006), tm, Math.sin(a) * 0.03, -0.072, 0.033 + Math.cos(a) * 0.03); t2.rotation.y = a; head.add(t2); }
    for (const sd of [-1, 1]) { head.add(mk(new THREE.SphereGeometry(0.0075, 8, 6), K.mat('eyeglow', o.eyes, null, { emissive: o.eyes, emissiveIntensity: 3.2 }), sd * 0.026, 0.004, 0.07)); head.add(mk(new THREE.SphereGeometry(0.017, 10, 8), K.mat('void', '#0a0806', null, { roughness: 1 }), sd * 0.026, 0.005, 0.058)); }
    return;
  }
  // eyes
  const er = 0.0122 * (P.eyeR || 1);
  const white = K.mat('eyewhite', o.goblin ? '#e0d890' : '#efe8de', null, { roughness: 0.08 });
  const iris = o.goblin ? K.mat('iris', o.eyes, null, { emissive: o.eyes, emissiveIntensity: 0.9, roughness: 0.2 }) : K.mat('iris', o.eye || '#4a3424', null, { roughness: 0.25 });
  const pupil = K.mat('pupil', '#080606', null, { roughness: 0.1 });
  for (const sd of [-1, 1]) {
    const s0 = at(sd * 0.33, 0.04), c = new V3(s0.x, s0.y, s0.z - er * 0.42);
    const eg = grp(head, c.x, c.y, c.z); eg.rotation.y = sd * 0.08;
    eg.add(mk(new THREE.SphereGeometry(er, 16, 12), white));
    const ir = mk(new THREE.SphereGeometry(er * 1.008, 16, 6, 0, TAU, 0, o.goblin ? 0.75 : 0.66), iris); ir.rotation.x = Math.PI / 2; eg.add(ir);
    const pu = mk(new THREE.SphereGeometry(er * 1.014, 12, 4, 0, TAU, 0, o.goblin ? 0.16 : 0.25), pupil); pu.rotation.x = Math.PI / 2; if (o.goblin) pu.scale.set(0.45, 1, 1); eg.add(pu);
    const up = mk(new THREE.SphereGeometry(er * 1.1, 18, 8, 0, TAU, 0, o.sleepy ? 1.12 : 1.0), skin); up.rotation.x = o.goblin ? 0.5 : 0.36; eg.add(up);
    const lo = mk(new THREE.SphereGeometry(er * 1.07, 18, 6, 0, TAU, Math.PI - 1.1, 1.1), skin); lo.rotation.x = -0.3; eg.add(lo);
    // lash line
    const lash = mk(new THREE.TorusGeometry(er * 1.08, er * 0.07, 4, 16, Math.PI * 0.9), K.mat('lash', '#1a120c', null, { roughness: 0.6 })); lash.rotation.set(-0.95 + (o.goblin ? -0.2 : 0), 0, Math.PI * 0.05); lash.position.set(0, er * 0.12, er * 0.25); eg.add(lash);
    // brows
    if (!o.noBrow) {
      const bm = K.mat('brow', o.brow || o.hair || '#222', 'hair');
      const p = [[0.1, 0.2], [0.28, 0.235 + (o.goblin ? -0.05 : 0)], [0.48, 0.2]].map(([ux, uy]) => { const v = at(sd * ux, uy + (o.goblin && ux < 0.2 ? -0.06 : 0)); v.z += 0.0008; return v; });
      head.add(mk(tube(p, (t) => (o.bushy ? 0.006 : 0.0048) * (1.2 - 0.6 * t), { n: 12, radial: 6, flat: [1, 0.35] }), bm));
    }
  }
  // mouth
  const mw = P.mouthW || 1, ml = at(0, -0.535);
  const mouth = [[-0.018 * mw, ml.y + 0.001, ml.z - 0.005], [-0.008 * mw, ml.y, ml.z - 0.0004], [0.008 * mw, ml.y, ml.z - 0.0004], [0.018 * mw, ml.y + 0.001 + (o.smirk ? 0.002 : 0), ml.z - 0.005]];
  head.add(mk(tube(mouth, 0.0007, { n: 8, radial: 5 }), K.mat('mouth', '#4a2420', null, { roughness: 0.5 })));
  if (o.goblin) {
    const tm = K.mat('teeth', '#e8dfb8', null, { roughness: 0.4 });
    for (const sd of [-1, 1]) { const t = mk(new THREE.ConeGeometry(0.0045, 0.016, 6), tm, sd * 0.012 * mw, ml.y + 0.004, ml.z - 0.001); t.rotation.x = -0.2; head.add(t); }
    for (const sd of [-1, 1]) { const t = mk(new THREE.ConeGeometry(0.003, 0.008, 5), tm, sd * 0.005, ml.y - 0.002, ml.z + 0.0005); t.rotation.x = Math.PI + 0.2; head.add(t); }
  }
  // ears
  const ear = o.goblin ? 'goblin' : o.elf ? 'elf' : 'human';
  for (const sd of [-1, 1]) {
    const e = new V3(...K.shape(sd * 0.985, -0.05, -0.16));
    let g;
    if (ear === 'human') g = warpSphere((x, y, z) => [x * 0.008 + (z > 0 ? 0 : 0.002) * sd, y * 0.03 * (y > 0 ? 1 : 0.85), z * 0.019 - 0.004 * y], 12, 10);
    else {
      const L = ear === 'goblin' ? 0.17 : 0.05, Wd = ear === 'goblin' ? 0.05 : 0.024;
      g = warpSphere((x, y, z) => { const u = (y + 1) / 2, prof = Math.pow(1 - u, 0.9) * (0.55 + 0.45 * Math.sin(Math.min(1, u * 2.5) * Math.PI / 2)); return [x * 0.007 + 0.006 * (1 - z * z) * u, y * L / 2 + L / 2 - 0.006, z * Wd * prof - 0.01 * u]; }, 12, 12);
    }
    const em = mk(g, skin, e.x - sd * 0.003, e.y, e.z);
    if (ear === 'human') em.rotation.y = sd * 0.25;
    else if (ear === 'elf') { em.rotation.set(0.55, sd * 0.2, -sd * 0.3); em.position.y += 0.004; }
    else { em.rotation.set(0.25, sd * 0.35, -sd * 1.05); }
    head.add(em);
  }
}

// hair, beards and hoods are shells around the head shape: inside the covered area the
// surface is pushed outward, elsewhere it is pulled just under the skin
function shell(K, cover, off, m, sg = [64, 52]) {
  const S = K.shape;
  return mk(faceSphere((x, y, z) => {
    const p = S(x, y, z), t = cover(x, y, z), g = lerp(-0.006, typeof off === 'function' ? off(x, y, z) : off, t), L = Math.hypot(p[0], p[1], p[2]);
    return [p[0] * (L + g) / L, p[1] * (L + g) / L, p[2] * (L + g) / L];
  }, sg[0], sg[1]), m);
}
// hairline: y above which the scalp is covered, blended from the nape to the forehead
const hairline = (front, back = -0.55, side = 0.0) => (x, y, z) => {
  const fz = sm(-0.35, 0.75, z), line = lerp(back, front, fz) + side * G1(z - 0.1, 0.3) - 0.1 * Math.abs(x) * fz;
  return sm(line - 0.08, line + 0.08, y);
};
function hairStyle(K, head, o) {
  const hm = K.mat('hair', o.hair, 'hair');
  const at = K.at, S = K.shape;
  const lock = (pts, r0, r1, fl = [1, 0.55]) => head.add(mk(tube(pts.map((p) => (Array.isArray(p) ? new V3(...p) : p)), (t) => lerp(r0, r1, Math.pow(t, 0.8)), { n: 14, radial: 7, flat: fl }), hm));
  const st = o.style;
  if (st === 'short' || st === 'kid' || st === 'tail' || st === 'long' || st === 'bun' || st === 'crop') {
    const front = st === 'tail' || st === 'bun' ? 0.36 : st === 'long' ? 0.36 : 0.38;
    const vol = st === 'kid' ? 0.016 : st === 'crop' ? 0.006 : st === 'short' ? 0.012 : 0.008;
    head.add(shell(K, hairline(front, st === 'long' ? -0.75 : -0.5, st === 'crop' ? -0.05 : 0.08), (x, y) => vol * (0.6 + 0.6 * sm(-0.2, 0.9, y)), hm));
  }
  if (st === 'short') {
    // swept-back locks over the top
    for (const [ux, bend] of [[-0.3, -0.02], [-0.1, 0], [0.12, 0.01], [0.32, 0.02]]) {
      const a = at(ux, 0.46), b = at(ux * 1.1, 0.9), c = at(ux * 1.2 + bend, 0.7);
      lock([[a.x, a.y + 0.01, a.z + 0.006], [b.x, b.y + 0.016, b.z * 0.9], [c.x + bend, c.y + 0.008, -0.05]], 0.016, 0.006);
    }
  }
  if (st === 'kid') for (let k = 0; k < 7; k++) { const ux = -0.5 + k / 6, a = at(ux * 0.8, 0.5); lock([[a.x, a.y + 0.012, a.z + 0.004], [a.x + ux * 0.01, a.y - 0.014, a.z + 0.012], [a.x + ux * 0.02, a.y - 0.03, a.z + 0.004]], 0.012, 0.003); }
  if (st === 'tail') {
    const b0 = at(0, 0.2); const z0 = -K.HP.d * 1.08;
    lock([[0, 0.05, z0 + 0.01], [0, 0.02, z0 - 0.025], [0, -0.07, z0 - 0.04], [0.006, -0.17, z0 - 0.03], [0.01, -0.26, z0 - 0.01]], 0.028, 0.008, [1, 0.8]);
    add(head, mk(new THREE.TorusGeometry(0.016, 0.005, 6, 12), K.mat('tie', '#3a2a1c', 'leather'), 0, 0.03, z0 - 0.022)).rotation.x = 1.2;
        void b0;
  }
  if (st === 'long') {
    for (let k = 0; k < 9; k++) { const a = -1 + k / 4, ux = Math.sin(a * 1.1) * 0.95, uz = -Math.cos(a * 1.1); const p = new V3(...S(ux, 0.1, uz)).multiplyScalar(1.08);
      lock([[p.x, p.y + 0.03, p.z], [p.x * 1.15, p.y - 0.06, p.z * 1.12], [p.x * 1.2, p.y - 0.16, p.z * 1.15 - 0.01], [p.x * 1.15, p.y - 0.24, p.z * 1.1 - 0.02]], 0.022, 0.007); }
  }
  if (st === 'bun') {
    const z0 = -K.HP.d * 0.95;
    head.add(mk(warpSphere((x, y, z) => [x * 0.042, y * 0.036, z * 0.036], 16, 12), hm, 0, 0.06, z0 - 0.02));
    head.add(mk(new THREE.TorusGeometry(0.036, 0.009, 6, 16), hm, 0, 0.06, z0 - 0.012));
    for (const sd of [-1, 1]) { const pts = []; for (let k = 0; k <= 8; k++) { const t = k / 8, a = lerp(0.95, 0.15, t); pts.push(new V3(...S(sd * Math.sin(a), lerp(0.25, 0.42, t), -Math.cos(a) * 0.6 + 0.2 * t)).multiplyScalar(1.07)); }
      for (let k = 0; k < 8; k++) head.add(mk(new THREE.SphereGeometry(0.0085, 8, 6), hm, pts[k].x, pts[k].y, pts[k].z)); }
  }
  if (st === 'bald') head.add(shell(K, (x, y, z) => sm(-0.38, -0.25, y) * (1 - sm(0.2, 0.35, y)) * (1 - sm(0.15, 0.4, z)), 0.009, hm));
  if (st === 'scarf') { // headscarf over hair
    const sc = K.mat('scarf', o.scarf, 'cloth');
    head.add(shell(K, hairline(0.48, -0.6, 0.1), (x, y) => 0.012 + 0.008 * sm(0, 1, y), sc));
    head.add(mk(warpSphere((x, y, z) => [x * 0.03, y * 0.02, z * 0.024], 12, 8), sc, 0, -0.04, -K.HP.d * 1.05));
    for (const sd of [-1, 1]) { const t = mk(new THREE.ConeGeometry(0.018, 0.08, 6), sc, sd * 0.012, -0.08, -K.HP.d * 1.03); t.rotation.z = sd * 0.25; head.add(t); }
  }
  // beards
  if (o.beard) {
    const long = o.beard === 'long', full = o.beard !== 'stubble';
    if (full) head.add(shell(K, (x, y, z) => sm(-0.08, -0.32, y) * sm(-0.45, 0.0, z) * (1 - sm(0.55, 0.85, G1(x, 0.19) * G1(y + 0.54, 0.07))) * (1 - sm(0.5, 0.9, G1(Math.abs(x) - 0.3, 0.1) * G1(y + 0.25, 0.08) * sm(0.5, 0.8, z))),
      (x, y) => 0.006 + (long ? 0.012 : 0.007) * sm(-0.4, -1, y), hm));
    if (full) { const m = at(0, -0.4); for (const sd of [-1, 1]) lock([[0, m.y, m.z + 0.004], [sd * 0.018, m.y - 0.004, m.z - 0.002], [sd * 0.03, m.y - 0.02 - (long ? 0.02 : 0), m.z - 0.012]], long ? 0.008 : 0.006, 0.0025, [1, 0.6]); }
    if (long) { const c = at(0, -0.92); for (const [dx, l, r] of [[0, 0.24, 0.032], [-0.022, 0.18, 0.022], [0.022, 0.19, 0.022]]) lock([[dx, c.y + 0.01, c.z - 0.012], [dx * 1.3, c.y - l * 0.4, c.z + 0.008], [dx * 1.1, c.y - l * 0.8, c.z + 0.004], [dx * 0.6, c.y - l, c.z - 0.004]], r, 0.004, [1, 0.6]); }
  }
  // hats and helms
  if (o.hat) {
    const hm2 = K.mat('hat', o.hat, 'cloth');
    const brimY = K.HP.h * 0.62;
    head.add(mk(lathe([[0.2, brimY - 0.028], [0.17, brimY - 0.008], [0.12, brimY], [0.08, brimY + 0.006], [0.0005, brimY + 0.006]], { seg: 32, fn: (ph, y, r) => r * (1 + 0.04 * Math.sin(ph * 3)) }), hm2, 0, 0, -0.008));
    head.add(mk(lathe([[0.2, brimY - 0.034], [0.2, brimY - 0.026], [0.0005, brimY - 0.0]], { seg: 32 }), hm2, 0, 0, -0.008));
    const cone = [[0, brimY - 0.01, -0.006], [0, brimY + 0.12, -0.014], [0.006, brimY + 0.22, -0.04], [0.02, brimY + 0.28, -0.1], [0.03, brimY + 0.27, -0.15]];
    head.add(mk(tube(cone, (t) => 0.1 * Math.pow(1 - t, 1.1) + 0.004, { n: 22, radial: 18 }), hm2));
    add(head, mk(new THREE.TorusGeometry(0.098, 0.012, 6, 28), K.mat('hatband', o.trim, 'gold'), 0, brimY + 0.01, -0.006)).rotation.x = Math.PI / 2;
  }
  if (o.circlet) {
    const c = mk(new THREE.TorusGeometry(0.071, 0.0026, 6, 40), K.mat('gold', '#d4ad48', 'gold'), 0, 0.05, -0.004); c.rotation.x = Math.PI / 2 - 0.12; c.scale.set(1, 1.3, 1); head.add(c);
    head.add(mk(new THREE.OctahedronGeometry(0.008), K.mat('gem', '#ffd88a', null, { emissive: '#ffb84a', emissiveIntensity: 0.9, roughness: 0.15 }), 0, 0.062, K.HP.d + 0.006));
  }
  if (o.hood) {
    const hd = K.mat('hood', o.hood, 'cloth', { side: THREE.DoubleSide });
    const deep = o.shadowFace ? 0.04 : 0.02;
    head.add(shell(K, (x, y, z) => 1 - sm(0.3, 0.6, G1(x, 0.62) * G1(y + 0.2, 0.62) * sm(0.15, 0.6, z)), (x, y, z) => deep + 0.012 * sm(0, -1, z) + 0.01 * sm(0.2, 1, y), hd, [48, 36]));
    // drape over the neck
    head.add(mk(lathe([[0.16, -0.25], [0.13, -0.18], [0.1, -0.11], [0.085, -0.07], [0.0005, -0.06]], { seg: 24, sz: 1.05, fn: (ph, y, r) => r * (Math.abs(ph) < 1.3 ? 0.32 : 1) + 0.004 * Math.sin(ph * 7) }), hd, 0, 0, -0.02));
  }
  if (o.helm === 'skull') {
    const bm = K.mat('helmbone', '#d8ccb0', 'bone');
    head.add(shell(K, (x, y, z) => sm(0.15, 0.32, y) * (1 - sm(0.6, 0.95, z) * sm(0.4, 0.2, y)), 0.018, bm, [40, 30]));
    const sn = mk(warpSphere((x, y, z) => [x * 0.05 * (1 - 0.35 * Math.max(0, z)), y * 0.032 * (1 - 0.3 * Math.max(0, z)), z * 0.1], 18, 12), bm, 0, 0.095, 0.07); sn.rotation.x = 0.35; head.add(sn);
    const tmh = K.mat('teeth', '#e8dfb8', null, { roughness: 0.4 });
    for (let k = -2; k <= 2; k++) { const t = mk(new THREE.ConeGeometry(0.006, 0.026, 5), tmh, k * 0.012, 0.045, 0.13 - Math.abs(k) * 0.012); t.rotation.x = Math.PI; head.add(t); }
    for (const sd of [-1, 1]) {
      head.add(mk(tube([[sd * 0.06, 0.09, 0.0], [sd * 0.12, 0.11, 0.0], [sd * 0.16, 0.16, -0.03], [sd * 0.15, 0.21, -0.06]], (t) => 0.02 * (1 - t) + 0.002, { n: 16, radial: 10 }), K.mat('horn', '#cbbb98', 'bone')));
      head.add(mk(new THREE.SphereGeometry(0.013, 8, 6), K.mat('void', '#0a0806'), sd * 0.03, 0.115, 0.075));
    }
  }
}

// ---------------------------------------------------------------------------
// bodies
const PROF = {
  m: [[-0.02, 0.13], [0.0, 0.132], [0.07, 0.13], [0.14, 0.126], [0.22, 0.136], [0.3, 0.152], [0.37, 0.158], [0.43, 0.152], [0.47, 0.14], [0.505, 0.12], [0.535, 0.092], [0.558, 0.062], [0.575, 0.0]],
  f: [[-0.02, 0.128], [0.0, 0.128], [0.08, 0.117], [0.15, 0.108], [0.24, 0.12], [0.31, 0.133], [0.37, 0.135], [0.43, 0.128], [0.47, 0.114], [0.505, 0.096], [0.535, 0.072], [0.555, 0.05], [0.57, 0.0]],
};
function profR(P, y) {
  if (y <= P[0][0]) return P[0][1];
  for (let i = 0; i < P.length - 1; i++) if (y <= P[i + 1][0]) { const t = (y - P[i][0]) / (P[i + 1][0] - P[i][0]); return lerp(P[i][1], P[i + 1][1], (1 - Math.cos(t * Math.PI)) / 2); }
  return 0;
}

const LOOKS = {
  kael:  { skin: '#d6a47e', eye: '#4d6c8c', hair: '#3e2716', style: 'short', beard: 'short', stubble: [0.62, 0.5, 0.44], cloth: '#6e2420', pants: '#3b3127', boots: '#2b211a', scale: 1.0, bulk: 1.1, outfit: 'knight' },
  vera:  { fem: true, face: 'woman', elf: true, skin: '#efc6a0', eye: '#3f8a3c', hair: '#a23c18', style: 'tail', cloth: '#3f5a33', pants: '#4a3a28', boots: '#3a2a1c', scale: 0.96, bulk: 0.92, outfit: 'ranger', faceTweak: { cheek: 0.006 } },
  orin:  { face: 'old', skin: '#dcb593', eye: '#6a7f9a', hair: '#e0dcd4', brow: '#d8d4cc', bushy: true, style: 'long', beard: 'long', robe: '#28397a', cloth: '#22346a', trim: '#d4b25a', boots: '#2a2018', hat: '#22306a', scale: 0.98, bulk: 0.93, outfit: 'wizard', sleepy: true },
  sera:  { fem: true, face: 'woman', skin: '#8a5a3c', eye: '#2e1c10', hair: '#16100c', style: 'bun', circlet: true, lipCol: [0.72, 0.5, 0.48], cloth: '#d8d2c2', pants: '#4a4440', boots: '#3a2c20', scale: 0.96, bulk: 1.0, outfit: 'cleric', faceTweak: { lips: 0.005 } },
  elder: { face: 'old', skin: '#d8ae8e', eye: '#5a5a5a', hair: '#cfcac0', brow: '#d4d0c8', bushy: true, style: 'bald', beard: 'full', robe: '#5d4b36', cloth: '#4e3e2c', trim: '#8a6a3a', boots: '#2b211a', scale: 0.92, bulk: 0.95, outfit: 'elder', old: true, sleepy: true },
  merchant: { fem: true, face: 'woman', skin: '#e6bd96', eye: '#5a3a1e', hair: '#6b3a1e', style: 'scarf', scarf: '#a8602a', cloth: '#8a5a2a', robe: '#6e4a26', apron: '#e2d8c0', boots: '#2b211a', scale: 0.93, bulk: 1.25, outfit: 'merchant', smirk: true },
  hunter: { skin: '#d4a882', eye: '#4a3a24', hair: '#3a2a1a', style: 'crop', beard: 'full', cloth: '#5a5a2e', pants: '#3e3428', boots: '#2b211a', hood: '#4a4a26', scale: 1.0, bulk: 1.0, outfit: 'hunter' },
  villager: { skin: '#e8c09c', eye: '#4a5a6a', hair: '#8a5a2a', style: 'short', stubble: [0.75, 0.6, 0.5], cloth: '#6a5a8a', pants: '#3e3428', boots: '#2b211a', apron: '#cfc6b0', scale: 0.95, bulk: 1.0, outfit: 'villager' },
  kid: { face: 'kid', skin: '#f0c8a4', eye: '#4a6a9a', hair: '#d8a040', style: 'kid', cloth: '#a84a3a', pants: '#3e5a7a', boots: '#4a3424', scale: 0.62, bulk: 1.05, head: 1.25, outfit: 'kid' },
  goblin: { goblin: true, face: 'goblin', skin: '#6c8a38', hair: '#2a2a1a', brow: '#2a2a1a', cloth: '#5a4228', pants: '#4a3a24', scale: 0.68, bulk: 1.0, head: 1.32, eyes: '#ffc22a', hunch: 0.32, arms: 1.12, outfit: 'goblin' },
  archer: { goblin: true, face: 'goblin', skin: '#7a9640', hair: '#2a2a1a', brow: '#2a2a1a', cloth: '#4e4a2a', pants: '#4a3a24', hood: '#3e3a22', scale: 0.66, bulk: 0.95, head: 1.32, eyes: '#ffc22a', hunch: 0.25, arms: 1.1, outfit: 'gobarcher' },
  grukk: { goblin: true, face: 'goblin', skin: '#58772c', hair: '#2a2a1a', brow: '#1e1e12', cloth: '#4a3020', pants: '#3a2a1a', scale: 0.94, bulk: 1.32, head: 1.18, eyes: '#ff8a2a', hunch: 0.22, arms: 1.08, helm: 'skull', outfit: 'chief',
    paintCol: [0.55, 0.12, 0.08], paint: (x, y, z) => 0.85 * sm(0.4, 0.6, G1(Math.abs(x) - 0.42, 0.07)) * sm(-0.55, -0.3, y) * (1 - sm(0.2, 0.35, y)) * sm(0.3, 0.6, z) },
  skeleton: { skeleton: true, face: 'skull', skin: '#d8d0b8', eyes: '#5fe8ff', scale: 0.98, bulk: 0.9, outfit: 'skeleton', noBrow: true },
  priest: { skin: '#5a5048', hair: '#222', cloth: '#3e3b38', robe: '#4f4a45', trim: '#8a2e14', hood: '#3a3633', eyes: '#ff8a2a', shadowFace: true, boots: '#1e1c1a', scale: 1.06, bulk: 1.0, outfit: 'priest', noBrow: true },
};

function kit(o, rig) {
  const cache = {}, K = { o, rig, b: o.bulk || 1, fem: !!o.fem };
  K.mat = (name, color, kind, extra) => {
    if (cache[name]) return cache[name];
    if (color == null) { // shorthand for common slots
      const D = { skin: [o.skin, o.goblin ? 'gob' : o.skeleton ? 'bone' : 'skin'], bone: [o.skin, 'bone'], cloth: [o.cloth, 'cloth'], pants: [o.pants || o.cloth, 'cloth'], boots: [o.boots || '#2a2018', 'leather'],
        robe: [o.robe || o.cloth, 'cloth'], leather: ['#5a3e26', 'leather'], darkleather: ['#3a2818', 'leather'], steel: ['#a8aeb6', 'metal'], darksteel: ['#5e636a', 'dark'], gold: ['#c9a540', 'gold'], chain: ['#8d9098', 'chain'], trim: [o.trim || '#c9a540', 'gold'], wood: ['#5a3a22', 'wood'], fur: ['#6a5640', 'fur'], rope: ['#a08a5a', 'rough'] }[name];
      return (cache[name] = mat(D[0], D[1]));
    }
    return (cache[name] = mat(color, kind, extra));
  };
  K.P = PROF[K.fem ? 'f' : 'm'];
  K.SX = (K.fem ? 1.2 : 1.3) * K.b; K.SZ = 0.78 * K.b;
  K.bust = K.fem ? (ph, y, r) => r + 0.016 * G1(y - 0.335, 0.045) * (G1(ph - 0.42, 0.28) + G1(ph + 0.42, 0.28))
    : o.goblin ? (ph, y, r) => r + 0.03 * G1(y - 0.1, 0.08) * G1(ph, 0.9) : null;
  // torso layer between y0 and y1, grown outward by g
  K.torsoGeo = (y0, y1, g, fn) => {
    const full = y0 <= -0.03 && y1 >= 0.56, a = full ? -0.025 : Math.max(-0.025, y0 - 0.004), z = full ? 0.572 : Math.min(0.572, y1 + 0.004);
    const pts = full ? [[0.0005, -0.035]] : [[Math.max(0.0005, profR(K.P, a) - 0.008), a - 0.004]];
    const n = Math.max(3, Math.ceil((z - a) / 0.011));
    for (let i = 0; i <= n; i++) {
      const y = lerp(a, z, i / n), inside = full ? 1 : sm(y0 - 0.007, y0 + 0.002, y) * (1 - sm(y1 - 0.002, y1 + 0.007, y));
      pts.push([Math.max(0.0005, profR(K.P, y) + lerp(-0.006, g, inside)), y]);
    }
    pts.push(full ? [0.0005, 0.578] : [Math.max(0.0005, profR(K.P, z) - 0.008), z + 0.004]);
    const bust = K.bust;
    return lathe(pts, { seg: 32, sx: K.SX, sz: K.SZ, fn: bust || fn ? (ph, y, r) => { if (bust) r = bust(ph, y, r); if (fn) r = fn(ph, y, r); return r; } : null });
  };
  K.layer = (m, y0, y1, g, fn) => rig.torso.add(mk(K.torsoGeo(y0, y1, g, fn), m));
  // z of the torso surface at height y straight ahead (for things laid on the chest)
  K.frontZ = (y) => profR(K.P, y) * K.SZ;
  K.sideX = (y) => profR(K.P, y) * K.SX;
  // a skirt hanging from the hips: from y=top down by len, radius r0 -> r1, with folds
  K.skirt = (m, top, len, r0, r1, o2 = {}) => {
    const n = o2.folds || 9, amp = o2.amp ?? 0.05, ph0 = o2.phase || 0;
    const pts = [[r1 - 0.012, top - len + 0.012], [r1, top - len]];
    for (let k = 1; k <= 12; k++) { const t = k / 12; pts.push([lerp(r1, r0, Math.pow(t, o2.pow || 1.3)), top - len + len * t]); }
    pts.push([r0 - 0.02, top + 0.012]);
    const g = lathe(pts, { seg: 40, sx: o2.sx ?? 1.15 * K.b, sz: o2.sz ?? 0.92 * K.b,
      fn: (ph, y, r) => { const t = sm(top, top - len, y); let rr = r * (1 + amp * t * Math.sin(ph * n + ph0 + Math.sin(ph * 3) * 0.6)); if (o2.split) rr *= 1 - 0.25 * t * G1(ph, 0.12); if (o2.fn) rr = o2.fn(ph, y, rr, t); return rr; } });
    const s = mk(g, m); rig.hips.add(s); return s;
  };
  // belt ring around the waist on the torso
  K.belt = (m, y = 0.03, h = 0.045, g = 0.016, buckle) => {
    K.layer(m, y - h / 2, y + h / 2, g);
    if (buckle) { const z = K.frontZ(y) + g * K.SZ + 0.006; rig.torso.add(mk(new THREE.BoxGeometry(0.05, h + 0.012, 0.012), buckle, 0, y, z)); rig.torso.add(mk(new THREE.BoxGeometry(0.03, h - 0.008, 0.014), m, 0, y, z + 0.001)); }
  };
  K.pouch = (m, x, y, zs = 1) => { const z = K.frontZ(y) * 0.9 * zs; const p = mk(blob(0.035, 0.04, 0.025), m, x, y - 0.03, z); p.rotation.y = Math.atan2(x, z); rig.torso.add(p); rig.torso.add(mk(blob(0.037, 0.012, 0.027), m, x, y - 0.002, z)); };
  // pauldron: stacked lames over the shoulder joint
  K.pauldron = (sd, m, trim, n = 3, size = 1) => {
    const sh = sd < 0 ? rig.armL : rig.armR;
    for (let k = 0; k < n; k++) {
      const r = (0.088 - k * 0.006) * size * K.b;
      const cap = mk(new THREE.SphereGeometry(r, 20, 8, 0, TAU, 0, k === 0 ? 1.05 : 0.7), m, sd * 0.012 * k, 0.02 - k * 0.04 * size, 0);
      cap.scale.set(1.05, 0.85, 1.1); cap.rotation.z = -sd * (0.35 + k * 0.12); sh.add(cap);
      if (trim) { const tr = mk(new THREE.TorusGeometry(r * Math.sin(k === 0 ? 1.05 : 0.7) * 1.0, 0.004, 4, 28), trim, cap.position.x, cap.position.y + r * 0.85 * Math.cos(k === 0 ? 1.05 : 0.7), 0);
        tr.scale.set(1.05, 1.1, 1); tr.rotation.set(Math.PI / 2, 0, 0); tr.rotation.z = 0; const tg = new THREE.Group(); tg.rotation.z = cap.rotation.z; tg.position.copy(cap.position); tr.position.set(0, r * 0.85 * Math.cos(k === 0 ? 1.05 : 0.7), 0); tg.add(tr); sh.add(tg); }
    }
  };
  // cloth cape hanging from the shoulders
  K.cape = (m, len, spread = 2.3, o2 = {}) => {
    const g = new THREE.PlaneGeometry(1, 1, 14, 16), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), v = 0.5 - p.getY(i), ang = u * lerp(spread * 0.7, spread, v), R = lerp(0.17, 0.27, v) * K.b + 0.012 * Math.sin(u * 22 + 1) * v;
      p.setXYZ(i, Math.sin(ang) * R * 1.25, -v * len, -Math.cos(ang) * R * 0.75 - 0.01 - 0.02 * v);
    }
    g.computeVertexNormals();
    const c = mk(g, m, 0, 0.5, -0.02); c.userData.keep = true; rig.torso.add(c); rig.cape = c;
    if (o2.clasp) for (const sd of [-1, 1]) rig.torso.add(mk(new THREE.SphereGeometry(0.018, 10, 8), o2.clasp, sd * 0.13 * K.b, 0.5, K.frontZ(0.5) + 0.03));
    if (o2.collar) rig.torso.add(mk(lathe([[0.17, 0.44], [0.16, 0.48], [0.12, 0.53], [0.09, 0.56], [0.0005, 0.565]], { seg: 28, sx: 1.2 * K.b, sz: 0.85 * K.b, fn: (ph, y, r) => r + 0.006 * Math.sin(ph * 9) }), m));
    return c;
  };
  return K;
}

// shields: heater shape extruded, curved, and painted
function heater(K, field, emblem) {
  const s = new THREE.Shape(), w = 0.25, h = 0.36;
  s.moveTo(-w, h * 0.5); s.lineTo(w, h * 0.5); s.lineTo(w, 0); s.quadraticCurveTo(w * 0.95, -h * 0.45, 0, -h * 0.75); s.quadraticCurveTo(-w * 0.95, -h * 0.45, -w, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2, curveSegments: 16 });
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, p.getZ(i) - 0.5 * x * x); uv.setXY(i, (x + w + 0.012) / (2 * w + 0.024), (y + h * 0.75 + 0.012) / (h * 1.25 + 0.024)); }
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ map: emblemTex(emblem, 2 * w, h * 1.25), roughness: 0.6, bumpMap: texOf('rough', [2, 2], false), bumpScale: 0.4 });
  const grpS = new THREE.Group();
  grpS.add(mk(g, m));
  const rim = []; for (const v of s.getSpacedPoints(60)) rim.push(new V3(v.x * 1.03, v.y * 1.03 + (v.y > h * 0.45 ? 0.004 : 0), 0.03 - 0.5 * v.x * v.x * 1.06));
  grpS.add(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 80, 0.008, 6, true), K.mat(field === 'gold' ? 'gold' : 'steel')));
  return grpS;
}

// ---------------------------------------------------------------------------
export function buildModel(kind) {
  if (kind === 'wolf') return wolf();
  const o = LOOKS[kind];
  const s = o.scale;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(s);
  const rig = { root, body, kind, hunch: o.hunch || 0 };
  const K = kit(o, rig), b = K.b, fem = K.fem;
  const OUT = OUTFIT[o.outfit] || {};
  const cfg = { shirt: 'cloth', upper: 'cloth', fore: 'cloth', hand: 'skin', legs: 'pants', foot: 'boots', neck: 'skin', ...(OUT.cfg || {}) };
  const M = (n) => (typeof n === 'string' ? K.mat(n) : n);

  const hips = grp(body, 0, 0.98, 0); rig.hips = hips;
  const torso = grp(hips); rig.torso = torso;
  if (o.skeleton) { skeletonBody(K, rig, o); finish(rig, o, s); return rig; }
  // pelvis and torso
  hips.add(mk(lathe([[0.0005, -0.19], [0.085, -0.175], [0.13, -0.12], [0.138, -0.05], [0.13, 0.02], [0.0005, 0.03]], { seg: 28, sx: (fem ? 1.3 : 1.2) * b, sz: 0.86 * b }), M(cfg.legs)));
  K.layer(M(cfg.shirt), -1, 9, 0);
  // neck
  torso.add(mk(limb(fem ? 0.047 : 0.059, fem ? 0.055 : 0.068, 0.11, { capT: 0.3, capB: 0.3 }), M(cfg.neck), 0, 0.605, 0.0));
  // head
  const head = grp(torso, 0, 0.68, 0.014); rig.head = head; head.scale.setScalar(o.head || 1);
  buildHead(K, head, o);
  hairStyle(K, head, o);
  // arms
  const ak = o.arms || 1, lk = o.goblin ? 0.78 : 1;
  const ru = (t) => lk * lerp(0.054, 0.043, t) * b * (fem ? 0.88 : 1) * (1 + 0.12 * G1(t - 0.3, 0.22));
  const rf = (t) => lk * lerp(0.046, 0.032, t) * b * (fem ? 0.86 : 1) * (1 + 0.14 * G1(t - 0.22, 0.2));
  K.ru = ru; K.rf = rf; K.lu = 0.275 * ak; K.lf = 0.245 * ak;
  for (const sd of [-1, 1]) {
    const sh = grp(torso, sd * (fem ? 0.183 : 0.198) * b, 0.455, -0.005);
    sh.add(mk(blob(0.056 * b * (fem ? 0.88 : 1), 0.06, 0.058 * b), M(cfg.upper), -Math.sign(sh.position.x) * 0.012, -0.03, 0));
    sh.add(mk(limb(0, 0, K.lu, { rf: ru }), M(cfg.upper)));
    const el = grp(sh, 0, -K.lu - 0.008, 0);
    el.add(mk(limb(0, 0, K.lf, { rf }), M(cfg.fore)));
    const hand = grp(el, 0, -K.lf - 0.012, 0);
    buildHand(K, hand, sd, M(cfg.hand));
    sh.rotation.z = sd * 0.08;
    rig[sd < 0 ? 'armL' : 'armR'] = sh; rig[sd < 0 ? 'elL' : 'elR'] = el; rig[sd < 0 ? 'handL' : 'handR'] = hand;
  }
  // legs
  const rt = (t) => lk * lerp(0.088, 0.058, t) * b * (fem ? 0.96 : 1) * (1 + 0.08 * G1(t - 0.25, 0.25));
  const rs = (t) => lk * lerp(0.06, 0.038, t) * b * (fem ? 0.92 : 1) * (1 + 0.2 * G1(t - 0.25, 0.18));
  K.rt = rt; K.rs = rs;
  for (const sd of [-1, 1]) {
    const lg = grp(hips, sd * (fem ? 0.095 : 0.09) * b, -0.07, 0);
    lg.add(mk(limb(0, 0, 0.44, { rf: rt }), M(cfg.legs)));
    const kn = grp(lg, 0, -0.445, 0);
    kn.add(mk(limb(0, 0, 0.41, { rf: rs, fn: (ph, y, r) => r * (1 + 0.12 * G1(Math.abs(ph) - Math.PI, 0.9) * G1(y + 0.12, 0.08)) }), M(cfg.legs)));
    const ft = grp(kn, 0, -0.415, 0);
    if (o.goblin) { // bare feet with claws
      ft.add(mk(blob(0.045 * b, 0.036, 0.1, -0.35), M('skin'), 0, -0.03, 0.04));
      for (let k = -1; k <= 1; k++) { const c = mk(new THREE.ConeGeometry(0.008, 0.026, 5), K.mat('claw', '#2a2418', null, { roughness: 0.4 }), k * 0.022, -0.036, 0.14); c.rotation.x = Math.PI / 2 + 0.3; ft.add(c); }
    } else {
      ft.add(mk(blob(0.047 * b, 0.04, 0.115, -0.4), M(cfg.foot), 0, -0.032, 0.045));
      ft.add(mk(blob(0.05 * b, 0.012, 0.12), K.mat('sole', '#1a1410', 'leather'), 0, -0.05, 0.045));
    }
    rig[sd < 0 ? 'legL' : 'legR'] = lg; rig[sd < 0 ? 'knL' : 'knR'] = kn; rig[sd < 0 ? 'ftL' : 'ftR'] = ft;
  }
  // weapon mount in the right hand
  const W = grp(rig.handR, -0.008, -0.065, 0); rig.weapon = W;
  OUT.dress(K, rig, o);
  finish(rig, o, s);
  return rig;
}

function finish(rig, o, s) {
  bake(rig.root);
  const mats = new Set();
  rig.root.traverse((m) => { if (m.isMesh && m.material && m.material.isMeshStandardMaterial) mats.add(m.material); });
  rig.mats = [...mats];
  rig.height = 1.9 * s * (o.head ? 1 + (o.head - 1) * 0.15 : 1);
}

// hands: palm, curled fingers and a thumb; sd is the side (-1 left, +1 right), palms face inward
function buildHand(K, hand, sd, m) {
  const b = K.b * (K.o.goblin ? 1.25 : 1), inn = -sd;
  hand.add(mk(blob(0.02 * b, 0.042, 0.04 * b), m, 0, -0.04, 0));
  const fz = [0.024, 0.008, -0.008, -0.022], fl = [0.9, 1, 0.95, 0.78];
  for (let k = 0; k < 4; k++) {
    const z = fz[k] * b, L = 0.042 * fl[k] * b;
    hand.add(mk(tube([[0, -0.07, z], [inn * 0.006, -0.07 - L * 0.6, z], [inn * 0.022, -0.07 - L * 0.85, z], [inn * 0.034, -0.07 - L * 0.7, z]], (t) => 0.0085 * b * (1 - 0.25 * t), { n: 8, radial: 6 }), m));
    if (K.o.goblin) { const c = mk(new THREE.ConeGeometry(0.004, 0.014, 4), K.mat('claw', '#2a2418', null, { roughness: 0.4 }), inn * 0.038, -0.07 - L * 0.62, z); c.rotation.z = inn * 2.2; hand.add(c); }
  }
  hand.add(mk(tube([[inn * 0.008, -0.025, 0.026 * b], [inn * 0.016, -0.045, 0.04 * b], [inn * 0.026, -0.065, 0.038 * b]], 0.0095 * b, { n: 6, radial: 6 }), m));
}

// ---------------------------------------------------------------------------
// weapons
function sword(K, W, len = 0.85, o2 = {}) {
  const w = o2.w || 0.052, th = 0.012;
  const g = new THREE.BoxGeometry(w, len, th, 2, 16, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const t = (y + len / 2) / len;
    const taper = o2.curve ? lerp(1, 1.3, t) * (t > 0.82 ? Math.pow(Math.max(0, 1 - t) / 0.18, 0.7) : 1) : lerp(1, 0.7, t) * (t > 0.86 ? Math.pow(Math.max(0, 1 - t) / 0.14, 0.8) : 1);
    x *= Math.max(0.02, taper); z = Math.sign(z) * th / 2 * (1 - 0.85 * Math.abs(x) / (w / 2)) * Math.max(0.3, taper);
    if (o2.curve) x += o2.curve * t * t;
    p.setXYZ(i, x, y + len / 2 + 0.1, z);
  }
  g.computeVertexNormals();
  const steel = o2.rusty ? K.mat('rust', '#6e5a48', 'rust') : K.mat('blade', '#cfd3d8', 'metal');
  W.add(mk(g, steel));
  const guard = o2.crude ? K.mat('darkleather') : o2.rusty ? K.mat('rust', '#6e5a48', 'rust') : K.mat('gold');
  if (o2.crude) W.add(mk(new THREE.BoxGeometry(0.1, 0.03, 0.04), guard, 0, 0.09, 0));
  else W.add(mk(tube([[-0.11, 0.115, 0], [-0.05, 0.088, 0], [0.05, 0.088, 0], [0.11, 0.115, 0]], (t) => 0.011 * (1 - 0.4 * Math.abs(t - 0.5) * 2) + 0.006, { n: 10, radial: 8 }), guard));
  W.add(mk(limb(0.016, 0.018, 0.16, { capT: 0.2, capB: 0.2 }), K.mat('grip', '#3a2414', 'leather'), 0, 0.085, 0));
  for (let k = 0; k < 5; k++) add(W, mk(new THREE.TorusGeometry(0.018, 0.003, 4, 10), K.mat('grip'), 0, 0.06 - k * 0.025, 0)).rotation.x = Math.PI / 2;
  W.add(mk(new THREE.SphereGeometry(0.026, 12, 10), guard, 0, -0.085, 0));
  W.rotation.x = Math.PI / 2 + 0.3;
}
function axe(K, W) {
  W.add(mk(tube([[0, -0.12, 0], [0.004, 0.3, 0], [0, 0.78, 0]], 0.022, { n: 8, radial: 8 }), K.mat('wood')));
  for (const y of [0.05, 0.6]) W.add(mk(limb(0.026, 0.026, 0.06), K.mat('darkleather'), 0, y, 0));
  const s = new THREE.Shape(); s.moveTo(0, 0.07); s.quadraticCurveTo(0.12, 0.08, 0.2, 0.2); s.quadraticCurveTo(0.27, 0.0, 0.2, -0.2); s.quadraticCurveTo(0.12, -0.08, 0, -0.07); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 2, curveSegments: 10 }); g.translate(0, 0, -0.006);
  const hd = mk(g, K.mat('axehead', '#7a7a78', 'dark'), 0.0, 0.66, 0); hd.rotation.y = -Math.PI / 2; W.add(hd);
  const sp = mk(new THREE.ConeGeometry(0.02, 0.1, 6), K.mat('axehead'), 0, 0.66, -0.06); sp.rotation.x = -Math.PI / 2; W.add(sp);
  W.add(mk(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), K.mat('axehead'), 0, 0.66, 0));
  W.rotation.x = Math.PI / 2 + 0.3;
}
function mace(K, W) {
  W.add(mk(limb(0.018, 0.02, 0.48, { capT: 0.3, capB: 0.3 }), K.mat('wood'), 0, 0.4, 0));
  W.add(mk(limb(0.022, 0.024, 0.13), K.mat('grip', '#3a2414', 'leather'), 0, 0.02, 0));
  const st = K.mat('steel');
  W.add(mk(new THREE.SphereGeometry(0.045, 14, 10), st, 0, 0.47, 0));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU, s = new THREE.Shape(); s.moveTo(0, -0.07); s.lineTo(0.06, -0.03); s.lineTo(0.065, 0.04); s.lineTo(0, 0.08); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 }); g.translate(0, 0, -0.004);
    const f = mk(g, st, 0, 0.47, 0); f.rotation.y = a; W.add(f);
  }
  W.add(mk(new THREE.SphereGeometry(0.02, 10, 8), K.mat('gold'), 0, 0.56, 0));
  W.rotation.x = Math.PI / 2 + 0.3;
}
function staff(K, rig, W, o2) {
  const len = o2.len, cy = o2.cy, top = cy + len / 2, rng = o2.seed || 3;
  const pts = []; for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push([Math.sin(t * 9 + rng) * 0.012 * (o2.gnarl || 1), cy - len / 2 + len * t, Math.cos(t * 7 + rng) * 0.012 * (o2.gnarl || 1)]); }
  const wood = o2.iron ? K.mat('iron', '#2e2c2a', 'dark') : K.mat('staffwood', o2.wood || '#4a3220', 'wood');
  W.add(mk(tube(pts, (t) => (0.024 + 0.006 * Math.sin(t * 23)) * (t > 0.85 ? 1.25 : 1) * (o2.thin || 1), { n: 30, radial: 9 }), wood));
  if (o2.wrap) W.add(mk(limb(0.03, 0.03, 0.18), K.mat('grip', '#3a2414', 'leather'), 0, 0.09, 0));
  if (o2.orb) {
    const om = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: o2.orb, emissiveIntensity: 2.5, roughness: 0.2 });
    const orb = mk(new THREE.SphereGeometry(0.06, 16, 12), om, pts[8][0], top + 0.07, pts[8][2]); orb.userData.keep = true; W.add(orb); rig.orb = orb; rig.orbMat = om;
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; W.add(mk(tube([[pts[8][0], top - 0.03, pts[8][2]], [Math.cos(a) * 0.05, top + 0.04, Math.sin(a) * 0.05], [Math.cos(a) * 0.052, top + 0.11, Math.sin(a) * 0.052], [Math.cos(a) * 0.02, top + 0.15, Math.sin(a) * 0.02]], (t) => 0.011 * (1 - t) + 0.003, { n: 10, radial: 6 }), wood)); }
  }
  if (o2.hook) W.add(mk(tube([[0, top - 0.02, 0], [0, top + 0.06, 0.02], [0, top + 0.08, 0.08], [0, top + 0.03, 0.11]], 0.022, { n: 10, radial: 8 }), wood));
  rig.staff = true;
}
function bow(K, rig, L, o2 = {}) {
  const bw = grp(L, 0.0, -0.06, 0); rig.bow = bw;
  const half = o2.half || 0.58, pts = [];
  for (let k = 0; k <= 12; k++) { const t = k / 6 - 1, a = Math.abs(t); pts.push(new V3(0, -0.14 * (1 - t * t) + 0.02 + (o2.recurve && a > 0.82 ? 0.25 * (a - 0.82) * (a - 0.82) * 8 * 0.4 : 0), t * half)); }
  bw.add(mk(tube(pts, (t) => 0.011 + 0.01 * (1 - Math.abs(t - 0.5) * 2) ** 2, { n: 36, radial: 7, flat: [0.8, 1.2] }), K.mat('bowwood', o2.wood || '#5a3a1e', 'wood')));
  bw.add(mk(tube([[0, -0.12, -0.06], [0, -0.123, 0], [0, -0.12, 0.06]], 0.02, { n: 4, radial: 8 }), K.mat('grip', '#3a2414', 'leather')));
  const sl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pts[0], pts[12]]), new THREE.LineBasicMaterial({ color: '#d8d0c0' })); bw.add(sl);
  bw.position.y = 0.04;
}
function quiver(K, rig, x = 0.1, y = 0.36, z = -0.2, n = 6) {
  const q = grp(rig.torso, x, y, z); q.rotation.z = 0.4; q.rotation.x = 0.1;
  q.add(mk(limb(0.05, 0.045, 0.42, { capT: 0.05, capB: 0.5, sz: 0.8 }), K.mat('quiver', '#5a3a22', 'leather'), 0, 0.21, 0));
  add(q, mk(new THREE.TorusGeometry(0.052, 0.006, 5, 14), K.mat('gold'), 0, 0.2, 0)).rotation.x = Math.PI / 2;
  const sh = K.mat('shaft', '#b89a6a', 'wood'), fl = K.mat('fletch', '#d8d0c0', null, { side: THREE.DoubleSide, roughness: 0.9 });
  for (let k = 0; k < n; k++) {
    const ax = (k % 3 - 1) * 0.022, az = (Math.floor(k / 3) - 0.5) * 0.024, h = 0.27 + (k % 2) * 0.02;
    q.add(mk(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 5), sh, ax, h, az));
    for (let f = 0; f < 3; f++) { const v = mk(new THREE.PlaneGeometry(0.018, 0.07), fl, ax, h + 0.06, az); v.rotation.y = f * TAU / 3; q.add(v); }
  }
  // strap across the chest
  rig.torso.add(mk(tube([[0.17, 0.47, -0.05], [0.08, 0.4, 0.15], [-0.07, 0.2, 0.15], [-0.17, 0.06, 0.02]], 0.01, { n: 16, radial: 6, flat: [0.4, 1.6] }), K.mat('darkleather')));
}

// ---------------------------------------------------------------------------
// outfits
const OUTFIT = {
  knight: {
    cfg: { shirt: 'cloth', upper: 'chain', fore: 'chain', hand: 'darksteel', legs: 'pants' },
    dress(K, r) {
      const st = K.mat('steel'), gold = K.mat('gold'), b = K.b;
      // breastplate with a centre ridge, fauld lames and a gorget
      K.layer(st, 0.1, 0.505, 0.02, (ph, y, rr) => rr + 0.007 * G1(ph, 0.22) * sm(0.12, 0.3, y) - 0.004 * G1(Math.abs(ph) - Math.PI, 0.5));
      K.layer(gold, 0.495, 0.51, 0.022); K.layer(gold, 0.1, 0.113, 0.022);
      for (let k = 0; k < 3; k++) K.layer(st, 0.0 + k * 0.032 - 0.04, 0.03 + k * 0.032 - 0.04, 0.022 + k * 0.002);
      K.layer(K.mat('chain'), 0.505, 0.6, 0.012);
      r.torso.add(mk(lathe([[0.1, 0.5], [0.095, 0.53], [0.072, 0.56], [0.066, 0.578], [0.0005, 0.58]], { seg: 24, sx: 1.18, sz: 1.08 }), st));
      K.belt(K.mat('darkleather'), -0.04, 0.04, 0.03, gold);
      // surcoat skirt and tassets
      K.skirt(K.mat('cloth'), 0.0, 0.42, 0.15, 0.2, { folds: 8, amp: 0.06, split: true });
      for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) {
        const g = new THREE.CylinderGeometry(0.175 * b + k * 0.006, 0.19 * b + k * 0.008, 0.13, 10, 1, true, sd > 0 ? 0.25 : -1.25, 1.0);
        const t = mk(g, k ? st : K.mat('darksteel'), 0, -0.06 - k * 0.08, 0); t.scale.set(1.12, 1, 0.9); r.hips.add(t);
        add(r.hips, mk(new THREE.CylinderGeometry(0.19 * b + k * 0.008 + 0.002, 0.19 * b + k * 0.008 + 0.002, 0.008, 10, 1, true, sd > 0 ? 0.25 : -1.25, 1.0), gold, 0, -0.06 - k * 0.08 - 0.062, 0)).scale.set(1.12, 1, 0.9);
      }
      // arms: pauldrons, couters, vambraces
      for (const sd of [-1, 1]) {
        K.pauldron(sd, st, gold, 3, 1.05);
        const el = sd < 0 ? r.elL : r.elR, sh = sd < 0 ? r.armL : r.armR;
        sh.add(mk(limbPart(K.ru, K.lu, 0.35, 0.95, 0.008), st));
        el.add(mk(new THREE.SphereGeometry(0.05 * b, 14, 10), st, 0, 0.005, -0.005));
        el.add(mk(limbPart(K.rf, K.lf, 0.15, 0.92, 0.01, { flare: 0.4 }), st));
        el.add(mk(limbPart(K.rf, K.lf, 0.84, 0.9, 0.016), gold));
      }
      // legs: cuisses, knee cops, greaves
      for (const sd of [-1, 1]) {
        const lg = sd < 0 ? r.legL : r.legR, kn = sd < 0 ? r.knL : r.knR, ft = sd < 0 ? r.ftL : r.ftR;
        lg.add(mk(limbPart(K.rt, 0.44, 0.45, 0.97, 0.008, { fn: (ph, y, rr) => (Math.abs(ph) > 1.8 ? rr - 0.012 : rr) }), st));
        kn.add(mk(blob(0.055 * b, 0.05, 0.05), st, 0, 0.0, 0.018));
        kn.add(mk(new THREE.SphereGeometry(0.02, 8, 6), gold, 0, 0.0, 0.07));
        kn.add(mk(limbPart(K.rs, 0.41, 0.12, 0.92, 0.01), st));
        ft.add(mk(blob(0.052 * b, 0.042, 0.12, -0.4), K.mat('darksteel'), 0, -0.03, 0.05));
      }
      K.cape(K.mat('cape', '#7a1f1a', 'cloth', { side: THREE.DoubleSide }), 1.05, 2.4, { clasp: gold });
      sword(K, r.weapon, 0.86);
      const sh = heater(K, 'steel', 'tower'); sh.rotation.y = -Math.PI / 2; sh.position.set(-0.075, -0.12, 0.0); r.elL.add(sh); r.shield = sh;
    },
  },
  ranger: {
    cfg: { shirt: 'cloth', upper: 'cloth', fore: 'cloth', hand: 'skin', legs: 'pants' },
    dress(K, r) {
      const lth = K.mat('leather'), dk = K.mat('darkleather'), b = K.b;
      K.layer(lth, 0.04, 0.47, 0.012, (ph, y, rr) => rr - 0.004 * G1(ph, 0.08) * sm(0.3, 0.45, y));
      K.layer(dk, 0.455, 0.53, 0.016);
      K.skirt(K.mat('cloth'), 0.02, 0.3, 0.145, 0.19, { folds: 7, amp: 0.05, split: true });
      K.skirt(lth, 0.03, 0.2, 0.148, 0.18, { folds: 5, amp: 0.03, fn: (ph, y, rr) => (Math.abs(ph) < 0.9 ? rr * 0.92 : rr) });
      K.belt(dk, 0.035, 0.035, 0.026, K.mat('gold'));
      K.pouch(dk, 0.13, 0.03); K.pouch(dk, -0.09, 0.02);
      // capelet and hood lying on the shoulders
      const ck = K.mat('cloak', '#2f4a2a', 'cloth', { side: THREE.DoubleSide });
      r.torso.add(mk(lathe([[0.235, 0.3], [0.225, 0.38], [0.2, 0.45], [0.15, 0.5], [0.09, 0.56], [0.075, 0.6], [0.0005, 0.6]], { seg: 32, sx: 1.12 * b, sz: 0.88 * b, fn: (ph, y, rr) => rr * (1 + 0.04 * Math.sin(ph * 8) * sm(0.45, 0.3, y)) }), ck));
      const hood = mk(warpSphere((x, y, z) => [x * 0.1, y * 0.06, z * 0.07 - 0.02 * Math.max(0, y)], 20, 12), ck, 0, 0.56, -0.11); r.torso.add(hood);
      K.cape(ck, 0.66, 1.9);
      // bracers, one shoulder guard
      for (const sd of [-1, 1]) { const el = sd < 0 ? r.elL : r.elR; el.add(mk(limbPart(K.rf, K.lf, 0.35, 0.95, 0.009, { flare: 0.25 }), dk)); }
      K.pauldron(1, lth, null, 2, 0.95);
      for (const sd of [-1, 1]) { const kn = sd < 0 ? r.knL : r.knR; kn.add(mk(limbPart(K.rs, 0.41, 0.25, 0.92, 0.012, { flare: -0.3 }), K.mat('boots'))); kn.add(mk(limbPart(K.rs, 0.41, 0.22, 0.3, 0.02), K.mat('boots'))); }
      bow(K, r, r.handL, { recurve: true });
      quiver(K, r);
    },
  },
  wizard: {
    cfg: { shirt: 'robe', upper: 'robe', fore: 'robe', hand: 'skin', legs: 'robe' },
    dress(K, r, o) {
      const robe = K.mat('robe'), trim = K.mat('trim'), b = K.b;
      K.skirt(robe, 0.03, 0.97, 0.16, 0.3, { folds: 10, amp: 0.07, pow: 0.9 });
      K.skirt(trim, -0.88, 0.04, 0.29, 0.305, { folds: 10, amp: 0.07, pow: 1, fn: (ph, y, rr) => rr + 0.004 });
      // high collar and stole
      r.torso.add(mk(lathe([[0.15, 0.42], [0.13, 0.5], [0.1, 0.56], [0.09, 0.64], [0.0005, 0.6]], { seg: 28, sx: 1.25 * b, sz: 0.9 * b, fn: (ph, y, rr) => (Math.abs(ph) < 0.55 ? rr * 0.7 : rr) }), K.mat('collar', '#1e2a5a', 'cloth', { side: THREE.DoubleSide })));
      for (const sd of [-1, 1]) { const pts = [[sd * 0.05, 0.45, K.frontZ(0.45) + 0.01], [sd * 0.06, 0.32, K.frontZ(0.35) + 0.012], [sd * 0.065, 0.1, K.frontZ(0.1) + 0.012], [sd * 0.07, -0.1, 0.16], [sd * 0.075, -0.4, 0.2]];
        r.torso.add(mk(tube(pts, 0.022, { n: 16, radial: 6, flat: [0.2, 1.4] }), trim)); }
      // sash with hanging ends and a book
      const sash = K.mat('sash', '#7a2e22', 'cloth');
      K.belt(sash, 0.04, 0.06, 0.024);
      r.torso.add(mk(tube([[0.09, 0.04, 0.12], [0.1, -0.08, 0.15], [0.11, -0.25, 0.17]], 0.02, { n: 8, radial: 6, flat: [0.3, 1.4] }), sash));
      const book = mk(new THREE.BoxGeometry(0.11, 0.14, 0.04), K.mat('book', '#5a2a1a', 'leather'), -0.17, -0.04, 0.05); book.rotation.y = -0.9; r.hips.add(book);
      add(r.hips, mk(new THREE.BoxGeometry(0.1, 0.13, 0.042), K.mat('pages', '#e0d4b0', 'rough'), -0.168, -0.04, 0.052)).rotation.y = -0.9;
      // bell sleeves
      for (const sd of [-1, 1]) { const el = sd < 0 ? r.elL : r.elR; el.add(mk(limbPart(K.rf, K.lf, 0.3, 1.02, 0.01, { flare: 2.2, lip: 0.0 }), robe)); el.add(mk(limbPart(K.rf, K.lf, 0.98, 1.03, 0.034, { flare: 0.1 }), trim)); }
      staff(K, r, r.weapon, { len: 1.75, cy: 0.06, orb: '#7ab8ff', gnarl: 1.2 });
      void o;
    },
  },
  cleric: {
    cfg: { shirt: 'cloth', upper: 'chain', fore: 'cloth', hand: 'darkleather', legs: 'pants' },
    dress(K, r) {
      const ch = K.mat('chain'), gold = K.mat('gold'), b = K.b;
      K.layer(ch, -0.02, 0.5, 0.01);
      K.skirt(ch, 0.02, 0.36, 0.15, 0.19, { folds: 6, amp: 0.02 });
      // tabard front and back
      const tm = new THREE.MeshStandardMaterial({ map: emblemTex('sun', 0.24, 0.5), roughness: 0.85, bumpMap: texOf('weave', [6, 12], false), bumpScale: 0.6, side: THREE.DoubleSide });
      for (const fb of [1, -1]) {
        const g = new THREE.PlaneGeometry(0.24, 0.98, 6, 24), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) + 0.03; const yy = Math.max(y, -0.02); let z = (y < 0 ? lerp(profR(K.P, 0) * K.SZ + 0.03, 0.205 * K.b - y * 0.06, sm(0, -0.08, y)) : profR(K.P, yy) * K.SZ + 0.022) * (1 - 2.5 * x * x); if (K.bust && fb > 0) z += 0.016 * G1(yy - 0.335, 0.05) * 1.2;
          p.setXYZ(i, x, y, z * fb); }
        g.computeVertexNormals(); if (fb < 0) { g.scale(-1, 1, 1); g.computeVertexNormals(); }
        const t = mk(g, tm, 0, 0.0, 0); r.torso.add(t);
        if (fb < 0) { const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const a = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = a; } g.computeVertexNormals(); }
      }
      K.belt(K.mat('darkleather'), 0.03, 0.04, 0.034, gold);
      for (const sd of [-1, 1]) { K.pauldron(sd, K.mat('steel'), gold, 2, 0.88); const el = sd < 0 ? r.elL : r.elR; el.add(mk(limbPart(K.rf, K.lf, 0.3, 0.95, 0.009, { flare: 0.3 }), K.mat('steel'))); el.add(mk(limbPart(K.rf, K.lf, 0.3, 0.34, 0.014), gold)); }
      for (const sd of [-1, 1]) { const kn = sd < 0 ? r.knL : r.knR; kn.add(mk(limbPart(K.rs, 0.41, 0.3, 0.92, 0.012, { flare: -0.2 }), K.mat('boots'))); }
      // holy symbol on a chain
      add(r.torso, mk(new THREE.TorusGeometry(0.075, 0.003, 4, 24, Math.PI), gold, 0, 0.5, 0.04)).rotation.set(-Math.PI / 2 - 0.9, 0, Math.PI);
      mace(K, r.weapon);
      const sh = heater(K, 'gold', 'sun'); sh.rotation.y = -Math.PI / 2; sh.position.set(-0.07, -0.12, 0); sh.scale.setScalar(0.92); r.elL.add(sh); r.shield = sh;
      void b;
    },
  },
  elder: {
    cfg: { shirt: 'robe', upper: 'robe', fore: 'robe', hand: 'skin', legs: 'robe' },
    dress(K, r) {
      const robe = K.mat('robe');
      K.skirt(robe, 0.03, 0.95, 0.15, 0.27, { folds: 9, amp: 0.06, pow: 0.9 });
      K.belt(K.mat('rope'), 0.04, 0.03, 0.02);
      const sh = K.mat('shawl', '#7a6a50', 'rough', { side: THREE.DoubleSide });
      r.torso.add(mk(lathe([[0.215, 0.26], [0.21, 0.36], [0.19, 0.44], [0.14, 0.5], [0.08, 0.57], [0.0005, 0.57]], { seg: 32, sx: 1.2, sz: 0.9, fn: (ph, y, rr) => rr * (1 + 0.05 * Math.sin(ph * 7) * sm(0.44, 0.26, y)) * (Math.abs(ph) < 0.35 && y < 0.45 ? 0.82 : 1) }), sh));
      for (const sd of [-1, 1]) { const el = sd < 0 ? r.elL : r.elR; el.add(mk(limbPart(K.rf, K.lf, 0.4, 1.0, 0.008, { flare: 1.4, lip: 0 }), robe)); }
      staff(K, r, r.weapon, { len: 1.0, cy: -0.35, wood: '#6a4a2a', hook: true, gnarl: 0.6 });
    },
  },
  merchant: {
    cfg: { shirt: 'cloth', upper: 'cloth', fore: 'skin', hand: 'skin', legs: 'robe' },
    dress(K, r, o) {
      K.skirt(K.mat('robe'), 0.03, 0.92, 0.16, 0.29, { folds: 11, amp: 0.05, pow: 0.9 });
      const ap = K.mat('apron', o.apron, 'cloth', { side: THREE.DoubleSide });
      K.skirt(ap, 0.035, 0.72, 0.165, 0.26, { folds: 6, amp: 0.025, fn: (ph, y, rr) => (Math.abs(ph) < 1.1 ? rr + 0.008 : rr - 0.03) });
      K.layer(ap, 0.05, 0.36, 0.008, (ph, y, rr) => (Math.abs(ph) < 0.7 ? rr : rr - 0.02));
      K.belt(K.mat('apronband', '#b8ae96', 'cloth'), 0.04, 0.03, 0.016);
      for (const sd of [-1, 1]) { const sh = sd < 0 ? r.armL : r.armR; sh.add(mk(limbPart(K.ru, K.lu, 0.85, 1.0, 0.014), K.mat('cloth'))); }
      r.hips.add(mk(blob(0.06, 0.05, 0.02), ap, 0, -0.18, 0.21));
    },
  },
  hunter: {
    cfg: { shirt: 'cloth', upper: 'cloth', fore: 'cloth', hand: 'skin', legs: 'pants' },
    dress(K, r) {
      const lth = K.mat('leather'), dk = K.mat('darkleather');
      K.layer(lth, 0.04, 0.48, 0.012);
      K.skirt(K.mat('cloth'), 0.02, 0.26, 0.145, 0.18, { folds: 6, amp: 0.04, split: true });
      K.belt(dk, 0.035, 0.035, 0.024, K.mat('steel'));
      K.pouch(dk, 0.12, 0.03);
      const knife = mk(new THREE.BoxGeometry(0.03, 0.16, 0.02), dk, -0.15, -0.02, 0.06); knife.rotation.z = 0.2; r.hips.add(knife);
      K.cape(K.mat('hoodcloak', '#4a4a26', 'cloth', { side: THREE.DoubleSide }), 0.78, 2.0);
      for (const sd of [-1, 1]) { const el = sd < 0 ? r.elL : r.elR; el.add(mk(limbPart(K.rf, K.lf, 0.4, 0.95, 0.009), dk)); const kn = sd < 0 ? r.knL : r.knR; kn.add(mk(limbPart(K.rs, 0.41, 0.3, 0.92, 0.012), K.mat('boots'))); }
      r.armL.add(mk(limbPart(K.ru, K.lu, 0.35, 0.65, 0.014), K.mat('bandage', '#e8e0d0', 'rough')));
      r.armL.add(mk(limbPart(K.ru, K.lu, 0.45, 0.52, 0.016), K.mat('blood', '#7a2a20', 'rough')));
    },
  },
  villager: {
    cfg: { shirt: 'cloth', upper: 'cloth', fore: 'skin', hand: 'skin', legs: 'pants' },
    dress(K, r, o) {
      K.skirt(K.mat('cloth'), 0.02, 0.24, 0.142, 0.17, { folds: 6, amp: 0.04 });
      const ap = K.mat('apron', o.apron, 'rough', { side: THREE.DoubleSide });
      K.skirt(ap, 0.03, 0.55, 0.15, 0.2, { folds: 5, amp: 0.02, fn: (ph, y, rr) => (Math.abs(ph) < 1.0 ? rr + 0.008 : rr - 0.04) });
      K.belt(K.mat('rope'), 0.035, 0.025, 0.014);
      for (const sd of [-1, 1]) { const sh = sd < 0 ? r.armL : r.armR; sh.add(mk(limbPart(K.ru, K.lu, 0.88, 1.02, 0.012), K.mat('cloth'))); const kn = sd < 0 ? r.knL : r.knR; kn.add(mk(limbPart(K.rs, 0.41, 0.55, 0.92, 0.01), K.mat('boots'))); }
    },
  },
  kid: {
    cfg: { shirt: 'cloth', upper: 'cloth', fore: 'skin', hand: 'skin', legs: 'pants' },
    dress(K, r) {
      K.skirt(K.mat('cloth'), 0.02, 0.22, 0.142, 0.17, { folds: 5, amp: 0.04 });
      K.belt(K.mat('rope'), 0.035, 0.025, 0.014);
      for (const sd of [-1, 1]) { const sh = sd < 0 ? r.armL : r.armR; sh.add(mk(limbPart(K.ru, K.lu, 0.6, 0.85, 0.01), K.mat('cloth'))); const kn = sd < 0 ? r.knL : r.knR; kn.add(mk(limbPart(K.rs, 0.41, 0.6, 0.92, 0.01), K.mat('boots'))); }
      r.hips.add(mk(new THREE.BoxGeometry(0.04, 0.05, 0.01), K.mat('patch', '#c8a050', 'cloth'), 0.12, -0.32, 0.07));
    },
  },
  goblin: {
    cfg: { shirt: 'skin', upper: 'skin', fore: 'skin', hand: 'skin', legs: 'skin', neck: 'skin' },
    dress(K, r) {
      const lth = K.mat('gobleather', '#5a4228', 'leather'), rag = K.mat('rag', '#4a3a24', 'rough', { side: THREE.DoubleSide, alphaMap: ragTex(), alphaTest: 0.5 });
      K.layer(lth, 0.12, 0.42, 0.01, (ph, y, rr) => (Math.abs(ph) < 0.35 ? rr - 0.03 : rr));
      K.skirt(rag, 0.02, 0.3, 0.14, 0.17, { folds: 6, amp: 0.08, split: true });
      K.belt(K.mat('darkleather'), 0.03, 0.04, 0.02, K.mat('rust', '#6e5a48', 'rust'));
      r.hips.add(mk(new THREE.SphereGeometry(0.02, 8, 6), K.mat('bone'), 0.13, -0.03, 0.12));
      r.hips.add(mk(new THREE.ConeGeometry(0.012, 0.06, 5), K.mat('bone'), 0.1, -0.06, 0.13));
      K.pauldron(-1, K.mat('rust', '#6e5a48', 'rust'), null, 2, 0.95);
      const sp = mk(new THREE.ConeGeometry(0.014, 0.07, 5), K.mat('rust'), -0.02, 0.07, 0); sp.rotation.z = 0.5; r.armL.add(sp);
      for (const sd of [-1, 1]) { const kn = sd < 0 ? r.knL : r.knR; kn.add(mk(limbPart(K.rs, 0.41, 0.4, 0.9, 0.008), K.mat('wrap', '#8a7a5a', 'rough'))); const el = sd < 0 ? r.elL : r.elR; el.add(mk(limbPart(K.rf, K.lf, 0.5, 0.9, 0.006), K.mat('wrap', '#8a7a5a', 'rough'))); }
      sword(K, r.weapon, 0.52, { curve: 0.07, crude: true, w: 0.06 });
    },
  },
  gobarcher: {
    cfg: { shirt: 'skin', upper: 'skin', fore: 'skin', hand: 'skin', legs: 'skin', neck: 'skin' },
    dress(K, r) {
      const lth = K.mat('gobleather', '#4e4a2a', 'leather'), rag = K.mat('rag', '#3e3a22', 'rough', { side: THREE.DoubleSide, alphaMap: ragTex(), alphaTest: 0.5 });
      K.layer(lth, 0.0, 0.47, 0.01);
      K.skirt(rag, 0.02, 0.3, 0.14, 0.17, { folds: 6, amp: 0.08, split: true });
      K.belt(K.mat('darkleather'), 0.03, 0.035, 0.02);
      for (const sd of [-1, 1]) { const kn = sd < 0 ? r.knL : r.knR; kn.add(mk(limbPart(K.rs, 0.41, 0.4, 0.9, 0.008), K.mat('wrap', '#8a7a5a', 'rough'))); }
      bow(K, r, r.handL, { half: 0.42, wood: '#4a3418' });
      quiver(K, r, 0.08, 0.32, -0.18, 5);
    },
  },
  chief: {
    cfg: { shirt: 'skin', upper: 'skin', fore: 'skin', hand: 'skin', legs: 'pants', neck: 'skin' },
    dress(K, r) {
      const lth = K.mat('gobleather', '#4a3020', 'leather'), fur = K.mat('fur'), b = K.b;
      K.layer(lth, -0.02, 0.44, 0.014);
      for (let k = 0; k < 7; k++) { const y = 0.12 + k * 0.045; for (let j = -3; j <= 3; j++) { const ph = j * 0.28; r.torso.add(mk(new THREE.SphereGeometry(0.008, 6, 4), K.mat('stud', '#8a8478', 'dark'), Math.sin(ph) * K.sideX(y) * 1.06, y, Math.cos(ph) * K.frontZ(y) * 1.12)); } }
      K.skirt(lth, 0.02, 0.38, 0.15, 0.2, { folds: 6, amp: 0.06, split: true });
      for (const sd of [-1, 1]) { const g = new THREE.CylinderGeometry(0.19 * b, 0.21 * b, 0.16, 8, 1, true, sd > 0 ? 0.3 : -1.3, 1.0); const t = mk(g, K.mat('rust', '#6e5a48', 'rust'), 0, -0.12, 0); t.scale.set(1.12, 1, 0.9); r.hips.add(t); }
      K.belt(K.mat('darkleather'), 0.02, 0.06, 0.03, K.mat('rust', '#6e5a48', 'rust'));
      r.torso.add(mk(warpSphere((x, y, z) => [x * 0.04, y * 0.045, z * 0.03 + 0.01], 12, 10), K.mat('bone'), 0, 0.02, K.frontZ(0.02) + 0.06));
      // fur mantle: a collar of clumps around the shoulders
      r.torso.add(mk(lathe([[0.25, 0.36], [0.25, 0.42], [0.22, 0.49], [0.15, 0.55], [0.1, 0.6], [0.0005, 0.58]], { seg: 32, sx: 1.18 * b, sz: 0.95 * b, fn: (ph, y, rr) => rr * (1 + 0.08 * Math.sin(ph * 11 + y * 30)) }), fur));
      for (let k = 0; k < 26; k++) { const ph = (k / 26) * TAU, y = 0.38 + (k % 3) * 0.04, rr = 0.25 * b; const c = mk(new THREE.ConeGeometry(0.035, 0.12, 5), fur, Math.sin(ph) * rr * 1.18, y, Math.cos(ph) * rr * 0.95); c.rotation.set(Math.cos(ph) * 1.9, 0, -Math.sin(ph) * 1.9); r.torso.add(c); }
      for (const sd of [-1, 1]) {
        const el = sd < 0 ? r.elL : r.elR; el.add(mk(limbPart(K.rf, K.lf, 0.35, 0.95, 0.012, { flare: 0.3 }), K.mat('darkleather')));
        for (let k = 0; k < 3; k++) { const sp = mk(new THREE.ConeGeometry(0.008, 0.04, 5), K.mat('rust'), -sd * 0.05 * b, -0.08 - k * 0.05, 0); sp.rotation.z = sd * Math.PI / 2; el.add(sp); }
        const kn = sd < 0 ? r.knL : r.knR; kn.add(mk(limbPart(K.rs, 0.41, 0.35, 0.92, 0.01), K.mat('wrap', '#6a5a40', 'rough')));
      }
      axe(K, r.weapon);
    },
  },
  priest: {
    cfg: { shirt: 'robe', upper: 'robe', fore: 'robe', hand: 'skin', legs: 'robe', neck: 'cloth' },
    dress(K, r) {
      const robe = K.mat('robe'), b = K.b;
      K.skirt(robe, 0.03, 0.98, 0.16, 0.33, { folds: 12, amp: 0.08, pow: 0.85 });
      // surplice panels, front and back
      const sp = new THREE.MeshStandardMaterial({ map: emblemTex('surplice', 0.28, 0.9), roughness: 0.9, bumpMap: texOf('weave', [6, 18], false), bumpScale: 0.6, side: THREE.DoubleSide });
      for (const fb of [1, -1]) {
        const g = new THREE.PlaneGeometry(0.28, 1.25, 6, 26), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) - 0.12; const yy = Math.max(y, 0); let z = (profR(K.P, yy) * K.SZ + 0.022) * (1 - 2.2 * x * x) + (y < 0 ? -y * 0.13 : 0); p.setXYZ(i, x * fb, y, z * fb); }
        g.computeVertexNormals(); r.torso.add(mk(g, sp));
      }
      r.torso.add(mk(lathe([[0.25, 0.32], [0.24, 0.4], [0.21, 0.47], [0.15, 0.53], [0.11, 0.6], [0.1, 0.68], [0.0005, 0.62]], { seg: 32, sx: 1.15 * b, sz: 0.92 * b, fn: (ph, y, rr) => rr * (1 + 0.05 * Math.sin(ph * 9) * sm(0.45, 0.32, y)) * (Math.abs(ph) < 0.4 && y > 0.5 ? 0.75 : 1) }), K.mat('mantle', '#36322e', 'cloth', { side: THREE.DoubleSide })));
      r.torso.add(mk(lathe([[0.25, 0.315], [0.252, 0.33], [0.0005, 0.33]], { seg: 32, sx: 1.15 * b, sz: 0.92 * b }), K.mat('trim')));
      // chain belt with hanging skulls
      K.belt(K.mat('chainbelt', '#4a4440', 'chain'), 0.04, 0.03, 0.026);
      for (const x of [-0.12, 0.1]) { r.hips.add(mk(tube([[x, 0.03, 0.15], [x * 1.05, -0.05, 0.18], [x * 1.1, -0.15, 0.2]], 0.004, { n: 6, radial: 4 }), K.mat('darksteel'))); r.hips.add(mk(warpSphere((X, Y, Z) => [X * 0.022, Y * 0.026, Z * 0.022], 10, 8), K.mat('bone', '#d8ccb0', 'bone'), x * 1.1, -0.18, 0.205)); }
      for (const sd of [-1, 1]) { const el = sd < 0 ? r.elL : r.elR; el.add(mk(limbPart(K.rf, K.lf, 0.3, 1.02, 0.012, { flare: 2.0, lip: 0 }), robe)); el.add(mk(limbPart(K.rf, K.lf, 0.96, 1.03, 0.036, { flare: 0.1 }), K.mat('trim'))); }
      staff(K, r, r.weapon, { len: 1.8, cy: 0.06, orb: '#ff7a2a', iron: true, gnarl: 0.4, thin: 0.8 });
    },
  },
};

// ---------------------------------------------------------------------------
function skeletonBody(K, rig, o) {
  const bone = K.mat('bone'), dark = K.mat('rust', '#6e5a48', 'rust'), b = 0.92;
  const torso = rig.torso, hips = rig.hips;
  // pelvis
  hips.add(mk(lathe([[0.03, -0.1], [0.1, -0.08], [0.13, -0.02], [0.12, 0.03], [0.06, 0.02], [0.0005, 0.0]], { seg: 16, sx: 1.15, sz: 0.7, fn: (ph, y, r) => r * (Math.abs(ph) < 0.5 ? 0.6 : 1) }), bone));
  // spine and ribs
  for (let k = 0; k < 12; k++) { const y = 0.02 + k * 0.045; torso.add(mk(blob(0.022, 0.016, 0.02), bone, 0, y, -0.06 + Math.sin(k * 0.3) * 0.01)); }
  for (let k = 0; k < 6; k++) {
    const y = 0.2 + k * 0.045, rr = 0.11 + Math.sin((k / 5) * Math.PI) * 0.025 - k * 0.004;
    for (const sd of [-1, 1]) {
      const pts = []; for (let j = 0; j <= 6; j++) { const a = lerp(Math.PI * 0.95, 0.2, j / 6); pts.push([sd * Math.sin(a) * rr * 1.25, y - 0.03 * Math.sin((j / 6) * Math.PI) - j * 0.006, Math.cos(a) * rr * 0.85 - 0.02]); }
      torso.add(mk(tube(pts, 0.007, { n: 12, radial: 5, flat: [1, 1.6] }), bone));
    }
  }
  torso.add(mk(blob(0.02, 0.1, 0.012), bone, 0, 0.36, 0.075));
  for (const sd of [-1, 1]) {
    torso.add(mk(tube([[sd * 0.02, 0.47, 0.06], [sd * 0.1, 0.48, 0.04], [sd * 0.18, 0.47, -0.01]], 0.01, { n: 6, radial: 5 }), bone));
    torso.add(mk(blob(0.06, 0.08, 0.012), bone, sd * 0.1, 0.4, -0.08));
  }
  for (let k = 0; k < 4; k++) torso.add(mk(blob(0.021, 0.017, 0.021), bone, 0, 0.545 + k * 0.034, -0.035 + k * 0.009));
  // rusty helmet and tattered tabard
  const head = grp(torso, 0, 0.7, 0.005); rig.head = head;
  buildHead(K, head, o);
  const helm = shell(K, (x, y, z) => sm(0.3, 0.4, y), 0.012, dark, [40, 28]); head.add(helm);
  head.add(mk(new THREE.BoxGeometry(0.014, 0.05, 0.008), dark, 0, 0.045, 0.1));
  const rag = K.mat('rag', '#4a3f34', 'rough', { side: THREE.DoubleSide, alphaMap: ragTex(), alphaTest: 0.5 });
  for (const fb of [1, -1]) { const g = new THREE.PlaneGeometry(0.22, 0.75, 4, 12), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, fb * (0.11 - (y < 0 ? y * 0.08 : 0) - 1.5 * p.getX(i) ** 2)); } g.translate(0, 0.12, 0); g.computeVertexNormals(); torso.add(mk(g, rag)); }
  K.belt(K.mat('darkleather'), 0.03, 0.03, 0.0);
  // limbs: long bones with knobbly joints
  const boneLimb = (L, r0) => limb(0, 0, L, { rf: (t) => r0 * (1 + 0.9 * G1(t, 0.07) + 0.7 * G1(t - 1, 0.07)), seg: 10 });
  for (const sd of [-1, 1]) {
    const sh = grp(torso, sd * 0.19, 0.455, -0.01);
    sh.add(mk(boneLimb(0.27, 0.016), bone));
    const el = grp(sh, 0, -0.28, 0); el.add(mk(boneLimb(0.24, 0.012), bone)); el.add(mk(boneLimb(0.235, 0.009), bone, sd * 0.014, 0, 0.01));
    const hand = grp(el, 0, -0.255, 0);
    hand.add(mk(blob(0.012, 0.03, 0.03), bone, 0, -0.03, 0));
    for (let k = 0; k < 4; k++) hand.add(mk(tube([[0, -0.055, 0.022 - k * 0.014], [-sd * 0.008, -0.085, 0.022 - k * 0.014], [-sd * 0.025, -0.095, 0.022 - k * 0.014]], 0.0045, { n: 6, radial: 4 }), bone));
    sh.rotation.z = sd * 0.08;
    rig[sd < 0 ? 'armL' : 'armR'] = sh; rig[sd < 0 ? 'elL' : 'elR'] = el; rig[sd < 0 ? 'handL' : 'handR'] = hand;
    const lg = grp(hips, sd * 0.085, -0.05, 0);
    lg.add(mk(boneLimb(0.44, 0.02), bone));
    const kn = grp(lg, 0, -0.445, 0); kn.add(mk(boneLimb(0.41, 0.016), bone)); kn.add(mk(new THREE.SphereGeometry(0.022, 8, 6), bone, 0, 0, 0.02));
    const ft = grp(kn, 0, -0.415, 0); ft.add(mk(blob(0.03, 0.02, 0.09, -0.3), bone, 0, -0.03, 0.04));
    rig[sd < 0 ? 'legL' : 'legR'] = lg; rig[sd < 0 ? 'knL' : 'knR'] = kn;
  }
  const W = grp(rig.handR, -0.006, -0.06, 0); rig.weapon = W;
  sword(K, W, 0.78, { rusty: true });
  // round plank shield with an iron rim
  const sg = grp(rig.elL, -0.065, -0.14, 0);
  const disc = mk(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 24), new THREE.MeshStandardMaterial({ map: emblemTex('planks', 1, 1), roughness: 0.9, bumpMap: texOf('wood', [1, 1], false), bumpScale: 0.6 }), 0, 0, 0); disc.rotation.z = Math.PI / 2; sg.add(disc);
  const rim = mk(new THREE.TorusGeometry(0.26, 0.014, 6, 32), dark); rim.rotation.y = Math.PI / 2; sg.add(rim);
  add(sg, mk(new THREE.SphereGeometry(0.055, 12, 8, 0, TAU, 0, Math.PI / 2), dark, -0.016, 0, 0)).rotation.z = Math.PI / 2;
  rig.shield = sg;
  void b;
}

// ---------------------------------------------------------------------------
function wolf() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const wm = (c, v) => { const m = mat(c, 'fur', v ? { vertexColors: true } : {}); m.bumpScale = 0.9; return m; };
  const furV = wm('#ffffff', true), fur = wm('#5f5c58'), dark = wm('#2e2b28'), pale = wm('#9a958c');
  const eye = new THREE.MeshStandardMaterial({ color: '#ffcf4a', emissive: '#ffb020', emissiveIntensity: 1.6, roughness: 0.1 });
  const nose = new THREE.MeshStandardMaterial({ color: '#141210', roughness: 0.25 }), fang = new THREE.MeshStandardMaterial({ color: '#e8e0c8', roughness: 0.35 });
  const gum = new THREE.MeshStandardMaterial({ color: '#4a1a18', roughness: 0.5 });
  const rig = { root, body, wolf: true };
  const trunk = grp(body, 0, 0.66, 0); rig.torso = trunk;
  // two-tone fur: pale belly, dark saddle (phi 0 is the belly once the lathe is laid down)
  const tone = (ph, y) => { const k = (1 - Math.cos(ph)) / 2, sad = sm(-0.3, 0.1, y) * (1 - sm(0.3, 0.45, y)); const d = lerp(k, 1, 0.3 * sad * k); return [lerp(0.3, 0.075, d), lerp(0.29, 0.07, d), lerp(0.27, 0.064, d)]; };
  const furLathe = (prof, fn, sx = 0.78) => {
    const g = lathe(prof, { seg: 30, sx, fn }), p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) col.set(tone(Math.atan2(p.getX(i), p.getZ(i)), p.getY(i)), i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.rotateX(Math.PI / 2); return g;
  };
  // body: deep narrow chest, tucked waist, rump
  trunk.add(mk(furLathe([[0.0005, -0.47], [0.07, -0.45], [0.12, -0.39], [0.14, -0.28], [0.13, -0.14], [0.13, 0.0], [0.16, 0.14], [0.19, 0.26], [0.195, 0.34], [0.16, 0.43], [0.09, 0.49], [0.0005, 0.5]],
    (ph, y, r) => { const below = Math.max(0, Math.cos(ph)); return r * (1 + 0.32 * G1(y - 0.27, 0.12) * below - 0.36 * G1(y + 0.1, 0.13) * below + 0.03 * Math.sin(ph * 15 + y * 30)); }), furV));
  // ruff: a shaggy collar over the shoulders and neck
  trunk.add(mk(furLathe([[0.0005, 0.16], [0.165, 0.17], [0.2, 0.24], [0.205, 0.32], [0.18, 0.42], [0.12, 0.5], [0.0005, 0.52]],
    (ph, y, r) => { const below = Math.max(0, Math.cos(ph)); return r * (1 + 0.3 * G1(y - 0.28, 0.12) * below + 0.06 * Math.sin(ph * 17 + y * 40) * sm(0.16, 0.24, y)); }, 0.82), furV));
  // neck and head
  trunk.add(mk(tube([[0, 0.04, 0.36], [0, 0.12, 0.5], [0, 0.19, 0.6]], (t) => 0.135 - 0.04 * t, { n: 8, radial: 16, flat: [1, 0.85] }), fur));
  const head = grp(trunk, 0, 0.2, 0.64); rig.head = head; head.scale.setScalar(1.12);
  head.add(mk(warpSphere((x, y, z) => { let X = x * 0.095, Y = y * 0.085, Z = z * 0.11; X *= 1 + 0.25 * G1(y + 0.1, 0.35) * G1(z + 0.2, 0.5); if (y > 0.4) Y -= (y - 0.4) * 0.025; return [X, Y, Z]; }, 28, 20,
    (x, y) => (y < -0.35 ? [0.32, 0.31, 0.28] : [0.12, 0.115, 0.108])), furV));
  // muzzle, nose, jaw with fangs
  head.add(mk(tube([[0, -0.005, 0.02], [0, -0.02, 0.13], [0, -0.03, 0.215]], (t) => 0.068 - 0.03 * t, { n: 8, radial: 14, flat: [0.95, 0.75] }), fur));
  head.add(mk(blob(0.024, 0.019, 0.02), nose, 0, -0.012, 0.235));
  const jaw = grp(head, 0, -0.045, 0.06); rig.jaw = jaw;
  jaw.add(mk(tube([[0, 0, -0.02], [0, -0.012, 0.08], [0, -0.008, 0.16]], (t) => 0.036 - 0.014 * t, { n: 6, radial: 10, flat: [0.8, 1.0] }), pale));
  jaw.add(mk(tube([[-0.022, 0.008, 0.02], [0, 0.01, 0.16], [0.022, 0.008, 0.02]], 0.006, { n: 10, radial: 5 }), gum));
  for (const sd of [-1, 1]) { const f = mk(new THREE.ConeGeometry(0.0065, 0.03, 5), fang, sd * 0.018, 0.022, 0.135); jaw.add(f); const f2 = mk(new THREE.ConeGeometry(0.006, 0.026, 5), fang, sd * 0.019, -0.03, 0.2); f2.rotation.x = Math.PI; head.add(f2); }
  for (const sd of [-1, 1]) {
    // tall pointed ears
    const e = mk(warpSphere((x, y, z) => { const u = (y + 1) / 2; return [x * 0.042 * (1 - u * 0.9), y * 0.065, z * 0.014 + 0.016 * x * x - 0.01 * u]; }, 10, 12), dark, sd * 0.055, 0.1, -0.03); e.rotation.set(-0.25, sd * 0.35, -sd * 0.28); head.add(e);
    head.add(mk(new THREE.SphereGeometry(0.0125, 10, 8), eye, sd * 0.046, 0.028, 0.083));
    const lid = mk(blob(0.024, 0.009, 0.022), dark, sd * 0.044, 0.044, 0.08); lid.rotation.z = sd * 0.35; head.add(lid);
    for (let k = 0; k < 3; k++) { const c = mk(new THREE.ConeGeometry(0.025, 0.06, 5), fur, sd * (0.085 + k * 0.008), -0.02 - k * 0.025, -0.02 - k * 0.01); c.rotation.set(-0.5, 0, sd * 1.9); head.add(c); }
  }
  // legs: [upper group (animated) -> pose group -> lower (bend) -> paw]
  const legs = [], low = [];
  const defs = [[-0.1, 0.3, 0.05, 0.32, 0.28, -0.05], [0.1, 0.3, 0.05, 0.32, 0.28, -0.05], [-0.1, -0.31, -0.45, 0.3, 0.36, 0.95], [0.1, -0.31, -0.45, 0.3, 0.36, 0.95]];
  for (const [x, z, a0, l1, l2, a1] of defs) {
    const hind = z < 0, lg = grp(trunk, x, -0.02, z), pose = grp(lg); pose.rotation.x = a0;
    pose.add(mk(limb(hind ? 0.09 : 0.065, hind ? 0.038 : 0.034, l1 + 0.08, { bulge: hind ? 0.35 : 0.25, at: 0.18, sz: hind ? 1.6 : 1.35, capT: 1.4 }), fur, 0, 0.08, 0));
    const lo = grp(pose, 0, -l1, 0); lo.rotation.x = a1; lo.userData.base = a1;
    lo.add(mk(limb(hind ? 0.034 : 0.03, 0.024, l2, { sz: 1.15 }), fur));
    const paw = grp(lo, 0, -l2, 0); paw.rotation.x = -(a0 + a1);
    paw.add(mk(blob(0.034, 0.024, 0.05, -0.45), dark, 0, -0.012, 0.022));
    for (let k = -1; k <= 1; k++) paw.add(mk(new THREE.SphereGeometry(0.014, 8, 6), dark, k * 0.018, -0.015, 0.062));
    legs.push(lg); low.push(lo);
  }
  rig.legs = legs; rig.low = low;
  // bushy tail
  const tail = grp(trunk, 0, 0.08, -0.45); rig.tail = tail;
  tail.add(mk(tube([[0, 0, 0], [0, -0.06, -0.13], [0, -0.2, -0.23], [0, -0.38, -0.26]], (t) => 0.03 + 0.055 * Math.sin(Math.pow(t, 0.7) * Math.PI) * (1 - t * 0.35), { n: 14, radial: 12 }), fur));
  tail.add(mk(new THREE.SphereGeometry(0.036, 8, 6), dark, 0, -0.38, -0.26));
  bake(root);
  const mats = new Set(); root.traverse((m) => { if (m.isMesh) mats.add(m.material); });
  rig.mats = [...mats]; rig.kind = 'wolf'; rig.height = 1.0;
  return rig;
}
