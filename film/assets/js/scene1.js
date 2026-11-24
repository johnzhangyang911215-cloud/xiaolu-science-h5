/* Scene 1 · 序 · 定位双阳 (V2, docs/12-v2-revision.md). Opening line over a dim globe, then three pushes onto 双阳 while
   a HUD crosshair (43°31′N meridian/parallel + reticle + read-out) locks at `lock`; the dive into the clouds hands over to scene 2.
   Pure function of time: render(t) sets every uniform, camera and overlay from cue names, so any frame
   reproduces exactly under seek/export. (The plan suggests a paused GSAP timeline seeked by local time;
   a closed-form render(t) is equivalent and avoids timeline state.) Units: Earth radius = 1. */
(function () {
  const F = window.FILM, THREE = window.THREE;
  const FPS = F.fps, W = 1920, H = 1080, D2R = Math.PI / 180;
  // Cue time quantised to its frame, so local time is exactly 0 on the cue frame.
  const K = {};
  for (const k in F.cueFrames) K[k] = F.cueFrames[k] / FPS;
  const P1 = K.locate, P3 = K.lock, P2 = (P1 + P3) / 2; // three pushes, one per half bar
  const DIVE = K.lock + 1.0;                             // crosshair holds ~1 s, then the dive into scene 2

  const POINT = { lon: 125.67, lat: 43.52 }; // 长春 · 双阳
  const SUN = { lon: -157.3, lat: -20 };    // winter dawn: terminator ≈ 132.5°E at 43°N, Shuangyang on the night side
  const PATCH = { lon0: 110, lon1: 142, lat0: 33, lat1: 54, nx: 320, ny: 210 };
  const EXAG = 14; // vertical exaggeration of the procedural terrain

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sat = (v) => clamp(v, 0, 1);
  const smooth = (a, b, x) => { const u = sat((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  const expoOut = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
  const inOut = (x) => 0.5 - 0.5 * Math.cos(Math.PI * sat(x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ll = (lon, lat, r = 1) => {
    const a = lon * D2R, b = lat * D2R;
    return new THREE.Vector3(r * Math.cos(b) * Math.cos(a), r * Math.sin(b), -r * Math.cos(b) * Math.sin(a));
  };

  // ---------- procedural relief (km), deterministic ----------
  const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
  }
  function fbm(x, y, o) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
  function ridged(x, y, o) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { const n = 1 - Math.abs(vnoise(x * f, y * f) * 2 - 1); s += a * n * n; f *= 2.1; a *= 0.5; } return s; }
  function segDist(lon, lat, a, b) {
    const c = Math.cos(lat * D2R), px = (lon - a[0]) * c, py = lat - a[1], dx = (b[0] - a[0]) * c, dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy, k = l2 > 0 ? clamp((px * dx + py * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - k * dx, py - k * dy);
  }
  const RANGES = [ // [from, to, width°, peak km]
    [[124.2, 40.3], [131.2, 45.2], 1.3, 1.5],   // 长白山系
    [[128.08, 42.0], [128.08, 42.0], 0.5, 1.2], // 长白山主峰
    [[128.0, 44.0], [129.6, 47.2], 0.9, 0.8],   // 张广才岭
    [[117.5, 42.5], [122.5, 50.5], 1.4, 1.3],   // 大兴安岭
    [[126.5, 47.3], [130.5, 49.5], 1.0, 0.8],   // 小兴安岭
    [[113.0, 35.0], [114.6, 40.0], 1.0, 1.4],   // 太行山
    [[127.6, 38.6], [129.4, 36.0], 0.8, 1.1],   // 太白山脉
    [[125.6, 43.2], [126.3, 43.7], 0.25, 0.25]  // 双阳周边低山
  ];
  function relief(lon, lat, land) {
    if (land <= 0.001) return 0;
    let r = 0;
    for (const [a, b, w, p] of RANGES) { const d = segDist(lon, lat, a, b) / w; r += p * Math.exp(-d * d); }
    const plain = Math.exp(-Math.pow(segDist(lon, lat, [123.0, 43.5], [126.0, 47.0]) / 1.6, 2)); // 松辽平原
    const base = 0.12 + 0.35 * fbm(lon * 0.7, lat * 0.7, 4) * (1 - 0.7 * plain);
    return land * (base + r * (0.45 + 0.75 * ridged(lon * 1.9 + 7.3, lat * 1.9 - 3.1, 5)));
  }

  // ---------- GLSL ----------
  const EARTH_GLSL = `
    uniform sampler2D dayT; uniform sampler2D nightT; uniform sampler2D oceanT;
    uniform vec3 sunDir; uniform vec3 camPos;
    uniform float uTerm; uniform float uNight; uniform float uDay; uniform float uRim; uniform float uLights;
    vec3 earthColor(vec2 uv, vec3 n, vec3 wp) {
      vec3 V = normalize(camPos - wp);
      float d = dot(n, sunDir);
      vec3 day = texture2D(dayT, uv).rgb;
      vec3 lights = texture2D(nightT, uv).rgb;
      float ocean = texture2D(oceanT, uv).r;
      float dayK = smoothstep(-0.06, 0.28, d);
      float nightK = 1.0 - smoothstep(-0.14, 0.03, d);
      vec3 col = day * dayK * 1.05 * uDay;
      col += day * vec3(0.18, 0.26, 0.45) * 0.22 * nightK * uNight;   // moonlit land reads, shadows stay deep
      col += pow(lights, vec3(1.6)) * vec3(1.0, 0.72, 0.45) * 1.2 * nightK * uNight * uLights;
      col += exp(-pow((d + 0.012) / 0.035, 2.0)) * vec3(1.0, 0.52, 0.24) * 0.4 * uTerm;
      vec3 R = reflect(-sunDir, n);
      col += pow(max(dot(R, V), 0.0), 30.0) * ocean * dayK * 0.35 * vec3(1.0, 0.9, 0.75) * uDay;
      float fr = pow(1.0 - max(dot(n, V), 0.0), 3.0);
      col += fr * mix(vec3(0.05, 0.09, 0.2), vec3(0.4, 0.66, 1.0), smoothstep(-0.25, 0.35, d)) * uRim;
      col += fr * exp(-pow(d / 0.12, 2.0)) * vec3(1.0, 0.55, 0.25) * 0.5 * uTerm;
      return col;
    }`;
  const NOISE_GLSL = `
    float h3(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
    float n3(vec3 x) {
      vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
    }`;

  const earthVS = `
    varying vec2 vUv; varying vec3 vN; varying vec3 vW;
    void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w; }`;
  const earthFS = EARTH_GLSL + `
    varying vec2 vUv; varying vec3 vN; varying vec3 vW;
    void main() { gl_FragColor = vec4(earthColor(vUv, normalize(vN), vW), 1.0); }`;

  const terrainVS = `
    attribute float hgt; attribute vec3 rnormal; attribute float edge; attribute float land;
    uniform float uRise;
    varying vec2 vUv; varying vec3 vDir; varying vec3 vN; varying vec3 vW; varying float vEdge; varying float vLand; varying float vH;
    void main() {
      vec3 dir = normalize(position);
      vec3 p = dir * (1.00002 + hgt * uRise);
      vUv = uv; vDir = normalize(mat3(modelMatrix) * dir); vN = normalize(mat3(modelMatrix) * normalize(mix(dir, rnormal, uRise)));
      vEdge = edge; vLand = land; vH = hgt;
      vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
    }`;
  const terrainFS = EARTH_GLSL + NOISE_GLSL + `
    uniform float uAlpha; uniform float uSnow; uniform float uGlow; uniform float uFog;
    uniform vec3 moonDir; uniform vec3 goldPos;
    varying vec2 vUv; varying vec3 vDir; varying vec3 vN; varying vec3 vW; varying float vEdge; varying float vLand; varying float vH;
    void main() {
      vec3 base = earthColor(vUv, vDir, vW);
      float dist = length(camPos - vW);
      // Detail noise; octaves fade out with distance to avoid shimmering.
      vec3 q = vDir;
      // Four noise bands (≈10 km … 40 m); each is weighted by how many of its features fit across the view.
      vec3 pert = vec3(0.0); float det = 0.0, wsum = 0.0;
      for (int k = 0; k < 4; k++) {
        float fk = 600.0 * pow(4.0, float(k));
        float span = fk * dist;
        float w = smoothstep(4.0, 16.0, span) * (1.0 - smoothstep(160.0, 420.0, span));
        vec3 qq = q * fk + float(k) * 17.0;
        float a = n3(qq);
        pert += (vec3(n3(qq + vec3(0.37, 0.0, 0.0)), n3(qq + vec3(0.0, 0.37, 0.0)), n3(qq + vec3(0.0, 0.0, 0.37))) - a) * w;
        det += a * w; wsum += w;
      }
      det = wsum > 0.0 ? det / wsum : 0.5;
      vec3 N = normalize(vN + (pert - vDir * dot(pert, vDir)) * 0.7);
      float slope = 1.0 - dot(N, vDir);
      float forest = smoothstep(0.66, 0.86, det * 0.55 + slope * 5.0 + 0.18) * smoothstep(0.0001, 0.0012, vH) * (1.0 - smoothstep(0.0035, 0.0055, vH));
      vec3 alb = mix(vec3(0.95, 0.955, 0.94), vec3(0.10, 0.11, 0.12), forest * 0.75);
      float lam = max(dot(N, moonDir), 0.0);
      vec3 snow = alb * (vec3(0.55, 0.64, 0.82) * (0.22 + 0.78 * pow(lam, 1.2)) * 0.85 + vec3(0.015, 0.02, 0.035));
      snow = mix(vec3(0.012, 0.018, 0.03) + vec3(0.03, 0.04, 0.06) * det, snow, smoothstep(0.2, 0.6, vLand));
      float g = exp(-length(vW - goldPos) / 0.0022);
      snow += vec3(1.0, 0.68, 0.32) * g * 0.35 * uGlow;
      float fog = 1.0 - exp(-dist / max(uFog, 1e-4));
      snow = mix(snow, vec3(0.05, 0.065, 0.09), fog * 0.85);
      gl_FragColor = vec4(mix(base, snow, uSnow), uAlpha * vEdge);
    }`;

  const atmoVS = `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const atmoFS = `
    uniform vec3 camPos; uniform vec3 sunDir; uniform float uAtmo; uniform float uTerm;
    varying vec3 vW;
    void main() {
      vec3 r = normalize(vW - camPos);
      float tc = max(dot(-camPos, r), 0.0);
      vec3 c = camPos + r * tc;
      float b = length(c);
      if (b < 1.0) discard;
      float k = exp(-(b - 1.0) / 0.022);
      float d = dot(normalize(c), sunDir);
      vec3 col = mix(vec3(0.03, 0.05, 0.12), vec3(0.35, 0.6, 1.0), smoothstep(-0.3, 0.4, d));
      col += vec3(1.0, 0.5, 0.2) * exp(-pow(d / 0.12, 2.0)) * 0.6 * uTerm;
      gl_FragColor = vec4(col * k * uAtmo, 1.0);
    }`;

  const cloudVS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const cloudFS = NOISE_GLSL + `
    uniform float uK; uniform float uT; uniform float uGrain; uniform float uSeed;
    varying vec2 vUv;
    void main() {
      vec2 p = (vUv - 0.5) * vec2(1.7778, 1.0);
      // endless push into the deck: two layers one octave apart, each fading out before it wraps (no pops)
      float c = 0.0, ws = 0.0;
      for (int k = 0; k < 2; k++) {
        float u = uT * 0.7 + float(k) * 0.5, s = fract(u), w = sin(3.14159 * s);
        vec3 q = vec3(p * 2.4 * exp2(1.0 - s) + floor(u) * 7.31, uT * 0.35 + floor(u) * 3.7);
        c += (n3(q) * 0.5 + n3(q * 2.1 + 4.0) * 0.3 + n3(q * 4.3 + 9.0) * 0.2) * w; ws += w;
      }
      c /= ws;
      float grain = h3(vec3(gl_FragCoord.xy, uSeed));
      float a = uK * mix(clamp(0.55 + (c - 0.5) * 1.4 + (grain - 0.5) * 0.35, 0.0, 1.0), 1.0, smoothstep(0.75, 1.0, uK));   // solid at its thickest
      vec3 col = vec3(0.46, 0.48, 0.52) * (0.75 + 0.5 * c) + (grain - 0.5) * 0.18;
      float gr = (grain - 0.5) * uGrain;
      gl_FragColor = vec4(col * a + max(gr, 0.0), a);
    }`;

  // ---------- state ----------
  let renderer, scene, camera, globe, earthMat, terrainMat, atmoMat, cloudMat, cloudScene, cloudCam;
  let root, dot, svg, latPath, latClipRect, lonPath, lonClipRect, reticle, flash, txt = {}, copy = [], landImg = null;
  let active = false, lastProbe = null;
  const sun = ll(SUN.lon, SUN.lat).normalize();
  const Pdir = ll(POINT.lon, POINT.lat);
  const Uv = Pdir.clone();
  const Ev = new THREE.Vector3(-Math.sin(POINT.lon * D2R), 0, -Math.cos(POINT.lon * D2R));
  const Nv = new THREE.Vector3().crossVectors(Uv, Ev);
  const moon = Ev.clone().multiplyScalar(0.55).addScaledVector(Uv, 0.5).addScaledVector(Nv, -0.35).normalize();
  let pointH = 0; // terrain height at the point (units, full rise)

  function landAt(lon, lat) {
    const { data, w, h } = landImg;
    const x = ((lon + 180) / 360) * w - 0.5, y = ((90 - lat) / 180) * h - 0.5;
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const g = (i, j) => data[(clamp(j, 0, h - 1) * w + ((i % w) + w) % w) * 4];
    const o = lerp(lerp(g(xi, yi), g(xi + 1, yi), fx), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), fx), fy) / 255;
    return smooth(0.75, 0.25, o); // ocean is white in the specular map
  }

  function buildTerrain() {
    const { lon0, lon1, lat0, lat1, nx, ny } = PATCH;
    const n = (nx + 1) * (ny + 1);
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), hgt = new Float32Array(n), edge = new Float32Array(n), land = new Float32Array(n);
    const full = new Float32Array(n * 3);
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const k = j * (nx + 1) + i, lon = lerp(lon0, lon1, i / nx), lat = lerp(lat0, lat1, j / ny);
      const ld = landAt(lon, lat), e = relief(lon, lat, ld) / 6371 * EXAG;
      const p = ll(lon, lat);
      pos.set([p.x, p.y, p.z], k * 3);
      full.set([p.x * (1 + e * 4), p.y * (1 + e * 4), p.z * (1 + e * 4)], k * 3);
      uv.set([(lon + 180) / 360, (lat + 90) / 180], k * 2);
      hgt[k] = e; land[k] = ld;
      const fe = Math.min(i, nx - i) / nx, fn = Math.min(j, ny - j) / ny;
      edge[k] = smooth(0, 0.12, fe) * smooth(0, 0.12, fn);
    }
    const idx = new Uint32Array(nx * ny * 6);
    let q = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.set([a, b, d, a, d, c], q); q += 6;
    }
    const gFull = new THREE.BufferGeometry();
    gFull.setAttribute('position', new THREE.BufferAttribute(full, 3));
    gFull.setIndex(new THREE.BufferAttribute(idx, 1));
    gFull.computeVertexNormals();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('hgt', new THREE.BufferAttribute(hgt, 1));
    g.setAttribute('edge', new THREE.BufferAttribute(edge, 1));
    g.setAttribute('land', new THREE.BufferAttribute(land, 1));
    g.setAttribute('rnormal', gFull.getAttribute('normal'));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    pointH = relief(POINT.lon, POINT.lat, landAt(POINT.lon, POINT.lat)) / 6371 * EXAG;
    return g;
  }

  function loadTex(url) {
    return new Promise((res, rej) => new THREE.TextureLoader().load(url, (t) => { t.anisotropy = 8; res(t); }, undefined, () => rej(new Error('texture ' + url))));
  }

  function el(tag, attrs, parent) {
    const ns = tag === 'div' || tag === 'canvas' || tag === 'b' || tag === 'span' ? null : 'http://www.w3.org/2000/svg';
    const e = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  async function init(stage, copyEntries) {
    copy = copyEntries.filter((e) => e.scene === 1 && e.status !== 'pending');
    root = el('div', { id: 's1' }, null);
    stage.insertBefore(root, stage.firstChild);
    const canvas = el('canvas', { id: 's1-gl', width: W, height: H }, root);
    svg = el('svg', { id: 's1-ov', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, root);
    const defs = el('defs', {}, svg), clip = el('clipPath', { id: 's1-latclip' }, defs);
    latClipRect = el('rect', { x: 0, y: 0, width: 0, height: H }, clip);
    const clip2 = el('clipPath', { id: 's1-lonclip' }, defs);
    lonClipRect = el('rect', { x: 0, y: 0, width: W, height: 0 }, clip2);
    latPath = el('path', { class: 'lat', 'clip-path': 'url(#s1-latclip)' }, svg);
    lonPath = el('path', { class: 'lat', 'clip-path': 'url(#s1-lonclip)' }, svg);
    reticle = el('g', { class: 'reticle' }, svg);
    el('circle', { r: 46 }, reticle);
    el('circle', { r: 64, class: 'dash' }, reticle);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2, c = Math.cos(a), s2 = Math.sin(a);
      el('line', { x1: (c * 30).toFixed(1), y1: (s2 * 30).toFixed(1), x2: (c * 78).toFixed(1), y2: (s2 * 78).toFixed(1) }, reticle);
      const b = a + Math.PI / 4, r = 92, k = 14; // corner brackets
      const bx = Math.cos(b) * r, by = Math.sin(b) * r, sx = Math.sign(bx), sy = Math.sign(by);
      el('path', { d: `M${(bx - sx * k).toFixed(1)} ${by.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}L${bx.toFixed(1)} ${(by - sy * k).toFixed(1)}` }, reticle);
    }
    flash = el('circle', { r: 46, class: 'flash' }, svg);
    dot = el('div', { id: 's1-dot' }, root);
    for (const c of copy) {
      txt[c.id] = el('div', { class: 'copy ' + c.id, 'data-copy': c.id }, root);
      const [l1, l2] = c.text.split('\n');
      if (l2 === undefined) txt[c.id].textContent = c.text;
      else { el('b', {}, txt[c.id]).textContent = l1; el('span', {}, txt[c.id]).textContent = l2; }
    }

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x0a0b0d, 1);
    renderer.autoClear = false;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, W / H, 0.01, 20);

    const [dayT, nightT, oceanT] = await Promise.all(['day.jpg', 'lights.jpg', 'ocean.jpg'].map((f) => loadTex('assets/earth/' + f)));
    const cv = document.createElement('canvas'), im = oceanT.image;
    cv.width = im.width; cv.height = im.height;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(im, 0, 0);
    landImg = { data: cx.getImageData(0, 0, cv.width, cv.height).data, w: cv.width, h: cv.height };

    const shared = {
      dayT: { value: dayT }, nightT: { value: nightT }, oceanT: { value: oceanT }, sunDir: { value: sun }, camPos: { value: new THREE.Vector3() },
      uTerm: { value: 0 }, uNight: { value: 0 }, uDay: { value: 0 }, uRim: { value: 0 }, uLights: { value: 1 }
    };
    globe = new THREE.Group();
    scene.add(globe);
    earthMat = new THREE.ShaderMaterial({ uniforms: shared, vertexShader: earthVS, fragmentShader: earthFS });
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 192, 128), earthMat));
    terrainMat = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, shared, {
        uRise: { value: 0 }, uAlpha: { value: 0 }, uSnow: { value: 0 }, uGlow: { value: 0 }, uFog: { value: 1 },
        moonDir: { value: moon }, goldPos: { value: new THREE.Vector3() }
      }),
      vertexShader: terrainVS, fragmentShader: terrainFS, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    const terrain = new THREE.Mesh(buildTerrain(), terrainMat);
    terrain.renderOrder = 1;
    terrain.frustumCulled = false;
    globe.add(terrain);
    atmoMat = new THREE.ShaderMaterial({
      uniforms: { camPos: shared.camPos, sunDir: shared.sunDir, uAtmo: { value: 0 }, uTerm: shared.uTerm },
      vertexShader: atmoVS, fragmentShader: atmoFS, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.08, 128, 64), atmoMat);
    atmo.renderOrder = 2;
    scene.add(atmo);

    cloudScene = new THREE.Scene();
    cloudCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cloudMat = new THREE.ShaderMaterial({
      uniforms: { uK: { value: 0 }, uT: { value: 0 }, uGrain: { value: 0 }, uSeed: { value: 0 } },
      vertexShader: cloudVS, fragmentShader: cloudFS, transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
    });
    cloudScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cloudMat));

    if (document.fonts) {
      const all = copy.map((c) => c.text).join('');
      await Promise.all([document.fonts.load('40px "XL Serif"', all), document.fonts.load('24px "XL Sans"', all)]);
    }
    renderer.compile(scene, camera);
    setActive(false);
  }

  // ---------- timeline (all times from cue names) ----------
  // One continuous push from orbit to the dive (no stops): log-altitude moves at a speed that eases in at P1,
  // is fastest over East Asia, and still carries momentum through the clouds into scene 2.
  const Z0 = P1 - 0.3, Z1 = K.s2, RATIO = 0.0029, ZN = 200, ZT = (() => {
    const v = (x) => smooth(0, 0.14, x) * (0.4 + 1.25 * (1 - x)), a = [0];
    for (let i = 1; i <= ZN; i++) a.push(a[i - 1] + v((i - 0.5) / ZN));
    return a.map((q) => q / a[ZN]);
  })();
  const zoomU = (t) => { const x = sat((t - Z0) / (Z1 - Z0)) * ZN, i = Math.min(ZN - 1, Math.floor(x)); return lerp(ZT[i], ZT[i + 1], x - i); };
  function cameraAt(t) {
    const dist = 5.4 * Math.pow(RATIO, zoomU(t)), h = dist;
    // anchor glides from East Asia onto 双阳 and settles as the crosshair locks
    const ka = inOut((t - Z0) / (P3 + 0.4 - Z0));
    const lon = lerp(108, POINT.lon, ka), lat = lerp(38, POINT.lat, ka), e3 = smooth(P2, P3 + 0.4, t);
    const dv = inOut((t - DIVE) / (K.s2 - DIVE));
    return { h, lon, lat, dist, e3, theta: 60 * D2R * dv, pitch: 3.4 * D2R * dv, dv };
  }

  function placeCamera(c, A) {
    const U = A.clone().normalize();
    const E = new THREE.Vector3(-Math.sin(c.lon * D2R), 0, -Math.cos(c.lon * D2R));
    const N = new THREE.Vector3().crossVectors(U, E);
    const beta = 20 * D2R; // the dive heads north-north-east, along and across the 43° line
    const Hd = N.clone().multiplyScalar(Math.cos(beta)).addScaledVector(E, Math.sin(beta));
    const off = U.clone().multiplyScalar(Math.cos(c.theta)).addScaledVector(Hd, -Math.sin(c.theta)).multiplyScalar(c.dist);
    camera.position.copy(A).add(off);
    const w = smooth(0, 0.6, c.theta);
    camera.up.copy(N).multiplyScalar(1 - w).addScaledVector(U, w).normalize();
    camera.lookAt(A);
    camera.rotateX(-c.pitch);
    camera.near = Math.max(0.0004, c.dist * 0.08);
    camera.far = camera.position.length() + 1.5;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  const tmp = new THREE.Vector3();
  function project(v) {
    const facing = v.dot(tmp.copy(camera.position).sub(v)) > 0;
    tmp.copy(v).project(camera);
    const vis = facing && tmp.z < 1 && tmp.z > -1;
    return { x: (tmp.x + 1) / 2 * W, y: (1 - tmp.y) / 2 * H, vis };
  }
  function pathFor(pts, r) {
    let d = '', pen = false;
    for (const [lon, lat] of pts) {
      const p = project(globe.localToWorld(ll(lon, lat, r)));
      if (!p.vis || Math.abs(p.x) > 6 * W || Math.abs(p.y) > 6 * H) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
      pen = true;
    }
    return d;
  }
  const entryTime = (v) => (typeof v === 'string' ? K[v] : v);
  function copyAlpha(id, t) {
    const c = copy.find((e) => e.id === id);
    if (!c) return 0;
    const a = entryTime(c.in), b = entryTime(c.out);
    return smooth(a, a + 0.35, t) * (1 - smooth(b - 0.35, b, t));
  }

  function render(t) {
    if (!renderer) return;
    const o = K.open;
    const on = t >= o - 1e-6;
    const c = cameraAt(t);
    globe.rotation.y = 1.0 * D2R * (Math.min(t, P1) - P1); // slow spin until the first push, camera still
    globe.updateMatrixWorld(true);

    const rise = expoOut(sat((t - P2) / 1.4));
    const A = globe.localToWorld(ll(c.lon, c.lat, 1 + pointH * rise * c.e3));
    placeCamera(c, A);

    const u = earthMat.uniforms;
    u.camPos.value.copy(camera.position);
    const dim = 0.3 + 0.7 * smooth(P1 - 0.5, P1 + 0.3, t); // globe stays dim under the opening line
    u.uTerm.value = on ? dim * smooth(o, o + 0.9, t) * (1 - 0.8 * smooth(P1 + 0.3, P2 + 0.4, t)) : 0;
    u.uLights.value = 1 - 0.85 * smooth(P2 + 0.2, P3, t);
    u.uNight.value = dim * smooth(o + 0.4, o + 2.0, t);
    u.uDay.value = 1.3 * dim * smooth(o + 0.9, o + 2.8, t);   // a touch brighter on the land, the night side stays deep
    u.uRim.value = 0.5 * smooth(o + 0.3, o + 2.0, t) + 0.5 * smooth(P1, P1 + 0.5, t) * (1 - smooth(P2, P2 + 0.8, t));
    atmoMat.uniforms.uAtmo.value = (0.68 * smooth(o + 0.2, o + 2.0, t) + 0.75 * smooth(P1, P1 + 0.5, t)) * (on ? 1 : 0);

    const gold = globe.localToWorld(ll(POINT.lon, POINT.lat, 1 + pointH * rise + 0.0003));
    const tu = terrainMat.uniforms;
    tu.uRise.value = rise;
    tu.uAlpha.value = smooth(P2, P2 + 0.9, t);
    tu.uSnow.value = smooth(P2 + 0.6, P3 + 0.6, t);
    tu.uGlow.value = smooth(P3, P3 + 1.0, t);
    tu.uFog.value = c.dist * 5 + 0.01;
    tu.goldPos.value.copy(gold);

    const cloudK = 0;
    const endK = smooth(K.s2 - 1.1, K.s2 - 0.05, t);   // fully closed on the cut
    cloudMat.uniforms.uK.value = Math.max(cloudK, endK);
    cloudMat.uniforms.uT.value = t;
    cloudMat.uniforms.uGrain.value = 0.06 + 0.1 * cloudK;
    cloudMat.uniforms.uSeed.value = Math.round(t * FPS) % 97;

    renderer.clear();
    if (on) {
      renderer.render(scene, camera);
      renderer.render(cloudScene, cloudCam);
    }

    // ---- gold point (DOM, always above the clouds) ----
    const gp = project(gold);
    const breath = 1 + 0.07 * Math.sin((t - o) * Math.PI * 2 / 2.4);
    const da = on ? 0.6 + 0.4 * smooth(o, o + 0.3, t) : 0;
    dot.style.transform = `translate(${gp.x.toFixed(2)}px,${gp.y.toFixed(2)}px) scale(${breath.toFixed(4)})`;
    dot.style.opacity = gp.vis ? da.toFixed(3) : '0';

    // ---- HUD crosshair: parallel + meridian through 双阳, reticle and read-out (no region outline) ----
    const hudA = smooth(P1 + 0.25, P1 + 0.6, t) * (1 - smooth(K.s2 - 0.9, K.s2 - 0.4, t));
    const lock = sat((t - P1 - 0.3) / (P3 - P1 - 0.3));        // 0 → 1, exactly 1 on the lock frame
    if (hudA > 0.001) {
      const ptsLat = [], ptsLon = [];
      for (let lon = 90; lon <= 160; lon += 0.25) ptsLat.push([lon, POINT.lat]);
      for (let lat = 15; lat <= 70; lat += 0.25) ptsLon.push([POINT.lon, lat]);
      latPath.setAttribute('d', pathFor(ptsLat, 1.0004));
      lonPath.setAttribute('d', pathFor(ptsLon, 1.0004));
      latClipRect.setAttribute('width', (expoOut(sat((t - P1 - 0.25) / 1.0)) * W).toFixed(1));
      lonClipRect.setAttribute('height', (expoOut(sat((t - P1 - 0.35) / 1.0)) * H).toFixed(1));
    }
    latPath.style.opacity = (hudA * 0.8).toFixed(3);
    lonPath.style.opacity = (hudA * 0.8).toFixed(3);
    // reticle closes in from 3× and turns 90° until the lock, then a single flash ring
    const rs = 1 + 2 * Math.pow(1 - inOut(lock), 2), rr = 90 * (1 - inOut(lock));
    reticle.setAttribute('transform', `translate(${gp.x.toFixed(1)} ${gp.y.toFixed(1)}) rotate(${rr.toFixed(2)}) scale(${rs.toFixed(4)})`);
    reticle.style.opacity = (hudA * (0.35 + 0.65 * lock)).toFixed(3);
    const fl = sat((t - P3) / 0.6);
    flash.setAttribute('transform', `translate(${gp.x.toFixed(1)} ${gp.y.toFixed(1)}) scale(${(1 + 1.6 * expoOut(fl)).toFixed(4)})`);
    flash.style.opacity = (t >= P3 ? (1 - fl) * hudA : 0).toFixed(3);
    // read-outs: digits roll until the lock, then hold the real coordinate
    const roll = (str, k, seed) => k >= 1 ? str : str.replace(/\d/g, (d, i) => String(Math.floor(hash2(i + seed, Math.floor(t * 20)) * 10)));
    const hx = gp.x + 96, hy = gp.y - 70;
    for (const [id, dy, seed] of [['s1-lat', 0, 3], ['s1-lon', 34, 9]]) {
      const e = txt[id]; if (!e) continue;
      const c0 = copy.find((c) => c.id === id);
      e.textContent = roll(c0.text, lock, seed);
      e.style.transform = `translate(${hx.toFixed(1)}px,${(hy + dy).toFixed(1)}px)`;
      e.style.opacity = (hudA * smooth(P1 + 0.4, P1 + 0.7, t)).toFixed(3);
    }
    const placeA = copyAlpha('s1-place', t);
    if (txt['s1-place']) txt['s1-place'].style.opacity = (placeA * smooth(P3 + 0.05, P3 + 0.4, t)).toFixed(3);
    if (txt['s1-open']) {
      const a = copyAlpha('s1-open', t);
      txt['s1-open'].style.opacity = a.toFixed(3);
      txt['s1-open'].style.letterSpacing = (0.3 + 0.08 * sat((t - o) / (P1 - o))).toFixed(4) + 'em';
    }

    lastProbe = {
      dot: { x: +gp.x.toFixed(2), y: +gp.y.toFixed(2), dx: +((gp.x - W / 2) / W).toFixed(4), dy: +((gp.y - H / 2) / H).toFixed(4), visible: gp.vis, opacity: da },
      altitude: +c.dist.toFixed(5), tiltDeg: +(c.theta / D2R).toFixed(2), cloud: +cloudMat.uniforms.uK.value.toFixed(3)
    };
  }

  function setActive(v) {
    active = v;
    if (root) root.style.display = v ? '' : 'none';
  }

  window.FILM_SCENES = window.FILM_SCENES || {};
  window.FILM_SCENES[1] = { init, render, setActive, probe: () => lastProbe };
  window.FILM_LIB = Object.assign(window.FILM_LIB || {}, { NOISE_GLSL }); // shared with scene23.js (cloud break at s2)
})();
