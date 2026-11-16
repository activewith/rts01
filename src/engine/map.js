// map.js — 타일, 점유, 경로탐색(A*), 시야선, 공간 해시, 시야(안개), 기본 맵 생성기
RTS.tile = (G, x, y) => (x < 0 || y < 0 || x >= G.w || y >= G.h ? 1 : G.tiles[y * G.w + x]);
RTS.walkable = (G, x, y) => {
  if (x < 0 || y < 0 || x >= G.w || y >= G.h) return false;
  const i = y * G.w + x;
  return RTS.terrainPass[G.tiles[i]] && !G._occ[i];
};
RTS.terrainPass = [true, false, true, false]; // 0 땅, 1 암벽, 2 모래, 3 고지대 절벽(지나갈 수 없음)
// 고지대: G.elev[i] = 높이 단계×4. 경사로 칸은 아래 단계×4 + 0~4(위로 갈수록 큼). 4 미만이면 게임 판정에서 아래 단계로 본다.
// 높이가 없는 맵(G.elev 없음)은 모두 0단계다. 공중 유닛은 높이 규칙을 받지 않는다.
RTS.lvl = (G, x, y) => { if (!G.elev) return 0; const xi = x | 0, yi = y | 0; return xi < 0 || yi < 0 || xi >= G.w || yi >= G.h ? 0 : G.elev[yi * G.w + xi] >> 2; };
RTS.lvlOf = (G, e) => (RTS.defs.entities[e.def].air ? 99 : RTS.lvl(G, e.x, e.y));
RTS.UPHILL = .75; // 낮은 곳에서 높은 곳의 지상 대상을 쏘면 피해 ×0.75

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
  if (!rect && !RTS.walkable(G, Math.floor(goal.x), Math.floor(goal.y))) { const q = RTS.nearestFree(G, goal.x, goal.y, 6); if (RTS.walkable(G, Math.floor(q.x), Math.floor(q.y))) goal = q; } // 막힌 칸이 목표면 가까운 빈칸으로(헛된 전체 탐색 방지)
  const gx = rect ? (goal.x0 + goal.x1) / 2 : Math.floor(goal.x), gy = rect ? (goal.y0 + goal.y1) / 2 : Math.floor(goal.y);
  const H = (x, y) => { const a = Math.abs(x - gx), b = Math.abs(y - gy); return (a + b) + (1.414 - 2) * Math.min(a, b); };
  const isGoal = (x, y) => rect ? (x >= goal.x0 && x <= goal.x1 && y >= goal.y0 && y <= goal.y1) : (x === gx && y === gy);
  // 이진 힙: 형식 배열에 직접 넣고 빼며 배열을 새로 만들지 않는다(구조 분해 교환은 느리다)
  if (!AS.hi || AS.hi.length < n * 8) { AS.hi = new Int32Array(n * 8); AS.hf = new Float64Array(n * 8); }
  const HI = AS.hi, HF = AS.hf; let hn = 0;
  const push = (i, p) => { if (hn >= HI.length) return; let c = hn++; while (c > 0) { const q = (c - 1) >> 1; if (HF[q] <= p) break; HI[c] = HI[q]; HF[c] = HF[q]; c = q; } HI[c] = i; HF[c] = p; };
  const pop = () => { const top = HI[0], li = HI[--hn], lf = HF[hn]; let c = 0;
    if (hn > 0) { for (;;) { const l = 2 * c + 1, r = l + 1; let m = -1, mf = lf; if (l < hn && HF[l] < mf) { m = l; mf = HF[l]; } if (r < hn && HF[r] < mf) { m = r; mf = HF[r]; } if (m < 0) break; HI[c] = HI[m]; HF[c] = HF[m]; c = m; }
      HI[c] = li; HF[c] = lf; }
    return top; };
  AS.g[start] = 0; AS.stamp[start] = gen; AS.from[start] = -1; push(start, 0);
  let best = start, bestH = 1e9, found = -1, visited = 0;
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
  while (hn > 0 && visited < Math.max(7000, n * 1.6)) { // 큰 맵은 탐색 한도를 넓힌다(본진 입구가 반대쪽이라 돌아가는 긴 경로는 맵 전체를 훑는다)
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
    let j = Math.min(pts.length - 1, i + 40); // 앞쪽 40칸까지만 본다(긴 경로에서 계산량이 제곱으로 늘지 않게)
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
      if ((e.team !== t.id && !(tribeEyes && e.team === RTS.TRIBE) && !(G.coop && e.team >= 0 && RTS.ally(G, t.id, e.team))) || e.dead) continue; // 협동: 동료 시야 공유
      // 고지대: 지상 유닛·건물은 자기보다 높은 단계를 보지 못하고, 높은 곳에 있으면 단계당 시야 +1
      const EL = G.elev, ul = EL ? RTS.lvlOf(G, e) : 99, r = (RTS.defs.entities[e.def].sight || 8) + (ul < 99 ? ul : 0), cx = e.x | 0, cy = e.y | 0, R = r * r;
      for (let y = Math.max(0, cy - r); y <= Math.min(G.h - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(G.w - 1, cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= R) { const i = y * G.w + x; if (EL && (EL[i] >> 2) > ul) continue; t.vis[i] = 1; t.seen[i] = 1; }
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
  const elev = spec.highs ? RTS.raiseHighs(spec, w, h, tiles, rng) : null;
  const cx = w / 2, cy = h / 2;
  half.forEach((b, i) => {
    const dir = b.dir !== undefined ? b.dir : Math.atan2(b.y - cy, b.x - cx);
    // spawn: 시작 위치 후보(맞은편도 후보). 후보는 광맥 8·분출구 2를 갖는다. 실제 시작 자리는 RTS.pickStarts가 고른다
    const sp = b.spawn || b.start !== undefined;
    bases.push({ x: b.x, y: b.y, start: b.start, spawn: sp || undefined }); bases.push({ x: w - b.x, y: h - b.y, start: b.start !== undefined ? 1 : undefined, spawn: sp || undefined });
    const add = (def, tx, ty, fw, fh) => { nodes.push({ def, tx, ty }); nodes.push({ def, tx: w - tx - fw, ty: h - ty - fh }); };
    const ore = (b.spawn ? 0 : b.ore) || 8;
    for (let k = 0; k < ore; k++) { const a = dir + (k - (ore - 1) / 2) * .36, d = 6.6 + (k % 2) * .9; add('ore_node', Math.round(b.x + Math.cos(a) * d - 1), Math.round(b.y + Math.sin(a) * d - .5), 2, 1); }
    add('vent', Math.round(b.x + Math.cos(dir + 2.05) * 7.5 - 1), Math.round(b.y + Math.sin(dir + 2.05) * 7.5 - 1), 2, 2);
    if (!b.oneVent || b.spawn) add('vent', Math.round(b.x + Math.cos(dir - 2.05) * 7.5 - 1), Math.round(b.y + Math.sin(dir - 2.05) * 7.5 - 1), 2, 2);
  });
  return { w, h, tiles, bases, nodes, sites, posts, tribe, elev };
};
// 고지대 만들기(대칭). highs: [x, y, 반경, 단계] 원(가장자리를 노이즈로 흔든다, 뒤에 온 것이 덮는다).
// ramps: [아래쪽 x, y, 위쪽 x, y, 폭] 선분 둘레를 경사로로 만든다. 그 밖에서 단계가 바뀌는 경계의 높은 쪽 한 칸은 절벽(3)이 된다.
RTS.raiseHighs = function (spec, w, h, tiles, rng) {
  const N = w * h, L = new Array(N).fill(0), ramp = new Array(N).fill(-1), rk = new Array(N).fill(0);
  const both = (x, y, fn) => { if (x >= 0 && y >= 0 && x < w && y < h) { fn(y * w + x); fn((h - 1 - y) * w + (w - 1 - x)); } };
  for (const [hx, hy, r, lv] of spec.highs) {
    const p1 = rng() * 6.28, p2 = rng() * 6.28, a1 = .06 + rng() * .05, a2 = .03 + rng() * .04;
    for (let y = Math.floor(hy - r * 1.2); y <= hy + r * 1.2; y++) for (let x = Math.floor(hx - r * 1.2); x <= hx + r * 1.2; x++) {
      const dx = x + .5 - hx, dy = y + .5 - hy, a = Math.atan2(dy, dx), R = r * (1 + a1 * Math.sin(3 * a + p1) + a2 * Math.sin(5 * a + p2));
      if (dx * dx + dy * dy <= R * R) both(x, y, i => { L[i] = lv; });
    }
  }
  const Lat = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : L[Math.floor(y) * w + Math.floor(x)]);
  for (const [ax, ay, bx, by, wd] of spec.ramps || []) {
    // 가장자리가 노이즈로 흔들리므로, 아래쪽 점에서 위쪽 방향으로 걸어가며 실제 경계를 찾아 그 둘레 5칸을 경사로로 만든다
    const ul = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / ul, uy = (by - ay) / ul, lo = Lat(ax, ay);
    let hi = Lat(bx, by); if (hi <= lo) for (let k = ul; k < ul + 8 && hi <= lo; k += .5) hi = Math.max(hi, Lat(ax + ux * k, ay + uy * k));
    let ke = ul; for (let k = 0; k < ul + 8; k += .25) if (Lat(ax + ux * k, ay + uy * k) >= hi) { ke = k; break; }
    const x0 = ax + ux * (ke - 3.5), y0 = ay + uy * (ke - 3.5), x1 = ax + ux * (ke + 1.5), y1 = ay + uy * (ke + 1.5), low = Math.min(lo, hi);
    const vx = x1 - x0, vy = y1 - y0, len = Math.hypot(vx, vy) || 1;
    for (let y = Math.floor(Math.min(y0, y1) - wd - 1); y <= Math.max(y0, y1) + wd + 1; y++) for (let x = Math.floor(Math.min(x0, x1) - wd - 1); x <= Math.max(x0, x1) + wd + 1; x++) {
      const px = x + .5 - x0, py = y + .5 - y0, k = Math.max(0, Math.min(1, (px * vx + py * vy) / (len * len)));
      const up = k, j = y * w + x; // 아래쪽 0 → 위쪽 1
      if (Math.hypot(px - vx * k, py - vy * k) <= wd && x >= 0 && y >= 0 && x < w && y < h) { const q = Math.max(0, Math.min(4, Math.round(up * 4))); ramp[j] = low; rk[j] = q; tiles[j] = 0; const m = (h - 1 - y) * w + (w - 1 - x); ramp[m] = low; rk[m] = q; tiles[m] = 0; }
    }
  }
  const E = new Array(N);
  for (let i = 0; i < N; i++) E[i] = ramp[i] >= 0 ? ramp[i] * 4 + rk[i] : L[i] * 4;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (ramp[i] >= 0 || !L[i]) continue;
    let cliff = false;
    for (let dy = -1; dy <= 1 && !cliff; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx; if (ramp[j] >= 0 ? ramp[j] + 1 < L[i] : L[j] < L[i]) { cliff = true; break; } }
    if (cliff) tiles[i] = 3; }
  return E;
};
