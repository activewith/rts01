// node test/net.js — 2인 lockstep 검사.
// 두 '기기'가 각자 게임을 만들고, 무작위 입력을 지연·순서 뒤섞임이 있는 가짜 네트워크로 주고받는다.
// 끝에 두 게임 상태가 완전히 같은지, 일부러 어긋나게 하면 해시 검사가 잡아내는지 본다.
const fs = require('fs'), path = require('path');
for (const f of ['engine/core','engine/map','engine/sim','engine/market','engine/war','engine/diplomacy','engine/ai','engine/net','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };

// 시뮬레이션 밖의 난수(봇·네트워크용). G.rng를 건드리지 않는다.
const prng = s => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// 사람 흉내 봇: 자기 기기의 게임 상태를 읽기만 하고, 입력은 L.local로만 낸다.
function bot(G, L, r) {
  const me = L.team, D = RTS.defs.entities, mine = G.ents.filter(e => e.team === me && !e.dead), t = G.teams[me];
  const units = mine.filter(e => D[e.def].kind === 'unit' && !D[e.def].uncontrollable), blds = mine.filter(e => D[e.def].kind === 'building' && RTS.complete(e));
  const roll = r();
  if (roll < .25 && blds.length) { const b = blds[Math.floor(r() * blds.length)], tr = D[b.def].trains || []; if (tr.length) L.local({ type: 'train', building: b.id, unit: tr[Math.floor(r() * tr.length)] }); }
  else if (roll < .45) { const f = RTS.defs.factions[t.faction], w = units.find(u => D[u.def].gather), list = D[f.worker].builds || []; if (w && list.length) { const id = list[Math.floor(r() * list.length)]; L.local({ type: 'place', ids: [w.id], def: id, tx: Math.floor(w.x + (r() - .5) * 12), ty: Math.floor(w.y + (r() - .5) * 12) }); } }
  else if (roll < .65) { const army = units.filter(u => !D[u.def].gather); if (army.length) { const foe = G.ents.find(e => e.team === 1 - me && D[e.def].kind === 'building'); const x = foe ? foe.x : r() * G.w, y = foe ? foe.y : r() * G.h; L.local({ type: 'order', ids: army.map(u => u.id), order: { type: 'amove', x: x + r() * 0.37, y: y + r() * 0.91 } }); } }
  else if (roll < .75) { const cos = Object.keys(G.market.cos); L.local({ type: 'trade', company: cos[Math.floor(r() * cos.length)], qty: r() < .6 ? 5 : -5 }); }
  else if (roll < .8) { const bs = Object.keys(G.dip.list); L.local({ type: 'barter', branch: bs[Math.floor(r() * bs.length)], buy: r() < .5 }); }
  else if (roll < .85 && units.length) { const u = units[Math.floor(r() * units.length)]; L.local({ type: 'order', ids: [u.id], order: { type: 'move', x: r() * G.w, y: r() * G.h } }); }
}

function play({ seed, ticks, jitter, settings, hc, factions, breakAt }) {
  // 방장이 만든 시작 옵션을 JSON으로 보낸 것처럼 양쪽에 똑같이 전달
  const opts = JSON.stringify(RTS.netGameOpts({ map: 'ridge', seed, settings: Object.assign(RTS.defaultSettings(), settings), factions, names: ['아빠', '아들'], hc }));
  const net = prng(seed * 7 + 1), wire = [], clients = [];
  for (const team of [0, 1]) {
    const G = RTS.createGame(JSON.parse(opts)), c = { G, desync: null, r: prng(seed * 31 + team) };
    c.L = RTS.Lockstep({ team, send: msg => wire.push({ to: 1 - team, at: step + Math.floor(net() * jitter), msg: JSON.stringify(msg) }), onDesync: d => { c.desync = d; } });
    clients.push(c);
  }
  let step = 0, guard = 0;
  while (clients.some(c => c.G.tick < ticks && !c.G.over) && guard++ < ticks * 40) {
    step++;
    for (let i = wire.length - 1; i >= 0; i--) if (wire[i].at <= step) { const w = wire.splice(i, 1)[0]; clients[w.to].L.receive(JSON.parse(w.msg)); } // 도착 순서는 뒤섞인다
    for (const c of clients) {
      if (c.G.tick >= ticks || c.G.over) continue;
      if (net() < .3) continue; // 기기마다 속도가 조금씩 다르다
      if (c.G.tick % 7 === 0 && c.r() < .5) bot(c.G, c.L, c.r);
      if (breakAt && c.L.team === 1 && c.G.tick === breakAt) c.G.teams[1].res.ore += 1; // 일부러 어긋나게
      c.L.advance(c.G);
    }
  }
  return clients;
}

// 1) 여러 시드·지연에서 끝까지 같은 상태인지
for (const [seed, jitter, hc] of [[3, 1, ['none', 'none']], [11, 6, ['none', 'big']], [29, 15, ['mid', 'light']]]) {
  const t0 = Date.now(), [A, B] = play({ seed, ticks: 20 * 60 * 6, jitter, hc, factions: ['pioneers', 'ironclad'] });
  const same = A.G.tick === B.G.tick && RTS.serialize(A.G) === RTS.serialize(B.G);
  const made = A.G.teams.map(t => t.stats.made).join('/'), kills = A.G.teams.map(t => t.stats.kills).join('/');
  ok(same && !A.desync && !B.desync, `seed ${seed} 지연 ${jitter} 핸디캡 ${hc}: 틱 ${A.G.tick}/${B.G.tick} 상태 동일 ${same} · 생산 ${made} · 처치 ${kills} · 멈춤 ${A.L.stalls}/${B.L.stalls} · ${Date.now() - t0}ms`);
}
// 2) 어긋남 감지
{ const [A, B] = play({ seed: 5, ticks: 20 * 60 * 2, jitter: 3, hc: ['none', 'none'], factions: ['ironclad', 'pioneers'], breakAt: 400 });
  ok(!!(A.desync || B.desync), '일부러 어긋나게 하면 해시 검사가 잡는다: ' + JSON.stringify(A.desync || B.desync)); }
// 3) 핸디캡 적용
{ const G = RTS.createGame(RTS.netGameOpts({ map: 'canyon', seed: 9, settings: RTS.defaultSettings(), factions: ['pioneers', 'ironclad'], names: ['a', 'b'], hc: ['none', 'big'] }));
  const towers = id => G.ents.filter(e => e.team === id && e.def === RTS.defs.factions[G.teams[id].faction].defense).length;
  ok(G.teams[1].res.ore === G.teams[0].res.ore + 600 && G.teams[1].inc === 1.35 && G.teams[0].inc === 1, '핸디캡 자원·수입: ' + G.teams.map(t => t.res.ore + '/' + t.inc).join(' '));
  ok(towers(0) === 0 && towers(1) >= 5 && towers(1) <= 10, `핸디캡 방어탑: ${towers(0)} / ${towers(1)}`);
  for (let i = 0; i < 40; i++) RTS.step(G);
  ok(G.teams[1].vis.every(v => v) && !G.teams[0].vis.every(v => v), '핸디캡 맵 공개는 해당 팀만'); }
console.log(fail ? `실패 ${fail}건` : '2인 대전 검사 통과'); process.exit(fail ? 1 : 0);
