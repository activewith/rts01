// node test/pocket.js — 건물과 지형 사이에 유닛이 갇히지 않는지(갇힌 곳 탈출)
const fs = require('fs'), path = require('path');
for (const f of ['engine/core','engine/map','engine/sim','engine/upgrade', 'engine/super','engine/market','engine/war','engine/diplomacy','engine/tribe','engine/ai','data/content','data/settings']) (0, eval)(fs.readFileSync(path.join(__dirname, '../src', f + '.js'), 'utf8'));
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const mk = () => RTS.createGame({ map: 'ridge', seed: 3, players: [{ faction: 'pioneers' }, { faction: 'ironclad', ai: 'normal' }] });
// 빈 땅 한 곳을 골라 ㄷ자 암벽을 만들고, 열린 쪽을 건물로 막는다. 안에 있던 유닛은 밖으로 나와야 한다
const area = G => { for (let y = 20; y < G.h - 20; y++) for (let x = 20; x < G.w - 20; x++) { let free = true;
  for (let dy = -4; dy <= 6 && free; dy++) for (let dx = -4; dx <= 6 && free; dx++) if (!RTS.walkable(G, x + dx, y + dy) || G.ents.some(e => !e.dead && Math.abs(e.x - x - dx) < 1.5 && Math.abs(e.y - y - dy) < 1.5)) free = false;
  if (free) return [x, y]; } };
{ const G = mk(), [x, y] = area(G);
  for (let i = 0; i < 4; i++) { G.tiles[y * G.w + x + i] = 1; G.tiles[(y + 3) * G.w + x + i] = 1; } // 위·아래 벽
  for (let i = 0; i < 4; i++) G.tiles[(y + i) * G.w + x] = 1; // 왼쪽 벽 → 안쪽 (x+1..x+3, y+1..y+2) 6칸, 오른쪽(x+4)이 열림
  const u = RTS.spawn(G, 'p_rifle', 0, x + 2.5, y + 1.5);
  ok(!RTS.pocketAt(G, x + 2, y + 1), '막기 전에는 열린 곳');
  const id = Object.keys(RTS.defs.entities).find(k => { const d = RTS.defs.entities[k]; return d.kind === 'building' && d.size && d.size[0] === 2 && d.size[1] === 2 && !d.placeOn; });
  RTS.spawn(G, id, 0, x + 5, y + 2); // 2×2 건물: (x+4..x+5, y+1..y+2) 칸을 차지해 입구를 막는다
  ok(RTS.pocketAt(G, x + 2, y + 1), '건물로 막으면 안쪽은 갇힌 곳');
  ok(!RTS.pocketAt(G, u.x | 0, u.y | 0), `안에 있던 유닛이 밖으로 나옴 (${u.x.toFixed(1)}, ${u.y.toFixed(1)})`);
  const s = RTS.openSpot(G, x + 2.5, y + 1.5); ok(!RTS.pocketAt(G, s.x | 0, s.y | 0), '생산·밀어내기 자리도 갇힌 곳을 피함');
  // 갇힌 곳에 억지로 넣고 움직이게 하면 막힘 감지 뒤 빠져나온다
  u.x = u.px = x + 2.5; u.y = u.py = y + 1.5; RTS.issue(G, u, { type: 'move', x: x + 12, y: y + 1.5 });
  for (let i = 0; i < 400; i++) { RTS.step(G); if (process.env.DBG && i % 20 === 0) console.log(i, u.x.toFixed(2), u.y.toFixed(2), JSON.stringify(u.order), u.stuck, u.stuckN, !!u.path, u.dead); }
  if (process.env.DBG) console.log("xy", x, y);
  ok(Math.hypot(u.x - x - 12, u.y - y - 1.5) < 2.5, `갇힌 유닛에게 이동 명령을 주면 빠져나와 목적지 도착 (${u.x.toFixed(1)}, ${u.y.toFixed(1)})`); }
console.log(bad ? `실패 ${bad}` : '갇힘 방지 검사 통과'); process.exit(bad ? 1 : 0);
