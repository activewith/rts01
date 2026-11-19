// 캠페인: 미션 생성, 단계 진행·대사, 실패 조건, 승리, 이어지는 값(부족 요청), 저장 복원, 결정성
const fs = require('fs'), path = require('path'), assert = require('assert');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','engine/net','engine/campaign','data/content','data/settings','data/campaign']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
const run = (G, sec) => { for (let i = 0; i < sec * RTS.HZ && !G.over; i++) RTS.step(G); };
const mk = (id, level = 'normal', carry) => { const G = RTS.createGame(RTS.campGameOpts(id, level, 5, RTS.defaultSettings(), carry)); G.lines = []; RTS.on(G, 'story', d => G.lines.push(d.who + ': ' + d.text)); return G; };
const D = RTS.defs.entities;
// 모든 미션·난이도가 만들어지고 목표가 보인다
for (const M of RTS.CAMPAIGN.missions) for (const lv of Object.keys(RTS.CAMP_LEVELS)) { const G = mk(M.id, lv); assert(G.camp && G.camp.stage === -1, M.id); assert.equal(G.teams[1].ai, (M.ai && M.ai[lv]) || RTS.CAMP_LEVELS[lv].ai);
  assert(!G.teams[0].reveal && !G.nofog === !!RTS.defaultSettings().fog, '캠페인은 왕초보 맵 공개 없음'); assert(RTS.campGoals(G).length > 0); run(G, 3); assert(!G.over, M.id + ' 바로 끝남'); assert.equal(G.camp.stage, 0); }
// 1장: 광석 → 병영 → 소총병 → 정찰대
{ const G = mk('c1'); assert.equal(G.tribe, undefined, '1장은 부족 없음'); run(G, 1); assert(G.lines.length >= 3, '첫 대사');
  G.teams[0].stats.ore = 200; run(G, 1); assert.equal(G.camp.stage, 1); const h = RTS.camp.hq(G, 0);
  const b = RTS.spawn(G, 'p_barracks', 0, h.x + 7, h.y); b.built = b.buildT; run(G, 1); assert.equal(G.camp.stage, 2);
  for (let i = 0; i < 4; i++) RTS.spawn(G, 'p_rifle', 0, h.x + 2 + i, h.y + 4); run(G, 1); assert.equal(G.camp.stage, 3); const sc = G.camp.flags.scouts; assert.equal(sc.length, 4);
  for (const id of sc) RTS.kill(G, G.byId[id], { team: 0 }); run(G, 1); assert(G.over && G.over.winner === 0 && G.camp.result.win, '1장 승리'); console.log('1장 대사', G.lines.length, '줄'); }
// 1장: 실제로 정찰대가 기지까지 온다(전투 없이 두면 소총병과 싸움)
{ const G = mk('c1'); G.teams[0].stats.ore = 200; const h = RTS.camp.hq(G, 0); const b = RTS.spawn(G, 'p_barracks', 0, h.x + 7, h.y); b.built = b.buildT; for (let i = 0; i < 6; i++) RTS.spawn(G, 'p_rifle', 0, h.x + 2 + i, h.y + 4);
  run(G, 150); assert(G.over, '정찰대 교전 결과 ' + JSON.stringify(G.camp.result)); console.log('1장 실제 교전:', G.camp.result.win ? '승리' : '패배', (G.tick / 20).toFixed(0) + '초'); }
// 적 AI는 1·2장에서 공격하지 않고 부족 외교도 하지 않는다
{ const G = mk('c1', 'hard'); G.camp.stage = 99; const h = RTS.camp.hq(G, 0); let near = 0; for (let i = 0; i < 600 * RTS.HZ; i++) { RTS.step(G); if (i % 100 === 0) near = Math.max(near, G.ents.filter(e => e.team === 1 && D[e.def].kind === 'unit' && Math.hypot(e.x - h.x, e.y - h.y) < 20).length); } assert.equal(near, 0, '1장 적이 기지로 옴'); }
// 2장: 발견 → 동맹(수학) → 요청. 습격이 온다. 부족이 적대가 되면 실패
{ const G = mk('c2'); assert(G.tribe); run(G, 1); G.tribe.found[0] = true; run(G, 1); assert.equal(G.camp.stage, 1);
  run(G, 160); assert(G.lines.some(l => l.includes('다가와요')), '습격 알림'); assert(G.ents.some(e => e.team === 1 && e.order && e.order.type === 'amove'), '습격 부대');
  RTS.tribeRequest(G, 0); G.teams[0].res.ore = 2000; G.tribe.missions[0].forEach((m, i) => RTS.command(G, 0, { type: 'tribeAnswer', mission: i, value: m.ans })); run(G, 2);
  assert.equal(G.tribe.rel[0], 'ally'); assert.equal(G.camp.stage, 2); RTS.command(G, 0, { type: 'tribeReq', req: 'strike' }); run(G, 2); assert(G.over && G.camp.result.win, '2장 승리'); }
{ const G = mk('c2'); G.tribe.found[0] = true; run(G, 2); RTS.damage(G, G.byId[G.tribe.hall], 5, { team: 0 }); run(G, 1); assert(G.over && !G.camp.result.win && G.camp.result.why.includes('등을'), '부족 적대 → 실패'); }
// 3장: 이전 요청이 이어진다, 사령부를 모두 무너뜨리면 승리, 내가 전멸하면 실패
{ const G = mk('c3', 'normal', { req: 'share' }); assert.equal(RTS.tribeReqOf(G, 0), 'share', '요청 이어짐'); assert(G.tribe.found[0]); assert(G.ents.filter(e => e.team === 0 && e.def === 'p_rifle').length >= 4, '베테랑 소총병');
  const G2 = mk('c3', 'normal', {}); assert.equal(RTS.tribeReqOf(G2, 0), 'defend', '기본 요청');
  run(G, 2); for (const e of G.ents) if (e.team === 1 && D[e.def].dropoff && D[e.def].kind === 'building') RTS.kill(G, e, { team: 0 }); run(G, 1); assert(G.over && G.camp.result.win, '3장 승리');
  run(G2, 2); for (const e of G2.ents) if (e.team === 0) RTS.kill(G2, e, null, true); run(G2, 1); assert(G2.over && !G2.camp.result.win, '전멸 → 실패'); }
// 적이 전멸해도 목표가 남으면 끝나지 않는다(기존 승리 판정은 캠페인에서 쓰지 않음)
{ const G = mk('c1'); for (const e of G.ents) if (e.team === 1) RTS.kill(G, e, null, true); run(G, 3); assert(!G.over, '캠페인 목표 무시'); }
// 3장: AI(보통)가 실제로 공격해 온다
{ const G = mk('c3', 'normal'); G.teams[0].ai = 'normal'; run(G, 60 * 14); console.log('3장 AI끼리 14분:', G.over ? (G.camp.result.win ? '개척단 승리' : '개척단 패배') : '진행 중', '적 사령부', G.ents.filter(e => e.team === 1 && D[e.def].dropoff).length); }
// 저장 복원 후 단계·결정성
{ const a = mk('c2'); a.teams[0].ai = 'easy'; run(a, 100); a.tribe.found[0] = true; run(a, 100); const b = RTS.deserialize(RTS.serialize(a)); run(a, 120); run(b, 120);
  assert.equal(b.camp.stage, a.camp.stage); assert.equal(RTS.stateHash(a), RTS.stateHash(b), '저장 복원 결정성'); console.log('저장 복원: 단계', a.camp.stage); }
console.log('캠페인 검사 통과');
