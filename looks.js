'use strict';
// ===== Внешний вид бойцов: штаны, обувь, кожа, волосы, аксессуары =====
// Каждому бойцу отряда и герою выдаётся объект hero.look. У врагов его нет — они рисуются как раньше.
// Подключается после ragdoll.js. Хуки в render.js: drawBackpack, drawLookSeg, drawHeadLook, drawHelmetLook, handColor.

// [светлый, тёмный] — тёмный цвет идёт на дальнюю ногу, как и в основной палитре
const LOOK_PANTS = [
  ['#55603a', '#3f4a2b'],   // олива
  ['#7a6f50', '#5e5539'],   // хаки (у героя)
  ['#3d4650', '#2c343c'],   // сланец
  ['#4d4d49', '#383835'],   // серые
  ['#5b4a3a', '#45372a'],   // коричневые
  ['#2f3b2c', '#222c20'],   // тёмно-зелёные
  ['#46566a', '#35424f'],   // сине-серые
  ['#8a8060', '#6b6249']    // песок
];
const LOOK_HERO_PANTS = LOOK_PANTS[1];
const LOOK_BOOTS = [['#3a2e22', '#271e15'], ['#2a2a2a', '#1b1b1b'], ['#5a4630', '#40321f'], ['#4a3f35', '#332b24']];
const LOOK_SKIN = [['#e8b98e', '#c98f68'], ['#f0c9a4', '#d3a07a'], ['#d9a47a', '#b9835c'], ['#c68e63', '#a5724a'], ['#8d5a3b', '#704529']];
const LOOK_HAIR = ['#2a1d12', '#4a3322', '#7b5a34', '#b08a4a', '#1c1c1c', '#8a8a86'];
const LOOK_HELMET = ['#4a5a33', '#55603a', '#5b5b3d', '#46503a', '#3f4a3a', '#6a6445'];
const LOOK_VEST = ['#3f4a35', '#4a4538', '#3a4048', '#4e4a3a'];
const LOOK_GLOVE = ['#2a2a26', '#3a3226', '#5a4a30'];
const LOOK_SCARF = ['#8a3a2e', '#3d5a73', '#c9b36a', '#d8d4c4', '#4d6b3a'];
const LOOK_BAND = ['#c9b36a', '#3d5a73', '#8a3a2e', '#d8d4c4'];     // оранжевый — только у героя, белый — у медиков
const LOOK_RIG = ['#3d3a2a', '#2f3a30', '#46402f'];
const HERO_BAND = '#e08a2b';
// враги: холодная серо-чёрная гамма, красная повязка и маска вместо наших тёплых оливковых тонов
const LOOK_FOE_PANTS = [['#3f444c', '#30343a'], ['#2f3236', '#222427'], ['#4a463e', '#37342d'], ['#3a4048', '#2b3036'], ['#4d4f50', '#383a3b']];
const LOOK_FOE_BOOTS = [['#1f1f1f', '#141414'], ['#2a2a2a', '#1b1b1b'], ['#33291f', '#241c15']];
const LOOK_FOE_MASK = ['#202226', '#3a3d42', '#4a463e'];
const FOE_BAND = '#a83a2e';

const lkPick = a => a[(Math.random() * a.length) | 0];
const lkChance = p => Math.random() < p;
// колода: пока не выдали все варианты — повторов нет (отряд не будет в одинаковых штанах)
function lkDeck(arr) {
  let d = [];
  return () => { if (!d.length) d = arr.slice().sort(() => Math.random() - 0.5); return d.pop(); };
}
function lkDeal() {
  return {
    pants: lkDeck(LOOK_PANTS.filter(p => p !== LOOK_HERO_PANTS)),
    skin: lkDeck(LOOK_SKIN),
    style: lkDeck(['plain', 'cargo', 'camo', 'patch', 'cargo', 'plain']),
    pack: lkDeck(['ruck', 'small', 'radio', 'none', 'small', 'none', 'ruck'])
  };
}

