// Lantern of Mistbrook — game controller: rendering, camera, input, exploration, dialogue glue, saving.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, groundY, SPOTS, STREAM, OCC } from './world.js';
import { buildModel, animate, play } from './actors.js';
import { FX } from './fx.js';
import * as UI from './ui.js';
import { HEROES, FOES, AB, DEFAULT_AB, mod, skillBonus, SKILLS, sgn } from './rules.js';
import * as CB from './combat.js';
import { SPAWNS, GROUPS, NPCS, DLG, ENDINGS, SK_CLS } from './story.js';
import { initAudio, sfx, setWater, AU, setVol, musicMode } from './audio.js';
import { pathLen, cutPath } from './nav.js';

const $ = (s) => document.querySelector(s);
const V3 = THREE.Vector3;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: (k) => { try { localStorage.removeItem(k); } catch {} } };
const SAVE = 'mistbrook-save-v1';
const isTouch = matchMedia('(pointer: coarse)').matches;
const Q = store.get('mb-q') || (isTouch ? 'med' : 'high');
$('#quality').value = Q;

const G = (window.G = { party: [], foes: [], npcs: [], actors: [], mode: 'title', flags: {}, gold: 20, potions: 2, combat: null, pending: null, sel: null, groups: { wolves: 'hostile', camp: 'idle', ruin: 'idle' }, tried: new Set(), inter: {} });

