// upgrade.js — 건물 강화(1·2단계), 유닛 강화(★), 유닛 합체. DOM을 쓰지 않는다.
//  - 건물 강화: 건물마다 따로. 체력·방어·생산(연구) 속도·공격·보급이 오른다. 생산 대기열에 들어가 시간이 걸린다.
//  - 유닛 강화: 유닛마다 따로, 즉시. ★n은 그 유닛을 만드는 건물이 강화 n단계 이상이어야 한다.
//  - 합체: 합체 건물(merges[].at)이 강화 2단계면 재료 유닛을 모아 새 유닛 하나로 바꾼다.
//    체력 = 재료 체력 합, 공격력(초당 피해) = 재료 합 × 0.75 → 두 기 합체면 한 기 기준 1.5배.
RTS.LEVEL = { max: 2, hp: .25, armor: 1, rate: .25, dmg: .25, range: .5, supply: 4,
  cost: [.6, 1], oreMin: [75, 150], gasMin: [50, 100], time: [.6, 1], timeMin: [20, 30] };
RTS.RANK = { max: 2, hp: .2, dmg: .15, cost: [.4, .6] };
RTS.MERGE = { range: 10, dmg: .75, wait: 20, time: .4, timeMin: 12, timeMax: 45 }; // range: 재료를 찾는 거리(칸), wait: 모이는 제한 시간(초), time: 합체 시간 = 재료 생산 시간 합 × time(초, 최소·최대)

const r25 = v => Math.round(v / 25) * 25, r5 = v => Math.round(v / 5) * 5;

// ── 건물 강화 ──────────────────────────────────────────────
RTS.canLevel = d => !!d && d.kind === 'building' && !d.site && !d.placeOn && !d.noLevel && !!d.cost;
RTS.levelCost = (d, lv) => { const L = RTS.LEVEL, k = lv - 1, c = d.cost || {}; return { ore: Math.max(L.oreMin[k], r25((c.ore || 0) * L.cost[k])), gas: Math.max(L.gasMin[k], r25((c.gas || 0) * L.cost[k])) }; };
RTS.levelTime = (d, lv) => Math.max(RTS.LEVEL.timeMin[lv - 1], Math.round((d.time || 20) * RTS.LEVEL.time[lv - 1]));
RTS.prodRate = e => 1 + RTS.LEVEL.rate * (e.lv || 0);
RTS.provides = e => { const d = RTS.defOf(e); return d.provides ? d.provides + RTS.LEVEL.supply * (e.lv || 0) : 0; };
// 강화 n단계가 주는 효과(누적값) 설명
RTS.levelFx = (d, lv) => { const L = RTS.LEVEL, out = [`체력 +${Math.round(L.hp * lv * 100)}%`, `방어 +${L.armor * lv}`];
  if (d.trains || d.researches) out.push(`${d.researches && !d.trains ? '연구' : '생산'} 속도 +${Math.round(L.rate * lv * 100)}%`);
  if (d.weapon) out.push(`공격 +${Math.round(L.dmg * lv * 100)}%`, `사거리 +${L.range * lv}`);
  if (d.provides) out.push(`보급 +${L.supply * lv}`);
  return out; };
RTS.levelBlock = function (G, b) { const d = RTS.defOf(b);
  if (!RTS.canLevel(d) || b.team < 0) return '강화할 수 없는 건물입니다';
  if (!RTS.complete(b)) return '건설 중에는 강화할 수 없습니다';
  if ((b.lv || 0) >= RTS.LEVEL.max) return '이미 최고 단계입니다';
  if (b.prod.some(p => p.kind === 'level')) return '강화가 진행 중입니다';
  if (b.prod.length >= 5) return '대기열이 가득 찼습니다';
  return ''; };
