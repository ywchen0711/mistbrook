// Turn-based combat: initiative, actions, abilities, enemy AI.
import * as THREE from 'three';
import { AB, d, d20, mod, rollExpr, chance, PROF, exprRange, sgn, LEVELS } from './rules.js';
import { play, flash } from './actors.js';
import * as UI from './ui.js';
import { sfx, musicMode } from './audio.js';
import { pathLen, cutPath } from './nav.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const dist = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
const dpt = (a, p) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const chest = (a) => V(a.pos.x, a.pos.y + (a.rig.height || 1.8) * 0.6, a.pos.z);
const nm = (a) => `<b>${a.name}</b>`;

export const acOf = (a) => a.ac + (a.acBonus || 0);
export function atkBonus(a, kind = 'weapon') {
  if (a.team === 'foe') return a.atk;
  const st = kind === 'spell' ? a.st[a.cast] : a.st[a.weapon.stat];
  return mod(st) + PROF + (a.blessed ? 2 : 0);
}
export const saveDC = (h) => 8 + PROF + mod(h.st[h.cast]);
export const saveBonus = (t, stat) => (t.team === 'foe' ? t.sv[stat] || 0 : mod(t.st[stat]));
export const liveFoes = (G) => (G.combat ? G.combat.order.filter((a) => a.team === 'foe' && !a.dead && !a.gone) : []);
const liveHeroes = (G) => G.party.filter((h) => !h.downed);
function adjacentEnemy(G, a) {
  const list = a.team === 'party' ? liveFoes(G) : liveHeroes(G);
  return list.some((o) => dist(a, o) < 2.1);
}
export function attackAdv(G, a, kind) {
  const ranged = kind === 'spell' || (kind === 'weapon' && (a.team === 'foe' ? a.ranged : a.weapon.ranged));
  return ranged && G.combat && adjacentEnemy(G, a) ? -1 : 0;
}
export function reachOf(a, id) {
  const ab = AB[id];
  if (!ab || ab.kind === 'weapon' || ab.kind === 'cleave') return a.team === 'foe' ? a.reach : a.weapon.reach;
  return ab.range || 0;
}
export function hitChance(G, a, t, id) {
  const ab = AB[id];
  if (ab.kind === 'weapon' || ab.kind === 'cleave') return chance(atkBonus(a), acOf(t), attackAdv(G, a, 'weapon'));
  if (ab.kind === 'spell') return chance(atkBonus(a, 'spell'), acOf(t), attackAdv(G, a, 'spell'));
  if (ab.kind === 'save' || ab.kind === 'save1') return 1 - chance(saveBonus(t, ab.save), saveDC(a));
  if (ab.kind === 'missile') return 1;
  return null;
}
export function dmgText(a, id) {
  const ab = AB[id];
  if (ab.kind === 'weapon' || ab.kind === 'cleave') { const [lo, hi] = exprRange(a.weapon.dmg, a.dmgBonus()); return `${lo}–${hi}`; }
  if (ab.kind === 'spell') { const [lo, hi] = exprRange(ab.dmg, a.spellPlus || 0); return `${lo}–${hi}`; }
  if (ab.kind === 'missile') return '6–15';
  if (ab.kind === 'save' || ab.kind === 'save1') { const [lo, hi] = exprRange(ab.dmg); return `${lo}–${hi}`; }
  return '';
}

// ---------------------------------------------------------------------------
export function heal(G, t, n, src) {
  const was = t.downed;
  t.hp = Math.min(t.maxHp, Math.max(0, t.hp) + n);
  if (t.downed) { t.downed = false; G.onRevive?.(t); }
  UI.float('+' + n, chest(t), '#7dff7a');
  G.fx.heal(V(t.pos.x, t.pos.y + 0.3, t.pos.z));
  sfx('heal');
  UI.log(`${src ? nm(src) + ' 治療 ' : ''}${nm(t)} 回復 ${n} 點生命${was ? '，重新站了起來！' : '。'}`, 'heal');
  G.refresh();
}

