// upgrade.js — 건물 강화(1·2단계), 유닛 강화(★), 유닛 합체. DOM을 쓰지 않는다.
//  - 건물 강화: 건물마다 따로. 체력·방어·생산(연구) 속도·공격·보급이 오른다. 생산 대기열에 들어가 시간이 걸린다.
//  - 유닛 강화: 유닛마다 따로, 즉시. ★n은 그 유닛을 만드는 건물이 강화 n단계 이상이어야 한다.
//  - 합체: 합체 건물(merges[].at)이 강화 2단계면 재료 유닛을 모아 새 유닛 하나로 바꾼다.
//    체력 = 재료 체력 합, 공격력(초당 피해) = 재료 합 × 0.75 → 두 기 합체면 한 기 기준 1.5배.
RTS.LEVEL = { max: 2, hp: .25, armor: 1, rate: .25, dmg: .25, range: .5, supply: 4,
  cost: [.6, 1], oreMin: [75, 150], gasMin: [50, 100], time: [.6, 1], timeMin: [20, 30] };
RTS.RANK = { max: 2, hp: .2, dmg: .15, cost: [.4, .6] };
RTS.MERGE = { range: 10, dmg: .75, wait: 20 }; // range: 재료를 찾는 거리(칸), wait: 모이는 제한 시간(초)

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
    if (!live || G.tick > j.until) {
      for (const e of parts) if (e && !e.dead && e.merging === j.id) { e.merging = 0; if (e.order && e.order.type === 'merge') RTS.issue(G, e, null); }
      RTS.say(G, j.team, live ? '재료가 제때 모이지 못해 합체가 취소되었습니다' : '합체가 취소되었습니다', 'warn'); return false;
    }
    if (!parts.every(e => Math.hypot(e.x - host.x, e.y - host.y) <= RTS.defOf(e).r + RTS.defOf(host).r + 1)) return true;
    RTS.fuse(G, j, parts, host); return false;
  });
} }, { after: 'entities' });
