// render.js — Canvas 2D 렌더러. 게임 상태를 읽기만 하고 바꾸지 않는다.
// 새 유닛 그림은 RTS.art.units.이름, 건물은 RTS.art.buildings.이름 함수 하나만 추가한다.
RTS.TEAM = [{ main: '#46c4ff', dark: '#14557e', light: '#c6efff' }, { main: '#ff7350', dark: '#8a2b1c', light: '#ffd5c6' }, { main: '#c6e05a', dark: '#5c6e1c', light: '#eefac0' }, { main: '#d58cff', dark: '#5f2c86', light: '#f1dcff' }];
// 진영 색. 어느 팀 슬롯이든 진영이 같으면 같은 색으로 그린다.
RTS.FACTION_COLOR = { pioneers: RTS.TEAM[0], ironclad: RTS.TEAM[1], swarm: RTS.TEAM[3] };
// 협동: 진영이 같아도 나·동료·중립세력이 구분되도록 팀 슬롯 색을 쓴다(파랑·보라·주황)
RTS.COOP_COLOR = [RTS.TEAM[0], RTS.TEAM[3], RTS.TEAM[1]];
RTS.TEAM[RTS.TRIBE] = { main: '#7bd65a', dark: '#2f5e22', light: '#d9f7c6' }; // 잿빛 부족
RTS.THEMES = {
  dusk:  { ground: ['#34505a', '#2f4954', '#395762'], sand: ['#6d6a58', '#625f4f', '#77735f'], rock: ['#1b2536', '#253349', '#3f5470'] },
  ochre: { ground: ['#6f5238', '#664a32', '#785a3e'], sand: ['#a07c4e', '#957145', '#aa8656'], rock: ['#33222a', '#46303a', '#6f4d52'] },
  frost: { ground: ['#5d7383', '#566b7a', '#64798a'], sand: ['#a9bccb', '#9eb2c2', '#b4c6d4'], rock: ['#1f2a3b', '#2b3a50', '#4a6280'] },
  moss:  { ground: ['#3c5a3a', '#365335', '#426140'], sand: ['#4f6e70', '#486668', '#577678'], rock: ['#1e2620', '#2b362c', '#4a5a47'] },
};
const cx3 = w => w / 2;
const NEUTRAL = { main: '#b9c2cf', dark: '#566274', light: '#eef2f7' };
const TS = 32, TAU = Math.PI * 2;
function shade(ctx, x, y, w, h, c, r = 3) { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
const STEEL = ['#8795a8', '#59677b', '#39455a', '#232c3d'], MECH = ['#a0937c', '#6f6655', '#4a4338', '#2e2a24'], FLESH = ['#b48f9c', '#7d5766', '#523545', '#2f1e29'];
// 진영별 재질. 새 진영은 여기에 재질을 추가한다(없으면 STEEL)
RTS.MAT = { pioneers: STEEL, ironclad: MECH, swarm: FLESH };
const matOf = f => RTS.MAT[f] || STEEL;
// 포자군락 공통: 꿈틀대는 몸통 타원과 등딱지 마디
function blob(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
function legs(c, n, len, spread, t, moving, col, wid = 2) { c.strokeStyle = col; c.lineWidth = wid; c.lineCap = 'round';
  for (let i = 0; i < n; i++) { const x = -spread + (2 * spread) * (n === 1 ? .5 : i / (n - 1)), k = moving ? Math.sin(t * .6 + i * 1.7) * 2.5 : 0;
    for (const b of [-1, 1]) { c.beginPath(); c.moveTo(x, 3 * b); c.lineTo(x + 2 + k * b, (len * .6) * b); c.lineTo(x + 4 - k * b, len * b); c.stroke(); } } c.lineCap = 'butt'; }

RTS.art = {
  units: {
    worker(c, p, s) { const m = matOf(s.faction);
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
    iworker(c, p, s) { const k = s.moving ? Math.sin(s.t * .6) * 2 : 0; c.strokeStyle = MECH[3]; c.lineWidth = 2.6; for (const a of [-1, 1]) for (const x of [-5, 1]) { c.beginPath(); c.moveTo(x, 5 * a); c.lineTo(x - 2 + k * a, 11 * a); c.stroke(); }
      circ(c, 0, 0, 8.5, MECH[1]); circ(c, 0, 0, 5.5, p.dark); circ(c, 2, 0, 3, p.main); c.strokeStyle = MECH[0]; c.lineWidth = 2.4; for (const a of [-1, 1]) { c.beginPath(); c.moveTo(6, 4 * a); c.lineTo(12, 7 * a); c.lineTo(14, 2 * a); c.stroke(); }
      if (s.cargo) circ(c, -9, 0, 4, s.cargo === 'gas' ? '#e06bd8' : '#ffc35a'); },
    caravan(c, p, s) { shade(c, -15, -10, 30, 20, '#7a5a34', 3); shade(c, -12, -8, 18, 16, '#d2b06a', 2); shade(c, 7, -7, 10, 14, p.main, 2); c.fillStyle = '#1c222e'; for (const [x, y] of [[-10, -12], [8, -12], [-10, 10], [8, 10]]) c.fillRect(x, y, 8, 3); },
    tribal(c, p, s) { const w = Math.sin(s.t * .4) * (s.moving ? 3 : 0); // 잿빛 부족: 가죽 망토, 전사는 도끼, 궁수(tint 1)는 활
      circ(c, -2 + w, 5, 3.2, '#4a3a2a'); circ(c, -2 - w, -5, 3.2, '#4a3a2a');
      c.fillStyle = '#6b5236'; c.beginPath(); c.ellipse(-1, 0, 7.5, 10, 0, 0, TAU); c.fill();
      c.fillStyle = p.dark; c.beginPath(); c.ellipse(0, 0, 5.4, 8, 0, 0, TAU); c.fill();
      circ(c, 1, 0, 4.6, '#c9a27a'); c.fillStyle = p.main; c.fillRect(-1.5, -4.6, 2.6, 9.2);
      if (s.tint === 1) { c.strokeStyle = '#9a7442'; c.lineWidth = 2; c.beginPath(); c.arc(4, 0, 9, -1.15, 1.15); c.stroke(); c.strokeStyle = '#e8e2d0'; c.lineWidth = .8; c.beginPath(); c.moveTo(4 + Math.cos(-1.15) * 9, Math.sin(-1.15) * 9); c.lineTo(4 + Math.cos(1.15) * 9, Math.sin(1.15) * 9); c.stroke(); }
      else { c.strokeStyle = '#7a5a34'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(3, 4); c.lineTo(14, 6); c.stroke(); c.fillStyle = '#c8ced8'; c.beginPath(); c.moveTo(12, 1.5); c.lineTo(18, 3); c.lineTo(17, 10.5); c.lineTo(12, 8.5); c.closePath(); c.fill(); } },
    flyer(c, p, s) { const f = s.tint === 1;
      c.fillStyle = f ? MECH[1] : STEEL[1]; c.beginPath(); c.moveTo(f ? 18 : 20, 0); c.lineTo(-12, f ? -16 : -19); c.lineTo(-7, 0); c.lineTo(-12, f ? 16 : 19); c.closePath(); c.fill();
      c.fillStyle = p.dark; c.beginPath(); c.moveTo(12, 0); c.lineTo(-8, -8); c.lineTo(-5, 0); c.lineTo(-8, 8); c.closePath(); c.fill();
      circ(c, 5, 0, 3.8, p.main); circ(c, -11, -7, 2.6 + (s.t % 4 < 2 ? 1 : 0), '#ffd27a'); circ(c, -11, 7, 2.6 + (s.t % 4 < 2 ? 1 : 0), '#ffd27a'); },

    // ── 포자군락 ──
    sworker(c, p, s) { legs(c, 3, 9, 5, s.t, s.moving, FLESH[3], 1.8); blob(c, -2, 0, 9, 7, FLESH[2]); blob(c, -1, 0, 7, 5.4, p.dark); blob(c, 3, 0, 4.4, 4, FLESH[0]);
      circ(c, 5.5, -1.8, 1.3, p.light); circ(c, 5.5, 1.8, 1.3, p.light); c.strokeStyle = FLESH[0]; c.lineWidth = 2; for (const b of [-1, 1]) { c.beginPath(); c.moveTo(6, 2.5 * b); c.quadraticCurveTo(11, 4 * b, 12, 1 * b + Math.sin(s.t * .5) * b); c.stroke(); }
      if (s.cargo) circ(c, -9, 0, 4, s.cargo === 'gas' ? '#e06bd8' : '#ffc35a'); },
    claw(c, p, s) { legs(c, 3, 9, 5, s.t, s.moving, FLESH[3], 1.6); blob(c, -3, 0, 8, 5.5, FLESH[2]); blob(c, -2, 0, 6, 4, p.dark); for (let i = 0; i < 3; i++) blob(c, -6 + i * 3, 0, 1.2, 3.6, p.main);
      blob(c, 4, 0, 4, 3.6, FLESH[1]); circ(c, 6, -1.5, 1.1, '#ffe08a'); circ(c, 6, 1.5, 1.1, '#ffe08a'); const k = Math.sin(s.t * .8) * 1.5;
      c.fillStyle = '#e8dccb'; for (const b of [-1, 1]) { c.beginPath(); c.moveTo(6, 3 * b); c.quadraticCurveTo(14, (6 + k) * b, 15, (1 + k * .3) * b); c.lineTo(9, 1.5 * b); c.closePath(); c.fill(); } },
    spitter(c, p, s) { const w = s.moving ? Math.sin(s.t * .4) * 3 : 0; c.strokeStyle = FLESH[2]; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-14, w); c.quadraticCurveTo(-7, -w, -1, 0); c.stroke(); c.lineCap = 'butt';
      blob(c, 1, 0, 8, 7.5, FLESH[1]); blob(c, 1, 0, 6, 5.6, p.dark); c.fillStyle = p.main; for (const b of [-1, 1]) { c.beginPath(); c.moveTo(-2, 5 * b); c.lineTo(-7, 12 * b); c.lineTo(2, 7 * b); c.closePath(); c.fill(); }
      blob(c, 7, 0, 4.6, 3.8, FLESH[0]); circ(c, 11, 0, 2.2, '#9be05a'); circ(c, 7.5, -2, 1.1, p.light); circ(c, 7.5, 2, 1.1, p.light); },
    nurse(c, p, s) { legs(c, 2, 8, 3, s.t, s.moving, FLESH[3], 1.6); blob(c, -1, 0, 10, 9, FLESH[1]); const b = 1 + Math.sin(s.t * .15) * .06; blob(c, -2, 0, 7.5 * b, 7 * b, p.dark);
      circ(c, -3, -2, 3, '#ffb7d0'); circ(c, -4, 2.5, 2.4, '#ffb7d0'); circ(c, 0, 1, 2, '#ffd6e4'); blob(c, 7, 0, 3.6, 3.2, FLESH[0]); circ(c, 8.5, 0, 1.3, p.light); },
    brute(c, p, s) { const k = s.moving ? Math.sin(s.t * .3) * 4 : 0; c.fillStyle = FLESH[3]; for (const [x, b] of [[-12, -1], [-12, 1], [2, -1], [2, 1]]) c.fillRect(x + (b > 0 ? k : -k), b > 0 ? 13 : -21, 9, 8);
      blob(c, -2, 0, 20, 16, FLESH[2]); blob(c, -3, 0, 16, 12.5, p.dark); c.fillStyle = FLESH[1]; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(-13 + i * 7, 0, 2.6, 11, 0, 0, TAU); c.fill(); }
      c.fillStyle = p.main; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-14 + i * 8, -9); c.lineTo(-11 + i * 8, -16); c.lineTo(-8 + i * 8, -9); c.closePath(); c.fill(); }
      blob(c, 14, 0, 7, 8, FLESH[1]); circ(c, 17, -3, 1.6, '#ffe08a'); circ(c, 17, 3, 1.6, '#ffe08a');
      c.fillStyle = '#efe4d2'; for (const b of [-1, 1]) { c.beginPath(); c.moveTo(16, 5 * b); c.quadraticCurveTo(30, 12 * b, 31, 2 * b); c.lineTo(20, 2 * b); c.closePath(); c.fill(); } },
    drake(c, p, s) { const f = Math.sin(s.t * .5) * 4; c.fillStyle = FLESH[1]; for (const b of [-1, 1]) { c.beginPath(); c.moveTo(2, 2 * b); c.quadraticCurveTo(-4, (18 + f) * b, -14, (16 + f) * b); c.quadraticCurveTo(-8, 8 * b, -6, 2 * b); c.closePath(); c.fill(); }
      c.fillStyle = p.dark; for (const b of [-1, 1]) { c.beginPath(); c.moveTo(0, 3 * b); c.quadraticCurveTo(-4, (12 + f * .6) * b, -10, (12 + f * .6) * b); c.lineTo(-5, 3 * b); c.closePath(); c.fill(); }
      c.strokeStyle = FLESH[2]; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-6, 0); c.quadraticCurveTo(-13, 3, -18, -1); c.stroke(); c.lineCap = 'butt';
      blob(c, 1, 0, 8, 4.5, FLESH[2]); blob(c, 2, 0, 5.5, 3, p.main); circ(c, 8, 0, 3, FLESH[0]); circ(c, 9.5, 0, 1.3, '#ffe08a'); },
  },
  // 건물은 (ctx, w, h, 팔레트, 상태) 로 그린다. 원점은 왼쪽 위, 단위는 px.
  buildings: {
    t_hall(c, w, h, p, s) { const cx = w / 2, cy = h / 2; // 잿빛 부족 회당: 흙마당, 둥근 초가 지붕, 양옆 토템, 화톳불
      c.fillStyle = '#5a4630'; c.beginPath(); c.ellipse(cx, cy + 3, cx - 2, cy - 3, 0, 0, TAU); c.fill();
      c.fillStyle = '#8a6a40'; c.beginPath(); c.ellipse(cx, cy - 2, cx - 16, cy - 10, 0, 0, TAU); c.fill();
      c.strokeStyle = '#5c4528'; c.lineWidth = 2; for (const k of [.75, .5]) { c.beginPath(); c.ellipse(cx, cy - 2, (cx - 16) * k, (cy - 10) * k, 0, 0, TAU); c.stroke(); }
      circ(c, cx, cy - 2, 7, p.dark); circ(c, cx, cy - 2, 4, p.main);
      for (const x of [10, w - 10]) { shade(c, x - 4, 10, 8, h - 26, '#3a2c1e', 2); circ(c, x, 12, 5.5, p.main); c.fillStyle = '#1c140c'; c.fillRect(x - 2.5, 10, 2, 2); c.fillRect(x + .5, 10, 2, 2); }
      circ(c, cx, h - 9, 5, '#3a2c1e'); circ(c, cx, h - 10, 3 + Math.sin(s.t * .3), '#ffb04a'); },
    t_tower(c, w, h, p, s) { c.fillStyle = '#3e2f20'; for (const [x, y] of [[6, 6], [w - 11, 6], [6, h - 11], [w - 11, h - 11]]) c.fillRect(x, y, 5, 5); // 나무 망루
      shade(c, 9, 9, w - 18, h - 18, '#7a5d3a', 3); c.strokeStyle = '#4e3a24'; c.lineWidth = 2; c.beginPath(); c.moveTo(11, 11); c.lineTo(w - 11, h - 11); c.moveTo(w - 11, 11); c.lineTo(11, h - 11); c.stroke();
      circ(c, w / 2, h / 2, 8, p.dark); circ(c, w / 2, h / 2, 4.5, p.main); c.fillStyle = p.light; c.fillRect(w / 2 + 2, 6, 10, 6); },
    hq(c, w, h, p, s) { plate(c, w, h, s); shade(c, 14, 12, w - 28, h - 26, p.dark, 6); circ(c, w / 2, h / 2 - 4, 19, s.m[3]); circ(c, w / 2, h / 2 - 4, 14, p.main); circ(c, w / 2, h / 2 - 4, 7, p.light);
      c.fillStyle = s.m[0]; for (let i = 0; i < 4; i++) c.fillRect(10 + i * (w - 28) / 3, h - 12, 8, 6); },
    depot(c, w, h, p, s) { plate(c, w, h, s); for (const [x, y] of [[9, 9], [33, 9], [9, 32], [33, 32]]) { shade(c, x, y, 21, 20, s.m[2], 2); c.fillStyle = p.main; c.fillRect(x + 3, y + 8, 15, 4); } },
    extractor(c, w, h, p, s) { plate(c, w, h, s); circ(c, w / 2, h / 2, 20, s.m[3]); circ(c, w / 2, h / 2, 14, '#7c3478'); circ(c, w / 2, h / 2, 7 + Math.sin(s.t * .1) * 2, '#f08ae6'); c.fillStyle = p.main; c.fillRect(4, h / 2 - 3, 10, 6); c.fillRect(w - 14, h / 2 - 3, 10, 6); },
    barracks(c, w, h, p, s) { plate(c, w, h, s); shade(c, 10, 10, w - 20, 34, s.m[2], 3); c.fillStyle = p.main; for (let i = 0; i < 5; i++) c.fillRect(16 + i * 15, 18, 9, 18); shade(c, w / 2 - 15, h - 34, 30, 28, '#141a24', 2); c.fillStyle = p.light; c.fillRect(w / 2 - 15, h - 36, 30, 3); },
    lab(c, w, h, p, s) { plate(c, w, h, s); circ(c, 28, h / 2, 17, s.m[3]); circ(c, 28, h / 2, 12, '#9fd8ff'); c.save(); c.translate(28, h / 2); c.rotate(s.t * .02); c.fillStyle = p.dark; c.fillRect(-12, -1.5, 24, 3); c.restore(); c.fillStyle = p.main; for (let i = 0; i < 3; i++) c.fillRect(52 + i * 13, 14, 8, h - 28); },
    factory(c, w, h, p, s) { plate(c, w, h, s); c.fillStyle = s.m[3]; c.fillRect(8, 12, w - 16, h - 24); c.fillStyle = '#d9a23b'; for (let i = 0; i < 6; i++) c.fillRect(12 + i * 13, h - 18, 7, 4); shade(c, 18, 22, w - 36, 28, p.dark, 3); c.fillStyle = p.main; c.fillRect(18, 18 + (s.t * .3 % 30), w - 36, 3); },
    // 철갑회 건물: 육각 코어와 배기 핀 위주. 개척단의 사각 판 구조와 실루엣이 다르다.
    i_hq(c, w, h, p, s) { hexPad(c, w, h, s); const x = w / 2, y = h / 2; hex(c, x, y, 40, s.m[2]); hex(c, x, y, 31, p.dark); hex(c, x, y, 21, s.m[3]); circ(c, x, y, 13 + Math.sin(s.t * .07), p.main); circ(c, x, y, 6, p.light); c.save(); c.translate(x, y); c.rotate(s.t * .012); c.fillStyle = s.m[0]; for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); c.fillRect(24, -3, 12, 6); } c.restore(); fins(c, w, h, s); },
    i_depot(c, w, h, p, s) { hexPad(c, w, h, s); const x = w / 2, y = h / 2; hex(c, x, y, 25, s.m[2]); c.strokeStyle = p.main; c.lineWidth = 3; for (const r of [8, 15]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); } circ(c, x, y, 4, p.light); },
    i_extractor(c, w, h, p, s) { hexPad(c, w, h, s); const x = w / 2, y = h / 2; hex(c, x, y, 24, s.m[3]); c.strokeStyle = '#e06bd8'; c.lineWidth = 3; c.beginPath(); for (let a = 0; a < 15; a += .3) { const r = a * 1.25; c.lineTo(x + Math.cos(a + s.t * .05) * r, y + Math.sin(a + s.t * .05) * r); } c.stroke(); },
    i_barracks(c, w, h, p, s) { hexPad(c, w, h, s); const x = w / 2; hex(c, x, h / 2 - 4, 32, s.m[2]); c.fillStyle = p.dark; c.fillRect(x - 21, 28, 42, 28); c.fillStyle = '#ffb347'; c.fillRect(x - 17, 38 + Math.sin(s.t * .1) * 6, 34, 3); c.fillStyle = p.main; for (const a of [-1, 1]) { c.beginPath(); c.moveTo(x + 21 * a, 26); c.lineTo(x + 35 * a, 12); c.lineTo(x + 35 * a, 44); c.fill(); } fins(c, w, h, s); },
    i_lab(c, w, h, p, s) { hexPad(c, w, h, s); for (const [x, r] of [[26, 17], [48, 13], [70, 17]]) { hex(c, x, h / 2, r, s.m[2]); circ(c, x, h / 2, r * .55, p.main); } c.strokeStyle = p.light; c.lineWidth = 2; c.beginPath(); c.moveTo(26, h / 2); c.lineTo(70, h / 2); c.stroke(); },
    i_factory(c, w, h, p, s) { hexPad(c, w, h, s); const x = w / 2, y = h / 2; c.fillStyle = s.m[3]; c.beginPath(); c.moveTo(14, y); c.lineTo(x, 12); c.lineTo(w - 14, y); c.lineTo(x, h - 12); c.closePath(); c.fill(); hex(c, x, y, 21, p.dark); c.save(); c.translate(x, y); c.rotate(s.t * .03); c.fillStyle = p.main; for (let i = 0; i < 4; i++) { c.rotate(TAU / 4); c.fillRect(3, -3, 16, 6); } c.restore(); circ(c, x, y, 5, p.light); },
    i_turret(c, w, h, p, s) { hexPad(c, w, h, s); hex(c, w / 2, h / 2, 22, s.m[2]); c.save(); c.translate(w / 2, h / 2); c.rotate(s.facing); hex(c, 0, 0, 12, p.dark); c.fillStyle = s.m[3]; c.fillRect(4, -2.5, 27, 5); circ(c, 0, 0, 5, p.main); c.restore(); },
    // ── 포자군락: 살덩이 바닥(fleshPad) 위에 낭·굴·촉수 ──
    s_hq(c, w, h, p, s) { fleshPad(c, w, h, s); const x = w / 2, y = h / 2, b = 1 + Math.sin(s.t * .08) * .04; blob(c, x, y, 46 * b, 32 * b, FLESH[2]); blob(c, x, y, 38 * b, 25 * b, p.dark);
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + .3; blob(c, x + Math.cos(a) * 27, y + Math.sin(a) * 15, 8, 6, FLESH[1]); } blob(c, x, y, 16, 12, FLESH[3]); circ(c, x, y, 9, p.main); circ(c, x, y, 4.5 + Math.sin(s.t * .1), p.light); },
    s_pod(c, w, h, p, s) { fleshPad(c, w, h, s); const x = w / 2, y = h / 2, b = 1 + Math.sin(s.t * .12) * .07; blob(c, x, y + 3, 22, 18, FLESH[2]); blob(c, x, y, 18 * b, 15 * b, p.dark);
      blob(c, x - 6, y - 5, 6, 4, p.main); blob(c, x + 7, y + 3, 5, 3.5, p.main); circ(c, x - 7, y - 6, 2, p.light); },
    s_extractor(c, w, h, p, s) { fleshPad(c, w, h, s); const x = w / 2, y = h / 2; blob(c, x, y, 22, 20, FLESH[2]); c.strokeStyle = FLESH[1]; c.lineWidth = 5; for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + .7; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + .5) * 12, y + Math.sin(a + .5) * 12, x + Math.cos(a) * 20, y + Math.sin(a) * 19); c.stroke(); }
      circ(c, x, y, 10, p.dark); circ(c, x, y, 6 + Math.sin(s.t * .15), '#e06bd8'); },
    s_pool(c, w, h, p, s) { fleshPad(c, w, h, s); const x = w / 2, y = h / 2; blob(c, x, y, 36, 34, FLESH[2]); blob(c, x, y + 2, 26, 22, FLESH[3]); const b = Math.sin(s.t * .1);
      blob(c, x, y + 2, 20, 16, p.dark); for (const [dx, dy, r] of [[-8, -3, 5], [7, 4, 4], [2, -7, 3.4]]) circ(c, x + dx, y + dy + b, r, '#9be05a'); c.fillStyle = p.main; for (let i = 0; i < 5; i++) { const a = -2.6 + i * .55; c.beginPath(); c.moveTo(x + Math.cos(a) * 30, y + Math.sin(a) * 28); c.lineTo(x + Math.cos(a) * 41, y + Math.sin(a) * 39); c.lineTo(x + Math.cos(a + .18) * 30, y + Math.sin(a + .18) * 28); c.fill(); } },
    s_den(c, w, h, p, s) { fleshPad(c, w, h, s); const y = h / 2; for (const [x, r] of [[26, 17], [50, 13], [72, 16]]) { blob(c, x, y, r, r * .9, FLESH[2]); blob(c, x, y, r * .7, r * .62, p.dark); const k = 1 + Math.sin(s.t * .1 + x) * .12; circ(c, x, y, r * .3 * k, p.main); }
      c.strokeStyle = FLESH[1]; c.lineWidth = 4; c.beginPath(); c.moveTo(36, y); c.lineTo(42, y); c.moveTo(60, y); c.lineTo(64, y); c.stroke(); },
    s_nest(c, w, h, p, s) { fleshPad(c, w, h, s); const x = w / 2, y = h / 2; c.fillStyle = FLESH[3]; for (let i = 0; i < 9; i++) { const a = i * TAU / 9; c.beginPath(); c.moveTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18); c.lineTo(x + Math.cos(a + .2) * 42, y + Math.sin(a + .2) * 40); c.lineTo(x + Math.cos(a + .45) * 18, y + Math.sin(a + .45) * 18); c.fill(); }
      blob(c, x, y, 30, 28, FLESH[2]); blob(c, x, y, 22, 20, p.dark); for (const [dx, dy] of [[-8, -5], [7, -6], [0, 7]]) { blob(c, x + dx, y + dy, 6, 7.5, FLESH[0]); blob(c, x + dx, y + dy - 1, 3, 4, p.light); } },
    s_spine(c, w, h, p, s) { fleshPad(c, w, h, s); blob(c, w / 2, h / 2, 21, 20, FLESH[2]); c.save(); c.translate(w / 2, h / 2); c.rotate(s.facing); blob(c, 0, 0, 12, 11, p.dark);
      c.strokeStyle = FLESH[1]; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(14, -6, 26, 0); c.stroke(); c.lineCap = 'butt'; c.fillStyle = '#efe4d2'; c.beginPath(); c.moveTo(24, -4); c.lineTo(33, 0); c.lineTo(24, 4); c.fill(); circ(c, 0, 0, 5, p.main); c.restore(); },
    site_ore(c, w, h, p, s) { siteBase(c, w, h, p, s, '#ffc247'); },
    site_gas(c, w, h, p, s) { siteBase(c, w, h, p, s, '#ea7be0'); },
    site_post(c, w, h, p, s) { plate(c, w, h, s); shade(c, 12, 16, w - 24, h - 30, p.dark, 3); c.fillStyle = p.main; c.beginPath(); c.moveTo(cx3(w) - 30, 18); c.lineTo(cx3(w), 2); c.lineTo(cx3(w) + 30, 18); c.fill();
      c.fillStyle = '#e8c15e'; c.fillRect(cx3(w) - 2, 24, 4, 30); c.beginPath(); c.moveTo(cx3(w) + 2, 24); c.lineTo(cx3(w) + 22, 31); c.lineTo(cx3(w) + 2, 38); c.fill(); c.fillStyle = s.m[3]; c.fillRect(16, h - 22, w - 32, 8); },
    turret(c, w, h, p, s) { plate(c, w, h, s); circ(c, w / 2, h / 2, 21, s.m[2]); c.save(); c.translate(w / 2, h / 2); c.rotate(s.facing); shade(c, -11, -11, 22, 22, p.dark, 5); c.fillStyle = s.m[3]; c.fillRect(6, -6, 22, 4); c.fillRect(6, 2, 22, 4); circ(c, 0, 0, 6, p.main); c.restore(); },
  },
};
// 포자군락 바닥: 둥근 살덩이 + 핏줄
function fleshPad(c, w, h, s) { blob(c, w / 2, h / 2, w / 2 - 2, h / 2 - 2, FLESH[3]); blob(c, w / 2, h / 2, w / 2 - 5, h / 2 - 5, FLESH[2]);
  c.strokeStyle = '#8a3f5c'; c.lineWidth = 1.4; for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + .4; c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * w * .18, h / 2 + Math.sin(a) * h * .18); c.quadraticCurveTo(w / 2 + Math.cos(a + .3) * w * .32, h / 2 + Math.sin(a + .3) * h * .32, w / 2 + Math.cos(a) * (w / 2 - 6), h / 2 + Math.sin(a) * (h / 2 - 6)); c.stroke(); } }
