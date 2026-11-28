// node test/super.js — 처치 수·힌트, 히든 슈퍼 합체, 도약·은신·잠복·탐지, 수호 오라, 수송, 저장 복원·결정성
const fs = require('fs'), path = require('path');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade','engine/super','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','engine/net','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const D = RTS.defs.entities, M = RTS.defs.merges;
function setup(faction = 'pioneers', seed = 3) {
  const G = RTS.createGame({ map: 'ridge', seed, settings: { randomStart: false }, players: [{ faction }, { faction: faction === 'pioneers' ? 'ironclad' : 'pioneers' }] });
  const msgs = []; RTS.on(G, 'notice', n => { if (n.team === 0) msgs.push(n.text); }); G._msgs = msgs; G.teams[0].res.ore = G.teams[0].res.gas = 99999; return G; }
const hq0 = G => G.ents.find(e => e.team === 0 && RTS.defOf(e).dropoff);
function building(G, id, dx = 6, dy = 0, team = 0) { const h = hq0(G), e = RTS.spawn(G, id, team, Math.round(h.x + dx) + D[id].size[0] / 2, Math.round(h.y + dy) + D[id].size[1] / 2); e.built = e.buildT; e.hp = RTS.stat(G, e, 'hp'); RTS.census(G); return e; }
const run = (G, n) => { for (let i = 0; i < n; i++) RTS.step(G); };
const cmd = (G, c, team = 0) => { RTS.command(G, team, c); RTS.step(G); };
const unit = (G, id, x, y, team = 0) => RTS.spawn(G, id, team, x, y);

// 1) 처치 수와 힌트, 숨은 조리법
{ const G = setup(), h = hq0(G), a = unit(G, 'p_commando', h.x + 4, h.y + 7), b = unit(G, 'p_commando', h.x + 5, h.y + 7); building(G, 'p_barracks', 6, 4).lv = 2; RTS.census(G);
  let hint = null; RTS.on(G, 'superHint', x => { hint = x; });
  ok(!RTS.mergesOf(G, 0, 'p_commando', a).some(m => m.kills), '처치 수가 모자라면 슈퍼 합체가 메뉴에 없다');
  for (let i = 0; i < 9; i++) { const v = unit(G, 'i_blade', h.x + 4, h.y + 9, 1); RTS.kill(G, v, a); }
  ok(a.kills === 9 && !hint, '9킬: 아직 힌트 없음'); const v = unit(G, 'i_blade', h.x + 4, h.y + 9, 1); RTS.kill(G, v, a);
  ok(a.kills === 10 && hint && hint.e === a && hint.text.length > 5, `10킬: 힌트 대사 "${hint && hint.text}"`);
  ok(RTS.mergesOf(G, 0, 'p_commando', a).some(m => m.id === 'superCommando'), '10킬이면 메뉴에 슈퍼 합체');
  cmd(G, { type: 'merge', unit: a.id, recipe: 'superCommando' }); ok(!G.merges || !G.merges.length, '짝(10킬 같은 합체 유닛)이 없으면 시작하지 않는다');
  b.kills = 10; cmd(G, { type: 'merge', unit: a.id, recipe: 'superCommando' }); ok(G.merges && G.merges.length === 1, '둘 다 10킬이면 슈퍼 합체 시작');
  run(G, 300 + RTS.mergeTime(M.superCommando) * 20); const s = G.ents.find(e => e.def === 'p_supcmd' && !e.dead); ok(!!s && a.dead && b.dead && !s.kills, `강철 돌격대장 탄생(체력 ${D.p_supcmd.hp})`);
  const m2 = RTS.mergesOf(G, 0, 'p_titan', null); ok(!m2.some(m => m.kills), 'AI처럼 유닛 없이 물으면 숨은 조리법은 나오지 않는다'); }
// 2) 도약
{ const G = setup(), h = hq0(G), u = unit(G, 'p_supcmd', h.x + 3, h.y + 8), e1 = unit(G, 'i_blade', h.x + 9, h.y + 8, 1), hp0 = e1.hp;
  e1.order = null; cmd(G, { type: 'ability', ids: [u.id], ability: 'leap', x: h.x + 9, y: h.y + 8 }); run(G, 60);
  ok(Math.hypot(u.x - (h.x + 9), u.y - (h.y + 8)) < 2.5 && e1.hp < hp0, `도약: 착지 위치 거리 ${Math.hypot(u.x - (h.x + 9), u.y - (h.y + 8)).toFixed(2)}, 피해 ${hp0 - e1.hp}`);
  ok((u.cds.leap || 0) > G.tick, '도약 재사용 대기'); }
// 3) 은신·탐지
{ const G = setup('ironclad', 5), h = hq0(G), k = unit(G, 'i_supduel', h.x + 3, h.y + 8), en = unit(G, 'p_rifle', h.x + 6, h.y + 8, 1);
  cmd(G, { type: 'ability', ids: [k.id], ability: 'cloak' }); run(G, 4);
  ok(RTS.stealthed(G, k) && !RTS.seen(G, 1, k) && RTS.seen(G, 0, k), '은신: 상대에게 안 보이고 나에게는 보인다');
  ok(!RTS.scan(G, en, RTS.weapon(en), 8) || RTS.scan(G, en, RTS.weapon(en), 8).id !== k.id, '상대 유닛이 은신 유닛을 겨누지 못한다');
  const med = unit(G, 'p_medic', h.x + 7, h.y + 8, 1); run(G, 8); ok(!RTS.seen(G, 1, k), '★0 의무병은 탐지하지 못한다');
  med.rank = 1; run(G, 8); ok(RTS.seen(G, 1, k), '★1 의무병 시야 안이면 드러난다');
  med.x = h.x + 30; run(G, 8); ok(!RTS.seen(G, 1, k), '의무병이 멀어지면 다시 숨는다');
  run(G, 12 * 20); ok(!RTS.stealthed(G, k), '12초 뒤 은신 풀림'); }
