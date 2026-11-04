// 헤드리스 검증: node test/run.js  — AI 대전을 돌려 경로/전투/승패/저장 복원을 확인
const fs = require('fs'), path = require('path');
for (const f of ['engine/core','engine/map','engine/sim','engine/market','engine/war','engine/diplomacy','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
const out = []; const start = Date.now();
function match(map, seed, a, b, da, db, max = 20 * 60 * 25) {
  const G = RTS.createGame({ map, seed, players: [{ faction: a, ai: da }, { faction: b, ai: db }] });
  for (let i = 0; i < max && !G.over; i++) RTS.step(G);
  return { map, seed, a, b, da, db, min: +(G.tick / 1200).toFixed(1), win: G.over ? G.teams[G.over.winner]?.faction + '#' + G.over.winner : 'none', st: G.teams.map(t => ({ ore: t.stats.ore, made: t.stats.made, lost: t.stats.lost, div: Math.round(t.stats.div), stk: Object.values(G.market.cos).map(c => c.shares[t.id]).join('/') })), ally: Object.values(G.dip.list).map(b => b.id + ':' + b.ally).join(' '), burn: G.teams.map(t => t.stats.burned || 0) };
}
const r = [];
for (const m of ['ridge', 'canyon']) for (const s of [1, 2]) { r.push(match(m, s, 'pioneers', 'ironclad', 'normal', 'normal')); r.push(match(m, s + 10, 'ironclad', 'pioneers', 'normal', 'normal')); }
for (const s of [7, 8, 9]) { r.push(match('ridge', s, 'pioneers', 'ironclad', 'hard', 'easy')); r.push(match('canyon', s, 'ironclad', 'pioneers', 'easy', 'hard')); r.push(match('ridge', s + 20, 'ironclad', 'pioneers', 'hard', 'easy')); }
for (const x of r) console.log(JSON.stringify(x));
// 결정성 및 저장 복원
const mk = () => RTS.createGame({ map: 'ridge', seed: 5, players: [{ faction: 'pioneers', ai: 'normal' }, { faction: 'ironclad', ai: 'normal' }] });
const A = mk(); for (let i = 0; i < 6000; i++) RTS.step(A);
let B = mk(); for (let i = 0; i < 3000; i++) RTS.step(B); B = RTS.deserialize(RTS.serialize(B)); for (let i = 0; i < 3000; i++) RTS.step(B);
console.log('결정성(저장 후 이어하기 동일):', RTS.serialize(A) === RTS.serialize(B));
console.log('총 소요 ms', Date.now() - start);
