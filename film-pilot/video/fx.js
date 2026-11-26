/* WebGL 合成层：把 AI 视频当纹理，叠加由 cue 驱动的程序化效果——
   结构扫描（Sobel 边缘）、切点数字转场、茸尖涟漪、分层探点、极坐标切面扫描与结霜闪点。失败时退回原生 <video>。 */
window.FX = (function () {
  'use strict';
  const { clamp, lin, eIO, kf, A } = window.PV;
  const C = window.FILM.cues;
  const W = 1920, H = 1080;
  let gl, prog, tex, U = {}, cv, video, ok = false, hasFrame = false;

  const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const FS = `precision highp float;
varying vec2 v;
uniform sampler2D uTex;uniform vec2 uTx;uniform float uT;
uniform float uGl;uniform vec3 uScan;uniform vec3 uScanC;uniform float uEdge;
uniform vec4 uRip;uniform vec4 uSpot;uniform float uFrost;
const vec2 R=vec2(1920.,1080.);
const vec3 TEAL=vec3(.13,.55,.63);
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float lum(vec2 uv){return dot(texture2D(uTex,uv).rgb,vec3(.299,.587,.114));}
float sob(vec2 uv){
  vec2 d=uTx*1.6;
  float a=lum(uv+vec2(-d.x,d.y)),b=lum(uv+vec2(0.,d.y)),c=lum(uv+d);
  float l=lum(uv-vec2(d.x,0.)),r=lum(uv+vec2(d.x,0.));
  float e=lum(uv-d),f=lum(uv-vec2(0.,d.y)),g=lum(uv+vec2(d.x,-d.y));
  float gx=(c+2.*r+g)-(a+2.*l+e),gy=(a+2.*b+c)-(e+2.*f+g);
  return smoothstep(.08,.42,length(vec2(gx,gy)));
}
void main(){
  vec2 uv=v;vec2 p=vec2(v.x,1.-v.y)*R;
  // 茸尖涟漪：径向位移
  if(uRip.x>0.){
    vec2 dp=p-uRip.yz;float d=length(dp);
    float w=exp(-pow((d-uRip.w)/46.,2.));
    vec2 o=normalize(dp+1e-4)*w*uRip.x;uv-=vec2(o.x,-o.y)/R;
  }
  // 切点数字转场：横向错位条带 + RGB 分离
  float k=0.;
  if(uGl>0.){
    float fr=floor(uT*30.);
    float row=floor(p.y/(18.+44.*h(vec2(floor(p.y/62.),fr))));
    float r1=h(vec2(row,fr)),r2=h(vec2(row*1.7,fr+3.));
    uv.x+=step(1.-uGl*.55,r2)*(r1-.5)*uGl*.09;
    k=uGl*7./R.x;
  }
  vec3 col=vec3(texture2D(uTex,uv+vec2(k,0.)).r,texture2D(uTex,uv).g,texture2D(uTex,uv-vec2(k,0.)).b);
  // 扫描：0 自上而下，1 自左向右，2 绕切面极坐标
  float behind=0.,line=0.,trail=0.;
  if(uScan.x>0.){
    float s;float px;
    if(uScan.z<.5){s=p.y/R.y;px=R.y;}
    else if(uScan.z<1.5){s=p.x/R.x;px=R.x;}
    else{vec2 dp=p-uScanC.xy;float d=length(dp);s=fract(atan(dp.x,-dp.y)/6.2832+1.);px=d*6.2832;
      float ring=smoothstep(uScanC.z*1.18,uScanC.z*1.1,d);s=mix(2.,s,ring);}
    float dd=(uScan.y-s)*px;
    behind=step(0.,dd);
    line=exp(-pow(dd/3.,2.))+.35*exp(-pow(dd/26.,2.));
    trail=behind*exp(-dd/320.);
  }
  float e=sob(uv);
  float spot=0.;
  if(uSpot.x>0.){float d=length(p-uSpot.yz);spot=uSpot.x*smoothstep(uSpot.w,uSpot.w*.35,d);}
  float em=clamp(uEdge+uScan.x*(.32*behind+.6*trail)+spot,0.,1.);
  col=mix(col,TEAL,clamp(e*em,0.,.82));
  float grid=max(step(fract(p.x/48.),.025),step(fract(p.y/48.),.025));
  col=mix(col,TEAL,grid*trail*uScan.x*.18+grid*spot*.10);
  col+=line*uScan.x*vec3(.45,.85,.92)*.55;
  if(uSpot.x>0.){float d=length(p-uSpot.yz);col+=exp(-pow((d-uSpot.w*.55)/5.,2.))*uSpot.x*vec3(.55,.9,1.)*.35;}
  if(uRip.x>0.){float d=length(p-uRip.yz);col+=exp(-pow((d-uRip.w)/9.,2.))*uRip.x*.05*vec3(1.,.95,.85);}
  if(uFrost>0.){vec2 q=floor(p/3.);float s=step(.9982,h(q+floor(uT*9.)));col+=s*uFrost*vec3(.7,.85,.9);}
  col+=(h(p+fract(uT*7.))-.5)*.03;
  gl_FragColor=vec4(col,1.);
}`;

  function init(canvas, vid) {
    cv = canvas; video = vid;
    try {
      gl = cv.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
      if (!gl) throw new Error('no webgl');
      const sh = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      ['uTex', 'uTx', 'uT', 'uGl', 'uScan', 'uScanC', 'uEdge', 'uRip', 'uSpot', 'uFrost'].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));
      gl.uniform1i(U.uTex, 0);
      ok = true;
    } catch (err) {
      console.warn('FX disabled:', err); ok = false; cv.style.display = 'none';
    }
    return ok;
  }
  function resize(scale) {
    if (!ok) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(clamp(W * scale * dpr, 640, W)), ph = Math.round(pw * H / W);
    if (cv.width !== pw) { cv.width = pw; cv.height = ph; gl.viewport(0, 0, pw, ph); }
  }

  const CUTS = ['holo', 'ring', 's3', 'wax', 'antlerFreeze'].map((n) => C[n]);
  const SCANS = [
    { a: 7.75, b: 9.35, mode: 0 },
    { a: C.holo + 0.15, b: C.antlerGlow - 0.3, mode: 1 },
    { a: C.s3 + 0.15, b: C.s3 + 1.6, mode: 1 },
    { a: C.wax + 0.35, b: C.wax + 2.0, mode: 2 }
  ];
  const SPOTS = [['s3', 'bone'], ['layerBlood', 'blood'], ['layerPowder', 'powder']];
  function params(t) {
    let gl1 = 0;
    CUTS.forEach((c) => { const d = Math.abs(t - c); if (d < 0.3) gl1 = Math.max(gl1, Math.pow(1 - d / 0.3, 2)); });
    ['layerBlood', 'layerPowder', 'collagen'].forEach((n) => { const d = t - C[n]; if (d > -0.05 && d < 0.18) gl1 = Math.max(gl1, 0.35 * (1 - Math.abs(d - 0.05) / 0.15)); });
    let scan = [0, 0, 0], sc = [0, 0, 0];
    SCANS.forEach((s) => {
      if (t < s.a - 0.05 || t > s.b + 1.0) return;
      const amt = Math.min(lin(t, s.a - 0.05, s.a + 0.15), 1 - lin(t, s.b, s.b + 1.0));
      const pos = -0.03 + 1.08 * eIO(lin(t, s.a, s.b));
      scan = [amt, pos, s.mode];
      if (s.mode === 2) sc = kf(A.slice, t);
    });
    const edge = Math.max(
      t >= C.antlerGlow ? 0.85 * Math.exp(-(t - C.antlerGlow) * 1.6) * lin(t, C.antlerGlow - 0.05, C.antlerGlow + 0.1) : 0,
      t >= C.antlerFreeze ? 0.35 * Math.exp(-(t - C.antlerFreeze) * 1.4) : 0);
    let rip = [0, 0, 0, 0];
    [C.ring + 0.3, C.ring + 2.128].forEach((t0) => {
      const d = t - t0; if (d < 0 || d > 1.8) return;
      const c = kf(A.tip, t);
      rip = [9 * (1 - d / 1.8), c[0], c[1], d * 720];
    });
    let spot = [0, 0, 0, 0];
    SPOTS.forEach(([cue, key], i) => {
      const a = C[cue], b = i < 2 ? C[SPOTS[i + 1][0]] : C.wax;
      if (t < a || t > b) return;
      const p = kf(A[key], t);
      spot = [0.35 + 0.5 * Math.exp(-(t - a) * 2.2), p[0], p[1], 170];
    });
    const frost = clamp(lin(t, C.antlerFreeze + 0.2, C.antlerFreeze + 0.9)) * 0.9;
    return { gl1, scan, sc, edge, rip, spot, frost };
  }

  function render(t) {
    if (!ok) return;
    if (video.readyState >= 2) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
      hasFrame = true;
    }
    if (!hasFrame) return;
    const P = params(t);
    gl.uniform2f(U.uTx, 1 / (video.videoWidth || W), 1 / (video.videoHeight || H));
    gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uGl, P.gl1);
    gl.uniform3f(U.uScan, P.scan[0], P.scan[1], P.scan[2]);
    gl.uniform3f(U.uScanC, P.sc[0], P.sc[1], P.sc[2]);
    gl.uniform1f(U.uEdge, P.edge);
    gl.uniform4f(U.uRip, P.rip[0], P.rip[1], P.rip[2], P.rip[3]);
    gl.uniform4f(U.uSpot, P.spot[0], P.spot[1], P.spot[2], P.spot[3]);
    gl.uniform1f(U.uFrost, P.frost);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    cv.style.visibility = 'visible';
  }
  return { init, resize, render, params, get ok() { return ok; } };
})();
