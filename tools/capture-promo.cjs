'use strict';
// Capture the real desktop UI using example data in an isolated profile, without paid AI or real accounts.
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs/promises');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const desktop=path.join(root,'TripMate-desktop-v54');
const {_electron:electron}=require(path.join(desktop,'node_modules/playwright-core'));
const env={...process.env,TRIPMATE_DESKTOP_TEST:'1',TRIPMATE_TEST_PROFILE:path.join(os.tmpdir(),`tripmate-promo-${Date.now()}`)};
delete env.ELECTRON_RUN_AS_NODE;
async function main(){
 const application=await electron.launch({executablePath:require(path.join(desktop,'node_modules/electron')),args:[desktop],env});
 try{
  await application.firstWindow();
  await application.evaluate(async()=>{while(!globalThis.__tripmateTest)await new Promise(r=>setTimeout(r,20));});
  const html=await fs.readFile(path.join(desktop,'tests/fixtures/workspace.html'),'utf8');
  await application.context().route('https://111.230.133.155/**',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
   if(url.pathname==='/api/auth/guest'&&request.method()==='POST')return route.fulfill({json:{previewRemaining:1}});
   if(url.pathname==='/api/credits/estimate')return route.fulfill({json:{guest:true,enough:true,cost:3}});
   return route.fulfill({status:401,json:{error:'Example preview'}});
  });
  await application.evaluate(async()=>{globalThis.__tripmateTest.win.setContentSize(1280,840);await globalThis.__tripmateTest.connect();});
  const page=application.context().pages().find(p=>p.url().startsWith('https://111.230.133.155'));
  if(!page)throw Error('Workspace missing');
  await page.locator('#continue-as-guest').click();
  await page.waitForFunction(()=>document.querySelector('#auth-gate').hidden);
  await page.locator('#days .day').first().waitFor();
  await page.screenshot({path:path.join(root,'docs/media/workspace-example.png')});
  await page.addStyleTag({content:'html,body,*{scroll-behavior:auto!important;animation:none!important;transition:none!important}'});
  await page.locator('#days').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('#days').getBoundingClientRect().top<innerHeight-100);
  await page.screenshot({path:path.join(root,'docs/media/itinerary-example.png')});
 }finally{await application.close();}
 const concat=path.join(os.tmpdir(),`tripmate-preview-${Date.now()}.txt`);
 await fs.writeFile(concat,["file '"+path.join(root,'docs/media/workspace-example.png').replaceAll('\\','/')+"'",'duration 4',"file '"+path.join(root,'docs/media/itinerary-example.png').replaceAll('\\','/')+"'",'duration 4',"file '"+path.join(root,'docs/media/itinerary-example.png').replaceAll('\\','/')+"'"].join('\n'));
 const result=spawnSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',concat,'-vf','fps=4,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=bayer','-loop','0',path.join(root,'docs/media/interface-preview.gif')],{windowsHide:true,maxBuffer:1024*1024});
 if(result.status!==0)throw Error(result.stderr?.toString()||'GIF conversion failed');
 console.log('Captured example workspace, example itinerary and interface slideshow. No real account or paid AI used.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
