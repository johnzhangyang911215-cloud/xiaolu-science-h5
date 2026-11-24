/* Scene 5 · 28 天功效 (V2, docs/12-v2-revision.md).
   Scene 7 fades to ink; the ground then dawns into warm ivory as the single ampoule rises (light ending, user request). On `dataIn` the 20-pack box slides in
   beside it and the efficacy panel opens on the right: 鹿茸凝时抗皱冻干精华液 | 28天产品功效, 抗皱 (↓30.96 %, ↓23.65 %) and
   紧致 (↑34.68 %, ↑35.18 %) per p40 / KT 板 15. The digits roll like an odometer and lock one after another, the last on
   `dataLock`; the footnote follows. The panel then clears and the products glide to the centred end-card layout that
   scene 8 starts from. Plain DOM; render(t) is a pure function of time. */
(function () {
  const F = window.FILM;
  const FPS = F.fps;
  const K = {};
  for (const k in F.cueFrames) K[k] = F.cueFrames[k] / FPS;
  const T0 = K.s5, IN = K.dataIn, LOCK = K.dataLock, END = K.s8;
  const OUT = END - 0.9; // panel clears, products glide to the scene-8 layout
  // V3.7: one hero number (crow's-feet count), the other three as a quiet secondary row
  const DATA = [
    { id: 's5-l1', tag: 's5-h1', hero: true, x: 0, y: 92, v: 30.96, dir: '↓' },
    { id: 's5-l2', tag: 's5-h1', x: 0, y: 352, v: 23.65, dir: '↓' },
    { id: 's5-l3', tag: 's5-h2', x: 280, y: 352, v: 34.68, dir: '↑' },
    { id: 's5-l4', tag: 's5-h2', x: 540, y: 352, v: 35.18, dir: '↑' }
  ];
  const PUSH0 = 74.5;
  // Layouts [left, top, height] in stage px. A: ampoule alone; B: box + ampoule beside the panel; C: scene-8 end card.
  const BOX_AR = 1400 / 1008, AMP_AR = 181 / 1000;
  const L = {
    ampA: [960 - 0.5 * 600 * AMP_AR, 230, 600],
    ampB: [800, 360, 470], boxB: [110, 410, 470],
    ampC: [1200, 330, 450], boxC: [560, 400, 400]
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const sine = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1));
  const out3 = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const lerp = (a, b, k) => a + (b - a) * k;
  const lerpL = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));

  let root, ink, amp, box, shine, glow, panel, note, copy = [], lastProbe = null;
  const els = {}, nums = [];
  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; };
  const decode = (img) => (img.decode ? img.decode() : Promise.resolve()).catch(() => {});
  const txt = (id) => { const c = copy.find((e) => e.id === id); return c ? c.text : ''; };
  const place = (e, l, ar) => { e.style.left = l[0].toFixed(1) + 'px'; e.style.top = l[1].toFixed(1) + 'px'; e.style.height = l[2].toFixed(1) + 'px'; e.style.width = (l[2] * ar).toFixed(1) + 'px'; };

  function init(stage, entries) {
    copy = entries.filter((e) => e.scene === 5);
    root = el('div', '', stage); root.id = 's5'; root.style.display = 'none';
    el('i', 's5-bg', root);
    ink = el('i', 's5-ink', root);
    glow = el('i', 's5-glow', root);
    box = el('img', 's5-box', root); box.alt = ''; box.src = 'assets/products/box-20.webp';
    shine = el('i', 's5-shine', root);
    amp = el('img', 's5-amp', root); amp.alt = ''; amp.src = 'assets/products/ampoule-up.webp';
    panel = el('div', 's5-panel', root);
    const head = el('div', 's5-head', panel);
    el('span', 's5-title', head, txt('s5-title'));
    el('i', 's5-bar', head);
    const d = el('span', 's5-days', head); const m = /^(\d+)(.*)$/.exec(txt('s5-days')) || ['', '', ''];
    el('b', '', d, m[1]); d.appendChild(document.createTextNode(m[2]));
    DATA.forEach((D, i) => {
      const cell = el('div', 's5-cell' + (D.hero ? ' hero' : ''), panel); cell.style.left = D.x + 'px'; cell.style.top = D.y + 'px';
      const lab = el('div', 's5-lab', cell); el('em', 's5-tag', lab, txt(D.tag)); lab.appendChild(document.createTextNode(txt(D.id)));
      const row = el('div', 's5-num', cell);
      el('i', 's5-dir', row, D.dir);
      const slots = [];
      for (const ch of D.v.toFixed(2)) slots.push(el('span', ch === '.' ? 's5-dot' : 's5-dg', row, ch));
      el('i', 's5-pct', row, '%');
      // clean count-up, easeOutExpo; the hero lands first, the last secondary exactly on dataLock
      const t0 = IN + 0.1 + i * 0.12, t1 = i === 0 ? IN + 1.4 : IN + 1.4 + i * (LOCK - IN - 1.4) / 3;
      nums.push({ cell, slots, i, v: D.v, t0, t1 });
    });
    note = el('div', 's5-note', panel, txt('s5-note'));
    els.head = head;
    return Promise.all([decode(amp), decode(box)]);
  }

  function render(t) {
    root.style.opacity = '1';
    const kL = sine((t - T0 - 0.05) / 0.8);                  // V3.7: graphite → ivory bloom, 0.8 s easeInOutSine
    // light spreads outward from the ampoule rather than a flat grey crossfade
    const r0 = 2400 * kL, mk = 'radial-gradient(circle at 960px 520px, transparent ' + (r0 - 700).toFixed(0) + 'px, #000 ' + r0.toFixed(0) + 'px)';
    ink.style.webkitMaskImage = mk; ink.style.maskImage = mk;
    ink.style.opacity = (1 - smooth(0.85, 1, kL)).toFixed(3);
    const kA = out3((t - T0) / 0.9);                 // ampoule rises out of the dark
    const kB = smooth(IN - 0.25, IN + 0.95, t);              // move to the data layout
    const kC = smooth(OUT, END - 0.05, t);                   // move to the end-card layout
    const ampL = kC > 0 ? lerpL(L.ampB, L.ampC, kC) : lerpL(L.ampA, L.ampB, kB);
    ampL[1] += 40 * (1 - kA);
    place(amp, ampL, AMP_AR);
    amp.style.opacity = kA.toFixed(3);
    amp.style.filter = 'blur(' + (6 * (1 - kA)).toFixed(2) + 'px)';

    const kBox = out3((t - IN + 0.15) / 1.1);
    const boxL = kC > 0 ? lerpL(L.boxB, L.boxC, kC) : L.boxB.slice();
    boxL[0] -= 160 * (1 - kBox);
    const drift = smooth(IN, OUT, t) * (1 - kC);
    boxL[0] += 14 * drift; boxL[1] -= 6 * drift;
    place(box, boxL, BOX_AR);
    box.style.opacity = kBox.toFixed(3);
    place(shine, boxL, BOX_AR);
    const sw = (a) => clamp((t - a) / 1.3, 0, 1);
    const s1 = sw(75.3), s2 = sw(79.2), sp = s2 > 0 ? s2 : s1;
    shine.style.opacity = (kBox * Math.sin(Math.PI * sp)).toFixed(3);
    shine.style.backgroundPosition = (130 - 160 * sp).toFixed(1) + '% 0';

    const gx = ampL[0] + ampL[2] * AMP_AR / 2;
    glow.style.transform = 'translate(' + (gx - 450).toFixed(1) + 'px,' + (ampL[1] - 200).toFixed(1) + 'px)';
    glow.style.opacity = (0.9 * kA).toFixed(3);

    const pA = smooth(IN - 0.1, IN + 0.6, t) * (1 - smooth(OUT - 0.35, OUT + 0.25, t));
    panel.style.opacity = pA.toFixed(3);
    panel.style.transform = 'translateX(' + (30 * (1 - smooth(IN - 0.1, IN + 0.8, t))).toFixed(1) + 'px)';
    let locked = 0;
    for (const N of nums) {
      N.cell.style.opacity = smooth(N.t0, N.t0 + 0.5, t).toFixed(3);
      const u = clamp((t - N.t0) / (N.t1 - N.t0), 0, 1), k = u >= 1 ? 1 : 1 - Math.pow(2, -10 * u);
      const str = (u >= 1 ? N.v : Math.floor(N.v * k * 100) / 100).toFixed(2).padStart(5, '0');
      N.slots.forEach((e, j) => { if (e.textContent !== str[j]) e.textContent = str[j]; });
      if (u >= 1) locked++;
    }
    // V3.7: 2 % slow linear push while the data rests, released as the products glide to the end card
    const push = 1 + 0.02 * clamp((t - PUSH0) / (OUT - PUSH0), 0, 1) * (1 - kC);
    root.style.transform = push > 1 ? 'scale(' + push.toFixed(5) + ')' : '';
    note.style.opacity = smooth(74.6, 75.2, t).toFixed(3);
    lastProbe = { t, kL: +kL.toFixed(3), kA: +kA.toFixed(3), kB: +kB.toFixed(3), kC: +kC.toFixed(3), panelA: +pA.toFixed(3), locked,
      lastLockT: +nums[3].t1.toFixed(3) };
  }

  function setActive(v) { if (root) root.style.display = v ? '' : 'none'; }
  window.FILM_SCENES = window.FILM_SCENES || {};
  window.FILM_SCENES[5] = { init, render, setActive, probe: () => lastProbe };
})();
