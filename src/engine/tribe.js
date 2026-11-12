// tribe.js — AI로 움직이는 중립 세력 '잿빛 부족'. 플레이어가 고르는 진영이 아니다.
// 팀 번호는 RTS.TRIBE(-2). 플레이어마다 관계(neutral | ally | hostile)를 따로 가진다.
// 공병(일꾼)을 회당에 보내면 외교 미션 2개를 받는다. 성공 2 → 동맹, 1 → 중립 유지, 0 → 적대.
// 동맹이면 내가 공격받을 때 확률로 지원군을 보낸다. 적대면 주기적으로 습격한다. 직접 공격해도 적대가 된다.
RTS.TRIBE_RULES = {
  name: '잿빛 부족',
  cap: 10,            // 유지하는 최대 병력
  spawnSec: 20,       // 병력 보충 간격
  start: ['t_warrior', 't_warrior', 't_archer', 't_archer'],
  guards: 2,          // 습격·지원 때 회당에 남기는 수
  helpChance: .5,     // 동맹이 공격받을 때 지원군을 보낼 확률
  helpEvery: 25,      // 지원 판정 최소 간격(초)
  helpMax: 6,         // 한 번에 보내는 지원군 수
  helpWar: 45,        // 지원하는 동안 공격자와 싸우는 시간(초)
  retrySec: 60,       // 미션 1개 성공 뒤 다시 외교할 수 있을 때까지
  raidFirst: 60,      // 적대가 된 뒤 첫 습격까지
  raidEvery: [110, 150],
  loot: 250,          // 회당을 무너뜨린 쪽이 얻는 광석
  homeR: 9,           // 이 거리보다 멀리 있는 한가한 부족 병력은 회당으로 돌아온다
};
const TR = () => RTS.TRIBE_RULES;
const REL_NAME = { neutral: '중립', ally: '동맹', hostile: '적대' };
RTS.tribeRelName = r => REL_NAME[r] || r;
const tTell = (G, team, text, kind) => RTS.emit(G, 'notice', { team, text, kind });

RTS.initTribe = function (G) {
  const s = G.tribeSpot; if (!s) return;
  const H = RTS.defs.entities.t_hall, hx = Math.round(s.x - H.size[0] / 2), hy = Math.round(s.y - H.size[1] / 2);
  const hall = RTS.spawn(G, 't_hall', RTS.TRIBE, hx + H.size[0] / 2, hy + H.size[1] / 2); hall.built = hall.buildT; hall.hp = H.hp; hall.tribeHall = true;
  // 망루 2개: 두 시작 기지 방향에 하나씩 두어 양쪽 조건을 같게 한다
  const starts = G.bases.filter(b => b.start !== undefined), Tw = RTS.defs.entities.t_tower;
  for (const b of starts) { const a0 = Math.atan2(b.y - hall.y, b.x - hall.x); let done = false;
    for (let r = 4.5; r <= 7 && !done; r += .5) for (let k = 0; k < 9 && !done; k++) { const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .3, tx = Math.round(hall.x + Math.cos(a) * r - 1), ty = Math.round(hall.y + Math.sin(a) * r - 1);
      if (!RTS.canPlace(G, RTS.TRIBE, 't_tower', tx, ty, 0)) continue; const e = RTS.spawn(G, 't_tower', RTS.TRIBE, tx + 1, ty + 1); e.built = e.buildT; e.hp = Tw.hp; done = true; } }
  const n = G.teams.length;
  G.tribe = { hall: hall.id, x: hall.x, y: hall.y, dead: false, rel: Array(n).fill('neutral'), found: Array(n).fill(false), missions: Array(n).fill(null), wait: Array(n).fill(0),
    war: Array(n).fill(0), nextRaid: Array(n).fill(0), helpNext: 0, nextSpawn: TR().spawnSec * RTS.HZ, sent: 0 };
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
  const T = G.tribe, t = G.teams[team], ids = Object.keys(RTS.defs.tribeMissions), pick = [];
  while (pick.length < 2 && pick.length < ids.length) { const id = ids[Math.floor(RTS.rand(G) * ids.length)]; if (!pick.includes(id)) pick.push(id); }
  T.missions[team] = pick.map(id => { const d = RTS.defs.tribeMissions[id], m = { id, until: G.tick + d.time * RTS.HZ, done: null, acc: 0 }; if (d.start) d.start(G, t, m); return m; });
  tTell(G, team, '외교 미션: ' + pick.map(id => RTS.defs.tribeMissions[id].name).join(', '), 'ok'); RTS.emit(G, 'tribeMissions', { team });
  return true; };
