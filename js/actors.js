// Character models built from primitives, and their procedural animation.
import * as THREE from 'three';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0, ...o });
const METAL = (c, r = 0.35) => M(c, { metalness: 0.75, roughness: r });
function mk(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
const cap = (r, l, mat, x, y, z) => mk(new THREE.CapsuleGeometry(r, l, 4, 10), mat, x, y, z);
const sph = (r, mat, x, y, z, ws = 14, hs = 10) => mk(new THREE.SphereGeometry(r, ws, hs), mat, x, y, z);
const box = (w, h, d, mat, x, y, z) => mk(new THREE.BoxGeometry(w, h, d), mat, x, y, z);

const LOOKS = {
  kael:  { skin: '#e0b48f', hair: '#4a2e1c', style: 'short', beard: true, cloth: '#7a2a24', pants: '#3b3127', boots: '#2b211a', armor: 'plate', cape: '#7a1f1a', weapon: 'sword', shield: '#8a2a22', scale: 1.0, bulk: 1.12 },
  vera:  { skin: '#f0c9a5', hair: '#b4471f', style: 'tail', ears: true, cloth: '#3f5a33', pants: '#4a3a28', boots: '#3a2a1c', armor: 'leather', hood: '#2f4a2a', weapon: 'bow', quiver: true, scale: 0.95, bulk: 0.92 },
  orin:  { skin: '#e3bf9e', hair: '#d8d4cc', style: 'long', beard: 'long', cloth: '#2b3f7a', pants: '#2b3f7a', boots: '#2a2018', robe: '#28397a', trim: '#d4b25a', weapon: 'staff', orb: '#7ab8ff', hat: '#243266', scale: 0.98, bulk: 0.95 },
  sera:  { skin: '#8a5a3c', hair: '#1c1410', style: 'bun', cloth: '#d8d2c2', pants: '#4a4440', boots: '#3a2c20', armor: 'chain', tabard: '#ece4d0', emblem: '#d9a93a', weapon: 'mace', shield: '#e8dcc0', scale: 0.96, bulk: 1.0 },
  elder: { skin: '#dcb394', hair: '#cfcac0', style: 'bald', beard: true, cloth: '#5a4a38', pants: '#3e3428', boots: '#2b211a', robe: '#5d4b36', weapon: 'cane', scale: 0.92, bulk: 0.95, old: true },
  merchant: { skin: '#e6bd96', hair: '#6b3a1e', style: 'bun', cloth: '#8a5a2a', pants: '#4a3a28', boots: '#2b211a', robe: '#7a4f25', apron: '#e6dcc4', scale: 0.93, bulk: 1.25 },
  hunter: { skin: '#d9ad86', hair: '#3a2a1a', style: 'short', beard: true, cloth: '#5a5a2e', pants: '#3e3428', boots: '#2b211a', armor: 'leather', hood: '#4a4a26', scale: 1.0, bulk: 1.0, bandage: true },
  villager: { skin: '#e8c09c', hair: '#8a5a2a', style: 'short', cloth: '#6a5a8a', pants: '#3e3428', boots: '#2b211a', scale: 0.95, bulk: 1.0 },
  kid: { skin: '#f0c8a4', hair: '#d8a040', style: 'short', cloth: '#a84a3a', pants: '#3e5a7a', boots: '#2b211a', scale: 0.62, bulk: 1.05, head: 1.25 },
  goblin: { skin: '#6f8f3a', hair: '#2a2a1a', style: 'none', goblin: true, cloth: '#5a4228', pants: '#4a3a24', boots: '#2b211a', weapon: 'scimitar', scale: 0.68, bulk: 1.05, head: 1.35, eyes: '#ffd23a' },
  archer: { skin: '#7a9640', hair: '#2a2a1a', style: 'none', goblin: true, cloth: '#4e4a2a', pants: '#4a3a24', boots: '#2b211a', weapon: 'bow', quiver: true, hood: '#3e3a22', scale: 0.66, bulk: 0.95, head: 1.35, eyes: '#ffd23a' },
  grukk: { skin: '#5d7d30', hair: '#2a2a1a', style: 'none', goblin: true, cloth: '#4a3020', pants: '#3a2a1a', boots: '#2b211a', weapon: 'axe', armor: 'fur', helm: 'skull', scale: 0.92, bulk: 1.3, head: 1.25, eyes: '#ff9a2a' },
  skeleton: { skeleton: true, skin: '#d8d0b8', weapon: 'sword', shield: '#5a4630', scale: 0.98, bulk: 0.9, eyes: '#5fe8ff' },
  priest: { skin: '#5a5048', hair: '#222', style: 'none', cloth: '#4a4744', pants: '#3a3836', boots: '#1e1c1a', robe: '#57524c', trim: '#9a3a1a', hood: '#3f3b37', weapon: 'staff', orb: '#ff7a2a', scale: 1.06, bulk: 1.0, eyes: '#ff8a2a', shadowFace: true },
};

export function buildModel(kind) {
  if (kind === 'wolf') return wolf();
  const o = LOOKS[kind];
  const s = o.scale, b = o.bulk || 1;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(s);
  const mats = [];
  const mm = (m) => { mats.push(m); return m; };
  const skin = mm(M(o.skin, { roughness: 0.6 })), cloth = mm(M(o.cloth || '#555')), pants = mm(M(o.pants || '#444')), boot = mm(M(o.boots || '#2a2018')), hairM = mm(M(o.hair || '#222', { roughness: 0.9 }));
  const bone = o.skeleton ? skin : null;
  const rig = { root, body };
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips); rig.hips = hips;
  if (o.skeleton) { hips.add(mk(new THREE.TorusGeometry(0.13, 0.04, 6, 12), bone, 0, 0, 0)); hips.children[0].rotation.x = Math.PI / 2; }
  else { const pel = sph(0.2, pants, 0, 0, 0, 12, 8); pel.scale.set(1.25 * b, 0.7, 0.9 * b); hips.add(pel); }
  const torso = new THREE.Group(); hips.add(torso); rig.torso = torso;
  if (o.skeleton) {
    torso.add(cap(0.035, 0.5, bone, 0, 0.3, -0.05));
    for (let k = 0; k < 4; k++) { const r = mk(new THREE.TorusGeometry(0.15 - k * 0.012, 0.022, 5, 14, Math.PI * 1.6), bone, 0, 0.5 - k * 0.07, 0.0); r.rotation.set(Math.PI / 2, 0, Math.PI * 0.7); r.scale.set(1.15, 1, 1); torso.add(r); }
    const cl = cap(0.025, 0.42, bone, 0, 0.6, 0); cl.rotation.z = Math.PI / 2; torso.add(cl);
  } else {
    const ch = cap(0.21, 0.36, cloth, 0, 0.33, 0); ch.scale.set(1.12 * b, 1, 0.78 * b); torso.add(ch); rig.chest = ch;
    if (o.armor === 'plate') {
      const pm = mm(METAL('#9aa0a8')); const pl = cap(0.225, 0.3, pm, 0, 0.38, 0.0); pl.scale.set(1.14 * b, 1, 0.84 * b); torso.add(pl);
      for (const sd of [-1, 1]) { const pa = sph(0.13, pm, sd * 0.27 * b, 0.56, 0, 12, 8); pa.scale.set(1.2, 0.8, 1.1); torso.add(pa); }
      torso.add(box(0.46 * b, 0.07, 0.3 * b, mm(M('#3a2a1c')), 0, 0.08, 0));
    }
    if (o.armor === 'leather' || o.armor === 'fur') {
      const lm = mm(M(o.armor === 'fur' ? '#6a5640' : '#5a3e26', { roughness: 0.9 }));
      const v = cap(0.215, 0.24, lm, 0, 0.36, 0.01); v.scale.set(1.12 * b, 1, 0.8 * b); torso.add(v);
      torso.add(box(0.44 * b, 0.07, 0.3 * b, mm(M('#2e2014')), 0, 0.08, 0));
      if (o.armor === 'fur') for (const sd of [-1, 1]) { const f = sph(0.16, lm, sd * 0.24, 0.58, 0, 8, 6); f.scale.set(1.2, 0.7, 1.1); torso.add(f); }
    }
    if (o.armor === 'chain') {
      const cm = mm(METAL('#8d9098', 0.55)); const v = cap(0.218, 0.32, cm, 0, 0.34, 0); v.scale.set(1.13 * b, 1, 0.8 * b); torso.add(v);
      const tb = box(0.3, 0.62, 0.04, mm(M(o.tabard)), 0, 0.2, 0.18 * b); torso.add(tb);
      const em = mk(new THREE.CircleGeometry(0.07, 12), mm(M(o.emblem, { metalness: 0.6, roughness: 0.3, emissive: o.emblem, emissiveIntensity: 0.25 })), 0, 0.38, 0.205 * b); torso.add(em);
      torso.add(box(0.44 * b, 0.07, 0.3 * b, mm(M('#4a3424')), 0, 0.08, 0));
    }
    if (o.apron) torso.add(box(0.34, 0.6, 0.04, mm(M(o.apron)), 0, 0.12, 0.18 * b));
  }
  // robe skirt
  if (o.robe) {
    const rm = mm(M(o.robe, { side: THREE.DoubleSide }));
    const sk = mk(new THREE.CylinderGeometry(0.2 * b, 0.36 * b, 0.95, 14, 1, true), rm, 0, -0.42, 0); hips.add(sk); rig.skirt = sk;
    if (o.trim) hips.add(mk(new THREE.TorusGeometry(0.355 * b, 0.02, 4, 18), mm(M(o.trim, { metalness: 0.5 })), 0, -0.88, 0)).children;
    if (o.trim) hips.children[hips.children.length - 1].rotation.x = Math.PI / 2;
  }
  // cape
  if (o.cape) {
    const cg = new THREE.CylinderGeometry(0.2 * b, 0.34 * b, 1.0, 12, 4, true, Math.PI * 0.58, Math.PI * 0.84); cg.translate(0, -0.5, 0);
    const c = mk(cg, mm(M(o.cape, { side: THREE.DoubleSide, roughness: 0.9 })), 0, 0.64, -0.02); c.rotation.x = 0.1; torso.add(c); rig.cape = c;
  }
  // neck & head
  if (!o.skeleton) torso.add(cap(0.065, 0.08, skin, 0, 0.66, 0));
  else torso.add(cap(0.03, 0.1, bone, 0, 0.66, -0.02));
  const head = new THREE.Group(); head.position.y = 0.83; torso.add(head); rig.head = head;
  const hs = o.head || 1; head.scale.setScalar(hs);
  const skull = sph(0.15, skin, 0, 0, 0, 18, 14); skull.scale.set(0.92, 1.06, 1); head.add(skull);
  const eyeC = o.eyes || '#1c140e';
  const eyeM = o.eyes ? mm(new THREE.MeshStandardMaterial({ color: eyeC, emissive: eyeC, emissiveIntensity: 1.6 })) : M('#1c140e', { roughness: 0.3 });
  if (o.skeleton) {
    for (const sd of [-1, 1]) { head.add(sph(0.042, M('#100c08'), sd * 0.055, 0.0, 0.12, 8, 6)); head.add(sph(0.02, eyeM, sd * 0.055, 0.0, 0.14, 6, 4)); }
    const jaw = box(0.16, 0.05, 0.12, bone, 0, -0.11, 0.05); head.add(jaw);
  } else if (o.shadowFace) {
    head.add(sph(0.135, M('#0a0806'), 0, -0.01, 0.03, 12, 10));
    for (const sd of [-1, 1]) head.add(sph(0.022, eyeM, sd * 0.05, 0.01, 0.15, 6, 4));
  } else {
    for (const sd of [-1, 1]) {
      head.add(sph(o.goblin ? 0.03 : 0.022, eyeM, sd * 0.052, 0.015, 0.128, 8, 6));
      const br = box(0.06, 0.014, 0.02, hairM, sd * 0.053, 0.06, 0.133); br.rotation.z = sd * (o.goblin ? -0.35 : -0.08); head.add(br);
    }
    const nose = mk(new THREE.ConeGeometry(o.goblin ? 0.035 : 0.022, o.goblin ? 0.11 : 0.06, 6), skin, 0, -0.02, 0.15 + (o.goblin ? 0.03 : 0)); nose.rotation.x = Math.PI / 2; head.add(nose);
    head.add(box(0.06, 0.012, 0.01, M('#5a2a24'), 0, -0.07, 0.135));
    if (o.goblin || o.ears) for (const sd of [-1, 1]) { const e = mk(new THREE.ConeGeometry(o.goblin ? 0.05 : 0.025, o.goblin ? 0.22 : 0.09, 5), skin, sd * (o.goblin ? 0.17 : 0.14), 0.02, -0.01); e.rotation.z = -sd * (o.goblin ? 1.25 : 1.1); e.rotation.x = -0.2; head.add(e); }
    else for (const sd of [-1, 1]) { const e = sph(0.03, skin, sd * 0.138, 0, 0, 6, 5); e.scale.set(0.5, 1, 0.8); head.add(e); }
  }
  // hair styles
  const hairCap = (sy = 1) => { const h = mk(new THREE.SphereGeometry(0.158, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 0.012, -0.012); h.scale.set(0.97, sy, 1.04); head.add(h); return h; };
  if (o.style === 'short') { hairCap(); head.add(sph(0.12, hairM, 0, 0.0, -0.06, 10, 8)).children; }
  if (o.style === 'tail') { hairCap(); const t = cap(0.05, 0.3, hairM, 0, -0.08, -0.17); t.rotation.x = 0.4; head.add(t); }
  if (o.style === 'long') { hairCap(); const l = box(0.28, 0.32, 0.1, hairM, 0, -0.12, -0.09); head.add(l); }
  if (o.style === 'bun') { hairCap(); head.add(sph(0.075, hairM, 0, 0.12, -0.11, 10, 8)); }
  if (o.style === 'bald') { const h = mk(new THREE.TorusGeometry(0.13, 0.035, 6, 16, Math.PI * 1.2), hairM, 0, -0.01, -0.02); h.rotation.set(Math.PI / 2, 0, -Math.PI * 0.1 + Math.PI); head.add(h); }
  if (o.beard === true) { const bd = sph(0.11, hairM, 0, -0.085, 0.07, 12, 8); bd.scale.set(1, 0.9, 0.7); head.add(bd); }
  if (o.beard === 'long') { const bd = mk(new THREE.ConeGeometry(0.1, 0.36, 10), hairM, 0, -0.2, 0.08); bd.rotation.x = Math.PI + 0.15; head.add(bd); }
  if (o.hood) { const hd = mk(new THREE.SphereGeometry(0.19, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mm(M(o.hood, { side: THREE.DoubleSide })), 0, 0.01, -0.03); hd.rotation.x = -0.25; head.add(hd); }
  if (o.hat) { const ht = mk(new THREE.ConeGeometry(0.18, 0.42, 14), mm(M(o.hat)), 0, 0.28, -0.03); ht.rotation.x = -0.18; head.add(ht); head.add(mk(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 18), mm(M(o.hat)), 0, 0.09, 0)); }
  if (o.helm === 'skull') { const hm = sph(0.17, M('#d8d0b8'), 0, 0.06, 0.02, 12, 10); hm.scale.set(1, 0.75, 1.05); head.add(hm); for (const sd of [-1, 1]) { const hn = mk(new THREE.ConeGeometry(0.04, 0.22, 6), M('#e8e0c8'), sd * 0.14, 0.17, 0); hn.rotation.z = -sd * 0.6; head.add(hn); } }
  if (o.old) head.rotation.x = 0.12;
  // arms
  const armMat = o.skeleton ? bone : o.armor === 'plate' ? mm(METAL('#8a9098')) : o.robe && !o.apron ? mm(M(o.robe)) : cloth;
  for (const sd of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sd * 0.28 * b, 0.55, 0); torso.add(sh);
    const ua = cap(o.skeleton ? 0.025 : 0.062 * b, 0.24, armMat, 0, -0.16, 0); sh.add(ua);
    const el = new THREE.Group(); el.position.y = -0.33; sh.add(el);
    el.add(cap(o.skeleton ? 0.022 : 0.054 * b, 0.22, o.skeleton ? bone : (o.armor === 'plate' ? armMat : (o.robe ? armMat : skin)), 0, -0.13, 0));
    const hand = new THREE.Group(); hand.position.y = -0.3; el.add(hand);
    hand.add(sph(o.skeleton ? 0.035 : 0.05, o.armor === 'plate' ? mm(METAL('#6a6f78')) : skin, 0, 0, 0, 8, 6));
    sh.rotation.z = sd * 0.08;
    rig[sd < 0 ? 'armL' : 'armR'] = sh; rig[sd < 0 ? 'elL' : 'elR'] = el; rig[sd < 0 ? 'handL' : 'handR'] = hand;
  }
  if (o.bandage) { rig.armL.children[0].add(mk(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 8), M('#e8e0d0'), 0, 0, 0)); }
  // legs
  for (const sd of [-1, 1]) {
    const lg = new THREE.Group(); lg.position.set(sd * 0.1 * b, -0.04, 0); hips.add(lg);
    lg.add(cap(o.skeleton ? 0.03 : 0.085 * b, 0.32, o.skeleton ? bone : pants, 0, -0.22, 0));
    const kn = new THREE.Group(); kn.position.y = -0.45; lg.add(kn);
    kn.add(cap(o.skeleton ? 0.026 : 0.068 * b, 0.3, o.skeleton ? bone : pants, 0, -0.2, 0));
    if (!o.skeleton) { const bt = box(0.13 * b, 0.12, 0.24, boot, 0, -0.42, 0.04); kn.add(bt); kn.add(cap(0.075 * b, 0.12, boot, 0, -0.32, 0)); }
    else kn.add(box(0.06, 0.03, 0.14, bone, 0, -0.43, 0.04));
    rig[sd < 0 ? 'legL' : 'legR'] = lg; rig[sd < 0 ? 'knL' : 'knR'] = kn;
  }
  // weapons
  const steel = METAL('#c8ccd2', 0.25), wood = M('#5a3a22'), gold = METAL('#c9a540', 0.3);
  const R = rig.handR, L = rig.handL;
  const W = new THREE.Group(); R.add(W); rig.weapon = W;
  if (o.weapon === 'sword' || o.weapon === 'scimitar') {
    const len = o.weapon === 'sword' ? 0.85 : 0.55;
    const blade = box(0.06, len, 0.015, o.skeleton ? M('#7a6a52', { metalness: 0.5, roughness: 0.6 }) : steel, 0, len / 2 + 0.1, 0); W.add(blade);
    W.add(box(0.2, 0.035, 0.05, o.weapon === 'sword' ? gold : M('#3a2a1a'), 0, 0.08, 0)); W.add(cap(0.02, 0.1, M('#3a2414'), 0, 0.0, 0));
    if (o.weapon === 'scimitar') blade.rotation.z = 0.15;
    W.rotation.x = Math.PI / 2 + 0.3; rig.blade = blade;
  }
  if (o.weapon === 'axe') {
    W.add(cap(0.025, 0.85, wood, 0, 0.35, 0));
    const hd = box(0.04, 0.3, 0.32, M('#6a6a6a', { metalness: 0.6, roughness: 0.45 }), 0, 0.72, 0.12); W.add(hd);
    W.rotation.x = Math.PI / 2 + 0.3;
  }
  if (o.weapon === 'mace') {
    W.add(cap(0.022, 0.4, wood, 0, 0.2, 0));
    W.add(sph(0.075, steel, 0, 0.46, 0, 8, 6));
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const f = box(0.02, 0.12, 0.06, steel, Math.cos(a) * 0.065, 0.46, Math.sin(a) * 0.065); f.rotation.y = -a; W.add(f); }
    W.rotation.x = Math.PI / 2 + 0.3;
  }
  if (o.weapon === 'staff' || o.weapon === 'cane') {
    const len = o.weapon === 'staff' ? 1.75 : 1.0, cy = o.weapon === 'staff' ? 0.03 : -0.35, top = cy + len / 2;
    W.add(cap(0.025, len, M(o.weapon === 'staff' ? '#4a3220' : '#6a4a2a'), 0, cy, 0));
    if (o.orb) { const om = new THREE.MeshStandardMaterial({ color: '#fff', emissive: o.orb, emissiveIntensity: 2.5 }); const orb = sph(0.07, om, 0, top + 0.08, 0, 12, 10); W.add(orb); rig.orb = orb; rig.orbMat = om;
      for (let k = 0; k < 3; k++) { const p = cap(0.012, 0.12, M('#3a2414'), Math.cos(k * 2.1) * 0.06, top + 0.04, Math.sin(k * 2.1) * 0.06); W.add(p); } }
    rig.staff = true;
  }
  if (o.weapon === 'bow') {
    const bw = new THREE.Group(); L.add(bw); rig.bow = bw;
    const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 5 - 1; pts.push(new THREE.Vector3(0, -0.14 * (1 - t * t) + 0.02, t * 0.58)); }
    bw.add(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.018, 5), M('#5a3a1e')));
    bw.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([pts[0], pts[10]]), new THREE.LineBasicMaterial({ color: '#ddd' })));
    bw.position.y = 0.12;
  }
  if (o.quiver) { const q = cap(0.06, 0.4, M('#5a3a22'), 0.1, 0.38, -0.2); q.rotation.z = 0.4; torso.add(q); for (let k = 0; k < 4; k++) { const a = box(0.01, 0.16, 0.01, M('#ddd'), 0.16 + k * 0.012, 0.66, -0.2 + (k - 1.5) * 0.02); a.rotation.z = 0.4; torso.add(a); } }
  if (o.shield) {
    const sm = mm(M(o.shield, { roughness: 0.6 }));
    const sg = new THREE.Group(); rig.elL.add(sg); sg.position.set(-0.07, -0.16, 0.0);
    const disc = mk(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 18), sm, 0, 0, 0); disc.rotation.z = Math.PI / 2; sg.add(disc);
    const rim = mk(new THREE.TorusGeometry(0.3, 0.02, 4, 20), o.skeleton ? M('#4a4038') : gold, 0, 0, 0); rim.rotation.y = Math.PI / 2; sg.add(rim);
    const boss = sph(0.06, o.skeleton ? M('#4a4038') : gold, -0.03, 0, 0, 8, 6); sg.add(boss);
    if (o.emblem) { const e = mk(new THREE.CircleGeometry(0.11, 12), M(o.emblem, { metalness: 0.6, roughness: 0.3 }), -0.025, 0, 0); e.rotation.y = -Math.PI / 2; sg.add(e); }
    rig.shield = sg;
  }
  root.traverse((m) => { if (m.isMesh && m.material && !mats.includes(m.material) && m.material.isMeshStandardMaterial) mats.push(m.material); });
  rig.mats = [...new Set(mats)];
  rig.kind = kind; rig.height = 1.95 * s * (o.head ? 1 + (o.head - 1) * 0.15 : 1);
  return rig;
}

