'use strict';

const canvas = document.getElementById('game');
let ctx = canvas.getContext('2d');							// let: превью персонажа временно подменяет контекст

let W = 0, H = 0, GROUND = 0;
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  GROUND = H - 90;
}
window.addEventListener('resize', resize);
resize();
const effects = [];
let hero;
let standing = true;
let stun = 0;
let keys = {};
const mouse = { x: 0, y: 0, sx: W * 0.7 };
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
let blastSrc = 'grenade', blastBy = 'player';   // чей взрыв: нужно для причины смерти
function explode(x, y, R = 260, power = 1, shardMul = 1, src = 'grenade', by = 'player') {
  blastSrc = src; blastBy = by;
  runAll(() => blast(x, y, R, power));
  boom(x, y, power, shardMul);
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
  if (hit > 0.2 && hero.isPlayer) deafen(2 + Math.min(1, hit * Math.sqrt(power)));   // 2–3 с тишины, потом звук возвращается
  const wasDead = Health.state.dead;
  Health.onBlast(hits, { src: blastSrc, how: 'blast', by: blastBy });
  if ((Health.state.dead || Health.state.parts.torso <= 0) && hit > DISMEMBER_K) dismember(hero, hits, x, power, wasDead);   // погиб или торс разрушен взрывом — отлетают конечности
}
function boom(x, y, power, shardMul = 1) {
  effects.push({ x, y, t: 0, s: power });
  explosionSound(x, power);
  spawnShards(x, y, Math.round(SHARD_COUNT * power * shardMul));
  spawnBigShards(x, y, Math.min(14, Math.round(BIG_SHARD_COUNT * power * shardMul)));
  if (y > GROUND - 40) spawnDust(x, power);
  if (power > 1.2) craters.push({ x, s: 40 * power });
  if (craters.length > 8) craters.shift();
  shake = Math.max(shake, 6 * power * Math.max(0.2, 1 - Math.abs(x - hero.p.pelvis.x) / 900));
}
const stats = { frames: 0, kills: 0, mine: 0, shots: 0, hits: 0, nades: 0 };   // для экрана гибели / победы
const FUSE = 180;
const SHARD_COUNT = 36;
const grenades = [];
const shards = [];
const bigShards = [];                    // крупные осколки (летят после взрыва, застревают в телах)
const BIG_SHARD_COUNT = 15;               // базовое число крупных осколков на взрыв (× power)
const BIG_SHARD_DMG = 2;                 // урон по здоровью относительно обычного осколка
const EMBED_TTL = 55 * 60;               // сколько кадров осколок торчит в теле (55 с)
const bullets = [];
const flashes = [];
const BULLET_SPEED = 34;
const SHOOT_CD = 8;
const RICOCHET_ANGLE = 25 * Math.PI / 180;   // угол к поверхности, меньше которого пуля рикошетит
const RICOCHET_MAX = 2;                       // сколько рикошетов выдерживает одна пуля
const RICOCHET_DMG = 0.5;                     // урон после рикошета (множитель)
const PEN_DMG = 0.6;                          // урон после пробития тела (множитель)
const PEN_MAX = 2;                            // сколько тел может пробить одна пуля
const HELMET_DMG = 0.2;                       // урон по каске при рикошете (множитель)
const HEAR_RANGE = 1400;                      // слышимость звона каски, px
const HEAR_T = 240;                           // сколько кадров боец помнит, откуда стреляли (4 с)
// ===== Патроны, перезарядка и отсоединяемый магазин (у всех бойцов) =====
const MAG_SIZE = 30;         // патронов в магазине АК
const SNIPER_MAG = 10;       // патронов у снайпера
const RELOAD_T = 84;         // перезарядка АК, кадров (1,4 с)
const SNIPER_RELOAD_T = 110; // перезарядка снайпера, кадров
const MG_MAG = 100;          // патронов в коробе пулемёта
const MG_RELOAD_T = 170;     // перезарядка пулемёта, кадров (2,8 с)
const MG_PLAYER_SPREAD = 0.05;   // собственный разброс пулемёта у игрока, рад
const MAG_OUT_AT = 0.22;     // доля перезарядки: магазин вынут из оружия и остался в руке
const MAG_DROP_AT = 0.34;    // старый магазин выброшен
const MAG_GRAB_AT = 0.56;    // новый магазин достан из подсумка
const MAG_IN_AT = 0.84;      // новый магазин вставлен (стрелять можно, рука ещё возвращается)

