// Procedural animation for the rigs built in models.js.
import * as THREE from 'three';

export { buildModel } from './models.js';

// ---------------------------------------------------------------------------
const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export function animate(a, dt, time) {
  const r = a.rig, an = a.anim;
  an.t += dt;
  const sp = a.speed || 0, w = Math.min(1, sp / 3);
  an.phase += dt * (1.6 + sp * 2.2);
  an.w = lerp(an.w || 0, w, Math.min(1, dt * 8));
  const W = an.w, s = Math.sin(an.phase), c = Math.cos(an.phase);
  if (r.wolf) return animWolf(a, dt, time, W, s, c);
  // base pose
  const breathe = Math.sin(time * 1.8 + a.seed) * 0.012;
  r.body.position.y = Math.abs(c) * 0.05 * W;
  r.body.position.z = 0;
  r.torso.rotation.set(0.05 * W + breathe + r.hunch, s * 0.12 * W, 0);
  r.hips.rotation.set(0, -s * 0.1 * W, 0);
  r.legL.rotation.set(-s * 0.75 * W, 0, 0); r.legR.rotation.set(s * 0.75 * W, 0, 0);
  r.knL.rotation.x = Math.max(0, -Math.sin(an.phase + 1.4)) * 1.1 * W + 0.04;
  r.knR.rotation.x = Math.max(0, Math.sin(an.phase + 1.4)) * 1.1 * W + 0.04;
  r.armL.rotation.set(s * 0.6 * W + 0.05, 0, -0.1 - Math.abs(breathe) * 2); r.armR.rotation.set(-s * 0.6 * W + 0.05, 0, 0.1 + Math.abs(breathe) * 2);
  r.elL.rotation.x = -0.25 - 0.3 * W; r.elR.rotation.x = -0.25 - 0.3 * W;
  r.head.rotation.set((r.kind === 'elder' ? 0.12 : 0) - r.hunch * 0.8, Math.sin(time * 0.37 + a.seed) * 0.12 * (1 - W), 0);
  if (r.cape) r.cape.rotation.x = 0.1 + W * 0.45 + Math.sin(time * 2 + a.seed) * 0.04;
  if (r.skirt) r.skirt.rotation.x = 0;
  if (r.staff) { r.armR.rotation.x = -0.35 - s * 0.15 * W; r.elR.rotation.x = -0.6; }
  if (r.kind === 'elder') { r.armR.rotation.x = -0.45; r.elR.rotation.x = -0.4; r.torso.rotation.x += 0.15; }
  if (r.bow && !an.act) { r.armL.rotation.x = -0.2 + s * 0.4 * W; }
  if (a.combatReady && !W && !an.act) {
    // guard stance
    r.armR.rotation.x = -0.7; r.elR.rotation.x = -0.9; r.armL.rotation.x = -0.5; r.elL.rotation.x = -1.0;
    r.legL.rotation.x = -0.25; r.legR.rotation.x = 0.2; r.knL.rotation.x = 0.25; r.knR.rotation.x = 0.3; r.body.position.y = -0.04;
    if (r.staff) { r.armR.rotation.x = -0.6; r.elR.rotation.x = -0.7; r.armL.rotation.x = -0.4; }
    if (r.bow) { r.armL.rotation.x = -0.9; r.armL.rotation.z = 0.3; }
  }
  if (an.pose === 'sit') {
    r.body.position.y = -0.5; r.legL.rotation.x = -1.45; r.legR.rotation.x = -1.35; r.knL.rotation.x = 0.3; r.knR.rotation.x = 0.5;
    r.torso.rotation.x = -0.25; r.armL.rotation.set(-0.4, 0, -0.4); r.armR.rotation.set(-0.2, 0, 0.3); r.head.rotation.x = 0.25;
  }
  // actions
  const act = an.act;
  if (act) {
    act.t += dt;
    const u = Math.min(1, act.t / act.dur);
    if (act.hitAt != null && !act.fired && u >= act.hitAt) { act.fired = true; act.onHit?.(); }
    poseAction(r, act.type, u);
    if (u >= 1) { an.act = null; act.done?.(); }
  }
  // downed / dead
  const target = a.downed || a.dead ? 1 : 0;
  an.fall = lerp(an.fall || 0, target, Math.min(1, dt * 5));
  if (an.fall > 0.01) {
    r.body.rotation.x = -Math.PI / 2 * an.fall; r.body.position.y = 0.18 * an.fall + r.body.position.y * (1 - an.fall);
    r.body.position.z = 0.85 * an.fall * r.body.scale.x;
    r.armL.rotation.z = -0.6 * an.fall; r.armR.rotation.z = 0.6 * an.fall;
  } else r.body.rotation.x = 0;
  // hit flash
  if (an.flash > 0) {
    an.flash -= dt;
    const k = Math.max(0, an.flash) * 3;
    for (const m of r.mats) { if (!m.userData.e0) m.userData.e0 = m.emissive.clone(); m.emissive.copy(m.userData.e0).lerp(an.flashCol, Math.min(1, k)); }
    if (an.flash <= 0) for (const m of r.mats) if (m.userData.e0) m.emissive.copy(m.userData.e0);
  }
  if (r.staff) r.weapon.rotation.x = -(r.armR.rotation.x + r.elR.rotation.x);
  if (r.bow) r.bow.rotation.x = an.act && an.act.type === 'shoot' ? 0 : a.combatReady && !W ? 0.6 : 1.45;
  if (r.orbMat) r.orbMat.emissiveIntensity = 2.2 + Math.sin(time * 4 + a.seed) * 0.6 + (an.act && an.act.type === 'cast' ? 4 : 0);
}

