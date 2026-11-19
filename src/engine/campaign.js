// campaign.js — 캠페인 모드. 이어지는 이야기 속 미션을 차례로 깬다.
// 미션 데이터는 src/data/campaign.js의 RTS.CAMPAIGN. 게임 상태에는 G.camp(미션 id, 단계, 깃발·누적값)만 들어가서 저장·이어하기와 두 기기 결정성이 유지된다.
//
// 묶음(RTS.CAMPAIGN.groups): solo(진영별 1인 5단계) · duo(2인 5단계) · hidden(히든 미션) · deep(히든 캠페인 3단계)
// 미션: { id, title, map, brief, levels, players, teams, setup(G, carry), stages, events, win, end }
//   teams: [{ role: 'me'|'mate'|'foe'|'npc', faction, ai, base(기지 번호 또는 null), noBase, boost, name }]
//     - 'me'는 0번 사람. 'mate'는 2인이면 1번 사람, 1인으로 하면 AI 동료가 된다. 'foe'는 적 AI, 'npc'는 제자리를 지키는 수비대(AI 없음).
//     - faction이 'A'·'B'면 2인 미션에서 두 사람이 고른 진영, 'C'는 남은 진영.
//   stages: [{ say, goals: [goal], enter(G), fail(G), marks(G) }]
//   events: [{ at | every, from, stage, when, run(G, n) }] — stage가 있으면 그 단계에서만, 시간도 그 단계 시작부터 센다. every 간격은 난이도가 높을수록 짧아진다(÷√k)
//   goal: { text, prog(G) → [현재, 목표] }  ─ 매번 계산
//         { text, key, test(G), done(G) }  ─ 한 번 채우면 유지(latch). done은 채우는 순간 한 번 실행(구조한 부대 합류 등)
//         { text, key, acc(G), need }     ─ acc가 참인 동안 초를 쌓는다(거점 지키기)
//   지점 표식: 단계의 marks(G) → [{ x, y, r, label, done }] (화면·미니맵에 그린다. 게임 상태가 아니다)
// 단계 목표를 모두 채우면 다음 단계, 마지막 단계를 마치면 승리. 사람 팀(G.camp.ps)이 모두 쓰러지거나 단계의 fail(G)이 문장을 돌려주면 실패.
RTS.campAll = () => (RTS.CAMPAIGN ? RTS.CAMPAIGN.groups.flatMap(g => g.missions.map(m => Object.assign(m, { group: g.id }))) : []);
RTS.campDef = id => RTS.campAll().find(m => m.id === id) || null;
RTS.campGroup = id => (RTS.CAMPAIGN ? RTS.CAMPAIGN.groups.find(g => g.id === id) : null);
RTS.campIndex = id => { const M = RTS.campDef(id), g = M && RTS.campGroup(M.group); return g ? g.missions.indexOf(M) : -1; };
RTS.campNext = id => { const M = RTS.campDef(id), g = M && RTS.campGroup(M.group); return g ? g.missions[g.missions.indexOf(M) + 1] || null : null; };
// 난이도: 적 AI 단계와 스크립트 부대 크기 배율 k
RTS.CAMP_LEVELS = { easy: { name: '쉬움', ai: 'beginner', k: .7 }, normal: { name: '보통', ai: 'easy', k: 1 }, hard: { name: '어려움', ai: 'normal', k: 1.35 } };
// 미션이 고를 수 있는 난이도. 미션의 levels가 없으면 세 단계 모두
RTS.campLevels = M => M.levels || ['easy', 'normal', 'hard'];
RTS.campK = G => (RTS.CAMP_LEVELS[G.camp.level] || RTS.CAMP_LEVELS.normal).k * (G.camp.duo ? 1.15 : 1); // 두 사람이면 스크립트 부대 1.15배

