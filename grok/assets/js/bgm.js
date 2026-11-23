/* background music: starts on the first interaction (1.5 s fade-in), M toggles mute, Home restarts,
   fades out over 4 s when the story ends. Silent and inert in ?capture=1. Works over file:// (plain <audio>). */
(function(){
  const Q=new URLSearchParams(location.search); if(Q.get('capture')==='1') return;
  const AUTO=Q.get('auto')==='1';
  const au=document.getElementById('bgm'), btn=document.getElementById('snd'); if(!au) return;
  const BASE=.8, CLOSE=.55;
  let started=false, muted=false, ended=false, vol=0, fadeT=null;
  au.volume=0; au.loop=true;
  function fade(to,ms,done){ clearInterval(fadeT); const from=vol, t0=performance.now();
    fadeT=setInterval(()=>{ const k=Math.min(1,(performance.now()-t0)/Math.max(1,ms)); vol=from+(to-from)*(k*k*(3-2*k)); au.volume=Math.max(0,Math.min(1,vol));
      if(k>=1){ clearInterval(fadeT); fadeT=null; if(done) done(); } },40); }
  function target(){ const s=window.__scene?window.__scene():null; return (s&&s.i===6&&s.t>=15.5)? CLOSE : BASE; }
  function start(){ if(muted||ended) return; const p=au.play(); if(p&&p.then) p.then(()=>{ started=true; fade(target(),1500); }).catch(()=>{}); else { started=true; fade(target(),1500); } }
  function first(e){ if(started) return; if(e && (e.key==='m'||e.key==='M')) return; if(e && btn && btn.contains(e.target)) return; start(); }
  ['pointerdown','keydown','touchstart'].forEach(ev=>addEventListener(ev,first,{capture:true,passive:true}));
  function setMuted(m){ muted=m; btn&&btn.classList.toggle('off',m); btn&&btn.setAttribute('aria-pressed',String(!m));
    if(m){ fade(0,400,()=>au.pause()); } else { if(ended) return; const p=au.play(); if(p&&p.then) p.then(()=>{ started=true; fade(target(),800); }).catch(()=>{}); } }
  addEventListener('keydown',e=>{
    if(e.key==='m'||e.key==='M'){ setMuted(!muted); }
    else if(e.key==='Home'){ ended=false; clearInterval(fadeT); au.pause(); au.currentTime=0; vol=0; au.volume=0; if(!muted) start(); } });
  if(btn){ btn.addEventListener('click',e=>{ e.stopPropagation(); if(!started&&!muted){ start(); return; } setMuted(!muted); });
    btn.addEventListener('pointerdown',e=>e.stopPropagation()); }
  // closing scene: a little quieter; story end: 4 s fade-out, then stop. Going back revives it.
  let lastT=null;
  setInterval(()=>{ if(!started||muted||!window.__scene) return; const s=window.__scene();
    const atEnd = s.i===6 && s.d>0 && s.t>=s.d-.05;
    if(atEnd && !ended){ ended=true; fade(0,4000,()=>au.pause()); return; }
    if(ended && !atEnd && s.i<6){ ended=false; const p=au.play(); if(p&&p.catch) p.catch(()=>{}); fade(BASE,1500); return; }
    if(!ended && !fadeT){ const tg=target(); if(Math.abs(tg-vol)>.01) fade(tg,2500); } },250);
  if(AUTO) start();   // may be blocked by the autoplay policy; the first interaction then starts it
  window.__bgm={el:au, state:()=>({started,muted,ended,vol:au.volume,t:au.currentTime,paused:au.paused})};
})();
