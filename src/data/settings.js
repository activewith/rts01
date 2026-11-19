// settings.js — 설정 항목 정의. 항목을 추가하면 설정 메뉴에 자동으로 나타난다.
// 코드에서는 RTS.cfg(G).키 로 읽는다. startOnly는 새 게임부터, client는 이 브라우저 전용(시뮬레이션과 무관).
RTS.SETTINGS = [
  { group: '게임', items: [
    { id: 'startOre', label: '시작 광석', min: 0, max: 1000, step: 50, def: 100, startOnly: true },
    { id: 'startGas', label: '시작 에테르', min: 0, max: 500, step: 25, def: 0, startOnly: true },
    { id: 'supplyCap', label: '최대 보급', min: 40, max: 200, step: 10, def: 100 },
    { id: 'fog', label: '전장의 안개', type: 'toggle', def: true, startOnly: true },
    { id: 'randomStart', label: '시작 위치 무작위', desc: '맵마다 시작 위치 후보 4곳 이상 중에서 무작위로 고릅니다. 끄면 예전처럼 맵의 기본 두 자리(대각 대치)', type: 'toggle', def: true, startOnly: true },
    { id: 'mathLevel', label: '부족 수학 문제 수준', desc: '잿빛 부족 외교 미션의 문제. 1~2학년: 두 자리 덧셈·뺄셈, 2~5단, 자릿값 / 3~4학년: 세 자리, 구구단, 나눗셈 / 5~6학년: 혼합 계산, 분수', min: 1, max: 3, step: 1, def: 1, labels: ['1~2학년', '3~4학년', '5~6학년'] },
  ] },
  { group: '시장 뉴스', items: [
    { id: 'newsEvery', label: '뉴스 평균 간격', desc: '실제 간격은 이 값의 ±33%에서 무작위로 정해집니다', min: 0, max: 180, step: 10, def: 60, unit: '초', zero: '뉴스 없음' },
    { id: 'newsImpact', label: '뉴스 영향 강도', desc: '뉴스가 주가와 실적을 바꾸는 폭', min: 0, max: 300, step: 10, def: 100, unit: '%' },
  ] },
  { group: '주식시장', items: [
    { id: 'volatility', label: '주가 변동성', min: 0, max: 300, step: 10, def: 100, unit: '%' },
    { id: 'divSec', label: '배당 주기', min: 10, max: 120, step: 5, def: 30, unit: '초' },
    { id: 'divRate', label: '배당 규모', min: 0, max: 300, step: 10, def: 100, unit: '%' },
    { id: 'impact', label: '주당 매매 충격', desc: '한 주를 사고팔 때 주가가 움직이는 폭', min: 0, max: 3, step: .1, def: .8, unit: '%' },
    { id: 'fee', label: '매도 수수료', min: 0, max: 20, step: 1, def: 3, unit: '%' },
  ] },
  { group: '경영권', items: [
    { id: 'control', label: '인수에 필요한 주식', desc: '회사당 총 100주', min: 51, max: 90, step: 1, def: 51, unit: '주' },
    { id: 'ctrlBonus', label: '지배 주주 배당', min: 100, max: 300, step: 10, def: 150, unit: '%' },
    { id: 'minority', label: '소수 주주 배당', min: 0, max: 100, step: 10, def: 50, unit: '%' },
  ] },
  { group: '기지 전투 피해', note: '기지의 건물과 일꾼이 맞을 때마다 피해액을 계산합니다. 피해액은 잃은 가치에 기지 등급과 자원 가중을 곱한 값입니다.', items: [
    { id: 'warMain', label: '본진 피해 배수', min: 0, max: 300, step: 10, def: 150, unit: '%' },
    { id: 'warSat', label: '위성 기지 피해 배수', min: 0, max: 300, step: 10, def: 100, unit: '%' },
    { id: 'warRes', label: '자원 많은 기지 가중', desc: '주변 자원이 풍부할수록 피해액 증가', min: 0, max: 200, step: 10, def: 50, unit: '%' },
    { id: 'warEff', label: '채취 효율 손실', desc: '피해 기지의 자원 수입 감소폭', min: 0, max: 300, step: 10, def: 100, unit: '%' },
    { id: 'warRecover', label: '효율 1% 회복 시간', desc: '교전 10초 후부터 회복', min: 1, max: 10, step: 1, def: 1, unit: '초' },
    { id: 'warCredit', label: '신용 하락', desc: '진영 신용만큼 내 배당이 줄어듭니다', min: 0, max: 300, step: 10, def: 100, unit: '%' },
    { id: 'warMarket', label: '증시 반응', desc: '피해액에 비례해 전 종목 하락', min: 0, max: 300, step: 10, def: 100, unit: '%' },
    { id: 'warSupply', label: '공급 차질 특수', desc: '자원 기지가 맞으면 해당 자원 회사 실적 상승', min: 0, max: 300, step: 10, def: 100, unit: '%' },
    { id: 'warLoot', label: '공격자 약탈', desc: '입힌 피해액 중 광석으로 얻는 비율', min: 0, max: 50, step: 5, def: 10, unit: '%' },
  ] },
  { group: '사령부 전부 상실', note: '남은 사령부가 하나도 없게 될 때 한 번 발동합니다. 다른 건물이 남아 있으면 게임은 계속됩니다.', items: [
    { id: 'warCrash', label: '본진 함락 시 증시 하락', desc: '전 종목에 즉시 적용', min: 0, max: 60, step: 5, def: 15, unit: '%' },
    { id: 'warSell', label: '패전 진영 지분 강제 매각', desc: '보유 주식 중 시장에 풀리는 비율', min: 0, max: 100, step: 10, def: 50, unit: '%' },
    { id: 'warHaircut', label: '강제 매각 할인', desc: '시세에서 깎이고 남은 금액만 받습니다', min: 0, max: 100, step: 10, def: 40, unit: '%' },
    { id: 'warRebuild', label: '재건 특수', desc: '광석 회사 실적 상승', min: 0, max: 100, step: 5, def: 15, unit: '%' },
    { id: 'warAlly', label: '패전 진영 동맹 해제', desc: '자유상단 동맹과 출자금이 사라집니다', type: 'toggle', def: true },
    { id: 'siteImpact', label: '거점 피격 주가 영향', min: 0, max: 300, step: 10, def: 100, unit: '%' },
    { id: 'siteDown', label: '거점 가동 중단 시간', min: 10, max: 120, step: 5, def: 40, unit: '초' },
  ] },
  { group: '자유상단', items: [
    { id: 'firstBonus', label: '최초 발견 수락 확률 보너스', min: 0, max: 40, step: 5, def: 15, unit: '%' },
    { id: 'rejectLoss', label: '거절 시 동맹금 손실', min: 0, max: 100, step: 10, def: 100, unit: '%' },
    { id: 'stakeYield', label: '출자금 수익률', desc: '30초당', min: 0, max: 20, step: 1, def: 6, unit: '%' },
  ] },
  { group: '보호자 · 학습 미션', parent: true, note: '이 묶음은 보호자 PIN으로 잠깁니다. 처음 바꿀 때 PIN 4자리를 정합니다.', items: [
    { id: 'learn', label: '캠페인 학습 미션', desc: '캠페인 미션마다 수학·국어·통합교과 문제를 풉니다. 출발 전(통과하면 목표가 보이고 출발) 또는 성공 뒤(통과하면 다음 미션이 열림)에 나오고, 전투 중에는 나오지 않습니다', type: 'toggle', def: true, client: true, parent: true },
    { id: 'learnLevel', label: '학습 미션 수준', desc: '이 기기에서 푸는 문제의 수준. 둘이 하기에서는 기기마다 따로 정합니다', min: 0, max: 3, step: 1, def: 1, labels: ['7세(취학 전)', '1~2학년', '3~4학년', '5~6학년'], client: true, parent: true },
    { id: 'learnGuard', label: '찍기 방지', desc: '틀리면 대기: 틀린 뒤 정한 시간 동안 다음 문제를 못 받습니다. 연속 정답: 2문제를 연달아 맞혀야 통과합니다(틀리면 처음부터)', min: 0, max: 3, step: 1, def: 1, labels: ['끔', '틀리면 대기', '2문제 연속 정답', '둘 다'], client: true, parent: true },
    { id: 'learnWait', label: '틀렸을 때 대기 시간', desc: '찍기 방지가 「틀리면 대기」 또는 「둘 다」일 때', min: 3, max: 30, step: 1, def: 10, unit: '초', client: true, parent: true },
    { id: 'learnHint', label: '보기 줄이기 힌트', desc: '두 번 연속 틀리면 다음 문제에서 오답 보기 둘을 지워 줍니다', type: 'toggle', def: true, client: true, parent: true },
  ] },
  { group: '화면과 소리', items: [
    { id: 'volume', label: '효과음 크기', min: 0, max: 200, step: 10, def: 100, unit: '%', client: true },
    { id: 'music', label: '배경음악 크기', min: 0, max: 100, step: 10, def: 50, unit: '%', zero: '끔', client: true },
    { id: 'speech', label: '캐릭터 음성 크기', desc: '이야기 대사와 유닛 대답(합성 음성·기기 음성·녹음 파일)', min: 0, max: 200, step: 10, def: 100, unit: '%', zero: '끔', client: true },
    { id: 'unitVoice', label: '유닛 대답', desc: '유닛을 고르거나 명령하면 말풍선과 함께 짧게 대답합니다', type: 'toggle', def: true, client: true },
    { id: 'unitTTS', label: '개척단 대답 기기 음성', desc: '개척단 유닛 대답을 녹음 파일이 없을 때 이 기기의 한국어 음성으로 읽습니다. 끄거나 한국어 음성이 없으면 합성 말소리를 냅니다', type: 'toggle', def: true, client: true },
    { id: 'tts', label: '대사 읽기(기기 음성)', desc: '이야기 대사를 이 기기의 한국어 음성으로 읽습니다. 기기에 한국어 음성이 없으면 합성 음성을 씁니다', type: 'toggle', def: false, client: true },
    { id: 'voiceVol', label: '상대 음성 크기', desc: '둘이 대전 음성 채팅', min: 0, max: 100, step: 10, def: 100, unit: '%', client: true },
    { id: 'edgeScroll', label: '화면 가장자리 스크롤', type: 'toggle', def: true, client: true },
    { id: 'lowSpec', label: '저사양 모드', desc: '느린 태블릿용. 고급 그래픽·화려한 효과·날씨를 끄고 지형과 건물을 가볍게 그립니다. 처음 실행할 때와 첫 게임에서 느리면 자동으로 켜집니다', type: 'toggle', def: false, client: true },
    { id: 'fps', label: '프레임 수 표시', desc: '화면 왼쪽 아래에 초당 프레임 수를 보입니다', type: 'toggle', def: false, client: true },
    { id: 'gl', label: '고급 그래픽', desc: 'WebGL 조명·불빛·빛 번짐·부드러운 안개. 지원하지 않는 기기에서는 자동으로 꺼집니다', type: 'toggle', def: true, client: true },
    { id: 'clouds', label: '구름 그림자', desc: '고급 그래픽에서 구름 그림자가 지나갑니다', type: 'toggle', def: true, client: true },
    { id: 'weather', label: '날씨 입자', desc: '눈·먼지·포자가 날립니다(화려한 특수 효과가 켜져 있을 때)', type: 'toggle', def: true, client: true },
    { id: 'depth', label: '입체감', desc: '건물 높이·그림자, 유닛 명암', type: 'toggle', def: true, client: true },
    { id: 'fxRich', label: '화려한 특수 효과', desc: '파편·불씨·포탄 연기. 느린 기기에서는 끈다', type: 'toggle', def: true, client: true },
    { id: 'shake', label: '폭발 화면 흔들림', type: 'toggle', def: true, client: true },
  ] },
];
RTS.PRESETS = {
  기본: {},
  안정: { newsEvery: 120, newsImpact: 50, volatility: 50, warCrash: 5, warSell: 20, warHaircut: 10, warEff: 50, warCredit: 50, warMarket: 30, warLoot: 5 },
  투기장: { newsEvery: 30, newsImpact: 200, volatility: 250, impact: 1.5, divRate: 150 },
  총력전: { warMain: 200, warEff: 200, warCredit: 200, warMarket: 200, warLoot: 25, warCrash: 40, warSell: 100, warHaircut: 70, warRebuild: 40, siteImpact: 250, siteDown: 80 },
};
RTS.defaultSettings = () => { const o = {}; for (const g of RTS.SETTINGS) for (const s of g.items) o[s.id] = s.def; return o; };
// 2인 대전 핸디캡 단계. 방장이 팀마다 고른다. towers는 [최소,최대] 완공 방어탑, income은 채취 수입 배율.
RTS.HANDICAPS = {
  none:  { id: 'none',  name: '없음', blurb: '같은 조건' },
  light: { id: 'light', name: '약간', blurb: '광석 +200, 수입 +10%', ore: 200, income: 1.1 },
  mid:   { id: 'mid',   name: '보통', blurb: '광석 +400, 수입 +20%, 방어탑 3~5', ore: 400, gas: 50, income: 1.2, towers: [3, 5] },
  big:   { id: 'big',   name: '많이', blurb: '광석 +600, 수입 +35%, 방어탑 5~10, 맵 공개', ore: 600, gas: 100, income: 1.35, towers: [5, 10], reveal: true },
};
