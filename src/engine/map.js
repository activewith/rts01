// map.js — 타일, 점유, 경로탐색(A*), 시야선, 공간 해시, 시야(안개), 기본 맵 생성기
RTS.tile = (G, x, y) => (x < 0 || y < 0 || x >= G.w || y >= G.h ? 1 : G.tiles[y * G.w + x]);
RTS.walkable = (G, x, y) => {
  if (x < 0 || y < 0 || x >= G.w || y >= G.h) return false;
  const i = y * G.w + x;
  return RTS.terrainPass[G.tiles[i]] && !G._occ[i];
};
RTS.terrainPass = [true, false, true]; // 0 땅, 1 암벽, 2 모래. 맵 생성 후 defs.terrain이 덮어씀

RTS.rectOf = e => { const s = RTS.defs.entities[e.def].size; return { x0: e.x - s[0] / 2, y0: e.y - s[1] / 2, w: s[0], h: s[1] }; };
RTS.occupy = function (G, e, val) {
  const r = RTS.rectOf(e);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const tx = Math.round(r.x0) + x, ty = Math.round(r.y0) + y;
    if (tx >= 0 && ty >= 0 && tx < G.w && ty < G.h) G._occ[ty * G.w + tx] = val;
  }
};

// 가장 가까운 통행 가능 타일 (나선 탐색)
RTS.nearestFree = function (G, x, y, maxR = 12) {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (RTS.walkable(G, cx, cy)) return { x, y };
  for (let r = 1; r <= maxR; r++) {
    let best = null, bd = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !RTS.walkable(G, cx + dx, cy + dy)) continue;
      const d = (cx + dx + .5 - x) ** 2 + (cy + dy + .5 - y) ** 2;
      if (d < bd) { bd = d; best = { x: cx + dx + .5, y: cy + dy + .5 }; }
    }
    if (best) return best;
  }
  return { x, y };
};

RTS.lineClear = function (G, x0, y0, x1, y1, r = .32) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  if (len < .01) return true;
  const n = Math.ceil(len / .25), px = -dy / len * r, py = dx / len * r;
  for (let i = 1; i <= n; i++) {
    const x = x0 + dx * i / n, y = y0 + dy * i / n;
    if (!RTS.walkable(G, Math.floor(x + px), Math.floor(y + py)) || !RTS.walkable(G, Math.floor(x - px), Math.floor(y - py))) return false;
  }
  return true;
};

