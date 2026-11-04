// sim.js — 엔티티, 스탯, 명령, 이동, 전투, 생산, 승패. 규칙 대부분은 여기 있다.
const D = () => RTS.defs.entities;
const defOf = e => RTS.defs.entities[e.def];
RTS.defOf = defOf;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

RTS.spawn = function (G, defId, team, x, y) {
  const d = D()[defId];
  const e = { id: G.nextId++, def: defId, team, x, y, px: x, py: y, hp: d.hp || 1, facing: 1.57, cd: 0, order: null, queue: [], buffs: [], cds: {} };
  if (d.kind === 'building') { e.buildT = Math.round((d.time || 10) * RTS.HZ); e.built = 0; e.prod = []; e.rally = null; e.hp = Math.max(1, d.hp * .1); }
  if (d.kind === 'unit') { e.cargo = 0; e.cargoType = null; e.path = null; e.pathI = 0; e.dest = null; e.destEnt = 0; e.needPath = false; e.stuck = 0; e.stuckN = 0; }
  G.ents.push(e); G.byId[e.id] = e;
  if (d.size) RTS.occupy(G, e, e.id);
  if (d.kind === 'unit' && team >= 0) e.hp = RTS.stat(G, e, 'hp');
  return e;
};
RTS.complete = e => defOf(e).kind !== 'building' || e.built >= e.buildT;

// ── 스탯: 정의값 + 업그레이드(team.mods 캐시) + 버프 ──────────
function modded(G, teamId, d, name, base) {
  const t = G.teams[teamId]; if (!t) return base;
  const key = d.id + ':' + name;
  let m = t.mods[key];
  if (!m) { m = { add: 0, mul: 1 };
    for (const uid of Object.keys(t.upgrades)) for (const fx of RTS.defs.upgrades[uid].effects || []) {
      if (fx.stat !== name || !(fx.tag === '*' || fx.id === d.id || (d.tags || []).includes(fx.tag))) continue;
      m.add += fx.add || 0; m.mul *= fx.mul || 1;
    }
    t.mods[key] = m; }
  return (base + m.add) * m.mul;
}
RTS.stat = function (G, e, name) {
  const d = defOf(e); let v = modded(G, e.team, d, name, d[name] || 0);
  for (const b of e.buffs || []) if (b.mods && b.mods[name]) v *= b.mods[name];
  return v;
};
RTS.weapon = e => { const d = defOf(e); return (e.sieged && d.siegeWeapon) || d.weapon || null; };
RTS.wStat = function (G, e, w, name) {
  let v = modded(G, e.team, defOf(e), name, w[name] || 0);
  for (const b of e.buffs || []) if (b.mods && b.mods[name]) v *= b.mods[name];
  return v;
};
RTS.edgeDist = function (a, b) { // a 중심에서 b 가장자리까지
  const da = defOf(a), db = defOf(b), ra = da.r || 0;
  if (db.size) { const r = RTS.rectOf(b), cx = Math.max(r.x0, Math.min(a.x, r.x0 + r.w)), cy = Math.max(r.y0, Math.min(a.y, r.y0 + r.h)); return Math.max(0, Math.hypot(a.x - cx, a.y - cy) - ra); }
  return Math.max(0, dist(a, b) - ra - (db.r || 0));
};
RTS.canHit = (w, t) => { const air = !!defOf(t).air; return air ? w.air !== false : w.ground !== false; };

// ── 명령 ───────────────────────────────────────────────────
RTS.issue = function (G, u, order, queue) {
  if (queue && (u.order || u.queue.length)) { u.queue.push(order); return; }
  releaseNode(G, u); u.queue.length = 0; u.order = order; u.stuckN = 0;
  if (!order) stopMove(u);
};
function nextOrder(G, u) { releaseNode(G, u); u.order = u.queue.shift() || null; if (!u.order) stopMove(u); }
function stopMove(u) { u.path = null; u.dest = null; u.destEnt = 0; u.needPath = false; }
function moveTo(G, u, x, y) {
  if (u.dest && !u.destEnt && Math.abs(u.dest.x - x) + Math.abs(u.dest.y - y) < .2) return;
  u.dest = { x, y }; u.destEnt = 0; u.needPath = true;
}
function moveToEnt(G, u, t) {
  const fixed = !!defOf(t).size;
  if (u.destEnt === t.id && (u.path || u.needPath) && (fixed || G.tick - (u.pathT || 0) < 14)) return;
  if (u.destEnt === t.id && G.tick - (u.pathT || 0) < 10) return;
  u.dest = { x: t.x, y: t.y }; u.destEnt = t.id; u.needPath = true;
}
RTS.goTo = moveToEnt;
const arrived = u => !u.path && !u.needPath;
function releaseNode(G, u) { if (u.claim) { const n = G.byId[u.claim]; if (n && n.busy === u.id) n.busy = 0; u.claim = 0; } }

