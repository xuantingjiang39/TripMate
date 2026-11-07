import { bridgeError, cleanTravelState, summarizeTravel } from './tripmate-merge.mjs';
// Narrow server-to-server capability: record access only, never login, admin, AI or credits.
export function createDomesticBridge({authenticatedAccount,mutateAccounts,loadAccounts,readJsonBody,send,randomBytes,tokenDigest,accountStateVersion}){
  const snapshot=user=>({state:cleanTravelState(user.state||{}),stateVersion:accountStateVersion(user),bridgeStatus:user.regionalBridge?.status||'none',account:{name:user.name||'',email:user.email},summary:summarizeTravel(user.state||{})});
  const authGrant=(data,token)=>data.users.find(user=>user.regionalBridge?.tokenHash===tokenDigest(token)&&user.regionalBridge.expiresAt>Date.now());
  const issueToken=()=>randomBytes(32).toString('base64url');
  const sameOrigin=req=>{if(!req.headers.origin)return true;try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}};
  return async function handle(req,res,pathname){
    if(!pathname.startsWith('/api/bridge/'))return false;
    try{
      const corsOrigins=new Set(['https://tripmate.xuantingjiang39.chatgpt.site','https://tripmate-travel-planner.xuantingjiang39.chatgpt.site']);
      const corsOrigin=req.headers.origin;
      const browserGrant=['redeem','state','activate','disconnect'].includes(pathname.slice('/api/bridge/'.length));
      if(browserGrant&&corsOrigins.has(req.headers.origin)){
        res.setHeader('access-control-allow-origin',corsOrigin);res.setHeader('vary','Origin');
        res.setHeader('access-control-allow-methods','GET, POST, PUT, OPTIONS');res.setHeader('access-control-allow-headers','content-type, x-tripmate-sync-token');
        if(req.method==='OPTIONS'){send(res,204,'');return true;}
      }
      if(!['GET','POST','PUT'].includes(req.method))throw bridgeError('不支持的请求方式。',405);
      if(req.method!=='GET'&&!sameOrigin(req)&&!(browserGrant&&corsOrigins.has(req.headers.origin)))throw bridgeError('请从本站设置操作。',403);
      const action=pathname.slice('/api/bridge/'.length);
      if(['status','code','revoke','backup'].includes(action)){
        const account=await authenticatedAccount(req);if(!account)throw bridgeError('请先登录国内账号。',401);
        if(action==='status'&&req.method==='GET')return send(res,200,{supported:true,status:account.user.regionalBridge?.status||'none',peerEmail:account.user.regionalBridge?.peerEmail||'',hasBackup:Boolean(account.user.regionalBridgeBackup)}),true;
        if(action==='backup'&&req.method==='GET')return send(res,200,{format:'tripmate-regional-backup',site:'domestic',current:snapshot(account.user),beforeMerge:account.user.regionalBridgeBackup||null}),true;
        if(action==='code'&&req.method==='POST'){
          const code=issueToken();
          await mutateAccounts(data=>{const user=data.users.find(u=>u.id===account.user.id);if(user.regionalBridge?.status==='active'&&user.regionalBridge.expiresAt>Date.now())throw bridgeError('已有共享连接，请先停用后再连接。',409);user.regionalBridge={codeHash:tokenDigest(code),codeExpiresAt:Date.now()+10*60_000,status:'code'};});
          return send(res,200,{code,expiresIn:600}),true;
        }
        if(action==='revoke'&&req.method==='POST'){await mutateAccounts(data=>{delete data.users.find(u=>u.id===account.user.id).regionalBridge;});return send(res,200,{ok:true}),true;}
        throw bridgeError('不支持的请求方式。',405);
      }
      if(action==='redeem'&&req.method==='POST'){
        const body=await readJsonBody(req,4000),code=String(body.code||'');if(!/^[A-Za-z0-9_-]{43}$/.test(code))throw bridgeError('连接码无效或已过期。',401);
        const token=issueToken();
        const result=await mutateAccounts(data=>{const user=data.users.find(u=>u.regionalBridge?.codeHash===tokenDigest(code)&&u.regionalBridge.codeExpiresAt>Date.now());if(!user)throw bridgeError('连接码无效、已使用或已过期。',401);user.regionalBridge={tokenHash:tokenDigest(token),status:'pending',peerEmail:String(body.peerEmail||'').slice(0,160),expiresAt:Date.now()+20*60_000};return snapshot(user);});
        return send(res,200,{...result,token}),true;
      }
      const token=String(req.headers['x-tripmate-sync-token']||'');if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw bridgeError('共享授权失效，请重新连接。',401);
      const account=authGrant(await loadAccounts(),token);if(!account)throw bridgeError('共享授权已停用或过期。',401);
      if(action==='state'&&req.method==='GET')return send(res,200,snapshot(account)),true;
      if(action==='disconnect'&&req.method==='POST'){await mutateAccounts(data=>{const user=authGrant(data,token);if(user)delete user.regionalBridge;});return send(res,200,{ok:true}),true;}
      if((action==='activate'&&req.method==='POST')||(action==='state'&&req.method==='PUT')){
        const body=await readJsonBody(req,1_500_000),state=cleanTravelState(body.state);
        const result=await mutateAccounts(data=>{
          const user=authGrant(data,token);if(!user)throw bridgeError('共享授权已失效。',401);
          const grant=user.regionalBridge;
          if(action==='activate'&&grant.status==='active'){
            if(grant.activationId!==body.activationId)throw bridgeError('此连接已确认，请刷新状态。',409);
            return snapshot(user); // Network retries cannot replay an old merge over new edits.
          }
          if(action==='state'&&grant.status!=='active')throw bridgeError('请先预览并确认合并。',409);
          if(!Number.isSafeInteger(body.stateVersion)||body.stateVersion!==accountStateVersion(user))throw bridgeError('记录已被其他设备修改，请重新预览或刷新后重试。',409);
          if(action==='activate'){
            if(typeof body.activationId!=='string'||body.activationId.length<20)throw bridgeError('合并确认信息无效。');
            user.regionalBridgeBackup={savedAt:new Date().toISOString(),state:JSON.parse(JSON.stringify(user.state||{})),stateVersion:accountStateVersion(user)};
            grant.status='active';grant.activationId=body.activationId;grant.expiresAt=Number.MAX_SAFE_INTEGER;
          }
          user.state=state;user.stateVersion=accountStateVersion(user)+1;user.updatedAt=new Date().toISOString();return snapshot(user);
        });
        return send(res,200,result),true;
      }
      throw bridgeError('共享接口不存在。',404);
    }catch(error){send(res,Number(error.status||500),{error:error.status?error.message:'共享服务暂时不可用，请稍后重试。'});return true;}
  };
}