// 미션 시작 옵션. mode: { duo(두 사람), factions: [A, B], names } — duo가 아니면 'mate'는 AI 동료
RTS.campGameOpts = function (id, level, seed, settings, carry, mode) {
  const M = RTS.campDef(id), mo = mode || {}, lv = RTS.campLevels(M).includes(level) ? level : RTS.campLevels(M)[Math.min(1, RTS.campLevels(M).length - 1)], L = RTS.CAMP_LEVELS[lv];
  const fs = Object.keys(RTS.defs.factions), A = (mo.factions && mo.factions[0]) || M.faction || fs[0], B = (mo.factions && mo.factions[1] && mo.factions[1] !== A ? mo.factions[1] : fs.find(f => f !== A));
  const pick = f => f === 'A' ? A : f === 'B' ? B : f === 'C' ? fs.find(x => x !== A && x !== B) : f;
  const duo = !!mo.duo && M.players !== 1;
  const players = [], starts = [];
  M.teams.forEach((T, i) => { const f = pick(T.faction), p = { faction: f, side: T.role === 'me' || T.role === 'mate' ? 0 : 1 };
    if (T.role === 'me') { p.name = (mo.names && mo.names[0]) || T.name || RTS.defs.factions[f].name; if (T.noBase) p.noBase = true; }
    else if (T.role === 'mate') { if (duo) { p.name = (mo.names && mo.names[1]) || '동료'; if (T.noBase) p.noBase = true; } else { p.ai = T.allyAi || 'normal'; p.name = (T.name || RTS.defs.factions[f].name) + ' (AI 동료)'; } }
    else if (T.role === 'npc') { p.npc = true; p.name = T.name || '수비대'; }
    else { p.ai = (T.ai && T.ai[lv]) || L.ai; p.boost = (T.boost && typeof T.boost === 'object' ? T.boost[lv] : T.boost) || 1; p.name = T.name || RTS.defs.factions[f].name; } // boost: 숫자 또는 난이도별 { normal, hard }
    players.push(p); starts.push(T.base === undefined ? null : T.base); });
  return { map: M.map, seed, coop: true, net: !!mo.duo, starts, settings: Object.assign({}, settings, M.settings || {}),
    camp: { id, level: lv, carry: carry || {}, duo }, players };
};
RTS.initCampaign = function (G, c) { const M = RTS.campDef(c.id); if (!M) return;
  const ps = M.teams.map((T, i) => (T.role === 'me' || (T.role === 'mate' && c.duo) ? i : -1)).filter(i => i >= 0);
  G.camp = { id: c.id, level: c.level, duo: !!c.duo, ps, carry: c.carry || {}, stage: 0, t0: 0, flags: {}, ev: {}, result: null };
  M.teams.forEach((T, i) => { const t = G.teams[i]; if (t && t.ai) { Object.assign(t.aiState, T.aiState || {}); if (t.aiState.hold && T.role === 'foe') { t.inc0 = t.inc; t.inc *= RTS.CAMP_HOLD_INC; } } }); // 공격을 보류한 적은 그동안 수입을 줄인다(풀릴 때 RTS.camp.unhold로 되돌림)
  if (M.setup) M.setup(G, G.camp.carry);
  G.camp.stage = -1; }; // 첫 단계는 첫 틱에 연다(화면이 대사를 받을 수 있도록)
const campSay = (G, lines) => { if (typeof lines === 'function') lines = lines(G); for (const [who, text] of lines || []) RTS.emit(G, 'story', { who, text }); };
RTS.campSay = (G, who, text) => RTS.emit(G, 'story', { who, text });
function campEnter(G, i) { const M = RTS.campDef(G.camp.id), S = M.stages[i]; G.camp.stage = i; G.camp.t0 = G.tick; if (!S) return;
  if (S.enter) S.enter(G); campSay(G, S.say); RTS.emit(G, 'campStage', { stage: i }); }
