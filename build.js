// node build.js → 저장소 맨 위 index.html 생성. GitHub Pages가 이 파일을 그대로 서비스한다.
const fs = require('fs');
const order = ['engine/core', 'engine/map', 'engine/sim', 'engine/upgrade', 'engine/super', 'engine/market', 'engine/war', 'engine/diplomacy', 'engine/tribe', 'engine/ai', 'engine/net', 'engine/campaign', 'data/content', 'data/settings', 'data/campaign', 'data/learn', 'data/voicelines', 'ui/terrain', 'ui/render', 'ui/unitart', 'ui/superart', 'ui/buildart', 'ui/build3d', 'ui/glfx', 'ui/music', 'ui/sound', 'ui/app'];
const src = order.map(f => fs.readFileSync(`src/${f}.js`, 'utf8')).join('\n');
// 빌드 버전: 소스 내용의 해시. 둘이 대전 대기실에서 두 기기의 버전이 같은지 비교한다.
const build = require('crypto').createHash('sha1').update(src).digest('hex').slice(0, 7);
// 유닛 대답 녹음 파일: voice 폴더에 있는 파일만 목록으로 넣는다(없으면 기기 음성·합성 음성으로 대신한다)
const AUDIO = /^(p_[a-z]+-(select|move|attack)-\d+)\.(mp3|m4a|ogg|wav)$/;
const voice = {}; if (fs.existsSync('voice')) for (const f of fs.readdirSync('voice').sort()) { const m = f.match(AUDIO); if (m) voice[m[1]] = 'voice/' + f; }
const js = `(globalThis.RTS = globalThis.RTS || {}).BUILD = '${build}';\nglobalThis.RTS.VOICE_FILES = ${JSON.stringify(voice)};\n` + src;
const page = fs.readFileSync('src/index.template.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
const i = page.indexOf('<div id="kr-app">');
const html = '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  + page.slice(0, i) + '</head>\n<body>\n' + page.slice(i) + '\n</body>\n</html>\n';
fs.writeFileSync('index.html', html);
console.log('index.html', Math.round(fs.statSync('index.html').size / 1024) + 'KB', 'build ' + build, '유닛 녹음 ' + Object.keys(voice).length + '개');
