// DOM interface: party cards, hotbar, initiative, log, tooltips, dialogue, dice, modals and floating text.
import * as THREE from 'three';
import { AB, sgn } from './rules.js';
import { sfx } from './audio.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const UI = { floats: [], marks: new Map(), names: new Map() };

export function log(html, cls = '') {
  const L = $('#log'), p = document.createElement('p'); p.className = cls; p.innerHTML = html; L.appendChild(p);
  while (L.children.length > 80) L.firstChild.remove();
  L.scrollTop = L.scrollHeight;
}

export function float(text, pos, color = '#fff', small = false, rise = 1.2) {
  const el = document.createElement('div'); el.className = 'fl' + (small ? ' small' : ''); el.textContent = text; el.style.color = color;
  $('#floats').appendChild(el);
  UI.floats.push({ el, pos: pos.clone(), t: 0, life: 1.4, rise });
}
export function updateFloats(dt, camera) {
  const v = new THREE.Vector3(), w = innerWidth, h = innerHeight;
  UI.floats = UI.floats.filter((f) => {
    f.t += dt; const u = f.t / f.life;
    if (u >= 1) { f.el.remove(); return false; }
    v.copy(f.pos); v.y += u * f.rise; v.project(camera);
    f.el.style.left = ((v.x + 1) / 2) * w + 'px'; f.el.style.top = ((1 - v.y) / 2) * h + 'px';
    f.el.style.opacity = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
    f.el.style.transform = `translate(-50%,-100%) scale(${u < 0.1 ? 0.6 + u * 4 : 1})`;
    return true;
  });
  for (const [a, el] of UI.marks) {
    if (!a.markOn || !a.root.visible) { el.style.display = 'none'; continue; }
    v.copy(a.pos); v.y += (a.rig.height || 1.9) + 0.45; v.project(camera);
    el.style.display = v.z < 1 ? '' : 'none'; el.style.left = ((v.x + 1) / 2) * w + 'px'; el.style.top = ((1 - v.y) / 2) * h + 'px';
  }
  for (const [a, el] of UI.names) {
    const show = a.showName && a.root.visible && !a.dead;
    if (!show) { el.style.display = 'none'; continue; }
    v.copy(a.pos); v.y += (a.rig.height || 1.9) + 0.15; v.project(camera);
    el.style.display = v.z < 1 ? '' : 'none'; el.style.left = ((v.x + 1) / 2) * w + 'px'; el.style.top = ((1 - v.y) / 2) * h + 'px';
    const bar = el.querySelector('b'); if (bar) bar.style.width = Math.max(0, (a.hp / a.maxHp) * 100) + '%';
  }
}
export function questMark(a, on) {
  let el = UI.marks.get(a);
  if (!el) { el = document.createElement('div'); el.className = 'mk'; el.textContent = '!'; $('#floats').appendChild(el); UI.marks.set(a, el); }
  a.markOn = on;
}
export function nameTag(a, hp = false) {
  let el = UI.names.get(a);
  if (!el) { el = document.createElement('div'); el.className = 'nm'; el.innerHTML = esc(a.name) + (hp ? '<i><b></b></i>' : ''); $('#floats').appendChild(el); UI.names.set(a, el); }
  return el;
}

export function banner(text, sub = '') {
  const b = $('#banner'); b.hidden = false; b.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : '');
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(b._t); b._t = setTimeout(() => (b.hidden = true), 1700);
}
export async function caption(text, ms = 3200) {
  const c = $('#caption'); c.hidden = false; c.style.opacity = 0; c.textContent = text;
  await wait(30); c.style.opacity = 1; await wait(ms); c.style.opacity = 0; await wait(600); c.hidden = true;
}
export function cine(on) { document.body.classList.toggle('cine', on); }

// ---------------------------------------------------------------------------
export function partyCards(G) {
  const P = $('#party');
  if (P.children.length !== G.party.length) {
    P.innerHTML = '';
    for (const h of G.party) {
      const d = document.createElement('div'); d.className = 'pc';
      d.innerHTML = `<img alt=""><span class="lv"></span><span class="cond"></span><div class="hp"><b></b></div><span class="hpn"></span>`;
      d.querySelector('img').src = h.portrait || '';
      d.onclick = () => G.onCard(h);
      d.onmouseenter = () => tip(`<b>${esc(h.name)}</b>　${h.cls}　等級 ${h.level}<br>生命 ${h.hp}/${h.maxHp}　防禦 AC ${h.ac}<br>${h.slotsMax ? `法術位 ${h.slots}/${h.slotsMax}<br>` : ''}<small>${esc(h.bio)}</small>`, d.getBoundingClientRect().right + 8, d.getBoundingClientRect().top);
      d.onmouseleave = hideTip;
      P.appendChild(d); h.card = d;
    }
  }
  for (const h of G.party) {
    const d = h.card;
    d.classList.toggle('sel', G.sel === h);
    d.classList.toggle('act', !!G.combat && G.combat.active === h);
    d.classList.toggle('down', !!h.downed);
    d.querySelector('.hp b').style.width = Math.max(0, (h.hp / h.maxHp) * 100) + '%';
    d.querySelector('.hpn').textContent = `${Math.max(0, h.hp)}/${h.maxHp}`;
    d.querySelector('.lv').textContent = 'Lv' + h.level;
    d.querySelector('.cond').textContent = (h.blessed ? '🙏' : '') + (h.downed ? '💀' : '');
  }
}

