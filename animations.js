'use strict';
const GAIT = {
  amp: 20,
  lift: 14,
  speed: 2.4,
  hipDrop: 8,
  bob: 3
};
const GAIT_OMEGA = GAIT.speed * Math.PI / (2 * GAIT.amp);
const STANCE = { B: -9, F: 9 };
const CROUCH_DROP = 30;
const PRONE = {
  chest: { fx: 62, y: -8 },
  neck:  { fx: 74, y: -14 },
  head:  { fx: 98, y: -10 }
};
// лёжа с оружием в руках: на локтях, грудь приподнята, голова поднята к прицелу
const PRONE_PROP = {
  chest: { fx: 60, y: -22 },
  neck:  { fx: 68, y: -31 },
  head:  { fx: 88, y: -45 }
};
function proneAt(k) {                                   // k = 0 — обычное «лёжа», 1 — на локтях с оружием
  const o = {};
  for (const n in PRONE) o[n] = { fx: PRONE[n].fx + (PRONE_PROP[n].fx - PRONE[n].fx) * k, y: PRONE[n].y + (PRONE_PROP[n].y - PRONE[n].y) * k };
  return o;
}
const D2R = Math.PI / 180;
const ease = u => u * u * (3 - 2 * u);
const isUpright = h => h.p.pelvis.y - h.p.chest.y > S.torso * 0.7;
function gait(phase, amp = GAIT.amp, lift = GAIT.lift) {
  const TWO = Math.PI * 2;
  const u = ((phase % TWO) + TWO) % TWO;
  if (u < Math.PI) return { x: -amp * Math.cos(u), lift: Math.sin(u) * lift };
  const t = (u - Math.PI) / Math.PI;
  return { x: amp - 2 * amp * t, lift: 0 };
}
function kneeIK(hip, ank, f) {
  const dx = ank.x - hip.x, dy = ank.y - hip.y;
  const len = Math.hypot(dx, dy) || 0.0001;
  const d = Math.min(len, S.thigh + S.calf - 0.5);
  const ux = dx / len, uy = dy / len;
  const a = (d * d + S.thigh * S.thigh - S.calf * S.calf) / (2 * d);
  const hh = Math.sqrt(Math.max(0, S.thigh * S.thigh - a * a));
  return { x: hip.x + ux * a + uy * f * hh, y: hip.y + uy * a - ux * f * hh };
}
function ik2(a, t, l1, l2, s, flip) {
  const dx = t.x - a.x, dy = t.y - a.y;
  const len = Math.hypot(dx, dy) || 0.0001;
  const d = Math.max(1, Math.min(len, l1 + l2 - 0.5));
  const ux = dx / len, uy = dy / len;
  const m = (d * d + l1 * l1 - l2 * l2) / (2 * d);
  const hh = Math.sqrt(Math.max(0, l1 * l1 - m * m));
  let mid = { x: a.x + ux * m + uy * s * hh, y: a.y + uy * m - ux * s * hh };
  if (flip && mid.y > GROUND - 2) mid = { x: a.x + ux * m - uy * s * hh, y: a.y + uy * m + ux * s * hh };
  return { mid, end: { x: a.x + ux * d, y: a.y + uy * d } };
}
const pz = (px, ph, sp, nk, hd, hB, hF, fB, fF, ta) =>
  ({ px, ph, sp, nk, hd, h: { B: hB, F: hF }, f: { B: fB, F: fF }, ta: Array.isArray(ta) ? { B: ta[0], F: ta[1] } : { B: ta, F: ta } });