// роль: 'hero' | 'medic' | 'sniper' | 'rifle'
function makeLook(role, deal) {
  const L = {
    role,
    skin: deal.skin(), hair: lkPick(LOOK_HAIR),
    pants: deal.pants(), pantsStyle: deal.style(), boots: lkPick(LOOK_BOOTS),
    helmet: lkPick(LOOK_HELMET), vest: lkPick(LOOK_VEST),
    sleeve: lkChance(0.3),                                // длинный рукав вместо голого предплечья
    glove: null, scarf: null, puttee: null,
    pack: deal.pack(), packC: lkPick(['#5d6b45', '#6b5f45', '#4a4f3a', '#56503a']),
    rig: false, rigC: lkPick(LOOK_RIG), bandolier: false, canteen: false, kneePads: false,
    beard: 0, glasses: null, goggles: false, band: null, armband: null, armCross: false,
    camo: Array.from({ length: 8 }, () => [Math.random() * 2 - 1, Math.random() * 2 - 1, 0.18 + Math.random() * 0.22, 0.3 + Math.random() * 0.4, Math.random() * 3])
  };
  if (role === 'hero') {
    Object.assign(L, {
      pants: LOOK_HERO_PANTS, pantsStyle: 'cargo', boots: LOOK_BOOTS[0], skin: LOOK_SKIN[0], hair: '#3a2a1a',
      sleeve: false, glove: '#2a2a26', scarf: '#c9b36a', pack: 'ruck', packC: '#5d6b45', rig: false, canteen: true,
      kneePads: true, beard: 1, goggles: true, band: HERO_BAND, helmet: '#4a5a33', vest: '#3f4a35'
    });
  } else if (role === 'foe') {
    Object.assign(L, {
      pants: lkPick(LOOK_FOE_PANTS), boots: lkPick(LOOK_FOE_BOOTS), helmet: '#3a3f47', vest: '#2f3338',
      armband: FOE_BAND, mask: lkChance(0.45) ? lkPick(LOOK_FOE_MASK) : null,
      rig: lkChance(0.6), rigC: lkPick(['#2a2c2e', '#33322c']), bandolier: false,
      scarf: lkChance(0.2) ? lkPick(['#8a3a2e', '#4a463e', '#3a4048']) : null,
      glove: lkChance(0.5) ? '#222' : null, kneePads: lkChance(0.4), canteen: lkChance(0.4),
      pack: lkPick(['none', 'small', 'small', 'ruck', 'radio']), packC: lkPick(['#3a3d42', '#4a463e', '#34382f']),
      glasses: lkChance(0.15) ? 'shades' : null, goggles: false, band: null, puttee: null,
      pantsStyle: lkPick(['plain', 'cargo', 'cargo', 'patch', 'camo'])
    });
    if (L.mask) L.beard = 0;
  } else if (role === 'medic') {
    Object.assign(L, {
      pack: 'medic', packC: '#5d6b45', rig: false, bandolier: false, armband: '#e8e8dc', armCross: true, band: '#e8e8dc',
      pantsStyle: lkPick(['plain', 'cargo']), glove: lkChance(0.4) ? lkPick(LOOK_GLOVE) : null, beard: lkChance(0.3) ? 1 : 0
    });
  } else if (role === 'sniper') {
    Object.assign(L, {
      pantsStyle: 'camo', scarf: lkPick(['#4d6b3a', '#7a6f50', '#56503a']), glove: lkPick(LOOK_GLOVE),
      pack: lkChance(0.6) ? 'small' : 'none', puttee: lkChance(0.5) ? '#7a6f50' : null, beard: lkChance(0.4) ? 1 : 0
    });
  } else {
    L.rig = lkChance(0.65);
    L.bandolier = !L.rig && lkChance(0.3);
    L.scarf = lkChance(0.35) ? lkPick(LOOK_SCARF) : null;
    L.glove = lkChance(0.35) ? lkPick(LOOK_GLOVE) : null;
    L.glasses = lkChance(0.25) ? lkPick(['shades', 'clear']) : null;
    L.goggles = !L.glasses && lkChance(0.2);
    L.beard = lkPick([0, 0, 1, 2]);
    L.kneePads = lkChance(0.45);
    L.canteen = lkChance(0.4);
    L.puttee = lkChance(0.2) ? '#8d7f5a' : null;
    L.band = lkChance(0.25) ? lkPick(LOOK_BAND.filter(c => c !== '#d8d4c4')) : null;
  }
  return L;
}

