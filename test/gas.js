// 두 진영 모두 추출 건물 완공 후 실제로 에테르가 들어오는지 검사
const fs = require('fs'), path = require('path'), assert = require('assert');
for (const f of ['engine/core','engine/map','engine/sim','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
for (const [fac, ext] of [['pioneers', 'p_extractor'], ['ironclad', 'i_extractor']]) for (const map of ['ridge', 'canyon']) {
  const G = RTS.createGame({ map, seed: 2, settings: { newsEvery: 0 }, players: [{ faction: fac }, { faction: fac === 'pioneers' ? 'ironclad' : 'pioneers' }] }), t = G.teams[0]; t.res.ore = 500;
  const hq = G.ents.find(e => e.team === 0 && RTS.defOf(e).dropoff), v = G.ents.filter(e => e.def === 'vent').sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y))[0], w = G.ents.find(e => e.team === 0 && RTS.defOf(e).gather);
  RTS.command(G, 0, { type: 'place', ids: [w.id], def: ext, tx: Math.round(v.x - 1), ty: Math.round(v.y - 1) });
  for (let i = 0; i < 20 * 60; i++) RTS.step(G);
  const x = G.ents.find(e => e.def === ext), crew = G.ents.filter(u => u.team === 0 && u.order && u.order.node === x.id).length;
  console.log(fac, map, '완공', RTS.complete(x), '배치', crew, '에테르', t.stats.gas); assert(RTS.complete(x)); assert.equal(crew, 3); assert(t.stats.gas > 0);
}
console.log('에테르 검사 통과');
