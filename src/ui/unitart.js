// unitart.js — 유닛 그림(자세한 판). render.js의 RTS.art.units를 같은 이름으로 덮어쓴다.
// 그림은 (ctx, 팔레트 p{main,dark,light}, 상태 s) 로 그린다. 원점은 몸 중심, +x가 앞쪽, 단위 px(타일 32px).
// render.js가 그림을 방향·움직임 단계별로 한 번 그려 두고(유닛 그림 저장소) 매 프레임 복사하므로, 선을 많이 써도 매 프레임 부담은 늘지 않는다.
// 변신 형태(★2 합체 유닛)는 원래 그림과 실루엣·색이 확실히 다르게: 금색 장식(FORM_GOLD)과 형태별 색을 쓴다.
(function () {
  const U = RTS.art.units, OUT = 'rgba(6,8,14,.82)', GOLD = '#ffd27a', FORM_GOLD = ['#ffe6a6', '#f2b840', '#a8741c'], GLASS = '#9fe3ff';
  const path = (c, pts) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); };
  const poly = (c, pts, fill, stroke = OUT, lw = 1.2) => { path(c, pts); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } };
  const rr = (c, x, y, w, h, r, fill, stroke = OUT, lw = 1.2) => { c.beginPath(); c.roundRect(x, y, w, h, r); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } };
  const ell = (c, x, y, rx, ry, fill, stroke = OUT, lw = 1.2, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } };
  const dot = (c, x, y, r, fill) => { c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
  const ln = (c, pts, col, lw = 1, cap = 'round') => { c.strokeStyle = col; c.lineWidth = lw; c.lineCap = cap; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); c.lineCap = 'butt'; };
  const glint = (c, x, y, r = 1.4) => dot(c, x, y, r, 'rgba(255,255,255,.75)');
  const grad = (c, x0, y0, x1, y1, a, b) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const lamp = (c, x, y, r, col, s, k = 0) => { const on = (s.t + k) % 16 < 9; dot(c, x, y, r + (on ? .6 : 0), on ? col : 'rgba(40,30,20,.8)'); if (on) dot(c, x, y, r * .45, '#fff'); };
  // 궤도: 링크가 움직일 때 흘러간다
  function tread(c, x, y, w, h, s) { rr(c, x, y, w, h, h / 2.4, '#1a1f2a'); const off = s.moving ? (s.t * .9) % 5 : 0; c.fillStyle = '#3b4456';
    for (let i = x + off; i < x + w - 1.5; i += 5) c.fillRect(i, y + 1, 2, h - 2); ln(c, [x + 2, y + h / 2, x + w - 2, y + h / 2], 'rgba(0,0,0,.35)', 1); }
  function visor(c, x, y, rx, ry) { ell(c, x, y, rx, ry, grad(c, x - rx, y - ry, x + rx, y + ry, '#d7f6ff', '#2e7fa8'), 'rgba(0,0,0,.6)', .8); glint(c, x - rx * .3, y - ry * .35, Math.min(rx, ry) * .35); }
  function cargoBox(c, s) { if (!s.cargo) return; const g = s.cargo === 'gas'; rr(c, -14, -4.5, 7, 9, 2, g ? '#e06bd8' : '#ffc35a'); if (g) dot(c, -10.5, 0, 1.6, '#ffe0fa'); else poly(c, [-12.5, -2, -9, -3, -8.5, 2, -12, 2.5], '#fff0b8', null); }
  function boots(c, w, col, y = 5, r = 3.4) { ell(c, -2 + w, y, r + .8, r, col); ell(c, -2 - w, -y, r + .8, r, col); }
  function legStroke(c, pts, col, lw) { ln(c, pts, OUT, lw + 1.6); ln(c, pts, col, lw); }

  // ── 개척단 ──
  U.worker = function (c, p, s) { const m = matOf(s.faction), sw = Math.sin(s.t * .5) * 2;
    if (s.faction === 'pioneers' || !s.faction) {
      boots(c, s.moving ? Math.sin(s.t * .4) * 2.5 : 0, '#2a3242', 5.5, 3);
      rr(c, -10, -7, 9, 14, 3, m[2]); rr(c, -9, -5.5, 6, 11, 2, '#c8913a', null); ln(c, [-8.5, -3, -4, -3], 'rgba(0,0,0,.35)', 1); ln(c, [-8.5, 3, -4, 3], 'rgba(0,0,0,.35)', 1); // 등짐 + 연료통
      ell(c, 0, 0, 7.5, 8.5, p.dark); ell(c, .5, 0, 5.2, 6.5, p.main, null);
      poly(c, [6, -6.5, 15, -8 + sw * .3, 15.5, -5.5, 7, -3.5], m[1]); poly(c, [13.5, -9.5 + sw * .3, 17.5, -8, 16.5, -4, 13, -5], '#ffb43c'); // 용접기
      ln(c, [6, 4, 13, 6 + sw], OUT, 4.2); ln(c, [6, 4, 13, 6 + sw], m[0], 2.6); dot(c, 13.5, 6.2 + sw, 2.2, '#e9c35a');
      ell(c, 2.2, 0, 4.4, 4.2, '#f2c440'); ln(c, [-1.6, -2.5, 6, -2.5], '#c99010', 1.2); visor(c, 3.6, 0, 1.8, 2.6); // 노란 안전모
      if (s.cargo) cargoBox(c, s); return; }
    U.iworker(c, p, s); };
  U.trooper = function (c, p, s) { const w = Math.sin(s.t * .4) * (s.moving ? 3 : 0), t1 = s.tint === 1, t2 = s.tint === 2; // 소총병 / 척탄병(1) / 의무병(2)
    boots(c, w, '#232a38');
    rr(c, -9.5, -5.5, 6, 11, 2, t2 ? '#c9d2de' : '#3c4a5e'); ln(c, [-8.5, -3, -5, -3], 'rgba(255,255,255,.18)', 1);
    ell(c, 0, 0, 7, 10, t1 ? '#3a6a58' : t2 ? '#d7dde6' : p.dark);
    poly(c, [-3, -8.5, 3, -9.5, 4.5, -5, -2.5, -5], p.main, null); poly(c, [-3, 8.5, 3, 9.5, 4.5, 5, -2.5, 5], p.main, null); // 어깨 보호대
    ell(c, .8, 0, 5.4, 5.4, p.main); ell(c, 1.2, 0, 4.2, 4.6, grad(c, -3, -4, 4, 4, p.light, p.main), null); visor(c, 3.3, 0, 1.7, 3.2);
    if (t2) { rr(c, -2.5, -7, 3, 5.5, .6, '#e7495a', null); rr(c, -4.2, -5.6, 6.4, 2.6, .6, '#e7495a', null); rr(c, 4, 4.5, 7, 3.6, 1.2, '#f2f4f8'); dot(c, 7.5, 6.3, 1, '#e7495a'); }
    else if (t1) { rr(c, 3, 3, 12, 6, 2, '#2b3a33'); rr(c, 13, 3.5, 4, 5, 1.2, '#1a2026'); dot(c, 16.5, 6, 1.6, '#0c0f14'); ln(c, [5, 4.5, 12, 4.5], 'rgba(255,255,255,.2)', 1); }
    else { rr(c, 3, 3.2, 14, 2.8, .8, '#1c2230'); rr(c, 6, 2.6, 4, 4.4, .8, '#2c3546', null); ln(c, [12, 3.2, 17, 3.2], 'rgba(255,255,255,.25)', .7); } };
  U.tank = function (c, p, s) { // 포격전차: 궤도 두 줄, 각진 차체, 포탑. 포격 모드면 지지대와 긴 포신
    tread(c, -21, -16, 42, 8, s); tread(c, -21, 8, 42, 8, s);
    if (s.sieged) for (const [a, b] of [[-15, -21], [15, -21], [-15, 21], [15, 21]]) { legStroke(c, [a * .6, b * .45, a, b], STEEL[2], 3.4); rr(c, a - 3, b - 2, 6, 4, 1.5, STEEL[3]); }
    poly(c, [-19, -10, 14, -11, 20, -6, 20, 6, 14, 11, -19, 10], STEEL[1]); poly(c, [-15, -7.5, 10, -8, 14, -4, 14, 4, 10, 8, -15, 7.5], p.dark, null);
    ln(c, [-17, -9, 12, -9.5], 'rgba(255,255,255,.22)', 1); for (const x of [-12, -4, 4]) { dot(c, x, -9, .8, STEEL[0]); dot(c, x, 9, .8, STEEL[0]); }
    rr(c, -18, -4, 5, 8, 1.5, '#2a3242'); lamp(c, 18, -7, 1.1, '#ffe08a', s); lamp(c, 18, 7, 1.1, '#ffe08a', s, 4);
    const L = s.sieged ? 30 : 21; rr(c, 4, -2.6, L, 5.2, 1.2, STEEL[3]); rr(c, 4 + L - 4, -3.4, 5, 6.8, 1.2, STEEL[2]); ln(c, [6, -1.4, 4 + L - 5, -1.4], 'rgba(255,255,255,.25)', .8);
    ell(c, -1, 0, 9, 8.5, p.main); ell(c, -1.5, -.5, 6.5, 6, grad(c, -7, -6, 5, 6, p.light, p.main), null); rr(c, -4, -2.5, 6, 5, 1.2, '#1d2533'); dot(c, -1, 0, 1.4, GLASS); };
  U.flyer = function (c, p, s) { const f = s.tint === 1, flick = s.t % 4 < 2 ? 1 : 0, M = f ? MECH : STEEL; // 강습기 / 말벌기(1)
    if (f) { for (const b of [-1, 1]) { ell(c, -4, 11 * b, 9, 3.2, 'rgba(200,230,255,.28)', 'rgba(200,230,255,.5)', .8, b * (.35 + Math.sin(s.t * 1.3) * .25)); }
      poly(c, [18, 0, 6, -6, -14, -4, -18, 0, -14, 4, 6, 6], M[1]); poly(c, [-10, -3, -22, -2, -24, 0, -22, 2, -10, 3], '#e0a33c'); for (let i = 0; i < 3; i++) ln(c, [-12 - i * 4, -2.6, -12 - i * 4, 2.6], '#2a2014', 1.4);
      poly(c, [12, 0, 4, -4, -6, -2.5, -6, 2.5, 4, 4], p.dark, null); ell(c, 9, 0, 3.4, 2.6, GLASS, 'rgba(0,0,0,.5)', .8); ln(c, [17, -1.5, 23, -3], OUT, 1.6); ln(c, [17, 1.5, 23, 3], OUT, 1.6); return; }
    poly(c, [21, 0, 4, -6, -12, -20, -9, -6, -15, 0, -9, 6, -12, 20, 4, 6], M[1]); poly(c, [-2, -12, -10, -18, -7, -9], p.main, null); poly(c, [-2, 12, -10, 18, -7, 9], p.main, null);
    poly(c, [14, 0, 2, -5, -8, -3.5, -8, 3.5, 2, 5], p.dark, null); ln(c, [16, 0, -10, 0], 'rgba(255,255,255,.2)', 1);
    ell(c, 7, 0, 4.4, 2.8, grad(c, 3, -3, 11, 3, '#e8fbff', '#2c7fa6'), 'rgba(0,0,0,.6)', .8);
    for (const b of [-1, 1]) { rr(c, -2, 9 * b - 1.5, 10, 3, 1, '#1d2533'); dot(c, -13, 7.5 * b, 3 + flick, 'rgba(255,170,60,.55)'); dot(c, -13, 7.5 * b, 1.8 + flick * .6, GOLD); } };

  // ── 철갑회 ──
  U.bot = function (c, p, s) { const k = s.moving ? Math.sin(s.t * .6) * 3 : 0, t1 = s.tint === 1, t2 = s.tint === 2; // 칼날봇 / 사수봇(1) / 정비봇(2)
    for (const [a, b] of [[-1, 1], [1, -1]]) legStroke(c, [-3 * a, 6 * b, -7 * a + k * b, 11 * b, -9 * a + k * b, 13 * b], MECH[2], 3);
    const hex = []; for (let i = 0; i < 6; i++) hex.push(Math.cos(i * TAU / 6) * 10.5, Math.sin(i * TAU / 6) * 9.5); poly(c, hex, MECH[1], OUT, 1.4);
    const in2 = []; for (let i = 0; i < 6; i++) in2.push(Math.cos(i * TAU / 6) * 7.5, Math.sin(i * TAU / 6) * 6.8); poly(c, in2, MECH[2], null);
    for (let i = 0; i < 6; i++) dot(c, Math.cos(i * TAU / 6 + .5) * 8.6, Math.sin(i * TAU / 6 + .5) * 7.8, .8, MECH[0]);
    ell(c, 0, 0, 5.8, 5.8, p.dark); ell(c, 2.6, 0, 3.4, 3.4, p.main, null); dot(c, 3.4, 0, 1.6, '#ffe7b0'); glint(c, 1.6, -1.2, .9);
    if (t2) { rr(c, -4.5, -1.6, 9, 3.2, .8, '#7fe0b0', null); rr(c, -1.6, -4.5, 3.2, 9, .8, '#7fe0b0', null); ln(c, [6, -6, 13, -9, 15, -6], MECH[0], 2); ln(c, [6, 6, 13, 9, 15, 6], MECH[0], 2); dot(c, 15, -6, 1.4, '#7fe0b0'); }
    else if (t1) { for (const b of [-1, 1]) { rr(c, 5, 4.5 * b - 1.6, 13, 3.2, .8, '#20242c'); rr(c, 15, 4.5 * b - 2, 3.5, 4, .8, '#3a3f4a', null); } }
    else for (const b of [-1, 1]) { poly(c, [4, 8 * b, 18, 3.5 * b, 19, 1.5 * b, 6, 3 * b], '#d6dde5'); ln(c, [6, 4.5 * b, 17, 2.6 * b], 'rgba(255,255,255,.7)', .7); } };
  U.walker = function (c, p, s) { const k = s.moving ? Math.sin(s.t * .3) * 5 : 0; // 중장봇: 두 다리 보행, 쌍포
    rr(c, -11 + k, -24, 19, 10, 2.5, MECH[3]); rr(c, -11 - k, 14, 19, 10, 2.5, MECH[3]); for (const [x, y] of [[-8 + k, -19], [-8 - k, 19]]) ln(c, [x, y, x + 13, y], 'rgba(255,255,255,.15)', 1);
    poly(c, [-17, -15, 12, -17, 20, 0, 12, 17, -17, 15], MECH[1], OUT, 1.4); poly(c, [-13, -12, 9, -13.5, 15, 0, 9, 13.5, -13, 12], MECH[2], null);
    poly(c, [-11, -9, 8, -10, 14, 0, 8, 10, -11, 9], p.dark, null); for (const y of [-11, 11]) for (const x of [-12, -4, 4]) dot(c, x, y, .9, MECH[0]);
    for (const b of [-1, 1]) { rr(c, 9, 11 * b - 3, 21, 6, 1.4, '#20242c'); rr(c, 26, 11 * b - 3.6, 5, 7.2, 1.2, '#3a3f4a'); ln(c, [11, 11 * b - 1.4, 25, 11 * b - 1.4], 'rgba(255,255,255,.22)', .8); }
    ell(c, 1, 0, 6.5, 6.5, p.main); ell(c, 1.5, -.5, 4.6, 4.6, grad(c, -3, -4, 5, 4, p.light, p.main), null); dot(c, 4, 0, 1.8, '#ffe7b0');
    for (const b of [-1, 1]) lamp(c, -15, 9 * b, 1.2, '#ff9a3c', s, b > 0 ? 5 : 0); };
  U.iworker = function (c, p, s) { const k = s.moving ? Math.sin(s.t * .6) * 2 : 0, m = MECH; // 수집봇: 네 다리, 집게 팔, 수집통
    for (const a of [-1, 1]) for (const x of [-5, 1]) legStroke(c, [x, 5 * a, x - 2 + k * a, 10 * a, x - 3 + k * a, 12 * a], m[2], 2.2);
    ell(c, 0, 0, 8.8, 8.8, m[1], OUT, 1.4); ell(c, 0, 0, 6.6, 6.6, m[2], null); ell(c, 0, 0, 5.2, 5.2, p.dark, null); ell(c, 2, 0, 3, 3, p.main, null); dot(c, 2.8, 0, 1.3, '#ffe7b0');
    for (let i = 0; i < 8; i++) dot(c, Math.cos(i * TAU / 8) * 7.6, Math.sin(i * TAU / 8) * 7.6, .7, m[0]);
    for (const a of [-1, 1]) { ln(c, [6, 4 * a, 12, 7 * a, 14.5, 2 * a], OUT, 4); ln(c, [6, 4 * a, 12, 7 * a, 14.5, 2 * a], m[0], 2.2); dot(c, 14.5, 2 * a, 1.4, '#ffb43c'); }
    rr(c, -13, -4.5, 6, 9, 2, m[2]); if (s.cargo) cargoBox(c, s); };

  // ── 중립: 상단 수레·부족 ──
  U.caravan = function (c, p, s) { const tr = s.faction === undefined ? 0 : 0, roll = s.moving ? (s.t * .5) % TAU : 0; // 수레: 바퀴, 짐칸, 덮개, 마부석
    for (const [x, y] of [[-10, -12], [7, -12], [-10, 12], [7, 12]]) { ell(c, x, y, 4.5, 2.6, '#2a2018'); ln(c, [x - 3.4 * Math.cos(roll), y, x + 3.4 * Math.cos(roll), y], '#8a6a40', 1.2); }
    rr(c, -16, -10, 30, 20, 3, '#6d4f2c', OUT, 1.4); for (const x of [-11, -5, 1, 7]) ln(c, [x, -9, x, 9], 'rgba(0,0,0,.28)', 1);
    rr(c, -13, -8.5, 18, 17, 4, grad(c, -13, -8, 5, 8, '#f0d9a0', '#b89155')); for (const x of [-9, -4, 1]) ln(c, [x, -8, x, 8], 'rgba(120,80,30,.45)', 1.2);
    rr(c, 7, -7, 10, 14, 2, p.main); dot(c, 12, 0, 2.2, p.light); poly(c, [-3, -3, 1, -5, 2, 0, 0, 4, -4, 3], '#ffc35a', 'rgba(0,0,0,.4)', .7); void tr; };
  U.tribal = function (c, p, s) { const w = Math.sin(s.t * .4) * (s.moving ? 3 : 0), bow = s.tint === 1; // 잿빛 부족: 가죽 망토, 깃털, 도끼 / 활
    boots(c, w, '#4a3a2a', 5, 3.1);
    poly(c, [-9, -8, 2, -9, 4, 0, 2, 9, -9, 8, -11, 0], '#6b5236'); for (const y of [-5, 0, 5]) ln(c, [-9, y, -3, y + 1], 'rgba(0,0,0,.25)', 1);
    ell(c, 0, 0, 5.4, 8, p.dark); poly(c, [-2, -7, 2, -8, 2.5, 8, -2, 7], p.main, null);
    ell(c, 1.2, 0, 4.4, 4.4, '#c9a27a'); ln(c, [-1, -3, 4, -3], '#7a5a34', 1.4); poly(c, [-3, -2, -9, -6, -8, -3], '#e8e2d0', OUT, .7); dot(c, 3.6, -1.4, .7, '#2a1a10'); dot(c, 3.6, 1.4, .7, '#2a1a10');
    if (bow) { c.strokeStyle = OUT; c.lineWidth = 3.4; c.beginPath(); c.arc(4, 0, 9, -1.15, 1.15); c.stroke(); c.strokeStyle = '#9a7442'; c.lineWidth = 2; c.stroke();
      ln(c, [4 + Math.cos(-1.15) * 9, Math.sin(-1.15) * 9, 4 + Math.cos(1.15) * 9, Math.sin(1.15) * 9], '#e8e2d0', .8); ln(c, [2, 0, 15, 0], '#7a5a34', 1); poly(c, [15, 0, 12.5, -1.4, 12.5, 1.4], '#c8ced8', null); }
    else { ln(c, [3, 4, 14, 6], OUT, 4); ln(c, [3, 4, 14, 6], '#7a5a34', 2.4); poly(c, [12, 1, 18.5, 2.5, 17.5, 11, 12, 9], grad(c, 12, 1, 18, 11, '#eef1f6', '#8a93a3')); ln(c, [17.6, 3, 16.8, 10], 'rgba(255,255,255,.8)', .8); } };

  // ── 포자군락 ──
  const veins = (c, x, y, rx, ry, col) => { c.strokeStyle = col; c.lineWidth = .8; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x - rx * .7, y + i * ry * .35); c.quadraticCurveTo(x, y + i * ry * .6, x + rx * .6, y + i * ry * .3); c.stroke(); } };
  U.sworker = function (c, p, s) { legs(c, 3, 9, 5, s.t, s.moving, FLESH[3], 1.8);
    ell(c, -2, 0, 9, 7, FLESH[2]); ell(c, -1, 0, 7, 5.4, p.dark, null); veins(c, -2, 0, 7, 5, 'rgba(255,170,210,.35)');
    ell(c, 3.5, 0, 4.4, 4, FLESH[0]); dot(c, 5.6, -1.8, 1.3, p.light); dot(c, 5.6, 1.8, 1.3, p.light); glint(c, 2.5, -1.6, .9);
    for (const b of [-1, 1]) { c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(6, 2.5 * b); c.quadraticCurveTo(11, 4 * b, 12, 1 * b + Math.sin(s.t * .5) * b); c.stroke(); c.strokeStyle = FLESH[0]; c.lineWidth = 1.8; c.stroke(); }
    if (s.cargo) { ell(c, -9, 0, 4, 3.6, s.cargo === 'gas' ? '#e06bd8' : '#ffc35a'); glint(c, -10, -1, 1); } };
  U.claw = function (c, p, s) { legs(c, 3, 9, 5, s.t, s.moving, FLESH[3], 1.6); const k = Math.sin(s.t * .8) * 1.5;
    ell(c, -3, 0, 8, 5.5, FLESH[2]); ell(c, -2, 0, 6, 4, p.dark, null); for (let i = 0; i < 3; i++) ell(c, -6 + i * 3, 0, 1.2, 3.6, p.main, null);
    ell(c, 4, 0, 4, 3.6, FLESH[1]); dot(c, 6, -1.5, 1.1, '#ffe08a'); dot(c, 6, 1.5, 1.1, '#ffe08a');
    for (const b of [-1, 1]) { c.beginPath(); c.moveTo(6, 3 * b); c.quadraticCurveTo(14, (6 + k) * b, 15.5, (1 + k * .3) * b); c.lineTo(9, 1.5 * b); c.closePath(); c.fillStyle = '#e8dccb'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke(); } };
  U.spitter = function (c, p, s) { const w = s.moving ? Math.sin(s.t * .4) * 3 : 0;
    ln(c, [-14, w, -7, -w, -1, 0], OUT, 8); ln(c, [-14, w, -7, -w, -1, 0], FLESH[2], 6); for (let i = 0; i < 3; i++) dot(c, -12 + i * 4, (i % 2 ? -w : w) * .5, 1, FLESH[0]);
    for (const b of [-1, 1]) poly(c, [-2, 5 * b, -7, 12 * b, 2, 7 * b], p.main);
    ell(c, 1, 0, 8, 7.5, FLESH[1]); ell(c, 1, 0, 6, 5.6, p.dark, null); veins(c, 1, 0, 6, 5, 'rgba(160,240,110,.35)');
    ell(c, 7, 0, 4.6, 3.8, FLESH[0]); ell(c, 11, 0, 2.6, 2.2, '#9be05a'); glint(c, 10.4, -.8, .8); dot(c, 7.5, -2, 1.1, p.light); dot(c, 7.5, 2, 1.1, p.light); };
  U.nurse = function (c, p, s) { legs(c, 2, 8, 3, s.t, s.moving, FLESH[3], 1.6); const b = 1 + Math.sin(s.t * .15) * .06;
    ell(c, -1, 0, 10, 9, FLESH[1]); ell(c, -2, 0, 7.5 * b, 7 * b, p.dark, null);
    for (const [x, y, r] of [[-3, -2, 3], [-4, 2.5, 2.4], [0, 1, 2]]) { ell(c, x, y, r, r, '#ffb7d0', 'rgba(120,30,60,.5)', .6); glint(c, x - r * .35, y - r * .35, r * .3); }
    ell(c, 7, 0, 3.6, 3.2, FLESH[0]); dot(c, 8.5, 0, 1.3, p.light); };
  U.brute = function (c, p, s) { const k = s.moving ? Math.sin(s.t * .3) * 4 : 0;
    for (const [x, b] of [[-12, -1], [-12, 1], [2, -1], [2, 1]]) rr(c, x + (b > 0 ? k : -k), b > 0 ? 13 : -21, 9, 8, 2.5, FLESH[3]);
    ell(c, -2, 0, 20, 16, FLESH[2], OUT, 1.6); ell(c, -3, 0, 16, 12.5, p.dark, null); for (let i = 0; i < 4; i++) ell(c, -13 + i * 7, 0, 2.6, 11, FLESH[1], 'rgba(0,0,0,.3)', .8);
    for (let i = 0; i < 3; i++) poly(c, [-14 + i * 8, -9, -11 + i * 8, -17, -8 + i * 8, -9], p.main);
    ell(c, 14, 0, 7, 8, FLESH[1]); dot(c, 17, -3, 1.6, '#ffe08a'); dot(c, 17, 3, 1.6, '#ffe08a');
    for (const b of [-1, 1]) { c.beginPath(); c.moveTo(16, 5 * b); c.quadraticCurveTo(30, 12 * b, 31, 2 * b); c.lineTo(20, 2 * b); c.closePath(); c.fillStyle = '#efe4d2'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke(); } };
  U.drake = function (c, p, s) { const f = Math.sin(s.t * .5) * 4;
    for (const b of [-1, 1]) { c.beginPath(); c.moveTo(2, 2 * b); c.quadraticCurveTo(-4, (18 + f) * b, -14, (16 + f) * b); c.quadraticCurveTo(-8, 8 * b, -6, 2 * b); c.closePath(); c.fillStyle = FLESH[1]; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke();
      c.beginPath(); c.moveTo(0, 3 * b); c.quadraticCurveTo(-4, (12 + f * .6) * b, -10, (12 + f * .6) * b); c.lineTo(-5, 3 * b); c.closePath(); c.fillStyle = p.dark; c.fill();
      ln(c, [-1, 3 * b, -9, (13 + f * .7) * b], 'rgba(255,180,220,.35)', .8); }
    ln(c, [-6, 0, -13, 3, -18, -1], OUT, 4.4); ln(c, [-6, 0, -13, 3, -18, -1], FLESH[2], 3);
    ell(c, 1, 0, 8, 4.5, FLESH[2]); ell(c, 2, 0, 5.5, 3, p.main, null); ell(c, 8, 0, 3, 3, FLESH[0]); dot(c, 9.5, 0, 1.3, '#ffe08a'); };

  // ── 합체 유닛 ──
  U.commando = function (c, p, s) { const w = Math.sin(s.t * .4) * (s.moving ? 3 : 0);
    boots(c, w, STEEL[2], 6.5, 3.8);
    rr(c, -15, -8, 9, 16, 2.5, STEEL[1]); rr(c, -13.5, -5.5, 2, 11, .5, GOLD, null); rr(c, -10.5, -5.5, 2, 11, .5, '#ff9a3c', null);
    ell(c, 0, 0, 8.5, 12, p.dark); poly(c, [-4, -11, 4, -12, 6, -6, -3, -6], p.main, null); poly(c, [-4, 11, 4, 12, 6, 6, -3, 6], p.main, null);
    ell(c, 1, 0, 6.2, 6.2, p.main); ell(c, 1.4, -.4, 4.8, 4.8, grad(c, -3, -4, 5, 4, p.light, p.main), null); visor(c, 4, 0, 2, 3.6);
    rr(c, 4, -7.6, 15, 3, .8, '#1c2230'); rr(c, 4, 2.6, 12, 6, 1.6, '#3a6a58'); rr(c, 14, 3.6, 4.4, 4, 1, '#1c2230'); ln(c, [6, -7, 18, -7], 'rgba(255,255,255,.25)', .7); };
  U.titan = function (c, p, s) { const k = s.moving ? Math.sin(s.t * .22) * 6 : 0, j = s.t % 4 < 2 ? 1.2 : 0;
    rr(c, -15 + k, -33, 24, 12, 3, STEEL[3]); rr(c, -15 - k, 21, 24, 12, 3, STEEL[3]); ln(c, [-12 + k, -27, 6 + k, -27], 'rgba(255,255,255,.14)', 1.4); ln(c, [-12 - k, 27, 6 - k, 27], 'rgba(255,255,255,.14)', 1.4);
    rr(c, -9 + k * .5, -24, 12, 9, 2, STEEL[2]); rr(c, -9 - k * .5, 15, 12, 9, 2, STEEL[2]);
    for (const b of [-1, 1]) { dot(c, -23, 10 * b, 4.6 + j, 'rgba(255,170,60,.45)'); dot(c, -23, 10 * b, 3 + j * .6, GOLD); }
    rr(c, -21, -21, 36, 42, 7, STEEL[1], OUT, 1.6); rr(c, -16, -16, 26, 32, 5, p.dark, null); ln(c, [-18, -19, 10, -19], 'rgba(255,255,255,.2)', 1.2);
    for (const [x, y] of [[-18, -12], [-18, 12], [10, -17], [10, 17], [-18, 0]]) dot(c, x, y, 1, STEEL[0]);
    for (const b of [-1, 1]) { rr(c, -8, b > 0 ? 15 : -28, 24, 13, 3, STEEL[2]); rr(c, 14, b > 0 ? 18.5 : -24.5, 20, 6, 1.5, STEEL[3]); rr(c, 30, b > 0 ? 17.5 : -25.5, 5, 8, 1.2, STEEL[0]); dot(c, 3, b * 21.5, 4.2, p.main); dot(c, 3, b * 21.5, 1.8, p.light); }
    ell(c, 0, 0, 10, 10, p.main); ell(c, .5, -.5, 7.5, 7.5, grad(c, -6, -6, 6, 6, p.light, p.main), null); rr(c, 9, -2.5, 9, 5, 1.2, GOLD); visor(c, 3, 0, 3, 5); };
  U.duelist = function (c, p, s) { const k = s.moving ? Math.sin(s.t * .6) * 3 : 0;
    for (const [a, b] of [[-1, 1], [1, -1], [-1, -1], [1, 1]]) legStroke(c, [-3 * a, 7 * b, -9 * a + k * b, 15 * b, -11 * a + k * b, 17 * b], MECH[2], 3.2);
    const hex = []; for (let i = 0; i < 6; i++) hex.push(Math.cos(i * TAU / 6) * 13.5, Math.sin(i * TAU / 6) * 12.5); poly(c, hex, MECH[1], OUT, 1.5);
    const in2 = []; for (let i = 0; i < 6; i++) in2.push(Math.cos(i * TAU / 6) * 10, Math.sin(i * TAU / 6) * 9.2); poly(c, in2, MECH[2], null);
    for (let i = 0; i < 6; i++) dot(c, Math.cos(i * TAU / 6 + .5) * 11.5, Math.sin(i * TAU / 6 + .5) * 10.6, 1, MECH[0]);
    ell(c, 0, 0, 8.5, 8.5, p.dark); ell(c, 3, 0, 4.4, 4.4, p.main, null); dot(c, 4, 0, 2, '#ffe7b0');
    for (const b of [-1, 1]) { poly(c, [5, 11.5 * b, 25, 5 * b, 26, 3 * b, 8, 5 * b], grad(c, 5, 11 * b, 25, 4 * b, '#f3f6fa', '#9aa4b4')); ln(c, [8, 7 * b, 24, 4.2 * b], 'rgba(255,255,255,.8)', .7); }
    rr(c, 6, -2, 17, 4, 1, '#20242c'); ln(c, [8, -1, 22, -1], 'rgba(255,255,255,.25)', .7); };
  U.juggernaut = function (c, p, s) { const k = s.moving ? Math.sin(s.t * .22) * 5 : 0;
    for (const [x, b] of [[-22, -1], [-22, 1], [6, -1], [6, 1]]) { rr(c, x + (b > 0 ? k : -k), b > 0 ? 23 : -35, 17, 12, 3, MECH[3]); ln(c, [x + 3 + (b > 0 ? k : -k), b > 0 ? 29 : -29, x + 14 + (b > 0 ? k : -k), b > 0 ? 29 : -29], 'rgba(255,255,255,.14)', 1.2); }
    poly(c, [-30, -24, 15, -28, 31, 0, 15, 28, -30, 24], MECH[2], OUT, 1.8); poly(c, [-24, -18, 11, -21, 24, 0, 11, 21, -24, 18], MECH[1], null);
    poly(c, [-16, -11, 6, -13, 14, 0, 6, 13, -16, 11], p.dark, null); ln(c, [-27, -22, 13, -26], 'rgba(255,255,255,.18)', 1.4);
    for (const y of [-20, 20]) for (const x of [-22, -12, -2, 8]) dot(c, x, y * (x > 0 ? 1.05 : 1), 1.1, MECH[0]);
    for (const b of [-1, 1]) { rr(c, 12, 15 * b - 4, 26, 8, 1.5, '#20242c'); rr(c, 34, 15 * b - 5, 5, 10, 1.2, MECH[0]); ln(c, [14, 15 * b - 2, 33, 15 * b - 2], 'rgba(255,255,255,.22)', .9); lamp(c, -20, b * 12, 2.4, '#ff9a3c', s, b > 0 ? 3 : 0); }
    ell(c, -3, 0, 8, 8, p.main); ell(c, -2.5, -.5, 5.6, 5.6, grad(c, -7, -5, 3, 5, p.light, p.main), null); dot(c, 0, 0, 2.6, '#ffe7b0'); };
  U.venom = function (c, p, s) { const w = s.moving ? Math.sin(s.t * .5) * 3 : 0;
    legs(c, 3, 12, 7, s.t, s.moving, FLESH[3], 2.2);
    ln(c, [-17, w, -10, -w, -3, 0], OUT, 9); ln(c, [-17, w, -10, -w, -3, 0], FLESH[2], 7);
    ell(c, 0, 0, 11, 9, FLESH[1], OUT, 1.4); ell(c, 0, 0, 8.5, 6.8, p.dark, null); ell(c, -3, 0, 4, 3.4, '#9be05a', 'rgba(20,60,10,.6)', .8); glint(c, -4, -1.2, 1.2);
    for (const b of [-1, 1]) poly(c, [-3, 6 * b, -9, 14 * b, 2, 8 * b], p.main);
    ell(c, 9, 0, 5.4, 4.6, FLESH[0]); ell(c, 13.5, 0, 2.8, 2.4, '#9be05a'); dot(c, 10, -2.4, 1.2, p.light); dot(c, 10, 2.4, 1.2, p.light);
    for (const b of [-1, 1]) { c.beginPath(); c.moveTo(9, 4 * b); c.quadraticCurveTo(18, 9 * b, 19, 2 * b); c.lineTo(12, 2 * b); c.closePath(); c.fillStyle = '#e8dccb'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1; c.stroke(); } };
  U.behemoth = function (c, p, s) { const k = s.moving ? Math.sin(s.t * .25) * 4 : 0, f = Math.sin(s.t * .2) * 3;
    for (const [x, b] of [[-18, -1], [-18, 1], [4, -1], [4, 1]]) rr(c, x + (b > 0 ? k : -k), b > 0 ? 18 : -29, 12, 11, 3, FLESH[3]);
    for (const b of [-1, 1]) { c.beginPath(); c.moveTo(-4, 6 * b); c.quadraticCurveTo(-14, (36 + f) * b, -32, (30 + f) * b); c.quadraticCurveTo(-20, 16 * b, -18, 6 * b); c.closePath(); c.fillStyle = FLESH[1]; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke();
      for (let i = 0; i < 3; i++) ln(c, [-8 - i * 4, 7 * b, -16 - i * 5, (24 + f - i * 3) * b], 'rgba(255,180,220,.3)', .9); }
    ell(c, -3, 0, 25, 20, FLESH[2], OUT, 1.8); ell(c, -4, 0, 20, 15.5, p.dark, null); for (let i = 0; i < 5; i++) ell(c, -18 + i * 7, 0, 2.8, 13, FLESH[1], 'rgba(0,0,0,.3)', .8);
    for (let i = 0; i < 4; i++) poly(c, [-19 + i * 8, -12, -16 + i * 8, -21, -13 + i * 8, -12], p.main);
    ell(c, 18, 0, 9, 10, FLESH[1]); dot(c, 22, -4, 2, '#ffe08a'); dot(c, 22, 4, 2, '#ffe08a');
    for (const b of [-1, 1]) { c.beginPath(); c.moveTo(20, 6 * b); c.quadraticCurveTo(38, 15 * b, 39, 3 * b); c.lineTo(25, 2 * b); c.closePath(); c.fillStyle = '#efe4d2'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke(); } };

  // ── 변신 형태: 실루엣과 색이 원래와 확실히 다르게(금색 장식 + 형태별 색) ──
  const FG = FORM_GOLD;
  U.bike = function (c, p, s) { const spin = s.moving ? (s.t * .8) % TAU : 0; // 강습 바이크(특공대): 앞뒤 바퀴, 긴 차체, 금색 줄, 배기 불꽃
    for (const x of [-11, 11]) { ell(c, x, 0, 6, 4.2, '#141820', OUT, 1.4); ln(c, [x - 4.6 * Math.cos(spin), -3 * Math.sin(spin), x + 4.6 * Math.cos(spin), 3 * Math.sin(spin)], '#59677b', 1.4); dot(c, x, 0, 1.4, FG[1]); }
    poly(c, [-15, -3.5, 13, -5, 18, 0, 13, 5, -15, 3.5], grad(c, -15, -5, 18, 5, '#2b3446', '#0f141e'), OUT, 1.4); poly(c, [-6, -4.5, 12, -5, 16, 0, 12, 5, -6, 4.5], p.main, null);
    ln(c, [-12, -2.6, 14, -3.4], FG[0], 1.4); ln(c, [-12, 2.6, 14, 3.4], FG[0], 1.4); poly(c, [12, -4, 19, -2, 19, 2, 12, 4], FG[1]);
    if (s.moving || s.t % 6 < 3) { poly(c, [-15, -2, -23 - (s.t % 3) * 2, 0, -15, 2], 'rgba(255,170,60,.85)', null); poly(c, [-15, -1, -19, 0, -15, 1], '#fff3c0', null); }
    ell(c, -1, 0, 5, 5.6, p.dark); ell(c, 0, 0, 3.8, 4.2, p.main, null); visor(c, 2.4, 0, 1.6, 2.8); rr(c, 3, -7.6, 10, 2.4, .6, '#1c2230'); rr(c, 3, 5.2, 10, 2.4, .6, '#1c2230'); };
  U.skyship = function (c, p, s) { const j = s.t % 4 < 2 ? 1.5 : 0; // 비행 전함(거대로봇): 날개, 선체, 함교, 엔진 넷, 금색 함수
    for (const b of [-1, 1]) { poly(c, [6, 12 * b, -16, 36 * b, -26, 34 * b, -14, 12 * b], grad(c, 0, 12 * b, -20, 36 * b, '#c8d2e0', '#59677b'), OUT, 1.5); ln(c, [-2, 15 * b, -20, 32 * b], FG[1], 1.6); dot(c, -22, 33 * b, 2, p.main); }
    poly(c, [38, 0, 26, -10, -24, -14, -34, -8, -34, 8, -24, 14, 26, 10], grad(c, 0, -14, 0, 14, '#dfe6ef', '#5d6b80'), OUT, 1.8);
    poly(c, [30, 0, 22, -7, -20, -9, -20, 9, 22, 7], p.dark, null); poly(c, [38, 0, 30, -5, 30, 5], FG[1]); ln(c, [-30, -11, 26, -8], 'rgba(255,255,255,.35)', 1.2);
    for (let i = 0; i < 5; i++) dot(c, -14 + i * 8, 0, 1.6, GLASS);
    rr(c, -6, -6, 14, 12, 3, FG[2]); rr(c, -4, -4, 10, 8, 2, FG[0], null); visor(c, 4, 0, 2.4, 3);
    for (const b of [-1, 1]) for (const y of [6, 11]) { rr(c, -40, y * b - 2.5, 8, 5, 1.5, '#2a3242'); dot(c, -42, y * b, 3.4 + j, 'rgba(120,200,255,.5)'); dot(c, -42, y * b, 2 + j * .5, '#dff6ff'); }
    for (const b of [-1, 1]) { rr(c, 12, 8 * b - 2, 18, 4, 1, '#1c2230'); dot(c, 30, 8 * b, 1.3, FG[1]); } };
  U.fortress = function (c, p, s) { // 포격 요새(쌍날기사): 땅에 박은 세 지지대, 둥근 포대, 아주 긴 포신, 금색 고리
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + Math.PI; legStroke(c, [Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a) * 20, Math.sin(a) * 20], MECH[2], 4.4); rr(c, Math.cos(a) * 20 - 4, Math.sin(a) * 20 - 3, 8, 6, 2, MECH[3]); }
    ell(c, 0, 0, 15, 15, MECH[2], OUT, 1.8); ell(c, 0, 0, 12, 12, '#3b3428', null); c.strokeStyle = FG[1]; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 13.4, 0, TAU); c.stroke();
    for (let i = 0; i < 8; i++) dot(c, Math.cos(i * TAU / 8) * 13.4, Math.sin(i * TAU / 8) * 13.4, 1, FG[0]);
    rr(c, 4, -3.4, 34, 6.8, 1.6, '#1e2228'); rr(c, 34, -4.4, 7, 8.8, 1.6, FG[2]); rr(c, 16, -4.2, 4, 8.4, 1, '#3a3f4a', null); ln(c, [6, -1.8, 33, -1.8], 'rgba(255,255,255,.28)', .9);
    ell(c, 0, 0, 8, 8, p.dark); ell(c, 1, 0, 5.2, 5.2, p.main, null); dot(c, 2, 0, 2.2, '#ffe7b0'); lamp(c, -9, -6, 1.4, '#ff6a4a', s); lamp(c, -9, 6, 1.4, '#ff6a4a', s, 8); };
  U.airship = function (c, p, s) { const pr = (s.t * .9) % TAU; // 강습 비행선(철갑회): 큰 기낭, 아래 곤돌라, 프로펠러 둘, 꼬리 날개
    for (const b of [-1, 1]) poly(c, [-26, 6 * b, -38, 18 * b, -40, 6 * b], MECH[1]);
    ell(c, 0, 0, 34, 16, grad(c, 0, -16, 0, 16, '#e8c98a', '#8a6a3a'), OUT, 1.8); for (let i = -2; i <= 2; i++) ln(c, [i * 10, -15 + Math.abs(i) * 1.5, i * 10, 15 - Math.abs(i) * 1.5], 'rgba(90,60,20,.4)', 1.2);
    ln(c, [-30, -6, 28, -9], 'rgba(255,255,255,.35)', 1.4); poly(c, [34, 0, 26, -6, 26, 6], FG[1]);
    rr(c, -14, -6, 26, 12, 3, MECH[2]); rr(c, -11, -4, 20, 8, 2, p.dark, null); for (let i = 0; i < 4; i++) dot(c, -7 + i * 5, 0, 1.4, '#ffd27a');
    for (const b of [-1, 1]) { rr(c, -4, 16 * b - 3, 10, 6, 2, MECH[3]); c.save(); c.translate(-6, 16 * b); c.rotate(pr * b); ln(c, [-7, 0, 7, 0], 'rgba(220,220,220,.75)', 2.2); ln(c, [0, -7, 0, 7], 'rgba(220,220,220,.45)', 2.2); c.restore(); }
    rr(c, 10, -2, 18, 4, 1, '#20242c'); ell(c, -3, 0, 4.4, 4.4, p.main); dot(c, -2, 0, 1.8, '#ffe7b0'); };
  U.wingvenom = function (c, p, s) { const f = Math.sin(s.t * .9) * 5; // 날개 맹독충: 네 장 막날개(초록 빛), 가는 몸, 독침 꼬리
    for (const b of [-1, 1]) for (const [x, len, k] of [[2, 20, 1], [-5, 15, .7]]) { c.beginPath(); c.moveTo(x, 2 * b); c.quadraticCurveTo(x - 4, (len + f * k) * b, x - 14, (len - 2 + f * k) * b); c.quadraticCurveTo(x - 8, 6 * b, x - 4, 2 * b); c.closePath();
      c.fillStyle = 'rgba(155,224,90,.42)'; c.fill(); c.strokeStyle = '#4c8a2a'; c.lineWidth = 1; c.stroke(); ln(c, [x - 1, 3 * b, x - 10, (len - 3 + f * k) * b], 'rgba(220,255,180,.6)', .7); }
    ln(c, [-6, 0, -14, 2, -20, -1], OUT, 5.4); ln(c, [-6, 0, -14, 2, -20, -1], FLESH[2], 3.6); poly(c, [-20, -1, -26, -3, -24, 1], '#9be05a');
    ell(c, 0, 0, 8, 4.8, FLESH[1], OUT, 1.3); ell(c, 0, 0, 5.6, 3.2, p.dark, null); ell(c, -2, 0, 2.6, 2, '#9be05a', null);
    ell(c, 8, 0, 4, 3.6, FLESH[0]); dot(c, 10.5, -1.6, 1.3, '#d6ff8a'); dot(c, 10.5, 1.6, 1.3, '#d6ff8a'); ln(c, [11, -2, 15, -5], FG[1], 1); ln(c, [11, 2, 15, 5], FG[1], 1); };
  U.shellbeast = function (c, p, s) { const k = s.moving ? Math.sin(s.t * .2) * 3 : 0; // 갑각 거수: 겹겹 육각 갑각판, 금속 광택 회청색, 큰 뿔
    for (const [x, b] of [[-18, -1], [-18, 1], [4, -1], [4, 1]]) rr(c, x + (b > 0 ? k : -k), b > 0 ? 18 : -30, 13, 12, 3, '#2a2f3a');
    ell(c, -3, 0, 27, 22, '#3a4252', OUT, 2); const plate = (x, y, r, col) => { const pts = []; for (let i = 0; i < 6; i++) pts.push(x + Math.cos(i * TAU / 6) * r, y + Math.sin(i * TAU / 6) * r * .9); poly(c, pts, col, 'rgba(10,12,18,.8)', 1.1); };
    for (const [x, y] of [[-18, -9], [-18, 9], [-8, -14], [-8, 0], [-8, 14], [2, -9], [2, 9], [-28, 0]]) plate(x, y, 7, grad(c, x - 6, y - 6, x + 6, y + 6, '#9fb0c8', '#4a566c'));
    for (const [x, y] of [[-18, -9], [-8, 0], [2, 9], [-8, -14]]) ln(c, [x - 3, y - 3, x + 1, y - 4], 'rgba(255,255,255,.55)', 1);
    for (let i = 0; i < 4; i++) poly(c, [-22 + i * 8, -16, -19 + i * 8, -26, -16 + i * 8, -16], FG[1]);
    ell(c, 18, 0, 10, 11, '#4a566c', OUT, 1.6); dot(c, 22, -4, 2, '#ff6a4a'); dot(c, 22, 4, 2, '#ff6a4a'); ell(c, 15, 0, 3, 7, p.main, null);
    for (const b of [-1, 1]) { c.beginPath(); c.moveTo(22, 6 * b); c.quadraticCurveTo(42, 18 * b, 43, 3 * b); c.lineTo(27, 2 * b); c.closePath(); c.fillStyle = FG[0]; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.3; c.stroke(); } };
})();
