/* Offline model loader: GLBs are shipped as base64 chunks in classic <script> files so file:// works. */
(function(){
  window.__GLB = {};
  window.__GLBP = function(n,k,N,s){ (__GLB[n]=__GLB[n]||[])[k]=s; };
  function load(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('load '+src)); document.head.appendChild(s); }); }
  window.loadModels = async function(onProgress){
    const man = window.__GLB_MANIFEST || []; let tot=0, done=0;
    man.forEach(m=>m.files.forEach(f=>tot+=f[1]));
    for(const m of man){ for(const f of m.files){ await load('assets/models/'+f[0]); done+=f[1]; onProgress && onProgress(done/tot); } }
    const out={};
    for(const m of man){ const s=atob(__GLB[m.name].join('')); const u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); out[m.name]=u.buffer; delete __GLB[m.name]; }
    return out;
  };
})();
