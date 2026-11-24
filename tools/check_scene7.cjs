#!/usr/bin/env node
'use strict';
/* S6 acceptance (docs/02-storyboard.md 幕 7 · 释 · 使用五步):
   1. entry — scene 6 on frame s7−1, scene 7 from s7 to s8−1;
   2. press — the silver tail cap bottoms out (pressDepth ≥ 0.999) first on the pressBottom frame (86.15 s → 2585), the index
      pad stays on the cap face (pad centre within 3 mm of the cap centre; the cap radius is ≈ 6 mm) from pressContact to pressBottom;
   3. ring — the safety ring is on the ampoule at ringGrip and gone 0.6 s after ringOff;
   4. powder — the section is open and grains are in the air between the click and powderHit, i.e. the fall is visible before shaking;
   5. order — the five actions run ring → press → shake → snap → spread (probe phases in order, no repeats);
   6. palette — no cool "tech blue" cell (b − r > 40 and b > 120) in any key frame;
   7. copy — only scene 7 copy.json entries ("NN 动作 · 说明", rendered as three text nodes) inside their windows, no banned words;
   8. mobile — 844×390 at each step: text inside the viewport, glyphs ≥ 12 px;
   plus no console errors and key-frame screenshots in film/qa/s6_*.jpg.
   Usage: node tools/check_scene7.cjs      Writes film/qa/s6-report.json. */
const fs = require('fs'), path = require('path');
const { FILM_DIR, serve, launch } = require('./film_common.cjs');

const QA = path.join(FILM_DIR, 'qa');
const BANNED = ['仅占', '证明', '基地', '产地', '原产', '抗皱', '用时激活'];
const SHOTS = [['ready', 78.2], ['ring', 80.6], ['ringOff', 82.3], ['contact', 84.5], ['press', 86.15], ['fall', 87.6], ['shake', 90.6], ['snap', 93.9], ['drop', 95.2], ['land', 95.9], ['spread', 97.6], ['end', 99.9]];
const MOBILE = [['ring', 80.6], ['press', 86.15], ['shake', 90.6], ['snap', 94.5], ['spread', 97.6]];
const PHASES = ['ready', 'ring', 'approach', 'press', 'click', 'fall', 'shake', 'snap', 'spread'];

async function cells(page) {
  const png = await page.screenshot({ type: 'png' });
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = 1920; c.height = 1080;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, 1920, 1080).data, out = [];
    for (let cy = 0; cy < 18; cy++) for (let cx = 0; cx < 32; cx++) {
      let r = 0, g = 0, b = 0;
      for (let y = cy * 60; y < cy * 60 + 60; y++) for (let xx = cx * 60; xx < cx * 60 + 60; xx++) { const i = (y * 1920 + xx) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      out.push({ cx, cy, r: r / 3600, g: g / 3600, b: b / 3600, lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 3600 });
    }
    return out;
  }, png.toString('base64'));
}
const brightestOf = (g) => g.reduce((a, b) => (b.lum > a.lum ? b : a));
const near = (c, p) => Math.abs(c.cx - Math.floor(p.x / 60)) <= 1 && Math.abs(c.cy - Math.floor(p.y / 60)) <= 1;

