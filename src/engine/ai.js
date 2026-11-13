// ai.js — 데이터 주도 AI. 진영의 ai 블록(빌드 오더, 병력 비율, 연구 순서)만 읽는다.
// 현재 AI는 안개를 무시하고 상대 건물 위치를 안다. 난이도별 수입 배율은 difficulties에 있다.
// 성능 배율(t.boost)을 난이도 값에 적용한다. 수입은 createGame에서 이미 곱했다.
// 판단 주기·첫 공격·확장 시점은 배율만큼 빠르게, 일꾼 수·공격 규모·투자는 배율만큼 크게.
const aiDiffCache = {};
RTS.aiDiff = function (t) {
  const base = RTS.defs.difficulties[t.ai], k = t.boost || 1; if (k === 1) return base;
  const key = t.ai + '@' + k; if (aiDiffCache[key]) return aiDiffCache[key];
  return (aiDiffCache[key] = Object.assign({}, base, { income: base.income * k, interval: Math.max(10, Math.round(base.interval / k)), maxWorkers: Math.round(base.maxWorkers * k),
    waveSize: Math.round(base.waveSize * k), waveGrow: Math.max(1, Math.round(base.waveGrow * k)), firstAttack: Math.round(base.firstAttack / k), expandAt: Math.round(base.expandAt / k),
    investEvery: Math.max(5, Math.round(base.investEvery / k)), scoutAt: Math.round(base.scoutAt / k), allyArmy: Math.max(4, Math.round(base.allyArmy / k)) }));
};
RTS.aiThink = function (G, t) {
  const diff = RTS.aiDiff(t);
  if ((G.tick + t.id * 3) % diff.interval) return;
  const f = RTS.defs.factions[t.faction], P = f.ai, S = t.aiState, D = RTS.defs.entities;
  const mine = G.ents.filter(e => e.team === t.id && !e.dead);
  const builds = mine.filter(e => D[e.def].kind === 'building' && !D[e.def].site), units = mine.filter(e => D[e.def].kind === 'unit');
  const workers = units.filter(e => D[e.def].gather), army = units.filter(e => !D[e.def].gather && !D[e.def].uncontrollable && e.id !== S.scout);
  const hqs = builds.filter(e => D[e.def].dropoff && RTS.complete(e));
  const count = id => builds.filter(b => b.def === id).length;
  const cmd = c => RTS.command(G, t.id, c);
  if (!hqs.length && !builds.length) return;
  const home = hqs[0] || builds[0];

  // 놀고 있는 일꾼 → 채취. 에테르는 추출기당 3명
  const exts = builds.filter(b => D[b.def].placeOn && RTS.complete(b));
  for (const x of exts) { const n = workers.filter(w => w.order && w.order.type === 'gather' && w.order.node === x.id).length;
    if (n < 3) { const w = workers.find(w => w.order && w.order.type === 'gather' && !G.byId[w.order.node]?.vent && !w.cargo); if (w) RTS.issue(G, w, { type: 'gather', node: x.id }); } }
  for (const w of workers) if (!w.order) { const b = hqs[(w.id) % (hqs.length || 1)] || home, n = RTS.nearestNode(G, b.x, b.y, 'ore', 40); if (n) RTS.issue(G, w, { type: 'gather', node: n.id }); }

  const wantWorkers = Math.min(diff.maxWorkers, 16 * Math.max(1, hqs.length));
  for (const b of hqs) if (workers.length + b.prod.length < wantWorkers && !b.prod.length && RTS.canPay(t, D[f.worker].cost)) cmd({ type: 'train', building: b.id, unit: f.worker });

  const sites = builds.filter(b => !RTS.complete(b));
  const builder = () => workers.find(w => w.order && w.order.type === 'gather' && w.order.phase !== 'mine' && !w.cargo) || workers.find(w => !w.order || w.order.type === 'gather');
  const place = (id, near) => {
    const w = builder(); if (!w || !RTS.canPay(t, D[id].cost)) return false;
    const spot = RTS.aiSpot(G, t, id, near || home); if (!spot) return false;
    cmd({ type: 'place', ids: [w.id], def: id, tx: spot.x, ty: spot.y }); return true;
  };
  // 공사 중 건물에 일꾼이 없으면 다시 붙인다 (건설자가 죽은 경우)
  for (const s of sites) { const has = units.some(u => u.order && u.order.type === 'build' && u.order.site === s.id); if (!has && !s.active) { const w = builder(); if (w) RTS.issue(G, w, { type: 'build', site: s.id }); } }

  // 보급
  if (t.cap - t.sup < 4 + t.have[f.hq] * 1 + (army.length > 15 ? 4 : 0) && t.cap < RTS.cfg(G).supplyCap && !sites.some(s => s.def === f.supply)) place(f.supply);
  else {
    // 빌드 오더: 앞에서부터 처음 미충족 항목 하나만 실행
    for (const step of P.build) {
      if (G.tick < (step.after || 0) * RTS.HZ) break;
      if (count(step.b) >= step.n) continue;
      if (RTS.techOk(t, D[step.b])) place(step.b);
      break;
    }
  }
  // 확장
  const mineral = G.ents.filter(e => e.def === 'ore_node').length;
  if (G.tick > diff.expandAt * RTS.HZ && !sites.some(s => s.def === f.hq) && count(f.hq) < 3 && t.res.ore > D[f.hq].cost.ore && mineral) {
    const free = G.bases.filter(b => !G.ents.some(e => D[e.def].kind === 'building' && !e.dead && Math.hypot(e.x - b.x, e.y - b.y) < 7) && RTS.nearestNode(G, b.x, b.y, 'ore', 12));
    free.sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y));
    if (free[0]) { const w = builder(), d = D[f.hq]; if (w) cmd({ type: 'place', ids: [w.id], def: f.hq, tx: Math.round(free[0].x - d.size[0] / 2), ty: Math.round(free[0].y - d.size[1] / 2) }); }
  }
  RTS.aiDiplomacy(G, t, diff, units);
  if (RTS.aiTribe) RTS.aiTribe(G, t, diff, units);
  // 투자는 생산보다 먼저 판단해 병력에 자금이 전부 묶이지 않게 한다
  RTS.aiInvest(G, t, diff, workers.length >= Math.min(wantWorkers, 14));
  // 생산
  for (const b of builds) {
    const d = D[b.def]; if (S.saving || !RTS.complete(b) || b.prod.length || !d.trains || d.dropoff) continue;
    const opts = P.army.filter(a => d.trains.includes(a.u) && RTS.techOk(t, D[a.u]) && RTS.canPay(t, D[a.u].cost));
    if (!opts.length) continue;
    let total = opts.reduce((s, o) => s + o.w, 0), r = RTS.rand(G) * total, pick = opts[0];
    for (const o of opts) { r -= o.w; if (r <= 0) { pick = o; break; } }
    if (t.sup + (D[pick.u].supply || 0) <= t.cap) cmd({ type: 'train', building: b.id, unit: pick.u });
  }
  // 연구
  for (const id of P.research) {
    if (t.upgrades[id] || t.research[id]) continue;
    const u = RTS.defs.upgrades[id], lab = builds.find(b => (D[b.def].researches || []).includes(id) && RTS.complete(b) && !b.prod.length);
    if (lab && RTS.techOk(t, u) && RTS.canPay(t, u.cost) && t.res.ore > u.cost.ore + 100) cmd({ type: 'research', building: lab.id, upgrade: id });
    break;
  }
  // 교전 판단
  for (const u of army) for (const id of D[u.def].abilities || []) { const ab = RTS.defs.abilities[id]; if (ab.ai && RTS.abilityReady(G, u, ab)) ab.ai(G, u); }
  let threat = null;
  for (const b of builds) { RTS.query(G, b.x, b.y, 9, o => { if (!threat && !o.dead && RTS.foe(G, t.id, o.team) && D[o.def].kind === 'unit') threat = o; }); if (threat) break; }
  const ids = army.map(u => u.id);
  S.wave = S.wave || diff.waveSize;
  if (threat && !S.attacking) { cmd({ type: 'order', ids: ids.filter(i => { const o = G.byId[i].order; return !o || o.type !== 'amove' || Math.hypot(o.x - threat.x, o.y - threat.y) > 6; }), order: { type: 'amove', x: threat.x, y: threat.y } }); S.defending = G.tick; return; }
  if (G.tick - (S.defending || -999) > 100 && !S.attacking && !threat) { // 집결
    const r = S.rally || (S.rally = (() => { const c = { x: G.w / 2, y: G.h / 2 }; const k = 11 / Math.max(1, Math.hypot(c.x - home.x, c.y - home.y)); return RTS.nearestFree(G, home.x + (c.x - home.x) * k, home.y + (c.y - home.y) * k); })());
    const idle = army.filter(u => !u.order && Math.hypot(u.x - r.x, u.y - r.y) > 5).map(u => u.id);
    if (idle.length) cmd({ type: 'order', ids: idle, order: { type: 'amove', x: r.x, y: r.y } });
  }
  if (!S.attacking && army.length >= S.wave && G.tick > diff.firstAttack * RTS.HZ) { S.attacking = true; S.sent = army.length; S.wave = Math.min(40, S.wave + diff.waveGrow); }
  if (S.attacking) {
    if (army.length < Math.max(3, S.sent * .3)) { S.attacking = false; return; }
    let goal = null, bd = 1e12;
    for (const e of G.ents) { if (e.dead || e.team < 0 || !RTS.foe(G, t.id, e.team) || D[e.def].kind !== 'building' || D[e.def].site) continue; const d = (e.x - home.x) ** 2 + (e.y - home.y) ** 2; if (d < bd) { bd = d; goal = e; } }
    if (goal) { const go = army.filter(u => !u.order || u.order.type !== 'amove' || Math.hypot(u.order.x - goal.x, u.order.y - goal.y) > 3).map(u => u.id);
      if (go.length) cmd({ type: 'order', ids: go, order: { type: 'amove', x: goal.x, y: goal.y } }); }
  }
};
RTS.aiSpot = function (G, t, id, near) {
  const d = RTS.defs.entities[id];
  if (d.placeOn) { let best = null, bd = 1e9; for (const e of G.ents) { if (e.def !== d.placeOn || e.ext || e.dead) continue; const q = Math.hypot(e.x - near.x, e.y - near.y); if (q < bd && q < 14) { bd = q; best = { x: Math.round(e.x - 1), y: Math.round(e.y - 1) }; } } return best; }
  const cx = near.x | 0, cy = near.y | 0, c = { x: G.w / 2, y: G.h / 2 };
  const dir = Math.atan2(c.y - cy, c.x - cx);
  for (let r = 5; r < 16; r += 1) for (let k = 0; k < 12; k++) {
    const a = dir + ((k % 2 ? 1 : -1) * Math.ceil(k / 2)) * .42, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
    if (!RTS.canPlace(G, t.id, id, x, y, 1)) continue;
    if (RTS.nearestNode(G, x + 1, y + 1, 'ore', 3.5) || RTS.nearestNode(G, x + 1, y + 1, 'gas', 3.5)) continue;
    return { x, y };
  }
  return null;
};
