// buildart.js — 진영 건물 그림(화면 전용). render.js의 기본 그림을 같은 이름으로 덮어쓴다.
// 실루엣(바닥판 모양)은 그대로 두고 지붕 디테일·발광 창문·움직이는 부품을 더한다.
// 상태 s: t(프레임), busy(생산·연구 중), pk(진행 0~1), hp(체력 비율), id, m(재질), facing,
//   s.glow(x, y, 반경, 색, 세기) — 고급 그래픽 빛을 낸다(건물 안 좌표)
//   s.emit('smoke'|'spark'|'steam', x, y) — 연기·불꽃을 뿜는다(건물 안 좌표)
(function () {
  const B = RTS.art.buildings, nop = () => {}, BASE = Object.assign({}, B);
  const G = s => s.glow || nop, EM = s => s.emit || nop;
  // ── 공통 부품 ──
  function rivets(c, pts, col = 'rgba(255,255,255,.35)') { for (const [x, y] of pts) { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(x, y + .6, 1.8, 1.8); c.fillStyle = col; c.fillRect(x, y, 1.6, 1.6); } }
  function seam(c, x0, y0, x1, y1) { c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.moveTo(x0 + .8, y0 + .8); c.lineTo(x1 + .8, y1 + .8); c.stroke(); }
  function grille(c, x, y, w, h, n, m) { shade(c, x, y, w, h, m[3], 1.5); c.fillStyle = 'rgba(0,0,0,.55)'; for (let i = 0; i < n; i++) c.fillRect(x + 2, y + 2 + i * (h - 3) / n, w - 4, (h - 3) / n * .5); }
  // 발광 창: 고급 그래픽에서는 빛도 낸다. on이 거짓이면 꺼진 창
  function win(c, s, x, y, w, h, col, on = true, i = .35) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x - 1, y - 1, w + 2, h + 2); c.fillStyle = on ? col : '#1a2230'; c.fillRect(x, y, w, h);
    if (on) { c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(x, y, w, Math.max(1, h * .25)); G(s)(x + w / 2, y + h / 2, Math.max(w, h) * 2.2, col, i); } }
  function lamp(c, s, x, y, col, period = 40, phase = 0, r = 2) { const on = ((s.t + phase + (s.id || 0) * 7) % period) < period * .5; circ(c, x, y, r + 1, 'rgba(0,0,0,.6)'); circ(c, x, y, r, on ? col : '#2a2f3a');
    if (on) { circ(c, x - r * .3, y - r * .3, r * .4, '#fff'); G(s)(x, y, 16, col, .55); } }
  function dish(c, x, y, r, a, m, p) { c.save(); c.translate(x, y); circ(c, 0, 0, r * .45, m[3]); c.rotate(a); c.fillStyle = m[0]; c.beginPath(); c.ellipse(0, 0, r * .45, r, 0, -Math.PI / 2, Math.PI / 2); c.fill();
    c.fillStyle = m[2]; c.beginPath(); c.ellipse(0, 0, r * .3, r * .85, 0, -Math.PI / 2, Math.PI / 2); c.fill(); c.strokeStyle = m[0]; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, 0); c.lineTo(r * .9, 0); c.stroke(); circ(c, r * .9, 0, 1.6, p.light); c.restore(); }
  function pipe(c, x0, y0, x1, y1, wd, col) { c.lineCap = 'round'; c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = wd + 2; c.beginPath(); c.moveTo(x0, y0 + 1); c.lineTo(x1, y1 + 1); c.stroke();
    c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = Math.max(1, wd * .3); c.beginPath(); c.moveTo(x0, y0 - wd * .25); c.lineTo(x1, y1 - wd * .25); c.stroke(); c.lineCap = 'butt'; }
  function stack(c, s, x, y, r, m, hot) { circ(c, x, y, r + 1.5, m[3]); circ(c, x, y, r, m[1]); circ(c, x, y, r * .62, '#0c0d10'); if (hot) { circ(c, x, y, r * .45, '#ff8a2a'); G(s)(x, y, r * 5, '#ff8a2a', .45); }
    if (hot && (s.t + (s.id || 0)) % 9 === 0) EM(s)('smoke', x, y); }
  function hazard(c, x, y, w, h) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = '#d9a23b'; c.fillRect(x, y, w, h); c.fillStyle = '#1c1c1c'; for (let i = -h; i < w; i += 8) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + 4, y + h); c.lineTo(x + i + 4 + h, y); c.lineTo(x + i + h, y); c.fill(); } c.restore(); }
  function hexStroke(c, x, y, r, col, lw = 1) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); for (let i = 0; i < 6; i++) c.lineTo(x + Math.cos(i * TAU / 6) * r, y + Math.sin(i * TAU / 6) * r); c.closePath(); c.stroke(); }
  function veins(c, s, x, y, r, n, col, seed = 1) { c.strokeStyle = col; c.lineWidth = 1.3; c.lineCap = 'round'; for (let i = 0; i < n; i++) { const a = i * TAU / n + seed, k = 1 + Math.sin(s.t * .06 + i) * .04;
      c.beginPath(); c.moveTo(x + Math.cos(a) * r * .3, y + Math.sin(a) * r * .3); c.quadraticCurveTo(x + Math.cos(a + .35) * r * .65 * k, y + Math.sin(a + .35) * r * .65 * k, x + Math.cos(a + .1) * r * k, y + Math.sin(a + .1) * r * k); c.stroke(); } c.lineCap = 'butt'; }
  function pustule(c, s, x, y, r, col, ph = 0) { const k = .75 + .25 * Math.sin(s.t * .09 + ph); blob(c, x, y + r * .25, r * 1.15, r, 'rgba(40,10,30,.55)'); blob(c, x, y, r, r * .9, col); circ(c, x - r * .3, y - r * .3, r * .3, 'rgba(255,255,255,.55)'); G(s)(x, y, r * 4.5, col, .3 * k); }
  const flag = (c, s, x, y, p) => { c.fillStyle = '#20252e'; c.fillRect(x - 1, y - 14, 2, 16); const f = Math.sin(s.t * .15 + (s.id || 0)) * 2; c.fillStyle = p.main;
    c.beginPath(); c.moveTo(x + 1, y - 14); c.quadraticCurveTo(x + 6, y - 15 + f, x + 12, y - 13 + f * .6); c.lineTo(x + 12, y - 7 + f * .6); c.quadraticCurveTo(x + 6, y - 9 + f, x + 1, y - 8); c.fill(); };

  // ── 개척단: 사각 판금, 리벳, 창문, 안테나 ──
  const plateDetail = (c, w, h) => { seam(c, 10, h / 2, w - 10, h / 2); seam(c, w / 2, 8, w / 2, h - 8); rivets(c, [[8, 8], [w - 10, 8], [8, h - 10], [w - 10, h - 10], [w / 2 - 1, 5], [w / 2 - 1, h - 7], [5, h / 2 - 1], [w - 7, h / 2 - 1]]); };
  B.hq = function (c, w, h, p, s) { plate(c, w, h, s); plateDetail(c, w, h);
    hazard(c, 9, 9, 22, 4); shade(c, 14, 14, w - 28, h - 30, s.m[2], 6); c.strokeStyle = p.main; c.lineWidth = 2; c.beginPath(); c.roundRect(16, 16, w - 32, h - 34, 5); c.stroke(); shade(c, 18, h - 29, w - 36, 11, p.dark, 2); seam(c, 20, 30, w - 20, 30); seam(c, 20, h - 30, w - 20, h - 30);
    for (let i = 0; i < 6; i++) win(c, s, 22 + i * 15, h - 25, 9, 5, p.light, !(i === 2 && s.t % 300 < 90), .3); // 창문 줄
    const cx = w / 2, cy = h / 2 - 6; circ(c, cx, cy, 21, s.m[3]); circ(c, cx, cy, 17, s.m[1]); // 지휘 돔
    c.save(); c.translate(cx, cy); c.rotate(s.t * (s.busy ? .05 : .015)); c.strokeStyle = p.main; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); c.beginPath(); c.arc(0, 0, 19, 0, .8); c.stroke(); } c.restore();
    circ(c, cx, cy, 13, p.dark); circ(c, cx, cy, 10, p.main); circ(c, cx, cy, 5 + Math.sin(s.t * .08), p.light); circ(c, cx - 3, cy - 3, 2.5, '#fff'); G(s)(cx, cy, 46, p.main, s.busy ? .5 : .32);
    dish(c, 24, 24, 11, s.t * .03, s.m, p); // 레이더
    c.fillStyle = s.m[3]; c.fillRect(w - 26, 14, 3, 20); c.fillRect(w - 30, 18, 11, 2); lamp(c, s, w - 24.5, 13, '#ff4a3a', 50); // 안테나
    grille(c, w - 30, 40, 16, 20, 4, s.m); rivets(c, [[18, 18], [w - 20, h - 20]]); };
  B.depot = function (c, w, h, p, s) { plate(c, w, h, s); rivets(c, [[7, 7], [w - 9, 7], [7, h - 9], [w - 9, h - 9]]);
    for (const [x, y] of [[9, 9], [33, 9], [9, 33], [33, 33]]) { shade(c, x, y, 21, 20, s.m[2], 2); c.fillStyle = s.m[1]; c.fillRect(x + 2, y + 2, 17, 2); c.fillStyle = 'rgba(0,0,0,.3)'; for (let i = 0; i < 4; i++) c.fillRect(x + 3 + i * 4.5, y + 5, 1.5, 13); c.fillStyle = p.main; c.fillRect(x + 3, y + 9, 15, 3); }
    circ(c, w / 2, h / 2, 5, s.m[3]); lamp(c, s, w / 2, h / 2, '#7dffa8', 70, 0, 2.4); };
  B.extractor = function (c, w, h, p, s) { plate(c, w, h, s); const x = w / 2, y = h / 2; pipe(c, 6, y, 18, y, 5, s.m[1]); pipe(c, w - 6, y, w - 18, y, 5, s.m[1]); pipe(c, x, 6, x, 16, 4, s.m[1]);
    circ(c, x, y, 21, s.m[3]); circ(c, x, y, 17, s.m[2]); c.save(); c.translate(x, y); c.rotate(-s.t * .06); c.fillStyle = s.m[0]; for (let i = 0; i < 6; i++) { c.rotate(TAU / 6); c.fillRect(11, -2, 6, 4); } c.restore();
    circ(c, x, y, 11, '#3a1438'); const k = Math.sin(s.t * .1); circ(c, x, y, 7 + k * 2, '#f08ae6'); circ(c, x - 2, y - 2, 2.5, '#fff'); G(s)(x, y, 44, '#f08ae6', .55 + k * .1);
    for (const [gx, gy] of [[11, 11], [w - 11, h - 11]]) { circ(c, gx, gy, 4.5, s.m[3]); circ(c, gx, gy, 3.2, '#e8edf5'); c.strokeStyle = '#c0392b'; c.lineWidth = 1; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(s.t * .07 + gx) * 2.6, gy + Math.sin(s.t * .07 + gx) * 2.6); c.stroke(); }
    c.fillStyle = p.main; c.fillRect(4, y - 3, 6, 6); c.fillRect(w - 10, y - 3, 6, 6); if (s.t % 40 === 0) EM(s)('steam', x + 10, y - 12); };
  B.barracks = function (c, w, h, p, s) { plate(c, w, h, s); plateDetail(c, w, h);
    shade(c, 10, 10, w - 20, 36, s.m[2], 3); seam(c, 12, 28, w - 12, 28); for (let i = 0; i < 5; i++) win(c, s, 16 + i * 14.5, 16, 8, 8, p.light, (i + (s.t / 120 | 0)) % 4 !== 0, .25);
    for (let i = 0; i < 5; i++) win(c, s, 16 + i * 14.5, 31, 8, 8, p.main, (i * 3 + (s.t / 90 | 0)) % 5 !== 0, .2);
    hazard(c, w / 2 - 18, h - 40, 36, 4); shade(c, w / 2 - 15, h - 35, 30, 28, '#141a24', 2); // 출입구
    const open = s.busy ? (Math.sin(s.t * .06) * .5 + .5) * 10 : 0; c.fillStyle = '#ffcf7a'; if (open > 1) { c.globalAlpha = .7; c.fillRect(w / 2 - 13, h - 33, 26, open); c.globalAlpha = 1; G(s)(w / 2, h - 22, 30, '#ffcf7a', .5); }
    c.fillStyle = s.m[1]; c.fillRect(w / 2 - 15, h - 35 + open, 30, 26 - open); c.fillStyle = 'rgba(0,0,0,.3)'; for (let i = 0; i < 4; i++) c.fillRect(w / 2 - 14, h - 31 + open + i * 6, 28, 1.5);
    c.fillStyle = p.light; c.fillRect(w / 2 - 15, h - 37, 30, 2); lamp(c, s, w / 2 - 20, h - 33, s.busy ? '#ffb347' : '#3a3f4a', 20); lamp(c, s, w / 2 + 20, h - 33, s.busy ? '#ffb347' : '#3a3f4a', 20, 10);
    for (const x of [14, w - 22]) { c.fillStyle = '#6b6450'; for (let i = 0; i < 3; i++) shade(c, x + (i % 2) * 3, h - 22 + i * 5, 9, 5, '#7a7259', 2); } // 모래주머니
    flag(c, s, 16, 60, p); grille(c, w - 26, 52, 14, 14, 3, s.m); };
  B.lab = function (c, w, h, p, s) { plate(c, w, h, s); rivets(c, [[7, 7], [w - 9, 7], [7, h - 9], [w - 9, h - 9]]);
    circ(c, 28, h / 2, 19, s.m[3]); circ(c, 28, h / 2, 15, '#2a4a66'); const k = s.busy ? .5 + .5 * Math.sin(s.t * .15) : .2; c.globalAlpha = .55 + k * .4; circ(c, 28, h / 2, 13, '#9fd8ff'); c.globalAlpha = 1;
    c.save(); c.translate(28, h / 2); c.rotate(s.t * (s.busy ? .08 : .02)); c.fillStyle = p.dark; c.fillRect(-12, -1.5, 24, 3); circ(c, 11, 0, 2.5, p.light); circ(c, -11, 0, 2.5, p.light); c.restore();
    circ(c, 22, h / 2 - 7, 3, 'rgba(255,255,255,.55)'); G(s)(28, h / 2, 40, '#9fd8ff', .35 + k * .4); if (s.busy && s.t % 14 === 0) EM(s)('spark', 28, h / 2);
    for (let i = 0; i < 3; i++) { shade(c, 50 + i * 12, 12, 9, h - 24, s.m[2], 2); for (let j = 0; j < 4; j++) win(c, s, 52 + i * 12, 16 + j * 9, 5, 4, j % 2 ? p.light : '#9fd8ff', (s.t / 50 + i + j | 0) % 3 !== 0, .18); }
    dish(c, w - 12, 14, 8, -s.t * .02, s.m, p); lamp(c, s, w - 12, h - 11, '#7dffa8', 60); };
  B.factory = function (c, w, h, p, s) { plate(c, w, h, s); plateDetail(c, w, h);
    c.fillStyle = s.m[3]; c.fillRect(8, 14, w - 16, h - 28); shade(c, 18, 22, w - 36, 30, p.dark, 3);
    c.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 9; i++) c.fillRect(20, 24 + i * 3.2, w - 40, 1.2); c.fillStyle = p.main; const by = 22 + (s.t * (s.busy ? .5 : .15) % 28); c.fillRect(18, by, w - 36, 3); // 컨베이어
    if (s.busy) { const fx = 26 + (s.t * .6 % (w - 52)); shade(c, fx, 30, 10, 12, s.m[0], 2); }
    hazard(c, 12, h - 20, w - 24, 5); for (let i = 0; i < 6; i++) win(c, s, 14 + i * 12.5, h - 30, 6, 4, '#ffb347', s.busy || i % 2 === 0, .25);
    stack(c, s, 16, 14, 5, s.m, s.busy); stack(c, s, w - 16, 14, 5, s.m, s.busy); // 굴뚝
    c.fillStyle = s.m[0]; c.fillRect(8, 58, w - 16, 2); c.fillStyle = s.m[3]; const cr = 20 + Math.sin(s.t * .02) * 30 + 30; c.fillRect(cr, 55, 8, 8); c.strokeStyle = '#111'; c.beginPath(); c.moveTo(cr + 4, 63); c.lineTo(cr + 4, 70); c.stroke(); // 천장 기중기
    lamp(c, s, 12, h / 2, '#ffb347', 30); lamp(c, s, w - 12, h / 2, '#ffb347', 30, 15); };
  B.turret = function (c, w, h, p, s) { plate(c, w, h, s); for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + .4; shade(c, w / 2 + Math.cos(a) * 24 - 4, h / 2 + Math.sin(a) * 24 - 3, 8, 6, '#7a7259', 2); }
    circ(c, w / 2, h / 2, 21, s.m[2]); circ(c, w / 2, h / 2, 18, s.m[3]); rivets(c, Array.from({ length: 8 }, (_, i) => [w / 2 + Math.cos(i * TAU / 8) * 19.5 - .8, h / 2 + Math.sin(i * TAU / 8) * 19.5 - .8]));
    c.save(); c.translate(w / 2, h / 2); c.rotate(s.facing); shade(c, -12, -11, 22, 22, p.dark, 5); shade(c, -12, -11, 22, 5, p.main, 3); c.fillStyle = s.m[3]; c.fillRect(6, -6.5, 24, 4.5); c.fillRect(6, 2, 24, 4.5);
    c.fillStyle = '#111'; c.fillRect(28, -6, 3, 3.5); c.fillRect(28, 2.5, 3, 3.5); shade(c, -14, -5, 5, 10, s.m[1], 1); circ(c, 0, 0, 6, p.main); circ(c, -1.5, -1.5, 2, p.light); c.restore();
    lamp(c, s, 8, 8, '#ff4a3a', 36); };

  // ── 철갑회: 육각 장갑, 리벳 고리, 용광로 불빛, 배기 핀 ──
  const rivRing = (c, x, y, r, n) => rivets(c, Array.from({ length: n }, (_, i) => [x + Math.cos(i * TAU / n) * r - .8, y + Math.sin(i * TAU / n) * r - .8]), 'rgba(255,235,200,.35)');
  const exhaust = (c, s, w, h) => { fins(c, w, h, s); for (const x of [14, w - 14]) { const k = .5 + .5 * Math.sin(s.t * .1 + x); c.fillStyle = `rgba(255,140,40,${.35 + k * .4})`; c.fillRect(x - 3, h - 9, 6, 2); G(s)(x, h - 8, 14, '#ff8a2a', .25 + k * .2); } };
  B.i_hq = function (c, w, h, p, s) { hexPad(c, w, h, s); const x = w / 2, y = h / 2;
    for (const [px, py] of [[20, 20], [w - 20, 20], [20, h - 20], [w - 20, h - 20]]) { hex(c, px, py, 9, s.m[2]); hexStroke(c, px, py, 9, 'rgba(0,0,0,.4)'); circ(c, px, py, 3, s.m[3]); }
    pipe(c, 20, 20, x - 30, y - 14, 4, s.m[1]); pipe(c, w - 20, h - 20, x + 30, y + 14, 4, s.m[1]);
    hex(c, x, y, 40, s.m[2]); hexStroke(c, x, y, 36, 'rgba(0,0,0,.35)', 1.5); rivRing(c, x, y, 37.5, 12); hex(c, x, y, 31, p.dark);
    c.save(); c.translate(x, y); c.rotate(s.t * (s.busy ? .03 : .012)); c.fillStyle = s.m[0]; for (let i = 0; i < 3; i++) { c.rotate(TAU / 3); c.fillRect(22, -3.5, 13, 7); c.fillStyle = '#ffb347'; c.fillRect(32, -1.5, 3, 3); c.fillStyle = s.m[0]; } c.restore();
    hex(c, x, y, 21, s.m[3]); const k = Math.sin(s.t * (s.busy ? .14 : .07)); circ(c, x, y, 13 + k, '#ff8a2a'); circ(c, x, y, 10 + k, p.main); circ(c, x, y, 5, p.light); circ(c, x - 2, y - 2, 2, '#fff');
    G(s)(x, y, 50, p.main, .55 + k * .1); G(s)(x, y, 30, '#ff8a2a', .35); exhaust(c, s, w, h); lamp(c, s, x, 6, '#ffb347', 44); };
  B.i_depot = function (c, w, h, p, s) { hexPad(c, w, h, s); const x = w / 2, y = h / 2; hex(c, x, y, 25, s.m[2]); rivRing(c, x, y, 22.5, 6);
    c.strokeStyle = p.main; c.lineWidth = 3; for (const r of [8, 15]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); }
    c.save(); c.translate(x, y); c.rotate(s.t * .04); c.strokeStyle = p.light; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 19, 0, 1.2); c.stroke(); c.beginPath(); c.arc(0, 0, 19, Math.PI, Math.PI + 1.2); c.stroke(); c.restore();
    circ(c, x, y, 5, s.m[3]); lamp(c, s, x, y, p.light, 30, 0, 3); for (const a of [0, 2.1, 4.2]) circ(c, x + Math.cos(a) * 15, y + Math.sin(a) * 15, 2, '#ffb347'); };
  B.i_extractor = function (c, w, h, p, s) { hexPad(c, w, h, s); const x = w / 2, y = h / 2;
    for (const a of [.5, 2.6, 4.7]) { c.save(); c.translate(x, y); c.rotate(a); shade(c, 18, -4, 12, 8, s.m[1], 2); c.fillStyle = s.m[3]; c.fillRect(26, -2, 4, 4); c.restore(); } // 고정 팔
    hex(c, x, y, 24, s.m[3]); hexStroke(c, x, y, 21, s.m[1], 1.5); c.strokeStyle = '#e06bd8'; c.lineWidth = 3; c.beginPath(); for (let a = 0; a < 15; a += .3) { const r = a * 1.25; c.lineTo(x + Math.cos(a + s.t * .05) * r, y + Math.sin(a + s.t * .05) * r); } c.stroke();
    circ(c, x, y, 4, '#ffd6fb'); G(s)(x, y, 42, '#e06bd8', .55); };
  B.i_barracks = function (c, w, h, p, s) { hexPad(c, w, h, s); const x = w / 2; hex(c, x, h / 2 - 4, 32, s.m[2]); rivRing(c, x, h / 2 - 4, 29.5, 10);
    c.fillStyle = p.dark; c.fillRect(x - 21, 28, 42, 28); c.fillStyle = '#2a1a10'; c.fillRect(x - 18, 31, 36, 22); // 용광로
    const k = .6 + .4 * Math.sin(s.t * .1), hot = s.busy ? 1 : .55; c.fillStyle = `rgba(255,${120 + k * 60 | 0},40,${hot})`; c.fillRect(x - 17, 40 + Math.sin(s.t * .1) * 6, 34, 4); c.fillStyle = `rgba(255,90,20,${.3 * hot})`; c.fillRect(x - 18, 31, 36, 22);
    G(s)(x, 42, 40, '#ff8a2a', .45 * hot + .15); if (s.busy && s.t % 7 === 0) EM(s)('spark', x + (Math.random() - .5) * 30, 42);
    c.fillStyle = p.main; for (const a of [-1, 1]) { c.beginPath(); c.moveTo(x + 21 * a, 26); c.lineTo(x + 35 * a, 12); c.lineTo(x + 35 * a, 44); c.fill(); c.fillStyle = s.m[0]; c.fillRect(x + 29 * a - 2, 20, 4, 4); c.fillStyle = p.main; }
    const arm = Math.sin(s.t * (s.busy ? .12 : .02)) * 8; pipe(c, x - 30, 62, x - 10 + arm, 52, 3, s.m[0]); pipe(c, x + 30, 62, x + 10 - arm, 52, 3, s.m[0]); // 단조 팔
    exhaust(c, s, w, h); stack(c, s, 18, 16, 4.5, s.m, s.busy); stack(c, s, w - 18, 16, 4.5, s.m, s.busy); };
  B.i_lab = function (c, w, h, p, s) { hexPad(c, w, h, s); const y = h / 2, k = s.busy ? 1 : .45;
    c.strokeStyle = s.m[1]; c.lineWidth = 6; c.beginPath(); c.moveTo(26, y); c.lineTo(70, y); c.stroke();
    for (const [x, r] of [[26, 17], [48, 13], [70, 17]]) { hex(c, x, y, r, s.m[2]); hexStroke(c, x, y, r - 2.5, 'rgba(0,0,0,.35)'); circ(c, x, y, r * .55, p.dark); circ(c, x, y, r * .4 * (.9 + .1 * Math.sin(s.t * .1 + x)), p.main); circ(c, x - 2, y - 2, 1.8, '#fff'); G(s)(x, y, r * 2.4, p.main, .3 + .2 * k); }
    c.strokeStyle = p.light; c.lineWidth = 2; c.globalAlpha = .6 + .4 * k; c.beginPath(); c.moveTo(26, y); c.lineTo(70, y); c.stroke(); c.globalAlpha = 1;
    for (let i = 0; i < 2; i++) { const q = ((s.t * (.01 + .02 * k) + i * .5) % 1); circ(c, 26 + 44 * q, y, 2.6, '#fff'); G(s)(26 + 44 * q, y, 14, p.light, .5); } // 에너지 맥동
    lamp(c, s, 48, 8, '#ffb347', 50); lamp(c, s, 48, h - 8, '#ffb347', 50, 25); };
  B.i_factory = function (c, w, h, p, s) { hexPad(c, w, h, s); const x = w / 2, y = h / 2;
    c.fillStyle = s.m[3]; c.beginPath(); c.moveTo(14, y); c.lineTo(x, 12); c.lineTo(w - 14, y); c.lineTo(x, h - 12); c.closePath(); c.fill(); c.strokeStyle = s.m[1]; c.lineWidth = 1.5; c.stroke();
    for (const [px, py] of [[x, 18], [x, h - 18], [20, y], [w - 20, y]]) { const k = s.busy ? Math.sin(s.t * .2 + px) * 3 : 0; shade(c, px - 3, py - 3 + (py === y ? 0 : k * Math.sign(y - py)), 6, 6, s.m[0], 1); } // 피스톤
    hex(c, x, y, 23, p.dark); rivRing(c, x, y, 20.5, 8); c.save(); c.translate(x, y); c.rotate(s.t * (s.busy ? .06 : .02)); c.fillStyle = p.main; for (let i = 0; i < 4; i++) { c.rotate(TAU / 4); c.fillRect(3, -3, 16, 6); } c.restore(); circ(c, x, y, 5, p.light);
    for (const [px, py] of [[16, 16], [w - 16, h - 16]]) stack(c, s, px, py, 6, s.m, s.busy);
    for (const [px, py] of [[w - 18, 18], [18, h - 18]]) { const k = .5 + .5 * Math.sin(s.t * .12 + px); circ(c, px, py, 5, '#2a1a10'); circ(c, px, py, 3.5, `rgba(255,140,40,${.5 + .5 * k})`); G(s)(px, py, 18, '#ff8a2a', .3 + .2 * k); } };
  B.i_turret = function (c, w, h, p, s) { hexPad(c, w, h, s); hex(c, w / 2, h / 2, 22, s.m[2]); hexStroke(c, w / 2, h / 2, 18, 'rgba(0,0,0,.4)', 1.5); rivRing(c, w / 2, h / 2, 20, 6);
    c.save(); c.translate(w / 2, h / 2); c.rotate(s.facing); hex(c, 0, 0, 13, p.dark); hexStroke(c, 0, 0, 13, s.m[0]); c.fillStyle = s.m[3]; c.fillRect(4, -3, 28, 6); c.fillStyle = s.m[1]; c.fillRect(12, -4, 4, 8); c.fillRect(24, -4, 3, 8);
    c.fillStyle = '#111'; c.fillRect(30, -2, 3, 4); circ(c, 0, 0, 5.5, p.main); circ(c, -1.5, -1.5, 1.8, p.light); c.restore(); lamp(c, s, 10, h / 2, '#ff4a3a', 40); };

  // ── 포자군락: 핏줄, 맥동, 생물 발광 ──
  const BIO = '#b6ff6a', BIO2 = '#ff7ad0';
  B.s_hq = function (c, w, h, p, s) { fleshPad(c, w, h, s); const x = w / 2, y = h / 2, hb = Math.max(0, Math.sin(s.t * .12)) ** 6, b = 1 + Math.sin(s.t * .08) * .03 + hb * .04; // 심장 박동
    blob(c, x, y, 46 * b, 32 * b, FLESH[2]); veins(c, s, x, y, 44, 9, '#8a3f5c', .2); blob(c, x, y, 38 * b, 25 * b, p.dark);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + .3, px = x + Math.cos(a) * 27, py = y + Math.sin(a) * 15; blob(c, px, py, 8, 6, FLESH[1]); blob(c, px - 1, py - 1, 4, 3, FLESH[0]); if (i % 2 === 0) pustule(c, s, px, py, 2.5, BIO, i); }
    blob(c, x, y, 16 * b, 12 * b, FLESH[3]); circ(c, x, y, 9 + hb * 2, p.main); circ(c, x, y, 4.5 + Math.sin(s.t * .1) + hb * 2, p.light); G(s)(x, y, 50, p.main, .45 + hb * .45);
    for (const [px, py] of [[16, h / 2 + 6], [w - 16, h / 2 - 6]]) pustule(c, s, px, py, 3.2, BIO2, px); };
  B.s_pod = function (c, w, h, p, s) { fleshPad(c, w, h, s); const x = w / 2, y = h / 2, b = 1 + Math.sin(s.t * .12) * .07; blob(c, x, y + 3, 22, 18, FLESH[2]); veins(c, s, x, y, 21, 6, '#8a3f5c', .5);
    blob(c, x, y, 18 * b, 15 * b, p.dark); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; for (let i = -1; i <= 1; i++) { c.beginPath(); c.ellipse(x + i * 6, y, 3, 12 * b, 0, 0, TAU); c.stroke(); }
    blob(c, x - 6, y - 5, 6, 4, p.main); blob(c, x + 7, y + 3, 5, 3.5, p.main); circ(c, x - 7, y - 6, 2, p.light); pustule(c, s, x + 2, y - 8, 2.4, BIO, 1); G(s)(x, y, 32, p.main, .3); };
  B.s_extractor = function (c, w, h, p, s) { fleshPad(c, w, h, s); const x = w / 2, y = h / 2; blob(c, x, y, 22, 20, FLESH[2]);
    c.strokeStyle = FLESH[1]; c.lineWidth = 5; c.lineCap = 'round'; for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + .7 + Math.sin(s.t * .05 + i) * .08; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + .5) * 12, y + Math.sin(a + .5) * 12, x + Math.cos(a) * 20, y + Math.sin(a) * 19); c.stroke(); } c.lineCap = 'butt';
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + .7, q = (s.t * .02 + i * .25) % 1; circ(c, x + Math.cos(a) * 20 * (1 - q), y + Math.sin(a) * 19 * (1 - q), 2, '#ff9ef0'); } // 빨아들이는 액
    circ(c, x, y, 10, p.dark); circ(c, x, y, 6 + Math.sin(s.t * .15), '#e06bd8'); circ(c, x - 2, y - 2, 2, '#fff'); G(s)(x, y, 40, '#e06bd8', .55); };
  B.s_pool = function (c, w, h, p, s) { fleshPad(c, w, h, s); const x = w / 2, y = h / 2; blob(c, x, y, 36, 34, FLESH[2]); veins(c, s, x, y, 35, 10, '#8a3f5c'); blob(c, x, y + 2, 26, 22, FLESH[3]);
    blob(c, x, y + 2, 20, 16, p.dark); const k = s.busy ? .25 : .1; c.fillStyle = `rgba(155,224,90,${.3 + k})`; c.beginPath(); c.ellipse(x, y + 2, 17, 13, 0, 0, TAU); c.fill(); // 양분 웅덩이
    for (let i = 0; i < 5; i++) { const q = ((s.t * (s.busy ? .03 : .012)) + i * .2) % 1, bx = x + Math.sin(i * 2.3) * 10, by = y + 4 + Math.cos(i * 1.7) * 7 - q * 4; c.globalAlpha = 1 - q; circ(c, bx, by, 1.5 + q * 2.5, '#d6ff9e'); c.globalAlpha = 1; } // 거품
    G(s)(x, y + 2, 46, '#9be05a', .35 + k); c.fillStyle = p.main; for (let i = 0; i < 5; i++) { const a = -2.6 + i * .55; c.beginPath(); c.moveTo(x + Math.cos(a) * 30, y + Math.sin(a) * 28); c.lineTo(x + Math.cos(a) * 41, y + Math.sin(a) * 39); c.lineTo(x + Math.cos(a + .18) * 30, y + Math.sin(a + .18) * 28); c.fill(); }
    for (const a of [.7, 1.4, 2.1]) pustule(c, s, x + Math.cos(a) * 30, y + Math.sin(a) * 27, 2.6, BIO, a * 3); };
  B.s_den = function (c, w, h, p, s) { fleshPad(c, w, h, s); const y = h / 2; c.strokeStyle = FLESH[1]; c.lineWidth = 5; c.beginPath(); c.moveTo(26, y); c.lineTo(72, y); c.stroke();
    for (const [x, r] of [[26, 17], [50, 13], [72, 16]]) { blob(c, x, y, r, r * .9, FLESH[2]); veins(c, s, x, y, r, 5, '#8a3f5c', x); blob(c, x, y, r * .7, r * .62, p.dark); const k = 1 + Math.sin(s.t * (s.busy ? .2 : .1) + x) * .12; circ(c, x, y, r * .3 * k, p.main); circ(c, x, y, r * .14 * k, BIO); G(s)(x, y, r * 2.2, BIO, s.busy ? .45 : .22); }
    const q = (s.t * .015) % 1; circ(c, 26 + 46 * q, y, 2.2, BIO2); };
  B.s_nest = function (c, w, h, p, s) { fleshPad(c, w, h, s); const x = w / 2, y = h / 2; c.fillStyle = FLESH[3]; for (let i = 0; i < 9; i++) { const a = i * TAU / 9 + Math.sin(s.t * .03 + i) * .03; c.beginPath(); c.moveTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18); c.lineTo(x + Math.cos(a + .2) * 42, y + Math.sin(a + .2) * 40); c.lineTo(x + Math.cos(a + .45) * 18, y + Math.sin(a + .45) * 18); c.fill(); }
    blob(c, x, y, 30, 28, FLESH[2]); veins(c, s, x, y, 29, 7, '#8a3f5c'); blob(c, x, y, 22, 20, p.dark);
    for (const [dx, dy, ph] of [[-8, -5, 0], [7, -6, 2], [0, 7, 4]]) { const k = .5 + .5 * Math.sin(s.t * (s.busy ? .15 : .06) + ph); blob(c, x + dx, y + dy, 6, 7.5, FLESH[0]); blob(c, x + dx, y + dy - 1, 3.2, 4.2, p.light); c.globalAlpha = .4 + .5 * k; blob(c, x + dx, y + dy, 2.2, 3, BIO); c.globalAlpha = 1; G(s)(x + dx, y + dy, 16, BIO, .25 + .25 * k); } };
  B.s_spine = function (c, w, h, p, s) { fleshPad(c, w, h, s); blob(c, w / 2, h / 2, 21, 20, FLESH[2]); veins(c, s, w / 2, h / 2, 20, 6, '#8a3f5c', 1); c.save(); c.translate(w / 2, h / 2); c.rotate(s.facing); blob(c, 0, 0, 12, 11, p.dark);
    c.strokeStyle = FLESH[1]; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(14, -6, 26, 0); c.stroke(); c.strokeStyle = FLESH[0]; c.lineWidth = 2; c.beginPath(); c.moveTo(2, -1); c.quadraticCurveTo(14, -7, 24, -1); c.stroke(); c.lineCap = 'butt';
    c.fillStyle = '#efe4d2'; c.beginPath(); c.moveTo(24, -4); c.lineTo(34, 0); c.lineTo(24, 4); c.fill(); for (const a of [-1, 1]) { c.beginPath(); c.moveTo(-4, 8 * a); c.lineTo(-12, 15 * a); c.lineTo(0, 10 * a); c.fill(); }
    circ(c, 0, 0, 5, p.main); circ(c, -1, -1, 2, BIO); c.restore(); G(s)(w / 2, h / 2, 22, BIO, .25); };

  // 저사양 모드: render.js의 가벼운 기본 그림을 쓴다
  for (const k of Object.keys(B)) { const rich = B[k], base = BASE[k]; if (rich !== base && base) B[k] = function (c, w, h, p, s) { return (s && s.low ? base : rich)(c, w, h, p, s); }; }
  // ── 피해 표현: 체력에 따라 균열·그을음, 많이 다치면 구멍과 불씨 ──
  RTS.artDamage = function (c, w, h, s) { const hp = s.hp ?? 1; if (hp >= .66) return; let q = ((s.id || 1) * 2654435761) >>> 0; const r = () => (q = (q * 1664525 + 1013904223) >>> 0) / 4294967296;
    const n = hp < .33 ? 7 : 3; for (let i = 0; i < n; i++) { const x0 = 10 + r() * (w - 20), y0 = 10 + r() * (h - 20); c.fillStyle = 'rgba(15,10,8,.4)'; c.beginPath(); c.ellipse(x0, y0, 5 + r() * 9, 4 + r() * 6, r() * 3, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 1.2; let x = x0, y = y0; c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (r() - .5) * 16; y += (r() - .5) * 12; c.lineTo(x, y); } c.stroke(); }
    if (hp < .33) for (let i = 0; i < 2; i++) { const x = 14 + r() * (w - 28), y = 14 + r() * (h - 28), k = .6 + .4 * Math.sin(s.t * .3 + i * 2); c.fillStyle = '#0b0807'; c.beginPath(); c.moveTo(x - 6, y - 3); c.lineTo(x + 2, y - 6); c.lineTo(x + 7, y + 1); c.lineTo(x, y + 6); c.lineTo(x - 5, y + 4); c.closePath(); c.fill();
      c.fillStyle = `rgba(255,${110 + k * 60 | 0},30,${.55 + .4 * k})`; circ(c, x, y, 2.6, c.fillStyle); G(s)(x, y, 20, '#ff7a2a', .22 * k); if (s.t % 13 === i * 6) EM(s)('spark', x, y); } };
  // ── 공사 중: 비계와 기중기 ──
  RTS.artScaffold = function (c, w, h, prog, t, top) { c.save(); c.strokeStyle = 'rgba(214,190,120,.85)'; c.lineWidth = 1.6; const y0 = top;
    for (let x = 3; x <= w - 3; x += 16) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, h - 3); c.stroke(); }
    for (let y = h - 3; y >= y0; y -= 12) { c.beginPath(); c.moveTo(3, y); c.lineTo(w - 3, y); c.stroke(); }
    c.strokeStyle = 'rgba(214,190,120,.45)'; c.lineWidth = 1; for (let x = 3; x < w - 16; x += 16) { c.beginPath(); c.moveTo(x, h - 3); c.lineTo(x + 16, Math.max(y0, h - 15)); c.stroke(); }
    const mx = w - 8, my = 8, a = -2.4 + Math.sin(t * .02) * .9, L = Math.min(w, h) * .8; // 기중기
    c.fillStyle = '#d9a23b'; c.fillRect(mx - 3, my - 3, 6, 6); c.strokeStyle = '#d9a23b'; c.lineWidth = 3; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + Math.cos(a) * L, my + Math.sin(a) * L * .7 + L * .35); c.stroke();
    const hx = mx + Math.cos(a) * L * .85, hy = my + Math.sin(a) * L * .6 + L * .3; c.strokeStyle = '#222'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx, hy + 8 + Math.sin(t * .05) * 3); c.stroke(); c.fillStyle = '#59677b'; c.fillRect(hx - 3, hy + 8 + Math.sin(t * .05) * 3, 6, 4);
    c.restore(); };
})();
