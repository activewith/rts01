// tribe.js — AI로 움직이는 중립 세력 '잿빛 부족'. 플레이어가 고르는 진영이 아니다.
// 팀 번호는 RTS.TRIBE(-2). 플레이어마다 관계(neutral | ally | hostile)를 따로 가진다.
// 공병(일꾼)을 회당에 보내면 외교 미션(초등 수학 문제) 2개를 받는다. 답만큼 광석을 보내면 성공. 성공 2 → 동맹, 1 → 중립 유지, 0 → 적대.
// 동맹이 되면 요청 하나(협공·기지방어·자원공유, RTS.TRIBE_REQS)를 고른다. 바꾸려면 동맹 문제 2개를 다시 풀어 성공해야 한다.
// 적대면 주기적으로 습격한다. 직접 공격해도 적대가 된다.
RTS.TRIBE_RULES = {
  name: '잿빛 부족',
  cap: 14,            // 유지하는 최대 병력
  spawnSec: 15,       // 병력 보충 간격
  start: ['t_warrior', 't_warrior', 't_archer', 't_archer'],
  guards: 2,          // 습격·지원 때 회당에 남기는 수
  helpChance: .7,     // 기지방어: 내 건물이 공격받을 때 지원군을 보낼 확률
  helpEvery: 25,      // 기지방어: 판정 최소 간격(초)
  helpMax: 8,         // 기지방어·협공: 한 번에 보내는 원군 수
  helpWar: 45,        // 원군을 보내는 동안 상대와 싸우는 시간(초)
  towerChance: .5,   // 기지방어: 판정마다 내 방어탑을 지어 줄 확률
  towerMax: 5,        // 기지방어: 한 게임에 지어 주는 최대 방어탑 수
  strikeChance: .7,   // 협공: 내가 적을 공격할 때 원군을 보낼 확률
  strikeEvery: 25,    // 협공: 판정 최소 간격(초)
  stockRate: { ore: 4, gas: 1 },    // 자원공유: 부족 창고가 1초마다 채워지는 양
  stockCap: { ore: 600, gas: 150 }, // 자원공유: 창고 최대
  shareEvery: 60,     // 자원공유: 이 간격(초)마다 창고를 비워 수송차로 보낸다
  shareMin: 60,       // 창고 광석이 이만큼은 있어야 출발
  retrySec: 60,       // 미션 1개 성공 뒤 다시 외교할 수 있을 때까지
  raidFirst: 60,      // 적대가 된 뒤 첫 습격까지
  raidEvery: [110, 150],
  loot: 250,          // 회당을 무너뜨린 쪽이 얻는 광석
  homeR: 9,           // 이 거리보다 멀리 있는 한가한 부족 병력은 회당으로 돌아온다
  centerGap: 12,      // 맵 가운데에서 이만큼은 떨어진 곳에 둔다
  startGap: 20,       // 시작 기지에서 최소 거리
  aiWin: .075,       // 상대 AI가 외교(문제 2개)에 성공할 확률. 실패하면 1개만 맞혀 중립으로 끝난다
  aiWait: [240, 360], // 상대 AI가 외교에 실패한 뒤 다시 시도할 때까지(초, 이 범위에서 무작위)
  quizTries: 3,       // 수학 미션에서 틀려도 되는 횟수(이만큼 틀리면 실패)
  quizMax: 9999,      // 보낼 수 있는 최대 값
};
const TR = () => RTS.TRIBE_RULES;
const REL_NAME = { neutral: '중립', ally: '동맹', hostile: '적대' };
RTS.tribeRelName = r => REL_NAME[r] || r;
// 동맹 요청 3종. 동맹을 맺으면 하나를 고르고, 바꾸려면 동맹 문제를 다시 푼다
RTS.TRIBE_REQS = {
  strike: { name: '협공', text: () => `내가 적을 공격하면 ${Math.round(TR().strikeChance * 100)}% 확률로 원군(최대 ${TR().helpMax}기)을 보내 함께 공격합니다 (${TR().strikeEvery}초에 한 번 판정)` },
  defend: { name: '기지방어', text: () => `내 건물이 공격받으면 ${Math.round(TR().helpChance * 100)}% 확률로 방어 병력을 보내고, ${Math.round(TR().towerChance * 100)}% 확률로 방어탑을 지어 줍니다(최대 ${TR().towerMax}개)` },
  share:  { name: '자원공유', text: () => `부족 창고가 초당 광석 ${TR().stockRate.ore}·에테르 ${TR().stockRate.gas}씩 찹니다. ${TR().shareEvery}초마다 창고를 모두 실은 수송차가 내 본진으로 갑니다. 도중에 파괴되면 화물을 잃으니 호위하세요` },
};
const reqInit = T => { const n = T.rel.length; if (!T.req) T.req = Array(n).fill(null); if (!T.pick) T.pick = Array(n).fill(false); if (!T.stock) T.stock = { ore: 0, gas: 0 }; if (!T.towers) T.towers = Array(n).fill(0); if (!T.got) T.got = Array(n).fill(null).map(() => ({ ore: 0, gas: 0 })); return T; };
RTS.tribeReqOf = (G, p) => { const T = G.tribe; if (!T || T.dead || p < 0 || T.rel[p] !== 'ally') return null; return reqInit(T).req[p]; };
const tTell = (G, team, text, kind) => RTS.emit(G, 'notice', { team, text, kind });

