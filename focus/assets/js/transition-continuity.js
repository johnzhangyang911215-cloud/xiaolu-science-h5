/* Continuous scene bridges. All animation state is supplied by the caller. */
(function(global){
  'use strict';
  const TAU=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=(a,b,t)=>{const k=clamp((t-a)/(b-a));return k*k*(3-2*k);};
  function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  // Freeze the current particles into a translated coordinate system. Relative camera-space
  // coordinates (and hence every pixel/depth) are unchanged when the caller switches cameras.
  // Call PX.morphTo(target, ...) immediately after this function and changing the camera.
  function rebaseParticles(px,fromCam,toCam){
    const P=px.P.slice(),A=px.A.slice(),dx=toCam.x-fromCam.x,dy=toCam.y-fromCam.y,dz=toCam.z-fromCam.z;
    const f=px.makeFormation(put=>{for(let i=0;i<px.N;i++)put(P[i*3]+dx,P[i*3+1]+dy,P[i*3+2]+dz,A[i*4],A[i*4+1],A[i*4+2]);},{dust:[toCam.x,toCam.y]});
    // Preserve per-particle attributes, including the random seed attribute.
    f.att.set(A);f.baseA.set(A);px.P.set(f.pos);px.A.set(f.att);px.setForm(f);return f;
  }
  // This duplicates only the deterministic particle seed layout of FrozenChamberFX.
  // Every random draw is kept in its original order, allowing a pixel-matched hand-off.
  function snowParticles(seed){
    const rand=rng(seed==null?122:seed),out=[];
    for(let i=0;i<320;i++){
      const angle=rand()*TAU,r=Math.sqrt(rand())*.94,z=Math.sin(angle)*r;
      const q={x:Math.cos(angle)*r*.47,y:(rand()-.5)*.79,z,
        cloudX:(rand()-.5)*1.5,cloudY:(rand()-.5)*1.88,
        phase:rand()*TAU,r:1.1+rand()*2.1,angle:rand()*TAU,
        drift:.025+rand()*.025,snow:i%17===0,rough:rand(),rank:rand(),
        grains:Array.from({length:3},()=>[(rand()-.5)*.023,(rand()-.5)*.025,.45+rand()*.65])};
      out.push(q);
    }
    return out;
  }
  function snowTarget(q,p){
    const t=Number(p.time)||0,freeze=clamp(p.freeze),form=smooth(0,1,p.form||0);
    const w=p.width||390,h=p.height||295,c=p.center||{x:1280,y:565},drift=(1-freeze)*(1-form);
    const x0=q.cloudX+Math.sin(t*q.drift+q.phase)*.085*drift,y0=q.cloudY+Math.cos(t*q.drift*.73+q.phase)*.065*drift;
    return{x:c.x+mix(x0,q.x,form)*w,y:c.y+mix(y0,q.y+q.z*.045,form)*h};
  }
  function sampleSnowTargets(seed,p){return snowParticles(seed).map(q=>({...q,...snowTarget(q,p)}));}
  function hex(ctx,x,y,r,a,opacity){
    ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.strokeStyle='rgba(207,249,255,'+opacity+')';ctx.lineWidth=Math.max(.55,r*.048);ctx.beginPath();
    for(let k=0;k<6;k++){const q=k*TAU/6,c=Math.cos(q),s=Math.sin(q);ctx.moveTo(0,0);ctx.lineTo(c*r,s*r);
      for(const f of [.42,.7])for(const side of [-1,1]){const bx=c*r*f,by=s*r*f,qa=q+side*Math.PI*.69,ll=r*(f===.42?.2:.26);ctx.moveTo(bx,by);ctx.lineTo(bx+Math.cos(qa)*ll,by+Math.sin(qa)*ll);}}
    ctx.stroke();ctx.beginPath();for(let k=0;k<6;k++){const q=k*TAU/6,x=Math.cos(q)*r*.31,y=Math.sin(q)*r*.31;k?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fillStyle='rgba(179,231,249,'+(opacity*.16)+')';ctx.fill();ctx.stroke();ctx.restore();
  }
  function createCoverSnow(options){
    const o=options||{},seed=o.seed==null?122:o.seed,rect=o.rect||{cx:1160,cy:555,w:508,h:720},rot=o.rotation||{};
    const box={cx:rect.cx==null?rect.left+rect.width/2:rect.cx,cy:rect.cy==null?rect.top+rect.height/2:rect.cy,w:rect.w||rect.width,h:rect.h||rect.height};
    const initial={ry:Number(rot.ry)||0,rx:Number(rot.rx)||0};
    const origin=o.origin||{x:960,y:540},perspective=o.perspective||1000;
    const points=snowParticles(seed),rr=rng(seed^0x65ad39);let pixels=null;
    if(o.image){try{const c=document.createElement('canvas');c.width=160;c.height=224;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(o.image,0,0,c.width,c.height);pixels=g.getImageData(0,0,c.width,c.height).data;}catch(e){/* Local image may prohibit readback; geometry still remains deterministic. */}}
    for(const q of points){
      // Cover fragments follow the actual cover image, rather than a generic burst.
      q.u=rr();q.v=rr();q.curve=(rr()-.5)*150;q.side=(rr()-.5)*90;
      if(pixels){const n=(Math.min(223,Math.floor(q.v*224))*160+Math.min(159,Math.floor(q.u*160)))*4;q.color=[pixels[n],pixels[n+1],pixels[n+2]];}else q.color=[194,225,240];
      q.sub=Array.from({length:5},()=>({u:rr(),v:rr(),r:1.1+rr()*1.4}));
    }
    function coverPose(progress){
      const p=clamp(progress),push=smooth(0,.68,p),z=260*push,ry=mix(initial.ry,0,push),rx=mix(initial.rx,0,push);
      return {z,ry,rx,opacity:1-smooth(.24,.67,p),transform:'translateZ('+z+'px) rotateY('+ry+'deg) rotateX('+rx+'deg)'};
    }
    function projectCover(u,v,pose){
      const ry=pose.ry*Math.PI/180,rx=pose.rx*Math.PI/180,lx=(u-.5)*box.w,ly=(v-.5)*box.h;
      const yy=ly*Math.cos(rx),zz=ly*Math.sin(rx),xx=lx*Math.cos(ry)+zz*Math.sin(ry),z=-lx*Math.sin(ry)+zz*Math.cos(ry)+pose.z;
      const k=perspective/(perspective-z);
      return{x:origin.x+(box.cx+xx-origin.x)*k,y:origin.y+(box.cy+yy-origin.y)*k};
    }
    function draw(ctx,p){
      p=p||{};const progress=clamp(p.progress),alpha=clamp(p.alpha==null?1:p.alpha),appear=smooth(.16,.48,progress);
      if(alpha*appear<.001)return;
      const target=Object.assign({center:{x:1280,y:565},width:390,height:295,time:p.time||0,freeze:p.freeze||0,form:0},p.target||{});
      const pose=coverPose(progress),travel=smooth(.26,1,progress),curve=Math.sin(Math.PI*travel),colorChange=smooth(.3,.92,progress),freeze=clamp(target.freeze),front=-1.15+freeze*2.3;
      const size=Math.min(target.width,target.height),time=Number(target.time)||0;
      ctx.save();ctx.globalAlpha*=Math.min(1,alpha*appear*(1+Math.sin(travel*Math.PI)*.4));
      for(const q of points){
        const src=projectCover(q.u,q.v,pose),dst=snowTarget(q,target),x=mix(src.x,dst.x,travel)+q.curve*curve,y=mix(src.y,dst.y,travel)+q.side*curve;
        const ice=smooth(q.cloudY-.15,q.cloudY+.15,front),depth=.45+(q.z+1)*.275,opacity=(.25+ice*.56)*depth*(1+1.5*curve),rr=q.r*size/400*(1+.25*curve);
        const r=Math.round(mix(q.color[0],211,colorChange)),g=Math.round(mix(q.color[1],247,colorChange)),b=Math.round(mix(q.color[2],255,colorChange));
        // Very small image fragments become angular snow. Their trajectories end on the
        // exact snow cloud samples, including the frozen state at the hand-off time.
        if(q.snow&&colorChange>.12){hex(ctx,x,y,rr*(4.5+ice*3.1)*colorChange,q.angle+time*.055*(1-freeze),opacity*colorChange);}
        else if(ice>.12){const rad=rr*(.8+ice*1.25);ctx.beginPath();ctx.moveTo(x,y-rad);ctx.lineTo(x+rad*.75,y+rad*.13);ctx.lineTo(x,y+rad*.75);ctx.lineTo(x-rad*.8,y);ctx.closePath();ctx.fillStyle='rgba('+r+','+g+','+b+','+opacity+')';ctx.fill();}
        else{ctx.beginPath();ctx.arc(x,y,Math.max(.55,rr*.65),0,TAU);ctx.fillStyle='rgba('+r+','+g+','+b+','+(opacity*.7)+')';ctx.fill();}
        if(progress<.94)for(const sub of q.sub){
          const sp=projectCover(sub.u,sub.v,pose),k=smooth(.3,.94,progress),sx=mix(sp.x,dst.x,k)+q.side*Math.sin(k*Math.PI),sy=mix(sp.y,dst.y,k)+q.curve*Math.sin(k*Math.PI);
          ctx.fillStyle='rgba('+r+','+g+','+b+','+(Math.sqrt(1-k)*.65)+')';ctx.fillRect(sx,sy,sub.r,sub.r);
        }
      }
      ctx.restore();
    }
    return{draw,coverPose,projectCover,points:points.map(q=>({u:q.u,v:q.v}))};
  }
  global.ContinuityFX={rebaseParticles,createCoverSnow,sampleSnowTargets};
})(window);
