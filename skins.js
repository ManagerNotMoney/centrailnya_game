'use strict';
// ===== Скины оружия =====
// Подключается после looks.js, до render.js и main.js.
// Новый скин АК: 1) палитра в AK_SKINS, 2) рисунок в drawAKDeco (по полю deco),
// 3) название в SKIN_SNAME и цвет подсветки в SKIN_ACC, 4) кнопка в index.html (data-akskin)
// и образец цвета в style.css (.skin-card[data-akskin="..."] .sk-sw).

const AK_SKINS = {
	default: { stock: '#6b4a2b', wood: '#7a5632', body: '#34362c', cover: '#4a4c40', mag: '#3a2a1a', mag2: '#1f1f18', muzzle: '#111', accent: null, deco: null },
	snow: { stock: '#d8e0e6', wood: '#c4d0d8', body: '#aeb9c2', cover: '#e8eef2', mag: '#8d9aa6', mag2: '#6f7c88', muzzle: '#4d6a8a', accent: '#4f86c6', deco: 'snow' },
	dragon: { stock: '#5a1a16', wood: '#8a1f1a', body: '#1f1a1a', cover: '#3a2220', mag: '#6a1512', mag2: '#4a0f0d', muzzle: '#d9a441', accent: '#d9a441', deco: 'dragon' },
	ninja: { stock: '#16161a', wood: '#1d1d22', body: '#0e0e11', cover: '#1c1c21', mag: '#141418', mag2: '#0b0b0d', muzzle: '#2a2a30', accent: '#8a8fa8', deco: 'ninja' },
	death: { stock: '#cfc8b4', wood: '#b8b09a', body: '#1a1a1a', cover: '#2c2c2c', mag: '#2a2a28', mag2: '#1c1c1a', muzzle: '#e8e2d0', accent: '#e8e2d0', deco: 'death' }
};
// подписи и цвет подсветки витрины в меню «Скины»
const SKIN_WNAME = { ak: 'АК', sniper: 'Снайперка', mg: 'Пулемёт' };
const SKIN_SNAME = { default: 'Стандарт', snow: 'Снежная Буря', dragon: 'Красный Дракон', ninja: 'Ниндзя', death: 'Смерть', forest: 'Лесной Дух' };
const SKIN_ACC = { default: 'var(--win)', snow: '#4f86c6', dragon: '#d6402f', ninja: '#7d83a8', death: '#d8d2bc', forest: '#6bd45a' };

