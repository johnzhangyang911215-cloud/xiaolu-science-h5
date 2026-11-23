#!/usr/bin/env node
/* Deterministic, offline 30 fps cinema capture. Never alters the source animation. */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {spawn}=require('child_process'),{once}=require('events'),{pathToFileURL}=require('url');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../build');
const args=process.argv.slice(2),layout=args.find(s=>!s.startsWith('--'))||'横版';
const check=args.includes('--check'),samples=args.includes('--samples')||args.includes('--preview');
if(args.includes('--help')){
 console.log('Usage: node export.cjs 横版 [--check | --samples]\n  No flag: full 1080p MP4 preview. --check: offline boot audit only. --samples: complete timeline and lossless stills, no MP4.');process.exit(0);
}
if(!['横版'].includes(layout))throw new Error('Use 横版 or 竖版');
const portrait=layout==='竖版',width=portrait?1080:1920,height=portrait?1920:1080,fps=30;
const ffmpeg=process.env.FFMPEG || 'ffmpeg';
const input=path.join(ROOT,'小鹿精华_聚焦叙事版_'+layout+'.html');
const output=path.join(ROOT,'小鹿精华_聚焦叙事版_'+layout+'_1080p预览.mp4');
const qa=path.join(ROOT,'检查','MP4预览导出',layout),work=path.join(__dirname,'work',layout);
fs.mkdirSync(qa,{recursive:true});fs.mkdirSync(work,{recursive:true});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(!fs.existsSync(input))throw new Error('Run bundle_focus.py first: '+input);
const report={source:input,sourceSha256:hash(input),layout,output,width,height,fps,errors:[],shaderErrors:[],externalRequests:[],failedRequests:[],scenes:[],frames:0,
 subtitleMode:'burned-in',musicSource:path.resolve(__dirname,'../focus/assets/audio/bgm.mp3'),musicPlaybackRate:1,
 uiRemoved:['#snd','#hint','#index','#load'],startedAt:new Date().toISOString(),mode:check?'offline-check':samples?'samples':'mp4'};
