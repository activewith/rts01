// 소리: 대사 음절 분해(한글 모음·첫소리·받침·쉼표), 캐릭터 목소리 고르기, 곡·알림 데이터 형식
const fs = require('fs'), path = require('path'), assert = require('assert');
global.RTS = {}; for (const f of ['ui/music', 'ui/sound', 'data/voicelines']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
const sy = RTS.syllables('아이, 가방?');
assert.deepEqual(sy.map(s => s.v), [0, 20, 0, 0], '모음: ㅏ ㅣ ㅏ ㅏ'); assert(!sy[0].on && sy[2].on, 'ㅇ은 첫소리 없음'); assert(sy[3].fin && !sy[2].fin, '받침'); assert(sy[1].pause > 0 && sy[3].ask, '쉼표·물음표');
assert.equal(RTS.syllables('가'.repeat(100), 34).length, 34, '길이 제한');
assert.equal(RTS.voiceOf('대장 한별').pitch, 118); assert(RTS.voiceOf('연산핵 오르도').robot, '로봇 목소리'); assert(RTS.voiceOf('철갑회 통신').radio, '무전');
assert.equal(RTS.voiceOf('모르는 사람', 'swarm').pitch, RTS.VOICES.swarm.pitch, '이름 없으면 진영 목소리'); assert(RTS.voiceOf('포자군락(홀린 자)').echo, '홀린 자는 메아리');
for (const [k, s] of Object.entries(RTS.MUSIC_SONGS)) { assert(s.bpm > 0 && s.chords.length && s.bass.length === s.chords.length && s.arp.length === 16, k + ' 형식');
  for (const bar of s.lead || []) assert.equal(bar.length, 16, k + ' 선율 16칸'); }
for (const f of ['pioneers', 'ironclad', 'swarm']) assert(RTS.MUSIC_SONGS[f], f + ' 테마곡');
assert(RTS.VOWEL_F.length === 21);
// 유닛 대답 대사: 개척단 유닛(합체 포함) 모두 종류마다 2줄 이상, 줄 id가 녹음 파일 이름 규칙과 같다
const content = fs.readFileSync(path.join(__dirname, '../src/data/content.js'), 'utf8'), pUnits = [...content.matchAll(/^\s*(p_[a-z]+):\s*(?:\{ kind: 'unit'|RTS\.fuseDef)/gm)].map(m => m[1]);
assert(pUnits.length >= 8, '개척단 유닛 목록'); for (const id of pUnits) for (const k of RTS.VOICE_KINDS) assert(RTS.UNIT_LINES[id] && RTS.UNIT_LINES[id][k].length >= 2, id + ' ' + k + ' 대사');
for (const f of ['ironclad', 'swarm']) for (const k of RTS.VOICE_KINDS) assert(RTS.UNIT_LINES[f][k].length, f + ' 공통 대사');
const L1 = RTS.pickLine('p_rifle', 'pioneers', 'attack'); assert(/^p_rifle-attack-[12]$/.test(L1.id) && L1.person, '개척단 줄 id');
const L2 = RTS.pickLine('i_blade', 'ironclad', 'move'); assert(/^ironclad-move-\d$/.test(L2.id) && !L2.person, '철갑회는 진영 공통·사람 음성 아님');
for (let i = 0; i < 30; i++) { const a = RTS.pickLine('p_tank', 'pioneers', 'select'), b = RTS.pickLine('p_tank', 'pioneers', 'select', a.id); assert.notEqual(a.id, b.id, '같은 줄 연달아 안 나옴'); }
assert.equal(RTS.pickLine('t_warrior', 'tribe', 'select'), null, '대사 없는 유닛');
console.log('소리 검사 통과');
