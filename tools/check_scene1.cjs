#!/usr/bin/env node
'use strict';
/* S1 acceptance (docs/02-storyboard.md 幕 1 + docs/03-production-plan.md §4):
   1. entry — __scene() reports scene 1 on frames 0…511 and scene 2 on frame 512;
   2. first look — 0.5 s after `open`, at 32×18, the brightest or warmest cell holds the gold point;
   3. centre — on the `shuangyang` frame the point is within ±5 % of the frame centre;
   4. copy — only the three copy.json entries ever appear in scene 1, none of the banned words, each inside its in/out;
   plus no console errors and key-frame screenshots in film/qa/s1_*.jpg.
   Usage: node tools/check_scene1.cjs      Writes film/qa/s1-report.json. */
const fs = require('fs'), path = require('path');
const { FILM_DIR, serve, launch } = require('./film_common.cjs');

const QA = path.join(FILM_DIR, 'qa');
const BANNED = ['基地', '产地', '原产'];
const SHOTS = [['open', 0.57], ['spin', 2.5], ['push1', 4.2], ['push2', 8.6], ['push3', 10.6], ['cloud', 11.8], ['shuangyang', 12.84],
  ['label', 13.4], ['subtitle', 14.6], ['dive', 15.9], ['end', 17.0]];

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
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
    const F = await page.evaluate(() => ({ cueFrames: window.FILM.cueFrames, cues: window.FILM.cues, copy: window.FILM.copy }));

    // 1. entry
    const entry = await page.evaluate(() => [0, 1, 2, 98, 385, 511, 512].map((f) => { window.__seekFrame(f); const s = window.__scene(); return [f, s.n, s.frame]; }));
    const entryOk = entry.every(([f, n, fr]) => fr === f && n === (f < 512 ? 1 : 2));
    report.checks.entry = { ok: entryOk, frames: entry };
    if (!entryOk) fail('entry: ' + JSON.stringify(entry));

    // 2. first look
    const fl = F.cueFrames.open + 15;
    await page.evaluate((f) => window.__seekFrame(f), fl);
    const flProbe = await page.evaluate(() => window.__scene().probe);
    const png = await page.screenshot({ type: 'png' });
    const grid = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = 1920; c.height = 1080;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, 1920, 1080).data, cells = [];
      for (let cy = 0; cy < 18; cy++) for (let cx = 0; cx < 32; cx++) {
        let r = 0, g = 0, bl = 0;
        for (let y = cy * 60; y < cy * 60 + 60; y++) for (let xx = cx * 60; xx < cx * 60 + 60; xx++) { const i = (y * 1920 + xx) * 4; r += d[i]; g += d[i + 1]; bl += d[i + 2]; }
        const n = 3600;
        cells.push({ cx, cy, r: r / n, g: g / n, b: bl / n, lum: (0.2126 * r + 0.7152 * g + 0.0722 * bl) / n, warm: (r - bl) / n });
      }
      return cells;
    }, png.toString('base64'));
    const brightest = grid.reduce((a, b) => (b.lum > a.lum ? b : a));
    const warmest = grid.reduce((a, b) => (b.warm > a.warm ? b : a));
    const dotCell = { cx: Math.floor(flProbe.dot.x / 60), cy: Math.floor(flProbe.dot.y / 60) };
    const same = (c) => c.cx === dotCell.cx && c.cy === dotCell.cy;
    const flOk = flProbe.dot.visible && (same(brightest) || same(warmest));
    report.checks.firstLook = { ok: flOk, frame: fl, dot: flProbe.dot, dotCell, brightest, warmest };
    if (!flOk) fail('first look: gold point is not the brightest/warmest 32×18 cell');

    // 3. centre on `shuangyang`
    await page.evaluate((f) => window.__seekFrame(f), F.cueFrames.shuangyang);
    const sy = await page.evaluate(() => window.__scene());
    const cOk = sy.n === 1 && sy.probe.dot.visible && Math.abs(sy.probe.dot.dx) <= 0.05 && Math.abs(sy.probe.dot.dy) <= 0.05;
    report.checks.centre = { ok: cOk, frame: sy.frame, dot: sy.probe.dot, limit: 0.05 };
    if (!cOk) fail('centre: ' + JSON.stringify(sy.probe.dot));

    // 4. copy whitelist over every frame of the scene
    const seen = await page.evaluate((last) => {
      const out = {}, hud = [];
      const opacity = (e) => { let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return 0; o *= +s.opacity; } return o; };
      for (let f = 0; f <= last; f++) {
        window.__seekFrame(f);
        const w = document.createTreeWalker(document.getElementById('stage'), NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          const s = n.textContent.trim();
          if (!s || opacity(n.parentElement) < 0.01) continue;
          (out[s] = out[s] || []).push(f);
        }
      }
      return out;
    }, F.cueFrames.s2 - 1);
    const allowed = new Map(F.copy.filter((c) => c.scene === 1 && c.status !== 'pending').map((c) => [c.text, c]));
    const texts = Object.keys(seen).map((s) => {
      const c = allowed.get(s), fr = seen[s];
      const tIn = c && (typeof c.in === 'string' ? F.cues[c.in] : c.in), tOut = c && (typeof c.out === 'string' ? F.cues[c.out] : c.out);
      return { text: s, frames: [fr[0], fr[fr.length - 1]], seconds: [+(fr[0] / 30).toFixed(2), +(fr[fr.length - 1] / 30).toFixed(2)], inCopy: !!c,
        window: c ? [tIn, tOut] : null, withinWindow: !!c && fr[0] / 30 >= tIn - 1e-6 && fr[fr.length - 1] / 30 <= tOut + 1e-6,
        banned: BANNED.filter((b) => s.includes(b)) };
    });
    const missing = [...allowed.keys()].filter((s) => !seen[s]);
    const copyOk = texts.every((x) => x.inCopy && x.withinWindow && !x.banned.length) && !missing.length && allowed.size === 3;
    report.checks.copy = { ok: copyOk, copyEntries: allowed.size, texts, missing };
    if (!copyOk) fail('copy: ' + JSON.stringify({ texts, missing }));

    // key frames
    report.checks.shots = [];
    for (const [name, t] of SHOTS) {
      const f = Math.min(F.cueFrames.s2 - 1, Math.floor(t * 30 + 0.5 + 1e-6));
      await page.evaluate((fr) => window.__seekFrame(fr), f);
      const s = await page.evaluate(() => window.__scene());
      await page.screenshot({ path: path.join(QA, `s1_${name}.jpg`), type: 'jpeg', quality: 88 });
      report.checks.shots.push({ name, frame: f, probe: s.probe });
    }
    report.consoleErrors = errors;
    if (errors.length) fail('console: ' + errors.join(' | '));
  } finally {
    await browser.close(); server.close();
  }
  report.pass = report.failures.length === 0;
  fs.writeFileSync(path.join(QA, 's1-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, entry: report.checks.entry && report.checks.entry.ok, firstLook: report.checks.firstLook,
    centre: report.checks.centre, copy: report.checks.copy, failures: report.failures }, null, 1));
  process.exit(report.pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
