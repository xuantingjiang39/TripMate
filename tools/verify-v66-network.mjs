// Deterministic network and body deadlines with synthetic data; no remote requests.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../guest-v66/tripmate-network.js',import.meta.url),'utf8');
function setup(fetcher,offline=false){
 const timers=new Map();let counter=0,calls=0;
 const context={URL,AbortController,Error,navigator:{onLine:!offline},location:{origin:'https://tripmate-3x7.pages.dev',href:'https://tripmate-3x7.pages.dev/'},document:{readyState:'loading',addEventListener:()=>{}},setTimeout:(fn,ms)=>{timers.set(++counter,{fn,ms});return counter;},clearTimeout:id=>timers.delete(id)};
 context.window={fetch:(...args)=>{calls++;return fetcher(...args);},TripMateUnified:{international:true,primary:'https://111.230.133.155'}};
 vm.runInNewContext(source,context);
 return{api:context.window.TripMateNetwork,window:context.window,timers,calls:()=>calls};
}
const aborted=(url,{signal})=>new Promise((resolve,reject)=>{if(signal.aborted)reject(signal.reason);else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});
{
 const x=setup(aborted),pending=x.api.json('/api/auth/login',{method:'POST'}).catch(e=>e);
 assert.equal([...x.timers.values()][0].ms,12000);[...x.timers.values()][0].fn();
 assert.equal((await pending).code,'REQUEST_TIMEOUT');assert.equal(x.calls(),1);assert.equal(x.timers.size,0);
}
{
 const x=setup(async(url,{signal})=>({status:200,ok:true,json:()=>aborted(url,{signal})}));
 const pending=x.api.json('/api/auth/login',{method:'POST'}).catch(e=>e);await Promise.resolve();[...x.timers.values()][0].fn();
 assert.equal((await pending).code,'REQUEST_TIMEOUT','Deadline also covers a stalled body');assert.equal(x.timers.size,0);
}
{
 const controller=new AbortController(),x=setup(aborted),pending=x.api.json('/api/account/state',{signal:controller.signal}).catch(e=>e);
 assert.equal([...x.timers.values()][0].ms,30000);const reason=Error('synthetic user cancellation');controller.abort(reason);assert.equal(await pending,reason);assert.equal(x.timers.size,0);
}
{
 let seen;const x=setup(async(url,options)=>{seen={url,options};return{status:200,ok:true,json:async()=>({ok:true,service:'TripMate',version:'v64-session-races'})};});
 x.window.fetch=()=>{throw Error('Authenticated fetch must not be used by diagnosis');};
 const result=await x.api.diagnose();assert.equal(result.code,'CONNECTED');assert.equal(result.version,'v64-session-races');
 assert.equal(seen.url,'https://111.230.133.155/api/health');assert.equal(seen.options.credentials,'omit');assert(!seen.options.headers);assert.equal(seen.options.referrerPolicy,'no-referrer');assert.equal(x.timers.size,0);
}
for(const [data,code] of [[{ok:true,service:'TripMate',version:'v60-regional-sync'},'UPGRADE_REQUIRED'],[{ok:true,service:'TripMate frontend',version:'v66-connection-recovery'},'UNEXPECTED_SERVICE'],[{ok:true,service:'TripMate',version:'<script>synthetic</script>'},'UNEXPECTED_SERVICE']]){
 const x=setup(async()=>({status:200,ok:true,json:async()=>data}));assert.equal((await x.api.diagnose()).code,code);
}
{
 const x=setup(async()=>({status:503,ok:false,json:async()=>({error:'synthetic outage'})}));assert.equal((await x.api.diagnose()).code,'HTTP_ERROR');
}
{
 const x=setup(async()=>{throw TypeError('synthetic browser network failure');});const result=await x.api.diagnose();assert.equal(result.code,'NETWORK_UNREACHABLE');assert(!result.message.includes('升级'),'Cannot infer server upgrade from a failed fetch');assert.equal(x.calls(),1);
}
{
 const x=setup(()=>{throw Error('Must not fetch while offline');},true);assert.equal((await x.api.diagnose()).code,'OFFLINE');assert.equal(x.calls(),0);assert.equal(x.timers.size,0);
}
{
 const x=setup(async()=>({status:200,ok:true,json:async()=>{throw SyntaxError('synthetic malformed JSON');}}));assert.equal((await x.api.json('/api/credits').catch(e=>e)).code,'INVALID_RESPONSE');
}
console.log('PASS 11 connection cases: header/body deadlines, single submission, caller cancellation, anonymous primary health, compatible/old/unexpected service, HTTP/network/offline/malformed response and timer cleanup.');
