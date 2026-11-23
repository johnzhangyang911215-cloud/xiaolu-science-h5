/* Particle engine: one shared blue-tech particle system that morphs between formations. */
(function(){
const N = 7000;
const W = 1920, H = 1080, F = 1000;
const cam = { x:0, y:0, z:-1000, focus:1000, aperture:5, exposure:1 };

// ---------- deterministic random ----------
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const R = mulberry(7);
const rnd = new Float32Array(N*4); for(let i=0;i<N*4;i++) rnd[i]=R();
function gauss(r){ let u=0; for(let k=0;k<4;k++) u+=r(); return (u-2)/0.58; }

// ---------- state arrays ----------
const P = new Float32Array(N*3), A = new Float32Array(N*4);         // current pos; attrs size,alpha,col,seed
const FP = new Float32Array(N*3), FA = new Float32Array(N*4);       // from
const TP = new Float32Array(N*3), TA = new Float32Array(N*4);       // target
const D = new Float32Array(N);                                      // per-particle delay 0..1
const CO = new Float32Array(N*3);                                   // ctrl offsets
for(let i=0;i<N;i++){ A[i*4+3]=rnd[i*4]; TA[i*4+3]=rnd[i*4]; FA[i*4+3]=rnd[i*4];
  CO[i*3]=gauss(R); CO[i*3+1]=gauss(R); CO[i*3+2]=gauss(R); }

let form = null, morph = null;

// ---------- WebGL ----------
const gl = document.getElementById('gl').getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});
const vs = `
attribute vec3 aPos; attribute vec4 aAttr;
uniform vec3 uCam; uniform float uF; uniform vec2 uRes; uniform float uFocus; uniform float uAp; uniform float uTime;
varying float vA; varying float vC; varying float vSharp;
void main(){
  float sd = aAttr.w;
  vec3 p = aPos + vec3(sin(uTime*.6+sd*61.), cos(uTime*.5+sd*37.), sin(uTime*.4+sd*17.))*1.6 - uCam;
  float z = p.z;
  if(z < 20.){ gl_Position=vec4(2.,2.,2.,1.); gl_PointSize=0.; vA=0.; return; }
  vec2 s = p.xy * uF / z;
  gl_Position = vec4(s.x/(uRes.x*.5), s.y/(uRes.y*.5), 0., 1.);
  float base = aAttr.x * uF / z;
  float coc = abs(z-uFocus)/z * uAp * 10.;
  float size = sqrt(base*base + coc*coc);
  vSharp = clamp(base/size, 0., 1.);
  gl_PointSize = clamp(size*5., 2., 90.);
  float tw = .78 + .22*sin(uTime*(1.3+sd*2.)+sd*40.);
  vA = aAttr.y * tw * mix(.06, 1., vSharp*vSharp);
  vC = aAttr.z;
}`;
const fs = `
precision mediump float;
varying float vA; varying float vC; varying float vSharp; uniform float uExp;
void main(){
  vec2 d = gl_PointCoord*2.-1.; float r2 = dot(d,d); if(r2>1.) discard;
  float core = exp(-r2*55.);
  float halo = exp(-r2*7.)*.16;
  float disc = smoothstep(.2, .13, r2)*.22 + smoothstep(.2,.17,r2)*smoothstep(.1,.19,r2)*.08;
  float I = vA * mix(disc, core+halo, vSharp) * uExp;
  vec3 deep = vec3(.05,.22,.95), cyan = vec3(.12,.72,1.), ice = vec3(.86,.96,1.);
  vec3 c = vC < .5 ? mix(deep, cyan, vC*2.) : mix(cyan, ice, (vC-.5)*2.);
  gl_FragColor = vec4(c*I, I);
}`;
function sh(t,src){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(s));return s;}
const prog = gl.createProgram(); gl.attachShader(prog,sh(gl.VERTEX_SHADER,vs)); gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(prog); gl.useProgram(prog);
const bP = gl.createBuffer(), bA = gl.createBuffer();
const lP = gl.getAttribLocation(prog,'aPos'), lA = gl.getAttribLocation(prog,'aAttr');
const U = n=>gl.getUniformLocation(prog,n);
const uCam=U('uCam'),uF=U('uF'),uRes=U('uRes'),uFocus=U('uFocus'),uAp=U('uAp'),uTime=U('uTime'),uExp=U('uExp');
gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.DEPTH_TEST);
gl.viewport(0,0,W,H);

