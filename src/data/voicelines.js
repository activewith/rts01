// 유닛 대답 대사(말풍선 글자이자 음성 원고).
// - 개척단(사람): 유닛마다 고를 때(select)·이동할 때(move)·공격할 때(attack) 2줄씩. 녹음 파일이 있으면 파일, 없으면 기기 한국어 음성(TTS), 그것도 없으면 합성 말소리로 낸다.
// - 철갑회·포자군락: 진영 공통 대사. 소리는 합성 말소리(기계음·벌레 소리)로 내고 글자는 말풍선으로만 보인다.
// 녹음 파일: voice/<유닛>-<종류>-<번호>.mp3 (예: voice/p_rifle-select-1.mp3). node build.js가 voice 폴더를 읽어 있는 파일만 RTS.VOICE_FILES에 넣는다.
RTS.VOICE_KINDS = ['select', 'move', 'attack'];
RTS.UNIT_LINES = {
  p_worker:   { select: ['공병입니다.', '무엇을 지을까요?'], move: ['알겠습니다.', '바로 가겠습니다.'], attack: ['저도 싸웁니다!', '연장 들고 갑니다!'] },
  p_rifle:    { select: ['소총병, 준비됐습니다.', '명령을 내려 주십시오.'], move: ['이동합니다.', '알겠습니다!'], attack: ['공격 개시!', '사격하라!'] },
  p_gren:     { select: ['척탄병입니다.', '폭탄 준비 완료.'], move: ['이동하겠습니다.', '그쪽으로 갑니다.'], attack: ['수류탄 투척!', '날려 버리겠습니다!'] },
  p_medic:    { select: ['의무병입니다.', '다친 사람 있나요?'], move: ['따라가겠습니다.', '이동합니다.'], attack: ['뒤에서 지원합니다!', '제가 치료할게요!'] },
  p_tank:     { select: ['포격전차, 대기 중.', '포탄 장전 완료.'], move: ['전차 이동.', '알겠다, 출발한다.'], attack: ['포격 개시!', '목표 조준, 발사!'] },
  p_gunship:  { select: ['강습기, 비행 중.', '하늘은 맡겨 주십시오.'], move: ['항로 변경.', '날아가겠습니다.'], attack: ['공습 개시!', '목표 포착!'] },
  p_commando: { select: ['특공대, 출동 준비.', '어려운 임무도 좋습니다.'], move: ['조용히 이동한다.', '바로 간다.'], attack: ['돌격!', '특공대가 간다!'] },
  p_titan:    { select: ['거대로봇, 가동.', '모든 장비 정상.'], move: ['전진한다.', '길을 비켜라.'], attack: ['전부 쓸어버린다!', '충격파 발사!'] },
  ironclad: { select: ['명령 대기.', '삐빅. 준비 완료.', '연결됨.'], move: ['경로 계산 완료.', '이동 실행.', '좌표 확인.'], attack: ['목표 제거.', '공격 실행.', '적 발견. 처리한다.'] },
  swarm:    { select: ['끼릭?', '스스스…', '꾸르륵.'], move: ['끼릭 끼릭.', '스르르륵.', '쉬익.'], attack: ['캬아악!', '크르릉!', '끼에엑!'] },
};
// 유닛 대답 줄 고르기: 유닛 정의 → 진영 공통 순서. 같은 줄이 연달아 나오지 않게 한다
RTS.pickLine = function (def, faction, kind, last) {
  const set = RTS.UNIT_LINES[def] || RTS.UNIT_LINES[faction]; if (!set) return null;
  const list = set[kind] || set.select; if (!list || !list.length) return null;
  let i = Math.floor(Math.random() * list.length); if (list.length > 1 && last === (RTS.UNIT_LINES[def] ? def : faction) + '-' + kind + '-' + (i + 1)) i = (i + 1) % list.length;
  const own = !!RTS.UNIT_LINES[def];
  return { id: (own ? def : faction) + '-' + kind + '-' + (i + 1), text: list[i], person: own && faction === 'pioneers' };
};
RTS.VOICE_FILES = RTS.VOICE_FILES || {}; // node build.js가 채운다
RTS.VOICE_BASE = RTS.VOICE_BASE || ''; // 게임을 다른 폴더에 끼워 넣을 때 voice 폴더 위치