// 미션 진행도 [현재, 목표]
RTS.missionProg = (G, team, m) => { const d = RTS.defs.tribeMissions[m.id]; return [Math.max(0, Math.min(d.need, d.prog(G, G.teams[team], m))), d.need]; };

// 공병이 회당까지 걸어가서 외교를 신청하고, 끝나면 일터로 돌아간다
RTS.orders.envoy = function (G, u, o) { const h = G.byId[o.target];
  if (!h || h.dead || h.team !== RTS.TRIBE) { RTS.issue(G, u, null); return; }
  RTS.goTo(G, u, h); if (RTS.edgeDist(u, h) > .9) return;
  RTS.tribeRequest(G, u.team); const drop = RTS.nearestDrop(G, u), n = drop && RTS.nearestNode(G, drop.x, drop.y, 'ore', 16);
  RTS.issue(G, u, n ? { type: 'gather', node: n.id } : null); };

// 부족 건물·병력이 맞았을 때. 중립·동맹인 플레이어가 직접 공격하면 적대가 된다
RTS.tribeHit = function (G, e, src) { const T = G.tribe; if (!T || !src || src.team < 0) return; const p = src.team;
  if (T.rel[p] === 'hostile' || T.war[p] > G.tick) return;
  const was = T.rel[p]; T.rel[p] = 'hostile'; T.missions[p] = null; T.nextRaid[p] = G.tick + TR().raidFirst * RTS.HZ;
  for (const o of G.teams) tTell(G, o.id, o.id === p ? `${TR().name}${was === 'ally' ? '이 배신에 분노합니다' : '을 공격했습니다'}. 이제 적대 관계입니다` : `${G.teams[p].name}이(가) ${TR().name}과 적대 관계가 되었습니다`, o.id === p ? 'warn' : 'market');
  RTS.emit(G, 'tribeRel', { team: p, rel: 'hostile' }); };
// 동맹 플레이어가 공격받았을 때: 확률로 지원군을 보낸다
RTS.tribeAllyHit = function (G, e, src) { const T = G.tribe, p = e.team, R = TR();
  if (!T || T.dead || T.rel[p] !== 'ally' || !src || src.team < 0 || src.team === p || G.tick < T.helpNext) return;
  T.helpNext = G.tick + R.helpEvery * RTS.HZ;
  if (RTS.rand(G) >= R.helpChance) { tTell(G, p, `${R.name}은(는) 이번에는 지원군을 보내지 않았습니다`, 'market'); return; }
  const h = G.byId[T.hall], all = tribeUnits(G).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y)), go = all.slice(R.guards).slice(0, R.helpMax);
  if (!go.length) { tTell(G, p, `${R.name}에 보낼 병력이 없습니다`, 'market'); return; }
  T.war[src.team] = Math.max(T.war[src.team], G.tick + R.helpWar * RTS.HZ); T.sent++;
  for (const u of go) RTS.issue(G, u, { type: 'amove', x: e.x, y: e.y, help: 1 });
  tTell(G, p, `${R.name}이 지원군 ${go.length}기를 보냈습니다`, 'ok'); tTell(G, src.team, `${R.name}이 상대를 돕고 있습니다`, 'warn');
  RTS.emit(G, 'tribeHelp', { team: p, n: go.length }); };
RTS.tribeDeath = function (G, e, src) { const T = G.tribe; if (!T || !e.tribeHall) return; T.dead = true;
  const k = src && src.team >= 0 ? src.team : -1; if (k >= 0) { G.teams[k].res.ore += TR().loot; G.teams[k].stats.loot = (G.teams[k].stats.loot || 0) + TR().loot; }
  for (const o of G.teams) tTell(G, o.id, `${TR().name} 회당이 무너졌습니다` + (o.id === k ? `. 광석 +${TR().loot}` : ''), o.id === k ? 'ok' : 'market');
  T.missions = T.missions.map(() => null); };

