'use strict';
const BAND_OF = {
  'neck-head': 'head',
  'pelvis-chest': 'torso',
  'elbowB-wristB': 'arms',
  'elbowF-wristF': 'arms',
  'pelvis-kneeB': 'legs',
  'pelvis-kneeF': 'legs'
};
const STOW_MUZZLE_DOWN = true;
const lerpAng = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

// осветлить (k > 0) или затемнить (k < 0) цвет #rrggbb; результат кэшируется
const _shadeCache = {};
function shadeColor(hex, k) {
  if (hex.length !== 7) return hex;
  const key = hex + k;
  let r = _shadeCache[key];
  if (r) return r;
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k));
  r = 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  return (_shadeCache[key] = r);
}
function drawOval(a, b, ry, ext, color, helmet) {
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const rx = Math.hypot(b.x - a.x, b.y - a.y) / 2 + ext;
  const hy = Math.hypot(rx * Math.sin(ang), ry * Math.cos(ang));   // половина высоты эллипса на экране

  // объём: свет сверху — верх светлее, низ темнее
  const g = ctx.createLinearGradient(cx, cy - hy, cx, cy + hy);
  g.addColorStop(0, shadeColor(color, 0.22));
  g.addColorStop(0.45, color);
  g.addColorStop(1, shadeColor(color, -0.32));
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, ang, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#15150f';
  ctx.stroke();

  if (helmet) {
    drawFace(cx, cy, rx, ry, ang);
    if (Health.state.helmet > 0) drawHelmet(cx, cy, rx, ry, ang);
  }
}