const magSize = h => h.sniper ? SNIPER_MAG : h.mg ? MG_MAG : MAG_SIZE;
const gunReach = h => h.sniper ? 112 : h.mg ? 104 : 80;     // расстояние от груди до дула
function startReload(h, hl = playerHealth) {               // R у игрока; у ботов вызывает aiShoot
  if (h.reloadT > 0 || (h.ammo >= magSize(h) && !h.magOut)) return;
  if (!h.gunWant || h.gun < 1 || h.getup || h.lie > 0.3 || h.bal < 0.6 || h.nadeAim || h.throwT > 0 || h.carrying || h.bandaging || h.treat || !hl.conscious() || hl.state.dead) return;
  	h.reloadMax = h.reloadT = h.sniper ? SNIPER_RELOAD_T : h.mg ? MG_RELOAD_T : RELOAD_T;
  if (h.magOut && !h.magHeld) h.reloadT = Math.round(h.reloadMax * (1 - MAG_DROP_AT));   // старый магазин уже выброшен — сразу к подсумку
}
function dropMag(h) {                                      // магазин выпадает из руки и падает на землю
  const w = h.p.wristB, a = h.aimA, sn = !!h.sniper;
  const flip = Math.cos(a) < 0 ? -1 : 1;
  mags.push({
    x: w.x, y: w.y,
    a, flip, sn, mg: !!h.mg,
    vx: h.f * (0.4 + Math.random() * 1.2), vy: 0.5 + Math.random(),
    va: (Math.random() - 0.5) * 0.3, life: 900
  });
  if (mags.length > 40) mags.shift();
}
function reloadStep(h) {                                   // вызывается для каждого бойца внутри stepHero
  if (!(h.reloadT > 0)) return;
  if (!h.gunWant || h.getup || h.lie > 0.3 || h.bal < 0.6 || h.nadeAim || h.throwT > 0 || h.bandaging || h.treat || !Health.conscious() || Health.state.dead) {   // убрал оружие / упал / бросок — перезарядка сорвана
    if (h.magHeld) { dropMag(h); h.magHeld = false; }      // магазин был в руке — роняем
    h.reloadT = 0; return;
  }
  h.reloadT--;
  const t = 1 - h.reloadT / h.reloadMax;
  if (t >= MAG_IN_AT) {
    if (h.magOut) { h.magOut = false; h.ammo = magSize(h); }     // новый магазин вставлен
  } else {
    if (t >= MAG_OUT_AT && !h.magOut) { h.magOut = true; h.magHeld = true; h.ammo = 0; }   // магазин вынут из оружия, остался в руке
    if (t >= MAG_DROP_AT && h.magHeld) { dropMag(h); h.magHeld = false; }                  // отпустил — падает
  }
}
function pouchPos(h) {                                     // подсумок на поясе (та же точка, что рисует drawBelt)
  const P = h.p;
  let ux = P.chest.x - P.pelvis.x, uy = P.chest.y - P.pelvis.y;
  const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
  const nx = -uy * h.f, ny = ux * h.f;
  return { x: P.pelvis.x + ux * 5 + nx * 15, y: P.pelvis.y + uy * 5 + ny * 15 };   // кромка пояса: кисть дальней руки наполовину выглядывает из-за тела
}
// куда тянется опорная рука (wristB) во время перезарядки; gx — перевод координат оружия в мировые. null — не перезаряжаемся
function reloadHand(h, gx) {
  h.magHand = null;
  if (!(h.reloadT > 0)) return null;
  const t = 1 - h.reloadT / h.reloadMax;
  	const mx = h.sniper ? 12 : h.mg ? 15 : 34, my = h.sniper ? 10 : h.mg ? 11 : 13;
  	const H0 = h.mg ? gx(52, 2) : gx(41, 2), Hm = gx(mx, my), Ho = gx(mx + 5, my + 18), Hu = gx(mx + 1, my + 17), Hp = pouchPos(h);
  const seg = (a, b, u) => { const k = ease(Math.max(0, Math.min(1, u))); return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) }; };
  let p;
  if (t < 0.14) p = seg(H0, Hm, t / 0.14);                              // от цевья к магазину
  else if (t < MAG_OUT_AT) p = Hm;                                       // хват, щелчок фиксатора
  else if (t < MAG_DROP_AT) p = seg(Hm, Ho, (t - MAG_OUT_AT) / (MAG_DROP_AT - MAG_OUT_AT));   // тянет магазин вниз
  else if (t < MAG_GRAB_AT) p = seg(Ho, Hp, (t - MAG_DROP_AT) / (MAG_GRAB_AT - MAG_DROP_AT)); // к подсумку
  else if (t < 0.62) p = Hp;                                             // достаёт новый
  else if (t < 0.78) p = seg(Hp, Hu, (t - 0.62) / 0.16);                // несёт к оружию
  else if (t < MAG_IN_AT) p = seg(Hu, Hm, (t - 0.78) / (MAG_IN_AT - 0.78));   // вставляет снизу вверх
  else p = seg(Hm, H0, (t - MAG_IN_AT) / (1 - MAG_IN_AT));              // возвращается на цевьё
  h.magHand = h.magHeld ? 'old' : (t >= MAG_GRAB_AT && t < MAG_IN_AT && h.magOut) ? 'new' : null;   // какой магазин сейчас в ладони
  return p;
}

