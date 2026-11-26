/* 第 5 幕「冻」（s6 → s7）：−40℃ 冻干 → 真实安瓶立于霜石台，两条金色细标踩点指向冻干仓 / 溶媒仓 → 收回、推向分隔。 */
window.SEG6 = (function () {
  'use strict';
  const { lin, mix, eOut, win } = window.PV;
  const C = window.FILM.cues;
  const NS = 'http://www.w3.org/2000/svg';
  const GOLD = '#a8773a', INK = '#3b2f25', SOFT = '#7b6a5b';
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs, parent, txt) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (txt != null) e.textContent = txt;
    if (parent) parent.appendChild(e);
    return e;
  };
  const show = (e, a) => { e.style.opacity = a.toFixed(3); e.style.visibility = a > 0.001 ? 'visible' : 'hidden'; };
  const eIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  // 与合成脚本 /tmp/xl/s6/comp6.py 同一组参数：安瓶在合成画面中的位置与镜头推近
  const AK = 0.56, AX = 960 - 207 * AK / 2, AY = 730 - 1094 * AK;
  const amp = (u, v) => [AX + u * AK, AY + v * AK];
  function cam(t) {
    const k1 = lin(t, C.labelPowder, C.close), k2 = eIO(lin(t, C.close, C.s7 - 0.25));
    const s = (1 + 0.06 * k1) * mix(1, 1.25, k2);
    return { s, fy: mix(560, 640, k2), sy: mix(560, 600, k2) };
  }
  const proj = (p, c) => [960 + (p[0] - 960) * c.s, c.sy + (p[1] - c.fy) * c.s];

  const LABELS = [
    { id: 's6-powder', tin: C.labelPowder, anchor: amp(198, 1030), tx: 1330, ty: 700 },
    { id: 's6-solvent', tin: C.labelSolvent, anchor: amp(194, 640), tx: 1330, ty: 440 }
  ];
  let labs = [], schema;

  function build(svg, TXT) {
    LABELS.forEach((L) => {
      const g = el('g', {}, svg);
      const line = el('path', { fill: 'none', stroke: GOLD, 'stroke-width': 1.8, 'stroke-linecap': 'round', pathLength: 1 }, g);
      const dot = el('circle', { r: 5, fill: '#fff6e6', stroke: GOLD, 'stroke-width': 1.6 }, g);
      const halo = el('circle', { r: 5, fill: 'none', stroke: '#f4dfb4', 'stroke-width': 1.6 }, g);
      const [l1, l2] = TXT[L.id].split('\n');
      const t1 = el('text', { x: L.tx + 18, y: L.ty - 14, class: 'ht', 'font-family': '"XL Serif",serif', 'font-size': 46,
        'letter-spacing': 6, fill: INK }, g, l1);
      const t2 = el('text', { x: L.tx + 18, y: L.ty + 36, class: 'ht', 'font-family': '"XL Sans",sans-serif', 'font-size': 28,
        'letter-spacing': 2, fill: GOLD }, g, l2);
      labs.push({ ...L, g, line, dot, halo, t1, t2 });
    });
    schema = el('text', { x: 1330 + 18, y: 340, class: 'ht', 'font-family': '"XL Sans",sans-serif', 'font-size': 24,
      'letter-spacing': 4, fill: SOFT }, svg, TXT['s6-schema']);
    $('t-temp').textContent = TXT['s6-temp'];
    $('t-title6').textContent = TXT['s6-title'];
    $('t-lock').textContent = TXT['s6-lock'].replace('，', '，\n');
  }

  function render(t) {
    // −40℃ 与标题：冻结时由虚到实
    const ta = win(t, 48.6, 50.95, 0.5, 0.5);
    show($('t-temp'), ta);
    $('t-temp').style.filter = `blur(${(1 - eOut(lin(t, 48.6, 49.2))) * 8}px)`;
    $('t-temp').style.letterSpacing = mix(0.3, 0.06, eOut(lin(t, 48.6, 49.6))).toFixed(3) + 'em';
    const tt = win(t, 48.3 + 0.6, 50.95, 0.6, 0.5);
    show($('t-title6'), tt);
    $('t-title6').style.transform = `translateY(${(1 - eOut(lin(t, 48.9, 49.7))) * 12}px)`;
    // 细标：锚点跟随推镜；踩点时点亮一圈涟漪，线从瓶身描向文字；close 时收回
    const c = cam(t), back = 1 - lin(t, C.close - 0.05, C.close + 0.5);
    labs.forEach((L) => {
      const k = eOut(lin(t, L.tin, L.tin + 0.55));
      const a = Math.min(lin(t, L.tin - 0.05, L.tin + 0.15), back);
      show(L.g, a);
      const [ax, ay] = proj(L.anchor, c);
      const ex = L.tx, mx = mix(ax + 60, ex - 40, 0.35);
      L.line.setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)}L${mx.toFixed(1)} ${L.ty}H${ex}`);
      L.line.style.strokeDasharray = `${k * back} 1`;
      L.dot.setAttribute('cx', ax.toFixed(1)); L.dot.setAttribute('cy', ay.toFixed(1));
      L.halo.setAttribute('cx', ax.toFixed(1)); L.halo.setAttribute('cy', ay.toFixed(1));
      const h = eOut(lin(t, L.tin, L.tin + 0.9));
      L.halo.setAttribute('r', mix(5, 30, h)); L.halo.style.opacity = ((1 - h) * (h > 0)).toFixed(3);
      const ta2 = Math.min(lin(t, L.tin + 0.3, L.tin + 0.75), back);
      show(L.t1, ta2); show(L.t2, Math.min(lin(t, L.tin + 0.5, L.tin + 0.95), back));
      L.t1.style.filter = `blur(${(1 - eOut(lin(t, L.tin + 0.3, L.tin + 0.75))) * 6}px)`;
    });
    show(schema, Math.min(lin(t, C.labelPowder + 0.6, C.labelPowder + 1.1), back) * 0.9);
    // 收束字幕
    const la = win(t, 54.4 + 1.0, 57.45, 0.7, 0.45);
    show($('t-lock'), la);
    $('t-lock').style.transform = `translateY(${(1 - eOut(lin(t, 55.4, 56.2))) * 12}px)`;
  }
  return { build, render, cam };
})();
