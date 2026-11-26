/* AI 视频分镜试做：s2 → s4。画面由 LabStory · Seedance 2.5 图生视频（首帧 = 即梦关键帧），
   ffmpeg 按 cue 剪辑并混入 bgm 同段；页面以 video.currentTime 为唯一时钟叠加代码排版的文字与数据。 */
(function () {
  'use strict';
  const C = window.FILM.cues, FPS = window.FILM.fps;
  const T0 = C.s2, T1 = C.s4;
  const Q = new URLSearchParams(location.search);
  const W = 1920, H = 1080;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lin = (t, a, b) => clamp((t - a) / (b - a));
  const mix = (a, b, k) => a + (b - a) * k;
  const eOut = (x) => 1 - Math.pow(1 - x, 3);
  const win = (t, a, b, fi = 0.5, fo = 0.5) => Math.min(lin(t, a, a + fi), 1 - lin(t, b - fo, b));
  const $ = (id) => document.getElementById(id);

  const stage = $('stage');
  function fit() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(-50%,-50%) scale(${s})`;
    if (window.FX) FX.resize(s);
  }
  addEventListener('resize', fit);

  const TXT = {};
  const TWO_IN = C.wax + 1.5;
  function buildText() {
    $('t-name').textContent = TXT['s2-name'];
    $('t-sub1').textContent = TXT['s2-sub'];
    $('t-sub2').textContent = TXT['s3-sub'];
    $('t-two').innerHTML = TXT['s3-two'].replace(/(\d+\s*%)/, '<b>$1</b>');
    $('d-h').textContent = TXT['s3-dh'];
    $('d1n').textContent = TXT['s3-d1n']; $('d2n').textContent = TXT['s3-d2n'];
    $('d-note').textContent = TXT['s3-dn'];
  }
  function setOp(el, a, tf) {
    el.style.opacity = a.toFixed(3);
    el.style.visibility = a > 0.001 ? 'visible' : 'hidden';
    if (tf != null) el.style.transform = tf;
  }
  const numVal = (s) => parseFloat(String(s).replace(/[^\d.]/g, ''));

  const hud = $('hud'), barFill = $('bar-fill');
  function render(t) {
    {
      const a = win(t, 7.9, 11.6, 0.9, 0.7), el = $('t-name');
      setOp(el, a, `translateX(${mix(-20, 30, lin(t, 7.9, 11.6))}px)`);
      el.style.letterSpacing = mix(0.55, 0.32, eOut(lin(t, 7.9, 9.2))).toFixed(3) + 'em';
      el.style.filter = `blur(${(1 - eOut(lin(t, 7.9, 8.7))) * 12}px)`;
    }
    setOp($('t-sub1'), win(t, C.ring + 0.25, 21.1, 0.6, 0.45), `translateY(${(1 - eOut(lin(t, C.ring + 0.25, C.ring + 1))) * 14}px)`);
    setOp($('t-sub2'), win(t, C.s3 + 0.2, C.layerPowder - 0.1, 0.6, 0.45), `translateY(${(1 - eOut(lin(t, C.s3 + 0.2, C.s3 + 0.9))) * 14}px)`);

    {
      const a = win(t, TWO_IN, C.collagen - 0.15, 0.6, 0.45), el = $('t-two');
      setOp(el, a, `scale(${mix(1.04, 1, eOut(lin(t, TWO_IN, TWO_IN + 1.3)))})`);
      el.style.filter = `blur(${(1 - eOut(lin(t, TWO_IN, TWO_IN + 0.7))) * 10}px)`;
    }
    {
      const base = C.collagen, a0 = win(t, base, T1 + 1, 0.6, 0.3);
      $('veil').style.opacity = (Math.min(a0, 1 - lin(t, T1 - 0.7, T1)) * 1).toFixed(3);
      const items = ['d-h', 'd1n', 'd1v', 'd2n', 'd2v', 'd-note'];
      const delay = [0, 0.18, 0.18, 0.42, 0.42, 0.75];
      items.forEach((id, i) => {
        const a = Math.min(a0, lin(t, base + delay[i], base + delay[i] + 0.5));
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
    FX.render(t);
    HUD.render(t);
    barFill.style.width = (lin(t, T0, T1) * 100).toFixed(2) + '%';
    if (DEBUG) {
      let near = ''; for (const n in C) if (Math.abs(C[n] - t) < 0.25) near = n;
      hud.textContent = `t ${t.toFixed(3)}  f ${Math.floor(t * FPS + 1e-6)}  ${near}`;
    }
  }

  /* 时钟：视频自带配乐，currentTime 即音画共同时钟；rAF 间用 performance.now 外推以达到帧级平滑。 */
  const v = $('film');
  const DEBUG = Q.get('debug') === '1';
  if (DEBUG) stage.classList.add('debug');
  let anchorV = 0, anchorNow = 0, lastV = -1, ended = false;
  function now() {
    const ct = v.currentTime;
    if (v.paused || v.seeking || v.readyState < 2) return T0 + ct;
    const n = performance.now();
    if (ct !== lastV) { lastV = ct; anchorV = ct; anchorNow = n; }
    return T0 + Math.min(anchorV + (n - anchorNow) / 1000, ct + 1 / FPS);
  }
  function loop() {
    render(clamp(now(), T0, T1));
    requestAnimationFrame(loop);
  }
  function play(from) {
    ended = false; $('end').hidden = true; $('cover').hidden = true;
    v.currentTime = Math.max(0, from - T0);
    v.play().catch((e) => console.warn(e));
  }
  v.addEventListener('ended', () => { ended = true; render(T1); $('end').hidden = false; });
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); if (ended) return play(T0); v.paused ? v.play() : v.pause(); }
    const BAR = 60 / 112.35 * 4;
    if (e.code === 'ArrowRight') v.currentTime = Math.min(T1 - T0, v.currentTime + BAR);
    if (e.code === 'ArrowLeft') v.currentTime = Math.max(0, v.currentTime - BAR);
  });
  window.__t = () => now();
  window.__seek = (t) => { v.currentTime = clamp(t, T0, T1) - T0; };
  window.__cues = C;

  FX.init($('fx'), v);
  fit();
  const startAt = Q.has('t') ? clamp(parseFloat(Q.get('t')), T0, T1) : T0;
  const canPlay = new Promise((res) => { if (v.readyState >= 3) res(); else { v.addEventListener('canplay', res, { once: true }); v.load(); } });
  Promise.all([
    fetch('../../film/copy.json').then((r) => r.json()).then((j) => j.entries.forEach((e) => (TXT[e.id] = e.text))),
    document.fonts ? document.fonts.load('40px "XL Serif"').then(() => document.fonts.load('20px "XL Sans"')) : null,
    Promise.race([canPlay, new Promise((r) => setTimeout(r, 4000))])
  ]).then(() => {
    buildText();
    HUD.build($('hudsvg'), TXT);
    v.currentTime = startAt - T0;
    render(startAt);
    window.__ready = true;
    const btn = $('start');
    btn.disabled = false; btn.textContent = '轻触开始';
    btn.onclick = () => play(startAt);
    $('again').onclick = () => play(T0);
    requestAnimationFrame(loop);
  }).catch((err) => { $('start').textContent = '载入失败：' + err.message; console.error(err); });
})();