const ammoEl = document.getElementById('ammo');
let ammoShown = '';
function updateAmmoHud() {
  const h = hero;
  const pr = h.reloadT > 0 ? Math.round((1 - h.reloadT / h.reloadMax) * 20) : -1;
  const bl = h.blind > 0.5 ? 1 : 0;
  const key = h.ammo + '|' + pr + '|' + (h.gunWant ? 1 : 0) + '|' + (h.magOut ? 1 : 0) + '|' + (h.bandWant ? 1 : 0) + '|' + bl;
  if (key === ammoShown) return;
  ammoShown = key;
  const size = magSize(h);
  const bar = pr >= 0
    ? '<div class="am-bar rld"><i style="width:' + pr * 5 + '%"></i></div>'
    : '<div class="am-bar"><i style="width:' + Math.round(h.ammo / size * 100) + '%"></i></div>';
  const hint = h.bandWant ? '<span class="am-h">бинт · <kbd>ЛКМ</kbd></span>'
    : !h.gunWant ? '<span class="am-h">убрано · <kbd>1</kbd></span>'
    : h.reloadT > 0 ? '<span class="am-h">перезарядка…</span>'
    : (h.ammo === 0 || h.magOut) ? '<span class="am-h bad"><kbd>R</kbd> перезарядка</span>'
    : bl ? '<span class="am-h blind">вслепую</span>' : '';
  const name = h.sniper ? 'Снайперка' : h.mg ? 'Пулемёт' : 'АК';
  ammoEl.innerHTML = '<div class="hd-ic"><svg viewBox="0 0 24 24"><path d="M3 11h12l1.5-2H21v3h-4.5l-1 1.5H12l-.8 4H8l.8-4H3z"/></svg></div>' +
    '<div class="am-main"><div class="hd-cap">' + name + '</div>' +
    '<div class="am-num"><b>' + h.ammo + '</b><span class="am-max">/ ' + size + '</span>' + hint + '</div>' + bar + '</div>';
  ammoEl.classList.toggle('empty', h.ammo === 0 && !(h.reloadT > 0));
  ammoEl.classList.toggle('low', h.ammo > 0 && h.ammo <= size * 0.25);
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
  nadeEl.innerHTML = '<div class="hd-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="6"/><path d="M10 8V5h4v3M14 5l4-2M9.5 14h5"/></svg></div>' +
    '<div class="am-main"><div class="hd-cap"><span>Гранаты</span><kbd>ПКМ</kbd></div><span class="ng">' + pips + '</span></div>';
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
        stats.nades++;
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
// обход тел: снаряд в точке (x, y) попал в сегмент бойца из units (pad — запас к радиусу сегмента).
// fn(u, h, seg): true — снаряд израсходован, обход заканчивается; false — идём к следующему бойцу
function hitBody(units, x, y, pad, fn) {
  for (const u of units) {
    const h = u.hero;
    if (Math.abs(x - h.p.pelvis.x) > 170) continue;
    for (const seg of h.segs) {
      if (distToSeg(x, y, h.p[seg.a], h.p[seg.b]) < seg.ry * 0.8 + pad) {
        if (fn(u, h, seg)) return true;
        break;
      }
    }
  }
  return false;
}
function kickSeg(h, seg, vx, vy, k) {                      // толчок обоим суставам сегмента по ходу снаряда
  for (const n of [seg.a, seg.b]) { h.p[n].px -= vx * k; h.p[n].py -= vy * k; }
}
function shardPasses(s, h) {                               // осколок пролетает над лежащим бойцом: решение один раз на бойца
  s.pass = s.pass || new Map();
  if (!s.pass.has(h)) s.pass.set(h, Math.random() < h.lie * 0.6);
  return s.pass.get(h);
}
function hitShard(s, seg, u) {
  kickSeg(u.hero, seg, s.vx, s.vy, 0.15);
  u.health.onShrapnel(seg.b, 1, { src: blastSrc, how: 'frag', by: blastBy });
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
      if (hitBody(everybody(), s.x, s.y, 0, (u, h, seg) => {
        if (shardPasses(s, h)) return false;
        hitShard(s, seg, u);
        return true;
      })) dead = true;
    }
    if (dead) shards.splice(i, 1);
  }
}
function spawnBigShards(x, y, count) {
  const onGround = y > GROUND - 40;
  for (let i = 0; i < count; i++) {
    const ang = onGround ? -Math.random() * Math.PI : Math.random() * Math.PI * 2;
    const sp = 8 + Math.random() * 9;
    bigShards.push({
      x, y: y - 4, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      a: Math.random() * Math.PI * 2, va: (Math.random() - 0.5) * 0.5,
      sz: 6 + Math.random() * 5, life: 80 + Math.random() * 50
    });
  }
}
function updateBigShards() {
  for (let i = bigShards.length - 1; i >= 0; i--) {
    const s = bigShards[i];
    let dead = --s.life <= 0;
    s.vy += 0.3;
    s.vx *= 0.992;
    s.a += s.va;
    for (let k = 0; k < 2 && !dead; k++) {
      s.x += s.vx / 2;
      s.y += s.vy / 2;
      if (s.y >= GROUND || s.x < 0 || s.x > WORLD_W || shardBlocked(s.x, s.y)) { dead = true; break; }
      if (hitBody(everybody(), s.x, s.y, 3, (u, h, seg) => {
        if (shardPasses(s, h)) return false;
        kickSeg(h, seg, s.vx, s.vy, 0.25);
        u.health.onShrapnel(seg.b, BIG_SHARD_DMG, { src: blastSrc, how: 'frag', by: blastBy });
        addWound(u, seg, s.x, s.y, 'embed', s.vx, s.vy);
        return true;
      })) dead = true;
    }
    if (dead) bigShards.splice(i, 1);
  }
}
function shootUnit(h) {
	if (h.shootCD > 0 || h.gun < 1 || h.getup || h.lie > 0.5 || h.bal < 0.5 || h.bandaging || h.carrying || h.nadeAim || h.throwT > 0) return;
	if (h.blind > 0.02 && h.blind < 0.8) return;                     // оружие ещё поднимается / опускается
	if (h.ammo <= 0 || h.magOut || (h.reloadT > 0 && h.reloadT > h.reloadMax * (1 - MAG_IN_AT))) return;   // после вставки магазина стреляем, не дожидаясь, пока рука вернётся на цевьё
	h.shootCD = h.sniper ? SNIPER_CD : h.mg ? MG_CD : SHOOT_CD;
	h.ammo--;
	if (h === hero) stats.shots++;
	const ax = Math.cos(h.aimA), ay = Math.sin(h.aimA);
	const sn = !!h.sniper;
	const reach = gunReach(h);
	const go = gunOrigin(h);                                           // грудь, а при стрельбе вслепую — точка над головой
	const mx = go.x + ax * reach;
	const my = go.y + ay * reach;
	const shakeSpread = h === hero ? 0.05 * (h.handShake || 0) : 0;   // дрожащие руки уводят ствол
	const sa = h.aimA + (Math.random() - 0.5) * 2 * ((h.spread || 0) + 0.12 * (h.blind || 0) + shakeSpread + (h.mg ? MG_PLAYER_SPREAD : 0));   // разброс у ботов + вслепую + дрожь рук
	const spd = sn ? SNIPER_SPEED : h.mg ? MG_BULLET_SPEED : BULLET_SPEED;
	bullets.push({ x: mx, y: my, px: mx, py: my, vx: Math.cos(sa) * spd, vy: Math.sin(sa) * spd, life: sn ? 70 : 90, foe: !!h.foe, sn, mg: !!h.mg, dmg: sn ? SNIPER_DMG : 2.5, sx: mx, by: h === hero ? 'player' : h.foe ? 'enemy' : 'squad' });
	flashes.push({ x: mx, y: my, a: h.aimA, life: 7, max: 7 });
	h.handShake = Math.min(1.6, (h.handShake || 0) + (sn ? 0.9 : h.mg ? 0.4 : 0.5) + 0.5 * (h.blind || 0));   // руки трясутся от стрельбы, вслепую сильнее
	// отдача: толкаем корпус и таз назад
	const rec = sn ? 3 : h.mg ? 0.8 : 1;
	h.p.chest.px -= ax * 1.6 * rec; h.p.chest.py -= ay * 1.6 * rec;
	h.p.pelvis.px -= ax * 0.5 * rec; h.p.pelvis.py -= ay * 0.5 * rec;
}
// твёрдый объект в точке (x, y) или null (то же, что shardBlocked, но возвращает сам объект)
function solidAt(x, y) {
	for (const c of props) {
		if (c.deco || !(x > c.x && x < c.x + c.w && y > GROUND - c.h)) continue;
		if (c.type === 'house') { if (houseBlocks(c, x, y)) return c; continue; }
		return c;
	}
	return null;
}
// есть ли прямой выстрел из (x0, y0) в (x1, y1): на пути нет твёрдых объектов (мешки, барьер, траншея, стены дома)
function clearShot(x0, y0, x1, y1) {
	const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
	const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 10);
	for (const c of props) {
		if (c.deco || c.x > hi || c.x + c.w < lo) continue;     // объект не на пути
		for (let i = 0; i <= n; i++) {
			const u = n ? i / n : 0, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
			if (x > c.x && x < c.x + c.w && y > GROUND - c.h && (c.type !== 'house' || houseBlocks(c, x, y))) return false;
		}
	}
	return true;
}
// долетит ли пуля из ствола бойца (грудь + 80 px в сторону цели) до точки t
function shotClear(from, t) {
	const dx = t.x - from.x, dy = t.y - from.y, d = Math.hypot(dx, dy) || 1, r = Math.min(80, d);
	return clearShot(from.x + dx / d * r, from.y + dy / d * r, t.x, t.y);
}
// куда можно попасть: грудь, а если она закрыта — голова; null — цель полностью прикрыта
function aimPoint(from, hero) {
	return shotClear(from, hero.p.chest) ? hero.p.chest : shotClear(from, hero.p.head) ? hero.p.head : null;
}
// отражает скорость пули от поверхности с нормалью (nx, ny): потеря скорости keep, случайный разброс ±11°
function bounceBullet(b, nx, ny, keep) {
	const dot = b.vx * nx + b.vy * ny;
	const vx = b.vx - 2 * dot * nx, vy = b.vy - 2 * dot * ny;
	const m = keep * (0.85 + Math.random() * 0.3);
	const da = (Math.random() - 0.5) * 0.4;
	const c = Math.cos(da), s = Math.sin(da);
	let rx = (vx * c - vy * s) * m, ry = (vx * s + vy * c) * m;
	const d2 = rx * nx + ry * ny;
	if (d2 < 0) { rx -= 2 * d2 * nx; ry -= 2 * d2 * ny; }      // после разброса не уходим обратно в поверхность
	b.vx = rx; b.vy = ry;
	b.rc = (b.rc || 0) + 1;
	b.dmg = (b.dmg || 2.5) * RICOCHET_DMG;
}

