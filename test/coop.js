// node test/coop.js — 둘이 협동 검사.
// 시작 옵션, 시작 위치, 동맹 판정(공격·피해·시야), 중립세력 성능 배율, 편 단위 승패,
// 두 기기 lockstep 동일성(중립세력 AI 포함), AI 둘이 한 편일 때 실제로 끝까지 진행되는지 본다.
const fs = require('fs'), path = require('path');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','engine/net','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const prng = s => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const D = RTS.defs.entities;
const opts = (o = {}) => JSON.parse(JSON.stringify(RTS.netGameOpts(Object.assign({ map: 'ridge', seed: 7, settings: RTS.defaultSettings(), factions: ['pioneers', 'ironclad'], names: ['아빠', '아들'], hc: ['none', 'none'], coop: true }, o))));
const hqOf = (G, t) => G.ents.find(e => e.team === t && D[e.def].dropoff);

// 1. 시작 옵션
{ const o = opts();
  ok(o.coop && o.players.length === 3, '협동 옵션: 플레이어 3(사람 2 + 중립세력)');
  ok(o.players[0].side === 0 && o.players[1].side === 0 && o.players[2].side === 1, '편: 사람 둘 0, 중립세력 1');
  ok(o.players[2].faction === 'swarm' && o.players[2].ai === 'normal' && o.players[2].boost === 1.3, '중립세력 기본값: 남은 진영(포자군락), 보통 AI, 130%');
  ok(opts({ factions: ['swarm', 'pioneers'] }).players[2].faction === 'ironclad' && opts({ factions: ['ironclad', 'swarm'] }).players[2].faction === 'pioneers', '어떤 조합이든 남은 진영이 중립세력');
  const v = RTS.netGameOpts({ map: 'ridge', seed: 1, settings: {}, factions: ['pioneers', 'ironclad'], names: ['a', 'b'], hc: ['none', 'none'] });
  ok(!v.coop && v.players.length === 3 && v.players.every(p => p.side === undefined) && v.players[2].faction === 'swarm', '대전에도 중립세력이 나오고 셋이 서로 적'); }

// 2. 시작 위치, 진영 구성
for (const map of Object.keys(RTS.defs.maps)) for (const fs of [['pioneers', 'ironclad'], ['swarm', 'pioneers'], ['ironclad', 'swarm']]) {
  const G = RTS.createGame(opts({ map, factions: fs })), h = [0, 1, 2].map(t => hqOf(G, t)), fac = fs.join('+');
  const d01 = Math.hypot(h[0].x - h[1].x, h[0].y - h[1].y), d02 = Math.hypot(h[0].x - h[2].x, h[0].y - h[2].y), d12 = Math.hypot(h[1].x - h[2].x, h[1].y - h[2].y);
  const same = new Set(G.teams.map(t => t.faction)).size === 3 && h.every((e, i) => e.def === RTS.defs.factions[G.teams[i].faction].hq);
  const workers = [0, 1, 2].map(t => G.ents.filter(e => e.team === t && D[e.def].gather).length);
  ok(h.every(Boolean) && d01 < d02 && d01 < d12 && same && workers.every(n => n === 5), `${map}/${fac}: 사령부 3 · 동료끼리 가까움(${d01.toFixed(0)} < ${Math.min(d02, d12).toFixed(0)}) · 세 진영 각자 사령부·일꾼 5`);
}

// 3. 동맹 판정
{ const G = RTS.createGame(opts());
  ok(!RTS.foe(G, 0, 1) && !RTS.foe(G, 1, 0) && RTS.foe(G, 0, 2) && RTS.foe(G, 1, 2) && RTS.foe(G, 2, 0), '적대 판정: 동료끼리 아님, 중립세력과는 적');
  const h0 = hqOf(G, 0), u1 = RTS.spawn(G, 'p_rifle' in D ? 'p_rifle' : Object.keys(D).find(k => D[k].kind === 'unit' && D[k].weapon), 1, h0.x + 3, h0.y), hp = h0.hp;
  RTS.damage(G, h0, 50, u1); ok(h0.hp === hp, '동료 공격 피해 0');
  const u2 = RTS.spawn(G, u1.def, 2, h0.x + 3, h0.y + 1); RTS.damage(G, h0, 50, u2); ok(h0.hp < hp, '중립세력 공격은 피해');
  RTS.updateFog(G, true); const h1 = hqOf(G, 1), t1 = G.teams[1];
  ok(t1.vis[(h0.y | 0) * G.w + (h0.x | 0)] === 1 && G.teams[0].vis[(h1.y | 0) * G.w + (h1.x | 0)] === 1, '동료 시야 공유');
  const h2 = hqOf(G, 2); ok(!t1.vis[(h2.y | 0) * G.w + (h2.x | 0)], '중립세력 본진은 처음에 안 보임');
  const n = G.teams[2], d = RTS.aiDiff(n), b = RTS.defs.difficulties.normal;
  ok(Math.abs(n.inc - b.income * 1.3) < 1e-9 && d.interval < b.interval && d.waveSize > b.waveSize && d.firstAttack < b.firstAttack, `중립세력 성능 130%: 수입 ${n.inc.toFixed(2)}(보통 ${b.income}), 판단 ${d.interval}틱(${b.interval}), 공격 규모 ${d.waveSize}(${b.waveSize}), 첫 공격 ${d.firstAttack}초(${b.firstAttack})`); }