const SKIN_FIELD = { ak: 'akSkin', sniper: 'sniperSkin', mg: 'mgSkin' };		// где в облике хранится скин каждого оружия
// map: стандартный цвет детали → цвет скина (ключи — цвета из drawSniperRifleBase / drawMGBase)
const SNIPER_SKINS = {
	default: { map: {}, accent: null, deco: null },
	snow: { map: { '#4a3a24': '#d8e0e6', '#2b2d25': '#aeb9c2', '#5a4128': '#c4d0d8', '#1c1c1c': '#7d8c99', '#111': '#4d6a8a', '#15171a': '#e8eef2', '#2a2a22': '#6f7c88' }, accent: '#4f86c6', deco: 'snow' },
	dragon: { map: { '#4a3a24': '#5a1a16', '#2b2d25': '#1f1a1a', '#5a4128': '#8a1f1a', '#1c1c1c': '#2a1a18', '#111': '#d9a441', '#15171a': '#3a2220', '#2a2a22': '#4a0f0d' }, accent: '#d9a441', deco: 'dragon' },
	ninja: { map: { '#4a3a24': '#16161a', '#2b2d25': '#0e0e11', '#5a4128': '#1d1d22', '#1c1c1c': '#0b0b0d', '#111': '#2a2a30', '#15171a': '#0a0a0e', '#2a2a22': '#0b0b0d' }, accent: '#8a8fa8', deco: 'ninja' },
	death: { map: { '#4a3a24': '#cfc8b4', '#2b2d25': '#1a1a1a', '#5a4128': '#b8b09a', '#1c1c1c': '#2c2c2c', '#111': '#e8e2d0', '#15171a': '#2c2c2c', '#2a2a22': '#1c1c1a' }, accent: '#e8e2d0', deco: 'death' }
};
const MG_SKINS = {
	default: { map: {}, accent: null, deco: null },
	snow: { map: { '#4d3a22': '#d8e0e6', '#2c2e26': '#aeb9c2', '#3a3c32': '#e8eef2', '#34362c': '#c4d0d8', '#1c1c1c': '#7d8c99', '#111': '#4d6a8a', '#2a1c10': '#8d9aa6', '#4a4d3a': '#8d9aa6', '#33352a': '#6f7c88', '#c9a24a': '#bfe0ff' }, accent: '#4f86c6', deco: 'snow' },
	dragon: { map: { '#4d3a22': '#5a1a16', '#2c2e26': '#1f1a1a', '#3a3c32': '#3a2220', '#34362c': '#8a1f1a', '#1c1c1c': '#2a1a18', '#111': '#d9a441', '#2a1c10': '#4a0f0d', '#4a4d3a': '#6a1512', '#33352a': '#4a0f0d' }, accent: '#d9a441', deco: 'dragon' },
	ninja: { map: { '#4d3a22': '#16161a', '#2c2e26': '#0e0e11', '#3a3c32': '#1c1c21', '#34362c': '#141418', '#1c1c1c': '#0b0b0d', '#111': '#2a2a30', '#2a1c10': '#0b0b0d', '#4a4d3a': '#141418', '#33352a': '#0b0b0d', '#c9a24a': '#8a8fa8' }, accent: '#8a8fa8', deco: 'ninja' },
	death: { map: { '#4d3a22': '#cfc8b4', '#2c2e26': '#1a1a1a', '#3a3c32': '#2c2c2c', '#34362c': '#b8b09a', '#1c1c1c': '#2c2c2c', '#111': '#e8e2d0', '#2a1c10': '#2a2a28', '#4a4d3a': '#2a2a28', '#33352a': '#1c1c1a', '#c9a24a': '#e8e2d0' }, accent: '#e8e2d0', deco: 'death' }
};
AK_SKINS.forest = { stock: '#2f5a2a', wood: '#3f7a35', body: '#1c2e1a', cover: '#2d4a28', mag: '#2a4a24', mag2: '#173018', muzzle: '#1a2a18', accent: '#6bd45a', deco: 'forest' };
SNIPER_SKINS.forest = { map: { '#4a3a24': '#2f5a2a', '#2b2d25': '#1c2e1a', '#5a4128': '#3f7a35', '#1c1c1c': '#14221a', '#111': '#1a2a18', '#15171a': '#12241a', '#2a2a22': '#173018' }, accent: '#6bd45a', deco: 'forest' };
MG_SKINS.forest = { map: { '#4d3a22': '#2f5a2a', '#2c2e26': '#1c2e1a', '#3a3c32': '#2d4a28', '#34362c': '#3a6a30', '#1c1c1c': '#14221a', '#111': '#1a2a18', '#2a1c10': '#173018', '#4a4d3a': '#2a4a24', '#33352a': '#173018', '#c9a24a': '#b6f06a' }, accent: '#6bd45a', deco: 'forest' };
const WEAPON_SKINS = { ak: AK_SKINS, sniper: SNIPER_SKINS, mg: MG_SKINS };
function skinOf(h, w) {													// скин оружия w у бойца h
	const t = WEAPON_SKINS[w];
	return t[(h.look && h.look[SKIN_FIELD[w]]) || 'default'] || t.default;
}
function magColor(h) {													// цвет магазина (в руке и упавшего) под скин текущего оружия
	const w = h.mg ? 'mg' : h.sniper ? 'sniper' : 'ak';
	const sk = skinOf(h, w);
	if (w === 'ak') return sk.mag2;
	const d = w === 'mg' ? '#4a4d3a' : '#2a2a22';
	return sk.map[d] || d;
}
function withSkinMap(map, fn) {											// на время fn подменяет цвета заливки по таблице map
	const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), 'fillStyle');
	Object.defineProperty(ctx, 'fillStyle', {
		configurable: true,
		get() { return d.get.call(this); },
		set(v) { d.set.call(this, map[v] || v); }
	});
	try { fn(); } finally { delete ctx.fillStyle; }
}

