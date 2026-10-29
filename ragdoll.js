'use strict';
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
const BANDAGE_WALK = 0.7;
const STRUGGLE_NEED = 6;
const STRUGGLE_DECAY = 0.06;
const WOUND_PART = { head: 'head', neck: 'head', chest: 'torso', pelvis: 'torso', elbow: 'arms', wrist: 'arms', knee: 'legs', ankle: 'legs', toe: 'legs' };
const partOfSeg = seg => WOUND_PART[seg.b.replace(/[BF]$/, '')];
const MAX_WOUNDS = 40;
const DISMEMBER_K = 0.3;
const TRANSFUSE_RATE = 0.15;
const WRAP_T = 150;
const BAND_AXIS = { head: ['neck', 'head'], torso: ['pelvis', 'chest'], arms: ['elbowB', 'wristB'], legs: ['pelvis', 'kneeF'] };
const TREAT_REACH = 60;
const MEDIC_RATE = 3;
const PAIN_BANDAGE_MIN = 0.4;
const painSlow = p => 1 - (1 - PAIN_BANDAGE_MIN) * p;
const CONCUSS_HELP = 0.15;
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
  const entries = h.pts || (h.pts = Object.entries(P));   // кэш; сбрасывается, когда отрывается конечность
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
  if (proneAim(h) && h.gunWant) dir = 0;                              // лёжа с винтовкой в руках не ползём (убери оружие на 1 — поползёшь)
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
		const canBlind = keys.Space && h.gunWant && h.gun > 0.5 && h.crouch > 0.5 && h.lie < 0.3 && h.bal > 0.6
			&& !h.getup && !h.bandaging && !h.treat && !h.nadeAim && !(h.throwT > 0) && !h.carrying && Health.conscious();
		h.blind = (h.blind || 0) + ((canBlind ? 1 : 0) - (h.blind || 0)) * 0.14;
		if (h.blind < 0.01) h.blind = 0;
	}
	if (h.isPlayer) {
		const c = P.chest, reach = gunReach(h);           // пуля вылетает из дула, а не из груди
		const near = Math.hypot(mouse.x - c.x, mouse.y - c.y) <= reach + 10;
		let a = Math.atan2(mouse.y - c.y, mouse.x - c.x);
		if (!near) {
			for (let i = 0; i < 2; i++) {                        // уточняем угол: линия от дула должна проходить через курсор
				const mx = c.x + Math.cos(a) * reach, my = c.y + Math.sin(a) * reach;
				a = Math.atan2(mouse.y - my, mouse.x - mx);
			}
		}
		const MAX_DOWN = 65 * D2R;                               // вниз не круче 65°, вверх без ограничения
		const el = Math.atan2(Math.sin(a), Math.abs(Math.cos(a)));   // угол над/под горизонтом, вниз положительный
		if (el > MAX_DOWN) a = Math.cos(a) < 0 ? Math.PI - MAX_DOWN : MAX_DOWN;
		if (h.blind > 0.001) {                                   // вслепую: ствол почти горизонтален (вниз ≤ 11°, вверх ≤ 29°)
			const e2 = Math.atan2(Math.sin(a), Math.abs(Math.cos(a)));
			const cl = Math.max(lerp(-Math.PI / 2, -0.5, h.blind), Math.min(lerp(MAX_DOWN, 0.2, h.blind), e2));
			a = Math.cos(a) < 0 ? Math.PI - cl : cl;
		}
		if (proneAim(h)) {											// лёжа: ствол только вперёд, угол ограничен
			const e3 = Math.max(-PRONE_AIM_UP, Math.min(PRONE_AIM_DOWN, Math.atan2(Math.sin(a), Math.abs(Math.cos(a)))));
			a = h.f > 0 ? e3 : Math.PI - e3;
		}
		h.aimA = a;
	} else {
		h.aimA = h.aimWant != null ? h.aimWant : (h.f > 0 ? 0 : Math.PI);
	}
	const aimFace = h.isPlayer && (h.gunWant || h.gunRestore || h.gun > 0.05 || h.nadeAim || h.throwT > 0);   // оружие или граната в руках: тело смотрит на курсор, а не туда, куда идём
	let faceDir = aimFace ? 0 : dir;
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
	const inControl = h.bal > 0.6 && !h.getup && (h.lie < 0.3 || proneAim(h)) && Health.conscious();
	if (h.bandWant && (!inControl || h.nadeAim || h.throwT > 0)) h.bandWant = false;   // упал / бросок гранаты — бинт убран
	if (h.isPlayer) nadeStep(h);
	reloadStep(h);
	const busy = h.bandaging || h.treat || h.nadeAim || h.throwT > 0;                  // перевязка / лечение: руки заняты, оружие убираем
	if ((!inControl || busy) && h.gunWant) { h.gunWant = false; h.gunRestore = true; }
	if (inControl && !busy && h.bal > 0.95 && h.gunRestore) { h.gunWant = true; h.gunRestore = false; }
	const gunSpd = (h.nadeAim || h.throwT > 0) ? 0.12 : (h.gunWant || inControl ? 0.05 : 0.12);
	h.gun = h.gunWant ? Math.min(1, h.gun + gunSpd) : Math.max(0, h.gun - gunSpd);
	if (h.shootCD > 0) h.shootCD--;
	h.handShake = (h.handShake || 0) * 0.92;                                       // дрожь затухает после стрельбы
	const shAmp = h.handShake * (2 + 2.5 * (h.blind || 0)) + (h.blind || 0) * 0.3;   // вслепую дрожит сильнее (и чуть-чуть всегда)
	h.shX = (h.shX || 0) * 0.45 + (Math.random() - 0.5) * 2 * shAmp * 0.55;        // сглаженный случайный шум, чтобы не рябило
	h.shY = (h.shY || 0) * 0.45 + (Math.random() - 0.5) * 2 * shAmp * 0.55;
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
    if (h.gdir == null) h.gdir = 1;
    if (walking) {                                          // 1 — идём лицом вперёд, -1 — пятимся
      const tg = dir === f ? 1 : -1;
      h.gdir = h.walk < 0.2 ? tg : h.gdir + (tg - h.gdir) * 0.2;   // в начале шага переключаем мгновенно (ноги почти на месте), потом плавно
    }
    const wantLie = (keys.ShiftLeft || keys.ShiftRight || h.cot) ? 1 : 0;
    const wantCrouch = (!wantLie && (keys.KeyS || keys.ArrowDown || (h.bandaging && dir === 0))) ? 1 : 0;
    h.lie += (wantLie - h.lie) * 0.08;
    h.crV = (h.crV || 0) * 0.75 + (wantCrouch - h.crouch) * 0.045;   // пружина: приседание с лёгким «доседанием»
    h.crouch = Math.max(0, Math.min(1.1, h.crouch + h.crV));
    if (h.crouch === 0 && h.crV < 0) h.crV = 0;
    const lie = h.lie, cr = h.crouch;
    h.propK = (h.propK || 0) + ((proneAim(h) && h.gun > 0.5 && h.bal > 0.6 ? 1 : 0) - (h.propK || 0)) * 0.1;
    const PR = proneAt(h.propK);                                      // поза лёжа: между «плашмя» и «на локтях»
    const fx = bodyFx(h, w, cr, lie);                                // дыхание, перенос веса, инерция, попадания
    const amp = GAIT.amp * (1 - 0.35 * cr - 0.2 * lie);
    const liftH = GAIT.lift * (1 - 0.4 * cr - 0.5 * lie);
    const spd = Health.speedMul() * (h.speedK || 1) * (1 - 0.25 * cr - 0.7 * lie) * (h.bandaging ? BANDAGE_WALK : 1) * (h.carrying ? 0.6 : 1) * (1 - 0.125 * (1 - h.gdir));   // назад на 25% медленнее
    if (walking) h.phase += GAIT.speed * spd * Math.PI / (2 * amp);
    const standH = h.standH - CROUCH_DROP * cr - GAIT.bob * Math.abs(Math.sin(h.phase)) * w * (1 - cr) - (Health.state.lame ? 7 * w : 0) - fx.drop;   // хромота: корпус просел
    const wantH = lerp(standH, RADIUS.pelvis, lie);
    const onGround = ['ankleB', 'ankleF', 'toeB', 'toeF'].some(n => P[n].y >= GROUND - P[n].r - 2);
    if (lie < 0.3 && onGround) h.tone = Math.max(0, Math.min(30, h.tone + (wantH - (GROUND - P.pelvis.y)) * 0.03));
    else if (lie >= 0.3) h.tone *= 0.9;
    const hipH = wantH + h.tone * (1 - lie);

    const g = { B: gait(h.phase, amp, liftH), F: gait(h.phase + Math.PI, amp, liftH) };
    g.B.x *= h.gdir; g.F.x *= h.gdir;                      // пятимся: ноги и руки идут в обратную сторону
    const soft = h.bal * h.bal;
    const kUp = 0.3 * soft;
    const kLeg = 0.5 * soft;
    const tug = (p, tx, ty, kk) => { p.x += (tx - p.x) * kk; p.y += (ty - p.y) * kk; };   // мягкая подтяжка без ограничения шага; не путать с глобальной pull из animations.js
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
      tug(knee, kn.x + Health.wobble(s === 'B' ? 2 : 5) * 5, kn.y, kLeg * 0.8);
      if (planted && !drag) { ank.plant = true; toe.plant = true; }
    }
    const rel = (a, b) => ({ x: (h.off[b].x - h.off[a].x) * f, y: h.off[b].y - h.off[a].y });
    const sway = (Health.sway() + (Health.state.lame ? f * 0.7 * w : 0)) * (1 - lie);   // хромота: корпус клонит вперёд
    const sp = rel('pelvis', 'chest'), nk = rel('chest', 'neck'), hd = rel('neck', 'head');
    muscle(P.pelvis, P.chest,
      lerp(sp.x + f * (3 * w + 8 * cr) + sway * 7, f * PR.chest.fx, lie) + fx.cx,
      lerp(sp.y, PR.chest.y + RADIUS.pelvis, lie) + fx.cy, kUp);
    muscle(P.chest, P.neck,
      lerp(nk.x + f * (1 * w + 5 * cr) + sway * 5, f * (PR.neck.fx - PR.chest.fx), lie) + fx.nx,
      lerp(nk.y, PR.neck.y - PR.chest.y, lie) + fx.ny, kUp);
    muscle(P.neck, P.head,
      lerp(hd.x + f * (1 * w + 5 * cr) + sway * 5, f * (PR.head.fx - PR.neck.fx), lie) + fx.hx,
      lerp(hd.y, PR.head.y - PR.neck.y, lie) + fx.hy, kUp);
		const aiming = h.bal > 0.6 && (lie < 0.3 || proneAim(h)) && !h.bandaging && !h.treat && h.gun > 0.5 && !h.nadeAim && !(h.throwT > 0);
				if (aiming) {
			const ax = Math.cos(h.aimA), ay = Math.sin(h.aimA);
			const sh = P.chest;                                      // плечо
			const cc = gunOrigin(h);                                 // откуда считаем хват: грудь или точка над головой
			const fl = (Math.cos(h.aimA) < 0 ? -1 : 1) * (1 - 2 * ease(h.blind || 0));   // при хвате вслепую оружие перевёрнуто
			const gx = (lx, ly) => ({ x: cc.x + ax * lx - ay * ly * fl, y: cc.y + ay * lx + ax * ly * fl });
			const gF = h.mg ? gx(34, 10) : gx(13, 9), gB = reloadHand(h, gx) || (h.mg ? gx(52, 2) : gx(41, 2));
			const pr = proneAim(h);										// лёжа на локтях: кисти дальше вперёд, локти упираются в землю
			const hB = pr ? (reloadHand(h, gx) || gx(54, 2)) : gB, hF = pr ? gx(44, 3) : gF;
			const txB = hB.x, tyB = hB.y;
			const txF = hF.x, tyF = hF.y;
			const armB = ik2(sh, { x: txB, y: tyB }, S.upperArm, S.foreArm, -h.f, !pr);
			const armF = ik2(sh, { x: txF, y: tyF }, S.upperArm, S.foreArm, -h.f, !pr);
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
					let mx = lerp(tx, lx, lie), my = lerp(o.y, ly - (grip && part === 'elbow' ? 22 : 0), lie);
					const ck = (s === 'F' && h.bandWant) ? 0 : ease(h.coverK || 0);   // присел без оружия — руки к голове (той же мышцей, без телепорта)
					if (ck > 0.001) {
						const hc = P.head;
						const cx = part === 'wrist' ? (s === 'B' ? hc.x - f * 4 : hc.x + f * 7) : (s === 'B' ? hc.x + f * 6 : hc.x + f * 17);
						const cy = part === 'wrist' ? (s === 'B' ? hc.y - 11 : hc.y - 9) : (s === 'B' ? hc.y + 16 : hc.y + 10);
						mx = lerp(mx, cx - P.chest.x, ck); my = lerp(my, cy - P.chest.y, ck);
					}
					muscle(P.chest, q, mx, my, kUp, 1, grip ? 0.1 : 1); // локоть приподнят, иначе подпирает грудь
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
    const cover = h.isPlayer && h.crouch > 0.5 && h.gun < 0.05 && !h.gunWant && !h.bandaging && !h.treat
      && !h.nadeAim && !(h.throwT > 0) && h.bal > 0.6 && lie < 0.3 && Health.conscious();
    h.coverK = (h.coverK || 0) + ((cover ? 1 : 0) - (h.coverK || 0)) * 0.15;
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
  if (proneAim(h) && (h.gun > 0.5 || h.propK > 0.02) && h.bal > 0.6 && !h.getup) {       // лёжа с оружием: тело не скользит по земле
    if (h.proneX == null) h.proneX = P.pelvis.x;
    const d = h.proneX - P.pelvis.x;
    if (Math.abs(d) < 12) { for (const [, p] of entries) { p.x += d; p.px += d; } }
    else h.proneX = P.pelvis.x;                                      // сильно толкнули (взрыв) — отпускаем и фиксируем заново
  } else h.proneX = null;
  if (h.bal > 0.6 && h.lie < 0.5) {
    h.tip = tipping(P) > TIP_MARGIN ? h.tip + 1 : Math.max(0, h.tip - 2);
    if (h.tip > 18) { stun = Math.max(stun, 90); h.tip = 0; }
  } else {
    h.tip = 0;
  }
}
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
function pickWound(skipLegs) {
  const st = Health.state;
  const started = p => hero.wrap[p] > 0 && hero.wrap[p] < WRAP_T;
  let best = null;
  for (const p in st.wound) {
    if (!st.wound[p]) continue;
    if (skipLegs && p === 'legs') continue;
    if (best === null || (started(p) && !started(best)) ||
        (started(p) === started(best) && st.parts[p] < st.parts[best])) best = p;
  }
  return best;
}
function struggleStep(h) {
  if (h.struggle > 0) h.struggle = Math.max(0, h.struggle - STRUGGLE_DECAY);
  const st = Health.state;
  if (st.dead || st.ko === 0) { h.struggle = 0; return; }
  if (h.struggle >= STRUGGLE_NEED) {
    h.struggle = 0;
    Health.wake();
    stun = 0;
  }
}
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
  h.pts = null;
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
    if (w.kind === 'embed') {                              // осколок торчит 55 с, перевязка его не убирает
      if (--w.ttl <= 0) { ws.splice(i, 1); continue; }
      if (bleeding && st.wound[w.part]) w.stain = Math.min(w.maxStain, w.stain + 0.006 * st.bleed);
      continue;
    }
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
function woundPos(h, w) {
  const seg = h.segs[w.si], A = h.p[seg.a], B = h.p[seg.b];
  const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1;
  const k = w.o * w.f * h.f * seg.ry;  // h.f / w.f — боец мог развернуться
  return { x: A.x + dx * w.t - dy / l * k, y: A.y + dy * w.t + dx * 1 / l * k };
}
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
  const wd = { part: partOfSeg(seg), si, t, o: Math.max(-0.85, Math.min(0.85, o)), kind: k };
  if (kind === 'embed') {                                                 // крупный осколок застрял в теле
    wd.ttl = EMBED_TTL;
    wd.sz = 8 + Math.random() * 5;
    wd.ra = Math.atan2(-(vy || 0), -(vx || 1)) - Math.atan2(dy, dx);      // торчит назад по траектории, угол относительно кости
  }
  pushWound(h, wd);
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