/* Scene 7 · 释 · 使用五步 (docs/02-storyboard.md 幕 7). Gestures follow 《实拍使用方法2》 6–24 s.
   ① 78.72 fingers pinch the safety ring at the tail, 81.90 it tears off and leaves frame.
   ② the ampoule tilts (head lower-left, tail upper-right); the right index pad meets the silver tail cap at 84.03 and pushes it
      along the bottle axis, slowly, until it bottoms out on frame 2585 (86.15). The seal under the powder chamber opens.
   落粉 cut to a schematic section, tail up: the near-white freeze-dried powder falls from the tail chamber into the solvent,
      the bulk touching the liquid at 89.35.
   ③ three wrist shakes (89.35, 90.42, 91.49); the powder dissolves into an even, pale solution.
   ④ 93.60 the head snaps off; a drop forms at the break, falls and lands on the palm at 95.71.
   ⑤ a fingertip spreads it; 97.85 the camera pulls back and the frame brightens towards snow white for scene 8.
   Hands are the rigged arms GLB (docs/02-asset-supplement.md), posed per frame: each hand is placed by an anchor
   (index pad, thumb pad, pinch midpoint or palm) at a point in ampoule space, with finger and back-of-hand directions.
   render(t) is a pure function of time, so seek and frame export are exact. */
