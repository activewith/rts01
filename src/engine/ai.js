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
// ── 전략(작전) ──────────────────────────────────────────────
// 게임 시작 때 AI마다 하나를 무작위로 고른다(난이도의 plans 가중치). 수치는 난이도 기준값에 곱한다.
// attack: 첫 공격 시각, wave: 공격 규모, expand: 첫 확장 시각, workers: 일꾼 목표, t1/t2: 에테르 없는 유닛 / 에테르 유닛 생산 비중
RTS.AI_PLANS = {
  rush:   { name: '속공', attack: .55, wave: .8, expand: 1.3, workers: .8, t1: 2.4, t2: .35, delayTech: true, pressure: true },
  expand: { name: '확장-발전', attack: 1.3, wave: 1.7, expand: .3, workers: 1.2, t1: .6, t2: 1.8, techFirst: true, guardExpo: true },
  timing: { name: '타이밍 공격', attack: .9, wave: 1.1, expand: .6, workers: 1, t1: 1, t2: 1 },
};
RTS.aiPlan = function (G, t, diff) {
  const S = t.aiState; if (S.plan) return RTS.AI_PLANS[S.plan];
  const w = diff.plans || { timing: 1 }, keys = Object.keys(w).filter(k => w[k] > 0), tot = keys.reduce((a, k) => a + w[k], 0);
  let r = RTS.rand(G) * tot; S.plan = keys[keys.length - 1]; for (const k of keys) { r -= w[k]; if (r <= 0) { S.plan = k; break; } }
  return RTS.AI_PLANS[S.plan];
};
// 전투력 어림값: 체력 × 초당 피해(무기 없으면 작게). 교전 판단·후퇴에만 쓴다.
const powOf = (G, e) => { const d = RTS.defOf(e), w = RTS.weapon(e); return Math.max(0, e.hp) * (w ? Math.max(1, (w.damage || 1) * (w.splash ? 1.5 : 1) / (w.cooldown || 1)) : .3); };
const centroid = us => { let x = 0, y = 0; for (const u of us) { x += u.x; y += u.y; } return { x: x / us.length, y: y / us.length }; };
const pathLen = (G, a, b) => { const p = RTS.findPath(G, a.x, a.y + 3, { x: b.x, y: b.y }); if (!p.length) return 1e9; const l = p[p.length - 1]; if (Math.hypot(l[0] - b.x, l[1] - b.y) > 6) return 1e9;
  let s = 0, px = a.x, py = a.y; for (const q of p) { s += Math.hypot(q[0] - px, q[1] - py); px = q[0]; py = q[1]; } return s; };

