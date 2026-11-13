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
      <button id="k-chatbtn" hidden title="채팅 (Enter)">채팅</button><button id="k-voicebtn" hidden title="음성 채팅: 내 마이크 켜고 끄기">음성 켜기</button><button id="k-speed" title="게임 속도">1배속</button>
      <button id="k-pause" title="일시정지 (F2)">정지</button>
      <button id="k-mute" title="소리">소리 끔</button>
      <button id="k-setbtn" title="설정">설정</button>
      <button id="k-menu">메뉴</button>
    </div>
  </header>
  <div class="k-stage" id="k-stage"><canvas id="k-view" tabindex="0" aria-label="전장"></canvas><div class="k-msgs" id="k-msgs" aria-live="polite"></div><aside class="k-tribe" id="k-tribe" hidden aria-label="잿빛 부족"></aside><div class="k-mode" id="k-modebar" hidden></div><div class="k-paused" id="k-paused" hidden>일시정지</div><div class="k-wait" id="k-wait" hidden>상대 기기를 기다리는 중</div><div class="k-chatlog" id="k-chatlog" aria-live="polite"></div><form class="k-chatbox" id="k-chatbox" hidden><div class="k-quick" id="k-quick"></div><div class="k-chatrow"><input class="k-in" id="k-chatin" maxlength="80" autocomplete="off" enterkeyhint="send" placeholder="메시지 입력 후 Enter" aria-label="채팅 메시지"><button type="submit">보내기</button><button type="button" id="k-chatx">닫기</button></div></form><aside class="k-ex" id="k-ex" hidden aria-label="거래소"></aside><aside class="k-ex" id="k-dip" hidden aria-label="자유상단"></aside></div>
  <footer class="k-bottom" id="k-bottom">
    <div class="k-mapbox"><canvas id="k-mini" width="176" height="176" aria-label="미니맵"></canvas></div>
    <div class="k-info" id="k-info"></div>
    <div class="k-card" id="k-card"></div>
  </footer>
  <div class="k-tip" id="k-tip" hidden></div><div class="k-tip k-htip" id="k-htip" hidden role="tooltip"></div>
  <section class="k-overlay k-start" id="k-start">
    <div class="k-panel">
      <h1>광맥전선</h1>
      <p class="k-sub">광석과 에테르를 캐고, 채취회사에 투자해 자금을 불리세요. 상대의 건물을 전부 무너뜨리면 이깁니다.</p>
      <h2>진영</h2><div class="k-opts" id="k-fac"></div>
      <h2>전장</h2><div class="k-opts" id="k-map"></div>
      <h2>상대 AI</h2><div class="k-opts k-three" id="k-dif"></div>
      <div class="k-go"><button class="k-primary" id="k-play">출격</button><button id="k-netopen" title="같은 와이파이의 다른 기기와 대전하거나 협동">둘이 하기</button><button id="k-resume" hidden>이어하기</button><button id="k-setopen">설정</button></div>
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
      <p class="k-ver" id="k-ver"></p>
    </div>
  </section>
  <section class="k-overlay k-set" id="k-set" hidden aria-label="설정"></section>
  <section class="k-overlay k-start k-net" id="k-net" hidden aria-label="둘이 대전"><div class="k-panel"><div class="k-netp" id="k-netp"></div><div class="k-netchat" id="k-netchat" hidden><h2>대화</h2><div class="k-chatlog lobby" id="n-chatlog" aria-live="polite"></div><form class="k-chatrow" id="n-chatform"><input class="k-in" id="n-chatin" maxlength="80" autocomplete="off" enterkeyhint="send" placeholder="메시지 입력" aria-label="채팅 메시지"><button type="submit">보내기</button></form><div class="k-quick" id="n-quick"></div><div class="k-go"><button id="n-voice">음성 켜기</button></div><p class="k-small">음성 채팅은 두 기기가 같은 방에 있으면 소리가 되울려 삐 소리가 날 수 있습니다. 이어폰을 쓰거나 다른 방에서 하세요.</p></div></div></section>
  <section class="k-overlay k-end" id="k-end" hidden><div class="k-panel"><h1 id="k-endt"></h1><p class="k-sub" id="k-ends"></p><table id="k-stats"></table><div class="k-go"><button class="k-primary" id="k-again">다시 하기</button><button id="k-tomenu">메뉴로</button></div></div></section>
  <audio id="k-voiceout" autoplay playsinline></audio>