(function () {
  const F = window.FILM, THREE = window.THREE, T3X = window.T3X;
  const FPS = F.fps, W = 1920, H = 1080;
  const K = {};
  for (const k in F.cueFrames) K[k] = F.cueFrames[k] / FPS;
  // V2 (no hands, reference video 57–72 s): product only, step list on the left. Cues the V1 hand choreography used are derived here.
  K.ringGrip = K.s7 + 0.6; K.shake3 = K.shake2; K.powderHit = K.pressBottom + 1.45; K.pullBack = 1e4;
  const T0 = K.s7, END = K.s5;
  const A_SCALE = 1.25, MM = 0.001 * A_SCALE, CYMM = 31.8;
  const GAP = 2.6;                       // mm the tail cap travels; the safety ring fills this gap until it is pulled
  const HAND_S = 1.25;                   // arms GLB is life size; hands share the 1.25× hero scale of the ampoule
  const PRESS_A = K.pressContact, PRESS_B = K.pressBottom;
  const CUT_IN = PRESS_B + 0.25;         // hard cut to the section under the click flash
  const SEC_OUT = K.shake2 + 0.45, SEC_CLOSE = SEC_OUT + 0.35;  // section closes after the second shake
  const SNAP_SHOT = SEC_CLOSE + 0.1;     // re-shoot for the snap
  const DROP_SHOT = K.snap + 0.55;       // follow the drop
  const SPREAD_SHOT = 1e4;               // V2: no spreading shot
  const PALM = new THREE.Vector3(0.004, -0.058, 0.004);   // right palm surface under the opening (world m)

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sat = (v) => clamp(v, 0, 1);
  const smooth = (a, b, x) => { const u = sat((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  const inOut = (x) => 0.5 - 0.5 * Math.cos(Math.PI * sat(x));
  const out3 = (x) => 1 - Math.pow(1 - sat(x), 3);
  const lerp = (a, b, k) => a + (b - a) * k;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const lerpV = (a, b, k) => a.clone().lerp(b, k);
  function rng(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // press depth 0 → 1; slow travel, the last 12 % snaps through (the "click"); exactly 1 from the pressBottom frame on
  function pressDepth(t) {
    if (t <= PRESS_A) return 0;
    if (t >= PRESS_B) return 1;
    const k = (t - PRESS_A) / (PRESS_B - PRESS_A);
    return 0.88 * inOut(Math.min(k / 0.92, 1)) + 0.12 * Math.pow(sat((k - 0.92) / 0.08), 2);
  }

  const DBG = {};
  let arrowSvg, arrowG, root, renderer, scene, cam, bgScene, bgMat, ovScene, ovCam, flashMat, whiteMat, ampG, off, model, base, head, headPivot, ring, ringG, ringHalves, ringSlit,
    body, cake, sealL, sealR, liqCapMat, liqMat, cloudMats = [], grains, drop, dropMat, film, filmMat, copy = [], lastProbe = null;
  const txt = {}, shellMats = [], arms = {};
  const P1 = new THREE.Plane(), P2 = new THREE.Plane(), P3 = new THREE.Plane();
  const cutU = { on: 0 };

  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; };
  const entryTime = (v) => (typeof v === 'string' ? K[v] : v);
  const copyAlpha = (id, t) => {
    const c = copy.find((e) => e.id === id); if (!c) return 0;
    const a = entryTime(c.in), b = entryTime(c.out);
    return smooth(a, a + 0.35, t) * (1 - smooth(b - 0.3, b, t));
  };

  const quadVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const bgFS = `
    uniform float uLift, uSeed, uWhite; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
    void main(){
      vec3 ink = vec3(0.039, 0.043, 0.051), fog = vec3(0.165, 0.173, 0.188), snow = vec3(0.949, 0.945, 0.925);
      vec2 p = (vUv - vec2(0.5, 0.55)) * vec2(1.7778, 1.0);
      float spot = exp(-dot(p, p) * 1.6);
      vec3 c = ink + (fog - ink) * (0.35 + 0.65 * spot) * (0.9 + 0.25 * uLift);
      c = mix(c, snow * (0.9 + 0.1 * spot), uWhite);
      c += (h(gl_FragCoord.xy) - 0.5) * 0.012;
      gl_FragColor = vec4(c, 1.0);
    }`;
  const flatFS = `uniform vec3 uCol; uniform float uA; void main(){ gl_FragColor = vec4(uCol, uA); }`;
  const flashFS = `
    uniform vec2 uC; uniform float uA, uR; varying vec2 vUv;
    void main(){ vec2 p = (vUv - uC) * vec2(1.7778, 1.0); float d = length(p) / uR;
      float g = exp(-d * d * 2.5) + 0.35 * exp(-pow((d - 1.0) * 6.0, 2.0));
      gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * g * uA, 1.0); }`;

  // ---------------- hands ----------------
  const FING = [['f_index', 'i', 0.0185], ['f_middle', 'm', 0.019], ['f_ring', 'r', 0.018], ['f_pinky', 'p', 0.016]];
  const qx = (a) => new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), a);
  const qy = (a) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a);
  const qz = (a) => new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), a);
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _v = V(0, 0, 0);

  const HAND_LINE = new THREE.Color(0xF4ECE2);
  const handFill = new THREE.MeshBasicMaterial({ color: HAND_LINE, transparent: true, depthWrite: true, toneMapped: false });
  handFill.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vN; varying vec3 vVw;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vN = normalize(normalMatrix * objectNormal); vVw = -mvPosition.xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vN; varying vec3 vVw;')
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
  float fr = 1.0 - abs(dot(normalize(vN), normalize(vVw)));
  gl_FragColor.a = 0.07 + 0.85 * pow(fr, 3.2);`);
  };
  const handHull = new THREE.MeshBasicMaterial({ color: HAND_LINE, side: THREE.BackSide, transparent: true, opacity: 0.9, toneMapped: false });
  handHull.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n  transformed += normalize(objectNormal) * 0.0008;');
  };

  function setupArm(src, side) {
    const holder = new THREE.Group(); holder.add(src); scene.add(holder);
    const bones = {}, clip = new THREE.Plane(), mats = [], meshes = [];
    src.traverse((o) => {
      if (o.isBone) { bones[o.name] = o; o.userData.q0 = o.quaternion.clone(); }
      if (o.isMesh) meshes.push(o);
    });
    // outline hands: a faint warm-white fill with a fresnel edge (inner finger contours) + an inverted hull (outer silhouette)
    for (const o of meshes) {
      o.frustumCulled = false;
      const fill = handFill.clone(); fill.clippingPlanes = [clip]; fill.onBeforeCompile = handFill.onBeforeCompile;
      o.material = fill; o.renderOrder = 2; mats.push(fill);
      if (o.isSkinnedMesh) {
        const hull = new THREE.SkinnedMesh(o.geometry, handHull.clone());
        hull.material.clippingPlanes = [clip]; hull.material.onBeforeCompile = handHull.onBeforeCompile;
        hull.bind(o.skeleton, o.bindMatrix); hull.position.copy(o.position); hull.quaternion.copy(o.quaternion); hull.scale.copy(o.scale);
        hull.frustumCulled = false; hull.renderOrder = 3; o.parent.add(hull); mats.push(hull.material);
      }
    }
    arms[side] = { side, holder, src, bones, clip, mats };
  }
  const bone = (A, n) => A.bones['DEF-' + n + A.side];
  function wpos(o) { return o.getWorldPosition(V(0, 0, 0)); }
  function axis(o, i) { o.getWorldQuaternion(_q); return V(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0).applyQuaternion(_q); }
  function pad(A, f, len) {
    const b = bone(A, f + '03');
    return wpos(b).add(axis(b, 1).multiplyScalar(len * 0.55)).add(axis(b, 2).multiplyScalar(0.0055));
  }
  function anchorOf(A, name) {
    if (name === 'iPad') return pad(A, 'f_index', 0.0185);
    if (name === 'iTip') { const b = bone(A, 'f_index03'); return wpos(b).add(axis(b, 1).multiplyScalar(0.02)); }
    if (name === 'mPad') return pad(A, 'f_middle', 0.019);
    if (name === 'tPad') return pad(A, 'thumb', 0.024);
    if (name === 'pinch') return pad(A, 'f_index', 0.0185).add(pad(A, 'thumb', 0.024)).multiplyScalar(0.5);
    const h = bone(A, 'hand');   // palm centre
    return wpos(h).add(axis(h, 1).multiplyScalar(0.07)).add(axis(h, 0).multiplyScalar(A.side === 'R' ? -0.019 : 0.019));   // palm surface (palmar side is hand −X for R, +X for L)
  }

  // pose: { at:[x,y,z] (ampoule mm, or world m when w:1), F:[..] fingers dir, B:[..] hand-bone Z dir (palm normal = B × F) (ampoule axes unless w:1),
  //         anc, c:{i,m,r,p:[3]}, s:[4] spread, t:[4] thumb, vis }
  function poseArm(A, P, ampQ) {
    if (!P || P.vis <= 0.001) { A.holder.visible = false; return null; }
    A.holder.visible = true;
    const b = A.bones;
    for (const n in b) b[n].quaternion.copy(b[n].userData.q0);
    const sg = A.side === 'L' ? 1 : -1;
    FING.forEach(([f, k], j) => {
      const c = (P.c && P.c[k]) || [0, 0, 0];
      for (let i = 0; i < 3; i++) bone(A, f + '0' + (i + 1)).quaternion.multiply(qx(c[i]));
      if (P.s) bone(A, f + '01').quaternion.multiply(qz(P.s[j] * sg));
    });
    const th = P.t || [0, 0, 0, 0];
    bone(A, 'thumb01').quaternion.multiply(qx(th[0])).multiply(qz(th[1] * sg));
    bone(A, 'thumb02').quaternion.multiply(qx(th[2]));
    bone(A, 'thumb03').quaternion.multiply(qx(th[3]));
    if (P.wr) bone(A, 'hand').quaternion.multiply(qx(P.wr[0])).multiply(qz(P.wr[1] * sg));
    A.holder.position.set(0, 0, 0); A.holder.quaternion.identity(); A.holder.scale.setScalar(1); A.holder.updateMatrixWorld(true);
    const hb = bone(A, 'hand'); hb.getWorldQuaternion(_q2);
    const a0 = anchorOf(A, P.anc || 'iPad');
    const Fd = V(...P.F).normalize(), Bd = V(...P.B).normalize();
    if (!P.w && !P.wd) { Fd.applyQuaternion(ampQ); Bd.applyQuaternion(ampQ); }
    Bd.sub(Fd.clone().multiplyScalar(Bd.dot(Fd))).normalize();
    const X = Fd.clone().cross(Bd);
    _m.makeBasis(X, Fd, Bd); _q.setFromRotationMatrix(_m);
    const qM = _q.clone().multiply(_q2.invert());
    const tgt = P.w ? V(...P.at) : ampW(P.at[0], P.at[1], P.at[2]);
    if (P.off) tgt.add(V(...P.off));
    A.holder.quaternion.copy(qM); A.holder.scale.setScalar(HAND_S);
    A.holder.position.copy(tgt.sub(a0.applyQuaternion(qM).multiplyScalar(HAND_S)));
    A.holder.updateMatrixWorld(true);
    A.clip.set(V(sg, 0, 0), 0).applyMatrix4(A.src.matrixWorld);
    return anchorOf(A, P.anc || 'iPad');
  }
  // blend two poses (numbers lerp, directions lerp then renormalise in poseArm)
  function mix(a, b, k) {
    if (k <= 0) return a; if (k >= 1) return b;
    const o = {};
    for (const key of Object.keys(b)) {
      const x = a[key], y = b[key];
      if (typeof y === 'number') o[key] = lerp(x == null ? y : x, y, k);
      else if (Array.isArray(y)) o[key] = y.map((v, i) => lerp(x ? x[i] : v, v, k));
      else if (y && typeof y === 'object') o[key] = mix(x || y, y, k);
      else o[key] = k < 0.5 && x != null ? x : y;
    }
    return o;
  }
  // keyframed track: [[t, pose], ...]; eases between neighbours
  function track(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) return mix(keys[i - 1][1], keys[i][1], inOut((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
    return keys[keys.length - 1][1];
  }

  // ---------------- poses (ampoule mm / ampoule axes: +y base→head, +z front label) ----------------
  // directions are world-space (wd) because the ampoule holds still in Q_DIAG through ring pull and press;
  // anchors are ampoule mm, plus an optional world offset (m)
  const POSE = {
    // left hand palm-up under the body, the ampoule resting across the index/middle pads (reference 8–9.8 s)
    holdL: { wd: 1, anc: 'mPad', at: [0, 28, 0], off: [0, -0.0085, 0], F: [-0.55, 0.1, -0.85], B: [0, -1, 0.1], c: { i: [0.15, 0.35, 0.25], m: [0.1, 0.3, 0.2], r: [0.5, 0.6, 0.4], p: [0.7, 0.6, 0.4] }, s: [0.05, 0, -0.05, -0.12], t: [0.9, 0.9, 0.4, 0.3] },
    // right index pad hooks the ring tab from above the tail
    ringR: { wd: 1, anc: 'iPad', at: [8.2 * Math.cos(0.95), 5.0, 8.2 * Math.sin(0.95)], off: [0, 0, 0], F: [-0.6, -0.7, -0.2], B: [0.3, 0.8, 0.5], c: { i: [0.3, 0.45, 0.3], m: [1.2, 1.3, 0.8], r: [1.4, 1.3, 0.8], p: [1.5, 1.3, 0.8] }, t: [0.7, 0.6, 0.5, 0.4] },
    // right index pad on the silver tail cap end face, finger along the bottle axis
    // ④ lateral pinches, backs of the hands up, thumbs towards the camera (ampoule axes; Q_STAND ≈ world)
    snapL: { anc: 'pinch', at: [0, 24, 0], F: [0.94, -0.19, -0.28], B: [0.31, 0.14, 0.94], c: { i: [0.8, 0.8, 0.5], m: [1.2, 1.2, 0.7], r: [1.4, 1.2, 0.7], p: [1.5, 1.2, 0.7] }, t: [0.5, 0.4, 0.3, 0.2] },
    snapR: { anc: 'pinch', F: [-0.95, -0.1, -0.29], B: [-0.3, 0.14, 0.94], c: { i: [0.8, 0.8, 0.5], m: [1.2, 1.2, 0.7], r: [1.4, 1.2, 0.7], p: [1.5, 1.2, 0.7] }, t: [0.5, 0.4, 0.3, 0.2] },
    // ④–⑤ right palm up to catch the drop, fingers away to the left (world)
    catchR: { anc: 'palm', F: [-0.85, 0.05, -0.5], B: [0.47, -0.35, -0.80], c: { i: [0.1, 0.15, 0.1], m: [0.1, 0.15, 0.1], r: [0.15, 0.2, 0.1], p: [0.2, 0.2, 0.1] }, s: [0.05, 0, -0.04, -0.1], t: [0.2, 0.1, 0.1, 0.1] },
    // ⑤ left index pad down on the palm (world)
    spreadL: { anc: 'iPad', F: [0.45, -0.6, 0.66], B: [-0.83, 0, 0.56], c: { i: [0.15, 0.25, 0.15], m: [1.2, 1.3, 0.8], r: [1.4, 1.3, 0.8], p: [1.5, 1.3, 0.8] }, t: [0.8, 0.6, 0.5, 0.4] },
    pressR: { wd: 1, anc: 'iPad', at: [0, -GAP - 0.6, 0], off: [0, 0, 0], F: [-0.833, -0.457, 0.311], B: [-0.206, 0.013, 0.978], c: { i: [0.25, 0.35, 0.25], m: [0.9, 1.0, 0.7], r: [1.1, 1.1, 0.7], p: [1.2, 1.1, 0.7] }, t: [0.2, 0.3, 0.5, 0.3] }
  };

  // ---------------- ampoule ----------------
  const ampW = (x, y, z) => ampG.localToWorld(V(x * MM, (y - CYMM) * MM, z * MM));
  const proj = (v) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * W, (0.5 - p.y * 0.5) * H, p.z]; };

  async function init(stage, copyEntries) {
    if (init.p) return init.p;
    init.p = (async () => {
      copy = copyEntries.filter((e) => e.scene === 7 && e.status !== 'pending');
      root = document.createElement('div'); root.id = 's7';
      stage.insertBefore(root, stage.firstChild);
      const canvas = document.createElement('canvas'); canvas.id = 's7-gl'; canvas.width = W; canvas.height = H; root.appendChild(canvas);
      for (const c of copy) {
        const e = el('div', 'copy ' + c.id, root); e.dataset.copy = c.id;
        const m = /^(\d\d) (.+?) · (.+)$/.exec(c.text);
        if (m) { el('i', '', e, m[1]); el('b', '', e, m[2]); el('span', '', e, m[3]); } else e.textContent = c.text;
        txt[c.id] = e;
      }
      root.style.display = 'none';

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(W, H, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
      renderer.autoClear = false; renderer.localClippingEnabled = true;

      bgMat = new THREE.ShaderMaterial({ uniforms: { uLift: { value: 0 }, uSeed: { value: 0 }, uWhite: { value: 0 } }, vertexShader: quadVS, fragmentShader: bgFS, depthTest: false, depthWrite: false });
      bgScene = new THREE.Scene(); bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));
      ovScene = new THREE.Scene(); ovCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
      flashMat = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Vector2(0.5, 0.5) }, uA: { value: 0 }, uR: { value: 0.2 } }, vertexShader: quadVS, fragmentShader: flashFS,
        blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true });
      ovScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), flashMat));
      whiteMat = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(0xf2f1ec) }, uA: { value: 0 } }, vertexShader: quadVS, fragmentShader: flatFS, depthTest: false, depthWrite: false, transparent: true });
      const wq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), whiteMat); wq.renderOrder = 2; ovScene.add(wq);

      scene = new THREE.Scene();
      cam = new THREE.PerspectiveCamera(30, W / H, 0.004, 20);
      const pm = new THREE.PMREMGenerator(renderer);
      const hdr = await new T3X.HDRLoader().loadAsync('assets/env/studio.hdr');
      scene.environment = pm.fromEquirectangular(hdr).texture; hdr.dispose(); pm.dispose();
      scene.environmentIntensity = 0.9;
      scene.add(new THREE.HemisphereLight(0xf0ece6, 0x17181b, 0.5));
      const key = new THREE.DirectionalLight(0xf6f1ea, 2.2); key.position.set(-0.6, 1.0, 0.9); scene.add(key);
      const rim = new THREE.DirectionalLight(0xdfe4ea, 1.6); rim.position.set(0.7, 0.6, -1.0); scene.add(rim);

      const loader = new T3X.GLTFLoader().setMeshoptDecoder(T3X.MeshoptDecoder);
      const gA = await loader.loadAsync('assets/models/ampoule.glb');
      // press cue: gold chevrons riding on the silver tail cap (SVG overlay)
      const NS = 'http://www.w3.org/2000/svg';
      arrowSvg = document.createElementNS(NS, 'svg'); arrowSvg.setAttribute('viewBox', `0 0 ${W} ${H}`); arrowSvg.setAttribute('class', 's7-arrow'); root.appendChild(arrowSvg);
      arrowG = document.createElementNS(NS, 'g'); arrowSvg.appendChild(arrowG);
      for (let i = 0; i < 3; i++) { const pth = document.createElementNS(NS, 'path'); pth.setAttribute('d', 'M-26 -16 L0 0 L-26 16'); pth.setAttribute('transform', `translate(${-i * 26} 0)`); arrowG.appendChild(pth); }

      ampG = new THREE.Group(); scene.add(ampG);
      off = new THREE.Group(); off.position.y = -CYMM * MM; ampG.add(off);
      model = gA.scene; window.FILM_AMP.apply(model); model.scale.multiplyScalar(A_SCALE); off.add(model);
      const meshes = [];
      model.traverse((o) => { if (o.isMesh) meshes.push(o); });
      for (const o of meshes) {
        o.frustumCulled = false;
        if (/inner_essence/i.test(o.name)) { o.visible = false; continue; }
        o.material = o.material.clone();
        o.material.clippingPlanes = [P1, P2]; o.material.clipIntersection = true; o.material.side = THREE.DoubleSide;
        o.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb *= 0.42;'); };
        o.material.customProgramCacheKey = () => 's7-shell';
        shellMats.push(o.material);
      }
      // GLB meshes carry their mm positions in the mesh geometry; find by name and regroup
      const find = (re) => meshes.find((o) => re.test(o.name));
      base = find(/push_base/i);
      const headM = find(/tapered_head/i);
      headPivot = new THREE.Group(); headPivot.position.set(0, 40.4, 0); headM.parent.add(headPivot);
      head = new THREE.Group(); head.position.set(0, -40.4, 0); headPivot.add(head); head.add(headM);

      // contents and added parts, in ampoule millimetres (same space as the GLB meshes before A_SCALE)
      body = new THREE.Group(); body.scale.setScalar(MM); off.add(body);
      const cut = (m) => { m.clippingPlanes = [P1, P2]; m.clipIntersection = true; return m; };
      const cap = (m) => { m.clippingPlanes = [P3]; m.side = THREE.DoubleSide; return m; };
      // inner guide sleeve, visible in the gap once the ring is gone
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(4.75, 4.75, GAP + 1.2, 64, 1, true), cut(new THREE.MeshStandardMaterial({ color: 0xd9dcdf, roughness: 0.32, metalness: 0.55, side: THREE.DoubleSide })));
      sleeve.position.y = 7.6 - (GAP + 1.2) / 2; body.add(sleeve);
      // safety ring (V3): flush C-ring in the gap. At TAB_A the outer wall dips into a finger notch with a tear slit;
      // the two halves hinge on a thin web opposite the notch and swing open when the notch is pulled.
      ringG = new THREE.Group(); body.add(ringG);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 0.45, metalness: 0 });
      const R_IN = 4.78, R_OUT = 5.92, NOTCH_W = 0.55, NOTCH_D = 1.0, SLIT = 0.06;
      const rOut = (phi) => { const d = Math.atan2(Math.sin(phi - TAB_A), Math.cos(phi - TAB_A)); const k = Math.abs(d) < NOTCH_W ? 0.5 + 0.5 * Math.cos(Math.PI * d / NOTCH_W) : 0; return R_OUT - NOTCH_D * k; };
      const halfShape = (p0, p1) => {
        const sh = new THREE.Shape(), n = 90, P = (r, f) => [r * Math.cos(f), -r * Math.sin(f)];
        sh.moveTo(...P(R_IN, p0));
        for (let i = 0; i <= n; i++) { const f = p0 + (p1 - p0) * i / n; sh.lineTo(...P(rOut(f), f)); }
        for (let i = n; i >= 0; i--) { const f = p0 + (p1 - p0) * i / n; sh.lineTo(...P(R_IN, f)); }
        return sh;
      };
      const HINGE = TAB_A + Math.PI, hx = 5.27 * Math.cos(HINGE), hz = 5.27 * Math.sin(HINGE);
      ringHalves = [[TAB_A + SLIT, HINGE - 0.01], [HINGE + 0.01, TAB_A + 2 * Math.PI - SLIT]].map(([p0, p1], i) => {
        const g = new THREE.ExtrudeGeometry(halfShape(p0, p1), { depth: GAP - 0.24, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.12, bevelSegments: 2, curveSegments: 8 });
        const m = new THREE.Mesh(g, ringMat); m.rotation.x = -Math.PI / 2; m.position.set(-hx, 7.6 - GAP + 0.12, -hz);
        const piv = new THREE.Group(); piv.position.set(hx, 0, hz); piv.add(m); ringG.add(piv); piv.userData.dir = i ? -1 : 1; return piv;
      });
      // dark tear slit at the bottom of the notch (reads as the split line until the halves open)
      ringSlit = new THREE.Mesh(new THREE.BoxGeometry(0.9, GAP - 0.1, 0.16), new THREE.MeshBasicMaterial({ color: 0x4a4d52 }));
      ringSlit.position.set(5.2 * Math.cos(TAB_A), 7.6 - GAP / 2, 5.2 * Math.sin(TAB_A)); ringSlit.rotation.y = -TAB_A; ringG.add(ringSlit);

      // freeze-dried cake (inside the silver cap, travels with it), seal, solvent, section caps
      const powderCol = 0xf0ebe2;
      cake = new THREE.Group(); body.add(cake);
      const cakeMat = new THREE.MeshStandardMaterial({ color: powderCol, roughness: 0.95, metalness: 0 });
      const cakeM = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 1, 48), cut(cakeMat)); cake.add(cakeM);
      const cakeC = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 1), cap(cakeMat.clone())); cake.add(cakeC);
      cake.userData = { m: cakeM, c: cakeC };
      const sealMat = new THREE.MeshStandardMaterial({ color: 0xe8ebee, roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide });
      const half = (sgn) => { const g = new THREE.Group(); g.position.set(sgn * 5.0, 7.4, 0); const m = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.4, 9.6), cut(sealMat.clone())); m.position.x = -sgn * 2.5; g.add(m); body.add(g); return g; };
      sealL = half(-1); sealR = half(1);
      liqMat = cut(new THREE.MeshPhysicalMaterial({ color: 0xf3f5f6, roughness: 0.04, transmission: 1, thickness: 9, ior: 1.33, transparent: true }));
      const liqM = new THREE.Mesh(window.FILM_AMP.innerLathe(14.6, 40.2, 0.7, 64), liqMat); body.add(liqM);
      liqCapMat = cap(new THREE.MeshStandardMaterial({ color: 0xdfe5e9, roughness: 0.12, metalness: 0, emissive: 0xe8eef2, emissiveIntensity: 0.12, transparent: true, opacity: 0.42, depthWrite: false }));
      const liqC = new THREE.Mesh(window.FILM_AMP.sectionGeometry(14.6, 40.2, 0.7), liqCapMat); body.add(liqC);
      const men = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 0.3), cap(new THREE.MeshBasicMaterial({ color: 0xf2f1ec, transparent: true, opacity: 0.6 })));
      men.position.y = 14.75; body.add(men);
      const rimMat = cap(new THREE.MeshBasicMaterial({ color: 0xf2f1ec, transparent: true, opacity: 0.85, toneMapped: false }));
      for (const [x, y0, y1] of [[5.5, 0.4, 7.6], [5.4, 7.6, 14.18], [-5.5, 0.4, 7.6], [-5.4, 7.6, 14.18]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, y1 - y0), rimMat); m.position.set(x, (y0 + y1) / 2, 0.01); body.add(m);
      }
      for (const sd of [1, -1]) { const m = new THREE.Mesh(window.FILM_AMP.rimGeometry(14.0, window.FILM_AMP.NECK, 0.42, sd), rimMat); m.position.z = 0.01; body.add(m); }
      const back = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 33), cap(new THREE.MeshBasicMaterial({ color: 0x26282c }))); back.position.set(0, 23.8, -1.6); body.add(back);
      // dissolving cloud in the solvent (soft sheets on the cut, near-white)
      const cloudFS = `uniform float uA, uSeed; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){ vec2 p = vUv - .5; float r = length(p * vec2(1., .6)) * 2.;
          float v = n(vUv * 6. + uSeed) * .6 + n(vUv * 13. - uSeed) * .4;
          float a = smoothstep(1., .2, r) * smoothstep(.25, .75, v) * uA; gl_FragColor = vec4(vec3(.95, .93, .89), a); }`;
      for (let i = 0; i < 3; i++) {
        const m = new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 }, uSeed: { value: i * 3.1 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: cloudFS, transparent: true, depthWrite: false, clippingPlanes: [P3], side: THREE.DoubleSide });
        const q = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 12), m); q.position.set(0, 20, 0.05 + i * 0.02); q.renderOrder = 4; body.add(q); cloudMats.push(m);
      }
      // grains: falling powder
      const rand = rng(7071), N = 520, gGeo = new THREE.IcosahedronGeometry(1, 0);
      grains = new THREE.InstancedMesh(gGeo, new THREE.MeshStandardMaterial({ color: powderCol, roughness: 0.9, metalness: 0, emissive: 0xf0ebe2, emissiveIntensity: 0.15 }), N);
      grains.frustumCulled = false; grains.renderOrder = 5; body.add(grains);
      grains.userData.g = [];
      for (let i = 0; i < N; i++) {
        const r = 4.3 * Math.sqrt(rand()), th = rand() * Math.PI * 2, y0 = 1.2 + rand() * 5.6;
        // arrival at the liquid surface: early trickle, bulk at powderHit
        const big = i < 40;
        const ta = big ? K.powderHit - rand() * 0.12 : lerp(CUT_IN + 0.9, K.powderHit, Math.pow(rand(), 0.55));
        grains.userData.g.push({ x: r * Math.cos(th), z: r * Math.sin(th) * 0.35 + 0.4, y0, s: big ? 0.55 + rand() * 0.5 : 0.18 + rand() * 0.32, ta,
          dx: (rand() - 0.5) * 7, dz: (rand() - 0.5) * 1.5, sink: 1.5 + rand() * 3.5, rx: rand() * 6, ry: rand() * 6 });
      }
      // the drop and the spread film on the palm
      dropMat = new THREE.MeshPhysicalMaterial({ color: 0xfbf8f3, roughness: 0.02, transmission: 0.85, thickness: 2, ior: 1.36, transparent: true, clearcoat: 1 });
      drop = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), dropMat); drop.frustumCulled = false; scene.add(drop);
      filmMat = new THREE.MeshPhysicalMaterial({ color: 0xfbf8f3, roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.0, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false });
      film = new THREE.Mesh(new THREE.CircleGeometry(1, 48), filmMat); film.frustumCulled = false; scene.add(film);

      renderer.compile(scene, cam);
    })();
    return init.p;
  }
  const TAB_A = 0.05;  // tab angle around the axis (from +x towards +z): points up and slightly back when the ampoule lies head-left

  // ---------------- motion ----------------
  // ampoule orientation: quaternion from an axis direction (model +y) and a roll so the front label (+z) stays camera-facing
  function orient(axisDir, frontDir) {
    const Y = axisDir.clone().normalize(), Z = frontDir.clone().sub(Y.clone().multiplyScalar(frontDir.dot(Y))).normalize(), X = Y.clone().cross(Z);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  }
  const Q_UP = orient(V(0, -1, 0), V(0, 0, 1));                  // tail up (end of scene 6)
  const Q_FLAT = orient(V(-1, 0, 0), V(0, 0.15, 1));             // head left
  const Q_DIAG = orient(V(-0.86, -0.5, 0.12), V(0.1, 0.2, 1));   // head lower-left, tail upper-right (reference 8–9.8 s)
  const Q_SEC = orient(V(0.06, -1, 0), V(0, 0, 1));             // section: tail up
  const Q_STAND = orient(V(0, 1, 0), V(0, 0, 1));               // head up for the snap
  const Q_POUR = orient(V(0.35, -1, 0.1), V(0, 0, 1));          // opened end down over the palm

  function ampPose(t) {
    let q, p;
    if (t < CUT_IN) {
      // one turn into the reference hold (head lower-left, tail upper-right); ring pull and press both happen in it
      q = Q_UP.clone().slerp(Q_DIAG, inOut((t - T0) / 1.3));
      p = V(0, 0.01 + 0.004 * Math.sin((t - T0) * 1.3), 0);
    } else if (t < SNAP_SHOT) {
      q = Q_SEC.clone(); p = V(0, 0, 0);
      // wrist shakes: a fast damped swing about the tail
      let a = 0;
      for (const s of [K.shake1, K.shake2, K.shake3]) { const d = t - s; if (d > 0 && d < 1.0) a += 0.2 * Math.sin(d * Math.PI * 2 / 0.42) * Math.exp(-d * 4.2); }
      q = new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), a).multiply(q);
      p.x = -Math.sin(a) * 0.03;
    } else if (t < DROP_SHOT) {
      q = Q_STAND.clone(); p = V(0, 0, 0);
    } else {
      q = Q_STAND.clone().slerp(Q_POUR, inOut((t - DROP_SHOT) / 0.5)); p = V(0, 0.022, 0);
    }
    return { q, p };
  }

  function camAt(t) {
    // returns pos, tgt (world)
    if (t < CUT_IN) {
      // medium two-hand shot for the ring pull (reference 6.2–7.3 s), then a slow push onto the tail cap for the press
      const k0 = inOut((t - T0) / 1.3);
      const wT = ampW(0, 14, 0), wP = wT.clone().add(V(0.03, 0.08, 0.24));
      const sT = ampW(0, 30, 0), sP = sT.clone().add(V(0, 0.02, 0.2));
      let tgt = lerpV(sT, wT, k0), pos = lerpV(sP, wP, k0);
      // V3: push in on the safety ring so its finger notch and the opening read
      const kr = inOut((t - (T0 + 0.45)) / 1.1), rT = ampW(0, 6.4, 0), rP = rT.clone().add(V(0.012, 0.055, 0.115));
      tgt = lerpV(tgt, rT, kr); pos = lerpV(pos, rP, kr);
      const kc = inOut((t - (K.ringOff + 0.3)) / 1.8);
      const cT = ampW(0, 6, 0), cP = cT.clone().add(V(0.05, 0.06, 0.16));
      tgt = lerpV(tgt, cT, kc); pos = lerpV(pos, cP, kc);
      const kp = inOut((t - PRESS_A) / (PRESS_B - PRESS_A));
      const pT = ampW(0, 10, 0), pP = pT.clone().add(V(0.04, 0.045, 0.12).multiplyScalar(1.55));
      return { pos: lerpV(pos, pP, kp), tgt: lerpV(tgt, pT, kp) };
    }
    if (t < SNAP_SHOT) {
      // follow the powder down: cap → surface → body
      const y = lerp(6, 15.5, inOut((t - CUT_IN) / (K.powderHit - CUT_IN))) + 6 * inOut((t - K.powderHit) / 2.5);
      const tgt = ampW(0, y, 0); tgt.x = 0;
      return { pos: tgt.clone().add(V(0, 0.01, 1).normalize().multiplyScalar(lerp(0.14, 0.17, inOut((t - K.powderHit) / 3)))), tgt };
    }
    if (t < DROP_SHOT) {   // ④ both pinches and the neck
      const tgt = ampW(0, 38, 0); return { pos: tgt.clone().add(V(0.0, 0.04, 0.27)), tgt };
    }
    if (t < SPREAD_SHOT) {   // follow the drop from the mouth to the palm
      const k = 0;
      const tgt = ampW(0, 40.6, 0).add(V(0, 0.012, 0));
      const kb = inOut((t - K.dropLand - 0.2) / (END - K.dropLand));
      return { pos: tgt.clone().add(V(0.02, 0.03, 0.38).multiplyScalar(lerp(1, 1.12, kb))), tgt };
    }
    // ⑤ macro over the palm, pulling back from pullBack into the white
    const kb = inOut((t - K.pullBack) / (END - K.pullBack));
    const tgt = PALM.clone().add(V(0, 0.004, 0));
    return { pos: tgt.clone().add(V(0.03, 0.17, 0.21).multiplyScalar(lerp(1, 1.5, kb))), tgt };
  }

  function render(t) {
    if (!renderer) return;
    Object.assign(DBG, { POSE, arms, ampW, headPivot, ringG, camera: cam });
    const tc = clamp(t, T0, END - 1e-4);
    const ap = ampPose(tc);
    ampG.position.copy(ap.p); ampG.quaternion.copy(ap.q); ampG.visible = tc < SPREAD_SHOT; ampG.updateMatrixWorld(true);

    // press: the silver cap and its cake slide up by GAP
    const pd = pressDepth(tc);
    base.position.y = (-GAP + GAP * pd) / 1;   // base mesh lives in model (mm) space
    // ring: notch pulled, C opens, then it comes off and tumbles away
    const rk = sat((tc - K.ringOff) / 0.9);
    ringG.visible = rk < 1;
    ringG.position.set(0, 0, 0); ringG.rotation.set(0, 0, 0); ringG.scale.setScalar(1);
    // pulling the notch splits the slit; the halves swing open about the back hinge
    const open = smooth(K.ringOff - 1.0, K.ringOff - 0.1, tc) * 0.6 + smooth(K.ringOff - 0.1, K.ringOff + 0.4, tc) * 0.75;
    for (const h of ringHalves) h.rotation.y = -h.userData.dir * open;
    ringSlit.visible = open < 0.08;

    // section planes (open only in the section shot)
    const ck = tc >= CUT_IN && tc < SEC_CLOSE ? 1 - inOut((tc - SEC_OUT) / (SEC_CLOSE - SEC_OUT)) : 0;
    const R_CUT = 5.6 * MM, sx = lerp(-R_CUT, R_CUT, ck);
    P1.set(V(0, 0, -1), 0).applyMatrix4(ampG.matrixWorld);
    P2.set(V(1, 0, 0), -sx).applyMatrix4(ampG.matrixWorld);
    P3.set(V(-1, 0, 0), sx).applyMatrix4(ampG.matrixWorld);
    body.visible = true;
    const inSec = ck > 0.001;

    let c = camAt(tc);
    if (DBG.cam) c = DBG.cam(c, ampW, V);
    cam.position.copy(c.pos); cam.lookAt(c.tgt); cam.updateMatrixWorld();
    // V2: the step list owns the left third, so the product sits right of centre
    const vx = -260 * smooth(T0, T0 + 1.2, tc); if (vx) cam.setViewOffset(W, H, vx, 0, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix();

    // snap: head hinges at the neck and leaves
    const sk = smooth(K.snap - 0.06, K.snap + 0.12, tc), sa = sat((tc - K.snap - 0.1) / 0.5);
    headPivot.rotation.z = -0.5 * sk - 0.8 * sa;
    headPivot.position.set(lerp(0, 18, sa * sa), 40.4 + lerp(0, 12, sa), 0);
    headPivot.visible = tc < DROP_SHOT;
    ampG.updateMatrixWorld(true);

    // hands
    const showA = tc < CUT_IN, holdOn = smooth(T0 + 0.25, K.ringGrip - 0.1, tc);
    let L = showA ? mix({ ...POSE.holdL, off: [0.01, -0.07, 0.02] }, POSE.holdL, holdOn) : null;
    let R = null;
    if (showA) {
      const ringAt = POSE.ringR;
      R = track([[T0 + 0.4, { ...ringAt, off: [0.05, 0.08, 0.02] }], [K.ringGrip, ringAt], [K.ringOff - 1.1, ringAt], [K.ringOff, { ...ringAt, off: [0.002, 0.002, 0.002] }],
        [K.ringOff + 0.55, { ...ringAt, off: [0.05, 0.05, 0.03] }], [K.ringOff + 1.2, { ...POSE.pressR, off: [0.03, 0.03, 0.01] }], [PRESS_A, POSE.pressR]], tc);
      if (tc >= PRESS_A) R = { ...POSE.pressR, at: [0, -GAP + GAP * pd - 0.6, 0] };
    }
    let L2 = L;
    if (tc >= SNAP_SHOT && tc < SPREAD_SHOT) {
      // ④ left pinches the body; right pinches the head and carries it off as it snaps (reference 13.6 s)
      L2 = POSE.snapL;
      if (tc < DROP_SHOT) {
        const hp = headPivot.localToWorld(V(0, 53 - 40.4, 0)), qa = qz(headPivot.rotation.z);
        R = { ...POSE.snapR, w: 1, at: hp.toArray(), F: V(...POSE.snapR.F).applyQuaternion(qa).toArray(), B: V(...POSE.snapR.B).applyQuaternion(qa).toArray() };
      } else R = { ...POSE.catchR, w: 1, at: PALM.toArray() };
    } else if (tc >= SPREAD_SHOT) {
      // ⑤ left fingertip spreads the drop over the right palm in small circles
      const u = tc - SPREAD_SHOT, rr = 0.004 + 0.009 * smooth(0, 1.8, u), a = u * 4.2;
      R = { ...POSE.catchR, w: 1, at: PALM.toArray() };
      L2 = { ...POSE.spreadL, w: 1, at: PALM.clone().add(V(Math.cos(a) * rr - 0.002, 0.0035 + 0.006 * (1 - smooth(0, 0.35, u)), Math.sin(a) * rr * 0.6)).toArray() };
    }
    const tipR = null;
        if (rk > 0 && rk < 1) {
      // the opened C slides off through its gap, then tumbles away
      const e = out3(sat((rk - 0.15) / 0.85)), dx = -Math.cos(TAB_A), dz = -Math.sin(TAB_A);
      ringG.position.set(dx * 30 * e, -10 * e, dz * 30 * e); ringG.rotation.set(e * 1.3, e * 0.5, e * 0.9);
      ringG.scale.setScalar(1 - 0.45 * e);
    }

    // powder: cake shrinks from the open side, grains fall (model +y is world-down in the section), then sink and dissolve
    const pressedY = 0;    // base offset after press
    const relA = CUT_IN + 0.2;
    const left = 1 - smooth(relA, K.powderHit - 0.35, tc);
    const cy0 = 1.0, cy1 = 1.0 + 5.8 * left;
    cake.visible = left > 0.01; cake.position.y = (cy0 + cy1) / 2 + base.position.y; cake.userData.m.scale.y = cy1 - cy0; cake.userData.c.scale.y = cy1 - cy0;
    const seal = smooth(PRESS_B - 0.05, PRESS_B + 0.5, tc);
    sealL.rotation.z = -seal * 1.25; sealR.rotation.z = seal * 1.25;
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), SV = V(1, 1, 1), PV = V(0, 0, 0);
    const SURF = 14.75, G = 9;   // mm/s² in slow motion
    let hit = 0, inAir = 0;
    grains.userData.g.forEach((g, i) => {
      const fall = Math.sqrt(2 * (SURF - g.y0) / G), ti = g.ta - fall;
      let y = g.y0, x = g.x, z = g.z, s = g.s;
      if (tc > ti && tc < g.ta) { const d = tc - ti; y = g.y0 + 0.5 * G * d * d; inAir++; }
      else if (tc >= g.ta) {
        const d = tc - g.ta; hit++;
        y = SURF + g.sink * (1 - Math.exp(-d * 0.8)) * 2.2 + 3 * sat(d / 4);
        x += g.dx * (1 - Math.exp(-d * 0.7)); z += g.dz * (1 - Math.exp(-d * 0.7));
        s *= 1 - smooth(0.3, 2.0, d) * (0.3 + 0.7 * smooth(K.shake1 - 0.2, K.shake2 + 0.5, tc));
      } else if (left * 5.8 + 1.0 < y) s = s;   // still in the cake
      if (tc < ti) { y = g.y0 + base.position.y; if (y > cy1 + 0.2 + base.position.y) s = 0; }
      SV.setScalar(Math.max(s, 1e-4));
      PV.set(x, y, z);
      E.set(g.rx + tc * 0.8, g.ry + tc * 0.5, 0); Q.setFromEuler(E);
      grains.setMatrixAt(i, M4.compose(PV, Q, SV));
    });
    grains.instanceMatrix.needsUpdate = true;
    grains.visible = inSec;
    const mixK = smooth(K.shake1, K.shake2 + 0.5, tc);
    const bloom = smooth(K.powderHit - 0.2, K.powderHit + 0.5, tc);
    cloudMats.forEach((m, i) => { m.uniforms.uA.value = 0.55 * bloom * (1 - 0.65 * mixK); m.uniforms.uSeed.value = i * 3.1 + tc * (0.2 + mixK * 2); });
    liqCapMat.color.setRGB(lerp(0.874, 0.93, mixK), lerp(0.898, 0.92, mixK), lerp(0.914, 0.89, mixK)); liqCapMat.opacity = lerp(0.42, 0.62, mixK);
    for (const m of [sealL, sealR]) m.visible = true;


    // drop (world): forms at the opening, stretches, falls, lands at dropLand
    drop.visible = false; film.visible = false;
    const DR = 0.0034;   // drop radius (m)
    if (tc >= DROP_SHOT) {
      const mouth = ampW(0, 40.6, 0), surf = mouth.clone().add(V(0.004, -0.11, 0));
      const g = 0.55, fallT = Math.sqrt(2 * Math.max(0.001, mouth.y - DR - surf.y) / g), tDet = K.dropLand - fallT, tGrow = DROP_SHOT + 0.45;
      drop.visible = tc > tGrow;
      if (tc < tDet) {          // swells at the mouth, hanging and stretching
        const k = smooth(tGrow, tDet, tc);
        drop.scale.set(DR * (0.3 + 0.7 * k), DR * (0.3 + 0.7 * k) * (1 + 0.35 * k * k), DR * (0.3 + 0.7 * k));
        drop.position.copy(mouth).add(V(0, -drop.scale.y * 0.9, 0));
      } else if (tc < K.dropLand) {   // free fall, slightly elongated
        const d = tc - tDet, y = mouth.y - DR - 0.5 * g * d * d;
        drop.position.set(lerp(mouth.x, surf.x, d / fallT), y, lerp(mouth.z, surf.z, d / fallT));
        drop.scale.set(DR * 0.92, DR * 1.18, DR * 0.92);
      } else {                         // lands: squash, wobble, settle as a bead on the palm
        const d = tc - K.dropLand, w = Math.exp(-d * 7) * Math.cos(d * 38);
        drop.position.copy(surf); drop.scale.set(DR * (1.35 + 0.2 * w), DR * (0.55 - 0.12 * w), DR * (1.35 + 0.2 * w));
      }
      if (tc >= SPREAD_SHOT) {        // the fingertip takes it: bead thins into the film
        const k = smooth(SPREAD_SHOT, SPREAD_SHOT + 0.6, tc);
        drop.scale.multiplyScalar(1 - k); drop.visible = k < 0.99;
      }
    }
    if (false) {
      const u = tc - K.dropLand - 0.15, r = 0.004 + 0.012 * smooth(0, 1.8, u);
      film.visible = true; film.position.copy(PALM).add(V(-0.002, 0.0006, 0)); film.rotation.set(-Math.PI / 2, 0, 0);
      film.scale.set(r, r * 0.75, 1); filmMat.opacity = 0.7 * smooth(0, 0.4, u);
    }

    // background, flash, white-out
    bgMat.uniforms.uLift.value = smooth(T0, T0 + 1.07, tc);
    bgMat.uniforms.uSeed.value = (Math.floor(tc * FPS) % 97) * 0.37;
    bgMat.uniforms.uWhite.value = 0;
    const fl = Math.exp(-Math.max(0, tc - PRESS_B) * 9) * (tc >= PRESS_B - 1e-6 ? 1 : 0) + 0.6 * Math.exp(-Math.max(0, tc - K.snap) * 10) * (tc >= K.snap ? 1 : 0);
    const fp = proj(ampW(0, tc < K.snap ? 6 : 40.5, 0));
    flashMat.uniforms.uC.value.set(fp[0] / W, 1 - fp[1] / H); flashMat.uniforms.uA.value = 0.45 * fl; flashMat.uniforms.uR.value = 0.07;
    whiteMat.uniforms.uCol.value.setRGB(0.039, 0.043, 0.051); whiteMat.uniforms.uA.value = smooth(END - 0.55, END - 0.05, tc);

    renderer.clear();
    renderer.render(bgScene, cam);
    renderer.render(scene, cam);
    renderer.render(ovScene, ovCam);

    // step list: all steps stay listed, the current one is lit
    const listA = smooth(T0 + 0.3, T0 + 0.9, tc) * (1 - smooth(END - 0.6, END - 0.1, tc));
    const steps = copy.filter((ce) => /^s7-\d$/.test(ce.id));
    let cur = -1; steps.forEach((ce, i) => { if (tc >= entryTime(ce.in)) cur = i; });
    if (txt['s7-head']) txt['s7-head'].style.opacity = listA.toFixed(3);
    steps.forEach((ce, i) => {
      const e = txt[ce.id], on = i === cur ? smooth(entryTime(ce.in), entryTime(ce.in) + 0.35, tc) : 0;
      e.style.opacity = (listA * (0.32 + 0.68 * on)).toFixed(3); e.classList.toggle('on', i === cur);
      e.style.transform = `translate(${(18 * on).toFixed(1)}px,0)`;
    });
    // press arrow: from the tail end, pointing along the axis towards the head, riding the cap in
    const aA = smooth(K.ringOff + 0.7, PRESS_A - 0.1, tc) * (1 - smooth(PRESS_B + 0.1, PRESS_B + 0.45, tc));
    const pa = proj(ampW(0, base.position.y - 1.2, 0)), pb = proj(ampW(0, base.position.y + 12, 0));
    const dxs = pb[0] - pa[0], dys = pb[1] - pa[1], dl = Math.hypot(dxs, dys) || 1, ux = dxs / dl, uy = dys / dl;
    const bob = 14 * Math.sin(tc * 7) * (1 - smooth(PRESS_A - 0.2, PRESS_A, tc));
    arrowG.setAttribute('transform', `translate(${(pa[0] - ux * (36 + bob)).toFixed(1)} ${(pa[1] - uy * (36 + bob)).toFixed(1)}) rotate(${(Math.atan2(uy, ux) * 180 / Math.PI).toFixed(2)})`);
    arrowSvg.style.opacity = aA.toFixed(3);

    const capEnd = proj(ampW(0, base.position.y, 0)), tp = tipR ? proj(tipR) : null;
    lastProbe = {
      phase: tc < K.ringGrip ? 'ready' : tc < K.ringOff ? 'ring' : tc < PRESS_A ? 'approach' : tc < PRESS_B ? 'press' : tc < CUT_IN ? 'click' : tc < K.powderHit ? 'fall' : tc < SNAP_SHOT ? 'shake' : tc < K.dropLand ? 'snap' : 'spread',
      pressDepth: +pd.toFixed(4), capY: +base.position.y.toFixed(3), ring: ringG.visible ? +rk.toFixed(3) : -1,
      capEnd: { x: +capEnd[0].toFixed(1), y: +capEnd[1].toFixed(1) }, tipR: tp ? { x: +tp[0].toFixed(1), y: +tp[1].toFixed(1) } : null,
      tipToCapMm: tipR ? +(tipR.distanceTo(ampW(0, base.position.y - 0.6, 0)) / MM).toFixed(2) : null,
      grains: { inAir, hit }, section: +ck.toFixed(3), mix: +mixK.toFixed(3), snap: +sk.toFixed(3)
    };
  }

  function setActive(v) { if (root) root.style.display = v ? '' : 'none'; }
  window.FILM_SCENES = window.FILM_SCENES || {};
  window.FILM_SCENES[7] = { init, render, setActive, probe: () => lastProbe, _dbg: DBG };
})();
