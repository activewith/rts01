// node test/features.js — 호위, 개척단 공병 건물 수리, 합체 유닛 ★2 변신
const fs = require('fs'), path = require('path');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const run = (G, n) => { for (let i = 0; i < n; i++) RTS.step(G); };
const D = RTS.defs.entities;
const mk = (f0 = 'pioneers', f1 = 'ironclad') => { const G = RTS.createGame({ map: 'ridge', seed: 3, players: [{ faction: f0 }, { faction: f1 }] }); return G; };
const hq = (G, team) => G.ents.find(e => e.team === team && D[e.def].dropoff);
const cmd = (G, team, c) => RTS.command(G, team, c);

// 1. 호위: 대상을 따라가고, 대상 둘레의 적을 공격하고, 대상이 사라지면 끝
{ const G = mk(), h = hq(G, 0), cart = RTS.spawn(G, 'p_worker', 0, h.x + 4, h.y + 6), guards = [0, 1, 2].map(i => RTS.spawn(G, 'p_rifle', 0, h.x - 6 + i, h.y - 6));
  cmd(G, 0, { type: 'order', ids: guards.map(u => u.id), order: { type: 'escort', target: cart.id } });
  RTS.issue(G, cart, { type: 'move', x: h.x + 22, y: h.y + 6 }); run(G, 20 * 14);
  const far = Math.max(...guards.map(u => Math.hypot(u.x - cart.x, u.y - cart.y)));
  ok(far < 4.5 && guards.every(u => u.order && u.order.type === 'escort'), `호위: 대상을 따라감 (가장 먼 거리 ${far.toFixed(1)}칸)`);
  const foe = RTS.spawn(G, 'i_blade', 1, cart.x + 4, cart.y + 1), hp0 = foe.hp; run(G, 20 * 3);
  ok(foe.dead || foe.hp < hp0, `호위: 대상 둘레의 적을 공격 (적 체력 ${Math.max(0, foe.hp | 0)}/${hp0})`);
  ok(guards.every(u => u.order && u.order.type === 'escort'), '호위: 교전 뒤에도 호위 유지');
  RTS.kill(G, cart, null, true); run(G, 5); ok(guards.every(u => !u.order || u.order.type !== 'escort'), '호위: 대상이 사라지면 끝');
  cmd(G, 0, { type: 'order', ids: [guards[0].id], order: { type: 'escort', target: hq(G, 1).id } }); run(G, 2); ok(!guards[0].order || guards[0].order.type !== 'escort', '호위: 적은 호위할 수 없음'); }
// 1-2. 부족 수송차 호위(다른 팀 소유가 아닌 내 소유 수레)
{ const G = mk(), h = hq(G, 0), c = RTS.spawn(G, 't_cart', 0, h.x + 20, h.y + 8); c.order = { type: 'tribeCart', ore: 100, gas: 10 }; const g = RTS.spawn(G, 'p_rifle', 0, h.x + 16, h.y + 8);
  cmd(G, 0, { type: 'order', ids: [g.id], order: { type: 'escort', target: c.id } }); run(G, 20 * 4); ok(g.order && g.order.type === 'escort' && Math.hypot(g.x - c.x, g.y - c.y) < 4, '부족 수송차 호위'); }

// 2. 개척단 공병 건물 수리: 완공 건물, 비용, 짓는 중·철거 중·남의 건물·다른 진영 일꾼 거부
{ const G = mk(), h = hq(G, 0), t = G.teams[0], w = G.ents.find(e => e.team === 0 && D[e.def].gather), max = RTS.stat(G, h, 'hp');
  for (const e of G.ents) if (e.team === 0 && D[e.def].gather && e !== w) RTS.kill(G, e, null, true); // 다른 일꾼의 채취가 비용 계산에 섞이지 않게
  RTS.issue(G, w, null); h.hp = max - 300; t.res.ore = 1000; const ore0 = t.res.ore;
  ok(RTS.repairBlock(G, w, h) === '', '공병: 다친 본진 수리 가능');
  cmd(G, 0, { type: 'order', ids: [w.id], order: { type: 'repair', target: h.id } }); run(G, 20 * 12);
  const fixed = h.hp - (max - 300), paid = ore0 - t.res.ore, expect = D[h.def].cost.ore * RTS.SERVICE.repair * fixed / max;
  ok(fixed > 100 && Math.abs(paid - expect) < 2, `건물 수리: 12초에 체력 +${fixed | 0}, 광석 ${paid.toFixed(1)} (예상 ${expect.toFixed(1)})`);
  run(G, 20 * 30); ok(h.hp === max && (!w.order || w.order.type !== 'repair'), '가득 차면 수리를 마치고 일로 돌아감');
  const site = RTS.spawn(G, 'p_barracks', 0, h.x + 8, h.y); site.built = 1; site.hp = 50; ok(/짓는 중/.test(RTS.repairBlock(G, w, site)), '짓는 중인 건물은 수리 불가');
  const eh = hq(G, 1); eh.hp -= 100; ok(!!RTS.repairBlock(G, w, eh), '상대 건물 수리 불가');
  const G2 = mk('ironclad', 'pioneers'), h2 = hq(G2, 0), w2 = G2.ents.find(e => e.team === 0 && D[e.def].gather); h2.hp -= 200; ok(!!RTS.repairBlock(G2, w2, h2), '철갑회 일꾼은 수리 없음'); }

