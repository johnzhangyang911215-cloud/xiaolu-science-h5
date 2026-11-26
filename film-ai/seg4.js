/* 第 4 幕「研」（s4 → s6）：营养光粒环六成分逐拍点名 → 晨光书桌上的期刊与系统发育树。金棕色，只排字与细线。 */
window.SEG4 = (function () {
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

  // 营养环：中心与半径按 K4a 成片光环量取（1920×1080）
  const RING = { x: 960, y: 540, rx: 560, ry: 380 };
  const COMP = [['s4-c1', 36.6], ['s4-c2', 37.13], ['s4-c3', 37.66], ['s4-c4', 38.19], ['s4-c5', 38.72], ['s4-c6', 39.25]];
  const RING_OUT = C.journal - 0.25;
  // 系统发育树（同 film/ 正片拓扑：梯状，鹿科一支金色），放在书桌画面右侧留白
  const J = C.journal, J_OUT = 45.0;
  const LEAF_X = 1580, LEAVES = ['s4-t1', 's4-t2', 's4-t3', 's4-t4', 's4-t5', 's4-t6'].map((id, i) => [id, 330 + i * 74]);
  const NX = [1150, 1240, 1330, 1420, 1500];
  let ring = [], tree = [], head, cap, rule;

  function build(svg, TXT) {
    COMP.forEach(([id, tin], i) => {
      const ang = (-90 + i * 60) * Math.PI / 180;
      const x = RING.x + RING.rx * Math.cos(ang), y = RING.y + RING.ry * Math.sin(ang);
      const g = el('g', { class: 's4c' }, svg);
      const dot = el('circle', { cx: x, cy: y, r: 6, fill: '#fff6e6', stroke: GOLD, 'stroke-width': 1.6 }, g);
      const halo = el('circle', { cx: x, cy: y, r: 6, fill: 'none', stroke: '#f4dfb4', 'stroke-width': 1.6 }, g);
      const right = Math.cos(ang) > 0.2, left = Math.cos(ang) < -0.2;
      const tx = x + (right ? 22 : left ? -22 : 0), ty = y + (right || left ? 14 : (Math.sin(ang) < 0 ? -26 : 52));
      const txt = el('text', { x: tx, y: ty, class: 'ht', 'text-anchor': right ? 'start' : left ? 'end' : 'middle',
        'font-family': '"XL Serif",serif', 'font-size': 44, 'letter-spacing': 6, fill: INK }, g, TXT[id]);
      ring.push({ g, dot, halo, txt, tin });
    });

    head = el('text', { x: NX[0], y: 240, class: 'ht', 'font-family': '"XL Serif",serif', 'font-style': 'italic',
      'font-size': 50, 'letter-spacing': 2, fill: INK }, svg, TXT['s4-j-k']);
    rule = el('line', { x1: NX[0], y1: 268, x2: LEAF_X + 160, y2: 268, stroke: GOLD, 'stroke-width': 1.4, 'stroke-opacity': 0.55, pathLength: 1 }, svg);
    // 节点 y 取两子的中点；梯状：n_i 连 leaf_i 与 n_{i+1}，n5 连 leaf5 / leaf6
    const ly = LEAVES.map((l) => l[1]);
    const ny = []; ny[4] = (ly[4] + ly[5]) / 2;
    for (let i = 3; i >= 0; i--) ny[i] = (ly[i] + ny[i + 1]) / 2;
    const seg = (d, deer, t0) => {
      const p = el('path', { d, fill: 'none', stroke: deer ? GOLD : '#8d7a66', 'stroke-width': deer ? 3 : 1.8,
        'stroke-linecap': 'round', pathLength: 1 }, svg);
      tree.push({ p, t0, deer });
    };
    const step = 0.32;
    seg(`M${NX[0] - 60} ${ny[0]}H${NX[0]}`, true, J + 0.2);
    for (let i = 0; i < 5; i++) {
      const t0 = J + 0.2 + (i + 1) * step;
      // 上支 → leaf_i
      seg(`M${NX[i]} ${ny[i]}V${ly[i]}H${LEAF_X}`, i === 3, t0);
      // 下支 → 下一节点或 leaf6
      if (i < 4) seg(`M${NX[i]} ${ny[i]}V${ny[i + 1]}H${NX[i + 1]}`, i < 3, t0);
      else seg(`M${NX[i]} ${ny[i]}V${ly[5]}H${LEAF_X}`, false, t0);
    }
    LEAVES.forEach(([id, y], i) => {
      const deer = id === 's4-t4';
      const t = el('text', { x: LEAF_X + 18, y: y + 13, class: 'ht', 'font-family': '"XL Serif",serif',
        'font-size': deer ? 40 : 34, 'letter-spacing': 4, fill: deer ? GOLD : SOFT }, svg, TXT[id]);
      tree.push({ t, t0: J + 0.2 + (Math.min(i, 4) + 1) * step + 0.35, deer });
    });
    cap = $('t-sub4'); cap.textContent = TXT['s4-j-cap'].replace('，', '\n');
  }

  function render(t) {
    // 营养环：每个成分踩点落下（小点 + 一圈涟漪 + 文字由虚到实），进期刊前一起淡出
    const ringOut = 1 - lin(t, RING_OUT - 0.5, RING_OUT);
    ring.forEach((r) => {
      const a = Math.min(lin(t, r.tin - 0.05, r.tin + 0.3), ringOut);
      show(r.g, a);
      const k = eOut(lin(t, r.tin, r.tin + 0.9));
      r.halo.setAttribute('r', mix(6, 34, k)); r.halo.style.opacity = ((1 - k) * (k > 0)).toFixed(3);
      r.txt.style.filter = `blur(${(1 - eOut(lin(t, r.tin, r.tin + 0.45))) * 8}px)`;
    });
    // 期刊：标题、细线、树由根到叶描出，叶名随枝到达出现
    const out = 1 - lin(t, J_OUT - 0.6, J_OUT);
    const ha = Math.min(lin(t, J, J + 0.5), out);
    show(head, ha);
    head.style.filter = `blur(${(1 - eOut(lin(t, J, J + 0.5))) * 6}px)`;
    show(rule, ha); rule.style.strokeDasharray = `${eOut(lin(t, J + 0.1, J + 1.1))} 1`;
    tree.forEach((n) => {
      if (n.p) {
        const k = eOut(lin(t, n.t0, n.t0 + 0.45));
        n.p.style.strokeDasharray = `${k} 1`; show(n.p, Math.min(k > 0 ? 1 : 0, out));
      } else {
        show(n.t, Math.min(lin(t, n.t0, n.t0 + 0.4), out));
        n.t.style.transform = `translateX(${(1 - eOut(lin(t, n.t0, n.t0 + 0.6))) * -10}px)`;
      }
    });
    // 鹿科一支到达后轻微暖光一次
    const g = $('glow'), gk = lin(t, J + 2.0, J + 3.6);
    if (gk > 0 && gk < 1) {
      g.style.setProperty('--gx', (LEAF_X / 1920 * 100) + '%'); g.style.setProperty('--gy', (LEAVES[3][1] / 1080 * 100) + '%');
      g.style.opacity = (0.26 * Math.sin(Math.PI * gk)).toFixed(3);
    }
    const ca = win(t, 41.3, 45.75, 0.6, 0.5);
    show(cap, ca);
    cap.style.transform = `translateY(${(1 - eOut(lin(t, 41.3, 42.1))) * 12}px)`;
  }
  return { build, render };
})();
