'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, GROUND = 0;
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  GROUND = H - 90;
}
window.addEventListener('resize', resize);
resize();
const GRAVITY = 0.5;
const DAMPING = 0.995;
const FRICTION = 0.35;
const ITERATIONS = 12;

const lerp = (a, b, t) => a + (b - a) * t;
const MASS = { pelvis: 4, chest: 4, neck: 0.6, head: 1.5, elbow: 0.8, wrist: 0.5, knee: 1.2, ankle: 0.8, toe: 0.4 };
const TIP_MARGIN = 14;
const GRIP = 4;
const S = { head: 26, neck: 12, torso: 62, upperArm: 34, foreArm: 32, thigh: 46, calf: 44, foot: 22 };
const RADIUS = { pelvis: 8, chest: 8, neck: 4, head: 3, elbow: 4, wrist: 4, knee: 6, ankle: 5, toe: 5 };

const COLORS = {
  skin: '#e8b98e', skinDark: '#c98f68',
  shirt: '#66783f', shirtDark: '#4d5c2e',
  pants: '#55603a', pantsDark: '#3f4a2b',
  boots: '#3a2e22', bootsDark: '#271e15',
  helmet: '#4a5a33'
};
let hero;
let standing = true;
let stun = 0;
const effects = [];
let keys = {};
const mouse = { x: 0, y: 0, sx: 0 };
let mouseDown = false;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const place = (from, ang, len) => ({ x: from.x + Math.sin(ang) * len, y: from.y + Math.cos(ang) * len });
function createHero(x) {
  const pos = {};
  pos.pelvis = { x: 0, y: 0 };
  pos.chest = { x: 0, y: -S.torso };
  pos.neck = { x: 0, y: pos.chest.y - S.neck };
  pos.head = { x: 0, y: pos.neck.y - S.head };
  const arm = (s, a1, a2) => {
    pos['elbow' + s] = place(pos.chest, a1, S.upperArm);
    pos['wrist' + s] = place(pos['elbow' + s], a2, S.foreArm);
  };
  arm('B', -0.12, 0.25);
  arm('F', 0.10, 0.50);
  const leg = (s, a1, a2) => {
    pos['knee' + s] = place(pos.pelvis, a1, S.thigh);
    pos['ankle' + s] = place(pos['knee' + s], a2, S.calf);
    pos['toe' + s] = { x: pos['ankle' + s].x + S.foot, y: pos['ankle' + s].y };
  };
  leg('B', -0.10, -0.16);
  leg('F', 0.20, 0.05);

  // ставим на землю
  let maxY = -Infinity;
  for (const n in pos) {
    if (/^(ankle|toe)/.test(n)) maxY = Math.max(maxY, pos[n].y + RADIUS[n.replace(/[BF]$/, '')]);
  }
  const shiftY = GROUND - maxY;

  const p = {};
  for (const n in pos) {
    const px = pos[n].x + x, py = pos[n].y + shiftY;
    const base = n.replace(/[BF]$/, '');
    p[n] = { x: px, y: py, px: px, py: py, fx: px, plant: false, r: RADIUS[base], m: MASS[base] };
  }
  const off = {};
  for (const n in p) off[n] = { x: p[n].x - p.pelvis.x, y: p[n].y - p.pelvis.y };
  const sticks = [];
  const link = (a, b) => sticks.push({ a: p[a], b: p[b], len: dist(p[a], p[b]) });
  link('head', 'neck');
  link('neck', 'chest');
  link('chest', 'pelvis');
  for (const s of ['B', 'F']) {
    link('chest', 'elbow' + s);
    link('elbow' + s, 'wrist' + s);
    link('pelvis', 'knee' + s);
    link('knee' + s, 'ankle' + s);
    link('ankle' + s, 'toe' + s);
  }
  const ranges = [];
  const range = (a, b, min, max) => ranges.push({ a: p[a], b: p[b], min, max });
  range('head', 'chest', 30, 38);
  for (const s of ['B', 'F']) {
    range('chest', 'knee' + s, 72, 9999);
    range('pelvis', 'ankle' + s, 24, 9999);
    range('chest', 'wrist' + s, 18, 9999);
    const d = dist(p['knee' + s], p['toe' + s]);
    range('knee' + s, 'toe' + s, d - 14, d + 8);
    ranges[ranges.length - 1].ank = true;
  }
  const C = COLORS;
  const segs = [
    { a: 'chest', b: 'elbowB', ry: 5, ext: 4, c: C.shirtDark },
    { a: 'elbowB', b: 'wristB', ry: 4.5, ext: 4, c: C.skinDark },
    { a: 'pelvis', b: 'kneeB', ry: 8, ext: 6, c: C.pantsDark },
    { a: 'kneeB', b: 'ankleB', ry: 6.5, ext: 5, c: C.pantsDark },
    { a: 'ankleB', b: 'toeB', ry: 5, ext: 5, c: C.bootsDark },
    { a: 'pelvis', b: 'chest', ry: 13, ext: 8, c: C.shirt },
    { a: 'chest', b: 'neck', ry: 4.5, ext: 2, c: C.skin },
    { a: 'neck', b: 'head', ry: 11, ext: 2, c: C.skin, helmet: true },
    { a: 'pelvis', b: 'kneeF', ry: 8, ext: 6, c: C.pants },
    { a: 'kneeF', b: 'ankleF', ry: 6.5, ext: 5, c: C.pants },
    { a: 'ankleF', b: 'toeF', ry: 5, ext: 5, c: C.boots },
    { a: 'chest', b: 'elbowF', ry: 5, ext: 4, c: C.shirt },
    { a: 'elbowF', b: 'wristF', ry: 4.5, ext: 4, c: C.skin }
  ];
  	return { p, off, sticks, ranges, segs, f: 1, phase: 0, walk: 0, vx: 0, crouch: 0, lie: 0, bal: 1, tone: 0, tip: 0, getup: null, wrap: { head: 0, torso: 0, arms: 0, legs: 0 }, soak: { head: 0, torso: 0, arms: 0, legs: 0 }, bandaging: false, bandPart: null, box: null, aimA: 0, shootCD: 0, ammo: MAG_SIZE, reloadT: 0, reloadMax: RELOAD_T, magOut: false, gun: 1, gunWant: true, gunRestore: false, isPlayer: false, standH: GROUND - p.pelvis.y - GAIT.hipDrop };
}
function solveStick(s) {
  const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  const wa = 1 / s.a.m, wb = 1 / s.b.m;
  const k = (d - s.len) / d / (wa + wb);
  s.a.x += dx * k * wa; s.a.y += dy * k * wa;
  s.b.x -= dx * k * wb; s.b.y -= dy * k * wb;
}
function solveRange(r) {
  const dx = r.b.x - r.a.x, dy = r.b.y - r.a.y;
  const d = Math.hypot(dx, dy) || 0.0001;
  let target;
  if (d < r.min) target = r.min;
  else if (d > r.max) target = r.max;
  else return;
  const wa = 1 / r.a.m, wb = 1 / r.b.m;
  const k = (d - target) / d / (wa + wb);
  r.a.x += dx * k * wa; r.a.y += dy * k * wa;
  r.b.x -= dx * k * wb; r.b.y -= dy * k * wb;
}
function muscle(a, b, ox, oy, k, wa = 1, wb = 1, kx = 1) {
  const ex = (a.x + ox - b.x) * kx, ey = a.y + oy - b.y;
  const ia = wa / a.m, ib = wb / b.m;
  const sum = ia + ib;
  if (sum === 0) return;
  b.x += ex * k * ib / sum; b.y += ey * k * ib / sum;
  a.x -= ex * k * ia / sum; a.y -= ey * k * ia / sum;
}
function tipping(P) {
  let mx = 0, mt = 0;
  for (const n in P) { mx += P[n].x * P[n].m; mt += P[n].m; }
  const com = mx / mt;
  let lo = Infinity, hi = -Infinity;
  for (const n of ['ankleB', 'ankleF', 'toeB', 'toeF']) {
    const q = P[n];
    if (q.y >= GROUND - q.r - 2) { lo = Math.min(lo, q.x); hi = Math.max(hi, q.x); }
  }
  return lo === Infinity ? 0 : Math.max(0, lo - com, com - hi);
}
function bendLimit(a, b, c, dir) {
  const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  if (cross * dir < 0) {
    const dx = c.x - a.x, dy = c.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    const t = ((b.x - a.x) * dx + (b.y - a.y) * dy) / l2;
    const fx = a.x + dx * t, fy = a.y + dy * t;
    b.x = 2 * fx - b.x;
    b.y = 2 * fy - b.y;
  }
}
function collide(p) {
  if (p.y > GROUND - p.r) {
    p.y = GROUND - p.r;
    p.py = p.y;
  }
  if (p.x < p.r) p.x = p.r;
  if (p.x > WORLD_W - p.r) p.x = WORLD_W - p.r;
}
function explode(x, y, R = 260, power = 1) {
  runAll(() => blast(x, y, R, power));
  boom(x, y, power);
}
function blast(x, y, R, power) {
  let hit = 0;
  const hits = {};
  for (const [name, p] of Object.entries(hero.p)) {
    const dx = p.x - x;
    const dy = p.y - y - 30;
    const d = Math.hypot(dx, dy) || 1;
    if (d < R) {
      const k = (1 - d / R) * coverFactor(p.x, p.y, x, y) * (1 - 0.5 * hero.lie - 0.15 * hero.crouch);
      hit = Math.max(hit, k);
      hits[name] = k;
      const force = k * 22 * power;
      p.px -= dx / d * force;
      p.py -= dy / d * force;
    }
  }
  if (hit > 0.2) stun = Math.max(stun, Math.round(40 + hit * 80));
  const wasDead = Health.state.dead;
  Health.onBlast(hits);
  if ((Health.state.dead || Health.state.parts.torso <= 0) && hit > DISMEMBER_K) dismember(hero, hits, x, power, wasDead);   // погиб или торс разрушен взрывом — отлетают конечности
}
function boom(x, y, power) {
  effects.push({ x, y, t: 0, s: power });
  spawnShards(x, y, Math.round(SHARD_COUNT * power));
  if (y > GROUND - 40) spawnDust(x, power);
  if (power > 1.2) craters.push({ x, s: 40 * power });
  if (craters.length > 8) craters.shift();
  shake = Math.max(shake, 6 * power * Math.max(0.2, 1 - Math.abs(x - hero.p.pelvis.x) / 900));
}
const FUSE = 180;
const SHARD_COUNT = 36;
const grenades = [];
const shards = [];
const bullets = [];
const flashes = [];
const BULLET_SPEED = 34;
const SHOOT_CD = 8;
// ===== Патроны, перезарядка и отсоединяемый магазин (у всех бойцов) =====
const MAG_SIZE = 30;         // патронов в магазине АК
const SNIPER_MAG = 10;       // патронов у снайпера
const RELOAD_T = 90;         // перезарядка АК, кадров (1,5 с)
const SNIPER_RELOAD_T = 120; // перезарядка снайпера, кадров (2 с)
const MAG_OUT_AT = 0.25;     // доля перезарядки, на которой магазин отсоединяется
const MAG_IN_AT = 0.7;       // доля перезарядки, на которой вставлен новый
const mags = [];             // упавшие на землю магазины
const magSize = h => h.sniper ? SNIPER_MAG : MAG_SIZE;
function startReload(h, hl = playerHealth) {               // R у игрока; у ботов вызывает aiShoot
  if (h.reloadT > 0 || (h.ammo >= magSize(h) && !h.magOut)) return;
  if (!h.gunWant || h.gun < 1 || h.getup || h.lie > 0.3 || h.bal < 0.6 || h.nadeAim || h.throwT > 0 || h.carrying || h.bandaging || h.treat || !hl.conscious() || hl.state.dead) return;
  h.reloadMax = h.reloadT = h.sniper ? SNIPER_RELOAD_T : RELOAD_T;
}
function dropMag(h) {                                      // магазин вылетает из оружия и падает на землю
  const c = h.p.chest, a = h.aimA, sn = !!h.sniper;
  const flip = Math.cos(a) < 0 ? -1 : 1;
  const lx = sn ? 12 : 35, ly = (sn ? 10 : 13) * flip;     // где магазин в координатах оружия
  mags.push({
    x: c.x + Math.cos(a) * lx - Math.sin(a) * ly,
    y: c.y + Math.sin(a) * lx + Math.cos(a) * ly,
    a, flip, sn,
    vx: (Math.random() - 0.5) * 1.5 - h.f * 0.4, vy: 1 + Math.random(),
    va: (Math.random() - 0.5) * 0.3, life: 900
  });
  if (mags.length > 40) mags.shift();
}
function reloadStep(h) {                                   // вызывается для каждого бойца внутри stepHero
  if (!(h.reloadT > 0)) return;
  if (!h.gunWant || h.getup || h.lie > 0.3 || h.bal < 0.6 || h.nadeAim || h.throwT > 0 || h.bandaging || h.treat || !Health.conscious() || Health.state.dead) { h.reloadT = 0; return; }   // убрал оружие / упал / бросок — перезарядка сорвана
  h.reloadT--;
  const t = 1 - h.reloadT / h.reloadMax;
  if (t >= MAG_IN_AT) {
    if (h.magOut) { h.magOut = false; h.ammo = magSize(h); }     // новый магазин вставлен
  } else if (t >= MAG_OUT_AT && !h.magOut) {
    dropMag(h); h.magOut = true; h.ammo = 0;                     // старый магазин сброшен
  }
}
function reloadPose(h) {                                   // 0..1: насколько рука ушла к магазину
  if (!(h.reloadT > 0)) return 0;
  const t = 1 - h.reloadT / h.reloadMax;
  return t < 0.2 ? ease(t / 0.2) : t > 0.8 ? ease((1 - t) / 0.2) : 1;
}
function updateMags() {
  for (let i = mags.length - 1; i >= 0; i--) {
    const m = mags[i];
    m.vy += 0.5;
    m.x += m.vx; m.y += m.vy; m.a += m.va;
    if (m.y >= GROUND - 4) {
      m.y = GROUND - 4;
      m.vy = Math.abs(m.vy) > 3 ? -m.vy * 0.3 : 0;
      m.vx *= 0.5; m.va *= 0.5;
    }
    if (--m.life <= 0) mags.splice(i, 1);
  }
}
const ammoEl = document.getElementById('ammo');
let ammoShown = '';
function updateAmmoHud() {
  const h = hero;
  const pr = h.reloadT > 0 ? Math.round((1 - h.reloadT / h.reloadMax) * 20) : -1;
  const key = h.ammo + '|' + pr + '|' + (h.gunWant ? 1 : 0) + '|' + (h.magOut ? 1 : 0) + '|' + (h.bandWant ? 1 : 0);
  if (key === ammoShown) return;
  ammoShown = key;
  const bar = pr >= 0 ? '<span class="rl"><i style="width:' + pr * 5 + '%"></i></span>' : '';
  const hint = h.bandWant ? '<span class="am-h">бинт · <kbd>ЛКМ</kbd> перевязка</span>'
    : !h.gunWant ? '<span class="am-h">оружие убрано · <kbd>1</kbd></span>'
    : h.reloadT > 0 ? '<span class="am-h">перезарядка…</span>'
    : (h.ammo === 0 || h.magOut) ? '<span class="am-h bad"><kbd>R</kbd> перезарядка</span>' : '';
  ammoEl.innerHTML = '<kbd>АК</kbd><b>' + h.ammo + '</b><span class="am-max">/ ' + magSize(h) + '</span>' + hint + bar;
  ammoEl.classList.toggle('empty', h.ammo === 0 && !(h.reloadT > 0));
}
function throwGrenade(x, y, vx, vy) {
  grenades.push({
    x, y,
    vx, vy,
    a: 0, va: Math.sign(vx || 1) * (0.2 + Math.random() * 0.1),   // кувыркается в полёте
    fuse: FUSE, r: 6
  });
}
// ===== Бросок гранаты игроком =====
const NADE_MAX = 5;        // сколько гранат у бойца
const NADE_RANGE = 560;    // макс. дальность броска, px
const NADE_WIND = 12;      // кадров на замах (пока держишь ПКМ)
const THROW_T = 18;        // длительность самого броска, кадров
const THROW_REL = 0.45;    // в какой момент броска (0..1) граната вылетает из руки
const NADE_CD = 40;        // пауза между бросками, кадров
let nades = NADE_MAX;
const nadeEl = document.getElementById('nades');
let nadeShown = -1;
function updateNadeHud() {
  if (nades === nadeShown) return;
  nadeShown = nades;
  let pips = '';
  for (let i = 0; i < NADE_MAX; i++) pips += '<i' + (i < nades ? ' class="on"' : '') + '></i>';
  nadeEl.innerHTML = '<kbd>ПКМ</kbd><span class="ng">' + pips + '</span>';
  nadeEl.classList.toggle('empty', nades === 0);
}
function nadeTarget(h) {                                   // точка падения: курсор, но не дальше NADE_RANGE
  const c = h.p.chest;
  let dx = mouse.x - c.x, dy = mouse.y - c.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d > NADE_RANGE) { dx *= NADE_RANGE / d; dy *= NADE_RANGE / d; }
  return { x: c.x + dx, y: Math.min(GROUND - 6, c.y + dy) };
}
function nadeLaunch(sx, sy, tx, ty) {                      // скорость, чтобы упасть ровно в цель
  const dx = tx - sx, dy = ty - sy;
  const T = Math.max(22, Math.min(55, Math.hypot(dx, dy) / 9));   // время полёта, кадров
  return { vx: dx / T, vy: dy / T - GRAVITY * (T + 1) / 2, T };
}
function canThrow(h) {
  return nades > 0 && !h.throwT && !(h.nadeCD > 0) && h.bal > 0.6 && !h.getup && h.lie < 0.3
    && !h.bandaging && !h.treat && !h.carrying && Health.conscious() && !Health.state.dead;
}
function startThrow(h) {                                   // ПКМ отпущена — бросок
  if (!h.nadeAim) return;
  h.nadeAim = false;
  if (!canThrow(h)) return;
  h.nadeTgt = nadeTarget(h);
  h.throwT = THROW_T;
  h.thrown = false;
}
function nadeStep(h) {
  if (h.nadeCD > 0) h.nadeCD--;
  if (h.nadeAim && !canThrow(h)) h.nadeAim = false;        // ранило / упал — замах сорван
  if (h.throwT > 0) {
    if (h.bal < 0.5 || h.getup || h.lie > 0.5 || !Health.conscious() || Health.state.dead) {
      h.throwT = 0; h.thrown = true;                       // бросок сорван, граната не потрачена
    } else {
      h.throwT--;
      const u = 1 - h.throwT / THROW_T;
      if (!h.thrown && u >= THROW_REL) {
        h.thrown = true;
        const s = h.p.wristF;
        const v = nadeLaunch(s.x, s.y, h.nadeTgt.x, h.nadeTgt.y);
        throwGrenade(s.x, s.y, v.vx, v.vy);
        nades--;
      }
      if (h.throwT <= 0) h.nadeCD = NADE_CD;
    }
  }
  h.nadeW = h.nadeAim ? Math.min(1, (h.nadeW || 0) + 1 / NADE_WIND) : h.throwT > 0 ? 1 : Math.max(0, (h.nadeW || 0) - 0.1);
}
// рука с гранатой: ставим локоть и кисть жёстко и гасим их скорость (иначе рука тянет за собой всё тело)
function nadeArm(h) {
  const P = h.p;
  const tg = h.throwT > 0 ? h.nadeTgt : nadeTarget(h);
  const hd = nadeHandPos(h, tg);
  const arm = ik2(P.chest, hd, S.upperArm, S.foreArm, -h.f, true);
  pull(P.elbowF, arm.mid.x, arm.mid.y, 0.85, 14);
  pull(P.wristF, arm.end.x, arm.end.y, 0.85, 14);
}
function nadeHandPos(h, tg) {
  const c = h.p.chest;
  const a = Math.atan2(tg.y - c.y, tg.x - c.x);
  const ca = Math.cos(a), sa = Math.sin(a);
  const rest = { x: c.x + h.f * 8, y: c.y + 22 };
  const wind = { x: c.x - ca * 30, y: c.y - sa * 14 - 22 };
  const rel = { x: c.x + ca * 50, y: c.y + sa * 50 - 10 };
  const thru = { x: c.x + ca * 26, y: c.y + 32 };
  const mix = (p, q, t) => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });
  if (h.throwT > 0) {
    const u = 1 - h.throwT / THROW_T;
    return u < THROW_REL ? mix(wind, rel, ease(u / THROW_REL)) : mix(rel, thru, ease((u - THROW_REL) / (1 - THROW_REL)));
  }
  return mix(rest, wind, ease(h.nadeW || 0));
}
function updateGrenades() {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.vy += GRAVITY;
    g.x += g.vx; g.y += g.vy; g.a += g.va;
    if (g.y > GROUND - g.r) {
      g.y = GROUND - g.r;
      g.vy = Math.abs(g.vy) > 2 ? -g.vy * 0.45 : 0;
      g.vx *= 0.7; g.va *= 0.7;
    }
    if (g.x < g.r) { g.x = g.r; g.vx = -g.vx * 0.5; }
    if (g.x > WORLD_W - g.r) { g.x = WORLD_W - g.r; g.vx = -g.vx * 0.5; }
    if (--g.fuse <= 0) {
      grenades.splice(i, 1);
      explode(g.x, g.y);
    }
  }
}
function spawnShards(x, y, count = SHARD_COUNT) {
  const onGround = y > GROUND - 40;
  for (let i = 0; i < count; i++) {
    const ang = onGround ? -Math.random() * Math.PI : Math.random() * Math.PI * 2;
    const sp = 7 + Math.random() * 10;
    shards.push({ x, y: y - 4, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 50 + Math.random() * 40 });
  }
}
function distToSeg(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2));
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}
function hitShard(s, seg, u) {
  for (const n of [seg.a, seg.b]) {
    const p = u.hero.p[n];
    p.px -= s.vx * 0.15;
    p.py -= s.vy * 0.15;
  }
  u.health.onShrapnel(seg.b);
  addWound(u, seg, s.x, s.y, 'frag', s.vx, s.vy);
}
function updateShards() {
  for (let i = shards.length - 1; i >= 0; i--) {
    const s = shards[i];
    let dead = --s.life <= 0;
    s.vy += 0.25;
    s.vx *= 0.99;
    for (let k = 0; k < 2 && !dead; k++) {
      s.x += s.vx / 2;
      s.y += s.vy / 2;
      if (s.y >= GROUND || s.x < 0 || s.x > WORLD_W || shardBlocked(s.x, s.y)) { dead = true; break; }
      for (const u of everybody()) {
        const h = u.hero;
        if (Math.abs(s.x - h.p.pelvis.x) > 170) continue;
        for (const seg of h.segs) {
          if (distToSeg(s.x, s.y, h.p[seg.a], h.p[seg.b]) < seg.ry * 0.8) {
            s.pass = s.pass || new Map();
            if (!s.pass.has(h)) s.pass.set(h, Math.random() < h.lie * 0.6);
            if (s.pass.get(h)) continue;
            hitShard(s, seg, u);
            dead = true;
            break;
          }
        }
        if (dead) break;
      }
    }
    if (dead) shards.splice(i, 1);
  }
}
function shootUnit(h) {
	if (h.shootCD > 0 || h.gun < 1 || h.getup || h.lie > 0.5 || h.bal < 0.5 || h.bandaging || h.carrying || h.nadeAim || h.throwT > 0) return;
	if (h.ammo <= 0 || h.reloadT > 0 || h.magOut) return;
	h.shootCD = h.sniper ? SNIPER_CD : SHOOT_CD;
	h.ammo--;
	const ax = Math.cos(h.aimA), ay = Math.sin(h.aimA);
	const sn = !!h.sniper;
	const reach = sn ? 112 : 80;
	const mx = h.p.chest.x + ax * reach;
	const my = h.p.chest.y + ay * reach;
	const sa = h.aimA + (Math.random() - 0.5) * 2 * (h.spread || 0);   // разброс у ботов
	const spd = sn ? SNIPER_SPEED : BULLET_SPEED;
	bullets.push({ x: mx, y: my, px: mx, py: my, vx: Math.cos(sa) * spd, vy: Math.sin(sa) * spd, life: sn ? 70 : 90, foe: !!h.foe, sn, dmg: sn ? SNIPER_DMG : 2.5 });
	flashes.push({ x: mx, y: my, a: h.aimA, life: 7, max: 7 });
	// отдача: толкаем корпус и таз назад
	const rec = sn ? 3 : 1;
	h.p.chest.px -= ax * 1.6 * rec; h.p.chest.py -= ay * 1.6 * rec;
	h.p.pelvis.px -= ax * 0.5 * rec; h.p.pelvis.py -= ay * 0.5 * rec;
}
function updateBullets() {
	for (let i = bullets.length - 1; i >= 0; i--) {
		const b = bullets[i];
		b.px = b.x; b.py = b.y;
		let dead = false;
		const targets = b.foe ? everyone() : foes;       // пуля врага бьёт по нашим, наша — по врагам
		const steps = Math.ceil(Math.hypot(b.vx, b.vy) / 11.5);
		for (let k = 0; k < steps; k++) {
			b.x += b.vx / steps;
			b.y += b.vy / steps;
			if (b.y >= GROUND || b.x < 0 || b.x > WORLD_W || shardBlocked(b.x, b.y)) { dead = true; break; }
			for (const u of targets) {
				if (u.health.state.dead) continue;
				const h = u.hero;
				if (Math.abs(b.x - h.p.pelvis.x) > 170) continue;
				for (const seg of h.segs) {
					if (distToSeg(b.x, b.y, h.p[seg.a], h.p[seg.b]) < seg.ry * 0.8 + 2) {
						for (const n of [seg.a, seg.b]) { h.p[n].px -= b.vx * 0.06; h.p[n].py -= b.vy * 0.06; }
						u.health.onShrapnel(seg.b, b.dmg || 2.5);                      // винтовочная пуля: ×2.5 от осколка
						addWound(u, seg, b.x, b.y, 'bullet', b.vx, b.vy);
						dead = true;
						break;
					}
				}
				if (dead) break;
			}
			if (dead) break;
		}
		if (dead || --b.life <= 0) bullets.splice(i, 1);
	}
	for (let i = flashes.length - 1; i >= 0; i--) {
		if (--flashes[i].life <= 0) flashes.splice(i, 1);
	}
}
const ROCKET_MIN = 1200, ROCKET_MAX = 1800;   // пауза между ракетами, кадров (20–30 с)
const nextRocket = () => Math.round(ROCKET_MIN + Math.random() * (ROCKET_MAX - ROCKET_MIN));
const ROCKET_SPEED = 40;
const ROCKET_R = 380;
const ROCKET_POWER = 1.7;
const DIRT = ['#4a3b27', '#3a2f1f', '#5a4a30', '#2a301b'];
const rockets = [];
const ROCKET_SPREAD = 1300;
const ROCKET_GAP = 450;
const ROCKET_RANGE = 2000;      // ракеты падают не дальше этого расстояния от игрока (в обе стороны)
const ROCKET_SITE_GAP = 450;   // минимум между двумя точками падения одной атаки
// прижимает точку к окну ±ROCKET_RANGE вокруг игрока (и к границам мира)
const rocketZone = x => {
  const hx = hero.p.pelvis.x;
  return Math.max(120, Math.min(WORLD_W - 120, Math.max(hx - ROCKET_RANGE, Math.min(hx + ROCKET_RANGE, x))));
};
const lastHits = [];
// other не задан — первая точка; other задан — вторая точка, не ближе ROCKET_SITE_GAP к первой
function pickRocketX(other) {
  const hx = hero.p.pelvis.x;
  const second = other !== undefined;
  const lo = Math.max(120, hx - ROCKET_RANGE), hi = Math.min(WORLD_W - 120, hx + ROCKET_RANGE);
  let x = rocketZone(hx);
  for (let tries = 0; tries < 12; tries++) {
    x = lo + Math.random() * (hi - lo);
    if (lastHits.every(h => Math.abs(h - x) > ROCKET_GAP) && (!second || Math.abs(x - other) > ROCKET_SITE_GAP)) break;
  }
  if (second && Math.abs(x - other) <= ROCKET_SITE_GAP) {             // не нашлось случайно — ставим по другую сторону от игрока
    x = rocketZone(other > hx ? other - ROCKET_SITE_GAP : other + ROCKET_SITE_GAP);
  }
  lastHits.push(x);
  if (lastHits.length > 4) lastHits.shift();
  return x;
}
const dust = [];
const debris = [];
const craters = [];
// ===== Предупреждение об атаке с неба: мигает последнюю секунду перед ракетами / штурмовкой =====
const WARN_FRAMES = 60;                       // 1 секунда
const warn = { rocket: 0, strafe: 0, mega: 0 };        // сколько кадров ещё мигать
const WARN_INFO = {
  rocket: { text: 'РАКЕТЫ С НЕБА' },
  strafe: { text: 'ОБСТРЕЛ С САМОЛЁТА' },
  mega: { text: 'СВЕРХМОЩНАЯ РАКЕТА — В УКРЫТИЕ' }
};
const warnMax = { rocket: 1, strafe: 1, mega: 1 };    // с какого значения пошёл отсчёт (для полоски)
const threatsEl = document.createElement('div');
threatsEl.id = 'threats';
document.body.appendChild(threatsEl);
const threatEls = {};
for (const k in WARN_INFO) {
  const el = document.createElement('div');
  el.className = 'threat ' + k;
  el.style.display = 'none';
  el.innerHTML = '<span class="tn">' + WARN_INFO[k].text + '</span><span class="tt"></span><i class="tb"></i>';
  threatsEl.appendChild(el);
  threatEls[k] = { el, tt: el.querySelector('.tt'), tb: el.querySelector('.tb') };
}
function updateWarning() {
  for (const k in warn) {
    const t = threatEls[k], left = warn[k];
    if (left <= 0) { t.el.style.display = 'none'; continue; }
    if (left > warnMax[k]) warnMax[k] = left;
    t.el.style.display = 'flex';
    t.tt.textContent = (left / 60).toFixed(1) + ' с';
    t.tb.style.width = (left / warnMax[k] * 100).toFixed(0) + '%';
  }
  for (const k in warn) if (warn[k] > 0) warn[k]--;
}
let rocketTimer = nextRocket();
let shake = 0;
const SALVO_CHANCE = 0.25;
const SALVO_GAP = 190;
const SALVO_R = 300;
const SALVO_POWER = 1.3;
function launchRocket() {
  const c1 = pickRocketX();
  const c2 = pickRocketX(c1);
  [c1, c2].forEach((cx, site) => {
    const salvo = Math.random() < SALVO_CHANCE;
    const n = salvo ? 3 : 1;
    const lag = site * (20 + Math.random() * 20);                 // вторая точка бьёт чуть позже первой
    for (let i = 0; i < n; i++) {
      const tx = salvo
        ? rocketZone(cx + (i - 1) * SALVO_GAP + (Math.random() - 0.5) * 80)
        : cx;
      const delay = (salvo ? Math.random() * 30 : 0) + lag;
      const vx = (Math.random() - 0.5) * 10;
      const frames = (GROUND + 40) / ROCKET_SPEED + delay;
      const r = { x: tx - vx * frames, y: -40 - delay * ROCKET_SPEED, vx, vy: ROCKET_SPEED };
      if (salvo) { r.R = SALVO_R; r.pw = SALVO_POWER; }
      rockets.push(r);
    }
  });
}
// ===== Супер-ракета: раз в 20 с, в той же зоне от базы, что и обычные =====
const MEGA_MIN = 1800, MEGA_MAX = 3000;   // пауза между супер-ракетами, кадров (30–50 с)
const nextMega = () => Math.round(MEGA_MIN + Math.random() * (MEGA_MAX - MEGA_MIN));
const MEGA_WARN = 120;      // предупреждение за 2 с
const MEGA_R = 850;         // радиус поражения
const MEGA_POWER = 3.2;
const MEGA_SPEED = 32;
let megaTimer = nextMega();
let megaFlash = 0;          // белая вспышка на весь экран
const megaFx = [];          // огненный шар, ударная волна, световой столб
function launchMega() {
  const tx = pickRocketX();
  const vx = (Math.random() - 0.5) * 6;
  const frames = (GROUND + 60) / MEGA_SPEED;
  rockets.push({ x: tx - vx * frames, y: -60, vx, vy: MEGA_SPEED, mega: true, R: MEGA_R, pw: MEGA_POWER });
}
function megaSound() {
  try {
    const ac = megaSound.ac = megaSound.ac || new (window.AudioContext || window.webkitAudioContext)();
    const now = ac.currentTime;
    const len = Math.floor(ac.sampleRate * 3);
    const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const noise = ac.createBufferSource(); noise.buffer = buf;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const g = ac.createGain(); g.gain.value = 0.5;
    noise.connect(lp); lp.connect(g); g.connect(ac.destination); noise.start(now);
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(90, now); o.frequency.exponentialRampToValueAtTime(25, now + 2);
    og.gain.setValueAtTime(0.6, now); og.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    o.connect(og); og.connect(ac.destination); o.start(now); o.stop(now + 2.5);
  } catch (e) { /* звук необязателен */ }
}
function megaBoom(x) {
  megaFx.push({ x, t: 0 });
  megaFlash = 0.4 + 0.6 * Math.max(0, 1 - Math.abs(x - hero.p.pelvis.x) / 1500);
  shake = Math.max(shake, 28);
  megaSound();
  for (let i = 0; i < 70; i++) {   // ножка гриба
    const life = 260 + Math.random() * 120;
    dust.push({ x: x + (Math.random() - 0.5) * 50, y: GROUND - 6, vx: (Math.random() - 0.5) * 1.5, vy: -(4 + Math.random() * 7),
      r: 18 + Math.random() * 16, grow: 0.7 + Math.random() * 0.6, life, max: life, a: 0.6, c: Math.random() < 0.5 ? '70,62,52' : '48,44,38' });
  }
  for (let i = 0; i < 60; i++) {   // шапка гриба
    const life = 240 + Math.random() * 120;
    dust.push({ x: x + (Math.random() - 0.5) * 40, y: GROUND - 6, vx: (Math.random() - 0.5) * 9, vy: -(10 + Math.random() * 5),
      r: 24 + Math.random() * 20, grow: 0.9 + Math.random() * 0.6, life, max: life, a: 0.55, c: '90,80,66' });
  }
  for (let i = 0; i < 50; i++) {   // огонь у основания
    const life = 40 + Math.random() * 40;
    dust.push({ x: x + (Math.random() - 0.5) * 120, y: GROUND - 10, vx: (Math.random() - 0.5) * 8, vy: -(1 + Math.random() * 6),
      r: 20 + Math.random() * 25, grow: 0.8, life, max: life, a: 0.85, c: Math.random() < 0.5 ? '255,140,50' : '255,200,90' });
  }
  for (let i = 0; i < 160; i++) {  // каменный дождь
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, sp = 8 + Math.random() * 22, life = 120 + Math.random() * 100;
    debris.push({ x: x + (Math.random() - 0.5) * 60, y: GROUND - 8, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      s: 3 + Math.random() * 7, life, max: life, c: DIRT[(Math.random() * DIRT.length) | 0] });
  }
  craters.push({ x, s: 220 });
  if (craters.length > 8) craters.shift();
}
function updateRockets() {
  if (!won && megaTimer === MEGA_WARN) warn.mega = MEGA_WARN;
  if (!won && --megaTimer <= 0) {
    megaTimer = nextMega();
    launchMega();
  }
  if (megaFlash > 0) megaFlash = Math.max(0, megaFlash - 0.025);
  for (let i = megaFx.length - 1; i >= 0; i--) if (++megaFx[i].t > 100) megaFx.splice(i, 1);
  if (!won && rocketTimer === WARN_FRAMES) warn.rocket = WARN_FRAMES;
  if (!won && --rocketTimer <= 0) {
    rocketTimer = nextRocket();
    launchRocket();
  }
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    r.x += r.vx;
    r.y += r.vy;
    // дымный след
    dust.push({ x: r.x - r.vx * 0.5, y: r.y - r.vy * 0.5, vx: 0, vy: 0, r: 4, grow: 0.15, life: 40, max: 40, a: 0.35, c: '150,150,150' });
    if (r.mega) {                                            // огненный шлейф и дрожь от падения
      for (let k = 0; k < 3; k++) dust.push({ x: r.x - r.vx * Math.random() * 2 + (Math.random() - 0.5) * 10, y: r.y - r.vy * Math.random() * 2, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, r: 8 + Math.random() * 6, grow: 0.5, life: 30, max: 30, a: 0.7, c: k ? '255,150,60' : '90,90,90' });
      shake = Math.max(shake, 1.5);
    }
    const roof = !r.mega && props.find(c => c.type === 'house' && r.x > c.x && r.x < c.x + c.w && r.y >= GROUND - c.h);
    if (roof) {                                              // крыша держит ракету: взрыв наверху, внутри почти не задевает
      rockets.splice(i, 1);
      explode(r.x, GROUND - roof.h - 4, r.R || ROCKET_R, r.pw || ROCKET_POWER);
      continue;
    }
    if (r.y >= GROUND - 4) {
      rockets.splice(i, 1);
      explode(r.x, GROUND - 10, r.R || ROCKET_R, r.pw || ROCKET_POWER);
      if (r.mega) megaBoom(r.x);
    }
  }
}
// ===== Штурмовка: невидимый самолёт пролетает и сыплет пули сверху =====
const STRAFE_MIN = 1500;          // пауза между пролётами, кадров (25–45 с)
const STRAFE_MAX = 2700;
const STRAFE_SPEED = 18;          // скорость самолёта, px за кадр
const STRAFE_RATE = 2;            // пуль за кадр (чем больше — тем гуще град)
const STRAFE_BULLET_SPEED = 32;
const STRAFE_SCATTER = 40;        // разброс пуль по X вокруг самолёта
const strafeShots = [];
let plane = null;
const nextStrafe = () => Math.round(STRAFE_MIN + Math.random() * (STRAFE_MAX - STRAFE_MIN));
let strafeTimer = nextStrafe();
const STRAFE_RUN_MIN = 500, STRAFE_RUN_MAX = 900;   // длина участка, который простреливает самолёт, px
function launchStrafe() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const hx = hero.p.pelvis.x;
  const lo = Math.max(0, hx - ROCKET_RANGE), hi = Math.min(WORLD_W, hx + ROCKET_RANGE);   // тот же радиус, что у ракет
  const len = Math.min(hi - lo, STRAFE_RUN_MIN + Math.random() * (STRAFE_RUN_MAX - STRAFE_RUN_MIN));
  const s = lo + Math.random() * (hi - lo - len);                                        // случайное начало участка
  plane = {
    dir,
    x: dir > 0 ? s : s + len,
    end: dir > 0 ? s + len : s
  };
}
function strafeImpact(x) {
  if (!onScreen(x, 0)) return;
  dust.push({ x, y: GROUND - 2, vx: (Math.random() - 0.5) * 2.5, vy: -0.5 - Math.random() * 1.5, r: 3, grow: 0.35, life: 22, max: 22, a: 0.5, c: '118,100,72' });
}
function updateStrafe() {
  if (!plane && !won && strafeTimer === WARN_FRAMES) warn.strafe = WARN_FRAMES;
  if (!plane && !won && --strafeTimer <= 0) {
    strafeTimer = nextStrafe();
    launchStrafe();
  }
  if (plane) {
    plane.x += plane.dir * STRAFE_SPEED;
    shake = Math.max(shake, 1.5);                           // лёгкая дрожь от низкого пролёта
    for (let i = 0; i < STRAFE_RATE; i++) {
      const x = plane.x + (Math.random() - 0.5) * STRAFE_SCATTER;
      const y = -20 - Math.random() * STRAFE_BULLET_SPEED;
      strafeShots.push({
        x, y, px: x, py: y,
        vx: plane.dir * 3 + (Math.random() - 0.5) * 2,
        vy: STRAFE_BULLET_SPEED * (0.9 + Math.random() * 0.2)
      });
    }
    if ((plane.x - plane.end) * plane.dir >= 0 || won) plane = null;
  }
  for (let i = strafeShots.length - 1; i >= 0; i--) {
    const b = strafeShots[i];
    b.px = b.x; b.py = b.y;
    let dead = false;
    for (let k = 0; k < 3 && !dead; k++) {
      b.x += b.vx / 3;
      b.y += b.vy / 3;
      if (b.y >= GROUND) { strafeImpact(b.x); dead = true; break; }
      if (b.x < 0 || b.x > WORLD_W || shardBlocked(b.x, b.y)) { dead = true; break; }
      for (const u of everybody()) {
        const h = u.hero;
        if (Math.abs(b.x - h.p.pelvis.x) > 170) continue;
        for (const seg of h.segs) {
          if (distToSeg(b.x, b.y, h.p[seg.a], h.p[seg.b]) < seg.ry * 0.8 + 2) {
            for (const n of [seg.a, seg.b]) {
              h.p[n].px -= b.vx * 0.05;
              h.p[n].py -= b.vy * 0.05;
            }
            u.health.onShrapnel(seg.b);
            addWound(u, seg, b.x, b.y, 'bullet', b.vx, b.vy);
            dead = true;
            break;
          }
        }
        if (dead) break;
      }
    }
    if (dead || b.y > H + 200) strafeShots.splice(i, 1);
  }
}
function spawnDust(x, power) {
  for (let i = 0; i < 28 * power; i++) {
    const low = Math.random() < 0.5;
    const side = Math.random() < 0.5 ? -1 : 1;
    const life = 120 + Math.random() * 120;
    dust.push({
      x: x + (Math.random() - 0.5) * 60 * power, y: GROUND - 6,
      vx: low ? side * (3 + Math.random() * 9) : (Math.random() - 0.5) * 6,
      vy: low ? -Math.random() * 1.2 : -(1 + Math.random() * 4.5),
      r: 10 + Math.random() * 18, grow: 0.5 + Math.random() * 0.5,
      life, max: life, a: 0.55,
      c: Math.random() < 0.5 ? '118,100,72' : '84,72,52'
    });
  }
  for (let i = 0; i < 45 * power; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const sp = (5 + Math.random() * 14) * Math.sqrt(power);
    const life = 90 + Math.random() * 70;
    debris.push({
      x: x + (Math.random() - 0.5) * 30, y: GROUND - 8,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      s: 2 + Math.random() * 5, life, max: life,
      c: DIRT[(Math.random() * DIRT.length) | 0]
    });
  }
}
function updateDust() {
  for (let i = dust.length - 1; i >= 0; i--) {
    const d = dust[i];
    d.x += d.vx; d.y += d.vy;
    d.vx *= 0.97; d.vy *= 0.97;
    d.r += d.grow;
    if (--d.life <= 0) dust.splice(i, 1);
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.vy += 0.5;
    d.x += d.vx; d.y += d.vy;
    d.vx *= 0.995;
    if (d.y >= GROUND - d.s / 2) { d.y = GROUND - d.s / 2; d.vx = 0; d.vy = 0; } // упал и лежит
    if (--d.life <= 0) debris.splice(i, 1);
  }
  shake *= 0.9;
  if (shake < 0.1) shake = 0;
}
// ===== Раны: пулевые отверстия, кровотечение, капли и лужи =====
const WOUND_PART = { head: 'head', neck: 'head', chest: 'torso', pelvis: 'torso', elbow: 'arms', wrist: 'arms', knee: 'legs', ankle: 'legs', toe: 'legs' };
const MAX_WOUNDS = 40;                 // отметок на одного бойца
const blood = [];                      // летящие капли
const bloodPools = [];                 // лужи на земле
const partOfSeg = seg => WOUND_PART[seg.b.replace(/[BF]$/, '')];

