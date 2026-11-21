import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientAddress } from './tripmate-client-address.mjs';

assert.equal(clientAddress({socket:{remoteAddress:'::ffff:127.0.0.1'},headers:{'x-real-ip':'198.51.100.7','x-forwarded-for':'1.1.1.1'}}),'198.51.100.7');
assert.equal(clientAddress({socket:{remoteAddress:'198.51.100.8'},headers:{'x-real-ip':'203.0.113.5','x-forwarded-for':'1.1.1.1'}}),'198.51.100.8');
assert.equal(clientAddress({socket:{remoteAddress:'127.0.0.1'},headers:{'x-real-ip':'not-an-ip','x-forwarded-for':'1.1.1.1'}}),'127.0.0.1');
assert.equal(clientAddress({socket:{remoteAddress:'::1'},headers:{'x-real-ip':'2001:db8::4'}}),'2001:db8::4');

const dataDirectory=await mkdtemp(join(tmpdir(),'tripmate-v73-client-address-'));
const probe=createServer();
await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
const port=probe.address().port;
await new Promise(resolve=>probe.close(resolve));
const env={
  PATH:process.env.PATH||'',
  SystemRoot:process.env.SystemRoot||'',
  WINDIR:process.env.WINDIR||'',
  TEMP:process.env.TEMP||'',
  TMP:process.env.TMP||'',
  HOME:process.env.HOME||'',
  PORT:String(port),
  TRIPMATE_DATA_DIR:dataDirectory,
  TRIPMATE_GUEST_IP_DAILY_LIMIT:'3'
};
const child=spawn(process.execPath,[fileURLToPath(new URL('./tripmate-ai-server.mjs',import.meta.url))],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let stderr='';
child.stderr.on('data',value=>{stderr+=value.toString();});
function call(path,headers={},body){
  return new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path,method:'POST',headers},res=>{
      let body='';res.setEncoding('utf8');res.on('data',part=>body+=part);res.on('end',()=>resolve({status:res.statusCode,body}));
    });
    req.setTimeout(8000,()=>req.destroy(Error('local request timeout')));req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });
}
try{
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error(`server startup timeout: ${stderr}`)),10000);
    child.once('error',reject);
    child.once('exit',(code)=>{clearTimeout(timer);reject(Error(`server exited during startup (${code}): ${stderr}`));});
    child.stdout.once('data',()=>{clearTimeout(timer);resolve();});
  });
  const statuses=[];
  for(let i=0;i<4;i++){
    const result=await call('/api/auth/guest',{
      'x-real-ip':'198.51.100.42',
      'x-forwarded-for':`203.0.113.${i+1}`
    });
    statuses.push(result.status);
  }
  assert.deepEqual(statuses,[200,200,200,429],'spoofed X-Forwarded-For must not bypass guest IP limit');
  const accounts=JSON.parse(await readFile(join(dataDirectory,'accounts.json'),'utf8'));
  assert.equal(accounts.guests.length,3,'blocked attempt must not create a guest account');
  assert.equal(new Set(accounts.guests.map(item=>item.addressHash)).size,1,'same proxy client address must map to one rate-limit key');
  const loginStatuses=[];
  for(let i=0;i<13;i++){
    const result=await call('/api/auth/login',{
      'content-type':'application/json',
      'x-real-ip':'198.51.100.43',
      'x-forwarded-for':`192.0.2.${i+1}`
    },{email:'missing@example.invalid',password:'synthetic-invalid'});
    loginStatuses.push(result.status);
  }
  assert.deepEqual(loginStatuses,[...Array(12).fill(401),429],'spoofed X-Forwarded-For must not bypass login failure limit');
  console.log('PASS: trusted local proxy, direct-peer and invalid-header fallback, plus live guest and login IP limits');
}finally{
  child.kill();
  await new Promise(resolve=>{if(child.exitCode!==null)resolve();else{child.once('exit',resolve);setTimeout(resolve,3000).unref();}});
  await rm(dataDirectory,{recursive:true,force:true});
}
