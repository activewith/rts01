// 잿빛 부족: 배치·도달, 발견, 공병 외교 미션, 결과(동맹/중립/적대), 직접 공격, 동맹 지원(확률), 습격, 회당 함락, 저장 복원
const fs = require('fs'), path = require('path'), assert = require('assert');
for (const f of ['engine/core','engine/map','engine/sim','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
const mk = (seed, map = 'ridge', ai) => RTS.createGame({ map, seed, players: [{ faction: 'pioneers' }, { faction: 'ironclad', ai }] });
const run = (G, sec) => { for (let i = 0; i < sec * RTS.HZ; i++) RTS.step(G); };
const TU = G => G.ents.filter(e => e.team === RTS.TRIBE && !e.dead && RTS.defOf(e).kind === 'unit');

// 1) 모든 맵: 회당·망루·병력 배치, 두 시작 기지에서 걸어서 닿고 거리가 같다
for (const m of Object.keys(RTS.defs.maps)) { const G = mk(3, m), T = G.tribe, h = G.byId[T.hall];
  assert(h && h.tribeHall, m + ' 회당'); assert.equal(G.ents.filter(e => e.def === 't_tower').length, 2, m + ' 망루 2'); assert.equal(TU(G).length, 4, m + ' 시작 병력');
  const d = G.bases.filter(b => b.start !== undefined).map(b => { const p = RTS.findPath(G, b.x, b.y + 4, { x0: Math.round(h.x - 3), y0: Math.round(h.y - 2.5), x1: Math.round(h.x + 2), y1: Math.round(h.y + 1.5) }), l = p[p.length - 1]; assert(Math.hypot(l[0] - h.x, l[1] - h.y) < 4.5, m + ' 도달 불가'); return Math.hypot(b.x - h.x, b.y - h.y); });
  assert(Math.abs(d[0] - d[1]) < 2.5, m + ' 거리 차 ' + d); console.log(m, '회당', h.x, h.y, '거리', d.map(Math.round)); }

// 2) 중립: 서로 자동 공격하지 않는다
{ const G = mk(4), h = G.byId[G.tribe.hall]; assert(!RTS.foe(G, 0, RTS.TRIBE) && !RTS.foe(G, RTS.TRIBE, 1) && RTS.foe(G, 0, 1));
  const r = G.ents.find(e => e.team === 0 && RTS.defOf(e).gather); const rifle = RTS.spawn(G, 'p_rifle', 0, h.x, h.y + 4); run(G, 8); assert.equal(rifle.hp, 50, '중립 부족이 공격함'); assert(TU(G).every(u => u.hp === RTS.defOf(u).hp), '내가 중립 부족을 공격함'); }

// 3) 발견 → 공병 외교 → 미션 2개(서로 다름)
let G = mk(5), T = G.tribe, h = G.byId[T.hall];
const w = G.ents.find(e => e.team === 0 && RTS.defOf(e).gather);
RTS.command(G, 0, { type: 'order', ids: [w.id], order: { type: 'envoy', target: h.id } });
for (let i = 0; i < 20 * 120 && !T.missions[0]; i++) RTS.step(G);
assert(T.found[0], '발견'); assert(T.missions[0] && T.missions[0].length === 2 && T.missions[0][0].id !== T.missions[0][1].id, '미션 2개'); assert.equal(w.order && w.order.type, 'gather', '공병 복귀');
console.log('받은 미션', T.missions[0].map(m => m.id).join(', '));
assert(RTS.tribeBlock(G, 0).includes('진행 중'));
{ const seen = new Set(); for (let s = 1; s < 30; s++) { const g = mk(s); g.tribe.found[0] = true; RTS.tribeRequest(g, 0); g.tribe.missions[0].forEach(m => seen.add(m.id)); } assert.equal(seen.size, Object.keys(RTS.defs.tribeMissions).length, '모든 미션이 나옴'); }

// 4) 실제 미션 수행: 광석 공물은 모이면 내고 성공, 시간 초과는 실패
{ const g = mk(6), t = g.teams[0]; g.tribe.found[0] = true; RTS.tribeRequest(g, 0); g.tribe.missions[0] = [{ id: 'oreGift', until: g.tick + 2000, done: null, acc: 0 }, { id: 'muster', until: g.tick + 40, done: null, acc: 0 }];
  t.res.ore = 400; run(g, 3); assert.equal(g.tribe.missions[0], null, '정산됨'); assert(t.res.ore < 400 - 249, '공물 지불');
  assert.equal(g.tribe.rel[0], 'neutral', '1개 성공 → 중립'); assert(RTS.tribeBlock(g, 0).includes('기다려야')); }
// 회당 경비: 전투 유닛 4기를 곁에 20초
{ const g = mk(7), H = g.byId[g.tribe.hall]; g.tribe.found[0] = true; RTS.tribeRequest(g, 0); g.tribe.missions[0] = [{ id: 'guard', until: g.tick + 20 * 60, done: null, acc: 0 }, { id: 'build', until: g.tick + 20 * 60, done: null, acc: 0, b0: -5 }];
  for (let i = 0; i < 4; i++) RTS.spawn(g, 'p_rifle', 0, H.x - 2 + i, H.y + 4); run(g, 23); assert.equal(g.tribe.rel[0], 'ally', '2개 성공 → 동맹'); assert(RTS.tribeAlly(g, 0)); }

// 5) 결과 판정: 0개 → 적대 + 습격, 2개 → 동맹(상대 동맹 중이면 중립)
{ const g = mk(8); g.tribe.missions[0] = [{ id: 'oreGift', until: g.tick + 10, done: null, acc: 0 }, { id: 'gasGift', until: g.tick + 10, done: null, acc: 0 }]; g.teams[0].res.ore = 0; g.teams[0].res.gas = 0;
  run(g, 2); assert.equal(g.tribe.rel[0], 'hostile', '0개 → 적대'); assert(RTS.foe(g, 0, RTS.TRIBE) && !RTS.foe(g, 1, RTS.TRIBE));
  run(g, 20 * 0 + RTS.TRIBE_RULES.raidFirst + 2); const raiders = TU(g).filter(u => u.order && u.order.type === 'amove'); assert(raiders.length >= 2, '습격 출발 ' + raiders.length); console.log('습격', raiders.length, '기'); }
{ const g = mk(9); g.tribe.rel[1] = 'ally'; g.tribe.missions[0] = [{ id: 'oreGift', until: 0, done: true }, { id: 'gasGift', until: 0, done: true }]; run(g, 1); assert.equal(g.tribe.rel[0], 'neutral', '상대가 동맹이면 중립'); }

// 6) 직접 공격 → 적대(동맹이어도 배신), 범위 피해는 중립 부족을 건드리지 않는다
{ const g = mk(10), u = TU(g)[0]; RTS.damage(g, u, 5, { team: 1 }); assert.equal(g.tribe.rel[1], 'hostile'); assert.equal(g.tribe.rel[0], 'neutral');
  const g2 = mk(11); g2.tribe.rel[0] = 'ally'; RTS.damage(g2, TU(g2)[0], 5, { team: 0 }); assert.equal(g2.tribe.rel[0], 'hostile', '배신');
  const g3 = mk(12), v = TU(g3)[0], hp = v.hp; RTS.rebuildGrid(g3); RTS.hit(g3, null, v.x, v.y, 30, { splash: 2 }, { team: 0 }); assert.equal(v.hp, hp, '범위 피해가 중립에 들어감'); assert.equal(g3.tribe.rel[0], 'neutral'); }

// 7) 동맹 지원은 확률: 여러 번 시도하면 보낼 때와 안 보낼 때가 모두 나온다
{ let yes = 0, no = 0; for (let s = 20; s < 50; s++) { const g = mk(s); g.tribe.rel[0] = 'ally'; const hq = g.ents.find(e => e.team === 0 && RTS.defOf(e).dropoff), atk = RTS.spawn(g, 'i_blade', 1, hq.x + 3, hq.y);
    RTS.damage(g, hq, 5, atk); if (TU(g).some(u => u.order && u.order.help)) { yes++; assert(RTS.foe(g, RTS.TRIBE, 1), '지원 중에는 공격자와 적'); } else no++; }
  console.log('지원 30회: 보냄', yes, '안 보냄', no); assert(yes > 5 && no > 5); }
{ const g = mk(21); g.tribe.rel[0] = 'ally'; const hq = g.ents.find(e => e.team === 0 && RTS.defOf(e).dropoff), atk = RTS.spawn(g, 'i_blade', 1, hq.x + 3, hq.y); let sent = 0;
  for (let k = 0; k < 40 && !sent; k++) { g.tribe.helpNext = 0; RTS.damage(g, hq, 1, atk); sent = TU(g).filter(u => u.order && u.order.help).length; }
  assert(sent >= 1 && sent <= RTS.TRIBE_RULES.helpMax); assert(TU(g).length - sent >= RTS.TRIBE_RULES.guards, '경비 남김');
  run(g, 50); assert(TU(g).some(u => u.order && u.order.help) || TU(g).some(u => Math.hypot(u.x - hq.x, u.y - hq.y) < 12), '지원군 도착'); assert(!RTS.foe(g, RTS.TRIBE, 1) || g.tribe.war[1] > g.tick, '지원 전쟁은 끝난다'); }

// 8) 회당 함락: 약탈 + 외교 불가 + 생산 중단
{ const g = mk(13), H = g.byId[g.tribe.hall], o0 = g.teams[1].res.ore; g.tribe.rel[1] = 'hostile'; while (!H.dead) RTS.damage(g, H, 200, { team: 1 });
  assert(g.tribe.dead); assert.equal(g.teams[1].res.ore, o0 + RTS.TRIBE_RULES.loot); assert(RTS.tribeBlock(g, 0).includes('무너')); const n = TU(g).length; run(g, 45); assert(TU(g).length <= n, '함락 후 생산'); }

// 9) 동맹이면 부족 시야 공유
{ const g = mk(14), H = g.byId[g.tribe.hall]; RTS.updateFog(g, true); const i = (H.y | 0) * g.w + (H.x | 0); assert(!g.teams[0].vis[i]); g.tribe.rel[0] = 'ally'; RTS.updateFog(g, true); assert(g.teams[0].vis[i], '동맹 시야'); }

// 10) AI 상대: 부족을 찾고 외교를 시도한다. 저장·복원 후 결정성
{ let tried = 0; for (const s of [31, 32, 33, 34]) { const g = mk(s, 'crossroads', 'normal'); g.teams[0].ai = 'normal'; run(g, 600); const T2 = g.tribe;
    const r = T2.rel.map(x => x[0]).join(''); if (T2.rel.some(x => x !== 'neutral') || T2.missions.some(Boolean) || T2.wait.some(x => x > 0)) tried++; console.log('AI 대전', s, '발견', T2.found.join(','), '관계', T2.rel.join(','), '지원', T2.sent); }
  assert(tried >= 2, 'AI가 부족 외교를 하지 않음'); }
{ const a = mk(40, 'lake', 'hard'); a.teams[0].ai = 'hard'; run(a, 200); const b = RTS.deserialize(RTS.serialize(a)); run(a, 120); run(b, 120); assert.equal(RTS.serialize(a), RTS.serialize(b), '저장 복원 결정성'); }
console.log('잿빛 부족 검사 통과');
