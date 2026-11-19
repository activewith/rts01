// music.js — 배경음악. 외부 소리 파일 없이 WebAudio로 그 자리에서 합성한다. DOM 없음.
// const m = RTS.Music(audioContext); m.setMode(곡 이름 | 'off'); m.setIntensity(0~1); m.setVolume(0~1); m.sting('win'|'lose'); m.stop();
// 곡은 RTS.MUSIC_SONGS에 데이터로 추가한다. 음은 MIDI 번호(60 = 가운데 도), 한 칸은 16분음표, 한 마디 16칸.
//   chords: 마디마다 화음, bass: 마디마다 베이스 음, arp: 칸마다 화음 안 음 번호(-1 쉼), lead: 마디별 선율 [칸마다 화음 뿌리 기준 반음 수 또는 null]
//   pad/arpType/leadType: 소리 종류(sawtooth·square·triangle·sine), cut: 저역 필터, drums: 'none'|'soft'|'march'|'machine'|'tribal'|'drive'|'boss'
//   heat(긴장도)가 오르면 드럼·아르페지오·선율이 더해진다. minHeat: 곡이 늘 유지하는 최소 긴장도
RTS.MUSIC_SONGS = (() => { const _ = null; return {
  // 메뉴: 느리고 넓은 화음, 드럼 없음
  menu: { bpm: 72, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: [45, 41, 36, 43],
    arp: [0, -1, -1, -1, 1, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1], arpOct: 12, padVol: .05, arpVol: .022, arpType: 'sine', arpLen: 6, drums: 'none' },
  // 예전 전투 곡(일반 게임에서 진영 곡이 없을 때)
  game: { bpm: 112, chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59], [50, 53, 57], [53, 57, 60], [52, 56, 59], [52, 56, 59]],
    bass: [45, 41, 43, 40, 38, 41, 40, 40], arp: [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 0, 2, 1, 2], arpOct: 12, padVol: .032, arpVol: .018, drums: 'drive' },
  // 개척단: 장조, 행진곡 스네어, 금관 같은 톱니파 선율
  pioneers: { bpm: 108, chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], bass: [48, 45, 41, 43], drums: 'march',
    arp: [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 1, 2], arpOct: 12, padVol: .03, arpVol: .016, arpType: 'triangle', leadType: 'sawtooth', leadCut: 2400, leadVol: .028,
    lead: [[12, _, _, _, 7, _, 12, _, 14, _, 16, _, 14, _, 12, _], [12, _, _, _, 7, _, _, _, 4, _, 7, _, 12, _, _, _], [12, _, 14, _, 16, _, _, _, 17, _, 16, _, 14, _, 12, _], [14, _, _, _, 11, _, 7, _, 11, _, 14, _, 19, _, _, _]] },
  // 철갑회: 단조, 기계 박자(금속 타격), 사각파 펄스 베이스
  ironclad: { bpm: 120, chords: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [52, 56, 59]], bass: [45, 45, 41, 40], drums: 'machine', bassPulse: true,
    arp: [0, 0, 2, 0, 1, 0, 2, 0, 0, 0, 2, 0, 1, 2, 1, 0], arpOct: 0, padVol: .022, arpVol: .016, arpType: 'square', arpCut: 1400, leadType: 'square', leadCut: 1600, leadVol: .02,
    lead: [[12, _, _, 12, _, _, 15, _, 12, _, _, _, 10, _, _, _], [12, _, _, 12, _, _, 15, _, 17, _, 15, _, 12, _, _, _], [12, _, _, 12, _, _, 15, _, 12, _, _, _, 8, _, _, _], [11, _, _, 11, _, _, 14, _, 11, _, 8, _, 7, _, _, _]] },
  // 포자군락: 프리지안 느낌의 불안한 화음, 낮은 웅웅거림, 부족 북 같은 타격
  swarm: { bpm: 96, chords: [[52, 55, 59], [53, 57, 60], [52, 55, 59], [50, 53, 58]], bass: [40, 41, 40, 38], drums: 'tribal', drone: 28,
    arp: [0, -1, -1, 1, -1, -1, 2, -1, 0, -1, 1, -1, -1, 2, -1, 1], arpOct: 12, padVol: .03, arpVol: .02, arpType: 'sine', arpLen: 3, leadType: 'triangle', leadVol: .03, leadBend: true,
    lead: [[12, _, _, _, 13, _, _, _, 12, _, _, _, 10, _, _, _], [_, _, _, _, 12, _, 13, _, 15, _, _, _, 13, _, _, _], [12, _, _, _, 13, _, _, _, 17, _, 15, _, 13, _, _, _], [12, _, _, _, _, _, 10, _, _, _, 8, _, 7, _, _, _]] },
  // 탐험(부대 이동 미션): 가볍고 성긴 뜯는 소리
  adventure: { bpm: 92, chords: [[50, 53, 57], [55, 58, 62], [53, 57, 60], [57, 61, 64]], bass: [38, 43, 41, 45], drums: 'soft',
    arp: [0, -1, 2, -1, 1, -1, 2, -1, 0, -1, 2, 1, -1, 2, -1, -1], arpOct: 12, padVol: .022, arpVol: .026, arpType: 'triangle', arpLen: 2.2, leadType: 'sine', leadVol: .026,
    lead: [[12, _, _, _, _, _, 15, _, 14, _, _, _, 12, _, _, _], [_, _, _, _, 10, _, 12, _, 14, _, _, _, _, _, _, _], [12, _, _, _, 16, _, _, _, 19, _, 17, _, 16, _, _, _], [16, _, _, _, 15, _, _, _, 12, _, _, _, _, _, _, _]], minHeat: .1 },
  // 방어(버티기·거점 지키기): 빠른 8분 반복음, 긴장감
  defense: { bpm: 128, chords: [[57, 60, 64], [58, 62, 65], [57, 60, 64], [56, 59, 64]], bass: [45, 46, 45, 44], drums: 'drive', bassPulse: true,
    arp: [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 3], arpOct: 12, padVol: .026, arpVol: .016, arpType: 'sawtooth', arpCut: 1800, leadType: 'square', leadCut: 1400, leadVol: .018,
    lead: [[12, _, _, _, _, _, _, _, 13, _, _, _, _, _, _, _], [13, _, _, _, _, _, _, _, 15, _, _, _, 13, _, _, _], [12, _, _, _, _, _, _, _, 16, _, _, _, _, _, _, _], [15, _, _, _, 13, _, _, _, 12, _, _, _, 11, _, _, _]], minHeat: .45 },
  // 보스·최종장: 무거운 박, 낮은 화음
  boss: { bpm: 136, chords: [[45, 48, 52], [46, 49, 53], [45, 48, 52], [43, 47, 50]], bass: [33, 34, 33, 31], drums: 'boss', drone: 21, bassPulse: true,
    arp: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1], arpOct: 24, padVol: .03, arpVol: .014, arpType: 'sawtooth', arpCut: 2600, leadType: 'sawtooth', leadCut: 1800, leadVol: .026,
    lead: [[12, _, 12, _, 13, _, _, _, 12, _, _, _, 8, _, _, _], [13, _, 13, _, 15, _, _, _, 13, _, _, _, 10, _, _, _], [12, _, 12, _, 13, _, 15, _, 17, _, _, _, 15, _, _, _], [14, _, _, _, 13, _, _, _, 11, _, _, _, 7, _, _, _]], minHeat: .6 },
}; })();
// 짧은 알림 음악(한 번만): 승리·패배·미션 단계 넘어감
RTS.MUSIC_STINGS = {
  win: { bpm: 120, notes: [[0, 60, 2], [2, 64, 2], [4, 67, 2], [6, 72, 6], [6, 64, 6], [6, 67, 6]], type: 'sawtooth', vol: .05 },
  lose: { bpm: 80, notes: [[0, 64, 3], [3, 63, 3], [6, 62, 3], [9, 61, 8], [9, 52, 8]], type: 'triangle', vol: .06 },
  stage: { bpm: 140, notes: [[0, 67, 1], [1, 72, 3]], type: 'triangle', vol: .04 },
};
RTS.Music = function (ac) {
  const SONGS = RTS.MUSIC_SONGS, hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const out = ac.createGain(); out.gain.value = 0; out.connect(ac.destination);
  const bus = ac.createGain(); bus.gain.value = 1; bus.connect(out);
  // 가벼운 메아리(딜레이)로 공간감
  const dly = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain(); fb.gain.value = .25; wet.gain.value = .18;
  bus.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(out);
  const stingOut = ac.createGain(); stingOut.gain.value = .5; stingOut.connect(ac.destination);
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = noise.getChannelData(0); let seed = 7;
  for (let i = 0; i < nd.length; i++) { seed = (seed * 16807) % 2147483647; nd[i] = seed / 1073741823.5 - 1; }
  const S = { mode: 'off', song: null, step: 0, bar: 0, next: 0, vol: .5, heat: 0, timer: 0, fading: false, drone: null };

  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function osc(type, f, t, dur, peak, a, cut, detune, dest, bend) { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(bend ? f * .94 : f, t); if (bend) o.frequency.exponentialRampToValueAtTime(f, t + .08); if (detune) o.detune.value = detune;
    let node = o; if (cut) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut; o.connect(lp); node = lp; }
    node.connect(g); g.connect(dest || bus); env(g, t, a, peak, dur); o.start(t); o.stop(t + a + dur + .05); }
  function hit(t, type, f, q, peak, dur) { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise; s.playbackRate.value = .7 + Math.random() * .6; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    s.connect(fl); fl.connect(g); g.connect(bus); env(g, t, .002, peak, dur); s.start(t, Math.random() * .5); s.stop(t + dur + .05); }
  function kick(t, f0, f1, v) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(f0 || 140, t); o.frequency.exponentialRampToValueAtTime(f1 || 42, t + .12); o.connect(g); g.connect(bus); env(g, t, .003, v || .38, .26); o.start(t); o.stop(t + .32); }
  function clang(t, v) { osc('square', 1240, t, .09, v, .001, 3800); osc('square', 1873, t, .07, v * .7, .001, 4200); } // 금속 타격(철갑회)

  // 드럼 묶음. h = 긴장도
  function drums(style, step, t, h) {
    if (style === 'none') return;
    if (style === 'soft') { if (step === 0 && h > .2) kick(t, 90, 40, .18); if (step % 4 === 2) hit(t, 'highpass', 8000, .7, .012, .03); return; }
    if (style === 'march') { if (step % 4 === 0 && h > .2) kick(t, 120, 45, .3); if (step === 4 || step === 12) hit(t, 'bandpass', 2200, .8, .1, .1);
      if (h > .5 && (step === 14 || step === 15 || step === 6)) hit(t, 'bandpass', 2400, .8, .06, .05); if (step % 2 === 0) hit(t, 'highpass', 7000, .7, .015, .03); return; }
    if (style === 'machine') { if ((step === 0 || step === 6 || step === 10) && h > .2) kick(t, 160, 38, .34); if (step === 4 || step === 12) clang(t, .03 + h * .03);
      if (step % 2 === 1 && h > .4) hit(t, 'highpass', 9000, 1.2, .018, .02); return; }
    if (style === 'tribal') { if ((step === 0 || step === 3 || step === 8 || step === 11) && h > .15) kick(t, 110, 55, .26); if (step === 6 || step === 14) osc('triangle', 220, t, .1, .06 + h * .04, .003, 0);
      if (h > .5 && step % 2 === 1) hit(t, 'bandpass', 900, 3, .03, .06); return; }
    if (style === 'drive') { if (step % 2 === 0) hit(t, 'highpass', 7000, .7, step % 4 === 2 ? .045 : .025, .04);
      if (h > .25 && (step === 0 || step === 8 || (h > .7 && step === 10))) kick(t); if (h > .55 && (step === 4 || step === 12)) { hit(t, 'bandpass', 1800, .9, .12, .12); osc('triangle', 190, t, .08, .06, .002, 0); } return; }
    if (style === 'boss') { if (step % 4 === 0 || (h > .7 && step % 4 === 3)) kick(t, 100, 30, .42); if (step === 4 || step === 12) { hit(t, 'bandpass', 1500, .7, .14, .16); clang(t, .02); } if (step % 2 === 0) hit(t, 'highpass', 6000, .7, .03, .04); }
  }
  function play(sg, step, bar, t, sp) { const ci = bar % sg.chords.length, ch = sg.chords[ci], h = Math.max(sg.minHeat || 0, S.mode === 'menu' ? 0 : S.heat), style = sg.drums || 'none', beat = style !== 'none';
    if (step === 0) { for (const m of ch) { osc(sg.pad || 'sawtooth', hz(m), t, sp * 15, sg.padVol, sp * 1.5, sg.padCut || 900, -6); osc(sg.pad || 'sawtooth', hz(m), t, sp * 15, sg.padVol, sp * 1.5, sg.padCut || 900, 6); }
      if (!beat) osc('triangle', hz(sg.bass[ci]), t, sp * 14, .12, .05, 0); }
    if (beat) {
      if (sg.bassPulse ? true : step % 2 === 0) { if (step % 2 === 0 || h > .5) osc(sg.bassPulse ? 'square' : 'triangle', hz(sg.bass[ci] + (step % 8 === 6 ? 12 : 0)), t, sp * (sg.bassPulse ? .9 : 1.6), sg.bassPulse ? .05 : .11, .008, sg.bassPulse ? 500 : 0); }
      drums(style, step, t, h);
    }
    const a = sg.arp[step], arpOn = a >= 0 && (beat ? (h > .45 || step % 2 === 0) : true);
    if (arpOn) osc(sg.arpType || (beat ? 'square' : 'sine'), hz(ch[a % ch.length] + sg.arpOct + (a >= ch.length ? 12 : 0)), t, sp * (sg.arpLen || (beat ? 1.2 : 6)), sg.arpVol * (beat ? .6 + h * .6 : 1), .005, sg.arpCut || (beat ? 2200 : 0));
    // 선율: 두 마디 중 하나는 쉬고, 긴장도가 오르면 매 마디 연주
    if (sg.lead && (h > .35 || bar % 2 === 0)) { const L = sg.lead[ci % sg.lead.length], n = L[step];
      if (n !== null && n !== undefined) { let len = 1; while (step + len < 16 && L[step + len] === null) len++; osc(sg.leadType || 'triangle', hz(ch[0] + n), t, sp * Math.min(len, 6) * .9, sg.leadVol || .025, .02, sg.leadCut || 0, 0, null, sg.leadBend); } } }
  // 낮은 웅웅거림(포자군락·보스): 곡이 바뀔 때까지 이어진다
  function droneOn(m) { droneOff(); if (!m) return; const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = hz(m); o2.frequency.value = hz(m) * 1.005; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    lfo.frequency.value = .13; lg.gain.value = 60; lfo.connect(lg); lg.connect(lp.frequency); o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(bus); g.gain.value = .0001; g.gain.linearRampToValueAtTime(.05, ac.currentTime + 2);
    [o, o2, lfo].forEach(x => x.start()); S.drone = { nodes: [o, o2, lfo], g }; }
  function droneOff() { const d = S.drone; if (!d) return; S.drone = null; const t = ac.currentTime; d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(d.g.gain.value, t); d.g.gain.linearRampToValueAtTime(.0001, t + .6); d.nodes.forEach(x => x.stop(t + .7)); }

  function tick() { if (!S.song || S.fading) return; if (typeof document !== 'undefined' && document.hidden) { S.next = 0; return; } // 숨긴 탭에서는 쉬고, 돌아오면 이어서
    const sg = SONGS[S.song] || SONGS.game, sp = 60 / sg.bpm / 4; if (S.next < ac.currentTime) S.next = ac.currentTime + .05;
    while (S.next < ac.currentTime + .2) { play(sg, S.step, S.bar, S.next, sp); S.next += sp; if (++S.step >= 16) { S.step = 0; S.bar++; } } }
  function level() { return S.mode === 'off' ? 0 : S.vol; }
  function ramp(v, sec) { const t = ac.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(v, t + sec); }
  function begin(mode) { S.song = mode; S.step = 0; S.bar = 0; S.next = 0; droneOn((SONGS[mode] || {}).drone); }
  S.timer = setInterval(tick, 40);

  return {
    setMode(mode) { if (mode === S.mode) return; const was = S.mode; S.mode = mode; if (mode === 'off') { ramp(0, .6); droneOff(); return; }
      if (was === 'off' || !S.song) { begin(mode); ramp(level(), 1.2); return; }
      S.fading = true; ramp(0, .7); setTimeout(() => { S.fading = false; if (S.mode !== mode) return; begin(mode); ramp(level(), 1); }, 750); },
    setVolume(v) { S.vol = Math.max(0, Math.min(1, v)); stingOut.gain.value = S.vol; if (!S.fading) ramp(level(), .25); },
    setIntensity(v) { S.heat = Math.max(0, Math.min(1, v)); },
    // 짧은 알림 음악. 배경음악을 잠깐 줄였다가 되돌린다
    sting(name) { const st = RTS.MUSIC_STINGS[name]; if (!st || S.vol <= 0) return; const sp = 60 / st.bpm / 4, t0 = ac.currentTime + .05; let end = 0;
      for (const [at, m, len] of st.notes) { osc(st.type, hz(m), t0 + at * sp, len * sp, st.vol, .01, 2600, 0, stingOut); osc(st.type, hz(m), t0 + at * sp, len * sp, st.vol * .5, .01, 2600, 8, stingOut); end = Math.max(end, (at + len) * sp); }
      if (S.mode !== 'off' && !S.fading) { const t = ac.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(level() * .3, t + .1); out.gain.linearRampToValueAtTime(level(), t + end + .6); } },
    get mode() { return S.mode; },
    _tick: tick, // 시험용: 오프라인 렌더링에서 시간을 직접 진행시킬 때
    stop() { clearInterval(S.timer); droneOff(); ramp(0, .2); setTimeout(() => { try { out.disconnect(); stingOut.disconnect(); } catch (e) {} }, 300); },
  };
};