function wolf() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const fur = M('#6e6a64', { roughness: 0.95 }), dark = M('#3e3a36', { roughness: 0.95 }), eye = new THREE.MeshStandardMaterial({ color: '#ffcf4a', emissive: '#ffb020', emissiveIntensity: 1.5 });
  const rig = { root, body, wolf: true };
  const trunk = new THREE.Group(); trunk.position.y = 0.62; body.add(trunk); rig.torso = trunk;
  const t = cap(0.2, 0.7, fur, 0, 0, 0); t.rotation.x = Math.PI / 2; trunk.add(t);
  const ch = sph(0.24, fur, 0, 0.04, 0.3, 12, 10); ch.scale.set(0.9, 1, 1); trunk.add(ch);
  const back = sph(0.12, dark, 0, 0.15, 0, 10, 6); back.scale.set(1, 0.5, 3); trunk.add(back);
  const head = new THREE.Group(); head.position.set(0, 0.15, 0.55); trunk.add(head); rig.head = head;
  head.add(sph(0.15, fur, 0, 0, 0, 12, 10));
  const sn = mk(new THREE.ConeGeometry(0.08, 0.26, 8), fur, 0, -0.04, 0.17); sn.rotation.x = Math.PI / 2; head.add(sn);
  head.add(sph(0.03, M('#111'), 0, -0.03, 0.3, 6, 4));
  for (const sd of [-1, 1]) { const e = mk(new THREE.ConeGeometry(0.05, 0.14, 4), dark, sd * 0.08, 0.15, -0.02); head.add(e); head.add(sph(0.022, eye, sd * 0.065, 0.04, 0.11, 6, 4)); }
  const legs = [];
  for (const [x, z] of [[-0.12, 0.3], [0.12, 0.3], [-0.12, -0.3], [0.12, -0.3]]) {
    const lg = new THREE.Group(); lg.position.set(x, 0.0, z); trunk.add(lg);
    lg.add(cap(0.05, 0.34, fur, 0, -0.27, 0)); lg.add(sph(0.05, dark, 0, -0.58, 0.02, 6, 4));
    legs.push(lg);
  }
  rig.legs = legs;
  const tail = new THREE.Group(); tail.position.set(0, 0.08, -0.5); trunk.add(tail); rig.tail = tail;
  const tc = cap(0.05, 0.36, fur, 0, 0, -0.18); tc.rotation.x = Math.PI / 2 + 0.6; tail.add(tc);
  rig.mats = [fur, dark]; rig.kind = 'wolf'; rig.height = 1.0;
  return rig;
}

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
  r.torso.rotation.set(0.05 * W + breathe, s * 0.12 * W, 0);
  r.hips.rotation.set(0, -s * 0.1 * W, 0);
  r.legL.rotation.set(-s * 0.75 * W, 0, 0); r.legR.rotation.set(s * 0.75 * W, 0, 0);
  r.knL.rotation.x = Math.max(0, -Math.sin(an.phase + 1.4)) * 1.1 * W + 0.04;
  r.knR.rotation.x = Math.max(0, Math.sin(an.phase + 1.4)) * 1.1 * W + 0.04;
  r.armL.rotation.set(s * 0.6 * W + 0.05, 0, -0.1 - Math.abs(breathe) * 2); r.armR.rotation.set(-s * 0.6 * W + 0.05, 0, 0.1 + Math.abs(breathe) * 2);
  r.elL.rotation.x = -0.25 - 0.3 * W; r.elR.rotation.x = -0.25 - 0.3 * W;
  r.head.rotation.set(r.kind === 'elder' ? 0.12 : 0, 0, 0);
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
  r.tail.rotation.x = 0.2 + Math.sin(time * 3 + a.seed) * 0.1; r.tail.rotation.y = Math.sin(time * 2 + a.seed) * 0.3;
  r.head.rotation.x = Math.sin(time * 1.5 + a.seed) * 0.05 + (a.combatReady ? 0.25 : 0);
  r.torso.rotation.x = 0; r.body.position.z = 0;
  const act = an.act;
  if (act) {
    act.t += dt; const u = Math.min(1, act.t / act.dur);
    if (act.hitAt != null && !act.fired && u >= act.hitAt) { act.fired = true; act.onHit?.(); }
    const k = Math.sin(u * Math.PI);
    if (act.type === 'melee') { r.body.position.z = 0.6 * k; r.torso.rotation.x = -0.25 * k + (u > 0.5 ? 0.3 * k : 0); r.head.rotation.x = 0.4 * k; r.legs[0].rotation.x = -0.9 * k; r.legs[1].rotation.x = -0.9 * k; }
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
