/* S0 playback skeleton. The audio element's currentTime is the only clock while playing;
   when paused, seeking, or capturing, the clock is manual. Every render is a pure function of the
   nearest 30 fps frame, so any moment can be reproduced exactly (seek, export, QA). */
(function () {
  const F = window.FILM;
  const FPS = F.fps, LAST = F.totalFrames - 1;
  const Q = new URLSearchParams(location.search);
  const CAPTURE = Q.get('capture') === '1';
  const au = document.getElementById('bgm');
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), startBtn = $('start'), againBtn = $('again');
  const el = {
    n: $('ph-n'), name: $('ph-name'), range: $('ph-range'), time: $('ph-time'), frame: $('ph-frame'),
    local: $('ph-local'), cueNow: $('cue-now'), cueList: $('cue-list'), fill: $('bar-fill')
  };
  const KEY_CUES = new Set(['antlerFreeze', 'pressBottom']);
  const BASE_VOL = 0.8, FADE_IN = 1.2, FADE_OUT_AT = F.cues.fadeOut, FADE_OUT = F.duration - F.cues.fadeOut;
  const cueNames = Object.keys(F.cues);
  const frameSet = new Set(cueNames.map((k) => F.cueFrames[k]));

  let playing = false, ended = false, manualT = 0, muted = false;
  let lastA = -1, lastP = 0, est = 0, prevFrame = -1, prevScene = -1;
  const log = []; // scene / cue crossings observed during real playback, with audio time

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const frameOf = (t) => clamp(Math.floor(t * FPS + 0.5 + 1e-6), 0, LAST);
  const sceneAt = (f) => {
    let s = F.scenes[0];
    for (const sc of F.scenes) if (f >= sc.inFrame) s = sc;
    return s;
  };
  const fmt = (v) => v.toFixed(2);

  function layout() {
    const k = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = 'scale(' + k + ') translate(-50%,-50%)';
  }
  addEventListener('resize', layout);
  layout();

  function render(t) {
    const f = frameOf(t);
    const sc = sceneAt(f);
    if (sc.n !== prevScene) {
      stage.dataset.scene = String(sc.n);
      el.n.textContent = String(sc.n).padStart(2, '0');
      el.name.textContent = sc.name;
      el.range.textContent = fmt(sc.inSec) + ' → ' + fmt(sc.outSec) + ' s · 帧 ' + sc.inFrame + ' → ' + sc.outFrame;
      const own = cueNames.filter((k) => F.cueFrames[k] >= sc.inFrame && F.cueFrames[k] < sc.outFrame);
      el.cueList.innerHTML = own.map((k) =>
        '<b data-f="' + F.cueFrames[k] + '"' + (KEY_CUES.has(k) ? ' class="key"' : '') + '>' + k + ' ' + fmt(F.cues[k]) + '</b>').join('');
      if (playing && prevScene !== -1) log.push({ type: 'scene', n: sc.n, frame: f, t, audioT: au.currentTime });
      prevScene = sc.n;
    }
    if (playing && prevFrame >= 0 && f > prevFrame) {
      for (const k of cueNames) {
        const cf = F.cueFrames[k];
        if (cf > prevFrame && cf <= f) log.push({ type: 'cue', name: k, frame: f, cueFrame: cf, t, audioT: au.currentTime });
      }
    }
    prevFrame = f;

    el.time.textContent = fmt(playing ? t : f / FPS) + ' s';
    el.frame.textContent = '帧 ' + f + ' / ' + F.totalFrames;
    el.local.textContent = '幕内 ' + fmt(Math.max(0, f / FPS - sc.inSec)) + ' / ' + fmt(sc.outSec - sc.inSec) + ' s';
    el.fill.style.width = (f / F.totalFrames * 100) + '%';
    stage.classList.toggle('on-cue', frameSet.has(f));

    let near = null;
    for (const k of cueNames) {
      const d = f - F.cueFrames[k];
      if (d >= 0 && d < 15 && (!near || F.cueFrames[k] >= F.cueFrames[near])) near = k;
    }
    el.cueNow.textContent = near ? '◆ ' + near + ' · ' + fmt(F.cues[near]) + ' s · 帧 ' + F.cueFrames[near] : '';
    el.cueNow.style.opacity = near ? String(1 - (f - F.cueFrames[near]) / 15) : '0';
    for (const b of el.cueList.children) b.classList.toggle('passed', f >= +b.dataset.f);
  }

  function volumeAt(t) {
    const fi = clamp(t / FADE_IN, 0, 1), fo = clamp((F.duration - t) / FADE_OUT, 0, 1);
    return BASE_VOL * Math.min(fi, fo);
  }

  function clockNow() {
    if (!playing) return manualT;
    const a = au.currentTime, p = performance.now();
    if (a !== lastA) { lastA = a; lastP = p; est = Math.max(a, est - 0.001); }
    else est = Math.max(est, Math.min(lastA + (p - lastP) / 1000, lastA + 0.12)); // smooth the audio clock's coarse steps
    return est;
  }

  function stop(atEnd) {
    playing = false;
    au.pause();
    if (atEnd) { ended = true; manualT = F.duration; againBtn.hidden = false; }
  }

  function loop() {
    if (playing) {
      const t = clockNow();
      if (t >= F.duration || au.ended) { stop(true); render(F.duration); }
      else { au.volume = muted ? 0 : clamp(volumeAt(t), 0, 1); render(t); }
    }
    requestAnimationFrame(loop);
  }

  function seek(t) {
    stop(false);
    ended = false; againBtn.hidden = true;
    manualT = clamp(t, 0, F.duration);
    lastA = -1; est = manualT; prevFrame = -1;
    render(manualT);
    return manualT;
  }

  function play() {
    if (CAPTURE) return Promise.resolve(false);
    if (ended || manualT >= F.duration) seek(0);
    au.currentTime = manualT;
    est = manualT; lastA = -1; prevFrame = frameOf(manualT);
    au.volume = muted ? 0 : volumeAt(manualT);
    playing = true;
    return au.play().then(() => { startBtn.hidden = true; againBtn.hidden = true; return true; }).catch(() => {
      playing = false; startBtn.hidden = false; return false;
    });
  }

  function togglePause() {
    if (playing) { manualT = clockNow(); stop(false); render(manualT); } else play();
  }

  // ---- debug / export interface (docs/03-production-plan.md §1) ----
  window.__seek = seek;
  window.__seekFrame = (f) => seek(f / FPS);
  window.__play = play;
  window.__pause = () => { if (playing) { manualT = clockNow(); stop(false); render(manualT); } return manualT; };
  window.__scene = () => {
    const t = playing ? clockNow() : manualT, f = frameOf(t), sc = sceneAt(f);
    return { i: sc.n - 1, n: sc.n, name: sc.name, t, frame: f, local: Math.max(0, f / FPS - sc.inSec), d: sc.outSec - sc.inSec, playing };
  };
  window.__cues = () => {
    const f = frameOf(playing ? clockNow() : manualT), out = {};
    for (const k of cueNames) {
      const cf = F.cueFrames[k];
      out[k] = { sec: F.cues[k], frame: cf, state: f < cf ? 'before' : f === cf ? 'now' : 'after', framesFromNow: cf - f };
    }
    return out;
  };
  window.__log = log;
  window.__audio = au;
  window.__ready = true;

  // ---- input ----
  addEventListener('pointerdown', () => {
    if (CAPTURE || playing) return;
    const replay = ended;
    if (replay) seek(0);
    if (replay || !startBtn.hidden) play();
  });
  addEventListener('keydown', (e) => {
    if (CAPTURE) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (startBtn.hidden || playing) togglePause(); else play(); }
    else if (e.key === 'm' || e.key === 'M') { muted = !muted; au.volume = muted ? 0 : volumeAt(clockNow()); }
    else if (e.key === 'Home') { seek(0); play(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const dir = e.key === 'ArrowLeft' ? -1 : 1, step = e.shiftKey ? 1 : 1 / FPS;
      seek((playing ? clockNow() : manualT) + dir * step);
    }
  });

  // ---- boot ----
  const t0 = parseFloat(Q.get('t'));
  if (CAPTURE) { startBtn.hidden = true; seek(isNaN(t0) ? 0 : t0); }
  else if (!isNaN(t0)) { startBtn.hidden = true; seek(t0); } // ?t= jumps and stays paused; Space plays
  else { render(0); play(); } // may be blocked by the autoplay policy; the start button then appears
  requestAnimationFrame(loop);
})();