// положение раны в мире (привязана к сегменту: t — вдоль кости, o — в стороне от оси)
function woundPos(h, w) {
  const seg = h.segs[w.si], A = h.p[seg.a], B = h.p[seg.b];
  const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1;
  const k = w.o * w.f * h.f * seg.ry;  // h.f / w.f — боец мог развернуться
  return { x: A.x + dx * w.t - dy / l * k, y: A.y + dy * w.t + dx * 1 / l * k };
}
function pushWound(h, w) {
  const seg = h.segs[w.si];
  const big = w.kind === 'tear' ? 1.4 : w.kind === 'frag' ? 1.2 : w.kind === 'slash' ? 1.3 : w.kind === 'burn' ? 1.5 : w.kind === 'bruise' ? 1.3 : w.kind === 'graze' ? 0.6 : 1;
  Object.assign(w, {
    f: h.f, r: 1.6 * big, stain: 2.5 * big, maxStain: Math.min(seg.ry * 1.1, 4.5 + 3 * big),
    drip: 0, maxDrip: seg.ry * 1.1, dx: (Math.random() - 0.5) * 1.2, wet: 1
  });
  h.wounds = h.wounds || [];
  h.wounds.push(w);
  if (h.wounds.length > MAX_WOUNDS) h.wounds.shift();
}
// попадание пули / осколка в сегмент seg бойца u в мировой точке (x, y)
function addWound(u, seg, x, y, kind, vx, vy) {
  const h = u.hero;
  if (u.health.state.dead) return;
  const si = h.segs.indexOf(seg);
  if (si < 0) return;
  if (u.health.state.blocked) {                      // каска / жилет выдержали: вмятина и искры вместо раны
    const torso = u.health.state.blockedPart === 'torso';
    const hs = torso ? si : h.segs.findIndex(s => s.b === 'head');
    pushWound(h, { part: torso ? 'torso' : 'head', si: hs, t: torso ? 0.2 + Math.random() * 0.6 : 0.6 + Math.random() * 0.35, o: (Math.random() - 0.5) * 0.7, kind: 'dent' });
    for (let i = 0; i < 6; i++) dust.push({ x, y, vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 4, r: 1.6, grow: 0, life: 9, max: 9, a: 0.9, c: '255,225,130' });
    hitReact(h, torso ? 'torso' : 'head', vx || 0, vy || 0, 0.45);
    return;
  }
  const A = h.p[seg.a], B = h.p[seg.b];
  const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1;
  const t = Math.max(0.05, Math.min(0.95, ((x - A.x) * dx + (y - A.y) * dy) / (l * l)));
  const nx = -dy / l, ny = dx / l;
  const o = ((x - (A.x + dx * t)) * nx + (y - (A.y + dy * t)) * ny) / seg.ry * 0.6;
  let k = kind;                                                           // разнообразие ран
  if (kind === 'frag') { const r = Math.random(); k = r < 0.55 ? 'frag' : r < 0.85 ? 'slash' : 'burn'; }   // осколок: дыра, порез или ожог от горячего металла
  else if (kind === 'bullet' && Math.abs(o) > 0.42) k = 'graze';          // по касательной — царапина
  pushWound(h, { part: partOfSeg(seg), si, t, o: Math.max(-0.85, Math.min(0.85, o)), kind: k });
  hitReact(h, partOfSeg(seg), vx || 0, vy || 0, k === 'graze' ? 0.4 : kind === 'frag' ? 0.7 : 1);
  spawnBlood(x, y, k === 'burn' ? 0 : k === 'graze' ? 2 : kind === 'frag' ? 7 : 5, -(vx || 0) * 0.1, -2, 5);   // брызги
}
// рана без отметки (например, от взрыва) — рваная
function addTear(h, part) {
  const list = [];
  h.segs.forEach((s, i) => { if (partOfSeg(s) === part) list.push(i); });
  if (!list.length) return;
  const r = Math.random();                                                // разнообразие ран от взрыва
  const kind = r < 0.4 ? 'tear' : r < 0.65 ? 'burn' : r < 0.85 ? 'slash' : 'bruise';
  pushWound(h, { part, si: list[(Math.random() * list.length) | 0], t: 0.2 + Math.random() * 0.6, o: (Math.random() - 0.5) * 1.1, kind });
}
// ===== Расчленёнка: у погибших от взрыва отлетают конечности =====
const DISMEMBER_K = 0.3;   // с какой силы удара по конечности её может оторвать
// рвёт связь an–bn (an — со стороны туловища): bn и всё, что за ней, отлетает отдельным куском
function severAt(h, an, bn, bx, k, power) {
  const P = h.p, A = P[an], B = P[bn];
  const si = h.segs.findIndex(s => s.a === an && s.b === bn);
  const st = h.sticks.findIndex(s => (s.a === A && s.b === B) || (s.a === B && s.b === A));
  if (si < 0 || st < 0) return;
  const seg = h.segs[si], len = h.sticks[st].len;
  h.sticks.splice(st, 1);
  const vn = 'cut' + (h.cutN = (h.cutN || 0) + 1);                 // у отлетающей части свой край вместо общего сустава
  const V = { x: A.x, y: A.y, px: A.px, py: A.py, fx: A.x, plant: false, r: 3, m: 0.8 };
  P[vn] = V;
  seg.a = vn;
  h.sticks.push({ a: V, b: B, len });
  const grp = new Set([V, B]);                                      // всё, что держится за отлетающим краем
  for (let grew = true; grew;) {
    grew = false;
    for (const s of h.sticks) {
      if (grp.has(s.a) !== grp.has(s.b)) { grp.add(s.a); grp.add(s.b); grew = true; }
    }
  }
  h.ranges = h.ranges.filter(r => grp.has(r.a) === grp.has(r.b));   // ограничители между телом и куском больше не нужны
  const dir = Math.sign(B.x - bx) || (Math.random() < 0.5 ? -1 : 1);
  const vx = dir * (4 + Math.random() * 6) * (0.6 + 0.6 * k) * Math.sqrt(power);
  const vy = -(3 + Math.random() * 7) * Math.sqrt(power);
  for (const q of grp) { q.px -= vx + (Math.random() - 0.5) * 2; q.py -= vy + (Math.random() - 0.5) * 2; }   // кусок летит и кувыркается
  (h.stumps = h.stumps || []).push({ n: an, r: seg.ry * 0.9, t: 150 }, { n: vn, r: seg.ry * 0.9, t: 150, trail: true });
  spawnBlood(A.x, A.y, 14, dir * 2, -3, 6);
  spawnBlood(V.x, V.y, 10, dir * 4, -4, 6);
  for (let i = 0; i < 6; i++) {                                     // ошмётки
    debris.push({ x: A.x, y: A.y, vx: (Math.random() - 0.5) * 8 + dir * 2, vy: -Math.random() * 6,
      s: 2 + Math.random() * 3, life: 300, max: 300, c: Math.random() < 0.5 ? '#7a1010' : '#a02020' });
  }
}
function dismember(h, hits, bx, power, wasDead) {
  const cuts = h.cuts = h.cuts || {};
  const hit = (...names) => Math.max(0, ...names.map(n => hits[n] || 0));
  const mul = (wasDead ? 0.5 : 1) * (0.7 + 0.3 * Math.sqrt(power));   // труп, которого добивают, рвёт реже
  const roll = k => Math.random() < Math.min(0.95, Math.max(0, k - DISMEMBER_K) * 1.8 * mul);
  for (const s of ['B', 'F']) {
    const ka = hit('elbow' + s, 'wrist' + s);
    if (!cuts['arm' + s] && roll(ka)) {
      cuts['arm' + s] = true;
      if (ka > 0.65 && Math.random() < 0.6) severAt(h, 'chest', 'elbow' + s, bx, ka, power);        // рука целиком
      else severAt(h, 'elbow' + s, 'wrist' + s, bx, ka, power);                                      // предплечье с кистью
    }
    const kl = hit('knee' + s, 'ankle' + s, 'toe' + s);
    if (!cuts['leg' + s] && roll(kl)) {
      cuts['leg' + s] = true;
      if (kl > 0.75 && Math.random() < 0.5) severAt(h, 'pelvis', 'knee' + s, bx, kl, power);         // нога целиком
      else if (kl > 0.5 && Math.random() < 0.6) severAt(h, 'knee' + s, 'ankle' + s, bx, kl, power);  // голень со стопой
      else severAt(h, 'ankle' + s, 'toe' + s, bx, kl, power);                                        // стопа
    }
  }
  const kh = hit('head', 'neck');
  if (!cuts.head && kh > 0.8 && Math.random() < 0.35 * mul) {
    cuts.head = true;
    severAt(h, 'chest', 'neck', bx, kh, power);                                                      // голову сорвало
  }
}
// ===== Слетевшие каски =====
const helmets = [];
function spawnHelmet(h) {
  const p = h.p.head;
  helmets.push({
    x: p.x, y: p.y - 6,
    vx: -h.f * (1 + Math.random() * 3) + (Math.random() - 0.5) * 2,
    vy: -4 - Math.random() * 3,
    a: 0, va: (Math.random() - 0.5) * 0.6,
    col: h.helmetC || COLORS.helmet
  });
  if (helmets.length > 40) helmets.shift();
}
function updateHelmets() {
  for (const m of helmets) {
    if (m.rest) continue;
    m.vy += GRAVITY;
    m.x += m.vx; m.y += m.vy; m.a += m.va;
    if (m.y >= GROUND - 5) {
      m.y = GROUND - 5;
      if (Math.abs(m.vy) > 2) {                       // отскок
        m.vy = -m.vy * 0.35; m.vx *= 0.7; m.va *= 0.7;
      } else {                                         // катится и успокаивается
        m.vy = 0; m.vx *= 0.8; m.va *= 0.8;
        m.a += (Math.round(m.a / Math.PI) * Math.PI - m.a) * 0.15;
        if (Math.abs(m.vx) < 0.1 && Math.abs(m.va) < 0.02) m.rest = true;
      }
    }
  }
}
function spawnBlood(x, y, n, vx, vy, spread) {
  for (let i = 0; i < n; i++) {
    if (blood.length > 400) blood.shift();
    blood.push({
      x, y,
      vx: vx + (Math.random() - 0.5) * spread,
      vy: vy + (Math.random() - 0.5) * spread,
      r: 1 + Math.random() * 1.2, life: 90
    });
  }
}
function landBlood(x, r) {
  for (const p of bloodPools) {
    if (Math.abs(p.x - x) < p.r + 8) {
      p.maxR = Math.min(34, p.maxR + r * 0.5);
      p.grow = Math.max(p.grow, 0.04);
      return;
    }
  }
  bloodPools.push({ x, r, maxR: 4 + r * 2, grow: 0.04 });
  if (bloodPools.length > 60) bloodPools.shift();
}
// вызывается для каждого бойца внутри stepHero (hero и Health — текущего бойца)
function updateWounds() {
  const h = hero, st = Health.state;
  const ws = h.wounds || (h.wounds = []);
  if (h.stumps) for (const s of h.stumps) {                  // из культей хлещет кровь, потом капает
    if (s.t <= 0) continue;
    s.t--;
    const q = h.p[s.n];
    if (Math.random() < (s.trail ? 0.6 : 0.35) * Math.min(1, s.t / 60)) spawnBlood(q.x, q.y, 1, (q.x - q.px) * 0.3, (q.y - q.py) * 0.3 - 1, 2.5);
  }
  if (st.helmet <= 0 && !h.helmetOff) { h.helmetOff = true; spawnHelmet(h); }   // каска разрушена — слетает
  if (st.armor <= 0 && !h.armorOff) {                                           // бронежилет разрушен — обломки пластин
    h.armorOff = true;
    const c = h.p.chest;
    for (let i = 0; i < 8; i++) {
      debris.push({
        x: c.x + (Math.random() - 0.5) * 14, y: c.y + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 4,
        s: 4 + Math.random() * 3, life: 400, max: 400, c: i % 2 ? '#3f4a35' : '#2c3524'
      });
    }
  }
  if (st.dead && !h.deathPool) {                           // под погибшим растёт лужа
    h.deathPool = true;
    if (ws.length) bloodPools.push({ x: h.p.pelvis.x, r: 5, maxR: 22 + Math.min(18, ws.length * 3), grow: 0.1 });
    if (bloodPools.length > 60) bloodPools.shift();
  }
  const bleeding = !st.dead && st.bleed > 0.03;
  const cnt = { head: 0, torso: 0, arms: 0, legs: 0 };
  for (let i = ws.length - 1; i >= 0; i--) {
    const w = ws[i];
    if (w.kind === 'dent') { if ((w.part === 'torso' ? st.armor : st.helmet) <= 0) ws.splice(i, 1); continue; }   // вмятины живут, пока есть каска / жилет
    if (!st.wound[w.part]) {                               // перевязано — рана уходит под бинт на том же месте
      if (h.wrap[w.part] > 0) {
        const dr = h.dress || (h.dress = {});
        (dr[w.part] || (dr[w.part] = [])).push({ si: w.si, t: w.t, o: w.o * w.f, kind: w.kind });
      }
      ws.splice(i, 1); continue;
    }
    cnt[w.part]++;
    if (w.kind === 'burn' || w.kind === 'bruise') continue;  // ожоги и гематомы не кровоточат
    w.wet = bleeding ? Math.min(1, w.wet + 0.05) : Math.max(0, w.wet - 0.0015);   // кровь подсыхает
    if (!bleeding) continue;
    w.stain = Math.min(w.maxStain, w.stain + 0.006 * st.bleed);
    w.drip = Math.min(w.maxDrip, w.drip + 0.02 * st.bleed);
    if (Math.random() < Math.min(0.3, st.bleed * 0.12 / ws.length)) {
      const p = woundPos(h, w);
      spawnBlood(p.x, p.y, 1, 0, 0, 0.8);                  // капля
    }
  }
  if (h.dress) for (const part in h.dress) {               // бинт снят / сброшен — следов не остаётся
    if (!(h.wrap[part] > 0)) delete h.dress[part];
  }
  for (const part in cnt) {                                // открытая рана без отметок (взрыв и т.п.)
    if (!st.wound[part]) continue;
    const dr = h.dress && h.dress[part];
    if (dr && dr.length) {                                 // бинт промок — кровь проступает на тех же местах
      for (const d of dr) { pushWound(h, { part, si: d.si, t: d.t, o: d.o * h.f, kind: d.kind }); cnt[part]++; }
      delete h.dress[part];
    }
    const need = Math.min(6, 1 + Math.floor((100 - st.parts[part]) / 30));
    while (cnt[part] < need) { addTear(h, part); cnt[part]++; }
  }
}
function updateBlood() {
  for (let i = blood.length - 1; i >= 0; i--) {
    const d = blood[i];
    d.vy += 0.35;
    d.x += d.vx; d.y += d.vy;
    d.vx *= 0.99;
    if (d.y >= GROUND - 1) { landBlood(d.x, d.r); blood.splice(i, 1); }
    else if (--d.life <= 0) blood.splice(i, 1);
  }
  for (const p of bloodPools) if (p.r < p.maxR) p.r = Math.min(p.maxR, p.r + p.grow);
}
const WORLD_W = 20000;
const START_X = 220;
const FINISH_X = WORLD_W - 260;
const props = [];
let camX = 0;
let won = false;
let worldSeed = 1;
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const onScreen = (x, w) => x + w > camX - 40 && x < camX + W + 40;
function genWorld() {
  worldSeed = Math.random() * 1000;
  props.length = 0;
  let k = 0;
  const rnd = () => hash(worldSeed + k++);
  let x = 650;
  while (x < FINISH_X - 450) {
    const r = rnd();
    let p;
    if (r < 0.26) p = { type: 'sandbags', w: 100 + rnd() * 70, h: 44 };
    else if (r < 0.46) p = { type: 'barrier', w: 58, h: 72 };
    else if (r < 0.598) p = { type: 'medkit', w: 64, h: 44, left: 30, deco: true };   // 12% → 13,8% (+15%)
    else if (r < 0.678) p = { type: 'armor', w: 86, h: 56, left: 5, deco: true };     // станция брони: 5 комплектов
    else if (r < 0.86) p = { type: 'trench', w: 360 + rnd() * 220, h: 58 };
    else if (r < 0.94) p = { type: 'house', w: 300 + rnd() * 60, h: 262 };
    else p = { type: 'wire', w: 120 + rnd() * 110, h: 34, deco: true };
    p.x = x;
    p.s = rnd() * 1000;
    props.push(p);
    x += p.w + 220 + rnd() * 420;
  }
}
function updateCamera() {
  const target = hero.p.pelvis.x - W * 0.4;
  const max = Math.max(0, WORLD_W - W);
  camX += (Math.max(0, Math.min(max, target)) - camX) * 0.08;
  mouse.x = mouse.sx + camX;
}
function updateWorld() {
  if (!won && !Health.state.dead && hero.p.pelvis.x >= FINISH_X) {
    won = true;
    rockets.length = 0;
    strafeShots.length = 0;
    plane = null;
    warn.rocket = warn.strafe = warn.mega = 0;
  }
}
const HOUSE_WALL = 16;                          // толщина боковых стен
const HOUSE_WIN_LO = 85, HOUSE_WIN_HI = 150;    // окно в боковой стене: от 85 до 150 px над землёй
const COT_LEN = 110;                            // длина койки
// блокирует ли дом пулю в точке (x, y): крыша и боковые стены (кроме окон); внутри свободно
function houseBlocks(c, x, y) {
  if (y < GROUND - c.h + 36) return true;                       // крыша
  if (x < c.x + HOUSE_WALL || x > c.x + c.w - HOUSE_WALL) {     // боковые стены
    const up = GROUND - y;
    return !(up > HOUSE_WIN_LO && up < HOUSE_WIN_HI);           // в окно пуля пролетает
  }
  return false;
}
function shardBlocked(x, y) {
  for (const c of props) {
    if (c.deco || !(x > c.x && x < c.x + c.w && y > GROUND - c.h)) continue;
    if (c.type === 'house') { if (houseBlocks(c, x, y)) return true; continue; }
    return true;
  }
  return false;
}
function coverFactor(px, py, bx, by) {
  for (const c of props) {
    if (c.deco) continue;
    if (!(px > c.x && px < c.x + c.w && py > GROUND - c.h)) continue;
    if (c.type === 'house') {
      // взрыв снаружи или на крыше почти не задевает тех, кто в доме; взрыв внутри (граната) — в полную силу
      if (by === undefined || by < GROUND - c.h + 8 || bx < c.x || bx > c.x + c.w) return 0.3;
      continue;
    }
    if (bx < c.x || bx > c.x + c.w) return 0.35;
  }
  return 1;
}
const squad = [];
const LIE_MIN = 780, LIE_MAX = 1020;
const LIE_FOR = 150;
const ALLY_SHIRTS = [['#6b5d3b', '#54482c'], ['#4f6a5a', '#3d5446'], ['#6a4f3b', '#523c2c'], ['#5a5f6f', '#464a58']];
const everyone = () => [{ hero, health: playerHealth }, ...squad];
function runAs(a, fn) {
  const sv = { hero, Health, stun, keys, standing };
  hero = a.hero; Health = a.health; stun = a.stun; keys = a.keys; standing = true;
  try {
    fn();
  } finally {
    a.stun = stun;
    hero = sv.hero; Health = sv.Health; stun = sv.stun; keys = sv.keys; standing = sv.standing;
  }
}
function runAll(fn) {
  fn();
  for (const a of squad) runAs(a, fn);
  for (const a of foes) runAs(a, fn);
}
function tintUnit(h, i) {
  const [light, dark] = ALLY_SHIRTS[i % ALLY_SHIRTS.length];
  for (const s of h.segs) {
    if (s.c === COLORS.shirt) s.c = light;
    else if (s.c === COLORS.shirtDark) s.c = dark;
  }
}
function genSquad() {
  squad.length = 0;
  const n = 4 + Math.floor(Math.random() * 5);
  for (let i = 0; i < n; i++) {
    const x = START_X + (i % 2 ? -1 : 1) * (55 + 40 * Math.floor(i / 2));
    const h = createHero(x);
    h.phase = Math.random() * Math.PI * 2;
    tintUnit(h, i);
    h.sniper = Math.random() < 0.3;
    if (h.sniper) h.ammo = SNIPER_MAG;
    squad.push({
      hero: h, health: makeHealth(false), keys: {}, stun: 0,
      lieT: LIE_MIN + Math.random() * (LIE_MAX - LIE_MIN), lieFor: 0, medic: null,
      stopX: FINISH_X - 30 - i * 35, sniper: h.sniper
    });
  }
  if (!squad.some(a => a.sniper)) {
    const s = squad[Math.floor(Math.random() * squad.length)];
    s.sniper = s.hero.sniper = true;
    s.hero.ammo = SNIPER_MAG;
  }
  const mm = squad.filter(a => !a.sniper);                  // медик — не снайпер; шанс 25%, но минимум один
  mm.forEach(a => { a.isMedic = a.hero.isMedic = Math.random() < 0.25; });
  if (mm.length && !mm.some(a => a.isMedic)) {
    const m = mm[Math.floor(Math.random() * mm.length)];
    m.isMedic = m.hero.isMedic = true;
  }
  // личный медик игрока: появляется дополнительно к отряду и держится рядом с игроком
  const ph = createHero(START_X - 25);
  ph.phase = Math.random() * Math.PI * 2;
  tintUnit(ph, squad.length);
  ph.isMedic = 'personal';
  squad.push({
    hero: ph, health: makeHealth(false), keys: {}, stun: 0,
    lieT: 1e9, lieFor: 0, medic: null,          // не ложится «отдыхать» сам
    stopX: FINISH_X, isMedic: 'personal', personal: true
  });
}
function withUnit(u, fn) {
  const sh = hero, sH = Health;
  hero = u.hero; Health = u.health;
  try { return fn(); } finally { hero = sh; Health = sH; }
}
function needsHelp(u, byMedic) {
  const st = u.health.state;
  if (st.dead) return false;
  const wounded = st.wound.head || st.wound.torso || st.wound.arms || st.wound.legs;
  const isPlayer = u.hero === hero;
  if (byMedic && st.concussion > CONCUSS_HELP) return !isPlayer || byMedic === 'personal' || hero.walk < 0.3;   // медик выводит из контузии
  if (!wounded) return false;
  if (byMedic) return !isPlayer || byMedic === 'personal' || hero.walk < 0.3;   // медик лечит и тех, кто на ногах (игрока — когда он стоит на месте)
  return st.ko > 0 || st.broken || (isPlayer ? stun : u.stun) > 0 || (isPlayer && hero.lie > 0.6);
}
function nearestMedkit(x) {
  let best = null;
  for (const c of props) {
    if (c.type !== 'medkit' || c.left <= 0) continue;
    const d = Math.abs(c.x + c.w / 2 - x);
    if (d < 700 && (!best || d < best.d)) best = { c, d };
  }
  return best && best.c;
}
const TURN_DELAY = 15;   // кадров, которые боец должен «хотеть» новое направление, прежде чем сменить его
function steadyDir(a, want) {
  if (a.dir === undefined) { a.dir = 0; a.dirT = 0; }
  if (want === a.dir) { a.dirT = 0; return want; }
  if (++a.dirT >= TURN_DELAY) { a.dir = want; a.dirT = 0; return want; }
  return 0;
}
function aiThink(a) {
  const k = a.keys, st = a.health.state, x = a.hero.p.pelvis.x;
  k.KeyA = k.KeyD = k.KeyR = k.KeyS = k.ShiftLeft = false;
  a.hero.treat = null;
  combatThink(a);
  if (st.dead || st.ko > 0 || a.stun > 0) dropCarry(a);
  if (st.dead) return;
  if (a.lieFor > 0) a.lieFor--;
  else if (!a.personal) {                                         // ложимся только по предупреждению об ударе
    const w = warn.mega > 0 ? 2 : (warn.rocket > 0 || warn.strafe > 0) ? 1 : 0;
    if (!w) a.lieDelay = null;                                    // предупреждение закончилось — сброс
    else {
      if (a.lieDelay == null) a.lieDelay = Math.random() * 35;    // у каждого своя задержка реакции
      if (--a.lieDelay <= 0) {
        a.lieFor = LIE_FOR + (w === 2 ? 120 : 0);                 // мегаракета — лежим дольше
        a.lieDelay = 1e9;                                         // не ложиться повторно до конца этого предупреждения
      }
    }
  }
  if (a.lieFor > 0) { k.ShiftLeft = true; return; }
  if (a.stun > 0 || st.ko > 0) { a.medic = null; return; }
  const danger = !!a.tgt && Math.abs(a.tgt.hero.p.pelvis.x - x) < (a.sniper ? SNIPER_RANGE : FIRE_RANGE);   // враг в зоне огня — не перевязываемся
  if (a.hero.cot) {                                              // лежит на койке: встаёт при опасности или когда здоров
    if (danger || isHealed(st)) releaseCot(a.hero);
    else { k.KeyR = true; return; }
  }
  if (a.carry) {                                                  // несёт раненого к медику
    const med = nearestMedic(x, a);
    if (!med || !isDown(a.carry)) dropCarry(a, 300);
    else if (Math.abs(med.hero.p.pelvis.x - x) < 120) dropCarry(a, 900);   // донёс — этого не поднимать 15 с
    else if (danger) dropCarry(a, 300);
    else { if (med.hero.p.pelvis.x > x) k.KeyD = true; else k.KeyA = true; return; }
  } else if (!a.isMedic && !a.sniper && !danger && st.blood > 40 && !a.hero.cot && !(a.carryCD > 0)) {
    let best = null;
    for (const u of everyone()) {                                 // ищем потерявшего сознание, которого стоит вынести
      if (u.hero === a.hero || !isDown(u) || u.hero.carriedBy || u.hero.noCarryT > 0) continue;
      const cx = u.hero.p.pelvis.x, d = Math.abs(cx - x);
      if (d >= 350 || (best && d >= best.d)) continue;
      const med = nearestMedic(cx, a);
      if (!med || med.medic === u.hero || Math.abs(med.hero.p.pelvis.x - cx) < 250) continue;   // медика нет, он уже рядом или уже идёт к раненому
      best = { u, d };
    }
    if (best) {
      if (best.d > 40) { if (best.u.hero.p.pelvis.x > x) k.KeyD = true; else k.KeyA = true; return; }
      a.carry = best.u; best.u.hero.carriedBy = a.hero; a.hero.carrying = true;
      return;
    }
  }
  let patient = a.medic ? everyone().find(u => u.hero === a.medic) : null;
  if (patient && (danger || patient.hero === a.hero || !needsHelp(patient, a.isMedic) || Math.abs(patient.hero.p.pelvis.x - x) > (a.isMedic ? 1100 : 600))) {
    patient = a.medic = null;
  }
  if (a.personal && !danger) {                                    // личный медик: игрок — в первую очередь, всегда
    const pl = everyone()[0];
    if (needsHelp(pl, a.isMedic)) { patient = pl; a.medic = pl.hero; }
  }
  if (!patient && !danger && st.blood > 40) {
    let best = null;
    for (const u of everyone()) {
      if (u.hero === a.hero || !needsHelp(u, a.isMedic)) continue;
      if (a.personal && Math.abs(u.hero.p.pelvis.x - hero.p.pelvis.x) > 500) continue;   // от игрока далеко не уходит
      if (squad.some(b => b !== a && b.medic === u.hero)) continue;
      const d = Math.abs(u.hero.p.pelvis.x - x);
      if (d < (a.isMedic ? 900 : 450) && (!best || d < best.d)) best = { u, d };
    }
    if (best) { patient = best.u; a.medic = patient.hero; }
  }
  if (patient) {
    const part = withUnit(patient, () => pickWound(false));
    const conc = !!a.isMedic && patient.health.state.concussion > CONCUSS_HELP;
    if (part || conc) {
      const px = part ? withUnit(patient, () => woundPoint(part)).x : patient.hero.p.pelvis.x;
      const dx = px - x;
      if (Math.abs(dx) > 40) {
        if (dx > 0) k.KeyD = true; else k.KeyA = true;
      } else {
        a.hero.treat = patient;
        patient.hero.beingTreated = 3;                  // пациент останавливается, пока медик рядом
        const pvx = (a.personal && patient.hero === hero) ? hero.p.pelvis.x - hero.p.pelvis.px : 0;
        if (Math.abs(pvx) > 0.3) { if (pvx > 0) k.KeyD = true; else k.KeyA = true; }   // игрок идёт — медик идёт рядом и лечит
        else k.KeyS = true;
      }
      return;
    }
    a.medic = null;
  }
  const w = st.wound;
  const anyWound = w.head || w.torso || w.arms || w.legs;
  let dir = formationDir(a, x);
  if (a.hero.beingTreated > 0) { a.hero.beingTreated--; dir = 0; }   // его бинтует медик — стоим
  if (w.legs && !w.head && !w.torso && !w.arms) dir = 0;
  if (a.tgt) {                                   // враг рядом или позади — остановиться, развернуться, стрелять
    const dx = a.tgt.hero.p.pelvis.x - x;
    if (Math.abs(dx) < a.holdD || dx * dir <= 0) dir = 0;
    if (a.coverX != null) {                      // идём в укрытие и пригибаемся за ним
      const cx = a.coverX - x;
      dir = Math.abs(cx) > 14 ? Math.sign(cx) : 0;
      if (dir === 0) k.KeyS = true;
    } else if (dir === 0 && a.cover) k.KeyS = true;
  }
  if (a.sniper && a.tgt) { dir = 0; k.KeyS = true; }   // снайпер: встал на месте, присел, стреляет
  if (a.personal) { dir = followPlayer(a, x); k.KeyS = false; }   // личный медик не уходит в укрытие и не отстаёт
  if (!danger && !a.tgt && !a.personal && a.health.needsArmor()) {   // броня изношена — к ближайшей станции (до 600 px), подбор срабатывает сам
    const c = nearestArmor(x, 600);
    if (c) { const dx = c.x + c.w / 2 - x; dir = Math.abs(dx) > 20 ? Math.sign(dx) : 0; }
  }
  if (st.blood < 60 && !danger) {
    const c = nearestMedkit(x);
    if (c) {
      const dx = c.x + c.w / 2 - x;
      dir = Math.abs(dx) > 24 ? Math.sign(dx) : 0;
      k.KeyR = true;
    }
  }
  if (!danger && !a.personal && !a.hero.cot && (anyWound || st.blood < 70)) {    // раненый идёт к свободной койке (до 600 px)
    const cot = nearestCot(x, a.hero);
    if (cot) {
      const dx = cotX(cot) - x;
      dir = Math.abs(dx) > 24 ? Math.sign(dx) : 0;
      if (dir === 0) k.KeyR = true;
    }
  }
  if (anyWound && !danger) k.KeyR = true;
  dir = steadyDir(a, dir);
  if (dir > 0) k.KeyD = true; else if (dir < 0) k.KeyA = true;
}
// ===== Построение отряда: здоровые с каской впереди, раненые в хвосте =====
const FORM_GAP = 55;                      // интервал между бойцами в колонне, px
const FORM_MIN = 900, FORM_MAX = 1800;    // перестроение раз в 15–30 с (кадров)
const FORM_HOLD_MAX = 1500;               // сколько максимум ждать, пока залечатся (25 с)
const formation = { mode: 'march', n: -1, hurtN: 0, reformT: FORM_MIN, t: 0, holdX: 0, leadX: 0 };

