// Dice, stats, heroes, enemies and abilities. Loosely tabletop-flavoured: d20 + bonus against a target number.

export const d = (n) => 1 + Math.floor(Math.random() * n);
export const mod = (s) => Math.floor((s - 10) / 2);
export const sgn = (n) => (n >= 0 ? '+' + n : '' + n);
export const PROF = 2;

export function rollExpr(e, crit = false) {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(e);
  let n = +m[1]; const s = +m[2], b = +(m[3] || 0);
  if (crit) n *= 2;
  let t = b;
  for (let i = 0; i < n; i++) t += d(s);
  return Math.max(1, t);
}
export function exprRange(e, extra = 0) {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(e);
  const n = +m[1], s = +m[2], b = +(m[3] || 0) + extra;
  return [Math.max(1, n + b), n * s + b];
}
export const addBonus = (e, b) => {
  const m = /^(\d+d\d+)([+-]\d+)?$/.exec(e);
  const t = +(m[2] || 0) + b;
  return m[1] + (t ? sgn(t) : '');
};

// chance that d20 + bonus >= target, with natural 1 / 20 rules; adv: 1 advantage, -1 disadvantage
export function chance(bonus, target, adv = 0) {
  let p = (21 - (target - bonus)) / 20;
  p = Math.min(0.95, Math.max(0.05, p));
  if (adv > 0) p = 1 - (1 - p) ** 2;
  if (adv < 0) p = p * p;
  return p;
}
export function d20(adv = 0) {
  const a = d(20), b = d(20);
  return adv > 0 ? Math.max(a, b) : adv < 0 ? Math.min(a, b) : a;
}

export const SKILLS = {
  athletics: ['運動', 'str'], intimidation: ['威嚇', 'cha'], persuasion: ['說服', 'cha'], deception: ['欺瞞', 'cha'],
  insight: ['洞悉', 'wis'], perception: ['察覺', 'wis'], medicine: ['醫療', 'wis'], arcana: ['奧秘', 'int'],
  religion: ['宗教', 'int'], stealth: ['隱匿', 'dex'],
};
export const STAT_ZH = { str: '力量', dex: '敏捷', con: '體質', int: '智力', wis: '感知', cha: '魅力' };
export const skillBonus = (h, sk) => mod(h.st[SKILLS[sk][1]]) + (h.prof.includes(sk) ? PROF : 0);

export const AB = {
  attack:    { name: '攻擊', icon: '⚔️', cost: 'action', target: 'foe', kind: 'weapon', desc: '用手上的武器攻擊。' },
  cleave:    { name: '橫掃', icon: '🌀', cost: 'action', target: 'foe', kind: 'cleave', uses: 2, desc: '攻擊目標，並對它身旁 2 公尺內的其他敵人各攻擊一次。每次休息可用 2 次。' },
  secondwind:{ name: '回氣', icon: '💨', cost: 'bonus', target: 'self', kind: 'heal', heal: '1d10+2', uses: 1, desc: '喘一口氣，回復 1d10+2 生命。每次休息可用 1 次。' },
  potion:    { name: '藥水', icon: '🧪', cost: 'bonus', target: 'ally', range: 2, kind: 'potion', heal: '2d4+2', desc: '喝下一瓶治療藥水（或餵給身邊的同伴），回復 2d4+2。也能救起倒地的同伴。' },
  dash:      { name: '衝刺', icon: '👟', cost: 'action', target: 'self', kind: 'dash', desc: '用掉動作，這回合可移動的距離加倍。' },
  help:      { name: '扶起', icon: '🤝', cost: 'action', target: 'downed', range: 2, kind: 'help', desc: '把身邊倒地的同伴扶起來，回復 1 點生命。' },
  mark:      { name: '獵人印記', icon: '🎯', cost: 'bonus', target: 'foe', range: 18, kind: 'mark', uses: 3, desc: '標記一個敵人。之後你打中它，額外造成 1d6 傷害。每次休息可用 3 次。' },
  volley:    { name: '箭雨', icon: '🏹', cost: 'action', target: 'area', range: 18, radius: 2.6, kind: 'volley', uses: 1, desc: '向一片區域射出箭雨，對範圍內每個敵人各攻擊一次。每次休息可用 1 次。' },
  firebolt:  { name: '火焰箭', icon: '🔥', cost: 'action', target: 'foe', range: 15, kind: 'spell', dmg: '1d10', type: 'fire', desc: '戲法，用不完。射出一團火，造成 1d10 火焰傷害。' },
  missile:   { name: '魔法飛彈', icon: '✨', cost: 'action', target: 'foe', range: 16, kind: 'missile', slot: true, desc: '三枚一定命中的飛彈，每枚 1d4+1。消耗一個法術位。' },
  thunder:   { name: '雷鳴波', icon: '⚡', cost: 'action', target: 'area', range: 9, radius: 2.6, kind: 'save', save: 'con', dmg: '2d8', type: 'thunder', slot: true, desc: '範圍內的敵人做體質豁免：失敗受 2d8 雷鳴傷害並被震退，成功減半。消耗一個法術位。' },
  flame:     { name: '神聖烈焰', icon: '☀️', cost: 'action', target: 'foe', range: 15, kind: 'save1', save: 'dex', dmg: '1d8', type: 'radiant', desc: '戲法，用不完。目標做敏捷豁免，失敗就受 1d8 光耀傷害。' },
  healword:  { name: '治療之言', icon: '💚', cost: 'bonus', target: 'ally', range: 15, kind: 'heal', heal: '1d4+3', slot: true, desc: '遠距治療一位同伴 1d4+3，也能救起倒地的人。消耗一個法術位。' },
  bless:     { name: '祝福', icon: '🙏', cost: 'action', target: 'self', kind: 'bless', slot: true, desc: '三回合內，全隊攻擊命中 +2。消耗一個法術位。' },
};

