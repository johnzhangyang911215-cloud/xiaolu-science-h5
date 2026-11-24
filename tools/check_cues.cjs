#!/usr/bin/env node
'use strict';
/* V2 acceptance (91.5 s recut): scene cut frames, cue table, key-cue seeking, real-time audio-clock sync.
   Expected values below are copied from docs/12-v2-revision.md on purpose, independent of cues.js.
   Usage: node tools/check_cues.cjs      Writes film/qa/v2-report.json and screenshots to film/qa/. */
const fs = require('fs'), path = require('path');
const { FILM_DIR, serve, launch } = require('./film_common.cjs');

const QA = path.join(FILM_DIR, 'qa');
const TOTAL = 2745;
const ORDER = [1, 2, 3, 4, 6, 7, 5, 8]; // playback order of the scene numbers
const SCENE_START = { 1: 0, 2: 225, 3: 640, 4: 1086, 6: 1406, 7: 1724, 5: 2107, 8: 2457 };
const PLAN_CUES = {
  open: [0.07, 2], locate: [3.25, 98], lock: [5.37, 161],
  s2: [7.50, 225], dolly: [9.64, 289], holo: [12.84, 385], antlerGlow: [14.97, 449], ring: [17.07, 512],
  s3: [21.34, 640], layerBlood: [23.45, 704], layerPowder: [25.58, 767], wax: [27.71, 831], collagen: [31.95, 959], antlerFreeze: [34.09, 1023],
  s4: [36.20, 1086], journal: [40.47, 1214],
  s6: [46.85, 1406], cold: [48.97, 1469], labelPowder: [51.10, 1533], labelSolvent: [53.22, 1597], close: [55.35, 1661],
  s7: [57.47, 1724], ringOff: [59.58, 1787], pressContact: [60.65, 1820], pressBottom: [61.72, 1852], shake1: [63.85, 1916],
  shake2: [64.91, 1947], snap: [65.97, 1979], dropLand: [68.10, 2043],
  s5: [70.22, 2107], dataIn: [72.35, 2171], dataLock: [74.47, 2234],
  s8: [81.90, 2457], logo: [82.97, 2489], fadeOut: [88.30, 2649], end: [91.50, 2745]
};
const FRAME_MS = 1000 / 30;