RTS.commands.levelup = function (G, team, c) {
  const t = G.teams[team], b = G.byId[c.building]; if (!b || b.dead || b.team !== team) return;
  const why = RTS.levelBlock(G, b); if (why) { RTS.say(G, team, why, 'warn'); return; }
  const d = RTS.defOf(b), lv = (b.lv || 0) + 1, cost = RTS.levelCost(d, lv); if (RTS.lack(G, team, t, cost)) return;
  RTS.pay(t, cost); b.prod.push({ kind: 'level', id: b.def, lv, t: 0, total: Math.round(RTS.levelTime(d, lv) * RTS.HZ), started: true });
};
RTS.levelDone = function (G, b, lv) {
  const old = RTS.stat(G, b, 'hp'); b.lv = lv; b.hp = Math.min(RTS.stat(G, b, 'hp'), b.hp * RTS.stat(G, b, 'hp') / old);
  const unlock = Object.values(RTS.defs.merges).filter(m => m.at === b.def && lv >= 2).map(m => RTS.defs.entities[m.into].name);
  RTS.say(G, b.team, `${RTS.defOf(b).name} 강화 ${lv}단계 완료` + (unlock.length ? ` · 합체 가능: ${unlock.join(', ')}` : ''), 'ok');
  RTS.emit(G, 'leveled', { e: b, lv });
};

// ── 유닛 강화 ★ ────────────────────────────────────────────
// 유닛 → 그 유닛을 만드는 건물 id. 합체 유닛은 합체 건물.
RTS.producerOf = function (id) {
  if (!RTS._prod) { RTS._prod = {}; for (const b of Object.values(RTS.defs.entities)) for (const u of b.trains || []) if (!RTS._prod[u]) RTS._prod[u] = b.id;
    for (const m of Object.values(RTS.defs.merges)) RTS._prod[m.into] = m.at; }
  return RTS._prod[id] || null; };
RTS.rankCost = (d, r) => { const k = RTS.RANK.cost[r - 1], c = d.cost || {}, out = { ore: Math.max(25, r5((c.ore || 0) * k)) }; if (c.gas) out.gas = r5(c.gas * k); return out; };
RTS.rankBlock = function (G, u) { const d = RTS.defOf(u), t = G.teams[u.team];
  if (!t || d.kind !== 'unit' || d.uncontrollable) return '강화할 수 없습니다';
  const p = RTS.producerOf(u.def); if (!p) return '강화할 수 없는 유닛입니다';
  const r = (u.rank || 0) + 1; if (r > RTS.RANK.max) return '이미 최고 강화 단계입니다';
  if (((t.lvl || {})[p] || 0) < r) return `${RTS.defs.entities[p].name} 강화 ${r}단계가 필요합니다`;
  return ''; };
RTS.commands.rankup = function (G, team, c) {
  const t = G.teams[team]; let n = 0, why = '';
  for (const id of c.ids || []) { const u = G.byId[id]; if (!u || u.dead || u.team !== team) continue;
    const no = RTS.rankBlock(G, u); if (no) { why = why || no; continue; }
    const r = (u.rank || 0) + 1, cost = RTS.rankCost(RTS.defOf(u), r); if (RTS.lack(G, team, t, cost)) { why = ''; break; } // lack이 부족 알림을 낸다
    RTS.pay(t, cost); const old = RTS.stat(G, u, 'hp'); u.rank = r; u.hp = Math.min(RTS.stat(G, u, 'hp'), u.hp * RTS.stat(G, u, 'hp') / old); n++;
    RTS.emit(G, 'ranked', { e: u });
  }
  if (n) RTS.say(G, team, `강화 완료 ${n}기`, 'ok'); else if (why) RTS.say(G, team, why, 'warn');
};

