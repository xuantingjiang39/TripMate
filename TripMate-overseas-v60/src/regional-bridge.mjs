import { bridgeError, cleanTravelState, mergeTravelStates } from './tripmate-merge.mjs';

// The browser talks to the IP origin over CORS. Workers cannot fetch raw IP URLs.
// The stored capability only reads/writes this user's travel records, never AI, credits or login.
export function createRegionalBridge({publicSession,jsonResponse,sameOrigin,parseJsonRequest,randomToken}){
  const getLink=(env,id)=>env.DB.prepare('SELECT * FROM regional_links WHERE user_id = ?').bind(id).first();
  const payload=link=>JSON.parse(link.payload||'{}');
  const guarded=async task=>{try{return await task();}catch(e){return jsonResponse({error:e.status?e.message:'共享服务暂时不可用，请稍后重试。'},Number(e.status||503));}};
  const requireUser=async(request,env)=>{const user=await publicSession(request,env);if(!user)throw bridgeError('请先登录国际站账号。',401);if(request.method!=='GET'&&!sameOrigin(request))throw bridgeError('请从本站设置操作。',403);return user;};
  const validateSnapshot=snapshot=>{if(!snapshot||!Number.isSafeInteger(snapshot.stateVersion)||!snapshot.account?.email)throw bridgeError('请先通过连接码读取国内账号。');return {...snapshot,state:cleanTravelState(snapshot.state)};};
  const previewResult=p=>({summary:p.summary,domesticAccount:p.account,preferred:p.summary.preferred,tripTitles:(p.state['tripmate.v1.trips']||[]).map(item=>String(item?.plan?.title||item?.title||'未命名行程')).slice(0,100),activationId:p.activationId});
  const prepare=async(env,user,link,snapshot,preferred)=>{
    const domestic=validateSnapshot(snapshot),local=await env.DB.prepare('SELECT data,updated_at FROM app_state WHERE id = ?').bind(user.id).first();
    // A lost response after domestic activation can only finish the existing merge, never start another.
    if(domestic.bridgeStatus==='active'&&payload(link).activationId)return payload(link);
    const overseas=JSON.parse(local?.data||'{}'),merged=mergeTravelStates(domestic.state,overseas,preferred);
    const p={activationId:randomToken(24),domesticVersion:domestic.stateVersion,domesticBefore:domestic.state,overseasBefore:overseas,localUpdatedAt:local?.updated_at||'',account:domestic.account,...merged};
    if(new TextEncoder().encode(JSON.stringify(p)).length>1_400_000)throw bridgeError('原始备份和预览超过本次合并容量。请取消连接后导出整理，记录未被删减。',413);
    const result=await env.DB.prepare("UPDATE regional_links SET payload = ? WHERE user_id = ? AND status = 'pending'").bind(JSON.stringify(p),user.id).run();
    if(!result.meta?.changes)throw bridgeError('连接状态已变化，请刷新。',409);return p;
  };
  return {
    async handle(request,env){return guarded(async()=>{
      if(!env.DB)throw bridgeError('云端数据库暂不可用。',503);
      const user=await requireUser(request,env),action=new URL(request.url).pathname.slice('/api/bridge/'.length);let link=await getLink(env,user.id);
      if(action==='status'&&request.method==='GET')return jsonResponse({supported:true,status:link?.status||'none',peerEmail:link?payload(link).account?.email||'':'',hasBackup:Boolean(link)});
      if(action==='access'&&request.method==='GET'){
        if(!link)throw bridgeError('请先连接国内账号。',409);
        return jsonResponse({status:link.status,token:link.token,origin:'https://111.230.133.155'});
      }
      if(action==='backup'&&request.method==='GET'){
        const row=await env.DB.prepare('SELECT data FROM app_state WHERE id = ?').bind(user.id).first(),p=link?payload(link):{};
        const archives=await env.DB.prepare('SELECT id,created_at FROM regional_archives WHERE user_id = ? ORDER BY id DESC').bind(user.id).all();
        return jsonResponse({format:'tripmate-regional-backup',version:1,account:user.email,exportedAt:new Date().toISOString(),overseasOriginal:p.overseasBefore||JSON.parse(row?.data||'{}'),domesticBefore:p.domesticBefore||null,archives:archives.results});
      }
      if(action==='archive'&&request.method==='GET'){
        const id=Number(new URL(request.url).searchParams.get('id'));if(!Number.isSafeInteger(id)||id<1)throw bridgeError('备份编号不正确。');
        const row=await env.DB.prepare('SELECT data,created_at FROM regional_archives WHERE user_id = ? AND id = ?').bind(user.id,id).first();if(!row)throw bridgeError('没有属于当前账号的备份。',404);
        return jsonResponse({format:'tripmate-regional-backup',version:1,createdAt:row.created_at,data:JSON.parse(row.data)});
      }
      if(action==='prepare-confirm'&&request.method==='GET'){
        if(!link)throw bridgeError('请先连接并预览。',409);const p=payload(link);if(!p.state)throw bridgeError('请重新预览。',409);
        return jsonResponse({state:p.state,stateVersion:p.domesticVersion,activationId:p.activationId});
      }
      if(request.method!=='POST')throw bridgeError('不支持的共享操作。',405);
      const body=await parseJsonRequest(request,1_500_000);
      if(action==='link'){
        if(link)throw bridgeError('已有连接，请先完成或取消。',409);
        if(!/^[A-Za-z0-9_-]{43}$/.test(String(body.token||'')))throw bridgeError('请先验证国内站连接码。');validateSnapshot(body.domestic);
        try{await env.DB.prepare("INSERT INTO regional_links (user_id,token,status,payload) VALUES (?,?,'pending','{}')").bind(user.id,body.token).run();}catch{throw bridgeError('已有连接请求，请刷新设置。',409);}
        link=await getLink(env,user.id);return jsonResponse({status:'pending',...previewResult(await prepare(env,user,link,body.domestic,body.preferred||'domestic'))});
      }
      if(!link)throw bridgeError('请先连接国内账号。',409);
      if(action==='preview'){
        if(link.status!=='pending')throw bridgeError('已经共用记录，无需再次合并。',409);
        return jsonResponse(previewResult(await prepare(env,user,link,body.domestic,body.preferred||'domestic')));
      }
      if(action==='confirm'){
        if(link.status==='active')return jsonResponse({ok:true,status:'active'});
        const p=payload(link);if(!p.state||body.activationId!==p.activationId||body.activated!==true)throw bridgeError('请先检查预览，并完成国内主记录的确认。',409);
        const row=await env.DB.prepare('SELECT updated_at FROM app_state WHERE id = ?').bind(user.id).first();if((row?.updated_at||'')!==p.localUpdatedAt)throw bridgeError('国际站记录有变化，请重新预览。',409);
        await env.DB.prepare("UPDATE regional_links SET status = 'active' WHERE user_id = ? AND status = 'pending'").bind(user.id).run();return jsonResponse({ok:true,status:'active'});
      }
      if(action==='disconnect'){
        const copy=link.status==='active'||body.domestic?.bridgeStatus==='active';
        if(copy){const snapshot=validateSnapshot(body.domestic),now=new Date().toISOString();await env.DB.batch([
          env.DB.prepare('INSERT INTO regional_archives (user_id,data,created_at) VALUES (?,?,?)').bind(user.id,link.payload,now),
          env.DB.prepare('INSERT INTO app_state (id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(user.id,JSON.stringify(snapshot.state),now),
          env.DB.prepare('DELETE FROM regional_links WHERE user_id = ?').bind(user.id)
        ]);}else await env.DB.batch([env.DB.prepare('INSERT INTO regional_archives (user_id,data,created_at) VALUES (?,?,?)').bind(user.id,link.payload,new Date().toISOString()),env.DB.prepare('DELETE FROM regional_links WHERE user_id = ?').bind(user.id)]);
        return jsonResponse({ok:true});
      }
      throw bridgeError('共享操作不存在。',404);
    });},
    async state(request,env){return guarded(async()=>{
      if(!['GET','PUT'].includes(request.method))throw bridgeError('不支持的同步方式。',405);
      const user=await requireUser(request,env),link=await getLink(env,user.id);if(!link)return null;
      if(link.status!=='active')throw bridgeError('正在预览合并，云端保存暂时暂停。请完成或取消；本机修改仍保留。',409);
      // Same-origin authenticated response; client keeps token only in memory and sends no cookies cross-site.
      return jsonResponse({clientBridge:true,token:link.token,origin:'https://111.230.133.155'});
    });}
  };
}
