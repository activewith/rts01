// 캠페인: 모든 미션 생성(난이도·1인/2인), 전용 맵 연결성, 지점 도달·구조·호위·거점 지키기 목표, 단계 사건 시간, 해금 규칙, 기록, 보류 수입, 결정성·저장 복원
const fs = require('fs'), path = require('path'), assert = require('assert');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','engine/net','engine/campaign','data/content','data/settings','data/campaign']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
const run = (G, sec) => { for (let i = 0; i < sec * RTS.HZ && !G.over; i++) RTS.step(G); };
const D = RTS.defs.entities, C = RTS.camp;
const mk = (id, level = 'normal', carry, mode) => { const G = RTS.createGame(RTS.campGameOpts(id, level, 5, RTS.defaultSettings(), carry, mode)); G.lines = []; RTS.on(G, 'story', d => G.lines.push(d.who + ': ' + d.text)); return G; };
const DUO = { duo: true, factions: ['ironclad', 'swarm'], names: ['아빠', '아들'] };
const units = (G, t) => G.ents.filter(e => e.team === t && !e.dead && D[e.def].kind === 'unit');
const moveAll = (G, t, x, y) => { for (const u of units(G, t)) { u.x = x + (u.id % 3) * .4; u.y = y + (u.id % 2) * .4; u.px = u.x; u.py = u.y; u.order = null; } };

// 구성: 1인 3진영 × 5, 2인 5, 히든 1, 히든 캠페인 3
const groups = RTS.CAMPAIGN.groups; assert.deepEqual(groups.map(g => g.kind + g.missions.length).join(), 'solo5,solo5,solo5,duo5,hidden1,deep3');
assert.deepEqual(RTS.campLevels(RTS.campDef('x1')), ['normal', 'hard'], '히든 미션: 보통·어려움'); assert.deepEqual(RTS.campLevels(RTS.campDef('h1')), ['normal']); assert.deepEqual(RTS.campLevels(RTS.campDef('h3')), ['hard'], '최종장: 어려움만');
assert(Object.values(RTS.defs.maps).filter(m => m.camp).length >= 8, '전용 맵 8개');

// 모든 미션·난이도·방식이 만들어지고 첫 단계가 열린다. 사람 팀이 바로 지지 않는다
for (const M of RTS.campAll()) for (const mode of M.players === 2 ? [{}, DUO] : [{}]) for (const lv of RTS.campLevels(M)) {
  const G = mk(M.id, lv, {}, mode); assert(G.camp && G.camp.stage === -1, M.id); assert.equal(G.camp.level, lv);
  assert.deepEqual(G.camp.ps, mode.duo ? [0, 1] : [0], M.id + ' 사람 팀'); assert(G.coop && !G.teams[0].reveal, '캠페인은 편 단위·맵 공개 없음');
  const foe = C.foe(G); assert(foe > 0 && G.teams[foe].ai, M.id + ' 적 AI'); assert(G.teams[C.npc(G)].npc, M.id + ' 수비대');
  if (M.players === 2 && !mode.duo) assert(G.teams[1].ai && G.teams[1].side === 0, M.id + ' 1인이면 AI 동료');
  run(G, 3); assert(!G.over, M.id + ' 바로 끝남 ' + JSON.stringify(G.camp.result)); assert.equal(G.camp.stage, 0); assert(RTS.campGoals(G).length > 0); }
// 진영 고르기: 2인 미션은 A·B가 두 사람 진영, 적·수비대는 남은 진영
{ const G = mk('d1', 'normal', {}, DUO); assert.deepEqual(G.teams.map(t => t.faction), ['ironclad', 'swarm', 'pioneers', 'pioneers']); }

// 전용 맵: 모든 기지와 미션 지점이 첫 기지(또는 시작 부대)에서 걸어서 닿는다
for (const M of RTS.campAll()) { const G = mk(M.id, RTS.campLevels(M)[0], {}, M.players === 2 ? DUO : {}); const pts = [];
  for (const S of M.stages) for (const g of S.goals) if (g.at) pts.push([g.at[0], g.at[1]]);
  for (const b of G.bases) if (RTS.defs.maps[M.map].bases.find(x => x.x === b.x && x.y === b.y).ore !== 0) pts.push([b.x, b.y]);
  const from = units(G, 0)[0] || C.hq(G, 0);
  for (const [x, y] of pts) { const p = RTS.findPath(G, from.x, from.y, { x0: x - 1, y0: y - 1, x1: x + 1, y1: y + 1 }), l = p[p.length - 1]; assert(l && Math.hypot(l[0] - x, l[1] - y) < 4, `${M.id} ${M.map}: (${x},${y})에 닿지 않음`); } }

