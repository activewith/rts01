// 설정이 실제 시뮬레이션을 바꾸는지 검사
const fs = require('fs'), path = require('path'), assert = require('assert');
for (const f of ['engine/core','engine/map','engine/sim','engine/market','engine/war','engine/diplomacy','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
const mk = settings => RTS.createGame({ map: 'ridge', seed: 3, settings, players: [{ faction: 'pioneers' }, { faction: 'ironclad' }] });
// 기본값은 설정 도입 전 수치와 같아야 한다
for (const g of RTS.SETTINGS) for (const s of g.items) if (s.type !== 'toggle') { assert(s.def >= s.min && s.def <= s.max, s.id); }
for (const p of Object.values(RTS.PRESETS)) for (const k of Object.keys(p)) assert(k in RTS.defaultSettings(), k);
const count = cfg => { const G = mk(cfg); let n = 0; RTS.on(G, 'notice', d => { if (d.kind === 'market' && d.team === 0) n++; }); for (let i = 0; i < 20 * 600; i++) RTS.step(G); return n; };
const a = count({ newsEvery: 30 }), b = count({ newsEvery: 120 }), c = count({ newsEvery: 0 });
console.log('10분간 뉴스 30초:', a, '120초:', b, '없음:', c); assert(a > b * 2 && b > 0 && c === 0);
{ const G = mk({ startOre: 500, startGas: 75 }); assert.equal(G.teams[0].res.ore, 500); assert.equal(G.teams[0].res.gas, 75); }
{ const G = mk({ fog: false }); assert(G.nofog); }
{ const G = mk({ control: 70 }), t = G.teams[0]; t.res.ore = 99999; RTS.command(G, 0, { type: 'trade', company: 'daeryuk', qty: 60 }); RTS.step(G); assert.equal(G.market.cos.daeryuk.owner, -1); RTS.command(G, 0, { type: 'trade', company: 'daeryuk', qty: 10 }); RTS.step(G); assert.equal(G.market.cos.daeryuk.owner, 0); }
{ const G = mk({ divRate: 0 }), t = G.teams[0]; t.res.ore = 9999; RTS.command(G, 0, { type: 'trade', company: 'daeryuk', qty: 10 }); RTS.step(G); const o = t.stats.div || 0; for (let i = 0; i < 700; i++) RTS.step(G); assert.equal(t.stats.div || 0, o); }
{ const G = mk({ rejectLoss: 50 }), t = G.teams[0], b = G.dip.list.namhae; b.found[0] = true; t.stats.ore = 900; let done = false; for (let n = 0; n < 40 && !done; n++) { b.wait[0] = 0; t.res.ore = 1000; RTS.command(G, 0, { type: 'ally', branch: 'namhae', stake: 200 }); RTS.step(G); if (b.ally < 0) { done = true; assert(t.res.ore > 880 && t.res.ore < 920, '절반 손실 ' + t.res.ore); } else { b.ally = -1; G.byId[b.site].team = -1; } } assert(done); }
// 본진 함락
{ const G = mk(), t = G.teams[1], c = G.market.cos.daeryuk; t.res.ore = 9999; RTS.command(G, 1, { type: 'trade', company: 'daeryuk', qty: 60 }); RTS.step(G); assert.equal(c.owner, 1);
  const b = G.dip.list.rail; b.ally = 1; b.stake = 300; G.byId[b.site].team = 1;
  const site = RTS.spawn(G, 'i_forge', 1, 40, 40); site.built = site.buildT; RTS.step(G); const p = c.price, o = t.res.ore, e = c.earn, hq = G.ents.find(x => x.def === 'i_hq'); RTS.kill(G, hq, { team: 0 });
  console.log('함락 주가', p.toFixed(1), '→', c.price.toFixed(1), '지분', c.shares[1], '현금', Math.round(t.res.ore - o), '경영권', c.owner, '실적', c.earn.toFixed(2));
  assert(Math.abs(c.price / p - .85) < .001); assert.equal(c.shares[1], 30); assert.equal(c.owner, -1); assert(t.res.ore > o); assert(c.earn > e); assert.equal(b.ally, -1); }
{ const G = mk({ warCrash: 0, warSell: 0, warRebuild: 0, warAlly: false }), t = G.teams[1], c = G.market.cos.daeryuk; t.res.ore = 9999; RTS.command(G, 1, { type: 'trade', company: 'daeryuk', qty: 60 }); RTS.step(G); const f = RTS.spawn(G, 'i_forge', 1, 40, 40); f.built = f.buildT; const p = c.price, e = c.earn; RTS.kill(G, G.ents.find(x => x.def === 'i_hq'), { team: 0 }); assert.equal(c.price, p); assert.equal(c.shares[1], 60); assert.equal(c.owner, 1); assert.equal(c.earn, e); }
// 사령부가 하나 남으면 발동하지 않음
{ const G = mk(), t = G.teams[1], c = G.market.cos.daeryuk; const h2 = RTS.spawn(G, 'i_hq', 1, 40, 40); h2.built = h2.buildT; const p = c.price; RTS.kill(G, G.ents.find(x => x.def === 'i_hq'), { team: 0 }); assert.equal(c.price, p); }
// 기지 전투 피해: 본진 > 위성, 자원 가중, 효율·신용·증시·약탈
{ const run = (hurtMain, cfg) => { const G = mk(cfg); const hq = G.ents.find(x => x.def === 'i_hq'), s = RTS.nearestFree(G, 30, 30), h2 = RTS.spawn(G, 'i_hq', 1, Math.round(s.x) , Math.round(s.y)); h2.built = h2.buildT; h2.hp = 1300; RTS.step(G); for (let i = 0; i < 25; i++) RTS.step(G);
    const near = hurtMain ? hq : h2, b = RTS.spawn(G, 'i_foundry', 1, 0, 0), p = RTS.nearestFree(G, near.x + 5, near.y + 5); RTS.occupy(G, b, 0); b.x = Math.round(p.x) + .5; b.y = Math.round(p.y) + .5; b.built = b.buildT; b.hp = 1100; RTS.occupy(G, b, b.id); for (let i = 0; i < 25; i++) RTS.step(G);
    const c = G.market.cos.daeryuk, P = c.price, o = G.teams[0].res.ore, L0 = G.teams[1].stats.warLoss || 0; RTS.damage(G, b, 1000, { team: 0 }); const base = RTS.baseOf(G, b); return { loss: G.teams[1].stats.warLoss - L0, loot: G.teams[0].res.ore - o, credit: G.teams[1].credit, eff: base.eff, main: base.main, G, c, P }; };
  const m = run(true), s = run(false); console.log('피해액 본진', m.loss.toFixed(0), '위성', s.loss.toFixed(0), '효율', m.eff.toFixed(2), s.eff.toFixed(2), '신용', m.credit.toFixed(3), '약탈', m.loot.toFixed(0));
  assert(m.main && !s.main); assert(m.loss > s.loss * 1.2); assert(m.eff < 1 && m.credit < 1); assert(Math.abs(m.loot - m.loss * .1) < .01);
  for (let i = 0; i < 21; i++) RTS.step(m.G); assert(m.c.price < m.P * 1.02); const off = run(true, { warMain: 0 }); assert.equal(off.loss, 0); assert.equal(off.credit, 1); }
{ const G = mk({ warEff: 100 }), t = G.teams[0], hq = G.ents.find(x => x.def === 'p_hq'); RTS.step(G); for (let i = 0; i < 25; i++) RTS.step(G); const b = G.war.bases[hq.id]; b.eff = .5; const w = G.ents.find(x => x.team === 0 && RTS.defOf(x).gather); assert.equal(RTS.baseEff(G, hq), .5); }
const J = RTS.serialize(mk({ newsEvery: 30 })), o = JSON.parse(J); delete o.cfg; const R2 = RTS.deserialize(JSON.stringify(o)); assert.equal(R2.cfg.newsEvery, 60); RTS.step(R2);
console.log('설정 검사 통과');
