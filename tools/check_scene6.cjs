#!/usr/bin/env node
'use strict';
/* S5 acceptance (docs/02-storyboard.md 幕 6):
   1. entry — scene 5 on frame s6−1, scene 6 on s6 … s7−1, scene 7 on s7;
   2. first look — at s6 + 0.5 s the brightest 32×18 cell holds the gold powder (probe.powder) and is warm;
   3. freeze — the figure reads −40 (p38) on every frame, with no illustrative start value; powder set and frost complete by labelPowder;
   4. section — fully open between 69.3 s and `close`, shut again on the last frame;
   5. labels — each callout stays hidden before its cue and is drawn within 0.5 s after it;
   6. tail — last frame: ampoule tail-up (flip ≈ 1, bottom above top) near frame centre (cut point for 幕 7);
   7. palette — no cool "tech blue" cell (b − r > 40 and b > 120) in any key frame;
   8. copy — only scene 6 copy.json entries inside their windows (the figure “−40℃” inside the s6-temp window, “结构示意” under the section), no banned words;
   9. mobile — 844×390 at counter, label and lock frames: text inside the viewport, glyphs ≥ 12 px;
   plus no console errors and key-frame screenshots in film/qa/s5_*.jpg.
   Usage: node tools/check_scene6.cjs      Writes film/qa/s5-report.json. */
const fs = require('fs'), path = require('path');
const { FILM_DIR, serve, launch } = require('./film_common.cjs');

