// super.js — ★ 강화 시간, 처치 수, 히든 슈퍼 합체, 숨기(은신·잠복)와 탐지, 도약, 수호 오라, 수송(2026-11). DOM 없음, 시드 난수만 쓴다(두 기기 동일).
// ── ★ 강화 시간 ── 비용은 시작할 때 내고, time초 뒤 ★가 오른다. 그동안 유닛은 평소처럼 움직이고 싸운다. 죽으면 강화도 사라진다.
//    시간 = 유닛 생산 시간 × time[★-1] (최소 timeMin초). 묶음 생산 유닛(갈퀴충 등)은 묶음 시간 기준.
RTS.RANK.time = [.5, .75]; RTS.RANK.timeMin = [6, 9];
RTS.rankTime = (d, r) => Math.max(RTS.RANK.timeMin[r - 1], Math.round((d.time || 20) * RTS.RANK.time[r - 1]));
(function () {
  const block0 = RTS.rankBlock;
  RTS.rankBlock = function (G, u) { if (u.ranking) return '★ 강화 중입니다'; return block0(G, u); };
  RTS.commands.rankup = function (G, team, c) {
    const t = G.teams[team]; let n = 0, why = '', sec = 0;
    for (const id of c.ids || []) { const u = G.byId[id]; if (!u || u.dead || u.team !== team) continue;
      const no = RTS.rankBlock(G, u); if (no) { why = why || no; continue; }
      const d = RTS.defOf(u), r = (u.rank || 0) + 1, cost = RTS.rankCost(d, r); if (RTS.lack(G, team, t, cost)) { why = ''; break; }
      RTS.pay(t, cost); sec = RTS.rankTime(d, r); u.ranking = { r, at: G.tick, until: G.tick + sec * RTS.HZ }; n++; RTS.emit(G, 'rankStart', { e: u, r }); }
    if (n) RTS.say(G, team, `★ 강화 시작 ${n}기 · ${sec}초`, 'ok'); else if (why) RTS.say(G, team, why, 'warn');
  };
})();
RTS.rankDone = function (G, u) { const k = u.ranking; u.ranking = null; if (!k || u.dead) return; const old = RTS.stat(G, u, 'hp'); u.rank = k.r; u.hp = Math.min(RTS.stat(G, u, 'hp'), u.hp * RTS.stat(G, u, 'hp') / old); RTS.emit(G, 'ranked', { e: u }); };

// ── 처치 수 · 히든 슈퍼 합체 ── 유닛이 적 유닛·건물을 쓰러뜨리면 kills가 오른다(합체 유닛은 정보 창에 보인다).
//    merges에 kills가 있는 조리법은 숨은 합체다: 재료가 모두 그 처치 수 이상일 때만 메뉴에 나오고 고를 수 있다(작은 합체 10, 큰 합체 20).
//    처음으로 처치 수를 채운 합체 유닛은 대사를 외친다(힌트, 'superHint' 사건).
RTS.SUPER = { small: 10, big: 20,
  lines: { small: ['더 강해질 수 있어… 나와 같은 전우가 곁에 있다면!', '힘이 차오른다! 같은 동료와 하나가 될 수 있을 것 같다!'], big: ['이 힘이 넘쳐흐른다… 또 하나의 거인과 합친다면!', '나와 같은 거인을 불러라! 하나가 될 때가 왔다!'] } };
RTS.superRecipe = id => Object.values(RTS.defs.merges).find(m => m.kills && m.parts[id]) || null;
(function () {
  const kill0 = RTS.kill;
  RTS.kill = function (G, e, src, silent) { const was = e.dead; kill0(G, e, src, silent); if (was || !e.dead) return;
    if (e.load && e.load.length) RTS.unloadAll(G, e, true); // 수송기가 쓰러지면 탄 유닛을 내보낸다(피해를 입고)
    if (!src || silent || src.dead || src.team < 0 || src.team === e.team || e.team === -1) return; const sd = src.def && RTS.defs.entities[src.def]; if (!sd || sd.kind !== 'unit') return;
    src.kills = (src.kills || 0) + 1; const base = sd.formOf || src.def, m = RTS.superRecipe(base);
    if (m && !src.superHint && src.kills >= m.kills) { src.superHint = 1; const L = RTS.SUPER.lines[m.kills >= RTS.SUPER.big ? 'big' : 'small']; RTS.emit(G, 'superHint', { e: src, text: L[Math.floor(RTS.rand(G) * L.length)] }); } };
  const mergesOf0 = RTS.mergesOf;
  RTS.mergesOf = (G, team, defId, u) => mergesOf0(G, team, defId).filter(m => !m.kills || (u && (u.kills || 0) >= m.kills));
  const pick0 = RTS.mergePick;
  RTS.mergePick = function (G, u, m) { if (!m.kills) return pick0(G, u, m);
    const need = Object.assign({}, m.parts), pick = [u]; need[u.def]--;
    const cand = G.ents.filter(o => o !== u && !o.dead && o.team === u.team && need[o.def] > 0 && !o.merging && !o.morphing && (o.kills || 0) >= m.kills && Math.hypot(o.x - u.x, o.y - u.y) <= RTS.MERGE.range).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y) || a.id - b.id);
    for (const o of cand) if (need[o.def] > 0) { need[o.def]--; pick.push(o); }
    return { pick, miss: Object.keys(need).filter(k => need[k] > 0).map(k => [k, need[k]]) }; };
  const merge0 = RTS.commands.merge;
  RTS.commands.merge = function (G, team, c) { const u = G.byId[c.unit], m = RTS.defs.merges[c.recipe]; if (m && m.kills && (!u || (u.kills || 0) < m.kills)) return; merge0(G, team, c); };
  const block0 = RTS.mergeBlock;
  RTS.mergeBlock = function (G, u, m) { if (m.kills && (u.morphing || u.ranking)) return u.morphing ? '변신 중입니다' : '★ 강화 중입니다'; if (m.kills && (u.load || []).length) return '먼저 탄 유닛을 내려야 합니다'; return block0(G, u, m); };
  const morph0 = RTS.morphBlock;
  RTS.morphBlock = function (G, u) { if ((u.load || []).length) return '먼저 탄 유닛을 내려야 합니다'; if (u.burrowed) return '땅속에서는 변신할 수 없습니다'; return morph0(G, u); };
})();