function hex(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 6; i++) c.lineTo(x + Math.cos(i * TAU / 6) * r, y + Math.sin(i * TAU / 6) * r); c.closePath(); c.fill(); }
function hexPad(c, w, h, s) { c.fillStyle = s.m[3]; c.beginPath(); const q = 16; c.moveTo(q, 3); c.lineTo(w - q, 3); c.lineTo(w - 3, h / 2); c.lineTo(w - q, h - 3); c.lineTo(q, h - 3); c.lineTo(3, h / 2); c.closePath(); c.fill(); c.strokeStyle = s.m[1]; c.lineWidth = 2; c.stroke(); }
function fins(c, w, h, s) { c.fillStyle = s.m[0]; for (let i = 0; i < 3; i++) { c.fillRect(12 + i * 7, h - 15, 4, 8); c.fillRect(w - 26 + i * 7, h - 15, 4, 8); } }
function siteBase(c, w, h, p, s, col) { plate(c, w, h, s); shade(c, 12, 12, w - 24, h - 24, p.dark, 3); // 채굴탑
  const cx = w / 2, cy = h / 2; c.strokeStyle = p.light; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 20, cy + 20); c.lineTo(cx, cy - 24); c.lineTo(cx + 20, cy + 20); c.moveTo(cx - 12, cy + 2); c.lineTo(cx + 12, cy + 2); c.stroke();
  circ(c, cx, cy + 13, 9, s.m[3]); circ(c, cx, cy + 13, 5 + (s.down ? 0 : Math.sin(s.t * .12)), s.down ? '#55606e' : col); }