// 회당 자리: 게임마다 무작위. 맵 가운데, 시작 기지·확장 기지·자원·회사 거점·지부 근처는 피하고, 두 시작 기지에서 걸어서 닿아야 한다
const nearRamp = (G, px, py) => { for (let y = (py | 0) - 6; y <= (py | 0) + 6; y++) for (let x = (px | 0) - 6; x <= (px | 0) + 6; x++) if (x >= 0 && y >= 0 && x < G.w && y < G.h && (G.elev[y * G.w + x] & 3)) return true; return false; };
RTS.tribeSpotPick = function (G) {
  if (G.tribeFixed && G.tribeSpot) return G.tribeSpot; // 캠페인 맵: 정해 둔 자리
  const H = RTS.defs.entities.t_hall, starts = G.bases.filter(b => b.start !== undefined), cx = G.w / 2, cy = G.h / 2, R = TR();
  const keep = [...G.siteSpots, ...G.postSpots], res = G.ents.filter(e => RTS.defOf(e).kind === 'resource');
  const reach = (x, y, tx, ty) => starts.every(b => { const p = RTS.findPath(G, b.x, b.y + 4, { x0: tx - 1, y0: ty - 1, x1: tx + H.size[0], y1: ty + H.size[1] }), l = p[p.length - 1]; return l && Math.hypot(l[0] - x, l[1] - y) < 4.5; });
  // 조건을 만족하는 칸을 모두 모은 뒤 무작위 순서로 길이 닿는지 본다. 없으면 간격 조건을 줄여 다시 찾는다
  for (const k of [1, .75, .5]) {
    const cand = [];
    for (let y = 7; y <= G.h - 7; y++) for (let x = 7; x <= G.w - 7; x++) { const px = x + .5, py = y + .5;
      if (Math.hypot(px - cx, py - cy) < R.centerGap) continue;
      if (starts.some(b => Math.hypot(b.x - px, b.y - py) < R.startGap * (k < 1 ? .85 : 1)) || G.bases.some(b => Math.hypot(b.x - px, b.y - py) < 11 * k)) continue;
      if (keep.some(q => Math.hypot(q.x - px, q.y - py) < 7 * k) || res.some(e => Math.hypot(e.x - px, e.y - py) < 6 * k)) continue;
      if (G.elev && nearRamp(G, px, py)) continue; // 경사로를 막지 않게 한다
      const tx = Math.round(px - H.size[0] / 2), ty = Math.round(py - H.size[1] / 2); if (!RTS.canPlace(G, RTS.TRIBE, 't_hall', tx, ty, 2)) continue;
      cand.push([px, py, tx, ty]); }
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(RTS.rand(G) * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    for (const [px, py, tx, ty] of cand.slice(0, 60)) if (reach(px, py, tx, ty)) return { x: px, y: py };
  }
  return G.tribeSpot; // 못 찾으면 맵 데이터의 자리(있다면)
};
RTS.initTribe = function (G) {
  const s = RTS.tribeSpotPick(G); if (!s) return;
  const H = RTS.defs.entities.t_hall, hx = Math.round(s.x - H.size[0] / 2), hy = Math.round(s.y - H.size[1] / 2);
  const hall = RTS.spawn(G, 't_hall', RTS.TRIBE, hx + H.size[0] / 2, hy + H.size[1] / 2); hall.built = hall.buildT; hall.hp = H.hp; hall.tribeHall = true;
  const Tw = RTS.defs.entities.t_tower;
  const ta = RTS.rand(G) * Math.PI * 2; // 망루 2개: 서로 반대쪽
  for (const a0 of [ta, ta + Math.PI]) { let done = false;
    for (let r = 4.5; r <= 7 && !done; r += .5) for (let k = 0; k < 9 && !done; k++) { const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .3, tx = Math.round(hall.x + Math.cos(a) * r - 1), ty = Math.round(hall.y + Math.sin(a) * r - 1);
      if (!RTS.canPlace(G, RTS.TRIBE, 't_tower', tx, ty, 0)) continue; const e = RTS.spawn(G, 't_tower', RTS.TRIBE, tx + 1, ty + 1); e.built = e.buildT; e.hp = Tw.hp; done = true; } }
  const n = G.teams.length;
  G.tribe = { hall: hall.id, x: hall.x, y: hall.y, dead: false, rel: Array(n).fill('neutral'), found: Array(n).fill(false), missions: Array(n).fill(null), wait: Array(n).fill(0),
    war: Array(n).fill(0), nextRaid: Array(n).fill(0), helpNext: 0, strikeNext: 0, nextSpawn: TR().spawnSec * RTS.HZ, sent: 0 };
  reqInit(G.tribe);
  TR().start.forEach((id, i) => tribeSpawn(G, id, i));
};
function tribeSpawn(G, id, i = 0) { const T = G.tribe, h = G.byId[T.hall]; if (!h) return null; const a = 1.57 + (i - 1.5) * .5, p = RTS.nearestFree(G, h.x + Math.cos(a) * 3.2, h.y + Math.sin(a) * 3.2); return RTS.spawn(G, id, RTS.TRIBE, p.x, p.y); }
const tribeUnits = G => G.ents.filter(e => e.team === RTS.TRIBE && !e.dead && RTS.defOf(e).kind === 'unit');

// 관계 판정. sim.js의 RTS.foe가 부르고, 자동 공격·범위 피해·시야가 모두 이것을 따른다.
RTS.tribeFoe = (G, p) => { const T = G.tribe; return !!T && p >= 0 && (T.rel[p] === 'hostile' || (T.rel[p] !== 'ally' && T.war[p] > G.tick)); };
RTS.tribeAlly = (G, p) => { const T = G.tribe; return !!T && !T.dead && p >= 0 && T.rel[p] === 'ally'; };
RTS.tribeSeen = (G, team, e) => { const T = G.tribe; if (team < 0 || G.nofog || !T) return true; const t = G.teams[team]; if (t && t.reveal) return true;
  if (T.rel[team] === 'ally') return true; if (e.tribeHall && T.found[team]) return true; return RTS.visibleTo(G, team, e.x, e.y); };
const prevKnown = RTS.branchKnown; RTS.branchKnown = (G, team, e) => (e.team === RTS.TRIBE ? RTS.tribeSeen(G, team, e) : prevKnown(G, team, e));

// 외교를 시작할 수 없는 이유. null이면 가능
RTS.tribeBlock = function (G, team) { const T = G.tribe; if (!T) return '부족이 없습니다'; if (T.dead) return '부족 회당이 무너졌습니다';
  const r = T.rel[team]; if (r === 'hostile') return '적대 관계라 대화할 수 없습니다'; if (r === 'ally') return '이미 동맹입니다';
  if (T.missions[team]) return '진행 중인 외교 미션이 있습니다';
  if (T.wait[team] > G.tick) return '다시 외교하려면 ' + Math.ceil((T.wait[team] - G.tick) / RTS.HZ) + '초 기다려야 합니다';
  if (T.rel.some((x, i) => i !== team && x === 'ally')) return '부족이 이미 다른 세력과 동맹 중입니다';
  return null; };
RTS.tribeRequest = function (G, team) { const block = RTS.tribeBlock(G, team); if (block) { tTell(G, team, block, 'warn'); return false; }
  tribeMissionsFor(G, team); return true; };
function tribeMissionsFor(G, team) {
  const T = G.tribe, t = G.teams[team], lv = RTS.mathLevel(G), all = Object.keys(RTS.defs.tribeMissions), pick = [];
  const ids = all.filter(id => { const L = RTS.defs.tribeMissions[id].lv; return !L || (lv >= L[0] && lv <= L[1]); });
  while (pick.length < 2 && pick.length < ids.length) { const id = ids[Math.floor(RTS.rand(G) * ids.length)]; if (!pick.includes(id)) pick.push(id); }
  T.missions[team] = pick.map(id => { const d = RTS.defs.tribeMissions[id], m = { id, until: G.tick + d.time * RTS.HZ, done: null, acc: 0 };
    if (d.quiz) { const [q, ans] = d.quiz(G, lv, quizRi(G, RTS.tribeQuizStep(G, team))); m.q = q; m.ans = ans; m.tries = 0; }
    if (d.start) d.start(G, t, m); return m; });
  tTell(G, team, '외교 미션: ' + pick.map(id => RTS.defs.tribeMissions[id].name).join(', '), 'ok'); RTS.emit(G, 'tribeMissions', { team }); }
// 동맹 요청 바꾸기: 동맹 문제 2개를 다시 받는다. 2개 성공하면 요청을 새로 고를 수 있다(실패해도 동맹·현재 요청은 그대로)
RTS.tribeRenewBlock = function (G, team) { const T = G.tribe; if (!T || T.dead) return '부족 회당이 무너졌습니다'; if (T.rel[team] !== 'ally') return '동맹일 때만 요청을 바꿀 수 있습니다';
  reqInit(T); if (T.pick[team]) return '지금 요청을 고를 수 있습니다'; if (T.missions[team]) return '동맹 문제를 푸는 중입니다';
  if (T.wait[team] > G.tick) return '다시 도전하려면 ' + Math.ceil((T.wait[team] - G.tick) / RTS.HZ) + '초 기다려야 합니다'; return null; };
RTS.commands.tribeRenew = (G, team) => { const why = RTS.tribeRenewBlock(G, team); if (why) { tTell(G, team, why, 'warn'); return; } tribeMissionsFor(G, team); };
// 요청 고르기(동맹을 맺은 직후, 또는 요청 바꾸기 문제를 2개 맞힌 뒤)
RTS.tribeChoose = function (G, team, req) { const T = G.tribe; if (!T || T.dead || T.rel[team] !== 'ally' || !RTS.TRIBE_REQS[req]) return false; reqInit(T); if (!T.pick[team]) return false;
  T.req[team] = req; T.pick[team] = false; tTell(G, team, `${TR().name}에 '${RTS.TRIBE_REQS[req].name}'을(를) 요청했습니다`, 'ok'); RTS.emit(G, 'tribeReq', { team, req }); return true; };
RTS.commands.tribeReq = (G, team, c) => { RTS.tribeChoose(G, team, c.req); };
// 미션 진행도 [현재, 목표]. 수학 미션은 [성공 1/0, 1]
RTS.missionProg = (G, team, m) => { const d = RTS.defs.tribeMissions[m.id]; if (d.quiz) return [m.done === true ? 1 : 0, 1]; return [Math.max(0, Math.min(d.need, d.prog(G, G.teams[team], m))), d.need]; };
// 학습 문제 수준 1~3(설정 mathLevel)
// 문제 난이도 단계 -1~1: 수준(학년)은 그대로 두고 그 안에서 수를 크게(작게) 고른다. 캠페인은 미션 진행·난이도(RTS.learnStep),
// 그 밖에는 상대 AI 난이도 + 게임 시간(분당 perMin, 최대 maxTime). 시드 난수만 쓰므로 두 기기에서 같다
RTS.TRIBE_QUIZ_STEP = { ai: { beginner: -.5, easy: -.25, normal: 0, hard: .3 }, perMin: .02, maxTime: .4 };
RTS.tribeQuizStep = function (G, team) { const Q = RTS.TRIBE_QUIZ_STEP, cl = v => Math.max(-1, Math.min(1, v));
  if (G.camp && RTS.learnStep && RTS.campDef) return cl(RTS.learnStep(RTS.campDef(G.camp.id), G.camp.level));
  const ais = G.teams.filter(t => t.ai && t.id !== team && Q.ai[t.ai] !== undefined && (!RTS.ally || !RTS.ally(G, team, t.id))).map(t => Q.ai[t.ai] + ((t.boost || 1) - 1));
  return cl((ais.length ? Math.max(...ais) : 0) + Math.min(Q.maxTime, G.tick / RTS.HZ / 60 * Q.perMin)); };
const quizRi = (G, st) => (a, b) => { let u = RTS.rand(G); const k = st * .5; u = k >= 0 ? k + u * (1 - k) : u * (1 + k); return a + Math.min(b - a, Math.floor(u * (b - a + 1))); };
RTS.mathLevel = G => Math.max(1, Math.min(3, Math.round(RTS.cfg(G).mathLevel || 1)));
// 수학 미션 답 보내기: 답과 같으면 그만큼 광석을 내고 성공. 틀리면 광석은 그대로, 많다/적다 힌트. quizTries번 틀리면 실패
RTS.tribeAnswer = function (G, team, idx, value) { const T = G.tribe, t = G.teams[team]; if (!T || !t) return false;
  const L = T.missions[team], m = L && L[idx], d = m && RTS.defs.tribeMissions[m.id]; if (!m || !d || !d.quiz || m.done !== null) return false;
  const v = Math.floor(+value); if (!(v >= 0 && v <= TR().quizMax)) { tTell(G, team, '보낼 광석 수를 숫자로 넣으세요', 'warn'); return false; }
  if (v > t.res.ore) { tTell(G, team, `가진 광석(${Math.floor(t.res.ore)})보다 많이 보낼 수 없습니다. 광석을 더 모으세요`, 'warn'); return false; }
  if (v === m.ans) { t.res.ore -= v; m.done = true; tTell(G, team, `정답! ${m.q} = ${m.ans}. 광석 ${v}만큼 바쳤습니다`, 'ok'); RTS.emit(G, 'tribeAnswer', { team, ok: true }); return true; }
  m.tries++; const left = TR().quizTries - m.tries;
  if (left <= 0) { m.done = false; tTell(G, team, `외교 미션 실패: ${d.name}. ${m.q}의 답은 ${m.ans}입니다`, 'warn'); }
  else tTell(G, team, `틀렸습니다. 답은 ${v}보다 ${v < m.ans ? '큽니다' : '작습니다'} (남은 기회 ${left}번)`, 'warn');
  RTS.emit(G, 'tribeAnswer', { team, ok: false }); return false; };
RTS.commands.tribeAnswer = (G, team, c) => { RTS.tribeAnswer(G, team, c.mission | 0, c.value); };

// 공병이 회당까지 걸어가서 외교를 신청하고, 끝나면 일터로 돌아간다
// 부족 수송차: 동맹 본진(가장 가까운 자원 반납 건물)으로 가서 화물을 내려놓는다
RTS.orders.tribeCart = function (G, u, o) { const drop = RTS.nearestDrop(G, u); if (!drop) { RTS.kill(G, u, null, true); return; }
  if (RTS.edgeDist(u, drop) < .8) { const t = G.teams[u.team], T = G.tribe; t.res.ore += o.ore; t.res.gas += o.gas; if (T) { reqInit(T); T.got[u.team].ore += o.ore; T.got[u.team].gas += o.gas; }
    tTell(G, u.team, `${TR().name} 수송차 도착: 광석 +${o.ore} · 에테르 +${o.gas}`, 'ok'); RTS.emit(G, 'tribeShare', { team: u.team, ore: o.ore, gas: o.gas }); u.cartDone = true; RTS.kill(G, u, null, true); return; }
  RTS.goTo(G, u, drop); };
RTS.orders.envoy = function (G, u, o) { const h = G.byId[o.target];
  if (!h || h.dead || h.team !== RTS.TRIBE) { RTS.issue(G, u, null); return; }
  RTS.goTo(G, u, h); if (RTS.edgeDist(u, h) > .9) return;
  RTS.tribeRequest(G, u.team); const drop = RTS.nearestDrop(G, u), n = drop && RTS.nearestNode(G, drop.x, drop.y, 'ore', 16);
  RTS.issue(G, u, n ? { type: 'gather', node: n.id } : null); };

// 부족 건물·병력이 맞았을 때. 중립·동맹인 플레이어가 직접 공격하면 적대가 된다
RTS.tribeHit = function (G, e, src) { const T = G.tribe; if (!T || !src || src.team < 0) return; const p = src.team;
  if (T.rel[p] === 'hostile' || T.war[p] > G.tick) return;
  const was = T.rel[p]; T.rel[p] = 'hostile'; T.missions[p] = null; reqInit(T); T.req[p] = null; T.pick[p] = false; T.nextRaid[p] = G.tick + TR().raidFirst * RTS.HZ;
  for (const o of G.teams) tTell(G, o.id, o.id === p ? `${TR().name}${was === 'ally' ? '이 배신에 분노합니다' : '을 공격했습니다'}. 이제 적대 관계입니다` : `${G.teams[p].name}이(가) ${TR().name}과 적대 관계가 되었습니다`, o.id === p ? 'warn' : 'market');
  RTS.emit(G, 'tribeRel', { team: p, rel: 'hostile' }); };
// 원군 보내기: 회당 경비를 남기고 가까운 병력부터 최대 helpMax기. foeTeam과 helpWar초 동안 서로 적이 된다
function tribeSend(G, p, foeTeam, x, y) { const T = G.tribe, R = TR(), h = G.byId[T.hall]; if (!h) return 0;
  const go = tribeUnits(G).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y)).slice(R.guards).slice(0, R.helpMax); if (!go.length) return 0;
  T.war[foeTeam] = Math.max(T.war[foeTeam], G.tick + R.helpWar * RTS.HZ); T.sent++;
  for (const u of go) RTS.issue(G, u, { type: 'amove', x, y, help: 1 }); return go.length; }
