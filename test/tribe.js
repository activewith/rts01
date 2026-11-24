// 잿빛 부족: 배치·도달, 발견, 동맹 요청(고르기·협공·기지방어·자원공유·바꾸기), 공병 외교 미션(수학 문제: 수준별 출제·답 범위·정답/오답/힌트/시간 초과), 결과(동맹/중립/적대), 직접 공격, 동맹 지원(확률), 습격, 회당 함락, 저장 복원
const fs = require('fs'), path = require('path'), assert = require('assert');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
const mk = (seed, map = 'ridge', ai) => RTS.createGame({ map, seed, players: [{ faction: 'pioneers' }, { faction: 'ironclad', ai }] });
const run = (G, sec) => { for (let i = 0; i < sec * RTS.HZ; i++) RTS.step(G); };
const TU = G => G.ents.filter(e => e.team === RTS.TRIBE && !e.dead && RTS.defOf(e).kind === 'unit');

// 1) 모든 맵: 회당·망루·병력 배치, 무작위 위치(가운데·시작 기지 근처 제외), 두 시작 기지에서 걸어서 닿는다
for (const m of Object.keys(RTS.defs.maps).filter(k => !RTS.defs.maps[k].camp)) { const G = mk(3, m), T = G.tribe, h = G.byId[T.hall];
  assert(h && h.tribeHall, m + ' 회당'); assert.equal(G.ents.filter(e => e.def === 't_tower').length, 2, m + ' 망루 2'); assert.equal(TU(G).length, 4, m + ' 시작 병력');
  const d = G.bases.filter(b => b.start !== undefined).map(b => { const p = RTS.findPath(G, b.x, b.y + 4, { x0: Math.round(h.x - 3), y0: Math.round(h.y - 2.5), x1: Math.round(h.x + 2), y1: Math.round(h.y + 1.5) }), l = p[p.length - 1]; assert(Math.hypot(l[0] - h.x, l[1] - h.y) < 4.5, m + ' 도달 불가'); return Math.hypot(b.x - h.x, b.y - h.y); });
  assert(Math.hypot(h.x - G.w / 2, h.y - G.h / 2) >= RTS.TRIBE_RULES.centerGap, m + ' 가운데에 놓임'); assert(Math.min(...d) >= RTS.TRIBE_RULES.startGap, m + ' 시작 기지에 너무 가까움');
  const spots = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(n => { const g = mk(n, m), q = g.byId[g.tribe.hall]; return q.x + ',' + q.y; })); assert(spots.size >= 4, m + ' 위치가 섞이지 않음 ' + spots.size);
  console.log(m, '회당', h.x, h.y, '거리', d.map(Math.round), '서로 다른 위치', spots.size + '/8'); }

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
// 수준별 출제: 수준에 맞는 종류만, 모든 종류가 나오고, 답은 1~350 정수이며 문제 문장과 맞는다
{ const evalQ = q => { if (/[가-힣]/.test(q)) return null; return Function('return ' + q.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/'))(); };
  const seen = new Set();
  for (const lv of [1, 2, 3]) { const kinds = new Set();
    for (let s = 1; s < 200; s++) { const g = RTS.createGame({ map: 'ridge', seed: s, settings: { mathLevel: lv }, players: [{ faction: 'pioneers' }, { faction: 'ironclad' }] }); g.tribe.found[0] = true; RTS.tribeRequest(g, 0);
      for (const m of g.tribe.missions[0]) { const L = RTS.defs.tribeMissions[m.id].lv; assert(lv >= L[0] && lv <= L[1], lv + '단계에 ' + m.id); kinds.add(m.id); seen.add(m.id);
        assert(Number.isInteger(m.ans) && m.ans >= 1 && m.ans <= 350, m.id + ' 답 범위 ' + m.q + ' = ' + m.ans); const v = evalQ(m.q); if (v !== null) assert.equal(v, m.ans, m.q);
        if (m.id === 'frac') { const [, D, k, n] = m.q.match(/(\d+)의 (\d+)\/(\d+)/).map(Number); assert.equal(D * k / n, m.ans, m.q); }
        if (m.id === 'place') { const nums = m.q.match(/\d+/g).map(Number); assert.equal(nums.length === 6 ? nums[1] * 100 + nums[3] * 10 + nums[5] : nums[1] * 10 + nums[3], m.ans, m.q); } } }
    const want = Object.keys(RTS.defs.tribeMissions).filter(id => { const L = RTS.defs.tribeMissions[id].lv; return lv >= L[0] && lv <= L[1]; });
    assert.equal(kinds.size, want.length, lv + '단계 종류 ' + [...kinds]); }
  assert.equal(seen.size, Object.keys(RTS.defs.tribeMissions).length, '모든 미션이 나옴');
  const g = RTS.createGame({ map: 'ridge', seed: 2, settings: { mathLevel: 2 }, players: [{ faction: 'pioneers' }, { faction: 'ironclad' }] }); g.tribe.found[0] = true; RTS.tribeRequest(g, 0); console.log('3~4학년 예시:', g.tribe.missions[0].map(m => m.q + ' = ' + m.ans).join(' / ')); }

// 4) 답 보내기(명령을 거친다): 가진 것보다 많으면 거부(기회 유지), 오답은 광석 그대로·힌트·기회 차감, 정답은 그만큼 낸다
const quiz = (g, ans) => ({ id: 'add', until: g.tick + 180 * RTS.HZ, done: null, acc: 0, q: ans - 20 + ' + 20', ans, tries: 0 });
const notes = g => { const L = []; RTS.on(g, 'notice', d => { if (d.team === 0) L.push(d.text); }); return L; };
{ const g = mk(6), t = g.teams[0], N = notes(g); g.tribe.found[0] = true; g.tribe.missions[0] = [quiz(g, 130), quiz(g, 70)]; const M = g.tribe.missions[0];
  t.res.ore = 100; RTS.command(g, 0, { type: 'tribeAnswer', mission: 0, value: 130 }); RTS.step(g); assert.equal(M[0].tries, 0, '모자라면 기회 유지'); assert.equal(t.res.ore, 100); assert(N.some(x => x.includes('많이 보낼 수 없')));
  t.res.ore = 500; RTS.command(g, 0, { type: 'tribeAnswer', mission: 0, value: 120 }); RTS.step(g); assert.equal(M[0].tries, 1); assert.equal(t.res.ore, 500, '오답은 광석을 내지 않음'); assert(N.some(x => x.includes('120보다 큽니다')), '힌트');
  RTS.command(g, 0, { type: 'tribeAnswer', mission: 0, value: 130 }); RTS.step(g); assert.equal(M[0].done, true); assert.equal(t.res.ore, 370, '정답만큼 냄');
  RTS.command(g, 0, { type: 'tribeAnswer', mission: 0, value: 130 }); RTS.step(g); assert.equal(t.res.ore, 370, '끝난 미션에 다시 내지 않음');
  for (const v of [80, 60, 75]) { RTS.command(g, 0, { type: 'tribeAnswer', mission: 1, value: v }); RTS.step(g); }
  assert.equal(M[1].done, false, '3번 틀리면 실패'); assert(N.some(x => x.includes('답은 70')), '실패하면 답을 알려 줌'); assert.equal(t.res.ore, 370);
  run(g, 1); assert.equal(g.tribe.missions[0], null, '정산됨'); assert.equal(g.tribe.rel[0], 'neutral', '1개 성공 → 중립'); assert(RTS.tribeBlock(g, 0).includes('기다려야')); }
{ const g = mk(7), t = g.teams[0]; g.tribe.missions[0] = [quiz(g, 50), quiz(g, 90)]; t.res.ore = 200;
  RTS.command(g, 0, { type: 'tribeAnswer', mission: 1, value: 90 }); RTS.command(g, 0, { type: 'tribeAnswer', mission: 0, value: 50 }); run(g, 2);
  assert.equal(g.tribe.rel[0], 'ally', '2개 성공 → 동맹'); assert(RTS.tribeAlly(g, 0)); assert.equal(t.res.ore, 60); }
{ const g = mk(15), N = notes(g); g.tribe.missions[0] = [quiz(g, 50), quiz(g, 90)]; g.tribe.missions[0].forEach(m => { m.until = g.tick + 40; }); run(g, 3); assert.equal(g.tribe.rel[0], 'hostile', '시간 초과 0개 → 적대'); assert(N.some(x => x.includes('시간 초과') && x.includes('답은 50'))); }

// 5) 결과 판정: 0개 → 적대 + 습격, 2개 → 동맹(상대 동맹 중이면 중립)
{ const g = mk(8); g.tribe.missions[0] = [quiz(g, 40), quiz(g, 60)]; g.teams[0].res.ore = 999;
  for (const [i, v] of [[0, 1], [0, 2], [0, 3], [1, 1], [1, 2], [1, 3]]) { RTS.command(g, 0, { type: 'tribeAnswer', mission: i, value: v }); RTS.step(g); }
  run(g, 2); assert.equal(g.tribe.rel[0], 'hostile', '0개 → 적대'); assert(RTS.foe(g, 0, RTS.TRIBE) && !RTS.foe(g, 1, RTS.TRIBE));
  run(g, RTS.TRIBE_RULES.raidFirst + 2); const raiders = TU(g).filter(u => u.order && u.order.type === 'amove'); assert(raiders.length >= 2, '습격 출발 ' + raiders.length); console.log('습격', raiders.length, '기'); }
{ const g = mk(9); g.tribe.rel[1] = 'ally'; g.tribe.missions[0] = [{ id: 'add', until: 0, done: true }, { id: 'sub', until: 0, done: true }]; run(g, 1); assert.equal(g.tribe.rel[0], 'neutral', '상대가 동맹이면 중립'); }

// 6) 직접 공격 → 적대(동맹이어도 배신), 범위 피해는 중립 부족을 건드리지 않는다
{ const g = mk(10), u = TU(g)[0]; RTS.damage(g, u, 5, { team: 1 }); assert.equal(g.tribe.rel[1], 'hostile'); assert.equal(g.tribe.rel[0], 'neutral');
  const g2 = mk(11); g2.tribe.rel[0] = 'ally'; RTS.damage(g2, TU(g2)[0], 5, { team: 0 }); assert.equal(g2.tribe.rel[0], 'hostile', '배신');
  const g3 = mk(12), v = TU(g3)[0], hp = v.hp; RTS.rebuildGrid(g3); RTS.hit(g3, null, v.x, v.y, 30, { splash: 2 }, { team: 0 }); assert.equal(v.hp, hp, '범위 피해가 중립에 들어감'); assert.equal(g3.tribe.rel[0], 'neutral'); }

// 7) 동맹 지원은 확률: 여러 번 시도하면 보낼 때와 안 보낼 때가 모두 나온다
{ let yes = 0, no = 0; for (let s = 20; s < 50; s++) { const g = mk(s); g.tribe.rel[0] = 'ally'; g.tribe.req[0] = 'defend'; const hq = g.ents.find(e => e.team === 0 && RTS.defOf(e).dropoff), atk = RTS.spawn(g, 'i_blade', 1, hq.x + 3, hq.y);
    RTS.damage(g, hq, 5, atk); if (TU(g).some(u => u.order && u.order.help)) { yes++; assert(RTS.foe(g, RTS.TRIBE, 1), '지원 중에는 공격자와 적'); } else no++; }
  console.log('지원 30회: 보냄', yes, '안 보냄', no); assert(yes > 5 && no > 5); }
{ const g = mk(21); g.tribe.rel[0] = 'ally'; g.tribe.req[0] = 'defend'; const hq = g.ents.find(e => e.team === 0 && RTS.defOf(e).dropoff), atk = RTS.spawn(g, 'i_blade', 1, hq.x + 3, hq.y); let sent = 0;
  for (let k = 0; k < 40 && !sent; k++) { g.tribe.helpNext = 0; RTS.damage(g, hq, 1, atk); sent = TU(g).filter(u => u.order && u.order.help).length; }
  assert(sent >= 1 && sent <= RTS.TRIBE_RULES.helpMax); assert(TU(g).length - sent >= RTS.TRIBE_RULES.guards, '경비 남김');
  run(g, 50); assert(TU(g).some(u => u.order && u.order.help) || TU(g).some(u => Math.hypot(u.x - hq.x, u.y - hq.y) < 12), '지원군 도착'); assert(!RTS.foe(g, RTS.TRIBE, 1) || g.tribe.war[1] > g.tick, '지원 전쟁은 끝난다'); }

// 7-2) 동맹 요청: 동맹을 맺으면 고르기, 고르기 전에는 혜택 없음, 협공·기지방어(방어탑)·자원공유, 바꾸기는 문제 2개 성공해야
{ const g = mk(22), t = g.teams[0]; g.tribe.missions[0] = [quiz(g, 50), quiz(g, 90)]; t.res.ore = 500;
  RTS.command(g, 0, { type: 'tribeAnswer', mission: 0, value: 50 }); RTS.command(g, 0, { type: 'tribeAnswer', mission: 1, value: 90 }); run(g, 2);
  assert.equal(g.tribe.rel[0], 'ally'); assert(g.tribe.pick[0], '동맹 직후 요청 고르기'); assert.equal(RTS.tribeReqOf(g, 0), null);
  const hq = g.ents.find(e => e.team === 0 && RTS.defOf(e).dropoff), atk = RTS.spawn(g, 'i_blade', 1, hq.x + 3, hq.y); RTS.damage(g, hq, 1, atk); assert(!TU(g).some(u => u.order && u.order.help), '고르기 전에는 지원 없음');
  RTS.command(g, 0, { type: 'tribeReq', req: 'share' }); RTS.step(g); assert.equal(RTS.tribeReqOf(g, 0), 'share'); assert(!g.tribe.pick[0]);
  RTS.command(g, 0, { type: 'tribeReq', req: 'strike' }); RTS.step(g); assert.equal(RTS.tribeReqOf(g, 0), 'share', '문제 없이 못 바꿈');
  // 자원공유: shareEvery초마다 창고를 모두 실은 수송차가 출발 → 본진에 도착하면 지급
  let cart = null; for (let k = 0; k < RTS.TRIBE_RULES.shareEvery * RTS.HZ + 40 && !cart; k++) { RTS.step(g); cart = g.ents.find(e => e.def === 't_cart' && !e.dead); }
  assert(cart && cart.team === 0 && cart.order.ore >= RTS.TRIBE_RULES.shareMin, '수송차 출발'); assert.equal(g.tribe.got[0].ore, 0, '출발만으로는 지급 안 함'); assert(g.tribe.stock.ore < 5, '창고를 비움');
  const load = cart.order, g0 = t.res.gas; let k = 0; while (!cart.dead && k++ < 200 * RTS.HZ) RTS.step(g);
  console.log(`자원공유 수송차: 광석 ${load.ore} · 에테르 ${load.gas}, 이동 ${(k / RTS.HZ).toFixed(0)}초`); assert.equal(g.tribe.got[0].ore, load.ore, '도착 지급'); assert(t.res.gas - g0 >= load.gas - 1);
  // 수송차가 파괴되면 화물을 잃는다
  { const N = []; RTS.on(g, 'notice', d => { if (d.team === 0) N.push(d.text); }); g.tribe.stock.ore = 400; g.tribe.stock.gas = 100; while (!g.ents.some(e => e.def === 't_cart' && !e.dead)) RTS.step(g);
    const c2 = g.ents.find(e => e.def === 't_cart' && !e.dead), before = g.tribe.got[0].ore, foe = RTS.spawn(g, 'i_blade', 1, c2.x + 1, c2.y); RTS.damage(g, c2, 9999, foe); run(g, 1);
    assert.equal(g.tribe.got[0].ore, before, '파괴된 화물은 지급 안 함'); assert(N.some(x => x.includes('파괴')), '파괴 알림'); RTS.kill(g, foe, null, true); }
  // 바꾸기: 1개만 맞히면 그대로 + 대기, 2개 맞히면 다시 고르기
  RTS.command(g, 0, { type: 'tribeRenew' }); RTS.step(g); const M = g.tribe.missions[0]; assert(M && M.length === 2, '바꾸기 문제');
  t.res.ore = 999; RTS.command(g, 0, { type: 'tribeAnswer', mission: 0, value: M[0].ans }); for (const v of [1, 2, 3]) RTS.command(g, 0, { type: 'tribeAnswer', mission: 1, value: v }); run(g, 2);
  assert.equal(g.tribe.rel[0], 'ally', '실패해도 동맹 유지'); assert.equal(RTS.tribeReqOf(g, 0), 'share'); assert(RTS.tribeRenewBlock(g, 0).includes('기다려야'));
  g.tribe.wait[0] = 0; RTS.command(g, 0, { type: 'tribeRenew' }); RTS.step(g); const M2 = g.tribe.missions[0];
  M2.forEach((m, i) => RTS.command(g, 0, { type: 'tribeAnswer', mission: i, value: m.ans })); run(g, 2); assert(g.tribe.pick[0], '2개 성공 → 다시 고르기'); assert.equal(RTS.tribeReqOf(g, 0), 'share', '고르기 전엔 이전 요청 유지');
  RTS.command(g, 0, { type: 'tribeReq', req: 'strike' }); RTS.step(g); assert.equal(RTS.tribeReqOf(g, 0), 'strike');
  // 협공: 내가 적을 때리면 확률로 원군, 그동안 부족과 그 적은 서로 적
  let sent = 0; for (let k = 0; k < 40 && !sent; k++) { g.tribe.strikeNext = 0; RTS.damage(g, atk, 1, hq); sent = TU(g).filter(u => u.order && u.order.help).length; }
  assert(sent >= 1 && sent <= RTS.TRIBE_RULES.helpMax, '협공 원군'); assert(RTS.foe(g, RTS.TRIBE, 1)); }
{ let yes = 0; for (let s = 60; s < 90; s++) { const g = mk(s); g.tribe.rel[0] = 'ally'; g.tribe.req[0] = 'strike'; const hq = g.ents.find(e => e.team === 0 && RTS.defOf(e).dropoff), en = RTS.spawn(g, 'i_blade', 1, hq.x + 3, hq.y); RTS.damage(g, en, 1, hq); if (TU(g).some(u => u.order && u.order.help)) yes++; }
  console.log('협공 30회: 보냄', yes); assert(yes > 5 && yes < 25); }
// 기지방어 방어탑: 확률로 내 방어탑, 최대 towerMax개, 일꾼이 맞을 때는 발동 안 함
{ const g = mk(23), t = g.teams[0]; g.tribe.rel[0] = 'ally'; g.tribe.req[0] = 'defend'; const D = RTS.defs.factions[t.faction].defense, n0 = g.ents.filter(e => e.def === D && e.team === 0).length;
  const hq = g.ents.find(e => e.team === 0 && RTS.defOf(e).dropoff), atk = RTS.spawn(g, 'i_blade', 1, hq.x + 3, hq.y), wk = g.ents.find(e => e.team === 0 && RTS.defOf(e).gather);
  RTS.damage(g, wk, 1, atk); assert.equal(g.tribe.helpNext, 0, '일꾼 피격은 기지방어 대상 아님');
  for (let k = 0; k < 60; k++) { g.tribe.helpNext = 0; RTS.damage(g, hq, 1, atk); } const n = g.ents.filter(e => e.def === D && e.team === 0 && !e.dead).length - n0;
  console.log('기지방어 방어탑', n); assert.equal(n, RTS.TRIBE_RULES.towerMax); }
// 배신하면 요청이 사라진다
{ const g = mk(24); g.tribe.rel[0] = 'ally'; g.tribe.req[0] = 'share'; RTS.damage(g, TU(g)[0], 5, { team: 0 }); assert.equal(g.tribe.req[0], null); assert.equal(RTS.tribeReqOf(g, 0), null); }

// 8) 회당 함락: 약탈 + 외교 불가 + 생산 중단
{ const g = mk(13), H = g.byId[g.tribe.hall], o0 = g.teams[1].res.ore; g.tribe.rel[1] = 'hostile'; while (!H.dead) RTS.damage(g, H, 200, { team: 1 });
  assert(g.tribe.dead); assert.equal(g.teams[1].res.ore, o0 + RTS.TRIBE_RULES.loot); assert(RTS.tribeBlock(g, 0).includes('무너')); const n = TU(g).length; run(g, 45); assert(TU(g).length <= n, '함락 후 생산'); }

// 9) 동맹이면 부족 시야 공유
{ const g = mk(14), H = g.byId[g.tribe.hall]; RTS.updateFog(g, true); const i = (H.y | 0) * g.w + (H.x | 0); assert(!g.teams[0].vis[i]); g.tribe.rel[0] = 'ally'; RTS.updateFog(g, true); assert(g.teams[0].vis[i], '동맹 시야'); }

// 10) AI 상대: 부족을 찾고 외교를 시도한다. 저장·복원 후 결정성
{ let tried = 0; for (const s of [31, 32, 33, 34]) { const g = mk(s, 'crossroads', 'hard'); g.teams[0].ai = 'hard'; run(g, 900); const T2 = g.tribe;
    if (T2.rel.some(x => x !== 'neutral') || T2.missions.some(Boolean) || T2.wait.some(x => x > 0)) tried++; console.log('AI 대전', s, '발견', T2.found.join(','), '관계', T2.rel.join(','), '지원', T2.sent); }
  assert(tried >= 2, 'AI가 부족 외교를 하지 않음'); }
// AI 외교 성공률은 aiWin(약 7.5%), 실패하면 aiWait 동안 다시 못 한다
{ let win = 0, n = 0, waits = []; for (let s = 100; s < 220; s++) { const g = mk(s, 'ridge', 'normal'), T = g.tribe, t = g.teams[1]; T.found[1] = true; t.aiState.tPlan = 'ally'; RTS.tribeRequest(g, 1); t.res.ore = 5000;
    const hq = g.ents.find(e => e.team === 1 && RTS.defOf(e).dropoff); for (let k = 0; k < 40 && T.missions[1]; k++) { g.tick += 4 * RTS.HZ; RTS.aiTribe(g, t, RTS.aiDiff(t), g.ents.filter(e => e.team === 1 && RTS.defOf(e).kind === 'unit')); g.tick -= 4 * RTS.HZ; for (let i = 0; i < 4 * RTS.HZ; i++) RTS.step(g); }
    n++; if (T.rel[1] === 'ally') win++; else { assert.equal(T.rel[1], 'neutral', 'AI 실패는 중립'); waits.push((T.wait[1] - g.tick) / RTS.HZ); } }
  console.log(`AI 외교 ${n}회: 성공 ${win} (${(win / n * 100).toFixed(1)}%), 재시도 대기 ${Math.round(Math.min(...waits))}~${Math.round(Math.max(...waits))}초`); assert(win >= 2 && win <= 20, 'AI 성공률'); assert(Math.min(...waits) >= RTS.TRIBE_RULES.aiWait[0] - 2); }
{ const a = mk(40, 'lake', 'hard'); a.teams[0].ai = 'hard'; run(a, 200); const b = RTS.deserialize(RTS.serialize(a)); run(a, 120); run(b, 120); assert.equal(RTS.serialize(a), RTS.serialize(b), '저장 복원 결정성'); }
console.log('잿빛 부족 검사 통과');
