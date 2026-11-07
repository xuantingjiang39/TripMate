// Render actual screen component trees with native test hosts for a visual layout review.
// This is not an Android emulator or a hardware screenshot.
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loader, native, simplePlan } from './regression.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'.build-check/ui-preview');await mkdir(output,{recursive:true});
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const flatten=value=>typeof value==='function'?flatten(value({pressed:false})):Array.isArray(value)?Object.assign({},...value.map(flatten)):value||{};
function css(style){return Object.entries(flatten(style)).filter(([key])=>!['fontVariant','textAlignVertical','aspectRatio'].includes(key)).map(([key,value])=>{
  const name=key.replace(/[A-Z]/g,char=>'-'+char.toLowerCase());
  return `${name}:${typeof value==='number'&&!['flex','flexGrow','flexShrink','opacity','fontWeight','zIndex'].includes(key)?value+'px':value}`;
}).join(';');}
function html(node){
  if(node===null)return '';if(typeof node!=='object')return escape(node);if(Array.isArray(node))return node.map(html).join('');
  const props=node.props||{};const style=css([props.style,props.contentContainerStyle]);
  if(node.type==='Icon')return `<svg width="${props.size||20}" height="${props.size||20}" viewBox="0 0 24 24" fill="none" stroke="${props.color||'#2459d3'}" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>`;
  const tag=node.type==='Text'?'p':node.type==='TextInput'?'textarea':'div';
  return `<${tag} data-native="${node.type}" style="${style}">${tag==='textarea'?escape(props.value||props.placeholder||''):html(node.children||[])}</${tag}>`;
}
for(const theme of ['light','dark']){
  const plan={...simplePlan('杭州 · 陪妈妈慢游三天'),summary:'把西湖与老街分开游览，每天安排午休。',advice:'出发前检查天气、预约和证件。',transportLegs:[{day:'DAY 1',from:'杭州东站',to:'西湖',mode:'地铁',cost:12}]};
  plan.days[0].events=[{name:'09:00 西湖湖滨散步',note:'从湖滨步道出发，走累了在湖边休息。'},{name:'12:00 湖滨午餐与午休',note:'按自己的体力调整时间。'},{name:'16:00 河坊街慢逛',note:'留出回酒店休息的时间。'}];
  const value={plan,loading:false,saving:false,pendingCount:0,dayIndex:0,selectDay:()=>{},refresh:async()=>{}};
  const load=loader({'react-native':{...native,useColorScheme:()=>theme},
    [resolve(root,'src/plan/PlanContext.tsx')]:{usePlan:()=>value},
    [resolve(root,'src/auth/AuthContext.tsx')]:{useAuth:()=>({user:{id:'synthetic',name:'旅行者',email:'preview@example.invalid'}})},
    'expo-location':{PermissionStatus:{GRANTED:'granted',DENIED:'denied'}},
    [resolve(root,'src/api.ts')]:{api:async()=>({balance:10}),diagnoseConnection:async()=>'',ApiError:Error}});
  for(const screen of ['Today','Plan','TripDetail','Profile']){
    const Component=load(`src/screens/${screen}Screen.tsx`)[screen+'Screen'];let renderer;
    await act(async()=>{renderer=TestRenderer.create(React.createElement(Component,{navigation:{navigate:()=>{}}}));});
    const tree=renderer.toJSON();await act(async()=>renderer.unmount());
    const background=theme==='dark'?'#0D1524':'#F5F7FB',text=theme==='dark'?'#F4F7FC':'#14233D';
    await writeFile(resolve(output,`${theme}-${screen}.html`),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Component layout preview</title><style>*{box-sizing:border-box}body{margin:0;background:${background};color:${text};font:15px/1.5 "Microsoft YaHei",system-ui,sans-serif}p{margin:0}div{display:flex;flex-direction:column;min-width:0;flex-shrink:0}textarea{font:inherit;resize:none}svg{flex-shrink:0}header{height:56px;padding:12px 18px;font-weight:700}footer{min-height:70px;display:flex;justify-content:space-around;border-top:1px solid #66748a33;padding:18px 8px;font-size:13px}body:has([data-native="ScrollView"]){min-height:100vh}</style><header>${screen==='Today'?'今天':screen==='Plan'?'规划':screen==='Profile'?'我的':'完整攻略'}</header>${html(tree)}<footer>今天　　规划　　行程　　我的</footer></html>`,'utf8');
  }
}
console.log('Component visual preview files:',output);
