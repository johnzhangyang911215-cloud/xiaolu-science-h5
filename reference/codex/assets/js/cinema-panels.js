/* Physical research panels, page block and blue edge in the shared world. */
(function(){
const C=window.CinePanels={ready:false};
const clamp=x=>Math.max(0,Math.min(1,x));
function panel(image,thick,fig){
 const g=new THREE.Group(),tex=new THREE.Texture(image);tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;tex.anisotropy=4;
 const front=new THREE.MeshStandardMaterial({map:tex,color:fig?0xd1e0e7:0xc9d2dc,roughness:.48,metalness:.04,emissiveMap:tex,emissive:0xffffff,emissiveIntensity:fig?.44:.22,transparent:true,alphaTest:fig?.02:0,opacity:0,depthWrite:true,side:THREE.DoubleSide});
 const edge=fig?null:new THREE.MeshStandardMaterial({color:0x3f5b7c,roughness:.52,metalness:.22,transparent:true,opacity:0});
 const body=fig?null:new THREE.Mesh(new THREE.BoxGeometry(1,1,thick),edge);
 const face=new THREE.Mesh(new THREE.PlaneGeometry(1,1),front);face.position.z=thick/2+.001;
 const back=fig?null:new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({color:0x14181c,roughness:.6,metalness:.15,side:THREE.DoubleSide,transparent:true,opacity:0}));if(back)back.position.z=-thick/2;
 const trim=fig?null:new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry),new THREE.LineBasicMaterial({color:0x6ecdff,transparent:true,opacity:0}));
 // The transparent phylogeny floats alone; only the Science magazine has physical backing and edges.
 if(fig)g.add(face);else g.add(body,face,back,trim);R3.scene.add(g);g.visible=false;
 return {g,body,face,front,edge,back,trim,thick};
}
C.init=()=>{
 C.cover=panel(document.querySelector('#cover img'),.025,false);
 C.fig=panel(document.querySelector('#fig img'),.008,true);
 C.products=['amp-wrap','box-wrap'].map((id,i)=>{
  const el=document.getElementById(id),img=el.querySelector('img'),tex=new THREE.Texture(img);tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;tex.anisotropy=8;
  const mat=new THREE.MeshPhysicalMaterial({map:tex,color:i?0x86929e:0xcbd0d2,roughness:i?.66:.38,metalness:i?.08:.12,emissiveMap:tex,emissive:0xffffff,emissiveIntensity:i?.32:.38,transparent:true,alphaTest:.02,depthWrite:true,side:THREE.DoubleSide});
  if(i)mat.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat grey=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(vec3(grey),diffuseColor.rgb,.52);');};
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat);mesh.visible=false;R3.scene.add(mesh);return {el,mesh,mat};
 });
 const style=document.createElement('style');style.textContent='#cover,#fig,#amp-wrap img,#box-wrap img{visibility:hidden!important}';document.head.appendChild(style);
 C.ready=true;
};
C.update=({cam,cover,fig,rotation,scene,t})=>{
 if(!C.ready)return;
 for(const [p,o,r,id] of [[C.cover,cover,rotation.cov,'cover'],[C.fig,fig,rotation.fig,'fig']]){
  const alpha=(scene===4||scene===5)?clamp(Number(document.getElementById(id).style.opacity||0)):0;
  p.g.visible=alpha>.001;if(!p.g.visible)continue;
  const xyz=PX.toWorld(o.cx,o.cy,cam,0);
  p.g.position.set(xyz[0],xyz[1],-xyz[2]);p.g.scale.set(o.w,o.h,o.h);
  p.g.rotation.set(-(r.rx||0)*Math.PI/180,-r.ry*Math.PI/180,Math.sin(t*.13)*.002);
  p.front.opacity=alpha;if(p.edge)p.edge.opacity=alpha;if(p.back)p.back.material.opacity=alpha;if(p.trim)p.trim.material.opacity=alpha*.48;
 }
 if(R3.post&&scene===4)R3.post.target=C.cover.g;
 else if(R3.post&&R3.post.target===C.cover.g)R3.post.target=null;
 for(const p of C.products){
  const alpha=scene===6?clamp(Number(p.el.style.opacity||0)):0;
  p.mesh.visible=alpha>.002;if(!p.mesh.visible)continue;
  const w=parseFloat(p.el.style.width)||p.el.offsetWidth,h=parseFloat(p.el.style.height)||p.el.offsetHeight;
  const sx=Number(gsap.getProperty(p.el,'scaleX'))||1,sy=Number(gsap.getProperty(p.el,'scaleY'))||1;
  const x=parseFloat(p.el.style.left)+w/2+(Number(gsap.getProperty(p.el,'x'))||0),y=parseFloat(p.el.style.top)+h/2+(Number(gsap.getProperty(p.el,'y'))||0);
  const xyz=PX.toWorld(x,y,{x:7800,y:300,z:-1000},0);
  p.mesh.position.set(xyz[0],xyz[1],-xyz[2]);p.mesh.scale.set(w*sx,h*sy,1);p.mat.opacity=alpha;
 }
 if(R3.post&&scene===6&&C.products[0].mesh.visible)R3.post.target=C.products[0].mesh;
 else if(R3.post&&C.products.some(p=>p.mesh===R3.post.target))R3.post.target=null;
};
})();
