// war.js — 기지 전투의 경제 효과. 사령부 반경 안의 건물과 일꾼이 맞으면 피해액을 계산한다.
// 피해액 = 잃은 건물·일꾼 가치 × 기지 등급(본진/위성) × 자원 가중.
// 결과: 그 기지 채취 효율 하락, 진영 신용 하락(배당 감소), 증시 하락, 공급 차질 특수, 공격자 약탈.
RTS.WAR = { radius: 14, richFull: 6000, workerValue: 50, newsMin: 150 };
const costValue = d => { const c = d.cost || {}; return (c.ore || 0) + (c.gas || 0) * 2; };
RTS.initWar = G => { G.war = { bases: {}, pending: {}, supply: { ore: 0, gas: 0 }, newsAt: {} }; for (const t of G.teams) { t.credit = 1; t.stats.warLoss = 0; t.stats.loot = 0; } };
RTS.baseOf = function (G, e) { // e가 속한 기지(가장 가까운 사령부). 반경 밖이면 null
  if (!G.war) RTS.initWar(G); let best = null, bd = RTS.WAR.radius;
  for (const id of Object.keys(G.war.bases)) { const b = G.war.bases[id], h = G.byId[id]; if (!h || h.team !== e.team) continue; const q = Math.hypot(h.x - e.x, h.y - e.y); if (q < bd) { bd = q; best = b; } }
  return best;
};
RTS.baseGrade = function (G, b) { const C = RTS.cfg(G); return (b.main ? C.warMain : C.warSat) / 100 * (1 + C.warRes / 100 * Math.min(1, b.res / RTS.WAR.richFull)); };
RTS.baseEff = function (G, drop) { const b = G.war && G.war.bases[drop.id]; return b ? b.eff : 1; };
RTS.warDamage = function (G, t, lost, src) {
  if (!src || src.team === t.team || src.team < 0 || lost <= 0) return; const d = RTS.defOf(t);
  const base = d.kind === 'building' ? costValue(d) : d.gather ? RTS.WAR.workerValue : 0; if (!base) return;
  if (!G.war) RTS.initWar(G);
  const b = RTS.baseOf(G, t), C = RTS.cfg(G), grade = b ? RTS.baseGrade(G, b) : C.warSat / 100, loss = base * Math.min(1, lost / d.hp) * grade, team = G.teams[t.team];
  team.stats.warLoss = (team.stats.warLoss || 0) + loss; G.war.pending[t.team] = (G.war.pending[t.team] || 0) + loss;
  const att = G.teams[src.team], loot = loss * C.warLoot / 100; att.res.ore += loot; att.stats.loot = (att.stats.loot || 0) + loot;
  if (b) { b.lost += loss; b.lastHit = G.tick; b.eff = Math.max(.3, b.eff - loss * .35 * C.warEff / 100 / Math.max(500, b.value));
    G.war.supply.ore += loss * Math.min(1, b.res / RTS.WAR.richFull); if (b.gas) G.war.supply.gas += loss * .5; }
  team.credit = Math.max(.4, (team.credit ?? 1) - loss * .3 * C.warCredit / 100 / Math.max(1500, G.war.total?.[t.team] || 1500));
};
RTS.systems.splice(RTS.systems.findIndex(s => s.id === 'market'), 0, { id: 'war', run(G) {
  if (!G.war) RTS.initWar(G); if (G.tick % RTS.HZ) return;
  const W = G.war, C = RTS.cfg(G), D = RTS.defs.entities, hqs = G.ents.filter(e => !e.dead && e.team >= 0 && D[e.def].dropoff && RTS.complete(e)), next = {}; W.total = {};
  const mainId = {}; for (const h of hqs) if (!mainId[h.team] || h.id < mainId[h.team]) mainId[h.team] = h.id;
  for (const h of hqs) { const o = W.bases[h.id] || { eff: 1, lost: 0, lastHit: -9999 }; o.team = h.team; o.main = mainId[h.team] === h.id; o.value = 0; o.res = 0; o.gas = 0; o.n = 0; next[h.id] = o; }
  for (const e of G.ents) { if (e.dead) continue; const d = D[e.def]; if (d.kind === 'unit' && !d.gather) continue; if (d.site) continue;
    let best = null, bd = RTS.WAR.radius; for (const h of hqs) { if (e.team >= 0 && h.team !== e.team) continue; const q = Math.hypot(h.x - e.x, h.y - e.y); if (q < bd) { bd = q; best = h; } } if (!best) continue;
    const o = next[best.id]; if (d.resource) { o.res += e.amount || 0; continue; } o.value += d.gather ? RTS.WAR.workerValue : costValue(d); if (d.kind === 'building') o.n++; if (d.placeOn) o.gas = 1; }
  W.bases = next;
  for (const id of Object.keys(next)) { const o = next[id]; W.total[o.team] = (W.total[o.team] || 0) + o.value; if (G.tick - o.lastHit > 10 * RTS.HZ) o.eff = Math.min(1, o.eff + 1 / Math.max(1, C.warRecover)); }
  const cos = Object.values(G.market.cos);
  for (const t of G.teams) { if (G.tick % 20 === 0) t.credit = Math.min(1, (t.credit ?? 1) + .005); const L = W.pending[t.id]; if (!L) continue; W.pending[t.id] = 0;
    const drop = Math.min(.05, L / 8000 * C.warMarket / 100); for (const c of cos) c.price = Math.max(1, c.price * (1 - drop));
    if (L >= RTS.WAR.newsMin && G.tick - (W.newsAt[t.id] || -9999) > 300) { W.newsAt[t.id] = G.tick; RTS.warNews(G, `${t.name} 기지 피해 ${Math.round(L)}: 증시 -${(drop * 100).toFixed(1)}%`); } }
  for (const r of ['ore', 'gas']) { const s = W.supply[r]; if (!s) continue; W.supply[r] = 0; const up = Math.min(.05, s / 3000 * C.warSupply / 100); for (const c of cos) if (RTS.defs.companies[c.id].resource === r) c.earn = Math.min(2.5, c.earn * (1 + up)); }
} });