// ---------------------------------------------------------------------------
// renderer, scene, lights, post
const renderer = new THREE.WebGLRenderer({ antialias: Q === 'low', powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q === 'high' ? 2 : Q === 'med' ? 1.5 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = Q !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('#stage').appendChild(renderer.domElement);
const canvas = renderer.domElement;
const scene = new THREE.Scene();
const FOG = new THREE.Color('#6e5560');
scene.fog = new THREE.Fog(FOG.clone(), 38, 105);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.3, 700);
const hemi = new THREE.HemisphereLight('#9aa6d8', '#5a4632', 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffb27a', 2.9);
const SUN_DIR = new V3(-0.72, 0.52, 0.46).normalize();
if (Q !== 'low') {
  sun.castShadow = true; const s = Q === 'high' ? 2048 : 1024; sun.shadow.mapSize.set(s, s);
  const sc = sun.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
}
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#6a7ac8', 0.45); fill.position.set(30, 20, -20); scene.add(fill);
const LIGHT0 = { hemi: hemi.intensity, sun: sun.intensity };

let composer = null, grade = null;
if (Q !== 'low') {
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: Q === 'high' ? 4 : 0 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.55, 0.86));
  grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = smoothstep(0.86, 0.3, length(d * vec2(1.0, 0.85)));
        c.rgb *= mix(0.5, 1.0, v); float l = dot(c.rgb, vec3(0.299,0.587,0.114)); c.rgb = mix(vec3(l), c.rgb, 1.12);
        c.rgb *= vec3(1.03, 0.99, 0.95); gl_FragColor = c; }`,
  });
  composer.addPass(grade); composer.addPass(new OutputPass());
}

G.camera = camera; G.scene = scene;
const W = (G.W = buildWorld(scene, Q));
const nav = (G.nav = W.nav);
const fx = (G.fx = new FX(scene));
fx.emitters = W.emitters;
for (let x = -30; x <= 30; x += 3.5) fx.emitters.push({ kind: 'mist', x, y: 0.2, z: STREAM.z, rate: 0.35, color: '#cfdde6' });
if (W.sky) W.sky.material.uniforms.sun.value.copy(new V3(-0.75, 0.2, 0.62).normalize());

// fade overlay
const fade = document.createElement('div');
fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:6;transition:opacity .8s';
document.body.appendChild(fade);
const fadeTo = async (v, ms = 800) => { fade.style.transition = `opacity ${ms}ms`; fade.style.opacity = v; await wait(ms); };

// ---------------------------------------------------------------------------
// actors
const RING_GEO = new THREE.RingGeometry(0.42, 0.53, 40);
const PROXY_MAT = new THREE.MeshBasicMaterial();
const proxies = [];
function makeActor(o) {
  const rig = buildModel(o.look);
  const a = Object.assign({ yaw: 0, speed: 0, path: null, anim: { t: 0, phase: Math.random() * 6 }, seed: Math.random() * 10, moveId: 0 }, o);
  a.rig = rig; a.root = rig.root; a.pos = rig.root.position;
  a.pos.set(o.x, groundY(o.x, o.z), o.z); a.yawTarget = a.yaw; a.root.rotation.y = a.yaw; a.homeYaw = a.yaw;
  scene.add(a.root);
  const ring = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color: o.ringColor || '#fff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.renderOrder = 2; a.root.add(ring); a.ring = ring;
  if (o.look === 'wolf') ring.scale.setScalar(1.35);
  if (o.look === 'grukk' || o.look === 'priest') ring.scale.setScalar(1.15);
  const px = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, rig.height, 8), PROXY_MAT); px.position.y = rig.height / 2; px.visible = false; px.userData.actor = a;
  a.root.add(px); proxies.push(px);
  G.actors.push(a);
  return a;
}
function makeHero(T, i) {
  const [sx, sz] = SPOTS.start, off = [[0, 0], [-1.1, 1.3], [1.1, 1.3], [0, 2.6]][i];
  const h = makeActor({ ...T, look: T.id, team: 'party', x: sx + off[0], z: sz + off[1], yaw: Math.PI, ringColor: T.color });
  Object.assign(h, { maxHp: T.hp, hp: T.hp, level: 2, xp: 0, slotsMax: T.slots || 0, slots: T.slots || 0, uses: {}, acBonus: 0, spellPlus: 0 });
  for (const id of T.abil) if (AB[id].uses) h.uses[id] = AB[id].uses;
  h.dmgBonus = () => mod(h.st[h.weapon.stat]);
  G.party.push(h);
  return h;
}
HEROES.forEach(makeHero);
const byId = {};
for (const n of NPCS) { const a = makeActor({ ...n, team: 'npc', ringColor: '#e8c35a' }); if (n.pose) a.anim.pose = n.pose; G.npcs.push(a); byId[n.id] = a; UI.nameTag(a); }
function makeFoe(s) {
  const F = FOES[s.type];
  const f = makeActor({ id: s.id, type: s.type, team: 'foe', name: F.name, look: F.look, x: s.x, z: s.z, yaw: s.yaw || 0, group: s.group, hp: F.hp, maxHp: F.hp, ac: F.ac, spd: F.spd, atk: F.atk, dmg: F.dmg, dtype: F.type, reach: F.reach, ranged: !!F.ranged, spell: !!F.spell, xp: F.xp, sv: F.sv, vuln: F.vuln, icon: F.icon, ringColor: '#e0493c', por: s.por });
  G.foes.push(f); byId[s.id] = f; UI.nameTag(f, true);
  return f;
}
SPAWNS.forEach(makeFoe);
byId.priest.role = '灰袍祭司'; byId.grukk.role = '哥布林頭目';
const hero = (id) => G.party.find((h) => h.id === id);

// interactables
for (const [k, it] of Object.entries(W.inter)) {
  it.key = k; G.inter[k] = it;
  const px = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 6), PROXY_MAT); px.position.copy(it.pos).setY(0.7); px.visible = false; px.userData.inter = it; scene.add(px); proxies.push(px);
}

// portraits rendered once with the main renderer
function portrait(a) {
  const ps = new THREE.Scene(); ps.background = new THREE.Color('#3b2d22');
  ps.add(new THREE.HemisphereLight('#fff1dd', '#40302a', 1.5));
  const key = new THREE.DirectionalLight('#ffd7a8', 2.6); key.position.set(1.5, 2, 2.5); ps.add(key);
  const rim = new THREE.DirectionalLight('#7aa0ff', 2); rim.position.set(-2, 1.5, -2); ps.add(rim);
  const parent = a.root.parent, p0 = a.pos.clone(), r0 = a.root.rotation.y, pose = a.anim.pose;
  a.anim.pose = null; ps.add(a.root); a.pos.set(0, 0, 0); a.root.rotation.y = 0.35; a.ring.visible = false;
  animate(a, 0.016, 0); a.root.updateMatrixWorld(true);
  const hp = new V3(); a.rig.head.getWorldPosition(hp);
  const s = a.rig.body.scale.x * a.rig.head.scale.x;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  if (a.rig.wolf) { cam.position.set(hp.x + 0.5, hp.y + 0.1, hp.z + 0.9); cam.lookAt(hp); }
  else { cam.position.set(hp.x + 0.22 * s, hp.y + 0.05 * s, hp.z + 0.85 * s); cam.lookAt(hp.x, hp.y - 0.05 * s, hp.z); }
  const S = 128, pr = renderer.getPixelRatio();
  renderer.setScissorTest(true); renderer.setViewport(0, 0, S, S); renderer.setScissor(0, 0, S, S);
  const fog = ps.fog; renderer.render(ps, cam);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  c.getContext('2d').drawImage(canvas, 0, canvas.height - S * pr, S * pr, S * pr, 0, 0, 128, 128);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
  parent.add(a.root); a.pos.copy(p0); a.root.rotation.y = r0; a.ring.visible = true; a.anim.pose = pose;
  return c.toDataURL('image/jpeg', 0.9);
}
for (const a of [...G.party, ...G.npcs, ...G.foes.filter((f) => f.por)]) a.portrait = portrait(a);

// ---------------------------------------------------------------------------
// camera
const cam = (G.cam = { tgt: new V3(0, 0, 8), cur: new V3(0, 0, 8), yaw: 0.35, dist: 18, distCur: 18, follow: true, shake: 0, auto: 0 });
G.focus = (p) => { cam.tgt.set(p.x, 0, p.z); cam.follow = false; };
G.shake = (s) => { cam.shake = Math.max(cam.shake, s); };
const keys = new Set();
function updateCamera(dt) {
  if (cam.auto) cam.yaw += cam.auto * dt;
  const sp = cam.distCur * 0.9 * dt;
  const fwd = new V3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), right = new V3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
  if (G.mode === 'explore' || G.mode === 'combat') {
    let mx = 0, mz = 0;
    if (keys.has('w') || keys.has('arrowup')) mz += 1; if (keys.has('s') || keys.has('arrowdown')) mz -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1; if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (mx || mz) { cam.tgt.addScaledVector(fwd, mz * sp).addScaledVector(right, mx * sp); cam.follow = false; }
    if (keys.has('q')) cam.yaw += dt * 1.6; if (keys.has('e')) cam.yaw -= dt * 1.6;
  }
  if (cam.follow && G.sel && G.mode === 'explore') cam.tgt.lerp(new V3(G.sel.pos.x, 0, G.sel.pos.z), 1 - Math.exp(-dt * 3));
  cam.tgt.x = clamp(cam.tgt.x, -30, 30); cam.tgt.z = clamp(cam.tgt.z, -50, 37);
  cam.cur.lerp(cam.tgt, 1 - Math.exp(-dt * 5));
  cam.distCur += (cam.dist - cam.distCur) * (1 - Math.exp(-dt * 7));
  const t = clamp((cam.distCur - 7) / (32 - 7), 0, 1), pitch = cam.dlg ? 0.42 : 0.62 + t * 0.45;
  const D = cam.distCur, c = cam.cur;
  camera.position.set(c.x + Math.sin(cam.yaw) * Math.cos(pitch) * D, c.y + Math.sin(pitch) * D, c.z + Math.cos(cam.yaw) * Math.cos(pitch) * D);
  if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt); const k = cam.shake * 0.4; camera.position.x += (Math.random() - 0.5) * k; camera.position.y += (Math.random() - 0.5) * k; }
  camera.lookAt(c.x, cam.dlg ? 1.25 : c.y + 1.1 * (1 - t) + 0.3, c.z);
  OCC.uOccC.value.copy(camera.position); OCC.uOccT.value.set(c.x, 1.0, c.z);
  sun.position.copy(c).addScaledVector(SUN_DIR, 70); sun.target.position.copy(c);
  setWater(clamp(1 - Math.abs(c.z - STREAM.z) / 14, 0, 1));
}

// ---------------------------------------------------------------------------
// movement
G.walk = (a, pts, speed = 4.2) => new Promise((res) => {
  if (a.onArrive) a.onArrive(false);
  a.path = pts.map((p) => ({ x: p.x, z: p.z })); a.walkSpeed = speed; a.onArrive = res; a.moveId++;
  if (!a.path.length) { a.path = null; a.onArrive = null; res(true); }
});
G.stopAll = () => { for (const a of G.actors) if (a.path) { a.path = null; a.speed = 0; const f = a.onArrive; a.onArrive = null; f?.(false); } };
function updateMovers(dt) {
  for (const a of G.actors) {
    if (a.path && a.path.length) {
      const p = a.path[0], dx = p.x - a.pos.x, dz = p.z - a.pos.z, L = Math.hypot(dx, dz);
      const step = a.walkSpeed * dt;
      if (L > 0.05) a.yawTarget = Math.atan2(dx, dz);
      if (L <= step) { a.pos.x = p.x; a.pos.z = p.z; a.path.shift(); }
      else { a.pos.x += (dx / L) * step; a.pos.z += (dz / L) * step; }
      a.speed = a.walkSpeed;
      if (!a.path.length) { a.path = null; a.speed = 0; const f = a.onArrive; a.onArrive = null; f?.(true); }
    } else a.speed = 0;
    a.pos.y = groundY(a.pos.x, a.pos.z);
    let dy = a.yawTarget - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    a.yaw += dy * Math.min(1, dt * 10); a.root.rotation.y = a.yaw;
    if (a.sinking) { a.sinkT = (a.sinkT || 0) + dt; if (a.sinkT > 1) a.pos.y -= (a.sinkT - 1) * 0.6; if (a.sinkT > 3) { a.root.visible = false; a.sinking = false; } }
  }
}
G.blockers = (except) => G.actors.filter((a) => a !== except && a.root.visible && !a.gone && !(a.team === 'foe' && a.dead) && !(except && except.team !== 'party' && a.team === 'npc' && false));
function approach(from, pts, tp, reach) {
  const out = []; let p = from;
  if (Math.hypot(p.x - tp.x, p.z - tp.z) <= reach) return out;
  for (const q of pts) {
    const L = Math.hypot(q.x - p.x, q.z - p.z), n = Math.max(1, Math.ceil(L / 0.25));
    for (let k = 1; k <= n; k++) { const x = p.x + (q.x - p.x) * k / n, z = p.z + (q.z - p.z) * k / n; if (Math.hypot(x - tp.x, z - tp.z) <= reach) { out.push({ x, z }); return out; } }
    out.push(q); p = q;
  }
  return out;
}
const FORM = [[-1.1, -1.3], [1.1, -1.3], [0, -2.6]];
function partyMove(dest, reach = 0) {
  const L = G.sel; if (!L || L.downed) return Promise.resolve(false);
  let path = nav.find(L.pos.x, L.pos.z, dest.x, dest.z);
  if (!path) { UI.float('到不了', new V3(dest.x, 0.5, dest.z), '#ccc', true); return Promise.resolve(false); }
  if (reach) path = approach(L.pos, path, dest, reach);
  const end = path.length ? path[path.length - 1] : { x: L.pos.x, z: L.pos.z };
  const prev = path.length > 1 ? path[path.length - 2] : L.pos;
  let hx = end.x - prev.x, hz = end.z - prev.z; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
  if (hl < 0.01) { hx = Math.sin(L.yaw); hz = Math.cos(L.yaw); }
  const rx = -hz, rz = hx; // right of heading
  const lenL = pathLen(L.pos, path);
  const others = G.party.filter((h) => h !== L);
  others.forEach((h, i) => {
    const [ox, oz] = FORM[i];
    const tx = end.x + rx * ox + hx * oz, tz = end.z + rz * ox + hz * oz;
    const fp = nav.nearestFree(tx, tz, 3) || [end.x, end.z];
    const p2 = nav.find(h.pos.x, h.pos.z, fp[0], fp[1]);
    if (p2) G.walk(h, p2, 4.4 * clamp(pathLen(h.pos, p2) / Math.max(1, lenL), 0.85, 1.7));
  });
  if (!reach) clickMark(end);
  return G.walk(L, path, 4.4);
}
let markT = 0;
const mark = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.36, 32), new THREE.MeshBasicMaterial({ color: '#f3dca0', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
mark.rotation.x = -Math.PI / 2; scene.add(mark);
function clickMark(p) { mark.position.set(p.x, groundY(p.x, p.z) + 0.06, p.z); markT = 0.8; }

// ---------------------------------------------------------------------------
// selection, refresh, abilities
G.select = (h, inCombat = false) => {
  if (!h) return;
  G.sel = h; G.pending = null;
  if (!inCombat) cam.follow = true;
  G.refresh();
};
G.refresh = () => { UI.partyCards(G); UI.hotbar(G); UI.initiative(G); };
G.onCard = (h) => {
  sfx('click');
  if (G.mode === 'combat') {
    const A = G.combat?.active;
    if (A && A.team === 'party' && G.pending && ['ally', 'downed'].includes(AB[G.pending].target)) { combatTarget(A, G.pending, h); return; }
    G.focus(h.pos); return;
  }
  if (G.mode !== 'explore') return;
  if (G.pending && ['ally', 'downed'].includes(AB[G.pending].target)) { exploreAbility(G.sel, G.pending, h); return; }
  G.select(h);
};
const COMBAT_ONLY = new Set(['attack', 'cleave', 'firebolt', 'missile', 'thunder', 'flame', 'mark', 'volley', 'dash', 'help']);
G.cannot = (h, id) => {
  const ab = AB[id], C = G.combat;
  if (h.downed) return '倒地了，無法行動';
  if (ab.uses && h.uses[id] <= 0) return '次數用完了（到營火休息可以恢復）';
  if (ab.slot && h.slots <= 0) return '法術位用完了（到營火休息可以恢復）';
  if (id === 'potion' && G.potions <= 0) return '沒有藥水了';
  if (C) {
    if (C.active !== h) return '還沒輪到他';
    if (ab.cost === 'action' && !h.budget?.action) return '這回合的動作已經用掉了';
    if (ab.cost === 'bonus' && !h.budget?.bonus) return '這回合的附贈動作已經用掉了';
    if (id === 'help' && !G.party.some((p) => p.downed)) return '沒有倒地的同伴';
  } else {
    if (G.mode !== 'explore') return '現在不行';
    if (COMBAT_ONLY.has(id)) return '只能在戰鬥中使用';
    if (id === 'secondwind' && h.hp >= h.maxHp) return '生命是滿的';
  }
  return '';
};
G.pickAbility = (id) => {
  const h = G.combat ? G.combat.active : G.sel;
  if (!h || h.team !== 'party') return;
  const why = G.cannot(h, id);
  if (why) { UI.float(why, new V3(h.pos.x, h.pos.y + 2.3, h.pos.z), '#ddd', true); sfx('fail'); return; }
  sfx('click');
  const ab = AB[id];
  if (ab.target === 'self') {
    if (G.combat) combatAct(() => CB.useAbility(G, h, id, h));
    else exploreAbility(h, id, h);
    return;
  }
  G.pending = G.pending === id ? null : id;
  G.refresh();
};
async function exploreAbility(h, id, t) {
  const ab = AB[id];
  if (G.cannot(h, id)) return;
  if (ab.target === 'ally' && t !== h && CB.dist(h, t) > (ab.range || 2) + 0.2) {
    const ok = await (async () => { const p = nav.find(h.pos.x, h.pos.z, t.pos.x, t.pos.z); if (!p) return false; return G.walk(h, approach(h.pos, p, t.pos, (ab.range || 2) - 0.2), 4.4); })();
    if (!ok) return;
  }
  G.mode = 'busy';
  await CB.useAbility(G, h, id, t);
  G.mode = 'explore'; G.refresh();
}
async function combatAct(fn) {
  const C = G.combat; if (!C || C.busy) return;
  C.busy = true; clearPreview();
  try { await fn(); } catch (e) { console.error(e); }
  if (G.combat === C) C.busy = false;
  G.refresh();
}
async function combatTarget(h, id, t) {
  const why = G.cannot(h, id);
  if (why) { UI.float(why, new V3(h.pos.x, h.pos.y + 2.3, h.pos.z), '#ddd', true); return; }
  const ab = AB[id];
  if (ab.target === 'downed' && !t.downed) { UI.float('他沒有倒地', new V3(t.pos.x, 2, t.pos.z), '#ddd', true); return; }
  const reach = ab.target === 'foe' ? CB.reachOf(h, id) : ab.range || 2;
  await combatAct(async () => {
    if (CB.dist(h, t) > reach + 0.15) {
      const plan = planApproach(h, t, reach - 0.25);
      if (!plan || plan.cost > h.budget.move + 0.01) { UI.float('太遠了', new V3(t.pos.x, t.pos.y + 2.2, t.pos.z), '#ddd', true); return; }
      h.budget.move -= plan.cost; G.refresh();
      await G.walk(h, plan.pts, 3.8);
    }
    await CB.useAbility(G, h, id, t);
  });
}
function planApproach(h, t, reach) {
  nav.setActors(G.blockers(h).filter((a) => a !== t));
  nav.blockCircle(t.pos.x, t.pos.z, 0.6, 1, nav.dyn);
  const p = nav.find(h.pos.x, h.pos.z, t.pos.x, t.pos.z);
  nav.clearActors();
  if (!p) return null;
  const pts = approach(h.pos, p, t.pos, reach);
  return { pts, cost: pathLen(h.pos, pts) };
}
function planMove(h, pt) {
  nav.setActors(G.blockers(h));
  const p = nav.find(h.pos.x, h.pos.z, pt.x, pt.z);
  nav.clearActors();
  if (!p) return null;
  return { pts: p, cost: pathLen(h.pos, p) };
}
G.endTurn = () => { const C = G.combat; if (C && C.active?.team === 'party' && !C.busy && C.endTurn) { sfx('click'); G.pending = null; clearPreview(); C.endTurn(); } };
$('#b-end').onclick = () => G.endTurn();

// combat callbacks
G.checkCombatEnd = async () => {
  const C = G.combat; if (!C || C.over) return true;
  if (!G.party.some((h) => !h.downed)) { await CB.endCombat(G, false); return true; }
  if (!CB.liveFoes(G).length) { await CB.endCombat(G, true); return true; }
  return false;
};
G.gainXp = (n) => CB.gainXp(G, n);
G.removeBody = (t) => { t.sinking = true; t.showName = false; };
G.push = async (o, from, d0) => {
  const dx = o.pos.x - from.x, dz = o.pos.z - from.z, L = Math.hypot(dx, dz) || 1;
  let best = null;
  for (let s = d0; s > 0.2; s -= 0.3) { const x = o.pos.x + (dx / L) * s, z = o.pos.z + (dz / L) * s; if (nav.staticFreeAt(x, z)) { best = { x, z }; break; } }
  if (best) await G.walk(o, [best], 7);
};
G.onFoeDead = (t) => {
  if (t.type === 'priest') {
    G.flags.priestDead = 1;
    for (const f of CB.liveFoes(G)) if (f.type === 'skeleton') crumble(f);
    if (G.flags.truth) setTimeout(() => UI.caption('莫洛斯倒在地上，喃喃地說：「讓……他們……走……」', 3600), 600);
  }
};
function crumble(f) {
  f.dead = true; f.hp = 0; f.anim.act = null; sfx('bones');
  if (G.combat) G.combat.xp += f.xp;
  UI.float('散架了', new V3(f.pos.x, f.pos.y + 2, f.pos.z), '#bfefff', true);
  fx.burst(new V3(f.pos.x, 1, f.pos.z), '#9fefff', 20, 2, 0.15, 0.6);
  G.removeBody(f);
}
let skN = 0;
G.summonSkeleton = async (p, priest) => {
  const fp = nav.nearestFree(p.x + (Math.random() - 0.5) * 2, p.z + 2, 3) || [p.x, p.z + 2];
  const f = makeFoe({ id: 'sum' + ++skN, type: 'skeleton', x: fp[0], z: fp[1], yaw: 0, group: 'ruin' });
  f.summoned = true; f.combatReady = true; f.showName = true; f.yawTarget = Math.atan2(G.party[0].pos.x - f.pos.x, G.party[0].pos.z - f.pos.z);
  sfx('bones'); fx.burst(new V3(fp[0], 0.3, fp[1]), '#5fe8ff', 30, 2.5, 0.2, 0.8, 1);
  fx.light('#5fe8ff', 40, new V3(fp[0], 1.2, fp[1]), 0.8);
  const C = G.combat;
  if (C) { const i = C.order.indexOf(priest); f.init = priest.init - 0.1; C.order.splice(i + 1, 0, f); }
  UI.log(`<b>莫洛斯</b> 喚起了一個骷髏兵！`, 'hit');
  G.refresh();
  await play(f, 'rise', 1.2, null);
};
G.afterCombat = async () => {
  for (const g of Object.keys(GROUPS)) {
    const m = G.foes.filter((f) => f.group === g);
    if (G.groups[g] !== 'peace' && G.groups[g] !== 'fled' && m.length && m.every((f) => f.dead || f.gone)) G.groups[g] = 'dead';
  }
  // loot from fallen foes
  const loot = { goblin: 4, archer: 4, grukk: 25, wolf: 0, skeleton: 2, priest: 15 };
  let g = 0; for (const f of G.foes) if (f.dead && !f.looted) { f.looted = true; g += loot[f.type] || 0; }
  if (g) { G.gold += g; UI.log(`從倒下的敵人身上搜到 ${g} 枚金幣。`, 'sys'); sfx('coin'); }
  updateQuest(); G.refresh(); save();
};

// ---------------------------------------------------------------------------
// interactions
function goTo(target, r, fn) {
  const L = G.sel;
  if (CB.dist(L, target) <= r) { fn(); return; }
  partyMove(target.pos, r - 0.3).then((ok) => { if (ok && G.mode === 'explore' && CB.dist(L, target) <= r + 0.4) fn(); });
}
async function interact(it) {
  if (it.hidden || it.done) return;
  if (G.mode === 'combat') return combatInteract(it);
  if (G.mode !== 'explore') return;
  goTo(it, it.r, () => useInter(it));
}
async function useInter(it, by = G.sel) {
  if (it.chest) return openChest(it, by);
  if (it.key === 'fire') return rest();
  if (it.brazier) return kickBrazier(it, by);
  if (it.key === 'lantern') return takeLantern();
}
async function combatInteract(it) {
  const C = G.combat, h = C.active;
  if (!h || h.team !== 'party' || C.busy) return;
  if (!it.brazier) { UI.float('戰鬥中不能這樣做', new V3(it.pos.x, 1.5, it.pos.z), '#ddd', true); return; }
  if (!h.budget.action) { UI.float('這回合的動作已經用掉了', new V3(h.pos.x, 2.2, h.pos.z), '#ddd', true); return; }
  await combatAct(async () => {
    if (CB.dist(h, it) > 2.3) {
      const plan = planApproach(h, { pos: it.pos }, 1.9);
      if (!plan || plan.cost > h.budget.move + 0.01) { UI.float('太遠了', new V3(it.pos.x, 1.5, it.pos.z), '#ddd', true); return; }
      h.budget.move -= plan.cost; await G.walk(h, plan.pts, 3.8);
    }
    h.budget.action = 0;
    await kickBrazier(it, h);
    await G.checkCombatEnd();
  });
}
async function kickBrazier(b, h) {
  h.yawTarget = Math.atan2(b.pos.x - h.pos.x, b.pos.z - h.pos.z);
  await play(h, 'kick', 0.6, null);
  b.lit = false; b.done = true; b.em.off = true; b.light.base = 0; b.light.L.intensity = 0; b.coal.material.emissiveIntensity = 0;
  b.g.rotation.z = 1.2; b.g.position.y = 0.25; b.g.position.x += 0.4;
  sfx('extinguish'); fx.burst(new V3(b.pos.x, 0.6, b.pos.z), '#5fe8ff', 40, 3, 0.2, 0.8, 0.5);
  UI.log(`${h.name} 踢翻了藍火火盆。`, 'sys');
  if (W.braziers.every((x) => !x.lit)) {
    UI.log('兩個火盆都熄了，骷髏兵失去了力量！', 'crit');
    for (const f of G.foes) if (f.type === 'skeleton' && !f.dead && !f.gone) crumble(f);
  }
  G.refresh(); save();
}
async function openChest(it, h) {
  it.done = true;
  h.yawTarget = Math.atan2(it.pos.x - h.pos.x, it.pos.z - h.pos.z);
  play(h, 'kneel', 0.9, null);
  sfx('chest');
  const t0 = performance.now();
  W.anim.push(() => { const u = Math.min(1, (performance.now() - t0) / 500); it.lid.rotation.x = -1.2 * u; return u >= 1; });
  fx.burst(new V3(it.pos.x, 0.7, it.pos.z), '#ffd27a', 24, 2, 0.15, 0.8, 1);
  await wait(500);
  const got = [];
  if (it.key === 'wolfChest') { G.potions += 2; G.gold += 20; got.push('2 瓶治療藥水', '20 金幣'); }
  if (it.key === 'campChest') { G.gold += 60; h.acBonus += 1; got.push('60 金幣', `守護戒指（${h.name} 的 AC +1）`); }
  if (it.key === 'ruinChest') { G.gold += 80; G.potions += 1; const o = hero('orin'); o.spellPlus += 2; got.push('80 金幣', '1 瓶治療藥水', '餘燼寶石（歐林把它鑲在法杖上：火焰箭傷害 +2）'); }
  UI.log(`打開了${it.name}：${got.join('、')}`, 'sys');
  UI.float('獲得物品！', new V3(it.pos.x, 1.6, it.pos.z), '#ffe27a');
  sfx('coin');
  G.refresh(); save();
}
async function rest() {
  const near = G.foes.some((f) => !f.dead && !f.gone && G.groups[f.group] !== 'peace' && Math.hypot(f.pos.x - G.sel.pos.x, f.pos.z - G.sel.pos.z) < 20);
  if (near) { UI.float('附近有敵人，沒辦法休息', new V3(G.sel.pos.x, 2.3, G.sel.pos.z), '#ddd', true); return; }
  const ok = await UI.modal('<h2>營火</h2><p>在營火旁休息一會兒？全隊會回滿生命、法術位和技能次數。</p>', [{ t: '休息', v: true }, { t: '不用了', v: false }]);
  if (!ok) return;
  G.mode = 'busy';
  await fadeTo(1, 900);
  for (const h of G.party) { h.hp = h.maxHp; h.downed = false; h.slots = h.slotsMax; for (const id of h.abil) if (AB[id].uses) h.uses[id] = AB[id].uses; }
  G.refresh();
  UI.caption('你們在營火邊休息。木柴劈啪作響，溪上的霧在遠處慢慢流動。', 3000);
  await wait(1600);
  await fadeTo(0, 900);
  UI.log('全隊休息完畢：生命、法術位與技能次數都恢復了。', 'heal');
  sfx('heal');
  G.mode = 'explore'; save();
}
async function takeLantern() {
  if (G.groups.ruin === 'idle' || G.groups.ruin === 'hostile') { const p = byId.priest; if (!p.dead) return; }
  const it = G.inter.lantern; it.done = true;
  W.lantern.g.visible = false;
  const l = W.lights.find((x) => x.L === W.lantern.light); if (l) l.base = 0; W.lantern.light.intensity = 0;
  G.flags.hasLantern = 1;
  play(G.sel, 'raise', 1, null);
  sfx('holy'); fx.holy(new V3(it.pos.x, 0, it.pos.z - 1.3));
  G.mode = 'busy';
  await UI.caption('你們拿起了晨星燈。燈芯裡的光暖暖的，好像有很小很小的心跳。', 3400);
  if (G.flags.truth) await UI.caption('……也好像有人在小聲地哭。', 2600);
  G.mode = 'explore';
  UI.questMark(byId.elder, true);
  updateQuest(); save();
}

// ---------------------------------------------------------------------------
// dialogue
const S = {
  f: G.flags,
  gold: (n) => { G.gold += n; UI.log(n > 0 ? `獲得 ${n} 金幣。` : `付出 ${-n} 金幣。`, 'sys'); sfx('coin'); G.refresh(); },
  goldNow: () => G.gold,
  price: () => (G.flags.discount ? 15 : 25),
  buy: (n) => { G.gold -= n * S.price(); G.potions += n; sfx('coin'); UI.log(`買了 ${n} 瓶治療藥水。`, 'sys'); G.refresh(); },
  potions: () => G.potions,
  usePotion: () => { G.potions--; G.refresh(); },
  xp: (n) => { UI.log(`全隊獲得 ${n} 點經驗。`, 'sys'); CB.gainXp(G, n); G.refresh(); },
  tried: (k) => G.tried.has(k),
};
async function talk(id) {
  const D = DLG[id]; if (!D) return null;
  const spk = byId[D.who];
  G.mode = 'dialog'; G.stopAll(); G.pending = null; UI.hideTip(); clearPreview();
  const L = G.sel;
  if (spk && L) {
    if (!spk.dead) spk.yawTarget = spk.anim.pose === 'sit' ? spk.yaw : Math.atan2(L.pos.x - spk.pos.x, L.pos.z - spk.pos.z);
    L.yawTarget = Math.atan2(spk.pos.x - L.pos.x, spk.pos.z - L.pos.z);
  }
  const saved = { dist: cam.dist, follow: cam.follow };
  if (spk) {
    // frame the speaker over the leader's shoulder, in the upper half of the screen
    const mx = (spk.pos.x + L.pos.x) / 2, mz = (spk.pos.z + L.pos.z) / 2;
    cam.yaw = Math.atan2(L.pos.x - spk.pos.x, L.pos.z - spk.pos.z) + 0.5;
    cam.tgt.set(mx + Math.sin(cam.yaw) * 1.2, 0, mz + Math.cos(cam.yaw) * 1.2); cam.dist = 7.5; cam.follow = false; cam.dlg = true;
  }
  document.body.classList.add('talking');
  let node = D.entry(S), result = null;
  while (node) {
    const N = D.nodes[node];
    if (!N) break;
    N.do?.(S);
    const text = typeof N.t === 'function' ? N.t(S) : N.t;
    const opts = N.o.filter((o) => (!o.if || o.if(S)) && !(o.check && G.tried.has(id + ':' + o.ok)));
    const shown = opts.map((o) => ({ t: typeof o.t === 'function' ? o.t(S) : o.t, tag: o.check ? `${SKILLS[o.check[0]][0]} DC ${o.check[1]}` : '', cls: o.check ? SK_CLS[o.check[0]] : '' }));
    const i = await UI.dialogLine(spk ? spk.name : '', spk ? spk.role || '' : '', spk?.portrait, text, shown);
    const o = opts[i];
    o.do?.(S);
    if (o.check) {
      G.tried.add(id + ':' + o.ok);
      const [sk, dc] = o.check;
      let best = null, bb = -99;
      for (const h of G.party) { const b = skillBonus(h, sk); if (b > bb) { bb = b; best = h; } }
      const r = await UI.rollDice(`${SKILLS[sk][0]}檢定`, `由${best.name}擲骰（${SKILLS[sk][0]} ${sgn(bb)}）`, bb, dc);
      UI.log(`${best.name} 的${SKILLS[sk][0]}檢定：🎲${r.roll}${sgn(bb)}=${r.total} vs DC ${dc} → ${r.ok ? '成功' : '失敗'}`, r.ok ? 'heal' : 'miss');
      node = r.ok ? o.ok : o.fail; continue;
    }
    if (o.ret) { result = o.ret; break; }
    if (o.end) break;
    node = o.go || null;
  }
  UI.dialogShow(false);
  document.body.classList.remove('talking');
  cam.dist = saved.dist; cam.follow = true; cam.dlg = false;
  G.mode = 'explore';
  G.refresh();
  await afterTalk(id, result);
  return result;
}
async function afterTalk(id, res) {
  if (id === 'elder' && res === 'quest') { G.flags.quest = 1; UI.questMark(byId.elder, false); if (!G.flags.tomDone) UI.questMark(byId.tom, true); }
  if (id === 'elder' && res && res.startsWith('end')) return runEnding(res);
  if (id === 'tom') {
    if (res === 'tomLeave') {
      UI.questMark(byId.tom, false);
      const t = byId.tom; t.anim.pose = null;
      const p = nav.find(t.pos.x, t.pos.z, -0.6, 12.6);
      if (p) G.walk(t, p, 2.2).then(() => { t.yawTarget = Math.PI * 0.1; t.homeYaw = t.yawTarget; });
    }
  }
  if (id === 'grukk' || id === 'grukkPeace') {
    if (res === 'fight') { G.groups.camp = 'hostile'; await CB.startCombat(G, groupFoes('camp')); }
    else if (res === 'flee') flee('camp');
    else if (res === 'peace') G.groups.camp = 'peace';
    else if (id === 'grukk') G.groups.camp = 'hostile';
  }
  if (id === 'moross') {
    if (res === 'fight' || res === 'surprise') { G.groups.ruin = 'hostile'; await CB.startCombat(G, groupFoes('ruin'), { surprise: res === 'surprise' }); }
    else if (res === 'peace') makePeace();
    else G.groups.ruin = 'hostile';
  }
  updateQuest(); save();
}
function makePeace() {
  G.groups.ruin = 'peace';
  for (const f of G.foes) if (f.group === 'ruin' && f.type === 'skeleton' && !f.dead) { f.dead = true; f.anim.act = null; G.removeBody(f); }
  const p = byId.priest; p.team = 'npc'; p.talk = 'morossPeace'; p.showName = false;
}
const groupFoes = (g) => G.foes.filter((f) => f.group === g && !f.dead && !f.gone);
function flee(g) {
  G.groups[g] = 'fled';
  for (const f of groupFoes(g)) {
    f.gone = true; f.showName = false;
    const p = nav.find(f.pos.x, f.pos.z, -28, f.pos.z - 6) || [];
    G.walk(f, cutPath(f.pos, p, 22), 5).then(() => { f.root.visible = false; });
    setTimeout(() => { f.root.visible = false; }, 7000);
  }
}

// ---------------------------------------------------------------------------
// quest log, triggers, aggro
function updateQuest() {
  const f = G.flags;
  if (f.ended) UI.quest('冒險結束', '你可以繼續在村子裡逛逛。');
  else if (!f.quest) UI.quest('和村長赫姆談談', '他在村子廣場的北邊，頭上有「!」。');
  else if (!f.hasLantern) UI.quest('到北方的舊祠堂奪回晨星燈', [f.tomHint ? '托姆說：營地頭目格魯克很怕灰袍祭司。' : '過了溪往北走，穿過樹林。', f.knowBraziers ? '藍色火盆撐著骷髏兵，踢翻它們！' : ''].filter(Boolean).join(' '));
  else UI.quest('把晨星燈帶回去交給赫姆村長', f.truth ? '你們已經知道燈裡藏著什麼了。' : '');
}
const TRIG = [
  { id: 'bridge', test: (p) => p.z < -1.5, line: '薇拉：「霧……在動。好像有人在霧裡看著我們。」' },
  { id: 'forest', test: (p) => p.z < -9, line: '凱爾：「地上有腳印，很多小小的腳印，都往西北邊去了。」' },
  { id: 'camp', test: (p) => Math.hypot(p.x + 14, p.z + 22) < 19, line: '歐林：「前面有火光，還有哥布林的臭味。要打還是要談，你們決定。」', if: () => G.groups.camp === 'idle' },
  { id: 'ruins', test: (p) => p.z < -32, line: '瑟拉：「我感覺得到，亡者就在附近……晨曦女神保佑我們。」' },
];
function checkTriggers() {
  const L = G.sel; if (!L) return;
  for (const t of TRIG) {
    if (G.flags['trig_' + t.id] || (t.if && !t.if())) continue;
    if (G.party.some((h) => t.test(h.pos))) { G.flags['trig_' + t.id] = 1; UI.caption(t.line, 3600); UI.log(t.line); }
  }
  // hidden chest
  const ch = G.inter.campChest;
  if (ch.hidden && !ch.checked) {
    const near = G.party.some((h) => CB.dist(h, ch) < 6);
    if (near) {
      ch.checked = true;
      let best = G.party[0], bb = -9; for (const h of G.party) { const b = skillBonus(h, 'perception'); if (b > bb) { bb = b; best = h; } }
      if (10 + bb >= 13) { ch.hidden = false; ch.obj.visible = true; UI.float('發現了什麼！', new V3(best.pos.x, best.pos.y + 2.3, best.pos.z), '#ffe27a'); UI.log(`${best.name}（被動察覺 ${10 + bb}）發現帳篷後面有一個半埋的箱子。`, 'sys'); sfx('magic'); }
    }
  }
  // aggro
  for (const [g, def] of Object.entries(GROUPS)) {
    const st = G.groups[g];
    if (st !== 'idle' && st !== 'hostile') continue;
    const m = groupFoes(g); if (!m.length) continue;
    const near = G.party.some((h) => !h.downed && m.some((f) => CB.dist(h, f) < def.aggro));
    if (!near) continue;
    if (st === 'idle' && def.talk) { talk(def.talk); return; }
    if (g === 'wolves') { UI.caption('灰狼從樹叢裡竄了出來！', 2400); sfx('growl'); }
    CB.startCombat(G, m, { ambush: def.ambush });
    return;
  }
}

// ---------------------------------------------------------------------------
// hover, preview, input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new V3(0, 1, 0), 0);
const mouse = { x: 0, y: 0, in: false };
function pick(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const objs = proxies.filter((p) => {
    const a = p.userData.actor; if (a) return a.root.visible && !a.gone && !(a.team === 'foe' && a.dead);
    const it = p.userData.inter; return it && !it.hidden && !it.done;
  });
  const hits = ray.intersectObjects(objs, false);
  const r = { actor: null, inter: null, point: null };
  if (hits.length) { r.actor = hits[0].object.userData.actor || null; r.inter = hits[0].object.userData.inter || null; }
  const p = new V3(); if (ray.ray.intersectPlane(groundPlane, p)) r.point = p;
  return r;
}
// path preview dots
const DOTS = 260;
const dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.075, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false }), DOTS);
dots.count = 0; dots.frustumCulled = false; dots.renderOrder = 3; scene.add(dots);
const aoe = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
const aoeFill = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false }));
aoe.add(aoeFill); aoe.visible = false; scene.add(aoe);
let previewKey = '';
function clearPreview() { dots.count = 0; aoe.visible = false; previewKey = ''; }
function showPath(from, pts, budget) {
  const m = new THREE.Matrix4(), c = new THREE.Color(); let k = 0, L = 0, p = from;
  for (const q of pts) {
    const s = Math.hypot(q.x - p.x, q.z - p.z), n = Math.max(1, Math.round(s / 0.35));
    for (let i = 1; i <= n && k < DOTS; i++) {
      const x = p.x + (q.x - p.x) * i / n, z = p.z + (q.z - p.z) * i / n; L += s / n;
      m.makeTranslation(x, groundY(x, z) + 0.06, z); dots.setMatrixAt(k, m); dots.setColorAt(k, c.set(L <= budget + 0.01 ? '#7ec8ff' : '#ff6a5a')); k++;
    }
    p = q;
  }
  dots.count = k; dots.instanceMatrix.needsUpdate = true; if (dots.instanceColor) dots.instanceColor.needsUpdate = true;
}
function updateHover() {
  if (!mouse.in || !['explore', 'combat'].includes(G.mode) || UI.modalOpen()) { G.hover = null; UI.hideTip(); clearPreview(); canvas.style.cursor = ''; return; }
  const H = pick(mouse.x, mouse.y);
  G.hover = H;
  const C = G.combat, A = C?.active?.team === 'party' ? C.active : null, h = C ? A : G.sel;
  let html = '', cur = '';
  const t = H.actor;
  for (const f of G.foes) f.hoverName = false;
  if (t) {
    t.hoverName = true;
    if (t.team === 'foe' && !t.dead && G.groups[t.group] !== 'peace') {
      cur = 'crosshair';
      html = `<b>${t.name}</b>　生命 ${t.hp}/${t.maxHp}　AC ${CB.acOf(t)}${t.markedBy ? '　🎯' : ''}`;
      if (C && A) {
        const id = G.pending && AB[G.pending].target === 'foe' ? G.pending : defaultAb(A);
        const pc = CB.hitChance(G, A, t, id);
        html += `<br>${AB[id].icon} ${AB[id].name}：<span class="pc2">${pc != null ? Math.round(pc * 100) + '% ' + (AB[id].kind.startsWith('save') ? '失敗率' : '命中') : ''}</span>　傷害 ${CB.dmgText(A, id)}`;
        if (CB.attackAdv(G, A, AB[id].kind === 'spell' ? 'spell' : 'weapon') < 0 && (AB[id].kind === 'spell' || A.weapon.ranged)) html += '<br><span class="bad">身邊有敵人：劣勢</span>';
        const reach = CB.reachOf(A, id);
        if (CB.dist(A, t) > reach + 0.15) {
          const key = 'a' + t.id + A.pos.x.toFixed(1) + A.pos.z.toFixed(1);
          if (previewKey !== key) { previewKey = key; const plan = planApproach(A, t, reach - 0.25); A._plan = plan; if (plan) showPath(A.pos, plan.pts, A.budget.move); else clearPreview(); }
          const plan = A._plan;
          html += plan && plan.cost <= A.budget.move + 0.01 ? `<br>需要先移動 ${plan.cost.toFixed(1)} 公尺` : '<br><span class="bad">太遠了，這回合打不到</span>';
        } else clearPreview();
      } else if (!C) html += G.groups[t.group] === 'idle' ? '<br>靠近時對方會先開口' : '<br>點擊：先發制人';
    } else if (t.team === 'foe' && G.groups[t.group] === 'peace') { html = `<b>${t.name}</b><br>對話`; cur = 'pointer'; clearPreview(); }
    else if (t.team === 'party') {
      html = `<b>${t.name}</b>　${t.cls}　生命 ${t.hp}/${t.maxHp}　AC ${CB.acOf(t)}${t.downed ? '<br><span class="bad">倒地</span>' : ''}`;
      if (G.pending && ['ally', 'downed'].includes(AB[G.pending].target)) { html += `<br>${AB[G.pending].icon} ${AB[G.pending].name}`; cur = 'pointer'; }
      clearPreview();
    } else if (t.team === 'npc') { html = `<b>${t.name}</b>　${t.role || ''}<br>對話`; cur = 'pointer'; clearPreview(); }
  } else if (H.inter) {
    html = `<b>${H.inter.name}</b><br>${H.inter.hint}${C && H.inter.brazier ? '（用掉動作）' : ''}`; cur = 'pointer'; clearPreview();
  } else if (H.point && C && A) {
    if (G.pending && AB[G.pending].target === 'area') {
      const ab = AB[G.pending], ok = Math.hypot(H.point.x - A.pos.x, H.point.z - A.pos.z) <= ab.range;
      aoe.visible = true; aoe.position.set(H.point.x, 0.08, H.point.z); aoe.scale.setScalar(ab.radius);
      aoe.material.color.set(ok ? '#9fd0ff' : '#ff6a5a'); aoeFill.material.color.set(ok ? '#9fd0ff' : '#ff6a5a'); dots.count = 0;
      const n = CB.liveFoes(G).filter((o) => Math.hypot(o.pos.x - H.point.x, o.pos.z - H.point.z) <= ab.radius + 0.3).length;
      html = `${ab.icon} ${ab.name}：範圍內 ${n} 個敵人${ok ? '' : '<br><span class="bad">超出射程</span>'}`;
      cur = 'crosshair';
    } else if (!C.busy) {
      aoe.visible = false;
      const key = 'm' + H.point.x.toFixed(1) + H.point.z.toFixed(1) + A.pos.x.toFixed(1);
      if (previewKey !== key) { previewKey = key; const plan = planMove(A, H.point); A._mplan = plan; if (plan) showPath(A.pos, plan.pts, A.budget.move); else clearPreview(); }
      const plan = A._mplan;
      if (plan) html = `移動 ${plan.cost.toFixed(1)} 公尺${plan.cost > A.budget.move + 0.01 ? `<br><span class="bad">超過剩下的 ${A.budget.move.toFixed(1)} 公尺，只會走到藍色的地方</span>` : ''}`;
    }
  } else { clearPreview(); }
  if (html) UI.tip(html, mouse.x, mouse.y); else UI.hideTip();
  canvas.style.cursor = cur;
}
const defaultAb = (h) => { const d0 = DEFAULT_AB[h.id]; return G.cannot(h, d0) && !G.cannot(h, 'attack') ? 'attack' : d0; };

async function click(x, y) {
  if (UI.modalOpen()) return;
  const H = pick(x, y);
  if (G.mode === 'combat') return combatClick(H);
  if (G.mode !== 'explore') return;
  const t = H.actor;
  if (t) {
    if (t.team === 'party') {
      if (G.pending && ['ally', 'downed'].includes(AB[G.pending].target)) return exploreAbility(G.sel, G.pending, t);
      sfx('click'); return G.select(t);
    }
    if (t.team === 'npc') { sfx('click'); return goTo(t, 2.6, () => talk(t.talk)); }
    if (t.team === 'foe' && !t.dead) {
      const st = G.groups[t.group];
      if (st === 'peace') return goTo(t, 2.8, () => talk(t.group === 'camp' ? 'grukkPeace' : 'morossPeace'));
      if (st === 'idle' && GROUPS[t.group].talk) return partyMove(t.pos, GROUPS[t.group].aggro - 1.5);
      sfx('click');
      return CB.startCombat(G, groupFoes(t.group), { surprise: true });
    }
  }
  if (H.inter) { sfx('click'); return interact(H.inter); }
  if (H.point) { G.pending = null; G.refresh(); partyMove(H.point); }
}
let lastTap = null;
async function combatClick(H) {
  const C = G.combat, A = C.active;
  if (!A || A.team !== 'party' || C.busy) return;
  if (isTouch) { const k = H.actor ? 'a' + (H.actor.id || '') : H.inter ? 'i' + H.inter.key : H.point ? 'p' + Math.round(H.point.x * 2) + ',' + Math.round(H.point.z * 2) : ''; if (lastTap !== k) { lastTap = k; mouse.in = true; updateHover(); return; } lastTap = null; }
  const id = G.pending, t = H.actor;
  if (t && t.team === 'foe' && !t.dead && G.groups[t.group] !== 'peace') {
    if (id && AB[id].target === 'area') return areaCast(A, id, t.pos);
    const ab = id && AB[id].target === 'foe' ? id : defaultAb(A);
    return combatTarget(A, ab, t);
  }
  if (t && t.team === 'party') {
    if (id && ['ally', 'downed'].includes(AB[id].target)) return combatTarget(A, id, t);
    G.focus(t.pos); return;
  }
  if (H.inter) return combatInteract(H.inter);
  if (H.point) {
    if (id && AB[id].target === 'area') return areaCast(A, id, H.point);
    if (id) { G.pending = null; G.refresh(); return; }
    const plan = planMove(A, H.point);
    if (!plan || A.budget.move < 0.3) { UI.float(A.budget.move < 0.3 ? '沒有移動距離了' : '到不了', new V3(H.point.x, 0.5, H.point.z), '#ddd', true); return; }
    const pts = cutPath(A.pos, plan.pts, A.budget.move);
    const cost = pathLen(A.pos, pts);
    await combatAct(async () => { A.budget.move = Math.max(0, A.budget.move - cost); G.refresh(); await G.walk(A, pts, 3.8); });
  }
}
async function areaCast(A, id, p) {
  const ab = AB[id];
  if (Math.hypot(p.x - A.pos.x, p.z - A.pos.z) > ab.range) { UI.float('超出射程', new V3(p.x, 0.6, p.z), '#ddd', true); return; }
  const why = G.cannot(A, id); if (why) return;
  await combatAct(() => CB.useAbility(G, A, id, null, new V3(p.x, 0, p.z)));
}

const ptrs = new Map(); let pinch = null;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, b: e.button, moved: false, type: e.pointerType });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), dist0: cam.dist, yaw0: cam.yaw }; for (const p of ptrs.values()) p.moved = true; }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.in = true; }
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (Math.hypot(p.x - p.x0, p.y - p.y0) > 7) p.moved = true;
  if (!p.moved) return;
  if (ptrs.size === 2 && pinch) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    cam.dist = clamp(pinch.dist0 * (pinch.d / Math.max(20, d)), 7, 32); cam.yaw = pinch.yaw0 - (ang - pinch.ang);
    return;
  }
  if (p.b === 2 || p.b === 1) { cam.yaw -= dx * 0.006; return; }
  if (['explore', 'combat'].includes(G.mode)) {
    const k = cam.distCur * 0.0016;
    const fwd = new V3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), right = new V3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    cam.tgt.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k * 1.3); cam.follow = false;
  }
});
const up = (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (p.moved) return;
  if (p.b === 0) { if (p.type !== 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; } click(e.clientX, e.clientY); }
  if (p.b === 2) { if (G.pending) { G.pending = null; G.refresh(); clearPreview(); } }
};
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); pinch = null; });
canvas.addEventListener('pointerleave', () => { mouse.in = false; });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 7, 32); }, { passive: false });
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'f5' || k === 'f9') e.preventDefault();
  if (UI.dialogKey(e.key)) return;
  if (UI.modalOpen()) return;
  keys.add(k);
  if (G.mode === 'title') return;
  if (/^[1-6]$/.test(k)) { const h = G.combat ? G.combat.active : G.sel; if (h && h.team === 'party') { const id = h.abil[+k - 1]; if (id) G.pickAbility(id); } }
  if (k === ' ' || k === 'enter') { e.preventDefault(); G.endTurn(); }
  if (k === 'escape') { if (G.pending) { G.pending = null; G.refresh(); clearPreview(); } else menu(); }
  if (k === 'home' || k === 'c') { cam.follow = true; if (G.combat?.active) G.focus(G.combat.active.pos); else if (G.sel) cam.tgt.set(G.sel.pos.x, 0, G.sel.pos.z); }
  if (k === 'tab') { e.preventDefault(); if (G.mode === 'explore') { const i = G.party.indexOf(G.sel); G.select(G.party[(i + 1) % G.party.length]); } }
  if (k === 'f5' && G.mode === 'explore') { save(); UI.banner('已存檔'); }
  if (k === 'f9') loadAndReload();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
document.querySelectorAll('#campad button').forEach((b) => (b.onclick = () => {
  const c = b.dataset.c; sfx('click');
  if (c === 'rl') cam.yaw += 0.5; if (c === 'rr') cam.yaw -= 0.5;
  if (c === 'home') { cam.follow = true; if (G.combat?.active) G.focus(G.combat.active.pos); else if (G.sel) cam.tgt.set(G.sel.pos.x, 0, G.sel.pos.z); }
}));
$('#b-menu').onclick = () => menu();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  composer?.setSize(innerWidth, innerHeight); fx.setScale(innerHeight * renderer.getPixelRatio(), camera.fov);
});
fx.setScale(innerHeight * renderer.getPixelRatio(), camera.fov);

// ---------------------------------------------------------------------------
// save / load
function save() {
  if (G.combat || G.flags.ended === 'over') return;
  const data = {
    v: 1, flags: G.flags, gold: G.gold, potions: G.potions, tried: [...G.tried], groups: G.groups, sel: G.sel?.id,
    heroes: G.party.map((h) => ({ id: h.id, hp: h.hp, maxHp: h.maxHp, level: h.level, xp: h.xp, slots: h.slots, slotsMax: h.slotsMax, uses: h.uses, acBonus: h.acBonus, spellPlus: h.spellPlus, x: h.pos.x, z: h.pos.z })),
    foes: G.foes.filter((f) => !f.summoned).map((f) => ({ id: f.id, hp: f.hp, dead: !!f.dead, gone: !!f.gone, looted: !!f.looted })),
    inter: Object.fromEntries(Object.entries(G.inter).map(([k, i]) => [k, { done: !!i.done, hidden: !!i.hidden, checked: !!i.checked }])),
    tom: { x: byId.tom.pos.x, z: byId.tom.pos.z, sit: byId.tom.anim.pose === 'sit' },
  };
  store.set(SAVE, JSON.stringify(data));
}
function load(data) {
  Object.assign(G.flags, data.flags); G.gold = data.gold; G.potions = data.potions; G.tried = new Set(data.tried); Object.assign(G.groups, data.groups);
  for (const s of data.heroes) { const h = hero(s.id); if (!h) continue; Object.assign(h, { hp: s.hp, maxHp: s.maxHp, level: s.level, xp: s.xp, slots: s.slots, slotsMax: s.slotsMax, uses: s.uses, acBonus: s.acBonus, spellPlus: s.spellPlus }); h.pos.set(s.x, groundY(s.x, s.z), s.z); h.downed = false; if (h.hp <= 0) h.hp = 1; }
  for (const s of data.foes) { const f = byId[s.id]; if (!f) continue; f.hp = s.hp; f.looted = s.looted; if (s.dead || s.gone) { f.dead = s.dead; f.gone = s.gone; f.root.visible = false; } }
  for (const [k, s] of Object.entries(data.inter)) {
    const it = G.inter[k]; if (!it) continue;
    it.hidden = s.hidden; it.checked = s.checked; if (it.obj) it.obj.visible = !s.hidden;
    if (s.done) {
      it.done = true;
      if (it.chest) it.lid.rotation.x = -1.2;
      if (it.brazier) { it.lit = false; it.em.off = true; it.light.base = 0; it.light.L.intensity = 0; it.coal.material.emissiveIntensity = 0; it.g.rotation.z = 1.2; it.g.position.y = 0.25; }
      if (k === 'lantern') { W.lantern.g.visible = false; const l = W.lights.find((x) => x.L === W.lantern.light); if (l) l.base = 0; }
    }
  }
  if (G.groups.ruin === 'peace') makePeace();
  const t = byId.tom; t.pos.set(data.tom.x, 0, data.tom.z); t.anim.pose = data.tom.sit ? 'sit' : null; if (!data.tom.sit) { t.yaw = t.yawTarget = t.homeYaw = Math.PI * 0.1; }
  G.sel = hero(data.sel) || G.party[0];
  UI.questMark(byId.elder, !G.flags.quest || (G.flags.hasLantern && !G.flags.ended));
  UI.questMark(byId.tom, !!G.flags.quest && !G.flags.tomDone);
  cam.tgt.set(G.sel.pos.x, 0, G.sel.pos.z); cam.cur.copy(cam.tgt);
  updateQuest();
}
function loadAndReload() {
  if (!store.get(SAVE)) { UI.banner('沒有存檔'); return; }
  try { sessionStorage.setItem('mb-autoload', '1'); } catch {}
  location.reload();
}

// ---------------------------------------------------------------------------
// menus, intro, ending, game over
const HELP = `<h2>怎麼玩</h2><ul>
<li>點地面：整個隊伍一起移動（目前選中的角色帶頭）。</li>
<li>點左上角的頭像或按 Tab：換帶頭的人。</li>
<li>點人物可以對話；點箱子、營火、火盆可以互動。</li>
<li>右鍵拖曳或 Q／E：轉動鏡頭。滾輪：縮放。WASD 或左鍵拖曳：移動鏡頭。Home：回到隊伍。</li></ul>
<h2>戰鬥</h2><ul>
<li>大家依照「先攻」順序輪流行動，畫面上方會顯示順序。</li>
<li>每個回合有一段移動距離、一個「動作」（綠色圓點）和一個「附贈動作」（橘色菱形）。</li>
<li>攻擊時擲一顆二十面骰（d20），加上加值，只要大於或等於對方的防禦值（AC）就打中。擲出 20 是暴擊，傷害骰加倍；擲出 1 一定落空。</li>
<li>把滑鼠移到敵人身上，會顯示命中率和傷害。敵人太遠時，點下去角色會自己走過去再攻擊。</li>
<li>用弓或法術時，如果有敵人貼在你旁邊，就會「劣勢」：擲兩顆骰子取比較小的。</li>
<li>同伴倒下時，可以用「扶起」、藥水或治療救他。戰鬥結束後，倒地的人會自己醒過來。</li>
<li>按「結束回合」或空白鍵，換下一個人行動。數字鍵 1–6 選技能，右鍵或 Esc 取消。</li></ul>
<h2>對話與檢定</h2><ul>
<li>有些選項前面有標籤，例如「說服 DC 13」。選了就要擲骰：d20 加上隊伍裡最擅長的人的技能加值，大於等於 DC 就成功。每個檢定只能試一次。</li>
<li>不是每一場仗都非打不可。說對了話，可以少打好幾場。</li></ul>
<h2>休息與存檔</h2><ul>
<li>到村子廣場旁的營火休息，可以回滿生命、法術位和技能次數。</li>
<li>遊戲會自動存檔，也可以在選單裡存檔，或按 F5 存檔、F9 讀檔。</li></ul>`;
async function menu() {
  if (G.mode === 'title' || G.mode === 'cine') return;
  const v = await UI.modal(`<h2>選單</h2>
    <label>音量 <input type="range" id="m-vol" min="0" max="1" step="0.05" value="${AU.vol}"></label>
    <label>音樂 <input type="range" id="m-mus" min="0" max="1" step="0.05" value="${AU.music}"></label>
    <label>畫質（重新載入後生效） <select id="m-q"><option value="high">高</option><option value="med">中</option><option value="low">低</option></select></label>`,
  [{ t: '繼續', v: null }, { t: '存檔', v: 'save' }, { t: '讀取存檔', v: 'load' }, { t: '怎麼玩', v: 'help' }, { t: '回到遊戲場', v: 'hub' }]);
  if (v === 'save') { if (G.combat) UI.banner('戰鬥中不能存檔'); else { save(); UI.banner('已存檔'); } }
  if (v === 'load') loadAndReload();
  if (v === 'help') await UI.modal(HELP, [{ t: '知道了', v: null }]);
  if (v === 'hub') location.href = '/';
}
document.addEventListener('input', (e) => {
  if (e.target.id === 'm-vol' || e.target.id === 'm-mus') { setVol(+$('#m-vol').value, +$('#m-mus').value); store.set('mb-vol', JSON.stringify([AU.vol, AU.music])); }
});
document.addEventListener('change', (e) => { if (e.target.id === 'm-q' || e.target.id === 'quality') { store.set('mb-q', e.target.value); if (e.target.id === 'm-q') location.reload(); else location.reload(); } });
document.addEventListener('click', (e) => { if (e.target.id === 'm-q') e.target.value = Q; });
try { const v = JSON.parse(store.get('mb-vol')); if (v) setVol(v[0], v[1]); } catch {}

async function intro() {
  G.mode = 'cine'; UI.cine(true);
  cam.follow = false; cam.tgt.set(0, 0, 4); cam.cur.set(0, 0, 4); cam.yaw = 2.4; cam.dist = 15; cam.distCur = 15; cam.auto = 0.06;
  await wait(600);
  await UI.caption('霧溪村，黃昏。', 2600);
  await UI.caption('三天前，有人從溪北的舊祠堂偷走了晨星燈。', 3200);
  await UI.caption('沒有那盞燈，溪上的霧每晚都漲得更高。而霧裡，有東西在走動。', 3800);
  cam.auto = 0; cam.yaw = 0.35; cam.dist = 16; cam.tgt.set(SPOTS.start[0], 0, SPOTS.start[1] - 3);
  await UI.caption('你們四個人，是村長花光積蓄請來的冒險者。', 3000);
  UI.cine(false);
  G.mode = 'explore'; G.select(G.party[0]);
  UI.questMark(byId.elder, true); updateQuest();
  UI.log('點地面移動。點頭上有「!」的村長，和他說話。', 'sys');
  UI.log('按 ☰ 或 Esc 打開選單，裡面有「怎麼玩」。', 'sys');
  save();
}
function startPlay() {
  $('#title').classList.add('gone'); setTimeout(() => ($('#title').hidden = true), 1000);
  $('#hud').hidden = false; cam.auto = 0;
  if (innerHeight > innerWidth) cam.dist = 23;
  G.refresh();
}
$('#b-new').onclick = () => { initAudio(); sfx('click'); store.del(SAVE); startPlay(); intro(); };
$('#b-cont').hidden = !store.get(SAVE);
$('#b-cont').onclick = () => { initAudio(); sfx('click'); try { load(JSON.parse(store.get(SAVE))); } catch (e) { console.error(e); } startPlay(); G.mode = 'explore'; G.select(G.sel); UI.log('讀取了存檔。', 'sys'); };

let night = 0, nightTarget = 0;
const orbs = [];
async function runEnding(kind) {
  G.flags.ended = kind; updateQuest();
  const E = ENDINGS[kind](G.flags);
  G.mode = 'cine'; UI.cine(true); G.stopAll();
  await fadeTo(1, 1000);
  nightTarget = 1;
  cam.follow = false; cam.tgt.set(0, 0, 4.2); cam.cur.copy(cam.tgt); cam.yaw = Math.PI - 0.35; cam.dist = 12; cam.distCur = 12; cam.auto = 0.025;
  UI.questMark(byId.elder, false); UI.questMark(byId.tom, false);
  G.party.forEach((h, i) => { h.pos.set(-2.5 + i * 1.6, 0, 6.2); h.yaw = h.yawTarget = Math.PI; });
  const el = byId.elder; el.pos.set(3.2, 0, 6.6); el.yaw = el.yawTarget = Math.PI;
  if (G.groups.ruin === 'peace' && kind === 'endB') { const p = byId.priest; p.pos.set(4.5, 0, 7.2); p.yaw = p.yawTarget = Math.PI; }
  if (E.mist) for (let x = -30; x <= 30; x += 2) fx.emitters.push({ kind: 'mist', x, y: 0.6, z: STREAM.z + (Math.random() - 0.5) * 6, rate: 1.2, color: '#d8e4ec' });
  await fadeTo(0, 1200);
  if (E.orbs) {
    for (const e of fx.emitters) if (e.kind === 'mist') e.off = true;
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.4, 2.2), toneMapped: false }));
      scene.add(m); orbs.push({ m, t: -i * 0.6, a: (i / 5) * Math.PI * 2 });
    }
    sfx('holy');
  }
  for (const l of E.lines) await UI.caption(l, 4000);
  if (kind === 'endA') G.gold += 150;
  const lv = G.party[0].level;
  const v = await UI.modal(`<h2>${E.title}</h2>${E.lines.map((l) => `<p>${l}</p>`).join('')}<p style="color:#a99c84;text-align:center">隊伍等級 ${lv}　金幣 ${G.gold}　${G.flags.truth ? '你們知道了燈的秘密' : '有些秘密，你們沒有發現'}</p>`,
    [{ t: '再玩一次', v: 'again' }, { t: '留在村子裡', v: 'stay' }, { t: '回到遊戲場', v: 'hub' }]);
  if (v === 'again') { store.del(SAVE); location.reload(); return; }
  if (v === 'hub') { location.href = '/'; return; }
  UI.cine(false); cam.auto = 0; G.mode = 'explore'; G.select(G.party[0]); save();
}
G.gameOver = async () => {
  G.mode = 'over'; musicMode('explore');
  await wait(1200);
  const has = !!store.get(SAVE);
  const v = await UI.modal('<h2>全隊倒下</h2><p style="text-align:center">……那天晚上，霧溪的霧又漲高了一點。</p>', [...(has ? [{ t: '讀取存檔', v: 'load' }] : []), { t: '重新開始', v: 'new' }]);
  if (v === 'load') loadAndReload(); else { store.del(SAVE); location.reload(); }
};

// ---------------------------------------------------------------------------
// main loop
const clock = new THREE.Clock();
let hoverT = 0, trigT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(G.dtMax || 0.05, clock.getDelta()), t = clock.elapsedTime;
  if (W.uT) W.uT.value = t;
  W.anim = W.anim.filter((f) => !f(t));
  for (const l of W.lights) l.L.intensity = l.base * (1 + (Math.sin(t * 13 + l.base) * 0.5 + Math.sin(t * 23.7) * 0.5) * l.flick);
  updateMovers(dt);
  for (const a of G.actors) if (a.root.visible) animate(a, dt, t);
  // rings
  const C = G.combat;
  for (const a of G.actors) {
    let op = 0;
    if (a.team === 'party') op = a.downed ? 0.25 : a === (C ? C.active : G.sel) ? 0.75 + Math.sin(t * 5) * 0.2 : 0.4;
    else if (a.team === 'foe') op = a.dead || a.gone || G.groups[a.group] === 'peace' ? 0 : a === G.hover?.actor ? 0.95 : C ? (a === C.active ? 0.8 + Math.sin(t * 5) * 0.2 : 0.45) : 0;
    else if (a === G.hover?.actor) op = 0.7;
    a.ring.material.opacity = op;
    a.showName = (a.team === 'foe' && C && !a.dead && !a.gone && G.groups[a.group] !== 'peace') || a.hoverName || (a.team === 'npc' && a === G.hover?.actor);
    a.hoverName = false;
  }
  // npcs look at the leader
  if (G.mode === 'explore' && G.sel) for (const n of G.npcs) {
    if (n.path || n.anim.pose === 'sit') continue;
    const dd = CB.dist(n, G.sel);
    n.yawTarget = dd < 5 ? Math.atan2(G.sel.pos.x - n.pos.x, G.sel.pos.z - n.pos.z) : n.homeYaw;
  }
  if (markT > 0) { markT -= dt; mark.material.opacity = Math.max(0, markT); mark.scale.setScalar(1 + (0.8 - markT)); }
  // night transition for endings
  night += (nightTarget - night) * Math.min(1, dt * 0.6);
  if (night > 0.001) {
    hemi.intensity = LIGHT0.hemi * (1 - night * 0.45); sun.intensity = LIGHT0.sun * (1 - night * 0.85);
    scene.fog.color.copy(FOG).lerp(new THREE.Color('#1c2236'), night);
  }
  for (const o of orbs) {
    o.t += dt; if (o.t < 0) continue;
    const r = 1.4 + o.t * 0.12;
    o.m.position.set(Math.cos(o.a + o.t * 0.9) * r, 0.7 + o.t * 0.32, STREAM.z + Math.sin(o.a + o.t * 0.9) * r);
    if (Math.random() < 0.5) fx.add.add({ x: o.m.position.x, y: o.m.position.y, z: o.m.position.z, vx: 0, vy: -0.2, vz: 0, life: 1, a: 0.9, s0: 0.25, s1: 0.02, c0: new THREE.Color('#fff3d0'), c1: new THREE.Color('#ffb84a') });
  }
  if (G.mode === 'title') cam.auto = 0.04;
  updateCamera(dt);
  fx.update(dt, cam.cur);
  hoverT -= dt; if (hoverT <= 0) { hoverT = 0.06; updateHover(); }
  trigT -= dt; if (trigT <= 0 && G.mode === 'explore') { trigT = 0.2; checkTriggers(); }
  UI.updateFloats(dt, camera);
  if (composer) composer.render(); else renderer.render(scene, camera);
}

// test hooks
Object.assign(G, { _talk: talk, _move: partyMove, _byId: byId, _interact: interact, _save: save, _target: combatTarget, _area: areaCast, _defaultAb: defaultAb, _useInter: useInter, _ending: runEnding });

// boot
cam.tgt.set(0, 0, 14); cam.cur.copy(cam.tgt); cam.yaw = 0.6; cam.dist = 20; cam.distCur = 20;
let autoload = false; try { autoload = sessionStorage.getItem('mb-autoload') === '1'; sessionStorage.removeItem('mb-autoload'); } catch {}
if (autoload && store.get(SAVE)) {
  try { load(JSON.parse(store.get(SAVE))); } catch (e) { console.error(e); }
  $('#title').hidden = true; startPlay(); G.mode = 'explore'; G.select(G.sel);
  UI.log('讀取了存檔。', 'sys');
  addEventListener('pointerdown', () => initAudio(), { once: true });
}
frame();
