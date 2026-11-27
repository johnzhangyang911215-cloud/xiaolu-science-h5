/* 尾卡（s8 → end）：背景为 AI 生成的象牙白暖光空间，真实产品盒与安瓶先在其中亮相。
   logo 卡点时产品过曝溶白，房间退为干净的象牙纯色；华大BGI 与华大小鹿双标作为一个整体由虚到实显影，
   一道金色扫光掠过标识，细金线引出「把时间，还给肌肤」与品名。标识静止，不做推拉，所有状态都是 t 的纯函数。 */
window.SEG9 = (function () {
  'use strict';
  const C = window.FILM.cues;
  const T0 = C.s8, LOGO = C.logo, FADE = C.fadeOut;
  const BOX_AR = 1400 / 1008, AMP_AR = 181 / 1000;
  const AMP = [1200, 450, 450], BOX = [560, 520, 400];
  const SHOW_A = T0 + 0.05, SHOW_B = T0 + 0.6;
  const BURN_A = LOGO - 0.12, BURN_B = LOGO + 0.7;    // 产品过曝溶白
  const WASH_A = LOGO - 0.1, WASH_B = LOGO + 1.1;     // 房间退为象牙纯色
  const MARK_A = LOGO + 0.55, MARK_B = LOGO + 1.85;   // 双标由虚到实
  const GLINT_A = LOGO + 1.9, GLINT_B = LOGO + 3.0;   // 金色扫光
  const RULE_A = LOGO + 2.45, RULE_B = LOGO + 3.15;   // 细金线
  const LINE_A = LOGO + 2.7, LINE_B = LOGO + 3.7;
  const NAME_A = LOGO + 3.2, NAME_B = LOGO + 4.1;
  const OUT_A = FADE + 0.7, OUT_B = FADE + 1.7;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const eOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; };
  const place = (e, l, ar) => { e.style.left = l[0] + 'px'; e.style.top = l[1] + 'px'; e.style.height = l[2] + 'px'; e.style.width = (l[2] * ar).toFixed(1) + 'px'; };
  const decode = (img) => (img.decode ? img.decode() : Promise.resolve()).catch(() => {});

  let root, prod, amp, box, wash, flare, mark, glints, rule, line, name, ready = false;

  function build(TXT) {
    root = document.getElementById('fin');
    wash = el('div', 'f-wash', root);
    prod = el('div', 'f-prod', root);
    const sh = el('i', 'f-shadow', prod); sh.style.cssText = 'left:500px;top:888px;width:1000px;height:64px';
    box = el('img', 'f-box', prod); box.alt = ''; box.src = '../film/assets/products/box-20.webp'; place(box, BOX, BOX_AR);
    amp = el('img', 'f-amp', prod); amp.alt = ''; amp.src = '../film/assets/products/ampoule-up.webp'; place(amp, AMP, AMP_AR);
    flare = el('div', 'f-flare', root);
    mark = el('div', 'f-mark', root);
    const bgi = el('span', 'f-bgi', mark); bgi.setAttribute('role', 'img'); bgi.setAttribute('aria-label', TXT['s8-bgi']);
    el('i', 'f-bar', mark);
    const lg = el('span', 'f-logo', mark); lg.setAttribute('role', 'img'); lg.setAttribute('aria-label', '华大小鹿 YOUTH MESSAGER');
    glints = [el('i', 'f-glint', bgi), el('i', 'f-glint', lg)];
    rule = el('i', 'f-rule', root);
    line = el('div', 'f-line', root, TXT['s8-line']);
    name = el('div', 'f-name', root); TXT['s8-name'].split('\n').forEach((l, i) => el(i ? 'span' : 'b', '', name, l));
    const pre = (src) => { const i = new Image(); i.src = src; return decode(i); };
    return Promise.all([decode(amp), decode(box), pre('../film/assets/brand/logo-h.svg'), pre('../film/assets/brand/bgi-blue.svg')]).then(() => { ready = true; });
  }

  function render(t) {
    if (!ready) return;
    const on = t >= T0 - 0.05;
    root.style.visibility = on ? 'visible' : 'hidden';
    if (!on) return;

    const burn = smooth(BURN_A, BURN_B, t);
    prod.style.opacity = (smooth(SHOW_A, SHOW_B, t) * (1 - burn)).toFixed(3);
    prod.style.transform = 'scale(' + (0.985 + 0.03 * smooth(T0, LOGO, t) + 0.05 * eOut(burn)).toFixed(4) + ')';
    prod.style.filter = burn > 0.001 ? `brightness(${(1 + 0.9 * burn).toFixed(3)}) blur(${(10 * burn * burn).toFixed(2)}px)` : 'none';
    wash.style.opacity = (0.94 * smooth(WASH_A, WASH_B, t)).toFixed(3);
    flare.style.opacity = (Math.sin(Math.PI * clamp((t - BURN_A) / (BURN_B + 0.4 - BURN_A), 0, 1)) * 0.85).toFixed(3);

    const m = smooth(MARK_A, MARK_B, t), out = smooth(OUT_A, OUT_B, t);
    mark.style.opacity = m.toFixed(3);
    mark.style.filter = m < 0.999 ? `blur(${(14 * (1 - eOut(m))).toFixed(2)}px)` : 'none';
    mark.style.transform = 'scale(' + (1.035 - 0.035 * eOut(m)).toFixed(4) + ')';
    const g = smooth(GLINT_A, GLINT_B, t);
    glints.forEach((e) => { e.style.backgroundPosition = (115 - 130 * g).toFixed(1) + '% 0'; e.style.opacity = (g > 0 && g < 1 ? 1 : 0); });

    const r = smooth(RULE_A, RULE_B, t);
    rule.style.transform = 'scaleX(' + eOut(r).toFixed(3) + ')';
    rule.style.opacity = (r * (1 - out)).toFixed(3);
    const la = smooth(LINE_A, LINE_B, t);
    line.style.opacity = (la * (1 - out)).toFixed(3);
    line.style.filter = la < 0.999 ? `blur(${(6 * (1 - la)).toFixed(2)}px)` : 'none';
    line.style.letterSpacing = (0.5 - 0.08 * eOut(la)).toFixed(3) + 'em';
    const na = smooth(NAME_A, NAME_B, t);
    name.style.opacity = (na * (1 - out)).toFixed(3);
  }

  return { build, render };
})();