const goalProg = (G, g) => g.key ? (g.acc ? [Math.floor(G.camp.flags[g.key] || 0), g.need] : [G.camp.flags[g.key] ? 1 : 0, 1]) : g.prog(G);
RTS.campStageSec = G => (G.tick - (G.camp.t0 || 0)) / RTS.HZ;
// 지금 단계 목표의 진행도 [{text, cur, need, done}]
RTS.campGoals = function (G) { const M = G.camp && RTS.campDef(G.camp.id), S = M && M.stages[Math.max(0, G.camp.stage)]; if (!S) return [];
  return S.goals.map(g => { const [cur, need] = goalProg(G, g); return { text: typeof g.text === 'function' ? g.text(G) : g.text, cur: Math.min(cur, need), need, done: cur >= need }; }); };
RTS.campMarks = function (G) { const M = G.camp && RTS.campDef(G.camp.id), S = M && M.stages[Math.max(0, G.camp.stage)]; if (!S) return [];
  const out = (S.marks ? S.marks(G) : null) || []; for (const g of S.goals) if (g.at) { const [c, n] = goalProg(G, g); if (c < n) out.push({ x: g.at[0], y: g.at[1], r: g.at[2], label: g.at[3] }); }
  return out; };
function campEnd(G, win, why) { if (G.over) return; const M = RTS.campDef(G.camp.id);
  G.camp.result = { win, why: why || '' }; if (win) { campSay(G, M.win); if (M.end) campSay(G, M.end); } else if (why) RTS.emit(G, 'story', { who: '', text: why });
  G.over = { winner: win ? 0 : 1, side: win ? 0 : 1, tick: G.tick, camp: true }; RTS.emit(G, 'gameover', G.over); }
RTS.campEnd = campEnd;

RTS.addSystem({ id: 'campaign', run(G) {
  const C = G.camp; if (!C || G.over || G.tick % 10) return; const M = RTS.campDef(C.id); if (!M) return; const sec = G.tick / RTS.HZ;
  if (C.stage < 0) campEnter(G, 0);
  for (let i = 0; i < (M.events || []).length; i++) { const e = M.events[i], k = 'e' + i;
    if (e.stage !== undefined && ![].concat(e.stage).includes(C.stage)) continue;
    if (e.when && !e.when(G)) continue;
    const T = e.stage !== undefined ? RTS.campStageSec(G) : sec; // 단계에 묶인 사건은 그 단계가 시작된 뒤 시간으로 센다
    if (e.at !== undefined && !C.ev[k] && T >= e.at) { C.ev[k] = 1; e.run(G); }
    if (e.every && T >= (e.from || 0) && T >= (C.ev[k] || 0)) { const ev = e.every * (e.scale === false ? 1 : 1 / Math.sqrt(RTS.campK(G))); C.ev[k] = T + ev; C.ev[k + 'n'] = (C.ev[k + 'n'] || 0) + 1; e.run(G, C.ev[k + 'n']); } }
  // 패배: 사람 팀의 유닛·건물이 모두 없어짐(본진 없이 시작하는 미션이 있어 유닛도 센다)
  RTS.census(G); if (C.ps.every(i => !G.ents.some(e => e.team === i && !e.dead && !RTS.defs.entities[e.def].site))) { campEnd(G, false, C.ps.length > 1 ? '두 사람의 부대가 모두 쓰러졌습니다' : '부대가 모두 쓰러졌습니다'); return; }
  const S = M.stages[C.stage]; if (!S) return;
  for (const g of S.goals) if (g.key) { // 유지되는 목표는 여기(시뮬레이션 안)에서만 갱신한다. 화면은 읽기만 한다
    if (g.acc) { if ((C.flags[g.key] || 0) < g.need && g.acc(G)) C.flags[g.key] = Math.min(g.need, (C.flags[g.key] || 0) + .5); }
    else if (!C.flags[g.key] && g.test(G)) { C.flags[g.key] = 1; if (g.done) g.done(G); } }
  const why = S.fail && S.fail(G); if (why) { campEnd(G, false, why); return; }
  if (S.goals.every(g => { const [cur, need] = goalProg(G, g); return cur >= need; })) { if (C.stage + 1 >= M.stages.length) campEnd(G, true); else campEnter(G, C.stage + 1); }
} }, { before: 'victory' });