// 4) 잠복
{ const G = setup('swarm', 7), h = hq0(G), v = unit(G, 's_supvenom', h.x + 3, h.y + 8); v.hp = 100;
  cmd(G, { type: 'ability', ids: [v.id], ability: 'burrow' }); const x0 = v.x; RTS.command(G, 0, { type: 'move', ids: [v.id], x: h.x + 10, y: h.y + 8 }); run(G, 60);
  ok(v.burrowed && Math.abs(v.x - x0) < .01 && v.hp > 100, `잠복: 움직이지 않고 회복(${Math.round(v.hp)})`); ok(!RTS.seen(G, 1, v), '잠복: 상대에게 안 보임');
  run(G, 40); cmd(G, { type: 'ability', ids: [v.id], ability: 'burrow' }); ok(!v.burrowed, '다시 누르면 나온다'); }
// 5) 수호 오라
{ const G = setup(), h = hq0(G), t = unit(G, 'p_supertitan', h.x + 4, h.y + 9), r = unit(G, 'p_rifle', h.x + 6, h.y + 9), far = unit(G, 'p_rifle', h.x + 20, h.y + 9); run(G, 6);
  const a0 = r.hp, b0 = far.hp; RTS.damage(G, r, 20, null); RTS.damage(G, far, 20, null); ok(a0 - r.hp < b0 - far.hp, `오라 안 피해 ${a0 - r.hp} < 밖 ${b0 - far.hp}`);
  t.hp -= 100; const hp1 = t.hp; run(G, 40); ok(t.hp > hp1, '스스로 회복'); }
// 6) 수송: 변신 → 태우기 → 내리기, 수송선이 쓰러지면 탄 유닛이 나온다
{ const G = setup(), h = hq0(G), t = unit(G, 'p_supertitan', h.x + 4, h.y + 9); t.rank = 2; building(G, 'p_factory', 6, 4).lv = 2; RTS.census(G);
  cmd(G, { type: 'ability', ids: [t.id], ability: 'morph' }); run(G, 7 * 20); ok(t.def === 'p_supertitan_f' && D[t.def].air && D[t.def].transport === 8, '변신하면 하늘을 나는 수송선(8자리)');
  const us = []; for (let i = 0; i < 10; i++) us.push(unit(G, i < 9 ? 'p_rifle' : 'p_tank', t.x + (i % 3) * .6 - .6, t.y + 1 + Math.floor(i / 3) * .5));
  cmd(G, { type: 'ability', ids: [t.id], ability: 'loadnear' }); ok(t.load.length === 8 && us.filter(u => u.inside === t.id).length === 8, `주변 태우기: ${t.load.length}/8`);
  const inner = G.byId[t.load[0]]; let found = false; RTS.query(G, inner.x, inner.y, 1, o => { if (o === inner) found = true; }); ok(!found, '탄 유닛은 공간 검색에서 빠진다(공격받지 않음)');
  cmd(G, { type: 'ability', ids: [t.id], ability: 'morph' }); ok(t.def === 'p_supertitan_f' && G._msgs.includes('먼저 탄 유닛을 내려야 합니다') === false || !!RTS.morphBlock(G, t), '탄 유닛이 있으면 원래 모습으로 변신 못 함');
  RTS.command(G, 0, { type: 'move', ids: [t.id], x: t.x + 8, y: t.y }); run(G, 120); ok(Math.hypot(inner.x - t.x, inner.y - t.y) < .01, '탄 유닛이 수송선을 따라간다');
  cmd(G, { type: 'ability', ids: [t.id], ability: 'unload' }); ok(!t.load.length && us.filter(u => !u.inside).length === 10, '모두 내리기');
  const r2 = us[0]; RTS.command(G, 0, { type: 'board', ids: [r2.id], target: t.id }); run(G, 200); ok(r2.inside === t.id, '유닛을 고르고 수송선 지정: 걸어가서 탄다');
  const hp2 = r2.hp; RTS.kill(G, t, null); ok(!r2.inside && r2.hp < hp2 && !r2.dead, '수송선이 쓰러지면 피해를 입고 나온다'); }
// 7) 저장 복원·결정성(은신·수송 중)
{ const mk = () => { const G = setup('ironclad', 9), h = hq0(G), k = unit(G, 'i_supduel', h.x + 3, h.y + 8), j = unit(G, 'i_superjug_f', h.x + 5, h.y + 9); j.rank = 2; unit(G, 'i_blade', h.x + 5, h.y + 10); unit(G, 'p_medic', h.x + 8, h.y + 8, 1).rank = 1;
    RTS.command(G, 0, { type: 'ability', ids: [k.id], ability: 'cloak' }); RTS.command(G, 0, { type: 'ability', ids: [j.id], ability: 'loadnear' }); return G; };
  const A = mk(); run(A, 400); let B = mk(); run(B, 150); B = RTS.deserialize(RTS.serialize(B)); run(B, 250); ok(RTS.serialize(A) === RTS.serialize(B), '은신·수송 중 저장·복원 후 상태 동일'); }
console.log(fail ? `실패 ${fail}건` : '슈퍼 합체·특수 기능 검사 통과'); process.exit(fail ? 1 : 0);
