'use strict';

// ===== Система здоровья солдата =====
const ARMOR_MAX = 80;   // прочность бронежилета
const CONCUSS_KO = 0.7; // контузия от 70% и выше — боец без сознания и не может встать
const PAIN_SHOCK = 0.8; // боль выше 80% — болевой шок: боец без сознания, пока боль не спадёт
const TOTAL_BLOOD_L = 5;    // 100% крови = 5 литров (только для показа игроку)
const BLOOD_STEP_L = 0.5;   // показываем примерно, с шагом 500 мл
const LAST_STAND_L = 1.5;   // ниже этого остатка крови у игрока включается «шанс на выживание»
const LAST_STAND_MUL = 0.75;   // и кровь вытекает на 25% медленнее
const LAST_STAND_BLOOD = LAST_STAND_L / TOTAL_BLOOD_L * 100;   // то же в процентах (1,5 л = 30%)
const WAKE_GRACE = 600; // кадров (10 с): очнувшийся через силу не отключается снова от контузии / шока
const TORSO_STAND_MIN = 15; // торс разрушен (0%) — встать нельзя, пока он не восстановится хотя бы до 15%
const LEGS_WALK_MIN = 10;   // ноги в 0% — одна нога волочится, пока ноги не восстановятся хотя бы до 10%
const makeHealth = (isPlayer) => {
  // какой части тела принадлежит сустав
  const PART_OF = {
    head: 'head', neck: 'head', chest: 'torso', pelvis: 'torso',
    elbow: 'arms', wrist: 'arms', knee: 'legs', ankle: 'legs', toe: 'legs'
  };

  const REGEN = 0.03; // восстановление части тела без раны (hp за кадр: 0.03 → ~1,8 hp/с, с нуля до 100 примерно за 55 с)
  const HELMET_MAX = 70;   // прочность каски
  const state = {};
  let t = 0;           // счётчик кадров для эффектов
  let audio = null;

  function reset() {
    Object.assign(state, {
      parts: { head: 100, torso: 100, arms: 100, legs: 100 }, // здоровье частей тела
      helmet: HELMET_MAX, // прочность каски, 0 = каски нет
      armor: ARMOR_MAX,   // прочность бронежилета, 0 = жилета нет
      blocked: false,     // последнее попадание полностью погасила каска / бронежилет
      blockedPart: null,  // чем погашено: 'head' (каска) или 'torso' (бронежилет)
      blood: 100,        // кровь, 0 = смерть
      bleed: 0,          // кровотечение (потеря крови в секунду)
      pain: 0,           // боль 0..1
      concussion: 0,     // контузия 0..1
      ko: 0,             // кадров без сознания
      shock: false,      // болевой шок (боль выше PAIN_SHOCK)
      groggy: 0,         // кадров «очнулся через силу»: на ногах, но очень конфужен
      broken: false,     // торс разрушен: в сознании, но подняться не может
      lame: false,       // ноги в 0%: волочит одну ногу
      dragLeg: 'B',      // какую ногу волочит ('B' или 'F')
      dead: false,
      death: null,        // причина смерти: { cause: 'head' | 'blood', src, how, dist, by, part, ... } (см. kill)
      lastHit: null,      // последнее попадание: { src, how, dist, by, part }
      bleedFrom: null,    // последнее попадание, от которого пошла кровь
      wound: { head: false, torso: false, arms: false, legs: false } // части с открытой раной (нужна перевязка)
    });
  }
  reset();

  // запоминаем, чем и куда попали (info: { src, how: 'bullet' | 'frag' | 'blast', dist, by })
  function note(part, info, bleeding) {
    if (!info) return;
    state.lastHit = { src: info.src, how: info.how, dist: info.dist || 0, by: info.by, part };
    if (bleeding) state.bleedFrom = state.lastHit;
  }
  // смерть: 'head' — голова разрушена, 'blood' — кровопотеря; сохраняем снимок для экрана гибели
  function kill(cause) {
    if (state.dead) return;
    state.dead = true;
    const h = (cause === 'blood' && state.bleedFrom) || state.lastHit || {};
    state.death = {
      cause, src: h.src || null, how: h.how || null, dist: h.dist || 0, by: h.by || null,
      part: cause === 'head' ? 'head' : (h.part || null),
      helmet: state.helmet, armor: state.armor, wound: Object.assign({}, state.wound),
      pain: state.pain, concussion: state.concussion
    };
  }

  // hits: { имя_сустава: сила_попадания 0..1 }
  function onBlast(hits, info) {
    if (state.dead) return;

    const worst = { head: 0, torso: 0, arms: 0, legs: 0 };
    for (const n in hits) {
      const part = PART_OF[n.replace(/[BF]$/, '')];
      worst[part] = Math.max(worst[part], hits[n]);
    }

    for (const part in worst) {
      const k = worst[part];
      if (k <= 0) continue;
      let dmg = k * k * 60;                                    // чем ближе, тем намного больнее
      if (part === 'head') {                                   // каска гасит часть волны, а сильный взрыв срывает её
        dmg = soakHelmet(dmg * 0.7) + dmg * 0.3;
        if (k > 0.7) state.helmet = 0;
      }
      if (part === 'torso') {                                  // бронежилет: то же самое для торса
        dmg = soakArmor(dmg * 0.7) + dmg * 0.3;
        if (k > 0.85) state.armor = 0;
      }
      state.parts[part] = Math.max(0, state.parts[part] - dmg);
      state.pain = Math.min(1, state.pain + dmg / 100);
      if (dmg >= 2) state.wound[part] = true;
      if (k > 0.5) state.bleed += k * 0.8;
    }

    const bp = Object.keys(worst).reduce((a, b) => worst[b] > worst[a] ? b : a);
    if (worst[bp] > 0) note(bp, info, worst[bp] > 0.5);

    // контузия: голова важнее всего, но близкий взрыв контузит и без прямого попадания по голове
    const overall = Math.max(worst.head, worst.torso, worst.arms, worst.legs);
    const c = Math.max(worst.head, overall * 0.8);
    if (c > 0.15) {
      state.concussion = Math.min(1, state.concussion + c * 1.1);
      ring(state.concussion);
    }
    if (c > 0.75) state.ko = Math.max(state.ko, Math.round(120 + c * 240)); // потеря сознания

    if (state.parts.head <= 0) kill('head');   // торс на 0% не убивает, а лишает возможности встать (см. state.broken)
  }

  // каска поглощает урон, пока не разрушится; в голову проходит ≈20% поглощённого + весь остаток
  function soakHelmet(dmg) {
    if (state.helmet <= 0) return dmg;
    const soak = Math.min(state.helmet, dmg);
    state.helmet -= soak;
    return soak * 0.2 + (dmg - soak);
  }

  // бронежилет поглощает урон по торсу так же, как каска по голове
  function soakArmor(dmg) {
    if (state.armor <= 0) return dmg;
    const soak = Math.min(state.armor, dmg);
    state.armor -= soak;
    return soak * 0.2 + (dmg - soak);
  }

  // попадание осколка / пули в сустав name
  function onShrapnel(name, mul = 1, info) {
    if (state.dead) return;
    const part = PART_OF[name.replace(/[BF]$/, '')];
    let dmg = (part === 'head' ? 18 : part === 'torso' ? 10 : 6) * mul;
    state.blocked = false;                         // true — каска / жилет выдержали удар целиком (раны нет)
    state.blockedPart = part;
    if (part === 'head' && state.helmet > 0) {
      state.blocked = state.helmet >= dmg;
      dmg = soakHelmet(dmg);
    } else if (part === 'torso' && state.armor > 0) {
      state.blocked = state.armor >= dmg;
      dmg = soakArmor(dmg);
    }
    state.parts[part] = Math.max(0, state.parts[part] - dmg);
    state.pain = Math.min(1, state.pain + dmg / 100);
    if (!state.blocked) {
      state.bleed += dmg / 25;
      state.wound[part] = true;
    }
    note(part, info, !state.blocked);
    if (part === 'head') state.concussion = Math.min(1, state.concussion + (state.blocked ? 0.08 : 0.15));
    if (state.parts.head <= 0) kill('head');   // торс на 0% не убивает, а лишает возможности встать (см. state.broken)
  }

  // добавить крови (переливание)
  function transfuse(d) {
    if (state.dead) return;
    state.blood = Math.min(100, state.blood + d);
  }

  // самая раненая часть тела из ещё не перевязанных (или null)
  function woundedPart() {
    if (state.dead) return null;
    let best = null;
    for (const p in state.wound) {
      if (state.wound[p] && (best === null || state.parts[p] < state.parts[best])) best = p;
    }
    return best;
  }

  // один кадр перевязки части part
  // k — скорость бинтования (1 — обычная; боль замедляет, медик ускоряет)
  function bandage(part, k = 1) {
    state.bleed *= Math.pow(0.985, k);    // кровотечение быстро затихает
    if (state.bleed < 0.03) state.bleed = 0;
    state.pain *= Math.pow(0.99867, k);   // боль проходит в 3 раза медленнее
    state.parts[part] = Math.min(100, state.parts[part] + 0.03 * k);
  }

  // медик понемногу выводит из контузии (ускоряет её естественный спад ≈ в 2,3 раза)
  function calm() {
    if (state.dead) return;
    state.concussion = Math.max(0, state.concussion - 1 / (60 * 60));
  }

  // один кадр отдыха на койке: кровь и раны восстанавливаются заметно быстрее перевязки
  function rest() {
    if (state.dead) return;
    state.blood = Math.min(100, state.blood + 0.05);                    // ≈3 крови в секунду
    state.bleed *= 0.99;
    if (state.bleed < 0.03) state.bleed = 0;
    state.pain *= 0.99665;                // боль проходит в 3 раза медленнее
    state.concussion = Math.max(0, state.concussion - 1 / (60 * 80));   // контузия проходит вдвое быстрее
    for (const part in state.parts) {
      if (state.parts[part] < 100) state.parts[part] = Math.min(100, state.parts[part] + 0.08);   // ≈4,8 hp/с против 1,8 без раны
      if (state.wound[part] && state.bleed === 0 && state.parts[part] >= 80) state.wound[part] = false;   // рана затягивается
    }
  }

  // один шаг (60 раз в секунду)
  function update() {
    t++;
    if (state.dead) return;
    const lastStand = isPlayer && state.blood < LAST_STAND_BLOOD;     // меньше 1,5 л: организм держится, кровь уходит медленнее
    state.blood -= state.bleed / 60 * (lastStand ? LAST_STAND_MUL : 1);
    state.bleed *= 0.9995;                                    // кровь понемногу сворачивается
    state.pain *= 0.99933;                       // боль проходит в 3 раза медленнее
    for (const part in state.parts) {            // часть тела без открытой раны (перевязана) понемногу восстанавливается
      if (!state.wound[part] && state.parts[part] < 100) state.parts[part] = Math.min(100, state.parts[part] + REGEN);
    }
    state.concussion = Math.max(0, state.concussion - 1 / (60 * 80)); // полная контузия ~80 сек
    if (state.ko > 0) state.ko--;
    if (state.groggy > 0) state.groggy--;                                   // очнулся через силу: пока идёт, контузия и шок не вырубают снова
    if (state.concussion >= CONCUSS_KO && state.groggy === 0) state.ko = Math.max(state.ko, 2);   // контузия 70–100% — без сознания, встать нельзя
    if (state.parts.torso <= 0) state.broken = true;                          // торс разрушен — не встать
    else if (state.parts.torso >= TORSO_STAND_MIN) state.broken = false;
    if (state.parts.legs <= 0) {                                              // ноги в 0% — одну ногу волочит
      if (!state.lame) state.dragLeg = Math.random() < 0.5 ? 'B' : 'F';
      state.lame = true;
    } else if (state.parts.legs >= LEGS_WALK_MIN) state.lame = false;
    state.shock = state.pain > PAIN_SHOCK;
    if (state.shock && state.groggy === 0) state.ko = Math.max(state.ko, 2);                      // болевой шок — без сознания, пока боль не спадёт
    if (state.blood < 30 && state.ko === 0 && Math.random() < 0.0005) state.ko = 180; // обморок
    if (state.blood <= 0) kill('blood');
  }

  const conscious = () => !state.dead && state.ko === 0;
  const canRise = () => !state.broken;     // торс не разрушен — можно подняться
  // очнуться через силу (частыми нажатиями A/D): встаёт, но очень конфузно
  function wake() {
    if (state.dead) return;
    state.ko = 0;
    state.groggy = WAKE_GRACE;
  }
  // «конфуженность»: контузия, а после пробуждения через силу — не меньше 0,75 (затухает за последние 2 с)
  function confusion() {
    const g = state.groggy > 0 ? 0.75 * Math.min(1, state.groggy / 120) : 0;
    return Math.max(state.concussion, g);
  }
  // нужен ли комплект брони: жилет или каска разрушены / изношены ниже 50%
  const needsArmor = () => !state.dead && (state.armor < ARMOR_MAX * 0.5 || state.helmet < HELMET_MAX * 0.5);
  // надеть комплект со станции: полный жилет и полная каска
  function rearm() {
    state.armor = ARMOR_MAX;
    state.helmet = HELMET_MAX;
  }
  // множитель скорости падения/вставания от здоровья ног: 0.5 (в хлам) .. 1.5 (полностью здоровы)
  function legSpeed() {
    return 0.75 + state.parts.legs / 100;
  }
  // множитель скорости ходьбы
  function speedMul() {
    const legs = state.lame ? 0.12 : 0.4 + 0.6 * state.parts.legs / 100;   // ноги в 0% — еле-еле
    return legs * (1 - confusion() * 0.5) * (1 - state.pain * 0.2);
  }

  // качка корпуса: смещение в px (положительное — вправо), медленная и неровная
  function sway() {
    const c = confusion();
    if (c <= 0.02) return 0;
    return c * (Math.sin(t * 0.045) + 0.6 * Math.sin(t * 0.017 + 1));
  }

  // независимое "виляние" отдельных частей тела (seed разный для каждой), -c..c
  function wobble(seed) {
    return confusion() * Math.sin(t * 0.08 + seed * 2.1) + tremor(seed);
  }

  // дрожь от боли: быстрая мелкая тряска, начинается с 25% боли и растёт до максимума
  function tremor(seed) {
    const k = (state.pain - 0.25) / 0.75;
    if (k <= 0) return 0;
    return k * 0.6 * (Math.sin(t * 0.6 + seed * 2.3) + 0.5 * Math.sin(t * 1.3 + seed * 5.1));
  }

  // общий аудиоконтекст (создаётся по первому звуку)
  function ac() {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }

  // звон в ушах: два слегка расстроенных тона, плавное нарастание, долгий спад, тон медленно «оседает»
  function ring(c) {
    if (!isPlayer) return;           // звон слышит только игрок
    try {
      const a = ac(), now = a.currentTime, len = 3 + c * 8;
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.03 * c, now + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, now + len);
      g.connect(a.destination);
      for (const f of [3800, 4130]) {
        const o = a.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, now);
        o.frequency.linearRampToValueAtTime(f * 0.985, now + len);
        o.connect(g);
        o.start(now); o.stop(now + len);
      }
    } catch (e) { /* звук необязателен */ }
  }

  // удар сердца: низкий «бум» (слышен в шоке, при обмороке и сильной кровопотере)
  function thump(v) {
    if (!isPlayer) return;
    try {
      const a = ac(), now = a.currentTime;
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(70, now);
      o.frequency.exponentialRampToValueAtTime(38, now + 0.18);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.18 * v, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      o.connect(g); g.connect(a.destination);
      o.start(now); o.stop(now + 0.25);
    } catch (e) { /* звук необязателен */ }
  }

  // экранные эффекты и индикаторы (вызывать в конце render)
    // индикаторы и надписи лежат в обычных HTML-элементах: размытие холста их не трогает (стили — в style.css)
  let hud = null;
  const PIPS = 8;                                       // сегментов у каски и брони
  // кровь на глаз: примерное количество литров с шагом 500 мл
  function bloodText(S) {
    if (S.dead) return '0 л';
    const r = Math.round(Math.max(0, S.blood) / 100 * TOTAL_BLOOD_L / BLOOD_STEP_L) * BLOOD_STEP_L;
    if (r <= 0) return '< 0,5 л';
    return '≈ ' + String(r).replace('.', ',') + ' л';
  }
  // состояние словами вместо полосок: самое тяжёлое — первым, не больше 6 ярлыков
  function describe(S) {
    if (S.dead) return [['ПОГИБ', 'bad']];
    const o = [];                                                       // [текст, класс, важность]
    const add = (t, c, w) => o.push([t, c, w]);
    if (S.ko > 0) add(S.shock ? 'БОЛЕВОЙ ШОК' : 'БЕЗ СОЗНАНИЯ', 'bad', 100);
    else if (S.shock) add('БОЛЕВОЙ ШОК', 'warn', 90);                   // очнулся через силу, но боль всё ещё выше порога
    // кровопотеря
    if (S.blood < 30) add('КРИТИЧЕСКАЯ КРОВОПОТЕРЯ', 'bad', 95);
    else if (S.blood < 50) add('ТЯЖЁЛАЯ КРОВОПОТЕРЯ', 'bad', 80);
    else if (S.blood < 70) add('КРОВОПОТЕРЯ', 'warn', 60);
    else if (S.blood < 92.5) add('ЛЁГКАЯ КРОВОПОТЕРЯ', 'info', 30);
    // кровотечение (S.bleed — % крови в секунду)
    if (S.bleed > 1) add('ХЛЕЩЕТ КРОВЬ', 'bad', 92);
    else if (S.bleed > 0.5) add('СИЛЬНОЕ КРОВОТЕЧЕНИЕ', 'bad', 85);
    else if (S.bleed > 0.15) add('КРОВОТЕЧЕНИЕ', 'bad', 70);
    else if (S.bleed > 0.03) add('СОЧИТСЯ КРОВЬ', 'warn', 50);
    // раны по частям тела
    const wp = ['head', 'torso', 'arms', 'legs'].filter(p => S.wound[p]);
    const one = { head: 'РАНА ГОЛОВЫ', torso: 'РАНА ТОРСА', arms: 'РАНА РУКИ', legs: 'РАНА НОГИ' };
    const many = { head: 'ГОЛОВА', torso: 'ТОРС', arms: 'РУКИ', legs: 'НОГИ' };
    if (wp.length === 1) add(one[wp[0]], 'warn', 65);
    else if (wp.length === 2) add('РАНЫ: ' + wp.map(p => many[p]).join(', '), 'warn', 66);
    else if (wp.length > 2) add('МНОЖЕСТВЕННЫЕ РАНЫ', 'bad', 75);
    if (S.broken) add('ТОРС РАЗРУШЕН', 'bad', 88);
    if (S.lame) add('ХРОМОТА', 'warn', 55);
    // боль (с PAIN_SHOCK — болевой шок, он выше)
    if (!S.shock) {
      if (S.pain > 0.65) add('НЕВЫНОСИМАЯ БОЛЬ', 'bad', 78);
      else if (S.pain > 0.5) add('СИЛЬНАЯ БОЛЬ', 'warn', 58);
      else if (S.pain > 0.25) add('БОЛЬ, ДРОЖЬ В РУКАХ', 'info', 40);
      else if (S.pain > 0.1) add('ЛЁГКАЯ БОЛЬ', 'info', 20);
    }
    // контузия (с CONCUSS_KO — без сознания)
    if (S.concussion >= CONCUSS_KO) add('ТЯЖЁЛАЯ КОНТУЗИЯ', 'bad', 94);
    else if (S.concussion > 0.55) add('СИЛЬНАЯ КОНТУЗИЯ', 'bad', 72);
    else if (S.concussion > 0.4) add('КОНТУЗИЯ', 'warn', 52);
    else if (S.concussion > 0.15) add('ЛЁГКАЯ КОНТУЗИЯ', 'info', 35);
    else if (S.concussion > 0.05) add('ЗВОН В УШАХ', 'info', 15);
    if (S.groggy > 0) add('ОГЛУШЁН ' + Math.ceil(S.groggy / 60) + ' с', 'info', 45);
    if (!o.length) return [['В НОРМЕ', 'ok']];
    return o.sort((a, b) => b[2] - a[2]).slice(0, 6).map(([t, c]) => [t, c]);
  }
  const partColor = v => 'hsl(' + Math.round(Math.max(0, Math.min(100, v)) * 0.95) + ',55%,' + Math.round(34 + v * 0.1) + '%)';   // 0 — красный, 100 — зелёный

  function buildHud() {
    const root = document.createElement('div');
    root.id = 'status';
    const pips = k => '<span class="pips" data-pips="' + k + '">' + '<i></i>'.repeat(PIPS) + '</span>';
    root.innerHTML =
      '<svg viewBox="0 0 60 120">' +
        '<circle class="part" data-part="head" cx="30" cy="13" r="10"/>' +
        '<rect class="part" data-part="torso" x="17" y="26" width="26" height="42" rx="7"/>' +
        '<rect class="part" data-part="arms" x="6" y="28" width="9" height="38" rx="4.5"/>' +
        '<rect class="part" data-part="arms" x="45" y="28" width="9" height="38" rx="4.5"/>' +
        '<rect class="part" data-part="legs" x="18" y="70" width="11" height="46" rx="5"/>' +
        '<rect class="part" data-part="legs" x="31" y="70" width="11" height="46" rx="5"/>' +
        '<path class="gear helm" d="M19.5 13 A10.5 10.5 0 0 1 40.5 13 Z"/>' +
        '<rect class="gear vest" x="20" y="30" width="20" height="22" rx="4"/>' +
      '</svg>' +
      '<div class="st-col">' +
        '<div class="hd-cap">Боец</div>' +
        '<div class="st-row"><span>Кровь</span><b data-val="blood">≈ 5 л</b></div>' +
        '<div class="bar big"><i data-bar="blood"></i></div>' +
        '<div class="st-row"><span>Каска</span>' + pips('helm') + '</div>' +
        '<div class="st-row"><span>Броня</span>' + pips('armor') + '</div>' +
        '<div class="chips"></div>' +
      '</div>';
    const msg = document.createElement('div');
    msg.className = 'st-msg';
    msg.innerHTML = '<div class="sm-t"></div><div class="sm-bar"><i></i></div>';
    document.body.appendChild(root);
    document.body.appendChild(msg);
    const q = s => [...root.querySelectorAll(s)];
    hud = {
      root, msg, msgT: msg.firstChild, msgBarWrap: msg.lastChild, msgBar: msg.querySelector('i'), chipKey: '',
      parts: { head: q('[data-part="head"]'), torso: q('[data-part="torso"]'), arms: q('[data-part="arms"]'), legs: q('[data-part="legs"]') },
      bars: { blood: q('[data-bar="blood"]')[0] },
      val: q('[data-val="blood"]')[0],
      pips: { helm: q('[data-pips="helm"] i'), armor: q('[data-pips="armor"] i') },
      helm: q('.gear.helm')[0], vest: q('.gear.vest')[0],
      chips: q('.chips')[0]
    };
  }
  function updateHud() {
    const S = state, h = hero;                          // hero — боец, которого сейчас рисуем (игрок)
    const bleeding = !S.dead && S.bleed > 0.03;
    for (const p in hud.parts) {
      for (const el of hud.parts[p]) {
        el.style.fill = S.dead ? '#555' : partColor(S.parts[p]);
        el.classList.toggle('wound', !S.dead && S.wound[p]);                          // открытая рана — пульсирует
        el.classList.toggle('bandaged', !S.dead && !S.wound[p] && h.wrap[p] > 0);     // перевязана — белый пунктир
      }
    }
    const bar = (k, v) => { hud.bars[k].style.width = (Math.max(0, Math.min(1, v)) * 100).toFixed(1) + '%'; };
    bar('blood', S.blood / 100);
    hud.val.textContent = bloodText(S);
    hud.root.classList.toggle('low', !S.dead && S.blood < 35);
    hud.root.classList.toggle('shock', !S.dead && S.shock);
    const calm = !S.dead && S.blood > 99.5 && S.pain < 0.05 && S.concussion < 0.05 && S.ko === 0 && S.groggy === 0
      && !S.broken && !S.lame && !(S.wound.head || S.wound.torso || S.wound.arms || S.wound.legs)
      && S.parts.head > 99 && S.parts.torso > 99 && S.parts.arms > 99 && S.parts.legs > 99;
    hud.root.classList.toggle('calm', calm);               // всё в норме — панель бледная, при проблемах — яркая
    const pip = (k, v) => {
      const on = Math.ceil(Math.max(0, v) * PIPS - 1e-6);
      hud.pips[k].forEach((el, i) => el.classList.toggle('on', i < on));
    };
    pip('helm', S.helmet / HELMET_MAX); pip('armor', S.armor / ARMOR_MAX);
    hud.helm.style.opacity = S.helmet > 0 ? 0.35 + 0.65 * S.helmet / HELMET_MAX : 0;   // каска и жилет видны на силуэте
    hud.vest.style.opacity = S.armor > 0 ? 0.35 + 0.65 * S.armor / ARMOR_MAX : 0;
    const chips = describe(S);
    const key = chips.map(c => c.join(':')).join('|');
    if (key !== hud.chipKey) {                          // перерисовываем значки только при изменении
      hud.chipKey = key;
      hud.chips.innerHTML = chips.map(([t, c]) => '<span class="chip ' + c + '">' + t + '</span>').join('');
    }
    let msg = '', cls = '';
    if (S.dead) msg = '';                                  // о гибели сообщает #endscreen (render.js)
    else if (S.shock && S.ko > 0) { msg = 'болевой шок… быстро жмите A/D!'; cls = 'shock'; }
    else if (S.ko > 0) { msg = 'без сознания… быстро жмите A/D!'; cls = 'ko'; }
    else if (S.broken) { msg = 'торс разрушен — не встать, нужна перевязка'; cls = 'shock'; }
    if (hud.msgT.textContent !== msg) { hud.msgT.textContent = msg; hud.msg.className = 'st-msg ' + cls; }
    const need = (S.ko > 0 && !S.dead) ? STRUGGLE_NEED : 0;       // полоска «очнуться»: заполняется частыми нажатиями A/D
    hud.msgBarWrap.style.opacity = need ? 1 : 0;
    if (need) hud.msgBar.style.width = (Math.max(0, Math.min(1, (h.struggle || 0) / need)) * 100).toFixed(0) + '%';
  }

  // состояние экранных эффектов
  const fx = { lid: 0, painFlash: 0, flash: 0, beat: 0, beatT: 0, dub: 0, prevPain: 0, prevConc: 0 };

  // «веки»: чёрные шторки сверху и снизу с мягкой кромкой (k: 0 — открыты, 1 — закрыты)
  function drawLids(ctx, W, H, k) {
    const hh = H * 0.5 * Math.min(1, k) * 0.93;
    if (hh < 1) return;
    const stop = Math.max(0, 1 - H * 0.12 / hh);
    let g = ctx.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(stop, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, hh);
    g = ctx.createLinearGradient(0, H, 0, H - hh);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(stop, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, H - hh, W, hh);
  }

  // экранные эффекты (вызывать в конце render)
  function draw(ctx, W, H) {
    const S = state, cv = ctx.canvas;
    const c = confusion();
    const pale = S.blood < 70 ? (70 - S.blood) / 70 : 0;                  // бледность от кровопотери 0..1
    const shock = S.dead ? 0 : Math.max(0, (S.pain - 0.5) / 0.5);         // 0 при боли ≤50%, 1 при 100%

    // события: резкий рост боли — красная вспышка, резкий рост контузии — белая (оглушение)
    const dPain = S.pain - fx.prevPain; fx.prevPain = S.pain;
    const dConc = S.concussion - fx.prevConc; fx.prevConc = S.concussion;
    if (dPain > 0.02) fx.painFlash = Math.min(1, Math.max(fx.painFlash, dPain * 4));
    if (dConc > 0.08) fx.flash = Math.min(1, Math.max(fx.flash, dConc * 1.6));
    fx.painFlash *= 0.93;
    fx.flash *= 0.96;

    // сердцебиение: шок, обморок, сильная кровопотеря — двойной удар «тум-тум», чем хуже, тем чаще
    const hb = S.dead ? 0 : Math.max(shock, S.blood < 50 ? (50 - S.blood) / 50 : 0, S.ko > 0 ? 0.5 : 0);
    if (hb > 0.1) {
      if (--fx.beatT <= 0) { fx.beat = 1; thump(0.5 + 0.5 * hb); fx.beatT = Math.round(75 - 35 * hb); fx.dub = 11; }
      else if (fx.dub > 0 && --fx.dub === 0) { fx.beat = Math.max(fx.beat, 0.6); thump(0.3 + 0.3 * hb); }
    } else { fx.beatT = 0; fx.dub = 0; }
    fx.beat *= 0.88;

    // веки: закрываются быстро, открываются медленно
    const lidTo = (S.ko > 0 || S.dead) ? 1 : 0;
    fx.lid += (lidTo - fx.lid) * (lidTo ? 0.07 : 0.035);
    if (Math.abs(lidTo - fx.lid) < 0.003) fx.lid = lidTo;

    // зрение (только холст с игрой): размытие, обесцвечивание; после пробуждения резкость «наводится» ~1,5 с
    const wake = S.groggy > WAKE_GRACE - 90 ? (S.groggy - (WAKE_GRACE - 90)) / 90 : 0;
    const blur = c * 3 + wake * 4 + fx.flash * 3 + fx.beat * hb * 1.2;
    const sat = 1 - Math.min(0.8, shock * 0.45 + pale * 0.6);
    const f = [];
    if (blur > 0.05) f.push('blur(' + blur.toFixed(1) + 'px)');
    if (sat < 0.98) f.push('saturate(' + sat.toFixed(2) + ')');
    cv.style.filter = f.join(' ');

    // качка камеры от контузии, лёгкая дрожь от шока и «толчок» на каждый удар сердца
    const rot = c * 0.8 * Math.sin(t * 0.021) + shock * 0.2 * Math.sin(t * 0.55);
    const zoom = 1 + Math.abs(rot) * 0.04 + c * 0.012 + fx.beat * hb * 0.012;     // запас, чтобы не открывались края
    cv.style.transform = (c > 0.03 || hb > 0.1) ? 'rotate(' + rot.toFixed(2) + 'deg) scale(' + zoom.toFixed(3) + ')' : '';

    // двоение при контузии: картинка накладывается сама на себя со смещением
    if (c > 0.12) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = Math.min(0.4, c * 0.45);
      ctx.drawImage(cv, Math.round(Math.sin(t * 0.031) * c * 18), Math.round(Math.cos(t * 0.043) * c * 8));
      ctx.restore();
    }

    // тёмная виньетка: контузия + потеря крови + шок + потеря сознания; в шоке и при кровопотере просвет сужается
    const pulse = 0.85 + 0.15 * Math.sin(t * 0.1);
    const tunnel = Math.max(shock, pale * 0.6);
    let a = c * 0.6 + (1 - S.blood / 100) * 0.5 + shock * 0.3;
    if (S.ko > 0 || S.dead) a = 0.95;
    a = Math.min(0.95, a * pulse);
    if (a > 0.01) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (0.25 - 0.13 * tunnel), W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,' + a + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // красная виньетка боли: постоянная в шоке + вспышка при ударе + пульс сердца
    const red = S.dead ? 0 : Math.min(0.85, shock * 0.5 + fx.painFlash * 0.6 + fx.beat * hb * 0.2);
    if (red > 0.01) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, 'rgba(160,12,6,0)');
      g.addColorStop(1, 'rgba(160,12,6,' + red.toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // белая вспышка оглушения
    if (fx.flash > 0.01) {
      ctx.fillStyle = 'rgba(255,255,255,' + (fx.flash * 0.85).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // веки поверх всего
    if (fx.lid > 0.01) drawLids(ctx, W, H, fx.lid);

    // индикаторы и надпись поверх всего
    if (!hud) buildHud();
    updateHud();
  }

  return { state, reset, onBlast, onShrapnel, woundedPart, bandage, transfuse, rest, calm, update,
         conscious, canRise, wake, needsArmor, rearm, speedMul, legSpeed, sway, wobble, draw };
};

// Health — здоровье того, кто сейчас обрабатывается (игрок или союзник; подменяется в runAs)
let Health = makeHealth(true);
const playerHealth = Health;