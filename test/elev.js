// 높낮이 맵 검사: node test/elev.js — 연결성, 절벽·경사로, 고지대 시야·피해, 저장 복원, AI 확장·작전
const fs = require('fs'), path = require('path');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade', 'engine/super','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const D = RTS.defs.entities;
for (const map of ['highland', 'terrace']) {
  const spec = RTS.defs.maps[map], G = RTS.createGame({ map, seed: 3, players: [{ faction: 'pioneers' }, { faction: 'ironclad', ai: 'normal' }] });
  ok(spec.w * spec.h >= 1.5 * 96 * 64, `${map}: 크기 ${spec.w}×${spec.h} (기존 최대 6400칸의 ${(spec.w * spec.h / 6400).toFixed(2)}배)`);
  const lv = new Set(G.elev.map(v => v >> 2)); ok(lv.size >= 3, `${map}: 높이 단계 ${[...lv].sort().join('·')}`);
  ok(G.tiles.some(t => t === 3) && G.elev.some(v => v & 3), `${map}: 절벽과 경사로가 있다`);
  // 시작 기지에서 모든 기지·자원·거점까지 걸어서 닿는다(건물 점유 포함)
  const W = G.w, seen = new Uint8Array(W * G.h), s0 = G.bases.find(b => b.start === 0), st = Math.floor(s0.y + 3) * W + Math.floor(s0.x), q = [st]; seen[st] = 1;
  while (q.length) { const i = q.pop(), x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) { if (j < 0 || j >= W * G.h || seen[j] || !RTS.walkable(G, j % W, (j / W) | 0)) continue; seen[j] = 1; q.push(j); } }
  const touch = e => { const r = RTS.rectOf(e); for (let y = Math.floor(r.y0) - 1; y <= r.y0 + r.h; y++) for (let x = Math.floor(r.x0) - 1; x <= r.x0 + r.w; x++) if (seen[y * W + x]) return true; return false; };
  const near = (x, y, r) => { for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < G.h && seen[yy * W + xx]) return true; return false; };
  ok(G.bases.every(b => near(b.x, b.y, 4)), `${map}: 기지 ${G.bases.length}곳 모두 연결`);
  ok(G.ents.filter(e => D[e.def].kind === 'resource' || e.site || e.branch).every(touch), `${map}: 자원·회사 거점·지부 모두 연결`);
  ok(G.bases.every(b => { const L = RTS.lvl(G, b.x, b.y); return G.ents.filter(e => D[e.def].kind === 'resource' && Math.hypot(e.x - b.x, e.y - b.y) < 9).every(e => RTS.lvl(G, e.x, e.y) === L); }), `${map}: 기지와 그 자원이 같은 높이`);
}
// 고지대 규칙: 절벽을 사이에 둔 높은 칸과 낮은 칸(4칸 안)을 찾아 시야·피해를 실제로 돌려 본다
const pair = G => { const W = G.w; for (let i = 0; i < G.elev.length; i++) { if (G.elev[i] !== 4 || !RTS.walkable(G, i % W, (i / W) | 0)) continue; const hx = i % W + .5, hy = ((i / W) | 0) + .5;
  for (let r = 2.5; r <= 4; r += .5) for (let a = 0; a < 6.28; a += .3) { const x = hx + Math.cos(a) * r, y = hy + Math.sin(a) * r, j = (y | 0) * W + (x | 0); if (RTS.walkable(G, x | 0, y | 0) && G.elev[j] === 0) return [hx, hy, (x | 0) + .5, (y | 0) + .5]; } } };
{ const mk = () => { const G = RTS.createGame({ map: 'highland', seed: 3, settings: { fog: true }, players: [{ faction: 'pioneers' }, { faction: 'ironclad' }] }); G.ents.forEach(e => { if (e.team >= 0) e.dead = true; }); G.ents = G.ents.filter(e => !e.dead); return G; };
  let G = mk(); const [hx, hy, lx, ly] = pair(G);
  RTS.spawn(G, 'p_rifle', 0, hx, hy); RTS.updateFog(G, true); ok(RTS.visibleTo(G, 0, lx, ly), '높은 곳에서 아래가 보인다');
  G = mk(); RTS.spawn(G, 'p_rifle', 0, lx, ly); RTS.updateFog(G, true); ok(!RTS.visibleTo(G, 0, hx, hy), '낮은 곳에서는 높은 곳이 보이지 않는다');
  G = mk(); RTS.spawn(G, 'p_gunship', 0, lx, ly); RTS.updateFog(G, true); ok(RTS.visibleTo(G, 0, hx, hy), '공중 유닛은 높은 곳도 본다');
  const dmg = (ax, ay, bx, by) => { const G = mk(); const a = RTS.spawn(G, 'p_rifle', 0, ax, ay), b = RTS.spawn(G, 'p_rifle', 1, bx, by); b.order = { type: 'hold' }; const h0 = b.hp;
    RTS.issue(G, a, { type: 'attack', target: b.id }); for (let i = 0; i < 200 && b.hp === h0; i++) { RTS.step(G); b.order = { type: 'hold' }; } return h0 - b.hp; };
  const upD = dmg(lx, ly, hx, hy), downD = dmg(hx, hy, lx, ly);
  ok(upD > 0 && downD > 0 && upD < downD, `아래→위 피해 ${upD.toFixed(1)} < 위→아래 ${downD.toFixed(1)}`);
}
// 저장 복원·결정성
{ const mk = () => RTS.createGame({ map: 'terrace', seed: 9, players: [{ faction: 'swarm', ai: 'normal' }, { faction: 'pioneers', ai: 'hard' }] });
  const A = mk(); for (let i = 0; i < 5000; i++) RTS.step(A);
  let B = mk(); for (let i = 0; i < 2500; i++) RTS.step(B); B = RTS.deserialize(RTS.serialize(B)); for (let i = 0; i < 2500; i++) RTS.step(B);
  ok(RTS.serialize(A) === RTS.serialize(B), '높낮이 맵 저장 후 이어하기 동일'); }
// AI: 작전이 섞여 나오고, 확장한다
{ const plans = {}; let expanded = 0, games = 0;
  for (const s of [1, 2, 3, 4, 5, 6]) { const G = RTS.createGame({ map: s % 2 ? 'highland' : 'lake', seed: s * 11, players: [{ faction: 'pioneers', ai: 'normal' }, { faction: 'swarm', ai: 'normal' }] });
    let maxHq = 0; for (let i = 0; i < 20 * 60 * 14 && !G.over; i++) { RTS.step(G); if (i % 600 === 0) maxHq = Math.max(maxHq, ...G.teams.map(t => G.ents.filter(e => e.team === t.id && !e.dead && D[e.def].dropoff).length)); }
    G.teams.forEach(t => { plans[t.aiState.plan] = (plans[t.aiState.plan] || 0) + 1; }); games++; if (maxHq >= 2) expanded++; }
  ok(Object.keys(plans).length >= 2, 'AI 작전 분포 ' + JSON.stringify(plans)); ok(expanded >= games / 2, `AI 확장: ${expanded}/${games}판에서 사령부 2개 이상`); }
if (fail) { console.log('실패 ' + fail); process.exit(1); } console.log('높낮이·AI 검사 통과');