// пуля b вошла в твёрдый объект c (ox, oy — последняя свободная точка). true — срикошетила, false — остановлена
function tryRicochet(b, c, ox, oy) {
	if (c.type !== 'barrier' && c.type !== 'house') {          // мешки с песком и окоп глотают пулю
		for (let i = 0; i < 3; i++) dust.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, r: 3, grow: 0.3, life: 20, max: 20, a: 0.5, c: '140,120,80' });
		return false;
	}
	if ((b.rc || 0) >= RICOCHET_MAX) return false;
	const spd = Math.hypot(b.vx, b.vy) || 1;
	const hx = !!solidAt(b.x, oy), hy = !!solidAt(ox, b.y);    // какой сдвиг упирается в поверхность — такая и грань
	let nx = 0, ny = 0;
	if (hx && !hy) nx = -Math.sign(b.vx);
	else if (hy && !hx) ny = -Math.sign(b.vy);
	else if (Math.abs(b.vx) > Math.abs(b.vy)) nx = -Math.sign(b.vx);
	else ny = -Math.sign(b.vy);
	if (!nx && !ny) return false;
	const dot = b.vx * nx + b.vy * ny;
	if (Math.abs(dot) / spd >= Math.sin(RICOCHET_ANGLE)) return false;   // слишком крутой угол — пуля застревает
	b.x = ox; b.y = oy;
	bounceBullet(b, nx, ny, 0.6);
	sparkBurst(ox, oy, 6);
	return true;
}
function pingSound(x) {                                        // «дзынь»: чем ближе к игроку, тем громче
	try {
		const ac = sndCtx();
		const vol = 0.18 + 0.32 * Math.max(0, 1 - Math.abs(x - hero.p.pelvis.x) / 1600);
		const now = ac.currentTime;
		const g = ac.createGain();
		g.gain.setValueAtTime(vol, now);
		g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
		g.connect(Snd.out);
		for (const f of [1900, 2870, 4350]) {                    // несколько негармоничных тонов — металл
			const o = ac.createOscillator();
			o.type = 'triangle';
			o.frequency.setValueAtTime(f * (0.97 + Math.random() * 0.06), now);
			o.connect(g);
			o.start(now); o.stop(now + 0.45);
		}
	} catch (e) { /* звук необязателен */ }
}
// звон услышали бойцы противоположной стороны: запоминают, откуда стреляли
function alertListeners(b) {
	for (const a of (b.foe ? squad : foes)) {
		if (a.health.state.dead || Math.abs(a.hero.p.pelvis.x - b.x) > HEAR_RANGE) continue;
		a.heardX = b.sx;
		a.heardT = HEAR_T;
	}
}
// попадание пули b в сегмент seg бойца u: 0 — пуля остановлена, 1 — прошла насквозь, 2 — срикошетила от каски
function bulletHitUnit(b, u, seg) {
	const h = u.hero, hs = u.health.state;
	const part = partOfSeg(seg);
	const dmg = b.dmg || 2.5;
	const by = b.by || (b.foe ? 'enemy' : 'squad');
	const info = { src: b.rc ? 'ricochet' : b.sn ? 'sniper' : b.mg ? 'mg' : 'rifle', how: 'bullet', dist: Math.abs((b.sx == null ? b.x : b.sx) - h.p.pelvis.x) / 10, by };
	if (by === 'player' && h.foe) stats.hits++;
	const armored = (part === 'head' && hs.helmet > 0) || (part === 'torso' && hs.armor > 0);
	if (seg.b === 'head' && hs.helmet > 0) {                   // касательное попадание в каску
		const c = h.p.head;
		let nx = b.x - c.x, ny = b.y - c.y;
		const nl = Math.hypot(nx, ny);
		if (nl > 1) {
			nx /= nl; ny /= nl;
			const dot = (b.vx * nx + b.vy * ny) / (Math.hypot(b.vx, b.vy) || 1);
			if (dot < 0 && -dot < Math.sin(RICOCHET_ANGLE)) {
				u.health.onShrapnel(seg.b, dmg * HELMET_DMG, info);
				addWound(u, seg, b.x, b.y, 'bullet', b.vx, b.vy);
				bounceBullet(b, nx, ny, 0.6);
				(b.hit = b.hit || new Set()).add(h);
				sparkBurst(b.x, b.y, 8);
				pingSound(b.x);
				alertListeners(b);
				return 2;
			}
		}
	}
	kickSeg(h, seg, b.vx, b.vy, 0.06);
	u.health.onShrapnel(seg.b, dmg, info);                           // винтовочная пуля: ×2.5 от осколка
	addWound(u, seg, b.x, b.y, 'bullet', b.vx, b.vy);
	if (armored || (b.pen || 0) >= PEN_MAX) return 0;          // броня и каска пулю останавливают
	b.pen = (b.pen || 0) + 1;                                  // мягкое тело: пуля летит дальше с ×0.6 урона
	b.dmg = dmg * PEN_DMG;
	b.vx *= 0.92; b.vy *= 0.92;
	(b.hit = b.hit || new Set()).add(h);
	return 1;
}
const WHIZZ_R = 90;      // на каком расстоянии от головы игрока пуля «свистит»
let whizzCD = 0;         // пауза между свистами, кадров
// пуля b уже миновала голову игрока и не попала: если прошла близко — свист и дёрг
function whizzCheck(b) {
	if (b.wz || Health.state.dead) return;
	const hd = hero.p.head;
	const behind = (hd.x - b.x) * b.vx + (hd.y - b.y) * b.vy < 0;     // голова осталась позади пули
	if (!behind) { b.ap = true; return; }                              // ещё летит к игроку
	b.wz = true;
	if (!b.ap || whizzCD > 0) return;                                  // вылетела уже позади игрока — не считаем
	const d = distToSeg(hd.x, hd.y, { x: b.px, y: b.py }, b);
	if (d > WHIZZ_R) return;
	whizzCD = 5;
	const near = 1 - d / WHIZZ_R;
	whizzSound(near);
	hitReact(hero, 'head', b.vx, b.vy, 0.12 + 0.3 * near);             // чуть дёрнулся
	shake = Math.max(shake, 0.6 + 1.2 * near);
}
const MISS_FOE = 0.05;      // шанс, что пуля пролетит сквозь врага без попадания
const MISS_FRIEND = 0.10;   // то же для игрока и бойцов отряда
function updateBullets() {
	if (whizzCD > 0) whizzCD--;
	for (let i = bullets.length - 1; i >= 0; i--) {
		const b = bullets[i];
		b.px = b.x; b.py = b.y;
		let dead = false;
		const targets = b.rc ? everybody() : (b.foe ? everyone() : foes);   // пуля врага бьёт по нашим, наша — по врагам; отрикошетившая — по всем
		const steps = Math.ceil(Math.hypot(b.vx, b.vy) / 11.5);
		for (let k = 0; k < steps; k++) {
			const ox = b.x, oy = b.y;
			b.x += b.vx / steps;
			b.y += b.vy / steps;
			if (b.y >= GROUND || b.x < 0 || b.x > WORLD_W) { dead = true; break; }
			const sc = solidAt(b.x, b.y);
			if (sc) {                                          // твёрдая поверхность: рикошет или остановка
				if (!tryRicochet(b, sc, ox, oy)) dead = true;
				break;
			}
			let bounced = false;
			hitBody(targets, b.x, b.y, 2, (u, h, seg) => {
				if (u.health.state.dead || (b.hit && b.hit.has(h))) return false;   // мёртвых и уже задетых этой пулей пропускаем
				if (Math.random() < (h.foe ? MISS_FOE : MISS_FRIEND)) {             // промах: пуля летит дальше, эту цель больше не проверяет
					(b.hit = b.hit || new Set()).add(h);
					return false;
				}
				const r = bulletHitUnit(b, u, seg);
				if (r === 0) dead = true; else if (r === 2) bounced = true;
				return dead || bounced;
			});
			if (dead || bounced) break;
		}
		if (!dead && (b.foe || b.rc)) whizzCheck(b);      // вражеская или отрикошетившая пуля прошла мимо — свист
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
const ROCKET_DUD_CHANCE = 0.25;   // шанс, что ракета воткнётся в землю и взорвётся с задержкой
const ROCKET_DUD_MIN = 60;        // задержка взрыва, кадров (1 с)
const ROCKET_DUD_MAX = 180;       // (3 с)
const DUD_SHARD_MUL = 1.25;       // осколков на 25% больше при таком взрыве

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
// ===== Общий звук: один контекст и общий регулятор громкости, через него оглушение глушит всё =====
const Snd = { ac: null, out: null, lp: null, deafEnd: 0 };
const DEAF_RECOVER = 3;       // сек: за это время звук возвращается после оглушения
function sndCtx() {
	if (!Snd.ac) {
		const ac = Snd.ac = new (window.AudioContext || window.webkitAudioContext)();
		Snd.lp = ac.createBiquadFilter(); Snd.lp.type = 'lowpass'; Snd.lp.frequency.value = 20000;
		Snd.out = ac.createGain();
		Snd.out.connect(Snd.lp); Snd.lp.connect(ac.destination);
	}
	if (Snd.ac.state === 'suspended') Snd.ac.resume();
	return Snd.ac;
}
// оглушение на sec секунд: звук почти пропадает и глохнет верх, потом плавно возвращается
function deafen(sec) {
	try {
		const a = sndCtx(), now = a.currentTime, end = now + sec;
		if (end <= Snd.deafEnd) return;                    // уже оглушён дольше
		Snd.deafEnd = end;
		const g = Snd.out.gain, f = Snd.lp.frequency;
		g.cancelScheduledValues(now); g.setValueAtTime(Math.max(0.03, g.value), now);
		g.linearRampToValueAtTime(0.03, now + 0.12);       // хлопок ещё слышен, потом тишина
		g.setValueAtTime(0.03, end);
		g.exponentialRampToValueAtTime(1, end + DEAF_RECOVER);
		f.cancelScheduledValues(now); f.setValueAtTime(Math.max(300, f.value), now);
		f.exponentialRampToValueAtTime(300, now + 0.12);
		f.setValueAtTime(300, end);
		f.exponentialRampToValueAtTime(20000, end + DEAF_RECOVER);
	} catch (e) { /* звук необязателен */ }
}
// свист пули: шум в полосе, тон падает при пролёте; near 0..1 — насколько близко прошла
function whizzSound(near) {
	try {
		const a = sndCtx(), now = a.currentTime;
		const len = 0.16 + 0.1 * (1 - near);
		const n = Math.floor(a.sampleRate * len);
		const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
		for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.5);
		const src = a.createBufferSource(); src.buffer = buf;
		const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
		bp.frequency.setValueAtTime(3800 + near * 1500, now);
		bp.frequency.exponentialRampToValueAtTime(1100, now + len);
		const g = a.createGain();
		g.gain.setValueAtTime(0.12 + 0.4 * near, now);
		g.gain.exponentialRampToValueAtTime(0.0001, now + len);
		src.connect(bp); bp.connect(g); g.connect(Snd.out);
		src.start(now);
	} catch (e) { /* звук необязателен */ }
}
// обычный взрыв: чем дальше от игрока, тем тише
function explosionSound(x, power) {
	try {
		const a = sndCtx(), now = a.currentTime;
		const vol = 0.55 * Math.min(1.5, power) * Math.max(0.08, 1 - Math.abs(x - hero.p.pelvis.x) / 2200);
		const n = Math.floor(a.sampleRate * 1.2);
		const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
		for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
		const noise = a.createBufferSource(); noise.buffer = buf;
		const lp = a.createBiquadFilter(); lp.type = 'lowpass';
		lp.frequency.setValueAtTime(2500, now); lp.frequency.exponentialRampToValueAtTime(250, now + 0.8);
		const g = a.createGain(); g.gain.value = vol;
		noise.connect(lp); lp.connect(g); g.connect(Snd.out); noise.start(now);
		const o = a.createOscillator(), og = a.createGain();
		o.type = 'sine';
		o.frequency.setValueAtTime(110, now); o.frequency.exponentialRampToValueAtTime(35, now + 0.5);
		og.gain.setValueAtTime(vol * 1.1, now); og.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
		o.connect(og); og.connect(Snd.out); o.start(now); o.stop(now + 0.7);
	} catch (e) { /* звук необязателен */ }
}
function megaSound() {
  try {
    const ac = sndCtx();
    const now = ac.currentTime;
    const len = Math.floor(ac.sampleRate * 3);
    const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const noise = ac.createBufferSource(); noise.buffer = buf;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const g = ac.createGain(); g.gain.value = 0.5;
    noise.connect(lp); lp.connect(g); g.connect(Snd.out); noise.start(now);
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(90, now); o.frequency.exponentialRampToValueAtTime(25, now + 2);
    og.gain.setValueAtTime(0.6, now); og.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
    o.connect(og); og.connect(Snd.out); o.start(now); o.stop(now + 2.5);
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
    if (r.stuck > 0) {                                       // ракета торчит в земле и ждёт взрыва
      if (Math.random() < 0.35) dust.push({ x: r.x + (Math.random() - 0.5) * 6, y: r.y - 6, vx: (Math.random() - 0.5) * 0.6, vy: -(0.6 + Math.random() * 1.2), r: 3, grow: 0.2, life: 50, max: 50, a: 0.35, c: '120,120,120' });
      if (--r.stuck <= 0) {
        rockets.splice(i, 1);
        explode(r.x, GROUND - 10, r.R || ROCKET_R, r.pw || ROCKET_POWER, DUD_SHARD_MUL, r.mega ? 'mega' : 'rocket', 'enemy');
      }
      continue;
    }
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
      explode(r.x, GROUND - roof.h - 4, r.R || ROCKET_R, r.pw || ROCKET_POWER, 1, r.mega ? 'mega' : 'rocket', 'enemy');
      continue;
    }
    if (r.y >= GROUND - 4) {
      if (!r.mega && Math.random() < ROCKET_DUD_CHANCE) {    // воткнулась в землю, взорвётся через 1–3 с
        r.stuck = ROCKET_DUD_MIN + Math.round(Math.random() * (ROCKET_DUD_MAX - ROCKET_DUD_MIN));
        r.y = GROUND - 6;
        spawnDust(r.x, 0.4);
        continue;
      }
      rockets.splice(i, 1);
      explode(r.x, GROUND - 10, r.R || ROCKET_R, r.pw || ROCKET_POWER, 1, r.mega ? 'mega' : 'rocket', 'enemy');
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
      if (hitBody(everybody(), b.x, b.y, 2, (u, h, seg) => {
        kickSeg(h, seg, b.vx, b.vy, 0.05);
        u.health.onShrapnel(seg.b, 1, { src: 'strafe', how: 'bullet', by: 'enemy' });
        addWound(u, seg, b.x, b.y, 'bullet', b.vx, b.vy);
        return true;
      })) dead = true;
    }
    if (!dead) whizzCheck(b);
    if (dead || b.y > H + 200) strafeShots.splice(i, 1);
  }
}
const WORLD_W = 20000;
const START_X = 220;
const FINISH_X = WORLD_W - 260;
const props = [];
const SANDBAG_H = 100;                     // высота мешков с песком (боец ~190, в приседе голова ~150)
const BARRIER_H = 115;                     // высота бетонного барьера
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
    if (r < 0.26) p = { type: 'sandbags', w: 150 + rnd() * 70, h: SANDBAG_H };
    else if (r < 0.46) p = { type: 'barrier', w: 76, h: BARRIER_H };
    else if (r < 0.598) p = { type: 'medkit', w: 64, h: 44, left: 30, deco: true };   // 12% → 13,8% (+15%)
    else if (r < 0.678) p = { type: 'armor', w: 86, h: 56, left: 5, deco: true };     // станция брони: 5 комплектов
    else if (r < 0.86) p = { type: 'trench', w: 360 + rnd() * 220, h: 58 };
    else if (r < 0.94) p = { type: 'house', w: 300 + rnd() * 60, h: 262 };
    else p = { type: 'wire', w: 120 + rnd() * 110, h: 34, deco: true };
    p.x = x;
    p.s = rnd() * 1000;
    if (p.type === 'house') p.mg = Math.random() < MG_CHANCE;   // в доме сидит пулемётчик
    if (p.type === 'sandbags') p.nest = Math.random() < MG_NEST_CHANCE;   // 5%: за мешками сидит пулемётчик
    props.push(p);
    x += p.w + 220 + rnd() * 420;
  }
  const houses = props.filter(p => p.type === 'house');                                  // хотя бы в одном доме — пулемётчик
  if (houses.length && !houses.some(p => p.mg)) houses[Math.floor(Math.random() * houses.length)].mg = true;
}
const CAM_LOOK = 0.5;                       // насколько камера уезжает к курсору (0 — выключено, 1 — сильно)
function updateCamera() {
  const target = hero.p.pelvis.x - W * 0.45 + CAM_LOOK * (mouse.sx - W * 0.5);
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
function update() {
	refreshUnits();
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
	if (!won && !Health.state.dead) stats.frames++;
	for (const e of foes) {                                   // каждого убитого врага считаем один раз
		if (!e.health.state.dead || e.counted) continue;
		e.counted = true;
		stats.kills++;
		if (e.health.state.death && e.health.state.death.by === 'player') stats.mine++;
	}
	updateCallouts();
	updateGrenades();
	updateShards();
	updateBigShards();
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
  if (e.code === 'Space') e.preventDefault();
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
applyLook(hero, heroLook());
  applyHeroWeapon();
  won = false;
  camX = 0;
  genWorld();
  genSquad();
  stats.frames = stats.kills = stats.mine = stats.shots = stats.hits = stats.nades = 0;
  stun = 0;
  mouseDown = false;
  for (const k in keys) keys[k] = false;
  effects.length = 0;
  grenades.length = 0;
  nades = NADE_MAX;
  mags.length = 0;
  shards.length = 0;
  bigShards.length = 0;
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
  callouts.length = 0;
  spawnFoeGroups();
  spawnGunners();
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
let leaving = false;                                       // идёт анимация выхода из меню
let leaveTimers = [];
function startPlay() {
  if (leaving) return;
  leaving = true;
  menuEl.classList.add('leaving');                         // 1) «выключение экрана»: контент схлопывается в линию
  leaveTimers = [
    setTimeout(() => {                                     // 2) игра стартует под затухающим меню
      inMenu = false;
      document.body.classList.add('starting');             // картинка игры проявляется из темноты
      if (!started) {
        started = true;
        hudEl.classList.remove('hidden');
        helpTimer = setTimeout(() => hudEl.classList.add('hidden'), 15000);   // подсказка сама прячется через 15 с
      }
    }, 500),
    setTimeout(() => {                                     // 3) меню убираем совсем
      menuEl.classList.add('gone');
      menuEl.classList.remove('leaving');
      document.body.classList.remove('in-menu');
      leaving = false;
    }, 1100),
    setTimeout(() => document.body.classList.remove('starting'), 1700)
  ];
}
function openMenu() {
  leaveTimers.forEach(clearTimeout);                       // отменяем анимацию входа, если она ещё идёт
  leaving = false;
  menuEl.classList.remove('leaving');
  document.body.classList.remove('starting');
  inMenu = true;
  mouseDown = false;
  hero.nadeAim = false;
  for (const k in keys) keys[k] = false;
  playBtn.querySelector('span').textContent = 'Продолжить';
  menuEl.classList.remove('gone');
  document.body.classList.add('in-menu');
}
playBtn.addEventListener('click', startPlay);
const keysBtn = document.getElementById('btnKeys');
const charBtn = document.getElementById('btnChar');
// правая панель меню: '' — «Что в игре», 'keys' — «Управление», 'char' — «Персонаж»
function setMenuPanel(name) {
	menuEl.classList.toggle('show-keys', name === 'keys');
	menuEl.classList.toggle('show-char', name === 'char');
	keysBtn.classList.toggle('active', name === 'keys');
	charBtn.classList.toggle('active', name === 'char');
	if (name === 'char') openChar();
}
keysBtn.addEventListener('click', () => setMenuPanel(menuEl.classList.contains('show-keys') ? '' : 'keys'));
charBtn.addEventListener('click', () => setMenuPanel(menuEl.classList.contains('show-char') ? '' : 'char'));

// ===== Меню «Персонаж» =====
const charCv = document.getElementById('charPreview');
const charCtx = charCv.getContext('2d');
const charOptsEl = document.getElementById('charOpts');
const charBtns = [];											// { o, val, b } — для подсветки выбранных вариантов
let charDummy = null, charDummyHealth = null, charGround = 0;
function charNorm(L) {											// копия облика: роль «герой» и значения по умолчанию для новых полей
	const C = Object.assign({}, L);
	C.role = 'hero';
	for (const o of CHAR_OPTS) if (C[o.k] === undefined) C[o.k] = o.v[0];
	return C;
}
function openChar() {
	renderCharSlots();
	if (!heroCfg) heroCfg = charNorm(hero.look);				// стартуем с текущего (случайного) облика
	if (!charBtns.length) buildCharUI();
	refreshChar();
}
function buildCharUI() {
	let grp = null;
	for (const o of CHAR_OPTS) {
		if (o.g !== grp) {
			grp = o.g;
			const h = document.createElement('h3');
			h.textContent = grp;
			charOptsEl.appendChild(h);
		}
		const row = document.createElement('div');
		row.className = 'char-row';
		const lab = document.createElement('span');
		lab.className = 'char-lab';
		lab.textContent = o.t;
		const box = document.createElement('div');
		box.className = 'char-vals';
		o.v.forEach((val, i) => {
			const b = document.createElement('button');
			b.type = 'button';
			if (o.c && val !== null) {
				b.className = 'char-sw';
				b.style.background = Array.isArray(val) ? 'linear-gradient(135deg,' + val[0] + ' 50%,' + val[1] + ' 50%)' : val;
			} else {
				b.className = 'char-tx';
				b.textContent = o.n ? o.n[i] : 'Нет';
			}
			b.addEventListener('click', () => {
				heroCfg[o.k] = val;
				if (o.k === 'mask' && val) heroCfg.beard = 0;		// под балаклавой бороды не видно
				applyCharCfg();
			});
			box.appendChild(b);
			charBtns.push({ o, val, b });
		});
		row.appendChild(lab);
		row.appendChild(box);
		charOptsEl.appendChild(row);
	}
}
function applyCharCfg() {
	saveCharCur();												// автосохранение текущего облика
	applyHeroWeapon();
	applyLook(hero, Object.assign({}, heroCfg));				// сразу красим настоящего бойца — рестарт не нужен
	refreshChar();
}
function refreshChar() {
	for (const x of charBtns) x.b.classList.toggle('on', heroCfg[x.o.k] === x.val);
	drawCharPreview();
}
function drawCharPreview() {
	if (!charDummy || charGround !== GROUND) {					// запасной боец только для превью, игру не трогает
		charDummy = createHero(0);
		charDummy.gun = 0; charDummy.gunWant = false; charDummy.isPlayer = true;
		charDummyHealth = makeHealth(false);
		charGround = GROUND;
	}
	charDummy.sniper = heroCfg.weapon === 'sniper';
	charDummy.mg = heroCfg.weapon === 'mg';
	applyLook(charDummy, Object.assign({}, heroCfg));
	const cw = charCv.width, ch = charCv.height;
	const top = charDummy.p.head.y - 26;						// макушка с запасом под каску
	const sc = Math.min(2, (ch - 36) / (GROUND - top));		// масштаб: боец целиком влезает в окно
	const mainCtx = ctx;
	charCtx.clearRect(0, 0, cw, ch);
	charCtx.save();
	charCtx.translate(cw / 2, ch - 16);
	charCtx.scale(sc, sc);
	charCtx.translate(-charDummy.p.pelvis.x, -GROUND);
	ctx = charCtx;
	try {
		withUnit({ hero: charDummy, health: charDummyHealth, keys: {} }, drawUnit);
	} finally {
		ctx = mainCtx;
		charCtx.restore();
	}
}
const CHAR_PRESETS = {
	random: () => { heroCfg = null; return heroLook(); },		// heroLook без heroCfg выдаёт новый случайный облик
	classic: () => makeLook('hero', lkDeal()),
	foe: () => makeLook('foe', lkDeal()),
	medic: () => makeLook('medic', lkDeal()),
	sniper: () => makeLook('sniper', lkDeal())
};
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
	const w = heroCfg && heroCfg.weapon;										// пресет меняет внешность, но не оружие
	heroCfg = charNorm(CHAR_PRESETS[b.dataset.preset]());
	if (w) heroCfg.weapon = w;
	applyCharCfg();
}));
// ===== Сохранение персонажа и слоты =====
const CHAR_SLOTS = 3;
const CHAR_KEY = 'wr_char_cur';								// текущий облик (автосохранение)
const CHAR_SLOTS_KEY = 'wr_char_slots';						// массив слотов
const charSlotsEl = document.getElementById('charSlots');
function lsGet(k) {
	try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; }
}
function lsSet(k, v) {
	try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ }
}
function saveCharCur() {
	if (heroCfg) lsSet(CHAR_KEY, heroCfg);
}
function loadCharSlots() {
	const a = lsGet(CHAR_SLOTS_KEY);
	const out = [];
	for (let i = 0; i < CHAR_SLOTS; i++) out.push(Array.isArray(a) && a[i] && typeof a[i] === 'object' ? a[i] : null);
	return out;
}
function renderCharSlots() {
	const slots = loadCharSlots();
	charSlotsEl.innerHTML = '';
	slots.forEach((s, i) => {
		const row = document.createElement('div');
		row.className = 'char-slot';
		const lab = document.createElement('span');
		lab.className = 'char-slot-lab';
		lab.textContent = 'Слот ' + (i + 1) + (s ? '' : ' — пусто');
		row.appendChild(lab);
		const mk = (txt, off, fn) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'char-act';
			b.textContent = txt;
			b.disabled = off;
			b.addEventListener('click', fn);
			row.appendChild(b);
		};
		mk('Сохранить', false, () => {
			const a = loadCharSlots();
			a[i] = Object.assign({}, heroCfg);
			lsSet(CHAR_SLOTS_KEY, a);
			renderCharSlots();
		});
		mk('Загрузить', !s, () => {
			heroCfg = charNorm(s);
			applyCharCfg();
		});
		mk('Удалить', !s, () => {
			const a = loadCharSlots();
			a[i] = null;
			lsSet(CHAR_SLOTS_KEY, a);
			renderCharSlots();
		});
		charSlotsEl.appendChild(row);
	});
}
function applyHeroWeapon() {									// ставит оружие из heroCfg; патроны полные только при смене оружия
	const w = (heroCfg && heroCfg.weapon) || 'ak';
	const cur = hero.sniper ? 'sniper' : hero.mg ? 'mg' : 'ak';
	if (cur === w) return;
	hero.sniper = w === 'sniper';
	hero.mg = w === 'mg';
	hero.ammo = magSize(hero);
	hero.reloadT = 0; hero.magOut = false; hero.magHeld = false; hero.shootCD = 0;
}
const savedChar = lsGet(CHAR_KEY);
if (savedChar && typeof savedChar === 'object') heroCfg = charNorm(savedChar);		// облик из прошлой сессии

