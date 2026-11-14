// terrain.js — 지형 굽기(화면 전용). 게임 시작 때 한 번 계산해 큰 그림 한 장으로 만든다.
// 높이맵 → 햇빛(왼쪽 위) 명암 → 절벽 그림자 → 절벽 기슭 어두움 → 질감·자잘한 돌·풀.
// 타일 판정(통행)은 그대로이고 그림만 바뀐다. 시드는 G.seed라 두 기기에서 같은 그림이 나온다(달라도 게임에는 영향 없음).
RTS.TERRAIN_DECOR = { // 테마별 장식: 풀(grass), 얼음 조각(ice), 마른 덤불(dry), 이끼 포자(spore)
  dusk: { kind: 'grass', tuft: ['#4f7466', '#5f8576', '#3d5f55'], pebble: ['#27353d', '#4a5f66'] },
  ochre: { kind: 'dry', tuft: ['#8c6a3c', '#a17a46', '#5e4428'], pebble: ['#3c2a20', '#8d6b4a'] },
  frost: { kind: 'ice', tuft: ['#d8e6f0', '#eef6fb', '#b6cada'], pebble: ['#3a4a5e', '#8fa3b6'] },
  moss: { kind: 'grass', tuft: ['#5d8a4e', '#6f9c5c', '#3f6538'], pebble: ['#232c25', '#4b5a48'] },
};
RTS.bakeTerrainHD = function (G, th, themeId) {
  const TS = 32, SC = 2, W = G.w * TS / SC, H = G.h * TS / SC, N = W * H;
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
  const rockV = field(1), sandV = field(2);
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const rock = new Float32Array(N), sand = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, n = cg(nC, x, y) - .5;
    rock[i] = ss(.42, .58, rockV[i] + n * .3); sand[i] = ss(.25, .75, sandV[i] + n * .5); }
  // 높이: 암벽 윗면(남쪽 절벽면 띠만큼 위로 깎음) + 울퉁불퉁 + 모래 물결
  const FB = 9, HC = 30, Hf = new Float32Array(N), top = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, b = cg(nB, x, y), a = cg(nA, x, y);
    const tp = y + FB < H ? rock[i + FB * W] * rock[i] : rock[i]; top[i] = tp;
    const c2 = cg(nC, x, y), hz = T[((y * 7 + x * 13) & 65535)] - .5; // 암벽 윗면: 능선(ridged) + 거친 결
    Hf[i] = rock[i] * HC + tp * ((b - .5) * 12 + (1 - Math.abs(c2 * 2 - 1)) * 9 + hz * 2.2) + (1 - rock[i]) * ((a - .5) * 6 + (b - .5) * 2.5 - sand[i] * 2); }
  const L = [-.52, -.62, .58], Ll = Math.hypot(...L); L[0] /= Ll; L[1] /= Ll; L[2] /= Ll; // 햇빛 방향(빛 쪽을 향함): 왼쪽 위
  const tanE = L[2] / Math.hypot(L[0], L[1]), sx = L[0] / Math.hypot(L[0], L[1]), sy = L[1] / Math.hypot(L[0], L[1]);
  const img = new ImageData(W, H), D = img.data;
  const mix = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
  const dry = mix(gP[0], sP[0], .4), lush = mix(gP[2], [gP[2][0] * .9, gP[2][1] * 1.08, gP[2][2] * .95], .6);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, a = cg(nA, x, y), b = cg(nB, x, y), ro = rock[i], tp = top[i], face = Math.max(0, ro - tp);
    // 명암(법선·햇빛). 평지 = 1
    const xl = x > 0 ? i - 1 : i, xr = x < W - 1 ? i + 1 : i, yu = y > 0 ? i - W : i, yd = y < H - 1 ? i + W : i;
    const gx = (Hf[xr] - Hf[xl]) * .5, gy = (Hf[yd] - Hf[yu]) * .5, nl = Math.sqrt(gx * gx + gy * gy + SC * SC);
    let sh = ((-gx * L[0] - gy * L[1] + SC * L[2]) / nl) / L[2]; sh = Math.min(1.55, Math.max(.35, 1 + (sh - 1) * 1.25));
    // 그림자: 햇빛 쪽으로 걸어가며 더 높은 지형이 있으면 가림(부드럽게)
    let occ = 0; if (ro < .5) { const h0 = Hf[i];
      for (let k = 2; k <= 26; k += 2) { const qx = Math.round(x + sx * k), qy = Math.round(y + sy * k); if (qx < 0 || qy < 0 || qx >= W || qy >= H) break;
        const d = Hf[qy * W + qx] - (h0 + k * SC * tanE); if (d > 0) { occ = Math.max(occ, Math.min(1, d / 6)); if (occ >= 1) break; } } }
    const ao = 1 - .4 * Math.min(1, Math.max(0, (rockV[i] - ro) * 2.4)) * (1 - ro); // 절벽 기슭
    // 색: 땅(얼룩·마른 땅·짙은 곳) → 모래 → 암벽 윗면 / 절벽면. 표본마다 배열을 만들지 않도록 채널별로 계산한다.
    const wA = ss(.3, .7, a), wB = ss(.45, .7, b) * .6, wD = ss(.6, .78, b * .6 + a * .4) * .55, wL = ss(.62, .82, 1 - b) * .35, wS1 = ss(.3, .7, b), wS2 = ss(.55, .8, a) * .5, wR1 = ss(.35, .75, b), wR2 = ss(.5, .8, a) * .4;
    const sa = sand[i], rfk = .35 + .125 * Math.sin(y * SC * .55 + b * 14) + .15 * (b - .5), fpos = y + (FB >> 1) < H ? rock[i + (FB >> 1) * W] : 1, fmul = .62 + .3 * fpos, wF = Math.min(1, face * 1.2); // 절벽면 층리, 띠 위쪽은 조금 밝게
    const k = (face > .3 ? 1 : sh) * (1 - occ * .52) * ao * (.9 + .2 * a);
    for (let ch = 0; ch < 3; ch++) { let v = gP[1][ch] + (gP[2][ch] - gP[1][ch]) * wA; v += (gP[0][ch] - v) * wB; v += (dry[ch] - v) * wD; v += (lush[ch] - v) * wL;
      let sv = sP[1][ch] + (sP[2][ch] - sP[1][ch]) * wS1; sv += (sP[0][ch] - sv) * wS2; v += (sv - v) * sa;
      let rv = rP[1][ch] + (rP[2][ch] - rP[1][ch]) * wR1; rv += (rP[0][ch] - rv) * wR2; v += (rv - v) * tp;
      if (face > 0) v += ((rP[0][ch] + (rP[1][ch] - rP[0][ch]) * rfk) * fmul - v) * wF;
      D[i * 4 + ch] = v * k > 255 ? 255 : v * k; }
    D[i * 4 + 3] = 255; }
  const lo = document.createElement('canvas'); lo.width = W; lo.height = H; lo.getContext('2d').putImageData(img, 0, 0);
  const cv = document.createElement('canvas'); cv.width = G.w * TS; cv.height = G.h * TS; const x = cv.getContext('2d');
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(lo, 0, 0, cv.width, cv.height);
  // 고운 질감: 무작위 점 타일을 겹침 합성으로 덮는다
  const gr = document.createElement('canvas'); gr.width = gr.height = 128; const gx2 = gr.getContext('2d'), gi = gx2.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) { const v = 128 + (r() - .5) * 70; gi.data[i * 4] = gi.data[i * 4 + 1] = gi.data[i * 4 + 2] = v; gi.data[i * 4 + 3] = 255; }
  gx2.putImageData(gi, 0, 0); x.globalCompositeOperation = 'overlay'; x.globalAlpha = .32; x.fillStyle = x.createPattern(gr, 'repeat'); x.fillRect(0, 0, cv.width, cv.height);
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  // 장식: 자잘한 돌, 풀·얼음·덤불, 암벽 균열. 통행 판정과 무관하게 아주 작게만 그린다.
  const dec = RTS.TERRAIN_DECOR[themeId] || RTS.TERRAIN_DECOR.dusk, at = (px, py) => { const i = Math.min(H - 1, py / SC | 0) * W + Math.min(W - 1, px / SC | 0); return { ro: rock[i], tp: top[i], sa: sand[i] }; };
  for (let n = 0; n < G.w * G.h * .5; n++) { const px = r() * cv.width, py = r() * cv.height, q = at(px, py); if (q.ro > .05) continue;
    const z = 1 + r() * 2.2; x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(px + 1, py + 1, z * 1.2, z * .8, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = dec.pebble[0]; x.beginPath(); x.ellipse(px, py, z * 1.1, z * .75, r() * 3, 0, Math.PI * 2); x.fill();
    x.fillStyle = dec.pebble[1]; x.beginPath(); x.ellipse(px - z * .3, py - z * .3, z * .5, z * .32, 0, 0, Math.PI * 2); x.fill(); }
  x.lineCap = 'round';
  for (let n = 0; n < G.w * G.h * .32; n++) { const px = r() * cv.width, py = r() * cv.height, q = at(px, py); if (q.ro > .05 || (dec.kind === 'grass' && q.sa > .4)) continue;
    const c = dec.tuft[(r() * 3) | 0], m = 3 + (r() * 4 | 0);
    if (dec.kind === 'grass' || dec.kind === 'dry') { x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1.2; x.beginPath(); x.ellipse(px + 1.5, py + 1, 4, 1.6, 0, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = c; x.lineWidth = dec.kind === 'dry' ? 1 : 1.3; for (let j = 0; j < m; j++) { const a = -Math.PI / 2 + (r() - .5) * 1.6, l = 3 + r() * (dec.kind === 'dry' ? 6 : 5); x.beginPath(); x.moveTo(px + (r() - .5) * 3, py); x.quadraticCurveTo(px + Math.cos(a) * l * .5, py + Math.sin(a) * l * .6, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); } }
    else { x.fillStyle = 'rgba(20,30,45,.3)'; x.beginPath(); x.ellipse(px + 2, py + 1.5, 4, 2, 0, 0, Math.PI * 2); x.fill(); // 얼음 조각·눈 더미
      x.fillStyle = c; x.beginPath(); x.moveTo(px - 3, py + 1); x.lineTo(px - 1, py - 3 - r() * 3); x.lineTo(px + 1, py - 1); x.lineTo(px + 3, py - 4 - r() * 2); x.lineTo(px + 4, py + 1); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(px - 1, py - 2, 1, 1); } }
  x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 1; // 암벽 윗면 균열
  for (let n = 0; n < G.w * G.h * .25; n++) { let px = r() * cv.width, py = r() * cv.height; if (at(px, py).tp < .9) continue; x.beginPath(); x.moveTo(px, py);
    for (let j = 0; j < 4; j++) { px += (r() - .5) * 14; py += (r() - .5) * 10; if (at(px, py).tp < .8) break; x.lineTo(px, py); } x.stroke(); }
  return cv;
};
