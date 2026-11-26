/* 尾卡（s8 → end）：背景为 AI 生成的象牙白暖光空间。真实产品盒与安瓶从白场浮现，化作金色微粒，
   沿弧线飞向华大小鹿标的十个鹿茸圆点；落定后实标显现，字标与华大BGI随后展开，再出「把时间，还给肌肤」。
   粒子位置都是 t 的纯函数，可任意跳播。 */
window.SEG9 = (function () {
  'use strict';
  const C = window.FILM.cues;
  const W = 1920, H = 1080;
  const T0 = C.s8, LOGO = C.logo, FADE = C.fadeOut, END = C.end;
  const BOX_AR = 1400 / 1008, AMP_AR = 181 / 1000;
  const AMP = [1200, 450, 450], BOX = [560, 520, 400];
  const LOGO_H = 236, LOGO_VB = [144.78, 56.86], LOGO_CY = 430;
  const DOTS = [[2.65, 2.56, 1.3, 1.3], [51.67, 2.57, 1.3, 1.3], [3.85, 12.94, 1.55, 1.57], [49.53, 12.94, 1.57, 1.57], [13.65, 18.2, 1.85, 1.87],
    [40.68, 18.2, 1.85, 1.85], [18.07, 30.34, 3.0, 2.77], [36.27, 30.34, 3.0, 2.77], [27.17, 41.65, 2.97, 2.55], [27.17, 53.39, 2.05, 1.67]];
  const GOLD = [196, 150, 82], NAVY = [26, 47, 119];
  const SHOW_A = T0 + 0.05, SHOW_B = T0 + 0.6;
  const DISS_A = T0 + 0.75, DISS_B = LOGO + 0.6;
  const SOLID_A = LOGO + 1.65, SOLID_B = LOGO + 2.35;
  const WORD_A = LOGO + 2.0, WORD_B = LOGO + 2.9;
  const LINE_A = LOGO + 2.7, LINE_B = LOGO + 3.6;
  const OUT_A = FADE + 0.7, OUT_B = FADE + 1.7;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const inOut = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  function rng(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; };
  const place = (e, l, ar) => { e.style.left = l[0] + 'px'; e.style.top = l[1] + 'px'; e.style.height = l[2] + 'px'; e.style.width = (l[2] * ar).toFixed(1) + 'px'; };
  const decode = (img) => (img.decode ? img.decode() : Promise.resolve()).catch(() => {});

  let root, prod, amp, box, logos, bgi, bar, lg, line, name, ctx, P = null, ready = false;
  const N = matchMedia('(pointer:coarse)').matches ? 2600 : 4200;

  function build(TXT) {
    root = document.getElementById('fin');
    prod = el('div', 'f-prod', root);
    const sh = el('i', 'f-shadow', prod); sh.style.cssText = 'left:500px;top:888px;width:1000px;height:64px';
    box = el('img', 'f-box', prod); box.alt = ''; box.src = '../film/assets/products/box-20.webp'; place(box, BOX, BOX_AR);
    amp = el('img', 'f-amp', prod); amp.alt = ''; amp.src = '../film/assets/products/ampoule-up.webp'; place(amp, AMP, AMP_AR);
    const cv = el('canvas', 'f-fx', root); cv.width = W; cv.height = H; ctx = cv.getContext('2d');
    logos = el('div', 'f-logos', root);
    bgi = el('img', 'f-bgi', logos); bgi.alt = TXT['s8-bgi']; bgi.src = '../film/assets/brand/bgi-blue.svg';
    bar = el('i', 'f-bar', logos);
    lg = el('img', 'f-logo', logos); lg.alt = '华大小鹿 YOUTH MESSAGER'; lg.src = '../film/assets/brand/logo-h.svg';
    line = el('div', 'f-line', root, TXT['s8-line']);
    name = el('div', 'f-name', root); TXT['s8-name'].split('\n').forEach((l, i) => el(i ? 'span' : 'b', '', name, l));
    return Promise.all([decode(amp), decode(box), decode(lg), decode(bgi)]).then(() => { ready = true; });
  }

  function particles() {
    const oc = document.createElement('canvas'); oc.width = W; oc.height = H; const o = oc.getContext('2d');
    o.drawImage(box, BOX[0], BOX[1], BOX[2] * BOX_AR, BOX[2]); o.drawImage(amp, AMP[0], AMP[1], AMP[2] * AMP_AR, AMP[2]);
    const d = o.getImageData(0, 0, W, H).data, rand = rng(8008), src = [];
    for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) { const i = (y * W + x) * 4; if (d[i + 3] > 160) src.push([x, y, d[i], d[i + 1], d[i + 2]]); }
    const area = DOTS.map((q) => q[2] * q[3]), tot = area.reduce((a, b) => a + b, 0), out = [];
    for (let n = 0; n < N; n++) {
      const s = src[Math.floor(rand() * src.length)];
      let k = 0, u = rand() * tot; while (u > area[k] && k < DOTS.length - 1) { u -= area[k]; k++; }
      const a = rand() * Math.PI * 2, rr = Math.sqrt(rand());
      const leave = DISS_A + (DISS_B - DISS_A - 0.6) * clamp((s[1] - 450) / 470, 0, 1) * 0.75 + rand() * 0.6;
      out.push({ sx: s[0] + (rand() - 0.5) * 3, sy: s[1] + (rand() - 0.5) * 3, c: [s[2], s[3], s[4]], k, a: Math.cos(a) * rr, b: Math.sin(a) * rr,
        t0: leave, t1: Math.min(leave + 1.5 + rand() * 0.7, SOLID_A - 0.05), sw: (rand() - 0.5) * 2, lift: 60 + rand() * 180, sz: 1.1 + rand() * 1.5, ph: rand() * 6.28 });
    }
    return out;
  }

  function render(t) {
    if (!ready) return;
    const on = t >= T0 - 0.05;
    root.style.visibility = on ? 'visible' : 'hidden';
    if (!on) return;
    if (!P) P = particles();
    const dis = smooth(DISS_A, DISS_B, t);
    prod.style.opacity = (smooth(SHOW_A, SHOW_B, t) * (1 - dis)).toFixed(3);
    prod.style.transform = 'scale(' + (0.985 + 0.045 * smooth(T0, DISS_B, t)).toFixed(4) + ')';

    const lw = LOGO_H * LOGO_VB[0] / LOGO_VB[1], total = logos.offsetWidth || (399.4 + 160 + lw);
    const left = (W - total) / 2, push = 1 + 0.025 * smooth(SOLID_A, END, t);
    logos.style.left = left.toFixed(1) + 'px'; logos.style.top = (LOGO_CY - LOGO_H / 2) + 'px';
    logos.style.transform = 'scale(' + push.toFixed(4) + ')'; logos.style.transformOrigin = (W / 2 - left) + 'px ' + LOGO_H / 2 + 'px';
    const lx = left + lg.offsetLeft, ly = LOGO_CY - LOGO_H / 2, sc = LOGO_H / LOGO_VB[1];
    const solid = smooth(SOLID_A, SOLID_B, t), word = smooth(WORD_A, WORD_B, t), out = smooth(OUT_A, OUT_B, t);
    const dotsW = 58 / LOGO_VB[0] * 100;
    lg.style.clipPath = `inset(0 ${(100 - (dotsW + (100 - dotsW) * word)).toFixed(2)}% 0 0)`;
    lg.style.opacity = solid.toFixed(3);
    bgi.style.opacity = word.toFixed(3); bar.style.opacity = word.toFixed(3);
    const la = smooth(LINE_A, LINE_B, t);
    line.style.opacity = (la * (1 - out)).toFixed(3);
    line.style.transform = 'translateY(' + (14 * (1 - la)).toFixed(1) + 'px)';
    line.style.letterSpacing = (0.44 - 0.12 * la).toFixed(3) + 'em';
    name.style.opacity = (smooth(LINE_A + 0.4, LINE_B + 0.4, t) * (1 - out)).toFixed(3);

    ctx.clearRect(0, 0, W, H);
    const gone = 1 - smooth(SOLID_A + 0.1, SOLID_B + 0.2, t);
    if (t < DISS_A || gone <= 0.002) return;
    for (const p of P) {
      if (t < p.t0) continue;
      const u = inOut((t - p.t0) / (p.t1 - p.t0)), D = DOTS[p.k];
      const tx = lx + (D[0] + D[2] * 0.92 * p.a) * sc, ty = ly + (D[1] + D[3] * 0.92 * p.b) * sc;
      const mx = (p.sx + tx) / 2 + p.sw * 260, my = Math.min(p.sy, ty) - p.lift;
      const x = (1 - u) * (1 - u) * p.sx + 2 * (1 - u) * u * mx + u * u * tx + (1 - u) * 4 * Math.sin(t * 2.3 + p.ph);
      const y = (1 - u) * (1 - u) * p.sy + 2 * (1 - u) * u * my + u * u * ty + (1 - u) * 4 * Math.cos(t * 1.9 + p.ph);
      const born = smooth(p.t0, p.t0 + 0.35, t);
      // 产品本色 → 飞行中的暖金 → 落点处的品牌藏青
      const g = smooth(0, 0.12, u), nv = smooth(0.78, 1, u);
      const c = [0, 1, 2].map((j) => Math.round((p.c[j] + (GOLD[j] - p.c[j]) * g) * (1 - nv) + NAVY[j] * nv));
      const a = born * gone * (0.6 + 0.4 * g);
      const s = p.sz * (1 + 0.35 * Math.sin(Math.PI * u) - 0.25 * nv);
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, s, 0, 6.2832); ctx.fill();
    }
  }

  return { build, render };
})();