// 기지방어 요청: 내 건물이 공격받으면 확률로 방어 병력을 보내고, 확률로 내 방어탑을 지어 준다
RTS.tribeAllyHit = function (G, e, src) { const T = G.tribe, p = e.team, R = TR();
  if (!T || T.dead || !src || src.team < 0 || src.team === p || !RTS.foe(G, p, src.team) || RTS.tribeReqOf(G, p) !== 'defend' || RTS.defOf(e).kind !== 'building' || G.tick < T.helpNext) return;
  T.helpNext = G.tick + R.helpEvery * RTS.HZ; let said = false;
  if (T.towers[p] < R.towerMax && RTS.rand(G) < R.towerChance && tribeTower(G, p, e)) { T.towers[p]++; said = true; tTell(G, p, `${R.name}이 방어탑을 지어 주었습니다 (${T.towers[p]}/${R.towerMax})`, 'ok'); }
  if (RTS.rand(G) < R.helpChance) { const n = tribeSend(G, p, src.team, e.x, e.y); if (n) { said = true; tTell(G, p, `${R.name}이 방어 병력 ${n}기를 보냈습니다`, 'ok'); tTell(G, src.team, `${R.name}이 상대 기지를 지키고 있습니다`, 'warn'); RTS.emit(G, 'tribeHelp', { team: p, n }); } }
  if (!said) tTell(G, p, `${R.name}은(는) 이번에는 돕지 않았습니다`, 'market'); };