const QA = path.join(FILM_DIR, 'qa');
const BANNED = ['仅占', '证明', '基地', '产地', '原产', '抗皱', '用时激活'];
const TEMP = /^−?\d+℃$/;
const SHOTS = [['enter', 68.15], ['cut', 68.7], ['freeze', 70.3], ['minus40', 72.0], ['powder', 73.4], ['labels', 75.6], ['close', 77.0], ['tail', 77.63]];

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
    for (const f of [C.s6 - 1, C.s6, C.s6 + 1, C.s7 - 1, C.s7]) { const s = await at(f); entry.push([f, s.n, s.frame]); }
    const entryOk = entry.every(([f, n, x]) => x === f && n === (f < C.s6 ? 5 : f < C.s7 ? 6 : 7));
    report.checks.entry = { ok: entryOk, frames: entry };
    if (!entryOk) fail('entry: ' + JSON.stringify(entry));

    // 2. first look
    {
      const f = C.s6 + 15, s = await at(f), br = brightestOf(await cells(page));
      const ok = near(br, s.probe.powder) && br.r > br.b;
      report.checks.firstLook = { ok, frame: f, powder: s.probe.powder, brightest: br };
      if (!ok) fail('first look: ' + JSON.stringify(report.checks.firstLook));
    }

    // 3. freeze, 4. section
    {
      let prev = Infinity, mono = true, first40 = null, temps = [], open = true;
      for (let f = C.s6; f < C.s7; f++) {
        const p = (await at(f)).probe;
        if (p.temp > prev) mono = false; prev = p.temp;
        if (first40 === null && p.temp === -40) first40 = f;
        if ((f - C.s6) % 15 === 0) temps.push([+(f / 30).toFixed(2), p.temp, p.cut]);
        if (f >= fr(69.3) && f < C.close && p.cut < 0.999) open = false;
      }
      const p0 = (await at(C.s6)).probe, pl = (await at(C.labelPowder)).probe, pe = (await at(C.s7 - 1)).probe;
      const ok = p0.temp === -40 && temps.every((x) => x[1] === -40) && mono && first40 !== null && first40 / 30 <= 72.3 && pl.set > 0.99 && pl.frost > 0.99;
      report.checks.freeze = { ok, start: p0.temp, monotonic: mono, minus40At: first40 && +(first40 / 30).toFixed(2), setAtLabel: pl.set, frostAtLabel: pl.frost, samples: temps };
      if (!ok) fail('freeze: ' + JSON.stringify(report.checks.freeze));
      const ok2 = open && pe.cut === 0;
      report.checks.section = { ok: ok2, openFrom69_3ToClose: open, cutAtEnd: pe.cut };
      if (!ok2) fail('section: ' + JSON.stringify(report.checks.section));
    }

    // 5. labels
    {
      const res = {};
      for (const [k, cue] of [['powder', 'labelPowder'], ['solvent', 'labelSolvent']]) {
        const b = (await at(C[cue] - 1)).probe.labels[k], a = (await at(C[cue] + 15)).probe.labels[k];
        const vis = await page.evaluate((id) => +getComputedStyle(document.querySelector('#s6 .' + id)).opacity, 's6-' + k);
        res[k] = { ok: b.k === 0 && a.k > 0.99 && vis > 0.9, before: b.k, after: a.k, textOpacity: vis };
      }
      const ok = res.powder.ok && res.solvent.ok;
      report.checks.labels = { ok, ...res };
      if (!ok) fail('labels: ' + JSON.stringify(res));
    }

    // 6. tail
    {
      const s = await at(C.s7 - 1), p = s.probe;
      const ok = p.flip > 0.98 && p.amp.bottom.y < p.amp.top.y && Math.abs(p.amp.x - 960) < 120 && Math.abs(p.amp.y - 540) < 140;
      report.checks.tail = { ok, frame: C.s7 - 1, flip: p.flip, amp: p.amp };
      if (!ok) fail('tail: ' + JSON.stringify(report.checks.tail));
    }

    // 7. palette
    {
      const hits = [];
      for (const [name, t] of SHOTS) { await at(Math.min(C.s7 - 1, fr(t))); for (const c of await cells(page)) if (c.b - c.r > 40 && c.b > 120) hits.push([name, c.cx, c.cy]); }
      report.checks.palette = { ok: !hits.length, blueCells: hits };
      if (hits.length) fail('palette: ' + JSON.stringify(hits));
    }

    // 8. copy
    const seen = await page.evaluate(([a, b]) => {
      const out = {};
      const opacity = (e) => { let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden') return 0; o *= +s.opacity; } return o; };
      for (let f = a; f <= b; f++) {
        window.__seekFrame(f);
        const w = document.createTreeWalker(document.getElementById('stage'), NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) { const s = n.textContent.trim(); if (!s || opacity(n.parentElement) < 0.01) continue; (out[s] = out[s] || []).push(f); }
      }
      return out;
    }, [C.s6, C.s7 - 1]);
    const entries = F.copy.filter((c) => c.scene === 6 && c.status !== 'pending');
    // callouts render as two lines split on " · "
    const allowed = new Map(entries.flatMap((c) => (/^s6-(powder|solvent)$/.test(c.id) ? c.text.split(' · ') : [c.text]).map((t) => [t, c])));
    const tempEntry = entries.find((c) => c.id === 's6-temp');
    const texts = Object.keys(seen).map((s) => {
      const c = allowed.get(s) || (TEMP.test(s) ? tempEntry : null), q = seen[s];
      const tIn = c && (typeof c.in === 'string' ? F.cues[c.in] : c.in), tOut = c && (typeof c.out === 'string' ? F.cues[c.out] : c.out);
      const bad = BANNED.filter((b) => s.includes(b));
      return { text: s, seconds: [+(q[0] / 30).toFixed(2), +(q[q.length - 1] / 30).toFixed(2)], inCopy: !!c, window: c ? [tIn, tOut] : null,
        withinWindow: !!c && q[0] / 30 >= tIn - 1e-6 && q[q.length - 1] / 30 <= tOut + 1e-6, banned: bad };
    });
    const missing = [...allowed.keys()].filter((s) => !seen[s] && s !== tempEntry.text);
    const copyOk = texts.every((x) => x.inCopy && x.withinWindow && !x.banned.length) && !missing.length;
    report.checks.copy = { ok: copyOk, copyEntries: allowed.size, texts, missing };
    if (!copyOk) fail('copy: ' + JSON.stringify({ texts, missing }));

    // key frames
    report.checks.shots = [];
    for (const [name, t] of SHOTS) {
      const f = Math.min(C.s7 - 1, fr(t)), s = await at(f);
      await page.screenshot({ path: path.join(QA, `s5_${name}.jpg`), type: 'jpeg', quality: 88 });
      report.checks.shots.push({ name, frame: f, n: s.n, probe: s.probe });
    }

    // 9. mobile
    const m = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    m.on('pageerror', (e) => errors.push('mobile: ' + e));
    await m.goto(base + 'index.html?capture=1');
    await m.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    report.checks.mobile = [];
    for (const [name, t] of [['counter', 70.5], ['labels', 75.5], ['lock', 77.0]]) {
      const f = fr(t);
      const rects = await m.evaluate((x) => {
        window.__seekFrame(x);
        const op = (e) => { let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o; };
        return [...document.querySelectorAll('#s6 .copy')].filter((e) => op(e) > 0.3).map((e) => {
          const r = e.getBoundingClientRect(), px = parseFloat(getComputedStyle(e).fontSize) * r.height / e.offsetHeight;
          return { text: e.textContent.trim(), x0: +r.left.toFixed(1), x1: +r.right.toFixed(1), y0: +r.top.toFixed(1), y1: +r.bottom.toFixed(1), px: +px.toFixed(1) };
        });
      }, f);
      await m.screenshot({ path: path.join(QA, `s5_mobile_${name}.jpg`), type: 'jpeg', quality: 88 });
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
  fs.writeFileSync(path.join(QA, 's5-report.json'), JSON.stringify(report, null, 2));
  const c = report.checks, ok = (k) => c[k] && c[k].ok;
  console.log(JSON.stringify({ pass: report.pass, entry: ok('entry'), firstLook: ok('firstLook'), freeze: c.freeze && [c.freeze.ok, c.freeze.minus40At],
    section: ok('section'), labels: ok('labels'), tail: c.tail && [c.tail.ok, c.tail.flip, c.tail.amp.x, c.tail.amp.y], palette: ok('palette'), copy: c.copy && c.copy.texts.map((x) => [x.text, x.seconds, x.withinWindow]),
    mobile: c.mobile && c.mobile.map((x) => [x.name, x.ok, Math.min(...x.texts.map((r) => r.px))]), failures: report.failures }));
  process.exit(report.pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
