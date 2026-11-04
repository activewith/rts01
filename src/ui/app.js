// app.js — DOM UI, 입력, 사운드, 게임 루프. RTS.mount(el, opts) 하나로 어디에든 붙는다.
// 월드 연동: const g = RTS.mount(div, {onEnd: r => {...}}); g.start({faction,map,difficulty}); g.destroy();
const HTML = `
<div class="k-game">
  <header class="k-top" id="k-top">
    <div class="k-res"><span class="k-chip ore" title="광석"><i></i><b id="k-ore">0</b></span><span class="k-chip gas" title="에테르"><i></i><b id="k-gas">0</b></span><span class="k-chip sup" title="보급"><i></i><b id="k-sup">0/0</b></span></div>
    <div class="k-clock" id="k-clock">00:00</div>
    <div class="k-tools">
      <button id="k-exbtn" class="k-ex-open" title="거래소 (M)">거래소</button>
      <button id="k-dipbtn" class="k-ex-open" title="자유상단 (N)">상단</button>
      <button id="k-idle" title="쉬는 일꾼 선택 (.)">쉬는 일꾼 <b id="k-idlen">0</b></button>
      <button id="k-boxbtn" class="k-touch" title="터치 범위 선택">범위 선택</button>
      <button id="k-speed" title="게임 속도">1배속</button>
      <button id="k-pause" title="일시정지 (F2)">정지</button>
      <button id="k-mute" title="소리">소리 끔</button>
      <button id="k-setbtn" title="설정">설정</button>
      <button id="k-menu">메뉴</button>
    </div>
  </header>
  <div class="k-stage" id="k-stage"><canvas id="k-view" tabindex="0" aria-label="전장"></canvas><div class="k-msgs" id="k-msgs" aria-live="polite"></div><div class="k-mode" id="k-modebar" hidden></div><div class="k-paused" id="k-paused" hidden>일시정지</div><aside class="k-ex" id="k-ex" hidden aria-label="거래소"></aside><aside class="k-ex" id="k-dip" hidden aria-label="자유상단"></aside></div>
  <footer class="k-bottom" id="k-bottom">
    <div class="k-mapbox"><canvas id="k-mini" width="176" height="176" aria-label="미니맵"></canvas></div>
    <div class="k-info" id="k-info"></div>
    <div class="k-card" id="k-card"></div>
  </footer>
  <div class="k-tip" id="k-tip" hidden></div>
  <section class="k-overlay k-start" id="k-start">
    <div class="k-panel">
      <h1>광맥전선</h1>
      <p class="k-sub">광석과 에테르를 캐고, 채취회사에 투자해 자금을 불리세요. 상대의 건물을 전부 무너뜨리면 이깁니다.</p>
      <h2>진영</h2><div class="k-opts" id="k-fac"></div>
      <h2>전장</h2><div class="k-opts" id="k-map"></div>
      <h2>상대 AI</h2><div class="k-opts k-three" id="k-dif"></div>
      <div class="k-go"><button class="k-primary" id="k-play">출격</button><button id="k-resume" hidden>이어하기</button><button id="k-setopen">설정</button></div>
      <details class="k-help"><summary>조작법</summary><dl>
        <dt>좌클릭·드래그</dt><dd>선택 / 범위 선택. 더블클릭은 같은 유닛 전체 선택</dd>
        <dt>우클릭</dt><dd>이동, 공격, 채취, 건설 재개. 건물은 집결지 지정. Shift는 명령 예약</dd>
        <dt>A · S · H · P</dt><dd>공격 이동 · 정지 · 위치 고수 · 순찰</dd>
        <dt>B</dt><dd>일꾼 건설 메뉴. 명령 카드의 글자가 단축키입니다</dd>
        <dt>Ctrl 또는 Alt + 숫자</dt><dd>부대 지정. 숫자로 호출, 두 번 누르면 이동. Shift + 숫자는 추가</dd>
        <dt>방향키·화면 가장자리·휠</dt><dd>카메라 이동과 확대. F2 일시정지, Esc 취소</dd>
        <dt>M</dt><dd>거래소. 회사당 100주를 사고팔고, 기준 주식을 모으면 인수해 거점을 차지합니다</dd>
        <dt>N</dt><dd>자유상단. 맵에 숨은 지부를 찾아 조건을 채우고 동맹금을 걸어 신청합니다. 거절되면 동맹금을 잃습니다</dd>
        <dt>회사 거점 공격</dt><dd>우클릭으로 공격하면 주가가 내리고, 무너지면 40초간 가동이 멈추며 배당도 끊깁니다</dd>
        <dt>터치</dt><dd>한 손가락은 지도 이동, 탭은 선택 또는 명령. 범위 선택 버튼을 켜면 드래그로 묶습니다</dd>
      </dl></details>
    </div>
  </section>
  <section class="k-overlay k-set" id="k-set" hidden aria-label="설정"></section>
  <section class="k-overlay k-end" id="k-end" hidden><div class="k-panel"><h1 id="k-endt"></h1><p class="k-sub" id="k-ends"></p><table id="k-stats"></table><div class="k-go"><button class="k-primary" id="k-again">다시 하기</button><button id="k-tomenu">메뉴로</button></div></div></section>
</div>`;

