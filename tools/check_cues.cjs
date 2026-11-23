#!/usr/bin/env node
'use strict';
/* S0 acceptance: scene cut frames, cue table, key-cue seeking, real-time audio-clock sync.
   Expected values below are copied from docs/03-production-plan.md §2 on purpose, independent of cues.js.
   Usage: node tools/check_cues.cjs      Writes film/qa/s0-report.json and screenshots to film/qa/. */
const fs = require('fs'), path = require('path');
const { FILM_DIR, serve, launch } = require('./film_common.cjs');

const QA = path.join(FILM_DIR, 'qa');
const TOTAL = 3127;
const SCENE_START = { 1: 0, 2: 512, 3: 1023, 4: 1342, 5: 1787, 6: 2043, 7: 2330, 8: 3000 };
const PLAN_CUES = {
  open: [0.07, 2], push1: [3.25, 98], push2: [7.50, 225], push3: [9.64, 289], cloud: [11.24, 337], shuangyang: [12.84, 385],
  s2: [17.07, 512], deerStop: [21.34, 640], deerLook: [23.45, 704], fillStart: [31.95, 959], antlerFreeze: [34.09, 1023],
  layerBone: [36.20, 1086], layerBlood: [38.34, 1150], layerPowder: [40.47, 1214], wax: [42.59, 1278],
  s4: [44.72, 1342], ref1: [48.97, 1469], ref2: [53.22, 1597], converge: [57.47, 1724],
  s5: [59.58, 1787], family: [61.72, 1852], single: [65.97, 1979],
  s6: [68.10, 2043], labelPowder: [72.35, 2171], labelSolvent: [74.47, 2234], close: [76.60, 2298],
  s7: [77.65, 2330], ringGrip: [78.72, 2362], ringOff: [81.90, 2457], pressContact: [84.03, 2521], pressBottom: [86.15, 2585],
  powderHit: [89.35, 2681], shake1: [89.35, 2681], shake2: [90.42, 2713], shake3: [91.49, 2745], snap: [93.60, 2808],
  dropLand: [95.71, 2871], pullBack: [97.85, 2936], s8: [99.99, 3000], fadeOut: [101.03, 3031], logo: [102.10, 3063], end: [104.23, 3127]
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
    const monotonic = perFrame.every(([n], i) => i === 0 || n >= perFrame[i - 1][0]);
    report.checks.sceneCuts = { frames: perFrame.length, cuts, monotonic, frameIndexMismatches: bad.length };
    for (const c of cuts) if (c.errorFrames !== 0) fail(`scene ${c.scene} cut off by ${c.errorFrames} frames`);
    if (!monotonic || bad.length || perFrame.length !== TOTAL) fail('frame stepping is not exact');

    // 3. Key cue seeking (frame-exact, before/now/after) + screenshots
    const keys = [['antlerFreeze', 34.09, 1023, 3], ['pressBottom', 86.15, 2585, 7]];
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
    const live = [['scene', 's2', 16.0], ['scene', 'antlerFreeze', 33.0], ['cue', 'pressBottom', 85.0], ['scene', 's8', 98.9]];
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
        ev = await p3.evaluate((w) => window.__log.find((e) => (e.type === 'cue' ? e.name === w.n : e.type === 'scene' && e.n === w.s)) || null, { n: name, s: name === 's2' ? 2 : name === 'antlerFreeze' ? 3 : 8 });
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
  fs.writeFileSync(path.join(QA, 's0-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, cuts: report.checks.sceneCuts && report.checks.sceneCuts.cuts, keyCues: report.checks.keyCues, realtime: report.checks.realtime, failures: report.failures }, null, 1));
  process.exit(report.pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