// 1장(개척단): 본진 없이 부대로 시작 → 신호기 도달 → 사령부 착륙 → 광석 → 병영 → 소총병 → 정찰대
{ const G = mk('p1'); assert(!C.hq(G, 0), '본진 없이 시작'); assert(units(G, 0).length === 6); run(G, 1); assert.equal(RTS.campMarks(G).length, 1, '신호기 표식');
  moveAll(G, 0, 12, 34); run(G, 1); assert(C.hq(G, 0), '착륙선 도착'); assert.equal(G.camp.stage, 1); assert.equal(RTS.campMarks(G).length, 0, '닿은 지점은 표식이 사라짐');
  G.teams[0].stats.ore = 300; run(G, 1); assert.equal(G.camp.stage, 2); C.building(G, 0, 'p_barracks', 18, 32); run(G, 1); assert.equal(G.camp.stage, 3);
  C.spawnAt(G, 0, Array(8).fill('p_rifle'), 16, 36); run(G, 1); assert.equal(G.camp.stage, 4); const sc = G.camp.flags.scouts; assert(sc.length >= 5);
  for (const id of sc) RTS.kill(G, G.byId[id], { team: 0 }); run(G, 1); assert(G.over && G.camp.result.win, '1장 승리'); console.log('개척단 1장 대사', G.lines.length, '줄'); }
// 사람 팀은 유닛만 남아도 지지 않는다(본진 없는 미션). 유닛·건물이 모두 없어지면 실패
{ const G = mk('p3'); run(G, 2); assert(!G.over); for (const u of units(G, 0)) RTS.kill(G, u, null, true); run(G, 1); assert(G.over && !G.camp.result.win, '부대 전멸 → 실패'); }
// 2장: 구조 지점에 닿으면 부대 합류(유지 목표는 떠나도 풀리지 않는다), 부족 동맹, 요청 고르기 → 이어지는 값
{ const G = mk('p2'); run(G, 1); const n0 = units(G, 0).length; const r = C.spawnAt(G, 0, ['p_rifle'], 12, 13); run(G, 1); assert(units(G, 0).length >= n0 + 5, '정찰대 합류'); assert.equal(G.camp.stage, 1);
  RTS.kill(G, G.byId[r[0]], null, true); run(G, 1); assert.equal(G.camp.stage, 1, '유지 목표');
  G.tribe.found[0] = true; run(G, 1); assert.equal(G.camp.stage, 2); RTS.tribeRequest(G, 0); G.teams[0].res.ore = 2000; G.tribe.missions[0].forEach((m, i) => RTS.command(G, 0, { type: 'tribeAnswer', mission: i, value: m.ans })); run(G, 2);
  assert.equal(G.camp.stage, 3); RTS.command(G, 0, { type: 'tribeReq', req: 'share' }); run(G, 2); assert(G.over && G.camp.result.win); assert.equal(RTS.campDef('p2').carryOut(G).req, 'share', '이어지는 값'); }
// 4장: 2장 요청이 이어진다
{ const a = mk('p4', 'normal', { req: 'share' }), b = mk('p4', 'normal', { req: 'strike' }), c = mk('p4', 'normal', {});
  assert(a.teams[0].res.ore > c.teams[0].res.ore, '공유: 자원'); assert(units(b, 0).length > units(c, 0).length, '협공: 병력'); assert(C.count(c, 0, 'p_turret') === 2, '기본(방어): 포탑'); }