// 미션 스크립트용 도구
const CD = () => RTS.defs.entities;
RTS.camp = {
  hq: (G, team) => G.ents.find(e => e.team === team && !e.dead && CD()[e.def].dropoff && CD()[e.def].kind === 'building'),
  // 사람 팀(혼자면 [0], 둘이면 [0, 1])
  ps: G => G.camp.ps,
  // 난이도 배율을 곱한 부대 수(최소 1)
  n: (G, base) => Math.max(1, Math.round(base * RTS.campK(G))),
  // (x, y) 둘레에 유닛을 만든다. goal이 있으면 공격 이동. 만든 유닛 id 목록
  spawnAt(G, team, list, x, y, goal) { const ids = [];
    list.forEach((id, k) => { const a = k * 1.3, rr = 1.5 + k * .35, p = RTS.nearestFree(G, x + Math.cos(a) * rr, y + Math.sin(a) * rr), u = RTS.spawn(G, id, team, p.x, p.y); ids.push(u.id); if (goal) RTS.issue(G, u, { type: 'amove', x: goal.x, y: goal.y }); });
    return ids; },
  // team 쪽 본진 근처(없으면 맵 반대편)에 유닛을 만들어 목표로 공격 이동
  wave(G, team, list, goal) { const h = RTS.camp.hq(G, team) || { x: G.w - 10, y: G.h - 10 }; return RTS.camp.spawnAt(G, team, list, h.x, h.y + 3, goal); },
  // 완공된 건물을 놓는다(자리가 막히면 가까운 빈자리). lv: 강화 단계(단계당 체력 +25%·방어 +1, 보스 건물용). 만든 건물
  building(G, team, def, x, y, lv) { const d = CD()[def], tx0 = Math.round(x - d.size[0] / 2), ty0 = Math.round(y - d.size[1] / 2);
    for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const tx = tx0 + dx, ty = ty0 + dy;
      if (!RTS.canPlace(G, team, def, tx, ty, 0)) continue; const e = RTS.spawn(G, def, team, tx + d.size[0] / 2, ty + d.size[1] / 2); e.built = e.buildT; if (lv) e.lv = lv; e.hp = RTS.stat(G, e, 'hp'); return e; }
    return null; },
  // 기지 하나를 통째로: 본진 + 일꾼 n
  base(G, team, x, y, workers) { const f = RTS.defs.factions[G.teams[team].faction], hq = RTS.camp.building(G, team, f.hq, x, y); if (!hq) return null;
    const ore = RTS.nearestNode(G, hq.x, hq.y, 'ore', 30);
    for (let k = 0; k < (workers === undefined ? 5 : workers); k++) { const a = k / 5 * 6.28, p = RTS.nearestFree(G, hq.x + Math.cos(a) * 3, hq.y + Math.sin(a) * 3), w = RTS.spawn(G, f.worker, team, p.x, p.y); if (ore) RTS.issue(G, w, { type: 'gather', node: ore.id }); }
    return hq; },
  alive: (G, ids) => (ids || []).filter(i => { const e = G.byId[i]; return e && !e.dead; }).length,
  count: (G, team, def) => G.ents.filter(e => e.team === team && !e.dead && e.def === def && (CD()[e.def].kind !== 'building' || RTS.complete(e))).length,
  // 사람 팀 전체에서 세기. def가 함수면 조건
  countPs: (G, def) => G.camp.ps.reduce((s, t) => s + RTS.camp.count(G, t, def), 0),
  // 진영 역할로 세기: 'hq'·'worker'·'supply'·'defense' 또는 정의 id. 사람 팀마다 자기 진영 기준
  countRole: (G, role, team) => [].concat(team === undefined ? G.camp.ps : team).reduce((s, t) => s + RTS.camp.count(G, t, RTS.camp.rid(G.teams[t].faction, role)), 0),
  // 역할 이름 → 그 진영의 정의 id: hq·worker·supply·defense(진영 데이터), barracks·lab·factory(RTS.CAMP_ROLE)
  rid: (faction, role) => (RTS.CAMP_ROLE[role] && RTS.CAMP_ROLE[role][faction]) || RTS.defs.factions[faction][role] || role,
  // 사람 유닛(건물 제외)이 (x, y)에서 r 안에 있나. each면 사람 팀마다 하나씩 있어야 한다
  near(G, x, y, r, each) { const ok = new Set(); for (const e of G.ents) { if (e.dead || !G.camp.ps.includes(e.team) || CD()[e.def].kind !== 'unit') continue; if ((e.x - x) ** 2 + (e.y - y) ** 2 <= r * r) ok.add(e.team); }
    return each ? G.camp.ps.every(t => ok.has(t)) : ok.size > 0; },
  // (x, y)에서 r 안의 적 유닛 수(사람 편이 아닌 팀)
  foesNear(G, x, y, r) { let n = 0; for (const e of G.ents) if (!e.dead && e.team >= 0 && G.teams[e.team].side === 1 && CD()[e.def].kind === 'unit' && (e.x - x) ** 2 + (e.y - y) ** 2 <= r * r) n++; return n; },
  // 사람 팀 건물 중 from에 가장 가까운 것(없으면 유닛)
  nearest(G, team, from) { let b = null, bd = 1e12; const T = [].concat(team === undefined ? G.camp.ps : team);
    for (const pass of ['building', 'unit']) { for (const e of G.ents) { if (!T.includes(e.team) || e.dead || CD()[e.def].kind !== pass) continue; const q = (e.x - from.x) ** 2 + (e.y - from.y) ** 2; if (q < bd) { bd = q; b = e; } } if (b) return b; }
    return null; },
  // 남은 건물 수: team의 def 목록(진영 역할 이름도 된다)
  left(G, team, defs) { const ids = [].concat(defs).map(d => RTS.camp.rid(G.teams[team].faction, d)); return G.ents.filter(e => e.team === team && !e.dead && ids.includes(e.def)).length; },
  // 적 팀 번호(foe 역할)
  foe: G => RTS.campDef(G.camp.id).teams.findIndex(T => T.role === 'foe'),
  // 적 AI의 공격 보류를 풀고 수입을 되돌린다
  unhold(G) { const f = RTS.camp.foe(G), t = f >= 0 && G.teams[f]; if (!t) return; t.aiState.hold = false; if (t.inc0) { t.inc = t.inc0; delete t.inc0; } },
  npc: G => RTS.campDef(G.camp.id).teams.findIndex(T => T.role === 'npc'),
  // 진영의 병력 구성: tier 1(초반) · 2(중반) · 3(후반) · 'air'. n기를 차례로 섞어 돌려준다
  army(faction, tier, n) { const L = RTS.CAMP_ARMY[faction][tier] || RTS.CAMP_ARMY[faction][1], out = []; for (let i = 0; i < n; i++) out.push(L[i % L.length]); return out; },
  fac: (G, team) => G.teams[team].faction,
  // 미션 안에서 쓰는 진영 이름
  fname: (G, team) => RTS.defs.factions[G.teams[team].faction].name,
};
RTS.CAMP_HOLD_INC = .6;
RTS.CAMP_ROLE = { barracks: { pioneers: 'p_barracks', ironclad: 'i_forge', swarm: 's_pool' }, lab: { pioneers: 'p_lab', ironclad: 'i_core', swarm: 's_den' }, factory: { pioneers: 'p_factory', ironclad: 'i_foundry', swarm: 's_nest' } };
RTS.CAMP_ARMY = {
  pioneers: { 1: ['p_rifle', 'p_rifle', 'p_rifle'], 2: ['p_rifle', 'p_gren', 'p_rifle', 'p_medic'], 3: ['p_tank', 'p_gren', 'p_rifle', 'p_gunship', 'p_rifle'], air: ['p_gunship'], boss: ['p_titan'] },
  ironclad: { 1: ['i_blade', 'i_blade', 'i_striker'], 2: ['i_blade', 'i_striker', 'i_blade', 'i_mender'], 3: ['i_colossus', 'i_striker', 'i_blade', 'i_wasp', 'i_blade'], air: ['i_wasp'], boss: ['i_juggernaut'] },
  swarm: { 1: ['s_claw', 's_claw', 's_claw'], 2: ['s_claw', 's_spitter', 's_claw', 's_claw'], 3: ['s_brute', 's_spitter', 's_claw', 's_drake', 's_claw'], air: ['s_drake'], boss: ['s_behemoth'] },
};

