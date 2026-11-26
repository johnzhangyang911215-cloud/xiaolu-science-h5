/* SVG 动态 HUD：跟随视频主体的锁定框、标注线、分层探点、切面测量环与节拍计。全部由正片时间 t 驱动。 */
window.HUD = (function () {
  'use strict';
  const { clamp, lin, mix, eOut, win, kf, A } = window.PV;
  const C = window.FILM.cues, FPS = window.FILM.fps;
  const NS = 'http://www.w3.org/2000/svg';
  const MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,"Roboto Mono",monospace';
  const INK = '#3b2f25', TEAL = '#1f8d9c', GOLD = '#a8773a';
  const BAR = 60 / 112.35 * 4, BEAT = BAR / 4, GRID0 = C.s2 % BAR;
  let svg, N = {}, TXT = {};

  function el(tag, at, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in at) e.setAttribute(k, at[k]);
    (parent || svg).appendChild(e);
    return e;
  }
  const g = (parent) => el('g', {}, parent);
  const mono = (parent, x, y, s, anchor = 'start', size = 15, fill = INK) => {
    const e = el('text', { x, y, 'font-family': MONO, 'font-size': size, 'letter-spacing': '.18em', fill, 'text-anchor': anchor, class: 'ht' }, parent);
    e.textContent = s; return e;
  };
  const zh = (parent, x, y, s, anchor = 'start', size = 30, fill = INK, fam = 'XL Serif') => {
    const e = el('text', { x, y, 'font-family': `"${fam}",serif`, 'font-size': size, 'letter-spacing': '.16em', fill, 'text-anchor': anchor, class: 'ht' }, parent);
    e.textContent = s; return e;
  };
  const show = (e, a) => { e.style.opacity = a.toFixed(3); e.style.display = a > 0.002 ? '' : 'none'; };
  const corners = (x, y, w, h, L) =>
    `M${x},${y + L}V${y}H${x + L}M${x + w - L},${y}H${x + w}V${y + L}M${x + w},${y + h - L}V${y + h}H${x + w - L}M${x + L},${y + h}H${x}V${y + h - L}`;
  const pad = (n, k) => String(n).padStart(k, '0');

  function build(root, txt) {
    TXT = txt; svg = root;
    // 画框与遥测
    N.frame = g();
    el('path', { d: corners(40, 40, 1840, 1000, 34), fill: 'none', stroke: INK, 'stroke-width': 1.5, opacity: 0.55 }, N.frame);
    mono(N.frame, 86, 72, 'SEQ.02 · SPECIMEN ANALYSIS', 'start', 14);
    N.tc = mono(N.frame, 1834, 72, '', 'end', 14);
    N.cue = mono(N.frame, 86, 1022, '', 'start', 14);
    N.bpm = mono(N.frame, 1834, 1022, '', 'end', 14);
    N.beats = [0, 1, 2, 3].map((i) => el('rect', { x: 1600 + i * 16, y: 1011, width: 10, height: 10, fill: TEAL, opacity: 0.2 }, N.frame));

    // C1 锁定鹿头
    N.deer = g();
    N.box = el('path', { fill: 'none', stroke: TEAL, 'stroke-width': 2.2 }, N.deer);
    N.cross = el('path', { fill: 'none', stroke: TEAL, 'stroke-width': 1.5, opacity: 0.8 }, N.deer);
    N.lockT = mono(N.deer, 0, 0, 'TARGET LOCK · CERVUS NIPPON', 'end', 15, TEAL);
    N.geo = mono(N.deer, 0, 0, `${txt['s1-lat'] || 'N 43°31′'}   ${txt['s1-lon'] || 'E 125°40′'}`, 'end', 15);
    N.crown = g(N.deer);
    N.crownL = el('path', { fill: 'none', stroke: INK, 'stroke-width': 1.4 }, N.crown);
    N.crownD = el('circle', { r: 6, fill: GOLD }, N.crown);
    N.crownR = el('circle', { r: 16, fill: 'none', stroke: GOLD, 'stroke-width': 1.4 }, N.crown);
    N.crownZ = zh(N.crown, 0, 0, '鹿茸', 'start', 34);
    N.crownM = mono(N.crown, 0, 0, 'VELVET ANTLER', 'start', 13);

    // C2 结构扫描面板 + 角基
    N.scan = g();
    mono(N.scan, 1480, 130, 'STRUCTURE SCAN', 'start', 15, TEAL);
    el('rect', { x: 1480, y: 146, width: 354, height: 3, fill: INK, opacity: 0.15 }, N.scan);
    N.scanBar = el('rect', { x: 1480, y: 146, width: 354, height: 3, fill: TEAL }, N.scan);
    N.scanPct = mono(N.scan, 1834, 130, '', 'end', 15, TEAL);
    mono(N.scan, 1480, 180, 'KERNEL   SOBEL 3×3', 'start', 13);
    mono(N.scan, 1480, 202, 'SOURCE   1920×1080', 'start', 13);
    N.scanSt = mono(N.scan, 1480, 224, '', 'start', 13);
    N.burr = ['burrL', 'burrR'].map((k, i) => {
      const b = g(N.scan);
      const ring = el('circle', { r: 74, fill: 'none', stroke: TEAL, 'stroke-width': 1.6, 'stroke-dasharray': '6 8' }, b);
      const dot = el('circle', { r: 5, fill: TEAL }, b);
      const ln = el('path', { fill: 'none', stroke: INK, 'stroke-width': 1.3 }, b);
      const z = zh(b, 0, 0, '茸根', i ? 'start' : 'end', 30);
      const m = mono(b, 0, 0, i ? 'ROOT · R' : 'ROOT · L', i ? 'start' : 'end', 13);
      return { k, b, ring, dot, ln, z, m, side: i ? 1 : -1 };
    });

    // C3 茸尖涟漪
    N.tip = g();
    N.tipRing = el('circle', { r: 96, fill: 'none', stroke: TEAL, 'stroke-width': 1.6, 'stroke-dasharray': '3 9' }, N.tip);
    N.tipArc = el('circle', { r: 120, fill: 'none', stroke: GOLD, 'stroke-width': 2.2, pathLength: 1, 'stroke-dasharray': '0 1' }, N.tip);
    N.tipW = [0, 1].map(() => el('circle', { r: 10, fill: 'none', stroke: '#fff', 'stroke-width': 2 }, N.tip));
    N.tipL = el('path', { fill: 'none', stroke: INK, 'stroke-width': 1.3 }, N.tip);
    N.tipZ = zh(N.tip, 0, 0, '茸尖', 'start', 34);
    N.tipM = mono(N.tip, 0, 0, 'GROWTH TIP', 'start', 13);

    // C4 分层：测量样条 + 四个探点标注
    N.lay = g();
    N.spline = el('path', { fill: 'none', stroke: GOLD, 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': '0 1', opacity: 0.85 }, N.lay);
    N.rootT = zh(N.lay, 0, 0, '茸根', 'middle', 26);
    N.tipT = zh(N.lay, 0, 0, '茸尖', 'middle', 26);
    const LX = [250, 690, 1130, 1570];
    N.cells = [['s3', 'bone', 's3-bone', 1], ['layerBlood', 'blood', 's3-blood', 2], ['layerPowder', 'powder', 's3-powder', 3], ['wax', 'waxTip', 's3-wax', 4]].map(([cue, key, id, lv], i) => {
      const c = g();
      const wax = i === 3;
      zh(c, LX[i], 178, txt[id], 'middle', 48, wax ? '#9c6a2e' : INK);
      zh(c, LX[i], 216, txt[id + '-d'], 'middle', 21, '#5e4c3d', 'XL Sans').setAttribute('letter-spacing', '.02em');
      for (let j = 0; j < 4; j++) el('rect', { x: LX[i] - 34 + j * 18, y: 232, width: 14, height: 5, fill: j < lv ? (wax ? GOLD : TEAL) : INK, opacity: j < lv ? 0.9 : 0.15 }, c);
      const ln = el('path', { fill: 'none', stroke: INK, 'stroke-width': 1.3, opacity: 0.7 }, c);
      const dot = el('circle', { r: 6, fill: wax ? GOLD : TEAL }, c);
      const ring = el('circle', { r: 14, fill: 'none', stroke: wax ? GOLD : TEAL, 'stroke-width': 1.5 }, c);
      return { cue, key, lx: LX[i], c, ln, dot, ring, wax };
    });

    // C5/C6 切面测量环
    N.sl = g();
    N.slRot = g(N.sl);
    let d = '';
    for (let i = 0; i < 72; i++) {
      const a = i * 5 * Math.PI / 180, L = i % 6 ? 10 : 22;
      d += `M${Math.sin(a) * 100},${-Math.cos(a) * 100}L${Math.sin(a) * (100 + L / 5)},${-Math.cos(a) * (100 + L / 5)}`;
    }
    N.ticks = el('path', { d, fill: 'none', stroke: TEAL, 'stroke-width': 0.22, opacity: 0.85 }, N.slRot);
    N.slRing = el('circle', { r: 100, fill: 'none', stroke: TEAL, 'stroke-width': 0.16, pathLength: 1, 'stroke-dasharray': '0 1' }, N.slRot);
    N.slCross = el('path', { fill: 'none', stroke: TEAL, 'stroke-width': 1.3, opacity: 0.8 }, N.sl);
    N.slL = el('path', { fill: 'none', stroke: INK, 'stroke-width': 1.3 }, N.sl);
    N.slM = mono(N.sl, 0, 0, 'WAX SECTION · TIP 2%', 'start', 15, INK);
  }

  function catmull(P) {
    let d = `M${P[0][0]},${P[0][1]}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      d += `C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    return d;
  }
  const CUE_SEQ = ['s2', 'dolly', 'holo', 'antlerGlow', 'ring', 's3', 'layerBlood', 'layerPowder', 'wax', 'collagen', 'antlerFreeze', 's4'];

  function render(t) {
    if (!svg) return;
    const T0 = C.s2, T1 = C.s4;
    // 画框遥测
    show(N.frame, Math.min(lin(t, T0, T0 + 0.6), 1 - lin(t, T1 - 0.5, T1)) * 0.9);
    N.tc.textContent = `T ${pad(t.toFixed(3), 6)} · F ${pad(Math.floor(t * FPS + 1e-6), 4)}`;
    let cn = CUE_SEQ[0];
    CUE_SEQ.forEach((n) => { if (t >= C[n]) cn = n; });
    N.cue.textContent = `CUE · ${cn.replace(/[A-Z]/g, (m) => '_' + m).toUpperCase()}  ${C[cn].toFixed(2)}`;
    N.cue.style.fill = t - C[cn] < 0.25 ? TEAL : INK;
    const bi = Math.floor((t - GRID0) / BEAT + 1e-6), bar = Math.floor(bi / 4) + 1;
    N.bpm.textContent = `BAR ${pad(bar, 2)} · 112.35 BPM`;
    N.bpm.setAttribute('x', 1834);
    N.beats.forEach((r, i) => {
      const on = ((bi % 4) + 4) % 4 === i;
      const fr = (t - GRID0) / BEAT - bi;
      r.setAttribute('opacity', on ? (0.35 + 0.65 * (1 - fr)).toFixed(2) : 0.15);
      r.setAttribute('x', 1834 - 300 + i * 16);
    });

    // C1 锁定
    {
      const a = win(t, 7.9, C.holo + 0.1, 0.25, 0.35);
      show(N.deer, a);
      if (a > 0) {
        const [x, y, hw] = kf(A.face, t);
        const lk = eOut(lin(t, 7.9, 8.55)), s = mix(1.45, 1, lk);
        const w = hw * 1.6 * s, h = hw * 1.25 * s;
        const flick = t < 8.55 ? (Math.floor(t * 30) % 3 ? 1 : 0.35) : 1;
        N.box.setAttribute('d', corners(x - w / 2, y - h / 2, w, h, 30));
        N.box.style.opacity = flick;
        N.cross.setAttribute('d', `M${x - 16},${y}H${x - 5}M${x + 5},${y}H${x + 16}M${x},${y - 16}V${y - 5}M${x},${y + 5}V${y + 16}`);
        N.lockT.setAttribute('x', x + w / 2); N.lockT.setAttribute('y', y - h / 2 - 16);
        N.geo.setAttribute('x', x + w / 2); N.geo.setAttribute('y', y + h / 2 + 30);
        show(N.geo, lin(t, 8.6, 9.0));
        const ca = win(t, C.dolly + 0.25, C.holo + 0.1, 0.4, 0.3);
        show(N.crown, ca);
        if (ca > 0) {
          const [cx, cy] = kf(A.crown, t), g1 = eOut(lin(t, C.dolly + 0.25, C.dolly + 0.9));
          const ex = cx + 150 * g1, ey = cy - 70 * g1, fx = ex + 150 * g1;
          N.crownL.setAttribute('d', `M${cx},${cy}L${ex},${ey}H${fx}`);
          N.crownD.setAttribute('cx', cx); N.crownD.setAttribute('cy', cy);
          N.crownR.setAttribute('cx', cx); N.crownR.setAttribute('cy', cy);
          N.crownR.setAttribute('r', 10 + 14 * ((t * 1.6) % 1));
          N.crownR.style.opacity = 1 - ((t * 1.6) % 1);
          N.crownZ.setAttribute('x', ex + 6); N.crownZ.setAttribute('y', ey - 14);
          N.crownM.setAttribute('x', ex + 6); N.crownM.setAttribute('y', ey + 24);
        }
      }
    }
    // C2 扫描
    {
      const a = win(t, C.holo + 0.1, C.ring - 0.05, 0.3, 0.35);
      show(N.scan, a);
      if (a > 0) {
        const p = lin(t, C.holo + 0.15, C.antlerGlow - 0.3);
        N.scanBar.setAttribute('width', (354 * p).toFixed(1));
        N.scanPct.textContent = `EDGE MAP ${pad(Math.round(p * 100), 3)}%`;
        N.scanSt.textContent = t < C.antlerGlow ? 'STATUS   SCANNING' : 'STATUS   ROOTS LOCATED';
        const ba = lin(t, C.antlerGlow, C.antlerGlow + 0.5);
        N.burr.forEach((o) => {
          show(o.b, ba);
          const [x, y] = kf(A[o.k], t), s = o.side;
          o.ring.setAttribute('cx', x); o.ring.setAttribute('cy', y);
          o.ring.setAttribute('transform', `rotate(${(t * 40 * s).toFixed(1)} ${x} ${y})`);
          o.ring.setAttribute('r', mix(130, 74, eOut(ba)));
          o.dot.setAttribute('cx', x); o.dot.setAttribute('cy', y);
          const ex = x + s * 150, ey = y - 150;
          o.ln.setAttribute('d', `M${x + s * 52},${y - 52}L${ex},${ey}H${ex + s * 110}`);
          o.z.setAttribute('x', ex + s * 4); o.z.setAttribute('y', ey - 12);
          o.m.setAttribute('x', ex + s * 4); o.m.setAttribute('y', ey + 22);
        });
      }
    }
    // C3 茸尖
    {
      const a = win(t, C.ring + 0.2, C.s3 - 0.1, 0.4, 0.5);
      show(N.tip, a);
      if (a > 0) {
        const [x, y] = kf(A.tip, t);
        N.tipRing.setAttribute('cx', x); N.tipRing.setAttribute('cy', y);
        N.tipRing.setAttribute('transform', `rotate(${(t * 30).toFixed(1)} ${x} ${y})`);
        N.tipArc.setAttribute('cx', x); N.tipArc.setAttribute('cy', y);
        N.tipArc.setAttribute('transform', `rotate(-90 ${x} ${y})`);
        const pr = eOut(lin(t, C.ring + 0.3, C.s3 - 0.4));
        N.tipArc.setAttribute('stroke-dasharray', `${pr.toFixed(3)} 1`);
        [C.ring + 0.3, C.ring + 2.128].forEach((t0, i) => {
          const d = t - t0, w = N.tipW[i];
          if (d < 0 || d > 1.8) { w.style.display = 'none'; return; }
          w.style.display = '';
          w.setAttribute('cx', x); w.setAttribute('cy', y); w.setAttribute('r', d * 720);
          w.style.opacity = (1 - d / 1.8) * 0.8;
        });
        const ex = x + 220, ey = y + 80;
        N.tipL.setAttribute('d', `M${x + 120 * 0.85},${y + 120 * 0.5}L${ex},${ey}H${ex + 130}`);
        N.tipZ.setAttribute('x', ex + 6); N.tipZ.setAttribute('y', ey - 14);
        N.tipM.setAttribute('x', ex + 6); N.tipM.setAttribute('y', ey + 24);
      }
    }
    // C4 分层
    {
      const OUT = C.wax + 1.3, la = win(t, C.s3 - 0.05, C.wax + 0.25, 0.3, 0.35);
      show(N.lay, la);
      if (la > 0) {
        const P = ['bone', 'blood', 'powder', 'waxTip'].map((k) => kf(A[k], t));
        N.spline.setAttribute('d', catmull(P));
        N.spline.setAttribute('stroke-dasharray', `${eOut(lin(t, C.s3, C.s3 + 1.1)).toFixed(3)} 1`);
        N.rootT.setAttribute('x', Math.max(70, P[0][0])); N.rootT.setAttribute('y', Math.min(1000, P[0][1] + 70));
        N.tipT.setAttribute('x', P[3][0] + 40); N.tipT.setAttribute('y', P[3][1] - 46);
        show(N.rootT, lin(t, C.s3 + 0.6, C.s3 + 1.0)); show(N.tipT, lin(t, C.s3 + 0.9, C.s3 + 1.3));
      }
      N.cells.forEach((o, i) => {
        const c0 = C[o.cue];
        let a = Math.min(lin(t, c0, c0 + 0.4), o.wax ? 1 - lin(t, OUT - 0.45, OUT) : 1 - lin(t, C.wax, C.wax + 0.3));
        const nx = N.cells[i + 1];
        if (nx && t > C[nx.cue]) a *= 0.45;
        show(o.c, a);
        if (a <= 0) return;
        o.c.setAttribute('transform', `translate(0 ${((1 - eOut(lin(t, c0, c0 + 0.6))) * 16).toFixed(1)})`);
        let [x, y] = kf(A[o.key], t);
        if (o.wax && t > C.wax) {
          const [sx, sy, r] = kf(A.slice, t), k = eOut(lin(t, C.wax, C.wax + 0.35));
          x = mix(x, sx - r * 0.5, k); y = mix(y, sy - r * 0.87, k);
        }
        x = Math.max(24, x);
        const dy = 16 - (1 - eOut(lin(t, c0, c0 + 0.6))) * 16;
        const gy = eOut(lin(t, c0 + 0.1, c0 + 0.6));
        const ty = mix(256, y, gy) - dy, tx = mix(o.lx, x, gy);
        o.ln.setAttribute('d', `M${o.lx},${256 - dy}V${300 - dy}L${tx},${ty}`);
        o.dot.setAttribute('cx', x); o.dot.setAttribute('cy', y - dy);
        o.ring.setAttribute('cx', x); o.ring.setAttribute('cy', y - dy);
        const ph = ((t - c0) * 1.2) % 1;
        o.ring.setAttribute('r', 10 + 22 * ph); o.ring.style.opacity = 1 - ph;
        show(o.dot, gy); show(o.ring, gy);
      });
    }
    // C5/C6 切面
    {
      const a = win(t, C.wax + 0.3, C.s4 - 0.1, 0.4, 0.9) * (1 - 0.6 * lin(t, C.collagen, C.collagen + 0.5) * (1 - lin(t, C.antlerFreeze, C.antlerFreeze + 0.4)));
      show(N.sl, a);
      if (a > 0) {
        const [x, y, r] = kf(A.slice, t), R = r * 1.1, s = R / 100;
        N.slRot.setAttribute('transform', `translate(${x} ${y}) rotate(${((t - C.wax) * 5).toFixed(2)}) scale(${s.toFixed(3)})`);
        N.ticks.setAttribute('stroke-width', (1.4 / s).toFixed(3));
        N.slRing.setAttribute('stroke-width', (1.6 / s).toFixed(3));
        N.slRing.setAttribute('stroke-dasharray', `${eOut(lin(t, C.wax + 0.35, C.wax + 2.0)).toFixed(3)} 1`);
        const o = R + 14, L = 70;
        N.slCross.setAttribute('d', `M${x - o - L},${y}H${x - o}M${x + o},${y}H${x + o + L}M${x},${y - o - L}V${y - o}M${x},${y + o}V${y + o + L}`);
        const ma = lin(t, C.wax + 1.6, C.wax + 2.1) * (1 - lin(t, C.collagen - 0.3, C.collagen + 0.2));
        const sx = x + R * 0.72, sy = y - R * 0.69, ex = Math.min(sx + 110, 1560), ey = Math.max(sy - 60, 150);
        N.slL.setAttribute('d', `M${sx},${sy}L${ex},${ey}H${ex + 260}`);
        N.slM.setAttribute('x', ex + 8); N.slM.setAttribute('y', ey - 12);
        show(N.slL, ma); show(N.slM, ma);
      }
    }
  }
  return { build, render };
})();
