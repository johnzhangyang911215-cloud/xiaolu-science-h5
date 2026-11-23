/* Scenes 2 + 3 · 雪原 · 鹿头到茸尖 / 茸 · 蜡片的位置 (docs/02-storyboard.md 幕 2–3, docs/03-production-plan.md §4).
   One renderer and one 3D scene shared by both scenes: the camera move that ends on the antler tip at `antlerFreeze`
   is the same shot that opens the antler in scene 3. Like scene1.js, render(t) is a pure function of time: the deer
   pose is evaluated from fixed action times (mixer.update(0)), the camera is a closed-form path, and the snow phase is
   the integral of its speed, so seek/export reproduce any frame. World units are metres; the deer walks along +x. */
(function () {
  const F = window.FILM, THREE = window.THREE, T3X = window.T3X;
  const FPS = F.fps, W = 1920, H = 1080, D2R = Math.PI / 180;
  const K = {};
  for (const k in F.cueFrames) K[k] = F.cueFrames[k] / FPS;
  const FREEZE = K.antlerFreeze;
  const BEAT = (FREEZE - K.fillStart) / 4;         // 4 fill beats, 0.533 s each
  const FILL = [0.10, 0.15, 0.20, 0.25];           // share of the push covered by each fill beat (plan §4)
  const PRE = 1 - FILL.reduce((a, b) => a + b, 0); // 0.30 before fillStart
  const LAYERS = [                                  // KT板44 proportions along the main beam, root → tip
    { id: 's3-bone', cue: 'layerBone', h0: 0, h1: 0.32, col: [0.80, 0.70, 0.56] },
    { id: 's3-blood', cue: 'layerBlood', h0: 0.32, h1: 0.59, col: [0.72, 0.20, 0.15] },
    { id: 's3-powder', cue: 'layerPowder', h0: 0.59, h1: 0.96, col: [0.92, 0.66, 0.62] }
  ];
  const WAX_H = 0.96;
  const S = 0.02;          // model units → metres (antler top ≈ 1.8 m)
  const V = 41.8 * S;      // walk speed from the clip's root motion (≈ 59 model units per 1.417 s cycle)
  const CYCLE = 59 * S;
  const FRAC = 0.60;       // antler share of frame height at the freeze (storyboard: about 60 %)
  const FRAC3 = 0.46;      // scene 3 pulls back "half a step"
  const MOON = new THREE.Vector3(-0.2, 0.55, -1).normalize();

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sat = (v) => clamp(v, 0, 1);
  const smooth = (a, b, x) => { const u = sat((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  const inOut = (x) => 0.5 - 0.5 * Math.cos(Math.PI * sat(x));
  const p2out = (x) => 1 - (1 - sat(x)) * (1 - sat(x));
  const p3in = (x) => sat(x) * sat(x) * sat(x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const NOISE = (window.FILM_LIB && window.FILM_LIB.NOISE_GLSL) || '';

  // ---------- camera push schedule p(t) ----------
  function pushAt(t) {
    if (t <= K.deerLook) return 0;
    if (t < K.fillStart) return PRE * inOut((t - K.deerLook) / (K.fillStart - K.deerLook));
    if (t >= FREEZE) return 1;
    const i = Math.min(3, Math.floor((t - K.fillStart) / BEAT));
    const x = (t - K.fillStart - i * BEAT) / BEAT;
    let p = PRE;
    for (let j = 0; j < i; j++) p += FILL[j];
    return p + FILL[i] * (i < 3 ? p2out(x) : p3in(x)); // beats 1–3 punch, beat 4 accelerates into a hard stop
  }
  // snow phase = ∫ speed: full speed, 30 % after the freeze (still visibly falling, plan §3 QA)
  const snowPhase = (t) => (t < FREEZE ? t : FREEZE + 0.3 * (t - FREEZE));

  // ---------- shaders ----------
  const skyVS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
  const skyFS = `uniform vec3 uMoon; uniform float uDim; varying vec3 vDir;
    void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
      vec3 c = mix(vec3(0.020, 0.026, 0.046), vec3(0.003, 0.004, 0.009), pow(h, 0.5));
      float m = max(dot(d, uMoon), 0.0); c += vec3(0.07, 0.085, 0.12) * pow(m, 12.0) + vec3(0.012, 0.015, 0.024) * pow(m, 2.0);
      gl_FragColor = vec4(c * uDim, 1.0); }`;
  const groundVS = `varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const groundFS = NOISE + `uniform vec3 uMoon; uniform float uDim; varying vec3 vW; varying float vD;
    void main(){ vec2 q = vW.xz;
      float n = n3(vec3(q * 0.35, 1.0)) * 0.6 + n3(vec3(q * 1.3, 2.0)) * 0.3 + n3(vec3(q * 5.0, 3.0)) * 0.1;
      float e = 0.02; float nx = n3(vec3((q + vec2(e, 0.0)) * 0.35, 1.0)) - n3(vec3(q * 0.35, 1.0)); float nz = n3(vec3((q + vec2(0.0, e)) * 0.35, 1.0)) - n3(vec3(q * 0.35, 1.0));
      vec3 nrm = normalize(vec3(-nx * 6.0, 1.0, -nz * 6.0));
      float lit = 0.55 + 0.45 * max(dot(nrm, uMoon), 0.0);
      vec3 c = vec3(0.085, 0.10, 0.145) * lit * (0.82 + 0.3 * n);
      float sp = step(0.9965, h3(vec3(floor(vW.xz * 140.0), 7.0))) * smoothstep(9.0, 2.0, vD); c += vec3(0.5, 0.55, 0.65) * sp;
      float fog = 1.0 - exp(-vD * 0.07); c = mix(c, vec3(0.018, 0.023, 0.038), fog);
      gl_FragColor = vec4(c * uDim, 1.0); }`;
  const barkVS = `varying vec3 vL; varying vec3 vN; varying float vD; varying vec3 vW;
    void main(){ vL = position; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz;
      vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const barkFS = NOISE + `uniform vec3 uMoon; uniform float uDim; varying vec3 vL; varying vec3 vN; varying float vD; varying vec3 vW;
    void main(){ float a = atan(vL.z, vL.x); vec3 seed = vec3(floor(vW.x * 3.0), floor(vW.z * 3.0), 0.0);
      float lent = n3(vec3(a * 3.0, vL.y * 9.0, h3(seed) * 50.0)); float band = n3(vec3(a * 0.8, vL.y * 0.7, h3(seed + 1.0) * 50.0));
      float dark = smoothstep(0.62, 0.70, lent) * smoothstep(0.25, 0.4, abs(fract(vL.y * 2.3 + band) - 0.5)) ;
      dark = max(dark, smoothstep(0.74, 0.8, band) * 0.9) * (1.0 - smoothstep(4.0, 10.0, vL.y) * 0.0);
      float wrap = 0.35 + 0.35 * max(dot(vN, uMoon) + 0.3, 0.0);
      vec3 c = mix(vec3(0.17, 0.175, 0.19), vec3(0.012, 0.012, 0.015), dark) * wrap;
      c *= 0.6 + 0.4 * smoothstep(-0.2, 1.2, vL.y);
      float fog = 1.0 - exp(-vD * 0.085); c = mix(c, vec3(0.018, 0.023, 0.038), fog);
      gl_FragColor = vec4(c * uDim, 1.0); }`;
  // single-pass golden-angle bokeh (after Kennedy/Gustafsson), plus exposure, tone curve, sRGB and grain
  const quadVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const dofFS = NOISE + `uniform sampler2D tCol; uniform sampler2D tDep; uniform vec2 uRes; uniform float uFocus, uCoc, uMaxR, uNear, uFar, uExpo, uSeed, uGrain;
    varying vec2 vUv;
    float lin(float d){ return uNear * uFar / (uFar - d * (uFar - uNear)); }
    float coc(float z){ return min(uCoc * abs(1.0 / uFocus - 1.0 / z), uMaxR); }
    void main(){
      vec3 c0 = texture2D(tCol, vUv).rgb; float z0 = lin(texture2D(tDep, vUv).r); float s0 = coc(z0);
      vec3 acc = c0; float tot = 1.0; float r = 1.0; float ang = 0.0;
      if (uMaxR > 0.5) for (int i = 0; i < 260; i++) {
        if (r >= uMaxR) break;
        vec2 tc = vUv + vec2(cos(ang), sin(ang)) * r / uRes;
        vec3 sc = texture2D(tCol, tc).rgb; float sz = lin(texture2D(tDep, tc).r); float ss = coc(sz);
        if (sz > z0) ss = clamp(ss, 0.0, s0 * 2.0);
        float m = smoothstep(r - 0.5, r + 0.5, ss);
        acc += mix(acc / tot, sc, m); tot += 1.0;
        ang += 2.39996323; r += 1.15 / r;
      }
      vec3 c = acc / tot;
      c = 1.0 - exp(-c * uExpo);
      c = pow(c, vec3(1.0 / 2.2));
      float g = h3(vec3(gl_FragCoord.xy, uSeed)) - 0.5; c += g * uGrain;
      gl_FragColor = vec4(c, 1.0); }`;
  const snowVS = `attribute vec4 seed; uniform vec3 uC; uniform vec3 uBox; uniform float uPh; uniform float uPx; uniform float uFocus; uniform float uCoc; uniform float uMaxR;
    varying float vA; varying float vZ; varying float vSharp;
    void main(){
      vec3 p = seed.xyz * uBox;
      float fall = 0.55 + 0.35 * seed.w;
      p.y -= uPh * fall; p.x += sin(uPh * (0.6 + seed.w) + seed.x * 40.0) * 0.18 + uPh * 0.08; p.z += cos(uPh * 0.7 + seed.z * 30.0) * 0.12;
      vec3 lo = uC - uBox * 0.5; p = lo + mod(p - lo, uBox);
      vec4 mv = viewMatrix * vec4(p, 1.0); vZ = -mv.z;
      float base = max(1.6, (0.0028 + 0.002 * seed.w) * uPx / vZ);
      float c = min(uCoc * abs(1.0 / uFocus - 1.0 / vZ), uMaxR * 2.2);
      float sz = base + 2.0 * c;
      vA = clamp((base * base) / (sz * sz), 0.035, 1.0) * smoothstep(0.08, 0.3, vZ);
      vSharp = clamp(1.0 - c / 6.0, 0.0, 1.0);
      gl_PointSize = sz; gl_Position = projectionMatrix * mv; }`;
  const snowFS = `uniform sampler2D tDep; uniform vec2 uRes; uniform float uNear, uFar, uK;
    varying float vA; varying float vZ; varying float vSharp;
    void main(){
      float d = texture2D(tDep, gl_FragCoord.xy / uRes).r; float sz = uNear * uFar / (uFar - d * (uFar - uNear));
      if (vZ > sz + 0.05) discard;
      vec2 q = gl_PointCoord * 2.0 - 1.0; float r = length(q); if (r > 1.0) discard;
      float disc = mix(smoothstep(1.0, 0.82, r) * (0.8 + 0.35 * smoothstep(0.6, 0.95, r)), smoothstep(1.0, 0.0, r), vSharp);
      gl_FragColor = vec4(vec3(0.82, 0.86, 0.95), disc * vA * uK); }`;
  // scene 1's cloud deck (same noise and grain), with a hole that opens around the antler tip
  const cloudFS = NOISE + `uniform float uK; uniform float uT; uniform float uGrain; uniform float uSeed; uniform float uHole; uniform vec2 uC;
    varying vec2 vUv;
    void main() {
      vec2 p = (vUv - 0.5) * vec2(1.7778, 1.0);
      float z = exp(uT * 0.9);
      vec3 q = vec3(p * 2.4 / fract(z * 0.25 + 0.5), uT * 0.35);
      float c = n3(q) * 0.5 + n3(q * 2.1 + 4.0) * 0.3 + n3(q * 4.3 + 9.0) * 0.2;
      float grain = h3(vec3(gl_FragCoord.xy, uSeed));
      float a = uK * clamp(0.55 + (c - 0.5) * 1.4 + (grain - 0.5) * 0.35, 0.0, 1.0);
      float R = uHole * 2.4; float r = length((vUv - uC) * vec2(1.7778, 1.0)) + (c - 0.5) * 0.35 * uHole;
      a *= smoothstep(R * 0.45, R, r);
      vec3 col = vec3(0.46, 0.48, 0.52) * (0.75 + 0.5 * c) + (grain - 0.5) * 0.18;
      float gr = (grain - 0.5) * uGrain;
      gl_FragColor = vec4(col * a + max(gr, 0.0) * a, a);
    }`;
  const innerVS = `attribute float hh; varying float vH; varying vec3 vN; varying vec3 vV;
    void main(){ vH = hh; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`;
  const innerFS = `uniform vec3 uCol[4]; uniform float uB[4]; uniform float uGrey[4]; uniform float uA; uniform float uCut; uniform float uWax;
    varying float vH; varying vec3 vN; varying vec3 vV;
    void main(){
      float hb = vH;
      if (uCut > 0.5 ? hb > ${WAX_H.toFixed(2)} : (uWax > 0.5 && hb < ${WAX_H.toFixed(2)})) discard;
      int i = hb < 0.32 ? 0 : hb < 0.59 ? 1 : hb < ${WAX_H.toFixed(2)} ? 2 : 3;
      vec3 col = i == 0 ? uCol[0] : i == 1 ? uCol[1] : i == 2 ? uCol[2] : uCol[3];
      float b = i == 0 ? uB[0] : i == 1 ? uB[1] : i == 2 ? uB[2] : uB[3];
      float g = i == 0 ? uGrey[0] : i == 1 ? uGrey[1] : i == 2 ? uGrey[2] : uGrey[3];
      col = mix(col, vec3(0.78, 0.78, 0.76), g);
      vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; vec3 v = normalize(vV);
      float dif = 0.45 + 0.55 * max(dot(n, normalize(vec3(0.4, 0.6, 0.7))), 0.0);
      float fr = pow(1.0 - max(dot(n, v), 0.0), 2.5);
      vec3 c = col * b * (dif + 0.8 * fr);
      float dd = min(min(abs(hb - 0.32), abs(hb - 0.59)), abs(hb - ${WAX_H.toFixed(2)}));
      float seam = 1.0 - smoothstep(0.0, fwidth(hb) * 1.5 + 0.002, dd);
      c = mix(c, vec3(0.95, 0.93, 0.88) * 0.6, seam * 0.6 * uA * (1.0 - uWax));
      if (i == 3) c = col * b * (0.75 + 0.35 * fr);
      gl_FragColor = vec4(c, uA); }`;

  // ---------- state ----------
  let renderer, scene, camera, rt, dofMat, dofScene, quadCam, snowScene, snowMats = [], cloudMat, cloudScene, glow, waxGlow;
  let deerG, deerRoot, mixer, aWalk, aIdle, bones = {}, antN, antF, innerMesh, waxMesh, bodyMats = [], shellMat, farMat;
  let skyMat, groundMat, barkMat;
  const dimU = { value: 1 }, moonViewU = { value: new THREE.Vector3() };
  let root, svg, txt = {}, leaders = {}, dots = {}, copy = [];
  let ant = null; // near-antler geometry facts in its local frame
  let dF = 1, d3 = 1, dWax = 0.3, active2 = false, active3 = false, lastProbe = null;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  function el(tag, attrs, parent) {
    const ns = tag === 'div' || tag === 'canvas' ? null : 'http://www.w3.org/2000/svg';
    const e = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function project(v) {
    tmp.copy(v).project(camera);
    return { x: (tmp.x + 1) / 2 * W, y: (1 - tmp.y) / 2 * H, vis: tmp.z < 1 && tmp.z > -1 };
  }
  const entryTime = (v) => (typeof v === 'string' ? K[v] : v);
  function copyAlpha(id, t) {
    const c = copy.find((e) => e.id === id);
    if (!c) return 0;
    const a = entryTime(c.in), b = entryTime(c.out);
    return smooth(a, a + 0.35, t) * (1 - smooth(b - 0.35, b, t));
  }

  // ---------- deer ----------
  function fixClips(clips) {
    // The calf rig's idle/eat/drink clips carry a bogus (0, 60.06, 0) translation on two spine bones that lifts the
    // body ~3 m off the hips (the bind pose has it too, so the tracks are overwritten rather than dropped).
    for (const a of clips) for (const tr of a.tracks) {
      if (/^(Spine_03_016|Spine_04_04)\.position$/.test(tr.name)) tr.values.fill(0);
      if (tr.name === 'Spine_base_03.position' && !/Walk|Rotate/.test(a.name))
        for (let i = 0; i < tr.values.length; i += 3) { tr.values[i] = 0; tr.values[i + 1] = 0; tr.values[i + 2] = 1.09; }
      if (tr.name === 'root_bone_02.position' && /Walk/.test(a.name)) // drop root motion; the group is moved instead
        for (let i = 0; i < tr.values.length; i += 3) { tr.values[i] = tr.values[0]; tr.values[i + 1] = tr.values[1]; tr.values[i + 2] = tr.values[2]; }
    }
  }
  const STEP_T = () => K.deerStop - 0.5;
  function deerX(t) {
    const st = STEP_T();
    if (t < st) return -(V * (st - t) + 0.25 * V);
    if (t < K.deerStop) { const u = K.deerStop - t; return -V * u * u; }
    return 0;
  }
  const raiseAt = (t) => inOut((t - K.deerStop) / (K.deerLook - K.deerStop));
  const RAISE = [['neck_01_019', 0.4], ['neck_02_020', 0.35], ['head_021', 0.25]], rawQ = {};
  const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), axisW = new THREE.Vector3();
  function poseDeer(t) {
    const tf = clamp(t, K.s2, FREEZE); // the deer stops with the camera at the freeze
    const st = STEP_T();
    const x = deerX(tf);
    const wWalk = 1 - sat((tf - st) / 0.5);
    aWalk.time = (((x - deerX(K.s2) + 0.37 * CYCLE) / CYCLE) % 1 + 1) % 1 * aWalk.getClip().duration;
    const ti = Math.max(0, tf < K.deerLook ? tf - st : K.deerLook - st + 0.3 * (tf - K.deerLook));
    aIdle.time = ti % aIdle.getClip().duration;
    aWalk.setEffectiveWeight(wWalk);
    aIdle.setEffectiveWeight(1 - wWalk);
    // PropertyMixer only writes values that changed since its last apply, so undo our head raise first
    for (const n in rawQ) bones[n].quaternion.copy(rawQ[n]);
    mixer.update(0);
    for (const n of RAISE) (rawQ[n[0]] = rawQ[n[0]] || new THREE.Quaternion()).copy(bones[n[0]].quaternion);
    deerG.position.x = x;
    deerG.updateMatrixWorld(true);
    // head raise: rotate neck/head about the deer's lateral axis (world), distributed down the chain
    const ang = -24 * D2R * raiseAt(tf);
    axisW.set(1, 0, 0).transformDirection(deerRoot.matrixWorld);
    for (const [n, k] of RAISE) {
      const b = bones[n];
      b.parent.getWorldQuaternion(qp);
      qa.setFromAxisAngle(axisW, ang * k);
      b.quaternion.premultiply(qp.clone().invert().multiply(qa).multiply(qp));
      b.updateMatrixWorld(true);
    }
  }
  function anchors() {
    const m = antN.matrixWorld;
    return {
      T: ant.top.clone().applyMatrix4(m), B: ant.base.clone().applyMatrix4(m),
      M: ant.mid.clone().applyMatrix4(m), Hd: bones.head_021.getWorldPosition(new THREE.Vector3()),
      axis: ant.axisL.clone().transformDirection(m)
    };
  }

  // ---------- camera ----------
  const dirM = V3(0.45, 0.05, 1).normalize(), dirF = V3(0.32, -0.2, 1).normalize(), dir3 = V3(0.18, -0.08, 1).normalize();
  function bez(a, b, c, u) { // quadratic through b at u = 0.5
    const k = b.clone().multiplyScalar(2).sub(a.clone().add(c).multiplyScalar(0.5));
    return a.clone().multiplyScalar((1 - u) * (1 - u)).add(k.multiplyScalar(2 * u * (1 - u))).add(c.clone().multiplyScalar(u * u));
  }
  function camAt(t, A) {
    const x = deerX(clamp(t, K.s2, FREEZE));
    // wide lateral track: camera lags the deer, starts on the antler tip (where scene 1 left its gold point)
    const kW = sat((t - K.s2) / (K.deerStop - K.s2));
    const tgtW = V3(0.8 * x + 0.35, 1.05, 0);
    const startTgt = A.T.clone().add(V3(0, -0.5, 0));
    const tW = startTgt.lerp(tgtW, inOut((t - K.s2 - 0.2) / 2.6));
    const pW = V3(0.8 * x + 0.75 - 0.25 * kW, 1.25, 6.6 - 0.5 * kW);
    // medium on the raised head
    const tM = A.Hd.clone().add(V3(0, 0.12, 0));
    const pM = tM.clone().addScaledVector(dirM, 2.4);
    const kM = inOut((t - (K.deerStop - 0.8)) / (K.deerLook - K.deerStop + 0.8));
    let pos = pW.lerp(pM, kM), tgt = tW.lerp(tM, kM);
    const p = pushAt(t);
    if (t > K.deerLook) {
      const tgtF = A.B.clone().lerp(A.T, 0.55);
      tgt = bez(tM, A.B, tgtF, p);
      const d = 2.4 * Math.pow(dF / 2.4, p);
      pos = tgt.clone().addScaledVector(dirM.clone().lerp(dirF, p).normalize(), d);
    }
    let focus = A.T;
    if (t > FREEZE) {
      const tgtF = A.B.clone().lerp(A.T, 0.55);
      const r = inOut((t - FREEZE - 0.15) / (K.layerBone - FREEZE - 0.15));
      const dir = dirF.clone().lerp(dir3, r).normalize();
      const side = V3(0, 1, 0).cross(dir).normalize().negate(); // camera-left in world: shift target right → antler sits left of centre
      const vw = 2 * d3 * Math.tan(15 * D2R) * W / H;
      const t3 = A.M.clone().addScaledVector(side, -0.1 * vw);
      tgt = tgtF.lerp(t3, r);
      let d = lerp(dF, d3, r);
      // wax: float off the tip, then the camera closes in on it and centres it (hand-off to scene 4)
      const z = inOut((t - K.wax - 0.4) / (K.s4 - 0.12 - K.wax - 0.4));
      if (z > 0) { tgt.lerp(waxCentre(t), z); d = lerp(d, dWax, z); }
      pos = tgt.clone().addScaledVector(dir, d);
      focus = A.M;
    }
    return { pos, tgt, p, focus };
  }
  const waxLift = (t) => inOut((t - K.wax - 0.25) / 1.3);
  function waxCentre(t) {
    return ant.waxC.clone().addScaledVector(ant.axisL, ant.lift * waxLift(t)).applyMatrix4(antN.matrixWorld);
  }
  function placeCamera(c) {
    camera.position.copy(c.pos);
    camera.lookAt(c.tgt);
    camera.updateMatrixWorld(true);
  }
  function antlerFrac() {
    const pos = antN.geometry.attributes.position, m = antN.matrixWorld;
    let y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < pos.count; i += 2) {
      tmp2.fromBufferAttribute(pos, i).applyMatrix4(m).project(camera);
      y0 = Math.min(y0, tmp2.y); y1 = Math.max(y1, tmp2.y);
    }
    return { frac: (y1 - y0) / 2, top: (1 - y1) / 2 * H, bottom: (1 - y0) / 2 * H };
  }

  // ---------- build ----------
  function analyseAntler(mesh) {
    const g = mesh.geometry, pos = g.attributes.position, m = mesh.matrixWorld, n = pos.count;
    const wy = new Float32Array(n);
    let yMin = 1e9, yMax = -1e9, iTop = 0;
    for (let i = 0; i < n; i++) {
      wy[i] = tmp.fromBufferAttribute(pos, i).applyMatrix4(m).y;
      if (wy[i] < yMin) yMin = wy[i];
      if (wy[i] > yMax) { yMax = wy[i]; iTop = i; }
    }
    const top = V3(0, 0, 0).fromBufferAttribute(pos, iTop), base = V3(0, 0, 0);
    let nb = 0;
    for (let i = 0; i < n; i++) if (wy[i] < yMin + 0.07 * (yMax - yMin)) { base.add(tmp.fromBufferAttribute(pos, i)); nb++; }
    base.multiplyScalar(1 / nb);
    const A = top.clone().sub(base), L2 = A.lengthSq();
    const hh = new Float32Array(n);
    for (let i = 0; i < n; i++) hh[i] = clamp(tmp.fromBufferAttribute(pos, i).sub(base).dot(A) / L2, 0, 1);
    const centre = (h0, h1) => {
      const c = V3(0, 0, 0); let k = 0;
      for (let i = 0; i < n; i++) if (hh[i] >= h0 && hh[i] <= h1) { c.add(tmp.fromBufferAttribute(pos, i)); k++; }
      return k ? c.multiplyScalar(1 / k) : base.clone().addScaledVector(A, (h0 + h1) / 2);
    };
    // main-beam centreline: walk down from the tip, following the cluster nearest the previous centre (skips the brow tine)
    const NB = 40, chain = [], Rk = 0.12 * A.length();
    let cc = top.clone();
    for (let b = NB - 1; b >= 0; b--) {
      const c = V3(0, 0, 0); let k = 0;
      for (let i = 0; i < n; i++) if (hh[i] >= b / NB && hh[i] < (b + 1) / NB) { tmp.fromBufferAttribute(pos, i); if (tmp.distanceTo(cc) < Rk) { c.add(tmp); k++; } }
      if (k) cc = c.multiplyScalar(1 / k);
      chain[b] = cc.clone();
    }
    const beam = (h) => chain[clamp(Math.floor(h * NB), 0, NB - 1)];
    // radius near the tip → lift distance (1.2 antler diameters, storyboard 幕 3)
    let rr = 0, kr = 0;
    const axisL = A.clone().normalize();
    for (let i = 0; i < n; i++) if (hh[i] > 0.9 && hh[i] < 0.97) {
      tmp.fromBufferAttribute(pos, i).sub(base); const along = tmp.dot(axisL); tmp.addScaledVector(axisL, -along); rr += tmp.length(); kr++;
    }
    const rTip = kr ? rr / kr : A.length() * 0.03;
    return {
      hh, top, base, axisL, len: A.length(), mid: base.clone().addScaledVector(A, 0.5), waxC: centre(WAX_H, 1),
      lab: LAYERS.map((L) => beam((L.h0 + L.h1) / 2)).concat([centre(0.975, 1)]),
      lift: 1.2 * 2 * rTip
    };
  }

  function rimify(mat, warm) {
    mat.userData.rim = { value: 0 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRimK = mat.userData.rim; sh.uniforms.uDim = mat.userData.dim || dimU; sh.uniforms.uMoonV = moonViewU;
      sh.fragmentShader = 'uniform float uRimK; uniform float uDim; uniform vec3 uMoonV;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
        `{ float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
           float side = clamp(dot(normal, uMoonV) * 0.6 + 0.55, 0.0, 1.0);
           outgoingLight += ${warm ? 'vec3(1.0, 0.72, 0.38)' : 'vec3(0.55, 0.62, 0.8)'} * fr * side * uRimK; outgoingLight *= uDim; }
         #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'xl-rim-' + (warm ? 1 : 0);
    mat.needsUpdate = true;
  }

  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    // same stops as #s1-dot (radius 90 px → 128)
    [[0, 'rgba(255,247,230,1)'], [0.045, 'rgba(255,241,214,1)'], [0.09, 'rgba(240,200,140,.95)'], [0.2, 'rgba(200,162,106,.6)'],
      [0.47, 'rgba(200,162,106,.2)'], [0.73, 'rgba(200,162,106,.06)'], [1, 'rgba(200,162,106,0)']].forEach(([o, s]) => gr.addColorStop(o, s));
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function buildEnv() {
    skyMat = new THREE.ShaderMaterial({ uniforms: { uMoon: { value: MOON }, uDim: dimU }, vertexShader: skyVS, fragmentShader: skyFS, side: THREE.BackSide, depthWrite: false });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), skyMat); sky.renderOrder = -10; scene.add(sky);
    groundMat = new THREE.ShaderMaterial({ uniforms: { uMoon: { value: MOON }, uDim: dimU }, vertexShader: groundVS, fragmentShader: groundFS });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260, 1, 1), groundMat); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    barkMat = new THREE.ShaderMaterial({ uniforms: { uMoon: { value: MOON }, uDim: dimU }, vertexShader: barkVS, fragmentShader: barkFS });
    const trees = [];
    // background stands
    for (let i = 0; trees.length < 85 && i < 2000; i++) {
      const x = -26 + 52 * hash(i * 3.1), z = -2.2 - 26 * Math.pow(hash(i * 5.7 + 1), 1.3);
      if (z > -4.5 && x > -2.5) continue; // keep the sky behind the head/antler close-ups clear of near trunks
      trees.push([x, z, 0.07 + 0.11 * hash(i * 7.3 + 2), hash(i * 2.9 + 4)]);
    }
    // the stand the deer walks out of, and a few foreground trunks that wipe past the tracking camera
    [[-4.2, -0.9, 0.13], [-5.3, -1.6, 0.11], [-3.4, -2.6, 0.09], [-6.4, -0.4, 0.15], [-7.6, -2.0, 0.12],
      [-4.9, 2.6, 0.16], [-7.2, 3.3, 0.2], [-9.4, 2.4, 0.14], [3.6, 3.4, 0.18]].forEach(([x, z, r], k) => trees.push([x, z, r, hash(k + 77)]));
    const geo = new THREE.CylinderGeometry(1, 1.15, 16, 18, 1, true); geo.translate(0, 8, 0);
    const inst = new THREE.InstancedMesh(geo, barkMat, trees.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    trees.forEach(([x, z, r, s], i) => {
      e.set((s - 0.5) * 0.06, s * 6, (hash(s * 91) - 0.5) * 0.07);
      m4.compose(V3(x, -0.05, z), q.setFromEuler(e), V3(r, 1, r));
      inst.setMatrixAt(i, m4);
    });
    inst.frustumCulled = false;
    scene.add(inst);
  }

  function buildSnow() {
    snowScene = new THREE.Scene();
    for (const [n, box] of [[2400, V3(3.2, 3.2, 3.2)], [16000, V3(26, 12, 26)]]) {
      const g = new THREE.BufferGeometry(), seed = new Float32Array(n * 4);
      for (let i = 0; i < n * 4; i++) seed[i] = hash(i * 1.37 + box.x * 17);
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
      const m = new THREE.ShaderMaterial({
        uniforms: {
          uC: { value: new THREE.Vector3() }, uBox: { value: box }, uPh: { value: 0 }, uPx: { value: H / (2 * Math.tan(15 * D2R)) },
          uFocus: { value: 1 }, uCoc: { value: 0 }, uMaxR: { value: 16 }, tDep: { value: rt.depthTexture }, uRes: { value: new THREE.Vector2(W, H) },
          uNear: { value: camera.near }, uFar: { value: camera.far }, uK: { value: 1 }
        },
        vertexShader: snowVS, fragmentShader: snowFS, transparent: true, depthTest: false, depthWrite: false
      });
      const pts = new THREE.Points(g, m); pts.frustumCulled = false;
      snowScene.add(pts); snowMats.push(m);
    }
  }

  async function init(stage, copyEntries) {
    if (init.p) return init.p;
    init.p = (async () => {
      copy = copyEntries.filter((e) => (e.scene === 2 || e.scene === 3) && e.status !== 'pending');
      root = el('div', { id: 's23' }, null);
      stage.insertBefore(root, stage.firstChild);
      const canvas = el('canvas', { id: 's23-gl', width: W, height: H }, root);
      svg = el('svg', { id: 's23-ov', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, root);
      for (const c of copy) {
        txt[c.id] = el('div', { class: 'copy ' + c.id + (/^s3-(bone|blood|powder|wax)$/.test(c.id) ? ' s3-lab' : ''), 'data-copy': c.id }, root);
        txt[c.id].textContent = c.text;
        if (txt[c.id].classList.contains('s3-lab')) {
          leaders[c.id] = el('path', { class: 'lead' + (c.id === 's3-wax' ? ' wax' : '') }, svg);
          dots[c.id] = el('circle', { class: 'adot' + (c.id === 's3-wax' ? ' wax' : ''), r: 5 }, svg);
        }
      }
      root.style.display = 'none';

      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(W, H, false);
      renderer.autoClear = false;
      renderer.setClearColor(0x000000, 1);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 400);
      rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(W, H) });
      rt.depthTexture.type = THREE.FloatType;
      quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      dofMat = new THREE.ShaderMaterial({
        uniforms: {
          tCol: { value: rt.texture }, tDep: { value: rt.depthTexture }, uRes: { value: new THREE.Vector2(W, H) }, uFocus: { value: 6 }, uCoc: { value: 0 },
          uMaxR: { value: 0 }, uNear: { value: camera.near }, uFar: { value: camera.far }, uExpo: { value: 1.25 }, uSeed: { value: 0 }, uGrain: { value: 0.035 }
        }, vertexShader: quadVS, fragmentShader: dofFS, depthTest: false, depthWrite: false
      });
      dofScene = new THREE.Scene(); dofScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dofMat));
      {
        cloudMat = new THREE.ShaderMaterial({
          uniforms: { uK: { value: 0 }, uT: { value: 0 }, uGrain: { value: 0.06 }, uSeed: { value: 0 }, uHole: { value: 0 }, uC: { value: new THREE.Vector2(0.5, 0.5) } },
          vertexShader: quadVS, fragmentShader: cloudFS, transparent: true, depthTest: false, depthWrite: false,
          blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
        });
        cloudScene = new THREE.Scene(); cloudScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cloudMat));
      }

      scene.add(new THREE.HemisphereLight(0x5a6a96, 0x1a1e28, 0.32));
      const moonL = new THREE.DirectionalLight(0xc4d4ff, 1.6); moonL.position.copy(MOON).multiplyScalar(20); scene.add(moonL);
      buildEnv();

      const loader = new T3X.GLTFLoader().setMeshoptDecoder(T3X.MeshoptDecoder);
      const gltf = await loader.loadAsync('assets/models/deer.glb');
      fixClips(gltf.animations);
      deerRoot = gltf.scene;
      const orient = new THREE.Group();
      orient.rotation.set(-Math.PI / 2, 0, 0); // model z-up → y-up; model forward (−y) → +z
      orient.add(deerRoot);
      const yaw = new THREE.Group(); yaw.rotation.y = Math.PI / 2; yaw.add(orient); // forward → +x
      yaw.scale.setScalar(S); yaw.position.y = -6 * S + 0.02;
      deerG = new THREE.Group(); deerG.add(yaw); scene.add(deerG);
      deerRoot.traverse((o) => {
        if (o.isBone) bones[o.name] = o;
        if (o.isMesh) o.frustumCulled = false;
      });
      mixer = new THREE.AnimationMixer(deerRoot);
      const clip = (n) => gltf.animations.find((a) => a.name.startsWith(n));
      aWalk = mixer.clipAction(clip('Walk_forward')); aIdle = mixer.clipAction(clip('Idle_1'));
      for (const a of [aWalk, aIdle]) { a.play(); a.enabled = true; }
      const antL = deerRoot.getObjectByName('Velvet_Antler_L'), antR = deerRoot.getObjectByName('Velvet_Antler_R');
      // reference pose for geometry analysis: standing, head raised
      poseDeer(K.deerLook);
      const wl = antL.getWorldPosition(V3(0, 0, 0)), wr = antR.getWorldPosition(V3(0, 0, 0));
      [antN, antF] = wl.z > wr.z ? [antL, antR] : [antR, antL]; // camera sits on +z
      ant = analyseAntler(antN);
      shellMat = antN.material.clone(); farMat = antN.material.clone();
      antN.material = shellMat; antF.material = farMat;
      farMat.userData.dim = dimU;
      shellMat.userData.dim = { value: 1 };
      rimify(shellMat, true); rimify(farMat, true);
      deerRoot.traverse((o) => {
        if (o.isSkinnedMesh) { o.material = o.material.clone(); rimify(o.material, false); bodyMats.push(o.material); }
      });
      // inner layered body + detachable wax, sharing the near antler's local frame
      const ig = antN.geometry.clone();
      ig.setAttribute('hh', new THREE.BufferAttribute(ant.hh, 1));
      if (!ig.attributes.normal) ig.computeVertexNormals();
      const ipos = ig.attributes.position, inr = ig.attributes.normal, off = ant.len * 0.006;
      for (let i = 0; i < ipos.count; i++) ipos.setXYZ(i, ipos.getX(i) - inr.getX(i) * off, ipos.getY(i) - inr.getY(i) * off, ipos.getZ(i) - inr.getZ(i) * off);
      const mkInner = (wax) => new THREE.ShaderMaterial({
        uniforms: {
          uCol: { value: LAYERS.map((L) => new THREE.Color(...L.col)).concat([new THREE.Color(0.78, 0.64, 0.42)]) },
          uB: { value: [0.15, 0.15, 0.15, 0.15] }, uGrey: { value: [0, 0, 0, 0] }, uA: { value: 0 }, uCut: { value: 0 }, uWax: { value: wax ? 1 : 0 }
        },
        vertexShader: innerVS, fragmentShader: innerFS, transparent: true, side: THREE.DoubleSide, depthWrite: true
      });
      innerMesh = new THREE.Mesh(ig, mkInner(false)); waxMesh = new THREE.Mesh(ig, mkInner(true));
      for (const m of [innerMesh, waxMesh]) { m.visible = false; m.renderOrder = 1; m.frustumCulled = false; antN.add(m); }
      shellMat.transparent = true; antN.renderOrder = 2;
      const gt = glowTexture();
      glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      waxGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
      glow.renderOrder = 3; waxGlow.renderOrder = 4;
      scene.add(glow, waxGlow);
      buildSnow();

      // calibrate the freeze framing (antler ≈ 60 % of frame height) and the scene 3 pull-back
      poseDeer(FREEZE);
      const A = anchors();
      for (let i = 0; i < 6; i++) { placeCamera(camAt(FREEZE, A)); dF *= antlerFrac().frac / FRAC; }
      d3 = dF;
      for (let i = 0; i < 6; i++) { placeCamera(camAt(K.layerBone + 0.5, A)); d3 *= antlerFrac().frac / FRAC3; }
      const waxSize = Math.max(ant.lift / 1.2, 0.05 * ant.len) * antN.matrixWorld.getMaxScaleOnAxis();
      dWax = waxSize / (0.2 * 2 * Math.tan(15 * D2R)); // wax ≈ 20 % of frame height at the hand-off
      await document.fonts.load('400 36px "XL Sans"');
      await document.fonts.load('400 46px "XL Serif"');
    })();
    return init.p;
  }

  // ---------- per-frame ----------
  function layerState(t) {
    const cues = LAYERS.map((L) => K[L.cue]);
    const waxOn = smooth(K.wax, K.wax + 0.3, t);
    const B = [], G = [];
    for (let i = 0; i < 3; i++) {
      const on = smooth(cues[i], cues[i] + 0.3, t), next = i < 2 ? smooth(cues[i + 1], cues[i + 1] + 0.4, t) : waxOn;
      let b = lerp(0.15, 1.0, on);
      b = lerp(b, 0.35, next);
      b = lerp(b, 0.2, waxOn);
      B.push(b); G.push(lerp(0.65 * (1 - on), 0.85, next));
    }
    B.push(lerp(0.15, 1.6, waxOn)); G.push(0.65 * (1 - waxOn));
    return { B, G, waxOn };
  }

  function render(t) {
    if (!renderer || !(active2 || active3)) return;
    const tc = Math.max(t, K.s2);
    // forward-difference speed probe (same pure functions, one frame ahead)
    poseDeer(tc + 1 / FPS);
    const camNext = camAt(tc + 1 / FPS, anchors()).pos;
    poseDeer(tc);
    const A = anchors();
    const c = camAt(tc, A);
    placeCamera(c);
    const camSpeed = camNext.distanceTo(c.pos) * FPS;

    const s3 = smooth(FREEZE + 0.1, K.layerBone - 0.2, tc);       // scene 3 reveal
    const dim = 1 - smooth(FREEZE + 0.2, K.layerBone - 0.3, tc);   // background → black, body out
    dimU.value = dim;
    moonViewU.value.copy(MOON).transformDirection(camera.matrixWorldInverse);
    const rimFreeze = smooth(FREEZE, FREEZE + 0.5, tc);             // tip rim brightens within 0.5 s of the freeze
    shellMat.userData.rim.value = (0.6 + 1.2 * smooth(K.deerLook, K.fillStart, tc) + 1.6 * rimFreeze) * (1 - s3 * 0.8);
    farMat.userData.rim.value = shellMat.userData.rim.value * 0.5;
    for (const m of bodyMats) m.userData.rim.value = 0.9;
    shellMat.opacity = 1 - 0.75 * s3;
    shellMat.depthWrite = s3 < 0.01;
    const ls = layerState(tc), iu = innerMesh.material.uniforms, wu = waxMesh.material.uniforms;
    innerMesh.visible = s3 > 0.001;
    iu.uA.value = s3 * lerp(1, 0.3, smooth(K.wax + 0.8, K.s4 - 0.2, tc));
    for (let i = 0; i < 4; i++) { iu.uB.value[i] = ls.B[i]; iu.uGrey.value[i] = ls.G[i]; wu.uB.value[i] = ls.B[i]; }
    const lift = waxLift(tc);
    waxMesh.visible = ls.waxOn > 0.001;
    wu.uA.value = 1;
    iu.uCut.value = ls.waxOn > 0.001 ? 1 : 0;
    waxMesh.position.copy(ant.axisL).multiplyScalar(ant.lift * lift);
    waxMesh.updateMatrixWorld(true);

    // gold backlight behind the tip (the "moon" point carried over from scene 1's gold dot)
    const viewDir = tmp.copy(A.T).sub(camera.position).normalize();
    glow.position.copy(A.T).addScaledVector(viewDir, 0.12);
    const dist = glow.position.distanceTo(camera.position), pxW = 2 * dist * Math.tan(15 * D2R) / H;
    const gPx = lerp(200, 300, c.p) * (1 + 0.35 * rimFreeze);
    glow.scale.setScalar(gPx * pxW);
    glow.material.opacity = (0.9 + 0.1 * rimFreeze) * (1 - smooth(FREEZE + 0.6, K.layerBone, tc));
    const wc = waxCentre(tc), wd = wc.distanceTo(camera.position);
    waxGlow.position.copy(wc);
    waxGlow.scale.setScalar(lerp(160, 520, lift) * 2 * wd * Math.tan(15 * D2R) / H);
    waxGlow.material.opacity = 0.85 * ls.waxOn;

    // DOF: focus on the antler tip; aperture opens as the push closes in (snow turns to bokeh)
    tmp.copy(c.focus).applyMatrix4(camera.matrixWorldInverse);
    const focus = Math.max(0.1, -tmp.z);
    const ap = lerp(6, 26, smooth(K.deerStop, FREEZE, tc)) * (1 - s3);
    dofMat.uniforms.uFocus.value = focus;
    dofMat.uniforms.uCoc.value = ap * focus;
    dofMat.uniforms.uMaxR.value = ap > 0.3 ? 22 : 0;
    dofMat.uniforms.uSeed.value = Math.round(tc * FPS) % 97;
    const ph = snowPhase(tc), snowK = 1 - smooth(FREEZE + 0.3, K.layerBone - 0.4, tc);
    for (const m of snowMats) {
      const u = m.uniforms;
      u.uC.value.copy(camera.position); u.uPh.value = ph; u.uFocus.value = focus; u.uCoc.value = Math.max(ap, 2) * focus; u.uK.value = snowK;
    }

    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(dofScene, quadCam);
    if (snowK > 0.001) renderer.render(snowScene, camera);
    // scene 1's cloud deck breaks open around the tip
    let cloud = 0;
    if (cloudMat) {
      cloud = 0.92 * (1 - smooth(K.s2 + 0.05, K.s2 + 1.6, tc));
      if (cloud > 0.001) {
        const tp = project(A.T);
        cloudMat.uniforms.uK.value = cloud;
        cloudMat.uniforms.uHole.value = smooth(K.s2, K.s2 + 1.4, tc);
        cloudMat.uniforms.uC.value.set(tp.x / W, 1 - tp.y / H);
        cloudMat.uniforms.uT.value = tc;
        cloudMat.uniforms.uSeed.value = Math.round(tc * FPS) % 97;
        renderer.render(cloudScene, quadCam);
      }
    }

    // ---- copy & labels ----
    for (const id of ['s2-name', 's2-sub', 's3-sub']) if (txt[id]) txt[id].style.opacity = copyAlpha(id, tc).toFixed(3);
    const labIds = ['s3-bone', 's3-blood', 's3-powder', 's3-wax'];
    const LX = 1220;
    labIds.forEach((id, i) => {
      if (!txt[id]) return;
      let a = copyAlpha(id, tc);
      if (i < 3) a *= lerp(1, 0.55, smooth(K[LAYERS[Math.min(2, i + 1)].cue], K[LAYERS[Math.min(2, i + 1)].cue] + 0.4, tc) * (i < 2 ? 1 : 0)) * lerp(1, 0.5, ls.waxOn);
      const anc = i < 3 ? ant.lab[i].clone().applyMatrix4(antN.matrixWorld) : wc;
      const q = project(anc);
      const lx = i < 3 ? LX : Math.max(q.x + 150, LX), ly = q.y;
      txt[id].style.transform = `translate(${lx.toFixed(1)}px,${ly.toFixed(1)}px)`;
      txt[id].style.opacity = a.toFixed(3);
      const sx = q.x + 14;
      leaders[id].setAttribute('d', `M${sx.toFixed(1)} ${q.y.toFixed(1)}L${(lx - 18).toFixed(1)} ${ly.toFixed(1)}`);
      leaders[id].style.opacity = a.toFixed(3);
      dots[id].setAttribute('cx', q.x.toFixed(1)); dots[id].setAttribute('cy', q.y.toFixed(1));
      dots[id].style.opacity = a.toFixed(3);
    });

    const af = antlerFrac(), tip = project(A.T);
    lastProbe = {
      camSpeed: +camSpeed.toFixed(5), push: +c.p.toFixed(4), antlerFrac: +af.frac.toFixed(4), antlerTop: +af.top.toFixed(1), antlerBottom: +af.bottom.toFixed(1),
      tip: { x: +tip.x.toFixed(1), y: +tip.y.toFixed(1) }, snowFall: +((snowPhase(tc + 1 / FPS) - ph) * FPS).toFixed(3), snowK: +snowK.toFixed(3),
      deerX: +deerG.position.x.toFixed(3), headRaise: +raiseAt(Math.min(tc, FREEZE)).toFixed(3), reveal: +s3.toFixed(3), dim: +dim.toFixed(3),
      layers: ls.B.map((b) => +b.toFixed(3)), waxLift: +lift.toFixed(3), cloud: +cloud.toFixed(3), focus: +focus.toFixed(3)
    };
  }

  function setActive() {
    if (root) root.style.display = active2 || active3 ? '' : 'none';
  }
  window.FILM_SCENES = window.FILM_SCENES || {};
  // main.js toggles each registered scene in turn; scenes 2 and 3 share one stage, so it is shown while either is current
  window.FILM_SCENES[2] = { init, render, setActive: (v) => { active2 = v; setActive(); }, probe: () => lastProbe };
  window.FILM_SCENES[3] = { init, render, setActive: (v) => { active3 = v; setActive(); }, probe: () => lastProbe };
})();