function isHurt(a) {
  const st = a.health.state, w = st.wound;
  return !!(w.head || w.torso || w.arms || w.legs) || st.ko > 0 || st.blood < 45;
}
function squadScore(a) {
  const st = a.health.state, w = st.wound;
  const parts = (st.parts.head + st.parts.torso + st.parts.arms + st.parts.legs) / 4;
  const wounds = (w.head ? 1 : 0) + (w.torso ? 1 : 0) + (w.arms ? 1 : 0) + (w.legs ? 1 : 0);
  return st.blood * 0.3 + parts * 0.3 + (st.helmet > 0 ? 25 : 0) + (st.armor > 0 ? 20 : 0) - wounds * 25 - (st.ko > 0 ? 50 : 0);
}
function reformSquad(live) {
  const F = formation;
  live.sort((p, q) => squadScore(q) - squadScore(p));      // лучшие — вперёд
  live.forEach((a, i) => { a.rank = i; });
  F.reformT = FORM_MIN + Math.random() * (FORM_MAX - FORM_MIN);
  if (live.some(isHurt)) {                                  // есть раненые — встаём и ждём, пока залечатся
    F.mode = 'hold';
    F.t = FORM_HOLD_MAX;
    F.holdX = Math.max(...live.map(a => a.hero.p.pelvis.x));
  }
}
function updateFormation() {
  const F = formation;
  const live = squad.filter(a => !a.health.state.dead && !a.personal);
  if (!live.length) return;
  if (live.length !== F.n) { F.n = live.length; reformSquad(live); }          // потери — перестроиться
  const hurtN = live.filter(isHurt).length;
  if (hurtN > F.hurtN) F.reformT = Math.min(F.reformT, 240);                  // кого-то ранило — скоро перестроимся
  F.hurtN = hurtN;
  if (F.mode === 'hold') {
    if (--F.t <= 0 || hurtN === 0) F.mode = 'march';                          // все залечились (или ждали слишком долго)
  } else if (--F.reformT <= 0) {
    reformSquad(live);
  }
  const lead = live.find(a => a.rank === 0);
  F.leadX = lead ? lead.hero.p.pelvis.x : 0;
  const snp = live.find(a => a.sniper && a.tgt && a.health.state.ko === 0 && a.stun <= 0);   // снайпер работает
  F.snipeA = snp || null;
  F.snipeX = snp ? snp.hero.p.pelvis.x : null;
}
// куда идти бойцу по построению: -1 / 0 / 1
function formationDir(a, x) {
  const F = formation;
  if (a.rank === undefined) return x < a.stopX ? 1 : 0;
  if (F.snipeX != null && a !== F.snipeA) {                // снайпер стреляет — все стягиваются к нему и ждут
    const slot = 50 + 35 * Math.floor(a.rank / 2);
    const tx = F.snipeX + (a.rank % 2 ? -1 : 1) * slot;
    const dd = tx - x;
    a.hero.speedK = 1 + Math.min(0.3, Math.max(0, Math.abs(dd) - 40) / 400);
    return Math.abs(dd) > 16 ? Math.sign(dd) : 0;
  }
  let target, dir;
  if (F.mode === 'hold') {
    target = F.holdX - a.rank * FORM_GAP;                 // своё место: здоровые вперёд, раненые назад
    const d = target - x;
    dir = Math.abs(d) > 16 ? Math.sign(d) : 0;
  } else if (a.rank === 0) {
    target = x;
    dir = x < a.stopX ? 1 : 0;                            // голова колонны идёт к финишу
  } else {
    target = F.leadX - a.rank * FORM_GAP;                 // остальные держатся за ней
    dir = x < target - 14 && x < a.stopX ? 1 : 0;
  }
  const lag = Math.abs(target - x);
  a.hero.speedK = 1 + Math.min(0.3, Math.max(0, lag - 40) / 400);   // отстающие ускоряются
  return dir;
}

