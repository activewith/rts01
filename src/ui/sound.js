// sound.js — 효과음과 캐릭터 음성. 외부 소리 파일 없이 WebAudio로 합성한다. DOM 없음, 게임 계산과 무관(화면 쪽에서만 부른다).
// const snd = RTS.Sound(audioContext, () => ({ sfx: 0~2, speech: 0~2, low: 저사양 })); snd.sfx(이름, 진영); snd.say(말하는 사람, 대사, 진영); snd.ack(진영, 크기, 종류); snd.stop();
// 음성: 녹음 파일 대신 대사의 한글 모음(ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ ㅔ ㅐ…)을 읽어 그 모음의 소리 모양(포먼트 F1·F2)을 가진 음절을 차례로 낸다.
//   알아들을 수 있는 말은 아니지만 말의 길이·리듬·높낮이가 대사를 따라가고, 캐릭터마다 목소리(높이·속도·음색)가 다르다.
//   기기 음성으로 실제 문장을 읽게 하려면 설정 '대사 읽기(기기 음성)'를 켠다(RTS.speakTTS, 브라우저 speechSynthesis).
// 목소리 바탕: src(소리 바탕), pitch(Hz), range(문장 안 높낮이 폭), rate(초당 음절), formant(포먼트 배율: 클수록 작은 몸), noise(숨소리·바람), robot(기계음: 높이를 계단으로, 고리 변조), warble(떨림)
RTS.VOICES = {
  pioneers: { src: 'sawtooth', pitch: 150, range: 45, rate: 11, formant: 1, noise: .18 },
  ironclad: { src: 'square', pitch: 100, range: 18, rate: 9.5, formant: .85, noise: .05, robot: 70 },
  swarm: { src: 'sawtooth', pitch: 380, range: 140, rate: 15, formant: 1.45, noise: .5, warble: 28 },
  tribe: { src: 'sawtooth', pitch: 115, range: 35, rate: 8.5, formant: .95, noise: .3 },
  heart: { src: 'sawtooth', pitch: 58, range: 20, rate: 6, formant: .7, noise: .35, warble: 4, echo: true },
};
// 캐릭터별 목소리: 바탕(base) 위에 덮어쓴다. 없는 이름은 이름에 든 진영으로 고른다
RTS.VOICE_CAST = {
  '대장 한별': { base: 'pioneers', pitch: 118, range: 35 }, '기술병 미르': { base: 'pioneers', pitch: 215, rate: 13, formant: 1.18 },
  '정찰병 다온': { base: 'pioneers', pitch: 170, rate: 12.5 }, '공병 반장 두리': { base: 'pioneers', pitch: 135, rate: 10, noise: .3 },
  '족장 바루': { base: 'tribe' }, '지휘관 벨카': { base: 'ironclad', pitch: 82, rate: 8.5 }, '연산핵 오르도': { base: 'ironclad', pitch: 130, range: 0, rate: 11, robot: 110, formant: 1 },
  '여왕 세라': { base: 'swarm', pitch: 260, range: 90, rate: 10, noise: .6, warble: 12, formant: 1.2 }, '감응체 울림': { base: 'swarm', pitch: 470, rate: 14 },
  '잿빛 심장': { base: 'heart' }, '???': { base: 'heart', pitch: 70 },
  '철갑회 통신': { base: 'ironclad', radio: true }, '개척단 통신': { base: 'pioneers', pitch: 140, radio: true },
};
RTS.voiceOf = function (who, faction) {
  const c = RTS.VOICE_CAST[who]; let base = c && c.base;
  if (!base) base = /철갑/.test(who || '') ? 'ironclad' : /포자/.test(who || '') ? 'swarm' : /개척/.test(who || '') ? 'pioneers' : faction || 'pioneers';
  const v = Object.assign({}, RTS.VOICES[base] || RTS.VOICES.pioneers, c || {});
  if (/홀린/.test(who || '')) Object.assign(v, { pitch: v.pitch * .7, echo: true, warble: (v.warble || 0) + 6 }); // 심장에 홀린 자: 낮고 울린다
  return v;
};
// 한글 모음 21개 → 포먼트(F1, F2, Hz, 성인 기준). 겹모음은 앞소리를 짧게 미끄러뜨린다(glide)
RTS.VOWEL_F = [[800, 1250], [700, 1750], [650, 1900], [650, 1850], [600, 1000], [500, 1900], [520, 1150], [500, 1900], [450, 800], [700, 1300], [650, 1600], [500, 1700], [450, 800], [350, 750], [550, 1050], [480, 1850], [350, 1950], [350, 750], [350, 1400], [350, 1700], [300, 2250]];
const VOWEL_GLIDE = { 2: 20, 3: 20, 6: 20, 7: 20, 9: 20, 10: 20, 11: 20, 12: 20, 14: 13, 15: 13, 16: 13, 17: 20, 19: 18 }; // ㅑ ㅒ ㅕ ㅖ ㅘ ㅙ ㅚ ㅛ ㅝ ㅞ ㅟ ㅠ ㅢ: 앞이 ㅣ/ㅜ/ㅡ
// 대사 → 음절 목록 [{ v(모음 번호), on(첫소리 있음), fin(받침 있음), pause }]
RTS.syllables = function (text, max) { const out = [];
  for (const ch of String(text || '')) { const c = ch.charCodeAt(0);
    if (c >= 0xAC00 && c <= 0xD7A3) { const k = c - 0xAC00; out.push({ v: Math.floor((k % 588) / 28), on: Math.floor(k / 588) !== 11, fin: k % 28 > 0, cons: Math.floor(k / 588) });
    } else if (/[.,!?…~]/.test(ch)) { if (out.length) out[out.length - 1].pause = ch === ',' ? .12 : .22; if (ch === '?' && out.length) out[out.length - 1].ask = true; }
    else if (/[A-Za-z0-9]/.test(ch)) out.push({ v: [0, 5, 20, 8, 13][c % 5], on: true, fin: false, cons: c % 19 });
    if (out.length >= (max || 40)) break; }
  return out; };