// лицо: глаз на стороне, куда смотрит боец (закрыт без сознания, крестик у погибшего)
function drawFace(cx, cy, rx, ry, ang) {
  let nx = -Math.sin(ang), ny = Math.cos(ang);                 // нормаль к оси шея → голова
  if (nx * hero.f * 2 - ny * 0.3 < 0) { nx = -nx; ny = -ny; }  // в сторону взгляда
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const ex = cx + nx * ry * 0.55 + ux * rx * 0.1;
  const ey = cy + ny * ry * 0.55 + uy * rx * 0.1;
  const st = Health.state;
  ctx.strokeStyle = '#15150f';
  ctx.fillStyle = '#15150f';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (st.dead) {
    ctx.moveTo(ex - 2, ey - 2); ctx.lineTo(ex + 2, ey + 2);
    ctx.moveTo(ex + 2, ey - 2); ctx.lineTo(ex - 2, ey + 2);
    ctx.stroke();
  } else if (st.ko > 0) {
    ctx.moveTo(ex - 2.2, ey); ctx.lineTo(ex + 2.2, ey);
    ctx.stroke();
  } else if (st.concussion > 0.25 || st.groggy > 0) {              // контузия / «очнулся через силу»: глаз-кольцо, зрачок кружит
    const a = performance.now() * 0.012;
    ctx.arc(ex, ey, 2.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex + Math.cos(a) * 1.1, ey + Math.sin(a) * 1.1, 0.9, 0, Math.PI * 2);
    ctx.fill();
  } else if (st.pain > 0.5) {                                      // сильная боль: глаз зажмурен «>»
    ctx.moveTo(ex - nx * 1.8 + ux * 1.9, ey - ny * 1.8 + uy * 1.9);
    ctx.lineTo(ex + nx * 1.8, ey + ny * 1.8);
    ctx.lineTo(ex - nx * 1.8 - ux * 1.9, ey - ny * 1.8 - uy * 1.9);
    ctx.stroke();
  } else {
    ctx.arc(ex, ey, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

// каска: объём, блик и ремешок
function drawHelmet(cx, cy, rx, ry, ang) {
  const col = hero.helmetC || COLORS.helmet;
  const g = ctx.createLinearGradient(cx, cy - rx, cx, cy + rx);
  g.addColorStop(0, shadeColor(col, 0.3));
  g.addColorStop(1, shadeColor(col, -0.3));
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 1.5, ry + 1.5, ang, -1.3, 1.3);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#15150f';
  ctx.stroke();
  ctx.beginPath();                                              // блик
  ctx.ellipse(cx, cy, rx * 0.8, ry * 0.7, ang, -0.95, -0.25);
  ctx.strokeStyle = 'rgba(255,255,230,0.35)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.beginPath();                                              // ремешок под подбородком
  ctx.ellipse(cx, cy, rx - 1, ry - 1, ang, 1.4, 2.2);
  ctx.strokeStyle = 'rgba(20,20,15,0.65)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}
function drawUnit() {
	const held = hero.gun >= 0.5;
	drawShadow();
	if (!held) drawRifle();
	for (let si = 0; si < hero.segs.length; si++) {
		const s = hero.segs[si];
		if (held && s.b === 'elbowF') drawRifle();
		drawOval(hero.p[s.a], hero.p[s.b], s.ry, s.ext, s.c, s.helmet);
		if (s.a === 'pelvis' && s.b === 'chest' && Health.state.armor > 0) drawVest(s);
		if (s.a === 'pelvis' && s.b === 'chest' && hero.isMedic) drawMedicCross(s);
		drawWounds(si, s);
		drawBand(s, si);
		if (s.a === 'pelvis' && s.b === 'chest') {
			drawBelt();
			if (!held) drawSling();
		}
	}
	if (held) drawHands();
	if (hero.nadeW > 0.15 || hero.throwT > 0) drawHandGrenade();
	drawStumps();
	drawBandages();
	drawTransfusion();
}

// мягкая тень на земле под бойцом (растягивается, когда он лежит)
function drawShadow() {
	const P = hero.p;
	let x0 = 1e9, x1 = -1e9;
	for (const n in P) { x0 = Math.min(x0, P[n].x); x1 = Math.max(x1, P[n].x); }
	ctx.fillStyle = 'rgba(0,0,0,0.22)';
	ctx.beginPath();
	ctx.ellipse((x0 + x1) / 2, GROUND + 3, (x1 - x0) / 2 + 14, 5, 0, 0, Math.PI * 2);
	ctx.fill();
}
function drawMedicCross(seg) {
	const A = hero.p[seg.a], B = hero.p[seg.b];
	const x = lerp(A.x, B.x, 0.62), y = lerp(A.y, B.y, 0.62);
	ctx.fillStyle = '#e8e8dc';
	ctx.fillRect(x - 5, y - 5, 10, 10);
	ctx.lineWidth = 1;
	ctx.strokeStyle = '#15150f';
	ctx.strokeRect(x - 5, y - 5, 10, 10);
	ctx.fillStyle = '#c0392b';
	ctx.fillRect(x - 1.5, y - 4, 3, 8);
	ctx.fillRect(x - 4, y - 1.5, 8, 3);
}
function drawVest(seg) {
	const A = hero.p[seg.a], B = hero.p[seg.b];
	const cx = (A.x + B.x) / 2, cy = (A.y + B.y) / 2;
	const ang = Math.atan2(B.y - A.y, B.x - A.x);
	const rx = Math.hypot(B.x - A.x, B.y - A.y) / 2 + seg.ext;
	const wear = Math.round((1 - Health.state.armor / ARMOR_MAX) * 4) / 4;   // износ квантуется — кэш цветов не раздувается
	const col = hero.vestC || '#3f4a35';
	const g = ctx.createLinearGradient(cx, cy - seg.ry, cx, cy + seg.ry);
	g.addColorStop(0, shadeColor(col, 0.2 - wear * 0.2));
	g.addColorStop(1, shadeColor(col, -0.35 - wear * 0.15));
	ctx.beginPath();
	ctx.ellipse(cx, cy, rx * 0.78, seg.ry + 1.5, ang, 0, Math.PI * 2);
	ctx.fillStyle = g;
	ctx.fill();
	ctx.lineWidth = 1.8;
	ctx.strokeStyle = '#15150f';
	ctx.stroke();
	ctx.beginPath();                                          // броневая пластина
	ctx.ellipse(cx, cy, rx * 0.5, seg.ry * 0.6, ang, 0, Math.PI * 2);
	ctx.strokeStyle = 'rgba(255,255,230,0.22)';
	ctx.lineWidth = 1.2;
	ctx.stroke();
}
// ремень с пряжкой и подсумком на поясе
function drawBelt() {
	const P = hero.p, f = hero.f;
	let ux = P.chest.x - P.pelvis.x, uy = P.chest.y - P.pelvis.y;
	const l = Math.hypot(ux, uy) || 1;
	ux /= l; uy /= l;
	const nx = -uy * f, ny = ux * f;                           // сторона «вперёд»
	const bx = P.pelvis.x + ux * 7, by = P.pelvis.y + uy * 7;
	ctx.lineCap = 'butt';
	ctx.strokeStyle = '#2a2820';
	ctx.lineWidth = 5;
	ctx.beginPath();
	ctx.moveTo(bx - nx * 14, by - ny * 14);
	ctx.lineTo(bx + nx * 14, by + ny * 14);
	ctx.stroke();
	ctx.fillStyle = '#b8a14e';                                  // пряжка
	ctx.beginPath();
	ctx.arc(bx + nx * 3, by + ny * 3, 2.6, 0, Math.PI * 2);
	ctx.fill();
	ctx.save();                                                 // подсумок
	ctx.translate(bx + nx * 10 - ux * 2, by + ny * 10 - uy * 2);
	ctx.rotate(Math.atan2(uy, ux));
	ctx.fillStyle = '#3d3a2a';
	ctx.strokeStyle = '#15150f';
	ctx.lineWidth = 1.2;
	ctx.fillRect(-4, -3, 8, 6);
	ctx.strokeRect(-4, -3, 8, 6);
	ctx.restore();
}
function drawRifle() {
	const h = hero, P = h.p;
	const e = ease(h.gun);
	const c = P.chest, p = P.pelvis;
	let ux = c.x - p.x, uy = c.y - p.y;
	const ul = Math.hypot(ux, uy) || 1;
	ux /= ul; uy /= ul;
	const nx = uy * h.f, ny = -ux * h.f;
	const sx = lerp(p.x, c.x, 0.5) + nx * 20, sy = lerp(p.y, c.y, 0.5) + ny * 20;
	const sa = Math.atan2(uy, ux) + (STOW_MUZZLE_DOWN ? Math.PI + h.f * 0.45 : -h.f * 0.45);
	const x = lerp(sx, c.x, e), y = lerp(sy, c.y, e);
	const a = lerpAng(sa, h.aimA, e);
	const sc = lerp(0.85, 1, e);
	const pivot = lerp(31, 0, e);
	const kick = h.shootCD / (h.sniper ? SNIPER_CD : SHOOT_CD) * 3 * e;
	const heldFlip = Math.cos(h.aimA) < 0 ? -1 : 1;
	const stowFlip = (h.f < 0 ? -1 : 1) * (STOW_MUZZLE_DOWN ? -1 : 1);
	const flip = lerp(stowFlip, heldFlip, e);
	const cs = Math.cos(a), sn = Math.sin(a);
	let maxY = -1e9;
	for (const [lx, ly] of [[-18, 8], [-18, -6], [80, 3], [80, -3], [42, 22], [10, 16]]) {
		maxY = Math.max(maxY, y + sn * sc * (lx - pivot - kick) + cs * sc * flip * ly);
	}
	const lift = Math.max(0, maxY - (GROUND - 1));
	ctx.save();
	ctx.translate(x, y - lift);
	ctx.rotate(a);
	ctx.scale(sc, sc * flip);
	ctx.translate(-pivot - kick, 0);
	if (h.sniper) drawSniperRifle(); else drawAK();
	ctx.restore();
}
function drawSniperRifle() {
	ctx.lineWidth = 1.5;
	ctx.lineJoin = 'round';
	ctx.strokeStyle = '#111';
	const box = (x, y, w, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, hh); ctx.strokeRect(x, y, w, hh); };
	const poly = (pts, col) => {
		ctx.beginPath();
		ctx.moveTo(pts[0][0], pts[0][1]);
		for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
		ctx.closePath();
		ctx.fillStyle = col; ctx.fill(); ctx.stroke();
	};
	poly([[-20, -5], [-3, -3], [-3, 4], [-12, 9], [-20, 8]], '#4a3a24');   // приклад
	box(-3, -4, 44, 8, '#2b2d25');                                         // ствольная коробка
	box(38, -2, 20, 5, '#5a4128');                                         // цевьё
	box(56, -1.2, 52, 2.4, '#1c1c1c');                                     // длинный ствол
	box(104, -2.2, 6, 4.4, '#111');                                        // дульный тормоз
	box(10, -7, 3, 3, '#111'); box(24, -7, 3, 3, '#111');                  // кронштейны
	box(6, -12, 26, 5, '#15171a');                                         // оптический прицел
	box(3, -13.5, 5, 8, '#111'); box(30, -13.5, 5, 8, '#111');             // линзы
	if (!hero.magOut) poly([[9, 4], [17, 4], [15, 15], [8, 15]], '#2a2a22');                 // магазин
	ctx.beginPath();
	ctx.moveTo(18, 4.5); ctx.lineTo(18, 8); ctx.lineTo(25, 8); ctx.lineTo(25, 4.5);
	ctx.moveTo(52, 2); ctx.lineTo(48, 13); ctx.moveTo(52, 2); ctx.lineTo(58, 13);   // сошки
	ctx.stroke();
}
function drawAK() {
	ctx.lineWidth = 1.5;
	ctx.lineJoin = 'round';
	ctx.strokeStyle = '#111';
	const box = (x, y, w, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, hh); ctx.strokeRect(x, y, w, hh); };
	const poly = (pts, col) => {
		ctx.beginPath();
		ctx.moveTo(pts[0][0], pts[0][1]);
		for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
		ctx.closePath();
		ctx.fillStyle = col; ctx.fill(); ctx.stroke();
	};
	poly([[-18, -5], [-3, -3], [-3, 4], [-12, 8], [-18, 7]], '#6b4a2b');
	box(50, -1.5, 28, 3, '#1c1c1c');
	box(30, -5, 24, 3, '#2a2a22');
	box(30, -2, 22, 6, '#7a5632');
	if (!hero.magOut) {                                                     // магазин отсоединён — на его месте пусто
		ctx.beginPath();
		ctx.moveTo(26, 4); ctx.lineTo(34, 4);
		ctx.quadraticCurveTo(36, 14, 42, 20);
		ctx.lineTo(35, 22);
		ctx.quadraticCurveTo(28, 15, 26, 4);
		ctx.closePath();
		ctx.fillStyle = '#1f1f18'; ctx.fill(); ctx.stroke();
	}
	poly([[9, 4], [17, 4], [15, 16], [8, 16]], '#3a2a1a');
	box(-3, -4.5, 34, 9, '#34362c');
	box(2, -6, 26, 2, '#4a4c40');
	box(24, -8, 3, 2, '#111');
	poly([[64, -1.5], [64, -6], [67, -6], [67, -1.5]], '#111');
	box(76, -3, 4, 6, '#111');
	ctx.beginPath();
	ctx.moveTo(18, 4.5); ctx.lineTo(18, 8); ctx.lineTo(25, 8); ctx.lineTo(25, 4.5);
	ctx.stroke();
}
function drawSling() {
	const h = hero, P = h.p;
	const a = 1 - ease(h.gun);
	if (a <= 0.01) return;
	const c = P.chest, p = P.pelvis;
	let ux = c.x - p.x, uy = c.y - p.y;
	const ul = Math.hypot(ux, uy) || 1;
	ux /= ul; uy /= ul;
	const nx = uy * h.f, ny = -ux * h.f;
	ctx.save();
	ctx.globalAlpha = a;
	ctx.strokeStyle = '#2b2b20';
	ctx.lineWidth = 3;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(c.x + nx * 13 - ux * 2, c.y + ny * 13 - uy * 2);
	ctx.lineTo(p.x + ux * 12 - nx * 13, p.y + uy * 12 - ny * 13);
	ctx.stroke();
	ctx.restore();
}
function drawHands() {
	const h = hero;
	if (h.lie > 0.6 || h.bal < 0.6 || h.gun < 1) return;
	ctx.fillStyle = COLORS.skin;
	ctx.strokeStyle = '#111';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(h.p.wristF.x, h.p.wristF.y, 4.5, 0, Math.PI * 2);
	ctx.fill(); ctx.stroke();
}
// где на сегменте лежат раны части part (живые отметки + запомненные под бинтом)
function bandSpots(part, si) {
  const h = hero, out = [];
  if (h.wounds) for (const w of h.wounds) if (w.si === si && w.part === part && w.kind !== 'dent' && w.kind !== 'embed') out.push({ t: w.t, o: w.o * w.f });
  if (h.dress && h.dress[part]) for (const d of h.dress[part]) if (d.si === si) out.push({ t: d.t, o: d.o });
  return out;
}
function partHasSpots(part) {
  const h = hero;
  if (h.dress && h.dress[part] && h.dress[part].length) return true;
  return !!(h.wounds && h.wounds.some(w => w.part === part && w.kind !== 'dent' && w.kind !== 'embed'));
}
function drawBand(seg, si) {
  const part = partOfSeg(seg);
  if (!part) return;
  const wr = hero.wrap[part];
  if (!(wr > 0)) return;
  const u = wr / WRAP_T;
  const sk = hero.soak[part];
  let spots = bandSpots(part, si);
  if (!spots.length && BAND_OF[seg.a + '-' + seg.b] === part && !partHasSpots(part)) spots = [{ t: 0.5, o: 0 }];   // ран в памяти нет — бинт посередине кости
  if (!spots.length) return;
  const A = hero.p[seg.a], B = hero.p[seg.b];
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const ang = Math.atan2(dy, dx);
  const r = seg.ry + 1;
  const rx = len / 2 + seg.ext;                   // полуось овала сегмента вдоль кости
  const step = Math.min(4, len / 9);              // шаг между витками (на короткой голове меньше)
  const maxN = Math.max(2, Math.min(5, Math.round(len / 9)));   // голова — 3 слоя, торс — 5
  const n = Math.max(1, Math.ceil(u * maxN));     // слоёв бинта вокруг раны
  const halfW = a => r * Math.sqrt(Math.max(0.05, 1 - Math.min(0.95, Math.abs(a) / rx) ** 2));   // ширина овала в точке a от его центра
  const pr = Math.min(1, u * 3);                  // подушечка растёт в начале перевязки
  for (const s of spots) {
    const cx = A.x + dx * s.t, cy = A.y + dy * s.t;
    const off = s.o * hero.f * seg.ry;            // смещение раны в сторону от оси
    ctx.lineWidth = 3;
    for (let i = 0; i < n; i++) {
      const tt = Math.max(0.5 - rx * 0.8 / len, Math.min(0.5 + rx * 0.8 / len, s.t + (i - (n - 1) / 2) * step / len));
      const x = A.x + dx * tt, y = A.y + dy * tt;
      const hw = halfW((tt - 0.5) * len);
      const shade = i % 2 ? 0.88 : 1, k = sk * 0.5;
      ctx.strokeStyle = 'rgb(' + Math.round(lerp(241, 160, k) * shade) + ',' +
        Math.round(lerp(239, 18, k) * shade) + ',' + Math.round(lerp(228, 18, k) * shade) + ')';
      ctx.beginPath();
      ctx.moveTo(x + nx * hw - ux * 1.5, y + ny * hw - uy * 1.5);   // витки чуть наискосок
      ctx.lineTo(x - nx * hw + ux * 1.5, y - ny * hw + uy * 1.5);
      ctx.stroke();
    }
    if (pr > 0.3) {
      const px = cx + nx * off, py = cy + ny * off;
      ctx.fillStyle = '#f7f5ea';
      ctx.strokeStyle = 'rgba(70,70,50,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const pw = Math.min(5.5, rx * 0.4) * pr, ph = Math.min(3.8, seg.ry * 0.5) * pr;   // подушечка не больше части
      ctx.ellipse(px, py, pw, ph, ang, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (sk > 0.05) {                            // кровь проступает именно на ране
        ctx.fillStyle = 'rgba(150,10,10,' + Math.min(0.95, sk * 1.1).toFixed(2) + ')';
        ctx.beginPath();
        ctx.ellipse(px, py, Math.min(pw * 0.85, (1.2 + sk * 3.2) * pr), Math.min(ph * 0.85, (0.9 + sk * 2.4) * pr), ang, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (u >= 1) {                                 // свободный конец бинта чуть качается
      const tt = Math.max(0.5 - rx * 0.8 / len, Math.min(0.5 + rx * 0.8 / len, s.t + (n - 1) / 2 * step / len));
      const hw = halfW((tt - 0.5) * len);
      const x = A.x + dx * tt + nx * hw, y = A.y + dy * tt + ny * hw;
      const sway = Math.sin(Date.now() / 350 + s.t * 9) * 1.6;
      ctx.strokeStyle = '#e9e7d8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + sway, y + 5);
      ctx.stroke();
    }
  }
}
function drawBandRoll() {                                // моток в руке, лента между руками, перехват мотка
  const h = hero, P = h.p;
  const part = h.rollU >= 0;                             // идёт бинтование (себя или другого)
  const wu = part ? h.rollU : 0;
  const a = (h.wrapT || 0) * 0.3, sw = Math.sin(a);
  const holder = part && !h.rollArm && sw < 0 ? P.wristB : P.wristF;   // моток переходит из руки в руку
  const other = holder === P.wristF ? P.wristB : P.wristF;
  const r = 5 - 2.2 * wu;                                // моток уменьшается по мере перевязки
  if (part && wu < 0.94) {                               // натянутая лента: между руками (рана на своей руке — к ране)
    const tg = h.rollArm ? h.rollTg : other;
    ctx.strokeStyle = '#e9e7d8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(holder.x, holder.y);
    ctx.quadraticCurveTo((holder.x + tg.x) / 2, (holder.y + tg.y) / 2 + 4 + 3 * Math.abs(sw), tg.x, tg.y);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(holder.x, holder.y);
  ctx.fillStyle = '#e9e7d8';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.rotate(part ? a * 2.2 : 0);                        // раскручивается, пока бинтует
  ctx.strokeStyle = 'rgba(90,90,70,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0.3, Math.PI * 1.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.85, 0); ctx.stroke();
  ctx.restore();
}
function drawBandages() {
  if (hero.bandWant || hero.rollU >= 0) drawBandRoll();
  if (hero.bandaging) {
    const part = hero.bandPart;
    if (part) {
      const u = hero.wrap[part] / WRAP_T;
      const x = hero.p.head.x, y = hero.p.head.y - 34;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - 20, y, 40, 5);
      ctx.fillStyle = '#e8e6d8';
      ctx.fillRect(x - 20, y, 40 * u, 5);
    }
  }
}
function drawTransfusion() {
  const c = hero.box;
  if (!c) return;
  const a = { x: c.x + c.w / 2, y: GROUND - c.h - 5 };
  const b = hero.p.elbowB;
  const mid = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + 48 };
  ctx.strokeStyle = '#a01818';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(mid.x, mid.y, b.x, b.y);
  ctx.stroke();
  ctx.fillStyle = '#ff6a5a';
  const ph = (Date.now() / 500) % 1;
  for (let i = 0; i < 3; i++) {
    const u = (ph + i / 3) % 1, v = 1 - u;
    ctx.beginPath();
    ctx.arc(v * v * a.x + 2 * v * u * mid.x + u * u * b.x, v * v * a.y + 2 * v * u * mid.y + u * u * b.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
function drawArmorStation(c) {
  const x = c.x, y = GROUND - c.h, w = c.w, h = c.h;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#111';
  ctx.fillStyle = '#3d4630';                       // шкаф
  ctx.fillRect(x, y, w, h + 2);
  ctx.strokeRect(x, y, w, h + 2);
  ctx.fillStyle = '#6b6f5c';                       // верхняя планка с надписью
  ctx.fillRect(x - 3, y - 8, w + 6, 10);
  ctx.strokeRect(x - 3, y - 8, w + 6, 10);
  ctx.fillStyle = '#d8dcc8';
  ctx.font = 'bold 8px system-ui, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('БРОНЯ', x + w / 2, y);
  ctx.textAlign = 'left';
  const slot = (w - 8) / 5;
  for (let i = 0; i < 5; i++) {                    // 5 ячеек: полная — каска и жилет, пустая — тёмная
    const sx = x + 4 + i * slot;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(sx + 1, y + 6, slot - 2, h - 8);
    if (i >= c.left) continue;
    ctx.fillStyle = '#5a6b3f';                     // каска
    ctx.beginPath();
    ctx.ellipse(sx + slot / 2, y + 16, slot / 2 - 2, 7, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2c3524';                     // жилет
    ctx.fillRect(sx + 3, y + 20, slot - 6, h - 24);
    ctx.strokeRect(sx + 3, y + 20, slot - 6, h - 24);
  }
}
function drawMedkit(c) {
  const x = c.x, y = GROUND - c.h, w = c.w, h = c.h;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#111';
  ctx.fillStyle = c.left > 0 ? '#e4e4d8' : '#9a9a90';
  ctx.fillRect(x, y, w, h + 2);
  ctx.strokeRect(x, y, w, h + 2);
  ctx.fillStyle = '#6b6f5c';
  ctx.fillRect(x + w / 2 - 10, y - 5, 20, 5);
  ctx.strokeRect(x + w / 2 - 10, y - 5, 20, 5);
  ctx.fillStyle = c.left > 0 ? '#c0392b' : '#6f6f66';
  const cx = x + w / 2, cy = y + h / 2 + 1;
  ctx.fillRect(cx - 4, cy - 14, 8, 28);
  ctx.fillRect(cx - 14, cy - 4, 28, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x, y - 15, w, 5);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(x, y - 15, w * Math.max(0, c.left) / 30, 5);
}
function drawBullets() {
	ctx.strokeStyle = '#ffe4a0';
	ctx.lineWidth = 2;
	ctx.lineCap = 'round';
	for (const b of bullets) {
		ctx.strokeStyle = b.rc ? '#ffffff' : '#ffe4a0';     // отрикошетившая пуля светится белым
		ctx.lineWidth = b.sn ? 3 : 2;
		ctx.beginPath();
		ctx.moveTo(b.px, b.py);
		ctx.lineTo(b.x, b.y);
		ctx.stroke();
	}
	ctx.lineCap = 'butt';
}
function drawStrafe() {
	ctx.strokeStyle = '#ffe4a0';
	ctx.lineWidth = 1.5;
	ctx.lineCap = 'round';
	ctx.beginPath();
	for (const b of strafeShots) {
		if (!onScreen(b.x, 0)) continue;
		ctx.moveTo(b.px, b.py);
		ctx.lineTo(b.x, b.y);
	}
	ctx.stroke();
	ctx.lineCap = 'butt';
}
// раны на сегменте si: пятно, стекающая струйка, отверстие, влажный блик
// срезы на месте оторванных конечностей: рваный край, мясо и кость
function drawStumps() {
	if (!hero.stumps) return;
	for (const s of hero.stumps) {
		const q = hero.p[s.n];
		ctx.fillStyle = '#6e0c0c';
		ctx.beginPath(); ctx.arc(q.x, q.y, s.r, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = '#c42020';
		ctx.beginPath(); ctx.arc(q.x, q.y, s.r * 0.6, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = '#e8e0d0';
		ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.2, s.r * 0.25), 0, Math.PI * 2); ctx.fill();
	}
}
function drawWounds(si, seg) {
	const ws = hero.wounds;
	if (!ws || !ws.length) return;
	for (const w of ws) {
		if (w.si !== si) continue;
		const p = woundPos(hero, w);
		if (w.kind === 'dent') {                                   // след пули на каске
			ctx.fillStyle = 'rgba(20,20,15,0.8)';
			ctx.beginPath();
			ctx.arc(p.x, p.y, w.r, 0, Math.PI * 2);
			ctx.fill();
			ctx.strokeStyle = 'rgba(230,230,210,0.55)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.arc(p.x, p.y, w.r + 1.2, 0.3, 3.6);
			ctx.stroke();
			continue;
		}
		if (w.kind === 'embed') {                                  // крупный осколок торчит из раны
			const A = hero.p[seg.a], B = hero.p[seg.b];
			const a = Math.atan2(B.y - A.y, B.x - A.x) + w.ra;
			const ca = Math.cos(a), sa = Math.sin(a), L = w.sz, Wd = L * 0.35;
			ctx.globalAlpha = Math.min(1, w.ttl / 60);             // в последнюю секунду исчезает
			ctx.fillStyle = 'rgba(150,12,12,0.6)';                 // кровь вокруг
			ctx.beginPath();
			ctx.arc(p.x, p.y, w.stain, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#6b706c';
			ctx.strokeStyle = '#15180f';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(p.x, p.y);
			ctx.lineTo(p.x + ca * L * 0.5 - sa * Wd, p.y + sa * L * 0.5 + ca * Wd);
			ctx.lineTo(p.x + ca * L, p.y + sa * L);
			ctx.lineTo(p.x + ca * L * 0.7 + sa * Wd * 0.8, p.y + sa * L * 0.7 - ca * Wd * 0.8);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.strokeStyle = 'rgba(230,235,225,0.5)';             // блик на металле
			ctx.beginPath();
			ctx.moveTo(p.x + ca * L * 0.2, p.y + sa * L * 0.2);
			ctx.lineTo(p.x + ca * L * 0.85, p.y + sa * L * 0.85);
			ctx.stroke();
			ctx.fillStyle = '#1a0605';                             // тёмная точка входа у основания
			ctx.beginPath();
			ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			continue;
		}
		if (w.kind === 'burn' || w.kind === 'bruise') {            // ожог / гематома: без крови
			const A = hero.p[seg.a], B = hero.p[seg.b];
			const ang = Math.atan2(B.y - A.y, B.x - A.x), rr = w.r * (w.kind === 'burn' ? 3.2 : 3.8);
			ctx.fillStyle = w.kind === 'burn' ? 'rgba(190,70,30,0.35)' : 'rgba(95,60,120,0.5)';   // кайма
			ctx.beginPath();
			ctx.ellipse(p.x, p.y, rr, rr * 0.7, ang, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = w.kind === 'burn' ? 'rgba(25,18,12,0.75)' : 'rgba(60,70,130,0.4)';    // обугленный центр / синева
			ctx.beginPath();
			ctx.ellipse(p.x, p.y, rr * 0.6, rr * 0.4, ang, 0, Math.PI * 2);
			ctx.fill();
			continue;
		}
		const col = Math.round(lerp(75, 170, w.wet)) + ',12,12';   // свежая — ярко-красная, старая — тёмная
		if (w.drip > 1) {
			ctx.strokeStyle = 'rgba(' + col + ',0.75)';
			ctx.lineWidth = 1.8;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(p.x, p.y);
			ctx.lineTo(p.x + w.dx * w.drip * 0.3, Math.min(p.y + w.drip, GROUND - 1));
			ctx.stroke();
			ctx.lineCap = 'butt';
		}
		ctx.fillStyle = 'rgba(' + col + ',0.6)';
		ctx.beginPath();
		ctx.arc(p.x, p.y, w.stain, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#1a0605';
		ctx.beginPath();
		if (w.kind === 'tear') {
			const A = hero.p[seg.a], B = hero.p[seg.b];
			ctx.ellipse(p.x, p.y, w.r * 1.6, w.r * 0.9, Math.atan2(B.y - A.y, B.x - A.x), 0, Math.PI * 2);
		} else if (w.kind === 'slash' || w.kind === 'graze') {
			const A = hero.p[seg.a], B = hero.p[seg.b];
			const ang = Math.atan2(B.y - A.y, B.x - A.x) + (w.kind === 'slash' ? 0.9 + w.t * 2 : 0.25);   // порез идёт под углом к кости
			if (w.kind === 'graze') ctx.fillStyle = '#8a1a14';
			ctx.ellipse(p.x, p.y, w.r * (w.kind === 'slash' ? 3 : 2.4), w.r * (w.kind === 'slash' ? 0.5 : 0.4), ang, 0, Math.PI * 2);
		} else if (w.kind === 'frag') {
			for (let k = 0; k < 6; k++) {
				const a = k * Math.PI / 3 + w.t * 6, rr = w.r * (k % 2 ? 0.6 : 1.3);
				if (k === 0) ctx.moveTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
				else ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
			}
			ctx.closePath();
		} else {
			ctx.arc(p.x, p.y, w.r, 0, Math.PI * 2);
		}
		ctx.fill();
		if (w.wet > 0.4) {
			ctx.fillStyle = 'rgba(255,130,120,' + (0.4 * w.wet).toFixed(2) + ')';
			ctx.beginPath();
			ctx.arc(p.x - 0.6, p.y - 0.8, 1, 0, Math.PI * 2);
			ctx.fill();
		}
	}
}
function drawBloodPools() {
	for (const p of bloodPools) {
		if (!onScreen(p.x - p.r, p.r * 2)) continue;
		ctx.fillStyle = 'rgba(84,8,8,0.85)';
		ctx.beginPath();
		ctx.ellipse(p.x, GROUND + 3, p.r, p.r * 0.25, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = 'rgba(130,14,14,0.45)';
		ctx.beginPath();
		ctx.ellipse(p.x - p.r * 0.1, GROUND + 2.5, p.r * 0.6, p.r * 0.14, 0, 0, Math.PI * 2);
		ctx.fill();
	}
}
function drawHelmets() {
	for (const m of helmets) {
		if (!onScreen(m.x - 20, 40)) continue;
		ctx.save();
		ctx.translate(m.x, m.y);
		ctx.rotate(m.a);
		const g = ctx.createLinearGradient(0, -6, 0, 4);
		g.addColorStop(0, shadeColor(m.col, 0.3));
		g.addColorStop(1, shadeColor(m.col, -0.3));
		ctx.beginPath();
		ctx.ellipse(0, 4, 12, 10, 0, Math.PI, Math.PI * 2);        // купол
		ctx.closePath();
		ctx.fillStyle = g;
		ctx.fill();
		ctx.lineWidth = 1.8;
		ctx.strokeStyle = '#15150f';
		ctx.stroke();
		ctx.beginPath();                                            // блик
		ctx.ellipse(0, 4, 9, 7.5, 0, Math.PI * 1.15, Math.PI * 1.5);
		ctx.strokeStyle = 'rgba(255,255,230,0.35)';
		ctx.lineWidth = 1.4;
		ctx.stroke();
		ctx.restore();
	}
}
function drawBlood() {
	ctx.fillStyle = '#9a1414';
	ctx.beginPath();
	for (const d of blood) {
		ctx.moveTo(d.x + d.r, d.y);
		ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
	}
	ctx.fill();
}
function drawFlashes() {
	for (const f of flashes) {
		const u = f.life / f.max;
		ctx.globalAlpha = u;
		ctx.fillStyle = '#ffdd66';
		ctx.beginPath();
		ctx.arc(f.x, f.y, 4 + (1 - u) * 10, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#ffb84a';
		ctx.lineWidth = 3 * u;
		ctx.beginPath();
		ctx.moveTo(f.x, f.y);
		ctx.lineTo(f.x + Math.cos(f.a) * (16 + (1 - u) * 20), f.y + Math.sin(f.a) * (16 + (1 - u) * 20));
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
}
function drawHandGrenade() {
	const h = hero;
	if (h.thrown || h.lie > 0.6) return;
	const w = h.p.wristF;
	ctx.save();
	ctx.translate(w.x, w.y);
	ctx.rotate(0.3);
	ctx.fillStyle = '#4a5530';
	ctx.strokeStyle = '#111';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(0, -3, 6, 7.2, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#888';
	ctx.fillRect(-2, -13, 4, 4);
	ctx.restore();
	ctx.fillStyle = COLORS.skin;                           // пальцы поверх гранаты
	ctx.strokeStyle = '#111';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(w.x, w.y, 4.5, 0, Math.PI * 2);
	ctx.fill(); ctx.stroke();
}
function drawNadeAim() {                                   // пунктирная дуга и метка падения
	const h = hero;
	if (!h.nadeAim || h.nadeW < 0.3) return;
	const c = h.p.chest;
	const tg = nadeTarget(h);
	const a = Math.atan2(tg.y - c.y, tg.x - c.x);
	const sx = c.x + Math.cos(a) * 50, sy = c.y + Math.sin(a) * 50 - 10;   // примерно там, где кисть отпустит гранату
	const v = nadeLaunch(sx, sy, tg.x, tg.y);
	let x = sx, y = sy, vy = v.vy, n = 0;
	ctx.save();
	ctx.fillStyle = '#ffd27a';
	while (y < GROUND - 6 && n < 240) {                    // летим до земли
		vy += GRAVITY; x += v.vx; y += vy; n++;
		if (n % 3 === 0 && y < GROUND - 6) {
			ctx.globalAlpha = h.nadeW * Math.max(0.25, 0.85 - n / 160);
			ctx.beginPath();
			ctx.arc(x, y, 2, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	ctx.globalAlpha = 0.8 * h.nadeW;
	ctx.strokeStyle = '#ffd27a';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.ellipse(x, GROUND, 14, 4, 0, 0, Math.PI * 2);      // где граната упадёт
	ctx.stroke();
	ctx.restore();
}
function drawGrenades() {
  for (const g of grenades) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.a);
    ctx.fillStyle = '#4a5530';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, g.r, g.r * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#888';
    ctx.fillRect(-2, -g.r * 1.2 - 3, 4, 4);
    ctx.restore();
    const rate = g.fuse < 60 ? 4 : g.fuse < 120 ? 10 : 20;
    if (Math.floor(g.fuse / rate) % 2 === 0) {
      ctx.fillStyle = '#f33';
      ctx.beginPath();
      ctx.arc(g.x, g.y - g.r - 10, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
function drawShards() {
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const s of shards) {
    ctx.strokeStyle = s.life > 30 ? '#ffd27a' : '#555';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * 1.2, s.y - s.vy * 1.2);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}
function drawBigShards() {
  ctx.lineWidth = 1;
  for (const s of bigShards) {
    if (!onScreen(s.x - 20, 40)) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.a);
    ctx.fillStyle = s.life > 25 ? '#8a8f8a' : '#4a4d4a';
    ctx.strokeStyle = '#15180f';
    ctx.beginPath();
    ctx.moveTo(-s.sz * 0.5, -s.sz * 0.25);
    ctx.lineTo(s.sz * 0.6, 0);
    ctx.lineTo(-s.sz * 0.2, s.sz * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
function drawCraters() {
  ctx.fillStyle = '#232a17';
  for (const c of craters) {
    ctx.beginPath();
    ctx.ellipse(c.x, GROUND + 3, c.s, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
function drawRockets() {
  for (const r of rockets) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(Math.atan2(r.vy, r.vx));
    if (r.mega) {                                         // раскалённое свечение и увеличенный корпус
      const gl = ctx.createRadialGradient(0, 0, 4, 0, 0, 90);
      gl.addColorStop(0, 'rgba(255,230,160,0.9)');
      gl.addColorStop(0.4, 'rgba(255,120,40,0.45)');
      gl.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(-20, 0, 90, 0, Math.PI * 2); ctx.fill();
      ctx.scale(2.4, 2.4);
    }
    if (!(r.stuck > 0)) {                                 // воткнувшаяся ракета больше не горит
      ctx.fillStyle = '#ffb340';
      ctx.beginPath();
      ctx.moveTo(-16, -3);
      ctx.lineTo(-45 - Math.random() * 20, 0);
      ctx.lineTo(-16, 3);
      ctx.fill();
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111';
    ctx.fillStyle = '#6b6f5c';
    ctx.fillRect(-16, -4, 28, 8);
    ctx.strokeRect(-16, -4, 28, 8);
    ctx.fillStyle = '#8a2a20';
    ctx.beginPath();
    ctx.moveTo(12, -4); ctx.lineTo(22, 0); ctx.lineTo(12, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
function drawMegaFx() {
  for (const e of megaFx) {
    const t = e.t, gy = GROUND;
    if (t < 20) {                                         // световой столб в момент удара
      const a = 1 - t / 20;
      const beam = ctx.createLinearGradient(e.x - 40, 0, e.x + 40, 0);
      beam.addColorStop(0, 'rgba(255,240,200,0)');
      beam.addColorStop(0.5, 'rgba(255,250,235,' + (0.9 * a).toFixed(3) + ')');
      beam.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = beam;
      ctx.fillRect(e.x - 40, 0, 80, gy);
    }
    if (t < 50) {                                         // огненный шар
      const r = 60 + t * 8, a = 1 - t / 50, cy = gy - r * 0.55;
      const g = ctx.createRadialGradient(e.x, cy, 0, e.x, cy, r);
      g.addColorStop(0, 'rgba(255,252,225,' + a.toFixed(3) + ')');
      g.addColorStop(0.3, 'rgba(255,200,90,' + (0.9 * a).toFixed(3) + ')');
      g.addColorStop(0.7, 'rgba(255,90,30,' + (0.5 * a).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(60,30,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(e.x, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    if (t < 60) {                                         // ударная волна: купол по земле (≈ радиус поражения)
      const r = t * 17, a = 1 - t / 60;
      ctx.lineWidth = 8 * a + 1;
      ctx.strokeStyle = 'rgba(255,240,205,' + (0.7 * a).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(e.x, gy, r, Math.PI, 0); ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,170,80,' + (0.45 * a).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(e.x, gy, r * 0.8, Math.PI, 0); ctx.stroke();
    }
    if (t < 40) {                                         // раскалённая земля
      ctx.fillStyle = 'rgba(255,150,60,' + (0.5 * (1 - t / 40)).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(e.x, gy + 2, 40 + t * 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}
function drawDust() {
  for (const m of mags) {                                // упавшие магазины
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.a);
    ctx.scale(1, m.flip);
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111';
    ctx.fillStyle = m.sn ? '#2a2a22' : '#1f1f18';
    ctx.beginPath();
    if (m.sn) { ctx.moveTo(-3, -6); ctx.lineTo(5, -6); ctx.lineTo(3, 5); ctx.lineTo(-4, 5); }
    else { ctx.moveTo(-8, -9); ctx.lineTo(0, -9); ctx.quadraticCurveTo(2, 1, 8, 7); ctx.lineTo(1, 9); ctx.quadraticCurveTo(-6, 2, -8, -9); }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  for (const d of debris) {
    ctx.globalAlpha = Math.min(1, d.life / d.max * 2);
    ctx.fillStyle = d.c;
    ctx.fillRect(d.x - d.s / 2, d.y - d.s / 2, d.s, d.s);
  }
  for (const d of dust) {
    ctx.globalAlpha = d.a * (d.life / d.max);
    ctx.fillStyle = 'rgb(' + d.c + ')';
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  canvas.style.transform = shake > 0.3
    ? 'translate(' + ((Math.random() - 0.5) * shake * 2).toFixed(1) + 'px,' + ((Math.random() - 0.5) * shake * 2).toFixed(1) + 'px)'
    : '';
}
function drawSandbags(c) {
  for (let r = 0; r < 3; r++) bagRow(c.x + r * 10, GROUND + 2 - r * 14, c.w - r * 20, c.s + r * 50);
}
function drawBarrier(c) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#111';
  const bg = ctx.createLinearGradient(0, GROUND - c.h, 0, GROUND);
  bg.addColorStop(0, '#b9b9ae');
  bg.addColorStop(1, '#76766c');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(c.x, GROUND + 2);
  ctx.lineTo(c.x + 12, GROUND - c.h * 0.45);
  ctx.lineTo(c.x + 18, GROUND - c.h);
  ctx.lineTo(c.x + c.w - 18, GROUND - c.h);
  ctx.lineTo(c.x + c.w - 12, GROUND - c.h * 0.45);
  ctx.lineTo(c.x + c.w, GROUND + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // жёлто-чёрная предупреждающая полоса
  const y0 = GROUND - c.h + 8;
  ctx.save();
  ctx.beginPath();
  ctx.rect(c.x + 20, y0, c.w - 40, 7);
  ctx.clip();
  ctx.fillStyle = '#c99a2e';
  ctx.fillRect(c.x + 20, y0, c.w - 40, 7);
  ctx.fillStyle = '#1f1f1a';
  for (let sx = c.x + 14; sx < c.x + c.w - 10; sx += 14) {
    ctx.beginPath();
    ctx.moveTo(sx, y0 + 7); ctx.lineTo(sx + 7, y0 + 7); ctx.lineTo(sx + 14, y0); ctx.lineTo(sx + 7, y0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // трещина
  const kx = c.x + c.w * 0.35;
  ctx.strokeStyle = 'rgba(30,30,25,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(kx, y0 + 12); ctx.lineTo(kx + 5, GROUND - c.h * 0.6); ctx.lineTo(kx - 3, GROUND - c.h * 0.35);
  ctx.stroke();
}
function drawCar(c) {
  const x = c.x, w = c.w, t = GROUND - c.h;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#111';
  ctx.fillStyle = '#5f5240';
  ctx.beginPath();
  ctx.moveTo(x, GROUND - 10);
  ctx.lineTo(x, GROUND - 36);
  ctx.lineTo(x + 40, GROUND - 40);
  ctx.lineTo(x + 62, t);
  ctx.lineTo(x + w - 60, t);
  ctx.lineTo(x + w - 36, GROUND - 40);
  ctx.lineTo(x + w, GROUND - 34);
  ctx.lineTo(x + w, GROUND - 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1e2420';
  ctx.beginPath();
  ctx.moveTo(x + 70, GROUND - 42); ctx.lineTo(x + 78, t + 7);
  ctx.lineTo(x + w / 2 - 4, t + 7); ctx.lineTo(x + w / 2 - 4, GROUND - 42);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w / 2 + 4, GROUND - 42); ctx.lineTo(x + w / 2 + 4, t + 7);
  ctx.lineTo(x + w - 78, t + 7); ctx.lineTo(x + w - 70, GROUND - 42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.35, GROUND - 28, 40, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const wx of [x + 38, x + w - 38]) {
    ctx.fillStyle = '#1b1b17';
    ctx.beginPath(); ctx.arc(wx, GROUND - 14, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(wx, GROUND - 14, 6, 0, Math.PI * 2); ctx.fill();
  }
}
function drawTrenchBack(c) {
  ctx.fillStyle = '#463a28';
  ctx.beginPath();
  ctx.moveTo(c.x - 30, GROUND + 2);
  ctx.lineTo(c.x - 6, GROUND - c.h - 14);
  ctx.lineTo(c.x + c.w + 6, GROUND - c.h - 14);
  ctx.lineTo(c.x + c.w + 30, GROUND + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6b5535';
  for (let px = c.x + 20; px < c.x + c.w - 10; px += 64) ctx.fillRect(px, GROUND - c.h - 12, 6, c.h + 14);
}
function drawTrenchFront(c) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#111';
  ctx.fillStyle = '#5a4a30';
  ctx.beginPath();
  ctx.moveTo(c.x - 24, GROUND + 3);
  ctx.lineTo(c.x, GROUND - c.h + 12);
  ctx.lineTo(c.x + c.w, GROUND - c.h + 12);
  ctx.lineTo(c.x + c.w + 24, GROUND + 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  bagRow(c.x - 6, GROUND - c.h + 17, c.w + 12, c.s);
}
function drawWire(c) {
  ctx.strokeStyle = '#23231d';
  ctx.lineWidth = 3;
  for (let x = c.x; x <= c.x + c.w + 1; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, GROUND + 2); ctx.lineTo(x, GROUND - c.h); ctx.stroke();
  }
  ctx.lineWidth = 1.5;
  for (const yy of [14, 26]) {
    ctx.beginPath();
    for (let x = c.x; x <= c.x + c.w; x += 3) {
      const y = GROUND - yy + Math.sin(x * 0.9) * 4;
      if (x === c.x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
function drawBase() {
  const x0 = FINISH_X - 130, t = GROUND - 120;
  if (!onScreen(x0 - 30, 340)) return;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#111';
  ctx.fillStyle = '#6f7266';
  ctx.beginPath();
  ctx.moveTo(x0, GROUND + 2);
  ctx.lineTo(x0 + 20, t + 20);
  ctx.lineTo(x0 + 50, t);
  ctx.lineTo(x0 + 230, t);
  ctx.lineTo(x0 + 260, t + 20);
  ctx.lineTo(x0 + 280, GROUND + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#14160f';
  ctx.fillRect(x0 + 90, GROUND - 76, 100, 78);
  ctx.fillStyle = '#222';
  ctx.fillRect(x0 + 215, t - 80, 4, 80);
  ctx.fillStyle = '#6aa84f';
  ctx.fillRect(x0 + 219, t - 80, 50, 26);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, Arial, sans-serif';
  ctx.fillText('БАЗА', x0 + 227, t - 62);
}
function drawWorldBack() {
  for (const c of props) {
    if (!onScreen(c.x - 30, c.w + 60)) continue;
    if (c.type === 'trench') drawTrenchBack(c);
    else if (c.type === 'wire') drawWire(c);
    else if (c.type === 'medkit') drawMedkit(c);
    else if (c.type === 'armor') drawArmorStation(c);
    else if (c.type === 'house') drawHouseBack(c);
  }
  drawBase();
}
function drawWorldFront() {
  for (const c of props) {
    if (!onScreen(c.x - 30, c.w + 60)) continue;
    if (c.type === 'trench') drawTrenchFront(c);
    else if (c.type === 'sandbags') drawSandbags(c);
    else if (c.type === 'barrier') drawBarrier(c);
    else if (c.type === 'house') drawHouseRoof(c);
  }
}
let skyT = 0;   // время для медленного дрейфа облаков и дыма
// дом в разрезе: интерьер и стены сзади (бойцы заходят внутрь), крыша — поверх
function drawHouseBack(c) {
  const top = GROUND - c.h + 36;
  const wall = HOUSE_WALL;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#111';
  const bg = ctx.createLinearGradient(0, top, 0, GROUND);
  bg.addColorStop(0, '#4a4338');
  bg.addColorStop(1, '#2e2a22');
  ctx.fillStyle = bg;
  ctx.fillRect(c.x, top, c.w, GROUND - top + 2);
  ctx.strokeRect(c.x, top, c.w, GROUND - top + 2);
  const wx = c.x + c.w / 2 - 22, wy = top + 40;            // окно на задней стене
  ctx.fillStyle = '#9fb6c2';
  ctx.fillRect(wx, wy, 44, 40);
  ctx.strokeRect(wx, wy, 44, 40);
  ctx.beginPath();
  ctx.moveTo(wx + 22, wy); ctx.lineTo(wx + 22, wy + 40);
  ctx.moveTo(wx, wy + 20); ctx.lineTo(wx + 44, wy + 20);
  ctx.stroke();
  const wy0 = GROUND - HOUSE_WIN_HI, wy1 = GROUND - HOUSE_WIN_LO;   // верх и низ окна
  ctx.fillStyle = '#7c5c48';                                // боковые стены с окнами
  for (const x of [c.x, c.x + c.w - wall]) {
    for (const [ya, yb] of [[top, wy0], [wy1, GROUND + 2]]) {
      ctx.fillRect(x, ya, wall, yb - ya);
      ctx.strokeRect(x, ya, wall, yb - ya);
    }
    ctx.fillStyle = '#a88a6c';                              // подоконник
    ctx.fillRect(x - 2, wy1 - 1, wall + 4, 5);
    ctx.strokeRect(x - 2, wy1 - 1, wall + 4, 5);
    ctx.fillStyle = '#7c5c48';
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';                     // кирпичная кладка
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = top + 14; y < GROUND; y += 14) {
    if (y > wy0 - 2 && y < wy1 + 6) continue;
    for (const x of [c.x, c.x + c.w - wall]) { ctx.moveTo(x, y); ctx.lineTo(x + wall, y); }
  }
  ctx.stroke();
  // койка: рама на ножках и зелёный матрас
  const bx = c.x + c.w / 2;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#111';
  ctx.fillStyle = '#4a3622';
  for (const lx of [bx - COT_LEN / 2, bx + COT_LEN / 2 - 6]) {
    ctx.fillRect(lx, GROUND - 14, 6, 16);
    ctx.strokeRect(lx, GROUND - 14, 6, 16);
  }
  ctx.fillStyle = '#6b7a4a';
  ctx.fillRect(bx - COT_LEN / 2 - 4, GROUND - 14, COT_LEN + 8, 7);
  ctx.strokeRect(bx - COT_LEN / 2 - 4, GROUND - 14, COT_LEN + 8, 7);
}
function drawHouseRoof(c) {
  const apex = GROUND - c.h, eave = apex + 36;
  const x0 = c.x - 12, x1 = c.x + c.w + 12, mx = c.x + c.w / 2;
  const g = ctx.createLinearGradient(0, apex, 0, eave);
  g.addColorStop(0, '#7a4a38');
  g.addColorStop(1, '#4e2f24');
  ctx.beginPath();
  ctx.moveTo(x0, eave);
  ctx.lineTo(mx, apex);
  ctx.lineTo(x1, eave);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#111';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';                      // ряды черепицы
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const t of [0.3, 0.55, 0.8]) {
    const y = apex + (eave - apex) * t, half = (x1 - x0) / 2 * t;
    ctx.moveTo(mx - half, y); ctx.lineTo(mx + half, y);
  }
  ctx.stroke();
}
// небо: градиент к горизонту, солнце в дымке, облака
function drawSky() {
  skyT++;
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, '#4d5b6a');
  g.addColorStop(0.55, '#8d9486');
  g.addColorStop(1, '#d1c29a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const sx = W * 0.72 - camX * 0.01, sy = GROUND * 0.42;      // тусклое солнце сквозь дым
  const sg = ctx.createRadialGradient(sx, sy, 6, sx, sy, 280);
  sg.addColorStop(0, 'rgba(255,240,195,0.95)');
  sg.addColorStop(0.08, 'rgba(255,228,170,0.6)');
  sg.addColorStop(0.35, 'rgba(255,215,150,0.18)');
  sg.addColorStop(1, 'rgba(255,215,150,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, GROUND);

  const f = 0.06, cell = 380;                                 // облака: медленный параллакс
  const i0 = Math.floor((camX * f + skyT * 0.15) / cell) - 1, i1 = Math.floor((camX * f + skyT * 0.15 + W) / cell) + 1;
  for (let i = i0; i <= i1; i++) {
    const r = hash(i * 2.3 + worldSeed);
    if (r < 0.35) continue;
    const bx = i * cell - camX * f - skyT * 0.15 + hash(i * 4.1 + worldSeed) * 140;
    const by = 40 + hash(i * 6.7 + worldSeed) * GROUND * 0.35;
    ctx.fillStyle = 'rgba(214,208,190,' + (0.14 + r * 0.14).toFixed(3) + ')';
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      ctx.ellipse(bx + j * 46, by + Math.sin(j * 1.7) * 8, 70 - j * 8, 16 + r * 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// гряда холмов с параллаксом
function ridge(f, lift, a1, a2, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  for (let x = 0; x <= W + 20; x += 20) {
    const wx = x + camX * f;
    ctx.lineTo(x, GROUND - lift - Math.sin(wx * 0.004 + f * 20) * a1 - Math.sin(wx * 0.011) * a2);
  }
  ctx.lineTo(W + 20, GROUND);
  ctx.closePath();
  ctx.fill();
}

// далёкие дымные столбы от пожарищ
function drawSmokeColumns() {
  const f = 0.12, cell = 700;
  const i0 = Math.floor(camX * f / cell) - 1, i1 = Math.floor((camX * f + W) / cell) + 1;
  for (let i = i0; i <= i1; i++) {
    if (hash(i * 5.3 + worldSeed) < 0.55) continue;
    const bx = i * cell - camX * f + hash(i * 2.1 + worldSeed) * 300;
    for (let j = 0; j < 9; j++) {
      const sway = Math.sin(skyT * 0.02 + j * 0.8 + i) * (6 + j * 3);
      ctx.fillStyle = 'rgba(60,60,52,' + (0.3 * (1 - j / 10)).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(bx + sway + j * 4, GROUND - 90 - j * 34, 14 + j * 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// голые обгоревшие деревья
function drawDeadTrees() {
  const f = 0.28, cell = 380;
  const i0 = Math.floor(camX * f / cell) - 1, i1 = Math.floor((camX * f + W) / cell) + 1;
  ctx.strokeStyle = '#4a5240';
  ctx.lineCap = 'round';
  for (let i = i0; i <= i1; i++) {
    if (hash(i * 7.7 + worldSeed) < 0.5) continue;
    const x = i * cell - camX * f + hash(i * 3.1 + worldSeed) * 120;
    const h = 70 + hash(i * 1.9 + worldSeed) * 60;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, GROUND - 6);
    ctx.lineTo(x + (hash(i + worldSeed) - 0.5) * 12, GROUND - h);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    for (let j = 0; j < 4; j++) {
      const t = 0.35 + j * 0.17, side = j % 2 ? 1 : -1;
      const by = GROUND - 6 - (h - 6) * t, len = 22 - j * 3;
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.lineTo(x + side * len, by - len * 0.6);
      ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';
}

function drawBackdrop() {
  ridge(0.06, 120, 46, 18, '#9aa08c');                         // самые дальние холмы в дымке
  drawSmokeColumns();
  ridge(0.15, 70, 30, 14, '#7a8266');
  drawDeadTrees();

  const f = 0.4, cell = 240;                                   // разрушенные дома
  const i0 = Math.floor(camX * f / cell) - 1, i1 = Math.floor((camX * f + W) / cell) + 1;
  for (let i = i0; i <= i1; i++) {
    const r = hash(i * 3.7 + worldSeed);
    if (r < 0.4) continue;                                     // между домами пустыри
    const bw = 70 + r * 80, bh = 90 + hash(i + worldSeed) * 130;
    const bx = i * cell - camX * f + hash(i * 1.3 + worldSeed) * 60;
    const bg = ctx.createLinearGradient(0, GROUND - bh, 0, GROUND);
    bg.addColorStop(0, '#6a7362');
    bg.addColorStop(1, '#4b5345');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(bx, GROUND);
    ctx.lineTo(bx, GROUND - bh);
    for (let j = 1; j <= 4; j++) ctx.lineTo(bx + bw * j / 4, GROUND - bh + hash(i * 9 + j + worldSeed) * 40); // рваный верх
    ctx.lineTo(bx + bw, GROUND);
    ctx.closePath();
    ctx.fill();
    for (let wy = GROUND - bh + 50, k = 0; wy < GROUND - 30; wy += 46, k++) {   // окна: в одном из десяти горит свет
      const lit = hash(i * 13 + k * 5 + worldSeed) > 0.9;
      ctx.fillStyle = lit ? 'rgba(235,185,90,0.75)' : '#353c30';
      ctx.fillRect(bx + 12, wy, 14, 20);
      ctx.fillStyle = '#353c30';
      ctx.fillRect(bx + bw - 28, wy, 14, 20);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(bx + 12, wy, 14, 4);
      ctx.fillRect(bx + bw - 28, wy, 14, 4);
    }
    ctx.fillStyle = '#3e4538';                                 // груда обломков у основания
    ctx.beginPath();
    ctx.moveTo(bx - 14, GROUND);
    ctx.lineTo(bx + 6, GROUND - 12 - r * 10);
    ctx.lineTo(bx + 22, GROUND - 6);
    ctx.lineTo(bx + 36, GROUND);
    ctx.closePath();
    ctx.fill();
  }

  const hz = ctx.createLinearGradient(0, GROUND - 190, 0, GROUND);   // дымка у горизонта
  hz.addColorStop(0, 'rgba(205,195,150,0)');
  hz.addColorStop(1, 'rgba(205,195,150,0.32)');
  ctx.fillStyle = hz;
  ctx.fillRect(0, GROUND - 190, W, 190);
}
function drawGroundDetails() {
  const rg = ctx.createLinearGradient(0, GROUND + 6, 0, GROUND + 26);   // дорога
  rg.addColorStop(0, '#5f5a42');
  rg.addColorStop(1, '#3d3a28');
  ctx.fillStyle = rg;
  ctx.fillRect(camX, GROUND + 6, W, 20);
  ctx.fillStyle = 'rgba(255,245,200,0.12)';
  ctx.fillRect(camX, GROUND + 6, W, 2);
  ctx.fillStyle = '#2f2c1e';
  ctx.fillRect(camX, GROUND + 10, W, 3);
  ctx.fillRect(camX, GROUND + 20, W, 3);
  ctx.strokeStyle = 'rgba(30,28,18,0.55)';                              // трещины в асфальте
  ctx.lineWidth = 1.2;
  for (let i = Math.floor(camX / 160) - 1; i <= Math.floor((camX + W) / 160) + 1; i++) {
    if (hash(i * 8.3 + worldSeed) < 0.55) continue;
    const x = i * 160 + hash(i * 1.7 + worldSeed) * 120;
    ctx.beginPath();
    ctx.moveTo(x, GROUND + 7);
    ctx.lineTo(x + 8, GROUND + 14);
    ctx.lineTo(x + 3, GROUND + 19);
    ctx.lineTo(x + 14, GROUND + 25);
    ctx.stroke();
  }

  const i0 = Math.floor(camX / 40) - 1, i1 = Math.floor((camX + W) / 40) + 1;
  for (let i = i0; i <= i1; i++) {
    const r = hash(i + worldSeed), x = i * 40 + r * 30;
    if (r < 0.12) {
      ctx.fillStyle = '#2f3a3d';
      ctx.beginPath();
      ctx.ellipse(x, GROUND + 16, 16 + r * 60, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (r < 0.4) {
      ctx.fillStyle = '#6b6a5e';
      ctx.beginPath();
      ctx.ellipse(x, GROUND + 30 + hash(i * 2 + worldSeed) * 45, 2 + r * 8, 2 + r * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (r < 0.7) {
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let j = -2; j <= 2; j++) {                                    // пучок травы: кривые стебли двух оттенков
        const hh = 7 + hash(i * 5 + j + worldSeed) * 7;
        ctx.strokeStyle = j % 2 ? '#6b7c3a' : '#4f5e2b';
        ctx.beginPath();
        ctx.moveTo(x + j * 3, GROUND + 1);
        ctx.quadraticCurveTo(x + j * 4, GROUND - hh * 0.5, x + j * 6 + 3, GROUND - hh);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
  }
  for (let m = 1000; m < FINISH_X; m += 1000) {
    if (!onScreen(m - 30, 60)) continue;
    ctx.fillStyle = '#2a2a22';
    ctx.fillRect(m, GROUND - 40, 3, 42);
    ctx.fillStyle = '#c9c4a0';
    ctx.fillRect(m - 20, GROUND - 56, 44, 18);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 11px system-ui, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round((FINISH_X - m) / 10) + ' м', m + 2, GROUND - 43);
    ctx.textAlign = 'left';
  }
}
function bagRow(x, y, w, seed) {
  const n = Math.max(1, Math.round(w / 30)), step = w / n;
  for (let i = 0; i < n; i++) {
    const base = hash(seed + i) < 0.5 ? '#8c7c55' : '#7d6f4b';
    const bx = x + step * (i + 0.5), by = y - 8, rx = step * 0.58;
    const g = ctx.createLinearGradient(0, by - 8.5, 0, by + 8.5);
    g.addColorStop(0, shadeColor(base, 0.25));
    g.addColorStop(1, shadeColor(base, -0.3));
    ctx.fillStyle = g;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#2d2818';
    ctx.beginPath();
    ctx.ellipse(bx, by, rx, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(45,40,24,0.55)';                   // шов мешка
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - rx * 0.5, by - 1);
    ctx.quadraticCurveTo(bx, by + 3, bx + rx * 0.5, by - 1);
    ctx.stroke();
  }
}
// мини-карта пути: отряд, враги, база, ракеты в полёте, зона ракет и участок обстрела
function drawMinimap() {
  const m = hudProg.mini, g = hudProg.mctx;
  const w = m.clientWidth || 400;
  if (m.width !== w) m.width = w;
  const h = m.height, padX = 12, yb = 28;
  const mx = x => padX + Math.max(0, Math.min(1, (x - START_X) / (FINISH_X - START_X))) * (w - padX * 2);
  const hx = hero.p.pelvis.x;
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,90,60,0.10)';                                  // где могут падать ракеты
  g.fillRect(mx(hx - ROCKET_RANGE), 4, mx(hx + ROCKET_RANGE) - mx(hx - ROCKET_RANGE), h - 8);
  g.lineCap = 'round';
  g.strokeStyle = '#5d6e3b'; g.lineWidth = 3;                            // дорога до базы
  g.beginPath(); g.moveTo(mx(START_X), yb); g.lineTo(mx(FINISH_X), yb); g.stroke();
  g.strokeStyle = 'rgba(216,220,200,0.35)'; g.lineWidth = 1;
  for (let x = START_X; x <= FINISH_X; x += 2500) { g.beginPath(); g.moveTo(mx(x), yb - 4); g.lineTo(mx(x), yb + 4); g.stroke(); }
  g.strokeStyle = 'rgba(216,220,200,0.55)';                              // что сейчас видно на экране
  g.strokeRect(mx(camX), 9, Math.max(3, mx(camX + W) - mx(camX)), h - 18);
  const bx = mx(FINISH_X);                                               // база
  g.strokeStyle = '#b6e36a'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(bx, yb); g.lineTo(bx, 8); g.stroke();
  g.fillStyle = '#b6e36a';
  g.beginPath(); g.moveTo(bx, 8); g.lineTo(bx - 9, 12); g.lineTo(bx, 16); g.fill();
  if (plane) {                                                           // участок, который простреливает самолёт
    const a = mx(plane.x), b = mx(plane.end);
    g.fillStyle = 'rgba(255,90,60,0.35)';
    g.fillRect(Math.min(a, b), 4, Math.abs(b - a) || 2, h - 8);
    g.fillStyle = '#ff6a4a';
    g.beginPath(); g.moveTo(a + plane.dir * 7, 14); g.lineTo(a - plane.dir * 3, 9); g.lineTo(a - plane.dir * 3, 19); g.fill();
  }
  const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 90);
  for (const r of rockets) {                                             // куда упадёт ракета в полёте
    const tx = r.x + r.vx * Math.max(0, GROUND - r.y) / r.vy;
    const R = r.R || ROCKET_R, rx = mx(tx);
    g.fillStyle = r.mega ? 'rgba(255,122,217,0.22)' : 'rgba(255,150,60,0.22)';
    g.fillRect(mx(tx - R), 4, Math.max(2, mx(tx + R) - mx(tx - R)), h - 8);
    g.globalAlpha = pulse;
    g.fillStyle = r.mega ? '#ff7ad9' : '#ffa040';
    g.beginPath(); g.moveTo(rx, yb - 8); g.lineTo(rx + 5, yb); g.lineTo(rx, yb + 8); g.lineTo(rx - 5, yb); g.closePath(); g.fill();
    g.globalAlpha = 1;
  }
  squad.forEach((a, i) => {                                              // отряд: зелёные, медики голубые, погибшие — крестик
    const x = mx(a.hero.p.pelvis.x), y = yb + ((i % 3) - 1) * 5;
    if (a.health.state.dead) {
      g.strokeStyle = '#777'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x - 2, y - 2); g.lineTo(x + 2, y + 2); g.moveTo(x + 2, y - 2); g.lineTo(x - 2, y + 2); g.stroke();
      return;
    }
    g.fillStyle = a.isMedic ? '#8fd3ff' : '#9bbf5a';
    g.beginPath(); g.arc(x, y, 2.8, 0, Math.PI * 2); g.fill();
  });
  foes.forEach((e, i) => {                                               // враги — красные
    if (e.health.state.dead) return;
    if (e.gunner) {                                                      // пулемётчик в доме — квадрат с дулом в сторону окна
      const gx = mx(e.hero.p.pelvis.x), gy = yb + 9;
      const pulse = e.firing ? 0.6 + 0.4 * Math.sin(Date.now() / 90) : 1;  // стреляет — мигает
      g.globalAlpha = pulse;
      g.fillStyle = e.firing ? '#ff7a3a' : '#a85a3a';
      g.fillRect(gx - 3, gy - 3, 6, 6);
      g.strokeStyle = '#10130a'; g.lineWidth = 1;
      g.strokeRect(gx - 3, gy - 3, 6, 6);
      g.strokeStyle = g.fillStyle; g.lineWidth = 2;
      g.beginPath(); g.moveTo(gx + e.side * 3, gy); g.lineTo(gx + e.side * 8, gy); g.stroke();
      g.globalAlpha = 1;
      return;
    }
    g.fillStyle = '#e0523f';
    g.beginPath(); g.arc(mx(e.hero.p.pelvis.x), yb + ((i % 3) - 1) * 5, 2.4, 0, Math.PI * 2); g.fill();
  });
  const me = mx(hx);                                                     // игрок — белый маркер
  g.fillStyle = '#fff'; g.strokeStyle = '#10130a'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(me, yb - 3); g.lineTo(me - 5, yb - 13); g.lineTo(me + 5, yb - 13); g.closePath(); g.fill(); g.stroke();
}
let hudProg = null;
function drawHud() {
  if (!hudProg) {
    const root = document.createElement('div');
    root.id = 'mapbox';
    const label = document.createElement('div');
    label.id = 'mapLabel';
    const mini = document.createElement('canvas');
    mini.id = 'minimap';
    mini.height = 44;
    root.appendChild(label); root.appendChild(mini);
    const end = document.createElement('div');
    end.id = 'endscreen';
    end.innerHTML = '<div class="es-title"></div><div class="es-sub"></div><div class="es-hint"><kbd>Enter</kbd> начать заново</div>';
    document.body.appendChild(root);
    document.body.appendChild(end);
    hudProg = { label, mini, mctx: mini.getContext('2d'), end, title: end.querySelector('.es-title'), sub: end.querySelector('.es-sub'), endKey: '' };
  }
  drawMinimap();
  const left = Math.max(0, Math.round((FINISH_X - hero.p.pelvis.x) / 10));
  const alive = squad.filter(a => !a.health.state.dead).length;
  hudProg.label.textContent = (won ? 'Вы на базе' : 'До базы: ' + left + ' м') + ' · бойцов в строю: ' + alive + '/' + squad.length;
  const dead = playerHealth.state.dead;
  const endKey = dead ? 'dead' : won ? 'win' : '';
  if (endKey !== hudProg.endKey) {                         // карточку обновляем только при смене состояния
    hudProg.endKey = endKey;
    hudProg.end.className = endKey;
    if (dead) {
      const done = Math.round(Math.max(0, hero.p.pelvis.x - START_X) / 10), total = Math.round((FINISH_X - START_X) / 10);
      hudProg.title.textContent = 'ПОГИБ';
      hudProg.sub.textContent = 'Пройдено ' + done + ' м из ' + total + ' м';
    } else if (won) {
      hudProg.title.textContent = 'ЗАДАНИЕ ВЫПОЛНЕНО';
      hudProg.sub.textContent = 'Вы добрались до базы · бойцов в строю: ' + alive + '/' + squad.length;
    }
  }
}
function drawGrade() {
  ctx.fillStyle = 'rgba(255,200,120,0.05)';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.8);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,12,6,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
// мелкие позывные над головами живых бойцов отряда
function drawCallsigns() {
	ctx.save();
	ctx.font = '600 10px Consolas, "Courier New", monospace';
	ctx.textAlign = 'center';
	for (const a of squad) {
		if (!a.call || a.health.state.dead) continue;
		const hd = a.hero.p.head;
		if (!onScreen(hd.x - 40, 80)) continue;
		ctx.fillStyle = 'rgba(0,0,0,0.55)';
		ctx.fillText(a.call, hd.x + 1, hd.y - 29);
		ctx.fillStyle = a.personal ? '#8fd3ff' : 'rgba(238,242,220,0.75)';
		ctx.fillText(a.call, hd.x, hd.y - 30);
	}
	ctx.restore();
}
// радиосообщение над головой игрока: «АЛЬФА — 200», печатается по букве, в начале — помехи
function drawCallouts() {
	if (!callouts.length) return;
	const hd = hero.p.head;
	ctx.save();
	ctx.font = '700 20px Consolas, "Courier New", monospace';
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'left';
	if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
	let row = 0;
	for (let i = callouts.length - 1; i >= 0; i--) {
		const c = callouts[i];
		if (c.t < 0) continue;                                    // ещё ждёт своей очереди в эфире
		const shown = Math.min(c.txt.length, Math.floor(c.t / CALL_TYPE) + 1);
		const fullW = ctx.measureText(c.txt).width;
		const jit = c.t < 10 ? (Math.random() - 0.5) * 5 : 0;      // помехи в начале передачи
		const x0 = hd.x - fullW / 2 + jit;
		const y = hd.y - 66 - row * 34 - c.t * 0.04;               // медленно уплывает вверх
		ctx.globalAlpha = Math.max(0, Math.min(1, (CALL_LIFE - c.t) / 40, c.t / 6 + 0.2));
		ctx.fillStyle = 'rgba(12,14,8,0.72)';
		ctx.fillRect(x0 - 12, y - 16, fullW + 24, 32);
		ctx.fillStyle = '#e0523f';
		ctx.fillRect(x0 - 12, y - 16, 3, 32);
		ctx.fillStyle = '#eef2dc';
		ctx.fillText(c.txt.slice(0, Math.min(shown, c.name.length)), x0, y + 1);
		if (shown > c.name.length) {                               // «— 200» красным
			ctx.fillStyle = '#ff4a3a';
			ctx.fillText(c.txt.slice(c.name.length, shown), x0 + ctx.measureText(c.name).width, y + 1);
		}
		row++;
	}
	if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
	ctx.restore();
}
function render() {
  drawSky();
  drawBackdrop();
  const gg = ctx.createLinearGradient(0, GROUND, 0, H);               // земля: светлее у горизонта, темнее к низу
  gg.addColorStop(0, '#566033');
  gg.addColorStop(0.4, '#3a4126');
  gg.addColorStop(1, '#232814');
  ctx.fillStyle = gg;
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#7a8450';
  ctx.fillRect(0, GROUND, W, 2);
  ctx.fillStyle = '#2a301b';
  ctx.fillRect(0, GROUND + 2, W, 3);
  ctx.save();
  ctx.translate(-camX, 0);
  drawGroundDetails();
  drawBloodPools();
  drawWorldBack();
  for (const a of squad) runAs(a, drawUnit);
  for (const e of foes) runAs(e, drawUnit);
  drawUnit();
  drawWorldFront();
  for (const e of effects) {
    const r = e.t * 6 * (e.s || 1);
    const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
    grad.addColorStop(0, 'rgba(255,248,215,0.95)');
    grad.addColorStop(0.25, 'rgba(255,205,95,0.85)');
    grad.addColorStop(0.6, 'rgba(255,110,40,0.5)');
    grad.addColorStop(1, 'rgba(60,40,30,0)');
    ctx.globalAlpha = 1 - e.t / 30;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (e.t < 22) {                                   // ударная волна: расходящееся кольцо
      ctx.strokeStyle = 'rgba(255,235,190,' + (0.55 * (1 - e.t / 22)).toFixed(3) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 1.25, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
	drawCraters();
	drawGrenades();
	drawNadeAim();
	drawShards();
	drawBigShards();
	drawBullets();
	drawStrafe();
	drawBlood();
	drawHelmets();
	drawFlashes();
	drawRockets();
	drawMegaFx();
	drawDust();
	drawCallsigns();
	drawCallouts();
  ctx.restore();
  drawGrade();
  if (megaFlash > 0) { ctx.fillStyle = 'rgba(255,250,235,' + megaFlash.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  drawHud();
  Health.draw(ctx, W, H);
}