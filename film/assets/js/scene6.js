/* Scene 6 · 锁 · −40℃ 双仓 (docs/02-storyboard.md 幕 6).
   Picks up scene 5's push onto the freeze chamber. A section plane sweeps across the ampoule from the side and opens it:
   near-white freeze-dried powder in the silver tail chamber, clear solvent in the body. −40℃ (p38) is shown as a fixed figure while frost
   grows outward from the chamber wall and the powder sets into a porous cake. 72.35 labels the powder chamber (p38, p39),
   74.47 the solvent chamber (p39); 76.60 the labels retract, the section closes and the ampoule turns tail-up at frame centre
   for scene 7. The cut is two world-space clipping planes intersected (front half ∩ swept side); the contents are drawn by
   this file with flat caps on the cut. render(t) is a pure function of time, so seek and frame export are exact. */
(function () {
  const F = window.FILM, THREE = window.THREE, T3X = window.T3X;
  const FPS = F.fps, W = 1920, H = 1080;
  const K = {};
  for (const k in F.cueFrames) K[k] = F.cueFrames[k] / FPS;
  const T0 = K.s6, END = K.s7, LP = K.labelPowder, LS = K.labelSolvent, CLOSE = K.close;
  const GOLD = [1.0, 0.86, 0.62], GOLD_G = [0.80, 0.60, 0.34];
  const A_SCALE = 1.25, MM = 0.001 * A_SCALE;      // same hero scale as scene 5; contents are modelled in ampoule mm
  const CY = 31.8 * MM;                             // pivot: middle of the 63.65 mm ampoule
  const R_CUT = 5.6 * MM;
  const CUT_A = T0 + 0.15, CUT_B = T0 + 1.05;       // section sweep
  const YAW0 = -0.82 - 0.26 * (T0 - K.single);      // scene 5's yaw on its last frame
  const TEMP_A = T0 + 0.3, TEMP_B = T0 + 3.5;       // powder setting window (the −40℃ figure itself is fixed)
  const FROST_A = T0 + 0.5, FROST_B = LP;
  const FLIP_A = CLOSE + 0.25, FLIP_B = END - 0.02;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sat = (v) => clamp(v, 0, 1);
  const smooth = (a, b, x) => { const u = sat((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  const inOut = (x) => 0.5 - 0.5 * Math.cos(Math.PI * sat(x));
  const out3 = (x) => 1 - Math.pow(1 - sat(x), 3);
  const lerp = (a, b, k) => a + (b - a) * k;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const lerpV = (a, b, k) => a.clone().lerp(b, k);
  function rng(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  let root, svg, renderer, scene, cam, bgScene, bgMat, ovScene, ovCam, ampG, body, ped, pedMat, ringMat, powderLight, frost, frostMat, frostShellU,
    copy = [], lastProbe = null;
  const txt = {}, lines = {}, glowMesh = [], shellMats = [], powderMats = [], flakes = [];
  const P1 = new THREE.Plane(), P2 = new THREE.Plane(), P3 = new THREE.Plane();
  const powderU = { uSet: { value: 0 } };

  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; };
  const entryTime = (v) => (typeof v === 'string' ? K[v] : v);
  const copyAlpha = (id, t) => {
    const c = copy.find((e) => e.id === id); if (!c) return 0;
    const a = entryTime(c.in), b = entryTime(c.out);
    return smooth(a, a + 0.4, t) * (1 - smooth(b - 0.35, b, t));
  };

  const quadVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const bgFS = `
    uniform float uLift, uSeed; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
    void main(){
      vec3 ink = vec3(0.039, 0.043, 0.051), fog = vec3(0.165, 0.173, 0.188);
      vec2 p = (vUv - vec2(0.5, 0.55)) * vec2(1.7778, 1.0);
      float spot = exp(-dot(p, p) * 1.9);
      vec3 c = ink + (fog - ink) * (0.25 + 0.75 * spot) * (0.85 + 0.15 * uLift);
      c += (h(gl_FragCoord.xy) - 0.5) * 0.012;
      gl_FragColor = vec4(c, 1.0);
    }`;
  const glowVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const glowFS = `
    uniform vec3 uCol; uniform float uA, uCore; varying vec2 vUv;
    void main(){ float r = length(vUv - 0.5) * 2.0; if (r > 1.0) discard;
      float g = exp(-r * r * 5.0) * (1.0 - r) + uCore * exp(-r * r * 90.0);
      gl_FragColor = vec4(uCol * g * uA, 1.0); }`;
  const NOISE = `
    float fhash(vec3 p){ p = fract(p * .3183099 + vec3(.13, .23, .31)); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float fnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
      return mix(mix(mix(fhash(i), fhash(i + vec3(1,0,0)), f.x), mix(fhash(i + vec3(0,1,0)), fhash(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(fhash(i + vec3(0,0,1)), fhash(i + vec3(1,0,1)), f.x), mix(fhash(i + vec3(0,1,1)), fhash(i + vec3(1,1,1)), f.x), f.y), f.z); }`;

  // Freeze-dried cake: pores open up and the glow drops as uSet goes 0 → 1. vP is in ampoule mm so cylinder and cap agree.
  function porous(mat, off) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSet = powderU.uSet; sh.uniforms.uOff = { value: off };
      sh.vertexShader = 'uniform vec3 uOff; varying vec3 vP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position + uOff;');
      sh.fragmentShader = 'uniform float uSet; varying vec3 vP;\n' + NOISE + "\n" + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          float gN = fnoise(vP * 2.4), fN = fnoise(vP * 7.0);
          float pore = smoothstep(.6, .8, gN) * (.5 + .5 * fN) * (.25 + .75 * uSet);
          diffuseColor.rgb *= mix(1.05, .38, pore) * (.86 + .24 * fN);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance *= (1.0 - .75 * pore) * (.7 + .6 * fN);`);
    };
    mat.customProgramCacheKey = () => 's6-porous';
  }

  function flakeGeometry() {
    // extruded hexagonal branches (same construction as the Codex frozen-chamber flakes), unit radius ≈ 1
    const pos = [];
    function rod(ax, ay, bx, by, w, d) {
      const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy), nx = -dy / l * w * 0.5, ny = dx / l * w * 0.5;
      const v = [[ax + nx, ay + ny, -d], [bx + nx, by + ny, -d], [bx - nx, by - ny, -d], [ax - nx, ay - ny, -d],
        [ax + nx, ay + ny, d], [bx + nx, by + ny, d], [bx - nx, by - ny, d], [ax - nx, ay - ny, d]];
      for (const f of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]])
        for (const tri of [[f[0], f[1], f[2]], [f[0], f[2], f[3]]]) for (const i of tri) pos.push(...v[i]);
    }
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3, c = Math.cos(a), s = Math.sin(a); rod(0, 0, c, s, 0.07, 0.03);
      for (const f of [0.48, 0.73]) for (const side of [-1, 1]) {
        const x = c * f, y = s * f, b = a + side * Math.PI * 0.67, r = f === 0.48 ? 0.23 : 0.28;
        rod(x, y, x + Math.cos(b) * r, y + Math.sin(b) * r, 0.05, 0.025);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
  }

  async function init(stage, copyEntries) {
    if (init.p) return init.p;
    init.p = (async () => {
      copy = copyEntries.filter((e) => e.scene === 6 && e.status !== 'pending');
      root = document.createElement('div'); root.id = 's6';
      stage.insertBefore(root, stage.firstChild);
      const canvas = document.createElement('canvas'); canvas.id = 's6-gl'; canvas.width = W; canvas.height = H; root.appendChild(canvas);
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.id = 's6-lines';
      svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); root.appendChild(svg);
      for (const id of ['s6-powder', 's6-solvent']) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); svg.appendChild(g);
        const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); g.appendChild(pl);
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', 6); g.appendChild(dot);
        lines[id] = { g, pl, dot };
      }
      for (const c of copy) {
        txt[c.id] = el('div', 'copy ' + c.id, root, c.text); txt[c.id].dataset.copy = c.id;
        // callouts: chamber name on top, contents below
        if (/^s6-(powder|solvent)$/.test(c.id)) { const [a, b] = c.text.split(' · '); txt[c.id].textContent = ''; el('b', '', txt[c.id], a); el('span', '', txt[c.id], b); }
      }
      root.style.display = 'none';

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(W, H, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
      renderer.autoClear = false; renderer.localClippingEnabled = true;

      bgMat = new THREE.ShaderMaterial({ uniforms: { uLift: { value: 0 }, uSeed: { value: 0 } }, vertexShader: quadVS, fragmentShader: bgFS, depthTest: false, depthWrite: false });
      bgScene = new THREE.Scene(); bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));
      ovScene = new THREE.Scene(); ovCam = new THREE.OrthographicCamera(0, W, 0, H, -10, 10);
      for (let i = 0; i < 2; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color() }, uA: { value: 0 }, uCore: { value: 0 } },
          vertexShader: glowVS, fragmentShader: glowFS, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide }));
        m.frustumCulled = false; m.visible = false; ovScene.add(m); glowMesh.push(m);
      }

      scene = new THREE.Scene();
      cam = new THREE.PerspectiveCamera(30, W / H, 0.005, 20);
      const pm = new THREE.PMREMGenerator(renderer);
      const hdr = await new T3X.HDRLoader().loadAsync('assets/env/studio.hdr');
      scene.environment = pm.fromEquirectangular(hdr).texture; hdr.dispose(); pm.dispose();
      scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x15171a, 0.42));
      const key = new THREE.DirectionalLight(0xf2f1ec, 2.1); key.position.set(-0.6, 1.0, 0.9); scene.add(key);
      const rim = new THREE.DirectionalLight(0xdfe4ea, 1.7); rim.position.set(0.7, 0.6, -1.0); scene.add(rim);

      // scene 5's light table, left behind as the ampoule lifts
      pedMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.55, metalness: 0.2, transparent: true });
      ped = new THREE.Group(); scene.add(ped);
      const pc = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.033, 0.010, 64), pedMat); pc.position.y = -0.005; ped.add(pc);
      ringMat = new THREE.MeshBasicMaterial({ color: 0xdde6ee, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.0255, 0.0295, 96), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.0002; ped.add(ring);

      ampG = new THREE.Group(); scene.add(ampG);
      const off = new THREE.Group(); off.position.y = -CY; ampG.add(off);
      const gltf = await new T3X.GLTFLoader().setMeshoptDecoder(T3X.MeshoptDecoder).loadAsync('assets/models/ampoule.glb');
      const model = gltf.scene; model.scale.multiplyScalar(A_SCALE); off.add(model);
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        if (/inner_essence/i.test(o.name)) { o.visible = false; return; }
        o.material = o.material.clone();
        o.material.clippingPlanes = [P1, P2]; o.material.clipIntersection = true; o.material.side = THREE.DoubleSide;
        // inside walls seen through the cut sit in shadow, so the section reads as depth
        o.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb *= 0.42;'); };
        o.material.customProgramCacheKey = () => 's6-shell';
        shellMats.push(o.material);
      });

      // contents, in ampoule millimetres
      body = new THREE.Group(); body.scale.setScalar(MM); off.add(body);
      const cut = (m) => { m.clippingPlanes = [P1, P2]; m.clipIntersection = true; return m; };
      const cap = (m) => { m.clippingPlanes = [P3]; m.side = THREE.DoubleSide; return m; };
      const mkPowder = (geo, pos, isCap) => {
        const m = new THREE.MeshStandardMaterial({ color: 0xf0ebe2, roughness: 0.95, metalness: 0, emissive: 0xffc27a, emissiveIntensity: 1 });
        porous(m, pos); isCap ? cap(m) : cut(m); powderMats.push(m);
        const mesh = new THREE.Mesh(geo, m); mesh.position.copy(pos); body.add(mesh); return mesh;
      };
      const PW = V(0, 3.9, 0);
      mkPowder(new THREE.CylinderGeometry(4.9, 4.9, 5.8, 64), PW, false);
      mkPowder(new THREE.PlaneGeometry(9.8, 5.8), PW, true);
      const sep = new THREE.MeshStandardMaterial({ color: 0xe8ebee, roughness: 0.35, metalness: 0.3 });
      const sepM = new THREE.Mesh(new THREE.CylinderGeometry(5.1, 5.1, 0.6, 64), cut(sep)); sepM.position.y = 7.4; body.add(sepM);
      const sepC = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 0.6), cap(sep.clone())); sepC.position.y = 7.4; body.add(sepC);
      const liq = new THREE.MeshPhysicalMaterial({ color: 0xf3f5f6, roughness: 0.04, transmission: 1, thickness: 9, ior: 1.33, transparent: true });
      const liqM = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 25, 64), cut(liq)); liqM.position.y = 27.1; body.add(liqM);
      const liqCapMat = cap(new THREE.MeshStandardMaterial({ color: 0xdfe5e9, roughness: 0.12, metalness: 0, emissive: 0xe8eef2, emissiveIntensity: 0.12, transparent: true, opacity: 0.42, depthWrite: false }));
      const liqC = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 25), liqCapMat); liqC.position.y = 27.1; body.add(liqC);
      const men = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 0.35), cap(new THREE.MeshBasicMaterial({ color: 0xf2f1ec, transparent: true, opacity: 0.55 })));
      men.position.y = 39.55; body.add(men);
      // bright edges where the plane cuts the chamber and body walls
      const rimMat = cap(new THREE.MeshBasicMaterial({ color: 0xf2f1ec, transparent: true, opacity: 0.85, toneMapped: false }));
      for (const [x, y0, y1] of [[5.5, 0.4, 7.6], [5.4, 7.6, 14.18], [5.5, 14.0, 40.5], [-5.5, 0.4, 7.6], [-5.4, 7.6, 14.18], [-5.5, 14.0, 40.5]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, y1 - y0), rimMat); m.position.set(x, (y0 + y1) / 2, 0.01); body.add(m);
      }
      // dark interior behind the solvent so the section reads as depth
      const backMat = cap(new THREE.MeshBasicMaterial({ color: 0x26282c }));
      const back = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 25.6), backMat); back.position.set(0, 27.2, -1.6); body.add(back);
      powderLight = new THREE.PointLight(0xffc27a, 0, 0.06, 2); powderLight.position.copy(PW); body.add(powderLight);

      // frost film on the chamber wall that climbs up the body
      frostShellU = { uFrost: { value: 0 } };
      frostMat = cut(new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.6, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      frostMat.onBeforeCompile = (sh) => {
        sh.uniforms.uFrost = frostShellU.uFrost;
        sh.vertexShader = 'varying vec3 vP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position + vec3(0.0, 15.0, 0.0);');
        sh.fragmentShader = 'uniform float uFrost; varying vec3 vP;\n' + NOISE + "\n" + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float n = fnoise(vP * 1.7) * .6 + fnoise(vP * 5.3) * .4;
          float h = (vP.y - 7.0) / 17.0;
          float cover = smoothstep(h - .1, h + .1, uFrost * 1.2 - n * .3);
          diffuseColor.a *= cover * (.25 + .6 * smoothstep(.42, .78, n));`);
      };
      frostMat.customProgramCacheKey = () => 's6-frost';
      const fs = new THREE.Mesh(new THREE.CylinderGeometry(5.72, 5.72, 18, 72, 1, true), frostMat); fs.position.y = 9; fs.renderOrder = 3; body.add(fs);

      // flakes grow from the wall outward (back and sides only, so the cut stays readable)
      const rand = rng(6068), N = 140;
      for (let i = 0; i < N; i++) {
        const d = Math.pow(rand(), 1.6) * 11, th = Math.PI * (0.92 + 1.16 * rand()), r = 5.9 + d;
        flakes.push({ th, r, y: 0.5 + rand() * (13 + d * 0.8), s: 0.7 + rand() * 1.5 * (0.6 + d / 11), at: FROST_A + (d / 11) * (FROST_B - FROST_A - 0.9) + rand() * 0.5,
          tx: (rand() - 0.5) * 1.2, tz: rand() * Math.PI, drift: 0.6 + rand() });
      }
      const flakeMat = new THREE.MeshStandardMaterial({ color: 0xf2f1ec, emissive: 0xf2f1ec, emissiveIntensity: 0.18, roughness: 0.35, metalness: 0, transparent: true });
      frost = new THREE.InstancedMesh(flakeGeometry(), flakeMat, N); frost.frustumCulled = false; body.add(frost);

      renderer.compile(scene, cam);
    })();
    return init.p;
  }

  // ---------- motion ----------
  const lift = (t) => 0.014 * inOut((t - (T0 + 0.9)) / 1.4);
  const ampC = (t) => V(0, CY + lift(t), 0);
  const yaw = (t) => lerp(YAW0, 0, inOut((t - T0) / 1.2));
  const flipK = (t) => inOut((t - FLIP_A) / (FLIP_B - FLIP_A));
  const cutK = (t) => inOut((t - CUT_A) / (CUT_B - CUT_A)) * (1 - inOut((t - CLOSE) / 0.55));
  function camAt(t) {
    // scene 5 ends 0.1 m from the chamber along (−0.12, 0.08, 1); start there, swing to front-on and pull back
    const c = ampC(t), chamber = c.clone().add(V(0, (3.9 - 31.8) * MM, 0));
    const startT = chamber.clone().add(V(-0.004, 0.006, 0)), startP = startT.clone().add(V(-0.12, 0.08, 1).normalize().multiplyScalar(0.1));
    const swing = inOut((t - T0) / 1.3);
    const closeT = chamber.clone().add(V(0, 0.003, 0)), closeP = closeT.clone().add(V(0.0, 0.045, 1).normalize().multiplyScalar(0.085));
    let tgt = lerpV(startT, closeT, swing), pos = lerpV(startP, closeP, swing);
    // full section, ampoule right of centre for the counter on the left
    const kA = inOut((t - (T0 + 1.2)) / 1.6);
    const aT = c.clone().add(V(-0.019, -0.004, 0)), aP = aT.clone().add(V(0.0, 0.07, 1).normalize().multiplyScalar(0.2));
    tgt = lerpV(tgt, aT, kA); pos = lerpV(pos, aP, kA);
    // labels: centre the ampoule, powder label right, solvent label left
    const kB = inOut((t - (LP - 0.35)) / 0.9);
    const bT = c.clone().add(V(-0.001, -0.008, 0)), bP = bT.clone().add(V(0.02, 0.05, 1).normalize().multiplyScalar(0.19));
    tgt = lerpV(tgt, bT, kB); pos = lerpV(pos, bP, kB);
    // close and turn tail-up at frame centre
    const kC = inOut((t - CLOSE) / (END - CLOSE));
    const cT = c.clone(), cP = cT.clone().add(V(0, 0.03, 1).normalize().multiplyScalar(0.2));
    return { pos: lerpV(pos, cP, kC), tgt: lerpV(tgt, cT, kC) };
  }

  const proj = (v) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * W, (0.5 - p.y * 0.5) * H, p.z]; };
  const bodyW = (x, y, z) => body.localToWorld(V(x, y, z));
  let gi = 0;
  function glow(x, y, size, col, a, core) {
    const m = glowMesh[gi++]; if (!m) return;
    m.visible = a > 0.002 && size > 0;
    m.position.set(x, y, 0); m.scale.set(size || 1, size || 1, 1);
    m.material.uniforms.uCol.value.setRGB(col[0], col[1], col[2]); m.material.uniforms.uA.value = a; m.material.uniforms.uCore.value = core || 0;
  }
  const fmtTemp = (v) => (v < 0 ? '−' + -v : String(v)) + '℃';
  const tempAt = () => -40;   // p38 gives only the end point; no illustrative start value

  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), SV = V(1, 1, 1), PV = V(0, 0, 0);
  function render(t) {
    if (!renderer) return;
    const tc = clamp(t, T0, END - 1e-4);

    ampG.position.copy(ampC(tc));
    ampG.rotation.set(0, yaw(tc), Math.PI * flipK(tc));
    ampG.updateMatrixWorld(true);
    const ck = cutK(tc), sx = lerp(-R_CUT, R_CUT, ck);
    // local planes (ampoule space, before the −CY offset — x and z are unaffected by it) moved to world space
    P1.set(V(0, 0, -1), 0).applyMatrix4(ampG.matrixWorld);
    P2.set(V(1, 0, 0), -sx).applyMatrix4(ampG.matrixWorld);
    P3.set(V(-1, 0, 0), sx).applyMatrix4(ampG.matrixWorld);

    const c = camAt(tc);
    cam.position.copy(c.pos); cam.lookAt(c.tgt); cam.updateMatrixWorld(); cam.updateProjectionMatrix();

    const pedA = 1 - smooth(T0 + 0.9, T0 + 1.9, tc);
    ped.visible = pedA > 0.01; pedMat.opacity = pedA; ringMat.opacity = 0.8 * pedA;

    // freezing: the powder sets, frost spreads outward
    const set = smooth(TEMP_A, TEMP_B + 0.6, tc), fr = smooth(FROST_A, FROST_B, tc);
    powderU.uSet.value = set;
    const glowI = lerp(0.9, 0.32, set);
    for (const m of powderMats) m.emissiveIntensity = glowI;
    powderLight.intensity = lerp(0.022, 0.006, set);
    frostShellU.uFrost.value = fr;
    const scat = smooth(END - 0.6, END, tc);
    flakes.forEach((f, i) => {
      const g = out3((tc - f.at) / 0.55), r = f.r + scat * f.drift * 6;
      SV.setScalar(f.s * g * (1 - 0.3 * scat) + 1e-4);
      PV.set(Math.cos(f.th) * r, f.y + scat * f.drift * 2, Math.sin(f.th) * r);
      E.set(f.tx, -f.th + Math.PI / 2, f.tz + tc * 0.05 * f.drift); Q.setFromEuler(E);
      frost.setMatrixAt(i, M4.compose(PV, Q, SV));
    });
    frost.instanceMatrix.needsUpdate = true;
    frost.material.opacity = 0.85 * (1 - 0.5 * scat);

    bgMat.uniforms.uLift.value = smooth(T0, END, tc);
    bgMat.uniforms.uSeed.value = (Math.floor(tc * FPS) % 97) * 0.37;

    const pw = bodyW(0, 3.9, 0), ps = proj(pw);
    const pxPerMm = MM * H / (2 * Math.tan(15 * Math.PI / 180) * cam.position.distanceTo(pw));
    gi = 0;
    glow(ps[0], ps[1], pxPerMm * 26, GOLD_G, 0.45 * (1 - set) * (1 - flipK(tc)), 0);
    glow(ps[0], ps[1], pxPerMm * 9, GOLD, 0.22 * (1 - set), 0.6);

    renderer.clear();
    renderer.render(bgScene, cam);
    renderer.render(scene, cam);
    renderer.render(ovScene, ovCam);

    // ---- copy ----
    const temp = tempAt(tc);
    if (txt['s6-temp']) { txt['s6-temp'].textContent = fmtTemp(temp); txt['s6-temp'].style.opacity = copyAlpha('s6-temp', tc).toFixed(3); }
    for (const id of ['s6-title', 's6-lock']) if (txt[id]) txt[id].style.opacity = copyAlpha(id, tc).toFixed(3);
    const label = (id, anchor, side) => {
      const e = txt[id], L = lines[id]; if (!e) return null;
      const a = copyAlpha(id, tc), c0 = copy.find((x) => x.id === id), k = out3((tc - entryTime(c0.in)) / 0.45) * (1 - smooth(CLOSE - 0.35, CLOSE, tc));
      const s = proj(anchor), ex = s[0] + side * 120, ey = s[1] - 60, tx = ex + side * 70;
      const x2 = lerp(s[0], ex, sat(k * 2)), y2 = lerp(s[1], ey, sat(k * 2)), x3 = lerp(ex, tx, sat(k * 2 - 1));
      L.pl.setAttribute('points', `${s[0].toFixed(1)},${s[1].toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${(k > 0.5 ? x3 : x2).toFixed(1)},${y2.toFixed(1)}`);
      L.dot.setAttribute('cx', s[0].toFixed(1)); L.dot.setAttribute('cy', s[1].toFixed(1));
      L.g.style.opacity = (k > 0.001 ? 1 : 0) * sat(k * 4);
      e.style.opacity = a.toFixed(3);
      e.style.transform = `translate(${(tx + side * 18).toFixed(1)}px,${ey.toFixed(1)}px) translate(${side > 0 ? 0 : -100}%,-50%)`;
      return { anchor: { x: +s[0].toFixed(1), y: +s[1].toFixed(1) }, end: { x: +tx.toFixed(1), y: +ey.toFixed(1) }, k: +k.toFixed(3) };
    };
    const lp = label('s6-powder', bodyW(2.2, 3.9, 0), 1), ls = label('s6-solvent', bodyW(-2.2, 27.5, 0), -1);

    const top = proj(bodyW(0, 63.65, 0)), bot = proj(bodyW(0, 0, 0)), sv = proj(bodyW(0, 27.1, 0)), mid = proj(ampG.position);
    let schema = null;
    if (txt['s6-schema']) {   // small caption under the cut-away
      const lo = top[1] > bot[1] ? top : bot, sx2 = clamp(lo[0], 200, 1720), sy2 = Math.min(lo[1] + 36, 1030);
      txt['s6-schema'].style.opacity = copyAlpha('s6-schema', tc).toFixed(3);
      txt['s6-schema'].style.transform = `translate(${sx2.toFixed(1)}px,${sy2.toFixed(1)}px) translate(-50%,0)`;
      schema = { x: +sx2.toFixed(1), y: +sy2.toFixed(1) };
    }
    lastProbe = {
      phase: tc < CUT_B ? 'cut' : tc < LP ? 'freeze' : tc < CLOSE ? 'labels' : 'close',
      powder: { x: +ps[0].toFixed(1), y: +ps[1].toFixed(1) }, solvent: { x: +sv[0].toFixed(1), y: +sv[1].toFixed(1) },
      amp: { x: +mid[0].toFixed(1), y: +mid[1].toFixed(1), top: { x: +top[0].toFixed(1), y: +top[1].toFixed(1) }, bottom: { x: +bot[0].toFixed(1), y: +bot[1].toFixed(1) } },
      cut: +ck.toFixed(3), temp, set: +set.toFixed(3), frost: +fr.toFixed(3), flip: +flipK(tc).toFixed(3), labels: { powder: lp, solvent: ls }, schema
    };
  }

  function setActive(v) { if (root) root.style.display = v ? '' : 'none'; }
  window.FILM_SCENES = window.FILM_SCENES || {};
  window.FILM_SCENES[6] = { init, render, setActive, probe: () => lastProbe };
})();