// ---------- helpers: sampling ----------
function catmull(pts, closed, seg){ const out=[]; const n=pts.length; const m = closed? n : n-1;
  for(let i=0;i<m;i++){ const p0=pts[closed?(i-1+n)%n:Math.max(0,i-1)], p1=pts[i], p2=pts[(i+1)%n], p3=pts[closed?(i+2)%n:Math.min(n-1,i+2)];
    for(let k=0;k<seg;k++){ const t=k/seg, t2=t*t, t3=t2*t;
      out.push([.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
                .5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)]); } }
  if(!closed) out.push(pts[n-1].slice()); return out; }
function resample(poly, count, closed){ // equal arc length samples; returns [{x,y,t,nx,ny}]
  const L=[0]; const seg = closed? poly.concat([poly[0]]) : poly;
  for(let i=1;i<seg.length;i++) L.push(L[i-1]+Math.hypot(seg[i][0]-seg[i-1][0],seg[i][1]-seg[i-1][1]));
  const tot=L[L.length-1], out=[]; let j=1;
  for(let k=0;k<count;k++){ const d = closed? tot*k/count : tot*k/Math.max(1,count-1);
    while(j<L.length-1 && L[j]<d) j++;
    const f=(d-L[j-1])/Math.max(1e-6,L[j]-L[j-1]); const a=seg[j-1], b=seg[j];
    const tx=b[0]-a[0], ty=b[1]-a[1], tl=Math.hypot(tx,ty)||1;
    out.push({x:a[0]+tx*f, y:a[1]+ty*f, t:d/tot, nx:-ty/tl, ny:tx/tl}); }
  return out; }
function pathOf(poly){ const p=new Path2D(); poly.forEach((q,i)=>i?p.lineTo(q[0],q[1]):p.moveTo(q[0],q[1])); p.closePath(); return p; }
const scratch = document.createElement('canvas').getContext('2d');
function fillSamples(poly, count, rr, bbox){ const p=pathOf(poly), out=[]; let guard=0;
  while(out.length<count && guard++<count*80){ const x=bbox[0]+rr()*(bbox[2]-bbox[0]), y=bbox[1]+rr()*(bbox[3]-bbox[1]); if(scratch.isPointInPath(p,x,y)) out.push([x,y]); }
  return out; }
function textSamples(text, font, count, rr){ const c=document.createElement('canvas'); c.width=1200; c.height=300; const x=c.getContext('2d');
  x.fillStyle='#fff'; x.font=font; x.textBaseline='middle'; x.textAlign='center'; x.fillText(text,600,150);
  const d=x.getImageData(0,0,1200,300).data, px=[]; for(let y=0;y<300;y+=2) for(let X=0;X<1200;X+=2) if(d[(y*1200+X)*4+3]>140) px.push([X-600,y-150]);
  const out=[]; for(let i=0;i<count;i++) out.push(px[Math.floor(rr()*px.length)]||[0,0]); return out; }

// world <-> screen for a given camera (z=0 plane unless wz)
function toWorld(sx, sy, c, wz){ const dz=(wz||0)-c.z; return [c.x+(sx-W/2)*dz/F, c.y-(sy-H/2)*dz/F, wz||0]; }
function project(x,y,z){ const dz=z-cam.z; if(dz<20) return null; return [W/2+(x-cam.x)*F/dz, H/2-(y-cam.y)*F/dz, F/dz]; }