// ── 숨기와 탐지 ── 은신(cloakUntil까지)·잠복(burrowed) 유닛은 상대 팀의 탐지 유닛 범위 안에서만 보이고 겨눌 수 있다(RTS.seen, sim.js).
//    탐지 유닛: 치료 능력(heal)이 있고 ★ detectRank 이상인 유닛. 범위 = 그 유닛 시야.
RTS.DETECT = { rank: 1 };
RTS.detector = (G, e) => { const d = RTS.defOf(e); return !!d.heal && (e.rank || 0) >= RTS.DETECT.rank && !e.inside; };
// ── 도약(돌격대장) · 잠복(독충왕) · 수호 오라(큰 슈퍼 합체 기본 형태) · 수송(큰 슈퍼 합체 변신 형태)
RTS.LEAP = { time: .7, dmg: 30, splash: 1.6, stun: 1 };
RTS.AURA = { r: 6, taken: .75, regen: 3 };
RTS.TRANSPORT = { reach: 1.8, maxR: .8, hurt: .25, drop: 3 };
(function () { const dmg0 = RTS.damage; RTS.damage = function (G, t, dmg, src) { if ((t.auraUntil || 0) > G.tick) dmg *= RTS.AURA.taken; if (t.inside) return; dmg0(G, t, dmg, src); }; })();
RTS.leap = function (G, u, x, y) { const p = RTS.walkable(G, Math.floor(x), Math.floor(y)) ? { x, y } : RTS.nearestFree(G, x, y, 3); if (!p) return false;
  const n = Math.round(RTS.LEAP.time * RTS.HZ); u.leaping = { sx: u.x, sy: u.y, tx: p.x, ty: p.y, at: G.tick, until: G.tick + n }; u.path = null; u.needPath = false; u.stunned = G.tick + n; RTS.emit(G, 'leapStart', { e: u }); return true; };
RTS.canBoard = (G, u, car) => { const d = RTS.defOf(u), cd = RTS.defOf(car); return !!cd.transport && u !== car && u.team === car.team && d.kind === 'unit' && !d.air && (d.r || .5) <= RTS.TRANSPORT.maxR && !u.inside && !u.merging && !u.morphing && !d.uncontrollable && (car.load || []).length < cd.transport; };
RTS.board = function (G, u, car) { if (!RTS.canBoard(G, u, car)) return false; (car.load = car.load || []).push(u.id); u.inside = car.id; u.x = car.x; u.y = car.y; u.path = null; u.needPath = false; u.order = null; u.queue = []; u.tgt = 0; u.burrowed = false; RTS.emit(G, 'boarded', { e: u, car }); return true; };
// 내리기: 탄 유닛을 수송기 둘레의 갈 수 있는 땅에 놓는다. hurt면(수송기가 쓰러짐) 체력 일부를 잃는다. 땅이 없으면 false
RTS.unloadAll = function (G, car, hurt) { const ids = car.load || []; if (!ids.length) return true; const spot = RTS.walkable(G, Math.floor(car.x), Math.floor(car.y)) ? { x: car.x, y: car.y } : RTS.nearestFree(G, car.x, car.y, hurt ? 12 : RTS.TRANSPORT.drop);
  if (!spot) return false; let i = 0; for (const id of ids) { const u = G.byId[id]; if (!u || u.dead) continue; const a = i * 2.39996, rr = .6 + .35 * Math.sqrt(i); let px = spot.x + Math.cos(a) * rr, py = spot.y + Math.sin(a) * rr;
      if (!RTS.walkable(G, Math.floor(px), Math.floor(py))) { px = spot.x; py = spot.y; } u.inside = 0; u.x = px; u.y = py; u.px = px; u.py = py; i++; if (hurt) { u.hp -= RTS.stat(G, u, 'hp') * RTS.TRANSPORT.hurt; if (u.hp <= 0) RTS.kill(G, u, null); } }
  car.load = []; RTS.emit(G, 'unloaded', { car }); return true; };
