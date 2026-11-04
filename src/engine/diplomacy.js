// diplomacy.js — 중립 진영 자유상단. 지부 위치는 게임마다 섞이고, 정찰로 찾아야 거래할 수 있다.
// 동맹 신청은 베팅이다: 동맹금을 걸고 확률 판정을 받으며, 거절되면 동맹금을 잃는다.
RTS.DIP = { min: 100, full: 600, firstBonus: .15, firstOre: 100, failTrust: .05, cooldown: 45, cap: .9, stakeYield: .06, downSec: 60, spread: .2, allySpread: .1, lot: 50 };
RTS.initDip = function (G) {
  const m = G.dip = { list: {}, rate: 2 }, ids = Object.keys(RTS.defs.branches), spots = (G.postSpots || []).slice();
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(RTS.rand(G) * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  ids.forEach((id, i) => { const s = spots[i]; if (!s) return;
    let tx = Math.round(s.x - 1.5), ty = Math.round(s.y - 1.5), ok = false;
    for (let r = 0; r < 10 && !ok; r++) for (let dy = -r; dy <= r && !ok; dy++) for (let dx = -r; dx <= r && !ok; dx++) if (RTS.canPlace(G, -1, 'n_post', tx + dx, ty + dy, 1)) { tx += dx; ty += dy; ok = true; }
    const e = RTS.spawn(G, 'n_post', -1, tx + 1.5, ty + 1.5); e.built = e.buildT; e.hp = RTS.defOf(e).hp; e.branch = id;
    m.list[id] = { id, site: e.id, ally: -1, stake: 0, finder: -1, found: G.teams.map(() => false), trust: G.teams.map(() => 0), wait: G.teams.map(() => 0), lockUntil: 0, nextCaravan: 0 }; });
};
RTS.branchKnown = (G, team, e) => team < 0 || G.nofog || !e.branch || (G.dip.list[e.branch].found[team]);
RTS.tradeSpread = function (G, team) { const D = RTS.DIP, L = Object.values(G.dip.list).filter(b => b.ally === team); if (!L.length) return D.spread; return Math.min(...L.map(b => RTS.defs.branches[b.id].perk.spread ?? D.allySpread)); };
RTS.allyPerk = function (G, team, key) { let v = 0; for (const b of Object.values((G.dip || { list: {} }).list)) if (b.ally === team) v += RTS.defs.branches[b.id].perk[key] || 0; return v; };
RTS.allyChance = function (G, team, id, stake) { const D = RTS.DIP, b = G.dip.list[id], d = RTS.defs.branches[id], k = Math.max(0, Math.min(1, (stake - D.min) / (D.full - D.min)));
  return Math.min(D.cap, d.base + k * .5 + (b.finder === team ? RTS.cfg(G).firstBonus / 100 : 0) + b.trust[team]); };
RTS.allyBlock = function (G, team, id, stake) { const D = RTS.DIP, b = G.dip.list[id], d = RTS.defs.branches[id], t = G.teams[team];
  if (!b.found[team]) return '아직 찾지 못한 지부입니다';
  if (b.ally === team) return '이미 동맹입니다';
  if (b.ally >= 0) return '상대가 먼저 동맹을 맺었습니다';
  if (b.lockUntil > G.tick) return '지부 복구 중입니다';
  if (b.wait[team] > G.tick) return '재신청 대기 ' + Math.ceil((b.wait[team] - G.tick) / RTS.HZ) + '초';
  if (!d.check(G, t)) return '조건 미달: ' + d.need;
  if (stake < D.min) return '동맹금은 최소 ' + D.min + '입니다';
  if (t.res.ore < stake) return '광석이 부족합니다';
  return null; };
const dipTell = (G, team, text, kind) => RTS.emit(G, 'notice', { team, text, kind });
RTS.commands.ally = function (G, team, c) {
  const block = RTS.allyBlock(G, team, c.branch, c.stake); if (block) { dipTell(G, team, block, 'warn'); return; }
  const D = RTS.DIP, b = G.dip.list[c.branch], d = RTS.defs.branches[c.branch], t = G.teams[team], ok = RTS.rand(G) < RTS.allyChance(G, team, c.branch, c.stake);
  const loss = ok ? c.stake : Math.round(c.stake * RTS.cfg(G).rejectLoss / 100); t.res.ore -= loss; b.wait[team] = G.tick + D.cooldown * RTS.HZ;
  if (!ok) { b.trust[team] = Math.min(.25, b.trust[team] + D.failTrust); t.stats.burned = (t.stats.burned || 0) + loss; dipTell(G, team, `${d.name}가 거절했습니다. 동맹금 ${loss} 손실`, 'warn'); RTS.emit(G, 'allyResult', { team, id: b.id, ok }); return; }
  b.ally = team; b.stake = c.stake; b.nextCaravan = G.tick + 20 * RTS.HZ; const e = G.byId[b.site]; e.team = team;
  for (const o of G.teams) dipTell(G, o.id, o.id === team ? `${d.name}와 동맹 성립` : `${t.name}, ${d.name}와 동맹`, o.id === team ? 'ok' : 'market');
  for (let i = 0; i < (d.perk.mercs || 0); i++) { const p = RTS.nearestFree(G, e.x, e.y + 3); RTS.spawn(G, 'n_merc', team, p.x + (i % 3) * .3, p.y + i * .15); }
  RTS.emit(G, 'allyResult', { team, id: b.id, ok });
};
RTS.commands.fund = function (G, team, c) { const b = G.dip.list[c.branch], t = G.teams[team]; if (!b || b.ally !== team) return; if (t.res.ore < c.amount) { dipTell(G, team, '광석이 부족합니다', 'warn'); return; } t.res.ore -= c.amount; b.stake += c.amount; };
RTS.commands.barter = function (G, team, c) { // buy: 광석→에테르, 아니면 에테르→광석
  const D = RTS.DIP, t = G.teams[team], b = G.dip.list[c.branch]; if (!b || !b.found[team] || (b.ally >= 0 && b.ally !== team) || b.lockUntil > G.tick) { dipTell(G, team, '이 지부와는 거래할 수 없습니다', 'warn'); return; }
  const s = RTS.tradeSpread(G, team), rate = G.dip.rate;
  if (c.buy) { const cost = Math.ceil(D.lot * rate * (1 + s)); if (t.res.ore < cost) { dipTell(G, team, '광석이 부족합니다', 'warn'); return; } t.res.ore -= cost; t.res.gas += D.lot; }
  else { if (t.res.gas < D.lot) { dipTell(G, team, '에테르가 부족합니다', 'warn'); return; } t.res.gas -= D.lot; t.res.ore += Math.floor(D.lot * rate * (1 - s)); }
};
RTS.branchDown = function (G, e) { const b = G.dip.list[e.branch], d = RTS.defs.branches[e.branch], was = b.ally;
  if (was >= 0) { for (const o of G.teams) dipTell(G, o.id, `${d.name} 지부 파괴, ${G.teams[was].name}의 동맹 해제`, 'market'); }
  b.ally = -1; b.stake = 0; b.lockUntil = G.tick + RTS.DIP.downSec * RTS.HZ; e.team = -1; e.hp = RTS.defOf(e).hp; e.hitAt = 0; };
RTS.orders.caravan = function (G, u, o) { const drop = RTS.nearestDrop(G, u); if (!drop) { RTS.kill(G, u, null, true); return; }
  if (RTS.edgeDist(u, drop) < .7) { const t = G.teams[u.team]; t.res[o.res] = (t.res[o.res] || 0) + o.amount; t.stats.caravan = (t.stats.caravan || 0) + o.amount; RTS.emit(G, 'caravan', { team: u.team, res: o.res, amount: o.amount }); RTS.kill(G, u, null, true); return; }
  RTS.goTo(G, u, drop); };
RTS.addSystem({ id: 'diplomacy', run(G) {
  if (!G.dip) RTS.initDip(G); if (G.tick % RTS.HZ) return;
  const m = G.dip, cos = Object.values(G.market.cos), avg = r => { const L = cos.filter(c => RTS.defs.companies[c.id].resource === r); return L.reduce((s, c) => s + c.earn, 0) / L.length; };
  m.rate = Math.max(1.2, Math.min(3.2, 2 * avg('gas') / avg('ore')));
  for (const b of Object.values(m.list)) { const e = G.byId[b.site], d = RTS.defs.branches[b.id]; if (!e) continue;
    G.teams.forEach(t => { if (b.found[t.id]) return; let near = false; RTS.query(G, e.x, e.y, 9, o => { if (o.team === t.id && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 9) near = true; }); if (!near) return;
      b.found[t.id] = true; if (b.finder < 0) { b.finder = t.id; t.res.ore += RTS.DIP.firstOre; dipTell(G, t.id, `${d.name} 최초 발견: 광석 +${RTS.DIP.firstOre}, 수락 확률 +${RTS.cfg(G).firstBonus}%`, 'ok'); } else dipTell(G, t.id, d.name + ' 발견', 'ok'); RTS.emit(G, 'found', { team: t.id, id: b.id }); });
    if (b.ally < 0) continue; const t = G.teams[b.ally];
    if (d.perk.caravan && G.tick >= b.nextCaravan) { b.nextCaravan = G.tick + d.perk.caravan.every * RTS.HZ; const p = RTS.nearestFree(G, e.x, e.y + 2.5), u = RTS.spawn(G, 'n_caravan', b.ally, p.x, p.y); u.order = { type: 'caravan', res: d.perk.caravan.res, amount: d.perk.caravan.amount }; }
    if (G.tick % (30 * RTS.HZ) === 0) { const pay = b.stake * RTS.cfg(G).stakeYield / 100; t.res.ore += pay; t.stats.div = (t.stats.div || 0) + pay; } }
} }, { before: 'cleanup' });
// AI: 난이도별 시점에 정찰을 보내고, 조건이 맞으면 동맹금을 건다.
RTS.aiDiplomacy = function (G, t, diff, units) {
  const S = t.aiState, m = G.dip, sec = G.tick / RTS.HZ; if (!m || sec < diff.scoutAt || !units.length) return;
  if (!S.scout || !G.byId[S.scout]) { const open = Object.values(m.list).filter(b => !b.found[t.id] && b.ally < 0).sort((a, b) => { const A = G.byId[a.site], B = G.byId[b.site], H = units[0]; return Math.hypot(A.x - H.x, A.y - H.y) - Math.hypot(B.x - H.x, B.y - H.y); })[0];
    const u = units.find(x => !RTS.defOf(x).gather && !RTS.defOf(x).uncontrollable && !RTS.defOf(x).heal) || units.find(x => RTS.defOf(x).gather && x.order && x.order.phase === 'go');
    if (open && u) { S.scout = u.id; S.scoutTo = open.id; const e = G.byId[open.site]; RTS.issue(G, u, { type: 'move', x: e.x, y: e.y + 3 }); } }
  else if (S.scoutTo && m.list[S.scoutTo].found[t.id]) { S.scout = 0; S.scoutTo = null; }
  // 신청 가능한 지부가 있으면 병력 생산을 잠시 줄여 동맹금을 모은다
  const army = units.filter(u => !RTS.defOf(u).gather && !RTS.defOf(u).uncontrollable).length, mine = Object.values(m.list).filter(b => b.ally === t.id).length;
  // 병력이 먼저다. 교전 중이거나 병력이 적으면 돈을 묶지 않고, AI 동맹은 두 곳까지만 맺는다
  if (army < diff.allyArmy || mine >= 2 || S.attacking || G.tick - (S.defending || -9999) < 200) { S.saving = false; return; }
  const target = Object.values(m.list).find(b => { const why = RTS.allyBlock(G, t.id, b.id, diff.stake); return !why || why === '광석이 부족합니다'; });
  S.saving = !!target && G.tick >= (S.nextAlly || 0);
  if (!S.saving || t.res.ore < diff.stake) return;
  S.nextAlly = G.tick + 70 * RTS.HZ; S.saving = false;
  RTS.command(G, t.id, { type: 'ally', branch: target.id, stake: diff.stake });
};
