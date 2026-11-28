// superart.js — 히든 슈퍼 합체 유닛 그림(화면 전용). 원래 합체 유닛 그림을 크게 그리고 금빛 장식(왕관 뿔·고리·문양)을 더한다.
(function () {
  const U = RTS.art.units, TAU = Math.PI * 2, GOLD = '#ffd24a', GOLD2 = '#a8761a';
  const wrap = (base, sc, deco) => function (c, P, s) { const f = U[base] || U.trooper; c.save(); c.scale(sc, sc); f(c, P, s); c.restore(); deco(c, P, s); };
  const ring = (c, r, w = 2) => { c.strokeStyle = GOLD2; c.lineWidth = w + 1.5; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); c.strokeStyle = GOLD; c.lineWidth = w; c.stroke(); };
  const horns = (c, r, n, len) => { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * .45; c.fillStyle = GOLD; c.beginPath(); c.moveTo(Math.cos(a - .12) * r, Math.sin(a - .12) * r); c.lineTo(Math.cos(a) * (r + len), Math.sin(a) * (r + len)); c.lineTo(Math.cos(a + .12) * r, Math.sin(a + .12) * r); c.fill(); c.strokeStyle = GOLD2; c.lineWidth = .8; c.stroke(); } };
  const gem = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * .8, y); c.lineTo(x, y + r); c.lineTo(x - r * .8, y); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x - r * .25, y - r * .55, r * .3, r * .3); };
  // 작은 슈퍼: 돌격대장(등의 점프 장치), 그림자 기사(어두운 망토 무늬), 독충왕(등의 굴착 갑각)
  U.super_commando = wrap('commando', 1.18, (c, P, s) => { c.fillStyle = '#3a414c'; c.fillRect(-11, -6, 6, 12); c.fillStyle = '#ff9a3a'; c.beginPath(); c.arc(-12, -3, 2, 0, TAU); c.arc(-12, 3, 2, 0, TAU); c.fill(); ring(c, 11, 1.4); horns(c, 11, 3, 4); });
  U.super_duelist = wrap('duelist', 1.15, (c, P, s) => { c.fillStyle = 'rgba(20,18,30,.55)'; c.beginPath(); c.moveTo(-12, -9); c.quadraticCurveTo(-18, 0, -12, 9); c.lineTo(-4, 4); c.lineTo(-4, -4); c.closePath(); c.fill(); ring(c, 12, 1.4); gem(c, 0, 0, 3.2, '#b48cff'); });
  U.super_venom = wrap('venom', 1.18, (c, P, s) => { c.fillStyle = '#5a3a22'; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(-6 + i * 4, 0, 3, 7 - i, 0, 0, TAU); c.fill(); } ring(c, 11, 1.4); horns(c, 11, 4, 3.5); gem(c, 6, 0, 2.6, '#b6ff6a'); });
  // 큰 슈퍼: 거신왕 2종·태고의 거수(왕관과 가슴 보석), 수송선 3종(화물칸)
  U.super_titan = wrap('titan', 1.12, (c, P, s) => { ring(c, 24, 2.2); horns(c, 24, 5, 7); gem(c, 0, 0, 5, P.light); });
  U.super_juggernaut = wrap('juggernaut', 1.12, (c, P, s) => { ring(c, 25, 2.2); horns(c, 25, 5, 7); gem(c, 0, 0, 5, '#ff9a3a'); });
  U.super_behemoth = wrap('behemoth', 1.1, (c, P, s) => { ring(c, 25, 2.2); horns(c, 25, 6, 8); gem(c, 0, 0, 5, '#b6ff6a'); });
  const pods = (c, n, x0, gap) => { for (let i = 0; i < n; i++) { const x = x0 + i * gap; c.fillStyle = '#2a303a'; c.fillRect(x - 4, -16, 8, 6); c.fillRect(x - 4, 10, 8, 6); c.fillStyle = GOLD; c.fillRect(x - 3, -15, 6, 1.5); c.fillRect(x - 3, 14.5, 6, 1.5); } };
  U.super_skyship = wrap('skyship', 1.15, (c, P, s) => { pods(c, 3, -10, 10); ring(c, 26, 1.6); });
  U.super_airship = wrap('airship', 1.15, (c, P, s) => { pods(c, 3, -10, 10); ring(c, 26, 1.6); });
  U.super_sporeship = wrap('wingvenom', 1.7, (c, P, s) => { for (let i = 0; i < 3; i++) { c.fillStyle = 'rgba(180,255,110,.55)'; c.beginPath(); c.ellipse(-8 + i * 8, 0, 4, 6, 0, 0, TAU); c.fill(); } ring(c, 22, 1.6); });
})();
