// ─────────────────────────────────────────────────────────────
// core.js — 네임스페이스, 데이터 레지스트리, 모드 API, 난수, 게임 생성
// 규칙: engine/ 폴더는 DOM을 쓰지 않는다. Node에서도 그대로 돌아간다.
// 좌표 단위는 타일(float). 시뮬레이션은 20틱/초 고정이며 결정적이다.
// ─────────────────────────────────────────────────────────────
const RTS = (globalThis.RTS = globalThis.RTS || {});
RTS.version = '0.1.0';
RTS.HZ = 20;
RTS.defs = { terrain: {}, entities: {}, upgrades: {}, abilities: {}, factions: {}, maps: {}, mapgens: {}, difficulties: {}, companies: {}, marketEvents: {}, branches: {}, tribeMissions: {} };
RTS.TRIBE = -2;       // 잿빛 부족(AI 중립 세력)의 팀 번호. -1은 자원·거점 같은 비활성 중립
RTS.orders = {};      // 유닛 명령 핸들러: RTS.orders.move = (G,u,o)=>...
RTS.systems = [];     // 틱 파이프라인: [{id, run(G)}]
RTS.commands = {};    // 플레이어 입력 처리기: RTS.commands.train = (G,team,cmd)=>...

// 콘텐츠 추가는 전부 이 함수 하나로 한다. 같은 id는 덮어쓴다.
RTS.mod = function (pack) {
  for (const k of Object.keys(pack)) {
    if (!RTS.defs[k]) throw new Error('알 수 없는 콘텐츠 종류: ' + k);
    for (const id of Object.keys(pack[k])) RTS.defs[k][id] = Object.assign({ id }, pack[k][id]);
  }
};
// 기존 정의 일부만 수정: RTS.patch('entities','p_rifle',{hp:60})
RTS.patch = (kind, id, change) => Object.assign(RTS.defs[kind][id], change);
// 시스템 삽입: RTS.addSystem({id:'weather',run}, {before:'movement'})
RTS.addSystem = function (sys, pos = {}) {
  const ref = pos.before || pos.after;
  const i = ref ? RTS.systems.findIndex(s => s.id === ref) : -1;
  if (i < 0) RTS.systems.push(sys); else RTS.systems.splice(pos.before ? i : i + 1, 0, sys);
};