// ── 합체 ──────────────────────────────────────────────────
// 재료 정의로 합체 유닛 스탯을 만든다. extra로 이름·그림·크기·능력 등을 덧붙인다.
//  체력 합, 방어·시야·사거리 최대, 속도 최소(가장 느린 재료), 보급·비용 합.
//  무기: 초당 피해 합 × MERGE.dmg. 공격 간격은 재료 무기를 초당 피해로 가중 평균. 공중 공격·범위는 하나라도 있으면 갖는다.
RTS.fuseDef = function (parts, extra = {}) {
  const D = RTS.defs.entities, list = [];
  for (const id of Object.keys(parts)) { if (!D[id]) throw new Error('합체 재료 없음: ' + id); for (let i = 0; i < parts[id]; i++) list.push(D[id]); }
  const sum = f => list.reduce((s, d) => s + f(d), 0), max = f => Math.max(...list.map(f)), cost = {};
  for (const d of list) for (const k of Object.keys(d.cost || {})) cost[k] = (cost[k] || 0) + d.cost[k];
  const ws = list.filter(d => d.weapon).map(d => ({ w: d.weapon, dps: d.weapon.damage / d.weapon.cooldown })), dps = ws.reduce((s, x) => s + x.dps, 0);
  let weapon = null;
  if (ws.length) {
    const cd = ws.reduce((s, x) => s + x.w.cooldown * x.dps, 0) / dps, byDps = ws.slice().sort((a, b) => b.dps - a.dps), ranged = byDps.filter(x => x.w.range > 1), top = ranged[0] || byDps[0];
    weapon = { damage: Math.round(RTS.MERGE.dmg * dps * cd * 10) / 10, cooldown: Math.round(cd * 100) / 100, range: Math.max(...ws.map(x => x.w.range)) };
    if (ws.every(x => x.w.air === false)) weapon.air = false;
    const sp = Math.max(...ws.map(x => x.w.splash || 0)); if (sp) weapon.splash = sp;
    if (top.w.speed) { weapon.speed = top.w.speed; weapon.art = top.w.art; }
    if (extra.weapon) Object.assign(weapon, extra.weapon);
  }
  const out = { kind: 'unit', hp: sum(d => d.hp || 0), armor: max(d => d.armor || 0), speed: Math.min(...list.map(d => d.speed || 1)), sight: max(d => d.sight || 0),
    supply: sum(d => d.supply || 0), cost, tags: (D[Object.keys(parts)[0]].tags || []).slice(), fused: Object.assign({}, parts) };
  if (weapon) out.weapon = weapon;
  const rest = Object.assign({}, extra); delete rest.weapon;
  return Object.assign(out, rest);
};
// 합체에 걸리는 시간(초). 재료가 다 모인 뒤부터 센다. merges[].time으로 따로 정할 수 있다
RTS.mergeTime = m => { if (m.time) return m.time; const D = RTS.defs.entities, M = RTS.MERGE; let s = 0; for (const k of Object.keys(m.parts)) s += (D[k].time || 0) * m.parts[k]; return Math.max(M.timeMin, Math.min(M.timeMax, Math.round(s * M.time))); };
RTS.mergeJob = (G, e) => e && e.merging && G.merges ? G.merges.find(j => j.id === e.merging) || null : null;
// 이 유닛이 재료로 쓰이는 합체(같은 진영). 일꾼처럼 곁다리 재료인 유닛에서는 main=true인 것만 고르면 된다
RTS.mergesOf = (G, team, defId) => { const t = G.teams[team]; return t ? Object.values(RTS.defs.merges).filter(m => m.faction === t.faction && m.parts[defId]) : []; };
RTS.mergeBlock = function (G, u, m) { const t = G.teams[u.team];
  if (((t.lvl || {})[m.at] || 0) < 2) return `${RTS.defs.entities[m.at].name} 강화 2단계가 필요합니다`;
  if (u.merging) return '이미 합체 중입니다';
  return ''; };