hero = createHero(START_X);
hero.isPlayer = true;
applyLook(hero, heroLook());
applyHeroWeapon();
genWorld();
genSquad();
spawnFoeGroups();
spawnGunners();
const DT = 1000 / 60;
let last = performance.now();
let acc = 0;
const perf = { show: false, upd: 0, ren: 0 };
window.addEventListener('keydown', e => { if (e.code === 'F3') { perf.show = !perf.show; e.preventDefault(); } });
function frame(now) {
  acc += Math.min(50, now - last);                      // не больше 3 обновлений за кадр: при просадке игра замедляется, а не уходит в спираль
  last = now;
  const t0 = performance.now();
  while (acc >= DT) {
    if (!inMenu) update();
    acc -= DT;
  }
  const t1 = performance.now();
  render();
  const t2 = performance.now();
  perf.upd += ((t1 - t0) - perf.upd) * 0.05;
  perf.ren += ((t2 - t1) - perf.ren) * 0.05;
  if (perf.show) {                                      // F3: сколько мс уходит на логику и на отрисовку
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W - 250, 150, 240, 46);
    ctx.fillStyle = '#b6e36a'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
    ctx.fillText('update ' + perf.upd.toFixed(2) + ' мс · render ' + perf.ren.toFixed(2) + ' мс', W - 242, 168);
    ctx.fillText('врагов ' + foes.length + ' (спят ' + foes.filter(e => e.sleep).length + ') · пуль ' + bullets.length, W - 242, 186);
  }
  updateNadeHud();
  updateAmmoHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);