// 4. 편 단위 승패
{ const G = RTS.createGame(opts()); let over = null; RTS.on(G, 'gameover', o => { over = o; });
  for (const e of G.ents) if (e.team === 0) RTS.kill(G, e, null, true);
  for (let i = 0; i < 20; i++) RTS.step(G); ok(!G.over, '사람 하나가 전멸해도 동료가 남으면 계속');
  for (const e of G.ents) if (e.team === 2) RTS.kill(G, e, null, true);
  for (let i = 0; i < 20; i++) RTS.step(G); ok(over && over.side === 0, '중립세력 전멸 → 사람 편 승리'); }
{ const G = RTS.createGame(opts()); for (const e of G.ents) if (e.team === 0 || e.team === 1) RTS.kill(G, e, null, true);
  for (let i = 0; i < 20; i++) RTS.step(G); ok(G.over && G.over.side === 1, '사람 둘 전멸 → 패배'); }

// 5. 두 기기 lockstep: 중립세력 AI가 양쪽에서 똑같이 움직이는지
{ const o = JSON.stringify(opts({ seed: 4242 })), net = prng(99), wire = [], cl = []; let step = 0;
  for (const team of [0, 1]) { const G = RTS.createGame(JSON.parse(o)), c = { G, r: prng(team + 5), desync: null };
    c.L = RTS.Lockstep({ team, send: m => wire.push({ to: 1 - team, at: step + Math.floor(net() * 6), msg: JSON.stringify(m) }), onDesync: d => { c.desync = d; } }); cl.push(c); }
  for (step = 0; step < 9000; step++) {
    for (let i = wire.length - 1; i >= 0; i--) if (wire[i].at <= step) { cl[wire[i].to].L.receive(JSON.parse(wire[i].msg)); wire.splice(i, 1); }
    for (const c of cl) { const G = c.G, me = c.L.team;
      if (step % 37 === 0) { const army = G.ents.filter(e => e.team === me && D[e.def].kind === 'unit' && !D[e.def].gather && !e.dead), b = G.ents.find(e => e.team === me && D[e.def].trains && !D[e.def].dropoff && RTS.complete(e));
        if (b) c.L.local({ type: 'train', building: b.id, unit: D[b.def].trains[0] });
        if (army.length > 6) { const goal = hqOf(G, 2) || { x: G.w / 2, y: G.h / 2 }; c.L.local({ type: 'order', ids: army.map(u => u.id), order: { type: 'amove', x: goal.x, y: goal.y } }); } }
      if (step % 53 === 0) { const f = RTS.defs.factions[G.teams[me].faction], w = G.ents.find(e => e.team === me && D[e.def].gather), list = D[f.worker].builds || [];
        if (w && list.length) { const id = list[Math.floor(c.r() * list.length)]; c.L.local({ type: 'place', ids: [w.id], def: id, tx: Math.floor(w.x + (c.r() - .5) * 10), ty: Math.floor(w.y + (c.r() - .5) * 10) }); } }
      c.L.advance(G); } }
  const [a, b] = cl.map(c => c.G);
  ok(a.tick > 3000 && a.tick === b.tick && RTS.stateHash(a) === RTS.stateHash(b) && !cl[0].desync && !cl[1].desync, `두 기기 상태 동일 (틱 ${a.tick}, 중립세력 생산 ${a.teams[2].stats.made} · 잃은 수 ${a.teams[2].stats.lost} · 남은 개체 ${a.teams[2].alive} · 끝남 ${!!a.over})`); }

// 6. AI 둘이 한 편(보통 100%) vs 중립세력(보통 130%): 끝까지 진행되고 동료끼리 싸우지 않는지
for (const [map, seed] of [['ridge', 3], ['canyon', 5], ['lake', 8]]) {
  const o = opts({ map, seed }); o.players[0].ai = 'normal'; o.players[1].ai = 'normal';
  const G = RTS.createGame(o); let friendly = 0;
  RTS.on(G, 'attacked', ({ e, src }) => { if (src && src.team !== e.team && RTS.ally(G, src.team, e.team)) friendly++; });
  while (!G.over && G.tick < 20 * 60 * 25) RTS.step(G);
  const lost = G.teams.map(t => t.stats.lost);
  ok(friendly === 0 && G.teams[2].stats.made > 0 && G.teams[2].stats.kills > 0, `${map}: ${G.over ? (G.over.side === 0 ? '사람 편 승리' : '중립세력 승리') : '25분 무승부'} ${(G.tick / 1200).toFixed(1)}분 · 잃은 수 ${lost.join('/')} · 중립세력 생산 ${G.teams[2].stats.made} · 동료 오사 ${friendly}`);
}

console.log(fail ? `실패 ${fail}` : '협동 검사 통과'); process.exit(fail ? 1 : 0);