export function hotbar(G) {
  const h = G.sel, C = G.combat, mine = !C || C.active === h;
  $('#who').innerHTML = h ? `${esc(h.name)}<small>${h.cls}</small>` : '';
  const res = $('#res');
  if (C && C.active === h && h.budget) {
    const b = h.budget;
    res.innerHTML = `<div class="pips"><span class="pip ${b.action ? '' : 'used'}" title="動作"></span>動作 <span class="pip b ${b.bonus ? '' : 'used'}" title="附贈動作"></span>附贈</div>
      <div>移動 ${b.move.toFixed(1)} 公尺</div><div class="mv"><b style="width:${Math.min(100, (b.move / (h.spd * (b.dashed ? 2 : 1))) * 100)}%"></b></div>`;
  } else if (C) res.innerHTML = `<div>${C.active ? esc(C.active.name) + ' 的回合' : ''}</div>`;
  else res.innerHTML = `<div>💰 ${G.gold} 金幣</div><div>🧪 藥水 ×${G.potions}</div>${h?.slotsMax ? `<div>✨ 法術位 ${h.slots}/${h.slotsMax}</div>` : ''}`;
  const bar = $('#hotbar'); bar.innerHTML = '';
  if (!h) return;
  h.abil.forEach((id, i) => {
    const ab = AB[id], b = document.createElement('button'); b.className = 'ab';
    const why = G.cannot(h, id);
    let u = '';
    if (ab.uses) u = h.uses[id];
    if (ab.slot) u = h.slots;
    if (id === 'potion') u = G.potions;
    b.innerHTML = `<span class="k">${i + 1}</span>${u !== '' ? `<span class="u">${u}</span>` : ''}<span class="ic">${ab.icon}</span><span class="nm2">${ab.name}</span>`;
    b.disabled = !mine || !!why;
    b.classList.toggle('on', G.pending === id);
    b.onclick = () => G.pickAbility(id);
    b.onmouseenter = () => { const r = b.getBoundingClientRect(); tip(abilityTip(h, id, why), r.left, r.top - 8, true); };
    b.onmouseleave = hideTip;
    bar.appendChild(b);
  });
  $('#turnbox').hidden = !(C && C.active === h);
}
function abilityTip(h, id, why) {
  const ab = AB[id];
  const cost = ab.cost === 'action' ? '<span style="color:#8fdc7a">● 動作</span>' : '<span style="color:#e3a541">◆ 附贈動作</span>';
  let extra = '';
  if (ab.range) extra += `　射程 ${ab.range} 公尺`;
  if (id === 'attack') extra = `　${h.weapon.name}，傷害 ${h.weapon.dmg}${sgn(h.dmgBonus())}${h.weapon.ranged ? `，射程 ${h.weapon.reach} 公尺` : ''}`;
  return `<b>${ab.icon} ${ab.name}</b>　${cost}${extra}<br>${esc(ab.desc)}${why ? `<br><span class="bad">${esc(why)}</span>` : ''}`;
}

