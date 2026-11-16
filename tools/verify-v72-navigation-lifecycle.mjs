// Actual navigation functions in a VM. Synthetic coordinates and deferred API only; no real GPS/maps.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=process.argv[2]||'guest-v72',expectBug=process.argv.includes('--expect-bug');
const html=await readFile(new URL(`../${source}/tripmate-mvp.html`,import.meta.url),'utf8');
const begin=html.indexOf('const navigationState='),end=html.indexOf('function renderSavedTrips',begin);
const position={coords:{latitude:0,longitude:0,accuracy:10}};
const guide={currentStep:1,totalStops:2,reachedIndex:-1,nextStop:{name:'LATE-GUIDE'},distance:250,duration:240,navigationUrl:'https://example.invalid/synthetic-navigation',routeModeLabel:'步行',accuracy:10};
const tick=()=>new Promise(r=>setImmediate(r));
function setup(){
 const nodes=new Map(),watches=new Map(),timers=new Map(),requests=[],cleared=[],redirects=[],events=new Map();let watchId=0,timerId=0;
 const $=key=>{if(!nodes.has(key))nodes.set(key,{value:key==='#today-day'?'0':'',hidden:false,disabled:false,innerHTML:'',textContent:''});return nodes.get(key);};
 const context={authCurrentUser:{id:'alpha'},authCurrentGuest:null,currentPlan:{days:[{day:'第1天',city:'测试城',events:[]},{day:'第2天',city:'测试城',events:[]}],transportLegs:[{day:'第1天',from:'起点',to:'第一天终点',time:'10:00',mode:'步行'},{day:'第2天',from:'起点',to:'第二天终点',time:'10:00',mode:'步行'}]},$,safe:v=>String(v??''),AbortController,
  navigator:{userAgent:'Android synthetic',geolocation:{watchPosition:(ok,error)=>{const id=watchId++;watches.set(id,{ok,error});return id;},clearWatch:id=>cleared.push(id)}},
  location:{hostname:'localhost',set href(url){redirects.push(url);}},
  window:{isSecureContext:true,addEventListener:(name,fn)=>events.set(name,fn)},
  setTimeout:fn=>{const id=timerId++;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
  apiJson:(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}))};
 vm.createContext(context);vm.runInContext(html.slice(begin,end),context);
 return{context,$,nodes,watches,timers,requests,cleared,redirects,events,state:()=>vm.runInContext('navigationState',context),
  start:()=>context.startLiveNavigation(),stop:()=>context.stopLiveNavigation(),emit:(id=watchId-1)=>watches.get(id).ok(position),fail:(id=watchId-1)=>watches.get(id).error({code:1}),
  reply:async(index=0,value=guide)=>{requests[index].resolve(value);await tick();},reject:async(index=0)=>{requests[index].reject(Error('stale failure'));await tick();},runTimers:()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
if(expectBug){
 const late=setup();late.start();late.emit();late.stop();await late.reply();assert(late.$('#navigation-result').innerHTML.includes('LATE-GUIDE'));
 const queued=setup();queued.start();queued.stop();queued.emit(0);assert.equal(queued.requests.length,1);
 const launch=setup();launch.start();launch.emit();await launch.reply();launch.stop();launch.runTimers();assert.equal(launch.redirects.length,1);
 console.log('REPRODUCED v71: stopped navigation accepts late guide, queued GPS sends another request, and delayed auto-launch opens maps after stop.');
 process.exit(0);
}
{
 const x=setup();x.start();x.start();assert.equal(x.watches.size,1,'Duplicate start must not add watchers');x.emit();await x.reply();assert(x.$('#navigation-result').innerHTML.includes('LATE-GUIDE'));x.runTimers();assert.equal(x.redirects.length,1,'Current active result may launch maps');
}
for(const outcome of ['reply','reject']){
 const x=setup();x.start();x.emit();assert.equal(x.requests.length,1);x.stop();const message=x.$('#navigation-result').innerHTML;
 assert.equal(x.requests[0].options.signal.aborted,true,'Stop aborts the client request');assert.equal(x.state().lastPosition,null,'Stop erases the live coordinate reference');
 await x[outcome]();assert.equal(x.$('#navigation-result').innerHTML,message);assert.equal(x.state().busy,false);assert.equal(x.$('#stop-live-navigation').disabled,true);
 x.emit(0);x.fail(0);assert.equal(x.requests.length,1,'Queued old GPS callbacks are inert');assert.equal(x.state().lastPosition,null);assert.equal(x.$('#navigation-result').innerHTML,message);
}
{
 const x=setup();x.start();x.emit();await x.reply();x.stop();x.runTimers();assert.equal(x.redirects.length,0,'Stopped map auto-launch is cancelled');
}
{
 const x=setup();x.start();x.emit();await x.reply();const oldTimer=[...x.timers.values()][0];x.stop();x.start();x.emit();await x.reply(1);
 const newer=x.state().launchTimer;oldTimer();assert.equal(x.state().launchTimer,newer,'Old queued timer must not clear a new session timer');assert.equal(x.redirects.length,0);x.runTimers();assert.equal(x.redirects.length,1);
}
{
 const x=setup();x.start();x.emit();x.stop();x.start();x.emit();assert.equal(x.requests.length,2);await x.reply(0);assert.equal(x.state().busy,true,'Old finally cannot release a newer request');assert(!x.$('#navigation-result').innerHTML.includes('LATE-GUIDE'));
 x.fail(0);assert.equal(x.$('#stop-live-navigation').disabled,false,'Old watcher error cannot stop the newer watch');await x.reply(1);assert(x.$('#navigation-result').innerHTML.includes('LATE-GUIDE'));
}
{
 const x=setup();x.start();x.emit();x.$('#today-day').value='1';x.$('#today-day').onchange();await x.reply();assert.equal(x.state().watchId,null);assert(!x.$('#navigation-result').innerHTML.includes('LATE-GUIDE'));x.emit(0);assert.equal(x.requests.length,1);x.start();x.emit();assert.equal(JSON.parse(x.requests[1].options.body).stops[0].name,'第二天终点');
}
for(const change of [x=>x.authCurrentUser={id:'beta'},x=>x.authCurrentGuest={id:'guest'},x=>x.currentPlan.transportLegs[0].to='新行程终点']){
 const x=setup();x.start();x.emit();change(x.context);await x.reply();assert.equal(x.state().watchId,null,'Context changes cancel the watch');assert(!x.$('#navigation-result').innerHTML.includes('LATE-GUIDE'));assert.equal(x.state().lastPosition,null);
}
{
 const x=setup();x.start();x.emit();x.events.get('pagehide')();await x.reply();assert.equal(x.$('#navigation-result').hidden,true);assert.equal(x.state().lastPosition,null);assert.equal(x.redirects.length,0);
}
{
 const x=setup();x.start();x.fail();assert.equal(x.state().watchId,null);assert(x.$('#navigation-result').innerHTML.includes('拒绝'));assert.equal(x.$('#start-live-navigation').disabled,false);x.start();x.emit();assert.equal(x.requests.length,1,'Current permission error permits a fresh start');
}
{
 const x=setup();x.context.navigator.geolocation.watchPosition=()=>{throw Error('synthetic start failure');};x.start();assert.equal(x.state().watchId,null);assert.equal(x.state().lastPosition,null);assert(x.$('#navigation-result').innerHTML.includes('无法启动定位'));assert.equal(x.$('#start-live-navigation').disabled,false);
}
console.log('PASS navigation lifecycle: stop/abort, queued GPS, late success/failure, restart ownership, day/route/account changes, delayed launch, pagehide, permission errors and duplicate start.');