// перекрашивает сегменты тела героя под look и запоминает его в h.look
function applyLook(h, L) {
  h.look = L;
  h.helmetC = L.helmet;
  h.vestC = L.vest;
  const seg = (a, b) => h.segs.find(s => s.a === a && s.b === b);
  const set = (a, b, c) => { const s = seg(a, b); if (s) s.c = c; };
  set('pelvis', 'kneeB', L.pants[1]); set('kneeB', 'ankleB', L.pants[1]);
  set('pelvis', 'kneeF', L.pants[0]); set('kneeF', 'ankleF', L.pants[0]);
  set('ankleB', 'toeB', L.boots[1]); set('ankleF', 'toeF', L.boots[0]);
  set('chest', 'neck', L.skin[0]); set('neck', 'head', L.skin[0]);
  const sb = seg('chest', 'elbowB'), sf = seg('chest', 'elbowF');   // рукав берём у уже покрашенной рубашки
  set('elbowB', 'wristB', L.sleeve && sb ? sb.c : L.skin[1]);
  set('elbowF', 'wristF', L.sleeve && sf ? sf.c : L.skin[0]);
}
// роли берутся из отряда, когда снайперы и медики уже выбраны
function dealLooks() {
  const deal = lkDeal();
  for (const a of squad) {
    const role = a.personal ? 'medic' : a.sniper ? 'sniper' : a.isMedic ? 'medic' : 'rifle';
    applyLook(a.hero, makeLook(role, deal));
  }
}
// ===== Настройка героя из меню «Персонаж» =====
let heroCfg = null;										// облик героя из меню; null — каждый рестарт случайный
// g — группа, k — поле в look, t — подпись, v — варианты, c — варианты это цвета, n — подписи текстовых вариантов
const CHAR_OPTS = [
	{ g: 'Оружие', k: 'weapon', t: 'Оружие', v: ['ak', 'sniper', 'mg'], n: ['АК', 'Снайперка', 'Пулемёт'] },
	{ g: 'Голова', k: 'skin', t: 'Кожа', v: LOOK_SKIN, c: 1 },
	{ g: 'Голова', k: 'hair', t: 'Волосы', v: [...LOOK_HAIR, '#7a3a1e', '#d8d4c4'], c: 1 },
	{ g: 'Голова', k: 'beard', t: 'Борода', v: [0, 1, 2], n: ['Нет', 'Щетина', 'Борода'] },
	{ g: 'Голова', k: 'mask', t: 'Балаклава', v: [null, ...LOOK_FOE_MASK, '#6b6a45', '#8a3a2e'], c: 1 },
	{ g: 'Голова', k: 'paint', t: 'Боевой раскрас', v: [null, '#1a1a14', '#8a3a2e', '#c9c4a0'], c: 1 },
	{ g: 'Голова', k: 'scar', t: 'Шрам', v: [false, true], n: ['Нет', 'Есть'] },
	{ g: 'Голова', k: 'helmet', t: 'Каска', v: [...LOOK_HELMET, '#3a3f47', '#2b2f35'], c: 1 },
	{ g: 'Голова', k: 'net', t: 'Сетка на каске', v: [false, true], n: ['Нет', 'Есть'] },
	{ g: 'Голова', k: 'band', t: 'Полоса на каске', v: [null, ...LOOK_BAND, HERO_BAND, FOE_BAND], c: 1 },
	{ g: 'Голова', k: 'goggles', t: 'Очки на каске', v: [false, true], n: ['Нет', 'Есть'] },
	{ g: 'Голова', k: 'glasses', t: 'Очки на лице', v: [null, 'shades', 'clear'], n: ['Нет', 'Тёмные', 'Прозрачные'] },
	{ g: 'Голова', k: 'headset', t: 'Гарнитура', v: [false, true], n: ['Нет', 'Есть'] },
	{ g: 'Тело', k: 'vest', t: 'Жилет', v: [...LOOK_VEST, '#2f3338', '#25282c'], c: 1 },
	{ g: 'Тело', k: 'rig', t: 'Разгрузка', v: [false, true], n: ['Нет', 'Есть'] },
	{ g: 'Тело', k: 'bandolier', t: 'Патронташ', v: [false, true], n: ['Нет', 'Есть'] },
	{ g: 'Тело', k: 'scarf', t: 'Шарф', v: [null, ...LOOK_SCARF, '#4a463e', '#3a4048', '#7a6f50', '#56503a'], c: 1 },
	{ g: 'Тело', k: 'sleeve', t: 'Длинный рукав', v: [false, true], n: ['Нет', 'Есть'] },
	{ g: 'Тело', k: 'glove', t: 'Перчатки', v: [null, ...LOOK_GLOVE, '#222'], c: 1 },
	{ g: 'Тело', k: 'armband', t: 'Повязка на рукаве', v: [null, FOE_BAND, '#e8e8dc', '#3d5a73', '#c9b36a', '#4d6b3a'], c: 1 },
	{ g: 'Тело', k: 'armCross', t: 'Крест на повязке', v: [false, true], n: ['Нет', 'Есть'] },
	{ g: 'Ноги', k: 'pants', t: 'Штаны', v: [...LOOK_PANTS, ...LOOK_FOE_PANTS], c: 1 },
	{ g: 'Ноги', k: 'pantsStyle', t: 'Крой штанов', v: ['plain', 'cargo', 'camo', 'patch'], n: ['Простые', 'Карманы', 'Камуфляж', 'Заплатки'] },
	{ g: 'Ноги', k: 'boots', t: 'Ботинки', v: [...LOOK_BOOTS, ...LOOK_FOE_BOOTS], c: 1 },
	{ g: 'Ноги', k: 'puttee', t: 'Обмотки', v: [null, '#8d7f5a', '#7a6f50'], c: 1 },
	{ g: 'Ноги', k: 'kneePads', t: 'Наколенники', v: [false, true], n: ['Нет', 'Есть'] },
	{ g: 'Ноги', k: 'holster', t: 'Кобура', v: [false, true], n: ['Нет', 'Есть'] },
	{ g: 'Снаряжение', k: 'pack', t: 'Рюкзак', v: ['none', 'small', 'ruck', 'radio', 'medic'], n: ['Нет', 'Малый', 'Большой', 'Рация', 'Санитарный'] },
	{ g: 'Снаряжение', k: 'packC', t: 'Цвет рюкзака', v: ['#5d6b45', '#6b5f45', '#4a4f3a', '#56503a', '#3a3d42', '#4a463e', '#34382f'], c: 1 },
	{ g: 'Снаряжение', k: 'canteen', t: 'Фляга', v: [false, true], n: ['Нет', 'Есть'] }
];
function heroLook() {
	if (heroCfg) return Object.assign({}, heroCfg);		// облик из меню «Персонаж»
	const L = makeLook('rifle', lkDeal());
  L.role = 'hero';
  L.pants = lkPick(LOOK_PANTS);
  L.band = HERO_BAND;
  L.armband = null; L.armCross = false;
  return L;
}
const lkFoeDeal = lkDeal();
function foeLook() { return makeLook('foe', lkFoeDeal); }

