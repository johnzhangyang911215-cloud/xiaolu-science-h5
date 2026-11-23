#!/usr/bin/env node
'use strict';
/* Deterministic 30 fps capture of film/ → MP4 (H.264 + AAC, original bgm.mp3 at 1.0× with the plan's fades).
   Usage:  node tools/export_film.cjs [--out film/qa/film.mp4] [--range 0:3127] [--crf 16] [--maxrate 4M --bufsize 8M]
           node tools/export_film.cjs --smoke        silent VP9 .webm via Playwright's bundled ffmpeg, to prove the frame pipeline
   Needs a full ffmpeg (libx264, aac, mp3 decoder): set FFMPEG=/path/to/ffmpeg or put it on PATH. */
const fs = require('fs'), path = require('path');
const { spawn, spawnSync } = require('child_process');
const { FILM_DIR, serve, launch } = require('./film_common.cjs');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const smoke = args.includes('--smoke');
const TOTAL = 3127, FPS = 30, FADE_IN = 1.2, FADE_OUT_AT = 101.03, DURATION = TOTAL / FPS;
const [a, b] = opt('--range', '0:' + TOTAL).split(':').map(Number);
const out = path.resolve(opt('--out', path.join(FILM_DIR, 'qa', smoke ? 'film-smoke.webm' : 'film.mp4')));
const full = a === 0 && b === TOTAL;

function findFfmpeg() {
  if (smoke) {
    const dirs = fs.existsSync('/ms-playwright') ? fs.readdirSync('/ms-playwright').filter((d) => d.startsWith('ffmpeg')) : [];
    for (const d of dirs) for (const n of ['ffmpeg-linux', 'ffmpeg-mac', 'ffmpeg']) { const p = path.join('/ms-playwright', d, n); if (fs.existsSync(p)) return p; }
    throw new Error('--smoke needs the ffmpeg that ships with Playwright browsers (/ms-playwright/ffmpeg-*).');
  }
  const bin = process.env.FFMPEG || 'ffmpeg';
  const enc = spawnSync(bin, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  const dec = spawnSync(bin, ['-hide_banner', '-decoders'], { encoding: 'utf8' });
  const mux = spawnSync(bin, ['-hide_banner', '-muxers'], { encoding: 'utf8' });
  if (enc.error || !/libx264/.test(enc.stdout) || !/\baac\b/.test(enc.stdout) || !/\bmp3/.test(dec.stdout) || !/\bmp4\b/.test(mux.stdout))
    throw new Error('Need a full ffmpeg (libx264, aac, mp3 decoder, mp4 muxer). Install one and set FFMPEG=/path/to/ffmpeg. Tried: ' + bin);
  return bin;
}

(async () => {
  const ffmpeg = findFfmpeg();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const audio = path.join(FILM_DIR, 'assets/audio/bgm.mp3');
  const ffArgs = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', smoke ? 'mjpeg' : 'png', '-i', 'pipe:0'];
  if (smoke) ffArgs.push('-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-deadline', 'realtime', '-cpu-used', '8', '-pix_fmt', 'yuv420p', out);
  else {
    const t0 = a / FPS, len = (b - a) / FPS;
    ffArgs.push('-ss', String(t0), '-t', String(len), '-i', audio,
      '-af', `volume=0.8,afade=t=in:st=0:d=${FADE_IN},afade=t=out:st=${FADE_OUT_AT}:d=${DURATION - FADE_OUT_AT}`,
      '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', opt('--crf', '16'),
      ...(opt('--maxrate', '') ? ['-maxrate', opt('--maxrate', ''), '-bufsize', opt('--bufsize', opt('--maxrate', ''))] : []), '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', out);
    if (!full) console.log('note: partial range; fades are only correct for the full film');
  }
  const enc = spawn(ffmpeg, ffArgs, { stdio: ['pipe', 'ignore', 'inherit'] });
  const encDone = new Promise((res, rej) => { enc.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))); enc.on('error', rej); });
  let encFailed = null;
  encDone.catch((e) => { encFailed = e; });

  const { server, base } = await serve();
  const browser = await launch();
  const report = { out, frames: 0, range: [a, b], scenes: {}, cueHitFrames: [], mismatches: [] };
  try {
    const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
    await page.goto(base + 'index.html?capture=1');
    await page.waitForFunction(() => window.__ready === true);
    const t0 = Date.now();
    for (let f = a; f < b; f++) {
      const st = await page.evaluate((fr) => { window.__seekFrame(fr); const s = window.__scene(); return { n: s.n, frame: s.frame, hit: document.getElementById('stage').classList.contains('on-cue') }; }, f);
      if (st.frame !== f) report.mismatches.push(f);
      if (!(st.n in report.scenes)) report.scenes[st.n] = f;
      if (st.hit) report.cueHitFrames.push(f);
      const png = await page.screenshot(smoke ? { type: 'jpeg', quality: 95 } : { type: 'png' });
      if (encFailed) throw encFailed;
      if (!enc.stdin.write(png)) await new Promise((r, j) => { enc.stdin.once('drain', r); enc.once('close', () => j(encFailed || new Error('ffmpeg closed early'))); });
      report.frames++;
      if (f % 300 === 0) console.log(`frame ${f}/${b}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    enc.stdin.end();
    await encDone;
  } finally { await browser.close(); server.close(); }
  report.bytes = fs.statSync(out).size;
  fs.writeFileSync(out.replace(/\.[^.]+$/, '') + '.report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, frames: report.frames, bytes: report.bytes, sceneFirstFrames: report.scenes, mismatches: report.mismatches.length }));
  if (report.mismatches.length) process.exit(1);
})().catch((e) => { console.error(e.message); process.exit(2); });