(async () => {
  fs.mkdirSync(QA, { recursive: true });
  const { server, base } = await serve();
  const browser = await launch();
  const report = { when: new Date().toISOString(), checks: {}, failures: [] };
  const fail = (m) => { report.failures.push(m); console.log('FAIL', m); };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    // 1. Cue table vs plan
    await page.goto(base + 'index.html?capture=1');
    await page.waitForFunction(() => window.__ready === true);
    const cueInfo = await page.evaluate(() => window.__cues());
    const cueBad = [];
    for (const [k, [sec, fr]] of Object.entries(PLAN_CUES)) {
      const c = cueInfo[k];
      if (!c || c.sec !== sec || c.frame !== fr) cueBad.push({ cue: k, plan: [sec, fr], got: c && [c.sec, c.frame] });
    }
    for (const k of Object.keys(cueInfo)) if (!PLAN_CUES[k]) cueBad.push({ cue: k, note: 'not in plan' });
    report.checks.cueTable = { total: Object.keys(PLAN_CUES).length, mismatches: cueBad };
    if (cueBad.length) fail('cue table mismatches: ' + JSON.stringify(cueBad));

    // 2. Scene cut frames over every frame of the film
    const perFrame = await page.evaluate((total) => {
      const out = [];
      for (let f = 0; f < total; f++) { window.__seekFrame(f); const s = window.__scene(); out.push([s.n, s.frame]); }
      return out;
    }, TOTAL);
    const firstFrame = {}, bad = [];
    perFrame.forEach(([n, fr], f) => { if (fr !== f) bad.push(f); if (!(n in firstFrame)) firstFrame[n] = f; });
    const cuts = Object.keys(SCENE_START).map((n) => ({ scene: +n, plan: SCENE_START[n], got: firstFrame[n], errorFrames: firstFrame[n] - SCENE_START[n] }));
    const monotonic = perFrame.every(([n], i) => i === 0 || ORDER.indexOf(n) >= ORDER.indexOf(perFrame[i - 1][0]));
    report.checks.sceneCuts = { frames: perFrame.length, cuts, monotonic, frameIndexMismatches: bad.length };
    for (const c of cuts) if (c.errorFrames !== 0) fail(`scene ${c.scene} cut off by ${c.errorFrames} frames`);
    if (!monotonic || bad.length || perFrame.length !== TOTAL) fail('frame stepping is not exact');

    // 3. Key cue seeking (frame-exact, before/now/after) + screenshots
    const keys = [['antlerFreeze', 34.09, 1023, 3], ['pressBottom', 61.72, 1852, 7], ['dataLock', 74.47, 2234, 5]];
    report.checks.keyCues = [];
    for (const [name, sec, fr, scene] of keys) {
      const row = { name, sec, frame: fr, byFrame: {}, byQuery: null, ok: true };
      for (const d of [-1, 0, 1]) {
        await page.evaluate((f) => window.__seekFrame(f), fr + d);
        const st = await page.evaluate((k) => ({ s: window.__scene(), c: window.__cues()[k].state, hit: document.getElementById('stage').classList.contains('on-cue') }), name);
        row.byFrame[d] = { frame: st.s.frame, scene: st.s.n, state: st.c, hit: st.hit };
        await page.screenshot({ path: path.join(QA, `${name}_${d < 0 ? 'm1' : d > 0 ? 'p1' : '0'}.png`) });
      }
      const exp = { '-1': 'before', 0: 'now', 1: 'after' };
      for (const d of [-1, 0, 1]) if (row.byFrame[d].state !== exp[d] || row.byFrame[d].frame !== fr + d) row.ok = false;
      if (!row.byFrame[0].hit || row.byFrame[-1].hit || row.byFrame[1].hit) row.ok = false;
      // ?t= deep link
      const p2 = await ctx.newPage();
      await p2.goto(base + `index.html?t=${sec}`);
      await p2.waitForFunction(() => window.__ready === true);
      const q = await p2.evaluate((k) => ({ s: window.__scene(), c: window.__cues()[k].state, a: window.__audio.paused }), name);
      row.byQuery = { frame: q.s.frame, scene: q.s.n, state: q.c, pausedAudio: q.a, playing: q.s.playing };
      if (q.s.frame !== fr || q.c !== 'now' || q.s.n !== scene || q.s.playing || !q.a) row.ok = false;
      await p2.close();
      report.checks.keyCues.push(row);
      if (!row.ok) fail(`key cue ${name} not frame-exact`);
    }

    // 4. First frame of every scene (screenshot)
    for (const n of Object.keys(SCENE_START)) {
      await page.evaluate((f) => window.__seekFrame(f), SCENE_START[n]);
      await page.screenshot({ path: path.join(QA, `scene${n}_in.png`) });
    }

    // 5. Real playback: the audio clock must trigger the cut/cue within one frame (+ one rAF)
    const SCN = { s2: 2, s8: 8 };
    const live = [['scene', 's2', 6.4], ['cue', 'antlerFreeze', 33.0], ['cue', 'pressBottom', 60.6], ['scene', 's8', 80.8]];
    report.checks.realtime = [];
    for (const [kind, name, from] of live) {
      const p3 = await ctx.newPage();
      await p3.goto(base + 'index.html?t=' + from);
      await p3.waitForFunction(() => window.__ready === true);
      const started = await p3.evaluate(() => window.__play());
      const sec = PLAN_CUES[name][0], fr = PLAN_CUES[name][1];
      const want = (e) => kind === 'cue' ? (e.type === 'cue' && e.name === name) : (e.type === 'scene' && e.frame >= fr);
      let ev = null;
      const t0 = Date.now();
      while (!ev && Date.now() - t0 < (sec - from) * 1000 + 5000) {
        await new Promise((r) => setTimeout(r, 50));
        ev = await p3.evaluate((w) => window.__log.find((e) => (e.type === 'cue' ? e.name === w.n : e.type === 'scene' && e.n === w.s)) || null, { n: name, s: SCN[name] });
      }
      const row = { kind, name, from, started, planSec: sec, planFrame: fr };
      if (!started || !ev) { row.ok = false; fail(`realtime ${name}: did not trigger (started=${started})`); }
      else {
        const ideal = (fr - 0.5) / 30; // the frame is displayed once the clock reaches its half-frame boundary
        row.event = ev; row.audioMsFromCue = Math.round((ev.audioT - sec) * 1000); row.clockMsFromIdeal = Math.round((ev.t - ideal) * 1000);
        row.ok = ev.frame === fr && Math.abs(ev.audioT - sec) * 1000 <= FRAME_MS + 17;
        if (!row.ok) fail(`realtime ${name}: audio ${row.audioMsFromCue} ms from cue`);
      }
      await p3.close();
      report.checks.realtime.push(row);
    }
    report.consoleErrors = errors;
    if (errors.length) fail('console errors: ' + errors.join(' | '));
  } finally {
    await browser.close(); server.close();
  }
  report.pass = report.failures.length === 0;
  fs.writeFileSync(path.join(QA, 'v2-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, cuts: report.checks.sceneCuts && report.checks.sceneCuts.cuts, keyCues: report.checks.keyCues, realtime: report.checks.realtime, failures: report.failures }, null, 1));
  process.exit(report.pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
