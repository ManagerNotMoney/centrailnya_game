'use strict';
const dust = [];
const debris = [];
const craters = [];
const DIRT = ['#4a3b27', '#3a2f1f', '#5a4a30', '#2a301b'];
const helmets = [];
const mags = [];
const blood = [];
const bloodPools = [];
const callouts = [];
const CALL_TYPE = 3;
const CALL_LIFE = 260;
const CALL_GAP = 25;
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
    if (d.y >= GROUND - d.s / 2) { d.y = GROUND - d.s / 2; d.vx = 0; d.vy = 0; }
    if (--d.life <= 0) debris.splice(i, 1);
  }
  shake *= 0.9;
  if (shake < 0.1) shake = 0;
}
function sparkBurst(x, y, n) {
	for (let i = 0; i < n; i++) dust.push({ x, y, vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 5, r: 1.6, grow: 0, life: 10, max: 10, a: 0.9, c: '255,225,130' });
}
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
function radioSound() {                                      // шипение рации и «пик» конца передачи
	try {
		const a = sndCtx(), now = a.currentTime;
		const n = Math.floor(a.sampleRate * 0.14);
		const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
		for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (i < n * 0.15 ? 1 : Math.pow(1 - i / n, 2));
		const src = a.createBufferSource(); src.buffer = buf;
		const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
		const g = a.createGain(); g.gain.value = 0.18;
		src.connect(bp); bp.connect(g); g.connect(Snd.out); src.start(now);
		const o = a.createOscillator(), og = a.createGain();
		o.type = 'square'; o.frequency.setValueAtTime(1000, now + 0.12);
		og.gain.setValueAtTime(0.0001, now + 0.12);
		og.gain.exponentialRampToValueAtTime(0.05, now + 0.13);
		og.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
		o.connect(og); og.connect(Snd.out); o.start(now + 0.12); o.stop(now + 0.25);
	} catch (e) { /* звук необязателен */ }
}
function updateCallouts() {
	let n = 0;
	for (const a of squad) {                                 // боец погиб — ставим сообщение в очередь
		if (a.announced || !a.health.state.dead) continue;
		a.announced = true;
		const name = a.call.toUpperCase();
		callouts.push({ name, txt: name + ' — 200', t: -1 - n++ * CALL_GAP });
		if (callouts.length > 4) callouts.shift();
	}
	for (let i = callouts.length - 1; i >= 0; i--) {
		const c = callouts[i];
		if (++c.t === 0) radioSound();                       // передача началась
		if (c.t > CALL_LIFE) callouts.splice(i, 1);
	}
}