// цвет кисти: перчатка или кожа бойца (для рук с оружием, магазином и гранатой)
function handColor(dark) {
  const L = hero.look;
  if (!L) return dark ? COLORS.skinDark : COLORS.skin;
  return L.glove || (dark ? L.skin[1] : L.skin[0]);
}

// ===== Отрисовка =====
const LK_UP = { 'pelvis-chest': 1, 'chest-neck': 1, 'neck-head': 1 };   // сегменты, идущие «вверх» по телу
// локальная система сегмента: x — вдоль a→b (от -полудлины до +полудлины), y — в сторону взгляда
function lkFrame(a, b, fn) {
  const h = hero, A = h.p[a], B = h.p[b];
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, s = (LK_UP[a + '-' + b] ? 1 : -1) * h.f;
  ctx.save();
  ctx.transform(ux, uy, -uy * s, ux * s, (A.x + B.x) / 2, (A.y + B.y) / 2);
  fn(len / 2);
  ctx.restore();
}
const lkInk = '#15150f';
function lkRect(x, y, w, h, fill, r) {
  ctx.beginPath();
  if (r && ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1.3; ctx.strokeStyle = lkInk; ctx.stroke();
}
function lkCross(x, y, s) {
  ctx.fillStyle = '#e8e8dc'; ctx.fillRect(x - s, y - s, s * 2, s * 2);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(x - s * 0.22, y - s * 0.75, s * 0.44, s * 1.5);
  ctx.fillRect(x - s * 0.75, y - s * 0.22, s * 1.5, s * 0.44);
}

// рюкзак за спиной: рисуется до тела, чтобы оказаться позади рук и ног
function drawBackpack() {
  const L = hero.look;
  if (!L || L.pack === 'none') return;
  lkFrame('pelvis', 'chest', hl => {                 // y < 0 — спина
    const c = L.packC;
    if (L.pack === 'ruck') {
      lkRect(-15, -29, 40, 18, c, 5);
      lkRect(21, -31, 7, 22, shadeColor('#8d7f5a', -0.1), 3);      // скатка сверху
      ctx.strokeStyle = 'rgba(255,255,230,0.2)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(14, -27); ctx.lineTo(14, -13); ctx.stroke();
    } else if (L.pack === 'small') {
      lkRect(-6, -23, 24, 13, c, 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(10, -22); ctx.lineTo(10, -11); ctx.stroke();
    } else if (L.pack === 'radio') {
      lkRect(-6, -25, 20, 15, '#34362e', 2);
      lkRect(-2, -22, 8, 5, '#6b6a45', 1);
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2;                // антенна
      ctx.beginPath(); ctx.moveTo(10, -24); ctx.lineTo(hl + 26, -30); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hl + 26, -30, 1.6, 0, Math.PI * 2); ctx.fill();
    } else if (L.pack === 'medic') {
      lkRect(-12, -27, 32, 17, c, 5);
      lkCross(4, -18, 4.2);
    }
  });
}

function lkFaceN(ang) {                              // нормаль к оси шея → голова, в сторону взгляда (как в drawFace)
  let nx = -Math.sin(ang), ny = Math.cos(ang);
  if (nx * hero.f * 2 - ny * 0.3 < 0) { nx = -nx; ny = -ny; }
  return [nx, ny];
}
// локальная система головы: x — к макушке, y — к лицу
function lkHeadFrame(cx, cy, ang, fn) {
  const [nx, ny] = lkFaceN(ang);
  ctx.save();
  ctx.transform(Math.cos(ang), Math.sin(ang), nx, ny, cx, cy);
  fn();
  ctx.restore();
}
// борода, очки и волосы: поверх лица, под каской
function drawHeadLook(cx, cy, rx, ry, ang) {
  const L = hero.look;
  if (!L) return;
  const noHelmet = Health.state.helmet <= 0;
  lkHeadFrame(cx, cy, ang, () => {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    if (noHelmet) {
      ctx.fillStyle = L.hair;
      ctx.fillRect(rx * 0.1, -ry - 2, rx, ry + 2);
      ctx.fillRect(rx * 0.55, 0, rx * 0.5, ry * 0.7);
      ctx.fillStyle = 'rgba(255,255,230,0.18)';
      ctx.fillRect(rx * 0.55, -ry - 2, 2, ry * 1.4);
    } else {                                         // из-под каски выглядывают волосы на затылке
      ctx.fillStyle = L.hair;
      ctx.fillRect(-3, -ry - 2, 8, ry * 0.75);
    }
    if (L.mask) {                                    // балаклава закрывает нижнюю часть лица
      ctx.fillStyle = L.mask;
      ctx.fillRect(-rx - 1, -ry - 2, rx - 0.5, ry * 2 + 4);
    }
    if (L.beard) {
      ctx.fillStyle = L.beard === 1 ? 'rgba(30,22,14,0.45)' : L.hair;
      ctx.beginPath();
      ctx.ellipse(-rx * 0.5, ry * 0.45, rx * (L.beard === 1 ? 0.5 : 0.58), ry * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
		if (L.paint) {										// боевой раскрас: две полосы на щеке
			ctx.strokeStyle = L.paint; ctx.lineWidth = 2.2; ctx.lineCap = 'butt';
			for (let i = 0; i < 2; i++) {
				ctx.beginPath();
				ctx.moveTo(-rx * 0.35, ry * 0.72 + i * 3.4); ctx.lineTo(rx * 0.35, ry * 0.72 + i * 3.4);
				ctx.stroke();
			}
		}
		if (L.scar) {											// шрам через щеку
			ctx.strokeStyle = '#a85a48'; ctx.lineWidth = 1.2;
			ctx.beginPath(); ctx.moveTo(-rx * 0.1, ry * 0.5); ctx.lineTo(rx * 0.35, ry * 0.95); ctx.stroke();
			ctx.strokeStyle = 'rgba(40,10,5,0.5)'; ctx.lineWidth = 0.8;
			for (const t of [0.3, 0.55, 0.8]) {
				const sx = lerp(-rx * 0.1, rx * 0.35, t), sy = lerp(ry * 0.5, ry * 0.95, t);
				ctx.beginPath(); ctx.moveTo(sx - 1.4, sy + 1.4); ctx.lineTo(sx + 1.4, sy - 1.4); ctx.stroke();
			}
		}
    ctx.restore();
    if (L.glasses) {                                 // очки на уровне глаза (глаз в drawFace: y = 0.55·ry, x = 0.1·rx)
      const ex = rx * 0.1 + 0.4, ey = ry * 0.55;
      ctx.strokeStyle = lkInk; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ex, ey - 3); ctx.lineTo(ex - 0.5, -ry * 0.25); ctx.stroke();   // дужка
      ctx.beginPath(); ctx.arc(ex, ey, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = L.glasses === 'shades' ? '#1a1a18' : 'rgba(170,205,225,0.3)';
      ctx.fill(); ctx.stroke();
    }
  });
}
// полоса и очки на каске
function drawHelmetLook(cx, cy, rx, ry, ang) {
  const L = hero.look;
  if (!L || !(L.band || L.goggles || L.net || L.headset)) return;
  lkHeadFrame(cx, cy, ang, () => {
		if (L.net) {											// маскировочная сетка с листвой
			ctx.save();
			ctx.beginPath(); ctx.ellipse(0, 0, rx + 1.5, ry + 1.5, 0, 0, Math.PI * 2); ctx.clip();
			for (let i = 0; i < L.camo.length; i++) {
				const c = L.camo[i];
				ctx.beginPath();
				ctx.ellipse(c[0] * rx, c[1] * ry, c[2] * rx * 0.7 + 1.5, c[3] * ry * 0.6 + 1.5, c[4], 0, Math.PI * 2);
				ctx.fillStyle = i % 2 ? 'rgba(38,52,26,0.85)' : 'rgba(112,128,70,0.85)';
				ctx.fill();
			}
			ctx.restore();
		}
		if (L.headset) {										// наушник и микрофон у рта
			ctx.strokeStyle = '#1f1f1c'; ctx.lineWidth = 1.4;
			ctx.beginPath(); ctx.moveTo(-1, ry * 0.2); ctx.quadraticCurveTo(-rx * 0.2, ry * 1.1, rx * 0.15, ry * 1.0); ctx.stroke();
			ctx.fillStyle = '#1f1f1c';
			ctx.beginPath(); ctx.arc(rx * 0.15, ry * 1.0, 1.6, 0, Math.PI * 2); ctx.fill();
			ctx.beginPath(); ctx.ellipse(-1, -ry * 0.15, 3.6, 4.4, 0, 0, Math.PI * 2);
			ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = lkInk; ctx.stroke();
		}
    if (L.band) {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, 0, rx + 1.5, ry + 1.5, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = L.band;
      ctx.fillRect(rx * 0.42, -ry - 3, 3.4, ry * 2 + 6);
      ctx.restore();
    }
    if (L.goggles) {
      ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(rx * 0.5, -ry * 0.9); ctx.lineTo(rx * 0.5, ry * 0.55); ctx.stroke();   // ремешок
      ctx.beginPath(); ctx.ellipse(rx * 0.5, ry * 0.55, 3, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(150,205,225,0.65)'; ctx.fill();
      ctx.lineWidth = 1.3; ctx.strokeStyle = lkInk; ctx.stroke();
    }
  });
}

// аксессуары, привязанные к сегменту тела s (вызывается сразу после его отрисовки)
function drawLookSeg(s) {
  const L = hero.look;
  if (!L) return;
  const k = s.a + '-' + s.b;
  if (k === 'pelvis-chest') lkTorso(L, s);
  else if (k === 'chest-neck') lkScarf(L);
  else if (k === 'pelvis-kneeB' || k === 'pelvis-kneeF') lkThigh(L, s, k);
  else if (k === 'kneeB-ankleB' || k === 'kneeF-ankleF') lkShin(L, s, k);
  else if (k === 'chest-elbowB' || k === 'chest-elbowF') lkSleeve(L, s, k);
  else if (k === 'elbowB-wristB' || k === 'elbowF-wristF') lkGlove(L, s);
}
function lkTorso(L, s) {
  lkFrame(s.a, s.b, hl => {
    if (L.rig) {                                     // нагрудник с подсумками
      for (const x of [-7, 4, 15]) {
        lkRect(x - 4, 5, 8, 7, L.rigC, 1.5);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 4, 8); ctx.lineTo(x + 4, 8); ctx.stroke();
      }
    }
    if (L.bandolier) {                               // патронташ крест-накрест
      ctx.strokeStyle = '#3a3322'; ctx.lineWidth = 3.2; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(hl * 0.65, -s.ry * 0.5); ctx.lineTo(-hl * 0.55, s.ry * 0.6); ctx.stroke();
      ctx.fillStyle = '#b8a14e';
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        ctx.beginPath(); ctx.arc(lerp(hl * 0.55, -hl * 0.45, t), lerp(-s.ry * 0.4, s.ry * 0.5, t), 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (L.canteen) {                                 // фляга на бедре, со стороны спины
      ctx.beginPath(); ctx.ellipse(-hl + 8, -s.ry * 0.7, 4.3, 6, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = '#6b6a45'; ctx.fill();
      ctx.lineWidth = 1.3; ctx.strokeStyle = lkInk; ctx.stroke();
      ctx.fillStyle = '#222'; ctx.fillRect(-hl + 5.8, -s.ry * 0.7 + 4.6, 4.4, 2.4);
    }
  });
}
function lkScarf(L) {
  if (!L.scarf) return;
  const P = hero.p;
  const pt = t => ({ x: lerp(P.chest.x, P.neck.x, t), y: lerp(P.chest.y, P.neck.y, t) });
  drawOval(pt(0.1), pt(1), 7, 3.5, L.scarf);        // шарф вокруг шеи
  const sway = Math.sin((hero.phase || 0) * 2) * 2 * Math.min(1, Math.abs(hero.walk || 0));
  lkFrame('chest', 'neck', () => {                   // хвост шарфа за спиной
    ctx.beginPath();
    ctx.moveTo(2, -5); ctx.quadraticCurveTo(-8, -10 - sway, -17, -9 - sway * 2);
    ctx.lineTo(-17, -4 - sway * 2); ctx.quadraticCurveTo(-8, -5, 1, -1); ctx.closePath();
    ctx.fillStyle = L.scarf; ctx.fill();
    ctx.lineWidth = 1.3; ctx.strokeStyle = lkInk; ctx.stroke();
  });
}
function lkCamo(L, s, hl, shift) {                   // пятна камуфляжа внутри овала сегмента
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, hl + s.ext, s.ry, 0, 0, Math.PI * 2); ctx.clip();
  for (let i = 0; i < L.camo.length; i++) {
    const c = L.camo[(i + shift) % L.camo.length];
    ctx.beginPath();
    ctx.ellipse(c[0] * hl, c[1] * s.ry, c[2] * hl + 2, c[3] * s.ry, c[4], 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? shadeColor(s.c, -0.38) : shadeColor(s.c, 0.2);
    ctx.fill();
  }
  ctx.restore();
}
function lkThigh(L, s, k) {
  const st = L.pantsStyle;
	if (L.holster && k === 'pelvis-kneeF') {				// кобура с пистолетом на ближней ноге
		lkFrame(s.a, s.b, hl => {
			lkRect(hl * 0.1, -4.5, 10, 9, '#2b2a24', 2);
			lkRect(hl * 0.1 + 1.5, -2, 4, 5, '#46453b', 1);
		});
	}
  if (st === 'plain') return;
  lkFrame(s.a, s.b, hl => {
    if (st === 'camo') lkCamo(L, s, hl, k === 'pelvis-kneeB' ? 3 : 0);
    else if (st === 'cargo') {                       // накладной карман
      lkRect(-hl * 0.45, -4, 12, 8, shadeColor(s.c, -0.16), 1);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-hl * 0.45 + 4, -4); ctx.lineTo(-hl * 0.45 + 4, 4); ctx.stroke();
    } else if (st === 'patch') {                     // заплатка на колене
      lkRect(hl - 15, -4, 10, 8, shadeColor(s.c, 0.22), 1);
      ctx.setLineDash([2, 2]); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.9;
      ctx.strokeRect(hl - 14, -3, 8, 6); ctx.setLineDash([]);
    }
  });
}
function lkShin(L, s, k) {
  lkFrame(s.a, s.b, hl => {
    if (L.pantsStyle === 'camo') lkCamo(L, s, hl, k === 'kneeB-ankleB' ? 5 : 2);
    if (L.puttee) {                                  // обмотка над ботинком
      ctx.fillStyle = L.puttee;
      ctx.fillRect(hl - 11, -s.ry - 1, 9, s.ry * 2 + 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hl - 8, -s.ry - 1); ctx.lineTo(hl - 8, s.ry + 1);
      ctx.moveTo(hl - 5, -s.ry - 1); ctx.lineTo(hl - 5, s.ry + 1); ctx.stroke();
    }
    if (L.kneePads) {                                // наколенник на передней стороне колена
      ctx.beginPath(); ctx.ellipse(-hl + 3, s.ry * 0.55, 5.4, 4.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#2c2c27'; ctx.fill();
      ctx.lineWidth = 1.3; ctx.strokeStyle = lkInk; ctx.stroke();
    }
  });
}
function lkSleeve(L, s) {
  if (!L.armband) return;
  lkFrame(s.a, s.b, () => {                          // повязка на плече
    ctx.fillStyle = L.armband;
    ctx.fillRect(-3, -s.ry - 1.5, 6, s.ry * 2 + 3);
    ctx.lineWidth = 1; ctx.strokeStyle = lkInk;
    ctx.strokeRect(-3, -s.ry - 1.5, 6, s.ry * 2 + 3);
    if (L.armCross) {
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(-0.8, -3.2, 1.6, 6.4); ctx.fillRect(-3, -0.8, 6, 1.6);
    }
  });
}
function lkGlove(L, s) {
  if (!L.glove) return;
  const A = hero.p[s.a], B = hero.p[s.b];
  drawOval({ x: lerp(A.x, B.x, 0.55), y: lerp(A.y, B.y, 0.55) }, B, s.ry + 0.5, 3.5, L.glove);
}
