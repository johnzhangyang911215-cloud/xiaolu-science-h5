/* 尾卡（s8 → end）：功效之后白场进入干净的象牙画面，只有一句「把时间，还给肌肤」由虚到实，细金线随之展开；
   下一小节（logo + 1 小节 ≈ 85.10）硬切：文案消失，华大BGI 与华大小鹿双标直接出现，一道金色扫光掠过后静止到结束。
   背景（暖光文案底 → 平光象牙底）已合成在 film.mp4 里，此处只排字与标识，所有状态都是 t 的纯函数。 */
window.SEG9 = (function () {
  'use strict';
  const C = window.FILM.cues;
  const T0 = C.s8, CUT = C.logo + 2.128;
  const LINE_A = T0 + 0.25, LINE_B = T0 + 1.35;      // 文案由虚到实
  const RULE_A = T0 + 0.9, RULE_B = T0 + 1.7;        // 细金线
  const GLINT_A = CUT + 0.45, GLINT_B = CUT + 1.55;  // 金色扫光

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const eOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; };
  const decode = (img) => (img.decode ? img.decode() : Promise.resolve()).catch(() => {});

  let root, mark, glints, rule, line, ready = false;

  function build(TXT) {
    root = document.getElementById('fin'); root.textContent = '';
    line = el('div', 'f-line', root, TXT['s8-line']);
    rule = el('i', 'f-rule', root);
    mark = el('div', 'f-mark', root);
    const bgi = el('span', 'f-bgi', mark); bgi.setAttribute('role', 'img'); bgi.setAttribute('aria-label', TXT['s8-bgi']);
    el('i', 'f-bar', mark);
    const lg = el('span', 'f-logo', mark); lg.setAttribute('role', 'img'); lg.setAttribute('aria-label', '华大小鹿 YOUTH MESSAGER');
    glints = [el('i', 'f-glint', bgi), el('i', 'f-glint', lg)];
    const pre = (src) => { const i = new Image(); i.src = src; return decode(i); };
    return Promise.all([pre('../film/assets/brand/logo-h.svg'), pre('../film/assets/brand/bgi-blue.svg')]).then(() => { ready = true; });
  }

  function render(t) {
    if (!ready) return;
    const on = t >= T0 - 0.05;
    root.style.visibility = on ? 'visible' : 'hidden';
    if (!on) return;
    const pre = t < CUT;

    const la = smooth(LINE_A, LINE_B, t);
    line.style.opacity = pre ? la.toFixed(3) : '0';
    line.style.filter = pre && la < 0.999 ? `blur(${(8 * (1 - la)).toFixed(2)}px)` : 'none';
    line.style.letterSpacing = (0.5 - 0.08 * eOut(la)).toFixed(3) + 'em';
    const r = smooth(RULE_A, RULE_B, t);
    rule.style.opacity = pre ? r.toFixed(3) : '0';
    rule.style.transform = 'scaleX(' + eOut(r).toFixed(3) + ')';

    mark.style.opacity = pre ? '0' : '1';
    const g = smooth(GLINT_A, GLINT_B, t);
    glints.forEach((e) => { e.style.backgroundPosition = (115 - 130 * g).toFixed(1) + '% 0'; e.style.opacity = (g > 0 && g < 1 ? 1 : 0); });
  }

  return { build, render };
})();
