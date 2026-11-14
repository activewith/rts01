// node test/upgrade.js — 건물 강화, 유닛 강화 ★, 합체 규칙 검사
const fs = require('fs'), path = require('path');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','engine/net','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const D = RTS.defs.entities;

function setup(faction = 'pioneers', seed = 3) {
  const G = RTS.createGame({ map: 'ridge', seed, players: [{ faction }, { faction: faction === 'pioneers' ? 'ironclad' : 'pioneers' }] });
  const msgs = []; RTS.on(G, 'notice', n => { if (n.team === 0) msgs.push(n.text); }); G._msgs = msgs;
  G.teams[0].res.ore = G.teams[0].res.gas = 99999;
  return G;
}
const hq0 = G => G.ents.find(e => e.team === 0 && RTS.defOf(e).dropoff);
function building(G, id, dx = 6, dy = 0) { const h = hq0(G), e = RTS.spawn(G, id, 0, Math.round(h.x + dx) + D[id].size[0] / 2, Math.round(h.y + dy) + D[id].size[1] / 2); e.built = e.buildT; e.hp = RTS.stat(G, e, 'hp'); RTS.census(G); return e; }
const run = (G, n) => { for (let i = 0; i < n; i++) RTS.step(G); };
const cmd = (G, c) => { RTS.command(G, 0, c); RTS.step(G); };
function unit(G, id, x, y) { return RTS.spawn(G, id, 0, x, y); }

// 1) 건물 강화: 비용·시간·효과
{ const G = setup(), b = building(G, 'p_barracks'), t = G.teams[0];
  const c1 = RTS.levelCost(D.p_barracks, 1), c2 = RTS.levelCost(D.p_barracks, 2), hp0 = RTS.stat(G, b, 'hp'), ore0 = t.res.ore;
  cmd(G, { type: 'levelup', building: b.id });
  ok(t.res.ore === ore0 - c1.ore && b.prod[0] && b.prod[0].kind === 'level', `1단계 비용 ${JSON.stringify(c1)} · 2단계 ${JSON.stringify(c2)} · 시간 ${RTS.levelTime(D.p_barracks, 1)}/${RTS.levelTime(D.p_barracks, 2)}초`);
  cmd(G, { type: 'levelup', building: b.id }); ok(b.prod.length === 1, '강화 중에는 다시 강화 신청이 안 된다');
  run(G, RTS.levelTime(D.p_barracks, 1) * 20 + 2);
  ok(b.lv === 1 && Math.round(RTS.stat(G, b, 'hp')) === Math.round(hp0 * 1.25) && RTS.stat(G, b, 'armor') === (D.p_barracks.armor || 0) + 1 && G.teams[0].lvl.p_barracks === 1, `1단계 완료: 체력 ${hp0}→${RTS.stat(G, b, 'hp')}, 방어 ${RTS.stat(G, b, 'armor')}`);
  // 생산 속도 +25%
  const t0 = G.tick; cmd(G, { type: 'train', building: b.id, unit: 'p_rifle' }); let made = null; RTS.on(G, 'trained', ({ e }) => { if (!made) made = G.tick; }); run(G, 400);
  const took = made - t0; ok(Math.abs(took - Math.ceil(14 * 20 / 1.25)) <= 2, `1단계 병영 소총병 생산 ${took}틱 (기본 280)`);
  // 취소하면 강화 비용을 돌려받는다
  const ore1 = t.res.ore, gas1 = t.res.gas; cmd(G, { type: 'levelup', building: b.id }); cmd(G, { type: 'cancel', building: b.id });
  ok(t.res.ore === ore1 && t.res.gas === gas1 && !b.prod.length && b.lv === 1, '강화 취소 시 전액 환불');
  cmd(G, { type: 'levelup', building: b.id }); run(G, RTS.levelTime(D.p_barracks, 2) * 20 / 1.25 + 4);
  ok(b.lv === 2, '2단계 완료 (1단계 건물은 강화도 25% 빠르다)');
  cmd(G, { type: 'levelup', building: b.id }); ok(!b.prod.length && G._msgs.includes('이미 최고 단계입니다'), '3단계는 없다');
  const hall = building(G, 'p_hq', -14, 0); ok(!RTS.levelBlock(G, hall), '사령부도 강화할 수 있다');
  const site = RTS.spawn(G, 'p_depot', 0, hq0(G).x, hq0(G).y + 8); ok(RTS.levelBlock(G, site) === '건설 중에는 강화할 수 없습니다', '건설 중 건물은 강화 불가');
}
// 2) 보급·포탑
{ const G = setup(), dep = building(G, 'p_depot', 6, 5), cap0 = G.teams[0].cap;
  dep.lv = 1; RTS.census(G); ok(G.teams[0].cap === Math.min(cap0 + 4, RTS.cfg(G).supplyCap), `보급고 1단계 보급 +4 (${cap0}→${G.teams[0].cap})`);
  const tu = building(G, 'p_turret', -6, 5), w = D.p_turret.weapon, d0 = RTS.wStat(G, tu, w, 'damage'), r0 = RTS.wStat(G, tu, w, 'range'); tu.lv = 2;
  ok(RTS.wStat(G, tu, w, 'damage') === d0 * 1.5 && RTS.wStat(G, tu, w, 'range') === r0 + 1, `방어포탑 2단계 공격 ${d0}→${RTS.wStat(G, tu, w, 'damage')}, 사거리 ${r0}→${RTS.wStat(G, tu, w, 'range')}`);
  ok(!RTS.canLevel(D.p_extractor) && !RTS.canLevel(D.co_site_ore), '추출기·회사 거점은 강화 대상이 아니다'); }