export function hurt(G, t, n, type, src) {
  if (t.dead || t.gone) return;
  let note = '';
  if (t.vuln?.includes(type)) { n *= 2; note = '（弱點 ×2）'; }
  t.hp -= n;
  UI.float('-' + n, chest(t), type === 'fire' ? '#ffa04a' : type === 'radiant' ? '#ffe680' : type === 'thunder' ? '#9fd0ff' : '#ff6a5a');
  if (note) UI.float('弱點！', V(t.pos.x, t.pos.y + 2.4, t.pos.z), '#ffdc5a', true);
  flash(t);
  if (!t.anim.act && t.hp > 0) play(t, 'hit', 0.35, null);
  G.fx.burst(chest(t), type === 'fire' ? '#ff7a2a' : '#c8402a', 10, 2.2, 0.12, 0.4);
  if (t.hp <= 0) {
    t.hp = 0;
    if (t.team === 'party') {
      t.downed = true; t.anim.act = null;
      UI.log(`${nm(t)} 倒下了！同伴可以用「扶起」、藥水或治療救他。`, 'hit');
    } else {
      t.dead = true; t.anim.act = null;
      if (G.combat) G.combat.xp += t.xp || 0;
      UI.log(`${nm(t)} 被打倒了。`, 'sys');
      if (t.type === 'skeleton') sfx('bones');
      G.onFoeDead?.(t);
      setTimeout(() => G.removeBody(t), 2200);
    }
  }
  return note;
}

// one attack roll; returns {hit, crit}
async function attackRoll(G, a, t, kind, dmgExpr, dmgBonus, type, label) {
  const adv = attackAdv(G, a, kind), bonus = atkBonus(a, kind);
  const roll = d20(adv), total = roll + bonus, crit = roll === 20, hit = crit || (roll !== 1 && total >= acOf(t));
  const advTxt = adv < 0 ? '（劣勢）' : adv > 0 ? '（優勢）' : '';
  if (hit) {
    let n = rollExpr(dmgExpr, crit) + dmgBonus;
    if (a.id === 'vera' && t.markedBy === a) n += rollExpr('1d6', crit);
    n = Math.max(1, n);
    const note = hurt(G, t, n, type, a);
    if (crit) { UI.float('暴擊！', V(t.pos.x, t.pos.y + 2.6, t.pos.z), '#ffd84a'); sfx('crit'); }
    sfx(type === 'slash' || type === 'pierce' ? (Math.random() < 0.5 ? 'hit' : 'clang') : 'hit');
    UI.log(`${nm(a)} ${label} ${nm(t)}：🎲${roll}${sgn(bonus)}=${total} vs AC ${acOf(t)}${advTxt} → ${crit ? '<span class="crit">暴擊！</span>' : '命中，'}${n} 點傷害${note}`, crit ? 'crit' : 'hit');
  } else {
    UI.float('落空', chest(t), '#cfcfcf', true);
    sfx('miss');
    UI.log(`${nm(a)} ${label} ${nm(t)}：🎲${roll}${sgn(bonus)}=${total} vs AC ${acOf(t)}${advTxt} → 落空`, 'miss');
  }
  G.refresh();
  return { hit, crit };
}

const face = (a, p) => { a.yawTarget = Math.atan2(p.x - a.pos.x, p.z - a.pos.z); };
const handPos = (a) => { const v = V(); (a.rig.handR || a.rig.head).getWorldPosition(v); return v; };

export async function weaponAttack(G, a, t, label = '攻擊') {
  face(a, t.pos);
  await wait(120);
  const ranged = a.team === 'foe' ? a.ranged : a.weapon.ranged;
  const dmgE = a.team === 'foe' ? a.dmg : a.weapon.dmg, bonus = a.team === 'foe' ? 0 : a.dmgBonus(), type = a.team === 'foe' ? a.dtype : a.weapon.type;
  if (ranged && !a.spell) {
    sfx('bow');
    await play(a, 'shoot', 0.9, 0.55, () => {});
    const from = a.rig.bow ? (() => { const v = V(); a.rig.handL.getWorldPosition(v); return v; })() : chest(a);
    sfx('arrow');
    await G.fx.shoot('arrow', from, chest(t));
    return attackRoll(G, a, t, 'weapon', dmgE, bonus, type, '射擊');
  }
  if (a.spell) {
    await play(a, 'cast', 0.8, 0.5, () => {});
    sfx('fire');
    await G.fx.shoot('ash', handPos(a), chest(t));
    return attackRoll(G, a, t, 'spell', dmgE, 0, 'fire', '灰燼箭射向');
  }
  sfx('swing');
  let r;
  await play(a, 'melee', a.rig.wolf ? 0.7 : 0.8, 0.5, async () => { r = attackRoll(G, a, t, 'weapon', dmgE, bonus, type, label); });
  return r;
}

