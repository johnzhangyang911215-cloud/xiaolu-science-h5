/* 小鹿精华 H5 demo — scene choreography */
(function(){
const {W,H,cam,rnd,mulberry,catmull,resample,textSamples,toWorld,project,makeFormation,morphTo,fx,flare,ghost} = PX;
const $ = s=>document.querySelector(s), $$ = s=>Array.from(document.querySelectorAll(s));
const Q = new URLSearchParams(location.search);
const AUTO = Q.get('auto')==='1', CAPTURE = Q.get('capture')==='1';
const stage = $('#stage');
function fit(){ const s=Math.min(innerWidth/1920, innerHeight/1080); stage.style.transform=`translate(${(innerWidth-1920*s)/2}px,${(innerHeight-1080*s)/2}px) scale(${s})`; }
addEventListener('resize',fit); fit();
gsap.ticker.lagSmoothing(0);
const lerp=(a,b,t)=>a+(b-a)*t, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), sm=t=>t*t*(3-2*t);
const ease3=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

/* ---------- cameras per region ---------- */
const CAM0 = {x:0,y:0,z:-1000};
// deer photo placement (screen) -> antler anchor
const DEER = {left:708, top:110, h:680}; DEER.s = DEER.h/DEER_PTS.h; DEER.w = DEER_PTS.w*DEER.s;
const tipS = [DEER.left + (DEER_PTS.tips[0][0]+DEER_PTS.tips[1][0])/2*DEER.w, DEER.top + 0.08*DEER.h];
const CAM2 = {x: tipS[0]-960, y: 540-tipS[1]+10, z:-420};
const TX = 2340, BY = -1400, HT = 2800;           // tower
const CAM3a = {x:TX+260, y:BY+300, z:-1000}, CAM3b = {x:TX+260, y:BY+HT-290, z:-1000};
const CAM4 = {x:5400, y:1500, z:-1000};
const HT3 = 2400, TYAW = 2.4;                    // 3D tower (real antler geometry)
const DEER3 = [0,105,0,620,-1.15];                 // x,y,z,height,yaw for the GLB deer
const CAM5 = {x:7800, y:300, z:-1000};
function W_(sx,sy,c,z){ return toWorld(sx,sy,c,z||0); }

/* ---------- formations ---------- */
const F = {};
function buildAll(){
  // INTRO line
  F.line0 = makeFormation(put=>{ const r=mulberry(11);
    for(let i=0;i<3200;i++){ const u=i/3200, x=(u-.5)*1500, c=Math.exp(-Math.pow(x/430,2));
      put(x, PX.gauss(r)*(1.2+2*c), PX.gauss(r)*14, 1.1+1.6*c, .25+.75*c, .55+.45*c); } }, {dust:[0,0]});

  // DEER (from photo alpha mask)
  const dp = DEER_PTS, dS = (u,v)=>W_(DEER.left+u*DEER.w, DEER.top+v*DEER.h, CAM0);
  F.deer = makeFormation((put,f)=>{ const r=mulberry(21); f.spot=[]; f.ant=[];
    for(let i=0;i<dp.edge.length;i+=2){ const p=dS(dp.edge[i],dp.edge[i+1]); put(p[0]+PX.gauss(r)*.6,p[1]+PX.gauss(r)*.6,PX.gauss(r)*4,1.5,.8,.6); }
    for(let i=0;i<dp.ant.length;i+=2){ const p=dS(dp.ant[i],dp.ant[i+1]); f.ant.push(put(p[0],p[1],PX.gauss(r)*5,1.3,.32,.75)); }
    for(let i=0;i<dp.fill.length;i+=3){ const p=dS(dp.fill[i],dp.fill[i+1]), L=dp.fill[i+2]; put(p[0],p[1],PX.gauss(r)*22,1.15,.08+.34*L*L,.35+.45*L); }
    const e=dS(dp.eye[0],dp.eye[1]); put(e[0],e[1],0,3.2,1,1);
    for(let i=0;i<dp.spots.length;i+=3){ const p=dS(dp.spots[i],dp.spots[i+1]); f.spot.push(put(p[0],p[1],-4,2.6+Math.min(2,dp.spots[i+2]/40),.95,.95)); }
  }, {dust:[0,0], params:{drift:0, antGlow:0}, update:(t,f)=>{
    const k=f.params.drift, g=f.params.antGlow, n=f.spot.length;
    for(let j=0;j<n;j++){ const i=f.spot[j], tgt=f.ant[(j*37)%f.ant.length];
      const l=ease3(clamp(k*1.6-j/n*.6,0,1)); const bx=f.base[i*3],by=f.base[i*3+1], tx=f.base[tgt*3], ty=f.base[tgt*3+1];
      const cx=(bx+tx)/2+60, cy=Math.max(by,ty)+90, u=1-l;
      f.pos[i*3]=u*u*bx+2*u*l*cx+l*l*tx; f.pos[i*3+1]=u*u*by+2*u*l*cy+l*l*ty;
      f.att[i*4+1]=.95*(1-l*.85) + Math.sin(l*Math.PI)*.3; }
    for(const i of f.ant){ f.att[i*4+1]=f.baseA[i*4+1]*(1+.15*g); f.att[i*4+2]=.75+.25*g; f.att[i*4]=1.5+.3*g; }
  }});

  // S2 二杠 antler growing
  F.ant = (function(){ const sc=.62, ox=960, oy=470, cx0=468, cy0=510;
    const br = SHAPES.erGang.map(b=>{ const sp=resample(catmull(b.p.map(q=>[ox+(q[0]-cx0)*sc, oy+(q[1]-cy0)*sc]),false,10),220,false); return {sp, r0:b.r[0]*sc*.95, r1:b.r[1]*sc*.95, g0:b.g0}; });
    const spine=(b,s)=>{ const a=b.sp, x=s*(a.length-1), i=Math.min(a.length-2,Math.floor(x)), f=x-i; return [a[i].x+(a[i+1].x-a[i].x)*f, a[i].y+(a[i+1].y-a[i].y)*f, a[i].nx, a[i].ny]; };
    const rec=[]; const zk=-CAM2.z/1000;
    const f = makeFormation(put=>{ const r=mulberry(31);
      br.forEach((b,bi)=>{ const cnt = bi===0? 3600 : 1500;
        for(let k=0;k<cnt;k++){ const s=Math.pow(k/cnt,.95), th=r()*Math.PI*2; let rad=lerp(b.r0,b.r1,s);
          if(s>.9) rad*=Math.sqrt(Math.max(.06,1-Math.pow((s-.9)/.1,2)));
          if(bi===0 && s<.035) rad*=1.3;
          const fuzz = r()<.14? 1.18 : 1; const c=Math.cos(th);
          const rim = .22+.78*Math.pow(Math.abs(c),3);
          const i = put(0,0,0, fuzz>1?1.1:1.5, (fuzz>1?.3:1)*rim*(.6+.4*s), .5+.45*s);
          rec.push({i,bi,s,ox:c*rad*fuzz,oz:Math.sin(th)*rad*fuzz*zk}); } }); }, {dust:[CAM2.x,CAM2.y], params:{G:1}, update:(t,f)=>{
        const G=f.params.G;
        for(const q of rec){ const b=br[q.bi]; const gg = q.bi===0? q.s : b.g0 + q.s*.5; let s=q.s, grown=gg<=G, ox=q.ox, oz=q.oz;
          if(!grown){ s = q.bi===0? G : clamp((G-b.g0)/.5,0,1); ox*=.35; oz*=.35; }
          const sp=spine(b,s); const w=W_(sp[0]+sp[2]*ox, sp[1]+sp[3]*ox, CAM2);
          f.pos[q.i*3]=w[0]; f.pos[q.i*3+1]=w[1]; f.pos[q.i*3+2]=oz;
          f.att[q.i*4+1] = grown? f.baseA[q.i*4+1] : .05; } }});
    f.tip = ()=>{ const G=f.params.G; const sp=spine(br[0],Math.min(1,G)); return [sp[0],sp[1]]; };
    return f; })();

  // S3 line then tower
  F.line3 = makeFormation(put=>{ const r=mulberry(41);
    for(let i=0;i<5200;i++){ const u=i/5200, x=(u-.5)*1500, c=Math.exp(-Math.pow(x/500,2));
      put(TX+x, BY+PX.gauss(r)*(1+2*c), PX.gauss(r)*12, 1.1+1.4*c, .25+.7*c, .5+.4*c); } }, {dust:[CAM3a.x,CAM3a.y]});
  F.tower = (function(){ const RR=h=>{ let r=118*(1-.16*h); if(h>.955) r*=Math.sqrt(Math.max(0,1-Math.pow((h-.955)/.045,2))); return r; };
    const cxh=h=>TX+34*Math.sin(h*2.2)-10;
    const shell=[], flow=[], crown=[], slice=[];
    const f = makeFormation(put=>{ const r=mulberry(51);
      for(let k=0;k<3600;k++){ const h=1-Math.pow(1-k/3600,1.2); shell.push({i:put(0,0,0,1.3+1.3*h,.1,h), h, th:r()*6.283}); }
      for(let k=0;k<1300;k++){ flow.push({i:put(0,0,0,1.2,.1,.5), u:r(), v:.035+r()*.05, rr:Math.sqrt(r())*.8, th:r()*6.283}); }
      for(let k=0;k<600;k++){ crown.push({i:put(0,0,0,1.5,.5,.95), h:.88+r()*.11, rr:Math.sqrt(r()), th:r()*6.283}); }
      for(let k=0;k<340;k++){ const ring=k<260; const rr= ring? (1+Math.floor(k/52))/5 : Math.sqrt(r()); slice.push({i:put(0,0,0,1.5,.85,1), rr, ph: ring? (k%52)/52*6.283 + Math.floor(k/52)*.3 : r()*6.283}); }
    }, {dust:[CAM3a.x, BY+HT/2], params:{glow:0, SL:0, flowA:1}, update:(t,f)=>{ const P=f.pos, A=f.att, rot=t*.12, gl=f.params.glow;
      for(const q of shell){ const R=RR(q.h), th=q.th+rot, c=Math.cos(th), y=BY+q.h*HT;
        P[q.i*3]=cxh(q.h)+c*R; P[q.i*3+1]=y; P[q.i*3+2]=Math.sin(th)*R;
        const top = q.h>.88? (1+gl*1.2) : 1;
        A[q.i*4+1]=(.24+.74*Math.pow(q.h,1.4))*(.5+.5*Math.pow(Math.abs(c),3))*top; A[q.i*4+2]=Math.min(1,q.h*1.05); }
      for(const q of flow){ const u=(q.u+t*q.v)%1, h=Math.pow(u,.75), R=RR(h)*q.rr, th=q.th+t*.3;
        P[q.i*3]=cxh(h)+Math.cos(th)*R; P[q.i*3+1]=BY+h*HT; P[q.i*3+2]=Math.sin(th)*R;
        A[q.i*4+1]=Math.pow(Math.sin(Math.PI*u),.6)*(.25+.7*Math.pow(h,1.4))*f.params.flowA; A[q.i*4+2]=.3+.7*h; A[q.i*4]=1+1.4*h; }
      for(const q of crown){ const R=RR(q.h)*q.rr, th=q.th+rot;
        P[q.i*3]=cxh(q.h)+Math.cos(th)*R; P[q.i*3+1]=BY+q.h*HT; P[q.i*3+2]=Math.sin(th)*R; A[q.i*4+1]=.32*(1+gl*1.6); }
      const SL=ease3(f.params.SL), h0=.925, R0=RR(h0)*1.04; const c0=[cxh(h0), BY+h0*HT, 0], c1=[TX+480, BY+HT+20, -60];
      const C=[lerp(c0[0],c1[0],SL), lerp(c0[1],c1[1],SL)+Math.sin(SL*Math.PI)*60, lerp(c0[2],c1[2],SL)];
      const tilt=lerp(.12,1.15,SL), spin=t*.25*SL + rot*(1-SL), sc=lerp(1,1.35,SL);
      for(const q of slice){ const a=q.ph+spin, lx=Math.cos(a)*R0*q.rr*sc, lz=Math.sin(a)*R0*q.rr*sc;
        P[q.i*3]=C[0]+lx; P[q.i*3+1]=C[1]+lz*Math.sin(tilt); P[q.i*3+2]=C[2]+lz*Math.cos(tilt);
        A[q.i*4+1]=(.25+.75*SL)*(q.rr>.98?1:.7)*(1+gl*.5); }
    }});
    f.RR=RR; f.cxh=cxh; f.sliceC=()=>{ const SL=ease3(f.params.SL); return [lerp(cxh(.925),TX+480,SL), lerp(BY+.925*HT,BY+HT+20,SL)+Math.sin(SL*Math.PI)*60, lerp(0,-60,SL)]; };
    return f; })();

  // S4 card points (shared)
  const card = {l:1180,t:150,w:470,h:580};
  function cardPts(put, f){ const r=mulberry(61); f.card=[];
    const per=2*(card.w+card.h);
    for(let k=0;k<700;k++){ let d=k/700*per, x,y; if(d<card.w){x=card.l+d;y=card.t;} else if((d-=card.w)<card.h){x=card.l+card.w;y=card.t+d;} else if((d-=card.h)<card.w){x=card.l+card.w-d;y=card.t+card.h;} else {d-=card.w;x=card.l;y=card.t+card.h-d;}
      const w=W_(x,y,CAM4); f.card.push(put(w[0],w[1],PX.gauss(r)*3,1.3,.8,.7)); }
    const ts=textSamples('Science','92px XDisplay',900,r);
    for(const p of ts){ const w=W_(card.l+34+p[0]+168, card.t+26+46+p[1], CAM4); f.card.push(put(w[0],w[1],PX.gauss(r)*3,1.2,.6,.85)); } }
  const cardUpd=(t,f)=>{ const a=f.params.cardA; for(const i of f.card){ f.att[i*4+1]=f.baseA[i*4+1]*a; } };
  F.helix = makeFormation((put,f)=>{ const r=mulberry(71); f.hx=[];
    for(let k=0;k<2600;k++){ const strand=k%2, rung=k>=2000; const u= rung? Math.floor((k-2000)/15)/40 + .0125 : (k>>1)/1000;
      f.hx.push({i:put(0,0,0,1.4,.8,.7), u, strand, rung, rf:rung? ((k-2000)%15)/14 : 0, j:PX.gauss(r)*1.5}); }
    cardPts(put,f); }, {dust:[CAM4.x,CAM4.y], params:{cardA:1}, update:(t,f)=>{ cardUpd(t,f);
      const x0=160, x1=1000, cy=470, R=118; const zk=1;
      for(const q of f.hx){ const ang=q.u*Math.PI*2*3.2 + t*.55; let y,z,a=ang;
        const sx=lerp(x0,x1,q.u);
        if(q.rung){ const y1=Math.cos(a)*R, z1=Math.sin(a)*R, y2=-y1, z2=-z1; y=lerp(y1,y2,q.rf); z=lerp(z1,z2,q.rf); }
        else { if(q.strand) a+=Math.PI; y=Math.cos(a)*R; z=Math.sin(a)*R; }
        const w=W_(sx, cy+y+q.j, CAM4); f.pos[q.i*3]=w[0]; f.pos[q.i*3+1]=w[1]; f.pos[q.i*3+2]=z*zk;
        const front=.5-.5*Math.sin(a); f.att[q.i*4+1]=(q.rung?.28:.85)*(.3+.7*front); f.att[q.i*4+2]=q.rung?.55:.6+.35*front; } }});
  // phylogeny (rectangular cladogram)
  const LY=[280,370,460,550,640,730], LX=840;
  const nodes={n1:{x:720,y:(LY[4]+LY[5])/2}}; nodes.n2={x:620,y:(LY[3]+nodes.n1.y)/2}; nodes.n3={x:520,y:(LY[2]+nodes.n2.y)/2}; nodes.n4={x:410,y:(LY[1]+nodes.n3.y)/2}; nodes.root={x:290,y:(LY[0]+nodes.n4.y)/2};
  const segs=[]; const S=(x1,y1,x2,y2,hi)=>segs.push({x1,y1,x2,y2,hi});
  S(170,nodes.root.y,nodes.root.x,nodes.root.y,1);
  const kids={root:[[LX,LY[0]],'n4'],n4:[[LX,LY[1]],'n3'],n3:[[LX,LY[2]],'n2'],n2:[[LX,LY[3]],'n1'],n1:[[LX,LY[4]],[LX,LY[5]]]};
  for(const k in kids){ const n=nodes[k]; const ch=kids[k].map(c=>typeof c==='string'?nodes[c]:{x:c[0],y:c[1]});
    S(n.x,ch[0].y,n.x,ch[1].y, .5); ch.forEach((c,ci)=>{ const hiPath = (k!=='n1') && ((ci===1) || (k==='n2'&&ci===0)); S(n.x,c.y,c.x,c.y, hiPath?1:0); }); }
  // highlight path root->n4->n3->n2->Cervidae
  segs.forEach(s=>{ s.hi = s.x1===s.x2 ? .5 : (s.y1===s.y2 && (s.y1===LY[3] && s.x1===nodes.n2.x)) || (s.y1===nodes.n4.y&&s.x1===nodes.root.x) || (s.y1===nodes.n3.y&&s.x1===nodes.n4.x)|| (s.y1===nodes.n2.y&&s.x1===nodes.n3.x) || (s.x1===170) ; });
  F.LEAF = LY.map(y=>[LX+26,y]); F.NODES=nodes;
  F.tree = makeFormation((put,f)=>{ const r=mulberry(81); const tot=segs.reduce((a,s)=>a+Math.hypot(s.x2-s.x1,s.y2-s.y1),0); const pts=[];
    segs.forEach(s=>{ const L=Math.hypot(s.x2-s.x1,s.y2-s.y1), n=Math.round(2300*L/tot);
      for(let k=0;k<n;k++){ const u=k/n; pts.push([lerp(s.x1,s.x2,u), lerp(s.y1,s.y2,u), s.hi]); } });
    LY.forEach((y,li)=>{ for(let k=0;k<(li===3?90:40);k++){ const a=r()*6.283, rr=Math.sqrt(r())*(li===3?9:5); pts.push([LX+Math.cos(a)*rr, y+Math.sin(a)*rr, li===3?2:1.5]); } });
    pts.sort((a,b)=>a[0]-b[0]);
    for(const p of pts){ const w=W_(p[0]+PX.gauss(r)*.7,p[1]+PX.gauss(r)*.7,CAM4); const hi=p[2];
      put(w[0],w[1],PX.gauss(r)*4, hi>=1.5?1.9:(hi?1.7:1.2), hi===2?1:hi===1.5?.6:hi===.5?.42:hi?1:.3, hi===.5?.6:hi?.95:.5); }
    cardPts(put,f); }, {dust:[CAM4.x,CAM4.y], params:{cardA:.22}, update:cardUpd});

  // S5 ampoule & end
  const AMP_B={l:636,t:120,h:660}; AMP_B.w=AMP_B.h*PRODUCT_PTS.ampoule.w/PRODUCT_PTS.ampoule.h;
  const AMP_C={l:540,t:300,h:540}; AMP_C.w=AMP_C.h*PRODUCT_PTS.ampoule.w/PRODUCT_PTS.ampoule.h;
  const BOX={l:705,t:350,w:680}; BOX.h=BOX.w*PRODUCT_PTS.giftbox.h/PRODUCT_PTS.giftbox.w;
  F.AMP_B=AMP_B; F.AMP_C=AMP_C; F.BOX=BOX;
  const ap=PRODUCT_PTS.ampoule;
  F.amp = makeFormation((put,f)=>{ const r=mulberry(91); f.inner=[]; f.edge=[];
    for(let i=0;i<ap.edge.length;i+=2){ const w=W_(AMP_B.l+ap.edge[i]*AMP_B.w, AMP_B.t+ap.edge[i+1]*AMP_B.h, CAM5); f.edge.push(put(w[0],w[1],PX.gauss(r)*3,1.4,.85,.8)); }
    for(let i=0;i<ap.fill.length;i+=2){ const w=W_(AMP_B.l+ap.fill[i]*AMP_B.w, AMP_B.t+ap.fill[i+1]*AMP_B.h, CAM5); f.inner.push(put(w[0],w[1],PX.gauss(r)*8,1.3,.5,.9)); }
    }, {dust:[CAM5.x,CAM5.y], params:{absorb:0}, update:(t,f)=>{ const a=f.params.absorb;
      for(const i of f.inner){ f.att[i*4+1]=f.baseA[i*4+1]*(1-a); }
      for(const i of f.edge){ f.att[i*4+1]=f.baseA[i*4+1]*(1-a*.72); } }});
  F.end = makeFormation((put,f)=>{ const r=mulberry(101); f.logo=[]; f.rim=[];
    for(let i=0;i<ap.edge.length;i+=4){ const w=W_(AMP_C.l+ap.edge[i]*AMP_C.w, AMP_C.t+ap.edge[i+1]*AMP_C.h, CAM5); f.rim.push(put(w[0],w[1],0,1.2,.22,.8)); }
    const gb=PRODUCT_PTS.giftbox; for(let i=0;i<gb.edge.length;i+=2){ const w=W_(BOX.l+gb.edge[i]*BOX.w, BOX.t+gb.edge[i+1]*BOX.h, CAM5); f.rim.push(put(w[0],w[1],0,1.2,.16,.7)); }
    const LS=92.8/56.86, L0=981.9, T0=95.6;
    SHAPES.ymDots.forEach(d=>{ for(let k=0;k<70;k++){ const a=r()*6.283, rr=Math.sqrt(r())*d[2]*LS*.95; const w=W_(L0+d[0]*LS+Math.cos(a)*rr, T0+d[1]*LS+Math.sin(a)*rr, CAM5); f.logo.push(put(w[0],w[1],0,1.4,.9,.85)); } });
  }, {dust:[CAM5.x,CAM5.y], params:{logoA:1}, update:(t,f)=>{ for(const i of f.logo) f.att[i*4+1]=.9*f.params.logoA; }});
}

/* ---------- text helpers ---------- */
const st=$('#statement'), stT=$('#statement .st-txt'), stS=$('#statement .st-sweep'), cap=$('#caption');
function say(tl, at, html){
  tl.to(st,{opacity:0,duration:.45,ease:'power1.in'}, at-.5);
  tl.call(()=>{ stT.innerHTML=html; stS.innerHTML=html; }, null, at);
  tl.fromTo(st,{opacity:0,scale:.965,filter:'blur(12px)',letterSpacing:'.15em'},{opacity:1,scale:1,filter:'blur(0px)',letterSpacing:'.08em',duration:1.7,ease:'power3.out',immediateRender:false}, at);
  tl.fromTo(stS,{backgroundPosition:'130% 0'},{backgroundPosition:'-30% 0',duration:2.2,ease:'power2.inOut',immediateRender:false}, at+.7);
}
function unsay(tl,at){ tl.to(st,{opacity:0,filter:'blur(8px)',duration:.7,ease:'power2.in'},at); }
function caption(tl, at, html){
  tl.to(cap,{opacity:0,duration:.35},at-.4); tl.call(()=>{cap.innerHTML=html;},null,at);
  tl.fromTo(cap,{opacity:0,y:10},{opacity:1,y:0,duration:1.2,ease:'power2.out',immediateRender:false},at); }
function uncap(tl,at){ tl.to(cap,{opacity:0,duration:.6},at); }
const GLY='01ATCG<>/#*+-=:';
function decode(el, text, dur){ const o={p:0}; return gsap.to(o,{p:1,duration:dur||1.2,ease:'none',onUpdate:()=>{ const n=text.length, k=Math.floor(o.p*n); let s=text.slice(0,k);
  for(let i=k;i<Math.min(n,k+6);i++) s+= text[i]===' '?' ':GLY[(Math.random()*GLY.length)|0]; el.textContent=s; }}); }
function roll(el, to, dur){ el.innerHTML=''; const col=document.createElement('span'); col.className='col'; const seq=[];
  for(let k=0;k<3;k++) for(let d=0;d<10;d++) seq.push(d); seq.push(to); seq.forEach(d=>{const s=document.createElement('span'); s.textContent=d; col.appendChild(s);}); el.appendChild(col);
  return gsap.fromTo(col,{yPercent:0,filter:'blur(3px)'},{yPercent:-100*(seq.length-1)/seq.length,filter:'blur(0px)',duration:dur||1.8,ease:'power3.out'}); }
function setRoll(el,to){ el.innerHTML='<span class="col"><span>'+to+'</span></span>'; }

/* ---------- camera ---------- */
function camTo(tl, c, at, dur, ease){ tl.to(cam,{x:c.x,y:c.y,z:c.z,focus:-c.z,duration:dur,ease:ease||'power3.inOut'},at); }
function mid(a,b,lift){ return [(a[0]+b[0])/2, (a[1]+b[1])/2+(lift||0), 120]; }

/* ---------- 3D-driven formations ---------- */
const S3D = {};
function buildAll3D(){
  F.use3d = makeFormation(()=>{}, {dust:[CAM5.x,CAM5.y]});
  const D=R3.deer; D.place(...DEER3); D.u.uDis.value=1.1; D.ua.uDis.value=1.1; R3.deerUpdatePose();
  // S1 deer: body surface + antlers, following the skinned animation
  F.deer3d = makeFormation((put,f)=>{ f.body=[]; f.ant=[]; f.spot=[];
    D.samples.forEach((s,i)=>{ f.body.push(put(0,0,0, 1.25, .16+.6*s.lum*s.lum, .45+.5*s.lum)); });
    for(let j=0;j<D.antSamples.length;j+=3) f.ant.push([put(0,0,0,1.3,.55,.8), j]);
    const spotSet=new Set(D.spotIdx); f.spotSlots=[]; D.spotIdx.forEach((si,k)=>{ f.spotSlots.push([f.body[si], k]); f.att[f.body[si]*4]=2.6; f.att[f.body[si]*4+1]=.95; f.att[f.body[si]*4+2]=.95; });
  }, {dust:[0,60], params:{drift:0, pA:1, antGlow:0}, update:(t,f)=>{ R3.deerUpdatePose();
    const P=f.pos, A=f.att, pa=f.params.pA;
    for(let i=0;i<f.body.length;i++){ const k=f.body[i]; R3.deerSample(i,P,k*3); A[k*4+1]=f.baseA[k*4+1]*pa; }
    for(const [k,j] of f.ant){ R3.antSample(j,P,k*3); A[k*4+1]=f.baseA[k*4+1]*(pa*.7+.3)*(1+f.params.antGlow*.6); }
    const dr=f.params.drift, n=f.spotSlots.length; const tgt=[0,0,0];
    for(const [k,j] of f.spotSlots){ const l=ease3(clamp(dr*1.6-j/n*.6,0,1)); if(l<=0){ A[k*4+1]=.95*Math.max(pa,.55); continue; }
      R3.antSample((j*53)%D.antSamples.length,tgt,0); const bx=P[k*3],by=P[k*3+1],bz=P[k*3+2], u=1-l, cx=(bx+tgt[0])/2+40, cy=Math.max(by,tgt[1])+80;
      P[k*3]=u*u*bx+2*u*l*cx+l*l*tgt[0]; P[k*3+1]=u*u*by+2*u*l*cy+l*l*tgt[1]; P[k*3+2]=u*bz+l*tgt[2]; A[k*4+1]=.95*(1-l*.6)+Math.sin(l*Math.PI)*.3; }
  }});
  // S2 antlers growing
  F.ant3d = makeFormation((put,f)=>{ f.a=[]; D.antSamples.forEach((s,j)=>{ const rim=.35+.65*Math.random(); f.a.push([put(0,0,0,1.15,.22*rim+.08,.55+.4*s.h), j]); }); },
    {dust:[0,60], params:{G:1, pA:1}, update:(t,f)=>{ const G=f.params.G; for(const [k,j] of f.a){ const s=D.antSamples[j]; R3.antSample(j,f.pos,k*3,G); f.att[k*4+1]= (s.h<=G? f.baseA[k*4+1] : (s.h<G+.04? .5 : 0))*f.params.pA; } }});
  // S3 line + tower
  F.line3 = makeFormation(put=>{ const r=mulberry(41);
    for(let i=0;i<5600;i++){ const u=i/5600, x=(u-.5)*1500, c=Math.exp(-Math.pow(x/500,2)); put(TX+x, BY+PX.gauss(r)*(1+2*c), PX.gauss(r)*12, 1.1+1.4*c, .25+.7*c, .5+.4*c); } }, {dust:[CAM3a.x,CAM3a.y]});
  R3.towerPlace(TX, BY, HT3, TYAW);
  const T=R3.tower; { const a=R3.towerCL(.12), b=R3.towerCL(.93); Object.assign(CAM3a,{x:a[0]+260,y:a[1]+180,z:a[2]-1000}); Object.assign(CAM3b,{x:b[0]+260,y:b[1]-200,z:b[2]-1000}); }
  F.tower3d = makeFormation((put,f)=>{ const r=mulberry(52); f.sh=[]; f.fl=[]; f.cr=[]; f.sl=[];
    T.samples.forEach((s,i)=>{ f.sh.push([put(0,0,0,1.2+1.3*s.h, .18+.8*Math.pow(s.h,1.5), Math.min(1,.1+s.h)), i, s.h]); });
    for(let k=0;k<1100;k++) f.fl.push([put(0,0,0,1.2,.1,.5), r(), .03+r()*.045, Math.sqrt(r())*.8, r()*6.283]);
    for(let k=0;k<420;k++) f.cr.push([put(0,0,0,1.5,.5,.95), .87+r()*.12, Math.sqrt(r()), r()*6.283]);
    for(let k=0;k<330;k++){ const ring=k<250; f.sl.push([put(0,0,0,1.5,.85,1), ring?(1+Math.floor(k/50))/5:Math.sqrt(r()), ring?(k%50)/50*6.283+Math.floor(k/50)*.3:r()*6.283]); }
    f.sh.forEach(([k,i])=>R3.towerSample(i,f.pos,k*3));
  }, {dust:[CAM3a.x, BY+HT3/2], params:{glow:0, SL:0, flowA:1, pA:1}, update:(t,f)=>{ const P=f.pos, A=f.att, gl=f.params.glow, pa=f.params.pA;
    for(const [k,i,h] of f.sh){ A[k*4+1]=f.baseA[k*4+1]*(h>.87?1+gl*1.3:1)*pa; }
    for(const q of f.fl){ const k=q[0], u=(q[1]+t*q[2])%1, h=Math.pow(u,.8), c=R3.towerCL(h), th=q[4]+t*.3, rr=c[3]*q[3];
      P[k*3]=c[0]+Math.cos(th)*rr; P[k*3+1]=c[1]; P[k*3+2]=c[2]+Math.sin(th)*rr; A[k*4+1]=Math.pow(Math.sin(Math.PI*u),.6)*(.2+.75*Math.pow(h,1.5))*f.params.flowA; A[k*4+2]=.3+.7*h; A[k*4]=1+1.4*h; }
    for(const q of f.cr){ const k=q[0], c=R3.towerCL(q[1]), th=q[3]+t*.12, rr=c[3]*q[2]; P[k*3]=c[0]+Math.cos(th)*rr; P[k*3+1]=c[1]; P[k*3+2]=c[2]+Math.sin(th)*rr; A[k*4+1]=.3*(1+gl*1.6); }
    const SL=ease3(f.params.SL), c0=R3.towerCL(.925), R0=c0[3]*1.1; const end=towerSliceEnd();
    const C=[lerp(c0[0],end[0],SL), lerp(c0[1],end[1],SL)+Math.sin(SL*Math.PI)*60, lerp(c0[2],end[2],SL)], tilt=lerp(.12,1.15,SL), spin=t*.25, sc=lerp(1,1.6,SL);
    for(const q of f.sl){ const k=q[0], a=q[2]+spin, lx=Math.cos(a)*R0*q[1]*sc, lz=Math.sin(a)*R0*q[1]*sc;
      P[k*3]=C[0]+lx; P[k*3+1]=C[1]+lz*Math.sin(tilt); P[k*3+2]=C[2]+lz*Math.cos(tilt); A[k*4+1]=(.25+.75*SL)*(q[1]>.98?1:.7)*(1+gl*.5); }
  }});
  F.tower3d.sliceC=()=>{ const SL=ease3(F.tower3d.params.SL), c0=R3.towerCL(.925), e=towerSliceEnd(); return [lerp(c0[0],e[0],SL), lerp(c0[1],e[1],SL)+Math.sin(SL*Math.PI)*60, lerp(c0[2],e[2],SL)]; };
  // S3 grading built on the deer's own antler. Seamless with S2: particles 0..n-1 are *exactly* the S2 antler particles
  // (same index, same attributes); the extra particles start as the very same S2 dust and only fade out there.
  F.grade3d = makeFormation((put,f)=>{ const r=mulberry(53), A0=F.ant3d; f.a=[]; f.fl=[]; f.sl=[]; f.rg=[]; f.ex=[];
    D.antSamples.forEach((s,j)=>{ const k=put(0,0,0, A0.baseA[j*4], A0.baseA[j*4+1], A0.baseA[j*4+2]); f.a.push([k,j,s.h]); });
    const X=(k)=>{ f.ex.push(k); return k; };
    for(let k=0;k<520;k++) f.fl.push([X(put(0,0,0,1.15,.1,.6)), r(), .05+r()*.06, Math.sqrt(r())*.75, r()*6.283, k%2]);
    for(let k=0;k<3*90;k++) f.rg.push([X(put(0,0,0,1.1,.5,.85)), [.36,.66,.88][Math.floor(k/90)], (k%90)/90*6.283]);
    for(let k=0;k<300;k++){ const ring=k<220; f.sl.push([X(put(0,0,0,.95,.85,1)), ring?(1+Math.floor(k/44))/5:Math.sqrt(r()), ring?(k%44)/44*6.283+Math.floor(k/44)*.3:r()*6.283]); }
  }, {dust:[0,60], params:{B:0, glow:0, SL:0, flowA:0, pA:.25, main:0, dfade:1}, update:(t,f)=>{ const P=f.pos, A=f.att, B=f.params.B, gl=f.params.glow, pa=f.params.pA, mi=f.params.main, A0=F.ant3d;
    for(const [k,j,h] of f.a){ R3.antSample(j,P,k*3,1); const a0=(h<=1? A0.baseA[k*4+1] : (h<1.04? .5 : 0))*pa; const rv=sm(clamp((B-h)/.06,0,1));
      A[k*4+1]=a0*(1+rv*(.3+.5*h))*(h>.88?1+gl*.3:1); A[k*4+2]=lerp(A0.baseA[k*4+2], Math.min(1,.3+.7*h), rv); A[k*4]=A0.baseA[k*4]; }
    const df=f.params.dfade;
    if(df<1){ // extras still sitting where the S2 dust was: same drift as the engine's dust, only fading
      for(const k of f.ex){ P[k*3]=A0.base[k*3]+Math.sin(t*.04+PX.rnd[k*4+1]*30)*30; P[k*3+1]=A0.base[k*3+1]+Math.sin(t*.05+PX.rnd[k*4]*20)*40; P[k*3+2]=A0.base[k*3+2];
        A[k*4]=A0.baseA[k*4]; A[k*4+1]=A0.baseA[k*4+1]*(1-df); A[k*4+2]=A0.baseA[k*4+2]; } return; }
    for(const q of f.fl){ const k=q[0], u=(q[1]+t*q[2])%1, h=Math.pow(u,.85)*Math.min(1,B+.02), th=q[4]+t*.4;
      R3.antCLat(q[5],h,P,k*3,q[3],th); A[k*4+1]=Math.pow(Math.sin(Math.PI*u),.6)*(.08+.22*Math.pow(h,1.3))*f.params.flowA; A[k*4+2]=.35+.5*h; A[k*4]=1+.3*h; }
    for(const q of f.rg){ const k=q[0]; R3.antCLat(mi,q[1],P,k*3,1.25,q[2]+t*.5); A[k*4+1]=.32*sm(clamp((B-q[1])/.05,0,1))*Math.min(1,pa*4); A[k*4]=1.1; A[k*4+2]=.85; }
    const SL=ease3(f.params.SL), c0=[0,0,0]; const R0=R3.antCLat(mi,.94,c0,0)*R3.antScale(mi)*1.35; const e=gradeSliceEnd();
    const C=[lerp(c0[0],e[0],SL), lerp(c0[1],e[1],SL), lerp(c0[2],e[2],SL)], tilt=lerp(.25,.62,SL), spin=t*.3, sc=lerp(1,1.6,SL);
    for(const q of f.sl){ const k=q[0], a=q[2]+spin, lx=Math.cos(a)*R0*q[1]*sc, lz=Math.sin(a)*R0*q[1]*sc;
      P[k*3]=C[0]+lx; P[k*3+1]=C[1]+lz*Math.sin(tilt); P[k*3+2]=C[2]+lz*Math.cos(tilt); A[k*4]=.95; A[k*4+2]=1; A[k*4+1]=(B>.9? (.15+.65*SL)*(q[1]>.98?1.1:(q[1]>.5?.18:.06)) : 0); }
  }});
  F.grade3d.sliceC=()=>{ const SL=ease3(F.grade3d.params.SL), c0=[0,0,0]; R3.antCLat(F.grade3d.params.main,.94,c0,0); const e=gradeSliceEnd(); return [lerp(c0[0],e[0],SL), lerp(c0[1],e[1],SL), lerp(c0[2],e[2],SL)]; };
  // S5 ampoule / box / end
  const A5=R3.amp, X5=R3.box;
  F.amp3d = makeFormation((put,f)=>{ f.a=[]; A5.samples.forEach((s,i)=>f.a.push([put(0,0,0,1.3,.75,.85),i])); }, {dust:[CAM5.x,CAM5.y], params:{pA:1}, update:(t,f)=>{
    for(const [k,i] of f.a){ R3.objSample(A5.samples,i,f.pos,k*3); f.att[k*4+1]=f.baseA[k*4+1]*f.params.pA; } }});
  F.eff3d = makeFormation((put,f)=>{ f.a=[]; f.b=[]; A5.samples.forEach((s,i)=>{ if(i%2===0) f.a.push([put(0,0,0,1.1,.5,.85),i]); }); X5.samples.forEach((s,i)=>f.b.push([put(0,0,0,1.2,.6,.75),i])); },
    {dust:[CAM5.x,CAM5.y], params:{pA:1}, update:(t,f)=>{ for(const [k,i] of f.a){ R3.objSample(A5.samples,i,f.pos,k*3); f.att[k*4+1]=f.baseA[k*4+1]*f.params.pA; }
      for(const [k,i] of f.b){ R3.objSample(X5.samples,i,f.pos,k*3); f.att[k*4+1]=f.baseA[k*4+1]*f.params.pA; } }});
  F.end3d = makeFormation((put,f)=>{ const r=mulberry(101); f.logo=[]; f.b=[];
    X5.samples.forEach((s,i)=>{ if(i%2===0) f.b.push([put(0,0,0,1.1,.16,.75),i]); });
    const LS=92.8/56.86, L0=981.9, T0=95.6;
    SHAPES.ymDots.forEach(d=>{ for(let k=0;k<70;k++){ const a=r()*6.283, rr=Math.sqrt(r())*d[2]*LS*.95; const w=W_(L0+d[0]*LS+Math.cos(a)*rr, T0+d[1]*LS+Math.sin(a)*rr, CAM5); f.logo.push(put(w[0],w[1],0,1.4,.9,.85)); } });
  }, {dust:[CAM5.x,CAM5.y], params:{logoA:1}, update:(t,f)=>{ for(const k of f.logo) f.att[k*4+1]=.9*f.params.logoA; for(const [k,i] of f.b) R3.objSample(X5.samples,i,f.pos,k*3); }});
}
function gradeSliceEnd(){ const mi=F.grade3d.params.main, tp=[0,0,0]; R3.antCLat(mi,1,tp,0); const sc=(tp[2]-cam.z)/1000; return [tp[0]-20*sc, tp[1]+120*sc, tp[2]]; }
function antCam(){ const ac=R3.antCenter(), dz=1000*ac.h/380; return {x:ac.x, y:ac.y-70*dz/1000, z:ac.z-dz, dz}; }
function towerSliceEnd(){ const top=R3.towerCL(1); return [top[0]+560, top[1]+40, top[2]-60]; }

/* ---------- S4: cover + figure in CSS 3D (same projection as the particle camera) ---------- */
const COV={cx:600,cy:452,h:590}; COV.w=COV.h*S4_PTS.covAR;
const FIG={cx:1330,cy:452,h:560}; FIG.w=FIG.h*S4_PTS.figAR;
const s4rot={cov:{ry:16,rx:-3}, fig:{ry:-9,rx:-2}};
function cssPt(o, rot, lx, ly){ const ry=rot.ry*Math.PI/180, rx=rot.rx*Math.PI/180;
  let x=lx, y=ly*Math.cos(rx), z=ly*Math.sin(rx);           // rotateX
  const x2=x*Math.cos(ry)+z*Math.sin(ry), z2=-x*Math.sin(ry)+z*Math.cos(ry); // rotateY
  return [CAM4.x+(o.cx+x2-960), CAM4.y-(o.cy+y-540), -z2]; }
function buildS4(){
  F.s4 = makeFormation((put,f)=>{ f.c=[]; f.g=[];
    const cv=S4_PTS.cov; for(let i=0;i<cv.length;i+=3){ f.c.push([put(0,0,0,1.25,.3+.6*cv[i+2],.5+.45*cv[i+2]), cv[i]-.5, cv[i+1]-.5]); }
    const fg=S4_PTS.fig; for(let i=0;i<fg.length;i+=2){ f.g.push([put(0,0,0,1.2,.75,.8), fg[i]-.5, fg[i+1]-.5]); }
  }, {dust:[CAM4.x,CAM4.y], params:{cA:1,gA:1}, update:(t,f)=>{
    for(const [k,u,v] of f.c){ const p=cssPt(COV,s4rot.cov,u*COV.w,v*COV.h); f.pos[k*3]=p[0]; f.pos[k*3+1]=p[1]; f.pos[k*3+2]=p[2]; f.att[k*4+1]=f.baseA[k*4+1]*f.params.cA; }
    for(const [k,u,v] of f.g){ const p=cssPt(FIG,s4rot.fig,u*FIG.w,v*FIG.h); f.pos[k*3]=p[0]; f.pos[k*3+1]=p[1]; f.pos[k*3+2]=p[2]; f.att[k*4+1]=f.baseA[k*4+1]*f.params.gA; } }});
}
function s4css(){ const c=$('#cover'), g=$('#fig');
  c.style.transform=`rotateY(${s4rot.cov.ry}deg) rotateX(${s4rot.cov.rx}deg)`; g.style.transform=`rotateY(${s4rot.fig.ry}deg) rotateX(${s4rot.fig.rx}deg)`; }
/* ---------- scene registry ---------- */
const TAGS=['','为什么是梅花鹿','二杠茸，一年一生','只取顶端蜡片','科研实力','双舱锁鲜','小鹿精华'];
const UL={close:{x:900,y:560,h:2000,ry:-.25}, full:{x:1240,y:500,h:820}, side:1.25, end:{x:960,y:452,h:640,ry:1.09}, k:.8};
let draw = null;  // per-scene fx hook
const S2FX={tip:0,dot:0}; let PREV=-1;
const vis3=(o)=>{ if(!R3.ok) return; R3.deer.pivot.visible=!!o.deer; R3.tower.hold.visible=!!o.tower; R3.amp.pivot.visible=!!o.amp; R3.box.pivot.visible=!!o.box; if(R3.use) R3.use.pivot.visible=!!o.use; };
/* stylised fingertip (line art) pressing; (x,y) = contact point at the tip, k = scale, dir -1 = finger comes from above */
function drawFinger(x,y,k,a,dir){ fx.save(); fx.translate(x,y); fx.scale(k,k*(dir||1)); fx.globalCompositeOperation='lighter';
  const w=46, L=300;
  fx.beginPath(); fx.moveTo(-w,L); fx.lineTo(-w,w*.9); fx.bezierCurveTo(-w,-w*.25,-w*.45,-w*.02,0,-2); fx.bezierCurveTo(w*.45,-w*.02,w,-w*.25,w,w*.9); fx.lineTo(w,L);
  const g=fx.createLinearGradient(0,0,0,L); g.addColorStop(0,`rgba(60,150,255,${.16*a})`); g.addColorStop(1,'rgba(60,150,255,0)'); fx.fillStyle=g; fx.fill();
  const gs=fx.createLinearGradient(0,0,0,L); gs.addColorStop(0,`rgba(170,225,255,${.85*a})`); gs.addColorStop(.75,`rgba(90,180,255,${.3*a})`); gs.addColorStop(1,'rgba(90,180,255,0)');
  fx.strokeStyle=gs; fx.lineWidth=2.2/k*1.2; fx.stroke();
  fx.beginPath(); fx.moveTo(-w*.55,w*.95); fx.bezierCurveTo(-w*.5,w*.15,w*.5,w*.15,w*.55,w*.95); fx.bezierCurveTo(w*.3,w*1.15,-w*.3,w*1.15,-w*.55,w*.95); fx.strokeStyle=`rgba(150,215,255,${.5*a})`; fx.lineWidth=1.6/k*1.2; fx.stroke();
  [[2.6,.6],[3.3,.45]].forEach(([yy,al])=>{ fx.beginPath(); fx.moveTo(-w*.6,w*yy); fx.quadraticCurveTo(0,w*yy+8,w*.6,w*yy); fx.strokeStyle=`rgba(120,200,255,${al*a*.6})`; fx.stroke(); });
  fx.restore(); flare(x,y,60*k,.35*a,0); }
/* essence drops: glints on the model's falling drops and jet */
function dripFx(S,t,a,k){ const v=new THREE.Vector3(), sc=new THREE.Vector3(), root=S.pivot.children[0].children[0];
  for(const nm of ['FX_LastDrop_00','FX_LastDrop_01','FX_LastDrop_02','FX_FallingSerumJet']){ const n=root.getObjectByName(nm); if(!n) continue; n.updateMatrixWorld(true); n.getWorldScale(sc); if(sc.x<1e-3) continue;
    if(nm==='FX_FallingSerumJet'){ const m=S.parts['FX_FallingSerumJet_1']; if(!m) continue; if(!m.geometry.boundingBox) m.geometry.computeBoundingBox(); m.geometry.boundingBox.getCenter(v).applyMatrix4(m.matrixWorld); }
    else n.getWorldPosition(v);
    const p=project(v.x,v.y,-v.z); if(p) flare(p[0],p[1],(nm==='FX_FallingSerumJet'?46:30)*k,(nm==='FX_FallingSerumJet'?.35:.6)*a,nm==='FX_FallingSerumJet'?0:1.1); } }

function antTip(){ const D=R3.deer; let best=0; for(let j=0;j<1500;j++) if(D.antSamples[j].h>D.antSamples[best].h) best=j; const o=[0,0,0]; R3.antSample(best,o,0); return o; }
const V1 = [
 { // 0 intro
  build(tl){ const s=$('#s0');
    gsap.set('.intro-title',{opacity:0,scale:.96,filter:'blur(14px)'}); gsap.set('.intro-sub',{opacity:0});
    tl.call(()=>morphTo(F.line0,{duration:2.0,order:'random',stagger:.35}),null,0);
    camTo(tl,{x:0,y:0,z:-1000},0,1.2,'power2.out'); tl.to(cam,{z:-930,duration:6,ease:'power1.inOut'},.2);
    const fl={a:0}; tl.to(fl,{a:1,duration:1.4,ease:'power2.out'},1.0).to(fl,{a:.55,duration:2},2.4);
    tl.to('.intro-title',{opacity:1,scale:1,filter:'blur(0px)',duration:2,ease:'power3.out'},1.3);
    tl.to('.intro-sub',{opacity:1,duration:1.4},2.4);
    draw=()=>{ const p=project(0,0,0); if(p){ flare(p[0],p[1],260,fl.a*.9,7); ghost(p[0],p[1],fl.a*.6);} };
    tl.to({}, {duration:.01}, 5.6);
  }, key:4.8 },
 { // 1 deer
  build(tl){ const f=F.deer; f.params.drift=0; f.params.antGlow=0;
    gsap.set('#deer-photo',{opacity:0}); gsap.set('#s1-br',{opacity:0,scale:1.04}); gsap.set('#s1-geo',{opacity:0});
    camTo(tl,{x:0,y:0,z:-1000},0,1.6);
    tl.call(()=>morphTo(f,{duration:3.0,order:'index',stagger:.55,ctrl:[0,-40,0],spread:200}),null,0);
    tl.to(cam,{z:-900,y:30,duration:9,ease:'power1.inOut'},1.4);
    say(tl,1.2,'万千生灵之中，为何选择<em>梅花鹿</em>？');
    tl.to('#s1-br',{opacity:1,scale:1,duration:1.2,ease:'power3.out'},2.6);
    tl.to('#s1-geo',{opacity:1,duration:.8},3.0); tl.add(()=>decode($('#s1-geo span'),'CERVUS NIPPON · 梅花鹿',1.2),3.0);
    caption(tl,3.4,'小鹿精华，源自北纬 <b>43°</b> 梅花鹿');
    tl.to('#deer-photo',{opacity:.34,duration:2.2,ease:'sine.inOut'},3.6).to('#deer-photo',{opacity:0,duration:2.2,ease:'sine.inOut'},6.4);
    tl.to(f.params,{drift:1,duration:3.6,ease:'none'},5.6); tl.to(f.params,{antGlow:1,duration:2.4,ease:'power2.inOut'},6.8);
    const fl={a:0}; tl.to(fl,{a:1,duration:2,ease:'power2.out'},7.4);
    draw=()=>{ const w=W_(tipS[0],tipS[1]+20,CAM0); const p=project(w[0],w[1],0); if(p) flare(p[0],p[1],140,fl.a*.4,3.5); };
    tl.to({}, {duration:.01}, 10.2);
  }, key:9.4 },
 { // 2 antler growth
  build(tl){ const f=F.ant; f.params.G=0;
    const ring={p:0}; const prog=$('#ring-prog'), dot=$('#ring-dot'), C=2*Math.PI*340; prog.style.strokeDasharray=C; prog.style.strokeDashoffset=C;
    gsap.set('#s2 .ring',{opacity:0,scale:.9,transformOrigin:'960px 470px'}); gsap.set('.season',{opacity:0}); gsap.set('#s2-tag',{opacity:0}); $$('.season').forEach(e=>{ e.classList.remove('on'); const a=(+e.dataset.a)*Math.PI/180, rr=340+58; e.style.left=(960+Math.sin(a)*rr)+'px'; e.style.top=(470-Math.cos(a)*rr)+'px'; });
    camTo(tl,CAM2,0,2.0,'power3.inOut');
    tl.call(()=>morphTo(f,{duration:2.2,order:'random',stagger:.3}),null,.2);
    tl.to('#s2 .ring',{opacity:1,scale:1,duration:2,ease:'power3.out'},1.4);
    tl.to('.season',{opacity:1,duration:1,stagger:.12},1.8);
    tl.to('#s2-tag',{opacity:1,duration:1},2.2);
    tl.to(ring,{p:1,duration:6.4,ease:'power1.inOut',onUpdate:()=>{ const p=ring.p; prog.style.strokeDashoffset=C*(1-p);
      const a=(-90+360*p)*Math.PI/180; dot.setAttribute('cx',340*Math.cos(a)); dot.setAttribute('cy',340*Math.sin(a));
      $$('.season').forEach((e,i)=>e.classList.toggle('on', p>=i*.25-.001 && p>0.002)); f.params.G=clamp(p/.62,0,1); }},2.0);
    tl.fromTo('#ring-dash',{rotation:0,svgOrigin:'0 0'},{rotation:30,duration:12,ease:'none'},0);
    say(tl,1.6,'二杠茸，一年一生，自然更新，<em>年年再生</em>。');
    caption(tl,4.2,'鹿茸：哺乳动物中<b>“唯一”</b>可再生的器官');
    const fl={a:0}; tl.to(fl,{a:1,duration:1},2.2).to(fl,{a:.35,duration:1.5},6.3);
    const pulse={a:0}; tl.to(pulse,{a:1,duration:.5,ease:'power2.out'},8.4).to(pulse,{a:0,duration:1.6},8.9);
    draw=()=>{ const t=f.tip(); flare(t[0],t[1],120,fl.a*.8,4); const p=ring.p, a=(-90+360*p)*Math.PI/180; flare(960+340*Math.cos(a),470+340*Math.sin(a),70,.6*Math.min(1,p*20),0);
      if(pulse.a>0){ fx.save(); fx.globalCompositeOperation='lighter'; fx.strokeStyle=`rgba(90,190,255,${pulse.a*.5})`; fx.lineWidth=2; fx.beginPath(); fx.arc(960,470,340+(1-pulse.a)*40,0,7); fx.stroke(); fx.restore(); } };
    tl.to({}, {duration:.01}, 10.4);
  }, key:9.2 },
 { // 3 tower
  build(tl){ const f=F.tower; f.params.glow=0; f.params.SL=0; f.params.flowA=1;
    const gate={a:0}; const grades=$$('.grade'); const sl=$('#s3-slice');
    gsap.set(grades,{opacity:0}); gsap.set(sl,{opacity:0}); gsap.set('.arrow-line i',{height:0}); gsap.set('.arrow-head',{opacity:0}); gsap.set('.arrow',{opacity:0}); setRoll($('#s3-slice .roll'),0);
    camTo(tl,CAM3a,0,2.6,'power3.inOut');
    const from=[CAM2.x,CAM2.y,0];
    tl.call(()=>morphTo(F.line3,{duration:2.6,order:'index',stagger:.5,ctrl:mid(from,[TX,BY],200),spread:90}),null,0);
    tl.call(()=>morphTo(f,{duration:2.8,order:'y',y0:BY,y1:BY+HT,stagger:.7}),null,2.6);
    say(tl,1.6,'营养由底至顶，层层汇聚。');
    tl.to('.arrow',{opacity:1,duration:1},3.0);
    tl.to(gate,{a:1,duration:1},3.4);
    camTo(tl,CAM3b,3.6,6.6,'power2.inOut');
    tl.to('.arrow-line i',{height:'100%',duration:6.6,ease:'power2.inOut'},3.6); tl.to('.arrow-head',{opacity:1,duration:.8},9.6);
    say(tl,10.4,'鹿茸的活性物质　<em>越往上越高</em>');
    tl.to(f.params,{glow:1,duration:1.8,ease:'power2.inOut'},10.2);
    caption(tl,11.2,'顶端 2% 处<b>“蜡片”</b>是鹿茸生长最活跃的部位');
    tl.to(f.params,{SL:1,duration:2.6,ease:'none'},12.6);
    say(tl,13.0,'我们只取最顶端的<em>蜡片</em>部分。');
    tl.to(sl,{opacity:1,duration:1},14.2); tl.add(()=>roll($('#s3-slice .roll'),2,1.6),14.2);
    const fl={a:0}; tl.to(fl,{a:1,duration:1.6},10.2);
    draw=()=>{ const g=gate.a; const yS=[0,.36,.66,.88,1]; const ctx=fx;
      grades.forEach((el,i)=>{ const h=(yS[i]+yS[i+1])/2, y=BY+h*HT, x=f.cxh(h)+f.RR(h);
        const p=project(x+170,y,0), q=project(x+14,y,0); if(!p) return;
        const vis=g*sm(clamp((p[1]-150)/120,0,1))*sm(clamp((790-p[1])/110,0,1)); el.style.opacity=vis; el.style.transform=`translate(${p[0]+18}px,${p[1]-34}px)`;
        if(vis>.01){ ctx.save(); ctx.globalAlpha=vis; ctx.strokeStyle=i===3?'rgba(110,205,255,.85)':'rgba(70,170,255,.45)'; ctx.lineWidth=1; ctx.setLineDash([4,5]); ctx.beginPath(); ctx.moveTo(q[0],q[1]); ctx.lineTo(p[0],p[1]); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle=i===3?'#BDEFFF':'rgba(110,200,255,.9)'; ctx.beginPath(); ctx.arc(q[0],q[1],3,0,7); ctx.fill(); ctx.restore(); } });
      [.36,.66,.88].forEach(h=>{ const y=BY+h*HT, a=project(f.cxh(h)-f.RR(h)-50,y,0), b=project(f.cxh(h)+f.RR(h)+50,y,0); if(!a) return;
        const vis=g*sm(clamp((a[1]-120)/100,0,1))*sm(clamp((900-a[1])/120,0,1)); if(vis<.01) return; ctx.save(); ctx.globalAlpha=vis*.5; ctx.strokeStyle='rgba(70,170,255,.6)'; ctx.setLineDash([2,6]); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); ctx.restore(); });
      const tp=project(f.cxh(1), BY+HT*.985, 0); if(tp){ flare(tp[0],tp[1],170,fl.a*.6,3.5); ghost(tp[0],tp[1],fl.a*.5); }
      const c=f.sliceC(), sp=project(c[0],c[1],c[2]); if(sp && f.params.SL>0){ flare(sp[0],sp[1],120,.35*Math.sin(Math.min(1,f.params.SL)*Math.PI*.5),0);
        sl.style.transform=`translate(${sp[0]+170}px,${sp[1]-120}px)`; } };
    tl.to({}, {duration:.01}, 16.6);
  }, key:15.8 },
];
const scenes = [
 V1[0],
 { // 1 deer
  build(tl){ if(!R3.ok) return V1[1].build(tl);
    const D=R3.deer, f=F.deer3d; f.params.drift=0; f.params.antGlow=0; f.params.pA=1;
    vis3({deer:1}); D.place(...DEER3); D.timeScale=.8; D.u.uDim.value=1; D.ua.uDim.value=1; D.ua.uGrowOn.value=0; D.ua.uHeat.value=0; D.ua.uBandOn.value=0; D.ua.uTip.value=0; D.u.uCool.value=.6; D.ua.uCool.value=.85;
    const cameFromAbove = D.u.uDis.value<0; if(!cameFromAbove){ D.u.uDis.value=1.1; D.ua.uDis.value=1.1; }
    R3.crossfade('Idle_1',.6);
    gsap.set('#deer-photo',{opacity:0}); gsap.set('#s1-br',{opacity:0,scale:1.04}); gsap.set('#s1-geo',{opacity:0});
    camTo(tl,CAM0,0,1.6);
    tl.call(()=>morphTo(f,{duration:3.0,order:'index',stagger:.55,ctrl:[0,-40,0],spread:200}),null,0);
    tl.to(cam,{z:-900,y:30,duration:9,ease:'power1.inOut'},1.4);
    tl.to([D.u.uDis,D.ua.uDis],{value:-.2,duration:3.2,ease:'power1.inOut'},2.4);
    tl.to(f.params,{pA:.32,duration:2.6,ease:'power1.inOut'},3.2);
    say(tl,1.2,'万千生灵之中，为何选择<em>梅花鹿</em>？');
    tl.to('#s1-br',{opacity:1,scale:1,duration:1.2,ease:'power3.out'},2.6);
    tl.to('#s1-geo',{opacity:1,duration:.8},3.0); tl.add(()=>decode($('#s1-geo span'),'CERVUS NIPPON · 梅花鹿',1.2),3.0);
    caption(tl,3.4,'小鹿精华，源自北纬 <b>43°</b> 梅花鹿');
    tl.call(()=>R3.crossfade('Idle_2',1.4),null,4.2);
    tl.to(f.params,{drift:1,duration:3.6,ease:'none'},5.6); tl.to(f.params,{antGlow:1,duration:2.4,ease:'power2.inOut'},6.8);
    tl.to(D.ua.uGlow,{value:.22,duration:2.4,ease:'power2.inOut'},6.8);
    const fl={a:0}; tl.to(fl,{a:1,duration:2,ease:'power2.out'},7.4);
    draw=()=>{ const t=antTip(); const p=project(t[0],t[1],t[2]); if(p) flare(p[0],p[1],140,fl.a*.4,3.5); };
    tl.to({}, {duration:.01}, 10.2);
  }, key:9.4 },
 { // 2 antler growth
  build(tl){ if(!R3.ok) return V1[2].build(tl);
    const D=R3.deer, f=F.ant3d; f.params.G=1; f.params.pA=1;
    vis3({deer:1}); D.u.uDis.value=-.2; D.ua.uDis.value=-.2; D.ua.uGlow.value=0;
    // freeze pose so the close-up is steady
    gsap.to(D,{timeScale:0,duration:1.0});
    { const c=antCam(); CAM2.x=c.x; CAM2.y=c.y; CAM2.z=c.z; } D.ua.uBandOn.value=0; D.ua.uTip.value=0; D.u.uCool.value=.6; D.ua.uCool.value=.85;
    const ring={p:0}; const prog=$('#ring-prog'), dot=$('#ring-dot'), C=2*Math.PI*340; prog.style.strokeDasharray=C; prog.style.strokeDashoffset=C;
    gsap.set('#s2 .ring',{opacity:0,scale:.9,transformOrigin:'960px 470px'}); gsap.set('.season',{opacity:0}); gsap.set('#s2-tag',{opacity:0}); $$('.season').forEach(e=>{ e.classList.remove('on'); const a=(+e.dataset.a)*Math.PI/180, rr=340+58; e.style.left=(960+Math.sin(a)*rr)+'px'; e.style.top=(470-Math.cos(a)*rr)+'px'; });
    camTo(tl,CAM2,0,2.2,'power3.inOut');
    tl.to(D.u.uDim,{value:.22,duration:2},0); tl.to(D.ua.uDim,{value:.78,duration:2},0);
    tl.call(()=>morphTo(f,{duration:2.2,order:'random',stagger:.3}),null,.2);
    D.ua.uGhost.value=1; tl.set(D.ua.uGrowOn,{value:1},0); tl.set(D.ua.uGrow,{value:1.02},0);
    tl.to('#s2 .ring',{opacity:1,scale:1,duration:2,ease:'power3.out'},1.4);
    tl.to('.season',{opacity:1,duration:1,stagger:.12},1.8);
    tl.to('#s2-tag',{opacity:1,duration:1},2.2);
    // shed (antler retracts) then regrow with the ring
    // shed: the antler recedes smoothly from tip to base into a glowing outline (never vanishes), then regrows inside it
    tl.to(f.params,{G:0,duration:1.2,ease:'power2.inOut'},.8); tl.to(D.ua.uGrow,{value:0,duration:1.2,ease:'power2.inOut'},.8);
    tl.to(ring,{p:1,duration:6.4,ease:'power1.inOut',onUpdate:()=>{ const p=ring.p; prog.style.strokeDashoffset=C*(1-p);
      const a=(-90+360*p)*Math.PI/180; dot.setAttribute('cx',340*Math.cos(a)); dot.setAttribute('cy',340*Math.sin(a));
      $$('.season').forEach((e,i)=>e.classList.toggle('on', p>=i*.25-.001 && p>0.002)); const G=clamp(p/.62,0,1); f.params.G=G; D.ua.uGrow.value=G*1.02; }},2.0);
    tl.fromTo('#ring-dash',{rotation:0,svgOrigin:'0 0'},{rotation:30,duration:12,ease:'none'},0);
    tl.to(f.params,{pA:.25,duration:2},7.0);
    say(tl,1.6,'二杠茸，一年一生，自然更新，<em>年年再生</em>。');
    caption(tl,4.2,'鹿茸：哺乳动物中<b>“唯一”</b>可再生的器官');
    const fl={a:0}; tl.to(fl,{a:1,duration:1},2.2).to(fl,{a:.35,duration:1.5},6.3);
    const pulse={a:0}; tl.to(pulse,{a:1,duration:.5,ease:'power2.out'},8.4).to(pulse,{a:0,duration:1.6},8.9);
    tl.to(D.ua.uGlow,{value:.5,duration:.5},8.4).to(D.ua.uGlow,{value:0,duration:1.6},8.9);
    draw=()=>{ S2FX.tip=fl.a*.7; S2FX.dot=.6*Math.min(1,ring.p*20); const ax=D.antAxis, o=[0,0,0]; const G=f.params.G; const tp=new THREE.Vector3().copy(ax.axO).addScaledVector(ax.axD,Math.max(.02,G)*ax.axL).applyMatrix4(D.ants[0].matrixWorld);
      const t=project(tp.x,tp.y,-tp.z); if(t) flare(t[0],t[1],120,fl.a*.7,4); const p=ring.p, a=(-90+360*p)*Math.PI/180; flare(960+340*Math.cos(a),470+340*Math.sin(a),70,.6*Math.min(1,p*20),0);
      if(pulse.a>0){ fx.save(); fx.globalCompositeOperation='lighter'; fx.strokeStyle=`rgba(90,190,255,${pulse.a*.5})`; fx.lineWidth=2; fx.beginPath(); fx.arc(960,470,340+(1-pulse.a)*40,0,7); fx.stroke(); fx.restore(); } };
    tl.to({}, {duration:.01}, 10.4);
  }, key:9.2 },
 { // 3 grading — continues 02 frame-for-frame: same camera, same frozen pose, same silhouette; only the effect rises from the antler base
  build(tl){ if(!R3.ok) return V1[3].build(tl);
    const D=R3.deer, f=F.grade3d, fromS2=(PREV===2);
    f.params.B=0; f.params.glow=0; f.params.SL=0; f.params.flowA=0; f.params.pA=F.ant3d.params.pA; f.params.dfade=0;
    vis3({deer:1}); gsap.killTweensOf(D); D.timeScale=0; D.u.uDis.value=-.2; D.ua.uDis.value=-.2; D.ua.uHeat.value=0;
    D.ua.uBandOn.value=1; D.ua.uBand.value=0; D.ua.uTip.value=0; D.u.uCool.value=.6; D.ua.uCool.value=.85;
    gsap.killTweensOf([D.ua.uGlow,D.ua.uGrow,D.u.uDim,D.ua.uDim]);
    tl.to(D.ua.uGlow,{value:0,duration:.6},0);
    if(D.ua.uGrowOn.value>.5) tl.to(D.ua.uGrow,{value:1.02,duration:.6,onComplete:()=>{ D.ua.uGrowOn.value=0; }},0);
    R3.deerUpdatePose();
    const C0=antCam();
    // main antler = the one whose tip sits furthest right on screen (labels go right of it)
    { const sv={x:cam.x,y:cam.y,z:cam.z}; if(!fromS2) Object.assign(cam,C0); let best=0,bx=-1e9; D.ants.forEach((a,ai)=>{ const o=[0,0,0]; R3.antCLat(ai,1,o,0); const p=project(o[0],o[1],o[2]); if(p&&p[0]>bx){bx=p[0];best=ai;} }); f.params.main=best; Object.assign(cam,sv); }
    const gate={a:0}; const grades=$$('.grade'); const sl=$('#s3-slice');
    gsap.set(grades,{opacity:0}); gsap.set(sl,{opacity:0}); gsap.set('.arrow-line i',{height:0}); gsap.set('.arrow-head',{opacity:0}); gsap.set('.arrow',{opacity:0}); setRoll($('#s3-slice .roll'),0);
    if(fromS2){ PX.setForm(f); }                       // no morph, no camera move: the frame carries straight over
    else { camTo(tl,{x:C0.x,y:C0.y,z:C0.z},0,1.6,'power2.inOut'); D.u.uDim.value=.22; D.ua.uDim.value=.78; F.ant3d.params.pA=.25; f.params.pA=.25; f.params.dfade=1; tl.call(()=>morphTo(f,{duration:1.8,order:'random',stagger:.3}),null,.1); }
    tl.to(f.params,{pA:.25,duration:.8},0);
    tl.to(f.params,{dfade:1,duration:1.6,ease:'sine.inOut'},.2);
    tl.to(D.u.uDim,{value:.17,duration:3,ease:'sine.inOut'},1.0);   // body only dims slightly; outline/rim stays
    // the effect: scan rises from the antler base to the tip
    tl.to(D.ua.uBand,{value:1.06,duration:7.0,ease:'power1.inOut'},.6); tl.to(f.params,{B:1.06,duration:7.0,ease:'power1.inOut'},.6);
    tl.to(f.params,{flowA:1,duration:1.6},1.8);
    say(tl,1.2,'营养由底至顶，层层汇聚。');
    tl.to('.arrow',{opacity:1,duration:1},.6);
    tl.to(gate,{a:1,duration:.6},.6);
    tl.to('.arrow-line i',{height:'100%',duration:7.0,ease:'power1.inOut'},.6); tl.to('.arrow-head',{opacity:1,duration:.8},7.4);
    say(tl,10.0,'鹿茸的活性物质　<em>越往上越高</em>');
    tl.to(f.params,{glow:1,duration:1.8,ease:'power2.inOut'},9.6); tl.to(D.ua.uTip,{value:1,duration:1.8,ease:'power2.inOut'},9.6);
    caption(tl,11.0,'顶端 2% 处<b>“蜡片”</b>是鹿茸生长最活跃的部位');
    tl.to(f.params,{SL:1,duration:2.6,ease:'none'},12.6); tl.to(f.params,{flowA:.45,duration:2},12.6);
    const dimLow={a:1}; tl.to(dimLow,{a:.42,duration:1.6},12.8);
    say(tl,13.0,'我们只取最顶端的<em>蜡片</em>部分。');
    tl.to(sl,{opacity:1,duration:1},14.2); tl.add(()=>roll($('#s3-slice .roll'),2,1.6),14.2);
    const fl={a:0}; tl.to(fl,{a:1,duration:1.6},9.6);
    // scene-02 overlays (tip flare + ring-dot flare) carried over and faded, so nothing pops at the cut
    const s2f={tip:fromS2? S2FX.tip : 0, dot:fromS2? S2FX.dot : 0}; tl.to(s2f,{dot:0,duration:1.4,ease:'sine.inOut'},0); tl.to(s2f,{tip:0,duration:3,ease:'sine.inOut'},0);
    const yS=[0,.36,.66,.88,1], LX=1300, LY=[640,520,400,262];
    draw=()=>{ const g=gate.a, ctx=fx, mi=f.params.main, B=f.params.B, o=[0,0,0];
      if(s2f.tip>.003){ const ax=D.antAxis; const tp=new THREE.Vector3().copy(ax.axO).addScaledVector(ax.axD,ax.axL).applyMatrix4(D.ants[0].matrixWorld); const t2=project(tp.x,tp.y,-tp.z); if(t2) flare(t2[0],t2[1],120,s2f.tip,4); }
      if(s2f.dot>.003) flare(960,470-340,70,s2f.dot,0);
      grades.forEach((el,i)=>{ const h=(yS[i]+yS[i+1])/2; R3.antCLat(mi,h,o,0,1.05,0); const q=project(o[0],o[1],o[2]); if(!q) return;
        const ap=sm(clamp((B-h)/.08+.5,0,1)); const vis=g*ap*(i<3? dimLow.a : 1);
        el.style.opacity=vis; el.style.transform=`translate(${LX}px,${LY[i]-30}px)`;
        if(vis>.01){ const ex=LX-26, ey=LY[i]+4, mx=Math.max(q[0]+40, ex-120);
          ctx.save(); ctx.globalAlpha=vis; ctx.strokeStyle=i===3?'rgba(120,220,255,.95)':'rgba(70,165,255,.6)'; ctx.lineWidth=1.2;
          ctx.beginPath(); ctx.moveTo(q[0],q[1]); ctx.lineTo(mx,ey); ctx.lineTo(ex,ey); ctx.stroke();
          ctx.fillStyle=i===3?'#E8F8FF':'rgba(110,200,255,.95)'; ctx.beginPath(); ctx.arc(q[0],q[1],3.2,0,7); ctx.fill();
          ctx.strokeStyle=i===3?'rgba(120,220,255,.7)':'rgba(70,165,255,.45)'; ctx.beginPath(); ctx.arc(q[0],q[1],8+2*Math.sin(gsap.ticker.time*3+i),0,7); ctx.stroke(); ctx.restore(); } });
      [.36,.66,.88].forEach(h=>{ const r=R3.antCLat(mi,h,o,0)*R3.antScale(mi); const sc=1000/(o[2]-cam.z); const p=project(o[0],o[1],o[2]); if(!p) return;
        const w=(r*sc)*1.9+26, vis=g*sm(clamp((B-h)/.04,0,1)); if(vis<.01) return; ctx.save(); ctx.globalAlpha=vis*.8; ctx.strokeStyle='rgba(90,190,255,.75)'; ctx.setLineDash([3,5]); ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(p[0]-w,p[1]); ctx.lineTo(p[0]+w,p[1]); ctx.stroke(); ctx.restore(); });
      R3.antCLat(mi,.99,o,0); const tp=project(o[0],o[1],o[2]); if(tp){ flare(tp[0],tp[1],150,fl.a*.55,3.2); ghost(tp[0],tp[1],fl.a*.4); }
      const c=f.sliceC(), sp=project(c[0],c[1],c[2]); if(sp && f.params.SL>0){ flare(sp[0],sp[1],110,.35*Math.sin(Math.min(1,f.params.SL)*Math.PI*.5),0);
        sl.style.transform=`translate(${sp[0]-330}px,${sp[1]-120}px)`; } };
    tl.to({}, {duration:.01}, 16.6);
  }, key:15.8 },
 { // 4 science — real cover + real figure
  build(tl){ const cv=$('#cover'), fg=$('#fig'), f=F.s4; f.params.cA=1; f.params.gA=1;
    if(R3.ok){ const D=R3.deer; vis3({deer:D.ua.uDis.value<1}); gsap.killTweensOf(D); D.timeScale=0; tl.to([D.u.uDis,D.ua.uDis],{value:1.1,duration:1.4,ease:'power1.in'},0); tl.to(D.ua.uBandOn,{value:0,duration:1.4},0); tl.call(()=>vis3({}),null,1.5); }
    s4rot.cov.ry=19; s4rot.fig.ry=-11; s4css();
    gsap.set([cv,fg],{opacity:0,filter:'blur(12px) brightness(1.6)'}); gsap.set(['#fig-tag','#s4-br'],{opacity:0}); $$('#cov-meta div').forEach(d=>d.textContent='');
    gsap.set('.cover-sheen',{backgroundPosition:'130% 0'});
    camTo(tl,CAM4,0,2.6,'power3.inOut');
    tl.call(()=>morphTo(f,{duration:3.0,order:'index',stagger:.55,ctrl:[(CAM2.x+CAM4.x)/2,(CAM2.y+CAM4.y)/2+300,120],spread:110}),null,0);
    tl.to(s4rot.cov,{ry:13,duration:11,ease:'sine.inOut',onUpdate:s4css},0); tl.to(s4rot.fig,{ry:-7,duration:11,ease:'sine.inOut'},0);
    say(tl,1.4,'华大参与反刍动物研究，成果发表于 <em>Science</em>。');
    tl.to(cv,{opacity:1,filter:'blur(0px) brightness(1)',duration:1.8,ease:'power2.out'},2.8);
    tl.to(f.params,{cA:.10,duration:1.8},3.0);
    tl.to('#s4-br',{opacity:1,duration:1},3.4);
    tl.to('.cover-sheen',{backgroundPosition:'-30% 0',duration:2.2,ease:'power2.inOut'},4.2);
    tl.add(()=>{ $$('#cov-meta div').forEach((d,i)=>gsap.delayedCall(i*.4,()=>decode(d,d.dataset.t,1.0))); },3.6);
    tl.to(fg,{opacity:1,filter:'blur(0px) brightness(1)',duration:1.8,ease:'power2.out'},5.0);
    tl.to(f.params,{gA:.06,duration:1.8},5.2);
    tl.to('#fig-tag',{opacity:1,duration:1},5.8);
    caption(tl,7.0,'华大参与文章：解析反刍动物进化树，确认鹿茸进化地位的<b>独特性</b>。');
    const fl={a:0}; tl.to(fl,{a:1,duration:1.2},3.2).to(fl,{a:.4,duration:2},4.6);
    draw=()=>{ const p=cssPt(COV,s4rot.cov,COV.w/2,-COV.h/2), q=project(p[0],p[1],p[2]); if(q) flare(q[0],q[1],110,fl.a*.5,3); };
    tl.to({}, {duration:.01}, 11.0);
  }, key:10.2 },
 { // 5 dual-chamber freshness lock (双舱锁鲜) — usage GLB v8 clip: pull ring 0–2.5s, press 3–4s, mixing 4–10.5s, snap 10.5–12s, drip 12.5–16.2s
  build(tl){ const st5=$('#s5u'), steps=$$('#u-steps .u-step'), labL=$('#u-lab-low'), labT=$('#u-lab-top'), temp=$('#u-temp');
    gsap.set([labL,labT,temp,'#u-steps'],{opacity:0}); steps.forEach(s=>s.classList.remove('on','done'));
    camTo(tl,CAM5,0,2.6,'power3.inOut');
    say(tl,.8,'<em>双舱锁鲜</em>');
    caption(tl,2.4,'<b>−40℃</b> 冻干锁鲜鹿茸精华');
    const stepOn=(i,at)=>tl.call(()=>steps.forEach((s,k)=>{ s.classList.toggle('on',k===i); s.classList.toggle('done',k<i); }),null,at);
    if(!R3.ok || !R3.use){ tl.to(temp,{opacity:1,duration:1},1.6); tl.to('#u-steps',{opacity:1,duration:1},6); stepOn(0,6.5); stepOn(1,8); stepOn(2,9.5); tl.to({}, {duration:.01}, 12); return; }
    const S=R3.use, u=S.u, L=UL;
    vis3({use:1}); S.pour=0; S.ctl.ring=0; S.ctl.snap=0; S.ctl.tipA=1; S.ctl.drops=1; u.uDis.value=1.1; u.uFrost.value=0; u.uHi.value=0;
    const P={x:L.close.x, y:L.close.y, h:L.close.h, fl:1, ry:L.close.ry, z:0}, O={shell:.34, tail:.4, fade:1}, C={t:0};
    const apply=()=>{ const s=P.h/S.len, fy=P.y + P.fl*S.lowC.y*s; const w=W_(P.x,fy,CAM5,P.z); S.place(w[0],w[1],P.z,P.h*(1000+P.z)/1000,P.ry,0); S.setTime(C.t,O); };
    apply(); tl.to({}, {duration:25.6, ease:'none', onUpdate:apply}, 0);
    tl.call(()=>morphTo(F.use3d,{duration:2.0,order:'random',stagger:.3}),null,0);
    // (a) −40℃: freshness-lock chamber freezes
    tl.to(u.uDis,{value:-.2,duration:2.4,ease:'power1.inOut'},.6);
    tl.to(u.uFrost,{value:1,duration:2.6,ease:'power2.inOut'},1.4);
    tl.to(temp,{opacity:1,duration:1},1.8); tl.add(()=>decode($('#u-temp b'),'−40℃',1.0),1.8);
    tl.to(P,{ry:L.close.ry+.35,duration:7,ease:'sine.inOut'},.4);
    // (b) highlight + label the lower chamber
    tl.to(u.uHi,{value:1,duration:1,ease:'power2.out'},4.6).to(u.uHi,{value:.35,duration:1.6},5.8);
    tl.to(labL,{opacity:1,duration:.9},4.8); tl.to(labT,{opacity:1,duration:.9},5.6);
    // (c) pull back: whole ampoule upright
    unsay(tl,7.4); uncap(tl,7.4); tl.to([labL,labT,temp],{opacity:0,duration:.7},8.4);
    tl.to(P,{fl:0,h:L.full.h,x:L.full.x,y:L.full.y,duration:2.2,ease:'power3.inOut'},7.6);
    tl.to(O,{shell:1,tail:1,duration:1.6},7.8); tl.to(u.uFrost,{value:.18,duration:2},7.8); tl.to(u.uHi,{value:0,duration:1.5},7.8);
    // (d) side view, pull ring, press
    tl.to(P,{ry:L.side,duration:1.5,ease:'power2.inOut'},9.7);
    tl.to('#u-steps',{opacity:1,duration:.8},10.0);
    stepOn(0,11.0); tl.to(C,{t:2.5,duration:2.5,ease:'none'},11.0); tl.to(S.ctl,{ring:1,duration:1.8,ease:'power1.inOut'},11.4);
    stepOn(1,13.6); tl.call(()=>{ O.shell=null; O.tail=null; },null,13.6);
    tl.to(C,{t:4.1,duration:1.4,ease:'none'},13.6); tl.to(u.uFrost,{value:0,duration:1},13.6);
    caption(tl,14.0,'按压，双舱相融');
    tl.to(C,{t:10.5,duration:3.4,ease:'power1.inOut'},15.0);
    uncap(tl,18.0);
    // (e) snap off the tip, essence drips out
    stepOn(2,18.2); tl.to(C,{t:12.0,duration:1.5,ease:'none'},18.2); tl.to(S.ctl,{snap:1,duration:.5,ease:'power2.in'},18.5); tl.to(S.ctl,{tipA:0,duration:.6},19.3);
    tl.to(C,{t:16.2,duration:4.0,ease:'none'},19.7); tl.to(S,{pour:1,duration:1.2,ease:'power2.inOut'},19.1);
    caption(tl,19.0,'掰断，滴出精华液');
    // hand-off to the efficacy scene: settle where the product ampoule appears
    uncap(tl,23.6); tl.to('#u-steps',{opacity:0,duration:.8},23.8);
    tl.to(P,{x:L.end.x,y:L.end.y,h:L.end.h,ry:L.end.ry,duration:1.8,ease:'power2.inOut'},23.7); tl.to(S,{pour:0,duration:1.6,ease:'power2.inOut'},23.7);
    const hand={a:0,o:1}; tl.to(hand,{a:1,o:0,duration:.8,ease:'power2.out'},12.9).to(hand,{a:0,o:.6,duration:.8,ease:'power2.in'},15.2);
    const drip={a:0}; tl.to(drip,{a:1,duration:.4},20.0).to(drip,{a:0,duration:.6},23.6); tl.to(S.ctl,{drops:0,duration:.5},23.4);
    const lab=(el,v,dx)=>{ const w=S.wp(v), p=project(w[0],w[1],w[2]); if(p) el.style.transform=`translate(${p[0]+dx}px,${p[1]}px)`; };
    const fr=PX.mulberry(77), crys=[...Array(26)].map(()=>[fr()-.5, fr()-.5, fr()*6.28, .6+fr()*.8]);
    draw=(t)=>{ const s=P.h/S.len;
      lab(labL, new THREE.Vector3(0,S.lowC.y,0), 0); lab(labT, new THREE.Vector3(0,S.lowC.y+S.lowH*1.15,0), 0);
      // frost: cold mist + crystalline glints around the lower chamber
      const fz=u.uFrost.value; if(fz>.02){ const w=S.wp(S.lowC), p=project(w[0],w[1],w[2]); if(p){ flare(p[0],p[1],S.lowH*s*1.3,fz*.2,0);
        for(const c of crys){ const tw=.5+.5*Math.sin(t*2.2*c[3]+c[2]); const x=p[0]+c[0]*S.lowH*s*.9, y=p[1]+c[1]*S.lowH*s*1.1; flare(x,y,12+10*c[3],fz*.6*tw*tw,c[3]>1.1?1.6:0); } } }
      // stylised hand (fingertip) pushing the tail up during the press
      if(hand.a>.01){ const w=S.wp(S.top), p=project(w[0],w[1],w[2]); if(p) drawFinger(p[0],p[1]-hand.o*160*L.k,L.k*1.15,hand.a,-1); }
      if(drip.a>.01) dripFx(S,t,drip.a,L.k);
    };
    tl.to({}, {duration:.01}, 25.6);
  }, key:16.2, key2:5.9, hold:.2 },
 { // 6 product → efficacy → brand
  build(tl){ const aw=$('#amp-wrap'), bw=$('#box-wrap'), eff=$('#eff');
    const rows=$$('.eff-row'), nums=$$('.rnum');
    gsap.set(eff,{opacity:0}); gsap.set(['.eff-title','.eff-h','.eff-note'],{opacity:0,y:14}); gsap.set(rows,{opacity:0,y:14}); nums.forEach(n=>rollSet(n,'00.00'));
    gsap.set('.eff-h',{'--w':0}); gsap.set(['#end-logo','.end-name','.end-brands'],{opacity:0}); gsap.set('#brand',{opacity:.5});
    gsap.set(aw,{opacity:0}); gsap.set(bw,{opacity:0});
    camTo(tl,CAM5,0,2.6,'power3.inOut');
    say(tl,1.0,'凝于一瓶<em>小鹿精华</em>。');
    caption(tl,2.4,'鹿茸凝时抗皱冻干精华液 · <b>1.5mL 溶媒 + 5mg 冻干粉</b>');
    // efficacy panel (shared)
    const effIn=(t0)=>{ tl.to(eff,{opacity:1,duration:.4},t0); tl.to('.eff-title',{opacity:1,y:0,duration:1,ease:'power2.out'},t0);
      tl.to('.eff-h',{opacity:1,y:0,duration:.9,stagger:.25,ease:'power2.out'},t0+.5);
      rows.forEach((r,i)=>{ const t=t0+.9+[0,.5,.25,.75][i]; tl.to(r,{opacity:1,y:0,duration:.8,ease:'power2.out'},t); tl.add(()=>rollNum(nums[i],nums[i].dataset.v,2.0+i*.15),t+.15); });
      tl.to('.eff-note',{opacity:1,y:0,duration:1},t0+3.2); };
    const fl={a:0}; tl.to(fl,{a:1,duration:1.4},2.6).to(fl,{a:.3,duration:2},5);
    const fromU=(PREV===5 && R3.ok && !!R3.use);
    if(R3.ok){ const A=R3.amp, X=R3.box; vis3({amp:1,use:fromU}); A.u.uDis.value=1.1; X.u.uDis.value=1.1; F.amp3d.params.pA=1; F.eff3d.params.pA=1; F.end3d.params.logoA=1;
      const P={ax:960, ay:452, ah:640, az:0, ry:0, bx:500, by:600, bw:500, bz:0, bry:-.34, brx:.36};
      const apply=()=>{ const w=W_(P.ax,P.ay,CAM5,P.az); A.place(w[0],w[1],P.az,P.ah*(1000+P.az)/1000,P.ry,.06); const b=W_(P.bx,P.by,CAM5,P.bz); X.place(b[0],b[1],P.bz,P.bw*(1000+P.bz)/1000,P.bry,P.brx); };
      apply(); const spin={t:0}; tl.to(spin,{t:22,duration:22,ease:'none',onUpdate:()=>{ P.ry=spin.t*.32; apply(); }},0);
      tl.call(()=>morphTo(F.amp3d,{duration:3.0,order:'index',stagger:.6,ctrl:[CAM5.x-420, CAM5.y+520, 0],spread:70}),null,0);
      if(fromU){ const U5=R3.use.u; tl.to(A.u.uDis,{value:-.2,duration:1.6,ease:'power1.inOut'},3.0); tl.to(U5.uDis,{value:1.1,duration:1.4,ease:'power1.inOut'},3.2); tl.call(()=>vis3({amp:1,box:X.pivot.visible}),null,4.7); }
      else tl.to(A.u.uDis,{value:-.2,duration:2.6,ease:'power1.inOut'},2.4); tl.to(F.amp3d.params,{pA:.14,duration:2.4},3.0);
      // phase B — open box + ampoule left, efficacy right
      unsay(tl,5.2); uncap(tl,5.2);
      tl.to(P,{ax:850,ay:580,ah:440,az:-140,duration:2.4,ease:'power3.inOut',onUpdate:apply},5.4);
      tl.call(()=>{ vis3({amp:1,box:1}); },null,5.6);
      tl.call(()=>morphTo(F.eff3d,{duration:2.6,order:'random',stagger:.4}),null,5.6);
      tl.to(X.u.uDis,{value:-.2,duration:2.8,ease:'power1.inOut'},6.4); tl.to(F.eff3d.params,{pA:.12,duration:2.4},7.4);
      tl.to(P,{bry:-.18,duration:10,ease:'sine.inOut',onUpdate:apply},6.0);
      effIn(6.6);
      // phase C — brand
      tl.to(eff,{opacity:0,duration:.9,ease:'power2.in'},15.4);
      tl.to(P,{bx:880,by:540,bw:500,ax:1250,ay:520,ah:420,az:-60,bry:-.12,duration:2.6,ease:'power3.inOut',onUpdate:apply},15.6);
      tl.call(()=>morphTo(F.end3d,{duration:2.6,order:'random',stagger:.4}),null,15.8);
      tl.to('#brand',{opacity:0,duration:.8},15.8);
      tl.to('#end-logo',{opacity:1,duration:1.4},17.6); tl.to(F.end3d.params,{logoA:.1,duration:1.4},17.9);
      tl.to('.end-name',{opacity:1,duration:1},18.2); tl.to('.end-brands',{opacity:1,duration:1},18.6);
      draw=()=>{ const w=W_(P.ax,P.ay-P.ah*.1,CAM5); const p=project(w[0],w[1],0); if(p) flare(p[0],p[1],200,fl.a*.4,3.5); };
      tl.to({}, {duration:.01}, 21.0);
    } else {
      const Aa=F.AMP_B, C=F.AMP_C; F.amp.params.absorb=0; F.end.params.logoA=1;
      gsap.set(aw,{left:Aa.l,top:Aa.t,width:Aa.w,height:Aa.h,opacity:0,filter:'blur(14px)'}); gsap.set(bw,{left:900,top:350,width:680,height:490,y:40,filter:'blur(10px)'});
      tl.call(()=>morphTo(F.amp,{duration:3.0,order:'index',stagger:.6,ctrl:[CAM5.x-420, CAM5.y+520, 0],spread:70}),null,0);
      tl.to(aw,{opacity:1,filter:'blur(0px)',duration:2,ease:'power2.out'},3.0); tl.to(F.amp.params,{absorb:1,duration:2.4,ease:'power2.inOut'},3.4);
      unsay(tl,5.2); uncap(tl,5.2); effIn(6.0);
      tl.to(eff,{opacity:0,duration:.9},15.4);
      tl.to(aw,{left:C.l,top:C.t,width:C.w,height:C.h,duration:2,ease:'power3.inOut'},15.6);
      tl.call(()=>morphTo(F.end,{duration:2.6,order:'random',stagger:.4}),null,15.7); tl.to('#brand',{opacity:0,duration:.8},15.8);
      tl.to(bw,{opacity:1,y:0,filter:'blur(0px)',duration:1.8,ease:'power3.out'},16.4);
      tl.to('#end-logo',{opacity:1,duration:1.4},17.6); tl.to(F.end.params,{logoA:.12,duration:1.4},17.9);
      tl.to('.end-name',{opacity:1,duration:1},18.2); tl.to('.end-brands',{opacity:1,duration:1},18.6);
      draw=()=>{ const ax=parseFloat(aw.style.left)+parseFloat(aw.style.width)/2, ay=parseFloat(aw.style.top)+parseFloat(aw.style.height)*.42; flare(ax,ay,200,fl.a*.45,3.5); };
      tl.to({}, {duration:.01}, 21.0);
    }
  }, key:20.4, key2:12.6 },
];
/* rolling digits for efficacy numbers */
function rollSet(el,str){ el.innerHTML=''; for(const ch of str){ const d=document.createElement('span'); d.className='dg';
  if(/\d/.test(ch)){ const col=document.createElement('span'); col.innerHTML='<span>'+ch+'</span>'; d.appendChild(col); } else { d.textContent=ch; } el.appendChild(d); } }
