/* Scene 8 · 尾 · 双 Logo (V2, docs/12-v2-revision.md).
   Picks up exactly where scene 5 leaves the 20-pack box and the ampoule (same ivory ground, same layout). On `logo` the dual
   mark 华大BGI | 华大小鹿 (original navy SVG) settles in at the top and the product line appears below the products.
   From `fadeOut` everything fades to ivory white with the music; the last frame is ivory. Plain DOM; render(t) is pure. */
(function () {
  const F = window.FILM;
  const FPS = F.fps;
  const K = {};
  for (const k in F.cueFrames) K[k] = F.cueFrames[k] / FPS;
  const T0 = K.s8, LOGO = K.logo, FADE = K.fadeOut, END = K.end;
  const BOX_AR = 1400 / 1008, AMP_AR = 181 / 1000;
  const AMP = [1200, 330, 450], BOX = [560, 400, 400]; // = scene 5's end layout

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

  let root, prod, amp, box, logos, name, veil, copy = [], lastProbe = null;
  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; };
  const decode = (img) => (img.decode ? img.decode() : Promise.resolve()).catch(() => {});
  const txt = (id) => { const c = copy.find((e) => e.id === id); return c ? c.text : ''; };
  const place = (e, l, ar) => { e.style.left = l[0] + 'px'; e.style.top = l[1] + 'px'; e.style.height = l[2] + 'px'; e.style.width = (l[2] * ar).toFixed(1) + 'px'; };

  function init(stage, entries) {
    copy = entries.filter((e) => e.scene === 8);
    root = el('div', '', stage); root.id = 's8'; root.style.display = 'none';
    el('i', 's8-bg', root);
    prod = el('div', 's8-prod', root);
    box = el('img', 's8-box', prod); box.alt = ''; box.src = 'assets/products/box-20.webp'; place(box, BOX, BOX_AR);
    amp = el('img', 's8-amp', prod); amp.alt = ''; amp.src = 'assets/products/ampoule-up.webp'; place(amp, AMP, AMP_AR);
    logos = el('div', 's8-logos', root);
    el('span', 's8-bgi', logos, txt('s8-bgi'));
    el('i', 's8-bar', logos);
    const lg = el('img', 's8-logo', logos); lg.alt = '华大小鹿 YOUTH MESSAGER'; lg.src = 'assets/brand/logo-h.svg';
    name = el('div', 's8-name', root, txt('s8-name'));
    veil = el('i', 's8-veil', root);
    return Promise.all([decode(amp), decode(box), decode(lg)]);
  }

  function render(t) {
    const push = smooth(T0, END, t);
    prod.style.transform = 'scale(' + (1 + 0.035 * push).toFixed(4) + ')';
    const lA = smooth(LOGO, LOGO + 0.9, t);
    logos.style.opacity = lA.toFixed(3);
    logos.style.transform = 'translate(-50%,' + (12 * (1 - lA)).toFixed(1) + 'px)';
    const nA = smooth(LOGO + 0.6, LOGO + 1.5, t);
    name.style.opacity = nA.toFixed(3);
    const vA = smooth(FADE, END - 0.15, t);
    veil.style.opacity = vA.toFixed(3);
    lastProbe = { t, logoA: +lA.toFixed(3), nameA: +nA.toFixed(3), veil: +vA.toFixed(3) };
  }

  function setActive(v) { if (root) root.style.display = v ? '' : 'none'; }
  window.FILM_SCENES = window.FILM_SCENES || {};
  window.FILM_SCENES[8] = { init, render, setActive, probe: () => lastProbe };
})();
