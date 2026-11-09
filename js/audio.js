// Synthesized sound effects, ambience and a simple adaptive score.
let ctx = null, master, sfxG, musG, ambG, noiseBuf;
export const AU = { vol: 0.8, music: 0.5, on: true };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = AU.vol; master.connect(ctx.destination);
  sfxG = ctx.createGain(); sfxG.gain.value = 0.9; sfxG.connect(master);
  musG = ctx.createGain(); musG.gain.value = AU.music * 0.5; musG.connect(master);
  ambG = ctx.createGain(); ambG.gain.value = 0.5; ambG.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  ambience(); music();
}
export function setVol(v, m) { AU.vol = v; AU.music = m; if (master) { master.gain.value = v; musG.gain.value = m * 0.5; } }

function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
function osc(type, f, t, dur, peak, dest = sfxG, f2) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, 0.005, peak, dur); o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function noise(t, dur, peak, type = 'lowpass', f = 1200, f2, q = 1, dest = sfxG) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = ctx.createGain(); env(g, t, 0.01, peak, dur);
  s.connect(fl).connect(g).connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

export function sfx(name) {
  if (!ctx || !AU.on) return;
  const t = ctx.currentTime;
  switch (name) {
    case 'click': osc('triangle', 900, t, 0.06, 0.15); break;
    case 'hover': osc('sine', 1400, t, 0.03, 0.04); break;
    case 'swing': noise(t, 0.22, 0.35, 'bandpass', 600, 2400, 2); break;
    case 'hit': noise(t, 0.18, 0.7, 'lowpass', 1800, 200); osc('sine', 140, t, 0.2, 0.6, sfxG, 50); break;
    case 'clang': [1, 2.76, 5.4].forEach((m, i) => osc('square', 520 * m, t, 0.4 - i * 0.1, 0.08)); noise(t, 0.1, 0.4, 'highpass', 3000); break;
    case 'miss': noise(t, 0.3, 0.25, 'bandpass', 1500, 500, 3); break;
    case 'bow': osc('triangle', 220, t, 0.18, 0.3, sfxG, 110); noise(t, 0.08, 0.2, 'highpass', 2000); break;
    case 'arrow': noise(t, 0.12, 0.4, 'bandpass', 2500, 800, 2); osc('sine', 300, t, 0.08, 0.3, sfxG, 100); break;
    case 'fire': noise(t, 0.6, 0.6, 'lowpass', 400, 2600, 1); noise(t + 0.05, 0.5, 0.3, 'bandpass', 900, 300, 1); break;
    case 'boom': noise(t, 0.9, 0.9, 'lowpass', 900, 80); osc('sine', 90, t, 0.8, 0.8, sfxG, 30); break;
    case 'magic': [0, 0.06, 0.12, 0.18].forEach((d, i) => osc('sine', 660 * [1, 1.25, 1.5, 2][i], t + d, 0.3, 0.12)); break;
    case 'heal': [0, 0.08, 0.16, 0.26].forEach((d, i) => osc('sine', 523 * [1, 1.25, 1.5, 2][i], t + d, 0.6, 0.12)); break;
    case 'holy': [0, 0.1].forEach((d) => osc('sawtooth', 392, t + d, 0.7, 0.05)); osc('sine', 784, t, 1, 0.15); noise(t, 0.5, 0.2, 'highpass', 4000); break;
    case 'dice': for (let i = 0; i < 9; i++) osc('square', 1800 + Math.random() * 1200, t + i * 0.07 + Math.random() * 0.02, 0.03, 0.05); break;
    case 'success': [0, 0.1, 0.2].forEach((d, i) => osc('triangle', 523 * [1, 1.26, 1.5][i], t + d, 0.5, 0.18)); break;
    case 'fail': [0, 0.15].forEach((d, i) => osc('triangle', [330, 247][i], t + d, 0.5, 0.18)); break;
    case 'crit': [0, 0.07, 0.14, 0.21].forEach((d, i) => osc('square', 523 * [1, 1.26, 1.5, 2][i], t + d, 0.4, 0.1)); break;
    case 'growl': osc('sawtooth', 80, t, 0.6, 0.2, sfxG, 60); noise(t, 0.6, 0.3, 'lowpass', 300); break;
    case 'bones': for (let i = 0; i < 6; i++) osc('square', 300 + Math.random() * 400, t + i * 0.05, 0.04, 0.08); break;
    case 'chest': osc('sawtooth', 120, t, 0.4, 0.12, sfxG, 180); [0.35, 0.45, 0.55].forEach((d, i) => osc('sine', 880 * [1, 1.25, 1.5][i], t + d, 0.5, 0.1)); break;
    case 'coin': [0, 0.08].forEach((d) => osc('square', 1760, t + d, 0.15, 0.06)); break;
    case 'level': [0, 0.12, 0.24, 0.36, 0.5].forEach((d, i) => osc('triangle', 392 * [1, 1.26, 1.5, 2, 2.52][i], t + d, 0.6, 0.15)); break;
    case 'start': [0, 0.2, 0.4].forEach((d, i) => { osc('sawtooth', [110, 147, 165][i], t + d, 0.8, 0.12); }); noise(t, 1.2, 0.3, 'lowpass', 200, 1200); break;
    case 'step': noise(t, 0.05, 0.08, 'lowpass', 500); break;
    case 'extinguish': noise(t, 0.8, 0.5, 'highpass', 6000, 800); break;
  }
}

