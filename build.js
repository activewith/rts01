// node build.js → 저장소 맨 위 index.html 생성. GitHub Pages가 이 파일을 그대로 서비스한다.
const fs = require('fs');
const order = ['engine/core', 'engine/map', 'engine/sim', 'engine/market', 'engine/war', 'engine/diplomacy', 'engine/ai', 'engine/net', 'data/content', 'data/settings', 'ui/render', 'ui/music', 'ui/app'];
const src = order.map(f => fs.readFileSync(`src/${f}.js`, 'utf8')).join('\n');
// 빌드 버전: 소스 내용의 해시. 둘이 대전 대기실에서 두 기기의 버전이 같은지 비교한다.
const build = require('crypto').createHash('sha1').update(src).digest('hex').slice(0, 7);
const js = `(globalThis.RTS = globalThis.RTS || {}).BUILD = '${build}';\n` + src;
const page = fs.readFileSync('src/index.template.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
const i = page.indexOf('<div id="kr-app">');
const html = '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  + page.slice(0, i) + '</head>\n<body>\n' + page.slice(i) + '\n</body>\n</html>\n';
fs.writeFileSync('index.html', html);
console.log('index.html', Math.round(fs.statSync('index.html').size / 1024) + 'KB', 'build ' + build);