function tribeTower(G, p, near) { const t = G.teams[p], f = RTS.defs.factions[t.faction], id = f && f.defense; if (!id) return false; const d = RTS.defs.entities[id];
  for (let r = 3; r <= 9; r++) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2 + r, tx = Math.round(near.x + Math.cos(a) * r - d.size[0] / 2), ty = Math.round(near.y + Math.sin(a) * r - d.size[1] / 2);
    if (!RTS.canPlace(G, p, id, tx, ty, 1)) continue; const b = RTS.spawn(G, id, p, tx + d.size[0] / 2, ty + d.size[1] / 2); b.built = b.buildT; b.hp = d.hp; RTS.census(G); return true; }
  return false; }
// 협공 요청: 내가 적을 공격하면 확률로 원군을 보내 함께 공격한다
RTS.tribeAllyStrike = function (G, e, src) { const T = G.tribe, p = src && src.team, R = TR();
  if (!T || T.dead || p === undefined || p < 0 || e.team < 0 || e.team === p || !RTS.foe(G, p, e.team) || RTS.tribeReqOf(G, p) !== 'strike' || G.tick < T.strikeNext) return;
  T.strikeNext = G.tick + R.strikeEvery * RTS.HZ;
  if (RTS.rand(G) >= R.strikeChance) { tTell(G, p, `${R.name}은(는) 이번에는 협공하지 않았습니다`, 'market'); return; }
  const n = tribeSend(G, p, e.team, e.x, e.y); if (!n) return;
  tTell(G, p, `${R.name}이 원군 ${n}기를 보내 함께 공격합니다`, 'ok'); tTell(G, e.team, `${R.name}이 상대와 함께 공격해 옵니다`, 'warn'); RTS.emit(G, 'tribeHelp', { team: p, n, strike: 1 }); };