// 기준 유닛 u와, 가까운 순서로 고른 나머지 재료. miss: [[유닛 id, 부족 수]]
RTS.mergePick = function (G, u, m) {
  const need = Object.assign({}, m.parts), pick = [u]; need[u.def]--;
  const cand = G.ents.filter(o => o !== u && !o.dead && o.team === u.team && need[o.def] > 0 && !o.merging && Math.hypot(o.x - u.x, o.y - u.y) <= RTS.MERGE.range)
    .sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y) || a.id - b.id);
  for (const o of cand) if (need[o.def] > 0) { need[o.def]--; pick.push(o); }
  return { pick, miss: Object.keys(need).filter(k => need[k] > 0).map(k => [k, need[k]]) };
};
RTS.commands.merge = function (G, team, c) {
  const u = G.byId[c.unit], m = RTS.defs.merges[c.recipe], D = RTS.defs.entities;
  if (!u || u.dead || u.team !== team || !m || !m.parts[u.def] || m.faction !== G.teams[team].faction) return;
  const why = RTS.mergeBlock(G, u, m); if (why) { RTS.say(G, team, why, 'warn'); return; }
  const { pick, miss } = RTS.mergePick(G, u, m);
  if (miss.length) { RTS.say(G, team, `합체 재료가 부족합니다(${RTS.MERGE.range}칸 안): ` + miss.map(([k, n]) => D[k].name + ' ' + n + '기').join(', '), 'warn'); return; }
  const job = { id: (G.mergeN = (G.mergeN || 0) + 1), team, recipe: m.id, host: u.id, parts: pick.map(e => e.id), until: G.tick + RTS.MERGE.wait * RTS.HZ };
  for (const e of pick) { e.merging = job.id; e.sieged = false; RTS.issue(G, e, { type: 'merge', job: job.id, host: u.id }); }
  (G.merges = G.merges || []).push(job);
  RTS.say(G, team, `${D[m.into].name} 합체: 재료가 모이는 중`, 'ok');
};
// 재료는 기준 유닛에게 걸어가고, 기준 유닛은 제자리에서 기다린다. 다른 명령을 받으면 합체가 취소된다.
RTS.orders.merge = function (G, u, o) {
  const h = G.byId[o.host]; if (!h || h.dead) { RTS.issue(G, u, null); return; }
  if (h === u) { RTS.stopMove(u); return; }
  if (Math.hypot(u.x - h.x, u.y - h.y) <= RTS.defOf(u).r + RTS.defOf(h).r + .6) RTS.stopMove(u); else RTS.goTo(G, u, h);
};
RTS.fuse = function (G, j, parts, host) {
  const m = RTS.defs.merges[j.recipe], d = RTS.defs.entities[m.into]; let hp = 0;
  for (const e of parts) hp += e.hp;
  const pos = d.air ? { x: host.x, y: host.y } : RTS.nearestFree(G, host.x, host.y), facing = host.facing;
  for (const e of parts) RTS.kill(G, e, null, true);
  const u = RTS.spawn(G, m.into, j.team, pos.x, pos.y); u.hp = Math.min(RTS.stat(G, u, 'hp'), hp); u.facing = facing;
  RTS.emit(G, 'merged', { e: u, from: parts.map(e => e.id) });
  RTS.say(G, j.team, d.name + ' 합체 완료', 'ok');
  return u;
};
RTS.addSystem({ id: 'merge', run(G) {
  if (!G.merges || !G.merges.length) return;
  G.merges = G.merges.filter(j => {
    const parts = j.parts.map(id => G.byId[id]), host = G.byId[j.host];
    const live = parts.every(e => e && !e.dead && e.order && e.order.type === 'merge' && e.order.job === j.id);
    if (!live || (!j.at && G.tick > j.until)) {
      for (const e of parts) if (e && !e.dead && e.merging === j.id) { e.merging = 0; if (e.order && e.order.type === 'merge') RTS.issue(G, e, null); }
      RTS.say(G, j.team, live ? '재료가 제때 모이지 못해 합체가 취소되었습니다' : '합체가 취소되었습니다', 'warn'); return false;
    }
    if (!j.at) { // 1단계: 재료가 모인다
      if (!parts.every(e => Math.hypot(e.x - host.x, e.y - host.y) <= RTS.defOf(e).r + RTS.defOf(host).r + 1)) return true;
      const m = RTS.defs.merges[j.recipe]; j.at = G.tick; j.total = RTS.mergeTime(m) * RTS.HZ;
      RTS.say(G, j.team, `${RTS.defs.entities[m.into].name} 합체 시작: ${RTS.mergeTime(m)}초`, 'ok'); RTS.emit(G, 'mergeStart', { job: j }); return true; }
    if (G.tick - j.at < j.total) return true; // 2단계: 합체 중. 재료가 죽거나 다른 명령을 받으면 취소
    RTS.fuse(G, j, parts, host); return false;
  });
} }, { after: 'entities' });