// 철갑회 3장: 호위 대상이 부서지면 실패
{ const G = mk('i3'); run(G, 1); RTS.kill(G, G.byId[G.camp.flags.convoy], null, true); moveAll(G, 0, 36, 58); run(G, 2); assert.equal(G.camp.stage, 1); run(G, 1); assert(G.over && G.camp.result.why.includes('중장봇'), '호위 실패'); }
// 2인 2장: 거점 지키기는 적이 없을 때만 쌓이고, 두 거점을 채우면 다음 단계
{ const G = mk('d2', 'normal', {}, DUO); run(G, 1); for (const e of G.ents) if (e.team === C.npc(G)) RTS.kill(G, e, null, true);
  C.spawnAt(G, 0, ['i_blade', 'i_blade'], 12, 56); C.spawnAt(G, 1, ['s_claw'], 60, 56); const f = C.spawnAt(G, C.foe(G), ['p_rifle'], 60, 58); for (const id of f) G.byId[id].order = { type: 'hold' };
  run(G, 10); assert(G.camp.flags.hw >= 9 && !(G.camp.flags.he > 0), '적이 있는 거점은 쌓이지 않음 ' + JSON.stringify(G.camp.flags)); RTS.kill(G, G.byId[f[0]], null, true);
  C.spawnAt(G, 1, ['s_claw', 's_claw'], 60, 56); G.camp.flags.hw = 89; G.camp.flags.he = 89; run(G, 2); assert.equal(G.camp.stage, 1, '두 거점 완료'); }
// 2인 1장: 두 사람 부대가 모두 와야 한다(each). 한 사람만 오면 그대로
{ const G = mk('d1', 'normal', {}, DUO); run(G, 1); moveAll(G, 0, 44, 32); run(G, 2); assert.equal(G.camp.stage, 0, '한 사람만 도착'); moveAll(G, 1, 45, 33); run(G, 1); assert.equal(G.camp.stage, 1); assert(C.hq(G, 0) && C.hq(G, 1), '두 기지 착륙');
  // 한 사람이 전멸해도 다른 사람이 남으면 계속
  for (const e of G.ents) if (e.team === 1) RTS.kill(G, e, null, true); run(G, 2); assert(!G.over, '동료가 남으면 계속'); }
// 단계 사건은 그 단계가 시작된 뒤 시간으로 센다(3장 협곡: 4단계 시작 25초 뒤 첫 습격)
{ const G = mk('p3'); run(G, 1); for (const k of ['g1', 'eng', 'fort']) { G.camp.flags[k] = 1; run(G, 1); } assert.equal(G.camp.stage, 3); const t0 = G.tick;
  const raids = () => G.lines.filter(l => l.includes('다가옵니다')).length; run(G, 20); assert.equal(raids(), 0, '아직 습격 없음'); run(G, 8); assert.equal(raids(), 1, '습격 시작'); assert(G.tick - t0 > 25 * RTS.HZ); }
// 공격 보류 중인 적은 수입이 줄고, 보류를 풀면 되돌아온다
{ const G = mk('p5'); const f = G.teams[C.foe(G)]; assert(f.aiState.hold && f.inc0 && Math.abs(f.inc - f.inc0 * RTS.CAMP_HOLD_INC) < 1e-9); C.unhold(G); assert(!f.aiState.hold && f.inc === RTS.defs.difficulties[f.ai].income); }
// 히든 미션: 난이도에 따라 수호자 수가 다르다
{ assert.equal(mk('x1', 'normal').camp.flags.bosses.length, 2); assert.equal(mk('x1', 'hard').camp.flags.bosses.length, 3); }
// 끝 대사: 2인 5장은 어려움이면 히든 안내, 아니면 힌트
{ for (const [lv, word] of [['hard', '심연의 문'], ['normal', '힌트']]) { const G = mk('d5', lv, {}, DUO); run(G, 1); for (const e of G.ents) if (e.team === C.foe(G) && e.def === RTS.defs.factions[G.teams[C.foe(G)].faction].hq) RTS.kill(G, e, { team: 0 }); run(G, 1);
  assert(G.over && G.camp.result.win && G.lines.some(l => l.includes(word)), lv + ' 끝 대사'); } }