// 입체감: 건물 높이(px). 데이터에 height가 있으면 그 값을 쓴다.
function heightOf(d) { return d.height ?? Math.min(12, 4 + Math.min(d.size[0], d.size[1]) * 2.5); }
const WALL = { t_hall: '#3e2e1c', t_tower: '#3e2e1c' }; // 벽면 색. 없으면 재질의 가장 어두운 색
function plate(c, w, h, s) { const m = s.m, k = 9; // 바닥판 + 입체 모서리. 철갑회는 모서리를 더 깎는다.
  const q = s.faction === 'ironclad' ? 15 : k;
  const path = (i) => { c.beginPath(); c.moveTo(q + i, i); c.lineTo(w - q - i, i); c.lineTo(w - i, q + i); c.lineTo(w - i, h - q - i); c.lineTo(w - q - i, h - i); c.lineTo(q + i, h - i); c.lineTo(i, h - q - i); c.lineTo(i, q + i); c.closePath(); };
  c.fillStyle = m[3]; path(1); c.fill(); c.fillStyle = m[1]; path(3); c.fill(); c.strokeStyle = m[0]; c.lineWidth = 1.5; path(4); c.stroke();
}

RTS.Renderer = function (canvas, app) {
  const ctx = canvas.getContext('2d'), R = { cam: { x: 0, y: 0, z: 1 }, fx: [], decals: [], tracks: [], ghosts: {}, pings: [] }, built = new Map();
  // 고급 그래픽(WebGL): 전장은 world(화면 밖 2D 캔버스)에 그리고 glfx가 조명·안개를 입혀 아래 캔버스에 낸다.
  // 체력 바·건설 미리보기·드래그 상자 같은 표시는 원래 캔버스(투명)에 그려 조명과 안개를 받지 않게 한다.
  const world = document.createElement('canvas'), wctx = world.getContext('2d'); let gfx = null, gfxTried = false, LON = false, slow = 0, lastNow = 0;
  const lights = [], rgbC = {}, col3 = h => rgbC[h] || (rgbC[h] = h[0] === '#' && h.length >= 7 ? [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255] : [1, 1, 1]);
  const light = (x, y, r, col, i) => { if (LON && i > .01) lights.push(x, y, r, col[0] * i, col[1] * i, col[2] * i); }; // 월드 px
  const fogGL = R.fogGL = { data: null, w: 0, h: 0, v: 0 };
  let bake = null, bakeFor = null; const fog = document.createElement('canvas'); const fogC = fog.getContext('2d'); let fogImg = null;
  const ringCol = e => e.team === app.team ? '#7dffa8' : app.G.coop && e.team >= 0 && RTS.ally(app.G, app.team, e.team) ? '#8fd3ff' : e.team === RTS.TRIBE ? (RTS.foe(app.G, app.team, e.team) ? '#ff6a5a' : '#ffe27a') : e.team < 0 ? '#ffe27a' : '#ff6a5a';
  const stateOf = (d, e, t) => ({ t, faction: e.team >= 0 && app.G.teams[e.team] ? app.G.teams[e.team].faction : 'pioneers', tint: d.tint, moving: !!e.path, cargo: e.cargo ? e.cargoType : null, sieged: e.sieged, m: matOf(e.team >= 0 && app.G.teams[e.team]?.faction), facing: e.facing });

  function bakeTerrain(G) {
    const tid = RTS.defs.maps[G.mapId].theme, th = RTS.THEMES[tid] || RTS.THEMES.dusk;
    const c = RTS.bakeTerrainHD(G, th, RTS.THEMES[tid] ? tid : 'dusk'); // 높이맵·햇빛·그림자로 굽는다(terrain.js)
    bake = c; bakeFor = G; R.tracks = []; built.clear();
    fog.width = G.w; fog.height = G.h; fogImg = fogC.createImageData(G.w, G.h); R.decals = []; R.fx = []; R.ghosts = {};
  }
  R.terrain = () => bake;

  // ── 특수 효과. 화면 전용이라 Math.random을 써도 된다(게임 상태에는 손대지 않는다). ──
  const rich = () => app.settings.fxRich !== false, depthOn = () => app.settings.depth !== false, rnd = (a, b) => a + Math.random() * (b - a);
  const fx = o => { o.max = o.life; R.fx.push(o); return o; };
  const shake = (x, y, amt) => { if (app.settings.shake === false || !R.onScreen(x, y)) return; R.shake = Math.min(14, Math.max(R.shake || 0, amt)); };
  const zOf = e => { const d = RTS.defOf(e); return d.air ? 20 : d.size && depthOn() ? heightOf(d) : 0; };
  function sparks(x, y, n, col, a0, spread, z = 0) { for (let i = 0; i < n; i++) { const a = a0 === undefined ? rnd(0, TAU) : a0 + rnd(-spread, spread), v = rnd(.05, .14); fx({ k: 'spark', x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(6, 11) | 0, c: col }); } }
  function debris(x, y, n, cols, pow, z = 0) { if (!rich()) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(.02, .07) * pow; fx({ k: 'debris', x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rnd(2, 5) * Math.sqrt(pow), rot: rnd(0, TAU), vr: rnd(-.4, .4), sz: rnd(2, 4.5) * Math.min(1.6, pow), life: rnd(28, 46) | 0, c: cols[i % cols.length] }); } }
  function embers(x, y, n, pow, z = 0) { if (!rich()) return; for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(.03, .1) * pow; fx({ k: 'ember', x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rnd(1.5, 4.5), life: rnd(18, 34) | 0 }); } }
  function smoke(x, y, n, s, spread, delay = 0) { for (let i = 0; i < (rich() ? n : Math.ceil(n / 2)); i++) fx({ k: 'smoke', x: x + rnd(-spread, spread), y: y + rnd(-spread, spread), s: s * rnd(.7, 1.3), vx: rnd(-.006, .006), life: rnd(34, 58) | 0, delay: delay + (i * 3 | 0) }); }
  function scorch(x, y, s, rubble) { const dec = { x, y, s, rot: rnd(0, 3) }; if (rubble) dec.rub = Array.from({ length: rubble }, () => [rnd(-s, s) * .55, rnd(-s, s) * .45, rnd(3, 8), rnd(2, 6), rnd(0, 3), Math.random() < .5 ? '#2a2c33' : '#3f3a34']); R.decals.push(dec); if (R.decals.length > 90) R.decals.shift(); }
  // 폭발: s는 반경(타일). 화구 → 충격파 → 불씨·파편 → 연기 → 그을음.
  function explode(x, y, s, o = {}) {
    const z = o.z || 0;
    fx({ k: 'fireball', x, y, z, s, life: (12 + s * 6) | 0, delay: o.delay || 0 });
    fx({ k: 'shock', x, y, s: s * 1.5, life: 14, delay: o.delay || 0 });
    embers(x, y, Math.round(4 + s * 5), 1 + s * .4, z); smoke(x, y, Math.round(2 + s * 2), 8 + s * 6, s * .3, (o.delay || 0) + 6);
    if (!o.noScorch) scorch(x, y, s * TS * .8);
    shake(x, y, 1.5 + s * 2.2);
  }

  R.attach = function (G) {
    RTS.on(G, 'shot', ({ e, w }) => { if (!R.onScreen(e.x, e.y)) return; const d = RTS.defOf(e), a = e.facing, rr = (d.r || (d.size ? .9 : .6)) + .2, z = zOf(e), mx = e.x + Math.cos(a) * rr, my = e.y + Math.sin(a) * rr;
      if (!w.speed && (w.range || 0) < 1) fx({ k: 'slash', x: e.x + Math.cos(a) * rr * .7, y: e.y + Math.sin(a) * rr * .7, z, a, life: 7 });
      else { const big = w.art === 'shell', s = w.splash ? 7.5 : big ? 6.5 : 4.2;
        fx({ k: 'muzzle', x: mx, y: my, z, a, s, life: big ? 5 : 3 });
        if (big) { fx({ k: 'smoke', x: mx, y: my, s: 6, vx: Math.cos(a) * .01, life: 26, delay: 1 }); if (e.sieged) shake(e.x, e.y, 2.2); }
        else if (rich() && Math.random() < .5) fx({ k: 'casing', x: e.x, y: e.y, z: z + 4, vx: Math.cos(a + 1.6) * .03, vy: Math.sin(a + 1.6) * .03, vz: 2, life: 14 }); }
      app.sfx(w.splash ? 'thump' : w.speed ? 'shot' : 'slash', e); });
    RTS.on(G, 'impact', ({ x, y, w }) => { if (!R.onScreen(x, y)) return;
      if (w.splash) { explode(x, y, w.splash * .75); app.sfx('boom', { x, y }); }
      else { fx({ k: 'hit', x, y, life: 4 }); sparks(x, y, rich() ? 4 : 2, '#ffe9a8'); } });
    RTS.on(G, 'heal', ({ e, t }) => fx({ k: 'beam', x: e.x, y: e.y, x2: t.x, y2: t.y, life: 6 }));
    RTS.on(G, 'ability', ({ e }) => fx({ k: 'ring', x: e.x, y: e.y, life: 14, s: 1.4 }));
    RTS.on(G, 'death', ({ e }) => { if (!R.onScreen(e.x, e.y)) return; const d = RTS.defOf(e), col = (RTS.TEAM[e.team] || NEUTRAL).main;
      if (d.size) { const [sw, sh] = d.size, big = Math.max(sw, sh), z = depthOn() ? heightOf(d) : 0; // 건물: 여러 번 터지며 무너진다
        for (let i = 0; i < 2 + big; i++) explode(e.x + rnd(-sw, sw) * .35, e.y + rnd(-sh, sh) * .35, rnd(.7, 1.1) * (.6 + big * .25), { delay: i * 4, z, noScorch: true });
        fx({ k: 'shock', x: e.x, y: e.y, s: big * 1.4, life: 20, delay: 6 }); fx({ k: 'flashwide', x: e.x, y: e.y, s: big, life: 8 });
        debris(e.x, e.y, 10 + big * 5, [col, '#59677b', '#8795a8', '#39455a'], 1 + big * .3, z); embers(e.x, e.y, 10 + big * 3, 1.4, z);
        smoke(e.x, e.y, 5 + big * 2, 16 + big * 4, big * .3, 10); scorch(e.x, e.y, big * TS * .7, rich() ? 10 + big * 3 : 4);
        shake(e.x, e.y, d.dropoff ? 13 : 6 + big * 1.5); app.sfx('bigboom', e); }
      else { const bio = (d.tags || []).includes('bio'), z = d.air ? 20 : 0, s = (d.r || .4) * 1.4;
        if (bio) { fx({ k: 'puff', x: e.x, y: e.y, s: s * TS, life: 18 }); debris(e.x, e.y, 4, [col, '#6b5a44'], .7); scorch(e.x, e.y, s * TS * .6); }
        else { explode(e.x, e.y, s, { z }); debris(e.x, e.y, 6 + (s * 6 | 0), [col, '#59677b', '#2a2c33'], 1 + s * .6, z); }
        app.sfx(bio ? 'boom' : d.r > .6 ? 'bigboom' : 'boom', e); } });
  };
  R.onScreen = (x, y) => { const c = R.cam, w = canvas.width / c.z, h = canvas.height / c.z, px = x * TS, py = y * TS; return px > c.x - 64 && py > c.y - 64 && px < c.x + w + 64 && py < c.y + h + 64; };

  function updateFogGL(G, team) { // 고급 그래픽 안개: 타일마다 0 보임, 140 본 적 있음, 255 처음
    const t = G.teams[team], N = G.w * G.h; if (!fogGL.data || fogGL.data.length !== N) fogGL.data = new Uint8Array(N);
    for (let i = 0; i < N; i++) fogGL.data[i] = t.vis[i] ? 0 : t.seen[i] ? 140 : 255; fogGL.w = G.w; fogGL.h = G.h; fogGL.v++;
  }
  // 테마별 주변광(빛 지도 바탕)과 색조. 주변광이 1보다 낮을수록 불빛이 도드라진다.
  R.LIGHTING = { dusk: { amb: [.74, .79, .96], tint: [1, 1, 1.02] }, ochre: { amb: [.97, .86, .74], tint: [1.03, 1, .96] }, frost: { amb: [.84, .91, 1.04], tint: [.98, 1, 1.04] }, moss: { amb: [.78, .88, .78], tint: [1, 1.02, .98] } };
  const amb = () => R.LIGHTING[(RTS.defs.maps[app.G.mapId] || {}).theme] || R.LIGHTING.dusk;
  function screenLights(cam, ox, oy) { const z = cam.z, out = [], W = canvas.width, H = canvas.height;
    for (let i = 0; i < lights.length; i += 6) { const x = (lights[i] - cam.x) * z + ox, y = (lights[i + 1] - cam.y) * z + oy, r = lights[i + 2] * z;
      if (x + r < 0 || y + r < 0 || x - r > W || y - r > H) continue; out.push(x, y, r, lights[i + 3], lights[i + 4], lights[i + 5]); }
    return out; }
  function shocks(cam, ox, oy) { const out = []; // 충격파 굴절: 화면에서 큰 것부터 6개
    for (const f of R.fx) { if (f.k !== 'shock' || f.delay > 0 || f.life <= 0) continue; const k = f.life / f.max, r = f.s * TS * (.25 + 1.1 * (1 - k * k));
      out.push([(f.x * TS - cam.x) * cam.z + ox, (f.y * TS - cam.y) * cam.z + oy, r * cam.z, Math.min(9, 3 + f.s * 2.5) * k * cam.z]); }
    return out.sort((a, b) => b[3] - a[3]); }
  // 날씨 입자: 화면 기준으로 떠다니고 카메라가 움직이면 땅보다 조금 빠르게 밀려 가까이 있는 느낌을 준다.
  const WX = { frost: { n: 90, col: 'rgba(240,248,255,.8)', vx: -.35, vy: .9, sz: [1.2, 2.6], kind: 'snow' }, ochre: { n: 45, col: 'rgba(230,190,130,.28)', vx: 2.6, vy: .25, sz: [6, 16], kind: 'dust' },
    dusk: { n: 34, col: 'rgba(170,230,255,.55)', vx: .15, vy: -.12, sz: [1, 2], kind: 'mote' }, moss: { n: 40, col: 'rgba(210,240,150,.5)', vx: .25, vy: -.18, sz: [1, 2.2], kind: 'mote' } };
  let wxP = [], wxCam = null, wxTheme = null;
  function drawWeather(c, G, W, H) { if (app.settings.weather === false || !rich()) return; const th = (RTS.defs.maps[G.mapId] || {}).theme, S = WX[th]; if (!S) return;
    if (wxTheme !== th || !wxP.length) { wxTheme = th; wxP = Array.from({ length: S.n }, () => ({ x: Math.random() * W, y: Math.random() * H, s: rnd(S.sz[0], S.sz[1]), p: Math.random() * TAU, d: rnd(.6, 1.4) })); }
    const cam = R.cam, dx = wxCam ? (cam.x - wxCam.x) * cam.z * 1.15 : 0, dy = wxCam ? (cam.y - wxCam.y) * cam.z * 1.15 : 0; wxCam = { x: cam.x, y: cam.y };
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = S.col; c.strokeStyle = S.col; c.lineCap = 'round';
    for (const q of wxP) { q.p += .03; q.x += S.vx * q.d + Math.sin(q.p) * (S.kind === 'snow' ? .4 : .25) - dx; q.y += S.vy * q.d + Math.cos(q.p * .7) * .2 - dy;
      if (q.x < -20) q.x += W + 40; else if (q.x > W + 20) q.x -= W + 40; if (q.y < -20) q.y += H + 40; else if (q.y > H + 20) q.y -= H + 40;
      if (S.kind === 'dust') { c.globalAlpha = .5 + .5 * Math.sin(q.p); c.lineWidth = 1.2; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.s, q.y - q.s * .1); c.stroke(); }
      else { c.globalAlpha = S.kind === 'mote' ? .4 + .6 * Math.abs(Math.sin(q.p * 1.3)) : 1; c.beginPath(); c.arc(q.x, q.y, q.s, 0, TAU); c.fill(); } }
    c.restore(); }
  function updateFog(G, team) {
    const t = G.teams[team], d = fogImg.data, N = G.w * G.h;
    for (let i = 0; i < N; i++) { d[i * 4] = 8; d[i * 4 + 1] = 12; d[i * 4 + 2] = 22; d[i * 4 + 3] = t.vis[i] ? 0 : t.seen[i] ? 135 : 245; }
    fogC.putImageData(fogImg, 0, 0);
  }

  // ── 입체감용 작업 캔버스. 확대율에 맞춰 그려 흐려지지 않게 한다. ──
  const S = {}; for (const n of ['roof', 'sil', 'unit']) { S[n] = document.createElement('canvas'); S[n].width = S[n].height = 8; }
  function fit(cv, W, H) { if (cv.width < W || cv.height < H) { cv.width = Math.max(cv.width, W); cv.height = Math.max(cv.height, H); } const x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, cv.width, cv.height); return x; }
  // 벽·그림자는 실루엣에서만 나오므로 (그림, 재질, 높이, 포탑 방향)마다 한 번 만들어 재사용한다. 지붕만 매 프레임 그린다.
  const wallCache = new Map(); let wallK = 0;
  function sprite(art, w, h, P, st, hz, wall, key) {
    const k = Math.min(2, R.cam.z), pad = 4, rw = Math.ceil((w + pad * 2) * k), rh = Math.ceil((h + pad * 2) * k), step = 2;
    const r = fit(S.roof, rw, rh); r.setTransform(k, 0, 0, k, pad * k, pad * k); art(r, w, h, P, st); // 지붕: 왼쪽 위에서 빛
    r.globalCompositeOperation = 'source-atop'; const g = r.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,.2)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.26)');
    r.fillStyle = g; r.fillRect(-pad, -pad, w + pad * 2, h + pad * 2); if (st.hit) { r.fillStyle = 'rgba(255,255,255,.22)'; r.fillRect(-pad, -pad, w + pad * 2, h + pad * 2); }
    if (k !== wallK) { wallCache.clear(); wallK = k; }
    const ck = key + '|' + hz, bh = Math.ceil((h + pad * 2 + hz) * k), dx = hz * 1.1 + 3, dy = hz * .7 + 4, sw = rw + Math.ceil(dx * k), sh = rh + Math.ceil(dy * k);
    let W = wallCache.get(ck);
    if (!W) { if (wallCache.size > 60) wallCache.clear();
      W = { walls: document.createElement('canvas'), shadow: document.createElement('canvas') };
      const s = fit(S.sil, rw, rh); s.drawImage(S.roof, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = wall; s.fillRect(0, 0, rw, rh);
      W.walls.width = rw; W.walls.height = bh; const b = W.walls.getContext('2d'); // 벽: 실루엣을 바닥부터 지붕 아래까지 쌓는다
      for (let z = 0; z < hz; z += step) b.drawImage(S.sil, 0, 0, rw, rh, 0, Math.round((hz - z) * k), rw, rh);
      if (hz > 0) { b.globalCompositeOperation = 'source-atop'; const v = b.createLinearGradient(0, rh * .5, 0, bh); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)'); b.fillStyle = v; b.fillRect(0, 0, rw, bh); }
      W.shadow.width = sw; W.shadow.height = sh; const sd = W.shadow.getContext('2d'), n = Math.max(1, Math.ceil(Math.max(dx, dy) / step)); // 그림자: 오른쪽 아래로 늘인 실루엣
      for (let i = 0; i <= n; i++) sd.drawImage(S.sil, 0, 0, rw, rh, Math.round(dx * k * i / n), Math.round(dy * k * i / n), rw, rh);
      sd.globalCompositeOperation = 'source-in'; sd.fillStyle = '#000'; sd.fillRect(0, 0, sw, sh);
      wallCache.set(ck, W); }
    return { roof: S.roof, walls: W.walls, shadow: W.shadow, k, pad, rw, rh, bh, sw, sh };
  }
  let unitLight = null;
  function unitSprite(fn, P, st, facing, size, hit) { // 유닛: 몸체를 그린 뒤 고정된 방향의 빛을 입혀 둥글게 보이게 한다
    const k = Math.min(2, R.cam.z), L = 76, px = Math.ceil(L * k), u = fit(S.unit, px, px);
    u.setTransform(k, 0, 0, k, L / 2 * k, L / 2 * k); u.rotate(facing); fn(u, P, st);
    u.setTransform(k, 0, 0, k, L / 2 * k, L / 2 * k); const sc = Math.max(.8, size / 13); u.scale(sc, sc); u.globalCompositeOperation = 'source-atop';
    if (!unitLight) { unitLight = u.createRadialGradient(-5, -6, 1, -5, -6, 19); unitLight.addColorStop(0, 'rgba(255,255,255,.34)'); unitLight.addColorStop(.42, 'rgba(255,255,255,0)'); unitLight.addColorStop(.68, 'rgba(0,0,0,0)'); unitLight.addColorStop(1, 'rgba(0,0,0,.42)'); }
    u.fillStyle = unitLight; u.fillRect(-L, -L, L * 2, L * 2); if (hit) { u.fillStyle = 'rgba(255,255,255,.55)'; u.fillRect(-L, -L, L * 2, L * 2); }
    return { px, L };
  }

  function drawBuilding(c, G, e, d, a, ghost) {
    const r = RTS.rectOf(e), P = RTS.TEAM[e.team] || NEUTRAL, w = d.size[0] * TS, h = d.size[1] * TS, st = stateOf(d, e, app.frame); st.down = e.downUntil > G.tick;
    c.save(); c.translate(r.x0 * TS, r.y0 * TS);
    if (ghost) c.globalAlpha = .55;
    const prog = e.buildT ? Math.min(1, e.built / e.buildT) : 1, art0 = RTS.art.buildings[d.art] || plate, base = c.globalAlpha;
    // 그림 상태: 생산 중·체력·빛·연기(buildart.js). 빛과 연기는 건물 안 좌표 → 월드 px
    const ox0 = r.x0 * TS, oy0 = r.y0 * TS; let hzUse = 0;
    if (!ghost && e.id) { st.id = e.id; st.busy = !!(e.prod && e.prod.length); st.hp = prog < 1 ? 1 : e.hp / (RTS.stat(G, e, 'hp') || d.hp);
      if (LON && prog >= 1 && !st.down) st.glow = (x, y, rr, col, i) => light(ox0 + x, oy0 + y - hzUse, rr, col3(col), i);
      if (prog >= 1 && R.onScreen(e.x, e.y)) st.emit = (k, x, y) => { const wx = (ox0 + x) / TS, wy = (oy0 + y) / TS, z = hzUse;
        if (k === 'smoke') fx({ k: 'smoke', x: wx, y: wy, z, s: 5, vx: .004, life: 40 }); else if (k === 'steam') fx({ k: 'steam', x: wx, y: wy, z, s: 6, life: 30 }); else if (k === 'spark' && rich()) sparks(wx, wy, 3, '#ffd27a', undefined, 0, z); }; }
    const art = (cc, ww, hh, PP, ss) => { art0(cc, ww, hh, PP, ss); if (ss.hp < .66 && RTS.artDamage) RTS.artDamage(cc, ww, hh, ss); };
    if (depthOn()) { // 지붕(그림+조명) → 벽(실루엣을 쌓아 올림) → 그림자. 짓는 중이면 높이가 같이 자란다.
      const hz = Math.round(heightOf(d) * (prog < 1 ? .2 + .8 * prog : 1)); hzUse = hz;
      st.hit = !ghost && e.hitAt && G.tick - e.hitAt < 2;
      const sp = sprite(art, w, h, P, st, hz, WALL[d.art] || st.m[3], d.art + '|' + st.faction + '|' + (/turret/.test(d.art) ? Math.round((st.facing || 0) * 4) : ''));
      c.globalAlpha = base * .34; c.drawImage(sp.shadow, 0, 0, sp.sw, sp.sh, -sp.pad, -sp.pad, sp.sw / sp.k, sp.sh / sp.k);
      const put = () => { c.drawImage(sp.walls, 0, 0, sp.rw, sp.bh, -sp.pad, -sp.pad - hz, sp.rw / sp.k, sp.bh / sp.k); c.drawImage(sp.roof, 0, 0, sp.rw, sp.rh, -sp.pad, -sp.pad - hz, sp.rw / sp.k, sp.rh / sp.k); };
      c.globalAlpha = base * (prog < 1 ? .5 : 1); put();
      if (prog < 1) { c.globalAlpha = base; const y0 = -hz + (h + hz) * (1 - prog); c.save(); c.beginPath(); c.rect(-sp.pad, y0, w + sp.pad * 2, h + hz); c.clip(); put(); c.restore();
        if (RTS.artScaffold && !ghost) RTS.artScaffold(c, w, h, prog, app.frame + (e.id || 0) * 13, -hz);
        c.strokeStyle = '#ffcb5c'; c.setLineDash([7, 6]); c.lineWidth = 2; c.strokeRect(2, 2, w - 4, h - 4); c.setLineDash([]); c.fillStyle = '#ffcb5c'; c.fillRect(0, y0 - 1.5, w, 3); }
    } else {
      c.fillStyle = 'rgba(0,0,0,.32)'; c.fillRect(4, 8, w, h);
      if (prog < 1) { c.globalAlpha = base * .5; }
      art(c, w, h, P, st);
      if (prog < 1) { c.globalAlpha = base; c.beginPath(); c.rect(0, h * (1 - prog), w, h * prog); c.save(); c.clip(); art(c, w, h, P, st); c.restore(); if (RTS.artScaffold && !ghost) RTS.artScaffold(c, w, h, prog, app.frame + (e.id || 0) * 13, 0);
        c.strokeStyle = '#ffcb5c'; c.setLineDash([7, 6]); c.lineWidth = 2; c.strokeRect(2, 2, w - 4, h - 4); c.setLineDash([]);
        c.fillStyle = '#ffcb5c'; c.fillRect(0, h * (1 - prog) - 1.5, w, 3); }
    }
    c.globalAlpha = base;
    if (prog >= 1 && !ghost && e.hp < d.hp * .25 && app.frame % 5 === 0 && R.onScreen(e.x, e.y)) fx({ k: 'fire', x: e.x + rnd(-.3, .3) * d.size[0], y: e.y + rnd(-.3, .3) * d.size[1], z: depthOn() ? heightOf(d) : 0, life: rnd(16, 26) | 0 });
    if (e.tribeHall && !ghost && G.tribe) { const T = G.tribe, me = app.team, r = me >= 0 ? T.rel[me] : '', txt = '잿빛 부족' + (T.dead ? '' : r ? ' · ' + RTS.tribeRelName(r) : ''); c.font = '600 12px "IBM Plex Sans KR",sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(8,12,22,.78)'; c.fillRect(w / 2 - 54, h + 3, 108, 17); c.fillStyle = r === 'ally' ? '#9dffb5' : r === 'hostile' ? '#ff9a8a' : '#e6f7c6'; c.fillText(txt, w / 2, h + 16); c.textAlign = 'start'; }
    if (e.branch && !ghost) { c.font = '600 12px "IBM Plex Sans KR",sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(8,12,22,.78)'; c.fillRect(w / 2 - 44, h + 3, 88, 17); c.fillStyle = '#ffe6b0'; c.fillText(RTS.defs.branches[e.branch].name, w / 2, h + 16); c.textAlign = 'start'; }
    if (e.company && !ghost) { const co = G.market.cos[e.company]; c.font = '600 12px "IBM Plex Sans KR",sans-serif'; c.textAlign = 'center'; const label = RTS.defs.companies[e.company].name + ' ' + co.price.toFixed(1); c.fillStyle = 'rgba(8,12,22,.78)'; c.fillRect(w / 2 - 50, h + 3, 100, 17); c.fillStyle = st.down ? '#ff8a7a' : '#fff'; c.fillText(st.down ? '가동 중단' : label, w / 2, h + 16); c.textAlign = 'start'; }
    if (prog < 1 && !ghost && e.id && rich() && R.onScreen(e.x, e.y)) { const was = built.get(e.id); built.set(e.id, e.built); // 짓는 중이면 용접 불꽃
      if (was !== undefined && e.built > was && app.frame % 4 === 0) { const sx = e.x + rnd(-.4, .4) * d.size[0], sy = e.y + rnd(-.4, .4) * d.size[1], z = depthOn() ? heightOf(d) * prog : 0;
        sparks(sx, sy, 3, '#ffe39a', -Math.PI / 2, 1.4, z); fx({ k: 'hit', x: sx, y: sy, z, life: 3 }); } }
    if (LON && !ghost && e.id) { const big = Math.max(w, h), z = depthOn() ? heightOf(d) : 0; // 건물 불빛
      if (prog < 1) light(e.x * TS, e.y * TS, big * .75, [1, .8, .42], .3 + .12 * Math.sin(app.frame * .5 + e.id));
      else if (!st.down) { light(e.x * TS, e.y * TS - z, big * .9, col3(P.main), d.dropoff ? .24 : d.weapon ? .18 : .14);
        if (/extractor/.test(d.art)) light(e.x * TS, e.y * TS - z, big * 1.1, [1, .42, .95], .5);
        if (e.tribeHall) light(e.x * TS, e.y * TS + h * .3, big * 1.2, [1, .6, .25], .6 + .12 * Math.sin(app.frame * .3));
        if (e.hp < d.hp * .25) light(e.x * TS, e.y * TS - z, big * 1.1, [1, .45, .15], .22 + .1 * Math.sin(app.frame * .7)); } }
    if (e.hp < d.hp * .45 && prog >= 1 && app.frame % 7 === 0 && !ghost) R.fx.push({ k: 'smoke', x: e.x + (Math.random() - .5) * d.size[0] * .6, y: e.y + (Math.random() - .5) * d.size[1] * .6, life: 24, max: 24, s: 8 });
    c.restore();
  }
  function drawNode(c, G, e, d) {
    if (d.resource === 'ore') { const X = (e.x - 1) * TS, Y = (e.y - .5) * TS, k = Math.max(.45, e.amount / d.amount), seedA = e.id * 37 % 7;
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(X + 3, Y + 18, 58, 12);
      light(e.x * TS, e.y * TS, 64, [1, .74, .32], .1 + .08 * k);
      if (rich() && Math.random() < .012) fx({ k: 'glint', x: e.x + rnd(-.85, .85), y: e.y + rnd(-.45, .2), life: 16 });
      for (let i = 0; i < 6; i++) { const cx = X + 7 + i * 10, h = (13 + ((i + seedA) * 5 % 11)) * k, wd = 7;
        c.fillStyle = '#b36f1c'; c.beginPath(); c.moveTo(cx - wd, Y + 28); c.lineTo(cx, Y + 28 - h - 6); c.lineTo(cx + 1, Y + 28); c.fill();
        c.fillStyle = '#ffc247'; c.beginPath(); c.moveTo(cx + 1, Y + 28); c.lineTo(cx, Y + 28 - h - 6); c.lineTo(cx + wd, Y + 28); c.fill();
        c.fillStyle = '#fff0b8'; c.fillRect(cx - 1, Y + 28 - h - 2, 2, 5); }
    } else { const X = e.x * TS, Y = e.y * TS; if (e.ext) return; light(X, Y, 100, [1, .4, .95], .5 + Math.sin(app.frame * .08 + e.id) * .12);
      circ(c, X, Y, 27, '#2a1a30'); circ(c, X, Y, 19, '#5b2358'); circ(c, X, Y, 10 + Math.sin(app.frame * .08 + e.id) * 3, '#ea7be0');
      if (app.frame % 11 === e.id % 11) R.fx.push({ k: 'steam', x: e.x, y: e.y, life: 30, max: 30, s: 7 }); }
  }

  R.draw = function (alpha) {
    const G = app.G, me = app.team; if (!G) return;
    if (bakeFor !== G) bakeTerrain(G);
    const wantGL = app.settings.gl !== false;
    if (wantGL && !gfxTried && canvas.parentNode) { gfxTried = true; try { gfx = RTS.GLFX(canvas.parentNode, canvas); } catch (err) { gfx = null; } }
    const glOn = !!(wantGL && gfx && gfx.ok); if (gfx) gfx.show(glOn); R.gl = LON = glOn; lights.length = 0;
    if (glOn && (world.width !== canvas.width || world.height !== canvas.height)) { world.width = canvas.width; world.height = canvas.height; }
    const now = performance.now(); if (glOn && lastNow && !gfx.low) { slow = now - lastNow > 40 ? slow + 1 : Math.max(0, slow - 2); if (slow > 120) { gfx.low = true; app.notice && app.notice('기기가 느려 빛 번짐·구름 그림자를 줄였습니다'); } } lastNow = now;
    const c = glOn ? wctx : ctx, cam = R.cam, W = canvas.width, H = canvas.height, t = app.frame;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0a0f18'; c.fillRect(0, 0, W, H);
    let ox = 0, oy = 0; if (R.shake > .3) { ox = rnd(-R.shake, R.shake); oy = rnd(-R.shake, R.shake); R.shake *= .86; } else R.shake = 0; // 폭발 흔들림(화면만)
    c.setTransform(cam.z, 0, 0, cam.z, -cam.x * cam.z + ox, -cam.y * cam.z + oy);
    c.imageSmoothingEnabled = true;
    const vw = W / cam.z, vh = H / cam.z, sx = Math.max(0, cam.x), sy = Math.max(0, cam.y), sw = Math.min(bake.width - sx, vw), sh = Math.min(bake.height - sy, vh);
    if (sw > 0 && sh > 0) c.drawImage(bake, sx, sy, sw, sh, sx, sy, sw, sh);
    for (const d of R.decals) if (R.onScreen(d.x, d.y)) { const X = d.x * TS, Y = d.y * TS; glowAt(c, X, Y, d.s * 1.25, '#0a0806', .5); // 그을음 + 잔해
      if (d.rub) for (const [dx, dy, w, h, r, col] of d.rub) { c.save(); c.translate(X + dx, Y + dy); c.rotate(r); c.fillStyle = col; c.fillRect(-w / 2, -h / 2, w, h); c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(-w / 2, -h / 2, w, 1); c.restore(); } }

    R.tracks = R.tracks.filter(k => { k.life--; if (!R.onScreen(k.x, k.y)) return k.life > 0; const a = Math.min(1, k.life / 60) * .3; c.save(); c.translate(k.x * TS, k.y * TS); c.rotate(k.a); // 바퀴·궤도 자국
      c.fillStyle = `rgba(0,0,0,${a})`; c.fillRect(-3, -k.w, 6, 2.4); c.fillRect(-3, k.w - 2.4, 6, 2.4); c.restore(); return k.life > 0; });
    if (R.tracks.length > 500) R.tracks.splice(0, R.tracks.length - 500);
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
      c.fillStyle = d.air ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.32)'; c.beginPath(); c.ellipse(x + 3 + lift * .6, y + 4 + lift * .4, d.r * TS * (d.air ? .8 : 1), d.r * TS * .72, 0, 0, TAU); c.fill();
      if (sel.has(e.id)) { c.strokeStyle = ringCol(e); c.lineWidth = 1.6; c.beginPath(); c.ellipse(x, y - lift * 0, d.r * TS + 4, (d.r * TS + 4) * .78, 0, 0, TAU); c.stroke(); } }
    us.sort((a, b) => (RTS.defOf(a).air ? 1 : 0) - (RTS.defOf(b).air ? 1 : 0) || a.y - b.y);
    for (const e of us) { const d = RTS.defOf(e), [x, y] = pos(e), lift = d.air ? 20 + Math.sin(t * .06 + e.id) * 2 : 0;
      const fn = RTS.art.units[d.art] || RTS.art.units.trooper, hit = e.hitAt && G.tick - e.hitAt < 2;
      if (e.path && !d.air && rich() && (t + e.id) % 9 === 0) { const bio = (d.tags || []).includes('bio');
        if (!bio && d.r >= .55) R.tracks.push({ x: e.x, y: e.y, a: e.facing, w: d.r * TS * .7, life: 150 });
        if ((t + e.id) % 18 === 0) fx({ k: 'dust', x: e.x - Math.cos(e.facing) * d.r * .9, y: e.y - Math.sin(e.facing) * d.r * .9, s: d.r * TS * .8, life: 28 }); }
      if (LON) { light(x, y - lift, d.r * TS * 3, col3((RTS.TEAM[e.team] || NEUTRAL).main), d.air ? .3 : .2); if (d.air) light(x - Math.cos(e.facing) * 12, y - lift - Math.sin(e.facing) * 12, 30, [1, .7, .35], .45); }
      if (depthOn()) { const sp = unitSprite(fn, RTS.TEAM[e.team] || NEUTRAL, stateOf(d, e, t + e.id * 3), e.facing, d.r * TS, hit); c.drawImage(S.unit, 0, 0, sp.px, sp.px, x - sp.L / 2, y - lift - sp.L / 2, sp.L, sp.L); }
      else { c.save(); c.translate(x, y - lift); c.rotate(e.facing); if (hit) c.filter = 'brightness(1.8)'; fn(c, RTS.TEAM[e.team] || NEUTRAL, stateOf(d, e, t + e.id * 3)); c.restore(); }
      if (e.stunned > G.tick) { c.fillStyle = '#ffe27a'; c.fillRect(x - 6 + Math.sin(t * .4) * 5, y - d.r * TS - 8, 3, 3); }
      if (e.buffs.length) { c.strokeStyle = '#ff5a3c'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, d.r * TS + 2, 0, TAU); c.stroke(); } }
    // 투사체
    for (const p of G.projectiles) { if (!R.onScreen(p.x, p.y)) continue; const a = Math.atan2(p.ty - p.y, p.tx - p.x), X = p.x * TS, Y = p.y * TS, P = RTS.TEAM[p.team] || RTS.TEAM[0];
      if (p.art === 'shell') { // 포탄: 포물선으로 날아가는 것처럼 띄우고 바닥에 그림자, 뒤로 연기
        const done = Math.hypot(p.x - p.sx, p.y - p.sy), all = done + Math.hypot(p.tx - p.x, p.ty - p.y), hz = Math.sin(Math.PI * (all ? done / all : 1)) * Math.min(46, all * TS * .2);
        c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(X + 2, Y + 2, 4, 2.6, 0, 0, TAU); c.fill();
        if (rich() && t % 2 === 0) fx({ k: 'trail', x: p.x, y: p.y, z: hz, life: 16 });
        light(X, Y - hz, 60, [1, .6, .25], .8); c.globalCompositeOperation = 'lighter'; glowAt(c, X, Y - hz, 11, '#ff9a3c', .8); c.globalCompositeOperation = 'source-over';
        circ(c, X, Y - hz, 3.4, '#ffd27a'); circ(c, X - .8, Y - hz - .8, 1.6, '#fff'); }
      else { const L = 15, tx = X - Math.cos(a) * L, ty = Y - Math.sin(a) * L, g = c.createLinearGradient(tx, ty, X, Y); // 예광탄: 꼬리가 사라지는 빛줄기
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, P.light); c.strokeStyle = g; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(tx, ty); c.lineTo(X, Y); c.stroke(); c.lineCap = 'butt';
        light(X, Y, 38, col3(P.main), .6); c.globalCompositeOperation = 'lighter'; glowAt(c, X, Y, 7, P.main, .9); c.globalCompositeOperation = 'source-over'; circ(c, X, Y, 1.5, '#fff'); } }
    drawFx(c);
    // 안개
    drawWeather(c, G, W, H);
    const fogOn = me >= 0 && !G.nofog;
    if (fogOn) { if (t % (glOn ? 3 : 6) === 0 || !R.fogReady) { if (glOn) updateFogGL(G, me); else updateFog(G, me); R.fogReady = true; R.fogMode = glOn; } if (R.fogMode !== glOn) R.fogReady = false;
      if (!glOn) { c.imageSmoothingEnabled = true; c.drawImage(fog, 0, 0, G.w * TS, G.h * TS); } }
    const o = glOn ? ctx : c; if (glOn) { o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, W, H); o.setTransform(cam.z, 0, 0, cam.z, -cam.x * cam.z + ox, -cam.y * cam.z + oy); }
    // 체력 바
    for (const e of list) { const d = RTS.defOf(e), max = RTS.stat(G, e, 'hp'); if (!sel.has(e.id) && e.hp >= max) continue;
      const w = d.size ? d.size[0] * TS - 10 : Math.max(22, d.r * TS * 2), x = e.x * TS - w / 2, y = (d.size ? e.y - d.size[1] / 2 : e.y) * TS - (d.size ? 8 + (depthOn() ? heightOf(d) : 0) : d.r * TS + (d.air ? 28 : 8)), k = Math.max(0, e.hp / max);
      o.fillStyle = 'rgba(0,0,0,.65)'; o.fillRect(x - 1, y - 1, w + 2, 5); o.fillStyle = k > .55 ? '#58e08a' : k > .28 ? '#f2c14e' : '#ee5545'; o.fillRect(x, y, w * k, 3); }

    // 건설 미리보기 & 드래그 박스
    const m = app.mode;
    if (m && m.type === 'place' && app.mouse.inside) { const d = RTS.defs.entities[m.def], [tx, ty] = app.placeTile(m.def), ok = RTS.canPlace(G, me, m.def, tx, ty), s = { x: tx + d.size[0] / 2, y: ty + d.size[1] / 2, team: me, def: m.def, built: 1, buildT: 1, facing: 0 };
      o.globalAlpha = .55; drawBuilding(o, G, s, d, alpha); o.globalAlpha = 1; o.fillStyle = ok ? 'rgba(90,255,150,.28)' : 'rgba(255,70,60,.35)'; o.fillRect(tx * TS, ty * TS, d.size[0] * TS, d.size[1] * TS); }
    if (m && m.type === 'target' && m.radius && app.mouse.inside) { o.strokeStyle = '#ffd27a'; o.lineWidth = 2; o.beginPath(); o.arc(app.mouse.wx * TS, app.mouse.wy * TS, m.radius * TS, 0, TAU); o.stroke(); }
    const TM = G.tribe && me >= 0 && G.tribe.missions[me]; // 잿빛 부족 정찰 미션 지점
    if (TM) for (const q of TM) if (q.id === 'scout' && q.done === null) { const X = q.x * TS, Y = q.y * TS; o.strokeStyle = '#9dffb5'; o.lineWidth = 2.5; o.setLineDash([10, 8]); o.lineDashOffset = -t * .6; o.beginPath(); o.arc(X, Y, 5 * TS, 0, TAU); o.stroke(); o.setLineDash([]); o.lineDashOffset = 0;
      o.font = '700 14px "IBM Plex Sans KR",sans-serif'; o.textAlign = 'center'; o.fillStyle = 'rgba(8,12,22,.8)'; o.fillRect(X - 40, Y - 11, 80, 20); o.fillStyle = '#9dffb5'; o.fillText('정찰 지점', X, Y + 4); o.textAlign = 'start'; }
    R.pings = R.pings.filter(p => { p.life--; const k = p.life / p.max; o.strokeStyle = p.c; o.lineWidth = 2; o.globalAlpha = k; o.beginPath(); o.arc(p.x * TS, p.y * TS, (1 - k) * 22 + 4, 0, TAU); o.stroke(); o.globalAlpha = 1; return p.life > 0; });
    o.setTransform(1, 0, 0, 1, 0, 0);
    if (glOn) gfx.render({ src: world, lights: screenLights(cam, ox, oy), amb: amb().amb, tint: amb().tint, cam, shake: [ox, oy], map: [G.w * TS, G.h * TS], fog: fogOn ? fogGL : null, shocks: shocks(cam, ox, oy), time: now / 1000, clouds: app.settings.clouds === false ? 0 : 1 });
    if (app.box) { const b = app.box; o.strokeStyle = '#7dffa8'; o.lineWidth = 1.5; o.fillStyle = 'rgba(125,255,168,.1)'; o.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); o.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
  };
  function selBox(c, e, d) { const r = RTS.rectOf(e); c.strokeStyle = ringCol(e); c.lineWidth = 2; c.strokeRect(r.x0 * TS - 2, r.y0 * TS - 2, r.w * TS + 4, r.h * TS + 4); }
  // 부드러운 빛 원: 색마다 한 번 만든 방사형 그림을 늘려 찍는다(그라디언트를 매번 만들지 않는다).
  const glows = {};
  function glowAt(c, x, y, r, col, a = 1) { let g = glows[col]; if (!g) { g = glows[col] = document.createElement('canvas'); g.width = g.height = 64; const x2 = g.getContext('2d'), gr = x2.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, col); gr.addColorStop(.3, col + 'aa'); gr.addColorStop(.65, col + '33'); gr.addColorStop(1, col + '00'); x2.fillStyle = gr; x2.fillRect(0, 0, 64, 64); }
    const o = c.globalAlpha; c.globalAlpha = o * a; c.drawImage(g, x - r, y - r, r * 2, r * 2); c.globalAlpha = o; }
  function drawFx(c) {
    const add = [], born = [], ease = k => 1 - k * k; // 빛나는 효과는 모아서 'lighter'(가산 혼합)로 한 번에 그린다
    R.fx = R.fx.filter(f => { if (f.delay > 0) { f.delay--; return true; } const k = f.life / f.max, X = f.x * TS, Y = f.y * TS - (f.z || 0); f.life--;
      switch (f.k) {
        case 'muzzle': { const L = f.s * 2.6 * (.5 + k * .5), ca = Math.cos(f.a), sa = Math.sin(f.a); add.push(f);
          c.fillStyle = '#fff6d0'; c.globalAlpha = k; c.beginPath(); c.moveTo(X - sa * f.s * .45, Y + ca * f.s * .45); c.lineTo(X + ca * L, Y + sa * L); c.lineTo(X + sa * f.s * .45, Y - ca * f.s * .45); c.closePath(); c.fill();
          c.beginPath(); c.moveTo(X, Y); c.lineTo(X + Math.cos(f.a + .7) * L * .45, Y + Math.sin(f.a + .7) * L * .45); c.lineTo(X + Math.cos(f.a - .7) * L * .45, Y + Math.sin(f.a - .7) * L * .45); c.closePath(); c.fill(); c.globalAlpha = 1; break; }
        case 'slash': { c.strokeStyle = '#ffffff'; c.globalAlpha = k * .9; c.lineWidth = 1 + 3 * k; c.lineCap = 'round'; const sw = (1 - k) * 2.2; c.beginPath(); c.arc(X, Y, 9, f.a - 1.1 + sw * .2, f.a - 1.1 + sw); c.stroke(); c.lineCap = 'butt'; c.globalAlpha = 1; break; }
        case 'hit': add.push(f); break;
        case 'spark': { f.x += f.vx; f.y += f.vy; f.vx *= .86; f.vy *= .86; c.strokeStyle = f.c; c.globalAlpha = k; c.lineWidth = 1.6; c.beginPath(); c.moveTo(X, Y); c.lineTo(X - f.vx * TS * 2.5, Y - f.vy * TS * 2.5); c.stroke(); c.globalAlpha = 1; break; }
        case 'fireball': { const r = f.s * TS * (.35 + .85 * ease(k) ** .5); add.push(f); f.r = r;
          c.globalAlpha = Math.min(1, k * 1.6); circ(c, X, Y, r, '#c2410c'); circ(c, X - r * .1, Y - r * .1, r * .75, '#ff8a2a'); c.globalAlpha = Math.min(1, k * 1.3) * k; circ(c, X - r * .15, Y - r * .15, r * .45, '#ffe28a'); c.globalAlpha = 1; break; }
        case 'shock': { const r = f.s * TS * (.25 + 1.1 * ease(k)); c.strokeStyle = '#fff3d6'; c.globalAlpha = k * .55; c.lineWidth = 1 + 4 * k; c.beginPath(); c.ellipse(X, Y, r, r * .8, 0, 0, TAU); c.stroke(); c.globalAlpha = 1; break; }
        case 'flashwide': add.push(f); break;
        case 'ember': { f.x += f.vx; f.y += f.vy; f.z += f.vz; f.vz -= .28; if (f.z < 0) { f.z = 0; f.vz = 0; f.vx *= .7; f.vy *= .7; } add.push(f); break; }
        case 'debris': { f.x += f.vx; f.y += f.vy; f.z += f.vz; f.vz -= .3; f.rot += f.vr; if (f.z <= 0) { f.z = 0; f.vz = Math.abs(f.vz) > 1.2 ? -f.vz * .35 : 0; f.vx *= .6; f.vy *= .6; f.vr *= .5; }
          c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(X - 1, f.y * TS + 1, f.sz, f.sz * .6); c.save(); c.translate(X, Y); c.rotate(f.rot); c.globalAlpha = Math.min(1, k * 3); c.fillStyle = f.c; c.fillRect(-f.sz / 2, -f.sz / 2, f.sz, f.sz * .7); c.restore(); break; }
        case 'casing': { f.x += f.vx; f.y += f.vy; f.z = Math.max(0, f.z + f.vz); f.vz -= .4; c.fillStyle = '#e9c46a'; c.globalAlpha = k; c.fillRect(X, Y, 2, 1.2); c.globalAlpha = 1; break; }
        case 'smoke': case 'steam': case 'trail': case 'puff': { const st = f.k === 'steam', tr = f.k === 'trail', pf = f.k === 'puff'; if (f.vx) f.x += f.vx;
          const rise = tr ? (1 - k) * 6 : pf ? 0 : (1 - k) * 26, r = tr ? 2.5 + (1 - k) * 4 : pf ? f.s * (.6 + (1 - k) * .9) : f.s * (1.6 - k);
          c.globalAlpha = (st ? .35 : tr ? .32 : pf ? .5 : .45) * (k < .8 ? k / .8 : 1) * (f.k === 'smoke' ? Math.min(1, (1 - k) * 6) : 1);
          circ(c, X, Y - rise, r, st ? '#f3c0f0' : tr ? '#8a8f99' : pf ? '#b8a88a' : k > .75 ? '#4a4038' : '#2b2b30'); c.globalAlpha = 1; break; }
        case 'fire': { const r = 3 + (1 - k) * 4, rise = (1 - k) * 16; add.push(f); f.rise = rise; c.globalAlpha = k; circ(c, X + Math.sin(f.life) * 1.5, Y - rise, r, k > .5 ? '#ffb347' : '#e05a2a'); c.globalAlpha = 1;
          if (f.life === 2) born.push({ k: 'smoke', x: f.x, y: f.y - .5, z: f.z, s: 6, life: 30, max: 30 }); break; }
        case 'dust': { const r = f.s * (.5 + (1 - k) * 1.1); c.globalAlpha = .22 * k; circ(c, X, Y - (1 - k) * 4, r, '#b8a88a'); c.globalAlpha = 1; break; }
        case 'glint': add.push(f); break;
        case 'chip': { f.x += f.vx; f.y += f.vy; c.fillStyle = f.c; c.fillRect(X, Y, 3, 3); break; }
        case 'beam': { c.strokeStyle = '#8affc4'; c.globalAlpha = k; c.lineWidth = 2; c.beginPath(); c.moveTo(X, Y); c.lineTo(f.x2 * TS, f.y2 * TS); c.stroke(); c.globalAlpha = 1; add.push(f); break; }
        case 'ring': { c.strokeStyle = '#ffd27a'; c.globalAlpha = k; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, (1 - k) * f.s * TS + 8, 0, TAU); c.stroke(); c.globalAlpha = 1; break; }
      }
      return f.life > 0; });
    for (const b of born) R.fx.push(b);
    c.globalCompositeOperation = 'lighter';
    for (const f of add) { const k = (f.life + 1) / f.max, X = f.x * TS, Y = f.y * TS - (f.z || 0);
      if (LON) { if (f.k === 'muzzle') light(X, Y, f.s * 10, [1, .75, .4], 1.2 * k); else if (f.k === 'hit') light(X, Y, 30, [1, .85, .55], .6 * k); else if (f.k === 'fireball') light(X, Y, f.r * 4.5, [1, .55, .2], 1.1 * k);
        else if (f.k === 'flashwide') light(X, Y, f.s * TS * 4, [1, .92, .75], 1.2 * k); else if (f.k === 'fire') light(X, Y - f.rise, 50, [1, .55, .2], .35 * k); else if (f.k === 'beam') light(f.x2 * TS, f.y2 * TS, 34, [.5, 1, .75], .7 * k); else if (f.k === 'ember') light(X, Y, 12, [1, .6, .3], .45 * k); }
      if (f.k === 'muzzle') glowAt(c, X, Y, f.s * 4, '#ffb347', k);
      else if (f.k === 'hit') glowAt(c, X, Y, 9, '#ffd98a', k);
      else if (f.k === 'fireball') glowAt(c, X, Y, f.r * 2.6, '#ff7a1a', k * .9);
      else if (f.k === 'flashwide') glowAt(c, X, Y, f.s * TS * 2.4, '#fff1c8', k * .8);
      else if (f.k === 'ember') { glowAt(c, X, Y, 5, '#ff9a3c', k); c.fillStyle = '#fff1b0'; c.globalAlpha = k; c.fillRect(X - .8, Y - .8, 1.6, 1.6); c.globalAlpha = 1; }
      else if (f.k === 'fire') glowAt(c, X, Y - f.rise, 12, '#ff8a2a', k * .7);
      else if (f.k === 'glint') { const g = Math.sin(k * Math.PI), L = 7 * g; c.globalAlpha = g; c.fillStyle = '#fff6d6'; c.fillRect(X - L, Y - .6, L * 2, 1.2); c.fillRect(X - .6, Y - L, 1.2, L * 2); c.globalAlpha = 1; glowAt(c, X, Y, 6, '#ffd98a', g); if (LON) light(X, Y, 24, [1, .85, .5], .5 * g); }
      else if (f.k === 'beam') { glowAt(c, f.x2 * TS, f.y2 * TS, 10, '#8affc4', k); } }
    c.globalCompositeOperation = 'source-over';
    if (R.fx.length > 700) R.fx.splice(0, R.fx.length - 700);
  }
  // 아이콘: 실제 그림 함수를 작은 캔버스에 그린다. 새 유닛도 자동으로 아이콘이 생긴다.
  const icons = {};
  R.icon = function (defId, team, faction) {
    const k = defId + team + faction; if (icons[k]) return icons[k];
    const d = RTS.defs.entities[defId], cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), P = RTS.TEAM[team] || RTS.TEAM[0], m = matOf(faction);
    if (d.kind === 'unit') { c.translate(32, 32); c.rotate(-.5); const s = 48 / Math.max(44, (d.r * TS * 2) + 16) * (d.r < .5 ? 1.6 : 1); c.scale(s, s); (RTS.art.units[d.art] || RTS.art.units.trooper)(c, P, { t: 0, faction, tint: d.tint, moving: false, m }); }
    else { const w = d.size[0] * TS, h = d.size[1] * TS, s = 60 / Math.max(w, h), Pn = team < 0 ? NEUTRAL : P; c.translate((64 - w * s) / 2, (64 - h * s) / 2); c.scale(s, s); (RTS.art.buildings[d.art] || plate)(c, w, h, Pn, { t: 0, faction, m, facing: -.6 }); }
    return (icons[k] = cv.toDataURL());
  };
  return R;
};
