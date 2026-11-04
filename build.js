// node build.js → 저장소 맨 위 index.html 생성. GitHub Pages가 이 파일을 그대로 서비스한다.
const fs = require('fs');
const order = ['engine/core', 'engine/map', 'engine/sim', 'engine/market', 'engine/diplomacy', 'engine/ai', 'data/content', 'ui/render', 'ui/app'];
const js = order.map(f => fs.readFileSync(`src/${f}.js`, 'utf8')).join('\n');
const page = fs.readFileSync('src/index.template.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
const i = page.indexOf('<div id="kr-app">');
const html = '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  + page.slice(0, i) + '</head>\n<body>\n' + page.slice(i) + '\n</body>\n</html>\n';
fs.writeFileSync('index.html', html);
console.log('index.html', Math.round(fs.statSync('index.html').size / 1024) + 'KB');
