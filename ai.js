'use strict';
const CALLSIGNS = ['Альфа', 'Браво', 'Чарли', 'Дельта', 'Эхо', 'Фокстрот', 'Гольф', 'Отель', 'Леший', 'Гризли', 'Тень', 'Север', 'Рысь', 'Гром', 'Бес', 'Шмель', 'Кедр', 'Байкал'];
const CALLSIGNS_SNIPER = ['Ворон', 'Сокол', 'Гриф', 'Кречет', 'Глаз'];
const CALLSIGNS_MEDIC = ['Айболит', 'Пилюля', 'Склиф', 'Бинт', 'Таблетка'];
function assignCallsigns() {                                 // уникальный позывной каждому, по роли
	const gen = CALLSIGNS.slice(), sn = CALLSIGNS_SNIPER.slice(), md = CALLSIGNS_MEDIC.slice();
	for (const a of squad) {
		let pool = (a.personal || a.isMedic) ? md : a.sniper ? sn : gen;
		if (!pool.length) pool = gen;
		a.call = a.hero.call = pool.splice((Math.random() * pool.length) | 0, 1)[0];
	}
}
const squad = [];
const LIE_MIN = 780, LIE_MAX = 1020;
const LIE_FOR = 150;
const ALLY_SHIRTS = [['#6b5d3b', '#54482c'], ['#4f6a5a', '#3d5446'], ['#6a4f3b', '#523c2c'], ['#5a5f6f', '#464a58']];
// списки собираются один раз за кадр (раньше каждый вызов создавал новые массивы — на каждый осколок и пулю)
let unitsF = [], unitsA = [];
function refreshUnits() {
  unitsF = [{ hero, health: playerHealth }, ...squad];
  unitsA = unitsF.concat(foes);
}
const everyone = () => unitsF;
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
// ===== Позывные и радиосообщения о гибели =====

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
  assignCallsigns();
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
    if (Math.abs(dx) < holdDist(a) || dx * dir <= 0) dir = 0;
    if (a.coverX != null) {                      // идём в укрытие, пригибаемся и выглядываем стрелять
      const cx = a.coverX - x;
      dir = Math.abs(cx) > 14 ? Math.sign(cx) : 0;
      if (dir === 0) k.KeyS = !peekUp(a);
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
const SIGHT = 1210;                    // дальность, на которой боец замечает противника (+10%)
const FIRE_RANGE = 850;                // дальность стрельбы
const SNIPER_RANGE = FIRE_RANGE * 3;   // дальность снайпера (и его зрение)
const BLOCKED_HOLD = 140;              // цель не прострелить (за укрытием, в траншее) — подходим на столько px вместо обычной дистанции
const holdDist = a => a.blockT > 30 ? BLOCKED_HOLD : a.holdD;
const aimTarget = a => a.visHead && a.tgt === a.vis ? a.tgt.hero.p.head : a.tgt.hero.p.chest;   // точка, куда реально целимся
const peekUp = a => (a.peekT = (a.peekT || 0) + 1) % 120 < 60;   // за укрытием: 60 кадров стоит и стреляет, 60 сидит
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
const everybody = () => unitsA;                     // все, кого можно ранить

function tintFoe(h, i) {
  const [light, dark] = FOE_COLORS[i % FOE_COLORS.length];
  const map = { [COLORS.shirt]: light, [COLORS.shirtDark]: dark, [COLORS.pants]: '#3f444c', [COLORS.pantsDark]: '#30343a' };
  for (const s of h.segs) if (map[s.c]) s.c = map[s.c];
  h.helmetC = '#3a3f47';
}
// ===== Пулемётчик в доме: сидит у окна, 14 с непрерывно стреляет «в белый свет», 4 с отдыхает =====
const MG_CHANCE = 0.75;          // шанс, что в доме сидит пулемётчик
const MG_SIGHT = FIRE_RANGE * 1.4;   // дальность, на которой пулемётчик замечает цель и стреляет (+40%)
const MG_FIRE_T = 14 * 60;      // кадров огня
const MG_REST_T = 4 * 60;       // кадров отдыха
const MG_CD = 5;                // кадров между выстрелами (12 в секунду)
const MG_SPREAD = 0.14;         // разброс каждой пули, рад
const MG_BIAS = 0.22;           // медленно «плывущий» перекос прицела, рад
function spawnGunners() {
	for (const c of props) {
		if (c.type !== 'house' || !c.mg) continue;
		const side = -1;                                              // только левое окно: стреляет влево, в сторону игрока
		const x = side < 0 ? c.x + HOUSE_WALL + 30 : c.x + c.w - HOUSE_WALL - 30;
		spawnFoe(x, foes.length);
		const e = foes[foes.length - 1];
		e.hero.ammo = 1e9;                                            // ленту не кончить
		Object.assign(e, {
			gunner: true, house: c, side,
			wx: side < 0 ? c.x + HOUSE_WALL / 2 : c.x + c.w - HOUSE_WALL / 2,   // середина стены в окне
			wy: GROUND - (HOUSE_WIN_LO + HOUSE_WIN_HI) / 2,
			mgT: Math.random() * (MG_FIRE_T + MG_REST_T), mgPh: Math.random() * Math.PI * 2, firing: false
		});
	}
}
function gunnerThink(e) {
	const k = e.keys, h = e.hero, st = e.health.state;
	k.KeyA = k.KeyD = k.KeyR = k.ShiftLeft = false;
	k.KeyS = true;                                                    // сидит и не двигается
	h.treat = null;
	combatThink(e);                                                   // инициализация бойца; цель и оружие ниже переопределяем
	if (st.dead) return;
	e.mgT++;
	e.firing = e.mgT % (MG_FIRE_T + MG_REST_T) < MG_FIRE_T;          // 14 с огня, 4 с отдыха
	let best = null, bd = MG_SIGHT;
	for (const u of everyone()) {                                     // цель — только по ту сторону дома, где его окно
		if (!canTarget(u)) continue;
		const tx = u.hero.p.chest.x, d = Math.abs(tx - e.wx);
		if ((tx - e.wx) * e.side <= 0 || d >= bd) continue;
		if (!clearShot(e.wx, e.wy, tx, u.hero.p.chest.y)) continue;   // цель за мешками/барьером — не тратим ленту
		bd = d; best = u;
	}
	e.tgt = best;
	h.gunWant = e.firing;
	h.gunRestore = false;
	if (e.firing) {
		const c = h.p.chest;
		h.aimWant = best ? Math.atan2(best.hero.p.chest.y - c.y, best.hero.p.chest.x - c.x) : (e.side > 0 ? 0 : Math.PI);
	} else h.aimWant = e.side > 0 ? 0 : Math.PI;                      // в отдыхе оружие опущено, но смотрит в сторону окна
}
function gunnerShoot(e) {
	const h = e.hero, st = e.health.state;
	if (won || st.dead || st.ko > 0 || e.stun > 0 || !e.firing || !e.tgt) return;
	if (h.shootCD > 0 || h.gun < 1 || h.getup || h.lie > 0.5 || h.bal < 0.5) return;
	const t = e.tgt.hero.p.chest;
	const a = Math.atan2(t.y - e.wy, t.x - e.wx)
		+ Math.sin(e.mgT * 0.02 + e.mgPh) * MG_BIAS                   // прицел медленно «плывёт»
		+ (Math.random() - 0.5) * 2 * MG_SPREAD;                      // плюс разброс на каждую пулю
	bullets.push({ x: e.wx, y: e.wy, px: e.wx, py: e.wy, vx: Math.cos(a) * 60, vy: Math.sin(a) * BULLET_SPEED, life: 90, foe: true, sn: false, mg: true, dmg: 2.5, sx: e.wx });
	flashes.push({ x: e.wx, y: e.wy, a, life: 7, max: 7 });           // пули и вспышка — из окна
	h.shootCD = MG_CD;
	h.p.chest.px -= Math.cos(h.aimA) * 1.2; h.p.chest.py -= Math.sin(h.aimA) * 1.2;   // отдача
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
  const alive = foes.filter(e => !e.health.state.dead && !e.gunner).length;
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
// цель, по которой стреляют: живой, в сознании, не в болевом шоке (лежачих без сознания не добивают)
const canTarget = u => { const st = u.health.state; return !st.dead && st.ko === 0 && !st.shock; };
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
  const lim = h.sniper ? SNIPER_RANGE : SIGHT;
  const list = h.foe ? everyone() : foes;
  let bd = lim;
  for (const u of list) {
    if (!canTarget(u)) continue;
    const d = Math.abs(u.hero.p.pelvis.x - x);
    if (d < bd) { bd = d; a.tgt = u; }
  }
  if ((a.losT = (a.losT || 0) - 1) <= 0) {                   // раз в 8 кадров ищем ближайшую цель, в которую можно попасть
    a.losT = 8; a.vis = null;
    let vd = lim;
    for (const u of list) {
      if (!canTarget(u)) continue;
      const d = Math.abs(u.hero.p.pelvis.x - x);
      if (d >= vd) continue;
      const pt = aimPoint(h.p.chest, u.hero);
      if (pt) { vd = d; a.vis = u; a.visHead = pt === u.hero.p.head; }
    }
  }
  if (a.vis && canTarget(a.vis) && Math.abs(a.vis.hero.p.pelvis.x - x) < lim) { a.tgt = a.vis; a.blocked = false; }
  else a.blocked = !!a.tgt;                                  // видит врага, но прострелить нельзя
  a.blockT = a.blocked ? (a.blockT || 0) + 1 : 0;
  if (a.blockT > 120 && a.coverX != null) { a.coverX = null; a.coverT = 200; }   // 2 с не можем попасть — выходим из укрытия и идём ближе
  if (a.heardT > 0) {                                        // услышал звон каски
    a.heardT--;
    if (!a.tgt) {                                            // цели не видит — достаёт оружие и смотрит на звук
      a.seeT = Math.max(a.seeT, 60);
      h.aimWant = a.heardX < x ? Math.PI : 0;
    }
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
    let t = aimTarget(a);
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
  if (a.blocked || !shotClear(h.p.chest, aimTarget(a))) return;   // линия огня перекрыта (мешки, барьер, траншея, своё укрытие) — не тратим патроны
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
    dir = Math.abs(dx) > holdDist(e) ? Math.sign(dx) : 0;
    if (e.coverX != null) {                      // идём в укрытие, пригибаемся и выглядываем стрелять
      const cx = e.coverX - x;
      dir = Math.abs(cx) > 14 ? Math.sign(cx) : 0;
      if (dir === 0) k.KeyS = !peekUp(e);
    } else if (dir === 0 && e.cover) k.KeyS = true;
  } else if (e.heardT > 0 && Math.abs(e.heardX - x) > 250) dir = Math.sign(e.heardX - x);   // услышал звон — идёт на звук
  dir = steadyDir(e, dir);
  if (dir > 0) k.KeyD = true; else if (dir < 0) k.KeyA = true;
}
const SLEEP_DIST = 3000, WAKE_DIST = 2700;      // дальше от наших — враг «спит», ближе — просыпается
function nearestFriendDist(x) {
  let d = 1e9;
  for (const u of unitsF) {
    if (u.health.state.dead) continue;
    const dd = Math.abs(u.hero.p.pelvis.x - x);
    if (dd < d) d = dd;
  }
  return d;
}
function driftFoe(e) {                           // спящий враг просто смещается влево со скоростью шага, без физики
  const h = e.hero;
  if (h.p.pelvis.x <= 150) return;
  const dx = -GAIT.speed * (h.speedK || 1);
  for (const [, p] of (h.pts || (h.pts = Object.entries(h.p)))) { p.x += dx; p.px += dx; p.fx += dx; }
}
function updateFoes() {
  if (!won && --foeTimer <= 0) {
    foeTimer = FOE_WAVE_MIN + Math.random() * (FOE_WAVE_MAX - FOE_WAVE_MIN);
    spawnWave();
  }
  for (let i = foes.length - 1; i >= 0; i--) {
    const e = foes[i];
    const d = nearestFriendDist(e.hero.p.pelvis.x);
    e.sleep = e.sleep ? d > WAKE_DIST : d > SLEEP_DIST;
    if (e.sleep) {
      if (!e.health.state.dead && !e.gunner) driftFoe(e);
    } else {
      if (e.gunner) gunnerThink(e); else foeThink(e);
      runAs(e, stepHero);
      if (e.gunner) gunnerShoot(e); else aiShoot(e);
    }
    if (e.health.state.dead && (e.deadT = (e.deadT || 0) + 1) > 900 && !onScreen(e.hero.p.pelvis.x - 150, 300)) foes.splice(i, 1);
  }
}
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
    h.helmetOff = h.armorOff = false;
    for (let i = 0; i < 8; i++) {
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