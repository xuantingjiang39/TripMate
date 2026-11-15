(() => {
  'use strict';
  const anonymousFetch=window.fetch.bind(window);
  const failure=(code,message)=>Object.assign(new Error(message),{code,status:0});
  function deadline(path){
    if(path==='/api/health')return 8000;
    if(['/api/auth/send-code','/api/auth/send-reset-code'].includes(path))return 25000;
    if(path.startsWith('/api/auth/'))return 12000;
    if(path.startsWith('/api/account/'))return 30000;
    return 25000;
  }
  async function consume(url,options={},anonymous=false){
    const path=new URL(url,location.href).pathname,ms=deadline(path),controller=new AbortController();
    const parent=options.signal,abort=()=>controller.abort(parent.reason);
    if(parent?.aborted)abort();else parent?.addEventListener('abort',abort,{once:true});
    let expired=false;
    const timer=setTimeout(()=>{expired=true;controller.abort();},ms);
    try{
      if(navigator.onLine===false)throw failure('OFFLINE','当前设备已离线。连接网络后重试，本机记录保留。');
      const response=await (anonymous?anonymousFetch:window.fetch.bind(window))(url,{...options,signal:controller.signal});
      let data={};
      if(response.status!==204){
        try{data=await response.json();}
        catch(error){if(controller.signal.aborted)throw error;throw failure('INVALID_RESPONSE','服务返回了无法识别的内容。请检查连接后重试，本机记录保留。');}
      }
      if(controller.signal.aborted)throw controller.signal.reason||failure('REQUEST_ABORTED','请求已取消。');
      return {response,data};
    }catch(error){
      if(expired)throw failure('REQUEST_TIMEOUT',`请求超时（${ms/1000}秒）。服务可能仍在处理，请先检查连接，避免连续重复提交。`);
      if(error.code||parent?.aborted)throw error;
      throw failure('NETWORK_UNREACHABLE','浏览器暂时无法连接服务。请检查网络、证书或跨域配置，本机记录保留。');
    }finally{clearTimeout(timer);parent?.removeEventListener('abort',abort);}
  }
  async function diagnose(){
    const international=Boolean(window.TripMateUnified?.international);
    const target=(international?window.TripMateUnified.primary:location.origin)+'/api/health';
    try{
      const {response,data}=await consume(target,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'},true);
      if(!response.ok)return {ok:false,code:'HTTP_ERROR',message:`服务返回 HTTP ${response.status}，请稍后重试或联系管理员。`};
      if(data?.ok!==true||data.service!=='TripMate'||!/^v\d+-[a-z0-9-]+$/i.test(data.version||''))return {ok:false,code:'UNEXPECTED_SERVICE',message:'已收到响应，但不是可确认的 TripMate 业务服务。请让管理员检查接口地址。'};
      if(international&&Number(data.version.match(/^v(\d+)/)[1])<63)return {ok:false,code:'UPGRADE_REQUIRED',message:`已连接国内服务 ${data.version}。此版本尚不支持当前国际入口，请升级国内服务器。`};
      return {ok:true,code:'CONNECTED',version:data.version,message:`已连接国内服务 ${data.version}。可以返回登录；若登录仍失败，请把页面错误提供给管理员。`};
    }catch(error){return {ok:false,code:error.code||'NETWORK_UNREACHABLE',message:error.message};}
  }
  window.TripMateNetwork=Object.freeze({json:(url,options)=>consume(url,options),diagnose});
  function mount(){
    const button=document.getElementById('check-connection'),status=document.getElementById('connection-status');
    if(!button||!status)return;
    button.addEventListener('click',async()=>{
      button.disabled=true;button.textContent='正在检查…';status.textContent='正在检查国内统一服务，最多等待 8 秒。';
      try{const result=await diagnose();status.textContent=result.message;status.dataset.state=result.ok?'connected':'failed';}
      finally{button.disabled=false;button.textContent='检查连接';}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
