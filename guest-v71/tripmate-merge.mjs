// Shared by Node and the Sites Worker. Only travel state is eligible for merging.
export const travelKeys=['draft','trips','orders','reminders','expenses','packing','emergency','preferences','largeMode'].map(key=>'tripmate.v1.'+key);
const listKeys=['trips','orders','reminders','expenses','packing'].map(key=>'tripmate.v1.'+key);
export function bridgeError(message,status=400){return Object.assign(new Error(message),{status});}
export function cleanTravelState(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw bridgeError('旅行记录格式不正确。');
  const result={};
  for(const key of travelKeys){
    if(!Object.hasOwn(value,key))continue;
    const item=value[key];
    if(listKeys.includes(key)&&!Array.isArray(item))throw bridgeError('列表记录格式不正确：'+key);
    result[key]=JSON.parse(JSON.stringify(item));
  }
  if(new TextEncoder().encode(JSON.stringify(result)).length>1_400_000)throw bridgeError('合并后的记录超过容量，请先导出备份并整理；本次没有删减记录。',413);
  return result;
}
const stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}':JSON.stringify(value);
export function summarizeTravel(state){return Object.fromEntries(listKeys.map(k=>[k.split('.').at(-1),(state[k]||[]).length]));}
export function mergeTravelStates(domestic,overseas,preferred='domestic'){
  if(!['domestic','overseas'].includes(preferred))throw bridgeError('请选择保留哪一站的草稿与偏好。');
  const a=cleanTravelState(domestic),b=cleanTravelState(overseas),state={},summary={duplicates:0,conflicts:0,preferred,before:{domestic:summarizeTravel(a),overseas:summarizeTravel(b)}};
  for(const key of listKeys){
    const items=[],seen=new Set(),ids=new Set();
    for(const original of [...(a[key]||[]),...(b[key]||[])]){
      // Different booking/payment IDs can represent distinct purchases with identical details.
      const fingerprint=stable(original),hasId=original&&typeof original==='object'&&original.id!==undefined&&original.id!==null&&String(original.id)!=='';
      if(hasId&&seen.has(fingerprint)){summary.duplicates++;continue;}
      let item=original;
      if(item&&typeof item==='object'&&!Array.isArray(item)&&item.id!==undefined){
        if(ids.has(String(item.id))){summary.conflicts++;let suffix=1;while(ids.has(String(item.id)+'-merged-'+suffix))suffix++;item={...item,id:String(item.id)+'-merged-'+suffix};}
        ids.add(String(item.id));
      }
      if(hasId)seen.add(fingerprint);items.push(item);
    }
    state[key]=items;
  }
  const primary=preferred==='domestic'?a:b,secondary=preferred==='domestic'?b:a;
  for(const key of travelKeys.filter(k=>!listKeys.includes(k)))if(Object.hasOwn(primary,key)||Object.hasOwn(secondary,key))state[key]=Object.hasOwn(primary,key)?primary[key]:secondary[key];
  const draftKey='tripmate.v1.draft';
  if(a[draftKey]&&b[draftKey]&&stable(a[draftKey])!==stable(b[draftKey])){
    const other=secondary[draftKey],trips=state['tripmate.v1.trips'];
    if(!trips.some(item=>stable(item?.plan)===stable(other))){let id='merged-other-draft';while(trips.some(item=>item?.id===id))id+='-copy';trips.push({id,plan:other,savedAt:new Date().toISOString(),mergeSource:preferred==='domestic'?'overseas':'domestic'});}
    summary.conflicts++;
  }
  for(const key of ['tripmate.v1.preferences','tripmate.v1.emergency'])if(Object.hasOwn(a,key)&&Object.hasOwn(b,key)&&stable(a[key])!==stable(b[key]))summary.conflicts++;
  summary.after=summarizeTravel(state);
  return {state:cleanTravelState(state),summary};
}
