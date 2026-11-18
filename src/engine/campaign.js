// campaign.js — 캠페인 모드. 이어지는 이야기 속 미션을 차례로 깬다(혼자 하기).
// 미션 데이터는 src/data/campaign.js의 RTS.CAMPAIGN. 게임 상태에는 G.camp(미션 id, 단계, 표시값)만 들어가서 저장·이어하기가 된다.
// 미션: { id, title, map, faction, enemy, ai(난이도별), tribe, setup(G, carry), stages:[{ say, goals:[{text, prog(G)}], enter(G), fail(G) }], events:[{ at|every, run(G) }], win: [대사] }
// 단계의 목표를 모두 채우면 다음 단계로 넘어가고 그 단계의 대사(say)를 띄운다. 마지막 단계를 마치면 승리.
// 내 건물·유닛이 모두 없어지거나 단계의 fail(G)이 문장을 돌려주면 실패.
RTS.campDef = id => (RTS.CAMPAIGN && RTS.CAMPAIGN.missions.find(m => m.id === id)) || null;
RTS.campIndex = id => RTS.CAMPAIGN ? RTS.CAMPAIGN.missions.findIndex(m => m.id === id) : -1;
// 난이도: 적 AI 단계. 캠페인은 왕초보의 맵 공개·방어탑을 쓰지 않는다
RTS.CAMP_LEVELS = { easy: { name: '쉬움', ai: 'beginner' }, normal: { name: '보통', ai: 'easy' }, hard: { name: '어려움', ai: 'normal' } };

// 미션 시작 옵션. carry: 앞 미션에서 이어지는 값(예: 잿빛 부족에 한 요청)
RTS.campGameOpts = function (id, level, seed, settings, carry) {
  const M = RTS.campDef(id), L = RTS.CAMP_LEVELS[level] || RTS.CAMP_LEVELS.normal;
  return { map: M.map, seed, settings: Object.assign({}, settings, M.settings || {}), camp: { id, level: level in RTS.CAMP_LEVELS ? level : 'normal', carry: carry || {} },
    players: [{ faction: M.faction, name: M.playerName || '개척단' }, { faction: M.enemy, ai: (M.ai && M.ai[level]) || L.ai, name: M.enemyName || RTS.defs.factions[M.enemy].name }] };
};
RTS.initCampaign = function (G, c) { const M = RTS.campDef(c.id); if (!M) return;
  G.camp = { id: c.id, level: c.level, carry: c.carry || {}, stage: 0, flags: {}, ev: {}, result: null };
  const ai = G.teams[1]; if (ai) Object.assign(ai.aiState, M.aiState || {});
  if (M.setup) M.setup(G, G.camp.carry);
  G.camp.stage = -1; }; // 첫 단계는 첫 틱에 연다(화면이 대사를 받을 수 있도록)
const campSay = (G, lines) => { for (const [who, text] of lines || []) RTS.emit(G, 'story', { who, text }); };
function campEnter(G, i) { const M = RTS.campDef(G.camp.id), S = M.stages[i]; G.camp.stage = i; if (!S) return;
  if (S.enter) S.enter(G); campSay(G, S.say); RTS.emit(G, 'campStage', { stage: i }); }
// 지금 단계 목표의 진행도 [{text, cur, need, done}]
RTS.campGoals = function (G) { const M = G.camp && RTS.campDef(G.camp.id), S = M && M.stages[Math.max(0, G.camp.stage)]; if (!S) return [];
  return S.goals.map(g => { const [cur, need] = g.prog(G); return { text: typeof g.text === 'function' ? g.text(G) : g.text, cur: Math.min(cur, need), need, done: cur >= need }; }); };
function campEnd(G, win, why) { if (G.over) return; const M = RTS.campDef(G.camp.id);
  G.camp.result = { win, why: why || '' }; if (win) campSay(G, M.win); else if (why) RTS.emit(G, 'story', { who: '', text: why });
  G.over = { winner: win ? 0 : 1, tick: G.tick, camp: true }; RTS.emit(G, 'gameover', G.over); }
RTS.campEnd = campEnd;

RTS.addSystem({ id: 'campaign', run(G) {
  const C = G.camp; if (!C || G.over || G.tick % 10) return; const M = RTS.campDef(C.id); if (!M) return; const sec = G.tick / RTS.HZ;
  if (C.stage < 0) campEnter(G, 0);
  for (let i = 0; i < (M.events || []).length; i++) { const e = M.events[i], k = 'e' + i;
    if (e.when && !e.when(G)) continue;
    if (e.at !== undefined && !C.ev[k] && sec >= e.at) { C.ev[k] = 1; e.run(G); }
    if (e.every && sec >= (e.from || 0) && sec >= (C.ev[k] || 0)) { C.ev[k] = sec + e.every; if ((C.ev[k + 'n'] = (C.ev[k + 'n'] || 0) + 1) > 0) e.run(G, C.ev[k + 'n']); } }
  RTS.census(G); if (G.teams[0].alive === 0) { campEnd(G, false, '개척단이 모두 쓰러졌습니다'); return; }
  const S = M.stages[C.stage]; if (!S) return;
  const why = S.fail && S.fail(G); if (why) { campEnd(G, false, why); return; }
  if (S.goals.every(g => { const [cur, need] = g.prog(G); return cur >= need; })) { if (C.stage + 1 >= M.stages.length) campEnd(G, true); else campEnter(G, C.stage + 1); }
} }, { before: 'victory' });

// 미션 스크립트용 도구
RTS.camp = {
  hq: (G, team) => G.ents.find(e => e.team === team && !e.dead && RTS.defOf(e).dropoff && RTS.defOf(e).kind === 'building'),
  // team 쪽 본진 근처(없으면 맵 반대편)에 유닛을 만들어 목표로 공격 이동시킨다. 만든 유닛 id 목록을 돌려준다
  wave(G, team, list, goal) { const h = RTS.camp.hq(G, team) || { x: G.w - 10, y: G.h - 10 }, ids = [];
    list.forEach((id, k) => { const a = k * 1.3, p = RTS.nearestFree(G, h.x + Math.cos(a) * 4, h.y + Math.sin(a) * 4), u = RTS.spawn(G, id, team, p.x, p.y); ids.push(u.id); if (goal) RTS.issue(G, u, { type: 'amove', x: goal.x, y: goal.y }); });
    return ids; },
  alive: (G, ids) => (ids || []).filter(i => { const e = G.byId[i]; return e && !e.dead; }).length,
  count: (G, team, def) => G.ents.filter(e => e.team === team && !e.dead && e.def === def && (RTS.defOf(e).kind !== 'building' || RTS.complete(e))).length,
  // 플레이어 건물 중 target에 가장 가까운 것
  nearest(G, team, from) { let b = null, bd = 1e12; for (const e of G.ents) { if (e.team !== team || e.dead || RTS.defOf(e).kind !== 'building') continue; const q = (e.x - from.x) ** 2 + (e.y - from.y) ** 2; if (q < bd) { bd = q; b = e; } } return b; },
};