RTS.tribeDeath = function (G, e, src) { const T = G.tribe;
  if (e.def === 't_cart' && !e.cartDone && e.order) { tTell(G, e.team, `${TR().name} 수송차가 파괴되었습니다. 광석 ${e.order.ore} · 에테르 ${e.order.gas}을 잃었습니다`, 'warn'); if (T) T.lost = (T.lost || 0) + 1; return; }
  if (!T || !e.tribeHall) return; T.dead = true;
  const k = src && src.team >= 0 ? src.team : -1; if (k >= 0) { G.teams[k].res.ore += TR().loot; G.teams[k].stats.loot = (G.teams[k].stats.loot || 0) + TR().loot; }
  for (const o of G.teams) tTell(G, o.id, `${TR().name} 회당이 무너졌습니다` + (o.id === k ? `. 광석 +${TR().loot}` : ''), o.id === k ? 'ok' : 'market');
  T.missions = T.missions.map(() => null); };

function tribeSettle(G, team) { const T = reqInit(G.tribe), L = T.missions[team], ok = L.filter(m => m.done).length; T.missions[team] = null;
  const name = TR().name, other = T.rel.some((x, i) => i !== team && x === 'ally');
  if (T.rel[team] === 'ally') { // 요청 바꾸기 문제
    if (ok >= 2) { T.pick[team] = true; tTell(G, team, '동맹 문제 2개 성공: 새 요청을 고르세요', 'ok'); }
    else { T.wait[team] = G.tick + TR().retrySec * RTS.HZ; tTell(G, team, `동맹 문제 ${ok}개 성공: 요청은 그대로입니다. ${TR().retrySec}초 뒤 다시 도전할 수 있습니다`, 'market'); }
    RTS.emit(G, 'tribeRel', { team, rel: 'ally', ok }); return; }
  if (ok >= 2 && !other) { T.rel[team] = 'ally'; T.req[team] = null; T.pick[team] = true; for (const o of G.teams) tTell(G, o.id, o.id === team ? `미션 2개 성공: ${name}과 동맹을 맺었습니다. 부족 패널에서 요청을 고르세요` : `${G.teams[team].name}이(가) ${name}과 동맹을 맺었습니다`, o.id === team ? 'ok' : 'market'); }
  else if (ok >= 1) { const R = TR(), ai = G.teams[team].ai; T.wait[team] = G.tick + Math.round((ai ? R.aiWait[0] + RTS.rand(G) * (R.aiWait[1] - R.aiWait[0]) : R.retrySec) * RTS.HZ); tTell(G, team, ok >= 2 ? `${name}이 이미 상대와 동맹이라 중립을 유지합니다` : `미션 1개 성공: ${name}은 중립을 유지합니다. ${TR().retrySec}초 뒤 다시 외교할 수 있습니다`, 'market'); }
  else { T.rel[team] = 'hostile'; T.nextRaid[team] = G.tick + TR().raidFirst * RTS.HZ; for (const o of G.teams) tTell(G, o.id, o.id === team ? `미션 모두 실패: ${name}이 적대 관계가 되었습니다` : `${G.teams[team].name}이(가) ${name}과 적대 관계가 되었습니다`, o.id === team ? 'warn' : 'market'); }
  RTS.emit(G, 'tribeRel', { team, rel: T.rel[team], ok }); }

