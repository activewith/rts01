// music.js — 배경음악. 외부 소리 파일 없이 WebAudio로 그 자리에서 합성한다. DOM 없음.
// const m = RTS.Music(audioContext); m.setMode('menu'|'game'|'off'); m.setIntensity(0~1); m.setVolume(0~1); m.stop();
// 곡은 SONGS에 데이터로 추가한다. 음은 MIDI 번호(60 = 가운데 도), 한 칸은 16분음표.
RTS.MUSIC_SONGS = {
  // 메뉴: 느리고 넓은 화음, 드럼 없음
  menu: { bpm: 72, steps: 16, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: [45, 41, 36, 43],
    arp: [0, -1, -1, -1, 1, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1], arpOct: 12, padVol: .05, arpVol: .022, drums: false },
  // 전투: 빠른 박, 긴장도에 따라 킥·스네어·16분 아르페지오가 더해진다
  game: { bpm: 112, steps: 16, chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59], [50, 53, 57], [53, 57, 60], [52, 56, 59], [52, 56, 59]],
    bass: [45, 41, 43, 40, 38, 41, 40, 40], arp: [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 0, 2, 1, 2], arpOct: 12, padVol: .032, arpVol: .018, drums: true },
};
RTS.Music = function (ac) {
  const SONGS = RTS.MUSIC_SONGS, hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const out = ac.createGain(); out.gain.value = 0; out.connect(ac.destination);
  const bus = ac.createGain(); bus.gain.value = 1; bus.connect(out);
  // 가벼운 메아리(딜레이)로 공간감
  const dly = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain(); fb.gain.value = .25; wet.gain.value = .18;
  bus.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(out);
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = noise.getChannelData(0); let seed = 7;
  for (let i = 0; i < nd.length; i++) { seed = (seed * 16807) % 2147483647; nd[i] = seed / 1073741823.5 - 1; }
  const S = { mode: 'off', song: null, step: 0, bar: 0, next: 0, vol: .5, heat: 0, timer: 0, fading: false };

  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function osc(type, f, t, dur, peak, a, cut, detune) { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
    let node = o; if (cut) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut; o.connect(lp); node = lp; }
    node.connect(g); g.connect(bus); env(g, t, a, peak, dur); o.start(t); o.stop(t + a + dur + .05); }
  function hit(t, type, f, q, peak, dur) { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    s.connect(fl); fl.connect(g); g.connect(bus); env(g, t, .002, peak, dur); s.start(t); s.stop(t + dur + .05); }
  function kick(t) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); o.connect(g); g.connect(bus); env(g, t, .003, .38, .26); o.start(t); o.stop(t + .32); }

  function play(sg, step, bar, t, sp) { const ci = bar % sg.chords.length, ch = sg.chords[ci], h = S.mode === 'game' ? S.heat : 0;
    if (step === 0) { for (const m of ch) { osc('sawtooth', hz(m), t, sp * 15, sg.padVol, sp * 1.5, 900, -6); osc('sawtooth', hz(m), t, sp * 15, sg.padVol, sp * 1.5, 900, 6); }
      if (!sg.drums) osc('triangle', hz(sg.bass[ci]), t, sp * 14, .12, .05, 0); }
    if (sg.drums) {
      if (step % 2 === 0) osc('triangle', hz(sg.bass[ci] + (step % 8 === 6 ? 12 : 0)), t, sp * 1.6, .11, .008, 0); // 8분음 베이스
      if (step % 2 === 0) hit(t, 'highpass', 7000, .7, step % 4 === 2 ? .045 : .025, .04);
      if (h > .25 && (step === 0 || step === 8 || (h > .7 && step === 10))) kick(t);
      if (h > .55 && (step === 4 || step === 12)) { hit(t, 'bandpass', 1800, .9, .12, .12); osc('triangle', 190, t, .08, .06, .002, 0); }
    }
    const a = sg.arp[step], arpOn = a >= 0 && (sg.drums ? (h > .45 || step % 2 === 0) : true);
    if (arpOn) osc(sg.drums ? 'square' : 'sine', hz(ch[a % ch.length] + sg.arpOct + (a >= ch.length ? 12 : 0)), t, sp * (sg.drums ? 1.2 : 6), sg.arpVol * (sg.drums ? .6 + h * .6 : 1), .005, sg.drums ? 2200 : 0); }

  function tick() { if (!S.song || S.fading) return; if (typeof document !== 'undefined' && document.hidden) { S.next = 0; return; } // 숨긴 탭에서는 쉬고, 돌아오면 이어서
    const sg = SONGS[S.song], sp = 60 / sg.bpm / 4; if (S.next < ac.currentTime) S.next = ac.currentTime + .05;
    while (S.next < ac.currentTime + .2) { play(sg, S.step, S.bar, S.next, sp); S.next += sp; if (++S.step >= sg.steps) { S.step = 0; S.bar++; } } }
  function level() { return S.mode === 'off' ? 0 : S.vol; }
  function ramp(v, sec) { const t = ac.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(v, t + sec); }
  S.timer = setInterval(tick, 40);

  return {
    setMode(mode) { if (mode === S.mode) return; const was = S.mode; S.mode = mode; if (mode === 'off') { ramp(0, .6); return; }
      if (was === 'off' || !S.song) { S.song = mode; S.step = 0; S.bar = 0; S.next = 0; ramp(level(), 1.2); return; }
      S.fading = true; ramp(0, .7); setTimeout(() => { S.fading = false; if (S.mode !== mode) return; S.song = mode; S.step = 0; S.bar = 0; S.next = 0; ramp(level(), 1); }, 750); },
    setVolume(v) { S.vol = Math.max(0, Math.min(1, v)); if (!S.fading) ramp(level(), .25); },
    setIntensity(v) { S.heat = Math.max(0, Math.min(1, v)); },
    get mode() { return S.mode; },
    stop() { clearInterval(S.timer); ramp(0, .2); setTimeout(() => { try { out.disconnect(); } catch (e) {} }, 300); },
  };
};
