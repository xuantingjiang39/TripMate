(() => {
  'use strict';
  const globalOrigin='https://tripmate-travel-planner.xuantingjiang39.chatgpt.site';
  const primary='https://111.230.133.155';
  const international=location.origin===globalOrigin;
  window.TripMateUnified={international,primary};
  if(!international)return;
  // Same account API at both entry points. Private tokens stay in this tab, never URLs/localStorage.
  const originalFetch=window.fetch.bind(window),accountKey='tripmate.unified.session',guestKey='tripmate.unified.guest';
  const read=key=>{try{return sessionStorage.getItem(key)||'';}catch{return '';}};
  const save=(key,value)=>{try{if(value)sessionStorage.setItem(key,value);else sessionStorage.removeItem(key);}catch{}};
  let token=read(accountKey),guestToken=read(guestKey),epoch=0;
  window.fetch=async(input,options={})=>{
    const source=new URL(typeof input==='string'?input:input.url,location.href);
    if(source.origin!==location.origin||!source.pathname.startsWith('/api/'))return originalFetch(input,options);
    const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
    const headers=new Headers(input instanceof Request?input.headers:undefined);
    new Headers(options.headers||{}).forEach((value,key)=>headers.set(key,value));
    headers.set('x-tripmate-client','native');headers.set('x-tripmate-platform','web');headers.set('x-tripmate-device','international-web');
    if(token)headers.set('authorization','Bearer '+token);if(guestToken)headers.set('x-tripmate-guest-token',guestToken);
    const start=epoch,target=primary+source.pathname+source.search;
    let response;try{response=await originalFetch(target,{...options,method,headers,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',...(input instanceof Request&&!['GET','HEAD'].includes(method)&&options.body===undefined?{body:await input.clone().text()}:{})});}
    catch{throw Error('统一数据服务暂时无法连接。国内服务器需先升级 v61；网络恢复后重试，本机记录保留。');}
    if(source.pathname.startsWith('/api/auth/')){
      let data={};try{data=await response.clone().json();}catch{}
      if(start===epoch&&response.ok&&typeof data.token==='string'){
        if(source.pathname==='/api/auth/guest'){guestToken=data.token;save(guestKey,guestToken);}
        else if(data.user){token=data.token;save(accountKey,token);guestToken='';save(guestKey,'');epoch++;}
      }
      if(source.pathname==='/api/auth/logout'||(source.pathname==='/api/auth/me'&&response.status===401&&start===epoch)){token='';save(accountKey,'');epoch++;}
      if(source.pathname==='/api/auth/guest'&&response.status===401){guestToken='';save(guestKey,'');}
    }
    return response;
  };
})();