export function initiative(G) {
  const C = G.combat, el = $('#init');
  if (!C) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span class="rd">第 ${C.round} 輪</span>` + C.order.filter((a) => !a.dead && !a.gone).map((a) => {
    const face = a.portrait ? `<img src="${a.portrait}" alt="">` : `<span class="ph">${a.icon || '?'}</span>`;
    return `<div class="ii ${a.team === 'foe' ? 'foe' : ''} ${C.active === a ? 'now' : ''}" title="${esc(a.name)}  ${a.hp}/${a.maxHp}">${face}<i><b style="width:${Math.max(0, (a.hp / a.maxHp) * 100)}%"></b></i></div>`;
  }).join('');
}

let tipEl;
export function tip(html, x, y, above = false) {
  tipEl ||= $('#tip');
  tipEl.innerHTML = html; tipEl.hidden = false;
  const r = tipEl.getBoundingClientRect();
  let left = x + 14, top = above ? y - r.height : y + 16;
  if (left + r.width > innerWidth - 6) left = innerWidth - r.width - 6;
  if (top + r.height > innerHeight - 6) top = innerHeight - r.height - 6;
  tipEl.style.left = Math.max(6, left) + 'px'; tipEl.style.top = Math.max(6, top) + 'px';
}
export function hideTip() { (tipEl ||= $('#tip')).hidden = true; }

export function quest(text, sub = '') { $('#quest span').innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : ''); }

// ---------------------------------------------------------------------------
// dialogue
let dlgKey = null;
export function dialogShow(on) { $('#dialog').hidden = !on; if (!on) dlgKey = null; }
export function dialogLine(speaker, role, portrait, text, opts) {
  // opts: [{t, tag, cls, dim}] → resolves to index
  const D = $('#dialog'); D.hidden = false;
  D.querySelector('.dname').textContent = speaker; D.querySelector('.drole').textContent = role || '';
  const cv = D.querySelector('.dpor'), g = cv.getContext('2d'); g.clearRect(0, 0, 96, 96);
  if (portrait) { const img = new Image(); img.onload = () => g.drawImage(img, 0, 0, 96, 96); img.src = portrait; }
  else { g.fillStyle = '#2a2018'; g.fillRect(0, 0, 96, 96); g.font = '48px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('📜', 48, 52); }
  const P = D.querySelector('.dtext'), O = D.querySelector('.dopts');
  O.innerHTML = '';
  return new Promise((res) => {
    let shown = 0, full = false;
    const html = text.replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');
    const plain = html.replace(/<[^>]+>/g, '');
    const showOpts = () => {
      full = true; P.innerHTML = html;
      O.innerHTML = '';
      opts.forEach((o, i) => {
        const li = document.createElement('li');
        li.innerHTML = (o.tag ? `<span class="chk ${o.cls || ''}">${esc(o.tag)}</span>` : '') + esc(o.t);
        if (o.dim) li.classList.add('dimmed');
        li.onclick = (e) => { e.stopPropagation(); finish(i); };
        li.onmouseenter = () => sfx('hover');
        O.appendChild(li);
      });
    };
    const finish = (i) => { sfx('click'); clearInterval(iv); dlgKey = null; P.onclick = null; res(i); };
    const iv = setInterval(() => {
      shown += 2;
      if (shown >= plain.length) { clearInterval(iv); showOpts(); return; }
      P.textContent = plain.slice(0, shown);
    }, 22);
    P.onclick = () => { if (!full) { clearInterval(iv); showOpts(); } };
    dlgKey = (k) => {
      if (!full) { if (k === ' ' || k === 'Enter') { clearInterval(iv); showOpts(); } return; }
      const n = parseInt(k, 10);
      if (n >= 1 && n <= opts.length) finish(n - 1);
      if ((k === ' ' || k === 'Enter') && opts.length === 1) finish(0);
    };
  });
}
export function dialogKey(k) { if (dlgKey) { dlgKey(k); return true; } return false; }

// dice roll overlay → {roll, total, ok}
export async function rollDice(label, sub, bonus, dc, adv = 0) {
  const D = $('#dice'), die = D.querySelector('.die'), num = die.querySelector('b');
  D.hidden = false;
  D.querySelector('.dlabel').innerHTML = esc(label) + `<small>${esc(sub)}　難度 DC ${dc}</small>`;
  D.querySelector('.dmath').textContent = ''; const R = D.querySelector('.dres'); R.textContent = ''; R.className = 'dres';
  die.className = 'die spin';
  sfx('dice');
  const a = 1 + Math.floor(Math.random() * 20), b2 = 1 + Math.floor(Math.random() * 20);
  const roll = adv > 0 ? Math.max(a, b2) : adv < 0 ? Math.min(a, b2) : a;
  for (let i = 0; i < 14; i++) { num.textContent = 1 + Math.floor(Math.random() * 20); await wait(45 + i * 6); }
  num.textContent = roll; die.className = 'die';
  const total = roll + bonus, ok = roll === 20 || (roll !== 1 && total >= dc);
  await wait(250);
  D.querySelector('.dmath').textContent = `${roll} ${bonus >= 0 ? '+' : '−'} ${Math.abs(bonus)} = ${total}`;
  await wait(350);
  die.className = 'die ' + (ok ? 'ok' : 'no');
  R.textContent = roll === 20 ? '大成功！' : roll === 1 ? '大失敗！' : ok ? '成功' : '失敗';
  R.className = 'dres ' + (ok ? 'ok' : 'no');
  sfx(ok ? 'success' : 'fail');
  await new Promise((res) => { const t = setTimeout(done, 1500); function done() { clearTimeout(t); D.onclick = null; res(); } D.onclick = done; });
  D.hidden = true;
  return { roll, total, ok };
}

export function modal(html, buttons = [{ t: '關閉', v: null }]) {
  const M = $('#modal'), B = M.querySelector('.mbox');
  B.innerHTML = html + `<div class="btns"></div>`;
  M.hidden = false;
  return new Promise((res) => {
    for (const b of buttons) {
      const el = document.createElement('button'); el.textContent = b.t; el.onclick = () => { sfx('click'); M.hidden = true; res(b.v); };
      B.querySelector('.btns').appendChild(el);
    }
  });
}
export const modalOpen = () => !$('#modal').hidden;
