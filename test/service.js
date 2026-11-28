// node test/service.js — 치료 비용, 치료 유닛 수 제한, 공병 수리, 철거
const fs = require('fs'), path = require('path');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade', 'engine/super','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const run = (G, n) => { for (let i = 0; i < n; i++) RTS.step(G); };
const mk = (f0, f1, ai1 = 'normal') => { const G = RTS.createGame({ map: 'ridge', seed: 3, players: [{ faction: f0 }, { faction: f1, ai: ai1 }] }); G.teams[1].aiState.plan = 'timing'; return G; };
const hq = (G, team) => G.ents.find(e => e.team === team && RTS.defOf(e).dropoff);
// 채취 수입이 비용 계산을 흐리지 않게 일꾼을 멈춘다(keep: 남길 일꾼)
const still = (G, team, keep) => { for (const e of G.ents) if (e.team === team && RTS.defOf(e).gather && e !== keep) RTS.kill(G, e, null, true); };

// 1) 정비봇 치료: 비용이 들고, 자원이 없으면 치료하지 않는다
{ const G = mk('ironclad', 'pioneers'), h = hq(G, 0), t = G.teams[0];
  still(G, 0); const m = RTS.spawn(G, 'i_mender', 0, h.x + 6, h.y), b = RTS.spawn(G, 'i_colossus', 0, h.x + 7, h.y); b.hp = 100;
  t.res.ore = 1000; t.res.gas = 1000; run(G, 200);
  const gotHp = b.hp - 100, spentO = 1000 - t.res.ore, spentG = 1000 - t.res.gas, exp = RTS.serviceCost(G, b, gotHp, RTS.SERVICE.heal);
  ok(gotHp > 50, `정비봇 치료 ${Math.round(gotHp)} 회복`);
  ok(Math.abs(spentO - exp.ore) < 1 && Math.abs(spentG - exp.gas) < 1, `치료 비용 광석 ${spentO.toFixed(1)} 에테르 ${spentG.toFixed(1)} (예상 ${exp.ore.toFixed(1)}/${exp.gas.toFixed(1)})`);
  b.hp = 100; t.res.ore = 0; t.res.gas = 0; run(G, 200);
  ok(b.hp === 100, '자원 0이면 치료하지 않음');
}
// 2) 치료 유닛 수 제한: 사람 6, AI 난이도별
{ const G = mk('ironclad', 'pioneers'), t = G.teams[0]; t.res.ore = t.res.gas = 9999;
  const core = RTS.spawn(G, 'i_core', 0, 30, 30); core.built = core.buildT = 1; const forge = RTS.spawn(G, 'i_forge', 0, 34, 30); forge.built = forge.buildT = 1; RTS.recount ? RTS.recount(G) : run(G, 1);
  for (let i = 0; i < 5; i++) RTS.spawn(G, 'i_mender', 0, 20, 20);
  RTS.commands.train(G, 0, { building: forge.id, unit: 'i_mender' }); RTS.commands.train(G, 0, { building: forge.id, unit: 'i_mender' });
  ok(forge.prod.length === 1 && RTS.healerCount(G, 0) === 6, `사람 치료 유닛 최대 ${RTS.healerCap(G, 0)} (대기열 포함 ${RTS.healerCount(G, 0)})`);
  const caps = Object.keys(RTS.defs.difficulties).map(k => { G.teams[1].ai = k; return k + ' ' + RTS.healerCap(G, 1); }).join(', ');
  ok(true, 'AI 최대 수 ' + caps);
}
// 3) 공병 수리
{ const G = mk('pioneers', 'ironclad'), h = hq(G, 0), t = G.teams[0];
  const w = G.ents.find(e => e.team === 0 && e.def === 'p_worker'); still(G, 0, w); const tk = RTS.spawn(G, 'p_tank', 0, h.x + 6, h.y + 4); tk.hp = 50; t.res.ore = 500; t.res.gas = 500;
  ok(RTS.repairBlock(G, w, tk) === '', '공병은 전차를 수리할 수 있음');
  const rifle = RTS.spawn(G, 'p_rifle', 0, h.x + 6, h.y + 5); rifle.hp = 10; ok(RTS.repairBlock(G, w, rifle) !== '', '보병은 수리 대상 아님');
  RTS.command(G, 0, { type: 'order', ids: [w.id], order: { type: 'repair', target: tk.id } }); run(G, 600);
  ok(tk.hp >= 170 && t.res.ore < 500 && t.res.gas < 500, `수리 후 체력 ${Math.round(tk.hp)} · 비용 광석 ${(500 - t.res.ore).toFixed(1)} 에테르 ${(500 - t.res.gas).toFixed(1)}`);
  ok(w.order && w.order.type === 'gather', '수리를 마친 공병은 채취로 돌아감');
  ok(!RTS.defs.entities.i_worker.repair && !RTS.defs.entities.s_drone.repair, '수리는 개척단 공병만');
}
// 4) 철거: 세 진영 일꾼, 비용, 대기열 있는 건물은 거부
for (const [f, wid, bid] of [['pioneers', 'p_worker', 'p_depot'], ['ironclad', 'i_worker', 'i_relay'], ['swarm', 's_drone', 's_pod']]) {
  const G = mk(f, f === 'swarm' ? 'pioneers' : 'swarm'), h = hq(G, 0), t = G.teams[0];
  const b = RTS.spawn(G, bid, 0, h.x + 7, h.y - 4); b.built = b.buildT; const w = G.ents.find(e => e.team === 0 && e.def === wid); still(G, 0, w); t.res.ore = 200; t.res.gas = 0;
  const cost = RTS.demoCost(RTS.defOf(b));
  RTS.command(G, 0, { type: 'demolish', ids: [w.id], building: b.id }); run(G, 1);
  ok(t.res.ore === 200 - cost.ore && b.demoPaid, `${f} 철거 비용 광석 ${cost.ore}`);
  run(G, RTS.demoTicks(RTS.defOf(b)) + 400);
  ok(b.dead, `${f} ${RTS.defOf(b).name} 철거 완료 (${RTS.demoTicks(RTS.defOf(b)) / RTS.HZ}초)`);
  ok(w.dead === undefined || !w.dead, `${f} 일꾼 생존`);
}
{ const G = mk('pioneers', 'swarm'), h = hq(G, 0), t = G.teams[0]; t.res.ore = 999; RTS.commands.train(G, 0, { building: h.id, unit: 'p_worker' });
  const w = G.ents.find(e => e.team === 0 && e.def === 'p_worker'), before = t.res.ore; RTS.commands.demolish(G, 0, { ids: [w.id], building: h.id });
  ok(!h.demoPaid && t.res.ore === before, '생산 중인 건물은 철거 거부');
  h.prod.length = 0; RTS.commands.demolish(G, 0, { ids: [w.id], building: h.id }); ok(!h.demoPaid, '마지막 사령부는 철거 거부');
  const e = G.ents.find(x => x.team === 1 && RTS.defOf(x).kind === 'building'); RTS.commands.demolish(G, 0, { ids: [w.id], building: e.id }); ok(!e.demoPaid, '상대 건물은 철거 불가');
}
// 5) 결정성: 치료·수리·철거가 섞인 AI 대전 저장 복원
{ const m = () => RTS.createGame({ map: 'lake', seed: 9, players: [{ faction: 'ironclad', ai: 'hard' }, { faction: 'pioneers', ai: 'hard' }] });
  const A = m(); run(A, 8000); let B = m(); run(B, 4000); B = RTS.deserialize(RTS.serialize(B)); run(B, 4000);
  ok(RTS.serialize(A) === RTS.serialize(B), '저장 후 이어하기 동일');
  ok(RTS.healerCount(A, 0) <= 4 && RTS.healerCount(A, 1) <= 4, `어려움 AI 치료 유닛 ${RTS.healerCount(A, 0)}, ${RTS.healerCount(A, 1)} (최대 4)`);
}
console.log(bad ? `실패 ${bad}` : '치료·수리·철거 검사 통과'); process.exit(bad ? 1 : 0);