RTS.command = (G, team, cmd) => G.cmds.push(Object.assign({ team }, cmd));
const mine = (G, team, ids) => ids.map(i => G.byId[i]).filter(e => e && !e.dead && e.team === team);
function say(G, team, text, kind) { RTS.emit(G, 'notice', { team, text, kind }); }
const canPay = (t, c = {}) => Object.keys(c).every(k => (t.res[k] || 0) >= c[k]);
const pay = (t, c = {}, s = 1) => { for (const k of Object.keys(c)) t.res[k] = (t.res[k] || 0) - c[k] * s; };
RTS.canPay = canPay;
RTS.techOk = (t, d) => (d.requires || []).every(r => t.have[r] > 0 || t.upgrades[r]);
function lack(G, team, t, c = {}) { for (const k of Object.keys(c)) if ((t.res[k] || 0) < c[k]) { say(G, team, k === 'ore' ? '광석이 부족합니다' : '에테르가 부족합니다', 'warn'); return true; } return false; }

RTS.commands.order = function (G, team, c) {
  for (const u of mine(G, team, c.ids)) {
    if (defOf(u).kind !== 'unit' || defOf(u).uncontrollable) continue;
    if (!c.order) { RTS.issue(G, u, null); continue; }
    if (u.sieged && ['move', 'patrol'].includes(c.order.type)) continue;
    const pos = c.spread && c.spread[u.id];
    const o = Object.assign({}, c.order, pos ? { x: pos.x, y: pos.y } : null);
    if (o.type === 'patrol') { o.ax = u.x; o.ay = u.y; }
    RTS.issue(G, u, o, c.queue);
  }
};
RTS.commands.train = function (G, team, c) {
  const t = G.teams[team], b = G.byId[c.building], d = D()[c.unit];
  if (!b || b.dead || b.team !== team || !RTS.complete(b) || b.prod.length >= 5 || !RTS.techOk(t, d)) return;
  if (lack(G, team, t, d.cost)) return;
  pay(t, d.cost); b.prod.push({ kind: 'unit', id: c.unit, t: 0, total: Math.round(d.time * RTS.HZ), started: false });
};
RTS.commands.research = function (G, team, c) {
  const t = G.teams[team], b = G.byId[c.building], u = RTS.defs.upgrades[c.upgrade];
  if (!b || b.dead || b.team !== team || !RTS.complete(b) || t.upgrades[u.id] || t.research[u.id] || !RTS.techOk(t, u)) return;
  if (lack(G, team, t, u.cost)) return;
  pay(t, u.cost); t.research[u.id] = 1; b.prod.push({ kind: 'upgrade', id: u.id, t: 0, total: Math.round(u.time * RTS.HZ), started: true });
};
RTS.commands.cancel = function (G, team, c) {
  const t = G.teams[team], b = G.byId[c.building]; if (!b || b.team !== team) return;
  if (!RTS.complete(b)) { pay(t, defOf(b).cost, -.75); RTS.kill(G, b, null, true); return; }
  const p = b.prod.pop(); if (!p) return;
  pay(t, (p.kind === 'unit' ? D()[p.id] : RTS.defs.upgrades[p.id]).cost, -1);
  if (p.kind === 'upgrade') delete t.research[p.id];
};
RTS.commands.rally = function (G, team, c) { for (const b of mine(G, team, c.ids)) b.rally = { x: c.x, y: c.y, ent: c.ent || 0 }; };
RTS.commands.ability = function (G, team, c) {
  const ab = RTS.defs.abilities[c.ability];
  for (const u of mine(G, team, c.ids)) {
    if (!(defOf(u).abilities || []).includes(ab.id) || !RTS.abilityReady(G, u, ab)) continue;
    if (ab.target === 'point') { RTS.issue(G, u, { type: 'cast', ability: ab.id, x: c.x, y: c.y }); if (c.one) break; }
    else RTS.useAbility(G, u, ab, c);
  }
};
RTS.abilityReady = (G, u, ab) => (u.cds[ab.id] || 0) <= G.tick && (!ab.requires || G.teams[u.team].upgrades[ab.requires]);
RTS.useAbility = function (G, u, ab, c) { if (ab.use(G, u, c) !== false && ab.cooldown) u.cds[ab.id] = G.tick + Math.round(ab.cooldown * RTS.HZ); RTS.emit(G, 'ability', { e: u, ab }); };
RTS.addBuff = function (G, u, id, sec, mods) { u.buffs = u.buffs.filter(b => b.id !== id); u.buffs.push({ id, until: G.tick + Math.round(sec * RTS.HZ), mods }); };

