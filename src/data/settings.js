// settings.js — 설정 항목 정의. 항목을 추가하면 설정 메뉴에 자동으로 나타난다.
// 코드에서는 RTS.cfg(G).키 로 읽는다. startOnly는 새 게임부터, client는 이 브라우저 전용(시뮬레이션과 무관).
RTS.SETTINGS = [
  { group: '게임', items: [
    { id: 'startOre', label: '시작 광석', min: 0, max: 1000, step: 50, def: 100, startOnly: true },
    { id: 'startGas', label: '시작 에테르', min: 0, max: 500, step: 25, def: 0, startOnly: true },
    { id: 'supplyCap', label: '최대 보급', min: 40, max: 200, step: 10, def: 100 },
    { id: 'fog', label: '전장의 안개', type: 'toggle', def: true, startOnly: true },
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
  { group: '전쟁과 시장', note: '한 진영의 사령부가 모두 파괴되면 발동합니다. 남은 건물까지 전멸하면 게임이 끝나므로, 이 효과는 패전 직전 단계와 재건 경쟁에 작용합니다.', items: [
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
  { group: '화면과 소리', items: [
    { id: 'volume', label: '효과음 크기', min: 0, max: 200, step: 10, def: 100, unit: '%', client: true },
    { id: 'edgeScroll', label: '화면 가장자리 스크롤', type: 'toggle', def: true, client: true },
  ] },
];
RTS.PRESETS = {
  기본: {},
  안정: { newsEvery: 120, newsImpact: 50, volatility: 50, warCrash: 5, warSell: 20, warHaircut: 10 },
  투기장: { newsEvery: 30, newsImpact: 200, volatility: 250, impact: 1.5, divRate: 150 },
  총력전: { warCrash: 40, warSell: 100, warHaircut: 70, warRebuild: 40, siteImpact: 250, siteDown: 80 },
};
RTS.defaultSettings = () => { const o = {}; for (const g of RTS.SETTINGS) for (const s of g.items) o[s.id] = s.def; return o; };