function poseAction(r, type, u) {
  if (type === 'melee') {
    let k;
    if (u < 0.4) { k = ease(u / 0.4); r.armR.rotation.x = lerp(r.armR.rotation.x, -2.6, k); r.armR.rotation.z = 0.3 * k; r.elR.rotation.x = lerp(-0.3, -0.5, k); r.torso.rotation.y = 0.45 * k; }
    else if (u < 0.6) { k = ease((u - 0.4) / 0.2); r.armR.rotation.x = lerp(-2.6, -0.4, k); r.armR.rotation.z = 0.3 - 0.3 * k; r.elR.rotation.x = -0.5 + 0.4 * k; r.torso.rotation.y = lerp(0.45, -0.5, k); r.body.position.z = 0.25 * k; r.legL.rotation.x = -0.5 * k; r.knR.rotation.x = 0.4 * k; }
    else { k = ease((u - 0.6) / 0.4); r.armR.rotation.x = lerp(-0.4, r.armR.rotation.x, k); r.torso.rotation.y = lerp(-0.5, 0, k); r.body.position.z = 0.25 * (1 - k); r.legL.rotation.x = -0.5 * (1 - k); }
    if (r.shield) { r.armL.rotation.x = -0.9; r.elL.rotation.x = -1.2; }
  } else if (type === 'shoot') {
    const k = u < 0.55 ? ease(u / 0.55) : 1 - ease((u - 0.55) / 0.45) * 0.9;
    r.armL.rotation.set(-1.5 * k, 0, 0.0); r.elL.rotation.x = -0.05;
    r.armR.rotation.set(-1.45 * k, 0, -0.25 * k); r.elR.rotation.x = -1.9 * (u < 0.55 ? k : 0.2);
    r.torso.rotation.y = -0.5 * k; r.head.rotation.y = 0.45 * k;
  } else if (type === 'cast') {
    const k = u < 0.5 ? ease(u / 0.5) : 1 - ease((u - 0.5) / 0.5);
    r.armL.rotation.set(-1.4 * k, 0, -0.3 * k); r.armR.rotation.set(-1.6 * k, 0, 0.3 * k); r.elL.rotation.x = -0.3; r.elR.rotation.x = -0.3;
    r.torso.rotation.x = -0.12 * k; r.head.rotation.x = -0.15 * k;
  } else if (type === 'raise') {
    const k = u < 0.5 ? ease(u / 0.5) : 1 - ease((u - 0.5) / 0.5);
    r.armR.rotation.set(-2.8 * k, 0, 0.2); r.armL.rotation.set(-2.6 * k, 0, -0.2); r.torso.rotation.x = -0.2 * k; r.head.rotation.x = -0.4 * k;
  } else if (type === 'hit') {
    const k = Math.sin(u * Math.PI);
    r.torso.rotation.x = -0.35 * k; r.head.rotation.x = -0.3 * k; r.body.position.z = -0.12 * k; r.armL.rotation.z -= 0.4 * k; r.armR.rotation.z += 0.4 * k;
  } else if (type === 'drink') {
    const k = Math.sin(u * Math.PI);
    r.armR.rotation.set(-2.1 * k, 0, 0.5 * k); r.elR.rotation.x = -1.6 * k; r.head.rotation.x = -0.4 * k;
  } else if (type === 'kick') {
    const k = Math.sin(u * Math.PI);
    r.legR.rotation.x = -1.3 * k; r.knR.rotation.x = 0.2; r.torso.rotation.x = -0.2 * k; r.armL.rotation.z = -0.6 * k;
  } else if (type === 'kneel') {
    const k = Math.sin(u * Math.PI);
    r.body.position.y = -0.3 * k; r.legL.rotation.x = -1.4 * k; r.knL.rotation.x = 1.4 * k; r.legR.rotation.x = 0.2 * k; r.knR.rotation.x = 1.6 * k;
    r.armR.rotation.x = -1.1 * k; r.armL.rotation.x = -1.1 * k; r.torso.rotation.x = 0.4 * k;
  } else if (type === 'cheer') {
    const k = Math.sin(u * Math.PI);
    r.armR.rotation.set(-2.9 * k, 0, 0.3); r.armL.rotation.set(-2.9 * k, 0, -0.3); r.body.position.y += 0.15 * Math.abs(Math.sin(u * Math.PI * 3));
  } else if (type === 'rise') {
    r.body.position.y = -1.6 * (1 - ease(u)); r.torso.rotation.x = 0.5 * (1 - u);
  }
}

