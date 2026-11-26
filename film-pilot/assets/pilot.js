/* AI 分镜试做：s2 → s4（鹿 → 鹿茸 → 蜡片）。
   关键帧为即梦 Seedream 5.5 生图；所有运动、转场、光效与文字由代码驱动，时钟 = bgm.currentTime。
   cue 与文案共用 film/ 的 cues.js 与 copy.json。 */
(function () {
  'use strict';
  const C = window.FILM.cues;
  const FPS = window.FILM.fps;
  const T0 = C.s2, T1 = C.s4;
  const Q = new URLSearchParams(location.search);
  const W = 1920, H = 1080;

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lin = (t, a, b) => clamp((t - a) / (b - a));
  const mix = (a, b, k) => a + (b - a) * k;
  const eIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const eOut = (x) => 1 - Math.pow(1 - x, 3);
  const eIn = (x) => x * x * x;
  const win = (t, a, b, fi = 0.5, fo = 0.5) => Math.min(lin(t, a, a + fi), 1 - lin(t, b - fo, b));
  // Deterministic hash for particles (frames must be reproducible when seeking).
  const rnd = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

  /* ---------------- stage fit ---------------- */
  const stage = document.getElementById('stage');
  const glc = document.getElementById('gl'), fxc = document.getElementById('fx');
  const fx = fxc.getContext('2d');
  let scale = 1;
  function fit() {
    scale = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(-50%,-50%) scale(${scale})`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(Math.min(W, W * scale * dpr)), ph = Math.round(pw * H / W);
    glc.width = pw; glc.height = ph;
    fxc.width = Math.round(pw * 0.75); fxc.height = Math.round(ph * 0.75);
  }
  addEventListener('resize', () => { fit(); dirty = true; if (window.__ready && !playing) render(anchorT); });

  /* ---------------- WebGL2 layer renderer ---------------- */
  const gl = glc.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) { document.getElementById('start').textContent = '当前浏览器不支持 WebGL2'; return; }
  const VS = `#version 300 es
  in vec2 p; out vec2 vUv; void main(){ vUv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uTex; uniform int uMode;
  uniform vec2 uC, uP, uK, uTexel; uniform float uS;
  uniform vec4 uSub;
  uniform float uA, uBlur, uExpo, uDis, uTime, uFrost, uWarm;
  uniform vec2 uDC;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5; } return s; }
  vec2 vor(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8., d2=8.;
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 r=g+vec2(h(i+g),h(i+g+3.7))-f; float d=dot(r,r);
      if(d<d1){ d2=d1; d1=d; } else if(d<d2) d2=d; }
    return vec2(sqrt(d1), sqrt(d2)); }
  void main(){
    vec2 s = vec2(vUv.x, 1.-vUv.y);
    if (uMode == 1) { // frost creeping in from the frame edges
      vec2 q = s*vec2(1.7778,1.);
      float e = min(min(s.x, 1.-s.x)*1.7778, min(s.y, 1.-s.y));
      float n = fbm(q*3.2);
      float front = uFrost*.62;
      float m = smoothstep(front+.04, front-.06, e + (n-.5)*.22);
      vec2 v = vor(q*9. + n*1.6); float crack = smoothstep(.07, 0., v.y-v.x);
      vec2 v2 = vor(q*26.+3.); float fine = smoothstep(.05,0.,v2.y-v2.x);
      float a = m*(.30 + .38*crack + .18*fine + .2*fbm(q*40.));
      a *= uA;
      vec3 c = mix(vec3(.90,.95,1.), vec3(1.), crack);
      o = vec4(c*a, a); return;
    }
    vec2 uv = uC + (s - uP)*uK/uS;
    vec2 tuv = (uv - uSub.xy)/(uSub.zw - uSub.xy);
    float inside = step(0.,tuv.x)*step(tuv.x,1.)*step(0.,tuv.y)*step(tuv.y,1.);
    vec4 c;
    if (uBlur > .01) {
      float r = exp2(uBlur)*.9; vec4 acc = vec4(0.);
      for (int i=0;i<12;i++){ float a = float(i)*2.39996; float rr = sqrt((float(i)+.5)/12.);
        acc += texture(uTex, tuv + vec2(cos(a),sin(a))*rr*r*uTexel, uBlur*.75); }
      c = acc/12.;
    } else c = texture(uTex, tuv);
    c *= inside;
    vec3 col = c.a > 0. ? c.rgb/c.a : vec3(0.);
    col = 1. - (1.-col)*(1.-uExpo);
    col = mix(col, col*vec3(1.04,1.,.93), uWarm);
    float a = c.a*uA;
    vec3 add = vec3(0.); float edge = 0.;
    if (uDis >= 0.) {
      float n = fbm(s*vec2(3.2,1.8) + uTime*.07);
      float v = n*.55 + (1. - distance(s*vec2(1.7778,1.), uDC*vec2(1.7778,1.))*.9)*.45;
      float th = 1.05 - uDis*1.3;
      float m = smoothstep(th-.05, th+.05, v);
      edge = (1.-smoothstep(0.,.06,abs(v-th)))*step(.001,uDis)*step(uDis,.999);
      a *= m; add = vec3(1.,.93,.78)*edge*.9;
    }
    o = vec4(col*a + add, a);
  }`;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  ['uTex', 'uMode', 'uC', 'uP', 'uK', 'uTexel', 'uS', 'uSub', 'uA', 'uBlur', 'uExpo', 'uDis', 'uTime', 'uFrost', 'uWarm', 'uDC']
    .forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // Deer cut-out sits at this rect inside the full K1 frame (from the cut-out alpha bbox).
  const DEER_SUB = [0.50488, 0.32726, 0.76758, 0.82986];
  const IMGS = { forest: 'k1-forest', deer: 'k1-deer', antler: 'k2-antler', velvet: 'k3-velvet', stick: 'k4-antler', wax: 'k5-wax' };
  const TEX = {};
  function loadTex(key, name) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        TEX[key] = { t, w: im.naturalWidth, h: im.naturalHeight };
        res();
      };
      im.onerror = rej; im.src = `assets/img/${name}.webp`;
    });
  }

  // Camera: zoom s about image point c, which sits at screen point p0 (its s=1 position) eased toward centre by `pan`.
  function cam(c, s, pan = 0, off = [0, 0]) {
    return { c, s, p: [mix(c[0], 0.5, pan) + off[0], mix(c[1], 0.5, pan) + off[1]] };
  }
  // Image uv -> design px, for overlays that must stick to the picture.
  const toScreen = (k, uv) => [(k.p[0] + (uv[0] - k.c[0]) * k.s) * W, (k.p[1] + (uv[1] - k.c[1]) * k.s) * H];

  function draw(tex, k, o = {}) {
    const T = TEX[tex]; if (!T) return;
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    gl.uniform1i(U.uMode, 0);
    gl.uniform2f(U.uC, k.c[0], k.c[1]); gl.uniform2f(U.uP, k.p[0], k.p[1]); gl.uniform1f(U.uS, k.s);
    gl.uniform2f(U.uK, 1, 1);
    gl.uniform2f(U.uTexel, 1 / T.w, 1 / T.h);
    const sub = o.sub || [0, 0, 1, 1]; gl.uniform4f(U.uSub, sub[0], sub[1], sub[2], sub[3]);
    gl.uniform1f(U.uA, o.a == null ? 1 : o.a);
    gl.uniform1f(U.uBlur, o.blur || 0);
    gl.uniform1f(U.uExpo, o.expo || 0);
    gl.uniform1f(U.uWarm, o.warm || 0);
    gl.uniform1f(U.uDis, o.dis == null ? -1 : o.dis);
    const dc = o.dc || [0.5, 0.5]; gl.uniform2f(U.uDC, dc[0], dc[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function drawFrost(f, a = 1) {
    gl.uniform1i(U.uMode, 1); gl.uniform1f(U.uFrost, f); gl.uniform1f(U.uA, a);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---------------- shot cameras (absolute song time) ---------------- */
  const BAR = 2.128;
  const HOLO_A = C.holo - 0.42, HOLO_B = C.holo + 0.1;   // liquid dissolve lands on `holo`
  const RING_A = C.ring - 0.26;                           // zoom-through cross into K3
  const PUSH_A = C.wax + 0.25, XF_A = C.wax + 1.1, XF_B = C.wax + 1.6, K5_SET = C.wax + 2.13;

  const ANTLER_K1 = [0.565, 0.385];
  function camK1(t) {
    const pre = eOut(lin(t, T0, C.dolly));
    const d = Math.pow(lin(t, C.dolly, C.holo + 0.1), 2.2);
    return cam(ANTLER_K1, mix(1.0, 1.07, pre) + d * 1.55, d * 0.62);
  }
  function camK2(t) {
    const settle = eOut(lin(t, HOLO_A, C.holo + 0.9));
    const glow = eIO(lin(t, C.antlerGlow, C.ring));
    const thru = eIn(lin(t, C.ring - 0.6, C.ring + 0.05));
    const c = [mix(0.55, 0.5, glow), mix(0.33, 0.24, glow)];
    return cam(c, mix(1.32, 1.05, settle) + glow * 0.12 + thru * 0.75, 0.15 * glow);
  }
  const TIP_K3 = [0.505, 0.17];
  function camK3(t) {
    const focus = eOut(lin(t, RING_A, C.ring + 0.9));
    return cam([0.52, 0.35], mix(1.42, 1.1, focus) + lin(t, C.ring + 0.9, C.s3) * 0.07);
  }
  // Points along the K4 antler from base to tip (image uv).
  const SEG = [
    { id: 's3-bone', cue: 's3', uv: [0.30, 0.615], dir: -1 },
    { id: 's3-blood', cue: 'layerBlood', uv: [0.47, 0.618], dir: -1, L: 330 },
    { id: 's3-powder', cue: 'layerPowder', uv: [0.635, 0.555], dir: -1 },
    { id: 's3-wax', cue: 'wax', uv: [0.765, 0.46], dir: -1, wax: true }
  ];
  const TIP_K4 = [0.775, 0.445];
  function camK4(t) {
    const drift = lin(t, C.s3 - 0.3, PUSH_A);
    const push = eIn(lin(t, PUSH_A, XF_B));
    const c = [mix(mix(0.53, 0.55, drift), TIP_K4[0], eIO(lin(t, PUSH_A, XF_B))), mix(0.52, TIP_K4[1], eIO(lin(t, PUSH_A, XF_B)))];
    return cam(c, mix(1.0, 1.05, drift) + push * 2.4, 0);
  }
  function camK5(t) {
    const land = eOut(lin(t, XF_A, K5_SET));
    const slow = lin(t, K5_SET, C.antlerFreeze) * 0.07;
    const side = eIO(lin(t, C.collagen - 0.1, C.collagen + 0.9));
    return cam([0.62, 0.5], mix(1.55, 1.1, land) + slow, 0, [side * 0.1, 0]);
  }

  /* ---------------- 2D light / particles ---------------- */
  function glow(x, y, r, a, col = '255,226,170') {
    if (a <= 0.003) return;
    const g = fx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.35, `rgba(${col},${a * 0.45})`); g.addColorStop(1, `rgba(${col},0)`);
    fx.fillStyle = g; fx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function ring(x, y, r, a, w = 3, col = '255,236,200') {
    if (a <= 0.003 || r <= 0) return;
    fx.strokeStyle = `rgba(${col},${a})`; fx.lineWidth = w; fx.beginPath(); fx.arc(x, y, r, 0, Math.PI * 2); fx.stroke();
  }
  function dust(t, n, a, opt) {
    for (let i = 0; i < n; i++) {
      const z = 0.4 + rnd(i, 1) * 0.6;
      const sp = opt.speed * z;
      let x = rnd(i, 2) * W + (t * sp * opt.vx);
      let y = rnd(i, 3) * H + (t * sp * opt.vy) + Math.sin(t * 0.7 + i) * 12 * z;
      x = ((x % W) + W) % W; y = ((y % H) + H) % H;
      if (opt.box) { // confine to a box (rising gold motes over the antler)
        x = opt.box[0] + (x / W) * opt.box[2]; y = opt.box[1] + (y / H) * opt.box[3];
      }
      const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + rnd(i, 4) * 2) + i * 3);
      const r = opt.size * z;
      fx.fillStyle = `rgba(${opt.col},${a * tw * z})`;
      fx.beginPath(); fx.arc(x, y, r, 0, Math.PI * 2); fx.fill();
      if (opt.halo) glow(x, y, r * 6, a * tw * 0.25 * z, opt.col);
    }
  }

  /* ---------------- text ---------------- */
  const $ = (id) => document.getElementById(id);
  const TXT = {};
  function setOp(el, a, extra = '') {
    el.style.opacity = a.toFixed(3);
    el.style.visibility = a > 0.001 ? 'visible' : 'hidden';
    if (extra !== null) el.style.transform = extra;
  }
  function buildText() {
    $('t-name').textContent = TXT['s2-name'];
    $('t-sub1').textContent = TXT['s2-sub'];
    $('t-sub2').textContent = TXT['s3-sub'];
    $('t-two').innerHTML = TXT['s3-two'].replace(/(\d+\s*%)/, '<b>$1</b>');
    $('d-h').textContent = TXT['s3-dh'];
    $('d1n').textContent = TXT['s3-d1n']; $('d2n').textContent = TXT['s3-d2n'];
    $('d-note').textContent = TXT['s3-dn'];
    const box = $('labels');
    SEG.forEach((g) => {
      const el = document.createElement('div');
      el.className = 'lab' + (g.dir > 0 ? ' down' : '') + (g.wax ? ' wax' : '');
      el.innerHTML = `<i class="ln"></i><i class="dot"></i><div class="box"><div class="nm"></div><div class="ds"></div></div>`;
      el.querySelector('.nm').textContent = TXT[g.id];
      el.querySelector('.ds').textContent = TXT[g.id + '-d'];
      box.appendChild(el); g.el = el;
      g.ln = el.querySelector('.ln'); g.box = el.querySelector('.box');
    });
  }
  const numVal = (s) => parseFloat(String(s).replace(/[^\d.]/g, ''));

  /* ---------------- frame ---------------- */
  const hud = $('hud'), barFill = $('bar-fill');
  function render(t) {
    gl.viewport(0, 0, glc.width, glc.height);
    gl.clearColor(0.961, 0.949, 0.925, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.uTime, t);
    fx.setTransform(fxc.width / W, 0, 0, fxc.height / H, 0, 0);
    fx.clearRect(0, 0, W, H);
    fx.globalCompositeOperation = 'lighter';

    // C1 · 鹿 —— forest plate + cut-out deer (parallax: deer scales faster than the plate during the dolly).
    if (t < HOLO_B) {
      const k = camK1(t);
      const d = lin(t, C.dolly, C.holo);
      draw('forest', k, { blur: d * 1.8 + 0.15, warm: 0.15 });
      const kd = cam(k.c, k.s * (1 + 0.035 * lin(t, T0, C.holo) + 0.09 * eIn(d)), 0);
      kd.p = k.p;
      draw('deer', kd, { sub: DEER_SUB, warm: 0.15 });
    }
    // C2 · 鹿茸逆光 —— liquid dissolve in on `holo`.
    if (t >= HOLO_A && t < C.ring + 0.05) {
      const k = camK2(t);
      const dis = eIO(lin(t, HOLO_A, HOLO_B));
      const dc = toScreen(camK1(t), ANTLER_K1);
      draw('antler', k, { dis: dis >= 1 ? -1 : dis, dc: [dc[0] / W, dc[1] / H], warm: 0.1,
        blur: lin(t, C.ring - 0.45, C.ring + 0.05) * 3.2 });
    }
    // C3 · 茸皮微距 —— focus pull from the zoom-through.
    if (t >= RING_A && t < C.s3 + 0.02) {
      const k = camK3(t);
      const a = eIO(lin(t, RING_A, C.ring));
      draw('velvet', k, { a, blur: mix(3.4, 0, eOut(lin(t, RING_A, C.ring + 0.75))), warm: 0.08 });
    }
    // C4 · 分层 —— studio antler, segment hits, then push into the tip.
    if (t >= C.s3 && t < XF_B) draw('stick', camK4(t), { warm: 0.05, blur: lin(t, XF_A, XF_B) * 2.5 });
    // C5/C6 · 蜡片 —— crossfade from the tip; defocus for data; frost on `antlerFreeze`.
    if (t >= XF_A) {
      const a = eIO(lin(t, XF_A, XF_B));
      const dataBlur = eIO(lin(t, C.collagen - 0.1, C.collagen + 0.9));
      draw('wax', camK5(t), { a, blur: mix(2.6, 0, eOut(lin(t, XF_A, K5_SET))) + dataBlur * 2.2, expo: dataBlur * 0.1 + lin(t, C.antlerFreeze, T1) * 0.05 });
    }
    if (t >= C.antlerFreeze) drawFrost(eOut(lin(t, C.antlerFreeze, C.antlerFreeze + 1.6)));

    /* ---- light & particles ---- */
    // Open from white, mist drifting across C1.
    if (t < T0 + 0.9) { fx.globalCompositeOperation = 'source-over'; fx.fillStyle = `rgba(247,244,238,${1 - eOut(lin(t, T0, T0 + 0.9))})`; fx.fillRect(0, 0, W, H); fx.globalCompositeOperation = 'lighter'; }
    if (t < C.holo) {
      const a = 1 - lin(t, C.holo - 0.6, C.holo);
      glow(1500 + Math.sin(t * 0.3) * 40, 120, 900, 0.22 * a, '255,240,214');
      dust(t, 70, 0.55 * a, { speed: 26, vx: 0.6, vy: 1, size: 2.2, col: '255,252,245' });
    }
    if (t >= HOLO_A && t < C.ring + 0.3) {
      const k = camK2(t);
      const env = lin(t, C.antlerGlow - 0.05, C.antlerGlow + 0.12) * (0.45 + 0.55 * (1 - lin(t, C.antlerGlow + 0.12, C.antlerGlow + 1.6)));
      const fade = 1 - lin(t, C.ring - 0.3, C.ring + 0.2);
      [[0.405, 0.04], [0.49, 0.1], [0.865, 0.04]].forEach(([u, v], i) => {
        const [x, y] = toScreen(k, [u, v]);
        glow(x, y + 20, 260 - i * 30, 0.55 * env * fade);
      });
      const hit = 1 - lin(t, C.antlerGlow, C.antlerGlow + 0.5);
      if (t >= C.antlerGlow) glow(...toScreen(k, [0.47, 0.12]), 700, 0.35 * hit * fade, '255,244,222');
      if (t >= C.antlerGlow) dust(t, 46, 0.85 * env * fade, { speed: 60, vx: 0.15, vy: -1, size: 2.6, col: '255,222,160', halo: true, box: [520, 0, 1100, 720] });
      // the holo dissolve flashes on the cue
      glow(...toScreen(camK1(Math.min(t, C.holo)), ANTLER_K1), 900, 0.5 * (1 - Math.abs(lin(t, HOLO_A, C.holo + 0.35) * 2 - 1)), '255,246,228');
    }
    if (t >= C.ring - 0.1 && t < C.s3 + 0.3) {
      const k = camK3(t);
      const [x, y] = toScreen(k, TIP_K3);
      [C.ring, C.ring + BAR].forEach((c0, j) => {
        const r = lin(t, c0, c0 + 1.8);
        if (t >= c0) { ring(x, y, 40 + eOut(r) * (1000 - j * 300), (1 - r) * (0.75 - j * 0.3), 3 - j); ring(x, y, 20 + eOut(r) * (620 - j * 200), (1 - r) * (0.45 - j * 0.2), 2); }
      });
      glow(x, y, 520, 0.6 * (1 - lin(t, C.ring, C.ring + 0.7)) * (t >= C.ring ? 1 : 0), '255,246,228');
      dust(t, 30, 0.6 * (1 - lin(t, C.s3 - 0.4, C.s3)), { speed: 14, vx: 0.4, vy: -0.6, size: 2, col: '255,250,240', halo: true });
    }
    // Light-leak sweep hides the cut into C4 on `s3`.
    {
      const lk = lin(t, C.s3 - 0.42, C.s3 + 0.36);
      if (lk > 0 && lk < 1) {
        const x = mix(-700, W + 700, eIO(lk)), a = Math.sin(lk * Math.PI);
        const g = fx.createLinearGradient(x - 900, 0, x + 900, 0);
        g.addColorStop(0, 'rgba(255,240,215,0)'); g.addColorStop(0.5, `rgba(255,246,232,${a})`); g.addColorStop(1, 'rgba(255,240,215,0)');
        fx.fillStyle = g; fx.fillRect(0, 0, W, H);
        glow(x, H * 0.45, 1100, a * 0.6, '255,236,205');
      }
    }
    // Segment hits on the antler; activity rises toward the tip.
    if (t >= C.s3 && t < XF_B) {
      const k = camK4(t);
      const out = 1 - lin(t, PUSH_A - 0.05, PUSH_A + 0.5);
      SEG.forEach((g, i) => {
        const c0 = C[g.cue]; if (t < c0) return;
        const [x, y] = toScreen(k, g.uv);
        const r = lin(t, c0, c0 + 1.2);
        const lvl = 0.25 + i * 0.25;
        glow(x, y, 160 + i * 60, (0.25 + lvl * 0.5) * (0.5 + 0.5 * (1 - r)) * (g.wax ? 1 : out));
        ring(x, y, 14 + eOut(r) * (120 + i * 60), (1 - r) * 0.8, 2.5);
      });
      if (t >= C.wax) glow(...toScreen(k, TIP_K4), 520, 0.5 * (1 - lin(t, C.wax, C.wax + 0.8)) + 0.25, '255,232,190');
    }
    if (t >= XF_A) {
      const a = lin(t, XF_A, XF_B) * (1 - lin(t, C.antlerFreeze, C.antlerFreeze + 0.8) * 0.7);
      dust(t, 40, 0.6 * a, { speed: 10, vx: 0.3, vy: -0.4, size: 2.2, col: '255,240,214', halo: true });
      const kk = camK5(t);
      glow(...toScreen(kk, [0.62, 0.5]), 640, 0.18 * a, '255,236,200');
      if (t >= XF_B) glow(...toScreen(kk, [0.62, 0.5]), 900, 0.4 * (1 - lin(t, XF_B - 0.2, XF_B + 0.8)), '255,246,230');
    }
    // Freeze flash, then lift to white at the end of the section.
    if (t >= C.antlerFreeze) glow(W / 2, H / 2, 1300, 0.35 * (1 - lin(t, C.antlerFreeze, C.antlerFreeze + 0.6)), '235,244,255');
    {
      const wa = lin(t, T1 - 0.55, T1);
      if (wa > 0) { fx.globalCompositeOperation = 'source-over'; fx.fillStyle = `rgba(247,244,238,${wa})`; fx.fillRect(0, 0, W, H); }
    }
    fx.globalCompositeOperation = 'source-over';

    /* ---- text ---- */
    {
      const a = win(t, 7.9, 11.6, 0.9, 0.7);
      const p = lin(t, 7.9, 11.6);
      const el = $('t-name');
      setOp(el, a, `translateX(${mix(-20, 30, p)}px)`);
      el.style.letterSpacing = mix(0.55, 0.32, eOut(lin(t, 7.9, 9.2))).toFixed(3) + 'em';
      el.style.filter = `blur(${(1 - eOut(lin(t, 7.9, 8.7))) * 12}px)`;
    }
    setOp($('t-sub1'), win(t, C.ring + 0.25, 21.1, 0.6, 0.45), `translateY(${(1 - eOut(lin(t, C.ring + 0.25, C.ring + 1))) * 14}px)`);
    setOp($('t-sub2'), win(t, 21.5, 27.5, 0.6, 0.45), `translateY(${(1 - eOut(lin(t, 21.5, 22.2))) * 14}px)`);
    {
      const s0 = XF_B - 0.1;
      const a = win(t, s0, C.collagen - 0.15, 0.6, 0.45);
      const el = $('t-two');
      setOp(el, a, `scale(${mix(1.04, 1, eOut(lin(t, s0, s0 + 1.3)))})`);
      el.style.filter = `blur(${(1 - eOut(lin(t, s0, s0 + 0.7))) * 10}px)`;
    }
    {
      const k = t >= C.s3 && t < XF_B ? camK4(t) : null;
      const out = 1 - lin(t, PUSH_A - 0.1, PUSH_A + 0.35);
      SEG.forEach((g, i) => {
        const c0 = C[g.cue];
        let a = k ? lin(t, c0, c0 + 0.45) : 0;
        if (k) a *= g.wax ? 1 - lin(t, PUSH_A + 0.3, PUSH_A + 0.75) : out;
        const dim = i < 3 && SEG[i + 1] && t > C[SEG[i + 1].cue] ? 0.62 : 1;
        g.el.style.opacity = (a * dim).toFixed(3);
        g.el.style.visibility = a > 0.001 ? 'visible' : 'hidden';
        if (!k || a <= 0.001) return;
        const [x, y] = toScreen(k, g.uv);
        const L = g.L || (g.wax ? 250 : 190);
        const grow = eOut(lin(t, c0, c0 + 0.5));
        g.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
        g.ln.style.height = L + 'px';
        g.ln.style.top = (g.dir < 0 ? -L : 0) + 'px';
        g.ln.style.transform = `scaleY(${grow})`;
        g.box.style.top = (g.dir < 0 ? -L - 116 : L + 10) + 'px';
        g.box.style.transform = `translateY(${(1 - grow) * 10 * -g.dir}px)`;
      });
    }
    {
      const base = C.collagen;
      const a0 = win(t, base, T1 + 1, 0.6, 0.3);
      $('data').style.opacity = 1;
      const items = ['d-h', 'd1n', 'd1v', 'd2n', 'd2v', 'd-note'];
      const delay = [0, 0.18, 0.18, 0.42, 0.42, 0.75];
      items.forEach((id, i) => {
        const a = Math.min(a0, lin(t, base + delay[i], base + delay[i] + 0.5));
        setOp($(id), a, `translateY(${(1 - eOut(lin(t, base + delay[i], base + delay[i] + 0.7))) * 18}px)`);
      });
      const cnt = (id, key, d) => {
        const v = numVal(TXT[key]); const p = eOut(lin(t, base + d, base + d + 1.064));
        $(id).textContent = '↑' + (v * p).toFixed(2) + '%';
      };
      cnt('d1v', 's3-d1v', 0.18); cnt('d2v', 's3-d2v', 0.42);
    }

    barFill.style.width = (lin(t, T0, T1) * 100).toFixed(2) + '%';
    if (DEBUG) {
      const f = Math.floor(t * FPS + 1e-6);
      let near = ''; for (const n in C) if (Math.abs(C[n] - t) < 0.25) near = n;
      hud.textContent = `t ${t.toFixed(3)}  f ${f}  ${near}`;
    }
  }

  /* ---------------- clock (audio master) ---------------- */
  const audio = $('bgm');
  const DEBUG = Q.get('debug') === '1';
  if (DEBUG) stage.classList.add('debug');
  let playing = false, anchorT = T0, anchorNow = 0, dirty = true, ended = false;
  function now() {
    if (!playing) return anchorT;
    const n = performance.now();
    let t = anchorT + (n - anchorNow) / 1000;
    if (!audio.paused && !audio.seeking && audio.readyState >= 2 && !pendingSeek) {
      const at = audio.currentTime;
      if (Math.abs(at - t) > 1 / FPS) { anchorT = at; anchorNow = n; t = at; }      // hard resync beyond one frame
      else { anchorT += (at - t) * 0.08; }                                          // otherwise ease toward audio
    }
    return t;
  }
  let pendingSeek = null;
  function applySeek() {
    if (pendingSeek == null || audio.readyState < 1) return;
    if (Math.abs(audio.currentTime - pendingSeek) > 0.02) audio.currentTime = pendingSeek;
    pendingSeek = null;
  }
  audio.addEventListener('loadedmetadata', applySeek);
  function seek(t) {
    t = clamp(t, T0, T1);
    anchorT = t; anchorNow = performance.now();
    pendingSeek = t; applySeek();
    dirty = true;
  }
  function play(from) {
    ended = false; $('end').hidden = true; $('cover').hidden = true;
    audio.volume = 1;
    seek(from);
    audio.play().catch(() => {});
    playing = true; anchorNow = performance.now();
  }
  function finish() {
    playing = false; ended = true; audio.pause();
    anchorT = T1; render(T1);
    $('end').hidden = false;
  }
  function loop() {
    const t = now();
    if (playing) {
      if (t >= T1 - 0.5) audio.volume = clamp((T1 - t) / 0.5) ;
      if (t >= T1) { finish(); }
      else render(t);
    } else if (dirty) { render(anchorT); }
    dirty = false;
    requestAnimationFrame(loop);
  }
  audio.addEventListener('waiting', () => { if (playing) anchorT = audio.currentTime, anchorNow = performance.now(); });

  window.__t = () => now();
  window.__seek = (t) => seek(t);
  window.__render = (t) => { anchorT = t; render(t); };
  window.__cues = C;

  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); if (ended) return play(T0);
      if (playing) { anchorT = now(); playing = false; audio.pause(); } else { audio.play().catch(() => {}); playing = true; anchorNow = performance.now(); } }
    if (e.code === 'ArrowRight') seek(now() + BAR);
    if (e.code === 'ArrowLeft') seek(now() - BAR);
  });

  /* ---------------- boot ---------------- */
  fit();
  const startAt = Q.has('t') ? clamp(parseFloat(Q.get('t')), T0, T1) : T0;
  Promise.all([
    ...Object.entries(IMGS).map(([k, n]) => loadTex(k, n)),
    fetch('../film/copy.json').then((r) => r.json()).then((j) => j.entries.forEach((e) => (TXT[e.id] = e.text))),
    document.fonts ? document.fonts.load('40px "XL Serif"').then(() => document.fonts.load('20px "XL Sans"')) : null
  ]).then(() => {
    buildText();
    anchorT = startAt; render(startAt);
    window.__ready = true;
    const btn = $('start');
    if (Q.has('still')) { $('cover').hidden = true; window.__render(parseFloat(Q.get('still'))); return; }
    btn.disabled = false; btn.textContent = '轻触开始';
    btn.onclick = () => play(startAt);
    $('again').onclick = () => play(T0);
    requestAnimationFrame(loop);
  }).catch((err) => { $('start').textContent = '载入失败：' + err.message; console.error(err); });
})();
