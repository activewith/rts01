// node test/features.js — 호위, 개척단 공병 건물 수리, 합체 유닛 ★2 변신(다른 유닛으로: 비행·고정·능력치·그림)
const fs = require('fs'), path = require('path');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const run = (G, n) => { for (let i = 0; i < n; i++) RTS.step(G); };
const D = RTS.defs.entities;
const finishMorph = G => { for (let i = 0; i < 7 * RTS.HZ; i++) RTS.step(G); }; // 변신 시간(최대 6초)을 기다린다
const mk = (f0 = 'pioneers', f1 = 'ironclad') => { const G = RTS.createGame({ map: 'ridge', seed: 3, players: [{ faction: f0 }, { faction: f1 }] }); return G; };
const hq = (G, team) => G.ents.find(e => e.team === team && D[e.def].dropoff);
const cmd = (G, team, c) => RTS.command(G, team, c);

// 1. 호위: 대상을 따라가고, 대상 둘레의 적을 공격하고, 대상이 사라지면 끝
{ const G = mk(), h = hq(G, 0), cart = RTS.spawn(G, 'p_worker', 0, h.x + 4, h.y + 6), guards = [0, 1, 2].map(i => RTS.spawn(G, 'p_rifle', 0, h.x - 6 + i, h.y - 6));
  cmd(G, 0, { type: 'order', ids: guards.map(u => u.id), order: { type: 'escort', target: cart.id } });
  RTS.issue(G, cart, { type: 'move', x: h.x + 22, y: h.y + 6 }); run(G, 20 * 14);
  const far = Math.max(...guards.map(u => Math.hypot(u.x - cart.x, u.y - cart.y)));
  ok(far < 4.5 && guards.every(u => u.order && u.order.type === 'escort'), `호위: 대상을 따라감 (가장 먼 거리 ${far.toFixed(1)}칸)`);
  const foe = RTS.spawn(G, 'i_blade', 1, cart.x + 4, cart.y + 1), hp0 = foe.hp; run(G, 20 * 3);
  ok(foe.dead || foe.hp < hp0, `호위: 대상 둘레의 적을 공격 (적 체력 ${Math.max(0, foe.hp | 0)}/${hp0})`);
  ok(guards.every(u => u.order && u.order.type === 'escort'), '호위: 교전 뒤에도 호위 유지');
  RTS.kill(G, cart, null, true); run(G, 5); ok(guards.every(u => !u.order || u.order.type !== 'escort'), '호위: 대상이 사라지면 끝');
  cmd(G, 0, { type: 'order', ids: [guards[0].id], order: { type: 'escort', target: hq(G, 1).id } }); run(G, 2); ok(!guards[0].order || guards[0].order.type !== 'escort', '호위: 적은 호위할 수 없음'); }
// 1-2. 부족 수송차 호위(다른 팀 소유가 아닌 내 소유 수레)
{ const G = mk(), h = hq(G, 0), c = RTS.spawn(G, 't_cart', 0, h.x + 20, h.y + 8); c.order = { type: 'tribeCart', ore: 100, gas: 10 }; const g = RTS.spawn(G, 'p_rifle', 0, h.x + 16, h.y + 8);
  cmd(G, 0, { type: 'order', ids: [g.id], order: { type: 'escort', target: c.id } }); run(G, 20 * 4); ok(g.order && g.order.type === 'escort' && Math.hypot(g.x - c.x, g.y - c.y) < 4, '부족 수송차 호위'); }

// 2. 개척단 공병 건물 수리: 완공 건물, 비용, 짓는 중·철거 중·남의 건물·다른 진영 일꾼 거부
{ const G = mk(), h = hq(G, 0), t = G.teams[0], w = G.ents.find(e => e.team === 0 && D[e.def].gather), max = RTS.stat(G, h, 'hp');
  for (const e of G.ents) if (e.team === 0 && D[e.def].gather && e !== w) RTS.kill(G, e, null, true); // 다른 일꾼의 채취가 비용 계산에 섞이지 않게
  RTS.issue(G, w, null); h.hp = max - 300; t.res.ore = 1000; const ore0 = t.res.ore;
  ok(RTS.repairBlock(G, w, h) === '', '공병: 다친 본진 수리 가능');
  cmd(G, 0, { type: 'order', ids: [w.id], order: { type: 'repair', target: h.id } }); run(G, 20 * 12);
  const fixed = h.hp - (max - 300), paid = ore0 - t.res.ore, expect = D[h.def].cost.ore * RTS.SERVICE.repair * fixed / max;
  ok(fixed > 100 && Math.abs(paid - expect) < 2, `건물 수리: 12초에 체력 +${fixed | 0}, 광석 ${paid.toFixed(1)} (예상 ${expect.toFixed(1)})`);
  run(G, 20 * 30); ok(h.hp === max && (!w.order || w.order.type !== 'repair'), '가득 차면 수리를 마치고 일로 돌아감');
  const site = RTS.spawn(G, 'p_barracks', 0, h.x + 8, h.y); site.built = 1; site.hp = 50; ok(/짓는 중/.test(RTS.repairBlock(G, w, site)), '짓는 중인 건물은 수리 불가');
  const eh = hq(G, 1); eh.hp -= 100; ok(!!RTS.repairBlock(G, w, eh), '상대 건물 수리 불가');
  const G2 = mk('ironclad', 'pioneers'), h2 = hq(G2, 0), w2 = G2.ents.find(e => e.team === 0 && D[e.def].gather); h2.hp -= 200; ok(!!RTS.repairBlock(G2, w2, h2), '철갑회 일꾼은 수리 없음'); }

