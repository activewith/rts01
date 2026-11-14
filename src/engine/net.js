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
  for (const e of G.ents) { mix(e.id); mix(e.team); mix(q(e.x)); mix(q(e.y)); mix(q(e.hp)); mix(e.order ? e.order.type.length : 0); mix((e.lv || 0) + (e.rank || 0) * 4 + (e.merging ? 16 : 0)); }
  for (const t of G.teams) { mix(q(t.res.ore)); mix(q(t.res.gas)); mix(t.sup); mix(t.cap); }
  if (G.market) for (const c of Object.values(G.market.cos)) { mix(q(c.price)); mix(c.owner); mix(c.free); }
  return h >>> 0;
};

// L = RTS.Lockstep({ team, send:msg=>{}, onDesync:info=>{}, start, carry })
// 게임 루프: 매 틱 전에 L.ready(G)가 참일 때만 L.inject(G); RTS.step(G);
// 상대 메시지는 L.receive(msg). 내 입력은 L.local(cmd).
// 재접속: 남아 있던 기기가 턴 경계(아직 그 턴을 넣기 전)에서 상태를 보내면, 두 기기 모두 그 상태를 복원하고
//   start = 그 턴 번호로 새 Lockstep을 만든다. start 이전 턴의 메시지와 이전 연결의 메시지(epoch가 다름)는 버린다.
//   carry: 이전 Lockstep에서 보냈지만 실행되지 못한 내 입력(L.carry()). 새 Lockstep의 첫 묶음으로 다시 보낸다.
RTS.Lockstep = function (o) {
  const N = RTS.NET, s = o.start || 0;
  const L = { team: o.team, epoch: s, pending: (o.carry || []).slice(), mine: {}, theirs: {}, sentUpTo: s + N.DELAY - 1, hashes: {}, theirHashes: {}, desync: null, stalls: 0 };
  for (let n = s; n < s + N.DELAY; n++) { L.mine[n] = []; L.theirs[n] = []; }
  L.local = cmd => { L.pending.push(cmd); };
  L.receive = msg => {
    if (msg.t !== 'turn' || (msg.e || 0) !== L.epoch || msg.n < s) return;
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
    const msg = { t: 'turn', e: L.epoch, n: out, cmds: JSON.parse(JSON.stringify(L.pending.map(c => Object.assign({}, c, { team: L.team })))) };
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
  // 아직 실행되지 않은 내 입력(보낸 묶음 + 대기 중). 재접속 때 새 Lockstep으로 넘긴다
  L.carry = () => { const out = []; for (const k of Object.keys(L.mine).map(Number).sort((a, b) => a - b)) out.push(...L.mine[k]); return out.concat(L.pending).map(c => { const x = Object.assign({}, c); delete x.team; return x; }); };
  return L;
};
// 재접속 지점: 턴 경계이고 그 턴을 아직 넣지 않았을 때만 상태를 보낼 수 있다
RTS.syncPoint = G => G.tick % RTS.NET.TURN === 0;

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
