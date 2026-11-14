// node test/rejoin.js — 2인 대전 재접속 검사
// 두 '기기'가 lockstep으로 돌다가 연결이 끊긴다(전송 중이던 메시지는 사라지거나 늦게 도착).
// 남은 기기(acceptor)가 턴 경계에서 상태를 직렬화해 보내고, 두 기기 모두 그 상태로 새 Lockstep을 시작한다.
// 끝까지 두 기기 상태가 같고 해시 어긋남이 없어야 한다. 방장(0번)이 나간 경우와 참가자(1번)가 나간 경우 모두 본다.
const fs = require('fs'), path = require('path');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','engine/net','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const prng = s => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function bot(G, L, r) {
  const me = L.team, D = RTS.defs.entities, mine = G.ents.filter(e => e.team === me && !e.dead);
  const units = mine.filter(e => D[e.def].kind === 'unit' && !D[e.def].uncontrollable), blds = mine.filter(e => D[e.def].kind === 'building' && RTS.complete(e));
  const roll = r();
  if (roll < .3 && blds.length) { const b = blds[Math.floor(r() * blds.length)], tr = D[b.def].trains || []; if (tr.length) L.local({ type: 'train', building: b.id, unit: tr[Math.floor(r() * tr.length)] }); }
  else if (roll < .5) { const f = RTS.defs.factions[G.teams[me].faction], w = units.find(u => D[u.def].gather), list = D[f.worker].builds || []; if (w && list.length) L.local({ type: 'place', ids: [w.id], def: list[Math.floor(r() * list.length)], tx: Math.floor(w.x + (r() - .5) * 12), ty: Math.floor(w.y + (r() - .5) * 12) }); }
  else if (roll < .65) { const army = units.filter(u => !D[u.def].gather); if (army.length) L.local({ type: 'order', ids: army.map(u => u.id), order: { type: 'amove', x: r() * G.w, y: r() * G.h } }); }
  else if (roll < .75 && blds.length) L.local({ type: 'levelup', building: blds[Math.floor(r() * blds.length)].id });
  else if (roll < .8 && units.length) L.local({ type: 'rankup', ids: units.slice(0, 3).map(u => u.id) });
  else if (roll < .85) { const cos = Object.keys(G.market.cos); L.local({ type: 'trade', company: cos[Math.floor(r() * cos.length)], qty: 5 }); }
}

// cut: [끊기는 step, 다시 붙는 step], acceptor: 남은 기기 팀, ahead: 끊긴 쪽이 몇 틱 앞서 있게 할지(먼저 받은 입력으로 진행)
function play({ seed, ticks, jitter, cut, acceptor, coop }) {
  const opts = JSON.parse(JSON.stringify(RTS.netGameOpts({ map: 'ridge', seed, settings: RTS.defaultSettings(), factions: ['pioneers', 'swarm'], names: ['아빠', '아들'], hc: ['none', 'none'], coop })));
  const net = prng(seed * 7 + 1), wire = [], cs = [];
  let step = 0, online = true, epoch = 0;
  const sender = team => msg => { if (online) wire.push({ to: 1 - team, at: step + Math.floor(net() * jitter), msg: JSON.stringify(msg), ep: epoch }); else if (net() < .5) wire.push({ to: 1 - team, at: step + 40, msg: JSON.stringify(msg), ep: -1 }); }; // 끊긴 동안 보낸 일부는 '이전 연결'로 한참 뒤 도착
  for (const team of [0, 1]) { const c = { team, G: RTS.createGame(opts), r: prng(seed * 31 + team) }; c.L = RTS.Lockstep({ team, send: sender(team), onDesync: d => { c.desync = d; } }); cs.push(c); }
  let resynced = null, carried = 0;
  while (cs.some(c => c.G.tick < ticks && !c.G.over) && step < ticks * 40) {
    step++;
    if (step === cut[0]) online = false;
    if (step === cut[1]) { // 재접속: 남은 기기가 턴 경계까지 진행한 뒤 상태를 보낸다
      const A = cs[acceptor], B = cs[1 - acceptor];
      while (!RTS.syncPoint(A.G)) A.L.advance(A.G); // 실제 앱에서는 멈춘 지점이 곧 턴 경계다
      const n = A.G.tick / RTS.NET.TURN, carry = A.L.carry(), json = RTS.serialize(A.G);
      carried = carry.length; epoch++;
      for (let i = wire.length - 1; i >= 0; i--) if (wire[i].ep >= 0) wire.splice(i, 1); // 이전 연결의 메시지는 사라진다(늦게 오는 것은 남김)
      resynced = { n, tickA: A.G.tick, tickB: B.G.tick };
      for (const c of [A, B]) { c.G = RTS.deserialize(json); c.desync = null; c.L = RTS.Lockstep({ team: c.team, send: sender(c.team), onDesync: d => { c.desync = d; }, start: n, carry: c === A ? carry : [] }); }
      online = true;
    }
    for (let i = wire.length - 1; i >= 0; i--) if (wire[i].at <= step) { const w = wire.splice(i, 1)[0]; if (online || w.ep < 0) cs[w.to].L.receive(JSON.parse(w.msg)); }
    for (const c of cs) {
      if (c.G.tick >= ticks || c.G.over || net() < .3) continue;
      if (c.G.tick % 5 === 0 && c.r() < .6) bot(c.G, c.L, c.r);
      c.L.advance(c.G);
    }
  }
  return { cs, resynced, carried };
}