RTS.addSystem({ id: 'tribe', run(G) {
  const T = G.tribe; if (!T || G.tick % RTS.HZ) return; const R = TR(), h = G.byId[T.hall];
  // 발견: 내 유닛·건물 시야 안에 회당이 들어오면
  if (h) G.teams.forEach(t => { if (T.found[t.id]) return; for (const e of G.ents) { if (e.team !== t.id || e.dead) continue; const s = (RTS.defOf(e).sight || 7) + 1.5;
    if (Math.abs(e.x - h.x) < s + 2 && Math.abs(e.y - h.y) < s + 2 && RTS.edgeDist({ def: 'none_', x: e.x, y: e.y }, h) < s) { T.found[t.id] = true; tTell(G, t.id, `${R.name} 발견: 공병으로 회당을 우클릭하면 외교 미션을 받습니다`, 'ok'); RTS.emit(G, 'tribeFound', { team: t.id }); break; } } });
  // 미션 진행
  G.teams.forEach(t => { const L = T.missions[t.id]; if (!L) return;
    for (const m of L) { if (m.done !== null) continue; const d = RTS.defs.tribeMissions[m.id]; if (d.tick) d.tick(G, t, m);
      if (!d.quiz && d.prog(G, t, m) >= d.need) { if (d.pay) for (const k of Object.keys(d.pay)) t.res[k] -= d.pay[k]; m.done = true; tTell(G, t.id, `외교 미션 성공: ${d.name}`, 'ok'); }
      else if (G.tick >= m.until) { m.done = false; tTell(G, t.id, `외교 미션 실패(시간 초과): ${d.name}` + (d.quiz ? `. ${m.q}의 답은 ${m.ans}입니다` : ''), 'warn'); } }
    if (L.every(m => m.done !== null)) tribeSettle(G, t.id); });
  if (T.dead || !h) return;
  const units = tribeUnits(G); reqInit(T);
  // 자원공유: 창고가 차고, shareEvery초마다 자원공유를 고른 동맹에게 일부를 보낸다
  for (const k of ['ore', 'gas']) T.stock[k] = Math.min(R.stockCap[k], T.stock[k] + R.stockRate[k]);
  if ((G.tick / RTS.HZ) % R.shareEvery === 0 && T.stock.ore >= R.shareMin) G.teams.forEach(t => { if (RTS.tribeReqOf(G, t.id) !== 'share' || !RTS.nearestDrop(G, { team: t.id, x: h.x, y: h.y })) return;
    const ore = Math.floor(T.stock.ore), gas = Math.floor(T.stock.gas); T.stock.ore -= ore; T.stock.gas -= gas;
    const p = RTS.nearestFree(G, h.x, h.y + 3), u = RTS.spawn(G, 't_cart', t.id, p.x, p.y); u.order = { type: 'tribeCart', ore, gas }; T.carts = (T.carts || 0) + 1;
    tTell(G, t.id, `${R.name} 수송차 출발: 광석 ${ore} · 에테르 ${gas}. 병력을 골라 수송차를 누르면 호위합니다`, 'ok'); RTS.emit(G, 'tribeCart', { team: t.id, id: u.id, ore, gas, x: u.x, y: u.y }); });
  // 병력 보충
  if (units.length < R.cap && G.tick >= T.nextSpawn) { T.nextSpawn = G.tick + R.spawnSec * RTS.HZ; tribeSpawn(G, RTS.rand(G) < .5 ? 't_warrior' : 't_archer', units.length); }
  // 한가한 병력은 회당 곁으로
  for (const u of units) if (!u.order && Math.hypot(u.x - h.x, u.y - h.y) > R.homeR) RTS.issue(G, u, { type: 'move', x: h.x + Math.cos(u.id) * 3.5, y: h.y + Math.sin(u.id) * 3.5 });
  // 적대 플레이어 습격
  G.teams.forEach(t => { if (T.rel[t.id] !== 'hostile' || G.tick < T.nextRaid[t.id]) return;
    T.nextRaid[t.id] = G.tick + Math.round((R.raidEvery[0] + RTS.rand(G) * (R.raidEvery[1] - R.raidEvery[0])) * RTS.HZ);
    const go = units.slice().sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y)).slice(R.guards); if (go.length < 3) return;
    let goal = null, bd = 1e12; for (const e of G.ents) { if (e.dead || e.team !== t.id || RTS.defOf(e).kind !== 'building' || RTS.defOf(e).site) continue; const q = (e.x - h.x) ** 2 + (e.y - h.y) ** 2; if (q < bd) { bd = q; goal = e; } }
    if (!goal) return; for (const u of go) RTS.issue(G, u, { type: 'amove', x: goal.x, y: goal.y });
    tTell(G, t.id, `${R.name}이 습격해 옵니다 (${go.length}기)`, 'warn'); RTS.emit(G, 'tribeRaid', { team: t.id, n: go.length }); });
} }, { before: 'cleanup' });