function animWolf(a, dt, time, W, s, c) {
  const r = a.rig, an = a.anim;
  r.body.position.y = Math.abs(c) * 0.06 * W;
  r.legs[0].rotation.x = s * 0.8 * W; r.legs[3].rotation.x = s * 0.8 * W; r.legs[1].rotation.x = -s * 0.8 * W; r.legs[2].rotation.x = -s * 0.8 * W;
  if (r.low) r.low.forEach((l, i) => { const ph = i === 0 || i === 3 ? s : -s; l.rotation.x = l.userData.base + Math.max(0, ph) * 0.7 * W * (i < 2 ? 1 : -1); });
  if (r.jaw) r.jaw.rotation.x = a.combatReady ? 0.12 + Math.sin(time * 2 + a.seed) * 0.04 : 0.02;
  r.tail.rotation.x = 0.2 + Math.sin(time * 3 + a.seed) * 0.1; r.tail.rotation.y = Math.sin(time * 2 + a.seed) * 0.3;
  r.head.rotation.x = Math.sin(time * 1.5 + a.seed) * 0.05 + (a.combatReady ? 0.25 : 0);
  r.torso.rotation.x = 0; r.body.position.z = 0;
  const act = an.act;
  if (act) {
    act.t += dt; const u = Math.min(1, act.t / act.dur);
    if (act.hitAt != null && !act.fired && u >= act.hitAt) { act.fired = true; act.onHit?.(); }
    const k = Math.sin(u * Math.PI);
    if (act.type === 'melee') { if (r.jaw) r.jaw.rotation.x = 0.55 * k; r.body.position.z = 0.6 * k; r.torso.rotation.x = -0.25 * k + (u > 0.5 ? 0.3 * k : 0); r.head.rotation.x = 0.4 * k; r.legs[0].rotation.x = -0.9 * k; r.legs[1].rotation.x = -0.9 * k; }
    if (act.type === 'hit') { r.torso.rotation.x = -0.3 * k; r.body.position.z = -0.15 * k; }
    if (u >= 1) { an.act = null; act.done?.(); }
  }
  const target = a.dead ? 1 : 0;
  an.fall = lerp(an.fall || 0, target, Math.min(1, dt * 5));
  r.body.rotation.z = Math.PI / 2 * an.fall; r.body.position.y += -0.35 * an.fall;
  if (an.flash > 0) {
    an.flash -= dt; const k = Math.max(0, an.flash) * 3;
    for (const m of r.mats) { if (!m.userData.e0) m.userData.e0 = m.emissive.clone(); m.emissive.copy(m.userData.e0).lerp(an.flashCol, Math.min(1, k)); }
    if (an.flash <= 0) for (const m of r.mats) if (m.userData.e0) m.emissive.copy(m.userData.e0);
  }
}

// play an action; resolves when finished, calls onHit at the impact moment
export function play(a, type, dur = 0.8, hitAt = 0.5, onHit) {
  return new Promise((res) => { a.anim.act = { type, t: 0, dur, hitAt, onHit, done: res }; });
}
export function flash(a, col = '#ff2a1a', t = 0.35) { a.anim.flash = t; a.anim.flashCol = new THREE.Color(col); }