// ---------------------------------------------------------------------------
// hero ability use. tgt = actor or null, pt = ground point for area spells.
export async function useAbility(G, h, id, tgt, pt) {
  const ab = AB[id], C = G.combat;
  if (C) { if (ab.cost === 'action') h.budget.action = 0; else h.budget.bonus = 0; }
  if (ab.uses) h.uses[id]--;
  if (ab.slot) h.slots--;
  G.pending = null; G.refresh();
  switch (ab.kind) {
    case 'weapon': await weaponAttack(G, h, tgt); break;
    case 'cleave': {
      UI.float('橫掃！', V(h.pos.x, h.pos.y + 2.3, h.pos.z), '#ffd27a', true);
      face(h, tgt.pos); sfx('swing');
      const others = liveFoes(G).filter((o) => o !== tgt && dist(o, tgt) <= 2.2 && dist(o, h) <= h.weapon.reach + 1.2);
      await play(h, 'melee', 0.9, 0.5, () => {
        attackRoll(G, h, tgt, 'weapon', h.weapon.dmg, h.dmgBonus(), 'slash', '橫掃');
        for (const o of others) attackRoll(G, h, o, 'weapon', h.weapon.dmg, h.dmgBonus(), 'slash', '橫掃');
      });
      break;
    }
    case 'spell': {
      face(h, tgt.pos); await wait(100);
      await play(h, 'cast', 0.7, 0.5, () => {});
      sfx('fire');
      await G.fx.shoot('fire', handPos(h), chest(tgt));
      await attackRoll(G, h, tgt, 'spell', ab.dmg, h.spellPlus || 0, 'fire', '火焰箭射向');
      break;
    }
    case 'missile': {
      face(h, tgt.pos); await wait(100);
      await play(h, 'cast', 0.7, 0.5, () => {});
      sfx('magic');
      const shots = [-1.2, 0, 1.2].map((s, i) => wait(i * 120).then(() => G.fx.shoot('missile', handPos(h), chest(tgt), { side: s })));
      for (const p of shots) {
        await p;
        if (tgt.dead) continue;
        const n = rollExpr('1d4+1');
        hurt(G, tgt, n, 'force', h);
        UI.log(`${nm(h)} 的魔法飛彈擊中 ${nm(tgt)}：${n} 點傷害`, 'hit');
      }
      G.refresh();
      break;
    }
    case 'save': {
      face(h, pt); await wait(100);
      await play(h, 'cast', 0.8, 0.5, () => {});
      sfx('boom');
      G.fx.ring(pt, '#9fd0ff', ab.radius * 1.15, 0.5); G.fx.ring(pt, '#ffffff', ab.radius * 0.8, 0.35);
      G.fx.light('#9fd0ff', 60, V(pt.x, 1.5, pt.z), 0.4); G.fx.dust(pt, 24);
      G.shake(0.35);
      const hits = liveFoes(G).filter((o) => dpt(o, pt) <= ab.radius + 0.3);
      if (!hits.length) UI.log(`${nm(h)} 的雷鳴波沒有打中任何人。`, 'miss');
      for (const o of hits) {
        const r = d(20), sb = saveBonus(o, ab.save), ok = r + sb >= saveDC(h);
        let n = rollExpr(ab.dmg); if (ok) n = Math.floor(n / 2);
        const note = hurt(G, o, Math.max(1, n), 'thunder', h);
        UI.log(`${nm(o)} 體質豁免 🎲${r}${sgn(sb)}=${r + sb} vs DC ${saveDC(h)} → ${ok ? '成功，傷害減半' : '失敗'}：${n} 點雷鳴傷害${note}`, 'hit');
        if (!ok && !o.dead) await G.push(o, pt, 1.6);
      }
      break;
    }
    case 'save1': {
      face(h, tgt.pos); await wait(100);
      await play(h, 'raise', 0.8, 0.5, () => {});
      sfx('holy');
      G.fx.holy(V(tgt.pos.x, 0, tgt.pos.z));
      await wait(250);
      const r = d(20), sb = saveBonus(tgt, ab.save), ok = r + sb >= saveDC(h);
      if (ok) { UI.float('閃開', chest(tgt), '#cfcfcf', true); UI.log(`${nm(tgt)} 敏捷豁免 🎲${r}${sgn(sb)}=${r + sb} vs DC ${saveDC(h)} → 閃開了神聖烈焰`, 'miss'); }
      else { const n = rollExpr(ab.dmg); const note = hurt(G, tgt, n, 'radiant', h); UI.log(`${nm(tgt)} 敏捷豁免 🎲${r}${sgn(sb)}=${r + sb} vs DC ${saveDC(h)} → 失敗，${n} 點光耀傷害${note}`, 'hit'); }
      break;
    }
    case 'heal': {
      const t = tgt || h;
      if (t !== h) face(h, t.pos);
      await play(h, id === 'secondwind' ? 'cheer' : 'raise', 0.7, 0.5, () => {});
      const n = rollExpr(ab.heal) + (id === 'healword' ? mod(h.st.wis) - 3 : 0) + (id === 'secondwind' ? h.level - 2 : 0);
      heal(G, t, Math.max(1, n), t === h ? null : h);
      break;
    }
    case 'potion': {
      const t = tgt || h;
      G.potions--;
      if (t !== h) { face(h, t.pos); await play(h, 'kneel', 0.8, 0.5, () => {}); }
      else await play(h, 'drink', 0.9, 0.6, () => {});
      heal(G, t, rollExpr(ab.heal), t === h ? null : h);
      break;
    }
    case 'help': {
      face(h, tgt.pos);
      await play(h, 'kneel', 1.0, 0.6, () => {});
      heal(G, tgt, 1, h);
      break;
    }
    case 'dash': h.budget.move += h.spd; h.budget.dashed = true; UI.float('衝刺！', chest(h), '#9fd0ff', true); UI.log(`${nm(h)} 衝刺，移動距離加倍。`); break;
    case 'mark': {
      for (const o of G.foes) if (o.markedBy === h) o.markedBy = null;
      tgt.markedBy = h; face(h, tgt.pos);
      await play(h, 'raise', 0.5, 0.5, () => {});
      UI.float('🎯 標記', V(tgt.pos.x, tgt.pos.y + 2.3, tgt.pos.z), '#ffb04a', true); sfx('magic');
      UI.log(`${nm(h)} 用獵人印記標記了 ${nm(tgt)}。`);
      break;
    }
    case 'volley': {
      face(h, pt); await wait(100);
      sfx('bow');
      await play(h, 'shoot', 0.9, 0.55, () => {});
      const hits = liveFoes(G).filter((o) => dpt(o, pt) <= ab.radius + 0.3);
      const from = handPos(h);
      const arrows = [];
      for (let k = 0; k < 9; k++) arrows.push(wait(k * 50).then(() => G.fx.shoot('arrow', from, V(pt.x + (Math.random() - 0.5) * ab.radius * 1.6, 0.1, pt.z + (Math.random() - 0.5) * ab.radius * 1.6), { arc: 3 })));
      sfx('arrow');
      await Promise.all(arrows);
      G.fx.dust(pt, 16);
      if (!hits.length) UI.log(`${nm(h)} 的箭雨落在空地上。`, 'miss');
      for (const o of hits) await attackRoll(G, h, o, 'weapon', h.weapon.dmg, h.dmgBonus(), 'pierce', '箭雨射中');
      break;
    }
    case 'bless': {
      await play(h, 'raise', 0.9, 0.5, () => {});
      sfx('holy');
      for (const p of G.party) if (!p.downed && dist(p, h) <= 12) { p.blessed = 3; G.fx.holy(V(p.pos.x, 0, p.pos.z)); }
      UI.log(`${nm(h)} 祈求晨曦女神祝福全隊：三回合內攻擊命中 +2。`, 'heal');
      break;
    }
  }
  G.refresh();
  if (C) await G.checkCombatEnd();
}