RTS.canPlace = function (G, team, defId, tx, ty, margin = 0) {
  const d = D()[defId], [w, h] = d.size;
  if (d.placeOn) { const v = G.ents.find(e => e.def === d.placeOn && !e.dead && Math.round(e.x - 1) === tx && Math.round(e.y - 1) === ty); return v && !v.ext ? v : null; }
  for (let y = -margin; y < h + margin; y++) for (let x = -margin; x < w + margin; x++) if (!RTS.walkable(G, tx + x, ty + y)) return null;
  if (d.dropoff) for (const e of G.ents) if (e.team === -1 && !e.dead && RTS.edgeDist({ def: 'none_', x: tx + w / 2, y: ty + h / 2 }, e) < Math.max(w, h) / 2 + 1.5) return null;
  return true;
};
D().none_ = { id: 'none_', r: 0 };
RTS.commands.place = function (G, team, c) {
  const t = G.teams[team], d = D()[c.def], ws = mine(G, team, c.ids);
  if (!ws.length || !RTS.techOk(t, d)) return;
  const ok = RTS.canPlace(G, team, c.def, c.tx, c.ty);
  if (!ok) { say(G, team, '이 위치에는 건설할 수 없습니다', 'warn'); return; }
  if (lack(G, team, t, d.cost)) return;
  pay(t, d.cost);
  const site = RTS.spawn(G, c.def, team, c.tx + d.size[0] / 2, c.ty + d.size[1] / 2);
  if (d.placeOn) { site.vent = ok.id; ok.ext = site.id; }
  RTS.issue(G, ws[0], { type: 'build', site: site.id }, c.queue);
};

// ── 유닛 행동 핸들러. 새 명령은 RTS.orders.xxx 추가로 끝난다. ──
function fire(G, u, w, t) {
  u.facing = Math.atan2(t.y - u.y, t.x - u.x);
  u.cd = Math.round(RTS.wStat(G, u, w, 'cooldown') * RTS.HZ);
  u.firedAt = G.tick;
  const dmg = RTS.wStat(G, u, w, 'damage');
  RTS.emit(G, 'shot', { e: u, t, w });
  if (!w.speed) RTS.hit(G, t, t.x, t.y, dmg, w, u);
  else G.projectiles.push({ x: u.x, y: u.y, sx: u.x, sy: u.y, tx: t.x, ty: t.y, target: t.id, dmg, speed: w.speed, team: u.team, wdef: u.def, sieged: !!u.sieged, src: u.id, art: w.art || 'bolt' });
}
RTS.hit = function (G, t, x, y, dmg, w, src) {
  const team = src.team;
  if (w.splash) RTS.query(G, x, y, w.splash, o => {
    if (o.dead || o.team === team || o.team < 0 || !RTS.canHit(w, o)) return;
    const d = RTS.edgeDist({ def: 'none_', x, y }, o);
    if (d <= w.splash) RTS.damage(G, o, dmg * (d < w.splash / 2 ? 1 : .5), src);
  }); if (w.splash && t && t.team < 0 && !t.dead) RTS.damage(G, t, dmg, src); // 중립 회사 거점은 공간 해시에 없다
  if (!w.splash && t && !t.dead) RTS.damage(G, t, dmg + ((w.vs || {})[(defOf(t).tags || []).find(k => (w.vs || {})[k])] || 0), src);
  RTS.emit(G, 'impact', { x, y, w, team });
};
RTS.damage = function (G, t, dmg, src) {
  if (t.dead) return;
  const hpBefore = t.hp; t.hp -= Math.max(1, dmg - RTS.stat(G, t, 'armor')); t.hitAt = G.tick;
  if (t.branch) { if (t.hp <= 0) RTS.branchDown(G, t); else if (t.team >= 0) RTS.emit(G, 'attacked', { e: t, src }); return; }
  if (defOf(t).site) { RTS.siteHit(G, t, dmg, src); return; }
  if (t.team >= 0) { RTS.emit(G, 'attacked', { e: t, src }); RTS.warDamage(G, t, hpBefore - Math.max(0, t.hp), src); }
  if (src && !src.dead && defOf(t).kind === 'unit' && !t.order && RTS.weapon(t) && !defOf(t).passive) t.order = { type: 'amove', x: t.x, y: t.y };
  if (t.hp <= 0) RTS.kill(G, t, src);
};
RTS.kill = function (G, e, src, silent) {
  if (e.dead) return; e.dead = true;
  const d = defOf(e);
  if (d.size) { RTS.occupy(G, e, 0); if (e.vent) { const v = G.byId[e.vent]; if (v && !v.dead) { v.ext = 0; RTS.occupy(G, v, v.id); } } }
  if (d.kind === 'unit') releaseNode(G, e);
  if (e.team >= 0 && !silent) G.teams[e.team].stats.lost++;
  if (src && src.team >= 0 && !silent) G.teams[src.team].stats.kills++;
  if (d.kind === 'building') for (const p of e.prod || []) if (p.kind === 'upgrade') delete G.teams[e.team].research[p.id];
  if (!silent) RTS.emit(G, 'death', { e });
  if (d.dropoff && e.team >= 0 && !silent && RTS.complete(e) && !G.ents.some(o => !o.dead && o.team === e.team && defOf(o).dropoff && RTS.complete(o))) RTS.warFall(G, e.team);
};

