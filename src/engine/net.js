// net.js — 2인 대전용 lockstep. DOM을 쓰지 않는다(전송 수단은 send 함수로 받는다).
// 원리: 두 기기가 같은 시드·설정으로 같은 게임을 만들고, 입력만 주고받는다.
//  - 시간을 TURN틱 단위 '턴'으로 나눈다. 내 입력은 DELAY턴 뒤 턴에 실행되도록 예약해 상대에게 보낸다.
//  - 어떤 턴은 양쪽 입력 묶음이 모두 도착해야 시작한다. 입력이 없어도 빈 묶음을 보낸다.
//  - HASH_EVERY턴마다 게임 상태 해시를 실어 보내 서로 비교한다. 다르면 onDesync를 부른다.
RTS.NET = { TURN: 2, DELAY: 3, HASH_EVERY: 25 };

// 게임 상태 요약 해시(FNV-1a). 좌표·체력은 소수 셋째 자리까지만 본다.
RTS.stateHash = function (G) {
  let h = 0x811c9dc5;
  const mix = v => { v = v | 0; for (let i = 0; i < 4; i++) { h ^= (v >>> (i * 8)) & 255; h = Math.imul(h, 0x01000193); } };
  const q = v => Math.round((v || 0) * 1000);
  mix(G.tick); mix(G.rng); mix(G.nextId); mix(G.ents.length);
  for (const e of G.ents) { mix(e.id); mix(e.team); mix(q(e.x)); mix(q(e.y)); mix(q(e.hp)); mix(e.order ? e.order.type.length : 0); }
  for (const t of G.teams) { mix(q(t.res.ore)); mix(q(t.res.gas)); mix(t.sup); mix(t.cap); }
  if (G.market) for (const c of Object.values(G.market.cos)) { mix(q(c.price)); mix(c.owner); mix(c.free); }
  return h >>> 0;
};

// L = RTS.Lockstep({ team, send:msg=>{}, onDesync:info=>{} })
// 게임 루프: 매 틱 전에 L.ready(G)가 참일 때만 L.inject(G); RTS.step(G);
// 상대 메시지는 L.receive(msg). 내 입력은 L.local(cmd).
RTS.Lockstep = function (o) {
  const N = RTS.NET, L = { team: o.team, pending: [], mine: {}, theirs: {}, sentUpTo: -1, hashes: {}, theirHashes: {}, desync: null, stalls: 0 };
  for (let n = 0; n < N.DELAY; n++) { L.mine[n] = []; L.theirs[n] = []; }
  L.local = cmd => { L.pending.push(cmd); };
  L.receive = msg => {
    if (msg.t !== 'turn') return;
    L.theirs[msg.n] = msg.cmds || [];
    if (msg.hn !== undefined) { L.theirHashes[msg.hn] = msg.h; check(msg.hn); }
  };
  function check(n) {
    if (L.desync || L.hashes[n] === undefined || L.theirHashes[n] === undefined) return;
    if (L.hashes[n] !== L.theirHashes[n]) { L.desync = { turn: n, mine: L.hashes[n], theirs: L.theirHashes[n] }; if (o.onDesync) o.onDesync(L.desync); }
  }
  // 턴 경계에서 DELAY턴 뒤 묶음을 확정해 보낸다. 해시는 그 턴 시작 직전 상태 기준.
  function flush(G, n) {
    const out = n + N.DELAY; if (out <= L.sentUpTo) return;
    const msg = { t: 'turn', n: out, cmds: JSON.parse(JSON.stringify(L.pending.map(c => Object.assign({}, c, { team: L.team })))) };
    L.pending = []; L.mine[out] = msg.cmds; L.sentUpTo = out;
    if (n % N.HASH_EVERY === 0) { L.hashes[n] = RTS.stateHash(G); msg.hn = n; msg.h = L.hashes[n]; check(n); }
    o.send(msg);
  }
  L.turnOf = G => Math.floor(G.tick / N.TURN);
  L.ready = G => {
    if (G.tick % N.TURN) return true;
    const n = L.turnOf(G); flush(G, n);
    const ok = L.mine[n] !== undefined && L.theirs[n] !== undefined; if (!ok) L.stalls++; return ok;
  };
  // 턴 첫 틱에 두 묶음을 팀 번호 순서로 넣는다. 양쪽 기기가 똑같은 순서를 쓰게 하기 위해서다.
  L.inject = G => {
    if (G.tick % N.TURN) return;
    const n = L.turnOf(G), a = L.mine[n], b = L.theirs[n], list = L.team === 0 ? a.concat(b) : b.concat(a);
    for (const c of list) G.cmds.push(c);
    delete L.mine[n]; delete L.theirs[n];
    for (const k of Object.keys(L.hashes)) if (k < n - 200) { delete L.hashes[k]; delete L.theirHashes[k]; }
  };
  L.advance = G => { if (G.over || !L.ready(G)) return false; L.inject(G); RTS.step(G); return true; };
  return L;
};

// 두 사람 게임 시작 옵션. 호스트가 만들어 상대에게 그대로 보낸다.
// hc: 팀별 핸디캡 단계 id(RTS.HANDICAPS), 0번 팀이 호스트.
// 두 사람은 서로 다른 진영을 고르고, 남은 진영이 중립세력(2번 팀 AI)이 된다. 중립세력은 두 방식 모두에 나온다.
//   coop: 두 사람이 같은 편(side 0), 중립세력은 side 1. 아니면 셋이 모두 서로 적이다(마지막까지 남는 쪽이 승리).
//   boost: 보통 AI 대비 성능 배율(기본 1.3), level: 기준 난이도
RTS.COOP = { name: '중립세력', level: 'normal', boost: 1.3, boosts: [1, 1.15, 1.3, 1.5, 1.7] };
RTS.restFaction = used => Object.keys(RTS.defs.factions).find(f => !used.includes(f)) || used[0];
RTS.netGameOpts = function (o) {
  const p = [{ faction: o.factions[0], name: o.names[0], hc: o.hc[0] }, { faction: o.factions[1], name: o.names[1], hc: o.hc[1] }];
  if (o.coop) p.forEach(x => { x.side = 0; });
  const n = { faction: o.enemy || RTS.restFaction(o.factions), name: RTS.COOP.name, ai: o.level || RTS.COOP.level, boost: o.boost || RTS.COOP.boost };
  if (o.coop) n.side = 1;
  p.push(n);
  return { map: o.map, seed: o.seed, settings: o.settings, net: true, coop: !!o.coop, players: p };
};