// ---------------------------------------------------------------------------
export async function startCombat(G, foes, o = {}) {
  if (G.combat) { // join an existing fight
    for (const f of foes) if (!G.combat.order.includes(f)) { f.init = d(20) + (f.sv.dex || 0); G.combat.order.push(f); f.combatReady = true; f.showName = true; }
    return;
  }
  G.mode = 'combat';
  G.stopAll();
  const C = (G.combat = { round: 1, order: [], idx: -1, xp: 0, active: null, foes });
  for (const h of G.party) { h.combatReady = true; h.init = d(20) + mod(h.st.dex) + (o.surprise ? 10 : 0); }
  for (const f of foes) { f.combatReady = true; f.showName = true; f.init = d(20) + (f.sv.dex || 0) + (o.ambush ? 5 : 0); face(f, G.party[0].pos); }
  C.order = [...G.party, ...foes].sort((a, b) => b.init - a.init);
  musicMode('combat'); sfx('start');
  UI.banner(o.surprise ? '先發制人！' : o.ambush ? '遭到伏擊！' : '戰鬥開始', '依照先攻順序輪流行動');
  UI.log('—— 戰鬥開始 ——', 'sys');
  UI.log('先攻：' + C.order.map((a) => `${a.name} ${a.init}`).join('、'), 'sys');
  G.refresh();
  await wait(1200);
  loop(G);
}