function rollNum(el,str,dur){ el.innerHTML=''; let k=0;
  for(const ch of str){ const d=document.createElement('span'); d.className='dg';
    if(/\d/.test(ch)){ const v=+ch, loops=1+k, n=loops*10+v+1; const col=document.createElement('span'); let h=''; for(let i=0;i<n;i++) h+='<span>'+(i%10)+'</span>'; col.innerHTML=h; d.appendChild(col);
      gsap.fromTo(col,{yPercent:0},{yPercent:-100*(n-1)/n,duration:dur*(.75+k*.08),ease:'power3.out'}); k++; }
    else d.textContent=ch; el.appendChild(d); } }

/* ---------- navigation ---------- */
let cur=-1, tl=null, autoCall=null;
let loaded=false, pending=null;
function go(i){ i=clamp(i,0,scenes.length-1); if(i===cur && tl) return;
  if(i>0 && !loaded){ pending=i; return; }
  if(tl) tl.kill(); if(autoCall) autoCall.kill(); gsap.killTweensOf(cam);
  const prev=cur; cur=i; draw=null; PREV=prev; const slow=(prev===2&&i===3);
  $$('.scene').forEach((s,k)=>{ if(k===i){ gsap.killTweensOf(s); gsap.set(s,{visibility:'visible',opacity:0}); gsap.to(s,{opacity:1,duration:.6,delay:.25}); }
    else if(k===prev){ gsap.to(s,{opacity:0,duration:slow?1.4:.45,ease:slow?'sine.inOut':'power1.inOut',onComplete:()=>{ if(cur!==k) gsap.set(s,{visibility:'hidden'}); }}); } else gsap.set(s,{visibility:'hidden',opacity:0}); });
  gsap.to(st,{opacity:0,duration:.4}); gsap.to(cap,{opacity:0,duration:.4});
  // tag + index
  const tag=$('#tag'); gsap.to(tag,{opacity:0,duration:.3,onComplete:()=>{ $('#tag-n').textContent=String(i).padStart(2,'0'); $('#tag-t').textContent=TAGS[i]; if(i>0) gsap.to(tag,{opacity:1,duration:.8,delay:.6}); }});
  $('#index').textContent=String(i).padStart(2,'0')+' / 06';
  if(R3.ok && R3.st){ gsap.killTweensOf(R3.st); gsap.to(R3.st,{k:i===6?1:0,duration:i===6?1.6:.8,ease:'sine.inOut'}); }   // bright studio light for the final product
  if(i!==6) gsap.to('#brand',{opacity:.5,duration:.6});
  tl = gsap.timeline({onComplete:()=>{ if(AUTO && cur<scenes.length-1) autoCall=gsap.delayedCall(scenes[cur].hold||.8,()=>go(cur+1)); }});
  scenes[i].build(tl);
  if(i===6 && prev===5 && R3.ok && R3.use) tl.seek(3.0,false);
}
function next(){ go(cur+1); } function prev(){ go(cur-1); }
addEventListener('keydown',e=>{ if(['ArrowRight','PageDown',' ','Enter'].includes(e.key)){ e.preventDefault(); next(); } else if(['ArrowLeft','PageUp','Backspace'].includes(e.key)){ e.preventDefault(); prev(); }
  else if(e.key==='Home') go(0); else if(e.key==='f'){ document.fullscreenElement? document.exitFullscreen() : document.documentElement.requestFullscreen(); } });
