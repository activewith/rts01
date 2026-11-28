// node test/starts.js — 시작 위치: 맵마다 후보 4곳 이상, 후보 자원, 무작위 선택(거리 조건), 경로 연결, 고정 설정, 셋이 대전, 결정성
const fs = require('fs'), path = require('path');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade', 'engine/super','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const mk = (map, seed, n = 2, settings) => RTS.createGame({ map, seed, settings, players: [{ faction: 'pioneers' }, { faction: 'ironclad', ai: 'normal' }, { faction: 'swarm', ai: 'normal' }].slice(0, n) });
const hqs = G => G.ents.filter(e => RTS.defOf(e).dropoff).sort((a, b) => a.team - b.team);
const key = G => hqs(G).map(h => Math.round(h.x) + ',' + Math.round(h.y)).join(' vs ');
for (const m of Object.keys(RTS.defs.maps).filter(k => !RTS.defs.maps[k].camp)) {
  const G = mk(m, 1), sp = G.bases.filter(b => b.spawn), spec = RTS.defs.maps[m], gap = spec.spawnGap || Math.max(G.w, G.h) * .38;
  const res = sp.map(b => [G.ents.filter(e => e.def === 'ore_node' && Math.hypot(e.x - b.x, e.y - b.y) < 10).length, G.ents.filter(e => e.def === 'vent' && Math.hypot(e.x - b.x, e.y - b.y) < 10).length]);
  ok(sp.length >= 4 && res.every(([o, v]) => o >= 8 && v === 2), `${spec.name}: 후보 ${sp.length}곳, 모두 광맥 8·분출구 2`);
  let fail = 0; for (const a of sp) for (const b of sp) if (a !== b) { const p = RTS.findPath(G, a.x, a.y + 4, { x: b.x, y: b.y + 4 }), l = p[p.length - 1]; if (!l || Math.hypot(l[0] - b.x, l[1] - b.y - 4) > 3) fail++; }
  ok(!fail, `${spec.name}: 후보끼리 모두 걸어서 닿는다`);
  const seen = new Set(), places = new Set(); let close = 0;
  for (let s = 1; s <= 30; s++) { const g = mk(m, s), h = hqs(g); seen.add(key(g)); h.forEach(x => places.add(Math.round(x.x) + ',' + Math.round(x.y))); if (Math.hypot(h[0].x - h[1].x, h[0].y - h[1].y) < gap - 2) close++; }
  ok(places.size >= 4 && seen.size >= 4 && !close, `${spec.name}: 30판에서 시작 자리 ${places.size}곳·조합 ${seen.size}가지, 거리 ${Math.round(gap)} 미만 0`);
  ok(key(mk(m, 7)) === key(mk(m, 7)), `${spec.name}: 같은 시드면 같은 자리(두 기기 동일)`);
  const fixed = new Set([1, 2, 3, 4, 5].map(s => key(mk(m, s, 2, { randomStart: false }))));
  ok(fixed.size === 1, `${spec.name}: 무작위 끄면 기본 자리 ${[...fixed][0]}`);
  const g3 = mk(m, 4, 3), h3 = hqs(g3); ok(h3.length === 3 && new Set(h3.map(h => Math.round(h.x) + ',' + Math.round(h.y))).size === 3, `${spec.name}: 셋이 대전 ${key(g3)}`);
}
{ const g = RTS.createGame({ map: 'lake', seed: 5, coop: true, players: [{ faction: 'pioneers', side: 0 }, { faction: 'ironclad', side: 0 }, { faction: 'swarm', ai: 'normal', boost: 1.3 }] });
  ok(hqs(g).length === 3, '협동 시작: ' + key(g)); }
{ const m = () => mk('highland', 11); const A = m(); for (let i = 0; i < 6000; i++) RTS.step(A); let B = m(); for (let i = 0; i < 3000; i++) RTS.step(B); B = RTS.deserialize(RTS.serialize(B)); for (let i = 0; i < 3000; i++) RTS.step(B);
  ok(RTS.serialize(A) === RTS.serialize(B), '고원 요새 무작위 시작 저장 후 이어하기 동일'); }
console.log(bad ? `실패 ${bad}` : '시작 위치 검사 통과'); process.exit(bad ? 1 : 0);
