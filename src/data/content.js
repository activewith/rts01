// content.js — 모든 게임 콘텐츠. 새 유닛/건물/업그레이드/맵은 대개 이 파일만 고치면 된다.
// 스탯 기준: 사거리·시야·속도는 타일 단위, 쿨다운·시간은 초 단위.
RTS.mod({
  difficulties: {
    // 왕초보: 맵 전체 공개(reveal), 사람 플레이어 본진에 완공된 방어탑 towers[0]~towers[1]개를 무작위로 지어 둔다
    // healers: AI 치료 유닛(의무병·정비봇·양육충) 최대 수. techAt: 고급 운영(건물 강화·★·합체) 시각 배율(RTS.AI_TECH, 0이면 안 함)
    // plans: 작전 가중치(속공 rush, 확장-발전 expand, 타이밍 공격 timing — RTS.AI_PLANS). attackMin·expandMin: 작전 배율 하한. perBase: 확장 기지당 일꾼 목표 증가율, bases: 최대 사령부 수, harass: 견제 부대
    // 2026-11 하향: 각 단계가 예전보다 두 단계 아래 수치를 쓴다(어려움 = 예전 쉬움, 보통 = 예전 왕초보, 쉬움·왕초보는 그보다 더 약하게)
    beginner: { name: '왕초보', reveal: true, towers: [5, 10], blurb: '맵 전체가 보이고 방어탑 5~10개를 갖고 시작', income: .4, interval: 90, maxWorkers: 10, waveSize: 3, waveGrow: 1, firstAttack: 720, expandAt: 1500, invest: 340, investEvery: 40, scoutAt: 600, stake: 100, allyArmy: 14,
      plans: { expand: 1, timing: 1 }, attackMin: 1, expandMin: .7, perBase: .3, bases: 2, techAt: 1.9, healers: 1 },
    easy:   { name: '쉬움',   income: .5,  interval: 75, maxWorkers: 12, waveSize: 3,  waveGrow: 1, firstAttack: 600, expandAt: 1000, invest: 330, investEvery: 35, scoutAt: 500, stake: 110, allyArmy: 13,
      plans: { expand: 1, timing: 1 }, attackMin: .85, expandMin: .5, perBase: .4, bases: 2, techAt: 1.45, healers: 2 },
    normal: { name: '보통',   income: .6,  interval: 60, maxWorkers: 14, waveSize: 4,  waveGrow: 2, firstAttack: 480, expandAt: 720, invest: 320, investEvery: 30, scoutAt: 420, stake: 120, allyArmy: 12,
      plans: { rush: 1, expand: 1, timing: 1 }, perBase: .6, bases: 3, harass: true, techAt: 1, healers: 3 },
    hard:   { name: '어려움', income: .8,  interval: 40, maxWorkers: 18, waveSize: 6,  waveGrow: 3, firstAttack: 330, expandAt: 480, invest: 300, investEvery: 22, scoutAt: 300, stake: 150, allyArmy: 10,
      plans: { rush: 1.2, expand: 1, timing: 1 }, perBase: .8, bases: 4, harass: true, guardExpo: true, techAt: .75, healers: 4 },
  },
  terrain: {
    ground: { name: '땅' }, rock: { name: '암벽' }, sand: { name: '모래' }, cliff: { name: '고지대 절벽' },
  },
  abilities: {
    stim: { short: '충전', name: '과충전', key: 'Q', target: 'self', cooldown: 12, requires: 'p_stim', desc: '체력 10을 써서 8초간 속도 +50%, 공격 간격 -33%',
      use(G, u) { if (u.hp <= 12) return false; u.hp -= 10; RTS.addBuff(G, u, 'stim', 8, { speed: 1.5, cooldown: .67 }); },
      ai(G, u) { if (u.hp > 30 && u.order && u.order.type === 'amove' && RTS.scan(G, u, RTS.weapon(u), 6)) RTS.commands.ability(G, u.team, { ids: [u.id], ability: 'stim' }); } },
    siege: { short: '포격', name: '포격 모드', key: 'Q', target: 'self', cooldown: 2, desc: '고정 포격 전환. 사거리 11, 범위 피해. 이동 불가',
      use(G, u) { u.sieged = !u.sieged; RTS.issue(G, u, null); },
      ai(G, u) { const near = RTS.scan(G, u, RTS.defOf(u).siegeWeapon, 9); if (!!near !== !!u.sieged) { if (near || G.tick % 40 === 0) RTS.commands.ability(G, u.team, { ids: [u.id], ability: 'siege' }); } } },
    morph: { short: '변신', name: '변신', key: 'T', target: 'self', cooldown: 4, desc: '★2까지 강화한 합체 유닛만 쓸 수 있다. 다른 형태로 바뀌고, 다시 누르면 원래대로 돌아온다',
      need: (G, u) => (u.rank || 0) >= RTS.RANK.max ? '' : `★${RTS.RANK.max}까지 강화해야 변신할 수 있습니다`,
      use(G, u) { return RTS.morph(G, u); },
      ai(G, u) { const F = RTS.defOf(u).form; if (!F || (u.rank || 0) < RTS.RANK.max) return; const near = RTS.scan(G, u, RTS.weapon(u), F.root ? 8 : 7);
        if (!!near !== !!u.form && (near || G.tick % 60 === 0)) RTS.commands.ability(G, u.team, { ids: [u.id], ability: 'morph' }); } },
    shock: { name: '충격파', key: 'Q', target: 'point', range: 8, cooldown: 25, desc: '지점 반경 2.5에 피해 40, 2초 기절',
      use(G, u, c) { RTS.query(G, c.x, c.y, 2.5, o => { if (o.dead || o.team === u.team || o.team < 0 || Math.hypot(o.x - c.x, o.y - c.y) > 3) return; RTS.damage(G, o, 40, u); if (RTS.defOf(o).kind === 'unit') o.stunned = G.tick + 40; }); RTS.emit(G, 'impact', { x: c.x, y: c.y, w: { splash: 2.5 }, team: u.team }); },
      ai(G, u) { const t = RTS.scan(G, u, RTS.weapon(u), 7); if (t && RTS.defOf(t).kind === 'unit') RTS.commands.ability(G, u.team, { ids: [u.id], ability: 'shock', x: t.x, y: t.y, one: true }); } },
    // 포자군락
    frenzy: { short: '광분', name: '광분', key: 'Q', target: 'self', cooldown: 20, desc: '6초간 속도 +40%, 공격 간격 -30%',
      use(G, u) { RTS.addBuff(G, u, 'frenzy', 6, { speed: 1.4, cooldown: .7 }); },
      ai(G, u) { if (u.order && u.order.type === 'amove' && RTS.scan(G, u, RTS.weapon(u), 4)) RTS.commands.ability(G, u.team, { ids: [u.id], ability: 'frenzy' }); } },
    acid: { short: '산성', name: '산성 분사', key: 'Q', target: 'point', range: 7, cooldown: 20, requires: 's_acid', desc: '지점 반경 2에 피해 25, 4초간 이동 속도 -50%',
      use(G, u, c) { RTS.query(G, c.x, c.y, 2, o => { if (o.dead || !RTS.foe(G, u.team, o.team) || Math.hypot(o.x - c.x, o.y - c.y) > 2.5) return; RTS.damage(G, o, 25, u); if (RTS.defOf(o).kind === 'unit') RTS.addBuff(G, o, 'acid', 4, { speed: .5 }); }); RTS.emit(G, 'impact', { x: c.x, y: c.y, w: { splash: 2 }, team: u.team }); },
      ai(G, u) { const t = RTS.scan(G, u, RTS.weapon(u), 6.5); if (t && RTS.defOf(t).kind === 'unit') RTS.commands.ability(G, u.team, { ids: [u.id], ability: 'acid', x: t.x, y: t.y, one: true }); } },
  },
  entities: {
    // ── 중립 자원 ──
    ore_node: { kind: 'resource', name: '광석 광맥', resource: 'ore', amount: 900, size: [2, 1], desc: '일꾼이 캐는 기본 자원' },
    vent:     { kind: 'resource', name: '에테르 분출구', resource: 'gas', amount: 2500, size: [2, 2], desc: '추출기를 지어야 채취할 수 있다' },

    // ── 회사 거점: 파괴되지 않고 가동 중단된다 ──
    co_site_ore: { kind: 'building', site: true, name: '광석 회사 거점', art: 'site_ore', size: [3, 3], hp: 900, armor: 1, sight: 7 },
    co_site_gas: { kind: 'building', site: true, name: '에테르 회사 거점', art: 'site_gas', size: [3, 3], hp: 900, armor: 1, sight: 7 },

    // ── 자유상단: 중립 지부와 동맹 시 나오는 유닛 ──
    n_post:    { kind: 'building', site: true, name: '자유상단 지부', art: 'site_post', size: [3, 3], hp: 700, armor: 1, sight: 8 },
    n_caravan: { kind: 'unit', name: '상단 수레', abbr: '수', art: 'caravan', uncontrollable: true, passive: true, r: .5, hp: 90, speed: 2.6, sight: 5, tags: ['mech'], desc: '도착하면 자원을 내려놓는다. 파괴되면 화물을 잃는다' },
    n_merc:    { kind: 'unit', name: '유랑 용병', abbr: '용', art: 'trooper', tint: 1, r: .42, hp: 110, armor: 1, speed: 2.8, sight: 8, tags: ['bio'], weapon: { damage: 12, range: 5, cooldown: .9, speed: 24, art: 'tracer' }, desc: '용병단이 보낸 정예 병력. 보급을 쓰지 않는다' },

    // ── 잿빛 부족: AI로 움직이는 중립 세력(tribe.js). 팀 번호 RTS.TRIBE ──
    t_hall:    { kind: 'building', name: '부족 회당', art: 't_hall', size: [4, 3], hp: 1600, armor: 2, sight: 10, aggro: 7, weapon: { damage: 10, range: 7, cooldown: 1.2, speed: 22, art: 'tracer' }, desc: '잿빛 부족의 중심. 공병으로 우클릭하면 외교 미션을 받는다' },
    t_tower:   { kind: 'building', name: '부족 망루', art: 't_tower', size: [2, 2], hp: 500, armor: 1, sight: 10, aggro: 7, weapon: { damage: 11, range: 7, cooldown: 1, speed: 22, art: 'tracer' }, desc: '적대 세력만 공격한다' },
    t_warrior: { kind: 'unit', name: '부족 전사', abbr: '전', art: 'tribal', r: .42, hp: 95, armor: 1, speed: 2.9, sight: 8, tags: ['bio'], weapon: { damage: 10, range: .4, cooldown: .9, air: false }, desc: '도끼를 든 근접 전사. 지상만 공격' },
    t_cart:    { kind: 'unit', name: '부족 수송차', abbr: '송', art: 'caravan', uncontrollable: true, passive: true, r: .6, hp: 320, armor: 1, speed: 2.3, sight: 6, tags: ['bio'], desc: '잿빛 부족이 동맹에게 보내는 자원 수송차. 도착하면 실은 광석·에테르를 내려놓는다. 파괴되면 화물을 잃는다 — 병력으로 호위하세요' },
    t_archer:  { kind: 'unit', name: '부족 궁수', abbr: '궁', art: 'tribal', tint: 1, r: .38, hp: 60, speed: 2.8, sight: 9, tags: ['bio'], weapon: { damage: 8, range: 5.5, cooldown: 1, speed: 20, art: 'tracer' }, desc: '지상·공중 원거리 사격' },

    // ── 개척단: 일꾼이 건물 옆에서 끝까지 짓는다 ──
    p_worker:  { kind: 'unit', name: '공병', abbr: '공', key: 'W', art: 'worker', r: .36, hp: 45, speed: 2.9, sight: 7, supply: 1, cost: { ore: 50 }, time: 12, gather: true, carry: 5, passive: true, tags: ['bio'],
      weapon: { damage: 4, range: .3, cooldown: 1.2 }, builds: ['p_depot', 'p_extractor', 'p_barracks', 'p_lab', 'p_turret', 'p_factory', 'p_hq'], repair: { tag: 'mech', amount: 8, cooldown: 1, range: .8, building: 15 }, desc: '자원 채취와 건설, 기계 유닛·건물 수리(자원 소모), 건물 철거' },
    p_rifle:   { kind: 'unit', name: '소총병', abbr: '소', key: 'R', art: 'trooper', r: .38, hp: 50, speed: 2.7, sight: 8, supply: 1, cost: { ore: 50 }, time: 14, tags: ['bio'], abilities: ['stim'],
      weapon: { damage: 6, range: 5, cooldown: .8, speed: 26, art: 'tracer' }, desc: '기본 보병. 공중 공격 가능' },
    p_gren:    { kind: 'unit', name: '척탄병', abbr: '척', key: 'G', art: 'trooper', tint: 1, r: .42, hp: 80, armor: 1, speed: 2.5, sight: 8, supply: 2, cost: { ore: 75, gas: 25 }, time: 18, tags: ['bio'], requires: ['p_lab'],
      weapon: { damage: 14, range: 5.5, cooldown: 1.6, splash: 1, air: false, speed: 11, art: 'shell' }, desc: '범위 피해. 지상만 공격' },
    p_medic:   { kind: 'unit', name: '의무병', abbr: '의', key: 'E', art: 'trooper', tint: 2, r: .38, hp: 55, speed: 2.8, sight: 9, supply: 1, cost: { ore: 50, gas: 40 }, time: 16, tags: ['bio'], requires: ['p_lab'], passive: false,
      heal: { amount: 6, range: 3.5, cooldown: .8, tag: 'bio' }, desc: '주변 보병을 자동 치료' },
    p_tank:    { kind: 'unit', name: '포격전차', abbr: '포', key: 'T', art: 'tank', r: .72, hp: 170, armor: 1, speed: 2.3, sight: 10, supply: 3, cost: { ore: 150, gas: 100 }, time: 28, tags: ['mech'], abilities: ['siege'],
      weapon: { damage: 20, range: 7, cooldown: 1.4, air: false, speed: 20, art: 'shell' }, siegeWeapon: { damage: 42, range: 11, cooldown: 2.6, splash: 1.3, air: false, speed: 18, art: 'shell' }, desc: '포격 모드로 원거리 범위 공격' },
    p_gunship: { kind: 'unit', name: '강습기', abbr: '강', key: 'F', art: 'flyer', air: true, r: .6, hp: 130, speed: 3.8, sight: 10, supply: 3, cost: { ore: 125, gas: 75 }, time: 24, tags: ['mech'],
      weapon: { damage: 9, range: 5, cooldown: .9, speed: 24, art: 'tracer' }, desc: '지형을 무시하는 공중 화력' },

    p_hq:       { kind: 'building', name: '사령부', abbr: '사', key: 'C', art: 'hq', size: [4, 3], hp: 1400, armor: 1, sight: 11, cost: { ore: 400 }, time: 60, provides: 12, dropoff: true, trains: ['p_worker'], desc: '일꾼 생산, 자원 반납' },
    p_depot:    { kind: 'building', name: '보급고', abbr: '보', key: 'D', art: 'depot', size: [2, 2], hp: 400, sight: 7, cost: { ore: 100 }, time: 18, provides: 8, desc: '보급 +8' },
    p_extractor:{ kind: 'building', name: '추출기', abbr: '추', key: 'E', art: 'extractor', size: [2, 2], hp: 500, sight: 7, cost: { ore: 75 }, time: 16, placeOn: 'vent', desc: '에테르 분출구 위에 건설' },
    p_barracks: { kind: 'building', name: '병영', abbr: '병', key: 'B', art: 'barracks', size: [3, 3], hp: 900, sight: 8, cost: { ore: 150 }, time: 34, requires: ['p_hq'], trains: ['p_rifle', 'p_gren', 'p_medic'], desc: '보병 생산' },
    p_lab:      { kind: 'building', name: '연구소', abbr: '연', key: 'L', art: 'lab', size: [3, 2], hp: 700, sight: 8, cost: { ore: 150, gas: 100 }, time: 30, requires: ['p_barracks'], researches: ['p_stim', 'p_wpn1', 'p_arm1', 'p_mech1'], desc: '강화 연구, 상위 보병 해금' },
    p_factory:  { kind: 'building', name: '공창', abbr: '창', key: 'V', art: 'factory', size: [3, 3], hp: 1100, armor: 1, sight: 8, cost: { ore: 200, gas: 150 }, time: 40, requires: ['p_lab'], trains: ['p_tank', 'p_gunship'], desc: '기계 유닛 생산' },
    p_turret:   { kind: 'building', name: '방어포탑', abbr: '탑', key: 'T', art: 'turret', size: [2, 2], hp: 450, armor: 1, sight: 10, aggro: 7, cost: { ore: 125 }, time: 22, requires: ['p_barracks'], weapon: { damage: 12, range: 7, cooldown: 1, speed: 24, art: 'tracer' }, desc: '지상·공중 자동 방어' },

    // ── 철갑회: 일꾼이 터만 잡으면 건물이 스스로 올라간다(selfBuild) ──
    i_worker:  { kind: 'unit', name: '수집봇', abbr: '수', key: 'W', art: 'iworker', r: .36, hp: 40, speed: 3.1, sight: 7, supply: 1, cost: { ore: 50 }, time: 12, gather: true, carry: 5, passive: true, tags: ['mech'],
      weapon: { damage: 4, range: .3, cooldown: 1.2 }, builds: ['i_relay', 'i_extractor', 'i_forge', 'i_core', 'i_turret', 'i_foundry', 'i_hq'], desc: '자원 채취와 건설 시작, 건물 철거' },
    i_blade:   { kind: 'unit', name: '칼날봇', abbr: '칼', key: 'B', art: 'bot', r: .42, hp: 75, armor: 1, speed: 3.2, sight: 7, supply: 1, cost: { ore: 75 }, time: 15, tags: ['mech'],
      weapon: { damage: 11, range: .4, cooldown: .9, air: false }, desc: '빠른 근접 돌격병. 지상만 공격' },
    i_striker: { kind: 'unit', name: '사수봇', abbr: '사', key: 'R', art: 'bot', tint: 1, r: .44, hp: 80, speed: 2.7, sight: 8, supply: 2, cost: { ore: 100, gas: 25 }, time: 20, tags: ['mech'],
      weapon: { damage: 11, range: 6, cooldown: 1.1, speed: 22, art: 'tracer' }, desc: '지상·공중 원거리 사격' },
    i_mender:  { kind: 'unit', name: '정비봇', abbr: '정', key: 'E', art: 'bot', tint: 2, r: .4, hp: 60, speed: 3, sight: 9, supply: 1, cost: { ore: 50, gas: 50 }, time: 18, tags: ['mech'], requires: ['i_core'], passive: false,
      heal: { amount: 7, range: 3.5, cooldown: .9, tag: 'mech' }, desc: '주변 기계를 자동 수리' },
    i_colossus:{ kind: 'unit', name: '중장봇', abbr: '중', key: 'T', art: 'walker', r: .85, hp: 300, armor: 2, speed: 1.9, sight: 10, supply: 4, cost: { ore: 250, gas: 125 }, time: 36, tags: ['mech'], abilities: ['shock'],
      weapon: { damage: 26, range: 6, cooldown: 1.7, splash: .9, air: false, speed: 14, art: 'shell' }, desc: '고체력 범위 화력, 충격파' },
    i_wasp:    { kind: 'unit', name: '말벌기', abbr: '말', key: 'F', art: 'flyer', tint: 1, air: true, r: .5, hp: 95, speed: 4.3, sight: 9, supply: 2, cost: { ore: 100, gas: 75 }, time: 20, tags: ['mech'],
      weapon: { damage: 7, range: 4, cooldown: .6, speed: 26, art: 'tracer' }, desc: '빠른 공중 요격기' },

    i_hq:       { kind: 'building', name: '중추', abbr: '중', key: 'C', art: 'i_hq', size: [4, 3], hp: 1300, armor: 1, sight: 11, cost: { ore: 400 }, time: 60, provides: 12, dropoff: true, trains: ['i_worker'], desc: '수집봇 생산, 자원 반납' },
    i_relay:    { kind: 'building', name: '중계탑', abbr: '계', key: 'D', art: 'i_depot', size: [2, 2], hp: 350, sight: 8, cost: { ore: 100 }, time: 18, provides: 8, desc: '보급 +8' },
    i_extractor:{ kind: 'building', name: '추출 코일', abbr: '코', key: 'E', art: 'i_extractor', size: [2, 2], hp: 450, sight: 7, cost: { ore: 75 }, time: 16, placeOn: 'vent', desc: '에테르 분출구 위에 건설' },
    i_forge:    { kind: 'building', name: '조립로', abbr: '조', key: 'B', art: 'i_barracks', size: [3, 3], hp: 850, sight: 8, cost: { ore: 150 }, time: 34, requires: ['i_hq'], trains: ['i_blade', 'i_striker', 'i_mender'], desc: '경량 기계 생산' },
    i_core:     { kind: 'building', name: '연산핵', abbr: '핵', key: 'L', art: 'i_lab', size: [3, 2], hp: 700, sight: 8, cost: { ore: 150, gas: 100 }, time: 30, requires: ['i_forge'], researches: ['i_wpn1', 'i_arm1', 'i_servo', 'i_heavy1'], desc: '강화 연구' },
    i_foundry:  { kind: 'building', name: '중공장', abbr: '공', key: 'V', art: 'i_factory', size: [3, 3], hp: 1100, armor: 1, sight: 8, cost: { ore: 200, gas: 150 }, time: 40, requires: ['i_core'], trains: ['i_colossus', 'i_wasp'], desc: '중장비와 공중기 생산' },
    i_turret:   { kind: 'building', name: '감시포', abbr: '감', key: 'T', art: 'i_turret', size: [2, 2], hp: 400, armor: 1, sight: 10, aggro: 7, cost: { ore: 125 }, time: 22, requires: ['i_forge'], weapon: { damage: 12, range: 7, cooldown: 1, speed: 24, art: 'tracer' }, desc: '지상·공중 자동 방어' },

    // ── 포자군락: 일꾼이 건물로 변태한다(morph, 일꾼 소모). 유닛·건물이 스스로 재생한다(regen) ──
    s_drone:   { kind: 'unit', name: '포자일꾼', abbr: '포', key: 'W', art: 'sworker', r: .36, hp: 40, speed: 3, sight: 7, supply: 1, cost: { ore: 50 }, time: 12, gather: true, carry: 5, passive: true, tags: ['bio'],
      weapon: { damage: 4, range: .3, cooldown: 1.2 }, builds: ['s_pod', 's_extractor', 's_pool', 's_den', 's_spine', 's_nest', 's_hq'], desc: '자원 채취. 건설하면 그 건물로 변태해 사라진다. 건물 철거' },
    s_claw:    { kind: 'unit', name: '갈퀴충', abbr: '갈', key: 'Z', art: 'claw', r: .34, hp: 38, speed: 3.6, sight: 7, supply: .5, count: 2, cost: { ore: 50 }, time: 14, tags: ['bio'],
      weapon: { damage: 6, range: .3, cooldown: .6, air: false }, desc: '한 번에 2기씩 태어나는 싸고 빠른 근접 무리. 지상만 공격' },
    s_spitter: { kind: 'unit', name: '산탄충', abbr: '산', key: 'R', art: 'spitter', r: .42, hp: 80, speed: 2.7, sight: 8, supply: 1, cost: { ore: 75, gas: 25 }, time: 18, tags: ['bio'], abilities: ['acid'],
      weapon: { damage: 10, range: 5.5, cooldown: 1, speed: 18, art: 'shell' }, desc: '지상·공중 원거리 사격, 산성 분사' },
    s_nurse:   { kind: 'unit', name: '양육충', abbr: '양', key: 'E', art: 'nurse', r: .4, hp: 60, speed: 2.8, sight: 9, supply: 1, cost: { ore: 50, gas: 50 }, time: 16, tags: ['bio'], requires: ['s_den'], passive: false,
      heal: { amount: 5, range: 3.5, cooldown: .8, tag: 'bio' }, desc: '주변 생체 유닛을 자동 치료' },
    s_brute:   { kind: 'unit', name: '거대충', abbr: '거', key: 'T', art: 'brute', r: .85, hp: 340, armor: 2, speed: 2.2, sight: 9, supply: 4, cost: { ore: 250, gas: 150 }, time: 36, tags: ['bio'], abilities: ['frenzy'],
      weapon: { damage: 24, range: .6, cooldown: 1.4, splash: .9, air: false }, desc: '고체력 근접 범위 공격, 광분' },
    s_drake:   { kind: 'unit', name: '독침비행체', abbr: '독', key: 'F', art: 'drake', air: true, r: .55, hp: 110, speed: 4, sight: 9, supply: 2, cost: { ore: 100, gas: 100 }, time: 22, tags: ['bio'],
      weapon: { damage: 8, range: 3.5, cooldown: .9, speed: 22, art: 'tracer' }, desc: '빠른 공중 습격. 지상·공중 공격' },

    s_hq:       { kind: 'building', name: '군락핵', abbr: '핵', key: 'C', art: 's_hq', size: [4, 3], hp: 1500, armor: 1, sight: 11, cost: { ore: 350 }, time: 60, provides: 12, dropoff: true, trains: ['s_drone'], desc: '포자일꾼 생산, 자원 반납' },
    s_pod:      { kind: 'building', name: '양분낭', abbr: '양', key: 'D', art: 's_pod', size: [2, 2], hp: 300, sight: 7, cost: { ore: 100 }, time: 18, provides: 8, desc: '보급 +8' },
    s_extractor:{ kind: 'building', name: '흡수관', abbr: '흡', key: 'E', art: 's_extractor', size: [2, 2], hp: 450, sight: 7, cost: { ore: 50 }, time: 16, placeOn: 'vent', desc: '에테르 분출구 위에 변태' },
    s_pool:     { kind: 'building', name: '번식굴', abbr: '번', key: 'B', art: 's_pool', size: [3, 3], hp: 800, sight: 8, cost: { ore: 150 }, time: 32, requires: ['s_hq'], trains: ['s_claw', 's_spitter', 's_nurse'], desc: '경량 생체 유닛 생산' },
    s_den:      { kind: 'building', name: '진화굴', abbr: '진', key: 'L', art: 's_den', size: [3, 2], hp: 650, sight: 8, cost: { ore: 125, gas: 75 }, time: 30, requires: ['s_pool'], researches: ['s_claws', 's_carapace', 's_rush', 's_acid'], desc: '진화 연구, 양육충 해금' },
    s_nest:     { kind: 'building', name: '둥지', abbr: '둥', key: 'V', art: 's_nest', size: [3, 3], hp: 1000, armor: 1, sight: 8, cost: { ore: 200, gas: 150 }, time: 40, requires: ['s_den'], trains: ['s_brute', 's_drake'], desc: '거대충과 비행체 생산' },
    s_spine:    { kind: 'building', name: '가시촉수', abbr: '가', key: 'T', art: 's_spine', size: [2, 2], hp: 420, armor: 1, sight: 10, aggro: 7, cost: { ore: 100 }, time: 22, requires: ['s_pool'], weapon: { damage: 12, range: 6.5, cooldown: 1, speed: 22, art: 'tracer' }, desc: '지상·공중 자동 방어' },
  },
  upgrades: {
    p_stim:  { short: '충전', name: '과충전 주입기', key: 'Q', cost: { ore: 100, gas: 100 }, time: 40, desc: '소총병 과충전 사용 가능' },
    p_wpn1:  { short: '무기', name: '보병 무기 1', key: 'W', cost: { ore: 100, gas: 100 }, time: 45, effects: [{ tag: 'bio', stat: 'damage', add: 2 }], desc: '보병 공격력 +2' },
    p_arm1:  { short: '방탄', name: '보병 방탄 1', key: 'A', cost: { ore: 100, gas: 100 }, time: 45, effects: [{ tag: 'bio', stat: 'armor', add: 1 }], desc: '보병 방어력 +1' },
    p_mech1: { short: '장갑', name: '차체 장갑 1', key: 'R', cost: { ore: 150, gas: 150 }, time: 50, requires: ['p_factory'], effects: [{ tag: 'mech', stat: 'armor', add: 1 }, { tag: 'mech', stat: 'hp', add: 20 }], desc: '기계 방어력 +1, 체력 +20' },
    i_wpn1:  { short: '절삭', name: '절삭 날 1', key: 'W', cost: { ore: 100, gas: 100 }, time: 45, effects: [{ tag: 'mech', stat: 'damage', add: 2 }], desc: '전 유닛 공격력 +2' },
    i_arm1:  { short: '외피', name: '복합 외피 1', key: 'A', cost: { ore: 100, gas: 100 }, time: 45, effects: [{ tag: 'mech', stat: 'armor', add: 1 }], desc: '전 유닛 방어력 +1' },
    i_servo: { short: '서보', name: '고속 서보', key: 'Q', cost: { ore: 100, gas: 75 }, time: 40, effects: [{ id: 'i_blade', stat: 'speed', mul: 1.25 }], desc: '칼날봇 속도 +25%' },
    i_heavy1:{ short: '조준', name: '장거리 조준', key: 'R', cost: { ore: 150, gas: 150 }, time: 50, requires: ['i_foundry'], effects: [{ id: 'i_striker', stat: 'range', add: 1 }, { id: 'i_colossus', stat: 'range', add: 1 }], desc: '사수봇·중장봇 사거리 +1' },
    s_claws:   { short: '발톱', name: '강화 발톱', key: 'W', cost: { ore: 100, gas: 100 }, time: 45, effects: [{ tag: 'bio', stat: 'damage', add: 2 }], desc: '전 유닛 공격력 +2' },
    s_carapace:{ short: '껍질', name: '두꺼운 껍질', key: 'A', cost: { ore: 100, gas: 100 }, time: 45, effects: [{ tag: 'bio', stat: 'armor', add: 1 }], desc: '전 유닛 방어력 +1' },
    s_rush:    { short: '질주', name: '근육 질주', key: 'Q', cost: { ore: 100, gas: 75 }, time: 40, effects: [{ id: 's_claw', stat: 'speed', mul: 1.3 }], desc: '갈퀴충 속도 +30%' },
    s_acid:    { short: '산성', name: '산성 분비샘', key: 'R', cost: { ore: 125, gas: 125 }, time: 45, desc: '산탄충 산성 분사 사용 가능' },
  },
  // 회사: price 상장가(광석), yield 30초당 상장가 대비 배당률, vol 1초 변동성
  companies: {
    daeryuk: { name: '대륙광업', short: '대륙', resource: 'ore', price: 20, yield: .13, vol: .004, site: 'co_site_ore', blurb: '안정적인 배당' },
    ethgae:  { name: '에테르개발', short: '에개', resource: 'gas', price: 30, yield: .08, vol: .004, site: 'co_site_gas', blurb: '안정적인 에테르 배당' },
    simcheung: { name: '심층광산', short: '심층', resource: 'ore', price: 12, yield: .16, vol: .012, site: 'co_site_ore', blurb: '배당 높음, 주가 급변' },
    seongun: { name: '성운추출', short: '성운', resource: 'gas', price: 18, yield: .10, vol: .012, site: 'co_site_gas', blurb: '에테르 배당 높음, 주가 급변' },
  },
  // 시장 사건: scope = 'all' | 'ore' | 'gas' | 회사 id. earn은 실적 배수, price는 주가 즉시 배수
  marketEvents: {
    boom:     { text: '호황: 전 종목 실적 개선', scope: 'all', earn: 1.15, price: 1.06, w: 2 },
    rates:    { text: '금리 인상: 전 종목 주가 하락', scope: 'all', earn: 1, price: .9, w: 2 },
    crash:    { text: '증시 급락: 전 종목 -18%', scope: 'all', earn: .9, price: .82, w: 1 },
    orePeak:  { text: '광석 수요 급증: 광석 회사 실적 개선', scope: 'ore', earn: 1.3, price: 1.1, w: 3 },
    oreGlut:  { text: '광석 공급 과잉: 광석 회사 실적 악화', scope: 'ore', earn: .75, price: .9, w: 3 },
    gasPeak:  { text: '에테르 품귀: 에테르 회사 실적 개선', scope: 'gas', earn: 1.3, price: 1.1, w: 3 },
    gasLeak:  { text: '에테르 규제 강화: 에테르 회사 실적 악화', scope: 'gas', earn: .75, price: .9, w: 3 },
    deepVein: { text: '심층광산 대형 광맥 발견', scope: 'simcheung', earn: 1.6, price: 1.25, w: 1 },
    collapse: { text: '심층광산 갱도 붕괴', scope: 'simcheung', earn: .55, price: .72, w: 1 },
    nebula:   { text: '성운추출 신공법 성공', scope: 'seongun', earn: 1.6, price: 1.25, w: 1 },
    blowout:  { text: '성운추출 분출 사고', scope: 'seongun', earn: .55, price: .72, w: 1 },
  },
  // 자유상단 지부. check 조건을 채워야 신청 가능하고, base는 최소 동맹금일 때의 수락 확률이다.
  branches: {
    namhae: { name: '남풍상회', base: .3, need: '광석 800 이상 채취', perkText: '90초마다 광석 180 수레, 거래 수수료 2%', check: (G, t) => t.stats.ore >= 800, perk: { caravan: { res: 'ore', amount: 180, every: 90 }, spread: .02 } },
    silver: { name: '은빛금고', base: .25, need: '보유 주식 평가액 300 이상', perkText: '모든 주식 배당 +30%', check: (G, t) => Object.values(G.market.cos).reduce((s, c) => s + c.shares[t.id] * c.price, 0) >= 300, perk: { divBonus: .3 } },
    rail:   { name: '철로조합', base: .35, need: '완공 건물 5개 이상', perkText: '보급 +12, 90초마다 에테르 80 수레', check: (G, t) => Object.values(t.have).reduce((s, n) => s + n, 0) >= 5, perk: { supply: 12, caravan: { res: 'gas', amount: 80, every: 90 } } },
    roam:   { name: '유랑용병단', base: .3, need: '전투 유닛 8기 이상', perkText: '정예 용병 5기 즉시 합류', check: (G, t) => G.ents.filter(e => e.team === t.id && RTS.defOf(e).kind === 'unit' && !RTS.defOf(e).gather && !RTS.defOf(e).uncontrollable).length >= 8, perk: { mercs: 5 } },
  },
  // 잿빛 부족 외교 미션: 초등 수학 문제. 공병이 회당에 가면 수준(설정 mathLevel)에 맞는 문제 2개를 무작위로 받는다.
  // 답만큼 광석을 부족 패널에서 보내면 성공. 틀리면 '더 많다/적다' 힌트, 3번 틀리면 실패(틀린 답은 광석을 내지 않는다).
  // quiz(G, lv, ri)는 [문제 문장, 답]을 돌려준다. ri(a,b)는 a~b 정수(시드 난수). lv: 1 = 1~2학년, 2 = 3~4학년, 3 = 5~6학년
  tribeMissions: {
    add:   { name: '덧셈', time: 180, lv: [1, 3], quiz(G, lv, ri) {
      if (lv === 1) { if (ri(0, 1)) { const a = ri(1, 15) * 10, b = ri(1, 10) * 10; return [`${a} + ${b}`, a + b]; } const a = ri(12, 89), b = ri(11, 99); return [`${a} + ${b}`, a + b]; }
      if (lv === 2) { const a = ri(105, 199), b = ri(25, 99); return [`${a} + ${b}`, a + b]; }
      const a = ri(35, 99), b = ri(35, 99), c = ri(25, 99); return [`${a} + ${b} + ${c}`, a + b + c]; } },
    sub:   { name: '뺄셈', time: 180, lv: [1, 3], quiz(G, lv, ri) {
      if (lv === 1) { const a = ri(40, 160), b = ri(12, a - 15); return [`${a} − ${b}`, a - b]; }
      if (lv === 2) { const n = ri(45, 280), b = ri(55, 199); return [`${n + b} − ${b}`, n]; }
      const n = ri(40, 280), b = ri(40, 150), c = ri(20, 99); return [`${n + b + c} − ${b} − ${c}`, n]; } },
    mul:   { name: '곱셈', time: 180, lv: [1, 3], quiz(G, lv, ri) {
      if (lv === 1) { const a = ri(2, 5), b = ri(2, 9); return [`${a} × ${b}`, a * b]; }
      if (lv === 2) { if (ri(0, 1)) { const a = ri(6, 9), b = ri(3, 9); return [`${a} × ${b}`, a * b]; } const b = ri(2, 6), a = ri(12, Math.floor(280 / b)); return [`${a} × ${b}`, a * b]; }
      if (ri(0, 1)) { const a = ri(2, 6), b = ri(3, 9), c = ri(2, 5); return [`${a} × ${b} × ${c}`, a * b * c]; } const a = ri(11, 25), b = ri(11, 14); return [`${a} × ${b}`, a * b]; } },
    place: { name: '자릿값', time: 180, lv: [1, 2], quiz(G, lv, ri) {
      if (lv === 1) { const a = ri(1, 2), b = ri(0, 9), c = ri(1, 9); return [`100이 ${a}개, 10이 ${b}개, 1이 ${c}개인 수`, a * 100 + b * 10 + c]; }
      const b = ri(11, 29), c = ri(1, 9); return [`10이 ${b}개, 1이 ${c}개인 수`, b * 10 + c]; } },
    word:  { name: '문장제', time: 180, lv: [1, 3], quiz(G, lv, ri) {
      if (lv === 1) { const n = ri(3, 9), k = [5, 10, 20][ri(0, 2)]; return [`전사 ${n}명에게 광석을 ${k}씩 나눠 주면 모두 얼마일까?`, n * k]; }
      if (lv === 2) { const n = ri(3, 8), q = ri(6, 30); return [`광석 ${n * q}을 마을 ${n}곳에 똑같이 나누면 한 곳에 얼마일까?`, q]; }
      const per = ri(12, 30), n = ri(4, 9), left = ri(10, 60); return [`망루 ${n}개를 고치는 데 하나에 광석 ${per}씩 들고, ${left}이 남았다. 처음 광석은 얼마였을까?`, per * n + left]; } },
    div:   { name: '나눗셈', time: 180, lv: [2, 3], quiz(G, lv, ri) {
      if (lv === 2) { const n = ri(2, 9), q = ri(2, 9) * 10; return [`${n * q} ÷ ${n}`, q]; }
      const n = ri(3, 9), q = ri(12, Math.min(60, Math.floor(540 / n))); return [`${n * q} ÷ ${n}`, q]; } },
    mixed: { name: '혼합 계산', time: 180, lv: [2, 3], quiz(G, lv, ri) {
      if (lv === 2) { const a = ri(5, 20) * 10, b = ri(3, 12) * 10, c = ri(1, Math.floor((a + b) / 10) - 1) * 10; return [`${a} + ${b} − ${c}`, a + b - c]; }
      const k = ri(0, 2);
      if (k === 0) { const a = ri(10, 90), b = ri(3, 9), c = ri(4, 20); return [`${a} + ${b} × ${c}`, a + b * c]; }
      if (k === 1) { const b = ri(5, 30), a = b + ri(8, 40), c = ri(3, 6); return [`(${a} − ${b}) × ${c}`, (a - b) * c]; }
      const a = ri(6, 15), b = ri(8, 20), c = ri(10, a * b - 20); return [`${a} × ${b} − ${c}`, a * b - c]; } },
    frac:  { name: '분수', time: 180, lv: [3, 3], quiz(G, lv, ri) {
      const n = [2, 3, 4, 5, 6, 8, 10][ri(0, 6)], k = ri(1, n - 1), m = ri(3, Math.floor(300 / n)); return [`${n * m}의 ${k}/${n}`, k * m]; } },
  },
  factions: {
    pioneers: { name: '개척단', hq: 'p_hq', worker: 'p_worker', supply: 'p_depot', defense: 'p_turret', blurb: '일꾼이 공사를 끝까지 맡는다. 보병과 포격으로 전선을 민다.',
      ai: { build: [{ b: 'p_barracks', n: 1 }, { b: 'p_extractor', n: 1 }, { b: 'p_barracks', n: 2, after: 120 }, { b: 'p_lab', n: 1 }, { b: 'p_factory', n: 1 }, { b: 'p_extractor', n: 2 }, { b: 'p_turret', n: 1 }, { b: 'p_barracks', n: 3, after: 420 }, { b: 'p_factory', n: 2, after: 540 }],
        army: [{ u: 'p_rifle', w: 5 }, { u: 'p_gren', w: 3 }, { u: 'p_medic', w: 1 }, { u: 'p_tank', w: 3 }, { u: 'p_gunship', w: 2 }], research: ['p_wpn1', 'p_stim', 'p_arm1', 'p_mech1'] } },
    ironclad: { name: '철갑회', hq: 'i_hq', worker: 'i_worker', supply: 'i_relay', defense: 'i_turret', selfBuild: true, blurb: '수집봇이 터를 잡으면 건물이 스스로 올라간다. 근접과 중장으로 밀어붙인다.',
      ai: { build: [{ b: 'i_forge', n: 1 }, { b: 'i_extractor', n: 1 }, { b: 'i_forge', n: 2, after: 120 }, { b: 'i_core', n: 1 }, { b: 'i_foundry', n: 1 }, { b: 'i_extractor', n: 2 }, { b: 'i_turret', n: 1 }, { b: 'i_forge', n: 3, after: 420 }, { b: 'i_foundry', n: 2, after: 540 }],
        army: [{ u: 'i_blade', w: 5 }, { u: 'i_striker', w: 4 }, { u: 'i_mender', w: 1 }, { u: 'i_colossus', w: 2 }, { u: 'i_wasp', w: 2 }], research: ['i_wpn1', 'i_servo', 'i_arm1', 'i_heavy1'] } },
    swarm: { name: '포자군락', hq: 's_hq', worker: 's_drone', supply: 's_pod', defense: 's_spine', morph: true, regen: .6, blurb: '일꾼이 건물로 변태하고, 유닛과 건물이 스스로 재생한다. 싼 무리로 몰아친다.',
      ai: { build: [{ b: 's_pool', n: 1 }, { b: 's_extractor', n: 1 }, { b: 's_pool', n: 2, after: 120 }, { b: 's_den', n: 1 }, { b: 's_nest', n: 1 }, { b: 's_extractor', n: 2 }, { b: 's_spine', n: 1 }, { b: 's_pool', n: 3, after: 420 }, { b: 's_nest', n: 2, after: 540 }],
        army: [{ u: 's_claw', w: 6 }, { u: 's_spitter', w: 4 }, { u: 's_nurse', w: 1 }, { u: 's_brute', w: 2 }, { u: 's_drake', w: 2 }], research: ['s_claws', 's_rush', 's_carapace', 's_acid'] } },
  },
  maps: {
    // ── 캠페인 전용 맵(gen: 'free', camp: true). 대칭이 아니고, 메뉴의 전장 목록에는 나오지 않는다. 기지 번호 = bases 순서 ──
    cm_landing: { name: '착륙 평원', gen: 'free', camp: true, w: 88, h: 64, theme: 'dusk', desc: '캠페인 · 서쪽 착륙지와 동쪽 고지 사이의 평원',
      bases: [{ x: 12, y: 32 }, { x: 76, y: 32 }, { x: 33, y: 11, ore: 6, vents: 1 }, { x: 33, y: 53, ore: 6, vents: 1 }, { x: 56, y: 11, ore: 6, vents: 1 }, { x: 56, y: 53, ore: 6, vents: 1 }, { x: 44, y: 32, ore: 5, vents: 1 }],
      rocks: [[22, 20, 3.5], [22, 44, 3.5], [44, 20, 3], [44, 44, 3], [66, 20, 3.5], [66, 44, 3.5], [8, 8, 2.5], [80, 56, 2.5], [44, 4, 2], [44, 60, 2]],
      sand: [[44, 32, 12], [20, 32, 6], [68, 32, 6]], sites: [[26, 26], [62, 38], [26, 38], [62, 26]], posts: [[6, 56], [82, 8]],
      lanes: [[12, 32, 76, 32, 3], [12, 32, 33, 11, 2.5], [12, 32, 33, 53, 2.5], [76, 32, 56, 11, 2.5], [76, 32, 56, 53, 2.5], [33, 11, 56, 11, 2.5], [33, 53, 56, 53, 2.5], [6, 6, 12, 32, 2]], clear: [[6, 6, 4], [6, 58, 4]] },
    cm_valley: { name: '잿빛 골짜기', gen: 'free', camp: true, w: 96, h: 72, theme: 'moss', desc: '캠페인 · 가운데 잿빛 부족의 골짜기, 네 모서리 기지',
      bases: [{ x: 12, y: 60 }, { x: 84, y: 12 }, { x: 12, y: 12, ore: 6, vents: 1 }, { x: 84, y: 60, ore: 6, vents: 1 }, { x: 48, y: 62, ore: 6, vents: 1 }, { x: 48, y: 10, ore: 6, vents: 1 }],
      tribe: [48, 36], rocks: [[36, 28, 4], [60, 44, 4], [36, 46, 3.5], [60, 26, 3.5], [24, 36, 3], [72, 36, 3], [30, 64, 2.5], [66, 8, 2.5]],
      walls: [[28, 20, 40, 20, 1.3], [56, 52, 68, 52, 1.3]], sand: [[48, 36, 10], [12, 36, 6], [84, 36, 6]], sites: [[30, 40], [66, 32], [22, 24], [74, 48]], posts: [[48, 24], [48, 50]],
      lanes: [[12, 60, 48, 36, 3], [84, 12, 48, 36, 3], [12, 12, 48, 36, 2.5], [84, 60, 48, 36, 2.5], [12, 60, 12, 12, 2.5], [84, 12, 84, 60, 2.5], [12, 60, 48, 62, 2.5], [84, 12, 48, 10, 2.5]] },
    cm_gorge: { name: '붉은 협곡', gen: 'free', camp: true, w: 128, h: 48, theme: 'ochre', desc: '캠페인 · 서에서 동으로 길게 이어지는 협곡과 관문',
      bases: [{ x: 11, y: 24 }, { x: 117, y: 24 }, { x: 44, y: 11, ore: 6, vents: 1 }, { x: 84, y: 37, ore: 6, vents: 1 }, { x: 64, y: 24, ore: 6, vents: 1 }],
      walls: [[26, 0, 26, 16, 1.4], [26, 32, 26, 48, 1.4], [54, 0, 54, 6, 1.4], [54, 30, 54, 48, 1.4], [74, 0, 74, 18, 1.4], [74, 42, 74, 48, 1.4], [102, 0, 102, 16, 1.4], [102, 32, 102, 48, 1.4]],
      rocks: [[36, 34, 4], [92, 12, 4], [64, 8, 3], [64, 40, 3]], sand: [[26, 24, 6], [102, 24, 6], [54, 18, 5], [74, 30, 5]], sites: [[38, 24], [90, 24]], posts: [[14, 8], [114, 40]],
      lanes: [[4, 24, 124, 24, 2.5], [44, 11, 54, 16, 2.5], [84, 37, 74, 30, 2.5]], clear: [[5, 24, 4], [123, 24, 4]] },
    cm_foundry: { name: '철갑 제련소', gen: 'free', camp: true, w: 96, h: 88, theme: 'dusk', desc: '캠페인 · 가운데 성벽 안 제련소, 남서·북동 본진',
      bases: [{ x: 14, y: 74 }, { x: 82, y: 14 }, { x: 48, y: 44, ore: 6, vents: 2 }, { x: 14, y: 14, ore: 6, vents: 1 }, { x: 82, y: 74, ore: 6, vents: 1 }],
      walls: [[34, 30, 62, 30, 1.3], [34, 58, 62, 58, 1.3], [34, 30, 34, 40, 1.3], [34, 48, 34, 58, 1.3], [62, 30, 62, 40, 1.3], [62, 48, 62, 58, 1.3]],
      rocks: [[24, 48, 3.5], [72, 40, 3.5], [48, 18, 3], [48, 70, 3], [26, 30, 2.5], [70, 58, 2.5]], sand: [[48, 44, 7], [14, 44, 5], [82, 44, 5]], sites: [[22, 60], [74, 28], [22, 28], [74, 60]], posts: [[6, 44], [90, 44]],
      lanes: [[14, 74, 34, 44, 3], [82, 14, 62, 44, 3], [14, 74, 82, 74, 2.5], [14, 14, 82, 14, 2.5], [14, 14, 14, 74, 2.5], [82, 14, 82, 74, 2.5], [34, 44, 62, 44, 3]], clear: [[90, 6, 4], [6, 82, 4]] },
    cm_frost: { name: '서리 고개', gen: 'free', camp: true, w: 72, h: 112, theme: 'frost', desc: '캠페인 · 남북으로 긴 눈 고개, 가운데 좁은 고갯마루',
      bases: [{ x: 36, y: 100 }, { x: 36, y: 12 }, { x: 12, y: 56, ore: 6, vents: 1 }, { x: 60, y: 56, ore: 6, vents: 1 }, { x: 36, y: 56, ore: 5, vents: 1 }, { x: 14, y: 84, ore: 5, vents: 1 }, { x: 58, y: 28, ore: 5, vents: 1 }],
      walls: [[0, 70, 28, 70, 1.4], [44, 70, 72, 70, 1.4], [0, 42, 28, 42, 1.4], [44, 42, 72, 42, 1.4]],
      rocks: [[24, 90, 3], [50, 90, 3], [24, 22, 3], [50, 22, 3], [24, 56, 2.5], [48, 56, 2.5]], sand: [[36, 70, 5], [36, 42, 5], [36, 56, 8]], sites: [[54, 84], [18, 28], [56, 100], [16, 12]], posts: [[6, 100], [66, 12]],
      lanes: [[36, 100, 36, 12, 3], [12, 56, 60, 56, 2.5], [36, 100, 14, 84, 2.5], [36, 12, 58, 28, 2.5], [36, 108, 36, 100, 2]], clear: [[36, 107, 4], [36, 5, 4]] },
    cm_marsh: { name: '포자 늪', gen: 'free', camp: true, w: 100, h: 100, theme: 'moss', desc: '캠페인 · 포자군락이 깨어난 늪지대',
      bases: [{ x: 14, y: 86 }, { x: 86, y: 14 }, { x: 14, y: 14, ore: 7, vents: 1 }, { x: 86, y: 86, ore: 7, vents: 1 }, { x: 50, y: 50, ore: 6, vents: 2 }, { x: 50, y: 88, ore: 5, vents: 1 }, { x: 50, y: 12, ore: 5, vents: 1 }],
      rocks: [[32, 32, 4], [68, 68, 4], [32, 68, 4], [68, 32, 4], [50, 30, 2.5], [50, 70, 2.5], [30, 50, 2.5], [70, 50, 2.5]], sand: [[50, 50, 14], [22, 50, 7], [78, 50, 7], [50, 24, 6], [50, 76, 6]],
      sites: [[36, 50], [64, 50], [50, 38], [50, 62]], posts: [[6, 50], [94, 50]],
      lanes: [[14, 86, 50, 50, 3], [86, 14, 50, 50, 3], [14, 14, 50, 50, 2.5], [86, 86, 50, 50, 2.5], [14, 86, 14, 14, 2.5], [86, 14, 86, 86, 2.5], [14, 86, 86, 86, 2.5], [14, 14, 86, 14, 2.5]], clear: [[6, 94, 4], [94, 6, 4]] },
    cm_ruins: { name: '고대 유적', gen: 'free', camp: true, w: 104, h: 104, theme: 'ochre', desc: '캠페인 · 가운데 「심연의 문」을 둘러싼 고대 성벽',
      bases: [{ x: 12, y: 92 }, { x: 92, y: 92 }, { x: 52, y: 12 }, { x: 12, y: 12, ore: 6, vents: 1 }, { x: 92, y: 12, ore: 6, vents: 1 }, { x: 52, y: 52, ore: 0, vents: 0 }, { x: 52, y: 92, ore: 6, vents: 1 }],
      walls: [[36, 36, 48, 36, 1.3], [56, 36, 68, 36, 1.3], [36, 68, 48, 68, 1.3], [56, 68, 68, 68, 1.3], [36, 36, 36, 48, 1.3], [36, 56, 36, 68, 1.3], [68, 36, 68, 48, 1.3], [68, 56, 68, 68, 1.3]],
      rocks: [[24, 52, 4], [80, 52, 4], [52, 26, 3], [30, 30, 2.5], [74, 30, 2.5], [30, 76, 2.5], [74, 76, 2.5]], sand: [[52, 52, 8], [52, 80, 6]], sites: [[24, 70], [80, 70], [24, 36], [80, 36]], posts: [[6, 52], [98, 52]],
      lanes: [[12, 92, 52, 92, 3], [92, 92, 52, 92, 3], [12, 92, 52, 52, 2.5], [92, 92, 52, 52, 2.5], [52, 12, 52, 52, 3], [12, 12, 52, 12, 2.5], [92, 12, 52, 12, 2.5], [12, 92, 12, 12, 2.5], [92, 92, 92, 12, 2.5]], clear: [[6, 98, 4], [98, 98, 4]] },
    cm_core: { name: '잿빛 심장', gen: 'free', camp: true, w: 120, h: 120, theme: 'frost', desc: '캠페인 · 행성 깊은 곳, 심장을 둘러싼 동굴 고리',
      bases: [{ x: 20, y: 106 }, { x: 100, y: 106 }, { x: 60, y: 14 }, { x: 14, y: 60, ore: 6, vents: 1 }, { x: 106, y: 60, ore: 6, vents: 1 }, { x: 60, y: 60, ore: 0, vents: 0 }, { x: 60, y: 104, ore: 6, vents: 1 }, { x: 24, y: 22, ore: 5, vents: 1 }, { x: 96, y: 22, ore: 5, vents: 1 }],
      walls: [[40, 40, 56, 40, 1.4], [64, 40, 80, 40, 1.4], [40, 80, 56, 80, 1.4], [64, 80, 80, 80, 1.4], [40, 40, 40, 56, 1.4], [40, 64, 40, 80, 1.4], [80, 40, 80, 56, 1.4], [80, 64, 80, 80, 1.4]],
      rocks: [[30, 86, 3.5], [90, 86, 3.5], [30, 40, 3.5], [90, 40, 3.5], [60, 88, 3], [60, 30, 3], [22, 60, 2.5], [98, 60, 2.5]], sand: [[60, 60, 10], [60, 104, 6]], sites: [[30, 70], [90, 70], [36, 30], [84, 30]], posts: [[6, 60], [114, 60]],
      lanes: [[20, 106, 60, 104, 3], [100, 106, 60, 104, 3], [60, 104, 60, 60, 3], [60, 14, 60, 60, 3], [14, 60, 60, 60, 3], [106, 60, 60, 60, 3], [20, 106, 14, 60, 2.5], [100, 106, 106, 60, 2.5], [14, 60, 24, 22, 2.5], [106, 60, 96, 22, 2.5], [24, 22, 60, 14, 2.5], [96, 22, 60, 14, 2.5]], clear: [[8, 114, 4], [112, 114, 4], [60, 114, 4]] },

    ridge: { name: '쌍둥이 능선', gen: 'symmetric', w: 72, h: 72, theme: 'dusk', desc: '72×72 · 기지 6 · 시작 후보 4(네 모서리) · 중앙이 트인 맵',
      bases: [{ x: 11, y: 11, start: 0, dir: 3.93 }, { x: 13, y: 36, dir: 3.14, ore: 6, oneVent: true }, { x: 58, y: 14, dir: 5.5, spawn: true }],
      sites: [[27, 42], [46, 17]], posts: [[36, 5], [5, 48]], rocks: [[26, 20, 4], [20, 26, 4], [36, 24, 3], [30, 12, 3], [44, 8, 3], [24, 46, 3.5], [10, 52, 4], [36, 36, 2.5], [46, 26, 3]],
      sand: [[36, 36, 14], [24, 30, 8], [52, 20, 9]],
      lanes: [[11, 11, 23, 23, 3], [23, 23, 36, 36, 4], [13, 36, 28, 36, 3], [58, 14, 44, 28, 3], [23, 23, 13, 36, 2.5]] },
    canyon: { name: '협곡 회랑', gen: 'symmetric', w: 96, h: 48, theme: 'ochre', desc: '96×48 · 기지 6 · 시작 후보 4 · 좁은 관문 세 곳',
      bases: [{ x: 11, y: 24, start: 0, dir: 3.14 }, { x: 34, y: 10, dir: 4.71, spawn: true }, { x: 34, y: 38, dir: 1.57, ore: 6, oneVent: true }],
      sites: [[42, 15], [57, 33]], posts: [[14, 6], [36, 25]], walls: [[24, 0, 24, 15, 1.4], [24, 33, 24, 48, 1.4], [48, 0, 48, 10, 1.6], [48, 19, 48, 29, 1.6], [48, 38, 48, 48, 1.6]],
      rocks: [[40, 24, 3.5]], sand: [[48, 14, 7], [48, 34, 7], [24, 24, 8]],
      lanes: [[11, 24, 40, 24, 2.5], [34, 10, 62, 10, 2.5], [34, 38, 62, 38, 2.5]] },
    crossroads: { name: '빙원 십자로', gen: 'symmetric', w: 80, h: 80, spawnGap: 40, theme: 'frost', desc: '80×80 · 기지 6 · 시작 후보 4 · 본진 앞 관문과 중앙 원형 교차로',
      bases: [{ x: 40, y: 9, start: 0, dir: 4.71 }, { x: 11, y: 12, dir: 3.93, spawn: true }, { x: 12, y: 46, dir: 3.14, ore: 6, oneVent: true }],
      sites: [[22, 33], [40, 27]], posts: [[5, 29], [62, 40]],
      walls: [[2, 22, 33, 22, 1.3], [47, 22, 78, 22, 1.3]],
      rocks: [[25, 30, 4.5], [55, 30, 4.5], [40, 40, 3.2], [30, 62, 3], [5, 66, 3.5], [74, 50, 2.5]],
      sand: [[40, 40, 11], [11, 30, 6], [62, 8, 5]],
      lanes: [[40, 9, 40, 32, 3.5], [40, 9, 11, 12, 3], [11, 12, 12, 46, 2.5], [12, 46, 32, 46, 3], [40, 32, 32, 46, 2.5]] },
    lake: { name: '거울 호수', gen: 'symmetric', w: 96, h: 64, theme: 'moss', desc: '96×64 · 기지 6 · 시작 후보 4 · 중앙 호수를 도는 두 갈래 길, 뒷마당 확장',
      bases: [{ x: 11, y: 32, start: 0, dir: 3.14 }, { x: 13, y: 9, dir: 3.93, ore: 6, oneVent: true }, { x: 48, y: 11, dir: 4.71, spawn: true }],
      sites: [[30, 14], [34, 50]], posts: [[6, 56], [62, 30]],
      walls: [[2, 19, 26, 19, 1.4], [26, 2, 26, 19, 1.4]],
      rocks: [[48, 32, 9], [40, 27, 4], [30, 32, 3], [72, 20, 3], [22, 48, 3.5]],
      sand: [[48, 32, 15], [48, 9, 7]],
      lanes: [[11, 32, 32, 24, 3], [32, 24, 48, 17, 3], [11, 32, 26, 44, 3], [26, 44, 48, 50, 3], [13, 9, 18, 24, 2.5]] },
    // 높낮이 맵: highs(고지대 원, 단계 1·2)와 ramps(경사로)를 쓴다. 절벽은 지나갈 수 없고, 경사로로만 오르내린다.
    // 낮은 곳에서는 높은 곳이 보이지 않고, 아래에서 위로 쏘면 피해가 25% 준다. 높은 곳에 있으면 단계당 시야 +1.
    highland: { name: '고원 요새', gen: 'symmetric', w: 112, h: 112, theme: 'dusk', desc: '112×112 · 기지 8 · 시작 후보 4(모두 고지대) · 높낮이 맵. 고지대 본진, 2단 중앙 언덕. 아래에선 위가 안 보이고 위로 쏘면 피해 -25%',
      highs: [[13, 13, 17, 1], [56, 56, 15, 1], [56, 56, 6.5, 2], [17, 84, 13, 1], [44, 30, 6, 1]],
      ramps: [[33.5, 20.5, 28.5, 18.5, 2.2], [37.5, 44.5, 45, 49, 2.4], [74.5, 44.5, 67.5, 50, 2.4], [47.5, 51.5, 53.5, 54.5, 1.7], [35, 85, 28, 85, 2.2], [44, 39, 44, 34.5, 1.6]],
      bases: [{ x: 13, y: 13, start: 0, dir: 3.93 }, { x: 42, y: 13, dir: 4.71, ore: 7, oneVent: true }, { x: 14, y: 46, dir: 3.14, ore: 6, oneVent: true }, { x: 15, y: 84, dir: 3.14, spawn: true }],
      sites: [[30, 62], [70, 22]], posts: [[50, 4], [4, 64]],
      rocks: [[28, 32, 3.5], [32, 50, 3], [62, 30, 3.5], [84, 14, 3], [30, 100, 3], [8, 104, 3], [70, 70, 2.5], [40, 70, 3]],
      sand: [[56, 56, 22], [30, 40, 7], [88, 32, 8]],
      lanes: [[33, 20, 42, 13, 3], [33, 20, 38, 44, 3], [14, 46, 38, 44, 3], [14, 46, 30, 84, 2.5], [42, 13, 74, 44, 3], [34, 85, 56, 96, 3]] },
    terrace: { name: '계단 협곡', gen: 'symmetric', w: 144, h: 96, theme: 'ochre', desc: '144×96 · 기지 8 · 시작 후보 4 · 높낮이 맵. 3단 계단식 본진, 넓은 저지대와 중앙 고원. 경사로로만 오르내린다',
      highs: [[16, 48, 31, 1], [11, 48, 13, 2], [72, 48, 13, 1], [60, 24, 6, 1], [40, 87, 11, 1]],
      ramps: [[28, 48, 20.5, 48, 2.2], [48.4, 34.9, 41, 37.9, 2.4], [48.4, 61.1, 41, 58.1, 2.4], [55, 48, 62.5, 48, 2.6], [72, 65, 72, 57.5, 2.2], [60, 33, 60, 28, 1.8], [44.5, 71.5, 42.5, 78, 2.2]],
      bases: [{ x: 11, y: 48, start: 0, dir: 3.14 }, { x: 27, y: 32, dir: 4.0, ore: 7, oneVent: true }, { x: 50, y: 11, dir: 4.71, ore: 7, oneVent: true }, { x: 40, y: 85, dir: 1.57, spawn: true }],
      sites: [[48, 26], [86, 30]], posts: [[100, 6], [26, 90]],
      walls: [[44, 0, 44, 5, 1.5], [30, 82, 30, 96, 1.4]],
      rocks: [[54, 68, 3.5], [88, 64, 3], [30, 4, 3], [104, 40, 3], [8, 90, 3], [78, 10, 3], [60, 84, 3]],
      sand: [[72, 48, 20], [50, 11, 7], [40, 85, 7]],
      lanes: [[28, 48, 41, 38, 3], [27, 32, 41, 38, 3], [48, 35, 50, 11, 3], [48, 61, 40, 85, 3], [48, 61, 55, 48, 3], [72, 65, 86, 88, 3]] },
  },
});