async function loop(G) {
  const C = G.combat;
  while (G.combat === C && !C.over) {
    C.idx++;
    if (C.idx >= C.order.length) { C.idx = 0; C.round++; UI.log(`—— 第 ${C.round} 輪 ——`, 'sys'); await G.onRound?.(C.round); }
    const a = C.order[C.idx];
    if (!a || a.dead || a.gone) continue;
    C.active = a;
    if (a.team === 'party') {
      if (a.downed) { UI.log(`${nm(a)} 倒在地上，無法行動。`, 'miss'); continue; }
      if (a.blessed) a.blessed--;
      a.budget = { move: a.spd, action: 1, bonus: 1 };
      G.select(a, true);
      G.focus(a.pos);
      G.refresh();
      await new Promise((res) => (C.endTurn = res));
      C.endTurn = null;
    } else {
      G.focus(a.pos);
      G.refresh();
      await wait(450);
      try { await foeTurn(G, a); } catch (e) { console.error(e); }
      await wait(350);
    }
    if (await G.checkCombatEnd()) return;
  }
}

export async function endCombat(G, won) {
  const C = G.combat; if (!C || C.over) return;
  C.over = true;
  C.endTurn?.();
  if (!won) { G.combat = null; G.gameOver(); return; }
  await wait(900);
  G.combat = null; G.mode = 'explore'; musicMode('explore');
  for (const h of G.party) { h.combatReady = false; h.budget = null; h.blessed = 0; if (h.downed) { h.downed = false; h.hp = 1; } }
  for (const f of G.foes) { f.markedBy = null; }
  UI.banner('勝利', `獲得 ${C.xp} 點經驗`);
  UI.log(`—— 戰鬥結束：獲得 ${C.xp} 點經驗 ——`, 'sys');
  sfx('success');
  G.gainXp(C.xp);
  G.select(G.sel && !G.sel.downed ? G.sel : G.party[0]);
  G.refresh();
  await G.afterCombat?.(C);
}

export function gainXp(G, n) {
  for (const h of G.party) {
    h.xp += n;
    while (LEVELS[h.level + 1] && h.xp >= LEVELS[h.level + 1]) {
      h.level++;
      const up = Math.floor(h.hitDie / 2) + 1 + mod(h.st.con);
      h.maxHp += up; h.hp += up;
      if (h.slotsMax) { h.slotsMax++; h.slots++; }
      UI.float('升級！', V(h.pos.x, h.pos.y + 2.4, h.pos.z), '#ffe27a');
      UI.log(`${nm(h)} 升到 ${h.level} 級！生命上限 +${up}${h.slotsMax ? '，法術位 +1' : ''}。`, 'crit');
      sfx('level');
    }
  }
}

