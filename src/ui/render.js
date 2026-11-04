// render.js — Canvas 2D 렌더러. 게임 상태를 읽기만 하고 바꾸지 않는다.
// 새 유닛 그림은 RTS.art.units.이름, 건물은 RTS.art.buildings.이름 함수 하나만 추가한다.
RTS.TEAM = [{ main: '#46c4ff', dark: '#14557e', light: '#c6efff' }, { main: '#ff7350', dark: '#8a2b1c', light: '#ffd5c6' }, { main: '#c6e05a', dark: '#5c6e1c', light: '#eefac0' }, { main: '#d58cff', dark: '#5f2c86', light: '#f1dcff' }];
RTS.THEMES = {
  dusk:  { ground: ['#34505a', '#2f4954', '#395762'], sand: ['#6d6a58', '#625f4f', '#77735f'], rock: ['#1b2536', '#253349', '#3f5470'] },
  ochre: { ground: ['#6f5238', '#664a32', '#785a3e'], sand: ['#a07c4e', '#957145', '#aa8656'], rock: ['#33222a', '#46303a', '#6f4d52'] },
};
const cx3 = w => w / 2;
const NEUTRAL = { main: '#b9c2cf', dark: '#566274', light: '#eef2f7' };
const TS = 32, TAU = Math.PI * 2;
function shade(ctx, x, y, w, h, c, r = 3) { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
const STEEL = ['#8795a8', '#59677b', '#39455a', '#232c3d'], MECH = ['#a0937c', '#6f6655', '#4a4338', '#2e2a24'];

RTS.art = {
  units: {
    worker(c, p, s) { const m = s.faction === 'ironclad' ? MECH : STEEL;
      shade(c, -9, -8, 18, 16, m[2], 5); shade(c, -7, -6, 14, 12, p.main, 4); circ(c, 2, 0, 4.2, p.light);
      c.strokeStyle = m[0]; c.lineWidth = 2.6; c.beginPath(); c.moveTo(6, 4); c.lineTo(13, 6 + Math.sin(s.t * .5) * 2); c.stroke(); c.beginPath(); c.moveTo(6, -4); c.lineTo(12, -6); c.stroke();
      if (s.cargo) circ(c, -9, 0, 4, s.cargo === 'gas' ? '#e06bd8' : '#ffc35a'); },
    trooper(c, p, s) { const w = Math.sin(s.t * .4) * (s.moving ? 3 : 0);
      circ(c, -2 + w, 5, 3.4, STEEL[2]); circ(c, -2 - w, -5, 3.4, STEEL[2]);
      c.fillStyle = s.tint === 1 ? '#3a6a58' : s.tint === 2 ? '#d7dde6' : p.dark; c.beginPath(); c.ellipse(0, 0, 7, 10, 0, 0, TAU); c.fill();
      circ(c, 0.5, 0, 5.4, p.main); circ(c, 2, 0, 2.6, p.light);
      if (s.tint === 2) { c.fillStyle = '#e7495a'; c.fillRect(-1, -6, 2, 5); c.fillRect(-3, -4.5, 6, 2); }
      else { c.fillStyle = '#1c2230'; c.fillRect(3, 3.5, s.tint === 1 ? 11 : 13, s.tint === 1 ? 5 : 2.6); } },
    bot(c, p, s) { const k = s.moving ? Math.sin(s.t * .6) * 3 : 0; c.strokeStyle = MECH[3]; c.lineWidth = 3;
      for (const [a, b] of [[-1, 1], [1, -1]]) { c.beginPath(); c.moveTo(-3 * a, 6 * b); c.lineTo(-7 * a + k * b, 11 * b); c.stroke(); }
      c.fillStyle = MECH[1]; c.beginPath(); for (let i = 0; i < 6; i++) c.lineTo(Math.cos(i * TAU / 6) * 10, Math.sin(i * TAU / 6) * 9); c.fill();
      circ(c, 0, 0, 6, p.dark); circ(c, 3, 0, 3.2, p.main);
      if (s.tint === 2) { c.fillStyle = '#7fe0b0'; c.fillRect(-4, -1.5, 8, 3); c.fillRect(-1.5, -4, 3, 8); }
      else if (s.tint === 1) { c.fillStyle = '#20242c'; c.fillRect(6, -6, 11, 3); c.fillRect(6, 3, 11, 3); }
      else { c.fillStyle = '#d6dde5'; for (const b of [-1, 1]) { c.beginPath(); c.moveTo(4, 8 * b); c.lineTo(17, 3 * b); c.lineTo(6, 3 * b); c.fill(); } } },
    tank(c, p, s) { shade(c, -20, -15, 40, 7, '#1c222e', 2); shade(c, -20, 8, 40, 7, '#1c222e', 2);
      shade(c, -18, -11, 36, 22, STEEL[1], 3); shade(c, -14, -8, 24, 16, p.dark, 2);
      if (s.sieged) { c.strokeStyle = STEEL[2]; c.lineWidth = 4; for (const [a, b] of [[-14, -20], [14, -20], [-14, 20], [14, 20]]) { c.beginPath(); c.moveTo(a * .6, b * .5); c.lineTo(a, b); c.stroke(); } }
      circ(c, -1, 0, 8.5, p.main); c.fillStyle = STEEL[3]; c.fillRect(4, -2.4, s.sieged ? 28 : 19, 4.8); c.fillStyle = p.light; c.fillRect(-3, -2, 5, 4); },
    walker(c, p, s) { const k = s.moving ? Math.sin(s.t * .3) * 5 : 0; c.fillStyle = MECH[3];
      c.fillRect(-10 + k, -23, 18, 9); c.fillRect(-10 - k, 14, 18, 9);
      c.fillStyle = MECH[1]; c.beginPath(); c.moveTo(-17, -15); c.lineTo(12, -17); c.lineTo(20, 0); c.lineTo(12, 17); c.lineTo(-17, 15); c.closePath(); c.fill();
      c.fillStyle = p.dark; c.beginPath(); c.moveTo(-11, -9); c.lineTo(8, -10); c.lineTo(14, 0); c.lineTo(8, 10); c.lineTo(-11, 9); c.closePath(); c.fill();
      circ(c, 1, 0, 6.5, p.main); circ(c, 3, 0, 3, p.light); c.fillStyle = '#20242c'; c.fillRect(10, -14, 19, 6); c.fillRect(10, 8, 19, 6); },
    caravan(c, p, s) { shade(c, -15, -10, 30, 20, '#7a5a34', 3); shade(c, -12, -8, 18, 16, '#d2b06a', 2); shade(c, 7, -7, 10, 14, p.main, 2); c.fillStyle = '#1c222e'; for (const [x, y] of [[-10, -12], [8, -12], [-10, 10], [8, 10]]) c.fillRect(x, y, 8, 3); },
    flyer(c, p, s) { const f = s.tint === 1;
      c.fillStyle = f ? MECH[1] : STEEL[1]; c.beginPath(); c.moveTo(f ? 18 : 20, 0); c.lineTo(-12, f ? -16 : -19); c.lineTo(-7, 0); c.lineTo(-12, f ? 16 : 19); c.closePath(); c.fill();
      c.fillStyle = p.dark; c.beginPath(); c.moveTo(12, 0); c.lineTo(-8, -8); c.lineTo(-5, 0); c.lineTo(-8, 8); c.closePath(); c.fill();
      circ(c, 5, 0, 3.8, p.main); circ(c, -11, -7, 2.6 + (s.t % 4 < 2 ? 1 : 0), '#ffd27a'); circ(c, -11, 7, 2.6 + (s.t % 4 < 2 ? 1 : 0), '#ffd27a'); },
  },
  // 건물은 (ctx, w, h, 팔레트, 상태) 로 그린다. 원점은 왼쪽 위, 단위는 px.
  buildings: {
    hq(c, w, h, p, s) { plate(c, w, h, s); shade(c, 14, 12, w - 28, h - 26, p.dark, 6); circ(c, w / 2, h / 2 - 4, 19, s.m[3]); circ(c, w / 2, h / 2 - 4, 14, p.main); circ(c, w / 2, h / 2 - 4, 7, p.light);
      c.fillStyle = s.m[0]; for (let i = 0; i < 4; i++) c.fillRect(10 + i * (w - 28) / 3, h - 12, 8, 6); },
    depot(c, w, h, p, s) { plate(c, w, h, s); for (const [x, y] of [[9, 9], [33, 9], [9, 32], [33, 32]]) { shade(c, x, y, 21, 20, s.m[2], 2); c.fillStyle = p.main; c.fillRect(x + 3, y + 8, 15, 4); } },
    extractor(c, w, h, p, s) { plate(c, w, h, s); circ(c, w / 2, h / 2, 20, s.m[3]); circ(c, w / 2, h / 2, 14, '#7c3478'); circ(c, w / 2, h / 2, 7 + Math.sin(s.t * .1) * 2, '#f08ae6'); c.fillStyle = p.main; c.fillRect(4, h / 2 - 3, 10, 6); c.fillRect(w - 14, h / 2 - 3, 10, 6); },
    barracks(c, w, h, p, s) { plate(c, w, h, s); shade(c, 10, 10, w - 20, 34, s.m[2], 3); c.fillStyle = p.main; for (let i = 0; i < 5; i++) c.fillRect(16 + i * 15, 18, 9, 18); shade(c, w / 2 - 15, h - 34, 30, 28, '#141a24', 2); c.fillStyle = p.light; c.fillRect(w / 2 - 15, h - 36, 30, 3); },
    lab(c, w, h, p, s) { plate(c, w, h, s); circ(c, 28, h / 2, 17, s.m[3]); circ(c, 28, h / 2, 12, '#9fd8ff'); c.save(); c.translate(28, h / 2); c.rotate(s.t * .02); c.fillStyle = p.dark; c.fillRect(-12, -1.5, 24, 3); c.restore(); c.fillStyle = p.main; for (let i = 0; i < 3; i++) c.fillRect(52 + i * 13, 14, 8, h - 28); },
    factory(c, w, h, p, s) { plate(c, w, h, s); c.fillStyle = s.m[3]; c.fillRect(8, 12, w - 16, h - 24); c.fillStyle = '#d9a23b'; for (let i = 0; i < 6; i++) c.fillRect(12 + i * 13, h - 18, 7, 4); shade(c, 18, 22, w - 36, 28, p.dark, 3); c.fillStyle = p.main; c.fillRect(18, 18 + (s.t * .3 % 30), w - 36, 3); },
    site_ore(c, w, h, p, s) { siteBase(c, w, h, p, s, '#ffc247'); },
    site_gas(c, w, h, p, s) { siteBase(c, w, h, p, s, '#ea7be0'); },
    site_post(c, w, h, p, s) { plate(c, w, h, s); shade(c, 12, 16, w - 24, h - 30, p.dark, 3); c.fillStyle = p.main; c.beginPath(); c.moveTo(cx3(w) - 30, 18); c.lineTo(cx3(w), 2); c.lineTo(cx3(w) + 30, 18); c.fill();
      c.fillStyle = '#e8c15e'; c.fillRect(cx3(w) - 2, 24, 4, 30); c.beginPath(); c.moveTo(cx3(w) + 2, 24); c.lineTo(cx3(w) + 22, 31); c.lineTo(cx3(w) + 2, 38); c.fill(); c.fillStyle = s.m[3]; c.fillRect(16, h - 22, w - 32, 8); },
    turret(c, w, h, p, s) { plate(c, w, h, s); circ(c, w / 2, h / 2, 21, s.m[2]); c.save(); c.translate(w / 2, h / 2); c.rotate(s.facing); shade(c, -11, -11, 22, 22, p.dark, 5); c.fillStyle = s.m[3]; c.fillRect(6, -6, 22, 4); c.fillRect(6, 2, 22, 4); circ(c, 0, 0, 6, p.main); c.restore(); },
  },
};
function siteBase(c, w, h, p, s, col) { plate(c, w, h, s); shade(c, 12, 12, w - 24, h - 24, p.dark, 3); // 채굴탑
  const cx = w / 2, cy = h / 2; c.strokeStyle = p.light; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 20, cy + 20); c.lineTo(cx, cy - 24); c.lineTo(cx + 20, cy + 20); c.moveTo(cx - 12, cy + 2); c.lineTo(cx + 12, cy + 2); c.stroke();
  circ(c, cx, cy + 13, 9, s.m[3]); circ(c, cx, cy + 13, 5 + (s.down ? 0 : Math.sin(s.t * .12)), s.down ? '#55606e' : col); }