// 이진 힙 A*. goal = {x,y} 또는 {x0,y0,x1,y1} 타일 사각형
const AS = { size: 0 };
function asInit(n) { if (AS.size === n) return; AS.size = n; AS.g = new Float32Array(n); AS.from = new Int32Array(n); AS.stamp = new Int32Array(n); AS.closed = new Int32Array(n); AS.gen = 0; }
RTS.findPath = function (G, sx, sy, goal) {
  const w = G.w, n = w * G.h; asInit(n);
  const gen = ++AS.gen, start = Math.floor(sy) * w + Math.floor(sx);
  const rect = goal.x0 !== undefined;
  const gx = rect ? (goal.x0 + goal.x1) / 2 : Math.floor(goal.x), gy = rect ? (goal.y0 + goal.y1) / 2 : Math.floor(goal.y);
  const H = (x, y) => { const a = Math.abs(x - gx), b = Math.abs(y - gy); return (a + b) + (1.414 - 2) * Math.min(a, b); };
  const isGoal = (x, y) => rect ? (x >= goal.x0 && x <= goal.x1 && y >= goal.y0 && y <= goal.y1) : (x === gx && y === gy);
  const heap = [], f = []; // 힙은 노드 인덱스, f는 우선순위
  const push = (i, p) => { let c = heap.length; heap.push(i); f.push(p);
    while (c > 0) { const q = (c - 1) >> 1; if (f[q] <= f[c]) break; [heap[q], heap[c]] = [heap[c], heap[q]]; [f[q], f[c]] = [f[c], f[q]]; c = q; } };
  const pop = () => { const top = heap[0], li = heap.pop(), lf = f.pop();
    if (heap.length) { heap[0] = li; f[0] = lf; let c = 0;
      for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && f[l] < f[m]) m = l; if (r < heap.length && f[r] < f[m]) m = r; if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]]; [f[m], f[c]] = [f[c], f[m]]; c = m; } }
    return top; };
  AS.g[start] = 0; AS.stamp[start] = gen; AS.from[start] = -1; push(start, 0);
  let best = start, bestH = 1e9, found = -1, visited = 0;
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
  while (heap.length && visited < 7000) {
    const cur = pop();
    if (AS.closed[cur] === gen) continue; AS.closed[cur] = gen; visited++;
    const cx = cur % w, cy = (cur / w) | 0;
    if (isGoal(cx, cy)) { found = cur; break; }
    const h = H(cx, cy); if (h < bestH) { bestH = h; best = cur; }
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (!RTS.walkable(G, nx, ny)) continue;
      if (d >= 4 && (!RTS.walkable(G, nx, cy) || !RTS.walkable(G, cx, ny))) continue; // 모서리 끼기 금지
      const ni = ny * w + nx, cost = AS.g[cur] + (d >= 4 ? 1.414 : 1);
      if (AS.stamp[ni] !== gen || cost < AS.g[ni]) { AS.stamp[ni] = gen; AS.g[ni] = cost; AS.from[ni] = cur; AS.closed[ni] = 0; push(ni, cost + H(nx, ny) * 1.02); }
    }
  }
  const end = found >= 0 ? found : best, pts = [];
  for (let c = end; c !== -1; c = AS.from[c]) pts.push([c % w + .5, ((c / w) | 0) + .5]);
  pts.reverse();
  if (found >= 0 && !rect) pts[pts.length - 1] = [goal.x, goal.y];
  const out = []; let ax = sx, ay = sy, i = 0; // 끈 당기기 평활화
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !RTS.lineClear(G, ax, ay, pts[j][0], pts[j][1])) j--;
    out.push(pts[j]); ax = pts[j][0]; ay = pts[j][1]; i = j + 1;
  }
  return out;
};

// 공간 해시 — 매 틱 재구성. 저장되지 않는다.
RTS.rebuildGrid = function (G) {
  for (const c of G._grid) c.length = 0;
  for (const e of G.ents) { if (e.dead || e.team === -1) continue; G._grid[(Math.min(G._rows - 1, e.y >> 2)) * G._cols + Math.min(G._cols - 1, e.x >> 2)].push(e); }
};
RTS.query = function (G, x, y, r, fn) {
  const pad = r + 3, x0 = Math.max(0, (x - pad) >> 2), x1 = Math.min(G._cols - 1, (x + pad) >> 2), y0 = Math.max(0, (y - pad) >> 2), y1 = Math.min(G._rows - 1, (y + pad) >> 2);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const c = G._grid[cy * G._cols + cx]; for (let i = 0; i < c.length; i++) fn(c[i]); }
};

