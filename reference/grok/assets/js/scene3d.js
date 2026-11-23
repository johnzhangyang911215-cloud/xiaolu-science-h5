/* Three.js layer: real GLB models rendered low-key with electric-blue rim light, camera synced to the particle camera. */
(function(){
const R3 = window.R3 = { ok:false };
let renderer, scene, camera;
const V3 = ()=>new THREE.Vector3();
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const FOV = 2*Math.atan(540/1000)*180/Math.PI;

const NOISE = `
float h3(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return .55*vnoise(p)+.3*vnoise(p*2.13)+.15*vnoise(p*4.31);}`;
function U(ns){ return { uDis:{value:-0.2}, uNS:{value:ns}, uGrow:{value:1}, uGrowOn:{value:0}, uAxO:{value:V3()}, uAxD:{value:new THREE.Vector3(0,1,0)}, uAxL:{value:1},
  uGlow:{value:0}, uHeat:{value:0}, uGlowCol:{value:new THREE.Color(0.10,0.62,1.0)}, uDim:{value:1}, uBandOn:{value:0}, uBand:{value:0}, uTip:{value:0}, uCool:{value:0}, uGhost:{value:1} }; }
function patch(mat, u, key, look){
  mat.onBeforeCompile = sh=>{
    for(const k in u) sh.uniforms[k]=u[k];
    sh.vertexShader = 'varying vec3 vOP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vOP = transformed;');
    sh.fragmentShader = 'varying vec3 vOP;\nuniform float uDis,uNS,uGrow,uGrowOn,uAxL,uGlow,uHeat,uDim,uBandOn,uBand,uTip,uCool,uGhost;\nuniform vec3 uAxO,uAxD,uGlowCol;\n'+NOISE+'\n'+
      sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  float nz = fbm(vOP*uNS);
  if(nz < uDis) discard;
  float hh = dot(vOP-uAxO,uAxD)/uAxL;
  float ghostP = (uGrowOn>.5 && hh>uGrow) ? 1. : 0.;
  if(ghostP>.5 && uGhost<.01) discard;`).replace('#include <opaque_fragment>', `#include <opaque_fragment>
  float e1 = (1.-smoothstep(0.,.06,nz-uDis))*step(-0.02,uDis);
  if(ghostP>.5){ // outline of the antler that is not (re)grown yet: fresnel rim only, transparent inside
    float frg = pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.4);
    float k = frg*uGhost*(.35+.65*smoothstep(uGrow,uGrow+.08,hh));
    if(k<.035) discard;
    gl_FragColor = vec4(uGlowCol*(.5+1.3*frg)*k, k*.9); return; }
  ${look===4?`float frG=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.2); vec3 nG=normalize(normal);
  float gradG=.5+.5*nG.y; float strG=exp(-pow((nG.x+.42)/.09,2.))*(.45+.55*gradG)+exp(-pow((nG.x-.62)/.05,2.))*.35;
  vec3 cG=gl_FragColor.rgb*.6*mix(.74,1.06,gradG);
  cG += vec3(.60,.80,1.)*frG*.50 + vec3(.92,.96,1.)*strG*.30;
  gl_FragColor.rgb=cG; gl_FragColor.a=min(1.,gl_FragColor.a*mix(.86,1.3,frG));`:''}
  ${look===1?`float frL=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.2);
  gl_FragColor.rgb = vec3(.006,.016,.036) + gl_FragColor.rgb*.05 + uGlowCol*frL*.34;`:''}
  ${look>=2?`float frW=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),1.6);
  gl_FragColor = vec4(mix(vec3(.13,.38,.66),vec3(.66,.90,1.),frW*.75)*1.05, (.36+frW*.40)*${look===3?'.42':'1.'});`:''}
  float e2 = uGrowOn>.5 ? (1.-smoothstep(0.,.05,uGrow-hh))*step(uGrow,.999) : 0.;
  gl_FragColor.rgb *= uDim*(1.+uHeat*1.1*pow(clamp(hh,0.,1.),3.));
  gl_FragColor.rgb += uGlowCol*(e1*2.6+e2*2.2) + uGlowCol*uHeat*.07*pow(clamp(hh,0.,1.),4.) + uGlowCol*uGlow*.35;
  if(uCool>0.){ float lu=dot(gl_FragColor.rgb,vec3(.3,.59,.11)); gl_FragColor.rgb=mix(gl_FragColor.rgb, lu*vec3(.62,.86,1.25), uCool); }
  if(uBandOn>0.){
    float hb=clamp(hh,0.,1.);
    float lv=step(.36,hb)+step(.66,hb)+step(.88,hb);
    vec3 gc = lv<.5? vec3(.05,.16,.42) : lv<1.5? vec3(.07,.34,.92) : lv<2.5? vec3(.05,.62,1.0) : vec3(.62,.93,1.0);
    float rev = 1.-smoothstep(uBand-.05,uBand,hb);
    float fr = pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.2);
    float dd = min(min(abs(hb-.36),abs(hb-.66)),abs(hb-.88));
    float ring = 1.-smoothstep(.0,.009,dd);
    float scan = (1.-smoothstep(0.,.016,abs(hb-uBand)))*step(uBand,1.04);
    float tipb = smoothstep(.86,1.,hb)*uTip;
    // only the part the scan has already passed changes; everything above it stays exactly as in scene 02
    ${look===1?`vec3 band = gl_FragColor.rgb*.85 + gc*(.05+.42*fr)*(1.+lv*.18) + vec3(.55,.9,1.)*ring*.9;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, band, uBandOn*rev) + vec3(.5,.88,1.)*scan*.9*uBandOn*smoothstep(0.,.06,uBand) + vec3(.55,.9,1.)*tipb*(.18+.7*fr);`
    : look>=2?`vec3 band = gc*(1.3+1.1*fr)*(1.+lv*.2) + vec3(.55,.9,1.)*ring*1.3;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, band, uBandOn*rev) + vec3(.5,.88,1.)*scan*1.2*uBandOn*smoothstep(0.,.06,uBand) + vec3(.55,.9,1.)*tipb*(.6+1.2*fr);
    gl_FragColor.a = mix(gl_FragColor.a, min(1.,.72+.28*fr), uBandOn*max(rev,scan));`
    :`vec3 band = gl_FragColor.rgb*.35 + gc*(.30+1.5*fr)*(1.+lv*.18) + vec3(.55,.9,1.)*ring*1.3;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, band, uBandOn*rev) + vec3(.5,.88,1.)*scan*.8*uBandOn*smoothstep(0.,.06,uBand) + vec3(.55,.9,1.)*tipb*(.5+1.2*fr);`}
  }`);
  };
  mat.customProgramCacheKey = ()=>'xl-'+key;
  return mat;
}
function tri(geo){ const pos=geo.attributes.position, idx=geo.index? geo.index.array : null, n= idx? idx.length/3 : pos.count/3; return {pos, idx, n, I:(t,k)=> idx? idx[t*3+k] : t*3+k}; }
function areaCDF(T, xf){ const a=new Float64Array(T.n); let s=0; const A=V3(),B=V3(),C=V3();
  for(let t=0;t<T.n;t++){ A.fromBufferAttribute(T.pos,T.I(t,0)); B.fromBufferAttribute(T.pos,T.I(t,1)); C.fromBufferAttribute(T.pos,T.I(t,2)); if(xf){A.applyMatrix4(xf);B.applyMatrix4(xf);C.applyMatrix4(xf);}
    s+=B.sub(A).cross(C.sub(A)).length()*.5; a[t]=s; } return {a,s}; }
function pick(cdf, r){ let lo=0, hi=cdf.a.length-1, x=r*cdf.s; while(lo<hi){ const m=(lo+hi)>>1; if(cdf.a[m]<x) lo=m+1; else hi=m; } return lo; }
function pca(points){ const m=V3(); points.forEach(p=>m.add(p)); m.divideScalar(points.length); const C=new Array(9).fill(0);
  points.forEach(p=>{ const a=[p.x-m.x,p.y-m.y,p.z-m.z]; for(let r=0;r<3;r++) for(let s=0;s<3;s++) C[r*3+s]+=a[r]*a[s]; });
  let e=new THREE.Vector3(.3,1,.2).normalize(); for(let i=0;i<60;i++) e=new THREE.Vector3(C[0]*e.x+C[1]*e.y+C[2]*e.z, C[3]*e.x+C[4]*e.y+C[5]*e.z, C[6]*e.x+C[7]*e.y+C[8]*e.z).normalize();
  return {m, e}; }
function geoPoints(geo, step){ const p=geo.attributes.position, out=[]; for(let i=0;i<p.count;i+=(step||1)) out.push(V3().fromBufferAttribute(p,i)); return out; }
function rng(seed){ let a=seed|0; return ()=>{ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function imgLum(tex, size){ try{ const im=tex.image; const c=document.createElement('canvas'); c.width=c.height=size; const x=c.getContext('2d'); x.drawImage(im,0,0,size,size); const d=x.getImageData(0,0,size,size).data;
  const L=new Float32Array(size*size); for(let i=0;i<L.length;i++) L[i]=(d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11)/255; return {L,size}; }catch(e){ console.warn('lum',e); return null; } }
function lumAt(lm, u, v){ if(!lm) return .5; const s=lm.size; const x=Math.min(s-1,Math.max(0,Math.floor((u%1+1)%1*s))), y=Math.min(s-1,Math.max(0,Math.floor((v%1+1)%1*s))); return lm.L[y*s+x]; }

R3.init = async function(bufs){
  const canvas=document.getElementById('three');
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'high-performance', preserveDrawingBuffer:true});
  renderer.setPixelRatio(1); renderer.setSize(1920,1080,false); renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  scene = R3.scene = new THREE.Scene(); scene.environmentIntensity = .06;
  const pm = new THREE.PMREMGenerator(renderer);
  { const es=new THREE.Scene(); es.background=new THREE.Color(0x122238);
    const panel=(x,y,z,w,h,c,k)=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide})); m.material.color.multiplyScalar(k); m.position.set(x,y,z); m.lookAt(0,0,0); es.add(m); };
    panel(-5,5,3,3,9,0xc6ddff,3); panel(5,2,0,1,8,0xdfe8f6,4); panel(0,6,-3,6,2,0xffffff,5); panel(-1,1,6,1,5,0xdcefff,2);
    scene.environment = pm.fromScene(es, .08).texture; }
  camera = R3.camera = new THREE.PerspectiveCamera(FOV, 16/9, 10, 40000);
  const L = R3.lights = {
    hemi:new THREE.HemisphereLight(0x2a4a8a, 0x01040c, .32),
    key:new THREE.DirectionalLight(0xdcecff, .9), rimL:new THREE.DirectionalLight(0x1e6bff, 12), rimR:new THREE.DirectionalLight(0x00d2ff, 8), fill:new THREE.DirectionalLight(0x3d7bff, .14) };
  L.key.position.set(-.6,1.4,.9); L.rimL.position.set(-1.3,.55,-1.1); L.rimR.position.set(1.4,.9,-1.0); L.fill.position.set(.6,-.6,1);
  for(const k in L) scene.add(L[k]);
  // studio blend: 0 = low-key electric-blue look, 1 = bright product-photo look (hemisphere + key + soft rims, bright env, slight exposure lift)
  const LA={hemi:[.32,0x2a4a8a,0x01040c], key:[.9,0xdcecff], rimL:[12,0x1e6bff], rimR:[8,0x00d2ff], fill:[.14,0x3d7bff], env:.06, exp:1.0};
  const LB={hemi:[2.0,0xb6d6ff,0x0a1626], key:[4.0,0xeef6ff], rimL:[3.2,0x6aa8ff], rimR:[2.6,0x9fe0ff], fill:[.9,0xdbe8ff], env:1.0, exp:1.05};
  const cA=new THREE.Color(), cB=new THREE.Color();
  R3.st={k:0}; let stK=-1;
  R3.applyStudio=()=>{ const k=R3.st.k; if(k===stK) return; stK=k;
    for(const n of ['hemi','key','rimL','rimR','fill']){ L[n].intensity=LA[n][0]+(LB[n][0]-LA[n][0])*k; L[n].color.copy(cA.set(LA[n][1])).lerp(cB.set(LB[n][1]),k); }
    L.hemi.groundColor.copy(cA.set(LA.hemi[2])).lerp(cB.set(LB.hemi[2]),k);
    scene.environmentIntensity=LA.env+(LB.env-LA.env)*k; renderer.toneMappingExposure=LA.exp+(LB.exp-LA.exp)*k; };
  const loader = new T3X.GLTFLoader(); loader.setMeshoptDecoder(T3X.MeshoptDecoder);
  const parse = b=>new Promise((res,rej)=>loader.parse(b,'',res,rej));
  const [gD, gB, gA] = await Promise.all([parse(bufs.deer), parse(bufs['box-closed']), parse(bufs.ampoule)]);
  setupDeer(gD); setupTower(); setupAmp(gA); setupBox(gB);
  if(bufs.usage){ setupUsage(await parse(bufs.usage)); }
  R3.ok = true;
};

/* ---------------- deer ---------------- */
function setupDeer(g){
  const D = R3.deer = {};
  const root=g.scene; root.rotation.x=-Math.PI/2;
  const fix=new THREE.Group(); fix.add(root); const pivot=new THREE.Group(); pivot.add(fix); scene.add(pivot);
  let skinned=null; const ants=[]; root.traverse(o=>{ if(o.isSkinnedMesh) skinned=o; if(o.isMesh && /Antler/i.test(o.name)) ants.push(o); o.frustumCulled=false; });
  D.u = U(.16); D.ua = U(.9);
  const sm=skinned.material;
  const fillM=(side)=>new THREE.MeshStandardMaterial({ color:0x1a2c48, roughness:.7, metalness:0, envMapIntensity:.2, side, polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1 });
  const wireM=()=>new THREE.MeshStandardMaterial({ color:0x000000, roughness:1, wireframe:true, transparent:true, depthWrite:false });
  skinned.material = patch(fillM(sm.side), D.u, 'deer-f', 1);
  { const w=new THREE.SkinnedMesh(skinned.geometry, patch(wireM(), D.u, 'deer-w', 2)); w.name='deer-wire'; w.position.copy(skinned.position); w.quaternion.copy(skinned.quaternion); w.scale.copy(skinned.scale);
    skinned.parent.add(w); w.bindMode=skinned.bindMode; w.bind(skinned.skeleton, skinned.bindMatrix); w.frustumCulled=false; w.renderOrder=2; D.wire=w; }
  const am=ants[0].material;
  const antMat = patch(fillM(am.side), D.ua, 'ant-f', 1), antW = patch(wireM(), D.ua, 'ant-w', 3);
  ants.forEach(a=>{ a.material=antMat; const w=new THREE.Mesh(a.geometry, antW); w.frustumCulled=false; w.renderOrder=2; a.add(w); });
  D.mixer = new THREE.AnimationMixer(root); D.clips={}; g.animations.forEach(c=>D.clips[c.name.replace('_Skeleton','')]=c);
  D.act = {}; ['Idle_1','Idle_2','Idle_3'].forEach(n=>{ D.act[n]=D.mixer.clipAction(D.clips[n]); });
  D.act.Idle_1.play(); D.cur=D.act.Idle_1; D.mixer.update(0.01); pivot.updateMatrixWorld(true); skinned.skeleton.update();
  // bbox from skinned verts
  const box=new THREE.Box3(); const P=skinned.geometry.attributes.position;
  for(let i=0;i<P.count;i+=2){ skinned.getVertexPosition(i,tmp); tmp.applyMatrix4(skinned.matrixWorld); box.expandByPoint(tmp); }
  ants.forEach(a=>{ a.geometry.computeBoundingBox(); box.union(a.geometry.boundingBox.clone().applyMatrix4(a.matrixWorld)); });
  const c=box.getCenter(V3()), sz=box.getSize(V3());
  fix.position.set(-c.x,-c.y,-c.z);
  D.height=sz.y; D.fix=fix; D.fix0=fix.position.clone(); D.pivot=pivot; D.skinned=skinned; D.ants=ants; D.timeScale=.8;
  D.place=(x,y,z,h,ry)=>{ pivot.position.set(x,y,-z); pivot.scale.setScalar(h/D.height); pivot.rotation.y=ry; pivot.updateMatrixWorld(true); };
  D.place(0,70,0,640,-1.2);
  // antler axis (shared geometry)
  const ag=ants[0].geometry; const pts=geoPoints(ag); const {m,e}=pca(pts);
  let mn=1e9,mx=-1e9; pts.forEach(p=>{ const d=tmp.copy(p).sub(m).dot(e); mn=Math.min(mn,d); mx=Math.max(mx,d); });
  // base = end nearer the head bone
  const head=ants[0].parent; const hw=head.getWorldPosition(V3()); const hl=ants[0].worldToLocal(hw.clone());
  const endA=m.clone().addScaledVector(e,mn), endB=m.clone().addScaledVector(e,mx);
  let axD=e.clone(), axO=endA, axL=mx-mn; if(endB.distanceTo(hl)<endA.distanceTo(hl)){ axD.negate(); axO=endB; }
  D.ua.uAxO.value.copy(axO); D.ua.uAxD.value.copy(axD); D.ua.uAxL.value=axL; D.antAxis={axO,axD,axL,m,e};
  // samples on skinned body
  const r=rng(5), T=tri(skinned.geometry), cdf=areaCDF(T); const uv=skinned.geometry.attributes.uv; const lm=imgLum(sm.map,256);
  const NS=4300, S=[]; const vmap=new Map(), vids=[];
  const slot=v=>{ if(!vmap.has(v)){ vmap.set(v,vids.length); vids.push(v);} return vmap.get(v); };
  for(let k=0;k<NS;k++){ const t=pick(cdf,r()); const r1=Math.sqrt(r()), r2=r(); const w0=1-r1, w1=r1*(1-r2), w2=r1*r2;
    const a=T.I(t,0), b=T.I(t,1), cc=T.I(t,2);
    const u0=uv.getX(a)*w0+uv.getX(b)*w1+uv.getX(cc)*w2, v0=uv.getY(a)*w0+uv.getY(b)*w1+uv.getY(cc)*w2;
    const lum=lumAt(lm,u0,v0), loc=(lumAt(lm,u0+.012,v0)+lumAt(lm,u0-.012,v0)+lumAt(lm,u0,v0+.012)+lumAt(lm,u0,v0-.012))/4;
    S.push({s:[slot(a),slot(b),slot(cc)], w:[w0,w1,w2], lum, con:lum-loc}); }
  D.samples=S; D.vids=vids; D.vpos=new Float32Array(vids.length*3);
  { pivot.updateMatrixWorld(true); skinned.skeleton.update(); const c=V3(); for(const v of vids){ skinned.getVertexPosition(v,tmp); tmp.applyMatrix4(skinned.matrixWorld); c.add(tmp); } c.multiplyScalar(1/vids.length); D.c0=pivot.worldToLocal(c); }
  // antler samples (rigid, local)
  const AS=[]; const tA=tri(ag), cA=areaCDF(tA); const A=V3(),B=V3(),C=V3();
  ants.forEach((ant,ai)=>{ for(let k=0;k<1500;k++){ const t=pick(cA,r()); const r1=Math.sqrt(r()), r2=r(); A.fromBufferAttribute(tA.pos,tA.I(t,0)); B.fromBufferAttribute(tA.pos,tA.I(t,1)); C.fromBufferAttribute(tA.pos,tA.I(t,2));
    const p=A.multiplyScalar(1-r1).add(B.multiplyScalar(r1*(1-r2))).add(C.multiplyScalar(r1*r2)).clone(); const h=tmp.copy(p).sub(axO).dot(axD)/axL; AS.push({ant, p, h}); } });
  D.antSamples=AS;
  // main-beam centerline (ant-local), traced from the tip downward so the brow tine is ignored
  { const NB=40, bins=[...Array(NB)].map(()=>[]); const perp=(p,c)=>{ const d=V3().copy(p).sub(c); d.addScaledVector(axD,-d.dot(axD)); return d.length(); };
    pts.forEach(p=>{ const h=tmp.copy(p).sub(axO).dot(axD)/axL; bins[Math.max(0,Math.min(NB-1,Math.floor(h*NB)))].push(p); });
    const cl=new Array(NB); let prev=null, prevR=0;
    for(let b=NB-1;b>=0;b--){ let L=bins[b]; if(!L.length){ cl[b]=prev? {c:prev.clone(),r:prevR} : {c:axO.clone().addScaledVector(axD,axL*(b+.5)/NB), r:axL*.03}; continue; }
      if(prev){ const K=L.filter(p=>perp(p,prev)<Math.max(prevR*2.4, axL*.05)); if(K.length>=3) L=K; }
      const c=V3(); L.forEach(p=>c.add(p)); c.multiplyScalar(1/L.length);
      const hm=(b+.5)/NB; c.sub(axO); c.addScaledVector(axD, hm*axL - c.dot(axD)); c.add(axO);
      const rs=L.map(p=>perp(p,c)).sort((x,y)=>x-y); const r=rs[Math.floor(rs.length*.6)]||axL*.03;
      cl[b]={c, r}; prev=c; prevR=r; }
    // smooth
    for(let it=0;it<2;it++) for(let b=1;b<NB-1;b++){ cl[b].c.lerp(V3().copy(cl[b-1].c).add(cl[b+1].c).multiplyScalar(.5),.5); }
    const any=Math.abs(axD.y)<.9? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0); const u1=V3().crossVectors(axD,any).normalize(), u2=V3().crossVectors(axD,u1).normalize();
    D.antCL={cl, NB, u1, u2}; }
  // spot candidates: highest local contrast
  const idx=S.map((s,i)=>i).filter(i=>S[i].lum>.55).sort((a,b)=>S[b].con-S[a].con); D.spotIdx=idx.slice(0,90);
}
/* The rig's root joints sit far from the mesh, so tiny pelvis rotations swing the whole deer around.
   Stabilise in place: keep the body centroid pinned to where it was at bind time (pivot-local). */
const cW=new THREE.Vector3(), cT=new THREE.Vector3(), qI=new THREE.Quaternion();
R3.deerUpdatePose=function(){ const D=R3.deer; if(D.poseFrame===R3.frame) return; D.poseFrame=R3.frame;
  for(let pass=0;pass<2;pass++){
    D.pivot.updateMatrixWorld(true); D.skinned.skeleton.update(); const mw=D.skinned.matrixWorld, vp=D.vpos; cW.set(0,0,0);
    for(let i=0;i<D.vids.length;i++){ D.skinned.getVertexPosition(D.vids[i],tmp); tmp.applyMatrix4(mw); vp[i*3]=tmp.x; vp[i*3+1]=tmp.y; vp[i*3+2]=-tmp.z; cW.add(tmp); }
    if(!D.c0) return; cW.multiplyScalar(1/D.vids.length); cT.copy(D.c0).applyMatrix4(D.pivot.matrixWorld);
    const e=cW.sub(cT); if(e.lengthSq()<0.25) return;
    // world error -> fix-local (pivot local) and shift
    e.applyQuaternion(qI.copy(D.pivot.quaternion).invert()).multiplyScalar(1/D.pivot.scale.x); D.fix.position.sub(e);
  } };
R3.deerSample=function(i,out,k){ const D=R3.deer, s=D.samples[i], vp=D.vpos; let x=0,y=0,z=0; for(let j=0;j<3;j++){ const o=s.s[j]*3, w=s.w[j]; x+=vp[o]*w; y+=vp[o+1]*w; z+=vp[o+2]*w; } out[k]=x; out[k+1]=y; out[k+2]=z; };
R3.antSample=function(i,out,k,grow){ const s=R3.deer.antSamples[i]; tmp.copy(s.p);
  if(grow!=null && s.h>grow){ const ax=R3.deer.antAxis; tmp.copy(ax.axO).addScaledVector(ax.axD, grow*ax.axL).lerp(s.p,.15); }
  tmp.applyMatrix4(s.ant.matrixWorld); out[k]=tmp.x; out[k+1]=tmp.y; out[k+2]=-tmp.z; };
R3.antCenter=function(){ const D=R3.deer; const c=V3(); D.ants.forEach(a=>{ a.updateMatrixWorld(true); const ax=D.antAxis; c.add(tmp.copy(ax.axO).addScaledVector(ax.axD,ax.axL*.55).applyMatrix4(a.matrixWorld)); }); c.multiplyScalar(1/D.ants.length);
  const top=V3(); D.ants.forEach(a=>{ const ax=D.antAxis; const t=tmp.copy(ax.axO).addScaledVector(ax.axD,ax.axL).applyMatrix4(a.matrixWorld); if(t.y>top.y||top.y===0) top.copy(t); });
  const base=tmp2.copy(D.antAxis.axO).applyMatrix4(D.ants[0].matrixWorld);
  return {x:c.x,y:c.y,z:-c.z, h:Math.abs(top.y-base.y)*1.25}; };

const tmp3=new THREE.Vector3();
R3.antCLat=function(ai,h,out,k,rr,th){ const D=R3.deer, A=D.antCL, n=A.NB; const x=Math.max(0,Math.min(n-1.001,h*n-.5)); const i=Math.floor(x), f=x-i;
  const a=A.cl[i], b=A.cl[Math.min(n-1,i+1)]; tmp3.copy(a.c).lerp(b.c,f); const r=(a.r+(b.r-a.r)*f)*(rr||0);
  if(r){ tmp3.addScaledVector(A.u1,Math.cos(th||0)*r).addScaledVector(A.u2,Math.sin(th||0)*r); }
  const ant=D.ants[ai]; tmp3.applyMatrix4(ant.matrixWorld); out[k]=tmp3.x; out[k+1]=tmp3.y; out[k+2]=-tmp3.z; return a.r+(b.r-a.r)*f; };
R3.antScale=function(ai){ const e=R3.deer.ants[ai].matrixWorld.elements; return Math.hypot(e[0],e[1],e[2]); };
/* ---------------- tower (scaled antler) ---------------- */
function setupTower(){
  const D=R3.deer, T=R3.tower={}; const ax=D.antAxis; const geo=D.ants[0].geometry;
  T.u=U(.9); T.u.uAxO.value.copy(ax.axO); T.u.uAxD.value.copy(ax.axD); T.u.uAxL.value=ax.axL; T.u.uHeat.value=0;
  const am=D.ants[0].material;
  const mat=patch(new THREE.MeshStandardMaterial({ color:0x1a2c48, roughness:.7, envMapIntensity:.2, polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1 }), T.u, 'tower-f', 1);
  const mesh=new THREE.Mesh(geo, mat);
  { const w=new THREE.Mesh(geo, patch(new THREE.MeshStandardMaterial({ color:0x000000, wireframe:true, transparent:true, depthWrite:false }), T.u, 'tower-w', 3)); w.frustumCulled=false; w.renderOrder=2; mesh.add(w); } const hold=new THREE.Group(); hold.add(mesh); scene.add(hold);
  mesh.position.copy(ax.axO).negate();               // base at origin
  T.mesh=mesh; T.hold=hold; T.hold.visible=false;
  T.place=(x,y,H,yaw)=>{ hold.position.set(x,y,0); const q=new THREE.Quaternion().setFromUnitVectors(ax.axD,new THREE.Vector3(0,1,0)); const qy=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
    hold.quaternion.copy(qy.multiply(q)); hold.scale.setScalar(H/ax.axL); hold.updateMatrixWorld(true); };
  // surface samples (local)
  const r=rng(9), Tt=tri(geo), cdf=areaCDF(Tt); const A=V3(),B=V3(),C=V3(); T.samples=[];
  for(let k=0;k<3800;k++){ const t=pick(cdf,r()); const r1=Math.sqrt(r()), r2=r(); A.fromBufferAttribute(Tt.pos,Tt.I(t,0)); B.fromBufferAttribute(Tt.pos,Tt.I(t,1)); C.fromBufferAttribute(Tt.pos,Tt.I(t,2));
    const p=A.multiplyScalar(1-r1).add(B.multiplyScalar(r1*(1-r2))).add(C.multiplyScalar(r1*r2)).clone(); T.samples.push({p, h:tmp.copy(p).sub(ax.axO).dot(ax.axD)/ax.axL}); }
  T.verts=geoPoints(geo);
}
R3.towerPlace=function(x,y,H,yaw){ const T=R3.tower; T.place(x,y,H,yaw);
  // centerline bins in particle coords
  const NB=48, bins=[...Array(NB)].map(()=>[]); const ax=R3.deer.antAxis;
  T.verts.forEach(p=>{ const h=tmp.copy(p).sub(ax.axO).dot(ax.axD)/ax.axL; const b=Math.max(0,Math.min(NB-1,Math.floor(h*NB))); const w=tmp2.copy(p).applyMatrix4(T.mesh.matrixWorld); bins[b].push([w.x,w.y,-w.z]); });
  T.cl=[]; let last=[x,y,0,40];
  for(let b=0;b<NB;b++){ const L=bins[b]; if(!L.length){ T.cl.push(last.slice()); continue; }
    let mx=L.reduce((a,p)=>a+p[0],0)/L.length, mz=L.reduce((a,p)=>a+p[2],0)/L.length;
    // keep main beam: nearest 55% to the beam line (x of the top bins dominates later), iterate twice
    for(let it=0;it<2;it++){ const d=L.map(p=>Math.hypot(p[0]-mx,p[2]-mz)).sort((a,b)=>a-b); const th=d[Math.floor(d.length*.55)]||0; const K=L.filter(p=>Math.hypot(p[0]-mx,p[2]-mz)<=th+1e-6); if(K.length){ mx=K.reduce((a,p)=>a+p[0],0)/K.length; mz=K.reduce((a,p)=>a+p[2],0)/K.length; } }
    const rads=L.map(p=>Math.hypot(p[0]-mx,p[2]-mz)).sort((a,b)=>a-b); const rr=rads[Math.floor(rads.length*.5)]||20;
    const yy=L.reduce((a,p)=>a+p[1],0)/L.length; last=[mx,yy,mz,rr]; T.cl.push(last.slice()); }
  return T.cl; };
R3.towerSample=function(i,out,k){ const s=R3.tower.samples[i]; tmp.copy(s.p).applyMatrix4(R3.tower.mesh.matrixWorld); out[k]=tmp.x; out[k+1]=tmp.y; out[k+2]=-tmp.z; return s.h; };
R3.towerCL=function(h){ const cl=R3.tower.cl, n=cl.length; const x=Math.max(0,Math.min(n-1.001,h*n-.5)); const i=Math.floor(x), f=x-i, a=cl[Math.max(0,i)], b=cl[Math.min(n-1,i+1)];
  return [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f, a[2]+(b[2]-a[2])*f, a[3]+(b[3]-a[3])*f]; };

/* ---------------- ampoule ---------------- */
const AMP_TONE=window.AMP_TONE||{metal:0xc4ccd8, clear:0xdcebff, core:0xe9f2fb, sheen:0xbfe0ff, ink:0x3c4b62};
function frosted(){ return new THREE.MeshPhysicalMaterial({ color:0xeef4fa, roughness:.38, metalness:0, clearcoat:.6, clearcoatRoughness:.35, sheen:.4, sheenColor:new THREE.Color(0xcfe8ff), sheenRoughness:.4, envMapIntensity:.9 }); }
function setupAmp(g){
  const A=R3.amp={}; const root=g.scene; A.u=U(1.6);
  const meshes=[]; root.traverse(o=>{ if(o.isMesh){ meshes.push(o); o.frustumCulled=false; } });
  root.updateMatrixWorld(true);
  // new single-ampoule GLB (Blender): satin silver push base, clear lower cartridge, frosted reservoir + sealed head, pearl essence insert, grey printing
  const T=AMP_TONE;
  const shell=patch(Object.assign(frosted(),{transparent:true,opacity:.8,depthWrite:true,roughness:.3,clearcoat:1,clearcoatRoughness:.12}), A.u, 'amp-shell', 4);
  const grey=patch(new THREE.MeshPhysicalMaterial({color:T.metal, metalness:.85, roughness:.26, envMapIntensity:1.2}), A.u, 'amp-grey');
  const clear=patch(new THREE.MeshPhysicalMaterial({color:T.clear, metalness:0, roughness:.08, clearcoat:1, clearcoatRoughness:.05, transparent:true, opacity:.42, depthWrite:false, envMapIntensity:1.4, side:THREE.DoubleSide}), A.u, 'amp-clear');
  const core=patch(new THREE.MeshPhysicalMaterial({color:T.core, metalness:0, roughness:.42, sheen:.6, sheenColor:new THREE.Color(T.sheen), sheenRoughness:.4, envMapIntensity:.8}), A.u, 'amp-core', 4);
  const ink=patch(new THREE.MeshPhysicalMaterial({color:T.ink, roughness:.5, metalness:.2, envMapIntensity:.5, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-2}), A.u, 'amp-ink');
  let base=null;
  meshes.forEach(m=>{ const nm=(m.material&&m.material.name)||'';
    if(/print/i.test(nm)){ m.material=ink; m.renderOrder=3; m.userData.label=1; }
    else if(/silver/i.test(nm)){ m.material=grey; base=base||m; m.renderOrder=0; }
    else if(/clear/i.test(nm)){ m.material=clear; m.renderOrder=2; }
    else if(/essence|pearl/i.test(nm)){ m.material=core; m.renderOrder=0; }
    else { m.material=shell; m.renderOrder=1; } });
  // principal axis from all vertices (world)
  const pts=[]; meshes.forEach(m=>{ const p=m.geometry.attributes.position; for(let i=0;i<p.count;i+=7) pts.push(V3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld)); });
  const {m:c,e}=pca(pts); const bc=new THREE.Box3().setFromObject(base).getCenter(V3());
  if(bc.clone().sub(c).dot(e)>0) e.negate();             // e points from base to tip
  let mn=1e9,mx=-1e9; pts.forEach(p=>{ const d=tmp.copy(p).sub(c).dot(e); mn=Math.min(mn,d); mx=Math.max(mx,d); });
  const fix=new THREE.Group(); fix.add(root); root.position.sub(c);
  fix.quaternion.setFromUnitVectors(e,new THREE.Vector3(0,1,0));
  const pivot=new THREE.Group(); pivot.add(fix); scene.add(pivot); A.pivot=pivot; A.len=mx-mn; A.mid=(mx+mn)/2; root.position.addScaledVector(e,-(A.mid));
  // re-center along axis
  A.place=(x,y,z,h,ry,rz)=>{ pivot.position.set(x,y,-z); pivot.scale.setScalar(h/A.len); pivot.rotation.set(0,ry||0,rz||0); pivot.updateMatrixWorld(true); };
  A.place(0,0,0,600,0); pivot.visible=false;
  A.samples=surfSamples(meshes.filter(m=>!m.userData.label && !/clear|cartridge/i.test(m.name)), 2600, 21);
}
function surfSamples(meshes, n, seed){ const r=rng(seed); const per=meshes.map(m=>{ m.updateMatrixWorld(true); const T=tri(m.geometry); const c=areaCDF(T, m.matrixWorld); return {m,T,c}; });
  const tot=per.reduce((a,q)=>a+q.c.s,0); const out=[]; const A=V3(),B=V3(),C=V3();
  per.forEach(q=>{ const k=Math.round(n*q.c.s/tot); for(let j=0;j<k;j++){ const t=pick(q.c,r()); const r1=Math.sqrt(r()), r2=r();
    A.fromBufferAttribute(q.T.pos,q.T.I(t,0)); B.fromBufferAttribute(q.T.pos,q.T.I(t,1)); C.fromBufferAttribute(q.T.pos,q.T.I(t,2));
    out.push({m:q.m, p:A.multiplyScalar(1-r1).add(B.multiplyScalar(r1*(1-r2))).add(C.multiplyScalar(r1*r2)).clone()}); } });
  out.sort((a,b)=>tmp.copy(b.p).applyMatrix4(b.m.matrixWorld).y - tmp2.copy(a.p).applyMatrix4(a.m.matrixWorld).y);
  return out; }
R3.objSample=function(list,i,out,k){ const s=list[i]; tmp.copy(s.p).applyMatrix4(s.m.matrixWorld); out[k]=tmp.x; out[k+1]=tmp.y; out[k+2]=-tmp.z; };

/* ---------------- gift box ---------------- */
const BOX_GLOW=window.BOX_GLOW||0x3a4a66;
function setupBox(g){
  const X=R3.box={}; const root=g.scene; X.u=U(55);
  const meshes=[]; root.traverse(o=>{ if(o.isMesh){ meshes.push(o); o.frustumCulled=false; } });
  const fr=patch(frosted(), X.u, 'box-amp');
  meshes.forEach(m=>{ const mt=m.material; const nm=(mt&&mt.name)||'';
    if(/ampoule/i.test(nm)||/ampoule/i.test(m.name)){ m.material=fr; return; }
    const isMet=/collar|inner/i.test(nm), isPrint=/PDF|artwork|Cobalt|printed/i.test(nm);
    if(mt.map){ mt.map.colorSpace=THREE.SRGBColorSpace; mt.map.anisotropy=8; mt.map.needsUpdate=true; }
    const isCard=/Cobalt/i.test(nm);
    const pm=new THREE.MeshPhysicalMaterial({ map:mt.map||null, color:mt.color?mt.color.clone():new THREE.Color(1,1,1), metalness:isMet?.8:(mt.map?.18:(isCard?.32:(mt.metalness||0)*.6)), roughness:isMet?.28:(mt.map?.4:(isCard?.36:Math.max(.34,mt.roughness||.5))),
      clearcoat:isPrint?.5:0, clearcoatRoughness:.22, envMapIntensity:isMet?1.2:1.0, side:mt.side });
    if(isPrint && mt.map){ pm.emissiveMap=mt.map; pm.emissive=new THREE.Color(BOX_GLOW); pm.emissiveIntensity=.35; }
    else if(isCard){ pm.emissive=new THREE.Color(pm.color).multiplyScalar(.12); }
    if(/XPE/i.test(nm)) { pm.color.setRGB(.82,.8,.78); pm.roughness=.9; }
    m.material=patch(pm, X.u, 'box-'+(pm.map?'t':'n')+(isMet?'s':''));
  });
  root.updateMatrixWorld(true); const bb=new THREE.Box3().setFromObject(root); const c=bb.getCenter(V3()), sz=bb.getSize(V3());
  const fix=new THREE.Group(); fix.add(root); root.position.sub(c); const pivot=new THREE.Group(); pivot.add(fix); scene.add(pivot);
  X.pivot=pivot; X.w=sz.x; X.size=sz; pivot.visible=false;
  X.place=(x,y,z,w,ry,rx)=>{ pivot.position.set(x,y,-z); pivot.scale.setScalar(w/X.w); pivot.rotation.set(rx||0,ry||0,0); pivot.updateMatrixWorld(true); };
  X.samples=surfSamples(meshes.filter(m=>!m.isInstancedMesh && !/ampoule|collar/i.test(m.name)), 1800, 33);
}

/* ---------------- dual-chamber ampoule (usage GLB v8: pull ring / press / mix / snap / drip clip) ---------------- */
function patchU(mat, u, key){ const glass=/^u-(shell|cap|rim|ring)$/.test(key);
  mat.onBeforeCompile = sh=>{
    for(const k in u) sh.uniforms[k]=u[k];
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vWP = (modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP;\nuniform float uDis,uFrost,uFrostY,uFrostH,uCut,uLowY,uLowH,uHi;\nuniform vec3 uGlowCol;\n'+NOISE+'\n'+
      sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  float nz = fbm(vWP*.022);
  if(nz < uDis) discard;`).replace('#include <opaque_fragment>', `#include <opaque_fragment>
  float e1 = (1.-smoothstep(0.,.06,nz-uDis))*step(-0.02,uDis);
  float fr = pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.);
  ${glass?`float frG=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.2); vec3 nG=normalize(normal);
  float gradG=.5+.5*nG.y; float strG=exp(-pow((nG.x+.42)/.09,2.))*(.45+.55*gradG)+exp(-pow((nG.x-.62)/.05,2.))*.35;
  vec3 cG=gl_FragColor.rgb*.92*mix(.74,1.06,gradG);
  cG += vec3(.60,.80,1.)*frG*.50 + vec3(.92,.96,1.)*strG*.30;
  gl_FragColor.rgb=cG; gl_FragColor.a=min(1.,gl_FragColor.a*mix(.86,1.3,frG));`:''}
  // frost on the lower (freshness-lock) chamber: icy rim + fine crystalline sparkle, fades upward
  float lowM = 1.-smoothstep(uFrostY, uFrostY+uFrostH, vWP.y);
  float sp = pow(max(0.,vnoise(vWP*.55)-.62)*2.6,3.);
  vec3 ice = vec3(.62,.86,1.);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb*.6+ice*.5, uFrost*lowM*.8) + ice*uFrost*lowM*(fr*1.3+sp*2.2+.08);
  // highlight band for the lower chamber
  float lm = (1.-smoothstep(uLowH*.85, uLowH, abs(vWP.y-uLowY)));
  gl_FragColor.rgb += uGlowCol*uHi*lm*(.25+1.2*fr);
  gl_FragColor.rgb += uGlowCol*e1*2.4;`);
  };
  mat.customProgramCacheKey = ()=>'xu-'+key; return mat; }