function plate(c, w, h, s) { const m = s.m, k = 9; // 바닥판 + 입체 모서리. 철갑회는 모서리를 더 깎는다.
  const q = s.faction === 'ironclad' ? 15 : k;
  const path = (i) => { c.beginPath(); c.moveTo(q + i, i); c.lineTo(w - q - i, i); c.lineTo(w - i, q + i); c.lineTo(w - i, h - q - i); c.lineTo(w - q - i, h - i); c.lineTo(q + i, h - i); c.lineTo(i, h - q - i); c.lineTo(i, q + i); c.closePath(); };
  c.fillStyle = m[3]; path(1); c.fill(); c.fillStyle = m[1]; path(3); c.fill(); c.strokeStyle = m[0]; c.lineWidth = 1.5; path(4); c.stroke();
}

RTS.Renderer = function (canvas, app) {
  const ctx = canvas.getContext('2d'), R = { cam: { x: 0, y: 0, z: 1 }, fx: [], decals: [], ghosts: {}, pings: [] };
  let bake = null, bakeFor = null; const fog = document.createElement('canvas'); const fogC = fog.getContext('2d'); let fogImg = null;
  const stateOf = (d, e, t) => ({ t, faction: e.team >= 0 && app.G.teams[e.team] ? app.G.teams[e.team].faction : 'pioneers', tint: d.tint, moving: !!e.path, cargo: e.cargo ? e.cargoType : null, sieged: e.sieged, m: e.team >= 0 && app.G.teams[e.team]?.faction === 'ironclad' ? MECH : STEEL, facing: e.facing });

  function bakeTerrain(G) {
    const th = RTS.THEMES[RTS.defs.maps[G.mapId].theme] || RTS.THEMES.dusk;
    const c = document.createElement('canvas'); c.width = G.w * TS; c.height = G.h * TS; const x = c.getContext('2d');
    const r = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(G.seed * 7 + 3);
    for (let ty = 0; ty < G.h; ty++) for (let tx = 0; tx < G.w; tx++) {
      const t = G.tiles[ty * G.w + tx], pal = t === 1 ? th.rock : th.ground;
      x.fillStyle = pal[0]; x.fillRect(tx * TS, ty * TS, TS, TS);
    }
    x.fillStyle = th.sand[0]; // 모래는 원을 겹쳐 찍어 경계를 둥글게 만든다
    for (let ty = 0; ty < G.h; ty++) for (let tx = 0; tx < G.w; tx++) if (G.tiles[ty * G.w + tx] === 2) { x.beginPath(); x.arc((tx + .5) * TS, (ty + .5) * TS, 27, 0, TAU); x.fill(); }
    x.globalAlpha = .28; // 얼룩
    for (let i = 0; i < G.w * G.h * 1.2; i++) { const px = r() * c.width, py = r() * c.height, t = G.tiles[(py / TS | 0) * G.w + (px / TS | 0)]; const pal = t === 2 ? th.sand : t === 1 ? th.rock : th.ground;
      x.fillStyle = pal[(r() * 3) | 0]; x.beginPath(); x.ellipse(px, py, 8 + r() * 30, 5 + r() * 16, r() * 3, 0, TAU); x.fill(); }
    x.globalAlpha = .5; x.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < G.w * G.h * 2; i++) x.fillRect(r() * c.width, r() * c.height, 2, 1);
    x.globalAlpha = 1;
    for (let ty = 0; ty < G.h; ty++) for (let tx = 0; tx < G.w; tx++) { // 암벽 모서리
      if (G.tiles[ty * G.w + tx] !== 1) continue;
      const open = (dx, dy) => RTS.tile(G, tx + dx, ty + dy) !== 1 && tx + dx >= 0 && ty + dy >= 0 && tx + dx < G.w && ty + dy < G.h, X = tx * TS, Y = ty * TS;
      if (open(0, 1)) { x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(X - 2, Y + TS, TS + 4, 12); x.fillStyle = th.rock[0]; x.fillRect(X, Y + TS - 12, TS, 12); x.fillStyle = th.rock[2]; x.fillRect(X, Y + TS - 13, TS, 2); }
      if (open(0, -1)) { x.fillStyle = th.rock[2]; x.fillRect(X, Y, TS, 3); }
      if (open(1, 0)) { x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(X + TS, Y, 7, TS); x.fillStyle = th.rock[2]; x.fillRect(X + TS - 3, Y, 3, TS); }
      if (open(-1, 0)) { x.fillStyle = th.rock[2]; x.fillRect(X, Y, 3, TS); }
      for (let i = 0; i < 3; i++) { x.fillStyle = th.rock[1 + (r() * 2 | 0)]; x.globalAlpha = .5; x.fillRect(X + r() * 24, Y + r() * 22, 3 + r() * 9, 2 + r() * 5); x.globalAlpha = 1; }
    }
    bake = c; bakeFor = G;
    fog.width = G.w; fog.height = G.h; fogImg = fogC.createImageData(G.w, G.h); R.decals = []; R.fx = []; R.ghosts = {};
  }
  R.terrain = () => bake;

  R.attach = function (G) {
    RTS.on(G, 'shot', ({ e, t, w }) => { if (!R.onScreen(e.x, e.y)) return; const a = e.facing, rr = (RTS.defOf(e).r || 1) + .25; R.fx.push({ k: 'flash', x: e.x + Math.cos(a) * rr, y: e.y + Math.sin(a) * rr, life: 3, max: 3, s: w.splash ? 9 : 5, air: RTS.defOf(e).air }); app.sfx(w.splash ? 'thump' : w.speed ? 'shot' : 'slash', e); });
    RTS.on(G, 'impact', ({ x, y, w }) => { if (w.splash) { R.fx.push({ k: 'blast', x, y, life: 12, max: 12, s: w.splash }); R.fx.push({ k: 'smoke', x, y, life: 28, max: 28, s: 12 }); app.sfx('boom', { x, y }); } else R.fx.push({ k: 'spark', x, y, life: 5, max: 5, s: 3 }); });
    RTS.on(G, 'heal', ({ e, t }) => R.fx.push({ k: 'beam', x: e.x, y: e.y, x2: t.x, y2: t.y, life: 6, max: 6 }));
    RTS.on(G, 'ability', ({ e }) => R.fx.push({ k: 'ring', x: e.x, y: e.y, life: 14, max: 14, s: 1.4 }));
    RTS.on(G, 'death', ({ e }) => { const d = RTS.defOf(e), big = d.size ? Math.max(...d.size) * .7 : (d.r || .4) * 1.6;
      R.fx.push({ k: 'blast', x: e.x, y: e.y, life: d.size ? 26 : 14, max: d.size ? 26 : 14, s: big }); for (let i = 0; i < (d.size ? 10 : 4); i++) { const a = Math.random() * TAU, v = .03 + Math.random() * .07; R.fx.push({ k: 'chip', x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 22, max: 22, c: (RTS.TEAM[e.team] || RTS.TEAM[0]).main }); }
      R.decals.push({ x: e.x, y: e.y, s: big * 24 }); if (R.decals.length > 90) R.decals.shift(); app.sfx(d.size ? 'bigboom' : 'boom', e); });
  };
  R.onScreen = (x, y) => { const c = R.cam, w = canvas.width / c.z, h = canvas.height / c.z, px = x * TS, py = y * TS; return px > c.x - 64 && py > c.y - 64 && px < c.x + w + 64 && py < c.y + h + 64; };

  function updateFog(G, team) {
    const t = G.teams[team], d = fogImg.data, N = G.w * G.h;
    for (let i = 0; i < N; i++) { d[i * 4] = 8; d[i * 4 + 1] = 12; d[i * 4 + 2] = 22; d[i * 4 + 3] = t.vis[i] ? 0 : t.seen[i] ? 135 : 245; }
    fogC.putImageData(fogImg, 0, 0);
  }

  function drawBuilding(c, G, e, d, a, ghost) {
    const r = RTS.rectOf(e), P = RTS.TEAM[e.team] || NEUTRAL, w = d.size[0] * TS, h = d.size[1] * TS, st = stateOf(d, e, app.frame); st.down = e.downUntil > G.tick;
    c.save(); c.translate(r.x0 * TS, r.y0 * TS);
    if (ghost) c.globalAlpha = .55;
    c.fillStyle = 'rgba(0,0,0,.32)'; c.fillRect(4, 8, w, h);
    const prog = e.buildT ? Math.min(1, e.built / e.buildT) : 1;
    if (prog < 1) { c.globalAlpha = .5; }
    (RTS.art.buildings[d.art] || plate)(c, w, h, P, st);
    if (prog < 1) { c.globalAlpha = 1; c.beginPath(); c.rect(0, h * (1 - prog), w, h * prog); c.save(); c.clip(); (RTS.art.buildings[d.art] || plate)(c, w, h, P, st); c.restore();
      c.strokeStyle = '#ffcb5c'; c.setLineDash([7, 6]); c.lineWidth = 2; c.strokeRect(2, 2, w - 4, h - 4); c.setLineDash([]);
      c.fillStyle = '#ffcb5c'; c.fillRect(0, h * (1 - prog) - 1.5, w, 3); }
    if (e.branch && !ghost) { c.font = '600 12px "IBM Plex Sans KR",sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(8,12,22,.78)'; c.fillRect(w / 2 - 44, h + 3, 88, 17); c.fillStyle = '#ffe6b0'; c.fillText(RTS.defs.branches[e.branch].name, w / 2, h + 16); c.textAlign = 'start'; }
    if (e.company && !ghost) { const co = G.market.cos[e.company]; c.font = '600 12px "IBM Plex Sans KR",sans-serif'; c.textAlign = 'center'; const label = RTS.defs.companies[e.company].name + ' ' + co.price.toFixed(1); c.fillStyle = 'rgba(8,12,22,.78)'; c.fillRect(w / 2 - 50, h + 3, 100, 17); c.fillStyle = st.down ? '#ff8a7a' : '#fff'; c.fillText(st.down ? '가동 중단' : label, w / 2, h + 16); c.textAlign = 'start'; }
    if (e.hp < d.hp * .45 && prog >= 1 && app.frame % 7 === 0 && !ghost) R.fx.push({ k: 'smoke', x: e.x + (Math.random() - .5) * d.size[0] * .6, y: e.y + (Math.random() - .5) * d.size[1] * .6, life: 24, max: 24, s: 8 });
    c.restore();
  }
  function drawNode(c, G, e, d) {
    if (d.resource === 'ore') { const X = (e.x - 1) * TS, Y = (e.y - .5) * TS, k = Math.max(.45, e.amount / d.amount), seedA = e.id * 37 % 7;
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(X + 3, Y + 18, 58, 12);
      for (let i = 0; i < 6; i++) { const cx = X + 7 + i * 10, h = (13 + ((i + seedA) * 5 % 11)) * k, wd = 7;
        c.fillStyle = '#b36f1c'; c.beginPath(); c.moveTo(cx - wd, Y + 28); c.lineTo(cx, Y + 28 - h - 6); c.lineTo(cx + 1, Y + 28); c.fill();
        c.fillStyle = '#ffc247'; c.beginPath(); c.moveTo(cx + 1, Y + 28); c.lineTo(cx, Y + 28 - h - 6); c.lineTo(cx + wd, Y + 28); c.fill();
        c.fillStyle = '#fff0b8'; c.fillRect(cx - 1, Y + 28 - h - 2, 2, 5); }
    } else { const X = e.x * TS, Y = e.y * TS; if (e.ext) return;
      circ(c, X, Y, 27, '#2a1a30'); circ(c, X, Y, 19, '#5b2358'); circ(c, X, Y, 10 + Math.sin(app.frame * .08 + e.id) * 3, '#ea7be0');
      if (app.frame % 11 === e.id % 11) R.fx.push({ k: 'steam', x: e.x, y: e.y, life: 30, max: 30, s: 7 }); }
  }

  R.draw = function (alpha) {
    const G = app.G, me = app.team; if (!G) return;
    if (bakeFor !== G) bakeTerrain(G);
    const c = ctx, cam = R.cam, W = canvas.width, H = canvas.height, t = app.frame;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0a0f18'; c.fillRect(0, 0, W, H);
    c.setTransform(cam.z, 0, 0, cam.z, -cam.x * cam.z, -cam.y * cam.z);
    c.imageSmoothingEnabled = true;
    const vw = W / cam.z, vh = H / cam.z, sx = Math.max(0, cam.x), sy = Math.max(0, cam.y), sw = Math.min(bake.width - sx, vw), sh = Math.min(bake.height - sy, vh);
    if (sw > 0 && sh > 0) c.drawImage(bake, sx, sy, sw, sh, sx, sy, sw, sh);
    for (const d of R.decals) if (R.onScreen(d.x, d.y)) { c.fillStyle = 'rgba(10,8,8,.34)'; c.beginPath(); c.ellipse(d.x * TS, d.y * TS, d.s, d.s * .75, 0, 0, TAU); c.fill(); }

    const sel = new Set(app.sel), vis = e => e.team === me || me < 0 || (e.team < 0 ? RTS.branchKnown(G, me, e) : RTS.visibleTo(G, me, e.x, e.y));
    // 기억된 적 건물
    if (me >= 0 && !G.nofog) { for (const e of G.ents) if (e.team >= 0 && e.team !== me && RTS.defOf(e).size && vis(e)) R.ghosts[e.id] = { def: e.def, team: e.team, x: e.x, y: e.y, built: e.built, buildT: e.buildT };
      for (const id of Object.keys(R.ghosts)) { const g = R.ghosts[id]; if (RTS.visibleTo(G, me, g.x, g.y)) { if (!G.byId[id]) delete R.ghosts[id]; } else if (R.onScreen(g.x, g.y) && G.teams[me].seen[(g.y | 0) * G.w + (g.x | 0)]) drawBuilding(c, G, g, RTS.defs.entities[g.def], alpha, true); } }

    const list = [];
    for (const e of G.ents) { if (e.dead || !R.onScreen(e.x, e.y)) continue; const d = RTS.defOf(e);
      if (d.kind === 'resource') { if (me < 0 || G.nofog || G.teams[me].seen[(e.y | 0) * G.w + (e.x | 0)]) drawNode(c, G, e, d); continue; }
      if (vis(e)) list.push(e); }
    const bl = list.filter(e => RTS.defOf(e).kind === 'building');
    for (const e of bl) { const d = RTS.defOf(e); if (sel.has(e.id)) selBox(c, e, d); drawBuilding(c, G, e, d, alpha);
      if (e.rally && sel.has(e.id)) { c.strokeStyle = 'rgba(120,255,190,.75)'; c.setLineDash([6, 6]); c.lineWidth = 1.5; c.beginPath(); c.moveTo(e.x * TS, e.y * TS); c.lineTo(e.rally.x * TS, e.rally.y * TS); c.stroke(); c.setLineDash([]); circ(c, e.rally.x * TS, e.rally.y * TS, 4, '#78ffbe'); } }
    const us = list.filter(e => RTS.defOf(e).kind === 'unit');
    const pos = e => [(e.px + (e.x - e.px) * alpha) * TS, (e.py + (e.y - e.py) * alpha) * TS];
    for (const e of us) { const d = RTS.defOf(e), [x, y] = pos(e), lift = d.air ? 20 : 0; // 그림자 + 선택 링
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x + 2 + lift * .3, y + 3 + lift * .2, d.r * TS * (d.air ? .8 : 1), d.r * TS * .72, 0, 0, TAU); c.fill();
      if (sel.has(e.id)) { c.strokeStyle = e.team === me ? '#7dffa8' : e.team < 0 ? '#ffe27a' : '#ff6a5a'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(x, y - lift * 0, d.r * TS + 4, (d.r * TS + 4) * .78, 0, 0, TAU); c.stroke(); } }
    us.sort((a, b) => (RTS.defOf(a).air ? 1 : 0) - (RTS.defOf(b).air ? 1 : 0) || a.y - b.y);
    for (const e of us) { const d = RTS.defOf(e), [x, y] = pos(e), lift = d.air ? 20 + Math.sin(t * .06 + e.id) * 2 : 0;
      c.save(); c.translate(x, y - lift); c.rotate(e.facing);
      if (e.hitAt && G.tick - e.hitAt < 2) c.filter = 'brightness(1.8)';
      (RTS.art.units[d.art] || RTS.art.units.trooper)(c, RTS.TEAM[e.team], stateOf(d, e, t + e.id * 3)); c.restore();
      if (e.stunned > G.tick) { c.fillStyle = '#ffe27a'; c.fillRect(x - 6 + Math.sin(t * .4) * 5, y - d.r * TS - 8, 3, 3); }
      if (e.buffs.length) { c.strokeStyle = '#ff5a3c'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, d.r * TS + 2, 0, TAU); c.stroke(); } }
    // 투사체
    for (const p of G.projectiles) { const a = Math.atan2(p.ty - p.y, p.tx - p.x), X = p.x * TS, Y = p.y * TS;
      if (p.art === 'shell') { circ(c, X, Y, 3.4, '#ffd27a'); circ(c, X, Y, 1.6, '#fff'); }
      else { c.strokeStyle = (RTS.TEAM[p.team] || RTS.TEAM[0]).light; c.lineWidth = 2; c.beginPath(); c.moveTo(X, Y); c.lineTo(X - Math.cos(a) * 11, Y - Math.sin(a) * 11); c.stroke(); } }
    drawFx(c);
    // 체력 바
    for (const e of list) { const d = RTS.defOf(e), max = RTS.stat(G, e, 'hp'); if (!sel.has(e.id) && e.hp >= max) continue;
      const w = d.size ? d.size[0] * TS - 10 : Math.max(22, d.r * TS * 2), x = e.x * TS - w / 2, y = (d.size ? e.y - d.size[1] / 2 : e.y) * TS - (d.size ? 8 : d.r * TS + (d.air ? 28 : 8)), k = Math.max(0, e.hp / max);
      c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x - 1, y - 1, w + 2, 5); c.fillStyle = k > .55 ? '#58e08a' : k > .28 ? '#f2c14e' : '#ee5545'; c.fillRect(x, y, w * k, 3); }
    // 안개
    if (me >= 0 && !G.nofog) { if (t % 6 === 0 || !R.fogReady) { updateFog(G, me); R.fogReady = true; } c.imageSmoothingEnabled = true; c.drawImage(fog, 0, 0, G.w * TS, G.h * TS); }
    // 건설 미리보기 & 드래그 박스
    const m = app.mode;
    if (m && m.type === 'place' && app.mouse.inside) { const d = RTS.defs.entities[m.def], [tx, ty] = app.placeTile(m.def), ok = RTS.canPlace(G, me, m.def, tx, ty), s = { x: tx + d.size[0] / 2, y: ty + d.size[1] / 2, team: me, def: m.def, built: 1, buildT: 1, facing: 0 };
      c.globalAlpha = .55; drawBuilding(c, G, s, d, alpha); c.globalAlpha = 1; c.fillStyle = ok ? 'rgba(90,255,150,.28)' : 'rgba(255,70,60,.35)'; c.fillRect(tx * TS, ty * TS, d.size[0] * TS, d.size[1] * TS); }
    if (m && m.type === 'target' && m.radius && app.mouse.inside) { c.strokeStyle = '#ffd27a'; c.lineWidth = 2; c.beginPath(); c.arc(app.mouse.wx * TS, app.mouse.wy * TS, m.radius * TS, 0, TAU); c.stroke(); }
    R.pings = R.pings.filter(p => { p.life--; const k = p.life / p.max; c.strokeStyle = p.c; c.lineWidth = 2; c.globalAlpha = k; c.beginPath(); c.arc(p.x * TS, p.y * TS, (1 - k) * 22 + 4, 0, TAU); c.stroke(); c.globalAlpha = 1; return p.life > 0; });
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (app.box) { const b = app.box; c.strokeStyle = '#7dffa8'; c.lineWidth = 1.5; c.fillStyle = 'rgba(125,255,168,.1)'; c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
  };
  function selBox(c, e, d) { const r = RTS.rectOf(e); c.strokeStyle = e.team === app.team ? '#7dffa8' : e.team < 0 ? '#ffe27a' : '#ff6a5a'; c.lineWidth = 2; c.strokeRect(r.x0 * TS - 2, r.y0 * TS - 2, r.w * TS + 4, r.h * TS + 4); }
  function drawFx(c) {
    R.fx = R.fx.filter(f => { const k = f.life / f.max, X = f.x * TS, Y = f.y * TS; f.life--;
      if (f.k === 'flash') { circ(c, X, Y - (f.air ? 20 : 0), f.s * k + 1, '#fff2c0'); }
      else if (f.k === 'spark') { circ(c, X, Y, 3 * k + .5, '#ffe9a8'); }
      else if (f.k === 'blast') { const r = f.s * TS * (1.15 - k * .75); c.globalAlpha = k * .9; circ(c, X, Y, r, '#ff9a3c'); circ(c, X, Y, r * .62, '#ffe18a'); c.globalAlpha = k * .5; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, r * 1.15, 0, TAU); c.stroke(); c.globalAlpha = 1; }
      else if (f.k === 'smoke' || f.k === 'steam') { c.globalAlpha = k * (f.k === 'steam' ? .35 : .4); circ(c, X, Y - (1 - k) * 26, f.s * (1.6 - k), f.k === 'steam' ? '#f3c0f0' : '#2b2b30'); c.globalAlpha = 1; }
      else if (f.k === 'chip') { f.x += f.vx; f.y += f.vy; c.fillStyle = f.c; c.fillRect(X, Y, 3, 3); }
      else if (f.k === 'beam') { c.strokeStyle = '#8affc4'; c.globalAlpha = k; c.lineWidth = 2; c.beginPath(); c.moveTo(X, Y); c.lineTo(f.x2 * TS, f.y2 * TS); c.stroke(); c.globalAlpha = 1; }
      else if (f.k === 'ring') { c.strokeStyle = '#ffd27a'; c.globalAlpha = k; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, (1 - k) * f.s * TS + 8, 0, TAU); c.stroke(); c.globalAlpha = 1; }
      return f.life > 0; });
    if (R.fx.length > 500) R.fx.splice(0, R.fx.length - 500);
  }
  // 아이콘: 실제 그림 함수를 작은 캔버스에 그린다. 새 유닛도 자동으로 아이콘이 생긴다.
  const icons = {};
  R.icon = function (defId, team, faction) {
    const k = defId + team; if (icons[k]) return icons[k];
    const d = RTS.defs.entities[defId], cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), P = RTS.TEAM[team] || RTS.TEAM[0], m = faction === 'ironclad' ? MECH : STEEL;
    if (d.kind === 'unit') { c.translate(32, 32); c.rotate(-.5); const s = 48 / Math.max(44, (d.r * TS * 2) + 16) * (d.r < .5 ? 1.6 : 1); c.scale(s, s); (RTS.art.units[d.art] || RTS.art.units.trooper)(c, P, { t: 0, faction, tint: d.tint, moving: false, m }); }
    else { const w = d.size[0] * TS, h = d.size[1] * TS, s = 60 / Math.max(w, h), Pn = team < 0 ? NEUTRAL : P; c.translate((64 - w * s) / 2, (64 - h * s) / 2); c.scale(s, s); (RTS.art.buildings[d.art] || plate)(c, w, h, Pn, { t: 0, faction, m, facing: -.6 }); }
    return (icons[k] = cv.toDataURL());
  };
  return R;
};
