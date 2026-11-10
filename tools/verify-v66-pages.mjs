import assert from 'node:assert/strict';
import worker from '../TripMate-pages-v66/dist/_worker.js';
const origin='https://tripmate-3x7.pages.dev';
const req=(path,init)=>new Request(origin+path,init);
const realFetch=globalThis.fetch;
let calls=0;
globalThis.fetch=async(url,options)=>{
  calls++;assert(url.startsWith('https://github.com/xuantingjiang39/TripMate/releases/download/'));
  assert.equal(options.headers.get('authorization'),null);assert.equal(options.headers.get('cookie'),null);
  assert.equal(options.headers.get('range'),'bytes=0-3');
  return new Response(options.method==='HEAD'?null:'test',{status:206,headers:{'content-range':'bytes 0-3/100','content-length':'4','accept-ranges':'bytes'}});
};
try{
 for(const name of ['TripMate-v58-android-v1.1.5.apk','TripMate-v54-Windows-1.0.1-Setup.exe']){
  for(const method of ['GET','HEAD']){
   const r=await worker.fetch(req('/downloads/'+name,{method,headers:{range:'bytes=0-3',authorization:'Bearer synthetic-private',cookie:'synthetic=private'}}));
   assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 0-3/100');assert.equal(await r.text(),method==='HEAD'?'':'test');
  }
 }
 assert.equal(calls,4);
 assert.equal((await worker.fetch(req('/downloads/unknown.exe'))).status,404);
 assert.equal((await worker.fetch(req('/downloads/TripMate-v58-android-v1.1.5.apk',{method:'POST'}))).status,405);
 assert.equal(calls,4);
 globalThis.fetch=async()=>{throw Error('synthetic network outage');};
 assert.equal((await worker.fetch(req('/downloads/TripMate-v58-android-v1.1.5.apk'))).status,503);
 const legacy=await worker.fetch(req('/legacy?token=private'));assert.equal(legacy.headers.get('location'),'https://tripmate.xuantingjiang39.chatgpt.site/legacy');
 console.log('PASS Pages routes, fixed installer allowlist, Range/HEAD, stripped credentials, unknown path/method, network failure and safe legacy redirect.');
}finally{globalThis.fetch=realFetch;}