RTS.mount = function (root, opts = {}) {
  root.innerHTML = HTML;
  const $ = id => root.querySelector('#' + id), view = $('k-view'), mini = $('k-mini'), TS = 32;
  const store = { get(k) { try { return localStorage.getItem('kjh-rts:' + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('kjh-rts:' + k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem('kjh-rts:' + k); } catch (e) {} } };
  const app = { G: null, team: -1, sel: [], groups: {}, mode: null, menu: 'main', box: null, frame: 0, speed: 1, paused: false, demo: true, mouse: { x: 0, y: 0, wx: 0, wy: 0, inside: false }, boxTouch: false, cfg: JSON.parse(store.get('cfg') || 'null') || { faction: 'pioneers', map: 'ridge', difficulty: 'normal' }, settings: Object.assign(RTS.defaultSettings(), JSON.parse(store.get('settings') || '{}')) };
  const R = app.R = RTS.Renderer(view, app), cam = R.cam;

  // ── 소리: WebAudio 합성. 파일 없음 ─────────────────────
  let ac = null, muted = store.get('mute') === '1'; const last = {};
  const unlock = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ac && ac.state === 'suspended') ac.resume(); };
  function tone(f, f2, dur, type, vol) { vol *= app.settings.volume / 100; if (vol <= 0) return; const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur); o.connect(g); g.connect(ac.destination); o.start(); o.stop(t + dur); }
  app.sfx = function (k, at) { if (muted || !ac || app.demo) return; if (at && !R.onScreen(at.x, at.y)) return; const n = performance.now(); if (n - (last[k] || 0) < 70) return; last[k] = n;
    ({ shot: () => tone(900, 220, .05, 'square', .018), slash: () => tone(500, 180, .06, 'sawtooth', .02), thump: () => tone(190, 60, .14, 'triangle', .07), boom: () => tone(120, 34, .22, 'sawtooth', .05), bigboom: () => tone(90, 24, .55, 'sawtooth', .1), click: () => tone(640, 760, .05, 'sine', .04), warn: () => { tone(330, 250, .16, 'square', .03); }, ok: () => { tone(520, 780, .12, 'sine', .05); } }[k] || (() => {}))(); };

  // ── 메뉴 ──────────────────────────────────────────────
  function opts3(el, items, key) { el.innerHTML = ''; for (const it of items) { const b = document.createElement('button'); b.id = 'k-opt-' + it.id; b.className = 'k-opt' + (app.cfg[key] === it.id ? ' on' : ''); b.setAttribute('aria-pressed', app.cfg[key] === it.id); b.innerHTML = `<b>${it.name}</b>${it.blurb ? `<span>${it.blurb}</span>` : ''}`; b.onclick = () => { app.cfg[key] = it.id; store.set('cfg', JSON.stringify(app.cfg)); renderMenu(); if (key === 'map') demo(); }; el.appendChild(b); } }
  function renderMenu() { const d = RTS.defs; opts3($('k-fac'), Object.values(d.factions), 'faction'); opts3($('k-map'), Object.values(d.maps).map(m => ({ id: m.id, name: m.name, blurb: m.desc })), 'map'); opts3($('k-dif'), Object.values(d.difficulties), 'difficulty'); $('k-resume').hidden = !store.get('save'); }

  function bind(G) { app.G = G; R.attach(G); app.sel = []; app.mode = null; app.menu = 'main'; app.hudSig = ''; app.msgs = []; R.fogReady = false; $('k-msgs').innerHTML = ''; app.exOpen = false; app.exRows = null; $('k-ex').hidden = true; app.dipOpen = false; app.dipSig = ''; app.stakes = {}; $('k-dip').hidden = true;
    RTS.on(G, 'notice', n => { if (n.team === app.team) notice(n.text, n.kind); });
    RTS.on(G, 'attacked', ({ e }) => { if (e.team !== app.team) return; const n = G.tick; if (n - (app.alarmT || -999) > 200) { app.alarmT = n; app.alarmAt = { x: e.x, y: e.y }; notice((RTS.defOf(e).kind === 'building' ? '기지가' : '병력이') + ' 공격받고 있습니다', 'warn'); R.pings.push({ x: e.x, y: e.y, life: 60, max: 60, c: '#ff5a48' }); } });
    RTS.on(G, 'built', ({ e }) => { if (e.team === app.team) app.sfx('ok'); });
    RTS.on(G, 'gameover', o => { if (!app.demo) finish(o); else setTimeout(demo, 2500); });
  }
  function centerOn(x, y) { cam.x = x * TS - view.width / cam.z / 2; cam.y = y * TS - view.height / cam.z / 2; clampCam(); }
  function clampCam() { const G = app.G; if (!G) return; const vw = view.width / cam.z, vh = view.height / cam.z, W = G.w * TS, H = G.h * TS;
    cam.x = vw >= W ? (W - vw) / 2 : Math.max(0, Math.min(W - vw, cam.x)); cam.y = vh >= H ? (H - vh) / 2 : Math.max(0, Math.min(H - vh, cam.y)); }
  function demo() { app.demo = true; app.team = -1; const fs = Object.keys(RTS.defs.factions);
    const G = RTS.createGame({ map: app.cfg.map, seed: 40 + (Date.now() % 1000), nofog: true, settings: app.settings, players: [{ faction: fs[0], ai: 'hard' }, { faction: fs[1], ai: 'hard' }] });
    for (let i = 0; i < 20 * 100; i++) RTS.step(G); // 메뉴 뒤 배경이 이미 진행 중인 기지가 되도록 미리 돌린다
    bind(G); cam.z = 1; root.querySelector('.k-game').classList.add('demo'); layout(); const base = G.ents.find(e => e.team === 0 && RTS.defOf(e).dropoff) || { x: G.w / 2, y: G.h / 2 }; centerOn(base.x - (view.width > 900 ? 5 : 0), base.y); }
  app.start = function (cfg) { Object.assign(app.cfg, cfg || {}); const f = Object.keys(RTS.defs.factions), foe = f.find(x => x !== app.cfg.faction); app.demo = false; app.team = 0; app.speed = 1; app.paused = false;
    const G = RTS.createGame({ map: app.cfg.map, seed: Date.now() % 100000, settings: app.settings, players: [{ faction: app.cfg.faction }, { faction: foe, ai: app.cfg.difficulty }] });
    showGame(G); };
  function showGame(G) { bind(G); $('k-start').hidden = true; $('k-end').hidden = true; root.querySelector('.k-game').classList.remove('demo'); layout();
    cam.z = view.width < 700 ? .8 : 1; const hq = G.ents.find(e => e.team === app.team && RTS.defOf(e).dropoff); if (hq) { centerOn(hq.x, hq.y); app.sel = [hq.id]; } updateSpeed(); }
  app.toMenu = () => { if (app.G && !app.demo && !app.G.over) store.set('save', RTS.serialize(app.G)); $('k-end').hidden = true; $('k-start').hidden = false; renderMenu(); demo(); };
  app.saveState = () => (app.G && !app.demo ? RTS.serialize(app.G) : null);
  app.loadState = json => { app.demo = false; app.team = 0; const G = RTS.deserialize(json); showGame(G); };
  function finish(o) { const G = app.G, win = o.winner === app.team, a = G.teams[app.team], b = G.teams.find(t => t.id !== app.team), m = Math.floor(G.tick / 1200), s = Math.floor(G.tick / 20) % 60;
    store.del('save'); $('k-endt').textContent = win ? '승리' : '패배'; $('k-ends').textContent = `${m}분 ${s}초 · ${b.name} AI ${RTS.defs.difficulties[b.ai].name}`;
    const row = (l, x, y) => `<tr><th scope="row">${l}</th><td>${x}</td><td>${y}</td></tr>`;
    $('k-stats').innerHTML = `<thead><tr><th></th><td>${a.name}</td><td>${b.name}</td></tr></thead>` + row('캔 광석', a.stats.ore, b.stats.ore) + row('캔 에테르', a.stats.gas, b.stats.gas) + row('누적 배당', Math.round(a.stats.div || 0), Math.round(b.stats.div || 0)) + row('전쟁 피해액', Math.round(a.stats.warLoss || 0), Math.round(b.stats.warLoss || 0)) + row('약탈 획득', Math.round(a.stats.loot || 0), Math.round(b.stats.loot || 0)) + row('생산한 유닛', a.stats.made, b.stats.made) + row('파괴한 수', a.stats.kills, b.stats.kills) + row('잃은 수', a.stats.lost, b.stats.lost);
    $('k-end').hidden = false; if (opts.onEnd) opts.onEnd({ win, ticks: G.tick, stats: a.stats, cfg: app.cfg }); }

  // ── 메시지와 HUD ──────────────────────────────────────
  function notice(text, kind) { const box = $('k-msgs'), d = document.createElement('div'); if (box.lastChild && box.lastChild.textContent === text) return; d.textContent = text; d.className = 'k-msg ' + (kind || ''); box.appendChild(d); while (box.children.length > 4) box.firstChild.remove(); setTimeout(() => d.remove(), 3800); if (kind === 'warn') app.sfx('warn'); }
  const cost = c => Object.keys(c || {}).map(k => `<span class="c-${k}">${k === 'ore' ? '광석' : '에테르'} ${c[k]}</span>`).join(' ');
  function selected() { return app.sel.map(i => app.G.byId[i]).filter(e => e && !e.dead); }
  function leader(list) { const own = list.filter(e => e.team === app.team); if (!own.length) return null; return own.slice().sort((a, b) => cardRank(b) - cardRank(a))[0]; }
  const cardRank = e => { const d = RTS.defOf(e); return (d.abilities ? 3 : 0) + (d.gather ? 2 : 0) + (d.kind === 'unit' ? 1 : 0); };

  function cardItems() { const G = app.G, list = selected(), L = leader(list), t = G.teams[app.team], items = [];
    if (list.length === 1 && list[0].branch) { items.push({ key: 'N', text: '상단', name: '자유상단 열기', desc: '동맹과 거래 메뉴를 엽니다', ok: true, run: () => { if (!app.dipOpen) toggleDip(); } }); return items; }
    if (list.length === 1 && list[0].company) { const id = list[0].company, c = G.market.cos[id], tr = (qty, key, text, name) => items.push({ key, text, name, desc: qty > 0 ? `예상 비용 광석 ${Math.ceil(RTS.quote(G, c, Math.min(qty, c.free)).total)}` : `예상 수령 광석 ${Math.floor(RTS.quote(G, c, -Math.min(-qty, c.shares[app.team] || 0)).total)} (수수료 ${RTS.cfg(G).fee}%)`, ok: true, run: () => trade(id, qty) });
      tr(5, 'Q', '+5', '5주 매수'); tr(20, 'W', '+20', '20주 매수'); tr(-5, 'E', '-5', '5주 매도'); tr(-100, 'R', '전량', '보유 주식 전량 매도'); return items; }
    if (!L) return items;
    const d = RTS.defOf(L), f = t.faction, ids = list.filter(e => e.def === L.def).map(e => e.id), allIds = list.filter(e => RTS.defOf(e).kind === 'unit').map(e => e.id);
    const ent = (id, act) => { const u = RTS.defs.entities[id], tech = RTS.techOk(t, u); return { key: u.key, img: R.icon(id, app.team, f), name: u.name, desc: u.desc, cost: u.cost, sub: u.supply ? '보급 ' + u.supply : '', ok: tech, why: tech ? '' : '필요: ' + u.requires.map(r => RTS.defs.entities[r]?.name || RTS.defs.upgrades[r]?.name).join(', '), run: act }; };
    if (!RTS.complete(L)) { items.push({ key: 'X', text: '취소', name: '건설 취소', desc: '비용의 75%를 돌려받습니다', ok: true, run: () => RTS.command(G, app.team, { type: 'cancel', building: L.id }) }); return items; }
    if (app.menu === 'build' && d.builds) { for (const id of d.builds) items.push(ent(id, () => { app.mode = { type: 'place', def: id }; app.menu = 'main'; })); items.push({ key: 'Escape', label: 'Esc', text: '뒤로', name: '뒤로', ok: true, run: () => { app.menu = 'main'; } }); return items; }
    if (d.kind === 'unit') {
      const tgt = (order, text, key, name, desc) => ({ key, text, name, desc, ok: true, run: () => setMode({ type: 'target', order }) });
      items.push(tgt('amove', '공격', 'A', '공격 이동', '이동하면서 만나는 적을 공격합니다'));
      items.push({ key: 'S', text: '정지', name: '정지', ok: true, run: () => RTS.command(G, app.team, { type: 'order', ids: allIds, order: null, stop: true }) });
      items.push({ key: 'H', text: '고수', name: '위치 고수', desc: '자리를 지키며 사거리 안만 공격합니다', ok: true, run: () => RTS.command(G, app.team, { type: 'order', ids: allIds, order: { type: 'hold' } }) });
      items.push(tgt('patrol', '순찰', 'P', '순찰', '현재 위치와 지정 지점을 왕복합니다'));
      for (const id of d.abilities || []) { const ab = RTS.defs.abilities[id], unlocked = !ab.requires || t.upgrades[ab.requires], cd = Math.max(0, ((L.cds[id] || 0) - G.tick) / 20);
        items.push({ key: ab.key, text: ab.short || ab.name.slice(0, 2), name: ab.name + (ab.id === 'siege' && L.sieged ? ' 해제' : ''), desc: ab.desc, ok: !!unlocked, cool: cd > 0 ? Math.ceil(cd) : 0, why: unlocked ? '' : '연구 필요: ' + RTS.defs.upgrades[ab.requires].name, run: () => ab.target === 'point' ? setMode({ type: 'target', ability: id, radius: 2.5 }) : RTS.command(G, app.team, { type: 'ability', ids, ability: id }) }); }
      if (d.builds) items.push({ key: 'B', text: '건설', name: '건설', desc: '건물을 고릅니다', ok: true, run: () => { app.menu = 'build'; } });
    } else {
      for (const id of d.trains || []) items.push(ent(id, () => { const q = ids.map(i => G.byId[i]).sort((a, b) => a.prod.length - b.prod.length)[0]; RTS.command(G, app.team, { type: 'train', building: q.id, unit: id }); }));
      for (const id of d.researches || []) { const u = RTS.defs.upgrades[id]; if (t.upgrades[id] || t.research[id]) continue; const tech = RTS.techOk(t, u); items.push({ key: u.key, text: u.short || u.name.slice(0, 2), name: u.name, desc: u.desc, cost: u.cost, ok: tech, why: tech ? '' : '필요: ' + u.requires.map(r => RTS.defs.entities[r]?.name).join(', '), run: () => RTS.command(G, app.team, { type: 'research', building: L.id, upgrade: id }) }); }
      if (L.prod.length) items.push({ key: 'X', text: '취소', name: '마지막 대기 취소', desc: '비용을 돌려받습니다', ok: true, run: () => RTS.command(G, app.team, { type: 'cancel', building: L.id }) });
    }
    return items; }
  function setMode(m) { app.mode = m; }
  function trade(company, qty) { RTS.command(app.G, app.team, { type: 'trade', company, qty }); app.sfx('click'); app.cardSig = ''; }
  // ── 거래소 패널: 행은 한 번 만들고 값만 갱신해 클릭이 끊기지 않게 한다 ──
  function buildExchange() { const G = app.G, el = $('k-ex'); el.innerHTML = `<div class="x-head"><h2>거래소</h2><span id="x-next"></span><button id="x-close" aria-label="거래소 닫기">닫기</button></div><div class="x-sum"><span>평가액 <b id="x-value">0</b></span><span>누적 배당 <b id="x-div">0</b></span><span>신용 <b id="x-credit">100%</b></span></div><div id="x-rows"></div><div class="x-war" id="x-war"></div><div class="x-news" id="x-news"></div>`;
    const rows = $('x-rows'); app.exRows = {};
    for (const c of Object.values(G.market.cos)) { const d = RTS.defs.companies[c.id], r = document.createElement('div'); r.className = 'x-row ' + d.resource;
      r.innerHTML = `<div class="x-top"><button class="x-name" title="거점으로 이동"><b>${d.name}</b><small>${d.blurb}</small></button><svg viewBox="0 0 90 28" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg><div class="x-price"><b></b><small></small></div></div><div class="x-stake" title="51주 이상이면 경영권"><i class="me"></i><i class="foe"></i><s></s></div><div class="x-meta"><span class="x-own"></span><span class="x-pay"></span></div><div class="x-btn"><button data-q="5">+5</button><button data-q="20">+20</button><button data-q="-5">-5</button><button data-q="-100">전량 매도</button></div>`;
      r.querySelectorAll('.x-btn button').forEach(b => { b.onclick = () => { unlock(); trade(c.id, +b.dataset.q); updateExchange(); }; });
      r.querySelector('.x-name').onclick = () => { const e = G.byId[c.site]; if (e) { centerOn(e.x, e.y); app.sel = [e.id]; } };
      rows.appendChild(r); app.exRows[c.id] = r; }
    $('x-close').onclick = toggleExchange; }
  function updateExchange() { const G = app.G; if (!app.exRows) buildExchange(); const t = G.teams[app.team], foe = G.teams.find(x => x.id !== app.team); let value = 0;
    for (const c of Object.values(G.market.cos)) { const r = app.exRows[c.id], mine = c.shares[app.team], theirs = c.shares[foe.id], h = c.hist, ref = h[Math.max(0, h.length - 13)], ch = (c.price / ref - 1) * 100, e = G.byId[c.site], down = e && e.downUntil > G.tick, min = Math.min(...h, c.price), max = Math.max(...h, c.price), span = Math.max(.01, max - min); value += mine * c.price;
      const pts = [...h, c.price].map((v, i, a) => `${(i / Math.max(1, a.length - 1) * 90).toFixed(1)},${(26 - (v - min) / span * 24).toFixed(1)}`).join(' '), line = r.querySelector('polyline'); line.setAttribute('points', pts); line.setAttribute('stroke', ch >= 0 ? '#ff6a5a' : '#5aa8ff');
      r.querySelector('.x-price b').textContent = c.price.toFixed(1); const sm = r.querySelector('.x-price small'); sm.textContent = (ch >= 0 ? '+' : '') + ch.toFixed(1) + '%'; sm.className = ch >= 0 ? 'up' : 'dn';
      r.querySelector('.x-stake s').style.left = RTS.cfg(G).control + '%'; r.querySelector('.me').style.width = mine + '%'; r.querySelector('.foe').style.width = theirs + '%';
      const k = c.owner < 0 ? 1 : c.owner === app.team ? RTS.cfg(G).ctrlBonus / 100 : RTS.cfg(G).minority / 100, unit = RTS.defs.companies[c.id].resource === 'ore' ? '광석' : '에테르';
      r.querySelector('.x-own').textContent = `내 ${mine}주 · 상대 ${theirs}주 · 시장 ${c.free}주` + (c.owner === app.team ? ' · 내 경영권' : c.owner >= 0 ? ' · 상대 경영권' : '');
      r.querySelector('.x-pay').textContent = down ? '가동 중단: 배당 없음' : `주당 ${(RTS.dividend(G, c) * k).toFixed(1)} ${unit}`; r.querySelector('.x-pay').classList.toggle('bad', !!down);
      r.querySelectorAll('.x-btn button').forEach(b => { const q = +b.dataset.q; b.disabled = q > 0 ? !c.free || t.res.ore < c.price : !mine; }); }
    $('x-value').textContent = Math.round(value); $('x-div').textContent = Math.round(t.stats.div || 0); $('x-next').textContent = '다음 배당 ' + Math.max(0, Math.ceil((G.market.nextDiv - G.tick) / 20)) + '초';
    $('x-credit').textContent = Math.round((t.credit ?? 1) * 100) + '%';
    const W = G.war, bases = Object.entries(W ? W.bases : {}).filter(([, b]) => b.team === app.team).sort((x, y) => y[1].main - x[1].main);
    $('x-war').innerHTML = `<h3>내 기지 경제</h3>` + (bases.map(([, b]) => { const hot = G.tick - b.lastHit < 200; return `<div class="x-base${hot ? ' hot' : ''}"><b>${b.main ? '본진' : '위성 기지'}</b><span>가치 ${b.value}</span><span>자원 ${Math.round(b.res)}</span><span>피해 배수 ${RTS.baseGrade(G, b).toFixed(2)}</span><span class="${b.eff < 1 ? 'low' : ''}">효율 ${Math.round(b.eff * 100)}%${hot ? ' · 교전 중' : ''}</span></div>`; }).join('') || '<p>사령부가 없습니다.</p>') + `<p>누적 피해 ${Math.round(t.stats.warLoss || 0)} · 약탈 ${Math.round(t.stats.loot || 0)}</p>`;
    const sig = G.market.news.map(n => n.t).join(); if (sig !== app.newsSig) { app.newsSig = sig; $('x-news').innerHTML = G.market.news.map(n => `<p><time>${String(Math.floor(n.t / 1200)).padStart(2, '0')}:${String(Math.floor(n.t / 20) % 60).padStart(2, '0')}</time>${n.text}</p>`).join('') || '<p>아직 시장 소식이 없습니다.</p>'; } }
  // ── 자유상단 패널: 상태가 바뀔 때만 다시 만들어 슬라이더가 끊기지 않게 한다 ──
  function toggleDip() { app.dipOpen = !app.dipOpen; if (app.dipOpen && app.exOpen) toggleExchange(); $('k-dip').hidden = !app.dipOpen; $('k-dipbtn').classList.toggle('on', app.dipOpen); if (app.dipOpen) { app.dipSig = ''; updateDip(); } }
  function updateDip() { const G = app.G, D = RTS.DIP, el = $('k-dip'), me = app.team, list = Object.values(G.dip.list);
    const sig = list.map(b => [b.found[me], b.ally].join()).join('|');
    if (sig !== app.dipSig) { app.dipSig = sig; el.innerHTML = `<div class="x-head"><h2>자유상단</h2><span id="d-rate"></span><button id="d-close" aria-label="자유상단 닫기">닫기</button></div><p class="d-help">지부 위치는 게임마다 바뀝니다. 유닛을 보내 찾아야 거래와 동맹이 열리고, 먼저 찾으면 수락 확률이 ${RTS.cfg(G).firstBonus}% 오릅니다.</p><div id="d-rows"></div>`;
      const rows = $('d-rows'); list.forEach(b => { const d = RTS.defs.branches[b.id], r = document.createElement('div'); r.className = 'd-row'; r.id = 'd-' + b.id; const mineA = b.ally === me;
        if (!b.found[me]) r.innerHTML = `<b>미발견 지부</b><small>맵 어딘가에 있습니다. 유닛을 보내 찾으세요.</small>`;
        else { r.innerHTML = `<div class="d-top"><button class="x-name d-go"><b>${d.name}</b></button><em class="d-state"></em></div><small>혜택: ${d.perkText}</small><small class="d-need"></small>` +
          (mineA ? `<div class="d-line"><span class="d-stake"></span><button class="d-fund">출자 +100</button></div>` : b.ally >= 0 ? '' : `<label class="d-slide" for="d-stake-${b.id}"><span class="d-amt"></span><input type="range" id="d-stake-${b.id}" min="${D.min}" max="${D.full}" step="50"><span class="d-pct"></span></label><button class="d-apply"></button>`) +
          (b.ally >= 0 && !mineA ? '' : `<div class="d-line d-barter"><button class="d-buy"></button><button class="d-sell"></button></div>`);
          r.querySelector('.d-go').onclick = () => { const e = G.byId[b.site]; if (e) { centerOn(e.x, e.y); app.sel = [e.id]; } };
          const sl = r.querySelector('input'); if (sl) { sl.value = app.stakes[b.id] || 200; sl.oninput = () => { app.stakes[b.id] = +sl.value; updateDip(); }; }
          const ap = r.querySelector('.d-apply'); if (ap) ap.onclick = () => { unlock(); RTS.command(G, me, { type: 'ally', branch: b.id, stake: +sl.value }); app.sfx('click'); };
          const fu = r.querySelector('.d-fund'); if (fu) fu.onclick = () => RTS.command(G, me, { type: 'fund', branch: b.id, amount: 100 });
          const bu = r.querySelector('.d-buy'), se = r.querySelector('.d-sell'); if (bu) { bu.onclick = () => RTS.command(G, me, { type: 'barter', branch: b.id, buy: true }); se.onclick = () => RTS.command(G, me, { type: 'barter', branch: b.id, buy: false }); } }
        rows.appendChild(r); }); $('d-close').onclick = toggleDip; }
    const sp = RTS.tradeSpread(G, me), rate = G.dip.rate, t = G.teams[me]; const rt = $('d-rate'); if (rt) rt.textContent = `시세 에테르 1 = 광석 ${rate.toFixed(2)}`;
    for (const b of list) { const r = $('d-' + b.id), d = RTS.defs.branches[b.id]; if (!r || !b.found[me]) continue;
      const st = r.querySelector('.d-state'); st.textContent = b.ally === me ? '내 동맹' : b.ally >= 0 ? '상대 동맹' : b.lockUntil > G.tick ? '복구 중' : '중립'; st.className = 'd-state ' + (b.ally === me ? 'ok' : b.ally >= 0 ? 'bad' : '');
      const nd = r.querySelector('.d-need'), ok = d.check(G, t); nd.textContent = `조건: ${d.need} ${ok ? '(충족)' : '(미달)'}`; nd.classList.toggle('bad', !ok);
      const sl = r.querySelector('input'); if (sl) { const s = +sl.value; r.querySelector('.d-amt').textContent = '동맹금 ' + s; r.querySelector('.d-pct').textContent = '수락 ' + Math.round(RTS.allyChance(G, me, b.id, s) * 100) + '%'; const block = RTS.allyBlock(G, me, b.id, s), ap = r.querySelector('.d-apply'); ap.disabled = !!block; ap.textContent = block || `동맹 신청 (거절 시 ${Math.round(s * RTS.cfg(G).rejectLoss / 100)} 손실)`; }
      const ds = r.querySelector('.d-stake'); if (ds) ds.textContent = `출자금 ${b.stake} · 30초당 광석 ${(b.stake * RTS.cfg(G).stakeYield / 100).toFixed(0)}`;
      const bu = r.querySelector('.d-buy'); if (bu) { bu.textContent = `광석 ${Math.ceil(D.lot * rate * (1 + sp))} → 에테르 ${D.lot}`; r.querySelector('.d-sell').textContent = `에테르 ${D.lot} → 광석 ${Math.floor(D.lot * rate * (1 - sp))}`; } } }
  function toggleExchange() { app.exOpen = !app.exOpen; if (app.exOpen && app.dipOpen) toggleDip(); $('k-ex').hidden = !app.exOpen; $('k-exbtn').classList.toggle('on', app.exOpen); if (app.exOpen) updateExchange(); }
  function renderCard() { const G = app.G, el = $('k-card'), items = app.card = cardItems(), t = G.teams[app.team];
    const sig = items.map(i => i.key + i.name + i.ok + (i.cool || 0) + (i.cost ? RTS.canPay(t, i.cost) : '')).join('|');
    if (sig === app.cardSig) return; app.cardSig = sig; el.innerHTML = '';
    items.forEach((it, i) => { const b = document.createElement('button'); b.id = 'k-cmd-' + i; b.className = 'k-cmd' + (it.ok ? '' : ' off') + (it.cost && !RTS.canPay(t, it.cost) ? ' poor' : ''); b.innerHTML = (it.img ? `<img src="${it.img}" alt="">` : `<em>${it.text}</em>`) + `<kbd>${it.label || it.key}</kbd>` + (it.cool ? `<u>${it.cool}</u>` : '');
      b.setAttribute('aria-label', it.name); b.onclick = () => { unlock(); useItem(it); }; b.onmouseenter = () => tip(b, it); b.onmouseleave = () => { $('k-tip').hidden = true; }; el.appendChild(b); }); }
  function useItem(it) { if (!it.ok) { notice(it.why || '아직 사용할 수 없습니다', 'warn'); return; } app.sfx('click'); it.run(); app.cardSig = ''; $('k-tip').hidden = true; }
  function tip(b, it) { const T = $('k-tip'), r = b.getBoundingClientRect(), rr = root.getBoundingClientRect(); T.innerHTML = `<b>${it.name}</b>${it.cost ? `<p>${cost(it.cost)} ${it.sub || ''}</p>` : ''}${it.desc ? `<p>${it.desc}</p>` : ''}${it.why ? `<p class="why">${it.why}</p>` : ''}`; T.hidden = false; T.style.right = Math.max(8, rr.right - r.right) + 'px'; T.style.bottom = (rr.bottom - r.top + 8) + 'px'; }
  function renderInfo() { const G = app.G, el = $('k-info'), list = selected(); app.sel = list.map(e => e.id);
    let h = ''; if (!list.length) { const sig0 = 'none'; if (app.infoSig !== sig0) { el.innerHTML = '<p class="k-empty">유닛이나 건물을 선택하세요.</p>'; app.infoSig = sig0; } return; }
    const e = list[0], d = RTS.defOf(e), f = e.team >= 0 ? G.teams[e.team].faction : 'pioneers';
    if (list.length === 1 && e.branch) { const b = G.dip.list[e.branch], d2 = RTS.defs.branches[e.branch]; h = `<div class="k-one"><img src="${R.icon(e.def, -1, f)}" alt=""><div><h3>${d2.name}</h3><p class="k-st">${b.ally < 0 ? '중립 지부' : b.ally === app.team ? '내 동맹' : '상대 동맹'} · ${d2.perkText}</p></div></div>`;
    } else if (list.length === 1 && e.company) { const c = G.market.cos[e.company], co = RTS.defs.companies[e.company], hp = d.hp, dn = e.downUntil > G.tick;
      h = `<div class="k-one"><img src="${R.icon(e.def, -1, f)}" alt=""><div><h3>${co.name}</h3><p class="k-hp">${Math.ceil(e.hp)} / ${hp}${dn ? ' · 가동 중단' : ''}</p><p class="k-st">주가 ${c.price.toFixed(1)} · 내 지분 ${c.shares[app.team]}주 · ${c.owner < 0 ? '경영권 없음' : c.owner === app.team ? '내 경영권' : '상대 경영권'}</p></div></div>`;
    } else if (list.length === 1) { const max = e.team >= 0 ? RTS.stat(G, e, 'hp') : 0, w = RTS.weapon(e), stats = [];
      if (d.resource) stats.push(`남은 양 ${e.amount}`);
      if (w) stats.push(`공격 ${Math.round(RTS.wStat(G, e, w, 'damage'))}`, `사거리 ${+RTS.wStat(G, e, w, 'range').toFixed(1)}`);
      if (e.team >= 0) stats.push(`방어 ${Math.round(RTS.stat(G, e, 'armor'))}`); if (e.cargo) stats.push(`운반 ${e.cargo}`);
      let prod = ''; if (e.prod && e.prod.length) { const p = e.prod[0], u = p.kind === 'unit' ? RTS.defs.entities[p.id] : RTS.defs.upgrades[p.id]; prod = `<div class="k-prod"><span>${u.name}${!p.started ? ' · 보급 부족' : ''}</span><i><s style="width:${Math.round(p.t / p.total * 100)}%"></s></i><span>대기 ${e.prod.length}/5</span></div>`; }
      else if (e.built !== undefined && !RTS.complete(e)) prod = `<div class="k-prod"><span>건설 중</span><i><s style="width:${Math.round(e.built / e.buildT * 100)}%"></s></i></div>`;
      h = `<div class="k-one">${d.resource ? '' : `<img src="${R.icon(e.def, e.team, f)}" alt="">`}<div><h3>${d.name}</h3>${max ? `<p class="k-hp">${Math.ceil(e.hp)} / ${Math.round(max)}</p>` : ''}<p class="k-st">${stats.join(' · ')}</p>${prod}</div></div>`;
    } else { const sum = {}; h = '<div class="k-many">' + list.slice(0, 32).map(u => { const k = Math.max(0, u.hp / RTS.stat(G, u, 'hp')); return `<button data-id="${u.id}" title="${RTS.defOf(u).name}"><img src="${R.icon(u.def, u.team, f)}" alt=""><i style="width:${Math.round(k * 100)}%;background:${k > .55 ? 'var(--ok)' : k > .28 ? 'var(--warn)' : 'var(--bad)'}"></i></button>`; }).join('') + '</div>'; }
    if (h !== app.infoSig) { el.innerHTML = h; app.infoSig = h; el.querySelectorAll('.k-many button').forEach(b => { b.onclick = () => { app.sel = [+b.dataset.id]; }; }); } }
  function renderHud() { const G = app.G, t = G.teams[app.team]; if (!t) return; if (app.exOpen) updateExchange(); if (app.dipOpen) updateDip();
    $('k-ore').textContent = Math.floor(t.res.ore); $('k-gas').textContent = Math.floor(t.res.gas); $('k-sup').textContent = t.sup + '/' + t.cap; $('k-sup').parentNode.classList.toggle('full', t.sup >= t.cap);
    const s = Math.floor(G.tick / 20); $('k-clock').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    const idle = G.ents.filter(e => e.team === app.team && RTS.defOf(e).gather && !e.order); $('k-idlen').textContent = idle.length; app.idle = idle;
    renderInfo(); renderCard(); const m = app.mode, mb = $('k-modebar');
    if (m) { mb.hidden = false; const txt = m.type === 'place' ? RTS.defs.entities[m.def].name + ' 건설 위치를 고르세요' : m.ability ? RTS.defs.abilities[m.ability].name + ' 지점을 고르세요' : m.order === 'amove' ? '공격 이동 지점을 고르세요' : '순찰 지점을 고르세요'; if (mb.textContent !== txt + ' · Esc 취소') mb.textContent = txt + ' · Esc 취소'; } else mb.hidden = true; }
  function renderMini() { const G = app.G, c = mini.getContext('2d'), W = mini.width, H = mini.height, sc = Math.min(W / G.w, H / G.h), ox = (W - G.w * sc) / 2, oy = (H - G.h * sc) / 2; app.miniT = { sc, ox, oy };
    c.fillStyle = '#0a0f18'; c.fillRect(0, 0, W, H); const b = R.terrain(); if (b) c.drawImage(b, ox, oy, G.w * sc, G.h * sc);
    const t = G.teams[app.team], fogged = t && !G.nofog;
    for (const e of G.ents) { const d = RTS.defOf(e), x = ox + e.x * sc, y = oy + e.y * sc; if (e.branch && !RTS.branchKnown(G, app.team, e)) continue;
      if (fogged && !d.site && e.team !== app.team && !(e.team < 0 ? t.seen[(e.y | 0) * G.w + (e.x | 0)] : RTS.visibleTo(G, app.team, e.x, e.y))) continue;
      c.fillStyle = d.site && e.team < 0 ? '#eef2f7' : e.team < 0 ? (d.resource === 'ore' ? '#ffc247' : '#ea7be0') : RTS.TEAM[e.team].main; const s = d.site ? 5 : d.size && e.team >= 0 ? 4 : 2.4; c.fillRect(x - s / 2, y - s / 2, s, s); }
    if (fogged) { c.fillStyle = 'rgba(8,12,22,.72)'; const step = 2; for (let y = 0; y < G.h; y += step) for (let x = 0; x < G.w; x += step) { if (!t.vis[y * G.w + x]) { c.globalAlpha = t.seen[y * G.w + x] ? .45 : 1; c.fillRect(ox + x * sc, oy + y * sc, sc * step + .6, sc * step + .6); } } c.globalAlpha = 1;
      for (const id of Object.keys(R.ghosts)) { const g = R.ghosts[id]; c.fillStyle = RTS.TEAM[g.team].main; c.fillRect(ox + g.x * sc - 2, oy + g.y * sc - 2, 4, 4); } }
    c.strokeStyle = '#fff'; c.lineWidth = 1; c.strokeRect(ox + cam.x / TS * sc, oy + cam.y / TS * sc, view.width / cam.z / TS * sc, view.height / cam.z / TS * sc); }

  // ── 입력 ──────────────────────────────────────────────
  const toWorld = (sx, sy) => [(sx / cam.z + cam.x) / TS, (sy / cam.z + cam.y) / TS];
  function setMouse(e) { const r = view.getBoundingClientRect(), k = view.width / r.width; app.mouse.x = (e.clientX - r.left) * k; app.mouse.y = (e.clientY - r.top) * k; [app.mouse.wx, app.mouse.wy] = toWorld(app.mouse.x, app.mouse.y); }
  app.placeTile = id => { const d = RTS.defs.entities[id]; return [Math.round(app.mouse.wx - d.size[0] / 2), Math.round(app.mouse.wy - d.size[1] / 2)]; };
  const canSee = e => e.team === app.team || (e.team < 0 ? RTS.branchKnown(app.G, app.team, e) : RTS.visibleTo(app.G, app.team, e.x, e.y));
  function pick(wx, wy) { const G = app.G; let best = null, bd = 1e9;
    for (const e of G.ents) { if (e.dead || !canSee(e)) continue; const d = RTS.defOf(e);
      if (d.size) { const r = RTS.rectOf(e); if (wx >= r.x0 && wx <= r.x0 + r.w && wy >= r.y0 && wy <= r.y0 + r.h && bd > 1) { bd = 1; best = e; } }
      else { const y = d.air ? wy + .6 : wy, q = Math.hypot(e.x - wx, e.y - y); if (q < d.r + .28 && q < bd) { bd = q; best = e; } } }
    return best; }
  function selectBox(b, add) { const G = app.G, [x0, y0] = toWorld(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1)), [x1, y1] = toWorld(Math.max(b.x0, b.x1), Math.max(b.y0, b.y1));
    const inBox = G.ents.filter(e => e.team === app.team && !e.dead && RTS.defOf(e).kind === 'unit' && !RTS.defOf(e).uncontrollable && e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1); const army = inBox.filter(e => !RTS.defOf(e).gather), chosen = army.length ? army : inBox;
    if (!chosen.length && !add) return; app.sel = add ? [...new Set([...app.sel, ...chosen.map(e => e.id)])] : chosen.map(e => e.id); app.menu = 'main'; app.mode = null; }
  function spread(ids, x, y) { const n = ids.length, cols = Math.ceil(Math.sqrt(n)), out = {}; const s = .95; ids.forEach((id, i) => { const row = (i / cols) | 0, col = i % cols; out[id] = { x: x + (col - (cols - 1) / 2) * s, y: y + (row - (cols - 1) / 2) * s }; }); return out; }
  function context(wx, wy, queue) { const G = app.G, list = selected().filter(e => e.team === app.team); if (!list.length) return false;
    const units = list.filter(e => RTS.defOf(e).kind === 'unit'), blds = list.filter(e => RTS.defOf(e).kind === 'building'), t = pick(wx, wy), ids = units.map(e => e.id); let color = '#7dffa8';
    if (blds.length && !units.length) { const res = t && (RTS.defOf(t).resource === 'ore' || (t.team === app.team && RTS.defOf(t).placeOn)); RTS.command(G, app.team, { type: 'rally', ids: blds.map(e => e.id), x: wx, y: wy, ent: res ? t.id : 0 }); R.pings.push({ x: wx, y: wy, life: 20, max: 20, c: color }); return true; }
    if (!units.length) return false;
    if (t && t.team !== app.team && (t.team >= 0 || t.company)) { RTS.command(G, app.team, { type: 'order', ids, order: { type: 'attack', target: t.id }, queue }); R.pings.push({ x: t.x, y: t.y, life: 20, max: 20, c: '#ff5a48' }); return true; }
    const workers = units.filter(e => RTS.defOf(e).gather).map(e => e.id), rest = ids.filter(i => !workers.includes(i));
    const gas = t && t.team === app.team && RTS.defOf(t).placeOn && RTS.complete(t), ore = t && RTS.defOf(t).resource === 'ore';
    if (t && (gas || ore) && workers.length) { RTS.command(G, app.team, { type: 'order', ids: workers, order: { type: 'gather', node: t.id }, queue }); if (rest.length) RTS.command(G, app.team, { type: 'order', ids: rest, order: { type: 'move', x: wx, y: wy }, spread: spread(rest, wx, wy), queue }); R.pings.push({ x: t.x, y: t.y, life: 20, max: 20, c: '#ffc247' }); return true; }
    if (t && t.team === app.team && !RTS.complete(t) && workers.length) { RTS.command(G, app.team, { type: 'order', ids: workers, order: { type: 'build', site: t.id }, queue }); return true; }
    RTS.command(G, app.team, { type: 'order', ids, order: { type: 'move', x: wx, y: wy }, spread: spread(ids, wx, wy), queue }); R.pings.push({ x: wx, y: wy, life: 20, max: 20, c: color }); return true; }
  function execMode(wx, wy, shift) { const G = app.G, m = app.mode, ids = selected().filter(e => e.team === app.team && RTS.defOf(e).kind === 'unit').map(e => e.id);
    if (m.type === 'place') { const [tx, ty] = app.placeTile(m.def), w = selected().filter(e => RTS.defOf(e).gather).sort((a, b) => (a.order && a.order.type === 'build' ? 1 : 0) - (b.order && b.order.type === 'build' ? 1 : 0)); RTS.command(G, app.team, { type: 'place', ids: w.map(e => e.id), def: m.def, tx, ty, queue: shift }); if (!shift) app.mode = null; return; }
    if (m.ability) RTS.command(G, app.team, { type: 'ability', ids, ability: m.ability, x: wx, y: wy, one: true });
    else RTS.command(G, app.team, { type: 'order', ids, order: { type: m.order, x: wx, y: wy }, spread: spread(ids, wx, wy), queue: shift });
    R.pings.push({ x: wx, y: wy, life: 20, max: 20, c: '#ff5a48' }); if (!shift) app.mode = null; }
  const drag = {};
  view.addEventListener('contextmenu', e => e.preventDefault());
  view.addEventListener('pointerenter', () => { app.mouse.inside = true; });
  view.addEventListener('pointerleave', () => { app.mouse.inside = false; });
  view.addEventListener('pointerdown', e => { unlock(); view.focus({ preventScroll: true }); setMouse(e); if (app.demo || app.G.over) return; view.setPointerCapture(e.pointerId); const touch = e.pointerType === 'touch', wx = app.mouse.wx, wy = app.mouse.wy;
    app.mouse.inside = true; if (e.button === 2) { if (app.mode) { app.mode = null; return; } context(wx, wy, e.shiftKey); return; }
    Object.assign(drag, { on: true, touch, sx: app.mouse.x, sy: app.mouse.y, cx: cam.x, cy: cam.y, moved: false, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }); });
  view.addEventListener('pointermove', e => { setMouse(e); if (!drag.on) return; const dx = app.mouse.x - drag.sx, dy = app.mouse.y - drag.sy; if (Math.hypot(dx, dy) > 6) drag.moved = true;
    if (!drag.moved || app.mode) return; if (drag.touch && !app.boxTouch) { cam.x = drag.cx - dx / cam.z; cam.y = drag.cy - dy / cam.z; clampCam(); } else app.box = { x0: drag.sx, y0: drag.sy, x1: app.mouse.x, y1: app.mouse.y }; });
  view.addEventListener('pointerup', e => { setMouse(e); if (!drag.on) return; drag.on = false; const G = app.G, wx = app.mouse.wx, wy = app.mouse.wy, now = performance.now();
    if (app.box) { selectBox(app.box, drag.shift); app.box = null; if (drag.touch) { app.boxTouch = false; $('k-boxbtn').classList.remove('on'); } return; }
    if (drag.moved && drag.touch) return;
    if (app.mode) { execMode(wx, wy, drag.shift); return; }
    const t = pick(wx, wy);
    if (drag.touch && selected().some(s => s.team === app.team) && (!t || t.team !== app.team || (RTS.defOf(t).kind === 'building' && selected().some(s => RTS.defOf(s).gather) && !RTS.complete(t))) && context(wx, wy, false)) return;
    if (!t) { app.sel = []; app.menu = 'main'; return; }
    app.menu = 'main'; const dbl = now - (app.lastClick || 0) < 320 && app.lastPick === t.def; app.lastClick = now; app.lastPick = t.def;
    if ((dbl || drag.ctrl) && t.team === app.team) { const vw = view.width / cam.z / TS, vh = view.height / cam.z / TS, x0 = cam.x / TS, y0 = cam.y / TS; app.sel = G.ents.filter(e => e.team === app.team && e.def === t.def && e.x >= x0 && e.x <= x0 + vw && e.y >= y0 && e.y <= y0 + vh).map(e => e.id); return; }
    if (drag.shift && t.team === app.team && RTS.defOf(t).kind === 'unit') { app.sel = app.sel.includes(t.id) ? app.sel.filter(i => i !== t.id) : [...app.sel, t.id]; return; }
    app.sel = [t.id]; });
  view.addEventListener('wheel', e => { e.preventDefault(); if (app.demo) return; setMouse(e); const [wx, wy] = [app.mouse.wx, app.mouse.wy], z = Math.max(.55, Math.min(1.6, cam.z * (e.deltaY < 0 ? 1.1 : .91))); cam.z = z; cam.x = wx * TS - app.mouse.x / z; cam.y = wy * TS - app.mouse.y / z; clampCam(); }, { passive: false });
  const miniEv = e => { const r = mini.getBoundingClientRect(), k = mini.width / r.width, T = app.miniT; if (!T) return null; return [((e.clientX - r.left) * k - T.ox) / T.sc, ((e.clientY - r.top) * k - T.oy) / T.sc]; };
  mini.addEventListener('contextmenu', e => { e.preventDefault(); const p = miniEv(e); if (p) context(p[0], p[1], e.shiftKey); });
  mini.addEventListener('pointerdown', e => { if (e.button !== 0 || app.demo) return; const p = miniEv(e); if (!p) return; if (app.mode && app.mode.type === 'target') { execMode(p[0], p[1], e.shiftKey); return; } mini.setPointerCapture(e.pointerId); centerOn(p[0], p[1]); app.miniDrag = true; });
  mini.addEventListener('pointermove', e => { if (app.miniDrag) { const p = miniEv(e); if (p) centerOn(p[0], p[1]); } });
  mini.addEventListener('pointerup', () => { app.miniDrag = false; });
  const keys = {}; let lastDigit = 0, lastDigitT = 0;
  const onKey = e => { if (app.setOpen) { if (e.key === 'Escape') toggleSettings(); return; } const live = app.G && !app.demo && !app.G.over; keys[e.key] = true; if (!live) return; const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (k.startsWith('Arrow')) { e.preventDefault(); return; }
    if (k === 'F2') { e.preventDefault(); togglePause(); return; }
    if (/^[0-9]$/.test(k)) { e.preventDefault(); const list = selected().filter(u => u.team === app.team).map(u => u.id);
      if (e.ctrlKey || e.metaKey || e.altKey) { app.groups[k] = list; notice(`${k}번 부대 지정`, 'ok'); }
      else if (e.shiftKey) app.groups[k] = [...new Set([...(app.groups[k] || []), ...list])];
      else { const g = (app.groups[k] || []).filter(i => app.G.byId[i]); if (!g.length) return; app.sel = g; app.menu = 'main'; const n = performance.now(); if (lastDigit === k && n - lastDigitT < 320) { const u = app.G.byId[g[0]]; centerOn(u.x, u.y); } lastDigit = k; lastDigitT = n; } return; }
    if (k === 'Escape' && app.mode) { app.mode = null; return; }
    if (k === '.') { if (app.idle && app.idle.length) { const u = app.idle[0]; app.sel = [u.id]; centerOn(u.x, u.y); } return; }
    if (k === ' ' ) { e.preventDefault(); if (app.alarmAt) centerOn(app.alarmAt.x, app.alarmAt.y); return; }
    if (e.ctrlKey || e.metaKey) return;
    if (k === 'M') { e.preventDefault(); toggleExchange(); return; }
    if (k === 'N') { e.preventDefault(); toggleDip(); return; }
    const it = (app.card || []).find(i => i.key === k); if (it) { e.preventDefault(); useItem(it); } };
  const offKey = e => { keys[e.key] = false; };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', offKey);
  // ── 설정 메뉴: RTS.SETTINGS를 읽어 자동 생성한다. 게임 중에는 일시정지되고 바로 적용된다 ──
  const liveGame = () => app.G && !app.demo && !app.G.over;
  const fmtSet = (s, v) => s.type === 'toggle' ? (v ? '켬' : '끔') : s.zero && v === 0 ? s.zero : v + (s.unit || '');
  function setValue(s, v) { app.settings[s.id] = v; store.set('settings', JSON.stringify(app.settings)); if (liveGame() && !s.client && !s.startOnly) RTS.cfg(app.G)[s.id] = v; }
  function renderSettings() { const el = $('k-set'), live = liveGame(), src = id => live && !RTS.SETTINGS.flatMap(g => g.items).find(x => x.id === id).client ? (RTS.cfg(app.G)[id] ?? app.settings[id]) : app.settings[id];
    el.innerHTML = `<div class="s-panel"><div class="s-head"><h2>설정</h2><button id="s-close">닫기</button></div><p class="s-note">${live ? '게임이 멈춰 있습니다. 바꾼 값은 이번 판에 바로 적용되며, 새 게임 전용 항목은 다음 판부터 적용됩니다.' : '여기서 고른 값은 이 브라우저에 저장되고 나와 AI에게 똑같이 적용됩니다.'}</p><div class="s-presets"><span>묶음 설정</span>${Object.keys(RTS.PRESETS).map(k => `<button data-preset="${k}">${k}</button>`).join('')}</div>` +
      RTS.SETTINGS.map(g => `<section><h3>${g.group}</h3>${g.note ? `<p class="s-note">${g.note}</p>` : ''}${g.items.map(s => { const off = live && s.startOnly, v = src(s.id), id = 's-' + s.id;
        return `<div class="s-row${off ? ' off' : ''}"><label for="${id}"><b>${s.label}</b>${s.desc ? `<small>${s.desc}</small>` : ''}${off ? '<small>다음 판부터 적용</small>' : ''}</label>` + (s.type === 'toggle' ? `<input type="checkbox" id="${id}" data-s="${s.id}" ${v ? 'checked' : ''} ${off ? 'disabled' : ''}>` : `<input type="range" id="${id}" data-s="${s.id}" min="${s.min}" max="${s.max}" step="${s.step}" value="${v}" ${off ? 'disabled' : ''}>`) + `<output id="${id}-v">${fmtSet(s, v)}</output></div>`; }).join('')}</section>`).join('') + `<div class="s-foot"><button id="s-reset">기본값으로 되돌리기</button></div></div>`;
    el.querySelectorAll('[data-s]').forEach(i => { const s = RTS.SETTINGS.flatMap(g => g.items).find(x => x.id === i.dataset.s); i.oninput = () => { const v = s.type === 'toggle' ? i.checked : +i.value; setValue(s, v); $('s-' + s.id + '-v').textContent = fmtSet(s, v); }; });
    el.querySelectorAll('[data-preset]').forEach(b => { b.onclick = () => applySettings(Object.assign(RTS.defaultSettings(), RTS.PRESETS[b.dataset.preset]), true); });
    $('s-reset').onclick = () => applySettings(RTS.defaultSettings(), false); $('s-close').onclick = toggleSettings; }
  function applySettings(vals, keepOther) { for (const s of RTS.SETTINGS.flatMap(g => g.items)) { if (keepOther && (s.client || s.startOnly)) continue; setValue(s, vals[s.id]); } renderSettings(); }
  function toggleSettings() { app.setOpen = !app.setOpen; $('k-set').hidden = !app.setOpen; if (app.setOpen) renderSettings(); else { app.exRows = null; updateSpeed(); } }
  function togglePause() { app.paused = !app.paused; $('k-paused').hidden = !app.paused; $('k-pause').textContent = app.paused ? '재개' : '정지'; }
  function updateSpeed() { $('k-speed').textContent = app.speed === 1 ? '1배속' : app.speed + '배속'; $('k-mute').textContent = muted ? '소리 켬' : '소리 끔'; $('k-paused').hidden = !app.paused; }
  $('k-setbtn').onclick = toggleSettings; $('k-setopen').onclick = toggleSettings; $('k-exbtn').onclick = toggleExchange; $('k-dipbtn').onclick = toggleDip; $('k-pause').onclick = togglePause; $('k-speed').onclick = () => { app.speed = app.speed === 1 ? 1.5 : app.speed === 1.5 ? 2 : 1; updateSpeed(); };
  $('k-mute').onclick = () => { unlock(); muted = !muted; store.set('mute', muted ? '1' : '0'); updateSpeed(); };
  $('k-menu').onclick = () => app.toMenu(); $('k-tomenu').onclick = () => app.toMenu(); $('k-again').onclick = () => { unlock(); app.start(); }; $('k-play').onclick = () => { unlock(); store.del('save'); app.start(); };
  $('k-resume').onclick = () => { unlock(); const s = store.get('save'); if (s) app.loadState(s); };
  $('k-idle').onclick = () => { if (app.idle && app.idle.length) { app.sel = app.idle.map(e => e.id); const u = app.idle[0]; centerOn(u.x, u.y); } };
  $('k-boxbtn').onclick = () => { app.boxTouch = !app.boxTouch; $('k-boxbtn').classList.toggle('on', app.boxTouch); };

  // ── 루프 ──────────────────────────────────────────────
  function layout() { const r = $('k-stage').getBoundingClientRect(), W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height)); if (view.width !== W || view.height !== H) { view.width = W; view.height = H; clampCam(); } }
  const ro = new ResizeObserver(layout); ro.observe($('k-stage'));
  let lastT = performance.now(), acc = 0, raf = 0, alive = true; const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loop(now) { if (!alive) return; raf = requestAnimationFrame(loop); const dt = Math.min(250, now - lastT); lastT = now; app.frame++; const G = app.G; if (!G) return;
    if (!app.paused && !G.over && (app.demo || !app.setOpen)) { acc += dt * (app.demo ? 1.5 : app.speed); const per = 1000 / RTS.HZ; let n = 0; while (acc >= per && n < 6) { RTS.step(G); acc -= per; n++; } if (n === 6) acc = 0; }
    if (app.demo) { if (!reduce) { const fight = G.ents.find(e => e.firedAt > G.tick - 20 && RTS.defOf(e).kind === 'unit'); if (fight) { const tx = fight.x * TS - view.width / 2, ty = fight.y * TS - view.height / 2; cam.x += (tx - cam.x) * .006; cam.y += (ty - cam.y) * .006; clampCam(); } } }
    else { const m = app.mouse, sp = 14 / cam.z, e = 12; let dx = 0, dy = 0; if (keys.ArrowLeft) dx = -sp; if (keys.ArrowRight) dx = sp; if (keys.ArrowUp) dy = -sp; if (keys.ArrowDown) dy = sp;
      if (app.settings.edgeScroll && m.inside && !drag.on && matchMedia('(pointer:fine)').matches) { if (m.x < e) dx = -sp; else if (m.x > view.width - e) dx = sp; if (m.y < e) dy = -sp; else if (m.y > view.height - e) dy = sp; }
      if (dx || dy) { cam.x += dx; cam.y += dy; clampCam(); [m.wx, m.wy] = toWorld(m.x, m.y); }
      view.style.cursor = app.mode ? 'crosshair' : 'default';
      if (app.frame % 12 === 0) renderHud(); }
    if (app.frame % 15 === 0 && !app.demo) renderMini();
    R.draw(Math.min(1, acc / (1000 / RTS.HZ))); }
  renderMenu(); layout(); demo(); raf = requestAnimationFrame(loop);
  if (opts.autostart) app.start(opts.autostart);
  app.destroy = () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', offKey); root.innerHTML = ''; };
  return app;
};