// 시야: 8틱마다 사람 팀만 계산. vis=현재 보임, seen=한 번이라도 봄
RTS.updateFog = function (G, force) {
  if (G.nofog || (!force && G.tick % 8)) return;
  for (const t of G.teams) {
    if (t.ai) continue;
    if (t.reveal) { if (!t.vis[0] || force) { t.vis.fill(1); t.seen.fill(1); } continue; } // 핸디캡: 이 팀만 맵 전체 공개
    t.vis.fill(0); const tribeEyes = RTS.tribeAlly && RTS.tribeAlly(G, t.id); // 잿빛 부족 동맹이면 부족 시야를 공유한다
    for (const e of G.ents) {
      if ((e.team !== t.id && !(tribeEyes && e.team === RTS.TRIBE)) || e.dead) continue;
      const r = RTS.defs.entities[e.def].sight || 8, cx = e.x | 0, cy = e.y | 0, R = r * r;
      for (let y = Math.max(0, cy - r); y <= Math.min(G.h - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(G.w - 1, cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= R) { const i = y * G.w + x; t.vis[i] = 1; t.seen[i] = 1; }
      }
    }
  }
};
RTS.visibleTo = (G, teamId, x, y) => { const t = G.teams[teamId]; return G.nofog || !t || !!t.vis[(y | 0) * G.w + (x | 0)]; };

// 기본 맵 생성기: 데이터(암벽 원/선, 기지 위치)만 받아 180도 회전 대칭으로 찍는다.
RTS.defs.mapgens.symmetric = function (spec, G) {
  const w = spec.w, h = spec.h, tiles = new Array(w * h).fill(0);
  const rng = () => RTS.rand(G);
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < w && y < h) { tiles[y * w + x] = v; tiles[(h - 1 - y) * w + (w - 1 - x)] = v; } };
  const disc = (cx, cy, r, v) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, v); };
  const line = (a, b, c, d, t, v) => { const n = Math.ceil(Math.hypot(c - a, d - b)); for (let i = 0; i <= n; i++) disc(a + (c - a) * i / n, b + (d - b) * i / n, t + (v === 1 ? rng() * .9 : 0), v); };
  for (const [x, y, r] of spec.sand || []) disc(x, y, r, 2);
  for (const [x, y, r] of spec.rocks || []) { disc(x, y, r, 1); for (let i = 0; i < 6; i++) { const a = rng() * 6.28; disc(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8, r * .45, 1); } }
  for (const [a, b, c, d, t] of spec.walls || []) line(a, b, c, d, t, 1);
  const half = spec.bases;
  for (const b of half) disc(b.x, b.y, 10, 0);
  for (const [a, b, c, d, t] of spec.lanes || []) line(a, b, c, d, t, 0);
  for (let x = 0; x < w; x++) { set(x, 0, 1); }
  for (let y = 0; y < h; y++) { set(0, y, 1); }
  const nodes = [], bases = [], sites = [], posts = [];
  for (const [x, y] of spec.posts || []) { disc(x, y, 3.5, 0); posts.push({ x, y }); posts.push({ x: w - x, y: h - y }); }
  for (const [x, y] of spec.sites || []) { disc(x, y, 3.5, 0); sites.push({ x, y }); sites.push({ x: w - x, y: h - y }); }
  let tribe = null; // 잿빛 부족 회당 자리: 대칭 중심선 위. 둘레를 비우고 필요하면 둑길(tribeLanes)을 낸다
  if (spec.tribe) { for (const [a, b, c, d, t] of spec.tribeLanes || []) line(a, b, c, d, t, 0); disc(spec.tribe[0], spec.tribe[1], 6.5, 0); tribe = { x: spec.tribe[0], y: spec.tribe[1] }; }
  const cx = w / 2, cy = h / 2;
  half.forEach((b, i) => {
    const dir = b.dir !== undefined ? b.dir : Math.atan2(b.y - cy, b.x - cx);
    bases.push({ x: b.x, y: b.y, start: b.start }); bases.push({ x: w - b.x, y: h - b.y, start: b.start !== undefined ? 1 : undefined });
    const add = (def, tx, ty, fw, fh) => { nodes.push({ def, tx, ty }); nodes.push({ def, tx: w - tx - fw, ty: h - ty - fh }); };
    const ore = b.ore || 8;
    for (let k = 0; k < ore; k++) { const a = dir + (k - (ore - 1) / 2) * .36, d = 6.6 + (k % 2) * .9; add('ore_node', Math.round(b.x + Math.cos(a) * d - 1), Math.round(b.y + Math.sin(a) * d - .5), 2, 1); }
    add('vent', Math.round(b.x + Math.cos(dir + 2.05) * 7.5 - 1), Math.round(b.y + Math.sin(dir + 2.05) * 7.5 - 1), 2, 2);
    if (!b.oneVent) add('vent', Math.round(b.x + Math.cos(dir - 2.05) * 7.5 - 1), Math.round(b.y + Math.sin(dir - 2.05) * 7.5 - 1), 2, 2);
  });
  return { w, h, tiles, bases, nodes, sites, posts, tribe };
};
