/* Shared world, separate portrait framing and reading composition. */
(function(){
const portrait=document.documentElement.dataset.layout==='portrait';
const L=window.CineLayout={portrait,frame:{cx:960,cy:540,s:1,py:540}};
const configs=[
 {cx:1260,cy:540,s:.90,py:1110},
 {cx:1260,cy:540,s:.90,py:1080},
 {cx:960,cy:470,s:1.04,py:1080},
 {cx:1130,cy:490,s:.77,py:1060},
 {cx:1360,cy:545,s:.85,py:1110},
 {cx:1235,cy:570,s:1.04,py:1130},
 {cx:960,cy:540,s:1,py:990}
];
L.init=()=>{
 if(!portrait)return;
 const aw=document.querySelector('#amp-wrap'),bw=document.querySelector('#box-wrap');
 const product=document.createElement('div');product.id='product-space';
 aw.parentNode.insertBefore(product,aw);product.append(aw,bw);
 R3.setViewport?.(1080,1920);
 if(R3.post&&R3.post.setViewport)R3.post.setViewport(1080,1920);
};
L.map=(x,y)=>{const q=L.frame;return [540+(x-q.cx)*q.s,q.py+(y-q.cy)*q.s];};
L.unmap=(x,y)=>{const q=L.frame;return [(x-540)/q.s+q.cx,(y-q.py)/q.s+q.cy];};
L.update=(scene,t,cam)=>{
 if(!portrait)return;
 const q=configs[Math.max(0,scene)]||configs[0];
 if(L.lastScene!==scene){L.from={...L.frame};L.lastScene=scene;}
 const x=Math.max(0,Math.min(1,t/2.2)),e=x*x*(3-2*x);
 for(const k of ['cx','cy','s','py'])L.frame[k]=L.from[k]+(q[k]-L.from[k])*e;
 const f=L.frame,tx=540-f.cx*f.s,ty=f.py-f.cy*f.s;
 R3.viewOffset={fullWidth:1920,fullHeight:1080,offsetX:f.cx-540/f.s,offsetY:f.cy-f.py/f.s,width:1080/f.s,height:1920/f.s};
 for(const id of ['gl','fx','s2','s3','product-space']){
  const el=document.getElementById(id);if(el)el.style.transform='translate('+tx+'px,'+ty+'px) scale('+f.s+')';
 }
 L.lastTime=t;
};
})();