// 해금 규칙
{ const S = d => RTS.campStatus({ done: d }); const rec = (ids, lv) => Object.fromEntries(ids.map(i => [i, { best: 1, level: lv || 'normal', hard: lv === 'hard' }]));
  let s = S({}); assert(s.open('p1') && s.open('i1') && s.open('s1') && !s.open('p2') && !s.duoOpen && !s.visible(groups[4]), '처음: 진영별 1장만');
  s = S(rec(['p1', 'p2', 'p3', 'p4'])); assert(s.open('p5') && !s.duoOpen, '5장 전에는 2인 잠김');
  s = S(rec(['p1', 'p2', 'p3', 'p4', 'p5'])); assert(s.duoOpen && s.open('d1') && !s.open('d2'), '한 진영 5장 → 2인 열림');
  s = S(rec(['s1', 's2', 's3', 's4', 's5', 'd1', 'd2', 'd3', 'd4', 'd5'])); assert(!s.hidOpen && s.hint && s.visible(groups[4]) && !s.open('x1'), '보통으로 깨면 힌트만');
  s = S(Object.assign(rec(['s1', 's2', 's3', 's4', 's5', 'd1', 'd2', 'd3', 'd4']), rec(['d5'], 'hard'))); assert(s.hidOpen && s.open('x1') && !s.deepOpen, '어려움으로 깨면 히든 미션');
  s = S(Object.assign(rec(['s1', 's2', 's3', 's4', 's5', 'd1', 'd2', 'd3', 'd4', 'x1']), rec(['d5'], 'hard'))); assert(s.deepOpen && s.open('h1') && !s.open('h2'), '히든 미션 → 히든 캠페인 1장');
  RTS.CAMP_RULES.duoNeed = 'all'; assert(!S(rec(['p1', 'p2', 'p3', 'p4', 'p5'])).duoOpen, "'all'이면 세 진영 모두"); RTS.CAMP_RULES.duoNeed = 'any';
  // 학습 관문(성공 뒤): 풀기 전에는 다음 미션이 닫혀 있고, 풀면 열린다. 한 번 푼 미션은 다시 깨도 열린 채
  { const q = { done: {} }; RTS.campRecord(q, 'p1', 'normal', 100, true); assert(RTS.campLearnPending(q, 'p1') && !RTS.campStatus(q).open('p2'), '학습 남음 → 다음 닫힘');
    RTS.campLearnDone(q, 'p1'); assert(!RTS.campLearnPending(q, 'p1') && RTS.campStatus(q).open('p2'), '학습 통과 → 다음 열림'); RTS.campRecord(q, 'p1', 'hard', 90, true); assert(RTS.campStatus(q).open('p2'), '이미 푼 관문은 유지');
    const r = Object.assign(rec(['p1', 'p2', 'p3', 'p4']), { p5: { best: 1, level: 'normal', learn: false } }); assert(!RTS.campStatus({ done: r }).duoOpen, '5장 학습 남으면 2인 닫힘'); }
  // 기록: 최고 기록·가장 높은 난이도·어려움 여부를 지킨다
  const p = { done: {} }; RTS.campRecord(p, 'd5', 'hard', 9000); RTS.campRecord(p, 'd5', 'easy', 5000); assert.deepEqual(p.done.d5, { best: 5000, level: 'hard', hard: true }); }

// 결정성: 같은 옵션으로 만든 두 게임(두 기기)이 같은 상태가 된다. 저장 복원 뒤에도 같다
{ const o = RTS.campGameOpts('d3', 'hard', 77, RTS.defaultSettings(), {}, DUO), a = RTS.createGame(JSON.parse(JSON.stringify(o))), b = RTS.createGame(JSON.parse(JSON.stringify(o)));
  for (const G of [a, b]) { G.teams[0].ai = 'normal'; G.teams[1].ai = 'normal'; } run(a, 150); run(b, 150); assert.equal(RTS.stateHash(a), RTS.stateHash(b), '두 기기 동일');
  const c = RTS.deserialize(RTS.serialize(a)); run(a, 120); run(c, 120); assert.equal(c.camp.stage, a.camp.stage); assert.equal(RTS.stateHash(a), RTS.stateHash(c), '저장 복원 결정성'); console.log('2인 3장 결정성: 단계', a.camp.stage, (a.tick / 1200).toFixed(1) + '분'); }
{ const a = mk('p2'); a.teams[0].ai = 'easy'; run(a, 100); a.tribe.found[0] = true; run(a, 60); const b = RTS.deserialize(RTS.serialize(a)); run(a, 120); run(b, 120);
  assert.equal(RTS.stateHash(a), RTS.stateHash(b), '1인 저장 복원'); }
console.log('캠페인 검사 통과');
