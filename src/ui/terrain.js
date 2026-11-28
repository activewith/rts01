// terrain.js — 지형 굽기(화면 전용). 게임 시작 때 한 번 계산해 큰 그림 한 장으로 만든다.
// 높이맵 → 햇빛(왼쪽 위) 명암 → 절벽 그림자 → 절벽 기슭 어두움 → 질감·자잘한 돌·풀.
// 타일 판정(통행)은 그대로이고 그림만 바뀐다. 시드는 G.seed라 두 기기에서 같은 그림이 나온다(달라도 게임에는 영향 없음).
RTS.TERRAIN_DECOR = { // 테마별 장식: 풀(grass), 얼음 조각(ice), 마른 덤불(dry), 이끼 포자(spore)
  dusk: { kind: 'grass', tuft: ['#4f7466', '#5f8576', '#3d5f55'], pebble: ['#27353d', '#4a5f66'] },
  ochre: { kind: 'dry', tuft: ['#8c6a3c', '#a17a46', '#5e4428'], pebble: ['#3c2a20', '#8d6b4a'] },
  frost: { kind: 'ice', tuft: ['#d8e6f0', '#eef6fb', '#b6cada'], pebble: ['#3a4a5e', '#8fa3b6'] },
  moss: { kind: 'grass', tuft: ['#5d8a4e', '#6f9c5c', '#3f6538'], pebble: ['#232c25', '#4b5a48'] },
};
RTS.bakeTerrainHD = function (G, th, themeId, low) {
  const TS = 32, SC = low ? 4 : 2, OUT = low ? .5 : 1, W = G.w * TS / SC, H = G.h * TS / SC, N = W * H;
  let s = (G.seed * 9301 + 49297) >>> 0; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const gP = th.ground.map(hex), sP = th.sand.map(hex), rP = th.rock.map(hex).map(c => { const g = (c[0] + c[1] + c[2]) / 3; return c.map(v => v + (g - v) * .4); }); // 암벽은 채도를 조금 뺀다
  // 값 노이즈: 256×256 무작위 격자를 부드럽게 보간. 성긴 격자(8px마다)에서만 계산하고 사이는 선형 보간한다.
  const T = new Float32Array(65536); for (let i = 0; i < 65536; i++) T[i] = r();
  const noise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = T[((yi & 255) << 8) | (xi & 255)], b = T[((yi & 255) << 8) | ((xi + 1) & 255)], c = T[(((yi + 1) & 255) << 8) | (xi & 255)], d = T[(((yi + 1) & 255) << 8) | ((xi + 1) & 255)];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  const fbm = (x, y, o) => { let v = 0, amp = .5, f = 1, t = 0; for (let i = 0; i < o; i++) { v += noise(x * f + i * 17.3, y * f - i * 9.1) * amp; t += amp; amp *= .5; f *= 2.03; } return v / t; };
  const CG = 4, CW = Math.ceil(W / CG) + 2, CH = Math.ceil(H / CG) + 2; // 성긴 격자: 4표본(8px)마다
  const nA = new Float32Array(CW * CH), nB = new Float32Array(CW * CH), nC = new Float32Array(CW * CH);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const i = y * CW + x, px = x * CG * SC, py = y * CG * SC;
    nA[i] = fbm(px / 420, py / 420, 4); nB[i] = fbm(px / 90, py / 90, 3); nC[i] = fbm(px / 46 + 50, py / 46 + 50, 2); }
  const cg = (A, x, y) => { const fx = x / CG, fy = y / CG, xi = fx | 0, yi = fy | 0, u = fx - xi, v = fy - yi, i = yi * CW + xi;
    return A[i] * (1 - u) * (1 - v) + A[i + 1] * u * (1 - v) + A[i + CW] * (1 - u) * v + A[i + CW + 1] * u * v; };
  // 타일 값을 타일 중심 사이에서 이중 선형 보간(바깥은 암벽)
  const tileAt = (tx, ty, k) => (tx < 0 || ty < 0 || tx >= G.w || ty >= G.h) ? (k === 1 ? 1 : 0) : (G.tiles[ty * G.w + tx] === k ? 1 : 0);
  const field = k => { const F = new Float32Array(N), K = SC / TS;
    for (let y = 0; y < H; y++) { const ty = (y + .5) * K - .5, y0 = Math.floor(ty), v = ty - y0;
      for (let x = 0; x < W; x++) { const tx = (x + .5) * K - .5, x0 = Math.floor(tx), u = tx - x0;
        F[y * W + x] = tileAt(x0, y0, k) * (1 - u) * (1 - v) + tileAt(x0 + 1, y0, k) * u * (1 - v) + tileAt(x0, y0 + 1, k) * (1 - u) * v + tileAt(x0 + 1, y0 + 1, k) * u * v; } }
    return F; };
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const rockV = field(1), sandV = field(2);
  // 고지대: 단계(경사로는 반 단계)를 보간한 뒤 경사로가 아닌 곳은 경계를 가파르게 깎는다. 절벽 타일(3)은 바위 절벽면 색으로 칠한다.
  let elv = null, cliffV = null; const HE = 24;
  if (G.elev) { const F = new Float32Array(N), RP = new Float32Array(N), K = SC / TS, E0 = G.elev, Tf = new Float32Array(G.w * G.h), Tr = new Uint8Array(G.w * G.h), at0 = (tx, ty) => E0[Math.min(G.h - 1, Math.max(0, ty)) * G.w + Math.min(G.w - 1, Math.max(0, tx))];
    // 경사로 둘레는 3×3 평균으로 부드럽게 해 계단 무늬가 보이지 않게 한다
    for (let ty = 0; ty < G.h; ty++) for (let tx = 0; tx < G.w; tx++) { let sum = 0, r = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = at0(tx + dx, ty + dy); sum += v; if (v & 3) r = 1; }
      Tf[ty * G.w + tx] = r ? sum / 9 : E0[ty * G.w + tx]; Tr[ty * G.w + tx] = r; }
    const ev = (tx, ty) => Tf[Math.min(G.h - 1, Math.max(0, ty)) * G.w + Math.min(G.w - 1, Math.max(0, tx))], er = (tx, ty) => Tr[Math.min(G.h - 1, Math.max(0, ty)) * G.w + Math.min(G.w - 1, Math.max(0, tx))];
    for (let y = 0; y < H; y++) { const ty = (y + .5) * K - .5, y0 = Math.floor(ty), v = ty - y0;
      for (let x = 0; x < W; x++) { const tx = (x + .5) * K - .5, x0 = Math.floor(tx), u = tx - x0, a = ev(x0, y0), b = ev(x0 + 1, y0), c = ev(x0, y0 + 1), d = ev(x0 + 1, y0 + 1);
        F[y * W + x] = (a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v) / 4;
        RP[y * W + x] = er(x0, y0) * (1 - u) * (1 - v) + er(x0 + 1, y0) * u * (1 - v) + er(x0, y0 + 1) * (1 - u) * v + er(x0 + 1, y0 + 1) * u * v; } }
    elv = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, e = F[i], fl = Math.floor(e), fr = e - fl, n = cg(nC, x, y) - .5, rp = Math.min(1, RP[i] * 1.6);
      const sharp = fl + ss(.18, .62, fr + n * .25); elv[i] = sharp * (1 - rp) + e * rp; }
    cliffV = field(3); }
  const rock = new Float32Array(N), sand = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, n = cg(nC, x, y) - .5;
    rock[i] = ss(.42, .58, rockV[i] + n * .3); sand[i] = ss(.25, .75, sandV[i] + n * .5); }
  // 3/4 시점 암벽: 바닥 칸(rock)은 그대로 두고, 윗면을 HH만큼 위로 올려 그린다. 화면에서 암벽이 덮는 곳(cov) = 바닥 칸 + 그 위(북쪽) LIFT px,
  //   윗면(top) = HH px 아래가 암벽인 곳, 절벽면 = cov - top(바닥 칸 남쪽 HH px 띠). 북쪽으로 솟은 부분은 그 뒤에 선 유닛을 가리므로 따로 떼어 낸다(아래 cv.over)
  const LIFT = 14, Lp = Math.round(LIFT / SC), FB = Math.round(18 / SC) + Lp, HC = 42, Hf = new Float32Array(N), top = new Float32Array(N), cov = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; let m = rock[i]; for (let k = 2; k <= Lp; k += 2) if (y + k < H) m = Math.max(m, rock[i + k * W]); cov[i] = m; }
  const rockFoot = rock; // 바닥 칸(통행 기준)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, b = cg(nB, x, y), a = cg(nA, x, y);
    const tp = y + FB < H ? rockFoot[i + FB * W] * cov[i] : cov[i]; top[i] = tp;
    const c2 = cg(nC, x, y), hz = T[((y * 7 + x * 13) & 65535)] - .5; // 암벽 윗면: 능선(ridged) + 거친 결
    Hf[i] = cov[i] * HC + tp * ((b - .5) * 12 + (1 - Math.abs(c2 * 2 - 1)) * 9 + hz * 2.2) + (1 - cov[i]) * ((a - .5) * 6 + (b - .5) * 2.5 - sand[i] * 2) + (elv ? elv[i] * HE : 0); }
  const L = [-.52, -.62, .58], Ll = Math.hypot(...L); L[0] /= Ll; L[1] /= Ll; L[2] /= Ll; // 햇빛 방향(빛 쪽을 향함): 왼쪽 위
  const tanE = L[2] / Math.hypot(L[0], L[1]), sx = L[0] / Math.hypot(L[0], L[1]), sy = L[1] / Math.hypot(L[0], L[1]);
  const img = new ImageData(W, H), D = img.data;
  const mix = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
  const dry = mix(gP[0], sP[0], .4), lush = mix(gP[2], [gP[2][0] * .9, gP[2][1] * 1.08, gP[2][2] * .95], .6);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, a = cg(nA, x, y), b = cg(nB, x, y), ro = cov[i], tp = top[i], face = Math.max(0, ro - tp);
    // 명암(법선·햇빛). 평지 = 1
    const xl = x > 0 ? i - 1 : i, xr = x < W - 1 ? i + 1 : i, yu = y > 0 ? i - W : i, yd = y < H - 1 ? i + W : i;
    const gx = (Hf[xr] - Hf[xl]) * .5, gy = (Hf[yd] - Hf[yu]) * .5, nl = Math.sqrt(gx * gx + gy * gy + SC * SC);
    let sh = ((-gx * L[0] - gy * L[1] + SC * L[2]) / nl) / L[2]; sh = Math.min(1.55, Math.max(.35, 1 + (sh - 1) * 1.25));
    // 그림자: 햇빛 쪽으로 걸어가며 더 높은 지형이 있으면 가림(부드럽게)
    let occ = 0; if (ro < .5) { const h0 = Hf[i];
      for (let k = 4 / SC; k <= 52 / SC; k += 4 / SC) { const qx = Math.round(x + sx * k), qy = Math.round(y + sy * k); if (qx < 0 || qy < 0 || qx >= W || qy >= H) break;
        const d = Hf[qy * W + qx] - (h0 + k * SC * tanE); if (d > 0) { occ = Math.max(occ, Math.min(1, d / 6)); if (occ >= 1) break; } } }
    const ao = 1 - .4 * Math.min(1, Math.max(0, (rockV[i] - rock[i]) * 2.4)) * (1 - ro); // 절벽 기슭
    // 색: 땅(얼룩·마른 땅·짙은 곳) → 모래 → 암벽 윗면 / 절벽면. 표본마다 배열을 만들지 않도록 채널별로 계산한다.
    const wA = ss(.3, .7, a), wB = ss(.45, .7, b) * .6, wD = ss(.6, .78, b * .6 + a * .4) * .55, wL = ss(.62, .82, 1 - b) * .35, wS1 = ss(.3, .7, b), wS2 = ss(.55, .8, a) * .5, wR1 = ss(.35, .75, b), wR2 = ss(.5, .8, a) * .4;
    const sa = sand[i], rfk = .35 + .125 * Math.sin(y * SC * .55 + b * 14) + .15 * (b - .5), fpos = y + (FB >> 1) < H ? cov[i + (FB >> 1) * W] : 1, fmul = .62 + .3 * fpos, wF = Math.min(1, face * 1.2); // 절벽면 층리, 띠 위쪽은 조금 밝게
    const ev = elv ? elv[i] : 0, cl = cliffV ? Math.min(1, cliffV[i] * 1.5) : 0, slope = elv ? Math.min(1, Math.max(0, Math.hypot(gx, gy) / SC - .9) * .8) * (1 - ro) : 0; // 고지대 경사면
    // 고지대 절벽 방향: 북쪽이 높으면(남향 절벽) 3/4 시점에서 벽면이 보이므로 세로 결(wstr)과 윗단 밝음(wtop), 남쪽이 높으면(북향) 그늘진 가장자리
    const egy = elv && y > 1 && y < H - 2 ? elv[i + 2 * W] - elv[i - 2 * W] : 0, wall = cl > .05 ? (egy < -.08 ? 1 : egy > .08 ? -1 : 0) : 0;
    const wstr = .35 + .2 * Math.sin(x * SC * .9 + b * 9) + .12 * (a - .5), wtop = wall > 0 ? Math.max(0, Math.min(1, (elv[i] - Math.floor(elv[i])) * 2.2)) : 0;
    const k = (face > .3 ? 1 : sh) * (1 - occ * .52) * ao * (.9 + .2 * a) * (.92 + ev * .11);
    for (let ch = 0; ch < 3; ch++) { let v = gP[1][ch] + (gP[2][ch] - gP[1][ch]) * wA; v += (gP[0][ch] - v) * wB; v += (dry[ch] - v) * wD; v += (lush[ch] - v) * wL;
      let sv = sP[1][ch] + (sP[2][ch] - sP[1][ch]) * wS1; sv += (sP[0][ch] - sv) * wS2; v += (sv - v) * sa;
      let rv = rP[1][ch] + (rP[2][ch] - rP[1][ch]) * wR1; rv += (rP[0][ch] - rv) * wR2; v += (rv - v) * tp;
      if (face > 0) v += ((rP[0][ch] + (rP[1][ch] - rP[0][ch]) * rfk) * fmul - v) * wF;
      if (slope > 0 || cl > 0) v += ((rP[1][ch] + (rP[2][ch] - rP[1][ch]) * (wall > 0 ? wstr : rfk)) * (wall > 0 ? .7 + .45 * wtop : wall < 0 ? .62 : .92) - v) * Math.min(.9, Math.max(slope, cl * (wall ? .95 : .7)));
      D[i * 4 + ch] = v * k > 255 ? 255 : v * k; }
    D[i * 4 + 3] = 255; }
  const lo = document.createElement('canvas'); lo.width = W; lo.height = H; lo.getContext('2d').putImageData(img, 0, 0);
  const cv = document.createElement('canvas'); cv.width = G.w * TS * OUT; cv.height = G.h * TS * OUT; const x = cv.getContext('2d');
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(lo, 0, 0, cv.width, cv.height);
  // 고운 질감: 무작위 점 타일을 겹침 합성으로 덮는다
  const gr = document.createElement('canvas'); gr.width = gr.height = 128; const gx2 = gr.getContext('2d'), gi = gx2.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) { const v = 128 + (r() - .5) * 70; gi.data[i * 4] = gi.data[i * 4 + 1] = gi.data[i * 4 + 2] = v; gi.data[i * 4 + 3] = 255; }
  gx2.putImageData(gi, 0, 0); x.globalCompositeOperation = 'overlay'; x.globalAlpha = .32; x.fillStyle = x.createPattern(gr, 'repeat'); x.fillRect(0, 0, cv.width, cv.height);
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.setTransform(OUT, 0, 0, OUT, 0, 0); const CW2 = G.w * TS, CH2 = G.h * TS; // 장식은 월드 px 좌표로
  // 장식: 자잘한 돌, 풀·얼음·덤불, 암벽 균열. 통행 판정과 무관하게 아주 작게만 그린다.
  const dec = RTS.TERRAIN_DECOR[themeId] || RTS.TERRAIN_DECOR.dusk, at = (px, py) => { const i = Math.min(H - 1, Math.max(0, py / SC | 0)) * W + Math.min(W - 1, Math.max(0, px / SC | 0)); return { ro: Math.max(cov[i], cliffV ? cliffV[i] : 0), tp: top[i], sa: sand[i] }; };
  for (let n = 0; n < G.w * G.h * (low ? .25 : .5); n++) { const px = r() * CW2, py = r() * CH2, q = at(px, py); if (q.ro > .05) continue;
    const z = 1 + r() * 2.2; x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(px + 1, py + 1, z * 1.2, z * .8, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = dec.pebble[0]; x.beginPath(); x.ellipse(px, py, z * 1.1, z * .75, r() * 3, 0, Math.PI * 2); x.fill();
    x.fillStyle = dec.pebble[1]; x.beginPath(); x.ellipse(px - z * .3, py - z * .3, z * .5, z * .32, 0, 0, Math.PI * 2); x.fill(); }
  x.lineCap = 'round';
  for (let n = 0; n < G.w * G.h * (low ? .16 : .32); n++) { const px = r() * CW2, py = r() * CH2, q = at(px, py); if (q.ro > .05 || (dec.kind === 'grass' && q.sa > .4)) continue;
    const c = dec.tuft[(r() * 3) | 0], m = 3 + (r() * 4 | 0);
    if (dec.kind === 'grass' || dec.kind === 'dry') { x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1.2; x.beginPath(); x.ellipse(px + 1.5, py + 1, 4, 1.6, 0, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = c; x.lineWidth = dec.kind === 'dry' ? 1 : 1.3; for (let j = 0; j < m; j++) { const a = -Math.PI / 2 + (r() - .5) * 1.6, l = 3 + r() * (dec.kind === 'dry' ? 6 : 5); x.beginPath(); x.moveTo(px + (r() - .5) * 3, py); x.quadraticCurveTo(px + Math.cos(a) * l * .5, py + Math.sin(a) * l * .6, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); } }
    else { x.fillStyle = 'rgba(20,30,45,.3)'; x.beginPath(); x.ellipse(px + 2, py + 1.5, 4, 2, 0, 0, Math.PI * 2); x.fill(); // 얼음 조각·눈 더미
      x.fillStyle = c; x.beginPath(); x.moveTo(px - 3, py + 1); x.lineTo(px - 1, py - 3 - r() * 3); x.lineTo(px + 1, py - 1); x.lineTo(px + 3, py - 4 - r() * 2); x.lineTo(px + 4, py + 1); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(px - 1, py - 2, 1, 1); } }
  x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 1; // 암벽 윗면 균열
  for (let n = 0; n < G.w * G.h * .25; n++) { let px = r() * CW2, py = r() * CH2; if (at(px, py).tp < .9) continue; x.beginPath(); x.moveTo(px, py);
    for (let j = 0; j < 4; j++) { px += (r() - .5) * 14; py += (r() - .5) * 10; if (at(px, py).tp < .8) break; x.lineTo(px, py); } x.stroke(); }
  // 앞을 가리는 암벽 조각(cv.over): 윗면 가운데 북쪽 가장자리 띠(바닥 칸 위로 솟은 부분 + 그 아래 NB px)만 떼어 2×1칸 조각으로 저장한다.
  //   key = 그 조각 아래 암벽의 남쪽 끝(칸). render.js가 건물·유닛과 함께 위→아래 순서로 그려, 암벽 북쪽(뒤)에 선 것을 가린다.
  const NB = Math.round(26 / SC), om = new Uint8ClampedArray(N * 4); let any = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, north = y - NB >= 0 ? rockFoot[i - NB * W] : 1, v = top[i] * (1 - north); if (v > .05) { om[i * 4 + 3] = Math.min(255, v * 400); any = 1; } }
  cv.over = []; if (!any) return cv;
  const mk = document.createElement('canvas'); mk.width = W; mk.height = H; mk.getContext('2d').putImageData(new ImageData(om, W, H), 0, 0);
  const CWt = 2, tileRock = (tx, ty) => tx < 0 || ty < 0 || tx >= G.w || ty >= G.h || G.tiles[ty * G.w + tx] === 1;
  for (let ty = 0; ty < G.h; ty++) for (let tx = 0; tx < G.w; tx += CWt) { // 이 조각 안에 마스크 픽셀이 있는지(낮은 해상도에서 확인)
    const x0 = tx * TS / SC, y0 = ty * TS / SC, w0 = CWt * TS / SC, h0 = TS / SC; let has = false;
    for (let yy = y0; yy < y0 + h0 && !has; yy++) for (let xx = x0; xx < Math.min(W, x0 + w0); xx++) if (om[(yy * W + xx) * 4 + 3] > 12) { has = true; break; }
    if (!has) continue; let key = Infinity;
    for (let cx = tx; cx < tx + CWt; cx++) { let k = ty; while (k < G.h && tileRock(cx, k)) k++; if (k > ty || tileRock(cx, ty + 1)) { if (k === ty) { k = ty + 1; while (k < G.h && tileRock(cx, k)) k++; } key = Math.min(key, k); } }
    if (!isFinite(key)) key = ty + 1;
    // 가장자리 2px 여백을 함께 복사해 두고 안쪽만 그린다(확대할 때 조각 경계에서 이웃 픽셀을 섞어 이음매가 보이지 않게)
    const PD = 2, pw = Math.ceil(CWt * TS * OUT), ph = Math.ceil(TS * OUT), pc = document.createElement('canvas'); pc.width = pw + PD * 2; pc.height = ph + PD * 2; const u = pc.getContext('2d');
    u.drawImage(cv, tx * TS * OUT - PD, ty * TS * OUT - PD, pw + PD * 2, ph + PD * 2, 0, 0, pw + PD * 2, ph + PD * 2); u.globalCompositeOperation = 'destination-in'; u.imageSmoothingEnabled = true;
    const mpx = OUT * TS / (TS / SC); u.drawImage(mk, x0 - PD / mpx, y0 - PD / mpx, w0 + PD * 2 / mpx, h0 + PD * 2 / mpx, 0, 0, pw + PD * 2, ph + PD * 2);
    cv.over.push({ x: tx * TS, y: ty * TS, w: CWt * TS, h: TS, key, cv: pc, pd: PD, pw, ph }); }
  return cv;
};
