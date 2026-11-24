#!/usr/bin/env node
'use strict';
/* S4 acceptance (docs/02-storyboard.md 幕 5):
   1. entry — scene 4 on frame s5−1, scene 5 on s5 … s6−1, scene 6 on s6;
   2. first look — at s5 + 0.5 s the brightest 32×18 cell holds the gold point (probe.focus) and is warm;
   3. chamber flash — at the flash peak the brightest cell is the freeze chamber;
   4. lights on the hit — dark before `family`, studio lit at family + 0.5 s;
   5. dimming — the series dims left to right before `single`; after `single` the ampoule holds the brightest cell;
   6. tail — the last frame pushes to the freeze chamber near frame centre (cut point for 幕 6);
   7. copy — only scene 5 copy.json entries inside their windows, no banned words (抗皱 only inside the registered name);
   8. mobile — 844×390 at title and name frames: text inside the viewport, glyphs ≥ 12 px;
   plus no console errors and key-frame screenshots in film/qa/s4_*.jpg.
   Usage: node tools/check_scene5.cjs      Writes film/qa/s4-report.json. */
const fs = require('fs'), path = require('path');
const { FILM_DIR, serve, launch } = require('./film_common.cjs');

const QA = path.join(FILM_DIR, 'qa');
const BANNED = ['仅占', '证明', '基地', '产地', '原产'];
const NAME = '韶初泌语鹿茸凝时抗皱冻干精华液';
const SHOTS = [['enter', 59.6], ['fall', 60.6], ['flash', 60.95], ['pull', 61.4], ['family', 62.3], ['truck', 63.6], ['dim', 65.0],
  ['single', 66.3], ['hero', 66.9], ['tail', 68.05]];

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
    const C = F.cueFrames, fr = (t) => Math.floor(t * 30 + 0.5 + 1e-6);
    const at = (f) => page.evaluate((x) => { window.__seekFrame(x); return window.__scene(); }, f);
    const mean = (g) => g.reduce((a, c) => a + c.lum, 0) / g.length;

    // 1. entry
    const entry = [];
    for (const f of [C.s5 - 1, C.s5, C.s5 + 1, C.s6 - 1, C.s6]) { const s = await at(f); entry.push([f, s.n, s.frame]); }
    const entryOk = entry.every(([f, n, x]) => x === f && n === (f < C.s5 ? 4 : f < C.s6 ? 5 : 6));
    report.checks.entry = { ok: entryOk, frames: entry };
    if (!entryOk) fail('entry: ' + JSON.stringify(entry));

    // 2. first look
    {
      const f = C.s5 + 15, s = await at(f), br = brightestOf(await cells(page));
      const ok = near(br, s.probe.focus) && br.r > br.b;
      report.checks.firstLook = { ok, frame: f, focus: s.probe.focus, brightest: br };
      if (!ok) fail('first look: ' + JSON.stringify(report.checks.firstLook));
    }

    // 3. chamber flash
    {
      let best = null;
      for (let f = C.s5 + 20; f < C.family; f++) { const s = await at(f); if (!best || s.probe.flash > best.flash) best = { f, flash: s.probe.flash }; }
      const s = await at(best.f), br = brightestOf(await cells(page));
      const ok = best.flash > 0.9 && near(br, s.probe.chamber) && br.r >= br.b;
      report.checks.flash = { ok, frame: best.f, seconds: +(best.f / 30).toFixed(2), flash: best.flash, chamber: s.probe.chamber, brightest: br };
      if (!ok) fail('flash: ' + JSON.stringify(report.checks.flash));
    }

    // 4. lights on the hit
    {
      const a = await at(C.family - 3), la = mean(await cells(page));
      const b = await at(C.family + 15), lb = mean(await cells(page));
      const ok = a.probe.on === 0 && b.probe.on > 0.99 && lb > la * 2.5;
      report.checks.lightsOn = { ok, before: { frame: C.family - 3, on: a.probe.on, meanLum: +la.toFixed(1) }, after: { frame: C.family + 15, on: b.probe.on, meanLum: +lb.toFixed(1) } };
      if (!ok) fail('lights on: ' + JSON.stringify(report.checks.lightsOn));
    }

    // 5. dimming order, then the single ampoule leads
    {
      const order = ['mousse', 'water', 'emulsion', 'cream', 'mask', 'box'], first = {};
      const lit = (await at(C.family + 18)).probe.dims;
      for (let f = C.family; f < C.single; f += 2) {
        const d = (await at(f)).probe.dims;
        for (const k of order) if (first[k] === undefined && d[k] < 0.5) first[k] = f;
      }
      const end = (await at(C.single - 6)).probe.dims;
      const seq = order.map((k) => first[k]);
      const ok = order.every((k) => lit[k] === 1 && end[k] <= 0.25) && seq.every((v, i) => v !== undefined && (i === 0 || v >= seq[i - 1]));
      report.checks.dimming = { ok, litAt: lit, halfDimFrame: first, beforeSingle: end };
      if (!ok) fail('dimming: ' + JSON.stringify(report.checks.dimming));
      const f = fr(F.cues.single + 0.9), s = await at(f), g = await cells(page), br = brightestOf(g);
      const a = s.probe.amp, inAmp = Math.abs(br.cx - Math.floor(a.x / 60)) <= 1 && br.cy * 60 + 60 >= a.top && br.cy * 60 <= a.bottom;
      report.checks.single = { ok: inAmp, frame: f, amp: a, brightest: [br.cx, br.cy] };
      if (!inAmp) fail('single: ampoule is not the brightest object ' + JSON.stringify(report.checks.single));
    }

    // 6. tail on the freeze chamber
    {
      const s = await at(C.s6 - 1), c = s.probe.chamber;
      const ok = Math.abs(c.x - 960) < 240 && Math.abs(c.y - 540) < 270 && s.probe.phase === 'single';
      report.checks.tail = { ok, frame: C.s6 - 1, chamber: c };
      if (!ok) fail('tail: ' + JSON.stringify(report.checks.tail));
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
    }, [C.s5, C.s6 - 1]);
    const allowed = new Map(F.copy.filter((c) => c.scene === 5 && c.status !== 'pending').map((c) => [c.text, c]));
    const texts = Object.keys(seen).map((s) => {
      const c = allowed.get(s), q = seen[s];
      const tIn = c && (typeof c.in === 'string' ? F.cues[c.in] : c.in), tOut = c && (typeof c.out === 'string' ? F.cues[c.out] : c.out);
      const bad = BANNED.filter((b) => s.includes(b)).concat(s.includes('抗皱') && s !== NAME ? ['抗皱'] : []);
      return { text: s, seconds: [+(q[0] / 30).toFixed(2), +(q[q.length - 1] / 30).toFixed(2)], inCopy: !!c, window: c ? [tIn, tOut] : null,
        withinWindow: !!c && q[0] / 30 >= tIn - 1e-6 && q[q.length - 1] / 30 <= tOut + 1e-6, banned: bad };
    });
    const missing = [...allowed.keys()].filter((s) => !seen[s]);
    const copyOk = texts.every((x) => x.inCopy && x.withinWindow && !x.banned.length) && !missing.length;
    report.checks.copy = { ok: copyOk, copyEntries: allowed.size, texts, missing };
    if (!copyOk) fail('copy: ' + JSON.stringify({ texts, missing }));

    // key frames
    report.checks.shots = [];
    for (const [name, t] of SHOTS) {
      const f = Math.min(C.s6 - 1, fr(t)), s = await at(f);
      await page.screenshot({ path: path.join(QA, `s4_${name}.jpg`), type: 'jpeg', quality: 88 });
      report.checks.shots.push({ name, frame: f, n: s.n, probe: s.probe });
    }

    // 8. mobile
    const m = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    m.on('pageerror', (e) => errors.push('mobile: ' + e));
    await m.goto(base + 'index.html?capture=1');
    await m.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    report.checks.mobile = [];
    for (const [name, t] of [['title', 63.6], ['name', 66.9]]) {
      const f = fr(t);
      const rects = await m.evaluate((x) => {
        window.__seekFrame(x);
        const op = (e) => { let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o; };
        return [...document.querySelectorAll('#s5 .copy')].filter((e) => op(e) > 0.3).map((e) => {
          const r = e.getBoundingClientRect(), px = parseFloat(getComputedStyle(e).fontSize) * r.height / e.offsetHeight;
          return { text: e.textContent.trim(), x0: +r.left.toFixed(1), x1: +r.right.toFixed(1), y0: +r.top.toFixed(1), y1: +r.bottom.toFixed(1), px: +px.toFixed(1) };
        });
      }, f);
      await m.screenshot({ path: path.join(QA, `s4_mobile_${name}.jpg`), type: 'jpeg', quality: 88 });
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
  fs.writeFileSync(path.join(QA, 's4-report.json'), JSON.stringify(report, null, 2));
  const c = report.checks, ok = (k) => c[k] && c[k].ok;
  console.log(JSON.stringify({ pass: report.pass, entry: ok('entry'), firstLook: ok('firstLook'), flash: c.flash && [c.flash.ok, c.flash.seconds],
    lightsOn: c.lightsOn, dimming: ok('dimming'), single: ok('single'), tail: c.tail, copy: c.copy && c.copy.texts.map((x) => [x.text, x.seconds, x.withinWindow]),
    mobile: c.mobile && c.mobile.map((x) => [x.name, x.ok, Math.min(...x.texts.map((r) => r.px))]), failures: report.failures }));
  process.exit(report.pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
