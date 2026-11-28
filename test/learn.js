// 학습 미션: 과목·수준별 문제 생성(보기 4개, 정답 1개, 겹침 없음), 문항 은행 형식, 관문 위치
const fs = require('fs'), path = require('path'), assert = require('assert');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','engine/net','engine/campaign','data/content','data/settings','data/campaign','data/learn']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const seen = {};
for (const sub of ['math', 'ko', 'life']) for (let lv = 0; lv <= 3; lv++) for (let i = 0; i < 300; i++) { const Q = RTS.learnQuestion(sub, lv, rnd);
  assert.equal(Q.subject, sub); assert.equal(Q.choices.length, 4, `${sub} ${lv} 보기 4개: ${Q.q}`); assert.equal(new Set(Q.choices).size, 4, `${sub} ${lv} 보기 겹침: ${Q.q} ${Q.choices}`);
  assert(Q.ans >= 0 && Q.ans < 4, `${sub} 정답 위치: ${Q.q}`); assert(Q.q && Q.why, '문제·설명'); (seen[sub + lv] = seen[sub + lv] || new Set()).add(Q.q + Q.choices[Q.ans]); }
for (const k of Object.keys(seen)) assert(seen[k].size >= 6, k + ' 문제 종류가 너무 적음 ' + seen[k].size);
for (const sub of ['ko', 'life']) for (const it of RTS.LEARN_BANK[sub]) { assert(it.lv[0] <= it.lv[1] && it.w.length >= 3 && !it.w.includes(it.a) && it.why, sub + ' 문항 형식: ' + it.q); }
const subs = new Set(); for (let i = 0; i < 60; i++) subs.add(RTS.learnQuestion('any', 1, rnd).subject); assert.equal(subs.size, 3, '무작위 과목');
assert.equal(RTS.learnGate(RTS.campDef('p1')), 'before'); assert.equal(RTS.learnGate(RTS.campDef('p2')), 'after');
// 보호자 잠금 설정: 학습 설정은 모두 parent·client 항목이고 기본값은 학습 켬·찍기 방지(틀리면 대기)·대기 10초
{ const G = RTS.SETTINGS.find(g => g.parent), ids = G.items.map(x => x.id); assert.deepEqual(ids, ['playLimit', 'playMin', 'restMin', 'playWhen', 'playGrace', 'dayMax', 'learn', 'learnLevel', 'learnGuard', 'learnWait', 'learnHint']); assert(G.items.every(x => x.parent && x.client));
  const d = RTS.defaultSettings(); assert(d.learn === true && d.learnGuard === 1 && d.learnWait === 10 && d.learnLevel === 1 && d.learnHint === true);
  assert(!RTS.SETTINGS.filter(g => !g.parent).some(g => g.items.some(x => x.parent)), '보호자 항목은 보호자 묶음에만'); }
// 학습 난이도 단계: 캠페인 진행·난이도에 따라 오른다. 단계가 달라도 보기 4개·정답 1개·겹침 없음
{ const order = ['p1', 'p2', 'p3', 'p4', 'p5', 'd1', 'd2', 'd3', 'd4', 'd5'].filter(id => RTS.campDef(id)); let prev = -2;
  for (const id of order) { const v = RTS.learnStep(RTS.campDef(id), 'normal'); assert(v > prev, id + ' 단계가 앞 미션보다 높다 ' + v); prev = v; }
  for (const id of ['p1', 'd5']) { const M = RTS.campDef(id), e = RTS.learnStep(M, 'easy'), n = RTS.learnStep(M, 'normal'), h = RTS.learnStep(M, 'hard'); assert(e < n && n < h, id + ' 쉬움 < 보통 < 어려움'); }
  const lastM = RTS.CAMPAIGN.groups.find(g => g.kind === 'deep').missions.slice(-1)[0]; assert(RTS.learnStep(lastM, 'hard') >= .9, '최종장은 가장 어렵다');
  console.log('단계: 1인 1장 쉬움', RTS.learnStep(RTS.campDef('p1'), 'easy').toFixed(2), '/ 1인 5장 보통', RTS.learnStep(RTS.campDef('p5'), 'normal').toFixed(2), '/ 2인 5장 어려움', RTS.learnStep(RTS.campDef('d5'), 'hard').toFixed(2), '/ 최종장', RTS.learnStep(lastM, 'hard').toFixed(2));
  for (const st of [-1, -.5, .5, 1]) for (const sub of ['math', 'ko', 'life']) for (let lv = 0; lv <= 3; lv++) for (let i = 0; i < 200; i++) { const Q = RTS.learnQuestion(sub, lv, rnd, st);
    assert.equal(new Set(Q.choices).size, 4, `단계 ${st} ${sub} ${lv} 보기: ${Q.q}`); assert(Q.ans >= 0 && Q.ans < 4); }
  // 수학 문제 속 수의 크기 평균: 어려울수록 크다(같은 수준, 위·아래 수준 섞기는 빼고)
  const mix = RTS.LEARN_STEP.mix; RTS.LEARN_STEP.mix = 0;
  for (let lv = 0; lv <= 3; lv++) { const avg = st => { let t = 0, n = 0; for (let i = 0; i < 2000; i++) { const Q = RTS.learnQuestion('math', lv, rnd, st), nums = (Q.q.match(/\d+(\.\d+)?/g) || []).map(Number); if (nums.length) { t += nums.reduce((a, b) => a + b, 0) / nums.length; n++; } } return t / n; };
    const a = avg(-1), b = avg(0), c = avg(1); assert(a < b && b < c, `수학 ${lv} 수 크기 ${a.toFixed(1)} < ${b.toFixed(1)} < ${c.toFixed(1)}`); console.log(`수학 수준 ${lv} 문제 속 수 평균: 쉽게 ${a.toFixed(1)} · 기본 ${b.toFixed(1)} · 어렵게 ${c.toFixed(1)}`); }
  RTS.LEARN_STEP.mix = mix;
  // 위 수준 섞임: 단계 1이면 수준 0에서 수준 1 문제(두 자리 덧셈 등)가 나온다
  let up = 0; for (let i = 0; i < 1000; i++) { const Q = RTS.learnQuestion('math', 0, rnd, 1); if (/\d{2} [+−×]|×|시\?|10이/.test(Q.q)) up++; } assert(up > 150 && up < 600, '위 수준 섞임 ' + up);
  // 부족 수학 미션: 단계가 달라도 답 범위 1~350
  for (const st of [-1, 1]) for (const id of Object.keys(RTS.defs.tribeMissions)) { const d = RTS.defs.tribeMissions[id]; if (!d.quiz) continue;
    for (let lv = d.lv[0]; lv <= d.lv[1]; lv++) for (let i = 0; i < 200; i++) { const k = st * .5, ri = (a, b) => { let u = rnd(); u = k >= 0 ? k + u * (1 - k) : u * (1 + k); return a + Math.min(b - a, Math.floor(u * (b - a + 1))); };
      const [q, ans] = d.quiz({ tick: 0 }, lv, ri); assert(Number.isInteger(ans) && ans >= 1 && ans <= 350, `${id} 단계 ${st} 답 범위 ${q} = ${ans}`); } } }
console.log('학습 문제 검사 통과', Object.entries(seen).map(([k, v]) => k + ':' + v.size).join(' '));