// ===== Враги и бой =====
const foes = [];
const SIGHT = 1100;                    // дальность, на которой боец замечает противника
const FIRE_RANGE = 850;                // дальность стрельбы
const SNIPER_RANGE = FIRE_RANGE * 3;   // дальность снайпера (и его зрение)
const SNIPER_SPEED = 60;               // скорость снайперской пули, px/кадр
const SNIPER_CD = 90;                  // перезарядка между выстрелами, кадров
const SNIPER_DMG = 12;                 // множитель урона (как у осколка; 12 — убивает попаданием в голову даже через каску)
const FOE_WAVE_MIN = 3600, FOE_WAVE_MAX = 6000;   // кадров между волнами (60 кадров = 1 с)
const FOE_MAX = 14;                    // живых врагов одновременно
const FOE_GROUPS_MIN = 5, FOE_GROUPS_MAX = 7;   // сколько групп врагов на карте
const FOE_GROUP_MIN_DIST = 600;        // ближайшая к базе группа стоит в 600 px от неё
const FOE_GROUP_CLEAR = 2500;          // самая дальняя группа — не ближе 2500 px от старта игрока
const FOE_COLORS = [['#59606b', '#454b55'], ['#5d5a4a', '#47453a'], ['#665048', '#4f3d36']];
let foeTimer = 240;
const everybody = () => [...everyone(), ...foes];   // все, кого можно ранить