// 3) 유닛 강화 ★
{ const G = setup(), b = building(G, 'p_barracks'), h = hq0(G), u = unit(G, 'p_rifle', h.x + 3, h.y + 6), t = G.teams[0];
  cmd(G, { type: 'rankup', ids: [u.id] }); ok(!u.rank && G._msgs.includes('병영 강화 1단계가 필요합니다'), '병영 강화 전에는 ★ 불가');
  b.lv = 1; RTS.census(G); const ore0 = t.res.ore, hp0 = RTS.stat(G, u, 'hp'), dm0 = RTS.wStat(G, u, D.p_rifle.weapon, 'damage');
  cmd(G, { type: 'rankup', ids: [u.id] });
  ok(u.rank === 1 && t.res.ore === ore0 - RTS.rankCost(D.p_rifle, 1).ore && RTS.stat(G, u, 'hp') === hp0 * 1.2 && Math.abs(RTS.wStat(G, u, D.p_rifle.weapon, 'damage') - dm0 * 1.15) < 1e-9, `★1: 비용 ${JSON.stringify(RTS.rankCost(D.p_rifle, 1))}, 체력 ${hp0}→${RTS.stat(G, u, 'hp')}, 공격 ${dm0}→${RTS.wStat(G, u, D.p_rifle.weapon, 'damage').toFixed(2)}`);
  cmd(G, { type: 'rankup', ids: [u.id] }); ok(u.rank === 1, '★2는 병영 2단계가 필요');
  b.lv = 2; RTS.census(G); cmd(G, { type: 'rankup', ids: [u.id] }); ok(u.rank === 2 && RTS.stat(G, u, 'hp') === hp0 * 1.4, `★2 체력 ${RTS.stat(G, u, 'hp')}`);
  cmd(G, { type: 'rankup', ids: [u.id] }); ok(u.rank === 2, '★3은 없다');
  const merc = unit(G, 'n_merc', h.x + 4, h.y + 6); ok(!!RTS.rankBlock(G, merc), '생산 건물이 없는 유닛(용병)은 강화 불가'); }
// 4) 합체: 특공대
{ const G = setup(), b = building(G, 'p_barracks'), h = hq0(G), x = h.x + 4, y = h.y + 7;
  const a = unit(G, 'p_rifle', x, y), g = unit(G, 'p_gren', x + 3, y + 1); a.hp = 40; g.hp = 70;
  cmd(G, { type: 'merge', unit: a.id, recipe: 'commando' }); ok(!G.merges?.length && G._msgs.includes('병영 강화 2단계가 필요합니다'), '병영 2단계 전에는 합체 불가');
  b.lv = 2; RTS.census(G); const sup0 = (RTS.census(G), G.teams[0].sup);
  cmd(G, { type: 'merge', unit: a.id, recipe: 'commando' }); ok(G.merges.length === 1 && a.merging && g.merging, '합체 시작: 재료가 모인다');
  run(G, 200); const c = G.ents.find(e => e.def === 'p_commando');
  ok(c && a.dead && g.dead && !G.ents.includes(a) && c.hp === 110 && !G.merges.length, `특공대 합체 완료: 체력 ${c && c.hp}/${c && RTS.stat(G, c, 'hp')} (재료 40+70)`);
  RTS.census(G); ok(G.teams[0].sup === sup0, `보급 유지 ${sup0}→${G.teams[0].sup}`);
  const dc = D.p_commando, dps = dc.weapon.damage / dc.weapon.cooldown, src = 6 / .8 + 14 / 1.6;
  ok(dc.hp === D.p_rifle.hp + D.p_gren.hp && Math.abs(dps - src * .75) < .2 && dc.weapon.splash === 1 && dc.weapon.air !== false, `특공대 스탯: 체력 ${dc.hp}(합산), 초당 피해 ${dps.toFixed(2)} = 재료 합 ${src.toFixed(2)} × 0.75`);
  const two = RTS.fuseDef({ p_rifle: 2 }), r2 = two.weapon.damage / two.weapon.cooldown; ok(Math.abs(r2 / (6 / .8) - 1.5) < .02 && two.hp === 100, `같은 두 기(소총병 2) 합체면 공격 1.5배(${(r2 / 7.5).toFixed(2)}), 체력 2배`);
  // 재료 부족
  const lone = unit(G, 'p_rifle', x - 3, y); cmd(G, { type: 'merge', unit: lone.id, recipe: 'commando' });
  ok(!lone.merging && G._msgs.some(m => m.startsWith('합체 재료가 부족합니다') && m.includes('척탄병 1기')), '재료가 없으면 알림만');
  // 다른 명령을 주면 취소
  const g2 = unit(G, 'p_gren', x - 3, y + 6); cmd(G, { type: 'merge', unit: lone.id, recipe: 'commando' }); cmd(G, { type: 'order', ids: [g2.id], order: { type: 'move', x: x + 20, y } }); run(G, 2);
  ok(!G.merges.length && !lone.merging && !g2.merging && !lone.dead && !g2.dead, '재료에 다른 명령을 주면 합체 취소');
  // 너무 멀면 재료로 안 잡힌다
  const far = unit(G, 'p_gren', x - 3 + RTS.MERGE.range + 3, y); g2.x = 2; g2.y = 2; cmd(G, { type: 'merge', unit: lone.id, recipe: 'commando' }); ok(!lone.merging && !far.merging, `${RTS.MERGE.range}칸 밖 재료는 쓰지 않는다`); }