// ── 합체 유닛 ──────────────────────────────────────────────
// at 건물이 강화 2단계면, 재료 유닛 하나를 길게 누르거나 명령 카드 '합체'로 주변 재료를 모아 합친다(upgrade.js).
// 스탯은 RTS.fuseDef가 재료에서 계산한다: 체력 합, 초당 피해 합 × 0.75(두 기면 1.5배), 속도는 가장 느린 재료.
RTS.mod({ entities: {
  p_commando: RTS.fuseDef({ p_rifle: 1, p_gren: 1 }, { name: '특공대', abbr: '특', art: 'commando', r: .48, abilities: ['stim', 'morph'], form: { name: '돌격 형태', desc: '속도 +25%, 공격 간격 -30%, 체력 -10%', mods: { speed: 1.25, cooldown: .7, hp: .9 } }, desc: '소총병과 척탄병의 합체. 범위 사격, 공중 공격 가능, 과충전. ★2에서 돌격 형태로 변신' }),
  p_titan:    RTS.fuseDef({ p_tank: 2, p_gunship: 2, p_worker: 1 }, { name: '거대로봇', abbr: '거', art: 'titan', r: 1.25, abilities: ['shock', 'morph'], form: { name: '요새 형태', root: true, desc: '제자리에 고정. 사거리 +60%, 공격력 +40%, 방어 +70%', mods: { range: 1.6, damage: 1.4, armor: 1.7 } }, weapon: { splash: 1.2 }, desc: '포격전차 2·강습기 2·공병 1의 합체. 지상·공중 범위 화력, 충격파' }),
  i_duelist:  RTS.fuseDef({ i_blade: 2, i_striker: 1 }, { name: '쌍날기사', abbr: '쌍', art: 'duelist', r: .6, abilities: ['morph'], form: { name: '저격 형태', root: true, desc: '제자리에 고정. 사거리 +60%, 공격력 +60%, 공격 간격 +30%', mods: { range: 1.6, damage: 1.6, cooldown: 1.3 } }, desc: '칼날봇 2·사수봇 1의 합체. 단단한 원거리 기사. ★2에서 저격 형태로 변신' }),
  i_juggernaut: RTS.fuseDef({ i_colossus: 2, i_wasp: 1, i_worker: 1 }, { name: '철갑거신', abbr: '신', art: 'juggernaut', r: 1.3, abilities: ['shock', 'morph'], form: { name: '방벽 형태', desc: '체력 +30%, 방어 ×2, 속도 -40%, 공격력 -10%', mods: { hp: 1.3, armor: 2, speed: .6, damage: .9 } }, desc: '중장봇 2·말벌기 1·수집봇 1의 합체. 매우 단단한 범위 화력, 공중 공격 가능' }),
  s_venom:    RTS.fuseDef({ s_claw: 2, s_spitter: 1 }, { name: '맹독충', abbr: '맹', art: 'venom', r: .55, abilities: ['acid', 'morph'], form: { name: '맹독 형태', desc: '속도 +30%, 공격력 +35%, 체력 -15%', mods: { speed: 1.3, damage: 1.35, hp: .85 } }, desc: '갈퀴충 2·산탄충 1의 합체. 원거리 사격, 산성 분사' }),
  s_behemoth: RTS.fuseDef({ s_brute: 2, s_drake: 2 }, { name: '포자거수', abbr: '수', art: 'behemoth', r: 1.3, abilities: ['frenzy', 'morph'], form: { name: '분노 형태', desc: '속도 +20%, 공격 간격 -25%, 방어 -50%', mods: { speed: 1.2, cooldown: .75, armor: .5 } }, desc: '거대충 2·독침비행체 2의 합체. 거대한 체력, 지상·공중 공격, 광분' }),
}, merges: {
  // parts: 재료와 수, at: 강화 2단계가 필요한 건물, into: 결과 유닛
  commando:   { faction: 'pioneers', at: 'p_barracks', parts: { p_rifle: 1, p_gren: 1 }, into: 'p_commando' },
  titan:      { faction: 'pioneers', at: 'p_factory', parts: { p_tank: 2, p_gunship: 2, p_worker: 1 }, into: 'p_titan' },
  duelist:    { faction: 'ironclad', at: 'i_forge', parts: { i_blade: 2, i_striker: 1 }, into: 'i_duelist' },
  juggernaut: { faction: 'ironclad', at: 'i_foundry', parts: { i_colossus: 2, i_wasp: 1, i_worker: 1 }, into: 'i_juggernaut' },
  venom:      { faction: 'swarm', at: 's_pool', parts: { s_claw: 2, s_spitter: 1 }, into: 's_venom' },
  behemoth:   { faction: 'swarm', at: 's_nest', parts: { s_brute: 2, s_drake: 2 }, into: 's_behemoth' },
} });
