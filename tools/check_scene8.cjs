#!/usr/bin/env node
'use strict';
/* S7 acceptance (docs/02-storyboard.md 幕 8 · 尾 · 品名与 Logo; docs/03-production-plan.md 幕 8):
   1. entry — scene 7 on frame s8−1, scene 8 from s8 to the last frame (end−1);
   2. name — the on-screen name is the copy.json `s8-name` text and identical to scene 5's `s5-name`;
   3. product — ampoule and name fully visible between s8+1.3 s and `logo`, gone before the Logo appears (no overlap);
   4. logo — hidden before `logo`, fully in from logo+1.0 s; width 22 % of 1920 (422 px) and centred; clear space on
      every side ≥ the Logo height; the last frame (end−1) is the Logo still on #F2F1EC;
   5. logo only here — the Logo element is not displayed in any sampled frame of scenes 1–7;
   6. mobile — 844×390: name inside the viewport with glyphs ≥ 12 px, Logo inside the viewport;
   plus no console errors and key frames in film/qa/s7_*.jpg. The last-frame volume is checked on the exported MP4.
   Usage: node tools/check_scene8.cjs      Writes film/qa/s7-report.json. */
const fs = require('fs'), path = require('path');
const { FILM_DIR, serve, launch } = require('./film_common.cjs');

