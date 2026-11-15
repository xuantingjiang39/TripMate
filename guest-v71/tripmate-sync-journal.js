(() => {
  'use strict';
  const key=(user,kind)=>{if(!user?.id)throw Error('请先登录账号。');return(window.TripMateUnified?.international?'tripmate.unified.':'')+'tripmate.v1.'+kind+'.user.'+user.id;};
  function pending(user){
    const raw=localStorage.getItem(key(user,'pendingSync'));if(raw===null)return null;
    try{const value=JSON.parse(raw);if(value.format==='tripmate-pending-sync'&&value.version===1&&value.userId===user.id&&Number.isSafeInteger(value.baseVersion)&&value.baseVersion>=0)return value;}catch{}
    return {invalid:true,userId:user.id}; // Unreadable metadata never authorizes replacing local edits.
  }
  function mark(user,baseVersion){
    if(!Number.isSafeInteger(baseVersion)||baseVersion<0)throw Error('本机同步版本无法确认。');
    const old=pending(user);if(old?.invalid)throw Error('未同步状态异常，请先保存本机副本。');
    if(!old)localStorage.setItem(key(user,'pendingSync'),JSON.stringify({format:'tripmate-pending-sync',version:1,userId:user.id,baseVersion,createdAt:new Date().toISOString()}));
  }
  function rebase(user,version){if(!Number.isSafeInteger(version)||version<0)throw Error('同步版本无法确认。');localStorage.setItem(key(user,'pendingSync'),JSON.stringify({format:'tripmate-pending-sync',version:1,userId:user.id,baseVersion:version,createdAt:new Date().toISOString()}));}
  function clear(user){localStorage.removeItem(key(user,'pendingSync'));}
  function recoveries(user){
    const raw=localStorage.getItem(key(user,'syncRecoveries'));if(raw===null)return [];
    const values=JSON.parse(raw);
    if(!Array.isArray(values)||values.some(value=>value?.format!=='tripmate-account-backup'||value.user?.id!==user.id||!value.data?.state))throw Error('保留副本无法读取；为保护原内容，未覆盖本机档案。');
    return values;
  }
  function archive(user,backup){if(backup?.format!=='tripmate-account-backup'||backup.user?.id!==user.id||!backup.data?.state)throw Error('副本账号或格式不匹配。');const values=recoveries(user);values.push(backup);localStorage.setItem(key(user,'syncRecoveries'),JSON.stringify(values));}
  function purge(user){for(const name of ['pendingSync','syncRecoveries'])localStorage.removeItem(key(user,name));}
  window.TripMateSyncJournal=Object.freeze({pending,mark,rebase,clear,recoveries,archive,purge});
})();