// ---------------------------------------------------------------------------
// enemy AI
function pickTarget(G, e, list) {
  let best = null, bs = 1e9;
  for (const h of list) {
    const s = dist(e, h) + h.hp * 0.12 + acOf(h) * 0.15 + (G.combat && G.combat.taunt === h ? -3 : 0) + Math.random() * 1.5;
    if (s < bs) { bs = s; best = h; }
  }
  return best;
}
// cut path where we first get within `reach` of target point
function approachPath(from, pts, tp, reach) {
  const out = []; let p = from;
  if (Math.hypot(p.x - tp.x, p.z - tp.z) <= reach) return out;
  for (const q of pts) {
    const L = Math.hypot(q.x - p.x, q.z - p.z), n = Math.max(1, Math.ceil(L / 0.25));
    for (let k = 1; k <= n; k++) {
      const x = p.x + (q.x - p.x) * k / n, z = p.z + (q.z - p.z) * k / n;
      if (Math.hypot(x - tp.x, z - tp.z) <= reach) { out.push({ x, z }); return out; }
    }
    out.push(q); p = q;
  }
  return out;
}
async function moveToward(G, e, tp, reach) {
  G.nav.setActors(G.blockers(e));
  const path = G.nav.find(e.pos.x, e.pos.z, tp.x, tp.z);
  G.nav.clearActors();
  if (!path) return;
  let pts = approachPath(e.pos, path, tp, reach);
  pts = cutPath(e.pos, pts, e.spd);
  if (pts.length) await G.walk(e, pts, 3.6);
}
async function moveAway(G, e, from, d0 = 6) {
  const dx = e.pos.x - from.pos.x, dz = e.pos.z - from.pos.z, L = Math.hypot(dx, dz) || 1;
  let best = null;
  for (const ang of [0, 0.5, -0.5, 1, -1]) {
    const c = Math.cos(ang), s = Math.sin(ang), ux = (dx / L) * c - (dz / L) * s, uz = (dx / L) * s + (dz / L) * c;
    const p = { x: e.pos.x + ux * d0, z: e.pos.z + uz * d0 };
    G.nav.setActors(G.blockers(e));
    const path = G.nav.find(e.pos.x, e.pos.z, p.x, p.z);
    G.nav.clearActors();
    if (path && pathLen(e.pos, path) < e.spd * 1.2) { best = cutPath(e.pos, path, e.spd); break; }
  }
  if (best && best.length) await G.walk(e, best, 3.6);
}

async function foeTurn(G, e) {
  const heroes = liveHeroes(G);
  if (!heroes.length) return;
  if (e.type === 'priest') return priestTurn(G, e);
  if (e.ranged) {
    const adj = heroes.find((h) => dist(e, h) < 2.1);
    if (adj) await moveAway(G, e, adj, 6);
    let inR = heroes.filter((h) => dist(e, h) <= e.reach);
    if (!inR.length) { const t = pickTarget(G, e, heroes); await moveToward(G, e, t.pos, e.reach - 1); inR = heroes.filter((h) => dist(e, h) <= e.reach); }
    if (inR.length) { const t = inR.sort((a, b) => a.hp - b.hp)[0]; await weaponAttack(G, e, t); }
    return;
  }
  let t = pickTarget(G, e, heroes);
  if (dist(e, t) > e.reach) await moveToward(G, e, t.pos, e.reach - 0.3);
  if (dist(e, t) > e.reach + 0.2) { const near = heroes.filter((h) => dist(e, h) <= e.reach + 0.2); if (near.length) t = near[0]; else return; }
  if (e.type === 'wolf') sfx('growl');
  await weaponAttack(G, e, t, e.type === 'wolf' ? '撲咬' : '攻擊');
}

async function priestTurn(G, e) {
  const C = G.combat, heroes = liveHeroes(G);
  const lit = G.W.braziers.filter((b) => b.lit);
  const skels = liveFoes(G).filter((f) => f.type === 'skeleton').length;
  if (lit.length && skels < 3 && (C.round % 3 === 2 || (skels === 0 && C.round > 1))) {
    face(e, lit[0].pos);
    UI.float('起來吧……', V(e.pos.x, e.pos.y + 2.4, e.pos.z), '#9fefff', true);
    await play(e, 'raise', 1.2, 0.5, () => {});
    const b = lit[Math.floor(Math.random() * lit.length)];
    await G.summonSkeleton(b.pos, e);
    return;
  }
  const adj = heroes.find((h) => dist(e, h) < 2.6);
  if (adj) await moveAway(G, e, adj, 6);
  let inR = heroes.filter((h) => dist(e, h) <= e.reach);
  if (!inR.length) { await moveToward(G, e, pickTarget(G, e, heroes).pos, e.reach - 1); inR = heroes.filter((h) => dist(e, h) <= e.reach); }
  if (inR.length) await weaponAttack(G, e, inR.sort((a, b) => a.hp - b.hp)[0]);
}