// ── 치료 비용 · 공병 수리 · 철거 (2026-11) ─────────────────
// heal·repair: 체력을 가득 채우면 대상 생산비의 이 비율이 든다(체력 1당 생산비 × 비율 ÷ 최대 체력, 묶음 생산 유닛은 한 기 값).
// 자원이 모자라면 치료·수리를 하지 않는다. demo: 철거 비용 = 건물 비용 × demo(광석 최소 demoMin), 철거 시간 = 건설 시간 × demoTime(demoTimeMin~demoTimeMax초).
// humanHealers: 사람 플레이어의 치료 유닛 최대 수. AI는 난이도 healers.
RTS.SERVICE = { heal: .3, repair: .35, demo: .15, demoMin: 10, demoTime: .25, demoTimeMin: 5, demoTimeMax: 20, humanHealers: 6, warnEvery: 15 };
RTS.serviceCost = function (G, t, hp, ratio) { const d = RTS.defOf(t), c = d.cost || {}, n = d.count || 1, max = RTS.stat(G, t, 'hp') || 1, out = {};
  for (const k of Object.keys(c)) if (c[k] > 0) out[k] = c[k] / n * ratio * hp / max; return out; };
// 비용을 내면 true. 모자라면 알림(warnEvery초에 한 번)을 내고 false. 중립 세력(team < 0)은 무료
RTS.servicePay = function (G, team, cost, what) { const t = G.teams[team]; if (!t || team < 0) return true;
  if (RTS.canPay(t, cost)) { RTS.pay(t, cost); return true; }
  if (G.tick - (t.svcWarn || -1e9) > RTS.SERVICE.warnEvery * RTS.HZ) { t.svcWarn = G.tick; RTS.say(G, team, `${what}에 쓸 자원이 부족합니다`, 'warn'); }
  return false; };
// 치료 1회: 실제로 채운 체력만큼 비용을 낸다. 성공하면 채운 양, 실패하면 0
RTS.healOnce = function (G, src, t, amount, ratio, what) { const max = RTS.stat(G, t, 'hp'), add = Math.min(amount, max - t.hp); if (add <= 0) return 0;
  if (!RTS.servicePay(G, src.team, RTS.serviceCost(G, t, add, ratio), what)) return 0;
  t.hp = Math.min(max, t.hp + add); RTS.emit(G, 'heal', { e: src, t }); return add; };

// 치료 유닛 수 제한
RTS.healerCap = (G, team) => { const t = G.teams[team]; if (!t) return Infinity; if (t.ai) { const v = (RTS.defs.difficulties[t.ai] || {}).healers; return v == null ? 3 : v; } return RTS.SERVICE.humanHealers; };
RTS.healerCount = (G, team) => { let n = 0; for (const e of G.ents) { if (e.dead || e.team !== team) continue; const d = RTS.defOf(e);
  if (d.heal) n++; else if (d.kind === 'building') for (const p of e.prod || []) if (p.kind === 'unit' && RTS.defs.entities[p.id].heal) n += RTS.defs.entities[p.id].count || 1; } return n; };

// 수리(개척단 공병): 일꾼 정의의 repair { tag, amount, cooldown, range }
RTS.repairBlock = function (G, u, t) { const r = RTS.defOf(u).repair; if (!r) return '수리할 수 없는 유닛입니다';
  if (!t || t.dead || t.team !== u.team || t === u) return '내 유닛만 수리할 수 있습니다';
  const d = RTS.defOf(t); if (d.kind !== 'unit' || !(d.tags || []).includes(r.tag)) return '기계 유닛만 수리할 수 있습니다';
  if (t.hp >= RTS.stat(G, t, 'hp')) return '체력이 가득 차 있습니다';
  return ''; };