RTS.scan = function (G, u, w, r) {
  let best = null, bs = -1e9;
  RTS.query(G, u.x, u.y, r, t => {
    if (t.dead || t.team === u.team || t.team < 0 || t.downUntil > G.tick || !RTS.canHit(w, t)) return;
    const d = RTS.edgeDist(u, t); if (d > r) return;
    const td = defOf(t), s = (td.weapon ? (td.kind === 'unit' ? 3 : 2.4) : td.kind === 'unit' ? 2 : 1) * 100 - d * 8;
    if (s > bs) { bs = s; best = t; }
  });
  return best;
};
function engage(G, u, t, chase) {
  const w = RTS.weapon(u); if (!w || !RTS.canHit(w, t)) return false;
  const rng = RTS.wStat(G, u, w, 'range');
  if (RTS.edgeDist(u, t) <= rng + .05) {
    stopMove(u); u.facing = Math.atan2(t.y - u.y, t.x - u.x);
    if (u.cd <= 0) fire(G, u, w, t);
    return true;
  }
  if (chase) moveToEnt(G, u, t);
  return chase;
}
function autoTarget(G, u) {
  const w = RTS.weapon(u); if (!w) return null;
  const cur = u.tgt && G.byId[u.tgt];
  if (cur && !cur.dead && RTS.edgeDist(u, cur) <= (defOf(u).aggro || 8) + 2 && (G.tick + u.id) % 12) return cur;
  if ((G.tick + u.id) % 6 && !cur) return null;
  const t = RTS.scan(G, u, w, Math.max(defOf(u).aggro || 8, RTS.wStat(G, u, w, 'range')));
  u.tgt = t ? t.id : 0; return t;
}
function tryHeal(G, u, chase) {
  const h = defOf(u).heal; if (!h) return false;
  const cur = u.tgt && G.byId[u.tgt];
  let t = cur && !cur.dead && cur.team === u.team && cur.hp < RTS.stat(G, cur, 'hp') ? cur : null;
  if (!t && (G.tick + u.id) % 8 === 0) {
    let bd = 1e9;
    RTS.query(G, u.x, u.y, 8, o => { if (o.dead || o.id === u.id || o.team !== u.team || defOf(o).kind !== 'unit' || !(defOf(o).tags || []).includes(h.tag) || o.hp >= RTS.stat(G, o, 'hp')) return; const d = dist(u, o); if (d < bd) { bd = d; t = o; } });
    u.tgt = t ? t.id : 0;
  }
  if (!t) return false;
  if (RTS.edgeDist(u, t) <= h.range) { stopMove(u); u.facing = Math.atan2(t.y - u.y, t.x - u.x);
    if (u.cd <= 0) { u.cd = Math.round(h.cooldown * RTS.HZ); t.hp = Math.min(RTS.stat(G, t, 'hp'), t.hp + h.amount); RTS.emit(G, 'heal', { e: u, t }); } return true; }
  if (chase) { moveToEnt(G, u, t); return true; }
  return false;
}
Object.assign(RTS.orders, {
  move(G, u, o) { moveTo(G, u, o.x, o.y); if (arrived(u) && u.dest === null) nextOrder(G, u); else if (arrived(u)) { u.dest = null; nextOrder(G, u); } },
  amove(G, u, o) {
    if (tryHeal(G, u, true)) return;
    const t = autoTarget(G, u);
    if (t && engage(G, u, t, true)) return;
    if (Math.hypot(u.x - o.x, u.y - o.y) < .8) { nextOrder(G, u); return; }
    moveTo(G, u, o.x, o.y); if (arrived(u)) { u.dest = null; nextOrder(G, u); }
  },
  patrol(G, u, o) { const t = autoTarget(G, u); if (t && engage(G, u, t, true)) return;
    moveTo(G, u, o.x, o.y); if (arrived(u) || Math.hypot(u.x - o.x, u.y - o.y) < .8) { u.dest = null; [o.x, o.ax] = [o.ax, o.x]; [o.y, o.ay] = [o.ay, o.y]; } },
  hold(G, u) { stopMove(u); const t = autoTarget(G, u); if (t) engage(G, u, t, false); },
  attack(G, u, o) { const t = G.byId[o.target]; if (!t || t.dead || t.downUntil > G.tick) { stopMove(u); nextOrder(G, u); return; } engage(G, u, t, true); },
  cast(G, u, o) { const ab = RTS.defs.abilities[o.ability];
    if (Math.hypot(u.x - o.x, u.y - o.y) > ab.range) { moveTo(G, u, o.x, o.y); return; }
    stopMove(u); if (RTS.abilityReady(G, u, ab)) RTS.useAbility(G, u, ab, o); nextOrder(G, u); },
  gather(G, u, o) {
    const d = defOf(u); let n = G.byId[o.node];
    const stuff = n && !n.dead && (n.amount > 0 || (n.vent && RTS.complete(n) && G.byId[n.vent].amount > 0));
    if (!stuff && (o.phase || 'go') === 'go') { const prev = n || u; const r = RTS.nearestNode(G, prev.x, prev.y, 'ore', 14, n && n.vent ? 0 : 0); if (!r) { nextOrder(G, u); return; } o.node = r.id; return; }
    o.phase = o.phase || (u.cargo >= d.carry ? 'back' : 'go');
    if (o.phase === 'go') {
      moveToEnt(G, u, n);
      if (RTS.edgeDist(u, n) < .55) {
        stopMove(u);
        if (n.busy && n.busy !== u.id && G.byId[n.busy] && !G.byId[n.busy].dead) { // 사용 중이면 옆 광맥으로
          if (!n.vent && (G.tick + u.id) % 10 === 0) { const r = RTS.nearestNode(G, u.x, u.y, 'ore', 5, n.id, true); if (r) o.node = r.id; } return; }
        n.busy = u.id; u.claim = n.id; o.phase = 'mine'; o.t = Math.round((n.vent ? 1.5 : 2.2) * RTS.HZ);
        u.facing = Math.atan2(n.y - u.y, n.x - u.x);
      } else if (arrived(u) && G.tick - (u.pathT || 0) > 12) u.destEnt = 0;
    } else if (o.phase === 'mine') {
      if (--o.t > 0) { u.mining = G.tick; return; }
      const src = n.vent ? G.byId[n.vent] : n, take = Math.min(src.amount, n.vent ? 4 : 5);
      src.amount -= take; u.cargo = take; u.cargoType = n.vent ? 'gas' : 'ore';
      releaseNode(G, u); o.phase = 'back';
      if (src.amount <= 0 && !n.vent) { RTS.kill(G, n, null, true); }
    } else {
      const drop = RTS.nearestDrop(G, u);
      if (!drop) { return; }
      moveToEnt(G, u, drop);
      if (RTS.edgeDist(u, drop) < .55) {
        stopMove(u); const t = G.teams[u.team], amt = u.cargo * t.inc * RTS.baseEff(G, drop);
        t.res[u.cargoType] = (t.res[u.cargoType] || 0) + amt; t.stats[u.cargoType] += u.cargo; u.cargo = 0; o.phase = 'go';
      } else if (arrived(u) && G.tick - (u.pathT || 0) > 12) u.destEnt = 0;
    }
  },
  build(G, u, o) {
    const s = G.byId[o.site];
    if (!s || s.dead || RTS.complete(s)) {
      if (s && !s.dead && defOf(s).placeOn) { RTS.issue(G, u, { type: 'gather', node: s.id }); return; }
      nextOrder(G, u); if (!u.order && !G.teams[u.team].ai) { const n = RTS.nearestNode(G, u.x, u.y, 'ore', 16); if (n) u.order = { type: 'gather', node: n.id }; } return; }
    moveToEnt(G, u, s);
    if (RTS.edgeDist(u, s) < .7) { stopMove(u);
      if (RTS.defs.factions[G.teams[u.team].faction].selfBuild) { s.active = true; nextOrder(G, u); if (!u.order) { const n = RTS.nearestNode(G, u.x, u.y, 'ore', 16); if (n) u.order = { type: 'gather', node: n.id }; } }
      else { s.builder = G.tick; u.building = G.tick; }
    } else if (arrived(u) && G.tick - (u.pathT || 0) > 12) u.destEnt = 0;
  },
});
RTS.nearestNode = function (G, x, y, type, maxD, skip, freeOnly) {
  let best = null, bd = maxD * maxD;
  for (const e of G.ents) {
    if (e.team !== -1 || e.dead || e.id === skip || defOf(e).resource !== type || (freeOnly && e.busy)) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; best = e; }
  }
  return best;
};
RTS.nearestDrop = function (G, u) {
  let best = null, bd = 1e12;
  for (const e of G.ents) { if (e.team !== u.team || e.dead || !defOf(e).dropoff || !RTS.complete(e)) continue; const d = (e.x - u.x) ** 2 + (e.y - u.y) ** 2; if (d < bd) { bd = d; best = e; } }
  return best;
};

