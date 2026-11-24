/* Scene 4 · 研 · 对应研究 (docs/02-storyboard.md 幕 4). The only scene in tech blue #5FB8E6.
   The wax sample that scene 3 lifts to frame centre opens a microscope field and breaks into blue particles:
   composition ring (one name lit per beat) → regeneration branches growing from a stem-cell pool (card ①) →
   double helix with a read-out scan and a proteome peak trace behind it (card ②) → every particle spirals into one
   point that turns back to warm gold for scene 5. As in scenes 1–3, render(t) is a pure function of time: each
   particle's position is evaluated in closed form from seeded constants, so seek and frame export are exact. */
(function () {
  const F = window.FILM, THREE = window.THREE;
  const FPS = F.fps, W = 1920, H = 1080;
  const K = {};
  for (const k in F.cueFrames) K[k] = F.cueFrames[k] / FPS;
  // V2: ring of nutrients (s4 → journal), then the Science cover + ruminant phylogeny (journal), then every particle
  // converges to one light point that becomes scene 6's ampoule. The old branch/helix stages are switched off.
  K.ref1 = K.journal; K.ref2 = 1e4; K.converge = K.s6 - 1.85;
  const T0 = K.s4, END = K.s6;
  const N = 5200;
  const CX = 960, CY = 545;                 // where scene 3 leaves the wax
  const BLUE = [0.373, 0.722, 0.902], ICE = [0.80, 0.94, 1.0], GOLD = [1.0, 0.86, 0.62], GOLD_G = [0.80, 0.60, 0.34];
  const RING_R = 330, FIELD_R = 500;
  const TX = 760;                            // branches and helix sit left of the reference cards
  const HY0 = 190, HY1 = 830, H_R = 95, H_TURNS = 3.2;
  const COMPS = ['s4-c1', 's4-c2', 's4-c3', 's4-c4', 's4-c5', 's4-c6'];
  const CARDS = [];
  // ruminant families, Chen et al., Science 364(6446), 2019 (KT板42): Tragulidae basal; Cervidae sister to (Moschidae, Bovidae)
  const TREE_X0 = 930, TREE_LX = 1480;
  const LEAVES = [['s4-t1', 300], ['s4-t2', 390], ['s4-t3', 480], ['s4-t4', 570], ['s4-t5', 660], ['s4-t6', 750]];
  const NODES = { n5: [1390, 705, 's4-t5', 's4-t6'], n4: [1300, 637.5, 's4-t4', 'n5'], n3: [1210, 558.75, 's4-t3', 'n4'], n2: [1120, 474.4, 's4-t2', 'n3'], n1: [990, 387.2, 's4-t1', 'n2'] };
  const DEER_PATH = new Set(['n1', 'n2', 'n3', 'n4', 's4-t4']);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sat = (v) => clamp(v, 0, 1);
  const smooth = (a, b, x) => { const u = sat((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  const inOut = (x) => 0.5 - 0.5 * Math.cos(Math.PI * sat(x));
  const p2out = (x) => 1 - (1 - sat(x)) * (1 - sat(x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const gauss = (u, v) => Math.sqrt(-2 * Math.log(u * 0.9998 + 1e-4)) * Math.cos(6.2831853 * v);
  const wrapPi = (a) => a - 6.2831853 * Math.round(a / 6.2831853);

  // ---------- regeneration branches (screen px, base at the bottom) ----------
  const SEG = [
    { p: -1, s: 0, P: [[TX - 40, 840], [TX - 70, 600], [TX - 20, 370]] },   // main beam
    { p: 0, s: 0.24, P: [null, [TX - 130, 690], [TX - 200, 610]] },        // brow tine
    { p: 0, s: 0.58, P: [null, [TX + 50, 540], [TX + 110, 470]] },         // trez tine
    { p: 0, s: 1, P: [null, [TX - 50, 300], [TX - 110, 225]] },            // top fork
    { p: 0, s: 1, P: [null, [TX + 20, 300], [TX + 70, 215]] },
    { p: 1, s: 0.55, P: [null, [TX - 200, 690], [TX - 250, 700]] }         // small brow offshoot
  ];
  const POOL = [TX - 40, 858];
  const bez = (P, u) => { const v = 1 - u; return [v * v * P[0][0] + 2 * v * u * P[1][0] + u * u * P[2][0], v * v * P[0][1] + 2 * v * u * P[1][1] + u * u * P[2][1]]; };
  function buildTree() {
    for (const g of SEG) {
      if (g.p >= 0) g.P[0] = segAt(SEG[g.p], g.s * SEG[g.p].len);
      const tab = [0];
      let prev = bez(g.P, 0), L = 0;
      for (let i = 1; i <= 64; i++) { const q = bez(g.P, i / 64); L += Math.hypot(q[0] - prev[0], q[1] - prev[1]); tab.push(L); prev = q; }
      g.tab = tab; g.len = L;
      g.L0 = g.p < 0 ? 0 : SEG[g.p].L0 + g.s * SEG[g.p].len;
      g.chain = g.p < 0 ? [g] : SEG[g.p].chain.filter((a) => a.L0 < g.L0).concat([g]);
    }
  }
  function segAt(g, l) { // point and unit tangent at arc length l along one segment
    l = clamp(l, 0, g.len);
    let i = 1;
    while (i < 64 && g.tab[i] < l) i++;
    const u = (i - 1 + (l - g.tab[i - 1]) / Math.max(1e-6, g.tab[i] - g.tab[i - 1])) / 64;
    const a = bez(g.P, u), b = bez(g.P, Math.min(1, u + 0.01)), c = bez(g.P, Math.max(0, u - 0.01));
    const dx = b[0] - c[0], dy = b[1] - c[1], n = Math.hypot(dx, dy) || 1;
    a.push(dx / n, dy / n);
    return a;
  }
  function chainAt(g, d) { // point at distance d from the base along the path root → g
    let s = g.chain[0];
    for (const a of g.chain) if (d >= a.L0) s = a;
    return segAt(s, d - s.L0);
  }
  let LMAX = 0;

  // ---------- state ----------
  let renderer, scene, cam, pts, posA, colA, szA, glowMesh = [], fieldMat, peakTex;
  const jr = {};
  let root, txt = {}, cards = [], copy = [], active = false, lastProbe = null, LIT = [];
  const P = {}; // per-particle constants

  const entryTime = (v) => (typeof v === 'string' ? K[v] : v);
  function copyAlpha(id, t) {
    const c = copy.find((e) => e.id === id);
    if (!c) return 0;
    const a = entryTime(c.in), b = entryTime(c.out);
    return smooth(a, a + 0.35, t) * (1 - smooth(b - 0.35, b, t));
  }
  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    parent.appendChild(e);
    return e;
  }

  const quadVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const fieldFS = `
    uniform vec2 uC; uniform float uR, uBlue, uRet, uPeak, uPeakRev, uSeed, uWarm; uniform sampler2D tPeak;
    varying vec2 vUv;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
    void main(){
      vec2 px = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
      vec2 d = px - uC; float r = length(d);
      vec3 base = vec3(0.039, 0.043, 0.051);
      vec3 blue = vec3(0.373, 0.722, 0.902);
      vec3 tint = mix(blue, vec3(0.80, 0.60, 0.34), uWarm);
      float inside = 1.0 - smoothstep(uR - 6.0, uR + 6.0, r);
      vec3 c = base * mix(0.55, 1.0, max(inside, 1.0 - uBlue));
      c += tint * uBlue * inside * (0.035 + 0.05 * pow(1.0 - clamp(r / max(uR, 1.0), 0.0, 1.0), 1.5));
      // aperture rim, graduation ticks and a broken crosshair
      float rim = exp(-pow((r - uR) / 1.6, 2.0));
      float ang = atan(d.y, d.x) / 6.2831853 * 120.0;
      float tk = 1.0 - smoothstep(0.0, 0.06, abs(fract(ang + 0.5) - 0.5));
      float big = 1.0 - smoothstep(0.0, 0.018, abs(fract(ang / 5.0 + 0.5) - 0.5));
      float tickLen = mix(10.0, 22.0, big);
      float ticks = max(tk, big) * step(uR - tickLen, r) * step(r, uR - 3.0);
      float cross = (1.0 - smoothstep(0.6, 1.4, min(abs(d.x), abs(d.y)))) * step(60.0, r) * step(r, uR - 40.0);
      c += tint * uBlue * uRet * (0.55 * rim + 0.35 * ticks + 0.10 * cross);
      // proteome trace (back layer)
      vec2 pu = vec2((px.x - 160.0) / 1600.0, (px.y - 260.0) / 600.0);
      if (pu.x > 0.0 && pu.x < uPeakRev && pu.y > 0.0 && pu.y < 1.0) c += blue * uPeak * inside * texture2D(tPeak, vec2(pu.x, 1.0 - pu.y)).r * 0.4;
      c += (h21(px) - 0.5) * 0.018;
      gl_FragColor = vec4(c, 1.0);
    }`;
  const ptVS = `
    attribute vec3 col; attribute float sz; varying vec3 vC;
    void main(){ vC = col; gl_PointSize = sz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const ptFS = `
    varying vec3 vC;
    void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard;
      gl_FragColor = vec4(vC * (exp(-r2 * 5.0) - 0.0067), 1.0); }`;
  const glowFS = `
    uniform vec3 uCol; uniform float uA, uCore; varying vec2 vUv;
    void main(){ float r = length(vUv - 0.5) * 2.0; if (r > 1.0) discard;
      float g = exp(-r * r * 5.0) * (1.0 - r) + uCore * exp(-r * r * 90.0);
      gl_FragColor = vec4(uCol * g * uA, 1.0); }`;
  const glowVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

  function makePeaks() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 256);
    const pk = [];
    for (let i = 0; i < 90; i++) pk.push([hash(i * 3.1) * 1024, Math.pow(hash(i * 7.7), 3.2) * 0.92 + 0.04, 1.2 + hash(i * 5.3) * 2.2]);
    x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath();
    for (let px = 0; px <= 1024; px++) {
      let y = 0.015 + 0.01 * Math.sin(px * 0.21);
      for (const [c0, h, w] of pk) y += h * Math.exp(-Math.pow((px - c0) / w, 2));
      const yy = 250 - Math.min(1, y) * 236;
      px ? x.lineTo(px, yy) : x.moveTo(px, yy);
    }
    x.stroke();
    x.globalAlpha = 0.5; x.fillRect(0, 250, 1024, 1.5);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    return t;
  }

  function initParticles() {
    const f = (k) => new Float32Array(N);
    for (const k of ['dust', 'bx', 'by', 'node', 'ra', 'rj', 'ox', 'oy', 'dx', 'dy', 'seg', 'ls', 'lag', 'jit', 'hy', 'hk', 'hr', 'st', 'sp', 'ph']) P[k] = f(k);
    const segW = SEG.map((g) => g.len), segSum = segW.reduce((a, b) => a + b, 0);
    for (let i = 0; i < N; i++) {
      const r = (j) => hash(i * 17.13 + j * 3.71 + 0.5);
      P.dust[i] = r(0) < 0.16 ? 1 : 0;
      P.bx[i] = gauss(r(1), r(2)) * 30; P.by[i] = gauss(r(3), r(2) + 0.25) * 24;
      P.node[i] = r(4) < 0.56 ? Math.floor(r(5) * 6) : -1;
      P.ra[i] = r(5) * 6.2831853; P.rj[i] = gauss(r(6), r(7)) * (P.node[i] >= 0 ? 13 : 3.5);
      P.ox[i] = gauss(r(8), r(9)) * 13; P.oy[i] = gauss(r(10), r(11)) * 13;
      const dr = FIELD_R * 0.95 * Math.sqrt(r(12)), da = r(13) * 6.2831853;
      P.dx[i] = CX + dr * Math.cos(da); P.dy[i] = CY + dr * Math.sin(da);
      let w = r(14) * segSum, s = 0;
      while (s < SEG.length - 1 && w > segW[s]) { w -= segW[s]; s++; }
      P.seg[i] = s; P.ls[i] = SEG[s].L0 + w;
      P.lag[i] = r(15) * 60; P.jit[i] = gauss(r(16), r(17));
      P.st[i] = r(18); P.sp[i] = r(19); P.ph[i] = r(20) * 6.2831853;
    }
    // helix slots follow each particle's settled branch height so branches slide sideways into the helix
    for (let i = 0; i < N; i++) {
      const q = chainAt(SEG[P.seg[i]], P.ls[i]);
      P.hy[i] = clamp(HY0 + (q[1] - 215) / (858 - 215) * (HY1 - HY0) + P.jit[i] * 6, HY0, HY1);
      const rung = P.st[i] < 0.28;
      P.hk[i] = rung ? 2 : q[0] < TX - 30 ? 0 : 1;
      if (rung) P.hy[i] = HY0 + Math.round((P.hy[i] - HY0) / 22) * 22;
      P.hr[i] = rung ? P.sp[i] : 0;
    }
  }

  async function init(stage, copyEntries) {
    if (init.p) return init.p;
    init.p = (async () => {
      copy = copyEntries.filter((e) => e.scene === 4 && e.status !== 'pending');
      LIT = COMPS.map((id) => { const c = copy.find((e) => e.id === id); return c ? entryTime(c.in) : Infinity; });
      root = document.createElement('div'); root.id = 's4';
      stage.insertBefore(root, stage.firstChild);
      const canvas = document.createElement('canvas'); canvas.id = 's4-gl'; canvas.width = W; canvas.height = H; root.appendChild(canvas);
      for (const id of COMPS) { const c = copy.find((e) => e.id === id); if (c) { txt[id] = el('div', 'copy s4-comp', root, c.text); txt[id].dataset.copy = id; } }
      CARDS.forEach((ids, n) => {
        const card = el('div', 'card', root);
        cards[n] = card;
        ids.forEach((id, j) => { const c = copy.find((e) => e.id === id); if (c) { txt[id] = el('div', 'copy ' + 'ktco'[j], card, c.text); txt[id].dataset.copy = id; } });
      });
      jr.box = el('div', 's4-j', root);
      jr.cover = el('div', 's4-cover', jr.box);
      const img = document.createElement('img'); img.src = 'assets/refs/science-2019-ruminant.webp'; img.alt = ''; jr.cover.appendChild(img);
      el('div', 's4-glint', jr.cover);
      const NS = 'http://www.w3.org/2000/svg';
      jr.svg = document.createElementNS(NS, 'svg'); jr.svg.setAttribute('viewBox', `0 0 ${W} ${H}`); jr.svg.setAttribute('class', 's4-tree'); jr.box.appendChild(jr.svg);
      const yOf = (k) => (NODES[k] ? NODES[k][1] : LEAVES.find((l) => l[0] === k)[1]);
      const xOf = (k) => (NODES[k] ? NODES[k][0] : TREE_LX);
      const seg = (d, x0, gold) => { const pth = document.createElementNS(NS, 'path'); pth.setAttribute('d', d); pth.setAttribute('pathLength', '1'); pth.setAttribute('class', gold ? 'gold' : ''); jr.svg.appendChild(pth); jr.segs.push({ el: pth, x0 }); };
      jr.segs = [];
      seg(`M${TREE_X0} ${NODES.n1[1]}H${NODES.n1[0]}`, TREE_X0, true);
      for (const k in NODES) {
        const [x, , a, b] = NODES[k];
        for (const c of [a, b]) seg(`M${x} ${(NODES[k][1]).toFixed(1)}V${yOf(c).toFixed(1)}H${xOf(c)}`, x, DEER_PATH.has(k) && DEER_PATH.has(c));
      }
      jr.labs = LEAVES.map(([id, y]) => { const c = copy.find((e) => e.id === id); const d = el('div', 'copy s4-leaf' + (id === 's4-t4' ? ' deer' : ''), jr.box, c ? c.text : ''); d.style.transform = `translate(${TREE_LX + 22}px,${y}px) translateY(-50%)`; return d; });
      jr.dot = document.createElementNS(NS, 'circle'); jr.dot.setAttribute('class', 'dot'); jr.dot.setAttribute('cx', TREE_LX); jr.dot.setAttribute('cy', 570); jr.dot.setAttribute('r', 7); jr.svg.appendChild(jr.dot);
      for (const id of ['s4-j-k', 's4-j-cap']) { const c = copy.find((e) => e.id === id); if (c) { txt[id] = el('div', 'copy ' + id, id === 's4-j-k' ? jr.box : root, c.text); txt[id].dataset.copy = id; } }
      await img.decode().catch(() => {});
      const sc = copy.find((e) => e.id === 's4-sub');
      if (sc) { txt['s4-sub'] = el('div', 'copy s4-sub', root, sc.text); txt['s4-sub'].dataset.copy = 's4-sub'; }
      root.style.display = 'none';

      buildTree();
      LMAX = Math.max(...SEG.map((g) => g.L0 + g.len));
      initParticles();

      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(W, H, false);
      scene = new THREE.Scene();
      cam = new THREE.OrthographicCamera(0, W, 0, H, -10, 10);
      peakTex = makePeaks();
      fieldMat = new THREE.ShaderMaterial({
        uniforms: { uC: { value: new THREE.Vector2(CX, CY) }, uR: { value: 0 }, uBlue: { value: 0 }, uRet: { value: 0 }, uPeak: { value: 0 }, uPeakRev: { value: 0 },
          uSeed: { value: 0 }, uWarm: { value: 0 }, tPeak: { value: peakTex } },
        vertexShader: quadVS, fragmentShader: fieldFS, depthTest: false, depthWrite: false
      });
      const fq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fieldMat); fq.frustumCulled = false; fq.renderOrder = 0; scene.add(fq);

      const g = new THREE.BufferGeometry();
      posA = new Float32Array(N * 3); colA = new Float32Array(N * 3); szA = new Float32Array(N);
      g.setAttribute('position', new THREE.BufferAttribute(posA, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('col', new THREE.BufferAttribute(colA, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('sz', new THREE.BufferAttribute(szA, 1).setUsage(THREE.DynamicDrawUsage));
      pts = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: ptVS, fragmentShader: ptFS, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true }));
      pts.frustumCulled = false; pts.renderOrder = 1; scene.add(pts);

      const pg = new THREE.PlaneGeometry(1, 1);
      for (let i = 0; i < 20; i++) {
        const m = new THREE.Mesh(pg, new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color() }, uA: { value: 0 }, uCore: { value: 0 } },
          vertexShader: glowVS, fragmentShader: glowFS, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide }));
        m.frustumCulled = false; m.renderOrder = 2; m.visible = false; scene.add(m); glowMesh.push(m);
      }
      renderer.compile(scene, cam);
    })();
    return init.p;
  }

  // ---------- per-frame evaluation ----------
  const mixc = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  function ringPos(i, t) {
    const rot = 0.06 * (t - T0), k = P.node[i];
    if (k >= 0) {
      const a = -Math.PI / 2 + k * Math.PI / 3 + rot, br = 1 + 0.08 * Math.sin(2 * t + P.ph[i]);
      return [CX + RING_R * Math.cos(a) + P.ox[i] * br, CY + RING_R * Math.sin(a) + P.oy[i] * br];
    }
    const a = P.ra[i] + rot + 0.05 * (t - T0) * (P.sp[i] - 0.5), r = RING_R + P.rj[i];
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  }
  const nodePos = (k, t) => { const a = -Math.PI / 2 + k * Math.PI / 3 + 0.06 * (t - T0); return [CX + RING_R * Math.cos(a), CY + RING_R * Math.sin(a), Math.cos(a)]; };
  const dustPos = (i, t) => [P.dx[i] + 18 * Math.sin(0.3 * t + P.ph[i]), P.dy[i] + 14 * Math.cos(0.23 * t + P.ph[i] * 1.7)];
  const front = (t) => LMAX * 1.05 * (1 - Math.pow(1 - sat((t - (K.ref1 + 0.45)) / 3.0), 1.7));
  function treePos(i, t) { // returns [x, y, riding]
    const d = front(t) - P.lag[i];
    if (d <= 0) return [POOL[0] + P.ox[i] * 1.7 + 4 * Math.sin(1.7 * t + P.ph[i]), POOL[1] + P.oy[i] * 0.7 + 3 * Math.cos(1.3 * t + P.ph[i]), 0];
    const l = Math.min(d, P.ls[i]), q = chainAt(SEG[P.seg[i]], l), w = lerp(6.5, 1.6, l / LMAX) * P.jit[i];
    return [q[0] - q[3] * w, q[1] + q[2] * w, d < P.ls[i] ? 1 : 0];
  }
  const helixPhase = (y, t) => 6.2831853 * H_TURNS * (y - HY0) / (HY1 - HY0) + 1.1 * (t - K.ref2);
  function helixPos(i, t) { // [x, y, depth 0..1]
    const y = P.hy[i], ph = helixPhase(y, t), k = P.hk[i];
    if (k < 2) { const a = ph + k * Math.PI; return [TX + H_R * Math.sin(a), y, 0.5 + 0.5 * Math.cos(a)]; }
    const xa = TX + H_R * Math.sin(ph), xb = TX - H_R * Math.sin(ph), za = 0.5 + 0.5 * Math.cos(ph);
    return [lerp(xa, xb, P.hr[i]), y, lerp(za, 1 - za, P.hr[i])];
  }
  const scanY = (t) => lerp(HY0, HY1, inOut((t - (K.ref2 + 0.9)) / (K.converge - K.ref2 - 1.1)));

  function render(t) {
    if (!renderer || !active) return;
    const tc = clamp(t, T0, END - 1e-4);
    const warm = smooth(K.converge + 0.75, END - 0.45, tc);
    const curLit = LIT.reduce((n, a, k) => (tc >= a ? k : n), -1);
    const helixOn = tc >= K.ref2, front0 = front(tc), sy = scanY(tc);
    const fade1 = 1 - smooth(T0 + 0.05, T0 + 0.35, tc); // gold → blue switch of the sample

    for (let i = 0; i < N; i++) {
      const dust = P.dust[i] > 0;
      // stage 1: sample bursts into ring / dust
      const k1 = inOut((tc - (T0 + 0.3 + P.st[i] * 0.45)) / 1.15);
      const sx = CX + P.bx[i], sy0 = CY + P.by[i];
      let q = dust ? dustPos(i, tc) : ringPos(i, tc);
      if (k1 < 1) {
        const r0 = Math.hypot(P.bx[i], P.by[i]), a0 = Math.atan2(P.by[i], P.bx[i]);
        const r1 = Math.hypot(q[0] - CX, q[1] - CY), a1 = Math.atan2(q[1] - CY, q[0] - CX);
        const r = lerp(r0, r1, k1), a = a0 + wrapPi(a1 - a0) * k1 - 0.7 * Math.sin(Math.PI * k1);
        q = [CX + r * Math.cos(a), CY + r * Math.sin(a)];
        if (k1 <= 0) q = [sx, sy0];
      }
      let x = q[0], y = q[1], bright, size, col = BLUE, hl = 0;
      if (dust) { bright = 0.16; size = 3; }
      else {
        const nk = P.node[i];
        bright = nk < 0 ? 0.30 : nk === curLit ? 0.95 : tc >= LIT[nk] ? 0.42 : 0.24;
        hl = nk >= 0 && nk === curLit ? 0.55 * (1 - smooth(K.ref1 - 0.2, K.ref1 + 0.3, tc)) : 0;
        size = nk >= 0 ? 5 : 4;
      }
      if (k1 < 1) { bright = lerp(0.9, bright, k1); hl = Math.max(hl, 0.7 * (1 - k1)); size = lerp(5, size, k1); }
      // stage 2: the ring dissolves into faint drifting dust behind the journal
      if (!dust && tc >= K.ref1) {
        const k2 = inOut((tc - (K.ref1 + P.st[i] * 0.4)) / 0.9);
        const wx = 120 + 1680 * hash(i * 3.31 + 0.7) + 30 * Math.sin(0.25 * tc + P.ph[i]), wy = 90 + 900 * hash(i * 7.13 + 0.3) + 22 * Math.cos(0.2 * tc + P.ph[i]);
        x = lerp(x, wx, k2); y = lerp(y, wy, k2);
        bright = lerp(bright, 0.1 + 0.08 * P.sp[i], k2); hl = lerp(hl, 0, k2); size = lerp(size, 2.6 + 1.6 * P.sp[i], k2);
      }
      // stage 3: branches → double helix
      if (!dust && helixOn) {
        const k3 = inOut((tc - (K.ref2 + P.st[i] * 0.5)) / 0.9), hp = helixPos(i, tc);
        x = lerp(x, hp[0], k3); y = lerp(y, hp[1], k3) - 40 * Math.sin(Math.PI * k3) * (P.sp[i] - 0.5);
        const sc = Math.exp(-Math.pow((hp[1] - sy) / 16, 2)) * (1 - smooth(K.converge - 0.3, K.converge + 0.2, tc));
        bright = lerp(bright, (0.28 + 0.5 * hp[2]) * (P.hk[i] === 2 ? 0.75 : 1) + 0.6 * sc, k3);
        hl = lerp(hl, 0.7 * sc, k3);
        size = lerp(size, (3.2 + 2.4 * hp[2]) * (P.hk[i] === 2 ? 0.85 : 1) + 1.5 * sc, k3);
      }
      // stage 4: everything spirals into one point, blue → gold
      if (tc >= K.converge) {
        const k4 = inOut((tc - (K.converge + 0.15 + P.st[i] * 0.7)) / 1.1);
        const r = Math.hypot(x - CX, y - CY) * (1 - k4), a = Math.atan2(y - CY, x - CX) + 1.6 * k4;
        x = CX + r * Math.cos(a); y = CY + r * Math.sin(a);
        bright *= lerp(1, 0.12, k4) * (1 - smooth(END - 0.5, END - 0.2, tc) * 0.8);
        size = lerp(size, 3, k4);
      }
      if (fade1 > 0) col = mixc(BLUE, GOLD_G, fade1);
      if (warm > 0) col = mixc(col, GOLD_G, warm);
      const hc = mixc(col, warm > 0.5 ? GOLD : ICE, hl);
      posA[i * 3] = x; posA[i * 3 + 1] = y; posA[i * 3 + 2] = 0;
      colA[i * 3] = hc[0] * bright; colA[i * 3 + 1] = hc[1] * bright; colA[i * 3 + 2] = hc[2] * bright;
      szA[i] = size;
    }
    const geo = pts.geometry;
    geo.attributes.position.needsUpdate = true; geo.attributes.col.needsUpdate = true; geo.attributes.sz.needsUpdate = true;

    // glow sprites
    let gi = 0, focus = [CX, CY];
    const glow = (x, y, d, c, a, core) => {
      const m = glowMesh[gi++];
      if (!m || a <= 0.002) { if (m) m.visible = false; return; }
      m.visible = true; m.position.set(x, y, 0); m.scale.set(d, d, 1);
      m.material.uniforms.uCol.value.setRGB(c[0], c[1], c[2]); m.material.uniforms.uA.value = a; m.material.uniforms.uCore.value = core || 0;
    };
    const sampleA = 1 - smooth(T0 + 0.35, T0 + 1.5, tc);
    const sc = mixc(BLUE, GOLD_G, fade1);
    glow(CX, CY, 520, sc, 0.85 * sampleA, 0);
    glow(CX, CY, 150, mixc(ICE, GOLD, fade1), 1.1 * sampleA, 1.2);
    for (let k = 0; k < 6; k++) {
      const n = nodePos(k, tc), next = k < 5 ? LIT[k + 1] : K.ref1;
      const a = smooth(LIT[k], LIT[k] + 0.15, tc) * (1 - smooth(next, next + 0.25, tc));
      glow(n[0], n[1], 230, BLUE, 0.75 * a, 0.5);
      if (k === curLit && tc < K.ref1) focus = [n[0], n[1]];
    }
    const treeOn = 0;
    glow(POOL[0], POOL[1], 170, BLUE, 0.5 * treeOn * (1 - smooth(K.ref1 + 1.5, K.ref1 + 3.4, tc)), 0.3);
    for (const g of SEG) {
      const d = front0 - 20;
      const grow = d > g.L0 && d < g.L0 + g.len + 30 ? 1 : 0;
      const q = chainAt(g, clamp(d, g.L0, g.L0 + g.len));
      glow(q[0], q[1], 130, ICE, 0.55 * treeOn * grow, 0.4);
    }
    if (tc >= K.ref1 && tc < K.converge) focus = [1200, 540];
    const scanA = smooth(K.ref2 + 0.9, K.ref2 + 1.2, tc) * (1 - smooth(K.converge - 0.3, K.converge + 0.2, tc));
    glow(TX, sy, 300, BLUE, 0.45 * scanA, 0.2);
    if (tc >= K.ref2 && tc < K.converge) focus = [TX, sy];
    const fin = smooth(K.converge + 0.6, END - 0.35, tc);
    const fc = mixc(BLUE, GOLD_G, warm);
    glow(CX, CY, lerp(120, 230, fin), fc, 0.9 * fin, 0);
    glow(CX, CY, 60, mixc(ICE, GOLD, warm), 1.2 * fin, 1.4);
    if (tc >= K.converge) focus = [CX, CY];
    else if (tc < LIT[0]) focus = [CX, CY];
    for (; gi < glowMesh.length;) glow(0, 0, 0, BLUE, 0);

    // microscope field
    const u = fieldMat.uniforms;
    u.uR.value = FIELD_R * p2out((tc - T0) / 0.9) * (1 - inOut((tc - (K.converge + 1.0)) / 0.9) * 0.88);
    const jFade = 1 - smooth(K.journal - 0.1, K.journal + 0.7, tc);
    u.uBlue.value = smooth(T0, T0 + 0.35, tc) * jFade;
    u.uRet.value = smooth(T0 + 0.4, T0 + 1.1, tc) * jFade;
    u.uPeakRev.value = sat((tc - (K.ref2 + 0.35)) / 0.7);
    u.uPeak.value = smooth(K.ref2 + 0.35, K.ref2 + 0.7, tc) * (1 - smooth(K.ref2 + 1.6, K.ref2 + 2.6, tc));
    u.uWarm.value = warm;
    u.uSeed.value = (Math.floor(tc * FPS) % 97) * 0.37;
    renderer.render(scene, cam);

    // ---- copy ----
    COMPS.forEach((id, k) => {
      if (!txt[id]) return;
      const n = nodePos(k, tc), a = copyAlpha(id, tc) * (k === curLit ? 1 : 0.42);
      const lx = n[0] + (n[2] >= 0 ? 1 : -1) * 64 * Math.abs(n[2]) , ly = n[1] + (k === 0 ? -58 : k === 3 ? 58 : 0);
      const ax = Math.abs(n[2]) < 0.2 ? '-50%' : n[2] > 0 ? '0' : '-100%';
      txt[id].style.transform = `translate(${lx.toFixed(1)}px,${ly.toFixed(1)}px) translate(${ax},-50%)`;
      txt[id].style.opacity = a.toFixed(3);
      txt[id].classList.toggle('on', k === curLit);
    });
    const cardA = [];
    CARDS.forEach((ids, n) => {
      const c = copy.find((e) => e.id === ids[1]);
      if (!c || !cards[n]) return cardA.push(0);
      const a = entryTime(c.in), b = entryTime(c.out), ai = smooth(a, a + 0.5, tc), ao = smooth(b - 0.35, b, tc);
      cards[n].style.opacity = (ai * (1 - ao)).toFixed(3);
      cards[n].style.transform = `translateX(${(90 * (1 - p2out((tc - a) / 0.5)) + (n ? 70 : -50) * ao).toFixed(1)}px)`;
      cardA.push(+(ai * (1 - ao)).toFixed(3));
    });
    if (txt['s4-sub']) txt['s4-sub'].style.opacity = copyAlpha('s4-sub', tc).toFixed(3);
    // journal: cover slides in, tree draws root → leaves, the deer lineage in gold
    const J = K.journal, jOut = 1 - smooth(K.converge - 0.1, K.converge + 0.5, tc);
    const cIn = p2out((tc - J - 0.1) / 0.8);
    jr.cover.style.opacity = (smooth(J + 0.1, J + 0.6, tc) * jOut).toFixed(3);
    jr.cover.style.transform = `translate(${(-60 * (1 - cIn)).toFixed(1)}px,0) perspective(1600px) rotateY(${(14 * (1 - cIn) + 6).toFixed(2)}deg) scale(${lerp(1, 0.96, smooth(K.converge - 0.4, K.converge + 0.5, tc)).toFixed(4)})`;
    jr.cover.style.setProperty('--g', sat((tc - J - 0.7) / 0.9).toFixed(3));
    const TD0 = J + 0.7, TD = 1.7;
    for (const sg of jr.segs) {
      const k = sat((tc - TD0 - (sg.x0 - TREE_X0) / (TREE_LX - TREE_X0) * TD) / 0.4);
      sg.el.style.strokeDashoffset = (1 - k).toFixed(4); sg.el.style.opacity = jOut.toFixed(3);
    }
    jr.labs.forEach((d, i) => { d.style.opacity = (smooth(TD0 + TD + 0.1 + 0.08 * i, TD0 + TD + 0.45 + 0.08 * i, tc) * jOut).toFixed(3); });
    const dotA = smooth(TD0 + TD + 0.5, TD0 + TD + 0.8, tc) * jOut;
    jr.dot.style.opacity = dotA.toFixed(3); jr.dot.setAttribute('r', (7 + 3 * Math.sin(5 * tc)).toFixed(2));
    if (txt['s4-j-k']) txt['s4-j-k'].style.opacity = (smooth(J + 0.6, J + 1.0, tc) * jOut).toFixed(3);
    if (txt['s4-j-cap']) txt['s4-j-cap'].style.opacity = copyAlpha('s4-j-cap', tc).toFixed(3);

    lastProbe = {
      phase: tc < LIT[0] ? 'sample' : tc < K.ref1 ? 'ring' : tc < K.ref2 ? 'branches' : tc < K.converge ? 'helix' : 'converge',
      focus: { x: +focus[0].toFixed(1), y: +focus[1].toFixed(1) }, lit: curLit, front: +(front0 / LMAX).toFixed(3), scanY: +sy.toFixed(1),
      warm: +warm.toFixed(3), field: +u.uR.value.toFixed(1), cards: cardA
    };
  }

  function setActive(v) {
    active = v;
    if (root) root.style.display = v ? '' : 'none';
  }
  window.FILM_SCENES = window.FILM_SCENES || {};
  window.FILM_SCENES[4] = { init, render, setActive, probe: () => lastProbe };
})();