// ---------- formation building ----------
// a formation: {n, set(i,arr) static init, update(t) optional, dust:{cx,cy}}
const DUSTK = 0;   // ambient background dust: off (clean, pure background); story particles unaffected
function makeFormation(build, opts){ opts=opts||{};
  const f = { pos:new Float32Array(N*3), att:new Float32Array(N*4), n:0, update:opts.update||null, params:opts.params||{}, dustC:opts.dust||[0,0] };
  let k=0; const put=(x,y,z,s,a,c)=>{ if(k>=N) return -1; f.pos[k*3]=x; f.pos[k*3+1]=y; f.pos[k*3+2]=z; f.att[k*4]=s; f.att[k*4+1]=a; f.att[k*4+2]=c; f.att[k*4+3]=rnd[k*4]; return k++; };
  build(put, f); f.n=k;
  // dust for the rest
  const [cx,cy]=f.dustC;
  for(let i=k;i<N;i++){ const dr=mulberry(99+i*7919); /* per-index dust: identical between formations sharing a centre */ const r1=rnd[i*4+1], r2=rnd[i*4+2], r3=rnd[i*4+3];
    let z = -350 + r3*3200; let s=1.0+dr()*1.6, a=(.10+dr()*.22)*DUSTK;
    if(r1<.035){ z = -820 + dr()*200; s=2.2+dr()*2; a=0; } // near bokeh removed (clean background)
    f.pos[i*3]=cx+(r1-.5)*3200*(1+z/1500); f.pos[i*3+1]=cy+(r2-.5)*1900*(1+z/1500); f.pos[i*3+2]=z;
    f.att[i*4]=s; f.att[i*4+1]=a; f.att[i*4+2]=.35+dr()*.4; f.att[i*4+3]=rnd[i*4]; }
  f.base = f.pos.slice(); f.baseA = f.att.slice();
  return f; }

function setForm(f){ form=f; }
function morphTo(f, o){ o=o||{};
  FP.set(P); FA.set(A); form=f;
  const st = o.stagger==null? .45 : o.stagger, mode=o.order||'index';
  for(let i=0;i<N;i++){ let d;
    if(i>=f.n) d=rnd[i*4+2];
    else if(mode==='index') d=i/f.n;
    else if(mode==='rindex') d=1-i/f.n;
    else if(mode==='y') d=(f.pos[i*3+1]-(o.y0||0))/((o.y1||1)-(o.y0||0));
    else d=rnd[i*4+1];
    D[i]=Math.min(1,Math.max(0,d))*st; }
  morph = { t:0, ctrl:o.ctrl||null, spread:o.spread==null?120:o.spread, st:st, lift:o.lift||0, f:f };
  const tw = gsap.to(morph,{t:1,duration:o.duration||2.4,ease:'none',onComplete:()=>{morph=null;}});
  return tw; }

