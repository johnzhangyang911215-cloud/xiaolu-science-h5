/* Scene 8 · 尾 · 品名与 Logo (docs/02-storyboard.md 幕 8, docs/03-production-plan.md 幕 8).
   Scene 7 ends on a lifted near-white; here it settles to snow white #F2F1EC ("天亮"). The single ampoule (brand product photo)
   stands left of centre with the product name beside it, exactly as in scene 5. On the 102.10 `logo` cue the ampoule and name
   fade out and the horizontal Logo (original SVG, #1A2F77) fades in at the centre, 22 % of the frame width; the last frame is
   the Logo still. This is the only scene that shows the Logo. Plain DOM; render(t) is a pure function of time. */
(function () {
  const F = window.FILM;
  const FPS = F.fps;
  const K = {};
  for (const k in F.cueFrames) K[k] = F.cueFrames[k] / FPS;
  const T0 = K.s8, LOGO = K.logo, END = K.end;
  const BG0 = [228, 225, 216], BG1 = [242, 241, 236]; // scene 7's last frame → #F2F1EC
  const LOGO_W = 0.22 * 1920;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

  let root, prod, amp, name, logo, copy = [], lastProbe = null;
  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; };
  const decode = (img) => (img.decode ? img.decode() : Promise.resolve()).catch(() => {});

  function init(stage, entries) {
    copy = entries.filter((e) => e.scene === 8);
    root = el('div', '', stage); root.id = 's8'; root.style.display = 'none';
    prod = el('div', 's8-prod', root);
    el('i', 's8-shadow', prod);
    amp = el('img', 's8-amp', prod); amp.alt = ''; amp.src = 'assets/products/ampoule-1.webp';
    const n = copy.find((e) => e.id === 's8-name');
    name = el('div', 's8-name', prod, n ? n.text : '');
    logo = el('img', 's8-logo', root); logo.alt = '华大小鹿 YOUTH MESSAGER'; logo.src = 'assets/brand/logo-h.svg';
    logo.style.width = LOGO_W + 'px';
    return Promise.all([decode(amp), decode(logo)]);
  }

  function render(t) {
    const kBg = smooth(T0, T0 + 0.7, t);
    const bg = BG0.map((c, i) => Math.round(c + (BG1[i] - c) * kBg));
    root.style.background = 'rgb(' + bg.join(',') + ')';

    const pIn = smooth(T0 + 0.2, T0 + 1.1, t), pOut = 1 - smooth(LOGO, LOGO + 0.32, t);
    const pA = pIn * pOut;
    const drift = smooth(T0, LOGO + 0.5, t);
    prod.style.opacity = pA.toFixed(3);
    prod.style.transform = 'translateY(' + (14 * (1 - pIn)).toFixed(1) + 'px) scale(' + (1 + 0.02 * drift).toFixed(4) + ')';
    name.style.opacity = smooth(T0 + 0.45, T0 + 1.3, t).toFixed(3);

    const lA = smooth(LOGO + 0.28, LOGO + 1.0, t);
    logo.style.opacity = lA.toFixed(3);
    logo.style.transform = 'translate(-50%,-50%) scale(' + (0.97 + 0.03 * smooth(LOGO, END, t)).toFixed(4) + ')';
    lastProbe = { t, bg, productA: +pA.toFixed(3), nameA: +(pA * +name.style.opacity).toFixed(3), logoA: +lA.toFixed(3), logoW: LOGO_W };
  }

  function setActive(v) { if (root) root.style.display = v ? '' : 'none'; }
  window.FILM_SCENES = window.FILM_SCENES || {};
  window.FILM_SCENES[8] = { init, render, setActive, probe: () => lastProbe };
})();