const QA = path.join(FILM_DIR, 'qa');
const SHOTS = [['in', 100.3], ['name', 101.5], ['swap', 102.3], ['logo', 103.2], ['end', 104.2]];

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
    const F = await page.evaluate(() => ({ cueFrames: window.FILM.cueFrames, totalFrames: window.FILM.totalFrames, copy: window.FILM.copy }));
    const C = F.cueFrames, LAST = F.totalFrames - 1;
    const at = (f) => page.evaluate((x) => { window.__seekFrame(x); return window.__scene(); }, f);
    const dom = () => page.evaluate(() => {
      const vis = (e) => !!e && e.offsetParent !== null && +getComputedStyle(e).opacity > 0.01;
      const box = (e) => { const r = e.getBoundingClientRect(); return { x0: r.left, x1: r.right, y0: r.top, y1: r.bottom, w: r.width, h: r.height }; };
      const logo = document.querySelector('#s8 .s8-logo'), name = document.querySelector('#s8 .s8-name'), prod = document.querySelector('#s8 .s8-prod');
      return { logoVis: vis(logo), logoA: logo ? +getComputedStyle(logo).opacity : 0, logoBox: logo ? box(logo) : null,
        prodA: prod ? +getComputedStyle(prod).opacity : 0, nameText: name ? name.textContent : '', bg: getComputedStyle(document.getElementById('s8')).backgroundColor };
    });

    // 1. entry
    {
      const a = await at(C.s8 - 1), b = await at(C.s8), c = await at(LAST);
      const ok = a.n === 7 && b.n === 8 && c.n === 8;
      report.checks.entry = { ok, before: a.n, first: b.n, last: c.n, lastFrame: LAST };
      if (!ok) fail('entry ' + JSON.stringify(report.checks.entry));
    }
    // 2. name
    {
      await at(C.s8 + 45);
      const d = await dom();
      const s8 = F.copy.find((e) => e.id === 's8-name'), s5 = F.copy.find((e) => e.id === 's5-name');
      const ok = !!s8 && !!s5 && s8.text === s5.text && d.nameText === s5.text;
      report.checks.name = { ok, text: d.nameText, s5: s5 && s5.text };
      if (!ok) fail('name ' + JSON.stringify(report.checks.name));
    }
    // 3 + 4. product and Logo over time
    {
      const rows = [];
      for (let f = C.s8; f <= LAST; f++) { await at(f); rows.push({ f, ...(await dom()) }); }
      const full = rows.filter((r) => r.f >= C.s8 + 39 && r.f < C.logo), pre = rows.filter((r) => r.f < C.logo), post = rows.filter((r) => r.f >= C.logo + 30);
      const overlap = rows.filter((r) => r.prodA > 0.05 && r.logoA > 0.05);
      const okP = full.every((r) => r.prodA > 0.99) && overlap.length === 0;
      report.checks.product = { ok: okP, fullFrom: C.s8 + 39, to: C.logo - 1, overlapFrames: overlap.map((r) => r.f) };
      if (!okP) fail('product ' + JSON.stringify(report.checks.product));
      const end = rows[rows.length - 1], b = end.logoBox;
      const clear = b ? Math.min(b.x0, 1920 - b.x1, b.y0, 1080 - b.y1) : 0;
      const okL = pre.every((r) => r.logoA < 0.01) && post.every((r) => r.logoA > 0.99) && !!b && Math.abs(b.w - 422.4) < 1.5 &&
        Math.abs((b.x0 + b.x1) / 2 - 960) < 2 && Math.abs((b.y0 + b.y1) / 2 - 540) < 2 && clear >= b.h && end.prodA < 0.01 && end.bg === 'rgb(242, 241, 236)';
      report.checks.logo = { ok: okL, firstVisible: (rows.find((r) => r.logoA > 0.01) || {}).f, logoCue: C.logo, endBox: b, clearSpace: clear, endBg: end.bg };
      if (!okL) fail('logo ' + JSON.stringify(report.checks.logo));
    }
    // 5. Logo only in scene 8
    {
      const seen = [];
      for (let f = 0; f < C.s8; f += 15) { await at(f); if ((await dom()).logoVis) seen.push(f); }
      report.checks.logoOnlyHere = { ok: seen.length === 0, framesWithLogo: seen };
      if (seen.length) fail('logo outside scene 8 at ' + seen.join(','));
    }
    // key frames
    for (const [name, t] of SHOTS) { await at(Math.min(LAST, Math.floor(t * 30 + 0.5))); await page.screenshot({ path: path.join(QA, `s7_${name}.jpg`), type: 'jpeg', quality: 88 }); }

    // 6. mobile
    const m = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    m.on('pageerror', (e) => errors.push('mobile: ' + e));
    await m.goto(base + 'index.html?capture=1');
    await m.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    report.checks.mobile = [];
    for (const [name, f] of [['name', C.s8 + 45], ['logo', LAST]]) {
      await m.evaluate((x) => window.__seekFrame(x), f);
      const r = await m.evaluate((sel) => {
        const k = document.querySelector(sel), b = k.getBoundingClientRect();
        return { x0: +b.left.toFixed(1), x1: +b.right.toFixed(1), y0: +b.top.toFixed(1), y1: +b.bottom.toFixed(1),
          px: k.tagName === 'IMG' ? null : +(parseFloat(getComputedStyle(k).fontSize) * b.height / Math.max(1, k.offsetHeight)).toFixed(1) };
      }, name === 'name' ? '#s8 .s8-name' : '#s8 .s8-logo');
      await m.screenshot({ path: path.join(QA, `s7_mobile_${name}.jpg`), type: 'jpeg', quality: 88 });
      const ok = r.x0 >= 0 && r.x1 <= 844 && r.y0 >= 0 && r.y1 <= 390 && (r.px === null || r.px >= 12);
      report.checks.mobile.push({ ok, name, frame: f, box: r });
      if (!ok) fail('mobile ' + name + ': ' + JSON.stringify(r));
    }
    report.checks.consoleErrors = errors;
    if (errors.length) fail('console: ' + errors.join(' | '));
  } catch (e) { fail('exception: ' + (e.stack || e)); }
  await browser.close(); server.close();
  report.pass = report.failures.length === 0;
  fs.writeFileSync(path.join(QA, 's7-report.json'), JSON.stringify(report, null, 2));
  const c = report.checks;
  console.log(JSON.stringify({ pass: report.pass, entry: c.entry && c.entry.ok, name: c.name && c.name.ok, product: c.product, logo: c.logo,
    logoOnlyHere: c.logoOnlyHere && c.logoOnlyHere.ok, mobile: c.mobile && c.mobile.map((x) => [x.name, x.ok, x.box.px]), failures: report.failures }));
  process.exit(report.pass ? 0 : 1);
})();
