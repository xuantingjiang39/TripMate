import {readFile,writeFile,mkdir} from 'node:fs/promises';
const source=new URL('../guest-v69/',import.meta.url),dist=new URL('./dist/',import.meta.url);
const names={'tripmate-state-schema.js':'tripmate-state-schema.js','tripmate-sync-journal.js':'tripmate-sync-journal.js','tripmate-network.js':'tripmate-network.js','index.html':'tripmate-mvp.html','download.html':'tripmate-download.html','tripmate-regions.js':'tripmate-regions.js','tripmate-unified.js':'tripmate-unified.js','unified-info.html':'tripmate-unified-info.html','tripmate-unified-info.js':'tripmate-unified-info.js','tripmate-icon.png':'tripmate-icon.png'};
const assets={};await mkdir(dist,{recursive:true});
for(const [name,file] of Object.entries(names)){
  const data=await readFile(new URL(file,source));
  assets[name]={data:data.toString('base64'),type:name.endsWith('.png')?'image/png':name.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8'};
  // Actual public assets are included as well as the advanced-mode worker.
  await writeFile(new URL(name,dist),data);
}
const template=await readFile(new URL('./worker.mjs',import.meta.url),'utf8');
await writeFile(new URL('_worker.js',dist),template.replace('__ASSETS__',JSON.stringify(assets)));
console.log('Built Pages public frontend; no credentials, accounts or database bindings.');