// --- ambience: wind + crickets + water ---
function ambience() {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
  const g = ctx.createGain(); g.gain.value = 0.07; s.connect(f).connect(g).connect(ambG); s.start();
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.04; lfo.connect(lg).connect(g.gain); lfo.start();
  const chirp = () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (AU.on && AMB.crickets > 0.05) for (let i = 0; i < 3; i++) osc('sine', 4200 + Math.random() * 300, t + i * 0.06, 0.03, 0.012 * AMB.crickets, ambG);
    setTimeout(chirp, 300 + Math.random() * 900);
  };
  chirp();
  const w = ctx.createBufferSource(); w.buffer = noiseBuf; w.loop = true;
  const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 900; wf.Q.value = 0.6;
  AMB.water = ctx.createGain(); AMB.water.gain.value = 0; w.connect(wf).connect(AMB.water).connect(ambG); w.start();
}
export const AMB = { crickets: 1, water: null };
export function setWater(v) { if (AMB.water) AMB.water.gain.setTargetAtTime(v * 0.06, ctx.currentTime, 0.3); }

// --- music: slow pad chords; in combat a pulse and lower minor chords ---
let mode = 'explore';
export function musicMode(m) { mode = m; }
function music() {
  const chordsE = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const chordsC = [[45, 48, 52], [46, 50, 53], [43, 46, 50], [45, 49, 52]];
  let bar = 0;
  const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
  const tick = () => {
    if (!ctx) return;
    const t = ctx.currentTime + 0.05, combat = mode === 'combat';
    const ch = (combat ? chordsC : chordsE)[bar % 4], len = combat ? 2.4 : 4.8;
    if (AU.on) {
      for (const n of ch) {
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = mtof(n); o2.frequency.value = mtof(n) * 1.004;
        f.type = 'lowpass'; f.frequency.value = combat ? 900 : 650;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + len * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + len * 1.05);
        o.connect(f); o2.connect(f); f.connect(g).connect(musG); o.start(t); o2.start(t); o.stop(t + len * 1.1); o2.stop(t + len * 1.1);
      }
      // plucked arpeggio
      const arp = combat ? [0, 1, 2, 1, 0, 2, 1, 2] : [0, 1, 2, 1];
      arp.forEach((k, i) => {
        const tt = t + i * (len / arp.length), o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = mtof(ch[k] + 12 + (combat ? 0 : 12));
        g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(combat ? 0.05 : 0.035, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.9);
        o.connect(g).connect(musG); o.start(tt); o.stop(tt + 1);
      });
      if (combat) for (let i = 0; i < 4; i++) { const tt = t + i * len / 4; osc('sine', 70, tt, 0.25, 0.25, musG, 40); if (i % 2) noise(tt, 0.08, 0.08, 'highpass', 5000, null, 1, musG); }
    }
    bar++;
    setTimeout(tick, len * 1000);
  };
  tick();
}