RTS.orders.repair = function (G, u, o) { const t = G.byId[o.target], r = RTS.defOf(u).repair;
  if (!r || !t || t.dead || t.team !== u.team || t.hp >= RTS.stat(G, t, 'hp')) { RTS.issue(G, u, null); RTS.backToWork(G, u); return; }
  if (RTS.edgeDist(u, t) > r.range) { RTS.goTo(G, u, t); return; }
  RTS.stopMove(u); u.facing = Math.atan2(t.y - u.y, t.x - u.x);
  if (u.cd > 0) return; u.cd = Math.round(r.cooldown * RTS.HZ);
  if (!RTS.healOnce(G, u, t, r.amount, RTS.SERVICE.repair, '수리')) { RTS.issue(G, u, null); RTS.backToWork(G, u); } };

// 철거: 일꾼 누구나. 완공된 내 건물, 생산·연구·강화 대기열이 비어 있을 때. 비용은 철거를 시작할 때 한 번 낸다(되돌려 받지 않는다)
RTS.demoCost = d => { const S = RTS.SERVICE, c = d.cost || {}, out = { ore: Math.max(S.demoMin, Math.round((c.ore || 0) * S.demo)) }; if (c.gas) out.gas = Math.round(c.gas * S.demo); return out; };
RTS.demoTicks = d => Math.round(Math.max(RTS.SERVICE.demoTimeMin, Math.min(RTS.SERVICE.demoTimeMax, (d.time || 20) * RTS.SERVICE.demoTime)) * RTS.HZ);
RTS.demoBlock = function (G, b, team) { const d = RTS.defOf(b);
  if (!b || b.dead || b.team !== team || d.kind !== 'building' || b.company || b.branch) return '내 건물만 철거할 수 있습니다';
  if (!RTS.complete(b)) return '짓는 중인 건물은 취소하세요';
  if (b.prod && b.prod.length) return '생산·연구 중에는 철거할 수 없습니다';
  if (d.dropoff && !G.ents.some(o => o !== b && !o.dead && o.team === team && RTS.defOf(o).dropoff && RTS.complete(o))) return '마지막 사령부는 철거할 수 없습니다';
  return ''; };
RTS.commands.demolish = function (G, team, c) { const b = G.byId[c.building], t = G.teams[team];
  const ws = (c.ids || []).map(i => G.byId[i]).filter(w => w && !w.dead && w.team === team && RTS.defOf(w).gather); if (!ws.length || !b) return;
  const why = RTS.demoBlock(G, b, team); if (why) { RTS.say(G, team, why, 'warn'); return; }
  if (!b.demoPaid) { const cost = RTS.demoCost(RTS.defOf(b)); if (RTS.lack(G, team, t, cost)) return; RTS.pay(t, cost); b.demoPaid = true; b.demo = 0; }
  for (const w of ws) RTS.issue(G, w, { type: 'demolish', target: b.id }, c.queue);
  RTS.say(G, team, `${RTS.defOf(b).name} 철거를 시작합니다`, 'ok'); };
RTS.orders.demolish = function (G, u, o) { const b = G.byId[o.target];
  if (!b || b.dead || b.team !== u.team) { RTS.issue(G, u, null); RTS.backToWork(G, u); return; }
  if (RTS.edgeDist(u, b) > 1.1) { RTS.goTo(G, u, b); return; }
  RTS.stopMove(u); u.facing = Math.atan2(b.y - u.y, b.x - u.x); if (b.prod && b.prod.length) return; // 철거 중 생산을 넣으면 그동안 멈춘다
  b.demo = (b.demo || 0) + 1; u.building = G.tick;
  if (b.demo >= RTS.demoTicks(RTS.defOf(b))) { RTS.kill(G, b, null, true); RTS.emit(G, 'death', { e: b }); RTS.say(G, u.team, `${RTS.defOf(b).name} 철거 완료`, 'ok'); RTS.issue(G, u, null); RTS.backToWork(G, u); } };
// 일을 마친 사람 쪽 일꾼은 가까운 광맥으로 돌아간다(AI 일꾼은 AI가 다시 배치)
RTS.backToWork = function (G, u) { if (u.order || !RTS.defOf(u).gather || G.teams[u.team].ai) return; const n = RTS.nearestNode(G, u.x, u.y, 'ore', 16); if (n) u.order = { type: 'gather', node: n.id }; };
