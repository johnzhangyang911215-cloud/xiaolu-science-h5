/* 第 2–3 幕（s2 → s4）：鹿 → 鹿茸 → 分层 → 蜡片 → 原料数据。金棕色，只在 cue 重拍上做一次点缀。 */
window.SEG2 = (function () {
  'use strict';
  const { lin, mix, eOut, win, kf, A } = window.PV;
  const C = window.FILM.cues;
  const NS = 'http://www.w3.org/2000/svg';
  const GOLD = '#b8894a', LIGHT = '#f4dfb4', INK = '#3b2f25';
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const show = (e, a) => { e.style.opacity = a.toFixed(3); e.style.visibility = a > 0.001 ? 'visible' : 'hidden'; };
  const setOp = (e, a, tf) => { show(e, a); if (tf != null) e.style.transform = tf; };
  const numVal = (s) => parseFloat(String(s).replace(/[^\d.]/g, ''));
  let N = {}, TXT = {};

  function build(svg, txt) {
    TXT = txt;
    $('t-name').textContent = txt['s2-name'];
    $('t-sub1').textContent = txt['s2-sub'];
    $('t-sub2').textContent = txt['s3-sub'];
    $('t-two').innerHTML = txt['s3-two'].replace(/(\d+\s*%)/, '<b>$1</b>');
    $('d-h').textContent = txt['s3-dh'];
    $('d1n').textContent = txt['s3-d1n']; $('d2n').textContent = txt['s3-d2n'];
    $('d-note').textContent = txt['s3-dn'];
    const g = el('g', {}, svg);
    // 分层标签：点 + 短引线 + 名称/说明，随各自 cue 出现
    N.cells = [['s3', 'bone', 's3-bone'], ['layerBlood', 'blood', 's3-blood'], ['layerPowder', 'powder', 's3-powder'], ['wax', 'waxTip', 's3-wax']]
      .map(([cue, key, id], i) => {
        const c = el('g', { opacity: 0 }, g), wax = i === 3;
        const ln = el('path', { fill: 'none', stroke: GOLD, 'stroke-width': 1.6, opacity: 0.85 }, c);
        const ring = el('circle', { r: 10, fill: 'none', stroke: LIGHT, 'stroke-width': 2 }, c);
        const dot = el('circle', { r: 6, fill: '#fff6e6', stroke: GOLD, 'stroke-width': 2 }, c);
        const nm = el('text', { 'font-family': '"XL Serif",serif', 'font-size': wax ? 54 : 44, 'letter-spacing': 8, fill: wax ? '#8a5a22' : INK, class: 'ht' }, c);
        nm.textContent = txt[id];
        const ds = el('text', { 'font-family': '"XL Sans",sans-serif', 'font-size': 24, 'letter-spacing': 2, fill: '#5e4a38', class: 'ht' }, c);
        ds.textContent = txt[id + '-d'];
        return { cue, key, c, ln, ring, dot, nm, ds, wax };
      });
    // 蜡片切面：一圈金线
    N.slRing = el('circle', { fill: 'none', stroke: LIGHT, 'stroke-width': 2.4, pathLength: 1, opacity: 0 }, g);
    N.slRing2 = el('circle', { fill: 'none', stroke: GOLD, 'stroke-width': 1.2, pathLength: 1, opacity: 0 }, g);
  }

  function glowAt(x, y, a) {
    const gl = $('glow');
    gl.style.setProperty('--gx', (x / 19.2) + '%'); gl.style.setProperty('--gy', (y / 10.8) + '%');
    gl.style.opacity = a.toFixed(3);
  }

  function render(t) {
    if (t < C.s2 - 0.1 || t > C.s4 + 0.1) { if (N.cells) N.cells.forEach((o) => show(o.c, 0)); return; }
    // 标题与字幕
    {
      const e = $('t-name'), a = win(t, 7.9, 11.6, 0.9, 0.7);
      setOp(e, a, `translateX(${mix(-20, 30, lin(t, 7.9, 11.6))}px)`);
      e.style.letterSpacing = mix(0.55, 0.32, eOut(lin(t, 7.9, 9.2))).toFixed(3) + 'em';
      e.style.filter = `blur(${(1 - eOut(lin(t, 7.9, 8.7))) * 12}px)`;
    }
    setOp($('t-sub1'), win(t, C.ring + 0.25, 21.1, 0.6, 0.45), `translateY(${(1 - eOut(lin(t, C.ring + 0.25, C.ring + 1))) * 14}px)`);
    setOp($('t-sub2'), win(t, C.s3 + 0.2, C.layerPowder - 0.1, 0.6, 0.45), `translateY(${(1 - eOut(lin(t, C.s3 + 0.2, C.s3 + 0.9))) * 14}px)`);
    // antlerGlow：茸根一次暖光；ring：茸尖一次暖光
    if (t > C.antlerGlow - 0.2 && t < C.antlerGlow + 1.8) {
      const [lx, ly] = kf(A.burrL, t), [rx, ry] = kf(A.burrR, t);
      glowAt((lx + rx) / 2, (ly + ry) / 2, 0.38 * Math.sin(Math.PI * lin(t, C.antlerGlow - 0.1, C.antlerGlow + 1.6)));
    } else if (t > C.ring - 0.2 && t < C.ring + 1.8) {
      const [x, y] = kf(A.tip, t);
      glowAt(x, y, 0.32 * Math.sin(Math.PI * lin(t, C.ring - 0.1, C.ring + 1.6)));
    } else if (t > C.wax - 0.2 && t < C.wax + 1.8) {
      const [x, y] = kf(A.slice, t);
      glowAt(x, y, 0.28 * Math.sin(Math.PI * lin(t, C.wax - 0.1, C.wax + 1.6)));
    } else glowAt(960, 540, 0);
    // 分层标签
    const OUT = C.wax + 1.3;
    N.cells.forEach((o, i) => {
      const c0 = C[o.cue];
      let a = Math.min(lin(t, c0, c0 + 0.4), o.wax ? 1 - lin(t, OUT - 0.45, OUT) : 1 - lin(t, C.wax - 0.3, C.wax - 0.05));
      const nx = N.cells[i + 1];
      if (nx && t > C[nx.cue]) a *= 0.5;
      show(o.c, a);
      if (a <= 0) return;
      let [x, y] = kf(A[o.key], t);
      if (o.wax && t > C.wax) {
        const [sx, sy, r] = kf(A.slice, t), k = eOut(lin(t, C.wax, C.wax + 0.35));
        x = mix(x, sx - r * 0.5, k); y = mix(y, sy - r * 0.87, k);
      }
      x = Math.max(60, x);
      const up = eOut(lin(t, c0 + 0.05, c0 + 0.55)), L = 120 * up;
      // 顶部空间不足时改为向左横引，文字右对齐
      const side = y - 120 - 18 - 40 - 54 < 70;
      const anc = side ? 'end' : 'start';
      o.nm.setAttribute('text-anchor', anc); o.ds.setAttribute('text-anchor', anc);
      let tx, ty;
      if (side) {
        tx = x - 8 - L - 18; ty = y + 40;
        o.ln.setAttribute('d', `M${x - 8},${y}H${x - 8 - L}`);
      } else {
        tx = Math.min(Math.max(x, 70), 1600); ty = y - L - 18;
        o.ln.setAttribute('d', `M${x},${y - 8}V${y - 8 - L}`);
      }
      o.dot.setAttribute('cx', x); o.dot.setAttribute('cy', y);
      const r = eOut(lin(t, c0, c0 + 0.9));
      o.ring.setAttribute('cx', x); o.ring.setAttribute('cy', y);
      o.ring.setAttribute('r', mix(6, 34, r)); o.ring.style.opacity = (1 - r).toFixed(3);
      o.nm.setAttribute('x', tx - 4); o.nm.setAttribute('y', ty - 40);
      o.ds.setAttribute('x', tx - 4); o.ds.setAttribute('y', ty - 4);
      o.nm.style.opacity = up.toFixed(3); o.ds.style.opacity = lin(t, c0 + 0.35, c0 + 0.8).toFixed(3);
    });
    // 蜡片切面：金线绕一圈，后随切面淡出
    {
      const a = win(t, C.wax + 0.25, C.collagen + 0.2, 0.2, 0.6);
      const [x, y, r] = kf(A.slice, t), k = eOut(lin(t, C.wax + 0.25, C.wax + 1.9));
      [[N.slRing, r * 1.06, 1], [N.slRing2, r * 1.14, 0.7]].forEach(([e, R, m], i) => {
        e.setAttribute('cx', x); e.setAttribute('cy', y); e.setAttribute('r', R);
        e.setAttribute('transform', `rotate(${-90 + i * 30} ${x} ${y})`);
        e.style.strokeDasharray = `${mix(0, 1, i ? eOut(lin(t, C.wax + 0.5, C.wax + 2.1)) : k)} 1`;
        e.style.opacity = (a * m).toFixed(3);
      });
    }
    // 2%
    {
      const T = C.wax + 1.5, e = $('t-two'), a = win(t, T, C.collagen - 0.15, 0.6, 0.45);
      setOp(e, a, `scale(${mix(1.04, 1, eOut(lin(t, T, T + 1.3)))})`);
      e.style.filter = `blur(${(1 - eOut(lin(t, T, T + 0.7))) * 10}px)`;
    }
    // 原料数据
    {
      const base = C.collagen, a0 = win(t, base, C.s4 + 1, 0.6, 0.3);
      $('veil').style.opacity = Math.min(a0, 1 - lin(t, C.s4 - 0.7, C.s4)).toFixed(3);
      const items = ['d-h', 'd1n', 'd1v', 'd2n', 'd2v', 'd-note'], delay = [0, 0.18, 0.18, 0.42, 0.42, 0.75];
      items.forEach((id, i) => {
        const a = Math.min(a0, 1 - lin(t, C.s4 - 0.6, C.s4), lin(t, base + delay[i], base + delay[i] + 0.5));
        setOp($(id), a, `translateY(${(1 - eOut(lin(t, base + delay[i], base + delay[i] + 0.7))) * 18}px)`);
      });
      const cnt = (id, key, d) => {
        const v = numVal(TXT[key]), p = eOut(lin(t, base + d, base + d + 1.064));
        $(id).textContent = '↑' + (v * p).toFixed(2) + '%';
        const m = $(id.replace('v', 'm'));
        m.style.width = (v * p * 7.6).toFixed(1) + 'px'; m.style.opacity = $(id).style.opacity;
      };
      cnt('d1v', 's3-d1v', 0.18); cnt('d2v', 's3-d2v', 0.42);
    }
  }
  return { build, render };
})();