function tintFoe(h, i) {
  const [light, dark] = FOE_COLORS[i % FOE_COLORS.length];
  const map = { [COLORS.shirt]: light, [COLORS.shirtDark]: dark, [COLORS.pants]: '#3f444c', [COLORS.pantsDark]: '#30343a' };
  for (const s of h.segs) if (map[s.c]) s.c = map[s.c];
  h.helmetC = '#3a3f47';
}
function spawnFoe(x, i) {
  const h = createHero(x);
  h.foe = true;
  h.speedK = 0.65 + Math.random() * 0.6;     // у каждого своя скорость
  h.phase = Math.random() * Math.PI * 2;
  tintFoe(h, i);
  const fh = makeHealth(false);
  fh.state.armor = 0; h.armorOff = true;      // бронежилеты только у наших
  foes.push({ hero: h, health: fh, keys: {}, stun: 0, foe: true });
}
function spawnWave() {
  const alive = foes.filter(e => !e.health.state.dead).length;
  const n = Math.min(FOE_MAX - alive, 2 + Math.floor(Math.random() * 3));
  if (n <= 0) return;
  const baseX = FINISH_X;                                // подкрепление всегда выходит с базы
  for (let i = 0; i < n; i++) spawnFoe(Math.min(WORLD_W - 60, baseX + i * 70 + Math.random() * 60), foes.length + i);
}
// 5–7 групп врагов на разном расстоянии от базы; идут от базы навстречу игроку
function spawnFoeGroups() {
  const n = FOE_GROUPS_MIN + Math.floor(Math.random() * (FOE_GROUPS_MAX - FOE_GROUPS_MIN + 1));
  const dMax = FINISH_X - START_X - FOE_GROUP_CLEAR;       // дальше от базы — уже рядом со стартом
  const slot = (dMax - FOE_GROUP_MIN_DIST) / n;
  for (let g = 0; g < n; g++) {
    const d = FOE_GROUP_MIN_DIST + (g + 0.15 + Math.random() * 0.7) * slot;   // каждая группа в своей «полосе» от базы
    const gx = FINISH_X - d;
    const size = 2 + Math.floor(Math.random() * 2);        // 2–3 бойца в группе
    for (let i = 0; i < size; i++) spawnFoe(gx + i * 60 + Math.random() * 20, foes.length);
  }
}
// общий «мозг» боя: выбор цели, оружие, прицел (для союзников и врагов)
function combatThink(a) {
  const h = a.hero, st = a.health.state;
  if (a.init === undefined) {                 // первичная настройка бойца
    a.init = true;
    h.gun = 0; h.gunWant = false;             // оружие за спиной
    a.seeT = 0; a.tgt = null; a.deadT = 0;
    a.coverX = null; a.coverT = 0; a.coverOff = Math.random() * 40;   // coverOff — чтобы не стояли в одной точке
    a.cover = Math.random() < 0.5;            // будет ли пригибаться под огнём
    a.holdD = (h.foe ? 320 : 380) + Math.random() * 280;     // на какой дистанции останавливается
    a.fire = (h.foe ? 0.035 : 0.05) + Math.random() * 0.035; // «частота» стрельбы
    h.spread = (h.foe ? 0.04 : 0.03) + Math.random() * 0.03; // разброс, рад
    if (!h.foe) h.speedK = 0.92 + Math.random() * 0.16;
    if (h.sniper) { a.fire = 0.15; h.spread = 0.002; }   // снайпер: почти без разброса
  }
  h.gunRestore = false;                       // оружие сам не достаётся после падения
  h.aimWant = null;
  a.tgt = null;
  if (st.dead) { h.gunWant = false; return; }
  const x = h.p.pelvis.x;
  let bd = h.sniper ? SNIPER_RANGE : SIGHT;
  for (const u of (h.foe ? everyone() : foes)) {
    if (u.health.state.dead) continue;
    const d = Math.abs(u.hero.p.pelvis.x - x);
    if (d < bd) { bd = d; a.tgt = u; }
  }
  if (a.tgt) a.seeT = 150; else if (a.seeT > 0) a.seeT--;   // убирает оружие через 2.5 с после потери цели
  h.gunWant = a.seeT > 0 && !h.carrying;
  const td = a.tgt ? Math.abs(a.tgt.hero.p.pelvis.x - x) : Infinity;
  if (td < a.holdD + 180) {                                  // подошли к дистанции огня — выбираем укрытие и держимся за него
    if (a.coverX != null && ++a.coverAge > 300) a.coverX = null;   // раз в 5 с пересматриваем выбор
    if (a.coverX == null && --a.coverT <= 0) { a.coverT = 40; a.coverAge = 0; a.coverX = findCover(a); }
  } else if (td > a.holdD + 400) { a.coverX = null; a.coverT = 0; }   // гистерезис: на границе дальности укрытие не теряется
  if (a.tgt) {
    const c = h.p.chest;
    let t = a.tgt.hero.p.chest;
    if (h.sniper) {                                         // целится в голову с упреждением на движение цели
      const th = a.tgt.hero.p.head;
      const fl = Math.hypot(th.x - c.x, th.y - c.y) / SNIPER_SPEED;
      t = { x: th.x + (th.x - th.px) * fl, y: th.y + (th.y - th.py) * fl };
    }
    h.aimWant = Math.atan2(t.y - c.y, t.x - c.x);
  }
}
// X, где встать за ближайшим укрытием (между бойцом и целью), или null
function findCover(a) {
  const x = a.hero.p.pelvis.x, tx = a.tgt.hero.p.pelvis.x;
  const s = Math.sign(tx - x) || 1;                       // в какую сторону враг
  let best = null, bd = 380;
  for (const c of props) {
    if (c.deco) continue;
    if (s > 0 ? c.x + c.w > tx - 60 : c.x < tx + 60) continue;   // укрытие должно быть до цели, а не за ней
    const spot = s > 0 ? c.x - 22 - a.coverOff : c.x + c.w + 22 + a.coverOff;   // со стороны, противоположной врагу
    if ((spot - x) * s < -40) continue;                      // укрытие позади бойца — не берём
    const d = Math.abs(spot - x);
    if (d < bd) { bd = d; best = spot; }
  }
  return best;
}
function aiShoot(a) {
  const h = a.hero, st = a.health.state;
  if (won || st.dead || st.ko > 0 || h.gun < 1) return;
  if (h.ammo <= 0 || h.magOut || (!a.tgt && h.ammo < magSize(h) * 0.5)) startReload(h, a.health);   // пусто — перезарядка; цели нет и меньше половины — подзаряжается
  if (!a.tgt || h.aimWant == null || h.shootCD > 0) return;
  if (Math.abs(a.tgt.hero.p.pelvis.x - h.p.pelvis.x) > (h.sniper ? SNIPER_RANGE : FIRE_RANGE)) return;
  if (Math.random() < a.fire) shootUnit(h);
}
function foeThink(e) {
  const k = e.keys, st = e.health.state, h = e.hero, x = h.p.pelvis.x;
  k.KeyA = k.KeyD = k.KeyR = k.KeyS = k.ShiftLeft = false;
  h.treat = null;
  combatThink(e);
  if (st.dead || e.stun > 0 || st.ko > 0) return;
  let dir = x > 150 ? -1 : 0;                  // идут от базы навстречу
  if (e.tgt) {
    const dx = e.tgt.hero.p.pelvis.x - x;
    dir = Math.abs(dx) > e.holdD ? Math.sign(dx) : 0;
    if (e.coverX != null) {                      // идём в укрытие и пригибаемся за ним
      const cx = e.coverX - x;
      dir = Math.abs(cx) > 14 ? Math.sign(cx) : 0;
      if (dir === 0) k.KeyS = true;
    } else if (dir === 0 && e.cover) k.KeyS = true;
  }
  dir = steadyDir(e, dir);
  if (dir > 0) k.KeyD = true; else if (dir < 0) k.KeyA = true;
}
function updateFoes() {
  if (!won && --foeTimer <= 0) {
    foeTimer = FOE_WAVE_MIN + Math.random() * (FOE_WAVE_MAX - FOE_WAVE_MIN);
    spawnWave();
  }
  for (let i = foes.length - 1; i >= 0; i--) {
    const e = foes[i];
    foeThink(e);
    runAs(e, stepHero);
    aiShoot(e);
    if (e.health.state.dead && ++e.deadT > 900 && !onScreen(e.hero.p.pelvis.x - 150, 300)) foes.splice(i, 1);
  }
}
const BANDAGE_WALK = 0.7;
const STRUGGLE_NEED = 6;       // очков, чтобы очнуться без сознания (каждое нажатие A/D даёт +1)
const STRUGGLE_DECAY = 0.06;   // убывание очков за кадр (≈3,6/с): жать надо часто, 6–8 раз в секунду
function struggleStep(h) {
  if (h.struggle > 0) h.struggle = Math.max(0, h.struggle - STRUGGLE_DECAY);
  const st = Health.state;
  if (st.dead || st.ko === 0) { h.struggle = 0; return; }
  if (h.struggle >= STRUGGLE_NEED) {                          // очнулся: встанет, но очень конфузно
    h.struggle = 0;
    Health.wake();
    stun = 0;
  }
}
const TRANSFUSE_RATE = 0.15;
// ===== Станции с бронёй: подбор сразу, как только боец рядом и броня изношена =====
function nearestArmor(x, maxD) {
  let best = null;
  for (const c of props) {
    if (c.type !== 'armor' || c.left <= 0) continue;
    const d = Math.abs(c.x + c.w / 2 - x);
    if (d < maxD && (!best || d < best.d)) best = { c, d };
  }
  return best && best.c;
}
function updateArmor() {
  for (const u of everyone()) {
    if (!u.health.conscious() || !u.health.needsArmor()) continue;
    const h = u.hero, x = h.p.pelvis.x;
    const c = props.find(s => s.type === 'armor' && s.left > 0 && x > s.x - 30 && x < s.x + s.w + 30);
    if (!c) continue;
    c.left--;
    u.health.rearm();
    h.helmetOff = h.armorOff = false;                         // каска и жилет снова на месте — при разрушении слетят заново
    for (let i = 0; i < 8; i++) {                             // облачко пыли при экипировке
      const life = 30 + Math.random() * 20;
      dust.push({ x: x + (Math.random() - 0.5) * 30, y: h.p.chest.y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 1.5,
        r: 6 + Math.random() * 6, grow: 0.4, life, max: life, a: 0.5, c: '150,160,120' });
    }
  }
}
function nearMedkit() {
  const x = hero.p.pelvis.x;
  return props.find(c => c.type === 'medkit' && c.left > 0 && x > c.x - 40 && x < c.x + c.w + 40) || null;
}
// ===== Койка в доме: R рядом — лечь, идёшь — встаёшь; лёжа лечит быстрее перевязки =====
const cotX = c => c.x + c.w / 2;
function nearCot(x, h) {
  return props.find(c => c.type === 'house' && (!c.user || c.user === h) && Math.abs(cotX(c) - x) < COT_LEN / 2 + 20) || null;
}
function nearestCot(x, h) {
  let best = null;
  for (const c of props) {
    if (c.type !== 'house' || (c.user && c.user !== h)) continue;
    const d = Math.abs(cotX(c) - x);
    if (d < 600 && (!best || d < best.d)) best = { c, d };
  }
  return best && best.c;
}
function releaseCot(h) {
  if (h.cot) { h.cot.user = null; h.cot = null; }
}
function isHealed(st) {
  const w = st.wound;
  return st.blood >= 99 && !(w.head || w.torso || w.arms || w.legs) &&
    st.parts.head >= 90 && st.parts.torso >= 90 && st.parts.arms >= 90 && st.parts.legs >= 90;
}
// ===== Перенос: боец тащит потерявшего сознание к ближайшему медику =====
function isDown(u) {
  const st = u.health.state;
  return !st.dead && (st.ko > 0 || st.broken || (u.hero === hero ? stun : u.stun) > 0);
}
function nearestMedic(x, ex) {
  let best = null;
  for (const m of squad) {
    if (m === ex || !m.isMedic || m.health.state.dead || m.health.state.ko > 0 || m.stun > 0) continue;
    const d = Math.abs(m.hero.p.pelvis.x - x);
    if (!best || d < best.d) best = { m, d };
  }
  return best && best.m;
}
function dropCarry(a, cd = 120) {
  if (a.carry) {
    a.carry.hero.carriedBy = null;
    a.carry.hero.noCarryT = Math.max(a.carry.hero.noCarryT || 0, cd);   // этого бойца некоторое время никто не поднимает
    a.carry = null;
  }
  a.hero.carrying = false;
  a.carryCD = Math.max(a.carryCD || 0, 120);                            // и сам носильщик 2 с не берёт новых
}
// несомый раненый «висит» на плече носильщика: тело сдвигается к его груди, конечности болтаются
function updateCarry() {
  for (const u of everyone()) if (u.hero.noCarryT > 0) u.hero.noCarryT--;
  for (const a of squad) {
    if (a.carryCD > 0) a.carryCD--;
    if (!a.carry) continue;
    const c = a.hero, p = a.carry.hero;
    const dx = c.p.chest.x - c.f * 6 - p.p.chest.x;
    const dy = c.p.chest.y - 16 - p.p.chest.y;
    for (const q of Object.values(p.p)) {
      q.x += dx; q.y += dy; q.px += dx; q.py += dy;
      q.px += (q.x - q.px) * 0.3;                              // гасим скорость, чтобы не раскачивало
      q.py += (q.y - q.py) * 0.3;
    }
  }
}
// личный медик держится чуть позади игрока и подтягивается, если отстал
function followPlayer(a, x) {
  const d = (hero.p.pelvis.x - 70) - x;
  a.hero.speedK = 1 + Math.min(0.4, Math.max(0, Math.abs(d) - 40) / 300);
  return Math.abs(d) > 30 ? Math.sign(d) : 0;
}
function pickWound(skipLegs) {
  const st = Health.state;
  const started = p => hero.wrap[p] > 0 && hero.wrap[p] < WRAP_T;
  let best = null;
  for (const p in st.wound) {
    if (!st.wound[p]) continue;
    if (skipLegs && p === 'legs') continue;      // на ходу ноги не бинтуются
    if (best === null || (started(p) && !started(best)) ||
        (started(p) === started(best) && st.parts[p] < st.parts[best])) best = p;
  }
  return best;
}
const WRAP_T = 150;
const BAND_AXIS = { head: ['neck', 'head'], torso: ['pelvis', 'chest'], arms: ['elbowB', 'wristB'], legs: ['pelvis', 'kneeF'] };   // вдоль какой кости идут витки
const TREAT_REACH = 60;    // на каком расстоянии игрок может лечить бойца отряда, px
function bandGeom(part) {                                  // точка раны и ось части (для текущего hero; вызывать через withUnit)
  const P = hero.p, [an, bn] = BAND_AXIS[part];
  const dx = P[bn].x - P[an].x, dy = P[bn].y - P[an].y;
  const len = Math.hypot(dx, dy) || 1;
  return { t: woundPoint(part), ux: dx / len, uy: dy / len };
}
function pickPatient(h) {                                  // кого лечит игрок: раненый из отряда под курсором, а если сам цел — ближайший раненый рядом
  const selfWound = !!pickWound(false);
  let best = null;
  for (const a of squad) {
    const st = a.health.state;
    if (st.dead || !(st.wound.head || st.wound.torso || st.wound.arms || st.wound.legs)) continue;
    const d = Math.abs(a.hero.p.pelvis.x - h.p.pelvis.x);
    if (d > TREAT_REACH) continue;
    const m = Math.abs(a.hero.p.pelvis.x - mouse.x);
    const score = m < 80 ? m - 1000 : (selfWound ? Infinity : d);   // курсор на бойце — приоритет; иначе только если сам не ранен
    if (score !== Infinity && (!best || score < best.score)) best = { a, score };
  }
  return best && best.a;
}
const MEDIC_RATE = 3;   // медик бинтует в 3 раза быстрее (50 кадров вместо 150)
const PAIN_BANDAGE_MIN = 0.4;                                   // при максимальной боли бинтуют со скоростью 40%
const painSlow = p => 1 - (1 - PAIN_BANDAGE_MIN) * p;          // множитель скорости бинтования от боли
const CONCUSS_HELP = 0.15;   // с такой контузии медик уже занимается бойцом, даже если тот не ранен
const SOAK_RATE = 0.001;
const SOAK_LEAK = 0.001;
const SOAK_LEAK_MAX = 0.5;
function woundPoint(part) {
  const P = hero.p;
  const mix = (a, b, t) => ({ x: lerp(P[a].x, P[b].x, t), y: lerp(P[a].y, P[b].y, t) });
  if (part === 'head') return mix('neck', 'head', 0.8);
  if (part === 'torso') return mix('pelvis', 'chest', 0.55);
  if (part === 'arms') return mix('elbowB', 'wristB', 0.5);
  return mix('pelvis', 'kneeF', 0.6);
}
function stepHero() {
  const h = hero;
  const P = h.p;
  const entries = Object.entries(P);
  let dir = 0;
  if (keys.KeyA || keys.ArrowLeft) dir -= 1;
  if (keys.KeyD || keys.ArrowRight) dir += 1;
  if (stun > 0) stun--;
  Health.update();
  updateWounds();
  if (h.diveReq > 0) h.diveReq--;
  if (h.isPlayer) struggleStep(h);
  if (h.isPlayer) keys.KeyR = !!(h.bandWant && mouseDown);   // у игрока лечение = ЛКМ с бинтом в руке (настоящий R только перезаряжает)
  const canStand = standing && stun <= 0 && Health.conscious() && Health.canRise();
  if (h.cot && (dir !== 0 || Health.state.dead)) releaseCot(h);   // пошёл или погиб — койка свободна
  const wantLie = !!(keys.ShiftLeft || keys.ShiftRight || h.cot);
  const armed = h.isPlayer && (h.gunWant || h.gun > 0.05);          // оружие в руках: R — перезарядка, лечиться нельзя (сначала 1)
  const canAct = canStand && !h.getup && h.bal > 0.5 && h.lie < 0.5 && !armed;
  h.rollU = -1;                                                      // прогресс бинтования для анимации мотка; -1 — моток не разматывается
  if (h.isPlayer) {                                                  // ЛКМ с бинтом рядом с раненым из отряда — лечим его
    h.treat = (keys.KeyR && canAct && dir === 0) ? pickPatient(h) : null;
    if (h.treat) { h.treat.hero.beingTreated = 3; keys.KeyR = false; }   // пациент стоит; себя / аптечку / койку в этот кадр не трогаем
  }
  if (!h.cot && keys.KeyR && canAct && dir === 0) {               // R у койки — лечь
    const cot = nearCot(h.p.pelvis.x, h);
    if (cot) { cot.user = h; h.cot = cot; }
  }
  if (h.cot && h.lie > 0.8 && !Health.state.dead) {               // на койке: быстрое лечение, тело сдвигается на матрас
    Health.rest();
    const tx = cotX(h.cot) - h.f * 40;
    const sh = Math.max(-1.5, Math.min(1.5, (tx - h.p.pelvis.x) * 0.05));
    for (const q of Object.values(h.p)) { q.x += sh; q.px += sh; }
  }
  if (!keys.KeyR || !canAct) h.bandPart = null;
  h.box = (keys.KeyR && canAct && dir === 0 && Health.state.blood < 100) ? nearMedkit() : null;
  if (h.box) h.bandPart = null;
  else if (keys.KeyR && canAct && !(h.bandPart && Health.state.wound[h.bandPart])) h.bandPart = pickWound(dir !== 0);
  if (dir !== 0 && h.bandPart === 'legs') h.bandPart = null;
  h.bandaging = !!(h.box || h.bandPart);
  if (h.box || h.bandPart === 'legs') dir = 0;
  for (const part in h.wrap) {
    const done = h.wrap[part] >= WRAP_T;
    if (Health.state.wound[part] && done && h.soak[part] < 1) {
      h.wrap[part] = 0;
      h.soak[part] = 0;
    } else if (done && !Health.state.wound[part] && Health.state.parts[part] >= 100) {
      const wp = woundPoint(part);
      for (let i = 0; i < 4; i++) {
        debris.push({
          x: wp.x + (Math.random() - 0.5) * 12, y: wp.y,
          vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2,
          s: 4, life: 300, max: 300, c: i % 2 ? '#d9d6c8' : '#f1efe4'
        });
      }
      h.wrap[part] = 0;
      h.soak[part] = 0;
    } else if (done && !Health.state.wound[part] && !Health.state.dead) {
      const w = 0.2 + (1 - Health.state.parts[part] / 100);
      h.soak[part] = Math.min(1, h.soak[part] + Health.state.bleed * SOAK_RATE * w);
      if (h.soak[part] >= 1) Health.state.wound[part] = true;
    } else if (done && h.soak[part] >= 1 && !Health.state.dead) {
      Health.state.bleed = Math.min(SOAK_LEAK_MAX, Health.state.bleed + SOAK_LEAK);
    }
  }
  if (!canStand) { h.bal = 0; h.getup = null; }
  else if (h.getup) h.bal = 0;
  else {
    if (h.bal === 0 && !isUpright(h)) h.getup = startGetUp(h);
    else if (h.diveReq > 0 && h.bal > 0.5 && h.lie < 0.5 && isUpright(h)) { h.diveReq = 0; h.getup = startDive(h); }
    else if (h.bal > 0.5 && wantLie && h.lie < 0.5 && isUpright(h)) h.getup = startLieDown(h);
    else if (h.bal > 0.5 && !wantLie && h.lie > 0.6) h.getup = startGetUp(h, 18);
    if (h.getup) h.bal = 0;
    else h.bal = Math.min(1, h.bal + 0.02 * (1 - Health.state.concussion * 0.6));
  }
	if (h.isPlayer) {
		let dyAim = mouse.y - P.chest.y;
		if (dyAim > 30) dyAim = 30;
		h.aimA = Math.atan2(dyAim, mouse.x - P.chest.x);
	} else {
		h.aimA = h.aimWant != null ? h.aimWant : (h.f > 0 ? 0 : Math.PI);
	}
	let faceDir = dir;
	if (faceDir === 0 && (h.isPlayer || h.aimWant != null) && h.bal > 0.5 && !h.getup && Math.abs(Math.cos(h.aimA)) > 0.25 && (h.isPlayer || !(h.turnCD > 0))) {
		faceDir = Math.cos(h.aimA) > 0 ? 1 : -1;
	}
	if (faceDir !== 0 && h.bal > 0.5 && faceDir !== h.f) {
		const cx = h.p.pelvis.x;
		for (const q of Object.values(h.p)) { q.x = 2 * cx - q.x; q.px = 2 * cx - q.px; }
		h.f = faceDir;
		if (!h.isPlayer) h.turnCD = 45;                  // боты после разворота 0,75 с не разворачиваются по прицелу
		if (!h.isPlayer && h.aimWant == null) h.aimA = h.f > 0 ? 0 : Math.PI;
	}
	const inControl = h.bal > 0.6 && !h.getup && h.lie < 0.3 && Health.conscious();
	if (h.bandWant && (!inControl || h.nadeAim || h.throwT > 0)) h.bandWant = false;   // упал / бросок гранаты — бинт убран
	if (h.isPlayer) nadeStep(h);
	reloadStep(h);
	const busy = h.bandaging || h.treat || h.nadeAim || h.throwT > 0;                  // перевязка / лечение: руки заняты, оружие убираем
	if ((!inControl || busy) && h.gunWant) { h.gunWant = false; h.gunRestore = true; }
	if (inControl && !busy && h.bal > 0.95 && h.gunRestore) { h.gunWant = true; h.gunRestore = false; }
	const gunSpd = (h.nadeAim || h.throwT > 0) ? 0.12 : (h.gunWant || inControl ? 0.05 : 0.12);
	h.gun = h.gunWant ? Math.min(1, h.gun + gunSpd) : Math.max(0, h.gun - gunSpd);
	if (h.shootCD > 0) h.shootCD--;
	if (h.turnCD > 0) h.turnCD--;
	if (h.isPlayer && mouseDown) shootUnit(h);
  for (const [, p] of entries) {
    const vx = (p.x - p.px) * DAMPING;
    const vy = (p.y - p.py) * DAMPING;
    p.fx = p.x; p.plant = false;
    p.px = p.x; p.py = p.y;
    p.x += vx;
    p.y += vy + GRAVITY;
  }
  if (h.getup) {
    getUpStep(h, entries);
    h.flinch = null;
  } else if (h.bal > 0) {
    const f = h.f;
    const walking = dir !== 0 && h.bal > 0.6;
    h.walk += ((walking ? 1 : 0) - h.walk) * 0.12;
    const w = h.walk;
    const wantLie = (keys.ShiftLeft || keys.ShiftRight || h.cot) ? 1 : 0;
    const wantCrouch = (!wantLie && (keys.KeyS || keys.ArrowDown || (h.bandaging && dir === 0))) ? 1 : 0;
    h.lie += (wantLie - h.lie) * 0.08;
    h.crV = (h.crV || 0) * 0.75 + (wantCrouch - h.crouch) * 0.045;   // пружина: приседание с лёгким «доседанием»
    h.crouch = Math.max(0, Math.min(1.1, h.crouch + h.crV));
    if (h.crouch === 0 && h.crV < 0) h.crV = 0;
    const lie = h.lie, cr = h.crouch;
    const fx = bodyFx(h, w, cr, lie);                                // дыхание, перенос веса, инерция, попадания
    const amp = GAIT.amp * (1 - 0.35 * cr - 0.2 * lie);
    const liftH = GAIT.lift * (1 - 0.4 * cr - 0.5 * lie);
    const spd = Health.speedMul() * (h.speedK || 1) * (1 - 0.25 * cr - 0.7 * lie) * (h.bandaging ? BANDAGE_WALK : 1) * (h.carrying ? 0.6 : 1);
    if (walking) h.phase += GAIT.speed * spd * Math.PI / (2 * amp);
    const standH = h.standH - CROUCH_DROP * cr - GAIT.bob * Math.abs(Math.sin(h.phase)) * w * (1 - cr) - (Health.state.lame ? 7 * w : 0) - fx.drop;   // хромота: корпус просел
    const wantH = lerp(standH, RADIUS.pelvis, lie);
    const onGround = ['ankleB', 'ankleF', 'toeB', 'toeF'].some(n => P[n].y >= GROUND - P[n].r - 2);
    if (lie < 0.3 && onGround) h.tone = Math.max(0, Math.min(30, h.tone + (wantH - (GROUND - P.pelvis.y)) * 0.03));
    else if (lie >= 0.3) h.tone *= 0.9;
    const hipH = wantH + h.tone * (1 - lie);

    const g = { B: gait(h.phase, amp, liftH), F: gait(h.phase + Math.PI, amp, liftH) };
    const soft = h.bal * h.bal;
    const kUp = 0.3 * soft;
    const kLeg = 0.5 * soft;
    const pull = (p, tx, ty, kk) => { p.x += (tx - p.x) * kk; p.y += (ty - p.y) * kk; };
    for (const [, p] of entries) {
      p.px += (p.x - p.px) * 0.08 * h.bal;
      p.py += (p.y - p.py) * 0.08 * h.bal;
    }
    const out = tipping(P);
    const hold = lie > 0.5 ? 1 : Math.max(0, Math.min(1, 1 - (out - 4) / TIP_MARGIN));
    for (const s of ['B', 'F']) {
      const drag = Health.state.lame && s === Health.state.dragLeg;   // ноги в 0% — одну ногу волочит
      const lift = drag ? 0 : g[s].lift * w;
      const ank = P['ankle' + s], toe = P['toe' + s], knee = P['knee' + s];
      const gx = (drag ? STANCE[s] + (-GAIT.amp * 0.9 - STANCE[s]) * w : STANCE[s] + (g[s].x - STANCE[s]) * w) + Health.wobble(s === 'B' ? 1 : 4) * 7 + fx.shift;
      const planted = lift < 1.2 && lie < 0.5;
      const contact = ank.y >= GROUND - ank.r - 1.5 || toe.y >= GROUND - toe.r - 1.5;
      const fixed = planted && contact && !drag;
      const oxS = f * gx, oyS = hipH - RADIUS.ankle - lift;
      const oxL = -f * (82 - 0.4 * g[s].x * w), oyL = -7 - lift * 0.8;
      const ox = lerp(oxS, oxL, lie), oy = lerp(oyS, oyL, lie);
      muscle(P.pelvis, ank, ox, oy, kLeg, fixed ? 1 : 0.08, fixed ? 0.03 : 1, hold);
      const toeLift = lerp(lift, lift * 0.6, lie);
      muscle(ank, toe, f * S.foot * (1 - 2 * lie), (GROUND - RADIUS.toe - toeLift) - ank.y, kLeg, 0, fixed ? 0.03 : 1);
      const kn = kneeIK(P.pelvis, ank, f);
      if (lie > 0) kn.y = lerp(kn.y, Math.min(kn.y, GROUND - RADIUS.knee), lie);
      pull(knee, kn.x + Health.wobble(s === 'B' ? 2 : 5) * 5, kn.y, kLeg * 0.8);
      if (planted && !drag) { ank.plant = true; toe.plant = true; }
    }
    const rel = (a, b) => ({ x: (h.off[b].x - h.off[a].x) * f, y: h.off[b].y - h.off[a].y });
    const sway = (Health.sway() + (Health.state.lame ? f * 0.7 * w : 0)) * (1 - lie);   // хромота: корпус клонит вперёд
    const sp = rel('pelvis', 'chest'), nk = rel('chest', 'neck'), hd = rel('neck', 'head');
    muscle(P.pelvis, P.chest,
      lerp(sp.x + f * (3 * w + 8 * cr) + sway * 7, f * PRONE.chest.fx, lie) + fx.cx,
      lerp(sp.y, PRONE.chest.y + RADIUS.pelvis, lie) + fx.cy, kUp);
    muscle(P.chest, P.neck,
      lerp(nk.x + f * (1 * w + 5 * cr) + sway * 5, f * (PRONE.neck.fx - PRONE.chest.fx), lie) + fx.nx,
      lerp(nk.y, PRONE.neck.y - PRONE.chest.y, lie) + fx.ny, kUp);
    muscle(P.neck, P.head,
      lerp(hd.x + f * (1 * w + 5 * cr) + sway * 5, f * (PRONE.head.fx - PRONE.neck.fx), lie) + fx.hx,
      lerp(hd.y, PRONE.head.y - PRONE.neck.y, lie) + fx.hy, kUp);
		const aiming = h.bal > 0.6 && lie < 0.3 && !h.bandaging && !h.treat && h.gun > 0.5 && !h.nadeAim && !(h.throwT > 0);
		if (aiming) {
			const ax = Math.cos(h.aimA), ay = Math.sin(h.aimA);
			const cc = P.chest;
			const fl = Math.cos(h.aimA) < 0 ? -1 : 1;
			const gx = (lx, ly) => ({ x: cc.x + ax * lx - ay * ly * fl, y: cc.y + ay * lx + ax * ly * fl });
			const rl = reloadPose(h);                                   // перезарядка: рука идёт к магазину и держится у него
			const gF = gx(13, 9), gB = gx(41 - 26 * rl, 2 + 20 * rl);
			const txB = gB.x, tyB = gB.y;
			const txF = gF.x, tyF = gF.y;
			const armB = ik2(cc, { x: txB, y: tyB }, S.upperArm, S.foreArm, -fl, true);
			const armF = ik2(cc, { x: txF, y: tyF }, S.upperArm, S.foreArm, -fl, true);
			pull(P.wristB, armB.end.x, armB.end.y, 0.9, 14);
			pull(P.wristF, armF.end.x, armF.end.y, 0.9, 14);
			pull(P.elbowB, armB.mid.x, armB.mid.y, 0.9, 14);
			pull(P.elbowF, armF.mid.x, armF.mid.y, 0.9, 14);
		} else {
			for (const s of ['B', 'F']) {
				if (s === 'F' && (h.nadeW > 0.01 || h.throwT > 0)) continue;   // рукой с гранатой управляет nadeArm
				const opp = s === 'B' ? g.F : g.B;
				const sw = opp.x * w;
				const handLift = opp.lift * w * 0.5;
				for (const [part, mul, reach, mulL] of [['elbow', 0.35, 30, 0.4], ['wrist', 0.7, 48, 0.8]]) {
					const n = part + s, q = P[n], o = rel('chest', n);
					const tx = o.x + f * sw * mul + Health.wobble(s === 'B' ? 0 : 2.5) * 10 * mul;
					const lx = f * (reach + mulL * sw);
					const ly = RADIUS.chest - RADIUS[part] - handLift;
					const grip = lie > 0.5 && handLift < 1;
					muscle(P.chest, q, lerp(tx, lx, lie), lerp(o.y, ly - (grip && part === 'elbow' ? 22 : 0), lie), kUp, 1, grip ? 0.1 : 1); // локоть приподнят, иначе подпирает грудь
					if (grip && part === 'wrist') q.plant = true;
				}
			}
		}
		if (fx.grab && !aiming && !h.bandaging && !h.treat) flinchGrab(h, fx.grab);   // боец хватается за рану
		if (h.gun > 0 && h.gun <= 0.5 && h.bal > 0.6 && lie < 0.3 && !h.bandaging && !h.treat) {
			nudge(P.wristB, P.chest.x - f * 12, P.chest.y - 26, 0.6);
			nudge(P.elbowB, P.chest.x - f * 16, P.chest.y - 6, 0.4);
		}
    if (h.nadeW > 0.01 || h.throwT > 0) nadeArm(h);        // бросок гранаты: замах → бросок → доводка
    const cover = h.isPlayer && h.crouch > 0.5 && h.gun < 0.05 && !h.gunWant && !h.bandWant && !h.bandaging && !h.treat
      && !h.nadeAim && !(h.throwT > 0) && h.bal > 0.6 && lie < 0.3 && Health.conscious();
    h.coverK = (h.coverK || 0) + ((cover ? 1 : 0) - (h.coverK || 0)) * 0.15;
    if (h.coverK > 0.02) {                                  // присел без оружия — закрывает голову руками
      const ck = ease(h.coverK), hd = P.head;
      nudge(P.wristB, hd.x - f * 4, hd.y - 11, 0.5 * ck);
      nudge(P.wristF, hd.x + f * 7, hd.y - 9, 0.5 * ck);
      nudge(P.elbowB, hd.x + f * 6, hd.y + 16, 0.3 * ck);
      nudge(P.elbowF, hd.x + f * 17, hd.y + 10, 0.3 * ck);
    }
    if (h.bandWant && !h.treat && lie < 0.3) {              // бинт в руке: кисть перед грудью
      nudge(P.wristF, P.chest.x + f * 26, P.chest.y + 10, 0.4);
      nudge(P.elbowF, P.chest.x + f * 10, P.chest.y + 22, 0.3);
    }
    if (h.box) {
      const c = h.box;
      const bx = c.x + c.w / 2, by = GROUND - c.h;
      { const w = reachTo(P.chest, { x: bx, y: by - 4 }, 60); nudge(P.wristF, w.x, w.y, 0.3); }                                       // рука тянется к аптечке
      nudge(P.elbowF, lerp(P.chest.x, bx, 0.5), lerp(P.chest.y, by, 0.5) + 10, 0.2);
      const d = Math.min(c.left, 100 - Health.state.blood, TRANSFUSE_RATE);
      c.left -= d;
      Health.transfuse(d);
    } else if (h.bandPart) {
      const part = h.bandPart;
      if (part) {
        const t = woundPoint(part);
        const [an, bn] = BAND_AXIS[part];
        let ux = P[bn].x - P[an].x, uy = P[bn].y - P[an].y;       // ось части; поперёк неё руки передают моток
        const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
        const wu = Math.min(1, h.wrap[part] / WRAP_T);
        const a = (h.wrapT = (h.wrapT || 0) + 1) * 0.3;
        const env = Math.min(1, wu / 0.1 + 0.25) * Math.min(1, (1 - wu) / 0.08 + 0.1);   // начало: подносит бинт, конец: руки сходятся — узел
        const cs = Math.sin(a) * 12 * env;                         // размах поперёк части: руки расходятся и сходятся, перехватывая моток
        const al = (wu - 0.5) * 8 + Math.cos(a) * 2.5 * env;       // вдоль части: витки ползут от начала к концу
        const px = t.x + ux * al, py = t.y + uy * al;
        h.rollU = wu; h.rollTg = t; h.rollArm = part === 'arms'; h.rollPart = part;   // для отрисовки мотка и наклона корпуса
        const wF = reachTo(P.chest, { x: px - uy * cs, y: py + ux * cs }, 60); nudge(P.wristF, wF.x, wF.y, 0.5);
        nudge(P.elbowF, lerp(P.chest.x, wF.x, 0.5) + f * 4, lerp(P.chest.y, wF.y, 0.5) + 12, 0.25);
        if (part !== 'arms') { const wB = reachTo(P.chest, { x: px + uy * cs, y: py - ux * cs }, 60); nudge(P.wristB, wB.x, wB.y, 0.5); }
        if (h.soak[part] >= 1) { h.wrap[part] = 0; h.soak[part] = 0; }
        const rate = (h.isMedic ? MEDIC_RATE : 1) * painSlow(Health.state.pain);   // боль замедляет бинтование
        Health.bandage(part, rate);
        h.wrap[part] = Math.min(WRAP_T, h.wrap[part] + rate);
        if (h.wrap[part] >= WRAP_T) Health.state.wound[part] = false;
      }
    }
  }
  if (h.treat && h.bal > 0 && !h.getup) {
    const u = h.treat, ph = u.hero, hs = u.health;
    const wp = withUnit(u, () => pickWound(false));
    const part = wp || (h.isMedic && hs.state.concussion > CONCUSS_HELP ? 'head' : null);   // без раны — руки к голове
    if (part) {
      const bg = withUnit(u, () => bandGeom(part));
      const t = bg.t;
      const wu = Math.min(1, ph.wrap[part] / WRAP_T);
      const ang = (h.wrapT = (h.wrapT || 0) + 1) * 0.3;
      const env = Math.min(1, wu / 0.1 + 0.25) * Math.min(1, (1 - wu) / 0.08 + 0.1);   // начало: подносит бинт, конец: затягивает узел
      const cs = Math.sin(ang) * 12 * env;                       // руки передают моток поперёк раненой части
      const al = (wu - 0.5) * 8 + Math.cos(ang) * 2.5 * env;     // витки ползут вдоль неё
      const px = t.x + bg.ux * al, py = t.y + bg.uy * al;
      const wF = reachTo(P.chest, { x: px - bg.uy * cs, y: py + bg.ux * cs }, 60);
      const wB = reachTo(P.chest, { x: px + bg.uy * cs, y: py - bg.ux * cs }, 60);
      h.rollU = wu; h.rollTg = t; h.rollArm = false; h.rollPart = part;   // для отрисовки мотка и наклона корпуса
      nudge(P.wristF, wF.x, wF.y, 0.5);
      nudge(P.elbowF, lerp(P.chest.x, wF.x, 0.5) + h.f * 4, lerp(P.chest.y, wF.y, 0.5) + 12, 0.25);
      nudge(P.wristB, wB.x, wB.y, 0.5);
      if (wp) {
        if (ph.soak[part] >= 1) { ph.wrap[part] = 0; ph.soak[part] = 0; }
        const rate = (h.isMedic ? MEDIC_RATE : 1) * painSlow(Health.state.pain) * painSlow(hs.state.pain);   // боль медика и пациента замедляет бинтование
        hs.bandage(part, rate);
        ph.wrap[part] = Math.min(WRAP_T, ph.wrap[part] + rate);
        if (ph.wrap[part] >= WRAP_T) hs.state.wound[part] = false;
      }
      if (h.isMedic) hs.calm();                              // медик понемногу выводит из контузии
    }
  }
  for (let it = 0; it < ITERATIONS; it++) {
    for (const s of h.sticks) solveStick(s);
    for (const r of h.ranges) if (h.getup ? r === h.ranges[0] : !(r.ank && Math.max(h.crouch, h.lie) > 0.3)) solveRange(r);
    if (h.lie < 0.5 && !h.getup) { // лёжа суставы гнутся свободнее
      bendLimit(P.pelvis, P.kneeB, P.ankleB, h.f);
      bendLimit(P.pelvis, P.kneeF, P.ankleF, h.f);
      bendLimit(P.chest, P.elbowB, P.wristB, -h.f);
      bendLimit(P.chest, P.elbowF, P.wristF, -h.f);
    }
    		for (const [, p] of entries) collide(p);
	}
  for (const [, p] of entries) {
    if (p.y < GROUND - p.r - 0.01) continue;
    if (p.plant) {
      const d = p.x - p.fx;
      p.x = Math.abs(d) <= GRIP ? p.fx : p.fx + d - Math.sign(d) * GRIP;
      p.px = p.x;
    } else {
      p.px += (p.x - p.px) * FRICTION;
    }
  }
  if (h.bal > 0.6 && h.lie < 0.5) {
    h.tip = tipping(P) > TIP_MARGIN ? h.tip + 1 : Math.max(0, h.tip - 2);
    if (h.tip > 18) { stun = Math.max(stun, 90); h.tip = 0; }
  } else {
    h.tip = 0;
  }
}
function update() {
	stepHero();
	updateFormation();
	for (const a of squad) {
		aiThink(a);
		runAs(a, stepHero);
		aiShoot(a);
	}
	updateCarry();
	updateArmor();
	updateFoes();
	updateGrenades();
	updateShards();
	updateBullets();
	updateMags();
	updateRockets();
	updateStrafe();
	updateWarning();
	updateDust();
	updateBlood();
	updateHelmets();
	updateCamera();
	updateWorld();
}
window.addEventListener('keydown', (e) => {
  if (inMenu) return;
  keys[e.code] = true;
  if (!e.repeat && (e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !playerHealth.state.dead && playerHealth.state.ko > 0) {
    hero.struggle = Math.min(STRUGGLE_NEED + 3, (hero.struggle || 0) + 1);   // частые нажатия A/D — боец пытается очнуться
  }
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && (keys.KeyS || keys.ArrowDown) && hero.crouch > 0.3) {
    hero.diveReq = 10;                     // S + Shift — рывок в сторону взгляда
  }
  if ((e.code === 'Digit1' || e.code === 'Numpad1') && !e.repeat) {   // 1 — достать / убрать оружие
    hero.gunWant = !hero.gunWant; hero.gunRestore = false;
    if (hero.gunWant) hero.bandWant = false;                          // оружие в руки — бинт убираем
  }
  if ((e.code === 'Digit2' || e.code === 'Numpad2') && !e.repeat) {   // 2 — достать / убрать бинт
    hero.bandWant = !hero.bandWant;
    if (hero.bandWant) { hero.gunWant = false; hero.gunRestore = false; }   // бинт в руки — оружие убираем
  }
});
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (inMenu) {
    if (e.code === 'Enter') startPlay();                                     // Enter в меню — играть
    return;
  }
  if (e.code === 'Escape') { openMenu(); return; }                           // Esc — в меню
  if (e.code === 'Enter' && (playerHealth.state.dead || won)) resetGame();   // Enter — начать заново (после гибели или победы)
  if (e.code === 'KeyH') toggleHelp();                                       // H — показать / скрыть подсказку
  if (e.code === 'KeyR') startReload(hero);                                  // R — перезарядка (если оружие в руках)
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function setMouse(e) {
  const rect = canvas.getBoundingClientRect();
  mouse.sx = e.clientX - rect.left;
  mouse.x = mouse.sx + camX;
  mouse.y = e.clientY - rect.top;
}
canvas.addEventListener('pointerdown', (e) => {
	if (e.button === 2) {                                  // ПКМ зажата — замах гранаты
		setMouse(e);
		if (canThrow(hero)) { hero.nadeAim = true; hero.thrown = false; }
		return;
	}
	setMouse(e);
	mouseDown = true;
	shootUnit(hero);
});
window.addEventListener('pointermove', setMouse);
window.addEventListener('pointerup', (e) => {
  if (e.button === 2) startThrow(hero);                    // ПКМ отпущена — бросок
  else mouseDown = false;
});
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});
function resetGame() {
  hero = createHero(START_X);
  hero.isPlayer = true;
  won = false;
  camX = 0;
  genWorld();
  genSquad();
  stun = 0;
  mouseDown = false;
  for (const k in keys) keys[k] = false;
  effects.length = 0;
  grenades.length = 0;
  nades = NADE_MAX;
  mags.length = 0;
  shards.length = 0;
  bullets.length = 0;
  flashes.length = 0;
  rockets.length = 0;
  strafeShots.length = 0;
  plane = null;
  strafeTimer = nextStrafe();
  dust.length = 0;
  blood.length = 0;
  bloodPools.length = 0;
  helmets.length = 0;
  foes.length = 0;
  foeTimer = 240;
  spawnFoeGroups();
  formation.n = -1;
  formation.mode = 'march';
  debris.length = 0;
  craters.length = 0;
  rocketTimer = nextRocket();
  megaTimer = nextMega();
  megaFlash = 0;
  megaFx.length = 0;
  warn.rocket = warn.strafe = warn.mega = 0;
  shake = 0;
  playerHealth.reset();
}
const hudEl = document.getElementById('hud');
let helpTimer = null;
function toggleHelp() {
  clearTimeout(helpTimer);
  hudEl.classList.toggle('hidden');
}
// ===== Главное меню =====
const menuEl = document.getElementById('menu');
const playBtn = document.getElementById('btnPlay');
let inMenu = true;
let started = false;
function startPlay() {
  inMenu = false;
  menuEl.classList.add('gone');
  document.body.classList.remove('in-menu');
  if (!started) {
    started = true;
    hudEl.classList.remove('hidden');
    helpTimer = setTimeout(() => hudEl.classList.add('hidden'), 15000);   // подсказка сама прячется через 15 с
  }
}
function openMenu() {
  inMenu = true;
  mouseDown = false;
  hero.nadeAim = false;
  for (const k in keys) keys[k] = false;
  playBtn.textContent = 'Продолжить';
  menuEl.classList.remove('gone');
  document.body.classList.add('in-menu');
}
playBtn.addEventListener('click', startPlay);
document.getElementById('btnKeys').addEventListener('click', toggleHelp);
hero = createHero(START_X);
hero.isPlayer = true;
genWorld();
genSquad();
spawnFoeGroups();
const DT = 1000 / 60;
let last = performance.now();
let acc = 0;
function frame(now) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= DT) {
    if (!inMenu) update();
    acc -= DT;
  }
  render();
  updateNadeHud();
  updateAmmoHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);