function poseTargets(q, ax, f) {
  const T = {};
  const X = x => ax + f * x, Y = up => GROUND - up;
  const at = (from, ang, len) => ({ x: from.x + Math.sin(ang * D2R) * f * len, y: from.y - Math.cos(ang * D2R) * len });
  T.pelvis = { x: X(q.px), y: Y(q.ph) };
  T.chest = at(T.pelvis, q.sp, S.torso);
  T.neck = at(T.chest, q.nk, S.neck);
  T.head = at(T.neck, q.hd, S.head);
  for (const s of ['B', 'F']) {
    const arm = ik2(T.chest, { x: X(q.h[s][0]), y: Y(q.h[s][1]) }, S.upperArm, S.foreArm, -f, true);
    const leg = ik2(T.pelvis, { x: X(q.f[s][0]), y: Y(q.f[s][1]) }, S.thigh, S.calf, f);
    T['elbow' + s] = arm.mid; T['wrist' + s] = arm.end;
    T['knee' + s] = leg.mid;  T['ankle' + s] = leg.end;
    T['toe' + s] = { x: leg.end.x + f * Math.cos(q.ta[s] * D2R) * S.foot, y: leg.end.y - Math.sin(q.ta[s] * D2R) * S.foot };
  }
  for (const n in T) T[n].y = Math.min(T[n].y, GROUND - RADIUS[n.replace(/[BF]$/, '')]); // ничего не ниже земли
  return T;
}
function pull(p, tx, ty, k, maxStep) {
  ty = Math.min(ty, GROUND - p.r);
  const dx = Math.max(-maxStep, Math.min(maxStep, (tx - p.x) * k));
  const dy = Math.max(-maxStep, Math.min(maxStep, (ty - p.y) * k));
  p.x += dx; p.y += dy;
  p.px = p.x; p.py = p.y;
}
function nudge(p, tx, ty, kk) {
  ty = Math.min(ty, GROUND - p.r);
  const dx = Math.max(-5, Math.min(5, (tx - p.x) * kk));
  const dy = Math.max(-5, Math.min(5, (ty - p.y) * kk));
  p.x += dx; p.y += dy;
  p.px += dx; p.py += dy;
  p.px += (p.x - p.px) * 0.5;
  p.py += (p.y - p.py) * 0.5;
}
function reachTo(from, t, len) {
  const dx = t.x - from.x, dy = t.y - from.y, d = Math.hypot(dx, dy);
  return d <= len ? t : { x: from.x + dx / d * len, y: from.y + dy / d * len };
}
// точка, от которой считается положение оружия: грудь, а при стрельбе «по-сомалийски» — над головой
function gunOrigin(h) {
	const c = h.p.chest, k = ease(Math.min(1, h.blind || 0));
	const sx = h.shX || 0, sy = h.shY || 0;                      // дрожь рук от стрельбы
	if (k < 0.001) return { x: c.x + sx, y: c.y + sy };
	const hd = h.p.head, a = h.aimA;
	return { x: lerp(c.x, hd.x - Math.cos(a) * 16, k) + sx, y: lerp(c.y, hd.y - 16 - Math.sin(a) * 16, k) + sy };
}
function mixPose(a, b, u) {
  if (typeof a === 'number') return lerp(a, b, u);
  const o = Array.isArray(a) ? [] : {};
  for (const k in a) o[k] = mixPose(a[k], b[k], u);
  return o;
}
function getUpSeqBase(prone, standH) {
  const stand = x => pz(x, standH, 0, 0, 0, [x + 4, standH - 3], [x + 19, standH], [x - 9, 5], [x + 9, 5], 0);
  const kneel = pz(6, 46, 20, 14, 8, [48, 54], [54, 52], [-60, 5], [46, 5], [-180, 0]);
  const rise = pz(24, 66, 10, 6, 4, [30, 68], [44, 66], [6, 20], [46, 5], [-60, 0]);
  if (prone) return [
    { d: 30, pose: pz(0, 8, 88, 86, 82, [92, 5], [104, 5], [-87, 5], [-90, 5], -180) },
    { d: 30, pose: pz(0, 14, 65, 75, 80, [58, 5], [64, 5], [-87, 5], [-90, 5], -180) },
    { d: 24, pose: pz(0, 52, 75, 80, 85, [60, 5], [66, 5], [-85, 16], [-88, 16], -150) },
    { d: 16, pose: pz(2, 44, 68, 72, 78, [60, 5], [66, 5], [-80, 18], [14, 24], [-150, -60]) },
    { d: 20, pose: pz(6, 36, 60, 66, 72, [62, 5], [68, 5], [-72, 5], [36, 5], [-180, 0]) },
    { d: 28, pose: kneel },
    { d: 26, pose: rise },
    { d: 24, pose: stand(37) }
  ];
  return [
    { d: 30, pose: pz(0, 8, -88, -86, -84, [-12, 5], [-4, 5], [84, 5], [87, 5], 75) },
    { d: 30, pose: pz(0, 8, -88, -80, -70, [-12, 5], [-4, 5], [46, 5], [38, 5], 0) },
    { d: 34, pose: pz(-2, 9, -12, -6, 0, [-14, 5], [-8, 5], [44, 5], [36, 5], 0) },
    { d: 16, pose: pz(-2, 9, 5, 0, 0, [48, 46], [54, 50], [44, 5], [36, 5], 0) },
    { d: 26, pose: pz(8, 36, 60, 62, 68, [60, 5], [66, 5], [-62, 5], [36, 5], [-180, 0]) },
    { d: 24, pose: kneel },
    { d: 26, pose: rise },
    { d: 24, pose: stand(37) }
  ];
}
const cloneP = p => JSON.parse(JSON.stringify(p));
// стиль вставания зависит от состояния бойца
function getUpStyle() {
  const st = Health.state;
  if (st.parts.legs < 35 || st.pain > 0.6 || st.concussion > 0.5) return 'heavy';   // тяжело, с передышкой
  if (st.wound.torso) return 'hurt';                                                 // рука держится за живот
  return Math.random() < 0.35 ? 'quick' : 'normal';                                  // иногда бодрый рывок
}
function getUpSeq(prone, standH, style = 'normal') {
  const out = getUpSeqBase(prone, standH).map(s => ({ d: s.d, pose: s.pose }));
  if (style === 'quick') {
    for (const s of out) s.d = Math.max(8, Math.round(s.d * 0.65));
  } else if (style === 'hurt') {
    for (const i of [5, 6]) {                                  // 5 — на коленях, 6 — подъём
      const p = cloneP(out[i].pose);
      p.h.B = [p.px + (i === 5 ? 16 : 6), p.ph + (i === 5 ? 26 : 30)];   // задняя рука к животу
      out[i].pose = p;
      out[i].d = Math.round(out[i].d * 1.2);
    }
  } else if (style === 'heavy') {
    for (const s of out) s.d = Math.round(s.d * 1.2);
    const bent = cloneP(out[5].pose);                          // на коленях, голова вниз: переводит дух
    bent.ph -= 3; bent.sp += 18; bent.nk += 14; bent.hd += 14;
    out.splice(6, 0, { d: 26, pose: bent });
  }
  return out;
}
// ===== Реакции на попадания =====
const FLINCH_T = { head: 24, torso: 32, arms: 26, legs: 34 };   // длительность реакции, кадров
function hitReact(h, part, vx, vy, k) {
  const f = h.flinch;
  if (f && f.k * f.t / f.max > k) return;                       // сильную реакцию слабая не перебивает
  const t = Math.round((FLINCH_T[part] || 28) * (0.5 + 0.5 * k));
  h.flinch = { t, max: t, part, k, dir: Math.sign(vx) || h.f };
}
// смещения тела: дыхание, перенос веса, инерция при старте/остановке, реакции на попадания
function bodyFx(h, w, cr, lie) {
  const o = { cx: 0, cy: 0, nx: 0, ny: 0, hx: 0, hy: 0, drop: 0, shift: 0, grab: null };
  const f = h.f;
  // покой: дыхание (чаще при боли) и медленный перенос веса
  h.idleT = (h.idleT == null ? Math.random() * 600 : h.idleT) + 1;
  const idle = (1 - w) * (1 - 0.6 * lie);
  const br = Math.sin(h.idleT * (0.045 + Health.state.pain * 0.06));
  o.cy -= br * 1.3 * idle;
  o.ny -= br * 0.5 * idle;
  o.hx += Math.sin(h.idleT * 0.011) * 2.5 * idle * (1 - cr * 0.5);
  o.shift = Math.sin(h.idleT * 0.009) * 2 * idle * (1 - lie);
  // инерция: корпус отстаёт при старте и подаётся вперёд при остановке
  h.leanV = (h.leanV || 0) * 0.8 + (w - (h.lean || 0)) * 0.05;
  h.lean = (h.lean || 0) + h.leanV;
  o.cx += f * 9 * (h.lean - w);
  o.hx += f * 4 * (h.lean - w);
  // бросок гранаты: корпус откидывается на замахе и подаётся вперёд на броске
  if (h.nadeW > 0 || h.throwT > 0) {
    const tu = h.throwT > 0 ? 1 - h.throwT / THROW_T : 0;
    const k = h.throwT > 0
      ? (tu < THROW_REL ? lerp(-1, 1, ease(tu / THROW_REL)) : lerp(1, 0, ease((tu - THROW_REL) / (1 - THROW_REL))))
      : -h.nadeW;
    o.cx += f * 7 * k * (1 - lie);
    o.hx += f * 4 * k * (1 - lie);
  }
  // перевязка: корпус и голова склоняются к ране (к ноге — сильнее)
  if (h.rollPart) h.bandLegs = h.rollPart === 'legs';
  h.bandK = (h.bandK || 0) + (((h.bandaging && h.bandPart) || h.treat ? 1 : 0) - (h.bandK || 0)) * 0.12;
  if (h.bandK > 0.01) {
    const bk = ease(h.bandK) * (1 - lie), lg = h.bandLegs ? 1 : 0;
    o.cx += f * (4 + 10 * lg) * bk;
    o.cy += (2 + 6 * lg) * bk;
    o.hx += f * (5 + 6 * lg) * bk;
    o.hy += (3 + 4 * lg) * bk;
  }
  // присел без оружия: голова втягивается в плечи
  if (h.coverK > 0.02) {
    const ck = ease(h.coverK);
    o.hx += f * 3 * ck; o.hy += 4 * ck; o.cx += f * 3 * ck;
  }
  // стрельба вслепую: голова пригнута и отведена назад, пока руки с оружием наверху
  if (h.blind > 0.01) {
    const bl = ease(h.blind);
    o.hx -= f * 5 * bl; o.hy += 7 * bl;
    o.cx -= f * 3 * bl; o.cy += 2 * bl;
  }
  // попадание: толчок по направлению пули, потом складывается вперёд
  const fl = h.flinch;
  if (fl) {
    if (--fl.t <= 0) h.flinch = null;
    else {
      const u = fl.t / fl.max;
      const e = fl.k * (1 - lie);
      const impact = u * u * u;
      const fold = Math.sin(Math.PI * (1 - u));
      if (fl.part === 'head') {
        o.hx += e * (fl.dir * 14 * impact + f * 6 * fold);
        o.hy += e * 4 * fold;
        o.cx += e * fl.dir * 3 * impact;
      } else if (fl.part === 'torso') {
        o.cx += e * (fl.dir * 7 * impact + f * 11 * fold);
        o.cy += e * 5 * fold;
        o.hx += e * (fl.dir * 5 * impact + f * 6 * fold);
        o.hy += e * 3 * fold;
      } else if (fl.part === 'legs') {
        o.drop = e * 11 * fold;                                  // подгибаются колени
        o.cx += e * f * 5 * fold;
      } else {
        o.cx += e * fl.dir * 4 * impact;
        o.hx += e * fl.dir * 3 * impact;
      }
      if (fl.k >= 0.6) o.grab = { part: fl.part, k: Math.min(1, u * 3) * Math.min(1, (1 - u) * 5 + 0.15) };
    }
  }
  return o;
}
// рука хватается за рану
function flinchGrab(h, g) {
  const P = h.p, f = h.f;
  const mid = (a, b, t) => ({ x: lerp(P[a].x, P[b].x, t), y: lerp(P[a].y, P[b].y, t) });
  const pt = g.part === 'head' ? mid('neck', 'head', 0.8)
    : g.part === 'torso' ? mid('pelvis', 'chest', 0.55)
    : g.part === 'arms' ? mid('elbowB', 'wristB', 0.5)
    : mid('pelvis', 'kneeF', 0.6);
  const s = g.part === 'arms' ? 'F' : 'B';                       // раненую руку держит другая
  const w = reachTo(P.chest, pt, 58);
  nudge(P['wrist' + s], w.x, w.y, 0.45 * g.k);
  nudge(P['elbow' + s], lerp(P.chest.x, w.x, 0.5) + f * 4, lerp(P.chest.y, w.y, 0.5) + 12, 0.22 * g.k);
}
function lieDownSeq(standH) {
  return [
    { d: 5,  pose: pz(0, standH, 0, 0, 0, [4, standH - 3], [19, standH], [-9, 5], [9, 5], 0) },
    { d: 14, pose: pz(-10, 34, 62, 62, 70, [62, 5], [70, 5], [-9, 5], [9, 5], 0) },
    { d: 12, pose: pz(10, 50, 75, 80, 85, [70, 5], [76, 5], [-72, 16], [-75, 16], -150) },
    { d: 12, pose: pz(10, 8, 88, 86, 82, [102, 5], [112, 5], [-77, 5], [-80, 5], -180) }
  ];
}
function startGetUp(h, t0 = 0) {
  const P = h.p;
  const prone = (P.chest.x + P.head.x - 2 * P.pelvis.x) * h.f >= 0;
  const from = {};
  for (const n in P) from[n] = { x: P[n].x, y: P[n].y };
  return { prone, seq: getUpSeq(prone, h.standH, getUpStyle()), ax: Math.max(115, Math.min(WORLD_W - 115, P.pelvis.x)), t: t0, from };
}
function startLieDown(h) {
  const P = h.p;
  const from = {};
  for (const n in P) from[n] = { x: P[n].x, y: P[n].y };
  return { down: true, seq: lieDownSeq(h.standH), ax: Math.max(115, Math.min(WORLD_W - 115, P.pelvis.x)), t: 0, from };
}
const DIVE_SPEED = 16;     // начальная скорость рывка, px/кадр (дальность ≈ 250 px)
const DIVE_DECAY = 0.95;   // затухание скорости каждый кадр
function diveSeq() {
  return [
    { d: 4,  pose: pz(-6, 46, 35, 30, 25, [40, 70], [50, 66], [-14, 5], [10, 5], 0) },                        // толчок из приседа
    { d: 8,  pose: pz(15, 62, 80, 82, 80, [118, 66], [130, 62], [-55, 40], [-62, 36], -170) },                // полёт
    { d: 8,  pose: pz(25, 40, 86, 85, 82, [128, 40], [138, 36], [-62, 22], [-68, 20], -175) },                // снижение
    { d: 10, pose: pz(10, 8, 88, 86, 82, [102, 5], [112, 5], [-77, 5], [-80, 5], -180) }                      // приземление на живот
  ];
}
function startDive(h) {
  const P = h.p;
  const from = {};
  for (const n in P) from[n] = { x: P[n].x, y: P[n].y };
  return { down: true, seq: diveSeq(), ax: Math.max(115, Math.min(WORLD_W - 115, P.pelvis.x)), t: 0, from, vx: h.f * DIVE_SPEED };
}
function getUpStep(h, entries) {
  const g = h.getup, f = h.f;
  g.t += (g.down ? 1 : Math.max(0.4, Health.speedMul())) * Health.legSpeed();
  if (g.vx) { g.ax = Math.max(115, Math.min(WORLD_W - 115, g.ax + g.vx)); g.vx *= DIVE_DECAY; }   // рывок: якорь позы едет вперёд
  let t = g.t, i = 0;
  while (i < g.seq.length && t >= g.seq[i].d) { t -= g.seq[i].d; i++; }
  if (i >= g.seq.length) {
    h.getup = null; h.bal = 1; h.lie = g.down ? 1 : 0; h.crouch = 0; h.crV = 0; h.lean = 0; h.leanV = 0; h.tone = 0; h.walk = 0;
    return;
  }
  const u = ease(t / g.seq[i].d);
  let T;
  if (i === 0) {
    T = poseTargets(g.seq[0].pose, g.ax, f);
    for (const n in T) T[n] = { x: lerp(g.from[n].x, T[n].x, u), y: lerp(g.from[n].y, T[n].y, u) };
  } else {
    T = poseTargets(mixPose(g.seq[i - 1].pose, g.seq[i].pose, u), g.ax, f);
  }
  T.head.x += Health.wobble(3) * 6;
  T.wristB.x += Health.wobble(0) * 5;
  T.wristF.x += Health.wobble(2.5) * 5;
  const k = g.down ? 0.45 : Math.min(0.35, 0.03 + g.t * 0.02);
  for (const [n, p] of entries) {
    if (!T[n]) continue;                       // оторванные части (cut1, cut2...) в позе не участвуют
    p.x += (T[n].x - p.x) * k; p.y += (T[n].y - p.y) * k;
    p.px += (p.x - p.px) * 0.6; p.py += (p.y - p.py) * 0.6;
  }
}