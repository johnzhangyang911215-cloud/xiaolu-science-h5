/* Single source of truth for music timecodes (docs/03-production-plan.md §2).
   Animation code must reference cue names, never bare seconds. */
(function () {
  const FPS = 30;
  // Round half up; the epsilon absorbs float error (31.95*30 = 958.4999…).
  const frame = (s) => Math.floor(s * FPS + 0.5 + 1e-6);

  const CUES = {
    open: 0.07, push1: 3.25, push2: 7.50, push3: 9.64, cloud: 11.24, shuangyang: 12.84,
    s2: 17.07, deerStop: 21.34, deerLook: 23.45, fillStart: 31.95,
    antlerFreeze: 34.09, layerBone: 36.20, layerBlood: 38.34, layerPowder: 40.47, wax: 42.59,
    s4: 44.72, ref1: 48.97, ref2: 53.22, converge: 57.47,
    s5: 59.58, family: 61.72, single: 65.97,
    s6: 68.10, labelPowder: 72.35, labelSolvent: 74.47, close: 76.60,
    s7: 77.65, ringGrip: 78.72, ringOff: 81.90, pressContact: 84.03, pressBottom: 86.15,
    powderHit: 89.35, shake1: 89.35, shake2: 90.42, shake3: 91.49, snap: 93.60,
    dropLand: 95.71, pullBack: 97.85,
    s8: 99.99, fadeOut: 101.03, logo: 102.10, end: 104.23
  };

  // `cue` is a cue name; scene 1 is shown from t = 0 even though its cue (`open`) is 0.07 s.
  const SCENES = [
    { n: 1, name: '序 · 地球到双阳', cue: 'open' },
    { n: 2, name: '雪原 · 鹿头到茸尖', cue: 's2' },
    { n: 3, name: '茸 · 蜡片的位置', cue: 'antlerFreeze' },
    { n: 4, name: '研 · 对应研究', cue: 's4' },
    { n: 5, name: '凝 · 系列与单支', cue: 's5' },
    { n: 6, name: '锁 · −40℃ 双仓', cue: 's6' },
    { n: 7, name: '释 · 使用五步', cue: 's7' },
    { n: 8, name: '尾 · 品名与 Logo', cue: 's8' }
  ];

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
    duration: CUES.end,
    totalFrames: frames.end, // frames 0 … totalFrames-1 are exported
    cues: CUES,
    cueFrames: frames,
    scenes: SCENES,
    frame
  };
})();
