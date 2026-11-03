import {readMemberCrew} from './crew.js';
import {queueCrewEvent,deliverCrewEvents} from './deploy_events.js';
import {revokeMcpToken,EXTERNAL_MCP_UNAVAILABLE} from './external-mcp.js';
import {readInstructions,saveInstructions,mergeInstructions,deleteInstructions} from './personal-instructions.js';
// Website accounts only: never manufacture Sites identity headers or MCP privileges.
const ORIGIN='https://kongboda-motorsports.jeongmin480.chatgpt.site';
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),n=>n.toString(16).padStart(2,'0')).join('');
const read=async(env,k)=>{const o=await env.BUCKET.get(k);return o?o.json():null;};
const write=(env,k,v)=>env.BUCKET.put(k,JSON.stringify(v));
const identityKey=async(provider,sub)=>'website-accounts/identity/'+await hash(provider+':'+sub)+'.json';
const accountKey=id=>'website-accounts/account/'+id+'.json';
export function displayName(value){
 const clean=typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,100):'';
 // Reorder only an unambiguous Hangul given-name + one-syllable family name.
 const parts=clean.split(/\s+/),surnames='김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부황보';
 if(parts.length===2&&/^[가-힣]{2,3}$/.test(parts[0])&&/^[가-힣]$/.test(parts[1])&&surnames.includes(parts[1]))return parts[1]+parts[0];
 if(parts.length===2&&/^[가-힣]$/.test(parts[0])&&/^[가-힣]{2,3}$/.test(parts[1])&&surnames.includes(parts[0]))return parts.join('');
 return clean;
}
// Prefer a real Latin profile name when provided; never invent a romanization.
export function localizedAccountName(language,...profiles){
 const names=profiles.filter(Boolean).flatMap(p=>[p.nameEn,p.name,p.nameKo]).map(displayName).filter(Boolean);
 if(language==='en')return names.find(n=>/[A-Za-z]/.test(n)&&!/[가-힣]/.test(n))||names[0]||'';
 return names.find(n=>/[가-힣]/.test(n))||names[0]||'';
}
export function platformIdentity(request){const sub=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');if(!sub||!email)return null;let name=request.headers.get('oai-authenticated-user-full-name')||'';if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(name);}catch{name='';}}name=displayName(name);return {provider:'chatgpt',sub,email,...(name?{name}:{})};}
// Set only by the Vercel adapter after Firebase Admin verifies a session cookie.
export function firebaseIdentity(request){const sub=request.headers.get('x-kongboda-firebase-user-id'),email=request.headers.get('x-kongboda-firebase-user-email');if(!sub||!email)return null;let raw=request.headers.get('x-kongboda-firebase-user-name')||'';if(request.headers.get('x-kongboda-firebase-user-name-encoding')==='percent-encoded-utf-8'){try{raw=decodeURIComponent(raw);}catch{raw='';}}const name=displayName(raw);return {provider:'google',sub,email,...(name?{name}:{})};}
async function find(env,identity,create=false){
 if(!identity)return null;const key=await identityKey(identity.provider,identity.sub),mapping=await read(env,key);
 if(mapping?.deleted)return {deleted:true};
 if(mapping){const account=await read(env,accountKey(mapping.accountId));return account&&!account.deleted?account:null;}
 if(!create)return null;
 const account={id:crypto.randomUUID(),email:identity.email,identities:[{provider:identity.provider,sub:identity.sub,key}],name:displayName(identity.name),nameEn:/[A-Za-z]/.test(identity.name||'')&&!/[가-힣]/.test(identity.name||'')?displayName(identity.name):undefined,createdAt:Date.now()};
 await write(env,accountKey(account.id),account);await write(env,key,{accountId:account.id});return account;
}
export async function accountIdentity(request,env,google,{create=false}={}){
 if(!env.BUCKET)return null;const chatgpt=platformIdentity(request);
 const identity=google||chatgpt;if(!identity)return null;
 let account=await find(env,identity,create);
 const canLink=!!(google&&chatgpt&&google.email.trim().toLowerCase()===chatgpt.email.trim().toLowerCase());
 if(create&&canLink&&!account?.deleted){
  const mapping=await read(env,await identityKey('google',google.sub));
  const platformMapping=await read(env,await identityKey('chatgpt',chatgpt.sub));
  const platform=await find(env,chatgpt,true);
  if(platform&&!platform.deleted&&account&&platform.id!==account.id&&!mapping?.disableAutoLink&&!platformMapping?.disableAutoLink){
   const identities=[...new Map([...platform.identities,...account.identities].map(i=>[i.key,i])).values()];
   await write(env,accountKey(platform.id),{...platform,identities,nameEn:platform.nameEn||account.nameEn,preferences:platform.preferences||account.preferences||null,liveAnalysisAccess:platform.liveAnalysisAccess||account.liveAnalysisAccess||null});
   for(const i of identities)await write(env,i.key,{accountId:platform.id});
   await mergeInstructions(env,platform.id,account.id);
   await env.BUCKET.delete(accountKey(account.id));account={...platform,identities,nameEn:platform.nameEn||account.nameEn,preferences:platform.preferences||account.preferences||null,liveAnalysisAccess:platform.liveAnalysisAccess||account.liveAnalysisAccess||null};
  }
 }
 const name=displayName(identity.name)||displayName(chatgpt?.name);
 const nameEn=localizedAccountName('en',identity,chatgpt,account);
 if(create&&account&&!account.deleted&&name&&(account.name!==name||(/[A-Za-z]/.test(nameEn)&&!/[가-힣]/.test(nameEn)&&account.nameEn!==nameEn))){account={...account,name,...(/[A-Za-z]/.test(nameEn)&&!/[가-힣]/.test(nameEn)?{nameEn}:{})};await write(env,accountKey(account.id),account);}
 return {account,chatgpt,google,canLink:!!(google&&chatgpt&&google.email.trim().toLowerCase()===chatgpt.email.trim().toLowerCase())};
}
export async function sharedLiveAllowed(request,env,google=null){
 const email=request.headers.get('oai-authenticated-user-email');
 if(email&&env.DEPLOY_OWNER_EMAIL&&email.toLowerCase()===env.DEPLOY_OWNER_EMAIL.toLowerCase())return true;
 const info=await accountIdentity(request,env,google);
 return !!(info?.account&&!info.account.deleted&&info.account.liveAnalysisAccess?.revision===(env.LIVE_ANALYSIS_KEY_REVISION||'1'));
}
export async function accountRoute(request,env,google,ctx){
 const u=new URL(request.url);if(!u.pathname.startsWith('/account/'))return null;
 const reply=(message,status=400)=>new Response(message,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
 if(request.method==='GET'&&u.pathname==='/account/crew'){
  const info=await accountIdentity(request,env,google);
  if(!info?.account||info.account.deleted)return reply('로그인이 필요합니다.',401);
  try{return new Response(JSON.stringify(await readMemberCrew(env,info.account,{cursor:u.searchParams.get('cursor')||undefined})),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});}catch(e){return reply(e.message,403);}
 }
 if(request.method==='GET'&&u.pathname==='/account/instructions'){
  const info=await accountIdentity(request,env,google);
  if(!info?.account||info.account.deleted)return reply('로그인이 필요합니다.',401);
  return new Response(JSON.stringify(await readInstructions(env,info.account)),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
 }
 if(request.method==='GET'&&u.pathname==='/account/preferences'){
  if(!env.BUCKET)return reply('계정 저장소를 사용할 수 없습니다.',503);
  const info=await accountIdentity(request,env,google);
  if(!info?.account||info.account.deleted)return reply('로그인이 필요합니다.',401);
  return new Response(JSON.stringify({preferences:info.account.preferences||null}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
 }
 if(request.method!=='POST')return reply('지원하지 않는 요청입니다.',405);
 const allowedOrigin=env.APP_ORIGIN||ORIGIN;
 if(u.origin!==allowedOrigin||request.headers.get('origin')!==allowedOrigin||request.headers.get('sec-fetch-site')==='cross-site')return reply('허용되지 않은 요청입니다.',403);
 if(!env.BUCKET)return reply('계정 저장소를 사용할 수 없습니다.',503);
 const info=await accountIdentity(request,env,google,{create:true});if(!info)return reply('로그인이 필요합니다.',401);
 const back=()=>new Response(null,{status:303,headers:{location:'/account','cache-control':'no-store'}});
 if(u.pathname==='/account/rejoin'){
  const identity=google||info.chatgpt;await env.BUCKET.delete(await identityKey(identity.provider,identity.sub));await find(env,identity,true);return back();
 }
 if(info.account?.deleted)return reply('탈퇴한 계정입니다. 다시 가입해 주세요.',403);
 if(u.pathname==='/account/instructions'){
  try{
   const form=await request.formData();
   const value=await saveInstructions(env,info.account,form.get('instructions'),Number(form.get('revision')));
   if(request.headers.get('accept')?.includes('application/json'))return new Response(JSON.stringify({saved:true,...value}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
   return back();
  }catch(e){return reply(e.message,409);}
 }
 if(u.pathname==='/account/mcp-token'){
  return reply(EXTERNAL_MCP_UNAVAILABLE,403);
 }
 if(u.pathname==='/account/mcp-revoke'){await revokeMcpToken(env,info.account);return back();}
 if(u.pathname==='/account/live-access'){
  if(!env.LIVE_ANALYSIS_KEY_HASH)return reply('실시간 분석 키 설정을 준비 중입니다.',503);
  const form=await request.formData(),value=form.get('access_key');
  if(typeof value!=='string'||!value||value.length>256)return reply('비밀 키를 확인해 주세요.',400);
  const rateKey='website-accounts/key-attempts/'+info.account.id+'.json';
  const previous=await read(env,rateKey),now=Date.now();
  const attempts=previous&&now-previous.startedAt<900000?previous:{startedAt:now,count:0};
  if(attempts.count>=5)return reply('입력 횟수를 초과했습니다. 15분 후 다시 시도해 주세요.',429);
  await write(env,rateKey,{...attempts,count:attempts.count+1});
  const digest=await hash(value),expected=env.LIVE_ANALYSIS_KEY_HASH;
  let different=digest.length^expected.length;for(let i=0;i<64;i++)different|=(digest.charCodeAt(i)||0)^(expected.charCodeAt(i)||0);
  if(different)return reply('비밀 키가 올바르지 않습니다. 뒤로 돌아가 다시 입력해 주세요.',403);
  await write(env,accountKey(info.account.id),{...info.account,liveAnalysisAccess:{revision:env.LIVE_ANALYSIS_KEY_REVISION||'1',activatedAt:info.account.liveAnalysisAccess?.activatedAt||now}});
  await env.BUCKET.delete(rateKey);
  if(!info.account.liveAnalysisAccess?.activatedAt){await queueCrewEvent(env,info.account.id,now);const delivery=deliverCrewEvents(env).catch(()=>console.error('Crew notification pending retry'));if(ctx?.waitUntil)ctx.waitUntil(delivery);else await delivery;}
  return new Response(null,{status:303,headers:{location:'/account?live_access=activated','cache-control':'no-store'}});
 }
 if(u.pathname==='/account/wec-preference'){
  const form=await request.formData(),values=form.getAll('manufacturer');
  if(values.length!==1||typeof values[0]!=='string'||values[0].length>100||/[<>\x00-\x1f]/.test(values[0]))return reply('WEC 하이퍼카 제조사는 최대 1개만 선택하세요.',400);
  const manufacturer=values[0].trim()||null;
  await write(env,accountKey(info.account.id),{...info.account,preferences:{version:1,series:'f1',mode:'none',team:null,drivers:[],...info.account.preferences,wecHypercarManufacturer:manufacturer,updatedAt:Date.now()}});
  return new Response(null,{status:303,headers:{location:'/account?preferences=saved','cache-control':'no-store'}});
 }
 if(u.pathname==='/account/preferences'){
  const form=await request.formData();
  const team=String(form.get('team')||'').trim(),drivers=form.getAll('driver').map(String).map(s=>s.trim()).filter(Boolean);
  const valid=s=>s.length<=100&&!/[<>\x00-\x1f]/.test(s);
  if(form.getAll('team').length>1||!valid(team)||drivers.some(s=>!valid(s))||drivers.length>2||new Set(drivers).size!==drivers.length)return reply('팀은 최대 1개, 서로 다른 드라이버는 최대 2명을 선택하세요.',400);
  const manufacturers=form.getAll('manufacturer');
  if(manufacturers.length>1||manufacturers.some(v=>typeof v!=='string'||!valid(v)))return reply('WEC 하이퍼카 제조사는 최대 1개만 선택하세요.',400);
  const wecHypercarManufacturer=manufacturers.length?String(manufacturers[0]).trim()||null:info.account.preferences?.wecHypercarManufacturer||null;
  const mode=team&&drivers.length?'both':team?'team':drivers.length?'drivers':'none';
  await write(env,accountKey(info.account.id),{...info.account,preferences:{...info.account.preferences,version:3,series:'f1',mode,team:team||null,drivers,wecHypercarManufacturer,updatedAt:Date.now()}});
  if(request.headers.get('accept')?.includes('application/json'))return new Response(JSON.stringify({saved:true}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
  return new Response(null,{status:303,headers:{location:'/account?preferences=saved','cache-control':'no-store'}});
 }
 if(u.pathname==='/account/link'){
  if(!info.canLink)return reply('동일한 이메일의 Google과 ChatGPT에 모두 로그인한 뒤 연결하세요.',409);
  const g=await find(env,google,true),c=await find(env,info.chatgpt,true);
  if(g?.deleted||c?.deleted)return reply('탈퇴한 계정은 먼저 다시 가입해야 합니다.',409);
  if(!g||!c)return reply('계정 상태를 확인하지 못했습니다.',409);
  if(g.id===c.id)return back();
  const identities=[...new Map([...c.identities,...g.identities].map(i=>[i.key,i])).values()];
  // Preserve the existing ChatGPT-backed site account. Provider accounts are not changed.
  await write(env,accountKey(c.id),{...c,identities,preferences:c.preferences||g.preferences||null,liveAnalysisAccess:c.liveAnalysisAccess||g.liveAnalysisAccess||null});
  for(const i of identities)await write(env,i.key,{accountId:c.id});
  await mergeInstructions(env,c.id,g.id);
  await env.BUCKET.delete(accountKey(g.id));return back();
 }
 if(u.pathname==='/account/unlink'){
  const provider=(await request.formData()).get('provider'),a=info.account;
  const current=google?'google':'chatgpt';
  if(!['google','chatgpt'].includes(provider)||provider===current)return reply('현재 로그인 수단은 유지해야 합니다.',409);
  const removed=a.identities.filter(i=>i.provider===provider);await write(env,accountKey(a.id),{...a,identities:a.identities.filter(i=>i.provider!==provider)});
  for(const i of removed)await env.BUCKET.delete(i.key);for(const i of a.identities.filter(i=>i.provider!==provider))await write(env,i.key,{accountId:a.id,disableAutoLink:true});return back();
 }
 if(u.pathname==='/account/delete'){
  if((await request.formData()).get('confirmation')!=='탈퇴')return reply('확인란에 탈퇴를 입력하세요.',400);
  const a=info.account;
  // No personal data retained in tombstones. Every linked identity loses the site account.
  for(const i of a.identities)await write(env,i.key,{deleted:true,deletedAt:Date.now()});
  const googleSubs=a.identities.filter(i=>i.provider==='google').map(i=>i.sub);
  if(googleSubs.length&&env.BUCKET.list){let cursor;do{const page=await env.BUCKET.list({prefix:'website-auth/google/session/',...(cursor?{cursor}:{})});for(const item of page.objects){const session=await read(env,item.key);if(googleSubs.includes(session?.sub))await env.BUCKET.delete(item.key);}cursor=page.truncated?page.cursor:null;}while(cursor);}
  await deleteInstructions(env,a.id);
  await env.BUCKET.delete(accountKey(a.id));await env.BUCKET.delete('website-accounts/key-attempts/'+a.id+'.json');
  const headers=new Headers({location:'/signout-with-chatgpt?return_to=%2Faccount%3Fdeleted%3D1','cache-control':'no-store'});
  headers.append('set-cookie','__Host-kongboda-google=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');
  return new Response(null,{status:303,headers});
 }
 return reply('지원하지 않는 요청입니다.',404);
}
export async function googleAccountDeleted(env,sub,issuedAt){const mapping=await read(env,await identityKey('google',sub));return !!mapping?.deleted&&(!issuedAt||issuedAt<=mapping.deletedAt);}