// ===== новые узоры (общие для АК, снайперки и пулемёта) =====
// L — разметка оружия: коробка (rx, ry), приклад (stx, sty, sb — низ, cdx — шнур), цевьё (hx, hy)
const DC_LAYOUT = {
	ak: { rx0: -3, rx1: 31, ry0: -4.5, ry1: 4.5, stx: -10, sty: 1, sb: 7, cdx: -14, hx0: 31, hx1: 52, hy0: -2, hy1: 4, stk: [[-18, -5], [-3, -3], [-3, 4], [-12, 8], [-18, 7]] },
	sniper: { rx0: -3, rx1: 41, ry0: -4, ry1: 4, stx: -11, sty: 1.5, sb: 8, cdx: -15, hx0: 40, hx1: 57, hy0: -2, hy1: 3, stk: [[-20, -5], [-3, -3], [-3, 4], [-12, 9], [-20, 8]] },
	mg: { rx0: -3, rx1: 43, ry0: -5, ry1: 5, stx: -13, sty: 1, sb: 8, cdx: -16, hx0: 41, hx1: 69, hy0: -4.5, hy1: 4.5, stk: [[-22, -5], [-3, -4], [-3, 5], [-10, 10], [-22, 8]] }
};
function dcGloss(L, rgb, a) {											// блик вдоль верха коробки
	const g = ctx.createLinearGradient(L.rx0, 0, L.rx1, 0);
	g.addColorStop(0, 'rgba(' + rgb + ',0)'); g.addColorStop(0.4, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
	ctx.fillStyle = g;
	ctx.fillRect(L.rx0 + 0.8, L.ry0 + 0.7, L.rx1 - L.rx0 - 1.6, 1.1);
}
// --- снег ---
function dcFlake(x, y, r, col) {										// снежинка с боковыми лучиками и свечением
	const arms = () => {
		ctx.beginPath();
		for (let i = 0; i < 6; i++) {
			const a = i * Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a);
			ctx.moveTo(0, 0); ctx.lineTo(ca * r, sa * r);
			for (const t of [0.5, 0.75]) {
				const bx = ca * r * t, by = sa * r * t, bl = r * (t === 0.5 ? 0.38 : 0.26);
				ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + 0.9) * bl, by + Math.sin(a + 0.9) * bl);
				ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - 0.9) * bl, by + Math.sin(a - 0.9) * bl);
			}
		}
		ctx.stroke();
	};
	ctx.save();
	ctx.translate(x, y); ctx.lineCap = 'round';
	ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.globalAlpha = 0.45; arms();
	ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.globalAlpha = 1; arms();
	ctx.restore();
}
function dcIcicles(x0, x1, y, n, len) {									// сосульки
	ctx.save();
	ctx.fillStyle = 'rgba(205,232,255,0.92)'; ctx.strokeStyle = 'rgba(79,134,198,0.9)'; ctx.lineWidth = 0.6;
	for (let i = 0; i < n; i++) {
		const x = x0 + (x1 - x0) * (n === 1 ? 0.5 : i / (n - 1)), l = len * (0.55 + 0.45 * ((i * 37) % 5) / 4);
		ctx.beginPath(); ctx.moveTo(x - 1.4, y); ctx.lineTo(x + 1.4, y); ctx.lineTo(x, y + l); ctx.closePath(); ctx.fill(); ctx.stroke();
	}
	ctx.restore();
}
function dcSparkle(x, y, s) {											// блестящая искорка
	ctx.save();
	ctx.fillStyle = '#fff';
	ctx.beginPath();
	ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s);
	ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s);
	ctx.fill();
	ctx.restore();
}
// --- дракон ---
function dcScales(x0, y0, w, h, col) {									// чешуя
	ctx.save();
	ctx.strokeStyle = col; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.85;
	for (let r = 0; r * 2.6 < h; r++) {
		for (let x = x0 + (r % 2) * 1.8; x < x0 + w; x += 3.6) {
			ctx.beginPath(); ctx.arc(x, y0 + r * 2.6, 1.8, 0, Math.PI); ctx.stroke();
		}
	}
	ctx.restore();
}
function dcDragon(x0, x1, yc, amp, gold) {								// тело дракона с гребнем, рогом и глазом
	const N = 28, pts = [];
	for (let i = 0; i <= N; i++) {
		const t = i / N;
		pts.push([x0 + (x1 - x0) * t, yc + Math.sin(t * Math.PI * 2.2) * amp * (1 - 0.3 * t)]);
	}
	ctx.save();
	ctx.lineCap = 'round'; ctx.lineJoin = 'round';
	for (const pass of [0, 1]) {										// 0 — тёмный контур, 1 — золото
		for (let i = 1; i <= N; i++) {
			const w = 2.8 - 1.6 * (i / N);
			ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]);
			ctx.lineWidth = pass ? w : w + 1.3;
			ctx.strokeStyle = pass ? gold : '#2a0a08';
			ctx.stroke();
		}
	}
	ctx.fillStyle = '#ffe9a8';											// гребень
	for (let i = 2; i < N - 2; i += 3) {
		const p = pts[i], q = pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
		const nx = dy / l, ny = -dx / l;
		ctx.beginPath(); ctx.moveTo(p[0] - dx, p[1] - dy); ctx.lineTo(p[0] + nx * 2.4, p[1] + ny * 2.4); ctx.lineTo(p[0] + dx * 1.2, p[1] + dy * 1.2); ctx.closePath(); ctx.fill();
	}
	const h = pts[N];
	ctx.translate(h[0], h[1]);											// голова
	ctx.fillStyle = gold; ctx.strokeStyle = '#2a0a08'; ctx.lineWidth = 0.8;
	ctx.beginPath(); ctx.moveTo(-1, -3); ctx.lineTo(4.5, -1.4); ctx.lineTo(6.5, -0.4); ctx.lineTo(4.5, 0.8); ctx.lineTo(5.5, 2); ctx.lineTo(0, 2.6); ctx.lineTo(-1.5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
	ctx.fillStyle = '#ffe9a8';
	ctx.beginPath(); ctx.moveTo(-0.5, -2.6); ctx.lineTo(-3.5, -5); ctx.lineTo(1.8, -2); ctx.closePath(); ctx.fill();	// рог
	ctx.fillStyle = '#ff3b2e'; ctx.shadowColor = '#ff6a2e'; ctx.shadowBlur = 4;
	ctx.beginPath(); ctx.arc(1.8, -0.6, 0.9, 0, Math.PI * 2); ctx.fill();	// светящийся глаз
	ctx.restore();
}
function dcFlames(x0, x1, y, n, h) {									// языки пламени, растут вверх от низа цевья
	ctx.save();
	for (let i = 0; i < n; i++) {
		const x = x0 + (x1 - x0) * (i + 0.5) / n, hh = h * (0.7 + 0.3 * ((i * 53) % 3) / 2), w = (x1 - x0) / n * 0.55;
		for (const [c, k] of [['#d6402f', 1], ['#ff9a2e', 0.68], ['#ffe27a', 0.38]]) {
			ctx.fillStyle = c;
			ctx.beginPath();
			ctx.moveTo(x - w * k, y);
			ctx.quadraticCurveTo(x - w * k * 0.9, y - hh * k * 0.5, x + (i % 2 ? 1 : -1) * w * 0.3, y - hh * k);
			ctx.quadraticCurveTo(x + w * k * 0.9, y - hh * k * 0.4, x + w * k, y);
			ctx.closePath(); ctx.fill();
		}
	}
	ctx.restore();
}
// --- ниндзя ---
function dcShuriken(x, y, r, col) {										// сюрикен с двухцветными гранями
	ctx.save();
	ctx.translate(x, y); ctx.rotate(Math.PI / 8);
	for (let i = 0; i < 4; i++) {
		ctx.save(); ctx.rotate(i * Math.PI / 2);
		ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.28, -r * 0.28); ctx.lineTo(r, 0); ctx.closePath();
		ctx.fillStyle = col; ctx.fill();
		ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.28, r * 0.28); ctx.lineTo(r, 0); ctx.closePath();
		ctx.fillStyle = '#4a4e66'; ctx.fill();
		ctx.restore();
	}
	ctx.beginPath();													// контур звезды
	for (let i = 0; i < 4; i++) {
		const a = i * Math.PI / 2;
		ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
		ctx.lineTo(Math.cos(a + Math.PI / 4) * r * 0.4, Math.sin(a + Math.PI / 4) * r * 0.4);
	}
	ctx.closePath();
	ctx.strokeStyle = '#05050a'; ctx.lineWidth = 0.7; ctx.stroke();
	ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);			// отверстие
	ctx.fillStyle = '#05050a'; ctx.fill();
	ctx.restore();
}
function dcWrap(x, y, w, h, col) {										// оплётка ромбиком
	ctx.save();
	ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
	ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.8;
	ctx.beginPath();
	for (let i = -h; i < w + h; i += 3.4) { ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); ctx.moveTo(x + i + h, y); ctx.lineTo(x + i, y + h); }
	ctx.stroke();
	ctx.restore();
}
function dcMoon(x, y, r, col) {											// полумесяц
	ctx.save();
	ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
	ctx.beginPath(); ctx.rect(x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2); ctx.arc(x + r * 0.45, y - r * 0.1, r * 0.82, 0, Math.PI * 2);
	ctx.fillStyle = col; ctx.fill('evenodd');
	ctx.restore();
}
function dcCord(x, y) {													// красный шнур с кисточкой под прикладом
	ctx.save();
	ctx.strokeStyle = '#b3262e'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
	ctx.beginPath(); ctx.moveTo(x, y - 1.5); ctx.quadraticCurveTo(x + 2, y + 1.5, x + 0.5, y + 3.2); ctx.stroke();
	ctx.fillStyle = '#b3262e'; ctx.strokeStyle = '#05050a'; ctx.lineWidth = 0.6;
	ctx.beginPath(); ctx.moveTo(x - 1.3, y + 3.2); ctx.lineTo(x + 2.3, y + 3.2); ctx.lineTo(x + 3.2, y + 8); ctx.lineTo(x - 2.2, y + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
	ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.5;
	ctx.beginPath(); ctx.moveTo(x - 0.3, y + 4); ctx.lineTo(x - 0.7, y + 7.6); ctx.moveTo(x + 1.3, y + 4); ctx.lineTo(x + 1.5, y + 7.6); ctx.stroke();
	ctx.restore();
}
// --- смерть ---
function dcSkull(x, y, r, bone) {										// череп с бликом, трещиной и зелёными глазами
	ctx.save();
	ctx.translate(x, y);
	ctx.strokeStyle = '#0b0b0b'; ctx.lineWidth = 0.7; ctx.fillStyle = bone;
	ctx.beginPath(); ctx.rect(-r * 0.55, r * 0.55, r * 1.1, r * 0.9); ctx.fill(); ctx.stroke();	// челюсть
	ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();					// череп
	ctx.fillStyle = 'rgba(255,255,255,0.55)';
	ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.55, r * 0.3, r * 0.16, -0.5, 0, Math.PI * 2); ctx.fill();	// блик
	for (const s of [-1, 1]) {											// глазницы
		ctx.fillStyle = '#0b0b0b';
		ctx.beginPath(); ctx.arc(s * r * 0.4, -r * 0.05, r * 0.3, 0, Math.PI * 2); ctx.fill();
	}
	ctx.save();
	ctx.fillStyle = '#7dff6a'; ctx.shadowColor = '#7dff6a'; ctx.shadowBlur = 4;
	for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.4, -r * 0.05, r * 0.13, 0, Math.PI * 2); ctx.fill(); }
	ctx.restore();
	ctx.fillStyle = '#0b0b0b';
	ctx.beginPath(); ctx.moveTo(0, r * 0.2); ctx.lineTo(-r * 0.12, r * 0.5); ctx.lineTo(r * 0.12, r * 0.5); ctx.closePath(); ctx.fill();	// нос
	ctx.strokeStyle = '#0b0b0b'; ctx.lineWidth = 0.6;
	ctx.beginPath();
	for (const t of [-0.25, 0, 0.25]) { ctx.moveTo(r * t, r * 0.6); ctx.lineTo(r * t, r * 1.42); }	// зубы
	ctx.stroke();
	ctx.beginPath(); ctx.moveTo(r * 0.2, -r); ctx.lineTo(r * 0.05, -r * 0.7); ctx.lineTo(r * 0.28, -r * 0.5); ctx.stroke();	// трещина
	ctx.restore();
}
function dcBones(x, y, len, bone) {										// скрещённые кости
	const h = len * 0.45;
	ctx.save();
	ctx.translate(x, y); ctx.lineCap = 'round';
	for (const [c, w] of [['#0b0b0b', 2.8], [bone, 1.5]]) {
		ctx.strokeStyle = c; ctx.lineWidth = w;
		ctx.beginPath(); ctx.moveTo(-len, -h); ctx.lineTo(len, h); ctx.moveTo(len, -h); ctx.lineTo(-len, h); ctx.stroke();
	}
	ctx.fillStyle = bone; ctx.strokeStyle = '#0b0b0b'; ctx.lineWidth = 0.6;
	for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
		ctx.beginPath(); ctx.arc(sx * len, sy * h, 1.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
	}
	ctx.restore();
}
function dcSpine(x0, x1, y, bone) {										// позвоночник
	ctx.save();
	ctx.strokeStyle = '#0b0b0b'; ctx.lineWidth = 0.6; ctx.fillStyle = bone;
	for (let x = x0; x < x1; x += 4.2) {
		ctx.beginPath(); ctx.ellipse(x, y, 1.7, 1.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
	}
	ctx.restore();
}
function dcRibs(x0, x1, y0, y1) {										// рёбра
	ctx.save();
	ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
	ctx.beginPath();
	for (let x = x0 + 1; x < x1 - 1; x += 3.2) { ctx.moveTo(x, y0 + 0.9); ctx.quadraticCurveTo(x + 2.2, (y0 + y1) / 2, x, y1 - 0.9); }
	ctx.stroke();
	ctx.restore();
}
// --- лес ---
function dcLeaf(x, y, len, ang, fill, vein) {							// лист с прожилками
	ctx.save();
	ctx.translate(x, y); ctx.rotate(ang);
	ctx.beginPath();
	ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.45, -len * 0.5, len, 0); ctx.quadraticCurveTo(len * 0.45, len * 0.5, 0, 0);
	ctx.closePath();
	ctx.fillStyle = fill; ctx.fill();
	ctx.strokeStyle = '#0b1a0c'; ctx.lineWidth = 0.6; ctx.stroke();
	ctx.strokeStyle = vein; ctx.lineWidth = 0.55;
	ctx.beginPath();
	ctx.moveTo(0, 0); ctx.lineTo(len * 0.92, 0);
	for (const t of [0.3, 0.55, 0.75]) {
		ctx.moveTo(len * t, 0); ctx.lineTo(len * (t + 0.14), -len * 0.2);
		ctx.moveTo(len * t, 0); ctx.lineTo(len * (t + 0.14), len * 0.2);
	}
	ctx.stroke();
	ctx.restore();
}
function dcVine(x0, x1, y, amp, vine, leaf, ls) {						// лоза с листьями
	const yy = x => y + Math.sin((x - x0) * 0.55) * amp;
	ctx.save();
	ctx.lineCap = 'round'; ctx.lineJoin = 'round';
	ctx.beginPath();
	for (let x = x0; x <= x1; x += 1) x === x0 ? ctx.moveTo(x, yy(x)) : ctx.lineTo(x, yy(x));
	ctx.strokeStyle = '#0b1a0c'; ctx.lineWidth = 2; ctx.stroke();
	ctx.strokeStyle = vine; ctx.lineWidth = 1; ctx.stroke();
	let s = 1;
	for (let x = x0 + 2; x < x1 - 1; x += 4.2) { dcLeaf(x, yy(x), ls, s * 0.95, leaf, '#1c3a1a'); s = -s; }
	ctx.restore();
}
function dcEmblem(x, y, r) {											// светящийся клеверный знак
	ctx.save();
	ctx.translate(x, y);
	ctx.shadowColor = '#7dff6a'; ctx.shadowBlur = 5;
	ctx.strokeStyle = '#7dff6a'; ctx.lineWidth = 0.9; ctx.fillStyle = 'rgba(20,50,20,0.75)';
	ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
	ctx.shadowBlur = 0;
	for (let i = 0; i < 4; i++) dcLeaf(0, 0, r * 0.82, i * Math.PI / 2 + Math.PI / 4, '#5fbf4e', '#1c3a1a');
	ctx.fillStyle = '#b6f06a';
	ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2); ctx.fill();
	ctx.restore();
}
function dcFirefly(x, y, r) {											// светлячок
	ctx.save();
	ctx.shadowColor = '#b6ff6a'; ctx.shadowBlur = 6;
	ctx.fillStyle = '#e4ff9a';
	ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
	ctx.restore();
}
function dcForest(sk, L) {
	const rw = L.rx1 - L.rx0, rh = L.ry1 - L.ry0, cx = (L.rx0 + L.rx1) / 2, cy = (L.ry0 + L.ry1) / 2;
	ctx.save();
	ctx.save();															// коробка
	ctx.beginPath(); ctx.rect(L.rx0, L.ry0, rw, rh); ctx.clip();
	dcGloss(L, '210,255,190', 0.45);
	ctx.fillStyle = 'rgba(125,210,90,0.35)'; ctx.fillRect(L.rx0, L.ry0, rw, 1.8);		// мох сверху
	dcVine(L.rx0, L.rx1, L.ry1 - 2.6, 1.1, '#5fbf4e', '#7fe05f', 2.4);
	dcEmblem(cx, cy - 0.4, rh * 0.4);
	dcFirefly(L.rx1 - 4, L.ry0 + 2.6, 1);
	ctx.restore();
	ctx.save();															// приклад: листья только внутри контура
	ctx.beginPath();
	L.stk.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
	ctx.closePath(); ctx.clip();
	dcLeaf(L.stx - 7, L.sty + 3, 5, -0.7, '#4fae3e', '#b6f06a');
	dcLeaf(L.stx - 2, L.sty - 2.6, 4.6, 0.5, '#5fbf4e', '#b6f06a');
	dcLeaf(L.stx + 1, L.sty + 2.4, 4, -0.3, '#4fae3e', '#b6f06a');
	ctx.restore();
	ctx.save();															// цевьё
	ctx.beginPath(); ctx.rect(L.hx0, L.hy0, L.hx1 - L.hx0, L.hy1 - L.hy0); ctx.clip();
	dcVine(L.hx0, L.hx1, (L.hy0 + L.hy1) / 2 + 0.3, 0.9, '#5fbf4e', '#7fe05f', 1.8);
	dcFirefly(L.hx0 + 5, L.hy0 + 1.2, 1.1);
	dcFirefly(L.hx1 - 6, L.hy1 - 1.2, 1);
	ctx.restore();
	ctx.restore();
}
// --- сборка узора под скин и оружие ---
function drawSkinDeco(sk, L) {
	if (sk.deco === 'forest') { dcForest(sk, L); return; }
	if (!sk.deco) return;
	const rw = L.rx1 - L.rx0, rh = L.ry1 - L.ry0, cx = (L.rx0 + L.rx1) / 2, cy = (L.ry0 + L.ry1) / 2;
	ctx.save();
	if (sk.deco === 'snow') {											// «Снежная Буря»
		const g = ctx.createLinearGradient(0, L.ry0, 0, L.ry1);
		g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(0.5, 'rgba(210,235,255,0.22)'); g.addColorStop(1, 'rgba(79,134,198,0.4)');
		ctx.fillStyle = g; ctx.fillRect(L.rx0, L.ry0, rw, rh);			// морозный налёт
		ctx.fillStyle = sk.accent; ctx.fillRect(L.rx0, L.ry1 - 2.4, rw, 1.7);	// ледяная полоса
		ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(L.rx0, L.ry1 - 2.4, rw, 0.55);
		ctx.fillStyle = 'rgba(210,235,255,0.55)'; ctx.fillRect(L.hx0, L.hy0, L.hx1 - L.hx0, 1.4);	// иней на цевье
		ctx.fillStyle = 'rgba(235,245,255,0.6)'; ctx.fillRect(L.stx - 7, L.sty - 4.2, 11, 1.5);		// иней на прикладе
		dcGloss(L, '255,255,255', 0.5);
		ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(79,134,198,0.7)'; ctx.lineWidth = 0.6;
		for (let i = 0; i < 4; i++) {									// снежные шапки на коробке
			const x = L.rx0 + 5 + i * (rw - 10) / 3;
			ctx.beginPath(); ctx.arc(x, L.ry0, 2 + (i % 2) * 0.9, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
		}
		dcFlake(cx, cy + 0.2, rh * 0.5, sk.accent);
		dcFlake(L.stx, L.sty, 2.7, sk.accent);
		dcIcicles(L.hx0 + 3, L.hx1 - 3, L.hy1, 4, 5);
		dcSparkle(L.rx0 + 7, L.ry0 + 2.2, 1.7); dcSparkle(L.hx0 + 9, L.hy0 + 1, 1.4);
		dcSparkle(L.stx - 5, L.sty - 2, 1.3); dcSparkle(L.rx1 - 4, L.ry1 - 4, 1.1);
	} else if (sk.deco === 'dragon') {									// «Красный Дракон»
		dcGloss(L, '255,225,150', 0.4);
		ctx.strokeStyle = sk.accent; ctx.lineWidth = 0.9; ctx.globalAlpha = 0.85;
		ctx.strokeRect(L.rx0 + 1.2, L.ry0 + 1.2, rw - 2.4, rh - 2.4);	// золотая окантовка
		ctx.globalAlpha = 1;
		ctx.save();														// чешуя только внутри приклада
		ctx.beginPath();
		L.stk.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
		ctx.closePath(); ctx.clip();
		dcScales(L.stx - 8, L.sty - 3.4, 12, 7, sk.accent);
		ctx.restore();
		dcDragon(L.rx0 + 3, L.rx1 - 6, cy, rh * 0.2, sk.accent);
		dcFlames(L.hx0 + 1.5, L.hx1 - 1.5, L.hy1, Math.max(3, Math.round((L.hx1 - L.hx0) / 5)), 5.5);
	} else if (sk.deco === 'ninja') {									// «Ниндзя»
		dcGloss(L, '150,160,220', 0.55);
		ctx.strokeStyle = sk.accent; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.75;
		ctx.beginPath();
		for (let i = 0; i < 3; i++) { const x = cx + 8 + i * 3.2; ctx.moveTo(x, L.ry0 + 0.8); ctx.lineTo(x + 3, L.ry1 - 0.8); }	// следы клинка
		ctx.stroke();
		ctx.globalAlpha = 1;
		dcShuriken(cx - 1, cy, rh * 0.5, '#aab0d0');
		ctx.fillStyle = '#b3262e'; ctx.fillRect(L.rx0, L.ry1 - 1.5, rw, 0.9);	// красная нить
		dcWrap(L.hx0, L.hy0, L.hx1 - L.hx0, L.hy1 - L.hy0, sk.accent);
		dcMoon(L.stx, L.sty - 0.5, 3, '#aab0d0');
		dcCord(L.cdx, L.sb);
	} else if (sk.deco === 'death') {									// «Смерть»
		const r = rh * 0.36;
		dcGloss(L, '255,255,255', 0.3);
		dcSpine(L.rx0 + 3, L.rx1 - 3, L.ry1 - 1.5, sk.accent);
		dcSkull(cx, cy - r * 0.3, r, sk.accent);
		dcBones(L.stx, L.sty, 3.6, sk.accent);
		dcSkull(L.stx, L.sty - 0.3, 2.2, sk.accent);
		dcRibs(L.hx0 + 2, L.hx1 - 2, L.hy0, L.hy1);
	}
	ctx.restore();
}
function drawAKDeco(sk) { drawSkinDeco(sk, DC_LAYOUT.ak); }
function drawSniperDeco(sk) { drawSkinDeco(sk, DC_LAYOUT.sniper); }
function drawMGDeco(sk) {
	drawSkinDeco(sk, DC_LAYOUT.mg);
	if (sk.deco === 'death' && !hero.magOut) dcSkull(15, 11.5, 2.4, sk.accent);	// череп на коробе с лентой
}

// ===== снайперка =====
function drawSniperRifle() {
	const sk = weaponSkin('sniper');
	withSkinMap(sk.map, drawSniperRifleBase);
	drawSniperDeco(sk);
}
function weaponSkin(w) {												// скин оружия w у текущего бойца (hero)
	return skinOf(hero, w);
}

// ===== пулемёт =====
function drawMG() {
	const sk = weaponSkin('mg');
	withSkinMap(sk.map, drawMGBase);
	drawMGDeco(sk);
}

// ===== гранаты =====
// Новый скин гранаты: 1) запись в NADE_SKINS (body — корпус, pin — чека, deco — узор),
// 2) узор в drawNade, 3) название в SKIN_SNAME, цвет в SKIN_ACC, кнопка в index.html.
const NADE_SKINS = {
	default: { body: '#4a5530', pin: '#888', deco: null },
	snow: { body: '#d8e0e6', pin: '#4d6a8a', deco: 'snow' },
	dragon: { body: '#8a1f1a', pin: '#d9a441', deco: 'dragon' },
	ninja: { body: '#16161a', pin: '#8a8fa8', deco: 'ninja' },
	death: { body: '#222220', pin: '#e8e2d0', deco: 'death' },
	forest: { body: '#2f5a2a', pin: '#6bd45a', deco: 'forest' }
};
WEAPON_SKINS.nade = NADE_SKINS;
SKIN_FIELD.nade = 'nadeSkin';										// граната хранит скин в облике, как и оружие
SKIN_WNAME.nade = 'Граната';
function nadeSkin(h) {												// скин гранаты бойца h
	return skinOf(h, 'nade');
}
function drawNade(cy, r, sk) {										// граната с центром (0, cy) и радиусом r; ctx уже сдвинут и повёрнут
	const ry = r * 1.2, full = Math.PI * 2;
	ctx.fillStyle = sk.body;
	ctx.beginPath(); ctx.ellipse(0, cy, r, ry, 0, 0, full); ctx.fill();
	if (sk.deco) {
		ctx.save();
		ctx.beginPath(); ctx.ellipse(0, cy, r, ry, 0, 0, full); ctx.clip();
		ctx.translate(0, cy);
		if (sk.deco === 'snow') {									// синяя шапка и снежинки-точки
			ctx.fillStyle = '#4f86c6'; ctx.fillRect(-r, -ry, r * 2, ry * 0.55);
			ctx.fillStyle = '#fff';
			for (const p of [[-0.45, 0.15], [0.3, 0.4], [-0.1, 0.7], [0.5, -0.05]]) {
				ctx.beginPath(); ctx.arc(p[0] * r, p[1] * ry, r * 0.12, 0, full); ctx.fill();
			}
		} else if (sk.deco === 'dragon') {							// золотой пояс и чешуя
			ctx.fillStyle = '#d9a441'; ctx.fillRect(-r, -ry * 0.12, r * 2, ry * 0.3);
			ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 0.8;
			for (const i of [-1, 0, 1]) { ctx.beginPath(); ctx.arc(i * r * 0.5, ry * 0.6, r * 0.3, Math.PI, 0); ctx.stroke(); }
		} else if (sk.deco === 'ninja') {
			dcShuriken(0, ry * 0.1, r * 0.65, '#8a8fa8');
		} else if (sk.deco === 'death') {
			dcSkull(0, ry * 0.05, r * 0.5, '#e8e2d0');
		} else if (sk.deco === 'forest') {
			dcEmblem(0, ry * 0.1, r * 0.55);
		}
		ctx.restore();
	}
	ctx.strokeStyle = '#111'; ctx.lineWidth = 2;						// контур поверх узора
	ctx.beginPath(); ctx.ellipse(0, cy, r, ry, 0, 0, full); ctx.stroke();
	if (sk.deco) {													// блик
		ctx.fillStyle = 'rgba(255,255,255,0.22)';
		ctx.beginPath(); ctx.ellipse(-r * 0.4, cy - ry * 0.45, r * 0.18, ry * 0.3, -0.3, 0, full); ctx.fill();
	}
	ctx.fillStyle = sk.pin;
	ctx.fillRect(-2, cy - ry - 3, 4, 4);							// чека
}
function drawNadePreview() {										// витрина меню: три гранаты в ряд
	const sk = nadeSkin(hero);
	[[-20, -0.4], [0, 0.15], [20, 0.5]].forEach(p => {
		ctx.save();
		ctx.translate(p[0], 0); ctx.rotate(p[1]);
		drawNade(4, 6, sk);
		ctx.restore();
	});
}
