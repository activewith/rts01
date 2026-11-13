// 모든 진영이 추출기를 지으면 에테르가 들어오는지 검사
const fs = require('fs'), path = require('path'), assert = require('assert');
for (const f of ['engine/core','engine/map','engine/sim','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
for (const [fac, foe, ext] of [['pioneers', 'ironclad', 'p_extractor'], ['ironclad', 'pioneers', 'i_extractor'], ['swarm', 'pioneers', 's_extractor']]) {
  const G = RTS.createGame({ map: 'ridge', seed: 2, players: [{ faction: fac }, { faction: foe }] }), t = G.teams[0]; t.res.ore = 500;
  for (let i = 0; i < 40; i++) RTS.step(G);
  const hq = G.ents.find(e => e.team === 0 && RTS.defOf(e).dropoff), v = G.ents.filter(e => e.def === 'vent').sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y))[0];
  const w = G.ents.find(e => e.team === 0 && RTS.defOf(e).gather);
  RTS.command(G, 0, { type: 'place', ids: [w.id], def: ext, tx: Math.round(v.x - 1), ty: Math.round(v.y - 1) });
  for (let i = 0; i < 20 * 75; i++) RTS.step(G);
  const x = G.ents.find(e => e.def === ext), on = G.ents.filter(u => u.order && u.order.type === 'gather' && u.order.node === x.id).length;
  console.log(fac, '완공', RTS.complete(x), '배치', on, '명, 에테르', t.res.gas); assert(RTS.complete(x) && on === 3 && t.res.gas > 0, fac);
}
console.log('추출기 검사 통과');