// 5) 거대로봇: 다섯 기, 공중 재료 포함
{ const G = setup('pioneers', 9), f = building(G, 'p_factory', 6, 4), h = hq0(G), x = h.x + 2, y = h.y + 9; f.lv = 2; RTS.census(G);
  const parts = [unit(G, 'p_tank', x, y), unit(G, 'p_tank', x + 2, y + 2), unit(G, 'p_gunship', x - 3, y), unit(G, 'p_gunship', x + 4, y - 2)];
  const sieged = parts[1]; sieged.sieged = true; const sum = parts.reduce((s, e) => s + e.hp, 0) + 45;
  cmd(G, { type: 'merge', unit: parts[0].id, recipe: 'titan' }); ok(G.merges.length === 1, '공병까지 다섯 재료를 찾는다(시작 공병 사용)');
  run(G, 400); const ti = G.ents.find(e => e.def === 'p_titan');
  ok(ti && parts.every(e => e.dead) && ti.hp === Math.min(sum, RTS.stat(G, ti, 'hp')), `거대로봇 합체: 체력 ${ti && ti.hp} (합 ${sum}), 포격 모드 전차도 풀고 합류`);
  ok(D.p_titan.weapon.air !== false && D.p_titan.speed === D.p_tank.speed && D.p_titan.supply === 13, `거대로봇: 공중 공격 ${D.p_titan.weapon.air !== false}, 속도 ${D.p_titan.speed}, 보급 ${D.p_titan.supply}`);
  f.lv = 2; ok(!RTS.rankBlock(G, ti), '합체 유닛은 합체 건물 단계로 ★ 강화'); }
// 6) 세 진영 레시피 모두 실제로 합체되는지
for (const m of Object.values(RTS.defs.merges)) {
  const G = setup(m.faction, 21), h = hq0(G); building(G, m.at, 6, 4).lv = 2; RTS.census(G);
  const list = []; let k = 0; for (const id of Object.keys(m.parts)) for (let i = 0; i < m.parts[id]; i++) { list.push(unit(G, id, h.x + 3 + (k % 3) * 1.6, h.y + 8 + Math.floor(k / 3) * 1.6)); k++; }
  cmd(G, { type: 'merge', unit: list[0].id, recipe: m.id }); run(G, 400);
  const r = G.ents.find(e => e.def === m.into); ok(!!r && list.every(e => e.dead), `${RTS.defs.factions[m.faction].name} ${D[m.into].name}: 체력 ${D[m.into].hp}, 공격 ${D[m.into].weapon.damage}/${D[m.into].weapon.cooldown}s, 사거리 ${D[m.into].weapon.range}`);
}
// 7) 합체 중 저장 → 복원해도 결과가 같다
{ const mk = () => { const G = setup('pioneers', 4), b = building(G, 'p_barracks'), h = hq0(G); b.lv = 2; RTS.census(G); const a = unit(G, 'p_rifle', h.x + 4, h.y + 7); unit(G, 'p_gren', h.x + 8, h.y + 8); RTS.command(G, 0, { type: 'merge', unit: a.id, recipe: 'commando' }); RTS.command(G, 0, { type: 'levelup', building: b.id }); return G; };
  const A = mk(); run(A, 600); let B = mk(); run(B, 15); ok(B.merges.length === 1, '복원 전 합체 진행 중'); B = RTS.deserialize(RTS.serialize(B)); run(B, 585);
  ok(RTS.serialize(A) === RTS.serialize(B), '합체 도중 저장·복원 후 상태 동일'); }
console.log(fail ? `실패 ${fail}건` : '강화·합체 검사 통과'); process.exit(fail ? 1 : 0);
