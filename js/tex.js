// Canvas-painted textures.
import * as THREE from 'three';

let s = 9;
export const R = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const rr = (a, b) => a + R() * (b - a);
export const pick = (a) => a[Math.floor(R() * a.length)];

export function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function toTex(c, rep = [1, 1], color = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function speckle(g, w, h, n, cols, r0 = 1, r1 = 3, a = 0.25) {
  for (let i = 0; i < n; i++) { g.globalAlpha = a * R(); g.fillStyle = pick(cols); g.beginPath(); g.arc(R() * w, R() * h, rr(r0, r1), 0, 7); g.fill(); }
  g.globalAlpha = 1;
}

export function plaster(beam = '#4a3222', base = '#d6c8a6') {
  const [c, g] = canvas(256);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, 900, ['#bfae88', '#e6dbc0', '#a8987a'], 1, 6, 0.35);
  g.fillStyle = beam;
  const bw = 16;
  g.fillRect(0, 0, 256, bw); g.fillRect(0, 256 - bw, 256, bw); g.fillRect(0, 0, bw, 256); g.fillRect(256 - bw, 0, bw, 256); g.fillRect(120, 0, bw, 256); g.fillRect(0, 120, 256, bw * 0.8);
  g.lineWidth = bw * 0.8; g.strokeStyle = beam;
  g.beginPath(); g.moveTo(bw, 120); g.lineTo(120, bw); g.moveTo(136, bw); g.lineTo(240, 120); g.stroke();
  speckle(g, 256, 256, 300, ['#2a1b12', '#5b3e2a'], 1, 3, 0.4);
  return c;
}
export function shingles(cols) {
  const [c, g] = canvas(256);
  g.fillStyle = cols[0]; g.fillRect(0, 0, 256, 256);
  const rows = 12, rh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * 12;
    for (let x = -24; x < 256; x += 24) {
      g.fillStyle = pick(cols); g.globalAlpha = 0.85 + R() * 0.15;
      g.beginPath(); g.roundRect(x + off + 1, r * rh + 1, 22, rh + 4, [0, 0, 6, 6]); g.fill();
      g.globalAlpha = 0.35; g.fillStyle = '#000'; g.fillRect(x + off + 1, r * rh + rh, 22, 3);
    }
  }
  g.globalAlpha = 1;
  return c;
}
export function thatch() {
  const [c, g] = canvas(256);
  g.fillStyle = '#8a7340'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    const x = R() * 256, y = R() * 256;
    g.strokeStyle = pick(['#a68c4f', '#6e5a2f', '#b89b5a', '#7d6838']); g.globalAlpha = 0.6; g.lineWidth = rr(1, 2.5);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(-2, 2), y + rr(10, 22)); g.stroke();
  }
  for (let y = 0; y < 256; y += 32) { g.globalAlpha = 0.3; g.fillStyle = '#3a2d14'; g.fillRect(0, y + 28, 256, 4); }
  g.globalAlpha = 1;
  return c;
}
export function stone(base = '#7a7468', mortar = '#3b3832', big = false) {
  const [c, g] = canvas(256);
  g.fillStyle = mortar; g.fillRect(0, 0, 256, 256);
  const rh = big ? 64 : 32;
  for (let y = 0; y < 256; y += rh) {
    let x = -R() * 40;
    while (x < 256) {
      const w = rr(rh * 1.1, rh * 2.2);
      const l = 0.85 + R() * 0.3;
      g.fillStyle = shade(base, l);
      g.beginPath(); g.roundRect(x + 2, y + 2, w - 4, rh - 4, 5); g.fill();
      x += w;
    }
  }
  speckle(g, 256, 256, 1200, ['#000', '#fff', '#5b6b3a'], 0.5, 2.5, 0.12);
  return c;
}
export function planks(base = '#6b4b2e') {
  const [c, g] = canvas(256);
  for (let y = 0; y < 256; y += 32) {
    g.fillStyle = shade(base, 0.85 + R() * 0.3); g.fillRect(0, y, 256, 32);
    g.fillStyle = '#0006'; g.fillRect(0, y + 30, 256, 2);
    for (let i = 0; i < 18; i++) { g.strokeStyle = '#0002'; g.lineWidth = 1; g.beginPath(); const yy = y + R() * 30; g.moveTo(0, yy); g.bezierCurveTo(80, yy + rr(-3, 3), 170, yy + rr(-3, 3), 256, yy + rr(-2, 2)); g.stroke(); }
  }
  return c;
}
export function cloth(a = '#8b2c2c', b = '#d8c79e') {
  const [c, g] = canvas(128);
  for (let x = 0; x < 128; x += 16) { g.fillStyle = (x / 16) % 2 ? b : a; g.fillRect(x, 0, 16, 128); }
  speckle(g, 128, 128, 200, ['#000'], 0.5, 1.5, 0.15);
  return c;
}
export function bark() {
  const [c, g] = canvas(64, 256);
  g.fillStyle = '#4b3a2a'; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 140; i++) { g.strokeStyle = pick(['#2e2217', '#5e4a36', '#3a2c1f']); g.lineWidth = rr(1, 4); const x = R() * 64; g.beginPath(); g.moveTo(x, R() * 256); g.lineTo(x + rr(-3, 3), R() * 256); g.stroke(); }
  return c;
}
export function waterNormal() {
  const [c, g] = canvas(256);
  const img = g.createImageData(256, 256), d = img.data;
  const h = (x, y) => Math.sin(x * 0.07 + Math.sin(y * 0.05) * 2) * 0.5 + Math.sin(y * 0.11 + x * 0.03) * 0.35 + Math.sin((x + y) * 0.19) * 0.15;
  const P = (x) => (x / 256) * Math.PI * 2;
  const hh = (x, y) => h(Math.sin(P(x)) * 60 + Math.cos(P(y)) * 40 + x * 0, Math.cos(P(x)) * 50 + Math.sin(P(y)) * 70);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const dx = hh(x + 1, y) - hh(x - 1, y), dy = hh(x, y + 1) - hh(x, y - 1);
    const i = (y * 256 + x) * 4;
    d[i] = 128 + dx * 160; d[i + 1] = 128 + dy * 160; d[i + 2] = 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
export function softDot() {
  const [c, g] = canvas(64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}
export function textTex(text, w = 256, h = 96, bg = '#3a2616', fg = '#f0d79a', font = '900 54px "Noto Serif TC", serif') {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1a0f07'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 3);
  return toTex(c);
}
export function shade(hex, l) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * l)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
