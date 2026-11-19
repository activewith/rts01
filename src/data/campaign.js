// 캠페인 이야기 「잿빛 광맥」. 미션은 순서대로 열리고 이야기가 이어진다.
// 구조는 src/engine/campaign.js 머리말. say: [[말하는 사람, 대사]], prog(G) → [현재, 목표]
(function () {
  const C = () => RTS.camp, me = 0, foe = 1;
  const oreGot = G => [Math.floor(G.teams[me].stats.ore), 200];
  const hqLeft = G => G.ents.filter(e => e.team === foe && !e.dead && RTS.defOf(e).dropoff && RTS.defOf(e).kind === 'building').length;
  RTS.CAMPAIGN = { id: 'gray', name: '잿빛 광맥 (테스트용)', missions: [
    { id: 'c1', title: '1장 · 첫 착륙', map: 'ridge', faction: 'pioneers', enemy: 'ironclad', tribe: false, aiState: { hold: true, noTribe: true, noDip: true },
      brief: ['개척단 착륙선이 낯선 행성 「회색 대지」에 내렸다.', '이 땅 깊은 곳에는 우주선 연료가 되는 광석이 잠들어 있다.', '먼저 기지를 꾸리고, 스스로를 지킬 힘을 길러야 한다.'],
      stages: [
        { say: [['대장 한별', '착륙 성공! 여기가 회색 대지군.'], ['기술병 미르', '대장님, 기지 옆에 광맥이 있어요. 공병들이 벌써 캐고 있습니다.'], ['대장 한별', '좋아. 광석 200을 먼저 모으자.']],
          goals: [{ text: '광석 200 모으기', prog: oreGot }] },
        { say: [['기술병 미르', '광석이 모였어요! 이제 병사를 키울 병영이 필요해요.'], ['대장 한별', '공병을 골라 B를 누르고 병영을 지어라.']],
          goals: [{ text: '병영 1채 짓기', prog: G => [C().count(G, me, 'p_barracks'), 1] }] },
        { say: [['대장 한별', '병영이 섰다. 소총병을 4명 훈련시키자.']],
          goals: [{ text: '소총병 4기 뽑기', prog: G => [C().count(G, me, 'p_rifle'), 4] }] },
        { enter(G) { const h = C().hq(G, me); G.camp.flags.scouts = C().wave(G, foe, ['i_blade', 'i_blade', 'i_blade', 'i_blade'], h); },
          say: [['기술병 미르', '대장님! 레이더에 기계 반응이 잡혔어요!'], ['철갑회 통신', '…이 광맥은 철갑회의 것이다. 물러가라.'], ['대장 한별', '철갑회 정찰대다! 소총병, 기지를 지켜라!']],
          goals: [{ text: '철갑회 정찰대 물리치기', prog: G => [4 - C().alive(G, G.camp.flags.scouts), 4] }] },
      ],
      win: [['대장 한별', '정찰대를 물리쳤다. 하지만 철갑회는 다시 올 거야.'], ['기술병 미르', '대장님, 이 행성에 사람들이 산다는 기록이 있어요. 잿빛 부족이라고…'], ['대장 한별', '그들을 찾아보자. 도움을 받을 수 있을지도 몰라.']] },

    { id: 'c2', title: '2장 · 잿빛 부족', map: 'lake', faction: 'pioneers', enemy: 'ironclad', aiState: { hold: true, noTribe: true, noDip: true },
      brief: ['회색 대지에는 오래전부터 「잿빛 부족」이 살고 있었다.', '부족은 지혜로운 사람만 믿는다. 족장이 내는 문제를 풀어야 친구가 될 수 있다.', '철갑회는 그동안에도 작은 부대를 보내 기지를 괴롭힌다.'],
      stages: [
        { say: [['대장 한별', '잿빛 부족의 회당이 이 근처 어딘가에 있다.'], ['기술병 미르', '병사나 공병을 보내서 찾아봐요. 회당이 보이면 왼쪽 위에 부족 창이 떠요.']],
          goals: [{ text: '잿빛 부족 회당 찾기', prog: G => [G.tribe && G.tribe.found[me] ? 1 : 0, 1] }] },
        { say: [['족장 바루', '하늘에서 온 손님이군. 우리는 지혜로운 이만 믿는다.'], ['족장 바루', '공병을 회당으로 보내라. 내가 내는 문제 두 개를 풀면 친구로 받아 주지.'], ['기술병 미르', '공병을 고르고 회당을 누르면(마우스는 우클릭) 돼요. 답만큼 광석을 보내야 하니 광석도 모아 두세요!']],
          goals: [{ text: '부족의 문제 2개 풀고 동맹 맺기', prog: G => [G.tribe && G.tribe.rel[me] === 'ally' ? 1 : 0, 1] }],
          fail: G => !G.tribe || G.tribe.dead ? '잿빛 부족 회당이 무너졌습니다' : G.tribe.rel[me] === 'hostile' ? '잿빛 부족이 등을 돌렸습니다. 다시 도전해 보세요' : null },
        { say: [['족장 바루', '훌륭하다! 이제 너희는 우리의 친구다.'], ['족장 바루', '우리가 무엇을 도와주면 좋겠나? 하나를 골라라.'], ['대장 한별', '부족 창에서 요청을 하나 고르자. 이 선택은 다음 싸움에도 이어진다.']],
          goals: [{ text: '부족에게 할 요청 고르기', prog: G => [RTS.tribeReqOf(G, me) ? 1 : 0, 1] }] },
      ],
      events: [{ every: 150, from: 150, run(G, n) { const h = C().hq(G, me); if (!h) return; const list = []; for (let i = 0; i < Math.min(2 + n, 6); i++) list.push(i % 3 === 2 ? 'i_striker' : 'i_blade');
        C().wave(G, foe, list, C().nearest(G, me, C().hq(G, foe) || h) || h); RTS.emit(G, 'story', { who: '기술병 미르', text: `철갑회 부대 ${list.length}기가 다가와요!` }); } }],
      win: [['족장 바루', '철갑회는 이 땅을 파헤치고 우리 숲을 태웠다. 함께 그들을 몰아내자.'], ['대장 한별', '좋습니다. 철갑회의 전진기지로 갑시다!']] },

    { id: 'c3', title: '3장 · 광맥 탈환', map: 'canyon', faction: 'pioneers', enemy: 'ironclad', aiState: { noTribe: true },
      brief: ['개척단과 잿빛 부족이 손을 잡았다.', '철갑회는 협곡 너머에 전진기지를 세우고 광맥을 독차지하려 한다.', '철갑회 사령부를 무너뜨려 광맥을 되찾아라.'],
      setup(G, carry) { const T = G.tribe; if (T) { T.found[me] = true; T.rel[me] = 'ally'; T.req[me] = RTS.TRIBE_REQS[carry.req] ? carry.req : 'defend'; T.pick[me] = false; }
        const h = C().hq(G, me); if (h) for (let k = 0; k < 4; k++) { const p = RTS.nearestFree(G, h.x + 3 + k, h.y + 3); RTS.spawn(G, 'p_rifle', me, p.x, p.y); } },
      stages: [
        { say: [['대장 한별', '1장에서 싸운 소총병들도 함께 왔다.'], ['족장 바루', '약속대로 우리 부족이 힘을 보태겠다.'], ['대장 한별', '철갑회 사령부를 모두 무너뜨리면 이긴다. 서두르지 말고 병력을 모아서 가자.']],
          goals: [{ text: G => `철갑회 사령부 무너뜨리기 (남은 ${hqLeft(G)}채)`, prog: G => [hqLeft(G) ? 0 : 1, 1] }] },
      ],
      events: [
        { at: 90, run: G => RTS.emit(G, 'story', { who: '기술병 미르', text: '협곡 길목이 좁아요. 한꺼번에 몰려가면 유리해요.' }) },
        { at: 300, run: G => RTS.emit(G, 'story', { who: '철갑회 통신', text: '원주민과 손을 잡았나? 소용없다. 철갑회 본대가 움직인다.' }) },
        { at: 0, when: G => { const h = C().hq(G, foe); return h && h.hp < RTS.defOf(h).hp * .5; }, run: G => RTS.emit(G, 'story', { who: '대장 한별', text: '사령부가 흔들린다! 조금만 더!' }) },
      ],
      win: [['대장 한별', '해냈다! 광맥을 되찾았다.'], ['족장 바루', '고맙다, 하늘의 친구들. 숲이 다시 숨을 쉬겠구나.'], ['기술병 미르', '대장님… 북쪽 산에서 이상한 포자 냄새가 나요. 무언가 깨어나고 있어요.'], ['대장 한별', '그 이야기는 다음에 이어진다. (다음 장은 준비 중)']] },
  ] };
})();
