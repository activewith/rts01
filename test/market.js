// 시장 규칙 단위 검사: 매수/매도/인수/피격/배당/승패 제외
const fs = require('fs'), path = require('path'), assert = require('assert');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
const G = RTS.createGame({ map: 'ridge', seed: 3, players: [{ faction: 'pioneers' }, { faction: 'ironclad' }] });
const c = G.market.cos.daeryuk, me = G.teams[0], e = G.byId[c.site];
for (const m of Object.values(RTS.defs.maps)) { const g = RTS.createGame({ map: m.id, seed: 1, players: [{ faction: 'pioneers' }, { faction: 'ironclad' }] }); for (const k of Object.values(g.market.cos)) { const s = g.byId[k.site]; assert(s, m.id + ' 거점 없음'); const p = RTS.findPath(g, g.bases[0].x, g.bases[0].y + 4, { x0: s.x - 3, y0: s.y - 3, x1: s.x + 2, y1: s.y + 2 }); const l = p[p.length - 1]; assert(Math.hypot(l[0] - s.x, l[1] - s.y) < 4, m.id + ' 거점 도달 불가 ' + k.id); } }
me.res.ore = 1000; const p0 = c.price;
RTS.command(G, 0, { type: 'trade', company: 'daeryuk', qty: 20 }); RTS.step(G);
assert.equal(c.shares[0], 20); assert(c.price > p0); assert(me.res.ore < 1000 - 20 * p0);
const ore1 = me.res.ore; RTS.command(G, 0, { type: 'trade', company: 'daeryuk', qty: -10 }); RTS.step(G);
assert.equal(c.shares[0], 10); assert(me.res.ore > ore1);
me.res.ore = 5000; RTS.command(G, 0, { type: 'trade', company: 'daeryuk', qty: 41 }); RTS.step(G);
assert.equal(c.owner, 0); assert.equal(e.team, 0); console.log('인수 후 주가', c.price.toFixed(1), '거점 소속', e.team);
G.teams[1].res.ore = 99999; RTS.command(G, 1, { type: 'trade', company: 'daeryuk', qty: 60 }); RTS.step(G);
assert.equal(c.shares[1], 49); assert.equal(c.free, 0); assert.equal(c.owner, 0);
const before = me.res.ore, foeB = G.teams[1].res.ore; G.tick = G.market.nextDiv - 1 - (G.market.nextDiv % 20 === 0 ? 0 : 0); RTS.step(G);
console.log('배당 지배', (me.res.ore - before).toFixed(1), '소수', (G.teams[1].res.ore - foeB).toFixed(1));
RTS.step(G); const p1 = c.price; for (let i = 0; i < 400 && !e.downUntil; i++) RTS.damage(G, e, 40, { team: 1 });
assert(e.downUntil > G.tick && !e.dead); assert(c.price < p1); console.log('피격 후 주가', p1.toFixed(1), '→', c.price.toFixed(1));
const units = G.ents.filter(x => x.team === 1 && RTS.defOf(x).kind !== 'resource' && !RTS.defOf(x).site); units.forEach(x => RTS.kill(G, x));
for (let i = 0; i < 12; i++) RTS.step(G); assert(G.over && G.over.winner === 0); console.log('시장 검사 통과');
