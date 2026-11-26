/* 第 6 幕「释 · 使用三步」（s7 → s5）：画面为 AI 生成的拉环 → 按压 → 落粉 → 摇匀 → 掰开 → 落滴。
   代码只排左侧一列步骤：踩点时当前步骤点亮、前一步退为浅色；按压与掰断的光脉冲在合成画面里完成。 */
window.SEG7 = (function () {
  'use strict';
  const { lin, mix, eOut, win } = window.PV;
  const C = window.FILM.cues;
  const $ = (id) => document.getElementById(id);
  const show = (e, a) => { e.style.opacity = a.toFixed(3); e.style.visibility = a > 0.001 ? 'visible' : 'hidden'; };

  const T_IN = [57.9, 60.1, 63.55, 65.67];
  const END = C.s5 - 0.35;
  // 使用方法按用户确认的动作改写：倒置双手按压 → 摇匀 → 掰开后 45° 滴出
  const STEP = { 2: '02 倒置按压：一手握瓶，另一手自上而下按下尾盖', 4: '04 掰开滴出：拿走瓶头，瓶身 45° 朝下滴出精华' };
  let rows = [];

  function build(TXT) {
    $('t-head7').textContent = TXT['s7-head'];
    const box = $('steps');
    box.textContent = '';
    rows = [1, 2, 3, 4].map((n, i) => {
      const raw = STEP[n] || TXT['s7-' + n];
      const m = raw.match(/^(\d+)\s*([^：]+)：(.*)$/);
      const r = document.createElement('div');
      r.className = 'st';
      const num = document.createElement('b'); num.textContent = m ? m[1] : String(n).padStart(2, '0');
      const name = document.createElement('span'); name.className = 'sn'; name.textContent = m ? m[2] : raw;
      const desc = document.createElement('span'); desc.className = 'sd'; desc.textContent = m ? m[3] : '';
      r.append(num, name, desc);
      box.appendChild(r);
      return { r, desc, tin: T_IN[i], tnext: T_IN[i + 1] ?? 999 };
    });
  }

  function render(t) {
    const out = 1 - lin(t, END - 0.5, END);
    const head = $('t-head7');
    show(head, Math.min(lin(t, 57.9, 58.6), out));
    head.style.filter = `blur(${(1 - eOut(lin(t, 57.9, 58.5))) * 8}px)`;
    head.style.transform = `translateY(${(1 - eOut(lin(t, 57.9, 58.8))) * 12}px)`;
    if (t >= C.s7) $('veil').style.opacity = (0.9 * Math.min(lin(t, C.s7 + 0.1, C.s7 + 0.8), out)).toFixed(3);
    rows.forEach((R, i) => {
      const k = eOut(lin(t, R.tin, R.tin + 0.5));
      const a = Math.min(k, out);
      // 当前步骤为深色，下一步出现后退为浅色
      const dim = lin(t, R.tnext - 0.1, R.tnext + 0.35);
      R.r.style.opacity = (a * mix(1, 0.42, dim)).toFixed(3);
      R.r.style.visibility = a > 0.001 ? 'visible' : 'hidden';
      R.r.style.transform = `translateX(${(1 - k) * -18}px)`;
      R.r.style.filter = `blur(${(1 - k) * 5}px)`;
      R.desc.style.opacity = mix(1, 0.0, dim).toFixed(3);
      R.r.style.setProperty('--u', (eOut(lin(t, R.tin + 0.2, R.tin + 0.7)) * (1 - dim)).toFixed(3));
    });
  }
  return { build, render };
})();
