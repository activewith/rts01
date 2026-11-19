// 캠페인 「잿빛 심장」. 구조는 src/engine/campaign.js 머리말.
// 1인: 개척단·철갑회·포자군락 각 5장 → 2인 「연합 전선」 5장 → (2인 5장을 어려움으로 깨면) 히든 미션 「심연의 문」 → 히든 캠페인 「잿빛 심장」 3장.
// say: [[말하는 사람, 대사]] 또는 G => 그 목록. 진영을 고르는 미션(2인·히든)은 대사도 함수로 진영에 맞춘다.
(function () {
  const C = () => RTS.camp, me = 0;
  const LEAD = { pioneers: '대장 한별', ironclad: '지휘관 벨카', swarm: '여왕 세라' }, AIDE = { pioneers: '기술병 미르', ironclad: '연산핵 오르도', swarm: '감응체 울림' };
  const lead = (G, t) => LEAD[G.teams[t].faction], aide = (G, t) => AIDE[G.teams[t].faction], fn = (G, t) => RTS.defs.factions[G.teams[t].faction].name;
  const P = G => G.camp.ps;
  // ── 목표 만들기 ──
  const oreGoal = need => ({ text: `광석 ${need} 캐기`, prog: G => [Math.floor(P(G).reduce((s, t) => s + G.teams[t].stats.ore, 0)), need] });
  const reach = (key, x, y, r, text, label, done, each) => ({ text, key, at: [x, y, r, label], test: G => C().near(G, x, y, r, each), done });
  const have = (role, need, text) => ({ text, prog: G => [C().countRole(G, role), need] });
  const kill = (flag, text) => ({ text, prog: G => { const ids = G.camp.flags[flag] || []; return [ids.length - C().alive(G, ids), Math.max(1, ids.length)]; } });
  const survive = (sec, text) => ({ text: text || `${Math.floor(sec / 60)}분${sec % 60 ? ' ' + sec % 60 + '초' : ''} 버티기`, prog: G => [Math.floor(RTS.campStageSec(G)), sec] });
  const razeHq = (text) => ({ text: G => `${text || fn(G, C().foe(G)) + ' 본진 모두 무너뜨리기'} (남은 ${C().left(G, C().foe(G), 'hq')})`, brief: text || '적 본진 모두 무너뜨리기', prog: G => [C().left(G, C().foe(G), 'hq') ? 0 : 1, 1] });
  // 표시한 건물·유닛(flag에 id 목록)을 모두 부수기. 남은 것은 지도에 표식
  const razeIds = (flag, text, label) => ({ text: G => `${text} (남은 ${C().alive(G, G.camp.flags[flag])})`, brief: text, prog: G => { const ids = G.camp.flags[flag] || []; return [ids.length - C().alive(G, ids), Math.max(1, ids.length)]; }, label: label || '목표' });
  const marksOf = (flag, label) => G => (G.camp.flags[flag] || []).map(i => G.byId[i]).filter(e => e && !e.dead).map(e => ({ x: e.x, y: e.y, r: 3.5, label }));
  const hold = (key, x, y, need, text, label) => ({ text, key, need, at: [x, y, 6, label], acc: G => C().near(G, x, y, 6) && C().foesNear(G, x, y, 6) === 0 });
  // ── 부대·건물 ──
  const squad = (G, team, list, x, y) => C().spawnAt(G, team, list, x, y);
  const guards = (G, x, y, tier, n, team) => { const t = team === undefined ? C().npc(G) : team; return C().spawnAt(G, t, C().army(C().fac(G, t), tier, C().n(G, n)), x, y); };
  // 수비대 기지: roles(역할 이름) 건물을 (x, y) 둘레에 짓고 경비를 세운다. 건물 id 목록
  const OFF = [[0, 0], [4, 1], [-4, 1], [1, 4], [1, -4], [4, 4], [-4, -4]];
  const outpost = (G, x, y, roles, tier, n, lv, team) => { const t = team === undefined ? C().npc(G) : team, f = C().fac(G, t), ids = [];
    roles.forEach((r, k) => { const e = C().building(G, t, C().rid(f, r), x + OFF[k % OFF.length][0], y + OFF[k % OFF.length][1], lv); if (e) ids.push(e.id); });
    if (n) guards(G, x, y + 2, tier, n, t); return ids; };
  // 적 습격: from에서 사람 편의 가장 가까운 건물(없으면 유닛)로. n번째 습격일수록 커진다
  const tierOf = n => (n < 4 ? 1 : n < 7 ? 2 : 3);
  const raid = (G, n, from, size, say) => { const f = C().foe(G), tgt = C().nearest(G, undefined, from); if (!tgt || f < 0) return;
    const list = C().army(C().fac(G, f), tierOf(n), C().n(G, size + Math.floor(n * .6))); C().spawnAt(G, f, list, from.x, from.y, tgt);
    if (say !== false) RTS.campSay(G, aide(G, P(G)[0]), say || `${fn(G, f)} 부대 ${list.length}기가 다가옵니다!`); };
  const unhold = G => C().unhold(G);
  const AI_HOLD = { hold: true, noTribe: true, noDip: true };
  const solo = (faction, foe, base, foeBase, extra) => [Object.assign({ role: 'me', faction, base }, extra && extra.me), Object.assign({ role: 'foe', faction: foe, base: foeBase }, extra && extra.foe), { role: 'npc', faction: (extra && extra.npc) || foe }];
  const duo = (b0, b1, b2, extra) => [Object.assign({ role: 'me', faction: 'A', base: b0 }, extra && extra.me), Object.assign({ role: 'mate', faction: 'B', base: b1 }, extra && extra.mate), Object.assign({ role: 'foe', faction: 'C', base: b2 }, extra && extra.foe), { role: 'npc', faction: 'C' }];

  // ════════════════════ 1인 · 개척단 ════════════════════
  const pioneers = [
    { id: 'p1', title: '1장 · 첫 착륙', map: 'cm_landing', faction: 'pioneers', tribe: false, teams: solo('pioneers', 'ironclad', 0, 1, { me: { noBase: true }, foe: { aiState: AI_HOLD } }),
      brief: ['개척단 착륙선이 낯선 행성 「회색 대지」에 내렸다. 그런데 정찰대가 탄 작은 배는 목표에서 한참 떨어진 곳에 떨어졌다.', '착륙 신호기까지 걸어가서 본대를 불러야 한다.', '이 땅 깊은 곳에는 우주선 연료가 되는 광석이 잠들어 있다.'],
      setup(G) { squad(G, me, ['p_rifle', 'p_rifle', 'p_rifle', 'p_rifle', 'p_worker', 'p_worker'], 6, 6); G.camp.flags.g1 = C().spawnAt(G, C().npc(G), ['i_blade', 'i_blade'], 10, 20); }, // 첫 경비는 난이도와 무관하게 2기(여기서 지면 진행이 막힌다)
      stages: [
        { say: [['대장 한별', '으윽… 다들 괜찮나? 배가 엉뚱한 데 떨어졌군.'], ['기술병 미르', '대장님, 남쪽에 착륙 신호기가 보여요! 거기서 본대를 부를 수 있어요.'], ['대장 한별', '부대를 골라 신호기 쪽을 눌러라(마우스는 우클릭). 가는 길에 뭔가 있을지 모르니 조심하고.']],
          goals: [reach('land', 12, 32, 5, '착륙 신호기까지 이동', '착륙 신호기', G => { C().base(G, me, 12, 32, 3); RTS.campSay(G, '기술병 미르', '본대 착륙선이 내려왔어요! 사령부와 공병이 도착했습니다.'); })] },
        { say: [['대장 한별', '기지가 섰다. 먼저 광석을 모으자.'], ['기술병 미르', '공병은 알아서 캐요. 사령부를 고르고 공병을 더 뽑으면 빨라져요.']], goals: [oreGoal(300)] },
        { say: [['대장 한별', '이제 병사를 키울 병영이 필요하다. 공병을 골라 병영을 지어라.']], goals: [have('barracks', 1, '병영 1채 짓기')] },
        { say: [['대장 한별', '병영이 섰다. 소총병을 늘려 모두 8명이 되게 하자.']], goals: [have('p_rifle', 8, '소총병 8기 갖기')] },
        { enter(G) { G.camp.flags.scouts = C().spawnAt(G, C().foe(G), C().army('ironclad', 1, C().n(G, 5)), 76, 32, C().hq(G, me)); },
          say: [['기술병 미르', '대장님! 동쪽에서 기계 반응이 다가와요!'], ['철갑회 통신', '…이 광맥은 철갑회의 것이다. 물러가라.'], ['대장 한별', '철갑회 정찰대다! 기지를 지켜라!']],
          goals: [kill('scouts', '철갑회 정찰대 물리치기')] },
      ],
      win: [['대장 한별', '정찰대를 물리쳤다. 하지만 철갑회는 다시 올 거야.'], ['기술병 미르', '대장님, 이 행성에 사람들이 산다는 기록이 있어요. 잿빛 부족이라고…'], ['대장 한별', '그들을 찾아보자. 도움을 받을 수 있을지도 몰라.']] },

    { id: 'p2', title: '2장 · 잿빛 부족', map: 'cm_valley', faction: 'pioneers', teams: solo('pioneers', 'ironclad', 0, 1, { foe: { aiState: AI_HOLD } }),
      brief: ['회색 대지에는 오래전부터 「잿빛 부족」이 살고 있었다. 부족은 지혜로운 사람만 믿는다.', '먼저 북쪽에서 끊긴 정찰대의 신호를 찾고, 골짜기 가운데의 부족 회당을 찾아가자.', '철갑회는 그동안에도 작은 부대를 보내 기지를 괴롭힌다.'],
      setup(G) { guards(G, 13, 22, 1, 3); },
      carryOut: G => ({ req: RTS.tribeReqOf && RTS.tribeReqOf(G, me) }),
      stages: [
        { say: [['기술병 미르', '대장님, 북쪽에서 정찰대 구조 신호가 잡혀요!'], ['대장 한별', '병사들을 보내 데려오자. 철갑회가 지키고 있을지도 모른다.']],
          goals: [reach('lost', 12, 12, 5, '끊긴 정찰대 신호 찾기', '구조 신호', G => { squad(G, me, ['p_rifle', 'p_rifle', 'p_rifle', 'p_medic'], 12, 12); RTS.campSay(G, '정찰병 다온', '살았다! 대장님, 저희도 함께 가겠습니다. 부족의 회당은 골짜기 한가운데 있어요.'); })] },
        { say: [['대장 한별', '잿빛 부족의 회당이 골짜기 가운데 있다고 했지.'], ['기술병 미르', '회당이 보이면 왼쪽 위에 부족 창이 떠요.']],
          goals: [{ text: '잿빛 부족 회당 찾기', prog: G => [G.tribe && G.tribe.found[me] ? 1 : 0, 1] }] },
        { say: [['족장 바루', '하늘에서 온 손님이군. 우리는 지혜로운 이만 믿는다.'], ['족장 바루', '공병을 회당으로 보내라. 내가 내는 문제 두 개를 풀면 친구로 받아 주지.'], ['기술병 미르', '공병을 고르고 회당을 누르면(마우스는 우클릭) 돼요. 답만큼 광석을 보내야 하니 광석도 모아 두세요!']],
          goals: [{ text: '부족의 문제 2개 풀고 동맹 맺기', prog: G => [G.tribe && G.tribe.rel[me] === 'ally' ? 1 : 0, 1] }],
          fail: G => !G.tribe || G.tribe.dead ? '잿빛 부족 회당이 무너졌습니다' : G.tribe.rel[me] === 'hostile' ? '잿빛 부족이 등을 돌렸습니다. 다시 도전해 보세요' : null },
        { say: [['족장 바루', '훌륭하다! 이제 너희는 우리의 친구다.'], ['족장 바루', '우리가 무엇을 도와주면 좋겠나? 하나를 골라라.'], ['대장 한별', '부족 창에서 요청을 하나 고르자. 이 선택은 4장 싸움에도 이어진다.']],
          goals: [{ text: '부족에게 할 요청 고르기', prog: G => [RTS.tribeReqOf(G, me) ? 1 : 0, 1] }] },
      ],
      events: [{ every: 150, from: 150, run: (G, n) => raid(G, n, { x: 84, y: 12 }, 2) }],
      win: [['족장 바루', '철갑회는 이 땅을 파헤치고 우리 숲을 태웠다. 함께 그들을 몰아내자.'], ['족장 바루', '하지만 그 전에… 동쪽 붉은 협곡에 너희 동료들이 갇혀 있다고 들었다.'], ['대장 한별', '협곡을 건너 그들을 구하러 가자!']] },

    { id: 'p3', title: '3장 · 협곡 행군', map: 'cm_gorge', faction: 'pioneers', tribe: false, teams: solo('pioneers', 'ironclad', 4, 1, { me: { noBase: true }, foe: { aiState: AI_HOLD } }),
      brief: ['기지를 남겨 두고 정예 부대만 붉은 협곡으로 들어간다.', '협곡 곳곳의 관문은 철갑회가 지키고 있다. 고립된 공병들을 구하고 옛 전초기지까지 가야 한다.', '의무병이 다친 병사를 치료한다. 무리하게 뛰어들지 말자.'],
      setup(G) { squad(G, me, ['p_rifle', 'p_rifle', 'p_rifle', 'p_rifle', 'p_rifle', 'p_rifle', 'p_gren', 'p_gren', 'p_medic', 'p_medic', 'p_tank'], 6, 24); G.teams[me].res.ore = 300;
        guards(G, 30, 24, 1, 3); guards(G, 48, 14, 1, 2); guards(G, 60, 24, 2, 3); C().building(G, C().npc(G), 'i_turret', 57, 20); },
      stages: [
        { say: [['대장 한별', '여기가 붉은 협곡이군. 길이 좁다. 한데 모여서 움직이자.'], ['기술병 미르', '첫 관문 너머에 철갑회 경비가 있어요.']],
          goals: [reach('g1', 38, 24, 5, '첫 관문 지나기', '첫 관문')] },
        { say: [['기술병 미르', '북쪽 바위 틈에서 공병들 신호가 잡혀요!']],
          goals: [reach('eng', 44, 12, 5, '고립된 공병 구조하기', '고립된 공병', G => { squad(G, me, ['p_worker', 'p_worker', 'p_worker', 'p_worker', 'p_rifle', 'p_rifle'], 44, 12); RTS.campSay(G, '공병 반장 두리', '와 주셨군요! 협곡 가운데 옛 전초기지를 다시 세우면 버틸 수 있어요.'); })] },
        { say: [['대장 한별', '옛 전초기지로 가자. 그곳을 되찾으면 사령부를 다시 세울 수 있다.']],
          goals: [reach('fort', 64, 24, 5, '옛 전초기지 되찾기', '옛 전초기지', G => { C().base(G, me, 64, 24, 0); G.teams[me].res.ore += 200; RTS.campSay(G, '공병 반장 두리', '사령부를 세웠어요! 공병들을 광맥으로 보내세요.'); })] },
        { say: [['철갑회 통신', '협곡을 넘다니. 하지만 여기가 너희 무덤이다.'], ['대장 한별', '철갑회가 몰려온다! 병영과 포탑을 세우고 버텨라!']],
          goals: [survive(180, '전초기지 3분 지키기')] },
      ],
      events: [{ stage: 3, every: 40, from: 25, run: (G, n) => raid(G, n, { x: 117, y: 24 }, 2) }],
      win: [['대장 한별', '버텼다! 협곡은 이제 우리 것이다.'], ['기술병 미르', '대장님, 철갑회의 본거지가 남쪽 제련소에 있다는 신호를 잡았어요.'], ['대장 한별', '이제 광맥을 되찾을 차례다.']] },

    { id: 'p4', title: '4장 · 광맥 탈환', map: 'cm_foundry', faction: 'pioneers', tribe: false, teams: solo('pioneers', 'ironclad', 0, 1, { foe: { aiState: { noTribe: true } } }),
      brief: ['철갑회는 성벽 안 제련소에서 광석을 녹여 기계를 찍어 내고 있다.', '가운데 제련소를 부수고, 철갑회 중추를 무너뜨려라.', '2장에서 잿빛 부족에게 한 부탁이 이번 싸움을 돕는다.'],
      setup(G, carry) { const h = C().hq(G, me), req = carry.req || 'defend';
        if (req === 'strike') squad(G, me, ['p_rifle', 'p_rifle', 'p_rifle', 'p_rifle', 'p_gren'], h.x + 4, h.y - 4);
        else if (req === 'share') { G.teams[me].res.ore += 300; G.teams[me].res.gas += 100; }
        else { C().building(G, me, 'p_turret', h.x + 6, h.y - 5); C().building(G, me, 'p_turret', h.x + 7, h.y + 1); }
        G.camp.flags.fort = outpost(G, 48, 44, ['factory', 'defense', 'defense'], 2, 4, 1); },
      stages: [
        { say: G => [['대장 한별', '여기가 철갑 제련소다.'], ['족장 바루', ({ strike: '약속대로 우리 전사들의 몫으로 병사들을 보냈다.', share: '약속대로 광석과 에테르를 나눠 주었다.' })[G.camp.carry.req] || '약속대로 기지 둘레에 망루를 세워 두었다.'], ['기술병 미르', '가운데 성벽 안에 중공장이 있어요. 그걸 부수면 철갑회 힘이 크게 꺾여요.']],
          marks: marksOf('fort', '제련소'), goals: [razeIds('fort', '가운데 제련소 부수기', '제련소')] },
        { say: [['철갑회 통신', '제련소를 잃다니…! 전 기계에 알린다. 침입자를 없애라!'], ['대장 한별', '이제 철갑회 중추만 남았다. 끝내자!']], goals: [razeHq('철갑회 중추 모두 무너뜨리기')] },
      ],
      events: [{ at: 0, when: G => { const h = C().hq(G, C().foe(G)); return h && h.hp < RTS.stat(G, h, 'hp') * .5; }, run: G => RTS.campSay(G, '대장 한별', '중추가 흔들린다! 조금만 더!') }],
      win: [['대장 한별', '해냈다! 광맥을 되찾았다.'], ['족장 바루', '고맙다, 하늘의 친구들. 숲이 다시 숨을 쉬겠구나.'], ['기술병 미르', '대장님… 동쪽 늪에서 이상한 포자 냄새가 나요. 무언가 깨어나고 있어요.']] },

    { id: 'p5', title: '5장 · 포자의 밤', map: 'cm_marsh', faction: 'pioneers', tribe: false, teams: solo('pioneers', 'swarm', 0, 1, { foe: { aiState: AI_HOLD } }),
      brief: ['늪에서 깨어난 포자군락이 개척단 기지를 덮친다.', '밤이 지날 때까지 버티고, 늪 한가운데의 포자 둥지와 군락핵을 태워라.', '포자군락은 스스로 상처를 회복한다. 한 번에 몰아쳐야 한다.'],
      setup(G) { const h = C().hq(G, me); C().building(G, me, 'p_barracks', h.x + 6, h.y - 4); C().building(G, me, 'p_turret', h.x + 8, h.y - 9); C().building(G, me, 'p_turret', h.x + 10, h.y - 2);
        squad(G, me, ['p_rifle', 'p_rifle', 'p_rifle', 'p_rifle', 'p_gren', 'p_medic'], h.x + 5, h.y - 7); G.teams[me].res.ore += 200;
        G.camp.flags.nests = outpost(G, 50, 50, ['factory', 'defense'], 2, 3, 1).concat(outpost(G, 14, 14, ['factory'], 1, 3, 0)); },
      stages: [
        { say: [['기술병 미르', '대장님, 늪 쪽에서 땅이 울려요…'], ['대장 한별', '포자군락이다! 날이 밝을 때까지 기지를 지켜라!']], goals: [survive(240, '밤새 기지 지키기 (4분)')] },
        { enter: unhold, say: [['대장 한별', '날이 밝았다. 이제 우리가 갈 차례다.'], ['기술병 미르', '늪 한가운데와 북서쪽에 둥지가 있어요. 군락핵까지 모두 태워야 해요.']],
          marks: marksOf('nests', '포자 둥지'), goals: [razeIds('nests', '포자 둥지 부수기', '포자 둥지'), razeHq('포자군락 군락핵 모두 태우기')] },
      ],
      events: [{ stage: 0, every: 40, from: 30, run: (G, n) => raid(G, n, n % 2 ? { x: 50, y: 50 } : { x: 86, y: 14 }, 2) }],
      win: [['대장 한별', '늪이 조용해졌다.'], ['기술병 미르', '그런데 대장님… 포자들은 땅속 깊은 곳에서 올라왔어요. 행성 한가운데에서 뭔가 뛰고 있어요. 심장처럼.'], ['족장 바루', '「잿빛 심장」… 깨어나서는 안 될 것이 깨어났구나.'], ['대장 한별', '혼자서는 안 된다. 철갑회든 누구든, 손을 잡아야 해. (2인 캠페인 「연합 전선」이 열렸습니다)']] },
  ];

  // ════════════════════ 1인 · 철갑회 ════════════════════
  const ironclad = [
    { id: 'i1', title: '1장 · 제련소 재가동', map: 'cm_foundry', faction: 'ironclad', tribe: false, teams: solo('ironclad', 'pioneers', 1, 0, { me: { noBase: true }, foe: { aiState: AI_HOLD } }),
      brief: ['오랜 잠에서 깨어난 철갑회 선발대. 제련소의 전력은 끊겨 있다.', '발전기 세 곳을 다시 켜야 중추를 세울 수 있다.', '개척단 정찰병들이 발전기 둘레를 어슬렁거린다.'],
      setup(G) { squad(G, me, ['i_blade', 'i_blade', 'i_blade', 'i_blade', 'i_striker', 'i_striker', 'i_mender', 'i_worker', 'i_worker'], 89, 6);
        guards(G, 66, 10, 1, 2); guards(G, 88, 36, 1, 2); guards(G, 70, 26, 1, 3); },
      stages: [
        { say: [['연산핵 오르도', '재기동 완료. 지휘관 벨카, 제련소 전력 0퍼센트.'], ['지휘관 벨카', '발전기 세 곳을 다시 켠다. 칼날봇, 앞으로.'], ['연산핵 오르도', '발전기 둘레에 생명체 반응. 개척단으로 추정.']],
          goals: [reach('ga', 66, 8, 4, '서쪽 발전기 켜기', '발전기', G => RTS.campSay(G, '연산핵 오르도', '발전기 하나 가동.')), reach('gb', 88, 36, 4, '남쪽 발전기 켜기', '발전기', G => RTS.campSay(G, '연산핵 오르도', '발전기 하나 가동.')), reach('gc', 70, 26, 4, '가운데 발전기 켜기', '발전기', G => RTS.campSay(G, '연산핵 오르도', '발전기 하나 가동.'))] },
        { enter(G) { C().base(G, me, 82, 14, 3); }, say: [['연산핵 오르도', '전력 100퍼센트. 중추 재건 완료.'], ['지휘관 벨카', '조립로를 세워라. 철갑회는 다시 일어선다.']], goals: [have('barracks', 1, '조립로 1채 짓기')] },
        { say: [['지휘관 벨카', '칼날봇을 늘려라. 모두 6기.']], goals: [have('i_blade', 6, '칼날봇 6기 갖기')] },
        { enter(G) { G.camp.flags.raid = C().spawnAt(G, C().foe(G), C().army('pioneers', 1, C().n(G, 6)), 14, 74, C().hq(G, me)); },
          say: [['연산핵 오르도', '남서쪽에서 개척단 부대 접근.'], ['개척단 통신', '저 기계들, 다시 움직인다! 막아!'], ['지휘관 벨카', '침입자를 없애라.']], goals: [kill('raid', '개척단 부대 물리치기')] },
      ],
      win: [['지휘관 벨카', '제련소는 다시 우리 것이다.'], ['연산핵 오르도', '개척단이 동쪽 평원에 정찰기지를 세우는 중. 위협 수준 상승.'], ['지휘관 벨카', '싹을 자른다.']] },

    { id: 'i2', title: '2장 · 정찰기지 소탕', map: 'cm_landing', faction: 'ironclad', tribe: false, teams: solo('ironclad', 'pioneers', 1, 0, { foe: { aiState: AI_HOLD } }),
      brief: ['개척단이 평원 곳곳에 정찰기지를 세웠다.', '정찰기지 세 곳을 부수고, 서쪽 개척단 사령부를 무너뜨려라.'],
      setup(G) { G.camp.flags.posts = [].concat(outpost(G, 33, 13, ['barracks', 'defense'], 1, 2), outpost(G, 33, 51, ['barracks', 'defense'], 1, 2), outpost(G, 46, 32, ['barracks', 'defense'], 1, 3)); },
      stages: [
        { say: [['연산핵 오르도', '정찰기지 세 곳 확인. 표식을 띄웠다.'], ['지휘관 벨카', '조립로를 세우고 병력을 모아라. 하나씩 부순다.']], marks: marksOf('posts', '정찰기지'), goals: [razeIds('posts', '정찰기지 건물 모두 부수기', '정찰기지')] },
        { enter: unhold, say: [['개척단 통신', '정찰기지가 모두 당했다! 전원 사령부로!'], ['지휘관 벨카', '사령부를 친다.']], goals: [razeHq('개척단 사령부 무너뜨리기')] },
      ],
      events: [{ stage: 0, every: 170, from: 200, run: (G, n) => raid(G, n, { x: 12, y: 32 }, 2) }],
      win: [['지휘관 벨카', '평원 정리 완료.'], ['연산핵 오르도', '북쪽 서리 고개 너머에 연산핵을 세울 자리 확인. 단, 수송 경로가 위험하다.'], ['지휘관 벨카', '중장봇이 직접 부품을 나른다. 호위를 붙여라.']] },

    { id: 'i3', title: '3장 · 서리 고개 수송', map: 'cm_frost', faction: 'ironclad', tribe: false, teams: solo('ironclad', 'pioneers', 0, 1, { me: { noBase: true }, foe: { aiState: AI_HOLD } }),
      brief: ['연산핵 부품을 실은 중장봇이 서리 고개를 넘는다.', '중장봇이 부서지면 실패. 호위 부대로 길을 열어라.', '연산핵 터에 닿으면 기지를 세우고 버텨야 한다.'],
      setup(G) { G.camp.flags.convoy = squad(G, me, ['i_colossus'], 36, 106)[0]; squad(G, me, ['i_blade', 'i_blade', 'i_blade', 'i_blade', 'i_striker', 'i_striker', 'i_mender'], 36, 103);
        guards(G, 36, 74, 1, 4); C().building(G, C().npc(G), 'p_turret', 40, 60); guards(G, 34, 58, 1, 2); guards(G, 18, 56, 1, 2); },
      stages: [
        { say: [['지휘관 벨카', '수송 시작. 중장봇은 절대 잃지 마라.'], ['연산핵 오르도', '고갯마루에 개척단 포탑 확인. 호위 부대가 먼저 처리할 것.']],
          goals: [reach('pass', 36, 56, 5, '중장봇과 함께 고갯마루 넘기', '고갯마루')] },
        { say: [['연산핵 오르도', '연산핵 터는 서쪽.']], goals: [{ text: '중장봇을 연산핵 터까지 데려가기', key: 'site', at: [12, 56, 5, '연산핵 터'], test: G => { const u = G.byId[G.camp.flags.convoy]; return !!u && !u.dead && Math.hypot(u.x - 12, u.y - 56) < 5; },
          done: G => { C().base(G, me, 12, 56, 4); G.teams[me].res.ore += 250; RTS.campSay(G, '연산핵 오르도', '부품 도착. 중추 조립 완료.'); } }],
          fail: G => C().alive(G, [G.camp.flags.convoy]) ? null : '수송 중장봇이 부서졌습니다' },
        { say: [['지휘관 벨카', '조립로를 세우고 연산핵을 올려라.']], goals: [have('barracks', 1, '조립로 짓기'), have('lab', 1, '연산핵 짓기')] },
        { say: [['개척단 통신', '철갑회가 고개 너머에 자리를 잡았다! 쓸어 버려!'], ['지휘관 벨카', '연산핵을 지켜라.']], goals: [survive(150, '연산핵 지키기 (2분 30초)')] },
      ],
      events: [{ stage: 3, every: 40, from: 20, run: (G, n) => raid(G, n, { x: 36, y: 12 }, 2) }],
      win: [['연산핵 오르도', '연산핵 가동. 계산 능력 회복.'], ['연산핵 오르도', '경고. 개척단 본대가 골짜기에 모이고 있다. 연산핵을 노린다.'], ['지휘관 벨카', '이번에는 우리가 지킨다.']] },

    { id: 'i4', title: '4장 · 연산핵 방어', map: 'cm_valley', faction: 'ironclad', tribe: false, teams: solo('ironclad', 'pioneers', 1, 0, { foe: { aiState: AI_HOLD } }),
      brief: ['골짜기 북동쪽에 세운 철갑회 기지. 개척단이 사방에서 몰려온다.', '5분 동안 기지를 지킨 뒤, 개척단 사령부로 반격하라.'],
      setup(G) { const h = C().hq(G, me); C().building(G, me, 'i_forge', h.x - 7, h.y + 3); C().building(G, me, 'i_core', h.x - 2, h.y + 7); C().building(G, me, 'i_turret', h.x - 9, h.y + 9); C().building(G, me, 'i_turret', h.x - 12, h.y + 1);
        squad(G, me, ['i_blade', 'i_blade', 'i_blade', 'i_striker', 'i_striker'], h.x - 6, h.y + 8); G.teams[me].res.ore += 250; G.teams[me].res.gas += 100; },
      stages: [
        { say: [['연산핵 오르도', '개척단 병력 다수 감지. 예상 공격 경로 둘.'], ['지휘관 벨카', '감시포를 늘리고 병력을 모아라. 5분만 버틴다.']], goals: [survive(300, '기지 지키기 (5분)')] },
        { enter: unhold, say: [['연산핵 오르도', '공격 파도 종료. 개척단 전력 소모 확인.'], ['지휘관 벨카', '반격한다.']], goals: [razeHq('개척단 사령부 무너뜨리기')] },
      ],
      events: [{ stage: 0, every: 45, from: 45, run: (G, n) => raid(G, n, n % 2 ? { x: 12, y: 12 } : { x: 12, y: 60 }, 2) }],
      win: [['지휘관 벨카', '골짜기를 지켰다.'], ['연산핵 오르도', '새 위협. 늪에서 생물 신호 급증. 개척단보다 위험하다.'], ['지휘관 벨카', '늪을 정화한다.']] },

    { id: 'i5', title: '5장 · 늪 정화', map: 'cm_marsh', faction: 'ironclad', tribe: false, teams: solo('ironclad', 'swarm', 2, 3, { foe: { aiState: { noTribe: true } } }),
      brief: ['늪 한가운데 거대한 포자 거목이 자라고 있다.', '거목을 베고 포자군락의 군락핵을 모두 없애라.'],
      setup(G) { const h = C().hq(G, me); C().building(G, me, 'i_forge', h.x + 6, h.y + 4); squad(G, me, ['i_blade', 'i_blade', 'i_striker', 'i_striker'], h.x + 5, h.y + 8);
        G.camp.flags.tree = outpost(G, 50, 50, ['factory', 'defense', 'defense'], 2, 4, 2); },
      stages: [
        { say: [['연산핵 오르도', '늪 중앙에 강화된 생물 구조물. 「거목」으로 부른다.'], ['지휘관 벨카', '중공장을 세우고 중장봇을 모아라.']], marks: marksOf('tree', '포자 거목'), goals: [razeIds('tree', '포자 거목 베기', '포자 거목')] },
        { say: [['감응체 울림', '…아프다… 심장이… 운다…'], ['지휘관 벨카', '저것이 말을 한다고? …끝까지 간다.']], goals: [razeHq('포자군락 군락핵 모두 없애기')] },
      ],
      win: [['연산핵 오르도', '늪 정화 완료. 그러나 포자의 근원은 지하 깊은 곳. 행성 중심부에서 거대한 맥박.'], ['지휘관 벨카', '「잿빛 심장」인가. 철갑회만으로는 계산이 맞지 않는다.'], ['연산핵 오르도', '권고: 다른 세력과 일시 동맹. (2인 캠페인 「연합 전선」이 열렸습니다)']] },
  ];

  // ════════════════════ 1인 · 포자군락 ════════════════════
  const swarm = [
    { id: 's1', title: '1장 · 깨어남', map: 'cm_marsh', faction: 'swarm', tribe: false, teams: solo('swarm', 'ironclad', 1, 0, { foe: { aiState: AI_HOLD } }),
      brief: ['늪 깊은 곳에서 포자군락이 깨어났다.', '일꾼을 늘리고 번식굴을 키워 무리를 이루자.', '군락 근처에 낯선 기계들이 땅을 파고 있다.'],
      setup(G) { G.camp.flags.survey = guards(G, 50, 50, 1, 5); },
      stages: [
        { say: [['감응체 울림', '여왕님… 눈을 뜨셨군요.'], ['여왕 세라', '배가 고프구나. 포자일꾼을 늘려라. 여덟.']], goals: [have('worker', 8, '포자일꾼 8기 갖기')] },
        { say: [['여왕 세라', '이제 새끼를 낳을 굴이 필요하다. 포자일꾼 하나를 번식굴로 바꿔라.'], ['감응체 울림', '포자일꾼은 건물로 변하면 사라져요. 하나쯤은 괜찮아요.']], goals: [have('barracks', 1, '번식굴 1채 짓기')] },
        { say: [['여왕 세라', '갈퀴충을 낳아라. 한 번에 둘씩 나온다.']], goals: [have('s_claw', 10, '갈퀴충 10기 갖기')] },
        { say: [['감응체 울림', '늪 한가운데에 철갑회 탐사대가 있어요. 땅을 파헤쳐요.'], ['여왕 세라', '우리 땅을 건드리는 것들은 먹어 치운다.']], marks: marksOf('survey', '탐사대'), goals: [kill('survey', '철갑회 탐사대 없애기')] },
      ],
      win: [['여왕 세라', '맛있었다.'], ['감응체 울림', '여왕님, 남쪽 늪에 개척단이라는 것들이 천막을 쳤어요.'], ['여왕 세라', '늪 전체가 우리 몸이다. 더 넓게 퍼지자.']] },

    { id: 's2', title: '2장 · 늪의 확장', map: 'cm_marsh', faction: 'swarm', tribe: false, teams: solo('swarm', 'pioneers', 1, 0, { foe: { aiState: AI_HOLD } }),
      brief: ['군락을 늪 전체로 넓힐 때다.', '군락핵을 3개로 늘리고, 남동쪽 개척단 야영지를 없애라.', '그다음 개척단 사령부를 무너뜨린다.'],
      setup(G) { G.camp.flags.camp = outpost(G, 86, 86, ['barracks', 'defense', 'supply'], 1, 3); },
      stages: [
        { say: [['여왕 세라', '포자일꾼을 다른 광맥으로 보내 군락핵으로 바꿔라.'], ['감응체 울림', '남동쪽에 개척단 야영지가 있어요. 표식을 띄웠어요.']], marks: marksOf('camp', '야영지'),
          goals: [have('hq', 3, '군락핵 3개 갖기'), razeIds('camp', '개척단 야영지 없애기', '야영지')] },
        { enter: unhold, say: [['개척단 통신', '늪이 움직인다! 사령부를 지켜!'], ['여왕 세라', '삼켜라.']], goals: [razeHq('개척단 사령부 무너뜨리기')] },
      ],
      events: [{ stage: 0, every: 160, from: 180, run: (G, n) => raid(G, n, { x: 14, y: 86 }, 2) }],
      win: [['여왕 세라', '늪은 이제 우리 것이다.'], ['감응체 울림', '협곡에 개척단이 통신탑을 세워서 다른 기지를 부르고 있어요.'], ['여왕 세라', '몰래 들어가 끊는다. 작은 무리로.']] },

    { id: 's3', title: '3장 · 침투', map: 'cm_gorge', faction: 'swarm', tribe: false, teams: solo('swarm', 'pioneers', 4, 0, { me: { noBase: true }, foe: { aiState: AI_HOLD } }),
      brief: ['동쪽 끝에서 작은 무리가 협곡으로 숨어든다. 군락핵이 없다.', '개척단 통신탑 두 곳을 끊고, 협곡 가운데에 군락의 씨앗을 심어라.', '포자군락은 쉬면 상처가 낫는다.'],
      setup(G) { squad(G, me, ['s_claw', 's_claw', 's_claw', 's_claw', 's_claw', 's_claw', 's_claw', 's_claw', 's_claw', 's_claw', 's_spitter', 's_spitter', 's_spitter', 's_spitter', 's_nurse', 's_brute', 's_drone', 's_drone', 's_drone'], 122, 24);
        guards(G, 100, 24, 1, 3); G.camp.flags.relays = [].concat(outpost(G, 84, 35, ['supply', 'defense'], 1, 2), outpost(G, 44, 13, ['supply', 'defense'], 1, 2)); guards(G, 66, 24, 1, 2); },
      stages: [
        { say: [['감응체 울림', '통신탑은 남쪽과 북서쪽에 있어요.'], ['여왕 세라', '조용히, 빠르게.']], marks: marksOf('relays', '통신탑'), goals: [razeIds('relays', '통신탑 건물 모두 부수기', '통신탑')] },
        { say: [['여왕 세라', '협곡 가운데에 씨앗을 심는다. 포자일꾼을 데려가라.']],
          goals: [reach('seed', 64, 24, 5, '협곡 가운데에 군락 씨앗 심기', '씨앗 자리', G => { C().base(G, me, 64, 24, 5); C().building(G, me, 's_pool', 64, 31); C().building(G, me, 's_spine', 58, 22); C().building(G, me, 's_spine', 58, 27); G.teams[me].res.ore += 400; RTS.campSay(G, '감응체 울림', '군락핵이 자랐어요!'); })] },
        { enter: unhold, say: [['개척단 통신', '협곡 가운데에 괴물 둥지가 생겼다! 서쪽 사령부는 비상!'], ['여왕 세라', '이제 숨지 않는다.']], goals: [razeHq('개척단 사령부 무너뜨리기')] },
      ],
      win: [['여왕 세라', '협곡도 우리 것이다.'], ['감응체 울림', '여왕님… 철갑회가 서리 고개에 요새를 세웠어요. 그 안에서 우리를 녹이는 기계를 만들어요.'], ['여왕 세라', '요새를 먹는다.']] },

    { id: 's4', title: '4장 · 서리 요새 습격', map: 'cm_frost', faction: 'swarm', tribe: false, teams: solo('swarm', 'ironclad', 0, 1, { foe: { aiState: { noTribe: true } } }),
      brief: ['서리 고개 한가운데 철갑회 요새가 있다.', '요새의 중공장을 부수고 북쪽 철갑회 중추를 무너뜨려라.', '추위에도 포자는 자란다.'],
      setup(G) { G.camp.flags.fort = outpost(G, 36, 56, ['factory', 'defense', 'defense'], 2, 4, 1); },
      stages: [
        { say: [['감응체 울림', '요새는 고갯마루 한가운데에 있어요.'], ['여왕 세라', '둥지를 짓고 거대충을 키워라.']], marks: marksOf('fort', '요새'), goals: [razeIds('fort', '서리 요새 부수기', '요새')] },
        { say: [['철갑회 통신', '요새 함락. 계산 오류. 계산 오류.'], ['여왕 세라', '마저 먹어라.']], goals: [razeHq('철갑회 중추 모두 무너뜨리기')] },
      ],
      win: [['여왕 세라', '고개를 넘었다.'], ['감응체 울림', '남은 건 평원의 개척단 요새예요. 포탑이 빽빽해요.'], ['여왕 세라', '마지막이다.']] },

    { id: 's5', title: '5장 · 개척단 요새', map: 'cm_landing', faction: 'swarm', tribe: false, teams: solo('swarm', 'pioneers', 1, 0, { foe: { aiState: { noTribe: true } } }),
      brief: ['개척단은 평원 서쪽에 포탑 방어선을 쳤다.', '방어선을 뚫고 사령부를 무너뜨려라.'],
      setup(G) { G.camp.flags.line = [[24, 26], [24, 38], [30, 29], [30, 35]].map(([x, y]) => C().building(G, C().npc(G), 'p_turret', x, y)).filter(Boolean).map(e => e.id);
        guards(G, 26, 32, 1, 4); },
      stages: [
        { say: [['감응체 울림', '포탑 네 개가 길을 막고 있어요.'], ['여왕 세라', '산탄충과 거대충으로 한꺼번에 덮쳐라.']], marks: marksOf('line', '방어선'), goals: [razeIds('line', '포탑 방어선 뚫기', '포탑')] },
        { say: [['개척단 통신', '방어선이 무너졌다! 전원 사령부로!'], ['여왕 세라', '끝내자.']], goals: [razeHq('개척단 사령부 무너뜨리기')] },
      ],
      win: [['여왕 세라', '이겼다… 그런데 왜 이렇게 슬프지?'], ['감응체 울림', '여왕님, 우리가 깨어난 건 심장이 울어서예요. 잿빛 심장이 아파서 우리를 깨운 거예요.'], ['여왕 세라', '그렇다면 심장에게 가야 한다. 개척단이든 철갑회든, 함께 갈 자가 필요하다. (2인 캠페인 「연합 전선」이 열렸습니다)']] },
  ];

  // ════════════════════ 2인 · 연합 전선 ════════════════════
  // 두 사람이 고른 진영 A·B가 손잡고, 남은 진영 C(잿빛 심장에 홀린 세력)와 싸운다
  const duoM = [
    { id: 'd1', title: '1장 · 합류', map: 'cm_landing', players: 2, tribe: false, teams: duo(0, 3, 1, { me: { noBase: true }, mate: { noBase: true }, foe: { aiState: AI_HOLD } }),
      brief: ['서로 싸우던 두 세력이 처음으로 손을 잡는다.', '두 부대가 평원 한가운데에서 만나 기지를 세우고, 홀린 세력의 전초기지를 부숴라.'],
      setup(G) { const ps = P(G); squad(G, 0, C().army(C().fac(G, 0), 1, 5).concat([RTS.defs.factions[C().fac(G, 0)].worker, RTS.defs.factions[C().fac(G, 0)].worker]), 6, 6);
        if (ps.includes(1)) squad(G, 1, C().army(C().fac(G, 1), 1, 5).concat([RTS.defs.factions[C().fac(G, 1)].worker, RTS.defs.factions[C().fac(G, 1)].worker]), 6, 58);
        guards(G, 24, 32, 1, 2); G.camp.flags.post = outpost(G, 56, 13, ['barracks', 'defense', 'defense'], 1, 3); },
      stages: [
        { say: G => [[lead(G, 0), `${fn(G, 1)}… 정말 믿어도 되는 건가.`], [lead(G, 1), `우리도 같은 생각이다, ${fn(G, 0)}. 하지만 지금은 함께해야 한다.`], [aide(G, 0), '평원 한가운데에서 만나요. 두 부대가 모두 와야 해요!']],
          goals: [reach('meet', 44, 32, 6, '두 부대가 평원 한가운데에서 만나기', '만남의 자리', G => { const ps = P(G); C().base(G, 0, 12, 32, 4); if (ps.includes(1)) C().base(G, 1, 33, 53, 4); RTS.campSay(G, aide(G, 0), '두 기지가 내려왔어요!'); }, true)] },
        { say: G => [[lead(G, 1), '북동쪽에 홀린 자들의 전초기지가 있다.'], [lead(G, 0), '함께 친다.']], marks: marksOf('post', '전초기지'), goals: [razeIds('post', '홀린 세력 전초기지 부수기', '전초기지')] },
        { say: G => [[`${fn(G, 2)}(홀린 자)`, '…심장이… 너희를 부른다…'], [aide(G, 1), '반격이 와요! 서로 기지를 지켜 줘요!']], goals: [survive(150, '두 기지 지키기 (2분 30초)')] },
      ],
      events: [{ stage: 2, every: 35, from: 15, run: (G, n) => raid(G, n, { x: 76, y: 32 }, 2) }],
      win: G => [[lead(G, 0), '함께라면 해낼 수 있겠군.'], [lead(G, 1), '서리 고개 너머로 보급로를 열어야 한다. 심장까지는 멀다.']] },

    { id: 'd2', title: '2장 · 보급로', map: 'cm_frost', players: 2, tribe: false, teams: duo(0, 5, 1, { foe: { aiState: AI_HOLD } }),
      brief: ['서리 고개 양쪽의 보급 거점 두 곳을 지켜야 연합군이 북쪽으로 갈 수 있다.', '거점 둘레에 적이 없을 때만 시간이 쌓인다.', '보급로가 열리면 북쪽 홀린 세력 본진을 친다.'],
      setup(G) { guards(G, 12, 56, 1, 3); guards(G, 60, 56, 1, 3); },
      stages: [
        { say: G => [[aide(G, 0), '서쪽과 동쪽 거점을 각각 1분 30초씩 지켜야 해요.'], [lead(G, 0), '한쪽씩 맡자.']], goals: [hold('hw', 12, 56, 90, '서쪽 보급 거점 지키기', '서쪽 거점'), hold('he', 60, 56, 90, '동쪽 보급 거점 지키기', '동쪽 거점')] },
        { enter: unhold, say: G => [[lead(G, 1), '보급로가 열렸다. 북쪽으로!']], goals: [razeHq()] },
      ],
      events: [{ stage: 0, every: 50, from: 90, run: (G, n) => raid(G, n, n % 2 ? { x: 14, y: 30 } : { x: 58, y: 28 }, 2) }],
      win: G => [[aide(G, 1), '보급로 확보! 남쪽 제련소 터에서 홀린 자들이 두 갈래로 몰려온대요.'], [lead(G, 0), '각자 한쪽 전선을 맡는다.']] },

    { id: 'd3', title: '3장 · 두 갈래 전선', map: 'cm_foundry', players: 2, tribe: false, teams: duo(0, 3, 1, { foe: { aiState: AI_HOLD } }),
      brief: ['홀린 세력이 북쪽과 남쪽 두 길로 동시에 밀려온다.', '4분 동안 두 기지를 지키고, 남동쪽 적 기지와 북동쪽 본진을 무너뜨려라.'],
      setup(G) { G.camp.flags.se = outpost(G, 82, 74, ['barracks', 'factory', 'defense'], 2, 3); },
      stages: [
        { say: G => [[aide(G, 0), '적이 위아래로 번갈아 와요!'], [lead(G, 1), '서로 지원할 수 있게 병력 일부는 가운데에 두자.']], goals: [survive(240, '두 기지 지키기 (4분)')] },
        { enter: unhold, say: G => [[lead(G, 0), '이제 반격이다!']], marks: marksOf('se', '남동쪽 기지'), goals: [razeIds('se', '남동쪽 적 기지 부수기', '남동쪽 기지'), razeHq()] },
      ],
      events: [{ stage: 0, every: 40, from: 80, run: (G, n) => raid(G, n, n % 2 ? { x: 82, y: 14 } : { x: 82, y: 74 }, 2) }],
      win: G => [[`${fn(G, 2)}(홀린 자)`, '…탑이… 너희를 막을 것이다…'], [aide(G, 0), '고대 유적에 「타락의 탑」 네 개가 서 있대요. 그게 홀린 자들을 조종해요.']] },

    { id: 'd4', title: '4장 · 타락의 탑', map: 'cm_ruins', players: 2, tribe: false, teams: duo(0, 1, 2, { foe: { aiState: { noTribe: true } } }),
      brief: ['고대 유적 곳곳에 홀린 세력을 조종하는 「타락의 탑」 네 개가 서 있다.', '탑 네 개를 모두 부숴라. 적 본진은 쉬지 않고 공격해 온다.'],
      setup(G) { const n = C().npc(G), d = C().rid(C().fac(G, n), 'defense'); G.camp.flags.spires = [[12, 14], [92, 14], [22, 52], [82, 52]].map(([x, y]) => { const e = C().building(G, n, d, x, y, 2); guards(G, x, y + 3, 2, 2); return e && e.id; }).filter(Boolean); },
      stages: [
        { say: G => [[aide(G, 1), '탑은 네 곳이에요. 표식을 봐요.'], [lead(G, 0), '둘씩 나눠서 갈까, 함께 갈까?']], marks: marksOf('spires', '타락의 탑'), goals: [razeIds('spires', '타락의 탑 모두 부수기', '타락의 탑')] },
        { say: G => [[`${fn(G, 2)}(홀린 자)`, '…으아… 머리가… 맑아진다… 아니, 심장이 다시 부른다!'], [lead(G, 1), '탑이 무너지자 저들이 흔들린다. 본진을 쳐라!']], goals: [razeHq()] },
      ],
      win: G => [[lead(G, 0), '유적 아래로 길이 열렸다. 행성의 한가운데로.'], [aide(G, 0), '심장 바로 앞에 홀린 자들의 마지막 본진이 있어요.']] },

    { id: 'd5', title: '5장 · 심장 앞', map: 'cm_core', players: 2, tribe: false, teams: duo(0, 1, 2, { foe: { aiState: { noTribe: true }, boost: { easy: 1, normal: 1, hard: 1.15 } } }),
      brief: ['잿빛 심장 바로 앞, 홀린 세력의 마지막 본진.', '모든 본진을 무너뜨리면 연합 전선은 끝난다.', '…정말 그것으로 끝일까?'],
      setup(G) { guards(G, 60, 60, 3, 4); },
      stages: [
        { say: G => [[aide(G, 1), '여기가 심장 바로 위예요. 땅이 뛰어요.'], [lead(G, 0), '마지막 싸움이다.'], [lead(G, 1), '함께 끝내자.']], goals: [razeHq()] },
      ],
      win: G => [[lead(G, 0), '끝났다… 홀린 자들이 정신을 차렸다.'], [lead(G, 1), '잿빛 심장도 조용해졌군.']],
      end: G => G.camp.level === 'hard' ? [['???', '…용감한 자들이여. 심장 아래, 심연의 문이 너희를 기다린다.'], ['', '히든 미션 「심연의 문」이 열렸습니다!']] : [['???', '…아직… 부족하다…'], ['', '힌트: 무언가 더 있는 것 같다. 가장 어려운 길로 끝까지 가 보자.']] },
  ];

  // ════════════════════ 히든 미션 ════════════════════
  const hidden = [
    { id: 'x1', title: '히든 미션 · 심연의 문', map: 'cm_ruins', players: 2, levels: ['normal', 'hard'], tribe: false, teams: duo(0, 1, 2, { foe: { aiState: { noTribe: true }, boost: { normal: 1, hard: 1.15 } } }),
      brief: ['고대 유적 한가운데, 오래 닫혀 있던 「심연의 문」이 열리려 한다.', '문을 지키는 거대한 수호자(보통 2기, 어려움 3기)를 쓰러뜨리고, 문이 열릴 때까지 그 앞을 지켜라.', '1인으로 하면 AI 동료가 함께 싸운다.'],
      setup(G) { const n = C().npc(G), f = C().fac(G, n); G.camp.flags.bosses = C().spawnAt(G, n, C().army(f, 'boss', G.camp.level === 'hard' ? 3 : 2), 52, 52);
        G.camp.flags.wards = [[44, 44], [60, 44], [44, 60], [60, 60]].map(([x, y]) => { const e = C().building(G, n, C().rid(f, 'defense'), x, y, G.camp.level === 'hard' ? 2 : 1); return e && e.id; }).filter(Boolean);
      },
      stages: [
        { say: G => [['???', '…문 앞에 선 자들이여. 수호자를 넘어서라.'], [lead(G, 0), '저게 수호자라고? 엄청나게 크다…'], [aide(G, 0), '합체 유닛이에요! 병력을 충분히 모아서 가요.']],
          marks: marksOf('bosses', '수호자'), goals: [kill('bosses', '문 수호자 쓰러뜨리기')] },
        { say: G => [['???', '…문이 열린다. 문이 다 열릴 때까지 지켜라.'], [lead(G, 1), '문 앞에 병력을 세워라! 적이 몰려온다!']], goals: [hold('gate', 52, 52, 90, '열리는 문 앞 지키기', '심연의 문')] },
      ],
      events: [{ stage: 1, every: 30, from: 5, run: (G, n) => raid(G, n + 2, [{ x: 52, y: 12 }, { x: 12, y: 12 }, { x: 92, y: 12 }][n % 3], 2) }],
      win: G => [['???', '…문이 열렸다. 심장으로 내려오라.'], [lead(G, 0), '아래에 또 다른 세상이 있다.'], ['', '히든 캠페인 「잿빛 심장」이 열렸습니다!']] },
  ];

  // ════════════════════ 히든 캠페인 · 잿빛 심장 ════════════════════
  const deep = [
    { id: 'h1', title: '히든 1장 · 하강', map: 'cm_core', players: 2, levels: ['normal'], tribe: false, teams: duo(0, 1, 2, { me: { noBase: true }, mate: { noBase: true }, foe: { aiState: AI_HOLD } }),
      brief: ['심연의 문 아래, 동굴 고리를 따라 심장으로 내려간다.', '서쪽과 동쪽 동굴 관문을 차례로 열면 기지를 내릴 수 있다.', '난이도: 보통(고정)'],
      setup(G) { const ps = P(G); ps.forEach(t => squad(G, t, C().army(C().fac(G, t), 2, 8).concat(C().army(C().fac(G, t), 3, 2)), t === 0 ? 8 : 112, 113));
        if (!ps.includes(1)) squad(G, 0, C().army(C().fac(G, 0), 2, 4), 60, 113); guards(G, 16, 72, 2, 4); guards(G, 104, 72, 2, 4); guards(G, 60, 92, 1, 3); },
      stages: [
        { say: G => [[lead(G, 0), '여기가 행성 속이라니… 빛나는 돌투성이다.'], [aide(G, 1), '서쪽 동굴 관문부터 열어요.']], goals: [reach('west', 14, 60, 5, '서쪽 동굴 관문 열기', '서쪽 관문')] },
        { say: G => [[lead(G, 1), '이제 동쪽 관문이다.']], goals: [reach('east', 106, 60, 5, '동쪽 동굴 관문 열기', '동쪽 관문', G => { P(G).forEach(t => C().base(G, t, t === 0 ? 20 : 100, 106, 4)); RTS.campSay(G, aide(G, 0), '관문이 열려 기지가 내려왔어요!'); })] },
        { enter: unhold, say: G => [['???', '…침입자… 심장을 지켜라…'], [aide(G, 0), '홀린 자들의 마지막 남은 군대예요! 버텨요!']], goals: [survive(150, '기지 지키기 (2분 30초)')] },
      ],
      events: [{ stage: 2, every: 35, from: 30, run: (G, n) => raid(G, n + 1, { x: 60, y: 14 }, 2) }],
      win: G => [[lead(G, 0), '버텼다.'], [aide(G, 1), '심장 둘레에 수호자 탑 네 개가 있어요. 그게 심장을 감싸고 있어요.']] },

    { id: 'h2', title: '히든 2장 · 수호자들', map: 'cm_core', players: 2, levels: ['normal'], tribe: false, teams: duo(0, 1, 2, { foe: { aiState: { noTribe: true }, boost: 1.15 } }),
      brief: ['심장을 둘러싼 수호자 탑 네 곳을 부숴라.', '탑마다 강한 경비가 있다. 적 본진도 공격해 온다.', '난이도: 보통(고정)'],
      setup(G) { const n = C().npc(G), f = C().fac(G, n); G.camp.flags.towers = [[24, 24], [96, 24], [14, 62], [106, 62]].map(([x, y]) => { const e = C().building(G, n, C().rid(f, 'defense'), x, y, 2); guards(G, x, y + 3, 3, 3); return e && e.id; }).filter(Boolean); },
      stages: [
        { say: G => [[aide(G, 0), '수호자 탑은 네 곳이에요.'], [lead(G, 1), '하나씩 확실하게 부수자.']], marks: marksOf('towers', '수호자 탑'), goals: [razeIds('towers', '수호자 탑 모두 부수기', '수호자 탑')] },
      ],
      win: G => [['???', '…이제… 나를 보아라…'], [lead(G, 0), '심장이 깨어난다. 최종장이다.']] },

    { id: 'h3', title: '최종장 · 잿빛 심장', map: 'cm_core', players: 2, levels: ['hard'], tribe: false, teams: duo(0, 1, 2, { foe: { aiState: { noTribe: true } } }),
      brief: ['행성의 한가운데, 잿빛 심장이 깨어났다.', '심장을 지키는 결계 넷을 부수고 심장을 멈춰라. 심장은 쉬지 않고 괴물을 뿜어낸다.', '난이도: 어려움(고정)'],
      setup(G) { const n = C().npc(G), f = C().fac(G, n), heart = C().building(G, n, RTS.defs.factions[f].hq, 60, 60, 8); G.camp.flags.heart = heart ? [heart.id] : [];
        G.camp.flags.wards = [[50, 50], [70, 50], [50, 70], [70, 70]].map(([x, y]) => { const e = C().building(G, n, C().rid(f, 'defense'), x, y, 2); return e && e.id; }).filter(Boolean);
        guards(G, 60, 66, 2, 4); },
      stages: [
        { say: G => [['잿빛 심장', '…나는 이 행성의 꿈이다. 너희는 나를 아프게 했다.'], [lead(G, 0), '우리가 땅을 파헤쳐서… 그래서 화가 난 거였나.'], [lead(G, 1), '그래도 멈춰야 한다. 결계부터!']], marks: marksOf('wards', '결계'), goals: [razeIds('wards', '심장의 결계 넷 부수기', '결계')] },
        { say: G => [['잿빛 심장', '…그래도… 너희는 함께 왔구나…'], [aide(G, 0), '결계가 사라졌어요! 지금이에요!']], marks: marksOf('heart', '잿빛 심장'), goals: [razeIds('heart', '잿빛 심장 멈추기', '잿빛 심장')] },
      ],
      events: [{ every: 55, from: 120, run: (G, n) => { const npc = C().npc(G), h = G.byId[(G.camp.flags.heart || [])[0]]; if (!h || h.dead) return; const tgt = C().nearest(G, undefined, h); if (!tgt) return;
        if (G.ents.filter(e => e.team === npc && !e.dead && RTS.defs.entities[e.def].kind === 'unit').length > 24) return; // 심장의 아이들은 24기까지만
        C().spawnAt(G, npc, C().army(C().fac(G, npc), tierOf(n), Math.min(9, C().n(G, 2 + Math.floor(n * .4)))), 60, 72, tgt); RTS.campSay(G, '잿빛 심장', '…가라, 나의 아이들아…'); } }],
      win: G => [['잿빛 심장', '…고맙다. 이제 잠들 수 있겠구나. 이 땅을… 함께 아껴 다오.'], [lead(G, 0), '끝났다. 정말로.'], [lead(G, 1), '이제 이 행성은 싸우는 곳이 아니라 함께 사는 곳이다.'], ['', '— 잿빛 심장 · 끝 — 모든 캠페인을 깼습니다!']] },
  ];

  RTS.CAMPAIGN = { id: 'heart', name: '잿빛 심장', groups: [
    { id: 'pioneers', kind: 'solo', name: '개척단', faction: 'pioneers', missions: pioneers },
    { id: 'ironclad', kind: 'solo', name: '철갑회', faction: 'ironclad', missions: ironclad },
    { id: 'swarm', kind: 'solo', name: '포자군락', faction: 'swarm', missions: swarm },
    { id: 'duo', kind: 'duo', name: '2인 · 연합 전선', missions: duoM },
    { id: 'hidden', kind: 'hidden', name: '히든 미션', missions: hidden },
    { id: 'deep', kind: 'deep', name: '히든 캠페인 · 잿빛 심장', missions: deep },
  ] };
})();