// 3. 변신: ★2 합체 유닛만, 형태 수치, 체력 비율 유지, 고정 형태는 이동 불가, 다시 누르면 원래대로
for (const id of ['p_commando', 'p_titan', 'i_duelist', 'i_juggernaut', 's_venom', 's_behemoth']) {
  const fac = id[0] === 'p' ? 'pioneers' : id[0] === 'i' ? 'ironclad' : 'swarm', G = mk(fac, fac === 'ironclad' ? 'pioneers' : 'ironclad'), h = hq(G, 0), u = RTS.spawn(G, id, 0, h.x + 6, h.y), F = D[id].form;
  cmd(G, 0, { type: 'ability', ids: [u.id], ability: 'morph' }); run(G, 1); const no = !u.form;
  u.rank = RTS.RANK.max; u.hp = RTS.stat(G, u, 'hp') * .5; const hp0 = RTS.stat(G, u, 'hp'), sp0 = RTS.stat(G, u, 'speed'), w = RTS.weapon(u), dm0 = RTS.wStat(G, u, w, 'damage'), rg0 = RTS.wStat(G, u, w, 'range');
  cmd(G, 0, { type: 'ability', ids: [u.id], ability: 'morph' }); run(G, 1);
  const m = F.mods, near = (a, b) => Math.abs(a - b) < 1e-6, rOk = Math.abs(u.hp / RTS.stat(G, u, 'hp') - .5) < .01;
  const sOk = near(RTS.stat(G, u, 'hp'), hp0 * (m.hp || 1)) && near(RTS.wStat(G, u, RTS.weapon(u), 'damage'), dm0 * (m.damage || 1)) && near(RTS.wStat(G, u, RTS.weapon(u), 'range'), rg0 * (m.range || 1)) && (F.root || near(RTS.stat(G, u, 'speed'), sp0 * (m.speed || 1)));
  let rootOk = true; if (F.root) { const x0 = u.x; cmd(G, 0, { type: 'order', ids: [u.id], order: { type: 'move', x: u.x + 10, y: u.y } }); run(G, 40); rootOk = u.sieged && Math.abs(u.x - x0) < .01; }
  run(G, 20 * 5); cmd(G, 0, { type: 'ability', ids: [u.id], ability: 'morph' }); run(G, 1);
  ok(no && u.form === 0 && sOk && rOk && rootOk && !u.sieged && near(RTS.stat(G, u, 'hp'), hp0), `${D[id].name} → ${F.name}: ★2 전 불가, 수치·체력 비율${F.root ? '·제자리 고정' : ''}, 되돌리기`); }
// 3-2. AI도 변신을 쓴다
{ const G = mk('pioneers', 'ironclad'), h = hq(G, 1), u = RTS.spawn(G, 'i_duelist', 1, h.x, h.y + 5); u.rank = 2; RTS.spawn(G, 'p_rifle', 0, u.x + 5, u.y); run(G, 1); // 공간 해시는 틱마다 다시 만든다
  RTS.defs.abilities.morph.ai(G, u); run(G, 1); ok(u.form === 1, 'AI: 적이 가까우면 변신'); }

console.log(bad ? `실패 ${bad}` : '호위·건물 수리·변신 검사 통과'); process.exit(bad ? 1 : 0);
