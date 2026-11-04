// market.js — 공유 주식시장. 회사 4곳, 총 100주씩, 나와 AI가 같은 물량을 두고 경쟁한다.
// 주가: 평균회귀 + 무작위 변동 + 매매 충격. 배당: 30초마다 실적에 비례. 51주 이상이면 경영권.
RTS.MARKET = { shares: 100 }; // 나머지 수치는 설정 메뉴(RTS.cfg)에서 온다
RTS.initMarket = function (G) {
  const m = G.market = { cos: {}, news: [], nextEvent: 45 * RTS.HZ, nextDiv: G.cfg.divSec * RTS.HZ };
  Object.values(RTS.defs.companies).forEach((c, i) => {
    const s = G.siteSpots[i], d = RTS.defs.entities[c.site]; let site = 0;
    if (s) { let tx = Math.round(s.x - 1.5), ty = Math.round(s.y - 1.5), ok = false;
      for (let r = 0; r < 10 && !ok; r++) for (let dy = -r; dy <= r && !ok; dy++) for (let dx = -r; dx <= r && !ok; dx++) if (RTS.canPlace(G, -1, c.site, tx + dx, ty + dy, 1)) { tx += dx; ty += dy; ok = true; }
      const e = RTS.spawn(G, c.site, -1, tx + 1.5, ty + 1.5); e.built = e.buildT; e.hp = d.hp; e.company = c.id; site = e.id; }
    m.cos[c.id] = { id: c.id, price: c.price, earn: 1, open: c.price, hist: [c.price], shares: G.teams.map(() => 0), free: RTS.MARKET.shares, site, owner: -1 };
  });
};
RTS.fair = (c) => RTS.defs.companies[c.id].price * c.earn;
RTS.dividend = (G, c) => RTS.defs.companies[c.id].price * RTS.defs.companies[c.id].yield * c.earn * RTS.cfg(G).divRate / 100;
function tell(G, text, kind) { for (const t of G.teams) RTS.emit(G, 'notice', { team: t.id, text, kind }); }
function news(G, text) { const m = G.market; m.news.unshift({ t: G.tick, text }); m.news.length = Math.min(m.news.length, 6); tell(G, text, 'market'); }
function syncControl(G, c) {
  let owner = -1; c.shares.forEach((n, i) => { if (n >= RTS.cfg(G).control) owner = i; });
  if (owner === c.owner) return;
  c.owner = owner; const e = G.byId[c.site], d = RTS.defs.companies[c.id];
  if (e) { e.team = owner; e.hitAt = 0; }
  news(G, owner < 0 ? `${d.name} 경영권 해제` : `${G.teams[owner].name}, ${d.name} 인수`);
  RTS.emit(G, 'takeover', { company: c.id, owner });
}
// 체결가를 미리 계산한다. UI 표시와 실제 체결이 같은 식을 쓴다.
RTS.quote = function (G, c, qty) {
  const C = RTS.cfg(G), imp = C.impact / 100; let p = c.price, sum = 0, n = Math.abs(qty);
  for (let i = 0; i < n; i++) { sum += p; p *= qty > 0 ? 1 + imp : 1 - imp; }
  return { total: qty > 0 ? sum : sum * (1 - C.fee / 100), end: p };
};
RTS.commands.trade = function (G, team, cmd) {
  const c = G.market.cos[cmd.company], t = G.teams[team]; if (!c) return;
  let qty = cmd.qty | 0;
  if (qty > 0) { qty = Math.min(qty, c.free);
    while (qty > 0 && RTS.quote(G, c, qty).total > t.res.ore) qty--;
    if (qty <= 0) { RTS.emit(G, 'notice', { team, text: c.free ? '광석이 부족합니다' : '시장에 남은 주식이 없습니다', kind: 'warn' }); return; }
    const q = RTS.quote(G, c, qty); t.res.ore -= q.total; c.price = q.end; c.shares[team] += qty; c.free -= qty; t.stats.trade = (t.stats.trade || 0) - q.total;
  } else if (qty < 0) { qty = -Math.min(-qty, c.shares[team]); if (!qty) return;
    const q = RTS.quote(G, c, qty); t.res.ore += q.total; c.price = Math.max(1, q.end); c.shares[team] += qty; c.free -= qty; t.stats.trade = (t.stats.trade || 0) + q.total;
  } else return;
  syncControl(G, c); RTS.emit(G, 'traded', { team, company: c.id, qty });
};
RTS.siteHit = function (G, e, dmg, src) {
  const c = G.market.cos[e.company], d = RTS.defs.entities[e.def];
  c.price = Math.max(1, c.price * (1 - Math.min(.02, dmg / d.hp * .5) * RTS.cfg(G).siteImpact / 100));
  if (e.team >= 0) RTS.emit(G, 'attacked', { e, src });
  if (e.hp > 0) return;
  e.hp = 1; e.downUntil = G.tick + RTS.cfg(G).siteDown * RTS.HZ; c.earn *= .75;
  news(G, RTS.defs.companies[c.id].name + ' 거점 피습, 가동 중단'); RTS.emit(G, 'siteDown', { e });
};
// 본진 함락: 패전 진영의 사령부가 모두 사라지면 시장 전체에 충격이 온다. 수치는 설정의 '전쟁과 시장'.
RTS.warFall = function (G, team) {
  const C = RTS.cfg(G), t = G.teams[team], cos = Object.values(G.market.cos); let cash = 0, sold = 0;
  for (const c of cos) { c.price = Math.max(1, c.price * (1 - C.warCrash / 100)); const n = Math.floor(c.shares[team] * C.warSell / 100);
    if (n) { cash += n * c.price * (1 - C.warHaircut / 100); sold += n; c.shares[team] -= n; c.free += n; syncControl(G, c); }
    if (RTS.defs.companies[c.id].resource === 'ore') c.earn = Math.min(2.5, c.earn * (1 + C.warRebuild / 100)); }
  t.res.ore += cash;
  if (C.warAlly && G.dip) for (const b of Object.values(G.dip.list)) if (b.ally === team) RTS.branchDown(G, G.byId[b.site]);
  news(G, `${t.name} 본진 함락: 증시 -${C.warCrash}%` + (sold ? `, 지분 ${sold}주 강제 매각` : ''));
  RTS.emit(G, 'warFall', { team, sold, cash });
};
RTS.systems.splice(RTS.systems.findIndex(s => s.id === 'cleanup'), 0, { id: 'market', run(G) {
  if (!G.market) RTS.initMarket(G);
  const m = G.market, C = RTS.cfg(G);
  if (G.tick % RTS.HZ) return;
  for (const c of Object.values(m.cos)) {
    const d = RTS.defs.companies[c.id], e = G.byId[c.site];
    const g = (RTS.rand(G) + RTS.rand(G) + RTS.rand(G) - 1.5) * 1.15; // 근사 정규분포
    const fair = RTS.fair(c) * (e && e.downUntil > G.tick ? .6 : 1);
    c.price = Math.max(1, c.price + (fair - c.price) * .02 + c.price * d.vol * g * C.volatility / 100);
    c.earn += (1 - c.earn) * .004;
    if (G.tick % (RTS.HZ * 5) === 0) { c.hist.push(+c.price.toFixed(2)); if (c.hist.length > 72) c.hist.shift(); }
    if (e) { const was = e.downUntil; const hp = RTS.defs.entities[e.def].hp;
      if (e.downUntil > G.tick) e.hp = Math.min(hp, e.hp + hp / C.siteDown);
      else { if (was) { e.downUntil = 0; news(G, d.name + ' 거점 가동 재개'); } if (e.hp < hp && G.tick - (e.hitAt || 0) > 100) e.hp = Math.min(hp, e.hp + hp * .01); } }
  }
  if (G.tick >= m.nextDiv) { m.nextDiv += C.divSec * RTS.HZ;
    for (const c of Object.values(m.cos)) { const d = RTS.defs.companies[c.id], e = G.byId[c.site]; if (e && e.downUntil > G.tick) continue;
      c.shares.forEach((n, i) => { if (!n) return; const k = c.owner < 0 ? 1 : c.owner === i ? C.ctrlBonus / 100 : C.minority / 100, t = G.teams[i], pay = n * RTS.dividend(G, c) * k * (1 + RTS.allyPerk(G, i, 'divBonus'));
        t.res[d.resource] = (t.res[d.resource] || 0) + pay; t.stats.div = (t.stats.div || 0) + pay; }); }
    RTS.emit(G, 'dividend', {}); }
  if (C.newsEvery > 0 && G.tick >= m.nextEvent) { m.nextEvent = G.tick + Math.round(C.newsEvery * (.67 + RTS.rand(G) * .66) * RTS.HZ); const pow = C.newsImpact / 100;
    const list = Object.values(RTS.defs.marketEvents); let r = RTS.rand(G) * list.reduce((s, e) => s + e.w, 0), ev = list[0];
    for (const x of list) { r -= x.w; if (r <= 0) { ev = x; break; } }
    for (const c of Object.values(m.cos)) { const d = RTS.defs.companies[c.id]; if (ev.scope === 'all' || ev.scope === d.resource || ev.scope === c.id) { c.earn = Math.max(.3, Math.min(2.5, c.earn * (1 + (ev.earn - 1) * pow))); c.price = Math.max(1, c.price * Math.max(.1, 1 + (ev.price - 1) * pow)); } }
    news(G, ev.text); }
} });
// AI 투자: 저평가 종목을 사고, 과열되면 팔고, 과반이 가까우면 인수까지 밀어붙인다.
RTS.aiInvest = function (G, t, diff, ready) {
  const cos = Object.values(G.market.cos), cmd = c => RTS.command(G, t.id, c);
  for (const c of cos) if (c.shares[t.id] && c.owner !== t.id && c.price > RTS.fair(c) * 1.3) { cmd({ type: 'trade', company: c.id, qty: -5 }); return; }
  const S = t.aiState; if (!ready || t.res.ore < diff.invest || G.tick < (S.nextInvest || 120 * RTS.HZ)) return;
  S.nextInvest = G.tick + diff.investEvery * RTS.HZ;
  const foe = c => c.shares.some((n, i) => i !== t.id && n > 25);
  const score = c => RTS.dividend(G, c) / c.price * (RTS.defs.companies[c.id].resource === 'gas' ? 1.5 : 1) + (foe(c) ? .05 : 0); // 에테르 배당은 광석보다 비싸게 친다
  const chase = cos.find(c => c.owner < 0 && c.shares[t.id] >= 30 && c.free > 0);
  const pick = chase || cos.filter(c => c.free > 0 && c.owner < 0 && c.price < RTS.fair(c) * 1.1).sort((a, b) => score(b) - score(a))[0];
  if (pick) cmd({ type: 'trade', company: pick.id, qty: 5 });
};