// 상대 AI: 부족을 찾으면 70% 확률로 동맹을 노린다. 공병을 보내고, 광석이 모이면 수학 미션에 답한다
RTS.aiTribe = function (G, t, diff, units) { const T = G.tribe; if (!T || T.dead || t.aiState.noTribe) return; /* noTribe: 캠페인에서 외교 금지 */ const S = t.aiState, h = G.byId[T.hall], sec = G.tick / RTS.HZ; if (!h) return;
  const D = RTS.defs.entities, army = units.filter(u => !D[u.def].gather && !D[u.def].uncontrollable && u.id !== S.scout);
  if (!T.found[t.id]) { if (sec > diff.scoutAt + 40 && (!S.tScout || !G.byId[S.tScout])) { const u = army[0] || units.find(x => D[x.def].gather && !x.cargo); if (u) { S.tScout = u.id; RTS.issue(G, u, { type: 'move', x: h.x, y: h.y + 4 }); } } return; }
  if (S.tPlan === undefined) S.tPlan = RTS.rand(G) < .7 ? 'ally' : 'ignore';
  if (T.rel[t.id] === 'ally') { reqInit(T); if (T.pick[t.id]) { const r = RTS.rand(G); RTS.tribeChoose(G, t.id, r < .4 ? 'strike' : r < .75 ? 'defend' : 'share'); } return; }
  if (S.tPlan !== 'ally' || T.rel[t.id] !== 'neutral') return;
  const L = T.missions[t.id];
  if (!L) { if (RTS.tribeBlock(G, t.id)) return; const cur = S.envoy && G.byId[S.envoy]; if (cur && !cur.dead && cur.order && cur.order.type === 'envoy') return;
    const w = units.find(x => D[x.def].gather && !x.cargo && x.order && x.order.type === 'gather' && x.order.phase === 'go') || units.find(x => D[x.def].gather); if (w) { S.envoy = w.id; RTS.issue(G, w, { type: 'envoy', target: h.id }); } return; }
  // 수학 미션: 문제를 받을 때 한 번 성공 여부를 정한다(aiWin). 성공이면 광석이 모일 때 둘 다 맞히고,
  // 실패면 하나는 맞히고 다른 하나는 세 번 틀려 중립으로 끝난다(다음 시도까지 aiWait)
  const key = L.map(m => m.until).join(':'); if (S.tKey !== key) { S.tKey = key; S.tWin = RTS.rand(G) < TR().aiWin; S.tMiss = Math.floor(RTS.rand(G) * L.length); }
  L.forEach((m, i) => { const d = RTS.defs.tribeMissions[m.id]; if (m.done !== null || !d.quiz || G.tick < (S.tQuizAt || 0)) return;
    const wrong = !S.tWin && i === S.tMiss, v = wrong ? Math.max(1, m.ans + (m.tries % 2 ? -10 : 10)) : m.ans; if (t.res.ore < v) return;
    S.tQuizAt = G.tick + 4 * RTS.HZ; RTS.tribeAnswer(G, t.id, i, v); });
};