function ease(t){ return t<.5? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
let lead = null;
function step(time){
  if(!form) return;   // ticker can fire before the first formation is set
  if(form && form.update) form.update(time, form);
  // dust drift
  if(form){ for(let i=form.n;i<N;i++){ const by=form.base[i*3+1]; form.pos[i*3+1] = by + Math.sin(time*.05+rnd[i*4]*20)*40; form.pos[i*3] = form.base[i*3] + Math.sin(time*.04+rnd[i*4+1]*30)*30; } }
  const fp=form.pos, fa=form.att;
  if(morph){ const m=morph.t, st=morph.st, c=morph.ctrl, sp=morph.spread; let leadBest=-1, leadV=-1;
    for(let i=0;i<N;i++){ let l=(m*(1+st)-D[i]); l = l<=0?0:(l>=1?1:l); const e=ease(l), i3=i*3, i4=i*4;
      if(c && i<morph.f.n){ const u=1-e, cx=c[0]+CO[i3]*sp, cy=c[1]+CO[i3+1]*sp, cz=c[2]+CO[i3+2]*sp;
        P[i3]=u*u*FP[i3]+2*u*e*cx+e*e*fp[i3]; P[i3+1]=u*u*FP[i3+1]+2*u*e*cy+e*e*fp[i3+1]; P[i3+2]=u*u*FP[i3+2]+2*u*e*cz+e*e*fp[i3+2];
        if(l>0 && l<1 && i%7===0 && l>leadV){ leadV=l; leadBest=i; }
      } else { P[i3]=FP[i3]+(fp[i3]-FP[i3])*e; P[i3+1]=FP[i3+1]+(fp[i3+1]-FP[i3+1])*e; P[i3+2]=FP[i3+2]+(fp[i3+2]-FP[i3+2])*e; }
      const bump = c && i<morph.f.n ? Math.sin(l*Math.PI) : 0;
      A[i4]=FA[i4]+(fa[i4]-FA[i4])*e; A[i4+1]=FA[i4+1]+(fa[i4+1]-FA[i4+1])*e + bump*.35; A[i4+2]=FA[i4+2]+(fa[i4+2]-FA[i4+2])*e + bump*.3; }
    lead = leadBest>=0? [P[leadBest*3],P[leadBest*3+1],P[leadBest*3+2], leadV] : null;
  } else { P.set(fp); for(let i=0;i<N*4;i+=4){ A[i]=fa[i]; A[i+1]=fa[i+1]; A[i+2]=fa[i+2]; } lead=null; }
}
function render(time){
  gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindBuffer(gl.ARRAY_BUFFER,bP); gl.bufferData(gl.ARRAY_BUFFER,P,gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(lP); gl.vertexAttribPointer(lP,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,bA); gl.bufferData(gl.ARRAY_BUFFER,A,gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(lA); gl.vertexAttribPointer(lA,4,gl.FLOAT,false,0,0);
  gl.uniform3f(uCam,cam.x,cam.y,cam.z); gl.uniform1f(uF,F); gl.uniform2f(uRes,W,H); gl.uniform1f(uFocus,cam.focus); gl.uniform1f(uAp,cam.aperture);
  gl.uniform1f(uTime,time); gl.uniform1f(uExp,cam.exposure*.48);
  gl.drawArrays(gl.POINTS,0,N);
}

// ---------- fx canvas: flares, lines ----------
const fx = document.getElementById('fx').getContext('2d');
function flare(x,y,s,a,streak){ if(a<=0.003) return; fx.save(); fx.globalCompositeOperation='lighter';
  let g=fx.createRadialGradient(x,y,0,x,y,s); g.addColorStop(0,`rgba(240,250,255,${a})`); g.addColorStop(.12,`rgba(120,210,255,${a*.55})`); g.addColorStop(.45,`rgba(30,110,255,${a*.12})`); g.addColorStop(1,'rgba(30,110,255,0)');
  fx.fillStyle=g; fx.beginPath(); fx.arc(x,y,s,0,7); fx.fill();
  if(streak){ fx.translate(x,y); fx.scale(streak,.035*streak/3+.02); g=fx.createRadialGradient(0,0,0,0,0,s); g.addColorStop(0,`rgba(215,238,255,${a*.7})`); g.addColorStop(.5,`rgba(60,160,255,${a*.15})`); g.addColorStop(1,'rgba(30,120,255,0)');
    fx.fillStyle=g; fx.beginPath(); fx.arc(0,0,s,0,7); fx.fill(); }
  fx.restore(); }
function ghost(x,y,a){ if(a<.01) return; const cx=W/2, cy=H/2; fx.save(); fx.globalCompositeOperation='lighter';
  [[-.6,40,.10],[-.25,22,.14],[.4,60,.06],[1.3,90,.05]].forEach(([k,r,al])=>{ const gx=cx+(cx-x)*k, gy=cy+(cy-y)*k; const g=fx.createRadialGradient(gx,gy,0,gx,gy,r);
    g.addColorStop(0,`rgba(120,210,255,${al*a*.3})`); g.addColorStop(.8,`rgba(70,170,255,${al*a})`); g.addColorStop(1,'rgba(70,170,255,0)'); fx.fillStyle=g; fx.beginPath(); fx.arc(gx,gy,r,0,7); fx.fill(); });
  fx.restore(); }

window.PX = { N, W, H, F, cam, rnd, gauss, mulberry, catmull, resample, fillSamples, textSamples, toWorld, project,
  makeFormation, setForm, morphTo, step, render, fx, flare, ghost, get lead(){return lead;}, get form(){return form;}, P, A };
// initial: everything dust, dark
})();
