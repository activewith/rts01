// 같은 진영끼리: 혼자 하기(상대 AI 같은 진영), 둘이 하기 1:1·서로 대전·협동에서 두 사람이 같은 진영. 진행·승패·결정성, 색 구분
const fs = require('fs'), path = require('path'), assert = require('assert');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','engine/net','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
// 색 표(render.js 맨 위의 색 정의만 읽는다. 나머지는 화면이 있어야 한다)
{ const src = fs.readFileSync(path.join(__dirname, '../src/ui/render.js'), 'utf8'), top = src.slice(src.indexOf('RTS.TEAM = '), src.indexOf('RTS.TEAM[RTS.TRIBE]')); (0, eval)(top); }
const F = Object.keys(RTS.defs.factions);
const pal = G => RTS.teamPalette(G).map(c => c.main);
for (const f of F) {
  // 혼자 하기: 같은 진영 AI
  const G = RTS.createGame({ map: 'ridge', seed: 5, settings: RTS.defaultSettings(), players: [{ faction: f }, { faction: f, ai: 'normal', name: '상대' }] });
  G.teams[0].ai = 'normal'; const p = pal(G); assert.notEqual(p[0], p[1], f + ' 혼자 하기 색 구분'); assert.equal(p[0], RTS.FACTION_COLOR[f].main, f + ' 내 색은 진영 색');
  for (let i = 0; i < 20 * 60 * 9 && !G.over; i++) RTS.step(G);
  const units = t => G.ents.filter(e => e.team === t && !e.dead && RTS.defOf(e).kind === 'unit').length;
  console.log(f, '대 같은 진영 AI 9분', G.over ? '승자 ' + G.over.winner : '진행 중', '유닛', units(0), units(1));
  // 둘이 하기 세 방식
  for (const mode of ['duel', 'vs', 'coop']) { const o = { map: 'lake', seed: 9, settings: RTS.defaultSettings(), factions: [f, f], names: ['a', 'b'], hc: ['none', 'none'], duel: mode === 'duel', coop: mode === 'coop' };
    const O = RTS.netGameOpts(o), a = RTS.createGame(JSON.parse(JSON.stringify(O))), b = RTS.createGame(JSON.parse(JSON.stringify(O)));
    assert.equal(a.teams[0].faction, f); assert.equal(a.teams[1].faction, f, mode + ' 두 사람 같은 진영');
    if (mode !== 'duel') assert.notEqual(a.teams[2].faction, f, mode + ' 중립세력은 남은 진영');
    const q = pal(a); assert.equal(new Set(q).size, q.length, mode + ' 팀 색 모두 다름 ' + q.join(','));
    for (const G of [a, b]) { G.teams[0].ai = 'normal'; G.teams[1].ai = 'normal'; }
    for (let i = 0; i < 20 * 150; i++) { RTS.step(a); RTS.step(b); }
    assert.equal(RTS.stateHash(a), RTS.stateHash(b), f + ' ' + mode + ' 두 기기 동일'); }
}
// 같은 진영 1:1: 상대 전멸이면 승리
{ const O = RTS.netGameOpts({ map: 'ridge', seed: 3, settings: RTS.defaultSettings(), factions: ['ironclad', 'ironclad'], names: ['a', 'b'], hc: ['none', 'none'], duel: true }), G = RTS.createGame(O);
  for (const e of G.ents) if (e.team === 1) RTS.kill(G, e, null, true); for (let i = 0; i < 20; i++) RTS.step(G); assert(G.over && G.over.winner === 0, '같은 진영 1:1 승패'); }
// 캠페인은 색을 바꾸지 않는다
{ const G = { camp: { id: 'x' }, coop: true, teams: [{ faction: 'pioneers' }, { faction: 'ironclad' }, { faction: 'swarm' }, { faction: 'swarm' }] };
  const p = pal(G); assert.equal(p[2], p[3], '캠페인 팀 색 그대로'); }
console.log('같은 진영 검사 통과');