RTS.Sound = function (ac, opt) {
  const o = () => opt() || {}, master = ac.createGain(); master.connect(ac.destination);
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), nd = noise.getChannelData(0); let seed = 11;
  for (let i = 0; i < nd.length; i++) { seed = (seed * 16807) % 2147483647; nd[i] = seed / 1073741823.5 - 1; }
  // 메아리(심장 목소리)
  const echo = ac.createDelay(1), efb = ac.createGain(), ewet = ac.createGain(); echo.delayTime.value = .28; efb.gain.value = .35; ewet.gain.value = .5; echo.connect(efb); efb.connect(echo); echo.connect(ewet); ewet.connect(master);
  let busy = 0; const cap = () => (o().low ? 8 : 20); // 동시에 나는 효과음 수 제한(느린 기기 보호)
  const hold = sec => { busy++; setTimeout(() => { busy--; }, sec * 1000 + 50); };
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(type, f, f2, t, dur, peak, cut, dest) { const x = ac.createOscillator(), g = ac.createGain(); x.type = type; x.frequency.setValueAtTime(f, t); if (f2 && f2 !== f) x.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    let n = x; if (cut) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut; x.connect(lp); n = lp; } n.connect(g); g.connect(dest || master); env(g, t, .002, peak, dur); x.start(t); x.stop(t + dur + .05); }
  function hiss(type, f, f2, q, t, dur, peak, dest) { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise; fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    s.connect(fl); fl.connect(g); g.connect(dest || master); env(g, t, .002, peak, dur); s.start(t, Math.random() * .8); s.stop(t + dur + .05); }

  // ── 효과음 ── 이름 → (시각, 크기) 함수. 진영별 무기 소리는 FAC_SFX가 고른다
  const L = {
    gun: (t, v) => { hiss('bandpass', 2200, 900, 1.2, t, .06, .16 * v); tone('square', 520, 160, t, .04, .03 * v, 2400); },
    zap: (t, v) => { tone('sawtooth', 1700, 280, t, .09, .04 * v, 3500); hiss('highpass', 5000, 0, .7, t, .03, .05 * v); },
    spit: (t, v) => { hiss('bandpass', 700, 1800, 4, t, .1, .2 * v); tone('sine', 300, 700, t, .07, .05 * v); },
    slash: (t, v) => { hiss('bandpass', 3000, 1200, 2, t, .07, .12 * v); },
    blade: (t, v) => { tone('square', 1240, 1180, t, .08, .03 * v, 4200); tone('square', 1873, 1800, t, .06, .02 * v, 4200); },
    claw: (t, v) => { hiss('highpass', 2500, 4000, 1.5, t, .05, .14 * v); hiss('highpass', 2500, 4000, 1.5, t + .045, .04, .1 * v); },
    thump: (t, v) => { tone('triangle', 190, 55, t, .16, .09 * v); hiss('lowpass', 900, 200, .7, t, .14, .12 * v); },
    boom: (t, v) => { hiss('lowpass', 1400, 120, .8, t, .32, .3 * v); tone('sine', 110, 35, t, .3, .14 * v); },
    bigboom: (t, v) => { hiss('lowpass', 1800, 80, .7, t, .8, .4 * v); tone('sine', 80, 24, t, .7, .2 * v); hiss('bandpass', 400, 120, 1, t + .08, .5, .16 * v); },
    click: (t, v) => tone('sine', 640, 760, t, .05, .04 * v),
    warn: (t, v) => tone('square', 330, 250, t, .16, .03 * v, 2000),
    ok: (t, v) => tone('sine', 520, 780, t, .12, .05 * v),
    alarm: (t, v) => { tone('square', 660, 660, t, .12, .03 * v, 1800); tone('square', 495, 495, t + .14, .14, .03 * v, 1800); },
    built: (t, v) => { tone('triangle', 523, 0, t, .12, .06 * v); tone('triangle', 784, 0, t + .1, .2, .06 * v); },
    research: (t, v) => { [523, 659, 784, 1046].forEach((f, i) => tone('sine', f, 0, t + i * .07, .14, .045 * v)); },
    trainP: (t, v) => { tone('triangle', 880, 0, t, .1, .05 * v); tone('triangle', 1175, 0, t + .08, .14, .04 * v); },
    trainI: (t, v) => { tone('square', 990, 990, t, .05, .025 * v, 3000); tone('square', 990, 990, t + .09, .05, .025 * v, 3000); },
    trainS: (t, v) => { tone('sine', 300, 900, t, .12, .06 * v); hiss('bandpass', 900, 400, 5, t, .12, .1 * v); },
    morph: (t, v) => { tone('sine', 200, 600, t, .3, .06 * v); hiss('bandpass', 500, 1500, 3, t, .3, .1 * v); },
    merge: (t, v) => { tone('sawtooth', 220, 880, t, .45, .04 * v, 2500); tone('sine', 1320, 0, t + .4, .3, .05 * v); },
    heal: (t, v) => tone('sine', 1046, 1318, t, .12, .025 * v),
  };
  const FAC_SFX = { shot: { pioneers: 'gun', ironclad: 'zap', swarm: 'spit' }, slash: { pioneers: 'slash', ironclad: 'blade', swarm: 'claw' }, trained: { pioneers: 'trainP', ironclad: 'trainI', swarm: 'trainS' } };
  const DUR = { bigboom: .9, boom: .4, merge: .8, research: .4, morph: .35 };

  function sfx(k, faction) { const v = o().sfx; if (!(v > 0) || busy >= cap()) return; const name = (FAC_SFX[k] && FAC_SFX[k][faction]) || (FAC_SFX[k] && FAC_SFX[k].pioneers) || k, f = L[name]; if (!f) return;
    hold(DUR[name] || .2); f(ac.currentTime + .005, v); }

  // ── 음성 ──
  let talk = { until: 0, nodes: [] };
  function stopTalk() { for (const n of talk.nodes) try { n.stop(); } catch (e) {} talk = { until: 0, nodes: [] }; }
  // 음절 목록을 목소리 V로 낸다. t0부터 시작, 끝나는 시각을 돌려준다
  function speak(sy, V, t0, vol, keep) { if (!sy.length || !(vol > 0)) return t0; const dest = ac.createGain(); dest.gain.value = vol; dest.connect(master);
    let out = dest; if (V.radio) { const hp = ac.createBiquadFilter(), lp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500; lp.type = 'lowpass'; lp.frequency.value = 2600; hp.connect(lp); lp.connect(dest); out = hp; }
    if (V.echo) dest.connect(echo);
    const src = ac.createOscillator(); src.type = V.src; const vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = V.warble ? 7 : 5; vg.gain.value = V.warble || 2.5; vib.connect(vg); vg.connect(src.frequency);
    let voice = src; if (V.robot) { const ring = ac.createGain(), rm = ac.createOscillator(); rm.type = 'square'; rm.frequency.value = V.robot; ring.gain.value = 0; rm.connect(ring.gain); src.connect(ring); voice = ring; rm.start(t0); rm.stop(t0 + 30); keep.push(rm); }
    const amp = ac.createGain(); amp.gain.value = 0; const f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), f3 = ac.createBiquadFilter(); [f1, f2, f3].forEach(f => { f.type = 'bandpass'; f.Q.value = 7; });
    f3.frequency.value = 2700 * V.formant; const g1 = ac.createGain(), g2 = ac.createGain(), g3 = ac.createGain(); g1.gain.value = 1.4; g2.gain.value = .9; g3.gain.value = .25;
    voice.connect(f1); voice.connect(f2); voice.connect(f3); f1.connect(g1); f2.connect(g2); f3.connect(g3); [g1, g2, g3].forEach(g => g.connect(amp)); amp.connect(out);
    // 숨소리: 같은 포먼트를 거친 잡음(포자군락은 많이)
    const ns = ac.createBufferSource(); ns.buffer = noise; ns.loop = true; const ng = ac.createGain(); ng.gain.value = (V.noise || 0) * .5; ns.connect(ng); ng.connect(f1); ng.connect(f2);
    const per = 1 / V.rate, n = sy.length; let t = t0;
    sy.forEach((s, i) => { const F = RTS.VOWEL_F[s.v], d = per * (s.fin ? 1.15 : .95) * (.9 + Math.random() * .2), k = n > 1 ? i / (n - 1) : 0;
      // 문장 높낮이: 처음에 조금 높고 끝으로 내려간다(물음표면 끝을 올린다)
      let p = V.pitch * (1 + (V.range / V.pitch) * (.5 - k) * .8 + (Math.random() - .5) * (V.range / V.pitch) * .5); if (s.ask && i === n - 1) p *= 1.3; if (V.robot) p = Math.round(p / 20) * 20;
      src.frequency.setValueAtTime(p, t); if (!V.robot) src.frequency.linearRampToValueAtTime(p * .96, t + d);
      const gl = VOWEL_GLIDE[s.v], A = gl !== undefined ? RTS.VOWEL_F[gl] : F;
      f1.frequency.setValueAtTime(A[0] * V.formant, t); f2.frequency.setValueAtTime(A[1] * V.formant, t); f1.frequency.linearRampToValueAtTime(F[0] * V.formant, t + d * .35); f2.frequency.linearRampToValueAtTime(F[1] * V.formant, t + d * .35);
      amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(.5, t + d * .18); amp.gain.setValueAtTime(.5, t + d * .65); amp.gain.linearRampToValueAtTime(0.0001, t + d * (s.fin ? .92 : .98));
      if (s.on && s.cons !== 11) { const hard = [0, 3, 7, 12, 15, 16, 17].includes(s.cons), sib = [9, 10, 12, 13, 14, 18].includes(s.cons); // 첫소리: 터지는 소리·스치는 소리
        hiss(sib ? 'highpass' : 'bandpass', sib ? 4200 : hard ? 2400 : 1500, 0, 1, t, sib ? .05 : .025, (sib ? .07 : hard ? .1 : .04) * vol, out); }
      t += d + (s.pause || 0); });
    [src, vib, ns].forEach(x => { x.start(t0); x.stop(t + .1); keep.push(x); });
    return t; }
  // 이야기 대사: 말하는 사람 목소리로. 기기 음성(TTS)을 쓰면 그쪽이 읽는다
  function say(who, text, faction) { const v = o().speech; if (!(v > 0)) return 0; stopTalk(); const V = RTS.voiceOf(who, faction), keep = [];
    const end = speak(RTS.syllables(text, 34), V, ac.currentTime + .03, .55 * v, keep); talk = { until: end, nodes: keep }; return end - ac.currentTime; }
  // 유닛 대답(고를 때·명령할 때): 2~3음절. size가 클수록 낮은 목소리. 이야기 대사 중에는 내지 않는다
  let ackT = 0; const ACK = { select: [[0, 13], [5, 0], [4, 8, 0], [20, 0]], move: [[8, 4], [0, 8], [13, 0, 4]], attack: [[0, 0, 20], [4, 20, 0], [8, 0]] };
  function ack(faction, size, kind, force) { const v = o().speech; if (!(v > 0) || ac.currentTime < talk.until || (!force && ac.currentTime < ackT)) return; const V = Object.assign({}, RTS.VOICES[faction] || RTS.VOICES.pioneers);
    const s = Math.max(.6, Math.min(2.2, size || 1)); V.pitch /= Math.sqrt(s); V.formant /= Math.pow(s, .3); V.rate *= 1.25; if (kind === 'attack') { V.pitch *= 1.12; V.range *= 1.4; }
    const pick = ACK[kind] || ACK.select, vs = pick[Math.floor(Math.random() * pick.length)], keep = [];
    const end = speak(vs.map((x, i) => ({ v: x, on: i === 0 || Math.random() < .6, cons: [0, 2, 3, 6, 7, 9][Math.floor(Math.random() * 6)], fin: i === vs.length - 1 && Math.random() < .4, pause: 0 })), V, ac.currentTime + .02, .4 * v, keep);
    ackT = Math.max(ackT, end + .35); }
  // 유닛 대답을 낼 수 있는지(이야기 대사 중이거나 앞 대답이 끝나지 않았으면 안 됨). hold(sec)로 다음 대답까지 막는다
  const ackFree = () => ac.currentTime >= talk.until && ac.currentTime >= ackT;
  const ackHold = sec => { ackT = Math.max(ackT, ac.currentTime + sec); };
  // 녹음 파일(유닛 대답): 미리 받아서 풀어 둔다. 실패한 파일은 null로 기억하고 다시 받지 않는다
  const clips = {};
  function preload(urls) { if (typeof fetch === 'undefined') return; for (const url of urls) { if (url in clips) continue; clips[url] = undefined;
      fetch(url).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(b => new Promise((ok, no) => ac.decodeAudioData(b, ok, no))).then(buf => { clips[url] = buf; }, () => { clips[url] = null; }); } }
  // 받아 둔 파일이면 재생하고 길이(초)를 돌려준다. 아직 없으면 0
  function clip(url, vol) { const buf = clips[url], v = o().speech; if (!buf || !(v > 0)) return 0; const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = buf; g.gain.value = Math.min(2, (vol || 1) * v); s.connect(g); g.connect(master); s.start(ac.currentTime + .01); ackHold(buf.duration + .3); return buf.duration; }
  return { sfx, say, ack, ackFree, ackHold, preload, clip, stopTalk, talking: () => ac.currentTime < talk.until, stop() { stopTalk(); try { master.disconnect(); } catch (e) {} } };
};
// 기기 음성으로 대사 읽기(설정 '대사 읽기'). 한국어 음성이 없으면 false
RTS.speakTTS = function (who, text, faction, vol) { const S = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null; if (!S) return false;
  const ko = S.getVoices().filter(v => /^ko/i.test(v.lang)); if (!ko.length) return false; const V = RTS.voiceOf(who, faction), u = new SpeechSynthesisUtterance(String(text).replace(/[()]/g, ' '));
  u.lang = 'ko-KR'; u.voice = ko[0]; u.pitch = Math.max(0, Math.min(2, V.pitch / 150)); u.rate = Math.max(.6, Math.min(1.6, V.rate / 11)); u.volume = Math.max(0, Math.min(1, vol)); S.cancel(); RTS.ttsStory = true; u.onend = u.onerror = () => { RTS.ttsStory = false; }; S.speak(u); return true; };
// 개척단 유닛 대답을 기기 음성으로(녹음 파일이 없을 때). 이야기 대사를 읽는 중이면 끊지 않고 false. size가 클수록 낮게
RTS.speakUnit = function (text, size, vol) { const S = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null; if (!S || RTS.ttsStory) return false;
  const ko = S.getVoices().filter(v => /^ko/i.test(v.lang)); if (!ko.length) return false; const u = new SpeechSynthesisUtterance(String(text).replace(/[…]/g, ' ')), k = Math.max(.6, Math.min(2.6, size || 1));
  u.lang = 'ko-KR'; u.voice = ko[0]; u.pitch = Math.max(.3, Math.min(1.6, 1.15 / Math.sqrt(k))); u.rate = 1.15; u.volume = Math.max(0, Math.min(1, vol)); S.cancel(); S.speak(u); return true; };
