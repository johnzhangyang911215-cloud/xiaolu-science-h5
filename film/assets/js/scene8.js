/* Scene 8 · 尾 · 粒子归一 (V3).
   Picks up scene 5's ivory end layout (20-pack box + ampoule). From s8 the products dissolve into fine particles that rise and
   spiral onto the ten dots of the 华大小鹿 antler mark; on arrival the solid mark settles in, the wordmark and 华大BGI follow, then
   the line 「把时间，还给肌肤」. The words leave with the music and the last frame is the dual logo alone on ivory.
   Particles: canvas 2D, seeded, every position a pure function of t. */
(function () {
  const F = window.FILM;
  const K = {};
  for (const k in F.cueFrames) K[k] = F.cueFrames[k] / F.fps;
  const T0 = K.s8, LOGO = K.logo, FADE = K.fadeOut, END = K.end;
  const W = 1920, H = 1080;
  const BOX_AR = 1400 / 1008, AMP_AR = 181 / 1000;
  const AMP = [1200, 330, 450], BOX = [560, 400, 400]; // = scene 5's end layout
  const LOGO_H = 236, LOGO_VB = [144.78, 56.86], LOGO_CY = 430;
  // antler dots of logo-h.svg in viewBox units: cx, cy, rx, ry
  const DOTS = [[2.65, 2.56, 1.3, 1.3], [51.67, 2.57, 1.3, 1.3], [3.85, 12.94, 1.55, 1.57], [49.53, 12.94, 1.57, 1.57], [13.65, 18.2, 1.85, 1.87],
    [40.68, 18.2, 1.85, 1.85], [18.07, 30.34, 3.0, 2.77], [36.27, 30.34, 3.0, 2.77], [27.17, 41.65, 2.97, 2.55], [27.17, 53.39, 2.05, 1.67]];
  const NAVY = [26, 47, 119];
  // timeline
  const DISS_A = T0 + 0.15, DISS_B = LOGO + 0.5;           // products give off particles
  const SOLID_A = LOGO + 1.65, SOLID_B = LOGO + 2.35;        // solid mark replaces the swarm
  const WORD_A = LOGO + 2.0, WORD_B = LOGO + 2.9;
  const LINE_A = LOGO + 2.7, LINE_B = LOGO + 3.6;
  const OUT_A = FADE + 0.25, OUT_B = FADE + 1.25;            // words leave; logos stay to the last frame

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const inOut = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  function rng(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  let root, prod, amp, box, logos, bgi, lg, line, name, cv, ctx, copy = [], P = null, lastProbe = null;
  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; };
  const decode = (img) => (img.decode ? img.decode() : Promise.resolve()).catch(() => {});
  const txt = (id) => { const c = copy.find((e) => e.id === id); return c ? c.text : ''; };
  const place = (e, l, ar) => { e.style.left = l[0] + 'px'; e.style.top = l[1] + 'px'; e.style.height = l[2] + 'px'; e.style.width = (l[2] * ar).toFixed(1) + 'px'; };

  function init(stage, entries) {
    copy = entries.filter((e) => e.scene === 8);
    root = el('div', '', stage); root.id = 's8'; root.style.display = 'none';
    el('i', 's8-bg', root);
    prod = el('div', 's8-prod', root);
    box = el('img', 's8-box', prod); box.alt = ''; box.src = 'assets/products/box-20.webp'; place(box, BOX, BOX_AR);
    amp = el('img', 's8-amp', prod); amp.alt = ''; amp.src = 'assets/products/ampoule-up.webp'; place(amp, AMP, AMP_AR);
    cv = el('canvas', 's8-fx', root); cv.width = W; cv.height = H; ctx = cv.getContext('2d');
    logos = el('div', 's8-logos', root);
    bgi = el('img', 's8-bgi', logos); bgi.alt = txt('s8-bgi'); bgi.src = 'assets/brand/bgi-blue.svg';   // 品牌方提供的官方标
    el('i', 's8-bar', logos);
    lg = el('img', 's8-logo', logos); lg.alt = '华大小鹿 YOUTH MESSAGER'; lg.src = 'assets/brand/logo-h.svg';
    line = el('div', 's8-line', root, txt('s8-line'));
    name = el('div', 's8-name', root, txt('s8-name'));
    return Promise.all([decode(amp), decode(box), decode(lg), decode(bgi)]);
  }

  // particles: sources are opaque pixels of the two product images, targets are points inside the antler dots
  function build() {
    const oc = document.createElement('canvas'); oc.width = W; oc.height = H; const o = oc.getContext('2d');
    o.drawImage(box, BOX[0], BOX[1], BOX[2] * BOX_AR, BOX[2]); o.drawImage(amp, AMP[0], AMP[1], AMP[2] * AMP_AR, AMP[2]);
    const d = o.getImageData(0, 0, W, H).data, rand = rng(8008), src = [];
    for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) { const i = (y * W + x) * 4; if (d[i + 3] > 160) src.push([x, y, d[i], d[i + 1], d[i + 2]]); }
    const N = 5200, area = DOTS.map((q) => q[2] * q[3]), tot = area.reduce((a, b) => a + b, 0), parts = [];
    for (let n = 0; n < N; n++) {
      const s = src[Math.floor(rand() * src.length)];
      let k = 0, u = rand() * tot; while (u > area[k] && k < DOTS.length - 1) { u -= area[k]; k++; }
      const a = rand() * Math.PI * 2, rr = Math.sqrt(rand());
      // leave top-down, like the products evaporating
      const leave = DISS_A + (DISS_B - DISS_A - 0.6) * clamp((s[1] - 330) / 470, 0, 1) * 0.75 + rand() * 0.6;
      const dur = 1.5 + rand() * 0.7;
      parts.push({ sx: s[0] + (rand() - 0.5) * 3, sy: s[1] + (rand() - 0.5) * 3, c: [s[2], s[3], s[4]], k, a: Math.cos(a) * rr, b: Math.sin(a) * rr,
        t0: leave, t1: Math.min(leave + dur, SOLID_A - 0.05), sw: (rand() - 0.5) * 2, lift: 60 + rand() * 180, sz: 1.1 + rand() * 1.5, ph: rand() * 6.28 });
    }
    return parts;
  }

  function render(t) {
    if (!P) P = build();
    const dis = smooth(DISS_A, DISS_B, t);
    prod.style.opacity = (1 - dis).toFixed(3);
    prod.style.transform = 'scale(' + (1 + 0.03 * smooth(T0, DISS_B, t)).toFixed(4) + ')';
    // layout of the dual mark (centred), measured so the particle targets land on the real SVG dots
    const lw = LOGO_H * LOGO_VB[0] / LOGO_VB[1], total = logos.offsetWidth || (bgi.offsetWidth + 160 + lw);
    const left = (W - total) / 2, push = 1 + 0.025 * smooth(SOLID_A, END, t);
    logos.style.left = left.toFixed(1) + 'px'; logos.style.top = (LOGO_CY - LOGO_H / 2) + 'px';
    logos.style.transform = 'scale(' + push.toFixed(4) + ')'; logos.style.transformOrigin = (W / 2 - left) + 'px ' + LOGO_H / 2 + 'px';
    const lx = left + lg.offsetLeft, ly = LOGO_CY - LOGO_H / 2, sc = LOGO_H / LOGO_VB[1];
    const solid = smooth(SOLID_A, SOLID_B, t), word = smooth(WORD_A, WORD_B, t), out = smooth(OUT_A, OUT_B, t);
    lg.style.opacity = 1; logos.style.opacity = 1;
    // the mark is revealed in two parts: dots (clip to the left 38% of the svg) then the wordmark; 华大BGI with the wordmark
    const dotsW = 58 / LOGO_VB[0] * 100;
    lg.style.clipPath = `inset(0 ${(100 - (dotsW + (100 - dotsW) * word)).toFixed(2)}% 0 0)`;
    lg.style.opacity = Math.max(solid, 0).toFixed(3);
    bgi.style.opacity = word.toFixed(3); logos.querySelector('.s8-bar').style.opacity = word.toFixed(3);
    line.style.opacity = (smooth(LINE_A, LINE_B, t) * (1 - out)).toFixed(3);
    line.style.transform = 'translateY(' + (14 * (1 - smooth(LINE_A, LINE_B, t))).toFixed(1) + 'px)';
    name.style.opacity = (smooth(LINE_A + 0.4, LINE_B + 0.4, t) * (1 - out)).toFixed(3);

    // swarm
    ctx.clearRect(0, 0, W, H);
    const gone = 1 - smooth(SOLID_A + 0.1, SOLID_B + 0.2, t);
    let live = 0, landed = 0;
    if (t >= DISS_A && gone > 0.002) {
      for (const p of P) {
        if (t < p.t0) continue;
        const u = inOut((t - p.t0) / (p.t1 - p.t0)), D = DOTS[p.k];
        const tx = lx + (D[0] + D[2] * 0.92 * p.a) * sc * push + (1 - push) * (lx - W / 2) * 0, ty = ly + (D[1] + D[3] * 0.92 * p.b) * sc;
        // curved flight: rise first, then swing in from the side
        const mx = (p.sx + tx) / 2 + p.sw * 260, my = Math.min(p.sy, ty) - p.lift;
        const x = (1 - u) * (1 - u) * p.sx + 2 * (1 - u) * u * mx + u * u * tx + (1 - u) * 4 * Math.sin(t * 2.3 + p.ph);
        const y = (1 - u) * (1 - u) * p.sy + 2 * (1 - u) * u * my + u * u * ty + (1 - u) * 4 * Math.cos(t * 1.9 + p.ph);
        const born = smooth(p.t0, p.t0 + 0.35, t), cm = smooth(0.15, 0.85, u);
        const r = Math.round(p.c[0] + (NAVY[0] - p.c[0]) * cm), g = Math.round(p.c[1] + (NAVY[1] - p.c[1]) * cm), b = Math.round(p.c[2] + (NAVY[2] - p.c[2]) * cm);
        const a = born * gone * (0.55 + 0.45 * cm);
        // light particles need a soft shadow on ivory; navy ones stand on their own
        const s = p.sz * (1 - 0.25 * cm) * push;
        ctx.fillStyle = `rgba(${Math.min(r, 214)},${Math.min(g, 204)},${Math.min(b, 190)},${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y, s, 0, 6.2832); ctx.fill();
        live++; if (u >= 0.999) landed++;
      }
    }
    lastProbe = { t, dissolve: +dis.toFixed(3), live, landed, solid: +solid.toFixed(3), word: +word.toFixed(3), wordsOut: +out.toFixed(3) };
  }

  function setActive(v) { if (root) root.style.display = v ? '' : 'none'; }
  window.FILM_SCENES = window.FILM_SCENES || {};
  window.FILM_SCENES[8] = { init, render, setActive, probe: () => lastProbe };
})();
