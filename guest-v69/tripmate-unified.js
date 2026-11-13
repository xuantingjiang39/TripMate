(() => {
  'use strict';
  const globalOrigin='https://tripmate-3x7.pages.dev';
  const primary='https://111.230.133.155';
  const international=[globalOrigin,'https://tripmate.xuantingjiang39.chatgpt.site','https://tripmate-travel-planner.xuantingjiang39.chatgpt.site'].includes(location.origin);
  window.TripMateUnified={international,primary};
  if(!international)return;
  // Same account API at both entry points. Private tokens stay in this tab, never URLs/localStorage.
  const originalFetch=window.fetch.bind(window),accountKey='tripmate.unified.session',guestKey='tripmate.unified.guest';
  const read=key=>{try{return sessionStorage.getItem(key)||'';}catch{return '';}};
  const save=(key,value)=>{try{if(value)sessionStorage.setItem(key,value);else sessionStorage.removeItem(key);}catch{}};
  let token=read(accountKey),guestToken=read(guestKey),epoch=0;
  const changed=()=>Object.assign(new Error('登录状态已变化，请重试当前操作。'),{name:'AbortError',code:'AUTH_CONTEXT_CHANGED'});
  window.fetch=async(input,options={})=>{
    const source=new URL(typeof input==='string'?input:input.url,location.href);
    if(source.origin!==location.origin||!source.pathname.startsWith('/api/'))return originalFetch(input,options);
    const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
    const headers=new Headers(input instanceof Request?input.headers:undefined);
    new Headers(options.headers||{}).forEach((value,key)=>headers.set(key,value));
    headers.set('x-tripmate-client','native');headers.set('x-tripmate-platform','web');headers.set('x-tripmate-device','international-web');
    if(token)headers.set('authorization','Bearer '+token);if(guestToken)headers.set('x-tripmate-guest-token',guestToken);
    // Capture the old bearer in headers for revocation, then invalidate this tab immediately.
    if(source.pathname==='/api/auth/logout'&&method==='POST'){epoch++;token='';guestToken='';save(accountKey,'');save(guestKey,'');}
    const start=epoch,target=primary+source.pathname+source.search;
    let response;try{response=await originalFetch(target,{...options,method,headers,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',...(input instanceof Request&&!['GET','HEAD'].includes(method)&&options.body===undefined?{body:await input.clone().text()}:{})});}
    catch{throw Error('浏览器暂时无法连接统一服务。请使用“检查连接”排查网络、证书或跨域配置，本机记录保留。');}
    if(start!==epoch)throw changed();
    if(source.pathname.startsWith('/api/auth/')){
      let data={};try{data=await response.clone().json();}catch{}
      if(start!==epoch)throw changed();
      if(response.ok&&typeof data.token==='string'){
        if(source.pathname==='/api/auth/guest'){guestToken=data.token;save(guestKey,guestToken);}
        else if(data.user){token=data.token;save(accountKey,token);guestToken='';save(guestKey,'');epoch++;}
      }
      if(source.pathname==='/api/auth/me'&&response.status===401&&start===epoch){token='';save(accountKey,'');epoch++;}
      if(source.pathname==='/api/auth/guest'&&response.status===401&&start===epoch){guestToken='';save(guestKey,'');}
    }
    return response;
  };
})();