(async () => {
  fs.mkdirSync(QA, { recursive: true });
  const { server, base } = await serve();
  const browser = await launch();
  const report = { when: new Date().toISOString(), checks: {}, failures: [] };
  const fail = (m) => { report.failures.push(m); console.log('FAIL', m); };
  try {
    const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
    await page.goto(base + 'index.html?capture=1');
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    const F = await page.evaluate(() => ({ cueFrames: window.FILM.cueFrames, cues: window.FILM.cues, copy: window.FILM.copy }));
    const C = F.cueFrames, K = F.cues, fr = (t) => Math.floor(t * 30 + 0.5 + 1e-6);
    const at = (f) => page.evaluate((x) => { window.__seekFrame(x); return window.__scene(); }, f);

    // 1. entry
    {
      const frames = [];
      for (const f of [C.s7 - 1, C.s7, C.s7 + 1, C.s8 - 1]) { const s = await at(f); frames.push([f, s.n, s.frame]); }
      const ok = frames.every(([f, n, x]) => x === f && n === (f < C.s7 ? 6 : 7));
      report.checks.entry = { ok, frames };
      if (!ok) fail('entry: ' + JSON.stringify(frames));
    }

    // 2. press, 5. order (one pass over every frame of the scene)
    {
      const target = C.pressBottom, fc = fr(K.pressContact);
      let firstBottom = null, maxGap = 0, phases = [];
      for (let f = C.s7; f < C.s8; f++) {
        const p = (await at(f)).probe;
        if (phases[phases.length - 1] !== p.phase) phases.push(p.phase);
        if (firstBottom === null && p.pressDepth >= 0.999) firstBottom = f;
        if (f >= fc && f <= target && p.tipToCapMm != null) maxGap = Math.max(maxGap, p.tipToCapMm);
      }
      const err = firstBottom === null ? null : firstBottom - target;
      const ok = err === 0 && maxGap <= 3;
      report.checks.press = { ok, targetFrame: target, firstBottomFrame: firstBottom, frameError: err, maxTipToCapMm: +maxGap.toFixed(2) };
      if (!ok) fail('press: ' + JSON.stringify(report.checks.press));
      const orderOk = phases.length === PHASES.length && phases.every((x, i) => x === PHASES[i]);
      report.checks.order = { ok: orderOk, phases };
      if (!orderOk) fail('order: ' + JSON.stringify(phases));
    }

    // 3. ring
    {
      const a = (await at(fr(K.ringGrip))).probe.ring, b = (await at(fr(K.ringOff + 0.6))).probe.ring;
      const ok = a >= 0 && b === -1;
      report.checks.ring = { ok, atGrip: a, afterOff: b };
      if (!ok) fail('ring: ' + JSON.stringify(report.checks.ring));
    }

    // 4. powder fall visible before shaking
    {
      let airFrames = 0, minSection = 1;
      const a = fr(K.pressBottom + 0.5), b = fr(K.powderHit) - 1;
      for (let f = a; f <= b; f += 3) { const p = (await at(f)).probe; if (p.grains.inAir > 0) airFrames++; minSection = Math.min(minSection, p.section); }
      const span = +((K.powderHit - K.pressBottom)).toFixed(2), ok = airFrames > 0 && minSection > 0.9 && span >= 2.5;
      report.checks.powder = { ok, fallSeconds: span, sampledFramesWithGrainsInAir: airFrames, minSection: +minSection.toFixed(3) };
      if (!ok) fail('powder: ' + JSON.stringify(report.checks.powder));
    }

    // 6. palette + key frames
    {
      const hits = []; report.checks.shots = [];
      for (const [name, t] of SHOTS) {
        const f = Math.min(C.s8 - 1, fr(t)), s = await at(f);
        for (const c of await cells(page)) if (c.b - c.r > 40 && c.b > 120) hits.push([name, c.cx, c.cy]);
        await page.screenshot({ path: path.join(QA, `s6_${name}.jpg`), type: 'jpeg', quality: 88 });
        report.checks.shots.push({ name, frame: f, n: s.n, probe: s.probe });
      }
      report.checks.palette = { ok: !hits.length, hits };
      if (hits.length) fail('palette: ' + JSON.stringify(hits));
    }

    // 7. copy
    const seen = await page.evaluate(([a, b]) => {
      const out = {};
      const opacity = (e) => { let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return 0; o *= +s.opacity; } return o; };
      for (let f = a; f <= b; f++) {
        window.__seekFrame(f);
        const w = document.createTreeWalker(document.getElementById('stage'), NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) { const s = n.textContent.trim(); if (!s || opacity(n.parentElement) < 0.01) continue; (out[s] = out[s] || []).push(f); }
      }
      return out;
    }, [C.s7, C.s8 - 1]);
    const entries = F.copy.filter((c) => c.scene === 7 && c.status !== 'pending');
    const parts = (c) => { const m = /^(\d\d) (.+?) · (.+)$/.exec(c.text); return m ? [m[1], m[2], m[3]] : [c.text]; };
    const allowed = new Map(entries.flatMap((c) => parts(c).map((t) => [t, c])));
    const texts = Object.keys(seen).map((s) => {
      const c = allowed.get(s), q = seen[s];
      const bad = BANNED.filter((b) => s.includes(b));
      return { text: s, seconds: [+(q[0] / 30).toFixed(2), +(q[q.length - 1] / 30).toFixed(2)], inCopy: !!c, window: c ? [c.in, c.out] : null,
        withinWindow: !!c && q[0] / 30 >= c.in - 1e-6 && q[q.length - 1] / 30 <= c.out + 1e-6, banned: bad };
    });
    const missing = [...allowed.keys()].filter((s) => !seen[s]);
    const copyOk = entries.length === 5 && texts.every((x) => x.inCopy && x.withinWindow && !x.banned.length) && !missing.length;
    report.checks.copy = { ok: copyOk, copyEntries: entries.length, texts, missing };
    if (!copyOk) fail('copy: ' + JSON.stringify({ texts, missing }));

    // 8. mobile
    const m = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    m.on('pageerror', (e) => errors.push('mobile: ' + e));
    await m.goto(base + 'index.html?capture=1');
    await m.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    report.checks.mobile = [];
    for (const [name, t] of MOBILE) {
      const f = fr(t);
      const rects = await m.evaluate((x) => {
        window.__seekFrame(x);
        const op = (e) => { let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o; };
        return [...document.querySelectorAll('#s7 .copy')].filter((e) => op(e) > 0.3).flatMap((e) => [...e.children].map((k) => {
          const r = k.getBoundingClientRect(), px = parseFloat(getComputedStyle(k).fontSize) * r.height / Math.max(1, k.offsetHeight);
          return { text: k.textContent.trim(), x0: +r.left.toFixed(1), x1: +r.right.toFixed(1), y0: +r.top.toFixed(1), y1: +r.bottom.toFixed(1), px: +px.toFixed(1) };
        }));
      }, f);
      await m.screenshot({ path: path.join(QA, `s6_mobile_${name}.jpg`), type: 'jpeg', quality: 88 });
      const ok = rects.length > 0 && rects.every((r) => r.x0 >= 0 && r.x1 <= 844 && r.y0 >= 0 && r.y1 <= 390 && r.px >= 12);
      report.checks.mobile.push({ ok, name, frame: f, texts: rects });
      if (!ok) fail('mobile ' + name + ': ' + JSON.stringify(rects));
    }

    report.consoleErrors = errors;
    if (errors.length) fail('console: ' + errors.join(' | '));
  } finally {
    await browser.close(); server.close();
  }
  report.pass = report.failures.length === 0;
  fs.writeFileSync(path.join(QA, 's6-report.json'), JSON.stringify(report, null, 2));
  const c = report.checks, ok = (k) => c[k] && c[k].ok;
  console.log(JSON.stringify({ pass: report.pass, entry: ok('entry'), press: c.press, order: c.order && c.order.phases.join('>'), ring: ok('ring'), powder: c.powder,
    palette: ok('palette'), copy: c.copy && c.copy.texts.map((x) => [x.text, x.seconds, x.withinWindow]),
    mobile: c.mobile && c.mobile.map((x) => [x.name, x.ok, x.texts.length ? Math.min(...x.texts.map((r) => r.px)) : null]), failures: report.failures }));
  process.exit(report.pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
