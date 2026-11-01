'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const input=path.join(root,'assets/tripmate-journey-original.png');
function png(size){
  const result=spawnSync('ffmpeg',['-y','-loglevel','error','-i',input,'-vf',`scale=${size}:${size}:flags=lanczos`,'-frames:v','1','-f','image2pipe','-vcodec','png','pipe:1'],{maxBuffer:16*1024*1024,windowsHide:true});
  if(result.status!==0||!result.stdout?.length)throw new Error(result.stderr?.toString()||'Icon conversion failed');
  return result.stdout;
}
fs.writeFileSync(path.join(root,'assets/icon.png'),png(1024));
const sizes=[16,24,32,48,64,128,256],images=sizes.map(png);
const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
let offset=header.length;
sizes.forEach((size,i)=>{const pos=6+16*i;header[pos]=size===256?0:size;header[pos+1]=header[pos];header.writeUInt16LE(1,pos+4);header.writeUInt16LE(32,pos+6);header.writeUInt32LE(images[i].length,pos+8);header.writeUInt32LE(offset,pos+12);offset+=images[i].length;});
fs.writeFileSync(path.join(root,'assets/icon.ico'),Buffer.concat([header,...images]));
fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
for(const size of [32,48,256])fs.writeFileSync(path.join(root,`test-results/icon-${size}.png`),images[sizes.indexOf(size)]);
console.log('Prepared 1024px PNG and 7-frame ICO: '+sizes.join(', '));
