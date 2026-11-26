/* AI 宣传片 · 开场：画面由 LabStory（Seedream 关键帧 → Seedance 图生视频）生成，ffmpeg 按 cue 剪辑并混入 bgm 同段。
   页面以 video.currentTime 为唯一时钟，代码只排文字，并在 locate / lock 两个重拍上做一次金色点缀。 */
(function () {
  'use strict';
  const C = window.FILM.cues, FPS = window.FILM.fps;
  const T0 = 0, T1 = C.s4;
  const Q = new URLSearchParams(location.search);
  const W = 1920, H = 1080;
  // 定位点跟随画面中鹿场围栏（1920×1080 坐标，按成片逐帧量取）
  const TRACK = [[5.37, 980, 670], [6.0, 960, 720], [6.7, 1020, 770], [7.4, 1000, 770]];
  const pinAt = (t) => {
    if (t <= TRACK[0][0]) return { x: TRACK[0][1], y: TRACK[0][2] };
    for (let i = 1; i < TRACK.length; i++) if (t <= TRACK[i][0]) {
      const [a, ax, ay] = TRACK[i - 1], [b, bx, by] = TRACK[i], k = (t - a) / (b - a);
      return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k };
    }
    const L = TRACK[TRACK.length - 1]; return { x: L[1], y: L[2] };
  };
  const LAT_Y = TRACK[0][2];
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lin = (t, a, b) => clamp((t - a) / (b - a));
  const mix = (a, b, k) => a + (b - a) * k;
  const eOut = (x) => 1 - Math.pow(1 - x, 3);
  const eIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const win = (t, a, b, fi = 0.5, fo = 0.5) => Math.min(lin(t, a, a + fi), 1 - lin(t, b - fo, b));
  const $ = (id) => document.getElementById(id);

  const stage = $('stage');
  function fit() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(-50%,-50%) scale(${s})`;
  }
  addEventListener('resize', fit);

  const TXT = {};
  function setOp(el, a, tf) {
    el.style.opacity = a.toFixed(3);
    el.style.visibility = a > 0.001 ? 'visible' : 'hidden';
    if (tf != null) el.style.transform = tf;
  }

  function render(t) {
    // 开场句：随第一拍由虚到实，字距收拢
    {
      const el = $('t-open'), a = win(t, C.open + 0.35, 3.6, 1.1, 0.6);
      setOp(el, a, `translateY(${(1 - eOut(lin(t, C.open + 0.35, 2.2))) * 16}px)`);
      el.style.letterSpacing = mix(0.5, 0.32, eOut(lin(t, C.open + 0.35, 2.6))).toFixed(3) + 'em';
      el.style.filter = `blur(${(1 - eOut(lin(t, C.open + 0.35, 1.5))) * 10}px)`;
    }
    // locate：一条细金线沿纬度划过，终点停在落点
    const endA = 1 - lin(t, C.s2 - 0.55, C.s2 - 0.05);
    {
      const k = eIO(lin(t, C.locate, C.locate + 1.4)), a = Math.min(lin(t, C.locate, C.locate + 0.3), endA);
      const x0 = 260, x1 = TRACK[0][1];
      const lat = $('lat');
      lat.setAttribute('d', `M${x0} ${LAT_Y} L${x1} ${LAT_Y}`);
      lat.style.strokeDasharray = `${k} 1`;
      lat.style.opacity = (a * (1 - 0.6 * lin(t, C.lock, C.lock + 0.8))).toFixed(3);
      const d = $('latDot');
      d.setAttribute('cx', mix(x0, x1, k)); d.setAttribute('cy', LAT_Y);
      d.style.opacity = (a * (1 - lin(t, C.lock - 0.1, C.lock + 0.1))).toFixed(3);
      const la = Math.min(lin(t, C.locate + 0.3, C.locate + 0.9), endA);
      setOp($('t-lat'), la, `translate(${x0}px,${LAT_Y - 52}px)`);
      setOp($('t-lon'), Math.min(lin(t, C.locate + 0.7, C.locate + 1.3), endA),
        `translate(${x0 + 230}px,${LAT_Y - 52}px)`);
    }
    // lock：落点一次涟漪 + 一道暖光，地点字幕落定
    {
      const p = $('pin'), a = Math.min(lin(t, C.lock - 0.12, C.lock), endA), PIN = pinAt(t);
      p.setAttribute('transform', `translate(${PIN.x} ${PIN.y})`);
      p.style.opacity = a.toFixed(3);
      const r1 = eOut(lin(t, C.lock, C.lock + 1.1)), r2 = eOut(lin(t, C.lock + 0.53, C.lock + 1.6));
      $('pinR1').setAttribute('r', mix(6, 70, r1)); $('pinR1').style.opacity = (1 - r1).toFixed(3);
      $('pinR2').setAttribute('r', mix(6, 46, r2)); $('pinR2').style.opacity = ((1 - r2) * (r2 > 0)).toFixed(3);
      const g = $('glow');
      g.style.setProperty('--gx', (PIN.x / W * 100) + '%'); g.style.setProperty('--gy', (PIN.y / H * 100) + '%');
      g.style.opacity = (0.32 * Math.sin(Math.PI * lin(t, C.lock - 0.1, C.lock + 1.5))).toFixed(3);
      const pa = win(t, C.lock + 0.15, 7.3, 0.7, 0.5), el = $('t-place');
      $('scrim').style.opacity = pa.toFixed(3);
      setOp(el, pa, `translateY(${(1 - eOut(lin(t, C.lock + 0.15, C.lock + 1))) * 14}px)`);
      el.style.filter = `blur(${(1 - eOut(lin(t, C.lock + 0.15, C.lock + 0.7))) * 6}px)`;
    }
    SEG2.render(t);
    $('bar-fill').style.width = (lin(t, T0, T1) * 100).toFixed(2) + '%';
    if (DEBUG) {
      let near = ''; for (const n in C) if (Math.abs(C[n] - t) < 0.25) near = n;
      $('hud').textContent = `t ${t.toFixed(3)}  f ${Math.floor(t * FPS + 1e-6)}  ${near}`;
    }
  }

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
  function loop() { render(clamp(now(), T0, T1)); requestAnimationFrame(loop); }
  function play(from) {
    ended = false; $('end').hidden = true; $('cover').hidden = true;
    v.currentTime = Math.max(0, from - T0);
    v.play().catch((e) => console.warn(e));
  }
  v.addEventListener('ended', () => { ended = true; render(T1); $('end').hidden = false; });
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); if (ended) return play(T0); v.paused ? v.play() : v.pause(); }
  });
  window.__t = () => now();
  window.__seek = (t) => { v.currentTime = clamp(t, T0, T1) - T0; };
  window.__cues = C;

  fit();
  const startAt = Q.has('t') ? clamp(parseFloat(Q.get('t')), T0, T1) : T0;
  const canPlay = new Promise((res) => { if (v.readyState >= 3) res(); else { v.addEventListener('canplay', res, { once: true }); v.load(); } });
  Promise.all([
    fetch('../film/copy.json').then((r) => r.json()).then((j) => j.entries.forEach((e) => (TXT[e.id] = e.text))),
    document.fonts ? document.fonts.load('40px "XL Serif"').then(() => document.fonts.load('20px "XL Sans"')) : null,
    Promise.race([canPlay, new Promise((r) => setTimeout(r, 4000))])
  ]).then(() => {
    $('t-open').textContent = TXT['s1-open'];
    $('t-lat').textContent = TXT['s1-lat'];
    $('t-lon').textContent = TXT['s1-lon'];
    $('t-place').textContent = TXT['s1-place'];
    SEG2.build($('seg2'), TXT);
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
