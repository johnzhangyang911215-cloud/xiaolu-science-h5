/* 第 7 幕「效 · 28 天抗皱功效」（s5 → s8）：画面为 AI 生成的肌肤微距 → 晨雾静水面（真实产品盒与安瓶在合成里立于水面，带倒影与涟漪）。
   代码只排右侧功效面板：dataIn 时展开，主数字先锁定，其余三项在 dataLock 前依次锁定，脚注随后出现。 */
window.SEG8 = (function () {
  'use strict';
  const { lin, eOut } = window.PV;
  const C = window.FILM.cues;
  const $ = (id) => document.getElementById(id);
  const IN = C.dataIn, LOCK = C.dataLock, OUT = C.s8 - 0.9;
  const DATA = [
    { id: 's5-l1', tag: 's5-h1', v: 30.96, dir: '↓', hero: true },
    { id: 's5-l2', tag: 's5-h1', v: 23.65, dir: '↓' },
    { id: 's5-l3', tag: 's5-h2', v: 34.68, dir: '↑' },
    { id: 's5-l4', tag: 's5-h2', v: 35.18, dir: '↑' }
  ];
  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; };
  let box, head, note, cells = [];

  function build(TXT) {
    box = $('eff'); box.textContent = '';
    head = el('div', 'eh', box);
    el('div', 'et', head, TXT['s5-title']);
    const d = el('div', 'ed', head); const m = /^(\d+)(.*)$/.exec(TXT['s5-days']) || ['', '', TXT['s5-days']];
    el('b', '', d, m[1]); d.appendChild(document.createTextNode(m[2]));
    const heroBox = el('div', '', box), sec = el('div', 'erow', box);
    cells = DATA.map((D, i) => {
      const c = el('div', 'ec' + (D.hero ? ' hero' : ''), D.hero ? heroBox : sec);
      const lab = el('div', 'el', c); el('em', '', lab, TXT[D.tag]); lab.appendChild(document.createTextNode(TXT[D.id]));
      const n = el('div', 'en', c); el('i', 'dir', n, D.dir); const num = el('span', '', n, '00.00'); el('i', 'pct', n, '%');
      const t0 = IN + 0.15 + i * 0.12, t1 = i === 0 ? IN + 1.4 : IN + 1.4 + i * (LOCK - IN - 1.4) / 3;
      return { c, num, v: D.v, t0, t1 };
    });
    note = el('div', 'enote', box, TXT['s5-note']);
  }

  function render(t) {
    const a = Math.min(lin(t, IN - 0.1, IN + 0.6), 1 - lin(t, OUT - 0.35, OUT + 0.25));
    box.style.opacity = a.toFixed(3);
    box.style.visibility = a > 0.001 ? 'visible' : 'hidden';
    box.style.transform = `translateX(${(1 - eOut(lin(t, IN - 0.1, IN + 0.8))) * 30}px)`;
    for (const N of cells) {
      N.c.style.opacity = eOut(lin(t, N.t0, N.t0 + 0.5)).toFixed(3);
      const u = lin(t, N.t0, N.t1), k = u >= 1 ? 1 : 1 - Math.pow(2, -10 * u);
      const s = (u >= 1 ? N.v : Math.floor(N.v * k * 100) / 100).toFixed(2).padStart(5, '0');
      if (N.num.textContent !== s) N.num.textContent = s;
    }
    note.style.opacity = lin(t, 74.6, 75.2).toFixed(3);
  }
  return { build, render };
})();