// ── 건물 틱 ────────────────────────────────────────────────
function runBuilding(G, b) {
  const d = defOf(b), t = G.teams[b.team];
  if (b.built < b.buildT) {
    const on = RTS.defs.factions[t.faction].selfBuild ? b.active : b.builder === G.tick || b.builder === G.tick - 1;
    if (on) { b.built++; b.hp = Math.min(RTS.stat(G, b, 'hp'), b.hp + d.hp * .9 / b.buildT);
      if (b.built >= b.buildT) { RTS.emit(G, 'built', { e: b }); say(G, b.team, d.name + ' 건설 완료', 'ok'); } }
    return;
  }
  if (d.weapon) { if (b.cd > 0) b.cd--; const w = d.weapon, tg = autoTarget(G, b); if (tg && RTS.edgeDist(b, tg) <= RTS.wStat(G, b, w, 'range') && b.cd <= 0) fire(G, b, w, tg); }
  const p = b.prod[0]; if (!p) return;
  if (!p.started) {
    const need = D()[p.id].supply || 0;
    if (t.sup + need > t.cap) { if (G.tick % 100 === 0) say(G, b.team, '보급이 부족합니다. 보급 건물을 지으세요', 'warn'); return; }
    p.started = true; t.sup += need;
  }
  if (++p.t < p.total) return;
  b.prod.shift();
  if (p.kind === 'upgrade') { t.upgrades[p.id] = 1; delete t.research[p.id]; t.mods = {}; say(G, b.team, RTS.defs.upgrades[p.id].name + ' 연구 완료', 'ok'); RTS.emit(G, 'researched', { team: b.team, id: p.id }); return; }
  const r = RTS.rectOf(b), side = b.rally ? Math.atan2(b.rally.y - b.y, b.rally.x - b.x) : 1.57;
  const pos = D()[p.id].air ? { x: b.x, y: b.y } : RTS.nearestFree(G, b.x + Math.cos(side) * (r.w / 2 + .7), b.y + Math.sin(side) * (r.h / 2 + .7));
  const u = RTS.spawn(G, p.id, b.team, pos.x, pos.y); t.stats.made++;
  const ud = D()[p.id]; RTS.emit(G, 'trained', { e: u });
  if (ud.gather) { const n = (b.rally && b.rally.ent && G.byId[b.rally.ent]) || RTS.nearestNode(G, b.x, b.y, 'ore', 16); if (n && !n.dead) u.order = { type: 'gather', node: n.id }; else if (b.rally) u.order = { type: 'move', x: b.rally.x, y: b.rally.y }; }
  else if (b.rally) u.order = { type: 'amove', x: b.rally.x, y: b.rally.y };
}

