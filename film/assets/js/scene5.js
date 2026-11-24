/* Scene 5 · 凝 · 系列与单支 (docs/02-storyboard.md 幕 5).
   The gold point that scene 4 leaves at frame centre falls into the freeze-dried chamber of the single ampoule; the chamber
   flashes and the camera pulls back. On the 61.72 hit the studio light comes on over the 韶初泌语 line-up in its
   family photo the user supplied (groups per p19 — 通: mousse, mask, water · 补: the essence · 锁: emulsion, cream). The camera trucks across the series while
   everything but the essence dims; on the 65.97 hit the ampoule slides forward on its cold light table, turns to 3/4 and
   keeps turning to its side as the camera pushes toward the chamber for scene 6.
   The ampoule is the runtime GLB lit by the studio HDR; the series is the family photo as one plate on a mirror floor,
   dimmed product by product through pixel-column regions. render(t) is a pure function of time, so seek and frame export are exact. */
(function () {
  const F = window.FILM, THREE = window.THREE, T3X = window.T3X;
  const FPS = F.fps, W = 1920, H = 1080;
  const K = {};
  for (const k in F.cueFrames) K[k] = F.cueFrames[k] / FPS;
  const T0 = K.s5, END = K.s6, FAM = K.family, ONE = K.single;
  const GOLD = [1.0, 0.86, 0.62], GOLD_G = [0.80, 0.60, 0.34];
  const A_SCALE = 1.25;                       // hero scale of the single ampoule (real height 6.4 cm)
  const AMP_HOME = [0, 0.010, 0.06];         // standing on its light table, in front of the 20-pack
  const AMP_FWD = [0.0, 0.016, 0.20];
  const FALL_AT = T0 + 1.25, FLASH_AT = T0 + 1.37;
  // The brand's family photo (2000×859 px) stands behind the ampoule as one plate. Products in it, left to right, with
  // their pixel columns and the time each one dims while the camera trucks past (mask sits behind the box, top right).
  const PLATE = { px: [2000, 859], h: 0.19, x: 0.01, z: -0.04 };
  const REGIONS = [['mousse', 0, 275, 63.0], ['water', 275, 487, 63.3], ['emulsion', 487, 690, 63.7], ['cream', 690, 955, 64.1],
    ['mask', 1230, 2000, 64.5], ['box', 955, 1830, 64.9]];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sat = (v) => clamp(v, 0, 1);
  const smooth = (a, b, x) => { const u = sat((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  const inOut = (x) => 0.5 - 0.5 * Math.cos(Math.PI * sat(x));
  const out3 = (x) => 1 - Math.pow(1 - sat(x), 3);
  const lerp = (a, b, k) => a + (b - a) * k;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const lerpV = (a, b, k) => a.clone().lerp(b, k);

  let root, renderer, scene, cam, bgScene, bgMat, ovScene, ovCam, floorMat, ampG, ampModel, ampRefl, chamberMat, ringMat, goldLight,
    keyL, rimL, hemi, copy = [], active = false, lastProbe = null, CH = V(0, 0.02, 0.06), AMP_H = 0.09;
  const txt = {}, cards = [], glowMesh = [], envMats = [];

  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; };
  const entryTime = (v) => (typeof v === 'string' ? K[v] : v);
  const copyAlpha = (id, t) => {
    const c = copy.find((e) => e.id === id); if (!c) return 0;
    const a = entryTime(c.in), b = entryTime(c.out);
    return smooth(a, a + 0.4, t) * (1 - smooth(b - 0.35, b, t));
  };

  const quadVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const bgFS = `
    uniform float uOn, uLift, uSeed; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
    void main(){
      vec3 ink = vec3(0.039, 0.043, 0.051), fog = vec3(0.235, 0.245, 0.262);
      vec2 p = (vUv - vec2(0.5, 0.62)) * vec2(1.7778, 1.0);
      float spot = exp(-dot(p, p) * 2.6);
      vec3 c = ink + (fog - ink) * uOn * (0.12 + 0.88 * spot) * (0.6 + 0.4 * uLift);
      c += (h(gl_FragCoord.xy) - 0.5) * 0.012;
      gl_FragColor = vec4(c, 1.0);
    }`;
  const floorVS = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const floorFS = `
    uniform float uOn, uRing; uniform vec3 uAmp; uniform vec4 uShad[7]; varying vec3 vW;
    void main(){
      vec2 q = vW.xz - vec2(-0.03, 0.0);
      float pool = exp(-(q.x * q.x / 0.20 + q.y * q.y / 0.06));
      vec3 c = mix(vec3(0.039, 0.043, 0.051), vec3(0.30, 0.31, 0.325), pool * uOn);
      vec2 a = vW.xz - uAmp.xz;
      c += vec3(0.80, 0.88, 0.95) * uRing * exp(-dot(a, a) / 0.0035) * 0.12;
      float sh = 0.0;
      for (int i = 0; i < 7; i++) { vec2 d = (vW.xz - uShad[i].xy) / vec2(uShad[i].z * 0.62, 0.028); sh = max(sh, uShad[i].w * exp(-dot(d, d))); }
      c *= 1.0 - 0.75 * sh;
      float alpha = 1.0 - smoothstep(0.55, 1.25, length(vW.xz * vec2(0.8, 1.4)));
      gl_FragColor = vec4(c, alpha * 0.9);
    }`;
  const cardVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const cardFS = `
    uniform sampler2D map; uniform float uA, uRefl; uniform float uD[6]; varying vec2 vUv;
    void main(){
      vec4 t = texture2D(map, vUv);
      float x = vUv.x * 2000.0, y = (1.0 - vUv.y) * 859.0;
      float boxTop = mix(432.0, 384.0, clamp((x - 955.0) / 875.0, 0.0, 1.0));
      float uDim = x < 275.0 ? uD[0] : x < 487.0 ? uD[1] : x < 690.0 ? uD[2] : x < 955.0 ? uD[3]
        : (x > 1830.0 || (x > 1230.0 && y < boxTop)) ? uD[4] : uD[5];
      float a = t.a * uA;
      if (uRefl > 0.5) a *= 0.26 * (1.0 - smoothstep(0.0, 0.42, vUv.y));
      if (a < 0.003) discard;
      gl_FragColor = vec4(t.rgb * uDim, a);
      #include <colorspace_fragment>
    }`;
  const glowVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const glowFS = `
    uniform vec3 uCol; uniform float uA, uCore; varying vec2 vUv;
    void main(){ float r = length(vUv - 0.5) * 2.0; if (r > 1.0) discard;
      float g = exp(-r * r * 5.0) * (1.0 - r) + uCore * exp(-r * r * 90.0);
      gl_FragColor = vec4(uCol * g * uA, 1.0); }`;

  async function init(stage, copyEntries) {
    if (init.p) return init.p;
    init.p = (async () => {
      copy = copyEntries.filter((e) => e.scene === 5 && e.status !== 'pending');
      root = document.createElement('div'); root.id = 's5';
      stage.insertBefore(root, stage.firstChild);
      const canvas = document.createElement('canvas'); canvas.id = 's5-gl'; canvas.width = W; canvas.height = H; root.appendChild(canvas);
      for (const c of copy) {
        const cls = c.id.replace('s5-', 's5-');
        txt[c.id] = el('div', 'copy ' + cls, root, c.text); txt[c.id].dataset.copy = c.id;
      }
      root.style.display = 'none';

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(W, H, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
      renderer.autoClear = false;

      bgMat = new THREE.ShaderMaterial({ uniforms: { uOn: { value: 0 }, uLift: { value: 0 }, uSeed: { value: 0 } }, vertexShader: quadVS, fragmentShader: bgFS, depthTest: false, depthWrite: false });
      bgScene = new THREE.Scene(); bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));
      ovScene = new THREE.Scene(); ovCam = new THREE.OrthographicCamera(0, W, 0, H, -10, 10);
      const pg = new THREE.PlaneGeometry(1, 1);
      for (let i = 0; i < 4; i++) {
        const m = new THREE.Mesh(pg, new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color() }, uA: { value: 0 }, uCore: { value: 0 } },
          vertexShader: glowVS, fragmentShader: glowFS, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide }));
        m.frustumCulled = false; m.visible = false; ovScene.add(m); glowMesh.push(m);
      }

      scene = new THREE.Scene();
      cam = new THREE.PerspectiveCamera(30, W / H, 0.005, 20);
      const pm = new THREE.PMREMGenerator(renderer);
      const hdr = await new T3X.HDRLoader().loadAsync('assets/env/studio.hdr');
      scene.environment = pm.fromEquirectangular(hdr).texture; hdr.dispose(); pm.dispose();
      hemi = new THREE.HemisphereLight(0xdfe6ee, 0x15171a, 0.4); scene.add(hemi);
      keyL = new THREE.DirectionalLight(0xf2f1ec, 2.2); keyL.position.set(-0.6, 1.0, 0.9); scene.add(keyL);
      rimL = new THREE.DirectionalLight(0xcfdcec, 1.8); rimL.position.set(0.7, 0.6, -1.0); scene.add(rimL);
      goldLight = new THREE.PointLight(0xffc27a, 0, 0.25, 2); scene.add(goldLight);

      floorMat = new THREE.ShaderMaterial({
        uniforms: { uOn: { value: 0 }, uRing: { value: 0 }, uAmp: { value: V(...AMP_HOME) }, uShad: { value: Array.from({ length: 7 }, () => new THREE.Vector4()) } },
        vertexShader: floorVS, fragmentShader: floorFS, transparent: true, depthWrite: false
      });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), floorMat); floor.rotation.x = -Math.PI / 2; floor.renderOrder = 0; scene.add(floor);

      const tex = await new THREE.TextureLoader().loadAsync('assets/products/family.webp');
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const pw = PLATE.h * PLATE.px[0] / PLATE.px[1];
      for (const refl of [false, true]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, PLATE.h), new THREE.ShaderMaterial({
          uniforms: { map: { value: tex }, uD: { value: [1, 1, 1, 1, 1, 1] }, uA: { value: 0 }, uRefl: { value: refl ? 1 : 0 } },
          vertexShader: cardVS, fragmentShader: cardFS, transparent: true, depthWrite: !refl, side: THREE.DoubleSide }));
        m.position.set(PLATE.x, refl ? -PLATE.h / 2 : PLATE.h / 2, PLATE.z); if (refl) m.scale.y = -1;
        m.renderOrder = refl ? 1 : 2; scene.add(m); cards.push(m);
      }
      PLATE.w = pw;

      const gltf = await new T3X.GLTFLoader().setMeshoptDecoder(T3X.MeshoptDecoder).loadAsync('assets/models/ampoule.glb');
      ampModel = gltf.scene; ampModel.scale.setScalar(A_SCALE);
      ampG = new THREE.Group(); scene.add(ampG);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.033, 0.010, 64), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.55, metalness: 0.2 }));
      ped.position.y = -0.005; ampG.add(ped); envMats.push(ped.material);
      ringMat = new THREE.MeshBasicMaterial({ color: 0xdde6ee, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.0255, 0.0295, 96), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.0002; ampG.add(ring);
      ampG.add(ampModel);
      let chBox = null;
      ampModel.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        if (o.material) { o.material = o.material.clone(); envMats.push(o.material); o.material.userData.c0 = o.material.color.clone(); o.material.userData.t0 = o.material.transmission || 0; }
        if (/lower_cartridge/i.test(o.name)) { chamberMat = o.material; chamberMat.emissive = new THREE.Color(0xffb866); chamberMat.emissiveIntensity = 0; }
      });
      ampModel.updateMatrixWorld(true);
      ampModel.traverse((o) => { if (o.isMesh && /lower_cartridge/i.test(o.name)) chBox = new THREE.Box3().setFromObject(o); });
      const bb = new THREE.Box3().setFromObject(ampModel);
      AMP_H = bb.max.y - bb.min.y;
      CH = chBox ? chBox.getCenter(V(0, 0, 0)) : V(0, 0.012 * A_SCALE, 0); // chamber centre in ampG space
      ampRefl = ampModel.clone(true);
      ampRefl.traverse((o) => {
        if (!o.isMesh) return;
        const c = (o.material.color || new THREE.Color(0xffffff)).clone();
        o.material = new THREE.MeshBasicMaterial({ color: c.multiplyScalar(0.55), transparent: true, opacity: 0.14, depthWrite: false });
        o.renderOrder = 1;
      });
      ampRefl.scale.set(A_SCALE, -A_SCALE, A_SCALE); ampRefl.position.y = -0.02;
      ampG.add(ampRefl);
      renderer.compile(scene, cam);
    })();
    return init.p;
  }

  // ---------- camera and ampoule as functions of time ----------
  const ampPos = (t) => {
    const k = out3((t - ONE) / 0.8);
    return V(lerp(AMP_HOME[0], AMP_FWD[0], k), lerp(AMP_HOME[1], AMP_FWD[1], k), lerp(AMP_HOME[2], AMP_FWD[2], k));
  };
  const ampYaw = (t) => (t < ONE ? 0 : -0.82 * out3((t - ONE) / 0.9) - 0.26 * (t - ONE));
  const chamberW = (t) => ampPos(t).add(V(0, CH.y, 0));
  const goldW = (t) => chamberW(t).add(V(0, 0.055 * (1 - inOut((t - (T0 + 0.2)) / (FALL_AT - T0 - 0.2))), 0));
  function camAt(t) {
    const ampC = ampPos(t).add(V(0, AMP_H * 0.5, 0));
    if (t < FAM) {
      const pull = inOut((t - (FLASH_AT + 0.05)) / (FAM - FLASH_AT - 0.05));
      const tgt = lerpV(goldW(t), ampC, pull), d = lerp(0.085, 0.27, pull);
      return { pos: tgt.clone().add(V(0.22, 0.16, 1).normalize().multiplyScalar(d)), tgt };
    }
    // close shot at FAM, used as the start of the pull to wide
    const c0t = ampC.clone(), c0 = c0t.clone().add(V(0.22, 0.16, 1).normalize().multiplyScalar(0.27));
    const wideT = V(0.01, 0.105, 0), wideP = V(0.01, 0.135, 0.62);
    const s = inOut((t - (FAM + 0.55)) / (ONE - FAM - 1.25)), tx = -0.07 + 0.14 * s;
    const truckT = wideT.clone().add(V(tx, -0.01 * s, 0)), truckP = wideP.clone().add(V(tx * 1.3, -0.01 * s, -0.08 * s));
    const kPull = out3((t - FAM) / 0.95);
    let pos = lerpV(c0, truckP, kPull), tgt = lerpV(c0t, truckT, kPull);
    const recP = V(0.0, 0.095, 0.42), recT = V(0.0, 0.058, 0.05), kRec = inOut((t - (ONE - 0.7)) / 0.7);
    pos = lerpV(pos, recP, kRec); tgt = lerpV(tgt, recT, kRec);
    if (t < ONE) return { pos, tgt };
    // hero: ampoule right of centre, name on the left; then push toward the chamber for scene 6
    const kHero = out3((t - ONE) / 0.75), kTail = inOut((t - (ONE + 1.3)) / (END - ONE - 1.3));
    const heroT = lerpV(ampC.clone().add(V(-0.03, 0.0, 0)), chamberW(t).add(V(-0.004, 0.006, 0)), kTail);
    const dir = V(-0.12, 0.08, 1).normalize(), d = lerp(0.175, 0.1, kTail);
    const heroP = heroT.clone().add(dir.multiplyScalar(d));
    return { pos: lerpV(pos, heroP, kHero), tgt: lerpV(tgt, heroT, kHero) };
  }

  const proj = (v) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * W, (0.5 - p.y * 0.5) * H, p.z]; };
  let gi = 0;
  function glow(x, y, size, col, a, core) {
    const m = glowMesh[gi++]; if (!m) return;
    m.visible = a > 0.002 && size > 0;
    m.position.set(x, y, 0); m.scale.set(size || 1, size || 1, 1);
    m.material.uniforms.uCol.value.setRGB(col[0], col[1], col[2]); m.material.uniforms.uA.value = a; m.material.uniforms.uCore.value = core || 0;
  }

  function render(t) {
    if (!renderer) return;
    const tc = clamp(t, T0, END - 1e-4);
    const on = smooth(FAM - 0.04, FAM + 0.22, tc), lift = smooth(FAM, END, tc);
    const flash = Math.exp(-Math.pow((tc - FLASH_AT) / 0.22, 2)), after = smooth(FALL_AT, FLASH_AT + 0.4, tc);
    const solo = smooth(ONE - 0.1, ONE + 0.5, tc);

    const c = camAt(tc);
    cam.position.copy(c.pos); cam.lookAt(c.tgt); cam.updateMatrixWorld(); cam.updateProjectionMatrix();

    const ap = ampPos(tc);
    ampG.position.copy(ap); ampG.rotation.y = ampYaw(tc); ampG.updateMatrixWorld(true);
    ampRefl.position.y = -2 * ap.y;
    ampRefl.visible = on > 0.01;

    // studio light: only a low rim on the ampoule until the 61.72 hit
    keyL.intensity = lerp(0.0, 2.3, on); rimL.intensity = lerp(0.5, 1.8, on); hemi.intensity = lerp(0.0, 0.42, on);
    const envI = lerp(0.035, 1.0, on);
    for (const m of envMats) {
      m.envMapIntensity = envI; scene.environmentIntensity = envI;
      // before the lights come up the ampoule is a dark silhouette, not a lit white body
      if (m.userData.c0) { m.color.copy(m.userData.c0).multiplyScalar(lerp(0.22, 1, on)); m.transmission = m.userData.t0 * on; }
    }
    const gw = goldW(tc);
    goldLight.position.copy(tc < FALL_AT ? gw : chamberW(tc));
    goldLight.intensity = 0.006 * (1 - after) + 0.25 * flash + 0.01 * after * (1 - on);
    if (chamberMat) chamberMat.emissiveIntensity = 1.4 * flash + 0.12 * after * (1 - 0.6 * on);
    ringMat.opacity = lerp(0.06, 0.8, on) * (0.85 + 0.15 * solo) + 0.25 * flash;

    // products: reveal on the hit, then dim group by group while the camera passes
    floorMat.uniforms.uOn.value = on; floorMat.uniforms.uRing.value = on * lerp(0.6, 1.0, solo);
    floorMat.uniforms.uAmp.value.copy(ap);
    const dims = {};
    REGIONS.forEach(([name, a, b, at], i) => {
      const d = lerp(1, 0.2, smooth(at, at + 0.8, tc)) * lerp(1, 0.3, solo);
      dims[name] = +d.toFixed(3);
      for (const m of cards) m.material.uniforms.uD.value[i] = d;
      const x0 = PLATE.x + (a / PLATE.px[0] - 0.5) * PLATE.w, x1 = PLATE.x + (b / PLATE.px[0] - 0.5) * PLATE.w;
      floorMat.uniforms.uShad.value[i].set((x0 + x1) / 2, PLATE.z + 0.012, (x1 - x0) * 0.8, 0.8 * on * d);
    });
    for (const m of cards) m.material.uniforms.uA.value = on;
    floorMat.uniforms.uShad.value[6].set(ap.x, ap.z, 0.07, 0.6 * on);

    bgMat.uniforms.uOn.value = on; bgMat.uniforms.uLift.value = lift;
    bgMat.uniforms.uSeed.value = (Math.floor(tc * FPS) % 97) * 0.37;

    // the gold point, in screen space so its size matches scene 4's hand-off exactly
    gi = 0;
    const gs = proj(gw), chs = proj(chamberW(tc));
    const fall = sat((tc - T0) / (FALL_AT - T0));
    if (tc < FALL_AT + 0.1) {
      const a = 1 - smooth(FALL_AT - 0.1, FALL_AT + 0.1, tc);
      glow(gs[0], gs[1], lerp(230, 70, fall), GOLD_G, 0.9 * a, 0);
      glow(gs[0], gs[1], lerp(60, 26, fall), GOLD, 1.2 * a, 1.4);
    }
    const chPx = 0.016 * A_SCALE * H / (2 * Math.tan(15 * Math.PI / 180) * cam.position.distanceTo(chamberW(tc)));
    glow(chs[0], chs[1], chPx * (2.2 + 2.5 * flash), GOLD_G, 0.85 * flash + 0.10 * after * (1 - on), 0);
    glow(chs[0], chs[1], chPx * 1.1, GOLD, 0.9 * flash, 1.0);
    for (; gi < glowMesh.length;) glow(0, 0, 0, GOLD, 0);

    renderer.clear();
    renderer.render(bgScene, cam);
    renderer.render(scene, cam);
    renderer.render(ovScene, ovCam);

    // ---- copy ----
    if (txt['s5-title']) txt['s5-title'].style.opacity = copyAlpha('s5-title', tc).toFixed(3);
    if (txt['s5-groups']) txt['s5-groups'].style.opacity = copyAlpha('s5-groups', tc).toFixed(3);
    if (txt['s5-name']) txt['s5-name'].style.opacity = copyAlpha('s5-name', tc).toFixed(3);

    // probe
    const top = proj(ap.clone().add(V(0, AMP_H, 0))), bot = proj(ap);
    const focus = tc < FALL_AT ? gs : tc < FAM ? chs : proj(ap.clone().add(V(0, AMP_H * 0.5, 0)));
    lastProbe = {
      phase: tc < FALL_AT ? 'fall' : tc < FAM ? 'flash' : tc < ONE ? 'family' : 'single',
      focus: { x: +focus[0].toFixed(1), y: +focus[1].toFixed(1) }, chamber: { x: +chs[0].toFixed(1), y: +chs[1].toFixed(1) },
      amp: { x: +bot[0].toFixed(1), top: +top[1].toFixed(1), bottom: +bot[1].toFixed(1) },
      on: +on.toFixed(3), flash: +flash.toFixed(3), yaw: +ampYaw(tc).toFixed(3), dims
    };
  }

  function setActive(v) {
    active = v;
    if (root) root.style.display = v ? '' : 'none';
  }
  window.FILM_SCENES = window.FILM_SCENES || {};
  window.FILM_SCENES[5] = { init, render, setActive, probe: () => lastProbe };
})();
