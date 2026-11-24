#!/usr/bin/env node
'use strict';
/* S3 acceptance (docs/02-storyboard.md 幕 4):
   1. entry — scene 3 on frame s4−1, scene 4 on s4 … s5−1, scene 5 on s5;
   2. first look — at s4 + 0.5 s the brightest 32×18 cell holds the lit data point (probe.focus) and is blue;
   3. one point per beat — on each composition cue + 0.2 s, that node is the brightest cell; one reference card at a time;
   4. blue → gold — scene 4 opens gold (continuity with scene 3) and its last frame is warm, so tech blue stays inside scene 4;
   5. copy — only scene 4 copy.json entries, each inside its in/out, no banned / causal words;
   6. mobile — 844×390 at both card frames: every visible text inside the viewport, glyphs ≥ 12 px;
   plus no console errors and key-frame screenshots in film/qa/s3_*.jpg.
   Usage: node tools/check_scene4.cjs      Writes film/qa/s3-report.json. */
const fs = require('fs'), path = require('path');
const { FILM_DIR, serve, launch } = require('./film_common.cjs');

const QA = path.join(FILM_DIR, 'qa');
const BANNED = ['仅占', '证明', '抗皱', '基地', '产地', '原产'];
const SHOTS = [['enter', 44.77], ['sample', 45.23], ['ring', 46.4], ['ring6', 48.6], ['pool', 49.6], ['grow', 50.8], ['tree', 52.6],
  ['peaks', 54.2], ['helix', 55.8], ['converge', 58.2], ['gold', 59.5]];

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
    const C = F.cueFrames;
    const at = (f) => page.evaluate((x) => { window.__seekFrame(x); return window.__scene(); }, f);
    const copyIn = (id) => F.copy.find((c) => c.id === id).in;

    // 1. entry
    const entry = [];
    for (const f of [C.s4 - 1, C.s4, C.s4 + 1, C.s5 - 1, C.s5]) { const s = await at(f); entry.push([f, s.n, s.frame]); }
    const entryOk = entry.every(([f, n, fr]) => fr === f && n === (f < C.s4 ? 3 : f < C.s5 ? 4 : 5));
    report.checks.entry = { ok: entryOk, frames: entry };
    if (!entryOk) fail('entry: ' + JSON.stringify(entry));

    // 2. first look
    {
      const f = C.s4 + 15, s = await at(f), g = await cells(page), br = brightestOf(g);
      const ok = near(br, s.probe.focus) && br.b > br.r;
      report.checks.firstLook = { ok, frame: f, focus: s.probe.focus, brightest: br };
      if (!ok) fail('first look: ' + JSON.stringify(report.checks.firstLook));
    }

    // 3. one lit point per beat, one card at a time
    report.checks.beats = [];
    for (let k = 1; k <= 6; k++) {
      const f = Math.floor((copyIn('s4-c' + k) + 0.2) * 30 + 0.5), s = await at(f), br = brightestOf(await cells(page));
      const ok = s.probe.lit === k - 1 && near(br, s.probe.focus);
      report.checks.beats.push({ ok, k, frame: f, lit: s.probe.lit, focus: s.probe.focus, brightest: [br.cx, br.cy] });
      if (!ok) fail('beat ' + k + ': lit node is not the brightest cell');
    }
    let both = 0;
    for (let f = C.s4; f < C.s5; f += 3) { const s = await at(f); if (s.probe.cards[0] > 0.5 && s.probe.cards[1] > 0.5) both++; }
    report.checks.oneCard = { ok: both === 0, framesWithTwoCards: both };
    if (both) fail('two reference cards fully visible together on ' + both + ' sampled frames');

    // 4. blue stays inside scene 4
    {
      const s0 = await at(C.s4), g0 = brightestOf(await cells(page));
      const s1 = await at(C.s5 - 1), g1 = brightestOf(await cells(page));
      const ok = g0.r > g0.b && g1.r > g1.b && s1.probe.warm > 0.99 && near(g1, s1.probe.focus);
      report.checks.blueInside = { ok, first: { frame: C.s4, brightest: g0 }, last: { frame: C.s5 - 1, warm: s1.probe.warm, brightest: g1 } };
      if (!ok) fail('blue/gold hand-off: ' + JSON.stringify(report.checks.blueInside));
    }

    // 5. copy
    const seen = await page.evaluate(([a, b]) => {
      const out = {};
      const opacity = (e) => { let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return 0; o *= +s.opacity; } return o; };
      for (let f = a; f <= b; f++) {
        window.__seekFrame(f);
        const w = document.createTreeWalker(document.getElementById('stage'), NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) { const s = n.textContent.trim(); if (!s || opacity(n.parentElement) < 0.01) continue; (out[s] = out[s] || []).push(f); }
      }
      return out;
    }, [C.s4, C.s5 - 1]);
    const allowed = new Map(F.copy.filter((c) => c.scene === 4 && c.status !== 'pending').map((c) => [c.text, c]));
    const texts = Object.keys(seen).map((s) => {
      const c = allowed.get(s), fr = seen[s];
      const tIn = c && (typeof c.in === 'string' ? F.cues[c.in] : c.in), tOut = c && (typeof c.out === 'string' ? F.cues[c.out] : c.out);
      return { text: s, seconds: [+(fr[0] / 30).toFixed(2), +(fr[fr.length - 1] / 30).toFixed(2)], inCopy: !!c, window: c ? [tIn, tOut] : null,
        withinWindow: !!c && fr[0] / 30 >= tIn - 1e-6 && fr[fr.length - 1] / 30 <= tOut + 1e-6, banned: BANNED.filter((b) => s.includes(b)) };
    });
    const missing = [...allowed.keys()].filter((s) => !seen[s]);
    const copyOk = texts.every((x) => x.inCopy && x.withinWindow && !x.banned.length) && !missing.length;
    report.checks.copy = { ok: copyOk, copyEntries: allowed.size, texts, missing };
    if (!copyOk) fail('copy: ' + JSON.stringify({ texts, missing }));

    // key frames
    report.checks.shots = [];
    for (const [name, t] of SHOTS) {
      const f = Math.min(C.s5 - 1, Math.floor(t * 30 + 0.5 + 1e-6)), s = await at(f);
      await page.screenshot({ path: path.join(QA, `s3_${name}.jpg`), type: 'jpeg', quality: 88 });
      report.checks.shots.push({ name, frame: f, n: s.n, probe: s.probe });
    }

    // 6. mobile
    const m = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    m.on('pageerror', (e) => errors.push('mobile: ' + e));
    await m.goto(base + 'index.html?capture=1');
    await m.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    report.checks.mobile = [];
    for (const [name, t] of [['ring', 48.6], ['card1', 51.5], ['card2', 56.0]]) {
      const f = Math.floor(t * 30 + 0.5);
      const rects = await m.evaluate((fr) => {
        window.__seekFrame(fr);
        const op = (e) => { let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o; };
        return [...document.querySelectorAll('#s4 .copy')].filter((e) => op(e) > 0.3).map((e) => {
          const r = e.getBoundingClientRect(), px = parseFloat(getComputedStyle(e).fontSize) * r.height / e.offsetHeight;
          return { text: e.textContent.trim(), x0: +r.left.toFixed(1), x1: +r.right.toFixed(1), y0: +r.top.toFixed(1), y1: +r.bottom.toFixed(1), px: +px.toFixed(1) };
        });
      }, f);
      await m.screenshot({ path: path.join(QA, `s3_mobile_${name}.jpg`), type: 'jpeg', quality: 88 });
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
  fs.writeFileSync(path.join(QA, 's3-report.json'), JSON.stringify(report, null, 2));
  const c = report.checks;
  console.log(JSON.stringify({ pass: report.pass, entry: c.entry && c.entry.ok, firstLook: c.firstLook, beats: c.beats && c.beats.map((b) => [b.k, b.ok]),
    oneCard: c.oneCard, blueInside: c.blueInside && c.blueInside.ok, copy: c.copy && c.copy.texts.map((x) => [x.text, x.seconds, x.withinWindow]),
    mobile: c.mobile && c.mobile.map((x) => [x.name, x.ok, Math.min(...x.texts.map((r) => r.px))]), failures: report.failures }));
  process.exit(report.pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
