#!/usr/bin/env node
'use strict';
/* S2 acceptance (docs/02-storyboard.md 幕 2–3):
   1. entry — scene 2 on frames 512…1022, scene 3 on 1023…1341, scene 4 on 1342;
   2. freeze — camera moving on frame 1022, speed 0 on 1023 and 1024 with the antler at 55–65 % of frame height, snow still falling on 1024;
   3. first look — at s2 + 0.5 s and freeze + 0.5 s the brightest or warmest 32×18 cell holds the antler tip;
   4. copy — only scene 2/3 copy.json entries, each inside its in/out, never the phrase 「仅占」;
   5. mobile — 844×390 screenshot of the wax label frame (labels stay inside the viewport);
   plus no console errors and key-frame screenshots in film/qa/s2_*.jpg.
   Usage: node tools/check_scene23.cjs      Writes film/qa/s2-report.json. */
const fs = require('fs'), path = require('path');
const { FILM_DIR, serve, launch } = require('./film_common.cjs');

const QA = path.join(FILM_DIR, 'qa');
const BANNED = ['仅占', '基地', '产地', '原产'];
const SHOTS = [['enter', 17.57], ['name', 21.0], ['look', 23.5], ['sub', 28], ['push', 33.5], ['freeze', 34.1], ['dark', 35.8],
  ['bone', 37], ['blood', 39], ['powder', 41], ['wax', 43.2], ['end', 44.7]];

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
      out.push({ cx, cy, lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 3600, warm: (r - b) / 3600 });
    }
    return out;
  }, png.toString('base64'));
}

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
    const C = F.cueFrames, FZ = C.antlerFreeze;
    const at = (f) => page.evaluate((x) => { window.__seekFrame(x); return window.__scene(); }, f);

    // 1. entry
    const entry = [];
    for (const f of [C.s2, C.s2 + 1, FZ - 1, FZ, C.s4 - 1, C.s4]) { const s = await at(f); entry.push([f, s.n, s.frame]); }
    const want = (f) => (f < FZ ? 2 : f < C.s4 ? 3 : 4);
    const entryOk = entry.every(([f, n, fr]) => fr === f && n === want(f));
    report.checks.entry = { ok: entryOk, frames: entry };
    if (!entryOk) fail('entry: ' + JSON.stringify(entry));

    // 2. freeze (sequential seeks so camSpeed is measured against the previous frame)
    await at(FZ - 3); await at(FZ - 2);
    const p0 = (await at(FZ - 1)).probe, p1 = (await at(FZ)).probe, p2 = (await at(FZ + 1)).probe;
    const fzOk = p0.camSpeed > 0 && p1.camSpeed === 0 && p2.camSpeed === 0 && p1.antlerFrac >= 0.55 && p1.antlerFrac <= 0.65 && p2.snowFall > 0;
    report.checks.freeze = { ok: fzOk, before: { frame: FZ - 1, camSpeed: p0.camSpeed }, freeze: { frame: FZ, camSpeed: p1.camSpeed, antlerFrac: p1.antlerFrac },
      after: { frame: FZ + 1, camSpeed: p2.camSpeed, snowFall: p2.snowFall } };
    if (!fzOk) fail('freeze: ' + JSON.stringify(report.checks.freeze));

    // 3. first look
    report.checks.firstLook = [];
    for (const f of [C.s2 + 15, FZ + 15]) {
      const s = await at(f), g = await cells(page);
      const br = g.reduce((a, b) => (b.lum > a.lum ? b : a)), wm = g.reduce((a, b) => (b.warm > a.warm ? b : a));
      const tc = { cx: Math.floor(s.probe.tip.x / 60), cy: Math.floor(s.probe.tip.y / 60) };
      const near = (c) => Math.abs(c.cx - tc.cx) <= 1 && Math.abs(c.cy - tc.cy) <= 1;
      const ok = near(br) || near(wm);
      report.checks.firstLook.push({ ok, frame: f, tip: s.probe.tip, tipCell: tc, brightest: br, warmest: wm });
      if (!ok) fail('first look @' + f + ': tip is not the brightest/warmest cell');
    }

    // 4. copy
    const seen = await page.evaluate(([a, b]) => {
      const out = {};
      const opacity = (e) => { let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return 0; o *= +s.opacity; } return o; };
      for (let f = a; f <= b; f++) {
        window.__seekFrame(f);
        const w = document.createTreeWalker(document.getElementById('stage'), NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) { const s = n.textContent.trim(); if (!s || opacity(n.parentElement) < 0.01) continue; (out[s] = out[s] || []).push(f); }
      }
      return out;
    }, [C.s2, C.s4 - 1]);
    const allowed = new Map(F.copy.filter((c) => (c.scene === 2 || c.scene === 3) && c.status !== 'pending').map((c) => [c.text, c]));
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
      const f = Math.min(C.s4 - 1, Math.floor(t * 30 + 0.5 + 1e-6));
      const s = await at(f);
      await page.screenshot({ path: path.join(QA, `s2_${name}.jpg`), type: 'jpeg', quality: 88 });
      report.checks.shots.push({ name, frame: f, n: s.n, probe: s.probe });
    }

    // 5. mobile
    const m = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    m.on('pageerror', (e) => errors.push('mobile: ' + e));
    await m.goto(base + 'index.html?capture=1');
    await m.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    const mobile = await m.evaluate((f) => {
      window.__seekFrame(f);
      return [...document.querySelectorAll('#s23 .s3-lab, #s23 .s3-wax')].filter((e) => +getComputedStyle(e).opacity > 0.01)
        .map((e) => { const r = e.getBoundingClientRect(); return { text: e.textContent.trim(), x0: r.left, x1: r.right, y0: r.top, y1: r.bottom, h: r.height }; });
    }, C.wax + 30);
    await m.screenshot({ path: path.join(QA, 's2_mobile.jpg'), type: 'jpeg', quality: 88 });
    const mOk = mobile.length >= 4 && mobile.every((r) => r.x0 >= 0 && r.x1 <= 844 && r.y0 >= 0 && r.y1 <= 390 && r.h >= 12);
    report.checks.mobile = { ok: mOk, labels: mobile };
    if (!mOk) fail('mobile: ' + JSON.stringify(mobile));

    report.consoleErrors = errors;
    if (errors.length) fail('console: ' + errors.join(' | '));
  } finally {
    await browser.close(); server.close();
  }
  report.pass = report.failures.length === 0;
  fs.writeFileSync(path.join(QA, 's2-report.json'), JSON.stringify(report, null, 2));
  const c = report.checks;
  console.log(JSON.stringify({ pass: report.pass, entry: c.entry && c.entry.ok, freeze: c.freeze, firstLook: c.firstLook && c.firstLook.map((x) => [x.frame, x.ok, x.tipCell, x.brightest.cx + ',' + x.brightest.cy, x.warmest.cx + ',' + x.warmest.cy]),
    copy: c.copy && c.copy.texts.map((x) => [x.text, x.seconds, x.withinWindow]), mobile: c.mobile, failures: report.failures }, null, 1));
  process.exit(report.pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
