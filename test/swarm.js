// node test/swarm.js — 포자군락(세 번째 진영)과 셋이 대전 검사.
// 변태 건설(일꾼 소모), 재생, 산성·광분 능력, 세 진영 AI 맞대결, 셋이 대전 시작 위치·승패·나만 전멸, 두 기기 동일.
const fs = require('fs'), path = require('path');
for (const f of ['engine/core','engine/map','engine/sim','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','engine/net','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const D = RTS.defs.entities, hqOf = (G, t) => G.ents.find(e => e.team === t && D[e.def].dropoff && !e.dead);
const run = (G, n) => { for (let i = 0; i < n && !G.over; i++) RTS.step(G); };

// 1. 콘텐츠: 진영 3개, 모든 생산·건설·연구 대상이 정의되어 있음
{ const F = RTS.defs.factions; ok(Object.keys(F).length === 3 && F.swarm && F.swarm.morph && F.swarm.regen > 0, '진영 3개(개척단·철갑회·포자군락)');
  const bad = []; for (const [id, d] of Object.entries(D)) { if (!id.startsWith('s_')) continue; for (const x of [...(d.trains || []), ...(d.builds || []), ...(d.requires || [])]) if (!D[x]) bad.push(id + '→' + x); for (const x of d.researches || []) if (!RTS.defs.upgrades[x]) bad.push(id + '→' + x); for (const x of d.abilities || []) if (!RTS.defs.abilities[x]) bad.push(id + '→' + x); }
  ok(!bad.length, '포자군락 참조 모두 존재 ' + bad.join(' '));
  const A = F.swarm.ai; ok(A.build.every(s => D[s.b]) && A.army.every(a => D[a.u]) && A.research.every(r => RTS.defs.upgrades[r]), 'AI 빌드 오더·병력·연구 항목 존재'); }

// 2. 변태 건설: 일꾼이 사라지고 건물이 스스로 완공
{ const G = RTS.createGame({ map: 'ridge', seed: 3, players: [{ faction: 'swarm' }, { faction: 'pioneers' }] }), t = G.teams[0]; t.res.ore = 1000;
  run(G, 20); const hq = hqOf(G, 0), n0 = G.ents.filter(e => e.team === 0 && D[e.def].gather).length, w = G.ents.find(e => e.team === 0 && D[e.def].gather);
  const spot = RTS.aiSpot(G, t, 's_pool', hq); RTS.command(G, 0, { type: 'place', ids: [w.id], def: 's_pool', tx: spot.x, ty: spot.y }); run(G, 20 * 8);
  const pool = G.ents.find(e => e.def === 's_pool'), n1 = G.ents.filter(e => e.team === 0 && D[e.def].gather).length;
  ok(pool && pool.active && !G.byId[w.id] && n1 === n0 - 1, `변태: 일꾼 ${n0}→${n1}, 번식굴 공사 시작`);
  run(G, 20 * 32); ok(RTS.complete(pool) && t.stats.lost === 0, '번식굴 스스로 완공, 잃은 수에 세지 않음');
  // 재생
  const c = RTS.spawn(G, 's_claw', 0, hq.x + 4, hq.y); c.hp = 10; const h = hqOf(G, 0); h.hp -= 200; const hb = h.hp; run(G, 20 * 10);
  ok(c.hp >= 15 && h.hp > hb, `재생: 갈퀴충 10→${c.hp.toFixed(1)}, 군락핵 +${(h.hp - hb).toFixed(1)}`);
  const p = RTS.spawn(G, 'p_rifle', 1, 50, 50); p.hp = 10; run(G, 20 * 5); ok(p.hp === 10, '다른 진영은 재생 없음'); }

// 3. 능력: 산성 분사(연구 필요), 광분
{ const G = RTS.createGame({ map: 'ridge', seed: 4, players: [{ faction: 'swarm' }, { faction: 'pioneers' }] });
  const sp = RTS.spawn(G, 's_spitter', 0, 36, 36), foe = RTS.spawn(G, 'p_rifle', 1, 40, 36), hp0 = foe.hp;
  RTS.command(G, 0, { type: 'ability', ids: [sp.id], ability: 'acid', x: foe.x, y: foe.y }); run(G, 1); ok(!(sp.order && sp.order.type === 'cast') && !sp.cds.acid, '산성 분사: 연구 전 사용 불가');
  G.teams[0].upgrades.s_acid = true; foe.hp = hp0; RTS.issue(G, sp, null); sp.cd = 999; RTS.command(G, 0, { type: 'ability', ids: [sp.id], ability: 'acid', x: foe.x, y: foe.y }); run(G, 30);
  ok(foe.hp <= hp0 - 25 + 1 && foe.buffs.some(b => b.id === 'acid'), `산성 분사: 피해 ${hp0 - foe.hp}, 감속 ${RTS.stat(G, foe, 'speed').toFixed(2)}/${D.p_rifle.speed}`);
  const br = RTS.spawn(G, 's_brute', 0, 20, 20); RTS.command(G, 0, { type: 'ability', ids: [br.id], ability: 'frenzy' }); run(G, 2); ok(RTS.stat(G, br, 'speed') > D.s_brute.speed * 1.3, '광분: 속도 +40%'); }

// 4. 세 진영 AI 맞대결(보통 vs 보통): 포자군락이 이기기도 지기도 하는지
{ const res = {}; const F = ['pioneers', 'ironclad', 'swarm'];
  for (const a of F) for (const b of F) { if (a === b) continue; for (const [map, seed] of [['ridge', 1], ['canyon', 2], ['lake', 3]]) {
    const G = RTS.createGame({ map, seed, settings: { newsEvery: 0 }, players: [{ faction: a, ai: 'normal' }, { faction: b, ai: 'normal' }] }); run(G, 20 * 60 * 25);
    const w = G.over ? G.teams[G.over.winner]?.faction || '무' : '무'; res[w] = (res[w] || 0) + 1; } }
  console.log('     AI 대전 18판 승수', JSON.stringify(res));
  ok((res.swarm || 0) >= 2 && (res.swarm || 0) <= 10, `포자군락 승수 ${res.swarm || 0}/12 (극단적이지 않음)`); }

// 5. 셋이 대전(협동 아님): 시작 위치, 서로 적, 나만 전멸해도 계속, 마지막 남은 쪽 승리
const vsOpts = (o = {}) => JSON.parse(JSON.stringify(RTS.netGameOpts(Object.assign({ map: 'ridge', seed: 11, settings: RTS.defaultSettings(), factions: ['pioneers', 'ironclad'], names: ['아빠', '아들'], hc: ['none', 'none'] }, o))));
for (const map of Object.keys(RTS.defs.maps)) { const G = RTS.createGame(vsOpts({ map })), h = [0, 1, 2].map(t => hqOf(G, t)), d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const diff = Math.abs(d(h[2], h[0]) - d(h[2], h[1]));
  ok(h.every(Boolean) && G.teams[2].faction === 'swarm' && RTS.foe(G, 0, 1) && RTS.foe(G, 0, 2) && RTS.foe(G, 1, 2), `${map}: 사령부 3, 셋 다 적, 중립세력 거리 차 ${diff.toFixed(1)} (0번 ${d(h[2], h[0]).toFixed(0)} · 1번 ${d(h[2], h[1]).toFixed(0)})`); }
{ const G = RTS.createGame(vsOpts()); for (const e of G.ents) if (e.team === 0) RTS.kill(G, e, null, true); run(G, 20);
  ok(!G.over && G.teams[0].alive === 0, '셋이 대전: 한 사람이 전멸해도 나머지 둘은 계속');
  for (const e of G.ents) if (e.team === 2) RTS.kill(G, e, null, true); run(G, 20); ok(G.over && G.over.winner === 1, '마지막 남은 사람 승리'); }

// 6. 셋이 대전 AI: 중립세력이 두 사람을 번갈아 노리는지(사람 자리는 보통 AI)
{ const o = vsOpts({ map: 'ridge', seed: 21 }); o.players[0].ai = 'normal'; o.players[1].ai = 'normal'; const G = RTS.createGame(o), tg = new Set(); let last;
  for (let i = 0; i < 20 * 60 * 25 && !G.over; i++) { RTS.step(G); const S = G.teams[2].aiState; if (S.attacking && S.tgt !== undefined && S.tgt !== last) { tg.add(S.tgt); last = S.tgt; } }
  ok(tg.has(0) && tg.has(1), `중립세력 공격 대상: ${[...tg].join(',')} · ${G.over ? G.teams[G.over.winner]?.name + ' 승리' : '무승부'} ${(G.tick / 1200).toFixed(1)}분`); }

// 7. 셋이 대전 두 기기 동일(중립세력 AI 포함)
{ const prng = s => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const o = JSON.stringify(vsOpts({ seed: 77, factions: ['swarm', 'ironclad'] })), net = prng(5), wire = [], cl = []; let step = 0;
  for (const team of [0, 1]) { const G = RTS.createGame(JSON.parse(o)), c = { G, desync: null }; c.L = RTS.Lockstep({ team, send: m => wire.push({ to: 1 - team, at: step + Math.floor(net() * 5), msg: JSON.stringify(m) }), onDesync: d => { c.desync = d; } }); cl.push(c); }
  for (step = 0; step < 7000; step++) { for (let i = wire.length - 1; i >= 0; i--) if (wire[i].at <= step) { cl[wire[i].to].L.receive(JSON.parse(wire[i].msg)); wire.splice(i, 1); }
    for (const c of cl) { const G = c.G, me = c.L.team; if (step % 41 === 0) { const b = G.ents.find(e => e.team === me && D[e.def].trains && D[e.def].dropoff); if (b) c.L.local({ type: 'train', building: b.id, unit: D[b.def].trains[0] }); } c.L.advance(G); } }
  const [a, b] = cl.map(c => c.G); ok(a.tick > 3000 && a.tick === b.tick && RTS.stateHash(a) === RTS.stateHash(b) && !cl[0].desync, `두 기기 상태 동일 (틱 ${a.tick}, 중립세력 생산 ${a.teams[2].stats.made})`); }

console.log(fail ? `실패 ${fail}` : '포자군락·셋이 대전 검사 통과'); process.exit(fail ? 1 : 0);
