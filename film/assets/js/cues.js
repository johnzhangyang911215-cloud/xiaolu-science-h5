/* Single source of truth for music timecodes (docs/03-production-plan.md §2).
   Animation code must reference cue names, never bare seconds. */
(function () {
  const FPS = 30;
  // Round half up; the epsilon absorbs float error (31.95*30 = 958.4999…).
  const frame = (s) => Math.floor(s * FPS + 0.5 + 1e-6);

  // V2 (revision after S7): 91.50 s cut on the same bgm, following the user's reference edit. Every cue sits on the
  // music's 2.128 s bar grid (or its half), measured from the original cue list.
  const CUES = {
    open: 0.07, locate: 3.25, lock: 5.37,
    s2: 7.50, dolly: 9.64, holo: 12.84, antlerGlow: 14.97, ring: 17.07,
    s3: 21.34, layerBlood: 23.45, layerPowder: 25.58, wax: 27.71, collagen: 31.95, antlerFreeze: 34.09,
    s4: 36.20, journal: 40.47,
    s6: 46.85, cold: 48.97, labelPowder: 51.10, labelSolvent: 53.22, close: 55.35,
    s7: 57.47, ringOff: 59.58, pressContact: 60.65, pressBottom: 61.72, shake1: 63.85, shake2: 64.91, snap: 65.97, dropLand: 68.10,
    s5: 70.22, dataIn: 72.35, dataLock: 74.47,
    s8: 81.90, logo: 82.97, fadeOut: 88.30, end: 91.50
  };

  // `cue` is a cue name; scene 1 is shown from t = 0 even though its cue (`open`) is 0.07 s.
  // Scene numbers stay attached to their files; scene 5 (efficacy, scene5.js) now plays after scene 7.
  const SCENES = [
    { n: 1, name: '序 · 定位双阳', cue: 'open' },
    { n: 2, name: '鹿 · 推向鹿茸', cue: 's2' },
    { n: 3, name: '茸 · 分层与原料数据', cue: 's3' },
    { n: 4, name: '研 · 营养环与期刊', cue: 's4' },
    { n: 6, name: '锁 · −40℃ 双仓', cue: 's6' },
    { n: 7, name: '释 · 使用三步', cue: 's7' },
    { n: 5, name: '效 · 28 天抗皱功效', cue: 's5' },
    { n: 8, name: '尾 · 双 Logo', cue: 's8' }
  ];

  // 社媒版 (?cut=social): the globe prologue is replaced by a herd crossing the snow forest (scene 2's world) with the
  // opening question; from `s2` on, both cuts share every cue, so only the first 7.5 s differ.
  const CUT = new URLSearchParams(location.search).get('cut') === 'social' ? 'social' : 'main';
  if (CUT === 'social') SCENES[0] = { n: 2, name: '鹿群 · 提问', cue: 'open' };

  const frames = {};
  for (const k in CUES) frames[k] = frame(CUES[k]);
  SCENES.forEach((s, i) => {
    s.inFrame = i === 0 ? 0 : frames[s.cue];
    s.outFrame = i === SCENES.length - 1 ? frames.end : frames[SCENES[i + 1].cue];
    s.inSec = i === 0 ? 0 : CUES[s.cue];
    s.outSec = i === SCENES.length - 1 ? CUES.end : CUES[SCENES[i + 1].cue];
  });

  window.FILM = {
    fps: FPS,
    cut: CUT,
    duration: CUES.end,
    totalFrames: frames.end, // frames 0 … totalFrames-1 are exported
    cues: CUES,
    cueFrames: frames,
    scenes: SCENES,
    frame
  };
})();
