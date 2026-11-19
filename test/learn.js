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
console.log('학습 문제 검사 통과', Object.entries(seen).map(([k, v]) => k + ':' + v.size).join(' '));