addEventListener('click',()=>next());

/* ---------- loop ---------- */
let lastT=0;
gsap.ticker.add(()=>{ const t=gsap.ticker.time, dt=Math.min(.1,Math.max(0,t-lastT)); lastT=t;
  if(R3.ok){ R3.update(dt); } PX.step(t); if(R3.ok) R3.render(cam); PX.render(t);
  fx.clearRect(0,0,W,H); if(draw) draw(t);
  const L=PX.lead; if(L){ const p=project(L[0],L[1],L[2]); if(p) flare(p[0],p[1],90,.55*Math.sin(L[3]*Math.PI),3); }
  $('#grain').style.transform=`translate(${(t*997%13)|0}px,${(t*631%11)|0}px)`; });

/* ---------- boot ---------- */
window.__scene=()=>({i:cur, t:tl?tl.time():0, d:tl?tl.duration():0, key:scenes[cur]&&scenes[cur].key, key2:scenes[cur]&&scenes[cur].key2});
window.__go=go;
const loadUI={i:$('#load-i'), n:$('#load-n'), l:$('#load-l')};
function progress(p){ loadUI.i.style.width=(p*100).toFixed(1)+'%'; loadUI.n.textContent=String(Math.round(p*100)).padStart(3,'0'); }
async function load3D(){
  if(Q.get('no3d')==='1') throw new Error('3D disabled by ?no3d=1');
  const bufs=await window.loadModels(p=>progress(p*.92)); loadUI.l.textContent='PREPARING SCENE';
  await R3.init(bufs); progress(.97); buildAll3D(); progress(1);
}
Promise.all([document.fonts.load('104px XDisplay'),document.fonts.load('66px XSerif'),document.fonts.load('20px XMono'),document.fonts.load('30px XSans'),document.fonts.load('200px XCond'),document.fonts.load('600 46px XCond'),
  ...$$('img').map(im=>im.complete?1:new Promise(r=>{im.onload=im.onerror=r;}))]).then(async ()=>{
  buildAll(); buildS4(); PX.setForm(makeFormation(()=>{},{dust:[0,0]}));
  for(let i=0;i<PX.N;i++) PX.A[i*4+1]=0;
  if(!CAPTURE) go(0);
  try{ await load3D(); }catch(e){ console.warn('[3D fallback]',e); R3.ok=false; }
  window.__3d=R3.ok; loaded=true;
  loadUI.l.textContent= R3.ok? 'READY' : 'READY · 2D'; gsap.to('#load',{opacity:0,duration:1.2,delay:.4});
  window.__ready=true;
  if(!CAPTURE){ if(pending!=null){ const p=pending; pending=null; go(p); }
    if(!AUTO){ gsap.fromTo('#hint',{opacity:0},{opacity:1,duration:1,delay:1.5}); gsap.to('#hint',{opacity:0,duration:1.2,delay:6}); } }
});
})();