// 3. 변신: ★2 합체 유닛이 다른 유닛(형태 정의)으로 바뀐다 — 이동 방식·능력치·그림. 체력 비율 유지, 다시 누르면 원래대로
for (const id of ['p_commando', 'p_titan', 'i_duelist', 'i_juggernaut', 's_venom', 's_behemoth']) {
  const fac = id[0] === 'p' ? 'pioneers' : id[0] === 'i' ? 'ironclad' : 'swarm', G = mk(fac, fac === 'ironclad' ? 'pioneers' : 'ironclad'), h = hq(G, 0), u = RTS.spawn(G, id, 0, h.x + 6, h.y + 6), F = D[id + '_f'];
  cmd(G, 0, { type: 'ability', ids: [u.id], ability: 'morph' }); run(G, 1); const no = u.def === id;
  u.rank = RTS.RANK.max; u.hp = RTS.stat(G, u, 'hp') * .5; G.teams[0].res.ore = 2000; G.teams[0].res.gas = 1000; cmd(G, 0, { type: 'ability', ids: [u.id], ability: 'morph' }); run(G, 1);
  const midway = !!u.morphing && u.def === id; finishMorph(G);
  const changed = u.def === id + '_f' && u.rank === RTS.RANK.max && Math.abs(u.hp / RTS.stat(G, u, 'hp') - .5) < .05 && D[u.def].art !== D[id].art;
  let moveOk = true; const x0 = u.x; cmd(G, 0, { type: 'order', ids: [u.id], order: { type: 'move', x: h.x + 2, y: h.y + 9 } }); run(G, 40); // 기지 앞 땅으로(바위 위에서는 내려앉지 못함)
  if (F.immobile) moveOk = Math.abs(u.x - x0) < .01; else moveOk = Math.abs(u.x - x0) > .5 || Math.abs(u.y - (h.y + 6)) > .5;
  run(G, 20 * 5); cmd(G, 0, { type: 'ability', ids: [u.id], ability: 'morph' }); run(G, 1); finishMorph(G);
  ok(no && midway && changed && moveOk && u.def === id, `${D[id].name} → ${F.name}: ★2 전 불가, 바뀜(체력 비율·★ 유지, 포자군락은 재생 포함, 그림 다름)${F.immobile ? ', 제자리 고정' : F.air ? ', 비행' : ''}, 되돌리기`); }
// 3-2. 비행 형태: 대공 무기가 없는 지상 유닛은 못 때리고, 지형을 넘어간다. 바위 위에서는 내려앉지 못한다
{ const G = mk('pioneers', 'ironclad'), h = hq(G, 0), u = RTS.spawn(G, 'p_titan', 0, h.x + 6, h.y + 6); u.rank = 2; G.teams[0].res.ore = 3000; G.teams[0].res.gas = 3000; RTS.morph(G, u); finishMorph(G);
  const grounder = Object.keys(D).find(k => D[k].kind === 'unit' && D[k].weapon && D[k].weapon.air === false && !D[k].air);
  ok(D[u.def].air && !RTS.canHit(D[grounder].weapon, u), `비행 전함은 공중(대공 없는 ${D[grounder].name}에게 맞지 않음)`); u.cds = {};
  // 바위 한가운데(4칸 안에 땅 없음)에서는 못 내려앉고, 가장자리면 가까운 땅에 내려앉는다
  let deep = null, edge = null; for (let y = 5; y < G.h - 5; y++) for (let x = 5; x < G.w - 5; x++) { if (RTS.walkable(G, x, y)) continue; const n = RTS.nearestFree(G, x + .5, y + .5, 4), far = !n || Math.hypot(n.x - x - .5, n.y - y - .5) > 4.5 || !RTS.walkable(G, Math.floor(n.x), Math.floor(n.y));
    if (far && !deep) deep = { x: x + .5, y: y + .5 }; if (!far && !edge) edge = { x: x + .5, y: y + .5 }; }
  if (deep) { u.x = deep.x; u.y = deep.y; ok(!!RTS.morphBlock(G, u) && !RTS.morph(G, u) && D[u.def].air, '바위 한가운데서는 내려앉지 못함'); }
  u.x = edge.x; u.y = edge.y; RTS.issue(G, u, null); const started = RTS.morph(G, u); finishMorph(G); ok(started && !D[u.def].air && RTS.walkable(G, Math.floor(u.x), Math.floor(u.y)), `바위 가장자리에서는 가까운 땅에 내려앉음 (${Math.hypot(u.x - edge.x, u.y - edge.y).toFixed(1)}칸 이동)`); u.rank = 2;
  const t0 = D.p_titan, t1 = D.p_titan_f; ok(t1.speed > t0.speed && t1.armor < t0.armor && t1.weapon.damage < t0.weapon.damage && t1.hp < t0.hp, `비행 전함: 속도 ${t0.speed}→${t1.speed}, 방어 ${t0.armor}→${t1.armor}, 공격 ${t0.weapon.damage}→${t1.weapon.damage}, 체력 ${t0.hp}→${t1.hp}`); }