RTS.rand = G => { // mulberry32. 상태가 G.rng에 있어 저장/리플레이가 재현된다.
  G.rng = (G.rng + 0x6D2B79F5) | 0;
  let t = G.rng; t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

RTS.on = (G, type, fn) => { (G._ls[type] = G._ls[type] || []).push(fn); };
RTS.emit = (G, type, data) => { (G._ls[type] || []).forEach(f => f(data, G)); };

// 설정값. 옛 저장 파일에 없는 항목은 기본값으로 채운다.
RTS.cfg = G => G.cfg || (G.cfg = RTS.defaultSettings());
RTS.createGame = function (opts) {
  // opts: {map, seed, players:[{faction, ai:null|'easy'|'normal'|'hard', name}]}
  const G = { tick: 0, rng: (opts.seed || 1) | 0, nextId: 1, ents: [], byId: {}, teams: [], cmds: [], projectiles: [],
    over: null, mapId: opts.map, seed: opts.seed || 1, cfg: Object.assign(RTS.defaultSettings(), opts.settings), _ls: {} };
  const easy = opts.players.map(p => p.ai && RTS.defs.difficulties[p.ai]).find(d => d && d.reveal);
  G.coop = !!opts.coop; // 둘이 협동: 사람 둘(편 0)이 동맹해 중립세력 AI(편 1)와 싸운다
  G.nofog = !!opts.nofog || !G.cfg.fog || !!easy;
  const spec = RTS.defs.maps[opts.map];
  const m = RTS.defs.mapgens[spec.gen](spec, G);
  G.w = m.w; G.h = m.h; G.tiles = m.tiles; G.bases = m.bases; G.siteSpots = m.sites || []; G.postSpots = m.posts || []; G.tribeSpot = m.tribe || null;
  RTS.initRuntime(G);
  opts.players.forEach((p, i) => {
    const size = G.w * G.h;
    const t = { id: i, faction: p.faction, ai: p.ai || null, name: p.name || RTS.defs.factions[p.faction].name,
      res: { ore: G.cfg.startOre, gas: G.cfg.startGas }, sup: 0, cap: 0, have: {}, upgrades: {}, research: {}, inc: 1, mods: {}, aiState: {},
      stats: { kills: 0, lost: 0, ore: 0, gas: 0, made: 0 }, vis: new Array(size).fill(0), seen: new Array(size).fill(0) };
    if (p.side !== undefined) t.side = p.side; // 같은 편끼리는 동맹(RTS.ally)
    if (p.ai) { t.boost = p.boost || 1; t.inc = RTS.defs.difficulties[p.ai].income * t.boost; } // boost: 중립세력 AI 성능 배율
    const hc = p.hc && RTS.HANDICAPS && RTS.HANDICAPS[p.hc]; // 2인 대전 팀별 핸디캡
    if (hc && hc.id !== 'none') { t.hc = hc.id; t.res.ore += hc.ore || 0; t.res.gas += hc.gas || 0; t.inc *= hc.income || 1; if (hc.reveal) t.reveal = true; }
    G.teams.push(t);
  });
  m.nodes.forEach(n => {
    const e = RTS.spawn(G, n.def, -1, n.tx + RTS.defs.entities[n.def].size[0] / 2, n.ty + RTS.defs.entities[n.def].size[1] / 2);
    e.amount = RTS.defs.entities[n.def].amount;
  });
  const starts = G.bases.filter(b => b.start !== undefined), spots = G.coop ? RTS.coopBases(G) : null;
  G.teams.forEach((t, i) => {
    const b = spots ? spots[i] : starts.find(s => s.start === i), f = RTS.defs.factions[t.faction];
    b.owner = i;
    const hs = RTS.defs.entities[f.hq].size, hq = RTS.spawn(G, f.hq, i, Math.round(b.x - hs[0] / 2) + hs[0] / 2, Math.round(b.y - hs[1] / 2) + hs[1] / 2); hq.built = hq.buildT; hq.hp = RTS.stat(G, hq, 'hp');
    const ore = RTS.nearestNode(G, b.x, b.y, 'ore', 30);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const w = RTS.spawn(G, f.worker, i, b.x + Math.cos(a) * 3, b.y + Math.sin(a) * 3);
      RTS.issue(G, w, { type: 'gather', node: ore.id });
    }
  });
  if (easy && easy.towers) G.teams.forEach(t => { if (!t.ai) RTS.giveTowers(G, t, easy.towers); });
  G.teams.forEach(t => { const hc = t.hc && RTS.HANDICAPS[t.hc]; if (hc && hc.towers) RTS.giveTowers(G, t, hc.towers); });
  RTS.initMarket(G); RTS.initDip(G); if (RTS.initTribe) RTS.initTribe(G); RTS.initWar(G); RTS.census(G); RTS.updateFog(G, true);
  return G;
};

// 협동 시작 위치: 0번 사람 = 시작 기지 0, 중립세력(2번) = 맞은편 시작 기지 1,
// 1번 사람 = 시작 기지 0에서 가장 가까운 확장 기지(광맥 있는 곳). 두 사람이 같은 쪽에서 함께 막는다.
RTS.coopBases = function (G) {
  const s0 = G.bases.find(b => b.start === 0), s1 = G.bases.find(b => b.start === 1);
  const rest = G.bases.filter(b => b.start === undefined && RTS.nearestNode(G, b.x, b.y, 'ore', 12));
  rest.sort((a, b) => Math.hypot(a.x - s0.x, a.y - s0.y) - Math.hypot(b.x - s0.x, b.y - s0.y));
  return [s0, rest[0], s1];
};
// 같은 편이면 동맹. 편(side)이 없는 일반 게임에서는 자기 팀만 해당한다.
RTS.ally = (G, a, b) => { if (a === b) return true; if (a < 0 || b < 0) return false; const x = G.teams[a], y = G.teams[b]; return !!(x && y && x.side !== undefined && x.side === y.side); };
RTS.allyTeams = (G, a) => G.teams.filter(t => t.id !== a && RTS.ally(G, a, t.id));

