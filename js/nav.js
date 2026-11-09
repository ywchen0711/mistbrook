// Walk grid (0.5 m cells) with A* and string-pulling.
export const MAP = { x0: -40, z0: -54, w: 80, h: 92, cell: 0.5 };
export const WALK = { x0: -29, x1: 29, z0: -50, z1: 36 };

export class Nav {
  constructor() {
    this.W = MAP.w / MAP.cell; this.H = MAP.h / MAP.cell;
    this.block = new Uint8Array(this.W * this.H);
    this.dyn = new Uint8Array(this.W * this.H);
    for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) {
      const [x, z] = this.center(i, j);
      if (x < WALK.x0 || x > WALK.x1 || z < WALK.z0 || z > WALK.z1) this.block[j * this.W + i] = 1;
    }
    const n = this.W * this.H;
    this.g = new Float32Array(n); this.came = new Int32Array(n); this.stamp = new Uint32Array(n); this.closed = new Uint32Array(n); this.run = 0;
  }
  ci(x, z) { return [Math.floor((x - MAP.x0) / MAP.cell), Math.floor((z - MAP.z0) / MAP.cell)]; }
  center(i, j) { return [MAP.x0 + (i + 0.5) * MAP.cell, MAP.z0 + (j + 0.5) * MAP.cell]; }
  inb(i, j) { return i >= 0 && j >= 0 && i < this.W && j < this.H; }
  free(i, j) { return this.inb(i, j) && !this.block[j * this.W + i] && !this.dyn[j * this.W + i]; }
  freeAt(x, z) { const [i, j] = this.ci(x, z); return this.free(i, j); }
  staticFreeAt(x, z) { const [i, j] = this.ci(x, z); return this.inb(i, j) && !this.block[j * this.W + i]; }
  blockCircle(x, z, r, v = 1, arr = this.block) {
    const [i0, j0] = this.ci(x - r, z - r), [i1, j1] = this.ci(x + r, z + r);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!this.inb(i, j)) continue;
      const [cx, cz] = this.center(i, j);
      if ((cx - x) ** 2 + (cz - z) ** 2 <= r * r) arr[j * this.W + i] = v;
    }
  }
  blockRect(x, z, w, d, rot = 0, pad = 0.25) {
    const R = Math.hypot(w, d) / 2 + pad, c = Math.cos(rot), s = Math.sin(rot);
    const [i0, j0] = this.ci(x - R, z - R), [i1, j1] = this.ci(x + R, z + R);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!this.inb(i, j)) continue;
      const [cx, cz] = this.center(i, j), dx = cx - x, dz = cz - z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) <= w / 2 + pad && Math.abs(lz) <= d / 2 + pad) this.block[j * this.W + i] = 1;
    }
  }
  setActors(list, r = 0.55) {
    this.dyn.fill(0);
    for (const a of list) this.blockCircle(a.pos.x, a.pos.z, r, 1, this.dyn);
  }
  clearActors() { this.dyn.fill(0); }
  los(ax, az, bx, bz) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 0.2);
    for (let k = 1; k < n; k++) { const t = k / n; if (!this.freeAt(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  nearestFree(x, z, maxR = 4) {
    const [i0, j0] = this.ci(x, z);
    if (this.free(i0, j0)) return this.center(i0, j0);
    for (let r = 1; r <= maxR / MAP.cell; r++) {
      let best = null, bd = 1e9;
      for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r || !this.free(i, j)) continue;
        const [cx, cz] = this.center(i, j), dd = (cx - x) ** 2 + (cz - z) ** 2;
        if (dd < bd) { bd = dd; best = [cx, cz]; }
      }
      if (best) return best;
    }
    return null;
  }
  // returns [{x,z}, ...] starting after the start point, or null
  find(ax, az, bx, bz, maxIter = 40000) {
    const [si, sj] = this.ci(ax, az);
    let goal = this.nearestFree(bx, bz);
    if (!goal) return null;
    const [gi, gj] = this.ci(goal[0], goal[1]);
    const W = this.W, start = sj * W + si, gIdx = gj * W + gi;
    if (start === gIdx) return [{ x: goal[0], z: goal[1] }];
    const run = ++this.run, g = this.g, came = this.came, stamp = this.stamp, closed = this.closed;
    const heap = [], hf = [];
    const push = (idx, f) => { heap.push(idx); hf.push(f); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; [hf[p], hf[k]] = [hf[k], hf[p]]; k = p; } };
    const pop = () => { const top = heap[0]; const li = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = li; hf[0] = lf; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && hf[l] < hf[m]) m = l; if (r < heap.length && hf[r] < hf[m]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; [hf[m], hf[k]] = [hf[k], hf[m]]; k = m; } } return top; };
    const H = (i, j) => { const dx = Math.abs(i - gi), dy = Math.abs(j - gj); return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)); };
    stamp[start] = run; g[start] = 0; came[start] = -1; push(start, H(si, sj));
    let it = 0, found = false;
    while (heap.length && it++ < maxIter) {
      const cur = pop();
      if (closed[cur] === run) continue;
      closed[cur] = run;
      if (cur === gIdx) { found = true; break; }
      const ci = cur % W, cj = (cur / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!this.free(ni, nj)) continue;
        if (di && dj && (!this.free(ci + di, cj) || !this.free(ci, cj + dj))) continue;
        const nIdx = nj * W + ni;
        if (closed[nIdx] === run) continue;
        const ng = g[cur] + (di && dj ? Math.SQRT2 : 1);
        if (stamp[nIdx] !== run || ng < g[nIdx]) { stamp[nIdx] = run; g[nIdx] = ng; came[nIdx] = cur; push(nIdx, ng + H(ni, nj)); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = gIdx; c !== -1; c = came[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map((c) => { const [x, z] = this.center(c % W, (c / W) | 0); return { x, z }; });
    pts[0] = { x: ax, z: az };
    pts[pts.length - 1] = { x: goal[0], z: goal[1] };
    // string pull
    const out = [pts[0]];
    let a = 0;
    while (a < pts.length - 1) {
      let b = pts.length - 1;
      while (b > a + 1 && !this.los(pts[a].x, pts[a].z, pts[b].x, pts[b].z)) b--;
      out.push(pts[b]); a = b;
    }
    out.shift();
    return out;
  }
}

export const pathLen = (from, pts) => { let L = 0, p = from; for (const q of pts) { L += Math.hypot(q.x - p.x, q.z - p.z); p = q; } return L; };
// cut a path so its length is at most max
export function cutPath(from, pts, max) {
  const out = []; let p = from, L = 0;
  for (const q of pts) {
    const s = Math.hypot(q.x - p.x, q.z - p.z);
    if (L + s <= max) { out.push(q); L += s; p = q; continue; }
    const t = (max - L) / s;
    if (t > 0.02) out.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t });
    break;
  }
  return out;
}