RTS.commands.board = function (G, team, c) { const car = G.byId[c.target]; if (!car || car.dead || car.team !== team || !RTS.defOf(car).transport) return; let n = 0;
  for (const id of c.ids || []) { const u = G.byId[id]; if (!u || u.dead || u.team !== team || u === car) continue; if (!RTS.canBoard(G, u, car) && (car.load || []).length + n >= RTS.defOf(car).transport) break; if (RTS.defOf(u).air || (RTS.defOf(u).r || .5) > RTS.TRANSPORT.maxR) continue; RTS.issue(G, u, { type: 'board', target: car.id }); n++; }
  if (!n) RTS.say(G, team, '탈 수 있는 유닛이 없습니다(지상 소형·중형 유닛, 자리 ' + RTS.defOf(car).transport + ')', 'warn'); };
RTS.orders.board = function (G, u, o) { const car = G.byId[o.target]; if (!car || car.dead || !RTS.defOf(car).transport || (car.load || []).length >= RTS.defOf(car).transport) { RTS.issue(G, u, null); return; }
  if (Math.hypot(u.x - car.x, u.y - car.y) <= RTS.TRANSPORT.reach + (RTS.defOf(car).r || 1)) { RTS.board(G, u, car); return; }
  if (!u.path && !u.needPath || (G.tick + u.id) % 20 === 0) RTS.goTo(G, u, car); };

RTS.addSystem({ id: 'super', run(G) {
  const det = [];
  for (const e of G.ents) { if (e.dead) continue;
    if (e.ranking && G.tick >= e.ranking.until) RTS.rankDone(G, e);
    if (e.inside) { const car = G.byId[e.inside]; if (!car || car.dead) { e.inside = 0; } else { e.x = car.x; e.y = car.y; } continue; }
    if (e.leaping && G.tick >= e.leaping.until) { const L = e.leaping, P = RTS.LEAP; e.leaping = null; e.x = L.tx; e.y = L.ty; e.px = e.x; e.py = e.y; e.stunned = 0;
      RTS.query(G, e.x, e.y, P.splash + 1, o => { if (o.dead || !RTS.foe(G, e.team, o.team) || RTS.defOf(o).air || Math.hypot(o.x - e.x, o.y - e.y) > P.splash) return; RTS.damage(G, o, P.dmg, e); if (RTS.defOf(o).kind === 'unit') o.stunned = Math.max(o.stunned || 0, G.tick + P.stun * RTS.HZ); });
      RTS.emit(G, 'impact', { x: e.x, y: e.y, w: { splash: P.splash }, team: e.team }); }
    else if (e.leaping) { const L = e.leaping, k = (G.tick - L.at) / (L.until - L.at); e.x = L.sx + (L.tx - L.sx) * k; e.y = L.sy + (L.ty - L.sy) * k; }
    if (e.burrowed && G.tick % RTS.HZ === 0) e.hp = Math.min(RTS.stat(G, e, 'hp'), e.hp + (RTS.defs.abilities.burrow.regen || 4));
    const d = RTS.defOf(e);
    if (d.aura && !e.morphing) { if (G.tick % RTS.HZ === 0) e.hp = Math.min(RTS.stat(G, e, 'hp'), e.hp + RTS.AURA.regen);
      if (G.tick % 5 === 0) RTS.query(G, e.x, e.y, RTS.AURA.r, o => { if (!o.dead && (o.team === e.team || (RTS.ally && RTS.ally(G, o.team, e.team))) && Math.hypot(o.x - e.x, o.y - e.y) <= RTS.AURA.r) o.auraUntil = G.tick + 6; }); }
    if (RTS.detector(G, e)) det.push(e);
    if (e.det && e.det.length && !RTS.stealthed(G, e)) e.det = null; }
  // 탐지: 숨은 유닛마다 어느 팀의 탐지 유닛 범위 안인지 기록(4틱마다)
  if (G.tick % 4 === 0) for (const e of G.ents) { if (e.dead || e.inside || !RTS.stealthed(G, e)) continue; const list = [];
    for (const q of det) { if (q.team === e.team || list.includes(q.team)) continue; const r = RTS.stat(G, q, 'sight') || RTS.defOf(q).sight || 7; if (Math.hypot(q.x - e.x, q.y - e.y) <= r) list.push(q.team); }
    e.det = list.length ? list : null; }
} }, { after: 'merge' });