RTS.aiThink = function (G, t) {
  const diff = RTS.aiDiff(t);
  if ((G.tick + t.id * 3) % diff.interval) return;
  const f = RTS.defs.factions[t.faction], P = f.ai, S = t.aiState, D = RTS.defs.entities, plan = RTS.aiPlan(G, t, diff), sec = G.tick / RTS.HZ;
  const mine = G.ents.filter(e => e.team === t.id && !e.dead);
  const builds = mine.filter(e => D[e.def].kind === 'building' && !D[e.def].site), units = mine.filter(e => D[e.def].kind === 'unit');
  const harass = new Set(S.harass || []);
  const workers = units.filter(e => D[e.def].gather), allArmy = units.filter(e => !D[e.def].gather && !D[e.def].uncontrollable && e.id !== S.scout && e.id !== S.tScout && e.id !== S.tScoutM);
  const army = allArmy.filter(u => !harass.has(u.id));
  const hqs = builds.filter(e => D[e.def].dropoff && RTS.complete(e));
  const count = id => builds.filter(b => b.def === id).length;
  const cmd = c => RTS.command(G, t.id, c);
  if (!hqs.length && !builds.length) return;
  const home = G.byId[S.home] && !G.byId[S.home].dead ? G.byId[S.home] : (hqs[0] || builds[0]); S.home = home.id;
  const extId = (P.build.find(s => D[s.b].placeOn) || {}).b;
  // 난이도 하한: 왕초보·쉬움은 작전이 바뀌어도 첫 공격이 너무 이르거나 확장이 너무 빠르지 않다
  const atkMul = Math.max(plan.attack, diff.attackMin || 0), expMul = Math.max(plan.expand, diff.expandMin || 0);
  const firstAttack = diff.firstAttack * atkMul;

  // 놀고 있는 일꾼 → 채취. 에테르는 추출기당 3명. 일꾼은 일꾼이 가장 적은 사령부 쪽 광맥으로 보낸다
  const near = (w, b, r) => Math.hypot(w.x - b.x, w.y - b.y) < r;
  const gatherAt = b => workers.filter(w => w.order && w.order.type === 'gather' && G.byId[w.order.node] && near(G.byId[w.order.node], b, 11)).length;
  const exts = builds.filter(b => D[b.def].placeOn && RTS.complete(b));
  for (const x of exts) { const n = workers.filter(w => w.order && w.order.type === 'gather' && w.order.node === x.id).length;
    if (n < 3) { const w = workers.filter(w => w.order && w.order.type === 'gather' && !G.byId[w.order.node]?.vent && !w.cargo).sort((a, b) => Math.hypot(a.x - x.x, a.y - x.y) - Math.hypot(b.x - x.x, b.y - x.y))[0]; if (w) RTS.issue(G, w, { type: 'gather', node: x.id }); } }
  const load = hqs.map(b => ({ b, n: gatherAt(b), node: RTS.nearestNode(G, b.x, b.y, 'ore', 11) }));
  for (const w of workers) if (!w.order) { const L = load.filter(o => o.node).sort((a, b) => a.n - b.n)[0], b = L ? L.b : home, n = RTS.nearestNode(G, b.x, b.y, 'ore', 40); if (n) { RTS.issue(G, w, { type: 'gather', node: n.id }); if (L) L.n++; } }
  // 사령부 사이 일꾼 옮기기: 한쪽이 붐비고 다른 쪽(광맥 남음)이 비면 4명씩 보낸다
  if (load.length > 1) { load.sort((a, b) => a.n - b.n); const lo = load[0], hi = load[load.length - 1];
    if (lo.node && hi.n - lo.n > 6) { let k = 0; for (const w of workers) { if (k >= 4) break; const nd = w.order && w.order.type === 'gather' && G.byId[w.order.node]; if (!nd || nd.vent || w.cargo || !near(nd, hi.b, 11)) continue; RTS.issue(G, w, { type: 'gather', node: lo.node.id }); k++; } } }

  const wantWorkers = Math.min(Math.round(diff.maxWorkers * (plan.delayTech && S.rushDone ? 1 : plan.workers) * (1 + (diff.perBase || .5) * (hqs.length - 1))), 16 * Math.max(1, hqs.length) + 3 * exts.length);
  if (plan.delayTech && !S.rushDone && S.attackAt && G.tick - S.attackAt > 100 * RTS.HZ) S.rushDone = true; // 속공 창은 첫 공격 뒤 100초까지
  const rushHold = plan.delayTech && !S.rushDone && workers.length >= Math.round(diff.maxWorkers * plan.workers);
  for (const b of hqs) if (!rushHold && workers.length + b.prod.length < wantWorkers && !b.prod.length && RTS.canPay(t, D[f.worker].cost)) cmd({ type: 'train', building: b.id, unit: f.worker });

  const sites = builds.filter(b => !RTS.complete(b));
  const builder = (at) => { const ok = workers.filter(w => (w.order && w.order.type === 'gather' && w.order.phase !== 'mine' && !w.cargo) || !w.order); if (!ok.length) return workers.find(w => !w.order || w.order.type === 'gather');
    if (!at) return ok[0]; return ok.sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y))[0]; };
  const place = (id, nearB) => {
    const at = nearB || home, w = builder(at); if (!w || !RTS.canPay(t, D[id].cost)) return false;
    const spot = RTS.aiSpot(G, t, id, at); if (!spot) return false;
    cmd({ type: 'place', ids: [w.id], def: id, tx: spot.x, ty: spot.y }); return true;
  };
  // 공사 중 건물에 일꾼이 없으면 다시 붙인다 (건설자가 죽은 경우)
  for (const s of sites) { const has = units.some(u => u.order && u.order.type === 'build' && u.order.site === s.id); if (!has && !s.active) { const w = builder(s); if (w) RTS.issue(G, w, { type: 'build', site: s.id }); } }

  // 위협: 내 건물 9칸 안의 적 유닛
  let threat = null, threatPow = 0;
  for (const b of builds) RTS.query(G, b.x, b.y, 9, o => { if (!o.dead && RTS.foe(G, t.id, o.team) && D[o.def].kind === 'unit' && Math.hypot(o.x - b.x, o.y - b.y) < 10) { if (!threat) threat = o; threatPow += powOf(G, o); } });

  // 위기 판단: 상대 전투 병력이 내 1.3배 이상이면(5기 이상) 투자·연구·확장 저축을 멈추고 병력과 방어탑에 쓴다. AI는 안개를 무시한다.
  if ((G.tick + t.id) % (diff.interval * 3) < diff.interval) { let ep = 0, mp = 0, en = 0;
    for (const e of G.ents) { if (e.dead || D[e.def].kind !== 'unit' || D[e.def].gather || e.team < 0) continue; if (e.team === t.id) mp += powOf(G, e); else if (RTS.foe(G, t.id, e.team)) { ep += powOf(G, e); en++; } }
    S.danger = en >= 5 && ep > mp * 1.3 && sec < 900; }
  // ── 확장 ── 작전이 정한 시각이 되거나 일꾼이 꽉 차면 사령부 값을 모은다(그동안 병력 생산을 멈춘다)
  const hqSite = sites.some(s => s.def === f.hq), maxBases = diff.bases || 3;
  const nextAt = (S.expands || 0) === 0 ? diff.expandAt * expMul : (S.lastExpand || 0) / RTS.HZ + diff.expandAt * .45 * Math.max(.6, expMul * 1.5);
  const saturated = workers.length >= wantWorkers - 1 && hqs.length * 16 <= workers.length + 2 && sec > diff.expandAt * expMul * .7;
  const wantExpand = !S.danger && !hqSite && count(f.hq) < maxBases && (sec >= nextAt || saturated) && (!threat || threatPow < 400) && G.tick >= (S.expandWait || 0) && !(plan.delayTech && !S.rushDone && sec < diff.expandAt);
  S.saveHq = false;
  if (wantExpand) {
    if (!S.expoPick || G.tick - (S.expoPickAt || 0) > 30 * RTS.HZ || !G.bases[S.expoPick - 1]) {
      const free = G.bases.map((b, i) => ({ b, i })).filter(({ b }) => !G.ents.some(e => !e.dead && (D[e.def].kind === 'building' || (e.team >= 0 && e.team !== t.id && D[e.def].kind === 'unit')) && Math.hypot(e.x - b.x, e.y - b.y) < (e.team === t.id || e.team < 0 ? 7 : 12)) && RTS.nearestNode(G, b.x, b.y, 'ore', 12));
      const enemyHq = G.ents.filter(e => !e.dead && e.team >= 0 && RTS.foe(G, t.id, e.team) && D[e.def].dropoff);
      for (const o of free) { const dEnemy = Math.min(1e9, ...enemyHq.map(e => Math.hypot(e.x - o.b.x, e.y - o.b.y))); o.k = Math.min(...hqs.concat([home]).map(h => Math.hypot(h.x - o.b.x, h.y - o.b.y))) - Math.min(dEnemy, 60) * .35; }
      free.sort((a, b) => a.k - b.k);
      let pick = null; for (const o of free.slice(0, 3)) { if (pathLen(G, home, o.b) < 1e9) { pick = o; break; } }
      S.expoPick = pick ? pick.i + 1 : 0; S.expoPickAt = G.tick;
    }
    const tgt = S.expoPick && G.bases[S.expoPick - 1];
    if (tgt) { const d = D[f.hq];
      if (RTS.canPay(t, d.cost)) { const w = builder(tgt); if (w) { cmd({ type: 'place', ids: [w.id], def: f.hq, tx: Math.round(tgt.x - d.size[0] / 2), ty: Math.round(tgt.y - d.size[1] / 2) }); S.expands = (S.expands || 0) + 1; S.lastExpand = G.tick; S.expoPick = 0; S.saveSince = 0; } }
      else { S.saveHq = true; S.saveSince = S.saveSince || G.tick; if (G.tick - S.saveSince > 70 * RTS.HZ) { S.expandWait = G.tick + 40 * RTS.HZ; S.saveSince = 0; } }
    }
  } else S.saveSince = 0;

  // 보급
  if (t.cap - t.sup < 4 + t.have[f.hq] * 1 + (army.length > 15 ? 4 : 0) && t.cap < RTS.cfg(G).supplyCap && !sites.some(s => s.def === f.supply)) { if (!S.saveHq || t.res.ore > D[f.hq].cost.ore + 100) place(f.supply); }
  else if (!S.saveHq) {
    // 빌드 오더: 앞에서부터 처음 미충족 항목 하나만 실행. 속공은 에테르 건물을 첫 공격 뒤로 미루고 생산 건물을 하나 더 짓는다. 위기면 생산 건물만 늘린다
    const order = S.danger && sec < 480 ? [Object.assign({}, P.build[0], { n: 2 }), Object.assign({}, P.build[0], { n: 3 })] : plan.delayTech && !S.rushDone ? [P.build[0], Object.assign({}, P.build[0], { n: 2 })].concat(P.build.slice(1).filter(s => !(D[s.b].cost.gas > 0))) : P.build;
    for (const step of order) {
      if (G.tick < (step.after || 0) * RTS.HZ * (plan.techFirst ? .8 : 1)) break;
      if (count(step.b) >= step.n) continue;
      if (RTS.techOk(t, D[step.b])) place(step.b);
      break;
    }
    // 확장 기지마다 추출기, 발전형은 확장 기지에 방어탑 하나
    if (hqs.length > 1 && extId && exts.length < hqs.length * 2 && sec > 200) for (const h of hqs) { if (h === home) continue; const v = G.ents.find(e => e.def === 'vent' && !e.ext && !e.dead && near(e, h, 10)); if (v && !sites.some(s => s.def === extId)) { if (place(extId, h)) break; } }
    if ((plan.guardExpo || diff.guardExpo) && f.defense && RTS.techOk(t, D[f.defense]) && t.res.ore > D[f.defense].cost.ore + 120) for (const h of hqs) { if (h === home) continue; if (!builds.some(b => b.def === f.defense && near(b, h, 9))) { if (place(f.defense, h)) break; } }
  }
  RTS.aiDiplomacy(G, t, diff, units);
  if (RTS.aiTribe) RTS.aiTribe(G, t, diff, units);
  // 투자는 생산보다 먼저 판단해 병력에 자금이 전부 묶이지 않게 한다
  if (!S.saveHq && !S.danger) RTS.aiInvest(G, t, diff, workers.length >= Math.min(wantWorkers, 14) && !(plan.delayTech && !S.rushDone));
  // 생산: 작전에 따라 에테르 없는 유닛(t1)과 에테르 유닛(t2) 비중을 바꾼다
  const hold = (S.saving || S.saveHq) && !threat;
  for (const b of builds) {
    const d = D[b.def]; if (hold || !RTS.complete(b) || b.prod.length || !d.trains || d.dropoff) continue;
    const opts = P.army.filter(a => d.trains.includes(a.u) && RTS.techOk(t, D[a.u]) && RTS.canPay(t, D[a.u].cost));
    if (!opts.length) continue;
    const wt = o => o.w * (D[o.u].cost.gas > 0 ? plan.t2 : plan.t1);
    let total = opts.reduce((s, o) => s + wt(o), 0), r = RTS.rand(G) * total, pick = opts[0];
    for (const o of opts) { r -= wt(o); if (r <= 0) { pick = o; break; } }
    if (t.sup + (D[pick.u].supply || 0) * (D[pick.u].count || 1) <= t.cap) cmd({ type: 'train', building: b.id, unit: pick.u });
  }
  // 연구
  if (!hold && !S.danger) for (const id of P.research) {
    if (t.upgrades[id] || t.research[id]) continue;
    const u = RTS.defs.upgrades[id], lab = builds.find(b => (D[b.def].researches || []).includes(id) && RTS.complete(b) && !b.prod.length);
    if (lab && RTS.techOk(t, u) && RTS.canPay(t, u.cost) && t.res.ore > u.cost.ore + (plan.techFirst ? 30 : 100)) cmd({ type: 'research', building: lab.id, upgrade: id });
    break;
  }
  // 교전 판단
  for (const u of allArmy) for (const id of D[u.def].abilities || []) { const ab = RTS.defs.abilities[id]; if (ab.ai && RTS.abilityReady(G, u, ab)) ab.ai(G, u); }
  RTS.aiHarass(G, t, diff, plan, allArmy);
  const ids = army.map(u => u.id);
  S.wave = S.wave || Math.max(3, Math.round(diff.waveSize * plan.wave));
  // 공격 중 본진이 크게 위협받으면 병력을 불러들인다
  if (S.attacking && threat && threatPow > 900 && army.length) { S.attacking = false; S.recall = G.tick; }
  // 방어 보강: 밀리면 일꾼을 끌어와 싸우고(위협이 사라지거나 20초 뒤 채취로 복귀), 이른 시간에는 본진에 방어탑을 세운다
  const pulled = (S.pulled || []).map(id => G.byId[id]).filter(u => u && !u.dead);
  if (pulled.length && (!threat || G.tick - S.pullAt > 20 * RTS.HZ)) { for (const w of pulled) { const n = RTS.nearestNode(G, home.x, home.y, 'ore', 30); if (n) RTS.issue(G, w, { type: 'gather', node: n.id }); } S.pulled = []; }
  if (S.danger && f.defense && sec < 600 && (S.towers || 0) < 2 && G.tick - (S.towerAt || -1e9) > 45 * RTS.HZ && RTS.techOk(t, D[f.defense]) && RTS.canPay(t, D[f.defense].cost)) { if (place(f.defense, home)) { S.towers = (S.towers || 0) + 1; S.towerAt = G.tick; } }
  if (threat && !S.attacking && Math.hypot(threat.x - home.x, threat.y - home.y) < 16) {
    let mp = 0; for (const u of army) if (Math.hypot(u.x - threat.x, u.y - threat.y) < 14) mp += powOf(G, u);
    if (threatPow > mp * 1.3 && !pulled.length) { const ws = workers.filter(w => !w.cargo || true).sort((a, b) => Math.hypot(a.x - threat.x, a.y - threat.y) - Math.hypot(b.x - threat.x, b.y - threat.y)).slice(0, Math.min(8, Math.floor(workers.length * .6)));
      if (ws.length) { S.pulled = ws.map(w => w.id); S.pullAt = G.tick; cmd({ type: 'order', ids: S.pulled, order: { type: 'amove', x: threat.x, y: threat.y } }); } }
    if (f.defense && sec < 600 && (S.towers || 0) < 2 && G.tick - (S.towerAt || -1e9) > 60 * RTS.HZ && RTS.techOk(t, D[f.defense]) && RTS.canPay(t, D[f.defense].cost)) { if (place(f.defense, home)) { S.towers = (S.towers || 0) + 1; S.towerAt = G.tick; } }
  }
  if (threat && !S.attacking) { cmd({ type: 'order', ids: ids.filter(i => { const o = G.byId[i].order; return !o || o.type !== 'amove' || Math.hypot(o.x - threat.x, o.y - threat.y) > 6; }), order: { type: 'amove', x: threat.x, y: threat.y } }); S.defending = G.tick; return; }
  const rally = () => S.rally || (S.rally = (() => { const c = { x: G.w / 2, y: G.h / 2 }; const k = 11 / Math.max(1, Math.hypot(c.x - home.x, c.y - home.y)); return RTS.nearestFree(G, home.x + (c.x - home.x) * k, home.y + (c.y - home.y) * k); })());
  if (G.tick - (S.defending || -999) > 100 && !S.attacking && !threat) { // 집결
    const r = rally(), idle = army.filter(u => (!u.order || (S.retreat && G.tick - S.retreat < 30)) && Math.hypot(u.x - r.x, u.y - r.y) > 5).map(u => u.id);
    if (idle.length) cmd({ type: 'order', ids: idle, order: { type: S.retreat && G.tick - S.retreat < 200 ? 'move' : 'amove', x: r.x, y: r.y } });
  }
  if (!S.attacking && army.length >= S.wave && G.tick > firstAttack * RTS.HZ && G.tick - (S.retreat || -1e9) > 25 * RTS.HZ) {
    S.attacking = true; S.sent = army.length; S.attackAt = G.tick; S.wave = Math.min(45, S.wave + Math.max(1, Math.round(diff.waveGrow * plan.wave)));
    // 적 팀이 여럿이면(중립세력) 공격 대상을 공격마다 번갈아 정한다. 가까운 쪽만 계속 때리지 않게 한다
    const foes = G.teams.filter(o => o.id !== t.id && RTS.foe(G, t.id, o.id) && o.alive > 0); S.waves = (S.waves || 0) + 1; S.tgt = foes.length ? foes[S.waves % foes.length].id : -1;
    S.mode = RTS.aiPickMode(G, t, plan, army.length); S.goal = null; S.grp2 = null;
  }
  if (S.attacking) {
    if (army.length < Math.max(3, S.sent * .3)) { S.attacking = false; if (plan.delayTech) S.rushDone = true; return; }
    const tg = S.tgt !== undefined && S.tgt >= 0 && G.teams[S.tgt] && G.teams[S.tgt].alive > 0 ? S.tgt : -1;
    const c = centroid(army);
    // 후퇴: 교전 지점에서 상대 전투력이 내 1.6배를 넘고 병력이 절반 가까이 줄었으면 집결지로 물러난다(속공 압박 중에는 버틴다)
    if (G.tick - S.attackAt > 8 * RTS.HZ) { let mp = 0, ep = 0; for (const u of army) if (Math.hypot(u.x - c.x, u.y - c.y) < 10) mp += powOf(G, u);
      RTS.query(G, c.x, c.y, 11, o => { if (!o.dead && RTS.foe(G, t.id, o.team) && (D[o.def].kind === 'unit' || RTS.weapon(o)) && Math.hypot(o.x - c.x, o.y - c.y) < 11) ep += powOf(G, o); });
      if (ep > mp * 1.6 && army.length < S.sent * (plan.pressure && !S.rushDone ? .4 : .65)) { S.attacking = false; S.retreat = G.tick; if (plan.delayTech) S.rushDone = true; const r = rally(); cmd({ type: 'order', ids, order: { type: 'move', x: r.x, y: r.y } }); return; } }
    const goalOk = g => g && g.id ? (G.byId[g.id] && !G.byId[g.id].dead) : g && G.tick - g.at < 25 * RTS.HZ && !(Math.hypot(c.x - g.x, c.y - g.y) < 4);
    if (!goalOk(S.goal)) S.goal = RTS.aiGoal(G, t, S.mode, tg, c, home);
    if (S.grp2 && !goalOk(S.goal2)) S.goal2 = RTS.aiGoal(G, t, 'expo', tg, c, home) || S.goal;
    const g1 = S.goal; if (!g1) { S.attacking = false; return; }
    const two = S.mode === 'split' && army.length >= 10;
    if (two && !S.grp2) { const sorted = army.slice().sort((a, b) => a.id - b.id); S.grp2 = sorted.filter((u, i) => i % 5 < 2).map(u => u.id); S.goal2 = RTS.aiGoal(G, t, 'expo', tg, c, home) || g1; }
    const g2s = new Set(two ? S.grp2 : []);
    const send = (us, g) => { const go = us.filter(u => !u.order || u.order.type !== 'amove' || Math.hypot(u.order.x - g.x, u.order.y - g.y) > 3).map(u => u.id); if (go.length) cmd({ type: 'order', ids: go, order: { type: 'amove', x: g.x, y: g.y } }); };
    send(army.filter(u => !g2s.has(u.id)), g1); if (two && S.goal2) send(army.filter(u => g2s.has(u.id)), S.goal2);
  }
};
// 공격 방식: main 가장 가까운 건물, expo 확장 기지, split 두 갈래(본대 + 확장 기지), workers 일꾼 습격
RTS.aiPickMode = function (G, t, plan, n) {
  const opts = [['main', 3], ['expo', 2], ['split', n >= 12 ? 2 : 0], ['workers', plan.pressure ? 3 : 1.5]].filter(o => o[1] > 0);
  let r = RTS.rand(G) * opts.reduce((s, o) => s + o[1], 0); for (const o of opts) { r -= o[1]; if (r <= 0) return o[0]; } return 'main';
};
RTS.aiGoal = function (G, t, mode, tg, from, home) {
  const D = RTS.defs.entities, foeB = G.ents.filter(e => !e.dead && e.team >= 0 && RTS.foe(G, t.id, e.team) && (tg < 0 || e.team === tg) && D[e.def].kind === 'building' && !D[e.def].site);
  if (!foeB.length) return null;
  const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2, near = (L, p) => L.slice().sort((a, b) => d2(a, p) - d2(b, p))[0];
  const hqs = foeB.filter(e => D[e.def].dropoff);
  if (mode === 'expo' && hqs.length > 1) { const main = hqs.slice().sort((a, b) => a.id - b.id)[0]; const ex = near(hqs.filter(h => h !== main), home); if (ex) return { id: ex.id, x: ex.x, y: ex.y }; }
  if (mode === 'workers' && hqs.length) { const h = near(hqs, home); let x = 0, y = 0, n = 0;
    for (const e of G.ents) if (!e.dead && e.team === h.team && D[e.def].gather && Math.hypot(e.x - h.x, e.y - h.y) < 10) { x += e.x; y += e.y; n++; }
    if (n >= 3) return { x: x / n, y: y / n, at: G.tick }; return { id: h.id, x: h.x, y: h.y }; }
  const b = near(foeB, from || home); return { id: b.id, x: b.x, y: b.y };
};
// 견제: 보통 이상에서 빠른 유닛(공중 우선) 3~4기를 상대 일꾼 쪽으로 보낸다. 40초 뒤 또는 반 이상 잃으면 돌아온다.
RTS.aiHarass = function (G, t, diff, plan, allArmy) {
  const S = t.aiState, D = RTS.defs.entities, sec = G.tick / RTS.HZ; if (!diff.harass) return;
  const cur = (S.harass || []).map(id => G.byId[id]).filter(u => u && !u.dead);
  if (cur.length) { if (G.tick - S.harassAt > 40 * RTS.HZ || cur.length < Math.ceil(S.harassN / 2)) { S.harass = []; S.nextHarass = G.tick + (70 + RTS.rand(G) * 40) * RTS.HZ; } else S.harass = cur.map(u => u.id); return; }
  S.harass = [];
  if (sec < diff.firstAttack * .8 || G.tick < (S.nextHarass || 0) || S.attacking || allArmy.length < 10) return;
  const fast = allArmy.filter(u => RTS.weapon(u)).sort((a, b) => (D[b.def].air ? 2 : 0) + (D[b.def].speed || 0) - (D[a.def].air ? 2 : 0) - (D[a.def].speed || 0)).slice(0, 4);
  const g = RTS.aiGoal(G, t, 'workers', -1, null, G.byId[S.home] || fast[0]); if (!g || fast.length < 3) return;
  S.harass = fast.map(u => u.id); S.harassN = fast.length; S.harassAt = G.tick;
  RTS.command(G, t.id, { type: 'order', ids: S.harass, order: { type: 'amove', x: g.x, y: g.y } });
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
    if (G.elev && RTS.nearRampTile(G, x + d.size[0] / 2, y + d.size[1] / 2, 3 + Math.max(...d.size) / 2)) continue; // 경사로 둘레는 비운다
    if (!RTS.stillOpen(G, near, x, y, d.size[0], d.size[1])) continue; // 기지 출구를 막는 자리는 쓰지 않는다
    return { x, y };
  }
  return null;
};