</div>`;

RTS.mount = function (root, opts = {}) {
  root.innerHTML = HTML;
  const $ = id => root.querySelector('#' + id), view = $('k-view'), mini = $('k-mini'), TS = 32;
  const store = { get(k) { try { return localStorage.getItem('kjh-rts:' + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('kjh-rts:' + k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem('kjh-rts:' + k); } catch (e) {} } };
  const app = { G: null, team: -1, sel: [], groups: {}, mode: null, menu: 'main', box: null, frame: 0, speed: 1, paused: false, demo: true, mouse: { x: 0, y: 0, wx: 0, wy: 0, inside: false }, boxTouch: false, cfg: JSON.parse(store.get('cfg') || 'null') || { faction: 'pioneers', map: 'ridge', difficulty: 'normal' }, settings: Object.assign(RTS.defaultSettings(), JSON.parse(store.get('settings') || '{}')) };
  const R = app.R = RTS.Renderer(view, app), cam = R.cam;
  // 내 입력: 혼자 할 때는 바로 큐에, 둘이 할 때는 lockstep을 거쳐 두 기기에 같은 턴에 들어간다
  const send = c => { if (!app.G) return; if (app.net && app.net.L) app.net.L.local(c); else RTS.command(app.G, app.team, c); };

  // ── 소리: WebAudio 합성. 파일 없음 ─────────────────────
  let ac = null, music = null, muted = store.get('mute') === '1'; const last = {};
  const unlock = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ac && ac.state === 'suspended') ac.resume(); if (ac && !music && RTS.Music) { music = RTS.Music(ac); applyMusic(); } };
  // 배경음악: 메뉴·대기실은 잔잔한 곡, 게임 중에는 전투 곡. 음성 채팅으로 상대 목소리가 들어오는 동안은 음악을 줄인다
  function applyMusic() { if (!music) return; const duck = voice.inCall ? .4 : 1; music.setVolume(muted ? 0 : app.settings.music / 100 * .9 * duck); music.setMode(app.settings.music > 0 ? (app.G && !app.demo && !app.G.over ? 'game' : 'menu') : 'off'); }
  function tone(f, f2, dur, type, vol) { vol *= app.settings.volume / 100; if (vol <= 0) return; const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur); o.connect(g); g.connect(ac.destination); o.start(); o.stop(t + dur); }
  app.sfx = function (k, at) { if (muted || !ac || app.demo) return; if (at && !R.onScreen(at.x, at.y)) return; const n = performance.now(); if (n - (last[k] || 0) < 70) return; last[k] = n;
    ({ shot: () => tone(900, 220, .05, 'square', .018), slash: () => tone(500, 180, .06, 'sawtooth', .02), thump: () => tone(190, 60, .14, 'triangle', .07), boom: () => tone(120, 34, .22, 'sawtooth', .05), bigboom: () => tone(90, 24, .55, 'sawtooth', .1), click: () => tone(640, 760, .05, 'sine', .04), warn: () => { tone(330, 250, .16, 'square', .03); }, ok: () => { tone(520, 780, .12, 'sine', .05); } }[k] || (() => {}))(); };

  // ── 메뉴 ──────────────────────────────────────────────
  function opts3(el, items, key) { el.innerHTML = ''; for (const it of items) { const b = document.createElement('button'); b.id = 'k-opt-' + it.id; b.className = 'k-opt' + (app.cfg[key] === it.id ? ' on' : ''); b.setAttribute('aria-pressed', app.cfg[key] === it.id); b.innerHTML = `<b>${it.name}</b>${it.blurb ? `<span>${it.blurb}</span>` : ''}`; b.onclick = () => { app.cfg[key] = it.id; store.set('cfg', JSON.stringify(app.cfg)); renderMenu(); if (key === 'map') demo(); }; el.appendChild(b); } }
  function renderMenu() { const d = RTS.defs; opts3($('k-fac'), Object.values(d.factions), 'faction'); opts3($('k-map'), Object.values(d.maps).map(m => ({ id: m.id, name: m.name, blurb: m.desc })), 'map'); opts3($('k-dif'), Object.values(d.difficulties), 'difficulty'); $('k-resume').hidden = !store.get('save'); }

  function bind(G) { app.G = G; app.outShown = false; G.teams.forEach((t, i) => { RTS.TEAM[i] = G.coop ? RTS.COOP_COLOR[i] : RTS.FACTION_COLOR[t.faction]; }); R.attach(G); app.sel = []; app.mode = null; app.menu = 'main'; app.hudSig = ''; app.msgs = []; R.fogReady = false; $('k-msgs').innerHTML = ''; app.exOpen = false; app.exRows = null; $('k-ex').hidden = true; app.dipOpen = false; app.dipSig = ''; app.stakes = {}; $('k-dip').hidden = true; $('k-tribe').hidden = true; app.tribeSig = ''; app.tribeArm = null;
    RTS.on(G, 'notice', n => { if (n.team === app.team) notice(n.text, n.kind); });
    RTS.on(G, 'attacked', ({ e }) => { if (e.team !== app.team) return; app.heat = 1; const n = G.tick; if (n - (app.alarmT || -999) > 200) { app.alarmT = n; app.alarmAt = { x: e.x, y: e.y }; notice((RTS.defOf(e).kind === 'building' ? '기지가' : '병력이') + ' 공격받고 있습니다', 'warn'); R.pings.push({ x: e.x, y: e.y, life: 60, max: 60, c: '#ff5a48' }); } });
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
  app.start = function (cfg) { Object.assign(app.cfg, cfg || {}); const f = Object.keys(RTS.defs.factions).filter(x => x !== app.cfg.faction), foe = f[Math.floor(Math.random() * f.length)]; // 상대 AI 진영: 남은 진영 중 무작위 app.demo = false; app.team = 0; app.speed = 1; app.paused = false;
    const G = RTS.createGame({ map: app.cfg.map, seed: Date.now() % 100000, settings: app.settings, players: [{ faction: app.cfg.faction }, { faction: foe, ai: app.cfg.difficulty }] });
    showGame(G); };
  function showGame(G) { hideHover(); bind(G); $('k-chatbtn').hidden = $('k-voicebtn').hidden = !app.net; $('k-chatbox').hidden = true; renderChat(); app.heat = 0; $('k-start').hidden = true; $('k-end').hidden = true; root.querySelector('.k-game').classList.remove('demo'); layout();
    cam.z = view.width < 700 ? .8 : 1; const hq = G.ents.find(e => e.team === app.team && RTS.defOf(e).dropoff); if (hq) { centerOn(hq.x, hq.y); app.sel = [hq.id]; } updateSpeed(); }
  app.toMenu = () => { if (app.net) netClose(true); else if (app.G && !app.demo && !app.G.over) store.set('save', RTS.serialize(app.G)); $('k-again').hidden = false; $('k-end').hidden = true; $('k-start').hidden = false; renderMenu(); demo(); };
  app.saveState = () => (app.G && !app.demo ? RTS.serialize(app.G) : null);
  app.loadState = json => { app.demo = false; app.team = 0; const G = RTS.deserialize(json); showGame(G); };
  // 회사 지분 합계: mates=true면 동료, false면 상대 팀들
  const sharesOf = (G, c, me, mates) => c.shares.reduce((s, n, i) => s + (i !== me && RTS.ally(G, me, i) === mates ? n : 0), 0);
  function finish(o, out) { const G = app.G, a = G.teams[app.team], m = Math.floor(G.tick / 1200), s = Math.floor(G.tick / 20) % 60;
    const win = !out && (G.coop ? o.side === a.side : o.winner === app.team), foes = G.teams.filter(t => !RTS.ally(G, app.team, t.id)), b = foes[0] || G.teams.find(t => t.id !== app.team);
    const cols = [a, ...RTS.allyTeams(G, app.team), ...foes], neu = G.teams.find(t => t.ai && t.boost), neuTxt = neu ? `${neu.name} ${RTS.defs.factions[neu.faction].name} (${RTS.defs.difficulties[neu.ai].name} AI의 ${Math.round(neu.boost * 100)}%)` : '';
    store.del('save'); $('k-endt').textContent = win ? '승리' : '패배';
    $('k-ends').textContent = `${m}분 ${s}초 · ` + (out ? `${G.coop ? '협동' : '셋이 대전'} · 내 건물과 유닛이 모두 없어졌습니다. 게임은 계속 진행되며 관전할 수 있습니다` : G.coop ? `협동 · ${neuTxt}` : neu ? `셋이 대전 · ${neuTxt}` : b.ai ? `${b.name} AI ${RTS.defs.difficulties[b.ai].name}` : `${b.name} (사람)`);
    if (app.net) { $('k-again').hidden = true; app.net.endShown = true; }
    if (out) $('k-tomenu').textContent = '관전 계속'; else $('k-tomenu').textContent = '메뉴로';
    const row = (l, f) => `<tr><th scope="row">${l}</th>${cols.map(t => `<td>${f(t)}</td>`).join('')}</tr>`;
    $('k-stats').innerHTML = `<thead><tr><th></th>${cols.map(t => `<td>${esc(t.name)}</td>`).join('')}</tr></thead>` + row('캔 광석', t => t.stats.ore) + row('캔 에테르', t => t.stats.gas) + row('누적 배당', t => Math.round(t.stats.div || 0)) + row('전쟁 피해액', t => Math.round(t.stats.warLoss || 0)) + row('약탈 획득', t => Math.round(t.stats.loot || 0)) + row('생산한 유닛', t => t.stats.made) + row('파괴한 수', t => t.stats.kills) + row('잃은 수', t => t.stats.lost);
    $('k-end').hidden = false; if (opts.onEnd && !out) opts.onEnd({ win, ticks: G.tick, stats: a.stats, cfg: app.cfg }); }

  // ── 메시지와 HUD ──────────────────────────────────────
  function notice(text, kind) { const box = $('k-msgs'), d = document.createElement('div'); if (box.lastChild && box.lastChild.textContent === text) return; d.textContent = text; d.className = 'k-msg ' + (kind || ''); box.appendChild(d); while (box.children.length > 4) box.firstChild.remove(); setTimeout(() => d.remove(), 3800); if (kind === 'warn') app.sfx('warn'); }
  const cost = c => Object.keys(c || {}).map(k => `<span class="c-${k}">${k === 'ore' ? '광석' : '에테르'} ${c[k]}</span>`).join(' ');
  function selected() { return app.sel.map(i => app.G.byId[i]).filter(e => e && !e.dead); }
  function leader(list) { const own = list.filter(e => e.team === app.team); if (!own.length) return null; return own.slice().sort((a, b) => cardRank(b) - cardRank(a))[0]; }
  const cardRank = e => { const d = RTS.defOf(e); return (d.abilities ? 3 : 0) + (d.gather ? 2 : 0) + (d.kind === 'unit' ? 1 : 0); };

  function cardItems() { const G = app.G, list = selected(), L = leader(list), t = G.teams[app.team], items = [];
    if (list.length === 1 && list[0].tribeHall && G.tribe) { const why = RTS.tribeBlock(G, app.team); items.push({ key: 'N', text: '외교', name: '잿빛 부족 외교', desc: why || '공병(일꾼)을 선택하고 이 회당을 우클릭하면 외교 미션 2개를 받습니다. 2개 성공 동맹, 1개 중립, 0개 적대', ok: !why, why, run: () => notice('공병을 선택하고 회당을 우클릭하세요', 'ok') }); return items; }
    if (list.length === 1 && list[0].branch) { items.push({ key: 'N', text: '상단', name: '자유상단 열기', desc: '동맹과 거래 메뉴를 엽니다', ok: true, run: () => { if (!app.dipOpen) toggleDip(); } }); return items; }
    if (list.length === 1 && list[0].company) { const id = list[0].company, c = G.market.cos[id], tr = (qty, key, text, name) => items.push({ key, text, name, desc: qty > 0 ? `예상 비용 광석 ${Math.ceil(RTS.quote(G, c, Math.min(qty, c.free)).total)}` : `예상 수령 광석 ${Math.floor(RTS.quote(G, c, -Math.min(-qty, c.shares[app.team] || 0)).total)} (수수료 ${RTS.cfg(G).fee}%)`, ok: true, run: () => trade(id, qty) });
      tr(5, 'Q', '+5', '5주 매수'); tr(20, 'W', '+20', '20주 매수'); tr(-5, 'E', '-5', '5주 매도'); tr(-100, 'R', '전량', '보유 주식 전량 매도'); return items; }
    if (!L) return items;
    const d = RTS.defOf(L), f = t.faction, ids = list.filter(e => e.def === L.def).map(e => e.id), allIds = list.filter(e => RTS.defOf(e).kind === 'unit').map(e => e.id);
    const ent = (id, act) => { const u = RTS.defs.entities[id], tech = RTS.techOk(t, u); return { def: id, key: u.key, img: R.icon(id, app.team, f), name: u.name, desc: u.desc, cost: u.cost, sub: u.supply ? '보급 ' + u.supply * (u.count || 1) + (u.count > 1 ? ` · ${u.count}기` : '') : '', ok: tech, why: tech ? '' : '필요: ' + u.requires.map(r => RTS.defs.entities[r]?.name || RTS.defs.upgrades[r]?.name).join(', '), run: act }; };
    if (!RTS.complete(L)) { items.push({ key: 'X', text: '취소', name: '건설 취소', desc: '비용의 75%를 돌려받습니다', ok: true, run: () => send({ type: 'cancel', building: L.id }) }); return items; }
    if (app.menu === 'build' && d.builds) { for (const id of d.builds) items.push(ent(id, () => { app.mode = { type: 'place', def: id }; app.menu = 'main'; })); items.push({ key: 'Escape', label: 'Esc', text: '뒤로', name: '뒤로', ok: true, run: () => { app.menu = 'main'; } }); return items; }
    if (d.kind === 'unit') {
      const tgt = (order, text, key, name, desc) => ({ key, text, name, desc, ok: true, run: () => setMode({ type: 'target', order }) });
      items.push(tgt('amove', '공격', 'A', '공격 이동', '이동하면서 만나는 적을 공격합니다'));
      items.push({ key: 'S', text: '정지', name: '정지', ok: true, run: () => send({ type: 'order', ids: allIds, order: null, stop: true }) });
      items.push({ key: 'H', text: '고수', name: '위치 고수', desc: '자리를 지키며 사거리 안만 공격합니다', ok: true, run: () => send({ type: 'order', ids: allIds, order: { type: 'hold' } }) });
      items.push(tgt('patrol', '순찰', 'P', '순찰', '현재 위치와 지정 지점을 왕복합니다'));
      for (const id of d.abilities || []) { const ab = RTS.defs.abilities[id], unlocked = !ab.requires || t.upgrades[ab.requires], cd = Math.max(0, ((L.cds[id] || 0) - G.tick) / 20);
        items.push({ key: ab.key, text: ab.short || ab.name.slice(0, 2), name: ab.name + (ab.id === 'siege' && L.sieged ? ' 해제' : ''), desc: ab.desc, ok: !!unlocked, cool: cd > 0 ? Math.ceil(cd) : 0, why: unlocked ? '' : '연구 필요: ' + RTS.defs.upgrades[ab.requires].name, run: () => ab.target === 'point' ? setMode({ type: 'target', ability: id, radius: 2.5 }) : send({ type: 'ability', ids, ability: id }) }); }
      if (d.builds) items.push({ key: 'B', text: '건설', name: '건설', desc: '건물을 고릅니다', ok: true, run: () => { app.menu = 'build'; } });
    } else {
      for (const id of d.trains || []) items.push(ent(id, () => { const q = ids.map(i => G.byId[i]).sort((a, b) => a.prod.length - b.prod.length)[0]; send({ type: 'train', building: q.id, unit: id }); }));
      for (const id of d.researches || []) { const u = RTS.defs.upgrades[id]; if (t.upgrades[id] || t.research[id]) continue; const tech = RTS.techOk(t, u); items.push({ up: id, key: u.key, text: u.short || u.name.slice(0, 2), name: u.name, desc: u.desc, cost: u.cost, ok: tech, why: tech ? '' : '필요: ' + u.requires.map(r => RTS.defs.entities[r]?.name).join(', '), run: () => send({ type: 'research', building: L.id, upgrade: id }) }); }
      if (L.prod.length) items.push({ key: 'X', text: '취소', name: '마지막 대기 취소', desc: '비용을 돌려받습니다', ok: true, run: () => send({ type: 'cancel', building: L.id }) });
    }
    return items; }
  function setMode(m) { app.mode = m; }
  function trade(company, qty) { send({ type: 'trade', company, qty }); app.sfx('click'); app.cardSig = ''; }
  // ── 거래소 패널: 행은 한 번 만들고 값만 갱신해 클릭이 끊기지 않게 한다 ──
  function buildExchange() { const G = app.G, el = $('k-ex'); el.innerHTML = `<div class="x-head"><h2>거래소</h2><span id="x-next"></span><button id="x-close" aria-label="거래소 닫기">닫기</button></div><div class="x-sum"><span>평가액 <b id="x-value">0</b></span><span>누적 배당 <b id="x-div">0</b></span><span>신용 <b id="x-credit">100%</b></span></div><div id="x-rows"></div><div class="x-war" id="x-war"></div><div class="x-news" id="x-news"></div>`;
    const rows = $('x-rows'); app.exRows = {};
    for (const c of Object.values(G.market.cos)) { const d = RTS.defs.companies[c.id], r = document.createElement('div'); r.className = 'x-row ' + d.resource;
      r.innerHTML = `<div class="x-top"><button class="x-name" title="거점으로 이동"><b>${d.name}</b><small>${d.blurb}</small></button><svg viewBox="0 0 90 28" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg><div class="x-price"><b></b><small></small></div></div><div class="x-stake" title="51주 이상이면 경영권"><i class="me"></i><i class="foe"></i><s></s></div><div class="x-meta"><span class="x-own"></span><span class="x-pay"></span></div><div class="x-btn"><button data-q="5">+5</button><button data-q="20">+20</button><button data-q="-5">-5</button><button data-q="-100">전량 매도</button></div>`;
      r.querySelectorAll('.x-btn button').forEach(b => { b.onclick = () => { unlock(); trade(c.id, +b.dataset.q); updateExchange(); }; });
      r.querySelector('.x-name').onclick = () => { const e = G.byId[c.site]; if (e) { centerOn(e.x, e.y); app.sel = [e.id]; } };
      rows.appendChild(r); app.exRows[c.id] = r; }
    $('x-close').onclick = toggleExchange; }
  function updateExchange() { const G = app.G; if (!app.exRows) buildExchange(); const t = G.teams[app.team]; let value = 0;
    for (const c of Object.values(G.market.cos)) { const r = app.exRows[c.id], mine = c.shares[app.team], theirs = sharesOf(G, c, app.team, false), h = c.hist, ref = h[Math.max(0, h.length - 13)], ch = (c.price / ref - 1) * 100, e = G.byId[c.site], down = e && e.downUntil > G.tick, min = Math.min(...h, c.price), max = Math.max(...h, c.price), span = Math.max(.01, max - min); value += mine * c.price;
      const pts = [...h, c.price].map((v, i, a) => `${(i / Math.max(1, a.length - 1) * 90).toFixed(1)},${(26 - (v - min) / span * 24).toFixed(1)}`).join(' '), line = r.querySelector('polyline'); line.setAttribute('points', pts); line.setAttribute('stroke', ch >= 0 ? '#ff6a5a' : '#5aa8ff');
      r.querySelector('.x-price b').textContent = c.price.toFixed(1); const sm = r.querySelector('.x-price small'); sm.textContent = (ch >= 0 ? '+' : '') + ch.toFixed(1) + '%'; sm.className = ch >= 0 ? 'up' : 'dn';
      r.querySelector('.x-stake s').style.left = RTS.cfg(G).control + '%'; r.querySelector('.me').style.background = RTS.TEAM[app.team].main; r.querySelector('.foe').style.background = RTS.TEAM[foe.id].main; r.querySelector('.me').style.width = mine + '%'; r.querySelector('.foe').style.width = theirs + '%';
      const k = c.owner < 0 ? 1 : c.owner === app.team ? RTS.cfg(G).ctrlBonus / 100 : RTS.cfg(G).minority / 100, unit = RTS.defs.companies[c.id].resource === 'ore' ? '광석' : '에테르';
      r.querySelector('.x-own').textContent = `내 ${mine}주 · ${G.coop ? `동료 ${sharesOf(G, c, app.team, true)}주 · ` : ''}상대 ${theirs}주 · 시장 ${c.free}주` + (c.owner === app.team ? ' · 내 경영권' : c.owner >= 0 ? (RTS.ally(G, app.team, c.owner) ? ' · 동료 경영권' : ' · 상대 경영권') : '');
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
          const ap = r.querySelector('.d-apply'); if (ap) ap.onclick = () => { unlock(); send({ type: 'ally', branch: b.id, stake: +sl.value }); app.sfx('click'); };
          const fu = r.querySelector('.d-fund'); if (fu) fu.onclick = () => send({ type: 'fund', branch: b.id, amount: 100 });
          const bu = r.querySelector('.d-buy'), se = r.querySelector('.d-sell'); if (bu) { bu.onclick = () => send({ type: 'barter', branch: b.id, buy: true }); se.onclick = () => send({ type: 'barter', branch: b.id, buy: false }); } }
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
  function useItem(it) { if (!it.ok) { notice(it.why || '아직 사용할 수 없습니다', 'warn'); return; } app.sfx('click'); it.run(); app.cardSig = ''; renderCard(); $('k-tip').hidden = true; }
  function tip(b, it) { const T = $('k-tip'), r = b.getBoundingClientRect(), rr = root.getBoundingClientRect(); if (it.def || it.up) { T.innerHTML = tipHTML(it.up ? { up: it.up } : { def: it.def, how: true }); T.hidden = false; T.style.right = Math.max(8, rr.right - r.right) + 'px'; T.style.bottom = (rr.bottom - r.top + 8) + 'px'; return; } T.innerHTML = `<b>${it.name}</b>${it.cost ? `<p>${cost(it.cost)} ${it.sub || ''}</p>` : ''}${it.desc ? `<p>${it.desc}</p>` : ''}${it.why ? `<p class="why">${it.why}</p>` : ''}`; T.hidden = false; T.style.right = Math.max(8, rr.right - r.right) + 'px'; T.style.bottom = (rr.bottom - r.top + 8) + 'px'; }
  function renderInfo() { const G = app.G, el = $('k-info'), list = selected(); app.sel = list.map(e => e.id);
    let h = ''; if (!list.length) { const sig0 = 'none'; if (app.infoSig !== sig0) { el.innerHTML = '<p class="k-empty">유닛이나 건물을 선택하세요.</p>'; app.infoSig = sig0; } return; }
    const e = list[0], d = RTS.defOf(e), f = e.team >= 0 ? G.teams[e.team].faction : 'pioneers';
    if (list.length === 1 && e.tribeHall && G.tribe) { const T = G.tribe, r = T.rel[app.team]; h = `<div class="k-one"><img src="${R.icon(e.def, RTS.TRIBE, f)}" alt=""><div><h3>잿빛 부족 회당</h3><p class="k-hp">${Math.ceil(e.hp)} / ${d.hp}</p><p class="k-st">${RTS.tribeRelName(r)} · ${r === 'ally' ? '공격받으면 확률로 지원군을 보냅니다' : r === 'hostile' ? '주기적으로 습격해 옵니다' : '공병으로 우클릭해 외교'}</p></div></div>`;
    } else if (list.length === 1 && e.branch) { const b = G.dip.list[e.branch], d2 = RTS.defs.branches[e.branch]; h = `<div class="k-one"><img src="${R.icon(e.def, -1, f)}" alt=""><div><h3>${d2.name}</h3><p class="k-st">${b.ally < 0 ? '중립 지부' : b.ally === app.team ? '내 동맹' : RTS.ally(G, app.team, b.ally) ? '동료 동맹' : '상대 동맹'} · ${d2.perkText}</p></div></div>`;
    } else if (list.length === 1 && e.company) { const c = G.market.cos[e.company], co = RTS.defs.companies[e.company], hp = d.hp, dn = e.downUntil > G.tick;
      h = `<div class="k-one"><img src="${R.icon(e.def, -1, f)}" alt=""><div><h3>${co.name}</h3><p class="k-hp">${Math.ceil(e.hp)} / ${hp}${dn ? ' · 가동 중단' : ''}</p><p class="k-st">주가 ${c.price.toFixed(1)} · 내 지분 ${c.shares[app.team]}주 · ${c.owner < 0 ? '경영권 없음' : c.owner === app.team ? '내 경영권' : RTS.ally(G, app.team, c.owner) ? '동료 경영권' : '상대 경영권'}</p></div></div>`;
    } else if (list.length === 1) { const max = e.team >= 0 || e.team === RTS.TRIBE ? RTS.stat(G, e, 'hp') : 0, w = RTS.weapon(e), stats = [];
      if (d.resource) stats.push(`남은 양 ${e.amount}`);
      if (w) stats.push(`공격 ${Math.round(RTS.wStat(G, e, w, 'damage'))}`, `사거리 ${+RTS.wStat(G, e, w, 'range').toFixed(1)}`);
      if (e.team >= 0) stats.push(`방어 ${Math.round(RTS.stat(G, e, 'armor'))}`); if (e.cargo) stats.push(`운반 ${e.cargo}`);
      let prod = ''; if (e.prod && e.prod.length) { const p = e.prod[0], u = p.kind === 'unit' ? RTS.defs.entities[p.id] : RTS.defs.upgrades[p.id]; prod = `<div class="k-prod"><span>${u.name}${!p.started ? ' · 보급 부족' : ''}</span><i><s style="width:${Math.round(p.t / p.total * 100)}%"></s></i><span>대기 ${e.prod.length}/5</span></div>`; }
      else if (e.built !== undefined && !RTS.complete(e)) prod = `<div class="k-prod"><span>건설 중</span><i><s style="width:${Math.round(e.built / e.buildT * 100)}%"></s></i></div>`;
      h = `<div class="k-one">${d.resource ? '' : `<img src="${R.icon(e.def, e.team, f)}" alt="">`}<div><h3>${d.name}</h3>${max ? `<p class="k-hp">${Math.ceil(e.hp)} / ${Math.round(max)}</p>` : ''}<p class="k-st">${stats.join(' · ')}</p>${prod}</div></div>`;
    } else { const sum = {}; h = '<div class="k-many">' + list.slice(0, 32).map(u => { const k = Math.max(0, u.hp / RTS.stat(G, u, 'hp')); return `<button data-id="${u.id}" title="${RTS.defOf(u).name}"><img src="${R.icon(u.def, u.team, f)}" alt=""><i style="width:${Math.round(k * 100)}%;background:${k > .55 ? 'var(--ok)' : k > .28 ? 'var(--warn)' : 'var(--bad)'}"></i></button>`; }).join('') + '</div>'; }
    if (h !== app.infoSig) { el.innerHTML = h; app.infoSig = h; el.querySelectorAll('.k-many button').forEach(b => { b.onclick = () => { app.sel = [+b.dataset.id]; }; }); } }
  function renderHud() { const G = app.G, t = G.teams[app.team]; if (!t) return; if (app.exOpen) updateExchange(); if (app.dipOpen) updateDip();
    $('k-ore').textContent = Math.floor(t.res.ore); $('k-gas').textContent = Math.floor(t.res.gas); $('k-sup').textContent = Math.ceil(t.sup) + '/' + t.cap; $('k-sup').parentNode.classList.toggle('full', t.sup >= t.cap);
    const s = Math.floor(G.tick / 20); $('k-clock').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    const idle = G.ents.filter(e => e.team === app.team && RTS.defOf(e).gather && !e.order); $('k-idlen').textContent = idle.length; app.idle = idle;
    renderTribe(); renderInfo(); renderCard(); if (htip.shown) { const x = app.G.byId[htip.id]; if (!x || x.dead || !canSee(x)) hideHover(); else { const h = tipHTML({ ent: x }); if (h !== htip.sig) { htip.sig = h; $('k-htip').innerHTML = h; } } } const m = app.mode, mb = $('k-modebar');
    if (m) { mb.hidden = false; const txt = m.type === 'place' ? RTS.defs.entities[m.def].name + ' 건설 위치를 고르세요' : m.ability ? RTS.defs.abilities[m.ability].name + ' 지점을 고르세요' : m.order === 'amove' ? '공격 이동 지점을 고르세요' : '순찰 지점을 고르세요'; if (mb.textContent !== txt + ' · Esc 취소') mb.textContent = txt + ' · Esc 취소'; } else mb.hidden = true; }
  // 잿빛 부족 상태와 외교 미션 진행도. 부족을 발견한 뒤에만 보인다
  function renderTribe() { const G = app.G, T = G.tribe, el = $('k-tribe'), me = app.team; if (!T || me < 0 || !T.found[me]) { if (!el.hidden) { el.hidden = true; app.tribeSig = ''; } return; }
    const r = T.dead ? 'gone' : T.rel[me], L = T.missions[me], wait = T.wait[me] > G.tick ? Math.ceil((T.wait[me] - G.tick) / 20) : 0;
    let h = `<div class="tr-top"><b>잿빛 부족</b><em class="tr-${r}">${T.dead ? '회당 무너짐' : RTS.tribeRelName(r)}</em><button type="button" class="tr-go" aria-label="회당 보기">보기</button></div>`;
    if (L) h += L.map(m => { const d = RTS.defs.tribeMissions[m.id], [cur, need] = RTS.missionProg(G, me, m), left = Math.max(0, Math.ceil((m.until - G.tick) / 20)), st = m.done === true ? '성공' : m.done === false ? '실패' : left + '초';
      return `<div class="tr-m ${m.done === true ? 'ok' : m.done === false ? 'bad' : ''}"><div class="tr-h"><span>${d.name}</span><span>${st}</span></div><p>${d.text}</p><i><s style="width:${Math.round(cur / need * 100)}%"></s></i><small>${Math.floor(cur)} / ${need}${d.unit || ''}</small>${m.id === 'scout' && m.done === null ? `<button type="button" class="tr-pt" data-x="${m.x}" data-y="${m.y}">지점 보기</button>` : ''}</div>`; }).join('');
    else if (!T.dead && r === 'neutral') h += `<p class="tr-n">${wait ? `다시 외교까지 ${wait}초` : (RTS.tribeBlock(G, me) || '공병을 선택하고 회당을 우클릭하면 미션 2개를 받습니다. 2개 성공 동맹 · 1개 중립 · 0개 적대')}</p>`;
    else if (r === 'ally') h += `<p class="tr-n">공격받으면 ${Math.round(RTS.TRIBE_RULES.helpChance * 100)}% 확률로 지원군을 보냅니다</p>`;
    else if (r === 'hostile') h += `<p class="tr-n">주기적으로 습격해 옵니다. 회당을 무너뜨리면 광석 +${RTS.TRIBE_RULES.loot}</p>`;
    if (h === app.tribeSig) return; app.tribeSig = h; el.innerHTML = h; el.hidden = false;
    el.querySelector('.tr-go').onclick = () => { const e = G.byId[T.hall]; if (e) { centerOn(e.x, e.y); app.sel = [e.id]; } };
    el.querySelectorAll('.tr-pt').forEach(b => { b.onclick = () => centerOn(+b.dataset.x, +b.dataset.y); }); }
  function renderMini() { const G = app.G, c = mini.getContext('2d'), W = mini.width, H = mini.height, sc = Math.min(W / G.w, H / G.h), ox = (W - G.w * sc) / 2, oy = (H - G.h * sc) / 2; app.miniT = { sc, ox, oy };
    c.fillStyle = '#0a0f18'; c.fillRect(0, 0, W, H); const b = R.terrain(); if (b) c.drawImage(b, ox, oy, G.w * sc, G.h * sc);
    const t = G.teams[app.team], fogged = t && !G.nofog;
    for (const e of G.ents) { const d = RTS.defOf(e), x = ox + e.x * sc, y = oy + e.y * sc; if ((e.branch || e.team === RTS.TRIBE) && !RTS.branchKnown(G, app.team, e)) continue;
      if (fogged && !d.site && e.team !== app.team && !(e.team < 0 ? t.seen[(e.y | 0) * G.w + (e.x | 0)] : RTS.visibleTo(G, app.team, e.x, e.y))) continue;
      c.fillStyle = e.team === RTS.TRIBE ? RTS.TEAM[RTS.TRIBE].main : d.site && e.team < 0 ? '#eef2f7' : e.team < 0 ? (d.resource === 'ore' ? '#ffc247' : '#ea7be0') : RTS.TEAM[e.team].main; const s = d.site || e.tribeHall ? 5 : d.size && e.team !== -1 ? 4 : 2.4; c.fillRect(x - s / 2, y - s / 2, s, s); }
    const TM = G.tribe && G.tribe.missions[app.team]; if (TM) for (const q of TM) if (q.id === 'scout' && q.done === null) { c.strokeStyle = '#9dffb5'; c.lineWidth = 1.5; c.beginPath(); c.arc(ox + q.x * sc, oy + q.y * sc, 5 * sc + 2, 0, Math.PI * 2); c.stroke(); }
    if (fogged) { c.fillStyle = 'rgba(8,12,22,.72)'; const step = 2; for (let y = 0; y < G.h; y += step) for (let x = 0; x < G.w; x += step) { if (!t.vis[y * G.w + x]) { c.globalAlpha = t.seen[y * G.w + x] ? .45 : 1; c.fillRect(ox + x * sc, oy + y * sc, sc * step + .6, sc * step + .6); } } c.globalAlpha = 1;
      for (const id of Object.keys(R.ghosts)) { const g = R.ghosts[id]; c.fillStyle = RTS.TEAM[g.team].main; c.fillRect(ox + g.x * sc - 2, oy + g.y * sc - 2, 4, 4); } }
    c.strokeStyle = '#fff'; c.lineWidth = 1; c.strokeRect(ox + cam.x / TS * sc, oy + cam.y / TS * sc, view.width / cam.z / TS * sc, view.height / cam.z / TS * sc); }

  // ── 입력 ──────────────────────────────────────────────
  const toWorld = (sx, sy) => [(sx / cam.z + cam.x) / TS, (sy / cam.z + cam.y) / TS];
  function setMouse(e) { const r = view.getBoundingClientRect(), k = view.width / r.width; app.mouse.x = (e.clientX - r.left) * k; app.mouse.y = (e.clientY - r.top) * k; [app.mouse.wx, app.mouse.wy] = toWorld(app.mouse.x, app.mouse.y); }
  app.placeTile = id => { const d = RTS.defs.entities[id]; return [Math.round(app.mouse.wx - d.size[0] / 2), Math.round(app.mouse.wy - d.size[1] / 2)]; };
  const canSee = e => e.team === app.team || (e.team < 0 ? RTS.branchKnown(app.G, app.team, e) : RTS.visibleTo(app.G, app.team, e.x, e.y));
  function pick(wx, wy) { const G = app.G; let best = null, bd = 1e9;
    for (const e of G.ents) { if (e.dead || e.ext || !canSee(e)) continue; const d = RTS.defOf(e); // 추출기가 선 분출구는 건너뛴다
      if (d.size) { const r = RTS.rectOf(e); if (wx >= r.x0 && wx <= r.x0 + r.w && wy >= r.y0 && wy <= r.y0 + r.h && bd > 1) { bd = 1; best = e; } }
      else { const y = d.air ? wy + .6 : wy, q = Math.hypot(e.x - wx, e.y - y); if (q < d.r + .28 && q < bd) { bd = q; best = e; } } }
    return best; }
  function selectBox(b, add) { const G = app.G, [x0, y0] = toWorld(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1)), [x1, y1] = toWorld(Math.max(b.x0, b.x1), Math.max(b.y0, b.y1));
    const inBox = G.ents.filter(e => e.team === app.team && !e.dead && RTS.defOf(e).kind === 'unit' && !RTS.defOf(e).uncontrollable && e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1); const army = inBox.filter(e => !RTS.defOf(e).gather), chosen = army.length ? army : inBox;
    if (!chosen.length && !add) return; app.sel = add ? [...new Set([...app.sel, ...chosen.map(e => e.id)])] : chosen.map(e => e.id); app.menu = 'main'; app.mode = null; }
  function spread(ids, x, y) { const n = ids.length, cols = Math.ceil(Math.sqrt(n)), out = {}; const s = .95; ids.forEach((id, i) => { const row = (i / cols) | 0, col = i % cols; out[id] = { x: x + (col - (cols - 1) / 2) * s, y: y + (row - (cols - 1) / 2) * s }; }); return out; }
  function context(wx, wy, queue) { const G = app.G, list = selected().filter(e => e.team === app.team); if (!list.length) return false;
    const units = list.filter(e => RTS.defOf(e).kind === 'unit'), blds = list.filter(e => RTS.defOf(e).kind === 'building'), t = pick(wx, wy), ids = units.map(e => e.id); let color = '#7dffa8';
    if (blds.length && !units.length) { const res = t && (RTS.defOf(t).resource === 'ore' || (t.team === app.team && RTS.defOf(t).placeOn)); send({ type: 'rally', ids: blds.map(e => e.id), x: wx, y: wy, ent: res ? t.id : 0 }); R.pings.push({ x: wx, y: wy, life: 20, max: 20, c: color }); return true; }
    if (!units.length) return false;
    if (t && t.team === RTS.TRIBE && G.tribe) { const T = G.tribe, workers = units.filter(e => RTS.defOf(e).gather);
      if (t.tribeHall && workers.length && !RTS.foe(G, app.team, RTS.TRIBE) && T.rel[app.team] !== 'ally') { // 공병 → 회당: 외교 미션 받기
        const why = RTS.tribeBlock(G, app.team); if (why) { notice(why, 'warn'); return true; }
        const w = workers.slice().sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
        send({ type: 'order', ids: [w.id], order: { type: 'envoy', target: t.id }, queue }); notice('공병이 회당으로 외교하러 갑니다', 'ok'); R.pings.push({ x: t.x, y: t.y, life: 24, max: 24, c: '#9dffb5' }); return true; }
      if (!RTS.foe(G, app.team, RTS.TRIBE)) { // 중립·동맹 부족은 한 번 더 눌러야 공격한다
        const arm = app.tribeArm; if (!arm || arm.id !== t.id || performance.now() - arm.at > 3000) { app.tribeArm = { id: t.id, at: performance.now() }; notice(T.rel[app.team] === 'ally' ? '동맹 부족입니다. 한 번 더 누르면 공격하고 동맹이 깨집니다' : '한 번 더 누르면 부족을 공격합니다. 공격하면 적대 관계가 됩니다', 'warn'); return true; }
        app.tribeArm = null; }
      send({ type: 'order', ids, order: { type: 'attack', target: t.id }, queue }); R.pings.push({ x: t.x, y: t.y, life: 20, max: 20, c: '#ff5a48' }); return true; }
    if (t && t.team !== app.team && (t.team >= 0 || t.company) && !RTS.ally(G, app.team, t.team)) { send({ type: 'order', ids, order: { type: 'attack', target: t.id }, queue }); R.pings.push({ x: t.x, y: t.y, life: 20, max: 20, c: '#ff5a48' }); return true; }
    const workers = units.filter(e => RTS.defOf(e).gather).map(e => e.id), rest = ids.filter(i => !workers.includes(i));
    const gas = t && t.team === app.team && RTS.defOf(t).placeOn && RTS.complete(t), ore = t && RTS.defOf(t).resource === 'ore';
    if (t && (gas || ore) && workers.length) { send({ type: 'order', ids: workers, order: { type: 'gather', node: t.id }, queue }); if (rest.length) send({ type: 'order', ids: rest, order: { type: 'move', x: wx, y: wy }, spread: spread(rest, wx, wy), queue }); R.pings.push({ x: t.x, y: t.y, life: 20, max: 20, c: '#ffc247' }); return true; }
    if (t && t.team === app.team && !RTS.complete(t) && workers.length) { send({ type: 'order', ids: workers, order: { type: 'build', site: t.id }, queue }); return true; }
    send({ type: 'order', ids, order: { type: 'move', x: wx, y: wy }, spread: spread(ids, wx, wy), queue }); R.pings.push({ x: wx, y: wy, life: 20, max: 20, c: color }); return true; }
  function execMode(wx, wy, shift) { const G = app.G, m = app.mode, ids = selected().filter(e => e.team === app.team && RTS.defOf(e).kind === 'unit').map(e => e.id);
    if (m.type === 'place') { const [tx, ty] = app.placeTile(m.def), w = selected().filter(e => RTS.defOf(e).gather).sort((a, b) => (a.order && a.order.type === 'build' ? 1 : 0) - (b.order && b.order.type === 'build' ? 1 : 0)); send({ type: 'place', ids: w.map(e => e.id), def: m.def, tx, ty, queue: shift }); if (!shift) app.mode = null; return; }
    if (m.ability) send({ type: 'ability', ids, ability: m.ability, x: wx, y: wy, one: true });
    else send({ type: 'order', ids, order: { type: m.order, x: wx, y: wy }, spread: spread(ids, wx, wy), queue: shift });
    R.pings.push({ x: wx, y: wy, life: 20, max: 20, c: '#ff5a48' }); if (!shift) app.mode = null; }

  // ── 풍선 도움말: 유닛·건물·연구의 이름, 능력치, 비용, 필요 조건, 만드는 방법 ──
  const RES_NAME = { ore: '광석', gas: '에테르' };
  const nameOf = id => RTS.defs.entities[id]?.name || RTS.defs.upgrades[id]?.name || id;
  const sec = n => (n % 1 ? n.toFixed(1) : n) + '초';
  // 이 유닛·건물·연구를 어디서 어떻게 만드는지: 만드는 쪽 정의와 단축키 경로
  function howTo(id) { const D = RTS.defs.entities, out = [];
    for (const b of Object.values(D)) {
      if ((b.trains || []).includes(id)) out.push(`${b.name} 선택 → ${D[id].key ? D[id].key + ' 키' : '버튼'}`);
      if ((b.builds || []).includes(id)) out.push(`${b.name} 선택 → B(건설) → ${D[id].key || ''}`);
      if ((b.researches || []).includes(id)) out.push(`${b.name} 선택 → ${RTS.defs.upgrades[id].key} 키`); }
    return out; }
  function needList(d, t) { return (d.requires || []).map(r => { const ok = t && (t.have[r] > 0 || t.upgrades[r]); return `<span class="${t ? (ok ? 'ok' : 'no') : ''}">${t ? (ok ? '✓ ' : '✗ ') : ''}${nameOf(r)}</span>`; }).join(' · '); }
  const costTxt = c => Object.keys(c || {}).map(k => `<span class="c-${k}">${RES_NAME[k]} ${c[k]}</span>`).join(' ');
  function tipHTML(src) { const G = app.G, me = app.team, t = G && G.teams[me], D = RTS.defs.entities; let h = '', e = null, d, id;
    const row = (k, v) => v === '' || v == null ? '' : `<tr><th>${k}</th><td>${v}</td></tr>`;
    if (src.up) { const u = RTS.defs.upgrades[src.up], done = t && t.upgrades[src.up], doing = t && t.research[src.up];
      h += `<b>${u.name}</b><small class="t-kind">연구${done ? ' · 완료' : doing ? ' · 진행 중' : ''}</small><p>${u.desc || ''}</p><table>`
        + row('비용', costTxt(u.cost)) + row('시간', u.time ? sec(u.time) : '') + row('필요', needList(u, t)) + row('방법', howTo(src.up).join('<br>')) + '</table>';
      return h; }
    if (src.ent) { e = src.ent; id = e.def; d = D[id]; } else { id = src.def; d = D[id]; }
    const own = e ? (e.team === me ? '내 것' : e.team === RTS.TRIBE && G.tribe ? '잿빛 부족 · ' + RTS.tribeRelName(G.tribe.rel[me] || 'neutral') : e.team < 0 ? '중립' : RTS.ally(G, me, e.team) ? '동료' : '상대') : '';
    if (e && e.branch) { const b = G.dip.list[e.branch], bd = RTS.defs.branches[e.branch];
      return `<b>${bd.name}</b><small class="t-kind">자유상단 지부 · ${b.ally < 0 ? '중립' : b.ally === me ? '내 동맹' : RTS.ally(G, me, b.ally) ? '동료 동맹' : '상대 동맹'}</small><table>${row('혜택', bd.perkText)}${row('동맹 조건', bd.need)}${row('체력', Math.ceil(e.hp) + ' / ' + d.hp)}</table><p>N 키로 자유상단을 열어 거래하거나 동맹을 신청합니다.</p>`; }
    if (e && e.company) { const c = G.market.cos[e.company], co = RTS.defs.companies[e.company];
      return `<b>${co.name}</b><small class="t-kind">회사 거점 · ${RES_NAME[co.resource]}</small><p>${co.blurb}</p><table>${row('주가', c.price.toFixed(1))}${row('지분', `나 ${c.shares[me] || 0} · ${G.coop ? `동료 ${sharesOf(G, c, me, true)} · ` : ''}상대 ${sharesOf(G, c, me, false)} · 시장 ${c.free}`)}${row('경영권', c.owner < 0 ? '없음' : c.owner === me ? '나' : RTS.ally(G, me, c.owner) ? '동료' : '상대')}${row('체력', Math.ceil(e.hp) + ' / ' + d.hp + (e.downUntil > G.tick ? ' · 가동 중단' : ''))}</table><p>M 키 거래소에서 사고팝니다. ${RTS.cfg(G).control}주 이상이면 경영권을 얻습니다. 공격하면 주가가 내립니다.</p>`; }
    if (d.kind === 'resource') return `<b>${d.name}</b><small class="t-kind">자원</small><p>${d.desc || ''}</p><table>${row('남은 양', e ? e.amount : d.amount)}</table>`;
    const isUnit = d.kind === 'unit', mineE = !e || e.team === me;
    h += `<b>${d.name}</b><small class="t-kind">${isUnit ? '유닛' : '건물'}${own ? ' · ' + own : ''}${e && !isUnit && !RTS.complete(e) ? ' · 건설 중' : ''}</small>`;
    if (d.desc) h += `<p>${d.desc}</p>`;
    h += '<table>';
    if (e && e.team >= 0) h += row('체력', `${Math.ceil(e.hp)} / ${Math.round(RTS.stat(G, e, 'hp'))}`); else if (d.hp) h += row('체력', d.hp);
    const w = e ? RTS.weapon(e) : d.weapon, st = (n, base) => e && e.team >= 0 ? RTS.wStat(G, e, w, n) : base;
    if (w) h += row('공격', `${Math.round(st('damage', w.damage))} · 사거리 ${+st('range', w.range).toFixed(1)} · ${w.air === false ? '지상만' : '지상·공중'}${w.splash ? ' · 범위' : ''}`);
    if (d.siegeWeapon && !(e && e.sieged)) h += row('포격 모드', `공격 ${d.siegeWeapon.damage} · 사거리 ${d.siegeWeapon.range} · 범위`);
    const arm = e && e.team >= 0 ? RTS.stat(G, e, 'armor') : d.armor || 0; if (arm) h += row('방어', Math.round(arm));
    if (d.heal) h += row('치료', `${d.heal.amount} · 사거리 ${d.heal.range} · ${d.heal.tag === 'bio' ? '보병' : '기계'}`);
    if (isUnit && d.speed) h += row('속도', +(e && e.team >= 0 ? RTS.stat(G, e, 'speed') : d.speed).toFixed(1));
    if (d.provides) h += row('보급 제공', '+' + d.provides);
    if (mineE) { h += row('비용', costTxt(d.cost) + (d.supply ? ` · 보급 ${d.supply * (d.count || 1)}` + (d.count > 1 ? ` (한 번에 ${d.count}기)` : '') : '')) + row(isUnit ? '생산 시간' : '건설 시간', d.time ? sec(d.time) : '') + row('필요', needList(d, t));
      if (!e || !isUnit || src.how) h += row('만드는 법', howTo(id).join('<br>')); }
    h += '</table>';
    if (mineE && d.trains && d.trains.length) h += `<p class="t-h">생산</p><ul>` + d.trains.map(u => { const x = D[u], ok = !t || RTS.techOk(t, x); return `<li class="${ok ? '' : 'no'}"><kbd>${x.key}</kbd>${x.name} ${costTxt(x.cost)}${ok ? '' : ` <em>필요: ${(x.requires || []).map(nameOf).join(', ')}</em>`}</li>`; }).join('') + '</ul>';
    if (mineE && d.builds && d.builds.length && e) h += `<p class="t-h">건설 (B)</p><ul>` + d.builds.map(u => { const x = D[u], ok = !t || RTS.techOk(t, x); return `<li class="${ok ? '' : 'no'}"><kbd>${x.key}</kbd>${x.name} ${costTxt(x.cost)}${ok ? '' : ` <em>필요: ${(x.requires || []).map(nameOf).join(', ')}</em>`}</li>`; }).join('') + '</ul>';
    if (mineE && d.researches && d.researches.length) h += `<p class="t-h">연구</p><ul>` + d.researches.map(u => { const x = RTS.defs.upgrades[u], done = t && t.upgrades[u], doing = t && t.research[u], ok = !t || RTS.techOk(t, x); return `<li class="${done ? 'done' : ok ? '' : 'no'}"><kbd>${x.key}</kbd>${x.name} — ${x.desc}${done ? ' <em>완료</em>' : doing ? ' <em>진행 중</em>' : ' ' + costTxt(x.cost)}${!done && !ok ? ` <em>필요: ${x.requires.map(nameOf).join(', ')}</em>` : ''}</li>`; }).join('') + '</ul>';
    if (d.abilities && d.abilities.length) h += `<p class="t-h">능력</p><ul>` + d.abilities.map(a => { const ab = RTS.defs.abilities[a], ok = !ab.requires || (t && t.upgrades[ab.requires]); return `<li class="${ok ? '' : 'no'}"><kbd>${ab.key}</kbd>${ab.name} — ${ab.desc}${ok ? '' : ` <em>연구 필요: ${nameOf(ab.requires)}</em>`}</li>`; }).join('') + '</ul>';
    return h; }
  // 화면 위 풍선: 마우스는 0.35초 멈추면, 터치는 0.5초 길게 누르면 뜬다
  const htip = { id: 0, at: 0, el: null, shown: false, timer: 0, long: false };
  function hideHover() { clearTimeout(htip.timer); htip.timer = 0; htip.id = 0; if (htip.shown) { $('k-htip').hidden = true; htip.shown = false; } }
  function showHover(e, sx, sy) { const T = $('k-htip'), r = view.getBoundingClientRect(), k = r.width / view.width, sr = $('k-stage').getBoundingClientRect(), rr = root.getBoundingClientRect();
    T.innerHTML = tipHTML({ ent: e }); T.hidden = false; htip.shown = true; htip.id = e.id; htip.sig = '';
    const px = sx * k + r.left - rr.left, py = sy * k + r.top - rr.top, W = T.offsetWidth, H = T.offsetHeight, maxX = sr.right - rr.left - 6, maxY = sr.bottom - rr.top - 6;
    let x = px + 18, y = py + 18; if (x + W > maxX) x = px - W - 14; if (y + H > maxY) y = py - H - 14; T.style.left = Math.max(6, x) + 'px'; T.style.top = Math.max(sr.top - rr.top + 6, y) + 'px'; }
  function hoverAt(sx, sy, delay) { if (!app.G || app.demo) return; const [wx, wy] = toWorld(sx, sy), e = pick(wx, wy);
    if (!e) { hideHover(); return; } if (htip.shown && htip.id === e.id) { showHover(e, sx, sy); return; }
    if (htip.shown) hideHover(); clearTimeout(htip.timer); htip.pend = e.id; htip.timer = setTimeout(() => { const x = app.G.byId[htip.pend]; if (x && !x.dead && canSee(x)) showHover(x, sx, sy); }, delay); }
  const drag = {};
  view.addEventListener('contextmenu', e => e.preventDefault());
  view.addEventListener('pointerenter', e => { setMouse(e); app.mouse.inside = true; }); // 위치를 먼저 잡아야 (0,0)으로 남은 좌표 때문에 가장자리 스크롤이 일어나지 않는다
  view.addEventListener('pointerleave', () => { app.mouse.inside = false; hideHover(); });
  view.addEventListener('pointerdown', e => { unlock(); view.focus({ preventScroll: true }); setMouse(e); if (app.demo || app.G.over) return; view.setPointerCapture(e.pointerId); const touch = e.pointerType === 'touch', wx = app.mouse.wx, wy = app.mouse.wy;
    hideHover(); htip.long = false; if (touch && !app.mode) { const sx = app.mouse.x, sy = app.mouse.y; htip.timer = setTimeout(() => { if (drag.on && !drag.moved) { const [x, y] = toWorld(sx, sy), t = pick(x, y); if (t) { showHover(t, sx, sy); htip.long = true; } } }, 500); }
    app.mouse.inside = true; if (e.button === 2) { if (app.mode) { app.mode = null; return; } context(wx, wy, e.shiftKey); return; }
    Object.assign(drag, { on: true, touch, sx: app.mouse.x, sy: app.mouse.y, cx: cam.x, cy: cam.y, moved: false, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }); });
  view.addEventListener('pointermove', e => { setMouse(e); if (!drag.on) { if (e.pointerType === 'mouse' && !app.mode) hoverAt(app.mouse.x, app.mouse.y, 350); else hideHover(); return; } const dx = app.mouse.x - drag.sx, dy = app.mouse.y - drag.sy; if (Math.hypot(dx, dy) > 6) { drag.moved = true; if (!htip.long) hideHover(); }
    if (!drag.moved || app.mode) return; if (drag.touch && !app.boxTouch) { cam.x = drag.cx - dx / cam.z; cam.y = drag.cy - dy / cam.z; clampCam(); } else app.box = { x0: drag.sx, y0: drag.sy, x1: app.mouse.x, y1: app.mouse.y }; });
  view.addEventListener('pointerup', e => { setMouse(e); if (!drag.on) return; drag.on = false; if (drag.touch) { clearTimeout(htip.timer); if (htip.long) { htip.long = false; return; } } /* 길게 눌러 도움말을 본 뒤에는 탭 명령을 내지 않는다 */ const G = app.G, wx = app.mouse.wx, wy = app.mouse.wy, now = performance.now();
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
  view.addEventListener('wheel', e => { e.preventDefault(); hideHover(); if (app.demo) return; setMouse(e); const [wx, wy] = [app.mouse.wx, app.mouse.wy], z = Math.max(.55, Math.min(1.6, cam.z * (e.deltaY < 0 ? 1.1 : .91))); cam.z = z; cam.x = wx * TS - app.mouse.x / z; cam.y = wy * TS - app.mouse.y / z; clampCam(); }, { passive: false });
  const miniEv = e => { const r = mini.getBoundingClientRect(), k = mini.width / r.width, T = app.miniT; if (!T) return null; return [((e.clientX - r.left) * k - T.ox) / T.sc, ((e.clientY - r.top) * k - T.oy) / T.sc]; };
  mini.addEventListener('contextmenu', e => { e.preventDefault(); const p = miniEv(e); if (p) context(p[0], p[1], e.shiftKey); });
  mini.addEventListener('pointerdown', e => { if (e.button !== 0 || app.demo) return; const p = miniEv(e); if (!p) return; if (app.mode && app.mode.type === 'target') { execMode(p[0], p[1], e.shiftKey); return; } mini.setPointerCapture(e.pointerId); centerOn(p[0], p[1]); app.miniDrag = true; });
  mini.addEventListener('pointermove', e => { if (app.miniDrag) { const p = miniEv(e); if (p) centerOn(p[0], p[1]); } });
  mini.addEventListener('pointerup', () => { app.miniDrag = false; });
  const keys = {}; let lastDigit = 0, lastDigitT = 0;
  const onKey = e => { const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA') && tg.type !== 'range' && tg.type !== 'checkbox') { if (e.key === 'Escape' && tg.id === 'k-chatin') closeChat(); return; }
    if (app.setOpen) { if (e.key === 'Escape') toggleSettings(); return; } const live = app.G && !app.demo && !app.G.over; keys[e.key] = true; if (!live) return; const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (k.startsWith('Arrow')) { e.preventDefault(); return; }
    if (k === 'Enter' && app.net && app.net.conn) { e.preventDefault(); openChat(); return; }
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
  function setValue(s, v) { app.settings[s.id] = v; store.set('settings', JSON.stringify(app.settings)); if (s.id === 'music') applyMusic(); if (s.id === 'voiceVol') $('k-voiceout').volume = v / 100; if (liveGame() && !app.net && !s.client && !s.startOnly) RTS.cfg(app.G)[s.id] = v; }
  function renderSettings() { const el = $('k-set'), live = liveGame(), src = id => live && !RTS.SETTINGS.flatMap(g => g.items).find(x => x.id === id).client ? (RTS.cfg(app.G)[id] ?? app.settings[id]) : app.settings[id];
    el.innerHTML = `<div class="s-panel"><div class="s-head"><h2>설정</h2><button id="s-close">닫기</button></div><p class="s-note">${live && app.net ? '둘이 대전 중에는 게임 규칙을 바꿀 수 없습니다. 화면과 소리만 바꿀 수 있고, 게임은 계속 진행됩니다.' : live ? '게임이 멈춰 있습니다. 바꾼 값은 이번 판에 바로 적용되며, 새 게임 전용 항목은 다음 판부터 적용됩니다.' : '여기서 고른 값은 이 브라우저에 저장되고 나와 AI에게 똑같이 적용됩니다.'}</p><div class="s-presets"><span>묶음 설정</span>${Object.keys(RTS.PRESETS).map(k => `<button data-preset="${k}">${k}</button>`).join('')}</div>` +
      RTS.SETTINGS.map(g => `<section><h3>${g.group}</h3>${g.note ? `<p class="s-note">${g.note}</p>` : ''}${g.items.map(s => { const off = live && (s.startOnly || (app.net && !s.client)), v = src(s.id), id = 's-' + s.id;
        return `<div class="s-row${off ? ' off' : ''}"><label for="${id}"><b>${s.label}</b>${s.desc ? `<small>${s.desc}</small>` : ''}${off ? '<small>다음 판부터 적용</small>' : ''}</label>` + (s.type === 'toggle' ? `<input type="checkbox" id="${id}" data-s="${s.id}" ${v ? 'checked' : ''} ${off ? 'disabled' : ''}>` : `<input type="range" id="${id}" data-s="${s.id}" min="${s.min}" max="${s.max}" step="${s.step}" value="${v}" ${off ? 'disabled' : ''}>`) + `<output id="${id}-v">${fmtSet(s, v)}</output></div>`; }).join('')}</section>`).join('') + `<div class="s-foot"><button id="s-reset">기본값으로 되돌리기</button></div></div>`;
    el.querySelectorAll('[data-s]').forEach(i => { const s = RTS.SETTINGS.flatMap(g => g.items).find(x => x.id === i.dataset.s); i.oninput = () => { const v = s.type === 'toggle' ? i.checked : +i.value; setValue(s, v); $('s-' + s.id + '-v').textContent = fmtSet(s, v); }; });
    el.querySelectorAll('[data-preset]').forEach(b => { if (live && app.net) b.disabled = true; b.onclick = () => applySettings(Object.assign(RTS.defaultSettings(), RTS.PRESETS[b.dataset.preset]), true); });
    if (live && app.net) $('s-reset').disabled = true; $('s-reset').onclick = () => applySettings(RTS.defaultSettings(), false); $('s-close').onclick = toggleSettings; }
  function applySettings(vals, keepOther) { for (const s of RTS.SETTINGS.flatMap(g => g.items)) { if (keepOther && (s.client || s.startOnly)) continue; setValue(s, vals[s.id]); } renderSettings(); }
  function toggleSettings() { app.setOpen = !app.setOpen; $('k-set').hidden = !app.setOpen; if (app.setOpen) renderSettings(); else { app.exRows = null; updateSpeed(); } }
  function togglePause(remote) { if (app.net && remote === undefined) { netSend({ t: 'pause', on: !app.paused }); } else if (remote !== undefined) { if (app.paused === remote) return; notice(remote ? '상대가 일시정지했습니다' : '상대가 게임을 재개했습니다'); } app.paused = !app.paused; $('k-paused').hidden = !app.paused; $('k-pause').textContent = app.paused ? '재개' : '정지'; }
  function updateSpeed() { $('k-speed').textContent = app.speed === 1 ? '1배속' : app.speed + '배속'; $('k-mute').textContent = muted ? '소리 켬' : '소리 끔'; $('k-paused').hidden = !app.paused; }
  $('k-setbtn').onclick = toggleSettings; $('k-setopen').onclick = toggleSettings; $('k-exbtn').onclick = toggleExchange; $('k-dipbtn').onclick = toggleDip; $('k-pause').onclick = () => togglePause(); $('k-speed').onclick = () => { if (app.net) { notice('둘이 대전은 1배속으로만 진행합니다'); return; } app.speed = app.speed === 1 ? 1.5 : app.speed === 1.5 ? 2 : 1; updateSpeed(); };
  $('k-mute').onclick = () => { unlock(); muted = !muted; store.set('mute', muted ? '1' : '0'); updateSpeed(); applyMusic(); };
  $('k-menu').onclick = () => app.toMenu(); $('k-tomenu').onclick = () => { if (app.outShown && app.G && !app.G.over) { $('k-end').hidden = true; return; } app.toMenu(); }; // 전멸 후 관전 계속 $('k-again').onclick = () => { unlock(); app.start(); }; $('k-play').onclick = () => { unlock(); store.del('save'); app.start(); };
  $('k-netopen').onclick = () => { unlock(); netOpen(); };
  $('k-resume').onclick = () => { unlock(); const s = store.get('save'); if (s) app.loadState(s); };
  $('k-idle').onclick = () => { if (app.idle && app.idle.length) { app.sel = app.idle.map(e => e.id); const u = app.idle[0]; centerOn(u.x, u.y); } };
  $('k-boxbtn').onclick = () => { app.boxTouch = !app.boxTouch; $('k-boxbtn').classList.toggle('on', app.boxTouch); };


  // ── 둘이 대전: 방 만들기/참가, 연결, 시작 ─────────────
  // 연결 수단: WebRTC(PeerJS). 처음 연결을 이어 줄 때만 PeerJS 공용 중계 서버를 쓰고, 이후 게임 데이터는 두 기기가 직접 주고받는다.
  const PEER_SRC = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', PEER_PREFIX = 'kjh-rts01-';
  const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function peerLib() { if (window.Peer) return Promise.resolve(window.Peer); return new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = PEER_SRC; sc.onload = () => (window.Peer ? ok(window.Peer) : no(new Error('load'))); sc.onerror = () => no(new Error('load')); document.head.appendChild(sc); }); }
  const myName = () => (store.get('name') || '').trim().slice(0, 12) || '플레이어';
  function netOpen() { if (app.net) netClose(true); app.net = { stage: 'choose', hc: ['none', 'none'], mode: store.get('netMode') === 'coop' ? 'coop' : 'vs', fac1: null, boost: RTS.COOP.boost }; $('k-start').hidden = true; $('k-net').hidden = false; renderNet(); }
  function netClose(bye) { const N = app.net; if (!N) return; voiceReset(); app.net = null; chat.list = []; $('k-chatbox').hidden = true; renderChat(); $('k-netchat').hidden = true; try { if (bye && N.conn && N.conn.open) N.conn.send({ t: 'bye' }); } catch (e) {} setTimeout(() => { try { N.conn && N.conn.close(); } catch (e) {} try { N.peer && N.peer.destroy(); } catch (e) {} }, 150); $('k-wait').hidden = true; $('k-net').hidden = true; }
  function netSend(m) { const N = app.net; if (N && N.conn && N.conn.open) N.conn.send(m); }
  function netStatus(text, bad) { if (!app.net) return; app.net.status = text; app.net.bad = !!bad; renderNet(); }
  function netFail(err) { const N = app.net; if (!N) return; const ty = err && err.type;
    const msg = ty === 'peer-unavailable' ? '그 번호의 방이 없습니다. 방장 화면의 번호를 다시 확인하세요.' : ty === 'network' || ty === 'server-error' || ty === 'socket-error' || (err && err.message === 'load') ? '연결 서버에 닿지 않습니다. 인터넷 연결을 확인하세요.' : ty === 'browser-incompatible' ? '이 브라우저는 기기 간 연결을 지원하지 않습니다. Chrome을 쓰세요.' : '연결 오류: ' + (ty || (err && err.message) || '알 수 없음');
    if (N.L && app.G && !app.G.over) netLost(); else { N.stage = N.role === 'host' && N.stage === 'lobby' ? 'host' : N.stage; netStatus(msg, true); } }
  function wireConn(conn) { const N = app.net; N.conn = conn;
    conn.on('open', () => { if (app.net !== N) return; N.stage = 'lobby'; N.status = ''; if (N.role === 'guest') conn.send({ t: 'hello', name: myName(), build: RTS.BUILD }); else sendLobby(); renderNet(); });
    conn.on('data', m => { if (app.net === N) netMsg(m); });
    conn.on('close', () => { if (app.net !== N) return; voiceReset(); if (N.L) netLost(); else { N.conn = null; N.stage = N.role === 'host' ? 'host' : 'choose'; netStatus('상대와 연결이 끊겼습니다.', true); } });
    conn.on('error', netFail); }
  async function netHost() { const N = app.net; N.role = 'host'; N.stage = 'host'; netStatus('연결 준비 중…'); let Peer; try { Peer = await peerLib(); } catch (e) { return netFail(e); } if (app.net !== N) return;
    const tryCode = left => { N.code = String(1000 + Math.floor(Math.random() * 9000)); const peer = N.peer = new Peer(PEER_PREFIX + N.code, { debug: 0 });
      peer.on('open', () => { if (app.net === N) netStatus('상대 기기에서 이 번호를 입력하세요.'); });
      peer.on('call', call => onCall(N, call));
      peer.on('connection', conn => { if (app.net !== N || N.conn) { conn.on('open', () => conn.close()); return; } wireConn(conn); });
      peer.on('error', err => { if (app.net !== N) return; if (err.type === 'unavailable-id' && left > 0) { peer.destroy(); tryCode(left - 1); } else netFail(err); });
      peer.on('disconnected', () => { if (app.net === N && !N.conn) try { peer.reconnect(); } catch (e) {} }); };
    tryCode(4); }
  async function netJoin(code) { const N = app.net; if (!/^\d{4}$/.test(code)) return netStatus('방 번호 숫자 4자리를 입력하세요.', true); N.role = 'guest'; N.code = code; N.stage = 'joining'; netStatus('방을 찾는 중…'); let Peer; try { Peer = await peerLib(); } catch (e) { return netFail(e); } if (app.net !== N) return;
    const peer = N.peer = new Peer({ debug: 0 }); peer.on('call', call => onCall(N, call)); peer.on('error', err => { if (app.net === N) { N.stage = 'choose'; netFail(err); } });
    peer.on('open', () => { if (app.net !== N) return; const conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' }); wireConn(conn); setTimeout(() => { if (app.net === N && N.stage === 'joining') { N.stage = 'choose'; netStatus('방에 연결하지 못했습니다. 두 기기가 같은 와이파이인지 확인하세요.', true); } }, 15000); }); }
  // 방장이 정하는 내용: 전장, 진영(상대는 다른 진영), 팀별 핸디캡
  // 두 사람은 서로 다른 진영을 고른다. 남은 진영이 중립세력(AI)이 된다. 협동이면 중립세력과 둘이 싸우고, 대전이면 셋이 서로 싸운다
  const lobbyOf = () => { const N = app.net, fs = Object.keys(RTS.defs.factions), mine = app.cfg.faction, coop = N.mode === 'coop', other = N.fac1 && N.fac1 !== mine ? N.fac1 : fs.find(x => x !== mine);
    return { map: app.cfg.map, factions: [mine, other], hc: N.hc.slice(), names: [myName(), N.peerName || '상대'], build: RTS.BUILD, coop, enemy: RTS.restFaction([mine, other]), boost: N.boost, level: RTS.COOP.level }; };
  function sendLobby() { if (app.net && app.net.role === 'host') netSend({ t: 'lobby', lobby: lobbyOf() }); }
  function netMsg(m) { const N = app.net; if (!m || typeof m !== 'object') return;
    if (m.t === 'turn') { if (N.L) N.L.receive(m); else (N.early = N.early || []).push(m); return; }
    if (m.t === 'hello' && N.role === 'host') { N.peerName = String(m.name || '상대').slice(0, 12); N.peerBuild = String(m.build || '이전 버전'); sendLobby(); renderNet(); return; }
    if (m.t === 'lobby' && N.role === 'guest') { N.lobby = m.lobby; renderNet(); return; }
    if (m.t === 'start' && N.role === 'guest') { netStart(m.opts, 1); return; }
    if (m.t === 'pause') { togglePause(!!m.on); return; }
    if (m.t === 'chat') { chatAdd(false, peerName(), String(m.text || '').slice(0, 80)); return; }
    if (m.t === 'voice') { notice(m.on ? peerName() + ' 님이 마이크를 켰습니다' + (voice.stream ? '' : ' · 음성 켜기로 내 마이크도 켤 수 있습니다') : peerName() + ' 님이 마이크를 껐습니다', 'ok'); return; }
    if (m.t === 'bye') { if (N.L && app.G && !app.G.over) netLost('상대가 게임을 나갔습니다'); else { N.conn = null; N.stage = N.role === 'host' ? 'host' : 'choose'; netStatus('상대가 나갔습니다.', true); } } }
  function netBegin() { const N = app.net, lb = lobbyOf(); const opts = RTS.netGameOpts({ map: lb.map, seed: 1 + Math.floor(Math.random() * 99999), settings: app.settings, factions: lb.factions, names: lb.names, hc: lb.hc, coop: lb.coop, enemy: lb.enemy, boost: lb.boost, level: lb.level });
    netSend({ t: 'start', opts }); netStart(opts, 0); }
  function netStart(opts, team) { const N = app.net, o = JSON.parse(JSON.stringify(opts)); // 두 기기가 똑같은 값으로 만들도록 방장도 같은 직렬화를 거친다
    app.demo = false; app.team = team; app.speed = 1; app.paused = false; N.waitMs = 0;
    N.L = RTS.Lockstep({ team, send: netSend, onDesync: () => notice('두 기기의 게임 상태가 어긋났습니다. 두 기기 모두 새로고침한 뒤 방을 새로 만드세요.', 'warn') });
    for (const m of N.early || []) N.L.receive(m); N.early = null;
    $('k-net').hidden = true; $('k-again').hidden = true; showGame(RTS.createGame(o)); notice(o.coop ? `협동 시작. 동료 ${o.players[1 - team].name}와 함께 ${o.players[2].name}을 무찌르세요` : team === 0 ? '대전 시작. 상대: ' + o.players[1].name : '대전 시작. 상대: ' + o.players[0].name, 'ok'); }
  function netLost(why) { const N = app.net; if (!N || N.endShown) return; N.endShown = true; app.paused = true; $('k-wait').hidden = true;
    $('k-endt').textContent = '대전 중단'; $('k-ends').textContent = why || '상대 기기와 연결이 끊겼습니다.'; $('k-stats').innerHTML = ''; $('k-again').hidden = true; $('k-end').hidden = false; }
  function renderNet() { const N = app.net, el = $('k-netp'); if (!N) return; const d = RTS.defs, st = N.status ? `<p class="k-netst${N.bad ? ' bad' : ''}" role="status">${esc(N.status)}</p>` : '';
    const opt = (id, on, b, sub) => `<button class="k-opt${on ? ' on' : ''}" aria-pressed="${on}" data-v="${id}"><b>${esc(b)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</button>`;
    const coopNow = N.stage === 'lobby' && (N.role === 'host' ? N.mode === 'coop' : !!(N.lobby && N.lobby.coop));
    let h = `<h1>${coopNow ? '둘이 협동' : N.stage === 'lobby' ? '둘이 대전' : '둘이 하기'}</h1>`;
    if (N.stage === 'choose' || N.stage === 'joining') {
      h += `<p class="k-sub">두 기기에서 이 화면을 열고, 한쪽은 방을 만들고 다른 쪽은 방 번호로 들어갑니다. 같은 와이파이에서 Chrome이나 삼성 인터넷을 쓰세요.</p>
        <h2>내 이름</h2><input class="k-in" id="n-name" maxlength="12" value="${esc(myName())}" autocomplete="off">
        <div class="k-go"><button class="k-primary" id="n-host">방 만들기</button></div>
        <h2>참가하기</h2><div class="k-netjoin"><input class="k-in" id="n-code" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="방 번호 4자리" value="${esc(N.code && N.role === 'guest' ? N.code : '')}"><button id="n-join" ${N.stage === 'joining' ? 'disabled' : ''}>참가</button></div>${st}`;
    } else if (N.stage === 'host') {
      h += `<p class="k-sub">상대 기기에서 <b>둘이 하기 → 참가하기</b>를 누르고 아래 번호를 입력하게 하세요.</p><div class="k-code" aria-label="방 번호">${N.code ? esc(N.code) : '----'}</div>${st}`;
    } else if (N.role === 'host') { const lb = lobbyOf(), other = d.factions[lb.factions[1]].name, pn = esc(N.peerName || '상대'), coop = lb.coop;
      h += `<p class="k-sub">연결됨 · 상대: <b>${pn}</b></p>
        <h2>방식</h2><div class="k-opts" id="n-mode">${opt('vs', !coop, '서로 대전', '둘이 맞붙는다')}${opt('coop', coop, '둘이 협동', '동맹해서 중립세력을 무찌른다')}</div>
        <h2>전장</h2><div class="k-opts" id="n-map">${Object.values(d.maps).map(m => opt(m.id, lb.map === m.id, m.name)).join('')}</div>
        <h2>내 진영</h2><div class="k-opts k-three" id="n-fac">${Object.values(d.factions).map(f => opt(f.id, lb.factions[0] === f.id, f.name)).join('')}</div>
        <h2>${pn} 진영</h2><div class="k-opts k-three" id="n-fac1">${Object.values(d.factions).map(f => opt(f.id, lb.factions[1] === f.id, f.name, '')).join('')}</div>
        <p class="k-sub k-small">중립세력: <b>${esc(d.factions[lb.enemy].name)}</b> (남은 진영) · ${coop ? '둘이 함께 상대한다' : '두 사람 모두와 싸운다. 마지막까지 남는 쪽이 승리'}</p>
        <h2>중립세력 강도 (보통 AI 대비)</h2><div class="k-opts k-four" id="n-boost">${RTS.COOP.boosts.map(k => opt(String(k), N.boost === k, Math.round(k * 100) + '%', k === RTS.COOP.boost ? '기본' : '')).join('')}</div>
        <h2>내 핸디캡</h2><div class="k-opts k-four" id="n-hc0">${Object.values(RTS.HANDICAPS).map(x => opt(x.id, N.hc[0] === x.id, x.name, x.blurb)).join('')}</div>
        <h2>${esc(N.peerName || '상대')} 핸디캡</h2><div class="k-opts k-four" id="n-hc1">${Object.values(RTS.HANDICAPS).map(x => opt(x.id, N.hc[1] === x.id, x.name, x.blurb)).join('')}</div>
        <p class="k-sub k-small">게임 규칙은 이 기기의 설정 메뉴 값을 그대로 씁니다.</p>${st}`;
    } else { const lb = N.lobby;
      h += `<p class="k-sub">연결됨 · 방 ${esc(N.code)}. 방장이 시작하면 바로 시작합니다.</p>` + (lb ? `<dl class="k-netsum"><dt>방식</dt><dd>${lb.coop ? '둘이 협동' : '서로 대전 (셋이 싸움)'}</dd><dt>중립세력</dt><dd>${esc(d.factions[lb.enemy]?.name)} · 보통 AI의 ${Math.round((lb.boost || 1) * 100)}%</dd><dt>전장</dt><dd>${esc(d.maps[lb.map]?.name || lb.map)}</dd><dt>내 진영</dt><dd>${esc(d.factions[lb.factions[1]]?.name)}</dd><dt>${esc(lb.names[0])} 진영</dt><dd>${esc(d.factions[lb.factions[0]]?.name)}</dd><dt>내 핸디캡</dt><dd>${esc(RTS.HANDICAPS[lb.hc[1]]?.name)} · ${esc(RTS.HANDICAPS[lb.hc[1]]?.blurb)}</dd><dt>${esc(lb.names[0])} 핸디캡</dt><dd>${esc(RTS.HANDICAPS[lb.hc[0]]?.name)}</dd></dl>` : '<p class="k-sub">방장 설정을 받는 중…</p>') + st; }
    const vb = verState(N); if (N.stage === 'lobby' && vb) h += `<p class="k-netst bad" role="alert">${vb}</p>`;
    h += `<div class="k-go">${N.role === 'host' && N.stage === 'lobby' ? `<button class="k-primary" id="n-go" ${vb ? 'disabled' : ''}>시작</button>` : ''}<button id="n-back">나가기</button></div>`;
    el.innerHTML = h;
    const on = (id, f) => { const x = el.querySelector('#' + id); if (x) x.onclick = f; };
    on('n-back', () => { netClose(true); $('k-start').hidden = false; renderMenu(); });
    on('n-host', () => { saveName(); netHost(); }); on('n-join', () => { saveName(); netJoin(el.querySelector('#n-code').value.trim()); }); on('n-go', () => { unlock(); netBegin(); });
    const code = el.querySelector('#n-code'); if (code) code.onkeydown = e => { if (e.key === 'Enter') { saveName(); netJoin(code.value.trim()); } };
    const pickers = { 'n-map': v => { app.cfg.map = v; store.set('cfg', JSON.stringify(app.cfg)); }, 'n-fac': v => { const lb = lobbyOf(); if (v === lb.factions[1]) N.fac1 = lb.factions[0]; app.cfg.faction = v; store.set('cfg', JSON.stringify(app.cfg)); }, 'n-hc0': v => { N.hc[0] = v; }, 'n-hc1': v => { N.hc[1] = v; },
      'n-mode': v => { N.mode = v; store.set('netMode', v); }, 'n-fac1': v => { if (v === app.cfg.faction) { app.cfg.faction = lobbyOf().factions[1]; store.set('cfg', JSON.stringify(app.cfg)); } N.fac1 = v; }, 'n-boost': v => { N.boost = +v; } };
    for (const id of Object.keys(pickers)) el.querySelectorAll('#' + id + ' [data-v]').forEach(b => { b.onclick = () => { pickers[id](b.dataset.v); sendLobby(); renderNet(); }; });
    $('k-netchat').hidden = N.stage !== 'lobby'; renderChat(); renderVoice(); }
  // 두 기기 버전 비교: 다르면 계산이 어긋나므로 시작을 막는다. 빈 문자열이면 같음
  function verState(N) { const other = N.role === 'host' ? N.peerBuild : N.lobby && (N.lobby.build || '이전 버전'); if (!other || other === RTS.BUILD) return '';
    return `두 기기의 게임 버전이 다릅니다 (이 기기 ${esc(RTS.BUILD || '?')}, 상대 ${esc(other)}). 두 기기 모두 게임 탭을 닫고 다시 연 뒤 방을 새로 만드세요.`; }
  function saveName() { const i = $('k-netp').querySelector('#n-name'); if (i) store.set('name', i.value.trim().slice(0, 12)); }
  // ── 둘이 대전 채팅: 게임 명령(lockstep)과 별도로 연결에 바로 보낸다. 게임 계산에는 영향이 없다 ──
  const QUICK = ['공격!', '도와줘', '잠깐만', '잘했어', 'ㅋㅋㅋ', '좋은 게임!', '한 판 더?'];
  const chat = { list: [] };
  const peerName = () => { const N = app.net; return (N && (N.role === 'host' ? N.peerName : N.lobby && N.lobby.names[0])) || '상대'; };
  function chatAdd(mine, name, text) { if (!text) return; chat.list.push({ mine, name, text, at: performance.now() }); if (chat.list.length > 60) chat.list.shift(); renderChat(); setTimeout(renderChat, 9100);
    if (!mine && ac && !muted) { tone(880, 880, .07, 'sine', .05); setTimeout(() => tone(1320, 1320, .09, 'sine', .04), 90); } }
  function chatSend(text) { text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 80); if (!text || !app.net || !app.net.conn || !app.net.conn.open) return false; netSend({ t: 'chat', text }); chatAdd(true, myName(), text); return true; }
  const chatLine = m => `<p class="${m.mine ? 'me' : 'peer'}"><b>${esc(m.mine ? '나' : m.name)}</b>${esc(m.text)}</p>`;
  function renderChat() { const now = performance.now(), open = !$('k-chatbox').hidden;
    $('k-chatlog').innerHTML = chat.list.filter(m => open || now - m.at < 9000).slice(-6).map(chatLine).join('');
    const nl = $('n-chatlog'); nl.innerHTML = chat.list.slice(-40).map(chatLine).join('') || '<p class="k-empty">메시지가 여기에 표시됩니다.</p>'; nl.scrollTop = nl.scrollHeight; }
  function openChat() { if (!app.net || !app.net.conn) return; $('k-chatbox').hidden = false; $('k-chatbtn').classList.add('on'); renderChat(); if (matchMedia('(pointer:fine)').matches) $('k-chatin').focus(); }
  function closeChat() { $('k-chatbox').hidden = true; $('k-chatbtn').classList.remove('on'); $('k-chatin').blur(); if (app.G && !app.demo) view.focus({ preventScroll: true }); renderChat(); }
  $('k-chatbtn').onclick = () => ($('k-chatbox').hidden ? openChat() : closeChat()); $('k-chatx').onclick = closeChat;
  $('k-chatbox').onsubmit = e => { e.preventDefault(); const i = $('k-chatin'); if (chatSend(i.value)) i.value = ''; closeChat(); };
  $('n-chatform').onsubmit = e => { e.preventDefault(); const i = $('n-chatin'); if (chatSend(i.value)) i.value = ''; };
  for (const [id, after] of [['k-quick', closeChat], ['n-quick', null]]) for (const q of QUICK) { const b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.onclick = () => { chatSend(q); if (after) after(); }; $(id).appendChild(b); }

  // ── 둘이 대전 음성: 각자 자기 마이크를 한 방향 통화로 보낸다(켜는 쪽이 걸고, 받는 쪽은 듣기만). 그래서 켜고 끄기가 서로 독립이다 ──
  const voice = { stream: null, out: null, inCall: null, needTap: false };
  function renderVoice() { const on = !!voice.stream, txt = on ? '마이크 끄기' : '음성 켜기', ttl = (on ? '내 마이크 켜짐' : '내 마이크 꺼짐') + ' · ' + (voice.inCall ? '상대 음성 들림' : '상대 마이크 꺼짐');
    for (const id of ['k-voicebtn', 'n-voice']) { const b = $(id); b.textContent = txt; b.classList.toggle('on', on); b.title = ttl; } applyMusic(); }
  async function voiceToggle() { const N = app.net; if (!N || !N.conn || !N.peer) return; unlock();
    if (voice.stream) { voiceStop(true); notice('마이크를 껐습니다'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { notice('이 브라우저에서는 마이크를 쓸 수 없습니다. https 주소인지, Chrome인지 확인하세요.', 'warn'); return; }
    let st; try { st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); }
    catch (e) { notice(e && e.name === 'NotAllowedError' ? '마이크 권한이 거부되었습니다. 주소창 왼쪽 자물쇠 → 권한에서 마이크를 허용하세요.' : e && e.name === 'NotFoundError' ? '이 기기에서 마이크를 찾지 못했습니다.' : '마이크를 열 수 없습니다: ' + ((e && (e.name || e.message)) || '알 수 없음'), 'warn'); return; }
    if (app.net !== N || !N.conn) { st.getTracks().forEach(t => t.stop()); return; }
    voice.stream = st; const call = voice.out = N.peer.call(N.conn.peer, st, { metadata: { kind: 'voice' } });
    if (call) { call.on('close', () => { if (voice.out === call) voiceStop(false); }); call.on('error', () => { if (voice.out === call) { voiceStop(false); notice('음성 연결에 실패했습니다', 'warn'); } }); }
    netSend({ t: 'voice', on: true }); notice('마이크를 켰습니다', 'ok'); renderVoice(); }
  function voiceStop(tell) { const c = voice.out; voice.out = null; if (c) try { c.close(); } catch (e) {} if (voice.stream) voice.stream.getTracks().forEach(t => t.stop()); voice.stream = null; if (tell) netSend({ t: 'voice', on: false }); renderVoice(); }
  function voiceReset() { voiceStop(false); const c = voice.inCall; voice.inCall = null; if (c) try { c.close(); } catch (e) {} $('k-voiceout').srcObject = null; voice.needTap = false; renderVoice(); }
  function onCall(N, call) { if (app.net !== N || !N.conn || call.peer !== N.conn.peer) { try { call.close(); } catch (e) {} return; }
    const old = voice.inCall; voice.inCall = call; if (old) try { old.close(); } catch (e) {}
    call.on('stream', s => { if (voice.inCall !== call) return; const a = $('k-voiceout'); a.srcObject = s; a.volume = app.settings.voiceVol / 100;
      const p = a.play(); if (p) p.then(() => { voice.needTap = false; }).catch(() => { voice.needTap = true; notice('화면을 한 번 누르면 상대 음성이 들립니다', 'warn'); }); renderVoice(); });
    call.on('close', () => { if (voice.inCall === call) { voice.inCall = null; $('k-voiceout').srcObject = null; renderVoice(); } });
    call.on('error', () => {}); call.answer(); renderVoice(); }
  $('k-voicebtn').onclick = voiceToggle; $('n-voice').onclick = voiceToggle;
  // 아무 곳이나 처음 누르면 소리를 연다(브라우저 자동 재생 제한). 막혔던 상대 음성도 이때 다시 튼다
  const anyTap = () => { unlock(); if (voice.needTap) { const p = $('k-voiceout').play(); if (p) p.then(() => { voice.needTap = false; }).catch(() => {}); } };
  root.addEventListener('pointerdown', anyTap, true); window.addEventListener('keydown', anyTap, true);
  $('k-ver').textContent = '버전 ' + (RTS.BUILD || '개발');

  // ── 루프 ──────────────────────────────────────────────
  function layout() { const r = $('k-stage').getBoundingClientRect(), W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height)); if (view.width !== W || view.height !== H) { view.width = W; view.height = H; clampCam(); } }
  const ro = new ResizeObserver(layout); ro.observe($('k-stage'));
  let lastT = performance.now(), acc = 0, raf = 0, alive = true; const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loop(now) { if (!alive) return; raf = requestAnimationFrame(loop); const dt = Math.min(250, now - lastT); lastT = now; app.frame++; const G = app.G; if (!G) return;
    if (app.net && app.net.L && !app.demo) { // 둘이 대전: 양쪽 입력이 모인 턴만 진행. 늦은 쪽이 따라잡도록 한 프레임에 최대 6틱
      if (!app.paused && !G.over) { acc += dt; const per = 1000 / RTS.HZ; let n = 0, stuck = false; while (acc >= per && n < 6) { if (!app.net.L.advance(G)) { stuck = true; acc = Math.min(acc, per * 3); break; } acc -= per; n++; }
        if (stuck) { app.net.waitMs = (app.net.waitMs || 0) + dt; } else app.net.waitMs = 0; $('k-wait').hidden = !(app.net.waitMs > 700); } }
    else if (!app.paused && !G.over && (app.demo || !app.setOpen)) { acc += dt * (app.demo ? 1.5 : app.speed); const per = 1000 / RTS.HZ; let n = 0; while (acc >= per && n < 6) { RTS.step(G); acc -= per; n++; } if (n === 6) acc = 0; }
    if (app.demo) { if (!reduce) { const fight = G.ents.find(e => e.firedAt > G.tick - 20 && RTS.defOf(e).kind === 'unit'); if (fight) { const tx = fight.x * TS - view.width / 2, ty = fight.y * TS - view.height / 2; cam.x += (tx - cam.x) * .006; cam.y += (ty - cam.y) * .006; clampCam(); } } }
    else { const m = app.mouse, sp = 14 / cam.z, e = 12; let dx = 0, dy = 0; if (keys.ArrowLeft) dx = -sp; if (keys.ArrowRight) dx = sp; if (keys.ArrowUp) dy = -sp; if (keys.ArrowDown) dy = sp;
      if (app.settings.edgeScroll && m.inside && !drag.on && matchMedia('(pointer:fine)').matches) { if (m.x < e) dx = -sp; else if (m.x > view.width - e) dx = sp; if (m.y < e) dy = -sp; else if (m.y > view.height - e) dy = sp; }
      if (dx || dy) { cam.x += dx; cam.y += dy; clampCam(); [m.wx, m.wy] = toWorld(m.x, m.y); }
      view.style.cursor = app.mode ? 'crosshair' : 'default';
      if (app.frame % 12 === 0) { renderHud(); // 셋 이상 게임에서 나만 전멸하면 패배를 알리고 관전으로 남는다(두 기기 계산은 계속 돌아야 한다)
        if (G.teams.length > 2 && !G.over && !app.outShown && G.teams[app.team] && G.teams[app.team].alive === 0) { app.outShown = true; finish(null, true); } } }
    if (app.frame % 15 === 0 && !app.demo) renderMini();
    if (music && app.frame % 12 === 0) { if (!app.demo && !G.over) { if (G.ents.some(e => e.team === app.team && e.firedAt > G.tick - 8)) app.heat = Math.max(app.heat || 0, .75); app.heat = (app.heat || 0) * .965; music.setIntensity(Math.max(app.heat, Math.min(.3, G.tick / 20 / 900))); } if (app.frame % 36 === 0) applyMusic(); }
    R.draw(Math.min(1, acc / (1000 / RTS.HZ))); }
  renderMenu(); layout(); demo(); raf = requestAnimationFrame(loop);
  if (opts.autostart) app.start(opts.autostart);
  app.destroy = () => { if (app.net) netClose(true); if (music) music.stop(); window.removeEventListener('keydown', anyTap, true); alive = false; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', offKey); root.innerHTML = ''; };
  return app;
};