function setupUsage(g){
  const S=R3.use={}; const root=g.scene; S.u={ uDis:{value:1.1}, uFrost:{value:0}, uFrostY:{value:0}, uFrostH:{value:60}, uCut:{value:0}, uLowY:{value:0}, uLowH:{value:60}, uHi:{value:0}, uGlowCol:{value:new THREE.Color(0.10,0.62,1.0)} };
  const u=S.u; const meshes=[]; root.traverse(o=>{ if(o.isMesh||o.isPoints){ meshes.push(o); o.frustumCulled=false; } });
  const tr=(o)=>Object.assign(o,{transparent:true,depthWrite:false});
  const M={
    serum: tr(new THREE.MeshPhysicalMaterial({color:0xbfe2ff, roughness:.06, metalness:0, clearcoat:1, clearcoatRoughness:.05, emissive:0x0d3f8c, emissiveIntensity:.55, opacity:.62, side:THREE.DoubleSide, envMapIntensity:1.3})),
    fine: new THREE.MeshStandardMaterial({color:0xf3f8ff, roughness:.7, emissive:0x2a5ea8, emissiveIntensity:.35}),
    flake: new THREE.MeshStandardMaterial({color:0xeef4fb, roughness:.95, emissive:0x1d4b8f, emissiveIntensity:.3}),
    shell: tr(new THREE.MeshPhysicalMaterial({color:0xe4eef9, roughness:.32, metalness:0, clearcoat:.6, clearcoatRoughness:.3, sheen:.4, sheenColor:new THREE.Color(0xcfe8ff), envMapIntensity:1.0, side:THREE.DoubleSide})),
    rim: new THREE.MeshPhysicalMaterial({color:0xdde8f4, roughness:.3, clearcoat:.5, envMapIntensity:1.0}),
    cap: new THREE.MeshPhysicalMaterial({color:0xa9bad2, roughness:.3, metalness:.15, clearcoat:.5, envMapIntensity:1.1}),
    tail: tr(new THREE.MeshPhysicalMaterial({color:0x6880a6, roughness:.36, metalness:.3, clearcoat:.5, envMapIntensity:1.1, side:THREE.DoubleSide})),
    ink: new THREE.MeshStandardMaterial({color:0x173a78, roughness:.5, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-2}),
    ring: tr(new THREE.MeshPhysicalMaterial({color:0xd3e2f3, roughness:.3, clearcoat:.4, envMapIntensity:1.0, side:THREE.DoubleSide})) };
  for(const k in M) patchU(M[k], u, 'u-'+k);
  const pm = new THREE.PointsMaterial({color:0xeaf5ff, size:3.2, sizeAttenuation:true, transparent:true, opacity:.9, depthWrite:false, blending:THREE.AdditiveBlending});
  S.M=M; S.pm=pm; S.parts={};
  meshes.forEach(m=>{ const nm=(m.material&&m.material.name)||'';
    if(m.isPoints){ m.material=pm; m.renderOrder=4; return; }
    if(/Serum/i.test(nm)){ m.material=M.serum; m.renderOrder=3; }
    else if(/fine_powder/i.test(nm)) m.material=M.fine;
    else if(/freeze_dried/i.test(nm)) m.material=M.flake;
    else if(/Frosted_shell/i.test(nm)){ m.material=M.shell; m.renderOrder=5; }
    else if(/shell_rims/i.test(nm)) m.material=M.rim;
    else if(/Head_cap/i.test(nm)) m.material=M.cap;
    else if(/Grey_tail/i.test(nm)){ m.material=M.tail; m.renderOrder=5; }
    else if(/Label_ink/i.test(nm)){ m.material=M.ink; m.renderOrder=6; }
    else if(/Safety_ring/i.test(nm)){ m.material=M.ring; m.renderOrder=5; }
    S.parts[m.name]=m; });
  S.mixer=new THREE.AnimationMixer(root); S.clip=g.animations[0]; S.act=S.mixer.clipAction(S.clip); S.act.play(); S.mixer.setTime(0);
  // the export tilts PRODUCT_ROOT / RING_WORLD_CTRL into the pouring pose (fixed rotation); the jet + drops are in world space for that pose.
  // uPour blends from upright (0) to the exported pouring pose (1).
  const PR=root.getObjectByName('PRODUCT_ROOT_FIXED_ORIENTATION'), RW=root.getObjectByName('RING_WORLD_CTRL');
  S.PR=PR; S.qPour=PR.quaternion.clone(); S.qUp=new THREE.Quaternion(); S.pour=0; S.press=root.getObjectByName('PRESS_CTRL');
  const loc=(re)=>{ const b=new THREE.Box3(); meshes.forEach(m=>{ if(m.isMesh && re.test(m.name)){ m.geometry.computeBoundingBox(); let o=m, M=new THREE.Matrix4(); while(o && o!==PR){ o.updateMatrix(); M.premultiply(o.matrix); o=o.parent; } b.union(m.geometry.boundingBox.clone().applyMatrix4(M)); } }); return b; };
  S.mixer.setTime(0);
  const body=loc(/GEO_(Body|HeadSeal|GreyBase)/), low=loc(/GreyBase|PowderCup|TailLip/), lab=loc(/Label/);
  const cL=body.getCenter(V3()); S.len=body.getSize(V3()).y;
  S.lowC=low.getCenter(V3()).sub(cL); S.lowH=low.getSize(V3()).y; S.top=new THREE.Vector3(0,body.max.y-cL.y,0); S.bot=new THREE.Vector3(0,body.min.y-cL.y,0); S.cL=cL;
  const lc=lab.getCenter(V3()); S.front=Math.atan2(lc.x, lc.z);
  const fix=new THREE.Group(); fix.add(root); const pivot=new THREE.Group(); pivot.add(fix); scene.add(pivot);
  const PRp=PR.position.clone();   // (0,1,0)
  S.pivot=pivot; pivot.visible=false;
  S.orient=()=>{ const q=S.qUp.clone().slerp(S.qPour,S.pour); PR.quaternion.copy(q); RW.quaternion.copy(q);
    // keep the body centre on the pivot; while pressing, hold the base still so the body travels down (pressed from the top)
    const pr=S.press.position.y; const off=cL.clone().add(new THREE.Vector3(0,(1-S.pour)*pr,0)).applyQuaternion(q); root.position.copy(PRp).add(off).negate().add(PRp).sub(PRp); root.position.set(-(PRp.x+off.x),-(PRp.y+off.y),-(PRp.z+off.z)); };
  S.place=(x,y,z,h,ry,rz)=>{ pivot.position.set(x,y,-z); pivot.scale.setScalar(h/S.len); pivot.rotation.set(0,(ry||0)-S.front,rz||0); S.orient(); pivot.updateMatrixWorld(true);
    const s=h/S.len; u.uLowY.value=y+S.lowC.y*s; u.uLowH.value=S.lowH*.5*s*1.05; u.uFrostY.value=y+(S.lowC.y+S.lowH*.5)*s; u.uFrostH.value=S.len*.1*s; };
  S.place(0,0,0,800,0);
  // pointer-animated material values from the export (KHR_animation_pointer, baked to 15 fps)
  S.curves=window.USAGE_CURVES||null;
  S.ctl={ring:0, snap:0, tipA:1, drops:1};
  const FXN=['FX_LastDrop_00','FX_LastDrop_01','FX_LastDrop_02','FX_FallingSerumJet'].map(n=>root.getObjectByName(n)).filter(Boolean);
  const HS=root.getObjectByName('HEAD_SEPARATION_CTRL'), NECK=new THREE.Vector3(0,1.32,0), qT=new THREE.Quaternion(), zA=new THREE.Vector3(0,0,1), vT=V3();
  M.cap.transparent=true;
  // clean, hand-driven keyframes for the parts the export animates loosely: the ampoule stays one object until the snap
  S.drive=()=>{ const k=S.ctl, q=PR.quaternion;
    const er=k.ring*k.ring*(3-2*k.ring);                    // pull ring: slides out sideways off the body, then is gone
    RW.position.copy(PRp).add(vT.set(1.25*er, -.35*er, .15*er).applyQuaternion(q)); RW.quaternion.copy(q);
    const es=k.snap*k.snap*(3-2*k.snap);                    // snap: tip hinges ~16 deg at the neck, lifts a little
    qT.setFromAxisAngle(zA,-.28*es); HS.quaternion.copy(qT); HS.position.copy(NECK).sub(vT.copy(NECK).applyQuaternion(qT)).add(vT.set(.10*es,.22*es,0));
    if(k.drops<1) FXN.forEach(n=>n.scale.multiplyScalar(Math.max(0,k.drops))); };
  S.setTime=(t, ov)=>{ S.mixer.setTime(Math.max(0,Math.min(19.9,t))); S.orient(); S.drive(); const C=S.curves; ov=ov||{};
    const at=(arr)=>{ const x=Math.max(0,Math.min(arr.length-1.001,t*15)), i=Math.floor(x), f=x-i; return arr[i].map((v,k)=>v+(arr[i+1][k]-v)*f); };
    const a4=C?at(C.mats['4'])[3]:1, a7=C?at(C.mats['7'])[3]:1, a9=C?at(C.mats['9'])[3]:1, a3=C?at(C.mats['3'])[3]:.32;
    const sh=ov.shell!=null? ov.shell : a4, tl=ov.tail!=null? ov.tail : a7, G=ov.fade!=null? ov.fade : 1;
    M.shell.opacity=sh*G; M.shell.depthWrite=sh>.95; M.tail.opacity=tl*G; M.tail.depthWrite=tl>.95;
    const ra=1-Math.max(0,Math.min(1,(S.ctl.ring-.55)/.45)); M.ring.opacity=ra*G; M.ring.visible=ra>.01; M.cap.opacity=S.ctl.tipA*G; M.cap.depthWrite=S.ctl.tipA>.95; M.cap.visible=S.ctl.tipA>.01;
    M.serum.opacity=Math.min(1,.35+a3*1.0)*G; pm.opacity=.9*G; };
  // world point of a local offset (particle coords: y up, z toward the viewer is negative)
  S.wp=(v)=>{ PR.updateMatrixWorld(true); const w=v.clone().add(cL).applyMatrix4(PR.matrixWorld); return [w.x, w.y, -w.z]; };
  S.nodeWP=(name)=>{ const n=root.getObjectByName(name); if(!n) return null; const v=n.getWorldPosition(V3()); return [v.x,v.y,-v.z]; };
}

R3.frame=0;
R3.update=function(dt){ if(!R3.ok) return; R3.frame++; const D=R3.deer; if(D.pivot.visible){ D.mixer.update(dt*D.timeScale); R3.deerUpdatePose(); } };
R3.render=function(cam){ if(!R3.ok) return; R3.applyStudio(); camera.position.set(cam.x,cam.y,-cam.z); camera.updateMatrixWorld(); renderer.render(scene,camera); };
R3.crossfade=function(name,dur){ const D=R3.deer, a=D.act[name]; if(!a||a===D.cur) return; a.reset().play(); if(D.cur) D.cur.crossFadeTo(a,dur||1.2,false); D.cur=a; };
})();