// ── 진행·해금 규칙 ─────────────────────────────────────
// 진행 기록 p = { done: { 미션id: { best, level, hard } }, carry: {}, level }
// · 1인: 진영마다 앞 미션을 깨야 다음이 열린다.
// · 2인: 어느 진영이든 1인 5단계를 끝까지 깨면 열린다(RTS.CAMP_RULES.duoNeed: 'any' 한 진영, 'all' 세 진영 모두).
// · 히든 미션: 2인 마지막 미션을 어려움으로 깨면 열린다. 쉬움·보통으로 깨면 힌트만 보인다.
// · 히든 캠페인: 히든 미션을 깨면 열린다(1단계부터 차례로).
RTS.CAMP_RULES = { duoNeed: 'any' };
RTS.campStatus = function (p) {
  const G = RTS.CAMPAIGN.groups, done = id => !!(p.done && p.done[id]), last = g => g.missions[g.missions.length - 1];
  const solo = G.filter(g => g.kind === 'solo'), duo = G.find(g => g.kind === 'duo'), hid = G.find(g => g.kind === 'hidden'), deep = G.find(g => g.kind === 'deep');
  const soloDone = solo.filter(g => done(last(g).id)).length;
  const duoOpen = RTS.CAMP_RULES.duoNeed === 'all' ? soloDone === solo.length : soloDone > 0;
  const duoLast = p.done && p.done[last(duo).id], hidOpen = !!(duoLast && duoLast.hard), hint = !!duoLast && !hidOpen;
  const deepOpen = hidOpen && done(hid.missions[0].id);
  const groupOpen = g => g.kind === 'solo' || (g.kind === 'duo' && duoOpen) || (g.kind === 'hidden' && hidOpen) || (g.kind === 'deep' && deepOpen);
  const open = id => { const M = RTS.campDef(id); if (!M) return false; const g = RTS.campGroup(M.group); if (!groupOpen(g)) return false; const i = g.missions.indexOf(M); return i === 0 || done(g.missions[i - 1].id); };
  return { soloDone, duoOpen, hidOpen, hint, deepOpen, groupOpen, open, visible: g => g.kind === 'solo' || g.kind === 'duo' || (g.kind === 'hidden' && (hidOpen || hint)) || (g.kind === 'deep' && deepOpen) };
};
// 미션을 깼을 때 기록에 넣는다(p를 고쳐서 돌려준다)
RTS.campRecord = function (p, id, level, ticks) { p.done = p.done || {}; const d = p.done[id];
  p.done[id] = { best: d && d.best && d.best < ticks ? d.best : ticks, level: d && levelRank(d.level) > levelRank(level) ? d.level : level, hard: !!(d && d.hard) || level === 'hard' };
  return p; };
const levelRank = l => ({ easy: 0, normal: 1, hard: 2 })[l] || 0;
