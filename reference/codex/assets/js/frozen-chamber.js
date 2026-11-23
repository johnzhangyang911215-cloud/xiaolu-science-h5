/* True 3D snow → frozen chamber → porous lyophilised cake.
 * All objects live in the same R3.scene and are photographed by R3.camera.
 * draw(ctx, state) keeps the old timeline API; ctx is deliberately never drawn into.
 * The first 320 particles preserve ContinuityFX's deterministic seed ordering.
 */
(function(global){
  'use strict';
  const TAU=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=(a,b,t)=>{const k=clamp((t-a)/(b-a));return k*k*(3-2*k);};
  const instances=new Set();
  function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  function seeds(seed){
    const rand=rng(seed),out=[];
    for(let i=0;i<320;i++){
      const angle=rand()*TAU,r=Math.sqrt(rand())*.94,z=Math.sin(angle)*r;
      out.push({x:Math.cos(angle)*r*.47,y:(rand()-.5)*.79,z,
        cloudX:(rand()-.5)*1.5,cloudY:(rand()-.5)*1.88,
        phase:rand()*TAU,r:1.1+rand()*2.1,angle:rand()*TAU,
        drift:.025+rand()*.025,snow:i%17===0,rough:rand(),rank:rand(),
        grains:Array.from({length:3},()=>[(rand()-.5)*.023,(rand()-.5)*.025,.45+rand()*.65])});
    }
    return out;
  }
  function flakeGeometry(T){
    // Closed, extruded hexagonal branches, not a 2D snowflake image.
    const pos=[];
    function rod(ax,ay,bx,by,width,depth){
      const dx=bx-ax,dy=by-ay,l=Math.hypot(dx,dy),nx=-dy/l*width*.5,ny=dx/l*width*.5;
      const v=[[ax+nx,ay+ny,-depth],[bx+nx,by+ny,-depth],[bx-nx,by-ny,-depth],[ax-nx,ay-ny,-depth],
        [ax+nx,ay+ny,depth],[bx+nx,by+ny,depth],[bx-nx,by-ny,depth],[ax-nx,ay-ny,depth]];
      for(const face of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]){
        for(const tri of [[face[0],face[1],face[2]],[face[0],face[2],face[3]]])for(const i of tri)pos.push(...v[i]);
      }
    }
    for(let k=0;k<6;k++){
      const a=k*TAU/6,c=Math.cos(a),s=Math.sin(a);rod(0,0,c,s,.055,.028);
      for(const f of [.48,.73])for(const side of [-1,1]){
        const x=c*f,y=s*f,b=a+side*Math.PI*.67,r=f===.48?.23:.28;
        rod(x,y,x+Math.cos(b)*r,y+Math.sin(b)*r,.04,.022);
      }
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
  }
  const grainNoise=`
    float fhash(vec3 p){p=fract(p*.3183099+vec3(.13,.23,.31));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float fnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(fhash(i),fhash(i+vec3(1,0,0)),f.x),mix(fhash(i+vec3(0,1,0)),fhash(i+vec3(1,1,0)),f.x),f.y),mix(mix(fhash(i+vec3(0,0,1)),fhash(i+vec3(1,0,1)),f.x),mix(fhash(i+vec3(0,1,1)),fhash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  `;
  function frostSurface(material,dry){
    material.onBeforeCompile=sh=>{
      sh.vertexShader='varying vec3 vFrostP;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFrostP=position;');
      sh.fragmentShader='varying vec3 vFrostP;\n'+grainNoise+sh.fragmentShader;
      sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float fGrain=fnoise(vFrostP*92.);float fFine=fnoise(vFrostP*215.);
        ${dry?`float pore=smoothstep(.66,.8,fGrain)*(.54+.46*fFine);diffuseColor.rgb*=mix(1.04,.35,pore);diffuseColor.rgb*=.88+.22*fFine;`:
        `float frost=smoothstep(.57,.79,fGrain)*.14;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.73,.80,.82),frost);`}
      `);
    };
    material.customProgramCacheKey=()=>dry?'cinema-dry-porous-1':'cinema-ice-frost-1';
  }
  function create(seed){
    seed=seed==null?122:seed;
    const data=seeds(seed),extra=rng(seed^0x513ec8);
    // Additional points occupy real depth, including in front of the focal chamber.
    for(let i=320;i<1600;i++){
      const a=extra()*TAU,r=Math.sqrt(extra())*.46;
      data.push({x:Math.cos(a)*r,y:(extra()-.5)*.82,z:Math.sin(a)*r*2,
        cloudX:(extra()-.5)*2.45,cloudY:(extra()-.5)*2.7,
        phase:extra()*TAU,r:.35+extra()*1.1,angle:extra()*TAU,drift:.025+extra()*.03,
        snow:i%23===0,rough:extra(),rank:extra(),grains:[]});
    }
    let built=false,disposed=false,group,cloud,flakes,ice,cake,grains,rims,iceCore,facets,fissures;
    let pointGeo,pointMat,flakeMat,iceMat,cakeMat,grainMat,rimMat,coreMat,facetMat,fissureMat;
    let cupBox,cupCenter,cupSize,last={};const matrices={};
    const flakeIndices=data.map((q,i)=>q.snow?i:-1).filter(i=>i>=0);
    const grainData=[];
    for(let i=0;i<480;i++){
      const a=extra()*TAU,shell=i<320,r=shell?.462:Math.sqrt(extra())*.455;
      grainData.push({x:Math.cos(a)*r,y:shell?mix(-.43,.29,extra()):.29+(extra()-.5)*.025,z:Math.sin(a)*r,
        s:.005+extra()*.008,rx:extra()*TAU,ry:extra()*TAU,rz:extra()*TAU});
    }
    function init(){
      if(built||disposed)return built;
      const T=global.THREE,R=global.R3;if(!T||!R||!R.scene)return false;
      group=new T.Group();group.name='CINEMA_FrozenChamber_3D';group.visible=false;group.matrixAutoUpdate=false;
      group.userData={cinemaFreeze:true,autofocusTarget:true,phase:'snow',particles:data.length};R.scene.add(group);
      matrices.temp=new T.Matrix4();matrices.center=new T.Matrix4();
      matrices.object=new T.Object3D();
      const pos=new Float32Array(data.length*3),sizes=new Float32Array(data.length),lum=new Float32Array(data.length);
      for(let i=0;i<data.length;i++){sizes[i]=data[i].r;lum[i]=.38+data[i].rough*.5;}
      pointGeo=new T.BufferGeometry();pointGeo.setAttribute('position',new T.BufferAttribute(pos,3));pointGeo.setAttribute('aSize',new T.BufferAttribute(sizes,1));pointGeo.setAttribute('aLum',new T.BufferAttribute(lum,1));
      pointGeo.attributes.position.setUsage(T.DynamicDrawUsage);
      pointMat=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,
        uniforms:{uOpacity:{value:0},uScale:{value:300},uFreeze:{value:0},uDry:{value:0},uColor:{value:new T.Color(0xcbd8db)}},
        vertexShader:`attribute float aSize,aLum;varying float vLum,vFreeze;uniform float uScale,uFreeze;
          void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vLum=aLum;vFreeze=uFreeze;
          gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uScale*2.4/max(10.,-mv.z),.8,13.);}`,
        fragmentShader:`varying float vLum,vFreeze;uniform float uOpacity,uDry;uniform vec3 uColor;
          void main(){vec2 p=(gl_PointCoord-.5)*2.;float r=length(p);if(r>1.)discard;
          float soft=exp(-r*r*5.5);float crystal=pow(max(0.,1.-max(abs(p.x)*.866+abs(p.y)*.5,abs(p.y))),1.7);
          float a=mix(soft,crystal,vFreeze*.5)*uOpacity*vLum;
          gl_FragColor=vec4(uColor*(1.+vFreeze*.14),a);}`});
      cloud=new T.Points(pointGeo,pointMat);cloud.name='Snow_volume_1600_points';cloud.frustumCulled=false;cloud.renderOrder=1;group.add(cloud);
      flakeMat=new T.MeshPhysicalMaterial({color:0xc8d2d6,roughness:.25,metalness:0,transmission:.12,thickness:.03,
        clearcoat:.3,clearcoatRoughness:.2,emissive:0x99bfca,emissiveIntensity:.105,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});
      flakes=new T.InstancedMesh(flakeGeometry(T),flakeMat,flakeIndices.length);flakes.name='Snow_crystals_extruded_hexagons';flakes.instanceMatrix.setUsage(T.DynamicDrawUsage);flakes.frustumCulled=false;group.add(flakes);
      iceMat=new T.MeshPhysicalMaterial({color:0xb9d0dc,roughness:.18,metalness:0,transmission:.68,thickness:.45,
        ior:1.31,clearcoat:1,clearcoatRoughness:.08,attenuationColor:new T.Color(0x8ca9bb),attenuationDistance:2.2,
        emissive:0x809fae,emissiveIntensity:.035,transparent:true,opacity:0,depthWrite:false});
      frostSurface(iceMat,false);
      const icyGeo=new T.CylinderGeometry(.486,.487,.96,80,20,false);ice=new T.Mesh(icyGeo,iceMat);ice.name='Solid_frosted_chamber';ice.renderOrder=3;group.add(ice);
      coreMat=new T.MeshStandardMaterial({color:0x91acb9,roughness:.54,emissive:0x6d8a9b,emissiveIntensity:.025,transparent:true,opacity:0,depthWrite:false});
      frostSurface(coreMat,false);iceCore=new T.Mesh(new T.CylinderGeometry(.457,.458,.88,64,12),coreMat);iceCore.name='Opaque_frozen_core';iceCore.renderOrder=2;group.add(iceCore);
      // Ice is a refractive volume with planes and fissures, rather than a matte cylinder.
      facetMat=new T.MeshPhysicalMaterial({color:0xb3cad7,roughness:.18,metalness:0,transmission:.4,thickness:.12,
        ior:1.31,clearcoat:1,clearcoatRoughness:.08,emissive:0x7f9fac,emissiveIntensity:.055,
        transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});
      facets=new T.InstancedMesh(new T.OctahedronGeometry(1,0),facetMat,56);facets.name='Frozen_crystal_planes';facets.frustumCulled=false;facets.renderOrder=2;
      const facetRng=rng(seed^0x78f23);
      for(let i=0;i<56;i++){
        const a=facetRng()*TAU,r=.27+facetRng()*.2,o=matrices.object;
        o.position.set(Math.cos(a)*r,(facetRng()-.5)*.82,Math.sin(a)*r);
        o.rotation.set(facetRng()*1.2,facetRng()*TAU,facetRng()*TAU);
        const k=.035+facetRng()*.045;o.scale.set(k*(1+facetRng()*.6),k*(1.4+facetRng()),k*.32);o.updateMatrix();facets.setMatrixAt(i,o.matrix);
      }group.add(facets);
      const crackVertices=[];
      function crack(a,y,da,dy,n){let pa=a,py=y;for(let i=1;i<=n;i++){
        const na=a+da*i/n+(facetRng()-.5)*.07,ny=y+dy*i/n+(facetRng()-.5)*.03;
        crackVertices.push(Math.cos(pa)*.49,py,Math.sin(pa)*.49,Math.cos(na)*.49,ny,Math.sin(na)*.49);pa=na;py=ny;
      }}
      for(let i=0;i<35;i++){
        const a=facetRng()*TAU,y=(facetRng()-.5)*.65,da=(facetRng()-.5)*.45,dy=(facetRng()-.5)*.38;
        crack(a,y,da,dy,4);crack(a+da*.5,y+dy*.5,da*.5+.11,-dy*.4,2);
      }
      const fissureGeo=new T.BufferGeometry();fissureGeo.setAttribute('position',new T.Float32BufferAttribute(crackVertices,3));
      fissureMat=new T.LineBasicMaterial({color:0xb1d0dc,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
      fissures=new T.LineSegments(fissureGeo,fissureMat);fissures.name='Ice_fissures_in_3D';fissures.renderOrder=4;group.add(fissures);
      cakeMat=new T.MeshStandardMaterial({color:0xcbd4da,roughness:.96,metalness:0,emissive:0x65717d,emissiveIntensity:.025,transparent:true,opacity:0,depthWrite:true});
      frostSurface(cakeMat,true);
      const cg=new T.CylinderGeometry(.465,.47,.76,96,32,false),cp=cg.attributes.position;
      // Slightly irregular surface is actual geometry; micro pores are material detail.
      for(let i=0;i<cp.count;i++){
        const x=cp.getX(i),y=cp.getY(i),z=cp.getZ(i),a=Math.atan2(z,x);
        const n=Math.sin(a*31+y*44)*Math.sin(a*17-y*73)*.0037+Math.cos(a*57+y*61)*.0021;
        const r=Math.hypot(x,z),ratio=r>.4?1+n/r:1;
        cp.setXYZ(i,x*ratio,y+(Math.abs(y)>.36?(Math.sin(x*46+z*36)*Math.cos(z*57-x*23)*.006):0),z*ratio);
      }
      cg.computeVertexNormals();cake=new T.Mesh(cg,cakeMat);cake.position.y=-.08;cake.name='Lyophilised_porous_cake';cake.renderOrder=2;group.add(cake);
      grainMat=new T.MeshStandardMaterial({color:0xd3dbe1,roughness:1,emissive:0x687581,emissiveIntensity:.02,transparent:true,opacity:0,depthWrite:false});
      grains=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),grainMat,grainData.length);grains.name='Dry_powder_surface_grains';grains.frustumCulled=false;grains.renderOrder=3;
      grainData.forEach((q,i)=>{const o=matrices.object;o.position.set(q.x,q.y,q.z);o.rotation.set(q.rx,q.ry,q.rz);o.scale.setScalar(q.s);o.updateMatrix();grains.setMatrixAt(i,o.matrix);});group.add(grains);
      rimMat=new T.MeshStandardMaterial({color:0x9db1bb,roughness:.3,metalness:.2,emissive:0xa7c6d5,emissiveIntensity:.08,transparent:true,opacity:0,depthWrite:false});
      rims=new T.Group();rims.name='Frozen_chamber_meniscus';
      for(const y of [-.478,.478]){const r=new T.Mesh(new T.TorusGeometry(.483,.0028,5,80),rimMat);r.rotation.x=Math.PI/2;r.position.y=y;rims.add(r);}group.add(rims);
      built=true;api.group=group;api.cloud=cloud;api.cake=cake;api.crystals=flakes;return true;
    }
    function targetTransform(p){
      const T=global.THREE,R=global.R3,m=R.use&&R.use.parts&&R.use.parts.GEO_PowderCup_PROXY;
      if(m){
        R.use.pivot.updateMatrixWorld(true);
        if(!cupBox){cupBox=new T.Box3().setFromBufferAttribute(m.geometry.attributes.position);cupCenter=cupBox.getCenter(new T.Vector3());cupSize=cupBox.getSize(new T.Vector3());}
        matrices.center.makeTranslation(cupCenter.x,cupCenter.y,cupCenter.z);
        matrices.temp.makeScale(cupSize.x,cupSize.y,cupSize.z);
        group.matrix.copy(m.matrixWorld).multiply(matrices.center).multiply(matrices.temp);
        group.matrixWorldNeedsUpdate=true;
      }else{
        // Fixed region coordinates: camera motion never drags the freezing object with it.
        const cam=p.camera||{x:7800,y:300,z:-1000},c=p.center||{x:1280,y:565},w=p.width||390,h=p.height||295;
        group.matrix.makeScale(w,h,w);group.matrix.setPosition(cam.x+c.x-960,cam.y+540-c.y,-cam.z-1000);group.matrixWorldNeedsUpdate=true;
      }
      group.updateMatrixWorld(true);
      const e=group.matrixWorld.elements;pointMat.uniforms.uScale.value=Math.max(Math.hypot(e[0],e[1],e[2]),Math.hypot(e[4],e[5],e[6]));
    }
    function draw(ctx,p){
      p=p||{};if(!init())return;
      const alpha=clamp(p.alpha==null?1:p.alpha)*(1-smooth(0,1,p.merge||0));
      group.visible=alpha>.002;if(!group.visible){hide();last={...p,visible:false};global.__cinemaFreeze={freeze:p.freeze||0,form:p.form||0,dry:p.dry||0,merge:p.merge||0,alpha,visible:false,threeD:true};return;}
      targetTransform(p);
      if(global.R3.post)global.R3.post.target=group;
      const f=clamp(p.freeze),form=smooth(0,1,p.form||0),dry=smooth(0,1,p.dry||0),time=Number(p.time)||0;
      const cohesion=smooth(0,.92,f);
      const pos=pointGeo.attributes.position.array,o=matrices.object,aspect=(cupSize?cupSize.x/cupSize.y:(p.width||390)/(p.height||295));
      for(let i=0;i<data.length;i++){
        const q=data[i],stop=smooth(.06+q.rank*.5,.30+q.rank*.5,f),drift=(1-stop)*(1-form);
        const xx=q.cloudX*(i<320?.70:.55)+Math.sin(time*q.drift*.75+q.phase)*.035*drift;
        const yy=-q.cloudY*(i<320?.72:.55)+Math.cos(time*q.drift*.55+q.phase)*.025*drift;
        const zz=q.z*.65+Math.sin(q.phase+time*.025)*.04*drift;
        // Gather and stop before the shell forms; both stages share the physical cup axis.
        const tx=q.x,ty=q.y-.02,tz=q.z*.455;
        const x=mix(mix(xx,tx*1.08,cohesion),tx,form);
        const y=mix(mix(yy,ty*1.12,cohesion),ty,form);
        const z=mix(mix(zz,q.z*.52,cohesion),tz,form);
        pos[i*3]=x;pos[i*3+1]=y;pos[i*3+2]=z;
      }
      pointGeo.attributes.position.needsUpdate=true;
      pointMat.uniforms.uOpacity.value=alpha*(.72-form*.50)*(1-dry*.94);
      pointMat.uniforms.uFreeze.value=f;pointMat.uniforms.uDry.value=dry;
      flakeIndices.forEach((index,i)=>{
        const q=data[index],stop=smooth(.06+q.rank*.5,.30+q.rank*.5,f),free=(1-stop)*(1-form);
        const size=(.020+q.r*.0048)*(index%3===0?1.38:1)*(1-dry*.88)*(1-form*.23);
        o.position.set(pos[index*3],pos[index*3+1],pos[index*3+2]);
        o.rotation.set(q.phase*.45+Math.sin(time*.09+q.angle)*.22*free,q.angle*.63+Math.sin(time*.07+q.phase)*.25*free,q.angle+Math.cos(time*.065+q.phase)*.18*free);
        // Counter the cup aspect ratio so the initial crystals read as hexagons, not ellipses.
        o.scale.set(size,size*aspect,size);o.updateMatrix();flakes.setMatrixAt(i,o.matrix);
      });flakes.instanceMatrix.needsUpdate=true;
      flakeMat.opacity=alpha*(.82+.16*f)*(1-form*.82)*(1-dry*.97);flakes.visible=flakeMat.opacity>.003;
      const shell=form*alpha;
      iceMat.opacity=shell*mix(.68,.08,dry);iceMat.roughness=mix(.18,.74,dry);iceMat.transmission=mix(.68,.1,dry);
      coreMat.opacity=shell*(1-dry)*.32;
      facetMat.opacity=shell*(1-dry)*.48;facets.visible=facetMat.opacity>.003;
      fissureMat.opacity=shell*(1-dry)*.3;fissures.visible=fissureMat.opacity>.003;
      ice.visible=iceMat.opacity>.003;iceCore.visible=coreMat.opacity>.003;
      cakeMat.opacity=alpha*dry*.98;cakeMat.depthWrite=cakeMat.opacity>.95;cake.visible=dry>.003;
      grainMat.opacity=alpha*dry*.82;grains.visible=dry>.003;
      rimMat.opacity=shell*mix(.65,.2,dry);rims.visible=shell>.003;
      group.userData.phase=dry>.95?'dry cake':form>.95?'frozen chamber':f>.8?'frozen crystals':'suspended snow';
      group.userData.state={freeze:f,form,dry,merge:p.merge||0,alpha,particles:data.length};
      last={...p,visible:true};
      global.__cinemaFreeze={...group.userData.state,phase:group.userData.phase,meshCount:8,crystalCount:flakeIndices.length,threeD:true};
    }
    function hide(){if(group)group.visible=false;if(global.R3&&global.R3.post&&(global.R3.post.target===group||global.R3.post.target===cake))global.R3.post.target=null;}
    function dispose(){if(disposed)return;hide();disposed=true;if(group){group.removeFromParent();const geos=new Set(),mats=new Set();group.traverse(n=>{if(n.geometry)geos.add(n.geometry);if(n.material)(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>mats.add(m));});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}instances.delete(api);}
    const api={draw,hide,dispose,group:null,cloud:null,cake:null,crystals:null,seed,
      get state(){return last;},get particles(){return data.length;},get continuitySeeds(){return data.slice(0,320);}};
    instances.add(api);return api;
  }
  global.FrozenChamberFX={create,hideAll(){instances.forEach(i=>i.hide());},disposeAll(){instances.forEach(i=>i.dispose());},version:'three-dimensional-1'};
})(window);