// ── 이동 ───────────────────────────────────────────────────
function pathFor(G, u) {
  const d = defOf(u); u.needPath = false; u.pathT = G.tick; u.stuck = 0;
  const t = u.destEnt && G.byId[u.destEnt];
  if (d.air) { u.path = [[u.dest.x, u.dest.y]]; u.pathI = 0; return; }
  if (t && t.dead) { stopMove(u); return; }
  let goal;
  if (t && defOf(t).size) { const r = RTS.rectOf(t); goal = { x0: Math.round(r.x0) - 1, y0: Math.round(r.y0) - 1, x1: Math.round(r.x0) + r.w, y1: Math.round(r.y0) + r.h }; }
  else { const f = RTS.nearestFree(G, u.dest.x, u.dest.y); u.dest = f; goal = f; }
  if (!goal.x0 && goal.x0 !== 0 && RTS.lineClear(G, u.x, u.y, goal.x, goal.y)) { u.path = [[goal.x, goal.y]]; u.pathI = 0; return; }
  u.path = RTS.findPath(G, u.x, u.y, goal); u.pathI = 0;
  if (!u.path.length) u.path = null;
}
function moveUnits(G) {
  let budget = 30;
  for (const u of G.ents) {
    if (u.dead || defOf(u).kind !== 'unit') continue;
    u.px = u.x; u.py = u.y;
    if (u.needPath && budget > 0) { budget--; pathFor(G, u); }
    if (!u.path || u.stunned > G.tick) continue;
    const wp = u.path[u.pathI], dx = wp[0] - u.x, dy = wp[1] - u.y, d = Math.hypot(dx, dy), step = RTS.stat(G, u, 'speed') / RTS.HZ;
    if (d <= step) { u.x = wp[0]; u.y = wp[1]; if (++u.pathI >= u.path.length) u.path = null; }
    else { u.x += dx / d * step; u.y += dy / d * step; u.facing = Math.atan2(dy, dx); }
  }
  separate(G);
  for (const u of G.ents) { // 막힘 감지
    if (u.dead || !u.path) continue;
    const moved = Math.hypot(u.x - u.px, u.y - u.py), step = RTS.stat(G, u, 'speed') / RTS.HZ;
    if (moved < step * .3) u.stuck++; else u.stuck = Math.max(0, u.stuck - 1);
    const last = u.path[u.path.length - 1];
    if (u.stuck > 12 && !u.destEnt && Math.hypot(last[0] - u.x, last[1] - u.y) < 2.4) { u.path = null; continue; } // 무리 도착
    if (u.stuck > 30) { u.stuck = 0; u.stuckN++; if (u.stuckN > 3) { u.path = null; u.stuckN = 0; } else u.needPath = true; }
  }
}
function separate(G) {
  RTS.rebuildGrid(G);
  for (const a of G.ents) {
    const da = defOf(a); if (a.dead || da.kind !== 'unit') continue;
    const noPush = a.order && a.order.type === 'gather';
    if (noPush && da.gather) { fixPos(G, a); continue; }
    RTS.query(G, a.x, a.y, 1.2, b => {
      if (b === a || b.dead || b.id < a.id) return;
      const db = defOf(b); if (db.kind !== 'unit' || !!da.air !== !!db.air) return;
      if (db.gather && b.order && b.order.type === 'gather') return;
      const min = (da.r + db.r) * .95, dx = b.x - a.x, dy = b.y - a.y; let dd = Math.hypot(dx, dy);
      if (dd >= min) return;
      const nx = dd > .01 ? dx / dd : Math.cos(a.id), ny = dd > .01 ? dy / dd : Math.sin(a.id), push = (min - dd) * .5;
      const ha = a.order && a.order.type === 'hold' || a.sieged, hb = b.order && b.order.type === 'hold' || b.sieged;
      if (!ha) { a.x -= nx * push; a.y -= ny * push; }
      if (!hb) { b.x += nx * push; b.y += ny * push; }
    });
    fixPos(G, a);
  }
}
function fixPos(G, u) {
  if (defOf(u).air) { u.x = Math.max(.5, Math.min(G.w - .5, u.x)); u.y = Math.max(.5, Math.min(G.h - .5, u.y)); return; }
  if (RTS.walkable(G, u.x | 0, u.y | 0)) return;
  if (RTS.walkable(G, u.px | 0, u.y | 0)) { u.x = u.px; return; }
  if (RTS.walkable(G, u.x | 0, u.py | 0)) { u.y = u.py; return; }
  if (RTS.walkable(G, u.px | 0, u.py | 0)) { u.x = u.px; u.y = u.py; return; }
  const f = RTS.nearestFree(G, u.x, u.y); u.x = f.x; u.y = f.y;
}

