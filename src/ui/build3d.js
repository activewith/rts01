// build3d.js — 진영 건물 3/4 시점 그림(화면 전용). 바닥판(칸)은 그대로 두고 건물을 위로 세워 정면 벽·탑·돔이 보이게 그린다.
// 그림 하나 = { H: 바닥판 위로 솟는 최대 높이(px), base(c, w, d, P, s), live(c, w, d, P, s) }
//   base: 움직이지 않는 부분. render.js의 건물 저장소가 (그림, 팀 색, 진영, 피해 단계, 배율)마다 한 번 그려 둔다. 그림자도 이때 함께 만든다.
//   live: 움직이는 작은 부품(회전 레이더, 깜빡이는 등, 맥동, 포탑 머리). 매 프레임 base 위에 직접 그린다. 가볍게 유지한다.
// 좌표: 바닥판 왼쪽 위가 (0,0), 바닥판은 (0,0)~(w,d). z(높이)는 화면에서 위쪽(-y). 빛은 왼쪽 위, 그림자는 오른쪽 아래 바닥으로.
// s: t(프레임), busy(생산·연구 중), hp, facing(포탑), m(재질), glow(x,y,반경,색,세기), emit('smoke'|'steam'|'spark', x, y)
(function () {
  const TAU = Math.PI * 2, KY = .58, SX = .8, SY = .42; // 납작한 원 비율, 그림자 방향(높이 1당)
  let SH = null, LIVE = false; // base를 그리는 동안 그림자 캔버스(검정으로 채움). live에서는 null
  const nop = () => {}, GL = s => s.glow || nop, EM = s => s.emit || nop;
  const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const MIX = {}; function mix(a, b, t) { const k = a + b + t; if (MIX[k]) return MIX[k]; const A = hex2(a), B = hex2(b); return (MIX[k] = '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')); }
  const lit = (col, k) => (k > 0 ? mix(col, '#ffffff', k) : mix(col, '#000000', -k));
  // ── 그림자(바닥에 떨어지는 모양) ──
  function shPoly(pts) { if (!SH) return; SH.beginPath(); pts.forEach((p, i) => (i ? SH.lineTo(p[0], p[1]) : SH.moveTo(p[0], p[1]))); SH.closePath(); SH.fill(); }
  function shRect(x, y, w, d, z) { const dx = z * SX, dy = z * SY; shPoly([[x, y], [x + w, y], [x + w + dx, y + dy], [x + w + dx, y + d + dy], [x + dx, y + d + dy], [x, y + d]]); }
  function shCirc(x, y, rx, ry, z) { if (!SH) return; const n = Math.max(1, Math.ceil(z / 3)); for (let i = 0; i <= n; i++) { const k = i / n; SH.beginPath(); SH.ellipse(x + z * SX * k, y + z * SY * k, rx, ry, 0, 0, TAU); SH.fill(); } }
  // ── 기본 도형 ──
  function box(c, x, y, w, d, z0, h, col, o) { o = o || {}; shRect(x, y, w, d, z0 + h); const top = y - z0 - h, fy = y + d - z0 - h;
    let g = c.createLinearGradient(0, fy, 0, fy + h); g.addColorStop(0, lit(col, -.12)); g.addColorStop(1, lit(col, -.45)); c.fillStyle = g; c.fillRect(x, fy, w, h); // 남쪽 벽
    g = c.createLinearGradient(x, top, x + w, top + d); g.addColorStop(0, lit(col, .2)); g.addColorStop(1, lit(col, -.06)); c.fillStyle = o.top || g; c.fillRect(x, top, w, d); // 윗면
    c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.32)'; c.beginPath(); c.moveTo(x + .5, fy); c.lineTo(x + .5, top + .5); c.lineTo(x + w, top + .5); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.moveTo(x, fy + .5); c.lineTo(x + w, fy + .5); c.stroke(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeRect(x, top, w, d + h);
    return { x, top, fy, w, d, h, bot: fy + h }; }
  function cyl(c, x, y, r, z0, h, col) { shCirc(x, y, r, r * KY, z0 + h); const yb = y - z0, yt = yb - h;
    let g = c.createLinearGradient(x - r, 0, x + r, 0); g.addColorStop(0, lit(col, .05)); g.addColorStop(.32, lit(col, .25)); g.addColorStop(1, lit(col, -.55)); c.fillStyle = g;
    c.beginPath(); c.moveTo(x - r, yt); c.lineTo(x - r, yb); c.ellipse(x, yb, r, r * KY, 0, Math.PI, 0, true); c.lineTo(x + r, yt); c.closePath(); c.fill();
    g = c.createLinearGradient(x - r, yt - r * KY, x + r, yt + r * KY); g.addColorStop(0, lit(col, .3)); g.addColorStop(1, lit(col, -.1)); c.fillStyle = g; c.beginPath(); c.ellipse(x, yt, r, r * KY, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 1; c.stroke(); c.beginPath(); c.moveTo(x - r, yt); c.lineTo(x - r, yb); c.ellipse(x, yb, r, r * KY, 0, Math.PI, 0, true); c.lineTo(x + r, yt); c.stroke(); return yt; }
  // 움직이는 부품으로 그리는 돔(live)은 (반지름, 색, 유리)마다 한 번 그린 그림을 찍는다
  const DMC = {}; function dome(c, x, y, r, z0, col, glass) { if (LIVE) { const rq = Math.round(r * 2) / 2, key = rq + col + (glass ? 1 : 0); let cv = DMC[key];
      if (!cv) { const sc = 2, pw = Math.ceil(rq * 2 + 4) * sc, ph = Math.ceil(rq * 1.6 + 4) * sc; cv = DMC[key] = document.createElement('canvas'); cv.width = pw; cv.height = ph; const u = cv.getContext('2d'); u.setTransform(sc, 0, 0, sc, (rq + 2) * sc, (rq * .95 + 2) * sc); domeDraw(u, 0, 0, rq, col, glass); cv.ox = rq + 2; cv.oy = rq * .95 + 2; cv.sc = sc; }
      c.drawImage(cv, x - cv.ox, y - z0 - cv.oy, cv.width / cv.sc, cv.height / cv.sc); return; }
    shCirc(x, y, r, r * KY, z0 + r * .9); domeDraw(c, x, y - z0, r, col, glass); }
  function domeDraw(c, x, yb, r, col, glass) { const g = c.createRadialGradient(x - r * .35, yb - r * .55, r * .08, x, yb - r * .2, r * 1.15);
    g.addColorStop(0, glass ? '#ffffff' : lit(col, .45)); g.addColorStop(.38, col); g.addColorStop(1, lit(col, -.6)); c.fillStyle = g;
    c.beginPath(); c.ellipse(x, yb, r, r * KY, 0, 0, Math.PI); c.ellipse(x, yb, r, r * .92, 0, Math.PI, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1; c.stroke(); }
  const hexPts = (x, y, r) => Array.from({ length: 6 }, (_, i) => [x + Math.cos(i * TAU / 6) * r, y + Math.sin(i * TAU / 6) * r * KY]);
  function hexPrism(c, x, y, r, z0, h, col) { shCirc(x, y, r, r * KY, z0 + h); const yb = y - z0, P = hexPts(x, yb, r), T = hexPts(x, yb - h, r);
    [[0, -.55], [1, -.3], [2, -.16]].forEach(([i, k]) => { const a = P[i], b = P[i + 1]; c.fillStyle = lit(col, k); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(b[0], b[1] - h); c.lineTo(a[0], a[1] - h); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1; c.stroke(); });
    const g = c.createLinearGradient(x - r, yb - h - r * KY, x + r, yb - h + r * KY); g.addColorStop(0, lit(col, .25)); g.addColorStop(1, lit(col, -.08)); c.fillStyle = g;
    c.beginPath(); T.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.moveTo(T[3][0], T[3][1]); c.lineTo(T[4][0], T[4][1]); c.lineTo(T[5][0], T[5][1]); c.stroke(); return yb - h; }
  function blob(c, x, y, rx, ry, col, z = 0, sh = 0) { if (sh) shCirc(x, y + ry * .3, rx, ry * .8, sh); const yy = y - z, g = c.createRadialGradient(x - rx * .35, yy - ry * .5, rx * .08, x, yy, Math.max(rx, ry) * 1.1);
    g.addColorStop(0, lit(col, .42)); g.addColorStop(.5, col); g.addColorStop(1, lit(col, -.62)); c.fillStyle = g; c.beginPath(); c.ellipse(x, yy, rx, ry, 0, 0, TAU); c.fill(); }
  function cone(c, x, y, r, z0, h, col) { shPoly([[x - r, y], [x + r, y], [x + h * SX + 1, y + h * SY], [x + h * SX - 1, y + h * SY]]); const yb = y - z0, g = c.createLinearGradient(x - r, 0, x + r, 0); g.addColorStop(0, lit(col, .25)); g.addColorStop(1, lit(col, -.5)); c.fillStyle = g;
    c.beginPath(); c.moveTo(x - r, yb); c.quadraticCurveTo(x - r * .3, yb - h * .6, x, yb - h); c.quadraticCurveTo(x + r * .3, yb - h * .6, x + r, yb); c.ellipse(x, yb, r, r * KY, 0, 0, Math.PI); c.fill(); }
  function spike(c, x, y, z, ang, L, wd, col) { const tx = x + Math.cos(ang) * L * .35, ty = y - z - L; c.fillStyle = col; c.beginPath(); c.moveTo(x - wd, y - z); c.quadraticCurveTo(tx - wd * .4, ty + L * .5, tx, ty); c.quadraticCurveTo(tx + wd * .2, ty + L * .5, x + wd, y - z); c.fill();
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.moveTo(x, y - z); c.quadraticCurveTo(tx, ty + L * .5, tx, ty); c.lineTo(x + wd, y - z); c.fill(); shPoly([[x - wd, y], [x + wd, y], [x + L * SX, y + L * SY]]); }
  // 빛 번짐: 색마다 한 번 만든 방사형 그림을 늘려 찍는다(매 프레임 그라데이션을 만들지 않게)
  const GLC = {}; function glowSprite(col) { if (GLC[col]) return GLC[col]; const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return (GLC[col] = cv); }
  function glow(c, x, y, r, col, a = .6) { const o = c.globalCompositeOperation, ga = c.globalAlpha; c.globalCompositeOperation = 'lighter'; c.globalAlpha = ga * Math.max(0, Math.min(1, a)); c.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); c.globalCompositeOperation = o; c.globalAlpha = ga; }
  function win(c, s, x, y, w, h, col, on = true) { c.fillStyle = '#0b1018'; c.fillRect(x - .8, y - .8, w + 1.6, h + 1.6); if (!on) { c.fillStyle = '#1c2533'; c.fillRect(x, y, w, h); return; }
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, lit(col, .55)); g.addColorStop(1, col); c.fillStyle = g; c.fillRect(x, y, w, h); GL(s)(x + w / 2, y + h / 2, Math.max(w, h) * 2.2, col, .28); }
  function lamp(c, s, x, y, col, period, phase = 0, r = 1.8) { const on = ((s.t + phase + (s.id || 0) * 7) % period) < period * .5; c.fillStyle = on ? col : '#2a2f3a'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    if (on) { glow(c, x, y, r * 6, col, .7); GL(s)(x, y, 16, col, .5); } }
  function pipe(c, pts, wd, col) { c.lineCap = 'round'; c.lineJoin = 'round'; const path = () => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); };
    path(); c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = wd + 2; c.stroke(); path(); c.strokeStyle = col; c.lineWidth = wd; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = Math.max(1, wd * .3); c.translate(0, -wd * .22); path(); c.stroke(); c.translate(0, wd * .22); c.lineCap = 'butt'; c.lineJoin = 'miter'; }
  function stripes(c, x, y, w, h) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = '#d9a23b'; c.fillRect(x, y, w, h); c.fillStyle = '#1c1c1c'; for (let i = -h; i < w; i += 6) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + 3, y + h); c.lineTo(x + i + 3 + h, y); c.lineTo(x + i + h, y); c.fill(); } c.restore(); }
  function slab(c, w, d, col, z = 4, inset = 0) { return box(c, inset, inset, w - inset * 2, d - inset * 2, 0, z, col); }
  function vents(c, x, y, n, w = 3, h = 6) { for (let i = 0; i < n; i++) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(x + i * (w + 2), y, w, h); c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(x + i * (w + 2), y + h, w, 1); } }
  function smokeAt(s, x, y, every) { if ((s.t + (s.id || 0) * 5) % every === 0) EM(s)('smoke', x, y); }
  const IRON = '#57514c', IRON2 = '#3d3a38', IRON3 = '#6c645c', STEEL = '#7d8794', CONC = '#5c6470', FL = ['#6b2d4a', '#7c3656', '#8e4064', '#4a1f36'], BONE = '#e8dcc6', BIO = '#b6ff6a', BIO2 = '#ff7ad0', HOT = '#ff8a2a';

  const A = {};
  // ══ 개척단 ══ 콘크리트 기단, 강철 본관, 창문 줄, 경고 줄무늬, 팀 색 띠
  A.hq = { H: 70,
    base(c, w, d, P, s) { slab(c, w, d, CONC, 5); for (let i = 0; i < w / 8; i++) if (i % 2 === 0) { c.fillStyle = '#d9a23b'; c.fillRect(i * 8, d - 5, 8, 5); }
      const B = box(c, 10, 10, 92, 64, 5, 30, STEEL); c.fillStyle = P.main; c.fillRect(10, B.fy + 3, 92, 3);
      for (let i = 0; i < 6; i++) win(c, s, 14 + i * 9, B.fy + 9, 6, 4, P.light);
      c.fillStyle = '#1a1f27'; c.fillRect(72, B.fy + 8, 24, B.h - 8); c.fillStyle = '#4d5560'; for (let i = 0; i < 5; i++) c.fillRect(73, B.fy + 9 + i * 4, 22, 2.6); c.fillStyle = '#d9a23b'; c.fillRect(70, B.fy + 6, 2, B.h - 6); c.fillRect(96, B.fy + 6, 2, B.h - 6);
      const T = B.top; c.strokeStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.moveTo(10, T + 32); c.lineTo(102, T + 32); c.moveTo(56, T); c.lineTo(56, T + 64); c.stroke();
      box(c, 16, 50, 22, 14, 35, 5, CONC); vents(c, 18, T + 36, 4);
      c.strokeStyle = P.main; c.lineWidth = 1.5; c.beginPath(); c.ellipse(80, T + 46, 12, 9.5, 0, 0, TAU); c.stroke(); c.lineWidth = 2; c.beginPath(); c.moveTo(76, T + 41); c.lineTo(76, T + 51); c.moveTo(84, T + 41); c.lineTo(84, T + 51); c.moveTo(76, T + 46); c.lineTo(84, T + 46); c.stroke();
      const tt = cyl(c, 34, 30, 13, 35, 18, '#8e98a6'); for (let i = 0; i < 5; i++) win(c, s, 24 + i * 4.4, tt + 8, 2.6, 4, P.light);
      c.fillStyle = '#b9c1cc'; c.fillRect(93, T - 26, 2, 38); c.fillRect(89, T - 14, 10, 1.4); c.fillRect(90, T - 4, 8, 1.4);
      cyl(c, 114, 74, 9, 5, 22, '#9aa3ae'); c.fillStyle = P.main; c.fillRect(105, 74 - 5 - 14, 18, 3); cyl(c, 114, 50, 7, 5, 16, '#8a939e'); },
    live(c, w, d, P, s) { const T = 10 - 35; // 본관 윗면 y
      const k = .5 + .5 * Math.sin(s.t * .06); dome(c, 34, 30, 11, 53, P.main, true); glow(c, 34, 30 - 60, 22, P.main, .25 + .2 * k); GL(s)(34, 30 - 60, 50, P.main, .35 + k * .15);
      c.save(); c.translate(52, T + 10); const a = s.t * (s.busy ? .06 : .02); c.scale(Math.cos(a) * .9 + .1 * Math.sign(Math.cos(a) || 1), 1); c.fillStyle = '#c8d0da'; c.beginPath(); c.ellipse(0, -10, 9, 4, 0, 0, TAU); c.fill(); c.fillStyle = '#8b939e'; c.beginPath(); c.ellipse(0, -10, 6, 2.6, 0, 0, TAU); c.fill(); c.restore();
      c.strokeStyle = '#333'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(52, T + 10); c.lineTo(52, T); c.stroke();
      lamp(c, s, 94, T - 27, '#ff4a3a', 50); if (s.busy) { const g = .5 + .5 * Math.sin(s.t * .2); c.fillStyle = `rgba(255,207,122,${.5 + g * .4})`; c.fillRect(73, 74 - 5 - 3, 22, 2); glow(c, 84, 74 - 5, 18, '#ffcf7a', .35); GL(s)(84, 70, 30, '#ffcf7a', .45); } } };
  A.depot = { H: 34,
    base(c, w, d, P, s) { slab(c, w, d, CONC, 4); box(c, 6, 10, 32, 22, 4, 16, '#6f7884'); box(c, 6, 34, 32, 22, 4, 14, '#7d8794'); box(c, 10, 14, 24, 14, 20, 10, '#8a6a3a');
      for (const y of [10 + 22 - 4 - 16, 34 + 22 - 4 - 14]) { c.fillStyle = P.main; c.fillRect(6, y + 4, 32, 2.5); for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(8 + i * 6, y + 7, 1.4, 8); } }
      const t = cyl(c, 50, 44, 9, 4, 24, '#9aa3ae'); c.fillStyle = P.main; c.fillRect(41, t + 10, 18, 3); cyl(c, 50, 20, 7, 4, 18, '#8a939e'); stripes(c, 2, d - 4, w - 4, 3); },
    live(c, w, d, P, s) { lamp(c, s, 50, 44 - 28 - 4, '#7dffa8', 70, 0, 2); } };
  A.extractor = { H: 40,
    base(c, w, d, P, s) { slab(c, w, d, CONC, 4); pipe(c, [[6, 40], [18, 40]], 5, '#8a939e'); pipe(c, [[58, 40], [46, 40]], 5, '#8a939e');
      box(c, 4, 8, 16, 14, 4, 12, '#6f7884'); vents(c, 6, 8 + 14 - 16 + 2, 2, 3, 4); box(c, 46, 50, 14, 10, 4, 8, '#6f7884');
      const t = cyl(c, 32, 38, 15, 4, 22, '#8e98a6'); c.fillStyle = '#2a1028'; c.fillRect(25, t + 9, 14, 8); c.fillStyle = '#f08ae6'; c.fillRect(26, t + 10, 12, 6); GL(s)(32, t + 13, 24, '#f08ae6', .4);
      c.fillStyle = P.main; c.fillRect(17, t + 4, 30, 2.5); cyl(c, 32, 38, 9, 26, 5, '#6f7884'); },
    live(c, w, d, P, s) { const y = 38 - 31, k = Math.sin(s.t * .1); c.save(); c.translate(32, y); for (let i = 0; i < 6; i++) { const a = s.t * .06 + i * TAU / 6; c.fillStyle = Math.sin(a) > 0 ? '#9aa3ae' : '#5c6470'; c.fillRect(Math.cos(a) * 11 - 2, Math.sin(a) * 11 * KY - 1.5, 4, 3); } c.restore();
      c.fillStyle = '#f08ae6'; c.beginPath(); c.ellipse(32, y, 4 + k, 2.2 + k * .5, 0, 0, TAU); c.fill(); glow(c, 32, y, 16, '#f08ae6', .5 + .2 * k); GL(s)(32, y, 40, '#f08ae6', .5 + k * .1); if (s.t % 40 === 0) EM(s)('steam', 42, 4); } };
  A.barracks = { H: 46,
    base(c, w, d, P, s) { slab(c, w, d, CONC, 4); const B = box(c, 8, 14, 80, 54, 4, 26, '#7a8270');
      c.fillStyle = P.main; c.fillRect(8, B.fy + 2, 80, 3); for (let i = 0; i < 4; i++) win(c, s, 12 + i * 8, B.fy + 9, 5, 5, P.light, (i + 1) % 4 !== 0); for (let i = 0; i < 3; i++) win(c, s, 68 + i * 6, B.fy + 9, 4, 5, P.light);
      c.fillStyle = '#141a24'; c.fillRect(46, B.fy + 6, 18, B.h - 6); stripes(c, 44, B.fy + 3, 22, 3);
      c.fillStyle = 'rgba(0,0,0,.3)'; for (let i = 0; i < 3; i++) c.fillRect(10, B.top + 12 + i * 14, 76, 1.2); vents(c, 14, B.top + 6, 3); vents(c, 68, B.top + 6, 3);
      for (const [x, y] of [[4, 74], [70, 78], [10, 84]]) for (let i = 0; i < 3; i++) box(c, x + i * 7, y, 8, 5, 4 + (i % 2) * 0, 4, '#8b8268');
      c.fillStyle = '#20252e'; c.fillRect(14, B.top - 18, 2, 20); box(c, 60, 24, 18, 12, 30, 8, '#6a7262'); },
    live(c, w, d, P, s) { const fy = 14 + 54 - 4 - 26, h = 26, open = s.busy ? (Math.sin(s.t * .06) * .5 + .5) * (h - 8) : 0;
      if (open > 1) { c.fillStyle = '#ffcf7a'; c.globalAlpha = .75; c.fillRect(47, fy + h - open, 16, open); c.globalAlpha = 1; glow(c, 55, fy + h, 22, '#ffcf7a', .4); GL(s)(55, fy + h - 4, 30, '#ffcf7a', .5); }
      c.fillStyle = '#5a6150'; c.fillRect(47, fy + 7, 16, h - 7 - open); c.fillStyle = 'rgba(0,0,0,.3)'; for (let y = fy + 9; y < fy + h - open - 1; y += 4) c.fillRect(47, y, 16, 1.2);
      const fx = 16, fyy = 14 - 4 - 26 - 18, f = Math.sin(s.t * .15) * 2; c.fillStyle = P.main; c.beginPath(); c.moveTo(fx, fyy); c.quadraticCurveTo(fx + 6, fyy - 1 + f, fx + 13, fyy + 1 + f * .6); c.lineTo(fx + 13, fyy + 7 + f * .6); c.quadraticCurveTo(fx + 6, fyy + 5 + f, fx, fyy + 6); c.fill();
      lamp(c, s, 42, fy + 4, s.busy ? '#ffb347' : '#3a3f4a', 20); lamp(c, s, 68, fy + 4, s.busy ? '#ffb347' : '#3a3f4a', 20, 10); } };
  A.lab = { H: 44,
    base(c, w, d, P, s) { slab(c, w, d, CONC, 4); const B = box(c, 44, 12, 46, 44, 4, 22, '#7d8794');
      for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) win(c, s, 48 + i * 8, B.fy + 5 + r * 8, 5, 4, i % 2 ? P.light : '#9fd8ff', (i + r) % 3 !== 0);
      c.fillStyle = P.main; c.fillRect(44, B.fy + 2, 46, 2); vents(c, 50, B.top + 30, 4);
      cyl(c, 26, 36, 18, 4, 10, '#6f7884'); c.fillStyle = '#d9a23b'; c.fillRect(8, 36 - 14 - 1, 36, 2); box(c, 74, 18, 10, 10, 26, 4, '#5c6470'); },
    live(c, w, d, P, s) { const k = s.busy ? .5 + .5 * Math.sin(s.t * .15) : .2; dome(c, 26, 36, 15, 14, '#3a6c94', true); c.globalAlpha = .25 + .45 * k; c.fillStyle = '#9fd8ff'; c.beginPath(); c.ellipse(26, 36 - 14 - 6, 10, 7, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
      glow(c, 26, 36 - 20, 26, '#9fd8ff', .2 + .3 * k); GL(s)(26, 16, 40, '#9fd8ff', .3 + k * .4); if (s.busy && s.t % 14 === 0) EM(s)('spark', 26, 14);
      const a = -s.t * .02; c.save(); c.translate(79, 18 - 30); c.strokeStyle = '#333'; c.beginPath(); c.moveTo(0, 4); c.lineTo(0, -4); c.stroke(); c.scale(Math.cos(a), 1); c.fillStyle = '#c8d0da'; c.beginPath(); c.ellipse(0, -5, 8, 3.6, 0, 0, TAU); c.fill(); c.restore(); lamp(c, s, 88, 52 - 26, '#7dffa8', 60); } };
  A.factory = { H: 52,
    base(c, w, d, P, s) { slab(c, w, d, CONC, 4); const B = box(c, 6, 18, 84, 62, 4, 30, '#737b86');
      for (let i = 0; i < 4; i++) { const x = 8 + i * 20; c.fillStyle = lit('#737b86', .1); c.beginPath(); c.moveTo(x, B.top + 8); c.lineTo(x + 20, B.top); c.lineTo(x + 20, B.top + 8); c.closePath(); c.fill(); c.fillStyle = '#9fd8ff'; c.globalAlpha = .55; c.fillRect(x + 17, B.top + 1, 3, 7); c.globalAlpha = 1; }
      c.fillStyle = 'rgba(0,0,0,.3)'; for (let i = 0; i < 3; i++) c.fillRect(8, B.top + 20 + i * 12, 80, 1.2);
      c.fillStyle = '#141a24'; c.fillRect(30, B.fy + 6, 36, B.h - 6); stripes(c, 28, B.fy + 2, 40, 4); c.fillStyle = P.main; c.fillRect(6, B.fy + 8, 20, 3); c.fillRect(70, B.fy + 8, 20, 3);
      for (let i = 0; i < 2; i++) win(c, s, 10 + i * 8, B.fy + 14, 5, 4, '#ffb347'); for (let i = 0; i < 2; i++) win(c, s, 74 + i * 8, B.fy + 14, 5, 4, '#ffb347');
      cyl(c, 14, 22, 6, 34, 18, '#5c6470'); cyl(c, 80, 22, 6, 34, 18, '#5c6470'); c.fillStyle = '#3d4450'; c.fillRect(6, B.top + 48, 84, 2); },
    live(c, w, d, P, s) { const fy = 18 + 62 - 4 - 30, h = 30, top = 18 - 34; for (const x of [14, 80]) { const y = 22 - 52; c.fillStyle = '#0c0d10'; c.beginPath(); c.ellipse(x, y, 4, 2.3, 0, 0, TAU); c.fill(); if (s.busy) { c.fillStyle = HOT; c.beginPath(); c.ellipse(x, y, 2.8, 1.6, 0, 0, TAU); c.fill(); glow(c, x, y, 12, HOT, .5); smokeAt(s, x, y, 9); } }
      if (s.busy) { const q = (s.t * .5) % 30; c.fillStyle = 'rgba(255,190,90,.35)'; c.fillRect(31, fy + 6, 34, h - 6); c.fillStyle = '#5c6470'; c.fillRect(31 + q, fy + h - 9, 6, 8); GL(s)(48, fy + h - 4, 34, '#ffb347', .45); }
      const cr = 18 + (Math.sin(s.t * .02) * .5 + .5) * 56; c.fillStyle = '#d9a23b'; c.fillRect(cr, top + 46, 8, 5); c.strokeStyle = '#111'; c.beginPath(); c.moveTo(cr + 4, top + 51); c.lineTo(cr + 4, top + 58); c.stroke();
      lamp(c, s, 8, fy + 3, '#ffb347', 30); lamp(c, s, 88, fy + 3, '#ffb347', 30, 15); } };
  A.turret = { H: 34,
    base(c, w, d, P, s) { slab(c, w, d, CONC, 3); for (let i = 0; i < 10; i++) { const a = i * TAU / 10, x = 32 + Math.cos(a) * 25, y = 34 + Math.sin(a) * 22; if (Math.sin(a) < -.2) box(c, x - 5, y - 3, 10, 6, 3, 5, '#8b8268'); }
      cyl(c, 32, 34, 18, 3, 14, '#6f7884'); c.fillStyle = '#d9a23b'; c.fillRect(14, 34 - 3 - 5, 36, 2.4); for (let i = 0; i < 10; i++) { const a = i * TAU / 10, x = 32 + Math.cos(a) * 25, y = 34 + Math.sin(a) * 22; if (Math.sin(a) >= -.2) box(c, x - 5, y - 3, 10, 6, 3, 5, '#8b8268'); } },
    live(c, w, d, P, s) { const x = 32, y = 34 - 17, a = s.facing || 0, ca = Math.cos(a), sa = Math.sin(a) * KY;
      const barrel = () => { for (const o of [-3.5, 3.5]) { const ox = -sa / KY * o * .5, oy = ca * o * .5 * KY; c.strokeStyle = '#2b3038'; c.lineWidth = 3.6; c.beginPath(); c.moveTo(x + ox, y - 6 + oy); c.lineTo(x + ox + ca * 24, y - 6 + oy + sa * 24); c.stroke(); c.strokeStyle = '#8b939e'; c.lineWidth = 1.4; c.stroke(); } };
      if (sa < 0) barrel(); c.fillStyle = P.dark; c.beginPath(); c.ellipse(x, y - 2, 12, 12 * KY, 0, 0, TAU); c.fill(); c.fillStyle = lit(P.dark, -.3); c.fillRect(x - 12, y - 6, 24, 4); dome(c, x, y, 11, 4, P.main, false); if (sa >= 0) barrel();
      lamp(c, s, 10, 10, '#ff4a3a', 36); } };

  // ══ 철갑회 ══ 육각 기단, 검은 쇠, 용광로 불빛, 굵은 관
  A.i_hq = { H: 64,
    base(c, w, d, P, s) { const x = 64, y = 54; hexPrism(c, x, y, 62, 0, 6, IRON2);
      for (const sx of [22, 106]) { const t = cyl(c, sx, y - 18, 7, 6, 34, IRON); c.fillStyle = '#100c0a'; c.beginPath(); c.ellipse(sx, t, 4.5, 2.6, 0, 0, TAU); c.fill(); for (let i = 0; i < 3; i++) { c.fillStyle = 'rgba(255,140,40,.55)'; c.fillRect(sx - 7, t + 8 + i * 6, 2, 3); } }
      hexPrism(c, x, y, 46, 6, 16, '#5a534d'); hexPrism(c, x, y, 32, 22, 16, P.dark);
      c.fillStyle = '#140d09'; c.fillRect(x - 12, y - 26 + 18, 24, 13); for (let i = 0; i < 4; i++) { c.fillStyle = '#2a2420'; c.fillRect(x - 10 + i * 6, y - 7, 2, 10); }
      const top = hexPrism(c, x, y, 18, 38, 10, IRON3); c.fillStyle = '#180f0b'; c.beginPath(); c.ellipse(x, top, 13, 13 * KY, 0, 0, TAU); c.fill();
      for (const [a, b, e] of [[14, 72, 44], [114, 72, 84]]) pipe(c, [[a, b], [(a + e) / 2, b - 22], [e, y - 22]], 4, '#7a7068');
      for (const lx of [x - 40, x + 40]) { c.fillStyle = P.main; c.fillRect(lx - 4, y + 11, 8, 3); } },
    live(c, w, d, P, s) { const x = 64, y = 54, k = Math.sin(s.t * (s.busy ? .14 : .07)), f = .6 + .4 * Math.sin(s.t * .23);
      const g = c.createLinearGradient(0, y - 7, 0, y + 3); g.addColorStop(0, '#ffd27a'); g.addColorStop(1, '#ff5a1a'); c.globalAlpha = .65 + .35 * f; c.fillStyle = g; for (let i = 0; i < 4; i++) c.fillRect(x - 8 + i * 6, y - 6, 4, 8); c.globalAlpha = 1;
      glow(c, x, y - 2, 30, HOT, .35 + .2 * f); GL(s)(x, y, 40, HOT, .4 + .2 * f);
      dome(c, x, y, 10 + k * .6, 48, P.main, true); glow(c, x, y - 52, 30, P.main, .35 + .15 * k); GL(s)(x, y - 52, 50, P.main, .5 + k * .1);
      for (const sx of [22, 106]) { const ty = y - 18 - 40; glow(c, sx, ty, 9, HOT, .45 + .2 * Math.sin(s.t * .1 + sx)); smokeAt(s, sx, ty, 14); }
      for (const lx of [x - 40, x + 40]) glow(c, lx, y + 12, 9, P.main, .5); } };
  A.i_depot = { H: 50,
    base(c, w, d, P, s) { const x = 32, y = 38; hexPrism(c, x, y, 30, 0, 5, IRON2); hexPrism(c, x, y, 20, 5, 10, IRON); hexPrism(c, x, y, 8, 15, 26, IRON3); hexPrism(c, x, y, 12, 41, 4, P.dark);
      c.strokeStyle = P.main; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y - 15, 16, 16 * KY, 0, 0, Math.PI); c.stroke(); },
    live(c, w, d, P, s) { const x = 32, y = 38, a = s.t * .05; c.strokeStyle = P.light; c.lineWidth = 2; for (const z of [24, 34]) { c.beginPath(); c.ellipse(x, y - z, 13, 13 * KY, 0, a + z, a + z + 2); c.stroke(); c.beginPath(); c.ellipse(x, y - z, 13, 13 * KY, 0, a + z + Math.PI, a + z + Math.PI + 2); c.stroke(); }
      glow(c, x, y - 30, 16, P.main, .3); lamp(c, s, x, y - 47, P.light, 30, 0, 2.4); } };
  A.i_extractor = { H: 40,
    base(c, w, d, P, s) { const x = 32, y = 38; for (const a of [.5, 2.6, 4.7]) box(c, x + Math.cos(a) * 22 - 4, y + Math.sin(a) * 14 - 4, 8, 8, 0, 8, IRON);
      hexPrism(c, x, y, 26, 0, 5, IRON2); const t = cyl(c, x, y, 14, 5, 24, IRON); c.strokeStyle = '#2a2420'; c.lineWidth = 1.5; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(x, y - 9 - i * 4.5, 14, 14 * KY, 0, 0, Math.PI); c.stroke(); }
      c.fillStyle = '#1a0c18'; c.beginPath(); c.ellipse(x, t, 10, 10 * KY, 0, 0, TAU); c.fill(); c.fillStyle = P.main; c.fillRect(x - 14, y - 7, 28, 2.4); },
    live(c, w, d, P, s) { const x = 32, y = 38, top = y - 29; c.strokeStyle = '#e06bd8'; c.lineWidth = 2.4; c.beginPath(); for (let a = 0; a < 13; a += .35) { const r = a * .75; c.lineTo(x + Math.cos(a + s.t * .08) * r, top + Math.sin(a + s.t * .08) * r * KY); } c.stroke();
      const q = (s.t * .05) % 1; c.fillStyle = '#ffd6fb'; c.beginPath(); c.ellipse(x, y - 9 - q * 18, 14, 14 * KY, 0, .2, Math.PI - .2); c.globalAlpha = .35; c.fill(); c.globalAlpha = 1; glow(c, x, top, 18, '#e06bd8', .55); GL(s)(x, top, 42, '#e06bd8', .55); } };
  A.i_barracks = { H: 50,
    base(c, w, d, P, s) { const x = 48; hexPrism(c, x, 56, 46, 0, 5, IRON2); const B = box(c, 22, 26, 52, 40, 5, 28, '#4a4440');
      c.fillStyle = '#140d09'; c.fillRect(34, B.fy + 8, 28, B.h - 10); c.fillStyle = P.dark; c.fillRect(22, B.fy + 2, 52, 4); vents(c, 26, B.top + 6, 4); vents(c, 54, B.top + 6, 4);
      for (const a of [-1, 1]) { c.fillStyle = P.main; c.beginPath(); c.moveTo(x + 26 * a, 30); c.lineTo(x + 40 * a, 14); c.lineTo(x + 40 * a, 50); c.fill(); }
      cyl(c, 16, 22, 5, 5, 30, IRON); cyl(c, 80, 22, 5, 5, 30, IRON); },
    live(c, w, d, P, s) { const fy = 26 + 40 - 5 - 28, h = 28, k = .6 + .4 * Math.sin(s.t * .1), hot = s.busy ? 1 : .55;
      const g = c.createLinearGradient(0, fy + 8, 0, fy + h); g.addColorStop(0, `rgba(255,${150 + k * 60 | 0},60,${hot})`); g.addColorStop(1, `rgba(255,70,20,${hot})`); c.fillStyle = g; c.fillRect(36, fy + 10, 24, h - 13);
      glow(c, 48, fy + h - 6, 28, HOT, .3 * hot + .15); GL(s)(48, fy + h - 6, 40, HOT, .45 * hot + .15); if (s.busy && s.t % 7 === 0) EM(s)('spark', 48, fy + h - 8);
      const arm = Math.sin(s.t * (s.busy ? .12 : .02)) * 6; pipe(c, [[18, fy + 2], [34 + arm, fy - 8]], 3, '#8a7f76'); pipe(c, [[78, fy + 2], [62 - arm, fy - 8]], 3, '#8a7f76');
      for (const sx of [16, 80]) { const ty = 22 - 35; glow(c, sx, ty, 7, HOT, s.busy ? .6 : .25); if (s.busy) smokeAt(s, sx, ty, 12); } } };
  A.i_lab = { H: 42,
    base(c, w, d, P, s) { const y = 40; box(c, 4, 22, 88, 36, 0, 5, IRON2); box(c, 20, y - 8, 56, 8, 5, 8, IRON);
      for (const [x, r, h] of [[20, 14, 24], [48, 11, 18], [76, 14, 24]]) { hexPrism(c, x, y, r, 5, h, IRON3); hexPrism(c, x, y, r * .6, 5 + h, 4, P.dark); } },
    live(c, w, d, P, s) { const y = 40, k = s.busy ? 1 : .45; c.strokeStyle = P.light; c.globalAlpha = .5 + .4 * k; c.lineWidth = 2; c.beginPath(); c.moveTo(20, y - 31); c.lineTo(48, y - 25); c.lineTo(76, y - 31); c.stroke(); c.globalAlpha = 1;
      for (const [x, z] of [[20, 33], [48, 27], [76, 33]]) { const p = .8 + .2 * Math.sin(s.t * .1 + x); c.fillStyle = P.main; c.beginPath(); c.ellipse(x, y - z, 5 * p, 3 * p, 0, 0, TAU); c.fill(); glow(c, x, y - z, 14, P.main, .3 + .2 * k); GL(s)(x, y - z, 28, P.main, .3 + .2 * k); }
      for (let i = 0; i < 2; i++) { const q = (s.t * (.01 + .02 * k) + i * .5) % 1, px = 20 + 56 * q, pz = q < .5 ? 31 - 12 * q : 25 + 12 * (q - .5); c.fillStyle = '#fff'; c.beginPath(); c.arc(px, y - pz, 2.2, 0, TAU); c.fill(); GL(s)(px, y - pz, 14, P.light, .5); }
      lamp(c, s, 48, 20, '#ffb347', 50); } };
  A.i_factory = { H: 50,
    base(c, w, d, P, s) { const x = 48, y = 56; hexPrism(c, x, y, 46, 0, 6, IRON2); hexPrism(c, x, y, 34, 6, 14, IRON); hexPrism(c, x, y, 22, 20, 10, P.dark);
      for (const [px, py] of [[14, 26], [82, 26]]) { const t = cyl(c, px, py, 7, 6, 30, IRON); c.fillStyle = '#0c0d10'; c.beginPath(); c.ellipse(px, t, 4.5, 2.6, 0, 0, TAU); c.fill(); }
      for (const [px, py] of [[16, 80], [80, 80]]) { box(c, px - 6, py - 6, 12, 10, 6, 6, IRON3); c.fillStyle = '#2a1a10'; c.fillRect(px - 4, py - 14, 8, 3); }
      c.fillStyle = '#140d09'; c.fillRect(x - 14, y - 12, 28, 10); },
    live(c, w, d, P, s) { const x = 48, y = 56; c.save(); c.translate(x, y - 30); const a = s.t * (s.busy ? .06 : .02); c.fillStyle = P.main; for (let i = 0; i < 4; i++) { const b = a + i * TAU / 4; c.save(); c.scale(1, KY); c.rotate(b); c.fillRect(3, -3, 14, 6); c.restore(); } c.restore();
      c.fillStyle = P.light; c.beginPath(); c.ellipse(x, y - 30, 4, 2.4, 0, 0, TAU); c.fill();
      for (const [px, py] of [[16, 80], [80, 80]]) { const k = s.busy ? Math.sin(s.t * .2 + px) * 3 : 0; box(c, px - 3, py - 4, 6, 4, 12 + k, 5, '#9a9088'); }
      const f = .5 + .5 * Math.sin(s.t * .12); c.fillStyle = `rgba(255,140,40,${s.busy ? .6 + .4 * f : .3})`; c.fillRect(x - 12, y - 11, 24, 8); GL(s)(x, y - 7, 34, HOT, s.busy ? .5 : .2);
      for (const [px, py] of [[14, 26], [82, 26]]) { const ty = py - 36; if (s.busy) { glow(c, px, ty, 10, HOT, .5); smokeAt(s, px, ty, 9); } } } };
  A.i_turret = { H: 36,
    base(c, w, d, P, s) { hexPrism(c, 32, 36, 26, 0, 5, IRON2); hexPrism(c, 32, 36, 17, 5, 12, IRON); },
    live(c, w, d, P, s) { const x = 32, y = 36 - 17, a = s.facing || 0, ca = Math.cos(a), sa = Math.sin(a) * KY;
      const barrel = () => { c.strokeStyle = '#1f1b18'; c.lineWidth = 5; c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + ca * 26, y - 7 + sa * 26); c.stroke(); c.strokeStyle = '#8a7f76'; c.lineWidth = 2; c.stroke(); c.fillStyle = HOT; c.beginPath(); c.arc(x + ca * 26, y - 7 + sa * 26, 1.6, 0, TAU); c.fill(); };
      if (sa < 0) barrel(); hexPrism(c, x, y, 11, 0, 8, P.dark); c.fillStyle = P.main; c.beginPath(); c.ellipse(x, y - 8, 5, 3, 0, 0, TAU); c.fill(); if (sa >= 0) barrel(); lamp(c, s, 10, 36, '#ff4a3a', 40); } };

  // ══ 포자군락 ══ 겹겹이 솟은 살덩이, 뼈 돌기, 핏줄, 생물 발광
  function tendrils(c, x, y, n, r0, r1, seed = .2) { c.lineCap = 'round'; for (let i = 0; i < n; i++) { const a = i * TAU / n + seed, L = r1 * (.85 + (i % 3) * .1);
      const path = () => { c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * .6); c.quadraticCurveTo(x + Math.cos(a + .3) * (r0 + L) / 2, y + Math.sin(a + .3) * (r0 + L) * .3, x + Math.cos(a) * L, y + Math.sin(a) * L * .6); };
      path(); c.strokeStyle = FL[3]; c.lineWidth = 5; c.stroke(); path(); c.strokeStyle = '#8a3f5c'; c.lineWidth = 2.4; c.stroke(); } c.lineCap = 'butt'; }
  function veins(c, x, y, rx, ry, n) { c.strokeStyle = 'rgba(40,0,20,.5)'; c.lineWidth = 1.2; for (let i = 0; i < n; i++) { const a = i * TAU / n; c.beginPath(); c.moveTo(x + Math.cos(a) * rx * .25, y + Math.sin(a) * ry * .25); c.quadraticCurveTo(x + Math.cos(a + .4) * rx * .6, y + Math.sin(a + .4) * ry * .6, x + Math.cos(a) * rx * .95, y + Math.sin(a) * ry * .95); c.stroke(); } }
  function pustule(c, s, x, y, r, col) { blob(c, x, y, r, r * .85, col); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(x - r * .3, y - r * .35, r * .3, 0, TAU); c.fill(); GL(s)(x, y, r * 4, col, .3); }
  const ooze = (c, x, y, rx, ry) => { c.fillStyle = 'rgba(80,30,60,.55)'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
  A.s_hq = { H: 66,
    base(c, w, d, P, s) { const x = 64, y = 58; ooze(c, x, y + 6, 64, 38); tendrils(c, x, y + 4, 9, 30, 60);
      blob(c, x, y, 52, 32, FL[0], 0, 30); blob(c, x, y - 4, 44, 27, FL[1], 6);
      for (let i = 0; i < 7; i++) { const a = Math.PI + .25 + i * (Math.PI - .5) / 6; spike(c, x + Math.cos(a) * 40, y - 2 + Math.sin(a) * 22, 4, Math.cos(a), 28, 3.2, BONE); }
      blob(c, x, y - 10, 34, 21, FL[2], 14); blob(c, x, y - 14, 24, 15, P.dark, 24); veins(c, x, y - 30, 30, 18, 9);
      for (const [px, py, r, col] of [[x - 34, y + 4, 6, BIO], [x + 36, y + 2, 5, BIO2], [x - 20, y + 14, 4, BIO], [x + 22, y + 15, 4.5, BIO]]) pustule(c, s, px, py, r, col);
      c.strokeStyle = FL[3]; c.lineWidth = 3; for (const k of [-1, 1]) { c.beginPath(); c.moveTo(x + k * 10, y - 34); c.quadraticCurveTo(x + k * 22, y - 28, x + k * 20, y - 18); c.stroke(); } },
    live(c, w, d, P, s) { const x = 64, y = 58, hb = Math.max(0, Math.sin(s.t * .12)) ** 6, b = 1 + Math.sin(s.t * .08) * .04 + hb * .08;
      blob(c, x, y - 40, 14 * b, 12 * b, P.main); blob(c, x - 3, y - 44, 5 * b, 4 * b, P.light); glow(c, x, y - 40, 36, P.main, .35 + hb * .35); GL(s)(x, y - 40, 54, P.main, .45 + hb * .45);
      for (const [px, py, col] of [[x - 34, y + 4, BIO], [x + 36, y + 2, BIO2]]) glow(c, px, py, 12, col, .25 + .2 * Math.sin(s.t * .09 + px)); } };
  A.s_pod = { H: 38,
    base(c, w, d, P, s) { const x = 32, y = 40; ooze(c, x, y + 4, 30, 20); tendrils(c, x, y + 2, 6, 14, 30, .5); blob(c, x, y, 24, 16, FL[0], 0, 22); blob(c, x, y - 6, 18, 12, FL[1], 4);
      for (let i = 0; i < 4; i++) { const a = Math.PI + .5 + i * .7; spike(c, x + Math.cos(a) * 18, y + Math.sin(a) * 10, 2, Math.cos(a), 14, 2.2, BONE); } pustule(c, s, x + 14, y + 4, 3, BIO); },
    live(c, w, d, P, s) { const x = 32, y = 40, b = 1 + Math.sin(s.t * .12) * .07; c.globalAlpha = .9; blob(c, x, y - 22, 13 * b, 15 * b, P.dark); c.globalAlpha = 1; c.strokeStyle = 'rgba(0,0,0,.25)'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.ellipse(x + i * 5, y - 22, 3, 13 * b, 0, 0, TAU); c.stroke(); }
      blob(c, x - 4, y - 27, 4, 3, P.main); glow(c, x, y - 22, 18, P.main, .25); GL(s)(x, y - 22, 32, P.main, .3); } };
  A.s_extractor = { H: 34,
    base(c, w, d, P, s) { const x = 32, y = 38; ooze(c, x, y + 2, 30, 22); blob(c, x, y, 22, 15, FL[0], 0, 18);
      c.lineCap = 'round'; for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + .7; c.strokeStyle = FL[3]; c.lineWidth = 6; c.beginPath(); c.moveTo(x + Math.cos(a) * 8, y - 12 + Math.sin(a) * 4); c.quadraticCurveTo(x + Math.cos(a) * 20, y - 14, x + Math.cos(a) * 26, y + Math.sin(a) * 16); c.stroke(); c.strokeStyle = FL[1]; c.lineWidth = 3.4; c.stroke(); } c.lineCap = 'butt';
      blob(c, x, y - 12, 14, 9, FL[2], 4); c.fillStyle = '#2a0c22'; c.beginPath(); c.ellipse(x, y - 18, 8, 4.6, 0, 0, TAU); c.fill(); },
    live(c, w, d, P, s) { const x = 32, y = 38; for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + .7, q = (s.t * .02 + i * .25) % 1, px = x + Math.cos(a) * 26 * (1 - q) + Math.cos(a) * 8 * q, py = y + Math.sin(a) * 16 * (1 - q) + (-14) * q; c.fillStyle = '#ff9ef0'; c.beginPath(); c.arc(px, py, 1.8, 0, TAU); c.fill(); }
      const k = Math.sin(s.t * .15); c.fillStyle = '#e06bd8'; c.beginPath(); c.ellipse(x, y - 18, 5 + k, 2.8 + k * .5, 0, 0, TAU); c.fill(); glow(c, x, y - 18, 18, '#e06bd8', .5); GL(s)(x, y - 18, 40, '#e06bd8', .55); } };
  A.s_pool = { H: 30,
    base(c, w, d, P, s) { const x = 48, y = 52; ooze(c, x, y + 4, 48, 36); tendrils(c, x, y + 2, 10, 34, 50, .3); blob(c, x, y, 40, 28, FL[0], 0, 18); blob(c, x, y - 4, 34, 23, FL[1], 6);
      for (let i = 0; i < 6; i++) { const a = Math.PI + .3 + i * .5; spike(c, x + Math.cos(a) * 34, y - 2 + Math.sin(a) * 22, 6, Math.cos(a), 18, 2.6, BONE); }
      c.fillStyle = FL[3]; c.beginPath(); c.ellipse(x, y - 12, 24, 15, 0, 0, TAU); c.fill(); c.fillStyle = '#3c6a2a'; c.beginPath(); c.ellipse(x, y - 11, 21, 12.5, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(155,224,90,.45)'; c.beginPath(); c.ellipse(x, y - 11, 21, 12.5, 0, 0, Math.PI); c.fill(); for (const a of [.6, 1.3, 2.0]) pustule(c, s, x + Math.cos(a) * 34, y + Math.sin(a) * 20, 2.6, BIO); },
    live(c, w, d, P, s) { const x = 48, y = 52, k = s.busy ? .3 : .12; for (let i = 0; i < 5; i++) { const q = (s.t * (s.busy ? .03 : .012) + i * .2) % 1, bx = x + Math.sin(i * 2.3) * 12, by = y - 11 + Math.cos(i * 1.7) * 6 - q * 3; c.globalAlpha = 1 - q; c.fillStyle = '#d6ff9e'; c.beginPath(); c.arc(bx, by, 1.4 + q * 2.4, 0, TAU); c.fill(); c.globalAlpha = 1; }
      glow(c, x, y - 11, 26, '#9be05a', .2 + k); GL(s)(x, y - 11, 46, '#9be05a', .35 + k); } };
  A.s_den = { H: 36,
    base(c, w, d, P, s) { const y = 40; ooze(c, 48, y + 4, 46, 22); c.lineCap = 'round'; c.strokeStyle = FL[3]; c.lineWidth = 7; c.beginPath(); c.moveTo(22, y - 6); c.lineTo(74, y - 6); c.stroke(); c.strokeStyle = FL[1]; c.lineWidth = 4; c.stroke(); c.lineCap = 'butt';
      for (const [x, r] of [[22, 17], [48, 13], [74, 16]]) { blob(c, x, y, r, r * .7, FL[0], 0, r); blob(c, x, y - r * .4, r * .8, r * .55, FL[2], r * .3); c.fillStyle = FL[3]; c.beginPath(); c.ellipse(x, y - r * 1.1, r * .45, r * .28, 0, 0, TAU); c.fill(); spike(c, x - r * .6, y - r * .2, r * .3, -1, r * .9, 2, BONE); } },
    live(c, w, d, P, s) { const y = 40; for (const [x, r] of [[22, 17], [48, 13], [74, 16]]) { const k = 1 + Math.sin(s.t * (s.busy ? .2 : .1) + x) * .15; c.fillStyle = P.main; c.beginPath(); c.ellipse(x, y - r * 1.1, r * .3 * k, r * .18 * k, 0, 0, TAU); c.fill(); glow(c, x, y - r * 1.1, r * 1.4, BIO, s.busy ? .45 : .22); GL(s)(x, y - r, r * 2.2, BIO, s.busy ? .45 : .22); }
      const q = (s.t * .015) % 1; c.fillStyle = BIO2; c.beginPath(); c.arc(22 + 52 * q, y - 8, 2.2, 0, TAU); c.fill(); } };
  A.s_nest = { H: 48,
    base(c, w, d, P, s) { const x = 48, y = 54; ooze(c, x, y + 4, 46, 34); for (let i = 0; i < 9; i++) { const a = Math.PI + .1 + i * (Math.PI - .2) / 8; spike(c, x + Math.cos(a) * 30, y + Math.sin(a) * 18, 4, Math.cos(a) * 1.4, 36, 4, i % 2 ? BONE : FL[2]); }
      blob(c, x, y, 34, 22, FL[0], 0, 26); blob(c, x, y - 6, 26, 17, FL[1], 8); c.fillStyle = FL[3]; c.beginPath(); c.ellipse(x, y - 20, 18, 10, 0, 0, TAU); c.fill();
      for (let i = 0; i < 4; i++) { const a = i * .9 + .4; spike(c, x + Math.cos(a) * 30, y + Math.sin(a) * 18, 2, Math.cos(a), 18, 3, BONE); } },
    live(c, w, d, P, s) { const x = 48, y = 54; for (const [dx, dy, ph] of [[-8, -22, 0], [7, -23, 2], [0, -16, 4]]) { const k = .5 + .5 * Math.sin(s.t * (s.busy ? .15 : .06) + ph); blob(c, x + dx, y + dy, 5, 6.5, FL[2]); blob(c, x + dx, y + dy - 1, 3, 3.8, P.light);
        c.globalAlpha = .4 + .5 * k; c.fillStyle = BIO; c.beginPath(); c.ellipse(x + dx, y + dy, 2, 2.6, 0, 0, TAU); c.fill(); c.globalAlpha = 1; GL(s)(x + dx, y + dy, 16, BIO, .25 + .25 * k); } } };
  A.s_spine = { H: 40,
    base(c, w, d, P, s) { const x = 32, y = 38; ooze(c, x, y + 4, 28, 20); tendrils(c, x, y + 2, 6, 12, 28, 1); blob(c, x, y, 20, 13, FL[0], 0, 16); blob(c, x, y - 5, 15, 10, FL[1], 4); },
    live(c, w, d, P, s) { const x = 32, y = 38 - 12, a = s.facing || 0, ca = Math.cos(a), sa = Math.sin(a) * KY;
      const arm = () => { c.lineCap = 'round'; c.strokeStyle = FL[3]; c.lineWidth = 7; c.beginPath(); c.moveTo(x, y - 6); c.quadraticCurveTo(x + ca * 12, y - 22, x + ca * 24, y - 10 + sa * 20); c.stroke(); c.strokeStyle = FL[1]; c.lineWidth = 4; c.stroke(); c.lineCap = 'butt';
        c.fillStyle = BONE; c.beginPath(); c.moveTo(x + ca * 22 - sa * 3, y - 10 + sa * 20 - ca * 2); c.lineTo(x + ca * 32, y - 8 + sa * 27); c.lineTo(x + ca * 22 + sa * 3, y - 10 + sa * 20 + ca * 2); c.fill(); };
      if (sa < 0) arm(); blob(c, x, y - 4, 10, 8, P.dark); blob(c, x, y - 6, 4, 3, P.main); if (sa >= 0) arm(); GL(s)(x, y, 22, BIO, .25); } };

  RTS.BUILD3D = A;
  // base를 그릴 때 그림자를 shCtx(검정)에 함께 그린다
  RTS.b3dBase = function (art, c, shCtx, w, d, P, s) { SH = shCtx; if (SH) SH.fillStyle = '#000'; try { art.base(c, w, d, P, s); } finally { SH = null; } };
  RTS.b3dLive = function (art, c, w, d, P, s) { SH = null; LIVE = true; try { art.live(c, w, d, P, s); } finally { LIVE = false; } };
})();
