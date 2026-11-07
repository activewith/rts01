// 왕초보 모드: 안개 없음, 사람 쪽 본진에 완공 방어탑 5~10개, AI 쪽은 없음
const fs = require('fs'), path = require('path'), assert = require('assert');
for (const f of ['engine/core','engine/map','engine/sim','engine/market','engine/war','engine/diplomacy','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
const counts = {};
for (const map of Object.keys(RTS.defs.maps)) for (const fac of Object.keys(RTS.defs.factions)) for (let seed = 1; seed <= 60; seed++) {
  const foe = fac === 'pioneers' ? 'ironclad' : 'pioneers', def = RTS.defs.factions[fac].defense;
  const G = RTS.createGame({ map, seed, settings: { fog: true }, players: [{ faction: fac }, { faction: foe, ai: 'beginner' }] });
  assert(G.nofog, '안개 꺼짐');
  const mine = G.ents.filter(e => e.team === 0 && e.def === def), hq = G.ents.find(e => e.team === 0 && e.def === RTS.defs.factions[fac].hq);
  assert(mine.length >= 5 && mine.length <= 10, `${map} ${fac} ${seed}: ${mine.length}`);
  for (const e of mine) { assert(RTS.complete(e)); assert(Math.hypot(e.x - hq.x, e.y - hq.y) < 18, '본진 근처'); }
  assert.equal(G.ents.filter(e => e.team === 1 && e.def === RTS.defs.factions[foe].defense).length, 0);
  counts[mine.length] = (counts[mine.length] || 0) + 1;
  if (seed <= 2) { for (let i = 0; i < 20 * 120; i++) RTS.step(G); const w = G.ents.filter(e => e.team === 0 && RTS.defOf(e).gather); assert(G.teams[0].stats.ore > 0, '채취 동선 막힘 ' + map + fac); }
}
console.log('방어탑 개수 분포', counts);
// 다른 난이도는 그대로
{ const G = RTS.createGame({ map: 'ridge', seed: 1, players: [{ faction: 'pioneers' }, { faction: 'ironclad', ai: 'normal' }] }); assert(!G.nofog); assert.equal(G.ents.filter(e => e.def === 'p_turret').length, 0); }
// 저장 복원
{ const G = RTS.createGame({ map: 'ridge', seed: 4, players: [{ faction: 'pioneers' }, { faction: 'ironclad', ai: 'beginner' }] }); const R = RTS.deserialize(RTS.serialize(G)); assert(R.nofog); }
console.log('왕초보 검사 통과');