for (const [seed, acceptor, jitter, coop] of [[4, 0, 2, false], [8, 1, 6, false], [15, 1, 12, true], [23, 0, 9, true]]) {
  const t0 = Date.now(), { cs: [A, B], resynced, carried } = play({ seed, ticks: 20 * 60 * 5, jitter, cut: [2600, 3400], acceptor, coop });
  const same = A.G.tick === B.G.tick && RTS.serialize(A.G) === RTS.serialize(B.G);
  ok(same && !A.desync && !B.desync && resynced && resynced.n * 2 === resynced.tickA, `seed ${seed} ${acceptor === 0 ? '참가자가' : '방장이'} 나감·${coop ? '협동' : '대전'}: 재접속 턴 ${resynced && resynced.n} (남은 기기 틱 ${resynced && resynced.tickA}, 나간 기기 틱 ${resynced && resynced.tickB}) · 넘긴 입력 ${carried} · 끝 틱 ${A.G.tick}/${B.G.tick} 동일 ${same} · 강화 건물 ${A.G.ents.filter(e => e.lv).length} · ${Date.now() - t0}ms`);
}
// 이전 연결 메시지는 epoch가 달라 버린다
{ const L = RTS.Lockstep({ team: 0, send: () => {}, start: 100 });
  L.receive({ t: 'turn', e: 0, n: 101, cmds: [{ type: 'x' }] }); L.receive({ t: 'turn', e: 100, n: 99, cmds: [{ type: 'y' }] }); L.receive({ t: 'turn', e: 100, n: 103, cmds: [{ type: 'z' }] });
  ok(L.theirs[101].length === 0 && L.theirs[99] === undefined && L.theirs[103][0].type === 'z', '재시작한 Lockstep은 이전 연결·이전 턴 메시지를 버린다'); }
// carry: 보냈지만 실행되지 못한 입력이 순서대로 넘어간다
{ const sent = [], L = RTS.Lockstep({ team: 1, send: m => sent.push(m) }), G = { tick: 2 };
  L.local({ type: 'a' }); L.ready(G); L.local({ type: 'b' });
  const c = L.carry(); ok(c.map(x => x.type).join('') === 'ab' && c.every(x => x.team === undefined), 'carry는 보낸 묶음과 대기 입력을 순서대로 돌려준다'); }
console.log(fail ? `실패 ${fail}건` : '재접속 검사 통과'); process.exit(fail ? 1 : 0);
