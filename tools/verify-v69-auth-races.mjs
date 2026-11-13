// Deterministic delayed responses only: no network, credentials or real accounts.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../'+(process.argv[2]||'guest-v69')+'/tripmate-unified.js',import.meta.url),'utf8');
function setup(){
 const store=new Map([['tripmate.unified.session','synthetic-old-session']]),pending=[];
 const sandbox={location:{origin:'https://tripmate-3x7.pages.dev',href:'https://tripmate-3x7.pages.dev/'},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},URL,Headers,Request,Response,Error};
 sandbox.window={fetch:(url,options)=>new Promise((resolve,reject)=>pending.push({url,options,resolve,reject}))};
 vm.runInNewContext(source,sandbox);return{store,pending,fetch:sandbox.window.fetch};
}
const reply=(call,body,status=200)=>call.resolve(new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}}));
const auth=path=>['/api/auth/'+path,{method:'POST'}];
{
 const x=setup(),logout=x.fetch(...auth('logout')),login=x.fetch(...auth('login'));
 reply(x.pending[1],{user:{id:'new'},token:'synthetic-new-session'});await login;
 reply(x.pending[0],{ok:true});await logout.catch(()=>{});
 assert.equal(x.store.get('tripmate.unified.session'),'synthetic-new-session','A late logout must not clear the newer login');
}
{
 const x=setup(),login=x.fetch(...auth('login'));const observed=login.catch(e=>e);
 const logout=x.fetch(...auth('logout'));
 assert.equal(x.store.get('tripmate.unified.session'),undefined,'Logout clears local authorization immediately');
 assert.equal(x.pending[1].options.headers.get('authorization'),'Bearer synthetic-old-session','Server still receives the old token to revoke');
 reply(x.pending[0],{user:{id:'old'},token:'synthetic-stale-session'});
 assert.equal((await observed).code,'AUTH_CONTEXT_CHANGED','A pending login cannot undo a later logout');
 reply(x.pending[1],{ok:true});await logout;
 assert.equal(x.store.get('tripmate.unified.session'),undefined);
}
{
 const x=setup(),oldRead=x.fetch('/api/credits').catch(e=>e),logout=x.fetch(...auth('logout'));
 reply(x.pending[0],{balance:999,transactions:[{detail:'synthetic previous account'}]});
 assert.equal((await oldRead).code,'AUTH_CONTEXT_CHANGED','Private old-account data is not returned after logout');
 reply(x.pending[1],{ok:true});await logout;
}
{
 const x=setup(),logout=x.fetch(...auth('logout'));const failed=logout.catch(e=>e);
 x.pending[0].reject(Error('synthetic offline'));await failed;
 assert.equal(x.store.get('tripmate.unified.session'),undefined,'Offline logout does not retain local bearer');
 assert.equal(x.store.get('tripmate.unified.guest'),undefined);
}
const html=await readFile(new URL('../'+(process.argv[2]||'guest-v69')+'/tripmate-mvp.html',import.meta.url),'utf8');
{
 const start=html.indexOf('async function apiJson('),end=html.indexOf('\n',start);
 let resolveBody;const body=new Promise(r=>resolveBody=r),oldUser={id:'old'},newUser={id:'new'};
 const context=vm.createContext({authCurrentUser:oldUser,authCurrentGuest:null,window:{TripMateNetwork:{json:async()=>({response:{ok:true},data:await body})}},Error});
 vm.runInContext(html.slice(start,end),context);
 const read=context.apiJson('/api/credits').catch(e=>e);
 await Promise.resolve();context.authCurrentUser=newUser;resolveBody({balance:999,transactions:[{detail:'synthetic private'}]});
 assert.equal((await read).code,'AUTH_CONTEXT_CHANGED','Domestic and international consumers reject a body parsed after account switch');
}
{
 const button={},nodes=new Map();let finishLogout;
 const pending=new Promise(r=>finishLogout=r),oldUser={id:'old'},newUser={id:'new'};
 const context=vm.createContext({authCurrentUser:oldUser,authCurrentGuest:null,apiJson:()=>pending,$:key=>{if(key==='#logout-button')return button;if(!nodes.has(key))nodes.set(key,{});return nodes.get(key);},switchAppPage:()=>{},showAuthGate:()=>{},clearRestorePreview:()=>{}});
 const start=html.indexOf("$('#logout-button').onclick="),end=html.indexOf('\n',start);
 vm.runInContext(html.slice(start,end),context);
 const logout=button.onclick();context.authCurrentUser=newUser;finishLogout({ok:true});await logout;
 assert.equal(context.authCurrentUser,newUser,'A late logout handler does not reset the new account UI');
 assert.equal(nodes.size,0,'No old logout UI updates after switching accounts');
}
console.log('PASS auth races: delayed logout/new login, pending login/logout, late private response/body, offline local logout and stale logout UI.');
