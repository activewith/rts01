// ─────────────────────────────────────────────────────────────
// core.js — 네임스페이스, 데이터 레지스트리, 모드 API, 난수, 게임 생성
// 규칙: engine/ 폴더는 DOM을 쓰지 않는다. Node에서도 그대로 돌아간다.
// 좌표 단위는 타일(float). 시뮬레이션은 20틱/초 고정이며 결정적이다.
// ─────────────────────────────────────────────────────────────
const RTS = (globalThis.RTS = globalThis.RTS || {});
RTS.version = '0.1.0';
RTS.HZ = 20;
RTS.defs = { terrain: {}, entities: {}, upgrades: {}, abilities: {}, factions: {}, maps: {}, mapgens: {}, difficulties: {}, companies: {}, marketEvents: {}, branches: {} };
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

RTS.createGame = function (opts) {
  // opts: {map, seed, players:[{faction, ai:null|'easy'|'normal'|'hard', name}]}
  const G = { tick: 0, rng: (opts.seed || 1) | 0, nextId: 1, ents: [], byId: {}, teams: [], cmds: [], projectiles: [],
    over: null, mapId: opts.map, seed: opts.seed || 1, nofog: !!opts.nofog, _ls: {} };
  const spec = RTS.defs.maps[opts.map];
  const m = RTS.defs.mapgens[spec.gen](spec, G);
  G.w = m.w; G.h = m.h; G.tiles = m.tiles; G.bases = m.bases; G.siteSpots = m.sites || []; G.postSpots = m.posts || [];
  RTS.initRuntime(G);
  opts.players.forEach((p, i) => {
    const size = G.w * G.h;
    const t = { id: i, faction: p.faction, ai: p.ai || null, name: p.name || RTS.defs.factions[p.faction].name,
      res: { ore: 100, gas: 0 }, sup: 0, cap: 0, have: {}, upgrades: {}, research: {}, inc: 1, mods: {}, aiState: {},
      stats: { kills: 0, lost: 0, ore: 0, gas: 0, made: 0 }, vis: new Array(size).fill(0), seen: new Array(size).fill(0) };
    if (p.ai) t.inc = RTS.defs.difficulties[p.ai].income;
    G.teams.push(t);
  });
  m.nodes.forEach(n => {
    const e = RTS.spawn(G, n.def, -1, n.tx + RTS.defs.entities[n.def].size[0] / 2, n.ty + RTS.defs.entities[n.def].size[1] / 2);
    e.amount = RTS.defs.entities[n.def].amount;
  });
  const starts = G.bases.filter(b => b.start !== undefined);
  G.teams.forEach((t, i) => {
    const b = starts.find(s => s.start === i), f = RTS.defs.factions[t.faction];
    b.owner = i;
    const hs = RTS.defs.entities[f.hq].size, hq = RTS.spawn(G, f.hq, i, Math.round(b.x - hs[0] / 2) + hs[0] / 2, Math.round(b.y - hs[1] / 2) + hs[1] / 2); hq.built = hq.buildT; hq.hp = RTS.stat(G, hq, 'hp');
    const ore = RTS.nearestNode(G, b.x, b.y, 'ore', 30);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const w = RTS.spawn(G, f.worker, i, b.x + Math.cos(a) * 3, b.y + Math.sin(a) * 3);
      RTS.issue(G, w, { type: 'gather', node: ore.id });
    }
  });
  RTS.initMarket(G); RTS.initDip(G); RTS.census(G); RTS.updateFog(G, true);
  return G;
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
  const G = JSON.parse(json); G._ls = {}; RTS.initRuntime(G);
  G.byId = {}; for (const e of G.ents) { G.byId[e.id] = e; const d = RTS.defs.entities[e.def]; if (d.size) RTS.occupy(G, e, e.id); }
  return G;
};