export const HEROES = [
  { id: 'kael', name: '凱爾', cls: '戰士', hp: 27, ac: 17, spd: 9, st: { str: 16, dex: 12, con: 15, int: 9, wis: 11, cha: 13 },
    prof: ['athletics', 'intimidation', 'perception'], weapon: { name: '長劍', dmg: '1d8', stat: 'str', reach: 2, type: 'slash' },
    abil: ['attack', 'cleave', 'secondwind', 'potion', 'dash', 'help'], hitDie: 10, color: '#d9534a',
    look: { kind: 'kael' }, bio: '退役的邊境騎士，說話直，劍更直。' },
  { id: 'vera', name: '薇拉', cls: '遊俠', hp: 22, ac: 15, spd: 10, st: { str: 11, dex: 17, con: 13, int: 12, wis: 14, cha: 10 },
    prof: ['perception', 'stealth', 'insight', 'athletics'], weapon: { name: '長弓', dmg: '1d8', stat: 'dex', reach: 18, ranged: true, type: 'pierce' },
    abil: ['attack', 'mark', 'volley', 'potion', 'dash', 'help'], hitDie: 10, color: '#5fae5a',
    look: { kind: 'vera' }, bio: '半精靈獵人，在森林裡長大，耳朵比狗還靈。' },
  { id: 'orin', name: '歐林', cls: '法師', hp: 16, ac: 12, spd: 9, st: { str: 8, dex: 14, con: 12, int: 17, wis: 12, cha: 11 },
    prof: ['arcana', 'religion', 'insight'], weapon: { name: '橡木法杖', dmg: '1d6', stat: 'str', reach: 2, type: 'bludgeon' },
    abil: ['firebolt', 'missile', 'thunder', 'attack', 'potion', 'help'], cast: 'int', slots: 3, hitDie: 6, color: '#5a8fe0',
    look: { kind: 'orin' }, bio: '老學者，研究古代燈火魔法。脾氣好，咒語不太好。' },
  { id: 'sera', name: '瑟拉', cls: '牧師', hp: 22, ac: 16, spd: 9, st: { str: 13, dex: 10, con: 14, int: 11, wis: 16, cha: 14 },
    prof: ['medicine', 'persuasion', 'religion', 'insight'], weapon: { name: '釘頭錘', dmg: '1d6', stat: 'str', reach: 2, type: 'bludgeon' },
    abil: ['attack', 'flame', 'healword', 'bless', 'potion', 'help'], cast: 'wis', slots: 3, hitDie: 8, color: '#e8c35a',
    look: { kind: 'sera' }, bio: '晨曦神殿的年輕牧師，相信每個人都值得第二次機會。' },
];
export const DEFAULT_AB = { kael: 'attack', vera: 'attack', orin: 'firebolt', sera: 'attack' };

// Enemies have fixed stats; they never scale with the party.
export const FOES = {
  goblin:   { name: '哥布林', hp: 9, ac: 13, spd: 9, atk: 4, dmg: '1d6+2', reach: 2, type: 'slash', xp: 50, sv: { dex: 2, con: 0, wis: -1 }, look: 'goblin', icon: '👺' },
  archer:   { name: '哥布林弓手', hp: 8, ac: 12, spd: 9, atk: 4, dmg: '1d6+2', reach: 16, ranged: true, type: 'pierce', xp: 50, sv: { dex: 2, con: 0, wis: -1 }, look: 'archer', icon: '🏹' },
  grukk:    { name: '格魯克', hp: 24, ac: 15, spd: 9, atk: 5, dmg: '1d10+3', reach: 2.2, type: 'slash', xp: 200, sv: { dex: 1, con: 2, wis: 0 }, look: 'grukk', icon: '👹' },
  wolf:     { name: '灰狼', hp: 11, ac: 12, spd: 12, atk: 4, dmg: '1d6+2', reach: 2, type: 'pierce', xp: 50, sv: { dex: 2, con: 1, wis: 1 }, look: 'wolf', icon: '🐺' },
  skeleton: { name: '骷髏兵', hp: 13, ac: 13, spd: 9, atk: 4, dmg: '1d6+2', reach: 2, type: 'slash', xp: 50, vuln: ['bludgeon', 'thunder'], sv: { dex: 2, con: 2, wis: -1 }, look: 'skeleton', icon: '💀' },
  priest:   { name: '莫洛斯', hp: 38, ac: 13, spd: 9, atk: 5, dmg: '2d6+1', reach: 15, ranged: true, spell: true, type: 'fire', xp: 450, sv: { dex: 1, con: 1, wis: 3 }, look: 'priest', icon: '🕯️' },
};

export const LEVELS = [0, 0, 0, 600, 1500]; // xp needed for level n (party starts at 2)
