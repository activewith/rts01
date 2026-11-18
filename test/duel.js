// 1:1 대전(duel): 중립세력 없이 두 사람만, 시작 위치·승패·두 기기 동일
const fs = require('fs'), path = require('path'), assert = require('assert');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','engine/net','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
const opts = o => JSON.parse(JSON.stringify(RTS.netGameOpts(Object.assign({ map: 'ridge', seed: 7, settings: RTS.defaultSettings(), factions: ['pioneers', 'swarm'], names: ['a', 'b'], hc: ['none', 'none'], duel: true }, o))));
for (const map of Object.keys(RTS.defs.maps)) { const G = RTS.createGame(opts({ map }));
  assert.equal(G.teams.length, 2, map + ' 두 팀'); assert(!G.coop && G.teams.every(t => !t.ai), map + ' AI 없음');
  const hq = G.teams.map(t => G.ents.find(e => e.team === t.id && RTS.defOf(e).dropoff)); assert(hq[0] && hq[1], map + ' 본진'); assert(RTS.foe(G, 0, 1));
  console.log(map, '본진 거리', Math.round(Math.hypot(hq[0].x - hq[1].x, hq[0].y - hq[1].y))); }
{ const G = RTS.createGame(opts({})); for (const e of G.ents) if (e.team === 1) RTS.kill(G, e, null, true); for (let i = 0; i < 20; i++) RTS.step(G); assert(G.over && G.over.winner === 0, '상대 전멸 → 승리'); }
{ const v = RTS.netGameOpts({ map: 'ridge', seed: 1, settings: {}, factions: ['pioneers', 'ironclad'], names: ['a', 'b'], hc: ['none', 'none'] }); assert.equal(v.players.length, 3, '서로 대전은 셋'); }
{ const v = RTS.netGameOpts({ map: 'ridge', seed: 1, settings: {}, factions: ['pioneers', 'ironclad'], names: ['a', 'b'], hc: ['none', 'none'], coop: true, duel: true }); assert.equal(v.players.length, 3, '협동이 우선'); }
// 두 기기: AI 대신 같은 명령을 넣은 두 게임이 같은 상태
{ const a = RTS.createGame(opts({ seed: 11 })), b = RTS.createGame(opts({ seed: 11 })); for (const G of [a, b]) { G.teams[0].ai = 'normal'; G.teams[1].ai = 'normal'; }
  for (let i = 0; i < 20 * 300; i++) { RTS.step(a); RTS.step(b); } assert.equal(RTS.stateHash(a), RTS.stateHash(b), '결정성'); console.log('5분 진행, 유닛', a.ents.filter(e => RTS.defOf(e).kind === 'unit').length); }
console.log('1:1 대전 검사 통과');