let browser,encoder,encoderDone,encoderWarnings='';
function saveReport(name){fs.writeFileSync(path.join(qa,name),JSON.stringify(report,null,2));}
function runFFmpeg(argv){return new Promise((resolve,reject)=>{let err='';const p=spawn(ffmpeg,argv,{stdio:['ignore','ignore','pipe']});p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code?reject(new Error('ffmpeg '+code+': '+err)):resolve(err));});}
function writeFrame(frame){
 if(encoder.exitCode!==null)return Promise.reject(new Error('Frame encoder exited early: '+encoderWarnings));
 if(encoder.stdin.write(frame))return Promise.resolve();
 return new Promise((resolve,reject)=>{const ok=()=>{cleanup();resolve();},bad=e=>{cleanup();reject(e);},cleanup=()=>{encoder.stdin.off('drain',ok);encoder.stdin.off('error',bad);};encoder.stdin.once('drain',ok);encoder.stdin.once('error',bad);});
}
function assertClean(){
 if(report.errors.length||report.shaderErrors.length||report.externalRequests.length||report.failedRequests.length)throw new Error('Offline/browser validation failed; see report');
 if(hash(input)!==report.sourceSha256)throw new Error('Source changed during capture; video was not published');
}
(async()=>{
 try{
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true,
   args:['--use-gl=angle',...(process.platform==='darwin'?['--use-angle=metal']:[]),'--allow-file-access-from-files','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push(e.stack||e.message));
  page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|VALIDATE_STATUS|GL_INVALID/i.test(m.text()))report.shaderErrors.push(m.text());});
  page.on('requestfailed',r=>report.failedRequests.push({url:r.url().slice(0,180),error:r.failure()}));
  await page.route(/^https?:\/\//,route=>{report.externalRequests.push(route.request().url());return route.abort('internetdisconnected');});
  await page.goto(pathToFileURL(input).href+'?capture=1&auto=1',{waitUntil:'load',timeout:60000});
  // RAF is intentionally paused in capture mode, so readiness polling must use a timer.
  await page.waitForFunction(()=>window.__ready,null,{polling:100,timeout:90000});
  await page.evaluate(async()=>{
   await document.fonts.ready;
   await Promise.all([...document.images].map(im=>im.decode()));
   await document.fonts.load('88px CinemaSerif');await document.fonts.load('180px CinemaSans');
  });
  await page.addStyleTag({content:'#snd,#hint,#index,#load{display:none!important}*{cursor:none!important}'});
  report.environment=await page.evaluate(()=>{
   const c=document.querySelector('#three'),gl=c.getContext('webgl2'),debug=gl?.getExtension('WEBGL_debug_renderer_info'),s=document.querySelector('#stage');
   return {threeD:window.__3d,canvas:[c.width,c.height],stage:[s.clientWidth,s.clientHeight],
    gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER),
    uiHidden:['snd','hint','index','load'].every(id=>{const el=document.getElementById(id);return !el||getComputedStyle(el).display==='none';}),
    allImagesDecoded:[...document.images].every(im=>im.complete&&im.naturalWidth>0),
    brandText:document.body.textContent.includes('韶初泌语'),
    threeRevision:window.THREE?.REVISION,postProcessing:!!window.R3?.post};
  });
  if(!report.environment.threeD||!report.environment.uiHidden||!report.environment.allImagesDecoded||!report.environment.brandText||
     report.environment.canvas[0]!==width||report.environment.canvas[1]!==height||/SwiftShader/i.test(report.environment.gpu||''))
   throw new Error('Export viewport/GPU/resource check failed: '+JSON.stringify(report.environment));
  report.timing=await page.evaluate(()=>window.__timing||{});
  console.log(JSON.stringify({mode:report.mode,layout,environment:report.environment}));
  assertClean();
  if(check){report.success=true;report.completedAt=new Date().toISOString();saveReport('offline-check.json');return;}
  const lastScene=Math.max(0,(report.timing.pacing?.length||7)-1),compact=(scene,t)=>(report.timing.pauses?.[scene]||[])
   .reduce((out,[a,b])=>out-Math.max(0,Math.min(t,b)-a)*(1-(report.timing.pauseScale??1)),t);
  const cdp=await page.context().newCDPSession(page);
  const shot=async(format)=>Buffer.from((await cdp.send('Page.captureScreenshot',{
   format,fromSurface:true,captureBeyondViewport:false,optimizeForSpeed:true,...(format==='jpeg'?{quality:100}:{})
  })).data,'base64');
  if(!samples){
   const silent=path.join(work,'silent.mp4');
   encoder=spawn(ffmpeg,['-y','-hide_banner','-loglevel','warning','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','pipe:0','-an',
    '-vf','scale=out_color_matrix=bt709:out_range=tv,format=yuv420p','-c:v','libx264','-preset','medium','-crf','17','-threads','4','-r',String(fps),
    '-fps_mode','cfr','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',silent],{stdio:['pipe','ignore','pipe']});
   encoder.stderr.on('data',d=>encoderWarnings+=d);encoder.stdin.on('error',()=>{});
   encoderDone=new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('close',code=>code?reject(new Error('Frame encoder '+code+': '+encoderWarnings)):resolve());});
   encoderDone.catch(()=>{});
  }
  report.endHoldSeconds=2;report.sampleTimes=[];report.rateChanges=[];report.sampleDefinitions=[];
  const saved=new Set(),defined=new Set(),marks=[];
  function mark(id,scene,target){if(Number.isFinite(target)&&target>=0){const m={id,scene,targetStoryTime:target};marks.push(m);report.sampleDefinitions.push(m);}}
  function sceneMarkers(state){
   if(defined.has(state.i))return;defined.add(state.i);
   for(const q of [.08,.30,.62,.86])mark('scene-'+state.i+'-'+Math.round(q*100),state.i,state.d*q);
   for(const key of ['key','key2'])if(Number.isFinite(state[key])&&state[key]<=state.d)mark('scene-'+state.i+'-'+key,state.i,state[key]);
   if(state.i===5)for(const t of [3.3,5.6,6.7,8.9,10.5,13.7,18,20,24.5,32,35])if(compact(5,t)<=state.d)mark('use-'+String(t).replace('.','p'),5,compact(5,t));
   if(state.i===lastScene)for(const t of [7.7,8.1,8.5,9,9.7,10.2])if(compact(lastScene,t)<=state.d)mark('eff-'+String(t).replace('.','p'),lastScene,compact(lastScene,t));
  }
  await page.evaluate(()=>__go(0));
  let endAt=null,closingAt=null,priorScene=-1,priorRate=null;const start=Date.now(),maxFrames=fps*600;
  for(let frame=0;frame<maxFrames;frame++){
   const state=await page.evaluate(ms=>{__advance(ms);return __scene();},frame===0?0:1000/fps),videoTime=frame/fps;
   if(!Number.isFinite(state.rate)||state.rate<=0||!Number.isFinite(state.d))throw new Error('Invalid timeline state '+JSON.stringify(state));
   if(state.i!==priorScene){report.scenes.push({scene:state.i,startFrame:frame,startSeconds:videoTime,duration:state.d,key:state.key,key2:state.key2});priorScene=state.i;console.log(JSON.stringify({scene:state.i,videoSeconds:videoTime}));}
   sceneMarkers(state);
   if(priorRate===null||Math.abs(state.rate-priorRate)>1e-8){report.rateChanges.push({scene:state.i,rate:state.rate,storyTime:state.t,videoTime,frame});priorRate=state.rate;}
   if(state.i===lastScene&&state.t>=Math.min(compact(lastScene,15.5),state.d*.8)&&closingAt===null)closingAt=videoTime;
   if(state.i===lastScene&&state.t>=state.d-.0001&&endAt===null){endAt=frame+Math.round(fps*report.endHoldSeconds);report.storyEndFrame=frame;report.storyEndTime=videoTime;}
   const due=marks.filter(m=>m.scene===state.i&&!saved.has(m.id)&&state.t+1e-7>=m.targetStoryTime),isLast=endAt!==null&&frame>=endAt;
   if(!samples)await writeFrame(await shot('jpeg'));
   let png;if(due.length||isLast)png=await shot('png');
   for(const m of due){const file=path.join(qa,'sample-'+m.id+'.png');fs.writeFileSync(file,png);saved.add(m.id);report.sampleTimes.push({...m,storyTime:state.t,videoTime,frame,file});}
   report.frames=frame+1;
   if(frame%150===0){const elapsed=(Date.now()-start)/1000,progress={frame:frame+1,videoSeconds:videoTime,elapsedSeconds:+elapsed.toFixed(1),renderFps:+((frame+1)/Math.max(.001,elapsed)).toFixed(1),scene:state.i,rate:state.rate};console.log(JSON.stringify(progress));fs.writeFileSync(path.join(qa,'progress.json'),JSON.stringify(progress));}
   if(isLast){fs.writeFileSync(path.join(qa,'last.png'),png);break;}
  }
  if(endAt===null||report.frames<=endAt)throw new Error('Story did not finish within the capture limit');
  report.missingSamples=marks.filter(m=>!saved.has(m.id));
  if(report.missingSamples.length)throw new Error('Expected timeline sample was not reached: '+JSON.stringify(report.missingSamples));
  if(report.scenes.length!==lastScene+1)throw new Error('Autoplay skipped an expected scene');
  report.duration=report.frames/fps;report.renderSeconds=(Date.now()-start)/1000;report.audioCloseAt=closingAt??report.duration-6;
  assertClean();
  if(!samples){
   encoder.stdin.end();await encoderDone;encoder=null;
   report.encoderWarnings=encoderWarnings;
   const temp=path.join(work,'with-audio.mp4'),closeAt=report.audioCloseAt,ramp=2.5;
   const volume="volume='if(lt(t,"+closeAt+"),0.8,if(lt(t,"+(closeAt+ramp)+"),0.8-0.25*(t-"+closeAt+")/"+ramp+",0.55))':eval=frame";
   // Original-speed music: no atempo, asetrate, playbackRate or time stretching.
   report.audioFadeInSeconds=1.2;report.audioFadeOutSeconds=3.2;
   await runFFmpeg(['-y','-hide_banner','-loglevel','warning','-i',path.join(work,'silent.mp4'),'-stream_loop','-1','-i',report.musicSource,
    '-map','0:v:0','-map','1:a:0','-c:v','copy','-bsf:v','h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1',
    '-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-af',volume+',afade=t=in:st=0:d=1.2,afade=t=out:st='+Math.max(0,report.duration-3.2)+':d=3.2',
    '-c:a','aac','-b:a','256k','-ar','48000','-ac','2','-t',String(report.duration),'-movflags','+faststart',temp]);
   // Decode the finished AV stream before publishing it as the deliverable.
   report.decodeWarnings=await runFFmpeg(['-hide_banner','-v','error','-i',temp,'-f','null','-']);
   if(report.decodeWarnings.trim())throw new Error('Final MP4 decode reported errors: '+report.decodeWarnings);
   assertClean();
   // Copy+rename is atomic even when the work folder and iCloud folder are on different volumes.
   const publishTemp=output+'.tmp';fs.copyFileSync(temp,publishTemp);fs.renameSync(publishTemp,output);
   report.outputBytes=fs.statSync(output).size;report.outputSha256=hash(output);
   fs.unlinkSync(path.join(work,'silent.mp4'));fs.unlinkSync(temp);
  }
  report.success=true;report.completedAt=new Date().toISOString();saveReport(samples?'sample-report.json':'export-report.json');
  console.log(JSON.stringify({success:true,output:samples?qa:output,duration:report.duration,frames:report.frames,sha256:report.outputSha256}));
 }catch(error){if(encoder){encoder.kill('SIGTERM');encoder=null;}report.success=false;report.error=error.stack||String(error);saveReport('export-error.json');throw error;}
 finally{if(browser)await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
