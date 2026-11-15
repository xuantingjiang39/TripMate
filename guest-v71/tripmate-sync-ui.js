(() => {
  'use strict';
  const $=id=>document.getElementById(id),globalSite=document.documentElement.dataset.tripmateRegion==='overseas';
  let activationId='',account=null,busy=false,localBackupDone=false,localBackupSnapshot='';
  const status=(message,error=false)=>{$('result').textContent=message;$('result').dataset.error=String(error);};
  const rawApi=async(action,body)=>{const r=await fetch('/api/bridge/'+action,{method:body?'POST':'GET',credentials:'same-origin',headers:{'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});let data;try{data=await r.json();}catch{throw Error('服务暂不可用，请确认国内站已安装 v60。');}if(!r.ok)throw Object.assign(Error(data.error||'操作失败，请重试。'),{status:r.status});return data;};
  const direct=async(action,token,body,method=body?'POST':'GET')=>{
    let r;try{r=await fetch('https://111.230.133.155/api/bridge/'+action,{method,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json',...(token?{'x-tripmate-sync-token':token}:{})},...(body?{body:JSON.stringify(body)}:{})});}catch{throw Error('暂时连接不到国内共享服务。本机记录保留，请稍后重试。');}
    let d;try{d=await r.json();}catch{throw Error('国内接口暂不可用，请确认已安装 v60。');}if(!r.ok)throw Object.assign(Error(d.error||'共享操作失败。'),{status:r.status});return d;
  };
  const api=async(action,body)=>{
    if(!globalSite)return rawApi(action,body);
    if(action==='link'){
      const redeemed=await direct('redeem',null,{code:body.code,peerEmail:account.email}),{token,...domestic}=redeemed;
      return rawApi('link',{token,domestic,preferred:body.preferred});
    }
    if(action==='preview'){const a=await rawApi('access');return rawApi('preview',{domestic:await direct('state',a.token),preferred:body.preferred});}
    if(action==='confirm'){
      const a=await rawApi('access'),p=await rawApi('prepare-confirm');if(p.activationId!==body.activationId)throw Error('预览已变化，请重新检查。');
      await direct('activate',a.token,p);return rawApi('confirm',{activationId:p.activationId,activated:true});
    }
    if(action==='disconnect'){
      const a=await rawApi('access');let domestic;
      try{domestic=await direct('state',a.token);}catch(e){if(a.status==='active'||e.status!==401)throw e;}
      const result=await rawApi('disconnect',{domestic});let revoked=true;try{await direct('disconnect',a.token,{});}catch{revoked=false;}return {...result,revoked};
    }
    const result=await rawApi(action,body);
    if(action==='backup')try{const a=await rawApi('access');if(a.status==='active')result.currentShared=await direct('state',a.token);}catch{result.sharedUnavailable=true;}
    return result;
  };
  const run=fn=>async()=>{if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){status(e.message,true);try{await refresh();}catch{}}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);$('copy-code').disabled=!$('connection-code').value;}};
  const saveFile=(data,label)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='TripMate-'+label+'-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const download=async()=>{const data=await api('backup');saveFile(data,'合并备份');$('archive-links').replaceChildren(...(data.archives||[]).map(archive=>{const a=document.createElement('a');a.className='button';a.href='/api/bridge/archive?id='+archive.id;a.download='TripMate-历史备份-'+archive.id+'.json';a.textContent='历史备份 '+archive.created_at;return a;}));status('备份已交给浏览器下载，请妥善保管其中的个人信息。');};
  const preview=data=>{
    activationId=data.activationId;$('preview').hidden=false;$('manage').hidden=false;$('refresh-preview').hidden=false;$('connect').hidden=true;$('paste-code').value='';
    $('peer').textContent='国内账号：'+data.domesticAccount.email+'；国际账号：'+account.email;
    const summary=data.summary,table=document.createElement('table');table.className='counts';
    const rows=[['记录','国内','国际','合并后'],...Object.entries({trips:'行程',orders:'订单',reminders:'提醒',expenses:'费用',packing:'行李'}).map(([key,label])=>[label,summary.before.domestic[key],summary.before.overseas[key],summary.after[key]])];
    rows.forEach((row,index)=>{const tr=table.insertRow();row.forEach(text=>{const c=document.createElement(index?'td':'th');c.textContent=text;tr.append(c);});});$('counts').replaceChildren(table);
    $('merge-details').textContent='去重 '+summary.duplicates+' 项；冲突 '+summary.conflicts+' 项。草稿和偏好选择：'+(summary.preferred==='domestic'?'国内站':'国际站')+'。';
    $('trip-titles').replaceChildren(...data.tripTitles.map(title=>{const li=document.createElement('li');li.textContent=title;return li;}));
    $('confirm-consent').checked=false;status('请检查预览，可先下载备份，再确认合并。');
  };
  const refresh=async()=>{const s=await api('status');$('manage').hidden=s.status==='none';$('connection-state').textContent=s.status==='active'?'已启用共享记录':s.status==='pending'?'等待确认合并':'连接管理';$('connection-info').textContent=s.peerEmail?'连接账号：'+s.peerEmail:'';
    if(s.status==='active'){$('domestic').hidden=true;$('overseas').hidden=true;$('preview').hidden=true;$('disconnect').textContent=globalSite?'解除共享并保留副本':'停用国际站共享';if(!globalSite)$('disconnect-note').textContent='停用后，国内记录保留；国际站不能再访问共享主记录。建议先在国际站解除共享，让它保留最新副本。';}
    else if(s.status==='pending'&&globalSite){$('refresh-preview').hidden=false;$('connect').hidden=true;}
    return s;
  };
  $('make-code').onclick=run(async()=>{const d=await api('code',{});$('connection-code').value=d.code;$('copy-code').disabled=false;status('连接码已生成，10 分钟内有效。');});
  $('copy-code').onclick=run(async()=>{try{await navigator.clipboard.writeText($('connection-code').value);status('已复制，请粘贴到你本人登录的国际站。');}catch{$('connection-code').focus();$('connection-code').select();status('请长按或按 Ctrl+C 复制选中的连接码。');}});
  const consent=()=>{if(!$('transfer-consent').checked)throw Error('请先确认账号归属和记录传输授权。');const dirty=localStorage.getItem('tripmate.v1.syncDirty');if(globalSite&&dirty===account.id)throw Error('本机还有未同步修改，请先回工作台同步或导出本机备份后再连接。');};
  $('connect').onclick=run(async()=>{consent();preview(await api('link',{code:$('paste-code').value.trim(),preferred:$('preferred').value}));});
  $('refresh-preview').onclick=run(async()=>{consent();preview(await api('preview',{preferred:$('preferred').value}));});
  $('preferred').onchange=()=>{if(activationId){activationId='';$('preview').hidden=true;status('选择已改变，请点击“重新预览”。');}};
  $('confirm').onclick=run(async()=>{consent();if(!$('confirm-consent').checked||!activationId)throw Error('请先检查当前预览，并勾选确认。');await api('confirm',{activationId});await refresh();status('合并完成。请返回两边工作台刷新，共享记录即可同步显示。');});
  $('backup').onclick=run(download);$('backup-preview').onclick=run(download);
  const localKeys=['draft','trips','orders','reminders','expenses','packing','emergency','preferences','largeMode'].map(key=>'tripmate.v1.'+key);
  const localSnapshot=()=>JSON.stringify(localKeys.map(key=>[key,localStorage.getItem(key)]));
  $('local-backup').onclick=run(async()=>{
    const scoped=localStorage.getItem('tripmate.v1.accountId');
    if(globalSite&&scoped!==account.id)throw Error('此浏览器副本不属于当前账号，请回工作台确认账号后再导出。');
    if(!globalSite)throw Error('国内本机备份请在工作台的账号备份中导出；这里可下载云端备份。');
    const state=Object.fromEntries(localKeys.flatMap(key=>{try{const value=localStorage.getItem(key);return value===null?[]:[[key,JSON.parse(value)]];}catch{return[];}}));saveFile({format:'tripmate-local-backup',account:account.email,state},'本机未同步记录');localBackupDone=true;localBackupSnapshot=localSnapshot();status('本机备份已交给浏览器下载，请检查文件后再采用云端记录。');
  });
  $('use-cloud').onclick=run(async()=>{
    if(!localBackupDone||!$('cloud-consent').checked)throw Error('请先导出本机记录并勾选确认。');
    let response=await fetch('/api/sync'),data=await response.json();if(!response.ok)throw Error(data.error||'读取云端记录失败。');
    if(data.clientBridge){const shared=await direct('state',data.token);data={data:shared.state,stateVersion:shared.stateVersion};}
    if(localStorage.getItem('tripmate.v1.accountId')!==account.id)throw Error('账号已变化，请刷新页面。');
    if(localSnapshot()!==localBackupSnapshot)throw Error('本机记录在备份后又有修改，请重新导出备份。');
    for(const key of localKeys)if(Object.hasOwn(data.data,key))localStorage.setItem(key,JSON.stringify(data.data[key]));else localStorage.removeItem(key);
    localStorage.setItem('tripmate.v1.cloudVersion',JSON.stringify(data.stateVersion));localStorage.removeItem('tripmate.v1.syncDirty');$('local-conflict').hidden=true;status('此浏览器已采用云端记录。请回工作台刷新；原本机内容保留在刚才的备份文件里。');
  });
  $('disconnect').onclick=run(async()=>{if(!window.confirm(globalSite?'解除后保留记录副本，确定继续？':'停用国际站共享访问，确定继续？'))return;const d=await api(globalSite?'disconnect':'revoke',{});status(d.revoked===false?'本站已解除并保留副本。国内授权未能撤销，请到国内站设置停用。':'连接已解除，原记录保留。');$('preview').hidden=true;$('overseas').hidden=!globalSite;$('domestic').hidden=globalSite;$('connect').hidden=false;$('refresh-preview').hidden=true;activationId='';await refresh();});
  (async()=>{try{const r=await fetch('/api/auth/me'),d=await r.json();account=d.user||d;if(!r.ok||(!account.email)||d.authenticated===false){$('account').textContent='请先登录当前站点，再返回本页。';$('login').hidden=false;return;}$('account').textContent=(globalSite?'国际':'国内')+'账号：'+account.email;$('domestic').hidden=globalSite;$('overseas').hidden=!globalSite;$('backups').hidden=false;$('local-backup').hidden=!globalSite;$('local-conflict').hidden=!(globalSite&&localStorage.getItem('tripmate.v1.syncDirty')===account.id);await refresh();}catch{status('无法连接账号服务，请确认网络并刷新。',true);}})();
})();