RTS.nearRampTile = function (G, cx, cy, r) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (x >= 0 && y >= 0 && x < G.w && y < G.h && (G.elev[y * G.w + x] & 3)) return true;
  return false;
};
// 건물을 (x,y,w,h)에 놓아도 기지에서 맵 가운데까지 걸어갈 수 있는지(4방향 범람 채우기). 막히면 false.
const FF = { n: 0 };
RTS.stillOpen = function (G, from, x, y, w, h) {
  const W = G.w, N = W * G.h; if (FF.n !== N) { FF.n = N; FF.m = new Int32Array(N); FF.q = new Int32Array(N); FF.g = 0; }
  const g = ++FF.g, M = FF.m, Q = FF.q, blocked = i => { const tx = i % W, ty = (i / W) | 0; return (tx >= x && tx < x + w && ty >= y && ty < y + h) || !RTS.walkable(G, tx, ty); };
  const goal = RTS.nearestFree(G, G.w / 2, G.h / 2, 20), gi = Math.floor(goal.y) * W + Math.floor(goal.x);
  const s = RTS.nearestFree(G, from.x, from.y + (RTS.defs.entities[from.def] ? RTS.defs.entities[from.def].size[1] / 2 + 1 : 0), 6); let qh = 0, qt = 0;
  const si = Math.floor(s.y) * W + Math.floor(s.x); if (blocked(si)) return true; M[si] = g; Q[qt++] = si;
  while (qh < qt) { const i = Q[qh++]; if (i === gi) return true; const tx = i % W;
    if (tx > 0 && M[i - 1] !== g && !blocked(i - 1)) { M[i - 1] = g; Q[qt++] = i - 1; }
    if (tx < W - 1 && M[i + 1] !== g && !blocked(i + 1)) { M[i + 1] = g; Q[qt++] = i + 1; }
    if (i >= W && M[i - W] !== g && !blocked(i - W)) { M[i - W] = g; Q[qt++] = i - W; }
    if (i < N - W && M[i + W] !== g && !blocked(i + W)) { M[i + W] = g; Q[qt++] = i + W; } }
  return false;
};