// 3-3. AI도 변신: 이동용(travel) 형태는 적이 없을 때, 전투용(combat)은 적이 가까울 때
{ const G = mk('pioneers', 'ironclad'), h = hq(G, 1), u = RTS.spawn(G, 'i_duelist', 1, h.x, h.y + 5); u.rank = 2; RTS.spawn(G, 'p_rifle', 0, u.x + 5, u.y); run(G, 1); // 공간 해시는 틱마다 다시 만든다
  G.teams[1].res.ore = 3000; G.teams[1].res.gas = 3000; RTS.defs.abilities.morph.ai(G, u); finishMorph(G); ok(u.def === 'i_duelist_f', 'AI: 적이 가까우면 포격 요새');
  const v = RTS.spawn(G, 'i_juggernaut', 1, h.x + 4, h.y - 6); v.rank = 2; run(G, 1); RTS.defs.abilities.morph.ai(G, v); finishMorph(G); ok(v.def === 'i_juggernaut_f', 'AI: 적이 없으면 비행선으로 이동'); }
// 3-4. 변신 대가: 자원(유닛 값 15%, 되돌리기 8%), 시간(작은 3초·큰 6초), 그동안 이동·공격 불가, 받는 피해 +30%, 자원이 없으면 불가
{ const G = mk('pioneers', 'ironclad'), h = hq(G, 0), t = G.teams[0], u = RTS.spawn(G, 'p_titan', 0, h.x + 6, h.y + 6); u.rank = 2; run(G, 1);
  t.res.ore = 10; t.res.gas = 0; ok(/자원/.test(RTS.morphBlock(G, u)) && !RTS.morph(G, u), '자원이 모자라면 변신 불가');
  t.res.ore = 2000; t.res.gas = 1000; const c = RTS.morphCost(D.p_titan), o0 = t.res.ore, g0 = t.res.gas; cmd(G, 0, { type: 'ability', ids: [u.id], ability: 'morph' }); run(G, 1);
  ok(Math.abs(o0 - t.res.ore - c.ore) < 1 && Math.abs(g0 - t.res.gas - (c.gas || 0)) < 1 && c.ore === Math.round(D.p_titan.cost.ore * RTS.MORPH.cost), `변신 비용: 광석 ${c.ore} · 에테르 ${c.gas || 0} (거대로봇 값의 15%)`);
  const x0 = u.x; cmd(G, 0, { type: 'order', ids: [u.id], order: { type: 'move', x: u.x - 6, y: u.y } }); const foe = RTS.spawn(G, 'i_blade', 1, u.x + 3, u.y); run(G, 20 * 2);
  ok(u.morphing && Math.abs(u.x - x0) < .01 && u.def === 'p_titan', '변신 중: 움직이지 않음');
  const hp = u.hp, raw = 20; RTS.damage(G, u, raw, foe); ok(Math.abs((hp - u.hp) - Math.max(1, raw * RTS.MORPH.dmgTaken - RTS.stat(G, u, 'armor'))) < 1e-6, '변신 중 받는 피해 ×1.3');
  RTS.kill(G, foe, null, true); const t6 = RTS.morphTime(D.p_titan); for (let i = 0; i < (t6 - 2) * RTS.HZ - 5; i++) RTS.step(G); ok(u.def === 'p_titan', `큰 유닛은 ${t6}초 걸림`); run(G, 10); ok(u.def === 'p_titan_f' && !u.morphing, '시간이 지나면 변신 완료');
  run(G, 20 * 5); const b = RTS.morphCost(D.p_titan_f); ok(b.ore === Math.max(RTS.MORPH.minOre, Math.round(D.p_titan.cost.ore * RTS.MORPH.back)), `되돌리기 비용: 광석 ${b.ore}`);
  ok(RTS.morphTime(D.p_commando) === RTS.MORPH.time[0] && RTS.morphTime(D.p_titan) === RTS.MORPH.time[1], `작은 유닛 ${RTS.MORPH.time[0]}초, 큰 유닛 ${RTS.MORPH.time[1]}초`); }

console.log(bad ? `실패 ${bad}` : '호위·건물 수리·변신 검사 통과'); process.exit(bad ? 1 : 0);
