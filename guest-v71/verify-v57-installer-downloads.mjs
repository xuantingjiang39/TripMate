import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, open, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createServer as createProbe } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installers, serveInstaller } from './tripmate-downloads.mjs';

const data = await mkdtemp(join(tmpdir(), 'tripmate-direct-downloads-'));
const probe = createProbe();
await new Promise(r=>probe.listen(0,'127.0.0.1',r));
const port=probe.address().port;
await new Promise(r=>probe.close(r));
const base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,[fileURLToPath(new URL('./tripmate-ai-server.mjs',import.meta.url))],{
  env:{...process.env,PORT:String(port),TRIPMATE_DATA_DIR:data},windowsHide:true,stdio:['ignore','pipe','pipe']
});
let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk;});
try {
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Startup timeout')),10000);
    child.once('error',reject);
    child.once('exit',()=>{clearTimeout(timer);reject(Error('Unexpected server exit'));});
    child.stdout.once('data',()=>{clearTimeout(timer);resolve();});
  });
  for(const [name,entry] of installers){
    console.log('Checking installer:', name);
    const url=base+'/downloads/'+name;
    const head=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(10000)});
    assert.equal(head.status,200);assert.equal(await head.text(),'');
    assert.equal(Number(head.headers.get('content-length')),entry.size);
    assert.equal(head.headers.get('content-type'),entry.type);
    assert.equal(head.headers.get('accept-ranges'),'bytes');
    assert.match(head.headers.get('content-disposition'),/^attachment;/);
    assert.equal(head.headers.get('set-cookie'),null);
    assert.equal(head.headers.get('location'),null,'Downloads must not redirect to GitHub');
    const etag=head.headers.get('etag');
    const file=await open(new URL('./downloads/'+name,import.meta.url),'r');
    try{
      for(const range of ['bytes=0-31','bytes=100-131',`bytes=${entry.size-32}-`,'bytes=-32']){
        const response=await fetch(url,{headers:{range,'if-range':etag}});
        assert.equal(response.status,206);
        const body=Buffer.from(await response.arrayBuffer());
        assert.equal(body.length,32);
        const start=range==='bytes=-32'?entry.size-32:Number(range.match(/^bytes=(\d+)/)[1]);
        const expected=Buffer.alloc(32);await file.read(expected,0,32,start);
        assert.deepEqual(body,expected);
        assert.equal(response.headers.get('content-range'),`bytes ${start}-${start+31}/${entry.size}`);
      }
      const headRange=await fetch(url,{method:'HEAD',headers:{range:'bytes=5-12'}});
      assert.equal(headRange.status,206);assert.equal(headRange.headers.get('content-length'),'8');
      for(const range of [`bytes=${entry.size}-`,'bytes=10-2','bytes=-0']){
        const response=await fetch(url,{headers:{range}});
        assert.equal(response.status,416);
        assert.equal(response.headers.get('content-range'),`bytes */${entry.size}`);
      }
      const changed=await fetch(url,{method:'HEAD',headers:{range:'bytes=0-5','if-range':'"old-file"'}});
      assert.equal(changed.status,200);assert.equal(Number(changed.headers.get('content-length')),entry.size);
      const full=await fetch(url);
      console.log('Checking full file integrity:', name);
      assert.equal(full.status,200);
      let length=0;const hash=createHash('sha256');
      for await(const bytes of full.body){length+=bytes.length;hash.update(bytes);}
      assert.equal(length,entry.size);assert.equal(hash.digest('hex'),entry.sha256);
      const interrupted=await fetch(url);const reader=interrupted.body.getReader();
      await reader.read();await reader.cancel();
      console.log('Checking cancelled-download recovery:', name);
      assert.equal((await fetch(base+'/api/health')).status,200);
      assert.equal((await fetch(url,{method:'POST'})).status,405);
    }finally{await file.close();}
  }
  for(const name of ['accounts.json','config.json','../downloads-SHA256SUMS.txt','%2e%2e%2faccounts.json']){
    assert.equal((await fetch(base+'/downloads/'+name)).status,404);
  }
  assert.equal((await fetch(base+'/api/account/export')).status,401);
  assert.deepEqual(await readdir(data),[],'Downloading installers must not write account data');
  assert.equal(child.exitCode,null);assert.equal(stderr,'');
  const missingServer=createServer((req,res)=>{serveInstaller(req,res,new URL(req.url,'http://localhost').pathname,data).catch(()=>res.destroy());});
  console.log('Checking missing and incomplete installer handling');
  await new Promise(r=>missingServer.listen(0,'127.0.0.1',r));
  try{
    const name=[...installers.keys()][0];const url=`http://127.0.0.1:${missingServer.address().port}/downloads/${name}`;
    assert.equal((await fetch(url)).status,503);
    await writeFile(join(data,name),'incomplete');
    assert.equal((await fetch(url,{method:'HEAD'})).status,503);
  }finally{missingServer.closeAllConnections();await new Promise(r=>missingServer.close(r));}
  console.log('PASS v57: real APK/EXE full SHA-256, HEAD, resume ranges/suffix/If-Range, cancelled downloads, whitelist, auth isolation, missing/partial upload rejection. No paid APIs.');
}finally{child.kill();}
