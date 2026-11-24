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
  const CUT_A = T0 + 1.5, CUT_B = T0 + 2.4;       // section sweep
  const YAW0 = -0.9;                                 // V2: arrives from scene 4's light point, three-quarter view
  const TEMP_A = T0 + 1.6, TEMP_B = T0 + 4.2;       // powder setting window (the −40℃ figure itself is fixed)
  const FROST_A = T0 + 1.8, FROST_B = LP;
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

  let root, svg, renderer, scene, cam, bgScene, bgMat, ovScene, ovCam, ampG, body, ped, ringMat, powderLight, frost, frostMat, frostShellU,
    copy = [], lastProbe = null;
  const txt = {}, lines = {}, glowMesh = [], shellMats = [], powderMats = [];
  let frostU;
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
      for (let i = 0; i < 3; i++) {
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

      // no plinth: a soft pool of light under the floating ampoule, with one thin ring that drifts outward
      ringMat = new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 }, uR: { value: 0.3 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: `uniform float uA, uR; varying vec2 vUv;
          void main(){ float r = length(vUv - 0.5) * 2.;
            float pool = exp(-r * r * 9.) * 0.55 + exp(-r * r * 60.) * 0.5;
            float ring = exp(-pow((r - uR) / 0.035, 2.)) * 0.28 * (1. - smoothstep(0.55, 0.95, uR));
            gl_FragColor = vec4(vec3(0.86, 0.91, 0.96) * (pool + ring) * uA, 1.); }` });
      ped = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), ringMat); ped.rotation.x = -Math.PI / 2; ped.position.y = -0.004; ped.renderOrder = -1; scene.add(ped);

      ampG = new THREE.Group(); scene.add(ampG);
      const off = new THREE.Group(); off.position.y = -CY; ampG.add(off);
      const gltf = await new T3X.GLTFLoader().setMeshoptDecoder(T3X.MeshoptDecoder).loadAsync('assets/models/ampoule.glb');
      const model = gltf.scene; window.FILM_AMP.apply(model); model.scale.multiplyScalar(A_SCALE); off.add(model);
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
      const liqM = new THREE.Mesh(window.FILM_AMP.innerLathe(14.6, 39.55, 0.7, 64), cut(liq)); body.add(liqM);
      const liqCapMat = cap(new THREE.MeshStandardMaterial({ color: 0xdfe5e9, roughness: 0.12, metalness: 0, emissive: 0xe8eef2, emissiveIntensity: 0.12, transparent: true, opacity: 0.42, depthWrite: false }));
      const liqC = new THREE.Mesh(window.FILM_AMP.sectionGeometry(14.6, 39.55, 0.7), liqCapMat); body.add(liqC);
      const men = new THREE.Mesh(new THREE.PlaneGeometry(2 * (window.FILM_AMP.radiusAt(39.55) - 0.7), 0.35), cap(new THREE.MeshBasicMaterial({ color: 0xf2f1ec, transparent: true, opacity: 0.55 })));
      men.position.y = 39.55; body.add(men);
      // bright edges where the plane cuts the chamber and body walls
      const rimMat = cap(new THREE.MeshBasicMaterial({ color: 0xf2f1ec, transparent: true, opacity: 0.85, toneMapped: false }));
      for (const [x, y0, y1] of [[5.5, 0.4, 7.6], [5.4, 7.6, 14.18], [-5.5, 0.4, 7.6], [-5.4, 7.6, 14.18]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, y1 - y0), rimMat); m.position.set(x, (y0 + y1) / 2, 0.01); body.add(m);
      }
      for (const sd of [1, -1]) { const m = new THREE.Mesh(window.FILM_AMP.rimGeometry(14.0, window.FILM_AMP.NECK, 0.42, sd), rimMat); m.position.z = 0.01; body.add(m); }
      // dark interior behind the solvent so the section reads as depth
      const backMat = cap(new THREE.MeshBasicMaterial({ color: 0x26282c }));
      const back = new THREE.Mesh(window.FILM_AMP.sectionGeometry(14.4, 40.0, 1.0), backMat); back.position.set(0, 0, -1.6); body.add(back);
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

      // V3: ice-crystal particles instead of snowflakes. They condense out of the −40℃ cold, swirl, then are drawn onto the
      // chamber (back and sides) and into the powder, glint while the labels hold, and scatter at the cut. Pure function of t (GPU).
      const rand = rng(6068), N = 14000;
      const aS = new Float32Array(N * 3), aT = new Float32Array(N * 3), aK = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) {
        const inner = i < N * 0.22;
        // start: a cold cloud round the lower body, never between the camera and the cut (front |x| < 8)
        const gauss = () => { let u = 0; for (let k = 0; k < 4; k++) u += rand(); return (u - 2) / 0.577; };
        const mist = !inner && rand() < 0.1;
        let th, r, x, z;
        do { th = rand() * Math.PI * 2; r = 6.2 + Math.abs(gauss()) * (mist ? 11 : 9.5); x = Math.cos(th) * r; z = Math.sin(th) * r; } while (z > -2 && Math.abs(x) < 8.5);
        aS.set([x, 7 + gauss() * 8, z], i * 3);
        if (inner) {   // into the freeze-dried cake (seen through the cut)
          const u = rand() * 2 - 1; aT.set([u * 4.3, 0.9 + rand() * 6.2, -0.3 - rand() * 1.2], i * 3);
        } else {        // settle as rime on the chamber wall, back and sides only
          const tt = Math.PI * (0.94 + 1.12 * rand()), rr = 5.75 + Math.pow(rand(), 3) * 1.4;
          aT.set([Math.cos(tt) * rr, -0.2 + Math.pow(rand(), 0.8) * 15, Math.sin(tt) * rr], i * 3);
        }
        const born = FROST_A - 0.5 + Math.pow(rand(), 1.3) * 1.6, gather = FROST_A + 0.9 + rand() * 1.2 + (inner ? 0.5 : 0);
        const size = mist ? 9 + rand() * 12 : (inner ? 0.5 : 0.55) + Math.pow(rand(), 3) * (inner ? 0.6 : 1.8);
        aK.set([born, gather, size, inner ? 1 : rand() * 0.99], i * 4);
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.BufferAttribute(aS, 3)); pg.setAttribute('aT', new THREE.BufferAttribute(aT, 3)); pg.setAttribute('aK', new THREE.BufferAttribute(aK, 4));
      frostU = { uT: { value: 0 }, uScat: { value: 0 }, uPx: { value: 1 }, uEnd: { value: END } };
      frost = new THREE.Points(pg, new THREE.ShaderMaterial({
        uniforms: frostU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `uniform float uT, uScat, uPx; attribute vec3 aT; attribute vec4 aK; varying float vA; varying float vW;
          void main() {
            float age = max(uT - aK.x, 0.0), inner = step(0.999, aK.w);
            float g = smoothstep(aK.y, aK.y + 1.5, uT); g = g * g * (3.0 - 2.0 * g);
            // swirl: slow rotation about the axis, sinking, with a little turbulence
            float sw = (1.0 - g) * age;
            float a = 0.22 * sw * (0.6 + aK.w), c = cos(a), s = sin(a);
            vec3 p = vec3(c * position.x - s * position.z, position.y - 0.9 * sw, s * position.x + c * position.z);
            p += (1.0 - g) * 0.7 * vec3(sin(1.3 * uT + aK.w * 40.0), sin(0.9 * uT + aK.w * 23.0), cos(1.1 * uT + aK.w * 31.0));
            float mist = step(3.0, aK.z);
            // inflow spirals in rather than flying straight
            float sp = 1.4 * g * (1.0 - g) * (0.5 + aK.w); float cs = cos(sp), ss = sin(sp);
            vec3 tg = vec3(cs * aT.x - ss * aT.z, aT.y, ss * aT.x + cs * aT.z);
            vec3 q = mix(p, tg, g * (1.0 - mist));
            q += g * (1.0 - inner) * 0.08 * vec3(sin(2.0 * uT + aK.w * 50.0), 0.0, cos(2.0 * uT + aK.w * 50.0));
            // scatter outward at the end
            vec2 rd = normalize(q.xz + vec2(1e-3)); q.xz += rd * uScat * (6.0 + 14.0 * aK.w); q.y += uScat * (aK.w - 0.4) * 8.0;
            vec4 mv = modelViewMatrix * vec4(q, 1.0); gl_Position = projectionMatrix * mv;
            float born = smoothstep(aK.x, aK.x + 0.7, uT);
            float tw = 0.55 + 0.45 * sin(uT * (3.0 + 5.0 * aK.w) + aK.w * 60.0);
            vA = born * mix(0.75, tw, g) * (1.0 - uScat) * (1.0 - inner * smoothstep(0.75, 1.0, g) * 0.85);
            vA *= mix(1.0, 0.05 * (1.0 - smoothstep(aK.y - 0.3, aK.y + 1.2, uT)), mist);
            vW = aK.z;
            gl_PointSize = max(1.0, aK.z * uPx / -mv.z * (1.0 - 0.35 * g));
          }`,
        fragmentShader: `varying float vA; varying float vW;
          void main() {
            vec2 d = gl_PointCoord - 0.5; float r2 = dot(d, d) * 4.0;
            float core = vW > 3.0 ? exp(-r2 * 2.0) : exp(-r2 * 9.0), halo = exp(-r2 * 2.6) * 0.35;
            // a faint four-point glint on the larger crystals
            float star = vW > 1.25 && vW < 3.0 ? max(0.0, 1.0 - abs(d.x) * 30.0) * max(0.0, 1.0 - abs(d.y) * 2.2) + max(0.0, 1.0 - abs(d.y) * 30.0) * max(0.0, 1.0 - abs(d.x) * 2.2) : 0.0;
            float a = (core + halo + 0.35 * star) * vA; if (a < 0.004) discard;
            gl_FragColor = vec4(vec3(0.86, 0.92, 1.0) * a * 1.3, a);
          }`,
      }));
      frost.frustumCulled = false; frost.renderOrder = 4; body.add(frost);

      renderer.compile(scene, cam);
    })();
    return init.p;
  }

  // ---------- motion ----------
  const lift = (t) => 0.004 + 0.0012 * Math.sin((t - T0) * 2.2) * (1 - smooth(T0 + 0.9, T0 + 1.6, t)) + 0.014 * inOut((t - (T0 + 0.9)) / 1.4);   // hovers above the light, then rises
  const ampC = (t) => V(0, CY + lift(t), 0);
  const yaw = (t) => lerp(YAW0, 0, inOut((t - T0 - 0.3) / 2.0));
  const flipK = (t) => inOut((t - FLIP_A) / (FLIP_B - FLIP_A));
  const cutK = (t) => inOut((t - CUT_A) / (CUT_B - CUT_A)) * (1 - inOut((t - CLOSE) / 0.55));
  function camAt(t) {
    // scene 5 ends 0.1 m from the chamber along (−0.12, 0.08, 1); start there, swing to front-on and pull back
    const c = ampC(t), chamber = c.clone().add(V(0, (3.9 - 31.8) * MM, 0));
    // V2: start far with the chamber's glow on frame centre (scene 4's light point), then glide in
    const startT = chamber.clone(), startP = startT.clone().add(V(0, 0.03, 1).normalize().multiplyScalar(1.1));
    let tgt = startT, pos = startP;
    // full section, ampoule right of centre for the counter on the left
    const kA = Math.pow(inOut((t - T0) / 2.6), 0.7);
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
    ped.visible = pedA > 0.01; ringMat.uniforms.uA.value = pedA * smooth(T0 - 0.2, T0 + 0.4, tc); ringMat.uniforms.uR.value = 0.18 + 0.8 * smooth(T0, T0 + 1.9, tc);

    // freezing: the powder sets, frost spreads outward
    const set = smooth(TEMP_A, TEMP_B + 0.6, tc), fr = smooth(FROST_A, FROST_B, tc);
    powderU.uSet.value = set;
    const glowI = lerp(0.9, 0.32, set);
    for (const m of powderMats) m.emissiveIntensity = glowI;
    powderLight.intensity = lerp(0.022, 0.006, set);
    frostShellU.uFrost.value = fr;
    const scat = smooth(END - 0.6, END, tc);
    // ice-crystal particles (pixel size per mm at unit depth = focal length in px × world size of 1 mm)
    frostU.uT.value = tc; frostU.uScat.value = out3(scat);
    frostU.uPx.value = cam.projectionMatrix.elements[5] * H * 0.5 * body.matrixWorld.getMaxScaleOnAxis() * 0.32;

    bgMat.uniforms.uLift.value = smooth(T0, END, tc);
    bgMat.uniforms.uSeed.value = (Math.floor(tc * FPS) % 97) * 0.37;

    const pw = bodyW(0, 3.9, 0), ps = proj(pw);
    const pxPerMm = MM * H / (2 * Math.tan(15 * Math.PI / 180) * cam.position.distanceTo(pw));
    gi = 0;
    const hand = 1 - smooth(T0 + 0.2, T0 + 1.4, tc);   // scene 4's light point hands over to the chamber
    glow(ps[0], ps[1], 150, GOLD, 0.9 * hand, 1.0);
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
