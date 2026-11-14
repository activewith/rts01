const fs = require('fs'), path = require('path'), assert = require('assert');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
const mk = (seed, map = 'ridge') => RTS.createGame({ map, seed, players: [{ faction: 'pioneers' }, { faction: 'ironclad' }] });
for (const m of ['ridge', 'canyon']) { const g = mk(1, m); const L = Object.values(g.dip.list); assert.equal(L.length, 4, m + ' 지부 수'); for (const b of L) { const s = g.byId[b.site], p = RTS.findPath(g, g.bases[0].x, g.bases[0].y + 4, { x0: s.x - 3, y0: s.y - 3, x1: s.x + 2, y1: s.y + 2 }), l = p[p.length - 1]; assert(Math.hypot(l[0] - s.x, l[1] - s.y) < 4, m + ' 도달 불가 ' + b.id); } }
const a = mk(1), layout = g => Object.values(g.dip.list).map(b => { const s = g.byId[b.site]; return s.x + ',' + s.y; }).join(' ');
assert(new Set([1, 2, 3, 4, 5, 6].map(n => layout(mk(n)))).size > 1, '지부 위치가 섞이지 않음');
{ let rej = 0, ok = 0; for (let n = 10; n < 40; n++) { const g = mk(n), t = g.teams[0], x = g.dip.list.namhae; x.found[0] = true; t.stats.ore = 900; t.res.ore = 500; RTS.command(g, 0, { type: 'ally', branch: 'namhae', stake: 100 }); RTS.step(g);
  if (x.ally === 0) ok++; else { rej++; assert(t.res.ore < 420, '거절 시 동맹금 손실'); assert(x.trust[0] === .05); assert(x.wait[0] > g.tick); } } console.log('30판 수락', ok, '거절', rej); assert(rej && ok); }
let G = mk(4), me = G.teams[0], id = 'namhae', b = G.dip.list[id], e = G.byId[b.site];
assert(RTS.allyBlock(G, 0, id, 200)); me.res.ore = 5000; me.stats.ore = 0;
const w = G.ents.find(x => x.team === 0 && RTS.defOf(x).gather); RTS.issue(G, w, null); w.x = e.x; w.y = e.y + 3; for (let i = 0; i < 25; i++) RTS.step(G);
assert(b.found[0] && b.finder === 0); assert(RTS.allyBlock(G, 0, id, 200).startsWith('조건')); me.stats.ore = 900;
assert.equal(+RTS.allyChance(G, 0, id, 100).toFixed(2), .45); assert.equal(+RTS.allyChance(G, 0, id, 600).toFixed(2), .9);
// 거절: 손실 + 신뢰 상승 + 재신청 대기
let tries = 0, burned = 0; while (b.ally < 0 && tries < 40) { const o0 = me.res.ore; b.wait[0] = 0; RTS.command(G, 0, { type: 'ally', branch: id, stake: 100 }); RTS.step(G); tries++; if (b.ally < 0) { burned++; assert(o0 - me.res.ore >= 99); assert(b.wait[0] > G.tick); } }
console.log('신청', tries, '거절', burned, '신뢰', b.trust[0]); assert.equal(b.ally, 0); assert.equal(e.team, 0);
const f = G.dip.list.rail; const before = G.teams[1].res.ore;
// 수레 도착
for (let i = 0; i < 20 * 90 && !me.stats.caravan; i++) RTS.step(G); console.log('수레 도착', me.stats.caravan); assert(me.stats.caravan > 0);
// 거래
const g0 = me.res.gas; RTS.command(G, 0, { type: 'barter', branch: id, buy: true }); RTS.step(G); assert.equal(me.res.gas, g0 + 50);
// 지부 파괴: 동맹 해제 + 출자금 소멸 + 복구 대기
for (let i = 0; i < 300 && b.ally === 0; i++) RTS.damage(G, e, 60, { team: 1 }); assert.equal(b.ally, -1); assert.equal(e.team, -1); assert(b.lockUntil > G.tick); assert(RTS.allyBlock(G, 0, id, 200).includes('복구'));
// 상대가 동맹이면 차단
G = mk(5); const bb = Object.values(G.dip.list)[1]; bb.found = [true, true]; bb.ally = 1; assert(RTS.allyBlock(G, 0, bb.id, 200).includes('상대'));
// 저장 복원
const J = RTS.serialize(a), R2 = RTS.deserialize(J); RTS.step(R2);
console.log('자유상단 검사 통과');
