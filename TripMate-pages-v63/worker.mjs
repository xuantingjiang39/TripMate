// Public frontend and two fixed installer sources only. No account database or API proxy.
const PRIMARY='https://111.230.133.155';
const LEGACY='https://tripmate.xuantingjiang39.chatgpt.site';
const assets=__ASSETS__;
const sources={
  'TripMate-v58-android-v1.1.5.apk':'https://github.com/xuantingjiang39/TripMate/releases/download/v58/TripMate-v58-android-v1.1.5.apk',
  'TripMate-v54-Windows-1.0.1-Setup.exe':'https://github.com/xuantingjiang39/TripMate/releases/download/v54/TripMate-v54-Windows-1.0.1-Setup.exe'
};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export default {
  async fetch(request){
    const url=new URL(request.url),path=url.pathname,head=request.method==='HEAD';
    if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);
    if(path==='/api/health')return json({ok:true,service:'TripMate frontend',version:'v63-pages-entry',primary:PRIMARY});
    if(path.startsWith('/api/'))return json({error:'请通过工作台连接国内统一服务，国内服务器需升级 v63。',primary:PRIMARY},409);
    // Old data remains on its original authenticated host; no user payload/query is forwarded.
    if(['/legacy','/legacy-records'].includes(path))return new Response(null,{status:302,headers:{location:LEGACY+path,'cache-control':'no-store','referrer-policy':'no-referrer'}});
    if(path.startsWith('/downloads/')){
      const name=path.slice('/downloads/'.length);
      if(!Object.hasOwn(sources,name))return json({error:'Not found'},404);
      const headers=new Headers();
      for(const key of ['range','if-range'])if(request.headers.has(key))headers.set(key,request.headers.get(key));
      try{
        const upstream=await fetch(sources[name],{method:request.method,headers,redirect:'follow'});
        if(![200,206,416].includes(upstream.status))return json({error:'下载暂时不可用，请使用页面中的 GitHub 备用链接。'},503);
        const result=new Headers({'content-type':name.endsWith('.apk')?'application/vnd.android.package-archive':'application/octet-stream','content-disposition':`attachment; filename="${name}"`,'x-content-type-options':'nosniff','cache-control':upstream.ok?'public, max-age=86400':'no-store'});
        for(const key of ['content-length','content-range','etag','accept-ranges'])if(upstream.headers.has(key))result.set(key,upstream.headers.get(key));
        return new Response(head?null:upstream.body,{status:upstream.status,headers:result});
      }catch{return json({error:'下载源暂时不可达，请稍后重试或使用备用下载。'},503);}
    }
    const alias={'/':'index.html','/index.html':'index.html','/tripmate-mvp.html':'index.html','/admin/setup':'index.html','/download':'download.html','/download/':'download.html','/download.html':'download.html','/account-link':'unified-info.html'};
    const name=alias[path]||path.slice(1);
    if(!Object.hasOwn(assets,name))return json({error:'Not found'},404);
    const item=assets[name];
    return new Response(head?null:Uint8Array.from(atob(item.data),c=>c.charCodeAt(0)),{headers:{'content-type':item.type,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
  }
};