function tribeSettle(G, team) { const T = G.tribe, L = T.missions[team], ok = L.filter(m => m.done).length; T.missions[team] = null;
  const name = TR().name, other = T.rel.some((x, i) => i !== team && x === 'ally');
  if (ok >= 2 && !other) { T.rel[team] = 'ally'; for (const o of G.teams) tTell(G, o.id, o.id === team ? `미션 2개 성공: ${name}과 동맹을 맺었습니다` : `${G.teams[team].name}이(가) ${name}과 동맹을 맺었습니다`, o.id === team ? 'ok' : 'market'); }
  else if (ok >= 1) { T.wait[team] = G.tick + TR().retrySec * RTS.HZ; tTell(G, team, ok >= 2 ? `${name}이 이미 상대와 동맹이라 중립을 유지합니다` : `미션 1개 성공: ${name}은 중립을 유지합니다. ${TR().retrySec}초 뒤 다시 외교할 수 있습니다`, 'market'); }
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
      if (d.prog(G, t, m) >= d.need) { if (d.pay) for (const k of Object.keys(d.pay)) t.res[k] -= d.pay[k]; m.done = true; tTell(G, t.id, `외교 미션 성공: ${d.name}`, 'ok'); }
      else if (G.tick >= m.until) { m.done = false; tTell(G, t.id, `외교 미션 실패: ${d.name}`, 'warn'); } }
    if (L.every(m => m.done !== null)) tribeSettle(G, t.id); });
  if (T.dead || !h) return;
  const units = tribeUnits(G);
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

// 상대 AI: 부족을 찾으면 70% 확률로 동맹을 노린다. 공병을 보내고, 위치가 필요한 미션은 병력을 보내 돕는다
RTS.aiTribe = function (G, t, diff, units) { const T = G.tribe; if (!T || T.dead) return; const S = t.aiState, h = G.byId[T.hall], sec = G.tick / RTS.HZ; if (!h) return;
  const D = RTS.defs.entities, army = units.filter(u => !D[u.def].gather && !D[u.def].uncontrollable && u.id !== S.scout);
  if (!T.found[t.id]) { if (sec > diff.scoutAt + 40 && (!S.tScout || !G.byId[S.tScout])) { const u = army[0] || units.find(x => D[x.def].gather && !x.cargo); if (u) { S.tScout = u.id; RTS.issue(G, u, { type: 'move', x: h.x, y: h.y + 4 }); } } return; }
  if (S.tPlan === undefined) S.tPlan = RTS.rand(G) < .7 ? 'ally' : 'ignore';
  if (S.tPlan !== 'ally' || T.rel[t.id] !== 'neutral') return;
  const L = T.missions[t.id];
  if (!L) { if (RTS.tribeBlock(G, t.id)) return; const cur = S.envoy && G.byId[S.envoy]; if (cur && !cur.dead && cur.order && cur.order.type === 'envoy') return;
    const w = units.find(x => D[x.def].gather && !x.cargo && x.order && x.order.type === 'gather' && x.order.phase === 'go') || units.find(x => D[x.def].gather); if (w) { S.envoy = w.id; RTS.issue(G, w, { type: 'envoy', target: h.id }); } return; }
  for (const m of L) { if (m.done !== null) continue;
    if (m.id === 'guard') { const near = army.filter(u => Math.hypot(u.x - h.x, u.y - h.y) < 9); const need = 5 - near.length; if (need > 0) army.filter(u => Math.hypot(u.x - h.x, u.y - h.y) >= 9 && !(u.order && u.order.tribe)).slice(0, need).forEach(u => RTS.issue(G, u, { type: 'move', x: h.x + Math.cos(u.id) * 4, y: h.y + Math.sin(u.id) * 4, tribe: 1 })); }
    if (m.id === 'scout' && !(S.tScoutM && G.byId[S.tScoutM] && G.byId[S.tScoutM].order)) { const u = army.find(x => !D[x.def].air) || army[0]; if (u) { S.tScoutM = u.id; RTS.issue(G, u, { type: 'move', x: m.x, y: m.y }); } } }
};