// 왕초보: 본진 둘레에 완공된 방어탑을 [최소,최대] 사이 무작위 개수만큼 세운다.
// 적이 올 방향(맵 중앙 쪽)부터 채우고, 광맥·분출구 근처와 사령부→광맥 일꾼 동선은 비워 둔다.
RTS.giveTowers = function (G, t, range) {
  const f = RTS.defs.factions[t.faction], id = f.defense; if (!id) return 0;
  const d = RTS.defs.entities[id], hq = G.ents.find(e => e.team === t.id && e.def === f.hq); if (!hq) return 0;
  const want = range[0] + Math.floor(RTS.rand(G) * (range[1] - range[0] + 1));
  const ore = RTS.nearestNode(G, hq.x, hq.y, 'ore', 30), base = Math.atan2(G.h / 2 - hq.y, G.w / 2 - hq.x) + (RTS.rand(G) - .5) * .8; // 맵 중앙(적 방향)부터 채운다
  const segD = (px, py) => { if (!ore) return 99; const ax = ore.x - hq.x, ay = ore.y - hq.y, L = ax * ax + ay * ay || 1, k = Math.max(0, Math.min(1, ((px - hq.x) * ax + (py - hq.y) * ay) / L)); return Math.hypot(px - hq.x - ax * k, py - hq.y - ay * k); };
  let n = 0;
  for (let r = 5; r <= 16 && n < want; r += 1) for (let k = 0; k < 32 && n < want; k++) {
    const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI * 2 / 32, cx = hq.x + Math.cos(a) * r, cy = hq.y + Math.sin(a) * r;
    const tx = Math.round(cx - d.size[0] / 2), ty = Math.round(cy - d.size[1] / 2), mx = tx + d.size[0] / 2, my = ty + d.size[1] / 2;
    if (!RTS.canPlace(G, t.id, id, tx, ty, 1)) continue;
    if (RTS.nearestNode(G, mx, my, 'ore', 4) || RTS.nearestNode(G, mx, my, 'gas', 4) || segD(mx, my) < 3) continue;
    if (G.ents.some(e => e.def === id && e.team === t.id && Math.hypot(e.x - mx, e.y - my) < 3.5)) continue;
    const e = RTS.spawn(G, id, t.id, mx, my); e.built = e.buildT; e.hp = RTS.stat(G, e, 'hp'); n++;
  }
  return n;
};

RTS.initRuntime = function (G) {
  G._occ = new Int32Array(G.w * G.h);
  G._cols = Math.ceil(G.w / 4); G._rows = Math.ceil(G.h / 4);
  G._grid = Array.from({ length: G._cols * G._rows }, () => []);
  G._pathQ = 0;
};

RTS.step = function (G) {
  if (G.over) return;
  G.tick++;
  for (const s of RTS.systems) s.run(G);
};

// 저장은 '_' 로 시작하지 않는 모든 필드를 JSON으로 직렬화한다.
RTS.serialize = G => JSON.stringify(G, (k, v) => (k[0] === '_' ? undefined : v));
RTS.deserialize = function (json) {
  const G = JSON.parse(json); G._ls = {}; G.cfg = Object.assign(RTS.defaultSettings(), G.cfg); RTS.initRuntime(G);
  G.byId = {}; for (const e of G.ents) { G.byId[e.id] = e; const d = RTS.defs.entities[e.def]; if (d.size) RTS.occupy(G, e, e.id); }
  return G;
};