// ── 시스템 파이프라인 등록 ─────────────────────────────────
RTS.census = function (G) {
  for (const t of G.teams) { t.sup = 0; t.cap = 0; t.have = {}; t.alive = 0; }
  for (const e of G.ents) {
    if (e.dead || e.team < 0) continue;
    const d = defOf(e), t = G.teams[e.team];
    if (d.site) continue; // 회사 거점은 승패와 보급에 포함하지 않는다
    if (d.kind === 'unit') t.sup += d.supply || 0;
    else { t.alive++;
      for (const p of e.prod) if (p.kind === 'unit' && p.started) t.sup += D()[p.id].supply || 0;
      if (RTS.complete(e)) { t.have[e.def] = (t.have[e.def] || 0) + 1; t.cap += d.provides || 0; } }
  }
  for (const t of G.teams) t.cap = Math.min(t.cap + RTS.allyPerk(G, t.id, 'supply'), RTS.cfg(G).supplyCap);
};
RTS.systems.push(
  { id: 'commands', run(G) { const q = G.cmds; G.cmds = []; for (const c of q) (RTS.commands[c.type] || (() => {}))(G, c.team, c); } },
  { id: 'census', run: G => RTS.census(G) },
  { id: 'ai', run(G) { for (const t of G.teams) if (t.ai) RTS.aiThink(G, t); } },
  { id: 'entities', run(G) {
    for (const e of G.ents) {
      if (e.dead) continue;
      const d = defOf(e); if (d.kind === 'resource') continue;
      if (e.buffs.length) e.buffs = e.buffs.filter(b => b.until > G.tick);
      if (d.site) continue; // 거점 상태는 market 시스템이 관리한다
      if (d.kind === 'building') { runBuilding(G, e); continue; }
      if (e.cd > 0) e.cd--;
      if (e.stunned > G.tick) continue;
      if (d.regen && G.tick % RTS.HZ === 0) e.hp = Math.min(RTS.stat(G, e, 'hp'), e.hp + d.regen);
      if (e.order) RTS.orders[e.order.type](G, e, e.order);
      else if (!d.passive) { if (tryHeal(G, e, true)) continue;
        if (e.sieged || d.immobile) { const t = autoTarget(G, e); if (t) engage(G, e, t, false); continue; }
        const t = autoTarget(G, e); if (t) e.order = { type: 'amove', x: e.x, y: e.y }; }
    }
  } },
  { id: 'movement', run: moveUnits },
  { id: 'projectiles', run(G) {
    G.projectiles = G.projectiles.filter(p => {
      const t = G.byId[p.target]; if (t && !t.dead) { p.tx = t.x; p.ty = t.y; }
      const d = Math.hypot(p.tx - p.x, p.ty - p.y), step = p.speed / RTS.HZ;
      if (d > step) { p.x += (p.tx - p.x) / d * step; p.y += (p.ty - p.y) / d * step; return true; }
      const de = D()[p.wdef], w = (p.sieged && de.siegeWeapon) || de.weapon;
      RTS.hit(G, t, p.tx, p.ty, p.dmg, w, G.byId[p.src] || { team: p.team, dead: true });
      return false;
    });
  } },
  { id: 'cleanup', run(G) {
    if (G.ents.some(e => e.dead)) { G.ents = G.ents.filter(e => { if (e.dead) delete G.byId[e.id]; return !e.dead; }); }
  } },
  { id: 'fog', run: G => RTS.updateFog(G) },
  { id: 'victory', run(G) {
    if (G.tick % 10) return;
    RTS.census(G);
    const live = G.teams.filter(t => t.alive > 0);
    if (live.length <= 1) { G.over = { winner: live[0] ? live[0].id : -1, tick: G.tick }; RTS.emit(G, 'gameover', G.over); }
  } },
);
